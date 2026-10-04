/**
 * Units (Nachhilfeeinheiten) = Basis-Dokumentation.
 * A row is written the moment a logged-in teacher starts working with a student and is closed
 * when the unit ends ("beendet") or is abandoned ("abgebrochen"). It never depends on the teacher
 * filling in anything later; the pedagogical documentation lives in `lessons` (see lib/learning.ts).
 */
import { db } from "./db";

export type UnitStatus = "gestartet" | "beendet" | "abgebrochen";
export type Unit = {
  id: number;
  teacher_id: number;
  student_id: number;
  status: UnitStatus;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  end_reason: string;
};
export type UnitView = Unit & { teacher_name: string; student_name: string };

const VIEW = `SELECT u.*, t.name AS teacher_name, s.name AS student_name FROM units u
  JOIN teachers t ON t.id = u.teacher_id JOIN students s ON s.id = u.student_id`;

const iso = (ms = Date.now()) => new Date(ms).toISOString();

export function getUnit(id: number): UnitView | null {
  return (db().prepare(`${VIEW} WHERE u.id = ?`).get(id) as UnitView | undefined) ?? null;
}

export function runningUnitForStudent(studentId: number): UnitView | null {
  return (db().prepare(`${VIEW} WHERE u.student_id = ? AND u.status = 'gestartet' ORDER BY u.started_at DESC LIMIT 1`).get(studentId) as UnitView | undefined) ?? null;
}

export function runningUnits(teacherId?: number): UnitView[] {
  return db()
    .prepare(`${VIEW} WHERE u.status = 'gestartet' AND (@t IS NULL OR u.teacher_id = @t) ORDER BY u.started_at`)
    .all({ t: teacherId ?? null }) as UnitView[];
}

/** Starts a unit, or returns the one already running for this student. */
export function startUnit(teacherId: number, studentId: number, at = Date.now()): UnitView {
  const running = runningUnitForStudent(studentId);
  if (running) return running;
  const res = db()
    .prepare("INSERT INTO units (teacher_id, student_id, status, started_at, last_activity_at) VALUES (?, ?, 'gestartet', ?, ?)")
    .run(teacherId, studentId, iso(at), iso(at));
  return getUnit(Number(res.lastInsertRowid))!;
}

/** Marks activity (an answer, a teacher action) so the unit is not closed as idle. */
export function touchUnit(id: number, at = Date.now()) {
  db().prepare("UPDATE units SET last_activity_at = MAX(last_activity_at, ?) WHERE id = ? AND status = 'gestartet'").run(iso(at), id);
}

export function finishUnit(id: number, status: "beendet" | "abgebrochen", reason = "", at = Date.now()): UnitView | null {
  db().prepare("UPDATE units SET status = ?, ended_at = ?, end_reason = ? WHERE id = ? AND status = 'gestartet'").run(status, iso(at), reason, id);
  return getUnit(id);
}

export type UnitFilter = { from?: string; to?: string; teacherId?: number | null; studentId?: number | null; status?: UnitStatus | null };
export function listUnits(f: UnitFilter = {}): UnitView[] {
  return db()
    .prepare(
      `${VIEW} WHERE (@from IS NULL OR u.started_at >= @from) AND (@to IS NULL OR u.started_at < @to)
        AND (@teacherId IS NULL OR u.teacher_id = @teacherId) AND (@studentId IS NULL OR u.student_id = @studentId)
        AND (@status IS NULL OR u.status = @status)
       ORDER BY u.started_at DESC`,
    )
    .all({ from: f.from ?? null, to: f.to ?? null, teacherId: f.teacherId || null, studentId: f.studentId || null, status: f.status ?? null }) as UnitView[];
}

export function unitDurationMs(u: Pick<Unit, "started_at" | "ended_at">, now = Date.now()) {
  return Math.max(0, (u.ended_at ? Date.parse(u.ended_at) : now) - Date.parse(u.started_at));
}
