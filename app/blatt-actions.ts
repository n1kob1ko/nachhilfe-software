"use server";

import { revalidatePath } from "next/cache";
import { hausuebungInDoku } from "@/lib/abschluss";
import { hausuebungZurZuweisung } from "@/lib/hausuebung-zurueck";
import { requireTeacher } from "@/lib/auth";
import { speichereBlatt, type BlattEingabe } from "@/lib/blatt-einlesen";
import { speicherePapier, type PapierEingabe } from "@/lib/papier-einheit";
import { probeTestId } from "@/lib/probeschularbeit";
import * as repo from "@/lib/repo";
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
 * (or the administration). Back to the unit with a short line what was taken over. Without a unit (a Probeschularbeit from
 * the exam card): back to the exam card; a homework (lib/hausuebung-zurueck.ts): back to the homework in the profile, and the
 * confirmed Abschluss that names it is written again.
 */
export async function speicherePapierAction(e: Omit<PapierEingabe, "teacherId">): Promise<{ error: string } | { href: string }> {
  const teacher = await requireTeacher();
  if (e.unitId === null) {
    const out = speicherePapier({ ...e, unitId: null, teacherId: teacher.id });
    if ("error" in out) return out;
    const sid = Number(e.studentId);
    const testId = probeTestId(repo.getAssignment(out.assignmentId)?.worksheet_id ?? 0);
    const hw = testId ? null : hausuebungZurZuweisung(out.assignmentId);
    if (hw) hausuebungInDoku(out.assignmentId);
    revalidatePath(`/schueler/${sid}`, "layout");
    revalidatePath("/");
    return { href: testId ? `/schueler/${sid}/pruefung/${testId}?papier=${out.papierId}#probeschularbeit` : hw ? `/schueler/${sid}?tab=schule#hausuebungen` : `/schueler/${sid}#zu-bewerten` };
  }
  const unit = getUnit(e.unitId);
  if (!unit || !canManageUnit(teacher, unit)) return { error: "Diese Einheit gehört jemand anderem." };
  const out = speicherePapier({ ...e, teacherId: teacher.id });
  if ("error" in out) return out;
  if (hausuebungZurZuweisung(out.assignmentId)) hausuebungInDoku(out.assignmentId);
  revalidatePath(`/einheiten/${unit.id}`, "layout");
  revalidatePath(`/schueler/${unit.student_id}`, "layout");
  return { href: `/einheiten/${unit.id}?papier=${out.papierId}` };
}
