/**
 * The cost log of the KI: one row per request in ai_calls, and the sums for Mehr › KI-Kosten.
 * Only numbers and ids: no prompt, no answer, no name.
 */
import { db } from "../db";
import { FUNCTIONS, budget, type AIFunction, type BudgetPool, type ProviderId, type Tier } from "./config";

export type CallStatus = "ok" | "cache" | "abgelehnt" | "fehler" | "timeout" | "budget" | "pausiert";

export type CallRow = {
  fn: AIFunction;
  tier: Tier;
  /** which provider was asked; decides the budget the cost counts against */
  provider?: ProviderId | "";
  model: string;
  teacherId: number | null;
  unitId: number | null;
  /** the student the request is about (lib/ai/schueler-kosten.ts); null for requests about no one */
  studentId?: number | null;
  trigger: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  /** the part of output spent on thinking, where the provider reports it (output already counts it) */
  thinking?: number | null;
  durationMs: number;
  costUsd: number;
  status: CallStatus;
  error?: string;
  test?: boolean;
  at?: number;
};

const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);

export function logCall(r: CallRow): number {
  const at = r.at ?? Date.now();
  const res = db()
    .prepare(
      `INSERT INTO ai_calls (created_at, fn, tier, provider, model, teacher_id, unit_id, student_id, trigger, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, thinking_tokens, duration_ms, cost_usd, status, error, test)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      new Date(at).toISOString(),
      r.fn,
      r.tier,
      r.provider ?? "",
      r.model,
      r.teacherId,
      r.unitId,
      r.studentId ?? null,
      r.trigger,
      Math.round(r.input),
      Math.round(r.output),
      Math.round(r.cacheWrite),
      Math.round(r.cacheRead),
      r.thinking == null ? null : Math.round(r.thinking),
      Math.round(r.durationMs),
      r.costUsd,
      r.status,
      (r.error ?? "").slice(0, 200),
      r.test ? 1 : 0,
    );
  return Number(res.lastInsertRowid);
}

/** Rows of a budget pool: Anthropic's own, or every other provider's (rows from before the provider column count there). */
const POOL_WHERE: Record<BudgetPool, string> = { anthropic: "provider = 'anthropic'", allgemein: "provider <> 'anthropic'" };

/**
 * Spent this month (test runs do not count), in one budget pool or in all. Read from the table every time:
 * pages and actions may run in separate copies of this module, a remembered sum could be out of date.
 */
export function monthSpend(now = Date.now(), pool?: BudgetPool): number {
  const from = `${monthOf(now)}-01T00:00:00.000Z`;
  const { usd } = db()
    .prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ai_calls WHERE test = 0 AND created_at >= ?${pool ? ` AND ${POOL_WHERE[pool]}` : ""}`)
    .get(from) as { usd: number };
  return usd;
}

/** "aus": the budget is used up, no paid request of its providers runs this month. Amounts in US dollars. */
export type BudgetState = { pool: BudgetPool; spent: number; budget: number; share: number; level: "ok" | "warnung" | "aus" };
export function budgetState(now = Date.now(), pool: BudgetPool = "allgemein"): BudgetState {
  const b = budget(pool);
  const spent = monthSpend(now, pool);
  const share = b.monthlyUsd > 0 ? spent / b.monthlyUsd : spent > 0 ? Infinity : 0;
  const level = share >= 1 ? "aus" : share >= b.warnAt ? "warnung" : "ok";
  return { pool, spent, budget: b.monthlyUsd, share, level };
}

// ---------- statistics ----------

export type Sum = { calls: number; paid: number; input: number; output: number; cacheRead: number; usd: number; errors: number; reused: number; avgMs: number };
const sum = (p = "") => `COUNT(*) AS calls,
  SUM(CASE WHEN ${p}status IN ('ok', 'abgelehnt') THEN 1 ELSE 0 END) AS paid,
  COALESCE(SUM(${p}input_tokens + ${p}cache_write_tokens), 0) AS input, COALESCE(SUM(${p}output_tokens), 0) AS output,
  COALESCE(SUM(${p}cache_read_tokens), 0) AS cacheRead, COALESCE(SUM(${p}cost_usd), 0) AS usd,
  SUM(CASE WHEN ${p}status IN ('fehler', 'timeout') THEN 1 ELSE 0 END) AS errors,
  SUM(CASE WHEN ${p}status = 'cache' THEN 1 ELSE 0 END) AS reused,
  COALESCE(AVG(CASE WHEN ${p}status = 'ok' THEN ${p}duration_ms END), 0) AS avgMs`;
const SUM = sum();

type Filter = { teacherId?: number | null; test?: boolean };
function where(f: Filter, extra = "", p = "") {
  const parts = [`${p}test = ${f.test ? 1 : 0}`];
  if (f.teacherId != null) parts.push(`${p}teacher_id = ${Number(f.teacherId)}`);
  if (extra) parts.push(extra);
  return `WHERE ${parts.join(" AND ")}`;
}

