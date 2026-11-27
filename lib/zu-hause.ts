/**
 * Was ein Schüler seit der letzten Einheit zu Hause geübt hat (niko 2026-11-26, Punkt 4 der Verbesserungen): Lernspiele,
 * Vokabeln und Übungen außerhalb einer Einheit, zwischen dem Ende der vorigen Einheit und dem Beginn dieser.
 *
 * Steht in der laufenden Einheit oben (der Lehrer sieht gleich, ob geübt wurde), in „Mehr Details“ und als Satz in
 * „Was wurde gemacht“ (lib/learning.ts). Gezählt wird wie in lib/einheit-aktivitaeten.ts: nur beendete Runden mit
 * mindestens einer Karte, eine Runde zählt höchstens 30 Minuten. Klicks, Geräte oder Uhrzeiten werden nicht gezeigt.
 */
import { parseTime } from "./analysis";
import { PAPIER_ANTWORT } from "./blatt-regeln";
import { db } from "./db";
import { RUNDE_MAX_MS } from "./einheit-aktivitaeten";
import { istSpielArt, SPIEL_TITEL } from "./lernspiele-typen";
import { wienerDatum } from "./planung/zeit";

export type ZuHause = {
  /** Beginn des Zeitraums (Ende der vorigen Einheit oder 14 Tage vor dieser), ISO */
  seit: string;
  /** true, wenn es eine vorige Einheit gibt (sonst „in den letzten 14 Tagen“) */
  seitEinheit: boolean;
  /** an wie vielen Tagen (Wien) geübt wurde */
  tage: number;
  minuten: number;
  /** Karten in Spielen und Vokabeln plus Aufgaben in Übungen */
  anzahl: number;
  richtig: number;
  /** die meistgeübten Sachen, höchstens 4, mit Minuten */
  was: { titel: string; minuten: number; anzahl: number; richtig: number }[];
};

const OHNE_EINHEIT_TAGE = 14;
const sqlZeit = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/** Der Zeitraum vor einer Einheit: vom Ende der vorigen (nicht abgebrochenen) Einheit des Schülers bis zum Beginn dieser. */
function zeitraum(studentId: number, bis: number): { von: number; seitEinheit: boolean } {
  const vorige = db()
    .prepare("SELECT started_at, ended_at FROM units WHERE student_id = ? AND status = 'beendet' AND started_at < ? ORDER BY started_at DESC LIMIT 1")
    .get(studentId, new Date(bis).toISOString()) as { started_at: string; ended_at: string | null } | undefined;
  if (vorige) return { von: Date.parse(vorige.ended_at ?? vorige.started_at), seitEinheit: true };
  return { von: bis - OHNE_EINHEIT_TAGE * 86_400_000, seitEinheit: false };
}

/**
 * Was zwischen `von` und `bis` außerhalb jeder Einheit des Schülers geübt wurde. Ohne Angabe: seit der vorigen Einheit
 * bis `bisIso` (Beginn der Einheit) bzw. bis jetzt. Nichts geübt: `tage` ist 0.
 */
export function zuHauseGeuebt(studentId: number, bisIso?: string, now = Date.now()): ZuHause | null {
  const bis = bisIso ? Date.parse(bisIso) : now;
  const { von, seitEinheit } = zeitraum(studentId, bis);
  if (!(bis > von)) return null;
  return { seit: new Date(von).toISOString(), seitEinheit, ...geuebtZwischen(studentId, von, bis) };
}

export type Geuebt = Omit<ZuHause, "seit" | "seitEinheit">;

