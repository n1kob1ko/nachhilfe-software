/**
 * The one door to Claude. Every KI function of the app asks here; the router decides whether a request
 * is needed at all (same question recently answered, budget used up, API down), picks the model of the
 * function's tier, enforces its token limit and timeout, and logs what the request cost.
 * When anything fails the caller gets { ok: false } and carries on without KI.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam, BetaTextBlockParam, BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { FUNCTIONS, aiSwitchedOff, costOf, hasKey, modelFor, type AIFunction, type FunctionSpec, type Usage } from "./config";
import { budgetState, logCall, type CallStatus } from "./log";

export type AIMeta = { teacherId?: number | null; unitId?: number | null; trigger?: string };

export type TransportParams = {
  model: string;
  max_tokens: number;
  system: BetaTextBlockParam[];
  messages: { role: "user"; content: string | BetaContentBlockParam[] }[];
  thinking?: BetaThinkingConfigParam;
  output_config: { effort?: "low" | "medium" | "high" };
};
export type TransportResult = { parsed: unknown; refusal: boolean; model: string; usage: Usage; simulatedMs?: number };
export type Transport = (p: TransportParams, o: { fn: AIFunction; schema: z.ZodType; signal: AbortSignal; timeoutMs: number }) => Promise<TransportResult>;

let client: Anthropic | null = null;
const anthropicTransport: Transport = async (p, o) => {
  client ??= new Anthropic();
  // streamed: a non-streamed request with a large max_tokens is refused by the SDK (10-minute rule)
  const res = await client.beta.messages
    .stream({ ...p, output_config: { ...p.output_config, format: betaZodOutputFormat(o.schema) } }, { signal: o.signal, timeout: o.timeoutMs, maxRetries: 1 })
    .finalMessage();
  const u = res.usage;
  return {
    parsed: res.parsed_output ?? null,
    refusal: res.stop_reason === "refusal",
    model: res.model,
    usage: {
      input: u.input_tokens,
      output: u.output_tokens,
      cacheWrite: u.cache_creation ? u.cache_creation.ephemeral_5m_input_tokens : (u.cache_creation_input_tokens ?? 0),
      cacheWrite1h: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
    },
  };
};

// ---------- replaceable parts (tests and the 60-minute simulation) ----------
let transport: Transport = anthropicTransport;
let custom = false;
let testRun = false;
let now = () => Date.now();

/** Replaces the API (null = the real one). A replaced transport counts as "KI on" without a key. */
export function setTransport(t: Transport | null) {
  transport = t ?? anthropicTransport;
  custom = t !== null;
}
/** Rows logged from now on are marked as test and do not count for the budget. */
export function setTestRun(on: boolean) {
  testRun = on;
}
export function setClock(fn: (() => number) | null) {
  now = fn ?? (() => Date.now());
}
export function clockNow() {
  return now();
}

export function aiEnabled() {
  return !aiSwitchedOff() && (custom || hasKey());
}

// ---------- circuit breaker: after 3 failures in a row, 5 minutes without requests ----------
const BREAK_AFTER = 3;
const BREAK_MS = 5 * 60_000;
// shared by every copy of this module (Next.js may load it once per route)
const shared = globalThis as unknown as { __aiRouter?: { breaker: { failures: number; until: number }; done: Map<string, { at: number; data: unknown }>; inflight: Map<string, Promise<Outcome<unknown>>> } };
const state = (shared.__aiRouter ??= { breaker: { failures: 0, until: 0 }, done: new Map(), inflight: new Map() });
const breaker = state.breaker;
export function breakerState() {
  return { paused: breaker.until > now(), until: breaker.until, failures: breaker.failures };
}

// ---------- reuse of identical requests ----------
const { done, inflight } = state;
const MAX_REMEMBERED = 300;

export function resetRouter() {
  done.clear();
  inflight.clear();
  breaker.failures = 0;
  breaker.until = 0;
}

function fingerprint(fn: AIFunction, model: string, system: string, prompt: string | BetaContentBlockParam[]) {
  return createHash("sha256").update(JSON.stringify([fn, model, system, prompt])).digest("hex");
}

/** How a request is shaped for a model: no thinking where the answer is short, effort where supported. */
export function requestShape(model: string, spec: FunctionSpec): Pick<TransportParams, "thinking" | "output_config"> {
  // the small model answers directly and does not take an effort setting
  if (/haiku/.test(model)) return { output_config: {} };
  if (spec.thinking === "aus") {
    // models with adaptive thinking that cannot switch it off: thinking only between tools = none here
    return /sonnet-5-5/.test(model) ? { thinking: { type: "between_tools" }, output_config: { effort: spec.effort } } : { output_config: { effort: spec.effort } };
  }
  return { thinking: { type: "adaptive" }, output_config: { effort: spec.effort } };
}

export type Outcome<T> =
  | { ok: true; data: T; reused: boolean; callId: number | null }
  | { ok: false; status: "aus" | "budget" | "pausiert" | "timeout" | "fehler" | "abgelehnt"; message: string; callId: number | null };

