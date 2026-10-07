"use server";

import { forgetUnit } from "@/lib/ai/realtime";
import { unitChanged } from "@/lib/live";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  checkLogin,
  clearFailedLogins,
  createSession,
  currentTeacher,
  deleteSession,
  loginBlockedMinutes,
  noteFailedLogin,
  passwordMatches,
  requireAdmin,
  requireTeacher,
  setPassword,
} from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { db, usernameFor } from "@/lib/db";
import { endUnit, expectedSubject, sweepIdleUnits } from "@/lib/learning";
import { INITIAL_PASSWORD, PUBLIC_DEFAULT_PASSWORD, randomStartPassword } from "@/lib/password";
import * as repo from "@/lib/repo";
import { ensureBoardForUnit, notifyUnitClosed } from "@/lib/whiteboard";
import { canManageUnit, finishUnit, getUnit, runningUnits, startUnit } from "@/lib/units";

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
  const ip = clientIp(await headers());
  const wait = loginBlockedMinutes(username, ip);
  if (wait) return { error: `Zu viele falsche Versuche. Bitte in ${wait} ${wait === 1 ? "Minute" : "Minuten"} erneut probieren.`, values: { username } };
  const teacher = checkLogin(username, String(formData.get("password") ?? ""));
  if (!teacher) {
    noteFailedLogin(username, ip);
    return { error: "Benutzername oder Passwort stimmt nicht.", values: { username } };
  }
  clearFailedLogins(username);
  const { token, expires } = createSession(teacher.id);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1", path: "/", expires });
  redirect(teacher.must_change_password ? "/passwort" : safeNext(str(formData, "weiter")));
}

/**
 * Logging out never touches a running unit unless the teacher chose to: with units running the
 * teacher is first sent to /abmelden, which offers "weiterlaufen lassen", "beenden" or "abbrechen".
 */
export async function logoutAction(formData?: FormData) {
  const jar = await cookies();
  const t = await currentTeacher();
  const mode = formData ? str(formData, "mode") : "";
  if (t) {
    const running = runningUnits(t.id);
    if (running.length && !mode) redirect("/abmelden");
    if (mode === "beenden") for (const u of running) endUnit(u.id, { byTeacherId: t.id });
  }
  deleteSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await requireTeacher({ allowInitialPassword: true });
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  if (!passwordMatches(t.id, current)) return { error: "Das bisherige Passwort stimmt nicht." };
  if (next.length < 8) return { error: "Das neue Passwort braucht mindestens 8 Zeichen." };
  if (next !== String(formData.get("repeat") ?? "")) return { error: "Die beiden neuen Passwörter sind verschieden." };
  if (next === INITIAL_PASSWORD || next === PUBLIC_DEFAULT_PASSWORD || passwordMatches(t.id, next))
    return { error: "Bitte ein neues Passwort wählen, nicht das Startpasswort." };
  setPassword(t.id, next);
  // other devices that were logged in with the old password are logged out
  db().prepare("DELETE FROM teacher_sessions WHERE teacher_id = ? AND token <> ?").run(t.id, (await cookies()).get(SESSION_COOKIE)?.value ?? "");
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
  // every account gets its own one-time start password; it is shown only here and never stored in clear
  const start = randomStartPassword();
  setPassword(Number(res.lastInsertRowid), start, true);
  revalidatePath("/lehrer");
  return { ok: `${name} angelegt. Benutzername „${username}“, Startpasswort „${start}“. Nur jetzt sichtbar, beim ersten Login muss es geändert werden.` };
}

export async function resetTeacherPasswordAction(teacherId: number, _prev: FormState): Promise<FormState> {
  const me = await requireAdmin();
  if (teacherId === me.id) return { error: "Das eigene Passwort bitte unter „Passwort ändern“ ändern." };
  const start = randomStartPassword();
  setPassword(teacherId, start, true);
  db().prepare("DELETE FROM teacher_sessions WHERE teacher_id = ?").run(teacherId);
  revalidatePath("/lehrer");
  return { ok: `Neues Startpasswort „${start}“. Nur jetzt sichtbar, beim ersten Login muss es geändert werden.` };
}

export async function setTeacherActiveAction(teacherId: number, active: boolean) {
  const me = await requireAdmin();
  if (teacherId === me.id) return;
  db().prepare("UPDATE teachers SET active = ? WHERE id = ?").run(active ? 1 : 0, teacherId);
  if (!active) db().prepare("DELETE FROM teacher_sessions WHERE teacher_id = ?").run(teacherId);
  revalidatePath("/lehrer");
}

// ---------- units ----------
/**
 * Starts a unit. If one is already running for this student (another tab, a double click, a
 * colleague) nothing new is created; the teacher lands on that unit and can open or end it.
 */
export async function startUnitAction(studentId: number) {
  const t = await requireTeacher();
  if (!repo.getStudent(studentId)) redirect("/schueler");
  sweepIdleUnits();
  const { unit, created } = startUnit(t.id, studentId, { subject: expectedSubject(studentId) });
  if (created) {
    ensureBoardForUnit(unit.id);
    // the teacher's tablet switches to this student by itself
    unitChanged(unit.teacher_id, unit.id);
  }
  revalidatePath("/", "layout");
  // the teacher goes straight into the unit, which is where everything for it lives
  redirect(created ? `/einheiten/${unit.id}` : `/einheiten/${unit.id}?bereits=1`);
}

/** Loads a unit the logged-in teacher may end; others are sent to the unit page with a notice. */
async function manageableUnit(unitId: number) {
  const t = await requireTeacher();
  const u = getUnit(unitId);
  if (!u) redirect("/einheiten");
  if (!canManageUnit(t, u)) redirect(`/einheiten/${unitId}?fremd=1`);
  return { t, u };
}

export async function endUnitAction(unitId: number) {
  const { t } = await manageableUnit(unitId);
  endUnit(unitId, { byTeacherId: t.id });
  revalidatePath("/", "layout");
  redirect(`/einheiten/${unitId}`);
}

export async function cancelUnitAction(unitId: number, formData: FormData) {
  const { t } = await manageableUnit(unitId);
  const u = finishUnit(unitId, "abgebrochen", { byTeacherId: t.id, reason: str(formData, "reason") || "abgebrochen" });
  forgetUnit(unitId);
  notifyUnitClosed(unitId);
  revalidatePath("/", "layout");
  redirect(u ? `/schueler/${u.student_id}?tab=lernverlauf` : "/einheiten");
}

/** The teacher looks over the generated Lern-Dokumentation and completes it. */
export async function saveUnitDocAction(lessonId: number, formData: FormData) {
  const t = await requireTeacher();
  const lesson = repo.getLesson(lessonId);
  if (!lesson) redirect("/einheiten");
  const owner = lesson.unit_id ? getUnit(lesson.unit_id) : null;
  if (owner && !canManageUnit(t, owner)) redirect(`/einheiten/${owner.id}?fremd=1`);
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
