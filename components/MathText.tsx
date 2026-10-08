import { Fragment, type ReactNode } from "react";
import { parseMath, type MathNode } from "@/lib/math-format";

function nodes(list: MathNode[]): ReactNode {
  return list.map((n, i) => {
    if (typeof n === "string") return <Fragment key={i}>{n}</Fragment>;
    if (n.t === "sup")
      return (
        <sup key={i} className="m-sup">
          {nodes(n.body)}
        </sup>
      );
    if (n.t === "root")
      return (
        <span key={i} className="m-root">
          <span className="m-root-sign" aria-hidden>
            √
          </span>
          <span className="m-root-body">{nodes(n.body)}</span>
        </span>
      );
    return (
      <Fragment key={i}>
        {n.minus && "−"}
        <span className="frac" role="math">
          <span className="frac-num">{nodes(n.num)}</span>
          <span className="frac-den">{nodes(n.den)}</span>
        </span>
      </Fragment>
    );
  });
}

/**
 * Task text with maths typeset: fractions with a fraction bar instead of "3/4", powers raised (x^2, x²),
 * roots with a radical sign (sqrt(2), √2), · for * and a real minus sign (lib/math-format.ts, the same as on the A4 sheet).
 */
export function MathText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <>{nodes(parseMath(text))}</>;
}
