/**
 * Eigene Tests in der Datenbank (lib/eigene-tests.ts): Freigabe je Schüler, Abgaben und die Punkte der offenen Fragen.
 * Die Punkte stehen nicht in der Tabelle; sie kommen jedes Mal frisch aus den Antworten (bewerteTest), damit eine
 * berichtigte Lösung auch für alte Abgaben gilt.
 */
import { db, json } from "./db";
import type * as repo from "./repo";
import { istTestSchueler } from "./spiele-testen";
import { alleFragen, bewerteTest, saubereAntworten, type Antworten, type EigenerTest, type TestErgebnis } from "./eigene-tests";
import { EIGENE_TESTS, eigenerTest } from "./eigene-tests-liste";

export type Abgabe = {
  id: number;
  student_id: number;
  test: string;
  antworten: Antworten;
  /** Punkte der offenen Fragen, die der Schüler sich gegeben hat */
  selbst: Record<string, number>;
  /** … und die der Lehrkraft (gelten vor denen des Schülers) */
  lehrer: Record<string, number>;
  sekunden: number | null;
  created_at: string;
};
type Zeile = Omit<Abgabe, "antworten" | "selbst" | "lehrer"> & { antworten: string; selbst: string; lehrer: string };

const lies = (z: Zeile): Abgabe => ({ ...z, antworten: json<Antworten>(z.antworten, {}), selbst: json<Record<string, number>>(z.selbst, {}), lehrer: json<Record<string, number>>(z.lehrer, {}) });

// ---------- Freigabe ----------

export function freigeben(studentId: number, test: string, teacherId: number | null) {
  if (!eigenerTest(test)) throw new Error("Diesen Test gibt es nicht.");
  db().prepare("INSERT OR IGNORE INTO eigene_test_freigaben (student_id, test, teacher_id) VALUES (?, ?, ?)").run(studentId, test, teacherId);
}
export function zuruecknehmen(studentId: number, test: string) {
  db().prepare("DELETE FROM eigene_test_freigaben WHERE student_id = ? AND test = ?").run(studentId, test);
}
export const istFreigegeben = (studentId: number, test: string): boolean =>
  Boolean(db().prepare("SELECT 1 FROM eigene_test_freigaben WHERE student_id = ? AND test = ?").get(studentId, test));

/**
 * Die Tests, die der Schüler in seiner App sieht: nur freigeschaltete, in der Reihenfolge von EIGENE_TESTS. Der
 * Testschüler einer Lehrkraft (Mehr › Spiele testen, lib/spiele-testen.ts) sieht alle, zum Ausprobieren.
 */
export function testsFuer(student: Pick<repo.Student, "id" | "spiele_test">): EigenerTest[] {
  if (istTestSchueler(student)) return [...EIGENE_TESTS];
  const frei = new Set((db().prepare("SELECT test FROM eigene_test_freigaben WHERE student_id = ?").all(student.id) as { test: string }[]).map((r) => r.test));
  return EIGENE_TESTS.filter((t) => frei.has(t.key));
}
/** Darf der Schüler diesen Test machen? */
export const darfTest = (student: Pick<repo.Student, "id" | "spiele_test">, key: string): boolean => testsFuer(student).some((t) => t.key === key);

// ---------- Abgaben ----------

/** Speichert eine Abgabe; nimmt nur Antworten, die zu den Fragen passen. */
export function abgeben(studentId: number, test: EigenerTest, roh: unknown, sekunden: number | null): Abgabe {
  const antworten = saubereAntworten(test, roh);
  const s = typeof sekunden === "number" && Number.isFinite(sekunden) ? Math.max(0, Math.min(6 * 3600, Math.round(sekunden))) : null;
  const r = db().prepare("INSERT INTO eigene_test_abgaben (student_id, test, antworten, sekunden) VALUES (?, ?, ?, ?)").run(studentId, test.key, JSON.stringify(antworten), s);
  return getAbgabe(Number(r.lastInsertRowid))!;
}

export function getAbgabe(id: number): Abgabe | null {
  const z = db().prepare("SELECT * FROM eigene_test_abgaben WHERE id = ?").get(id) as Zeile | undefined;
  return z ? lies(z) : null;
}

/** Abgaben eines Schülers, die neueste zuerst; mit `test` nur die dieses Tests. */
export function abgabenVon(studentId: number, test?: string): Abgabe[] {
  const rows = (
    test
      ? db().prepare("SELECT * FROM eigene_test_abgaben WHERE student_id = ? AND test = ? ORDER BY id DESC").all(studentId, test)
      : db().prepare("SELECT * FROM eigene_test_abgaben WHERE student_id = ? ORDER BY id DESC").all(studentId)
  ) as Zeile[];
  return rows.map(lies);
}

const offeneFrage = (test: EigenerTest, frage: string) => alleFragen(test).find((f) => f.id === frage && f.art === "offen") as Extract<ReturnType<typeof alleFragen>[number], { art: "offen" }> | undefined;

function setzePunkte(spalte: "selbst" | "lehrer", a: Abgabe, frage: string, punkte: number | null) {
  const test = eigenerTest(a.test);
  const f = test && offeneFrage(test, frage);
  if (!f) throw new Error("Diese Frage gibt es nicht.");
  const werte = { ...a[spalte] };
  if (punkte === null) delete werte[frage];
  else {
    if (!Number.isInteger(punkte) || punkte < 0 || punkte > f.punkte) throw new Error(`Bitte 0 bis ${f.punkte} Punkte.`);
    werte[frage] = punkte;
  }
  db().prepare(`UPDATE eigene_test_abgaben SET ${spalte} = ? WHERE id = ?`).run(JSON.stringify(werte), a.id);
}
/** Der Schüler bewertet eine offene Frage mit der Musterlösung (nur seine eigene Abgabe). */
export function setzeSelbst(abgabeId: number, studentId: number, frage: string, punkte: number) {
  const a = getAbgabe(abgabeId);
  if (!a || a.student_id !== studentId) throw new Error("Diese Abgabe gibt es nicht.");
  setzePunkte("selbst", a, frage, punkte);
}
/** Die Lehrkraft setzt die Punkte einer offenen Frage; null nimmt ihre Bewertung zurück (dann gilt die des Schülers). */
export function setzeLehrer(abgabeId: number, frage: string, punkte: number | null) {
  const a = getAbgabe(abgabeId);
  if (!a) throw new Error("Diese Abgabe gibt es nicht.");
  setzePunkte("lehrer", a, frage, punkte);
}

/** Punkte, Lösungen und Note einer Abgabe; offene Fragen: Lehrkraft vor Schüler. */
export function ergebnisVon(a: Abgabe): TestErgebnis | null {
  const test = eigenerTest(a.test);
  if (!test) return null;
  return bewerteTest(test, a.antworten, { ...a.selbst, ...a.lehrer });
}
