import { aiEnabled, generateWithAI } from "./ai";
import { computeAnalysis } from "./analysis";
import { documentAssignment } from "./autodoc";
import { db } from "./db";
import type { Difficulty, TaskType } from "./curriculum";
import { TASK_TYPES, levelOf } from "./curriculum";
import { generateBuiltIn } from "./generators";
import { wortartenFor } from "./wortarten";
import { klassenLabel, schulstufe } from "./school";
import { runningUnitForStudent, touchUnit } from "./units";
import * as repo from "./repo";
import { suggestErrorType } from "./error-types";
import { checkAnswer, isReview, TEACHER_GRADED, type TaskDraft } from "./tasks";
import { closestVersion } from "./fix-text";
import { gradeMathTask, type MathView } from "./math-task";
import { carelessCredit } from "./lehrplan";
import { onAnswer } from "./ai/realtime";

// the setting lives with the other settings in lib/lehrplan.ts (lib/autodoc.ts reads it too)
export { CARELESS_SETTING, carelessCredit } from "./lehrplan";

export function analyzeStudent(studentId: number, now?: number) {
  const student = repo.getStudent(studentId);
  if (!student) return null;
  // answers on a merged duplicate count for the skill it was merged into (Mehr › Datenqualität)
  const alias = repo.skillAliases();
  const map = (ids: string[]) => (alias.size ? [...new Set(ids.map((id) => alias.get(id) ?? id))] : ids);
  return computeAnalysis({
    student,
    skills: repo.listSkills(),
    attempts: repo.listAttemptsForStudent(studentId).map((a) => (alias.size ? { ...a, skill_id: a.skill_id ? (alias.get(a.skill_id) ?? a.skill_id) : null, skill_ids: map(a.skill_ids ?? []) } : a)),
    lessons: repo.listLessons(studentId).map((l) => ({ ...l, skill_ids: map(l.skill_ids) })),
    tests: repo.listTests(studentId).map((t) => ({ ...t, skill_ids: map(t.skill_ids) })),
    assignments: repo.listAssignments(studentId),
    now,
    careless: carelessCredit(),
  });
}

export type BuildRequest = {
  subject: string;
  schoolType: string;
  klasse: number;
  skillIds: string[];
  difficulty: Difficulty;
  count: number;
  taskType: TaskType | "mixed";
  kind?: "uebung" | "ueberpruefung";
  title?: string;
  focusNote?: string;
  useAI?: boolean;
  teacherId?: number | null;
};

export async function buildWorksheet(req: BuildRequest): Promise<{ id: number; source: "ki" | "generator"; aiError?: string }> {
  const all = repo.listSkills();
  const skills = req.skillIds.map((id) => all.find((s) => s.id === id)).filter((s): s is repo.Skill => Boolean(s));
  if (skills.length === 0) throw new Error("Bitte mindestens eine Fähigkeit auswählen.");
  const areas = [...new Set(skills.map((s) => s.area))];
  const topic = areas.join(", ");
  const count = Math.max(1, Math.min(30, req.count));

  let tasks: TaskDraft[] | null = null;
  let source: "ki" | "generator" = "generator";
  let aiError: string | undefined;
  const grade = schulstufe(req.schoolType, req.klasse);
  const wortarten = wortartenFor(req.skillIds, grade);
  if ((req.useAI ?? true) && aiEnabled()) {
    try {
      tasks = await generateWithAI({
        subject: req.subject,
        level: klassenLabel(req.schoolType, req.klasse),
        skills: skills.map((s) => ({ id: s.id, name: s.name, area: s.area, difficulty: req.difficulty })),
        count,
        categories: [],
        focusNote: [req.taskType !== "mixed" ? `Aufgabenformat: ${TASK_TYPES[req.taskType]}` : "", req.focusNote ?? ""].filter(Boolean).join(". "),
        wortarten,
      }, { teacherId: req.teacherId ?? null, trigger: "empfehlung" });
      if (tasks && tasks.length) source = "ki";
      else aiError = "Die KI hat keine Aufgaben geliefert.";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
      tasks = null;
    }
  }
  if (!tasks || tasks.length === 0) {
    tasks = generateBuiltIn({ subject: req.subject, skills: skills.map((s) => ({ id: s.id, name: s.name })), difficulty: req.difficulty, count, taskType: req.taskType, grade, wortarten });
  }
  const label = req.kind === "ueberpruefung" ? "Überprüfung" : TASK_TYPES[req.taskType];
  const title = req.title?.trim() || `${skills.length === 1 ? `${skills[0].area}: ${skills[0].name}` : topic} · ${label}`;
  const id = repo.createWorksheet(
    {
      title,
      subject: req.subject,
      grade: schulstufe(req.schoolType, req.klasse),
      school_type: req.schoolType,
      klasse: req.klasse,
      topic,
      difficulty: req.difficulty,
      task_type: req.taskType,
      kind: req.kind ?? "uebung",
      source,
      skill_ids: skills.map((s) => s.id),
    },
    tasks,
  );
  return { id, source, aiError };
}

