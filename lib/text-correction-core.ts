/**
 * The pure part of a Textkorrektur, used by the server and the browser: finding the KI's quotes in a
 * paragraph, hiding names, the three views (marks, Endfassung) and the overview of accepted errors.
 * Storage and the KI run are in lib/text-correction.ts.
 */
import type { AICorrection } from "./ai/textkorrektur";
import { blockText, normalizeRuns, type Block, type Run, type TextDoc } from "./text-doc";
import { categoryInfo, normalizeCategory, TEXT_CATEGORIES, type Level } from "./text-correction-rules";

export type ItemStatus = "offen" | "uebernommen" | "abgelehnt";
export type ItemKind = "fehler" | "stil" | "hinweis";
export type ItemSource = "ki" | "lehrer";
/** Where a KI suggestion came from: '' = the one-step correction, analyse = step 1 of „gründlich“, pruefung = found by the second check, regel = found by the program */
export type ItemOrigin = "" | "analyse" | "pruefung" | "regel";
/** '' = nothing special; lehrer = the teacher must look closely (note says why); verworfen = the second check found it wrong (stored as abgelehnt) */
export type ItemReview = "" | "lehrer" | "verworfen";
export type CorrectionMethod = "einfach" | "gruendlich";
export type AIStatus = "keine" | "laeuft" | "fertig" | "fehler";

export type CorrectionItem = {
  id: number;
  correction_id: number;
  /** index of the block in the snapshot; null = a note on the whole text */
  block: number | null;
  pos_start: number | null;
  pos_end: number | null;
  quote: string;
  replacement: string;
  category: string;
  kind: ItemKind;
  rule: string;
  explanation: string;
  skill_id: string | null;
  status: ItemStatus;
  source: ItemSource;
  origin: ItemOrigin;
  review: ItemReview;
  review_note: string;
  decided_by: number | null;
  decided_at: string | null;
  created_at: string;
};

export type CorrectionRow = {
  id: number;
  text_id: number;
  version: number;
  body: string;
  words: number;
  level: string;
  unit_id: number | null;
  created_by: number | null;
  ai_status: AIStatus;
  ai_error: string | null;
  ai_model: string | null;
  ai_call_id: number | null;
  ai_started_at: string | null;
  ai_consent_by: number | null;
  ai_consent_at: string | null;
  summary: string;
  main_issue: string;
  recommendation: string;
  recommendation_skill: string | null;
  dropped: number;
  method: CorrectionMethod;
  /** sentences („2.3“, comma-separated) the KI did not answer for in a „gründlich“ run */
  unchecked: string;
  /** the second check of a „gründlich“ run: '' = not run, ok, fehler */
  verify_status: "" | "ok" | "fehler";
  shared_at: string | null;
  created_at: string;
  updated_at: string;
};

const MAX_QUOTE_WORDS = 30;
const MAX_HINTS = 4;

// ---------- names: replaced before the text leaves the app ----------

export const NAME_PLACEHOLDER = "[Name]";

/**
 * A placeholder the app never writes („[PERSON_NAME]“ from a privacy filter on the provider's side, e.g.
 * OpenRouter guardrails): the model saw other words than the student wrote, so the suggestion cannot fit.
 */
export const FOREIGN_PLACEHOLDER = /\[[A-Z][A-Z_]{2,}\]/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Name parts of at least 3 letters, as whole words, longest first. */
export function namePattern(names: string[]): RegExp | null {
  const parts = [...new Set(names.flatMap((n) => n.split(/[\s-]+/)).map((p) => p.replace(/[^\p{L}]/gu, "")).filter((p) => p.length >= 3))].sort((a, b) => b.length - a.length);
  if (!parts.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.map(escapeRe).join("|")})(?:s)?(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * The text of a block with names replaced, and for every position of the masked text the position in
 * the original (one more entry for the end), so a quote found in the masked text maps back exactly.
 */
export function maskText(text: string, pattern: RegExp | null): { masked: string; toOrig: number[]; names: string[] } {
  const toOrig: number[] = [];
  const names: string[] = [];
  let masked = "";
  let last = 0;
  const push = (s: string, origAt: (k: number) => number) => {
    for (let k = 0; k < s.length; k++) toOrig.push(origAt(k));
    masked += s;
  };
  if (pattern) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      const at = m.index!;
      push(text.slice(last, at), (k) => last + k);
      push(NAME_PLACEHOLDER, () => at);
      names.push(m[0]);
      last = at + m[0].length;
    }
  }
  push(text.slice(last), (k) => last + k);
  toOrig.push(text.length);
  return { masked, toOrig, names };
}

