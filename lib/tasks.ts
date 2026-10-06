import type { Difficulty, TaskType } from "./curriculum";

export type AnswerSpec = {
  /** Multiple choice / reading: index of the correct option. */
  correct?: number;
  /** Short answers: accepted solutions. */
  accepted?: string[];
  /** value = numerically equal (fractions, decimals); exact = case sensitive; text = case insensitive. */
  mode?: "value" | "exact" | "text";
  /** Cloze: accepted alternatives per gap (gaps are written as ___ in the prompt). */
  blanks?: string[][];
  /** Free text: sample answer used for grading. */
  sample?: string;
  /** Order tasks: the steps in the right order. */
  steps?: string[];
};

export type TaskDraft = {
  /** Answer format: how the task is answered and checked. */
  type: TaskType;
  /** Main skill; progress is tracked for it and for every id in skillIds. */
  skillId: string | null;
  /** All skills the task trains (includes skillId). */
  skillIds?: string[];
  /** Task type as teachers call it, per subject ("textaufgabe", "fehler" …), see CATEGORIES. */
  category?: string | null;
  difficulty: Difficulty;
  prompt: string;
  /** steps: order tasks show the steps in this (shuffled) order. */
  data: { options?: string[]; passage?: string; steps?: string[] };
  answer: AnswerSpec;
  solution: string;
  hints: string[];
  /** Typical wrong answers and what they reveal (for MC: the option index as string). */
  errorMap: { answer: string; label: string }[];
  /** Lösungsweg as separate steps (AI tasks); the text in `solution` stays the main form. */
  solutionSteps?: string[];
  /** Expected working time in seconds, if known. */
  estimatedTimeSec?: number | null;
  /** Origin: eigen (generators, teacher), ki, oer, lehrplan, demo. Licence data via sourceId (content_sources). */
  sourceType?: string;
  sourceId?: number | null;
};

export type CheckResult = {
  /** null = cannot be decided automatically (free text without AI). */
  correct: boolean | null;
  errorLabel: string | null;
  feedback: string;
};

export const GAP = "___";

/** Parses "3/4", "-1 1/2", "0,75", "2" into a number. */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, " ").replace(/−/g, "-").replace(/:/g, "/");
  if (!s) return null;
  const mixed = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/);
  if (mixed) {
    const [, sign, whole, num, den] = mixed;
    if (Number(den) === 0) return null;
    const v = Number(whole) + Number(num) / Number(den);
    return sign ? -v : v;
  }
  const frac = s.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)$/);
  if (frac) {
    const den = Number(frac[2].replace(",", "."));
    if (den === 0) return null;
    return Number(frac[1].replace(",", ".")) / den;
  }
  const cleaned = s.replace(/\s/g, "").replace(/%$/, "").replace(/€$/, "");
  if (/^-?\d+(?:[.,]\d+)?$/.test(cleaned)) return Number(cleaned.replace(",", "."));
  const eq = s.match(/^[a-z]\s*=\s*(.+)$/i);
  if (eq) return parseNumber(eq[1]);
  return null;
}

export function normalizeText(s: string, caseSensitive = false) {
  let out = s
    .trim()
    .replace(/[„“”"]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/[.!?]+$/, "")
    .trim();
  if (!caseSensitive) out = out.toLowerCase();
  return out;
}

function sameAnswer(given: string, expected: string, mode: AnswerSpec["mode"]) {
  if (mode === "value") {
    const a = parseNumber(given);
    const b = parseNumber(expected);
    if (a !== null && b !== null) return Math.abs(a - b) < 1e-6;
  }
  return normalizeText(given, mode === "exact") === normalizeText(expected, mode === "exact");
}

function labelFor(task: Pick<TaskDraft, "errorMap" | "answer">, given: string) {
  for (const e of task.errorMap) {
    if (sameAnswer(given, e.answer, task.answer.mode)) return e.label;
  }
  return null;
}

/**
 * Checks an answer. `given` is the raw value: option index for MC, text for short answers,
 * a JSON array of strings for cloze tasks.
 */
export function checkAnswer(task: Pick<TaskDraft, "type" | "data" | "answer" | "errorMap">, given: string): CheckResult {
  const a = task.answer;
  if (task.data.options && typeof a.correct === "number") {
    const idx = Number(given);
    const correct = idx === a.correct;
    return {
      correct,
      errorLabel: correct ? null : labelFor(task, String(idx)),
      feedback: correct ? "Richtig!" : "Leider nicht richtig.",
    };
  }
  if (a.steps && task.data.steps) {
    // given: JSON array of indices into data.steps, in the order the student put them
    let order: number[] = [];
    try {
      order = (JSON.parse(given) as unknown[]).map(Number);
    } catch {
      order = [];
    }
    const placed = order.map((i) => task.data.steps![i]);
    const right = a.steps.filter((step, i) => placed[i] === step).length;
    const correct = right === a.steps.length && placed.length === a.steps.length;
    return {
      correct,
      errorLabel: correct ? null : labelFor(task, String(placed.findIndex((p, i) => p !== a.steps![i]) + 1)),
      feedback: correct ? "Richtige Reihenfolge!" : `${right} von ${a.steps.length} Schritten stehen an der richtigen Stelle.`,
    };
  }
  if (a.blanks) {
    let values: string[] = [];
    try {
      values = JSON.parse(given);
    } catch {
      values = [given];
    }
    const wrong = a.blanks
      .map((alts, i) => (alts.some((alt) => sameAnswer(values[i] ?? "", alt, a.mode ?? "text")) ? -1 : i))
      .filter((i) => i >= 0);
    const correct = wrong.length === 0;
    return {
      correct,
      errorLabel: correct ? null : labelFor(task, values.join(" | ")),
      feedback: correct
        ? "Alle Lücken richtig!"
        : `${wrong.length} von ${a.blanks.length} Lücken sind noch falsch (Lücke ${wrong.map((i) => i + 1).join(", ")}).`,
    };
  }
  if (a.accepted && a.accepted.length > 0) {
    const correct = a.accepted.some((exp) => sameAnswer(given, exp, a.mode ?? "text"));
    let feedback = correct ? "Richtig!" : "Leider nicht richtig.";
    if (!correct && a.mode === "value" && parseNumber(given) === null && given.trim()) {
      feedback = "Die Eingabe ist keine Zahl. Schreib z. B. 3/4, 1 1/2 oder 0,75.";
    }
    return { correct, errorLabel: correct ? null : labelFor(task, given), feedback };
  }
  return { correct: null, errorLabel: null, feedback: "Wird bewertet." };
}

export function gapCount(prompt: string) {
  return prompt.split(GAP).length - 1;
}

/** Graded hints: a nudge, the rule, the first step. More than three are just numbered. */
export const HINT_LABELS = ["Denkanstoß", "Regel", "Erster Schritt"];
export const hintLabel = (i: number) => `Hilfe ${i + 1}${HINT_LABELS[i] ? ` · ${HINT_LABELS[i]}` : ""}`;