export type SubmitInput = {
  token: string;
  assignmentId: number;
  taskId: number;
  answer: string;
  timeMs: number;
  hintsUsed: number;
  /** Time with interaction (typing, clicking) while the page was visible. */
  activeMs?: number;
  /** Student gave up and opened the solution. */
  giveUp?: boolean;
  /** Older devices: the student's own rating of a free answer. Free answers are graded by the teacher now; it is ignored. */
  selfAssessed?: boolean | null;
  /**
   * The device's id for this one submission (a click on "Abgeben"). Sent again unchanged when the
   * connection broke; the server then answers with what it stored the first time.
   */
  submissionId?: string;
};

export const MAX_TRIES = 3;

export type SubmitResult = {
  correct: boolean | null;
  final: boolean;
  feedback: string;
  attemptNo: number;
  solution?: string;
  sample?: string;
  /** Lückentext: the gaps (from 1) that are still wrong. */
  wrongGaps?: number[];
  /** The teacher grades this answer (free answers): saved, nothing is right or wrong yet. */
  pendingReview?: boolean;
  /** Fehler korrigieren, once finished: the corrected text, to compare with the student's own. */
  expected?: string;
  /** Teacher's or automatic grade of the finished answer (teilweise = half, e.g. 2 of 3 parts right). */
  review?: string | null;
  /** Rechenweg, Sachaufgabe: how each line, the result and each part of the answer sent was checked (lib/math-task.ts). */
  math?: MathView;
};

const SUBMISSION_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** A submission whose first request is still being graded: a repeat waits for it instead of grading again. */
const g = globalThis as { __lernheftSubmissions?: Map<string, Promise<SubmitResult>> };
const grading = (g.__lernheftSubmissions ??= new Map());

const GAVE_UP = "Hier ist der Lösungsweg. Schau ihn dir in Ruhe an.";
const PENDING = "Deine Antwort ist gespeichert. Deine Lehrerin bzw. dein Lehrer schaut sie sich an.";

/** What the student sees for a stored answer: the same text the first time and on a repeat. */
function resultOf(a: Pick<repo.Attempt, "correct" | "final" | "attempt_no" | "feedback" | "solution_viewed" | "review">, solution: string, sample?: string): SubmitResult {
  const attemptNo = a.attempt_no;
  if (a.solution_viewed) return { correct: false, final: true, feedback: GAVE_UP, attemptNo, solution };
  if (a.review === "offen") return { correct: null, final: true, feedback: a.feedback, attemptNo, solution, sample, pendingReview: true };
  const correct = Boolean(a.correct);
  const final = Boolean(a.final);
  const left = MAX_TRIES - attemptNo;
  return {
    correct,
    final,
    feedback: correct ? a.feedback : final ? `${a.feedback} Schau dir den Lösungsweg an.` : `${a.feedback} Du hast noch ${left} ${left === 1 ? "Versuch" : "Versuche"}.`,
    attemptNo,
    solution: final ? solution : undefined,
    ...(final && a.review ? { review: a.review } : {}),
  };
}

