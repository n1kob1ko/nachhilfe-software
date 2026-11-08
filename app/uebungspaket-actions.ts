"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { ERROR_TYPES, type ErrorType } from "@/lib/error-types";
import { erstellePaket, uebernimmAuswertung, wertePaketAus } from "@/lib/uebungspaket";

export type PaketStand = { error: string } | null;

/** Übungspaket aus Erkenntnissen (lib/uebungspaket.ts): erstellt den Entwurf und öffnet die Vorschau. */
export async function paketErstellenAction(_prev: PaketStand, fd: FormData): Promise<PaketStand> {
  const teacher = await requireTeacher();
  const studentId = Number(fd.get("student_id"));
  let ziel: string;
  try {
    const out = await erstellePaket({
      studentId,
      teacherId: teacher.id,
      fach: String(fd.get("fach") ?? ""),
      erkenntnisIds: fd.getAll("erkenntnis").map(Number).filter(Boolean),
      nichtMehr: String(fd.get("nicht_mehr") ?? ""),
      anzahl: Number(fd.get("anzahl")),
    });
    ziel = `/uebungen/${out.worksheetId}${out.aiError ? "?hinweis=ki" : ""}`;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Das hat nicht geklappt." };
  }
  revalidatePath(`/schueler/${studentId}`, "layout");
  redirect(ziel);
}

/** Wertet ein Paket aus (KI oder Regel) und zeigt den Vorschlag zum Prüfen. */
export async function paketAuswertenAction(_prev: PaketStand, fd: FormData): Promise<PaketStand> {
  const teacher = await requireTeacher();
  const studentId = Number(fd.get("student_id"));
  const worksheetId = Number(fd.get("worksheet_id"));
  try {
    await wertePaketAus(worksheetId, studentId, teacher.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Das hat nicht geklappt." };
  }
  revalidatePath(`/schueler/${studentId}/paket/${worksheetId}`);
  return null;
}

/** Übernimmt die geprüfte Auswertung: behobene Fehler erledigt, neue Erkenntnisse dazu. */
export async function paketAuswertungSpeichernAction(fd: FormData) {
  const teacher = await requireTeacher();
  const studentId = Number(fd.get("student_id"));
  const worksheetId = Number(fd.get("worksheet_id"));
  const texte = fd.getAll("ek_text").map(String);
  const skills = fd.getAll("ek_skill").map(String);
  const arten = fd.getAll("ek_art").map(String);
  const out = uebernimmAuswertung({
    worksheetId,
    studentId,
    teacherId: teacher.id,
    erledigt: fd.getAll("erledigt").map(Number).filter(Boolean),
    neue: texte.map((text, i) => ({ text: text.trim(), skillId: skills[i] || null, fehlerart: ERROR_TYPES.some((e) => e.key === arten[i]) ? (arten[i] as ErrorType) : null })).filter((x) => x.text),
    staerken: String(fd.get("ek_gut") ?? "").split("\n").map((t) => t.trim()).filter(Boolean),
  });
  revalidatePath(`/schueler/${studentId}`, "layout");
  if ("error" in out) redirect(`/schueler/${studentId}/paket/${worksheetId}?fehler=${encodeURIComponent(out.error)}`);
  redirect(`/schueler/${studentId}?tab=fortschritt#erkenntnisse-titel`);
}
