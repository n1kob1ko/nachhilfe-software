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
  /** Arbeit fotografieren (lib/papier-einheit.ts), bekanntes Blatt: die Aufgabe der Übung, zu der die Zeile gehört */
  taskId?: number;
  /** bekanntes Blatt: die Lösung der Aufgabe, nur für den Lehrer */
  loesung?: string;
  /** warum die Zeile geprüft werden muss (unsicher gelesen, nicht lesbar, die App prüft anders) */
  grund?: string;
  /** noch keine Bewertung gewählt (nicht lesbar, Lesung und App uneins, ohne KI); zählt erst nach dem Antippen */
  offen?: boolean;
  /** beim Lesen als unsicher markiert; bleibt nach dem Prüfen, für die Zeile im Abschluss („2 unsicher geprüft“) */
  warUnsicher?: boolean;
};

export type BlattVorschlag = { titel: string; zeilen: BlattZeile[]; gesamt: number | null; gesamtMax: number | null; note: number | null; hinweise: string[] };

/** Die erreichten Punkte einer Zeile: vom Blatt, sonst aus der Bewertung (teilweise = die Hälfte), sonst null. */
export function erreichtVon(z: Pick<BlattZeile, "punkte" | "max" | "bewertung">): number | null {
  if (z.punkte != null) return z.punkte;
  if (z.max == null) return null;
  return z.bewertung === "richtig" ? z.max : z.bewertung === "teilweise" ? Math.round(z.max) / 2 : 0;
}

// ---------- Arbeit fotografieren: ein bekanntes Blatt der Einheit (lib/papier-einheit.ts) ----------

/** Was die Lesung zu einer Aufgabe vorschlägt; „nicht_lesbar“ ist nie falsch, die Lehrkraft entscheidet. */
export type LesungUrteil = Bewertung | "nicht_lesbar";
/** Was die App selbst zur gelesenen Antwort sagt; null, wenn sie diese Art Aufgabe nicht selbst prüfen kann. */
export type AppUrteil = "richtig" | "teilweise" | "falsch" | null;

const URTEIL_TEXT: Record<Bewertung, string> = { richtig: "richtig", teilweise: "teilweise", falsch: "falsch", leer: "leer" };

/**
 * Lesung und eigene Prüfung der App zu einer Zeile zusammen: die App prüft zuerst, wo sie kann. Sagt sie etwas anderes als die
 * Lesung, oder ist die Lesung unsicher oder nicht lesbar, wird die Zeile gelb („pruefen“). Bei Uneinigkeit und „nicht lesbar“
 * ist keine Bewertung vorgewählt („offen“): erst das Antippen der Lehrkraft zählt.
 */
export function zusammenfuehren(lesung: { bewertung: LesungUrteil; unsicher: boolean; grund: string }, app: AppUrteil): Pick<BlattZeile, "bewertung" | "pruefen" | "offen" | "grund" | "warUnsicher"> {
  const grund = lesung.grund.replace(/\s+/g, " ").trim().slice(0, 200);
  if (lesung.bewertung === "nicht_lesbar") return { bewertung: "falsch", offen: true, pruefen: true, warUnsicher: true, grund: grund ? `Nicht lesbar: ${grund}` : "Nicht lesbar" };
  if (app && lesung.bewertung !== "leer" && app !== lesung.bewertung)
    return { bewertung: lesung.bewertung, offen: true, pruefen: true, warUnsicher: true, grund: `Gelesen: ${URTEIL_TEXT[lesung.bewertung]}. Die App prüft die Antwort als ${URTEIL_TEXT[app]}.` };
  if (lesung.unsicher) return { bewertung: lesung.bewertung, offen: false, pruefen: true, warUnsicher: true, grund: grund || "Die Lesung ist unsicher." };
  return { bewertung: lesung.bewertung, offen: false, pruefen: false, warUnsicher: false, grund: lesung.bewertung === "richtig" ? "" : grund };
}

/** Unsichere Zeilen zuerst, sonst in der Reihenfolge des Blatts (für die Vorschau; beim Antippen springt nichts). */
export const unsichereZuerst = <T extends Pick<BlattZeile, "pruefen">>(zeilen: T[]): T[] => [...zeilen.filter((z) => z.pruefen), ...zeilen.filter((z) => !z.pruefen)];

/** Was eine auf Papier gelöste Übung ergibt: richtig, teilweise, von wie vielen, Punkte (nur wenn jede Aufgabe Punkte hat). */
export type PapierErgebnis = { titel: string; von: number; richtig: number; teilweise: number; punkte: number | null; max: number | null; unsicher: number };

export function papierErgebnis(titel: string, zeilen: Pick<BlattZeile, "bewertung" | "punkte" | "max" | "warUnsicher">[]): PapierErgebnis {
  const mitPunkten = zeilen.length > 0 && zeilen.every((z) => z.max != null);
  return {
    titel,
    von: zeilen.length,
    richtig: zeilen.filter((z) => z.bewertung === "richtig").length,
    teilweise: zeilen.filter((z) => z.bewertung === "teilweise").length,
    punkte: mitPunkten ? zeilen.reduce((s, z) => s + (erreichtVon(z) ?? 0), 0) : null,
    max: mitPunkten ? zeilen.reduce((s, z) => s + (z.max ?? 0), 0) : null,
    unsicher: zeilen.filter((z) => z.warUnsicher).length,
  };
}

const zahlText = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(1).replace(".", ","));

/** Eine noch offene Aufgabe eines bekannten Blatts, wie die Vorschau sie zeigt: Angabe und Lösung nur für den Lehrer. */
export type PapierAufgabe = { taskId: number; nr: string; aufgabe: string; loesung: string; max: number | null; skillId: string | null };

/** Ohne Lesung (KI aus, Budget, Grenze je Schüler): je Aufgabe eine Zeile ohne Bewertung; die Lehrkraft tippt sie an. */
export const zeilenOhneLesung = (aufgaben: PapierAufgabe[]): BlattZeile[] =>
  aufgaben.map((a) => ({ nr: a.nr, aufgabe: a.aufgabe, antwort: "", bewertung: "richtig", punkte: null, max: a.max, skillId: a.skillId, fehler: "", pruefen: false, taskId: a.taskId, loesung: a.loesung, grund: "", offen: true, warUnsicher: false }));

/** Die Zeile im Abschluss: „Auf Papier: Übung „Brüche“ 7 von 10 Punkten, 2 unsicher geprüft“. */
export function papierZeile(p: PapierErgebnis): string {
  const wie = p.punkte != null && p.max ? `${zahlText(p.punkte)} von ${zahlText(p.max)} Punkten` : `${p.richtig} von ${p.von} richtig${p.teilweise ? `, ${p.teilweise} teilweise` : ""}`;
  return `Auf Papier: Übung „${p.titel}“ ${wie}${p.unsicher ? `, ${p.unsicher} unsicher geprüft` : ""}`;
}
