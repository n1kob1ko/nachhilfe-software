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
 *
 * **Vom Stoffzettel** (niko, 2026-11-08): die KI schreibt alle Aufgaben aus den Zeilen des gelesenen Stoffs, jede Zeile
 * kommt dran, auch eine ohne passende Fähigkeit (`erstelleVomStoff`, docs/probeschularbeit.md).
 */
import { aiEnabled, generatePlanWithAI, generateWithAI } from "./ai";
import { categoriesFor, mixFor, type Difficulty } from "./curriculum";
import { db } from "./db";
import { libraryTask, taskKey } from "./diagnose";
import { examPrep, dayOf } from "./exams";
import { generateForSlot, hasBuiltInGenerator } from "./generators";
import { getSetting, matchSkills, setSetting } from "./lehrplan";
import { istUmfangZeile, nurFuerHeute, stoffDerPruefung } from "./pruefungsstoff";
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
  planeVomStoff,
  PUNKTE_MAX,
  SCHLUESSEL_STANDARD,
  schluesselTabelle as tabelle,
  standardPunkte,
  type Dauer,
  type Note,
  type StoffFuerProbe,
  type StoffPlatz,
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

/** `ohneFaehigkeit`: Teilaufgaben ohne Fähigkeit (eigene Probeschularbeit); sie zählen für die Note, nicht für den Lernstand. */
export type ProbeUebersicht = { worksheet: repo.Worksheet; punkte: number; assignment: (repo.Assignment & { student_name: string; done_count: number; correct_count: number }) | null; ergebnis: ProbeErgebnis | null; ohneFaehigkeit: number };

