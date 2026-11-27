"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { merkeGedruckt, sendeAusGenerator } from "@/lib/cockpit";
import {
  isStufe,
  isWeg,
  kurztestFertig,
  leseAblauf,
  offenesStoffBlatt,
  gedruckteUebungZu,
  papierOhneFoto,
  setzeAktuell,
  setzeAnsicht,
  setzeSchritt,
  setzeStufe,
  stoffFertig,
  stoffpaketDerEinheit,
  stoffUebernehmen,
  waehleWeg,
  zumUeben,
} from "@/lib/einheit-ablauf";
import { alsHeft, gehtAlsHeft, getHeft, pruefeHeft, stiftGeht } from "@/lib/heft";
import { noteActivity } from "@/lib/learning";
import { pushLive } from "@/lib/live";
import { letzterStoff } from "@/lib/minitest";
import * as repo from "@/lib/repo";
import { starteStoffpaket, verwirfStoffpaket } from "@/lib/stoffpaket";
import { zeigeUebung } from "@/lib/tafel-senden";
import { sendeZuDenTextFehlern } from "@/lib/text-uebung";
import { getHeftLauf, starteUebungsheft } from "@/lib/uebungsheft";
import { releaseWorksheet } from "@/lib/builder";
import { canManageUnit, getUnit } from "@/lib/units";
import { druckLinkZumFotografieren } from "@/lib/arbeitsblatt";

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