const MESSAGES = {
  aus: "Die KI ist ausgeschaltet oder es ist kein Schlüssel hinterlegt.",
  budget: "Das KI-Budget für diesen Monat ist aufgebraucht.",
  pausiert: "Claude war zuletzt nicht erreichbar, die KI pausiert ein paar Minuten.",
  timeout: "Claude hat nicht rechtzeitig geantwortet.",
  abgelehnt: "Claude hat keine Antwort geliefert.",
};

/**
 * One structured request. `maxTokens` may lower the function's limit, never raise it.
 * Never throws: failures come back as { ok: false } with a German message.
 */
export async function runAI<S extends z.ZodType>(
  fn: AIFunction,
  schema: S,
  system: string,
  prompt: string | BetaContentBlockParam[],
  o: { maxTokens?: number; meta?: AIMeta } = {},
): Promise<Outcome<z.infer<S>>> {
  if (!aiEnabled()) return { ok: false, status: "aus", message: MESSAGES.aus, callId: null };
  const spec = FUNCTIONS[fn];
  const model = modelFor(spec.tier);
  const meta = o.meta ?? {};
  const log = (status: CallStatus, extra: Partial<Parameters<typeof logCall>[0]> = {}) =>
    logCall({
      fn,
      tier: spec.tier,
      model,
      teacherId: meta.teacherId ?? null,
      unitId: meta.unitId ?? null,
      trigger: meta.trigger ?? "",
      input: 0,
      output: 0,
      cacheWrite: 0,
      cacheRead: 0,
      durationMs: 0,
      costUsd: 0,
      status,
      test: testRun,
      at: now(),
      ...extra,
    });

  const fp = fingerprint(fn, model, system, prompt);
  const kept = spec.reuseMs > 0 ? done.get(fp) : undefined;
  if (kept && kept.at > now() - spec.reuseMs) return { ok: true, data: kept.data as z.infer<S>, reused: true, callId: log("cache") };
  const running = inflight.get(fp);
  if (running) {
    const r = await running;
    return r.ok ? { ...r, data: r.data as z.infer<S>, reused: true, callId: log("cache") } : r;
  }
  if (breaker.until > now()) return { ok: false, status: "pausiert", message: MESSAGES.pausiert, callId: log("pausiert") };
  const b = budgetState(now());
  if (b.level === "aus" || (b.level === "echtzeit-aus" && spec.realtime)) return { ok: false, status: "budget", message: MESSAGES.budget, callId: log("budget") };

  const call = (async (): Promise<Outcome<z.infer<S>>> => {
    const maxTokens = Math.max(1, Math.min(o.maxTokens ?? spec.maxTokens, spec.maxTokens));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), spec.timeoutMs);
    const started = Date.now();
    try {
      const res = await transport(
        {
          model,
          max_tokens: maxTokens,
          // system prompt (and output schema) are the same for every request of a function: cached where it pays off
          system: [spec.cache === "aus" ? { type: "text", text: system } : { type: "text", text: system, cache_control: { type: "ephemeral", ttl: spec.cache } }],
          messages: [{ role: "user", content: prompt }],
          ...requestShape(model, spec),
        },
        { fn, schema, signal: ctrl.signal, timeoutMs: spec.timeoutMs },
      );
      const cost = costOf(res.model || model, spec.tier, res.usage);
      const usage = { input: res.usage.input, output: res.usage.output, cacheWrite: res.usage.cacheWrite + (res.usage.cacheWrite1h ?? 0), cacheRead: res.usage.cacheRead, costUsd: cost, model: res.model || model };
      const durationMs = res.simulatedMs ?? Date.now() - started;
      breaker.failures = 0;
      if (res.refusal || res.parsed == null) return { ok: false, status: "abgelehnt", message: MESSAGES.abgelehnt, callId: log("abgelehnt", { ...usage, durationMs }) };
      const callId = log("ok", { ...usage, durationMs });
      if (spec.reuseMs > 0) {
        done.set(fp, { at: now(), data: res.parsed });
        if (done.size > MAX_REMEMBERED) done.delete(done.keys().next().value!);
      }
      return { ok: true, data: res.parsed as z.infer<S>, reused: false, callId };
    } catch (e) {
      const timedOut = ctrl.signal.aborted;
      breaker.failures += 1;
      if (breaker.failures >= BREAK_AFTER) {
        breaker.until = now() + BREAK_MS;
        breaker.failures = 0;
      }
      const message = timedOut ? MESSAGES.timeout : `Claude war nicht erreichbar (${e instanceof Error ? e.message : String(e)}).`.slice(0, 300);
      return { ok: false, status: timedOut ? "timeout" : "fehler", message, callId: log(timedOut ? "timeout" : "fehler", { durationMs: Date.now() - started, error: message }) };
    } finally {
      clearTimeout(timer);
    }
  })();
  inflight.set(fp, call as Promise<Outcome<unknown>>);
  try {
    return await call;
  } finally {
    inflight.delete(fp);
  }
}

/** For callers that want the old behaviour: data, null on a refusal, an Error for everything else. */
export function unwrap<T>(r: Outcome<T>): T | null {
  if (r.ok) return r.data;
  if (r.status === "abgelehnt") return null;
  throw new Error(r.message);
}
