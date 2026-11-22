"use server";

import { revalidatePath } from "next/cache";
import { deviceContext } from "@/lib/device-context";
import { beendeRunde, blaetterWahl, endlosRekord, endlosStand, glasThemen, phantomWahl, sichereBlaetter, wortThemen, laufIst, laufPunkte, PUNKTE_SPIELE, punkteBestenliste, punkteRekord, rundenSkill, serie, skillFuerSpiel, spielVorschlaege, starteRunde, type PunkteSpiel } from "@/lib/lernspiele";
import { vergibPunkte } from "@/lib/liga";
import { gueltigePunkte } from "@/lib/blockwerk";
import { merkeStand, offenesBlockwerk, vergissStand, type BlockwerkStand } from "@/lib/blockwerk-stand";
import { gueltigeGlasPunkte } from "@/lib/glasklar";
import { gueltigeFunkelPunkte } from "@/lib/funkelfeld";
import { gueltigeTorPunkte } from "@/lib/torlauf";
import { gueltigeWortPunkte } from "@/lib/wortschloss";
import { gueltigePhantomPunkte } from "@/lib/phantombild";
import { hatEndlos, istSpielArt, type SpielAntwort, type SpielErgebnis, type SpielKarte, type SpielStart } from "@/lib/lernspiele-typen";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

// ---------- Schülerseite: Lernspiele (lib/lernspiele.ts) ----------
// Der geheime Link ist der einzige Schlüssel. Gespielt wird im Browser; gezählt wird nur die erste Wahl je Karte,
// geprüft an den Karten, die der Server beim Start gespeichert hat.

const lernstandVon = (studentId: number, skillId: string) => analyzeStudent(studentId)?.skills.find((s) => s.skill.id === skillId)?.mastery ?? null;

/**
 * `endlos`: „neu“ beginnt ein Endlos-Spiel, eine Zahl holt dessen nächste Runde (lib/lernspiele.ts). `bloecke`: mit
 * „neu“ ein Blockwerk-Spiel (lib/blockwerk.ts, `true` oder „bloecke“) oder Funkelfeld (lib/funkelfeld.ts, „funkel“),
 * dessen Runden genauso aneinanderhängen.
 */
export async function spielStartenAction(token: string, art: string, endlos?: "neu" | number, bloecke?: Brett): Promise<SpielStart> {
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

/** Wortschloss (lib/wortschloss.ts): wie Glasklar, `lauf` fehlt beim Start, sonst die nächste Stufe dieses Spiels. */
export async function wortStartenAction(token: string, thema: string | undefined, lauf?: number): Promise<SpielStart> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  return wortStarten(student, thema, lauf);
}

/**
 * Phantombild (lib/phantombild.ts): `teil` „fall“ (Zeugenaussage lesen, Gesicht bauen) oder „text“ (die Vorlage
 * lernen, lib/phantom-vorlage.ts). `lauf` fehlt beim Start, sonst die nächste Stufe; `stufe`: bei „text“ die gewünschte.
 */
export async function phantomStartenAction(token: string, teil: "fall" | "text", lauf?: number, stufe?: number): Promise<SpielStart> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  return phantomStarten(student, teil, lauf, stufe);
}

/** Blätter bestimmen (lib/blaetter.ts): `modus` Kacheln oder schreiben wie im Test, `alle`: alle 26 Blätter. */
export async function blattStartenAction(token: string, modus: "kacheln" | "schreiben", alle?: boolean): Promise<SpielStart> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  return blattStarten(student, modus, alle);
}

/** `o.teil`: das Ende eines Endlos- oder Blockwerk-Spiels; es zählen nur die beantworteten Karten. `o.punkte`: die Punkte im Blockwerk. */
export async function spielBeendenAction(token: string, rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean; punkte?: number } = {}): Promise<SpielErgebnis> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const e = beenden(student, rundeId, antworten, o);
  revalidatePath(`/lernen/${token}`, "layout");
  return e;
}

/**
 * Blockwerk: den Stand nach einem Zug merken (lib/blockwerk-stand.ts), damit man später weiterspielen kann. Still: ein
 * Fehler hier stört das Spiel nicht.
 */
export async function blockwerkMerkenAction(token: string, stand: BlockwerkStand): Promise<boolean> {
  const student = repo.getStudentByToken(token);
  if (!student) return false;
  return merkeStand(student.id, stand);
}

