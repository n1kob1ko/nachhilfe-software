/**
 * **Probeschularbeit**: eine ganze Übungs-Schularbeit zu einer geplanten **Schularbeit**, aus ihrem Stoff
 * (`tests.skill_ids`). Aufgebaut wie eine echte: zuerst leichte Aufgaben, dann mittlere, am Ende schwere,
 * jede mit Punkten, dazu ein Notenschlüssel. niko, 2026-10-19, auf der Karte „bessere Übungen“:
 * „Ein ganzer Test zum Stoffzettel mit Punkten und Notenschlüssel, als A4 zum Drucken.“
 *
 * Eine Probeschularbeit ist eine gewöhnliche Übung (kind 'ueberpruefung', `worksheets.probe_test_id` = die
 * Schularbeit). Sie beginnt als Entwurf: der Lehrer prüft sie in der Vorschau wie jede Übung. Am Gerät läuft
 * sie wie ein **Minitest** (Zuweisung im Modus 'test': ohne Tipps, ein Versuch je Aufgabe), gedruckt mit
 * Punkten je Aufgabe und dem Notenschlüssel am Ende.
 *
 * Die Aufgaben kommen wie bei der Diagnose (lib/diagnose.ts): zuerst ungesehene aus der Aufgabenbibliothek,
 * dann aus den Generatoren, und nur für Fähigkeiten ohne Generator von der KI, in einer Anfrage und nur,
 * wenn der Lehrer es will. Ohne KI bekommen diese Fähigkeiten Erklär-Aufgaben.
 */
import { aiEnabled, generateWithAI } from "./ai";
import { categoriesFor, mixFor, type Difficulty } from "./curriculum";
import { db } from "./db";
import { libraryTask, taskKey } from "./diagnose";
import { examPrep, dayOf } from "./exams";
import { generateForSlot, hasBuiltInGenerator } from "./generators";
import { getSetting, setSetting } from "./lehrplan";
import * as repo from "./repo";
import { klassenLabel, schulstufe } from "./school";
import type { TaskDraft } from "./tasks";
import { EIGENE_VOKABELN } from "./vokabeln";
import { eigeneFuerPlaetze } from "./vokabellisten";
import { wortartenFor } from "./wortarten";
import {
  ANZAHL,
  DAUER_STANDARD,
  isDauer,
  noteFuer as note,
  notenBereiche,
  papierPunkte,
  planeProbeschularbeit,
  PUNKTE_MAX,
  SCHLUESSEL_STANDARD,
  schluesselTabelle as tabelle,
  standardPunkte,
  type Dauer,
  type Note,
} from "./probeschularbeit-regeln";

export * from "./probeschularbeit-regeln";

// ---------- Punkte und Notenschlüssel aus der Datenbank ----------

/** Die Punkte jeder Aufgabe einer Übung, in ihrer Reihenfolge: eingetragen oder die Vorgabe. */
export function punkteDerAufgaben(worksheetId: number, tasks = repo.listTasks(worksheetId)): Map<number, number> {
  const rows = db().prepare("SELECT id, points FROM tasks WHERE worksheet_id = ?").all(worksheetId) as { id: number; points: number | null }[];
  const eingetragen = new Map(rows.map((r) => [r.id, r.points]));
  return new Map(tasks.map((t) => [t.id, eingetragen.get(t.id) ?? standardPunkte(t)]));
}

/** Punkte einer Aufgabe ändern: ganze oder halbe Punkte von 0,5 bis PUNKTE_MAX. */
export function setzePunkte(taskId: number, punkte: number) {
  if (!Number.isFinite(punkte)) throw new Error("Bitte eine Zahl eintragen.");
  const p = Math.round(punkte * 2) / 2;
  if (p < 0.5 || p > PUNKTE_MAX) throw new Error(`Punkte von 0,5 bis ${PUNKTE_MAX}.`);
  db().prepare("UPDATE tasks SET points = ? WHERE id = ?").run(p, taskId);
}

