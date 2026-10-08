/**
 * What the teacher's student tablet shows, and the live status the teacher sees on the laptop.
 * Uses the same realtime hub as the whiteboard, on two more channels:
 *   "geraet:<teacher id>"  – the tablet(s) of a teacher; any event makes the tablet reload its view
 *   "einheit:<unit id>"    – the live status on the teacher's unit page
 *   "laptop:<session id>"  – a student's own laptop, connected for one unit (lib/laptop.ts)
 *
 * What the student sees is kept per unit (units.device_view). It is shown on the teacher's tablet, or,
 * while a laptop is confirmed for the unit, on that laptop instead (the tablet then only offers the board).
 */
import { aiLiveState, type AILive } from "./ai/realtime";
import { db } from "./db";
import { hasDevice } from "./devices";
import { activeLaptop, endLaptopsOfUnit, laptopChannel, openLaptopCode, pendingLaptop } from "./laptop";
import * as repo from "./repo";
import { getText, noteTextInUnit } from "./texts";
import { activeUnitForTeacher, getUnit, runningUnitForStudent, type UnitView } from "./units";
import { isOnline, publish } from "./whiteboard-hub";

export const deviceChannel = (teacherId: number) => `geraet:${teacherId}`;
export const unitChannel = (unitId: number) => `einheit:${unitId}`;

export type View = { kind: "start" } | { kind: "tafel" } | { kind: "aufgabe"; assignmentId: number } | { kind: "text"; textId: number };

export function parseView(raw: string): View {
  if (raw === "tafel") return { kind: "tafel" };
  const m = /^aufgabe:(\d+)$/.exec(raw);
  if (m) return { kind: "aufgabe", assignmentId: Number(m[1]) };
  const t = /^text:(\d+)$/.exec(raw);
  return t ? { kind: "text", textId: Number(t[1]) } : { kind: "start" };
}
const viewText = (v: View) => (v.kind === "tafel" ? "tafel" : v.kind === "aufgabe" ? `aufgabe:${v.assignmentId}` : v.kind === "text" ? `text:${v.textId}` : "");

/** May the tablet of this unit show that text? Only texts of the unit's student. */
export function unitText(unit: Pick<UnitView, "student_id">, textId: number) {
  const t = getText(textId);
  return t && t.student_id === unit.student_id ? t : null;
}

/** Exercises sent in this unit: the only ones the tablet may show. */
export function unitAssignments(unitId: number) {
  return db()
    .prepare(
      `SELECT a.*, w.title, w.source_task_id,
        (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = w.id) AS task_count,
        (SELECT COUNT(DISTINCT task_id) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1) AS done_count,
        (SELECT COUNT(*) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1 AND x.correct = 1) AS correct_count
       FROM assignments a JOIN worksheets w ON w.id = a.worksheet_id
       JOIN units u ON u.id = a.unit_id
       WHERE a.unit_id = ? AND a.student_id = u.student_id ORDER BY a.id`,
    )
    .all(unitId) as (repo.Assignment & { title: string; source_task_id: number | null; task_count: number; done_count: number; correct_count: number })[];
}

export function unitAssignment(unitId: number, assignmentId: number) {
  return unitAssignments(unitId).find((a) => a.id === assignmentId) ?? null;
}

export function markDelivered(assignmentId: number) {
  const res = db().prepare("UPDATE assignments SET delivered_at = datetime('now') WHERE id = ? AND delivered_at IS NULL").run(assignmentId);
  return res.changes > 0;
}

/** Is a tablet of this teacher connected right now? */
export function tabletOnline(teacherId: number) {
  return isOnline(deviceChannel(teacherId), "schueler");
}

export type StudentDevice = "laptop" | "tablet";
export type Delivery = ({ status: "gesendet" } | { status: "offline" } | { status: "kein-geraet" }) & { device?: StudentDevice };

/** Where the student of this unit works: their confirmed laptop, else the teacher's tablet, else nowhere yet. */
export function studentDevice(unit: Pick<UnitView, "id" | "teacher_id">): StudentDevice | null {
  if (activeLaptop(unit.id)) return "laptop";
  return hasDevice(unit.teacher_id) ? "tablet" : null;
}

/** Is the student's device of this unit connected right now? */
export function studentDeviceOnline(unit: Pick<UnitView, "id" | "teacher_id">): boolean {
  const l = activeLaptop(unit.id);
  return l ? laptopOnline(l.id) : tabletOnline(unit.teacher_id);
}

