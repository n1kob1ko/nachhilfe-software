"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { sendeAusGenerator } from "@/lib/cockpit";
import {
  isStufe,
  isWeg,
  kurztestFertig,
  leseAblauf,
  offenesStoffBlatt,
  setzeAktuell,
  setzeAnsicht,
  setzeSchritt,
  setzeStufe,
  setzeThemen,
  stoffpaketDerEinheit,
  stoffUebernehmen,
  waehleWeg,
} from "@/lib/einheit-ablauf";
import { noteActivity } from "@/lib/learning";
import { pushLive } from "@/lib/live";
import { letzterStoff } from "@/lib/minitest";
import * as repo from "@/lib/repo";
import { starteStoffpaket, verwirfStoffpaket } from "@/lib/stoffpaket";
import { zeigeUebung } from "@/lib/tafel-senden";
import { canManageUnit, getUnit } from "@/lib/units";
import { vorgabeDerEinheit } from "@/lib/vorgabe";

/**
 * Die Knöpfe des geführten Ablaufs (lib/einheit-ablauf.ts, components/einheit/Gefuehrt.tsx). Jede Aktion gilt für genau diese
 * laufende Einheit und ihren Lehrer; danach zeigt die Seite die nächste Stufe, ein Fehler steht oben in einer Zeile.
 */
async function laufend(unitId: number) {
  const t = await requireTeacher();
  const unit = getUnit(unitId);
  if (!unit) redirect("/einheiten");
  if (!canManageUnit(t, unit)) redirect(`/einheiten/${unitId}?fremd=1`);
  if (unit.status !== "gestartet") redirect(`/einheiten/${unitId}`);
  return { t, unit };
}

function weiter(unitId: number, out: { ok: true } | { fehler: string }, extra = ""): never {
  revalidatePath(`/einheiten/${unitId}`);
  redirect("fehler" in out ? `/einheiten/${unitId}?ablauf=${encodeURIComponent(out.fehler)}` : `/einheiten/${unitId}${extra}`);
}

/** „Weiter mit …“ (Stoff vom letzten Mal, dann der Kurztest) oder „Neues Thema“ (dann die Fotos vom Stoff). */
export async function wegAction(unitId: number, weg: string) {
  const { unit } = await laufend(unitId);
  if (!isWeg(weg)) weiter(unitId, { fehler: "Unbekannte Wahl." });
  const skills = weg === "weiter" ? (letzterStoff(unit.student_id, unit.id)?.faehigkeiten.map((f) => f.id).slice(0, 3) ?? []) : [];
  weiter(unitId, waehleWeg(unitId, weg, skills));
}

/** Eine Stufe oben antippen oder „Weiter: …“. */
export async function stufeAction(unitId: number, stufe: string) {
  await laufend(unitId);
  if (!isStufe(stufe)) weiter(unitId, { fehler: "Unbekannte Stufe." });
  weiter(unitId, setzeStufe(unitId, stufe));
}

/** Nach den Fotos vom Stoff: die erkannten Themen übernehmen und erklären. */
export async function stoffFertigAction(unitId: number) {
  await laufend(unitId);
  const ids = vorgabeDerEinheit(unitId)?.skillIds ?? [];
  if (!ids.length) weiter(unitId, { fehler: "Es ist noch kein Thema erkannt. Bitte Fotos aufnehmen oder kurz hineinschreiben, was dran ist." });
  const t = setzeThemen(unitId, ids);
  if ("fehler" in t) weiter(unitId, t);
  weiter(unitId, setzeStufe(unitId, "erklaeren"));
}

/** „Übernehmen und erklären“: der fertige Stoff (Präsentation, Sprechtext, Fragen, Übungsblatt) wird der Ablauf dieser Einheit. */
export async function stoffUebernehmenAction(unitId: number) {
  const { t } = await laufend(unitId);
  const out = stoffUebernehmen(unitId, t.id);
  revalidatePath(`/schueler/${getUnit(unitId)?.student_id}`);
  weiter(unitId, out);
}

