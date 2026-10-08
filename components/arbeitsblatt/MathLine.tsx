import { Fragment, type ReactNode } from "react";
import { GAP } from "@/lib/tasks";
import { parseMath, textBlocks, type MathNode } from "@/lib/math-format";

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
  gapAnswers?: (string | null)[];
}) {
  let gap = 0;
  const withGaps = (s: string) =>
    s.split(GAP).map((part, i, all) => {
      const g = i < all.length - 1 ? gap++ : -1;
      return (
        <Fragment key={i}>
          <MathLine text={part} />
          {g >= 0 &&
            (gapAnswers?.[g] ? (
              <span className="ab-gap ab-gap-filled">
                <MathLine text={gapAnswers[g]!} />
              </span>
            ) : (
              <span
                className="ab-gap"
                style={{ width: `${gapsMm[g] ?? 32}mm` }}
                aria-label="Lücke"
              />
            ))}
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
