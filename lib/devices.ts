/**
 * Student tablets ("Schülergeräte").
 *
 * A tablet is paired once with a teacher and from then on belongs to that teacher:
 *   tablet → teacher → the teacher's running unit → the student of that unit.
 * The tablet never stores a student. It holds a random secret in an httpOnly cookie; the database
 * keeps only its SHA-256 hash, so a database copy cannot be used to impersonate a tablet.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const DEVICE_COOKIE = "lernheft_geraet";
const CODE_MINUTES = 10;
const COOKIE_DAYS = 400;

export type Device = {
  id: number;
  teacher_id: number;
  name: string;
  paired_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};
export type DeviceView = Device & { teacher_name: string };

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const iso = (ms = Date.now()) => new Date(ms).toISOString();
const VIEW = `SELECT d.id, d.teacher_id, d.name, d.paired_at, d.last_seen_at, d.revoked_at, t.name AS teacher_name
  FROM student_devices d JOIN teachers t ON t.id = d.teacher_id`;

// ---------- pairing ----------

/** A new 6-digit code for connecting a tablet to `teacherId`. Older codes of that teacher stop working. */
export function createPairCode(teacherId: number, createdBy: number, now = Date.now()): { code: string; expiresAt: string } {
  db().prepare("DELETE FROM device_pair_codes WHERE teacher_id = ? OR expires_at <= ?").run(teacherId, iso(now));
  for (;;) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = iso(now + CODE_MINUTES * 60_000);
    const res = db().prepare("INSERT OR IGNORE INTO device_pair_codes (code, teacher_id, created_by, expires_at) VALUES (?, ?, ?, ?)").run(code, teacherId, createdBy, expiresAt);
    if (res.changes) return { code, expiresAt };
  }
}

/** The code a teacher is currently showing, if it is still valid. */
export function openPairCode(teacherId: number, now = Date.now()): { code: string; expiresAt: string } | null {
  return (
    (db().prepare("SELECT code, expires_at AS expiresAt FROM device_pair_codes WHERE teacher_id = ? AND expires_at > ?").get(teacherId, iso(now)) as
      | { code: string; expiresAt: string }
      | undefined) ?? null
  );
}

// Guessing protection: a tablet (by address) gets 8 wrong codes per 10 minutes. Kept in memory like the login lock.
const tries = new Map<string, { n: number; since: number }>();
export function pairingBlocked(key: string, now = Date.now()) {
  const t = tries.get(key);
  return Boolean(t && now - t.since < CODE_MINUTES * 60_000 && t.n >= 8);
}
function noteWrongCode(key: string, now = Date.now()) {
  const t = tries.get(key);
  tries.set(key, t && now - t.since < CODE_MINUTES * 60_000 ? { n: t.n + 1, since: t.since } : { n: 1, since: now });
}

/** Uses a code: creates the device and returns the secret for its cookie. The code can be used once. */
export function pairDevice(code: string, key = "", now = Date.now()): { token: string; device: DeviceView } | { error: string } {
  if (pairingBlocked(key, now)) return { error: "Zu viele falsche Codes. Bitte in ein paar Minuten nochmal versuchen." };
  const clean = code.replace(/\D/g, "");
  const row = db().prepare("SELECT teacher_id FROM device_pair_codes WHERE code = ? AND expires_at > ?").get(clean, iso(now)) as { teacher_id: number } | undefined;
  if (!row) {
    noteWrongCode(key, now);
    return { error: "Dieser Code stimmt nicht oder ist abgelaufen. Bitte am Lehrergerät einen neuen Code erzeugen." };
  }
  tries.delete(key);
  db().prepare("DELETE FROM device_pair_codes WHERE code = ?").run(clean);
  const teacher = db().prepare("SELECT name FROM teachers WHERE id = ?").get(row.teacher_id) as { name: string };
  const token = crypto.randomBytes(32).toString("base64url");
  const res = db()
    .prepare("INSERT INTO student_devices (teacher_id, name, token_hash, paired_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .run(row.teacher_id, `${teacher.name} – Schüler-Tablet`, hash(token), iso(now), iso(now));
  return { token, device: getDevice(Number(res.lastInsertRowid))! };
}

// ---------- devices ----------

export function getDevice(id: number): DeviceView | null {
  return (db().prepare(`${VIEW} WHERE d.id = ?`).get(id) as DeviceView | undefined) ?? null;
}

export function deviceForToken(token: string | undefined): DeviceView | null {
  if (!token) return null;
  return (db().prepare(`${VIEW} WHERE d.token_hash = ? AND d.revoked_at IS NULL`).get(hash(token)) as DeviceView | undefined) ?? null;
}

/** The tablet making this request, from its cookie. */
export async function currentDevice(): Promise<DeviceView | null> {
  return deviceForToken((await cookies()).get(DEVICE_COOKIE)?.value);
}

export async function setDeviceCookie(token: string) {
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/geraet",
    maxAge: COOKIE_DAYS * 86_400,
  });
}

/** Connected tablets; a teacher sees their own, admins see all (teacherId null). */
export function listDevices(teacherId: number | null): DeviceView[] {
  return db()
    .prepare(`${VIEW} WHERE d.revoked_at IS NULL AND (@t IS NULL OR d.teacher_id = @t) ORDER BY t.name, d.paired_at`)
    .all({ t: teacherId }) as DeviceView[];
}

export function hasDevice(teacherId: number): boolean {
  return Boolean(db().prepare("SELECT 1 FROM student_devices WHERE teacher_id = ? AND revoked_at IS NULL").get(teacherId));
}

export function renameDevice(id: number, name: string) {
  const clean = name.trim().slice(0, 60);
  if (clean) db().prepare("UPDATE student_devices SET name = ? WHERE id = ?").run(clean, id);
}

/** Disconnects a tablet: its cookie stops working at once and it shows the pairing screen again. */
export function revokeDevice(id: number, now = Date.now()) {
  db().prepare("UPDATE student_devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(iso(now), id);
}

export function touchDevice(id: number, now = Date.now()) {
  db().prepare("UPDATE student_devices SET last_seen_at = ? WHERE id = ?").run(iso(now), id);
}

/** Only the tablet's own teacher and admins may rename or disconnect it. */
export function canManageDevice(teacher: { id: number; is_admin: number | boolean }, device: Pick<Device, "teacher_id">) {
  return device.teacher_id === teacher.id || Boolean(teacher.is_admin);
}
