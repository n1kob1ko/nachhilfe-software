/**
 * Teacher login. A random session token lives in an httpOnly cookie and in teacher_sessions.
 * Server components and actions call currentTeacher()/requireTeacher(); proxy.ts only checks
 * that the cookie exists so unauthenticated visitors are sent to /login early.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { PUBLIC_DEFAULT_PASSWORD, defaultPasswordBlocked, hashPassword, verifyPassword } from "./password";
import { getTeacher, type Teacher } from "./repo";

export const SESSION_COOKIE = "lernheft_session";
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString("hex"));
const SESSION_DAYS = 30;

export function checkLogin(username: string, password: string): Teacher | null {
  const row = db().prepare("SELECT id, password_hash FROM teachers WHERE username = ? AND active = 1").get(username.trim().toLowerCase()) as
    | { id: number; password_hash: string }
    | undefined;
  // unknown names take as long as wrong passwords, so the answer time does not reveal usernames
  const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) return null;
  // the public demo password is known to everyone: on the real server it counts as wrong
  if (password === PUBLIC_DEFAULT_PASSWORD && defaultPasswordBlocked()) return null;
  return getTeacher(row.id);
}

// Brute-force protection, kept in memory (a restart clears it, which is fine for a single small server):
// - per username: after 5 wrong passwords the name is locked for 10 minutes, known or not
// - per address: after 20 wrong logins within 15 minutes the address waits 15 minutes,
//   so one visitor cannot try many names
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60_000;
const MAX_IP_FAILS = 20;
const IP_WINDOW_MS = 15 * 60_000;
const fails = new Map<string, { n: number; until: number }>();
const ipFails = new Map<string, { n: number; since: number; until: number }>();
const key = (u: string) => u.trim().toLowerCase();

function prune(now: number) {
  if (fails.size + ipFails.size < 5000) return;
  for (const [k, f] of fails) if (f.until < now - LOCK_MS) fails.delete(k);
  for (const [k, f] of ipFails) if (f.until < now && f.since < now - IP_WINDOW_MS) ipFails.delete(k);
}

export function loginBlockedMinutes(username: string, ip = "", now = Date.now()): number {
  const f = fails.get(key(username));
  const i = ipFails.get(ip);
  const until = Math.max(f?.until ?? 0, i?.until ?? 0);
  return until > now ? Math.ceil((until - now) / 60_000) : 0;
}
export function noteFailedLogin(username: string, ip = "", now = Date.now()) {
  prune(now);
  const f = fails.get(key(username));
  // count failures of the last 10 minutes; after a lock has run out the count starts again
  const n = f && f.n < MAX_FAILS && f.until > now - LOCK_MS ? f.n + 1 : 1;
  fails.set(key(username), { n, until: n >= MAX_FAILS ? now + LOCK_MS : now });
  const i = ipFails.get(ip);
  const inWindow = i && i.since > now - IP_WINDOW_MS;
  const m = inWindow ? i.n + 1 : 1;
  ipFails.set(ip, m >= MAX_IP_FAILS ? { n: 0, since: now - IP_WINDOW_MS, until: now + IP_WINDOW_MS } : { n: m, since: inWindow ? i.since : now, until: 0 });
}
/** After a correct login only the name's count is cleared: the address keeps its count. */
export function clearFailedLogins(username: string) {
  fails.delete(key(username));
}

export function createSession(teacherId: number): { token: string; expires: Date } {
  db().prepare("DELETE FROM teacher_sessions WHERE expires_at <= ?").run(new Date().toISOString());
  const token = crypto.randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db().prepare("INSERT INTO teacher_sessions (token, teacher_id, expires_at) VALUES (?, ?, ?)").run(token, teacherId, expires.toISOString());
  return { token, expires };
}

export function teacherForToken(token: string | undefined): Teacher | null {
  if (!token) return null;
  const row = db().prepare("SELECT teacher_id FROM teacher_sessions WHERE token = ? AND expires_at > ?").get(token, new Date().toISOString()) as
    | { teacher_id: number }
    | undefined;
  const t = row ? getTeacher(row.teacher_id) : null;
  return t && t.active ? t : null;
}

export function deleteSession(token: string | undefined) {
  if (token) db().prepare("DELETE FROM teacher_sessions WHERE token = ?").run(token);
}

export async function currentTeacher(): Promise<Teacher | null> {
  return teacherForToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** For pages and actions of the tutor area. Sends to /login, or to the password page while the initial password is in use. */
export async function requireTeacher(opts: { allowInitialPassword?: boolean } = {}): Promise<Teacher> {
  const t = await currentTeacher();
  if (!t) redirect("/login");
  if (t.must_change_password && !opts.allowInitialPassword) redirect("/passwort");
  return t;
}

export async function requireAdmin(): Promise<Teacher> {
  const t = await requireTeacher();
  if (!t.is_admin) redirect("/");
  return t;
}

export function setPassword(teacherId: number, password: string, mustChange = false) {
  db().prepare("UPDATE teachers SET password_hash = ?, must_change_password = ? WHERE id = ?").run(hashPassword(password), mustChange ? 1 : 0, teacherId);
}

export function passwordMatches(teacherId: number, password: string) {
  const row = db().prepare("SELECT password_hash FROM teachers WHERE id = ?").get(teacherId) as { password_hash: string } | undefined;
  return verifyPassword(password, row?.password_hash);
}
