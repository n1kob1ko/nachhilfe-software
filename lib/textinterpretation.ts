/**
 * Textinterpretation (Oberstufe, SRDP): the student interprets a whole story of about 100 lines in about
 * 500 words, quoting with line numbers („…“ (Z. 12)). The assignment is a Textarbeit (lib/texts.ts, Textsorte
 * "Textinterpretation"); the story the teacher pasted lives in lib/textinterpretation-store.ts.
 *
 * Everything here is pure and works without KI, in the browser and on the server: the line numbering, the
 * Schreibplan with its word budget, the default Arbeitsauftrag, the Hinweise on a written text and the short
 * Teilübungen the builder makes for one part of an interpretation.
 *
 * The Hinweise are hints, never a grade. Anything that could be right is never called wrong: a quote that
 * is not found word for word (shortened, adapted to the sentence) is simply not checked.
 */
import { blockText, countWords, type TextDoc } from "./text-doc";
import type { TaskDraft } from "./tasks";
import { BEISPIEL_GESCHICHTE, BEISPIEL_QUELLE } from "./textinterpretation-beispiel";

export const INTERPRETATION_KIND = "Textinterpretation";
export const TEXTINTERPRETATION_SKILL = "deutsch.os.matura.textinterpretation";
/** The skill itself or one of its Teilfähigkeiten. */
export const isInterpretationSkill = (id: string | null | undefined) => Boolean(id && (id === TEXTINTERPRETATION_SKILL || id.startsWith(`${TEXTINTERPRETATION_SKILL}.`)));

export const DEFAULT_TARGET = 500;
export const MIN_TARGET = 150;
export const MAX_TARGET = 1500;
export const MAX_STORY_CHARS = 40_000;
export const MAX_STORY_LINES = 400;
/** Below this the story is too short for an interpretation with line numbers. */
export const MIN_STORY_LINES = 5;

/** Kinds of text that are interpreted, with the forms the Arbeitsauftrag needs. */
export const STORY_KINDS = {
  Kurzgeschichte: { zu: "zur", des: "der Kurzgeschichte" },
  Erzählung: { zu: "zur", des: "der Erzählung" },
  Parabel: { zu: "zur", des: "der Parabel" },
  Anekdote: { zu: "zur", des: "der Anekdote" },
  Fabel: { zu: "zur", des: "der Fabel" },
  Märchen: { zu: "zum", des: "des Märchens" },
  Romanauszug: { zu: "zum", des: "des Romanauszugs" },
} as const;
export type StoryKind = keyof typeof STORY_KINDS;
export const isStoryKind = (x: unknown): x is StoryKind => typeof x === "string" && x in STORY_KINDS;

// ---------- the story and its line numbers ----------

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F­​]/g;

/**
 * The story as pasted: line breaks stay exactly where they were. Only Windows line ends, control
 * characters, spaces at the end of a line and empty lines before the first and after the last line go.
 */
