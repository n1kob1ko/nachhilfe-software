import { Fragment, type ReactNode } from "react";
import { GAP } from "@/lib/tasks";
import { clozeParts, parseMath, textBlocks, type MathNode } from "@/lib/math-format";

function nodes(list: MathNode[]): ReactNode {
  return list.map((n, i) => {
    if (typeof n === "string") return <Fragment key={i}>{n}</Fragment>;
    if (n.t === "sup")
      return (
        <sup key={i} className="ab-sup">
          {nodes(n.body)}
        </sup>
      );
    if (n.t === "root")
      return (
        <span key={i} className="ab-root">
          <span className="ab-root-sign" aria-hidden>
            √
          </span>
          <span className="ab-root-body">{nodes(n.body)}</span>
        </span>
      );
    return (
      <Fragment key={i}>
        {n.minus && "−"}
        {/* the fraction look of the app (components/MathText.tsx) */}
        <span className="frac" role="math">
          <span className="frac-num">{nodes(n.num)}</span>
          <span className="frac-den">{nodes(n.den)}</span>
        </span>
      </Fragment>
    );
  });
}

/** One run of task text with fractions, powers and roots typeset. */
export function MathLine({ text }: { text: string }) {
  return <>{nodes(parseMath(text))}</>;
}

/** A written gap: the answer, or (Mappe) a wrong one struck through with the right one next to it. */
export type GapFill = string | { text: string; wrong?: boolean; correct?: string } | null;

function FilledGap({ fill }: { fill: Exclude<GapFill, null> }) {
  const f = typeof fill === "string" ? { text: fill } : fill;
  // a fraction is taller than the line: then the underline goes below the whole box
  const tall = [f.text, f.correct].some((x) => x && parseMath(x).some((n) => typeof n !== "string"));
  return (
    <span className={tall ? "ab-gap-filled ab-gap-tall" : "ab-gap-filled"}>
      {f.text && (
        <span className={f.wrong ? "ab-gap-wrong" : undefined}>
          <MathLine text={f.text} />
        </span>
      )}
      {f.correct && (
        <span className="ab-gap-correct">
          <MathLine text={f.correct} />
        </span>
      )}
    </span>
  );
}

/**
 * Task text as printed: paragraphs with line breaks, Markdown tables as tables, maths typeset and
 * every ___ as a writing gap (widths in mm, from the expected answer).
 */
export function RichText({
  text,
  gapsMm = [],
  gapAnswers,
}: {
  text: string;
  gapsMm?: number[];
  gapAnswers?: GapFill[];
}) {
  let gap = 0;
  const withGaps = (s: string) =>
    clozeParts(s, GAP).map((part, i, all) => {
      const g = i < all.length - 1 ? gap++ : -1;
      const fill = g >= 0 ? gapAnswers?.[g] : null;
      const gapEl =
        fill && (typeof fill === "string" || fill.text || fill.correct) ? (
          <FilledGap fill={fill} />
        ) : (
          <span className="ab-gap" style={{ width: `${part.raised ? Math.min(gapsMm[g] ?? 6, 7) : (gapsMm[g] ?? 32)}mm` }} aria-label="Lücke" />
        );
      return (
        <Fragment key={i}>
          <MathLine text={part.text} />
          {/* a gap in an exponent ("3^___") is written raised, like the power */}
          {g >= 0 && (part.raised ? <sup className="ab-sup">{gapEl}</sup> : gapEl)}
        </Fragment>
      );
    });
  return (
    <>
      {textBlocks(text).map((b, i) =>
        b.t === "text" ? (
          b.text.trim() && (
            <p key={i} className="ab-text">
              {withGaps(b.text)}
            </p>
          )
        ) : (
          <table key={i} className="ab-table">
            {b.head && (
              <thead>
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j}>{withGaps(c)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k}>{withGaps(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      )}
    </>
  );
}
