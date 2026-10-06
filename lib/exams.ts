/**
 * Schularbeiten and tests ahead: reminder stages, and the preparation page with a rule-based plan.
 * No AI: the plan comes from the student's Lernstand per skill (lib/mastery.ts).
 */
import { difficultyFor, type Difficulty } from "./curriculum";
import { examThresholds, prerequisitesOf } from "./lehrplan";
import { masteryStatus, type MasteryStatus } from "./mastery";
import * as repo from "./repo";
import { analyzeStudent } from "./service";

const DAY = 86_400_000;
/** "YYYY-MM-DD" of a local date. */
export const dayOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Whole days from `today` to `date` (both YYYY-MM-DD); 0 = today. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
}

export type ReminderStage = "vorbereiten" | "prioritaet" | "bald";
export const STAGE_LABEL: Record<ReminderStage, string> = { vorbereiten: "Vorbereitung beginnen", prioritaet: "Vorbereitung wichtig", bald: "Prüfung bald" };
export const STAGE_TONE: Record<ReminderStage, "neutral" | "amber" | "red"> = { vorbereiten: "neutral", prioritaet: "amber", bald: "red" };

/** Stage for `days` left with thresholds [14, 7, 3] (configurable under Mehr › Lehrplan). */
export function reminderStage(days: number, thresholds: [number, number, number] = examThresholds()): ReminderStage | null {
  const [start, priority, soon] = thresholds;
  if (days < 0) return null;
  if (days <= soon) return "bald";
  if (days <= priority) return "prioritaet";
  if (days <= start) return "vorbereiten";
  return null;
}

export type ExamReminder = repo.TestResult & { student_name: string; days: number; stage: ReminderStage };
/** Planned exams inside the first threshold, soonest first; optionally only the students of one teacher. */
export function examReminders(today: string, o: { teacherId?: number; studentId?: number } = {}): ExamReminder[] {
  const thresholds = examThresholds();
  const mine = o.teacherId != null ? new Set(repo.listStudents().filter((s) => s.teacher_id == null || s.teacher_id === o.teacherId).map((s) => s.id)) : null;
  return repo
    .upcomingTests(today, o.studentId)
    .filter((t) => !mine || mine.has(t.student_id))
    .map((t) => ({ ...t, days: daysUntil(t.date, today) }))
    .flatMap((t) => {
      const stage = reminderStage(t.days, thresholds);
      return stage ? [{ ...t, stage }] : [];
    });
}

export type PrepSkill = { skill: repo.Skill; mastery: number | null; status: MasteryStatus; tasksDone: number; lastPracticed: number | null; weakPrerequisites: { skill: repo.Skill; mastery: number | null }[] };
export type PlanItem = { skill: repo.Skill; count: number; difficulty: Difficulty; reason: string };
export type ExamPrep = {
  test: repo.TestResult;
  student: repo.Student;
  days: number;
  stage: ReminderStage | null;
  skills: PrepSkill[];
  untested: PrepSkill[];
  plan: PlanItem[];
  totalTasks: number;
};

/** Tasks per skill by status: weaker → more practice; untested → a short check first. */
export const PLAN_COUNTS: Record<MasteryStatus, number> = { kritisch: 5, "üben": 4, "nicht getestet": 3, gut: 2, sicher: 1 };

/**
 * Preparation for one exam: the Lernstand of every linked skill, which ones were never tested,
 * and a plan. Rules: weak prerequisites first (3 tasks each), then every exam skill with
 * PLAN_COUNTS by status, weakest first. Three days or less before the exam, "sicher" skills
 * are left out so the time goes to what is still missing.
 */
export function examPrep(testId: number, today: string, now = Date.now()): ExamPrep | null {
  const test = repo.getTest(testId);
  const student = test ? repo.getStudent(test.student_id) : null;
  const analysis = test ? analyzeStudent(test.student_id, now) : null;
  if (!test || !student || !analysis) return null;
  const all = repo.listSkills();
  const stat = (id: string) => analysis.skills.find((s) => s.skill.id === id);
  const days = daysUntil(test.date, today);

  const skills: PrepSkill[] = test.skill_ids.flatMap((id) => {
    const skill = all.find((s) => s.id === id);
    if (!skill) return [];
    const st = stat(id);
    const mastery = st?.mastery ?? null;
    const weakPrerequisites = prerequisitesOf(id)
      .filter((p) => !test.skill_ids.includes(p))
      .flatMap((p) => {
        const ps = all.find((s) => s.id === p);
        const pm = stat(p)?.mastery ?? null;
        return ps && pm !== null && pm < 0.7 ? [{ skill: ps, mastery: pm }] : [];
      });
    return [{ skill, mastery, status: masteryStatus(mastery), tasksDone: st?.tasksDone ?? 0, lastPracticed: st?.lastPracticed ?? null, weakPrerequisites }];
  });
  const order: MasteryStatus[] = ["kritisch", "üben", "nicht getestet", "gut", "sicher"];
  skills.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (a.mastery ?? 0) - (b.mastery ?? 0));

  const plan: PlanItem[] = [];
  const seen = new Set<string>();
  for (const s of skills) {
    for (const p of s.weakPrerequisites) {
      if (seen.has(p.skill.id)) continue;
      seen.add(p.skill.id);
      plan.push({ skill: p.skill, count: 3, difficulty: difficultyFor(p.mastery), reason: `Voraussetzung für ${s.skill.name} (${Math.round((p.mastery ?? 0) * 100)} %)` });
    }
  }
  for (const s of skills) {
    if (seen.has(s.skill.id)) continue;
    if (s.status === "sicher" && days <= 3) continue;
    seen.add(s.skill.id);
    const reason = s.status === "nicht getestet" ? "noch nicht getestet – kurz überprüfen" : s.status === "sicher" ? "sitzt – kurz wiederholen" : `${s.status} (${Math.round((s.mastery ?? 0) * 100)} %)`;
    plan.push({ skill: s.skill, count: PLAN_COUNTS[s.status], difficulty: s.status === "nicht getestet" ? "mittel" : difficultyFor(s.mastery), reason });
  }
  return {
    test,
    student,
    days,
    stage: reminderStage(days),
    skills,
    untested: skills.filter((s) => s.status === "nicht getestet"),
    plan,
    totalTasks: plan.reduce((a, p) => a + p.count, 0),
  };
}
