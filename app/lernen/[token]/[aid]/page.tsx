import { notFound } from "next/navigation";
import { Solver } from "@/components/Solver";
import { StudentQuickRound } from "@/components/StudentQuickRound";
import * as repo from "@/lib/repo";
import { isMinitest, showsQuickRound } from "@/lib/quick-round";
import { triesFor } from "@/lib/service";
import { clientTasks } from "@/lib/solver-tasks";

export default async function SolvePage({ params }: { params: Promise<{ token: string; aid: string }> }) {
  const { token, aid } = await params;
  const student = repo.getStudentByToken(token);
  const assignment = repo.getAssignment(Number(aid));
  if (!student || !assignment || assignment.student_id !== student.id) notFound();
  const w = repo.getWorksheet(assignment.worksheet_id)!;
  const tasks = clientTasks(assignment);
  // Schnellrunde nur, wenn der Lehrer sie so gesendet hat und die Aufgaben es hergeben (lib/quick-round.ts);
  // sonst der übliche Ablauf, unverändert.
  if (showsQuickRound(assignment.mode, tasks))
    return <StudentQuickRound token={token} assignmentId={assignment.id} title={w.title} tasks={tasks} />;
  return <Solver token={token} assignmentId={assignment.id} title={w.title} tasks={tasks} maxTries={triesFor(assignment.mode)} test={isMinitest(assignment.mode)} probe={Boolean(w.probe_test_id)} />;
}
