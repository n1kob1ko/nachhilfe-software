/**
 * Textkorrektur-Test (Mehr › KI-Kosten, nur Administration): the synthetic texts of
 * textkorrektur-test-faelle.ts with built-in errors, correct places that look wrong, and an
 * independently checked answer key. Every text runs twice with real requests: the one-step
 * correction as it is today, and „gründlich“. From the same answers the test also derives the one-step
 * correction with the program's marks, with the program's rules, and step 1 of „gründlich“ alone, so
 * five ways of correcting are compared at the cost of two.
 *
 * Measured per way: errors found and correctly fixed, fixes that are themselves wrong, correct places
 * changed, further marks (for checking by hand), what is marked for the teacher, what the second check
 * sorted out, cost and time. Every suggestion goes to the server log as `[KI-Textkorrektur-Test] …`
 * with its explanation, so explanations can be checked by hand. Nothing is saved but the cost rows.
 * The run stops before it could cost more than 2 €.
 */
import { applyChanges, comparable, flagItems, ruleItems } from "../text-correction-checks";
import { anchorFindings, type NewItem } from "../text-correction-core";
import { levelFor } from "../text-correction-rules";
import type { TextDoc } from "../text-doc";
import { FUNCTIONS, budget, priceFor, routeFor, type AIFunction, type Usage } from "./config";
import { callsOf, lastCallId, spentSince } from "./log";
import { withAIOverride } from "./router";
import { correctTextWithAI, type CorrectionRequest } from "./textkorrektur";
import { correctThoroughly } from "./textkorrektur-gruendlich";
import { TEXT_CASES, type KorrekturFall } from "./textkorrektur-test-faelle";
import { WAYS, type CaseRun, type Score, type TextTestState, type WayKey, type WayResult } from "./textkorrektur-test-types";

export { WAYS, type CaseRun, type Score, type TextTestState, type WayKey, type WayResult };

export const LOG_PREFIX = "[KI-Textkorrektur-Test]";
const TRIGGER = "textkorrektur-test";
const MAX_LINE = 3_000;

// ---------- comparing suggestions with the answer key ----------

export type EvalItem = Pick<NewItem, "block" | "pos_start" | "pos_end" | "quote" | "replacement" | "kind" | "category" | "review" | "review_note" | "origin" | "explanation">;


export type ItemVerdict = { item: EvalItem; match: string; verdict: "richtig" | "falsch" | "falle" | "zusatz" | "neutral" | "ohne Stelle" };

const span = (text: string, part: string) => {
  const at = text.indexOf(part);
  return at < 0 ? null : { start: at, end: at + part.length };
};
const hit = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
const placedIn = (i: EvalItem, b: number) => i.block === b && i.pos_start !== null && i.pos_end !== null;

