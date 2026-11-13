"use server";

import { pushLive } from "@/lib/live";
import { deliverIfRunning } from "@/lib/tafel-senden";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiEnabled, analyzeWithAI } from "@/lib/ai";
import { pct } from "@/lib/analysis";
import { hasData, seedDemo } from "@/lib/demo";
import { requireTeacher } from "@/lib/auth";
import { DELETE_REFUSAL_TEXT, deleteBillingEntry } from "@/lib/billing";
import { noteActivity } from "@/lib/learning";
import * as repo from "@/lib/repo";
import { dropFilesIfUnused, studentImageFiles } from "@/lib/picture-story";
import { alleFachNamen } from "@/lib/faecher";
import { fachAus, klassenLabel, schoolType, schulstufe } from "@/lib/school";
import { analyzeStudent, submitAnswer, type SubmitInput } from "@/lib/service";
import { runningUnitForStudent } from "@/lib/units";
import { dayOf } from "@/lib/exams";
import { empfehlungUebernehmen, sendeVorschau, verwirfVorschau } from "@/lib/ki-vorschau";
import { pruefeEinzeltermin } from "@/lib/planung/repo";
import { nachDemSpeichern, type EntwurfFehler } from "@/lib/einheit-aus-text";
import { ERROR_TYPES, type ErrorType } from "@/lib/error-types";

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
  // „noch nicht bekannt“ kommt leer an: dann bleibt die Klasse leer und die Schulstufe offen (0 = unklar)
  const klasse = int(formData, "klasse") ? Math.min(schoolType(schoolTypeName)?.classes ?? 13, Math.max(1, int(formData, "klasse"))) : null;
  const data: repo.StudentInput = {
    name: str(formData, "name"),
    grade: klasse !== null && schoolType(schoolTypeName) ? schulstufe(schoolTypeName, klasse) : 0,
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
    ki_hinweise: str(formData, "ki_hinweise"),
  };
  const extra = str(formData, "subject_other");
  if (extra) data.subjects.push(...extra.split(",").map((s) => fachAus(s, [], alleFachNamen())).filter(Boolean));
  data.subjects = [...new Set(data.subjects)];
  if (!data.name) throw new Error("Name fehlt");
  let sid = id;
  if (id) repo.updateStudent(id, data);
  else sid = repo.createStudent(data);
  revalidatePath("/", "layout");
  redirect(`/schueler/${sid}`);
}

export async function deleteStudentAction(id: number) {
  await requireTeacher();
  const pictures = studentImageFiles(id);
  repo.deleteStudent(id);
  dropFilesIfUnused(pictures);
  revalidatePath("/", "layout");
  redirect("/schueler");
}

// ---------- lessons ----------
/**
 * Eine von Hand geplante Einheit überschneidet sich nicht mit dem Wochenplan oder einer anderen geplanten Einheit
 * (Plan 3.3, lib/planung/repo.ts `pruefeEinzeltermin`). Geprüft wird nur, was geplant ist und sich an Zeit, Dauer,
 * Lehrer oder Status geändert hat; Dokumentiertes bleibt, wie es war. null = passt.
 */
function einzelterminFehler(formData: FormData): string | null {
  const id = int(formData, "id");
  if ((str(formData, "status") || "geplant") !== "geplant") return null;
  const lesson = { starts_at: str(formData, "starts_at"), duration_min: int(formData, "duration_min") || 60, teacher_id: int(formData, "teacher_id") || null, student_id: int(formData, "student_id") };
  const vorher = id ? repo.getLesson(id) : null;
  if (vorher && vorher.status === "geplant" && vorher.starts_at === lesson.starts_at && vorher.duration_min === lesson.duration_min && vorher.teacher_id === lesson.teacher_id) return null;
  const r = pruefeEinzeltermin({ ...lesson, gleichzeitig: str(formData, "gleichzeitig") === "1", ausserLessonId: id || undefined });
  return r.ok ? null : r.fehler;
}

/** Vorab im Formular, damit nichts Getipptes verloren geht; saveLessonAction prüft trotzdem selbst. */
export async function pruefeEinzelterminAction(formData: FormData): Promise<string | null> {
  await requireTeacher();
  return einzelterminFehler(formData);
}

