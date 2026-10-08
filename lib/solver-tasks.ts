import type { ClientTask } from "@/components/Solver";
import { answerText } from "@/components/TaskPreview";
import { closestVersion } from "./fix-text";
import { readingSet } from "./lesen";
import { gradeMathTask, unknownOf } from "./math-task";
import * as repo from "./repo";
import { runningUnitForStudent } from "./units";

/**
 * The tasks of an assignment as the student sees them: no answers, no solutions until a task is
 * finished or the teacher has released them. Used by the student link and by the tablet.
 */
export function clientTasks(assignment: repo.Assignment): ClientTask[] {
  const w = repo.getWorksheet(assignment.worksheet_id)!;
  const attempts = repo.listAttemptsForAssignment(assignment.id);
  const hintUses = repo.hintUsesForAssignment(assignment.id);
  const board = Boolean(runningUnitForStudent(assignment.student_id));
  const list = repo.listTasks(w.id);
  // a Leseverständnis: the text is sent once (with the first question) and shown next to the questions
  const reading = readingSet(list);
  return list.map((t, i) => {
    const tries = attempts.filter((a) => a.task_id === t.id);
    const fin = tries.find((a) => a.final);
    return {
      id: t.id,
      type: t.type,
      prompt: t.prompt,
      options: t.data.options ?? null,
      passage: reading ? null : (t.data.passage ?? null),
      reading: reading && i === 0 ? { ...reading, lang: w.subject === "Englisch" ? "en" : "de" } : null,
      blanks: t.answer.blanks?.length ?? 0,
      steps: t.type === "order" ? (t.data.steps ?? null) : null,
      hints: t.hints,
      hintsOpened: new Set(hintUses.filter((h) => h.task_id === t.id).map((h) => h.hint_index)).size,
      released: assignment.solutions_visible ? { solution: t.solution, answer: answerText(t) ?? t.answer.sample ?? null } : null,
      triesUsed: tries.length,
      faulty: t.type === "fix" ? (t.data.faulty ?? "") : null,
      lines: t.type === "free" ? (t.data.lines ?? null) : null,
      math:
        t.type === "rechenweg" || t.type === "sachaufgabe"
          ? {
              start: t.data.start?.trim() || null,
              unknown: t.type === "rechenweg" ? unknownOf(t) : null,
              needWay: t.answer.needWay !== false,
              parts: t.type === "sachaufgabe" ? (t.data.parts ?? []) : null,
              board,
            }
          : null,
      finished: fin
        ? {
            correct: fin.review === "offen" ? null : Boolean(fin.correct),
            solution: t.solution,
            review: fin.review ?? null,
            sample: t.answer.sample ?? null,
            given: t.type === "fix" && !fin.solution_viewed ? fin.answer : null,
            expected: t.type === "fix" ? (closestVersion(t.answer.accepted ?? [], fin.answer, t.answer.mode !== "text") ?? null) : null,
            // the student's own lines with the marks of the check
            math: (t.type === "rechenweg" || t.type === "sachaufgabe") && !fin.solution_viewed ? gradeMathTask(t, fin.answer).view : null,
          }
        : null,
    };
  });
}
