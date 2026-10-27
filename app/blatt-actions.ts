"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { speichereBlatt, type BlattEingabe } from "@/lib/blatt-einlesen";
import { speicherePapier, type PapierEingabe } from "@/lib/papier-einheit";
import { canManageUnit, getUnit } from "@/lib/units";

/** Takes a checked solved sheet over into the student's profile (lib/blatt-einlesen.ts). */
export async function speichereBlattAction(e: Omit<BlattEingabe, "teacherId">): Promise<{ error: string } | { href: string }> {
  const teacher = await requireTeacher();
  const out = speichereBlatt({ ...e, teacherId: teacher.id });
  if ("error" in out) return out;
  revalidatePath(`/schueler/${e.studentId}`, "layout");
  revalidatePath("/");
  return { href: `/schueler/${e.studentId}?tab=${e.art === "pruefung" ? "schule" : "lernverlauf"}` };
}

/**
 * Arbeit fotografieren (lib/papier-einheit.ts): takes the checked sheet over in the running unit, only for its teacher
 * (or the administration). Back to the unit with a short line what was taken over.
 */
export async function speicherePapierAction(e: Omit<PapierEingabe, "teacherId">): Promise<{ error: string } | { href: string }> {
  const teacher = await requireTeacher();
  const unit = getUnit(e.unitId);
  if (!unit || !canManageUnit(teacher, unit)) return { error: "Diese Einheit gehört jemand anderem." };
  const out = speicherePapier({ ...e, teacherId: teacher.id });
  if ("error" in out) return out;
  revalidatePath(`/einheiten/${unit.id}`, "layout");
  revalidatePath(`/schueler/${unit.student_id}`, "layout");
  return { href: `/einheiten/${unit.id}?papier=${out.papierId}` };
}
