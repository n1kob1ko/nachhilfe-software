/**
 * Statistik über reale Schülerdaten (Mehr › Statistik): sums over all students, to improve the
 * tutoring and the quality of the tasks. Which skills are hard, which Fehlerarten are common, the
 * average Lernstand per skill, which tasks turn out unusually easy or hard for their difficulty, and
 * which topics come up in Schularbeiten and tests.
 *
 * Plain SQL plus a little TypeScript: deterministic, no AI, nothing leaves the database.
 * Privacy: the result holds counts and rates only. No names, no student ids, no ranking or comparison
 * of students; "students" is always just a number.
 *
 * Counting rules
 * - One answered task (an outcome) is its final attempt (attempts.final = 1).
 *   Erfolg = in the end correct and the solution not viewed.
 *   1. Versuch = correct at the first try without a hint (as for the Lernstand, lib/mastery.ts).
 *   Hilfen = hints opened for the task (hints_used of the final attempt is the running count).
 *   Zeit = sum of time_ms over all tries of the task (time_ms is measured per try); the median is shown.
 * - A wrong try is every attempt with correct = 0 whose solution was not viewed, final or not.
 * - An answer counts for the skills of its task (main skill and task_skills). A merged duplicate
 *   (Mehr › Datenqualität) counts for the skill it was merged into. Parent skills are not added here,
 *   so the same answers do not show up twice.
 * - Filters: Fach = subject of the exercise (tests: their subject). Zeitraum = time of the answer
 *   (tests: their date, planned ones ahead included). Diagnose = exercises with worksheets.kind
 *   'diagnose'. Library entries never have answers and are left out.
 * - Lernstand is today's value per student (analyzeStudent in lib/service.ts) and only follows the
 *   Fach filter: it already weighs recent answers higher and is not a sum over a time window.
 */
import { parseTime } from "./analysis";
import { SUBJECTS } from "./curriculum";
import { db, json } from "./db";
import { errorTypeLabel } from "./error-types";
import { dayOf } from "./exams";
import { splitTopics, statsOf } from "./lehrplan";
import * as repo from "./repo";
import { analyzeStudent } from "./service";
import { GAP } from "./tasks";

const DAY = 86_400_000;

/** A skill is listed under "Schwierige Fähigkeiten" from this many final answers on. */
export const SKILL_MIN = 5;
/** A task is flagged as unusually easy or hard only from this many final answers on. */
export const TASK_MIN = 5;
/** … and only when this many students answered it: one student repeating it in several copies is not enough. */
export const UNUSUAL_MIN_STUDENTS = 3;
/**
 * Success rate a task of difficulty 1–5 should roughly reach: the middle of the bands that
 * lib/lehrplan.ts statsOf uses to suggest a level (≥ 90 % → 1, ≥ 75 % → 2, ≥ 55 % → 3, ≥ 35 % → 4).
 */
export const EXPECTED_SUCCESS: Record<number, number> = { 1: 0.95, 2: 0.8, 3: 0.65, 4: 0.45, 5: 0.25 };
/** "Ungewöhnlich leicht/schwer": the success rate is at least this far (25 percentage points) from the expected one. */
export const UNUSUAL_DEVIATION = 0.25;

/** Diagnosis answers: count them as well (mit), leave them out (ohne), or only them (nur). */
export const DIAGNOSIS_FILTERS = ["mit", "ohne", "nur"] as const;
export type DiagnosisFilter = (typeof DIAGNOSIS_FILTERS)[number];

export type StatisticsFilter = {
  /** Fach; empty = all subjects. */
  subject?: string;
  /** Only the last n days up to `now`; null or missing = everything. */
  days?: number | null;
  /** Default "mit". */
  diagnosis?: DiagnosisFilter;
  /** Point in time in ms (tests). Default: now. */
  now?: number;
};

/** A skill as the statistics show it; `parent` is the name of its parent skill for a Teilfähigkeit. */
export type SkillRef = { id: string; name: string; parent: string | null; area: string; subject: string };

