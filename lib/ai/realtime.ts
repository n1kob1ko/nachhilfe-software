/**
 * KI during a unit. The app tells this module what happens (answer, hint, exercise finished, unit ended);
 * the module decides whether that is worth a request at all, collects events for a few seconds so that
 * several of them become one request, and keeps at least 20 seconds between two analyses of a unit.
 *
 * What is sent is a compact set of learning data (school type and class, subject, skill, mastery, the
 * task, the answers, hints, recent errors, an upcoming test). No name, no notes about the student.
 * Results are suggestions for the teacher (ai_insights); the measured data in attempts stays untouched.
 */
import { z } from "zod";
import { DIFFICULTIES, levelOf } from "../curriculum";
import { db } from "../db";
import { ERROR_TYPES, type ErrorType } from "../error-types";
import * as repo from "../repo";
import { klassenLabel } from "../school";
import { getUnit } from "../units";
import { realtimeCapPerHour } from "./config";
import { generateWithAI } from "./features";
import { ACTIONS, hasBlockInsight, latestInsight, saveInsight, type Action, type BlockInsight, type LiveInsight, type UnitInsight } from "./insights";
import { budgetState } from "./log";
import { aiEnabled, breakerState, clockNow, runAI } from "./router";

// ---------- timing ----------
/**
 * A first wrong answer or a first hint: wait. If the student fixes it alone, no request; if the next
 * try is wrong too, both go into one analysis that sees two answers.
 */
export const WAIT_MS = 45_000;
/** repeated wrong answers, a second hint, a repeated error pattern */
export const WAIT_PRIORITY_MS = 2_000;
/** at most one live analysis per unit in this time */
export const MIN_GAP_MS = 20_000;
const BLOCK_WAIT_MS = 3_000;

export type Scheduler = { after(ms: number, fn: () => Promise<void>): unknown; cancel(handle: unknown): void };
const timers: Scheduler = {
  after: (ms, fn) => setTimeout(() => void fn().catch(() => undefined), ms),
  cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};
let scheduler = timers;
/** The 60-minute simulation runs the clock itself. */
export function setScheduler(s: Scheduler | null) {
  scheduler = s ?? timers;
}

const busy = new Set<Promise<unknown>>();
function track<T>(p: Promise<T>): Promise<T> {
  busy.add(p);
  void p.finally(() => busy.delete(p)).catch(() => undefined);
  return p;
}
/** Waits until no KI work of this module is running (tests, simulation). */
export async function settle() {
  while (busy.size) await Promise.allSettled([...busy]);
}

/** Counters for the simulation report: how many events led to how many requests. */
export const liveStats = { events: 0, triggers: 0, analyses: 0, bundled: 0, skippedSolved: 0, skippedCap: 0, blocks: 0, units: 0, newTasks: 0 };
export function resetLiveStats() {
  for (const k of Object.keys(liveStats) as (keyof typeof liveStats)[]) liveStats[k] = 0;
}

// ---------- per-unit state ----------
export type Trigger = "falsche_antwort" | "wiederholter_fehlversuch" | "hilfe_angefordert" | "wiederholtes_fehlermuster" | "block_fertig" | "neue_aufgabe" | "einheit_ende";
type Pending = { trigger: Trigger; taskId: number; assignmentId: number; priority: boolean };
type UnitState = { teacherId: number; events: Pending[]; timer: unknown; due: number; lastCallAt: number; running: boolean; calls: number[]; blockTimers: Map<number, unknown> };
const g = globalThis as unknown as { __aiUnits?: Map<number, UnitState> };
const units: Map<number, UnitState> = (g.__aiUnits ??= new Map<number, UnitState>());

function stateOf(unitId: number, teacherId: number): UnitState {
  let s = units.get(unitId);
  if (!s) units.set(unitId, (s = { teacherId, events: [], timer: null, due: 0, lastCallAt: -Infinity, running: false, calls: [], blockTimers: new Map() }));
  return s;
}

