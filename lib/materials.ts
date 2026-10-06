import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { MaterialAnalysis } from "./ai";
import { db } from "./db";
import { getSource, matchSkills, saveSource, sourceById, taskBankAllowed, type ContentSource } from "./lehrplan";
import { createLibraryTask, LIBRARY_KIND } from "./library";
import * as repo from "./repo";
import { schulstufe } from "./school";
import type { TaskDraft } from "./tasks";

/**
 * Material: photos, PDFs and worksheets a teacher uploads. The file is stored under data/uploads
 * (named by its checksum, never by the uploaded name); the row in `materials` holds where it belongs
 * (Fach, Thema, Fähigkeiten), its source and licence (content_sources) and, optionally, suggestions
 * from an analysis. Nothing from a material becomes a library task without the teacher checking it,
 * and content of a reference source only in the teacher's own words.
 */
export const MATERIAL_KINDS = { foto: "Foto", pdf: "PDF", arbeitsblatt: "Arbeitsblatt" } as const;
export type MaterialKind = keyof typeof MATERIAL_KINDS;
export const MATERIAL_STATUS = { hochgeladen: "neu", vorschlag: "Vorschlag da", geprueft: "eingeordnet" } as const;
export type MaterialStatus = keyof typeof MATERIAL_STATUS;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Larger files cannot be sent for analysis (the API's limits for images and documents, with room for base64). */
export const MAX_ANALYSIS_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ANALYSIS_PDF_BYTES = 10 * 1024 * 1024;

/** Where a material comes from, as the teacher says it; decides what may be taken over. */
export const MATERIAL_ORIGINS = {
  eigen: { label: "Eigenes Material", source_type: "eigen" },
  schule: { label: "Schule, Schulbuch oder Verlag", source_type: "referenz" },
  frei: { label: "Freie Lizenz (z. B. CC BY)", source_type: "oer" },
} as const;
export type MaterialOrigin = keyof typeof MATERIAL_ORIGINS;

const TYPES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];
/** The real type of a file from its first bytes; the name and the browser's type are not trusted. */
export const sniffType = (b: Buffer) => TYPES.find((t) => t.test(b)) ?? null;

export function uploadsDir(): string {
  if (process.env.UPLOADS_PATH) return process.env.UPLOADS_PATH;
  const dbFile = process.env.DATABASE_PATH;
  return dbFile && dbFile !== ":memory:" ? path.join(path.dirname(dbFile), "uploads") : path.join(process.cwd(), "data", "uploads");
}
export const materialFile = (m: Pick<Material, "stored_path">) => path.join(uploadsDir(), path.basename(m.stored_path));

export type Material = {
  id: number;
  teacher_id: number | null;
  student_id: number | null;
  title: string;
  kind: MaterialKind;
  file_name: string;
  mime: string;
  size: number;
  sha256: string;
  stored_path: string;
  source_id: number | null;
  subject: string;
  school_type: string;
  klasse: number | null;
  topic: string;
  skill_ids: string[];
  status: MaterialStatus;
  analysis: MaterialAnalysis | null;
  analysis_source: string;
  analyzed_at: string | null;
  notes: string;
  created_at: string;
};
type Row = Record<string, unknown>;
const toMaterial = (r: Row): Material => {
  let analysis: MaterialAnalysis | null = null;
  try {
    analysis = r.analysis ? (JSON.parse(r.analysis as string) as MaterialAnalysis) : null;
  } catch {
    analysis = null;
  }
  let skills: string[] = [];
  try {
    skills = JSON.parse((r.skill_ids as string) || "[]");
  } catch {
    skills = [];
  }
  return { ...(r as unknown as Material), skill_ids: skills, analysis };
};

export function getMaterial(id: number): Material | null {
  const r = db().prepare("SELECT * FROM materials WHERE id = ?").get(id) as Row | undefined;
  return r ? toMaterial(r) : null;
}
export function listMaterials(o: { studentId?: number } = {}): Material[] {
  return (db()
    .prepare(`SELECT * FROM materials ${o.studentId ? "WHERE student_id = ?" : ""} ORDER BY created_at DESC, id DESC`)
    .all(...(o.studentId ? [o.studentId] : [])) as Row[]).map(toMaterial);
}

