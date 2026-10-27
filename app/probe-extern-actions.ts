"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { uebernimmProbe, type ProbeEingabe } from "@/lib/probe-extern";

/**
 * „Übernehmen“ der eigenen Probeschularbeit (lib/probe-extern.ts): erst hier entsteht die Übung, mit der Schularbeit verknüpft.
 * Danach die Übung zum Senden oder Drucken, wie nach „Probeschularbeit erstellen“.
 */
export async function uebernimmProbeAction(e: Omit<ProbeEingabe, "teacherId">): Promise<{ error: string } | { href: string }> {
  const teacher = await requireTeacher();
  const out = uebernimmProbe({ ...e, teacherId: teacher.id });
  if ("error" in out) return out;
  revalidatePath(`/schueler/${e.studentId}`, "layout");
  return { href: `/uebungen/${out.worksheetId}?hinweis=eigene` };
}
