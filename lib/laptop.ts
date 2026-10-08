/**
 * Temporary access from a student's own laptop ("Eigenes Gerät verbinden").
 *
 * Deliberately separate from the teacher's tablet (lib/devices.ts):
 *   tablet  → paired once, belongs to a teacher, shows whatever unit that teacher teaches;
 *   laptop  → belongs to ONE unit, is confirmed by the teacher and ends with that unit.
 *
 * Flow: the teacher shows a 6-digit code (one per unit, 10 minutes, single use). The laptop enters it
 * and becomes a request ("wartet") with a two-digit check number shown on both screens. Only after
 * the teacher confirms does the laptop see anything of the unit ("aktiv"). The access ends when the
 * unit ends, the teacher ends it, the student signs out, or another laptop is confirmed for the unit.
 *
 * The laptop keeps a random secret in an httpOnly cookie; only its SHA-256 hash is stored. Every
 * request checks the session AND that its unit is still running, so nothing depends on an ending
 * having been noticed.
 */
import crypto from "node:crypto";
import { db } from "./db";
import { LATE_SAVE_MS } from "./texts";

export const LAPTOP_COOKIE = "lernheft_laptop";
export const CODE_MINUTES = 10;
/** A request the teacher has not answered in this time is dropped. */
export const REQUEST_MINUTES = 10;

export type LaptopStatus = "wartet" | "aktiv" | "abgelehnt" | "beendet";
export type EndReason = "einheit" | "lehrer" | "abgemeldet" | "ersetzt" | "abgelaufen" | "abgelehnt";

export type LaptopSession = {
  id: number;
  unit_id: number;
  check_code: string;
  label: string;
  status: LaptopStatus;
  end_reason: "" | EndReason;
  created_at: string;
  approved_at: string | null;
  ended_at: string | null;
  last_seen_at: string | null;
};
/** The session with what its unit says right now. */
export type LaptopView = LaptopSession & { teacher_id: number; student_id: number; unit_status: string };

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const iso = (ms = Date.now()) => new Date(ms).toISOString();
const COLS = "l.id, l.unit_id, l.check_code, l.label, l.status, l.end_reason, l.created_at, l.approved_at, l.ended_at, l.last_seen_at";
const VIEW = `SELECT ${COLS}, u.teacher_id, u.student_id, u.status AS unit_status FROM laptop_sessions l JOIN units u ON u.id = l.unit_id`;

export const laptopChannel = (sessionId: number) => `laptop:${sessionId}`;

// ---------- codes ----------

/** A new code for this unit; an older code of the unit stops working. Only for running units. */
export function createLaptopCode(unitId: number, createdBy: number, now = Date.now()): { code: string; expiresAt: string } | null {
  const unit = db().prepare("SELECT status FROM units WHERE id = ?").get(unitId) as { status: string } | undefined;
  if (unit?.status !== "gestartet") return null;
  db().prepare("DELETE FROM laptop_codes WHERE unit_id = ? OR expires_at <= ?").run(unitId, iso(now));
  for (;;) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = iso(now + CODE_MINUTES * 60_000);
    // the tablet codes are a different set: a code is never valid for both
    if (db().prepare("SELECT 1 FROM device_pair_codes WHERE code = ?").get(code)) continue;
    const res = db().prepare("INSERT OR IGNORE INTO laptop_codes (unit_id, code, created_by, expires_at) VALUES (?, ?, ?, ?)").run(unitId, code, createdBy, expiresAt);
    if (res.changes) return { code, expiresAt };
  }
}

export function openLaptopCode(unitId: number, now = Date.now()): { code: string; expiresAt: string } | null {
  return (
    (db().prepare("SELECT code, expires_at AS expiresAt FROM laptop_codes WHERE unit_id = ? AND expires_at > ?").get(unitId, iso(now)) as
      | { code: string; expiresAt: string }
      | undefined) ?? null
  );
}

export function cancelLaptopCode(unitId: number) {
  db().prepare("DELETE FROM laptop_codes WHERE unit_id = ?").run(unitId);
}

// ---------- guessing protection ----------
// Per address: 8 wrong codes in 10 minutes. For everybody together: 100 wrong codes in 10 minutes, so
// trying many addresses does not help either. A guessed code still only leads to a request the
// teacher has to confirm, with the check number shown on the student's screen.

const PER_KEY = 8;
const OVERALL = 100;
const WINDOW_MS = CODE_MINUTES * 60_000;
const g = globalThis as unknown as { __laptopTries?: { keys: Map<string, { n: number; since: number }>; all: number[] } };
const tries = (g.__laptopTries ??= { keys: new Map(), all: [] as number[] });

export function joinBlocked(key: string, now = Date.now()): boolean {
  const t = tries.keys.get(key);
  if (t && now - t.since < WINDOW_MS && t.n >= PER_KEY) return true;
  tries.all = tries.all.filter((at) => now - at < WINDOW_MS);
  return tries.all.length >= OVERALL;
}

