"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  checkLogin,
  createSession,
  deleteSession,
  passwordMatches,
  requireAdmin,
  requireTeacher,
  setPassword,
} from "@/lib/auth";
import { db, usernameFor } from "@/lib/db";
import { endUnit } from "@/lib/learning";
import { INITIAL_PASSWORD } from "@/lib/password";
import * as repo from "@/lib/repo";
import { finishUnit, getUnit, startUnit } from "@/lib/units";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const rating = (f: FormData, k: string) => {
  const v = Number(f.get(k));
  return v >= 1 && v <= 5 ? Math.round(v) : null;
};

/** Only same-site paths, so the login cannot be used to send people elsewhere. */
function safeNext(raw: string) {
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/";
}

// ---------- login ----------
/** `values` refills text fields after an error, because React resets the form once the action ran. */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | null;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = str(formData, "username");
  const teacher = checkLogin(username, String(formData.get("password") ?? ""));
  if (!teacher) return { error: "Benutzername oder Passwort stimmt nicht.", values: { username } };
  const { token, expires } = createSession(teacher.id);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1", path: "/", expires });
  redirect(teacher.must_change_password ? "/passwort" : safeNext(str(formData, "weiter")));
}

export async function logoutAction() {
  const jar = await cookies();
  deleteSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await requireTeacher({ allowInitialPassword: true });
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  if (!passwordMatches(t.id, current)) return { error: "Das bisherige Passwort stimmt nicht." };
  if (next.length < 8) return { error: "Das neue Passwort braucht mindestens 8 Zeichen." };
  if (next !== String(formData.get("repeat") ?? "")) return { error: "Die beiden neuen Passwörter sind verschieden." };
  if (next === INITIAL_PASSWORD) return { error: "Bitte ein anderes Passwort als das Startpasswort wählen." };
  setPassword(t.id, next);
  redirect("/");
}

// ---------- teachers (admin) ----------
export async function createTeacherAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(formData, "name");
  if (!name) return { error: "Bitte einen Namen eingeben." };
  const username = usernameFor(str(formData, "username") || name);
  if (db().prepare("SELECT 1 FROM teachers WHERE username = ? OR name = ?").get(username, name)) return { error: "Diesen Lehrer gibt es schon." };
  const res = db().prepare("INSERT INTO teachers (name, username) VALUES (?, ?)").run(name, username);
  setPassword(Number(res.lastInsertRowid), INITIAL_PASSWORD, true);
  revalidatePath("/lehrer");
  return { ok: `${name} angelegt. Benutzername „${username}“, Startpasswort „${INITIAL_PASSWORD}“ (muss beim ersten Login geändert werden).` };
}

export async function resetTeacherPasswordAction(teacherId: number) {
  await requireAdmin();
  setPassword(teacherId, INITIAL_PASSWORD, true);
  db().prepare("DELETE FROM teacher_sessions WHERE teacher_id = ?").run(teacherId);
  revalidatePath("/lehrer");
}

export async function setTeacherActiveAction(teacherId: number, active: boolean) {
  const me = await requireAdmin();
  if (teacherId === me.id) return;
  db().prepare("UPDATE teachers SET active = ? WHERE id = ?").run(active ? 1 : 0, teacherId);
  if (!active) db().prepare("DELETE FROM teacher_sessions WHERE teacher_id = ?").run(teacherId);
  revalidatePath("/lehrer");
}

// ---------- units ----------
export async function startUnitAction(studentId: number) {
  const t = await requireTeacher();
  startUnit(t.id, studentId);
  revalidatePath("/", "layout");
}

export async function endUnitAction(unitId: number) {
  await requireTeacher();
  const lessonId = endUnit(unitId);
  revalidatePath("/", "layout");
  redirect(lessonId ? `/einheiten/${unitId}` : "/einheiten");
}

export async function cancelUnitAction(unitId: number, formData: FormData) {
  await requireTeacher();
  const u = finishUnit(unitId, "abgebrochen", str(formData, "reason") || "abgebrochen");
  revalidatePath("/", "layout");
  redirect(u ? `/schueler/${u.student_id}?tab=lernverlauf` : "/einheiten");
}

/** The teacher looks over the generated Lern-Dokumentation and completes it. */
export async function saveUnitDocAction(lessonId: number, formData: FormData) {
  const t = await requireTeacher();
  const lesson = repo.getLesson(lessonId);
  if (!lesson) redirect("/einheiten");
  const understanding = rating(formData, "understanding");
  const homework = str(formData, "homework_note");
  repo.saveLesson(
    {
      ...lesson,
      topic: str(formData, "topic"),
      activities: str(formData, "activities"),
      mistakes: str(formData, "mistakes"),
      understanding,
      summary: str(formData, "summary"),
      tutor_notes: str(formData, "tutor_notes"),
      concentration: rating(formData, "concentration"),
      motivation: rating(formData, "motivation"),
      participation: rating(formData, "participation"),
      difficulties: str(formData, "difficulties"),
      positives: str(formData, "positives"),
      review_topics: str(formData, "review_topics"),
      next_steps: str(formData, "next_steps"),
      homework_note: homework,
      skill_ids: formData.getAll("skill_ids").map(String).length ? formData.getAll("skill_ids").map(String) : lesson.skill_ids,
      reviewed_at: new Date().toISOString(),
      teacher_id: lesson.teacher_id ?? t.id,
    },
    lesson.id,
  );
  if (homework && formData.get("as_homework") === "on" && !lesson.homework_note) {
    repo.addHomework({ student_id: lesson.student_id, subject: lesson.subject, description: homework, due_date: str(formData, "homework_due") || null, status: "offen", notes: "aus der Einheit" });
  }
  revalidatePath("/", "layout");
  const unit = lesson.unit_id ? getUnit(lesson.unit_id) : null;
  redirect(`/schueler/${lesson.student_id}?tab=lernverlauf${unit ? `#einheit-${unit.id}` : ""}`);
}