export function cleanStory(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/\t/g, "    ")
    .split("\n")
    .map((l) => l.replace(/\s+$/u, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/** One printed line: its number (null for an empty line that is not counted) and whether the number is shown. */
export type StoryLine = { n: number | null; text: string; shown: boolean };

/**
 * The lines of the story with their numbers. Empty lines are not counted unless `countBlank` (then they
 * get a number like every other line). A number is shown every 5 lines (5, 10, 15, …), as on a school sheet.
 */
export function numberedLines(text: string, countBlank = false): StoryLine[] {
  const clean = cleanStory(text);
  if (!clean) return [];
  let n = 0;
  return clean.split("\n").map((line) => {
    if (!line.trim() && !countBlank) return { n: null, text: "", shown: false };
    n++;
    return { n, text: line, shown: n % 5 === 0 };
  });
}

/** The number of the last line. */
export const lastLine = (lines: StoryLine[]) => lines.reduce((m, l) => (l.n !== null && l.n > m ? l.n : m), 0);

/** "Z. 5", "Z. 38f.", "Z. 11–13". */
export function lineLabel(from: number, to = from): string {
  if (to <= from) return `Z. ${from}`;
  if (to === from + 1) return `Z. ${from}f.`;
  return `Z. ${from}–${to}`;
}

// ---------- Schreibplan and word budget ----------

export type TeilKey = "einleitung" | "inhalt" | "form" | "sprache" | "figur" | "deutung" | "schluss";
export type PlanPart = { key: TeilKey; title: string; hint: string; words: number };

/** The seven parts of a school interpretation, with their share of the words. */
const PARTS: { key: TeilKey; title: string; share: number; hint: (k: StoryKind) => string }[] = [
  { key: "einleitung", title: "Einleitung", share: 0.1, hint: () => "Autor oder Autorin, Titel, Textsorte, Thema, wenn bekannt das Erscheinungsjahr. Am Ende deine Deutungshypothese: Was will der Text wohl zeigen?" },
  { key: "inhalt", title: "Inhaltsangabe", share: 0.15, hint: () => "Kurz und im Präsens. Nur das Wichtigste, ohne Zitate und ohne Wertung." },
  { key: "form", title: "Form und Aufbau", share: 0.15, hint: (k) => `Erzählform und Aufbau (z. B. kreisförmig: Anfang und Ende spiegeln sich). Merkmale ${STORY_KINDS[k].des}. Abschnitte mit Zeilen, z. B. Z. 1–23, Z. 24–40, Z. 41 ff.` },
  { key: "sprache", title: "Sprache", share: 0.2, hint: () => "Wortwahl (z. B. Dialekt, veraltete Wörter), Satzbau (lange und kurze Sätze), Stilmittel. Immer: Zitat, Zeile und Wirkung." },
  { key: "figur", title: "Figur", share: 0.15, hint: () => "Charakterisiere die Hauptfigur: Wie ist sie, was tut sie, warum? Belege mit Zitaten und Zeilen." },
  { key: "deutung", title: "Deutung", share: 0.15, hint: () => "Was will der Text aussagen? Welche Kritik steckt darin? Was bedeutet der Titel?" },
  { key: "schluss", title: "Schluss", share: 0.1, hint: () => "Fasse deine Deutung zusammen und nimm begründet Stellung: Wie wirkt der Text auf dich?" },
];
export const TEIL_TITLES: Record<TeilKey, string> = Object.fromEntries(PARTS.map((p) => [p.key, p.title])) as Record<TeilKey, string>;
export const TEIL_KEYS = PARTS.map((p) => p.key);
export const isTeil = (x: unknown): x is TeilKey => typeof x === "string" && (TEIL_KEYS as string[]).includes(x);

const round5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);

/** The target in words within the limits; anything unreadable is the default of 500. */
export function cleanTarget(v: unknown): number {
  const n = Math.round(Number(String(v ?? "").trim()));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TARGET;
  return Math.max(MIN_TARGET, Math.min(MAX_TARGET, n));
}

/** The seven parts with a rough word budget each (rounded to 5). */
export function schreibplan(target = DEFAULT_TARGET, kind: StoryKind = "Kurzgeschichte"): PlanPart[] {
  const t = cleanTarget(target);
  return PARTS.map((p) => ({ key: p.key, title: p.title, hint: p.hint(kind), words: round5(t * p.share) }));
}

/** The range the Arbeitsauftrag names: 10 % below and above the target, in tens (500: 450 to 550). */
export function wordRange(target = DEFAULT_TARGET): { min: number; max: number } {
  const t = cleanTarget(target);
  return { min: Math.round((t * 0.9) / 10) * 10, max: Math.round((t * 1.1) / 10) * 10 };
}

/** A story to interpret as the writing view, the print and the hints need it (lib/textinterpretation-store.ts). */
export type InterpretationView = { title: string; author: string; year: string; kind: StoryKind; text: string; countBlank: boolean; target: number };

// ---------- the Arbeitsauftrag ----------

export type StoryInfo = { title: string; author: string; year: string; kind: StoryKind; target: number };

/** „Sieben Uhr zwölf“ von Ida Brunnhofer (2026) */
export function storyReference(s: Pick<StoryInfo, "title" | "author" | "year">): string {
  return [`„${s.title.trim()}“`, s.author.trim() ? `von ${s.author.trim()}` : "", s.year.trim() ? `(${s.year.trim()})` : ""].filter(Boolean).join(" ");
}

/**
 * The Arbeitsauftrag in the style of a Schularbeit or the SRDP: the Textsorte, the text it is about, four
 * Arbeitsaufträge and the word range. The teacher can change it before and after the text is created.
 */
export function defaultArbeitsauftrag(s: StoryInfo): string {
  const k = STORY_KINDS[s.kind] ?? STORY_KINDS.Kurzgeschichte;
  const { min, max } = wordRange(s.target);
  return [
    `Verfasse eine Textinterpretation ${k.zu} ${s.kind} ${storyReference(s)}.`,
    "Bearbeite dabei die folgenden Arbeitsaufträge:",
    `• Fasse den Inhalt ${k.des} kurz zusammen.`,
    "• Untersuche den Aufbau und die sprachliche Gestaltung. Belege deine Aussagen mit Zitaten und Zeilenangaben.",
    "• Charakterisiere die Hauptfigur und deute die Aussageabsicht des Textes, auch mit Blick auf den Titel.",
    "• Nimm begründet Stellung zur Wirkung des Textes.",
    `Schreib zwischen ${min} und ${max} Wörter.`,
  ].join("\n");
}

// ---------- finding quotes in the story ----------

const isWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);

