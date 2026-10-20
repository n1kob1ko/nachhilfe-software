/**
 * The pure part of a Textkorrektur, used by the server and the browser: finding the KI's quotes in a
 * paragraph, hiding names, the three views (marks, Endfassung) and the overview of accepted errors.
 * Storage and the KI run are in lib/text-correction.ts.
 */
import type { FailCause } from "./ai/router";
import type { AICorrection } from "./ai/textkorrektur";
import { blockText, normalizeRuns, type Block, type Run, type TextDoc } from "./text-doc";
import { ADDRESS_BEFORE, ARTICLES, isNounName, isWordName } from "./name-detection";
import { keepQuoteStyle, onlyQuotesDiffer, quoteStyleHint, tidyEdges } from "./text-correction-checks";
import { categoryInfo, normalizeCategory, TEXT_CATEGORIES, type Level } from "./text-correction-rules";

export type ItemStatus = "offen" | "uebernommen" | "abgelehnt";
export type ItemKind = "fehler" | "stil" | "hinweis";
export type ItemSource = "ki" | "lehrer";
/**
 * Where a KI suggestion came from: '' = the one-step correction, analyse = step 1 of „gründlich“, fassung = only in
 * the KI's version of the sentence („gründlich neu“), pruefung = found by the second check, regel = found by the program
 */
export type ItemOrigin = "" | "analyse" | "fassung" | "pruefung" | "regel";
/**
 * '' = nothing special; lehrer = the teacher must look closely (note says why); verworfen = the second check found it wrong;
 * unpassend = the replacement does not fit its place and cannot be accepted (lib/text-correction-checks.ts replacementProblem).
 * Both of the last are stored as abgelehnt.
 */
export type ItemReview = "" | "lehrer" | "verworfen" | "unpassend";
export type CorrectionMethod = "einfach" | "gruendlich";
export type AIStatus = "keine" | "laeuft" | "fertig" | "fehler";
/** The second check of a „gründlich“ run: '' = not run, laeuft = „Erneut versuchen“ is running */
export type VerifyStatus = "" | "ok" | "fehler" | "laeuft";
/** Why a KI correction or its second check failed: the router's causes, step 1 answered no sentence, the result could not be stored. */
export type CorrectionFailCause = FailCause | "keine_saetze" | "speichern";

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
  /** the second check of a „gründlich“ run: '' = not run, ok, fehler, laeuft (repeated by the teacher) */
  verify_status: VerifyStatus;
  /** why the second check failed, as the teacher reads it; '' when it did not */
  verify_error: string;
  /** step 1's answer while the second check is still owed (JSON {version, data}, masked text only), for „Erneut versuchen“; '' otherwise */
  analysis: string;
  /** words OpenRouter's privacy filter hid from the KI, JSON [{para, text, grammar}], '' = none seen */
  hidden_words: string;
  /** names replaced besides the known ones, as the teacher confirmed them, JSON array; '' = not chosen (detected) */
  masked_names: string;
  shared_at: string | null;
  created_at: string;
  updated_at: string;
};

// ---------- when the KI fails ----------

const FAILURE_TEXT: Record<CorrectionFailCause, string> = {
  aus: "Die KI ist ausgeschaltet oder nicht eingerichtet.",
  budget: "Das KI-Budget für diesen Monat ist aufgebraucht.",
  pausiert: "Die KI war zuletzt mehrmals nicht erreichbar und macht ein paar Minuten Pause.",
  zeitlimit: "Die KI hat nicht rechtzeitig geantwortet.",
  nicht_erreichbar: "Die KI war nicht erreichbar.",
  anbieter: "Der KI-Anbieter hat einen Fehler gemeldet.",
  unvollstaendig: "Die Antwort der KI war unvollständig.",
  leer: "Die KI hat eine leere Antwort geschickt.",
  json: "Die Antwort der KI war nicht lesbar.",
  schema: "Die Antwort der KI hatte nicht die erwartete Form.",
  verweigert: "Die KI hat die Antwort verweigert.",
  einstellung: "Die KI-Einstellung passt nicht zu dieser Anfrage.",
  unbrauchbar: "Die KI hat keine verwertbare Antwort geliefert.",
  keine_saetze: "Die KI hat keinen Satz des Textes beantwortet.",
  speichern: "Das Ergebnis konnte nicht gespeichert werden.",
};

/**
 * What the teacher reads when the KI failed: one plain sentence per cause, never the provider's own text (that goes
 * only into the cost log, ai_calls.error). code: the provider's HTTP status, for overload, credit and access.
 */
