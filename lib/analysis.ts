/**
 * Learning analytics: turns attempts, lesson notes and test results into a per-skill
 * mastery estimate, trends and frequent errors. What to practise next is decided in one place,
 * lib/recommend.ts, from this analysis. Everything here is deterministic and works without AI.
 */
import type { AssignmentView, Attempt, Lesson, Skill, Student, TestResult } from "./repo";

import { levelWeight, masteryAt, SOURCE_WEIGHT, taskScore, type Evidence } from "./mastery";
export { masteryAt, taskScore, type Evidence };
export type Trend = "up" | "flat" | "down" | "none";

export type SkillStat = {
  skill: Skill;
  mastery: number | null;
  evidence: number;
  trend: Trend;
  delta: number | null;
  lastPracticed: number | null;
  tasksDone: number;
  firstTryRate: number | null;
  avgTimeSec: number | null;
  hintRate: number | null;
};

export type AreaStat = { subject: string; area: string; mastery: number | null; trend: Trend; delta: number | null; skills: SkillStat[] };
export type SubjectStat = { subject: string; mastery: number | null; trend: Trend; delta: number | null; areas: AreaStat[] };
export type ErrorStat = { label: string; count: number; skillIds: string[]; lastSeen: number };
/** Wrong answers per Fehlerart (lib/error-types.ts); `confirmed` = set or confirmed by the teacher. */
export type ErrorTypeStat = { type: string; count: number; confirmed: number; skillIds: string[]; lastSeen: number };

export type Analysis = {
  skills: SkillStat[];
  subjects: SubjectStat[];
  strengths: SkillStat[];
  weaknesses: SkillStat[];
  review: SkillStat[];
  errors: ErrorStat[];
  errorTypes: ErrorTypeStat[];
  overall: { mastery: number | null; trend: Trend; delta: number | null };
  mainProblem: SkillStat | null;
  summary: string[];
  history: { label: string; points: { at: number; mastery: number | null }[] }[];
};

const DAY = 86_400_000;
export const WEAK = 0.6;
/** Note on assignments made from a recommendation (lib/recommend.ts reads it back). */
export const RECOMMENDATION_NOTE = "Empfehlung";
export const STRONG = 0.8;

export function parseTime(s: string): number {
  // SQLite datetime('now') is UTC without zone; ISO dates from forms are local.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return Date.parse(s.replace(" ", "T") + "Z");
  return Date.parse(s);
}

const GRADE_SCORE: Record<number, number> = { 1: 0.95, 2: 0.82, 3: 0.68, 4: 0.52, 5: 0.25 };

/** Skills an answer counts for: all skills of its task and their parent skills, if known. */
export const skillsOf = (a: Pick<Attempt, "skill_id" | "skill_ids">): string[] => (a.skill_ids?.length ? a.skill_ids : a.skill_id ? [a.skill_id] : []);

export function collectEvidence(attempts: Attempt[], lessons: Lesson[], tests: TestResult[], o: { careless?: boolean } = {}): Evidence[] {
  const ev: Evidence[] = [];
  for (const a of attempts) {
    if (!a.final) continue;
    // harder tasks say more about a skill (lib/mastery.ts)
    for (const skillId of skillsOf(a)) ev.push({ skillId, score: taskScore(a, o), weight: SOURCE_WEIGHT.aufgabe * levelWeight(a.level), at: parseTime(a.created_at), source: "aufgabe" });
  }
  for (const l of lessons) {
    // automatic entries summarise attempts that are already counted above
    if (l.kind === "selbststaendig" || l.status !== "abgeschlossen" || !l.understanding) continue;
    for (const id of l.skill_ids) ev.push({ skillId: id, score: (l.understanding - 1) / 4, weight: SOURCE_WEIGHT.stunde, at: parseTime(l.starts_at), source: "stunde" });
  }
  for (const t of tests) {
    const score = t.points != null && t.max_points ? t.points / t.max_points : t.grade ? GRADE_SCORE[t.grade] : null;
    if (score == null) continue;
    for (const id of t.skill_ids) ev.push({ skillId: id, score, weight: SOURCE_WEIGHT.test, at: parseTime(t.date), source: "test" });
  }
  return ev.sort((a, b) => a.at - b.at);
}

