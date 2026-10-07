import { aiEnabled, generateWithAI, gradeFreeText } from "./ai";
import { computeAnalysis } from "./analysis";
import { documentAssignment } from "./autodoc";
import type { Difficulty, TaskType } from "./curriculum";
import { TASK_TYPES, levelOf } from "./curriculum";
import { generateBuiltIn } from "./generators";
import { klassenLabel, schulstufe } from "./school";
import { runningUnitForStudent, touchUnit } from "./units";
import * as repo from "./repo";
import { suggestErrorType } from "./error-types";
import { checkAnswer, type TaskDraft } from "./tasks";
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
  if ((req.useAI ?? true) && aiEnabled()) {
    try {
      tasks = await generateWithAI({
        subject: req.subject,
        level: klassenLabel(req.schoolType, req.klasse),
        skills: skills.map((s) => ({ id: s.id, name: s.name, area: s.area, difficulty: req.difficulty })),
        count,
        categories: [],
        focusNote: [req.taskType !== "mixed" ? `Aufgabenformat: ${TASK_TYPES[req.taskType]}` : "", req.focusNote ?? ""].filter(Boolean).join(". "),
      }, { teacherId: req.teacherId ?? null, trigger: "empfehlung" });
      if (tasks && tasks.length) source = "ki";
      else aiError = "Die KI hat keine Aufgaben geliefert.";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
      tasks = null;
    }
  }
  if (!tasks || tasks.length === 0) {
    tasks = generateBuiltIn({ subject: req.subject, skills: skills.map((s) => ({ id: s.id, name: s.name })), difficulty: req.difficulty, count, taskType: req.taskType });
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
  /** Free text without AI: student compares with the model answer and rates themselves. */
  selfAssessed?: boolean | null;
};

export const MAX_TRIES = 3;

export type SubmitResult = {
  correct: boolean | null;
  final: boolean;
  feedback: string;
  attemptNo: number;
  solution?: string;
  sample?: string;
  needsSelfAssessment?: boolean;
};

