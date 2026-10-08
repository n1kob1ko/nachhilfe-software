/**
 * Mathematical notation in task texts for typeset output (worksheets): fractions with a bar (reuses
 * splitFractions), powers as superscripts, roots with a radical sign, proper minus and relation signs.
 * Text that is not maths stays as it is.
 */
import { splitFractions } from "./math-text";

export type MathNode =
  | string
  | { t: "frac"; num: MathNode[]; den: MathNode[]; minus: boolean }
  | { t: "sup"; body: MathNode[] }
  | { t: "root"; body: MathNode[] };

/** Typographic signs: − instead of a hyphen before numbers and between terms, · for *, ≤ ≥ ≠. */
export function mathSigns(text: string): string {
  return text
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/sqrt\(/gi, "√(")
    .replace(/([\p{N}\p{L})])\s*\*\s*(?=[\p{N}\p{L}(])/gu, "$1 · ")
    .replace(/(^|[\s(=:·])-(?=[\p{N}(]|\p{L}\b)/gmu, "$1−")
    .replace(/(\s)-(\s)/g, "$1−$2");
}

// √(…) with one level of nested brackets, or √ followed by a number or a letter
const ROOT = String.raw`√\(((?:[^()]|\([^()]*\))*)\)|√(\d+(?:[.,]\d+)?|\p{L})`;
// ^ followed by (…), a signed number, a letter or "?" (as in x^? when the exponent is asked for)
const POW = String.raw`\^(?:\(([^()]+)\)|([−-]?\d+(?:[.,]\d+)?|[\p{L}?]))`;
const INLINE = new RegExp(`${ROOT}|${POW}`, "gu");

function inline(text: string): MathNode[] {
  const out: MathNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[0].startsWith("√"))
      out.push({ t: "root", body: inline(m[1] ?? m[2]) });
    else
      out.push({ t: "sup", body: inline((m[3] ?? m[4]).replace(/^-/, "−")) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A line of task text as nodes: fractions, powers and roots typeset, the rest plain text. */
export function parseMath(text: string): MathNode[] {
  return splitFractions(mathSigns(text)).flatMap((p): MathNode[] =>
    typeof p === "string"
      ? inline(p)
      : [{ t: "frac", minus: p.minus, num: inline(p.num), den: inline(p.den) }],
  );
}

/** Text blocks of a task: plain paragraphs and tables written as Markdown pipe tables. */
export type TextBlock =
  | { t: "text"; text: string }
  | { t: "table"; head: string[] | null; rows: string[][] };

const ROW = /^\s*\|.*\|\s*$/;
const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function textBlocks(text: string): TextBlock[] {
  const lines = text.split("\n");
  const out: TextBlock[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) out.push({ t: "text", text: buf.join("\n") });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    if (
      ROW.test(lines[i]) &&
      i + 1 < lines.length &&
      (ROW.test(lines[i + 1]) || SEPARATOR.test(lines[i + 1]))
    ) {
      flush();
      const rows: string[][] = [];
      let head: string[] | null = null;
      while (i < lines.length && ROW.test(lines[i])) {
        if (SEPARATOR.test(lines[i])) {
          // the row above a separator line is the header
          if (rows.length === 1 && !head) head = rows.pop()!;
        } else rows.push(cells(lines[i]));
        i++;
      }
      i--;
      out.push({ t: "table", head, rows });
    } else buf.push(lines[i]);
  }
  flush();
  return out;
}
