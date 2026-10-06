"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/builder-actions";
import { requireTeacher } from "@/lib/auth";
import { blankTask } from "@/lib/builder";
import { DIFFICULTIES, TASK_TYPES, type Difficulty, type TaskType } from "@/lib/curriculum";
import {
  cleanTags,
  createLibraryTask,
  deleteLibraryEntry,
  duplicateLibraryEntry,
  exerciseFromLibrary,
  saveToLibrary,
  setLibraryOrigin,
  updateLibraryEntry,
  type SettableOrigin,
} from "@/lib/library";
import * as repo from "@/lib/repo";
import { schoolType } from "@/lib/school";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const LIB = "/uebungen/bibliothek";

/** "In Bibliothek": a copy of the task goes into the library; the exercise stays unchanged. */
export async function saveToLibraryAction(taskId: number): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const out = saveToLibrary(taskId, { teacherId: teacher.id });
  if ("error" in out) return { error: out.error };
  revalidatePath(LIB);
  return { ok: out.existing ? "Diese Aufgabe ist schon in der Bibliothek." : "In der Bibliothek gespeichert.", link: { href: `${LIB}/${out.id}`, label: "Ansehen" } };
}

/** A new task written directly for the library: created blank, then opened in the task editor. */
export async function createLibraryTaskAction(f: FormData) {
  const teacher = await requireTeacher();
  const skill = repo.getSkill(str(f, "skill_id"));
  const subject = skill?.subject ?? str(f, "subject");
  if (!subject) redirect(`${LIB}?neu=1&fehler=${encodeURIComponent("Bitte Fach oder Fähigkeit wählen.")}`);
  const format = (str(f, "format") || "calc") as TaskType;
  const difficulty = ((DIFFICULTIES as readonly string[]).includes(str(f, "difficulty")) ? str(f, "difficulty") : "mittel") as Difficulty;
  const type = schoolType(str(f, "school_type"))?.name ?? "";
  const klasse = type ? Number(f.get("klasse")) || null : null;
  const id = createLibraryTask(
    { subject, schoolType: type, klasse, topic: skill?.area ?? "", tags: cleanTags(str(f, "tags")), teacherId: teacher.id },
    blankTask(format in TASK_TYPES && format !== ("mixed" as TaskType) ? format : "calc", skill?.id ?? null, null, difficulty),
  );
  revalidatePath(LIB);
  redirect(`${LIB}/${id}?bearbeiten=1`);
}

export async function updateLibraryEntryAction(id: number, f: FormData) {
  await requireTeacher();
  const type = schoolType(str(f, "school_type"))?.name ?? "";
  const ok = updateLibraryEntry(id, { title: str(f, "title"), schoolType: type, klasse: type ? Number(f.get("klasse")) || null : null, topic: str(f, "topic"), tags: cleanTags(str(f, "tags")) });
  revalidatePath(LIB, "layout");
  redirect(ok ? `${LIB}/${id}?gespeichert=1` : LIB);
}

/** Herkunft and Quelle, set by the teacher; the licence rule decides what is stored (see setLibraryOrigin). */
export async function setLibraryOriginAction(id: number, f: FormData) {
  await requireTeacher();
  const out = setLibraryOrigin(id, { origin: str(f, "origin") as SettableOrigin, sourceId: Number(f.get("source_id")) || null, ownWords: f.get("eigene_worte") === "1" });
  revalidatePath(LIB, "layout");
  redirect(`${LIB}/${id}?${"error" in out ? `fehler=${encodeURIComponent(out.error)}` : "gespeichert=herkunft"}#herkunft`);
}

export async function duplicateLibraryEntryAction(id: number) {
  const teacher = await requireTeacher();
  const copy = duplicateLibraryEntry(id, teacher.id);
  revalidatePath(LIB, "layout");
  redirect(copy ? `${LIB}/${copy}?kopie=1` : LIB);
}

export async function deleteLibraryEntryAction(id: number) {
  await requireTeacher();
  deleteLibraryEntry(id);
  revalidatePath(LIB, "layout");
  redirect(`${LIB}?geloescht=1`);
}

/** Selected library tasks become a new draft exercise (optionally for a student), which opens for checking and sending. */
export async function exerciseFromLibraryAction(f: FormData) {
  const teacher = await requireTeacher();
  const ids = f.getAll("eintrag").map(Number).filter(Boolean);
  const studentId = Number(f.get("student_id")) || null;
  const out = exerciseFromLibrary(ids, { studentId, teacherId: teacher.id });
  const back = str(f, "back") || LIB;
  if ("error" in out) redirect(`${back}${back.includes("?") ? "&" : "?"}fehler=${encodeURIComponent(out.error)}`);
  revalidatePath("/uebungen");
  redirect(`/uebungen/${out.id}${out.skipped ? `?hinweis=fach&ausgelassen=${out.skipped}` : ""}`);
}
