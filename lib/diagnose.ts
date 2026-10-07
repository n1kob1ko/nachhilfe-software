import { aiEnabled, generateWithAI } from "./ai";
import { parseTime } from "./analysis";
import { checkTask } from "./builder";
import { db } from "./db";
import { DIAGNOSE_MAX, planDiagnosis, type DiagnosisItem } from "./diagnose-plan";
import { generateBuiltIn, hasBuiltInGenerator } from "./generators";
import { browseSkills, prerequisitesOf } from "./lehrplan";
import { levelWeight, STATUS_THRESHOLDS, taskScore } from "./mastery";
import { nextSteps, type NextStep } from "./recommend";
import * as repo from "./repo";
import { klassenLabel, schulstufe, type SchoolBranch } from "./school";
import { analyzeStudent, carelessCredit } from "./service";
import type { TaskDraft } from "./tasks";
import { runningUnitForStudent } from "./units";

/**
 * Diagnose-Modus: a short check of 5–10 tasks for a new student or an unknown topic. A diagnosis is
 * an ordinary exercise (worksheets.kind = 'diagnose') with an ordinary assignment, so its answers go
 * into the normal tracking and the Lernstand; the kind marks them as diagnosis. The evaluation below
 * is plain arithmetic on those answers, without AI.
 */
export const DIAGNOSE_KIND = "diagnose";
export const DIAGNOSE_NOTE = "Diagnose";
export { DIAGNOSE_MAX, DIAGNOSE_MIN, planDiagnosis, type DiagnosisItem } from "./diagnose-plan";

/** Main skills of the chosen topics, spread over the topics in curriculum order, at most ten. */
export function diagnosisSkills(o: { subject: string; branch: SchoolBranch | null; klasse: number | null; topics: string[] }): repo.Skill[] {
  const scope = browseSkills({ subject: o.subject, branch: o.branch, klasse: o.klasse }).filter((s) => !s.parent_id);
  const topics = o.topics.length ? o.topics : [...new Set(scope.map((s) => s.area))];
  const lists = topics.map((t) => scope.filter((s) => s.area === t)).filter((l) => l.length);
  const out: repo.Skill[] = [];
  for (let i = 0; out.length < DIAGNOSE_MAX && lists.some((l) => l.length > i); i++) {
    for (const l of lists) if (l[i] && out.length < DIAGNOSE_MAX) out.push(l[i]);
  }
  return out;
}

/**
 * A complete library task for this skill and difficulty that the student has not seen yet and the
 * diagnosis does not have yet (a duplicated library entry has the same task).
 */
function libraryTask(subject: string, item: DiagnosisItem, used: Set<number>, seen: Set<string>): TaskDraft | null {
  const rows = db()
    .prepare(
      `SELECT t.id FROM tasks t JOIN worksheets w ON w.id = t.worksheet_id
       WHERE w.kind = 'bibliothek' AND w.subject = ? AND t.difficulty = ? AND t.type <> 'free'
         AND EXISTS (SELECT 1 FROM task_skills ts WHERE ts.task_id = t.id AND ts.skill_id = ?)
       ORDER BY t.id`,
    )
    .all(subject, item.difficulty, item.skillId) as { id: number }[];
  for (const { id } of rows) {
    if (used.has(id)) continue;
    const t = repo.getTask(id);
    if (!t || seen.has(t.prompt) || checkTask(t)) continue;
    used.add(id);
    seen.add(t.prompt);
    const { id: _i, worksheet_id: _w, position: _p, level: _l, ...draft } = t;
    void _i, void _w, void _p, void _l;
    return { ...draft, skillId: item.skillId };
  }
  return null;
}

/** The same task twice: same prompt and same data (options, text …). */
const taskKey = (t: TaskDraft) => `${t.prompt}\n${JSON.stringify(t.data ?? {})}`;

/**
 * Fills the open slots of the plan from the built-in generators, never with a task the diagnosis
 * already has: per slot the first new one of a few candidates (a skill without a generator gets its
 * explanation tasks one after the other). When nothing new comes, the slot stays empty, so a skill
 * gets fewer tasks rather than the same one twice. Generator tasks are own tasks (source 'eigen'),
 * also in a diagnosis whose other tasks Claude wrote.
 */
