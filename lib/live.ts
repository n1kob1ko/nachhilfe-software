/**
 * What the teacher's student tablet shows, and the live status the teacher sees on the laptop.
 * Uses the same realtime hub as the whiteboard, on more channels:
 *   "geraet:<device id>"   – one tablet; any event makes it reload its view. A tablet belongs to a teacher
 *                            and shows the running unit (with two running: the one chosen on it, D26)
 *   "einheit:<unit id>"    – the live status on the teacher's unit page
 *   "laptop:<session id>"  – a student's own laptop, connected for one unit (lib/laptop.ts)
 * A presentation on the student device turns its slides with a "folie" event instead of a reload.
 *
 * What the student sees is kept per unit (units.device_view). It is shown on the teacher's tablet, or,
 * while a laptop is confirmed for the unit, on that laptop instead (the tablet then only offers the board).
 */
import { aiLiveState, type AILive } from "./ai/realtime";
import { db } from "./db";
import { chooseDeviceUnit, deviceUnit, devicesOfUnit, getDevice, hasDevice, listDevices } from "./devices";
import { activeLaptop, endLaptopsOfUnit, laptopChannel, openLaptopCode, pendingLaptop } from "./laptop";
import { isMinitest } from "./quick-round";
import * as repo from "./repo";
import { MAX_FOLIE } from "./praesentation-protokoll";
import { getText, noteTextInUnit } from "./texts";
import { getUnit, runningUnitForStudent, runningUnits, type UnitView } from "./units";
import { shortNames } from "./vornamen";
import { isOnline, publish } from "./whiteboard-hub";

export const deviceChannel = (deviceId: number) => `geraet:${deviceId}`;
export const unitChannel = (unitId: number) => `einheit:${unitId}`;

export type View =
  | { kind: "start" }
  | { kind: "tafel" }
  | { kind: "aufgabe"; assignmentId: number }
  | { kind: "text"; textId: number }
  // a presentation (lib/praesentationen.ts) at the teacher's slide; never with the Vortragstext
  | { kind: "praesentation"; id: number; folie: number };

export function parseView(raw: string): View {
  if (raw === "tafel") return { kind: "tafel" };
  const m = /^aufgabe:(\d+)$/.exec(raw);
  if (m) return { kind: "aufgabe", assignmentId: Number(m[1]) };
  const p = /^praesentation:(\d+):(\d+)$/.exec(raw);
  if (p) return { kind: "praesentation", id: Number(p[1]), folie: Math.min(MAX_FOLIE, Math.max(1, Number(p[2]))) };
  const t = /^text:(\d+)$/.exec(raw);
  return t ? { kind: "text", textId: Number(t[1]) } : { kind: "start" };
}
const viewText = (v: View) =>
  v.kind === "tafel" ? "tafel" : v.kind === "aufgabe" ? `aufgabe:${v.assignmentId}` : v.kind === "text" ? `text:${v.textId}` : v.kind === "praesentation" ? `praesentation:${v.id}:${v.folie}` : "";

/** May the tablet of this unit show that text? Only texts of the unit's student, and none that is archived. */
export function unitText(unit: Pick<UnitView, "student_id">, textId: number) {
  const t = getText(textId);
  return t && t.student_id === unit.student_id && !t.archived_at ? t : null;
}

