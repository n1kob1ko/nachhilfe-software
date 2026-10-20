"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { newExerciseForUnit, onHint } from "@/lib/ai/realtime";
import { requireTeacher } from "@/lib/auth";
import { sendSingleTask, releaseWorksheet } from "@/lib/builder";
import { clientIp } from "@/lib/client-ip";
import { deviceContext } from "@/lib/device-context";
import { canManageDevice, createPairCode, getDevice, pairDevice, renameDevice, revokeDevice, setDeviceCookie } from "@/lib/devices";
import { noteActivity } from "@/lib/learning";
import { moveTablet, resendUnit, nextTaskAfter, notifyDevice, notifyStudent, parseView, pushLive, pushTabletPresence, showOnTablet, unitAssignment, unitAssignments, unitText, type Delivery } from "@/lib/live";
import * as repo from "@/lib/repo";
import { submitAnswer, type SubmitInput } from "@/lib/service";
import { canManageUnit, getUnit, unitForSend } from "@/lib/units";
import { ensureBoardForUnit, queueInsert } from "@/lib/whiteboard";
import { boardTaskForStudent } from "@/lib/whiteboard-content";

// ---------- tablet side ----------

export type PairState = { error?: string } | null;

/** The tablet enters the code shown on the teacher's laptop. */
export async function pairDeviceAction(_prev: PairState, form: FormData): Promise<PairState> {
  const out = pairDevice(String(form.get("code") ?? ""), clientIp(await headers()));
  if ("error" in out) return { error: out.error };
  await setDeviceCookie(out.token);
  pushTabletPresence(out.device.teacher_id);
  revalidatePath("/mehr/geraete");
  redirect("/geraet");
}

/**
 * „Wer arbeitet an diesem Gerät?“ (D26): two units of the tablet's teacher run, the student taps their
 * name. Only a running unit of the tablet's own teacher can be chosen. `unit_id` empty: ask again.
 */
export async function chooseDeviceUnitAction(form: FormData) {
  const ctx = await deviceContext();
  if (!ctx) redirect("/geraet");
  const raw = Number(form.get("unit_id"));
  moveTablet(ctx.device.id, Number.isInteger(raw) && raw > 0 ? raw : null);
  redirect("/geraet");
}

/** The exercise must belong to the unit the tablet shows (a running unit of its teacher). */
async function tabletAssignment(assignmentId: number) {
  const ctx = await deviceContext();
  if (!ctx?.unit || !ctx.student) throw new Error("Gerade läuft keine Einheit.");
  const a = unitAssignment(ctx.unit.id, assignmentId);
  if (!a) throw new Error("Aufgabe nicht gefunden.");
  return { ...ctx, unit: ctx.unit, student: ctx.student, assignment: a };
}

export async function deviceSubmitAnswerAction(input: Omit<SubmitInput, "token">) {
  const { student, unit } = await tabletAssignment(input.assignmentId);
  const res = await submitAnswer({ ...input, token: student.access_token });
  pushLive(unit.id);
  return res;
}

export async function deviceRecordHintAction(assignmentId: number, taskId: number, hintIndex: number) {
  const { student, unit, assignment } = await tabletAssignment(assignmentId);
  const t = repo.getTask(taskId);
  if (!t || t.worksheet_id !== assignment.worksheet_id || !Number.isInteger(hintIndex) || hintIndex < 0 || hintIndex >= t.hints.length) return;
  repo.recordHintUse({ assignment_id: assignment.id, task_id: t.id, student_id: student.id, hint_index: hintIndex, unit_id: unit.id });
  pushLive(unit.id);
  onHint({ unitId: unit.id, teacherId: unit.teacher_id, taskId: t.id, assignmentId: assignment.id, hintIndex });
}

// ---------- teacher side: devices ----------

