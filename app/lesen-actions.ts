"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createReadingDraft, readingBlankQuestion, readingSettingsFromForm, saveReadingText } from "@/lib/lesen-draft";
import { isAspect } from "@/lib/lesen";
import * as repo from "@/lib/repo";
import type { ActionResult } from "./builder-actions";

/** "Leseverständnis erstellen": text (own or by the KI) and questions, then the draft's preview. */
export async function createReadingDraftAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const s = readingSettingsFromForm(form);
  let out: Awaited<ReturnType<typeof createReadingDraft>>;
  try {
    out = await createReadingDraft(s, teacher.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Die Übung konnte nicht erstellt werden." };
  }
  if (!out.id) return { error: out.error ?? "Die Übung konnte nicht erstellt werden." };
  revalidatePath("/uebungen");
  redirect(`/uebungen/${out.id}${out.warning === "ki" ? "?hinweis=lesenki" : out.warning === "weniger" ? `?hinweis=lesenweniger&anzahl=${out.got}` : ""}`);
}

const locked = (worksheetId: number) =>
  repo.worksheetAttemptCount(worksheetId) > 0 ? "Diese Übung wurde schon bearbeitet. Mit „Anpassen“ entsteht eine Kopie, die du ändern kannst." : null;

/** The text of a reading exercise, changed once for every question. */
export async function saveReadingTextAction(worksheetId: number, title: string, text: string): Promise<ActionResult> {
  await requireTeacher();
  const no = locked(worksheetId);
  if (no) return { error: no };
  const out = saveReadingText(worksheetId, { title: String(title).slice(0, 160), text: String(text).slice(0, 30_000) });
  if (out.error) return { error: out.error };
  revalidatePath(`/uebungen/${worksheetId}`);
  return { ok: "Text gespeichert. Alle Fragen verwenden ihn." };
}

/** A new question about the text, of the kind chosen. */
export async function addReadingQuestionAction(worksheetId: number, aspect: string, format: string, afterTaskId?: number): Promise<ActionResult & { id?: number }> {
  await requireTeacher();
  const no = locked(worksheetId);
  if (no) return { error: no };
  if (!isAspect(aspect)) return { error: "Unbekannte Frageart." };
  const draft = readingBlankQuestion(worksheetId, aspect, format === "cloze" ? "cloze" : format === "reading" ? "reading" : "free");
  if (!draft) return { error: "Diese Übung hat keinen gemeinsamen Lesetext." };
  const id = repo.addTask(worksheetId, draft, afterTaskId);
  revalidatePath(`/uebungen/${worksheetId}`);
  return { ok: "Neue Frage angelegt.", id };
}
