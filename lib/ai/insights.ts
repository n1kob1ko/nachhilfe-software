/** What the KI said during a unit, stored in ai_insights and read by the live status and the unit page. */
import { db } from "../db";
import type { Action } from "./labels";

export { ACTIONS, ACTION_LABEL, type Action } from "./labels";

/** Live analysis after answers or hints (the JSON the fast model returns, checked). */
export type LiveInsight = {
  error_type: string | null;
  misconception: string | null;
  confidence: number;
  recommended_action: Action;
  difficulty_adjustment: -1 | 0 | 1;
  hint: string | null;
  next_skill: string | null;
  needs_new_exercise: boolean;
  teacher_note: string;
};
export type BlockInsight = {
  summary: string;
  strengths: string[];
  gaps: string[];
  recommended_action: Action;
  difficulty_adjustment: -1 | 0 | 1;
  next_skill: string | null;
  needs_new_exercise: boolean;
};
export type UnitInsight = { summary: string; next_steps: string[]; next_skill: string | null; homework: string | null };

type Kinds = { echtzeit: LiveInsight; block: BlockInsight; einheit: UnitInsight };
export type Kind = keyof Kinds;
export type Stored<K extends Kind> = { id: number; unitId: number; kind: K; taskId: number | null; assignmentId: number | null; triggers: string[]; data: Kinds[K]; createdAt: string };

export function saveInsight<K extends Kind>(i: { unitId: number; kind: K; taskId?: number | null; assignmentId?: number | null; triggers?: string[]; data: Kinds[K]; callId: number | null; at?: number }) {
  const res = db()
    .prepare("INSERT INTO ai_insights (unit_id, kind, task_id, assignment_id, triggers, data, call_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(i.unitId, i.kind, i.taskId ?? null, i.assignmentId ?? null, JSON.stringify(i.triggers ?? []), JSON.stringify(i.data), i.callId, new Date(i.at ?? Date.now()).toISOString());
  return Number(res.lastInsertRowid);
}

type Row = { id: number; unit_id: number; kind: Kind; task_id: number | null; assignment_id: number | null; triggers: string; data: string; created_at: string };
const parse = <K extends Kind>(r: Row): Stored<K> => ({
  id: r.id,
  unitId: r.unit_id,
  kind: r.kind as K,
  taskId: r.task_id,
  assignmentId: r.assignment_id,
  triggers: JSON.parse(r.triggers) as string[],
  data: JSON.parse(r.data) as Kinds[K],
  createdAt: r.created_at,
});

export function latestInsight<K extends Kind>(unitId: number, kind: K): Stored<K> | null {
  const r = db().prepare("SELECT * FROM ai_insights WHERE unit_id = ? AND kind = ? ORDER BY id DESC LIMIT 1").get(unitId, kind) as Row | undefined;
  return r ? parse<K>(r) : null;
}

export function insightsOf(unitId: number): Stored<Kind>[] {
  return (db().prepare("SELECT * FROM ai_insights WHERE unit_id = ? ORDER BY id").all(unitId) as Row[]).map((r) => parse(r));
}

export function hasBlockInsight(assignmentId: number) {
  return Boolean(db().prepare("SELECT 1 FROM ai_insights WHERE kind = 'block' AND assignment_id = ?").get(assignmentId));
}
