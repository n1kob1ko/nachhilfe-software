"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiEnabled, analyzeWithAI } from "@/lib/ai";
import { RECOMMENDATION_NOTE, pct } from "@/lib/analysis";
import type { Difficulty, TaskType } from "@/lib/curriculum";
import { hasData, seedDemo } from "@/lib/demo";
import * as repo from "@/lib/repo";
import { klassenLabel, schoolType, schulstufe } from "@/lib/school";
import { analyzeStudent, buildWorksheet, submitAnswer, type SubmitInput } from "@/lib/service";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const v = Number(f.get(k));
  return Number.isFinite(v) ? Math.round(v) : 0;
};

export async function loadDemoData() {
  if (!hasData()) seedDemo();
  revalidatePath("/", "layout");
}

// ---------- students ----------
export async function saveStudentAction(formData: FormData) {
  const id = int(formData, "id");
  const schoolTypeName = str(formData, "school_type");
  const klasse = Math.min(schoolType(schoolTypeName)?.classes ?? 13, Math.max(1, int(formData, "klasse") || 1));
  const data: repo.StudentInput = {
    name: str(formData, "name"),
    grade: schulstufe(schoolTypeName, klasse),
    klasse,
    teacher_id: int(formData, "teacher_id") || null,
    school: str(formData, "school"),
    school_type: schoolTypeName,
    subjects: formData.getAll("subjects").map(String).filter(Boolean),
    current_topics: str(formData, "current_topics"),
    strengths_note: str(formData, "strengths_note"),
    weaknesses_note: str(formData, "weaknesses_note"),
    goals: str(formData, "goals"),
    notes: str(formData, "notes"),
  };
  const extra = str(formData, "subject_other");
  if (extra) data.subjects.push(...extra.split(",").map((s) => s.trim()).filter(Boolean));
  if (!data.name) throw new Error("Name fehlt");
  let sid = id;
  if (id) repo.updateStudent(id, data);
  else sid = repo.createStudent(data);
  revalidatePath("/", "layout");
  redirect(`/schueler/${sid}`);
}

export async function deleteStudentAction(id: number) {
  repo.deleteStudent(id);
  revalidatePath("/", "layout");
  redirect("/schueler");
}

// ---------- lessons ----------
export async function saveLessonAction(formData: FormData) {
  const id = int(formData, "id");
  const studentId = int(formData, "student_id");
  const understanding = int(formData, "understanding");
  const lesson: repo.LessonInput = {
    student_id: studentId,
    teacher_id: int(formData, "teacher_id") || null,
    starts_at: str(formData, "starts_at"),
    duration_min: int(formData, "duration_min") || 60,
    subject: str(formData, "subject"),
    topic: str(formData, "topic"),
    status: (str(formData, "status") as repo.Lesson["status"]) || "geplant",
    activities: str(formData, "activities"),
    mistakes: str(formData, "mistakes"),
    understanding: understanding >= 1 && understanding <= 5 ? understanding : null,
    tutor_notes: str(formData, "tutor_notes"),
    next_steps: str(formData, "next_steps"),
    skill_ids: formData.getAll("skill_ids").map(String),
  };
  repo.saveLesson(lesson, id || undefined);
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=stunden`);
}

export async function deleteLessonAction(id: number, studentId: number) {
  repo.deleteLesson(id);
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=stunden`);
}

// ---------- homework & tests ----------
export async function addHomeworkAction(formData: FormData) {
  const studentId = int(formData, "student_id");
  repo.addHomework({
    student_id: studentId,
    subject: str(formData, "subject"),
    description: str(formData, "description"),
    due_date: str(formData, "due_date") || null,
    status: "offen",
    notes: "",
  });
  revalidatePath(`/schueler/${studentId}`);
}
export async function setHomeworkStatusAction(id: number, studentId: number, status: string) {
  repo.setHomeworkStatus(id, status);
  revalidatePath(`/schueler/${studentId}`);
  revalidatePath("/");
}
export async function deleteHomeworkAction(id: number, studentId: number) {
  repo.deleteHomework(id);
  revalidatePath(`/schueler/${studentId}`);
}
export async function addTestAction(formData: FormData) {
  const studentId = int(formData, "student_id");
  const num = (k: string) => (str(formData, k) === "" ? null : Number(str(formData, k).replace(",", ".")));
  repo.addTest({
    student_id: studentId,
    date: str(formData, "date"),
    subject: str(formData, "subject"),
    kind: str(formData, "kind") || "Schularbeit",
    topic: str(formData, "topic"),
    grade: num("grade"),
    points: num("points"),
    max_points: num("max_points"),
    notes: str(formData, "notes"),
    skill_ids: formData.getAll("skill_ids").map(String),
  });
  revalidatePath(`/schueler/${studentId}`);
}
export async function deleteTestAction(id: number, studentId: number) {
  repo.deleteTest(id);
  revalidatePath(`/schueler/${studentId}`);
}

// ---------- worksheets ----------
export type BuildState = { error?: string } | null;

