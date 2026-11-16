"use server";

import { revalidatePath } from "next/cache";
import { deviceContext } from "@/lib/device-context";
import { beendeRunde, endlosRekord, endlosStand, glasThemen, laufIst, laufPunkte, punkteBestenliste, punkteRekord, rundenSkill, serie, skillFuerSpiel, spielVorschlaege, starteRunde, type PunkteSpiel } from "@/lib/lernspiele";
import { vergibPunkte } from "@/lib/liga";
import { gueltigePunkte } from "@/lib/blockwerk";
import { gueltigeGlasPunkte } from "@/lib/glasklar";
import { hatEndlos, istSpielArt, type SpielAntwort, type SpielErgebnis, type SpielStart } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

// ---------- Schülerseite: Lernspiele (lib/lernspiele.ts) ----------
// Der geheime Link ist der einzige Schlüssel. Gespielt wird im Browser; gezählt wird nur die erste Wahl je Karte,
// geprüft an den Karten, die der Server beim Start gespeichert hat.

const lernstandVon = (studentId: number, skillId: string) => analyzeStudent(studentId)?.skills.find((s) => s.skill.id === skillId)?.mastery ?? null;

/**
 * `endlos`: „neu“ beginnt ein Endlos-Spiel, eine Zahl holt dessen nächste Runde (lib/lernspiele.ts). `bloecke`: mit
 * „neu“ ein Blockwerk-Spiel (lib/blockwerk.ts), dessen Runden genauso aneinanderhängen.
 */
export async function spielStartenAction(token: string, art: string, endlos?: "neu" | number, bloecke?: boolean): Promise<SpielStart> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  return starten(student, art, endlos, bloecke);
}

/**
 * Glasklar (lib/glasklar.ts): `lauf` fehlt beim Start (dann das Thema `thema` oder das passendste), sonst die nächste
 * Stufe dieses Spiels. Beendet wird wie jede Runde mit `spielBeendenAction` (mit den Punkten am Ende).
 */
export async function glasStartenAction(token: string, thema: string | undefined, lauf?: number): Promise<SpielStart> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  return glasStarten(student, thema, lauf);
}

/** `o.teil`: das Ende eines Endlos- oder Blockwerk-Spiels; es zählen nur die beantworteten Karten. `o.punkte`: die Punkte im Blockwerk. */
export async function spielBeendenAction(token: string, rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean; punkte?: number } = {}): Promise<SpielErgebnis> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const e = beenden(student, rundeId, antworten, o);
  revalidatePath(`/lernen/${token}`, "layout");
  return e;
}

// ---------- am Schüler-Tablet in der Einheit (app/geraet/page.tsx) ----------
// Das Tablet gehört dem Lehrer; es erreicht nur den Schüler der laufenden Einheit, die es zeigt (lib/device-context.ts).
// Der geheime Link des Schülers kommt nie aufs Tablet.

/** Der Schüler, den das Tablet gerade zeigt; null ohne laufende Einheit. */
async function tabletSchueler() {
  const ctx = await deviceContext();
  return ctx?.unit && ctx.student && ctx.unit.status === "gestartet" ? ctx.student : null;
}

export async function tabletSpielStartenAction(art: string, endlos?: "neu" | number, bloecke?: boolean): Promise<SpielStart> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return starten(student, art, endlos, bloecke);
}

export async function tabletGlasStartenAction(thema: string | undefined, lauf?: number): Promise<SpielStart> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return glasStarten(student, thema, lauf);
}

export async function tabletSpielBeendenAction(rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean; punkte?: number } = {}): Promise<SpielErgebnis> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return beenden(student, rundeId, antworten, o);
}

