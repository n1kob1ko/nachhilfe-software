/**
 * **Spiele testen** (niko 2026-11-17: „wie kann ich als Lehrer und Verwalter Spiele spielen und testen“): jede Lehrkraft
 * hat einen eigenen, unsichtbaren Test-Schüler (`students.spiele_test` = ihre Lehrer-ID). Mit ihm öffnet sie die
 * Schüler-App und spielt alle Lernspiele wie ein Kind, in der Klasse, die sie unter Mehr › Spiele testen wählt.
 *
 * Damit nichts davon zählt:
 * - Der Test-Schüler steht in keiner Liste (listStudents, Planung, Export), also auch nicht in Heute, Abrechnung,
 *   Einheiten, Tablet oder Statistik. Er hat keine Lehrkraft (`teacher_id` leer), damit er beim Löschen eines
 *   Lehrers nicht als dessen Schüler oder als Verlauf zählt.
 * - Liga und Duelle sind für ihn aus (`wettspiel = 'nein'`): in Bestenliste und Wochenliga sehen ihn die Kinder nie,
 *   er selbst sieht sich dort als „Du“.
 * - Sein Lernstand ist nur seiner; „Spielstand löschen“ setzt Rekorde und Serie zurück.
 */
import { db } from "./db";
import * as repo from "./repo";
import { SCHOOL_TYPES, schoolType, schulstufe } from "./school";

/** Die drei Fächer mit Lernspielen; der Test-Schüler hat immer alle. */
export const TEST_FAECHER = ["Mathematik", "Deutsch", "Englisch"];

export const istTestSchueler = (s: Pick<repo.Student, "spiele_test"> | null | undefined) => s?.spiele_test != null;

/** Der Name in der Schüler-App: „Niko Test“ (Avatar „NT“, Gruß „Hallo Niko!“). */
const testName = (lehrerName: string) => `${lehrerName.trim().split(/\s+/)[0] || "Lehrer"} Test`;

/** Der Test-Schüler dieser Lehrkraft, oder null, wenn sie noch keinen hat. */
export function testSchuelerVon(teacherId: number): repo.Student | null {
  const z = db().prepare("SELECT id FROM students WHERE spiele_test = ? ORDER BY id LIMIT 1").get(teacherId) as { id: number } | undefined;
  return z ? repo.getStudent(z.id) : null;
}

/** Schulart und Klasse, auf die Auswahl der Seite begrenzt; Unbekanntes wird 1. Klasse Gymnasium. */
export function testStufe(schulart: string, klasse: number): { school_type: string; klasse: number; grade: number } {
  const t = schoolType(schulart) ?? SCHOOL_TYPES.find((x) => x.name === "Gymnasium")!;
  const k = Math.max(1, Math.min(t.classes, Math.round(klasse) || 1));
  return { school_type: t.name, klasse: k, grade: schulstufe(t.name, k) };
}

/**
 * Legt den Test-Schüler an oder stellt ihn auf diese Klasse; immer alle drei Fächer, Liga und Duelle aus.
 * Gibt ihn zurück (mit dem Link-Token für die Schüler-App).
 */
export function testSchuelerEinstellen(lehrer: Pick<repo.Teacher, "id" | "name">, schulart: string, klasse: number): repo.Student {
  const stufe = testStufe(schulart, klasse);
  const da = testSchuelerVon(lehrer.id);
  const eingabe: repo.StudentInput = {
    name: testName(lehrer.name),
    ...stufe,
    teacher_id: null,
    school: "",
    subjects: TEST_FAECHER,
    current_topics: "",
    strengths_note: "",
    weaknesses_note: "",
    goals: "",
    notes: "Test-Schüler für „Spiele testen“. Zählt nirgends.",
  };
  const id = da ? (repo.updateStudent(da.id, { ...eingabe, current_topics: da.current_topics }), da.id) : repo.createStudent(eingabe);
  db().prepare("UPDATE students SET spiele_test = ?, wettspiel = 'nein', teacher_id = NULL WHERE id = ?").run(lehrer.id, id);
  return repo.getStudent(id)!;
}

/** Löscht alle Spielrunden des Test-Schülers: Rekorde, Serie, Endlos-Stände und sein Lernstand aus Spielen sind weg. */
export function testSpielstandLoeschen(teacherId: number): number {
  const s = testSchuelerVon(teacherId);
  if (!s) return 0;
  const conn = db();
  return conn.transaction(() => {
    const n = conn.prepare("DELETE FROM spielrunden WHERE student_id = ?").run(s.id).changes;
    conn.prepare("DELETE FROM spielprofile WHERE student_id = ?").run(s.id);
    return n;
  })();
}

/** Wie viele Runden der Test-Schüler bisher gespielt hat (beendet). */
export function testRunden(studentId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL").get(studentId) as { n: number }).n;
}
