/**
 * Print settings of a Textarbeit on A4 (app/arbeitsblatt/text/[id]). Like the worksheet settings
 * (lib/arbeitsblatt.ts), they live in the URL, so a reload or a shared link prints the same thing.
 */

export type Spacing = "normal" | "weit";
/** Which text of a correction is printed: the student's, the corrected one, or the student's with the corrections marked. */
export type Fassung = "original" | "endfassung" | "korrektur";
/** Bildgeschichte: the written story, or an empty worksheet (pictures, task and lines) to write on paper. */
export type Blatt = "geschichte" | "leer";
export type TextPrintOptions = {
  title: string;
  /** a correction of the text (its id); without one the current text is printed as before */
  correction: number | null;
  fassung: Fassung;
  /** a short overview of the accepted errors with explanations under the text */
  overview: boolean;
  blatt: Blatt;
  name: boolean;
  date: boolean;
  subject: boolean;
  prompt: boolean;
  words: boolean;
  pages: boolean;
  spacing: Spacing;
};

const DEFAULTS: Omit<TextPrintOptions, "title"> = { correction: null, fassung: "original", overview: false, blatt: "geschichte", name: true, date: true, subject: true, prompt: true, words: false, pages: true, spacing: "normal" };

type BoolKey = "name" | "date" | "subject" | "prompt" | "words" | "pages";
export const TEXT_PRINT_CHECKS: [BoolKey, string, string][] = [
  ["name", "name", "Schülername"],
  ["date", "datum", "Datum"],
  ["subject", "fach", "Fach und Textsorte"],
  ["prompt", "aufgabe", "Aufgabenstellung"],
  ["words", "woerter", "Wortanzahl"],
  ["pages", "seiten", "Seitenzahlen"],
];
export const SPACING_LABEL: Record<Spacing, string> = { normal: "normal", weit: "weit (Platz zum Korrigieren)" };
export const BLATT_LABEL: Record<Blatt, string> = { geschichte: "Fertige Bildgeschichte", leer: "Leeres Arbeitsblatt zum Schreiben" };
export const FASSUNG_LABEL: Record<Fassung, string> = { original: "Original (wie geschrieben)", endfassung: "Korrigierte Endfassung", korrektur: "Mit sichtbaren Korrekturen" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function readTextPrintOptions(sp: Params, defaultTitle: string): TextPrintOptions {
  const o: TextPrintOptions = { ...DEFAULTS, title: one(sp.titel)?.trim().slice(0, 140) || defaultTitle };
  for (const [k, param] of TEXT_PRINT_CHECKS) {
    const v = one(sp[param]);
    if (v === "1" || v === "0") o[k] = v === "1";
  }
  if (one(sp.abstand) === "weit") o.spacing = "weit";
  if (one(sp.blatt) === "leer") o.blatt = "leer";
  const k = Number(one(sp.k));
  if (Number.isInteger(k) && k > 0) o.correction = k;
  const f = one(sp.fassung);
  if (o.correction && (f === "endfassung" || f === "korrektur")) o.fassung = f;
  o.overview = Boolean(o.correction) && one(sp.uebersicht) === "1";
  return o;
}

/** Query string of the settings that differ from the defaults (and the title, if changed). */
export function textPrintQuery(o: TextPrintOptions, defaultTitle: string): string {
  const q = new URLSearchParams();
  if (o.title !== defaultTitle) q.set("titel", o.title);
  for (const [k, param] of TEXT_PRINT_CHECKS) if (o[k] !== DEFAULTS[k]) q.set(param, o[k] ? "1" : "0");
  if (o.spacing !== DEFAULTS.spacing) q.set("abstand", o.spacing);
  if (o.blatt !== DEFAULTS.blatt) q.set("blatt", o.blatt);
  if (o.correction) {
    q.set("k", String(o.correction));
    if (o.fassung !== "original") q.set("fassung", o.fassung);
    if (o.overview) q.set("uebersicht", "1");
  }
  return q.toString();
}
