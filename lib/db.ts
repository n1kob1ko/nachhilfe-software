import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CURRICULUM } from "./curriculum";
import { INITIAL_PASSWORD, hashPassword } from "./password";
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

-- Basis-Dokumentation: who worked with whom, when. Written the moment a unit starts.
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'gestartet',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  last_activity_at TEXT NOT NULL,
  end_reason TEXT NOT NULL DEFAULT ''
);

-- Mastery per skill at the end of each unit, so progress can be followed unit by unit.
CREATE TABLE IF NOT EXISTS skill_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  mastery REAL NOT NULL,
  practiced INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL
);

-- Student tablets. A tablet belongs to a teacher, never to a student: the student it shows comes
-- from the teacher's running unit. The tablet keeps a random secret in a cookie; only its hash is stored.
CREATE TABLE IF NOT EXISTS student_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  paired_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

-- One-time codes a teacher creates to connect a tablet; valid for a few minutes.
CREATE TABLE IF NOT EXISTS device_pair_codes (
  code TEXT PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_sessions (
  token TEXT PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Shared whiteboard of a unit (one per unit), with any number of pages.
CREATE TABLE IF NOT EXISTS whiteboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  current_page_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- elements: JSON array of Excalidraw elements (including deleted ones, so edits merge correctly)
CREATE TABLE IF NOT EXISTS whiteboard_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  position REAL NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  elements TEXT NOT NULL DEFAULT '[]',
  preview_svg TEXT,
  updated_at TEXT NOT NULL
);
-- Content sent from elsewhere in the app (e.g. tasks from the exercise builder). The first open
-- board client claims it and turns it into whiteboard elements.
CREATE TABLE IF NOT EXISTS whiteboard_inserts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  page_id INTEGER REFERENCES whiteboard_pages(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  claimed_at TEXT
);
-- A task can train more than one skill. tasks.skill_id stays the main one; this table lists all of them.
CREATE TABLE IF NOT EXISTS task_skills (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  PRIMARY KEY (task_id, skill_id)
);
-- Every hint a student opened (which task, which hint, in which assignment and unit).
CREATE TABLE IF NOT EXISTS hint_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  hint_index INTEGER NOT NULL,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (assignment_id, task_id, hint_index)
);
-- Saved builder settings ("Bruchrechnung – 15 Minuten Wiederholung"), optionally with fixed tasks.
CREATE TABLE IF NOT EXISTS worksheet_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  settings TEXT NOT NULL,
  source_worksheet_id INTEGER REFERENCES worksheets(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_skills_skill ON task_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_hint_uses ON hint_uses(student_id, task_id);
CREATE INDEX IF NOT EXISTS idx_wb_pages ON whiteboard_pages(board_id, position);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_units_student ON units(student_id, started_at);
CREATE INDEX IF NOT EXISTS idx_units_teacher ON units(teacher_id, started_at);
CREATE INDEX IF NOT EXISTS idx_snapshots ON skill_snapshots(student_id, skill_id, recorded_at);
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
  // teacher accounts
  ["teachers", "username", "TEXT"],
  ["teachers", "password_hash", "TEXT"],
  ["teachers", "is_admin", "INTEGER NOT NULL DEFAULT 0"],
  ["teachers", "must_change_password", "INTEGER NOT NULL DEFAULT 1"],
  // practice inside a unit
  ["attempts", "unit_id", "INTEGER REFERENCES units(id) ON DELETE SET NULL"],
  ["attempts", "active_ms", "INTEGER"],
  // Lern-Dokumentation: the lesson row of a unit, generated at its end and completed by the teacher
  ["lessons", "unit_id", "INTEGER REFERENCES units(id) ON DELETE SET NULL"],
  ["lessons", "summary", "TEXT NOT NULL DEFAULT ''"],
  ["lessons", "report", "TEXT"],
  ["lessons", "concentration", "INTEGER"],
  ["lessons", "motivation", "INTEGER"],
  ["lessons", "participation", "INTEGER"],
  ["lessons", "difficulties", "TEXT NOT NULL DEFAULT ''"],
  ["lessons", "positives", "TEXT NOT NULL DEFAULT ''"],
  ["lessons", "review_topics", "TEXT NOT NULL DEFAULT ''"],
  ["lessons", "homework_note", "TEXT NOT NULL DEFAULT ''"],
  ["lessons", "reviewed_at", "TEXT"],
  // Basis-Dokumentation: subject and how a unit ended
  ["units", "subject", "TEXT NOT NULL DEFAULT ''"],
  ["units", "ended_by", "TEXT NOT NULL DEFAULT ''"], // '' while running, 'lehrer' or 'automatisch'
  ["units", "ended_by_teacher_id", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["units", "end_estimated", "INTEGER NOT NULL DEFAULT 0"],
  // exercise builder: sub-skills, task categories, drafts, reuse
  ["skills", "parent_id", "TEXT"],
  ["tasks", "category", "TEXT"],
  ["worksheets", "student_id", "INTEGER REFERENCES students(id) ON DELETE SET NULL"],
  ["worksheets", "status", "TEXT NOT NULL DEFAULT 'freigegeben'"], // 'entwurf' until the teacher releases it
  ["worksheets", "teacher_id", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["worksheets", "settings", "TEXT"], // builder settings it was made with (JSON)
  ["worksheets", "source_worksheet_id", "INTEGER REFERENCES worksheets(id) ON DELETE SET NULL"],
  // student tablets: what the tablet shows ('' overview, 'tafel', 'aufgabe:<assignment id>'), when an exercise arrived there
  ["units", "device_view", "TEXT NOT NULL DEFAULT ''"],
  ["assignments", "delivered_at", "TEXT"],
  ["worksheets", "source_task_id", "INTEGER REFERENCES tasks(id) ON DELETE SET NULL"],
  ["assignments", "unit_id", "INTEGER REFERENCES units(id) ON DELETE SET NULL"],
  ["assignments", "solutions_visible", "INTEGER NOT NULL DEFAULT 0"],
];

/** Teachers to start with; more can be added later. */
export const DEFAULT_TEACHERS = ["Niko", "Thomas"];

let instance: Database.Database | null = null;

function dbPath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "nachhilfe.db");
}

