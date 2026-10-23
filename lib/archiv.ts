/**
 * Archiv: Übungen (auch Einträge der Aufgabenbibliothek), einzelne Zuweisungen an einen Schüler und Textarbeiten
 * (auch Bildgeschichten und Schreibaufträge) werden archiviert statt gelöscht. Archiviert heißt nur: nicht mehr in
 * den Listen, in Auswahl und Suche, und der Schüler sieht es nicht mehr als offen. Versuche, Antworten, die
 * Dokumentation der Einheiten, Lernstand und Lernverlauf bleiben unverändert und zählen weiter. „Wiederherstellen“
 * nimmt die Markierung wieder weg.
 *
 * Wer darf: die Verwaltung immer; sonst der Lehrer, dem es gehört (wer die Übung oder den Text gemacht hat, der
 * Lehrer des Schülers, bei einer Zuweisung auch der Lehrer der Einheit, in der sie gesendet wurde). Ist niemand
 * eingetragen (ältere Zeilen, Beispieldaten), darf jeder Lehrer, wie beim Löschen.
 */
import { db } from "./db";
import * as repo from "./repo";
import { getText } from "./texts";

export type Akteur = { id: number; is_admin: number | boolean };
export type ArchivErgebnis = { ok: true } | { ok: false; error: string };

const FREMD = "Archivieren und Wiederherstellen darf nur der Lehrer, dem es gehört, oder die Verwaltung.";
const WEG = "Nicht gefunden.";

/** The rule for all three: admins, or one of the owners; without any owner every teacher. */
export function mayArchive(t: Akteur, owners: (number | null | undefined)[]): boolean {
  if (t.is_admin) return true;
  const known = owners.filter((x): x is number => typeof x === "number");
  return known.length === 0 || known.includes(t.id);
}

const studentTeacher = (studentId: number | null | undefined) => (studentId ? (repo.getStudent(studentId)?.teacher_id ?? null) : null);
const unitTeacher = (unitId: number | null | undefined) =>
  unitId ? ((db().prepare("SELECT teacher_id FROM units WHERE id = ?").get(unitId) as { teacher_id: number | null } | undefined)?.teacher_id ?? null) : null;

export const worksheetOwners = (w: Pick<repo.Worksheet, "teacher_id" | "student_id">) => [w.teacher_id, studentTeacher(w.student_id)];
export function assignmentOwners(a: Pick<repo.Assignment, "worksheet_id" | "student_id" | "unit_id">) {
  return [repo.getWorksheet(a.worksheet_id)?.teacher_id ?? null, studentTeacher(a.student_id), unitTeacher(a.unit_id)];
}
export const textOwners = (x: { teacher_id: number | null; student_id: number }) => [x.teacher_id, studentTeacher(x.student_id)];

const now = () => new Date().toISOString();

/** An exercise or library entry: it leaves every list, and with it every student's copy of it. */
export function archiveWorksheet(id: number, t: Akteur): ArchivErgebnis {
  const w = repo.getWorksheet(id);
  if (!w) return { ok: false, error: WEG };
  if (!mayArchive(t, worksheetOwners(w))) return { ok: false, error: FREMD };
  db().prepare("UPDATE worksheets SET archived_at = COALESCE(archived_at, ?), archived_by = COALESCE(archived_by, ?) WHERE id = ?").run(now(), t.id, id);
  return { ok: true };
}

export function restoreWorksheet(id: number, t: Akteur): ArchivErgebnis {
  const w = repo.getWorksheet(id);
  if (!w) return { ok: false, error: WEG };
  if (!mayArchive(t, worksheetOwners(w))) return { ok: false, error: FREMD };
  db().prepare("UPDATE worksheets SET archived_at = NULL, archived_by = NULL WHERE id = ?").run(id);
  return { ok: true };
}

/** One student's copy of an exercise: the exercise itself and the other students' copies stay. */
export function archiveAssignment(id: number, t: Akteur): ArchivErgebnis {
  const a = repo.getAssignment(id);
  if (!a) return { ok: false, error: WEG };
  if (!mayArchive(t, assignmentOwners(a))) return { ok: false, error: FREMD };
  db().prepare("UPDATE assignments SET archived_at = COALESCE(archived_at, ?), archived_by = COALESCE(archived_by, ?) WHERE id = ?").run(now(), t.id, id);
  return { ok: true };
}

/** Takes the student's copy out of the archive; while the whole exercise is archived, that has to come back first. */
export function restoreAssignment(id: number, t: Akteur): ArchivErgebnis {
  const a = repo.getAssignment(id);
  if (!a) return { ok: false, error: WEG };
  if (!mayArchive(t, assignmentOwners(a))) return { ok: false, error: FREMD };
  if (repo.getWorksheet(a.worksheet_id)?.archived_at) return { ok: false, error: "Die ganze Übung ist archiviert. Hol sie unter Übungen › Archiv zurück." };
  db().prepare("UPDATE assignments SET archived_at = NULL, archived_by = NULL WHERE id = ?").run(id);
  return { ok: true };
}

/** A Textarbeit (also a Bildgeschichte or a Schreibauftrag): text, pictures, corrections and versions stay as they are. */
export function archiveText(id: number, t: Akteur): ArchivErgebnis {
  const x = getText(id);
  if (!x) return { ok: false, error: WEG };
  if (!mayArchive(t, textOwners(x))) return { ok: false, error: FREMD };
  db().prepare("UPDATE texts SET archived_at = COALESCE(archived_at, ?), archived_by = COALESCE(archived_by, ?) WHERE id = ?").run(now(), t.id, id);
  return { ok: true };
}

export function restoreText(id: number, t: Akteur): ArchivErgebnis {
  const x = getText(id);
  if (!x) return { ok: false, error: WEG };
  if (!mayArchive(t, textOwners(x))) return { ok: false, error: FREMD };
  db().prepare("UPDATE texts SET archived_at = NULL, archived_by = NULL WHERE id = ?").run(id);
  return { ok: true };
}
