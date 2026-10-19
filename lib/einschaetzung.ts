/**
 * Die **Einschätzung** einer Einheit: wie der Schüler sich getan hat, aus dem, was die App ohnehin
 * misst (Aufgaben, Fehler, Hilfen, Zeit pro Aufgabe) und im Vergleich mit seinen letzten Einheiten.
 * Ohne KI und ohne Eingabe des Lehrers (niko, 2026-10-19: „der Lehrer muss da eigentlich nicht extra
 * was eintragen“).
 *
 * Beim Beenden füllt `dokumentiereAutomatisch` damit die Felder der Dokumentation, die sonst der
 * Lehrer ausgefüllt hat: Verständnis, Konzentration, Mitarbeit, Positives, Schwierigkeiten,
 * Wiederholen und das nächste Lernziel. Was der Lehrer selbst einträgt, wird nie überschrieben:
 * `lessons.auto_felder` merkt sich die automatischen Werte, und nur ein Feld, das noch genau diesen
 * Wert trägt (oder leer ist), gilt als automatisch.
 *
 * Vorsichtig statt geraten: Unter `MIN_AUFGABEN` am Gerät erledigten Aufgaben gibt es keine Werte
 * auf den Skalen, nur die Zahlen. Motivation bleibt beim Lehrer, die Daten sagen dazu zu wenig.
 */
import { db, json } from "./db";
import { errorTypeLabel } from "./error-types";
import type { TaskLine, UnitReport } from "./learning";
import { nextSteps, RULE_LABEL } from "./recommend";
import * as repo from "./repo";

/** Unter so vielen erledigten Aufgaben gibt es keine Werte auf den Skalen. */
export const MIN_AUFGABEN = 4;
/** Ab diesem Unterschied der Quote richtiger Aufgaben gilt eine Einheit als besser oder schlechter als zuletzt. */
export const VERGLEICH_SCHWELLE = 0.1;
/** So viele frühere Einheiten zählen für den Vergleich. */
export const VERGLEICH_EINHEITEN = 3;

export type Stufe = 1 | 2 | 3 | 4 | 5;
export type Skala = "understanding" | "concentration" | "participation";

export type Vergleich = {
  /** Wie viele frühere Einheiten verglichen wurden (höchstens VERGLEICH_EINHEITEN). */
  einheiten: number;
  /** Das Fach der verglichenen Einheiten (null, wenn die Einheit kein Fach hat). */
  fach: string | null;
  quoteVorher: number;
  quoteJetzt: number;
  zeitVorherMs: number | null;
  zeitJetztMs: number | null;
  richtung: "besser" | "gleich" | "schlechter";
};

export type Einschaetzung = {
  version: 1;
  /** Gesamteindruck auf der Skala der App: 5 = sehr gut. Null ohne genug Daten. */
  stufe: Stufe | null;
  titel: string;
  /** Die Begründung in kurzen Sätzen, ohne Namen. */
  saetze: string[];
  vergleich: Vergleich | null;
  werte: Record<Skala, Stufe | null>;
  /** Warum ein Wert so ist, z. B. „keine längeren Pausen, bis zum Schluss gleichmäßig“. */
  gruende: Partial<Record<Skala, string>>;
  aufgaben: number;
};

/** Die Wörter zu den Stufen 1–5 der Skalen in der Dokumentation (auch im Formular des Lehrers). */
export const SKALEN_TEXT = {
  understanding: ["nicht verstanden", "kaum", "teilweise", "gut", "sehr gut"],
  concentration: ["sehr abgelenkt", "oft abgelenkt", "wechselnd", "konzentriert", "sehr konzentriert"],
  motivation: ["sehr gering", "gering", "mittel", "hoch", "sehr hoch"],
  participation: ["kaum", "wenig", "teilweise", "aktiv", "sehr aktiv"],
} as const;

export const STUFE_TITEL: Record<Stufe, string> = {
  5: "Sehr gut gelaufen",
  4: "Gut gelaufen",
  3: "Teils, teils",
  2: "Eher schwierig",
  1: "Schwierige Einheit",
};

