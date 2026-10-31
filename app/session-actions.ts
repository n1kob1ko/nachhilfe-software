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
import { bestaetigeAbschluss, isAbschlussFeld, korrigiereFeld } from "@/lib/abschluss";
import { clientIp } from "@/lib/client-ip";
import { db, usernameFor } from "@/lib/db";
import { fachHeute } from "@/lib/heute";
import { getKonto, loescheLehrer, setzeAktiv, setzeRolle, type Ergebnis } from "@/lib/lehrer-konten";
import { endUnit, expectedSubject, sweepIdleUnits } from "@/lib/learning";
import { INITIAL_PASSWORD, PUBLIC_DEFAULT_PASSWORD, randomStartPassword } from "@/lib/password";
import * as repo from "@/lib/repo";
import { ensureBoardForUnit, notifyUnitClosed } from "@/lib/whiteboard";
import { alleFachNamen } from "@/lib/faecher";
import { fachAus } from "@/lib/school";
import { canManageUnit, finishUnit, getUnit, runningUnits, setUnitSubject, startUnit } from "@/lib/units";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const rating = (f: FormData, k: string) => {
  const v = Number(f.get(k));
  return v >= 1 && v <= 5 ? Math.round(v) : null;
};

/** Only same-site paths, so the login cannot be used to send people elsewhere. Without one: /jetzt (the situation). */
function safeNext(raw: string) {
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/jetzt";
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
  redirect("/jetzt");
}

// ---------- teachers (admin) ----------
export async function createTeacherAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(formData, "name");
  if (!name) return { error: "Bitte einen Namen eingeben." };
  const username = usernameFor(str(formData, "username") || name);
  const gibtEs = db().prepare("SELECT deleted_at FROM teachers WHERE username = ? OR name = ?").get(username, name) as { deleted_at: string | null } | undefined;
  // der Name eines gelöschten Kontos bleibt in der Dokumentation stehen, deshalb ist er vergeben
  if (gibtEs?.deleted_at) return { error: "Diesen Namen trägt ein gelöschtes Konto. Bitte den Namen etwas anders schreiben, z. B. mit Nachnamen." };
  if (gibtEs) return { error: "Diesen Lehrer gibt es schon." };
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
  const ziel = getKonto(teacherId);
  if (!ziel || ziel.deleted_at) return { error: "Dieses Konto gibt es nicht mehr." };
  const start = randomStartPassword();
  setPassword(teacherId, start, true);
  db().prepare("DELETE FROM teacher_sessions WHERE teacher_id = ?").run(teacherId);
  revalidatePath("/lehrer");
  return { ok: `Neues Startpasswort „${start}“. Nur jetzt sichtbar, beim ersten Login muss es geändert werden.` };
}

export async function setTeacherActiveAction(teacherId: number, active: boolean) {
  const me = await requireAdmin();
  if (teacherId === me.id) return;
  const ergebnis = setzeAktiv(me.id, teacherId, active);
  revalidatePath("/lehrer");
  if (!ergebnis.ok) redirect(kontoMeldung(ergebnis));
}

/** Zurück zu den Accounts, mit der Rückmeldung dort (nicht oben auf der Seite). */
function kontoMeldung(e: Ergebnis) {
  return `/lehrer?${e.ok ? `konto=${encodeURIComponent(e.hinweis)}` : `kontofehler=${encodeURIComponent(e.fehler)}`}#accounts`;
}

/** Rolle Lehrer oder Verwaltung; die Regeln stehen in lib/lehrer-konten.ts und lesen die Rechte aus der Datenbank. */
export async function setTeacherRoleAction(teacherId: number, rolle: "lehrer" | "verwaltung") {
  const me = await requireAdmin();
  const ergebnis = setzeRolle(me.id, teacherId, rolle === "verwaltung");
  revalidatePath("/", "layout");
  redirect(kontoMeldung(ergebnis));
}

/** Konto löschen nach dem Bestätigungsschritt; `nachfolger` übernimmt die Schüler. */
export async function deleteTeacherAction(teacherId: number, formData: FormData) {
  const me = await requireAdmin();
  const nachfolger = Number(formData.get("nachfolger")) || null;
  const ergebnis = loescheLehrer(me.id, teacherId, nachfolger);
  revalidatePath("/", "layout");
  const id = Number(teacherId) || 0;
  redirect(ergebnis.ok ? kontoMeldung(ergebnis) : `/lehrer?loeschen=${id}&kontofehler=${encodeURIComponent(ergebnis.fehler)}#konto-${id}`);
}

