"use server";

import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { entwurfAusText } from "@/lib/einheit-aus-text";

export type EinheitTextStand = { error: string } | null;

/**
 * Einheit aus Text übernehmen (lib/einheit-aus-text.ts): liest die eingefügte Zusammenfassung und öffnet das Formular
 * „Einheit nachtragen“ ausgefüllt. Datum, Uhrzeit und Dauer eines Platzes (beim Nachtragen aus dem Wochenplan) bleiben.
 */
export async function einheitAusTextAction(_prev: EinheitTextStand, fd: FormData): Promise<EinheitTextStand> {
  const teacher = await requireTeacher();
  const studentId = Number(fd.get("student_id"));
  let id: number;
  try {
    ({ id } = await entwurfAusText({ studentId, teacherId: teacher.id, text: String(fd.get("text") ?? "") }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Das hat nicht geklappt." };
  }
  const q = new URLSearchParams({ aus: String(id) });
  for (const k of ["datum", "start", "dauer"]) {
    const v = String(fd.get(k) ?? "");
    if (v) q.set(k, v);
  }
  redirect(`/schueler/${studentId}/stunden/neu?${q}`);
}