/** Every suggestion against the key: which error it fixes (rightly or wrongly), which correct place it changes, or none. */
export function evaluate(c: KorrekturFall, items: EvalItem[]): { score: Score; verdicts: ItemVerdict[]; errors: { what: string; status: "richtig" | "falsch" | "verpasst"; optional: boolean; by: string }[] } {
  const shown = items.filter((i) => i.kind !== "hinweis" && i.review !== "verworfen");
  const out = items.filter((i) => i.kind !== "hinweis" && i.review === "verworfen");
  const errs = c.errors.map((e) => ({ ...e, at: span(c.blocks[e.para - 1].text, e.wrong)! }));
  const verdict = new Map<EvalItem, ItemVerdict>();
  /** the paragraph after these suggestions equals the key's correction of the errors they touch */
  const rightFix = (b: number, these: EvalItem[], e: (typeof errs)[number]) => {
    const text = c.blocks[b].text;
    const got = applyChanges(text, these.map((i) => ({ start: i.pos_start!, end: i.pos_end!, replacement: i.replacement }))).text;
    const touched = errs.filter((x) => x !== e && x.para === e.para && these.some((i) => hit(x.at, { start: i.pos_start!, end: i.pos_end! })));
    return e.right.some((r) => {
      const want = applyChanges(text, [{ ...e.at, replacement: r }, ...touched.map((x) => ({ ...x.at, replacement: x.right[0] }))]).text;
      return comparable(got) === comparable(want);
    });
  };
  const judge = (list: EvalItem[]) => {
    const res = errs.map((e) => {
      const b = e.para - 1;
      const these = list.filter((i) => placedIn(i, b) && hit(e.at, { start: i.pos_start!, end: i.pos_end! }));
      if (!these.length) return { e, these, status: "verpasst" as const };
      return { e, these, status: rightFix(b, these, e) ? ("richtig" as const) : ("falsch" as const) };
    });
    return res;
  };
  const res = judge(shown);
  for (const r of res) for (const i of r.these) verdict.set(i, { item: i, match: `Fehler „${r.e.wrong}“`, verdict: r.status === "richtig" ? "richtig" : "falsch" });
  const inZone = (i: EvalItem, zones: { para: number; text: string }[]) =>
    zones.some((z) => placedIn(i, z.para - 1) && (() => {
      const s = span(c.blocks[z.para - 1].text, z.text);
      return s ? hit(s, { start: i.pos_start!, end: i.pos_end! }) : false;
    })());
  for (const i of [...shown, ...out]) {
    if (verdict.has(i)) continue;
    if (i.pos_start === null) verdict.set(i, { item: i, match: "", verdict: "ohne Stelle" });
    else if (inZone(i, c.correct)) verdict.set(i, { item: i, match: `richtige Stelle „${c.correct.find((z) => inZone(i, [z]))!.text}“`, verdict: "falle" });
    else if (inZone(i, c.neutral ?? [])) verdict.set(i, { item: i, match: "vertretbare Stelle", verdict: "neutral" });
    else if (out.includes(i)) {
      // a sorted-out one at an error: was its fix right?
      const e = errs.find((x) => placedIn(i, x.para - 1) && hit(x.at, { start: i.pos_start!, end: i.pos_end! }));
      verdict.set(i, e ? { item: i, match: `Fehler „${e.wrong}“`, verdict: rightFix(e.para - 1, [i], e) ? "richtig" : "falsch" } : { item: i, match: "", verdict: "zusatz" });
    } else verdict.set(i, { item: i, match: "", verdict: "zusatz" });
  }
  const v = (i: EvalItem) => verdict.get(i)!.verdict;
  const doubtful = (i: EvalItem) => ["falsch", "falle", "zusatz"].includes(v(i)) && !(v(i) === "zusatz" && i.kind === "stil");
  const counted = res.filter((r) => !r.e.optional);
  const score: Score = {
    errors: counted.length,
    found: counted.filter((r) => r.status !== "verpasst").length,
    fixed: counted.filter((r) => r.status === "richtig").length,
    wrongFix: counted.filter((r) => r.status === "falsch").length,
    missed: counted.filter((r) => r.status === "verpasst").length,
    traps: shown.filter((i) => v(i) === "falle").length,
    extraFehler: shown.filter((i) => v(i) === "zusatz" && i.kind !== "stil").length,
    extraStil: shown.filter((i) => v(i) === "zusatz" && i.kind === "stil").length,
    unplaced: shown.filter((i) => v(i) === "ohne Stelle").length,
    flaggedFixed: shown.filter((i) => v(i) === "richtig" && i.review === "lehrer").length,
    flaggedDoubtful: shown.filter((i) => doubtful(i) && i.review === "lehrer").length,
    unflaggedDoubtful: shown.filter((i) => doubtful(i) && i.review !== "lehrer").length,
    sortedOutFixed: out.filter((i) => v(i) === "richtig").length,
    sortedOutDoubtful: out.filter((i) => v(i) !== "richtig").length,
  };
  const by = (r: (typeof res)[number]) => r.these.map((i) => `„${i.quote}“ → „${i.replacement}“`).join(" + ");
  return { score, verdicts: [...verdict.values()], errors: res.map((r) => ({ what: r.e.what || r.e.wrong, status: r.status, optional: Boolean(r.e.optional), by: by(r) })) };
}

