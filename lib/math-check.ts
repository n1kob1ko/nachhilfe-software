/**
 * Checks of mathematical answers: an Ergebnis (number, fraction, percentage, with unit, several
 * solutions), a Rechenweg (line by line) and multi-part Sachaufgaben. Everything is deterministic and
 * uses lib/math-expr.ts, which only evaluates the expressions it can read. When the app cannot decide
 * safely, the answer goes to the teacher ("offen") instead of being counted as wrong.
 *
 * How a Rechenweg is checked (no fixed method is expected, so every correct way passes):
 * - Gleichung (the task starts from an equation): every line must still have the solutions of the
 *   task, i.e. it is an equivalent transformation. 3x + 7 = 22 → 3x = 15 → x = 5 holds for x = 5.
 * - Term (the task starts from an expression): every line must have the same value as the start
 *   (with variables: at several sample points), e.g. 3/4 + 1/6 = 9/12 + 2/12 = 11/12.
 * - Rechnung (no start, e.g. a part of a Sachaufgabe): each line with "=" must be right in itself,
 *   e.g. 480 · 15 % = 72; a line starting with "=" continues the previous one.
 * Lines with words only are notes; inequalities and anything unreadable are "unklar".
 */
import { approxEqual, evaluate, hasDivision, normalizeMath, parseExpr, splitUnit, stripUnits, summands, sumOf, varsOf, type Node, type Unit, unitOf } from "./math-expr";

// ---------- results ----------
export const RESULT_FORMS = {
  beliebig: "jede gleichwertige Form",
  bruch: "als Bruch",
  gekuerzt: "als gekürzter Bruch",
  dezimal: "als Dezimalzahl",
  prozent: "in Prozent",
} as const;
export type ResultForm = keyof typeof RESULT_FORMS;
export const isResultForm = (x: unknown): x is ResultForm => typeof x === "string" && x in RESULT_FORMS;

export type ValueSpec = {
  /** Right results; each may hold several solutions ("2; 3") and a unit ("72 €"). */
  accepted: string[];
  /** Unit the result needs ("€", "cm²", "%"); else the unit of the accepted result, if it has one. */
  unit?: string | null;
  form?: ResultForm | null;
  /** Round to this many decimals. */
  round?: number | null;
  /** Letters that are variables (term results such as "x + 6"). */
  vars?: string[];
};

export type Issue = "einheit" | "einheit_falsch" | "kuerzen" | "form" | "rundung" | "anzahl" | "unlesbar" | "anders";
export type ValueVerdict = {
  status: "richtig" | "teilweise" | "falsch" | "unklar";
  issue?: Issue;
  feedback: string;
  label?: string | null;
  errorType?: string | null;
};

type Item = { value: number; unit: Unit | null; percent: boolean; form: "ganz" | "dezimal" | "bruch" | "gemischt" | "term"; reduced: boolean; decimals: number };

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

