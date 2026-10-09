/**
 * KI-Qualitätstest (Mehr › KI-Kosten, nur Administration): the 20 lessons of qualitaetstest-faelle.ts,
 * then the same lessons with other settings for speed and model. Every case runs through the same
 * functions and checks as in the app (builder plan with one more round for what was rejected,
 * Leseverständnis, Textkorrektur with the server's placing of quotes). Only a measurement: nothing is
 * saved but the cost rows (which count for the budget); every task, question and correction goes to the
 * server log as `[KI-Qualitaetstest] …` lines, without the key and without any name. The run stops
 * before it could cost more than 1 €.
 */
import { categoriesFor } from "../curriculum";
import { klassenLabel, schulstufe } from "../school";
import type { TaskDraft } from "../tasks";
import { anchorFindings } from "../text-correction-core";
import { levelFor } from "../text-correction-rules";
import type { TextDoc } from "../text-doc";
import { wortartenFor } from "../wortarten";
import { FUNCTIONS, budget, priceFor, routeFor, type AIFunction, type Usage } from "./config";
import { generatePlanWithAI, generateWithAI } from "./features";
import { generateReadingQuestions, generateReadingText, questionPlan } from "./lesen";
import { callsOf, lastCallId, spentSince } from "./log";
import { ALL_CASES, type ExerciseCase, type NachschubCase, type QCase, type QGroup, type ReadingCase, type TextCase } from "./qualitaetstest-faelle";
import { withAIOverride, type AIMeta } from "./router";
import { correctTextWithAI } from "./textkorrektur";

export const LOG_PREFIX = "[KI-Qualitaetstest]";
const TRIGGER = "qualitaet";
/** one log line at most this long; longer ones are split into numbered parts */
const MAX_LINE = 3_000;

export type CallInfo = { id: number; fn: string; model: string; ms: number; input: number; output: number; reasoning: number | null; usd: number; status: string; error: string };

export type CaseResult = {
  nr: string;
  group: QGroup;
  title: string;
  variant: string;
  level: string;
  status: "fertig" | "übersprungen" | "fehler";
  /** one line for the page: what came back and what the app's checks said */
  summary: string;
  /** wall-clock time of the whole case (requests made at the same time count once) */
  ms: number;
  usd: number;
  models: string[];
  calls: CallInfo[];
  /** readable lines for the page */
  lines: string[];
};

export type RunState = {
  running: boolean;
  startedAt: number;
  finishedAt: number | null;
  total: number;
  capUsd: number;
  results: CaseResult[];
  /** cases started and not finished yet */
  active: string[];
};

const shared = globalThis as unknown as { __aiQualityTest?: RunState | null };

export function qualityState(): RunState | null {
  return shared.__aiQualityTest ?? null;
}

const oneLine = (s: string, max = 400) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** Splits a long line where no space is cut (log viewers may trim spaces at the ends). */
export function logLines(head: string, payload: unknown): string[] {
  const s = JSON.stringify(payload);
  if (s.length <= MAX_LINE) return [`${LOG_PREFIX} ${head} ${s}`];
  const parts: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = Math.min(s.length, i + MAX_LINE);
    while (j < s.length && j > i + MAX_LINE / 2 && (/\s/.test(s[j - 1]) || /\s/.test(s[j]))) j--;
    parts.push(s.slice(i, j));
    i = j;
  }
  return parts.map((p, k) => `${LOG_PREFIX} ${head} [${k + 1}/${parts.length}] ${p}`);
}

// ---------- what a case may cost at most (the run never starts a case it could not pay) ----------

function worst(fn: AIFunction, maxOut: number, input: number, model?: string) {
  const { price } = priceFor(model || routeFor(fn).model, FUNCTIONS[fn].tier);
  return (input * price.in * 1.25 + Math.min(maxOut, FUNCTIONS[fn].maxTokens) * price.out) / 1_000_000;
}

export function reserveFor(c: QCase): number {
  const model = c.override?.model;
  if (c.kind === "aufgaben") {
    const n = c.plan.length;
    return c.split ? n * worst("aufgaben", 8_500, 6_000, model) : (c.rounds ?? 2) * worst("aufgaben", 6_000 + n * 2_500, 7_000, model);
  }
  if (c.kind === "nachschub") return worst("neue_aufgabe", 11_000, 6_000, model);
  if (c.kind === "lesen") {
    const chars = c.words * 7;
    return worst("lesen", Math.min(24_000, 4_000 + c.words * 6), 1_000, model) + 2 * worst("lesen", 3_000 + c.aspects.length * 900 + Math.round(chars / 3), 2_500 + Math.round(chars / 3), model);
  }
  const words = c.blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0);
  return worst("textkorrektur", 16_000, 2_500 + words * 2, model);
}