export function addScores(a: Score, b: Score): Score {
  return Object.fromEntries(Object.keys(a).map((k) => [k, a[k as keyof Score] + b[k as keyof Score]])) as Score;
}
export const emptyScore = (): Score => ({ errors: 0, found: 0, fixed: 0, wrongFix: 0, missed: 0, traps: 0, extraFehler: 0, extraStil: 0, unplaced: 0, flaggedFixed: 0, flaggedDoubtful: 0, unflaggedDoubtful: 0, sortedOutFixed: 0, sortedOutDoubtful: 0 });

// ---------- running ----------


const shared = globalThis as unknown as { __aiTextTest?: TextTestState | null };
export const textTestState = (): TextTestState | null => shared.__aiTextTest ?? null;

function logLines(head: string, payload: unknown): string[] {
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

const words = (c: KorrekturFall) => c.blocks.reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);

function worst(fn: AIFunction, maxOut: number, input: number) {
  const { price } = priceFor(routeFor(fn).model, FUNCTIONS[fn].tier);
  return (input * price.in * 1.25 + Math.min(maxOut, FUNCTIONS[fn].maxTokens) * price.out) / 1_000_000;
}
/** What one text may cost at most: the one-step correction and both requests of „gründlich“. */
export function reserveFor(c: KorrekturFall): number {
  const w = words(c);
  return worst("textkorrektur", 3_000 + w * 10, 2_500 + w * 2) + worst("textanalyse", 4_000 + w * 20, 3_000 + w * 3) + worst("textpruefung", 3_000 + w * 12, 3_000 + w * 6);
}

const short = (s: string, max = 300) => s.replace(/\s+/g, " ").trim().slice(0, max);

