/**
 * Eigene Vokabellisten: word lists the teacher writes for one student (Schüler › Übungen › Vokabellisten).
 * Stored as the text the teacher typed or pasted, read by lib/vokabeln.ts leseListe; the exercises of
 * the builder take their tasks from them (skill EIGENE_VOKABELN), never from the KI.
 */
import { db } from "./db";
import type { Difficulty, TaskType } from "./curriculum";
import { mixFor } from "./curriculum";
import * as repo from "./repo";
import type { Rng } from "./schulbuch-zahlen";
import type { TaskDraft } from "./tasks";
import { EIGENE_VOKABELN, kategorieFuerTyp, leseListe, vokabelAufgabenFuerPlaetze, type Quelle, type Vokabel } from "./vokabeln";
import { schluesselEn, teileDe } from "./vokabeln-pruefen";
import { LEXIKON } from "./vokabeln-themen";

export type VokabellisteRow = {
  id: number;
  student_id: number;
  teacher_id: number | null;
  title: string;
  text: string;
  created_at: string;
  updated_at: string;
};
export type Vokabelliste = VokabellisteRow & { woerter: number };

/** A title has at most this many characters. */
export const MAX_TITEL = 80;

const mitZahl = (r: VokabellisteRow): Vokabelliste => ({
  ...r,
  woerter: leseListe(r.text).eintraege.length,
});

/** The lists of one student, the newest first. */
export function listenVon(studentId: number): Vokabelliste[] {
  const rows = db().prepare("SELECT * FROM vokabellisten WHERE student_id = ? ORDER BY updated_at DESC, id DESC").all(studentId) as VokabellisteRow[];
  return rows.map(mitZahl);
}

export function getListe(id: number): Vokabelliste | null {
  const r = db().prepare("SELECT * FROM vokabellisten WHERE id = ?").get(id) as VokabellisteRow | undefined;
  return r ? mitZahl(r) : null;
}

export type Speichern = { ok: true; id: number } | { ok: false; fehler: string[] };