export function laptopOnline(sessionId: number) {
  return isOnline(laptopChannel(sessionId), "schueler");
}

/** Tells the confirmed laptop of a unit to load its view again. */
export function notifyLaptop(unitId: number, reason: string) {
  const l = activeLaptop(unitId);
  if (l) publish(laptopChannel(l.id), { type: "refresh", reason });
}

/** Both student screens of a unit load again: the teacher's tablet and a confirmed laptop. */
export function notifyStudent(unit: Pick<UnitView, "id" | "teacher_id">, reason: string) {
  notifyTablet(unit.teacher_id, reason);
  notifyLaptop(unit.id, reason);
}

/** Tells the teacher's tablet to load its view again (unit started or ended, new exercise, …). */
export function notifyTablet(teacherId: number, reason: string) {
  publish(deviceChannel(teacherId), { type: "refresh", reason });
}

/** Switches the tablet of the unit's teacher to `view`. Only for running units. */
export function showOnTablet(unit: UnitView, view: View): Delivery {
  if (unit.status !== "gestartet") return { status: "offline" };
  db().prepare("UPDATE units SET device_view = ? WHERE id = ?").run(viewText(view), unit.id);
  if (view.kind !== "aufgabe") progress.delete(unit.id);
  if (view.kind === "text") noteTextInUnit(view.textId, unit.id);
  notifyStudent(unit, view.kind);
  pushLive(unit.id);
  const laptop = activeLaptop(unit.id);
  if (laptop) return { status: laptopOnline(laptop.id) ? "gesendet" : "offline", device: "laptop" };
  if (!hasDevice(unit.teacher_id)) return { status: "kein-geraet" };
  return { status: tabletOnline(unit.teacher_id) ? "gesendet" : "offline", device: "tablet" };
}

/** Something was sent to a student the classic way (student picked): if a unit with them runs, it also goes onto that teacher's tablet. */
export function deliverIfRunning(studentId: number, assignmentId: number | undefined): Delivery | null {
  const unit = runningUnitForStudent(studentId);
  return unit && assignmentId ? showOnTablet(unit, { kind: "aufgabe", assignmentId }) : null;
}

/**
 * A unit started or ended: the tablet switches to it or back to "Bereit für die nächste Einheit".
 * When it ended, every laptop of the unit loses its access at once and is told so.
 */
export function unitChanged(teacherId: number, unitId: number) {
  progress.delete(unitId);
  if (getUnit(unitId)?.status !== "gestartet") for (const id of endLaptopsOfUnit(unitId)) publish(laptopChannel(id), { type: "ended", reason: "einheit" });
  notifyTablet(teacherId, "einheit");
  pushLive(unitId);
}

// ---------- progress reported by the tablet ----------

type Progress = { assignmentId: number; taskId: number; taskNo: number; total: number; since: string };
const g = globalThis as unknown as { __liveProgress?: Map<number, Progress> };
const progress = (g.__liveProgress ??= new Map());

export function noteProgress(unitId: number, p: Omit<Progress, "since">) {
  const old = progress.get(unitId);
  const same = old && old.assignmentId === p.assignmentId && old.taskId === p.taskId;
  progress.set(unitId, { ...p, since: same ? old.since : new Date().toISOString() });
  pushLive(unitId);
}

// ---------- live status for the teacher ----------

export type LiveSnapshot = {
  unitId: number;
  running: boolean;
  student: string;
  tablet: { paired: boolean; online: boolean };
  /** where the student works right now */
  device: StudentDevice | null;
  /** "Eigenes Gerät verbinden": the code on show, a request to confirm, the confirmed laptop */
  laptop: {
    code: { code: string; expiresAt: string } | null;
    request: { id: number; check: string; label: string; at: string } | null;
    active: { id: number; label: string; online: boolean; since: string } | null;
  };
  view: View["kind"];
  current: null | {
    assignmentId: number;
    title: string;
    single: boolean;
    taskNo: number;
    total: number;
    /** "bereit": sent while no tablet is paired (the student uses the link) */
    state: "nicht angekommen" | "bereit" | "arbeitet" | "fertig";
    since: string | null;
    tries: number;
    hints: number;
    /** pending: a free answer that waits for the teacher's grade */
    last: null | { correct: boolean; final: boolean; at: string; pending?: boolean };
    done: number;
    correct: number;
    solutionsVisible: boolean;
    hasNext: boolean;
  };
  /** the Textarbeit the tablet shows */
  text: null | { id: number; title: string; words: number; updatedAt: string; version: number };
  /** number of answers in this unit, so the page knows when to reload its result lists */
  answers: number;
  /** what the KI noticed last (lib/ai/realtime.ts) */
  ai: AILive;
};