async function runCase(c: KorrekturFall, log: (l: string) => void, runTag: string, teacherId: number | null): Promise<CaseRun> {
  const level = levelFor(c.schoolType, c.klasse);
  const req: CorrectionRequest = { subject: c.subject, kind: c.textKind, task: c.task, level, blocks: c.blocks, skills: [], pictures: null };
  const doc: TextDoc = c.blocks.map((b) => ({ t: b.heading ? "h" : "p", r: [{ x: b.text }] }));
  const texts = c.blocks.map((b) => b.text);
  const english = /englisch|english/i.test(c.subject);
  const reasoning = new Map<number, number>();
  const onUsage = (id: number, u: Usage) => (u.reasoning != null ? void reasoning.set(id, u.reasoning) : undefined);
  const lines: string[] = [];
  // only: the requests of a way when it is a part of a run („nur Schritt 1“ is the analysis alone)
  const ways: { way: WayKey; items: EvalItem[]; trigger: string; only?: string }[] = [];
  const timing = new Map<string, number>();
  const anchorOpts = { pattern: null, level, skills: new Set<string>() };

  // the one-step correction, as in the app until now
  const t1 = `${TRIGGER}-${c.nr}-einfach`;
  const before1 = lastCallId();
  let started = Date.now();
  const one = await withAIOverride({ tag: `${runTag}-${c.nr}-e`, onUsage }, () => correctTextWithAI(req, { teacherId, trigger: t1 }));
  timing.set(t1, Date.now() - started);
  if (one.ok) {
    const base = anchorFindings(doc, one.data, anchorOpts).items;
    ways.push({ way: "einfach", items: base, trigger: t1 });
    ways.push({ way: "einfach_marken", items: flagItems(texts, base, { english }), trigger: t1 });
    const rules = ruleItems(c.blocks, base, { english }).map((r): NewItem => ({ ...r, kind: r.kind === "stil" ? "stil" : "fehler", skill_id: null }));
    ways.push({ way: "einfach_regeln", items: flagItems(texts, [...base, ...rules], { english }), trigger: t1 });
  } else lines.push(`Einfach: keine Antwort (${one.message})`);

  // „gründlich“: step 1, rules, step 2
  const t2 = `${TRIGGER}-${c.nr}-gruendlich`;
  started = Date.now();
  const two = await withAIOverride({ tag: `${runTag}-${c.nr}-g`, onUsage }, () => correctThoroughly(req, doc, { ...anchorOpts, taken: new Map(), meta: { teacherId, trigger: t2 } }));
  timing.set(t2, Date.now() - started);
  if (two.ok) {
    ways.push({ way: "schritt1", items: flagItems(texts, two.stages.analyse, { english }), trigger: t2, only: "textanalyse" });
    ways.push({ way: "gruendlich", items: two.items, trigger: t2 });
    if (two.unchecked.length) lines.push(`Gründlich: Sätze ohne Antwort: ${two.unchecked.join(", ")}`);
    if (two.verify === "fehler") lines.push("Gründlich: zweite Prüfung fehlgeschlagen");
  } else lines.push(`Gründlich: keine Antwort (${two.message})`);

  const results: WayResult[] = [];
  for (const w of ways) {
    const calls = callsOf(w.trigger, before1).filter((k) => !w.only || k.fn === w.only);
    const ev = evaluate(c, w.items);
    results.push({
      way: w.way,
      score: ev.score,
      usd: calls.reduce((s, k) => s + k.cost_usd, 0),
      ms: w.only ? calls.reduce((s, k) => s + k.duration_ms, 0) : (timing.get(w.trigger) ?? 0),
      calls: calls.length,
      reasoning: calls.reduce((s, k) => s + (reasoning.get(k.id) ?? 0), 0),
      output: calls.reduce((s, k) => s + k.output_tokens, 0),
    });
    // every suggestion with its explanation and verdict, for checking by hand
    for (const [k, v] of ev.verdicts.entries())
      for (const l of logLines(`${c.nr} ${w.way} v${k + 1}`, {
        q: v.item.quote,
        r: v.item.replacement,
        para: v.item.block === null ? null : v.item.block + 1,
        cat: v.item.category,
        kind: v.item.kind,
        expl: v.item.explanation,
        origin: v.item.origin,
        review: v.item.review,
        note: v.item.review_note,
        verdict: v.verdict,
        match: v.match,
      }))
        log(l);
    for (const l of logLines(`${c.nr} ${w.way} fehler`, ev.errors)) log(l);
    const s = ev.score;
    lines.push(
      `${WAYS.find((x) => x.key === w.way)!.label}: ${s.fixed}/${s.errors} richtig korrigiert, ${s.wrongFix} falsch korrigiert, ${s.missed} verpasst, ${s.traps} richtige Stellen geändert, ${s.extraFehler + s.extraStil} weitere (${s.extraStil} Stil); markiert: ${s.flaggedDoubtful} zweifelhafte, ${s.flaggedFixed} richtige; aussortiert: ${s.sortedOutDoubtful} zweifelhafte, ${s.sortedOutFixed} richtige`,
    );
    for (const v of ev.verdicts.filter((x) => x.verdict !== "richtig" && x.verdict !== "neutral" && x.item.review !== "verworfen"))
      lines.push(`   ${v.verdict}: „${short(v.item.quote, 80)}“ → „${short(v.item.replacement, 80)}“ (${v.item.kind}${v.item.review === "lehrer" ? ", markiert" : ""}) ${short(v.item.explanation, 160)}`);
  }
  const best = results.find((r) => r.way === "gruendlich") ?? results[0];
  return {
    nr: c.nr,
    title: c.title,
    level: level.label,
    status: one.ok && two.ok ? "fertig" : "fehler",
    summary: best ? `${best.score.errors} eingebaute Fehler, ${c.correct.length} richtige Stellen als Falle` : "keine Antwort",
    ways: results,
    lines,
  };
}

