"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { uebernimmVonPapier } from "@/lib/handschrift";
import { noteActivity } from "@/lib/learning";
import { pushLive, showOnTablet, studentDevice } from "@/lib/live";
import { textChannel } from "@/lib/text-routes";
import { createText, getText, restoreRevision, setTextStatus, updateTextInfo } from "@/lib/texts";
import { canManageUnit, getUnit, runningUnitForStudent } from "@/lib/units";
import { publish } from "@/lib/whiteboard-hub";
import { markiereGesehen } from "@/lib/zu-erledigen";

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
  // written on paper (lib/handschrift.ts): nothing opens on the tablet, the teacher takes the text over from the photos
  const papier = f.get("wo") === "papier";
  // "tablet" means the student's device: the teacher's tablet or the student's confirmed laptop
  const tablet = !papier && f.get("tablet") === "1" && studentDevice(unit) !== null;
  if (tablet) showOnTablet(unit, { kind: "text", textId: text.id });
  else pushLive(unit.id);
  revalidatePath(`/einheiten/${unit.id}`);
  redirect(papier ? `/texte/${text.id}/papier` : tablet ? `/einheiten/${unit.id}?text=${text.id}` : `/texte/${text.id}`);
}

export type VonPapierState = { error: string } | { href: string };

/**
 * „Als Text übernehmen“ (lib/handschrift.ts): the text the teacher checked in the preview becomes the text, as a new
 * version. Only now is anything saved; `fertig` marks the text as finished at the same time.
 */
export async function uebernimmVonPapierAction(id: number, text: string, fertig: boolean): Promise<VonPapierState> {
  const { t, text: row } = await teacherText(id);
  const res = uebernimmVonPapier(row.id, String(text ?? ""));
  if (!res.ok) {
    if (res.reason === "leer") return { error: "Der Text ist noch leer." };
    if (res.reason === "zu_lang") return { error: "Der Text ist zu lang." };
    return { error: "Diesen Text gibt es nicht mehr." };
  }
  if (fertig && row.status !== "fertig") {
    setTextStatus(row.id, "fertig");
    markiereGesehen(t.id, "text", row.id);
  }
  publish(textChannel(row.id), { type: "text", version: res.version });
  const unit = runningUnitForStudent(row.student_id);
  if (unit) {
    pushLive(unit.id);
    if (unit.device_view === `text:${row.id}`) showOnTablet(unit, { kind: "text", textId: row.id });
  }
  revalidatePath(`/texte/${row.id}`);
  revalidatePath("/");
  return { href: `/texte/${row.id}?papier=1` };
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
  const { t, text } = await teacherText(id);
  setTextStatus(text.id, status);
  // wer selbst „fertig“ setzt, hat den Text gesehen: er wartet in „Zu erledigen“ nicht auf ihn
  if (status === "fertig") markiereGesehen(t.id, "text", text.id);
  revalidatePath(`/texte/${text.id}`);
  revalidatePath("/");
}

/** Opens the text on the tablet of the teacher who is teaching its student right now (to continue it). */
export async function showTextOnTabletAction(id: number) {
  const { t, text } = await teacherText(id);
  const unit = runningUnitForStudent(text.student_id);
  if (!unit || !canManageUnit(t, unit) || text.archived_at) return;
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
