/**
 * Terme vergleichen, wie Schüler sie tippen: „2x + 7y“, „7y+2x“, „x^2 − 6x + 9“, „3(x + 2)“. Der Term wird mit dem
 * sicheren Parser gelesen (lib/math-expr.ts) und zu einem Polynom ausmultipliziert; zwei Terme sind gleich, wenn ihre
 * Polynome gleich sind. Dazu die Form, die die Aufgabe verlangt: „Fasse zusammen“ ist mit der abgeschriebenen Angabe
 * nicht gelöst, „Hebe heraus“ nicht mit dem ausmultiplizierten Term.
 */
import { normalizeMath, parseExpr, summands, type Node } from "./math-expr";

/** Ein Polynom: je Monom („x^2·y“, „“ für die Zahl) der Koeffizient. */
export type Poly = Map<string, number>;
/** Welche Form die Antwort haben muss. */
export type TermForm = "zusammengefasst" | "faktorisiert";
export type TermSpec = { vars: string[]; form: TermForm };

const MAX_GRAD = 8;
const rund = (x: number) => Math.round(x * 1e9) / 1e9;

function monom(exps: Record<string, number>): string {
  return Object.keys(exps)
    .filter((v) => exps[v] > 0)
    .sort()
    .map((v) => (exps[v] === 1 ? v : `${v}^${exps[v]}`))
    .join("·");
}
function exponenten(key: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!key) return out;
  for (const f of key.split("·")) {
    const [v, e] = f.split("^");
    out[v] = Number(e ?? 1);
  }
  return out;
}
function sauber(p: Poly): Poly {
  const out: Poly = new Map();
  for (const [k, c] of p) if (Math.abs(c) > 1e-9) out.set(k, rund(c));
  return out;
}
function summe(a: Poly, b: Poly, f = 1): Poly {
  const out: Poly = new Map(a);
  for (const [k, c] of b) out.set(k, (out.get(k) ?? 0) + f * c);
  return sauber(out);
}
function produkt(a: Poly, b: Poly): Poly | null {
  const out: Poly = new Map();
  for (const [ka, ca] of a)
    for (const [kb, cb] of b) {
      const e = exponenten(ka);
      for (const [v, n] of Object.entries(exponenten(kb))) e[v] = (e[v] ?? 0) + n;
      if (Object.values(e).reduce((s, n) => s + n, 0) > MAX_GRAD) return null;
      const k = monom(e);
      out.set(k, (out.get(k) ?? 0) + ca * cb);
    }
  return sauber(out);
}
const konstante = (p: Poly): number | null => (p.size === 0 ? 0 : p.size === 1 && p.has("") ? p.get("")! : null);

/** Das Polynom eines Baums; null bei Wurzeln, Prozent, Division durch einen Term oder zu hohem Grad. */
function polyVon(n: Node): Poly | null {
  switch (n.k) {
    case "num":
      return sauber(new Map([["", n.v]]));
    case "var":
      return new Map([[n.name, 1]]);
    case "neg": {
      const a = polyVon(n.a);
      return a && summe(new Map(), a, -1);
    }
    case "add":
    case "sub": {
      const a = polyVon(n.a);
      const b = polyVon(n.b);
      return a && b ? summe(a, b, n.k === "add" ? 1 : -1) : null;
    }
    case "mul": {
      const a = polyVon(n.a);
      const b = polyVon(n.b);
      return a && b ? produkt(a, b) : null;
    }
    case "div": {
      const a = polyVon(n.a);
      const b = polyVon(n.b);
      const d = b && konstante(b);
      return a && d ? sauber(new Map([...a].map(([k, c]) => [k, c / d]))) : null;
    }
    case "pow": {
      const a = polyVon(n.a);
      const e = polyVon(n.b);
      const k = e && konstante(e);
      if (!a || k === null || !Number.isInteger(k) || k < 0 || k > MAX_GRAD) return null;
      let out: Poly | null = new Map([["", 1]]);
      for (let i = 0; i < k && out; i++) out = produkt(out, a);
      return out;
    }
    default:
      return null;
  }
}

/** Das Polynom eines getippten Terms (nur die Variablen der Aufgabe), oder null, wenn er nicht lesbar ist. */
export function termPoly(text: string, vars: string[]): Poly | null {
  const n = parseExpr(text, { vars });
  return n ? polyVon(n) : null;
}

export function gleichePolys(a: Poly, b: Poly): boolean {
  if (a.size !== b.size) return false;
  for (const [k, c] of a) if (!b.has(k) || Math.abs(b.get(k)! - c) > 1e-9) return false;
  return true;
}

