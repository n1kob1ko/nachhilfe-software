"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { documentAssignment } from "@/lib/autodoc";
import { endCurrentMaterial, getMaterial, setCurrentMaterial, updateCurrentMaterial, type MaterialSource } from "@/lib/current-material";
import { isErrorType } from "@/lib/error-types";
import { addPrerequisite, removePrerequisite } from "@/lib/lehrplan";
import * as repo from "@/lib/repo";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- Aktueller Stoff ----------
function materialFields(f: FormData) {
  return {
    topic: str(f, "topic"),
    subtopic: str(f, "subtopic"),
    skill_ids: f.getAll("skill_ids").map(String).filter(Boolean),
    since: str(f, "since"),
    priority: Number(f.get("priority")) || 2,
    note: str(f, "note"),
    source: (str(f, "source") || "unterricht") as MaterialSource,
  };
}
export type MaterialState = { error: string } | null;

/** New current material for a subject (the active one of that subject moves to the history). */
export async function saveMaterialAction(_: MaterialState, f: FormData): Promise<MaterialState> {
  const teacher = await requireTeacher();
  const studentId = Number(f.get("student_id"));
  const id = Number(f.get("id")) || null;
  if (!repo.getStudent(studentId)) return { error: "Schüler nicht gefunden." };
  try {
    if (id) updateCurrentMaterial(id, materialFields(f));
    else setCurrentMaterial({ student_id: studentId, subject: str(f, "subject"), ...materialFields(f) }, teacher.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=stoff`);
}
export async function endMaterialAction(id: number) {
  await requireTeacher();
  const m = getMaterial(id);
  if (!m) return;
  endCurrentMaterial(id);
  revalidatePath("/", "layout");
  redirect(`/schueler/${m.student_id}?tab=stoff`);
}

// ---------- Fehlerarten ----------
/** The teacher sets or confirms the Fehlerart of one wrong answer ('' clears it). */
export async function setErrorTypeAction(attemptId: number, type: string) {
  const teacher = await requireTeacher();
  const attempt = repo.getAttempt(attemptId);
  if (!attempt || attempt.correct) return { error: "Antwort nicht gefunden." };
  if (type && !isErrorType(type)) return { error: "Unbekannte Fehlerart." };
  repo.setAttemptErrorType(attemptId, type || null, teacher.id);
  // the automatic Dokumentation of self-practice names the Fehlerarten and scores careless errors milder
  documentAssignment(attempt.assignment_id);
  revalidatePath(`/schueler/${attempt.student_id}`, "layout");
  return { ok: true as const };
}

// ---------- Voraussetzungen ----------
export async function addPrerequisiteAction(skillId: string, f: FormData) {
  const teacher = await requireTeacher();
  const before = str(f, "before");
  const res = addPrerequisite(skillId, before, teacher.id);
  revalidatePath("/faehigkeiten", "layout");
  redirect(`/faehigkeiten/${encodeURIComponent(skillId)}${"error" in res ? `?fehler=${encodeURIComponent(res.error)}` : ""}`);
}
export async function removePrerequisiteAction(skillId: string, before: string) {
  const teacher = await requireTeacher();
  removePrerequisite(skillId, before, teacher.id);
  revalidatePath("/faehigkeiten", "layout");
  redirect(`/faehigkeiten/${encodeURIComponent(skillId)}`);
}
