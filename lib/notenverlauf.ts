/**
 * Notenverlauf (niko 2026-11-26, Punkt 9): die Noten aus Schularbeiten und Tests (`tests.grade`, 1 = Sehr gut … 5 = Nicht
 * genügend) über die Zeit, je Fach, mit „vor der Nachhilfe“ und „seit der Nachhilfe“. Beginn der Nachhilfe = die erste
 * abgeschlossene Stunde des Schülers (sonst der Tag, an dem er angelegt wurde).
 *
 * Steht im Profil unter „Stoff & Prüfungen“ und im Monatsbericht für die Eltern (lib/monatsbericht.ts).
 */
import { db } from "./db";
import * as repo from "./repo";

export type NotenPunkt = { id: number; datum: string; fach: string; art: string; titel: string; note: number };
export type FachSchnitt = { fach: string; vorher: number | null; seither: number | null; nVorher: number; nSeither: number };
export type Notenverlauf = { beginn: string | null; punkte: NotenPunkt[]; faecher: FachSchnitt[] };

/** Die Fächer in fester Reihenfolge (die Farbe im Diagramm hängt am Fach, nie am Rang). */
export const NOTEN_FAECHER = ["Mathematik", "Deutsch", "Englisch"] as const;
export const fachGruppe = (fach: string) => ((NOTEN_FAECHER as readonly string[]).includes(fach) ? fach : "Andere");

/** Der Tag der ersten Nachhilfestunde (JJJJ-MM-TT) oder null. */
export function nachhilfeBeginn(studentId: number): string | null {
  const r = db()
    .prepare("SELECT MIN(starts_at) AS d FROM lessons WHERE student_id = ? AND kind = 'stunde' AND status = 'abgeschlossen'")
    .get(studentId) as { d: string | null };
  if (r.d) return r.d.slice(0, 10);
  const u = db().prepare("SELECT MIN(started_at) AS d FROM units WHERE student_id = ? AND status = 'beendet'").get(studentId) as { d: string | null };
  return u.d ? u.d.slice(0, 10) : null;
}

const schnitt = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

/** Alle Noten des Schülers, älteste zuerst, und je Fach der Schnitt vor und seit der Nachhilfe. `bis` (JJJJ-MM-TT) schneidet ab. */
export function notenverlauf(studentId: number, bis?: string): Notenverlauf {
  const beginn = nachhilfeBeginn(studentId);
  const punkte = repo
    .listTests(studentId)
    .filter((t) => t.grade !== null && t.grade >= 1 && t.grade <= 5 && t.status !== "abgesagt" && (!bis || t.date <= bis))
    .map((t) => ({ id: t.id, datum: t.date, fach: t.subject, art: t.kind, titel: t.title || t.topic || t.kind, note: t.grade as number }))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.id - b.id);
  const faecher = [...new Set(punkte.map((p) => p.fach))].map((fach) => {
    const xs = punkte.filter((p) => p.fach === fach);
    const vor = beginn ? xs.filter((p) => p.datum < beginn).map((p) => p.note) : [];
    const seit = beginn ? xs.filter((p) => p.datum >= beginn).map((p) => p.note) : xs.map((p) => p.note);
    return { fach, vorher: schnitt(vor), seither: schnitt(seit), nVorher: vor.length, nSeither: seit.length };
  });
  return { beginn, punkte, faecher };
}

export const NOTEN_WORT: Record<number, string> = { 1: "Sehr gut", 2: "Gut", 3: "Befriedigend", 4: "Genügend", 5: "Nicht genügend" };

/** „2,5“ */
export const noteText = (x: number) => x.toLocaleString("de-AT", { maximumFractionDigits: 1 });
