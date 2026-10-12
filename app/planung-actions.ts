"use server";

/**
 * Server Actions der Planung (Phase 3 und 4 des Merges). Sie sind bewusst dünn: angemeldeten Lehrer
 * holen (`lib/auth.ts`), an `lib/planung/aktionen.ts` weitergeben (dort stehen Rechteprüfung und
 * zod), Pfade neu auswerten und mit einer Rückmeldung zurückleiten. Nichts aus dem Formular wird
 * geglaubt — auch die Berechtigung nicht: jede Aktion prüft sie neu (D23).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import * as planung from "@/lib/planung/aktionen";
import type { Ergebnis } from "@/lib/planung/aktionen";
import type { OwnerTyp, PlatzEingabe } from "@/lib/planung/repo";
import { istDatum, labelMinuten, wochenstartVon } from "@/lib/planung/zeit";

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

// ---------- Wochenplan (Phase 4) ----------

/** Alles, was sich aus einer Woche ändert, neu auswerten: Verwaltung, Druck, Dashboard, Schüler-Link. */
function aktualisiereWoche() {
  aktualisiere("/planung", "/planung/drucken", "/");
  revalidatePath("/lernen/[token]", "page");
}

/** Die Woche aus dem Formular — roh weitergegeben; geprüft wird sie in `lib/planung/aktionen.ts`. */
function wocheAus(formData: FormData): string {
  return str(formData, "woche");
}

function zurueckZurWoche(formData: FormData, woche: string): string {
  const fallback = istDatum(woche) ? `/planung?woche=${wochenstartVon(woche)}` : "/planung";
  return pfadAus(formData, fallback);
}

/** Die Uhrzeit eines Formularfeldes (`type="time"`, „14:30“) als Minuten ab Mitternacht. */
function startMinuten(formData: FormData): number {
  const roh = str(formData, "start");
  const minuten = labelMinuten(roh);
  return minuten === null ? Number.NaN : minuten;
}

/** Ein Platz aus einem Formular: Woche, Wochentag, Start, geplante Dauer, Lehrer, Schüler, Raum. */
function platzAus(formData: FormData, woche: string): Parameters<typeof planung.setzePlatz>[1] {
  const raum = zahl(formData, "room_id");
  return {
    week_start: woche,
    weekday: zahl(formData, "weekday"),
    start_min: startMinuten(formData),
    geplante_dauer: zahl(formData, "geplante_dauer"),
    teacher_id: zahl(formData, "teacher_id"),
    student_id: zahl(formData, "student_id"),
    room_id: Number.isInteger(raum) && raum > 0 ? raum : null,
  };
}

// Generieren und Neu generieren (D23: nur die Verwaltung; eine veröffentlichte Woche wird nicht neu gerechnet)