const pct = (x: number) => `${Math.round(x * 100)} %`;
const sek = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;
const stufe = (n: number): Stufe => Math.max(1, Math.min(5, Math.round(n))) as Stufe;
const liste = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}`);

/** Wie gut eine Aufgabe gelöst wurde: beim ersten Versuch ohne Hilfe 1, nach einem Hinweis 0,6, falsch 0. */
export function punkte(t: Pick<TaskLine, "correct" | "firstTry" | "help">): number {
  if (!t.correct) return 0;
  if (t.firstTry) return 1;
  return { keine: 0.75, hinweis: 0.6, erklaerung: 0.4, loesung: 0 }[t.help];
}

/** Verständnis aus den Punkten der erledigten Aufgaben. */
function verstaendnis(erledigt: TaskLine[]): { wert: Stufe; grund: string } {
  const schnitt = erledigt.reduce((s, t) => s + punkte(t), 0) / erledigt.length;
  const wert: Stufe = schnitt >= 0.85 ? 5 : schnitt >= 0.65 ? 4 : schnitt >= 0.45 ? 3 : schnitt >= 0.25 ? 2 : 1;
  const ersterVersuch = erledigt.filter((t) => t.firstTry).length;
  return { wert, grund: `${ersterVersuch} von ${erledigt.length} Aufgaben beim ersten Versuch ohne Hilfe` };
}

/** Konzentration aus längeren Pausen in einer Aufgabe, Flüchtigkeitsfehlern und dem Verlauf der Einheit. */
function konzentration(r: UnitReport, erledigt: TaskLine[]): { wert: Stufe; grund: string } {
  const pausen = r.speed.pauses;
  const fluechtig = erledigt.filter((t) => t.errorTypes?.some((e) => e === "fluechtig" || e === "gelesen")).length;
  let wert = 4;
  const gruende: string[] = [];
  const anteil = pausen / Math.max(1, erledigt.length);
  if (anteil >= 0.3) wert -= 2;
  else if (anteil >= 0.15 || pausen >= 2) wert -= 1;
  if (pausen) gruende.push(`${pausen} ${pausen === 1 ? "längere Pause" : "längere Pausen"} (über 2 min) in einer Aufgabe`);
  if (fluechtig >= 2) {
    wert -= 1;
    gruende.push(`${fluechtig} Flüchtigkeitsfehler`);
  }
  if (r.development.direction === "schlechter") {
    wert -= 1;
    gruende.push("gegen Ende mehr Fehler");
  }
  if (!pausen && fluechtig < 2 && r.development.direction !== "schlechter" && erledigt.length >= 6) {
    wert = 5;
    gruende.push("keine längeren Pausen, bis zum Schluss gleichmäßig");
  }
  if (!gruende.length) gruende.push("keine längeren Pausen");
  return { wert: stufe(wert), grund: gruende.join(", ") };
}

/** Mitarbeit aus dem, was am Gerät geschah: angefangene Aufgaben fertig gemacht, nach Fehlern weiter versucht. */
function mitarbeit(r: UnitReport, erledigt: TaskLine[]): { wert: Stufe; grund: string } {
  const angefangen = r.tasks.length;
  const fertig = erledigt.length / Math.max(1, angefangen);
  const aufgegeben = r.tasks.filter((t) => t.help === "loesung" && !t.correct).length;
  const selbstKorrigiert = r.correction.selbst + r.correction.nachHilfe;
  let wert = 4;
  const gruende = [`${erledigt.length} von ${angefangen} angefangenen Aufgaben fertig`];
  if (fertig < 0.6) wert = 2;
  else if (fertig < 0.85) wert = 3;
  if (aufgegeben) gruende.push(`${aufgegeben}× gleich den Lösungsweg angesehen`);
  if (aufgegeben / Math.max(1, angefangen) >= 0.25) wert -= 1;
  if (selbstKorrigiert) gruende.push(`${selbstKorrigiert} Fehler selbst verbessert`);
  if (fertig >= 0.95 && aufgegeben === 0 && erledigt.length >= 8) wert = 5;
  return { wert: stufe(wert), grund: gruende.join(", ") };
}

/**
 * Die Einschätzung einer Einheit aus ihrem Bericht. `frueher` sind die Berichte der letzten Einheiten
 * desselben Schülers (neueste zuerst, mit Fach), `fach` das Fach dieser Einheit.
 */
export function einschaetzen(r: UnitReport, frueher: { report: UnitReport; fach: string }[], fach: string | null): Einschaetzung {
  const erledigt = r.tasks.filter((t) => t.finished);
  const saetze: string[] = [];
  const texte = r.texts ?? [];
  const textSatz = texte.length ? `Textarbeit: ${texte.map((t) => `${t.added > 0 ? t.added : t.words} Wörter${t.added > 0 && !t.startedHere ? " dazugeschrieben" : " geschrieben"}`).join(", ")}.` : null;

  if (erledigt.length === 0) {
    if (textSatz) saetze.push(textSatz);
    saetze.push("Am Gerät wurden keine Aufgaben gelöst, daher keine Einschätzung aus Daten.");
    return { version: 1, stufe: null, titel: "Keine Aufgaben am Gerät", saetze, vergleich: null, werte: { understanding: null, concentration: null, participation: null }, gruende: {}, aufgaben: 0 };
  }

  saetze.push(`${r.correct} von ${erledigt.length} ${erledigt.length === 1 ? "Aufgabe" : "Aufgaben"} richtig (${pct(r.successRate ?? 0)}), ${r.firstTry} beim ersten Versuch ohne Hilfe.`);

  // Vergleich nur im selben Fach: Deutsch und Mathematik lassen sich nicht an der Quote vergleichen
  const mitDaten = frueher.filter((f) => f.report.tasksDone >= 3 && f.report.successRate !== null);
  const basis = (fach ? mitDaten.filter((f) => f.fach === fach) : mitDaten).slice(0, VERGLEICH_EINHEITEN);
  let vergleich: Vergleich | null = null;
  if (basis.length && r.successRate !== null) {
    const quoteVorher = basis.reduce((s, f) => s + f.report.successRate!, 0) / basis.length;
    const zeiten = basis.map((f) => f.report.speed.avgMs).filter((x): x is number => x !== null && x > 0);
    const zeitVorherMs = zeiten.length ? Math.round(zeiten.reduce((s, x) => s + x, 0) / zeiten.length) : null;
    const diff = r.successRate - quoteVorher;
    const richtung = diff >= VERGLEICH_SCHWELLE ? "besser" : diff <= -VERGLEICH_SCHWELLE ? "schlechter" : "gleich";
    vergleich = { einheiten: basis.length, fach, quoteVorher, quoteJetzt: r.successRate, zeitVorherMs, zeitJetztMs: r.speed.avgMs, richtung };
    const wo = `${basis.length === 1 ? "der letzten Einheit" : `den letzten ${basis.length} Einheiten`}${vergleich.fach ? ` in ${vergleich.fach}` : ""}`;
    saetze.push(
      richtung === "besser"
        ? `Besser als in ${wo}: ${pct(r.successRate)} statt ${pct(quoteVorher)} richtig.`
        : richtung === "schlechter"
          ? `Schwächer als in ${wo}: ${pct(r.successRate)} statt ${pct(quoteVorher)} richtig.`
          : `Ähnlich wie in ${wo} (${pct(quoteVorher)} richtig).`,
    );
    // die Zeit nur, wenn sie sich deutlich geändert hat und die Quote nicht darunter litt
    if (zeitVorherMs && r.speed.avgMs && erledigt.length >= MIN_AUFGABEN) {
      const faktor = r.speed.avgMs / zeitVorherMs;
      if (faktor <= 0.8 && richtung !== "schlechter") saetze.push(`Schneller als zuletzt: ${sek(r.speed.avgMs)} statt ${sek(zeitVorherMs)} pro Aufgabe.`);
      if (faktor >= 1.25) saetze.push(`Langsamer als zuletzt: ${sek(r.speed.avgMs)} statt ${sek(zeitVorherMs)} pro Aufgabe.`);
    }
  }

  if (r.development.direction === "besser") saetze.push("Gegen Ende sicherer geworden.");
  if (r.development.direction === "schlechter") saetze.push("Gegen Ende mehr Fehler, vielleicht müde.");
  if (r.help.tasks) saetze.push(`${r.help.tasks}× Hilfe gebraucht${r.help.solvedAfterHelp ? `, ${r.help.solvedAfterHelp} davon danach selbst gelöst` : ""}.`);
  const gestiegen = r.skills.filter((s) => s.before !== null && s.after !== null && s.after - s.before >= 0.1);
  if (gestiegen.length) saetze.push(`Fortschritt bei ${liste(gestiegen.slice(0, 3).map((s) => `${s.name} (${pct(s.before!)} → ${pct(s.after!)})`))}.`);
  if (textSatz) saetze.push(textSatz);

  if (erledigt.length < MIN_AUFGABEN) {
    saetze.push(`Zu wenige Aufgaben für eine Einschätzung (mindestens ${MIN_AUFGABEN}).`);
    return { version: 1, stufe: null, titel: "Zu wenige Aufgaben", saetze, vergleich, werte: { understanding: null, concentration: null, participation: null }, gruende: {}, aufgaben: erledigt.length };
  }

  const v = verstaendnis(erledigt);
  const k = konzentration(r, erledigt);
  const m = mitarbeit(r, erledigt);
  // Gesamteindruck: Verständnis zählt doppelt; ein deutlicher Sprung gegenüber zuletzt verschiebt um eine Stufe
  let gesamt = (2 * v.wert + k.wert + m.wert) / 4;
  if (vergleich && Math.abs(vergleich.quoteJetzt - vergleich.quoteVorher) >= 0.15) gesamt += vergleich.richtung === "besser" ? 1 : -1;
  const s = stufe(gesamt);
  return {
    version: 1,
    stufe: s,
    titel: STUFE_TITEL[s],
    saetze,
    vergleich,
    werte: { understanding: v.wert, concentration: k.wert, participation: m.wert },
    gruende: { understanding: v.grund, concentration: k.grund, participation: m.grund },
    aufgaben: erledigt.length,
  };
}

/** Die Felder der Dokumentation, die automatisch gefüllt werden dürfen. */
export const AUTO_FELDER = ["understanding", "concentration", "participation", "positives", "difficulties", "review_topics", "next_steps"] as const;
export type AutoFeld = (typeof AUTO_FELDER)[number];
export type AutoWerte = { [K in AutoFeld]: repo.Lesson[K] };

/** Was in die Felder kommt: Skalen aus der Einschätzung, Texte aus dem Bericht, das Lernziel aus der Empfehlung. */
export function autoWerte(r: UnitReport, e: Einschaetzung, naechste: string[]): AutoWerte {
  const sicher = r.skills.filter((s) => s.state === "sicher");
  const schwach = r.skills.filter((s) => s.state === "problem");
  const unsicher = r.skills.filter((s) => s.state === "unsicher");
  const positiv: string[] = [];
  if (sicher.length) positiv.push(`Sicher: ${sicher.map((s) => `${s.name} (${s.correct} von ${s.done})`).join(", ")}.`);
  if (e.vergleich?.richtung === "besser") positiv.push(`Besser als zuletzt (${pct(e.vergleich.quoteJetzt)} statt ${pct(e.vergleich.quoteVorher)} richtig).`);
  if (r.development.direction === "besser") positiv.push("Gegen Ende sicherer geworden.");
  if (r.correction.selbst) positiv.push(`${r.correction.selbst} Fehler selbst verbessert.`);
  const schwierig: string[] = [...schwach, ...unsicher].map((s) => `${s.name}: ${s.correct} von ${s.done} richtig${s.withHelp ? `, ${s.withHelp}× mit Hilfe` : ""}`);
  const typen = (r.errorTypes ?? []).filter((t) => t.type !== "unbekannt").slice(0, 3);
  // a Fehlerart the teacher has not confirmed is only the app's guess: say so
  const haeufig = typen.length ? typen.map((t) => `${errorTypeLabel(t.type)} (${t.count}×${t.confirmed ? "" : ", vermutet"})`) : r.errors.slice(0, 3).map((x) => `${x.label} (${x.count}×)`);
  if (haeufig.length) schwierig.push(`Häufige Fehler: ${haeufig.join(", ")}`);
  return {
    understanding: e.werte.understanding,
    concentration: e.werte.concentration,
    participation: e.werte.participation,
    positives: positiv.join(" "),
    difficulties: schwierig.join("\n"),
    review_topics: schwach.map((s) => s.name).join(", "),
    next_steps: naechste.join("\n"),
  };
}

/** Ein Feld ist leer, wenn der Lehrer dort nichts eingetragen hat. */
const leer = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim());
/** Gleich bis auf Zeilenenden und Rand (ein Textfeld im Browser schickt \r\n). */
const gleich = (a: unknown, b: unknown) => (typeof a === "string" && typeof b === "string" ? a.replace(/\r\n/g, "\n").trim() === b.replace(/\r\n/g, "\n").trim() : a === b);

/** Die Berichte der Einheiten vor dieser, neueste zuerst, mit ihrem Fach. */
function fruehereBerichte(lesson: repo.Lesson): { report: UnitReport; fach: string }[] {
  return repo
    .listLessons(lesson.student_id)
    .filter((l) => l.id !== lesson.id && l.kind === "stunde" && l.unit_id && l.status === "abgeschlossen" && l.starts_at < lesson.starts_at && l.report)
    .slice(0, 12)
    .flatMap((l) => {
      const report = json<UnitReport | null>(l.report, null);
      return report?.version === 1 ? [{ report, fach: l.subject }] : [];
    });
}

/**
 * Schreibt die Einschätzung zur Dokumentation einer Einheit und füllt die leeren Felder (und die,
 * die noch die automatischen Werte tragen). Felder, die der Lehrer ausgefüllt hat, bleiben.
 */
export function dokumentiereAutomatisch(lessonId: number, r: UnitReport, at = Date.now(), schonGefuellt: Partial<Record<"activities", string>> = {}): Einschaetzung | null {
  const lesson = repo.getLesson(lessonId);
  if (!lesson) return null;
  const e = einschaetzen(r, fruehereBerichte(lesson), lesson.subject || null);
  const today = new Date(at).toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
  const faecher = r.subjects.length ? r.subjects : lesson.subject ? [lesson.subject] : [];
  const naechste = nextSteps(lesson.student_id, { today, now: at, limit: 12 })
    .filter((s) => !faecher.length || faecher.includes(s.skill.subject))
    .slice(0, 2)
    .map((s) => `${s.skill.name} (${s.kind === "ueberpruefung" ? "Überprüfung" : RULE_LABEL[s.rule]})`);
  const werte = autoWerte(r, e, naechste);
  const bisher = autoFelderVon(lesson);
  const neu: Partial<AutoWerte> = {};
  // what writeLearningDoc already wrote from the data (e.g. „Was wurde gemacht“) counts as automatic too
  const auto: Record<string, unknown> = Object.fromEntries(Object.entries(schonGefuellt).filter(([, v]) => !leer(v)));
  for (const feld of AUTO_FELDER) {
    if (!leer(lesson[feld]) && !bisher.has(feld)) continue;
    (neu as Record<string, unknown>)[feld] = werte[feld];
    if (!leer(werte[feld])) auto[feld] = werte[feld];
  }
  repo.saveLesson({ ...lesson, ...neu }, lesson.id);
  db().prepare("UPDATE lessons SET einschaetzung = ?, auto_felder = ? WHERE id = ?").run(JSON.stringify(e), JSON.stringify(auto), lesson.id);
  return e;
}

/** Die gespeicherte Einschätzung einer Dokumentation, oder null (ältere Einheiten haben keine). */
export function leseEinschaetzung(lesson: Pick<repo.Lesson, "einschaetzung">): Einschaetzung | null {
  const e = json<Einschaetzung | null>(lesson.einschaetzung, null);
  return e?.version === 1 ? e : null;
}

/** Welche Felder noch genau den automatischen Wert tragen; ein geändertes Feld gehört dem Lehrer. */
export function autoFelderVon(lesson: repo.Lesson): Set<string> {
  const werte = json<Record<string, unknown>>(lesson.auto_felder, {});
  return new Set(Object.keys(werte).filter((f) => f in lesson && !leer(lesson[f as keyof repo.Lesson]) && gleich(lesson[f as keyof repo.Lesson], werte[f])));
}