/** Saves a new list (no id) or changes one of the same student. Lines with errors stop saving. */
export function speichereListe(input: { id?: number | null; studentId: number; teacherId: number | null; title: string; text: string }): Speichern {
  const title = input.title.replace(/\s+/g, " ").trim();
  const text = input.text.replace(/\r\n?/g, "\n").trimEnd();
  const fehler: string[] = [];
  if (!title) fehler.push("Gib der Liste einen Namen, zum Beispiel „Unit 3“.");
  if (title.length > MAX_TITEL) fehler.push(`Der Name hat höchstens ${MAX_TITEL} Zeichen.`);
  const gelesen = leseListe(text);
  fehler.push(...gelesen.fehler.map((m) => m.text));
  if (!gelesen.fehler.length && !gelesen.eintraege.length) fehler.push("Schreib mindestens ein Wortpaar in die Liste, zum Beispiel: dog = der Hund");
  if (!repo.getStudent(input.studentId)) fehler.push("Diese Schülerin bzw. diesen Schüler gibt es nicht mehr.");
  if (fehler.length) return { ok: false, fehler };
  if (input.id) {
    const alt = getListe(input.id);
    if (!alt || alt.student_id !== input.studentId) return { ok: false, fehler: ["Diese Liste gibt es nicht mehr."] };
    db().prepare("UPDATE vokabellisten SET title = ?, text = ?, updated_at = datetime('now') WHERE id = ?").run(title, text, input.id);
    return { ok: true, id: input.id };
  }
  const r = db().prepare("INSERT INTO vokabellisten (student_id, teacher_id, title, text) VALUES (?, ?, ?, ?)").run(input.studentId, input.teacherId, title, text);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

export function loescheListe(id: number): void {
  db().prepare("DELETE FROM vokabellisten WHERE id = ?").run(id);
}

/**
 * The words of an exercise: the chosen lists of the student, in their order, each pair once. All lists of
 * the student when none is chosen, or when none of the chosen is the student's (a template made for
 * another student, a deleted list).
 */
export function vokabelQuelle(studentId: number, ids?: number[] | null): Quelle & { titel: string[] } {
  const alle = listenVon(studentId).reverse();
  const passend = (ids ?? []).map((id) => alle.find((l) => l.id === id)).filter((l): l is Vokabelliste => Boolean(l));
  const gewaehlt = passend.length ? passend : alle;
  const gesehen = new Set<string>();
  const eintraege: Vokabel[] = [];
  for (const l of gewaehlt) {
    for (const e of leseListe(l.text).eintraege) {
      const key = `${e.en.map((x) => schluesselEn(x)).join(";")}=${e.de.map((x) => teileDe(x).key).join(";")}`;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      eintraege.push(e);
    }
  }
  const student = repo.getStudent(studentId);
  return {
    eintraege,
    thema: false,
    lexikon: LEXIKON,
    vs: student?.school_type === "Volksschule",
    titel: gewaehlt.map((l) => l.title),
  };
}

/** Why no task can come from the lists, or null. */
export function ohneWoerter(studentId: number | null, ids?: number[] | null): string | null {
  if (!studentId) return "Eigene Vokabellisten gibt es nur in einer Übung für eine Schülerin oder einen Schüler.";
  if (!vokabelQuelle(studentId, ids).eintraege.length)
    return "Für diese Schülerin bzw. diesen Schüler gibt es noch keine Vokabelliste mit Wörtern. Leg eine im Profil unter Übungen › Vokabellisten an.";
  return null;
}

const fuerEigene = (out: { task: TaskDraft; category: string }): TaskDraft => ({
  ...out.task,
  skillId: EIGENE_VOKABELN,
  skillIds: [EIGENE_VOKABELN],
  category: out.category,
});

/**
 * Tasks from the lists for the places of an exercise (category and level each), in their order; null where
 * none fits (no word). A free answer has no task here: such a place gets a written vocabulary task (the
 * builder says so).
 */
export function eigeneFuerPlaetze(
  studentId: number,
  ids: number[] | null | undefined,
  plaetze: { category: string | null; difficulty: Difficulty }[],
  o: { rng?: Rng; avoid?: Iterable<string> } = {},
): (TaskDraft | null)[] {
  const q = vokabelQuelle(studentId, ids);
  if (!q.eintraege.length) return plaetze.map(() => null);
  const frei = (c: string | null) => Boolean(c && ["offen", "writing", "schreiben"].includes(c));
  const out = vokabelAufgabenFuerPlaetze(
    q,
    plaetze.map((p) => ({
      ...p,
      category: frei(p.category) ? "vocabulary" : p.category,
    })),
    { rng: o.rng, avoid: new Set(o.avoid ?? []) },
  );
  return out.map((x) => (x ? fuerEigene(x) : null));
}

/**
 * Tasks in an answer format, for the paths outside the builder (a recommendation, a new exercise during a
 * unit): "mixed" takes the types of the own lists in turn.
 */
export function eigeneVokabelAufgaben(
  studentId: number,
  o: {
    count: number;
    difficulty: Difficulty;
    taskType: TaskType | "mixed";
    avoid?: Iterable<string>;
    rng?: Rng;
  },
): TaskDraft[] {
  const rng = o.rng ?? Math.random;
  const mix = mixFor("Englisch", EIGENE_VOKABELN);
  const plaetze = Array.from({ length: o.count }, (_, i) => ({
    category: o.taskType === "mixed" ? mix[i % mix.length] : kategorieFuerTyp(o.taskType, rng),
    difficulty: o.difficulty,
  }));
  return eigeneFuerPlaetze(studentId, null, plaetze, {
    rng,
    avoid: o.avoid,
  }).filter((t): t is TaskDraft => Boolean(t));
}
