/**
 * Mathematical expressions as students type them: "3x + 7 = 22", "3/4 · 2", "x^2", "x²", "√16",
 * "sqrt(2)", "15 % von 480", "2(x + 3)". A small hand-written parser turns them into a tree, which is
 * evaluated with plain numbers. Nothing typed is ever run as code: only the tokens below exist, and
 * anything else makes the line "nicht lesbar" (the teacher then looks at it).
 */

export type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; a: Node }
  | { k: "add" | "sub" | "mul" | "div" | "pow"; a: Node; b: Node }
  | { k: "root"; a: Node }
  | { k: "pct"; a: Node };

type Tok =
  | { t: "num"; v: number; space: boolean }
  | { t: "var"; name: string; space: boolean }
  | { t: "op"; v: "+" | "-" | "*" | "/" | ":" | "^" | "(" | ")" | "%" | "√"; space: boolean };

export type ParseOptions = {
  /** Letters that are variables. Other letters make the expression unreadable. */
  vars?: string[];
};

const MAX_LENGTH = 240;
const MAX_DEPTH = 40;

/** Typed signs to the parser's: − and – to -, · × ⋅ * to *, ÷ to :, ² ³ to ^2 ^3, brackets to (). */
export function normalizeMath(s: string): string {
  return s
    .replace(/[−–—]/g, "-")
    .replace(/[·×⋅∙•]/g, "*")
    .replace(/÷/g, ":")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[[{]/g, "(")
    .replace(/[\]}]/g, ")")
    .replace(/\b(?:sqrt|wurzel|Wurzel)\s*(?=\()/g, "√")
    .replace(/\bpi\b/gi, "π")
    .replace(/\s+/g, " ")
    .trim();
}

// German thousands ("1.000", "12.500") only when the first group is not 0; "0.125" stays a decimal
const NUMBER = /^(?:[1-9]\d{0,2}(?:\.\d{3})+(?![\d.,])|\d+(?:[.,]\d+)?)/;

function tokenize(src: string, vars: Set<string>): Tok[] | null {
  const s = normalizeMath(src);
  if (!s || s.length > MAX_LENGTH) return null;
  const out: Tok[] = [];
  let i = 0;
  let space = false;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " ") {
      space = true;
      i++;
      continue;
    }
    const num = s.slice(i).match(NUMBER);
    if (num) {
      const text = num[0];
      const v = /^[1-9]\d{0,2}(\.\d{3})+$/.test(text) ? Number(text.replace(/\./g, "")) : Number(text.replace(",", "."));
      out.push({ t: "num", v, space });
      i += text.length;
    } else if (ch === "π") {
      out.push({ t: "num", v: Math.PI, space });
      i++;
    } else if (/\p{L}/u.test(ch)) {
      // "x" between numbers is the times sign when x is not a variable of the task: 3 x 4
      const prev = out[out.length - 1];
      const next = s.slice(i + 1).trimStart()[0] ?? "";
      if ((ch === "x" || ch === "X") && !vars.has(ch) && prev && (prev.t === "num" || (prev.t === "op" && prev.v === ")")) && /[\d(]/.test(next)) {
        out.push({ t: "op", v: "*", space });
      } else if (vars.has(ch)) {
        out.push({ t: "var", name: ch, space });
      } else return null;
      i++;
    } else if ("+-*/:^()%√".includes(ch)) {
      out.push({ t: "op", v: ch as "+", space });
      i++;
    } else return null;
    space = false;
  }
  return out;
}

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private toks: Tok[]) {}
  private peek() {
    return this.toks[this.i];
  }
  private isOp(v: string) {
    const t = this.peek();
    return t?.t === "op" && t.v === v;
  }
  private enter() {
    if (++this.depth > MAX_DEPTH) throw new Error("zu tief");
  }
  parse(): Node {
    const n = this.add();
    if (this.i !== this.toks.length) throw new Error("Rest");
    return n;
  }
  private add(): Node {
    let left = this.mul();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.toks[this.i++] as { v: string }).v;
      const right = this.mul();
      left = { k: op === "+" ? "add" : "sub", a: left, b: right };
    }
    return left;
  }
  private startsFactor() {
    const t = this.peek();
    return Boolean(t && (t.t === "num" || t.t === "var" || (t.t === "op" && (t.v === "(" || t.v === "√"))));
  }
  // the fraction bar binds tighter than · and : (as on paper): 2/3 : 1/2 is (2/3) : (1/2)
  private frac(first: Node): Node {
    let n = first;
    while (this.isOp("/")) {
      this.i++;
      n = { k: "div", a: n, b: this.unary() };
    }
    return n;
  }
  private mul(): Node {
    let left = this.frac(this.unary());
    for (;;) {
      if (this.isOp("*") || this.isOp(":")) {
        const op = (this.toks[this.i++] as { v: string }).v;
        const right = this.frac(this.unary());
        left = { k: op === "*" ? "mul" : "div", a: left, b: right };
      } else if (this.startsFactor()) {
        // 3x, 2(x + 1), (a + b)(a − b), x√2; two numbers next to each other ("2 3") are no product
        const prev = this.toks[this.i - 1];
        const next = this.peek()!;
        if (next.t === "num" && prev && (prev.t === "num" || prev.t === "var" || (prev.t === "op" && prev.v === ")"))) throw new Error("Zahl nach Zahl");
        const right = this.frac(this.pow());
        left = { k: "mul", a: left, b: right };
      } else return left;
    }
  }
  private unary(): Node {
    this.enter();
    try {
      if (this.isOp("-")) {
        this.i++;
        return { k: "neg", a: this.unary() };
      }
      if (this.isOp("+")) {
        this.i++;
        return this.unary();
      }
      return this.pow();
    } finally {
      this.depth--;
    }
  }
  private pow(): Node {
    const base = this.postfix();
    if (this.isOp("^")) {
      this.i++;
      return { k: "pow", a: base, b: this.unary() };
    }
    return base;
  }
  private postfix(): Node {
    let n = this.primary();
    while (this.isOp("%")) {
      this.i++;
      n = { k: "pct", a: n };
    }
    return n;
  }
  private primary(): Node {
    this.enter();
    try {
      const t = this.toks[this.i++];
      if (!t) throw new Error("Ende");
      if (t.t === "num") return { k: "num", v: t.v };
      if (t.t === "var") return { k: "var", name: t.name };
      if (t.v === "(") {
        const n = this.add();
        if (!this.isOp(")")) throw new Error("Klammer");
        this.i++;
        return n;
      }
      if (t.v === "√") {
        // √(x + 1) or √16 or √x; a power after it belongs to the radicand only in brackets
        return { k: "root", a: this.primary() };
      }
      throw new Error("unerwartet");
    } finally {
      this.depth--;
    }
  }
}