/** a) one skill with at least SKILL_MIN final answers. */
export type SkillDifficulty = {
  skill: SkillRef;
  answers: number;
  /** Number of students with answers (count only). */
  students: number;
  successRate: number;
  firstTryRate: number;
  hintsPerTask: number;
  medianTimeSec: number | null;
};

/** b) wrong tries of one Fehlerart; `confirmed` = set or confirmed by the teacher; `skills` = where it happens most (top 3). */
export type ErrorTypeRow = { type: string; label: string; count: number; confirmed: number; skills: { skill: SkillRef; count: number }[] };

/** c) average Lernstand of one skill over the students that have evidence for it. */
export type SkillMastery = { skill: SkillRef; mean: number; students: number };

/** d) one task, identical copies in several exercises counted together (same text, main skill, format, data and answer). */
export type TaskRow = {
  /** Newest copy with answers, and the exercise it belongs to (link target /uebungen/<worksheetId>). */
  taskId: number;
  worksheetId: number;
  /** The same task in the Aufgabenbibliothek, if it is saved there. */
  libraryId: number | null;
  /** First line of the task text, gaps as "…". */
  prompt: string;
  /** Answer format (tasks.type, lib/curriculum.ts TASK_TYPES). */
  type: string;
  skill: SkillRef | null;
  subject: string;
  /** Difficulty 1–5 of the newest copy. */
  level: number;
  /** Number of exercises with answers to this task. */
  copies: number;
  answers: number;
  students: number;
  successRate: number;
  firstTryRate: number;
  hintsPerTask: number;
  /** Share with a hint or the solution viewed. */
  helpRate: number;
  medianTimeSec: number | null;
  /** Expected success rate for its level (EXPECTED_SUCCESS) and the difference successRate − expected. */
  expected: number;
  deviation: number;
  /** Only from TASK_MIN answers by at least UNUSUAL_MIN_STUDENTS students and with |deviation| ≥ UNUSUAL_DEVIATION. */
  unusual: "leicht" | "schwer" | null;
  /** Level 1–5 the measured success rate points to; only from lehrplan.EMPIRICAL_MIN answers on. */
  suggestedLevel: number | null;
};

/** e) a Thema (skill area, via the linked skills) or a Stichwort (as typed) in Schularbeiten and tests. */
export type TopicRow = { label: string; subject: string; tests: number; students: number; byKind: KindCount[] };
export type KindCount = { kind: string; tests: number };

export type Statistics = {
  filter: { subject: string | null; days: number | null; diagnosis: DiagnosisFilter };
  /** Subjects with any answers or tests, for the filter chips (independent of the filter). */
  subjects: string[];
  totals: { answers: number; wrongTries: number; students: number; tasks: number };
  skills: { rows: SkillDifficulty[]; /** skills with answers, but fewer than SKILL_MIN */ belowMin: number };
  errorTypes: { rows: ErrorTypeRow[]; /** all wrong tries */ wrong: number; /** wrong tries without a Fehlerart */ withoutType: number };
  mastery: SkillMastery[];
  tasks: TaskRow[];
  tests: { total: number; students: number; byKind: KindCount[]; areas: TopicRow[]; topics: TopicRow[] };
};

type AttemptRow = {
  assignment_id: number;
  task_id: number;
  student_id: number;
  skill_id: string | null;
  attempt_no: number;
  correct: number;
  final: number;
  time_ms: number;
  hints_used: number;
  solution_viewed: number;
  error_type: string | null;
  error_type_source: string | null;
  created_at: string;
  worksheet_id: number;
  prompt: string;
  type: string;
  data: string;
  answer: string;
  task_skill_id: string | null;
  task_level: number | null;
  task_skill_ids: string | null;
  subject: string;
};

type Outcome = {
  student: number;
  taskId: number;
  worksheetId: number;
  group: string;
  success: boolean;
  firstTry: boolean;
  hints: number;
  solutionViewed: boolean;
  timeMs: number;
  skills: string[];
};

const de = (a: string, b: string) => a.localeCompare(b, "de");
const share = (part: number, whole: number) => (whole ? part / whole : 0);
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;
const clampLevel = (level: number | null | undefined) => Math.max(1, Math.min(5, Math.round(level ?? 3)));
const byKindList = (m: Map<string, number>): KindCount[] => [...m].map(([kind, tests]) => ({ kind, tests })).sort((a, b) => b.tests - a.tests || de(a.kind, b.kind));