export function notenschluessel(): [number, number, number, number] {
  const n = getSetting("notenschluessel", SCHLUESSEL_STANDARD.join(","))
    .split(",")
    .map(Number)
    .filter((x) => Number.isFinite(x) && x > 0 && x <= 100);
  if (n.length !== 4) return SCHLUESSEL_STANDARD;
  const [a, b, c, d] = [...n].sort((x, y) => y - x);
  return [a, b, c, d];
}

export function setNotenschluessel(values: number[]) {
  const n = values.map((x) => Math.round(x * 10) / 10);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x) || x <= 0 || x > 100)) throw new Error("Vier Prozentwerte von 1 bis 100 erwartet.");
  const sorted = [...n].sort((a, b) => b - a);
  if (new Set(sorted).size !== 4) throw new Error("Die vier Grenzen müssen verschieden sein.");
  setSetting("notenschluessel", sorted.join(","));
}

/** Ab wie vielen Punkten es jede Note gibt, mit dem gespeicherten Notenschlüssel. */
export const schluesselTabelle = (gesamt: number, grenzen: readonly number[] = notenschluessel()) => tabelle(gesamt, grenzen);

/** Die Note für so viele Punkte, mit dem gespeicherten Notenschlüssel. */
export const noteFuer = (punkte: number, gesamt: number, grenzen: readonly number[] = notenschluessel()) => note(punkte, gesamt, grenzen);

// ---------- Ergebnis am Gerät ----------

export type ProbeErgebnis = {
  erreicht: number;
  gesamt: number;
  /** Aufgaben, die der Lehrer noch bewerten muss */
  offen: number;
  /** bearbeitete Aufgaben */
  bearbeitet: number;
  aufgaben: number;
  /** die Note, sobald alles bearbeitet und bewertet ist */
  note: Note | null;
};

/**
 * Punkte und Note einer am Gerät geschriebenen Probeschularbeit: richtig = alle Punkte, vom Lehrer
 * „teilweise richtig“ = die Hälfte, falsch = 0. Solange etwas offen ist, gibt es keine Note.
 */
export function ergebnis(assignmentId: number): ProbeErgebnis | null {
  const a = repo.getAssignment(assignmentId);
  if (!a) return null;
  const tasks = repo.listTasks(a.worksheet_id);
  const punkte = punkteDerAufgaben(a.worksheet_id, tasks);
  // auf Papier gelöst: die Punkte, die auf dem Blatt stehen
  const papier = papierPunkte(repo.getWorksheet(a.worksheet_id)?.settings ?? null);
  const finals = repo.listAttemptsForAssignment(assignmentId).filter((x) => x.final);
  let erreicht = 0;
  let offen = 0;
  for (const t of tasks) {
    const f = [...finals].reverse().find((x) => x.task_id === t.id);
    if (!f) continue;
    const p = punkte.get(t.id) ?? 0;
    if (f.review === "offen") offen++;
    else if (papier && t.id in papier) erreicht += papier[t.id];
    else if (f.review === "teilweise") erreicht += Math.round(p) / 2;
    else if (f.correct) erreicht += p;
  }
  const gesamt = [...punkte.values()].reduce((s, p) => s + p, 0);
  const bearbeitet = new Set(finals.map((x) => x.task_id)).size;
  const fertig = bearbeitet >= tasks.length && offen === 0;
  return { erreicht, gesamt, offen, bearbeitet, aufgaben: tasks.length, note: fertig && gesamt > 0 ? noteFuer(erreicht, gesamt) : null };
}

// ---------- Erstellen ----------

export const isProbeschularbeit = (worksheetId: number): boolean =>
  Boolean((db().prepare("SELECT probe_test_id FROM worksheets WHERE id = ?").get(worksheetId) as { probe_test_id: number | null } | undefined)?.probe_test_id);

