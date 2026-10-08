/**
 * Bildgeschichten: a Textarbeit (lib/texts.ts, Textsorte "Bildgeschichte") with a series of pictures the
 * teacher uploads. The story is the text and uses everything a text has (autosave, versions, read along,
 * correction, print); this module keeps the pictures and the settings that belong to them.
 *
 * Pictures are stored like material files (named by their checksum, the type taken from the content),
 * in their own folder uploads/bildgeschichten, so the regular backup of the uploads folder includes
 * them. They never become material or library content.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import { uploadsDir, sniffType } from "./materials";
import { schoolType } from "./school";
import { createText, getText, setTextStatus, type TextView } from "./texts";

export const PICTURE_STORY_KIND = "Bildgeschichte";
export const MAX_IMAGES = 12;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** All pictures of one request together; the browser makes them much smaller before sending. */
export const MAX_REQUEST_BYTES = 60 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_STARTERS = 8;
export const MAX_CAPTION = 300;

/** Room to write on the empty worksheet, in lines of 9 mm (one A4 page holds about 26). */
export const LINE_CHOICES: { lines: number; label: string }[] = [
  { lines: 14, label: "eine halbe Seite" },
  { lines: 26, label: "eine Seite" },
  { lines: 40, label: "eineinhalb Seiten" },
  { lines: 54, label: "zwei Seiten" },
];

/** Where the pictures come from: only to document it, nothing is shared or reused because of it. */
export const SOURCE_KINDS = {
  eigen: "Eigene Bilder",
  schule: "Schulbuch oder Verlag",
  frei: "Freie Lizenz (z. B. CC BY)",
  andere: "Andere Quelle",
} as const;
export type SourceKind = keyof typeof SOURCE_KINDS;

export type PictureStory = {
  text_id: number;
  school_type: string;
  klasse: number | null;
  target_words: number | null;
  starters: string[];
  hints: string;
  lines: number;
  source_kind: SourceKind | "";
  source_note: string;
  created_at: string;
  updated_at: string;
};
export type StoryImage = {
  id: number;
  text_id: number;
  position: number;
  file_name: string;
  mime: string;
  size: number;
  sha256: string;
  stored_path: string;
  caption: string;
  created_at: string;
};
export type StorySettings = {
  schoolType: string;
  klasse: number | null;
  targetWords: number | null;
  starters: string[];
  hints: string;
  lines: number;
  sourceKind: SourceKind | "";
  sourceNote: string;
};
/** A picture as it arrives: its bytes and the name it had on the teacher's device. */
export type UploadedImage = { name: string; data: Buffer };

type Row = Record<string, unknown>;
const iso = () => new Date().toISOString();

const toStory = (r: Row): PictureStory => {
  let starters: string[] = [];
  try {
    const v = JSON.parse((r.starters as string) || "[]");
    starters = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    starters = [];
  }
  return { ...(r as unknown as PictureStory), starters };
};

export function getPictureStory(textId: number): PictureStory | null {
  const r = db().prepare("SELECT * FROM picture_stories WHERE text_id = ?").get(textId) as Row | undefined;
  return r ? toStory(r) : null;
}

export function storyImages(textId: number): StoryImage[] {
  return db().prepare("SELECT * FROM picture_story_images WHERE text_id = ? ORDER BY position, id").all(textId) as StoryImage[];
}

/** Which of these texts are Bildgeschichten, with the number of pictures (for lists). */
export function pictureCounts(textIds: number[]): Map<number, number> {
  if (!textIds.length) return new Map();
  const rows = db()
    .prepare(`SELECT p.text_id AS id, COUNT(i.id) AS n FROM picture_stories p LEFT JOIN picture_story_images i ON i.text_id = p.text_id WHERE p.text_id IN (${textIds.map(() => "?").join(",")}) GROUP BY p.text_id`)
    .all(...textIds) as { id: number; n: number }[];
  return new Map(rows.map((r) => [r.id, r.n]));
}

/** A picture with the student its story belongs to, for the access checks of the picture routes. */
export function imageWithOwner(id: number): (StoryImage & { student_id: number }) | null {
  if (!Number.isInteger(id)) return null;
  return (
    (db().prepare("SELECT i.*, x.student_id FROM picture_story_images i JOIN texts x ON x.id = i.text_id WHERE i.id = ?").get(id) as (StoryImage & { student_id: number }) | undefined) ?? null
  );
}

// ---------- files ----------

export function storyDir(): string {
  return path.join(/*turbopackIgnore: true*/ uploadsDir(), "bildgeschichten");
}
export const imageFile = (i: Pick<StoryImage, "stored_path">) => path.join(/*turbopackIgnore: true*/ storyDir(), path.basename(i.stored_path));

