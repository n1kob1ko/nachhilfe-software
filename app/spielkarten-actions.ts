"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { getSatz, loescheSatz, setzeAktiv, speichereSatz } from "@/lib/spielkarten";

/** Was der Editor nach einem misslungenen Speichern zeigt: jeden Fehler mit seiner Zeile. */
export type SpielkartenState = { fehler: string[] } | null;

const neuLaden = (studentId: number, token?: string) => {
  revalidatePath(`/schueler/${studentId}`, "layout");
  if (token) revalidatePath(`/lernen/${token}`, "layout");
};

/** Speichert einen Satz Spielkarten (neu oder geändert); zurück zur Liste des Schülers. */
export async function saveSpielkartenAction(_prev: SpielkartenState, form: FormData): Promise<SpielkartenState> {
  const teacher = await requireTeacher();
  const studentId = Number(form.get("student_id")) || 0;
  const out = speichereSatz({
    id: Number(form.get("id")) || null,
    studentId,
    teacherId: teacher.id,
    titel: String(form.get("titel") ?? ""),
    fach: String(form.get("fach") ?? ""),
    text: String(form.get("text") ?? ""),
    aktiv: form.get("aktiv") !== null,
  });
  if (!out.ok) return { fehler: out.fehler };
  neuLaden(studentId);
  redirect(`/schueler/${studentId}/spielkarten?gespeichert=${out.id}`);
}

export async function deleteSpielkartenAction(id: number) {
  await requireTeacher();
  const satz = getSatz(id);
  if (!satz) redirect("/schueler");
  loescheSatz(id);
  neuLaden(satz.student_id);
  redirect(`/schueler/${satz.student_id}/spielkarten?geloescht=1`);
}

/** Ins Spiel nehmen oder herausnehmen, ohne den Text zu ändern. */
export async function spielkartenAktivAction(id: number, aktiv: boolean) {
  await requireTeacher();
  const satz = getSatz(id);
  if (!satz) redirect("/schueler");
  setzeAktiv(id, aktiv);
  neuLaden(satz.student_id);
}