export async function saveLessonAction(formData: FormData) {
  await requireTeacher();
  const ueberschneidung = einzelterminFehler(formData);
  if (ueberschneidung) {
    const lessonId = int(formData, "id");
    redirect(`/schueler/${int(formData, "student_id")}/stunden/${lessonId || "neu"}?fehler=${encodeURIComponent(ueberschneidung)}`);
  }
  const id = int(formData, "id");
  const studentId = int(formData, "student_id");
  noteActivity(studentId);
  const understanding = int(formData, "understanding");
  const lesson: repo.LessonInput = {
    student_id: studentId,
    teacher_id: int(formData, "teacher_id") || null,
    starts_at: str(formData, "starts_at"),
    duration_min: int(formData, "duration_min") || 60,
    // jedes Fach, auch einmalig (z. B. Biologie vor einem Test); die Fächer im Profil bleiben
    subject: fachAus(str(formData, "subject"), repo.getStudent(studentId)?.subjects, alleFachNamen()),
    topic: str(formData, "topic"),
    status: (str(formData, "status") as repo.Lesson["status"]) || "geplant",
    activities: str(formData, "activities"),
    mistakes: str(formData, "mistakes"),
    understanding: understanding >= 1 && understanding <= 5 ? understanding : null,
    tutor_notes: str(formData, "tutor_notes"),
    next_steps: str(formData, "next_steps"),
    skill_ids: formData.getAll("skill_ids").map(String),
  };
  // Einheit aus Text übernehmen (lib/einheit-aus-text.ts): die Fehler kommen Zeile für Zeile mit Fähigkeit und Fehlerart
  const entwurfId = id ? 0 : int(formData, "entwurf_id");
  const ausText = entwurfId ? fehlerAusFormular(formData, lesson.mistakes) : null;
  if (ausText) {
    lesson.mistakes = ausText.mistakes;
    if (ausText.gut.length) lesson.tutor_notes = [lesson.tutor_notes, `Gut lief: ${ausText.gut.join("; ")}`].filter(Boolean).join("\n");
  }
  const lessonId = repo.saveLesson(lesson, id || undefined);
  if (ausText) {
    const num = (k: string) => {
      const v = str(formData, k).replace(",", ".");
      return v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
    };
    const note = num("pr_note");
    const pruefung =
      str(formData, "pr_an") === "1"
        ? {
            art: str(formData, "pr_art") || "Schularbeit",
            punkte: num("pr_punkte"),
            max: num("pr_max"),
            note: note != null && Number.isInteger(note) && note >= 1 && note <= 5 ? note : null,
            teile: str(formData, "pr_teile").split("\n").map((t) => t.trim()).filter(Boolean),
            testId: str(formData, "pr_test") === "neu" ? null : int(formData, "pr_test") || null,
            datum: str(formData, "pr_datum"),
          }
        : null;
    nachDemSpeichern({ entwurfId, studentId, lessonId, teacherId: lesson.teacher_id ?? null, subject: lesson.subject, fehler: ausText.fehler, gut: ausText.gut, pruefung });
  }
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=lernverlauf`);
}

export async function deleteLessonAction(id: number, studentId: number) {
  await requireTeacher();
  repo.deleteLesson(id);
  revalidatePath("/", "layout");
  redirect(`/schueler/${studentId}?tab=lernverlauf`);
}

/** Abrechnung: deletes an Einheit for good, then back to the same month and filters. */
/**
 * Abrechnung: eine Einheit ganz löschen. Leitet nicht um: der Aufruf kommt erst, wenn „Rückgängig“ abgelaufen ist
 * (components/Meldung.tsx), und die Lehrkraft ist dann vielleicht schon auf einer anderen Seite.
 */
export async function deleteBillingEntryAction(id: number): Promise<{ error?: string }> {
  const viewer = await requireTeacher();
  const r = deleteBillingEntry(id, viewer);
  revalidatePath("/", "layout");
  return r.ok ? {} : { error: DELETE_REFUSAL_TEXT[r.error] };
}

// ---------- homework & tests ----------
export async function addHomeworkAction(formData: FormData) {
  await requireTeacher();
  const studentId = int(formData, "student_id");
  // optional: die Übung, zu der die Hausübung gehört (nur eine dieses Schülers)
  const assignment = int(formData, "assignment_id") ? repo.getAssignment(int(formData, "assignment_id")) : null;
  repo.addHomework({
    student_id: studentId,
    subject: fachAus(str(formData, "subject"), repo.getStudent(studentId)?.subjects, alleFachNamen()),
    description: str(formData, "description"),
    due_date: str(formData, "due_date") || null,
    status: "offen",
    notes: "",
    assignment_id: assignment?.student_id === studentId ? assignment.id : null,
  });
  revalidatePath(`/schueler/${studentId}`);
  revalidatePath("/");
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

// Beide leiten nicht um: die Seite wechselt schon beim Tipp zur Liste, gelöscht wird erst, wenn „Rückgängig“ abgelaufen ist
// (components/Meldung.tsx, WegForm mit `danach`).
export async function deleteWorksheetAction(id: number) {
  await requireTeacher();
  repo.deleteWorksheet(id);
  revalidatePath("/", "layout");
}

export async function deleteAssignmentAction(id: number) {
  await requireTeacher();
  repo.deleteAssignment(id);
  revalidatePath("/", "layout");
}

/**
 * „Direkt an … senden“ bei einer Empfehlung (lib/recommend.ts). Ohne KI wird die Übung gleich zugewiesen, wie bisher; mit KI kommt sie
 * zuerst als Vorschau an dieselbe Stelle (lib/ki-vorschau.ts) und geht erst mit „Senden“ dort an den Schüler. `ohneKi`: „Ohne KI
 * senden“, nachdem die KI nicht ging. From a diagnosis (diagnosisId) everything is reported back there.
 */
export async function applyRecommendationAction(studentId: number, key: string, diagnosisId: number | null = null, ohneKi = false) {
  const teacher = await requireTeacher();
  const back = diagnosisId ? `/diagnose/${diagnosisId}?` : `/schueler/${studentId}?tab=fortschritt&`;
  const out = await empfehlungUebernehmen(studentId, key, { teacherId: teacher.id, today: dayOf(new Date()), ohneKi: ohneKi === true });
  if ("fehler" in out) redirect(`${back}fehler=${encodeURIComponent(out.fehler)}`);
  revalidatePath("/", "layout");
  if ("vorschau" in out) {
    const n = out.vorschau;
    if (n.status === "fehler") redirect(`${back}fehler=${encodeURIComponent(`Die KI hat gerade keine Aufgaben erstellt: ${n.problem} Es wurde nichts gesendet.`)}`);
    redirect(back.slice(0, -1));
  }
  noteActivity(studentId);
  redirect(`/schueler/${studentId}?tab=fortschritt&zugewiesen=${out.worksheetId}`);
}

/** Nur Wege innerhalb der App (kein „//andere-seite“). */
const innen = (zurueck: string, studentId: number) => (zurueck.startsWith("/") && !zurueck.startsWith("//") ? zurueck : `/schueler/${studentId}?tab=fortschritt`);

/**
 * „Senden“ in der Vorschau ohne Einheit (Empfehlung, Diagnose; lib/ki-vorschau.ts): genau diese Aufgaben an den Schüler. Eine Diagnose
 * geht in einer laufenden Einheit gleich aufs Gerät und öffnet ihr Ergebnis, wie „Diagnose starten“ bisher.
 */
export async function vorschauSendenAction(studentId: number, id: number, zurueck: string) {
  const teacher = await requireTeacher();
  const ziel = innen(zurueck, studentId);
  const out = sendeVorschau(studentId, id, teacher.id);
  if ("fehler" in out) redirect(`${ziel}${ziel.includes("?") ? "&" : "?"}fehler=${encodeURIComponent(out.fehler)}`);
  noteActivity(studentId);
  revalidatePath("/", "layout");
  if (out.art === "diagnose") {
    deliverIfRunning(studentId, out.assignmentId);
    const unit = runningUnitForStudent(studentId);
    if (unit) pushLive(unit.id);
    redirect(`/diagnose/${out.assignmentId}`);
  }
  redirect(`${ziel}${ziel.includes("?") ? "&" : "?"}zugewiesen=${out.worksheetId}`);
}

/** „Verwerfen“ in der Vorschau ohne Einheit: nichts geht an den Schüler. */
export async function vorschauVerwerfenAction(studentId: number, id: number, zurueck: string) {
  await requireTeacher();
  verwirfVorschau(studentId, id);
  revalidatePath("/", "layout");
  redirect(innen(zurueck, studentId));
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
  revalidatePath(`/lernen/${input.token}`, "layout");
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
    `Letzte Einheiten:`,
    ...lessons.map((l) => `- ${l.starts_at.slice(0, 10)} ${l.topic}: Verständnis ${l.understanding ?? "–"}/5. Fehler: ${l.mistakes || "–"}`),
  ].join("\n");
  try {
    const out = await analyzeWithAI(context, { teacherId: teacher.id, studentId, trigger: deep ? "tiefenanalyse" : "einschaetzung" }, deep);
    return out ?? { error: "Die KI hat keine Einschätzung geliefert." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "KI-Anfrage fehlgeschlagen." };
  }
}

/** Die Fehlerzeilen aus „Aus Text übernehmen“ (components/FehlerZeilen.tsx): Text, Fähigkeit, Fehlerart je Zeile. */
function fehlerAusFormular(formData: FormData, vorher: string): { mistakes: string; fehler: EntwurfFehler[]; gut: string[] } {
  const texte = formData.getAll("ek_text").map(String);
  const skills = formData.getAll("ek_skill").map(String);
  const arten = formData.getAll("ek_art").map(String);
  const fehler: EntwurfFehler[] = texte
    .map((t, i) => ({ text: t.replace(/\s+/g, " ").trim(), skillId: skills[i] && repo.getSkill(skills[i]) ? skills[i] : null, fehlerart: ERROR_TYPES.some((e) => e.key === arten[i]) ? (arten[i] as ErrorType) : null }))
    .filter((f) => f.text);
  const gut = str(formData, "ek_gut").split("\n").map((t) => t.trim()).filter(Boolean);
  return { mistakes: [vorher, ...fehler.map((f) => f.text)].filter(Boolean).join("\n"), fehler, gut };
}
