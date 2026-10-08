/**
 * The two maths formats as tasks: "rechenweg" (Ergebnis + Rechenweg) and "sachaufgabe" (parts a, b, c).
 * Turns a task and a stored answer into the app's check result and into what the student and the
 * teacher see (each line and each part with its status). The checks themselves are in lib/math-check.ts.
 */
import type { CheckResult, TaskDraft } from "./tasks";
import { evaluate, parseExpr } from "./math-expr";
import { analyzeWay, checkValue, gradeParts, gradeRechenweg, parseResult, readMathAnswer, startVariables, wayContext, wayMode, type MathAnswer, type MathGrade, type PartReport, type PartStatus, type RechenwegSpec, type StepStatus, type ValueVerdict, type WayVerdict } from "./math-check";

type MathTask = Pick<TaskDraft, "type" | "data" | "answer" | "errorMap">;

export type StepView = { line: string; status: StepStatus; note?: string };
export type MathView = {
  steps?: StepView[];
  result?: { given: string; status: ValueVerdict["status"]; feedback: string; fromWay: boolean };
  way?: WayVerdict["status"];
  parts?: { status: PartStatus; feedback: string; given: string; text?: string; steps?: StepView[]; way?: WayVerdict["status"] }[];
};

const partName = (label: string, i: number) => label || `${String.fromCharCode(97 + i)})`;

/** The unknown of an equation task ("x"); null for terms and plain calculations. */
export function unknownOf(t: Pick<TaskDraft, "data">): string | null {
  return wayMode(t.data.start, t.data.variable) === "gleichung" ? t.data.variable || startVariables(t.data.start)[0] || "x" : null;
}

/** The result in one line as the teacher reads it: "x = 5", "72 €", "a) 72 €   b) 408 €   c) (in Worten)". */
export function mathAnswerText(t: Pick<TaskDraft, "type" | "data" | "answer">): string | null {
  if (t.type === "sachaufgabe") {
    const parts = t.data.parts ?? [];
    return parts.length ? parts.map((p, i) => `${partName(p.label, i)} ${p.kind === "text" ? "(in Worten)" : (t.answer.parts?.[i]?.accepted?.[0] ?? "–")}`).join("   ") : null;
  }
  const first = t.answer.accepted?.[0]?.trim();
  if (!first) return null;
  const unit = t.answer.unit && !first.includes(t.answer.unit) ? ` ${t.answer.unit}` : "";
  const x = unknownOf(t);
  return `${x && !first.includes("=") ? `${x} = ` : ""}${first}${unit}`;
}

export function rechenwegSpec(t: MathTask): RechenwegSpec {
  return {
    start: t.data.start ?? null,
    variable: t.data.variable ?? null,
    accepted: t.answer.accepted ?? [],
    unit: t.answer.unit ?? null,
    form: t.answer.form ?? null,
    round: t.answer.round ?? null,
    needWay: t.answer.needWay,
    errorMap: t.errorMap,
  };
}

const steps = (w: WayVerdict | undefined): StepView[] | undefined => w?.steps.map((s) => ({ line: s.line, status: s.status, note: s.note }));

function toCheck(g: MathGrade): CheckResult {
  const correct = g.outcome === "richtig" ? true : g.outcome === "offen" ? null : false;
  return {
    correct,
    feedback: g.feedback,
    errorLabel: correct ? null : g.errorLabel,
    errorType: correct ? null : g.errorType,
    onFinal: g.onFinal === "teilweise" || g.onFinal === "offen" ? g.onFinal : null,
  };
}

/** Check result, view and the full report of a maths answer (raw: the stored JSON). */
export function gradeMathTask(t: MathTask, raw: string): { check: CheckResult; view: MathView; answer: MathAnswer; parts?: PartReport[] } {
  const answer = readMathAnswer(raw);
  if (t.type === "sachaufgabe") {
    const { parts, grade } = gradeParts(t.data.parts ?? [], t.answer.parts ?? [], answer);
    return {
      check: toCheck(grade),
      view: {
        parts: parts.map((p, i) => ({ status: p.status, feedback: p.feedback, given: p.given, text: (t.data.parts ?? [])[i]?.kind === "text" ? p.given : undefined, steps: steps(p.way), way: p.way?.status })),
      },
      answer,
      parts,
    };
  }
  const r = gradeRechenweg(rechenwegSpec(t), answer);
  return {
    check: toCheck(r.grade),
    view: { steps: steps(r.way), result: { given: r.result.given, status: r.result.status, feedback: r.result.feedback, fromWay: r.result.fromWay }, way: r.way.status },
    answer,
  };
}

