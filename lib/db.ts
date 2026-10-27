import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CURRICULUM, PREREQUISITES } from "./curriculum";
import { INITIAL_PASSWORD, PUBLIC_DEFAULT_PASSWORD, hashPassword, verifyPassword } from "./password";
import { wienerZeitstempel } from "./planung/zeit";
import { SCHULFAECHER, checkLevel, migrateLegacy } from "./school";
import { applyPendingRestore } from "./sicherungen";
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
-- from the teacher's running unit (with two running units: the one chosen on the tablet,
-- unit_id in COLUMNS). The tablet keeps a random secret in a cookie; only its hash is stored.
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

-- Temporary access from a student's own laptop ("Eigenes Gerät verbinden"). Unlike a tablet it belongs
-- to one unit only: a code the teacher shows (one per unit, a few minutes, single use), then a request
-- the teacher confirms. It ends with the unit, when the teacher ends it or when the student signs out.
-- The laptop keeps a random secret in a cookie; only its hash is stored.
CREATE TABLE IF NOT EXISTS laptop_codes (
  unit_id INTEGER PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS laptop_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  -- two digits shown on the laptop and to the teacher, so the teacher confirms the right device
  check_code TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'wartet' CHECK (status IN ('wartet','aktiv','abgelehnt','beendet')),
  -- why it ended: einheit, lehrer, abgemeldet, ersetzt, abgelaufen, abgelehnt
  end_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  approved_at TEXT,
  ended_at TEXT,
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_laptop_sessions_unit ON laptop_sessions(unit_id, status);

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
-- One row per KI request (lib/ai/router.ts): what it cost and how it went. No prompt, no answer, no
-- student name; teacher, unit and student (column added in migrate) only as ids for the cost statistics.
CREATE TABLE IF NOT EXISTS ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  fn TEXT NOT NULL,
  tier TEXT NOT NULL,
  model TEXT NOT NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  -- ok | cache | abgelehnt | fehler | timeout | budget | pausiert
  status TEXT NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  test INTEGER NOT NULL DEFAULT 0
);
-- What the KI said during a unit (live hints, block and unit analysis). Shown to the teacher only.
CREATE TABLE IF NOT EXISTS ai_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  triggers TEXT NOT NULL DEFAULT '[]',
  data TEXT NOT NULL,
  call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
-- Textarbeiten: longer texts a student writes (lib/texts.ts). body = JSON blocks (lib/text-doc.ts), never HTML.
CREATE TABLE IF NOT EXISTS texts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  subject TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '[]',
  words INTEGER NOT NULL DEFAULT 0,
  chars INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'offen',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
-- Every unit in which a text was written or continued, with the word count before and after.
CREATE TABLE IF NOT EXISTS text_units (
  text_id INTEGER NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  words_before INTEGER NOT NULL DEFAULT 0,
  words_after INTEGER NOT NULL DEFAULT 0,
  first_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  PRIMARY KEY (text_id, unit_id)
);
-- Earlier versions of a text (at most every few minutes, and before a large part was deleted).
CREATE TABLE IF NOT EXISTS text_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_id INTEGER NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  words INTEGER NOT NULL,
  saved_at TEXT NOT NULL
);
-- Textkorrektur (lib/text-correction.ts): a correction of one frozen version of a text. The text itself is
-- never changed; body is the snapshot the marks refer to. ai_* is the KI run (only after the teacher's
-- consent), the items are the suggestions and the teacher's decision on each.
CREATE TABLE IF NOT EXISTS text_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_id INTEGER NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  words INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT '',
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  ai_status TEXT NOT NULL DEFAULT 'keine',
  ai_error TEXT,
  ai_model TEXT,
  ai_call_id INTEGER,
  ai_started_at TEXT,
  ai_consent_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  ai_consent_at TEXT,
  summary TEXT NOT NULL DEFAULT '',
  main_issue TEXT NOT NULL DEFAULT '',
  recommendation TEXT NOT NULL DEFAULT '',
  recommendation_skill TEXT,
  dropped INTEGER NOT NULL DEFAULT 0,
  shared_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (text_id, version)
);
CREATE TABLE IF NOT EXISTS text_correction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  correction_id INTEGER NOT NULL REFERENCES text_corrections(id) ON DELETE CASCADE,
  block INTEGER,
  pos_start INTEGER,
  pos_end INTEGER,
  quote TEXT NOT NULL DEFAULT '',
  replacement TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'fehler',
  rule TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  skill_id TEXT,
  status TEXT NOT NULL DEFAULT 'offen',
  source TEXT NOT NULL DEFAULT 'ki',
  decided_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL
);
-- Bildgeschichte (lib/picture-story.ts): a Textarbeit with a series of pictures. The story itself is the text;
-- this row holds the settings, picture_story_images the pictures in their order (files under uploads/bildgeschichten).
CREATE TABLE IF NOT EXISTS picture_stories (
  text_id INTEGER PRIMARY KEY REFERENCES texts(id) ON DELETE CASCADE,
  school_type TEXT NOT NULL DEFAULT '',
  klasse INTEGER,
  target_words INTEGER,
  starters TEXT NOT NULL DEFAULT '[]',
  hints TEXT NOT NULL DEFAULT '',
  lines INTEGER NOT NULL DEFAULT 26,
  source_kind TEXT NOT NULL DEFAULT '',
  source_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS picture_story_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_id INTEGER NOT NULL REFERENCES picture_stories(text_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_picture_story_images ON picture_story_images(text_id, position);
-- Schreibaufträge (lib/schreibauftrag-store.ts), first the Textinterpretation: a Textarbeit on a given story or
-- Textbeilage. The student's text is the text itself; this row holds what the teacher pasted (line breaks kept),
-- its author and the word target. Textsorte, medium and Schreibsituation are added in COLUMNS.
CREATE TABLE IF NOT EXISTS text_interpretations (
  text_id INTEGER PRIMARY KEY REFERENCES texts(id) ON DELETE CASCADE,
  story_title TEXT NOT NULL,
  story_author TEXT NOT NULL DEFAULT '',
  story_year TEXT NOT NULL DEFAULT '',
  story_kind TEXT NOT NULL DEFAULT 'Kurzgeschichte',
  story_text TEXT NOT NULL,
  count_blank INTEGER NOT NULL DEFAULT 0,
  target_words INTEGER NOT NULL DEFAULT 500,
  source_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- ---------- Planung (Phase 3 des Merges): Räume und Verfügbarkeit ----------
-- Wo eine geplante Einheit stattfindet: Gebäude, Name und ob vor Ort oder online. Ein Raum wird
-- deaktiviert statt gelöscht, sobald Plätze auf ihn zeigen (lib/planung/raeume.ts).
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building TEXT NOT NULL DEFAULT 'Hauptgebäude',
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'vor_ort',          -- vor_ort | online
  active INTEGER NOT NULL DEFAULT 1
);
-- Abweichung der Verfügbarkeit für eine einzelne Woche (Montag, YYYY-MM-DD, Europe/Vienna). Sie
-- ersetzt für diese Woche die Regelverfügbarkeit aus teachers.availability / students.availability.
CREATE TABLE IF NOT EXISTS availability_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type TEXT NOT NULL,                       -- teacher | student
  owner_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,                       -- Montag, YYYY-MM-DD
  availability TEXT NOT NULL,                     -- JSON wie teachers.availability
  UNIQUE(owner_type, owner_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_owner ON availability_overrides(owner_type, owner_id);
-- ---------- Planung (Phase 4 des Merges): Wochenplan ----------
-- Ein Platz im Wochenplan (Glossar: **geplante Einheit**): wer, wo, an welchem Wochentag, zu welcher
-- Startzeit und mit welcher geplanten Dauer. Der Platz wird erst wirklich, wenn eine Einheit sich mit
-- ihm verknüpft (unit_id); ein vergangener veröffentlichter Platz ohne Einheit heißt „nicht stattgefunden“.
-- Zeiten sind lokales Datum + Minuten ab Mitternacht (Europe/Vienna), nie UTC-Zeitstempel (§6);
-- week_start ist immer ein Montag, weekday ISO 1 = Montag … 7 = Sonntag.
-- Keine Eindeutigkeit auf Überlappungen: die geplante Dauer ist je Schüler verschieden, deshalb prüft
-- lib/planung/repo.ts bei **jedem** Schreiben auf Überlappung von Lehrer, Schüler und Raum.
CREATE TABLE IF NOT EXISTS geplante_einheiten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,                 -- Montag YYYY-MM-DD (Europe/Vienna)
  weekday INTEGER NOT NULL,                 -- 1 = Montag … 7 = Sonntag
  start_min INTEGER NOT NULL,               -- Minuten ab Mitternacht, Vielfaches von 10
  geplante_dauer INTEGER NOT NULL,          -- 1–300
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id),
  status TEXT NOT NULL DEFAULT 'entwurf',   -- entwurf | veroeffentlicht
  locked INTEGER NOT NULL DEFAULT 0,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Tagesbriefing (lib/briefing.ts): the KI version, kept per student and data state (column stand, reused on later days while it
-- is unchanged); at most one row per student and Vienna day. It never changes the Lernstand
CREATE TABLE IF NOT EXISTS briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  datum TEXT NOT NULL,                      -- YYYY-MM-DD, Europe/Vienna
  platz_id INTEGER,                         -- geplante_einheiten.id of the day, if any
  minuten INTEGER NOT NULL,                 -- planned duration the plan was made for
  stand TEXT NOT NULL,                      -- data state at creation (lib/briefing.ts briefingStand); the key with student_id
  inhalt TEXT NOT NULL,                     -- JSON { inhalt: BriefingInhalt, links }
  verworfen INTEGER NOT NULL DEFAULT 0,     -- KI suggestions dropped (exercise not in stock)
  call_id INTEGER,                          -- ai_calls.id: tokens and cost
  created_at TEXT NOT NULL,
  UNIQUE (student_id, datum)
);
-- Stoff zuordnen (lib/lehrplan.ts stoffVorschlag): what a teacher picked for a Stoff topic when it was not the
-- suggestion, so the same words get it next time. skill_id '' = nothing fits. Never links anything by itself.
CREATE TABLE IF NOT EXISTS stoff_zuordnungen (
  subject TEXT NOT NULL,
  schluessel TEXT NOT NULL,                 -- stoffSchluessel(topic): word stems without stop words
  skill_id TEXT NOT NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subject, schluessel, skill_id)
);
-- Vokabeltrainer (lib/vokabellisten.ts): the teacher's own word lists for one student, one pair per line
-- ("english; alternative = deutsch | example sentence"), read by lib/vokabeln.ts leseListe.
CREATE TABLE IF NOT EXISTS vokabellisten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vokabellisten_student ON vokabellisten(student_id, updated_at);
-- Feedback der Lehrkräfte (lib/feedback.ts): what bothers them or is missing, sent with one tap from any
-- page; the page, the screen size and the last browser errors come along by themselves.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  art TEXT NOT NULL DEFAULT 'fehler',       -- fehler | wunsch | sonstiges
  text TEXT NOT NULL,
  seite TEXT NOT NULL DEFAULT '',           -- path and query of the page it was sent from
  bildschirm TEXT NOT NULL DEFAULT '',      -- "1280×800" (viewport)
  modus TEXT NOT NULL DEFAULT '',           -- hell | dunkel
  browser TEXT NOT NULL DEFAULT '',         -- user agent
  fehler_log TEXT NOT NULL DEFAULT '[]',    -- JSON: the last errors in the browser before sending
  bild TEXT,                                -- stored file name in the uploads folder (screenshot), or NULL
  status TEXT NOT NULL DEFAULT 'offen',     -- offen | erledigt
  erledigt_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at);
