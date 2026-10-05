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
  subject: string;
  status: UnitStatus;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  end_reason: string;
  /** '' while running, 'lehrer' when a teacher ended it, 'automatisch' after inactivity */
  ended_by: "" | "lehrer" | "automatisch";
  ended_by_teacher_id: number | null;
  /** 1 when the end time was not observed but estimated (automatic end) */
  end_estimated: number;
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

/** Running units, with the number of exercises the student has not finished yet. */
export function runningUnits(teacherId?: number): (UnitView & { open_exercises: number })[] {
  return db()
    .prepare(
      `SELECT v.*, (SELECT COUNT(*) FROM assignments a WHERE a.student_id = v.student_id AND a.completed_at IS NULL) AS open_exercises
       FROM (${VIEW} WHERE u.status = 'gestartet' AND (@t IS NULL OR u.teacher_id = @t)) v ORDER BY v.started_at`,
    )
    .all({ t: teacherId ?? null }) as (UnitView & { open_exercises: number })[];
}

export type StartResult = { unit: UnitView; created: boolean };

/**
 * Starts a unit. A student never has two running units: if one is already running (started by
 * this or another teacher, in another tab, or a moment ago by a double click) it is returned with
 * created = false and nothing is written. The partial unique index idx_units_running guarantees
 * this even for two requests arriving at the same time.
 */
export function startUnit(teacherId: number, studentId: number, opts: { at?: number; subject?: string } = {}): StartResult {
  const at = opts.at ?? Date.now();
  const running = runningUnitForStudent(studentId);
  if (running) return { unit: running, created: false };
  try {
    const res = db()
      .prepare("INSERT INTO units (teacher_id, student_id, subject, status, started_at, last_activity_at) VALUES (?, ?, ?, 'gestartet', ?, ?)")
      .run(teacherId, studentId, opts.subject ?? "", iso(at), iso(at));
    return { unit: getUnit(Number(res.lastInsertRowid))!, created: true };
  } catch (e) {
    const again = (e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE" ? runningUnitForStudent(studentId) : null;
    if (again) return { unit: again, created: false };
    throw e;
  }
}

/** Marks activity (an answer, a teacher action) so the unit is not closed as idle. */
export function touchUnit(id: number, at = Date.now()) {
  db().prepare("UPDATE units SET last_activity_at = MAX(last_activity_at, ?) WHERE id = ? AND status = 'gestartet'").run(iso(at), id);
}

export type FinishOptions = {
  at?: number;
  reason?: string;
  /** the teacher who ended it; omitted for an automatic end */
  byTeacherId?: number | null;
  /** true when `at` is an estimate rather than the moment someone pressed "beenden" */
  estimated?: boolean;
};

/** Closes a running unit. Already closed units are left as they are. */
export function finishUnit(id: number, status: "beendet" | "abgebrochen", o: FinishOptions = {}): UnitView | null {
  const auto = o.byTeacherId == null;
  db()
    .prepare(
      `UPDATE units SET status = ?, ended_at = ?, end_reason = ?, ended_by = ?, ended_by_teacher_id = ?, end_estimated = ?
       WHERE id = ? AND status = 'gestartet'`,
    )
    .run(status, iso(o.at ?? Date.now()), o.reason ?? "", auto ? "automatisch" : "lehrer", o.byTeacherId ?? null, o.estimated ? 1 : 0, id);
  return getUnit(id);
}

/** Only the teacher of a unit and admins may end or change it. */
export function canManageUnit(teacher: { id: number; is_admin: number | boolean }, unit: Pick<Unit, "teacher_id">) {
  return unit.teacher_id === teacher.id || Boolean(teacher.is_admin);
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