function parseItem(raw: string): Item | null {
  let s = normalizeMath(raw).replace(/^[a-zA-Z](?:_?\d|[₁₂₃])?\s*=\s*/, "").trim();
  if (!s) return null;
  let percent = false;
  if (/%$/.test(s)) {
    percent = true;
    s = s.replace(/\s*%$/, "");
  }
  const { value, unit } = percent ? { value: s, unit: null } : splitUnit(s);
  const v = value.trim();
  const mixed = v.match(/^(-?)(\d+) (\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const [, sign, whole, num, den] = mixed;
    if (Number(den) === 0) return null;
    const val = Number(whole) + Number(num) / Number(den);
    return { value: sign ? -val : val, unit, percent, form: "gemischt", reduced: gcd(Number(num), Number(den)) === 1 && Number(num) < Number(den), decimals: 0 };
  }
  const node = parseExpr(v);
  if (!node) return null;
  const val = evaluate(node);
  if (!Number.isFinite(val)) return null;
  const frac = v.match(/^\(?(-?\d+)\)?\s*[/:]\s*\(?(-?\d+)\)?$/) ?? v.match(/^-(\d+)\/(\d+)$/);
  const form: Item["form"] = /^-?\d+$/.test(v) || /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(v) ? "ganz" : /^-?\d+[.,]\d+$/.test(v) ? "dezimal" : frac ? "bruch" : "term";
  const reduced = form === "bruch" ? gcd(Number(frac![1]), Number(frac![2])) === 1 && Math.abs(Number(frac![2])) !== 1 : true;
  const decimals = form === "dezimal" ? (v.split(/[.,]/)[1]?.length ?? 0) : 0;
  return { value: val, unit, percent, form, reduced, decimals };
}

/** "x = 2 oder x = 3", "L = {2; 3}", "x₁ = 2, x₂ = 3" → the single solutions. */
function splitItems(raw: string): string[] {
  const s = raw.trim().replace(/^L\s*=\s*/i, "").replace(/^\{(.*)\}$/, "$1");
  return s
    .split(/\s*(?:;|\||\boder\b|\bund\b|,\s+)\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseResult(raw: string): Item[] | null {
  const items = splitItems(raw);
  if (!items.length) return null;
  const out = items.map(parseItem);
  return out.every(Boolean) ? (out as Item[]) : null;
}

const pow10 = (n: number) => Math.pow(10, n);
const decimalsOf = (x: number) => {
  const s = String(Math.abs(x));
  return s.includes(".") ? s.split(".")[1].length : 0;
};

function nearlyEqual(g: number, e: number, tol: number) {
  return approxEqual(g, e) || Math.abs(g - e) <= tol + 1e-12;
}

/** Same digits in another order (34 ↔ 43) or one digit off in a number with three digits or more. */
function digitSlip(g: number, e: number) {
  if (Math.sign(g) !== Math.sign(e)) return false;
  const d = (x: number) => String(Math.abs(x)).replace(".", "").replace(/^0+/, "");
  const [a, b] = [d(g), d(e)];
  if (a.length !== b.length || a === b || a.length < 2) return false;
  if ([...a].sort().join() === [...b].sort().join()) return true;
  return a.length >= 3 && [...a].filter((c, i) => c !== b[i]).length === 1;
}

/** Kind of error of a wrong number from the number alone; null when no rule fits. */
function numberKind(g: number, e: number, percent: boolean): string | null {
  if (e !== 0 && approxEqual(g, -e)) return "vorzeichen";
  if (percent && e !== 0 && [100, 0.01].some((r) => approxEqual(g / e, r))) return "prozent";
  return digitSlip(g, e) ? "rechenfehler" : null;
}

const FORM_TEXT: Record<ResultForm, string> = { beliebig: "", bruch: "als Bruch", gekuerzt: "als gekürzten Bruch", dezimal: "als Dezimalzahl", prozent: "in Prozent" };

function compareItems(given: Item[], expected: Item[], spec: ValueSpec): ValueVerdict {
  const unitSpec = spec.unit?.trim() || "";
  const expPercent = unitSpec === "%" || spec.form === "prozent" || expected.every((i) => i.percent);
  // counted words ("12 Jahre", "8 Kinder") are no units: never needed, never wrong
  const unitRaw = unitSpec && unitSpec !== "%" ? unitOf(unitSpec) : (expected.find((i) => i.unit)?.unit ?? null);
  const expUnit = unitRaw?.dim === "wort" ? null : unitRaw;
  let unitMissing = false;
  let unitWrong = false;
  let percentMissing = false;
  let asDecimal = false;
  // the given numbers in the unit of the expected result
  const cands = given.map((g) => {
    let base = g.value;
    const unit = g.unit?.dim === "wort" ? null : g.unit;
    if (expUnit) {
      if (!unit) unitMissing = true;
      else if (unit.dim !== expUnit.dim) unitWrong = true;
      else base = (base * unit.factor) / expUnit.factor;
    }
    // a rounded decimal ("0,92" for 11/12) is right when it is rounded correctly, unless the task says how to round
    const r = spec.round == null && g.form === "dezimal" && g.decimals >= 2 ? 0.5 * pow10(-g.decimals) : 0;
    if (expPercent) return g.percent ? [{ v: base, how: "", r }] : [{ v: base, how: "ohne%", r }, { v: base * 100, how: "dezimal", r: r * 100 }];
    return [{ v: g.percent ? base / 100 : base, how: "", r: g.percent ? r / 100 : r }];
  });
  const tolFor = (e: Item) => (spec.round != null ? 0.5 * pow10(-spec.round) : e.decimals > 0 ? 0.5 * pow10(-e.decimals) : 0);
  const used = new Set<number>();
  let matched = 0;
  let rounding = false;
  for (const e of expected) {
    const fits = (c: { v: number; r: number }) => nearlyEqual(c.v, e.value, Math.max(tolFor(e), c.r));
    const k = cands.findIndex((list, i) => !used.has(i) && list.some(fits));
    if (k >= 0) {
      used.add(k);
      matched++;
      const how = cands[k].find(fits)!.how;
      if (how === "ohne%") percentMissing = true;
      if (how === "dezimal") asDecimal = true;
    } else if (spec.round != null && cands.some((list) => list.some((c) => Math.abs(c.v - e.value) < 1.5 * pow10(-spec.round!)))) rounding = true;
  }
  const allMatched = matched === expected.length && given.length === expected.length;
  if (!allMatched) {
    if (matched === given.length && given.length < expected.length)
      return { status: "falsch", issue: "anzahl", feedback: expected.length - given.length === 1 ? "Es gibt noch eine weitere Lösung." : "Es gibt noch weitere Lösungen.", label: "Lösung vergessen", errorType: null };
    if (rounding) return { status: "falsch", issue: "rundung", feedback: `Fast: achte aufs Runden (auf ${spec.round} ${spec.round === 1 ? "Stelle" : "Stellen"} nach dem Komma).`, label: "Rundungsfehler", errorType: "rechenfehler" };
    if (unitWrong) return { status: "falsch", issue: "einheit_falsch", feedback: "Die Einheit passt nicht.", label: "Falsche Einheit", errorType: "einheit" };
    const g = cands[0]?.[0]?.v;
    const kind = given.length === 1 && expected.length === 1 && g !== undefined ? numberKind(g, expected[0].value, expPercent || given[0].percent) : null;
    return { status: "falsch", feedback: "Das Ergebnis stimmt nicht.", label: null, errorType: kind };
  }
  if (unitWrong) return { status: "falsch", issue: "einheit_falsch", feedback: "Die Einheit passt nicht.", label: "Falsche Einheit", errorType: "einheit" };
  if (unitMissing) return { status: "teilweise", issue: "einheit", feedback: "Die Zahl stimmt, aber die Einheit fehlt.", label: "Einheit vergessen", errorType: "einheit" };
  const form = spec.form ?? "beliebig";
  if (form === "prozent" && (percentMissing || asDecimal)) return { status: "teilweise", issue: "form", feedback: "Der Wert stimmt. Gib das Ergebnis in Prozent an (mit %).", label: "Nicht in Prozent angegeben", errorType: null };
  if (percentMissing && unitSpec === "%") return { status: "teilweise", issue: "einheit", feedback: "Die Zahl stimmt, aber das %-Zeichen fehlt.", label: "Einheit vergessen", errorType: "einheit" };
  if (form === "bruch" || form === "gekuerzt") {
    if (given.some((g) => g.form === "dezimal" || g.percent || g.form === "term")) return { status: "teilweise", issue: "form", feedback: `Der Wert stimmt. Schreib das Ergebnis ${FORM_TEXT[form]}.`, label: "Nicht als Bruch angegeben", errorType: null };
    if (form === "gekuerzt" && given.some((g) => !g.reduced)) return { status: "teilweise", issue: "kuerzen", feedback: "Der Wert stimmt. Kürze das Ergebnis noch vollständig.", label: "Ergebnis nicht gekürzt", errorType: "bruch" };
  }
  if (form === "dezimal" && given.some((g) => g.form === "bruch" || g.form === "gemischt" || g.percent)) return { status: "teilweise", issue: "form", feedback: "Der Wert stimmt. Schreib das Ergebnis als Dezimalzahl.", label: "Nicht als Dezimalzahl angegeben", errorType: null };
  return { status: "richtig", feedback: "Richtig!" };
}

/** Canonical text of an expression, so that "x + 6", "6+x" and "x+6" count as written the same. */
function canon(n: Node): string {
  switch (n.k) {
    case "num":
      return String(Math.round(n.v * 1e9) / 1e9);
    case "var":
      return n.name;
    case "neg":
      return `-(${canon(n.a)})`;
    case "add":
    case "sub":
      return summands(n)
        .map((s) => `${s.sign < 0 ? "-" : "+"}${canon(s.node)}`)
        .sort()
        .join("");
    case "mul": {
      const [a, b] = [canon(n.a), canon(n.b)].sort();
      return `${a}*${b}`;
    }
    case "div":
      return `(${canon(n.a)})/(${canon(n.b)})`;
    case "pow":
      return `(${canon(n.a)})^(${canon(n.b)})`;
    case "root":
      return `√(${canon(n.a)})`;
    case "pct":
      return `(${canon(n.a)})%`;
  }
}

const SAMPLE = [1.37, -2.11, 0.53, 3.19];
/** Values at sample points for every variable; points where the expression is undefined are skipped. */
function samples(vars: string[]): Record<string, number>[] {
  return SAMPLE.map((base, i) => Object.fromEntries(vars.map((v, j) => [v, base + j * 0.71 + i * 0.13])));
}
function sameFunction(a: Node, b: Node, vars: string[]): boolean | null {
  let checked = 0;
  for (const env of samples(vars)) {
    const [x, y] = [evaluate(a, env), evaluate(b, env)];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!approxEqual(x, y)) return false;
    checked++;
  }
  return checked >= 2 ? true : null;
}

/** A result with variables ("x + 6"): same written form as an accepted one, or equivalent (the teacher decides). */
function checkTermResult(given: string, spec: ValueSpec): ValueVerdict {
  const vars = spec.vars ?? [];
  const g = parseExpr(given, { vars });
  if (!g) return { status: "unklar", issue: "unlesbar", feedback: "Ich kann dein Ergebnis nicht lesen." };
  let equivalent = false;
  for (const a of spec.accepted) {
    const e = parseExpr(a, { vars });
    if (!e) continue;
    const same = sameFunction(g, e, vars);
    if (same && canon(g) === canon(e)) return { status: "richtig", feedback: "Richtig!" };
    if (same) equivalent = true;
  }
  if (equivalent) return { status: "unklar", issue: "anders", feedback: "Dein Ergebnis ist gleichwertig, aber anders geschrieben als erwartet." };
  return { status: "falsch", feedback: "Das Ergebnis stimmt nicht.", label: null, errorType: null };
}

/** Checks an Ergebnis against the accepted results; the best match counts. */
export function checkValue(given: string, spec: ValueSpec): ValueVerdict {
  if (!given.trim()) return { status: "falsch", feedback: "Schreib dein Ergebnis in das Feld.", label: null };
  if (spec.vars?.length) {
    // a term with variables, unless the result is a plain number
    const isNumber = parseResult(given);
    if (!isNumber || !spec.accepted.every((a) => parseResult(a))) return checkTermResult(given, spec);
  }
  const g = parseResult(given);
  if (!g) return { status: "unklar", issue: "unlesbar", feedback: "Ich kann dein Ergebnis nicht sicher lesen." };
  const rank = { richtig: 3, teilweise: 2, falsch: 1, unklar: 0 } as const;
  let best: ValueVerdict | null = null;
  for (const a of spec.accepted) {
    const e = parseResult(a);
    if (!e) continue;
    const v = compareItems(g, e, spec);
    if (!best || rank[v.status] > rank[best.status]) best = v;
  }
  return best ?? { status: "unklar", issue: "unlesbar", feedback: "Für diese Aufgabe ist keine prüfbare Lösung hinterlegt." };
}

// ---------- Rechenweg ----------
export type WayMode = "gleichung" | "term" | "rechnung";
export type StepStatus = "ok" | "fehler" | "folge" | "unklar" | "notiz";
export type StepVerdict = { line: string; status: StepStatus; note?: string };
export type WayVerdict = {
  status: "richtig" | "teilweise" | "fehlerhaft" | "unklar" | "fehlt";
  steps: StepVerdict[];
  /** Index (from 0) of the first wrong line. */
  firstError: number | null;
  errorType: string | null;
  errorLabel: string | null;
};
export type WayContext = { mode: WayMode; start?: string | null; variable?: string | null; solutions?: number[] };

export const WAY_STATUS: Record<WayVerdict["status"], string> = {
  richtig: "Rechenweg richtig",
  teilweise: "Rechenweg teilweise richtig",
  fehlerhaft: "Rechenweg fehlerhaft",
  unklar: "Rechenweg nicht sicher prüfbar",
  fehlt: "kein Rechenweg",
};

/** The mode of a task: an equation to solve, a term to calculate or simplify, or free calculations. */
export function wayMode(start: string | null | undefined, variable?: string | null): WayMode {
  // an unknown without a start: the student sets up the equation from a text himself
  if (!start?.trim()) return variable?.trim() ? "gleichung" : "rechnung";
  return start.includes("=") ? "gleichung" : "term";
}

const WORDS = /[\p{L}]{3,}/u;
type Prepared = { kind: "math"; segs: string[]; continues: boolean; tol: number } | { kind: "notiz" } | { kind: "unklar"; note: string };

function prepare(raw: string, vars: string[]): Prepared {
  let s = raw.trim();
  s = s.replace(/^(?:[a-e]\)|⇒|=>|→|⇔|<=>|\d+\.\s)\s*/, "");
  // "3x + 7 = 22 | −7": the note after | names the step, it is not part of the line
  if (s.includes("|") && s.indexOf("=") >= 0 && s.indexOf("=") < s.indexOf("|")) s = s.slice(0, s.indexOf("|")).trim();
  // "Rabatt: 480 · 15 %" – a label before a colon; Dreisatz "1 % ≙ 4,80 €" – only the right side is calculated
  s = s.replace(/^[\p{L}][\p{L} ]{2,}:\s*/u, "");
  s = s.replace(/^.*≙\s*/, "");
  s = s.replace(/%\s*von\s*/g, "% · ");
  if (/[<>≤≥≠]/.test(s)) return { kind: "unklar", note: "Ungleichungen prüft die App nicht." };
  s = stripUnits(s, vars);
  // rounded numbers: "≈ 0,92", or decimals with 2 and more places ("0,1667") may differ by their rounding
  const approx = [...s.matchAll(/≈\s*-?\d+[.,](\d+)/g)].map((m) => 0.5 * Math.pow(10, -m[1].length));
  const rounded = [...normalizeMath(s.replace(/≈[^=≈]*/g, "")).matchAll(/\d[.,](\d{2,})/g)].reduce((sum, m) => sum + 0.5 * Math.pow(10, -m[1].length), 0);
  const tol = Math.max(rounded, ...approx, 0);
  s = s.replace(/≈/g, "=");
  const parts = s.split("=").map((x) => x.trim());
  const continues = parts.length > 1 && parts[0] === "";
  let segs = continues ? parts.slice(1) : parts;
  // a name before the first "=": "Rabatt = 480 · 0,15", "R = 72" (one letter that is no variable of the task)
  if (segs.length > 1 && (WORDS.test(segs[0].replace(/\b(sqrt|wurzel|von)\b/gi, "")) || (/^\p{L}$/u.test(segs[0]) && !vars.includes(segs[0])))) segs = segs.slice(1);
  // Dreisatz in a calculation without unknowns: "1 % = 480 : 100 = 4,8", "100 % = 480" – the share before the first = names the line
  if (!vars.length && segs.length > 1 && /^\d+(?:[.,]\d+)?\s*%$/.test(segs[0])) segs = segs.slice(1);
  if (!segs.length || segs.every((x) => !x)) return { kind: "notiz" };
  if (segs.some((x) => !x)) return { kind: "unklar", note: "Ein Teil der Zeile fehlt." };
  if (segs.some((x) => WORDS.test(x.replace(/\b(sqrt|wurzel)\b/gi, "")))) return segs.length === 1 ? { kind: "notiz" } : { kind: "unklar", note: "Text in der Rechnung." };
  return { kind: "math", segs, continues, tol };
}

/** Value sets of a line: one value per segment and per point (solution or sample point). */
function lineValues(nodes: Node[], envs: Record<string, number>[]) {
  return envs.map((env) => nodes.map((n) => evaluate(n, env)));
}
/** Equal, or within the rounding of the numbers written in the line. */
const near = (a: number, b: number, tol: number) => approxEqual(a, b) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * (1 + 1e-9));

