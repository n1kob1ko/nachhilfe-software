/**
 * The manual provider (ADR 0009, „manueller KI-Modus"): no request ever leaves the app.
 *
 * A manual call is parked, not answered: the transport registers the request in a process-wide
 * registry and returns a promise that stays open until the teacher pastes an answer. The UI reads the
 * parked prompt, the teacher copies it into whatever model they use, and the pasted answer is run
 * through exactly the same extraction/repair/schema check as an API answer (`./repair`), so the
 * router and every KI function see an AIResult they cannot tell apart from a real one.
 *
 * Why parking: the transport contract is `(req) => Promise<AIResult>`, and the function that called
 * runAI (builder, druckblatt, lesen) must carry on with the teacher's answer without a second code
 * path. While the teacher answers, the original server action stays open — bounded, see below.
 *
 * Timeout/abandonment:
 * - `runAI` uses MANUAL_TIMEOUT_MS (30 min) instead of the API timeout, because a copy/paste round
 *   trip needs minutes, not seconds. It aborts `req.signal` when that is up; the transport then drops
 *   the parked entry and answers `parsed: null` (so a teacher who walks away is not counted as an
 *   outage by the router's circuit breaker).
 * - The answer dialog also sends a DELETE when the page is left; that settles the request at once.
 * - Nothing is billed: the entry is answered with zero usage and `costUsd: 0`.
 *
 * The prompt shown is masked before it is displayed: `detectNames` finds the names in the system
 * prompt and the user prompt and `namePattern`/`maskText` replace them by `[Name]`, exactly the
 * functions the sending path uses for a student text. The registry never stores anything else.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { detectNames } from "../../name-detection";
import { maskText, namePattern } from "../../text-correction-core";
import { FUNCTIONS, MANUAL_MODEL, MANUAL_TIMEOUT_MS, type AIFunction } from "../config";
import { parseLenient } from "./repair";
import type { AIRequest, AIResult, AnswerFailure, Transport } from "./types";

/** The answer costs nothing; the log row keeps that visible. */
const ZERO_USAGE = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

/** What the answer dialog shows for one parked request. */
export type ManualAnfrage = {
  id: string;
  fn: AIFunction;
  label: string;
  /** The complete prompt, already name-masked, ready to copy. */
  prompt: string;
  createdAt: number;
  expiresAt: number;
  /** Why the last paste was not accepted (kept until a paste is accepted). */
  problem?: string;
};

type Pending = ManualAnfrage & {
  schema: z.ZodType;
  settle: (r: AIResult) => void;
};

// shared by every copy of this module (Next.js may load it once per route)
const shared = globalThis as unknown as { __aiManual?: Map<string, Pending> };
const pending = (shared.__aiManual ??= new Map<string, Pending>());

const schemaJson = new WeakMap<z.ZodType, Record<string, unknown>>();
function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  let s = schemaJson.get(schema);
  if (!s) {
    const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
    void _drop;
    schemaJson.set(schema, (s = rest));
  }
  return s;
}

/** Every name in the text replaced by `[Name]` — the same two calls as the sending path. */
export function maskForDisplay(text: string): string {
  const pattern = namePattern(detectNames([text]));
  return pattern ? maskText(text, pattern).masked : text;
}

/**
 * The prompt as one block: instructions, the required JSON schema and the task. The schema belongs in
 * the block because a chat window has no json_schema: without it most models answer in prose.
 * The block is masked before it is returned and before it is stored.
 */
export function manualPrompt(req: AIRequest): string {
  const inhalt =
    typeof req.content === "string"
      ? req.content
      : req.content.map((p) => (p.type === "text" ? p.text : "[Anhang: Bild oder PDF – im manuellen Modus nicht möglich]")).join("\n\n");
  const block = [
    req.system.trim(),
    "",
    "Antworte ausschließlich mit einem JSON-Objekt nach diesem JSON-Schema:",
    JSON.stringify(jsonSchemaOf(req.schema)),
    "",
    "---",
    "",
    inhalt.trim(),
  ].join("\n");
  return maskForDisplay(block);
}

// ---------- JSON in einer eingefügten Antwort finden ----------

/** Denkspuren einiger Modelle (Qwen3, DeepSeek-R1) vorab entfernen. */
const THINK = /<think[\s\S]*?<\/think>/gi;
/** Codezäune: ```json { … } ``` */
const FENCE = /```(?:json)?\s*([\s\S]*?)```/gi;

function firstOpener(text: string): number {
  const brace = text.indexOf("{");
  const bracket = text.indexOf("[");
  if (brace < 0) return bracket;
  if (bracket < 0) return brace;
  return Math.min(brace, bracket);
}

/** The end of the balanced JSON value that starts at `start`, respecting strings and escapes; -1 when unclosed. */
function balancedEnd(text: string, start: number): number {
  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer && --depth === 0) return i;
  }
  return -1;
}

/** The first JSON value in a pasted answer as text, also inside a code fence or after a sentence. */
export function extractJsonText(text: string): string | null {
  const ohneDenken = text.replace(THINK, " ");
  const kandidaten = [...ohneDenken.matchAll(FENCE)].map((m) => m[1]);
  kandidaten.push(ohneDenken);
  for (const kandidat of kandidaten) {
    const start = firstOpener(kandidat);
    if (start < 0) continue;
    const ende = balancedEnd(kandidat, start);
    if (ende < 0) continue;
    return kandidat.slice(start, ende + 1);
  }
  return null;
}

