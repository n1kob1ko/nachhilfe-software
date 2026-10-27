"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { dayOf } from "@/lib/exams";
import { istRolle } from "@/lib/pruefungsstoff";
import { canManageUnit, getUnit } from "@/lib/units";
import { aendereRolle, bestaetigeVorgabe, entferneVorgabe, pruefungAusVorgabe, stoffZurPruefung, wendeVorgabeAn } from "@/lib/vorgabe";

/** „Was steht heute an?“ (lib/vorgabe.ts): die Knöpfe der Karte im Unterricht. Gespeichert wird über app/material/vorgabe. */
async function laufendeEinheit(unitId: number) {
  const t = await requireTeacher();
  const unit = getUnit(unitId);
  if (!unit) redirect("/einheiten");
  if (!canManageUnit(t, unit)) redirect(`/einheiten/${unitId}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unitId}`);
  return { t, unit };
}

const zurueck = (unitId: number, fehler?: string) => {
  revalidatePath(`/einheiten/${unitId}`);
  if (fehler) redirect(`/einheiten/${unitId}?bereich=cockpit&cockpit=${encodeURIComponent(fehler)}`);
};

/** „Plan anpassen“: der Ablauf richtet sich nach der Vorgabe, auch wenn schon etwas erledigt ist (fängt von vorne an). */
export async function planAnpassenAction(unitId: number) {
  await laufendeEinheit(unitId);
  const out = wendeVorgabeAn(unitId, { erzwingen: true });
  zurueck(unitId, out.angewendet ? undefined : "Der Plan ließ sich nicht anpassen.");
}

export async function entferneVorgabeAction(unitId: number) {
  await laufendeEinheit(unitId);
  entferneVorgabe(unitId);
  zurueck(unitId);
}

/** Unklare Punkte der Vorgabe kurz bestätigen: `zuordnung_<index>` mit den gewählten Fähigkeiten (mehrere möglich), leer für „Keine passt“. */
export async function bestaetigeVorgabeAction(unitId: number, form: FormData) {
  const { t } = await laufendeEinheit(unitId);
  const wahl = new Map<number, (string | null)[]>();
  for (const [k, v] of form.entries()) {
    const m = k.match(/^zuordnung_(\d+)$/);
    if (m) wahl.set(Number(m[1]), [...(wahl.get(Number(m[1])) ?? []), String(v) || null]);
  }
  bestaetigeVorgabe(unitId, wahl, t.id);
  zurueck(unitId);
}

/** Ein Termin aus der Vorgabe („nächste Woche Test“): erst mit dem Datum, das die Lehrkraft gewählt hat. */
export async function pruefungAusVorgabeAction(unitId: number, form: FormData) {
  const { t, unit } = await laufendeEinheit(unitId);
  const out = pruefungAusVorgabe(unitId, { datum: String(form.get("datum") ?? ""), art: String(form.get("art") ?? ""), teacherId: t.id, heute: dayOf(new Date()) });
  if ("fehler" in out) return zurueck(unitId, out.fehler);
  revalidatePath(`/schueler/${unit.student_id}`);
  zurueck(unitId);
}

/** „Stoff zur Schularbeit am … übernehmen“: der gelesene Stoffzettel an die eingetragene Prüfung (lib/vorgabe.ts `stoffZurPruefung`). */
export async function stoffZurPruefungAction(unitId: number, testId: number) {
  const { unit } = await laufendeEinheit(unitId);
  const out = stoffZurPruefung(unitId, testId, dayOf(new Date()));
  if ("fehler" in out) return zurueck(unitId, out.fehler);
  revalidatePath(`/schueler/${unit.student_id}`);
  revalidatePath(`/schueler/${unit.student_id}/pruefung/${testId}`);
  zurueck(unitId);
}

/** „Foto 2: erklärt ein Thema“ geändert (`rolle`): an der Datei gespeichert, die Vorgabe ohne KI-Anfrage neu gemacht. */
export async function rolleAendernAction(unitId: number, materialId: number, form: FormData) {
  await laufendeEinheit(unitId);
  const rolle = String(form.get("rolle") ?? "");
  if (!istRolle(rolle) || !aendereRolle(unitId, materialId, rolle)) return zurueck(unitId, "Die Art des Blatts ließ sich nicht ändern.");
  zurueck(unitId);
}