/** One root of seg0 = seg1 when the line is linear in the variable, else null. */
function linearRoot(a: Node, b: Node, x: string): number | null {
  for (const pts of [[0, 1, 2], [1, 2, 3], [-1, 1, 3]]) {
    const f = pts.map((p) => evaluate(a, { [x]: p }) - evaluate(b, { [x]: p }));
    if (!f.every(Number.isFinite)) continue;
    const slope = (f[1] - f[0]) / (pts[1] - pts[0]);
    const slope2 = (f[2] - f[1]) / (pts[2] - pts[1]);
    if (!approxEqual(slope, slope2) || approxEqual(slope, 0)) return null;
    return pts[0] - f[0] / slope;
  }
  return null;
}

/** Does flipping the sign of one summand make the line right? Then it is a Vorzeichenfehler. */
function signSlip(nodes: Node[], holds: (nodes: Node[]) => boolean): boolean {
  for (let k = 0; k < nodes.length; k++) {
    const terms = summands(nodes[k]);
    for (let i = 0; i < terms.length; i++) {
      const flipped = terms.map((t, j) => (j === i ? { ...t, sign: -t.sign } : t));
      const next = nodes.map((n, j) => (j === k ? sumOf(flipped) : n));
      if (holds(next)) return true;
    }
  }
  return false;
}