function jsonFromText(text: string): { ok: true; value: unknown } | { ok: false; fehler: string } {
  const schnipsel = extractJsonText(text);
  if (schnipsel == null) return { ok: false, fehler: "In der Antwort steckt kein JSON. Bitte die ganze Antwort des Modells einfügen." };
  try {
    return { ok: true, value: JSON.parse(schnipsel) };
  } catch {
    return { ok: false, fehler: "Das JSON in der Antwort ist nicht lesbar. Bitte die Antwort vollständig einfügen." };
  }
}

// ---------- das Parken ----------

function abbruch(problem: string): AIResult {
  const failure: AnswerFailure = "leer";
  return { parsed: null, refusal: false, failure, problem, model: MANUAL_MODEL, usage: { ...ZERO_USAGE }, costUsd: 0 };
}

/**
 * Parks the request and waits for the teacher. Resolves when an answer is accepted (answerManual),
 * when the request is given up (cancelManual, the page left) or when `req.signal` aborts.
 */
export const manualTransport: Transport = (req) =>
  new Promise<AIResult>((resolve) => {
    const id = `m-${randomUUID()}`;
    const createdAt = Date.now();
    const expiresAt = createdAt + Math.max(1_000, req.timeoutMs || MANUAL_TIMEOUT_MS);
    const eintrag: Pending = {
      id,
      fn: req.fn,
      label: FUNCTIONS[req.fn].label,
      prompt: manualPrompt(req),
      createdAt,
      expiresAt,
      schema: req.schema,
      settle: () => {},
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    /** Einmal beendet, bleibt beendet — auch ein Abbruch, bevor die Anfrage im Register steht. */
    let fertig = false;
    // a settled request is removed first, so a second answer (or a cancel racing the timeout) is a no-op
    const beenden = (r: AIResult) => {
      if (fertig) return;
      fertig = true;
      pending.delete(id);
      if (timer) clearTimeout(timer);
      req.signal.removeEventListener("abort", abbrechen);
      resolve(r);
    };
    const abbrechen = () => beenden(abbruch("Die manuelle Anfrage wurde abgebrochen."));
    eintrag.settle = beenden;
    if (req.signal.aborted) {
      beenden(abbruch("Die manuelle Anfrage wurde abgebrochen."));
      return;
    }
    pending.set(id, eintrag);
    req.signal.addEventListener("abort", abbrechen, { once: true });
    timer = setTimeout(abbrechen, expiresAt - Date.now());
    timer.unref?.();
  });

/** The parked requests, oldest first; expired ones are settled and dropped on the way. */
export function pendingManual(now = Date.now()): ManualAnfrage[] {
  for (const e of [...pending.values()]) if (e.expiresAt <= now) e.settle(abbruch("Die manuelle Anfrage ist abgelaufen."));
  return [...pending.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({
      id: e.id,
      fn: e.fn,
      label: e.label,
      prompt: e.prompt,
      createdAt: e.createdAt,
      expiresAt: e.expiresAt,
      ...(e.problem ? { problem: e.problem } : {}),
    }));
}

export type ManualAntwort = { ok: true } | { ok: false; fehler: string };

/**
 * The pasted answer. Valid answers settle the parked request and let the waiting function carry on;
 * invalid ones are reported back and the request stays open, so the teacher can paste again.
 * The validation is the one of an API answer: extract, repair, then the request's own zod schema.
 */
export function answerManual(id: string, antwort: string): ManualAntwort {
  const eintrag = pending.get(id);
  if (!eintrag) return { ok: false, fehler: "Diese Anfrage steht nicht mehr offen. Bitte den Prompt neu erzeugen." };
  const text = (antwort ?? "").trim();
  if (!text) {
    const fehler = "Es wurde keine Antwort eingefügt.";
    eintrag.problem = fehler;
    return { ok: false, fehler };
  }
  const gelesen = jsonFromText(text);
  if (!gelesen.ok) {
    eintrag.problem = gelesen.fehler;
    return { ok: false, fehler: gelesen.fehler };
  }
  const geprueft = parseLenient(eintrag.schema, gelesen.value, jsonSchemaOf(eintrag.schema));
  if (geprueft.data == null) {
    const fehler = geprueft.problem ?? "Die Antwort passt nicht zur verlangten Form.";
    eintrag.problem = fehler;
    return { ok: false, fehler };
  }
  eintrag.settle({
    parsed: geprueft.data,
    refusal: false,
    model: MANUAL_MODEL,
    usage: { ...ZERO_USAGE },
    costUsd: 0,
    ...(geprueft.problem ? { problem: geprueft.problem } : {}),
  });
  return { ok: true };
}

/** The teacher gives up (or leaves the page): the waiting function ends with "keine Antwort". */
export function cancelManual(id: string): boolean {
  const eintrag = pending.get(id);
  if (!eintrag) return false;
  eintrag.settle(abbruch("Die manuelle Anfrage wurde verworfen."));
  return true;
}

/** Nur für Tests: alle offenen Anfragen schließen. */
export function resetManualForTests(): void {
  for (const e of [...pending.values()]) e.settle(abbruch("Test beendet."));
  pending.clear();
}
