/**
 * Finds fractions written as "3/4", "-5/8", "x/2" or "(a+b)/2" in task texts, so they can be shown
 * with a fraction bar. A slash inside a word ("und/oder", "km/h") or after a decimal comma stays as it is.
 * A power belongs to its base: "x^2/x^9" is x² over x⁹, "(2a)^3/4" is (2a)³ over 4, and a fraction never
 * starts inside an exponent ("x^(2/3)" stays a power).
 */
export type MathPart = string | { num: string; den: string; minus: boolean };

const POWER = String.raw`(?:\^(?:[−-]?\d+|[\p{L}?]|\([^()]+\)))?`;
const PART = String.raw`((?:\d+|\p{L}|\([^()]+\))${POWER})`;
const FRACTION = new RegExp(String.raw`(?<![\p{L}\p{N},.\/)^]|\^\()(-?)${PART}\/${PART}(?![\p{L}\p{N}\/(^])`, "gu");
// "(a+b)" loses its brackets under the bar, "(a+b)^2" keeps them
const unwrap = (s: string) => (/^\([^()]+\)$/.test(s) ? s.slice(1, -1).trim() : s);

/*
 * A slash with spaces around it between whole terms (niko, 21.10.2026: "(2x^3)^2 · (3x^2)^3 / (6x^4)^2"):
 * the numerator is the product in front of it, joined by · or * or written next to each other ("2x^3");
 * the denominator is what stands right after the slash, written together ("(6x^4)^2", "2y"), never a
 * product with · (a / b · c is (a/b) · c). a · b / c is the same as (a · b) / c, so the bar is always right.
 */
const FACTOR = String.raw`(?:\d+(?:[.,]\d+)?|\p{L}|\([^()]+\))${POWER}[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]*`;
const TOGETHER = `(?:${FACTOR})+`;
const SPACED = new RegExp(
  String.raw`(?<![\p{L}\p{N})^·*\/])(-|−)?(${TOGETHER}(?:\s*[·*]\s*${TOGETHER})*)\s+\/\s+(${TOGETHER})(?![\p{L}\p{N}(^⁰¹²³⁴⁵⁶⁷⁸⁹]|\s*\/)`,
  "gu",
);
// only maths: a side needs a number, a power or brackets, and no word ("go / goes", "und / oder" stay)
const isTerm = (num: string, den: string) => /[\p{N}^()⁰¹²³⁴⁵⁶⁷⁸⁹]/u.test(num + den) && !/\p{L}{3,}/u.test(num + den);

export function splitFractions(text: string): MathPart[] {
  const out: MathPart[] = [];
  let last = 0;
  for (const m of text.matchAll(SPACED)) {
    if (!isTerm(m[2], m[3])) continue;
    const at = m.index ?? 0;
    if (at > last) out.push(...splitTight(text.slice(last, at)));
    out.push({ minus: !!m[1], num: unwrap(m[2].trim()), den: unwrap(m[3]) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push(...splitTight(text.slice(last)));
  return out;
}

/** Fractions written without spaces: "3/4", "x^2/x^9", "(a+b)/2". */
function splitTight(text: string): MathPart[] {
  const out: MathPart[] = [];
  let last = 0;
  for (const m of text.matchAll(FRACTION)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push({ minus: m[1] === "-", num: unwrap(m[2]), den: unwrap(m[3]) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * „3/10 + 3/4“ und „3/4 + 3/10“ sind dieselbe Rechnung (Test mit echter KI, 27.11.2026: beide standen im selben Heft). Für den
 * Vergleich zweier Aufgaben: die Zahlen einer reinen Summe oder eines reinen Produkts am Ende der Zeile (nach dem letzten
 * Doppelpunkt) in fester Reihenfolge. Alles andere bleibt, wie es ist: Minus und Geteilt sind nicht vertauschbar, gemischte
 * Rechnungen und Sätze werden nicht angefasst.
 */
export function ohneReihenfolge(zeile: string): string {
  const at = zeile.lastIndexOf(": ");
  const [kopf, rechnung] = at >= 0 ? [zeile.slice(0, at + 2), zeile.slice(at + 2)] : ["", zeile];
  for (const op of [" + ", " · "]) {
    const teile = rechnung.split(op).map((t) => t.trim());
    if (teile.length > 1 && teile.every((t) => /^\d[\d.,/ ]*$/.test(t))) return kopf + [...teile].sort().join(op);
  }
  return zeile;
}

// „S. 86/87“, „Seite 12/13“, „Nr. 3/4“ und „Schuljahr 2026/27“ sind keine Brüche
const KEIN_BRUCH = /\b(?:S\.|Seiten?|Nr\.)\s*\d+\/\d+|(?<!\d)\d{4}\/\d{2,4}(?!\d)/gi;

/**
 * Brüche in einem Text einer Folie (lib/praesentation-html.ts, Vorschau): wie `splitFractions`, aber Folien gibt es in jedem
 * Fach, darum bleiben Seitenangaben und Schuljahre Text.
 */
export function folienTeile(text: string): MathPart[] {
  const out: MathPart[] = [];
  let last = 0;
  for (const m of text.matchAll(KEIN_BRUCH)) {
    const at = m.index ?? 0;
    out.push(...splitFractions(text.slice(last, at)), m[0]);
    last = at + m[0].length;
  }
  out.push(...splitFractions(text.slice(last)));
  return out;
}
