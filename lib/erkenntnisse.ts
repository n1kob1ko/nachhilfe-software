/**
 * **Erkenntnisse** (niko, 08.11.2026): was die Lehrkraft über einen Schüler herausgefunden hat, je Fehlermuster oder Stärke
 * eine Zeile, z. B. „Bestimmt den Fall über den Begleiter statt über die Frage“. Sie kommen aus einer eingefügten
 * Zusammenfassung (lib/einheit-aus-text.ts) und später aus einer eingelesenen Schularbeit. Offene Fehler-Erkenntnisse
 * sind der Schwerpunkt des nächsten Übungspakets; ist ein Fehler behoben, setzt die Lehrkraft sie auf erledigt.
 */
import { db } from "./db";
import type { ErrorType } from "./error-types";

export type ErkenntnisArt = "fehler" | "staerke";
export type ErkenntnisQuelle = "einheit" | "blatt" | "paket";
export type ErkenntnisStatus = "offen" | "erledigt";
export type Erkenntnis = {
  id: number;
  student_id: number;
  subject: string;
  art: ErkenntnisArt;
  text: string;
  skill_id: string | null;
  error_type: ErrorType | null;
  quelle: ErkenntnisQuelle;
  lesson_id: number | null;
  worksheet_id: number | null;
  test_id: number | null;
  status: ErkenntnisStatus;
  created_at: string;
  erledigt_at: string | null;
};

export type NeueErkenntnis = { art: ErkenntnisArt; text: string; skillId?: string | null; fehlerart?: ErrorType | null };

/** Speichert die Erkenntnisse einer Quelle; leere und doppelte Zeilen fallen weg. Gibt die Anzahl zurück. */
export function speichereErkenntnisse(o: {
  studentId: number;
  subject: string;
  teacherId: number | null;
  quelle: ErkenntnisQuelle;
  lessonId?: number | null;
  worksheetId?: number | null;
  testId?: number | null;
  zeilen: NeueErkenntnis[];
}): number {
  const insert = db().prepare(
    `INSERT INTO erkenntnisse (student_id, subject, art, text, skill_id, error_type, quelle, lesson_id, worksheet_id, test_id, teacher_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const gesehen = new Set<string>();
  let n = 0;
  db().transaction(() => {
    for (const z of o.zeilen) {
      const text = z.text.replace(/\s+/g, " ").trim().slice(0, 300);
      const key = `${z.art}|${text.toLowerCase()}`;
      if (!text || gesehen.has(key)) continue;
      gesehen.add(key);
      insert.run(o.studentId, o.subject, z.art, text, z.skillId ?? null, z.art === "fehler" ? (z.fehlerart ?? null) : null, o.quelle, o.lessonId ?? null, o.worksheetId ?? null, o.testId ?? null, o.teacherId);
      n++;
    }
  })();
  return n;
}

/** Die Erkenntnisse eines Schülers, die neuesten zuerst; wahlweise nur eines Fachs oder eines Status. */
export function listErkenntnisse(studentId: number, o: { subject?: string; status?: ErkenntnisStatus; art?: ErkenntnisArt } = {}): Erkenntnis[] {
  const where = ["student_id = ?"];
  const args: unknown[] = [studentId];
  if (o.subject) (where.push("subject = ?"), args.push(o.subject));
  if (o.status) (where.push("status = ?"), args.push(o.status));
  if (o.art) (where.push("art = ?"), args.push(o.art));
  return db().prepare(`SELECT * FROM erkenntnisse WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC`).all(...args) as Erkenntnis[];
}

/** Die Erkenntnisse aus einer dokumentierten Einheit. */
export function erkenntnisseDerEinheit(lessonId: number): Erkenntnis[] {
  return db().prepare("SELECT * FROM erkenntnisse WHERE lesson_id = ? ORDER BY id").all(lessonId) as Erkenntnis[];
}

/** Setzt eine Erkenntnis auf offen oder erledigt, nur beim eigenen Schüler. */
export function setzeErkenntnisStatus(id: number, studentId: number, status: ErkenntnisStatus) {
  db()
    .prepare("UPDATE erkenntnisse SET status = ?, erledigt_at = CASE WHEN ? = 'erledigt' THEN datetime('now') ELSE NULL END WHERE id = ? AND student_id = ?")
    .run(status, status, id, studentId);
}