/** Was zwischen `von` und `bis` (ms) außerhalb jeder Einheit des Schülers geübt wurde (auch für den Monatsbericht). */
export function geuebtZwischen(studentId: number, von: number, bis: number): Geuebt {
  // Zeiten, in denen eine Einheit lief: was dort geübt wurde, ist Unterricht, nicht zu Hause
  const einheiten = (
    db().prepare("SELECT started_at, ended_at FROM units WHERE student_id = ? AND started_at < ? AND COALESCE(ended_at, ?) > ?").all(studentId, new Date(bis).toISOString(), new Date(bis).toISOString(), new Date(von).toISOString()) as {
      started_at: string;
      ended_at: string | null;
    }[]
  ).map((u) => [Date.parse(u.started_at), u.ended_at ? Date.parse(u.ended_at) : bis] as const);
  const imUnterricht = (t: number) => einheiten.some(([a, b]) => t >= a && t <= b);

  type Posten = { tag: string; titel: string; ms: number; anzahl: number; richtig: number };
  const posten: Posten[] = [];
  const dazu = (start: number, ende: number, titel: string, anzahl: number, richtig: number, ms?: number) => {
    if (imUnterricht(start)) return;
    posten.push({ tag: wienerDatum(new Date(start)), titel, ms: ms ?? Math.min(Math.max(0, ende - start), RUNDE_MAX_MS), anzahl, richtig });
  };

  const a = sqlZeit(von);
  const b = sqlZeit(bis);
  const runden = db()
    .prepare("SELECT art, anzahl, richtig, created_at, beendet_at FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL AND anzahl > 0 AND created_at >= ? AND created_at < ?")
    .all(studentId, a, b) as { art: string; anzahl: number; richtig: number; created_at: string; beendet_at: string }[];
  for (const r of runden) dazu(parseTime(r.created_at), parseTime(r.beendet_at), istSpielArt(r.art) ? SPIEL_TITEL[r.art] : "Lernspiel", r.anzahl, r.richtig);

  const vok = db()
    .prepare("SELECT anzahl, richtig, created_at, beendet_at FROM vokabelrunden WHERE student_id = ? AND beendet_at IS NOT NULL AND anzahl > 0 AND created_at >= ? AND created_at < ?")
    .all(studentId, a, b) as { anzahl: number; richtig: number; created_at: string; beendet_at: string }[];
  for (const r of vok) dazu(parseTime(r.created_at), parseTime(r.beendet_at), "Vokabeln", r.anzahl, r.richtig);

  // Übungen und Hausübungen: abgeschlossene Aufgaben ohne Einheit, Zeit = die gemessene Bearbeitungszeit. Nicht ein auf
  // Papier gelöstes Blatt, das der Lehrer eingelesen hat (Schularbeit, Test): das ist nicht zu Hause geübt (Simulation 27.11.2026)
  const versuche = db()
    .prepare(
      "SELECT time_ms, correct, created_at FROM attempts WHERE student_id = ? AND final = 1 AND unit_id IS NULL AND created_at >= ? AND created_at < ? AND NOT EXISTS (SELECT 1 FROM assignments x WHERE x.id = attempts.assignment_id AND x.note = ?)",
    )
    .all(studentId, a, b, PAPIER_ANTWORT) as { time_ms: number; correct: number; created_at: string }[];
  for (const v of versuche) {
    const t = parseTime(v.created_at);
    dazu(t, t, "Übungen", 1, v.correct ? 1 : 0, Math.min(Math.max(0, v.time_ms), 10 * 60_000));
  }

  if (!posten.length) return { tage: 0, minuten: 0, anzahl: 0, richtig: 0, was: [] };
  const proTitel = new Map<string, { titel: string; ms: number; anzahl: number; richtig: number }>();
  for (const p of posten) {
    const x = proTitel.get(p.titel) ?? { titel: p.titel, ms: 0, anzahl: 0, richtig: 0 };
    x.ms += p.ms;
    x.anzahl += p.anzahl;
    x.richtig += p.richtig;
    proTitel.set(p.titel, x);
  }
  const ms = posten.reduce((s, p) => s + p.ms, 0);
  return {
    tage: new Set(posten.map((p) => p.tag)).size,
    minuten: Math.round(ms / 60_000),
    anzahl: posten.reduce((s, p) => s + p.anzahl, 0),
    richtig: posten.reduce((s, p) => s + p.richtig, 0),
    was: [...proTitel.values()]
      .sort((x, y) => y.ms - x.ms || y.anzahl - x.anzahl)
      .slice(0, 4)
      .map((x) => ({ titel: x.titel, minuten: Math.round(x.ms / 60_000), anzahl: x.anzahl, richtig: x.richtig })),
  };
}

/** Ein Satz für die Dokumentation: „Zu Hause seit der letzten Einheit: an 3 Tagen geübt, 42 min, 180 Karten, 86 % richtig (Blockwerk, Vokabeln).“ */
export function zuHauseSatz(z: ZuHause | null | undefined): string {
  if (!z) return "";
  if (z.tage === 0) return z.seitEinheit ? "Zu Hause seit der letzten Einheit: nicht geübt." : "";
  const quote = z.anzahl ? `, ${Math.round((z.richtig / z.anzahl) * 100)} % richtig` : "";
  const dauer = z.minuten >= 1 ? `, ${z.minuten} min` : "";
  const was = z.was.length ? ` (${z.was.map((w) => w.titel).join(", ")})` : "";
  return `Zu Hause ${z.seitEinheit ? "seit der letzten Einheit" : "in den 14 Tagen davor"}: an ${z.tage === 1 ? "1 Tag" : `${z.tage} Tagen`} geübt${dauer}, ${z.anzahl} ${z.anzahl === 1 ? "Aufgabe" : "Aufgaben"}${quote}${was}.`;
}
