/**
 * Bewerten am Whiteboard (niko, 19.10.2026: „wie wird dann das geprüft wenn der Schüler am Whiteboard die aufgabe
 * löst“). Maths is worked out on the board with the pen, not typed. The teacher sees the working live and grades
 * each task of an exercise sent to the board with one tap: richtig, teilweise or falsch.
 *
 * - The grade is a Lehrerbewertung like the one of a free answer: it is the task's last answer, counts for the
 *   Lernstand (teilweise half, lib/mastery.ts) and goes into the automatic Dokumentation.
 * - It is stored on the student's assignment of that exercise; without one (the exercise only went to the board)
 *   the assignment is made, in the running unit.
 * - A task the student already finished in the exercise gets the teacher's grade instead: the board is where it
 *   was worked out. A task whose solution the student looked at stays as it is.
 * - The KI never grades: „KI prüfen“ (lib/whiteboard-check.ts) only suggests, the teacher takes it over here.
 */
import { documentAssignment } from "./autodoc";
import { levelOf } from "./curriculum";
import { db } from "./db";
import * as repo from "./repo";
import { isReview, type Review } from "./tasks";

/** The answer text of a task graded at the board (it shows in the Lernverlauf and the Dokumentation). */
export const BOARD_ANSWER = "Am Whiteboard gerechnet";
const BOARD_FEEDBACK = "Am Whiteboard gerechnet, vom Lehrer bewertet.";

/** How a task stands for the task bar on the board. */
export type BoardGrade = Review | "offen" | "loesung";

/** The newest assignment of this exercise for the student, or null. */
function assignmentFor(studentId: number, worksheetId: number) {
  return repo.listAssignments(studentId).find((a) => a.worksheet_id === worksheetId) ?? null;
}

/**
 * The grade of each task the board shows, from the student's newest assignment of its exercise: the teacher's
 * grade, or how the app checked the finished answer. Tasks without a finished answer are left out.
 */
export function boardGrades(studentId: number, taskIds: number[]): Record<number, BoardGrade> {
  const out: Record<number, BoardGrade> = {};
  const ids = [...new Set(taskIds.filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200);
  if (!ids.length) return out;
  const rows = db()
    .prepare(
      `SELECT x.task_id, x.correct, x.review, x.solution_viewed FROM attempts x
       WHERE x.student_id = ? AND x.final = 1 AND x.task_id IN (${ids.map(() => "?").join(",")})
         AND x.assignment_id = (SELECT a.id FROM assignments a JOIN tasks t ON t.worksheet_id = a.worksheet_id
                                WHERE t.id = x.task_id AND a.student_id = x.student_id ORDER BY a.assigned_at DESC, a.id DESC LIMIT 1)
       ORDER BY x.id`,
    )
    .all(studentId, ...ids) as { task_id: number; correct: number; review: string | null; solution_viewed: number }[];
  for (const r of rows) {
    out[r.task_id] = r.solution_viewed ? "loesung" : r.review === "offen" ? "offen" : isReview(r.review) ? r.review : r.correct ? "richtig" : "falsch";
  }
  return out;
}

/** The teacher grades one task the student worked out on the board. */
export function gradeBoardTask(o: { studentId: number; unitId: number; teacherId: number; taskId: number; review: unknown }): { ok: true; grade: Review } | { error: string } {
  if (!isReview(o.review)) return { error: "Unbekannte Bewertung." };
  const review = o.review;
  const task = repo.getTask(o.taskId);
  if (!task) return { error: "Diese Aufgabe gibt es nicht mehr." };
  const assignmentId = assignmentFor(o.studentId, task.worksheet_id)?.id ?? repo.assignWorksheet(task.worksheet_id, o.studentId, "Am Whiteboard", o.unitId);

  const result = db().transaction((): { ok: true } | { error: string } => {
    const before = repo.listAttemptsForAssignment(assignmentId).filter((a) => a.task_id === task.id);
    const done = before.find((a) => a.final);
    if (done) {
      if (done.solution_viewed) return { error: "Der Schüler hat sich bei dieser Aufgabe schon die Lösung angesehen." };
      repo.setAttemptReview(done.id, review, o.teacherId);
      return { ok: true };
    }
    repo.markAssignmentStarted(assignmentId);
    const attemptId = repo.recordAttempt({
      assignment_id: assignmentId,
      task_id: task.id,
      student_id: o.studentId,
      skill_id: task.skillId,
      attempt_no: before.length + 1,
      answer: BOARD_ANSWER,
      correct: review === "richtig" ? 1 : 0,
      final: 1,
      time_ms: 0,
      hints_used: 0,
      solution_viewed: 0,
      error_label: null,
      feedback: BOARD_FEEDBACK,
      unit_id: o.unitId,
      teacher_id: o.teacherId,
      level: task.level ?? levelOf(task.difficulty),
    });
    // who graded and when, the same as a Lehrerbewertung in the Lernverlauf
    repo.setAttemptReview(attemptId, review, o.teacherId);
    repo.completeAssignmentIfDone(assignmentId);
    return { ok: true };
  })();
  if ("error" in result) return result;
  documentAssignment(assignmentId);
  return { ok: true, grade: review };
}