/** First line of a task text, gaps as "…", at most 120 characters. */
function promptLine(prompt: string): string {
  const line = (prompt.replaceAll(GAP, "…").split("\n").find((l) => l.trim()) ?? "").trim();
  return line.length > 120 ? `${line.slice(0, 117).trimEnd()} …` : line || "Aufgabe";
}

/** tasks.data or tasks.answer as JSON with sorted keys, so the same content always gives the same text. */
function canonical(text: string): string {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(sorted(json<unknown>(text, text)));
}

/** Skill lookup that follows merged duplicates to the skill they were merged into. */
function skillLookup() {
  const alias = repo.skillAliases();
  const all = new Map((db().prepare(repo.SKILL_SELECT).all() as repo.Skill[]).map((s) => [s.id, s]));
  const cache = new Map<string, SkillRef | null>();
  const canon = (id: string) => alias.get(id) ?? id;
  const ref = (id: string | null | undefined): SkillRef | null => {
    if (!id) return null;
    const target = canon(id);
    if (!cache.has(target)) {
      const s = all.get(target);
      cache.set(target, s ? { id: s.id, name: s.name, parent: s.parent_id ? (all.get(s.parent_id)?.name ?? null) : null, area: s.area, subject: s.subject } : null);
    }
    return cache.get(target)!;
  };
  return { canon, ref };
}

/** Rates of a list of outcomes; success rate and median time come from lehrplan.statsOf. */
function rates(list: Outcome[]) {
  const s = statsOf(list.map((o) => ({ correct: o.success ? 1 : 0, time_ms: o.timeMs, hints_used: o.hints, solution_viewed: o.solutionViewed ? 1 : 0 })));
  return {
    answers: list.length,
    students: new Set(list.map((o) => o.student)).size,
    successRate: s.successRate ?? 0,
    firstTryRate: share(list.filter((o) => o.firstTry).length, list.length),
    hintsPerTask: share(list.reduce((sum, o) => sum + o.hints, 0), list.length),
    helpRate: s.helpRate ?? 0,
    medianTimeSec: s.medianTimeSec,
    suggestedLevel: s.suggestedLevel,
  };
}

