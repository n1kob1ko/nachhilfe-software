"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createDraft, type BuilderSettings } from "@/lib/builder";
import { noteActivity } from "@/lib/learning";
import { pushLive, showOnTablet, studentDevice } from "@/lib/live";
import * as repo from "@/lib/repo";
import { textChannel } from "@/lib/text-routes";
import { getText } from "@/lib/texts";
import { TEXTINTERPRETATION_SKILL } from "@/lib/textinterpretation";
import { cleanSettings, createInterpretation, getInterpretation, teilSourceOf, updateInterpretation } from "@/lib/textinterpretation-store";
import { canManageUnit, getUnit, runningUnitForStudent } from "@/lib/units";
import { publish } from "@/lib/whiteboard-hub";

export type InterpretationFormState = { error?: string } | null;

const fields = (f: FormData) => ({
  title: f.get("title"),
  author: f.get("author"),
  year: f.get("year"),
  kind: f.get("kind"),
  story: f.get("story"),
  countBlank: f.get("countBlank"),
  target: f.get("target"),
  prompt: f.get("prompt"),
  sourceNote: f.get("sourceNote"),
});

/**
 * A new Textinterpretation (Schreibauftrag): in a running unit, or for a student from the student page or
 * the builder. Without a unit the text waits on the student page and opens on the tablet in the next unit.
 */
export async function createInterpretationAction(where: { unitId: number } | { studentId: number }, _prev: InterpretationFormState, f: FormData): Promise<InterpretationFormState> {
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
  const out = cleanSettings(fields(f));
  if ("error" in out) return { error: out.error };
  const text = createInterpretation({ studentId, teacherId: t.id, unitId: unit?.id ?? null, settings: out.settings });
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

/** Changes story, Arbeitsauftrag and word target; the student's text stays as it is. */
export async function updateInterpretationAction(textId: number, _prev: InterpretationFormState, f: FormData): Promise<InterpretationFormState> {
  await requireTeacher();
  const text = getText(textId);
  if (!text || !getInterpretation(textId)) redirect("/");
  const out = cleanSettings(fields(f));
  if ("error" in out) return { error: out.error };
  updateInterpretation(textId, out.settings);
  // the student's device shows the new text and task at once
  publish(textChannel(textId), { type: "info" });
  const unit = runningUnitForStudent(text.student_id);
  if (unit) pushLive(unit.id);
  revalidatePath(`/texte/${textId}`);
  redirect(`/texte/${textId}`);
}

/** Short Teilübungen about the story of this Textinterpretation, as an exercise draft to check and send. */
export async function interpretationExercisesAction(textId: number) {
  const t = await requireTeacher();
  const text = getText(textId);
  const source = teilSourceOf(textId);
  if (!text || !source) redirect("/");
  const student = repo.getStudent(text.student_id);
  const s: BuilderSettings = {
    studentId: text.student_id,
    subject: "Deutsch",
    schoolType: student?.school_type ?? "Gymnasium",
    klasse: student?.klasse ?? 7,
    skillIds: [TEXTINTERPRETATION_SKILL],
    difficulty: "mittel",
    count: 7,
    categories: [],
    focus: "",
    useAI: false,
    title: `Teilübungen zu „${source.title}“`,
  };
  const out = await createDraft(s, t.id, { interpretationTextId: textId });
  revalidatePath("/uebungen");
  redirect(`/uebungen/${out.id}`);
}
