/**
 * Print settings of a Textarbeit on A4 (app/arbeitsblatt/text/[id]). Like the worksheet settings
 * (lib/arbeitsblatt.ts), they live in the URL, so a reload or a shared link prints the same thing.
 */

export type Spacing = "normal" | "weit";
export type TextPrintOptions = {
  title: string;
  name: boolean;
  date: boolean;
  subject: boolean;
  prompt: boolean;
  words: boolean;
  pages: boolean;
  spacing: Spacing;
};

const DEFAULTS: Omit<TextPrintOptions, "title"> = { name: true, date: true, subject: true, prompt: true, words: false, pages: true, spacing: "normal" };

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

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function readTextPrintOptions(sp: Params, defaultTitle: string): TextPrintOptions {
  const o: TextPrintOptions = { ...DEFAULTS, title: one(sp.titel)?.trim().slice(0, 140) || defaultTitle };
  for (const [k, param] of TEXT_PRINT_CHECKS) {
    const v = one(sp[param]);
    if (v === "1" || v === "0") o[k] = v === "1";
  }
  if (one(sp.abstand) === "weit") o.spacing = "weit";
  return o;
}

/** Query string of the settings that differ from the defaults (and the title, if changed). */
export function textPrintQuery(o: TextPrintOptions, defaultTitle: string): string {
  const q = new URLSearchParams();
  if (o.title !== defaultTitle) q.set("titel", o.title);
  for (const [k, param] of TEXT_PRINT_CHECKS) if (o[k] !== DEFAULTS[k]) q.set(param, o[k] ? "1" : "0");
  if (o.spacing !== DEFAULTS.spacing) q.set("abstand", o.spacing);
  return q.toString();
}