// ---------- units ----------
/**
 * Starts a unit. If one is already running for this student (another tab, a double click, a
 * colleague) nothing new is created; the teacher lands on that unit and can open or end it.
 * `platzId`: the Platz of the card on Heute; the unit takes that one (else today's open Platz as before).
 */
export async function startUnitAction(studentId: number, platzId: number | null = null) {
  const t = await requireTeacher();
  if (!repo.getStudent(studentId)) redirect("/schueler");
  sweepIdleUnits();
  // in the subject Heute prepared (an exam in the second subject starts the unit in that subject)
  const { unit, created } = startUnit(t.id, studentId, { subject: expectedSubject(studentId, Date.now(), fachHeute(studentId, t.id)), platzId: Number.isInteger(platzId) ? platzId : null });
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

/**
 * „Dokumentation bestätigen“ im Abschluss: die vier Felder kommen in die Dokumentation, nur wo die Lehrkraft nichts
 * selbst geschrieben hat, und sie gilt als gesehen (lib/abschluss.ts `bestaetigeAbschluss`). Danach dorthin, wo die
 * Lehrkraft gebraucht wird (/jetzt): läuft noch ein zweiter Schüler, in seinen Unterricht, wartet sein Abschluss, dorthin,
 * sonst zu Heute.
 */
export async function bestaetigeDokuAction(lessonId: number) {
  const t = await requireTeacher();
  const lesson = repo.getLesson(lessonId);
  if (!lesson) redirect("/abschluss");
  const owner = lesson.unit_id ? getUnit(lesson.unit_id) : null;
  if (owner && !canManageUnit(t, owner)) redirect(`/einheiten/${owner.id}?fremd=1`);
  bestaetigeAbschluss(lessonId);
  revalidatePath("/", "layout");
  redirect("/jetzt");
}

/**
 * Ein Feld des Abschlusses direkt in der Karte korrigieren (ohne das große Formular). Bestätigt nicht: die Karte bleibt
 * offen, bis „Dokumentation bestätigen“ getippt wird. Leer: das Feld kommt wieder aus den Daten.
 */
export async function korrigiereFeldAction(lessonId: number, feld: string, text: string): Promise<{ ok: true } | { fehler: string }> {
  const t = await requireTeacher();
  const lesson = repo.getLesson(lessonId);
  if (!lesson || !isAbschlussFeld(feld)) return { fehler: "Dieses Feld gibt es nicht." };
  const owner = lesson.unit_id ? getUnit(lesson.unit_id) : null;
  if (owner && !canManageUnit(t, owner)) return { fehler: `Diese Einheit gehört ${owner.teacher_name}.` };
  korrigiereFeld(lessonId, feld, text);
  if (owner) revalidatePath(`/einheiten/${owner.id}`);
  return { ok: true };
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
  // das Fach dieser Einheit, frei wählbar (ein Formular ohne das Feld behält das bisherige)
  const subject = fachAus(str(formData, "subject"), repo.getStudent(lesson.student_id)?.subjects, alleFachNamen()) || lesson.subject;
  repo.saveLesson(
    {
      ...lesson,
      subject,
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
  if (lesson.unit_id && subject !== lesson.subject) setUnitSubject(lesson.unit_id, subject);
  if (homework && formData.get("as_homework") === "on" && !lesson.homework_note) {
    repo.addHomework({ student_id: lesson.student_id, subject, description: homework, due_date: str(formData, "homework_due") || null, status: "offen", notes: "aus der Einheit" });
  }
  revalidatePath("/", "layout");
  // aus dem Abschluss: weiter, wo die Lehrkraft gebraucht wird (wie „Dokumentation bestätigen“)
  if (formData.get("weiter") === "jetzt") redirect("/jetzt");
  const unit = lesson.unit_id ? getUnit(lesson.unit_id) : null;
  redirect(`/schueler/${lesson.student_id}?tab=lernverlauf${unit ? `#einheit-${unit.id}` : ""}`);
}
