import crypto from "node:crypto";
import { db, json } from "./db";
import type { TaskDraft } from "./tasks";

export type Teacher = { id: number; name: string; active: number };

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
};

export type Skill = { id: string; subject: string; area: string; name: string; grade_min: number; grade_max: number; sort: number };

export type Lesson = {
  id: number;
  student_id: number;
  teacher_id: number | null;
  /** 'stunde' = tutoring lesson, 'selbststaendig' = written automatically from the student's own practice. */
  kind: "stunde" | "selbststaendig";
  assignment_id: number | null;
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
  kind: "uebung" | "ueberpruefung";
  source: "ki" | "generator";
  skill_ids: string[];
  created_at: string;
};

export type Task = TaskDraft & { id: number; worksheet_id: number; position: number };

export type Assignment = {
  id: number;
  worksheet_id: number;
  student_id: number;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  note: string;
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
};

type Row = Record<string, unknown>;

const toStudent = (r: Row): Student => ({ ...(r as unknown as Student), subjects: json(r.subjects as string, []) });
const toLesson = (r: Row): Lesson => ({ ...(r as unknown as Lesson), skill_ids: json(r.skill_ids as string, []) });
const toTest = (r: Row): TestResult => ({ ...(r as unknown as TestResult), skill_ids: json(r.skill_ids as string, []) });
const toWorksheet = (r: Row): Worksheet => ({ ...(r as unknown as Worksheet), skill_ids: json(r.skill_ids as string, []) });
const toTask = (r: Row): Task => ({
  id: r.id as number,
  worksheet_id: r.worksheet_id as number,
  position: r.position as number,
  type: r.type as Task["type"],
  skillId: (r.skill_id as string) ?? null,
  difficulty: r.difficulty as Task["difficulty"],
  prompt: r.prompt as string,
  data: json(r.data as string, {}),
  answer: json(r.answer as string, {}),
  solution: r.solution as string,
  hints: json(r.hints as string, []),
  errorMap: json(r.error_map as string, []),
});