/** Exercises sent in this unit and not archived: the only ones the tablet may show. */
export function unitAssignments(unitId: number) {
  return db()
    .prepare(
      `SELECT a.*, w.title, w.source_task_id,
        (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = w.id) AS task_count,
        (SELECT COUNT(DISTINCT task_id) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1) AS done_count,
        (SELECT COUNT(*) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1 AND x.correct = 1) AS correct_count
       FROM assignments a JOIN worksheets w ON w.id = a.worksheet_id
       JOIN units u ON u.id = a.unit_id
       WHERE a.unit_id = ? AND a.student_id = u.student_id AND ${repo.ASSIGNMENT_ARCHIVED} IS NULL ORDER BY a.id`,
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

/** Is this tablet connected right now? */
export function deviceOnline(deviceId: number) {
  return isOnline(deviceChannel(deviceId), "schueler");
}

/** Is a tablet that shows this unit connected right now? (With two running units only the tablets on this one count.) */
export function tabletOnline(unit: Pick<UnitView, "id" | "teacher_id">) {
  return devicesOfUnit(unit).some((d) => deviceOnline(d.id));
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
  return l ? laptopOnline(l.id) : tabletOnline(unit);
}

export function laptopOnline(sessionId: number) {
  return isOnline(laptopChannel(sessionId), "schueler");
}

/** Tells the confirmed laptop of a unit to load its view again. */
export function notifyLaptop(unitId: number, reason: string) {
  const l = activeLaptop(unitId);
  if (l) publish(laptopChannel(l.id), { type: "refresh", reason });
}

/** Both student screens of a unit load again: the tablet(s) showing it and a confirmed laptop. */
export function notifyStudent(unit: Pick<UnitView, "id" | "teacher_id">, reason: string) {
  notifyUnitTablets(unit, reason);
  notifyLaptop(unit.id, reason);
}

/** Every tablet of the teacher loads again (a unit started or ended: which unit a tablet shows may change). */
export function notifyTablet(teacherId: number, reason: string) {
  for (const d of listDevices(teacherId)) notifyDevice(d.id, reason);
}

/** Only the tablets that show this unit load again (new exercise, whiteboard, …): the other student's tablet stays as it is. */
export function notifyUnitTablets(unit: Pick<UnitView, "id" | "teacher_id">, reason: string) {
  for (const d of devicesOfUnit(unit)) notifyDevice(d.id, reason);
}

/** One tablet loads again (also a just disconnected one, which then finds its cookie no longer valid). */
export function notifyDevice(deviceId: number, reason: string) {
  publish(deviceChannel(deviceId), { type: "refresh", reason });
}

/** Switches the tablet(s) of this unit to `view`; a tablet on the teacher's other running unit is not touched. Only for running units. */
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
  return { status: tabletOnline(unit) ? "gesendet" : "offline", device: "tablet" };
}

/**
 * The teacher turned to another slide: the student device of the unit follows without reloading, but only
 * while it shows this presentation. The slide is kept in device_view, so a device that reconnects catches up.
 */
export function folieAmGeraet(unit: UnitView, praesId: number, folie: number, schritt: number | null = null): boolean {
  const v = parseView(unit.device_view);
  if (unit.status !== "gestartet" || v.kind !== "praesentation" || v.id !== praesId || !Number.isInteger(folie)) return false;
  const n = Math.min(MAX_FOLIE, Math.max(1, folie));
  if (n !== v.folie) db().prepare("UPDATE units SET device_view = ? WHERE id = ?").run(viewText({ ...v, folie: n }), unit.id);
  // the animation step on the slide only travels live; a device that reconnects starts the slide from the beginning
  const ev = { type: "folie", praesentation: praesId, folie: n, schritt: Number.isInteger(schritt) && schritt! >= 0 ? schritt : null };
  for (const d of devicesOfUnit(unit)) publish(deviceChannel(d.id), ev);
  const laptop = activeLaptop(unit.id);
  if (laptop) publish(laptopChannel(laptop.id), ev);
  pushLive(unit.id);
  return true;
}

/** „Erneut senden“: the running unit (of this teacher) the exercise was sent in, not the teacher's other one (D26). */
export function resendUnit(teacherId: number, assignmentId: number): UnitView | null {
  const unitId = repo.getAssignment(assignmentId)?.unit_id;
  const unit = unitId ? getUnit(unitId) : null;
  if (!unit || unit.status !== "gestartet" || unit.teacher_id !== teacherId || !unitAssignment(unit.id, assignmentId)) return null;
  return unit;
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
  // every tablet of the teacher: with a second unit starting or one of two ending, the unit a tablet shows changes
  notifyTablet(teacherId, "einheit");
  pushLive(unitId);
  pushTabletPresence(teacherId);
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
  /**
   * Zwei Schüler gleichzeitig (D26): both running units of the teacher and every tablet of the teacher with
   * the unit it shows (null: it asks „Wer arbeitet an diesem Gerät?“). Empty while only one unit runs.
   */
  parallel: { units: { id: number; student: string }[]; tablets: { id: number; name: string; online: boolean; unitId: number | null }[] };
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
    /** a Minitest (lib/minitest.ts): no hints, one try, no solutions to show */
    test: boolean;
    /** a Probeschularbeit (lib/probeschularbeit.ts): runs like a Minitest, named as such */
    probe?: boolean;
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
  /** the presentation the student device shows, at the teacher's slide */
  praesentation: null | { id: number; title: string; folie: number };
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
      test: isMinitest(a.mode),
      probe: Boolean(repo.getWorksheet(a.worksheet_id)?.probe_test_id),
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
    tablet: { paired, online: tabletOnline(unit) },
    parallel: parallelOf(unit),
    device,
    laptop: {
      code: unit.status === "gestartet" ? openLaptopCode(unit.id) : null,
      request: pending ? { id: pending.id, check: pending.check_code, label: pending.label, at: pending.created_at } : null,
      active: laptop ? { id: laptop.id, label: laptop.label, online: laptopOnline(laptop.id), since: laptop.approved_at ?? laptop.created_at } : null,
    },
    view: view.kind,
    current,
    text: textNow,
    praesentation: view.kind === "praesentation" ? praesentationNow(view.id, view.folie) : null,
    answers,
    ai: aiLiveState(unit.id),
  };
}

