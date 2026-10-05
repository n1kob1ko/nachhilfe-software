import { toCsv } from "./csv";
import * as repo from "./repo";

export type BillingParams = { monat?: string; lehrer?: string; schueler?: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** Month (YYYY-MM) and filters from a query string; defaults to the current month. */
export function resolveMonth(p: BillingParams, now = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(p.monat ?? "");
  const year = m ? Number(m[1]) : now.getFullYear();
  const month = m ? Math.min(12, Math.max(1, Number(m[2]))) : now.getMonth() + 1;
  const key = (y: number, mo: number) => `${y}-${pad(mo)}`;
  const next = month === 12 ? key(year + 1, 1) : key(year, month + 1);
  const prev = month === 1 ? key(year - 1, 12) : key(year, month - 1);
  const teacherId = Number(p.lehrer) || null;
  const studentId = Number(p.schueler) || null;
  const label = new Date(year, month - 1, 1).toLocaleDateString("de-AT", { month: "long", year: "numeric" });
  return { monat: key(year, month), prev, next, label, teacherId, studentId };
}

/** Teachers without admin rights only ever see their own lessons, whatever the query string says. */
export function scopeToViewer(p: BillingParams, viewer: { id: number; is_admin: number | boolean }): BillingParams {
  return viewer.is_admin ? p : { ...p, lehrer: String(viewer.id) };
}

/** Resolves the query string of the billing page into a month range, filters and rows. */
export function resolveBilling(p: BillingParams, now = new Date()) {
  const m = resolveMonth(p, now);
  const rows = repo.billingEntries({ from: `${m.monat}-01T00:00`, to: `${m.next}-01T00:00`, teacherId: m.teacherId, studentId: m.studentId });
  return { ...m, rows };
}

export function billingDay(startsAt: string) {
  return new Date(startsAt).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** The billing sheet as CSV (Tag, Lehrer, Schüler, Thema, Beobachtungen). */
export function billingCsv(rows: repo.BillingRow[]) {
  return toCsv(
    ["Tag", "Lehrer", "Schüler", "Thema", "Beobachtungen"],
    rows.map((r) => [r.starts_at.slice(0, 10).split("-").reverse().join("."), r.teacher_name ?? "", r.student_name, [r.subject, r.topic].filter(Boolean).join(": "), r.tutor_notes]),
  );
}
