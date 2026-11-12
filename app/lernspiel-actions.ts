"use server";

import { revalidatePath } from "next/cache";
import { beendeRunde, endlosRekord, endlosStand, rundenSkill, serie, skillFuerSpiel, spielVorschlaege, starteRunde } from "@/lib/lernspiele";
import { vergibPunkte } from "@/lib/liga";
import { hatEndlos, istSpielArt, type SpielAntwort, type SpielErgebnis, type SpielStart } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

// ---------- Schülerseite: Lernspiele (lib/lernspiele.ts) ----------
// Der geheime Link ist der einzige Schlüssel. Gespielt wird im Browser; gezählt wird nur die erste Wahl je Karte,
// geprüft an den Karten, die der Server beim Start gespeichert hat.

const lernstandVon = (studentId: number, skillId: string) => analyzeStudent(studentId)?.skills.find((s) => s.skill.id === skillId)?.mastery ?? null;

/** `endlos`: „neu“ beginnt ein Endlos-Spiel, eine Zahl holt dessen nächste Runde (lib/lernspiele.ts). */
export async function spielStartenAction(token: string, art: string, endlos?: "neu" | number): Promise<SpielStart> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  if (!istSpielArt(art)) return { fehler: "Dieses Spiel gibt es nicht." };
  const heute = wienerDatum();
  const lernstand = lernstandVon(student.id, skillFuerSpiel(student, art, heute));
  const grund = spielVorschlaege(student, { heute }).find((v) => v.art === art)?.quelle;
  const lauf = !hatEndlos(art) ? undefined : endlos === "neu" ? "neu" : Number.isInteger(endlos) && Number(endlos) > 0 ? Number(endlos) : undefined;
  const runde = starteRunde(student, art, { grund, lernstand, heute, endlos: lauf });
  if (!runde.karten.length) return { fehler: "Für dieses Spiel gibt es gerade keine Karten." };
  return runde;
}

/** `o.teil`: das Ende eines Endlos-Spiels; es zählen nur die beantworteten Karten. */
export async function spielBeendenAction(token: string, rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean } = {}): Promise<SpielErgebnis> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const zeile = rundenSkill(student.id, Number(rundeId));
  const vorher = zeile ? lernstandVon(student.id, zeile.skillId) : null;
  const e = beendeRunde(student.id, Number(rundeId), Array.isArray(antworten) ? antworten.slice(0, 100) : [], { teil: o?.teil === true });
  if (!e) return { fehler: "Diese Runde gibt es nicht mehr." };
  const nachher = zeile ? lernstandVon(student.id, zeile.skillId) : null;
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
    endlos: zeile?.endlos ? { stand: endlosStand(student.id, zeile.endlos), rekord: endlosRekord(student.id, zeile.art, zeile.endlos) } : undefined,
  };
}
