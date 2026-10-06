/**
 * "Was als Nächstes üben?" – rule-based, no AI. Rules in this order of priority:
 *   1. a Schularbeit/test is coming up and one of its skills is not yet secure
 *   2. a prerequisite of a weak or exam skill is not secure
 *   3. an error was made several times in the last 14 days
 *   4. a skill was not practised for a long time (30 days)
 *   5. the next sensible skill after one that sits
 * Each skill appears once, with the reason of its highest rule.
 */
import { difficultyFor, type Difficulty } from "./curriculum";
import { examReminders } from "./exams";
import { nextSkillsOf, prerequisitesOf, skillsForStudent } from "./lehrplan";
import { masteryStatus, STATUS_THRESHOLDS } from "./mastery";
import * as repo from "./repo";
import { analyzeStudent } from "./service";

const DAY = 86_400_000;
export const LONG_AGO_DAYS = 30;
export const RECENT_ERROR_DAYS = 14;

export type Rule = 1 | 2 | 3 | 4 | 5;
export const RULE_LABEL: Record<Rule, string> = { 1: "Prüfung", 2: "Voraussetzung", 3: "Fehler", 4: "Wiederholen", 5: "Weiter" };
export type NextStep = { rule: Rule; skill: repo.Skill; mastery: number | null; count: number; difficulty: Difficulty; reason: string; testId?: number };

const pct = (m: number | null) => (m === null ? "nicht getestet" : `${Math.round(m * 100)} %`);

export function nextSteps(studentId: number, o: { today: string; now?: number; limit?: number }): NextStep[] {
  const now = o.now ?? Date.now();
  const student = repo.getStudent(studentId);
  const a = analyzeStudent(studentId, now);
  if (!student || !a) return [];
  const all = repo.listSkills();
  const byId = new Map(all.map((s) => [s.id, s]));
  const stat = new Map(a.skills.map((s) => [s.skill.id, s]));
  const m = (id: string) => stat.get(id)?.mastery ?? null;
  const secure = (id: string) => (m(id) ?? 0) >= STATUS_THRESHOLDS.gut;
  const out: NextStep[] = [];
  const add = (rule: Rule, id: string, reason: string, count: number, extra: Partial<NextStep> = {}) => {
    const skill = byId.get(id);
    if (!skill || out.some((x) => x.skill.id === id)) return;
    out.push({ rule, skill, mastery: m(id), count, difficulty: difficultyFor(m(id)), reason, ...extra });
  };

  // 1) exam ahead
  const exams = examReminders(o.today, { studentId });
  for (const e of exams) {
    for (const id of [...e.skill_ids].sort((x, y) => (m(x) ?? -1) - (m(y) ?? -1))) {
      if (secure(id)) continue;
      const when = e.days === 0 ? "heute" : e.days === 1 ? "morgen" : `in ${e.days} Tagen`;
      add(1, id, `${e.kind || "Prüfung"} ${when}: ${byId.get(id)?.name} ${masteryStatus(m(id))} (${pct(m(id))})`, m(id) === null ? 3 : 5, { testId: e.id });
    }
  }
  // 2) prerequisites of weak or exam skills
  const focus = [...new Set([...exams.flatMap((e) => e.skill_ids), ...a.weaknesses.map((w) => w.skill.id)])];
  for (const id of focus) {
    for (const p of prerequisitesOf(id)) {
      if (m(p) !== null && !secure(p)) add(2, p, `Voraussetzung für ${byId.get(id)?.name}: ${byId.get(p)?.name} liegt bei ${pct(m(p))}`, 4);
    }
  }
  // 3) recent frequent errors
  for (const e of a.errors) {
    if (e.count < 2 || now - e.lastSeen > RECENT_ERROR_DAYS * DAY) continue;
    const id = e.skillIds.find((x) => byId.get(x)?.parent_id) ?? e.skillIds[0];
    if (id) add(3, id, `Fehler „${e.label}“ ${e.count}× in den letzten ${RECENT_ERROR_DAYS} Tagen`, 5);
  }
  // 4) not practised for a long time
  for (const s of [...a.skills].filter((s) => s.lastPracticed !== null && now - s.lastPracticed > LONG_AGO_DAYS * DAY).sort((x, y) => (x.mastery ?? 0) - (y.mastery ?? 0))) {
    add(4, s.skill.id, `Seit ${Math.round((now - s.lastPracticed!) / DAY)} Tagen nicht geübt (${pct(s.mastery)})`, 4);
  }
  // 5) next skill after one that sits, within the student's level
  const fitting = new Set(skillsForStudent(student, undefined, { earlier: true }).map((s) => s.id));
  for (const s of a.skills.filter((x) => x.mastery !== null && x.mastery >= STATUS_THRESHOLDS.sicher)) {
    for (const n of nextSkillsOf(s.skill.id)) {
      if (fitting.has(n) && m(n) === null && prerequisitesOf(n).every(secure)) add(5, n, `${s.skill.name} sitzt – als Nächstes ${byId.get(n)?.name}`, 3);
    }
  }
  return out.slice(0, o.limit ?? 5);
}