export async function buildWorksheetAction(_prev: BuildState, formData: FormData): Promise<BuildState> {
  const studentId = int(formData, "student_id");
  let result: Awaited<ReturnType<typeof buildWorksheet>>;
  try {
    result = await buildWorksheet({
      subject: str(formData, "subject"),
      schoolType: str(formData, "school_type") || "Mittelschule",
      klasse: int(formData, "klasse") || 1,
      skillIds: formData.getAll("skill_ids").map(String),
      difficulty: str(formData, "difficulty") as Difficulty,
      count: int(formData, "count") || 8,
      taskType: str(formData, "task_type") as TaskType | "mixed",
      title: str(formData, "title"),
      focusNote: str(formData, "focus"),
      useAI: formData.get("use_ai") === "on",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Die Übung konnte nicht erstellt werden." };
  }
  if (studentId) repo.assignWorksheet(result.id, studentId);
  revalidatePath("/", "layout");
  redirect(`/uebungen/${result.id}${result.aiError ? "?hinweis=ki" : ""}`);
}

export async function assignWorksheetAction(formData: FormData) {
  const worksheetId = int(formData, "worksheet_id");
  const studentId = int(formData, "student_id");
  if (studentId) repo.assignWorksheet(worksheetId, studentId);
  revalidatePath("/", "layout");
}

export async function deleteWorksheetAction(id: number) {
  repo.deleteWorksheet(id);
  revalidatePath("/", "layout");
  redirect("/uebungen");
}

export async function deleteAssignmentAction(id: number, studentId: number) {
  repo.deleteAssignment(id);
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=uebungen`);
}

/** Turns a recommendation into a worksheet and assigns it right away. */
export async function applyRecommendationAction(studentId: number, key: string) {
  const student = repo.getStudent(studentId);
  const rec = analyzeStudent(studentId)?.recommendations.find((r) => r.key === key);
  if (!student || !rec) redirect(`/schueler/${studentId}?tab=analyse`);
  const kind = rec.kind === "ueberpruefung" ? "ueberpruefung" : "uebung";
  const result = await buildWorksheet({
    subject: rec.skill.subject,
    schoolType: student.school_type,
    klasse: student.klasse ?? 1,
    skillIds: [rec.skill.id],
    difficulty: rec.difficulty,
    count: rec.count,
    taskType: "mixed",
    kind,
    title: rec.kind === "ueberpruefung" ? `Überprüfung: ${rec.skill.name}` : rec.kind === "wiederholung" ? `Wiederholung: ${rec.skill.name}` : `Training: ${rec.skill.area} › ${rec.skill.name}`,
    focusNote: rec.focusNote,
  });
  repo.assignWorksheet(result.id, studentId, `${RECOMMENDATION_NOTE} (${rec.skill.area} › ${rec.skill.name}): ${rec.reason}`);
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=analyse&zugewiesen=${result.id}`);
}

// ---------- skills ----------
export async function createSkillAction(formData: FormData) {
  const subject = str(formData, "subject");
  const area = str(formData, "area");
  const name = str(formData, "name");
  if (!subject || !area || !name) return;
  repo.createSkill(subject, area, name, int(formData, "grade_min") || 1, int(formData, "grade_max") || 13);
  revalidatePath("/faehigkeiten");
}

// ---------- student mode ----------
export async function submitAnswerAction(input: SubmitInput) {
  const res = await submitAnswer(input);
  revalidatePath(`/lernen/${input.token}`);
  return res;
}

// ---------- AI insight ----------
export type InsightState = { summary: string; next_lesson_plan: string[]; parent_note: string } | { error: string } | null;

export async function aiInsightAction(studentId: number): Promise<InsightState> {
  if (!aiEnabled()) return { error: "Für die KI-Einschätzung wird ein ANTHROPIC_API_KEY benötigt." };
  const student = repo.getStudent(studentId);
  const a = analyzeStudent(studentId);
  if (!student || !a) return { error: "Schüler nicht gefunden." };
  const lessons = repo.listLessons(studentId).filter((l) => l.status === "abgeschlossen" && l.kind === "stunde").slice(0, 5);
  const context = [
    `Schüler: ${student.name}, ${klassenLabel(student.school_type, student.klasse)}`,
    `Lernziele: ${student.goals || "–"}`,
    `Fähigkeiten (Beherrschung, Trend):`,
    ...a.skills.filter((s) => s.mastery !== null).map((s) => `- ${s.skill.subject} › ${s.skill.area} › ${s.skill.name}: ${pct(s.mastery)}, Trend ${s.trend}${s.delta != null ? ` (${s.delta})` : ""}, Erstversuch-Quote ${pct(s.firstTryRate)}, Hilfen ${pct(s.hintRate)}`),
    `Häufige Fehler: ${a.errors.slice(0, 6).map((e) => `${e.label} (${e.count}×)`).join(", ") || "–"}`,
    `Letzte Stunden:`,
    ...lessons.map((l) => `- ${l.starts_at.slice(0, 10)} ${l.topic}: Verständnis ${l.understanding ?? "–"}/5. Fehler: ${l.mistakes || "–"}. Beobachtungen: ${l.tutor_notes || "–"}`),
  ].join("\n");
  try {
    const out = await analyzeWithAI(context);
    return out ?? { error: "Die KI hat keine Einschätzung geliefert." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "KI-Anfrage fehlgeschlagen." };
  }
}