// ---------- finding a quote in a paragraph ----------

export type Range = { start: number; end: number };
export const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;

/** Typographic quotes and dashes as plain ones, runs of spaces as one: a model may write either. */
function normalized(s: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (/\s/.test(c)) {
      if (text.endsWith(" ")) continue;
      c = " ";
    } else if ("„“”«»‚‘’‹›`´".includes(c)) c = /[„“”«»]/.test(c) ? '"' : "'";
    else if ("–—".includes(c)) c = "-";
    text += c;
    map.push(i);
  }
  map.push(s.length);
  return { text, map };
}

/**
 * Where `quote` is in `hay`: the first occurrence from `from` on that does not overlap a taken range,
 * else the first such occurrence from the start; first exactly, then with normalized quotes and spaces.
 */
export function findQuote(hay: string, quote: string, from: number, taken: Range[]): Range | null {
  if (!quote) return null;
  const letter = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
  const search = (h: string, q: string, map: (i: number) => number): Range | null => {
    const whole: Range[] = [];
    const part: Range[] = [];
    for (let i = h.indexOf(q); i >= 0; i = h.indexOf(q, i + 1)) {
      const r = { start: map(i), end: map(i + q.length) };
      if (taken.some((t) => overlaps(t, r))) continue;
      // „i“ is the English word, not the letter in „time“: whole words first, a part of a word only for longer quotes
      const cut = (letter(q[0]) && letter(h[i - 1])) || (letter(q[q.length - 1]) && letter(h[i + q.length]));
      (cut ? part : whole).push(r);
    }
    const hits = whole.length || q.trim().length < 4 ? whole : part;
    return hits.find((r) => r.start >= from) ?? hits[0] ?? null;
  };
  const exact = search(hay, quote, (i) => i);
  if (exact) return exact;
  const h = normalized(hay);
  const q = normalized(quote.trim()).text;
  return q ? search(h.text, q, (i) => h.map[i]) : null;
}

// ---------- checking what the KI answered ----------

export type NewItem = Omit<CorrectionItem, "id" | "correction_id" | "status" | "source" | "decided_by" | "decided_at" | "created_at">;

export const clip = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const kindOf = (raw: unknown): "fehler" | "stil" => (typeof raw === "string" && /stil|style|vorschlag|optional|empfehl/i.test(raw) ? "stil" : "fehler");
const wordsIn = (s: string) => s.split(/\s+/).filter(Boolean).length;

export type Anchored = { items: NewItem[]; dropped: number };

/** A finding as the KI gave it, with what the „gründlich“ run adds: its sentence (masked positions), origin and review. */
export type InFinding = AICorrection["findings"][number] & { from?: number; to?: number; origin?: ItemOrigin; review?: ItemReview; review_note?: string };

/**
 * Turns the KI's findings into items with exact positions in the snapshot. A finding is dropped when its
 * category is unknown, its paragraph does not exist, it has no explanation, the replacement equals the
 * quote, or there are already too many; a finding whose quote is not in the paragraph becomes a note
 * without a place. `taken` are places already decided (carried over from the previous correction).
 */