export async function generateWeekAction(formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const ergebnis = planung.erstelleWochenplan(me, woche);
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function regenerateWeekAction(formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const ergebnis = planung.generiereWocheNeu(me, woche);
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function copyPreviousWeekAction(formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const ergebnis = planung.kopiereVorwoche(me, woche);
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function publishWeekAction(formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const ergebnis = planung.veroeffentlicheWoche(me, woche);
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function discardDraftAction(formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const ergebnis = planung.verwerfeEntwurf(me, woche);
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

// Einzelne Plätze: anlegen, ändern, verschieben, sperren, löschen

export async function createSlotAction(formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const ergebnis = planung.setzePlatz(me, platzAus(formData, woche));
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function editSlotAction(formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const id = Number(str(formData, "id"));
  const ergebnis = Number.isInteger(id) && id > 0 ? planung.aenderePlatz(me, id, platzAus(formData, woche)) : { ok: false as const, fehler: "Geplante Einheit nicht gefunden." };
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

/** Ein Platz landet auf einem anderen Tag, einer anderen Zeit oder bei einem anderen Lehrer (Ziehen). */
export async function moveSlotAction(formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const id = Number(str(formData, "id"));
  const aenderung: Partial<PlatzEingabe> = {
    weekday: zahl(formData, "weekday"),
    start_min: startMinuten(formData),
  };
  for (const feld of ["teacher_id", "student_id", "geplante_dauer"] as const) {
    const wert = zahl(formData, feld);
    if (Number.isFinite(wert)) aenderung[feld] = wert;
  }
  if (str(formData, "room_id") !== "") {
    const raum = zahl(formData, "room_id");
    aenderung.room_id = Number.isInteger(raum) && raum > 0 ? raum : null;
  }
  const ergebnis = Number.isInteger(id) && id > 0 ? planung.aenderePlatz(me, id, aenderung) : { ok: false as const, fehler: "Geplante Einheit nicht gefunden." };
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function lockSlotAction(id: number, locked: boolean, formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const ergebnis = planung.setzeGesperrt(me, id, locked);
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

export async function deleteSlotAction(id: number, formData: FormData) {
  const me = await requireTeacher();
  const woche = wocheAus(formData);
  const zurueck = zurueckZurWoche(formData, woche);
  const ergebnis = planung.loeschePlatz(me, id);
  aktualisiereWoche();
  redirect(mitMeldung(zurueck, ergebnis));
}

/**
 * Ist dieses Ziel beim Ziehen erlaubt? Bewusst **ohne** Rückleitung: die Wochenansicht fragt hier
 * nur nach und färbt unzulässige Ziele aus. Geschrieben wird nichts; die Antwort kommt aus
 * `repo.pruefeUeberlappung`, der einzigen Überlappungsprüfung der App.
 */
export async function checkSlotTargetAction(
  id: number,
  ziel: { teacherId?: number; studentId?: number; roomId?: number | null; weekday?: number; startMin?: number },
): Promise<Ergebnis> {
  const me = await requireTeacher();
  return planung.pruefeZiel(me, id, ziel);
}

// Die Regeln des Wochenplans (nur die Verwaltung)

export async function saveRulesAction(formData: FormData) {
  const me = await requireTeacher();
  const zurueck = pfadAus(formData, "/planung");
  const wahr = (k: string) => str(formData, k) === "on" || str(formData, k) === "1";
  let paare: unknown = [];
  const paareRoh = str(formData, "studentPairTimingRules");
  if (paareRoh) {
    try {
      paare = JSON.parse(paareRoh);
    } catch {
      paare = null;
    }
  }
  const ergebnis =
    paare === null
      ? { ok: false as const, fehler: "Die Paarregeln konnten nicht gelesen werden (kein JSON)." }
      : planung.speichereRegeln(me, {
          snapMinutes: zahl(formData, "snapMinutes"),
          gapUsefulMinutesThreshold: zahl(formData, "gapUsefulMinutesThreshold"),
          pointsPreferredTeacher: zahl(formData, "pointsPreferredTeacher"),
          pointsAdjacentTeacher: zahl(formData, "pointsAdjacentTeacher"),
          penaltyPer30MinGap: zahl(formData, "penaltyPer30MinGap"),
          penaltySingleLessonTeacherDay: zahl(formData, "penaltySingleLessonTeacherDay"),
          penaltyLessPlannedLessonsOverall: zahl(formData, "penaltyLessPlannedLessonsOverall"),
          pointsPerMinuteRemainingCapacity: zahl(formData, "pointsPerMinuteRemainingCapacity"),
          pointsStudentPairShouldSameTime: zahl(formData, "pointsStudentPairShouldSameTime"),
          penaltyStudentPairShouldntSameTime: zahl(formData, "penaltyStudentPairShouldntSameTime"),
          prioritizeMaxPlannedLessons: wahr("prioritizeMaxPlannedLessons"),
          enforceSingleLessonPerStudentPerDay: wahr("enforceSingleLessonPerStudentPerDay"),
          enforceTeacherCapacity: wahr("enforceTeacherCapacity"),
          enforceTeacherAvailability: wahr("enforceTeacherAvailability"),
          enforceStudentAvailability: wahr("enforceStudentAvailability"),
          enforceTeacherRoomPreference: wahr("enforceTeacherRoomPreference"),
          enforceNoTeacherBreaks: wahr("enforceNoTeacherBreaks"),
          enforceStudentWeekWeekendDistribution: wahr("enforceStudentWeekWeekendDistribution"),
          studentPairTimingRules: paare,
        });
  aktualisiere("/planung");
  redirect(mitMeldung(zurueck, ergebnis));
}
