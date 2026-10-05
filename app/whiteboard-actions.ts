"use server";

import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { canManageUnit, getUnit } from "@/lib/units";
import { ensureBoardForUnit, queueInsert } from "@/lib/whiteboard";
import { boardTask } from "@/lib/whiteboard-content";

export type SendState = { ok?: string; error?: string } | null;

/** "Auf Whiteboard senden": puts tasks of an exercise onto the board of a running unit as editable text. */
export async function sendToBoardAction(_prev: SendState, form: FormData): Promise<SendState> {
  const teacher = await requireTeacher();
  const unit = getUnit(Number(form.get("unit_id")));
  if (!unit || unit.status !== "gestartet") return { error: "Diese Einheit läuft nicht mehr." };
  if (!canManageUnit(teacher, unit)) return { error: "Nur der Lehrer dieser Einheit kann auf dieses Whiteboard senden." };
  const worksheet = repo.getWorksheet(Number(form.get("worksheet_id")));
  if (!worksheet) return { error: "Übung nicht gefunden." };
  const wanted = new Set(form.getAll("task_id").map(Number));
  const tasks = repo.listTasks(worksheet.id).filter((t) => wanted.size === 0 || wanted.has(t.id));
  if (!tasks.length) return { error: "Bitte mindestens eine Aufgabe wählen." };
  const board = ensureBoardForUnit(unit.id);
  if (!board) return { error: "Das Whiteboard konnte nicht geöffnet werden." };
  queueInsert(board.id, { kind: "tasks", title: worksheet.title, tasks: tasks.map(boardTask) });
  return { ok: `${tasks.length === 1 ? "Aufgabe" : `${tasks.length} Aufgaben`} aufs Whiteboard von ${unit.student_name} gesendet.` };
}