/** „Noch einmal“ nach einem Fehler: dieselben Fotos, derselbe Text (kein Name war schon bestätigt). */
export async function stoffNochmalAction(unitId: number) {
  const { t, unit } = await laufend(unitId);
  const p = stoffpaketDerEinheit(unitId);
  if (!p || p.status !== "fehler") weiter(unitId, { ok: true });
  const out = starteStoffpaket({ studentId: unit.student_id, teacherId: t.id, unitId, fach: p.fach, anweisung: p.anweisung, materialIds: p.dateien, teile: p.teile, keinName: true });
  weiter(unitId, "fehler" in out ? out : { ok: true });
}

/** „Andere Fotos“: der vorbereitete Stoff wird verworfen (beim Schüler kommt nichts an), das Formular kommt wieder. */
export async function stoffVerwerfenAction(unitId: number) {
  await laufend(unitId);
  const p = stoffpaketDerEinheit(unitId);
  if (p && p.status !== "laeuft") verwirfStoffpaket(p.id);
  weiter(unitId, { ok: true });
}

/** „Weiter“ und „Zurück“ durch die Schritte des Lernpakets in „Erklären“. */
export async function schrittAction(unitId: number, schrittId: number) {
  await laufend(unitId);
  weiter(unitId, setzeSchritt(unitId, schrittId));
}

/** Ein anderes Thema von heute erklären oder üben. */
export async function themaAction(unitId: number, skillId: string, stufe: string) {
  await laufend(unitId);
  weiter(unitId, setzeAktuell(unitId, skillId, isStufe(stufe) ? stufe : undefined));
}

/** „Kurztest ist fertig“: auch wenn nicht alles beantwortet ist, zählt das Ergebnis jetzt. */
export async function kurztestFertigAction(unitId: number) {
  await laufend(unitId);
  weiter(unitId, kurztestFertig(unitId));
}

/**
 * „Übungen senden“ in Üben: zuerst das Übungsblatt aus dem Stoff dieser Einheit (8 Aufgaben aus den Fotos, lib/stoffpaket.ts),
 * solange es nicht gesendet ist; sonst eine neue Übung zum Thema aus Generator, Bank oder Bibliothek, ohne KI, passend zum
 * Lernstand (lib/cockpit.ts `sendeAusGenerator`), aufs Gerät des Schülers. Das Thema wird das aktuelle; die Stufe ist danach Üben.
 */
export async function uebenAction(unitId: number, skillId: string) {
  await sende(unitId, skillId, true);
}

/** „Aufgaben zu den Fehlern im Text senden“: eine Übung zur Fähigkeit der Fehler, nie das Übungsblatt aus dem Stoff. */
export async function textFehlerAction(unitId: number, skillId: string) {
  await sende(unitId, skillId, false);
}

async function sende(unitId: number, skillId: string, mitStoffBlatt: boolean) {
  const { t, unit } = await laufend(unitId);
  const a = leseAblauf(unitId);
  if (a.weg) {
    setzeAktuell(unitId, skillId);
    if (a.stufe !== "ueben") setzeStufe(unitId, "ueben");
  }
  const blatt = mitStoffBlatt ? offenesStoffBlatt(unitId) : null;
  const out = blatt ? { worksheetId: blatt, assignmentId: repo.assignWorksheet(blatt, unit.student_id, "", unit.id) } : await sendeAusGenerator(unitId, skillId, t.id);
  if ("fehler" in out) weiter(unitId, out);
  noteActivity(unit.student_id);
  zeigeUebung(unit, out.assignmentId);
  pushLive(unit.id);
  revalidatePath("/", "layout");
  redirect(`/einheiten/${unitId}?gesendet=${out.worksheetId}`);
}

/** „Mehr Werkzeuge“ öffnet das ganze frühere Cockpit (`alles`), „Zurück zum Ablauf“ wieder die eine Stufe. */
export async function ansichtAction(unitId: number, alles: boolean) {
  await laufend(unitId);
  weiter(unitId, setzeAnsicht(unitId, alles), alles ? "?bereich=cockpit#werkzeuge" : "");
}
