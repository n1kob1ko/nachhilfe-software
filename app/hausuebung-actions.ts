"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { entferneAufgabe, freigeben, kiAufgaben, neuBauen, setzeAnzahl, setzeGeprueft, setzeNotiz, tauscheAufgabe, themaDazu, ueberspringe, zuruecknehmen } from "@/lib/hausuebung";
import { canManageUnit, getUnit } from "@/lib/units";

/**
 * „Hausübung vorbereitet“ im Abschluss (lib/hausuebung.ts). Jede Aktion gilt für genau diese beendete Einheit und nur für ihre Lehrkraft;
 * nichts davon erreicht den Schüler vor „Hausübung freigeben“. Ein Fehler steht als Zeile in der Karte (`?hausuebung=`).
 */
async function beendeteEinheit(unitId: number) {
  const t = await requireTeacher();
  const unit = getUnit(unitId);
  if (!unit) redirect("/abschluss");
  if (!canManageUnit(t, unit)) redirect(`/einheiten/${unitId}?fremd=1`);
  if (unit.status !== "beendet") redirect(`/einheiten/${unitId}`);
  return { t, unit };
}

function zurueck(unitId: number, out: { ok: true } | { fehler: string }) {
  revalidatePath(`/einheiten/${unitId}`);
  if ("fehler" in out) redirect(`/einheiten/${unitId}?hausuebung=${encodeURIComponent(out.fehler)}#hausuebung`);
}

export async function huEntfernenAction(unitId: number, themaId: string, key: string) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, entferneAufgabe(unitId, themaId, key, t.id));
}

export async function huTauschenAction(unitId: number, themaId: string, key: string) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, tauscheAufgabe(unitId, themaId, key, t.id));
}

export async function huGeprueftAction(unitId: number, themaId: string, key: string, geprueft: boolean) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, setzeGeprueft(unitId, themaId, key, geprueft, t.id));
}

export async function huAnzahlAction(unitId: number, themaId: string, form: FormData) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, setzeAnzahl(unitId, themaId, Number(form.get("anzahl")), t.id));
}

export async function huThemaDazuAction(unitId: number, form: FormData) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, themaDazu(unitId, String(form.get("skill_id") ?? ""), t.id));
}

export async function huNotizAction(unitId: number, form: FormData) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, setzeNotiz(unitId, String(form.get("notiz") ?? ""), t.id));
}

/** Wieder aus den Ergebnissen (`ausPlan` false) oder aus den Themen von heute, solange noch kein Ergebnis zählt. */
export async function huNeuAction(unitId: number, ausPlan: boolean) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, neuBauen(unitId, t.id, { ausPlan }));
}

/** „Neue Aufgaben erstellen“ für ein Thema ohne passende Aufgaben: auf Tippen, mit Kosten; „neu erstellt, ungeprüft“. */
export async function huKiAction(unitId: number, themaId: string) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, await kiAufgaben(unitId, themaId, { automatisch: false, teacherId: t.id }));
}

export async function huUeberspringenAction(unitId: number) {
  const { t } = await beendeteEinheit(unitId);
  zurueck(unitId, ueberspringe(unitId, t.id));
}

export async function huZuruecknehmenAction(unitId: number) {
  await beendeteEinheit(unitId);
  zurueck(unitId, zuruecknehmen(unitId));
}

/** „Hausübung freigeben“: eine Übung und eine Hausübung für den Schüler; erst jetzt sieht er sie im Schülerportal. */
export async function huFreigebenAction(unitId: number, form: FormData) {
  const { t, unit } = await beendeteEinheit(unitId);
  const out = freigeben(unitId, { faellig: String(form.get("faellig") ?? ""), teacherId: t.id });
  revalidatePath(`/schueler/${unit.student_id}`);
  revalidatePath("/");
  zurueck(unitId, "fehler" in out ? out : { ok: true });
}
