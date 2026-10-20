/**
 * Textinterpretation as a Schreibauftrag: a Textarbeit (lib/texts.ts, Textsorte "Textinterpretation") whose
 * row in text_interpretations holds the story the teacher pasted, with its line breaks, author, year and the
 * word target. The student's interpretation is the text and uses everything a text has: autosave, versions,
 * read along, correction, print. The pure parts (line numbers, Schreibplan, Hinweise) are in
 * lib/textinterpretation.ts.
 *
 * Since the other Textsorten of the SRDP came, the rows are written by lib/schreibauftrag-store.ts; the functions
 * here only see rows of the Textinterpretation (sorte 'textinterpretation'), so the KI correction learns about the
 * story of a Textinterpretation and of nothing else.
 */
import { db } from "./db";
import type { SorteKey } from "./schreibauftrag";
import { auftragSettingsOf, cleanAuftragSettings, createAuftrag, getAuftrag, quelleOf, updateAuftrag, type AuftragRow, type AuftragSettings } from "./schreibauftrag-store";
import type { TextView } from "./texts";
import { BEISPIEL_QUELLE } from "./textinterpretation-beispiel";
import { isStoryKind, lastLine, numberedLines, type InterpretationView, type StoryKind, type TeilSource } from "./textinterpretation";

export type { InterpretationView };

export type InterpretationRow = Omit<AuftragRow, "sorte" | "story_medium" | "situation">;

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

const SORTE: SorteKey = "textinterpretation";
const kindOf = (k: string): StoryKind => (isStoryKind(k) ? k : "Kurzgeschichte");

/** The form values checked and cleaned, or what is missing. An empty Arbeitsauftrag gets the default one. */
export function cleanSettings(raw: Partial<Record<keyof InterpretationSettings, unknown>>): { settings: InterpretationSettings } | { error: string } {
  const out = cleanAuftragSettings(SORTE, raw);
  if ("error" in out) return out;
  const s = out.settings;
  return { settings: { title: s.title, author: s.author, year: s.year, kind: kindOf(s.kind), story: s.story, countBlank: s.countBlank, target: s.target, prompt: s.prompt, sourceNote: s.sourceNote } };
}

const asAuftrag = (s: InterpretationSettings): AuftragSettings => ({ ...s, sorte: SORTE, medium: "", situation: "" });

/** The title of the student's text: "Textinterpretation zu „Sieben Uhr zwölf“". */
export const interpretationTitle = (storyTitle: string) => `Textinterpretation zu „${storyTitle}“`.slice(0, 140);

/** The row of a Textinterpretation, or null for any other text (another Schreibauftrag too). */
export function getInterpretation(textId: number): InterpretationRow | null {
  const r = getAuftrag(textId);
  return r && r.sorte === SORTE ? r : null;
}

const viewOf = (r: InterpretationRow): InterpretationView => ({
  title: r.story_title,
  author: r.story_author,
  year: r.story_year,
  kind: kindOf(r.story_kind),
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
  const rows = db()
    .prepare(`SELECT text_id FROM text_interpretations WHERE sorte = ? AND text_id IN (${textIds.map(() => "?").join(",")})`)
    .all(SORTE, ...textIds) as { text_id: number }[];
  return new Set(rows.map((r) => r.text_id));
}

export type NewInterpretation = { studentId: number; teacherId: number | null; unitId: number | null; subject?: string; settings: InterpretationSettings };

/** A new Schreibauftrag: the text (Textsorte "Textinterpretation", the Arbeitsauftrag as its task) and the story. */
export function createInterpretation(n: NewInterpretation): TextView {
  return createAuftrag({ ...n, settings: asAuftrag(n.settings) });
}

/** Changes story, Arbeitsauftrag and target. The written interpretation is not touched. */
export function updateInterpretation(textId: number, s: InterpretationSettings): void {
  if (!getInterpretation(textId)) throw new Error("Diese Textinterpretation gibt es nicht.");
  updateAuftrag(textId, asAuftrag(s));
}

/** The settings of an existing Textinterpretation, for the form that changes them. */
export function settingsOf(textId: number): (InterpretationSettings & { textId: number; studentId: number }) | null {
  const s = getInterpretation(textId) ? auftragSettingsOf(textId) : null;
  if (!s) return null;
  return { textId, studentId: s.studentId, title: s.title, author: s.author, year: s.year, kind: kindOf(s.kind), story: s.story, countBlank: s.countBlank, target: s.target, prompt: s.prompt, sourceNote: s.sourceNote };
}

/** The story of a Textinterpretation as source for Teilübungen. */
export function teilSourceOf(textId: number): TeilSource | null {
  const q = getInterpretation(textId) ? quelleOf(textId) : null;
  return q ? { title: q.title, author: q.author, year: q.year, kind: kindOf(q.kind), text: q.text, countBlank: q.countBlank } : null;
}

/**
 * The story Teilübungen of the builder are about: the student's latest Textinterpretation, else the
 * Lernheft's own example story (with model answers).
 */
export function teilSourceForStudent(studentId: number | null): TeilSource {
  if (studentId) {
    const r = db()
      .prepare("SELECT i.text_id FROM text_interpretations i JOIN texts t ON t.id = i.text_id WHERE t.student_id = ? AND i.sorte = ? ORDER BY i.updated_at DESC, i.text_id DESC LIMIT 1")
      .get(studentId, SORTE) as { text_id: number } | undefined;
    const own = r ? teilSourceOf(r.text_id) : null;
    if (own) return own;
  }
  return BEISPIEL_QUELLE;
}

/** What the KI correction learns about the story: title, author, kind and length, never the story itself. Only for a Textinterpretation. */
export function interpretationContext(textId: number): { title: string; author: string; year: string; kind: string; lines: number } | null {
  const v = interpretationFor(textId);
  return v ? { title: v.title, author: v.author, year: v.year, kind: v.kind, lines: lastLine(numberedLines(v.text, v.countBlank)) } : null;
}
