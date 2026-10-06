import { db } from "./db";
import { sourceById } from "./lehrplan";
import * as repo from "./repo";
import { schulstufe } from "./school";
import { GAP, type TaskDraft } from "./tasks";

/**
 * Aufgabenbibliothek: good tasks, saved to be used again. An entry is a worksheet with
 * kind = 'bibliothek' and exactly one task, so editing, sending, copying and tracking work as for
 * every other task. Where a task comes from stays on the task (source_type, source_id → content_sources).
 */
export const LIBRARY_KIND = "bibliothek";

export type LibraryOrigin = "eigen" | "ki" | "importiert" | "demo";
export const LIBRARY_ORIGIN_LABEL: Record<LibraryOrigin, string> = { eigen: "eigene Aufgabe", ki: "KI-generiert", importiert: "importiert", demo: "Demo" };
/** tasks.source_type → origin as the teacher sees it: OER, Lehrplan and uploaded material count as imported. */
export function libraryOrigin(sourceType: string | null | undefined): LibraryOrigin {
  if (sourceType === "ki") return "ki";
  if (sourceType === "demo") return "demo";
  if (!sourceType || sourceType === "eigen") return "eigen";
  return "importiert";
}
const ORIGIN_SQL: Record<LibraryOrigin, string> = {
  eigen: "COALESCE(t.source_type, 'eigen') = 'eigen'",
  ki: "t.source_type = 'ki'",
  demo: "t.source_type = 'demo'",
  importiert: "t.source_type NOT IN ('eigen', 'ki', 'demo')",
};

export type LibraryEntry = {
  id: number;
  title: string;
  subject: string;
  school_type: string;
  klasse: number | null;
  grade: number;
  topic: string;
  tags: string[];
  created_at: string;
  task: repo.Task;
  origin: LibraryOrigin;
  source: { name: string; license: string; attribution: string; url: string } | null;
};

export type LibraryFilter = {
  q?: string;
  subject?: string;
  schoolType?: string;
  klasse?: number | null;
  topic?: string;
  skillId?: string;
  difficulty?: string;
  /** task category (textaufgabe …) or, without one, the answer format */
  type?: string;
  origin?: LibraryOrigin;
  tag?: string;
};

