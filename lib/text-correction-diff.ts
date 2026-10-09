/**
 * Fassungsvergleich of a Textkorrektur: the student's sentence against the KI's version of it, word by
 * word. Every difference becomes one change of the sentence: a word that only moves takes the words it
 * passes with it („Deshalb die Lehrer müssten“ → „Deshalb müssten die Lehrer“), and a sign that comes or
 * goes is shown with the word before it („Haus weil“ → „Haus, weil“), as the KI is asked to quote.
 *
 * A placeholder an outside filter put into the text before the KI saw it (OpenRouter's guardrail writes
 * „[PERSON_NAME]“ for what it takes for a name, test 2026-10-09) stands for the student's words at that
 * place. Those words are reported as hidden, never suggested as a change.
 *
 * Pure functions, used by lib/ai/textkorrektur-gruendlich.ts and the tests.
 */
import { comparable, type Span } from "./text-correction-checks";
import { FOREIGN_PLACEHOLDER } from "./text-correction-core";

/** A change inside the sentence: the student's words from start to end become replacement. */
export type SentenceChange = Span & { replacement: string };
/** Words of the sentence an outside filter hid from the KI. */
export type Hidden = Span & { text: string };
export type Comparison = {
  changes: SentenceChange[];
  hidden: Hidden[];
  /** the KI changed most of the sentence: its changes are shown as one */
  rewrite: boolean;
  /** the KI's version does not belong to this sentence (too little in common): nothing is derived from it */
  unrelated: boolean;
};

type Token = Span & { text: string; key: string; word: boolean; placeholder: boolean };

const TOKEN = /\[[\p{L}_]+\]|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

function tokensOf(s: string): Token[] {
  return [...s.matchAll(TOKEN)].map((m) => {
    const text = m[0];
    const placeholder = FOREIGN_PLACEHOLDER.test(text);
    return { start: m.index!, end: m.index! + text.length, text, key: comparable(text), word: placeholder || /[\p{L}\p{N}]/u.test(text), placeholder };
  });
}

/** At most so many of our words for one placeholder (the longest in the test: five, „„Ich bin sehr stolz auf euch“). */
const MAX_HIDDEN = 6;

/** A placeholder in the KI's text stands for any one word of ours (and the words next to it, see below). */
const same = (a: Token, b: Token) => a.key === b.key || (b.placeholder && a.word && !a.placeholder);

type Op = { kind: "eq" | "del" | "ins"; i: number; j: number };

/** The longest common sequence of words and signs, as steps through both sentences. */
function align(a: Token[], b: Token[]): Op[] {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = same(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && same(a[i], b[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) ops.push({ kind: "eq", i: i++, j: j++ });
    else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) ops.push({ kind: "del", i: i++, j });
    else ops.push({ kind: "ins", i, j: j++ });
  }
  return ops;
}

/** A run of differing steps: our tokens [i0, i1) against the KI's [j0, j1). */
type Hunk = { i0: number; i1: number; j0: number; j1: number };

