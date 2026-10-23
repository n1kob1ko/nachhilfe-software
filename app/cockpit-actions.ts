"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SendState } from "@/app/device-actions";
import { entscheide, erstelleAnpassungen } from "@/lib/anpassen";
import { requireTeacher } from "@/lib/auth";
import { bereiteVor, markiereSchritt, sendeAusGenerator, sendeSchritt, setzeNotiz, verschiebeSchritt, waehleFaehigkeit, waehlePaket, zeigeSchritt, type Markierung } from "@/lib/cockpit";
import { noteActivity } from "@/lib/learning";
import { pushLive, showOnTablet } from "@/lib/live";
import { tagAddieren, wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { canManageUnit, getUnit } from "@/lib/units";
import { entferneVorschlag, VORAUS_TAGE, vorschlagErlauben } from "@/lib/vorbereitung-auto";

/**
 * Das Cockpit der laufenden Einheit (lib/cockpit.ts). Jede Aktion gilt für genau diese Einheit: auch mit zwei
 * Einheiten zugleich geht eine Übung an deren Schüler und auf deren Gerät.
 */
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

export async function waehlePaketAction(unitId: number, form: FormData) {
  await laufendeEinheit(unitId);
  const id = Number(form.get("paket_id"));
  const out = waehlePaket(unitId, Number.isInteger(id) && id > 0 ? id : null);
  zurueck(unitId, "fehler" in out ? out.fehler : undefined);
}

export async function waehleFaehigkeitAction(unitId: number, form: FormData) {
  await laufendeEinheit(unitId);
  const out = waehleFaehigkeit(unitId, String(form.get("skill_id") ?? "") || null);
  zurueck(unitId, "fehler" in out ? out.fehler : undefined);
}

export async function markiereSchrittAction(unitId: number, schrittId: number, was: Markierung) {
  await laufendeEinheit(unitId);
  markiereSchritt(unitId, schrittId, was);
  zurueck(unitId);
}

export async function zeigeSchrittAction(unitId: number, schrittId: number) {
  await laufendeEinheit(unitId);
  zeigeSchritt(unitId, schrittId);
  zurueck(unitId);
}

export async function verschiebeSchrittAction(unitId: number, schrittId: number, richtung: -1 | 1) {
  await laufendeEinheit(unitId);
  verschiebeSchritt(unitId, schrittId, richtung === -1 ? -1 : 1);
  zurueck(unitId);
}

/** Die Notiz des Lehrers zu einem Schritt; bleibt beim Lehrer. */
export async function notizAction(unitId: number, schrittId: number, text: string): Promise<{ ok: boolean }> {
  await laufendeEinheit(unitId);
  const ok = setzeNotiz(unitId, schrittId, String(text ?? ""));
  revalidatePath(`/einheiten/${unitId}`);
  return { ok };
}

/** Bringt eine eben zugewiesene Übung auf das Gerät der Einheit, wie „An Anna senden“. */
async function aufsGeraet(unitId: number, out: { worksheetId: number; assignmentId: number } | { fehler: string }): Promise<SendState> {
  if ("fehler" in out) return { status: "fehler", error: out.fehler };
  const unit = getUnit(unitId)!;
  noteActivity(unit.student_id);
  const sent = showOnTablet(unit, { kind: "aufgabe", assignmentId: out.assignmentId });
  pushLive(unit.id);
  revalidatePath("/", "layout");
  return { ...sent, assignmentId: out.assignmentId, unitId: unit.id, student: unit.student_name.split(" ")[0] };
}

/** „Übung senden“: die Aufgaben des Schritts an den Schüler dieser Einheit. */
export async function sendeSchrittAction(unitId: number, schrittId: number, _prev: SendState, _form?: FormData): Promise<SendState> {
  const { t } = await laufendeEinheit(unitId);
  return aufsGeraet(unitId, sendeSchritt(unitId, schrittId, t.id));
}

/** Ohne Lernpaket: eine neue Übung zur Fähigkeit aus den Generatoren, ohne KI. */
export async function sendeGeneratorAction(unitId: number, skillId: string, _prev: SendState, _form?: FormData): Promise<SendState> {
  const { t } = await laufendeEinheit(unitId);
  return aufsGeraet(unitId, await sendeAusGenerator(unitId, skillId, t.id));
}

/** Der Tag einer Vorbereitung aus dem Formular: heute bis in sieben Tagen, sonst heute. */
function vorbereitungsTag(wert: unknown): string {
  const heute = wienerDatum();
  const d = typeof wert === "string" && /^\d{4}-\d{2}-\d{2}$/.test(wert) ? wert : heute;
  return d >= heute && d < tagAddieren(heute, VORAUS_TAGE) ? d : heute;
}

const vorbereitenSeite = (studentId: number, datum: string) => `/schueler/${studentId}/vorbereiten${datum === wienerDatum() ? "" : `?datum=${datum}`}`;

/** „Einheit vorbereiten“ auf der Startseite: das Lernpaket für den Tag, die Einheit übernimmt es beim Start. */
export async function vorbereitenAction(studentId: number, form: FormData) {
  const t = await requireTeacher();
  if (!repo.getStudent(studentId)) redirect("/");
  const id = Number(form.get("paket_id"));
  const datum = vorbereitungsTag(form.get("datum"));
  const seite = vorbereitenSeite(studentId, datum);
  const out = bereiteVor(studentId, datum, Number.isInteger(id) && id > 0 ? id : null, t.id);
  revalidatePath("/");
  revalidatePath(`/schueler/${studentId}/vorbereiten`);
  if ("fehler" in out) redirect(`${seite}${seite.includes("?") ? "&" : "?"}fehler=${encodeURIComponent(out.fehler)}`);
  redirect(id > 0 ? "/" : seite);
}

/**
 * „Entfernen“ beim Vorschlag der App (lib/vorbereitung-auto.ts): für diesen Schüler und Tag kein Paket. `ziel`
 * ist die Seite, auf der getippt wurde (Startseite oder „Einheit vorbereiten“).
 */
export async function entferneVorschlagAction(studentId: number, form: FormData) {
  const t = await requireTeacher();
  if (!repo.getStudent(studentId)) redirect("/");
  const datum = vorbereitungsTag(form.get("datum"));
  entferneVorschlag(studentId, datum, t.id);
  revalidatePath("/");
  revalidatePath(`/schueler/${studentId}/vorbereiten`);
  redirect(form.get("ziel") === "start" ? "/#vorbereitung" : vorbereitenSeite(studentId, datum));
}

/** Nach „Entfernen“: der Vorschlag der App darf für diesen Tag wieder kommen. */
export async function vorschlagZeigenAction(studentId: number, form: FormData) {
  await requireTeacher();
  if (!repo.getStudent(studentId)) redirect("/");
  const datum = vorbereitungsTag(form.get("datum"));
  vorschlagErlauben(studentId, datum);
  revalidatePath("/");
  revalidatePath(`/schueler/${studentId}/vorbereiten`);
  redirect(form.get("ziel") === "start" ? "/#vorbereitung" : vorbereitenSeite(studentId, datum));
}

export type AnpassenState = { ok: boolean; meldung: string } | null;

/** „Anpassen“: Vorschläge der KI für den Schüler dieser Einheit, nur auf Klick. Ungeprüft, bis der Lehrer entscheidet. */
export async function anpassenAction(unitId: number, _prev: AnpassenState, _form?: FormData): Promise<AnpassenState> {
  const { t } = await laufendeEinheit(unitId);
  const out = await erstelleAnpassungen(unitId, t.id);
  revalidatePath(`/einheiten/${unitId}`);
  if (!out.ok) return { ok: false, meldung: out.error };
  return { ok: true, meldung: `${out.anzahl} ${out.anzahl === 1 ? "Vorschlag" : "Vorschläge"} da. Bitte prüfen, bevor du sie verwendest.` };
}

/** Einen Vorschlag für diese Einheit übernehmen oder verwerfen; das Lernpaket bleibt, wie es ist. */
export async function entscheideAnpassungAction(unitId: number, id: number, status: "uebernommen" | "verworfen") {
  await laufendeEinheit(unitId);
  entscheide(unitId, id, status === "uebernommen" ? "uebernommen" : "verworfen");
  zurueck(unitId);
}