export function statistics(o: StatisticsFilter = {}): Statistics {
  const now = o.now ?? Date.now();
  const subject = o.subject?.trim() || null;
  const days = o.days && o.days > 0 ? Math.max(1, Math.round(o.days)) : null;
  const diagnosis: DiagnosisFilter = o.diagnosis && DIAGNOSIS_FILTERS.includes(o.diagnosis) ? o.diagnosis : "mit";
  const from = days === null ? null : now - days * DAY;
  const { canon, ref } = skillLookup();

  // ---------- answers ----------
  const rows = db()
    .prepare(
      `SELECT a.assignment_id, a.task_id, a.student_id, a.skill_id, a.attempt_no, a.correct, a.final, a.time_ms, a.hints_used, a.solution_viewed,
              a.error_type, a.error_type_source, a.created_at,
              t.worksheet_id, t.prompt, t.type, t.data, t.answer, t.skill_id AS task_skill_id, t.level AS task_level,
              (SELECT json_group_array(ts.skill_id) FROM task_skills ts WHERE ts.task_id = t.id) AS task_skill_ids,
              w.subject
       FROM attempts a JOIN tasks t ON t.id = a.task_id JOIN worksheets w ON w.id = t.worksheet_id
       WHERE w.kind <> 'bibliothek' AND COALESCE(a.review, '') <> 'offen'
         AND (@subject IS NULL OR w.subject = @subject)
         AND (@diagnosis = 'mit' OR (@diagnosis = 'nur' AND w.kind = 'diagnose') OR (@diagnosis = 'ohne' AND w.kind <> 'diagnose'))
       ORDER BY a.assignment_id, a.task_id, a.id`,
    )
    .all({ subject, diagnosis }) as AttemptRow[];

  const skillsOf = (r: AttemptRow) =>
    [...new Set([r.skill_id, r.task_skill_id, ...json<(string | null)[]>(r.task_skill_ids, [])].filter((x): x is string => Boolean(x)).map(canon))].filter((id) => ref(id) !== null);
  // generators reuse one prompt ("Welcher Satz ist richtig geschrieben?") with other options and
  // answers: only copies with the same data and answer are the same task
  const groupKey = (r: Pick<AttemptRow, "prompt" | "type" | "data" | "answer"> & { skill: string | null }) =>
    JSON.stringify([r.prompt.trim(), r.skill ?? "", r.type, canonical(r.data), canonical(r.answer)]);

  const outcomes: Outcome[] = [];
  const wrong: (AttemptRow & { skills: string[] })[] = [];
  /** Per group: the newest copy, its exercise and level, and the copy's subject. */
  const groupInfo = new Map<string, { taskId: number; worksheetId: number; level: number; prompt: string; type: string; skill: string | null; subject: string; worksheets: Set<number> }>();
  const running = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.assignment_id}:${r.task_id}`;
    const timeMs = (running.get(key) ?? 0) + r.time_ms;
    const inWindow = from === null || parseTime(r.created_at) >= from;
    if (!r.correct && !r.solution_viewed && inWindow) wrong.push({ ...r, skills: skillsOf(r) });
    if (!r.final) {
      running.set(key, timeMs);
      continue;
    }
    running.delete(key);
    if (!inWindow) continue;
    const mainSkill = r.task_skill_id ?? r.skill_id;
    const skill = mainSkill ? canon(mainSkill) : null;
    const group = groupKey({ ...r, skill });
    outcomes.push({
      student: r.student_id,
      taskId: r.task_id,
      worksheetId: r.worksheet_id,
      group,
      success: Boolean(r.correct) && !r.solution_viewed,
      firstTry: Boolean(r.correct) && !r.solution_viewed && r.attempt_no <= 1 && !r.hints_used,
      hints: r.hints_used,
      solutionViewed: Boolean(r.solution_viewed),
      timeMs,
      skills: skillsOf(r),
    });
    const info = groupInfo.get(group);
    if (!info || r.task_id > info.taskId) {
      groupInfo.set(group, { taskId: r.task_id, worksheetId: r.worksheet_id, level: clampLevel(r.task_level), prompt: r.prompt, type: r.type, skill, subject: r.subject, worksheets: info?.worksheets ?? new Set() });
    }
    groupInfo.get(group)!.worksheets.add(r.worksheet_id);
  }

  // ---------- a) Schwierige Fähigkeiten ----------
  const bySkill = new Map<string, Outcome[]>();
  for (const out of outcomes) {
    for (const id of out.skills) {
      if (!bySkill.has(id)) bySkill.set(id, []);
      bySkill.get(id)!.push(out);
    }
  }
  let belowMin = 0;
  const skillRows: SkillDifficulty[] = [];
  for (const [id, list] of bySkill) {
    if (list.length < SKILL_MIN) {
      belowMin++;
      continue;
    }
    const r = rates(list);
    skillRows.push({ skill: ref(id)!, answers: r.answers, students: r.students, successRate: r.successRate, firstTryRate: r.firstTryRate, hintsPerTask: r.hintsPerTask, medianTimeSec: r.medianTimeSec });
  }
  skillRows.sort((a, b) => a.successRate - b.successRate || a.firstTryRate - b.firstTryRate || b.answers - a.answers || de(a.skill.name, b.skill.name));

  // ---------- b) Häufige Fehlerarten ----------
  const types = new Map<string, { count: number; confirmed: number; skills: Map<string, number> }>();
  for (const w of wrong) {
    if (!w.error_type) continue;
    const t = types.get(w.error_type) ?? { count: 0, confirmed: 0, skills: new Map<string, number>() };
    t.count++;
    if (w.error_type_source === "lehrer") t.confirmed++;
    for (const id of w.skills) t.skills.set(id, (t.skills.get(id) ?? 0) + 1);
    types.set(w.error_type, t);
  }
  const errorRows: ErrorTypeRow[] = [...types]
    .map(([type, t]) => ({
      type,
      label: errorTypeLabel(type),
      count: t.count,
      confirmed: t.confirmed,
      skills: [...t.skills]
        .map(([id, count]) => ({ skill: ref(id)!, count }))
        .sort((a, b) => b.count - a.count || de(a.skill.name, b.skill.name))
        .slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count || b.confirmed - a.confirmed || de(a.label, b.label));

  // ---------- c) Durchschnittlicher Lernstand ----------
  const masterySum = new Map<string, { sum: number; n: number }>();
  for (const { id } of repo.listStudents()) {
    const analysis = analyzeStudent(id, now);
    if (!analysis) continue;
    for (const s of analysis.skills) {
      if (s.mastery === null || (subject && s.skill.subject !== subject)) continue;
      const m = masterySum.get(s.skill.id) ?? { sum: 0, n: 0 };
      m.sum += s.mastery;
      m.n++;
      masterySum.set(s.skill.id, m);
    }
  }
  const mastery: SkillMastery[] = [...masterySum]
    .flatMap(([id, m]) => {
      const skill = ref(id);
      return skill ? [{ skill, mean: m.sum / m.n, students: m.n }] : [];
    })
    .sort((a, b) => a.mean - b.mean || b.students - a.students || de(a.skill.name, b.skill.name));

  // ---------- d) Aufgaben ----------
  const library = new Map<string, number>();
  for (const t of db()
    .prepare("SELECT t.worksheet_id, t.prompt, t.type, t.data, t.answer, t.skill_id FROM tasks t JOIN worksheets w ON w.id = t.worksheet_id WHERE w.kind = 'bibliothek' ORDER BY t.id")
    .all() as { worksheet_id: number; prompt: string; type: string; data: string; answer: string; skill_id: string | null }[]) {
    library.set(groupKey({ ...t, skill: t.skill_id ? canon(t.skill_id) : null }), t.worksheet_id);
  }
  const byGroup = new Map<string, Outcome[]>();
  for (const out of outcomes) {
    if (!byGroup.has(out.group)) byGroup.set(out.group, []);
    byGroup.get(out.group)!.push(out);
  }
  const taskRows: TaskRow[] = [...byGroup].map(([group, list]) => {
    const info = groupInfo.get(group)!;
    const r = rates(list);
    const expected = EXPECTED_SUCCESS[info.level];
    const deviation = round4(r.successRate - expected);
    const unusual = r.answers >= TASK_MIN && r.students >= UNUSUAL_MIN_STUDENTS && Math.abs(deviation) >= UNUSUAL_DEVIATION ? (deviation > 0 ? "leicht" : "schwer") : null;
    return {
      taskId: info.taskId,
      worksheetId: info.worksheetId,
      libraryId: library.get(group) ?? null,
      prompt: promptLine(info.prompt),
      type: info.type,
      skill: ref(info.skill),
      subject: info.subject,
      level: info.level,
      copies: info.worksheets.size,
      answers: r.answers,
      students: r.students,
      successRate: r.successRate,
      firstTryRate: r.firstTryRate,
      hintsPerTask: r.hintsPerTask,
      helpRate: r.helpRate,
      medianTimeSec: r.medianTimeSec,
      expected,
      deviation,
      unusual,
      suggestedLevel: r.suggestedLevel,
    };
  });
  // unusual ones first, then the ones with enough answers by distance from the expectation, then the
  // ones with fewer answers, most answers first
  const rank = (t: TaskRow) => (t.unusual ? 0 : t.answers >= TASK_MIN ? 1 : 2);
  const distance = (a: TaskRow, b: TaskRow) => Math.abs(b.deviation) - Math.abs(a.deviation);
  taskRows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) < 2 ? distance(a, b) || b.answers - a.answers : b.answers - a.answers || distance(a, b)) ||
      de(a.prompt, b.prompt) ||
      a.taskId - b.taskId,
  );

  // ---------- e) Themen in Tests und Schularbeiten ----------
  const tests = db()
    .prepare(
      `SELECT student_id, kind, subject, topic, topics, skill_ids FROM tests
       WHERE COALESCE(status, 'geschrieben') <> 'abgesagt' AND (@subject IS NULL OR subject = @subject) AND (@from IS NULL OR date >= @from)
       ORDER BY date, id`,
    )
    .all({ subject, from: from === null ? null : dayOf(new Date(from)) }) as { student_id: number; kind: string; subject: string; topic: string; topics: string; skill_ids: string }[];
  type Acc = { subject: string; tests: number; students: Set<number>; kinds: Map<string, number>; spellings: Map<string, number> };
  const areas = new Map<string, Acc>();
  const topics = new Map<string, Acc>();
  const add = (map: Map<string, Acc>, key: string, label: string, subj: string, t: (typeof tests)[number]) => {
    const acc = map.get(key) ?? { subject: subj, tests: 0, students: new Set<number>(), kinds: new Map<string, number>(), spellings: new Map<string, number>() };
    acc.tests++;
    acc.students.add(t.student_id);
    acc.kinds.set(t.kind, (acc.kinds.get(t.kind) ?? 0) + 1);
    acc.spellings.set(label, (acc.spellings.get(label) ?? 0) + 1);
    map.set(key, acc);
  };
  const kinds = new Map<string, number>();
  for (const t of tests) {
    kinds.set(t.kind, (kinds.get(t.kind) ?? 0) + 1);
    const seenAreas = new Set<string>();
    for (const id of json<string[]>(t.skill_ids, [])) {
      const s = ref(id);
      if (!s) continue;
      const key = `${s.subject}|${s.area}`;
      if (seenAreas.has(key)) continue;
      seenAreas.add(key);
      add(areas, key, s.area, s.subject, t);
    }
    const typed = json<string[]>(t.topics, []).filter((x) => typeof x === "string");
    const seenTopics = new Set<string>();
    for (const raw of typed.length ? typed : splitTopics(t.topic ?? "")) {
      const label = raw.replace(/\s+/g, " ").trim();
      if (!label) continue;
      const key = `${t.subject}|${label.toLocaleLowerCase("de")}`;
      if (seenTopics.has(key)) continue;
      seenTopics.add(key);
      add(topics, key, label, t.subject, t);
    }
  }
  const topicRows = (map: Map<string, Acc>): TopicRow[] =>
    [...map.values()]
      .map((acc) => ({
        // the spelling used most often; on a tie the one seen first
        label: [...acc.spellings].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0],
        subject: acc.subject,
        tests: acc.tests,
        students: acc.students.size,
        byKind: byKindList(acc.kinds),
      }))
      .sort((a, b) => b.tests - a.tests || b.students - a.students || de(a.label, b.label) || de(a.subject, b.subject));

  // ---------- subjects for the filter ----------
  const subjects = (
    db()
      .prepare(
        `SELECT DISTINCT w.subject AS subject FROM attempts a JOIN tasks t ON t.id = a.task_id JOIN worksheets w ON w.id = t.worksheet_id WHERE w.kind <> 'bibliothek'
         UNION SELECT DISTINCT subject FROM tests WHERE COALESCE(status, 'geschrieben') <> 'abgesagt'`,
      )
      .all() as { subject: string }[]
  )
    .map((r) => r.subject)
    .filter(Boolean);
  const order = (x: string) => {
    const i = (SUBJECTS as readonly string[]).indexOf(x);
    return i === -1 ? SUBJECTS.length : i;
  };
  subjects.sort((a, b) => order(a) - order(b) || de(a, b));

  return {
    filter: { subject, days, diagnosis },
    subjects,
    totals: {
      answers: outcomes.length,
      wrongTries: wrong.length,
      students: new Set([...outcomes.map((x) => x.student), ...wrong.map((x) => x.student_id)]).size,
      tasks: byGroup.size,
    },
    skills: { rows: skillRows, belowMin },
    errorTypes: { rows: errorRows, wrong: wrong.length, withoutType: wrong.filter((w) => !w.error_type).length },
    mastery,
    tasks: taskRows,
    tests: { total: tests.length, students: new Set(tests.map((t) => t.student_id)).size, byKind: byKindList(kinds), areas: topicRows(areas), topics: topicRows(topics) },
  };
}
