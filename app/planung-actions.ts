"use server";

/**
 * Server Actions der Planung (Phase 3 des Merges). Sie sind bewusst dünn: angemeldeten Lehrer holen
 * (`lib/auth.ts`), an `lib/planung/aktionen.ts` weitergeben (dort stehen Rechteprüfung und zod),
 * Pfade neu auswerten und mit einer Rückmeldung zurückleiten. Nichts aus dem Formular wird geglaubt.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import * as planung from "@/lib/planung/aktionen";
import type { Ergebnis } from "@/lib/planung/aktionen";
import type { OwnerTyp } from "@/lib/planung/repo";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const zahl = (f: FormData, k: string) => {
  const roh = str(f, k);
  return roh === "" ? Number.NaN : Number(roh.replace(",", "."));
};
const ids = (f: FormData, k: string) =>
  f
    .getAll(k)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

/** Nur Pfade innerhalb der App, damit die Rückleitung nicht nach außen führt. */
function sichererPfad(raw: string, fallback: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

function mitMeldung(pfad: string, ergebnis: Ergebnis): string {
  const trenner = pfad.includes("?") ? "&" : "?";
  return ergebnis.ok
    ? `${pfad}${trenner}ok=${encodeURIComponent(ergebnis.hinweis ?? "Gespeichert.")}`
    : `${pfad}${trenner}fehler=${encodeURIComponent(ergebnis.fehler)}`;
}

function pfadAus(formData: FormData, fallback: string): string {
  return sichererPfad(str(formData, "zurueck"), fallback);
}

function aktualisiere(...pfade: string[]) {
  for (const p of pfade) revalidatePath(p);
}

// ---------- Lehrer: Verfügbarkeit, Wochenziel, Raumwünsche ----------

export async function saveTeacherAvailabilityAction(teacherId: number, formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/lehrer");
  const ergebnis = planung.speichereLehrerVerfuegbarkeit(me, teacherId, str(formData, "availability"));
  aktualisiere("/lehrer");
  revalidatePath("/", "layout");
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function saveTeacherWeeklyTargetAction(teacherId: number, formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/lehrer");
  const roh = str(formData, "weekly_target_min");
  // leeres Feld heißt „kein Ziel“ (null); sonst die Minuten
  const minuten = roh === "" ? null : Number(roh);
  const ergebnis = planung.speichereLehrerWochenziel(me, teacherId, minuten === null || !Number.isFinite(minuten) ? null : Math.round(minuten));
  aktualisiere("/lehrer");
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function saveTeacherPreferredRoomsAction(teacherId: number, formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/lehrer");
  const ergebnis = planung.speichereLehrerRaumPraeferenzen(me, teacherId, ids(formData, "room_ids"));
  aktualisiere("/lehrer");
  redirect(mitMeldung(zurueck, ergebnis));
}

// ---------- Schüler: Planung ----------

export async function saveStudentPlanningAction(studentId: number, formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, `/schueler/${studentId}/bearbeiten`);
  const ergebnis = planung.speichereSchuelerPlanung(me, studentId, {
    einheiten_pro_woche: zahl(formData, "einheiten_pro_woche"),
    geplante_dauer: zahl(formData, "geplante_dauer"),
    modus_wunsch: str(formData, "modus_wunsch"),
    erlaubte_lehrer: ids(formData, "erlaubte_lehrer"),
    availability: str(formData, "availability"),
  });
  aktualisiere(`/schueler/${studentId}`, `/schueler/${studentId}/bearbeiten`, "/");
  redirect(mitMeldung(zurueck, ergebnis));
}

// ---------- Wochenabweichung ----------

export async function saveOverrideAction(ownerType: OwnerTyp, ownerId: number, weekStart: string, formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/lehrer");
  const ergebnis = planung.speichereAbweichung(me, ownerType, ownerId, weekStart, str(formData, "availability"));
  aktualisiere("/lehrer", `/schueler/${ownerId}/bearbeiten`);
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function clearOverrideAction(ownerType: OwnerTyp, ownerId: number, weekStart: string, formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/lehrer");
  const ergebnis = planung.entferneAbweichung(me, ownerType, ownerId, weekStart);
  aktualisiere("/lehrer", `/schueler/${ownerId}/bearbeiten`);
  redirect(mitMeldung(zurueck, ergebnis));
}

// ---------- Räume (nur Verwaltung) ----------

export async function saveRoomAction(formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/mehr/raeume");
  const ergebnis = planung.speichereRaum(me, {
    id: str(formData, "id"),
    building: str(formData, "building"),
    name: str(formData, "name"),
    mode: str(formData, "mode"),
  });
  aktualisiere("/mehr/raeume", "/lehrer");
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function setRoomActiveAction(roomId: number, active: boolean, formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/mehr/raeume");
  const ergebnis = planung.setzeRaumAktiv(me, roomId, active);
  aktualisiere("/mehr/raeume", "/lehrer");
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function deleteRoomAction(roomId: number, formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/mehr/raeume");
  const ergebnis = planung.loescheRaum(me, roomId);
  aktualisiere("/mehr/raeume", "/lehrer");
  redirect(mitMeldung(zurueck, ergebnis));
}
