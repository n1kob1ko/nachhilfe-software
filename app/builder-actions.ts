"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import {
  blankTask,
  checkTask,
  copyAsDraft,
  createDraft,
  draftFromTemplate,
  normalizeTask,
  regenerateTask,
  releaseWorksheet,
  saveTemplate,
  sendSingleTask,
  settingsFromForm,
} from "@/lib/builder";
import { DIFFICULTIES, type Difficulty, type TaskType, TASK_TYPES } from "@/lib/curriculum";
import { noteActivity } from "@/lib/learning";
import * as repo from "@/lib/repo";
import type { TaskDraft } from "@/lib/tasks";
import { canManageUnit, getUnit, runningUnitForStudent } from "@/lib/units";
import { ensureBoardForUnit, queueInsert } from "@/lib/whiteboard";
import { boardTask } from "@/lib/whiteboard-content";

export type ActionResult = { ok?: string; error?: string; warning?: string } | null;

const editable = (taskId: number) => {
  const t = repo.getTask(taskId);
  if (!t) return { error: "Aufgabe nicht gefunden." } as const;
  if (repo.worksheetAttemptCount(t.worksheet_id) > 0) return { error: "Diese Übung wurde schon bearbeitet. Mit „Anpassen“ entsteht eine Kopie, die du ändern kannst." } as const;
  return { task: t } as const;
};
const refresh = (worksheetId: number) => revalidatePath(`/uebungen/${worksheetId}`);

// ---------- builder ----------
export async function createDraftAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const s = settingsFromForm(form);
  const empty = form.get("mode") === "leer";
  if (!s.subject) return { error: "Bitte ein Fach wählen." };
  if (!empty && !s.skillIds.length) return { error: "Bitte mindestens eine Fähigkeit wählen." };
  let out: Awaited<ReturnType<typeof createDraft>>;
  try {
    out = await createDraft(s, teacher.id, { empty });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Die Übung konnte nicht erstellt werden." };
  }
  revalidatePath("/uebungen");
  redirect(`/uebungen/${out.id}${out.aiError ? "?hinweis=ki" : ""}`);
}

export async function useTemplateAction(form: FormData) {
  const teacher = await requireTeacher();
  const out = await draftFromTemplate(Number(form.get("template_id")), Number(form.get("student_id")) || null, teacher.id);
  if (!out.id) throw new Error(out.error ?? "Vorlage konnte nicht verwendet werden.");
  revalidatePath("/uebungen");
  redirect(`/uebungen/${out.id}${out.aiError ? "?hinweis=ki" : ""}`);
}

export async function deleteTemplateAction(id: number) {
  await requireTeacher();
  repo.deleteTemplate(id);
  revalidatePath("/uebungen", "layout");
}

// ---------- preview editor ----------
export async function saveTaskAction(taskId: number, draft: TaskDraft): Promise<ActionResult> {
  await requireTeacher();
  const e = editable(taskId);
  if ("error" in e) return { error: e.error };
  if (!(draft.type in TASK_TYPES) || draft.type === ("mixed" as TaskType)) return { error: "Unbekanntes Antwortformat." };
  const t = normalizeTask({ ...draft, prompt: String(draft.prompt ?? "").slice(0, 4000) });
  repo.updateTask(taskId, t);
  refresh(e.task.worksheet_id);
  const problem = checkTask(t);
  return problem ? { warning: `Gespeichert. Vor dem Freigeben noch: ${problem}` } : { ok: "Gespeichert." };
}

export async function deleteTaskAction(taskId: number): Promise<ActionResult> {
  await requireTeacher();
  const e = editable(taskId);
  if ("error" in e) return { error: e.error };
  repo.deleteTask(taskId);
  refresh(e.task.worksheet_id);
  return { ok: "Aufgabe gelöscht." };
}

export async function moveTaskAction(taskId: number, dir: -1 | 1): Promise<ActionResult> {
  await requireTeacher();
  const e = editable(taskId);
  if ("error" in e) return { error: e.error };
  repo.moveTask(taskId, dir === -1 ? -1 : 1);
  refresh(e.task.worksheet_id);
  return null;
}

export type NewTask = { format: TaskType; skillId: string | null; category: string | null; difficulty: Difficulty } | { copyFrom: number };

/** Adds a blank task of a format, or a copy of a task from another exercise, after a task (or at the end). */
export async function addTaskAction(worksheetId: number, what: NewTask, afterTaskId?: number): Promise<ActionResult & { id?: number }> {
  await requireTeacher();
  if (!repo.getWorksheet(worksheetId)) return { error: "Übung nicht gefunden." };
  if (repo.worksheetAttemptCount(worksheetId) > 0) return { error: "Diese Übung wurde schon bearbeitet. Mit „Anpassen“ entsteht eine Kopie, die du ändern kannst." };
  let draft: TaskDraft;
  if ("copyFrom" in what) {
    const src = repo.getTask(what.copyFrom);
    if (!src) return { error: "Aufgabe nicht gefunden." };
    const { id: _i, worksheet_id: _w, position: _p, ...rest } = src;
    void _i, void _w, void _p;
    draft = rest;
  } else {
    if (!(what.format in TASK_TYPES)) return { error: "Unbekanntes Antwortformat." };
    draft = blankTask(what.format, what.skillId, what.category, (DIFFICULTIES as readonly string[]).includes(what.difficulty) ? what.difficulty : "mittel");
  }
  const id = repo.addTask(worksheetId, draft, afterTaskId);
  refresh(worksheetId);
  return { ok: "copyFrom" in what ? "Aufgabe übernommen." : "Neue Aufgabe angelegt.", id };
}

