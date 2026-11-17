"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { speichereFehlerprotokoll } from "@/lib/fehlerprotokoll";

/** Was der Editor nach einem misslungenen Speichern zeigt: jeden Fehler mit seiner Zeile. */
export type FehlerprotokollState = { fehler: string[] } | null;

/** Speichert das Fehlerprotokoll eines Schülers; zurück auf die Seite mit dem Stand. */
export async function saveFehlerprotokollAction(_prev: FehlerprotokollState, form: FormData): Promise<FehlerprotokollState> {
  const teacher = await requireTeacher();
  const studentId = Number(form.get("student_id")) || 0;
  const out = speichereFehlerprotokoll(studentId, teacher.id, String(form.get("text") ?? ""));
  if (!out.ok) return { fehler: out.fehler };
  revalidatePath(`/schueler/${studentId}`, "layout");
  redirect(`/schueler/${studentId}/fehlerprotokoll?gespeichert=1`);
}
