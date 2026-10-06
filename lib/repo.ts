import crypto from "node:crypto";
import { db, json } from "./db";
import type { TaskDraft } from "./tasks";
import { checkLevel } from "./school";
import { levelOf } from "./curriculum";

export type Teacher = { id: number; name: string; active: number; username: string; is_admin: number; must_change_password: number };
const TEACHER_COLS = "id, name, active, username, is_admin, must_change_password";

export type Student = {
  id: number;
  name: string;
  /** Internal Schulstufe (1–13), derived from school_type + klasse. */
  grade: number;
  klasse: number | null;
  teacher_id: number | null;
  school: string;
  school_type: string;
  subjects: string[];
  current_topics: string;
  strengths_note: string;
  weaknesses_note: string;
  goals: string;
  notes: string;
  access_token: string;
  created_at: string;
  /** 'unklar' when school type, class and Schulstufe do not fit together; curriculum content is then not narrowed down. */
  stufe_status?: "eindeutig" | "unklar";
};

export type Skill = {
  id: string;
  subject: string;
  /** Thema, e.g. "Bruchrechnung" */
  area: string;
  name: string;
  /** Schulstufen the skill is meant for (1–13). */
  grade_min: number;
  grade_max: number;
  sort: number;
  /** Teilfähigkeit of this skill. */
  parent_id: string | null;
  /** Stable code, e.g. AT-MAT-05-BRUCHRECHNUNG-DIVIDIEREN (lib/skill-code.ts). */
  code?: string | null;
  subtopic?: string;
  /** '' = all school types, else a comma list ("Volksschule"). */
  school_types?: string;
  learning_objective?: string;
  description?: string;
  competency_area?: string;
  content_area?: string;
  action_area?: string;
  source_id?: number | null;
  version?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  status?: "aktiv" | "archiviert";
  /** Own note from Mehr › Datenqualität: in practice usually taught earlier or later than the curriculum says. */
  practice_shift?: "" | "frueher" | "spaeter";
  /** Set when this skill was merged into another one as a duplicate. */
  merged_into?: string | null;
};

export type Lesson = {
  id: number;
  student_id: number;
  teacher_id: number | null;
  /** 'stunde' = tutoring lesson, 'selbststaendig' = written automatically from the student's own practice. */
  kind: "stunde" | "selbststaendig";
  assignment_id: number | null;
  /** Set when the lesson is the Lern-Dokumentation of a unit. */
  unit_id: number | null;
  /** Generated at the end of the unit. */
  summary: string;
  /** JSON of the generated UnitReport (lib/learning.ts). */
  report: string | null;
  concentration: number | null;
  motivation: number | null;
  participation: number | null;
  difficulties: string;
  positives: string;
  review_topics: string;
  homework_note: string;
  /** When the teacher looked over and saved the generated documentation. */
  reviewed_at: string | null;
  starts_at: string;
  duration_min: number;
  subject: string;
  topic: string;
  status: "geplant" | "abgeschlossen" | "abgesagt";
  activities: string;
  mistakes: string;
  understanding: number | null;
  tutor_notes: string;
  next_steps: string;
  skill_ids: string[];
  /** Note for parents or the student, written from the unit summary (lib/summary.ts): source fakten | ki | lehrer. */
  family_note?: string;
  family_note_source?: string;
};

export type Homework = { id: number; student_id: number; subject: string; description: string; due_date: string | null; status: string; notes: string };
export type TestResult = {
  id: number;
  student_id: number;
  date: string;
  subject: string;
  kind: string;
  topic: string;
  grade: number | null;
  points: number | null;
  max_points: number | null;
  notes: string;
  skill_ids: string[];
  /** e.g. "2. Mathematik-Schularbeit"; empty for older rows */
  title?: string;
  /** Stoff as the teacher typed it ("Brüche", "Prozentrechnung" …) */
  topics?: string[];
  /** geplant → geschrieben (with result) or abgesagt */
  status?: "geplant" | "geschrieben" | "abgesagt";
  teacher_id?: number | null;
  created_at?: string | null;
};

export type Worksheet = {
  id: number;
  title: string;
  subject: string;
  grade: number;
  school_type: string;
  klasse: number | null;
  topic: string;
  difficulty: string;
  task_type: string;
  /** uebung, ueberpruefung (check after practice), diagnose (Diagnose-Modus), bibliothek (one saved task of the Aufgabenbibliothek). */
  kind: "uebung" | "ueberpruefung" | "diagnose" | "bibliothek";
  source: "ki" | "generator" | "manuell";
  skill_ids: string[];
  created_at: string;
  /** Student it was made for (prefilled builder); assignments decide who actually works on it. */
  student_id: number | null;
  /** "entwurf" until the teacher has checked and released it; students never see drafts. */
  status: "entwurf" | "freigegeben";
  teacher_id: number | null;
  /** Builder settings it was made with (JSON), used for templates and regenerating. */
  settings: string | null;
  source_worksheet_id: number | null;
  /** Tags of a library entry (kind = bibliothek). */
  tags: string[];
};

export type Task = TaskDraft & { id: number; worksheet_id: number; position: number; level: number | null };
export type WorksheetInput = Omit<Worksheet, "id" | "created_at" | "student_id" | "status" | "teacher_id" | "settings" | "source_worksheet_id" | "tags"> &
  Partial<Pick<Worksheet, "student_id" | "status" | "teacher_id" | "settings" | "source_worksheet_id" | "tags">>;

export type Assignment = {
  id: number;
  worksheet_id: number;
  student_id: number;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  note: string;
  /** Unit that was running when it was assigned. */
  unit_id: number | null;
  /** Teacher has opened the solutions for the student. */
  solutions_visible: number;
  /** When the exercise was shown on the student tablet; null while it has not arrived there. */
  delivered_at: string | null;
};

