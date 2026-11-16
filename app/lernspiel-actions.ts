"use server";

import { revalidatePath } from "next/cache";
import { deviceContext } from "@/lib/device-context";
import { beendeRunde, bloeckePunkte, bloeckeRekord, endlosRekord, istBlockwerk, endlosStand, rundenSkill, serie, skillFuerSpiel, spielVorschlaege, starteRunde } from "@/lib/lernspiele";
import { vergibPunkte } from "@/lib/liga";
import { gueltigePunkte } from "@/lib/blockwerk";
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

export async function tabletSpielBeendenAction(rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean; punkte?: number } = {}): Promise<SpielErgebnis> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return beenden(student, rundeId, antworten, o);
}

function starten(student: repo.Student, art: string, endlos?: "neu" | number, bloecke?: boolean): SpielStart {
  if (!istSpielArt(art)) return { fehler: "Dieses Spiel gibt es nicht." };
  const heute = wienerDatum();
  const lernstand = lernstandVon(student.id, skillFuerSpiel(student, art, heute));
  const grund = spielVorschlaege(student, { heute }).find((v) => v.art === art)?.quelle;
  const lauf = !hatEndlos(art) ? undefined : endlos === "neu" ? "neu" : Number.isInteger(endlos) && Number(endlos) > 0 ? Number(endlos) : undefined;
  const runde = starteRunde(student, art, { grund, lernstand, heute, endlos: lauf, bloecke: bloecke === true && lauf === "neu" });
  if (!runde.karten.length) return { fehler: "Für dieses Spiel gibt es gerade keine Karten." };
  return runde;
}

function beenden(student: repo.Student, rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean; punkte?: number }): SpielErgebnis {
  const zeile = rundenSkill(student.id, Number(rundeId));
  const block = zeile?.endlos ? istBlockwerk(student.id, zeile.endlos) : false;
  // Blockwerk: die Punkte kommen mit dem Ende des Spiels (und nur dann zählt ein Rekord)
  if (block && zeile?.endlos && o?.punkte !== undefined) bloeckePunkte(student.id, zeile.endlos, gueltigePunkte(o.punkte));
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
    endlos: zeile?.endlos && !block ? { stand: endlosStand(student.id, zeile.endlos), rekord: endlosRekord(student.id, zeile.art, zeile.endlos) } : undefined,
    bloecke: zeile?.endlos && block ? { rekord: bloeckeRekord(student.id, zeile.endlos), fragen: endlosStand(student.id, zeile.endlos) } : undefined,
  };
}