/** Die Faktoren eines Produkts: 2x(3x − 1) → 2, x, (3x − 1); bei einer Potenz die Basis. */
function faktoren(n: Node): Node[] {
  if (n.k === "mul") return [...faktoren(n.a), ...faktoren(n.b)];
  if (n.k === "neg") return faktoren(n.a);
  if (n.k === "pow") return faktoren(n.a);
  return [n];
}
const ggt = (a: number, b: number): number => (b === 0 ? a : ggt(b, a % b));
/** Steckt in der Klammer noch ein gemeinsamer Faktor? 4x + 6 (die 2), x^2 + 3x (das x); 2x + 3 nicht. */
function nochGemeinsam(p: Poly): boolean {
  const koeff = [...p.values()];
  if (koeff.every((c) => Number.isInteger(c)) && koeff.reduce((g, c) => ggt(g, Math.abs(c)), 0) > 1) return true;
  const monome = [...p.keys()].map(exponenten);
  return Object.keys(monome[0]).some((v) => monome.every((e) => (e[v] ?? 0) > 0));
}

/**
 * Hat der Term die verlangte Form? Zusammengefasst: keine Klammer, jedes Monom nur einmal. Faktorisiert: ein Produkt mit
 * Klammer, und in keiner Klammer steckt noch ein gemeinsamer Faktor („2(4x + 6)“ ist nicht fertig herausgehoben).
 */
export function hatForm(text: string, spec: TermSpec): boolean {
  const n = parseExpr(text, { vars: spec.vars });
  if (!n) return false;
  const s = normalizeMath(text);
  if (spec.form === "faktorisiert") {
    const kern = n.k === "neg" ? n.a : n;
    if (!s.includes("(") || (kern.k !== "mul" && kern.k !== "pow")) return false;
    return faktoren(kern).every((f) => {
      const p = polyVon(f);
      return !p || p.size < 2 || !nochGemeinsam(p);
    });
  }
  if (s.includes("(")) return false;
  const teile = summands(n);
  const monome = teile.map((t) => polyVon(t.node));
  if (monome.some((p) => !p || p.size > 1)) return false;
  const keys = monome.map((p) => [...p!.keys()][0] ?? "");
  return new Set(keys).size === keys.length;
}

/** Die Faktoren als Polynome, die Zahlen zu einer zusammengefasst: −2x(3x − 1) → [−2], x, 3x − 1. */
function faktorPolys(n: Node): Poly[] | null {
  let zahl = 1;
  const out: Poly[] = [];
  const geh = (m: Node): boolean => {
    if (m.k === "neg") {
      zahl = -zahl;
      return geh(m.a);
    }
    if (m.k === "mul") return geh(m.a) && geh(m.b);
    const p = polyVon(m.k === "pow" ? m.a : m);
    const e = m.k === "pow" ? polyVon(m.b) : new Map([["", 1]]);
    const hoch = e && konstante(e);
    if (!p || hoch === null || !Number.isInteger(hoch)) return false;
    const c = konstante(p);
    if (c !== null) zahl *= c ** hoch;
    else for (let i = 0; i < hoch; i++) out.push(p);
    return true;
  };
  return geh(n) ? [new Map([["", zahl]]), ...out] : null;
}
/** Zwei Listen von Polynomen mit denselben Einträgen, die Reihenfolge egal. */
function gleicheListen(a: Poly[], b: Poly[]): boolean {
  if (a.length !== b.length) return false;
  const rest = [...b];
  for (const p of a) {
    const i = rest.findIndex((q) => gleichePolys(p, q));
    if (i < 0) return false;
    rest.splice(i, 1);
  }
  return true;
}

/**
 * Gleich geschrieben bis auf die Reihenfolge: dieselben Faktoren (faktorisiert) oder dieselben Glieder (sonst). Damit
 * findet die Fehlerliste „4(3m^2 + 5m)“ auch als „4(5m + 3m^2)“, aber nicht „2(6m^2 + 10m)“, obwohl alle gleich viel wert sind.
 */
export function gleicheSchreibung(a: string, b: string, spec: TermSpec): boolean {
  const na = parseExpr(a, { vars: spec.vars });
  const nb = parseExpr(b, { vars: spec.vars });
  if (!na || !nb) return false;
  if (spec.form === "faktorisiert") {
    const fa = faktorPolys(na);
    const fb = faktorPolys(nb);
    return Boolean(fa && fb && gleicheListen(fa, fb));
  }
  const glied = (n: Node) => summands(n).map((t) => polyVon(t.sign < 0 ? { k: "neg", a: t.node } : t.node));
  const ga = glied(na);
  const gb = glied(nb);
  return ga.every(Boolean) && gb.every(Boolean) && gleicheListen(ga as Poly[], gb as Poly[]);
}

export type TermUrteil = { gleich: boolean; form: boolean; lesbar: boolean };

/** Vergleicht die Antwort mit dem erwarteten Term: gleich im Wert (als Polynom) und in der verlangten Form. */
export function pruefeTerm(given: string, expected: string, spec: TermSpec): TermUrteil {
  const g = termPoly(given, spec.vars);
  const e = termPoly(expected, spec.vars);
  if (!g || !e) return { gleich: false, form: false, lesbar: Boolean(g) };
  return { gleich: gleichePolys(g, e), form: hatForm(given, spec), lesbar: true };
}