/** "Neues Tablet verbinden": a one-time code; admins may create one for a colleague. */
export async function createPairCodeAction(form: FormData) {
  const t = await requireTeacher();
  const forId = Number(form.get("teacher_id")) || t.id;
  const target = t.is_admin ? (repo.getTeacher(forId) ?? t) : t;
  createPairCode(target.id, t.id);
  redirect(`/mehr/geraete?code=${target.id}`);
}

async function manageableDevice(id: number) {
  const t = await requireTeacher();
  const d = getDevice(id);
  if (!d || !canManageDevice(t, d)) redirect("/mehr/geraete");
  return d;
}

export async function renameDeviceAction(id: number, form: FormData) {
  await manageableDevice(id);
  renameDevice(id, String(form.get("name") ?? ""));
  revalidatePath("/mehr/geraete");
}

export async function revokeDeviceAction(id: number) {
  const d = await manageableDevice(id);
  revokeDevice(id);
  // the tablet reloads and finds its cookie no longer valid
  notifyDevice(d.id, "getrennt");
  pushTabletPresence(d.teacher_id);
  revalidatePath("/mehr/geraete");
}

// ---------- teacher side: sending to the tablet ----------

export type SendState = (Delivery & { assignmentId?: number; unitId?: number; student?: string }) | { status: "fehler"; error: string } | null;

/**
 * "An Anna senden": the exercise goes to the student of a running unit of the teacher, on the tablet
 * of that unit (or the student's laptop). With two units at once (D26) the button names the unit; it is
 * the unit of the exercise's student when there is one. An offline tablet (or, without a tablet, the
 * student's link) gets it as soon as it is opened, but the send does not count as delivered until then.
 */
export async function sendToTabletAction(_prev: SendState, form: FormData): Promise<SendState> {
  const t = await requireTeacher();
  const worksheetId = Number(form.get("worksheet_id"));
  const taskId = Number(form.get("task_id"));
  const sheet = taskId ? repo.getWorksheet(repo.getTask(taskId)?.worksheet_id ?? 0) : repo.getWorksheet(worksheetId);
  const unit = unitForSend(t.id, Number(form.get("unit_id")) || null, sheet?.student_id ?? null);
  if ("error" in unit) return { status: "fehler", error: unit.error };
  const out = taskId ? sendSingleTask(taskId, unit.student_id, t.id) : releaseWorksheet(worksheetId, unit.student_id);
  if (out.error || !out.assignmentId) return { status: "fehler", error: out.error ?? "Senden fehlgeschlagen." };
  noteActivity(unit.student_id);
  const sent = showOnTablet(unit, { kind: "aufgabe", assignmentId: out.assignmentId });
  revalidatePath("/", "layout");
  return { ...sent, assignmentId: out.assignmentId, unitId: unit.id, student: unit.student_name.split(" ")[0] };
}

/** "Erneut senden" after the tablet was offline: shows the same exercise again, no copy, in the unit it was sent in. */
export async function resendAction(assignmentId: number): Promise<SendState> {
  const t = await requireTeacher();
  const unit = resendUnit(t.id, assignmentId);
  if (!unit) return { status: "fehler", error: "Diese Übung gehört nicht zur laufenden Einheit." };
  return { ...showOnTablet(unit, { kind: "aufgabe", assignmentId }), assignmentId, unitId: unit.id, student: unit.student_name.split(" ")[0] };
}

async function managedRunningUnit(unitId: number) {
  const t = await requireTeacher();
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet" || !canManageUnit(t, unit)) throw new Error("Diese Einheit läuft nicht.");
  return { t, unit };
}

/**
 * „Tablet für Anna“ on the unit page (D26): the teacher puts one of their tablets on one of their
 * running units, or back to „Wer arbeitet an diesem Gerät?“ (unitId null).
 */
export async function assignTabletAction(deviceId: number, unitId: number | null) {
  const t = await requireTeacher();
  const d = getDevice(deviceId);
  if (!d || !canManageDevice(t, d)) return;
  if (unitId !== null) {
    const unit = getUnit(unitId);
    if (!unit || unit.teacher_id !== d.teacher_id || !canManageUnit(t, unit)) return;
  }
  moveTablet(d.id, unitId);
}