export type Attempt = {
  id: number;
  assignment_id: number;
  task_id: number;
  student_id: number;
  skill_id: string | null;
  attempt_no: number;
  answer: string;
  correct: number;
  final: number;
  time_ms: number;
  hints_used: number;
  solution_viewed: number;
  error_label: string | null;
  feedback: string;
  created_at: string;
  unit_id: number | null;
  /** Time with interaction on the page; null for older attempts. */
  active_ms: number | null;
  /** All skills of the task, including parent skills (filled by listAttemptsForStudent). */
  skill_ids?: string[];
  /** Teacher of the unit (or the student's teacher) when the answer was given. */
  teacher_id?: number | null;
  /** Difficulty 1–5 of the task at that moment. */
  level?: number | null;
  /** Fehlerart (lib/error-types.ts) and where it came from: vorschlag | lehrer | ki. */
  error_type?: string | null;
  error_type_source?: string | null;
  error_type_suggested?: string | null;
  /** Who made error_type_suggested: vorschlag (the app) or ki (free-text grading). */
  error_type_suggested_source?: string | null;
  error_type_by?: number | null;
  error_type_at?: string | null;
};

type Row = Record<string, unknown>;

const toStudent = (r: Row): Student => ({ ...(r as unknown as Student), subjects: json(r.subjects as string, []) });
const toLesson = (r: Row): Lesson => ({ ...(r as unknown as Lesson), skill_ids: json(r.skill_ids as string, []) });
const toTest = (r: Row): TestResult => ({ ...(r as unknown as TestResult), skill_ids: json(r.skill_ids as string, []), topics: json(r.topics as string, []) });
const toWorksheet = (r: Row): Worksheet => ({ ...(r as unknown as Worksheet), skill_ids: json(r.skill_ids as string, []), tags: json(r.tags as string, []) });
const toTask = (r: Row): Task => ({
  id: r.id as number,
  worksheet_id: r.worksheet_id as number,
  position: r.position as number,
  type: r.type as Task["type"],
  skillId: (r.skill_id as string) ?? null,
  skillIds: r.skill_ids_json ? json<string[]>(r.skill_ids_json as string, []).filter(Boolean) : r.skill_id ? [r.skill_id as string] : [],
  category: (r.category as string) ?? null,
  difficulty: r.difficulty as Task["difficulty"],
  prompt: r.prompt as string,
  data: json(r.data as string, {}),
  answer: json(r.answer as string, {}),
  solution: r.solution as string,
  hints: json(r.hints as string, []),
  errorMap: json(r.error_map as string, []),
  solutionSteps: json(r.solution_steps as string, []),
  estimatedTimeSec: (r.estimated_time_sec as number | null) ?? null,
  sourceType: (r.source_type as string) ?? "eigen",
  sourceId: (r.source_id as number | null) ?? null,
  level: (r.level as number | null) ?? null,
});

// ---------- teachers ----------
export function listTeachers(): Teacher[] {
  return db().prepare(`SELECT ${TEACHER_COLS} FROM teachers WHERE active = 1 ORDER BY name COLLATE NOCASE`).all() as Teacher[];
}
export function listAllTeachers(): Teacher[] {
  return db().prepare(`SELECT ${TEACHER_COLS} FROM teachers ORDER BY active DESC, name COLLATE NOCASE`).all() as Teacher[];
}
export function getTeacher(id: number | null): Teacher | null {
  if (!id) return null;
  return (db().prepare(`SELECT ${TEACHER_COLS} FROM teachers WHERE id = ?`).get(id) as Teacher | undefined) ?? null;
}

// ---------- students ----------
export function listStudents(): Student[] {
  return db().prepare("SELECT * FROM students ORDER BY name COLLATE NOCASE").all().map((r) => toStudent(r as Row));
}
export function getStudent(id: number): Student | null {
  const r = db().prepare("SELECT * FROM students WHERE id = ?").get(id) as Row | undefined;
  return r ? toStudent(r) : null;
}
export function getStudentByToken(token: string): Student | null {
  const r = db().prepare("SELECT * FROM students WHERE access_token = ?").get(token) as Row | undefined;
  return r ? toStudent(r) : null;
}
export type StudentInput = Omit<Student, "id" | "access_token" | "created_at" | "stufe_status">;
export function createStudent(s: StudentInput): number {
  const token = crypto.randomBytes(9).toString("base64url");
  const res = db()
    .prepare(
      `INSERT INTO students (name, grade, klasse, teacher_id, school, school_type, subjects, current_topics, strengths_note, weaknesses_note, goals, notes, access_token, stufe_status)
       VALUES (@name, @grade, @klasse, @teacher_id, @school, @school_type, @subjects, @current_topics, @strengths_note, @weaknesses_note, @goals, @notes, @token, @stufe_status)`,
    )
    .run({ ...s, subjects: JSON.stringify(s.subjects), token, stufe_status: checkLevel(s.school_type, s.klasse, s.grade).status });
  return Number(res.lastInsertRowid);
}
export function updateStudent(id: number, s: StudentInput) {
  db()
    .prepare(
      `UPDATE students SET name=@name, grade=@grade, klasse=@klasse, teacher_id=@teacher_id, school=@school, school_type=@school_type, subjects=@subjects, current_topics=@current_topics,
       strengths_note=@strengths_note, weaknesses_note=@weaknesses_note, goals=@goals, notes=@notes, stufe_status=@stufe_status WHERE id=@id`,
    )
    .run({ ...s, subjects: JSON.stringify(s.subjects), id, stufe_status: checkLevel(s.school_type, s.klasse, s.grade).status });
}
export function deleteStudent(id: number) {
  db().prepare("DELETE FROM students WHERE id = ?").run(id);
}

// ---------- skills ----------
/**
 * Skills as the app works with them: own corrections from Mehr › Datenqualität (skill_overrides) are
 * laid over the stored row. The row itself, with every imported or official value, is never changed.
 */
