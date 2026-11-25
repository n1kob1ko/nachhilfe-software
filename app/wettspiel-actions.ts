"use server";

import { revalidatePath } from "next/cache";
import * as duelle from "@/lib/duelle";
import { vergibPunkte } from "@/lib/liga";
import type { SpielErgebnis, SpielStart } from "@/lib/lernspiele-typen";
import { serie } from "@/lib/lernspiele";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { darfMitspielen, loescheProfil, setzeWettspiel, wettspielEinstellung, speichereProfil, type ProfilEingabe, type Wettspiel } from "@/lib/spielprofil";
import { requireTeacher } from "@/lib/auth";
import { deviceContext } from "@/lib/device-context";
import { activeLaptop } from "@/lib/laptop";
import { showOnTablet } from "@/lib/live";
import { runningUnitForStudent, runningUnits } from "@/lib/units";

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
  return s ? sichtFuer(s, Number(duellId)) : null;
}

function sichtFuer(s: repo.Student, duellId: number): duelle.DuellSicht | null {
  const vorname = (id: number | null) => (id ? (repo.getStudent(id)?.name.split(" ")[0] ?? "") : "");
  // live sitzen beide beim Lehrer: ohne Spitzname steht der Vorname da; per Code nie
  const roh = duelle.duellSicht(s.id, duellId);
  if (!roh?.live) return roh;
  return duelle.duellSicht(s.id, duellId, liveNamen(duellId, vorname));
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
  return s ? rundeFuer(s, Number(duellId)) : { fehler: KEIN_LINK };
}

function rundeFuer(s: repo.Student, duellId: number): SpielStart {
  const r = duelle.duellRunde(s, duellId);
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
  const e = beendenFuer(s, Number(duellId), antworten);
  revalidatePath(`/lernen/${token}`, "layout");
  return e;
}

function beendenFuer(s: repo.Student, duellId: number, antworten: { key: string; wahl: string }[]): SpielErgebnis {
  const e = duelle.beendeDuellRunde(s, duellId, Array.isArray(antworten) ? antworten : []);
  if (!e) return { fehler: "Dieses Duell gibt es nicht mehr." };
  const liga = vergibPunkte(s, e.rundeId);
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

// ---------- Schüler-Tablet in der Einheit (niko 2026-11-25: zwei Schüler gleichzeitig, beide am Tablet, ohne Handy) ----------
// Wer spielt, sagt das Gerät (lib/device-context.ts): der Schüler der Einheit, die dieses Tablet gerade zeigt.

const KEINE_EINHEIT = "Die Einheit läuft nicht mehr.";

async function amTablet() {
  const ctx = await deviceContext();
  if (!ctx?.unit || !ctx.student || ctx.unit.status !== "gestartet") return null;
  return { unit: ctx.unit, student: ctx.student, lehrerId: ctx.device.teacher_id };
}

/** Der zweite Schüler, der gerade gleichzeitig bei diesem Lehrer sitzt (D26), oder keiner. */
function gegenueberAmTablet(lehrerId: number, studentId: number) {
  const andere = runningUnits(lehrerId).filter((u) => u.student_id !== studentId);
  return andere.length === 1 ? andere[0] : null;
}

export async function tabletDuellSichtAction(duellId: number): Promise<duelle.DuellSicht | null> {
  const t = await amTablet();
  return t ? sichtFuer(t.student, Number(duellId)) : null;
}

export async function tabletDuellBereitAction(duellId: number) {
  const t = await amTablet();
  if (t) duelle.bereit(t.student.id, Number(duellId));
}

export async function tabletDuellRundeAction(duellId: number): Promise<SpielStart> {
  const t = await amTablet();
  return t ? rundeFuer(t.student, Number(duellId)) : { fehler: KEINE_EINHEIT };
}

export async function tabletDuellZugAction(duellId: number, key: string, wahl: string) {
  const t = await amTablet();
  return t ? duelle.duellZug(t.student.id, Number(duellId), String(key), String(wahl)) : null;
}

export async function tabletDuellBeendenAction(duellId: number, antworten: { key: string; wahl: string }[]): Promise<SpielErgebnis> {
  const t = await amTablet();
  return t ? beendenFuer(t.student, Number(duellId), antworten) : { fehler: KEINE_EINHEIT };
}

/** Wartet ein Live-Duell auf den Schüler dieses Tablets? (der Ruf oben am Tablet fragt alle 3 Sekunden) */
export async function tabletLiveDuellAction(): Promise<number | null> {
  const t = await amTablet();
  return t ? duelle.wartendesLiveDuell(t.student.id) : null;
}

/**
 * Am Tablet: der Schüler fordert den anderen heraus, der gerade gleichzeitig da ist. Wer startet, ist gleich „bereit“
 * und sein Tablet zeigt das Duell; beim anderen erscheint oben „Live-Duell · Mitmachen“.
 */
export async function tabletLiveDuellStartenAction(art: string): Promise<{ ok: true; id: number } | { ok: false; fehler: string }> {
  const t = await amTablet();
  if (!t) return { ok: false, fehler: KEINE_EINHEIT };
  const anderer = gegenueberAmTablet(t.lehrerId, t.student.id);
  if (!anderer) return { ok: false, fehler: "Gerade ist kein zweiter Schüler in der Stunde." };
  if (!darfMitspielen(wettspielEinstellung(t.student.id)) || !darfMitspielen(wettspielEinstellung(anderer.student_id))) return { ok: false, fehler: "Duelle sind gerade ausgeschaltet. Frag deinen Lehrer." };
  const r = duelle.starteLiveDuell(t.lehrerId, t.student.id, anderer.student_id, String(art));
  if (!r.ok) return r;
  duelle.bereit(t.student.id, r.id);
  showOnTablet(t.unit, { kind: "duell", id: r.id });
  return r;
}

// ---------- Lehrerseite ----------

/** Im Profil: ob der Schüler bei Liga und Duellen mitmachen darf („An“ für alle, „Aus“ sperrt es). */
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
  const r = duelle.starteLiveDuell(t.id, Number(aId), Number(bId), String(art));
  // beide Tablets springen gleich zum Duell („Bereit!“), außer ein Schüler arbeitet gerade am eigenen Laptop
  if (r.ok) {
    for (const sid of [Number(aId), Number(bId)]) {
      const unit = runningUnitForStudent(sid);
      if (unit && unit.teacher_id === t.id && !activeLaptop(unit.id)) showOnTablet(unit, { kind: "duell", id: r.id });
    }
  }
  return r;
}

export async function liveDuellStandAction(aId: number, bId: number) {
  const t = await requireTeacher();
  return duelle.liveDuellFuerLehrer(t.id, Number(aId), Number(bId));
}

export async function liveDuellAbbrechenAction(duellId: number) {
  const t = await requireTeacher();
  duelle.brichAb(t.id, Number(duellId));
}
