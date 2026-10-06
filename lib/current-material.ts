/**
 * Aktueller Stoff: what a student is doing at school right now, per subject (Thema, Unterthema,
 * Fähigkeiten, seit wann, Priorität, Quelle). It is the student's own layer on top of the official
 * curriculum, which is never changed by it. One active entry per subject; a new one for the same
 * subject ends the old one, so the history stays readable. No AI involved.
 */
import { db, json } from "./db";
import * as repo from "./repo";

export const MATERIAL_SOURCES = {
  unterricht: "Unterricht",
  hausuebung: "Hausübung",
  test: "Test",
  schularbeit: "Schularbeit",
  einschaetzung: "Eigene Einschätzung",
} as const;
export type MaterialSource = keyof typeof MATERIAL_SOURCES;
export const PRIORITY_LABEL: Record<number, string> = { 1: "hoch", 2: "normal", 3: "niedrig" };

export type CurrentMaterial = {
  id: number;
  student_id: number;
  subject: string;
  topic: string;
  subtopic: string;
  skill_ids: string[];
  /** YYYY-MM-DD */
  since: string;
  /** 1 hoch · 2 normal · 3 niedrig */
  priority: number;
  note: string;
  source: MaterialSource;
  teacher_id: number | null;
  created_at: string;
  ended_at: string | null;
};
export type MaterialInput = Pick<CurrentMaterial, "student_id" | "subject" | "topic" | "subtopic" | "skill_ids" | "since" | "priority" | "note" | "source">;

const toMaterial = (r: Record<string, unknown>): CurrentMaterial => ({ ...(r as unknown as CurrentMaterial), skill_ids: json(r.skill_ids as string, []) });

/** The short text the profile shows: "Gleichungen mit Klammern" (Unterthema, else Thema). */
export const materialLabel = (m: Pick<CurrentMaterial, "topic" | "subtopic">) => m.subtopic || m.topic;

/** Active entries of a student: most important first, then the newest. */
export function activeMaterial(studentId: number): CurrentMaterial[] {
  return db()
    .prepare("SELECT * FROM current_material WHERE student_id = ? AND ended_at IS NULL ORDER BY priority, since DESC, id DESC")
    .all(studentId)
    .map((r) => toMaterial(r as Record<string, unknown>));
}
/** Earlier entries, newest first. */
export function materialHistory(studentId: number, limit = 20): CurrentMaterial[] {
  return db()
    .prepare("SELECT * FROM current_material WHERE student_id = ? AND ended_at IS NOT NULL ORDER BY ended_at DESC, id DESC LIMIT ?")
    .all(studentId, limit)
    .map((r) => toMaterial(r as Record<string, unknown>));
}
export function getMaterial(id: number): CurrentMaterial | null {
  const r = db().prepare("SELECT * FROM current_material WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? toMaterial(r) : null;
}

function clean(m: MaterialInput): MaterialInput {
  const known = new Set(repo.listSkills().map((s) => s.id));
  return {
    ...m,
    subject: m.subject.trim(),
    topic: m.topic.trim().slice(0, 120),
    subtopic: m.subtopic.trim().slice(0, 120),
    note: m.note.trim().slice(0, 500),
    skill_ids: [...new Set(m.skill_ids)].filter((id) => known.has(id)),
    priority: [1, 2, 3].includes(m.priority) ? m.priority : 2,
    source: m.source in MATERIAL_SOURCES ? m.source : "unterricht",
    since: /^\d{4}-\d{2}-\d{2}$/.test(m.since) ? m.since : new Date().toISOString().slice(0, 10),
  };
}

/**
 * Sets the current material of a subject. The active entry of that subject is ended (kept as history);
 * returns the new id. Thema is required, everything else optional.
 */
export function setCurrentMaterial(input: MaterialInput, teacherId: number | null, at = new Date()): number {
  const m = clean(input);
  if (!m.subject || !m.topic) throw new Error("Fach und Thema angeben.");
  const conn = db();
  return conn.transaction(() => {
    conn.prepare("UPDATE current_material SET ended_at = ? WHERE student_id = ? AND subject = ? AND ended_at IS NULL").run(at.toISOString(), m.student_id, m.subject);
    const res = conn
      .prepare(
        `INSERT INTO current_material (student_id, subject, topic, subtopic, skill_ids, since, priority, note, source, teacher_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(m.student_id, m.subject, m.topic, m.subtopic, JSON.stringify(m.skill_ids), m.since, m.priority, m.note, m.source, teacherId, at.toISOString());
    return Number(res.lastInsertRowid);
  })();
}
/** Corrects an entry in place (typo, more skills); the subject stays. */
export function updateCurrentMaterial(id: number, input: Omit<MaterialInput, "student_id" | "subject">) {
  const cur = getMaterial(id);
  if (!cur) return;
  const m = clean({ ...input, student_id: cur.student_id, subject: cur.subject });
  if (!m.topic) throw new Error("Thema angeben.");
  db()
    .prepare("UPDATE current_material SET topic = ?, subtopic = ?, skill_ids = ?, since = ?, priority = ?, note = ?, source = ? WHERE id = ?")
    .run(m.topic, m.subtopic, JSON.stringify(m.skill_ids), m.since, m.priority, m.note, m.source, id);
}
/** The topic is done at school: the entry moves to the history. */
export function endCurrentMaterial(id: number, at = new Date()) {
  db().prepare("UPDATE current_material SET ended_at = ? WHERE id = ? AND ended_at IS NULL").run(at.toISOString(), id);
}