/** The tree of one expression (no "="), or null when it cannot be read. */
export function parseExpr(text: string, o: ParseOptions = {}): Node | null {
  const toks = tokenize(text, new Set(o.vars ?? []));
  if (!toks || !toks.length) return null;
  try {
    return new Parser(toks).parse();
  } catch {
    return null;
  }
}

/** Value of a tree; NaN when it is not defined (division by 0, root of a negative number …). */
export function evaluate(n: Node, env: Record<string, number> = {}): number {
  switch (n.k) {
    case "num":
      return n.v;
    case "var":
      return n.name in env ? env[n.name] : NaN;
    case "neg":
      return -evaluate(n.a, env);
    case "add":
      return evaluate(n.a, env) + evaluate(n.b, env);
    case "sub":
      return evaluate(n.a, env) - evaluate(n.b, env);
    case "mul":
      return evaluate(n.a, env) * evaluate(n.b, env);
    case "div": {
      const d = evaluate(n.b, env);
      return d === 0 ? NaN : evaluate(n.a, env) / d;
    }
    case "pow": {
      const e = evaluate(n.b, env);
      if (!Number.isFinite(e) || Math.abs(e) > 400) return NaN;
      const v = Math.pow(evaluate(n.a, env), e);
      return Number.isFinite(v) ? v : NaN;
    }
    case "root": {
      const v = evaluate(n.a, env);
      return v < 0 ? NaN : Math.sqrt(v);
    }
    case "pct":
      return evaluate(n.a, env) / 100;
  }
}

