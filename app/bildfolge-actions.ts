"use server";

import { requireTeacher } from "@/lib/auth";
import { erstelleBild, planeBildfolge, type BildErgebnis, type PlanErgebnis } from "@/lib/bildfolge";
import { getText } from "@/lib/texts";
import { canManageUnit, getUnit } from "@/lib/units";

/** Where the story is made: in a running unit, or an existing Bildgeschichte. The student is read here, never taken from the browser. */
export type BildfolgeFuer = { einheit: number } | { text: number };

/**
 * „Bilder erstellen“ (lib/bildfolge.ts), step 1: the plan. The story belongs to the student of the unit or of the
 * text, so the KI limit per student applies to it; nothing else about the student is used.
 */
export async function bildfolgePlanenAction(e: { beschreibung: string; anzahl: number; schulart: string; klasse: number | null }, fuer: BildfolgeFuer): Promise<PlanErgebnis> {
  const teacher = await requireTeacher();
  let studentId: number | null = null;
  if (fuer && "einheit" in fuer) {
    const unit = getUnit(Number(fuer.einheit));
    if (!unit) return { ok: false, error: "Diese Einheit gibt es nicht." };
    if (!canManageUnit(teacher, unit)) return { ok: false, error: "Das ist die Einheit eines anderen Lehrers." };
    studentId = unit.student_id;
  } else if (fuer && "text" in fuer) {
    const text = getText(Number(fuer.text));
    if (!text) return { ok: false, error: "Diese Bildgeschichte gibt es nicht." };
    studentId = text.student_id;
  }
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return planeBildfolge({ beschreibung: s(e?.beschreibung), anzahl: Number(e?.anzahl), schulart: s(e?.schulart), klasse: Number(e?.klasse) || null }, { teacherId: teacher.id, studentId });
}

/** Step 2 and „Dieses Bild neu“: the picture of one scene. */
export async function bildErstellenAction(bildfolgeId: number, szene: number): Promise<BildErgebnis> {
  const teacher = await requireTeacher();
  return erstelleBild(Number(bildfolgeId), Number(szene), { teacherId: teacher.id });
}
