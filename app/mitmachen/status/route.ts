import { laptopContext } from "@/lib/laptop-context";
import { markDelivered, noteProgress, unitAssignment } from "@/lib/live";
import * as repo from "@/lib/repo";

/** The laptop reports which task is open, for the live status on the teacher's screen. */
export async function POST(request: Request) {
  const ctx = await laptopContext();
  if (!ctx) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { assignmentId?: number; taskId?: number; taskNo?: number };
  const a = unitAssignment(ctx.unit.id, Number(body.assignmentId));
  const task = repo.getTask(Number(body.taskId));
  if (!a || !task || task.worksheet_id !== a.worksheet_id) return Response.json({ ok: false }, { status: 404 });
  markDelivered(a.id);
  noteProgress(ctx.unit.id, { assignmentId: a.id, taskId: task.id, taskNo: Math.max(1, Math.min(Number(body.taskNo) || 1, a.task_count)), total: a.task_count });
  return Response.json({ ok: true });
}
