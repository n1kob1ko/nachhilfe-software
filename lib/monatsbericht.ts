/**
 * Monatsbericht für Eltern (niko 2026-11-26, Punkt 8): ein Monat eines Schülers auf einer Seite. Einheiten mit Datum, Fach
 * und Thema, Themen mit Lernstand vorher und nachher, Schularbeiten und Tests mit Note, was zu Hause geübt wurde und der
 * Notenverlauf. Nur aus Daten, die es schon gibt, ohne KI, nichts wird gespeichert.
 *
 * Der Lehrer sieht ihn unter /schueler/[id]/bericht (Drucken als PDF, Link kopieren), die Familie über den Link der
 * Schüler-App /lernen/[token]/bericht. Keine Notizen des Lehrers, keine Fehlerarten, keine anderen Schüler.
 */
import { db } from "./db";
import { geuebtZwischen, type Geuebt } from "./zu-hause";
import { notenverlauf, type Notenverlauf } from "./notenverlauf";
import * as repo from "./repo";

export type BerichtEinheit = { datum: string; fach: string; thema: string; minuten: number };
export type BerichtThema = { name: string; fach: string; vorher: number | null; nachher: number };
export type BerichtTest = { datum: string; fach: string; titel: string; note: number | null; geplant: boolean };
export type Monatsbericht = {
  monat: string;
  monatName: string;
  einheiten: BerichtEinheit[];
  minuten: number;
  themen: BerichtThema[];
  tests: BerichtTest[];
  zuHause: Geuebt;
  noten: Notenverlauf;
};

const MONATE = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** „2026-11“ → gültig? */
export const istMonat = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function monatName(monat: string) {
  const [j, m] = monat.split("-").map(Number);
  return `${MONATE[m - 1]} ${j}`;
}

/** Der Monat davor / danach („2026-11“ → „2026-10“). */
export function monatVerschieben(monat: string, um: number) {
  const [j, m] = monat.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1 + um, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Erster Tag des Monats und erster Tag des nächsten als JJJJ-MM-TT. */
function grenzen(monat: string) {
  return { von: `${monat}-01`, bis: `${monatVerschieben(monat, 1)}-01` };
}

/** Wien-Mitternacht eines Tages als ms (Winter +1, Sommer +2; für die Grenzen eines Monats reicht das). */
function wienMs(tag: string) {
  const utc = Date.parse(`${tag}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Vienna", timeZoneName: "shortOffset" }).formatToParts(new Date(utc)).find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const h = Number(offset.replace("GMT", "")) || 1;
  return utc - h * 3_600_000;
}

export function monatsbericht(studentId: number, monat: string): Monatsbericht {
  const { von, bis } = grenzen(monat);
  const vonMs = wienMs(von);
  const bisMs = wienMs(bis);

  // Einheiten: die abgeschlossenen Stunden des Monats; Dauer aus der Einheit, sonst die geplante
  const stunden = repo
    .listLessons(studentId)
    .filter((l) => l.kind === "stunde" && l.status === "abgeschlossen" && Date.parse(l.starts_at) >= vonMs && Date.parse(l.starts_at) < bisMs)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const einheiten = stunden.map((l) => {
    const u = l.unit_id ? (db().prepare("SELECT started_at, ended_at FROM units WHERE id = ?").get(l.unit_id) as { started_at: string; ended_at: string | null } | undefined) : undefined;
    const ist = u?.ended_at ? Math.round((Date.parse(u.ended_at) - Date.parse(u.started_at)) / 60_000) : 0;
    const themen = l.skill_ids.map((id) => repo.getSkill(id)?.area).filter((x): x is string => Boolean(x));
    return { datum: l.starts_at, fach: l.subject, thema: l.topic || [...new Set(themen)].slice(0, 2).join(", "), minuten: ist > 0 ? ist : l.duration_min };
  });

  // Themen: geübte Fähigkeiten des Monats mit dem Lernstand davor und am Monatsende (skill_snapshots am Ende jeder Einheit)
  const snaps = db()
    .prepare(
      `SELECT s.skill_id, s.mastery, s.practiced, s.recorded_at, k.name, k.subject FROM skill_snapshots s JOIN skills k ON k.id = s.skill_id
       WHERE s.student_id = ? AND s.recorded_at < ? ORDER BY s.recorded_at`,
    )
    .all(studentId, new Date(bisMs).toISOString()) as { skill_id: string; mastery: number; practiced: number; recorded_at: string; name: string; subject: string }[];
  const geuebt = new Set(snaps.filter((s) => s.practiced && Date.parse(s.recorded_at) >= vonMs).map((s) => s.skill_id));
  const themen: BerichtThema[] = [...geuebt]
    .map((id) => {
      const xs = snaps.filter((s) => s.skill_id === id);
      const vorher = [...xs].reverse().find((s) => Date.parse(s.recorded_at) < vonMs)?.mastery ?? null;
      const nachher = xs[xs.length - 1];
      return { name: nachher.name, fach: nachher.subject, vorher, nachher: nachher.mastery };
    })
    .sort((a, b) => b.nachher - (b.vorher ?? 0) - (a.nachher - (a.vorher ?? 0)))
    .slice(0, 8);

  // Schularbeiten und Tests: geschriebene des Monats, dazu die geplanten bis Ende des nächsten Monats
  const naechsterBis = `${monatVerschieben(monat, 2)}-01`;
  const tests = repo
    .listTests(studentId)
    .filter((t) => t.status !== "abgesagt" && ((t.date >= von && t.date < bis && t.status !== "geplant") || (t.status === "geplant" && t.date >= von && t.date < naechsterBis)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({ datum: t.date, fach: t.subject, titel: t.title || t.topic || t.kind, note: t.grade, geplant: t.status === "geplant" }));

  return {
    monat,
    monatName: monatName(monat),
    einheiten,
    minuten: einheiten.reduce((s, e) => s + e.minuten, 0),
    themen,
    tests,
    zuHause: geuebtZwischen(studentId, vonMs, Math.min(bisMs, Date.now())),
    noten: notenverlauf(studentId, `${monat}-31`),
  };
}