const cleanName = (name: string) => (name.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f"<>]/g, "").trim().slice(0, 160) || "datei";

/**
 * Stores an uploaded file. The type is taken from the content (PDF, JPEG, PNG, WebP); anything else
 * is refused. The same file uploaded twice gives the existing material.
 */
export function saveUpload(
  file: { name: string; data: Buffer },
  m: { title?: string; kind?: MaterialKind; subject?: string; studentId?: number | null; teacherId: number | null; at?: Date },
): { id: number; existing: boolean } {
  if (!file.data.length) throw new Error("Die Datei ist leer.");
  if (file.data.length > MAX_UPLOAD_BYTES) throw new Error(`Die Datei ist zu groß (höchstens ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`);
  const type = sniffType(file.data);
  if (!type) throw new Error("Nur Fotos (JPG, PNG, WebP) und PDF-Dateien sind möglich.");
  const sha256 = crypto.createHash("sha256").update(file.data).digest("hex");
  const same = db().prepare("SELECT id FROM materials WHERE sha256 = ? ORDER BY id LIMIT 1").get(sha256) as { id: number } | undefined;
  if (same) return { id: same.id, existing: true };
  const stored = `${sha256}.${type.ext}`;
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const target = path.join(uploadsDir(), stored);
  if (!fs.existsSync(target)) fs.writeFileSync(target, file.data, { mode: 0o600 });
  const name = cleanName(file.name);
  const kind: MaterialKind = m.kind && m.kind in MATERIAL_KINDS ? m.kind : type.mime === "application/pdf" ? "pdf" : "foto";
  const student = m.studentId ? repo.getStudent(m.studentId) : null;
  const res = db()
    .prepare(
      `INSERT INTO materials (teacher_id, student_id, title, kind, file_name, mime, size, sha256, stored_path, subject, school_type, klasse, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      m.teacherId, student?.id ?? null, (m.title?.trim() || name.replace(/\.[a-z0-9]{2,4}$/i, "")).slice(0, 120), kind, name, type.mime, file.data.length, sha256, stored,
      m.subject?.trim() ?? "", student?.school_type ?? "", student?.klasse ?? null, (m.at ?? new Date()).toISOString(),
    );
  return { id: Number(res.lastInsertRowid), existing: false };
}

/** Where the material belongs. Saving it counts as checked by the teacher. */
export function classifyMaterial(id: number, c: { title: string; kind: MaterialKind; subject: string; schoolType: string; klasse: number | null; topic: string; skillIds: string[]; studentId: number | null; notes: string }) {
  const m = getMaterial(id);
  if (!m) return false;
  const known = new Set(repo.listSkills().filter((s) => !c.subject || s.subject === c.subject).map((s) => s.id));
  db()
    .prepare("UPDATE materials SET title = ?, kind = ?, subject = ?, school_type = ?, klasse = ?, topic = ?, skill_ids = ?, student_id = ?, notes = ?, status = 'geprueft' WHERE id = ?")
    .run(
      c.title.trim().slice(0, 120) || m.title,
      c.kind in MATERIAL_KINDS ? c.kind : m.kind,
      c.subject.trim(),
      c.schoolType,
      c.schoolType ? c.klasse : null,
      c.topic.trim().slice(0, 160),
      JSON.stringify([...new Set(c.skillIds)].filter((s) => known.has(s))),
      c.studentId && repo.getStudent(c.studentId) ? c.studentId : null,
      c.notes.trim().slice(0, 2000),
      id,
    );
  return true;
}

/** Source and licence of the material, kept as a content source of its own. */
export function setMaterialSource(id: number, s: { origin: MaterialOrigin; name: string; author: string; url: string; license: string; attribution: string }): ContentSource | null {
  const m = getMaterial(id);
  if (!m || !(s.origin in MATERIAL_ORIGINS)) return null;
  const o = MATERIAL_ORIGINS[s.origin];
  const url = /^https?:\/\//i.test(s.url.trim()) ? s.url.trim().slice(0, 500) : "";
  const sourceId = saveSource({
    key: `material-${m.id}`,
    name: s.name.trim().slice(0, 160) || (s.origin === "eigen" ? "Eigenes Material" : m.title),
    source_type: o.source_type,
    url,
    author: s.author.trim().slice(0, 160),
    publisher: "",
    license: s.origin === "eigen" ? "eigen" : s.license.trim().slice(0, 80),
    attribution_text: s.attribution.trim().slice(0, 400),
    content_hash: m.sha256,
    retrieved_at: m.created_at,
    notes: `Material „${m.title}“ (${m.file_name})`,
  });
  db().prepare("UPDATE materials SET source_id = ? WHERE id = ?").run(sourceId, id);
  return sourceById(sourceId);
}

export const materialOrigin = (src: ContentSource | null): MaterialOrigin | null =>
  !src ? null : src.source_type === "eigen" ? "eigen" : src.source_type === "referenz" ? "schule" : src.source_type === "oer" ? "frei" : null;

/** May tasks of this material go into the library as they are? (Own material and clearly licensed OER only.) */
export function takeoverRule(m: Material): { allowed: boolean; reason: string; source: ContentSource | null } {
  const src = sourceById(m.source_id);
  if (!src) return { allowed: false, reason: "Erst Herkunft und Lizenz angeben.", source: null };
  const t = taskBankAllowed(src);
  return { allowed: t.ok, reason: t.ok ? "Aufgaben dürfen nach deiner Prüfung übernommen werden." : `${t.reason}. Aufgaben nur in eigenen Worten.`, source: src };
}

/** Suggested skills without AI: from the Thema (or title) and the subject. */
export function suggestedSkills(m: Material): repo.Skill[] {
  if (!m.subject) return [];
  const student = m.student_id ? repo.getStudent(m.student_id) : null;
  return matchSkills(m.topic || m.title, m.subject, { student: student ?? undefined, limit: 6 }).map((x) => x.skill);
}

/** Stores the suggestions of an analysis. They stay suggestions until the teacher takes them over. */
export function setAnalysis(id: number, a: MaterialAnalysis, source: "ki", at = new Date()) {
  const known = new Set(repo.listSkills().map((s) => s.id));
  const clean: MaterialAnalysis = {
    subject: a.subject?.slice(0, 60) ?? null,
    topic: a.topic?.slice(0, 160) ?? null,
    skill_ids: a.skill_ids.filter((s) => known.has(s)).slice(0, 5),
    tasks: a.tasks.slice(0, 12).map((t) => ({ prompt: t.prompt.slice(0, 2000), answer: t.answer?.slice(0, 200) ?? null, solution: t.solution?.slice(0, 2000) ?? null, skill_id: t.skill_id && known.has(t.skill_id) ? t.skill_id : null })),
    notes: a.notes.slice(0, 500),
  };
  db().prepare("UPDATE materials SET analysis = ?, analysis_source = ?, analyzed_at = ?, status = CASE WHEN status = 'geprueft' THEN status ELSE 'vorschlag' END WHERE id = ?").run(JSON.stringify(clean), source, at.toISOString(), id);
}

export type TakeoverInput = {
  prompt: string;
  answers: string[];
  solution: string;
  skillId: string | null;
  difficulty: TaskDraft["difficulty"];
  /** the teacher has checked the task */
  reviewed: boolean;
  /** the teacher wrote the task in their own words (needed for reference sources) */
  ownWords: boolean;
  tags?: string[];
};

/**
 * A checked task from the material goes into the library. As it is only for own material and clearly
 * licensed sources (with their licence on the task); otherwise only rewritten in the teacher's own
 * words, then it counts as an own task with the material as its model.
 */
export function takeOverTask(materialId: number, t: TakeoverInput, teacherId: number | null): { libraryId: number } | { error: string } {
  const m = getMaterial(materialId);
  if (!m) return { error: "Material nicht gefunden." };
  if (!m.subject) return { error: "Bitte zuerst das Fach des Materials eintragen." };
  if (!t.reviewed) return { error: "Bitte bestätigen, dass du die Aufgabe geprüft hast." };
  if (!t.prompt.trim()) return { error: "Die Aufgabenstellung fehlt." };
  const rule = takeoverRule(m);
  if (!rule.source) return { error: rule.reason };
  if (!rule.allowed && !t.ownWords) return { error: rule.reason };
  const skill = t.skillId ? repo.getSkill(t.skillId) : null;
  if (t.skillId && (!skill || skill.subject !== m.subject)) return { error: "Die Fähigkeit passt nicht zum Fach." };
  const answers = t.answers.map((a) => a.trim()).filter(Boolean);
  const draft: TaskDraft = {
    type: answers.length ? "calc" : "free",
    skillId: skill?.id ?? null,
    skillIds: skill ? [skill.id] : [],
    category: null,
    difficulty: t.difficulty,
    prompt: t.prompt.trim().slice(0, 4000),
    data: {},
    answer: answers.length ? { accepted: answers, mode: answers.every((a) => /^-?[\d.,/\s]+$/.test(a)) ? "value" : "text" } : { sample: t.solution.trim() },
    solution: t.solution.trim().slice(0, 4000),
    hints: [],
    errorMap: [],
    // as it is: origin and licence of the material; in own words: an own task
    sourceType: rule.allowed && !t.ownWords ? (rule.source.source_type === "oer" ? "oer" : "eigen") : "eigen",
    sourceId: rule.allowed && !t.ownWords ? rule.source.id : null,
  };
  const libraryId = createLibraryTask(
    { subject: m.subject, schoolType: m.school_type, klasse: m.klasse, topic: skill?.area ?? m.topic, tags: [...(t.tags ?? []), "Material"], title: titleOf(draft.prompt), teacherId },
    draft,
  );
  // the material stays traceable as the task's model (source_items, one row per material)
  db()
    .prepare("INSERT OR IGNORE INTO source_items (source_id, item_id, author, license, retrieved_at, content_hash) VALUES (?, ?, ?, ?, ?, ?)")
    .run(rule.source.id, `material-${m.id}`, rule.source.author, rule.source.license, m.created_at, m.sha256);
  const item = db().prepare("SELECT id FROM source_items WHERE source_id = ? AND item_id = ?").get(rule.source.id, `material-${m.id}`) as { id: number };
  db().prepare("UPDATE tasks SET source_item_id = ? WHERE worksheet_id = ?").run(item.id, libraryId);
  return { libraryId };
}
const titleOf = (prompt: string) => {
  const line = prompt.split("\n").find((l) => l.trim())?.trim() ?? "Aufgabe";
  return line.length > 80 ? `${line.slice(0, 77).trimEnd()} …` : line;
};

/** Library entries made from this material. */
export function libraryTasksOf(materialId: number): { id: number; title: string; sourceType: string }[] {
  return db()
    .prepare(
      `SELECT w.id, w.title, t.source_type AS sourceType FROM source_items si JOIN tasks t ON t.source_item_id = si.id JOIN worksheets w ON w.id = t.worksheet_id
       WHERE si.item_id = ? AND w.kind = ? ORDER BY w.id`,
    )
    .all(`material-${materialId}`, LIBRARY_KIND) as { id: number; title: string; sourceType: string }[];
}

/** Deletes the material and its file (if no other material uses the same file). Library tasks made from it stay. */
export function deleteMaterial(id: number): boolean {
  const m = getMaterial(id);
  if (!m) return false;
  db().prepare("DELETE FROM materials WHERE id = ?").run(id);
  const others = db().prepare("SELECT COUNT(*) AS n FROM materials WHERE sha256 = ?").get(m.sha256) as { n: number };
  if (!others.n) fs.rmSync(materialFile(m), { force: true });
  const src = getSource(`material-${id}`);
  // the source row stays when tasks still point to it (their licence must stay readable)
  if (src) {
    const used = db().prepare("SELECT (SELECT COUNT(*) FROM tasks WHERE source_id = ?) + (SELECT COUNT(*) FROM source_items si JOIN tasks t ON t.source_item_id = si.id WHERE si.source_id = ?) AS n").get(src.id, src.id) as { n: number };
    if (!used.n) db().prepare("DELETE FROM content_sources WHERE id = ?").run(src.id);
  }
  return true;
}

export const materialLevel = (m: Pick<Material, "school_type" | "klasse">) => (m.school_type && m.klasse ? schulstufe(m.school_type, m.klasse) : null);
