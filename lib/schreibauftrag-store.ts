/**
 * Schreibaufträge (lib/schreibauftrag.ts): a Textarbeit (lib/texts.ts, Textsorte as its topic) whose row in
 * text_interpretations holds the Textbeilage the teacher pasted, with its line breaks, author, medium and date,
 * the Schreibsituation and the word target. The table has its name from the Textinterpretation, the first
 * Schreibauftrag; `sorte` says which Textsorte a row is. The student's text is the text and uses everything a text
 * has: autosave, versions, read along, correction, print.
 *
 * lib/textinterpretation-store.ts keeps its own functions for the Textinterpretation on top of these.
 */
import { db } from "./db";
import { createText, getText, type TextView } from "./texts";
import {
  arbeitsauftrag,
  auftragTitle,
  beispielQuelle,
  cleanSituation,
  isKindOf,
  isSorte,
  SORTEN,
  type AuftragQuelle,
  type AuftragView,
  type SorteKey,
} from "./schreibauftrag";
import { cleanStory, cleanTarget, lastLine, MAX_STORY_CHARS, MAX_STORY_LINES, MIN_STORY_LINES, numberedLines } from "./textinterpretation";

export type AuftragRow = {
  text_id: number;
  sorte: string;
  story_title: string;
  story_author: string;
  story_year: string;
  story_medium: string;
  story_kind: string;
  story_text: string;
  count_blank: number;
  target_words: number;
  situation: string;
  source_note: string;
  created_at: string;
  updated_at: string;
};

/** What the teacher enters; `prompt` is the Arbeitsauftrag, `story` the Textbeilage. */
export type AuftragSettings = {
  sorte: SorteKey;
  title: string;
  author: string;
  year: string;
  medium: string;
  kind: string;
  story: string;
  countBlank: boolean;
  target: number;
  situation: string;
  prompt: string;
  sourceNote: string;
};

const iso = () => new Date().toISOString();
const line = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The form values checked and cleaned, or what is missing. An empty Arbeitsauftrag gets the default one. */
export function cleanAuftragSettings(sorte: SorteKey, raw: Partial<Record<keyof AuftragSettings, unknown>>): { settings: AuftragSettings } | { error: string } {
  const s = SORTEN[sorte];
  const was = s.beilage === "Geschichte" ? "der Geschichte" : "der Textbeilage";
  const title = line(raw.title, 160).replace(/^[„“"»«]+|[“”"«»]+$/g, "").trim();
  if (!title) return { error: `Bitte den Titel ${was} eingeben.` };
  const rawStory = String(raw.story ?? "");
  if (rawStory.length > MAX_STORY_CHARS) return { error: `Der Text ist zu lang (höchstens ${MAX_STORY_CHARS.toLocaleString("de-AT")} Zeichen).` };
  const story = cleanStory(rawStory);
  if (!story) return { error: `Bitte den Text ${was} einfügen.` };
  const countBlank = raw.countBlank === true || raw.countBlank === "1" || raw.countBlank === "on";
  const lines = lastLine(numberedLines(story, countBlank));
  if (lines < MIN_STORY_LINES) {
    const web = sorte === "textinterpretation" ? "" : " Kommt er von einer Webseite, teil ihn mit „Zeilen umbrechen“ in Zeilen.";
    return { error: `Der Text hat nur ${lines} ${lines === 1 ? "Zeile" : "Zeilen"}. Füge ihn mit seinen Zeilenumbrüchen ein, so wie er auf dem Blatt steht.${web}` };
  }
  if (lines > MAX_STORY_LINES) return { error: `Der Text hat ${lines} Zeilen, höchstens ${MAX_STORY_LINES} gehen.` };
  const kind = isKindOf(sorte, raw.kind) ? String(raw.kind) : s.defaultKind;
  const author = line(raw.author, 120);
  const year = line(raw.year, 40);
  const medium = sorte === "textinterpretation" ? "" : line(raw.medium, 120);
  const situation = s.situation ? cleanSituation(raw.situation) : "";
  const target = cleanTarget(raw.target, s.target);
  const prompt = String(raw.prompt ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 4000) || arbeitsauftrag({ sorte, title, author, year, medium, kind, target, situation });
  return { settings: { sorte, title, author, year, medium, kind, story, countBlank, target, situation, prompt, sourceNote: line(raw.sourceNote, 400) } };
}

export function getAuftrag(textId: number): AuftragRow | null {
  return (db().prepare("SELECT * FROM text_interpretations WHERE text_id = ?").get(textId) as AuftragRow | undefined) ?? null;
}

const sorteOf = (r: Pick<AuftragRow, "sorte">): SorteKey => (isSorte(r.sorte) ? r.sorte : "textinterpretation");

