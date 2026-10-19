"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { noteActivity } from "@/lib/learning";
import { pushLive, showOnTablet } from "@/lib/live";
import { erstelleMinitest } from "@/lib/minitest";
import { canManageUnit, getUnit } from "@/lib/units";

/**
 * „Minitest“ in der laufenden Einheit: erstellt ihn aus dem Stoff der letzten Einheit (lib/minitest.ts)
 * und bringt ihn auf das Gerät des Schülers, oder öffnet ihn zum Drucken.
 */
export async function minitestAction(f: FormData) {
  const teacher = await requireTeacher();
  const unitId = Number(f.get("unit_id"));
  const unit = getUnit(unitId);
  if (!unit) redirect("/einheiten");
  if (!canManageUnit(teacher, unit)) redirect(`/einheiten/${unitId}?fremd=1`);
  const ziel = f.get("ziel") === "druck" ? "druck" : "geraet";
  let out: ReturnType<typeof erstelleMinitest> | null = null;
  let fehler = "";
  try {
    out = erstelleMinitest({ unitId, teacherId: teacher.id, anzahl: Number(f.get("anzahl")), ziel });
  } catch (e) {
    fehler = e instanceof Error ? e.message : "Der Minitest konnte nicht erstellt werden.";
  }
  if (!out) redirect(`/einheiten/${unitId}?minitest=${encodeURIComponent(fehler)}`);
  noteActivity(unit.student_id);
  if (ziel === "geraet" && out.assignmentId) showOnTablet(unit, { kind: "aufgabe", assignmentId: out.assignmentId });
  pushLive(unit.id);
  revalidatePath("/", "layout");
  redirect(ziel === "druck" ? `/arbeitsblatt/${out.worksheetId}?einheit=${unit.id}` : `/einheiten/${unit.id}?gesendet=${out.worksheetId}`);
}