const LABEL: Record<string, string> = {
  vorzeichen: "Vorzeichenfehler",
  umformung: "Falsche Umformung der Gleichung",
  bruch: "Fehler beim Bruchrechnen",
  rechenfehler: "Rechenfehler",
  prozent: "Prozentrechnung falsch angewendet",
};

/** Checks the lines of a Rechenweg (see the comment at the top). */
export function analyzeWay(lines: string[], ctx: WayContext): WayVerdict {
  const steps: StepVerdict[] = [];
  const list = lines.map((l) => l.trim()).filter(Boolean);
  const x = ctx.mode === "gleichung" ? (ctx.variable || "x") : null;
  const startNode = ctx.mode === "term" && ctx.start ? parseExpr(stripUnits(ctx.start), { vars: [...letters(ctx.start)] }) : null;
  const vars = ctx.mode === "gleichung" ? [x!] : startNode ? [...varsOf(startNode)] : [];
  const envs = ctx.mode === "gleichung" ? (ctx.solutions ?? []).map((s) => ({ [x!]: s })) : samples(vars).slice(0, vars.length ? 4 : 1);
  const startValues = startNode ? envs.map((env) => evaluate(startNode, env)) : [];
  let firstError: number | null = null;
  let errorType: string | null = null;
  // after an error: what the following lines are checked against (Folgefehler)
  let wrongEnvs: Record<string, number>[] | null = null;
  let wrongValues: number[] | null = null;
  let last: number | null = null;
  const startCanon = ctx.start ? normalizeMath(ctx.start).replace(/\s/g, "") : "";

  for (const line of list) {
    const p = prepare(line, vars);
    if (p.kind !== "math") {
      steps.push({ line, status: p.kind, note: p.kind === "unklar" ? p.note : undefined });
      continue;
    }
    const nodes = p.segs.map((sgm) => parseExpr(sgm, { vars }));
    if (nodes.some((n) => !n)) {
      steps.push({ line, status: "unklar", note: "Nicht lesbar." });
      continue;
    }
    const ns = nodes as Node[];
    const allEqual = (vals: number[]) => vals.every((v) => near(v, vals[0], p.tol));
    let ok: boolean;
    let folge = false;
    let numericSlip = false;
    if (ctx.mode === "gleichung") {
      const hasVar = ns.some((n) => varsOf(n).size > 0);
      if (ns.length < 2) {
        steps.push({ line, status: hasVar ? "unklar" : "notiz", note: hasVar ? "Eine Gleichung braucht ein =." : undefined });
        continue;
      }
      if (!envs.length) {
        steps.push({ line, status: "unklar", note: "Keine Lösung hinterlegt." });
        continue;
      }
      const holdsAt = (list: Node[], at: Record<string, number>[]) => lineValues(list, at).every(allEqual);
      ok = hasVar ? holdsAt(ns, envs) : allEqual(ns.map((n) => evaluate(n, {})));
      if (!ok && wrongEnvs && hasVar) folge = holdsAt(ns, wrongEnvs);
      if (!ok && !folge && firstError === null) {
        // a side calculation inside the line that is wrong: 3x = 22 − 7 = 16
        numericSlip = ns.some((n, i) => i > 0 && varsOf(n).size === 0 && varsOf(ns[i - 1]).size === 0 && !near(evaluate(n, {}), evaluate(ns[i - 1], {}), p.tol));
        errorType = numericSlip ? "rechenfehler" : signSlip(ns, (l) => holdsAt(l, envs)) ? "vorzeichen" : "umformung";
        const root = linearRoot(ns[0], ns[1], x!);
        wrongEnvs = root === null ? null : [{ [x!]: root }];
      }
    } else if (ctx.mode === "term") {
      if (!startNode) {
        steps.push({ line, status: "unklar", note: "Die Angabe ist nicht lesbar." });
        continue;
      }
      const vals = lineValues(ns, envs);
      ok = vals.every((row, i) => row.every((v) => near(v, startValues[i], p.tol)));
      if (!ok && wrongValues) folge = vals.every((row, i) => row.every((v) => near(v, wrongValues![i], p.tol)));
      if (!ok && !folge && firstError === null) {
        const holds = (l: Node[]) => lineValues(l, envs).every((row, i) => row.every((v) => near(v, startValues[i], p.tol)));
        errorType = signSlip(ns, holds) ? "vorzeichen" : hasDivision(startNode) || ns.some(hasDivision) ? "bruch" : "rechenfehler";
        wrongValues = vals.map((row) => row[row.length - 1]);
      }
    } else {
      const vals = ns.map((n) => evaluate(n, {}));
      if (p.continues && last !== null) vals.unshift(last);
      if (ns.some((n) => varsOf(n).size > 0) || vals.some((v) => !Number.isFinite(v))) {
        steps.push({ line, status: "unklar", note: "Nicht lesbar." });
        continue;
      }
      last = vals[vals.length - 1];
      if (vals.length < 2) {
        steps.push({ line, status: "notiz" });
        continue;
      }
      ok = allEqual(vals);
      if (!ok && firstError === null) {
        const holds = (l: Node[]) => allEqual([...(p.continues && vals.length > ns.length ? [vals[0]] : []), ...l.map((n) => evaluate(n, {}))]);
        errorType = signSlip(ns, holds) ? "vorzeichen" : ns.some(hasDivision) ? "bruch" : "rechenfehler";
      }
    }
    if (ok) steps.push({ line, status: "ok" });
    else if (folge) steps.push({ line, status: "folge", note: "Mit dem Fehler davor richtig weitergerechnet." });
    else {
      if (firstError === null) firstError = steps.length;
      steps.push({ line, status: "fehler", note: errorType ? LABEL[errorType] : undefined });
    }
  }

  const checked = steps.filter((s) => s.status === "ok" || s.status === "fehler" || s.status === "folge");
  const unclear = steps.some((s) => s.status === "unklar");
  let status: WayVerdict["status"];
  if (!steps.length) status = "fehlt";
  else if (!checked.length) status = "unklar";
  else if (firstError === null) status = unclear ? "unklar" : "richtig";
  else {
    // progress before the error: a right line that is not just the start copied
    const progress = steps.slice(0, firstError).some((s) => s.status === "ok" && normalizeMath(s.line).replace(/\s/g, "") !== startCanon);
    status = progress ? "teilweise" : "fehlerhaft";
  }
  return { status, steps, firstError, errorType: firstError === null ? null : errorType, errorLabel: firstError === null || !errorType ? null : LABEL[errorType] };
}

