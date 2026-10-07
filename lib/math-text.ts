/**
 * Finds fractions written as "3/4", "-5/8", "x/2" or "(a+b)/2" in task texts, so they can be shown
 * with a fraction bar. A slash inside a word ("und/oder", "km/h") or after a decimal comma stays as it is.
 */
export type MathPart = string | { num: string; den: string; minus: boolean };

const PART = String.raw`(\d+|\p{L}|\([^()]+\))`;
const FRACTION = new RegExp(String.raw`(?<![\p{L}\p{N},.\/)])(-?)${PART}\/${PART}(?![\p{L}\p{N}\/(])`, "gu");
const unwrap = (s: string) => (s.startsWith("(") && s.endsWith(")") ? s.slice(1, -1).trim() : s);

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