// ---------- the cases ----------

type Ctx = { meta: AIMeta; trigger: string; reasoning: Map<number, number> };

/** A task in a few lines: what the student sees, the solution, what the app flagged. */
function taskLines(t: TaskDraft, i: number): string[] {
  const d = t.data;
  const a = t.answer as Record<string, unknown>;
  const shown = [t.prompt, d.start, d.faulty ? `Text: ${d.faulty}` : "", ...(d.parts ?? []).map((p) => `${p.label} ${p.prompt}`), d.options ? `Antworten: ${d.options.map((o, k) => `${k}) ${o}`).join(" · ")}` : "", d.steps ? `Schritte: ${d.steps.join(" | ")}` : ""];
  const solution = [
    Array.isArray(a.accepted) && a.accepted.length ? `akzeptiert: ${(a.accepted as string[]).join(" | ")}` : "",
    Array.isArray(a.blanks) ? `Lücken: ${(a.blanks as string[][]).map((b) => b.join("/")).join(" · ")}` : "",
    typeof a.correct === "number" ? `richtig: ${a.correct}` : "",
    typeof a.sample === "string" && a.sample ? `Muster: ${a.sample}` : "",
    Array.isArray(a.parts) ? `Teile: ${(a.parts as { accepted?: string[]; sample?: string }[]).map((p) => p.accepted?.join("/") || p.sample || "").join(" · ")}` : "",
    t.solution ? `Weg: ${t.solution}` : "",
  ].filter(Boolean);
  return [
    `${i + 1}. [${t.category ?? ""}/${t.type}] ${oneLine(shown.filter(Boolean).join(" "), 600)}`,
    `   Lösung: ${oneLine(solution.join(" · "), 500)}`,
    ...(t.hints.length ? [`   Hilfen: ${oneLine(t.hints.join(" | "), 300)}`] : []),
    ...(t.data.pruefen?.length ? [`   Bitte prüfen: ${t.data.pruefen.join("; ")}`] : []),
  ];
}

/** A task as it goes to the log: everything but the reading text (logged once per case). */
const taskForLog = (t: TaskDraft) => ({ ...t, data: { ...t.data, passage: t.data.passage ? `(${t.data.passage.length} Zeichen)` : undefined } });

async function runExercise(c: ExerciseCase, x: Ctx, log: (l: string) => void) {
  const grade = schulstufe(c.schoolType, c.klasse);
  const all = categoriesFor(c.subject);
  const plan = c.plan.map((category, i) => ({ skillId: c.skills[i % c.skills.length].id, category }));
  const base = {
    subject: c.subject,
    level: klassenLabel(c.schoolType, c.klasse),
    skills: c.skills,
    categories: all.filter((k) => c.plan.includes(k.key)),
    studentContext: c.studentContext ?? null,
    focusNote: c.focusNote,
    wortarten: wortartenFor(c.skills.map((s) => s.id), grade),
  };
  const slots: (TaskDraft | null)[] = plan.map(() => null);
  const rejected: string[] = [];
  let failures = 0;
  if (c.split) {
    // one request per task, all at once
    await Promise.all(
      plan.map(async (p, i) => {
        const why: string[] = [];
        const got = await generatePlanWithAI({ ...base, count: 1, plan: [p] }, { ...x.meta, trigger: x.trigger }, why);
        if (!got) failures++;
        slots[i] = got?.[0] ?? null;
        rejected.push(...why.map((r) => `Aufgabe ${i + 1}: ${r}`));
      }),
    );
  } else {
    // like the builder: what does not come back in its type is asked for once more
    for (let round = 0; round < (c.rounds ?? 2); round++) {
      const open = plan.map((_, i) => i).filter((i) => !slots[i]);
      if (!open.length) break;
      const why: string[] = [];
      const got = await generatePlanWithAI(
        { ...base, count: open.length, plan: open.map((i) => plan[i]), avoid: slots.filter((t): t is TaskDraft => Boolean(t)).map((t) => t.prompt) },
        { ...x.meta, trigger: x.trigger },
        why,
      );
      rejected.push(...why.map((r) => `Runde ${round + 1}: ${r}`));
      if (!got) {
        failures++;
        break;
      }
      got.forEach((t, k) => {
        if (t) slots[open[k]] = t;
      });
    }
  }
  const tasks = slots.filter((t): t is TaskDraft => Boolean(t));
  const missing = slots.filter((t) => !t).length;
  const flagged = tasks.filter((t) => t.data.pruefen?.length).length;
  slots.forEach((t, i) => {
    if (t) for (const l of logLines(`${c.nr} aufgabe-${i + 1}`, { plan: plan[i], task: taskForLog(t) })) log(l);
  });
  if (rejected.length) for (const l of logLines(`${c.nr} verworfen`, rejected)) log(l);
  return {
    summary: `${tasks.length}/${plan.length} Aufgaben von der KI angenommen${missing ? `, ${missing} fehlen (in der App ergänzt der Generator)` : ""}${rejected.length ? `, ${rejected.filter((r) => !/geliefert\.$/.test(r)).length} verworfen` : ""}${flagged ? `, ${flagged} mit „Bitte prüfen“` : ""}${failures ? `, ${failures} Anfrage(n) ohne Antwort` : ""}`,
    lines: [...tasks.flatMap((t, i) => taskLines(t, i)), ...rejected.map((r) => `Verworfen: ${oneLine(r, 500)}`)],
    ok: tasks.length > 0,
  };
}

