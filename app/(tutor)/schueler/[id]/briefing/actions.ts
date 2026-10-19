"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { erstelleBriefing, type BriefingErgebnis } from "@/lib/briefing";

/**
 * Das KI-Briefing eines Schülers für heute (lib/briefing.ts): das gespeicherte, wenn es eins gibt; sonst
 * und mit `neu` („Neu erstellen“) eine Anfrage an die KI. Ein zweiter Klick, während die Anfrage läuft,
 * wartet auf dieselbe und kostet nichts.
 */
export async function briefingAction(studentId: number, platzId: number | null, neu: boolean): Promise<BriefingErgebnis> {
  const teacher = await requireTeacher();
  if (!Number.isInteger(studentId) || studentId <= 0) return { ok: false, error: "Schüler nicht gefunden." };
  const res = await erstelleBriefing(studentId, teacher.id, { neu, platzId: Number.isInteger(platzId) ? platzId : null });
  if (res.ok && res.neu) revalidatePath(`/schueler/${studentId}/briefing`);
  return res;
}
