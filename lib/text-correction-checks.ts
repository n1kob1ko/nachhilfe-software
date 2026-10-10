/**
 * Rule-based checks of a Textkorrektur, without any KI: they do not decide what is right, they point the
 * teacher to places that need a second look. Sentences are numbered so the KI must answer for every one
 * of them; a proposal whose category, explanation or result does not fit the change it makes is marked
 * for the teacher; a few errors the program can see by itself (small letter at the start of a sentence,
 * missing Beistrich before „dass“/„weil“, a doubled word) become suggestions of their own; and the text
 * with every proposal applied is checked again, so two proposals that clash do not go through unseen.
 * Pure functions, used by the server and the tests.
 */

export type Span = { start: number; end: number };
export type Sentence = Span & { id: string; para: number; text: string };

// ---------- sentences ----------

/** Words after which a full stop does not end the sentence (z. B., usw., Nr. …), lower case, without the dot. */
const ABBREVIATIONS = new Set(
  "bzw usw etc ca nr dr mag ing prof vgl abs jh jhd st hr fr evtl ggf bspw inkl exkl max min mio mrd tel bzgl allg sog geb gest dipl univ mr mrs ms vs approx".split(" "),
);
const OPENING = /[\p{Lu}\p{N}„"»«(‚'‘’“]/u;

function endsSentence(text: string, dot: number): boolean {
  if (text[dot] !== ".") return true; // ! ? …
  const before = text.slice(0, dot).match(/([\p{L}\p{N}]+)$/u)?.[1] ?? "";
  if (!before) return true;
  if (/^\p{L}$/u.test(before)) return false; // z. B., d. h., S. 3, Z. 12, initials
  if (/^\p{N}{1,2}$/u.test(before)) return false; // ordinal: am 3. Jänner
  return !ABBREVIATIONS.has(before.toLowerCase());
}

/** The sentences of one paragraph as ranges (every character belongs to one; spaces between are left out). */
export function splitSentences(text: string): Span[] {
  const out: Span[] = [];
  let start = text.search(/\S/);
  if (start < 0) return out;
  const re = /([.!?…]+)([»«"“”'’)\]]*)(\s+)/g;
  for (const m of text.matchAll(re)) {
    const end = m.index! + m[1].length + m[2].length;
    const next = m.index! + m[0].length;
    if (next >= text.length || end <= start) continue;
    if (!OPENING.test(text[next])) continue;
    if (!endsSentence(text, m.index! + m[1].length - 1)) continue;
    out.push({ start, end });
    start = next;
  }
  const last = text.trimEnd().length;
  if (last > start) out.push({ start, end: last });
  return out;
}

/** Every sentence of the text, numbered „Absatz.Satz“ (both from 1), headings as one sentence. */
export function sentencesOf(blocks: { text: string; heading: boolean }[]): Sentence[] {
  const out: Sentence[] = [];
  blocks.forEach((b, i) => {
    const spans = b.heading ? (b.text.trim() ? [{ start: b.text.search(/\S/), end: b.text.trimEnd().length }] : []) : splitSentences(b.text);
    spans.forEach((s, k) => out.push({ ...s, id: `${i + 1}.${k + 1}`, para: i + 1, text: b.text.slice(s.start, s.end) }));
  });
  return out;
}

// ---------- applying changes ----------

export type Change = Span & { replacement: string };

/** The text with the changes applied (overlapping ones after the first are skipped) and where each change landed. */
export function applyChanges<C extends Change>(text: string, changes: C[]): { text: string; placed: { change: C; at: Span }[]; skipped: C[] } {
  const sorted = [...changes].sort((a, b) => a.start - b.start || a.end - b.end);
  let out = "";
  let at = 0;
  const placed: { change: C; at: Span }[] = [];
  const skipped: C[] = [];
  for (const c of sorted) {
    if (c.start < at) {
      skipped.push(c);
      continue;
    }
    out += text.slice(at, c.start);
    placed.push({ change: c, at: { start: out.length, end: out.length + c.replacement.length } });
    out += c.replacement;
    at = c.end;
  }
  return { text: out + text.slice(at), placed, skipped };
}

/** For comparing two versions of a sentence: typographic quotes and dashes plain, spaces collapsed. */
export function comparable(s: string): string {
  return s
    .replace(/[„“”«»]/g, '"')
    .replace(/[‚‘’‹›`´]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

// ---------- does a proposal fit what it changes? ----------

const lettersOf = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "");
const punctOf = (s: string) => s.replace(/[\p{L}\p{N}\s]/gu, "");
const wordsOf = (s: string) => s.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? [];

export type Shape = { punct: boolean; letters: boolean; caseOnly: boolean; toUpper: boolean; toLower: boolean; words: boolean; spaces: boolean };

/** What a change does: punctuation, upper/lower case, letters of a word, whole words, spaces. */
export function shapeOf(quote: string, replacement: string): Shape {
  const lq = lettersOf(quote);
  const lr = lettersOf(replacement);
  const caseOnly = lq !== lr && lq.toLowerCase() === lr.toLowerCase();
  let toUpper = false;
  let toLower = false;
  if (caseOnly) {
    for (let i = 0; i < lq.length; i++) {
      if (lq[i] !== lr[i] && lq[i].toUpperCase() === lr[i]) toUpper = true;
      if (lq[i] !== lr[i] && lq[i].toLowerCase() === lr[i]) toLower = true;
    }
  } else {
    // a word that only changed its first letter's case, inside a bigger change
    const wq = wordsOf(quote);
    const wr = new Set(wordsOf(replacement));
    for (const w of wq) {
      const up = w[0].toUpperCase() + w.slice(1);
      const low = w[0].toLowerCase() + w.slice(1);
      if (w !== up && wr.has(up) && !wr.has(w)) toUpper = true;
      if (w !== low && wr.has(low) && !wr.has(w)) toLower = true;
    }
  }
  const wq = wordsOf(quote);
  const wr = wordsOf(replacement);
  const sameWords = wq.length === wr.length && wq.every((w, i) => w.toLowerCase() === wr[i].toLowerCase());
  return {
    punct: punctOf(quote) !== punctOf(replacement),
    letters: lq.toLowerCase() !== lr.toLowerCase(),
    caseOnly,
    toUpper,
    toLower,
    words: !sameWords,
    spaces: lq === lr && quote.replace(/[^\s]/g, "").length !== replacement.replace(/[^\s]/g, "").length,
  };
}

/**
 * Why a proposal's category or explanation does not fit the change it makes, or null. Only clear cases:
 * a Beistrich rule that changes words, a spelling rule that only moves a comma, an explanation about
 * capital letters for a change without one.
 */
export function mismatchOf(f: { category: string; quote: string; replacement: string; explanation: string; rule?: string }): string | null {
  const s = shapeOf(f.quote, f.replacement);
  // the explanation only: a rule is often a heading for both sides („Groß- und Kleinschreibung“, „s, ss oder ß“)
  const why = f.explanation;
  const upper = /großgeschrieben|großschreib|schreibt man groß|wird groß|groß geschrieben|großen anfangsbuchstaben|capital letter/i.test(why);
  const lower = /kleingeschrieben|kleinschreib|schreibt man klein|wird klein|klein geschrieben/i.test(why);
  if (f.category === "zeichensetzung" && s.letters) return "Als Zeichensetzung bezeichnet, ändert aber Wörter.";
  if (f.category === "rechtschreibung" && !s.letters && !s.caseOnly && !s.spaces && s.punct) return "Als Rechtschreibung bezeichnet, ändert aber nur Satzzeichen.";
  // „nicht klein-, sondern großgeschrieben“ names both
  if (upper && !s.toUpper && !(lower && s.toLower)) return "Die Erklärung spricht von Großschreibung, die Änderung schreibt aber nichts groß.";
  if (lower && !s.toLower && !(upper && s.toUpper)) return "Die Erklärung spricht von Kleinschreibung, die Änderung schreibt aber nichts klein.";
  if (/\b(beistrich|komma)\b/i.test(why) && !s.punct && f.category === "zeichensetzung") return "Die Erklärung spricht von einem Beistrich, die Änderung setzt aber keinen.";
  if (/(^|[^\p{L}])ß([^\p{L}]|$)/u.test(why) && !/ß/.test(f.quote + f.replacement) && f.category === "rechtschreibung") return "Die Erklärung spricht von ß, die Änderung hat aber kein ß.";
  return null;
}

/** Pronouns that can be the subject of a German sentence. */
const SUBJECTS = new Set("ich du er sie es wir ihr man".split(" "));

/**
 * A suggestion that brings in a new subject („sich … erlauben“ → „man sich … erlaubt“, „dass wenn Kinder“
 * → „dass Kinder, wenn sie“) rebuilds the sentence around someone the student did not name. In tests 3 and 4
 * (2026-10-09, about 1,250 suggestions) all 10 such suggestions were wrong or unasked for, and none of the
 * right ones looked like this. A pronoun swapped for another („er“ → „es“) is no new subject.
 */
export function newSubjectOf(quote: string, replacement: string): string | null {
  const count = (s: string) => {
    const n = new Map<string, number>();
    for (const w of s.toLowerCase().match(/\p{L}+/gu) ?? []) if (SUBJECTS.has(w)) n.set(w, (n.get(w) ?? 0) + 1);
    return n;
  };
  const before = count(quote);
  const after = count(replacement);
  const total = (n: Map<string, number>) => [...n.values()].reduce((a, b) => a + b, 0);
  if (total(after) <= total(before)) return null;
  const added = [...after].find(([w, k]) => k > (before.get(w) ?? 0))?.[0];
  return added ? `Der Vorschlag setzt „${added}“ neu ein. Bitte prüfen, ob der Satz noch dasselbe meint.` : null;
}

// ---------- what the program finds by itself ----------

export type RuleFinding = { para: number; start: number; end: number; quote: string; replacement: string; category: "rechtschreibung" | "zeichensetzung" | "ausdruck"; rule: string; explanation: string };

/** Conjunctions that start a Nebensatz and need a Beistrich before them. */
const CONJUNCTIONS = ["dass", "weil", "obwohl", "obgleich", "sodass", "nachdem", "wenn", "falls", "sobald", "bevor", "ob"];
/** Words after which such a conjunction needs no Beistrich (so dass, ohne dass, auch wenn, und weil, zum Beispiel wenn …). */
const NO_COMMA_AFTER = new Set(
  "und oder sowie sondern aber denn doch jedoch als wie ohne statt anstatt außer so auch selbst sogar nur gerade besonders erst bloß eben genau schon kaum beispiel insbesondere zwar allem also bis je".split(" "),
);
/** Doubled words that can be right („die Kinder, die die Schule …“, „dass sie sie sah“, „had had“). */
const DOUBLE_OK = new Set("der die das den dem des sie er es wir ihr ihn ihm ihnen that had is".split(" "));

const isLower = (c: string) => c !== c.toUpperCase() && c === c.toLowerCase();
const capitalize = (w: string) => w[0].toUpperCase() + w.slice(1);

/**
 * Small letter at the start of a sentence: at the start of a paragraph or after . ! ? (not after an
 * abbreviation, a number or „…“, not right after a closing quote). A paragraph after one that ends with a
 * comma (the Anrede of a letter) starts small.
 */
function smallStarts(text: string, o: { afterComma?: boolean } = {}): Span[] {
  const out: Span[] = [];
  const first = text.match(/^\s*(\p{L}[\p{L}-]*)/u);
  if (first && isLower(first[1][0]) && !o.afterComma) {
    const at = text.indexOf(first[1]);
    out.push({ start: at, end: at + first[1].length });
  }
  for (const m of text.matchAll(/([.!?])(\s+)(\p{L}[\p{L}-]*)/gu)) {
    const word = m[3];
    if (!isLower(word[0])) continue;
    if (!endsSentence(text, m.index!)) continue;
    if (text.slice(Math.max(0, m.index! - 2), m.index! + 1).includes("..")) continue;
    if (/^(iPad|iPhone|eBay|iOS)$/.test(word)) continue;
    const at = m.index! + m[1].length + m[2].length;
    out.push({ start: at, end: at + word.length });
  }
  return out;
}

/** Errors the program sees by itself, per paragraph (1-based). German only for the Beistrich rule. */
export function ruleFindings(blocks: { text: string; heading: boolean }[], o: { english: boolean }): RuleFinding[] {
  const out: RuleFinding[] = [];
  blocks.forEach((b, i) => {
    if (b.heading || !b.text.trim()) return;
    const t = b.text;
    const para = i + 1;
    for (const s of smallStarts(t, { afterComma: afterComma(blocks, i) })) {
      const word = t.slice(s.start, s.end);
      if (o.english && word === "i") continue; // handled below
      out.push({ para, ...s, quote: word, replacement: capitalize(word), category: "rechtschreibung", rule: o.english ? "Capital letter" : "Großschreibung am Satzanfang", explanation: o.english ? "Am Satzanfang schreibt man auch im Englischen groß." : "Am Satzanfang schreibt man groß." });
    }
    if (o.english) {
      for (const m of t.matchAll(/(?<![\p{L}\p{N}'’])i(?![\p{L}\p{N}])/gu)) out.push({ para, start: m.index!, end: m.index! + 1, quote: "i", replacement: "I", category: "rechtschreibung", rule: "I groß", explanation: "Das englische „I“ (ich) schreibt man immer groß." });
    } else {
      const words = new RegExp(`([\\p{L}\\p{N}]+)(\\s+)(${CONJUNCTIONS.join("|")})(?![\\p{L}\\p{N}])`, "gu");
      for (const m of t.matchAll(words)) {
        if (NO_COMMA_AFTER.has(m[1].toLowerCase())) continue;
        // the first word of a sentence belongs to the Nebensatz („Immer wenn …“, „Nicht dass …“)
        if (/(^|[.!?:;„"»(]\s*)$/u.test(t.slice(0, m.index!))) continue;
        const start = m.index!;
        const end = start + m[0].length;
        out.push({ para, start, end, quote: m[0], replacement: `${m[1]},${m[2]}${m[3]}`, category: "zeichensetzung", rule: `Beistrich vor „${m[3]}“`, explanation: `Vor „${m[3]}“ beginnt ein Nebensatz, davor steht ein Beistrich.` });
      }
    }
    for (const m of t.matchAll(/(?<![\p{L}\p{N}])([\p{L}]+)(\s+)\1(?![\p{L}\p{N}])/giu)) {
      if (DOUBLE_OK.has(m[1].toLowerCase())) continue;
      out.push({ para, start: m.index!, end: m.index! + m[0].length, quote: m[0], replacement: m[1], category: "ausdruck", rule: "Wort doppelt", explanation: "Hier steht dasselbe Wort zweimal hintereinander." });
    }
  });
  return out;
}

/** Whether the paragraph before (the last one with text) ends with a comma, as the Anrede of a letter does. */
function afterComma(blocks: { text: string }[], i: number): boolean {
  for (let k = i - 1; k >= 0; k--) if (blocks[k].text.trim()) return /,\s*$/.test(blocks[k].text);
  return false;
}

// ---------- the text after every proposal ----------

/** Problems in a paragraph the way it reads after the changes: doubled words, small letters at a sentence start, a doubled or loose sign. */
export function finalProblems(text: string, o: { english: boolean; afterComma?: boolean }): (Span & { what: string })[] {
  const out: (Span & { what: string })[] = [];
  for (const s of smallStarts(text, o)) if (!(o.english && text.slice(s.start, s.end) === "i")) out.push({ ...s, what: "Kleinbuchstabe am Satzanfang" });
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])([\p{L}]+)\s+\1(?![\p{L}\p{N}])/giu)) if (!DOUBLE_OK.has(m[1].toLowerCase())) out.push({ start: m.index!, end: m.index! + m[0].length, what: `„${m[1]}“ steht zweimal` });
  for (const m of text.matchAll(/,\s*,|(?<!\.)\.\.(?!\.)|\s+[,.;:!?](?![.\d])/g)) out.push({ start: m.index!, end: m.index! + m[0].length, what: "Satzzeichen doppelt oder mit Leerzeichen davor" });
  return out;
}

/** Words that are right in one place and wrong in another: never carried over to another place. */
const BOTH_WORDS = new Set(
  ["das", "dass", "seid", "seit", "wieder", "wider", "wenn", "wen", "denn", "den", "dem", "man", "mann", "ihm", "im", "ihn", "in", "war", "wahr", "viel", "fiel", "statt", "stadt", "malen", "mahlen", "mal", "mahl", "end", "ent", "tod", "tot", "wiese", "weise", "waise", "fast", "fasst", "lehre", "leere", "its", "it's", "their", "there", "they're", "your", "you're", "to", "too", "then", "than", "were", "where", "we're"],
);

/**
 * The same spelling error at another place: the same wrong word with the same word before or after it
 * („spaß zu haben“ twice). Only then: the same word can be right elsewhere („beim essen“ vs. „wir essen“).
 * Never for short words or pairs like das/dass: one neighbour word says too little there.
 */
export function sameErrorElsewhere(
  blocks: string[],
  fixes: { para: number; start: number; end: number; quote: string; replacement: string }[],
  taken: { para: number; start: number; end: number }[],
): { para: number; start: number; end: number; quote: string; replacement: string; from: number }[] {
  const out: { para: number; start: number; end: number; quote: string; replacement: string; from: number }[] = [];
  const busy = [...taken];
  const near = (t: string, s: Span) => ({ before: t.slice(0, s.start).match(/([\p{L}]+)\W*$/u)?.[1] ?? "", after: t.slice(s.end).match(/^\W*([\p{L}]+)/u)?.[1] ?? "" });
  for (const f of fixes) {
    const word = f.quote.trim();
    if (!/^[\p{L}]{4,}$/u.test(word) || !/^[\p{L}]+$/u.test(f.replacement.trim())) continue;
    if (BOTH_WORDS.has(word.toLowerCase()) || BOTH_WORDS.has(f.replacement.trim().toLowerCase())) continue;
    const ctx = near(blocks[f.para - 1] ?? "", f);
    blocks.forEach((t, bi) => {
      for (const m of t.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "gu"))) {
        const s = { start: m.index!, end: m.index! + word.length };
        if (busy.some((b) => b.para === bi + 1 && b.start < s.end && s.start < b.end)) continue;
        const here = near(t, s);
        if (!((ctx.before && here.before === ctx.before) || (ctx.after && here.after === ctx.after))) continue;
        out.push({ para: bi + 1, ...s, quote: word, replacement: f.replacement.trim(), from: f.para });
        busy.push({ para: bi + 1, ...s });
      }
    });
  }
  return out;
}

// ---------- on the suggestions of a correction ----------

/** What the checks need of a suggestion (block 0-based, positions in the block's text). */
export type CheckItem = {
  block: number | null;
  pos_start: number | null;
  pos_end: number | null;
  quote: string;
  replacement: string;
  category: string;
  kind: string;
  rule: string;
  explanation: string;
  review: "" | "lehrer" | "verworfen";
  review_note: string;
};

/** At most max characters, cut between words with „…“ (a note cut in mid-word confused in the test, 2026-10-09). */
export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max / 2 ? head.slice(0, space) : head).replace(/[\s,;:–-]+$/, "")} …`;
}

/** The suggestion marked for the teacher, with one more reason (a sorted-out one stays sorted out). */
export function withNote<T extends CheckItem>(it: T, note: string): T {
  const review_note = it.review_note.includes(note) ? it.review_note : clip(`${it.review_note} ${note}`, 450);
  return { ...it, review: it.review === "verworfen" ? "verworfen" : "lehrer", review_note };
}

const isPlaced = (i: CheckItem): i is CheckItem & { block: number; pos_start: number; pos_end: number } => i.block !== null && i.pos_start !== null && i.pos_end !== null;

/**
 * Marks for the teacher what the program can see is off: a category or explanation that does not fit
 * the change, a place that could not be found, a new subject in German, two suggestions on the same words, and what is wrong in
 * the text once every suggestion is applied (a doubled word, a small letter at a sentence start, a
 * doubled sign) next to a suggestion.
 */
export function flagItems<T extends CheckItem>(blocks: string[], items: T[], o: { english: boolean }): T[] {
  const out = items.map((it) => {
    if (it.kind === "hinweis" || it.review === "verworfen") return it;
    if (!isPlaced(it)) return withNote(it, "Die Stelle wurde im Text nicht gefunden.");
    const why = mismatchOf(it);
    const marked = why ? withNote(it, why) : it;
    const subject = o.english ? null : newSubjectOf(it.quote, it.replacement);
    return subject ? withNote(marked, subject) : marked;
  });
  blocks.forEach((text, b) => {
    const mine = out.map((it, k) => ({ it, k })).filter(({ it }) => isPlaced(it) && it.block === b && it.review !== "verworfen" && it.kind !== "hinweis");
    if (!mine.length) return;
    const r = applyChanges(
      text,
      mine.map(({ it, k }) => ({ start: it.pos_start!, end: it.pos_end!, replacement: it.replacement, k })),
    );
    for (const s of r.skipped) out[s.k] = withNote(out[s.k], "Überschneidet sich mit einem anderen Vorschlag.");
    for (const p of finalProblems(r.text, { ...o, afterComma: afterComma(blocks.map((text) => ({ text })), b) })) {
      // only what a change brought about or sits right next to
      for (const { change, at } of r.placed) if (at.start <= p.end + 1 && p.start <= at.end + 1) out[change.k] = withNote(out[change.k], `Nach allen Änderungen: ${p.what}.`);
    }
  });
  return out;
}

export type RuleItem = CheckItem & { origin: "regel" };

/**
 * The program's own findings as suggestions for the teacher, where no suggestion is yet: the rules of
 * ruleFindings and the same spelling error at another place (sameErrorElsewhere).
 */
export function ruleItems(blocks: { text: string; heading: boolean }[], items: CheckItem[], o: { english: boolean }): RuleItem[] {
  const taken = items.filter(isPlaced).map((i) => ({ para: i.block + 1, start: i.pos_start, end: i.pos_end }));
  const out: RuleItem[] = [];
  const free = (para: number, s: Span) => !taken.some((t) => t.para === para && t.start < s.end && s.start < t.end);
  for (const f of ruleFindings(blocks, o)) {
    if (!free(f.para, f)) continue;
    taken.push({ para: f.para, start: f.start, end: f.end });
    out.push({ block: f.para - 1, pos_start: f.start, pos_end: f.end, quote: f.quote, replacement: f.replacement, category: f.category, kind: "fehler", rule: f.rule, explanation: f.explanation, review: "lehrer", review_note: "Vom Programm nach einer festen Regel gefunden.", origin: "regel" });
  }
  const spelling = items.filter((i): i is CheckItem & { block: number; pos_start: number; pos_end: number } => isPlaced(i) && i.category === "rechtschreibung" && i.review !== "verworfen");
  const same = sameErrorElsewhere(
    blocks.map((b) => b.text),
    spelling.map((i) => ({ para: i.block + 1, start: i.pos_start, end: i.pos_end, quote: i.quote, replacement: i.replacement })),
    taken,
  );
  for (const m of same) {
    const from = spelling.find((i) => i.block + 1 === m.from && i.quote.trim() === m.quote)!;
    out.push({ block: m.para - 1, pos_start: m.start, pos_end: m.end, quote: m.quote, replacement: m.replacement, category: from.category, kind: from.kind, rule: from.rule, explanation: from.explanation, review: "lehrer", review_note: `Gleicher Fehler wie in Absatz ${m.from}, vom Programm ergänzt.`, origin: "regel" });
  }
  return out;
}
