"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { showOnTablet, studentDevice } from "@/lib/live";
import {
  addTeacherItem,
  decideAll,
  decideItem,
  ensureCorrection,
  getCorrection,
  removeTeacherItem,
  setShared,
  startAICorrection,
  startThoroughRecheck,
  type ItemKind,
  type ItemStatus,
  type TeacherItemInput,
} from "@/lib/text-correction";
import { parseNames } from "@/lib/name-detection";
import { getText } from "@/lib/texts";
import { canManageUnit, runningUnitForStudent } from "@/lib/units";

/** Every teacher may correct every text (students are shared); the text must exist and the correction belong to it. */
async function teacherCorrection(correctionId: number) {
  const t = await requireTeacher();
  const c = getCorrection(correctionId);
  if (!c || !getText(c.text_id)) redirect("/");
  return { t, c };
}

const page = (textId: number) => `/texte/${textId}/korrektur`;

export type StartState = { error?: string } | null;

/** The further names the teacher keeps replaced in the consent dialog and those typed in; undefined = no such dialog. */
function namesFrom(f: FormData): string[] | undefined {
  if (f.get("names") !== "1") return undefined;
  const kept = f.getAll("name").map((n) => String(n).trim().slice(0, 60)).filter((n) => /\p{L}/u.test(n));
  return [...new Set([...kept, ...parseNames(String(f.get("extra") ?? ""))])].slice(0, 80);
}

/** „Mit KI korrigieren“ after the consent dialog: only with the box ticked, never automatically. */
export async function startAICorrectionAction(textId: number, _prev: StartState, f: FormData): Promise<StartState> {
  const t = await requireTeacher();
  const text = getText(textId);
  if (!text) redirect("/");
  const unit = runningUnitForStudent(text.student_id);
  const res = await startAICorrection(textId, t.id, { consent: f.get("consent") === "1", unitId: unit?.id ?? null, method: f.get("method") === "gruendlich" ? "gruendlich" : "einfach", names: namesFrom(f) });
  if (!res.ok) return { error: res.error };
  revalidatePath(page(textId));
  redirect(page(textId));
}

/** „Gründlich nachprüfen“: the open KI suggestions are replaced by a „gründlich“ run, decisions stay. */
export async function startThoroughRecheckAction(correctionId: number, _prev: StartState, f: FormData): Promise<StartState> {
  const { t, c } = await teacherCorrection(correctionId);
  const res = await startThoroughRecheck(c.id, t.id, { consent: f.get("consent") === "1", names: namesFrom(f) });
  if (!res.ok) return { error: res.error };
  revalidatePath(page(c.text_id));
  redirect(page(c.text_id));
}

/** „Selbst korrigieren“: a correction of the current version without KI. */
export async function startManualCorrectionAction(textId: number) {
  const t = await requireTeacher();
  const text = getText(textId);
  if (!text) redirect("/");
  const unit = runningUnitForStudent(text.student_id);
  ensureCorrection(textId, t.id, unit?.id ?? null);
  revalidatePath(page(textId));
  redirect(page(textId));
}

export async function decideItemAction(correctionId: number, itemId: number, status: ItemStatus, replacement?: string) {
  const { t, c } = await teacherCorrection(correctionId);
  const item = decideItem(c.id, itemId, status, t.id, replacement);
  revalidatePath(page(c.text_id));
  return item;
}

export async function decideAllAction(correctionId: number, status: "uebernommen" | "abgelehnt", filter: { category?: string; kind?: ItemKind } = {}) {
  const { t, c } = await teacherCorrection(correctionId);
  const n = decideAll(c.id, status, t.id, filter);
  revalidatePath(page(c.text_id));
  return n;
}

export async function addItemAction(correctionId: number, input: TeacherItemInput) {
  const { t, c } = await teacherCorrection(correctionId);
  const res = addTeacherItem(c.id, input, t.id);
  revalidatePath(page(c.text_id));
  return res;
}

export async function removeItemAction(correctionId: number, itemId: number) {
  const { c } = await teacherCorrection(correctionId);
  const ok = removeTeacherItem(c.id, itemId);
  revalidatePath(page(c.text_id));
  return ok;
}

/** „Dem Schüler zeigen“: the accepted corrections appear with the text on the student's device. */
export async function shareCorrectionAction(correctionId: number, on: boolean) {
  const { t, c } = await teacherCorrection(correctionId);
  setShared(c.id, on);
  const text = getText(c.text_id)!;
  const unit = runningUnitForStudent(text.student_id);
  // in the teacher's own running unit the text opens on the student's device right away
  if (on && unit && canManageUnit(t, unit) && studentDevice(unit)) showOnTablet(unit, { kind: "text", textId: text.id });
  else if (unit?.device_view === `text:${text.id}`) showOnTablet(unit, { kind: "text", textId: text.id });
  revalidatePath(page(c.text_id));
}
