/**
 * **Einheit aus Text übernehmen** (niko, 08.11.2026: „wie könnte ich das jetzt in die Software dokumentieren, damit es in
 * die Bewertung einfließt“). Die Lehrkraft fügt unter „Einheit nachtragen“ eine Zusammenfassung ein, z. B. aus einem
 * Claude-Chat. Die KI verteilt sie auf die Felder des Formulars: was gemacht wurde, jeder Fehler als eigene Zeile mit
 * Fähigkeit und Fehlerart, was gut lief, geübte Fähigkeiten, nächstes Mal und eine besprochene Prüfung mit Ergebnis.
 *
 * - Der Text geht **ohne Namen** an die KI (der Schüler, alle Lehrer und Schüler der App, erkannte Namen).
 * - Nichts wird gespeichert, bevor die Lehrkraft das ausgefüllte Formular prüft und auf „Speichern“ tippt. Dann entstehen
 *   die Einheit (wie beim Nachtragen von Hand), ihre **Erkenntnisse** (lib/erkenntnisse.ts) und, wenn angehakt, das
 *   Ergebnis der Prüfung.
 * - Ohne KI (aus, Budget, Grenze des Schülers) kommt der Text Zeile für Zeile unter „Was wurde gemacht?“.
 */
import { aiEnabled } from "./ai";
import { leseEinheitText } from "./ai/einheit-text";
import { KiFehler } from "./ai/grund";
import { budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { db, json } from "./db";
import { entwurfAusGelesen, MAX_TEXT, pruefungNotiz, regelEntwurf, type EinheitEntwurf, type EntwurfFehler, type EntwurfPruefung } from "./einheit-aus-text-regeln";
import { speichereErkenntnisse } from "./erkenntnisse";
import { skillsForPrompt } from "./lehrplan";
import { detectNames, namesAfterRelation } from "./name-detection";
import { wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import { maskText, namePattern } from "./text-correction-core";

export * from "./einheit-aus-text-regeln";

/** Ob die KI den Text jetzt lesen kann; sonst der Grund in einem Satz (dann teilt die App den Text selbst). */
export function einheitTextLesbar(studentId: number): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("einheit_text")) return { ok: false, grund: "Die KI ist gerade nicht eingerichtet." };
  if (budgetUsedUp("einheit_text")) return { ok: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht." };
  if (schuelerGestoppt("einheit_text", studentId)) return { ok: false, grund: grenzeErreichtText() };
  return { ok: true };
}

/** Der Text ohne Namen, mit seinen Zeilen: der Schüler, alle Lehrer und Schüler der App und jeder erkannte Name. */
export function textOhneNamen(text: string, studentName: string): string {
  const bekannt = (db().prepare("SELECT name FROM teachers UNION SELECT name FROM students").all() as { name: string }[]).map((r) => r.name);
  const namen = [...new Set([studentName, ...studentName.split(/\s+/).filter((t) => t.length >= 3), ...bekannt, ...detectNames([text]), ...namesAfterRelation([text])])].filter(Boolean);
  const muster = namePattern(namen);
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => maskText(l.replace(/[ \t]+/g, " ").trimEnd(), muster).masked)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Liest die Zusammenfassung und legt den Entwurf ab. Gibt seine id zurück und, wenn die KI nicht helfen konnte, einen
 * Satz dazu. Wirft nur bei leerem Text.
 */
export async function entwurfAusText(o: { studentId: number; teacherId: number | null; text: string }): Promise<{ id: number; hinweis: string | null }> {
  const student = repo.getStudent(o.studentId);
  if (!student) throw new Error("Diesen Schüler gibt es nicht.");
  const roh = o.text.trim();
  if (!roh) throw new Error("Bitte zuerst den Text einfügen.");
  const text = textOhneNamen(roh.slice(0, MAX_TEXT), student.name);
  let entwurf: EinheitEntwurf = regelEntwurf(text);
  let hinweis: string | null = roh.length > MAX_TEXT ? `Nur die ersten ${MAX_TEXT} Zeichen gelesen.` : null;
  const geht = einheitTextLesbar(student.id);
  if (!geht.ok) hinweis = `${geht.grund} Der Text steht Zeile für Zeile unter „Was wurde gemacht?“.`;
  else {
    const faecher = student.subjects.length ? student.subjects : ["Mathematik"];
    const skills = faecher.flatMap((f) => skillsForPrompt(student, f));
    const heute = wienerDatum();
    try {
      const gelesen = await leseEinheitText(text, { heute, faecher, skills }, { teacherId: o.teacherId, studentId: student.id, trigger: "einheit_text" });
      if (gelesen) entwurf = entwurfAusGelesen(gelesen, { faecher, erlaubt: new Set(skills.map((s) => s.id)), heute });
      else hinweis = "Die KI hat den Text nicht übernommen. Er steht Zeile für Zeile unter „Was wurde gemacht?“.";
    } catch (e) {
      hinweis = `${e instanceof KiFehler ? e.message : "Die KI hat nicht geantwortet."} Der Text steht Zeile für Zeile unter „Was wurde gemacht?“.`;
    }
  }
  const res = db()
    .prepare("INSERT INTO einheit_text_entwuerfe (student_id, teacher_id, text, entwurf) VALUES (?, ?, ?, ?)")
    .run(student.id, o.teacherId, text, JSON.stringify({ ...entwurf, hinweis }));
  return { id: Number(res.lastInsertRowid), hinweis };
}

export type GespeicherterEntwurf = { id: number; entwurf: EinheitEntwurf; hinweis: string | null; lessonId: number | null };

/** Ein Entwurf dieses Schülers, noch nicht gespeichert; sonst null. */
export function getEntwurf(id: number, studentId: number): GespeicherterEntwurf | null {
  const r = db().prepare("SELECT id, entwurf, lesson_id FROM einheit_text_entwuerfe WHERE id = ? AND student_id = ?").get(id, studentId) as { id: number; entwurf: string; lesson_id: number | null } | undefined;
  if (!r) return null;
  const e = json<(EinheitEntwurf & { hinweis?: string | null }) | null>(r.entwurf, null);
  if (!e) return null;
  const { hinweis = null, ...entwurf } = e;
  return { id: r.id, entwurf, hinweis, lessonId: r.lesson_id };
}

/** Die Prüfungen, zu denen ein besprochenes Ergebnis passen kann: im Fach, ohne Note, bis heute geschrieben. */
export function offenePruefungen(studentId: number, fach: string | null): repo.TestResult[] {
  const heute = wienerDatum();
  return repo.listTests(studentId).filter((t) => t.status !== "abgesagt" && t.grade == null && t.points == null && t.date <= heute && (!fach || t.subject === fach));
}

/**
 * Nach dem Speichern der Einheit (app/actions.ts saveLessonAction): die Erkenntnisse und, wenn angehakt, das Ergebnis der
 * Prüfung. Eine vorhandene Prüfung bekommt nur, was ihr fehlt; sonst entsteht eine neue mit dem angegebenen Datum.
 */
export function nachDemSpeichern(o: {
  entwurfId: number;
  studentId: number;
  lessonId: number;
  teacherId: number | null;
  subject: string;
  fehler: EntwurfFehler[];
  gut: string[];
  pruefung: (EntwurfPruefung & { testId: number | null; datum: string }) | null;
}): { erkenntnisse: number; testId: number | null } {
  const e = getEntwurf(o.entwurfId, o.studentId);
  if (!e || e.lessonId) return { erkenntnisse: 0, testId: null };
  const n = speichereErkenntnisse({
    studentId: o.studentId,
    subject: o.subject,
    teacherId: o.teacherId,
    quelle: "einheit",
    lessonId: o.lessonId,
    zeilen: [...o.fehler.map((f) => ({ art: "fehler" as const, text: f.text, skillId: f.skillId, fehlerart: f.fehlerart })), ...o.gut.map((text) => ({ art: "staerke" as const, text }))],
  });
  let testId: number | null = null;
  const p = o.pruefung;
  if (p && (p.punkte != null || p.note != null)) {
    const notiz = pruefungNotiz(p);
    const vorhanden = p.testId ? repo.listTests(o.studentId).find((t) => t.id === p.testId) : undefined;
    if (vorhanden) {
      db()
        .prepare("UPDATE tests SET grade = COALESCE(grade, ?), points = COALESCE(points, ?), max_points = COALESCE(max_points, ?), notes = CASE WHEN notes = '' THEN ? ELSE notes || char(10) || ? END, status = 'geschrieben' WHERE id = ?")
        .run(p.note, p.punkte, p.max, notiz, notiz, vorhanden.id);
      testId = vorhanden.id;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(p.datum)) {
      testId = repo.addTest({ student_id: o.studentId, date: p.datum, subject: o.subject, kind: p.art || "Schularbeit", topic: "", grade: p.note, points: p.punkte, max_points: p.max, notes: notiz, skill_ids: [], status: "geschrieben" });
    }
    if (testId) db().prepare("UPDATE erkenntnisse SET test_id = ? WHERE lesson_id = ?").run(testId, o.lessonId);
  }
  db().prepare("UPDATE einheit_text_entwuerfe SET lesson_id = ? WHERE id = ?").run(o.lessonId, e.id);
  return { erkenntnisse: n, testId };
}
