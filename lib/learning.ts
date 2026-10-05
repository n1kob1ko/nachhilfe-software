/**
 * Lern-Dokumentation of a unit: everything the student did during the unit is collected from
 * the attempts (attempts.unit_id), turned into a UnitReport and a readable summary, and stored
 * on the lesson row of the unit when the unit ends. The teacher then completes it.
 *
 * The report is stored as JSON with a version so later analyses (statistics, AI recommendations)
 * can read old units without recomputing them.
 */
import { WEAK, STRONG, parseTime } from "./analysis";
import { localStamp } from "./autodoc";
import { db } from "./db";
import * as repo from "./repo";
import { analyzeStudent } from "./service";
import { notifyUnitClosed } from "./whiteboard";
import { finishUnit, getUnit, touchUnit, unitDurationMs, type FinishOptions, type UnitView } from "./units";

export type HelpLevel = "keine" | "hinweis" | "erklaerung" | "loesung";
export const HELP_LABEL: Record<HelpLevel, string> = {
  keine: "ohne Hilfe",
  hinweis: "ein Hinweis",
  erklaerung: "ausführliche Erklärung",
  loesung: "Lösungsweg angesehen",
};

export type TaskLine = {
  taskId: number;
  assignmentId: number;
  worksheet: string;
  position: number;
  prompt: string;
  skillId: string | null;
  skill: string;
  difficulty: string;
  tries: number;
  correct: boolean;
  finished: boolean;
  firstTry: boolean;
  help: HelpLevel;
  /** Solved on its own after help had been used. */
  solvedAfterHelp: boolean;
  /** Wrong first, then corrected: after feedback alone or after a hint/explanation. */
  corrected: "selbst" | "nach-hilfe" | null;
  timeMs: number;
  activeMs: number;
  errors: string[];
  at: number;
};

export type SkillLine = {
  skillId: string;
  name: string;
  area: string;
  subject: string;
  done: number;
  correct: number;
  firstTry: number;
  withHelp: number;
  rate: number;
  avgTimeMs: number;
  before: number | null;
  after: number | null;
  state: "sicher" | "unsicher" | "problem";
};

export type UnitReport = {
  version: 1;
  unitId: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  activeMs: number;
  subjects: string[];
  topics: string[];
  subtopics: string[];
  worksheets: { id: number; title: string; difficulty: string; kind: string }[];
  tasksDone: number;
  correct: number;
  wrong: number;
  successRate: number | null;
  firstTry: number;
  multiTry: number;
  difficulties: { level: string; count: number }[];
  skills: SkillLine[];
  development: { firstHalf: number | null; secondHalf: number | null; direction: "besser" | "gleich" | "schlechter" | null };
  errors: { label: string; count: number; skills: string[] }[];
  correction: { selbst: number; nachHilfe: number; nicht: number };
  help: { tasks: number; hinweis: number; erklaerung: number; loesung: number; solvedAfterHelp: number };
  speed: { avgMs: number | null; slow: number[]; fast: number[]; pauses: number; manyRetries: number };
  problemTasks: number[];
  tasks: TaskLine[];
};

const PAUSE_MS = 2 * 60_000;