-- Lernpakete (lib/lernpakete.ts): a prepared lesson per topic, not per student, built once and used for many.
-- Never deleted: archiviert keeps it retrievable. Import and export as JSON (docs/lernpaket-format.md).
CREATE TABLE IF NOT EXISTS lernpakete (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  fach TEXT NOT NULL,
  schulart TEXT NOT NULL DEFAULT '',        -- SCHOOL_TYPES name or '' (any)
  klasse INTEGER,                           -- class of the schulart, NULL = any
  schulstufe INTEGER,                       -- 1–13 from schulart and klasse, NULL = any
  thema TEXT NOT NULL DEFAULT '',
  skill_ids TEXT NOT NULL DEFAULT '[]',     -- JSON: skills(id), the main one first
  schwierigkeit TEXT NOT NULL DEFAULT 'mittel',
  dauer_minuten INTEGER NOT NULL DEFAULT 50,
  ziel TEXT NOT NULL DEFAULT '',
  quelle TEXT NOT NULL DEFAULT 'hand',      -- hand | import | ki
  status TEXT NOT NULL DEFAULT 'entwurf',   -- entwurf | geprueft | archiviert
  created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  geprueft_von INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  geprueft_am TEXT
);
-- One step of a Lernpaket in teaching order. aufgaben: JSON TaskDraft[] (lib/tasks.ts), the format of the
-- builder, so they can become an exercise; pruefen: JSON string[], what a person still has to check.
CREATE TABLE IF NOT EXISTS lernpaket_schritte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paket_id INTEGER NOT NULL REFERENCES lernpakete(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  art TEXT NOT NULL,                        -- einstieg | erklaerung | beispiel | frage | gefuehrte_uebung | uebung | zusatz | kontrolle | abschluss
  titel TEXT NOT NULL,
  minuten INTEGER NOT NULL,
  lehrer_sagt TEXT NOT NULL DEFAULT '',
  folie INTEGER,                            -- slide number of a later presentation, NULL = none
  lehrer_fragt TEXT NOT NULL DEFAULT '',
  erwartete_antwort TEXT NOT NULL DEFAULT '',
  bei_fehler TEXT NOT NULL DEFAULT '',
  notiz TEXT NOT NULL DEFAULT '',
  aufgaben TEXT NOT NULL DEFAULT '[]',
  pruefen TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_lernpaket_schritte ON lernpaket_schritte(paket_id, position);
CREATE INDEX IF NOT EXISTS idx_lernpakete_status ON lernpakete(status, fach);
-- Präsentationen (lib/praesentationen.ts): an uploaded HTML presentation with a Vortragstext per slide. The files
-- lie in uploads/praesentationen/<token>/ and are served only on PRESENTATION_ORIGIN (docs/praesentation-format.md).
CREATE TABLE IF NOT EXISTS praesentationen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  fach TEXT NOT NULL,
  schulart TEXT NOT NULL DEFAULT '',
  klasse INTEGER,
  schulstufe INTEGER,
  thema TEXT NOT NULL DEFAULT '',
  skill_ids TEXT NOT NULL DEFAULT '[]',     -- JSON: skills(id)
  schwierigkeit TEXT NOT NULL DEFAULT 'mittel',
  beschreibung TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,               -- random: the folder and the address of the files
  start_pfad TEXT NOT NULL,                 -- the page that opens first, relative to the folder
  dateien TEXT NOT NULL DEFAULT '[]',       -- JSON [{pfad, groesse}]: the only files that are served
  groesse INTEGER NOT NULL DEFAULT 0,
  datei_name TEXT NOT NULL DEFAULT '',      -- name of the uploaded file
  extern TEXT NOT NULL DEFAULT '[]',        -- JSON: hosts the deck tries to load from (blocked)
  notizen TEXT NOT NULL DEFAULT '{}',       -- JSON {folie: Vortragstext}; teacher pages only
  status TEXT NOT NULL DEFAULT 'aktiv',     -- aktiv | archiviert
  created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_praesentationen_status ON praesentationen(status, fach);
-- Cockpit of a running Einheit (lib/cockpit.ts): the Lernpaket (or, without one, the skill) of this unit and
-- how far it got. The package itself never changes: order, done and skipped steps are this unit's only.
-- reihenfolge, erledigt, uebersprungen: JSON step ids; notizen: JSON {step id: text}; gesendet: JSON {step id: worksheet ids}.
CREATE TABLE IF NOT EXISTS einheit_cockpit (
  unit_id INTEGER PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
  paket_id INTEGER REFERENCES lernpakete(id) ON DELETE SET NULL,
  skill_id TEXT,                            -- without a package: the skill of this unit
  reihenfolge TEXT NOT NULL DEFAULT '[]',
  aktuell INTEGER,                          -- the step on screen (lernpaket_schritte.id)
  erledigt TEXT NOT NULL DEFAULT '[]',
  uebersprungen TEXT NOT NULL DEFAULT '[]',
  notizen TEXT NOT NULL DEFAULT '{}',
  gesendet TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- „Einheit vorbereiten“ on the start page: the package chosen for a student's unit of that day (Europe/Vienna),
-- taken over by the cockpit when the unit starts.
CREATE TABLE IF NOT EXISTS einheit_vorbereitung (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  datum TEXT NOT NULL,
  paket_id INTEGER NOT NULL REFERENCES lernpakete(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, datum)
);
-- „Stunden automatisch vorbereiten“ (lib/vorbereitung-auto.ts): der Lehrer hat den Vorschlag für die Einheit eines
-- Schülers an diesem Tag (Europe/Vienna) entfernt und will kein Paket. Der Vorschlag selbst wird nie gespeichert.
CREATE TABLE IF NOT EXISTS vorbereitung_ohne_paket (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  datum TEXT NOT NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, datum)
);
-- „Anpassen“ im Cockpit (lib/anpassen.ts): Vorschläge der KI für den Schüler dieser Einheit zu einem Schritt des
-- Lernpakets. Gelten nur für diese Einheit; das Paket, Lernstand, Diagnose und Einschätzung bleiben unberührt.
-- art = beispiel | leichter | schwerer | bei_fehler; status = vorschlag (ungeprüft) | uebernommen | verworfen.
-- bezug: JSON, die Tatsachen der App, auf die sich der Vorschlag stützt (von der App geschrieben, nie von der KI).
CREATE TABLE IF NOT EXISTS einheit_anpassungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  paket_id INTEGER REFERENCES lernpakete(id) ON DELETE SET NULL,
  schritt_id INTEGER NOT NULL,
  art TEXT NOT NULL,
  titel TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  antwort TEXT NOT NULL DEFAULT '',
  bezug TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'vorschlag',
  call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_einheit_anpassungen ON einheit_anpassungen(unit_id, status);
-- Die nächste Übung bereit (lib/cockpit.ts haltBereit, 2026-10-27): die Aufgaben, die ein Schritt des Plans senden wird, schon
-- vorher gebaut (Generator, ohne KI), damit „Passende Übungen senden“ sofort geht. Höchstens für den Schritt auf dem Schirm und den
-- nächsten mit Übung. Nie beim Schüler: erst das Senden macht daraus eine Übung. schluessel = woraus sie gebaut ist (Schritt,
-- Fähigkeit, Stufe, Anzahl, Seed); passt er nicht mehr (der Plan hat sich geändert), wird neu gebaut. aufgaben: JSON der Aufgaben.
CREATE TABLE IF NOT EXISTS einheit_bereit (
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  schritt_id INTEGER NOT NULL,
  schluessel TEXT NOT NULL,
  aufgaben TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (unit_id, schritt_id)
);
-- „Ausführlicher erklären“ im Unterricht (lib/ausfuehrlich.ts, 2026-10-27): der längere Lehrertext der KI zu einer Fähigkeit und
-- Schulstufe, ohne Daten eines Schülers; gilt für jeden Schüler, bis sich die Fassung des Prompts ändert. inhalt: JSON (sagt,
-- beispiel, frage, antwort, fehler), schon von der App geprüft.
CREATE TABLE IF NOT EXISTS ki_erklaerungen (
  skill_id TEXT NOT NULL,
  schulstufe INTEGER NOT NULL,
  fassung TEXT NOT NULL,
  inhalt TEXT NOT NULL,
  call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (skill_id, schulstufe, fassung)
);
-- Gespeicherte Antworten der KI (lib/ai/speicher.ts): dieselbe Anfrage (Funktion, Anbieter, Modell, vollständiger
-- Prompt, Schüler) wird bis expires_at aus der Datenbank beantwortet, auch nach einem Neustart. key = sha256 davon.
-- created_at, expires_at: Millisekunden. Ein gelöschter Schüler nimmt seine gespeicherten Antworten mit.
CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  fn TEXT NOT NULL,
  model TEXT NOT NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_cache(expires_at);
-- Fächer (lib/faecher.ts): the one list every subject picker offers. Starts with SCHULFAECHER; the Verwaltung
-- adds own subjects and deactivates unused ones. Never renamed or deleted: lessons, tests and profiles keep
-- the subject as plain text, so an old value that is not in this list stays valid.
CREATE TABLE IF NOT EXISTS faecher (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  aktiv INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- „Zu erledigen“ auf der Startseite (lib/zu-erledigen.ts): was ein Lehrer schon angesehen oder abgehakt hat,
-- je Lehrer. art = ergebnis (assignments.id) | text (texts.id). Gilt nur, wenn seen_at nach dem Fertigwerden liegt:
-- ein wieder abgegebener Text ist wieder offen. Der Zustand selbst wird beim Lesen berechnet, nicht gespeichert.
CREATE TABLE IF NOT EXISTS todo_gesehen (
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  art TEXT NOT NULL,
  ref_id INTEGER NOT NULL,
  seen_at TEXT NOT NULL,
  PRIMARY KEY (teacher_id, art, ref_id)
);
-- Erwartungshorizont eines Schreibauftrags (lib/schreibauftrag-bewertung.ts): je Kriterium, was ein guter Text enthält.
-- kriterien: JSON, von der Lehrkraft gespeichert ('' = noch nichts); vorschlag: JSON der KI, ungeprüft, bis die Lehrkraft
-- speichert. freigegeben = 1: der Schüler sieht beim Schreiben die gespeicherten Punkte, nie den Vorschlag.
-- beilage_hash: die Textbeilage beim Speichern; ändert sie sich, stimmen Zeilenangaben vielleicht nicht mehr.
CREATE TABLE IF NOT EXISTS auftrag_erwartungen (
  text_id INTEGER PRIMARY KEY REFERENCES texts(id) ON DELETE CASCADE,
  kriterien TEXT NOT NULL DEFAULT '',
  beilage_hash TEXT NOT NULL DEFAULT '',
  gespeichert_at TEXT,
  gespeichert_von INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  freigegeben INTEGER NOT NULL DEFAULT 0,
  vorschlag TEXT NOT NULL DEFAULT '',
  vorschlag_verworfen INTEGER NOT NULL DEFAULT 0,
  vorschlag_at TEXT,
  vorschlag_call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL
);
-- Bewertung eines Schreibauftrags (lib/schreibauftrag-bewertung.ts): je Kriterium Stufe und Begründung. kriterien: JSON,
-- von der Lehrkraft bestätigt (nur das zählt; geht nicht in Lernstand oder Diagnose); version: die Fassung des Texts.
-- vorschlag: JSON der KI, Zitate und Zeilen von der App geprüft (vorschlag_verworfen: so viel fiel heraus).
CREATE TABLE IF NOT EXISTS text_bewertungen (
  text_id INTEGER PRIMARY KEY REFERENCES texts(id) ON DELETE CASCADE,
  kriterien TEXT NOT NULL DEFAULT '',
  note INTEGER,
  version INTEGER,
  bestaetigt_at TEXT,
  bestaetigt_von INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  vorschlag TEXT NOT NULL DEFAULT '',
  vorschlag_version INTEGER,
  vorschlag_verworfen INTEGER NOT NULL DEFAULT 0,
  vorschlag_at TEXT,
  vorschlag_call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL
);
-- Angabe / Textvorlage einer Textarbeit (lib/schreibauftrag-bewertung.ts, 2026-10-23): was die Lehrkraft zur Aufgabe einfügt,
-- etwa die Stellenanzeige und die Notizen eines Arbeitsblatts. Nur für die Lehrkraft und „Aufgabe erfüllt?“; Schülerseiten
-- lesen diese Tabelle nicht. Schreibaufträge haben stattdessen ihre Textbeilage in text_interpretations.
CREATE TABLE IF NOT EXISTS text_angaben (
  text_id INTEGER PRIMARY KEY REFERENCES texts(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  updated_at TEXT,
  updated_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL
);
-- Referenzsammlung (lib/referenz.ts, 2026-10-23): Aufgaben aus einem von Hand geladenen PDF, nur für Lehrer. Die KI liest
-- die Datei einmal; jeder Eintrag ist ungeprüft, bis ein Lehrer ihn speichert. format = Kategorie (lib/curriculum.ts)
-- oder ''. dritte = enthält Texte oder Bilder Dritter (bleibt Referenz). worksheet_id = die Bibliotheksaufgabe daraus.
CREATE TABLE IF NOT EXISTS referenz_eintraege (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fach TEXT NOT NULL,
  skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
  grundkompetenz TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  aufgabe TEXT NOT NULL DEFAULT '',
  loesung TEXT NOT NULL DEFAULT '',
  quelle TEXT NOT NULL,
  dritte INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ungeprueft',
  hinweise TEXT NOT NULL DEFAULT '[]',
  datei TEXT NOT NULL DEFAULT '',
  worksheet_id INTEGER REFERENCES worksheets(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  geprueft_von INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  geprueft_am TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_referenz_fach ON referenz_eintraege(fach, skill_id, status);
-- Aufgaben bewerten (lib/bewertungen.ts, 2026-10-23): eine Bewertung je Aufgabe und Lehrer, getrennt von Schülerleistungen.
-- schluessel: der Inhalt der Aufgabe (Format, Text, Daten, Antwort), Kopien in Übungen, Bibliothek und Lernpaketen teilen ihn.
-- gruende: JSON-Schlüssel aus lib/bewertung-regeln.ts; aufgabe: JSON TaskDraft, wie bewertet (Vorbild für die KI).
CREATE TABLE IF NOT EXISTS aufgabe_bewertungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schluessel TEXT NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  sterne INTEGER NOT NULL,                  -- 1–5
  gruende TEXT NOT NULL DEFAULT '[]',
  kommentar TEXT NOT NULL DEFAULT '',
  fach TEXT NOT NULL DEFAULT '',
  skill_id TEXT,
  aufgabe TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (schluessel, teacher_id)
);
CREATE INDEX IF NOT EXISTS idx_aufgabe_bewertungen_skill ON aufgabe_bewertungen(skill_id);
-- Terminanfragen (lib/planung/terminanfragen.ts, Plan 3.3): ein veröffentlichter Platz soll verschoben oder mit
-- einem anderen getauscht werden. Ein Tausch wartet zuerst auf die Zustimmung der anderen Seite (Schüler oder
-- ihr Lehrer), dann bestätigt oder lehnt die Verwaltung ab. Bewegt wird erst beim Bestätigen, mit derselben
-- Prüfung wie im Wochenplan. vorher/ziel_*: wo der Platz bei der Anfrage lag und wohin er soll; beim Tausch ist
-- ziel_* die Lage des anderen Platzes, und der kommt an vorher.
CREATE TABLE IF NOT EXISTS terminanfragen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  art TEXT NOT NULL,                        -- verschieben | tauschen
  status TEXT NOT NULL,                     -- wartet (auf Zustimmung) | offen (bei der Verwaltung) | bestaetigt | abgelehnt
  platz_id INTEGER NOT NULL REFERENCES geplante_einheiten(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  vorher TEXT NOT NULL,                     -- JSON { week_start, weekday, start_min }
  ziel_week_start TEXT NOT NULL,
  ziel_weekday INTEGER NOT NULL,
  ziel_start_min INTEGER NOT NULL,
  ziel_raum_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL, -- beim Verschieben ein anderer freier Raum; null = Raum bleibt
  partner_platz_id INTEGER REFERENCES geplante_einheiten(id) ON DELETE CASCADE,
  partner_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  von TEXT NOT NULL,                        -- schueler | lehrer
  von_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  notiz TEXT NOT NULL DEFAULT '',           -- nur für Lehrer und Verwaltung, nie für den anderen Schüler
  zugestimmt TEXT NOT NULL DEFAULT '',      -- '' | schueler | lehrer
  zugestimmt_at TEXT,
  grund TEXT NOT NULL DEFAULT '',           -- kurzer Grund einer Ablehnung
  entschieden_von TEXT NOT NULL DEFAULT '', -- '' | partner | verwaltung
  entschieden_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  entschieden_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_terminanfragen_status ON terminanfragen(status, created_at);
-- Prüfungen, die ein Schüler in seiner App einträgt (lib/pruefliste.ts, Plan 3.1). Ist alles klar (vor allem ein sicheres
-- Datum), wird gleich eine Schularbeit (tests, quelle = 'schueler'); sonst prüft ein Lehrer in der Prüfliste.
-- status = eingereicht (zu prüfen) | automatisch (eingetragen, Lehrer hat noch nicht bestätigt) | uebernommen | verworfen.
-- datum NULL = keins angegeben; keine_namen = 1: der Schüler hat bestätigt, dass auf den Fotos kein Name steht.
CREATE TABLE IF NOT EXISTS pruefung_einreichungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  art TEXT NOT NULL,
  fach TEXT NOT NULL,
  datum TEXT,
  stoff TEXT NOT NULL DEFAULT '',
  notiz TEXT NOT NULL DEFAULT '',
  keine_namen INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'eingereicht',
  test_id INTEGER REFERENCES tests(id) ON DELETE SET NULL,
  entschieden_von INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  entschieden_am TEXT,
  created_at TEXT NOT NULL
);
-- Die Fotos dazu, je als Material des Schülers (Stoffzettel). neu = 1: das Material entstand mit dieser Einreichung
-- (beim Verwerfen wird es gelöscht). gelesen_am: das Foto wurde einmal gelesen, vorschlag ist das Ergebnis (JSON).
CREATE TABLE IF NOT EXISTS pruefung_einreichung_fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  einreichung_id INTEGER NOT NULL REFERENCES pruefung_einreichungen(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  neu INTEGER NOT NULL DEFAULT 1,
  gelesen_am TEXT,
  vorschlag TEXT,
  fehler TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pruefung_einreichungen ON pruefung_einreichungen(student_id, status);
CREATE INDEX IF NOT EXISTS idx_pruefung_einreichung_fotos ON pruefung_einreichung_fotos(einreichung_id);
-- Notiz nach der Einheit (lib/schueler-notiz.ts): „Was war heute schwer?“ aus der Schüler-App, eine je Einheit.
-- auswahl: JSON der angetippten Antworten (NOTIZ_AUSWAHL); uebersprungen = 1: die Frage kommt nicht wieder.
-- Die Worte des Schülers: zählen nicht für Lernstand oder Einschätzung und gehen nicht an die KI.
CREATE TABLE IF NOT EXISTS schueler_notizen (
  unit_id INTEGER PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  auswahl TEXT NOT NULL DEFAULT '[]',
  text TEXT NOT NULL DEFAULT '',
  uebersprungen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schueler_notizen_student ON schueler_notizen(student_id);
-- „Für nächstes Mal“ aus der Schüler-App (lib/schueler-notiz.ts): was drankommen soll oder was er in der Schule nicht
-- versteht. Gehört zur ersten Einheit, die nach created_at beginnt; bis dahin änderbar. created_at, updated_at: ISO wie units.started_at.
CREATE TABLE IF NOT EXISTS schueler_wuensche (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schueler_wuensche_student ON schueler_wuensche(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ge_week ON geplante_einheiten(week_start, status);
CREATE INDEX IF NOT EXISTS idx_ge_teacher ON geplante_einheiten(teacher_id, week_start);
CREATE INDEX IF NOT EXISTS idx_ge_student ON geplante_einheiten(student_id, week_start);
CREATE INDEX IF NOT EXISTS idx_text_corrections_text ON text_corrections(text_id, version);
CREATE INDEX IF NOT EXISTS idx_text_correction_items ON text_correction_items(correction_id, block, pos_start);
CREATE INDEX IF NOT EXISTS idx_texts_student ON texts(student_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_text_units_unit ON text_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_text_revisions ON text_revisions(text_id, id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_created ON ai_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_insights_unit ON ai_insights(unit_id, kind, id);
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
-- Bildgeschichte erstellen (lib/bildfolge.ts, Plan 5.2): eine Bilderfolge, die die App aus der kurzen Beschreibung der
-- Lehrkraft erstellt hat. Der Plan (JSON: Szenen und die feste Beschreibung der Figuren) bleibt, damit „Dieses Bild neu“
-- dieselben Figuren zeichnet. Kein Name, kein Foto. student_id: für wen sie erstellt wurde (Kostengrenze), sonst null.
CREATE TABLE IF NOT EXISTS bildfolgen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  beschreibung TEXT NOT NULL,
  plan TEXT NOT NULL,
  plan_call_id INTEGER,
  created_at TEXT NOT NULL
);
-- das aktuelle Bild je Szene; die Datei liegt wie die Bilder der Bildgeschichten unter uploads/bildgeschichten
CREATE TABLE IF NOT EXISTS bildfolge_bilder (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bildfolge_id INTEGER NOT NULL REFERENCES bildfolgen(id) ON DELETE CASCADE,
  szene INTEGER NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  call_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bildfolge_bilder ON bildfolge_bilder(bildfolge_id, szene);
-- Präsentation aus einem Lernpaket (lib/praesentation-ki.ts, Plan 5.1): der Vorschlag der KI, bevor der Lehrer ihn übernimmt.
-- inhalt: JSON, der Inhalt der Folien (lib/ai/praesentation.ts Deck), nie HTML; die App baut die Präsentation erst beim Übernehmen.
-- status = vorschlag | uebernommen | verworfen; praesentation_id: die gespeicherte Präsentation nach dem Übernehmen.
-- Seit „Präsentation im Unterricht“ (lib/praesentation-unterricht.ts) auch zu einem Schritt einer Einheit: dann ist paket_id leer,
-- unit_id und schritt_id nennen den Schritt, auftrag (JSON) die Angaben aus dem Schritt (Spalten in COLUMNS, Umbau in migrate).
CREATE TABLE IF NOT EXISTS praesentation_entwuerfe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paket_id INTEGER REFERENCES lernpakete(id) ON DELETE CASCADE,
  inhalt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'vorschlag',
  praesentation_id INTEGER REFERENCES praesentationen(id) ON DELETE SET NULL,
  call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_praesentation_entwuerfe ON praesentation_entwuerfe(paket_id, status);
-- Prüfungsstoff lesen (lib/pruefungsstoff.ts, 2026-10-25): was die KI aus allen Dateien einer Prüfung zusammen (und der Angabe
-- der Lehrkraft) gelesen hat, geprüft. schluessel = Fassung des Prompts + sortierte sha256 der Dateien + Angabe + Fähigkeiten der
-- Anfrage: dieselben Dateien kosten nie ein zweites Mal. dateien: JSON [{material_id, sha256}] in der Reihenfolge der Anfrage.
CREATE TABLE IF NOT EXISTS stoff_lesungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schluessel TEXT NOT NULL UNIQUE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  dateien TEXT NOT NULL DEFAULT '[]',
  ergebnis TEXT NOT NULL,
  call_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Der Prüfungsstoff einer Prüfung, je erkanntem Punkt eine Zeile: original wie auf dem Blatt, inhalt der Lerninhalt in
-- einfachen Worten, einheit das Kapitel des Buchs (nie eine Fähigkeit), quelle stoffzettel | inhaltsverzeichnis | lehrer |
-- sonstiges, dokument die Nummer der Datei (0 = Angabe der Lehrkraft), status pruefung | ausgeschlossen | unklar,
-- zuordnung sicher | bestaetigt | unklar | keine, vorschlaege: JSON der Fähigkeiten zur Auswahl bei unklar.
-- tests.topics und tests.skill_ids werden daraus gefüllt; ohne passende Fähigkeit bleibt der Punkt trotzdem gespeichert.
CREATE TABLE IF NOT EXISTS pruefungsstoff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  gruppe TEXT NOT NULL,
  original TEXT NOT NULL,
  inhalt TEXT NOT NULL DEFAULT '',
  einheit TEXT NOT NULL DEFAULT '',
  quelle TEXT NOT NULL DEFAULT '',
  dokument INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pruefung',
  grund TEXT NOT NULL DEFAULT '',
  skill_id TEXT,
  zuordnung TEXT NOT NULL DEFAULT 'keine',
  vorschlaege TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pruefungsstoff_test ON pruefungsstoff(test_id, pos);
-- „Was steht heute an?“ (lib/vorgabe.ts): die Vorgabe der Lehrkraft für eine laufende Einheit. text wie getippt (bleibt in der
-- App), punkte: JSON der erkannten Lerninhalte mit Fähigkeit, schwierigkeiten: JSON, test_id die gewählte oder erkannte Prüfung,
-- lesung_id die gelesenen Dateien, termin_text ein genannter Termin („nächste Woche“, nie selbst eingetragen),
-- angewendet = 1: der Plan der Einheit richtet sich danach.
CREATE TABLE IF NOT EXISTS einheit_vorgabe (
  unit_id INTEGER PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  punkte TEXT NOT NULL DEFAULT '[]',
  skill_ids TEXT NOT NULL DEFAULT '[]',
  schwierigkeiten TEXT NOT NULL DEFAULT '[]',
  test_id INTEGER REFERENCES tests(id) ON DELETE SET NULL,
  lesung_id INTEGER REFERENCES stoff_lesungen(id) ON DELETE SET NULL,
  material_ids TEXT NOT NULL DEFAULT '[]',
  termin_text TEXT NOT NULL DEFAULT '',
  hinweis TEXT NOT NULL DEFAULT '',
  angewendet INTEGER NOT NULL DEFAULT 0,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Präsentation im Unterricht (lib/praesentation-unterricht.ts, 2026-10-27): welche Präsentation bei welchem Schritt einer Einheit
-- gezeigt wurde (schritt_id wie in einheit_cockpit: Paketschritt oder negativer Planschritt), ab welcher Folie, und ob sie dafür
-- erstellt wurde. Für den Abschluss („Präsentation … verwendet“); die Präsentation selbst bleibt unter Erweitert › Präsentationen.
CREATE TABLE IF NOT EXISTS einheit_praesentationen (
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  schritt_id INTEGER NOT NULL,
  praesentation_id INTEGER NOT NULL REFERENCES praesentationen(id) ON DELETE CASCADE,
  folie INTEGER,
  erstellt INTEGER NOT NULL DEFAULT 0,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (unit_id, schritt_id)
);

-- Unterlagen bei „Das zeigst du“ (lib/unterlagen-unterricht.ts): je Einheit und Datei der Schritt, den die Lehrkraft unter der
-- Vorgabe gewählt hat („Passt zu welchem Schritt?“, schritt_id wie in einheit_cockpit), und ob sie die Unterlage im Schritt
-- geöffnet hat (gezeigt_at, mit dem Titel, wie er dastand). Für den Abschluss („Unterlage gezeigt: …“).
CREATE TABLE IF NOT EXISTS einheit_unterlagen (
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  schritt_id INTEGER,
  gezeigt_schritt INTEGER,
  gezeigt_at TEXT,
  titel TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (unit_id, material_id)
);

-- „Das zeigst du“ im Plan (lib/cockpit.ts beispielDerEinheit, Phase C): das durchgerechnete Beispiel je Einheit und Fähigkeit,
-- festgehalten, sobald der erklärende Schritt auf dem Schirm war. Die Übungen und „Das fragst du“ der Schritte dieser Fähigkeit
-- nehmen es danach nie, auch wenn sich Stufe oder Plan ändern. schritt_id: der Schritt, der es zuerst zeigte (wie in einheit_cockpit;
-- ein Üben-Schritt zeigt es nicht noch einmal). aufgabe: JSON der Aufgabe (nur für den Lehrer).
CREATE TABLE IF NOT EXISTS einheit_beispiele (
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  schritt_id INTEGER,
  aufgabe TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (unit_id, skill_id)
);

-- Arbeit fotografieren (lib/papier-einheit.ts): eine auf Papier gelöste Übung, in der laufenden Einheit geprüft und übernommen.
-- Die Antworten stehen als attempts an der Zuweisung (unit_id gesetzt) wie am Gerät; hier nur, was der Abschluss sagt: welches
-- Blatt, ob es eine Übung der Einheit war (bekannt) oder ein anderes Blatt, wie gelesen wurde (ki oder hand), die Seiten, richtig
-- und teilweise von wie vielen, Punkte (nur wenn jede Aufgabe Punkte hat) und wie viele Zeilen unsicher waren und geprüft wurden.
CREATE TABLE IF NOT EXISTS papier_arbeiten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  titel TEXT NOT NULL DEFAULT '',
  bekannt INTEGER NOT NULL DEFAULT 1,
  gelesen TEXT NOT NULL DEFAULT 'hand',
  material_ids TEXT NOT NULL DEFAULT '[]',
  von INTEGER NOT NULL DEFAULT 0,
  richtig INTEGER NOT NULL DEFAULT 0,
  teilweise INTEGER NOT NULL DEFAULT 0,
  punkte REAL,
  max_punkte REAL,
  unsicher INTEGER NOT NULL DEFAULT 0,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_papier_unit ON papier_arbeiten(unit_id);
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
  // Freigabe in Stufen (lib/freigabe.ts): nichts | hilfen | loesung | alles; NULL = aus solutions_visible
  ["assignments", "freigabe", "TEXT"],
  // Schnellrunde (Phase 2 des Merges): 'normal' = the usual flow, 'schnell' = one tap per task with a
  // short feedback and automatic next task (components/StudentQuickRound.tsx). Attempts, time and hints
  // are stored exactly as in normal mode; only the student's flow differs (lib/quick-round.ts).
  ["assignments", "mode", "TEXT NOT NULL DEFAULT 'normal'"],
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
  // Lösungsdaten (Plan 2.3): Erklärung für den Lehrer ('' = aus Fähigkeit und typischen Fehlern) und andere Wege
  ["tasks", "teacher_note", "TEXT NOT NULL DEFAULT ''"],
  ["tasks", "alt_ways", "TEXT NOT NULL DEFAULT '[]'"],
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
  ["tests", "material_id", "INTEGER REFERENCES materials(id) ON DELETE SET NULL"], // der Stoffzettel (lib/stoffzettel.ts)
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
  ["attempts", "submission_id", "TEXT"], // id the device gave this submission; repeats of it are stored once
  // Lehrerbewertung (lib/tasks.ts REVIEWS): offen = waits for the teacher (free answers), richtig | teilweise | falsch
  // = the teacher's grade; null = checked by the app only. An answer waiting for the teacher does not count yet.
  ["attempts", "review", "TEXT"],
  ["attempts", "review_by", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["attempts", "review_at", "TEXT"],
  // Aufgabenbibliothek: tags of a library entry (worksheets.kind = 'bibliothek', one task each)
  ["worksheets", "tags", "TEXT NOT NULL DEFAULT '[]'"],
  // note for parents/student written from the summary of a unit (by the teacher or, on request, by Claude)
  ["lessons", "family_note", "TEXT NOT NULL DEFAULT ''"],
  ["lessons", "family_note_source", "TEXT NOT NULL DEFAULT ''"],
  // automatische Dokumentation (lib/einschaetzung.ts, 2026-10-19): wie der Schüler sich getan hat (JSON) und
  // die automatisch eingetragenen Werte (JSON {feld: wert}); ein Feld mit anderem Wert hat der Lehrer geändert
  ["lessons", "einschaetzung", "TEXT"],
  ["lessons", "auto_felder", "TEXT NOT NULL DEFAULT '{}'"],
  // Abschluss (lib/abschluss.ts, 2026-10-25): welche der vier Felder die Lehrkraft direkt in der Karte korrigiert hat
  // (JSON-Liste: gemacht, gut, schwierig, naechstes); der Text selbst steht im Feld der Dokumentation
  ["lessons", "abschluss_eigen", "TEXT NOT NULL DEFAULT '[]'"],
  // Minitest am Anfang der Einheit (lib/minitest.ts, 2026-10-19): die Einheit, für die die Übung erstellt wurde;
  // auch ein nur gedruckter Minitest gehört so zu seiner Einheit
  ["worksheets", "minitest_unit_id", "INTEGER REFERENCES units(id) ON DELETE SET NULL"],
  // Textkorrektur „gründlich“ (lib/ai/textkorrektur-gruendlich.ts): how the KI checked, which sentences it
  // left out, whether the second check ran; per suggestion where it came from and whether the teacher must
  // look closely ('lehrer'), the check sorted it out ('verworfen') or it does not fit its place ('unpassend', 2026-10-11),
  // both of the last stored as abgelehnt
  ["text_corrections", "method", "TEXT NOT NULL DEFAULT 'einfach'"],
  ["text_corrections", "unchecked", "TEXT NOT NULL DEFAULT ''"],
  ["text_corrections", "verify_status", "TEXT NOT NULL DEFAULT ''"],
  // words OpenRouter's privacy filter hid from the KI, as JSON [{para, text, grammar}] (shown to the teacher, 2026-10-09)
  ["text_corrections", "hidden_words", "TEXT NOT NULL DEFAULT ''"],
  // names replaced by [Name] besides those of the student and the teachers, as the teacher confirmed them, JSON
  // array; '' = not chosen, the app's own name detection decides (lib/name-detection.ts, 2026-10-10)
  ["text_corrections", "masked_names", "TEXT NOT NULL DEFAULT ''"],
  // when the second check of a „gründlich“ run failed (2026-10-11): why, as the teacher reads it, and step 1's answer
  // (JSON {version, data}, masked text only) so „Erneut versuchen“ repeats only the check; both '' once it ran
  ["text_corrections", "verify_error", "TEXT NOT NULL DEFAULT ''"],
  ["text_corrections", "analysis", "TEXT NOT NULL DEFAULT ''"],
  ["text_correction_items", "origin", "TEXT NOT NULL DEFAULT ''"],
  ["text_correction_items", "review", "TEXT NOT NULL DEFAULT ''"],
  ["text_correction_items", "review_note", "TEXT NOT NULL DEFAULT ''"],
  // Planung (Phase 3 des Merges): Verfügbarkeit, Wochenziel und Raumwünsche.
  // teachers.availability / students.availability: JSON { "1": [{ start, end }], … } in Minuten ab
  // Mitternacht, ISO-Wochentag 1 = Montag … 7 = Sonntag (Umrechnung nur in lib/planung/zeit.ts).
  ["teachers", "availability", "TEXT"],
  ["teachers", "weekly_target_min", "INTEGER"],
  ["teachers", "preferred_room_ids", "TEXT NOT NULL DEFAULT '[]'"],
  ["students", "availability", "TEXT"],
  ["students", "einheiten_pro_woche", "INTEGER NOT NULL DEFAULT 0"],
  // geplante Dauer je Schüler: Vorgabe 100 min, erlaubt 1–300 (geprüft mit zod in der Server Action)
  ["students", "geplante_dauer", "INTEGER NOT NULL DEFAULT 100"],
  ["students", "modus_wunsch", "TEXT NOT NULL DEFAULT 'egal'"], // vor_ort | online | egal
  ["students", "erlaubte_lehrer", "TEXT NOT NULL DEFAULT '[]'"],
  // Zwei Schüler gleichzeitig (D26, docs/planung.md): 1 = dieser Platz darf sich mit einem anderen
  // Platz desselben Lehrers überschneiden. Höchstens zwei zugleich; geprüft in lib/planung/repo.ts.
  ["geplante_einheiten", "gleichzeitig", "INTEGER NOT NULL DEFAULT 0"],
  // Blätter erstellen (Phase 5 des Merges): Ein gespeichertes **Druckblatt** ist eine Zeile in
  // `materials` (D21) mit `kind = 'druckblatt'` und der Blattdefinition als JSON in dieser Spalte.
  // Die Dateispalten (file_name, mime, size, sha256, stored_path) bleiben für diese Art leer — ein
  // Druckblatt ist seine Beschreibung, keine Datei (ADR 0010: „Gespeichert wird die Definition").
  // Gelesen werden sie über `lib/materials.ts`; dort sind sie für kind = 'druckblatt' optional.
  ["materials", "definition", "TEXT"],
  // KI-Hinweise je Schüler (Phase 6 des Merges, Schritt 3): was die KI über diesen Schüler wissen
  // soll, z. B. „Legasthenie: kurze Sätze“. Der Text steht im Systemprompt jeder schülerbezogenen
  // Anfrage (lib/ai/hinweise.ts) und wird dort ohne den Namen des Schülers gesendet.
  ["students", "ki_hinweise", "TEXT NOT NULL DEFAULT ''"],
  // KI-Anbieter je Aufruf (2026-10-18): Anthropic hat ein eigenes Monatsbudget, alle anderen teilen
  // das allgemeine. Alte Zeilen bekommen ihn beim Upgrade aus dem Modellnamen (migrate).
  ["ai_calls", "provider", "TEXT NOT NULL DEFAULT ''"],
  // davon Denken: der Teil der Ausgabe-Tokens, den das Modell zum Nachdenken brauchte (null = nicht gemeldet)
  ["ai_calls", "thinking_tokens", "INTEGER"],
  // Probeschularbeit (lib/probeschularbeit.ts, 2026-10-19): die Schularbeit, für die die Übung gemacht wurde,
  // und die Punkte je Aufgabe (null = Vorgabe nach Schwierigkeit)
  ["worksheets", "probe_test_id", "INTEGER REFERENCES tests(id) ON DELETE SET NULL"],
  ["tasks", "points", "REAL"],
  // Schreibaufträge (lib/schreibauftrag-store.ts, 2026-10-20): text_interpretations hält jede Textsorte der SRDP,
  // nicht nur die Textinterpretation (sorte), dazu das Medium der Textbeilage und die Schreibsituation
  ["text_interpretations", "sorte", "TEXT NOT NULL DEFAULT 'textinterpretation'"],
  ["text_interpretations", "story_medium", "TEXT NOT NULL DEFAULT ''"],
  ["text_interpretations", "situation", "TEXT NOT NULL DEFAULT ''"],
  // Zwei Schüler gleichzeitig (D26) am Tablet (2026-10-20): welche laufende Einheit dieses Tablet zeigt, wenn beim
  // Lehrer zwei laufen. Gilt nur, solange diese Einheit läuft (lib/devices.ts `deviceUnit`); null = noch nicht gewählt.
  ["student_devices", "unit_id", "INTEGER REFERENCES units(id) ON DELETE SET NULL"],
  // Präsentationen (lib/praesentationen.ts, 2026-10-22): die Präsentation eines Lernpakets; ihre Folien
  // passen zur Spalte `folie` der Schritte
  ["lernpakete", "praesentation_id", "INTEGER REFERENCES praesentationen(id) ON DELETE SET NULL"],
  // Lernpaket mit KI entwerfen (lib/lernpaket-ki.ts, 2026-10-23): die Anfrage im Protokoll (ai_calls.id), für Tokens und Kosten
  ["lernpakete", "ki_call_id", "INTEGER"],
  // Archiv (lib/archiv.ts, 2026-10-22): archiviert statt gelöscht. Die Zeile bleibt mit Versuchen, Dokumentation und
  // Lernstand; sie fehlt nur in Listen, Auswahl und Suche, und Schüler sehen sie nicht mehr als offen. null = nicht archiviert.
  // Eine Textarbeit (auch Bildgeschichte und Schreibauftrag) wird an `texts` archiviert, die Zusatztabellen hängen daran.
  ["worksheets", "archived_at", "TEXT"],
  ["worksheets", "archived_by", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["assignments", "archived_at", "TEXT"],
  ["assignments", "archived_by", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["texts", "archived_at", "TEXT"],
  ["texts", "archived_by", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  // Hausübung mit Übung (2026-10-22): ist die verknüpfte Übung fertig, gilt die Hausübung als erledigt
  // (beim Lesen berechnet, lib/zu-erledigen.ts); das Häkchen von Hand bleibt daneben bestehen
  ["homework", "assignment_id", "INTEGER REFERENCES assignments(id) ON DELETE SET NULL"],
  // KI-Grenze je Schüler und Monat (lib/ai/schueler-kosten.ts, 2026-10-23): um welchen Schüler es im Aufruf ging
  // (meta.studentId, sonst der Schüler der Einheit); null = keiner (Lesetext, Druckblatt, Verbindungstest …)
  ["ai_calls", "student_id", "INTEGER REFERENCES students(id) ON DELETE SET NULL"],
  // Schreibauftrag (Plan 4.2, 2026-10-23): die Länge der Textbeilage in Wörtern, getrennt vom Wortziel des Schülers
  // (null = keine Vorgabe), und die Prüfung des Schülers, zu der der Auftrag gehört
  ["text_interpretations", "beilage_ziel", "INTEGER"],
  ["text_interpretations", "test_id", "INTEGER REFERENCES tests(id) ON DELETE SET NULL"],
  // Referenzsammlung (lib/referenz.ts, 2026-10-23): die Quellenangabe einer übernommenen Aufgabe („aufgabenpool.at, 1_234“),
  // geht mit jeder Kopie mit und steht auf dem Blatt und beim Schüler als „Quelle: …“; null = keine
  ["tasks", "quelle", "TEXT"],
  // Prüfungen eintragen (lib/pruefliste.ts, Plan 3.1): 'schueler' = der Schüler hat sie in seiner App eingetragen
  ["tests", "quelle", "TEXT NOT NULL DEFAULT ''"],
  // Bildgeschichte erstellen (lib/bildfolge.ts, Plan 5.2): 1 = mit KI erstellt (nur intern, Schülerseiten zeigen es nicht),
  // dazu Bilderfolge und Szene, aus denen „Dieses Bild neu“ dasselbe Bild noch einmal erstellt
  ["picture_story_images", "ki", "INTEGER NOT NULL DEFAULT 0"],
  ["picture_story_images", "bildfolge_id", "INTEGER REFERENCES bildfolgen(id) ON DELETE SET NULL"],
  ["picture_story_images", "szene", "INTEGER"],
  // Präsentation aus einem Lernpaket (lib/praesentation-ki.ts, Plan 5.1): 'ki' = von der KI erstellt ('' = hochgeladen), die Anfrage
  // im Protokoll, und wer sie geprüft hat; eine KI-Präsentation bleibt „Ungeprüft“, bis ein Lehrer sie ansieht
  ["praesentationen", "quelle", "TEXT NOT NULL DEFAULT ''"],
  ["praesentationen", "ki_call_id", "INTEGER"],
  ["praesentationen", "geprueft_von", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["praesentationen", "geprueft_am", "TEXT"],
  // Handgeschriebenen Text einlesen (lib/handschrift.ts, 2026-10-23): wann der Text zuletzt von Papier übernommen wurde
  // (vom Foto oder abgetippt); nur für den Lehrer („von Papier übernommen“), Schülerseiten zeigen es nicht. null = am Gerät geschrieben
  ["texts", "von_papier", "TEXT"],
  // „Aufgabe erfüllt?“ (lib/schreibauftrag-bewertung.ts, 2026-10-23): die Prüfung je Arbeitsauftrag, für jede Textarbeit. auftraege:
  // JSON des geprüften Ergebnisses (Zitate von der App geprüft); pruefung_status keine/laeuft/fertig/fehler, damit die Prüfung im
  // Hintergrund läuft und einzeln wiederholt werden kann; pruefung_namen: die Namen, die die Lehrkraft in der Freigabe verbergen ließ
  ["text_bewertungen", "auftraege", "TEXT NOT NULL DEFAULT ''"],
  ["text_bewertungen", "auftraege_version", "INTEGER"],
  ["text_bewertungen", "auftraege_at", "TEXT"],
  ["text_bewertungen", "pruefung_status", "TEXT NOT NULL DEFAULT 'keine'"],
  ["text_bewertungen", "pruefung_fehler", "TEXT NOT NULL DEFAULT ''"],
  ["text_bewertungen", "pruefung_start", "TEXT"],
  ["text_bewertungen", "pruefung_freigabe_at", "TEXT"],
  ["text_bewertungen", "pruefung_freigabe_von", "INTEGER REFERENCES teachers(id) ON DELETE SET NULL"],
  ["text_bewertungen", "pruefung_namen", "TEXT NOT NULL DEFAULT ''"],
  // Note für jede Textarbeit (2026-10-23): vorschlag_note die Gesamtnote, die die KI vorschlägt; vorschlag_ohne_inhalt 1, wenn die
  // App den Vorschlag für Inhalt (und die Note) weggelassen hat, weil ein Auftrag nicht zu beurteilen war; lernstand_skill die
  // Fähigkeit, für die die bestätigte Note im Lernstand zählt ('' = keine, lib/analysis.ts); erst bestaetigt_at macht sie gültig
  ["text_bewertungen", "vorschlag_note", "INTEGER"],
  ["text_bewertungen", "vorschlag_ohne_inhalt", "INTEGER NOT NULL DEFAULT 0"],
  ["text_bewertungen", "lernstand_skill", "TEXT NOT NULL DEFAULT ''"],
  // Geführter Unterricht (lib/cockpit.ts, 2026-10-25): „Wiederholen“ und „Schüler versteht es nicht“ je Schritt (JSON {Schritt-Id: Anzahl});
  // ohne Lernpaket der „Plan für heute“ aus dem Briefing, beim ersten Tippen festgehalten (JSON, Schritt-Ids negativ; null = noch nicht)
  ["einheit_cockpit", "wiederholt", "TEXT NOT NULL DEFAULT '{}'"],
  ["einheit_cockpit", "nicht_verstanden", "TEXT NOT NULL DEFAULT '{}'"],
  ["einheit_cockpit", "plan", "TEXT"],
  // Anpassung im Unterricht (lib/steuerung.ts, 2026-10-25): „Richtig / Teilweise / Falsch“ bei Fragen und Kontrollen (JSON
  // {Schritt-Id: Wert}); steuerung = worauf schon reagiert wurde und das Zeichen des Lehrers (JSON; null bei alten Zeilen)
  ["einheit_cockpit", "antworten", "TEXT NOT NULL DEFAULT '{}'"],
  ["einheit_cockpit", "steuerung", "TEXT"],
  // Zeit passt sich an (lib/stundenplan.ts neuTakten, 2026-10-27): der Rest des Plans nach der echten Zeit neu getaktet, beim
  // Weitergehen (JSON {minuten, ab, verschoben}; null = wie geplant)
  ["einheit_cockpit", "takt", "TEXT"],
  // Vorbereitung automatisch (lib/briefing.ts, 2026-10-25): ein Briefing gilt je Schüler und Datenstand (`stand`), auch an
  // späteren Tagen; daten = die Fassung aus den Daten und der Schwerpunkt, auf denen die KI-Fassung beruht (JSON; null bei alten Zeilen)
  ["briefings", "daten", "TEXT"],
  // Prüfungsstoff lesen (lib/pruefungsstoff.ts, 2026-10-25): die Lesung, aus der der Prüfungsstoff einer Prüfung oder eines
  // Eintrags des Schülers stammt (alle Dateien zusammen gelesen)
  ["tests", "lesung_id", "INTEGER REFERENCES stoff_lesungen(id) ON DELETE SET NULL"],
  ["pruefung_einreichungen", "lesung_id", "INTEGER REFERENCES stoff_lesungen(id) ON DELETE SET NULL"],
  // Art der Unterlagen (lib/pruefungsstoff.ts, 2026-10-27): die Antwort der KI wie gelesen (JSON), damit eine geänderte Rolle ohne
  // neue Anfrage neu ausgewertet wird; je Datei die Rolle stoffzettel | inhaltsverzeichnis | erklaerung | aufgaben | sonstiges
  // ('' = unbekannt), rolle_geprueft = 1: von der Lehrkraft gewählt (die KI ändert sie dann nicht mehr)
  ["stoff_lesungen", "antwort", "TEXT"],
  ["materials", "rolle", "TEXT NOT NULL DEFAULT ''"],
  ["materials", "rolle_geprueft", "INTEGER NOT NULL DEFAULT 0"],
  // Präsentation im Unterricht (lib/praesentation-unterricht.ts, 2026-10-27): ein Vorschlag zu einem Schritt einer Einheit statt zu
  // einem Lernpaket: die Einheit, der Schritt und die Angaben aus dem Schritt (JSON), aus denen er erstellt wurde
  ["praesentation_entwuerfe", "unit_id", "INTEGER REFERENCES units(id) ON DELETE CASCADE"],
  ["praesentation_entwuerfe", "schritt_id", "INTEGER"],
  ["praesentation_entwuerfe", "auftrag", "TEXT"],
  // Phase-B-Testlauf (2026-10-27): wann die Präsentation bei diesem Schritt geöffnet wurde. Nur dann sagt der Abschluss „verwendet“;
  // „Übernehmen“ allein verknüpft sie nur mit dem Schritt
  ["einheit_praesentationen", "gezeigt_at", "TEXT"],
];

/** Teachers to start with; more can be added later. */
export const DEFAULT_TEACHERS = ["Niko", "Thomas"];

let instance: Database.Database | null = null;

export function dbPath() {
  // Serverless hosts wipe files on every restart: fail loudly instead of losing data quietly.
  if (process.env.VERCEL && !process.env.DATABASE_PATH)
    throw new Error("Lernheft braucht einen Server mit dauerhaftem Speicher (siehe docs/betrieb.md). Auf Vercel gehen Datenbank und Uploads verloren.");
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "nachhilfe.db");
}

export function db(): Database.Database {
  if (instance) return instance;
  const file = dbPath();
  // a backup the admin chose to restore is swapped in before the database is opened
  applyPendingRestore(file);
  instance = openDatabase(file);
  return instance;
}

/**
 * Closes the connection db() caches and forgets it, so the next db() call opens the file again.
 * Needed wherever the database file or its folder is removed while the process keeps running
 * (tests, scripts): the cached handle would otherwise keep the file open, and on Windows that
 * blocks deleting the folder (EPERM). openDatabase() connections the caller closed are not affected.
 */
export function closeDatabase() {
  const conn = instance;
  instance = null;
  conn?.close();
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
    // a row from before gezeigt_at that was not made by „Übernehmen“ came from opening the presentation at the step
    if (added.has("einheit_praesentationen.gezeigt_at")) conn.exec("UPDATE einheit_praesentationen SET gezeigt_at = created_at WHERE erstellt = 0");
    // KI calls from before ai_calls.provider: the model name says who answered (an OpenRouter id has a
    // vendor prefix, the Anthropic API's has none); until then only OpenRouter ran with a key in production
    if (added.has("ai_calls.provider")) {
      conn.exec(
        "UPDATE ai_calls SET provider = CASE WHEN model = 'manuell' THEN 'manual' WHEN model LIKE 'claude-%' THEN 'anthropic' WHEN model LIKE '%/%' THEN 'openrouter' ELSE '' END",
      );
    }
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_assignment ON lessons(assignment_id) WHERE assignment_id IS NOT NULL");
    conn.exec("CREATE INDEX IF NOT EXISTS idx_ai_calls_student ON ai_calls(student_id, created_at)");
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
    // one submission = one answer, however often a lost connection makes the device send it
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_submission ON attempts(student_id, submission_id) WHERE submission_id IS NOT NULL");
    // Units ended before these columns existed: the automatic end was only noted in end_reason.
    conn.exec(`UPDATE units SET ended_by = 'automatisch', end_estimated = 1 WHERE ended_by = '' AND status = 'beendet' AND end_reason LIKE 'automatisch%'`);
    conn.exec(`UPDATE units SET ended_by = 'lehrer' WHERE ended_by = '' AND status <> 'gestartet'`);
    conn.exec(`UPDATE units SET subject = COALESCE((SELECT l.subject FROM lessons l WHERE l.unit_id = units.id), '') WHERE subject = ''`);
    // The Lern-Dokumentation of a unit written while the server ran in UTC: its start was the UTC time, one or
    // two hours early (shortly after midnight even the day before). Moved to Vienna time once; a start in
    // Vienna time never equals the UTC one, so a later start finds nothing.
    const utcStart = conn
      .prepare("SELECT l.id, u.started_at FROM lessons l JOIN units u ON u.id = l.unit_id WHERE l.starts_at = substr(u.started_at, 1, 16) AND u.started_at LIKE '%Z'")
      .all() as { id: number; started_at: string }[];
    const setStart = conn.prepare("UPDATE lessons SET starts_at = ? WHERE id = ?");
    for (const r of utcStart) setStart.run(wienerZeitstempel(Date.parse(r.started_at)), r.id);
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
    // With INITIAL_TEACHER_PASSWORD set on the server, accounts still waiting on the public demo password
    // get that start password instead (it still has to be changed at the first login)
    if (INITIAL_PASSWORD !== PUBLIC_DEFAULT_PASSWORD) {
      const rehash = conn.prepare("UPDATE teachers SET password_hash = ? WHERE id = ?");
      for (const t of accountsOnPublicDefault(conn)) rehash.run(hashPassword(INITIAL_PASSWORD), t.id);
    }
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_username ON teachers(username)");
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_current_material_active ON current_material(student_id, subject) WHERE ended_at IS NULL");
    conn.exec("CREATE INDEX IF NOT EXISTS idx_attempts_error_type ON attempts(error_type) WHERE error_type IS NOT NULL");
    // the school subjects of the Fächerliste: missing ones are added, a deactivated one stays deactivated
    const insertFach = conn.prepare("INSERT OR IGNORE INTO faecher (name, sort) VALUES (?, ?)");
    for (const [i, name] of SCHULFAECHER.entries()) insertFach.run(name, i);
    // every task is linked to its main skill in task_skills as well
    conn.exec("INSERT OR IGNORE INTO task_skills (task_id, skill_id) SELECT id, skill_id FROM tasks WHERE skill_id IS NOT NULL");
    // Präsentation im Unterricht (2026-10-27): ein Vorschlag darf ohne Lernpaket sein. SQLite nimmt NOT NULL nur weg, indem die
    // Tabelle neu angelegt wird; nur einmal, beim Upgrade einer alten Datenbank
    const entwurf = conn.prepare("PRAGMA table_info(praesentation_entwuerfe)").all() as { name: string; notnull: number }[];
    if (entwurf.find((c) => c.name === "paket_id")?.notnull) {
      const spalten = entwurf.map((c) => c.name).join(", ");
      conn.exec(`CREATE TABLE praesentation_entwuerfe_neu (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paket_id INTEGER REFERENCES lernpakete(id) ON DELETE CASCADE,
        inhalt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'vorschlag',
        praesentation_id INTEGER REFERENCES praesentationen(id) ON DELETE SET NULL,
        call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
        schritt_id INTEGER,
        auftrag TEXT
      )`);
      conn.exec(`INSERT INTO praesentation_entwuerfe_neu (${spalten}) SELECT ${spalten} FROM praesentation_entwuerfe`);
      conn.exec("DROP TABLE praesentation_entwuerfe");
      conn.exec("ALTER TABLE praesentation_entwuerfe_neu RENAME TO praesentation_entwuerfe");
      conn.exec("CREATE INDEX IF NOT EXISTS idx_praesentation_entwuerfe ON praesentation_entwuerfe(paket_id, status)");
    }
    conn.exec("CREATE INDEX IF NOT EXISTS idx_praesentation_entwuerfe_unit ON praesentation_entwuerfe(unit_id, schritt_id, status)");
  });
  tx();
}

/** Accounts whose start password is still the public demo password "lernheft". */
export function accountsOnPublicDefault(conn: Database.Database = db()) {
  const rows = conn.prepare("SELECT id, username, password_hash FROM teachers WHERE must_change_password = 1").all() as { id: number; username: string; password_hash: string }[];
  return rows.filter((r) => verifyPassword(PUBLIC_DEFAULT_PASSWORD, r.password_hash)).map(({ id, username }) => ({ id, username }));
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
    "INSERT OR IGNORE INTO skills (id, subject, area, name, grade_min, grade_max, sort, parent_id, school_types) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const tx = conn.transaction(() => {
    let sort = 0;
    for (const s of CURRICULUM) {
      insert.run(s.id, s.subject, s.area, s.name, s.gradeMin, s.gradeMax, sort++, s.parentId ?? null, s.schoolTypes?.join(",") ?? "");
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
    // Phase 5C: the reading skill covers all of Leseverständnis, its Teilfähigkeiten name the parts
    conn.exec(`UPDATE skills SET name = 'Leseverständnis' WHERE id = 'deutsch.text.verstehen' AND name = 'Informationen entnehmen'`);
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
