/**
 * Erwartungshorizont und Bewertung eines Schreibauftrags (Plan 4.2): die vier Kriterien der SRDP Deutsch (Inhalt,
 * Textstruktur, Stil und Ausdruck, normative Sprachrichtigkeit), je Kriterium eine Stufe wie die Notenstufen der
 * LBVO, und die Vorlage eines Erwartungshorizonts aus der Textsorte. Rein, ohne Datenbank: Formular, Server und Tests
 * nutzen dasselbe. Gespeichert wird in lib/schreibauftrag-bewertung.ts.
 */
import { planFor, SORTEN, type AuftragView } from "./schreibauftrag";
import { wordRange } from "./textinterpretation";

export const KRITERIEN = [
  { key: "inhalt", name: "Inhalt", frage: "Arbeitsaufträge erfüllt, Bezug zur Textbeilage stimmt, Aussagen begründet" },
  { key: "textstruktur", name: "Textstruktur", frage: "Aufbau der Textsorte, Absätze, Gedankenfolge, Umfang" },
  { key: "stil", name: "Stil und Ausdruck", frage: "Wortwahl, Satzbau, Ton und Merkmale der Textsorte" },
  { key: "sprachrichtigkeit", name: "Normative Sprachrichtigkeit", frage: "Rechtschreibung, Grammatik, Zeichensetzung" },
] as const;
export type KriteriumKey = (typeof KRITERIEN)[number]["key"];
export const KRITERIUM_KEYS = KRITERIEN.map((k) => k.key) as KriteriumKey[];
export const isKriterium = (x: unknown): x is KriteriumKey => typeof x === "string" && (KRITERIUM_KEYS as string[]).includes(x);
export const kriteriumName = (k: KriteriumKey) => KRITERIEN.find((x) => x.key === k)!.name;

/** Die Stufen je Kriterium, wie die Notenstufen der Leistungsbeurteilungsverordnung. */
export const STUFEN = [
  { wert: 1, name: "Sehr gut", text: "weit über das Wesentliche hinaus erfüllt" },
  { wert: 2, name: "Gut", text: "über das Wesentliche hinaus erfüllt" },
  { wert: 3, name: "Befriedigend", text: "das Wesentliche zur Gänze erfüllt" },
  { wert: 4, name: "Genügend", text: "das Wesentliche überwiegend erfüllt" },
  { wert: 5, name: "Nicht genügend", text: "das Wesentliche nicht überwiegend erfüllt" },
] as const;
export type Stufe = (typeof STUFEN)[number]["wert"];
export const stufeOf = (v: unknown): Stufe | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 1 && n <= 5 ? (n as Stufe) : null;
};
export const stufeName = (s: Stufe) => STUFEN[s - 1].name;

/** Der Erwartungshorizont: je Kriterium die Punkte, was ein guter Text enthält. */
export type Erwartung = Record<KriteriumKey, string[]>;
export const leereErwartung = (): Erwartung => ({ inhalt: [], textstruktur: [], stil: [], sprachrichtigkeit: [] });
export const erwartungLeer = (e: Erwartung) => KRITERIUM_KEYS.every((k) => !e[k].length);

export const MAX_PUNKTE = 12;
export const MAX_PUNKT = 400;

/** Ein Feld je Kriterium, ein Punkt je Zeile; Aufzählungszeichen am Anfang fallen weg. */
export function punkteAus(v: unknown): string[] {
  return String(v ?? "")
    .split(/\r?\n/)
    .map((z) => z.replace(/^\s*(?:[•\-–*]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim().slice(0, MAX_PUNKT))
    .filter(Boolean)
    .slice(0, MAX_PUNKTE);
}

/** Der Erwartungshorizont aus dem Formular (Felder `e_inhalt` …) oder aus gespeichertem JSON. */
export function cleanErwartung(raw: Partial<Record<string, unknown>>): Erwartung {
  const e = leereErwartung();
  for (const k of KRITERIUM_KEYS) {
    const v = raw[k];
    e[k] = Array.isArray(v) ? punkteAus(v.map(String).join("\n")) : punkteAus(v);
  }
  return e;
}

export function parseErwartung(json: string | null | undefined): Erwartung | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    return raw && typeof raw === "object" ? cleanErwartung(raw) : null;
  } catch {
    return null;
  }
}

