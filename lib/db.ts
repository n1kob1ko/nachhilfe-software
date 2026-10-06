import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CURRICULUM, PREREQUISITES } from "./curriculum";
import { INITIAL_PASSWORD, hashPassword } from "./password";
import { checkLevel, migrateLegacy } from "./school";
import { skillCode } from "./skill-code";

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
-- ---------- Curriculum (Lehrplan) ----------
-- Where curriculum data and tasks come from and under which licence. source_type:
--   lehrplan = official curriculum (law text, free under § 7 UrhG), eigen = written by us,
--   ki = generated by Claude, oer = openly licensed import, referenz = may be consulted but never copied,
--   demo = example data, not for real use.
CREATE TABLE IF NOT EXISTS content_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  license_url TEXT NOT NULL DEFAULT '',
  attribution_text TEXT NOT NULL DEFAULT '',
  commercial_use_allowed INTEGER,
  derivatives_allowed INTEGER,
  share_alike_required INTEGER NOT NULL DEFAULT 0,
  copy_allowed INTEGER NOT NULL DEFAULT 0,
  retrieved_at TEXT,
  modified TEXT,
  content_hash TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- One item taken from an external source (e.g. one OER task), with its own licence data.
CREATE TABLE IF NOT EXISTS source_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_url TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  retrieved_at TEXT,
  modified TEXT,
  content_hash TEXT,
  UNIQUE (source_id, item_id)
);
-- One curriculum version, e.g. "Lehrplan der Mittelschule – Mathematik", BGBl. II Nr. 1/2023.
CREATE TABLE IF NOT EXISTS curricula (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'AT',
  name TEXT NOT NULL,
  school_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  version TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  valid_from TEXT,
  valid_to TEXT,
  source_id INTEGER REFERENCES content_sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aktiv',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- The official structure: Kompetenzbereich › Thema › Unterthema, and the wording of the
-- Kompetenzbeschreibungen. text holds the source wording verbatim.
CREATE TABLE IF NOT EXISTS curriculum_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  curriculum_id INTEGER NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  parent_id INTEGER REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  klasse INTEGER,
  schulstufe INTEGER,
  competency_area TEXT NOT NULL DEFAULT '',
  content_area TEXT NOT NULL DEFAULT '',
  action_area TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE (curriculum_id, code)
);
-- Which passages of an official curriculum a skill practises.
CREATE TABLE IF NOT EXISTS skill_curriculum (
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (skill_id, node_id)
);
-- voraussetzung: other_id should sit before skill_id is practised; weiter: other_id is a sensible next skill.
CREATE TABLE IF NOT EXISTS skill_links (
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  other_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  PRIMARY KEY (skill_id, other_id, kind)
);
-- Every curriculum import: first a preview (status 'vorschau'), then applied or discarded.
CREATE TABLE IF NOT EXISTS curriculum_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  curriculum_key TEXT,
  label TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  diff TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'vorschau',
  created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  applied_at TEXT
);
-- Earlier state of a skill an import changed, so every version stays traceable.
CREATE TABLE IF NOT EXISTS skill_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id TEXT NOT NULL,
  import_id INTEGER REFERENCES curriculum_imports(id) ON DELETE SET NULL,
  before TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
-- Aktueller Stoff: what a student is doing at school right now, per subject. The official curriculum
-- stays as it is; this is the student's own layer on top. At most one active row per subject;
-- replaced rows keep ended_at, so "seit wann" and the history stay readable.
CREATE TABLE IF NOT EXISTS current_material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL DEFAULT '',
  skill_ids TEXT NOT NULL DEFAULT '[]',
  since TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 2,
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'unterricht',
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  ended_at TEXT
);
-- Uploaded material (photo, PDF, worksheet). The file stays private; what is recognised in it is only
-- a suggestion (analysis JSON) until the teacher has checked it. Origin and licence via content_sources.
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  source_id INTEGER REFERENCES content_sources(id) ON DELETE SET NULL,
  subject TEXT NOT NULL DEFAULT '',
  school_type TEXT NOT NULL DEFAULT '',
  klasse INTEGER,
  topic TEXT NOT NULL DEFAULT '',
  skill_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'hochgeladen',
  analysis TEXT,
  analysis_source TEXT NOT NULL DEFAULT '',
  analyzed_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
