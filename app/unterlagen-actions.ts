"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { canManageUnit, getUnit } from "@/lib/units";
import { merkeGezeigt, waehleSchritt } from "@/lib/unterlagen-unterricht";

/** Unterlagen bei „Das zeigst du“ (lib/unterlagen-unterricht.ts): Öffnen am Schritt und „Passt zu welchem Schritt?“ unter der Vorgabe. */
async function imUnterricht(unitId: number) {
  const t = await requireTeacher();
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet" || !canManageUnit(t, unit)) redirect(`/einheiten/${unitId}`);
  return { t, unit };
}

/**
 * „Öffnen“ bei einer Unterlage im Schritt: vermerkt, dass sie gezeigt wurde (für den Abschluss), und öffnet die Ansicht des Materials
 * mit dem Weg zurück in den Unterricht. Nur eine Unterlage, die dieser Schritt gerade zeigt.
 */
export async function zeigeUnterlageAction(unitId: number, schrittId: number, materialId: number) {
  const { t } = await imUnterricht(unitId);
  if (!merkeGezeigt(unitId, schrittId, materialId, t.id)) redirect(`/einheiten/${unitId}?cockpit=${encodeURIComponent("Diese Unterlage passt nicht mehr zu diesem Schritt.")}`);
  revalidatePath(`/einheiten/${unitId}`);
  redirect(`/mehr/material/${materialId}?einheit=${unitId}`);
}

/** „Passt zu welchem Schritt?“ (`schritt`, leer: keinem): eine Erklärung der Vorgabe einem Schritt dieser Einheit zuordnen. */
export async function unterlageSchrittAction(unitId: number, materialId: number, form: FormData) {
  const { t } = await imUnterricht(unitId);
  const roh = String(form.get("schritt") ?? "");
  const schritt = roh === "" ? null : Number(roh);
  revalidatePath(`/einheiten/${unitId}`);
  if (schritt !== null && !Number.isInteger(schritt)) redirect(`/einheiten/${unitId}?bereich=cockpit&cockpit=${encodeURIComponent("Diesen Schritt gibt es nicht.")}`);
  if (!waehleSchritt(unitId, materialId, schritt, t.id)) redirect(`/einheiten/${unitId}?bereich=cockpit&cockpit=${encodeURIComponent("Die Unterlage ließ sich keinem Schritt zuordnen.")}`);
}
