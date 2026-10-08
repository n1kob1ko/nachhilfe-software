/**
 * Textarbeiten: longer texts (Erlebniserzählung, Bericht, Aufsatz, …) a student writes during a unit,
 * at the tablet or the teacher's laptop. A text belongs to the student; it is started in a unit and can
 * be continued in later ones (text_units records each unit with the words before and after).
 *
 * Saving is optimistic: the browser sends the version it started from. A different version means the
 * text was changed elsewhere in the meantime and is refused (unless the same content arrives again,
 * e.g. a repeated request after a lost answer). Before a large part of a text disappears, and at most
 * every few minutes, the previous version is kept in text_revisions.
 */
import { db } from "./db";
import { countChars, countWords, docKey, parseDoc, type TextDoc } from "./text-doc";
import { runningUnitForStudent, touchUnit } from "./units";

export type TextStatus = "offen" | "fertig";
export type TextRow = {
  id: number;
  student_id: number;
  teacher_id: number | null;
  unit_id: number | null;
  subject: string;
  topic: string;
  title: string;
  prompt: string;
  body: string;
  words: number;
  chars: number;
  version: number;
  status: TextStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};
export type TextView = TextRow & { student_name: string; teacher_name: string | null };

/** Kinds of text offered when a text is started (free input is allowed too). */
export const TEXT_KINDS = [
  "Erlebniserzählung",
  "Bericht",
  "Geschichte",
  "Aufsatz",
  "Interpretation",
  "Inhaltsangabe",
  "Beschreibung",
  "Brief",
  "Erörterung",
  "Zusammenfassung",
  "Essay",
  "Letter",
  "Story",
];

const VIEW = `SELECT x.*, s.name AS student_name, t.name AS teacher_name FROM texts x
  JOIN students s ON s.id = x.student_id LEFT JOIN teachers t ON t.id = x.teacher_id`;

const iso = (ms = Date.now()) => new Date(ms).toISOString();

/** A revision is kept at most this often while writing … */
export const REVISION_EVERY_MS = 5 * 60_000;
/** … and always before this share of the words disappears at once (and at least REVISION_MIN_DROP words). */
const REVISION_DROP = 0.3;
const REVISION_MIN_DROP = 20;
const REVISIONS_KEPT = 40;
/** After a unit ended, its tablet may still deliver the last seconds of typing for this long. */
export const LATE_SAVE_MS = 10 * 60_000;

export function getText(id: number): TextView | null {
  return (db().prepare(`${VIEW} WHERE x.id = ?`).get(id) as TextView | undefined) ?? null;
}

export const textDoc = (t: Pick<TextRow, "body">): TextDoc => parseDoc(t.body);

export type NewText = { studentId: number; teacherId: number | null; unitId: number | null; subject: string; topic: string; title: string; prompt: string; at?: number };

