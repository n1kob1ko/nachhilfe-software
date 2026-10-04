import { aiEnabled, generateWithAI, gradeFreeText } from "./ai";
import { computeAnalysis } from "./analysis";
import { documentAssignment } from "./autodoc";
import type { Difficulty, TaskType } from "./curriculum";
import { TASK_TYPES } from "./curriculum";
import { generateBuiltIn } from "./generators";
import { klassenLabel, schulstufe } from "./school";
import { runningUnitForStudent, touchUnit } from "./units";
import * as repo from "./repo";
import { checkAnswer, type TaskDraft } from "./tasks";

export function analyzeStudent(studentId: number, now?: number) {
  const student = repo.getStudent(studentId);
  if (!student) return null;
  return computeAnalysis({
    student,
    skills: repo.listSkills(),
    attempts: repo.listAttemptsForStudent(studentId),
    lessons: repo.listLessons(studentId),
    tests: repo.listTests(studentId),
    assignments: repo.listAssignments(studentId),
    now,
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
        topic,
        skills: skills.map((s) => ({ id: s.id, name: s.name, area: s.area })),
        difficulty: req.difficulty,
        count,
        taskType: req.taskType,
        focusNote: req.focusNote,
      });
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
  // practice while a teacher has a unit running for this student belongs to that unit
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
  };

  if (input.giveUp) {
    repo.recordAttempt({ ...base, answer: input.answer, correct: 0, final: 1, solution_viewed: 1, error_label: null, feedback: "Lösung angesehen" });
    repo.completeAssignmentIfDone(assignment.id);
    documentAssignment(assignment.id);
    return { correct: false, final: true, feedback: "Hier ist der Lösungsweg. Schau ihn dir in Ruhe an.", attemptNo, solution: task.solution };
  }

  let result = checkAnswer(task, input.answer);

  if (result.correct === null) {
    // free text
    if (input.selfAssessed !== undefined && input.selfAssessed !== null) {
      result = { correct: input.selfAssessed, errorLabel: null, feedback: input.selfAssessed ? "Gut gemacht!" : "Danke für deine ehrliche Einschätzung." };
    } else if (aiEnabled() && task.answer.sample) {
      try {
        const g = await gradeFreeText({ prompt: task.prompt, passage: task.data.passage, sample: task.answer.sample }, input.answer);
        if (g) result = { correct: g.correct, errorLabel: g.error_label, feedback: g.feedback };
      } catch {
        // fall through to self-assessment
      }
    }
    if (result.correct === null) {
      return { correct: null, final: false, feedback: "Vergleiche deine Antwort mit der Musterlösung: Hattest du es richtig?", attemptNo, sample: task.answer.sample ?? task.solution, needsSelfAssessment: true };
    }
  }

  const final = result.correct === true || attemptNo >= MAX_TRIES;
  repo.recordAttempt({
    ...base,
    answer: input.answer,
    correct: result.correct ? 1 : 0,
    final: final ? 1 : 0,
    solution_viewed: 0,
    error_label: result.errorLabel,
    feedback: result.feedback,
  });
  if (final) repo.completeAssignmentIfDone(assignment.id);
  documentAssignment(assignment.id);
  const left = MAX_TRIES - attemptNo;
  return {
    correct: result.correct,
    final,
    feedback: result.correct ? result.feedback : final ? `${result.feedback} Schau dir den Lösungsweg an.` : `${result.feedback} Du hast noch ${left} ${left === 1 ? "Versuch" : "Versuche"}.`,
    attemptNo,
    solution: final ? task.solution : undefined,
  };
}

