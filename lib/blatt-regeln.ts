/**
 * Die Regeln von „Gelöstes Blatt einlesen“ (lib/blatt-einlesen.ts) ohne Datenbank, damit auch die Vorschau im
 * Browser sie benutzen kann: was eine Zeile ist, die Bewertungen und wie die erreichten Punkte zählen.
 */

/** So viele Seiten liest die KI auf einmal. */
export const MAX_SEITEN = 4;
/** So viele Aufgaben hat ein Blatt höchstens. */
export const MAX_ZEILEN = 40;

export const BEWERTUNGEN = ["richtig", "teilweise", "falsch", "leer"] as const;
export type Bewertung = (typeof BEWERTUNGEN)[number];
export const istBewertung = (x: unknown): x is Bewertung => BEWERTUNGEN.includes(x as Bewertung);

/** Eine Aufgabe des Blatts, wie sie die Vorschau zeigt und der Lehrer sie übernimmt. */
export type BlattZeile = {
  nr: string;
  aufgabe: string;
  antwort: string;
  bewertung: Bewertung;
  /** erreichte Punkte, wenn sie bekannt sind */
  punkte: number | null;
  /** Höchstpunkte, wenn sie bekannt sind */
  max: number | null;
  skillId: string | null;
  fehler: string;
  /** die KI war sich nicht sicher, oder die Fähigkeit ist nur aus dem Thema geraten */
  pruefen: boolean;
};

export type BlattVorschlag = { titel: string; zeilen: BlattZeile[]; gesamt: number | null; gesamtMax: number | null; note: number | null; hinweise: string[] };

/** Die erreichten Punkte einer Zeile: vom Blatt, sonst aus der Bewertung (teilweise = die Hälfte), sonst null. */
export function erreichtVon(z: Pick<BlattZeile, "punkte" | "max" | "bewertung">): number | null {
  if (z.punkte != null) return z.punkte;
  if (z.max == null) return null;
  return z.bewertung === "richtig" ? z.max : z.bewertung === "teilweise" ? Math.round(z.max) / 2 : 0;
}
