import type { ClientTask } from "@/components/Solver";
import { answerText } from "@/components/TaskPreview";
import * as repo from "./repo";

/**
 * The tasks of an assignment as the student sees them: no answers, no solutions until a task is
 * finished or the teacher has released them. Used by the student link and by the tablet.
 */
export function clientTasks(assignment: repo.Assignment): ClientTask[] {
  const w = repo.getWorksheet(assignment.worksheet_id)!;
  const attempts = repo.listAttemptsForAssignment(assignment.id);
  const hintUses = repo.hintUsesForAssignment(assignment.id);
  return repo.listTasks(w.id).map((t) => {
    const tries = attempts.filter((a) => a.task_id === t.id);
    const fin = tries.find((a) => a.final);
    return {
      id: t.id,
      type: t.type,
      prompt: t.prompt,
      options: t.data.options ?? null,
      passage: t.data.passage ?? null,
      blanks: t.answer.blanks?.length ?? 0,
      steps: t.type === "order" ? (t.data.steps ?? null) : null,
      hints: t.hints,
      hintsOpened: new Set(hintUses.filter((h) => h.task_id === t.id).map((h) => h.hint_index)).size,
      released: assignment.solutions_visible ? { solution: t.solution, answer: answerText(t) ?? t.answer.sample ?? null } : null,
      triesUsed: tries.length,
      finished: fin ? { correct: Boolean(fin.correct), solution: t.solution } : null,
    };
  });
}