/** Am Start: mit dem Text von heute oder der schon gesendeten Übung weiter, ohne Weg zu wählen. */
export async function zumUebenAction(unitId: number) {
  await laufend(unitId);
  weiter(unitId, zumUeben(unitId));
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
  weiter(unitId, stoffFertig(unitId));
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

/** „Lieber tippen“ (Mathe): dieselbe Übung wie sonst am Tablet, mit Antwortfeldern statt im Heft. */
export async function uebenTippenAction(unitId: number, skillId: string) {
  await sende(unitId, skillId, true, false);
}

/** „Aufgaben zu den Fehlern im Text senden“: eine Übung zur Fähigkeit der Fehler, nie das Übungsblatt aus dem Stoff. */
export async function textFehlerAction(unitId: number, skillId: string) {
  await sende(unitId, skillId, false);
}

/**
 * „Übungen zu allen Fehlern senden“ (Text von heute, auch auf der Korrektur-Seite): EINE Übung zu allen offenen Fehlerbereichen
 * des Texts, der häufigste zuerst, am Ende Sätze aus dem eigenen Text zum Verbessern (lib/text-uebung.ts).
 */
export async function textFehlerAlleAction(unitId: number) {
  const { t, unit } = await laufend(unitId);
  const a = leseAblauf(unitId);
  if (a.weg && a.stufe !== "ueben") setzeStufe(unitId, "ueben");
  const out = sendeZuDenTextFehlern(unitId, t.id);
  if ("fehler" in out) weiter(unitId, out);
  ausgeben(unit, out);
}

/**
 * „Übungsheft zu den Fehlern erstellen“ (lib/uebungsheft.ts): die KI baut aus dem korrigierten Text von heute ein ganzes Heft mit
 * Teilen, Merke und Sätzen aus dem eigenen Text, im Hintergrund. Die Karte zeigt „wird erstellt“, dann „ans Tablet senden“.
 */
export async function uebungsheftAction(unitId: number, textId: number, zurueck: "einheit" | "korrektur" = "einheit") {
  const { t } = await laufend(unitId);
  const a = leseAblauf(unitId);
  if (a.weg && a.stufe !== "ueben") setzeStufe(unitId, "ueben");
  const out = starteUebungsheft({ teacherId: t.id, unitId, textId });
  if (zurueck === "korrektur") {
    revalidatePath(`/texte/${textId}/korrektur`);
    redirect(`/texte/${textId}/korrektur${"fehler" in out ? `?heft=${encodeURIComponent(out.fehler)}` : ""}`);
  }
  weiter(unitId, "fehler" in out ? out : { ok: true });
}

/**
 * Das fertige Übungsheft ans Tablet: freigeben, dem Schüler der Einheit zuweisen, am Tablet zeigen. Mit `stift` (wenn das geht) als
 * Heft zum Schreiben mit dem Stift, liniert (lib/heft.ts): beim „Fertig“ liest die KI alle Seiten; sonst mit Antwortfeldern.
 */
export async function uebungsheftSendenAction(unitId: number, laufId: number, stift = false) {
  const { unit } = await laufend(unitId);
  const lauf = getHeftLauf(laufId);
  if (!lauf || lauf.status !== "fertig" || !lauf.worksheetId || lauf.studentId !== unit.student_id) weiter(unitId, { fehler: "Dieses Übungsheft gibt es hier nicht." });
  const w = repo.getWorksheet(lauf.worksheetId);
  if (!w || w.student_id !== unit.student_id) weiter(unitId, { fehler: "Dieses Übungsheft gibt es hier nicht." });
  // schon gesendet (zweiter Tipp): dieselbe Zuweisung noch einmal zeigen
  const schon = repo.listAssignmentsForWorksheet(w.id).find((x) => x.unit_id === unit.id && x.student_id === unit.student_id);
  const r = schon ? { assignmentId: schon.id } : releaseWorksheet(w.id, unit.student_id);
  if ("error" in r && r.error) weiter(unitId, { fehler: r.error });
  if (!r.assignmentId) weiter(unitId, { fehler: "Das Übungsheft konnte nicht gesendet werden." });
  // nur ein neu gesendetes Heft wird eins zum Schreiben; was schon mit Antwortfeldern läuft, bleibt so
  if (stift && !schon && stiftGeht(unit)) alsHeft(r.assignmentId);
  ausgeben(unit, { worksheetId: w.id, assignmentId: r.assignmentId }, false);
}

async function sende(unitId: number, skillId: string, mitStoffBlatt: boolean, heft = true) {
  const { t, unit } = await laufend(unitId);
  const a = leseAblauf(unitId);
  if (a.weg) {
    setzeAktuell(unitId, skillId);
    if (a.stufe !== "ueben") setzeStufe(unitId, "ueben");
  }
  const blatt = mitStoffBlatt ? offenesStoffBlatt(unitId) : null;
  const out = blatt ? { worksheetId: blatt, assignmentId: repo.assignWorksheet(blatt, unit.student_id, "", unit.id) } : await sendeAusGenerator(unitId, skillId, t.id);
  if ("fehler" in out) weiter(unitId, out);
  ausgeben(unit, out, heft);
}

/** Die gesendete Übung aufs Gerät des Schülers, dann zurück zur Einheit. */
function ausgeben(unit: NonNullable<ReturnType<typeof getUnit>>, out: { worksheetId: number; assignmentId: number }, heft = true): never {
  if (heft && gehtAlsHeft(unit)) alsHeft(out.assignmentId);
  noteActivity(unit.student_id);
  zeigeUebung(unit, out.assignmentId);
  pushLive(unit.id);
  revalidatePath("/", "layout");
  redirect(`/einheiten/${unit.id}?gesendet=${out.worksheetId}`);
}

/** „Mehr Werkzeuge“ öffnet das ganze frühere Cockpit (`alles`), „Zurück zum Ablauf“ wieder die eine Stufe. */
export async function ansichtAction(unitId: number, alles: boolean) {
  await laufend(unitId);
  weiter(unitId, setzeAnsicht(unitId, alles), alles ? "?bereich=cockpit#werkzeuge" : "");
}

/**
 * „Lieber auf Papier rechnen“ (niko, 26.11.2026, Mathe: am Whiteboard „so restriktiv“): dieselbe Übung wie am Tablet (zuerst das
 * Übungsblatt aus dem Stoff), aber gedruckt. Danach zeigt Üben „Seite fotografieren“; die KI liest alle Aufgaben in einem Lauf.
 */
export async function uebenPapierAction(unitId: number, skillId: string) {
  const { t } = await laufend(unitId);
  const a = leseAblauf(unitId);
  if (a.weg) {
    setzeAktuell(unitId, skillId);
    if (a.stufe !== "ueben") setzeStufe(unitId, "ueben");
  }
  const blatt = offenesStoffBlatt(unitId);
  // already printed for this topic and not photographed yet: the same sheet again, not a second one with the same name
  const gedruckt = blatt ? null : gedruckteUebungZu(unitId, skillId);
  let wid: number;
  if (blatt) {
    merkeGedruckt(blatt, unitId, 0);
    wid = blatt;
  } else if (gedruckt) {
    wid = gedruckt;
  } else {
    const out = await sendeAusGenerator(unitId, skillId, t.id, null, "drucken");
    if ("fehler" in out) weiter(unitId, out);
    wid = out.worksheetId;
  }
  revalidatePath(`/einheiten/${unitId}`);
  redirect(druckLinkZumFotografieren(wid, unitId));
}

/** „Ohne Foto weiter“ bei einer gedruckten Übung. */
export async function papierOhneFotoAction(unitId: number, worksheetId: number) {
  await laufend(unitId);
  weiter(unitId, papierOhneFoto(unitId, worksheetId));
}


/** Ein Heft, das nicht geprüft werden konnte (KI gerade nicht erreichbar): noch einmal prüfen lassen. */
export async function heftNochmalAction(unitId: number, assignmentId: number) {
  await laufend(unitId);
  const h = getHeft(assignmentId);
  if (h && h.unitId === unitId && h.status === "fehler") void pruefeHeft(assignmentId);
  revalidatePath(`/einheiten/${unitId}`);
  redirect(`/einheiten/${unitId}`);
}
