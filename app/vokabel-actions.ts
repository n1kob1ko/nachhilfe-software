"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { getListe, loescheListe, speichereListe } from "@/lib/vokabellisten";

/** What the list editor shows after saving went wrong: every error, with its line. */
export type VokabelState = { fehler: string[] } | null;

/** Saves a list (new or changed) of one student; back to the student's lists. */
export async function saveVokabellisteAction(_prev: VokabelState, form: FormData): Promise<VokabelState> {
  const teacher = await requireTeacher();
  const studentId = Number(form.get("student_id")) || 0;
  const out = speichereListe({
    id: Number(form.get("id")) || null,
    studentId,
    teacherId: teacher.id,
    title: String(form.get("title") ?? ""),
    text: String(form.get("text") ?? ""),
  });
  if (!out.ok) return { fehler: out.fehler };
  revalidatePath(`/schueler/${studentId}`);
  redirect(`/schueler/${studentId}/vokabeln?gespeichert=${out.id}`);
}

export async function deleteVokabellisteAction(id: number) {
  await requireTeacher();
  const liste = getListe(id);
  if (!liste) redirect("/schueler");
  loescheListe(id);
  revalidatePath(`/schueler/${liste.student_id}`);
  redirect(`/schueler/${liste.student_id}/vokabeln?geloescht=1`);
}
