"use server";

import { deliverIfRunning, pushLive } from "@/lib/live";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiEnabled, analyzeWithAI } from "@/lib/ai";
import { RECOMMENDATION_NOTE, pct } from "@/lib/analysis";
import { hasData, seedDemo } from "@/lib/demo";
import { requireTeacher } from "@/lib/auth";
import { noteActivity } from "@/lib/learning";
import * as repo from "@/lib/repo";
import { klassenLabel, schoolType, schulstufe } from "@/lib/school";
import { analyzeStudent, buildWorksheet, submitAnswer, type SubmitInput } from "@/lib/service";
import { runningUnitForStudent } from "@/lib/units";
import { dayOf } from "@/lib/exams";
import { findNextStep } from "@/lib/recommend";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const v = Number(f.get(k));
  return Number.isFinite(v) ? Math.round(v) : 0;
};

export async function loadDemoData() {
  await requireTeacher();
  if (!hasData()) seedDemo();
  revalidatePath("/", "layout");
}

// ---------- students ----------
export async function saveStudentAction(formData: FormData) {
  await requireTeacher();
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
  await requireTeacher();
  repo.deleteStudent(id);
  revalidatePath("/", "layout");
  redirect("/schueler");
}

// ---------- lessons ----------
export async function saveLessonAction(formData: FormData) {
  await requireTeacher();
  const id = int(formData, "id");
  const studentId = int(formData, "student_id");
  noteActivity(studentId);
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
  redirect(`/schueler/${studentId}?tab=lernverlauf`);
}

export async function deleteLessonAction(id: number, studentId: number) {
  await requireTeacher();
  repo.deleteLesson(id);
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=lernverlauf`);
}

// ---------- homework & tests ----------
export async function addHomeworkAction(formData: FormData) {
  await requireTeacher();
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
  await requireTeacher();
  repo.setHomeworkStatus(id, status);
  revalidatePath(`/schueler/${studentId}`);
  revalidatePath("/");
}
export async function deleteHomeworkAction(id: number, studentId: number) {
  await requireTeacher();
  repo.deleteHomework(id);
  revalidatePath(`/schueler/${studentId}`);
}
export async function addTestAction(formData: FormData) {
  await requireTeacher();
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
  await requireTeacher();
  repo.deleteTest(id);
  revalidatePath(`/schueler/${studentId}`);
}

// ---------- worksheets ----------
export async function assignWorksheetAction(formData: FormData) {
  await requireTeacher();
  const worksheetId = int(formData, "worksheet_id");
  const studentId = int(formData, "student_id");
  if (studentId) {
    const id = repo.assignWorksheet(worksheetId, studentId, "", runningUnitForStudent(studentId)?.id ?? null);
    noteActivity(studentId);
    deliverIfRunning(studentId, id);
  }
  revalidatePath("/", "layout");
}

export async function deleteWorksheetAction(id: number) {
  await requireTeacher();
  repo.deleteWorksheet(id);
  revalidatePath("/", "layout");
  redirect("/uebungen");
}

export async function deleteAssignmentAction(id: number, studentId: number) {
  await requireTeacher();
  repo.deleteAssignment(id);
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=uebungen`);
}

/**
 * Turns a recommendation (lib/recommend.ts) into a worksheet and assigns it right away. From a
 * diagnosis (diagnosisId) a recommendation that no longer applies is reported back there.
 */