export function fillFromGenerators(subject: string, plan: DiagnosisItem[], drafts: (TaskDraft | null)[], skills: Map<string, { id: string; name: string }>, seed?: number): (TaskDraft | null)[] {
  const out = [...drafts];
  const keys = new Set(out.filter((d): d is TaskDraft => Boolean(d)).map(taskKey));
  plan.forEach((item, i) => {
    const skill = skills.get(item.skillId);
    if (out[i] || !skill) return;
    const count = plan.filter((p) => p.skillId === item.skillId).length;
    for (let k = 0; k < 6 && !out[i]; k++) {
      const t = generateBuiltIn({ subject, skills: [{ id: skill.id, name: skill.name }], difficulty: item.difficulty, count, taskType: "calc", seed: seed === undefined ? undefined : seed + i * 7 + k }).find((c) => !keys.has(taskKey(c)));
      if (!t) continue;
      out[i] = { ...t, sourceType: "eigen" };
      keys.add(taskKey(t));
    }
  });
  return out;
}

export type DiagnosisInput = {
  studentId: number;
  subject: string;
  schoolType: string;
  klasse: number;
  skillIds: string[];
  topics: string[];
  teacherId: number | null;
  /** new tasks for skills without a built-in generator may come from Claude (default: when available) */
  useAI?: boolean;
  /** for tests: makes the generated tasks reproducible */
  seed?: number;
};

/**
 * Creates the diagnosis and sends it to the student (in a running unit it belongs to the unit).
 * Tasks come from the library first, then from the generators; Claude only writes tasks for skills
 * the generators do not cover, and only when asked.
 */