function letters(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of stripUnits(normalizeMath(s)).replace(/\b(sqrt|wurzel|pi)\b/gi, "").matchAll(/\p{L}/gu)) out.add(m[0]);
  return out;
}

/** The variables of a task's start ("3x + 7 = 22" → x); for an equation only one variable is supported. */
export function startVariables(start: string | null | undefined): string[] {
  return start ? [...letters(start)] : [];
}

/** The result a Rechenweg ends with, when no separate result was written: "x = 5" or the last value. */
export function resultFromWay(lines: string[], ctx: WayContext): string {
  const list = lines.map((l) => l.trim()).filter(Boolean);
  for (let i = list.length - 1; i >= 0; i--) {
    const line = list[i].replace(/\|.*$/, "").trim();
    if (ctx.mode === "gleichung") {
      const m = line.match(new RegExp(`^${ctx.variable || "x"}\\s*=\\s*([^=]+)$`));
      if (m) return m[1].trim();
      continue;
    }
    const segs = line.split("=").map((s) => s.trim()).filter(Boolean);
    if (segs.length) return segs[segs.length - 1];
  }
  return "";
}

// ---------- answers of the two formats ----------
export type MathAnswer = {
  steps?: string[];
  result?: string;
  /** The student did the working on the whiteboard. */
  board?: boolean;
  parts?: { steps?: string[]; result?: string; text?: string }[];
};
export function readMathAnswer(raw: string): MathAnswer {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return { result: raw };
    const o = v as Record<string, unknown>;
    const strs = (x: unknown) => (Array.isArray(x) ? x.map((s) => String(s ?? "")).slice(0, 40) : undefined);
    return {
      steps: strs(o.steps),
      result: typeof o.result === "string" ? o.result : undefined,
      board: o.board === true,
      parts: Array.isArray(o.parts)
        ? o.parts.slice(0, 12).map((p) => {
            const q = (p ?? {}) as Record<string, unknown>;
            return { steps: strs(q.steps), result: typeof q.result === "string" ? q.result : undefined, text: typeof q.text === "string" ? q.text : undefined };
          })
        : undefined,
    };
  } catch {
    return { result: raw };
  }
}

