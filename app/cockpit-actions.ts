"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentTaskToBoardAction, type SendState } from "@/app/device-actions";
import { entscheide, erstelleAnpassungen } from "@/lib/anpassen";
import { erklaereAusfuehrlich, schulstufeVon } from "@/lib/ausfuehrlich";
import { requireTeacher } from "@/lib/auth";
import {
  bereiteVor,
  cockpit,
  druckeImSchritt,
  isBeobachtung,
  markiereSchritt,
  merkeSchritt,
  reagiert,
  sendeAusGenerator,
  sendeBestand,
  sendeSchritt,
  setzeAntwort,
  setzeNotiz,
  verschiebeSchritt,
  waehleFaehigkeit,
  waehlePaket,
  zeigeSchritt,
  type Markierung,
  type Merke,
} from "@/lib/cockpit";
import { newExerciseForUnit } from "@/lib/ai/realtime";
import { einfacherErklaeren, einfacherMitKi, kontrolleWeglassen, sendeSchwerer, themaVerstanden, wechsleThema, weitereBeispiele } from "@/lib/knoepfe";
import { noteActivity } from "@/lib/learning";
import { pushLive, showOnTablet } from "@/lib/live";
import { tagAddieren, wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { kiTor, sendeAngepasst } from "@/lib/steuerung";
import { MIT_AUFGABE, type Option } from "@/lib/steuerung-regeln";
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

/** „Wiederholen“ / „Schüler versteht es nicht“: zählt für die Dokumentation mit, der Schritt bleibt auf dem Schirm. */
export async function merkeSchrittAction(unitId: number, schrittId: number, was: Merke) {
  await laufendeEinheit(unitId);
  merkeSchritt(unitId, schrittId, was === "nichtVerstanden" ? "nichtVerstanden" : "wiederholt");
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
  return { ...sent, assignmentId: out.assignmentId, worksheetId: out.worksheetId, unitId: unit.id, student: unit.student_name.split(" ")[0] };
}

/** „Übung senden“: die Aufgaben des Schritts an den Schüler dieser Einheit. */
export async function sendeSchrittAction(unitId: number, schrittId: number, _prev: SendState, _form?: FormData): Promise<SendState> {
  const { t } = await laufendeEinheit(unitId);
  return aufsGeraet(unitId, sendeSchritt(unitId, schrittId, t.id));
}

/** Ohne Lernpaket: eine neue Übung zur Fähigkeit aus den Generatoren, ohne KI. `schrittId`: der Planschritt, aus dem gesendet wird. */
export async function sendeGeneratorAction(unitId: number, skillId: string, schrittId: number | null, _prev: SendState, _form?: FormData): Promise<SendState> {
  const { t } = await laufendeEinheit(unitId);
  return aufsGeraet(unitId, await sendeAusGenerator(unitId, skillId, t.id, Number.isInteger(schrittId) ? schrittId : null));
}

/** Ohne Lernpaket: die Übung aus dem Bestand eines Planschritts, nur mit den Aufgaben seiner Fähigkeit (lib/material-passt.ts). */
export async function sendeBestandAction(unitId: number, schrittId: number, _prev: SendState, _form?: FormData): Promise<SendState> {
  const { t } = await laufendeEinheit(unitId);
  return aufsGeraet(unitId, await sendeBestand(unitId, schrittId, t.id));
}

/**
 * „Drucken“ neben „Übung senden“ (lib/cockpit.ts `druckeImSchritt`): dieselbe Übung ohne Zuweisung, als gedruckt gemerkt, dann die
 * A4-Seite mit „Zur Einheit“ zurück. Geht es nicht, steht der Grund oben im Unterricht.
 */
export async function druckeSchrittAction(unitId: number, schrittId: number) {
  const { t } = await laufendeEinheit(unitId);
  const out = await druckeImSchritt(unitId, schrittId, t.id);
  if ("fehler" in out) return zurueck(unitId, out.fehler);
  revalidatePath(`/einheiten/${unitId}`);
  redirect(`/arbeitsblatt/${out.worksheetId}?einheit=${unitId}`);
}

/**
 * „Ausführlicher erklären“ (lib/ausfuehrlich.ts): der längere Lehrertext zur Fähigkeit des Planschritts, gespeichert oder auf
 * diesen Tipp von der KI. Danach zeigt der Unterricht ihn offen; geht es nicht, steht der Grund oben.
 */
export async function ausfuehrlichAction(unitId: number, schrittId: number) {
  const { t, unit } = await laufendeEinheit(unitId);
  const schritt = cockpit(unitId, { mitPlan: true }).plan.find((s) => s.id === schrittId);
  const student = repo.getStudent(unit.student_id);
  const out = schritt?.skillId && student ? await erklaereAusfuehrlich(schritt.skillId, schulstufeVon(student), t.id) : { ok: false as const, error: "Zu diesem Schritt gibt es keine Fähigkeit." };
  revalidatePath(`/einheiten/${unitId}`);
  redirect(out.ok ? `/einheiten/${unitId}?ausfuehrlich=${schrittId}` : `/einheiten/${unitId}?cockpit=${encodeURIComponent(out.error)}`);
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
  redirect(form.get("ziel") === "uebersicht" || form.get("ziel") === "start" ? "/mehr/uebersicht#vorbereitung" : vorbereitenSeite(studentId, datum));
}

/** Nach „Entfernen“: der Vorschlag der App darf für diesen Tag wieder kommen. */
export async function vorschlagZeigenAction(studentId: number, form: FormData) {
  await requireTeacher();
  if (!repo.getStudent(studentId)) redirect("/");
  const datum = vorbereitungsTag(form.get("datum"));
  vorschlagErlauben(studentId, datum);
  revalidatePath("/");
  revalidatePath(`/schueler/${studentId}/vorbereiten`);
  redirect(form.get("ziel") === "uebersicht" || form.get("ziel") === "start" ? "/mehr/uebersicht#vorbereitung" : vorbereitenSeite(studentId, datum));
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

// ---------- Anpassung im Unterricht (lib/steuerung.ts) ----------

/** Eine Möglichkeit, wie sie aus der Seite kommt: nur bekannte Arten, Stufe 1–5, eine Fähigkeit, die es gibt. */
function pruefeOption(o: Option): Option | null {
  if (!o || !MIT_AUFGABE.includes(o.art) || !o.skillId || !repo.getSkill(o.skillId)) return null;
  const level = Math.round(Number(o.level));
  if (!(level >= 1 && level <= 5)) return null;
  return { art: o.art, skillId: o.skillId, level, fokus: typeof o.fokus === "string" ? o.fokus.slice(0, 200) : null };
}

/** Zurück in den Unterricht: mit „… ist gesendet“ oben, oder mit dem Fehler. */
function nachVorschlag(unitId: number, o: { gesendet?: number; ersatz?: boolean; fehler?: string }): never {
  revalidatePath(`/einheiten/${unitId}`);
  if (o.fehler) redirect(`/einheiten/${unitId}?cockpit=${encodeURIComponent(o.fehler)}`);
  redirect(`/einheiten/${unitId}?gesendet=${o.gesendet ?? ""}${o.ersatz ? "&ki=ersatz" : ""}`);
}

/**
 * „Leichtere Aufgabe senden“, „Schwerere Aufgabe senden“ …: Aufgaben aus dem Bestand (A), sonst aus den Generatoren (B),
 * an den Schüler dieser Einheit und auf ihr Gerät. Ohne Gerät liegt die Übung am Lernlink und zum Drucken bereit.
 */
export async function vorschlagSendenAction(unitId: number, roh: Option) {
  const { t } = await laufendeEinheit(unitId);
  const o = pruefeOption(roh);
  if (!o) nachVorschlag(unitId, { fehler: "Dieser Vorschlag gilt nicht mehr." });
  const out = sendeAngepasst(unitId, o, t.id, cockpit(unitId));
  if ("fehler" in out) nachVorschlag(unitId, { fehler: out.fehler });
  await aufsGeraet(unitId, out);
  nachVorschlag(unitId, { gesendet: out.worksheetId });
}

/**
 * „Neue passende Aufgabe erstellen“ (C): nur auf Tippen, nur wenn die KI darf (lib/steuerung.ts `kiTor`). Die Aufgaben
 * gehen durch dieselben Prüfungen wie „Passende Aufgabe senden“; antwortet die KI nicht, kommen sie aus dem Generator.
 */
export async function vorschlagNeuAction(unitId: number, roh: Option) {
  const { t, unit } = await laufendeEinheit(unitId);
  const o = pruefeOption(roh);
  if (!o) nachVorschlag(unitId, { fehler: "Dieser Vorschlag gilt nicht mehr." });
  const tor = kiTor(unit.student_id);
  if (!tor.erlaubt) nachVorschlag(unitId, { fehler: tor.grund });
  const out = await newExerciseForUnit(unit.id, t.id, { skillId: o.skillId!, level: o.level!, fokus: o.fokus });
  if (!out.ok) nachVorschlag(unitId, { fehler: out.error });
  reagiert(unitId, { art: o.art, skillId: o.skillId, assignmentId: out.assignmentId });
  noteActivity(unit.student_id);
  pushLive(unit.id);
  nachVorschlag(unitId, { gesendet: repo.getAssignment(out.assignmentId)?.worksheet_id, ersatz: out.source !== "ki" });
}

/**
 * Ein Vorschlag ohne neue Aufgabe: Weiter zum nächsten Schritt, gemeinsam an der Tafel (die aktuelle Aufgabe aufs
 * Whiteboard), Einfacher erklären (wie „Schüler versteht es nicht“) oder „Nicht nötig“. Danach zählen nur neue Antworten.
 */
export async function vorschlagReaktionAction(unitId: number, was: "weiter" | "tafel" | "erklaeren" | "nicht_noetig", schrittId: number | null) {
  await laufendeEinheit(unitId);
  reagiert(unitId);
  if (was === "weiter" && schrittId !== null) markiereSchritt(unitId, schrittId, "erledigt");
  if (was === "erklaeren" && schrittId !== null) merkeSchritt(unitId, schrittId, "nichtVerstanden");
  if (was === "tafel") await currentTaskToBoardAction(unitId);
  zurueck(unitId);
}

/** „Richtig / Teilweise / Falsch“ bei einer Frage oder Kontrolle; noch einmal tippen nimmt es zurück. */
export async function antwortAction(unitId: number, schrittId: number, wert: string) {
  await laufendeEinheit(unitId);
  const s = cockpit(unitId).stand;
  const neu = isBeobachtung(wert) && s.antworten[schrittId] !== wert ? wert : null;
  setzeAntwort(unitId, schrittId, neu);
  zurueck(unitId);
}

// ---------- Lehrer-Knöpfe am Schritt (lib/knoepfe.ts) ----------

/** Zurück in den Unterricht, zum Schritt; mit dem Grund oben, wenn es nicht ging. */
function nachKnopf(unitId: number, fehler?: string): never {
  revalidatePath(`/einheiten/${unitId}`);
  redirect(fehler ? `/einheiten/${unitId}?cockpit=${encodeURIComponent(fehler)}` : `/einheiten/${unitId}#schritt`);
}

/** „Einfacher erklären“: ein einfacherer Text und ein neues Beispiel, ohne KI. */
export async function einfacherAction(unitId: number, schrittId: number) {
  const { t } = await laufendeEinheit(unitId);
  const out = einfacherErklaeren(unitId, schrittId, t.id);
  nachKnopf(unitId, "fehler" in out ? out.fehler : undefined);
}

/** Die einfachere Erklärung der KI, nur auf diesen Tipp und nur, wenn die KI für diesen Schüler darf. */
export async function einfacherKiAction(unitId: number, eintragId: number) {
  const { t } = await laufendeEinheit(unitId);
  const out = await einfacherMitKi(unitId, eintragId, t.id);
  nachKnopf(unitId, "fehler" in out ? out.fehler : undefined);
}

/** „Weitere Beispiele“: zwei neue durchgerechnete Beispiele, nur für den Lehrer. */
export async function beispieleAction(unitId: number, schrittId: number) {
  const { t } = await laufendeEinheit(unitId);
  const out = weitereBeispiele(unitId, schrittId, t.id);
  nachKnopf(unitId, "fehler" in out ? out.fehler : undefined);
}

/** „Senden“ in der Vorschau von „Schwerere Aufgaben“: an den Schüler dieser Einheit und auf ihr Gerät. */
export async function schwererSendenAction(unitId: number, schrittId: number) {
  const { t } = await laufendeEinheit(unitId);
  const out = sendeSchwerer(unitId, schrittId, t.id);
  if ("fehler" in out) nachKnopf(unitId, out.fehler);
  await aufsGeraet(unitId, out);
  nachVorschlag(unitId, { gesendet: out.worksheetId });
}

/** „Thema verstanden“: der Rest des Themas fällt weg, die kurze Lernkontrolle bleibt. */
export async function themaVerstandenAction(unitId: number, schrittId: number) {
  const { t } = await laufendeEinheit(unitId);
  const out = themaVerstanden(unitId, schrittId, t.id);
  nachKnopf(unitId, "fehler" in out ? out.fehler : undefined);
}

/** Nach „Thema verstanden“ auch die Lernkontrolle weglassen. */
export async function kontrolleWeglassenAction(unitId: number, eintragId: number) {
  await laufendeEinheit(unitId);
  const out = kontrolleWeglassen(unitId, eintragId);
  nachKnopf(unitId, "fehler" in out ? out.fehler : undefined);
}

/** „Anderes Thema“: ein Thema des Plans (`thema`) oder eine neue Fähigkeit (`skill_id`) aus der Wahl. */
export async function anderesThemaAction(unitId: number, schrittId: number, form: FormData) {
  const { t } = await laufendeEinheit(unitId);
  const out = wechsleThema(unitId, schrittId, { thema: String(form.get("thema") ?? "") || null, skillId: String(form.get("skill_id") ?? "") || null }, t.id);
  nachKnopf(unitId, "fehler" in out ? out.fehler : undefined);
}