export function anchorFindings(
  doc: TextDoc,
  ai: { findings: InFinding[]; hints: AICorrection["hints"] },
  o: { pattern: RegExp | null; level: Pick<Level, "maxStyle" | "maxMarks">; skills: Set<string>; taken?: Map<number, Range[]> },
): Anchored {
  const items: NewItem[] = [];
  let dropped = 0;
  const masks = doc.map((b) => maskText(blockText(b), o.pattern));
  const taken = new Map<number, Range[]>([...(o.taken ?? new Map())].map(([k, v]) => [k, [...v]]));
  const decided = o.taken ?? new Map<number, Range[]>();
  const cursor = new Map<number, number>();
  let style = 0;
  let marks = 0;
  for (const f of Array.isArray(ai.findings) ? ai.findings : []) {
    const category = normalizeCategory(f?.category);
    const block = Number.isInteger(f?.para) ? f.para - 1 : -1;
    const quote = typeof f?.quote === "string" ? f.quote : "";
    const replacement = typeof f?.replacement === "string" ? f.replacement.replace(/\s+/g, " ") : "";
    const explanation = clip(f?.explanation, 300);
    const kind = kindOf(f?.kind);
    if (!category || block < 0 || block >= doc.length || !quote.trim() || wordsIn(quote) > MAX_QUOTE_WORDS || !explanation || replacement.trim() === quote.trim() || FOREIGN_PLACEHOLDER.test(quote + replacement)) {
      dropped++;
      continue;
    }
    if ((kind === "stil" && style >= o.level.maxStyle) || marks >= o.level.maxMarks) {
      dropped++;
      continue;
    }
    const m = masks[block];
    const blockTaken = taken.get(block) ?? [];
    const masked = (rs: Range[]) => rs.map((r) => ({ start: maskedIndex(m.toOrig, r.start), end: maskedIndex(m.toOrig, r.end) }));
    // a finding of one sentence is looked for in that sentence only
    const span = typeof f.from === "number" ? { start: f.from, end: f.to ?? m.masked.length } : null;
    const inSpan = (r: Range | null) => (r && (!span || (r.start >= span.start && r.start < span.end)) ? r : null);
    const from = span?.start ?? cursor.get(block) ?? 0;
    const hit = inSpan(findQuote(m.masked, quote, from, masked(blockTaken)));
    const skill_id = typeof f.skill_id === "string" && o.skills.has(f.skill_id) ? f.skill_id : null;
    const rule = clip(f.rule, 60);
    const extra = { origin: f.origin ?? "", review: f.review ?? "", review_note: clip(f.review_note, 300) } satisfies Pick<NewItem, "origin" | "review" | "review_note">;
    if (!hit && inSpan(findQuote(m.masked, quote, from, masked(decided.get(block) ?? [])))) {
      // overlaps another new suggestion: counted, never silently lost
      dropped++;
      continue;
    }
    if (!hit && inSpan(findQuote(m.masked, quote, from, []))) continue; // only at places already decided: nothing new
    if (!hit) {
      // quoted wrongly: a note on the paragraph, never a mark at a guessed place
      if (items.some((i) => i.block === block && i.pos_start === null && i.quote === clip(quote, 200))) {
        dropped++;
        continue;
      }
      items.push({ block, pos_start: null, pos_end: null, quote: clip(quote, 200), replacement: clip(replacement, 200), category, kind, rule, explanation, skill_id, ...extra });
      marks++;
      if (kind === "stil") style++;
      continue;
    }
    const start = m.toOrig[hit.start];
    const end = m.toOrig[hit.end];
    const original = blockText(doc[block]).slice(start, end);
    // a replacement that names someone gets the name back that stood there
    const names = maskText(original, o.pattern).names;
    let n = 0;
    const restored = replacement.split(NAME_PLACEHOLDER).reduce((acc, part, i) => (i === 0 ? part : acc + (names[n++] ?? names[0] ?? NAME_PLACEHOLDER) + part), "");
    if (restored === original) {
      dropped++;
      continue;
    }
    items.push({ block, pos_start: start, pos_end: end, quote: original, replacement: restored, category, kind, rule, explanation, skill_id, ...extra });
    taken.set(block, [...blockTaken, { start, end }]);
    cursor.set(block, hit.end);
    marks++;
    if (kind === "stil") style++;
  }
  let hints = 0;
  for (const h of Array.isArray(ai.hints) ? ai.hints : []) {
    const category = normalizeCategory(h?.category);
    const text = clip(h?.text, 400);
    if (!category || !text || hints >= MAX_HINTS) {
      dropped++;
      continue;
    }
    const block = Number.isInteger(h.para) && h.para! >= 1 && h.para! <= doc.length ? h.para! - 1 : null;
    items.push({ block, pos_start: null, pos_end: null, quote: "", replacement: "", category, kind: "hinweis", rule: "", explanation: text, skill_id: null, origin: "", review: "", review_note: "" });
    hints++;
  }
  return { items, dropped };
}

