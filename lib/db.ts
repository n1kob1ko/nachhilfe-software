import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CURRICULUM } from "./curriculum";
import { migrateLegacy } from "./school";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  school TEXT NOT NULL DEFAULT '',
  school_type TEXT NOT NULL DEFAULT '',
  subjects TEXT NOT NULL DEFAULT '[]',
  current_topics TEXT NOT NULL DEFAULT '',
  strengths_note TEXT NOT NULL DEFAULT '',
  weaknesses_note TEXT NOT NULL DEFAULT '',
  goals TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  access_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  area TEXT NOT NULL,
  name TEXT NOT NULL,
  grade_min INTEGER NOT NULL DEFAULT 1,
  grade_max INTEGER NOT NULL DEFAULT 13,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'geplant',
  activities TEXT NOT NULL DEFAULT '',
  mistakes TEXT NOT NULL DEFAULT '',
  understanding INTEGER,
  tutor_notes TEXT NOT NULL DEFAULT '',
  next_steps TEXT NOT NULL DEFAULT '',
  skill_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'offen',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Schularbeit',
  topic TEXT NOT NULL DEFAULT '',
  grade INTEGER,
  points REAL,
  max_points REAL,
  notes TEXT NOT NULL DEFAULT '',
  skill_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS worksheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL,
  task_type TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'uebung',
  source TEXT NOT NULL DEFAULT 'generator',
  skill_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worksheet_id INTEGER NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  skill_id TEXT,
  difficulty TEXT NOT NULL,
  prompt TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  answer TEXT NOT NULL DEFAULT '{}',
  solution TEXT NOT NULL DEFAULT '',
  hints TEXT NOT NULL DEFAULT '[]',
  error_map TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worksheet_id INTEGER NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id TEXT,
  attempt_no INTEGER NOT NULL,
  answer TEXT NOT NULL,
  correct INTEGER NOT NULL,
  final INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  solution_viewed INTEGER NOT NULL DEFAULT 0,
  error_label TEXT,
  feedback TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_lessons_student ON lessons(student_id, starts_at);
`;

/** Columns added after the first release. Added in place so existing databases keep their data. */
const COLUMNS: [table: string, column: string, definition: string][] = [
  ["students", "klasse", "INTEGER"],
  ["students", "teacher_id", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["lessons", "teacher_id", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["lessons", "kind", "TEXT NOT NULL DEFAULT 'stunde'"],
  ["lessons", "assignment_id", "INTEGER REFERENCES assignments(id) ON DELETE CASCADE"],
  ["worksheets", "school_type", "TEXT NOT NULL DEFAULT ''"],
  ["worksheets", "klasse", "INTEGER"],
];

/** Teachers to start with; more can be added later. */
export const DEFAULT_TEACHERS = ["Niko", "Thomas"];

let instance: Database.Database | null = null;

function dbPath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "nachhilfe.db");
}

export function db(): Database.Database {
  if (instance) return instance;
  const file = dbPath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  migrate(conn);
  seedCurriculum(conn);
  instance = conn;
  return conn;
}

function migrate(conn: Database.Database) {
  const tx = conn.transaction(() => {
    for (const [table, column, definition] of COLUMNS) {
      const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some((c) => c.name === column)) conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_assignment ON lessons(assignment_id) WHERE assignment_id IS NOT NULL");
    // Old rows only had a Schulstufe: derive school type and class from it.
    const legacy = conn.prepare("SELECT id, school_type, grade FROM students WHERE klasse IS NULL").all() as { id: number; school_type: string; grade: number }[];
    const fix = conn.prepare("UPDATE students SET school_type = ?, klasse = ? WHERE id = ?");
    for (const r of legacy) {
      const m = migrateLegacy(r.school_type, r.grade);
      fix.run(m.type, m.klasse, r.id);
    }
    const insertTeacher = conn.prepare("INSERT OR IGNORE INTO teachers (name) VALUES (?)");
    const { n } = conn.prepare("SELECT COUNT(*) AS n FROM teachers").get() as { n: number };
    if (n === 0) for (const name of DEFAULT_TEACHERS) insertTeacher.run(name);
  });
  tx();
}

/** Inserts the built-in skill tree. Existing skills (also custom ones) are left untouched. */
function seedCurriculum(conn: Database.Database) {
  const insert = conn.prepare(
    "INSERT OR IGNORE INTO skills (id, subject, area, name, grade_min, grade_max, sort) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const tx = conn.transaction(() => {
    let sort = 0;
    for (const s of CURRICULUM) {
      insert.run(s.id, s.subject, s.area, s.name, s.gradeMin, s.gradeMax, sort++);
    }
  });
  tx();
}

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Test helper: use a fresh in-memory database. */
export function resetForTests() {
  instance?.close();
  instance = null;
  process.env.DATABASE_PATH = ":memory:";
}
