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

/** Signs that never stand after a space. */
const CLOSING = /^[,.;:!?)]/;

/**
 * A change with the spaces at its edges right once it stands in the text: no space before a sign („gesagt , dass“,
 * „Jahr .“) and no two spaces where a word went. Repaired by taking in the word before the place, or only the space
 * when that word is not free (`free`: whether a range of the text may become part of the place); the student's other
 * words never change. In the test of 2026-10-10 the second check sorted out three right corrections for such a space.
 */
export function tidyEdges<C extends Change>(text: string, c: C, free: (s: Span) => boolean = () => true): C {
  let end = c.end;
  let rep = c.replacement;
  const head = text.slice(0, c.start);
  const after = text.slice(end);
  const space = /\s+$/.exec(head)?.[0] ?? "";
  if (/^\s/.test(rep) && (space || !head)) rep = rep.trimStart();
  if (/\s$/.test(rep) && (/^\s/.test(after) || CLOSING.test(after) || !after)) rep = rep.trimEnd();
  if (!rep && !space && /^\s/.test(after)) end += /^\s+/.exec(after)![0].length;
  if (!space || !(CLOSING.test(rep) || (!rep && (CLOSING.test(after) || /^\s/.test(after) || !after)))) return { ...c, end, replacement: rep };
  // the word before comes in and its space goes: „gesagt das“ → „gesagt, dass“, „Jahr gewesen“ → „Jahr“
  const word = /(\S+)(\s+)$/.exec(head);
  if (word && free({ start: c.start - word[0].length, end: c.start })) return { ...c, start: c.start - word[0].length, end, replacement: word[1] + rep };
  return { ...c, start: c.start - space.length, end, replacement: rep };
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

// ---------- the kind of quotation marks ----------

/** Double and single quotation marks: the straight one a keyboard types and the typographic ones („…“ »…« ‚…‘ ’). */
const QUOTE_KINDS = [
  { plain: '"', typo: /[„“”«»]/, all: /[„“”«»]/g },
  { plain: "'", typo: /[‚‘’‹›]/, all: /[‚‘’‹›]/g },
] as const;
const plainQuotes = (s: string) => QUOTE_KINDS.reduce((out, k) => out.replace(k.all, k.plain), s);

/** Two wordings that differ in the kind of quotation marks only ("Haus" and „Haus“, 'Haus' and ‚Haus‘): no correction. */
export function onlyQuotesDiffer(a: string, b: string): boolean {
  return a !== b && plainQuotes(a) === plainQuotes(b);
}

/**
 * A replacement with the student's kind of quotation marks. Straight ones ("…") are no error (niko, 2026-10-20): where
 * the student types them, the KI's „…“ (and ‚…‘, ’ for ') become straight ones again. What counts is the place; where it
 * has no quotation marks of that kind, the whole text (`text`). Where the student writes „…“ or mixes both, nothing changes.
 */
export function keepQuoteStyle(place: string, replacement: string, text: string = place): string {
  let out = replacement;
  for (const k of QUOTE_KINDS) {
    if (!k.typo.test(out)) continue;
    const straightOnly = (s: string) => s.includes(k.plain) && !k.typo.test(s);
    const atPlace = place.includes(k.plain) || k.typo.test(place);
    if (atPlace ? straightOnly(place) : straightOnly(text)) out = out.replace(k.all, k.plain);
  }
  return out;
}

/**
 * A hint of the KI about the kind of quotation marks only („Verwende die deutschen Anführungszeichen unten und oben.“).
 * Straight ones are no error, so such a hint is left out; one about missing quotation marks stays.
 */
export function quoteStyleHint(text: string): boolean {
  if (!/Anführungszeichen|Gänsefüßchen/i.test(text) || /fehl|vergess|ohne Anführungszeichen|keine Anführungszeichen/i.test(text)) return false;
  return /gerade|typografisch|unten|oben|deutsche\w* Anführungszeichen|englische\w* Anführungszeichen|Art der Anführungszeichen|Form der Anführungszeichen/i.test(text);
}

// ---------- does a replacement fit its place? ----------

/** Placeholders the app or a filter writes for the KI („[Name]“, „[PERSON_NAME]“) and the marks of the second check's text (⟦ ⟧): never part of a student's text. */
const PLACEHOLDERS = /\[Name\]|\[[A-Z][A-Z_]{2,}\]|[⟦⟧]/g;
/** A sign doubled or with a space before it („,,“ „Haus,.“ „usw..“ „Haus .“), not „...“ or „ .5“. */
const LOOSE_SIGNS = /,\s*[,.;:!?]|(?<!\.)\.\.(?!\.)|\s+[,.;:!?](?![.\d])/g;
const WORD = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const touching = (a: Span, b: Span) => a.start <= b.end && b.start <= a.end;

const within = (a: Span, b: Span) => b.start <= a.start && a.end <= b.end;

/**
 * Groups of up to 8 words that stand twice in a row with nothing but spaces between („gieng dann gieng dann“) and touch
 * the range; with `inserted` (the range holds new words) only those with one of the two groups inside it: the new words
 * repeat their neighbours. „und rannte und rante“ → „rannte“ makes „und rannte und rannte“, which is no such repetition.
 */
function doubledAt(text: string, r: Span, inserted = false): { key: string; shown: string; words: number }[] {
  const w = [...text.matchAll(WORD)].map((m) => ({ s: m[0], low: m[0].toLowerCase(), start: m.index!, end: m.index! + m[0].length }));
  const words = inserted && WORD_CHAR.test(text.slice(r.start, r.end));
  const out: { key: string; shown: string; words: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    for (let k = 1; k <= 8 && i + 2 * k <= w.length; k++) {
      const first = { start: w[i].start, end: w[i + k - 1].end };
      const second = { start: w[i + k].start, end: w[i + 2 * k - 1].end };
      if (words ? !within(first, r) && !within(second, r) : !touching({ start: first.start, end: second.end }, r)) continue;
      let same = true;
      for (let j = 0; same && j < k; j++) same = w[i + j].low === w[i + k + j].low;
      for (let j = i; same && j < i + 2 * k - 1; j++) same = /^\s+$/.test(text.slice(w[j].end, w[j + 1].start));
      if (same) out.push({ key: w.slice(i, i + k).map((x) => x.low).join(" "), shown: w.slice(i, i + k).map((x) => x.s).join(" "), words: k });
    }
  }
  return out;
}

/**
 * Why a change cannot go into the paragraph as it stands, or null. The place must exist and (with `quote`) still hold
 * the words the suggestion was made for. Once applied, nothing may come about next to the place that was not there
 * before: new words that repeat the words right next to them („Ich gieng dann gieng dann allein“: the second check
 * wrote „gieng dann allein“ for „alleine“, test of 2026-10-11), a doubled sign or a space before one, a placeholder of
 * the KI. A doubled word that can be right („die die“, „dass sie sie“) does not count, as in finalProblems.
 */
export function replacementProblem(text: string, c: Change & { quote?: string }): string | null {
  if (!Number.isInteger(c.start) || !Number.isInteger(c.end) || c.start < 0 || c.end < c.start || c.end > text.length) return "Die Stelle gibt es im Text nicht.";
  const quote = text.slice(c.start, c.end);
  if (c.quote !== undefined && quote !== c.quote) return "Der Text an dieser Stelle stimmt nicht mehr mit dem Vorschlag überein.";
  const placeholder = (c.replacement.match(PLACEHOLDERS) ?? []).find((p) => !quote.includes(p));
  if (placeholder) return `Der Vorschlag enthält den Platzhalter „${placeholder}“ statt eines Wortes aus dem Text.`;
  const after = text.slice(0, c.start) + c.replacement + text.slice(c.end);
  const was = { start: c.start, end: c.end };
  const now = { start: c.start, end: c.start + c.replacement.length };
  const doubled = new Set(doubledAt(text, was).map((d) => d.key));
  for (const d of doubledAt(after, now, true)) {
    if (doubled.has(d.key) || (d.words === 1 && DOUBLE_OK.has(d.key))) continue;
    return `Danach stünde „${d.shown}“ zweimal hintereinander.`;
  }
  const signs = (t: string, r: Span) => [...t.matchAll(LOOSE_SIGNS)].filter((m) => touching({ start: m.index!, end: m.index! + m[0].length }, r)).map((m) => m[0].replace(/\s+/g, " "));
  const had = signs(text, was);
  for (const s of signs(after, now)) {
    const i = had.indexOf(s);
    if (i < 0) return "Danach stünde ein Satzzeichen doppelt oder mit einem Leerzeichen davor.";
    had.splice(i, 1);
  }
  return null;
}

/**
 * Why the teacher cannot accept a change into the paragraph, or null: replacementProblem on the paragraph as the
 * student wrote it (`alone`: the suggestion itself does not fit), then together with the changes already accepted
 * there (`accepted`): no overlap, and nothing that only comes about next to one of them.
 */
export function acceptProblem(text: string, c: Change & { quote?: string }, accepted: Change[]): { why: string; alone: boolean } | null {
  const own = replacementProblem(text, c);
  if (own) return { why: own, alone: true };
  if (accepted.some((a) => a.start < c.end && c.start < a.end)) return { why: "Die Stelle überschneidet sich mit einer schon übernommenen Korrektur.", alone: false };
  const r = applyChanges(text, accepted);
  const shift = r.placed.filter((p) => p.change.end <= c.start).reduce((n, p) => n + p.change.replacement.length - (p.change.end - p.change.start), 0);
  const together = replacementProblem(r.text, { start: c.start + shift, end: c.end + shift, replacement: c.replacement });
  return together ? { why: `Zusammen mit den schon übernommenen Korrekturen: ${together}`, alone: false } : null;
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

/** The signs of a text without apostrophes. */
const signsOf = (s: string) => punctOf(s).replace(/['’]/g, "");
/** Words that join two main clauses. */
const JOINERS = new Set("und aber oder denn sondern doch and but or so".split(" "));
/** The replacement only adds one joining word after a comma („a lot, it“ → „a lot, and it“). In the test of 2026-10-10 this was marked although right. */
function joinerOnly(quote: string, replacement: string): boolean {
  const q = wordsOf(quote).map((w) => w.toLowerCase());
  const r = wordsOf(replacement).map((w) => w.toLowerCase());
  if (r.length !== q.length + 1) return false;
  const k = r.findIndex((w, i) => w !== q[i]);
  return JOINERS.has(r[k]) && r.slice(k + 1).every((w, i) => w === q[k + i]) && new RegExp(`[,;]\\s*${r[k]}(?![\\p{L}])`, "iu").test(replacement);
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
  // two main clauses joined by a comma alone get a joining word („a lot, it was“ → „a lot, and it was“): still punctuation
  if (f.category === "zeichensetzung" && s.letters && !joinerOnly(f.quote, f.replacement)) return "Als Zeichensetzung bezeichnet, ändert aber Wörter.";
  // an apostrophe belongs to the spelling of a word („it's“ → „its“, „gibt's“)
  if (f.category === "rechtschreibung" && !s.letters && !s.caseOnly && !s.spaces && s.punct && signsOf(f.quote) !== signsOf(f.replacement)) return "Als Rechtschreibung bezeichnet, ändert aber nur Satzzeichen.";
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
  review: "" | "lehrer" | "verworfen" | "unpassend";
  review_note: string;
};

/** Not in the text: sorted out by the second check („verworfen“) or not applicable at its place („unpassend“), both stored as abgelehnt. */
export const setAside = (i: { review: string }) => i.review === "verworfen" || i.review === "unpassend";

/** At most max characters, cut between words with „…“ (a note cut in mid-word confused in the test, 2026-10-09). */
export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max / 2 ? head.slice(0, space) : head).replace(/[\s,;:–-]+$/, "")} …`;
}

/** One more note on the suggestion without marking it: information for the teacher, no reason to look twice. */
export function withInfo<T extends CheckItem>(it: T, note: string): T {
  return { ...it, review_note: it.review_note.includes(note) ? it.review_note : clip(`${it.review_note} ${note}`, 450) };
}

/** The suggestion marked for the teacher, with one more reason (a sorted-out or not applicable one stays so). */
export function withNote<T extends CheckItem>(it: T, note: string): T {
  const review_note = it.review_note.includes(note) ? it.review_note : clip(`${it.review_note} ${note}`, 450);
  return { ...it, review: setAside(it) ? it.review : "lehrer", review_note };
}

/** The suggestion set aside as not applicable (replacementProblem): the teacher sees it and why, but cannot accept it. */
export function notApplicable<T extends CheckItem>(it: T, why: string): T {
  return { ...it, review: "unpassend", review_note: clip(`Nicht anwendbar: ${why} ${it.review_note}`, 450) };
}

const isPlaced = (i: CheckItem): i is CheckItem & { block: number; pos_start: number; pos_end: number } => i.block !== null && i.pos_start !== null && i.pos_end !== null;

/**
 * tidyEdges for every placed suggestion (the second check's better wording included); the places of the others and
 * the places already decided (`decided`, per paragraph) stay free.
 */
export function tidyItems<T extends CheckItem>(blocks: string[], items: T[], decided: Map<number, Span[]> = new Map()): T[] {
  return items.map((it, k) => {
    if (!isPlaced(it) || it.kind === "hinweis" || setAside(it)) return it;
    const text = blocks[it.block] ?? "";
    const others: Span[] = [...items.filter((o, j) => j !== k && isPlaced(o) && o.block === it.block && !setAside(o)).map((o) => ({ start: o.pos_start!, end: o.pos_end! })), ...(decided.get(it.block) ?? [])];
    const t = tidyEdges(text, { start: it.pos_start, end: it.pos_end, replacement: it.replacement }, (r) => !others.some((o) => o.start < r.end && r.start < o.end));
    if (t.start === it.pos_start && t.end === it.pos_end && t.replacement === it.replacement) return it;
    return { ...it, pos_start: t.start, pos_end: t.end, quote: text.slice(t.start, t.end), replacement: t.replacement };
  });
}

/**
 * Marks for the teacher what the program can see is off: a category or explanation that does not fit
 * the change, a place that could not be found, a new subject in German, two suggestions on the same words, and what is wrong in
 * the text once every suggestion is applied (a doubled word, a small letter at a sentence start, a
 * doubled sign) next to a suggestion. A suggestion that would damage the text at its place (replacementProblem) is set
 * aside as not applicable, also one the second check sorted out (it could be brought back).
 */
export function flagItems<T extends CheckItem>(blocks: string[], items: T[], o: { english: boolean }): T[] {
  const out = items.map((it) => {
    if (it.kind === "hinweis") return it;
    const unfit = isPlaced(it) ? replacementProblem(blocks[it.block] ?? "", { start: it.pos_start, end: it.pos_end, replacement: it.replacement, quote: it.quote }) : null;
    if (unfit) return notApplicable(it, unfit);
    if (setAside(it)) return it;
    if (!isPlaced(it)) return withNote(it, "Die Stelle wurde im Text nicht gefunden.");
    const why = mismatchOf(it);
    const marked = why ? withNote(it, why) : it;
    const subject = o.english ? null : newSubjectOf(it.quote, it.replacement);
    return subject ? withNote(marked, subject) : marked;
  });
  blocks.forEach((text, b) => {
    const mine = out.map((it, k) => ({ it, k })).filter(({ it }) => isPlaced(it) && it.block === b && !setAside(it) && it.kind !== "hinweis");
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
  const spelling = items.filter((i): i is CheckItem & { block: number; pos_start: number; pos_end: number } => isPlaced(i) && i.category === "rechtschreibung" && !setAside(i));
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
