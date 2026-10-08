/**
 * "Fehler korrigieren": the student gets a text with errors and writes it corrected. The check compares
 * words and punctuation marks, not whole strings, so it can say which errors were corrected, which were
 * missed and whether something that was right got changed. Spaces and the kind of quotation marks never
 * count; upper and lower case count unless the task says otherwise.
 */

export type Token = { text: string; /** whitespace before the token, to rebuild the text for display */ pre: string };
/** One change from one text to another: tokens [from, to) of the first text become `insert`. */
export type Edit = { from: number; to: number; insert: Token[] };
export type FixLabel = { wrong: string; right: string; label: string; errorType?: string | null };

const TOKEN = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    out.push({ text: m[0], pre: text.slice(last, m.index) });
    last = m.index! + m[0].length;
  }
  return out;
}

const norm = (s: string) => s.replace(/[„“”«»]/g, '"').replace(/[‘’‚`´]/g, "'").replace(/[–—]/g, "-");
const equal = (caseSensitive: boolean) => (a: Token, b: Token) => (caseSensitive ? norm(a.text) === norm(b.text) : norm(a.text).toLowerCase() === norm(b.text).toLowerCase());

/** Pairs of equal tokens (index in a, index in b) of a longest common subsequence. */
function align(a: Token[], b: Token[], eq: (x: Token, y: Token) => boolean): [number, number][] {
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (eq(a[i], b[j])) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** The changes that turn a into b. */
export function edits(a: Token[], b: Token[], caseSensitive = true): Edit[] {
  const pairs = align(a, b, equal(caseSensitive));
  const out: Edit[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    // neighbouring errors ("Fussball weil" → "Fußball, weil") count one by one: word for word, the rest on its own
    const n = Math.min(pi - i, pj - j);
    for (let k = 0; k < n; k++) out.push({ from: i + k, to: i + k + 1, insert: [b[j + k]] });
    if (pi - i > n || pj - j > n) out.push({ from: i + n, to: pi, insert: b.slice(j + n, pj) });
    i = pi + 1;
    j = pj + 1;
  }
  return out;
}

export const joinTokens = (tokens: Token[]) =>
  tokens
    .map((t, i) => (i === 0 ? t.text : `${t.pre || (/^[.,;:!?)\]]$/.test(t.text) ? "" : " ")}${t.text}`))
    .join("")
    .trim();

/** The changes a teacher made from the faulty text to the corrected one, as "wrong → right". */
export function expectedFixes(faulty: string, corrected: string, caseSensitive = true): { wrong: string; right: string }[] {
  const a = tokenize(faulty);
  return edits(a, tokenize(corrected), caseSensitive).map((e) => ({ wrong: joinTokens(a.slice(e.from, e.to)), right: joinTokens(e.insert) }));
}

/** Of several right versions, the one closest to what the student wrote (to compare with it). */
export function closestVersion(accepted: string[], given: string, caseSensitive = true): string | undefined {
  const g = tokenize(given);
  return accepted
    .filter((x) => x.trim())
    .map((v) => ({ v, d: edits(tokenize(v), g, caseSensitive).length }))
    .sort((x, y) => x.d - y.d)[0]?.v;
}

export type FixResult = {
  /** the student's text matches the corrected text (or another accepted version) */
  correct: boolean;
  total: number;
  fixed: number;
  /** errors not corrected or corrected wrongly, "wrong → right" with the teacher's label if there is one */
  missed: (FixLabel & { tried: boolean })[];
  /** changes at places that were right */
  extra: number;
};

/**
 * Compares the student's text with the corrected version. `labels` are the teacher's or the AI's
 * descriptions of the errors ("meinen → meinem: Dativ nach mit"); they are matched by the wrong words.
 */
export function checkFix(faulty: string, accepted: string[], given: string, o: { caseSensitive?: boolean; labels?: FixLabel[] } = {}): FixResult {
  const cs = o.caseSensitive !== false;
  const eq = equal(cs);
  const orig = tokenize(faulty);
  const student = tokenize(given);
  const versions = accepted.filter((x) => x.trim()).map(tokenize);
  const same = (x: Token[], y: Token[]) => x.length === y.length && x.every((t, i) => eq(t, y[i]));
  const correct = versions.some((v) => same(v, student));
  // the corrected version closest to what the student wrote explains the result
  const target = versions.map((v) => ({ v, d: edits(v, student, cs).length })).sort((x, y) => x.d - y.d)[0]?.v ?? orig;
  const needed = edits(orig, target, cs);
  // where each kept token of the faulty text is in the student's text
  const pos = new Map(align(orig, student, eq));
  const segment = (from: number, to: number) => {
    let left = -1;
    for (let i = from - 1; i >= 0; i--)
      if (pos.has(i)) {
        left = pos.get(i)!;
        break;
      }
    let right = student.length;
    for (let i = to; i < orig.length; i++)
      if (pos.has(i)) {
        right = pos.get(i)!;
        break;
      }
    return student.slice(left + 1, right);
  };
  const missed: FixResult["missed"] = [];
  let fixed = 0;
  // errors right next to each other ("Fussball weil" → "Fußball, weil") are looked at together
  const runs: Edit[][] = [];
  for (const e of needed) {
    const last = runs.at(-1);
    if (last && last.at(-1)!.to === e.from) last.push(e);
    else runs.push([e]);
  }
  for (const run of runs) {
    const got = segment(run[0].from, run.at(-1)!.to);
    const want = run.flatMap((e) => e.insert);
    const tried = !same(got, orig.slice(run[0].from, run.at(-1)!.to));
    // which parts of the wanted words the student's words differ from
    const diff = same(got, want) ? [] : edits(want, got, cs);
    let offset = 0;
    for (const e of run) {
      const s = offset;
      const end = offset + e.insert.length;
      offset = end;
      const off = diff.some((d) => (s < end ? (d.from < end && s < d.to) || (d.from === d.to && s < d.from && d.from < end) : d.from <= s && s <= d.to && (d.from === d.to || d.from < s || d.to > s)));
      if (!off) {
        fixed++;
        continue;
      }
      const wrong = joinTokens(orig.slice(e.from, e.to));
      const right = joinTokens(e.insert);
      const label = o.labels?.find((l) => l.wrong && (norm(l.wrong).toLowerCase() === norm(wrong).toLowerCase() || (wrong && norm(l.wrong).toLowerCase().includes(norm(wrong).toLowerCase()))));
      missed.push({ wrong, right, label: label?.label ?? "", errorType: label?.errorType ?? null, tried });
    }
  }
  // changes of the student at places that needed none
  const touched = (from: number, to: number) => needed.some((n) => from <= n.to && n.from <= to);
  const extra = edits(orig, student, cs).filter((s) => !touched(s.from, s.to)).length;
  return { correct, total: needed.length, fixed: correct ? needed.length : fixed, missed: correct ? [] : missed, extra: correct ? 0 : extra };
}

export type Mark = { text: string; pre: string; kind: "same" | "fixed" | "wrong" };
/**
 * The student's text for the teacher: words that are corrected (green), still wrong or newly wrong (red),
 * and unchanged right words.
 */
export function markStudentText(faulty: string, corrected: string, given: string, caseSensitive = true): Mark[] {
  const eq = equal(caseSensitive);
  const student = tokenize(given);
  const rightIdx = new Set(align(student, tokenize(corrected), eq).map(([i]) => i));
  const keptIdx = new Set(align(student, tokenize(faulty), eq).map(([i]) => i));
  return student.map((t, i) => ({ ...t, kind: !rightIdx.has(i) ? "wrong" : keptIdx.has(i) ? "same" : "fixed" }));
}

/** The faulty text with the places that need a correction marked (teacher view, print with solutions). */
export function markFaultyText(faulty: string, corrected: string, caseSensitive = true): Mark[] {
  const orig = tokenize(faulty);
  const bad = new Set<number>();
  for (const e of edits(orig, tokenize(corrected), caseSensitive)) for (let i = e.from; i < e.to; i++) bad.add(i);
  return orig.map((t, i) => ({ ...t, kind: bad.has(i) ? "wrong" : "same" }));
}