function noteWrong(key: string, now: number) {
  const t = tries.keys.get(key);
  tries.keys.set(key, t && now - t.since < WINDOW_MS ? { n: t.n + 1, since: t.since } : { n: 1, since: now });
  tries.all.push(now);
  if (tries.keys.size > 5000) for (const [k, v] of tries.keys) if (now - v.since >= WINDOW_MS) tries.keys.delete(k);
}

/** For tests. */
export function resetJoinTries() {
  tries.keys.clear();
  tries.all = [];
}

// ---------- joining ----------

export type JoinResult = { token: string; session: LaptopSession } | { error: string };

/**
 * The laptop enters a code. On success the code is used up and a request waits for the teacher.
 * A wrong code, an expired one and one of an ended unit all give the same answer.
 */
export function requestLaptopAccess(code: string, o: { key: string; label: string }, now = Date.now()): JoinResult {
  if (joinBlocked(o.key, now)) return { error: "Zu viele falsche Codes. Bitte in ein paar Minuten nochmal versuchen." };
  const clean = code.replace(/\D/g, "");
  const row =
    clean.length === 6
      ? (db()
          .prepare("SELECT c.unit_id FROM laptop_codes c JOIN units u ON u.id = c.unit_id WHERE c.code = ? AND c.expires_at > ? AND u.status = 'gestartet'")
          .get(clean, iso(now)) as { unit_id: number } | undefined)
      : undefined;
  if (!row) {
    noteWrong(o.key, now);
    return { error: "Dieser Code stimmt nicht oder ist abgelaufen. Bitte nach einem neuen Code fragen." };
  }
  tries.keys.delete(o.key);
  const token = crypto.randomBytes(32).toString("base64url");
  const check = String(crypto.randomInt(10, 100));
  const id = db().transaction(() => {
    db().prepare("DELETE FROM laptop_codes WHERE unit_id = ?").run(row.unit_id);
    // one open request per unit: an older one (a second try, another laptop) is dropped
    db().prepare("UPDATE laptop_sessions SET status = 'beendet', end_reason = 'abgelaufen', ended_at = ? WHERE unit_id = ? AND status = 'wartet'").run(iso(now), row.unit_id);
    const res = db()
      .prepare("INSERT INTO laptop_sessions (unit_id, token_hash, check_code, label, status, created_at, last_seen_at) VALUES (?, ?, ?, ?, 'wartet', ?, ?)")
      .run(row.unit_id, hash(token), check, o.label.slice(0, 60), iso(now), iso(now));
    return Number(res.lastInsertRowid);
  })();
  return { token, session: getLaptop(id)! };
}

// ---------- sessions ----------

export function getLaptop(id: number): LaptopView | null {
  return (db().prepare(`${VIEW} WHERE l.id = ?`).get(id) as LaptopView | undefined) ?? null;
}

export function laptopForToken(token: string | undefined): LaptopView | null {
  if (!token || token.length > 100) return null;
  return (db().prepare(`${VIEW} WHERE l.token_hash = ?`).get(hash(token)) as LaptopView | undefined) ?? null;
}

/**
 * What a session is right now. An open request runs out; an active session whose unit is no longer
 * running is over, whether or not the ending was noticed (server restart, automatic end).
 */
export function laptopState(s: LaptopView, now = Date.now()): LaptopStatus {
  if (s.status === "wartet" && (s.unit_status !== "gestartet" || now - Date.parse(s.created_at) > REQUEST_MINUTES * 60_000)) return "beendet";
  if (s.status === "aktiv" && s.unit_status !== "gestartet") return "beendet";
  return s.status;
}

/** Why it is over, as far as the laptop is told. */
export function laptopEndReason(s: LaptopView, now = Date.now()): EndReason | null {
  const state = laptopState(s, now);
  if (state === "wartet" || state === "aktiv") return null;
  if (s.end_reason) return s.end_reason;
  return s.status === "wartet" ? (s.unit_status === "gestartet" ? "abgelaufen" : "einheit") : "einheit";
}

/** The open request of a unit, for the teacher to confirm. */
export function pendingLaptop(unitId: number, now = Date.now()): LaptopView | null {
  const s = db().prepare(`${VIEW} WHERE l.unit_id = ? AND l.status = 'wartet' ORDER BY l.id DESC LIMIT 1`).get(unitId) as LaptopView | undefined;
  return s && laptopState(s, now) === "wartet" ? s : null;
}

/** The confirmed laptop of a running unit (at most one). */
export function activeLaptop(unitId: number): LaptopView | null {
  const s = db().prepare(`${VIEW} WHERE l.unit_id = ? AND l.status = 'aktiv' ORDER BY l.id DESC LIMIT 1`).get(unitId) as LaptopView | undefined;
  return s && s.unit_status === "gestartet" ? s : null;
}

