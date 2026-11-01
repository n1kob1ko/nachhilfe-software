/**
 * Die Zahlen für das Dashboard auf **Heute** (niko, 01.11.2026: „Die Heute-Seite soll wie ein Dashboard aussehen“, mit
 * meiner Woche, wie sich die Schüler verbessert haben und den Dingen zu erledigen). Alles wird beim Lesen aus den Daten
 * gerechnet, ohne KI und ohne neue Tabellen.
 *
 * - `wochenBalken`: je Tag der laufenden Woche, wie viele Einheiten der Lehrer schon gehalten hat (gestartete Einheiten)
 *   und wie viele noch geplant sind (veröffentlichte Plätze ab heute ohne Einheit, nicht ausgefallen).
 * - `schuelerFortschritt`: je Schüler der Lernstand jetzt und die Veränderung der letzten vier Wochen (lib/analysis.ts,
 *   `trendOf`), dazu die Fähigkeit, in der er sich am meisten verbessert hat. Keine erfundenen Fortschritte: ohne genug
 *   Daten steht „noch zu wenig Daten“.
 */
import { analyzeStudent } from "./service";
import { parseTime, type Trend } from "./analysis";
import { lessonsBetween, listStudents } from "./repo";
import { listUnits } from "./units";
import { wochenUebersicht } from "./planung/uebersicht";
import { WOCHENTAG_KURZ, tagAddieren, wienerDatum, wienerWochenstart, wochentageDerWoche, type Wochentag } from "./planung/zeit";

const DAY = 86_400_000;

export type TagBalken = { tag: Wochentag; datum: string; kurz: string; gehalten: number; geplant: number; heute: boolean };

/**
 * Die Balken der Woche (Montag `woche`): gehalten = gestartete Einheiten an diesem Tag (`einheitenTage`, je ein Datum),
 * geplant = offene Termine ab `heute` (`geplantTage`, je ein Datum). Samstag und Sonntag nur, wenn dort etwas ist.
 */
export function wochenBalken(woche: string, heute: string, einheitenTage: string[], geplantTage: string[]): TagBalken[] {
  const tage = wochentageDerWoche(woche).map(({ tag, datum }) => ({
    tag,
    datum,
    kurz: WOCHENTAG_KURZ[tag],
    gehalten: einheitenTage.filter((d) => d === datum).length,
    geplant: datum >= heute ? geplantTage.filter((d) => d === datum).length : 0,
    heute: datum === heute,
  }));
  return tage.filter((t) => t.tag <= 5 || t.gehalten + t.geplant > 0);
}

/**
 * Meine Woche für das Dashboard: die Balken und die Summen. Geplant sind dieselben Termine wie im Tagesplan auf Heute
 * (lib/heute.ts): veröffentlichte Plätze ohne Einheit und nicht ausgefallen, dazu von Hand geplante Stunden eines
 * Schülers, der an dem Tag keinen Platz hat.
 */
export function meineWoche(teacherId: number, now = new Date()) {
  const woche = wienerWochenstart(now);
  const heute = wienerDatum(now);
  const uebersicht = wochenUebersicht(woche, { status: "veroeffentlicht", nurLehrerId: teacherId, now });
  const tage = wochentageDerWoche(woche);
  const ende = tage[6].datum;
  const datumVon = new Map(tage.map((t) => [t.tag, t.datum]));
  const einheitenTage = listUnits({ teacherId })
    .map((u) => wienerDatum(new Date(parseTime(u.started_at))))
    .filter((d) => d >= woche && d <= ende);
  const mitPlatz = new Set(uebersicht.plaetze.map((p) => `${datumVon.get(p.weekday)}|${p.studentId}`));
  const geplantTage = [
    ...uebersicht.plaetze.filter((p) => p.unitId === null && !p.nichtStattgefunden).map((p) => datumVon.get(p.weekday)!),
    ...lessonsBetween(`${woche}T00:00`, `${tagAddieren(ende, 1)}T00:00`)
      .filter((l) => l.status === "geplant" && l.unit_id === null && (!l.teacher_id || l.teacher_id === teacherId))
      .map((l) => ({ datum: l.starts_at.slice(0, 10), studentId: l.student_id }))
      .filter((l) => !mitPlatz.has(`${l.datum}|${l.studentId}`))
      .map((l) => l.datum),
  ];
  const balken = wochenBalken(woche, heute, einheitenTage, geplantTage);
  return {
    label: uebersicht.label,
    balken,
    gehalten: balken.reduce((s, t) => s + t.gehalten, 0),
    geplant: balken.reduce((s, t) => s + t.geplant, 0),
  };
}

export type SchuelerFortschritt = {
  id: number;
  name: string;
  /** Lernstand jetzt, 0–1; null ohne Daten. */
  stand: number | null;
  trend: Trend;
  /** Prozentpunkte gegenüber vor vier Wochen. */
  delta: number | null;
  /** Die Fähigkeit mit dem größten Plus, nur wenn sie steigt. */
  besserIn: { name: string; delta: number } | null;
};

/** Reihenfolge: wer sich am meisten verbessert hat zuerst, dann stabil, dann gesunken, zuletzt ohne genug Daten. */
export function fortschrittSortieren(liste: SchuelerFortschritt[]): SchuelerFortschritt[] {
  const rang = (f: SchuelerFortschritt) => (f.trend === "none" ? 1 : 0);
  return [...liste].sort((a, b) => rang(a) - rang(b) || (b.delta ?? -999) - (a.delta ?? -999) || a.name.localeCompare(b.name, "de"));
}

/**
 * Der Fortschritt der eigenen Schüler: wer in den letzten 60 Tagen bei diesem Lehrer war; hatte er noch niemanden,
 * alle Schüler (z. B. die Verwaltung).
 */
export function schuelerFortschritt(teacherId: number, now = Date.now()) {
  const seit = new Date(now - 60 * DAY).toISOString();
  const eigene = new Set(listUnits({ teacherId, from: seit }).map((u) => u.student_id));
  const alle = listStudents();
  const schueler = eigene.size > 0 ? alle.filter((s) => eigene.has(s.id)) : alle;
  const liste: SchuelerFortschritt[] = [];
  for (const s of schueler) {
    const a = analyzeStudent(s.id, now);
    if (!a) continue;
    const besser = a.skills
      .filter((k) => k.trend === "up" && k.delta !== null && k.lastPracticed !== null && now - k.lastPracticed <= 28 * DAY)
      .sort((x, y) => (y.delta ?? 0) - (x.delta ?? 0))[0];
    liste.push({
      id: s.id,
      name: s.name,
      stand: a.overall.mastery,
      trend: a.overall.trend,
      delta: a.overall.delta,
      besserIn: besser ? { name: besser.skill.name, delta: besser.delta! } : null,
    });
  }
  const sortiert = fortschrittSortieren(liste);
  return {
    liste: sortiert,
    besser: liste.filter((f) => f.trend === "up").length,
    gleich: liste.filter((f) => f.trend === "flat").length,
    schlechter: liste.filter((f) => f.trend === "down").length,
  };
}
