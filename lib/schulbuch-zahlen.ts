/**
 * Schulbuch-Zahlen: the numbers the built-in maths tasks use (lib/generators.ts, lib/generators-mathe.ts,
 * lib/textaufgaben.ts), so that a task looks like one from a school book. Fractions get denominators
 * that fit together, prices fit the item, percentages give clean results, equations have whole-number
 * solutions (simple fractions only at the hardest level), powers keep small exponents.
 *
 * Difficulty: easy levels get clean numbers; harder levels get more steps (three fractions, brackets on
 * both sides, two power rules in one task) or bigger but still sensible numbers, never uglier ones.
 * Every pool is built once by going through all candidates and keeping those that follow the rules of
 * the level, so a task never needs a second try and never breaks a rule. Own didactic choices: no
 * numbers or texts are taken from school books, IQS or Matura tasks.
 */
import type { Difficulty } from "./curriculum";

export type Rng = () => number;
export const rint = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

/** Five steps: sehr leicht 0 … sehr schwer 4; "leicht bis mittel" of older exercises counts as leicht. */
export type Stufe = 0 | 1 | 2 | 3 | 4;
export const STUFE: Record<Difficulty, Stufe> = { "sehr leicht": 0, leicht: 1, "leicht bis mittel": 1, mittel: 2, schwer: 3, "sehr schwer": 4 };

