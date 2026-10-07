import { Fragment } from "react";
import { splitFractions } from "@/lib/math-text";

/** Task text with fractions shown as numerator over denominator instead of "3/4". */
export function MathText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <>
      {splitFractions(text).map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <Fragment key={i}>
            {p.minus && "−"}
            <span className="frac" role="math" aria-label={`${p.num} durch ${p.den}`}>
              <span className="frac-num" aria-hidden>
                {p.num}
              </span>
              <span className="frac-den" aria-hidden>
                {p.den}
              </span>
            </span>
          </Fragment>
        ),
      )}
    </>
  );
}