export const auftragView = (r: AuftragRow): AuftragView => {
  const sorte = sorteOf(r);
  return {
    sorte,
    title: r.story_title,
    author: r.story_author,
    year: r.story_year,
    medium: r.story_medium,
    kind: isKindOf(sorte, r.story_kind) ? r.story_kind : SORTEN[sorte].defaultKind,
    text: r.story_text,
    countBlank: r.count_blank === 1,
    target: cleanTarget(r.target_words, SORTEN[sorte].target),
    situation: r.situation,
  };
};

/** The Schreibauftrag of a text for the writing view, the print and the hints, or null for any other text. */
export function auftragFor(textId: number): AuftragView | null {
  const r = getAuftrag(textId);
  return r ? auftragView(r) : null;
}

/** Which of these texts are Schreibaufträge, with their Textsorte (for lists). */
export function auftragIds(textIds: number[]): Map<number, SorteKey> {
  if (!textIds.length) return new Map();
  const rows = db().prepare(`SELECT text_id, sorte FROM text_interpretations WHERE text_id IN (${textIds.map(() => "?").join(",")})`).all(...textIds) as Pick<AuftragRow, "text_id" | "sorte">[];
  return new Map(rows.map((r) => [r.text_id, sorteOf(r)]));
}

export type NewAuftrag = { studentId: number; teacherId: number | null; unitId: number | null; subject?: string; settings: AuftragSettings };

/** A new Schreibauftrag: the text (the Textsorte as its topic, the Arbeitsauftrag as its task) and the Textbeilage. */
export function createAuftrag(n: NewAuftrag): TextView {
  const s = n.settings;
  const conn = db();
  const now = iso();
  return conn.transaction(() => {
    const text = createText({ studentId: n.studentId, teacherId: n.teacherId, unitId: n.unitId, subject: n.subject ?? "Deutsch", topic: SORTEN[s.sorte].name, title: auftragTitle(s.sorte, s.title), prompt: s.prompt });
    conn
      .prepare(
        `INSERT INTO text_interpretations (text_id, sorte, story_title, story_author, story_year, story_medium, story_kind, story_text, count_blank, target_words, situation, source_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(text.id, s.sorte, s.title, s.author, s.year, s.medium, s.kind, s.story, s.countBlank ? 1 : 0, s.target, s.situation, s.sourceNote, now, now);
    return text;
  })();
}

/** Changes Textbeilage, Arbeitsauftrag, Schreibsituation and target. The Textsorte and the written text stay. */
export function updateAuftrag(textId: number, s: AuftragSettings): void {
  const r = getAuftrag(textId);
  if (!r || sorteOf(r) !== s.sorte) throw new Error("Diesen Schreibauftrag gibt es nicht.");
  const conn = db();
  const now = iso();
  conn.transaction(() => {
    conn.prepare("UPDATE texts SET title = ?, prompt = ?, updated_at = ? WHERE id = ?").run(auftragTitle(s.sorte, s.title), s.prompt, now, textId);
    conn
      .prepare(
        "UPDATE text_interpretations SET story_title = ?, story_author = ?, story_year = ?, story_medium = ?, story_kind = ?, story_text = ?, count_blank = ?, target_words = ?, situation = ?, source_note = ?, updated_at = ? WHERE text_id = ?",
      )
      .run(s.title, s.author, s.year, s.medium, s.kind, s.story, s.countBlank ? 1 : 0, s.target, s.situation, s.sourceNote, now, textId);
  })();
}

/** The settings of an existing Schreibauftrag, for the form that changes them. */
export function auftragSettingsOf(textId: number): (AuftragSettings & { textId: number; studentId: number }) | null {
  const r = getAuftrag(textId);
  const text = getText(textId);
  if (!r || !text) return null;
  const v = auftragView(r);
  return { textId, studentId: text.student_id, sorte: v.sorte, title: v.title, author: v.author, year: v.year, medium: v.medium, kind: v.kind, story: v.text, countBlank: v.countBlank, target: v.target, situation: v.situation, prompt: text.prompt, sourceNote: r.source_note };
}

/** The Textbeilage of a Schreibauftrag as source of Teilübungen. */
export function quelleOf(textId: number): AuftragQuelle | null {
  const v = auftragFor(textId);
  return v ? { sorte: v.sorte, title: v.title, author: v.author, year: v.year, medium: v.medium, kind: v.kind, text: v.text, countBlank: v.countBlank } : null;
}

/**
 * The Textbeilage Teilübungen of the builder are about: the student's latest Schreibauftrag of this Textsorte,
 * else the Lernheft's own example (with the model text as sample answers).
 */
export function quelleForStudent(studentId: number | null, sorte: SorteKey): AuftragQuelle {
  if (studentId) {
    const r = db()
      .prepare("SELECT i.text_id FROM text_interpretations i JOIN texts t ON t.id = i.text_id WHERE t.student_id = ? AND i.sorte = ? AND t.archived_at IS NULL ORDER BY i.updated_at DESC, i.text_id DESC LIMIT 1")
      .get(studentId, sorte) as { text_id: number } | undefined;
    const own = r ? quelleOf(r.text_id) : null;
    if (own) return own;
  }
  return beispielQuelle(sorte);
}
