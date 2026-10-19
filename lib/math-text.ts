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

export function splitFractions(text: string): MathPart[] {
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