export async function submitAnswer(input: SubmitInput): Promise<SubmitResult> {
  const student = repo.getStudentByToken(input.token);
  const assignment = repo.getAssignment(input.assignmentId);
  const task = repo.getTask(input.taskId);
  if (!student || !assignment || !task || assignment.student_id !== student.id || task.worksheet_id !== assignment.worksheet_id) {
    throw new Error("Aufgabe nicht gefunden.");
  }
  const previous = repo.listAttemptsForAssignment(assignment.id).filter((a) => a.task_id === task.id);
  const finished = previous.find((a) => a.final);
  if (finished) {
    return { correct: Boolean(finished.correct), final: true, feedback: "Diese Aufgabe ist schon abgeschlossen.", attemptNo: finished.attempt_no, solution: task.solution };
  }
  repo.markAssignmentStarted(assignment.id);
  // Practice while a teacher has a unit running for this student belongs to that unit. A unit that
  // has been idle too long is closed first, so later self-practice is not counted as tutoring.
  const { sweepIdleUnits } = await import("./learning");
  sweepIdleUnits();
  const unit = runningUnitForStudent(student.id);
  if (unit) touchUnit(unit.id);
  const attemptNo = previous.length + 1;
  const timeMs = Math.max(0, Math.min(input.timeMs, 60 * 60 * 1000));
  const base = {
    assignment_id: assignment.id,
    task_id: task.id,
    student_id: student.id,
    skill_id: task.skillId,
    attempt_no: attemptNo,
    time_ms: timeMs,
    hints_used: input.hintsUsed,
    unit_id: unit?.id ?? null,
    active_ms: input.activeMs === undefined ? null : Math.max(0, Math.min(input.activeMs, timeMs)),
    // tracking: who taught (the unit's teacher, else the student's own) and how hard the task was
    teacher_id: unit?.teacher_id ?? student.teacher_id ?? null,
    level: task.level ?? levelOf(task.difficulty),
  };

  if (input.giveUp) {
    repo.recordAttempt({ ...base, answer: input.answer, correct: 0, final: 1, solution_viewed: 1, error_label: null, feedback: "Lösung angesehen" });
    repo.completeAssignmentIfDone(assignment.id);
    documentAssignment(assignment.id);
    if (unit) onAnswer({ unitId: unit.id, teacherId: unit.teacher_id, taskId: task.id, assignmentId: assignment.id, correct: false, attemptNo, errorType: null, blockDone: Boolean(repo.getAssignment(assignment.id)?.completed_at) });
    return { correct: false, final: true, feedback: "Hier ist der Lösungsweg. Schau ihn dir in Ruhe an.", attemptNo, solution: task.solution };
  }

  let result = checkAnswer(task, input.answer);
  // Fehlerart of a wrong answer: the app's rule-based suggestion, or the AI's for graded free text
  let errorType: { type: string; source: "vorschlag" | "ki" } | null = null;

  if (result.correct === null) {
    // free text
    if (input.selfAssessed !== undefined && input.selfAssessed !== null) {
      result = { correct: input.selfAssessed, errorLabel: null, feedback: input.selfAssessed ? "Gut gemacht!" : "Danke für deine ehrliche Einschätzung." };
    } else if (aiEnabled() && task.answer.sample) {
      // short time limit: without an answer in time the student rates their answer themselves
      const g = await gradeFreeText({ prompt: task.prompt, passage: task.data.passage, sample: task.answer.sample }, input.answer, {
        teacherId: unit?.teacher_id ?? student.teacher_id ?? null,
        unitId: unit?.id ?? null,
        trigger: "freitext",
      });
      if (g.ok) {
        result = { correct: g.data.correct, errorLabel: g.data.error_label, feedback: g.data.feedback };
        if (!g.data.correct && g.data.error_type) errorType = { type: g.data.error_type, source: "ki" };
      }
    }
    if (result.correct === null) {
      return { correct: null, final: false, feedback: "Vergleiche deine Antwort mit der Musterlösung: Hattest du es richtig?", attemptNo, sample: task.answer.sample ?? task.solution, needsSelfAssessment: true };
    }
  }

  const final = result.correct === true || attemptNo >= MAX_TRIES;
  if (!result.correct && !errorType) {
    const suggested = suggestErrorType(task, input.answer, result.errorLabel, repo.getWorksheet(task.worksheet_id)?.subject ?? "");
    if (suggested) errorType = { type: suggested, source: "vorschlag" };
  }
  repo.recordAttempt({
    ...base,
    answer: input.answer,
    correct: result.correct ? 1 : 0,
    final: final ? 1 : 0,
    solution_viewed: 0,
    error_label: result.errorLabel,
    feedback: result.feedback,
    error_type: errorType?.type ?? null,
    error_type_source: errorType?.source ?? null,
  });
  if (final) repo.completeAssignmentIfDone(assignment.id);
  documentAssignment(assignment.id);
  // the KI looks at it in the background (lib/ai/realtime.ts decides whether a request is worth it)
  if (unit)
    onAnswer({
      unitId: unit.id,
      teacherId: unit.teacher_id,
      taskId: task.id,
      assignmentId: assignment.id,
      correct: Boolean(result.correct),
      attemptNo,
      errorType: errorType?.type ?? null,
      blockDone: final && Boolean(repo.getAssignment(assignment.id)?.completed_at),
    });
  const left = MAX_TRIES - attemptNo;
  return {
    correct: result.correct,
    final,
    feedback: result.correct ? result.feedback : final ? `${result.feedback} Schau dir den Lösungsweg an.` : `${result.feedback} Du hast noch ${left} ${left === 1 ? "Versuch" : "Versuche"}.`,
    attemptNo,
    solution: final ? task.solution : undefined,
  };
}

