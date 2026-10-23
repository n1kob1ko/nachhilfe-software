"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { cleanBewertung, cleanErwartung, erwartungLeer } from "@/lib/bewertung-kriterien";
import { pushLive } from "@/lib/live";
import { auftragFor } from "@/lib/schreibauftrag-store";
import {
  bestaetigeBewertung,
  erwartungVorschlagen,
  kriterienDesTexts,
  nimmBewertungZurueck,
  pruefungInfo,
  retryAufgabenPruefung,
  setzeFreigabe,
  speichereAngabe,
  speichereErwartung,
  startAufgabenPruefung,
  verwirfBewertungVorschlag,
  verwirfErwartungVorschlag,
} from "@/lib/schreibauftrag-bewertung";
import { correctionsOfText, maskedNames } from "@/lib/text-correction";
import { textChannel } from "@/lib/text-routes";
import { getText } from "@/lib/texts";
import { runningUnitForStudent } from "@/lib/units";
import { publish } from "@/lib/whiteboard-hub";

export type BewertungState = { ok: boolean; meldung: string } | null;

const verworfenText = (n: number) => (n ? ` ${n === 1 ? "Eine Stelle" : `${n} Stellen`} mit Zitat oder Zeilenangabe ${n === 1 ? "stand" : "standen"} nicht im Text und ${n === 1 ? "wurde" : "wurden"} weggelassen.` : "");

// Erwartungshorizont und Bewertung stehen in „Aufgabe erfüllt?“ der Korrekturseite (/texte/<id>/bewertung leitet dorthin)
function neuLaden(textId: number) {
  revalidatePath(`/texte/${textId}/korrektur`);
  revalidatePath(`/texte/${textId}`);
}

/** Der Schüler sieht eine Freigabe (oder ihr Ende) gleich auf seinem Gerät. */
function schuelerGeraet(textId: number) {
  publish(textChannel(textId), { type: "info" });
  const text = getText(textId);
  const unit = text ? runningUnitForStudent(text.student_id) : null;
  if (unit) pushLive(unit.id);
}

/** Speichert den Erwartungshorizont der Lehrkraft (damit ist er geprüft) und die Freigabe für den Schüler. */
export async function speichereErwartungAction(textId: number, _prev: BewertungState, f: FormData): Promise<BewertungState> {
  const t = await requireTeacher();
  if (!auftragFor(textId)) return { ok: false, meldung: "Diesen Schreibauftrag gibt es nicht." };
  const e = cleanErwartung({ inhalt: f.get("e_inhalt"), textstruktur: f.get("e_textstruktur"), stil: f.get("e_stil"), sprachrichtigkeit: f.get("e_sprachrichtigkeit") });
  speichereErwartung(textId, e, t.id);
  const frei = f.get("frei") === "1" && !erwartungLeer(e);
  setzeFreigabe(textId, frei);
  schuelerGeraet(textId);
  neuLaden(textId);
  return { ok: true, meldung: erwartungLeer(e) ? "Gelöscht." : frei ? "Gespeichert und freigegeben." : "Gespeichert." };
}

export async function erwartungVorschlagenAction(textId: number, _prev: BewertungState): Promise<BewertungState> {
  const t = await requireTeacher();
  const out = await erwartungVorschlagen(textId, t.id);
  neuLaden(textId);
  return out.ok ? { ok: true, meldung: `Vorschlag ist da. Prüf ihn und speichere ihn.${verworfenText(out.verworfen)}` } : { ok: false, meldung: out.error };
}

export async function verwirfErwartungVorschlagAction(textId: number) {
  await requireTeacher();
  verwirfErwartungVorschlag(textId);
  neuLaden(textId);
}

/** Die Namen, die die Lehrkraft in der Freigabe der Korrektur dieser Fassung verbergen ließ; null: alle, die die App findet. */
function namenDerKorrektur(textId: number): string[] | undefined {
  const text = getText(textId);
  const c = text ? correctionsOfText(textId).find((x) => x.version === text.version) : null;
  return maskedNames(c?.masked_names) ?? undefined;
}

/**
 * „Aufgabe prüfen“ allein, mit dem Haken der Lehrkraft (wenn die Sprache schon korrigiert ist oder die Aufgabe neu geprüft
 * werden soll). Beim Schreibauftrag füllt dieselbe Prüfung die Stufen der Bewertung vor. Läuft im Hintergrund.
 */
export async function aufgabePruefenAction(textId: number, _prev: BewertungState, f: FormData): Promise<BewertungState> {
  const t = await requireTeacher();
  const out = await startAufgabenPruefung(textId, t.id, { consent: f.get("zustimmung") === "1", names: namenDerKorrektur(textId), neu: true });
  neuLaden(textId);
  return out.ok ? { ok: true, meldung: out.reused ? "Die Prüfung läuft schon." : "Die Prüfung läuft. Das Ergebnis erscheint hier." } : { ok: false, meldung: out.error };
}

/** „Erneut versuchen“ nach einer fehlgeschlagenen Prüfung, nur auf Klick, mit der Zustimmung von vorhin. */
export async function aufgabeErneutAction(textId: number): Promise<{ error?: string } | null> {
  const t = await requireTeacher();
  const out = await retryAufgabenPruefung(textId, t.id);
  neuLaden(textId);
  return out.ok ? null : { error: out.error };
}

/** Angabe / Textvorlage einer Textarbeit (nur für die Lehrkraft und „Aufgabe erfüllt?“). */
export async function speichereAngabeAction(textId: number, _prev: BewertungState, f: FormData): Promise<BewertungState> {
  const t = await requireTeacher();
  if (!getText(textId) || auftragFor(textId)) return { ok: false, meldung: "Für diesen Text gibt es hier keine Angabe." };
  speichereAngabe(textId, String(f.get("angabe") ?? ""), t.id);
  neuLaden(textId);
  return { ok: true, meldung: "Angabe gespeichert." };
}

/**
 * „Bewertung übernehmen“: die Lehrkraft bestätigt Stufen, Note und das Urteil je Auftrag (vorher geändert oder nicht). Nur das
 * gilt als Bewertung; ab jetzt steht sie in der Dokumentation und zählt für den Lernstand.
 */
export async function bestaetigeBewertungAction(textId: number, _prev: BewertungState, f: FormData): Promise<BewertungState> {
  const t = await requireTeacher();
  const text = getText(textId);
  if (!text) return { ok: false, meldung: "Diesen Text gibt es nicht." };
  const out = cleanBewertung((n) => f.get(n), { auftraege: pruefungInfo(textId).auftraege ?? [], namen: kriterienDesTexts(text) });
  if ("error" in out) return { ok: false, meldung: out.error };
  if (!bestaetigeBewertung(textId, out.bewertung, t.id)) return { ok: false, meldung: "Diesen Text gibt es nicht." };
  neuLaden(textId);
  revalidatePath(`/schueler/${text.student_id}`);
  revalidatePath("/einheiten/[id]", "page");
  return { ok: true, meldung: "Bewertung übernommen." };
}

/** „Bewertung zurücknehmen“: sie steht nicht mehr in der Dokumentation und zählt nicht mehr für den Lernstand. */
export async function nimmBewertungZurueckAction(textId: number) {
  await requireTeacher();
  nimmBewertungZurueck(textId);
  neuLaden(textId);
  const text = getText(textId);
  if (text) revalidatePath(`/schueler/${text.student_id}`);
  revalidatePath("/einheiten/[id]", "page");
}

export async function verwirfBewertungVorschlagAction(textId: number) {
  await requireTeacher();
  verwirfBewertungVorschlag(textId);
  neuLaden(textId);
}