/** Drops everything waiting for a unit (it ended or was cancelled). */
export function forgetUnit(unitId: number) {
  const s = units.get(unitId);
  if (!s) return;
  if (s.timer !== null) scheduler.cancel(s.timer);
  for (const t of s.blockTimers.values()) scheduler.cancel(t);
  units.delete(unitId);
}

async function notify(unitId: number) {
  const { pushLive } = await import("../live");
  pushLive(unitId);
}

function queue(unitId: number, teacherId: number, ev: Pending) {
  const s = stateOf(unitId, teacherId);
  liveStats.triggers++;
  if (s.events.length) liveStats.bundled++;
  s.events.push(ev);
  const now = clockNow();
  const due = Math.max(now + (ev.priority ? WAIT_PRIORITY_MS : WAIT_MS), s.lastCallAt + MIN_GAP_MS);
  if (s.timer !== null && s.due <= due) return;
  if (s.timer !== null) scheduler.cancel(s.timer);
  s.due = due;
  s.timer = scheduler.after(due - now, () => track(flush(unitId)));
}

// ---------- events from the app ----------

export type AnswerEvent = { unitId: number; teacherId: number; taskId: number; assignmentId: number; correct: boolean; attemptNo: number; errorType: string | null; blockDone: boolean };

/** An answer was recorded. A right answer alone never costs a request. */
export function onAnswer(e: AnswerEvent) {
  if (!aiEnabled()) return;
  liveStats.events++;
  if (!e.correct) {
    const base = { taskId: e.taskId, assignmentId: e.assignmentId };
    queue(e.unitId, e.teacherId, e.attemptNo >= 2 ? { ...base, trigger: "wiederholter_fehlversuch", priority: true } : { ...base, trigger: "falsche_antwort", priority: false });
    if (e.errorType && repeatedPattern(e.unitId, e.errorType)) queue(e.unitId, e.teacherId, { ...base, trigger: "wiederholtes_fehlermuster", priority: true });
  }
  if (e.blockDone) scheduleBlock(e.unitId, e.teacherId, e.assignmentId);
}

/** A hint was opened. The second hint of a task is urgent, the first one can wait. */
export function onHint(e: { unitId: number; teacherId: number; taskId: number; assignmentId: number; hintIndex: number }) {
  if (!aiEnabled()) return;
  liveStats.events++;
  queue(e.unitId, e.teacherId, { trigger: "hilfe_angefordert", taskId: e.taskId, assignmentId: e.assignmentId, priority: e.hintIndex >= 1 });
}

/** The unit ended: pending live analyses are dropped, one summary is written instead. */
export function onUnitEnd(e: { unitId: number; teacherId: number; lessonId: number | null }) {
  forgetUnit(e.unitId);
  if (!aiEnabled() || !e.lessonId) return;
  liveStats.events++;
  void track(unitSummary(e.unitId, e.teacherId, e.lessonId));
}

/** The same Fehlerart at least twice among the last 8 answers of the unit. */
function repeatedPattern(unitId: number, errorType: string) {
  const rows = db().prepare("SELECT error_type FROM attempts WHERE unit_id = ? ORDER BY id DESC LIMIT 8").all(unitId) as { error_type: string | null }[];
  return rows.filter((r) => r.error_type === errorType).length >= 2;
}

// ---------- compact context (no names) ----------

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const round2 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 100) / 100);

function skillLabel(id: string | null | undefined) {
  const s = id ? repo.getSkill(id) : null;
  return s ? `${s.area} › ${s.name}` : null;
}

/** Skills that may come next: prerequisites, follow-ups and the parent skill (at most 6). */
function nextCandidates(skillId: string | null): { id: string; name: string }[] {
  if (!skillId) return [];
  const skill = repo.getSkill(skillId);
  const links = db().prepare("SELECT other_id FROM skill_links WHERE skill_id = ? AND removed_at IS NULL").all(skillId) as { other_id: string }[];
  const ids = [...new Set([skill?.parent_id, ...links.map((l) => l.other_id)].filter((x): x is string => Boolean(x) && x !== skillId))];
  return ids.slice(0, 6).flatMap((id) => {
    const name = skillLabel(id);
    return name ? [{ id, name }] : [];
  });
}