/** Die Probeschularbeiten einer Schularbeit, die neueste zuerst, mit Punkten und, wenn geschrieben, dem Ergebnis. */
export function probeschularbeitenZu(testId: number): ProbeUebersicht[] {
  const ids = db().prepare("SELECT id FROM worksheets WHERE probe_test_id = ? ORDER BY id DESC").all(testId) as { id: number }[];
  return ids.flatMap(({ id }) => {
    const worksheet = repo.getWorksheet(id);
    if (!worksheet) return [];
    const tasks = repo.listTasks(id);
    const punkte = [...punkteDerAufgaben(id, tasks).values()].reduce((s, p) => s + p, 0);
    const ohneFaehigkeit = tasks.filter((t) => !t.skillId).length;
    // zweimal gesendet: die, in der schon gearbeitet wurde, sonst die neueste
    const seine = repo.listAssignmentsForWorksheet(id).filter((x) => x.student_id === worksheet.student_id);
    const assignment = seine.find((x) => x.done_count > 0) ?? seine[0] ?? null;
    return [{ worksheet, punkte, assignment, ergebnis: assignment ? ergebnis(assignment.id) : null, ohneFaehigkeit }];
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
  /**
   * Vom Stoffzettel (niko, 2026-11-08): die KI schreibt alle Aufgaben aus den Zeilen des Stoffs, jede Zeile kommt
   * dran, auch eine ohne passende Fähigkeit. Braucht keine verknüpften Fähigkeiten.
   */
  vomStoff?: boolean;
};

/** Was beim Erstellen herauskam; `stoff` nur vom Stoffzettel: wie viele Zeilen und wie viele Aufgaben die App statt der KI machte. */
export type ProbeErstellt = { worksheetId: number; aiError?: string; ohneKi: number; stoff?: { zeilen: number; aufgaben: number; ersetzt: number } };

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
export async function erstelleProbeschularbeit(input: ProbeInput): Promise<ProbeErstellt> {
  const prep = examPrep(input.testId, dayOf(new Date()));
  if (!prep) throw new Error("Schularbeit nicht gefunden.");
  if (input.vomStoff) return erstelleVomStoff(input, prep.test, prep.student);
  const { test, student } = prep;
  const all = new Map(repo.listSkills().map((s) => [s.id, s]));
  // die schwächsten zuerst (wie im Plan), dann die übrigen verknüpften
  const ids = [...new Set([...prep.skills.map((s) => s.skill.id), ...test.skill_ids])].filter((id) => all.get(id)?.subject === test.subject);
  if (!ids.length) throw new Error("Ordne zuerst den Stoff Fähigkeiten zu.");
  const dauer = isDauer(input.dauer ?? 0) ? (input.dauer as Dauer) : DAUER_STANDARD;
  const plan = planeProbeschularbeit(ids, ANZAHL[dauer]);
  const klasse = student.klasse ?? 1;
  const grade = student.klasse ? schulstufe(student.school_type, student.klasse) : student.grade;

  const gesehen = schonGesehen(student.id);
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

  const worksheetId = speichere(test, student, grade, {
    tasks: drafts.filter((d): d is TaskDraft => Boolean(d)),
    topic: [...new Set(ids.map((id) => all.get(id)!.area))].join(", "),
    source,
    skillIds: ids,
    teacherId: input.teacherId,
    // dauer: für den Kopf des gedruckten Blatts („Arbeitszeit: 50 Minuten“)
    settings: { useAI: input.useAI ?? true, focus: FOKUS, dauer },
  });
  return { worksheetId, aiError, ohneKi };
}

/** Die Aufgabentexte, die der Schüler schon bearbeitet hat: eine neue Probeschularbeit nimmt andere. */
function schonGesehen(studentId: number): Set<string> {
  return new Set((db().prepare("SELECT DISTINCT t.prompt FROM attempts a JOIN tasks t ON t.id = a.task_id WHERE a.student_id = ?").all(studentId) as { prompt: string }[]).map((r) => r.prompt));
}

/** Speichert die Probeschularbeit als Entwurf zur Schularbeit. */
function speichere(
  test: repo.TestResult,
  student: repo.Student,
  grade: number,
  o: { tasks: TaskDraft[]; topic: string; source: repo.Worksheet["source"]; skillIds: string[]; teacherId: number | null; settings: Record<string, unknown> },
): number {
  const name = test.title || `${test.kind} ${test.subject}`;
  const first = student.name.split(" ")[0];
  const worksheetId = repo.createWorksheet(
    {
      title: `${first} – Probeschularbeit: ${name}`.slice(0, 120),
      subject: test.subject,
      grade,
      school_type: student.school_type,
      klasse: student.klasse,
      topic: o.topic.slice(0, 200),
      difficulty: "gemischt",
      task_type: "mixed",
      kind: "ueberpruefung",
      source: o.source,
      skill_ids: o.skillIds,
      student_id: student.id,
      teacher_id: o.teacherId,
      status: "entwurf",
      settings: JSON.stringify(o.settings),
    },
    o.tasks,
  );
  db().prepare("UPDATE worksheets SET probe_test_id = ? WHERE id = ?").run(test.id, worksheetId);
  return worksheetId;
}

// ---------- vom Stoffzettel ----------

const FOKUS_STOFF =
  "Probeschularbeit vom Stoffzettel: Die Aufgaben sollen wie in einer echten Schularbeit sein. Klar formuliert, ohne Tipps im Aufgabentext, gut mit Punkten zu bewerten. Jede Aufgabe prüft genau den Stoff, der bei ihr im Aufgabenplan steht, in der Schwierigkeit, die dort steht. Seitenangaben aus dem Schulbuch nur als Hinweis auf das Thema, keine Aufgabe aus dem Buch abschreiben.";

/**
 * Die Zeilen des Stoffs für die Probeschularbeit vom Stoffzettel: was die gelesenen Unterlagen als Prüfungsstoff nennen,
 * ohne Umfang (Überschriften, „Teste dein Wissen“, Übungsbuch) und ohne, was nur für heute ist. Die Fähigkeit einer Zeile,
 * wenn sie sicher oder von der Lehrkraft gewählt ist, sonst keine. Ohne gelesene Unterlagen die Themen der Prüfung. Dazu
 * jede Fähigkeit, die die Lehrkraft selbst verknüpft hat und die keine Zeile nennt.
 */
export function stoffFuerProbe(testId: number): StoffFuerProbe[] {
  const t = repo.getTest(testId);
  const student = t ? repo.getStudent(t.student_id) : null;
  if (!t || !student) return [];
  const verknuepft = new Set(t.skill_ids);
  const gibt = (id: string | null | undefined): id is string => Boolean(id && repo.getSkill(id));
  const zeilen = stoffDerPruefung(testId).filter((z) => z.status === "pruefung" && z.gruppe !== "umfang" && !nurFuerHeute(z.quelle) && !istUmfangZeile(z.original));
  const out: StoffFuerProbe[] = zeilen.length
    ? zeilen.map((z) => ({
        text: z.inhalt || z.original,
        skillId: ((z.zuordnung === "sicher" || z.zuordnung === "bestaetigt") && gibt(z.skill_id) ? z.skill_id : [z.vorauswahl, ...z.vorschlaege].find((id) => gibt(id) && verknuepft.has(id))) ?? null,
        einheit: z.einheit,
      }))
    : (t.topics?.length ? t.topics : [t.topic])
        .filter((x): x is string => Boolean(x?.trim()))
        .map((text) => ({ text, skillId: matchSkills(text, t.subject, { student, limit: 6 }).map((m) => m.skill.id).find((id) => verknuepft.has(id)) ?? null, einheit: "" }));
  const genannt = new Set(out.map((z) => z.skillId));
  for (const id of t.skill_ids) {
    const s = repo.getSkill(id);
    if (s && s.subject === t.subject && !genannt.has(id)) out.push({ text: s.name, skillId: id, einheit: s.area });
  }
  return out;
}

/** Wie viele verschiedene Zeilen der Stoff für die Probeschularbeit vom Stoffzettel hat. */
export const stoffZeilenAnzahl = (zeilen: StoffFuerProbe[]) => new Set(zeilen.map((z) => z.text.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean)).size;

/**
 * Die Probeschularbeit vom Stoffzettel: `planeVomStoff` legt fest, welche Zeilen bei welcher Aufgabe drankommen, die KI
 * schreibt alle Aufgaben in einer Anfrage, jede an ihren Platz. Was die KI nicht passend liefert (oder ohne KI), macht die
 * App: mit Fähigkeit aus den eingebauten Aufgaben, ohne eine Erklär-Aufgabe zum Wortlaut der Zeile. Eine Aufgabe zu einer
 * Zeile ohne Fähigkeit hat keine Fähigkeit: sie zählt für die Note, nicht für den Lernstand.
 */
async function erstelleVomStoff(input: ProbeInput, test: repo.TestResult, student: repo.Student): Promise<ProbeErstellt> {
  const zeilen = stoffFuerProbe(test.id);
  if (!zeilen.length) throw new Error("Zu dieser Schularbeit ist noch kein Stoff eingetragen. Lies zuerst den Stoffzettel ein.");
  const dauer = isDauer(input.dauer ?? 0) ? (input.dauer as Dauer) : DAUER_STANDARD;
  const plaetze = planeVomStoff(zeilen, ANZAHL[dauer]);
  const all = new Map(repo.listSkills().map((s) => [s.id, s]));
  const klasse = student.klasse ?? 1;
  const grade = student.klasse ? schulstufe(student.school_type, student.klasse) : student.grade;
  const typen = new Set(categoriesFor(test.subject).map((c) => c.key));
  const skillIds = [...new Set(plaetze.flatMap((p) => p.skillIds))].filter((id) => all.has(id));
  const wortarten = wortartenFor(skillIds, grade);
  const kategorien = plaetze.map((p, i) => kategorieFuer(test.subject, p, typen, plaetze.slice(0, i).filter((x) => x.stoff[0] === p.stoff[0]).length));

  const drafts: (TaskDraft | null)[] = plaetze.map(() => null);
  let aiError: string | undefined;
  if ((input.useAI ?? true) && aiEnabled()) {
    try {
      const out = await generatePlanWithAI(
        {
          subject: test.subject,
          level: klassenLabel(student.school_type, klasse),
          skills: skillIds.map((id) => ({ id, name: all.get(id)!.name, area: all.get(id)!.area, difficulty: "mittel" as const })),
          count: plaetze.length,
          categories: [],
          focusNote: FOKUS_STOFF,
          plan: plaetze.map((p, i) => ({ skillId: p.skillIds[0] ?? "", category: kategorien[i], difficulty: p.difficulty, stoff: p.stoff })),
          wortarten,
        },
        { teacherId: input.teacherId, studentId: student.id, trigger: "probeschularbeit" },
      );
      // jede Aufgabe mit der Fähigkeit und Schwierigkeit ihres Platzes (eine Zeile ohne Fähigkeit: keine)
      (out ?? []).forEach((d, i) => {
        if (d) drafts[i] = { ...d, skillId: plaetze[i].skillIds[0] ?? null, skillIds: plaetze[i].skillIds, difficulty: plaetze[i].difficulty };
      });
      if (!drafts.some(Boolean)) aiError = "Die KI hat keine passenden Aufgaben geliefert.";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  } else aiError = "Die KI ist nicht eingeschaltet.";

  // was fehlt: aus den eingebauten Aufgaben, eine Zeile ohne Fähigkeit als Erklär-Aufgabe zu ihrem Wortlaut
  const rng = input.seed === undefined ? Math.random : zufall(input.seed);
  const gesehen = schonGesehen(student.id);
  const keys = new Set(drafts.filter((d): d is TaskDraft => Boolean(d)).map(taskKey));
  let ersetzt = 0;
  let ohneKi = 0;
  plaetze.forEach((p, i) => {
    if (drafts[i]) return;
    ersetzt++;
    const skillId = p.skillIds.find((id) => all.has(id)) ?? null;
    let t: TaskDraft | null = null;
    for (let k = 0; k < 8; k++) {
      const c = generateForSlot(
        { skillId: skillId ?? "", skillName: skillId ? all.get(skillId)!.name : p.stoff.join(" und "), difficulty: p.difficulty, category: skillId ? kategorien[i] : "offen", subject: test.subject, wortarten, grade },
        rng,
        k,
      );
      if (!keys.has(taskKey(c)) && !gesehen.has(c.prompt)) {
        t = c;
        break;
      }
      t ??= c;
    }
    if (!skillId || !hasBuiltInGenerator(skillId)) ohneKi++;
    keys.add(taskKey(t!));
    drafts[i] = { ...t!, skillId, skillIds: skillId ? p.skillIds.filter((id) => all.has(id)) : [], sourceType: "eigen" };
  });

  const einheiten = [...new Set(plaetze.map((p) => p.einheit).filter(Boolean))];
  const worksheetId = speichere(test, student, grade, {
    tasks: drafts.filter((d): d is TaskDraft => Boolean(d)),
    topic: (einheiten.length ? einheiten : [...new Set(skillIds.map((id) => all.get(id)!.area))]).join(", "),
    source: ersetzt < plaetze.length ? "ki" : "generator",
    skillIds,
    teacherId: input.teacherId,
    // stoff: die Zeilen jeder Aufgabe, in ihrer Reihenfolge
    settings: { useAI: true, focus: FOKUS_STOFF, dauer, vomStoff: true, stoff: plaetze.map((p) => p.stoff) },
  });
  return { worksheetId, aiError, ohneKi, stoff: { zeilen: stoffZeilenAnzahl(zeilen), aufgaben: plaetze.length, ersetzt } };
}

/**
 * Der Aufgabentyp eines Platzes vom Stoffzettel: wie bei der Fähigkeit (leichte Plätze kurz, schwere aufwendig). Mehrere
 * Zeilen derselben Fähigkeit bekommen ihren aufwendigen Typ (etwa einen Rechenweg), Zeilen verschiedener Themen in
 * Mathematik eine Sachaufgabe mit Teilfragen. Kommt dieselbe Zeile noch einmal, ein anderer Typ.
 */
function kategorieFuer(subject: string, p: StoffPlatz, typen: Set<string>, runde: number): string {
  if (p.stoff.length > 1 && p.skillIds.length !== 1 && typen.has("sachaufgabe")) return "sachaufgabe";
  const mix = typenFuerPlatz(
    mixFor(subject, p.skillIds[0] ?? null).filter((k) => typen.has(k)),
    p.stoff.length > 1 ? "schwer" : p.difficulty,
  );
  return mix[runde % mix.length] ?? "offen";
}
