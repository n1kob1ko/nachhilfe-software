"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { cleanBewertung, cleanErwartung, erwartungLeer } from "@/lib/bewertung-kriterien";
import { pushLive } from "@/lib/live";
import { auftragFor } from "@/lib/schreibauftrag-store";
import {
  bestaetigeBewertung,
  bewertungVorschlagen,
  erwartungVorschlagen,
  setzeFreigabe,
  speichereErwartung,
  verwirfBewertungVorschlag,
  verwirfErwartungVorschlag,
} from "@/lib/schreibauftrag-bewertung";
import { textChannel } from "@/lib/text-routes";
import { getText } from "@/lib/texts";
import { runningUnitForStudent } from "@/lib/units";
import { publish } from "@/lib/whiteboard-hub";

export type BewertungState = { ok: boolean; meldung: string } | null;

const verworfenText = (n: number) => (n ? ` ${n === 1 ? "Eine Stelle" : `${n} Stellen`} mit Zitat oder Zeilenangabe ${n === 1 ? "stand" : "standen"} nicht im Text und ${n === 1 ? "wurde" : "wurden"} weggelassen.` : "");

function neuLaden(textId: number) {
  revalidatePath(`/texte/${textId}/bewertung`);
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

export async function bewertungVorschlagenAction(textId: number, _prev: BewertungState, f: FormData): Promise<BewertungState> {
  const t = await requireTeacher();
  const out = await bewertungVorschlagen(textId, t.id, { zustimmung: f.get("zustimmung") === "1" });
  neuLaden(textId);
  return out.ok ? { ok: true, meldung: `Vorschlag ist da. Prüf jede Stufe und bestätige die Bewertung.${verworfenText(out.verworfen)}` } : { ok: false, meldung: out.error };
}

/** Die Lehrkraft bestätigt Stufen und Begründungen: nur das gilt als Bewertung. */
export async function bestaetigeBewertungAction(textId: number, _prev: BewertungState, f: FormData): Promise<BewertungState> {
  const t = await requireTeacher();
  const out = cleanBewertung((n) => f.get(n));
  if ("error" in out) return { ok: false, meldung: out.error };
  if (!bestaetigeBewertung(textId, out.bewertung, t.id)) return { ok: false, meldung: "Diesen Schreibauftrag gibt es nicht." };
  neuLaden(textId);
  return { ok: true, meldung: "Bewertung bestätigt." };
}

export async function verwirfBewertungVorschlagAction(textId: number) {
  await requireTeacher();
  verwirfBewertungVorschlag(textId);
  neuLaden(textId);
}