function examFor(studentId: number, subject: string, now: number) {
  const today = new Date(now).toISOString().slice(0, 10);
  const t = repo
    .listTests(studentId)
    .filter((x) => (x.status ?? "geplant") === "geplant" && x.date >= today && x.subject === subject)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!t) return null;
  const days = Math.round((Date.parse(t.date) - Date.parse(today)) / 86_400_000);
  return days <= 21 ? { in_tagen: days, stoff: clip((t.topics?.length ? t.topics.join(", ") : t.topic) || "", 120) } : null;
}

async function masteryOf(studentId: number, skillIds: string[]) {
  const { analyzeStudent } = await import("../service");
  const a = analyzeStudent(studentId);
  return Object.fromEntries(skillIds.map((id) => [id, round2(a?.skills.find((s) => s.skill.id === id)?.mastery ?? null)]));
}

export type LiveContext = { payload: Record<string, unknown>; candidates: string[] };

/** What the fast model sees for a live analysis. Exported for the test that checks there is no name in it. */
export async function liveContext(unitId: number, taskId: number, assignmentId: number, triggers: Trigger[]): Promise<LiveContext | null> {
  const unit = getUnit(unitId);
  const task = repo.getTask(taskId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  const w = task ? repo.getWorksheet(task.worksheet_id) : null;
  if (!unit || !task || !student || !w) return null;
  const attempts = repo.listAttemptsForAssignment(assignmentId).filter((x) => x.task_id === taskId);
  const hints = new Set(repo.hintUsesForAssignment(assignmentId).filter((h) => h.task_id === taskId).map((h) => h.hint_index)).size;
  const recent = db()
    .prepare("SELECT x.error_type, x.error_label, t.skill_id FROM attempts x JOIN tasks t ON t.id = x.task_id WHERE x.unit_id = ? AND x.correct = 0 AND x.task_id <> ? ORDER BY x.id DESC LIMIT 5")
    .all(unitId, taskId) as { error_type: string | null; error_label: string | null; skill_id: string | null }[];
  const candidates = nextCandidates(task.skillId);
  const mastery = task.skillId ? (await masteryOf(student.id, [task.skillId]))[task.skillId] : null;
  return {
    candidates: candidates.map((c) => c.id),
    payload: {
      schule: klassenLabel(student.school_type, student.klasse),
      fach: w.subject,
      skill: task.skillId ? { id: task.skillId, name: skillLabel(task.skillId) } : null,
      lernstand: mastery,
      aufgabe: { text: clip(task.prompt, 500), format: task.type, stufe: task.level ?? levelOf(task.difficulty), loesung: clip(task.solution, 300), hilfen_vorhanden: task.hints.length },
      antworten: attempts.map((x) => ({ antwort: clip(x.answer, 120), richtig: Boolean(x.correct), versuch: x.attempt_no, fehlerart: x.error_type ?? null })),
      hilfen_genutzt: hints,
      letzte_fehler: recent.map((r) => ({ skill: skillLabel(r.skill_id), fehlerart: r.error_type, etikett: r.error_label })),
      pruefung: examFor(student.id, w.subject, clockNow()),
      ausloeser: triggers,
      moegliche_naechste_skills: candidates,
    },
  };
}

// ---------- live analysis ----------

const ERROR_KEYS = ERROR_TYPES.map((e) => e.key) as [ErrorType, ...ErrorType[]];
const LiveSchema = z.object({
  error_type: z.enum(ERROR_KEYS).nullable().describe(`Fehlerart, null wenn keine erkennbar: ${ERROR_TYPES.map((e) => `${e.key} = ${e.label}`).join(", ")}`),
  misconception: z.string().nullable().describe("Vermuteter Denkfehler in einem kurzen Satz, null wenn keiner erkennbar"),
  confidence: z.number().describe("Wie sicher die Einschätzung ist, 0 bis 1"),
  recommended_action: z.enum(ACTIONS as [Action, ...Action[]]).describe("Genau ein nächster Schritt für die Lehrkraft"),
  difficulty_adjustment: z.number().int().describe("-1 leichter, 0 gleich, 1 schwerer"),
  hint: z.string().nullable().describe("Ein Denkanstoß für den Schüler (du-Form, ein Satz), verrät das Ergebnis nicht"),
  next_skill: z.string().nullable().describe("skill_id aus moegliche_naechste_skills, wenn ein Wechsel sinnvoll ist, sonst null"),
  needs_new_exercise: z.boolean().describe("true nur, wenn die aktuelle Übung nicht mehr passt"),
  teacher_note: z.string().describe("Ein Satz für die Lehrkraft, höchstens 140 Zeichen"),
});

const LIVE_SYSTEM = [
  "Du unterstützt eine Nachhilfelehrkraft in Österreich während der Stunde.",
  "Du bekommst kompakte Lerndaten als JSON, ohne Namen: Schulart und Klasse, Fach, Fähigkeit, Lernstand 0–1, die aktuelle Aufgabe mit Lösung, die Antworten dazu, genutzte Hilfen, die letzten Fehler und was die Analyse ausgelöst hat.",
  "Erkenne den wahrscheinlichsten Denkfehler und empfiehl genau einen nächsten Schritt.",
  "Der Hinweis ist für den Schüler: ein Denkanstoß, der das Ergebnis nicht verrät.",
  "Stütze dich nur auf die Daten und antworte knapp.",
].join(" ");

const sign = (n: unknown): -1 | 0 | 1 => (typeof n === "number" && Number.isFinite(n) ? (Math.sign(Math.round(n)) as -1 | 0 | 1) : 0);
const asAction = (a: unknown): Action => (ACTIONS.includes(a as Action) ? (a as Action) : "weiter");

export function cleanLive(d: z.infer<typeof LiveSchema>, candidates: string[]): LiveInsight {
  return {
    error_type: d.error_type && ERROR_KEYS.includes(d.error_type) ? d.error_type : null,
    misconception: d.misconception ? clip(d.misconception, 200) : null,
    confidence: Math.max(0, Math.min(1, Number(d.confidence) || 0)),
    recommended_action: asAction(d.recommended_action),
    difficulty_adjustment: sign(d.difficulty_adjustment),
    hint: d.hint ? clip(d.hint, 300) : null,
    next_skill: d.next_skill && candidates.includes(d.next_skill) ? d.next_skill : null,
    needs_new_exercise: Boolean(d.needs_new_exercise),
    teacher_note: clip(d.teacher_note, 200),
  };
}

async function flush(unitId: number) {
  const s = units.get(unitId);
  if (!s) return;
  s.timer = null;
  if (s.running) {
    s.due = clockNow() + WAIT_PRIORITY_MS;
    s.timer = scheduler.after(WAIT_PRIORITY_MS, () => track(flush(unitId)));
    return;
  }
  const events = s.events.splice(0);
  const focus = events.at(-1);
  if (!focus) return;
  const now = clockNow();
  s.calls = s.calls.filter((t) => t > now - 3_600_000);
  if (s.calls.length >= realtimeCapPerHour()) {
    liveStats.skippedCap++;
    return;
  }
  // solved in the meantime and nothing urgent: no request
  const solved = repo.listAttemptsForAssignment(focus.assignmentId).some((x) => x.task_id === focus.taskId && x.correct && x.final);
  if (solved && !events.some((e) => e.priority)) {
    liveStats.skippedSolved++;
    return;
  }
  const triggers = [...new Set(events.filter((e) => e.taskId === focus.taskId).map((e) => e.trigger))];
  const ctx = await liveContext(unitId, focus.taskId, focus.assignmentId, triggers);
  if (!ctx) return;
  s.running = true;
  s.lastCallAt = now;
  s.calls.push(now);
  liveStats.analyses++;
  void notify(unitId);
  try {
    const r = await runAI("echtzeit", LiveSchema, LIVE_SYSTEM, JSON.stringify(ctx.payload), { meta: { teacherId: s.teacherId, unitId, trigger: triggers.join("+") } });
    if (r.ok) saveInsight({ unitId, kind: "echtzeit", taskId: focus.taskId, assignmentId: focus.assignmentId, triggers, data: cleanLive(r.data, ctx.candidates), callId: r.callId, at: clockNow() });
  } finally {
    s.running = false;
    void notify(unitId);
  }
}

// ---------- an exercise was finished ----------

const BlockSchema = z.object({
  summary: z.string().describe("Zwei Sätze für die Lehrkraft: wie lief die Übung, was fällt auf"),
  strengths: z.array(z.string()).describe("Bis zu 3 Dinge, die gut gingen"),
  gaps: z.array(z.string()).describe("Bis zu 3 Lücken oder Fehlermuster"),
  recommended_action: z.enum(ACTIONS as [Action, ...Action[]]),
  difficulty_adjustment: z.number().int().describe("-1 leichter, 0 gleich, 1 schwerer für die nächste Übung"),
  next_skill: z.string().nullable().describe("skill_id aus moegliche_naechste_skills oder null"),
  needs_new_exercise: z.boolean(),
});
const BLOCK_SYSTEM =
  "Du unterstützt eine Nachhilfelehrkraft in Österreich. Ein Schüler hat gerade eine Übung abgeschlossen; du bekommst die Ergebnisse je Aufgabe als JSON, ohne Namen. Fasse knapp zusammen und empfiehl, wie es weitergeht. Stütze dich nur auf die Daten.";

function scheduleBlock(unitId: number, teacherId: number, assignmentId: number) {
  const s = stateOf(unitId, teacherId);
  if (s.blockTimers.has(assignmentId) || hasBlockInsight(assignmentId)) return;
  s.blockTimers.set(
    assignmentId,
    scheduler.after(BLOCK_WAIT_MS, () =>
      track(
        blockAnalysis(unitId, teacherId, assignmentId).finally(() => {
          units.get(unitId)?.blockTimers.delete(assignmentId);
        }),
      ),
    ),
  );
}

/** Exported for the test of the compact context. */
export async function blockContext(unitId: number, assignmentId: number): Promise<LiveContext | null> {
  const unit = getUnit(unitId);
  const a = repo.getAssignment(assignmentId);
  const w = a ? repo.getWorksheet(a.worksheet_id) : null;
  const student = unit ? repo.getStudent(unit.student_id) : null;
  if (!unit || !a || !w || !student) return null;
  const tasks = repo.listTasks(w.id);
  const attempts = repo.listAttemptsForAssignment(a.id);
  const hints = repo.hintUsesForAssignment(a.id);
  const skillIds = [...new Set(tasks.map((t) => t.skillId).filter((x): x is string => Boolean(x)))];
  const mastery = await masteryOf(student.id, skillIds);
  const candidates = [...new Map(skillIds.flatMap((id) => nextCandidates(id)).map((c) => [c.id, c])).values()].slice(0, 6);
  return {
    candidates: candidates.map((c) => c.id),
    payload: {
      schule: klassenLabel(student.school_type, student.klasse),
      fach: w.subject,
      thema: w.topic,
      aufgaben: tasks.slice(0, 20).map((t) => {
        const tries = attempts.filter((x) => x.task_id === t.id);
        const last = tries.at(-1);
        return {
          skill: skillLabel(t.skillId),
          stufe: t.level ?? levelOf(t.difficulty),
          format: t.type,
          // a free answer the teacher has not graded yet is neither right nor wrong
          richtig: last?.review === "offen" ? null : Boolean(last?.final && last.correct),
          versuche: tries.length,
          hilfen: new Set(hints.filter((h) => h.task_id === t.id).map((h) => h.hint_index)).size,
          fehlerart: tries.filter((x) => !x.correct).at(-1)?.error_type ?? null,
          zeit_s: Math.round(tries.reduce((n, x) => n + x.time_ms, 0) / 1000),
        };
      }),
      lernstand: skillIds.map((id) => ({ skill: skillLabel(id), wert: mastery[id] })),
      pruefung: examFor(student.id, w.subject, clockNow()),
      moegliche_naechste_skills: candidates,
    },
  };
}

async function blockAnalysis(unitId: number, teacherId: number, assignmentId: number) {
  if (hasBlockInsight(assignmentId)) return;
  const ctx = await blockContext(unitId, assignmentId);
  if (!ctx) return;
  liveStats.blocks++;
  const r = await runAI("block", BlockSchema, BLOCK_SYSTEM, JSON.stringify(ctx.payload), { meta: { teacherId, unitId, trigger: "block_fertig" } });
  if (!r.ok) return;
  const d = r.data;
  const data: BlockInsight = {
    summary: clip(d.summary, 400),
    strengths: d.strengths.slice(0, 3).map((x) => clip(x, 160)),
    gaps: d.gaps.slice(0, 3).map((x) => clip(x, 160)),
    recommended_action: asAction(d.recommended_action),
    difficulty_adjustment: sign(d.difficulty_adjustment),
    next_skill: d.next_skill && ctx.candidates.includes(d.next_skill) ? d.next_skill : null,
    needs_new_exercise: Boolean(d.needs_new_exercise),
  };
  saveInsight({ unitId, kind: "block", assignmentId, triggers: ["block_fertig"], data, callId: r.callId, at: clockNow() });
  void notify(unitId);
}

// ---------- end of the unit ----------

const UnitSchema = z.object({
  summary: z.string().describe("3–4 Sätze Einschätzung der Einheit für die Lehrkraft"),
  next_steps: z.array(z.string()).describe("2–4 konkrete Schritte für die nächste Einheit"),
  next_skill: z.string().nullable().describe("Fähigkeit, mit der es weitergehen sollte (Name), oder null"),
  homework: z.string().nullable().describe("Ein Vorschlag für eine kurze Hausübung oder null"),
});
const UNIT_SYSTEM =
  "Du unterstützt eine Nachhilfelehrkraft in Österreich. Du bekommst die Daten einer gerade beendeten Einheit (ohne Namen) und schreibst eine kurze, ehrliche Einschätzung und die nächsten Schritte. Erfinde nichts dazu.";

async function unitSummary(unitId: number, teacherId: number, lessonId: number) {
  const { briefForAI, unitBrief } = await import("../summary");
  const unit = getUnit(unitId);
  const brief = unitBrief(lessonId);
  if (!unit || !brief) return;
  const facts = briefForAI(brief, unit.student_name);
  if (!Object.values(facts).some((v) => Array.isArray(v) && v.length)) return;
  liveStats.units++;
  const r = await runAI("einheit", UnitSchema, UNIT_SYSTEM, JSON.stringify(facts), { meta: { teacherId, unitId, trigger: "einheit_ende" } });
  if (!r.ok) return;
  const data: UnitInsight = { summary: clip(r.data.summary, 700), next_steps: r.data.next_steps.slice(0, 4).map((x) => clip(x, 200)), next_skill: r.data.next_skill ? clip(r.data.next_skill, 120) : null, homework: r.data.homework ? clip(r.data.homework, 200) : null };
  saveInsight({ unitId, kind: "einheit", triggers: ["einheit_ende"], data, callId: r.callId, at: clockNow() });
}

// ---------- a new exercise, on the teacher's click ----------

export type NewExercise = { ok: true; assignmentId: number; source: "ki" | "generator"; note?: string } | { ok: false; error: string };

/**
 * Two new tasks that fit what the KI saw last (skill, difficulty, error pattern), sent to the student
 * right away. Without KI (off, budget, error) the built-in generator makes them.
 */
export async function newExerciseForUnit(unitId: number, teacherId: number): Promise<NewExercise> {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { ok: false, error: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  const last = db().prepare("SELECT task_id FROM attempts WHERE unit_id = ? ORDER BY id DESC LIMIT 1").get(unitId) as { task_id: number } | undefined;
  const task = last ? repo.getTask(last.task_id) : null;
  const live = latestInsight(unitId, "echtzeit");
  const block = latestInsight(unitId, "block");
  const ref = [live, block].filter((x) => x !== null).sort((a, b) => b!.id - a!.id)[0] ?? null;
  const skillId = ref?.data.next_skill ?? task?.skillId ?? null;
  const skill = skillId ? repo.getSkill(skillId) : null;
  if (!student || !skill) return { ok: false, error: "In dieser Einheit wurde noch keine Aufgabe gelöst." };
  const level = Math.max(1, Math.min(5, (task?.level ?? levelOf(task?.difficulty)) + (ref?.data.difficulty_adjustment ?? 0)));
  const difficulty = DIFFICULTIES[level - 1];
  const misconception = live && live.id === ref?.id ? live.data.misconception : null;
  const used = db()
    .prepare("SELECT t.prompt FROM tasks t JOIN assignments a ON a.worksheet_id = t.worksheet_id WHERE a.unit_id = ?")
    .all(unitId) as { prompt: string }[];

  let tasks = null as Awaited<ReturnType<typeof generateWithAI>>;
  let note: string | undefined;
  liveStats.newTasks++;
  try {
    const { contextForAI, studentContext } = await import("../builder");
    const ctx = studentContext(student.id);
    tasks = await generateWithAI(
      {
        subject: skill.subject,
        level: klassenLabel(student.school_type, student.klasse),
        skills: [{ id: skill.id, name: skill.name, area: skill.area, difficulty }],
        count: 2,
        categories: [],
        studentContext: ctx ? contextForAI(ctx, [skill.id]) : null,
        focusNote: misconception ? `Gezielt üben: ${misconception}` : undefined,
        avoid: used.map((u) => u.prompt),
      },
      { teacherId, unitId, trigger: "neue_aufgabe" },
      "neue_aufgabe",
    );
  } catch (e) {
    note = e instanceof Error ? e.message : String(e);
  }
  let source: "ki" | "generator" = "ki";
  if (!tasks?.length) {
    const { generateBuiltIn } = await import("../generators");
    tasks = generateBuiltIn({ subject: skill.subject, skills: [{ id: skill.id, name: skill.name }], difficulty, count: 2, taskType: "mixed" });
    source = "generator";
  }
  if (!tasks.length) return { ok: false, error: "Für diese Fähigkeit konnte keine Aufgabe erstellt werden." };
  const { schulstufe } = await import("../school");
  const worksheetId = repo.createWorksheet(
    {
      title: `${skill.area}: ${skill.name} · Nachschub`,
      subject: skill.subject,
      grade: schulstufe(student.school_type, student.klasse ?? 1),
      school_type: student.school_type,
      klasse: student.klasse,
      topic: skill.area,
      difficulty,
      task_type: "mixed",
      kind: "uebung",
      source,
      skill_ids: [skill.id],
      student_id: student.id,
      teacher_id: teacherId,
    },
    tasks,
  );
  const assignmentId = repo.assignWorksheet(worksheetId, student.id, "", unitId);
  const { showOnTablet } = await import("../live");
  showOnTablet(unit, { kind: "aufgabe", assignmentId });
  return { ok: true, assignmentId, source, note };
}

// ---------- what the live status shows ----------

export type AILive = {
  on: boolean;
  state: "bereit" | "denkt" | "budget" | "pausiert";
  hint: (LiveInsight & { at: string; taskId: number | null; nextSkillName: string | null }) | null;
  block: (BlockInsight & { at: string; nextSkillName: string | null }) | null;
};

export function aiLiveState(unitId: number): AILive {
  const on = aiEnabled();
  const s = units.get(unitId);
  const b = budgetState(clockNow());
  const state: AILive["state"] = b.level === "aus" || b.level === "echtzeit-aus" ? "budget" : breakerState().paused ? "pausiert" : s?.running || s?.events.length ? "denkt" : "bereit";
  const live = latestInsight(unitId, "echtzeit");
  const block = latestInsight(unitId, "block");
  return {
    on,
    state,
    hint: live ? { ...live.data, at: live.createdAt, taskId: live.taskId, nextSkillName: skillLabel(live.data.next_skill) } : null,
    block: block ? { ...block.data, at: block.createdAt, nextSkillName: skillLabel(block.data.next_skill) } : null,
  };
}