export function db(): Database.Database {
  if (instance) return instance;
  instance = openDatabase(dbPath());
  return instance;
}

/** Opens (and creates or upgrades) a database file. db() uses it for the app's own database. */
export function openDatabase(file: string): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  migrate(conn);
  seedCurriculum(conn);
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
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_unit ON lessons(unit_id) WHERE unit_id IS NOT NULL");
    conn.exec("CREATE INDEX IF NOT EXISTS idx_attempts_unit ON attempts(unit_id)");
    // Units ended before these columns existed: the automatic end was only noted in end_reason.
    conn.exec(`UPDATE units SET ended_by = 'automatisch', end_estimated = 1 WHERE ended_by = '' AND status = 'beendet' AND end_reason LIKE 'automatisch%'`);
    conn.exec(`UPDATE units SET ended_by = 'lehrer' WHERE ended_by = '' AND status <> 'gestartet'`);
    conn.exec(`UPDATE units SET subject = COALESCE((SELECT l.subject FROM lessons l WHERE l.unit_id = units.id), '') WHERE subject = ''`);
    // At most one running unit per student. Older duplicates (if any) are closed before the index is built.
    conn.exec(`UPDATE units SET status = 'abgebrochen', ended_at = started_at, ended_by = 'automatisch',
      end_reason = 'doppelt gestartet, automatisch geschlossen'
      WHERE status = 'gestartet' AND id NOT IN (SELECT MIN(id) FROM units WHERE status = 'gestartet' GROUP BY student_id)`);
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_units_running ON units(student_id) WHERE status = 'gestartet'");
    const insertTeacher = conn.prepare("INSERT OR IGNORE INTO teachers (name) VALUES (?)");
    const { n } = conn.prepare("SELECT COUNT(*) AS n FROM teachers").get() as { n: number };
    if (n === 0) for (const name of DEFAULT_TEACHERS) insertTeacher.run(name);
    // every teacher gets a login: username = lower-case name, initial password to be changed at first login
    const noLogin = conn.prepare("SELECT id, name FROM teachers WHERE username IS NULL").all() as { id: number; name: string }[];
    const setLogin = conn.prepare("UPDATE teachers SET username = ?, password_hash = ?, must_change_password = 1, is_admin = ? WHERE id = ?");
    for (const t of noLogin) setLogin.run(usernameFor(t.name), hashPassword(INITIAL_PASSWORD), t.name === DEFAULT_TEACHERS[0] ? 1 : 0, t.id);
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_username ON teachers(username)");
    // every task is linked to its main skill in task_skills as well
    conn.exec("INSERT OR IGNORE INTO task_skills (task_id, skill_id) SELECT id, skill_id FROM tasks WHERE skill_id IS NOT NULL");
  });
  tx();
}

export function usernameFor(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

/** Inserts the built-in skill tree. Existing skills (also custom ones) are left untouched. */
function seedCurriculum(conn: Database.Database) {
  const insert = conn.prepare(
    "INSERT OR IGNORE INTO skills (id, subject, area, name, grade_min, grade_max, sort, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const tx = conn.transaction(() => {
    let sort = 0;
    for (const s of CURRICULUM) {
      insert.run(s.id, s.subject, s.area, s.name, s.gradeMin, s.gradeMax, sort++, s.parentId ?? null);
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
