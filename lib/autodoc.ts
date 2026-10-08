/**
 * Automatic documentation: every time a student works on an assignment, one
 * lesson entry of kind "selbststaendig" is created or refreshed for it.
 */
import { parseTime, taskScore } from "./analysis";
import { db } from "./db";
import { errorTypeLabel } from "./error-types";
import { carelessCredit } from "./lehrplan";
import * as repo from "./repo";

const pad = (n: number) => String(n).padStart(2, "0");
export function localStamp(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type AutoDoc = Omit<repo.LessonInput, "student_id" | "teacher_id">;

/** Builds the documentation text for one assignment from its attempts. Null when nothing was answered yet. */
export function describeAssignment(assignmentId: number): (AutoDoc & { student_id: number }) | null {
  const assignment = repo.getAssignment(assignmentId);
  if (!assignment) return null;
  const worksheet = repo.getWorksheet(assignment.worksheet_id);
  // practice inside a tutoring unit is documented with that unit (lib/learning.ts)
  // answers waiting for the teacher's grade are documented once they are graded
  const attempts = repo.listAttemptsForAssignment(assignmentId).filter((a) => !a.unit_id && a.review !== "offen");
  if (!worksheet || attempts.length === 0) return null;
  const tasks = repo.listTasks(worksheet.id);
  const skills = repo.listSkills();

  const finals = attempts.filter((a) => a.final);
  const correct = finals.filter((a) => a.correct);
  const firstTry = correct.filter((a) => a.attempt_no === 1 && !a.hints_used);
  const complete = Boolean(assignment.completed_at) || finals.length >= tasks.length;
  const totalMs = attempts.reduce((s, a) => s + a.time_ms, 0);
  const firstAt = Math.min(...attempts.map((a) => parseTime(a.created_at) - a.time_ms));
  // hints are counted per task (the solver reports how many were open at each try)
  const hintsPerTask = new Map<number, number>();
  for (const a of attempts) hintsPerTask.set(a.task_id, Math.max(hintsPerTask.get(a.task_id) ?? 0, a.hints_used));
  const hints = [...hintsPerTask.values()].reduce((s, n) => s + n, 0);
  const solutions = finals.filter((a) => a.solution_viewed).length;
  const skillIds = [...new Set(attempts.map((a) => a.skill_id).filter((x): x is string => Boolean(x)))];

  const errors = new Map<string, number>();
  for (const a of attempts) if (a.error_label) errors.set(a.error_label, (errors.get(a.error_label) ?? 0) + 1);
  const mistakes = [...errors].sort((a, b) => b[1] - a[1]).map(([label, n]) => (n > 1 ? `${label} (${n}×)` : label));
  // Fehlerarten of the wrong answers, the ones the teacher confirmed marked as such
  const types = new Map<string, { n: number; confirmed: boolean }>();
  for (const a of attempts) {
    if (a.correct || a.solution_viewed || !a.error_type) continue;
    const t = types.get(a.error_type) ?? { n: 0, confirmed: false };
    types.set(a.error_type, { n: t.n + 1, confirmed: t.confirmed || a.error_type_source === "lehrer" });
  }
  const typeText = [...types]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([type, t]) => {
      const more = [t.n > 1 ? `${t.n}×` : "", t.confirmed ? "" : "Vorschlag"].filter(Boolean);
      return `${errorTypeLabel(type)}${more.length ? ` (${more.join(", ")})` : ""}`;
    });

  // per skill: how well did it go? (Flüchtigkeitsfehler as set under Mehr › Datenqualität)
  const careless = carelessCredit();
  const perSkill = skillIds
    .map((id) => {
      const f = finals.filter((a) => a.skill_id === id);
      const score = f.length ? f.reduce((s, a) => s + taskScore(a, { careless }), 0) / f.length : null;
      const firstRight = f.filter((a) => a.correct && a.attempt_no === 1 && !a.hints_used).length;
      return { id, name: skills.find((s) => s.id === id)?.name ?? id, done: f.length, firstRight, score };
    })
    .filter((x) => x.score !== null);
  const avg = finals.length ? finals.reduce((s, a) => s + taskScore(a, { careless }), 0) / finals.length : null;
  const weakest = [...perSkill].sort((a, b) => a.score! - b.score!)[0];

  const activities =
    `Übung „${worksheet.title}“ selbstständig bearbeitet: ${finals.length} von ${tasks.length} Aufgaben erledigt, ` +
    `${correct.length} richtig (${firstTry.length} beim ersten Versuch ohne Hilfe).` +
    (complete ? "" : " Noch nicht fertig.");

  const notes: string[] = [];
  if (finals.length && totalMs >= finals.length * 1000) notes.push(`Durchschnittlich ${Math.round(totalMs / finals.length / 1000)} s pro Aufgabe.`);
  notes.push(hints === 0 ? "Keine Hilfen genutzt." : `${hints} ${hints === 1 ? "Hilfe" : "Hilfen"} genutzt.`);
  if (solutions) notes.push(`${solutions}× Lösung angesehen statt selbst gelöst.`);
  if (typeText.length) notes.push(`Fehlerarten: ${typeText.join(", ")}.`);
  if (perSkill.length > 1 && weakest && weakest.firstRight < weakest.done)
    notes.push(`Am schwierigsten: ${weakest.name} (${weakest.firstRight} von ${weakest.done} beim ersten Versuch richtig).`);

  return {
    student_id: assignment.student_id,
    kind: "selbststaendig",
    assignment_id: assignment.id,
    starts_at: localStamp(firstAt),
    duration_min: Math.max(1, Math.round(totalMs / 60_000)),
    subject: worksheet.subject,
    topic: worksheet.topic || worksheet.title,
    status: "abgeschlossen",
    activities,
    mistakes: mistakes.join("\n"),
    understanding: complete && avg !== null ? Math.max(1, Math.min(5, 1 + Math.round(avg * 4))) : null,
    tutor_notes: notes.join(" "),
    next_steps: complete && weakest && weakest.score! < 0.6 ? `${weakest.name} wiederholen.` : "",
    skill_ids: skillIds,
  };
}

/** Creates or refreshes the automatic entry for an assignment. */
export function documentAssignment(assignmentId: number): number | null {
  const doc = describeAssignment(assignmentId);
  if (!doc) return null;
  const student = repo.getStudent(doc.student_id);
  const existing = repo.getLessonForAssignment(assignmentId);
  return repo.saveLesson({ ...doc, teacher_id: existing?.teacher_id ?? student?.teacher_id ?? null }, existing?.id);
}

/** Same-day automatic entries, used to prefill the documentation of a tutoring lesson. */
export function practiceOnDay(studentId: number, day: string): repo.Lesson[] {
  return repo.listLessons(studentId).filter((l) => l.kind === "selbststaendig" && l.starts_at.slice(0, 10) === day);
}

let backfilled = false;
/** Databases from before automatic documentation: write the missing entries once per server start. */
export function backfillAutoDocs() {
  if (backfilled) return;
  backfilled = true;
  const missing = db()
    .prepare("SELECT DISTINCT a.assignment_id AS id FROM attempts a WHERE NOT EXISTS (SELECT 1 FROM lessons l WHERE l.assignment_id = a.assignment_id)")
    .all() as { id: number }[];
  for (const { id } of missing) documentAssignment(id);
}