/** Die Schularbeit einer Probeschularbeit, oder null. */
export function probeTestId(worksheetId: number): number | null {
  return (db().prepare("SELECT probe_test_id FROM worksheets WHERE id = ?").get(worksheetId) as { probe_test_id: number | null } | undefined)?.probe_test_id ?? null;
}

/** Arbeitszeit in Minuten, wie beim Erstellen gewählt. */
export function dauerVon(w: Pick<repo.Worksheet, "settings">): Dauer | null {
  try {
    const d = Number((JSON.parse(w.settings ?? "{}") as { dauer?: unknown }).dauer);
    return isDauer(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Was das gedruckte Blatt braucht (components/arbeitsblatt/Sheet.tsx): Punkte je Aufgabe in ihrer
 * Reihenfolge, die Summe, der Notenschlüssel und die Arbeitszeit. null für jede andere Übung.
 */
export function blattDaten(w: repo.Worksheet, tasks: repo.Task[]) {
  if (!w.probe_test_id) return null;
  const punkte = punkteDerAufgaben(w.id, tasks);
  const liste = tasks.map((t) => punkte.get(t.id) ?? standardPunkte(t));
  const gesamt = liste.reduce((s, p) => s + p, 0);
  return { punkte: liste, gesamt, bereiche: notenBereiche(gesamt, notenschluessel()), dauer: dauerVon(w) };
}

export type ProbeUebersicht = { worksheet: repo.Worksheet; punkte: number; assignment: (repo.Assignment & { student_name: string; done_count: number; correct_count: number }) | null; ergebnis: ProbeErgebnis | null };

/** Die Probeschularbeiten einer Schularbeit, die neueste zuerst, mit Punkten und, wenn geschrieben, dem Ergebnis. */
export function probeschularbeitenZu(testId: number): ProbeUebersicht[] {
  const ids = db().prepare("SELECT id FROM worksheets WHERE probe_test_id = ? ORDER BY id DESC").all(testId) as { id: number }[];
  return ids.flatMap(({ id }) => {
    const worksheet = repo.getWorksheet(id);
    if (!worksheet) return [];
    const punkte = [...punkteDerAufgaben(id).values()].reduce((s, p) => s + p, 0);
    // zweimal gesendet: die, in der schon gearbeitet wurde, sonst die neueste
    const seine = repo.listAssignmentsForWorksheet(id).filter((x) => x.student_id === worksheet.student_id);
    const assignment = seine.find((x) => x.done_count > 0) ?? seine[0] ?? null;
    return [{ worksheet, punkte, assignment, ergebnis: assignment ? ergebnis(assignment.id) : null }];
  });
}

export type ProbeInput = {
  testId: number;
  teacherId: number | null;
  dauer?: number;
  /** Fähigkeiten ohne Generator bekommen ihre Aufgaben von der KI (nur wenn verfügbar) */
  useAI?: boolean;
  /** für Tests: macht die Generator-Aufgaben wiederholbar */
  seed?: number;
};

/** Aufgabentypen mit mehreren Schritten oder eigenem Text: die passen auf die schweren Plätze. */
const AUFWENDIG = new Set(["sachaufgabe", "rechenweg", "textaufgabe", "offen", "korrigieren", "schreiben", "satz", "writing", "translation", "reading", "textverstaendnis"]);

/**
 * Die Aufgabentypen der Fähigkeit für einen Platz: auf leichten Plätzen zuerst die kurzen (Rechnung,
 * Auswahl, Lücken), auf schweren zuerst die aufwendigen (Rechenweg, Sachaufgabe, Text), wie in einer
 * Schularbeit. Gibt es nur eine Sorte, bleibt die Reihenfolge des Builders.
 */
export function typenFuerPlatz(mix: string[], difficulty: Difficulty): string[] {
  const lang = mix.filter((k) => AUFWENDIG.has(k));
  const kurz = mix.filter((k) => !AUFWENDIG.has(k));
  if (!lang.length || !kurz.length) return mix;
  if (difficulty === "leicht" || difficulty === "sehr leicht") return [...kurz, ...lang];
  if (difficulty === "schwer" || difficulty === "sehr schwer") return [...lang, ...kurz];
  return mix;
}

const FOKUS =
  "Probeschularbeit: Die Aufgaben sollen wie in einer echten Schularbeit sein. Klar formuliert, ohne Tipps im Aufgabentext, gut mit Punkten zu bewerten, möglichst verschiedene Formate (auch Textaufgaben). Jede Aufgabe genau in der angegebenen Schwierigkeit.";

/** Ein Zufall mit Startwert, damit Tests dieselben Aufgaben bekommen. */
function zufall(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

/**
 * Erstellt die Probeschularbeit als Entwurf für den Schüler der Schularbeit. Wirft, wenn der Stoff noch
 * keinen Fähigkeiten zugeordnet ist.
 */
export async function erstelleProbeschularbeit(input: ProbeInput): Promise<{ worksheetId: number; aiError?: string; ohneKi: number }> {
  const prep = examPrep(input.testId, dayOf(new Date()));
  if (!prep) throw new Error("Schularbeit nicht gefunden.");
  const { test, student } = prep;
  const all = new Map(repo.listSkills().map((s) => [s.id, s]));
  // die schwächsten zuerst (wie im Plan), dann die übrigen verknüpften
  const ids = [...new Set([...prep.skills.map((s) => s.skill.id), ...test.skill_ids])].filter((id) => all.get(id)?.subject === test.subject);
  if (!ids.length) throw new Error("Ordne zuerst den Stoff Fähigkeiten zu.");
  const dauer = isDauer(input.dauer ?? 0) ? (input.dauer as Dauer) : DAUER_STANDARD;
  const plan = planeProbeschularbeit(ids, ANZAHL[dauer]);
  const klasse = student.klasse ?? 1;
  const grade = student.klasse ? schulstufe(student.school_type, student.klasse) : student.grade;

  const gesehen = new Set(
    (db().prepare("SELECT DISTINCT t.prompt FROM attempts a JOIN tasks t ON t.id = a.task_id WHERE a.student_id = ?").all(student.id) as { prompt: string }[]).map((r) => r.prompt),
  );
  const benutzt = new Set<number>();
  const drafts: (TaskDraft | null)[] = plan.map((p) => libraryTask(test.subject, p, benutzt, gesehen));
  // Vokabeln aus den eigenen Listen des Schülers, nie von der KI
  const eigene = plan.map((p, i) => ({ p, i })).filter(({ p, i }) => !drafts[i] && p.skillId === EIGENE_VOKABELN);
  const vokabelMix = mixFor(test.subject, EIGENE_VOKABELN);
  eigeneFuerPlaetze(student.id, null, eigene.map(({ p }, k) => ({ category: vokabelMix[k % vokabelMix.length], difficulty: p.difficulty })), { avoid: gesehen }).forEach((t, k) => {
    if (t) drafts[eigene[k].i] = t;
  });

  // Fähigkeiten ohne Generator: von der KI, eine Anfrage für alle
  let aiError: string | undefined;
  let source: repo.Worksheet["source"] = "generator";
  const fuerKi = plan.map((p, i) => ({ p, i })).filter(({ p, i }) => !drafts[i] && !hasBuiltInGenerator(p.skillId) && p.skillId !== EIGENE_VOKABELN);
  if (fuerKi.length && (input.useAI ?? true) && aiEnabled()) {
    try {
      const paare = [...new Map(fuerKi.map(({ p }) => [`${p.skillId}|${p.difficulty}`, p])).values()];
      const out = await generateWithAI(
        {
          subject: test.subject,
          level: klassenLabel(student.school_type, klasse),
          skills: paare.map((p) => ({ id: p.skillId, name: all.get(p.skillId)!.name, area: all.get(p.skillId)!.area, difficulty: p.difficulty })),
          count: fuerKi.length,
          categories: [],
          focusNote: FOKUS,
          avoid: drafts.filter((d): d is TaskDraft => Boolean(d)).map((d) => d.prompt),
        },
        { teacherId: input.teacherId, studentId: student.id, trigger: "probeschularbeit" },
      );
      for (const t of out ?? []) {
        // der Platz mit derselben Fähigkeit, am liebsten in derselben Schwierigkeit
        const frei = fuerKi.filter(({ i, p }) => !drafts[i] && p.skillId === t.skillId);
        const platz = frei.find(({ p }) => p.difficulty === t.difficulty) ?? frei[0];
        if (platz) drafts[platz.i] = { ...t, difficulty: platz.p.difficulty };
      }
      if (out?.length) source = "ki";
      else aiError = "Die KI hat keine Aufgaben geliefert.";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  }

  // der Rest aus den Generatoren, in den Aufgabentypen, die zur Fähigkeit passen (wie im Builder)
  const rng = input.seed === undefined ? Math.random : zufall(input.seed);
  const keys = new Set(drafts.filter((d): d is TaskDraft => Boolean(d)).map(taskKey));
  const wortarten = wortartenFor(plan.map((p) => p.skillId), grade);
  const typen = new Set(categoriesFor(test.subject).map((c) => c.key));
  let ohneKi = 0;
  plan.forEach((p, i) => {
    if (drafts[i]) return;
    const skill = all.get(p.skillId)!;
    const mix = typenFuerPlatz(
      mixFor(test.subject, p.skillId).filter((k) => typen.has(k)),
      p.difficulty,
    );
    // reihum innerhalb der Plätze derselben Fähigkeit und Schwierigkeit
    const runde = plan.slice(0, i).filter((x) => x.skillId === p.skillId && x.difficulty === p.difficulty).length;
    let t: TaskDraft | null = null;
    for (let k = 0; k < 8; k++) {
      const c = generateForSlot({ skillId: p.skillId, skillName: skill.name, difficulty: p.difficulty, category: mix.length ? mix[(runde + k) % mix.length] : null, subject: test.subject, wortarten, grade }, rng, runde + k);
      if (!keys.has(taskKey(c)) && !gesehen.has(c.prompt)) {
        t = c;
        break;
      }
      t ??= c;
    }
    // eine Fähigkeit ohne Generator bekommt hier eine Erklär-Aufgabe: das sagt die Vorschau
    if (!hasBuiltInGenerator(p.skillId)) ohneKi++;
    keys.add(taskKey(t!));
    drafts[i] = { ...t!, sourceType: "eigen" };
  });

  const tasks = drafts.filter((d): d is TaskDraft => Boolean(d));
  const name = test.title || `${test.kind} ${test.subject}`;
  const first = student.name.split(" ")[0];
  const worksheetId = repo.createWorksheet(
    {
      title: `${first} – Probeschularbeit: ${name}`.slice(0, 120),
      subject: test.subject,
      grade,
      school_type: student.school_type,
      klasse: student.klasse,
      topic: [...new Set(ids.map((id) => all.get(id)!.area))].join(", "),
      difficulty: "gemischt",
      task_type: "mixed",
      kind: "ueberpruefung",
      source,
      skill_ids: ids,
      student_id: student.id,
      teacher_id: input.teacherId,
      status: "entwurf",
      // dauer: für den Kopf des gedruckten Blatts („Arbeitszeit: 50 Minuten“)
      settings: JSON.stringify({ useAI: input.useAI ?? true, focus: FOKUS, dauer }),
    },
    tasks,
  );
  db().prepare("UPDATE worksheets SET probe_test_id = ? WHERE id = ?").run(test.id, worksheetId);
  return { worksheetId, aiError, ohneKi };
}
