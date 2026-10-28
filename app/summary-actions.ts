"use server";

import { revalidatePath } from "next/cache";
import { aiEnabled, writeFamilyNote } from "@/lib/ai";
import { kiGrund, protokolliere } from "@/lib/ai/grund";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { briefAusKarte, karteDerEinheit } from "@/lib/abschluss";
import { briefForAI, noteFromFacts, unitBrief } from "@/lib/summary";
import { canManageUnit, getUnit } from "@/lib/units";

export type NoteState = { note?: string; source?: string; error?: string; ok?: string } | null;

/** The lesson, if this teacher may write its documentation (the unit's teacher or the administration). */
async function editableLesson(lessonId: number) {
  const teacher = await requireTeacher();
  const lesson = repo.getLesson(lessonId);
  if (!lesson) return null;
  const unit = lesson.unit_id ? getUnit(lesson.unit_id) : null;
  return !unit || canManageUnit(teacher, unit) ? Object.assign(lesson, { editorId: teacher.id }) : null;
}
const refresh = (lesson: repo.Lesson) => {
  if (lesson.unit_id) revalidatePath(`/einheiten/${lesson.unit_id}`);
  revalidatePath(`/schueler/${lesson.student_id}`);
};

/**
 * A note for parents or the student: from the facts alone, or formulated by Claude from the data
 * lines of the summary (names removed, no teacher notes). Saved right away; the teacher can edit it.
 * With a unit the facts are the four fields of the Abschluss (lib/abschluss.ts `briefAusKarte`), the same the teacher confirms.
 */
export async function generateFamilyNoteAction(lessonId: number, mode: "fakten" | "ki", audience: "eltern" | "schueler"): Promise<NoteState> {
  const lesson = await editableLesson(lessonId);
  if (!lesson) return { error: "Diese Dokumentation kannst du nicht ändern." };
  const roh = unitBrief(lesson.id);
  if (!roh) return { error: "Keine Daten zu dieser Einheit." };
  const brief = lesson.unit_id ? briefAusKarte(roh, karteDerEinheit(lesson.unit_id, lesson, roh)) : roh;
  let note = noteFromFacts(brief, audience);
  let source: "fakten" | "ki" = "fakten";
  if (mode === "ki") {
    if (!aiEnabled()) return { error: "Kein KI-Schlüssel hinterlegt." };
    const student = repo.getStudent(lesson.student_id);
    try {
      const text = await writeFamilyNote(briefForAI(brief, student?.name ?? ""), audience, { teacherId: lesson.editorId, unitId: lesson.unit_id ?? null, studentId: lesson.student_id, trigger: "notiz" });
      if (!text) return { error: "Die KI hat keine Notiz geliefert. Die Notiz aus den Fakten bleibt möglich." };
      note = text;
      source = "ki";
    } catch (e) {
      // the provider's own text only in the server log (lib/ai/grund.ts)
      protokolliere("Notiz für Eltern", e);
      return { error: `${kiGrund(e)} Die Notiz aus den Fakten bleibt möglich.` };
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
