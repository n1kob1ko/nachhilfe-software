"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { onHint } from "@/lib/ai/realtime";
import { requireTeacher } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import {
  approveLaptop,
  cancelLaptopCode,
  createLaptopCode,
  deviceLabel,
  endLaptop,
  getLaptop,
  laptopChannel,
  rejectLaptop,
  requestLaptopAccess,
} from "@/lib/laptop";
import { laptopContext, setLaptopCookie } from "@/lib/laptop-context";
import { notifyTablet, pushLive, unitAssignment } from "@/lib/live";
import * as repo from "@/lib/repo";
import { submitAnswer, type SubmitInput } from "@/lib/service";
import { canManageUnit, getUnit } from "@/lib/units";
import { publish } from "@/lib/whiteboard-hub";

// ---------- laptop side ----------

export type JoinState = { error?: string } | null;

/** The student enters the code from the teacher's screen. The code never appears in a URL or a log. */
export async function joinLaptopAction(_prev: JoinState, form: FormData): Promise<JoinState> {
  const h = await headers();
  const out = requestLaptopAccess(String(form.get("code") ?? "").slice(0, 20), { key: clientIp(h), label: deviceLabel(h.get("user-agent")) });
  if ("error" in out) return { error: out.error };
  await setLaptopCookie(out.token);
  // the teacher's live status shows the request at once
  pushLive(out.session.unit_id);
  redirect("/mitmachen");
}

/** The exercise must belong to the unit this laptop was confirmed for, and that unit must still run. */
async function laptopAssignment(assignmentId: number) {
  const ctx = await laptopContext();
  if (!ctx) throw new Error("Der Zugang ist beendet.");
  const a = unitAssignment(ctx.unit.id, assignmentId);
  if (!a) throw new Error("Aufgabe nicht gefunden.");
  return { ...ctx, assignment: a };
}

export async function laptopSubmitAnswerAction(input: Omit<SubmitInput, "token">) {
  const { student, unit } = await laptopAssignment(input.assignmentId);
  const res = await submitAnswer({ ...input, token: student.access_token });
  pushLive(unit.id);
  return res;
}

export async function laptopRecordHintAction(assignmentId: number, taskId: number, hintIndex: number) {
  const { student, unit, assignment } = await laptopAssignment(assignmentId);
  const t = repo.getTask(taskId);
  if (!t || t.worksheet_id !== assignment.worksheet_id || !Number.isInteger(hintIndex) || hintIndex < 0 || hintIndex >= t.hints.length) return;
  repo.recordHintUse({ assignment_id: assignment.id, task_id: t.id, student_id: student.id, hint_index: hintIndex, unit_id: unit.id });
  pushLive(unit.id);
  onHint({ unitId: unit.id, teacherId: unit.teacher_id, taskId: t.id, assignmentId: assignment.id, hintIndex });
}

// ---------- teacher side ----------

async function managedRunningUnit(unitId: number) {
  const t = await requireTeacher();
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet" || !canManageUnit(t, unit)) throw new Error("Diese Einheit läuft nicht.");
  return { t, unit };
}

/** "Eigenes Gerät verbinden": a fresh code for this unit (an older one stops working). */
export async function createLaptopCodeAction(unitId: number) {
  const { t, unit } = await managedRunningUnit(unitId);
  createLaptopCode(unit.id, t.id);
  pushLive(unit.id);
}

export async function cancelLaptopCodeAction(unitId: number) {
  const { unit } = await managedRunningUnit(unitId);
  cancelLaptopCode(unit.id);
  pushLive(unit.id);
}

/** The teacher confirms the request with the matching check number: the laptop gets the unit. */
export async function approveLaptopAction(unitId: number, sessionId: number) {
  const { unit } = await managedRunningUnit(unitId);
  const out = approveLaptop(unit.id, sessionId);
  if (!out.ok) return;
  for (const id of out.ended) publish(laptopChannel(id), { type: "ended", reason: "ersetzt" });
  publish(laptopChannel(sessionId), { type: "refresh", reason: "bestaetigt" });
  // the tablet steps back to "arbeitet am eigenen Laptop"
  notifyTablet(unit.teacher_id, "laptop");
  pushLive(unit.id);
  revalidatePath(`/einheiten/${unit.id}`);
}

export async function rejectLaptopAction(unitId: number, sessionId: number) {
  const { unit } = await managedRunningUnit(unitId);
  if (rejectLaptop(unit.id, sessionId)) publish(laptopChannel(sessionId), { type: "ended", reason: "abgelehnt" });
  pushLive(unit.id);
}

/** "Zugang beenden": the laptop loses access at once; the work stays saved. */
export async function endLaptopAction(unitId: number, sessionId: number) {
  const { unit } = await managedRunningUnit(unitId);
  const s = getLaptop(sessionId);
  if (!s || s.unit_id !== unit.id) return;
  if (endLaptop(s.id, "lehrer")) publish(laptopChannel(s.id), { type: "ended", reason: "lehrer" });
  notifyTablet(unit.teacher_id, "laptop");
  pushLive(unit.id);
  revalidatePath(`/einheiten/${unit.id}`);
}