async function runNachschub(c: NachschubCase, x: Ctx, log: (l: string) => void) {
  const grade = schulstufe(c.schoolType, c.klasse);
  const got = await generateWithAI(
    {
      subject: c.subject,
      level: klassenLabel(c.schoolType, c.klasse),
      skills: [c.skill],
      count: 2,
      categories: [],
      studentContext: c.studentContext ?? null,
      focusNote: c.focusNote,
      wortarten: wortartenFor([c.skill.id], grade),
    },
    { ...x.meta, trigger: x.trigger },
    "neue_aufgabe",
  );
  const tasks = got ?? [];
  // the unit sends only tasks without „Bitte prüfen“
  const sendable = tasks.filter((t) => !t.data.pruefen?.length);
  tasks.forEach((t, i) => {
    for (const l of logLines(`${c.nr} aufgabe-${i + 1}`, { task: taskForLog(t) })) log(l);
  });
  return { summary: got ? `${tasks.length} Aufgaben, ${sendable.length} davon direkt sendbar` : "keine Antwort (in der App: Generator)", lines: tasks.flatMap((t, i) => taskLines(t, i)), ok: sendable.length > 0 };
}

async function runReading(c: ReadingCase, x: Ctx, log: (l: string) => void) {
  const level = klassenLabel(c.schoolType, c.klasse);
  const text = await generateReadingText(
    { subject: c.subject, level, schulstufe: schulstufe(c.schoolType, c.klasse), topic: c.topic, textType: c.textType, difficulty: c.difficulty, words: c.words },
    { ...x.meta, trigger: x.trigger },
  );
  if ("error" in text) return { summary: `kein Text: ${text.error}`, lines: [], ok: false };
  const paragraphs = text.text.split(/\n\s*\n/);
  const words = text.text.split(/\s+/).filter(Boolean).length;
  for (const [i, p] of paragraphs.entries()) for (const l of logLines(`${c.nr} text-${i + 1}`, i === 0 ? { title: text.title, words, p } : { p })) log(l);
  const plan = questionPlan(c.aspects, { cloze: c.cloze, mc: c.mc });
  const qs = await generateReadingQuestions({ subject: c.subject, level, title: text.title, text: text.text, difficulty: c.difficulty, plan }, { ...x.meta, trigger: x.trigger });
  if ("error" in qs) return { summary: `Text mit ${words} Wörtern, keine Fragen: ${qs.error}`, lines: [`Text „${text.title}“ (${words} Wörter)`], ok: false };
  qs.tasks.forEach((t, i) => {
    for (const l of logLines(`${c.nr} frage-${i + 1}`, { task: taskForLog(t) })) log(l);
  });
  const evidence = qs.tasks.filter((t) => ((t.answer as { evidence?: unknown[] }).evidence ?? []).length).length;
  return {
    summary: `Text „${oneLine(text.title, 60)}“ mit ${words} Wörtern (verlangt ${c.words}), ${qs.tasks.length}/${plan.length} Fragen, ${qs.dropped} doppelte verworfen, ${evidence} mit Textbeleg`,
    lines: [`Text „${text.title}“ (${words} Wörter)`, ...paragraphs.map((p, i) => `[${i + 1}] ${oneLine(p, 2_000)}`), ...qs.tasks.flatMap((t, i) => taskLines(t, i))],
    ok: qs.tasks.length > 0,
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** `wrong` as a whole word (or phrase) in the quote, so „halt“ is not found in „Inhalt“ */
const quotes = (quote: string, wrong: string) => new RegExp(`(^|[^\\p{L}])${escapeRe(wrong)}($|[^\\p{L}])`, "u").test(quote);

async function runText(c: TextCase, x: Ctx, log: (l: string) => void) {
  const level = levelFor(c.schoolType, c.klasse);
  const out = await correctTextWithAI({ subject: c.subject, kind: c.textKind, task: c.task, level, blocks: c.blocks, skills: [], pictures: c.pictures ?? null }, { ...x.meta, trigger: x.trigger });
  if (!out.ok) return { summary: `keine Korrektur: ${out.message}`, lines: [], ok: false };
  const ai = out.data;
  // placed by the server as in the app: quotes not found become notes, broken entries are dropped
  const doc: TextDoc = c.blocks.map((b) => ({ t: b.heading ? "h" : "p", r: [{ x: b.text }] }));
  const anchored = anchorFindings(doc, ai, { pattern: null, level, skills: new Set() });
  const marks = anchored.items.filter((i) => i.kind !== "hinweis");
  const unplaced = marks.filter((i) => i.pos_start === null).length;
  const known = c.known.map((k) => {
    const f = ai.findings.find((f) => quotes(f.quote, k.wrong) && k.right.some((r) => f.replacement.includes(r)));
    return { ...k, found: Boolean(f), by: f ? `„${f.quote}“ → „${f.replacement}“` : "" };
  });
  const traps = c.traps.map((t) => {
    const f = ai.findings.find((f) => f.quote.includes(t) && !f.replacement.includes(t));
    return { trap: t, flagged: Boolean(f), by: f ? `„${f.quote}“ → „${f.replacement}“ (${f.kind})` : "" };
  });
  ai.findings.forEach((f, i) => {
    for (const l of logLines(`${c.nr} markierung-${i + 1}`, f)) log(l);
  });
  for (const l of logLines(`${c.nr} rueckmeldung`, { hints: ai.hints, strengths: ai.strengths, main_issue: ai.main_issue, recommendation: ai.recommendation, placed: marks.length - unplaced, unplaced, dropped: anchored.dropped })) log(l);
  for (const l of logLines(`${c.nr} abgleich`, { known: known.map((k) => ({ what: k.what, found: k.found, by: k.by })), traps: traps.filter((t) => t.flagged) })) log(l);
  const found = known.filter((k) => k.found).length;
  const flagged = traps.filter((t) => t.flagged).length;
  const errors = ai.findings.filter((f) => f.kind !== "stil").length;
  return {
    summary: `${found}/${known.length} eingebaute Fehler gefunden, ${flagged} richtige Stellen als falsch markiert, ${ai.findings.length} Markierungen (${errors} Fehler, ${ai.findings.length - errors} Stil), ${unplaced} ohne Stelle, ${anchored.dropped} verworfen`,
    lines: [
      ...ai.findings.map((f) => `„${f.quote}“ → „${f.replacement}“ (${f.category}, ${f.kind}): ${oneLine(f.explanation, 200)}`),
      ...ai.hints.map((h) => `Hinweis (${h.category}): ${oneLine(h.text, 300)}`),
      ...known.filter((k) => !k.found).map((k) => `Nicht gefunden: ${k.what}`),
      ...traps.filter((t) => t.flagged).map((t) => `Richtig, aber markiert: ${t.trap} – ${t.by}`),
    ],
    ok: true,
  };
}

async function runCase(c: QCase, meta: AIMeta, log: (l: string) => void, runTag: string): Promise<CaseResult> {
  const trigger = `${TRIGGER}-${c.nr}`;
  const before = lastCallId();
  const reasoning = new Map<number, number>();
  const x: Ctx = { meta, trigger, reasoning };
  const started = Date.now();
  const level = klassenLabel(c.schoolType, c.klasse);
  let out: { summary: string; lines: string[]; ok: boolean };
  const go = () => (c.kind === "aufgaben" ? runExercise(c, x, log) : c.kind === "nachschub" ? runNachschub(c, x, log) : c.kind === "lesen" ? runReading(c, x, log) : runText(c, x, log));
  try {
    out = await withAIOverride({ tag: `${runTag}-${c.nr}`, ...c.override, onUsage: (id: number, u: Usage) => (u.reasoning != null ? void reasoning.set(id, u.reasoning) : undefined) }, go);
  } catch (e) {
    out = { summary: `Fehler: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), lines: [], ok: false };
  }
  const ms = Date.now() - started;
  const calls: CallInfo[] = callsOf(trigger, before).map((r) => ({
    id: r.id,
    fn: r.fn,
    model: r.model,
    ms: r.duration_ms,
    input: r.input_tokens,
    output: r.output_tokens,
    reasoning: reasoning.get(r.id) ?? null,
    usd: r.cost_usd,
    status: r.status,
    error: r.error,
  }));
  const result: CaseResult = {
    nr: c.nr,
    group: c.group,
    title: c.title,
    variant: c.variant ?? "",
    level,
    status: out.ok ? "fertig" : "fehler",
    summary: out.summary,
    ms,
    usd: calls.reduce((s, k) => s + k.usd, 0),
    models: [...new Set(calls.map((k) => k.model).filter(Boolean))],
    calls,
    lines: out.lines,
  };
  for (const l of logLines(`${c.nr} ergebnis`, { ...result, lines: undefined })) log(l);
  return result;
}

/**
 * Runs the cases, a few at a time. Before a case starts, what was spent plus what the running cases and
 * this one could cost at most must stay under the cap; otherwise the case is skipped and reported.
 */
export async function runQualityTest(o: { meta?: AIMeta; cases?: QCase[]; concurrency?: number; capUsd?: number; log?: (line: string) => void } = {}): Promise<RunState> {
  const cases = o.cases ?? ALL_CASES;
  const log = o.log ?? ((l: string) => console.info(l));
  const capUsd = o.capUsd ?? budget().usdPerEur * 1;
  const runTag = `qt${Date.now().toString(36)}`;
  const startId = lastCallId();
  const state: RunState = { running: true, startedAt: Date.now(), finishedAt: null, total: cases.length, capUsd, results: [], active: [] };
  shared.__aiQualityTest = state;
  const reserved = new Map<string, number>();
  log(`${LOG_PREFIX} start ${JSON.stringify({ run: runTag, cases: cases.length, capUsd, models: { aufgaben: routeFor("aufgaben").model, lesen: routeFor("lesen").model, textkorrektur: routeFor("textkorrektur").model } })}`);
  const order = new Map(cases.map((c, i) => [c.nr, i]));
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const c = cases[next++];
      const need = reserveFor(c);
      const spent = spentSince(`${TRIGGER}-`, startId);
      const inFlight = [...reserved.values()].reduce((s, v) => s + v, 0);
      let r: CaseResult;
      if (spent + inFlight + need > capUsd) {
        r = { nr: c.nr, group: c.group, title: c.title, variant: c.variant ?? "", level: klassenLabel(c.schoolType, c.klasse), status: "übersprungen", summary: `übersprungen: bisher ${spent.toFixed(3)} $, dieser Test könnte bis ${need.toFixed(3)} $ kosten, Grenze ${capUsd.toFixed(2)} $`, ms: 0, usd: 0, models: [], calls: [], lines: [] };
        log(`${LOG_PREFIX} ${c.nr} ergebnis ${JSON.stringify(r)}`);
      } else {
        reserved.set(c.nr, need);
        state.active.push(c.nr);
        r = await runCase(c, o.meta ?? {}, log, runTag);
        reserved.delete(c.nr);
        state.active = state.active.filter((n) => n !== c.nr);
      }
      state.results.push(r);
      state.results.sort((a, b) => (order.get(a.nr) ?? 0) - (order.get(b.nr) ?? 0));
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 4) }, worker));
  } finally {
    state.running = false;
    state.finishedAt = Date.now();
    const done = state.results.filter((r) => r.status !== "übersprungen");
    log(
      `${LOG_PREFIX} ende ${JSON.stringify({ run: runTag, usd: spentSince(`${TRIGGER}-`, startId), cases: done.length, skipped: state.results.length - done.length, minutes: Math.round((state.finishedAt - state.startedAt) / 6_000) / 10 })}`,
    );
  }
  return state;
}

/** Starts a run in the background (the page asks for the state); false when one is running. */
export function startQualityTest(meta: AIMeta): boolean {
  if (shared.__aiQualityTest?.running) return false;
  void runQualityTest({ meta }).catch((e) => console.error(`${LOG_PREFIX} abgebrochen: ${e instanceof Error ? e.message : String(e)}`));
  return true;
}
