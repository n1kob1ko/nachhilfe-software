import type { Difficulty, TaskType } from "./curriculum";
import { checkFix, type FixLabel } from "./fix-text";
import type { PartSolution, PartView, ResultForm } from "./math-check";
import { gradeMathTask } from "./math-task";

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
  /** Fehler korrigieren: the described errors ("meinen" → "meinem": Dativ nach „mit“); the corrected text is in `accepted`. */
  fixes?: FixLabel[];
  /** What a good answer must contain (Bewertungskriterien), for the teacher and the print. */
  criteria?: string[];
  /** Rechenweg: unit the result needs ("€", "cm²", "%"). */
  unit?: string | null;
  /** Rechenweg: how the result has to be written (beliebig = every equal form, 1/2 = 0,5 = 50 %). */
  form?: ResultForm | null;
  /** Rechenweg: round the result to this many decimals. */
  round?: number | null;
  /** Rechenweg: false = only the result counts, the working is optional. */
  needWay?: boolean;
  /** Sachaufgabe: the solution of each part, in the order of data.parts. */
  parts?: PartSolution[];
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
  /**
   * steps: order tasks show the steps in this (shuffled) order. faulty: the text with errors of a
   * "Fehler korrigieren" task. lines: size of the answer field of a free answer (1 = one line).
   */
  data: {
    options?: string[];
    passage?: string;
    steps?: string[];
    faulty?: string;
    lines?: number;
    /** Rechenweg: the equation or term the student starts from ("3x + 7 = 22", "3/4 + 1/6"); empty = free calculation. */
    start?: string;
    /** Rechenweg: the unknown of an equation; also without a start (Gleichung aus einem Text aufstellen). */
    variable?: string;
    /** Sachaufgabe: the parts a), b), c) as the student sees them. */
    parts?: PartView[];
  };
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
  /** null = cannot be decided automatically (free text: the teacher grades it). */
  correct: boolean | null;
  errorLabel: string | null;
  feedback: string;
  /** Lückentext: numbers (from 1) of the gaps that are still wrong. */
  wrongGaps?: number[];
  /** Fehler korrigieren, Rechenweg, Sachaufgabe: the Fehlerart the app suggests, if a rule fits. */
  errorType?: string | null;
  /**
   * Rechenweg, Sachaufgabe: what is stored when this answer is the last try: teilweise (half, e.g.
   * 2 of 3 parts or the unit missing) or offen (the teacher grades it).
   */
  onFinal?: "teilweise" | "offen" | null;
};

/** Teacher's grade of an answer the app cannot check (free answers) or that the teacher checks again. */
export const REVIEWS = { richtig: "richtig", teilweise: "teilweise richtig", falsch: "falsch" } as const;
export type Review = keyof typeof REVIEWS;
export const isReview = (x: unknown): x is Review => typeof x === "string" && x in REVIEWS;
/** Formats the teacher grades or may grade again after the app's check. */
export const TEACHER_GRADED = new Set<string>(["free", "fix", "rechenweg", "sachaufgabe"]);

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

export function sameAnswer(given: string, expected: string, mode: AnswerSpec["mode"]) {
  // a number in a gap or a short answer: 0,5 and 0.5 are the same
  if (mode === "value" || (/^\s*-?\d+([.,]\d+)?\s*$/.test(given) && /^\s*-?\d+([.,]\d+)?\s*$/.test(expected))) {
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
  if (task.type === "rechenweg" || task.type === "sachaufgabe") return gradeMathTask(task, given).check;
  if (task.type === "fix" && task.data.faulty !== undefined) {
    const r = checkFix(task.data.faulty, a.accepted ?? [], given, { caseSensitive: a.mode !== "text", labels: a.fixes });
    if (r.correct) return { correct: true, errorLabel: null, feedback: r.total === 1 ? "Richtig verbessert!" : `Alle ${r.total} Fehler richtig verbessert!` };
    const first = r.missed[0];
    const parts = [
      r.total ? `${r.fixed} von ${r.total} ${r.total === 1 ? "Fehler" : "Fehlern"} verbessert.` : "",
      r.extra ? `${r.extra === 1 ? "Eine Stelle, die richtig war, hast" : `${r.extra} Stellen, die richtig waren, hast`} du verändert.` : "",
      !given.trim() ? "Schreib den Text verbessert in das Feld." : r.fixed === r.total && !r.extra ? "Achte auf Satzzeichen sowie Groß- und Kleinschreibung." : "",
    ];
    return { correct: false, errorLabel: first?.label || null, errorType: first?.errorType ?? null, feedback: parts.filter(Boolean).join(" ") };
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
      wrongGaps: correct ? undefined : wrong.map((i) => i + 1),
      errorLabel: correct ? null : labelFor(task, values.join(" | ")) ?? wrong.map((i) => labelFor(task, values[i] ?? "")).find(Boolean) ?? null,
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
