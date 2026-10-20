/**
 * Textinterpretation as a Schreibauftrag: a Textarbeit (lib/texts.ts, Textsorte "Textinterpretation") whose
 * row in text_interpretations holds the story the teacher pasted, with its line breaks, author, year and the
 * word target. The student's interpretation is the text and uses everything a text has: autosave, versions,
 * read along, correction, print. The pure parts (line numbers, Schreibplan, Hinweise) are in
 * lib/textinterpretation.ts.
 */
import { db } from "./db";
import { createText, getText, type TextView } from "./texts";
import { BEISPIEL_QUELLE } from "./textinterpretation-beispiel";
import {
  cleanStory,
  cleanTarget,
  defaultArbeitsauftrag,
  INTERPRETATION_KIND,
  isStoryKind,
  lastLine,
  MAX_STORY_CHARS,
  MAX_STORY_LINES,
  MIN_STORY_LINES,
  numberedLines,
  type InterpretationView,
  type StoryKind,
  type TeilSource,
} from "./textinterpretation";

export type { InterpretationView };

export type InterpretationRow = {
  text_id: number;
  story_title: string;
  story_author: string;
  story_year: string;
  story_kind: string;
  story_text: string;
  count_blank: number;
  target_words: number;
  source_note: string;
  created_at: string;
  updated_at: string;
};

/** What the teacher enters; `prompt` is the Arbeitsauftrag. */
export type InterpretationSettings = {
  title: string;
  author: string;
  year: string;
  kind: StoryKind;
  story: string;
  countBlank: boolean;
  target: number;
  prompt: string;
  sourceNote: string;
};

const iso = () => new Date().toISOString();
const line = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The form values checked and cleaned, or what is missing. An empty Arbeitsauftrag gets the default one. */
export function cleanSettings(raw: Partial<Record<keyof InterpretationSettings, unknown>>): { settings: InterpretationSettings } | { error: string } {
  const title = line(raw.title, 160).replace(/^[„“"»«]+|[“”"«»]+$/g, "").trim();
  if (!title) return { error: "Bitte den Titel der Geschichte eingeben." };
  const rawStory = String(raw.story ?? "");
  if (rawStory.length > MAX_STORY_CHARS) return { error: `Der Text ist zu lang (höchstens ${MAX_STORY_CHARS.toLocaleString("de-AT")} Zeichen).` };
  const story = cleanStory(rawStory);
  if (!story) return { error: "Bitte den Text der Geschichte einfügen." };
  const countBlank = raw.countBlank === true || raw.countBlank === "1" || raw.countBlank === "on";
  const lines = lastLine(numberedLines(story, countBlank));
  if (lines < MIN_STORY_LINES) return { error: `Der Text hat nur ${lines} ${lines === 1 ? "Zeile" : "Zeilen"}. Füge ihn mit seinen Zeilenumbrüchen ein, so wie er auf dem Blatt steht.` };
  if (lines > MAX_STORY_LINES) return { error: `Der Text hat ${lines} Zeilen, höchstens ${MAX_STORY_LINES} gehen.` };
  const kind = isStoryKind(raw.kind) ? raw.kind : "Kurzgeschichte";
  const author = line(raw.author, 120);
  const year = line(raw.year, 20);
  const target = cleanTarget(raw.target);
  const prompt = String(raw.prompt ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 4000) || defaultArbeitsauftrag({ title, author, year, kind, target });
  return { settings: { title, author, year, kind, story, countBlank, target, prompt, sourceNote: line(raw.sourceNote, 400) } };
}

/** The title of the student's text: "Textinterpretation zu „Sieben Uhr zwölf“". */
export const interpretationTitle = (storyTitle: string) => `Textinterpretation zu „${storyTitle}“`.slice(0, 140);

export function getInterpretation(textId: number): InterpretationRow | null {
  return (db().prepare("SELECT * FROM text_interpretations WHERE text_id = ?").get(textId) as InterpretationRow | undefined) ?? null;
}

const viewOf = (r: InterpretationRow): InterpretationView => ({
  title: r.story_title,
  author: r.story_author,
  year: r.story_year,
  kind: isStoryKind(r.story_kind) ? r.story_kind : "Kurzgeschichte",
  text: r.story_text,
  countBlank: r.count_blank === 1,
  target: r.target_words,
});