const pools = new Map<string, unknown[]>();
/** A pool of candidates, built once; an empty pool is a mistake in the rules (the tests find it). */
function pool<T>(key: string, build: () => T[]): T[] {
  let p = pools.get(key) as T[] | undefined;
  if (!p) {
    p = build();
    if (!p.length) throw new Error(`Schulbuch-Zahlen: keine Aufgaben für ${key}`);
    pools.set(key, p);
  }
  return p;
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// ---------- numbers as text ----------
const round4 = (x: number) => Math.round(x * 10000) / 10000;
/** A number for the student to read: decimal comma, real minus sign (−3), at most 4 decimals. */
export function zahl(x: number): string {
  const r = round4(x);
  const s = String(Math.abs(r)).replace(".", ",");
  return r < 0 ? `−${s}` : s;
}
/** A number as an accepted answer: decimal comma, plain minus (the checker reads both signs). */
export const antwort = (x: number) => String(round4(x)).replace(".", ",");
/** A number in brackets when it is negative, as in a term: (−4). */
export const klammer = (x: number) => (x < 0 ? `(${zahl(x)})` : zahl(x));
/** Money: whole euros without decimals, else always two (49,90). */
export function geld(x: number): string {
  const c = Math.round(x * 100);
  const s = c % 100 === 0 ? String(Math.abs(c) / 100) : (Math.abs(c) / 100).toFixed(2).replace(".", ",");
  return c < 0 ? `−${s}` : s;
}
export const euro = (x: number) => `${geld(x)} €`;
/** Money as an accepted answer ("9,98", "-15"). */
export const geldAntwort = (x: number) => geld(x).replace("−", "-");

// ---------- fractions ----------
export type Frac = { n: number; d: number };
export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);
export function kuerze({ n, d }: Frac): Frac {
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
}
export const wert = (f: Frac) => f.n / f.d;
export const ganz = (k: number): Frac => ({ n: k, d: 1 });
export const plus = (a: Frac, b: Frac) => kuerze({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
export const minus = (a: Frac, b: Frac) => kuerze({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
export const mal = (a: Frac, b: Frac) => kuerze({ n: a.n * b.n, d: a.d * b.d });
export const durch = (a: Frac, b: Frac) => kuerze({ n: a.n * b.d, d: a.d * b.n });
export const gleich = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d;
/** "3/4", "2", "-1/2": the form the checker reads. */
export const bruch = ({ n, d }: Frac) => (d === 1 ? `${n}` : `${n}/${d}`);
/** "2 1/3" for a value above 1 (as a school book writes it), else like `bruch`. */
export function gemischt(f: Frac): string {
  const r = kuerze(f);
  if (r.d === 1 || Math.abs(r.n) < r.d) return bruch(r);
  const w = Math.trunc(r.n / r.d);
  return `${w} ${Math.abs(r.n) - Math.abs(w) * r.d}/${r.d}`;
}
/** A rational solution as an answer: "5", "-3", "3/2". */
export const loesung = (f: Frac) => bruch(kuerze(f));

function echte(nenner: readonly number[]): Frac[] {
  return nenner.flatMap((d) => range(1, d - 1).filter((n) => gcd(n, d) === 1).map((n) => ({ n, d })));
}
/** Proper and improper fractions (not whole numbers) with these denominators, value below `max`. */
function brueche(nenner: readonly number[], max: number): Frac[] {
  return nenner.flatMap((d) => range(1, max * d - 1).filter((n) => gcd(n, d) === 1 && n % d !== 0).map((n) => ({ n, d })));
}
/** Mixed numbers 1 1/2 … with these whole parts and fraction parts, as improper fractions. */
function gemischte(ganze: readonly number[], nenner: readonly number[]): Frac[] {
  return ganze.flatMap((w) => echte(nenner).map((f) => ({ n: w * f.d + f.n, d: f.d })));
}

export type BruchOp = "+" | "−" | "·" | ":";
/**
 * A fraction calculation: the terms in order, the operators between them and the reduced result.
 * `gemischt`: the terms above 1 are shown as mixed numbers (2 1/2); the Rechenweg never gets them,
 * because the term check reads 5/2 but not 2 1/2.
 */
export type BruchRechnung = { terms: Frac[]; ops: BruchOp[]; result: Frac; gemischt: boolean };
export const termText = (f: Frac, gem: boolean) => (f.d === 1 ? `${f.n}` : gem ? gemischt(f) : bruch(f));
export const bruchText = (r: BruchRechnung) => r.terms.map((t, i) => `${i ? ` ${r.ops[i - 1]} ` : ""}${termText(t, r.gemischt)}`).join("");

function rechne(terms: Frac[], ops: BruchOp[]): Frac {
  // + and − from left to right (· and : only come as two terms)
  return terms.slice(1).reduce((acc, t, i) => (ops[i] === "+" ? plus(acc, t) : ops[i] === "−" ? minus(acc, t) : ops[i] === "·" ? mal(acc, t) : durch(acc, t)), terms[0]);
}
const nennerOf = (r: BruchRechnung) => r.terms.map((t) => t.d);
/** The common denominator of a sum (lcm of the denominators). */
export const hauptnenner = (r: BruchRechnung) => nennerOf(r).reduce(lcm, 1);

const SUMME_NENNER = [2, 3, 4, 5, 6, 8, 9, 10, 12];
const teilt = (a: number, b: number) => a % b === 0 || b % a === 0;

function summen(lv: Stufe, op: "+" | "−", gem: boolean): BruchRechnung[] {
  const out: BruchRechnung[] = [];
  const add = (terms: Frac[], ops: BruchOp[], g = false) => {
    // every step stays positive: 3/4 − 1/3 + 1/6, never 1/12 − 1/4 + 3/8
    for (let i = 2; i <= terms.length; i++) if (rechne(terms.slice(0, i), ops).n <= 0) return;
    out.push({ terms, ops, result: rechne(terms, ops), gemischt: g });
  };
  const ops2: BruchOp[] = [op];
  if (lv === 0) {
    // gleichnamig: 2/7 + 3/7, the sum at most 1
    for (const d of range(3, 10))
      for (const n1 of range(1, d - 1))
        for (const n2 of range(1, d - 1)) if (op === "+" ? n1 + n2 <= d : n1 > n2) add([{ n: n1, d }, { n: n2, d }], ops2);
    return out;
  }
  const fr = echte(SUMME_NENNER);
  const pair = (ok: (a: Frac, b: Frac) => boolean, terms = fr) => {
    for (const a of terms) for (const b of terms) if (!gleich(a, b) && ok(a, b) && (op === "+" || wert(a) > wert(b))) add([a, b], ops2);
  };
  // one denominator is a multiple of the other: 1/2 + 1/4, 2/3 + 1/6
  if (lv === 1) pair((a, b) => a.d !== b.d && teilt(a.d, b.d));
  // different denominators, common denominator at most 24: 1/3 + 1/4, 5/6 + 3/8
  if (lv === 2) pair((a, b) => !teilt(a.d, b.d) && lcm(a.d, b.d) <= 24);
  if (lv === 4 && gem) {
    // mixed numbers: 1 1/2 + 2 2/3
    const fit = (a: Frac, b: Frac) => a.d !== b.d && lcm(a.d, b.d) <= 24;
    for (const a of gemischte([1, 2, 3], SUMME_NENNER))
      for (const b of gemischte([1, 2], SUMME_NENNER)) if (fit(a, b) && (op === "+" || wert(a) - wert(b) >= 0.5)) add([a, b], ops2, true);
    return out;
  }
  if (lv >= 3) {
    // three fractions: more steps, still a small common denominator
    const nenner = lv === 3 ? [2, 3, 4, 5, 6, 8, 10, 12] : [2, 3, 4, 6, 8, 9, 12];
    const max = lv === 3 ? 24 : 36;
    const opsList: BruchOp[][] = op === "+" ? [["+", "+"]] : [["−", "−"], ["+", "−"], ["−", "+"]];
    const fr3 = echte(nenner);
    for (const a of fr3)
      for (const b of fr3)
        for (const c of fr3) {
          const ds = new Set([a.d, b.d, c.d]);
          const l = lcm(lcm(a.d, b.d), c.d);
          if (ds.size < 2 || l > max || (lv === 4 && l <= 12) || gleich(a, b) || gleich(b, c) || gleich(a, c)) continue;
          for (const ops of opsList) add([a, b, c], ops);
        }
  }
  return out;
}

/** Denominators a result may have from mittel on (no sevenths or elevenths at the hard levels). */
const NETT = new Set([1, 2, 3, 4, 5, 6, 8, 9, 10, 12]);

function produkte(lv: Stufe, gem: boolean): BruchRechnung[] {
  const out: BruchRechnung[] = [];
  const kreuz = (a: Frac, b: Frac) => gcd(a.n, b.d) > 1 || gcd(b.n, a.d) > 1;
  const add = (a: Frac, b: Frac, ok: (r: Frac) => boolean, g = false) => {
    const result = mal(a, b);
    if (ok(result)) out.push({ terms: [a, b], ops: ["·"], result, gemischt: g });
  };
  if (lv === 0) {
    // a fraction times a whole number: 3/4 · 8
    for (const a of echte([2, 3, 4, 5, 6, 8, 10])) for (const k of range(2, 10)) add(a, ganz(k), () => true);
  } else if (lv === 1) {
    const fr = echte([2, 3, 4, 5, 6, 8, 10]);
    for (const a of fr) for (const b of fr) add(a, b, (r) => r.d <= 12);
  } else if (lv === 2) {
    // Kürzen über Kreuz is possible: 4/9 · 3/8 = 1/6
    const fr = echte([2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
    for (const a of fr) for (const b of fr) if (kreuz(a, b)) add(a, b, (r) => r.d <= 12 && r.d !== 11);
  } else if (lv === 3 || !gem) {
    // improper fractions, cancelling both ways: 9/4 · 8/15 = 6/5
    const fr = lv === 3 ? brueche([2, 3, 4, 5, 6, 8, 9, 10, 12], 2) : gemischte([1, 2, 3], [2, 3, 4, 5, 6, 8]);
    for (const a of fr) for (const b of fr) if (gcd(a.n, b.d) > 1 && gcd(b.n, a.d) > 1) add(a, b, (r) => NETT.has(r.d) && wert(r) <= (lv === 3 ? 10 : 20));
  } else {
    // mixed numbers: 1 1/2 · 2 2/3 = 4
    const fr = gemischte([1, 2, 3], [2, 3, 4, 5, 6, 8]);
    for (const a of fr) for (const b of fr) if (kreuz(a, b)) add(a, b, (r) => NETT.has(r.d) && wert(r) <= 20, true);
  }
  return out;
}

function quotienten(lv: Stufe, gem: boolean): BruchRechnung[] {
  const out: BruchRechnung[] = [];
  const add = (a: Frac, b: Frac, ok: (r: Frac) => boolean, g = false) => {
    const result = durch(a, b);
    if (!gleich(a, b) && ok(result)) out.push({ terms: [a, b], ops: [":"], result, gemischt: g });
  };
  if (lv === 0) {
    // a fraction divided by a whole number: 3/4 : 3
    for (const a of echte([2, 3, 4, 5, 6, 8, 10])) for (const k of range(2, 6)) add(a, ganz(k), (r) => r.d <= 20);
  } else if (lv === 1) {
    const fr = echte([2, 3, 4, 6, 8]);
    for (const a of fr) for (const b of fr) add(a, b, (r) => r.d <= 6 && wert(r) <= 6);
  } else if (lv === 2) {
    const fr = echte([2, 3, 4, 5, 6, 8, 9, 10, 12]);
    for (const a of fr) for (const b of fr) add(a, b, (r) => NETT.has(r.d) && r.n <= 20);
  } else if (lv === 3 || !gem) {
    const fr = lv === 3 ? brueche([2, 3, 4, 5, 6, 8, 9, 10, 12], 2) : gemischte([1, 2, 3], [2, 3, 4, 5, 6, 8]);
    for (const a of fr) for (const b of fr) if (gcd(a.n, b.n) > 1 || gcd(a.d, b.d) > 1) add(a, b, (r) => NETT.has(r.d) && wert(r) <= 10);
  } else {
    // mixed numbers: 2 1/2 : 1 1/4 = 2
    const fr = gemischte([1, 2, 3], [2, 3, 4, 5, 6, 8]);
    for (const a of fr) for (const b of fr) add(a, b, (r) => NETT.has(r.d) && wert(r) <= 10, true);
  }
  return out;
}

/**
 * A fraction calculation for the level. `gemischt` (calculations and word problems): the hardest level
 * uses mixed numbers; without it (Rechenweg) three fractions or improper fractions instead.
 */
export function bruchRechnung(rng: Rng, lv: Stufe, op: BruchOp, gem = true): BruchRechnung {
  return pick(rng, bruchListe(lv, op, gem));
}
/** All fraction calculations of the level (word problems pick the ones that fit their story). */
export function bruchListe(lv: Stufe, op: BruchOp, gem = true): BruchRechnung[] {
  const g = gem && lv === 4;
  const key = `bruch:${op}:${lv}:${g}`;
  return op === "+" || op === "−" ? pool(key, () => summen(lv, op, g)) : op === "·" ? pool(key, () => produkte(lv, g)) : pool(key, () => quotienten(lv, g));
}
/** The fractions of a level that fit a story, cached under `key` (an empty list is a mistake in the story's rules). */
export function passende<T>(key: string, build: () => T[]): T[] {
  return pool(`passend:${key}`, build);
}

/** Kürzen: the fraction to reduce, its reduced form and the greatest common divisor. */
export type Kuerzen = { q: Frac; r: Frac; k: number };
const KUERZEN: { nenner: number[]; k: number[]; max: number; unecht?: boolean }[] = [
  { nenner: [2, 3, 4, 5, 6, 8, 10], k: [2, 3, 4, 5], max: 40 },
  { nenner: [2, 3, 4, 5, 6, 7, 8, 9, 10], k: [2, 3, 4, 5, 6, 10], max: 60 },
  { nenner: [3, 4, 5, 6, 7, 8, 9, 10, 12], k: [4, 6, 7, 8, 9, 10, 12], max: 120 },
  { nenner: [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 20], k: [6, 8, 9, 12, 14, 15, 16, 18, 20, 25], max: 250 },
  { nenner: [3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 20, 25], k: [12, 14, 15, 16, 18, 21, 24, 25, 36], max: 300, unecht: true },
];
export function kuerzenAufgabe(rng: Rng, lv: Stufe): Kuerzen {
  return pick(
    rng,
    pool(`kuerzen:${lv}`, () => {
      const s = KUERZEN[lv];
      // improper ones (7/6, 9/8) only with small denominators
      const base = s.unecht ? [...echte(s.nenner), ...brueche([2, 3, 4, 5, 6, 8], 2).filter((f) => f.n > f.d)] : echte(s.nenner);
      return base.flatMap((r) => s.k.map((k) => ({ q: { n: r.n * k, d: r.d * k }, r, k }))).filter((x) => x.q.n <= s.max && x.q.d <= s.max);
    }),
  );
}
/** Proper fractions in lowest terms with these denominators (for word problems). */
export const echteBrueche = (nenner: readonly number[]) => echte(nenner);

/** Erweitern: auf einen Nenner, oder (sehr schwer) so, dass ein bestimmter Zähler entsteht. */
export type Erweitern = { base: Frac; k: number; art: "nenner" | "zaehler" };
const ERWEITERN: { nenner: number[]; k: number[]; max: number }[] = [
  { nenner: [2, 3, 4, 5], k: [2, 3, 4], max: 20 },
  { nenner: [2, 3, 4, 5, 6, 8, 10], k: [2, 3, 4, 5, 6], max: 40 },
  { nenner: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12], k: [2, 3, 4, 5, 6, 7, 8], max: 60 },
  { nenner: [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25], k: [3, 4, 5, 6, 8, 10, 12], max: 100 },
  { nenner: [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25], k: [4, 5, 6, 7, 8, 9, 12, 15], max: 150 },
];
export function erweiternAufgabe(rng: Rng, lv: Stufe): Erweitern {
  const list = pool(`erweitern:${lv}`, () => {
    const s = ERWEITERN[lv];
    return echte(s.nenner).flatMap((base) => s.k.filter((k) => base.d * k <= s.max).map((k) => ({ base, k })));
  });
  const { base, k } = pick(rng, list);
  return { base, k, art: lv === 4 && rng() < 0.5 ? "zaehler" : "nenner" };
}

// ---------- percentages ----------
/** Grundwert, Prozentsatz, Prozentwert in euros and percent. */
export type ProzentFall = { G: number; p: number; W: number };
export type ProzentArt = "wert" | "satz" | "grund";

/** Money amounts for calculations without an item: round at first, then whole euros, then with cents. */
const GELD: number[][] = [
  [20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500],
  [24, 30, 36, 40, 45, 60, 75, 80, 90, 120, 150, 160, 180, 240, 250, 300, 320, 360, 450, 600],
  [12, 18, 24, 28, 34, 36, 45, 48, 56, 64, 72, 85, 96, 120, 125, 140, 160, 175, 240, 280, 350, 420],
  [9.9, 12.5, 14.9, 19.9, 24.5, 29.9, 34.5, 39.9, 44, 49.9, 59.9, 64, 79.9, 89.9, 99.9, 129, 149.9, 249],
  [7.9, 12.8, 18.5, 27.5, 36.4, 48.6, 64.8, 89.9, 119.9, 189, 239.9, 349, 459.9],
];
/** The percentages per level and kind of task. */
const PROZENT: Record<ProzentArt, number[][]> = {
  wert: [[10, 20, 25, 50], [5, 10, 20, 25, 30, 40, 50, 75], [2, 3, 4, 6, 8, 12, 15, 35, 60], [8, 12, 15, 20, 30, 35, 40, 12.5], [2.5, 7.5, 12.5, 17.5, 3, 6, 12, 18, 22]],
  satz: [[10, 20, 25, 50, 75], [5, 10, 15, 20, 25, 30, 40, 60, 75, 80], [2, 4, 6, 8, 12, 15, 35, 45, 65], [2.5, 7.5, 12.5, 37.5, 62.5, 8, 16, 24], [2.5, 7.5, 12.5, 17.5, 37.5, 87.5, 3, 14]],
  grund: [[10, 25, 50], [5, 10, 20, 25, 40, 50], [4, 8, 15, 30, 35, 60], [12.5, 15, 35, 7.5, 2.5], [2.5, 7.5, 12.5, 17.5, 3, 6, 14]],
};
/**
 * The Prozentwert in euros when it is clean enough for the level, else null: whole euros at the easy
 * levels, a multiple of 10 cent at mittel, whole cents above (never a value that must be rounded).
 */
export function prozentwertExakt(G: number, p: number, lv: Stufe): number | null {
  const cents = Math.round(G * 100) * Math.round(p * 10);
  if (cents % 1000 !== 0) return null;
  const W = cents / 1000;
  if (lv <= 1 && W % 100 !== 0) return null;
  if (lv === 2 && W % 10 !== 0) return null;
  return W / 100;
}
export function prozentFall(rng: Rng, lv: Stufe, art: ProzentArt): ProzentFall {
  return pick(
    rng,
    pool(`prozent:${art}:${lv}`, () =>
      GELD[lv].flatMap((G) =>
        PROZENT[art][lv].flatMap((p) => {
          const W = prozentwertExakt(G, p, lv);
          return W !== null && W > 0 ? [{ G, p, W }] : [];
        }),
      ),
    ),
  );
}

/** An item a student might buy, with its articles and plausible prices (round, whole euros, with cents). */
export type Ding = { ein: string; einen: string; der: string; den: string; preise: [number[], number[], number[]] };
const ding = (ein: string, einen: string, der: string, den: string, rund: number[], ganzE: number[], cent: number[]): Ding => ({ ein, einen, der, den, preise: [rund, ganzE, cent] });
/** Own choices of prices that fit the item in Austria (2026); every price is between the item's lowest and highest. */
export const DINGE: Ding[] = [
  ding("ein Rucksack", "einen Rucksack", "der Rucksack", "den Rucksack", [30, 40, 50, 60, 80], [35, 45, 55, 65, 75], [29.9, 39.9, 49.9, 59.9, 69.9]),
  ding("eine Jacke", "eine Jacke", "die Jacke", "die Jacke", [60, 80, 100, 120, 150], [65, 75, 89, 95, 110], [49.9, 69.9, 79.9, 89.9, 119.9]),
  ding("ein Fahrrad", "ein Fahrrad", "das Fahrrad", "das Fahrrad", [300, 400, 500, 600], [349, 420, 480, 520, 650], [349.9, 449.9, 499.9, 599.9]),
  ding("ein Handy", "ein Handy", "das Handy", "das Handy", [200, 300, 400, 500], [249, 280, 320, 360, 450], [199.9, 249.9, 299.9, 349.9]),
  ding("ein Paar Sportschuhe", "ein Paar Sportschuhe", "das Paar Sportschuhe", "das Paar Sportschuhe", [60, 80, 100, 120], [65, 75, 85, 95], [59.9, 69.9, 79.9, 89.9, 99.9]),
  ding("ein Skateboard", "ein Skateboard", "das Skateboard", "das Skateboard", [40, 60, 80, 100], [45, 55, 65, 85], [39.9, 49.9, 59.9, 79.9]),
  ding("ein Tablet", "ein Tablet", "das Tablet", "das Tablet", [200, 300, 400], [240, 280, 320, 360], [229.9, 279.9, 329.9]),
  ding("eine Schultasche", "eine Schultasche", "die Schultasche", "die Schultasche", [80, 100, 120, 150], [85, 95, 110, 135], [89.9, 109.9, 129.9, 139.9]),
  ding("eine Jeans", "eine Jeans", "die Jeans", "die Jeans", [40, 50, 60, 80], [45, 55, 65, 75], [39.9, 49.9, 59.9, 69.9]),
  ding("ein Fußball", "einen Fußball", "der Fußball", "den Fußball", [20, 30, 40], [24, 28, 32, 36], [19.9, 24.9, 29.9, 34.9]),
  ding("eine Konzertkarte", "eine Konzertkarte", "die Konzertkarte", "die Konzertkarte", [40, 50, 60, 80], [45, 55, 65, 72], [39.5, 49.5, 59.5, 64.5]),
  ding("ein Paar Inlineskates", "ein Paar Inlineskates", "das Paar Inlineskates", "das Paar Inlineskates", [60, 80, 100, 120], [70, 85, 95, 110], [59.9, 79.9, 99.9]),
  ding("ein Schihelm", "einen Schihelm", "der Schihelm", "den Schihelm", [40, 60, 80, 100], [45, 55, 65, 75, 85], [49.9, 59.9, 69.9, 89.9]),
  ding("eine Spielkonsole", "eine Spielkonsole", "die Spielkonsole", "die Spielkonsole", [300, 400, 500], [320, 360, 420, 450], [299.9, 349.9, 399.9, 449.9]),
  ding("ein Brettspiel", "ein Brettspiel", "das Brettspiel", "das Brettspiel", [20, 30, 40, 50], [24, 28, 32, 36, 45], [19.9, 24.9, 29.9, 34.9, 39.9]),
];
/** Lowest and highest price of an item over all levels (for the tests: a price always fits the item). */
export const preisSpanne = (d: Ding): [number, number] => {
  const all = d.preise.flat();
  return [Math.min(...all), Math.max(...all)];
};
/** Price group per level: round prices, whole euros, then whole euros and prices with cents. */
const preise = (d: Ding, lv: Stufe) => (lv <= 1 ? d.preise[0] : lv === 2 ? d.preise[1] : [...d.preise[1], ...d.preise[2]]);
/** Discounts and price rises as shops have them (no 2 % off a pair of jeans). */
const DING_PROZENT: number[][] = [[10, 20, 25, 50], [10, 20, 25, 30, 40, 50], [15, 30, 35, 60, 12, 8], [10, 15, 20, 25, 30, 40], [12.5, 15, 17.5, 20, 25, 30, 35]];
/** An item, its price and a percentage that gives a clean result for the level. */
export function dingFall(rng: Rng, lv: Stufe): ProzentFall & { ding: Ding } {
  return pick(
    rng,
    pool(`ding:${lv}`, () =>
      DINGE.flatMap((ding) =>
        preise(ding, lv).flatMap((G) =>
          DING_PROZENT[lv].flatMap((p) => {
            const W = prozentwertExakt(G, p, lv);
            return W !== null && W > 0 ? [{ ding, G, p, W }] : [];
          }),
        ),
      ),
    ),
  );
}
/** "Ein Rucksack" at the start of a sentence. */
export const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- equations ----------
/** ax + b, written as in a school book: "3x − 4", "x + 2", "−2x", "2,5x + 4". */
export function linear(a: number, b: number, v = "x"): string {
  const ax = a === 0 ? "" : a === 1 ? v : a === -1 ? `−${v}` : `${zahl(a)}${v}`;
  if (!ax) return zahl(b);
  return b === 0 ? ax : `${ax} ${b < 0 ? "−" : "+"} ${zahl(Math.abs(b))}`;
}
const gegenOp = (b: number) => (b < 0 ? `+ ${zahl(-b)}` : `− ${zahl(b)}`);
/** The solution as the student reads it: a whole number, a decimal (1,5) or a fraction (3/2). */
const xText = (x: Frac, dezimal: boolean) => (x.d === 1 || (dezimal && 100 % x.d === 0) ? zahl(wert(x)) : bruch(x).replace("-", "−"));
/** A number with at most 2 decimals as an exact fraction. */
const fr = (x: number): Frac => kuerze({ n: Math.round(x * 100), d: 100 });
/** The solution of A·x + B = C, exact also for decimals (0,09x + 9,9 = 14,4). */
const solve = (A: number, B: number, C: number): Frac => kuerze({ n: fr(C - B).n * fr(A).d, d: fr(C - B).d * fr(A).n });

/**
 * An equation with one unknown x and its solution path: each line with the step that leads to the
 * next one ("| − 4", "Klammer auflösen"). The errors are the solutions after a typical wrong step.
 * `dezimal`: the solution is written as a decimal (1,5) when it can be, as in a word problem with euros.
 */
export type Gleichung = { start: string; x: Frac; lines: string[]; ops: string[]; errors: { x: Frac; label: string }[]; hint: string; dezimal: boolean };

/** Leaves out wrong solutions that happen to be right, and doubles. */
function fertig(g: Gleichung): Gleichung {
  const seen: Frac[] = [g.x];
  const errors = g.errors.filter((e) => {
    if (seen.some((s) => gleich(s, e.x))) return false;
    seen.push(e.x);
    return true;
  });
  return { ...g, errors };
}

/** From A·x + B = C on: the rest of the path, appended to lines and ops. */
function loese(A: number, B: number, C: number, lines: string[], ops: string[], dezimal: boolean): Frac {
  if (B !== 0) {
    ops.push(`| ${gegenOp(B)}`);
    lines.push(`${linear(A, 0)} = ${zahl(C - B)}`);
  }
  const x = solve(A, B, C);
  if (A !== 1) {
    ops.push(`| : ${klammer(A)}`);
    lines.push(`x = ${xText(x, dezimal)}`);
  }
  ops.push("");
  return x;
}

/** ax + b = c */
export function einfacheGleichung(a: number, b: number, c: number, dezimal = false): Gleichung {
  const start = `${linear(a, b)} = ${zahl(c)}`;
  const lines = [start];
  const ops: string[] = [];
  const x = loese(a, b, c, lines, ops, dezimal);
  return fertig({
    start,
    x,
    lines,
    ops,
    errors: [
      ...(b !== 0 ? [{ x: solve(a, -b, c), label: "Vorzeichenfehler beim Umformen" }] : []),
      ...(a !== 1 ? [{ x: fr(c - b), label: "Durch die Zahl vor dem x teilen vergessen" }] : []),
    ],
    hint: "Bring zuerst die Zahl ohne x auf die andere Seite.",
    dezimal,
  });
}

/** ax + b = cx + d (a > c) */
export function gleichungBeideSeiten(a: number, b: number, c: number, d: number, dezimal = false): Gleichung {
  const start = `${linear(a, b)} = ${linear(c, d)}`;
  const k = a - c;
  const lines = [start, `${linear(k, b)} = ${zahl(d)}`];
  const ops = [`| − ${linear(c, 0)}`];
  const x = loese(k, b, d, lines, ops, dezimal);
  return fertig({
    start,
    x,
    lines,
    ops,
    errors: [
      { x: solve(k, -b, d), label: "Vorzeichenfehler beim Umformen" },
      { x: solve(a + c, b, d), label: "x auf die andere Seite gebracht, ohne das Vorzeichen zu ändern" },
    ],
    hint: "Bring zuerst alle x auf eine Seite.",
    dezimal,
  });
}

/** a(x + b) + e = c; b < 0 is a(x − 3), e = 0 leaves it out. */
export function klammerGleichung(a: number, b: number, e: number, c: number, dezimal = false): Gleichung {
  const inner = `x ${b < 0 ? "−" : "+"} ${zahl(Math.abs(b))}`;
  const rest = e ? ` ${e < 0 ? "−" : "+"} ${zahl(Math.abs(e))}` : "";
  const start = `${zahl(a)}(${inner})${rest} = ${zahl(c)}`;
  const lines = [start, `${linear(a, a * b)}${rest} = ${zahl(c)}`];
  const ops = ["Klammer auflösen"];
  if (e) {
    lines.push(`${linear(a, a * b + e)} = ${zahl(c)}`);
    ops.push("zusammenfassen");
  }
  const x = loese(a, a * b + e, c, lines, ops, dezimal);
  return fertig({
    start,
    x,
    lines,
    ops,
    errors: [{ x: solve(a, b + e, c), label: "Klammer nicht vollständig ausmultipliziert" }],
    hint: "Multipliziere die Zahl vor der Klammer mit jedem Glied in der Klammer.",
    dezimal,
  });
}

/** a(x + b) = c(x + d), a > c; c = 1 is written without a bracket. */
export function klammernBeideSeiten(a: number, b: number, c: number, d: number): Gleichung {
  const inner = (k: number) => `x ${k < 0 ? "−" : "+"} ${Math.abs(k)}`;
  const start = `${a}(${inner(b)}) = ${c === 1 ? inner(d) : `${c}(${inner(d)})`}`;
  const k = a - c;
  const lines = [start, `${linear(a, a * b)} = ${linear(c, c * d)}`, `${linear(k, a * b)} = ${zahl(c * d)}`];
  const ops = [c === 1 ? "Klammer auflösen" : "Klammern auflösen", `| − ${linear(c, 0)}`];
  const x = loese(k, a * b, c * d, lines, ops, false);
  return fertig({
    start,
    x,
    lines,
    ops,
    errors: [{ x: solve(k, b, d), label: "Klammer nicht vollständig ausmultipliziert" }],
    hint: "Löse zuerst die Klammern auf, dann bring alle x auf eine Seite.",
    dezimal: false,
  });
}

/** a(x + b) + c(x − d) = e */
function zweiKlammern(a: number, b: number, c: number, d: number, e: number): Gleichung {
  const start = `${a}(x + ${b}) + ${c}(x − ${d}) = ${zahl(e)}`;
  const lines = [start, `${a}x + ${a * b} + ${c}x − ${c * d} = ${zahl(e)}`, `${linear(a + c, a * b - c * d)} = ${zahl(e)}`];
  const ops = ["Klammern auflösen", "zusammenfassen"];
  const x = loese(a + c, a * b - c * d, e, lines, ops, false);
  return fertig({
    start,
    x,
    lines,
    ops,
    errors: [
      { x: solve(a + c, b - d, e), label: "Klammer nicht vollständig ausmultipliziert" },
      { x: solve(a + c, a * b + c * d, e), label: "Vorzeichenfehler beim Auflösen der Klammer" },
    ],
    hint: "Löse zuerst beide Klammern auf und fasse dann zusammen.",
    dezimal: false,
  });
}

/** e − a(x − b) = c: the minus before the bracket changes every sign inside. */
export function minusKlammer(e: number, a: number, b: number, c: number): Gleichung {
  const start = `${e} − ${a}(x − ${b}) = ${zahl(c)}`;
  const lines = [start, `${e} − ${a}x + ${a * b} = ${zahl(c)}`, `${linear(-a, e + a * b)} = ${zahl(c)}`];
  const ops = ["Klammer auflösen", "zusammenfassen"];
  const x = loese(-a, e + a * b, c, lines, ops, false);
  return fertig({
    start,
    x,
    lines,
    ops,
    errors: [
      { x: solve(-a, e - a * b, c), label: "Minus vor der Klammer nicht beachtet" },
      { x: solve(a, e + a * b, c), label: "Vorzeichenfehler beim Dividieren" },
    ],
    hint: "Ein Minus vor der Klammer dreht jedes Vorzeichen in der Klammer um.",
    dezimal: false,
  });
}

/** x for the level: whole numbers, negative ones from mittel on; at sehr schwer often a simple fraction (3/2). */
function xFor(rng: Rng, lv: Stufe, max: number): Frac {
  if (lv === 4 && rng() < 0.6) {
    const d = pick(rng, [2, 3, 4, 5]);
    const n = pick(rng, range(-3 * d, 3 * d).filter((k) => k !== 0 && gcd(k, d) === 1));
    return { n, d };
  }
  const x = rint(rng, lv >= 2 ? -max : 1, max);
  return ganz(x === 0 ? max : x);
}

/** ax + b = c; from mittel on also ax + b = cx + d, with a fraction as solution at sehr schwer. */
export function gleichungEinfach(rng: Rng, lv: Stufe, beide = lv >= 3 ? rng() < 0.6 : lv === 2 ? rng() < 0.4 : false): Gleichung {
  const limit = [40, 80, 100, 120, 120][lv];
  for (;;) {
    const x = xFor(rng, lv, [10, 12, 10, 15, 6][lv]);
    if (beide) {
      const c = rint(rng, 1, lv >= 3 ? 5 : 3);
      const a = c + (x.d === 1 ? rint(rng, 1, lv >= 3 ? 7 : 5) : x.d * rint(rng, 1, 2));
      const b = rint(rng, -25, 25);
      const d = ((a - c) * x.n) / x.d + b;
      if (b === 0 || d === 0 || !Number.isInteger(d) || Math.abs(d) > limit) continue;
      return gleichungBeideSeiten(a, b, c, d);
    }
    const a = x.d === 1 ? rint(rng, 2, [5, 9, 9, 12, 9][lv]) : x.d * rint(rng, 1, Math.floor(10 / x.d));
    const bAbs = rint(rng, 1, [12, 20, 30, 40, 40][lv]);
    const b = lv >= 1 && rng() < 0.4 ? -bAbs : bAbs;
    const c = (a * x.n) / x.d + b;
    if (!Number.isInteger(c) || c === 0 || Math.abs(c) > limit || (lv <= 1 && c <= 0)) continue;
    return einfacheGleichung(a, b, c);
  }
}

/**
 * Equations with brackets, more steps per level: a(x + b) = c; a(x − b) = c; a(x + b) − e = c;
 * brackets on both sides or two brackets (schwer); a minus before the bracket (sehr schwer).
 */
export function gleichungKlammern(rng: Rng, lv: Stufe): Gleichung {
  const limit = [60, 100, 120, 150, 150][lv];
  for (;;) {
    const x = lv === 4 && rng() < 0.5 ? xFor(rng, 4, 4) : ganz(lv >= 2 ? rint(rng, -8, 12) || 5 : rint(rng, 1, lv === 0 ? 10 : 12));
    const X = wert(x);
    const form = lv === 0 ? 1 : lv === 1 ? pick(rng, [1, 2]) : lv === 2 ? pick(rng, [2, 3]) : lv === 3 ? pick(rng, [4, 5]) : pick(rng, [4, 6]);
    const a = rint(rng, 2, [5, 6, 8, 6, 6][lv]);
    const b = rint(rng, 1, [6, 9, 12, 9, 9][lv]);
    if (form <= 3) {
      const s = form === 2 ? -1 : 1;
      const e = form === 3 ? rint(rng, 1, 9) * (rng() < 0.5 ? -1 : 1) : 0;
      const c = a * (X + s * b) + e;
      if (!Number.isInteger(c) || c === 0 || Math.abs(c) > limit || (lv <= 1 && c < 0)) continue;
      return klammerGleichung(a, s * b, e, c);
    }
    if (form === 4) {
      // a(x + b) = c(x + d): d is chosen so that x solves the equation
      const c = rint(rng, 1, a - 1);
      const d = (a * (X + b) - c * X) / c;
      if (!Number.isInteger(d) || d === 0 || Math.abs(d) > 15 || Math.abs(c * d) > limit) continue;
      return klammernBeideSeiten(a, b, c, d);
    }
    if (form === 5) {
      const c = rint(rng, 2, 5);
      const d = rint(rng, 1, 9);
      const e = a * (X + b) + c * (X - d);
      if (!Number.isInteger(e) || e === 0 || Math.abs(e) > limit) continue;
      return zweiKlammern(a, b, c, d, e);
    }
    const e = rint(rng, 10, 40);
    const c = e - a * (X - b);
    if (!Number.isInteger(c) || c === 0 || Math.abs(c) > limit) continue;
    return minusKlammer(e, a, b, c);
  }
}

/** The solution path as text: each line with its step. */
export const gleichungWeg = (g: Gleichung) => g.lines.map((l, i) => (g.ops[i] ? `${l}   ${g.ops[i].startsWith("|") ? g.ops[i] : `(${g.ops[i]})`}` : l)).join("\n");
/** The solution as an answer the checker reads ("5", "-3", "3/2", "1,5"). */
export const xAntwort = (g: Gleichung) => (g.dezimal && 100 % g.x.d === 0 ? antwort(wert(g.x)) : loesung(g.x));
/** The solution as the student reads it ("−3", "3/2"). */
export const xAnzeige = (g: Gleichung) => xText(g.x, g.dezimal);
/** A wrong solution as an answer the checker reads. */
export const fehlerAntwort = (g: Gleichung, f: Frac) => (g.dezimal && 100 % f.d === 0 ? antwort(wert(f)) : loesung(f));

// ---------- powers ----------
const HOCH = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** "3x^4", "x^4", "2^5", "x" (exponent 1); a number base with a factor: "2 · 3^4". */
export function potenz(base: string, e: number, k = 1): string {
  const p = e === 1 ? base : `${base}^${e}`;
  if (k === 1) return p;
  return /^\d/.test(base) ? `${k} · ${p}` : `${k}${p}`;
}
/**
 * The ways a student may type a power: x^7, x⁷, x hoch 7, x^(7), and with a number in front 6x^7,
 * 6·x^7, 6 · x^7, 6 x^7, 6*x^7. The checker compares short answers as text, so each one is listed.
 */
export function potenzVarianten(base: string, e: number, k = 1): string[] {
  const sup = String(e)
    .split("")
    .map((ch) => HOCH[Number(ch)])
    .join("");
  const p = e === 1 ? [base] : [`${base}^${e}`, `${base}${sup}`, `${base} hoch ${e}`, `${base}^(${e})`];
  if (k === 1) return p;
  return [...new Set(p.flatMap((x) => [`${k}${x}`, `${k}·${x}`, `${k} · ${x}`, `${k} ${x}`, `${k}*${x}`]))];
}

/**
 * A power-rule task: what to simplify (`start`), the result (`k`·`base`^`e`), the steps of the Rechenweg
 * (each one equal to the start), the rule and typical wrong results. `eine`: the result is a single
 * power ("Schreib als eine Potenz"), else a number times a power ("Vereinfache").
 */
export type Potenzaufgabe = { start: string; base: string; e: number; k: number; steps: string[]; rule: string; errors: { answer: string; label: string }[]; eine: boolean };
const BUCHSTABEN = ["x", "a", "b", "y", "z"];

/** Two numbers from 2 to max that fit together. */
function ziehePaar(rng: Rng, max: number, ok: (a: number, b: number) => boolean): [number, number] {
  const list = range(2, max).flatMap((a) =>
    range(2, max)
      .filter((b) => ok(a, b))
      .map((b) => [a, b] as [number, number]),
  );
  return pick(rng, list);
}

/**
 * Exponents stay small (the result at most 15): sehr leicht and leicht one rule with a letter or a small
 * number as base, mittel a number in front, schwer two rules, sehr schwer two rules with numbers in front.
 */
export function potenzAufgabe(rng: Rng, lv: Stufe): Potenzaufgabe {
  const p = roh(rng, lv);
  const richtig = potenz(p.base, p.e, p.k);
  const seen = new Set([richtig]);
  return {
    ...p,
    errors: p.errors.filter((e) => {
      if (seen.has(e.answer)) return false;
      seen.add(e.answer);
      return true;
    }),
  };
}

function roh(rng: Rng, lv: Stufe): Potenzaufgabe {
  const err = (answer: string, label: string) => ({ answer, label });
  const zahlBasis = lv <= 1 && rng() < 0.3;
  const base = zahlBasis ? String(pick(rng, [2, 3, 5, 10])) : pick(rng, BUCHSTABEN);
  if (lv <= 1) {
    const kind = pick(rng, ["mul", "div", "pow"] as const);
    if (kind === "mul") {
      const [m, n] = ziehePaar(rng, lv === 0 ? 5 : 7, (m, n) => m + n <= (lv === 0 ? 9 : 12));
      return {
        start: `${potenz(base, m)} · ${potenz(base, n)}`,
        base,
        e: m + n,
        k: 1,
        eine: true,
        steps: [`${base}^(${m} + ${n})`, potenz(base, m + n)],
        rule: "Gleiche Basis, malnehmen: Hochzahlen addieren.",
        errors: [
          err(potenz(base, m * n), "Hochzahlen multipliziert statt addiert"),
          zahlBasis ? err(potenz(String(Number(base) ** 2), m + n), "Basen multipliziert") : err(potenz(base, m + n, 2), "Basen zusammengezählt"),
        ],
      };
    }
    if (kind === "div") {
      const [r, n] = ziehePaar(rng, lv === 0 ? 5 : 7, (r, n) => r + n <= (lv === 0 ? 9 : 12));
      const big = r + n;
      return {
        start: `${potenz(base, big)} : ${potenz(base, n)}`,
        base,
        e: r,
        k: 1,
        eine: true,
        steps: [`${base}^(${big} − ${n})`, potenz(base, r)],
        rule: "Gleiche Basis, dividieren: Hochzahlen subtrahieren.",
        errors: [
          err(potenz(base, big + n), "Hochzahlen addiert statt subtrahiert"),
          big % n === 0 ? err(potenz(base, big / n), "Hochzahlen dividiert statt subtrahiert") : err(potenz(base, big * n), "Hochzahlen multipliziert statt subtrahiert"),
        ],
      };
    }
    const [m, n] = ziehePaar(rng, lv === 0 ? 4 : 5, (m, n) => n <= (lv === 0 ? 3 : 4) && m * n <= (lv === 0 ? 9 : 15));
    return {
      start: `(${potenz(base, m)})^${n}`,
      base,
      e: m * n,
      k: 1,
      eine: true,
      steps: [`${base}^(${m} · ${n})`, potenz(base, m * n)],
      rule: "Potenz einer Potenz: Hochzahlen multiplizieren.",
      errors: [err(potenz(base, m + n), "Hochzahlen addiert statt multipliziert"), err(potenz(base, m, n), "Hochzahl außen als Faktor genommen")],
    };
  }
  if (lv === 2) {
    // a number in front: 3x^4 · 2x^3, (12a^7)/(4a^3), (2x^3)^2
    const kind = pick(rng, ["mul", "div", "pow"] as const);
    if (kind === "mul") {
      const [m, n] = ziehePaar(rng, 7, (m, n) => m + n <= 12);
      const [k1, k2] = ziehePaar(rng, 6, (a, b) => a * b <= 30);
      return {
        start: `${potenz(base, m, k1)} · ${potenz(base, n, k2)}`,
        base,
        e: m + n,
        k: k1 * k2,
        eine: false,
        steps: [`${k1} · ${k2} · ${base}^(${m} + ${n})`, potenz(base, m + n, k1 * k2)],
        rule: "Zahlen multiplizieren, bei gleicher Basis Hochzahlen addieren.",
        errors: [err(potenz(base, m + n, k1 + k2), "Zahlen addiert statt multipliziert"), err(potenz(base, m * n, k1 * k2), "Hochzahlen multipliziert statt addiert")],
      };
    }
    if (kind === "div") {
      const [r, n] = ziehePaar(rng, 7, (r, n) => r + n <= 12);
      const [q, k2] = ziehePaar(rng, 5, (q, k) => q * k <= 30);
      const k1 = q * k2;
      return {
        start: `(${potenz(base, r + n, k1)})/(${potenz(base, n, k2)})`,
        base,
        e: r,
        k: q,
        eine: false,
        steps: [`(${k1} : ${k2}) · ${base}^(${r + n} − ${n})`, potenz(base, r, q)],
        rule: "Zahlen dividieren, bei gleicher Basis Hochzahlen subtrahieren.",
        errors: [err(potenz(base, r, k1 - k2), "Zahlen subtrahiert statt dividiert"), err(potenz(base, r + 2 * n, q), "Hochzahlen addiert statt subtrahiert")],
      };
    }
    const m = rint(rng, 2, 4);
    const n = rint(rng, 2, 3);
    const k = n === 2 ? rint(rng, 2, 5) : rint(rng, 2, 3);
    return {
      start: `(${potenz(base, m, k)})^${n}`,
      base,
      e: m * n,
      k: k ** n,
      eine: false,
      steps: [`${k}^${n} · ${base}^(${m} · ${n})`, potenz(base, m * n, k ** n)],
      rule: "Jeder Faktor in der Klammer wird potenziert, die Hochzahlen werden multipliziert.",
      errors: [err(potenz(base, m * n, k), "Zahl in der Klammer nicht potenziert"), err(potenz(base, m + n, k ** n), "Hochzahlen addiert statt multipliziert")],
    };
  }
  if (lv === 3) {
    // two rules in one task
    const kind = pick(rng, ["mulDiv", "powMul", "powDiv"] as const);
    if (kind === "mulDiv") {
      const [m, n] = ziehePaar(rng, 8, (m, n) => m + n <= 14);
      const j = rint(rng, 2, m + n - 2);
      return {
        start: `${potenz(base, m)} · ${potenz(base, n)} : ${potenz(base, j)}`,
        base,
        e: m + n - j,
        k: 1,
        eine: true,
        steps: [`${potenz(base, m + n)} : ${potenz(base, j)}`, `${base}^(${m + n} − ${j})`, potenz(base, m + n - j)],
        rule: "Erst die Hochzahlen addieren (mal), dann subtrahieren (dividiert).",
        errors: [err(potenz(base, m * n - j), "Hochzahlen multipliziert statt addiert"), err(potenz(base, m + n + j), "Hochzahlen addiert statt subtrahiert")],
      };
    }
    if (kind === "powMul") {
      const [m, n] = ziehePaar(rng, 4, (_, n) => n <= 3);
      const j = rint(rng, 1, Math.min(5, 15 - m * n));
      return {
        start: `(${potenz(base, m)})^${n} · ${potenz(base, j)}`,
        base,
        e: m * n + j,
        k: 1,
        eine: true,
        steps: [`${potenz(base, m * n)} · ${potenz(base, j)}`, potenz(base, m * n + j)],
        rule: "Erst die Klammer potenzieren (Hochzahlen mal), dann malnehmen (Hochzahlen plus).",
        errors: [err(potenz(base, m + n + j), "Hochzahlen der Klammer addiert statt multipliziert"), err(potenz(base, m * n * j), "Hochzahlen multipliziert statt addiert")],
      };
    }
    const [m, n] = ziehePaar(rng, 5, (_, n) => n <= 3);
    const j = rint(rng, 1, m * n - 2);
    return {
      start: `(${potenz(base, m)})^${n} : ${potenz(base, j)}`,
      base,
      e: m * n - j,
      k: 1,
      eine: true,
      steps: [`${potenz(base, m * n)} : ${potenz(base, j)}`, potenz(base, m * n - j)],
      rule: "Erst die Klammer potenzieren (Hochzahlen mal), dann dividieren (Hochzahlen minus).",
      errors: [err(potenz(base, m + n - j), "Hochzahlen der Klammer addiert statt multipliziert"), err(potenz(base, m * n + j), "Hochzahlen addiert statt subtrahiert")],
    };
  }
  // sehr schwer: two rules with numbers in front
  const kind = pick(rng, ["powMul", "mulPow", "bruch"] as const);
  if (kind === "powMul") {
    const k = rint(rng, 2, 3);
    const m = rint(rng, 2, 4);
    const d = rint(rng, 2, 5);
    const j = rint(rng, 1, 4);
    return {
      start: `(${potenz(base, m, k)})^2 · ${potenz(base, j, d)}`,
      base,
      e: 2 * m + j,
      k: k * k * d,
      eine: false,
      steps: [`${potenz(base, 2 * m, k * k)} · ${potenz(base, j, d)}`, potenz(base, 2 * m + j, k * k * d)],
      rule: "Erst die Klammer potenzieren, dann Zahlen multiplizieren und Hochzahlen addieren.",
      errors: [err(potenz(base, 2 * m + j, k * d), "Zahl in der Klammer nicht potenziert"), err(potenz(base, m + 2 + j, k * k * d), "Hochzahlen der Klammer addiert statt multipliziert")],
    };
  }
  if (kind === "mulPow") {
    const k = rint(rng, 2, 5);
    const d = rint(rng, 2, 3);
    const m = rint(rng, 1, 4);
    const j = rint(rng, 2, 4);
    return {
      start: `${potenz(base, m, k)} · (${potenz(base, j, d)})^2`,
      base,
      e: m + 2 * j,
      k: k * d * d,
      eine: false,
      steps: [`${potenz(base, m, k)} · ${potenz(base, 2 * j, d * d)}`, potenz(base, m + 2 * j, k * d * d)],
      rule: "Erst die Klammer potenzieren, dann Zahlen multiplizieren und Hochzahlen addieren.",
      errors: [err(potenz(base, m + 2 * j, k * d), "Zahl in der Klammer nicht potenziert"), err(potenz(base, m + j + 2, k * d * d), "Hochzahlen der Klammer addiert statt multipliziert")],
    };
  }
  // (6a^5 · 2a^3)/(4a^2)
  const brueche = pool("potenz:bruch", () =>
    range(2, 6).flatMap((k1) =>
      range(2, 6).flatMap((k2) =>
        range(2, 9)
          .filter((k3) => k1 * k2 <= 36 && (k1 * k2) % k3 === 0 && k3 !== k1 * k2 && k3 !== k1 && k3 !== k2)
          .map((k3) => [k1, k2, k3] as const),
      ),
    ),
  );
  const [k1, k2, k3] = pick(rng, brueche);
  const [m, n] = ziehePaar(rng, 6, (m, n) => m + n <= 12);
  const j = rint(rng, 1, m + n - 2);
  const q = (k1 * k2) / k3;
  return {
    start: `(${potenz(base, m, k1)} · ${potenz(base, n, k2)})/(${potenz(base, j, k3)})`,
    base,
    e: m + n - j,
    k: q,
    eine: false,
    steps: [`(${potenz(base, m + n, k1 * k2)})/(${potenz(base, j, k3)})`, potenz(base, m + n - j, q)],
    rule: "Erst den Zähler zusammenfassen, dann Zahlen dividieren und Hochzahlen subtrahieren.",
    errors: [err(potenz(base, m + n - j, k1 * k2 - k3), "Zahlen subtrahiert statt dividiert"), err(potenz(base, m * n - j, q), "Hochzahlen multipliziert statt addiert")],
  };
}
