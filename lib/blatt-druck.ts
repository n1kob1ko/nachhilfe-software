import { uebung, type MappeUebung } from "./mappe";
import { ergebnis, papierPunkte, punkteDerAufgaben, type ProbeErgebnis } from "./probeschularbeit";
import * as repo from "./repo";
import { klassenLabel, stufeLabel } from "./school";

/**
 * Das ausgefüllte Blatt (docs/blatt-drucken.md): eine gesendete Übung mit den Antworten des Schülers, Häkchen und
 * Kreuzen, der richtigen Lösung bei Fehlern und, bei einer Probeschularbeit, Punkten und Note. Wie die Mappe einer
 * Einheit (lib/mappe.ts), nur für ein einziges Blatt und mit allen Antworten, egal in welcher Einheit sie kamen.
 */
export type BlattMappe = {
  assignment: repo.Assignment;
  student: repo.Student;
  klasse: string;
  uebung: MappeUebung;
  /** wann das Blatt fertig war, sonst die letzte Antwort, sonst der Tag des Sendens */
  datum: string;
  /** Zeit am Blatt (alle Versuche) und davon aktiv, in Minuten */
  minuten: number;
  aktivMinuten: number | null;
  hilfen: number;
  /** Probeschularbeit: Punkte je Aufgabe (erreicht null = wartet auf die Bewertung) und die Note */
  probe: null | { ergebnis: ProbeErgebnis; jeAufgabe: Map<number, { erreicht: number | null; max: number }> };
};

export function blattFuerZuweisung(assignmentId: number): BlattMappe | null {
  const assignment = repo.getAssignment(assignmentId);
  const student = assignment ? repo.getStudent(assignment.student_id) : null;
  if (!assignment || !student) return null;
  const versuche = repo.listAttemptsForAssignment(assignmentId);
  const u = uebung(assignment, student.name.split(" ")[0], versuche);
  if (!u) return null;
  const ms = versuche.reduce((s, a) => s + (a.time_ms ?? 0), 0);
  const aktiv = versuche.every((a) => a.active_ms === null) ? null : versuche.reduce((s, a) => s + (a.active_ms ?? 0), 0);
  const hilfen = new Set(repo.hintUsesForAssignment(assignmentId).map((h) => `${h.task_id}:${h.hint_index}`)).size;

  let probe: BlattMappe["probe"] = null;
  if (u.worksheet.probe_test_id) {
    const e = ergebnis(assignmentId);
    const punkte = punkteDerAufgaben(u.worksheet.id);
    const papier = papierPunkte(u.worksheet.settings);
    const finals = versuche.filter((a) => a.final);
    const jeAufgabe = new Map<number, { erreicht: number | null; max: number }>();
    for (const t of u.aufgaben.map((a) => a.task)) {
      const max = punkte.get(t.id) ?? 0;
      const f = [...finals].reverse().find((x) => x.task_id === t.id);
      // wie lib/probeschularbeit.ts ergebnis: richtig alle Punkte, teilweise die Hälfte, falsch 0
      const erreicht = !f ? 0 : f.review === "offen" ? null : papier && t.id in papier ? papier[t.id] : f.review === "teilweise" ? Math.round(max) / 2 : f.correct ? max : 0;
      jeAufgabe.set(t.id, { erreicht, max });
    }
    if (e) probe = { ergebnis: e, jeAufgabe };
  }

  const letzte = versuche.at(-1)?.created_at ?? null;
  return {
    assignment,
    student,
    klasse: student.klasse ? klassenLabel(student.school_type, student.klasse) : stufeLabel(student.grade),
    uebung: u,
    datum: assignment.completed_at ?? letzte ?? assignment.assigned_at,
    minuten: Math.round(ms / 60_000),
    aktivMinuten: aktiv === null ? null : Math.round(aktiv / 60_000),
    hilfen,
    probe,
  };
}

/** „Ausgefülltes Blatt“: der Titel und Dateiname beim Speichern als PDF. */
export const blattTitel = (b: Pick<BlattMappe, "uebung">) => b.uebung.titel;