/** Die Arbeitsaufträge aus dem Text des Auftrags: die Zeilen mit • (oder -) am Anfang. */
export function auftragsPunkte(prompt: string): string[] {
  return prompt
    .split(/\r?\n/)
    .filter((z) => /^\s*[•\-–]\s*\S/.test(z))
    .map((z) => z.replace(/^\s*[•\-–]\s*/, "").trim());
}

/**
 * Die Vorlage aus der Textsorte, ohne KI: die Arbeitsaufträge (Inhalt), der Schreibplan und der Umfang (Textstruktur),
 * die Merkmale der Textsorte (Stil und Ausdruck) und die sprachlichen Normen. Die Lehrkraft ändert sie und speichert.
 */
export function vorlageFor(v: Pick<AuftragView, "sorte" | "target" | "kind">, prompt: string): Erwartung {
  const s = SORTEN[v.sorte];
  const beilage = s.beilage === "Geschichte" ? "der Geschichte" : "der Textbeilage";
  const { min, max } = wordRange(v.target);
  const auftraege = auftragsPunkte(prompt);
  return {
    inhalt: [
      ...auftraege,
      `Aussagen über den Inhalt ${beilage} stimmen und sind begründet.`,
      ...(v.sorte === "zusammenfassung" ? [] : ["Deutung oder Meinung: jede am Text begründete Richtung zählt, nicht nur eine."]),
    ].slice(0, MAX_PUNKTE),
    textstruktur: [...planFor(v).map((p) => `${p.title}: ${p.hint}`), "Ein Absatz je Teil, die Gedanken folgen aufeinander.", `Umfang: ${min} bis ${max} Wörter.`],
    stil: [...(s.merkmale.length ? s.merkmale : ["Präsens", "sachlicher Stil", "Fachbegriffe zu Erzählform, Aufbau und Stilmitteln"]), "Treffende, abwechslungsreiche Wortwahl, Ton passt zur Textsorte und zum Publikum."],
    sprachrichtigkeit: [
      "Rechtschreibung und Zeichensetzung weitgehend fehlerfrei.",
      "Grammatik richtig: Zeitformen, Fälle, Satzbau.",
      ...(s.zitiert ? ["Zitate wörtlich, in Anführungszeichen und mit Zeilenangabe."] : []),
    ].slice(0, MAX_PUNKTE),
  };
}

// ---------- die Bewertung ----------

export type BewertungKriterium = { key: KriteriumKey; stufe: Stufe; begruendung: string };
export type Bewertung = { kriterien: BewertungKriterium[]; note: Stufe | null };

export const MAX_BEGRUENDUNG = 1500;

/** Die Bewertung aus dem Formular (`s_inhalt`, `b_inhalt` …, `note`): jede Stufe ist Pflicht, die Gesamtnote nicht. */
export function cleanBewertung(f: (name: string) => unknown): { bewertung: Bewertung } | { error: string } {
  const kriterien: BewertungKriterium[] = [];
  for (const k of KRITERIUM_KEYS) {
    const stufe = stufeOf(f(`s_${k}`));
    if (!stufe) return { error: `Bitte bei „${kriteriumName(k)}“ eine Stufe wählen.` };
    const begruendung = String(f(`b_${k}`) ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_BEGRUENDUNG);
    kriterien.push({ key: k, stufe, begruendung });
  }
  return { bewertung: { kriterien, note: stufeOf(f("note")) } };
}

export function parseBewertung(json: string | null | undefined): Bewertung | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as { kriterien?: unknown; note?: unknown };
    const list = Array.isArray(raw.kriterien) ? (raw.kriterien as Record<string, unknown>[]) : [];
    const kriterien = KRITERIUM_KEYS.flatMap((k): BewertungKriterium[] => {
      const r = list.find((x) => x?.key === k);
      const stufe = stufeOf(r?.stufe);
      return r && stufe ? [{ key: k, stufe, begruendung: String(r.begruendung ?? "") }] : [];
    });
    return kriterien.length === KRITERIUM_KEYS.length ? { kriterien, note: stufeOf(raw.note) } : null;
  } catch {
    return null;
  }
}

/** Der Schnitt der Stufen, auf eine Kommastelle; nur als Hilfe neben der Gesamtnote, die die Lehrkraft setzt. */
export function schnitt(kriterien: { stufe: Stufe | null }[]): number | null {
  const s = kriterien.map((k) => k.stufe).filter((x): x is Stufe => x !== null);
  return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null;
}