/**
 * What is missing or does not fit in a maths task the teacher (or the AI) wrote; null when it is fine.
 * The sample working must pass the app's own check, so the teacher sees at once if it would not.
 */
export function checkOwnSolution(t: MathTask & Pick<TaskDraft, "solutionSteps">): string | null {
  if (t.type === "sachaufgabe") return checkParts(t);
  if (t.type !== "rechenweg") return null;
  const spec = rechenwegSpec(t);
  const accepted = spec.accepted.map((a) => a.trim()).filter(Boolean);
  if (!accepted.length) return "Das richtige Ergebnis fehlt.";
  const ctx = wayContext({ ...spec, accepted });
  if (ctx.mode === "gleichung") {
    if (startVariables(spec.start).length > 1) return "Die App prüft Gleichungen mit einer Unbekannten. Nimm eine Gleichung mit nur einem Buchstaben.";
    if (!ctx.solutions?.length) return "Die Lösung der Gleichung ist keine Zahl, die die App lesen kann (z. B. 5, -2, 3/4 oder 2; 3).";
    if (spec.start?.trim() && analyzeWay([spec.start], ctx).steps[0]?.status !== "ok") return "Die Lösung erfüllt die Gleichung nicht.";
  } else if (ctx.mode === "term") {
    const v = analyzeWay([accepted[0]], ctx).steps[0];
    if (v?.status === "unklar") return "Die Angabe oder das Ergebnis kann die App nicht lesen.";
    if (v?.status !== "ok") return "Das Ergebnis passt nicht zur Angabe.";
  } else if (accepted.some((a) => checkValue(a, { accepted: [a] }).status !== "richtig")) return "Das Ergebnis kann die App nicht lesen (z. B. 72 €, 3/4, 15 %).";
  const lines = (t.solutionSteps ?? []).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const r = gradeRechenweg(spec, { steps: lines });
  if (r.way.firstError !== null) return `Im Lösungsweg passt Zeile ${r.way.firstError + 1} nicht zur Aufgabe („${r.way.steps[r.way.firstError].line}“).`;
  return null;
}

function checkParts(t: MathTask): string | null {
  const views = t.data.parts ?? [];
  const sols = t.answer.parts ?? [];
  if (views.length < 1) return "Die Sachaufgabe braucht mindestens eine Teilfrage.";
  const values: Record<string, number> = {};
  for (const [i, v] of views.entries()) {
    const name = v.label || `${String.fromCharCode(97 + i)})`;
    if (!v.prompt.trim()) return `Teilfrage ${name}: die Frage fehlt.`;
    const sol = sols[i] ?? {};
    const letter = (v.label.match(/[a-z]/i)?.[0] ?? String.fromCharCode(97 + i)).toLowerCase();
    if (v.kind === "text") {
      if (!sol.sample?.trim() && !sol.criteria?.some((c) => c.trim())) return `Teilfrage ${name}: Musterantwort oder Erwartung fehlt.`;
      continue;
    }
    const accepted = (sol.accepted ?? []).map((a) => a.trim()).filter(Boolean);
    if (!accepted.length) return `Teilfrage ${name}: das richtige Ergebnis fehlt.`;
    if (checkValue(accepted[0], { accepted, unit: sol.unit }).status !== "richtig") return `Teilfrage ${name}: das Ergebnis kann die App nicht lesen (z. B. 72 €, 3/4, 15 %).`;
    if (sol.follow?.trim()) {
      const f = parseExpr(sol.follow, { vars: Object.keys(values) });
      const val = f ? evaluate(f, values) : NaN;
      if (!f || !Number.isFinite(val)) return `Teilfrage ${name}: die Rechnung für Folgefehler („${sol.follow}“) kann die App nicht lesen. Verwende die Buchstaben der Teilfragen davor, z. B. 480 - a.`;
      if (checkValue(String(Math.round(val * 1e9) / 1e9).replace(".", ","), { accepted, round: 2 }).status === "falsch") return `Teilfrage ${name}: die Rechnung für Folgefehler ergibt nicht das richtige Ergebnis.`;
    }
    const parsed = parseResult(accepted[0]);
    if (parsed?.length === 1) values[letter] = parsed[0].percent && sol.unit !== "%" ? parsed[0].value / 100 : parsed[0].value;
  }
  return null;
}