/** The masked position of an original position (the first masked index that maps to it or beyond). */
function maskedIndex(toOrig: number[], orig: number) {
  const i = toOrig.findIndex((x) => x >= orig);
  return i < 0 ? toOrig.length - 1 : i;
}

// ---------- the three views ----------

/** The runs of a block between two character positions, marks kept. */
export function sliceRuns(runs: Run[], from: number, to: number): Run[] {
  const out: Run[] = [];
  let at = 0;
  for (const r of runs) {
    const a = Math.max(from, at);
    const b = Math.min(to, at + r.x.length);
    if (a < b) out.push({ ...r, x: r.x.slice(a - at, b - at) });
    at += r.x.length;
  }
  return out;
}

const marksAt = (runs: Run[], pos: number): Omit<Run, "x"> => {
  let at = 0;
  for (const r of runs) {
    if (pos < at + r.x.length || (pos === at + r.x.length && r === runs.at(-1))) {
      const { x: _x, ...marks } = r;
      return marks;
    }
    at += r.x.length;
  }
  return {};
};

type Positioned = Pick<CorrectionItem, "id" | "block" | "pos_start" | "pos_end" | "replacement" | "status">;
export const placed = <T extends Pick<CorrectionItem, "block" | "pos_start" | "pos_end">>(i: T): i is T & { block: number; pos_start: number; pos_end: number } =>
  i.block !== null && i.pos_start !== null && i.pos_end !== null;

/**
 * The Endfassung: the snapshot with every accepted change applied (formatting of the replaced text is
 * taken from where it starts). `changes` are the replaced places in the new text, for highlighting.
 */
export function applyAccepted(doc: TextDoc, items: Positioned[]): { doc: TextDoc; changes: Map<number, (Range & { id: number })[]> } {
  const changes = new Map<number, (Range & { id: number })[]>();
  const out = doc.map((b, bi) => {
    const mine = items.filter((i) => i.status === "uebernommen" && placed(i) && i.block === bi).sort((a, c) => a.pos_start! - c.pos_start!);
    if (!mine.length) return b;
    const runs: Run[] = [];
    const ranges: (Range & { id: number })[] = [];
    let at = 0;
    let len = 0;
    for (const i of mine) {
      if (i.pos_start! < at) continue; // overlapping: the earlier one wins
      const before = sliceRuns(b.r, at, i.pos_start!);
      runs.push(...before);
      len += before.reduce((n, r) => n + r.x.length, 0);
      if (i.replacement) runs.push({ ...marksAt(b.r, i.pos_start!), x: i.replacement });
      ranges.push({ start: len, end: len + i.replacement.length, id: i.id });
      len += i.replacement.length;
      at = i.pos_end!;
    }
    runs.push(...sliceRuns(b.r, at, Infinity));
    changes.set(bi, ranges);
    return { t: b.t, r: normalizeRuns(runs) } satisfies Block;
  });
  return { doc: out, changes };
}

/** A block cut into pieces: plain text and marked places (item id), in order. */
export function segmentsOf(block: Block, items: Pick<CorrectionItem, "id" | "pos_start" | "pos_end">[]): { runs: Run[]; itemId: number | null; start: number }[] {
  const len = blockText(block).length;
  const marks = items.filter((i) => i.pos_start !== null && i.pos_end !== null).sort((a, b) => a.pos_start! - b.pos_start!);
  const out: { runs: Run[]; itemId: number | null; start: number }[] = [];
  let at = 0;
  for (const m of marks) {
    if (m.pos_start! < at) continue;
    if (m.pos_start! > at) out.push({ runs: sliceRuns(block.r, at, m.pos_start!), itemId: null, start: at });
    out.push({ runs: sliceRuns(block.r, m.pos_start!, m.pos_end!), itemId: m.id, start: m.pos_start! });
    at = m.pos_end!;
  }
  if (at < len || !out.length) out.push({ runs: sliceRuns(block.r, at, len), itemId: null, start: at });
  return out;
}