/** Runs the texts, a few at a time; a text that could push the spending over the cap is skipped and reported. */
export async function runTextTest(o: { teacherId?: number | null; cases?: KorrekturFall[]; concurrency?: number; capUsd?: number; log?: (line: string) => void } = {}): Promise<TextTestState> {
  const cases = o.cases ?? TEXT_CASES;
  const log = o.log ?? ((l: string) => console.info(l));
  const capUsd = o.capUsd ?? budget().usdPerEur * 2;
  const runTag = `kt${Date.now().toString(36)}`;
  const startId = lastCallId();
  const state: TextTestState = { running: true, startedAt: Date.now(), finishedAt: null, total: cases.length, capUsd, results: [], active: [], totals: null };
  shared.__aiTextTest = state;
  const reserved = new Map<string, number>();
  log(`${LOG_PREFIX} start ${JSON.stringify({ run: runTag, cases: cases.length, capUsd, models: { textkorrektur: routeFor("textkorrektur").model, textanalyse: routeFor("textanalyse").model, textpruefung: routeFor("textpruefung").model }, effort: { textkorrektur: FUNCTIONS.textkorrektur.effort, textanalyse: FUNCTIONS.textanalyse.effort, textpruefung: FUNCTIONS.textpruefung.effort } })}`);
  const order = new Map(cases.map((c, i) => [c.nr, i]));
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const c = cases[next++];
      const need = reserveFor(c);
      const spent = spentSince(`${TRIGGER}-`, startId);
      const inFlight = [...reserved.values()].reduce((s, v) => s + v, 0);
      let r: CaseRun;
      if (spent + inFlight + need > capUsd) {
        r = { nr: c.nr, title: c.title, level: levelFor(c.schoolType, c.klasse).label, status: "übersprungen", summary: `übersprungen: bisher ${spent.toFixed(3)} $, dieser Text könnte bis ${need.toFixed(3)} $ kosten, Grenze ${capUsd.toFixed(2)} $`, ways: [], lines: [] };
      } else {
        reserved.set(c.nr, need);
        state.active.push(c.nr);
        try {
          r = await runCase(c, log, runTag, o.teacherId ?? null);
        } catch (e) {
          r = { nr: c.nr, title: c.title, level: "", status: "fehler", summary: `Fehler: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), ways: [], lines: [] };
        }
        reserved.delete(c.nr);
        state.active = state.active.filter((n) => n !== c.nr);
      }
      for (const l of logLines(`${c.nr} ergebnis`, { ...r, lines: undefined })) log(l);
      state.results.push(r);
      state.results.sort((a, b) => (order.get(a.nr) ?? 0) - (order.get(b.nr) ?? 0));
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 3) }, worker));
  } finally {
    state.running = false;
    state.finishedAt = Date.now();
    state.totals = totalsOf(state.results);
    log(`${LOG_PREFIX} summe ${JSON.stringify(state.totals)}`);
    log(`${LOG_PREFIX} ende ${JSON.stringify({ run: runTag, usd: spentSince(`${TRIGGER}-`, startId), cases: state.results.filter((r) => r.status === "fertig").length, minutes: Math.round((state.finishedAt - state.startedAt) / 6_000) / 10 })}`);
  }
  return state;
}

/** Sums per way over the texts where every way ran (so the ways are compared on the same texts). */
export function totalsOf(results: CaseRun[]): Record<WayKey, WayResult> {
  const complete = results.filter((r) => r.ways.length === WAYS.length);
  return Object.fromEntries(
    WAYS.map((w) => {
      const rs = complete.map((r) => r.ways.find((x) => x.way === w.key)!);
      return [w.key, { way: w.key, score: rs.reduce((s, r) => addScores(s, r.score), emptyScore()), usd: rs.reduce((s, r) => s + r.usd, 0), ms: rs.reduce((s, r) => s + r.ms, 0), calls: rs.reduce((s, r) => s + r.calls, 0), reasoning: rs.reduce((s, r) => s + r.reasoning, 0), output: rs.reduce((s, r) => s + r.output, 0) }];
    }),
  ) as Record<WayKey, WayResult>;
}

/** Starts a run in the background (the page asks for the state); false when one is running. */
export function startTextTest(teacherId: number | null): boolean {
  if (shared.__aiTextTest?.running) return false;
  void runTextTest({ teacherId }).catch((e) => console.error(`${LOG_PREFIX} abgebrochen: ${e instanceof Error ? e.message : String(e)}`));
  return true;
}