/** The teacher confirms a request. Another laptop of the unit loses its access. Returns the ids that ended. */
export function approveLaptop(unitId: number, sessionId: number, now = Date.now()): { ok: boolean; ended: number[] } {
  const s = getLaptop(sessionId);
  if (!s || s.unit_id !== unitId || laptopState(s, now) !== "wartet") return { ok: false, ended: [] };
  return db().transaction(() => {
    const ended = (db().prepare("SELECT id FROM laptop_sessions WHERE unit_id = ? AND status = 'aktiv'").all(unitId) as { id: number }[]).map((r) => r.id);
    db().prepare("UPDATE laptop_sessions SET status = 'beendet', end_reason = 'ersetzt', ended_at = ? WHERE unit_id = ? AND status = 'aktiv'").run(iso(now), unitId);
    db().prepare("UPDATE laptop_sessions SET status = 'aktiv', approved_at = ? WHERE id = ?").run(iso(now), sessionId);
    return { ok: true, ended };
  })();
}

export function rejectLaptop(unitId: number, sessionId: number, now = Date.now()): boolean {
  return (
    db().prepare("UPDATE laptop_sessions SET status = 'abgelehnt', end_reason = 'abgelehnt', ended_at = ? WHERE id = ? AND unit_id = ? AND status = 'wartet'").run(iso(now), sessionId, unitId)
      .changes > 0
  );
}

/** Ends one session (waiting or active). */
export function endLaptop(sessionId: number, reason: EndReason, now = Date.now()): boolean {
  return (
    db().prepare("UPDATE laptop_sessions SET status = 'beendet', end_reason = ?, ended_at = ? WHERE id = ? AND status IN ('wartet','aktiv')").run(reason, iso(now), sessionId)
      .changes > 0
  );
}

/**
 * The laptop signs out (or has finished cleaning up after the end): from now on its secret is worth
 * nothing, also not for handing in texts late. Returns true when it was still running.
 */
export function signOutLaptop(sessionId: number, now = Date.now()): boolean {
  if (endLaptop(sessionId, "abgemeldet", now)) return true;
  db().prepare("UPDATE laptop_sessions SET end_reason = 'abgemeldet' WHERE id = ? AND status = 'beendet' AND end_reason = 'einheit'").run(sessionId);
  return false;
}

/** The unit ended: every laptop of it loses its access and the code stops working. Returns the ids that ended. */
export function endLaptopsOfUnit(unitId: number, now = Date.now()): number[] {
  return db().transaction(() => {
    db().prepare("DELETE FROM laptop_codes WHERE unit_id = ?").run(unitId);
    const ids = (db().prepare("SELECT id FROM laptop_sessions WHERE unit_id = ? AND status IN ('wartet','aktiv')").all(unitId) as { id: number }[]).map((r) => r.id);
    db().prepare("UPDATE laptop_sessions SET status = 'beendet', end_reason = 'einheit', ended_at = ? WHERE unit_id = ? AND status IN ('wartet','aktiv')").run(iso(now), unitId);
    return ids;
  })();
}

export function touchLaptop(id: number, now = Date.now()) {
  db().prepare("UPDATE laptop_sessions SET last_seen_at = ? WHERE id = ?").run(iso(now), id);
}

/**
 * May this laptop save that text? Only texts of its unit's student, while the access is active, and
 * (so nothing typed offline is lost) up to 10 minutes after the unit ended. Not after the teacher ended
 * the access or the student signed out.
 */
export function laptopMayWrite(s: LaptopView | null, text: { student_id: number }, now = Date.now()): boolean {
  if (!s || text.student_id !== s.student_id) return false;
  const state = laptopState(s, now);
  if (state === "aktiv") return true;
  if (s.status === "wartet" || s.status === "abgelehnt" || !s.approved_at) return false;
  if (laptopEndReason(s, now) !== "einheit") return false;
  const unitEnd = db().prepare("SELECT ended_at FROM units WHERE id = ?").get(s.unit_id) as { ended_at: string | null } | undefined;
  const endedAt = unitEnd?.ended_at ?? s.ended_at;
  return Boolean(endedAt) && now - Date.parse(endedAt!) <= LATE_SAVE_MS;
}

/** "Windows · Chrome": enough for the teacher to recognise the device, nothing more is kept. */
export function deviceLabel(ua: string | null): string {
  const u = ua ?? "";
  const os = /iPad/.test(u)
    ? "iPad"
    : /iPhone/.test(u)
      ? "iPhone"
      : /Android/.test(u)
        ? "Android"
        : /CrOS/.test(u)
          ? "Chromebook"
          : /Windows/.test(u)
            ? "Windows"
            : /Mac OS X|Macintosh/.test(u)
              ? "Mac"
              : /Linux/.test(u)
                ? "Linux"
                : "";
  const browser = /Edg\//.test(u) ? "Edge" : /Firefox\//.test(u) ? "Firefox" : /OPR\//.test(u) ? "Opera" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "";
  return [os, browser].filter(Boolean).join(" · ") || "Unbekanntes Gerät";
}