const cleanName = (name: string) => (name.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f"<>]/g, "").trim().slice(0, 160) || "bild";

/** Checks a picture and writes its file (once per content). Throws with a message for the teacher. */
export function storeImageFile(img: UploadedImage): { mime: string; size: number; sha256: string; stored: string; name: string } {
  const name = cleanName(img.name);
  if (!img.data.length) throw new Error(`„${name}“ ist leer.`);
  if (img.data.length > MAX_IMAGE_BYTES) throw new Error(`„${name}“ ist zu groß (höchstens ${MAX_IMAGE_BYTES / 1024 / 1024} MB pro Bild).`);
  const type = sniffType(img.data);
  if (!type || !IMAGE_TYPES.includes(type.mime)) throw new Error(`„${name}“ ist kein Bild im Format JPG, PNG oder WebP.`);
  const sha256 = crypto.createHash("sha256").update(img.data).digest("hex");
  const stored = `${sha256}.${type.ext}`;
  fs.mkdirSync(/*turbopackIgnore: true*/ storyDir(), { recursive: true });
  const target = imageFile({ stored_path: stored });
  if (!fs.existsSync(/*turbopackIgnore: true*/ target)) fs.writeFileSync(/*turbopackIgnore: true*/ target, img.data, { mode: 0o600 });
  return { mime: type.mime, size: img.data.length, sha256, stored, name };
}

/** Removes the file of a picture that no picture uses any more. */
function dropFileIfUnused(stored: string) {
  const used = db().prepare("SELECT COUNT(*) AS n FROM picture_story_images WHERE stored_path = ?").get(stored) as { n: number };
  if (!used.n) fs.rmSync(imageFile({ stored_path: stored }), { force: true });
}

/** Picture files of all stories of a student, read before the student is deleted (rows go by cascade, files do not). */
export function studentImageFiles(studentId: number): string[] {
  const rows = db()
    .prepare("SELECT DISTINCT i.stored_path FROM picture_story_images i JOIN texts t ON t.id = i.text_id WHERE t.student_id = ?")
    .all(studentId) as { stored_path: string }[];
  return rows.map((r) => r.stored_path);
}
/** Removes those files afterwards, unless another story still uses the same picture. */
export function dropFilesIfUnused(stored: string[]) {
  for (const s of stored) dropFileIfUnused(s);
}

// ---------- settings ----------

const intOr = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** The settings from a form, trimmed and within limits; unknown values become the defaults. */
export function cleanSettings(raw: Partial<Record<keyof StorySettings, unknown>>): StorySettings {
  const type = schoolType(String(raw.schoolType ?? ""));
  const klasse = type ? intOr(raw.klasse, 1, type.classes) : null;
  const starters = (Array.isArray(raw.starters) ? raw.starters : String(raw.starters ?? "").split("\n"))
    .map((s) => String(s).replace(/\s+/g, " ").trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, MAX_STARTERS);
  const lines = intOr(raw.lines, 6, 80) ?? 26;
  const kind = String(raw.sourceKind ?? "");
  return {
    schoolType: type?.name ?? "",
    klasse,
    targetWords: intOr(raw.targetWords, 10, 3000),
    starters,
    hints: String(raw.hints ?? "").trim().slice(0, 1500),
    lines,
    sourceKind: kind in SOURCE_KINDS ? (kind as SourceKind) : "",
    sourceNote: String(raw.sourceNote ?? "").trim().slice(0, 400),
  };
}

const cleanCaption = (c: unknown) => String(c ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CAPTION);

// ---------- create and change ----------

export type NewPictureStory = {
  studentId: number;
  teacherId: number | null;
  unitId: number | null;
  subject: string;
  title: string;
  prompt: string;
  settings: StorySettings;
  images: (UploadedImage & { caption?: string })[];
};

/**
 * A new Bildgeschichte: the text (Textsorte "Bildgeschichte"), its settings and its pictures in the given
 * order. Every picture is checked before anything is stored; one wrong file stops the whole upload.
 */
export function createPictureStory(n: NewPictureStory): TextView {
  if (!n.images.length) throw new Error("Bitte mindestens ein Bild hochladen.");
  if (n.images.length > MAX_IMAGES) throw new Error(`Höchstens ${MAX_IMAGES} Bilder.`);
  const files = n.images.map((img) => ({ ...storeImageFile(img), caption: cleanCaption(img.caption) }));
  const conn = db();
  const now = iso();
  return conn.transaction(() => {
    const text = createText({ studentId: n.studentId, teacherId: n.teacherId, unitId: n.unitId, subject: n.subject, topic: PICTURE_STORY_KIND, title: n.title, prompt: n.prompt });
    const s = n.settings;
    conn
      .prepare(
        `INSERT INTO picture_stories (text_id, school_type, klasse, target_words, starters, hints, lines, source_kind, source_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(text.id, s.schoolType, s.klasse, s.targetWords, JSON.stringify(s.starters), s.hints, s.lines, s.sourceKind, s.sourceNote, now, now);
    const ins = conn.prepare(
      "INSERT INTO picture_story_images (text_id, position, file_name, mime, size, sha256, stored_path, caption, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    files.forEach((f, i) => ins.run(text.id, i + 1, f.name, f.mime, f.size, f.sha256, f.stored, f.caption, now));
    return text;
  })();
}

/** One place in the new order: a picture the story already has, or the n-th newly uploaded file. */
export type OrderEntry = { id: number; caption?: string } | { upload: number; caption?: string };

export type StoryChange = {
  title: string;
  subject: string;
  prompt: string;
  settings: StorySettings;
  order: OrderEntry[];
  uploads: UploadedImage[];
};

/**
 * Changes a Bildgeschichte: settings, the order of the pictures, their descriptions, new pictures and
 * pictures left out (removed). The written text is not touched.
 */
export function updatePictureStory(textId: number, c: StoryChange): void {
  const story = getPictureStory(textId);
  if (!story) throw new Error("Diese Bildgeschichte gibt es nicht.");
  if (!c.order.length) throw new Error("Bitte mindestens ein Bild behalten oder hochladen.");
  if (c.order.length > MAX_IMAGES) throw new Error(`Höchstens ${MAX_IMAGES} Bilder.`);
  const existing = new Map(storyImages(textId).map((i) => [i.id, i]));
  const seen = new Set<string>();
  for (const e of c.order) {
    const key = "id" in e ? `i${e.id}` : `u${e.upload}`;
    if (seen.has(key)) throw new Error("Ein Bild steht doppelt in der Reihenfolge.");
    seen.add(key);
    if ("id" in e && !existing.has(e.id)) throw new Error("Ein Bild gehört nicht zu dieser Bildgeschichte.");
    if ("upload" in e && !c.uploads[e.upload]) throw new Error("Ein neues Bild ist nicht angekommen. Bitte noch einmal versuchen.");
  }
  const stored = new Map<number, ReturnType<typeof storeImageFile>>();
  c.order.forEach((e) => {
    if ("upload" in e) stored.set(e.upload, storeImageFile(c.uploads[e.upload]));
  });
  const conn = db();
  const now = iso();
  const removed = [...existing.values()].filter((i) => !c.order.some((e) => "id" in e && e.id === i.id));
  conn.transaction(() => {
    conn.prepare("UPDATE texts SET title = ?, subject = ?, prompt = ?, updated_at = ? WHERE id = ?").run(c.title.trim() || "Bildgeschichte", c.subject.trim(), c.prompt.trim(), now, textId);
    const s = c.settings;
    conn
      .prepare("UPDATE picture_stories SET school_type = ?, klasse = ?, target_words = ?, starters = ?, hints = ?, lines = ?, source_kind = ?, source_note = ?, updated_at = ? WHERE text_id = ?")
      .run(s.schoolType, s.klasse, s.targetWords, JSON.stringify(s.starters), s.hints, s.lines, s.sourceKind, s.sourceNote, now, textId);
    for (const r of removed) conn.prepare("DELETE FROM picture_story_images WHERE id = ?").run(r.id);
    const move = conn.prepare("UPDATE picture_story_images SET position = ?, caption = ? WHERE id = ?");
    const ins = conn.prepare(
      "INSERT INTO picture_story_images (text_id, position, file_name, mime, size, sha256, stored_path, caption, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    c.order.forEach((e, i) => {
      if ("id" in e) move.run(i + 1, e.caption === undefined ? existing.get(e.id)!.caption : cleanCaption(e.caption), e.id);
      else {
        const f = stored.get(e.upload)!;
        ins.run(textId, i + 1, f.name, f.mime, f.size, f.sha256, f.stored, cleanCaption(e.caption), now);
      }
    });
  })();
  for (const r of removed) dropFileIfUnused(r.stored_path);
}

// ---------- the student hands in ----------

export type HandInResult = { ok: true } | { ok: false; reason: "fehlt" | "veraltet"; version?: number };

/**
 * "Abgeben" from the student's device: only when the server has exactly the version the device shows,
 * so nothing typed is left behind unsaved. Marks the text fertig; the teacher can open it again.
 */
export function handIn(textId: number, version: number): HandInResult {
  const text = getText(textId);
  if (!text) return { ok: false, reason: "fehlt" };
  if (text.version !== version) return { ok: false, reason: "veraltet", version: text.version };
  if (text.status !== "fertig") setTextStatus(text.id, "fertig");
  return { ok: true };
}

// ---------- for the KI correction ----------

/** What the KI learns about the pictures: their number and the teacher's short descriptions, nothing else. */
export function pictureContext(textId: number): { count: number; captions: string[] } | null {
  if (!getPictureStory(textId)) return null;
  const images = storyImages(textId);
  return { count: images.length, captions: images.map((i) => i.caption) };
}

/** Schulart and Klasse of the story, when the teacher set them (else the student's are used). */
export function storyLevel(textId: number): { schoolType: string; klasse: number | null } | null {
  const s = getPictureStory(textId);
  return s && s.school_type ? { schoolType: s.school_type, klasse: s.klasse } : null;
}

export const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("de-AT", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** What the writing view needs: the pictures (served under `base`/<id>), sentence starters, tips and the word target. */
export function storyForEditor(textId: number, base: string) {
  const s = getPictureStory(textId);
  if (!s) return null;
  return {
    pictures: { images: storyImages(textId).map((i) => ({ id: i.id, url: `${base}/${i.id}` })), starters: s.starters, hints: s.hints },
    targetWords: s.target_words,
  };
}
