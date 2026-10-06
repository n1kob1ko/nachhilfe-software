/**
 * Lernstand (mastery) of one skill — the single place where it is calculated.
 * No AI involved; every number below is a deliberate, documented choice (docs/lernstand.md).
 *
 * 1. Every finished task becomes one piece of evidence with a SCORE between 0 and 1:
 *      correct at the first try, no hint ............ 1.0
 *      correct at the second try .................... 0.7
 *      correct at the third try or later ............ 0.5
 *      each hint opened ............................. −0.15 (a correct answer never drops below 0.35)
 *      wrong in the end, or solution looked at ...... 0
 *    A documented tutoring lesson counts with the teacher's rating (1–5 → 0…1),
 *    a Schularbeit/Test with its points or grade.
 *
 * 2. Every piece of evidence has a WEIGHT:
 *      task: by difficulty 1–5 → 0.6 / 0.8 / 1.0 / 1.25 / 1.5  (a hard task says more than an easy one)
 *      lesson rating: 1.5      test result: 2
 *    and the weight halves every 45 days (RECENCY): last week's answers count far more than last term's.
 *
 * 3. Lernstand = weighted average of all scores, plus one neutral "virtual task" at 50 %,
 *    so a single lucky answer never shows 100 % (one correct task → 75 %).
 *
 * 4. Working time is NOT part of the score: slow can mean careful. It is shown separately.
 *
 * 5. Status words: ≥ 85 % sicher · ≥ 70 % gut · ≥ 50 % üben · below kritisch · no evidence: nicht getestet.
 *    With fewer than 3 finished tasks the status gets "(wenig Daten)".
 */

export type EvidenceSource = "aufgabe" | "stunde" | "test";
export type Evidence = { skillId: string; score: number; weight: number; at: number; source: EvidenceSource };

const DAY = 86_400_000;
export const HALF_LIFE_DAYS = 45;
export const PRIOR = { score: 0.5, weight: 1 };
export const LEVEL_WEIGHT: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1, 4: 1.25, 5: 1.5 };
export const SOURCE_WEIGHT: Record<EvidenceSource, number> = { aufgabe: 1, stunde: 1.5, test: 2 };

/** Score of one finished task (see 1. above). */
export function taskScore(final: { correct: number | boolean; attempt_no: number; hints_used: number; solution_viewed: number | boolean }) {
  if (final.solution_viewed || !final.correct) return 0;
  const base = final.attempt_no <= 1 ? 1 : final.attempt_no === 2 ? 0.7 : 0.5;
  return Math.max(0.35, base - 0.15 * final.hints_used);
}

/** Weight of a task by its difficulty 1–5 (unknown = 3). */
export const levelWeight = (level: number | null | undefined) => LEVEL_WEIGHT[Math.round(level ?? 3)] ?? 1;

/** Lernstand at time `at` from all evidence up to then (see 2. and 3. above); null without evidence. */
export function masteryAt(items: Evidence[], at: number): number | null {
  const relevant = items.filter((e) => e.at <= at);
  if (relevant.length === 0) return null;
  let num = PRIOR.score * PRIOR.weight;
  let den = PRIOR.weight;
  for (const e of relevant) {
    const w = e.weight * Math.pow(0.5, Math.max(0, at - e.at) / DAY / HALF_LIFE_DAYS);
    num += w * e.score;
    den += w;
  }
  return num / den;
}

export type MasteryStatus = "sicher" | "gut" | "üben" | "kritisch" | "nicht getestet";
export const STATUS_THRESHOLDS = { sicher: 0.85, gut: 0.7, ueben: 0.5 };

export function masteryStatus(m: number | null): MasteryStatus {
  if (m === null) return "nicht getestet";
  if (m >= STATUS_THRESHOLDS.sicher) return "sicher";
  if (m >= STATUS_THRESHOLDS.gut) return "gut";
  if (m >= STATUS_THRESHOLDS.ueben) return "üben";
  return "kritisch";
}

/** Status tone for chips: green, neutral, amber, red. */
export const statusTone = (s: MasteryStatus) => (s === "sicher" ? "green" : s === "gut" ? "neutral" : s === "üben" ? "amber" : s === "kritisch" ? "red" : "neutral") as "green" | "neutral" | "amber" | "red";