/** Collects the report for a unit from its attempts. */
export function buildUnitReport(unit: UnitView, now = Date.now()): UnitReport {
  const attempts = repo.listAttemptsForUnit(unit.id);
  const skills = repo.listSkills();
  const skillOf = (id: string | null) => skills.find((s) => s.id === id);

  // one line per task (a task belongs to one assignment)
  const byTask = new Map<string, repo.Attempt[]>();
  for (const a of attempts) {
    const key = `${a.assignment_id}:${a.task_id}`;
    byTask.set(key, [...(byTask.get(key) ?? []), a]);
  }
  const worksheets = new Map<number, repo.Worksheet>();
  const tasks: TaskLine[] = [];
  for (const list of byTask.values()) {
    const first = list[0];
    const task = repo.getTask(first.task_id);
    const assignment = repo.getAssignment(first.assignment_id);
    if (!task || !assignment) continue;
    if (!worksheets.has(assignment.worksheet_id)) worksheets.set(assignment.worksheet_id, repo.getWorksheet(assignment.worksheet_id)!);
    const ws = worksheets.get(assignment.worksheet_id)!;
    const final = list.find((a) => a.final) ?? null;
    const hints = Math.max(...list.map((a) => a.hints_used));
    const solution = list.some((a) => a.solution_viewed);
    const help: HelpLevel = solution ? "loesung" : hints >= 2 ? "erklaerung" : hints === 1 ? "hinweis" : "keine";
    const correct = Boolean(final?.correct);
    const firstWrong = list.find((a) => !a.correct && !a.solution_viewed);
    let corrected: TaskLine["corrected"] = null;
    if (correct && firstWrong && final) corrected = final.hints_used > firstWrong.hints_used ? "nach-hilfe" : "selbst";
    tasks.push({
      taskId: task.id,
      assignmentId: assignment.id,
      worksheet: ws.title,
      position: task.position,
      prompt: task.prompt.split("\n")[0].slice(0, 120),
      skillId: task.skillId,
      skill: skillOf(task.skillId)?.name ?? "ohne Fähigkeit",
      difficulty: task.difficulty,
      tries: list.filter((a) => !a.solution_viewed).length,
      correct,
      finished: Boolean(final),
      firstTry: Boolean(final && final.correct && final.attempt_no === 1 && !final.hints_used),
      help,
      solvedAfterHelp: correct && help !== "keine" && help !== "loesung",
      corrected,
      timeMs: list.reduce((s, a) => s + a.time_ms, 0),
      activeMs: list.reduce((s, a) => s + (a.active_ms ?? a.time_ms), 0),
      errors: [...new Set(list.map((a) => a.error_label).filter((x): x is string => Boolean(x)))],
      at: parseTime(final?.created_at ?? list[list.length - 1].created_at),
    });
  }
  tasks.sort((a, b) => a.at - b.at);
  const done = tasks.filter((t) => t.finished);
  const correct = done.filter((t) => t.correct).length;

  // mastery before and after, from the regular analysis
  const startMs = Date.parse(unit.started_at);
  const endMs = unit.ended_at ? Date.parse(unit.ended_at) : now;
  const before = analyzeStudent(unit.student_id, startMs - 1);
  const after = analyzeStudent(unit.student_id, endMs + 1);
  const masteryIn = (a: typeof before, id: string) => a?.skills.find((s) => s.skill.id === id)?.mastery ?? null;

  const skillIds = [...new Set(done.map((t) => t.skillId).filter((x): x is string => Boolean(x)))];
  const skillLines: SkillLine[] = skillIds.map((id) => {
    const s = skillOf(id)!;
    const ts = done.filter((t) => t.skillId === id);
    const rate = ts.reduce((sum, t) => sum + (t.correct ? (t.firstTry ? 1 : t.help === "keine" ? 0.7 : 0.5) : 0), 0) / ts.length;
    return {
      skillId: id,
      name: s?.name ?? id,
      area: s?.area ?? "",
      subject: s?.subject ?? "",
      done: ts.length,
      correct: ts.filter((t) => t.correct).length,
      firstTry: ts.filter((t) => t.firstTry).length,
      withHelp: ts.filter((t) => t.help !== "keine").length,
      rate,
      avgTimeMs: Math.round(ts.reduce((sum, t) => sum + t.activeMs, 0) / ts.length),
      before: masteryIn(before, id),
      after: masteryIn(after, id),
      state: rate >= STRONG ? "sicher" : rate >= WEAK ? "unsicher" : "problem",
    };
  });
  skillLines.sort((a, b) => a.rate - b.rate);

  // development inside the unit: first half vs second half of the finished tasks
  const half = Math.floor(done.length / 2);
  const score = (ts: TaskLine[]) => (ts.length ? ts.reduce((s, t) => s + (t.firstTry ? 1 : t.correct ? 0.5 : 0), 0) / ts.length : null);
  const firstHalf = done.length >= 4 ? score(done.slice(0, half)) : null;
  const secondHalf = done.length >= 4 ? score(done.slice(half)) : null;
  const direction = firstHalf === null || secondHalf === null ? null : secondHalf - firstHalf > 0.15 ? "besser" : firstHalf - secondHalf > 0.15 ? "schlechter" : "gleich";

  const errorMap = new Map<string, { count: number; skills: Set<string> }>();
  for (const a of attempts) {
    if (!a.error_label) continue;
    const e = errorMap.get(a.error_label) ?? { count: 0, skills: new Set<string>() };
    e.count++;
    e.skills.add(skillOf(a.skill_id)?.name ?? "");
    errorMap.set(a.error_label, e);
  }

  const times = done.map((t) => t.activeMs).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;
  const help = tasks.filter((t) => t.help !== "keine");

  return {
    version: 1,
    unitId: unit.id,
    startedAt: unit.started_at,
    endedAt: unit.ended_at,
    durationMs: unitDurationMs(unit, now),
    activeMs: tasks.reduce((s, t) => s + t.activeMs, 0),
    subjects: [...new Set(skillLines.map((s) => s.subject).filter(Boolean))],
    topics: [...new Set(skillLines.map((s) => s.area).filter(Boolean))],
    subtopics: skillLines.map((s) => s.name),
    worksheets: [...worksheets.values()].map((w) => ({ id: w.id, title: w.title, difficulty: w.difficulty, kind: w.kind })),
    tasksDone: done.length,
    correct,
    wrong: done.length - correct,
    successRate: done.length ? correct / done.length : null,
    firstTry: done.filter((t) => t.firstTry).length,
    multiTry: done.filter((t) => t.tries > 1).length,
    difficulties: [...new Set(done.map((t) => t.difficulty))].map((level) => ({ level, count: done.filter((t) => t.difficulty === level).length })),
    skills: skillLines,
    development: { firstHalf, secondHalf, direction },
    errors: [...errorMap].map(([label, e]) => ({ label, count: e.count, skills: [...e.skills].filter(Boolean) })).sort((a, b) => b.count - a.count),
    correction: {
      selbst: tasks.filter((t) => t.corrected === "selbst").length,
      nachHilfe: tasks.filter((t) => t.corrected === "nach-hilfe").length,
      nicht: tasks.filter((t) => t.finished && !t.correct && t.errors.length > 0).length,
    },
    help: {
      tasks: help.length,
      hinweis: help.filter((t) => t.help === "hinweis").length,
      erklaerung: help.filter((t) => t.help === "erklaerung").length,
      loesung: help.filter((t) => t.help === "loesung").length,
      solvedAfterHelp: help.filter((t) => t.solvedAfterHelp).length,
    },
    speed: {
      avgMs: done.length ? Math.round(times.reduce((s, x) => s + x, 0) / done.length) : null,
      slow: done.filter((t) => done.length >= 4 && t.activeMs > Math.max(60_000, 2 * median)).map((t) => t.taskId),
      fast: done.filter((t) => done.length >= 4 && t.firstTry && t.activeMs < median / 2).map((t) => t.taskId),
      pauses: tasks.filter((t) => t.timeMs - t.activeMs > PAUSE_MS).length,
      manyRetries: tasks.filter((t) => t.tries >= 3).length,
    },
    problemTasks: tasks.filter((t) => (t.finished && !t.correct) || t.help === "loesung" || t.tries >= 3).map((t) => t.taskId),
    tasks,
  };
}