export async function submitAnswer(input: SubmitInput): Promise<SubmitResult> {
  const student = repo.getStudentByToken(input.token);
  const assignment = repo.getAssignment(input.assignmentId);
  const task = repo.getTask(input.taskId);
  if (!student || !assignment || !task || assignment.student_id !== student.id || task.worksheet_id !== assignment.worksheet_id) {
    throw new Error("Aufgabe nicht gefunden.");
  }
  const reveal = (r: SubmitResult): SubmitResult => {
    if (task.type === "fix" && r.final) return { ...r, expected: closestVersion(task.answer.accepted ?? [], input.answer, task.answer.mode !== "text") ?? task.answer.accepted?.[0] };
    // the marks on the student's lines and parts: worked out again from the answer sent, the same on a repeat
    if ((task.type === "rechenweg" || task.type === "sachaufgabe") && !input.giveUp) return { ...r, math: gradeMathTask(task, input.answer).view };
    return r;
  };
  if (input.submissionId === undefined) return evaluate(input, student, assignment, task, null).then(reveal);
  const sid = input.submissionId;
  if (typeof sid !== "string" || !SUBMISSION_ID.test(sid)) throw new Error("Abgabe nicht erkannt.");
  const stored = repo.getAttemptBySubmission(student.id, sid);
  if (stored) {
    if (stored.assignment_id !== assignment.id || stored.task_id !== task.id) throw new Error("Abgabe nicht erkannt.");
    return reveal(resultOf(stored, task.solution, task.answer.sample));
  }
  const key = `${student.id}:${sid}`;
  const running = grading.get(key);
  if (running) return running.then(reveal);
  const p = evaluate(input, student, assignment, task, sid).finally(() => grading.delete(key));
  grading.set(key, p);
  return p.then(reveal);
}