export function failureText(cause: CorrectionFailCause, code?: number): string {
  if (cause === "anbieter" && code === 429) return "Der KI-Anbieter ist gerade überlastet.";
  if (cause === "anbieter" && code === 402) return "Beim KI-Anbieter ist das Guthaben aufgebraucht.";
  if (cause === "anbieter" && (code === 401 || code === 403)) return "Der KI-Anbieter hat den Zugang abgelehnt. Der API-Schlüssel muss geprüft werden.";
  return FAILURE_TEXT[cause] ?? FAILURE_TEXT.unbrauchbar;
}

/** A failure stored before 2026-10-11 may end in the provider's own text in brackets: shown without it. */
export function shownFailure(stored: string | null | undefined): string {
  return (stored ?? "").replace(/^(Die KI war nicht erreichbar|Die Korrektur konnte nicht gespeichert werden) \(.*\)\.?$/s, "$1.");
}

/** The names the teacher confirmed for a correction (text_corrections.masked_names); null = not chosen or unreadable. */
export function maskedNames(json: string | null | undefined): string[] | null {
  if (!json) return null;
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((n): n is string => typeof n === "string" && /\p{L}/u.test(n)) : null;
  } catch {
    return null;
  }
}

/** The words a privacy filter hid, as stored in text_corrections.hidden_words; anything unreadable counts as none. */
export function hiddenWords(json: string | null | undefined): { para: number; text: string; grammar: boolean }[] {
  try {
    const v: unknown = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter((h) => Number.isInteger(h?.para) && typeof h?.text === "string" && h.text.trim()).map((h) => ({ para: h.para, text: h.text, grammar: Boolean(h.grammar) })) : [];
  } catch {
    return [];
  }
}

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

/** Every letter in both cases („[lL][eE][aA]“): the pattern is case-sensitive for names that are also words. */
const anyCase = (s: string) =>
  [...s]
    .map((ch) => {
      const lo = ch.toLowerCase();
      const up = ch.toUpperCase();
      return lo !== up && lo.length === 1 && up.length === 1 ? `[${lo}${up}]` : escapeRe(ch);
    })
    .join("");
/** Not right after an article („im Sommer“, „kein heller Stern“). */
const NOT_AFTER_ARTICLE = `(?<!(?:^|[^\\p{L}\\p{N}])(?:${ARTICLES.map(anyCase).join("|")})\\s+(?:\\p{Ll}\\p{L}*\\s+)?)`;
/** Right after a form of address or a kinship word („Frau“, „frau“, „Opa“, „Dear“). */
const AFTER_ADDRESS = `(?<=(?:^|[^\\p{L}\\p{N}])(?:${ADDRESS_BEFORE.map(anyCase).join("|")})\\.?\\s+)`;

/**
 * Name parts of at least 3 letters, as whole words, longest first, in any case („lena“ too). A name that is also an
 * everyday word („Weiß“, „Sommer“, „Fox“, „Will“) only where it stands as a name: with a capital letter, a noun not
 * after an article, or right after a form of address; „Niemand weiß“, „im Sommer“ and „I will“ stay (test 2026-10-10).
 */
