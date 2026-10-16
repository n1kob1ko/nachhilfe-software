/**
 * Der Blätter-Katalog: was es gibt und was geplant ist.
 *
 * Port von `aufgaben_webseite/src/catalog/generators.ts` (Merge-Plan §3.2, §4
 * Phase 5 Schritt 3). Die Quelle hielt die Einträge ohne Text und holte die
 * Beschriftung aus dem i18n-Katalog; hier steht sie inline — dieses Repo ist
 * deutsch, eine Übersetzungsschicht gibt es nicht (D6).
 *
 * Die geplanten Einträge sind ein **Zurückstand**, kein Versprechen: Sie werden
 * angezeigt, damit die Ideen im Produkt stehen und nicht nur in einer Datei, und
 * sie sind nicht anklickbar. Kommt ein Eintrag dazu, wandert er von `GEPLANT` nach
 * `BLATTARTEN` und bekommt eine Route.
 *
 * `docs/druckblatt.md` (Phase 5 Schritt 8) übernimmt diese Liste als Anhang.
 */

export interface BlattEintrag {
  /** Slug, erscheint in der Adresse: /blaetter/<id> */
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  /** Klassenstufen, für die das Blatt gedacht ist. */
  readonly klasse: string;
  readonly fach: string;
}

/** Die drei Generatoren, die es gibt. */
export const VERFUEGBAR: readonly BlattEintrag[] = [
  {
    id: "lesetabelle",
    label: "Lesetabelle",
    hint: "Silben oder Wörter in einem gleichmäßigen Raster, laut zu lesen. Silbenmatrix mit Anlauten und Vokalen oder eine eigene Wortliste.",
    klasse: "Klasse 1–2",
    fach: "Deutsch",
  },
  {
    id: "satzbaukasten",
    label: "Satzbaukasten",
    hint: "Spalten mit Wörtern oder Satzteilen, aus denen Sätze zusammengesetzt werden — darunter Zeilen zum Aufschreiben.",
    klasse: "Klasse 1–3",
    fach: "Deutsch",
  },
  {
    id: "nachmalblatt",
    label: "Nachmalblatt",
    hint: "Buchstaben, Silben oder Wörter zum Nachspuren; die Hilfe nimmt von Zeile zu Zeile ab. Lineatur und Schulschrift sind einstellbar.",
    klasse: "Klasse 1–3",
    fach: "Deutsch",
  },
];

/** Was geplant ist — sichtbar, aber nicht nutzbar. */
export const GEPLANT: readonly BlattEintrag[] = [
  { id: "schreiblinien", label: "Schreiblinien", hint: "Leere Zeilen in der gewählten Lineatur, für freie Schreibübungen.", klasse: "Klasse 1–4", fach: "Deutsch" },
  { id: "lueckentext", label: "Lückentext", hint: "Ein Text mit Lücken, die Wörter stehen als Auswahl darüber.", klasse: "Klasse 2–7", fach: "Deutsch" },
  { id: "wortarten", label: "Wortarten", hint: "Nomen, Verben, Adjektive in einer Tabelle zum Zuordnen.", klasse: "Klasse 3–6", fach: "Deutsch" },
  { id: "rechenpaeckchen", label: "Rechenpäckchen", hint: "Aufgabenreihen mit gleichbleibender Struktur zum Üben eines Rechenwegs.", klasse: "Klasse 1–6", fach: "Mathematik" },
  { id: "einmaleins", label: "Einmaleins", hint: "Reihen des kleinen Einmaleins als Raster zum Ausfüllen.", klasse: "Klasse 2–4", fach: "Mathematik" },
  { id: "zahlenmauern", label: "Zahlenmauern", hint: "Mauern aus additiven Nachbarn, mit und ohne Vorgaben.", klasse: "Klasse 1–4", fach: "Mathematik" },
  { id: "groessen", label: "Größen und Einheiten", hint: "Umrechnen von Länge, Masse, Zeit und Volumen.", klasse: "Klasse 3–7", fach: "Mathematik" },
  { id: "vokabelblatt", label: "Vokabelblatt", hint: "Zwei Spalten zum Falten: Englisch und Deutsch nebeneinander.", klasse: "Klasse 3–10", fach: "Englisch" },
  { id: "irregular-verbs", label: "Irregular verbs", hint: "Grundform, Vergangenheit und Partizip als Tabelle zum Ausfüllen.", klasse: "Klasse 5–10", fach: "Englisch" },
  { id: "wortsuchraetsel", label: "Wortsuchrätsel", hint: "Wörter im Buchstabengitter wiederfinden.", klasse: "Klasse 2–8", fach: "Englisch" },
  { id: "stumme-karte", label: "Stumme Karte", hint: "Eine Karte ohne Beschriftung zum Eintragen.", klasse: "Klasse 3–8", fach: "Sachkunde" },
  { id: "beschriften", label: "Beschriften", hint: "Ein Schaubild mit leeren Feldern und einer Wortbank.", klasse: "Klasse 3–8", fach: "Sachkunde" },
  { id: "zeitleiste", label: "Zeitleiste", hint: "Ereignisse in der richtigen Reihenfolge eintragen.", klasse: "Klasse 5–10", fach: "Sachkunde" },
  { id: "zuordnung", label: "Zuordnung", hint: "Begriffe und Bilder mit Linien verbinden.", klasse: "Klasse 2–10", fach: "Sachkunde" },
];

/** Die Fächer in der Reihenfolge, in der die Oberfläche sie zeigt. */
export const FAECHER = ["Deutsch", "Mathematik", "Englisch", "Sachkunde"] as const;
export type Fach = (typeof FAECHER)[number];

/** Die geplanten Blätter nach Fach gruppiert — so, wie die Übersicht sie zeigt. */
export function geplanteNachFach(): readonly { fach: Fach; eintraege: readonly BlattEintrag[] }[] {
  return FAECHER.map((fach) => ({
    fach,
    eintraege: GEPLANT.filter((eintrag) => eintrag.fach === fach),
  })).filter((gruppe) => gruppe.eintraege.length > 0);
}