export async function applyRecommendationAction(studentId: number, key: string, diagnosisId: number | null = null) {
  const teacher = await requireTeacher();
  const student = repo.getStudent(studentId);
  const rec = student ? findNextStep(studentId, key, { today: dayOf(new Date()) }) : null;
  if (!student || !rec) {
    const back = diagnosisId ? `/diagnose/${diagnosisId}?` : `/schueler/${studentId}?tab=fortschritt&`;
    redirect(`${back}fehler=${encodeURIComponent("Diese Empfehlung gilt nicht mehr, es wurde nichts gesendet. Die Liste ist jetzt aktuell.")}`);
  }
  const result = await buildWorksheet({
    subject: rec.skill.subject,
    schoolType: student.school_type,
    klasse: student.klasse ?? 1,
    skillIds: [rec.skill.id],
    difficulty: rec.difficulty,
    count: rec.count,
    taskType: "mixed",
    kind: rec.kind,
    title: rec.kind === "ueberpruefung" ? `Überprüfung: ${rec.skill.name}` : rec.rule === 6 ? `Wiederholung: ${rec.skill.name}` : `Training: ${rec.skill.area} › ${rec.skill.name}`,
    focusNote: rec.focusNote,
    teacherId: teacher.id,
  });
  noteActivity(studentId);
  repo.assignWorksheet(result.id, studentId, `${RECOMMENDATION_NOTE} (${rec.skill.area} › ${rec.skill.name}): ${rec.reason}`, runningUnitForStudent(studentId)?.id ?? null);
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=fortschritt&zugewiesen=${result.id}`);
}

// ---------- skills ----------
export async function createSkillAction(formData: FormData) {
  await requireTeacher();
  const parent = repo.getSkill(str(formData, "parent_id"));
  const name = str(formData, "name");
  if (parent && name) {
    // a Teilfähigkeit belongs to its skill's subject and topic
    repo.createSkill(parent.subject, parent.area, name, parent.grade_min, parent.grade_max, parent.parent_id ?? parent.id);
  } else {
    const subject = str(formData, "subject");
    const area = str(formData, "area");
    if (!subject || !area || !name) return;
    repo.createSkill(subject, area, name, int(formData, "grade_min") || 1, int(formData, "grade_max") || 13);
  }
  revalidatePath("/faehigkeiten");
}

// ---------- student mode ----------
export async function submitAnswerAction(input: SubmitInput) {
  const res = await submitAnswer(input);
  revalidatePath(`/lernen/${input.token}`);
  const student = repo.getStudentByToken(input.token);
  const unit = student ? runningUnitForStudent(student.id) : null;
  if (unit) pushLive(unit.id);
  return res;
}

// ---------- AI insight ----------
export type InsightState = { summary: string; next_lesson_plan: string[]; parent_note: string } | { error: string } | null;

/** deep: the Tiefenanalyse with the strong model, only on the teacher's click. */
export async function aiInsightAction(studentId: number, deep = false): Promise<InsightState> {
  const teacher = await requireTeacher();
  if (!aiEnabled()) return { error: "Kein KI-Schlüssel hinterlegt." };
  const student = repo.getStudent(studentId);
  const a = analyzeStudent(studentId);
  if (!student || !a) return { error: "Schüler nicht gefunden." };
  const lessons = repo.listLessons(studentId).filter((l) => l.status === "abgeschlossen" && l.kind === "stunde").slice(0, 5);
  const context = [
    // no name and no free-text notes: only learning data leaves the app
    `Schüler/in: ${klassenLabel(student.school_type, student.klasse)}`,
    `Fähigkeiten (Beherrschung, Trend):`,
    ...a.skills.filter((s) => s.mastery !== null).map((s) => `- ${s.skill.subject} › ${s.skill.area} › ${s.skill.name}: ${pct(s.mastery)}, Trend ${s.trend}${s.delta != null ? ` (${s.delta})` : ""}, Erstversuch-Quote ${pct(s.firstTryRate)}, Hilfen ${pct(s.hintRate)}`),
    `Häufige Fehler: ${a.errors.slice(0, 6).map((e) => `${e.label} (${e.count}×)`).join(", ") || "–"}`,
    `Letzte Stunden:`,
    ...lessons.map((l) => `- ${l.starts_at.slice(0, 10)} ${l.topic}: Verständnis ${l.understanding ?? "–"}/5. Fehler: ${l.mistakes || "–"}`),
  ].join("\n");
  try {
    const out = await analyzeWithAI(context, { teacherId: teacher.id, trigger: deep ? "tiefenanalyse" : "einschaetzung" }, deep);
    return out ?? { error: "Die KI hat keine Einschätzung geliefert." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "KI-Anfrage fehlgeschlagen." };
  }
}
