import type { PlanTeil } from "@/lib/schreibauftrag";
import { numberedLines } from "@/lib/textinterpretation";

/**
 * A story or Textbeilage line by line, exactly as pasted, with a line number every 5 lines (Schreibaufträge). Each
 * line still knows its number (hover, screen readers via the list), so "Z. 12" can be found without counting.
 */
export function NumberedStory({
  text,
  countBlank = false,
  title,
  author,
  year,
  medium,
  kind,
  className = "",
  headingLevel = 2,
}: {
  text: string;
  countBlank?: boolean;
  title?: string;
  author?: string;
  year?: string;
  /** the newspaper or magazine of a Textbeilage */
  medium?: string;
  kind?: string;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const lines = numberedLines(text, countBlank);
  const H = headingLevel === 2 ? "h2" : "h3";
  const where = [medium, year].filter(Boolean).join(", ");
  return (
    <div className={`ti-story ${className}`} data-testid="nummerierter-text">
      {title && (
        <div className="ti-story-head">
          {kind && <p className="ti-story-kind">{kind}</p>}
          <H className="ti-story-title">{title}</H>
          {(author || where) && <p className="ti-story-by">{[author ? `von ${author}` : "", where ? `(${where})` : ""].filter(Boolean).join(" ")}</p>}
        </div>
      )}
      <ol className="ti-lines" aria-label={`Text mit ${lines.filter((l) => l.n !== null).length} Zeilen`}>
        {lines.map((l, i) => (
          <li key={i} className={l.n === null ? "ti-line ti-blank" : "ti-line"} title={l.n !== null ? `Z. ${l.n}` : undefined} data-zeile={l.n ?? undefined}>
            <span className="ti-nr" aria-hidden={!l.shown}>
              {l.shown ? l.n : ""}
            </span>
            <span className="ti-text">{l.text || " "}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The parts of the Schreibplan with their hint and word budget. */
export function SchreibplanList({ plan, className = "" }: { plan: PlanTeil[]; className?: string }) {
  return (
    <ol className={`ti-plan ${className}`} data-testid="schreibplan">
      {plan.map((p, i) => (
        <li key={p.key} className="ti-plan-part">
          <span className="ti-plan-nr num" aria-hidden>
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="ti-plan-title">
              {p.title} <span className="ti-plan-words num">ca. {p.words} Wörter</span>
            </span>
            <span className="ti-plan-hint">{p.hint}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What a text of this Textsorte has (Anrede, Betreff, Konjunktiv …), next to the Schreibplan. */
export function MerkmaleList({ merkmale, className = "" }: { merkmale: string[]; className?: string }) {
  if (!merkmale.length) return null;
  return (
    <div className={className} data-testid="merkmale">
      <p className="text-[13px] font-semibold">Achte auf</p>
      <ul className="ti-merkmale">
        {merkmale.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
