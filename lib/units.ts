/**
 * Units (Nachhilfeeinheiten) = Basis-Dokumentation.
 * A row is written the moment a logged-in teacher starts working with a student and is closed
 * when the unit ends ("beendet") or is abandoned ("abgebrochen"). It never depends on the teacher
 * filling in anything later; the pedagogical documentation lives in `lessons` (see lib/learning.ts).
 *
 * Seit Phase 4 (D17) verknüpft sich eine gestartete Einheit mit dem passenden **Wochenplan-Platz**
 * des Tages (`verknuepfeMitHeutigemPlatz`); der Platz bleibt die Soll-Seite, die Einheit die
 * Ist-Seite. Eine Einheit ohne Platz läuft wie bisher ungeplant.
 */
import { db } from "./db";
import { offenePlaetzeHeute } from "./planung/heute";
import { einheitenFuerWoche, verknuepfePlatz, type GeplanteEinheitZeile } from "./planung/repo";
import { wienerDatum, wochenstartVon } from "./planung/zeit";

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
  /** what the teacher's student tablet shows: '' overview, 'tafel', 'aufgabe:<assignment id>' */
  device_view: string;
};
export type UnitView = Unit & { teacher_name: string; student_name: string };

const VIEW = `SELECT u.*, t.name AS teacher_name, s.name AS student_name FROM units u
  JOIN teachers t ON t.id = u.teacher_id JOIN students s ON s.id = u.student_id`;

const iso = (ms = Date.now()) => new Date(ms).toISOString();

export function getUnit(id: number): UnitView | null {
  return (db().prepare(`${VIEW} WHERE u.id = ?`).get(id) as UnitView | undefined) ?? null;
}

/** Das Fach der Einheit, wie der Lehrer es in der Dokumentation einträgt (jedes Fach, auch einmalig). */
export function setUnitSubject(id: number, subject: string) {
  db().prepare("UPDATE units SET subject = ? WHERE id = ?").run(subject, id);
}

export function runningUnitForStudent(studentId: number): UnitView | null {
  return (db().prepare(`${VIEW} WHERE u.student_id = ? AND u.status = 'gestartet' ORDER BY u.started_at DESC LIMIT 1`).get(studentId) as UnitView | undefined) ?? null;
}

/**
 * Wohin „An Anna senden“ geht (D26: ein Lehrer kann zwei Einheiten zugleich haben). Läuft beim Lehrer
 * eine Einheit mit dem Schüler der Übung, ist es genau diese. Sonst kommen alle laufenden Einheiten
 * des Lehrers in Frage: bei einer ist es diese (wie bisher), bei zweien wählt der Lehrer per Knopf.
 * Nie „die zuletzt gestartete“: das schickte die Übung von Schüler 2 an Schüler 1.
 */
export function sendTargets(teacherId: number, studentId: number | null | undefined): UnitView[] {
  const mine = runningUnits(teacherId);
  const own = studentId ? mine.find((u) => u.student_id === studentId) : undefined;
  return own ? [own] : mine;
}

/**
 * The running unit one send goes to: the unit named by the button (`pickedUnitId`), else the unit of the
 * exercise's student, else the teacher's only running unit. Only the teacher's own running units. With
 * two running units and nothing to go by there is no guess.
 */
export function unitForSend(teacherId: number, pickedUnitId: number | null, studentId: number | null): UnitView | { error: string } {
  if (pickedUnitId) {
    const unit = getUnit(pickedUnitId);
    if (!unit || unit.status !== "gestartet" || unit.teacher_id !== teacherId) return { error: "Diese Einheit läuft nicht mehr." };
    return unit;
  }
  const targets = sendTargets(teacherId, studentId);
  if (targets.length === 0) return { error: "Gerade läuft keine Einheit." };
  if (targets.length > 1) return { error: "Gerade laufen zwei Einheiten. Wähle, an wen." };
  return targets[0];
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
 * D17: Die gestartete Einheit verknüpft sich mit ihrem heutigen **veröffentlichten** Wochenplan-Platz.
 *
 * Die Regel ist genau die des Plans: gesucht wird unter den offenen Plätzen des Tages
 * (`offenePlaetzeHeute`, also ohne `unit_id`) zuerst beim **selben Lehrer**; gibt es dort keinen,
 * kommt der Platz eines anderen Lehrers in Frage. Innerhalb der Auswahl gewinnt die Startzeit, die
 * „jetzt“ am nächsten liegt (`lib/planung/heute.ts`, Europe/Vienna). Findet sich kein Platz, läuft
 * die Einheit ungeplant wie bisher.
 *
 * Ein Platz wird **einmal** vergeben: sobald `unit_id` gesetzt ist, bietet `offenePlaetzeHeute` ihn
 * nicht mehr an, ein zweiter Start verknüpft ihn also nie erneut.
 *
 * @returns die Id des verknüpften Platzes oder null, wenn keiner passte.
 */
export function verknuepfeMitHeutigemPlatz(unit: Pick<Unit, "id" | "student_id" | "teacher_id">, at = Date.now()): number | null {
  const now = new Date(at);
  const eigener = offenePlaetzeHeute(unit.student_id, { teacherId: unit.teacher_id, now })[0];
  const platz = eigener ?? offenePlaetzeHeute(unit.student_id, { now })[0];
  if (!platz) return null;
  return verknuepfePlatz(platz.id, unit.id).ok ? platz.id : null;
}

/**
 * Der Wochenplan-Platz, mit dem sich diese Einheit verknüpft hat — die **geplante Dauer** für
 * „geplant 100 min · tatsächlich 85 min“ (D16) auf der Einheitenseite. Ohne Verknüpfung null.
 */
export function platzFuerEinheit(unit: Pick<Unit, "id" | "started_at">): GeplanteEinheitZeile | null {
  const woche = wochenstartVon(wienerDatum(new Date(unit.started_at)));
  return einheitenFuerWoche(woche, { status: "alle" }).find((z) => z.unit_id === unit.id) ?? null;
}

/**
 * Starts a unit. A student never has two running units: if one is already running (started by
 * this or another teacher, in another tab, or a moment ago by a double click) it is returned with
 * created = false and nothing is written — and nothing is linked either, so a second start can
 * never take a second planned slot (D17). The partial unique index idx_units_running guarantees
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
    const unit = getUnit(Number(res.lastInsertRowid))!;
    // D17: die Einheit nimmt sich ihren heutigen Platz im Wochenplan, wenn es einen gibt
    verknuepfeMitHeutigemPlatz(unit, at);
    return { unit, created: true };
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
  // an ended unit frees the tablets chosen for it (D26); lib/devices.ts `deviceUnit` checks it anyway
  db().prepare("UPDATE student_devices SET unit_id = NULL WHERE unit_id = ?").run(id);
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