export async function regenerateTaskAction(taskId: number, difficulty?: Difficulty): Promise<ActionResult> {
  await requireTeacher();
  const e = editable(taskId);
  if ("error" in e) return { error: e.error };
  const d = difficulty && (DIFFICULTIES as readonly string[]).includes(difficulty) ? difficulty : undefined;
  const out = await regenerateTask(taskId, { difficulty: d });
  refresh(e.task.worksheet_id);
  if (!out.ok) return { error: out.aiError ?? "Für diese Fähigkeit konnte keine neue Aufgabe erstellt werden." };
  return out.aiError ? { warning: "Claude war nicht erreichbar, die neue Aufgabe kommt aus dem Generator." } : { ok: "Neue Aufgabe erstellt." };
}

export async function searchTasksAction(worksheetId: number, text: string) {
  await requireTeacher();
  const w = repo.getWorksheet(worksheetId);
  if (!w) return [];
  return repo
    .searchTasks({ skillIds: w.skill_ids, subject: w.subject, text, excludeWorksheetId: worksheetId, limit: 12 })
    .map((t) => ({ id: t.id, prompt: t.prompt, type: t.type, difficulty: t.difficulty, skillId: t.skillId, worksheetTitle: t.worksheet_title }));
}

export async function renameWorksheetAction(worksheetId: number, title: string): Promise<ActionResult> {
  await requireTeacher();
  if (!title.trim()) return { error: "Der Titel darf nicht leer sein." };
  repo.updateWorksheetMeta(worksheetId, { title: title.trim().slice(0, 120) });
  refresh(worksheetId);
  revalidatePath("/uebungen");
  return { ok: "Titel gespeichert." };
}

// ---------- release & reuse ----------
export async function releaseAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireTeacher();
  const worksheetId = Number(form.get("worksheet_id"));
  const studentId = Number(form.get("student_id")) || null;
  const out = releaseWorksheet(worksheetId, studentId);
  if (out.error) return { error: out.error };
  if (studentId) noteActivity(studentId);
  revalidatePath("/", "layout");
  // during a unit the teacher goes back to it: that is where the results come in
  const unit = studentId ? runningUnitForStudent(studentId) : null;
  redirect(unit ? `/einheiten/${unit.id}?gesendet=${worksheetId}` : `/uebungen/${worksheetId}?gesendet=${studentId ?? 0}`);
}

export async function copyAsDraftAction(form: FormData) {
  const teacher = await requireTeacher();
  const id = copyAsDraft(Number(form.get("worksheet_id")), Number(form.get("student_id")) || null, teacher.id);
  if (!id) throw new Error("Übung nicht gefunden.");
  revalidatePath("/uebungen");
  redirect(`/uebungen/${id}`);
}

export async function saveTemplateAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Bitte einen Namen für die Vorlage eingeben." };
  const id = saveTemplate(Number(form.get("worksheet_id")), name, form.get("with_tasks") === "on", teacher.id);
  if (!id) return { error: "Übung nicht gefunden." };
  revalidatePath("/uebungen", "layout");
  return { ok: `Vorlage „${name}“ gespeichert.` };
}

export async function setSolutionsVisibleAction(assignmentId: number, visible: boolean) {
  await requireTeacher();
  const a = repo.getAssignment(assignmentId);
  if (!a) return;
  repo.setSolutionsVisible(assignmentId, visible);
  revalidatePath(`/uebungen/${a.worksheet_id}`);
  revalidatePath("/lernen", "layout");
}

// ---------- single tasks ----------
export async function sendTaskToStudentAction(taskId: number, studentId: number): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const out = sendSingleTask(taskId, studentId, teacher.id);
  if (out.error) return { error: out.error };
  noteActivity(studentId);
  revalidatePath("/", "layout");
  return { ok: `An ${repo.getStudent(studentId)?.name ?? "den Schüler"} gesendet.` };
}

/** "Auf Whiteboard senden" for one task; without a unit id it uses the student's running unit. */
export async function sendTaskToBoardAction(taskId: number, unitId: number): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const task = repo.getTask(taskId);
  const unit = getUnit(unitId);
  if (!task) return { error: "Aufgabe nicht gefunden." };
  if (!unit || unit.status !== "gestartet") return { error: "Diese Einheit läuft nicht mehr." };
  if (!canManageUnit(teacher, unit)) return { error: "Nur der Lehrer dieser Einheit kann auf dieses Whiteboard senden." };
  const board = ensureBoardForUnit(unit.id);
  if (!board) return { error: "Das Whiteboard konnte nicht geöffnet werden." };
  queueInsert(board.id, { kind: "tasks", title: repo.getWorksheet(task.worksheet_id)?.title ?? "Aufgabe", tasks: [boardTask(task)] });
  return { ok: `Auf dem Whiteboard von ${unit.student_name}.` };
}

// ---------- student side ----------
/** A student opened hint n (0-based) of a task. Stored once per hint, so the teacher sees which help was needed. */
export async function recordHintAction(token: string, assignmentId: number, taskId: number, hintIndex: number) {
  const student = repo.getStudentByToken(token);
  const a = repo.getAssignment(assignmentId);
  const t = repo.getTask(taskId);
  if (!student || !a || !t || a.student_id !== student.id || t.worksheet_id !== a.worksheet_id) return;
  if (!Number.isInteger(hintIndex) || hintIndex < 0 || hintIndex >= t.hints.length) return;
  repo.recordHintUse({ assignment_id: a.id, task_id: t.id, student_id: student.id, hint_index: hintIndex, unit_id: runningUnitForStudent(student.id)?.id ?? a.unit_id });
}