/** The story of a Textinterpretation for the writing view and the print, or null for any other text. */
export function interpretationFor(textId: number): InterpretationView | null {
  const r = getInterpretation(textId);
  return r ? viewOf(r) : null;
}

/** Which of these texts are Textinterpretationen (for lists). */
export function interpretationIds(textIds: number[]): Set<number> {
  if (!textIds.length) return new Set();
  const rows = db().prepare(`SELECT text_id FROM text_interpretations WHERE text_id IN (${textIds.map(() => "?").join(",")})`).all(...textIds) as { text_id: number }[];
  return new Set(rows.map((r) => r.text_id));
}

export type NewInterpretation = { studentId: number; teacherId: number | null; unitId: number | null; subject?: string; settings: InterpretationSettings };

/** A new Schreibauftrag: the text (Textsorte "Textinterpretation", the Arbeitsauftrag as its task) and the story. */
export function createInterpretation(n: NewInterpretation): TextView {
  const s = n.settings;
  const conn = db();
  const now = iso();
  return conn.transaction(() => {
    const text = createText({ studentId: n.studentId, teacherId: n.teacherId, unitId: n.unitId, subject: n.subject ?? "Deutsch", topic: INTERPRETATION_KIND, title: interpretationTitle(s.title), prompt: s.prompt });
    conn
      .prepare(
        `INSERT INTO text_interpretations (text_id, story_title, story_author, story_year, story_kind, story_text, count_blank, target_words, source_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(text.id, s.title, s.author, s.year, s.kind, s.story, s.countBlank ? 1 : 0, s.target, s.sourceNote, now, now);
    return text;
  })();
}

/** Changes story, Arbeitsauftrag and target. The written interpretation is not touched. */
export function updateInterpretation(textId: number, s: InterpretationSettings): void {
  if (!getInterpretation(textId)) throw new Error("Diese Textinterpretation gibt es nicht.");
  const conn = db();
  const now = iso();
  conn.transaction(() => {
    conn.prepare("UPDATE texts SET title = ?, prompt = ?, updated_at = ? WHERE id = ?").run(interpretationTitle(s.title), s.prompt, now, textId);
    conn
      .prepare("UPDATE text_interpretations SET story_title = ?, story_author = ?, story_year = ?, story_kind = ?, story_text = ?, count_blank = ?, target_words = ?, source_note = ?, updated_at = ? WHERE text_id = ?")
      .run(s.title, s.author, s.year, s.kind, s.story, s.countBlank ? 1 : 0, s.target, s.sourceNote, now, textId);
  })();
}

/** The settings of an existing Textinterpretation, for the form that changes them. */
export function settingsOf(textId: number): (InterpretationSettings & { textId: number; studentId: number }) | null {
  const r = getInterpretation(textId);
  const text = getText(textId);
  if (!r || !text) return null;
  const v = viewOf(r);
  return { textId, studentId: text.student_id, title: v.title, author: v.author, year: v.year, kind: v.kind, story: v.text, countBlank: v.countBlank, target: v.target, prompt: text.prompt, sourceNote: r.source_note };
}

/** The story of a Textinterpretation as source for Teilübungen. */
export function teilSourceOf(textId: number): TeilSource | null {
  const v = interpretationFor(textId);
  return v ? { title: v.title, author: v.author, year: v.year, kind: v.kind, text: v.text, countBlank: v.countBlank } : null;
}

/**
 * The story Teilübungen of the builder are about: the student's latest Textinterpretation, else the
 * Lernheft's own example story (with model answers).
 */
export function teilSourceForStudent(studentId: number | null): TeilSource {
  if (studentId) {
    const r = db()
      .prepare("SELECT i.text_id FROM text_interpretations i JOIN texts t ON t.id = i.text_id WHERE t.student_id = ? ORDER BY i.updated_at DESC, i.text_id DESC LIMIT 1")
      .get(studentId) as { text_id: number } | undefined;
    const own = r ? teilSourceOf(r.text_id) : null;
    if (own) return own;
  }
  return BEISPIEL_QUELLE;
}

/** What the KI correction learns about the story: title, author, kind and length, never the story itself. */
export function interpretationContext(textId: number): { title: string; author: string; year: string; kind: string; lines: number } | null {
  const v = interpretationFor(textId);
  return v ? { title: v.title, author: v.author, year: v.year, kind: v.kind, lines: lastLine(numberedLines(v.text, v.countBlank)) } : null;
}