/** SQLite's datetime('now') is UTC without a zone; browsers need it marked. */
const asIso = (t: string) => (t.includes("T") ? t : `${t.replace(" ", "T")}Z`);

export function liveSnapshot(unitId: number): LiveSnapshot | null {
  const unit = getUnit(unitId);
  if (!unit) return null;
  const view = parseView(unit.device_view);
  const list = unitAssignments(unit.id);
  const a = (view.kind === "aufgabe" && list.find((x) => x.id === view.assignmentId)) || list.at(-1) || null;
  const { answers } = db().prepare("SELECT COUNT(*) AS answers FROM attempts WHERE unit_id = ?").get(unit.id) as { answers: number };
  const paired = hasDevice(unit.teacher_id);
  const device = studentDevice(unit);
  const pending = pendingLaptop(unit.id);
  const laptop = activeLaptop(unit.id);
  const shownText = view.kind === "text" ? unitText(unit, view.textId) : null;
  const textNow = shownText ? { id: shownText.id, title: shownText.title, words: shownText.words, updatedAt: shownText.updated_at, version: shownText.version } : null;
  let current: LiveSnapshot["current"] = null;
  if (a) {
    const tasks = repo.listTasks(a.worksheet_id);
    const attempts = repo.listAttemptsForAssignment(a.id);
    const p = progress.get(unit.id);
    const live = p && p.assignmentId === a.id ? p : null;
    // without a report from the tablet: the first task that is not finished
    const fallback = tasks.findIndex((t) => !attempts.some((x) => x.task_id === t.id && x.final));
    const taskNo = live ? live.taskNo : fallback === -1 ? tasks.length : fallback + 1;
    const task = tasks[taskNo - 1];
    const tries = task ? attempts.filter((x) => x.task_id === task.id) : [];
    const lastTry = tries.at(-1);
    current = {
      assignmentId: a.id,
      title: a.title,
      single: a.source_task_id !== null,
      taskNo,
      total: tasks.length,
      state: a.completed_at ? "fertig" : a.delivered_at || attempts.length ? "arbeitet" : device ? "nicht angekommen" : "bereit",
      since: live?.since ?? null,
      tries: tries.length,
      hints: task ? new Set(repo.hintUsesForAssignment(a.id).filter((h) => h.task_id === task.id).map((h) => h.hint_index)).size : 0,
      last: lastTry ? { correct: Boolean(lastTry.correct), final: Boolean(lastTry.final), at: asIso(lastTry.created_at), pending: lastTry.review === "offen" } : null,
      done: a.done_count,
      correct: a.correct_count,
      solutionsVisible: Boolean(a.solutions_visible),
      hasNext: a.source_task_id !== null && nextTaskAfter(a.source_task_id) !== null,
    };
  }
  return {
    unitId: unit.id,
    running: unit.status === "gestartet",
    student: unit.student_name.split(" ")[0],
    tablet: { paired, online: tabletOnline(unit.teacher_id) },
    device,
    laptop: {
      code: unit.status === "gestartet" ? openLaptopCode(unit.id) : null,
      request: pending ? { id: pending.id, check: pending.check_code, label: pending.label, at: pending.created_at } : null,
      active: laptop ? { id: laptop.id, label: laptop.label, online: laptopOnline(laptop.id), since: laptop.approved_at ?? laptop.created_at } : null,
    },
    view: view.kind,
    current,
    text: textNow,
    answers,
    ai: aiLiveState(unit.id),
  };
}

/** Sends the current live status to the teacher's unit page. */
export function pushLive(unitId: number) {
  if (!isOnline(unitChannel(unitId))) return;
  const s = liveSnapshot(unitId);
  if (s) publish(unitChannel(unitId), { type: "live", snapshot: s });
}

/** The tablet came or went: every unit page of that teacher updates its "Tablet: verbunden". */
export function pushTabletPresence(teacherId: number) {
  const unit = activeUnitForTeacher(teacherId);
  if (unit) pushLive(unit.id);
}

/** The task after `taskId` in its exercise, for "Nächste Aufgabe senden". */
export function nextTaskAfter(taskId: number): repo.Task | null {
  const t = repo.getTask(taskId);
  if (!t) return null;
  return repo.listTasks(t.worksheet_id).find((x) => x.position > t.position) ?? null;
}
