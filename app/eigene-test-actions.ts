"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import type { TestErgebnis } from "@/lib/eigene-tests";
import { eigenerTest } from "@/lib/eigene-tests-liste";
import { abgeben, darfTest, ergebnisVon, freigeben, getAbgabe, setzeLehrer, setzeSelbst, zuruecknehmen } from "@/lib/eigene-tests-speicher";
import * as repo from "@/lib/repo";

// ---------- Schülerseite (lib/eigene-tests.ts): der geheime Link ist der Schlüssel ----------

export type AbgabeAntwort = { abgabeId: number; ergebnis: TestErgebnis } | { fehler: string };

/** Gibt den Test ab: der Server prüft und schickt erst jetzt Lösungen und Punkte. */
export async function testAbgebenAction(token: string, key: string, antworten: unknown, sekunden: number | null): Promise<AbgabeAntwort> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  const test = eigenerTest(String(key));
  if (!test || !darfTest(student, test.key)) return { fehler: "Diesen Test gibt es für dich gerade nicht." };
  const a = abgeben(student.id, test, antworten, sekunden);
  revalidatePath(`/lernen/${token}`);
  revalidatePath(`/schueler/${student.id}`);
  return { abgabeId: a.id, ergebnis: ergebnisVon(a)! };
}

/** Der Schüler gibt sich mit der Musterlösung Punkte für eine offene Frage. */
export async function testSelbstAction(token: string, abgabeId: number, frage: string, punkte: number): Promise<AbgabeAntwort> {
  const student = repo.getStudentByToken(token);
  if (!student) return { fehler: "Dieser Link gilt nicht mehr." };
  try {
    setzeSelbst(Number(abgabeId), student.id, String(frage), Number(punkte));
  } catch (e) {
    return { fehler: (e as Error).message };
  }
  const a = getAbgabe(Number(abgabeId))!;
  revalidatePath(`/schueler/${student.id}`);
  return { abgabeId: a.id, ergebnis: ergebnisVon(a)! };
}

// ---------- Lehrkraft ----------

/** Schaltet einen Test für den Schüler frei oder nimmt ihn zurück (die Abgaben bleiben). */
export async function testFreigabeAction(studentId: number, key: string, an: boolean) {
  const teacher = await requireTeacher();
  if (!repo.getStudent(studentId)) return;
  if (an) freigeben(studentId, key, teacher.id);
  else zuruecknehmen(studentId, key);
  revalidatePath(`/schueler/${studentId}`);
}

/** Punkte der Lehrkraft für eine offene Frage; leer nimmt sie zurück (dann gilt die Selbstbewertung). */
export async function testLehrerPunkteAction(abgabeId: number, frage: string, punkte: number | null): Promise<{ fehler?: string }> {
  await requireTeacher();
  try {
    setzeLehrer(Number(abgabeId), String(frage), punkte === null ? null : Number(punkte));
  } catch (e) {
    return { fehler: (e as Error).message };
  }
  const a = getAbgabe(Number(abgabeId));
  if (a) revalidatePath(`/schueler/${a.student_id}`);
  return {};
}
