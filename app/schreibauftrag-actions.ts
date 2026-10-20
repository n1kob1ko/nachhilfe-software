"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createDraft, type BuilderSettings } from "@/lib/builder";
import { noteActivity } from "@/lib/learning";
import { pushLive, showOnTablet, studentDevice } from "@/lib/live";
import * as repo from "@/lib/repo";
import { SORTEN, type SorteKey } from "@/lib/schreibauftrag";
import { auftragFor, cleanAuftragSettings, createAuftrag, quelleOf, updateAuftrag } from "@/lib/schreibauftrag-store";
import { textChannel } from "@/lib/text-routes";
import { getText } from "@/lib/texts";
import { canManageUnit, getUnit, runningUnitForStudent } from "@/lib/units";
import { publish } from "@/lib/whiteboard-hub";

export type AuftragFormState = { error?: string } | null;

const fields = (f: FormData) => ({
  title: f.get("title"),
  author: f.get("author"),
  year: f.get("year"),
  medium: f.get("medium"),
  kind: f.get("kind"),
  story: f.get("story"),
  countBlank: f.get("countBlank"),
  target: f.get("target"),
  situation: f.get("situation"),
  prompt: f.get("prompt"),
  sourceNote: f.get("sourceNote"),
});

/**
 * A new Schreibauftrag (Textinterpretation, Leserbrief, Erörterung …): in a running unit, or for a student from the
 * student page or the builder. Without a unit the text waits on the student page and opens on the tablet in the
 * next unit.
 */
export async function createAuftragAction(sorte: SorteKey, where: { unitId: number } | { studentId: number }, _prev: AuftragFormState, f: FormData): Promise<AuftragFormState> {
  const t = await requireTeacher();
  let unit = "unitId" in where ? getUnit(where.unitId) : null;
  let studentId: number;
  if ("unitId" in where) {
    if (!unit) redirect("/einheiten");
    if (!canManageUnit(t, unit)) redirect(`/einheiten/${unit.id}?fremd=1`);
    if (unit.status !== "gestartet") return { error: "Diese Einheit ist schon beendet." };
    studentId = unit.student_id;
  } else {
    const student = repo.getStudent(where.studentId);
    if (!student) redirect("/schueler");
    studentId = student.id;
    // a unit with this student is running: the text belongs to it
    const running = runningUnitForStudent(student.id);
    unit = running && canManageUnit(t, running) ? running : null;
  }
  const out = cleanAuftragSettings(sorte, fields(f));
  if ("error" in out) return { error: out.error };
  const text = createAuftrag({ studentId, teacherId: t.id, unitId: unit?.id ?? null, settings: out.settings });
  noteActivity(studentId);
  const tablet = Boolean(unit) && f.get("tablet") === "1" && studentDevice(unit!) !== null;
  if (unit) {
    if (tablet) showOnTablet(unit, { kind: "text", textId: text.id });
    else pushLive(unit.id);
    revalidatePath(`/einheiten/${unit.id}`);
  }
  revalidatePath(`/schueler/${studentId}`);
  redirect(tablet && unit ? `/einheiten/${unit.id}?text=${text.id}` : `/texte/${text.id}`);
}

/** Changes Textbeilage, Arbeitsauftrag, Schreibsituation and word target; the student's text stays as it is. */
export async function updateAuftragAction(textId: number, _prev: AuftragFormState, f: FormData): Promise<AuftragFormState> {
  await requireTeacher();
  const text = getText(textId);
  const auftrag = auftragFor(textId);
  if (!text || !auftrag) redirect("/");
  const out = cleanAuftragSettings(auftrag.sorte, fields(f));
  if ("error" in out) return { error: out.error };
  updateAuftrag(textId, out.settings);
  // the student's device shows the new text and task at once
  publish(textChannel(textId), { type: "info" });
  const unit = runningUnitForStudent(text.student_id);
  if (unit) pushLive(unit.id);
  revalidatePath(`/texte/${textId}`);
  redirect(`/texte/${textId}`);
}

/** Short Teilübungen about the Textbeilage of this Schreibauftrag, one per part, as an exercise draft to check and send. */
export async function auftragExercisesAction(textId: number) {
  const t = await requireTeacher();
  const text = getText(textId);
  const source = quelleOf(textId);
  if (!text || !source) redirect("/");
  const student = repo.getStudent(text.student_id);
  const sorte = SORTEN[source.sorte];
  const s: BuilderSettings = {
    studentId: text.student_id,
    subject: "Deutsch",
    schoolType: student?.school_type ?? "Gymnasium",
    klasse: student?.klasse ?? 7,
    skillIds: [sorte.skill],
    difficulty: "mittel",
    count: source.sorte === "textinterpretation" ? 7 : sorte.parts.length,
    categories: [],
    focus: "",
    useAI: false,
    title: `Teilübungen zu „${source.title}“`,
  };
  const out = await createDraft(s, t.id, { auftragTextId: textId });
  revalidatePath("/uebungen");
  redirect(`/uebungen/${out.id}`);
}
