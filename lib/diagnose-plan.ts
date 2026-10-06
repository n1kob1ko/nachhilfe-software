import type { Difficulty } from "./curriculum";

/**
 * Planning of a diagnosis without database access, so the start page can recount it live in the
 * browser while the teacher ticks skills (lib/diagnose.ts re-exports it).
 */
export const DIAGNOSE_MIN = 5;
export const DIAGNOSE_MAX = 10;
const RAMP: Difficulty[] = ["leicht", "mittel", "schwer"];
const LEVEL: Record<string, number> = { "sehr leicht": 0, leicht: 1, mittel: 2, schwer: 3, "sehr schwer": 4 };

export type DiagnosisItem = { skillId: string; difficulty: Difficulty };
/**
 * Which task at which difficulty: one per skill with five or more skills (difficulty rotating), with
 * fewer skills several per skill from easy to hard, so a diagnosis always has 5–10 tasks. Easy tasks first.
 */
export function planDiagnosis(skillIds: string[]): DiagnosisItem[] {
  const ids = [...new Set(skillIds)].slice(0, DIAGNOSE_MAX);
  if (!ids.length) return [];
  const per = ids.length >= DIAGNOSE_MIN ? 1 : Math.ceil(DIAGNOSE_MIN / ids.length);
  const items = ids.flatMap((skillId, i) =>
    Array.from({ length: per }, (_, j): DiagnosisItem => ({ skillId, difficulty: per === 1 ? RAMP[i % RAMP.length] : RAMP[Math.round((j * (RAMP.length - 1)) / (per - 1))] })),
  );
  return items.map((it, i) => ({ it, i })).sort((a, b) => LEVEL[a.it.difficulty] - LEVEL[b.it.difficulty] || a.i - b.i).map((x) => x.it);
}