/** Blockwerk: das angefangene Spiel holen, mit den Karten seiner laufenden Runde. */
export async function blockwerkWeiterAction(token: string): Promise<{ lauf: number; art: string; karten: SpielKarte[]; stand: BlockwerkStand } | { fehler: string }> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const offen = offenesBlockwerk(student.id);
  if (!offen) return { fehler: "Das angefangene Spiel gibt es nicht mehr." };
  return { lauf: offen.lauf, art: offen.art, karten: offen.karten, stand: offen.stand };
}

// ---------- am Schüler-Tablet in der Einheit (app/geraet/page.tsx) ----------
// Das Tablet gehört dem Lehrer; es erreicht nur den Schüler der laufenden Einheit, die es zeigt (lib/device-context.ts).
// Der geheime Link des Schülers kommt nie aufs Tablet.

/** Der Schüler, den das Tablet gerade zeigt; null ohne laufende Einheit. */
async function tabletSchueler() {
  const ctx = await deviceContext();
  return ctx?.unit && ctx.student && ctx.unit.status === "gestartet" ? ctx.student : null;
}

export async function tabletSpielStartenAction(art: string, endlos?: "neu" | number, bloecke?: Brett): Promise<SpielStart> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return starten(student, art, endlos, bloecke);
}

export async function tabletGlasStartenAction(thema: string | undefined, lauf?: number): Promise<SpielStart> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return glasStarten(student, thema, lauf);
}

export async function tabletWortStartenAction(thema: string | undefined, lauf?: number): Promise<SpielStart> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return wortStarten(student, thema, lauf);
}

export async function tabletPhantomStartenAction(teil: "fall" | "text", lauf?: number, stufe?: number): Promise<SpielStart> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return phantomStarten(student, teil, lauf, stufe);
}

export async function tabletBlattStartenAction(modus: "kacheln" | "schreiben", alle?: boolean): Promise<SpielStart> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return blattStarten(student, modus, alle);
}

export async function tabletSpielBeendenAction(rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean; punkte?: number } = {}): Promise<SpielErgebnis> {
  const student = await tabletSchueler();
  if (!student) return { fehler: "Die Einheit läuft nicht mehr." };
  return beenden(student, rundeId, antworten, o);
}

/** Ein Spielbrett zwischen den Karten (`true` heißt Blockwerk, wie früher). */
type Brett = boolean | "bloecke" | "funkel" | "tor";