export const SKILL_SELECT = `SELECT s.id, s.subject, COALESCE(o.area, s.area) AS area, s.name, COALESCE(o.grade_min, s.grade_min) AS grade_min,
  COALESCE(o.grade_max, s.grade_max) AS grade_max, s.sort, s.parent_id, s.code, COALESCE(o.subtopic, s.subtopic) AS subtopic, s.school_types,
  s.learning_objective, s.description, s.competency_area, s.content_area, s.action_area, s.source_id, s.version, s.valid_from, s.valid_to,
  s.status, COALESCE(o.practice_shift, '') AS practice_shift, o.merged_into
  FROM skills s LEFT JOIN skill_overrides o ON o.skill_id = s.id`;
/** Every skill except duplicates that were merged into another one (their answers count for the other). */
export function listSkills(): Skill[] {
  return db().prepare(`${SKILL_SELECT} WHERE o.merged_into IS NULL ORDER BY s.sort, s.subject, area, s.name`).all() as Skill[];
}
/** One skill, also a merged duplicate (old answers and exercises still show its name). */
export function getSkill(id: string): Skill | null {
  return (db().prepare(`${SKILL_SELECT} WHERE s.id = ?`).get(id) as Skill | undefined) ?? null;
}
/** Merged duplicate → the skill it was merged into (Mehr › Datenqualität). */
export function skillAliases(): Map<string, string> {
  const rows = db().prepare("SELECT skill_id, merged_into FROM skill_overrides WHERE merged_into IS NOT NULL").all() as { skill_id: string; merged_into: string }[];
  const map = new Map(rows.map((r) => [r.skill_id, r.merged_into]));
  // a chain a → b → c ends at c
  for (const [k] of map) {
    let to = map.get(k)!;
    for (let guard = 0; map.has(to) && guard < 8; guard++) to = map.get(to)!;
    map.set(k, to);
  }
  return map;
}
export function createSkill(subject: string, area: string, name: string, gradeMin: number, gradeMax: number, parentId: string | null = null) {
  const slug = (x: string) =>
    x
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24);
  let id = `${slug(subject)}.${slug(area)}.${slug(name)}`;
  if (getSkill(id)) id += `.${Date.now().toString(36)}`;
  const sort = (db().prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM skills").get() as { s: number }).s;
  db().prepare("INSERT INTO skills (id, subject, area, name, grade_min, grade_max, sort, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, subject, area, name, gradeMin, gradeMax, sort, parentId);
  return id;
}

// ---------- lessons ----------
export function listLessons(studentId: number): Lesson[] {
  return db().prepare("SELECT * FROM lessons WHERE student_id = ? ORDER BY starts_at DESC").all(studentId).map((r) => toLesson(r as Row));
}
export function lessonsBetween(from: string, to: string): (Lesson & { student_name: string; teacher_name: string | null })[] {
  return db()
    .prepare(
      `SELECT l.*, s.name AS student_name, t.name AS teacher_name FROM lessons l JOIN students s ON s.id = l.student_id LEFT JOIN teachers t ON t.id = l.teacher_id
       WHERE l.kind = 'stunde' AND starts_at >= ? AND starts_at < ? ORDER BY starts_at`,
    )
    .all(from, to)
    .map((r) => ({ ...toLesson(r as Row), student_name: (r as Row).student_name as string, teacher_name: (r as Row).teacher_name as string | null }));
}
export function getLesson(id: number): Lesson | null {
  const r = db().prepare("SELECT * FROM lessons WHERE id = ?").get(id) as Row | undefined;
  return r ? toLesson(r) : null;
}
type LessonExtras = "kind" | "assignment_id" | "unit_id" | "summary" | "report" | "concentration" | "motivation" | "participation" | "difficulties" | "positives" | "review_topics" | "homework_note" | "reviewed_at";
export type LessonInput = Omit<Lesson, "id" | LessonExtras> & Partial<Pick<Lesson, LessonExtras>>;
const LESSON_DEFAULTS = {
  kind: "stunde",
  assignment_id: null,
  unit_id: null,
  summary: "",
  report: null,
  concentration: null,
  motivation: null,
  participation: null,
  difficulties: "",
  positives: "",
  review_topics: "",
  homework_note: "",
  reviewed_at: null,
};
export function saveLesson(l: LessonInput, id?: number): number {
  const existing = id ? getLesson(id) : null;
  // fields the caller leaves out keep their stored value
  const params = { ...LESSON_DEFAULTS, ...(existing ?? {}), ...l, skill_ids: JSON.stringify(l.skill_ids) };
  if (id) {
    db()
      .prepare(
        `UPDATE lessons SET teacher_id=@teacher_id, starts_at=@starts_at, duration_min=@duration_min, subject=@subject, topic=@topic, status=@status, activities=@activities,
         mistakes=@mistakes, understanding=@understanding, tutor_notes=@tutor_notes, next_steps=@next_steps, skill_ids=@skill_ids, unit_id=@unit_id,
         summary=@summary, report=@report, concentration=@concentration, motivation=@motivation, participation=@participation, difficulties=@difficulties,
         positives=@positives, review_topics=@review_topics, homework_note=@homework_note, reviewed_at=@reviewed_at WHERE id=@id`,
      )
      .run({ ...params, id });
    return id;
  }
  const res = db()
    .prepare(
      `INSERT INTO lessons (student_id, teacher_id, kind, assignment_id, unit_id, starts_at, duration_min, subject, topic, status, activities, mistakes, understanding, tutor_notes, next_steps, skill_ids,
         summary, report, concentration, motivation, participation, difficulties, positives, review_topics, homework_note, reviewed_at)
       VALUES (@student_id, @teacher_id, @kind, @assignment_id, @unit_id, @starts_at, @duration_min, @subject, @topic, @status, @activities, @mistakes, @understanding, @tutor_notes, @next_steps, @skill_ids,
         @summary, @report, @concentration, @motivation, @participation, @difficulties, @positives, @review_topics, @homework_note, @reviewed_at)`,
    )
    .run(params);
  return Number(res.lastInsertRowid);
}
export function setFamilyNote(lessonId: number, text: string, source: "fakten" | "ki" | "lehrer" | "") {
  db().prepare("UPDATE lessons SET family_note = ?, family_note_source = ? WHERE id = ?").run(text.slice(0, 4000), text.trim() ? source : "", lessonId);
}
export function deleteLesson(id: number) {
  db().prepare("DELETE FROM lessons WHERE id = ?").run(id);
}
export function getLessonForUnit(unitId: number): Lesson | null {
  const r = db().prepare("SELECT * FROM lessons WHERE unit_id = ?").get(unitId) as Row | undefined;
  return r ? toLesson(r) : null;
}
export function listAttemptsForUnit(unitId: number): Attempt[] {
  return db().prepare("SELECT * FROM attempts WHERE unit_id = ? ORDER BY created_at, id").all(unitId) as Attempt[];
}
export function getLessonForAssignment(assignmentId: number): Lesson | null {
  const r = db().prepare("SELECT * FROM lessons WHERE assignment_id = ?").get(assignmentId) as Row | undefined;
  return r ? toLesson(r) : null;
}

export type BillingFilter = { from: string; to: string; teacherId?: number | null; studentId?: number | null };
export type BillingRow = {
  id: number;
  student_id: number;
  starts_at: string;
  duration_min: number;
  teacher_name: string | null;
  student_name: string;
  subject: string;
  topic: string;
  tutor_notes: string;
  /** From the Basis-Dokumentation, when the lesson was a unit. */
  unit_id: number | null;
  unit_start: string | null;
  unit_end: string | null;
  unit_end_estimated: number | null;
};
/** Completed tutoring lessons only; automatic practice entries are not billed. */
export function billingEntries(f: BillingFilter): BillingRow[] {
  return db()
    .prepare(
      `SELECT l.id, l.student_id, l.starts_at, l.duration_min, t.name AS teacher_name, s.name AS student_name, l.subject, l.topic, l.tutor_notes,
              l.unit_id, u.started_at AS unit_start, u.ended_at AS unit_end, u.end_estimated AS unit_end_estimated
       FROM lessons l JOIN students s ON s.id = l.student_id LEFT JOIN teachers t ON t.id = l.teacher_id LEFT JOIN units u ON u.id = l.unit_id
       WHERE l.kind = 'stunde' AND l.status = 'abgeschlossen' AND l.starts_at >= @from AND l.starts_at < @to
         AND (@teacherId IS NULL OR l.teacher_id = @teacherId) AND (@studentId IS NULL OR l.student_id = @studentId)
       ORDER BY l.starts_at, s.name COLLATE NOCASE`,
    )
    .all({ from: f.from, to: f.to, teacherId: f.teacherId || null, studentId: f.studentId || null }) as BillingRow[];
}

// ---------- homework & tests ----------
export function listHomework(studentId: number): Homework[] {
  return db().prepare("SELECT * FROM homework WHERE student_id = ? ORDER BY status = 'erledigt', due_date").all(studentId) as Homework[];
}
export function openHomeworkDue(until: string): (Homework & { student_name: string })[] {
  return db()
    .prepare("SELECT h.*, s.name AS student_name FROM homework h JOIN students s ON s.id = h.student_id WHERE h.status = 'offen' AND h.due_date IS NOT NULL AND h.due_date <= ? ORDER BY h.due_date")
    .all(until) as (Homework & { student_name: string })[];
}
export function addHomework(h: Omit<Homework, "id">) {
  db().prepare("INSERT INTO homework (student_id, subject, description, due_date, status, notes) VALUES (@student_id, @subject, @description, @due_date, @status, @notes)").run(h);
}
export function setHomeworkStatus(id: number, status: string) {
  db().prepare("UPDATE homework SET status = ? WHERE id = ?").run(status, id);
}
export function deleteHomework(id: number) {
  db().prepare("DELETE FROM homework WHERE id = ?").run(id);
}
export function listTests(studentId: number): TestResult[] {
  return db().prepare("SELECT * FROM tests WHERE student_id = ? ORDER BY date DESC").all(studentId).map((r) => toTest(r as Row));
}
export function addTest(t: Omit<TestResult, "id">): number {
  const res = db()
    .prepare(
      `INSERT INTO tests (student_id, date, subject, kind, topic, grade, points, max_points, notes, skill_ids, title, topics, status, teacher_id, created_at)
       VALUES (@student_id, @date, @subject, @kind, @topic, @grade, @points, @max_points, @notes, @skill_ids, @title, @topics, @status, @teacher_id, datetime('now'))`,
    )
    .run({
      title: "",
      teacher_id: null,
      ...t,
      status: t.status ?? (t.grade == null && t.points == null && t.date > new Date().toISOString().slice(0, 10) ? "geplant" : "geschrieben"),
      skill_ids: JSON.stringify(t.skill_ids),
      topics: JSON.stringify(t.topics ?? []),
    });
  return Number(res.lastInsertRowid);
}
export function getTest(id: number): TestResult | null {
  const r = db().prepare("SELECT * FROM tests WHERE id = ?").get(id) as Row | undefined;
  return r ? toTest(r) : null;
}
/** Result of a Schularbeit/Test after it was written. */
export function setTestResult(id: number, r: { grade: number | null; points: number | null; max_points: number | null; notes?: string }) {
  db()
    .prepare("UPDATE tests SET grade = @grade, points = @points, max_points = @max_points, notes = COALESCE(@notes, notes), status = 'geschrieben' WHERE id = @id")
    .run({ notes: null, ...r, id });
}
export function setTestSkills(id: number, skillIds: string[]) {
  db().prepare("UPDATE tests SET skill_ids = ? WHERE id = ?").run(JSON.stringify(skillIds), id);
}
export function setTestStatus(id: number, status: "geplant" | "geschrieben" | "abgesagt") {
  db().prepare("UPDATE tests SET status = ? WHERE id = ?").run(status, id);
}
/** Planned Schularbeiten and tests from `from` (YYYY-MM-DD) on, all students or one. */
export function upcomingTests(from: string, studentId?: number): (TestResult & { student_name: string })[] {
  return db()
    .prepare(
      `SELECT t.*, s.name AS student_name FROM tests t JOIN students s ON s.id = t.student_id
       WHERE t.status = 'geplant' AND t.date >= @from AND (@sid IS NULL OR t.student_id = @sid) ORDER BY t.date, s.name`,
    )
    .all({ from, sid: studentId ?? null })
    .map((r) => ({ ...toTest(r as Row), student_name: (r as Row).student_name as string }));
}
export function deleteTest(id: number) {
  db().prepare("DELETE FROM tests WHERE id = ?").run(id);
}

// ---------- worksheets ----------
const TASK_SELECT = "SELECT t.*, (SELECT json_group_array(ts.skill_id) FROM task_skills ts WHERE ts.task_id = t.id) AS skill_ids_json FROM tasks t";

function insertTask(worksheetId: number, position: number, t: TaskDraft): number {
  const conn = db();
  const id = Number(
    conn
      .prepare(
        `INSERT INTO tasks (worksheet_id, position, type, category, skill_id, difficulty, prompt, data, answer, solution, hints, error_map, level, solution_steps, estimated_time_sec, source_type, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        worksheetId, position, t.type, t.category ?? null, t.skillId, t.difficulty, t.prompt, JSON.stringify(t.data), JSON.stringify(t.answer), t.solution, JSON.stringify(t.hints), JSON.stringify(t.errorMap),
        levelOf(t.difficulty), JSON.stringify(t.solutionSteps ?? []), t.estimatedTimeSec ?? null, ...taskOrigin(worksheetId, t),
      ).lastInsertRowid,
  );
  writeTaskSkills(id, t);
  return id;
}
/** Where a new task comes from: given by the draft (copies keep their origin) or derived from its exercise. */
function taskOrigin(worksheetId: number, t: TaskDraft): [string, number | null] {
  const ws = db().prepare("SELECT source FROM worksheets WHERE id = ?").get(worksheetId) as { source: string } | undefined;
  const type = t.sourceType ?? (ws?.source === "ki" ? "ki" : "eigen");
  const id = t.sourceId ?? ((db().prepare("SELECT id FROM content_sources WHERE key = ?").get(type === "ki" ? "claude" : "lernheft") as { id: number } | undefined)?.id ?? null);
  return [type, id];
}
function writeTaskSkills(taskId: number, t: Pick<TaskDraft, "skillId" | "skillIds">) {
  const conn = db();
  conn.prepare("DELETE FROM task_skills WHERE task_id = ?").run(taskId);
  const ins = conn.prepare("INSERT OR IGNORE INTO task_skills (task_id, skill_id) VALUES (?, ?)");
  for (const id of new Set([t.skillId, ...(t.skillIds ?? [])].filter((x): x is string => Boolean(x)))) ins.run(taskId, id);
}
/** Worksheet skill list = every skill of its tasks (kept in sync after edits). */
function syncWorksheetSkills(worksheetId: number) {
  const ids = (db().prepare("SELECT DISTINCT ts.skill_id FROM task_skills ts JOIN tasks t ON t.id = ts.task_id WHERE t.worksheet_id = ? ORDER BY t.position").all(worksheetId) as { skill_id: string }[]).map((r) => r.skill_id);
  if (ids.length) db().prepare("UPDATE worksheets SET skill_ids = ? WHERE id = ?").run(JSON.stringify(ids), worksheetId);
}

export function createWorksheet(w: WorksheetInput, tasks: TaskDraft[]): number {
  const conn = db();
  const tx = conn.transaction(() => {
    const res = conn
      .prepare(
        `INSERT INTO worksheets (title, subject, grade, school_type, klasse, topic, difficulty, task_type, kind, source, skill_ids, student_id, status, teacher_id, settings, source_worksheet_id, tags)
         VALUES (@title, @subject, @grade, @school_type, @klasse, @topic, @difficulty, @task_type, @kind, @source, @skill_ids, @student_id, @status, @teacher_id, @settings, @source_worksheet_id, @tags)`,
      )
      .run({ student_id: null, status: "freigegeben", teacher_id: null, settings: null, source_worksheet_id: null, ...w, skill_ids: JSON.stringify(w.skill_ids), tags: JSON.stringify(w.tags ?? []) });
    const wid = Number(res.lastInsertRowid);
    tasks.forEach((t, i) => insertTask(wid, i + 1, t));
    if (tasks.length) syncWorksheetSkills(wid);
    return wid;
  });
  return tx();
}
/** Exercises (and diagnoses); library entries are listed in the Aufgabenbibliothek (lib/library.ts). */
export function listWorksheets(): (Worksheet & { task_count: number; assigned: number; recipients: string[] })[] {
  return db()
    .prepare(
      `SELECT w.*, (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = w.id) AS task_count,
              (SELECT COUNT(*) FROM assignments a WHERE a.worksheet_id = w.id) AS assigned,
              (SELECT GROUP_CONCAT(s.name, '|') FROM assignments a JOIN students s ON s.id = a.student_id WHERE a.worksheet_id = w.id) AS recipients
       FROM worksheets w WHERE w.kind <> 'bibliothek' ORDER BY w.created_at DESC, w.id DESC`,
    )
    .all()
    .map((r) => ({
      ...toWorksheet(r as Row),
      task_count: (r as Row).task_count as number,
      assigned: (r as Row).assigned as number,
      recipients: (((r as Row).recipients as string | null) ?? "").split("|").filter(Boolean),
    }));
}
export function getWorksheet(id: number): Worksheet | null {
  const r = db().prepare("SELECT * FROM worksheets WHERE id = ?").get(id) as Row | undefined;
  return r ? toWorksheet(r) : null;
}
export function deleteWorksheet(id: number) {
  db().prepare("DELETE FROM worksheets WHERE id = ?").run(id);
}
export function listTasks(worksheetId: number): Task[] {
  return db().prepare(`${TASK_SELECT} WHERE t.worksheet_id = ? ORDER BY t.position, t.id`).all(worksheetId).map((r) => toTask(r as Row));
}
export function getTask(id: number): Task | null {
  const r = db().prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as Row | undefined;
  return r ? toTask(r) : null;
}

// ---------- editing exercises (preview before release) ----------
export function updateWorksheetMeta(id: number, m: Partial<Pick<Worksheet, "title" | "difficulty" | "status" | "student_id" | "settings">>) {
  const cur = getWorksheet(id);
  if (!cur) return;
  const next = { ...cur, ...m };
  db().prepare("UPDATE worksheets SET title = ?, difficulty = ?, status = ?, student_id = ?, settings = ? WHERE id = ?").run(next.title, next.difficulty, next.status, next.student_id, next.settings, id);
}
/** A one-task exercise remembers which task it was cut from, for "Nächste Aufgabe senden". */
export function setSourceTask(worksheetId: number, taskId: number) {
  db().prepare("UPDATE worksheets SET source_task_id = ? WHERE id = ?").run(taskId, worksheetId);
}
/** Number of answers given to tasks of this worksheet; tasks with answers are not changed in place. */
export function worksheetAttemptCount(worksheetId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM attempts x JOIN tasks t ON t.id = x.task_id WHERE t.worksheet_id = ?").get(worksheetId) as { n: number }).n;
}
export function updateTask(id: number, t: TaskDraft) {
  const cur = getTask(id);
  if (!cur) return;
  db()
    .prepare("UPDATE tasks SET type = ?, category = ?, skill_id = ?, difficulty = ?, prompt = ?, data = ?, answer = ?, solution = ?, hints = ?, error_map = ?, level = ? WHERE id = ?")
    .run(t.type, t.category ?? null, t.skillId, t.difficulty, t.prompt, JSON.stringify(t.data), JSON.stringify(t.answer), t.solution, JSON.stringify(t.hints), JSON.stringify(t.errorMap), levelOf(t.difficulty), id);
  writeTaskSkills(id, t);
  syncWorksheetSkills(cur.worksheet_id);
}
export function addTask(worksheetId: number, t: TaskDraft, afterTaskId?: number): number {
  const conn = db();
  return conn.transaction(() => {
    const tasks = listTasks(worksheetId);
    const at = afterTaskId ? tasks.findIndex((x) => x.id === afterTaskId) + 1 : tasks.length;
    const id = insertTask(worksheetId, at + 1, t);
    const order = [...tasks.slice(0, at).map((x) => x.id), id, ...tasks.slice(at).map((x) => x.id)];
    renumber(order);
    syncWorksheetSkills(worksheetId);
    return id;
  })();
}
export function deleteTask(id: number) {
  const t = getTask(id);
  if (!t) return;
  db().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  renumber(listTasks(t.worksheet_id).map((x) => x.id));
  syncWorksheetSkills(t.worksheet_id);
}
/** Moves a task up (-1) or down (+1). */
export function moveTask(id: number, dir: -1 | 1) {
  const t = getTask(id);
  if (!t) return;
  const ids = listTasks(t.worksheet_id).map((x) => x.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  renumber(ids);
}
function renumber(ids: number[]) {
  const up = db().prepare("UPDATE tasks SET position = ? WHERE id = ?");
  ids.forEach((id, i) => up.run(i + 1, id));
}
/**
 * Copy of an exercise as a new draft (for another student, or to adapt it). A copy of a library entry
 * or of a diagnosis is an ordinary exercise unless `kind` says otherwise (duplicating inside the
 * library); a diagnosis only comes from the Diagnose-Modus, so single tasks of it are no new diagnoses.
 */
export function duplicateWorksheet(
  id: number,
  o: { studentId?: number | null; teacherId?: number | null; title?: string; status?: Worksheet["status"]; taskIds?: number[]; kind?: Worksheet["kind"] } = {},
): number | null {
  const w = getWorksheet(id);
  if (!w) return null;
  const tasks = listTasks(id).filter((t) => !o.taskIds || o.taskIds.includes(t.id));
  const kind = o.kind ?? (w.kind === "bibliothek" || w.kind === "diagnose" ? "uebung" : w.kind);
  return createWorksheet(
    {
      ...w,
      kind,
      tags: kind === "bibliothek" ? w.tags : [],
      title: o.title ?? w.title,
      student_id: o.studentId === undefined ? w.student_id : o.studentId,
      teacher_id: o.teacherId ?? w.teacher_id,
      status: o.status ?? "entwurf",
      source_worksheet_id: id,
    },
    tasks,
  );
}
/** Tasks from the library and other exercises to reuse: best matches for the given skills first, library entries before copies in exercises. */
export function searchTasks(q: { skillIds?: string[]; text?: string; subject?: string; excludeWorksheetId?: number; limit?: number }): (Task & { worksheet_title: string; worksheet_kind: Worksheet["kind"] })[] {
  const where: string[] = ["1 = 1"];
  const params: unknown[] = [];
  if (q.subject) {
    where.push("w.subject = ?");
    params.push(q.subject);
  }
  if (q.excludeWorksheetId) {
    where.push("t.worksheet_id <> ?");
    params.push(q.excludeWorksheetId);
  }
  if (q.text?.trim()) {
    where.push("t.prompt LIKE ?");
    params.push(`%${q.text.trim()}%`);
  }
  const skills = q.skillIds?.length ? q.skillIds : null;
  const rows = db()
    .prepare(
      `SELECT t.*, w.title AS worksheet_title, w.kind AS worksheet_kind,
        (SELECT json_group_array(ts.skill_id) FROM task_skills ts WHERE ts.task_id = t.id) AS skill_ids_json,
        ${skills ? `(SELECT COUNT(*) FROM task_skills ts WHERE ts.task_id = t.id AND ts.skill_id IN (${skills.map(() => "?").join(",")}))` : "0"} AS matches
       FROM tasks t JOIN worksheets w ON w.id = t.worksheet_id
       WHERE ${where.join(" AND ")}
       ORDER BY matches DESC, w.kind = 'bibliothek' DESC, t.id DESC LIMIT ?`,
    )
    .all(...(skills ?? []), ...params, q.limit ?? 30) as Row[];
  // drop exact duplicates (the same task copied into several exercises)
  const seen = new Set<string>();
  return rows
    .map((r) => ({ ...toTask(r), worksheet_title: r.worksheet_title as string, worksheet_kind: r.worksheet_kind as Worksheet["kind"] }))
    .filter((t) => (seen.has(t.prompt) ? false : (seen.add(t.prompt), true)));
}

// ---------- templates ----------
export type Template = { id: number; name: string; subject: string; settings: string; source_worksheet_id: number | null; teacher_id: number | null; used_count: number; created_at: string };
export function listTemplates(): (Template & { task_count: number | null })[] {
  return db()
    .prepare(
      `SELECT tp.*, (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = tp.source_worksheet_id) AS task_count
       FROM worksheet_templates tp ORDER BY tp.used_count DESC, tp.name`,
    )
    .all() as (Template & { task_count: number | null })[];
}
export function getTemplate(id: number): Template | null {
  return (db().prepare("SELECT * FROM worksheet_templates WHERE id = ?").get(id) as Template | undefined) ?? null;
}
export function createTemplate(t: Omit<Template, "id" | "used_count" | "created_at">): number {
  return Number(
    db()
      .prepare("INSERT INTO worksheet_templates (name, subject, settings, source_worksheet_id, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(t.name, t.subject, t.settings, t.source_worksheet_id, t.teacher_id, new Date().toISOString()).lastInsertRowid,
  );
}
export function noteTemplateUsed(id: number) {
  db().prepare("UPDATE worksheet_templates SET used_count = used_count + 1 WHERE id = ?").run(id);
}
export function deleteTemplate(id: number) {
  db().prepare("DELETE FROM worksheet_templates WHERE id = ?").run(id);
}

// ---------- hints ----------
export function recordHintUse(h: { assignment_id: number; task_id: number; student_id: number; hint_index: number; unit_id: number | null }) {
  db()
    .prepare("INSERT OR IGNORE INTO hint_uses (assignment_id, task_id, student_id, hint_index, unit_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(h.assignment_id, h.task_id, h.student_id, h.hint_index, h.unit_id, new Date().toISOString());
}
export function hintUsesForAssignment(assignmentId: number) {
  return db().prepare("SELECT task_id, hint_index, created_at FROM hint_uses WHERE assignment_id = ? ORDER BY id").all(assignmentId) as { task_id: number; hint_index: number; created_at: string }[];
}

// ---------- assignments & attempts ----------
export function assignWorksheet(worksheetId: number, studentId: number, note = "", unitId: number | null = null): number {
  const res = db().prepare("INSERT INTO assignments (worksheet_id, student_id, note, unit_id) VALUES (?, ?, ?, ?)").run(worksheetId, studentId, note, unitId);
  // students only ever see released exercises
  db().prepare("UPDATE worksheets SET status = 'freigegeben' WHERE id = ?").run(worksheetId);
  return Number(res.lastInsertRowid);
}
export function listAssignmentsForWorksheet(worksheetId: number) {
  return db()
    .prepare(
      `SELECT a.*, s.name AS student_name,
        (SELECT COUNT(DISTINCT task_id) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1) AS done_count,
        (SELECT COUNT(*) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1 AND x.correct = 1) AS correct_count
       FROM assignments a JOIN students s ON s.id = a.student_id WHERE a.worksheet_id = ? ORDER BY a.assigned_at DESC, a.id DESC`,
    )
    .all(worksheetId) as (Assignment & { student_name: string; done_count: number; correct_count: number })[];
}
export function setSolutionsVisible(assignmentId: number, visible: boolean) {
  db().prepare("UPDATE assignments SET solutions_visible = ? WHERE id = ?").run(visible ? 1 : 0, assignmentId);
}
export type AssignmentView = Assignment & {
  title: string;
  subject: string;
  kind: string;
  difficulty: string;
  skill_ids: string[];
  task_count: number;
  done_count: number;
  correct_count: number;
};
export function listAssignments(studentId: number): AssignmentView[] {
  return db()
    .prepare(
      `SELECT a.*, w.title, w.subject, w.kind, w.difficulty, w.skill_ids,
        (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = w.id) AS task_count,
        (SELECT COUNT(DISTINCT task_id) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1) AS done_count,
        (SELECT COUNT(*) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1 AND x.correct = 1) AS correct_count
       FROM assignments a JOIN worksheets w ON w.id = a.worksheet_id WHERE a.student_id = ? ORDER BY a.assigned_at DESC, a.id DESC`,
    )
    .all(studentId)
    .map((r) => ({ ...(r as unknown as AssignmentView), skill_ids: json((r as Row).skill_ids as string, []) }));
}
export function getAssignment(id: number): Assignment | null {
  return (db().prepare("SELECT * FROM assignments WHERE id = ?").get(id) as Assignment | undefined) ?? null;
}
export function deleteAssignment(id: number) {
  db().prepare("DELETE FROM assignments WHERE id = ?").run(id);
}
export function markAssignmentStarted(id: number) {
  db().prepare("UPDATE assignments SET started_at = COALESCE(started_at, datetime('now')) WHERE id = ?").run(id);
}
export function completeAssignmentIfDone(id: number) {
  const a = getAssignment(id);
  if (!a || a.completed_at) return;
  const { total } = db().prepare("SELECT COUNT(*) AS total FROM tasks WHERE worksheet_id = ?").get(a.worksheet_id) as { total: number };
  const { done } = db().prepare("SELECT COUNT(DISTINCT task_id) AS done FROM attempts WHERE assignment_id = ? AND final = 1").get(id) as { done: number };
  if (done >= total) db().prepare("UPDATE assignments SET completed_at = datetime('now') WHERE id = ?").run(id);
}
export function listAttemptsForAssignment(assignmentId: number): Attempt[] {
  return db().prepare("SELECT * FROM attempts WHERE assignment_id = ? ORDER BY id").all(assignmentId) as Attempt[];
}
/**
 * All answers of a student. skill_ids lists every skill the answer counts for: the task's skills
 * and the skills they belong to (an answer on "Kehrwert korrekt bilden" also counts for "Dividieren").
 */
export function listAttemptsForStudent(studentId: number): Attempt[] {
  const parents = new Map((db().prepare("SELECT id, parent_id FROM skills WHERE parent_id IS NOT NULL").all() as { id: string; parent_id: string }[]).map((r) => [r.id, r.parent_id]));
  const withAncestors = (ids: string[]) => {
    const out = new Set<string>();
    for (let id of ids) {
      for (let guard = 0; id && !out.has(id) && guard < 8; guard++) {
        out.add(id);
        id = parents.get(id) ?? "";
      }
    }
    return [...out];
  };
  return (
    db()
      .prepare(
        `SELECT a.*, (SELECT json_group_array(ts.skill_id) FROM task_skills ts WHERE ts.task_id = a.task_id) AS task_skill_ids,
           (SELECT t.level FROM tasks t WHERE t.id = a.task_id) AS task_level
         FROM attempts a WHERE a.student_id = ? ORDER BY a.created_at, a.id`,
      )
      .all(studentId) as (Attempt & { task_skill_ids: string; task_level: number | null })[]
  ).map(({ task_skill_ids, task_level, ...a }) => ({
    ...a,
    // answers saved before attempts stored the difficulty take it from their task
    level: a.level ?? task_level ?? null,
    skill_ids: withAncestors([a.skill_id, ...json<(string | null)[]>(task_skill_ids, [])].filter((x): x is string => Boolean(x))),
  }));
}
export function recordAttempt(
  a: Omit<Attempt, "id" | "created_at" | "unit_id" | "active_ms" | "skill_ids" | "teacher_id" | "level" | "error_type" | "error_type_source" | "error_type_suggested" | "error_type_suggested_source" | "error_type_by" | "error_type_at"> & {
    created_at?: string;
    unit_id?: number | null;
    active_ms?: number | null;
    teacher_id?: number | null;
    level?: number | null;
    error_type?: string | null;
    error_type_source?: string | null;
  },
) {
  const res = db()
    .prepare(
      `INSERT INTO attempts (assignment_id, task_id, student_id, skill_id, attempt_no, answer, correct, final, time_ms, hints_used, solution_viewed, error_label, feedback, unit_id, active_ms, teacher_id, level,
         error_type, error_type_source, error_type_suggested, error_type_suggested_source, error_type_at, created_at)
       VALUES (@assignment_id, @task_id, @student_id, @skill_id, @attempt_no, @answer, @correct, @final, @time_ms, @hints_used, @solution_viewed, @error_label, @feedback, @unit_id, @active_ms, @teacher_id, @level,
         @error_type, @error_type_source,
         CASE WHEN @error_type_source IN ('vorschlag', 'ki') THEN @error_type END, CASE WHEN @error_type IS NOT NULL AND @error_type_source IN ('vorschlag', 'ki') THEN @error_type_source END,
         CASE WHEN @error_type IS NOT NULL THEN COALESCE(@created_at, datetime('now')) END,
         COALESCE(@created_at, datetime('now')))`,
    )
    .run({ created_at: null, unit_id: null, active_ms: null, teacher_id: null, level: null, error_type: null, error_type_source: null, ...a });
  return Number(res.lastInsertRowid);
}
/**
 * The teacher sets or confirms the Fehlerart of a wrong answer (null clears it). The automatic
 * suggestion (the app's or the AI's) stays in error_type_suggested, so it is always visible what was changed.
 */
export function setAttemptErrorType(attemptId: number, type: string | null, teacherId: number | null, at = new Date()) {
  db()
    .prepare("UPDATE attempts SET error_type = ?, error_type_source = ?, error_type_by = ?, error_type_at = ? WHERE id = ? AND correct = 0")
    .run(type, type ? "lehrer" : null, teacherId, at.toISOString(), attemptId);
}
export function getAttempt(id: number): Attempt | null {
  return (db().prepare("SELECT * FROM attempts WHERE id = ?").get(id) as Attempt | undefined) ?? null;
}
export function recentActivity(limit = 8) {
  return db()
    .prepare(
      `SELECT a.id AS assignment_id, s.id AS student_id, s.name AS student_name, w.title, a.completed_at,
        (SELECT COUNT(*) FROM attempts x WHERE x.assignment_id = a.id AND x.final = 1 AND x.correct = 1) AS correct_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = w.id) AS task_count
       FROM assignments a JOIN students s ON s.id = a.student_id JOIN worksheets w ON w.id = a.worksheet_id
       WHERE a.completed_at IS NOT NULL ORDER BY a.completed_at DESC LIMIT ?`,
    )
    .all(limit) as { assignment_id: number; student_id: number; student_name: string; title: string; completed_at: string; correct_count: number; task_count: number }[];
}