/** Lower case, letters and digits only, one space between words: how a quote and the story are compared. */
export function bareText(s: string): string {
  let out = "";
  for (const c of s.normalize("NFC").toLowerCase().replace(CONTROL, "")) {
    if (isWordChar(c)) out += c;
    else if (out && !out.endsWith(" ")) out += " ";
  }
  return out.trim();
}

type StoryIndex = { text: string; line: number[] };

/**
 * The story as one long bare string with the line of every character, once with the lines simply joined
 * and once with a word that is split at the end of a line ("Haltestel-" / "le") joined again.
 */
function storyIndexes(lines: StoryLine[]): StoryIndex[] {
  const numbered = lines.filter((l) => l.n !== null);
  const build = (dehyphen: boolean): StoryIndex => {
    let text = "";
    const line: number[] = [];
    // the line before ended with a split word: this one goes on without a space
    let glue = false;
    numbered.forEach((l, i) => {
      let raw = l.text;
      const next = numbered[i + 1]?.text.trimStart() ?? "";
      const split = dehyphen && /\p{L}-$/u.test(raw) && /^\p{Ll}/u.test(next);
      if (split) raw = raw.slice(0, -1);
      const bare = bareText(raw);
      if (!bare) {
        glue = false;
        return;
      }
      if (text && !glue) {
        text += " ";
        line.push(l.n!);
      }
      text += bare;
      for (let k = 0; k < bare.length; k++) line.push(l.n!);
      glue = split;
    });
    return { text, line };
  };
  return [build(false), build(true)];
}