function starten(student: repo.Student, art: string, endlos?: "neu" | number, bloecke?: boolean): SpielStart {
  if (!istSpielArt(art)) return { fehler: "Dieses Spiel gibt es nicht." };
  // Glasklar startet nur über glasStarten (Thema und Stufe)
  if (art === "glas") return glasStarten(student, undefined, typeof endlos === "number" ? endlos : undefined);
  const heute = wienerDatum();
  const lernstand = lernstandVon(student.id, skillFuerSpiel(student, art, heute));
  const grund = spielVorschlaege(student, { heute }).find((v) => v.art === art)?.quelle;
  const lauf = !hatEndlos(art) ? undefined : endlos === "neu" ? "neu" : Number.isInteger(endlos) && Number(endlos) > 0 ? Number(endlos) : undefined;
  const runde = starteRunde(student, art, { grund, lernstand, heute, endlos: lauf, bloecke: bloecke === true && lauf === "neu" });
  if (!runde.karten.length) return { fehler: "Für dieses Spiel gibt es gerade keine Karten." };
  return runde;
}

function glasStarten(student: repo.Student, thema: string | undefined, lauf?: number): SpielStart {
  const heute = wienerDatum();
  const weiter = Number.isInteger(lauf) && Number(lauf) > 0 ? Number(lauf) : undefined;
  const wahl = glasThemen(student, heute);
  const gemeint = wahl.find((t) => t.id === thema) ?? wahl[0];
  if (!weiter && !gemeint) return { fehler: "Für Glasklar gibt es gerade keine Begriffe." };
  const lernstand = gemeint ? lernstandVon(student.id, gemeint.skill) : null;
  const runde = starteRunde(student, "glas", { heute, lernstand, endlos: weiter ?? "neu", glasThema: gemeint?.id });
  if (!runde.karten.length) return { fehler: "Für Glasklar gibt es gerade keine Begriffe." };
  return runde;
}

function beenden(student: repo.Student, rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean; punkte?: number }): SpielErgebnis {
  const zeile = rundenSkill(student.id, Number(rundeId));
  // Blockwerk und Glasklar: die Punkte kommen mit dem Ende des Spiels (und nur dann zählt ein Rekord)
  const spiel: PunkteSpiel | null = zeile?.endlos ? (laufIst(student.id, zeile.endlos, "bloecke") ? "bloecke" : laufIst(student.id, zeile.endlos, "glas") ? "glas" : null) : null;
  const block = spiel === "bloecke";
  if (spiel && zeile?.endlos && o?.punkte !== undefined) laufPunkte(student.id, zeile.endlos, spiel === "glas" ? gueltigeGlasPunkte(o.punkte) : gueltigePunkte(o.punkte), spiel);
  const vorher = zeile ? lernstandVon(student.id, zeile.skillId) : null;
  const e = beendeRunde(student.id, Number(rundeId), Array.isArray(antworten) ? antworten.slice(0, 100) : [], { teil: o?.teil === true });
  if (!e) return { fehler: "Diese Runde gibt es nicht mehr." };
  const nachher = zeile ? lernstandVon(student.id, zeile.skillId) : null;
  // Wochenliga: Punkte für Einsatz und Besserwerden (nur mit Spielprofil, lib/liga.ts)
  const liga = vergibPunkte(student, Number(rundeId));
  revalidatePath(`/schueler/${student.id}`, "layout");
  return {
    richtig: e.richtig,
    karten: e.anzahl,
    sterne: e.sterne,
    serie: serie(student.id, wienerDatum()),
    lernstandVorher: vorher,
    lernstandNachher: nachher,
    nochmal: e.nochmal.map((k) => ({ loesung: k.loesung })),
    liga: liga.punkte > 0 || liga.grund ? { punkte: liga.punkte, grund: liga.grund } : undefined,
    endlos: zeile?.endlos && !spiel ? { stand: endlosStand(student.id, zeile.endlos), rekord: endlosRekord(student.id, zeile.art, zeile.endlos) } : undefined,
    bloecke: zeile?.endlos && block ? { rekord: punkteRekord(student.id, "bloecke", zeile.endlos), fragen: endlosStand(student.id, zeile.endlos), bestenliste: o?.punkte !== undefined ? punkteBestenliste(student, "bloecke") : undefined } : undefined,
    glas: zeile?.endlos && spiel === "glas" ? { rekord: punkteRekord(student.id, "glas", zeile.endlos), begriffe: endlosStand(student.id, zeile.endlos), bestenliste: o?.punkte !== undefined ? punkteBestenliste(student, "glas") : undefined } : undefined,
  };
}
