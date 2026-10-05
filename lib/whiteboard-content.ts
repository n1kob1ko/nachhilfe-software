/** App content prepared for the whiteboard (server side). Task positions count from 1. */
import * as repo from "./repo";
import type { TaskForBoard } from "./whiteboard-templates";

export function boardTask(t: repo.Task): TaskForBoard {
  return { number: t.position, prompt: t.prompt, options: t.data.options ?? null, solution: t.solution };
}

/** The student's most recent exercises, for the teacher's "Einfügen" panel. */
export function worksheetsForBoard(studentId: number, limit = 8) {
  const seen = new Set<number>();
  const out: { id: number; title: string; tasks: TaskForBoard[] }[] = [];
  for (const a of repo.listAssignments(studentId)) {
    if (seen.has(a.worksheet_id) || out.length >= limit) continue;
    seen.add(a.worksheet_id);
    out.push({ id: a.worksheet_id, title: a.title, tasks: repo.listTasks(a.worksheet_id).map(boardTask) });
  }
  return out;
}
