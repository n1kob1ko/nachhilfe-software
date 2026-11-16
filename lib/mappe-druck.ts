/**
 * Druckeinstellungen der Mappe einer Einheit (app/arbeitsblatt/einheit/[id], lib/mappe.ts). Wie beim
 * Arbeitsblatt (lib/arbeitsblatt.ts) stehen sie in der Adresse, damit ein Neuladen oder ein geteilter
 * Link dasselbe druckt. Ohne Datenbank, weil auch die Einstellungen im Browser sie brauchen.
 */

/** Was auf die Mappe kommt. */
export type MappeOptionen = {
  title: string;
  name: boolean;
  date: boolean;
  /** Häkchen und Kreuze neben den Antworten */
  marks: boolean;
  /** die richtige Lösung unter falschen Antworten */
  solutions: boolean;
  /** nicht bearbeitete Aufgaben mit Platz zum Weiterüben */
  open: boolean;
  texts: boolean;
  board: boolean;
  logo: boolean;
  pages: boolean;
};

type BoolKey = Exclude<keyof MappeOptionen, "title">;
// das Datum steht schon im Titel; das Feld „Datum“ nur auf Wunsch (z. B. bei einem eigenen Titel)
const DEFAULTS: Omit<MappeOptionen, "title"> = { name: true, date: false, marks: true, solutions: true, open: false, texts: true, board: true, logo: true, pages: true };

export const MAPPE_CHECKS: [BoolKey, string, string][] = [
  ["marks", "haken", "Häkchen und Kreuze"],
  ["solutions", "loesung", "Richtige Lösung bei Fehlern"],
  ["open", "offen", "Nicht bearbeitete Aufgaben zum Weiterüben"],
  ["texts", "texte", "Textarbeiten"],
  ["board", "tafel", "Whiteboard"],
  ["name", "name", "Schülername"],
  ["date", "datum", "Datum"],
  ["logo", "logo", "Logo"],
  ["pages", "seiten", "Seitenzahlen"],
];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Eigene Standardwerte, z. B. für das einzelne ausgefüllte Blatt (lib/blatt-druck.ts): alle Aufgaben und das Datum. */
export type MappeStandard = Partial<Omit<MappeOptionen, "title">>;
export const BLATT_STANDARD: MappeStandard = { open: true, date: true };

export function leseMappeOptionen(sp: Params, defaultTitle: string, standard: MappeStandard = {}): MappeOptionen {
  const o: MappeOptionen = { ...DEFAULTS, ...standard, title: one(sp.titel)?.trim().slice(0, 140) || defaultTitle };
  for (const [k, param] of MAPPE_CHECKS) {
    const v = one(sp[param]);
    if (v === "1" || v === "0") o[k] = v === "1";
  }
  return o;
}

/** Abfrage aus den Einstellungen, die vom Standard abweichen (und dem Titel, wenn geändert). */
export function mappeQuery(o: MappeOptionen, defaultTitle: string, standard: MappeStandard = {}): string {
  const d = { ...DEFAULTS, ...standard };
  const q = new URLSearchParams();
  if (o.title !== defaultTitle) q.set("titel", o.title);
  for (const [k, param] of MAPPE_CHECKS) if (o[k] !== d[k]) q.set(param, o[k] ? "1" : "0");
  return q.toString();
}