// ---------- overview (only what the teacher accepted) ----------

export type CategoryCount = { key: string; label: string; short: string; fehler: number; stil: number; hinweis: number };
export type Overview = {
  categories: CategoryCount[];
  fehler: number;
  stil: number;
  hinweise: number;
  open: number;
  rejected: number;
  /** most frequent rule (or category) among the accepted errors, when it occurs at least twice */
  mainIssue: string | null;
  /** the skill most accepted errors belong to */
  skillId: string | null;
};

export function overview(items: Pick<CorrectionItem, "category" | "kind" | "status" | "rule" | "skill_id">[]): Overview {
  const ok = items.filter((i) => i.status === "uebernommen");
  const categories = TEXT_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    short: c.short,
    fehler: ok.filter((i) => i.category === c.key && i.kind === "fehler").length,
    stil: ok.filter((i) => i.category === c.key && i.kind === "stil").length,
    hinweis: ok.filter((i) => i.category === c.key && i.kind === "hinweis").length,
  })).filter((c) => c.fehler + c.stil + c.hinweis > 0);
  const errors = ok.filter((i) => i.kind === "fehler");
  const top = <T,>(xs: T[]) => {
    const n = new Map<T, number>();
    for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0] ?? null;
  };
  const rules = errors.filter((i) => i.rule.trim());
  const rule = top(rules.map((i) => i.rule.trim().toLowerCase()));
  const cat = top(errors.map((i) => i.category));
  const mainIssue =
    rule && rule[1] >= 2 ? rules.find((i) => i.rule.trim().toLowerCase() === rule[0])!.rule.trim() : cat && cat[1] >= 2 ? (categoryInfo(cat[0])?.label ?? null) : null;
  const skill = top(errors.map((i) => i.skill_id).filter((s): s is string => Boolean(s)));
  return {
    categories,
    fehler: errors.length,
    stil: ok.filter((i) => i.kind === "stil").length,
    hinweise: ok.filter((i) => i.kind === "hinweis").length,
    open: items.filter((i) => i.status === "offen").length,
    rejected: items.filter((i) => i.status === "abgelehnt").length,
    mainIssue,
    skillId: skill?.[0] ?? null,
  };
}

/** "Rechtschreibung: 4 Fehler" / "Ausdruck: 2 Verbesserungsvorschläge". */
export function countLabel(c: CategoryCount): string {
  const parts = [
    c.fehler ? `${c.fehler} ${c.fehler === 1 ? "Fehler" : "Fehler"}` : "",
    c.stil ? `${c.stil} ${c.stil === 1 ? "Verbesserungsvorschlag" : "Verbesserungsvorschläge"}` : "",
    c.hinweis ? `${c.hinweis} ${c.hinweis === 1 ? "Hinweis" : "Hinweise"}` : "",
  ].filter(Boolean);
  return `${c.label}: ${parts.join(", ")}`;
}


/**
 * The exercise a correction suggests, from accepted errors only: the skill most of them belong to, with
 * the KI's wording when it named the same skill; without a skill, the main issue.
 */
export function recommendationFrom(
  c: Pick<CorrectionRow, "recommendation" | "recommendation_skill">,
  o: Overview,
  skillName: (id: string) => string | null,
): { text: string; skillId: string | null } | null {
  if (!o.fehler) return null;
  const skillId = o.skillId ?? (c.recommendation ? c.recommendation_skill : null);
  const name = skillId ? skillName(skillId) : null;
  if (c.recommendation && (!o.skillId || o.skillId === c.recommendation_skill)) return { text: c.recommendation, skillId: name ? skillId : null };
  if (name) return { text: `Übung zu „${name}“`, skillId };
  if (o.mainIssue) return { text: `Übung zu „${o.mainIssue}“`, skillId: null };
  return null;
}