export async function createDiagnosis(input: DiagnosisInput): Promise<{ worksheetId: number; assignmentId: number; fromLibrary: number; aiError?: string }> {
  const student = repo.getStudent(input.studentId);
  if (!student) throw new Error("Schüler nicht gefunden.");
  const all = new Map(repo.listSkills().map((s) => [s.id, s]));
  const skills = input.skillIds.map((id) => all.get(id)).filter((s): s is repo.Skill => Boolean(s) && s!.subject === input.subject);
  if (!skills.length) throw new Error("Bitte mindestens eine Fähigkeit wählen.");
  const plan = planDiagnosis(skills.map((s) => s.id));
  const seen = new Set(
    (db().prepare("SELECT DISTINCT t.prompt FROM attempts a JOIN tasks t ON t.id = a.task_id WHERE a.student_id = ?").all(student.id) as { prompt: string }[]).map((r) => r.prompt),
  );
  const used = new Set<number>();
  const drafts: (TaskDraft | null)[] = plan.map((item) => libraryTask(input.subject, item, used, seen));
  const fromLibrary = drafts.filter(Boolean).length;

  let source: "ki" | "generator" = "generator";
  let aiError: string | undefined;
  const open = plan.map((item, i) => ({ item, i })).filter(({ i }) => !drafts[i]);
  const forAI = open.filter(({ item }) => !hasBuiltInGenerator(item.skillId));
  if (forAI.length && (input.useAI ?? true) && aiEnabled()) {
    try {
      const out = await generateWithAI({
        subject: input.subject,
        level: klassenLabel(input.schoolType, input.klasse),
        skills: forAI.map(({ item }) => ({ id: item.skillId, name: all.get(item.skillId)!.name, area: all.get(item.skillId)!.area, difficulty: item.difficulty })),
        count: forAI.length,
        categories: [],
        focusNote: "Kurze Diagnose: je Fähigkeit genau eine Aufgabe in der angegebenen Schwierigkeit, eindeutig auswertbar, möglichst kein Freitext.",
      }, { teacherId: input.teacherId, trigger: "diagnose" });
      for (const t of out ?? []) {
        const slot = forAI.find(({ item, i }) => !drafts[i] && item.skillId === t.skillId);
        if (slot) drafts[slot.i] = { ...t, difficulty: slot.item.difficulty };
      }
      if (out?.length) source = "ki";
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  }
  const tasks = fillFromGenerators(input.subject, plan, drafts, all, input.seed).filter((d): d is TaskDraft => Boolean(d));
  const topics = input.topics.length ? input.topics : [...new Set(skills.map((s) => s.area))];
  const first = student.name.split(" ")[0];
  const worksheetId = repo.createWorksheet(
    {
      title: `${first} – Diagnose: ${topics.join(", ")}`,
      subject: input.subject,
      grade: schulstufe(input.schoolType, input.klasse),
      school_type: input.schoolType,
      klasse: input.klasse,
      topic: topics.join(", "),
      difficulty: "gemischt",
      task_type: "mixed",
      kind: DIAGNOSE_KIND,
      source,
      skill_ids: skills.map((s) => s.id),
      student_id: student.id,
      teacher_id: input.teacherId,
      status: "freigegeben",
    },
    tasks,
  );
  const assignmentId = repo.assignWorksheet(worksheetId, student.id, `${DIAGNOSE_NOTE}: ${topics.join(", ")}`, runningUnitForStudent(student.id)?.id ?? null);
  return { worksheetId, assignmentId, fromLibrary, aiError };
}

// ---------- evaluation ----------
export type DiagnosisStatus = "sicher" | "unsicher" | "kritisch" | "offen";
export const DIAGNOSIS_STATUS_LABEL: Record<DiagnosisStatus, string> = { sicher: "Sicher", unsicher: "Unsicher", kritisch: "Kritisch", offen: "Noch offen" };
export const DIAGNOSIS_TONE: Record<DiagnosisStatus, "green" | "amber" | "red" | "neutral"> = { sicher: "green", unsicher: "amber", kritisch: "red", offen: "neutral" };
/** Weighted score of a skill's diagnosis tasks (1 = all right at the first try): from here on "sicher", below CRITICAL "kritisch". */
export const SECURE_SCORE = 0.75;
export const CRITICAL_SCORE = 0.35;
export const diagnosisStatus = (score: number | null): DiagnosisStatus => (score === null ? "offen" : score >= SECURE_SCORE ? "sicher" : score < CRITICAL_SCORE ? "kritisch" : "unsicher");

export type DiagnosisTaskResult = {
  taskId: number;
  difficulty: string;
  done: boolean;
  correct: boolean | null;
  tries: number;
  hints: number;
  solutionViewed: boolean;
  errorType: string | null;
  errorLabel: string | null;
};
export type DiagnosisSkillResult = { skill: repo.Skill; tasks: DiagnosisTaskResult[]; score: number | null; status: DiagnosisStatus; mastery: number | null };
export type DiagnosisGap = { skill: repo.Skill; for: repo.Skill[]; mastery: number | null; reason: string; inDiagnosis: boolean };
export type DiagnosisResult = {
  assignment: repo.Assignment;
  worksheet: repo.Worksheet;
  student: repo.Student;
  total: number;
  done: number;
  finished: boolean;
  skills: DiagnosisSkillResult[];
  gaps: DiagnosisGap[];
  next: NextStep[];
};

export const isDiagnosis = (w: Pick<repo.Worksheet, "kind"> | null | undefined) => w?.kind === DIAGNOSE_KIND;

/**
 * The evaluation of one diagnosis: per skill the result of its tasks (sicher / unsicher / kritisch),
 * possible gaps (prerequisites of weak skills that are weak or untested themselves) and what to
 * practise next (from the central recommendation, limited to these skills and their gaps).
 */
export function diagnosisResult(assignmentId: number, o: { today: string; now?: number }): DiagnosisResult | null {
  const assignment = repo.getAssignment(assignmentId);
  const worksheet = assignment ? repo.getWorksheet(assignment.worksheet_id) : null;
  const student = assignment ? repo.getStudent(assignment.student_id) : null;
  if (!assignment || !worksheet || !student || !isDiagnosis(worksheet)) return null;
  const alias = repo.skillAliases();
  const canon = (id: string) => alias.get(id) ?? id;
  const tasks = repo.listTasks(worksheet.id);
  const attempts = repo.listAttemptsForAssignment(assignment.id);
  const careless = carelessCredit();
  const analysis = analyzeStudent(student.id, o.now);
  const mastery = new Map((analysis?.skills ?? []).map((s) => [s.skill.id, s.mastery]));
  const skillOf = new Map(repo.listSkills().map((s) => [s.id, s]));
  const getSkill = (id: string) => skillOf.get(id) ?? repo.getSkill(id);

  const bySkill = new Map<string, { tasks: DiagnosisTaskResult[]; num: number; den: number }>();
  for (const t of tasks) {
    const id = canon(t.skillId ?? "");
    if (!id) continue;
    const own = attempts.filter((a) => a.task_id === t.id).sort((a, b) => a.attempt_no - b.attempt_no);
    const final = own.find((a) => a.final) ?? null;
    const wrong = [...own].reverse().find((a) => !a.correct);
    const entry = bySkill.get(id) ?? { tasks: [], num: 0, den: 0 };
    entry.tasks.push({
      taskId: t.id,
      difficulty: t.difficulty,
      done: Boolean(final),
      correct: final ? Boolean(final.correct) && !final.solution_viewed : null,
      tries: own.length,
      hints: final?.hints_used ?? 0,
      solutionViewed: Boolean(final?.solution_viewed),
      errorType: wrong?.error_type ?? null,
      errorLabel: wrong?.error_label ?? null,
    });
    if (final) {
      const w = levelWeight(t.level);
      entry.num += w * taskScore(final, { careless });
      entry.den += w;
    }
    bySkill.set(id, entry);
  }
  const order = worksheet.skill_ids.map(canon);
  const skills: DiagnosisSkillResult[] = [...bySkill]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .flatMap(([id, e]) => {
      const skill = getSkill(id);
      if (!skill) return [];
      const score = e.den ? e.num / e.den : null;
      return [{ skill, tasks: e.tasks, score, status: diagnosisStatus(score), mastery: mastery.get(id) ?? null }];
    });

  // gaps: prerequisites of unsure or critical skills that are weak in this diagnosis, weak overall or never checked
  const inDiag = new Map(skills.map((s) => [s.skill.id, s]));
  const gaps = new Map<string, DiagnosisGap>();
  for (const s of skills.filter((x) => x.status === "unsicher" || x.status === "kritisch")) {
    for (const pid of new Set(prerequisitesOf(s.skill.id).map(canon))) {
      const p = getSkill(pid);
      if (!p || p.id === s.skill.id) continue;
      const d = inDiag.get(pid);
      const m = mastery.get(pid) ?? null;
      let reason: string | null = null;
      if (d) reason = d.status === "unsicher" || d.status === "kritisch" ? `in der Diagnose ${DIAGNOSIS_STATUS_LABEL[d.status].toLowerCase()}` : null;
      else if (m === null) reason = "noch nicht geprüft";
      else if (m < STATUS_THRESHOLDS.gut) reason = `Lernstand ${Math.round(m * 100)} %`;
      if (!reason) continue;
      const g = gaps.get(pid) ?? { skill: p, for: [], mastery: m, reason, inDiagnosis: Boolean(d) };
      g.for.push(s.skill);
      gaps.set(pid, g);
    }
  }
  const gapList = [...gaps.values()].sort((a, b) => Number(b.inDiagnosis) - Number(a.inDiagnosis) || (a.mastery ?? 2) - (b.mastery ?? 2));

  const relevant = new Set([...skills.filter((s) => s.status !== "sicher").map((s) => s.skill.id), ...gapList.map((g) => g.skill.id)]);
  const steps = nextSteps(student.id, { today: o.today, now: o.now, limit: 30 });
  const focused = steps.filter((s) => relevant.has(s.skill.id));
  const next = (focused.length ? focused : steps.filter((s) => s.skill.subject === worksheet.subject)).slice(0, 4);

  const done = tasks.filter((t) => attempts.some((a) => a.task_id === t.id && a.final)).length;
  return { assignment, worksheet, student, total: tasks.length, done, finished: done >= tasks.length && tasks.length > 0, skills, gaps: gapList, next };
}

/** Diagnoses of a student, newest first, with how far they are. */
export function diagnosesOf(studentId: number) {
  return repo
    .listAssignments(studentId)
    .filter((a) => a.kind === DIAGNOSE_KIND)
    .sort((a, b) => parseTime(b.assigned_at) - parseTime(a.assigned_at));
}

/** The latest diagnoses of all students (for the start of the Diagnose-Modus). */
export function recentDiagnoses(limit = 6): { id: number; student_id: number; student_name: string; title: string; topic: string; assigned_at: string; total: number; done: number }[] {
  return db()
    .prepare(
      `SELECT a.id, a.student_id, s.name AS student_name, w.title, w.topic, a.assigned_at,
              (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = w.id) AS total,
              (SELECT COUNT(DISTINCT x.task_id) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1) AS done
       FROM assignments a JOIN worksheets w ON w.id = a.worksheet_id JOIN students s ON s.id = a.student_id
       WHERE w.kind = 'diagnose' ORDER BY a.assigned_at DESC, a.id DESC LIMIT ?`,
    )
    .all(limit) as { id: number; student_id: number; student_name: string; title: string; topic: string; assigned_at: string; total: number; done: number }[];
}