function starten(student: repo.Student, art: string, endlos?: "neu" | number, bloecke?: Brett): SpielStart {
  if (!istSpielArt(art)) return { fehler: "Dieses Spiel gibt es nicht." };
  // Glasklar startet nur über glasStarten (Thema und Stufe)
  if (art === "glas") return glasStarten(student, undefined, typeof endlos === "number" ? endlos : undefined);
  if (art === "wort") return wortStarten(student, undefined, typeof endlos === "number" ? endlos : undefined);
  if (art === "blatt") return blattStarten(student, "kacheln");
  if (art === "phantom" || art === "vorlage") return phantomStarten(student, art === "phantom" ? "fall" : "text", typeof endlos === "number" ? endlos : undefined);
  const heute = wienerDatum();
  const lernstand = lernstandVon(student.id, skillFuerSpiel(student, art, heute));
  const grund = spielVorschlaege(student, { heute }).find((v) => v.art === art)?.quelle;
  const lauf = !hatEndlos(art) ? undefined : endlos === "neu" ? "neu" : Number.isInteger(endlos) && Number(endlos) > 0 ? Number(endlos) : undefined;
  const brett = bloecke === true || bloecke === "bloecke" ? "bloecke" : bloecke === "funkel" ? "funkel" : bloecke === "tor" ? "tor" : null;
  // ein neues Blockwerk-Spiel beendet ein angefangenes: seine Punkte zählen (lib/blockwerk-stand.ts)
  if (brett === "bloecke" && lauf === "neu") {
    const alt = offenesBlockwerk(student.id);
    if (alt) {
      beenden(student, alt.stand.rundeId, alt.stand.antworten, { teil: true, punkte: alt.punkte });
      vergissStand(student.id, alt.lauf);
    }
  }
  const runde = starteRunde(student, art, { grund, lernstand, heute, endlos: lauf, bloecke: brett === "bloecke" && lauf === "neu", funkel: brett === "funkel" && lauf === "neu", tor: brett === "tor" && lauf === "neu" });
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

function wortStarten(student: repo.Student, thema: string | undefined, lauf?: number): SpielStart {
  const heute = wienerDatum();
  const weiter = Number.isInteger(lauf) && Number(lauf) > 0 ? Number(lauf) : undefined;
  const wahl = wortThemen(student, heute);
  const gemeint = wahl.find((t) => t.id === thema) ?? wahl[0];
  if (!weiter && !gemeint) return { fehler: "Für Wortschloss gibt es gerade keine Wörter." };
  const lernstand = gemeint ? lernstandVon(student.id, gemeint.skill) : null;
  const runde = starteRunde(student, "wort", { heute, lernstand, endlos: weiter ?? "neu", wortThema: gemeint?.id });
  if (!runde.karten.length) return { fehler: "Für Wortschloss gibt es gerade keine Wörter." };
  return runde;
}

function phantomStarten(student: repo.Student, teil: "fall" | "text", lauf?: number, stufe?: number): SpielStart {
  const heute = wienerDatum();
  if (!phantomWahl(student, heute)) return { fehler: "Phantombild gibt es für dich gerade nicht." };
  const weiter = Number.isInteger(lauf) && Number(lauf) > 0 ? Number(lauf) : undefined;
  const art = teil === "text" ? "vorlage" : "phantom";
  const runde = starteRunde(student, art, { heute, endlos: weiter ?? "neu", vorlageStufe: Number.isFinite(stufe) ? Number(stufe) : undefined });
  if (!runde.karten.length) return { fehler: "Für dieses Spiel gibt es gerade keine Karten." };
  return runde;
}

function blattStarten(student: repo.Student, modus: "kacheln" | "schreiben", alle?: boolean): SpielStart {
  if (!blaetterWahl(student, wienerDatum())) return { fehler: "Blätter bestimmen gibt es für dich gerade nicht." };
  const runde = starteRunde(student, "blatt", { blatt: { modus: modus === "schreiben" ? "schreiben" : "kacheln", alle: alle === true } });
  if (!runde.karten.length) return { fehler: "Für dieses Spiel gibt es gerade keine Karten." };
  return runde;
}

function beenden(student: repo.Student, rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean; punkte?: number }): SpielErgebnis {
  const zeile = rundenSkill(student.id, Number(rundeId));
  // Blockwerk, Funkelfeld, Glasklar und Wortschloss: die Punkte kommen mit dem Ende des Spiels (und nur dann zählt ein Rekord)
  const lauf = zeile?.endlos ?? null;
  const spiel: PunkteSpiel | null = lauf ? (PUNKTE_SPIELE.find((s) => laufIst(student.id, lauf, s)) ?? null) : null;
  // Blockwerk und Funkelfeld: ein Brett zwischen den Karten (gleiches Ergebnis)
  const block = spiel === "bloecke" || spiel === "funkel" || spiel === "tor" ? spiel : null;
  // das Ende eines Blockwerk-Spiels: nichts mehr zum Weiterspielen
  if (spiel === "bloecke" && lauf && o?.punkte !== undefined) vergissStand(student.id, lauf);
  if (spiel && lauf && o?.punkte !== undefined) laufPunkte(student.id, lauf, spiel === "glas" ? gueltigeGlasPunkte(o.punkte) : spiel === "wort" ? gueltigeWortPunkte(o.punkte) : spiel === "funkel" ? gueltigeFunkelPunkte(o.punkte) : spiel === "tor" ? gueltigeTorPunkte(o.punkte) : spiel === "phantom" ? gueltigePhantomPunkte(o.punkte) : gueltigePunkte(o.punkte), spiel);
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
    bloecke: zeile?.endlos && block ? { rekord: punkteRekord(student.id, block, zeile.endlos), fragen: endlosStand(student.id, zeile.endlos), bestenliste: o?.punkte !== undefined ? punkteBestenliste(student, block) : undefined } : undefined,
    wort: zeile?.endlos && spiel === "wort" ? { rekord: punkteRekord(student.id, "wort", zeile.endlos), woerter: endlosStand(student.id, zeile.endlos), bestenliste: o?.punkte !== undefined ? punkteBestenliste(student, "wort") : undefined } : undefined,
    phantom: zeile?.endlos && spiel === "phantom" ? { rekord: punkteRekord(student.id, "phantom", zeile.endlos), merkmale: endlosStand(student.id, zeile.endlos), bestenliste: o?.punkte !== undefined ? punkteBestenliste(student, "phantom") : undefined } : undefined,
    blatt: zeile?.art === "blatt" ? { sicher: sichereBlaetter(student.id) } : undefined,
    glas: zeile?.endlos && spiel === "glas" ? { rekord: punkteRekord(student.id, "glas", zeile.endlos), begriffe: endlosStand(student.id, zeile.endlos), bestenliste: o?.punkte !== undefined ? punkteBestenliste(student, "glas") : undefined } : undefined,
  };
}