async function evaluate(input: SubmitInput, student: repo.Student, assignment: repo.Assignment, task: repo.Task, sid: string | null): Promise<SubmitResult> {
  const previous = repo.listAttemptsForAssignment(assignment.id).filter((a) => a.task_id === task.id);
  const finished = previous.find((a) => a.final);
  if (finished) {
    return { ...resultOf(finished, task.solution, task.answer.sample), feedback: "Diese Aufgabe ist schon abgeschlossen." };
  }
  repo.markAssignmentStarted(assignment.id);
  // Practice while a teacher has a unit running for this student belongs to that unit. A unit that
  // has been idle too long is closed first, so later self-practice is not counted as tutoring.
  const { sweepIdleUnits } = await import("./learning");
  sweepIdleUnits();
  const unit = runningUnitForStudent(student.id);
  if (unit) touchUnit(unit.id);
  const timeMs = Math.max(0, Math.min(input.timeMs, 60 * 60 * 1000));
  const base = {
    assignment_id: assignment.id,
    task_id: task.id,
    student_id: student.id,
    skill_id: task.skillId,
    time_ms: timeMs,
    hints_used: input.hintsUsed,
    unit_id: unit?.id ?? null,
    active_ms: input.activeMs === undefined ? null : Math.max(0, Math.min(input.activeMs, timeMs)),
    // tracking: who taught (the unit's teacher, else the student's own) and how hard the task was
    teacher_id: unit?.teacher_id ?? student.teacher_id ?? null,
    level: task.level ?? levelOf(task.difficulty),
    submission_id: sid,
  };

  /**
   * Stores the answer in one transaction: the attempt number is counted there, and a submission the
   * database already has (same id) is not stored again. Only a stored answer goes on to tracking,
   * documentation and the live view.
   */
  const store = (r: { answer: string; correct: boolean; solutionViewed: boolean; errorLabel: string | null; feedback: string; errorType: { type: string; source: string } | null; review?: "offen"; onFinal?: "teilweise" | "offen" | null }) =>
    db().transaction(() => {
      if (sid) {
        const dup = repo.getAttemptBySubmission(student.id, sid);
        if (dup) return { fresh: false as const, attempt: dup };
      }
      const before = repo.listAttemptsForAssignment(assignment.id).filter((a) => a.task_id === task.id);
      const done = before.find((a) => a.final);
      if (done) return { fresh: false as const, attempt: done };
      const attemptNo = before.length + 1;
      const final = r.solutionViewed || r.correct || r.review === "offen" || attemptNo >= MAX_TRIES;
      const row = {
        ...base,
        attempt_no: attemptNo,
        answer: r.answer,
        correct: r.correct ? 1 : 0,
        final: final ? 1 : 0,
        solution_viewed: r.solutionViewed ? 1 : 0,
        error_label: r.errorLabel,
        feedback: r.feedback,
        error_type: r.errorType?.type ?? null,
        error_type_source: r.errorType?.source ?? null,
        // the last try of a maths task: half right (teilweise) or for the teacher (offen), see lib/math-check.ts
        review: r.review ?? (final && !r.correct && !r.solutionViewed && r.onFinal ? r.onFinal : null),
      };
      if (row.review === "offen" && !r.review) row.feedback = `${r.feedback} Den Rest bewertet deine Lehrerin bzw. dein Lehrer.`;
      repo.recordAttempt(row);
      if (final) repo.completeAssignmentIfDone(assignment.id);
      return { fresh: true as const, attempt: row };
    })();

  const after = (attempt: { attempt_no: number; final: number; correct: number }, errorType: string | null, waitsForTeacher = false) => {
    documentAssignment(assignment.id);
    // the KI looks at it in the background (lib/ai/realtime.ts decides whether a request is worth it)
    // a free answer waiting for the teacher's grade is neither right nor wrong for the live analysis
    if (unit && !waitsForTeacher)
      onAnswer({
        unitId: unit.id,
        teacherId: unit.teacher_id,
        taskId: task.id,
        assignmentId: assignment.id,
        correct: Boolean(attempt.correct),
        attemptNo: attempt.attempt_no,
        errorType,
        blockDone: Boolean(attempt.final) && Boolean(repo.getAssignment(assignment.id)?.completed_at),
      });
  };

  // nothing stored: the same submission got there first (its result), or another answer finished the task
  const settled = (a: Parameters<typeof resultOf>[0] & { submission_id?: string | null }) =>
    sid !== null && a.submission_id === sid ? resultOf(a, task.solution, task.answer.sample) : { ...resultOf(a, task.solution, task.answer.sample), feedback: "Diese Aufgabe ist schon abgeschlossen." };

  if (input.giveUp) {
    const out = store({ answer: input.answer, correct: false, solutionViewed: true, errorLabel: null, feedback: "Lösung angesehen", errorType: null });
    if (!out.fresh) return settled(out.attempt);
    after(out.attempt, null);
    return resultOf(out.attempt, task.solution);
  }

  const result = checkAnswer(task, input.answer);
  // Fehlerart of a wrong answer: the task's own (a described error of a correction task) or the app's rule-based suggestion
  let errorType: { type: string; source: "vorschlag" | "ki" } | null = result.errorType ? { type: result.errorType, source: "vorschlag" } : null;

  const maths = task.type === "rechenweg" || task.type === "sachaufgabe";
  if (result.correct === null) {
    // a free answer: saved for the teacher's grade, never counted as wrong because it is worded differently;
    // a maths answer the app cannot check safely (its note and suggested Fehlerart stay with it)
    const out = maths
      ? store({ answer: input.answer, correct: false, solutionViewed: false, errorLabel: result.errorLabel, feedback: result.feedback, errorType, review: "offen" })
      : store({ answer: input.answer, correct: false, solutionViewed: false, errorLabel: null, feedback: PENDING, errorType: null, review: "offen" });
    if (!out.fresh) return settled(out.attempt);
    after(out.attempt, null, true);
    const res = resultOf(out.attempt, task.solution, task.answer.sample ?? task.solution);
    return res;
  }

  if (!result.correct && !errorType && task.type !== "fix" && !maths) {
    const suggested = suggestErrorType(task, input.answer, result.errorLabel, repo.getWorksheet(task.worksheet_id)?.subject ?? "");
    if (suggested) errorType = { type: suggested, source: "vorschlag" };
  }
  const out = store({ answer: input.answer, correct: Boolean(result.correct), solutionViewed: false, errorLabel: result.errorLabel, feedback: result.feedback, errorType, onFinal: result.onFinal });
  if (!out.fresh) return settled(out.attempt);
  after(out.attempt, errorType?.type ?? null, out.attempt.review === "offen");
  const res = resultOf(out.attempt, task.solution, task.answer.sample ?? undefined);
  if (out.attempt.final) return res;
  return { ...res, ...(result.wrongGaps?.length ? { wrongGaps: result.wrongGaps } : {}) };
}

/**
 * Lehrerbewertung of a free answer or a correction (richtig, teilweise richtig, falsch). It replaces the app's
 * check, counts for the Lernstand from then on and is written into the automatic Dokumentation.
 */
export function reviewAnswer(attemptId: number, review: string, teacherId: number): { ok: true; attempt: repo.Attempt } | { error: string } {
  if (!isReview(review)) return { error: "Unbekannte Bewertung." };
  const attempt = repo.getAttempt(attemptId);
  const task = attempt ? repo.getTask(attempt.task_id) : null;
  if (!attempt || !task) return { error: "Antwort nicht gefunden." };
  if (!TEACHER_GRADED.has(task.type) && attempt.review !== "offen") return { error: "Diese Aufgabe prüft die App selbst." };
  if (!repo.setAttemptReview(attemptId, review, teacherId)) return { error: "Nur eine abgeschlossene Antwort kann bewertet werden." };
  documentAssignment(attempt.assignment_id);
  return { ok: true, attempt: repo.getAttempt(attemptId)! };
}
