"use server";

import { revalidatePath } from "next/cache";
import * as duelle from "@/lib/duelle";
import { vergibPunkte } from "@/lib/liga";
import type { SpielErgebnis, SpielStart } from "@/lib/lernspiele-typen";
import { serie } from "@/lib/lernspiele";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { loescheProfil, setzeWettspiel, speichereProfil, type ProfilEingabe, type Wettspiel } from "@/lib/spielprofil";
import { requireTeacher } from "@/lib/auth";

// ---------- Schülerseite: Spielprofil, Wochenliga, Duelle (lib/spielprofil.ts, lib/liga.ts, lib/duelle.ts) ----------
// Der geheime Link ist der einzige Schlüssel, wie bei den Lernspielen.

const KEIN_LINK = "Dieser Link gilt nicht mehr.";
const schueler = (token: string) => repo.getStudentByToken(String(token));

export async function spielprofilSpeichernAction(token: string, e: ProfilEingabe): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const s = schueler(token);
  if (!s) return { ok: false, fehler: KEIN_LINK };
  const r = speichereProfil(s, { vorne: String(e?.vorne ?? ""), hinten: String(e?.hinten ?? ""), bild: String(e?.bild ?? ""), liga: !!e?.liga, duelle: !!e?.duelle });
  if (!r.ok) return r;
  revalidatePath(`/lernen/${token}`, "layout");
  return { ok: true };
}

export async function duellErstellenAction(token: string, art: string) {
  const s = schueler(token);
  if (!s) return { ok: false as const, fehler: KEIN_LINK };
  const r = duelle.erstelleDuell(s, art);
  if (r.ok) revalidatePath(`/lernen/${token}/arena`);
  return r;
}

export async function duellAnnehmenAction(token: string, code: string) {
  const s = schueler(token);
  if (!s) return { ok: false as const, fehler: KEIN_LINK };
  return duelle.nimmAn(s, String(code ?? ""));
}

export async function revancheAction(token: string, duellId: number) {
  const s = schueler(token);
  if (!s) return { ok: false as const, fehler: KEIN_LINK };
  return duelle.revanche(s, Number(duellId));
}

export async function duellSichtAction(token: string, duellId: number): Promise<duelle.DuellSicht | null> {
  const s = schueler(token);
  if (!s) return null;
  const vorname = (id: number | null) => (id ? (repo.getStudent(id)?.name.split(" ")[0] ?? "") : "");
  // live sitzen beide beim Lehrer: ohne Spitzname steht der Vorname da; per Code nie
  const roh = duelle.duellSicht(s.id, Number(duellId));
  if (!roh?.live) return roh;
  return duelle.duellSicht(s.id, Number(duellId), liveNamen(Number(duellId), vorname));
}

function liveNamen(duellId: number, vorname: (id: number | null) => string) {
  const z = duelle.duellTeilnehmer(duellId);
  return z ? { von: vorname(z.von), gegen: vorname(z.gegen) } : undefined;
}

export async function duellBereitAction(token: string, duellId: number) {
  const s = schueler(token);
  if (!s) return;
  duelle.bereit(s.id, Number(duellId));
}

export async function liveDuellAction(token: string): Promise<number | null> {
  const s = schueler(token);
  return s ? duelle.wartendesLiveDuell(s.id) : null;
}

export async function duellRundeAction(token: string, duellId: number): Promise<SpielStart> {
  const s = schueler(token);
  if (!s) return { fehler: KEIN_LINK };
  const r = duelle.duellRunde(s, Number(duellId));
  if (!r.ok) return { fehler: r.fehler };
  // schon gewählte Karten (nach Neuladen) kommen nicht noch einmal
  const gewaehlt = new Set(r.schonGewaehlt.map((z) => z.key));
  const offen = r.karten.filter((k) => !gewaehlt.has(k.key));
  return { rundeId: r.rundeId, karten: offen.length ? offen : r.karten };
}

export async function duellZugAction(token: string, duellId: number, key: string, wahl: string) {
  const s = schueler(token);
  if (!s) return null;
  return duelle.duellZug(s.id, Number(duellId), String(key), String(wahl));
}

export async function duellBeendenAction(token: string, duellId: number, antworten: { key: string; wahl: string }[]): Promise<SpielErgebnis> {
  const s = schueler(token);
  if (!s) return { fehler: KEIN_LINK };
  const e = duelle.beendeDuellRunde(s, Number(duellId), Array.isArray(antworten) ? antworten : []);
  if (!e) return { fehler: "Dieses Duell gibt es nicht mehr." };
  const liga = vergibPunkte(s, e.rundeId);
  revalidatePath(`/lernen/${token}`, "layout");
  revalidatePath(`/schueler/${s.id}`, "layout");
  return {
    richtig: e.richtig,
    karten: e.anzahl,
    sterne: e.sterne,
    serie: serie(s.id, wienerDatum()),
    lernstandVorher: null,
    lernstandNachher: null,
    nochmal: e.nochmal.map((k) => ({ loesung: k.loesung })),
    liga: liga.punkte > 0 || liga.grund ? { punkte: liga.punkte, grund: liga.grund } : undefined,
  };
}

// ---------- Lehrerseite ----------

/** Im Profil: ob der Schüler bei Liga und Duellen mitmachen darf (Standard ab 9. Schulstufe, „Erlaubt“, „Aus“). */
export async function wettspielSetzenAction(studentId: number, wert: string) {
  await requireTeacher();
  const w: Wettspiel = wert === "ja" || wert === "nein" ? wert : "";
  setzeWettspiel(Number(studentId), w);
  revalidatePath(`/schueler/${studentId}`, "layout");
}

export async function spielprofilLoeschenAction(studentId: number) {
  await requireTeacher();
  loescheProfil(Number(studentId));
  revalidatePath(`/schueler/${studentId}`, "layout");
}

/** Zwei Schüler sitzen gleichzeitig beim Lehrer: Live-Duell starten (2 Minuten, dieselben Karten). */
export async function liveDuellStartenAction(aId: number, bId: number, art: string) {
  const t = await requireTeacher();
  return duelle.starteLiveDuell(t.id, Number(aId), Number(bId), String(art));
}

export async function liveDuellStandAction(aId: number, bId: number) {
  const t = await requireTeacher();
  return duelle.liveDuellFuerLehrer(t.id, Number(aId), Number(bId));
}

export async function liveDuellAbbrechenAction(duellId: number) {
  const t = await requireTeacher();
  duelle.brichAb(t.id, Number(duellId));
}