export function createText(n: NewText): TextView {
  const at = iso(n.at);
  const conn = db();
  const id = conn.transaction(() => {
    const res = conn
      .prepare("INSERT INTO texts (student_id, teacher_id, unit_id, subject, topic, title, prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(n.studentId, n.teacherId, n.unitId, n.subject.trim(), n.topic.trim(), n.title.trim() || "Text", n.prompt.trim(), at, at);
    const textId = Number(res.lastInsertRowid);
    if (n.unitId) noteTextInUnit(textId, n.unitId, n.at);
    return textId;
  })();
  return getText(id)!;
}

export function updateTextInfo(id: number, info: { title: string; subject: string; topic: string; prompt: string }) {
  db()
    .prepare("UPDATE texts SET title = ?, subject = ?, topic = ?, prompt = ?, updated_at = ? WHERE id = ?")
    .run(info.title.trim() || "Text", info.subject.trim(), info.topic.trim(), info.prompt.trim(), iso(), id);
}

export function setTextStatus(id: number, status: TextStatus) {
  db()
    .prepare("UPDATE texts SET status = ?, completed_at = ? WHERE id = ?")
    .run(status, status === "fertig" ? iso() : null, id);
}

/** The text is worked on in this unit (opened on the tablet or started there). */
export function noteTextInUnit(textId: number, unitId: number, at?: number) {
  const now = iso(at);
  db()
    .prepare(
      `INSERT INTO text_units (text_id, unit_id, words_before, words_after, first_at, last_at)
       SELECT id, ?, words, words, ?, ? FROM texts WHERE id = ?
       ON CONFLICT (text_id, unit_id) DO NOTHING`,
    )
    .run(unitId, now, now, textId);
}

export type SaveResult =
  | { ok: true; version: number; updatedAt: string; words: number; chars: number; unchanged: boolean }
  | { ok: false; reason: "konflikt"; version: number; updatedAt: string; body: TextDoc }
  | { ok: false; reason: "fehlt" };

/**
 * Stores a new version of a text. `baseVersion` is the version the writer started from; a mismatch is a
 * conflict unless `force` (the writer chose to keep their version) or the content is already stored.
 */
export function saveText(id: number, doc: TextDoc, baseVersion: number, o: { force?: boolean; at?: number } = {}): SaveResult {
  const conn = db();
  return conn.transaction((): SaveResult => {
    const row = conn.prepare("SELECT * FROM texts WHERE id = ?").get(id) as TextRow | undefined;
    if (!row) return { ok: false, reason: "fehlt" };
    const body = docKey(doc);
    if (body === row.body) return { ok: true, version: row.version, updatedAt: row.updated_at, words: row.words, chars: row.chars, unchanged: true };
    if (row.version !== baseVersion && !o.force) return { ok: false, reason: "konflikt", version: row.version, updatedAt: row.updated_at, body: parseDoc(row.body) };

    const now = o.at ?? Date.now();
    const words = countWords(doc);
    const chars = countChars(doc);
    // overwriting a version written elsewhere ("Meine Fassung behalten"): that version is always kept
    keepRevision(row, words, now, row.version !== baseVersion);
    const version = row.version + 1;
    conn.prepare("UPDATE texts SET body = ?, words = ?, chars = ?, version = ?, updated_at = ? WHERE id = ?").run(body, words, chars, version, iso(now), id);

    // which unit this writing belongs to: the student's running unit
    const unit = runningUnitForStudent(row.student_id);
    if (unit) {
      conn
        .prepare(
          `INSERT INTO text_units (text_id, unit_id, words_before, words_after, first_at, last_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (text_id, unit_id) DO UPDATE SET words_after = excluded.words_after, last_at = excluded.last_at`,
        )
        .run(id, unit.id, row.words, words, iso(now), iso(now));
      touchUnit(unit.id, now);
    } else {
      // late delivery after the unit ended: the unit it was written in keeps the final count
      conn.prepare("UPDATE text_units SET words_after = ?, last_at = ? WHERE text_id = ? AND unit_id = (SELECT unit_id FROM text_units WHERE text_id = ? ORDER BY last_at DESC LIMIT 1)").run(words, iso(now), id, id);
    }
    return { ok: true, version, updatedAt: iso(now), words, chars, unchanged: false };
  })();
}

function keepRevision(row: TextRow, newWords: number, now: number, always = false) {
  if (row.version === 0 || !row.words) return;
  const conn = db();
  const last = conn.prepare("SELECT saved_at FROM text_revisions WHERE text_id = ? ORDER BY id DESC LIMIT 1").get(row.id) as { saved_at: string } | undefined;
  const drop = row.words - newWords;
  const bigDrop = drop >= REVISION_MIN_DROP && drop >= row.words * REVISION_DROP;
  const due = !last || now - Date.parse(last.saved_at) >= REVISION_EVERY_MS;
  if (!bigDrop && !due && !always) return;
  conn.prepare("INSERT INTO text_revisions (text_id, version, body, words, saved_at) VALUES (?, ?, ?, ?, ?)").run(row.id, row.version, row.body, row.words, iso(now));
  conn.prepare(`DELETE FROM text_revisions WHERE text_id = ? AND id NOT IN (SELECT id FROM text_revisions WHERE text_id = ? ORDER BY id DESC LIMIT ${REVISIONS_KEPT})`).run(row.id, row.id);
}

export type Revision = { id: number; version: number; words: number; saved_at: string };

export function listRevisions(textId: number): Revision[] {
  return db().prepare("SELECT id, version, words, saved_at FROM text_revisions WHERE text_id = ? ORDER BY id DESC").all(textId) as Revision[];
}

/** Brings back an earlier version; the current one is kept as a revision first. */
export function restoreRevision(textId: number, revisionId: number): SaveResult {
  const rev = db().prepare("SELECT body FROM text_revisions WHERE id = ? AND text_id = ?").get(revisionId, textId) as { body: string } | undefined;
  const text = getText(textId);
  if (!rev || !text) return { ok: false, reason: "fehlt" };
  // the current text is always kept, however recent the last revision
  db().prepare("INSERT INTO text_revisions (text_id, version, body, words, saved_at) VALUES (?, ?, ?, ?, ?)").run(textId, text.version, text.body, text.words, iso());
  return saveText(textId, parseDoc(rev.body), text.version, { force: true });
}

export type UnitText = Pick<TextRow, "id" | "title" | "topic" | "subject" | "status" | "words" | "updated_at"> & {
  words_before: number;
  words_after: number;
  /** started in this unit (else continued) */
  started_here: number;
};

/** Texts written or continued in a unit, oldest first. */
export function textsForUnit(unitId: number): UnitText[] {
  return db()
    .prepare(
      `SELECT x.id, x.title, x.topic, x.subject, x.status, x.words, x.updated_at, tu.words_before, tu.words_after,
        (x.unit_id IS ? ) AS started_here
       FROM text_units tu JOIN texts x ON x.id = tu.text_id WHERE tu.unit_id = ? ORDER BY tu.first_at, x.id`,
    )
    .all(unitId, unitId) as UnitText[];
}

/** All texts of a student, newest change first. */
export function textsForStudent(studentId: number): TextView[] {
  return db().prepare(`${VIEW} WHERE x.student_id = ? ORDER BY x.updated_at DESC, x.id DESC`).all(studentId) as TextView[];
}

/** Units a text was worked on in, oldest first. */
export function unitsOfText(textId: number) {
  return db()
    .prepare("SELECT tu.unit_id, tu.words_before, tu.words_after, u.started_at FROM text_units tu JOIN units u ON u.id = tu.unit_id WHERE tu.text_id = ? ORDER BY u.started_at")
    .all(textId) as { unit_id: number; words_before: number; words_after: number; started_at: string }[];
}

/**
 * May a tablet of `teacherId` write this text? While the teacher teaches its student, and for a few
 * minutes after that unit ended (the last seconds of typing arrive when the tablet leaves the text).
 */
export function deviceMayWrite(teacherId: number, text: Pick<TextRow, "student_id">, now = Date.now()): boolean {
  const unit = db()
    .prepare("SELECT status, ended_at FROM units WHERE teacher_id = ? AND student_id = ? ORDER BY started_at DESC, id DESC LIMIT 1")
    .get(teacherId, text.student_id) as { status: string; ended_at: string | null } | undefined;
  if (!unit) return false;
  if (unit.status === "gestartet") return true;
  return unit.ended_at !== null && now - Date.parse(unit.ended_at) <= LATE_SAVE_MS;
}

/** "246 Wörter", "1 Wort". */
export const wordsLabel = (n: number) => `${n.toLocaleString("de-AT")} ${n === 1 ? "Wort" : "Wörter"}`;