/** Teacher switches what the tablet shows: overview, whiteboard or an exercise of this unit. */
export async function tabletViewAction(unitId: number, view: string) {
  const { unit } = await managedRunningUnit(unitId);
  const v = parseView(view);
  if (v.kind === "aufgabe" && !unitAssignment(unit.id, v.assignmentId)) return;
  if (v.kind === "text" && !unitText(unit, v.textId)) return;
  showOnTablet(unit, v);
}

/** The exercise the tablet shows (or the latest of the unit). */
function currentAssignment(unitId: number, deviceView: string) {
  const v = parseView(deviceView);
  const list = unitAssignments(unitId);
  return (v.kind === "aufgabe" && list.find((a) => a.id === v.assignmentId)) || list.at(-1) || null;
}

/** After a single task: the next task of the same exercise. */
export async function sendNextTaskAction(unitId: number) {
  const { t, unit } = await managedRunningUnit(unitId);
  const a = currentAssignment(unit.id, unit.device_view);
  const next = a?.source_task_id ? nextTaskAfter(a.source_task_id) : null;
  if (!next) return;
  const out = sendSingleTask(next.id, unit.student_id, t.id);
  if (out.assignmentId) showOnTablet(unit, { kind: "aufgabe", assignmentId: out.assignmentId });
  revalidatePath(`/einheiten/${unit.id}`);
}

/** "Nochmal versuchen": the same task once more, as a fresh copy (the first try stays documented). */
export async function retryTaskAction(unitId: number) {
  const { t, unit } = await managedRunningUnit(unitId);
  const a = currentAssignment(unit.id, unit.device_view);
  if (!a) return;
  const taskId = a.source_task_id ?? repo.listTasks(a.worksheet_id)[0]?.id;
  const out = taskId ? sendSingleTask(taskId, unit.student_id, t.id) : null;
  if (out?.assignmentId) showOnTablet(unit, { kind: "aufgabe", assignmentId: out.assignmentId });
  revalidatePath(`/einheiten/${unit.id}`);
}

/** "Lösung zeigen" for the exercise on the tablet. */
export async function showSolutionAction(unitId: number) {
  const { unit } = await managedRunningUnit(unitId);
  const a = currentAssignment(unit.id, unit.device_view);
  if (!a) return;
  repo.setSolutionsVisible(a.id, true);
  notifyStudent(unit, "loesung");
  pushLive(unit.id);
}

/** "Auf Whiteboard": the current task goes onto the board and the tablet switches to it. */
export async function currentTaskToBoardAction(unitId: number) {
  const { unit } = await managedRunningUnit(unitId);
  const a = currentAssignment(unit.id, unit.device_view);
  const board = ensureBoardForUnit(unit.id);
  if (a && board) {
    const tasks = repo.listTasks(a.worksheet_id);
    const attempts = repo.listAttemptsForAssignment(a.id);
    const open = tasks.find((x) => !attempts.some((y) => y.task_id === x.id && y.final)) ?? tasks.at(-1);
    if (open) queueInsert(board.id, { kind: "tasks", title: a.title, worksheetId: a.worksheet_id, tasks: [boardTaskForStudent(open)] });
  }
  showOnTablet(unit, { kind: "tafel" });
}

/** "Passende Aufgabe erstellen": two new tasks for what the KI saw last, sent to the tablet at once. */
export async function newExerciseAction(unitId: number): Promise<{ ok?: string; error?: string }> {
  const { t, unit } = await managedRunningUnit(unitId);
  const out = await newExerciseForUnit(unit.id, t.id);
  if (!out.ok) return { error: out.error };
  noteActivity(unit.student_id);
  revalidatePath(`/einheiten/${unit.id}`);
  return { ok: out.source === "ki" ? "Neue Aufgaben gesendet." : "Neue Aufgaben aus dem Generator gesendet (KI gerade nicht verfügbar)." };
}