export function namePattern(names: string[]): RegExp | null {
  const parts = [...new Set(names.flatMap((n) => n.split(/[\s-]+/)).map((p) => p.replace(/[^\p{L}]/gu, "")).filter((p) => p.length >= 3))].sort((a, b) => b.length - a.length);
  if (!parts.length) return null;
  const alternatives = parts.map((p) =>
    isWordName(p) ? `(?:${isNounName(p) ? NOT_AFTER_ARTICLE : ""}${escapeRe(p.charAt(0).toUpperCase())}${anyCase(p.slice(1))}|${AFTER_ADDRESS}${anyCase(p)})` : anyCase(p),
  );
  // a genitive s stays outside the placeholder („Leas“ → „[Name]s“): hidden inside it, the KI added it once more („Leass“, test 4, 2026-10-09)
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?=s?(?![\\p{L}\\p{N}]))`, "gu");
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

/**
 * agreed: only while the „gründlich“ run decides, never stored. Step 1 made this change both in its list and in its own
 * version of the sentence; the second check alone does not sort such a suggestion out (lib/ai/textkorrektur-gruendlich.ts).
 */
export type NewItem = Omit<CorrectionItem, "id" | "correction_id" | "status" | "source" | "decided_by" | "decided_at" | "created_at"> & { agreed?: boolean };

export const clip = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const kindOf = (raw: unknown): "fehler" | "stil" => (typeof raw === "string" && /stil|style|vorschlag|optional|empfehl/i.test(raw) ? "stil" : "fehler");
const wordsIn = (s: string) => s.split(/\s+/).filter(Boolean).length;

export type Anchored = { items: NewItem[]; dropped: number };

/** A finding as the KI gave it, with what the „gründlich“ run adds: its sentence (masked positions), origin and review. */
export type InFinding = AICorrection["findings"][number] & { from?: number; to?: number; origin?: ItemOrigin; review?: ItemReview; review_note?: string; agreed?: boolean };

/**
 * Turns the KI's findings into items with exact positions in the snapshot. A finding is dropped when its
 * category is unknown, its paragraph does not exist, it has no explanation, the replacement equals the
 * quote, or there are already too many; a finding whose quote is not in the paragraph becomes a note
 * without a place. `taken` are places already decided (carried over from the previous correction).
 * The kind of quotation marks is no error: a change of "…" to „…“ only is left out, like a hint about
 * nothing else, and a replacement keeps the student's straight ones (keepQuoteStyle).
 */
/** The words of a quote without the signs at their edges („gesagt,“ → „gesagt“, „[Name]“ stays). */
const bareWords = (s: string) => s.split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}[]+|[^\p{L}\p{N}\]]+$/gu, "")).filter(Boolean);

export function anchorFindings(
  doc: TextDoc,
  ai: { findings: InFinding[]; hints: AICorrection["hints"] },
  o: { pattern: RegExp | null; level: Pick<Level, "maxStyle" | "maxMarks">; skills: Set<string>; taken?: Map<number, Range[]> },
): Anchored {
  const items: NewItem[] = [];
  let dropped = 0;
  const masks = doc.map((b) => maskText(blockText(b), o.pattern));
  const whole = doc.map(blockText).join("\n");
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
    // straight quotation marks ("…") instead of „…“ are no error (niko, 2026-10-20): no suggestion, and none counted as verworfen
    if (quote.trim() && onlyQuotesDiffer(quote.trim(), replacement.trim())) continue;
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
    const extra = { origin: f.origin ?? "", review: f.review ?? "", review_note: clip(f.review_note, 300), ...(f.agreed ? { agreed: true } : {}) } satisfies Pick<NewItem, "origin" | "review" | "review_note" | "agreed">;
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
      items.push({ block, pos_start: null, pos_end: null, quote: clip(quote, 200), replacement: clip(keepQuoteStyle(quote, replacement, whole), 200), category, kind, rule, explanation, skill_id, ...extra });
      marks++;
      if (kind === "stil") style++;
      continue;
    }
    const text = blockText(doc[block]);
    const at = { start: m.toOrig[hit.start], end: m.toOrig[hit.end] };
    // a replacement that names someone gets the name back that stood there
    const names = maskText(text.slice(at.start, at.end), o.pattern).names;
    let n = 0;
    const named = replacement.split(NAME_PLACEHOLDER).reduce((acc, part, i) => (i === 0 ? part : acc + (names[n++] ?? names[0] ?? NAME_PLACEHOLDER) + part), "");
    // the student's kind of quotation marks: "…" stays "…" when the KI writes „…“
    const restored = keepQuoteStyle(text.slice(at.start, at.end), named, whole);
    // no space before a sign and no two spaces once it stands in the text („gesagt , dass“); the word before only comes
    // in when no other suggestion has it, else just the space (that one may come later in the list)
    const others = new Set(ai.findings.filter((g) => g !== f && g?.para === f.para && typeof g?.quote === "string").flatMap((g) => bareWords(g.quote)));
    const free = (r: Range) => !blockTaken.some((t) => overlaps(t, r)) && !bareWords(maskText(text.slice(r.start, r.end), o.pattern).masked).some((w) => others.has(w));
    const { start, end, replacement: tidy } = tidyEdges(text, { ...at, replacement: restored }, free);
    const original = text.slice(start, end);
    if (tidy === original) {
      dropped++;
      continue;
    }
    if (onlyQuotesDiffer(original, tidy)) continue;
    items.push({ block, pos_start: start, pos_end: end, quote: original, replacement: tidy, category, kind, rule, explanation, skill_id, ...extra });
    taken.set(block, [...blockTaken, { start, end }]);
    cursor.set(block, hit.end);
    marks++;
    if (kind === "stil") style++;
  }
  let hints = 0;
  for (const h of Array.isArray(ai.hints) ? ai.hints : []) {
    const category = normalizeCategory(h?.category);
    const text = clip(h?.text, 400);
    if (quoteStyleHint(text)) continue; // only about „…“ instead of "…": no error, so no hint either
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
