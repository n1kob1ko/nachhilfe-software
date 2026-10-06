import { notFound } from "next/navigation";
import { Solver } from "@/components/Solver";
import * as repo from "@/lib/repo";
import { MAX_TRIES } from "@/lib/service";
import { clientTasks } from "@/lib/solver-tasks";

export default async function SolvePage({ params }: { params: Promise<{ token: string; aid: string }> }) {
  const { token, aid } = await params;
  const student = repo.getStudentByToken(token);
  const assignment = repo.getAssignment(Number(aid));
  if (!student || !assignment || assignment.student_id !== student.id) notFound();
  const w = repo.getWorksheet(assignment.worksheet_id)!;
  return <Solver token={token} assignmentId={assignment.id} title={w.title} tasks={clientTasks(assignment)} maxTries={MAX_TRIES} />;
}