const pctText = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}`);

/** Readable German summary, e.g. "Max arbeitete heute an der Bruchrechnung (Dividieren und Multiplizieren). …" */
export function summarize(r: UnitReport, studentName: string): string {
  const first = studentName.split(" ")[0];
  const minutes = Math.max(1, Math.round(r.durationMs / 60_000));
  if (r.tasksDone === 0) {
    return `Einheit mit ${first} (${minutes} min). Am Gerät wurden keine Übungsaufgaben bearbeitet, die Inhalte stehen in den Beobachtungen des Lehrers.`;
  }
  const out: string[] = [];
  const topic = r.topics.length ? `${list(r.topics)} (${list(r.subtopics)})` : list(r.subtopics);
  out.push(`${first} arbeitete in dieser Einheit an ${topic}.`);
  const sure = r.skills.filter((s) => s.state === "sicher").map((s) => s.name);
  const problems = r.skills.filter((s) => s.state === "problem");
  const unsure = r.skills.filter((s) => s.state === "unsicher").map((s) => s.name);
  if (sure.length) out.push(`Bei ${list(sure)} zeigte sich bereits gute Sicherheit.`);
  if (unsure.length) out.push(`${list(unsure)} ${unsure.length === 1 ? "gelang" : "gelangen"} teilweise, aber noch nicht sicher.`);
  for (const p of problems.slice(0, 2)) {
    const err = r.errors.find((e) => e.skills.includes(p.name));
    const still = p.before !== null && p.before < WEAK ? "weiterhin " : "";
    out.push(`Bei ${p.name} traten ${still}Probleme auf${err ? `, vor allem „${err.label}“` : ""}.`);
  }
  out.push(`Von ${r.tasksDone} Aufgaben wurden ${r.correct} richtig gelöst (${pctText(r.successRate)}), ${r.firstTry} davon beim ersten Versuch ohne Hilfe.`);
  if (r.help.tasks) {
    const kinds = [r.help.hinweis && `${r.help.hinweis}× ein Hinweis`, r.help.erklaerung && `${r.help.erklaerung}× eine ausführliche Erklärung`, r.help.loesung && `${r.help.loesung}× der Lösungsweg`].filter(Boolean) as string[];
    out.push(`Bei ${r.help.tasks} ${r.help.tasks === 1 ? "Aufgabe war" : "Aufgaben war"} Hilfe nötig (${list(kinds)})${r.help.solvedAfterHelp ? `; ${r.help.solvedAfterHelp} davon danach selbstständig gelöst` : ""}.`);
  } else out.push("Es wurde keine Hilfe benötigt.");
  if (r.correction.selbst + r.correction.nachHilfe > 0) {
    out.push(`${r.correction.selbst + r.correction.nachHilfe} Fehler ${r.correction.selbst + r.correction.nachHilfe === 1 ? "wurde" : "wurden"} selbst korrigiert${r.correction.nachHilfe ? ` (${r.correction.nachHilfe} nach einer Hilfe)` : ""}.`);
  }
  if (r.development.direction === "besser") out.push("Gegen Ende der Einheit gelangen ähnliche Aufgaben zunehmend selbstständig.");
  if (r.development.direction === "schlechter") out.push("Gegen Ende ließ die Sicherheit nach, eventuell Müdigkeit oder schwierigere Aufgaben.");
  const moved = r.skills.filter((s) => s.before !== null && s.after !== null && Math.abs(s.after - s.before) >= 0.05);
  if (moved.length) out.push(`Fortschritt: ${moved.map((s) => `${s.name} ${pctText(s.before)} → ${pctText(s.after)}`).join(", ")}.`);
  return out.join(" ");
}

/** Short text for the lesson's "Was wurde gemacht" when the teacher has not written anything. */
function activitiesText(r: UnitReport) {
  if (!r.tasksDone) return "";
  const sheets = r.worksheets.map((w) => `„${w.title}“`);
  return `${r.tasksDone} Aufgaben bearbeitet (${list(sheets)}), ${r.correct} richtig.`;
}

/** Mastery of every skill with data, stored per unit so progress can be read unit by unit. */
function snapshotSkills(unit: UnitView, r: UnitReport, at: number) {
  const a = analyzeStudent(unit.student_id, at + 1);
  if (!a) return;
  const conn = db();
  conn.prepare("DELETE FROM skill_snapshots WHERE unit_id = ?").run(unit.id);
  const ins = conn.prepare("INSERT INTO skill_snapshots (unit_id, student_id, skill_id, mastery, practiced, recorded_at) VALUES (?, ?, ?, ?, ?, ?)");
  const practiced = new Set(r.skills.map((s) => s.skillId));
  const lesson = repo.getLessonForUnit(unit.id);
  for (const id of lesson?.skill_ids ?? []) practiced.add(id);
  for (const s of a.skills) if (s.mastery !== null) ins.run(unit.id, unit.student_id, s.skill.id, s.mastery, practiced.has(s.skill.id) ? 1 : 0, new Date(at).toISOString());
}

/** The planned lesson of that day, if the unit belongs to one. */
function plannedLessonFor(unit: Pick<UnitView, "student_id" | "started_at">): repo.Lesson | null {
  const day = localStamp(Date.parse(unit.started_at)).slice(0, 10);
  return repo.listLessons(unit.student_id).find((l) => l.kind === "stunde" && l.status === "geplant" && !l.unit_id && l.starts_at.slice(0, 10) === day) ?? null;
}

/** Subject shown for a unit before any exercise was done: today's planned lesson, else the student's first subject. */
export function expectedSubject(studentId: number, at = Date.now()): string {
  const planned = plannedLessonFor({ student_id: studentId, started_at: new Date(at).toISOString() });
  return planned?.subject || repo.getStudent(studentId)?.subjects[0] || "";
}

/**
 * Ends a unit and writes its Lern-Dokumentation. Works without any teacher input; the teacher
 * completes it afterwards on the unit page. Returns the lesson id.
 */
export function endUnit(unitId: number, opts: FinishOptions = {}): number | null {
  const at = opts.at ?? Date.now();
  const unit = finishUnit(unitId, "beendet", { ...opts, at });
  if (!unit || unit.status !== "beendet") return null;
  notifyUnitClosed(unitId);
  return writeLearningDoc(unit, at);
}

export function writeLearningDoc(unit: UnitView, at = Date.now()): number {
  const student = repo.getStudent(unit.student_id)!;
  const r = buildUnitReport(unit, at);
  const existing = repo.getLessonForUnit(unit.id) ?? plannedLessonFor(unit);
  const lessonId = repo.saveLesson(
    {
      student_id: unit.student_id,
      teacher_id: unit.teacher_id,
      kind: "stunde",
      unit_id: unit.id,
      starts_at: localStamp(Date.parse(unit.started_at)),
      duration_min: Math.max(1, Math.round(r.durationMs / 60_000)),
      subject: r.subjects[0] ?? existing?.subject ?? student.subjects[0] ?? "",
      topic: existing?.topic || r.topics.join(", "),
      status: "abgeschlossen",
      activities: existing?.activities || activitiesText(r),
      mistakes: existing?.mistakes ?? "",
      understanding: existing?.understanding ?? null,
      tutor_notes: existing?.tutor_notes ?? "",
      next_steps: existing?.next_steps ?? "",
      skill_ids: [...new Set([...(existing?.skill_ids ?? []), ...r.skills.map((s) => s.skillId)])],
      summary: summarize(r, student.name),
      report: JSON.stringify(r),
    },
    existing?.id,
  );
  snapshotSkills(unit, r, at);
  const subject = repo.getLesson(lessonId)?.subject;
  if (subject) db().prepare("UPDATE units SET subject = ? WHERE id = ?").run(subject, unit.id);
  return lessonId;
}

export function readReport(lesson: Pick<repo.Lesson, "report">): UnitReport | null {
  if (!lesson.report) return null;
  try {
    const r = JSON.parse(lesson.report) as UnitReport;
    return r.version === 1 ? r : null;
  } catch {
    return null;
  }
}

/** Units nobody ended: closed at their last activity (at least the planned length) and documented. */
/** A running unit without any activity for this long is ended automatically. */
export const UNIT_IDLE_MS = 3 * 3600_000;

export function sweepIdleUnits(now = Date.now(), idleMs = UNIT_IDLE_MS) {
  const idle = db()
    .prepare("SELECT id FROM units WHERE status = 'gestartet' AND last_activity_at < ?")
    .all(new Date(now - idleMs).toISOString()) as { id: number }[];
  for (const { id } of idle) {
    const u = getUnit(id)!;
    const planned = plannedLessonFor(u);
    const plannedMin = planned?.duration_min ?? 60;
    const end = Math.max(Date.parse(u.last_activity_at), Date.parse(u.started_at) + plannedMin * 60_000);
    const last = new Date(u.last_activity_at).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    endUnit(id, {
      at: Math.min(end, now),
      estimated: true,
      reason: `Automatisch beendet: ${Math.round(idleMs / 3600_000)} Stunden keine Aktivität (letzte Aktivität ${last}). Endzeit geschätzt aus der letzten Aktivität bzw. ${plannedMin} min ${planned ? "geplanter" : "üblicher"} Dauer.`,
    });
  }
}

/** Keeps the running unit of a student alive when the teacher does something for that student. */
export function noteActivity(studentId: number) {
  const row = db().prepare("SELECT id FROM units WHERE student_id = ? AND status = 'gestartet'").get(studentId) as { id: number } | undefined;
  if (row) touchUnit(row.id);
}

export type SkillHistory = { skillId: string; name: string; area: string; points: { unitId: number; at: string; mastery: number; practiced: boolean }[] };

/** Mastery per skill after each unit, oldest first. */
export function skillHistory(studentId: number): SkillHistory[] {
  const rows = db()
    .prepare(
      `SELECT s.unit_id, s.skill_id, s.mastery, s.practiced, s.recorded_at, k.name, k.area FROM skill_snapshots s
       JOIN skills k ON k.id = s.skill_id WHERE s.student_id = ? ORDER BY s.recorded_at, s.id`,
    )
    .all(studentId) as { unit_id: number; skill_id: string; mastery: number; practiced: number; recorded_at: string; name: string; area: string }[];
  const map = new Map<string, SkillHistory>();
  for (const r of rows) {
    const h = map.get(r.skill_id) ?? { skillId: r.skill_id, name: r.name, area: r.area, points: [] };
    h.points.push({ unitId: r.unit_id, at: r.recorded_at, mastery: r.mastery, practiced: Boolean(r.practiced) });
    map.set(r.skill_id, h);
  }
  return [...map.values()];
}

export type ProgressOverview = {
  /** Units (oldest first) with a snapshot, for the long-term table. */
  units: { unitId: number; at: string }[];
  rows: { skillId: string; name: string; area: string; values: (number | null)[]; practiced: boolean[]; delta: number | null }[];
  improved: { name: string; area: string; from: number; to: number }[];
  stalled: { name: string; area: string; from: number; to: number; units: number }[];
};

/** Long-term development per skill across units: biggest improvements and skills without progress. */
export function progressOverview(studentId: number, maxUnits = 6): ProgressOverview {
  const history = skillHistory(studentId);
  const unitIds = [...new Map(history.flatMap((h) => h.points.map((p) => [p.unitId, p.at] as const))).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([unitId, at]) => ({ unitId, at }));
  const shown = unitIds.slice(-maxUnits);
  const rows = history
    .filter((h) => h.points.some((p) => p.practiced))
    .map((h) => {
      const at = (id: number) => h.points.find((p) => p.unitId === id);
      const values = shown.map((u) => at(u.unitId)?.mastery ?? null);
      const known = h.points.filter((p) => p.practiced);
      // start = mastery right before the skill was first practised in a unit
      const firstIdx = h.points.indexOf(known[0]);
      const firstValue = h.points[Math.max(0, firstIdx - 1)].mastery;
      const lastValue = h.points[h.points.length - 1].mastery;
      return {
        skillId: h.skillId,
        name: h.name,
        area: h.area,
        values,
        practiced: shown.map((u) => Boolean(at(u.unitId)?.practiced)),
        delta: h.points.length >= 2 ? lastValue - firstValue : null,
        practicedUnits: known.length,
        firstValue,
        lastValue,
      };
    });
  const improved = rows
    .filter((r) => r.lastValue - r.firstValue >= 0.05)
    .sort((a, b) => b.lastValue - b.firstValue - (a.lastValue - a.firstValue))
    .slice(0, 4)
    .map((r) => ({ name: r.name, area: r.area, from: r.firstValue, to: r.lastValue }));
  const stalled = rows
    .filter((r) => r.practicedUnits >= 2 && r.lastValue - r.firstValue < 0.03)
    .map((r) => ({ name: r.name, area: r.area, from: r.firstValue, to: r.lastValue, units: r.practicedUnits }));
  return { units: shown, rows: rows.map(({ skillId, name, area, values, practiced, delta }) => ({ skillId, name, area, values, practiced, delta })), improved, stalled };
}