/** Equal up to rounding noise of floating point numbers. */
export function approxEqual(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** The letters used as variables in a tree. */
export function varsOf(n: Node, out = new Set<string>()): Set<string> {
  if (n.k === "var") out.add(n.name);
  else if (n.k === "neg" || n.k === "root" || n.k === "pct") varsOf(n.a, out);
  else if (n.k !== "num") {
    varsOf(n.a, out);
    varsOf(n.b, out);
  }
  return out;
}

/** Whether a tree divides by something (a fraction or ":"), for "Fehler beim Bruchrechnen". */
export function hasDivision(n: Node): boolean {
  if (n.k === "div") return true;
  if (n.k === "num" || n.k === "var") return false;
  if (n.k === "neg" || n.k === "root" || n.k === "pct") return hasDivision(n.a);
  return hasDivision(n.a) || hasDivision(n.b);
}

/** The summands of a sum with their signs: 3x − 7 + 2 → [+3x, −7, +2]. */
export function summands(n: Node, sign = 1): { sign: number; node: Node }[] {
  if (n.k === "add") return [...summands(n.a, sign), ...summands(n.b, sign)];
  if (n.k === "sub") return [...summands(n.a, sign), ...summands(n.b, -sign)];
  if (n.k === "neg") return summands(n.a, -sign);
  return [{ sign, node: n }];
}

/** A sum rebuilt from summands (the inverse of summands, up to the order of operations). */
export function sumOf(list: { sign: number; node: Node }[]): Node {
  let out: Node | null = null;
  for (const s of list) {
    const term: Node = s.sign < 0 ? { k: "neg", a: s.node } : s.node;
    out = out ? { k: "add", a: out, b: term } : term;
  }
  return out ?? { k: "num", v: 0 };
}

// ---------- units ----------
/** Units with their dimension and factor to the base unit; synonyms map to the same entry. */
const UNIT_TABLE: [string[], string, number][] = [
  [["mm"], "länge", 0.001],
  [["cm"], "länge", 0.01],
  [["dm"], "länge", 0.1],
  [["m", "meter"], "länge", 1],
  [["km"], "länge", 1000],
  [["mm²", "mm2", "mm^2"], "fläche", 1e-6],
  [["cm²", "cm2", "cm^2"], "fläche", 1e-4],
  [["dm²", "dm2", "dm^2"], "fläche", 1e-2],
  [["m²", "m2", "m^2", "qm"], "fläche", 1],
  [["a", "ar"], "fläche", 100],
  [["ha"], "fläche", 1e4],
  [["km²", "km2", "km^2"], "fläche", 1e6],
  [["mm³", "mm3", "mm^3"], "volumen", 1e-9],
  [["cm³", "cm3", "cm^3", "ccm"], "volumen", 1e-6],
  [["dm³", "dm3", "dm^3"], "volumen", 1e-3],
  [["m³", "m3", "m^3"], "volumen", 1],
  [["ml"], "volumen", 1e-6],
  [["cl"], "volumen", 1e-5],
  [["dl"], "volumen", 1e-4],
  [["l", "liter"], "volumen", 1e-3],
  [["hl"], "volumen", 0.1],
  [["mg"], "masse", 1e-6],
  [["g", "gramm"], "masse", 1e-3],
  [["dag"], "masse", 1e-2],
  [["kg"], "masse", 1],
  [["t", "tonnen", "tonne"], "masse", 1000],
  [["s", "sek", "sekunden"], "zeit", 1],
  [["min", "minuten"], "zeit", 60],
  [["h", "std", "stunden", "stunde"], "zeit", 3600],
  [["€", "eur", "euro"], "geld", 1],
  [["ct", "cent"], "geld", 0.01],
  [["km/h"], "tempo", 1],
  [["m/s"], "tempo", 3.6],
  [["°", "grad"], "winkel", 1],
  [["stück", "stk"], "stück", 1],
];
const UNITS = new Map<string, { dim: string; factor: number; name: string }>();
for (const [names, dim, factor] of UNIT_TABLE) for (const n of names) UNITS.set(n, { dim, factor, name: names[0] });

export type Unit = { dim: string; factor: number; name: string };
/** A unit as written ("cm²", "Euro", "Std."), or null when it is none the app knows. */
export function unitOf(text: string): Unit | null {
  const key = text.trim().replace(/\.$/, "").toLowerCase();
  return key ? (UNITS.get(key) ?? null) : null;
}
/** A unit or a counted word after a number ("12 Jahre", "8 Kinder"): words count as a unit of their own kind. */
export function unitOrWord(text: string): Unit | null {
  const known = unitOf(text);
  if (known) return known;
  const w = text.trim().replace(/\.$/, "");
  return /^[A-Za-zÄÖÜäöüß]{3,}$/.test(w) ? { dim: "wort", factor: 1, name: w.toLowerCase() } : null;
}

// a unit after a number at the end: "72 €", "3,5 cm²", "2 h", "45 km/h"
const UNIT_AT_END = /(\d|\))\s*(km\/h|m\/s|[a-zA-ZäöüÄÖÜ€°]+(?:\^?[23²³])?\.?)\s*$/;
/** Splits "72 €" into the number part and the unit; text without a known unit comes back unchanged. */
export function splitUnit(text: string): { value: string; unit: Unit | null; unitText: string } {
  const m = text.match(UNIT_AT_END);
  const unit = m ? unitOrWord(m[2]) : null;
  if (!m || !unit) return { value: text.trim(), unit: null, unitText: "" };
  return { value: text.slice(0, (m.index ?? 0) + m[1].length).trim(), unit, unitText: m[2] };
}

/**
 * Removes units written after numbers inside a calculation ("480 € · 15 % = 72 €" → "480 · 15 % = 72"),
 * but never a letter that is a variable of the task.
 */
export function stripUnits(text: string, vars: string[] = []): string {
  return text.replace(/(\d|\))\s*(km\/h|m\/s|[a-zA-ZäöüÄÖÜ€°]+(?:\^?[23²³])?\.?)(?=$|[\s=+\-−*·:/)|,;])/g, (all, before: string, u: string) => {
    if (vars.includes(u)) return all;
    // known units, and counted words after a number ("48 Jahre", "8 Kinder")
    return unitOrWord(u) ? before : all;
  });
}
