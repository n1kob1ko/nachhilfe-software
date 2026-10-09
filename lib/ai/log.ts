/**
 * The cost log of the KI: one row per request in ai_calls, and the sums for Mehr › KI-Kosten.
 * Only numbers and ids: no prompt, no answer, no name.
 */
import { db } from "../db";
import { FUNCTIONS, budget, type AIFunction, type Tier } from "./config";

export type CallStatus = "ok" | "cache" | "abgelehnt" | "fehler" | "timeout" | "budget" | "pausiert";

export type CallRow = {
  fn: AIFunction;
  tier: Tier;
  model: string;
  teacherId: number | null;
  unitId: number | null;
  trigger: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
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
      `INSERT INTO ai_calls (created_at, fn, tier, model, teacher_id, unit_id, trigger, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, duration_ms, cost_usd, status, error, test)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      new Date(at).toISOString(),
      r.fn,
      r.tier,
      r.model,
      r.teacherId,
      r.unitId,
      r.trigger,
      Math.round(r.input),
      Math.round(r.output),
      Math.round(r.cacheWrite),
      Math.round(r.cacheRead),
      Math.round(r.durationMs),
      r.costUsd,
      r.status,
      (r.error ?? "").slice(0, 200),
      r.test ? 1 : 0,
    );
  return Number(res.lastInsertRowid);
}

/**
 * Spent this month (test runs do not count). Read from the table every time: pages and actions may run
 * in separate copies of this module, a remembered sum could be out of date.
 */
export function monthSpend(now = Date.now()): number {
  const from = `${monthOf(now)}-01T00:00:00.000Z`;
  const { usd } = db().prepare("SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ai_calls WHERE test = 0 AND created_at >= ?").get(from) as { usd: number };
  return usd;
}

/** "aus": the budget is used up, no paid request runs this month. Amounts in US dollars. */
export type BudgetState = { spent: number; budget: number; share: number; level: "ok" | "warnung" | "aus" };
export function budgetState(now = Date.now()): BudgetState {
  const b = budget();
  const spent = monthSpend(now);
  const share = b.monthlyUsd > 0 ? spent / b.monthlyUsd : spent > 0 ? Infinity : 0;
  const level = share >= 1 ? "aus" : share >= b.warnAt ? "warnung" : "ok";
  return { spent, budget: b.monthlyUsd, share, level };
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

export function costByFunction(month: string, f: Filter = {}) {
  const rows = db()
    .prepare(`SELECT fn AS key, GROUP_CONCAT(DISTINCT model) AS models, ${SUM} FROM ai_calls ${where(f, "substr(created_at, 1, 7) = ?")} GROUP BY fn ORDER BY usd DESC`)
    .all(month) as (Sum & { key: AIFunction; models: string | null })[];
  return rows.map((r) => ({ ...r, label: FUNCTIONS[r.key]?.label ?? r.key, models: (r.models ?? "").split(",").filter(Boolean) }));
}

export type CallLogRow = { id: number; created_at: string; fn: AIFunction; model: string; trigger: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; duration_ms: number; cost_usd: number; status: CallStatus; error: string };
export function recentCalls(limit = 25, f: Filter = {}) {
  return db()
    .prepare(`SELECT id, created_at, fn, model, trigger, input_tokens, output_tokens, cache_read_tokens, duration_ms, cost_usd, status, error FROM ai_calls ${where(f)} ORDER BY id DESC LIMIT ?`)
    .all(limit) as CallLogRow[];
}

/** One logged request (the KI-Selbsttest shows model, duration and cost of its requests). */
export function callById(id: number) {
  return (db().prepare("SELECT id, created_at, fn, model, trigger, input_tokens, output_tokens, cache_read_tokens, duration_ms, cost_usd, status, error FROM ai_calls WHERE id = ?").get(id) as CallLogRow | undefined) ?? null;
}

/** The latest request with this trigger, or null. */
export function lastCallOf(trigger: string) {
  return (db().prepare("SELECT id, created_at, fn, model, trigger, input_tokens, output_tokens, cache_read_tokens, duration_ms, cost_usd, status, error FROM ai_calls WHERE trigger = ? ORDER BY id DESC LIMIT 1").get(trigger) as CallLogRow | undefined) ?? null;
}