function praesentationNow(id: number, folie: number): LiveSnapshot["praesentation"] {
  const p = db().prepare("SELECT title FROM praesentationen WHERE id = ?").get(id) as { title: string } | undefined;
  return p ? { id, title: p.title, folie } : null;
}

/** With two running units of the teacher: both students and where each tablet is (for „Tablet für …“ on the unit page). */
function parallelOf(unit: UnitView): LiveSnapshot["parallel"] {
  const running = unit.status === "gestartet" ? runningUnits(unit.teacher_id) : [];
  if (running.length < 2) return { units: [], tablets: [] };
  const names = shortNames(running.map((u) => u.student_name));
  return {
    units: running.map((u, i) => ({ id: u.id, student: names[i] })),
    tablets: listDevices(unit.teacher_id).map((d) => ({ id: d.id, name: d.name, online: deviceOnline(d.id), unitId: deviceUnit(d).unit?.id ?? null })),
  };
}

/** Sends the current live status to the teacher's unit page. */
export function pushLive(unitId: number) {
  if (!isOnline(unitChannel(unitId))) return;
  const s = liveSnapshot(unitId);
  if (s) publish(unitChannel(unitId), { type: "live", snapshot: s });
}

/** A tablet came, went or changed its unit: every running unit page of that teacher updates its "Tablet verbunden". */
export function pushTabletPresence(teacherId: number) {
  for (const u of runningUnits(teacherId)) pushLive(u.id);
}

/**
 * Puts a tablet on one of its teacher's running units (D26), chosen on the tablet or by the teacher;
 * null asks „Wer arbeitet an diesem Gerät?“ again. The tablet reloads and both unit pages update.
 */
export function moveTablet(deviceId: number, unitId: number | null): boolean {
  const d = getDevice(deviceId);
  if (!d || !chooseDeviceUnit(deviceId, unitId)) return false;
  notifyDevice(deviceId, "einheit");
  pushTabletPresence(d.teacher_id);
  return true;
}

/** The task after `taskId` in its exercise, for "Nächste Aufgabe senden". */
export function nextTaskAfter(taskId: number): repo.Task | null {
  const t = repo.getTask(taskId);
  if (!t) return null;
  return repo.listTasks(t.worksheet_id).find((x) => x.position > t.position) ?? null;
}