// ---------- teachers ----------
export function listTeachers(): Teacher[] {
  return db().prepare("SELECT * FROM teachers WHERE active = 1 ORDER BY name COLLATE NOCASE").all() as Teacher[];
}
export function getTeacher(id: number | null): Teacher | null {
  if (!id) return null;
  return (db().prepare("SELECT * FROM teachers WHERE id = ?").get(id) as Teacher | undefined) ?? null;
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
export type StudentInput = Omit<Student, "id" | "access_token" | "created_at">;
export function createStudent(s: StudentInput): number {
  const token = crypto.randomBytes(9).toString("base64url");
  const res = db()
    .prepare(
      `INSERT INTO students (name, grade, klasse, teacher_id, school, school_type, subjects, current_topics, strengths_note, weaknesses_note, goals, notes, access_token)
       VALUES (@name, @grade, @klasse, @teacher_id, @school, @school_type, @subjects, @current_topics, @strengths_note, @weaknesses_note, @goals, @notes, @token)`,
    )
    .run({ ...s, subjects: JSON.stringify(s.subjects), token });
  return Number(res.lastInsertRowid);
}
export function updateStudent(id: number, s: StudentInput) {
  db()
    .prepare(
      `UPDATE students SET name=@name, grade=@grade, klasse=@klasse, teacher_id=@teacher_id, school=@school, school_type=@school_type, subjects=@subjects, current_topics=@current_topics,
       strengths_note=@strengths_note, weaknesses_note=@weaknesses_note, goals=@goals, notes=@notes WHERE id=@id`,
    )
    .run({ ...s, subjects: JSON.stringify(s.subjects), id });
}
export function deleteStudent(id: number) {
  db().prepare("DELETE FROM students WHERE id = ?").run(id);
}

// ---------- skills ----------
export function listSkills(): Skill[] {
  return db().prepare("SELECT * FROM skills ORDER BY sort, subject, area, name").all() as Skill[];
}
export function getSkill(id: string): Skill | null {
  return (db().prepare("SELECT * FROM skills WHERE id = ?").get(id) as Skill | undefined) ?? null;
}
export function createSkill(subject: string, area: string, name: string, gradeMin: number, gradeMax: number) {
  const slug = (x: string) =>
    x
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24);
  let id = `${slug(subject)}.${slug(area)}.${slug(name)}`;
  if (getSkill(id)) id += `.${Date.now().toString(36)}`;
  const sort = (db().prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM skills").get() as { s: number }).s;
  db().prepare("INSERT INTO skills (id, subject, area, name, grade_min, grade_max, sort) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, subject, area, name, gradeMin, gradeMax, sort);
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
export type LessonInput = Omit<Lesson, "id" | "kind" | "assignment_id"> & Partial<Pick<Lesson, "kind" | "assignment_id">>;
export function saveLesson(l: LessonInput, id?: number): number {
  const params = { kind: "stunde", assignment_id: null, ...l, skill_ids: JSON.stringify(l.skill_ids) };
  if (id) {
    db()
      .prepare(
        `UPDATE lessons SET teacher_id=@teacher_id, starts_at=@starts_at, duration_min=@duration_min, subject=@subject, topic=@topic, status=@status, activities=@activities,
         mistakes=@mistakes, understanding=@understanding, tutor_notes=@tutor_notes, next_steps=@next_steps, skill_ids=@skill_ids WHERE id=@id`,
      )
      .run({ ...params, id });
    return id;
  }
  const res = db()
    .prepare(
      `INSERT INTO lessons (student_id, teacher_id, kind, assignment_id, starts_at, duration_min, subject, topic, status, activities, mistakes, understanding, tutor_notes, next_steps, skill_ids)
       VALUES (@student_id, @teacher_id, @kind, @assignment_id, @starts_at, @duration_min, @subject, @topic, @status, @activities, @mistakes, @understanding, @tutor_notes, @next_steps, @skill_ids)`,
    )
    .run(params);
  return Number(res.lastInsertRowid);
}
export function deleteLesson(id: number) {
  db().prepare("DELETE FROM lessons WHERE id = ?").run(id);
}
export function getLessonForAssignment(assignmentId: number): Lesson | null {
  const r = db().prepare("SELECT * FROM lessons WHERE assignment_id = ?").get(assignmentId) as Row | undefined;
  return r ? toLesson(r) : null;
}

export type BillingFilter = { from: string; to: string; teacherId?: number | null; studentId?: number | null };
export type BillingRow = { id: number; student_id: number; starts_at: string; duration_min: number; teacher_name: string | null; student_name: string; subject: string; topic: string; tutor_notes: string };
/** Completed tutoring lessons only; automatic practice entries are not billed. */
export function billingEntries(f: BillingFilter): BillingRow[] {
  return db()
    .prepare(
      `SELECT l.id, l.student_id, l.starts_at, l.duration_min, t.name AS teacher_name, s.name AS student_name, l.subject, l.topic, l.tutor_notes
       FROM lessons l JOIN students s ON s.id = l.student_id LEFT JOIN teachers t ON t.id = l.teacher_id
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
export function addTest(t: Omit<TestResult, "id">) {
  db()
    .prepare(
      "INSERT INTO tests (student_id, date, subject, kind, topic, grade, points, max_points, notes, skill_ids) VALUES (@student_id, @date, @subject, @kind, @topic, @grade, @points, @max_points, @notes, @skill_ids)",
    )
    .run({ ...t, skill_ids: JSON.stringify(t.skill_ids) });
}
export function deleteTest(id: number) {
  db().prepare("DELETE FROM tests WHERE id = ?").run(id);
}

// ---------- worksheets ----------
export function createWorksheet(w: Omit<Worksheet, "id" | "created_at">, tasks: TaskDraft[]): number {
  const conn = db();
  const tx = conn.transaction(() => {
    const res = conn
      .prepare("INSERT INTO worksheets (title, subject, grade, school_type, klasse, topic, difficulty, task_type, kind, source, skill_ids) VALUES (@title, @subject, @grade, @school_type, @klasse, @topic, @difficulty, @task_type, @kind, @source, @skill_ids)")
      .run({ ...w, skill_ids: JSON.stringify(w.skill_ids) });
    const wid = Number(res.lastInsertRowid);
    const ins = conn.prepare(
      "INSERT INTO tasks (worksheet_id, position, type, skill_id, difficulty, prompt, data, answer, solution, hints, error_map) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    tasks.forEach((t, i) =>
      ins.run(wid, i + 1, t.type, t.skillId, t.difficulty, t.prompt, JSON.stringify(t.data), JSON.stringify(t.answer), t.solution, JSON.stringify(t.hints), JSON.stringify(t.errorMap)),
    );
    return wid;
  });
  return tx();
}
export function listWorksheets(): (Worksheet & { task_count: number; assigned: number })[] {
  return db()
    .prepare(
      `SELECT w.*, (SELECT COUNT(*) FROM tasks t WHERE t.worksheet_id = w.id) AS task_count,
              (SELECT COUNT(*) FROM assignments a WHERE a.worksheet_id = w.id) AS assigned
       FROM worksheets w ORDER BY w.created_at DESC, w.id DESC`,
    )
    .all()
    .map((r) => ({ ...toWorksheet(r as Row), task_count: (r as Row).task_count as number, assigned: (r as Row).assigned as number }));
}
export function getWorksheet(id: number): Worksheet | null {
  const r = db().prepare("SELECT * FROM worksheets WHERE id = ?").get(id) as Row | undefined;
  return r ? toWorksheet(r) : null;
}
export function deleteWorksheet(id: number) {
  db().prepare("DELETE FROM worksheets WHERE id = ?").run(id);
}
export function listTasks(worksheetId: number): Task[] {
  return db().prepare("SELECT * FROM tasks WHERE worksheet_id = ? ORDER BY position").all(worksheetId).map((r) => toTask(r as Row));
}
export function getTask(id: number): Task | null {
  const r = db().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Row | undefined;
  return r ? toTask(r) : null;
}

// ---------- assignments & attempts ----------
export function assignWorksheet(worksheetId: number, studentId: number, note = ""): number {
  const res = db().prepare("INSERT INTO assignments (worksheet_id, student_id, note) VALUES (?, ?, ?)").run(worksheetId, studentId, note);
  return Number(res.lastInsertRowid);
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
export function listAttemptsForStudent(studentId: number): Attempt[] {
  return db().prepare("SELECT * FROM attempts WHERE student_id = ? ORDER BY created_at, id").all(studentId) as Attempt[];
}
export function recordAttempt(a: Omit<Attempt, "id" | "created_at"> & { created_at?: string }) {
  const res = db()
    .prepare(
      `INSERT INTO attempts (assignment_id, task_id, student_id, skill_id, attempt_no, answer, correct, final, time_ms, hints_used, solution_viewed, error_label, feedback, created_at)
       VALUES (@assignment_id, @task_id, @student_id, @skill_id, @attempt_no, @answer, @correct, @final, @time_ms, @hints_used, @solution_viewed, @error_label, @feedback, COALESCE(@created_at, datetime('now')))`,
    )
    .run({ created_at: null, ...a });
  return Number(res.lastInsertRowid);
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