export function compareVersions(sentence: string, corrected: string): Comparison {
  const none: Comparison = { changes: [], hidden: [], rewrite: false, unrelated: false };
  if (!corrected.trim()) return none;
  const a = tokensOf(sentence);
  const b = tokensOf(corrected);
  const ops = align(a, b);
  const ourWords = a.filter((t) => t.word).length;
  const kept = ops.filter((o) => o.kind === "eq" && a[o.i].word).length;
  if (ourWords >= 4 && kept < ourWords * 0.4) return { ...none, unrelated: true };

  const hidden: { i0: number; i1: number }[] = [];
  const hunks: Hunk[] = [];
  // which of the KI's tokens stands for which of ours, where they agree
  const partner = new Map<number, number>();
  const partnerOf = new Map<number, number>();
  let run: Hunk | null = null;
  for (const o of ops) {
    if (o.kind === "eq") {
      if (run) hunks.push(run);
      run = null;
      partner.set(o.i, o.j);
      partnerOf.set(o.j, o.i);
      if (b[o.j].placeholder && a[o.i].key !== b[o.j].key) hidden.push({ i0: o.i, i1: o.i + 1 });
      continue;
    }
    run ??= { i0: o.i, i1: o.i, j0: o.j, j1: o.j };
    if (o.kind === "del") run.i1 = o.i + 1;
    else run.j1 = o.j + 1;
  }
  if (run) hunks.push(run);

  const ours = (h: Hunk) => a.slice(h.i0, h.i1);
  const theirs = (h: Hunk) => b.slice(h.j0, h.j1);
  const wordsOf = (ts: Token[]) => ts.filter((t) => t.word).length;
  /** only signs (or nothing) of ours between i and j */
  const noWords = (i: number, j: number) => a.slice(Math.min(i, j), Math.max(i, j)).every((t) => !t.word);
  /** a hidden span right before the hunk („before“) or right after it, with at most signs between */
  const hiddenBefore = (h: Hunk) => hidden.some((x) => x.i1 <= h.i0 && noWords(x.i1, h.i0));
  const hiddenAfter = (h: Hunk) => hidden.some((x) => x.i0 >= h.i1 && noWords(h.i1, x.i0));
  /** a word the KI wrote elsewhere in the sentence: it moved, the filter did not take it */
  const added = new Set(hunks.flatMap((h) => theirs(h).filter((t) => t.word && !t.placeholder).map((t) => t.key.toLowerCase())));
  const moves = (ts: Token[]) => ts.some((t) => t.word && added.has(t.key.toLowerCase()));

  // what the filter took: a placeholder for several of our words, signs between them included
  const rest = hunks.filter((h) => {
    const gone = ours(h);
    const put = theirs(h);
    const placeholders = put.filter((t) => t.placeholder).length;
    if (placeholders && placeholders === put.length && wordsOf(gone) && wordsOf(gone) <= placeholders * MAX_HIDDEN) {
      hidden.push({ i0: h.i0, i1: h.i1 });
      return false;
    }
    return true;
  });
  // One placeholder often covers a whole group („Wirtshaus das Licht“, „„Ich bin sehr stolz auf euch“, „Mrs Berger“;
  // test 2026-10-09) and stands for one of its words: the rest is gone next to it. Next to a hidden span that is
  // more of what the filter took, not a change; when the KI also changed a word there („das alle Kinder genug“ →
  // „dass“), the change keeps as many of our words as the KI wrote, on the side away from the hidden span.
  const changes = rest.flatMap((h): Hunk[] => {
    const gone = ours(h);
    const put = theirs(h);
    const before = hiddenBefore(h);
    const after = hiddenAfter(h);
    const near = before || after;
    if (!put.length && near && wordsOf(gone) <= MAX_HIDDEN && !moves(gone)) {
      if (wordsOf(gone)) hidden.push({ i0: h.i0, i1: h.i1 });
      return [];
    }
    const keep = wordsOf(put);
    if (near && !(before && after) && keep && put.every((t) => !t.placeholder) && wordsOf(gone) > keep && wordsOf(gone) - keep <= MAX_HIDDEN && !moves(gone)) {
      // the index in ours after the keep-th word from the start (or before the keep-th word from the end)
      const idx = gone.map((t, k) => (t.word ? k : -1)).filter((k) => k >= 0);
      if (after) {
        const cut = h.i0 + idx[keep - 1] + 1;
        hidden.push({ i0: cut, i1: h.i1 });
        return [{ ...h, i1: cut }];
      }
      const cut = h.i0 + idx[idx.length - keep];
      hidden.push({ i0: h.i0, i1: cut });
      return [{ ...h, i0: cut }];
    }
    // a final sign the KI left off is no change
    if (!put.length && h.i1 === a.length && gone.every((t) => !t.word)) return [];
    return [h];
  });

  // a word that only moves: one change from where it leaves to where it lands
  const wordKeys = (ts: Token[]) => new Set(ts.filter((t) => t.word).map((t) => t.key.toLowerCase()));
  const merged: Hunk[] = [];
  for (const h of changes) {
    const prev = merged[merged.length - 1];
    const moves = prev && ([...wordKeys(ours(prev))].some((k) => wordKeys(theirs(h)).has(k)) || [...wordKeys(theirs(prev))].some((k) => wordKeys(ours(h)).has(k)));
    if (moves) merged[merged.length - 1] = { i0: prev.i0, i1: h.i1, j0: prev.j0, j1: h.j1 };
    else merged.push({ ...h });
  }

  // much of the sentence changed in several places: one change from the first to the last difference
  const changedWords = merged.reduce((s, h) => s + ours(h).filter((t) => t.word).length, 0);
  const rewrite = merged.length > 1 && ourWords >= 5 && ourWords <= 30 && (changedWords > ourWords * 0.5 || (merged.length >= 3 && changedWords > ourWords * 0.35));
  const final = rewrite ? [{ i0: merged[0].i0, i1: merged[merged.length - 1].i1, j0: merged[0].j0, j1: merged[merged.length - 1].j1 }] : merged;

  /** The KI's words from j0 to j1 as it wrote them, a placeholder given back the word of ours it stands for. */
  const theirText = (j0: number, j1: number) => {
    let s = "";
    for (let j = j0; j < j1; j++) {
      if (j > j0) s += corrected.slice(b[j - 1].end, b[j].start);
      const i = partnerOf.get(j);
      s += b[j].placeholder && i !== undefined ? a[i].text : b[j].text;
    }
    return s;
  };

  const out = final.map((h0): SentenceChange => {
    const h = { ...h0 };
    // only signs, or nothing of ours: show the word before (at the start of the sentence: the word after)
    if (!ours(h).some((t) => t.word)) {
      if (h.i0 > 0 && partner.get(h.i0 - 1) === h.j0 - 1) {
        h.i0--;
        h.j0--;
      } else if (h.i1 < a.length && partner.get(h.i1) === h.j1) {
        h.i1++;
        h.j1++;
      }
    }
    const start = h.i1 > h.i0 ? a[h.i0].start : (a[h.i0 - 1]?.end ?? 0);
    const end = h.i1 > h.i0 ? a[h.i1 - 1].end : start;
    return { start, end, replacement: theirText(h.j0, h.j1) };
  });

  return {
    changes: out.filter((c) => c.end > c.start && comparable(sentence.slice(c.start, c.end)) !== comparable(c.replacement)),
    hidden: hidden
      .sort((x, y) => x.i0 - y.i0)
      .reduce<{ i0: number; i1: number }[]>((acc, x) => {
        const last = acc[acc.length - 1];
        if (last && last.i1 >= x.i0) last.i1 = Math.max(last.i1, x.i1);
        else acc.push({ ...x });
        return acc;
      }, [])
      .map((x) => ({ start: a[x.i0].start, end: a[x.i1 - 1].end, text: sentence.slice(a[x.i0].start, a[x.i1 - 1].end) })),
    rewrite,
    unrelated: false,
  };
}

/** Pronouns, articles and joining words: when a filter hides one of them, the KI did not see the grammar of the sentence. */
const GRAMMAR_WORDS = new Set(
  (
    "sie ihr ihre ihrem ihren ihrer ihres ihnen er es wir du man das dass die der den dem des ein eine einer einem einen und oder aber weil wenn als wie ob " +
    "she he it they we you i her him them his their its"
  ).split(" "),
);

/** Whether a hidden word is more than a name: lower case, or a word of grammar („Sie“). */
export const hidesGrammar = (text: string) => text.split(/\s+/).some((w) => /^\p{Ll}/u.test(w) || GRAMMAR_WORDS.has(w.toLowerCase()));
