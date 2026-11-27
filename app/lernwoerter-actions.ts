"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { speichereLernwoerter } from "@/lib/lernwoerter";

/** Was der Editor nach einem misslungenen Speichern zeigt: jeden Fehler mit seiner Zeile. */
export type LernwoerterState = { fehler: string[] } | null;

/** Speichert die Lernwörter eines Schülers; zurück auf die Seite mit dem Stand. */
export async function saveLernwoerterAction(_prev: LernwoerterState, form: FormData): Promise<LernwoerterState> {
  const teacher = await requireTeacher();
  const studentId = Number(form.get("student_id")) || 0;
  const out = speichereLernwoerter(studentId, teacher.id, String(form.get("text") ?? ""));
  if (!out.ok) return { fehler: out.fehler };
  revalidatePath(`/schueler/${studentId}`, "layout");
  redirect(`/schueler/${studentId}/lernwoerter?gespeichert=1`);
}