export const cleanTags = (tags: string[] | string): string[] =>
  [...new Set((Array.isArray(tags) ? tags : tags.split(/[,;]/)).map((t) => t.trim().replace(/^#/, "").slice(0, 40)).filter(Boolean))].slice(0, 12);

/** Short title from the task text: its first line, gaps shown as "…". */
export function titleFromPrompt(prompt: string): string {
  const line = prompt.replaceAll(GAP, "…").split("\n").find((l) => l.trim()) ?? "";
  const t = line.trim();
  return t.length > 80 ? `${t.slice(0, 77).trimEnd()} …` : t || "Aufgabe";
}

function toEntry(w: repo.Worksheet, task: repo.Task): LibraryEntry {
  const src = sourceById(task.sourceId);
  return {
    id: w.id,
    title: w.title,
    subject: w.subject,
    school_type: w.school_type,
    klasse: w.klasse,
    grade: w.grade,
    topic: w.topic,
    tags: w.tags,
    created_at: w.created_at,
    task,
    origin: libraryOrigin(task.sourceType),
    source: src ? { name: src.name, license: src.license, attribution: src.attribution_text, url: src.url } : null,
  };
}

export function getLibraryEntry(id: number): LibraryEntry | null {
  const w = repo.getWorksheet(id);
  if (!w || w.kind !== LIBRARY_KIND) return null;
  const task = repo.listTasks(id)[0];
  return task ? toEntry(w, task) : null;
}

/** The library entry that already holds this task (same subject, text and answer), if any. */
function findSame(subject: string, t: Pick<TaskDraft, "prompt" | "answer" | "data">): number | null {
  const row = db()
    .prepare(
      `SELECT w.id FROM worksheets w JOIN tasks t ON t.worksheet_id = w.id
       WHERE w.kind = 'bibliothek' AND w.subject = ? AND t.prompt = ? AND t.answer = ? AND t.data = ? LIMIT 1`,
    )
    .get(subject, t.prompt, JSON.stringify(t.answer), JSON.stringify(t.data)) as { id: number } | undefined;
  return row?.id ?? null;
}

const draftOf = (t: repo.Task): TaskDraft => {
  const { id: _i, worksheet_id: _w, position: _p, level: _l, ...draft } = t;
  void _i, void _w, void _p, void _l;
  return draft;
};

/**
 * Saves a task of an exercise in the library (a copy: the exercise stays as it is). Saving the same
 * task twice returns the existing entry.
 */
export function saveToLibrary(taskId: number, o: { title?: string; tags?: string[]; teacherId?: number | null } = {}): { id: number; existing: boolean } | { error: string } {
  const task = repo.getTask(taskId);
  const w = task ? repo.getWorksheet(task.worksheet_id) : null;
  if (!task || !w) return { error: "Aufgabe nicht gefunden." };
  if (!task.prompt.trim()) return { error: "Die Aufgabe hat noch keinen Text." };
  const same = findSame(w.subject, task);
  if (same) return { id: same, existing: true };
  const skill = task.skillId ? repo.getSkill(task.skillId) : null;
  const id = repo.createWorksheet(
    {
      title: o.title?.trim() || titleFromPrompt(task.prompt),
      subject: w.subject,
      grade: w.grade,
      school_type: w.school_type,
      klasse: w.klasse,
      topic: skill?.area ?? w.topic,
      difficulty: task.difficulty,
      task_type: task.type,
      kind: LIBRARY_KIND,
      source: task.sourceType === "ki" ? "ki" : "manuell",
      skill_ids: task.skillIds ?? [],
      teacher_id: o.teacherId ?? null,
      status: "freigegeben",
      source_worksheet_id: w.id,
      tags: cleanTags(o.tags ?? []),
    },
    [draftOf(task)],
  );
  return { id, existing: false };
}

/** A new task written directly in the library; it opens in the task editor. */
export function createLibraryTask(
  m: { subject: string; schoolType: string; klasse: number | null; topic: string; tags: string[]; title?: string; teacherId?: number | null },
  draft: TaskDraft,
): number {
  return repo.createWorksheet(
    {
      title: m.title?.trim() || "Neue Aufgabe",
      subject: m.subject,
      grade: m.klasse && m.schoolType ? schulstufe(m.schoolType, m.klasse) : 0,
      school_type: m.schoolType,
      klasse: m.klasse,
      topic: m.topic,
      difficulty: draft.difficulty,
      task_type: draft.type,
      kind: LIBRARY_KIND,
      source: "manuell",
      skill_ids: draft.skillIds ?? (draft.skillId ? [draft.skillId] : []),
      teacher_id: m.teacherId ?? null,
      status: "freigegeben",
      tags: cleanTags(m.tags),
    },
    [{ ...draft, sourceType: draft.sourceType ?? "eigen" }],
  );
}

/** Title, tags and where the entry belongs (Schulart, Klasse, Thema). The task itself is edited in the task editor. */
export function updateLibraryEntry(id: number, m: { title: string; schoolType: string; klasse: number | null; topic: string; tags: string[] }): boolean {
  const w = repo.getWorksheet(id);
  if (!w || w.kind !== LIBRARY_KIND) return false;
  db()
    .prepare("UPDATE worksheets SET title = ?, school_type = ?, klasse = ?, grade = ?, topic = ?, tags = ? WHERE id = ?")
    .run(
      m.title.trim().slice(0, 120) || w.title,
      m.schoolType,
      m.klasse,
      m.klasse && m.schoolType ? schulstufe(m.schoolType, m.klasse) : w.grade,
      m.topic.trim().slice(0, 120),
      JSON.stringify(cleanTags(m.tags)),
      id,
    );
  return true;
}

export function duplicateLibraryEntry(id: number, teacherId: number | null): number | null {
  const w = repo.getWorksheet(id);
  if (!w || w.kind !== LIBRARY_KIND) return null;
  return repo.duplicateWorksheet(id, { kind: LIBRARY_KIND, status: "freigegeben", teacherId, title: `${w.title} (Kopie)` });
}

/** Deletes an entry. Exercises that used the task keep their own copy. */
export function deleteLibraryEntry(id: number): boolean {
  const w = repo.getWorksheet(id);
  if (!w || w.kind !== LIBRARY_KIND) return false;
  repo.deleteWorksheet(id);
  return true;
}

/** Entries matching the filter, newest first. A skill filter also finds tasks of its sub-skills. */
export function searchLibrary(f: LibraryFilter = {}, limit = 200): LibraryEntry[] {
  const where = ["w.kind = 'bibliothek'"];
  const params: unknown[] = [];
  const add = (sql: string, ...p: unknown[]) => (where.push(sql), params.push(...p));
  if (f.subject) add("w.subject = ?", f.subject);
  if (f.schoolType) add("w.school_type = ?", f.schoolType);
  if (f.klasse) add("w.klasse = ?", f.klasse);
  if (f.topic) add("w.topic = ?", f.topic);
  if (f.difficulty) add("t.difficulty = ?", f.difficulty);
  if (f.type) add("COALESCE(t.category, t.type) = ?", f.type);
  if (f.origin && ORIGIN_SQL[f.origin]) where.push(ORIGIN_SQL[f.origin]);
  if (f.tag) add("EXISTS (SELECT 1 FROM json_each(w.tags) j WHERE lower(j.value) = lower(?))", f.tag);
  if (f.skillId) add("EXISTS (SELECT 1 FROM task_skills ts LEFT JOIN skills s ON s.id = ts.skill_id WHERE ts.task_id = t.id AND (ts.skill_id = ? OR s.parent_id = ?))", f.skillId, f.skillId);
  if (f.q?.trim()) {
    const like = `%${f.q.trim()}%`;
    add("(t.prompt LIKE ? OR w.title LIKE ? OR w.topic LIKE ? OR w.tags LIKE ? OR t.solution LIKE ?)", like, like, like, like, like);
  }
  const rows = db()
    .prepare(
      `SELECT w.id AS wid, t.id AS tid FROM worksheets w JOIN tasks t ON t.worksheet_id = w.id
       WHERE ${where.join(" AND ")} ORDER BY w.created_at DESC, w.id DESC LIMIT ?`,
    )
    .all(...params, limit) as { wid: number; tid: number }[];
  return rows.flatMap((r) => {
    const w = repo.getWorksheet(r.wid);
    const t = repo.getTask(r.tid);
    return w && t ? [toEntry(w, t)] : [];
  });
}

/** What the filters can offer: only values that occur in the library. */
export function libraryFacets(subject?: string) {
  const entries = searchLibrary(subject ? { subject } : {}, 5000);
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    total: entries.length,
    subjects: uniq(searchLibrary({}, 5000).map((e) => e.subject)).sort(),
    levels: uniq(entries.filter((e) => e.school_type).map((e) => `${e.school_type}|${e.klasse ?? ""}`)),
    topics: uniq(entries.map((e) => e.topic).filter(Boolean)).sort(),
    skills: uniq(entries.flatMap((e) => e.task.skillIds ?? [])),
    difficulties: uniq(entries.map((e) => e.task.difficulty)),
    types: uniq(entries.map((e) => e.task.category ?? e.task.type)),
    origins: uniq(entries.map((e) => e.origin)),
    tags: uniq(entries.flatMap((e) => e.tags)).sort((a, b) => a.localeCompare(b, "de")),
  };
}

export const libraryCount = () => (db().prepare("SELECT COUNT(*) AS n FROM worksheets WHERE kind = 'bibliothek'").get() as { n: number }).n;

/**
 * A new draft exercise from library entries (in the order given). Entries of another subject than the
 * first are left out, because an exercise has one subject.
 */
export function exerciseFromLibrary(ids: number[], o: { studentId?: number | null; teacherId?: number | null; title?: string } = {}): { id: number; skipped: number } | { error: string } {
  const entries = ids.map(getLibraryEntry).filter((e): e is LibraryEntry => Boolean(e));
  if (!entries.length) return { error: "Bitte mindestens eine Aufgabe auswählen." };
  const subject = entries[0].subject;
  const used = entries.filter((e) => e.subject === subject);
  const student = o.studentId ? repo.getStudent(o.studentId) : null;
  const schoolType = student?.school_type || used[0].school_type;
  const klasse = student?.klasse ?? used[0].klasse;
  const topics = [...new Set(used.map((e) => e.topic).filter(Boolean))];
  const first = student?.name.split(" ")[0];
  const base = o.title?.trim() || (topics.length ? topics.slice(0, 3).join(", ") : "Aufgaben aus der Bibliothek");
  const id = repo.createWorksheet(
    {
      title: first ? `${first} – ${base}` : base,
      subject,
      grade: klasse && schoolType ? schulstufe(schoolType, klasse) : used[0].grade,
      school_type: schoolType,
      klasse,
      topic: topics.join(", "),
      difficulty: [...new Set(used.map((e) => e.task.difficulty))].length === 1 ? used[0].task.difficulty : "gemischt",
      task_type: [...new Set(used.map((e) => e.task.type))].length === 1 ? used[0].task.type : "mixed",
      kind: "uebung",
      source: "manuell",
      skill_ids: [...new Set(used.flatMap((e) => e.task.skillIds ?? []))],
      student_id: o.studentId ?? null,
      teacher_id: o.teacherId ?? null,
      status: "entwurf",
    },
    used.map((e) => draftOf(e.task)),
  );
  return { id, skipped: entries.length - used.length };
}
