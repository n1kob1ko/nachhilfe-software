/**
 * Feedback der Lehrkräfte (niko, 21.10.2026): a teacher taps „Feedback“ on any page (also on the
 * whiteboard), writes what bothers them or is missing and may add a screenshot. The page, the screen size,
 * light or dark mode and the last errors in the browser come along by themselves, so nobody has to describe
 * where it happened. The Verwaltung reads everything under Mehr › Feedback, ticks it off and can copy the
 * open points as one text. Nothing here goes to the KI.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import { MAX_UPLOAD_BYTES, sniffType, uploadsDir } from "./materials";

export const FEEDBACK_ARTEN = { fehler: "Fehler", wunsch: "Wunsch", sonstiges: "Sonstiges" } as const;
export type FeedbackArt = keyof typeof FEEDBACK_ARTEN;
export type FeedbackStatus = "offen" | "erledigt";

/** At most this many characters of text; longer texts are cut, not refused. */
export const MAX_TEXT = 4000;
/** The browser keeps at most this many errors for the next feedback. */
export const MAX_FEHLER = 5;

export type Feedback = {
  id: number;
  teacher_id: number | null;
  /** the teacher's name at reading time ("" if the account is gone) */
  teacher_name: string;
  art: FeedbackArt;
  text: string;
  seite: string;
  bildschirm: string;
  modus: string;
  browser: string;
  fehler: string[];
  bild: string | null;
  status: FeedbackStatus;
  erledigt_at: string | null;
  created_at: string;
};

export type FeedbackEingabe = {
  teacherId: number;
  art: string;
  text: string;
  seite?: string;
  bildschirm?: string;
  modus?: string;
  browser?: string;
  fehler?: unknown;
  bild?: Buffer | null;
};

const kurz = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, max);

const istArt = (a: string): a is FeedbackArt => a in FEEDBACK_ARTEN;

// the folder is only known at run time: kept out of the build's file tracing
export const feedbackBildDatei = (name: string) => path.join(/*turbopackIgnore: true*/ uploadsDir(), path.basename(name));

/**
 * Stores one feedback. The text is required; a screenshot is optional and must really be a picture
 * (JPG, PNG or WebP, checked from its first bytes). Returns the new id or the reason it was refused.
 */
export function saveFeedback(e: FeedbackEingabe): { id: number } | { error: string } {
  const text = kurz(e.text, MAX_TEXT);
  if (text.length < 2) return { error: "Bitte kurz schreiben, was los ist." };
  const art: FeedbackArt = istArt(e.art) ? e.art : "sonstiges";
  const fehler = (Array.isArray(e.fehler) ? e.fehler : []).slice(-MAX_FEHLER).map((f) => kurz(f, 300)).filter(Boolean);

  let bild: string | null = null;
  if (e.bild?.length) {
    if (e.bild.length > MAX_UPLOAD_BYTES) return { error: `Das Bild ist zu groß (höchstens ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).` };
    const type = sniffType(e.bild);
    if (!type?.mime.startsWith("image/")) return { error: "Als Bild gehen nur Fotos und Screenshots (JPG, PNG oder WebP)." };
    bild = `feedback-${crypto.createHash("sha256").update(e.bild).digest("hex")}.${type.ext}`;
    fs.mkdirSync(/*turbopackIgnore: true*/ uploadsDir(), { recursive: true });
    const target = feedbackBildDatei(bild);
    if (!fs.existsSync(/*turbopackIgnore: true*/ target)) fs.writeFileSync(/*turbopackIgnore: true*/ target, e.bild, { mode: 0o600 });
  }

  const res = db()
    .prepare(
      `INSERT INTO feedback (teacher_id, art, text, seite, bildschirm, modus, browser, fehler_log, bild, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(e.teacherId, art, text, kurz(e.seite, 300), kurz(e.bildschirm, 40), kurz(e.modus, 20), kurz(e.browser, 300), JSON.stringify(fehler), bild, new Date().toISOString());
  return { id: Number(res.lastInsertRowid) };
}

type Row = Omit<Feedback, "fehler"> & { fehler_log: string };
const toFeedback = ({ fehler_log, ...r }: Row): Feedback => {
  let fehler: string[] = [];
  try {
    const v = JSON.parse(fehler_log || "[]");
    if (Array.isArray(v)) fehler = v.map(String);
  } catch {
    fehler = [];
  }
  return { ...r, teacher_name: r.teacher_name ?? "", fehler };
};

const SELECT = "SELECT f.*, COALESCE(t.name, '') AS teacher_name FROM feedback f LEFT JOIN teachers t ON t.id = f.teacher_id";

export function getFeedback(id: number): Feedback | null {
  const r = db().prepare(`${SELECT} WHERE f.id = ?`).get(id) as Row | undefined;
  return r ? toFeedback(r) : null;
}

/** Newest first. Without a teacher: everyone's (for the Verwaltung). */
export function listFeedback(o: { status?: FeedbackStatus; teacherId?: number } = {}): Feedback[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (o.status) {
    where.push("f.status = ?");
    args.push(o.status);
  }
  if (o.teacherId) {
    where.push("f.teacher_id = ?");
    args.push(o.teacherId);
  }
  return (db()
    .prepare(`${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY f.created_at DESC, f.id DESC`)
    .all(...args) as Row[]).map(toFeedback);
}

export function feedbackZahlen(teacherId?: number): Record<FeedbackStatus, number> {
  const rows = db()
    .prepare(`SELECT status, COUNT(*) AS n FROM feedback ${teacherId ? "WHERE teacher_id = ?" : ""} GROUP BY status`)
    .all(...(teacherId ? [teacherId] : [])) as { status: FeedbackStatus; n: number }[];
  const z: Record<FeedbackStatus, number> = { offen: 0, erledigt: 0 };
  for (const r of rows) if (r.status in z) z[r.status] = r.n;
  return z;
}

export function setFeedbackStatus(id: number, status: FeedbackStatus): boolean {
  const res = db()
    .prepare("UPDATE feedback SET status = ?, erledigt_at = ? WHERE id = ?")
    .run(status, status === "erledigt" ? new Date().toISOString() : null, id);
  return res.changes > 0;
}

const wann = (iso: string) =>
  new Date(iso).toLocaleString("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * The feedback as plain text, one block per point, to paste into a chat or a ticket. Teachers are named
 * by their first name only; students' names that a teacher may have typed stay as written.
 */
export function feedbackAlsText(list: Feedback[]): string {
  return list
    .map((f, i) => {
      const lines = [
        `${i + 1}. ${FEEDBACK_ARTEN[f.art]} · ${wann(f.created_at)} · ${f.teacher_name.split(/\s+/)[0] || "Lehrkraft"}`,
        `   Seite: ${f.seite || "?"}`,
        `   Gerät: ${[f.bildschirm, f.modus, kurzerBrowser(f.browser)].filter(Boolean).join(" · ") || "?"}`,
        ...f.text.split("\n").map((l) => `   ${l}`),
      ];
      if (f.bild) lines.push("   (mit Screenshot)");
      if (f.fehler.length) lines.push(`   Fehler im Browser: ${f.fehler.join(" | ")}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * "Safari auf iPad", "Chrome auf Android" … from a user agent, good enough to tell devices apart. An iPad
 * calls itself "Macintosh"; the button adds " Touch" to the user agent on touch screens to tell them apart.
 */
export function kurzerBrowser(ua: string): string {
  if (!ua) return "";
  const geraet = /iPad/.test(ua) || (/Macintosh/.test(ua) && / Touch$/.test(ua)) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  return geraet ? `${browser} auf ${geraet}` : browser;
}
