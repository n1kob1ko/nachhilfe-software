"use server";

import { revalidatePath } from "next/cache";
import { beendeRunde, rundenSkill, serie, SPIEL_SKILL, spielVorschlaege, starteRunde } from "@/lib/lernspiele";
import { vergibPunkte } from "@/lib/liga";
import { istSpielArt, type SpielAntwort, type SpielErgebnis, type SpielStart } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

// ---------- Schülerseite: Lernspiele (lib/lernspiele.ts) ----------
// Der geheime Link ist der einzige Schlüssel. Gespielt wird im Browser; gezählt wird nur die erste Wahl je Karte,
// geprüft an den Karten, die der Server beim Start gespeichert hat.

const lernstandVon = (studentId: number, skillId: string) => analyzeStudent(studentId)?.skills.find((s) => s.skill.id === skillId)?.mastery ?? null;

export async function spielStartenAction(token: string, art: string): Promise<SpielStart> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  if (!istSpielArt(art)) return { fehler: "Dieses Spiel gibt es nicht." };
  const lernstand = lernstandVon(student.id, SPIEL_SKILL[art]);
  const grund = spielVorschlaege(student, { heute: wienerDatum() }).find((v) => v.art === art)?.quelle;
  const runde = starteRunde(student, art, { grund, lernstand });
  if (!runde.karten.length) return { fehler: "Für dieses Spiel gibt es gerade keine Karten." };
  return runde;
}

export async function spielBeendenAction(token: string, rundeId: number, antworten: SpielAntwort[]): Promise<SpielErgebnis> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const zeile = rundenSkill(student.id, Number(rundeId));
  const vorher = zeile ? lernstandVon(student.id, zeile) : null;
  const e = beendeRunde(student.id, Number(rundeId), Array.isArray(antworten) ? antworten.slice(0, 100) : []);
  if (!e) return { fehler: "Diese Runde gibt es nicht mehr." };
  const nachher = zeile ? lernstandVon(student.id, zeile) : null;
  // Wochenliga: Punkte für Einsatz und Besserwerden (nur mit Spielprofil, lib/liga.ts)
  const liga = vergibPunkte(student, Number(rundeId));
  revalidatePath(`/lernen/${token}`, "layout");
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
  };
}