/** Every place a quote stands in the story word for word, as line ranges; empty when it is not found. */
export function findInStory(lines: StoryLine[], quote: string): { from: number; to: number }[] {
  const q = bareText(quote);
  if (q.length < 3) return [];
  const out: { from: number; to: number }[] = [];
  for (const idx of storyIndexes(lines)) {
    let at = idx.text.indexOf(q);
    while (at >= 0) {
      // whole words only: "er" is not found inside "aber"
      const before = at === 0 || idx.text[at - 1] === " ";
      const after = at + q.length === idx.text.length || idx.text[at + q.length] === " ";
      if (before && after) {
        const r = { from: idx.line[at], to: idx.line[at + q.length - 1] };
        if (!out.some((o) => o.from === r.from && o.to === r.to)) out.push(r);
      }
      at = idx.text.indexOf(q, at + 1);
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

// ---------- quotes and line references in the student's text ----------

export type LineRef = { from: number; to: number | "ff" };
export type Quote = { text: string; paragraph: number; refs: LineRef[]; hasRef: boolean };

const CLOSERS: Record<string, string[]> = { "„": ["“", "”", '"'], "“": ["”", "“", '"'], '"': ['"', "“", "”"], "»": ["«"], "«": ["»"] };
const MAX_QUOTE = 600;

/** Line references in a piece of text: "Z. 12", "Z. 100f.", "Z. 12 ff.", "Z. 11–13", "Zeile 5 bis 7", "Z. 20, 61". */
export function parseLineRefs(s: string): LineRef[] {
  const start = s.search(/\b(?:Z|Zl|Zeilen?)\.?\s*(?=\d)/i);
  if (start < 0) return [];
  const out: LineRef[] = [];
  const rest = s.slice(start).replace(/^(?:Z|Zl|Zeilen?)\.?\s*/i, "");
  for (const m of rest.matchAll(/(\d{1,4})\s*(?:(ff\.?)|(f\.)|(?:[-–]|bis)\s*(?:Z\.\s*|Zeile\s*)?(\d{1,4}))?/g)) {
    const from = Number(m[1]);
    if (m[2]) out.push({ from, to: "ff" });
    else if (m[3]) out.push({ from, to: from + 1 });
    else if (m[4]) out.push({ from, to: Math.max(from, Number(m[4])) });
    else out.push({ from, to: from });
    // stop after the reference: "(Z. 12) und 3 Sätze" does not make 3 a line
    const after = rest.slice((m.index ?? 0) + m[0].length);
    if (!/^\s*(?:,|und|u\.)\s*(?:Z\.\s*)?\d/.test(after)) break;
  }
  return out;
}

const REF_MARK = /\b(?:Z|Zl|Zeilen?|V|Vers|Verse)\.?\s*\d|\bebd\.?/i;

/** The quotes of one paragraph with the line references right after (or just before) them. */
function quotesIn(p: string, paragraph: number): Quote[] {
  const out: Quote[] = [];
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    const closers = CLOSERS[c];
    if (!closers) {
      i++;
      continue;
    }
    let end = -1;
    for (let j = i + 1; j < Math.min(p.length, i + 1 + MAX_QUOTE); j++) {
      if (closers.includes(p[j])) {
        end = j;
        break;
      }
    }
    if (end < 0) {
      i++;
      continue;
    }
    const text = p.slice(i + 1, end).trim();
    const after = p.slice(end + 1, end + 70);
    const paren = after.match(/^\s*[,.;:!?]?\s*\(([^()]{0,60})\)/);
    const bare = after.match(/^\s*[,;:]?\s*(?:in\s+|vgl\.\s*)?((?:Z|Zl|Zeilen?)\.?\s*\d{1,4}(?:\s*(?:ff?\.|[-–]\s*\d{1,4}|bis\s*\d{1,4}))?)/i);
    const before = p.slice(Math.max(0, i - 60), i).match(/((?:Z|Zl|Zeilen?)\.?\s*\d{1,4}(?:\s*(?:ff?\.|[-–]\s*\d{1,4}))?)[^„“”"»«()]{0,40}$/i);
    const refText = paren && REF_MARK.test(paren[1]) ? paren[1] : bare ? bare[1] : before ? before[1] : "";
    if (text) out.push({ text, paragraph, refs: parseLineRefs(refText), hasRef: Boolean(refText) });
    i = end + 1;
  }
  return out;
}

/** All quotes of a text, paragraph by paragraph. */
export function quotesOf(doc: TextDoc): Quote[] {
  return doc.flatMap((b, i) => quotesIn(blockText(b), i + 1));
}

// ---------- Hinweise ----------

export type HinweisTone = "gut" | "tipp" | "info";
export type Hinweis = { key: "umfang" | "einleitung" | "zitate" | "zeilen" | "stelle" | "absaetze"; tone: HinweisTone; text: string };

export type HinweisInfo = { title: string; author: string; target: number; lines: StoryLine[] };

const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("de-AT")} ${n === 1 ? one : many}`;

/** The paragraphs a reader sees: blocks with text, headings included. */
const paragraphs = (doc: TextDoc) => doc.map(blockText).filter((t) => t.trim());

/** The surname of an author ("Ida Brunnhofer" → "brunnhofer"); empty without author. */
function surname(author: string): string {
  const parts = bareText(author.replace(/\(.*?\)/g, "")).split(" ").filter(Boolean);
  return parts.at(-1) ?? "";
}
const STOP = new Set(["der", "die", "das", "ein", "eine", "einer", "und", "the", "a", "an", "of", "von", "vom", "zum", "zur", "im", "am", "in"]);

/** Does the text name the title: word for word, or with all its content words? */
function namesTitle(text: string, title: string): boolean {
  const t = bareText(title);
  if (!t) return true;
  const hay = ` ${bareText(text)} `;
  if (hay.includes(` ${t} `)) return true;
  const words = t.split(" ").filter((w) => w.length >= 3 && !STOP.has(w));
  return words.length > 0 && words.every((w) => hay.includes(` ${w} `) || hay.includes(` ${w}s `));
}
function namesAuthor(text: string, author: string): boolean {
  const name = surname(author);
  if (!name) return true;
  const hay = ` ${bareText(text)} `;
  // the genitive too: "Brunnhofers Kurzgeschichte"
  return hay.includes(` ${name} `) || hay.includes(` ${name}s `);
}

/** The opening of the text: up to and including the first paragraph with some substance (a heading line before it counts too). */
function opening(doc: TextDoc): string {
  const ps = paragraphs(doc);
  const out: string[] = [];
  for (const p of ps) {
    out.push(p);
    if (countWords(p) >= 15) break;
  }
  return out.join("\n");
}

/**
 * Hinweise on a written interpretation, without KI. They only point at things to look at again: the
 * length against the target, whether the opening names author and title, how many quotes have a line
 * number, line numbers the story does not have, quotes found word for word at another place than given,
 * and the number of paragraphs. A quote that is not found word for word is never questioned.
 */
export function hinweise(doc: TextDoc, info: HinweisInfo): Hinweis[] {
  const out: Hinweis[] = [];
  const words = countWords(doc);
  const target = cleanTarget(info.target);
  const { min, max } = wordRange(target);
  const last = lastLine(info.lines);

  // Umfang
  if (!words) out.push({ key: "umfang", tone: "info", text: `Noch nichts geschrieben. Ziel: ${min} bis ${max} Wörter.` });
  else if (words < min) out.push({ key: "umfang", tone: "info", text: `${plural(words, "Wort", "Wörter")} von ${min} bis ${max}. Es fehlen noch etwa ${(min - words).toLocaleString("de-AT")}.` });
  else if (words <= max) out.push({ key: "umfang", tone: "gut", text: `Der Umfang passt: ${plural(words, "Wort", "Wörter")} (Ziel ${min} bis ${max}).` });
  else out.push({ key: "umfang", tone: "tipp", text: `${plural(words, "Wort", "Wörter")}, etwas mehr als ${max}. Schau, ob du an einer Stelle kürzen kannst.` });
  if (words < 20) return out;

  // Einleitung: author and title in the opening
  const intro = opening(doc);
  const author = namesAuthor(intro, info.author);
  const title = namesTitle(intro, info.title);
  const name = info.author.trim();
  if (author && title) out.push({ key: "einleitung", tone: "gut", text: name ? "Die Einleitung nennt Autor oder Autorin und Titel." : "Die Einleitung nennt den Titel." });
  else if (!author && !title) out.push({ key: "einleitung", tone: "tipp", text: `Im ersten Absatz finde ich weder ${name} noch den Titel „${info.title.trim()}“. Nenn beides gleich am Anfang.` });
  else if (!author) out.push({ key: "einleitung", tone: "tipp", text: `Im ersten Absatz finde ich den Namen ${name} nicht. Nenn ihn in der Einleitung.` });
  else out.push({ key: "einleitung", tone: "tipp", text: `Im ersten Absatz finde ich den Titel „${info.title.trim()}“ nicht. Nenn ihn in der Einleitung.` });

  // Zitate: the title in quotation marks is no quote
  const quotes = quotesOf(doc).filter((q) => bareText(q.text) && bareText(q.text) !== bareText(info.title));
  const withRef = quotes.filter((q) => q.hasRef);
  if (!quotes.length) {
    if (words >= 100) out.push({ key: "zitate", tone: "tipp", text: "Noch keine Zitate. Belege deine Aussagen mit Zitat und Zeile, z. B. „…“ (Z. 12)." });
  } else if (withRef.length === quotes.length) {
    out.push({ key: "zitate", tone: "gut", text: quotes.length === 1 ? "Dein Zitat hat eine Zeilenangabe." : `Alle ${quotes.length} Zitate haben eine Zeilenangabe.` });
  } else {
    const missing = quotes.filter((q) => !q.hasRef);
    out.push({
      key: "zitate",
      tone: "tipp",
      text: `${withRef.length} von ${quotes.length} Zitaten haben eine Zeilenangabe. Ohne Angabe: ${missing.slice(0, 3).map((q) => `„${short(q.text)}“`).join(", ")}${missing.length > 3 ? " …" : ""}`,
    });
  }

  if (last > 0) {
    // line numbers the story does not have (anywhere in the text, not only after quotes)
    const all = paragraphs(doc).join("\n");
    const tooHigh = new Set<number>();
    for (const m of all.matchAll(/\b(?:Z|Zl|Zeilen?)\.?\s*\d{1,4}[^„“”"»«()\n]{0,30}/gi)) {
      for (const r of parseLineRefs(m[0])) {
        if (r.from > last) tooHigh.add(r.from);
        else if (r.to !== "ff" && r.to > last) tooHigh.add(r.to);
      }
    }
    if (tooHigh.size) {
      const list = [...tooHigh].sort((a, b) => a - b).slice(0, 3);
      out.push({ key: "zeilen", tone: "tipp", text: `Der Text hat ${last} Zeilen. Prüf ${list.length === 1 ? "die Angabe" : "die Angaben"} ${list.map((n) => `Z. ${n}`).join(", ")}.` });
    }

    // a quote found word for word, but not where the line number says (one line either way is fine)
    const moved: string[] = [];
    for (const q of withRef) {
      if (!q.refs.length || bareText(q.text).length < 8 || /\[|\(\s*\.\.\.|\.\.\.|…/.test(q.text)) continue;
      const found = findInStory(info.lines, q.text);
      if (!found.length) continue;
      const near = q.refs.some((r) => {
        const to = r.to === "ff" ? last : r.to;
        return found.some((f) => f.to >= r.from - 1 && f.from <= to + 1);
      });
      if (near || q.refs.every((r) => r.from > last)) continue;
      const where = found.slice(0, 2).map((f) => lineLabel(f.from, f.to)).join(" und ");
      moved.push(`„${short(q.text, 40)}“ steht in ${where}`);
    }
    if (moved.length) out.push({ key: "stelle", tone: "tipp", text: `Schau bei diesen Zeilenangaben noch einmal nach: ${moved.slice(0, 3).join("; ")}.` });
  }

  // Absätze
  const ps = paragraphs(doc).length;
  if (words >= target * 0.6 && ps < 5) out.push({ key: "absaetze", tone: "tipp", text: `Dein Text hat ${plural(ps, "Absatz", "Absätze")}. Ein eigener Absatz für jeden Teil des Schreibplans macht den Aufbau sichtbar.` });
  else out.push({ key: "absaetze", tone: ps >= 5 ? "gut" : "info", text: `${plural(ps, "Absatz", "Absätze")}${ps >= 5 ? ": Der Aufbau ist gut zu sehen." : "."}` });
  return out;
}

// ---------- Teilübungen: one part of an interpretation at a time ----------

/** What a Teilübung is about: the story with its numbered lines and, for the example, the model answers. */
export type TeilSource = { title: string; author: string; year: string; kind: StoryKind; text: string; countBlank: boolean; samples?: Partial<Record<TeilKey, string>> };

const TEIL_PROMPTS: Record<TeilKey, ((s: TeilSource, ref: string) => string)[]> = {
  einleitung: [
    (_s, ref) => `Schreib die Einleitung zu einer Interpretation von ${ref}: Autor oder Autorin, Titel, Textsorte und Thema. Schließ mit einer Deutungshypothese ab. (3 bis 4 Sätze)`,
    (_s, ref) => `Formuliere eine Deutungshypothese zu ${ref}: Was will der Text zeigen? Bette sie in eine kurze Einleitung mit Autor, Titel und Thema ein.`,
  ],
  inhalt: [
    (s) => `Fasse den Inhalt von „${s.title}“ in 4 bis 6 Sätzen zusammen. Schreib im Präsens, ohne Zitate und ohne Wertung.`,
    (s) => `Schreib eine kurze Inhaltsangabe zu „${s.title}“ (höchstens 80 Wörter, Präsens). Was passiert, wer handelt, wie endet es?`,
  ],
  form: [
    (s) => `Gliedere „${s.title}“ in drei oder vier Abschnitte. Gib für jeden Abschnitt die Zeilen an (z. B. Z. 1–12) und fasse ihn in einem Satz zusammen.`,
    (s) => `Welche Merkmale ${STORY_KINDS[s.kind].des} findest du in „${s.title}“? Nenne drei und belege jedes mit einer Zeilenangabe.`,
  ],
  sprache: [
    () => "Such zwei Stilmittel im Text. Schreib zu jedem: das Zitat mit Zeilenangabe, den Namen des Stilmittels und seine Wirkung.",
    () => "Untersuche den Satzbau: Wo stehen lange, verschachtelte Sätze, wo kurze Hauptsätze? Zitiere je ein Beispiel mit Zeile und erkläre die Wirkung.",
  ],
  figur: [
    () => "Charakterisiere die Hauptfigur in 4 bis 5 Sätzen. Belege jede Eigenschaft mit einem Zitat und der Zeile.",
    () => "Wie verändert sich die Hauptfigur oder ihre Lage im Lauf des Textes? Belege mit zwei Zitaten und Zeilen.",
  ],
  deutung: [
    (s) => `Was will der Text aussagen? Erkläre auch, was der Titel „${s.title}“ bedeutet. (4 bis 5 Sätze)`,
    () => "Welche Kritik an der Gesellschaft steckt im Text? Begründe mit zwei Textstellen und Zeilen.",
  ],
  schluss: [
    () => "Schreib einen Schluss: Fasse deine Deutung in einem Satz zusammen und nimm begründet Stellung, wie der Text auf dich wirkt.",
    () => "Wie wirkt das Ende des Textes auf dich? Nimm in 3 bis 4 Sätzen begründet Stellung.",
  ],
};

const TEIL_CRITERIA: Record<TeilKey, string[]> = {
  einleitung: ["Autor oder Autorin, Titel und Textsorte genannt", "Thema in einem Satz", "Deutungshypothese am Ende"],
  inhalt: ["Präsens", "nur das Wichtigste, in der richtigen Reihenfolge", "keine Zitate, keine Wertung"],
  form: ["Abschnitte mit Zeilenangaben", "jeder Abschnitt in einem Satz zusammengefasst", "Merkmale der Textsorte erkannt"],
  sprache: ["Zitat wörtlich, mit Zeilenangabe", "Stilmittel richtig benannt", "Wirkung erklärt, nicht nur genannt"],
  figur: ["Eigenschaften genannt", "jede Eigenschaft mit Zitat und Zeile belegt", "Verhalten begründet"],
  deutung: ["Aussageabsicht formuliert", "Bedeutung des Titels erklärt", "mit Textstellen begründet"],
  schluss: ["Gesamtdeutung in einem Satz", "eigene Meinung begründet", "keine neuen Inhalte"],
};
const TEIL_LINES: Record<TeilKey, number> = { einleitung: 6, inhalt: 8, form: 8, sprache: 10, figur: 8, deutung: 8, schluss: 6 };
/** The order Teilübungen come in: the three the school asks most for first. */
export const TEIL_ORDER: TeilKey[] = ["einleitung", "inhalt", "sprache", "form", "figur", "deutung", "schluss"];
export const TEIL_VARIANTS = 2;

/**
 * One Teilübung: a free answer about one part of an interpretation, with the story as shared text with
 * line numbers (data.passage, data.zeilen). Its Erwartungshorizont says what a good answer has; for the
 * example story the model interpretation gives the sample answer.
 */
export function teiluebung(s: TeilSource, teil: TeilKey, variant = 0, o: { skillId?: string; difficulty?: TaskDraft["difficulty"] } = {}): TaskDraft {
  const prompts = TEIL_PROMPTS[teil];
  const ref = [`„${s.title}“`, s.author ? `von ${s.author}` : ""].filter(Boolean).join(" ");
  const prompt = prompts[((variant % prompts.length) + prompts.length) % prompts.length](s, ref);
  const skillId = o.skillId ?? TEXTINTERPRETATION_SKILL;
  const sample = s.samples?.[teil]?.trim() ?? "";
  return {
    type: "free",
    skillId,
    skillIds: [skillId],
    category: "offen",
    difficulty: o.difficulty ?? "mittel",
    prompt,
    data: { passage: cleanStory(s.text), passageTitle: storyReference(s), lines: TEIL_LINES[teil], zeilen: true, ...(s.countBlank ? { leerzeilen: true } : {}), teil, textsorte: s.kind },
    answer: { sample, criteria: TEIL_CRITERIA[teil] },
    solution: "",
    hints: [schreibplan(DEFAULT_TARGET, s.kind).find((p) => p.key === teil)!.hint],
    errorMap: [],
    sourceType: "eigen",
  };
}

/** n Teilübungen in the usual order, the second round with the other wording. */
export function teiluebungen(s: TeilSource, n: number, o: { skillId?: string; difficulty?: TaskDraft["difficulty"]; start?: number } = {}): TaskDraft[] {
  const start = o.start ?? 0;
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const k = start + i;
    return teiluebung(s, TEIL_ORDER[k % TEIL_ORDER.length], Math.floor(k / TEIL_ORDER.length), o);
  });
}
/** At most this many Teilübungen per exercise: every part twice. */
export const MAX_TEILUEBUNGEN = TEIL_ORDER.length * TEIL_VARIANTS;

/** The story of a Teilübung, read back from the task (title, author and year from its heading). */
export function teilSourceFromTask(t: Pick<TaskDraft, "data">): TeilSource | null {
  const text = t.data.passage?.trim();
  if (!text || !isTeil(t.data.teil)) return null;
  const ref = t.data.passageTitle?.trim() ?? "";
  const title = ref.match(/^„(.+?)“/)?.[1] ?? ref;
  const author = ref.match(/“\s+von\s+(.+?)(?:\s+\([^()]*\))?$/)?.[1] ?? "";
  const year = ref.match(/\(([^()]+)\)$/)?.[1] ?? "";
  const example = cleanStory(text) === cleanStory(BEISPIEL_GESCHICHTE);
  return { title, author, year, kind: isStoryKind(t.data.textsorte) ? t.data.textsorte : "Kurzgeschichte", text, countBlank: Boolean(t.data.leerzeilen), ...(example ? { samples: BEISPIEL_QUELLE.samples } : {}) };
}

/** "Neu erstellen" on a Teilübung: the other wording for the same part, about the same story. */
export function nextTeiluebung(t: Pick<TaskDraft, "data" | "prompt" | "skillId" | "difficulty">): TaskDraft | null {
  const source = teilSourceFromTask(t);
  if (!source || !isTeil(t.data.teil)) return null;
  const teil = t.data.teil;
  const now = Array.from({ length: TEIL_VARIANTS }, (_, v) => teiluebung(source, teil, v).prompt).indexOf(t.prompt);
  return teiluebung(source, teil, now + 1, { skillId: t.skillId ?? undefined, difficulty: t.difficulty });
}