-- Own corrections of a skill (Mehr › Datenqualität). The skill row itself (and with it every imported
-- or official value) is never changed: these values are laid over it when skills are read.
CREATE TABLE IF NOT EXISTS skill_overrides (
  skill_id TEXT PRIMARY KEY REFERENCES skills(id) ON DELETE CASCADE,
  area TEXT,
  subtopic TEXT,
  grade_min INTEGER,
  grade_max INTEGER,
  practice_shift TEXT NOT NULL DEFAULT '',
  merged_into TEXT REFERENCES skills(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_current_material ON current_material(student_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_materials_created ON materials(created_at);
CREATE INDEX IF NOT EXISTS idx_nodes_curriculum ON curriculum_nodes(curriculum_id, parent_id, sort);
CREATE INDEX IF NOT EXISTS idx_tests_student ON tests(student_id, date);
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
  // curriculum: skills get a stable code, the Lernziel, their origin and validity
  ["skills", "code", "TEXT"],
  ["skills", "subtopic", "TEXT NOT NULL DEFAULT ''"],
  ["skills", "school_types", "TEXT NOT NULL DEFAULT ''"], // '' = every school type; else comma list
  ["skills", "learning_objective", "TEXT NOT NULL DEFAULT ''"],
  ["skills", "description", "TEXT NOT NULL DEFAULT ''"],
  ["skills", "competency_area", "TEXT NOT NULL DEFAULT ''"],
  ["skills", "content_area", "TEXT NOT NULL DEFAULT ''"],
  ["skills", "action_area", "TEXT NOT NULL DEFAULT ''"],
  ["skills", "source_id", "INTEGER REFERENCES content_sources(id) ON DELETE SET NULL"],
  ["skills", "version", "TEXT NOT NULL DEFAULT ''"],
  ["skills", "valid_from", "TEXT"],
  ["skills", "valid_to", "TEXT"],
  ["skills", "status", "TEXT NOT NULL DEFAULT 'aktiv'"], // 'aktiv' | 'archiviert'
  // students: is the Schulstufe (grade) certain? 'unklar' when it could not be derived without guessing
  ["students", "stufe_status", "TEXT NOT NULL DEFAULT 'eindeutig'"],
  // tasks: origin and licence (via content_sources), difficulty 1–5, solution steps, expected time
  ["tasks", "source_type", "TEXT NOT NULL DEFAULT 'eigen'"], // eigen | ki | oer | lehrplan | demo
  ["tasks", "source_id", "INTEGER REFERENCES content_sources(id) ON DELETE SET NULL"],
  ["tasks", "source_item_id", "INTEGER REFERENCES source_items(id) ON DELETE SET NULL"],
  ["tasks", "level", "INTEGER"],
  ["tasks", "solution_steps", "TEXT NOT NULL DEFAULT '[]'"],
  ["tasks", "estimated_time_sec", "INTEGER"],
  // tracking: who taught and how hard the task was, at the moment of the answer
  ["attempts", "teacher_id", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["attempts", "level", "INTEGER"],
  // Schularbeiten and tests: planned ones with their Stoff, then the result
  ["tests", "title", "TEXT NOT NULL DEFAULT ''"],
  ["tests", "topics", "TEXT NOT NULL DEFAULT '[]'"],
  ["tests", "status", "TEXT NOT NULL DEFAULT 'geschrieben'"], // 'geplant' | 'geschrieben' | 'abgesagt'
  ["tests", "teacher_id", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["tests", "created_at", "TEXT"],
  // prerequisites and Lehrplan links: who made them, and removed ones stay as rows so a removed
  // standard link does not come back with the next start or import
  ["skill_links", "origin", "TEXT NOT NULL DEFAULT 'app'"], // app | import | lehrer
  ["skill_links", "removed_at", "TEXT"],
  ["skill_links", "changed_by", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["skill_curriculum", "origin", "TEXT NOT NULL DEFAULT 'import'"], // import | lehrer
  ["skill_curriculum", "removed_at", "TEXT"],
  ["skill_curriculum", "changed_by", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["skill_history", "kind", "TEXT NOT NULL DEFAULT 'import'"], // import | korrektur
  ["skill_history", "teacher_id", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  // Fehlerart of a wrong answer (lib/error-types.ts): the stored category, where it came from
  // (vorschlag = suggested by the app, lehrer = set or confirmed by the teacher, ki = free-text grading),
  // the app's original suggestion, and who set it when
  ["attempts", "error_type", "TEXT"],
  ["attempts", "error_type_source", "TEXT"],
  ["attempts", "error_type_suggested", "TEXT"],
  ["attempts", "error_type_by", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["attempts", "error_type_at", "TEXT"],
  ["attempts", "error_type_suggested_source", "TEXT"], // who made error_type_suggested: vorschlag | ki
  // Aufgabenbibliothek: tags of a library entry (worksheets.kind = 'bibliothek', one task each)
  ["worksheets", "tags", "TEXT NOT NULL DEFAULT '[]'"],
  // note for parents/student written from the summary of a unit (by the teacher or, on request, by Claude)
  ["lessons", "family_note", "TEXT NOT NULL DEFAULT ''"],
  ["lessons", "family_note_source", "TEXT NOT NULL DEFAULT ''"],
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
    const added = new Set<string>();
    for (const [table, column, definition] of COLUMNS) {
      const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some((c) => c.name === column)) {
        conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        added.add(`${table}.${column}`);
      }
    }
    // Links from before skill_links.origin: one that is no built-in prerequisite but is in the package
    // of an applied curriculum import came from that import (only on this upgrade, never again)
    if (added.has("skill_links.origin")) {
      const builtin = new Set(PREREQUISITES.map(([skill, before]) => `${skill}|${before}|voraussetzung`));
      const imported = new Set<string>();
      for (const { payload } of conn.prepare("SELECT payload FROM curriculum_imports WHERE applied_at IS NOT NULL").all() as { payload: string }[]) {
        for (const s of json<{ skills?: { id: string; prerequisites?: string[]; next?: string[] }[] }>(payload, {}).skills ?? []) {
          for (const p of s.prerequisites ?? []) imported.add(`${s.id}|${p}|voraussetzung`);
          for (const n of s.next ?? []) imported.add(`${s.id}|${n}|weiter`);
        }
      }
      const mark = conn.prepare("UPDATE skill_links SET origin = 'import' WHERE skill_id = ? AND other_id = ? AND kind = ?");
      for (const l of conn.prepare("SELECT skill_id, other_id, kind FROM skill_links").all() as { skill_id: string; other_id: string; kind: string }[]) {
        const key = `${l.skill_id}|${l.other_id}|${l.kind}`;
        if (!builtin.has(key) && imported.has(key)) mark.run(l.skill_id, l.other_id, l.kind);
      }
    }
    // Fehlerart suggestions from before error_type_suggested_source were the app's; an AI category was
    // not kept as suggestion, it is still in error_type while the teacher has not changed it
    if (added.has("attempts.error_type_suggested_source")) {
      conn.exec("UPDATE attempts SET error_type_suggested_source = 'vorschlag' WHERE error_type_suggested IS NOT NULL");
      conn.exec("UPDATE attempts SET error_type_suggested = error_type, error_type_suggested_source = 'ki' WHERE error_type_source = 'ki' AND error_type IS NOT NULL AND error_type_suggested IS NULL");
    }
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_assignment ON lessons(assignment_id) WHERE assignment_id IS NOT NULL");
    // Old rows only had a Schulstufe: derive school type and class from it.
    const legacy = conn.prepare("SELECT id, school_type, grade FROM students WHERE klasse IS NULL").all() as { id: number; school_type: string; grade: number }[];
    const fix = conn.prepare("UPDATE students SET school_type = ?, klasse = ? WHERE id = ?");
    for (const r of legacy) {
      // only when the old text names exactly one school type; otherwise the student is marked "unklar" below
      const m = migrateLegacy(r.school_type, r.grade);
      if (m) fix.run(m.type, m.klasse, r.id);
    }
    // Is the Schulstufe of every student certain? Nothing is changed, only flagged.
    const setStatus = conn.prepare("UPDATE students SET stufe_status = ? WHERE id = ?");
    for (const r of conn.prepare("SELECT id, school_type, klasse, grade FROM students").all() as { id: number; school_type: string; klasse: number | null; grade: number }[]) {
      setStatus.run(checkLevel(r.school_type, r.klasse, r.grade).status, r.id);
    }
    // tasks: origin and difficulty 1–5 for rows written before these columns existed. The origin only on
    // that upgrade: later a task keeps the origin it was given (a copy, new content, set by the teacher)
    if (added.has("tasks.source_type")) conn.exec(`UPDATE tasks SET source_type = 'ki' WHERE source_type = 'eigen' AND worksheet_id IN (SELECT id FROM worksheets WHERE source = 'ki')`);
    conn.exec(`UPDATE tasks SET level = CASE difficulty WHEN 'sehr leicht' THEN 1 WHEN 'leicht' THEN 2 WHEN 'leicht bis mittel' THEN 2 WHEN 'mittel' THEN 3 WHEN 'schwer' THEN 4 WHEN 'sehr schwer' THEN 5 ELSE 3 END WHERE level IS NULL`);
    // tests in the future without a result are planned ones
    conn.exec(`UPDATE tests SET status = 'geplant' WHERE status = 'geschrieben' AND grade IS NULL AND points IS NULL AND date > date('now')`);
    conn.exec(`UPDATE tests SET created_at = date WHERE created_at IS NULL`);
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
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_current_material_active ON current_material(student_id, subject) WHERE ended_at IS NULL");
    conn.exec("CREATE INDEX IF NOT EXISTS idx_attempts_error_type ON attempts(error_type) WHERE error_type IS NOT NULL");
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

/** Sources every installation has: our own content and AI-generated content. */
const BUILTIN_SOURCES = [
  {
    key: "lernheft",
    name: "Lernheft – eigene Inhalte",
    source_type: "eigen",
    url: "",
    publisher: "Lernheft",
    license: "eigen",
    attribution_text: "",
    commercial_use_allowed: 1,
    derivatives_allowed: 1,
    copy_allowed: 1,
    notes: "Fähigkeitsstruktur und Aufgaben-Generatoren der App. Kein offizieller Lehrplan.",
  },
  {
    key: "claude",
    name: "KI-generiert (Claude)",
    source_type: "ki",
    url: "",
    publisher: "Anthropic Claude, im Auftrag der Lehrkraft",
    license: "eigen",
    attribution_text: "",
    commercial_use_allowed: 1,
    derivatives_allowed: 1,
    copy_allowed: 1,
    notes: "Von der KI erzeugt und von der Lehrkraft vor dem Senden geprüft.",
  },
];

/**
 * Official sources (verified on ris.bka.gv.at on 2026-10-06). Only the reference is stored here;
 * the curriculum text itself is brought in through the importer (Mehr › Lehrplan).
 */
const OFFICIAL_SOURCES = [
  {
    key: "ris-ms",
    name: "RIS – Lehrpläne der Mittelschulen, Anlage 1",
    source_type: "lehrplan",
    url: "https://www.ris.bka.gv.at/Dokument.wxe?Abfrage=Bundesnormen&Dokumentnummer=NOR40271471",
    publisher: "Republik Österreich (RIS)",
    license: "amtliches Werk (§ 7 UrhG)",
    attribution_text: "BGBl. II Nr. 185/2012 idF BGBl. II Nr. 178/2025",
    commercial_use_allowed: 1,
    derivatives_allowed: 1,
    copy_allowed: 1,
    notes: "Gesetzesnummer 20007850, Dokumentnummer NOR40271471, in Kraft seit 01.09.2025. Lehrplantext Deutsch, Englisch, Mathematik als Paket unter Mehr › Lehrplan › Importe.",
  },
  {
    key: "ris-vs",
    name: "RIS – Lehrplan der Volksschule, Anlage A",
    source_type: "lehrplan",
    url: "https://www.ris.bka.gv.at/Dokument.wxe?Abfrage=Bundesnormen&Dokumentnummer=NOR40271469",
    publisher: "Republik Österreich (RIS)",
    license: "amtliches Werk (§ 7 UrhG)",
    attribution_text: "BGBl. Nr. 134/1963 idF BGBl. II Nr. 178/2025",
    commercial_use_allowed: 1,
    derivatives_allowed: 1,
    copy_allowed: 1,
    notes: "Gesetzesnummer 10009275, Dokumentnummer NOR40271469, in Kraft seit 01.09.2025. Lehrplantext Deutsch, Lebende Fremdsprache, Mathematik als Paket unter Mehr › Lehrplan › Importe.",
  },
  {
    key: "ris-ahs",
    name: "RIS – Lehrpläne der allgemeinbildenden höheren Schulen, Anlage A",
    source_type: "lehrplan",
    url: "https://www.ris.bka.gv.at/Dokument.wxe?Abfrage=Bundesnormen&Dokumentnummer=NOR40264238",
    publisher: "Republik Österreich (RIS)",
    license: "amtliches Werk (§ 7 UrhG)",
    attribution_text: "BGBl. Nr. 88/1985 idF BGBl. II Nr. 204/2024",
    commercial_use_allowed: 1,
    derivatives_allowed: 1,
    copy_allowed: 1,
    notes: "Gesetzesnummer 10008568, Dokumentnummer NOR40264238, in Kraft seit 01.09.2026. Lehrplantext Deutsch, Erste lebende Fremdsprache, Mathematik (Unter- und Oberstufe) als Paket unter Mehr › Lehrplan › Importe.",
  },
  {
    key: "ris-htl",
    name: "RIS – Lehrpläne der HTL 2015, Anlage 1 (gemeinsame Unterrichtsgegenstände)",
    source_type: "lehrplan",
    url: "https://www.ris.bka.gv.at/Dokument.wxe?Abfrage=Bundesnormen&Dokumentnummer=NOR40237785",
    publisher: "Republik Österreich (RIS)",
    license: "amtliches Werk (§ 7 UrhG)",
    attribution_text: "BGBl. II Nr. 262/2015 idF BGBl. II Nr. 383/2021",
    commercial_use_allowed: 1,
    derivatives_allowed: 1,
    copy_allowed: 1,
    notes: "Gesetzesnummer 20009288, Dokumentnummer NOR40237785, in Kraft seit 04.09.2021. Lehrplantext Deutsch, Englisch, Angewandte Mathematik als Paket unter Mehr › Lehrplan › Importe.",
  },
  {
    key: "ris-hak",
    name: "RIS – Lehrpläne Handelsakademie und Handelsschule, Anlage A1 (Handelsakademie)",
    source_type: "lehrplan",
    url: "https://www.ris.bka.gv.at/Dokument.wxe?Abfrage=Bundesnormen&Dokumentnummer=NOR40234935",
    publisher: "Republik Österreich (RIS)",
    license: "amtliches Werk (§ 7 UrhG)",
    attribution_text: "BGBl. Nr. 895/1994 idF BGBl. II Nr. 250/2021",
    commercial_use_allowed: 1,
    derivatives_allowed: 1,
    copy_allowed: 1,
    notes: "Gesetzesnummer 10008944, Dokumentnummer NOR40234935, in Kraft seit 01.09.2021. Lehrplantext Deutsch, Englisch, Mathematik und angewandte Mathematik als Paket unter Mehr › Lehrplan › Importe.",
  },
  {
    key: "iqs",
    name: "IQS – Kompetenzmodelle, iKM PLUS, Aufgabenpools",
    source_type: "referenz",
    url: "https://www.iqs.gv.at/",
    publisher: "Institut des Bundes für Qualitätssicherung im österreichischen Schulwesen",
    license: "unklar – keine offene Lizenz geprüft",
    attribution_text: "",
    commercial_use_allowed: null,
    derivatives_allowed: null,
    copy_allowed: 0,
    notes: "Nur als fachliche Referenz (Kompetenzstruktur, Aufgabentypen, Schwierigkeit, Prüfungsformate). Aufgaben nicht übernehmen.",
  },
];

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
    for (const src of [...BUILTIN_SOURCES, ...OFFICIAL_SOURCES]) {
      conn
        .prepare(
          `INSERT OR IGNORE INTO content_sources (key, name, source_type, url, publisher, license, attribution_text, commercial_use_allowed, derivatives_allowed, copy_allowed, notes)
           VALUES (@key, @name, @source_type, @url, @publisher, @license, @attribution_text, @commercial_use_allowed, @derivatives_allowed, @copy_allowed, @notes)`,
        )
        .run(src);
    }
    // skills without an origin are the app's own skill structure; every skill gets its stable code once
    conn.exec(`UPDATE skills SET source_id = (SELECT id FROM content_sources WHERE key = 'lernheft') WHERE source_id IS NULL`);
    const rows = conn.prepare("SELECT s.id, s.subject, s.area, s.name, s.grade_min, p.name AS parent_name FROM skills s LEFT JOIN skills p ON p.id = s.parent_id WHERE s.code IS NULL").all() as {
      id: string; subject: string; area: string; name: string; grade_min: number; parent_name: string | null;
    }[];
    const setCode = conn.prepare("UPDATE skills SET code = ? WHERE id = ?");
    const taken = new Set((conn.prepare("SELECT code FROM skills WHERE code IS NOT NULL").all() as { code: string }[]).map((r) => r.code));
    for (const r of rows) {
      let code = skillCode({ ...r, parentName: r.parent_name });
      for (let n = 2; taken.has(code); n++) code = `${skillCode({ ...r, parentName: r.parent_name })}-${n}`;
      taken.add(code);
      setCode.run(code, r.id);
    }
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_code ON skills(code) WHERE code IS NOT NULL");
    const link = conn.prepare("INSERT OR IGNORE INTO skill_links (skill_id, other_id, kind) SELECT ?, ?, 'voraussetzung' WHERE EXISTS (SELECT 1 FROM skills WHERE id = ?) AND EXISTS (SELECT 1 FROM skills WHERE id = ?)");
    for (const [skill, before] of PREREQUISITES) link.run(skill, before, skill, before);
    // tasks generated by the app are its own content; AI tasks point to the Claude source
    conn.exec(`UPDATE tasks SET source_id = (SELECT id FROM content_sources WHERE key = CASE tasks.source_type WHEN 'ki' THEN 'claude' ELSE 'lernheft' END) WHERE source_id IS NULL`);
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
