"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { noteActivity } from "@/lib/learning";
import { pushLive, showOnTablet, studentDevice } from "@/lib/live";
import { textChannel } from "@/lib/text-routes";
import { createText, getText, restoreRevision, setTextStatus, updateTextInfo } from "@/lib/texts";
import { canManageUnit, getUnit, runningUnitForStudent } from "@/lib/units";
import { publish } from "@/lib/whiteboard-hub";

const str = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);

export type StartTextState = { error?: string } | null;

/**
 * "Textarbeit starten" in a running unit: title, subject, kind of text and the task. The text opens on
 * the teacher's student tablet at once; without a tablet it opens here, to write on this device.
 */
export async function startTextAction(unitId: number, _prev: StartTextState, f: FormData): Promise<StartTextState> {
  const t = await requireTeacher();
  const unit = getUnit(unitId);
  if (!unit) redirect("/einheiten");
  if (!canManageUnit(t, unit)) redirect(`/einheiten/${unitId}?fremd=1`);
  if (unit.status !== "gestartet") return { error: "Diese Einheit ist schon beendet." };
  const title = str(f, "title", 140);
  if (!title) return { error: "Bitte einen Titel eingeben." };
  const text = createText({ studentId: unit.student_id, teacherId: t.id, unitId: unit.id, subject: str(f, "subject", 60), topic: str(f, "topic", 80), title, prompt: str(f, "prompt", 4000) });
  noteActivity(unit.student_id);
  // "tablet" means the student's device: the teacher's tablet or the student's confirmed laptop
  const tablet = f.get("tablet") === "1" && studentDevice(unit) !== null;
  if (tablet) showOnTablet(unit, { kind: "text", textId: text.id });
  else pushLive(unit.id);
  revalidatePath(`/einheiten/${unit.id}`);
  redirect(tablet ? `/einheiten/${unit.id}?text=${text.id}` : `/texte/${text.id}`);
}

async function teacherText(id: number) {
  const t = await requireTeacher();
  const text = getText(id);
  if (!text) redirect("/");
  return { t, text };
}

export async function updateTextInfoAction(id: number, f: FormData) {
  const { text } = await teacherText(id);
  updateTextInfo(text.id, { title: str(f, "title", 140) || text.title, subject: str(f, "subject", 60), topic: str(f, "topic", 80), prompt: str(f, "prompt", 4000) });
  publish(textChannel(text.id), { type: "info" });
  revalidatePath(`/texte/${text.id}`);
}

export async function setTextStatusAction(id: number, status: "offen" | "fertig") {
  const { text } = await teacherText(id);
  setTextStatus(text.id, status);
  revalidatePath(`/texte/${text.id}`);
}

/** Opens the text on the tablet of the teacher who is teaching its student right now (to continue it). */
export async function showTextOnTabletAction(id: number) {
  const { t, text } = await teacherText(id);
  const unit = runningUnitForStudent(text.student_id);
  if (!unit || !canManageUnit(t, unit)) return;
  showOnTablet(unit, { kind: "text", textId: text.id });
  revalidatePath(`/texte/${text.id}`);
}

export async function restoreRevisionAction(id: number, revisionId: number) {
  const { text } = await teacherText(id);
  const res = restoreRevision(text.id, revisionId);
  if (res.ok) publish(textChannel(text.id), { type: "text", version: res.version });
  const unit = runningUnitForStudent(text.student_id);
  if (unit) {
    pushLive(unit.id);
    // a tablet that shows the text loads the restored version
    if (unit.device_view === `text:${text.id}`) showOnTablet(unit, { kind: "text", textId: text.id });
  }
  revalidatePath(`/texte/${text.id}`);
}