function trendOf(items: Evidence[], now: number): { trend: Trend; delta: number | null } {
  if (items.length < 3) return { trend: "none", delta: null };
  const current = masteryAt(items, now)!;
  let before = masteryAt(items, now - 28 * DAY);
  if (before === null || items.filter((e) => e.at <= now - 28 * DAY).length < 2) {
    if (items.length < 4) return { trend: "none", delta: null };
    before = masteryAt(items, items[Math.floor(items.length / 2) - 1].at);
  }
  const delta = Math.round((current - (before ?? current)) * 100);
  return { trend: delta >= 5 ? "up" : delta <= -5 ? "down" : "flat", delta };
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function splitMistakes(text: string) {
  return text
    .split(/[\n;•]+/)
    .map((s) => s.replace(/^[-–*\s]+/, "").trim())
    .filter((s) => s.length > 2 && s.length < 80);
}

export const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}\u00a0%`);

export function computeAnalysis(input: {
  student: Student;
  skills: Skill[];
  attempts: Attempt[];
  lessons: Lesson[];
  tests: TestResult[];
  assignments: AssignmentView[];
  now?: number;
  /** Flüchtigkeitsfehler marked by the teacher count milder (lib/mastery.ts); default on. */
  careless?: boolean;
}): Analysis {
  const now = input.now ?? Date.now();
  const evidence = collectEvidence(input.attempts, input.lessons, input.tests, { careless: input.careless });
  const bySkill = new Map<string, Evidence[]>();
  for (const e of evidence) bySkill.set(e.skillId, [...(bySkill.get(e.skillId) ?? []), e]);

  const finals = input.attempts.filter((a) => a.final);
  const relevantSubjects = new Set([...input.student.subjects, ...evidence.map((e) => input.skills.find((s) => s.id === e.skillId)?.subject).filter(Boolean)]);

  const skillStats: SkillStat[] = input.skills
    .filter((s) => relevantSubjects.has(s.subject))
    .map((skill) => {
      const items = bySkill.get(skill.id) ?? [];
      const f = finals.filter((a) => skillsOf(a).includes(skill.id));
      const { trend, delta } = trendOf(items, now);
      return {
        skill,
        mastery: masteryAt(items, now),
        evidence: items.reduce((a, e) => a + e.weight, 0),
        trend,
        delta,
        lastPracticed: items.length ? items[items.length - 1].at : null,
        tasksDone: f.length,
        firstTryRate: f.length ? f.filter((a) => a.correct && a.attempt_no === 1 && !a.hints_used).length / f.length : null,
        avgTimeSec: f.length ? Math.round(input.attempts.filter((a) => skillsOf(a).includes(skill.id)).reduce((s, a) => s + a.time_ms, 0) / f.length / 1000) : null,
        hintRate: f.length ? f.filter((a) => a.hints_used > 0 || a.solution_viewed).length / f.length : null,
      };
    });

  const subjects: SubjectStat[] = [];
  for (const subject of [...new Set(skillStats.map((s) => s.skill.subject))]) {
    const areas: AreaStat[] = [];
    for (const area of [...new Set(skillStats.filter((s) => s.skill.subject === subject).map((s) => s.skill.area))]) {
      const sk = skillStats.filter((s) => s.skill.subject === subject && s.skill.area === area);
      const items = evidence.filter((e) => sk.some((s) => s.skill.id === e.skillId));
      areas.push({ subject, area, mastery: mean(sk.filter((s) => s.mastery !== null).map((s) => s.mastery!)), ...trendOf(items, now), skills: sk });
    }
    const items = evidence.filter((e) => skillStats.some((s) => s.skill.subject === subject && s.skill.id === e.skillId));
    subjects.push({ subject, mastery: mean(areas.filter((a) => a.mastery !== null).map((a) => a.mastery!)), ...trendOf(items, now), areas });
  }

  const known = skillStats.filter((s) => s.mastery !== null && s.evidence >= 2);
  const strengths = known.filter((s) => s.mastery! >= STRONG).sort((a, b) => b.mastery! - a.mastery!);
  const weaknesses = known.filter((s) => s.mastery! < WEAK).sort((a, b) => a.mastery! - b.mastery!);
  const review = known
    .filter((s) => s.mastery! >= WEAK && (s.trend === "down" || (s.mastery! < STRONG + 0.05 && s.lastPracticed !== null && now - s.lastPracticed > 21 * DAY)))
    .sort((a, b) => a.mastery! - b.mastery!);

  // frequent errors
  const errMap = new Map<string, ErrorStat>();
  const addErr = (label: string, skillIds: string[], at: number) => {
    const key = label.toLowerCase();
    const e = errMap.get(key) ?? { label, count: 0, skillIds: [], lastSeen: 0 };
    e.count++;
    e.lastSeen = Math.max(e.lastSeen, at);
    for (const id of skillIds) if (!e.skillIds.includes(id)) e.skillIds.push(id);
    errMap.set(key, e);
  };
  for (const a of input.attempts) if (!a.correct && a.error_label) addErr(a.error_label, skillsOf(a), parseTime(a.created_at));
  for (const l of input.lessons) if (l.kind !== "selbststaendig") for (const m of splitMistakes(l.mistakes)) addErr(m, l.skill_ids, parseTime(l.starts_at));
  const errors = [...errMap.values()].sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen);
  const typeMap = new Map<string, ErrorTypeStat>();
  for (const a of input.attempts) {
    if (a.correct || a.solution_viewed || !a.error_type) continue;
    const e = typeMap.get(a.error_type) ?? { type: a.error_type, count: 0, confirmed: 0, skillIds: [], lastSeen: 0 };
    e.count++;
    if (a.error_type_source === "lehrer") e.confirmed++;
    e.lastSeen = Math.max(e.lastSeen, parseTime(a.created_at));
    for (const id of skillsOf(a)) if (!e.skillIds.includes(id)) e.skillIds.push(id);
    typeMap.set(a.error_type, e);
  }
  const errorTypes = [...typeMap.values()].sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen);

  const overallItems = evidence;
  const overall = { mastery: mean(subjects.filter((s) => s.mastery !== null).map((s) => s.mastery!)), ...trendOf(overallItems, now) };
  const mainProblem = weaknesses[0] ?? null;

  // summary
  const first = input.student.name.split(" ")[0];
  const summary: string[] = [];
  for (const subj of subjects) {
    for (const area of subj.areas) {
      if (area.mastery === null) continue;
      const weak = area.skills.filter((s) => weaknesses.includes(s));
      if (weak.length && area.mastery >= WEAK) {
        summary.push(`${first} kann ${area.area} grundsätzlich (${pct(area.mastery)}), hat aber Probleme bei ${weak.map((w) => `„${w.skill.name}“ (${pct(w.mastery)})`).join(" und ")}.`);
      } else if (weak.length) {
        summary.push(`${area.area} sitzt noch nicht (${pct(area.mastery)}); am schwächsten: ${weak.map((w) => `„${w.skill.name}“ (${pct(w.mastery)})`).join(", ")}.`);
      }
    }
  }
  if (strengths.length) summary.push(`Sicher beherrscht: ${strengths.slice(0, 4).map((s) => `${s.skill.name} (${pct(s.mastery)})`).join(", ")}.`);
  if (overall.trend !== "none") {
    const word = overall.trend === "up" ? "verbessert sich" : overall.trend === "down" ? "hat sich zuletzt verschlechtert" : "ist stabil";
    summary.push(`${first} ${word} (${overall.delta! > 0 ? "+" : ""}${overall.delta} Prozentpunkte in den letzten 4 Wochen).`);
  }
  if (errors[0] && errors[0].count >= 2) summary.push(`Häufigster Fehler: „${errors[0].label}“ (${errors[0].count}×).`);
  if (summary.length === 0) summary.push("Noch zu wenig Daten. Sobald Übungen bearbeitet oder Einheiten dokumentiert sind, erscheint hier die Auswertung.");

  // history per area (weekly), for the progress chart
  const topAreas = subjects
    .flatMap((s) => s.areas)
    .map((a) => ({ a, n: evidence.filter((e) => a.skills.some((s) => s.skill.id === e.skillId)).length }))
    .filter((x) => x.n >= 2)
    .sort((x, y) => y.n - x.n)
    .slice(0, 4);
  const start = evidence.length ? Math.max(evidence[0].at, now - 12 * 7 * DAY) : now;
  const weeks: number[] = [];
  for (let t = now; t >= start - 7 * DAY && weeks.length < 13; t -= 7 * DAY) weeks.unshift(t);
  const history = topAreas.map(({ a }) => ({
    label: `${a.area}`,
    points: weeks.map((t) => {
      const vals = a.skills.map((s) => masteryAt(bySkill.get(s.skill.id) ?? [], t)).filter((v): v is number => v !== null);
      return { at: t, mastery: vals.length ? mean(vals) : null };
    }),
  }));

  return { skills: skillStats, subjects, strengths, weaknesses, review, errors, errorTypes, overall, mainProblem, summary, history };
}
