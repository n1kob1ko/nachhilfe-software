"use server";

import { revalidatePath } from "next/cache";
import { aiEnabled, writeFamilyNote } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { briefForAI, noteFromFacts, unitBrief } from "@/lib/summary";
import { canManageUnit, getUnit } from "@/lib/units";

export type NoteState = { note?: string; source?: string; error?: string; ok?: string } | null;

/** The lesson, if this teacher may write its documentation (the unit's teacher or the administration). */
async function editableLesson(lessonId: number) {
  const teacher = await requireTeacher();
  const lesson = repo.getLesson(lessonId);
  if (!lesson) return null;
  const unit = lesson.unit_id ? getUnit(lesson.unit_id) : null;
  return !unit || canManageUnit(teacher, unit) ? lesson : null;
}
const refresh = (lesson: repo.Lesson) => {
  if (lesson.unit_id) revalidatePath(`/einheiten/${lesson.unit_id}`);
  revalidatePath(`/schueler/${lesson.student_id}`);
};

/**
 * A note for parents or the student: from the facts alone, or formulated by Claude from the data
 * lines of the summary (names removed, no teacher notes). Saved right away; the teacher can edit it.
 */
export async function generateFamilyNoteAction(lessonId: number, mode: "fakten" | "ki", audience: "eltern" | "schueler"): Promise<NoteState> {
  const lesson = await editableLesson(lessonId);
  if (!lesson) return { error: "Diese Dokumentation kannst du nicht ändern." };
  const brief = unitBrief(lesson.id);
  if (!brief) return { error: "Keine Daten zu dieser Einheit." };
  let note = noteFromFacts(brief, audience);
  let source: "fakten" | "ki" = "fakten";
  if (mode === "ki") {
    if (!aiEnabled()) return { error: "Kein KI-Schlüssel hinterlegt." };
    const student = repo.getStudent(lesson.student_id);
    try {
      const text = await writeFamilyNote(briefForAI(brief, student?.name ?? ""), audience);
      if (!text) return { error: "Claude hat keine Notiz geliefert. Die Notiz aus den Fakten bleibt möglich." };
      note = text;
      source = "ki";
    } catch (e) {
      return { error: `Claude war nicht erreichbar (${e instanceof Error ? e.message : String(e)}).` };
    }
  }
  repo.setFamilyNote(lesson.id, note, source);
  refresh(lesson);
  // the source label under the text says where it comes from; only Claude's text needs a word more
  return { note, source, ok: source === "ki" ? "Bitte lesen und bei Bedarf anpassen." : undefined };
}

export async function saveFamilyNoteAction(lessonId: number, text: string): Promise<NoteState> {
  const lesson = await editableLesson(lessonId);
  if (!lesson) return { error: "Diese Dokumentation kannst du nicht ändern." };
  const note = text.trim();
  const unchanged = note === (lesson.family_note ?? "").trim();
  const source = unchanged ? ((lesson.family_note_source as "fakten" | "ki" | "lehrer") ?? "lehrer") : "lehrer";
  repo.setFamilyNote(lesson.id, note, note ? source : "");
  refresh(lesson);
  return { note, source: note ? source : "", ok: note ? "Gespeichert." : "Notiz gelöscht." };
}
