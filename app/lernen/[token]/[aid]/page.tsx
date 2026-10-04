import { notFound } from "next/navigation";
import { Solver, type ClientTask } from "@/components/Solver";
import * as repo from "@/lib/repo";
import { MAX_TRIES } from "@/lib/service";

export default async function SolvePage({ params }: { params: Promise<{ token: string; aid: string }> }) {
  const { token, aid } = await params;
  const student = repo.getStudentByToken(token);
  const assignment = repo.getAssignment(Number(aid));
  if (!student || !assignment || assignment.student_id !== student.id) notFound();
  const w = repo.getWorksheet(assignment.worksheet_id)!;
  const attempts = repo.listAttemptsForAssignment(assignment.id);
  // Only what the student needs to see: no answers, no solutions until a task is finished.
  const tasks: ClientTask[] = repo.listTasks(w.id).map((t) => {
    const tries = attempts.filter((a) => a.task_id === t.id);
    const fin = tries.find((a) => a.final);
    return {
      id: t.id,
      type: t.type,
      prompt: t.prompt,
      options: t.data.options ?? null,
      passage: t.data.passage ?? null,
      blanks: t.answer.blanks?.length ?? 0,
      hints: t.hints,
      triesUsed: tries.length,
      finished: fin ? { correct: Boolean(fin.correct), solution: t.solution } : null,
    };
  });
  return <Solver token={token} assignmentId={assignment.id} title={w.title} tasks={tasks} maxTries={MAX_TRIES} />;
}