export type ErrorEntry = { answer: string; label: string };
/** A typical wrong result named by the task (error map), compared by value. */
function mapLabel(given: string, errors: ErrorEntry[] | undefined, spec: ValueSpec): string | null {
  for (const e of errors ?? []) {
    if (!e.answer.trim()) continue;
    const v = checkValue(given, { ...spec, accepted: [e.answer], form: "beliebig" });
    if (v.status === "richtig" || v.status === "teilweise") return e.label;
  }
  return null;
}

/** Kind of error behind a label of the task's error map ("Kehrwert vergessen" → bruch); null when unclear. */
export function mathErrorType(label: string | null | undefined): string | null {
  if (!label) return null;
  if (/vorzeichen|minus|negativ/i.test(label)) return "vorzeichen";
  if (/einheit/i.test(label)) return "einheit";
  if (/prozent|grundwert|prozentwert|prozentsatz|100/i.test(label)) return "prozent";
  if (/kehrwert|nenner|zähler|kürz|erweiter|bruch/i.test(label)) return "bruch";
  if (/umform|seite|klammer|auflös/i.test(label)) return "umformung";
  if (/verrechnet|rechenfehler|einmaleins|übertrag/i.test(label)) return "rechenfehler";
  return "regel";
}

export type Outcome = "richtig" | "teilweise" | "falsch" | "offen";
export type MathGrade = {
  /** What this answer is: offen = the teacher grades it; teilweise and falsch allow another try. */
  outcome: Outcome;
  /** On the last try: what is stored (teilweise = half, see lib/mastery.ts; offen = the teacher grades). */
  onFinal: Outcome;
  feedback: string;
  errorLabel: string | null;
  errorType: string | null;
  /** Rechenweg: the line (from 1) where the first error is. */
  wrongStep?: number | null;
  /** Sachaufgabe: the parts (from 1) that are still wrong. */
  wrongParts?: number[];
};

export type RechenwegSpec = {
  start?: string | null;
  variable?: string | null;
  accepted: string[];
  unit?: string | null;
  form?: ResultForm | null;
  round?: number | null;
  /** The Rechenweg is part of the answer (default); false: only the result counts. */
  needWay?: boolean;
  errorMap?: ErrorEntry[];
};