/** Costs per day (last `days` days), newest first. */
export function costByDay(days = 14, f: Filter = {}, now = Date.now()) {
  const from = new Date(now - days * 86_400_000).toISOString();
  return db().prepare(`SELECT substr(created_at, 1, 10) AS key, ${SUM} FROM ai_calls ${where(f, "created_at >= ?")} GROUP BY key ORDER BY key DESC`).all(from) as (Sum & { key: string })[];
}

export function costByMonth(months = 6, f: Filter = {}) {
  return db().prepare(`SELECT substr(created_at, 1, 7) AS key, ${SUM} FROM ai_calls ${where(f)} GROUP BY key ORDER BY key DESC LIMIT ?`).all(months) as (Sum & { key: string })[];
}

export function costByTeacher(month: string, f: Filter = {}) {
  return db()
    .prepare(
      `SELECT COALESCE(t.name, 'ohne Lehrer') AS key, ${sum("c.")} FROM ai_calls c LEFT JOIN teachers t ON t.id = c.teacher_id
       ${where(f, "substr(c.created_at, 1, 7) = ?", "c.")} GROUP BY key ORDER BY usd DESC`,
    )
    .all(month) as (Sum & { key: string })[];
}

/** Per student this month (requests about no student are left out); id for the limit per student. */
export function costByStudent(month: string, f: Filter = {}) {
  return db()
    .prepare(
      `SELECT c.student_id AS id, COALESCE(s.name, 'gelöschter Schüler') AS key, ${sum("c.")} FROM ai_calls c LEFT JOIN students s ON s.id = c.student_id
       ${where(f, "c.student_id IS NOT NULL AND substr(c.created_at, 1, 7) = ?", "c.")} GROUP BY c.student_id ORDER BY usd DESC`,
    )
    .all(month) as (Sum & { key: string; id: number })[];
}

export function costByFunction(month: string, f: Filter = {}) {
  const rows = db()
    .prepare(`SELECT fn AS key, GROUP_CONCAT(DISTINCT model) AS models, ${SUM} FROM ai_calls ${where(f, "substr(created_at, 1, 7) = ?")} GROUP BY fn ORDER BY usd DESC`)
    .all(month) as (Sum & { key: AIFunction; models: string | null })[];
  return rows.map((r) => ({ ...r, label: FUNCTIONS[r.key]?.label ?? r.key, models: (r.models ?? "").split(",").filter(Boolean) }));
}

/**
 * One logged request as the provider reported it: input at full price, cache writes and reads apart,
 * output (thinking included; thinking_tokens says how much of it, null where not reported).
 */
export type CallLogRow = {
  id: number;
  created_at: string;
  fn: AIFunction;
  provider: ProviderId | "";
  model: string;
  trigger: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  thinking_tokens: number | null;
  duration_ms: number;
  cost_usd: number;
  status: CallStatus;
  error: string;
};
const CALL_COLUMNS = "id, created_at, fn, provider, model, trigger, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, thinking_tokens, duration_ms, cost_usd, status, error";
export function recentCalls(limit = 25, f: Filter = {}) {
  return db()
    .prepare(`SELECT ${CALL_COLUMNS} FROM ai_calls ${where(f)} ORDER BY id DESC LIMIT ?`)
    .all(limit) as CallLogRow[];
}

/** One logged request (the KI-Selbsttest shows model, duration and cost of its requests). */
export function callById(id: number) {
  return (db().prepare(`SELECT ${CALL_COLUMNS} FROM ai_calls WHERE id = ?`).get(id) as CallLogRow | undefined) ?? null;
}

/** The latest request with this trigger, or null. */
export function lastCallOf(trigger: string) {
  return (db().prepare(`SELECT ${CALL_COLUMNS} FROM ai_calls WHERE trigger = ? ORDER BY id DESC LIMIT 1`).get(trigger) as CallLogRow | undefined) ?? null;
}

/** The highest id in the log (the KI-Qualitätstest counts its own requests from there). */
export function lastCallId(): number {
  return (db().prepare("SELECT COALESCE(MAX(id), 0) AS id FROM ai_calls").get() as { id: number }).id;
}

/** The requests with this trigger after `afterId`, oldest first. */
export function callsOf(trigger: string, afterId = 0) {
  return db()
    .prepare(`SELECT ${CALL_COLUMNS} FROM ai_calls WHERE trigger = ? AND id > ? ORDER BY id`)
    .all(trigger, afterId) as CallLogRow[];
}

/** What the requests whose trigger starts with `prefix` cost after `afterId`, in US dollars. */
export function spentSince(prefix: string, afterId: number): number {
  return (db().prepare("SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ai_calls WHERE id > ? AND trigger LIKE ?").get(afterId, `${prefix}%`) as { usd: number }).usd;
}
