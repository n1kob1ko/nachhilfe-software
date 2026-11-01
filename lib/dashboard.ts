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
import { WOCHENTAG_KURZ, labelMinuten, minutenLabel, tagAddieren, wienerDatum, wienerMinuten, wienerWochenstart, wochentageDerWoche, type Wochentag } from "./planung/zeit";
import { ortLabel } from "./planung/schueler-termine";

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

export type PlanEintrag = {
  key: string;
  startMin: number;
  zeit: string;
  studentId: number;
  name: string;
  ort: string;
  /** gehalten: Einheit gestartet; ausgefallen: Platz vorbei ohne Einheit; vorbei: von Hand geplant, Zeit vorbei; geplant: kommt noch */
  stand: "gehalten" | "geplant" | "ausgefallen" | "vorbei";
};
export type PlanTag = { tag: Wochentag; datum: string; kurz: string; tagNr: string; heute: boolean; eintraege: PlanEintrag[] };

/**
 * Meine Woche für das Dashboard (niko, 01.11.2026: „der Plan für die Woche für den Lehrer, der angemeldet ist“): je Tag
 * die Termine des Lehrers mit Uhrzeit, Schüler und Raum, dazu die Balken und Summen. Termine sind dieselben wie im
 * Tagesplan auf Heute (lib/heute.ts): veröffentlichte Plätze, von Hand geplante Stunden eines Schülers, der an dem Tag
 * keinen Platz hat, und gehaltene Einheiten ohne Platz. Samstag und Sonntag nur, wenn dort etwas ist.
 */
export function meineWoche(teacherId: number, now = new Date()) {
  const woche = wienerWochenstart(now);
  const heute = wienerDatum(now);
  const jetztMin = wienerMinuten(now);
  const uebersicht = wochenUebersicht(woche, { status: "veroeffentlicht", nurLehrerId: teacherId, now });
  const tage = wochentageDerWoche(woche);
  const ende = tage[6].datum;
  const datumVon = new Map(tage.map((t) => [t.tag, t.datum]));
  const einheiten = listUnits({ teacherId })
    .map((u) => {
      const at = new Date(parseTime(u.started_at));
      return { id: u.id, studentId: u.student_id, name: u.student_name, datum: wienerDatum(at), startMin: wienerMinuten(at) };
    })
    .filter((u) => u.datum >= woche && u.datum <= ende);
  const eintraege: (PlanEintrag & { datum: string })[] = [];
  const mitPlatz = new Set<string>();
  const einheitMitPlatz = new Set<number>();
  for (const p of uebersicht.plaetze) {
    const datum = datumVon.get(p.weekday)!;
    mitPlatz.add(`${datum}|${p.studentId}`);
    if (p.unitId !== null) einheitMitPlatz.add(p.unitId);
    eintraege.push({
      key: `platz-${p.id}`,
      datum,
      startMin: p.startMin,
      zeit: `${minutenLabel(p.startMin)}–${minutenLabel(p.startMin + p.dauer)}`,
      studentId: p.studentId,
      name: p.studentName,
      ort: ortLabel(p.roomName, p.roomBuilding, p.roomMode === "online"),
      stand: p.unitId !== null ? "gehalten" : p.nichtStattgefunden ? "ausgefallen" : "geplant",
    });
  }
  for (const l of lessonsBetween(`${woche}T00:00`, `${tagAddieren(ende, 1)}T00:00`)) {
    if (l.status !== "geplant" || l.unit_id !== null || (l.teacher_id && l.teacher_id !== teacherId)) continue;
    const datum = l.starts_at.slice(0, 10);
    if (mitPlatz.has(`${datum}|${l.student_id}`)) continue;
    const start = labelMinuten(l.starts_at.slice(11, 16));
    const vorbei = datum < heute || (datum === heute && start !== null && start + l.duration_min <= jetztMin);
    eintraege.push({
      key: `stunde-${l.id}`,
      datum,
      startMin: start ?? 0,
      zeit: start === null ? "–" : `${minutenLabel(start)}–${minutenLabel(start + l.duration_min)}`,
      studentId: l.student_id,
      name: l.student_name,
      ort: "",
      stand: vorbei ? "vorbei" : "geplant",
    });
  }
  for (const u of einheiten) {
    if (einheitMitPlatz.has(u.id)) continue;
    eintraege.push({ key: `einheit-${u.id}`, datum: u.datum, startMin: u.startMin, zeit: minutenLabel(u.startMin), studentId: u.studentId, name: u.name, ort: "", stand: "gehalten" });
  }
  const plan: PlanTag[] = tage
    .map(({ tag, datum }) => ({
      tag,
      datum,
      kurz: WOCHENTAG_KURZ[tag],
      tagNr: `${Number(datum.slice(8, 10))}.${Number(datum.slice(5, 7))}.`,
      heute: datum === heute,
      eintraege: eintraege.filter((e) => e.datum === datum).sort((a, b) => a.startMin - b.startMin),
    }))
    .filter((t) => t.tag <= 5 || t.eintraege.length > 0);
  const balken = wochenBalken(
    woche,
    heute,
    einheiten.map((u) => u.datum),
    eintraege.filter((e) => e.stand === "geplant").map((e) => e.datum),
  );
  return {
    label: uebersicht.label,
    plan,
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