export function wayContext(spec: Pick<RechenwegSpec, "start" | "variable" | "accepted">): WayContext {
  const mode = wayMode(spec.start, spec.variable);
  const variable = mode === "gleichung" ? spec.variable || startVariables(spec.start)[0] || "x" : null;
  const solutions = mode === "gleichung" ? (parseResult(spec.accepted[0] ?? "")?.map((i) => i.value) ?? []) : [];
  return { mode, start: spec.start ?? null, variable, solutions };
}

export type RechenwegReport = { result: ValueVerdict & { given: string; fromWay: boolean }; way: WayVerdict; grade: MathGrade };

/** Ergebnis and Rechenweg of a "Rechenweg" task, checked separately and put together (see the README of the format in docs/rechenwege.md). */
export function gradeRechenweg(spec: RechenwegSpec, answer: MathAnswer): RechenwegReport {
  const ctx = wayContext(spec);
  const lines = (answer.steps ?? []).map((l) => l.trim()).filter(Boolean);
  const way = analyzeWay(lines, ctx);
  const typed = (answer.result ?? "").trim();
  const given = typed || resultFromWay(lines, ctx);
  const termVars = ctx.mode === "term" ? startVariables(spec.start) : [];
  const valueSpec: ValueSpec = { accepted: spec.accepted, unit: spec.unit, form: spec.form, round: spec.round, vars: termVars };
  const result = { ...checkValue(given, valueSpec), given, fromWay: !typed && Boolean(given) };
  const needWay = spec.needWay !== false;
  const step = way.firstError !== null ? way.firstError + 1 : null;
  const grade = (g: Omit<MathGrade, "onFinal"> & { onFinal?: Outcome }): RechenwegReport => ({ result, way, grade: { onFinal: g.onFinal ?? g.outcome, ...g } });
  const TEACHER = "Deine Lehrerin bzw. dein Lehrer schaut es sich an.";

  if (result.status === "unklar")
    return grade({ outcome: "offen", feedback: `${result.feedback} ${TEACHER}`, errorLabel: null, errorType: null });
  if (result.status === "richtig") {
    if (way.status === "richtig" || (!needWay && (way.status === "fehlt" || way.status === "unklar"))) return grade({ outcome: "richtig", feedback: "Richtig! Ergebnis und Rechenweg stimmen.", errorLabel: null, errorType: null });
    if (way.status === "fehlt")
      return grade({ outcome: "offen", feedback: answer.board ? "Das Ergebnis stimmt. Deinen Rechenweg am Whiteboard schaut sich deine Lehrerin bzw. dein Lehrer an." : `Das Ergebnis stimmt. ${TEACHER}`, errorLabel: null, errorType: null });
    if (way.status === "unklar") return grade({ outcome: "offen", feedback: `Das Ergebnis stimmt. Einen Teil deines Rechenwegs kann ich nicht sicher prüfen. ${TEACHER}`, errorLabel: null, errorType: null });
    return grade({ outcome: "offen", feedback: `Das Ergebnis stimmt, aber in Zeile ${step} passt etwas nicht. ${TEACHER}`, errorLabel: way.errorLabel ? `Richtiges Ergebnis, ${way.errorLabel} im Rechenweg` : "Richtiges Ergebnis, Fehler im Rechenweg", errorType: way.errorType, wrongStep: step });
  }
  const label = result.label ?? way.errorLabel ?? mapLabel(given, spec.errorMap, valueSpec);
  const type = way.errorType ?? result.errorType ?? mathErrorType(mapLabel(given, spec.errorMap, valueSpec));
  if (result.status === "teilweise") return grade({ outcome: "teilweise", feedback: result.feedback, errorLabel: label, errorType: type, wrongStep: step });
  // a wrong result
  let feedback = result.feedback;
  if (step) feedback = `Das Ergebnis stimmt nicht. Schau dir Zeile ${step} noch einmal an.`;
  else if (way.status === "richtig" && result.fromWay && ctx.mode === "gleichung") feedback = `Dein Rechenweg stimmt bis hierher. Rechne weiter, bis ${ctx.variable} allein steht.`;
  else if (way.status === "richtig" && !result.fromWay) feedback = "Dein Rechenweg stimmt, aber das Ergebnis passt nicht dazu.";
  else if (!given) feedback = "Schreib dein Ergebnis in das Feld.";
  return grade({ outcome: "falsch", feedback, errorLabel: label ?? (way.status === "richtig" && !result.fromWay ? "Ergebnis falsch übertragen" : null), errorType: type, wrongStep: step });
}

// ---------- Sachaufgaben ----------
export type PartKind = "zahl" | "text";
export const PART_KINDS: Record<PartKind, string> = { zahl: "Zahl mit Rechenweg", text: "Antwort in Worten" };
/** What the student sees of a part. */
export type PartView = { label: string; prompt: string; kind: PartKind; lines?: number };
/** The solution of a part (never sent to the student). */
export type PartSolution = {
  accepted?: string[];
  unit?: string | null;
  form?: ResultForm | null;
  round?: number | null;
  /**
   * Folgefehler: how this result follows from earlier ones, with their letters ("480 − a"). A wrong
   * result that is right with the student's own earlier results counts as right.
   */
  follow?: string | null;
  sample?: string;
  criteria?: string[];
  solution?: string;
  errorMap?: ErrorEntry[];
};

export type PartStatus = "richtig" | "folge" | "teilweise" | "falsch" | "offen";
export const PART_STATUS: Record<PartStatus, string> = { richtig: "richtig", folge: "richtig weitergerechnet (Folgefehler)", teilweise: "teilweise richtig", falsch: "falsch", offen: "Lehrerbewertung" };
export type PartReport = { status: PartStatus; feedback: string; given: string; result?: ValueVerdict; way?: WayVerdict; errorLabel?: string | null; errorType?: string | null };

