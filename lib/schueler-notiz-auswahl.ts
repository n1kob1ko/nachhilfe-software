/** Die festen Antworten der Notiz nach der Einheit (lib/schueler-notiz.ts), ohne Datenbank: auch für die Schüler-App im Browser. */

/** Die Antworten zum Antippen, in den Worten des Schülers. „nichts“ steht allein. */
export const NOTIZ_AUSWAHL = [
  ["verstanden", "Ich habe etwas nicht verstanden"],
  ["schnell", "Es ging mir zu schnell"],
  ["aufgaben", "Die Aufgaben waren schwer"],
  ["fragen", "Ich habe mich nicht zu fragen getraut"],
  ["nichts", "Nichts, alles gut"],
] as const;
export type NotizWahl = (typeof NOTIZ_AUSWAHL)[number][0];
const LABEL = new Map<string, string>(NOTIZ_AUSWAHL);
export const notizLabel = (w: NotizWahl) => LABEL.get(w)!;

/** Höchstlänge des freien Texts. */
export const NOTIZ_TEXT_MAX = 500;

/** Nur bekannte Antworten, jede einmal, in der Reihenfolge der Liste; „nichts“ nur, wenn sonst nichts gewählt ist. */
export function bereinigeAuswahl(werte: unknown[]): NotizWahl[] {
  const da = new Set(werte.map(String));
  const out = NOTIZ_AUSWAHL.map(([k]) => k).filter((k) => da.has(k));
  return out.length > 1 ? out.filter((k) => k !== "nichts") : out;
}

export const bereinigeText = (t: string) => t.replace(/\r\n/g, "\n").trim().slice(0, NOTIZ_TEXT_MAX);