const partLetter = (label: string, i: number) => (label.match(/[a-z]/i)?.[0] ?? String.fromCharCode(97 + i)).toLowerCase();

export function gradeParts(views: PartView[], solutions: PartSolution[], answer: MathAnswer): { parts: PartReport[]; grade: MathGrade } {
  const given = answer.parts ?? [];
  const values: Record<string, number> = {};
  const parts: PartReport[] = views.map((v, i) => {
    const sol = solutions[i] ?? {};
    const a = given[i] ?? {};
    const letter = partLetter(v.label, i);
    if (v.kind === "text") {
      const text = (a.text ?? "").trim();
      return text ? { status: "offen", feedback: "Wird von deiner Lehrerin bzw. deinem Lehrer bewertet.", given: text } : { status: "falsch", feedback: "Hier fehlt noch deine Antwort.", given: "" };
    }
    const lines = (a.steps ?? []).map((l) => l.trim()).filter(Boolean);
    const way = analyzeWay(lines, { mode: "rechnung" });
    const typed = (a.result ?? "").trim();
    const res = typed || resultFromWay(lines, { mode: "rechnung" });
    const spec: ValueSpec = { accepted: sol.accepted ?? [], unit: sol.unit, form: sol.form, round: sol.round };
    let result = checkValue(res, spec);
    const parsed = parseResult(res);
    if (parsed?.length === 1) {
      // the student's value in the unit of the part, for the parts after it
      const exp = sol.unit && sol.unit !== "%" ? unitOf(sol.unit) : null;
      const it = parsed[0];
      values[letter] = it.unit && exp && it.unit.dim === exp.dim ? (it.value * it.unit.factor) / exp.factor : it.percent && sol.unit !== "%" ? it.value / 100 : it.value;
    }
    let status: PartStatus = result.status === "richtig" ? "richtig" : result.status === "teilweise" ? "teilweise" : result.status === "unklar" ? "offen" : "falsch";
    let feedback = result.feedback;
    if (status === "falsch" && sol.follow?.trim()) {
      // Folgefehler: right with the student's own earlier results
      // (with the right earlier results this gives the right result again, so it only helps after an error)
      const f = parseExpr(sol.follow, { vars: Object.keys(values) });
      const expected = f ? evaluate(f, values) : NaN;
      if (Number.isFinite(expected)) {
        const unit = sol.unit && sol.unit !== "%" ? ` ${sol.unit}` : sol.unit === "%" ? " %" : "";
        const again = checkValue(res, { ...spec, accepted: [`${String(Math.round(expected * 1e9) / 1e9).replace(".", ",")}${unit}`], round: spec.round ?? 2 });
        if (again.status === "richtig" || again.status === "teilweise") {
          status = again.status === "richtig" ? "folge" : "teilweise";
          result = again;
          feedback = again.status === "richtig" ? "Mit deinem Ergebnis von vorher richtig weitergerechnet." : again.feedback;
        }
      }
    }
    if ((status === "richtig" || status === "folge") && (way.status === "teilweise" || way.status === "fehlerhaft")) {
      status = "offen";
      feedback = `Das Ergebnis stimmt, aber in Zeile ${way.firstError! + 1} deiner Rechnung passt etwas nicht. Deine Lehrerin bzw. dein Lehrer schaut es sich an.`;
    }
    if (status === "falsch" && way.firstError !== null) feedback = `Das stimmt noch nicht. Schau dir Zeile ${way.firstError + 1} deiner Rechnung an.`;
    const label = status === "falsch" || status === "teilweise" ? (result.label ?? way.errorLabel ?? mapLabel(res, sol.errorMap, spec)) : null;
    const type = status === "falsch" || status === "teilweise" ? (way.errorType ?? result.errorType ?? mathErrorType(mapLabel(res, sol.errorMap, spec))) : null;
    return { status, feedback, given: res, result, way, errorLabel: label, errorType: type };
  });

  const wrong = parts.map((p, i) => (p.status === "falsch" || p.status === "teilweise" ? i + 1 : 0)).filter(Boolean);
  const open = parts.some((p) => p.status === "offen");
  const right = parts.filter((p) => p.status === "richtig" || p.status === "folge").length;
  const names = (list: number[]) => list.map((n) => `${views[n - 1]?.label || String.fromCharCode(96 + n)}${/\)$/.test(views[n - 1]?.label ?? "") ? "" : ")"}`).join(", ");
  const firstWrong = parts.find((p) => p.status === "falsch" || p.status === "teilweise");
  const base = { errorLabel: firstWrong?.errorLabel ?? null, errorType: firstWrong?.errorType ?? null, wrongParts: wrong };
  if (!wrong.length && !open) return { parts, grade: { outcome: "richtig", onFinal: "richtig", feedback: "Alle Teilaufgaben richtig!", ...base } };
  if (!wrong.length)
    return { parts, grade: { outcome: "offen", onFinal: "offen", feedback: `${right} von ${parts.length} Teilaufgaben sind sicher richtig. Den Rest schaut sich deine Lehrerin bzw. dein Lehrer an.`, ...base } };
  return {
    parts,
    grade: {
      outcome: "falsch",
      onFinal: open ? "offen" : right > 0 || parts.some((p) => p.status === "teilweise") ? "teilweise" : "falsch",
      feedback: `${right} von ${parts.length} Teilaufgaben richtig. Schau dir ${names(wrong)} noch einmal an.`,
      ...base,
    },
  };
}
