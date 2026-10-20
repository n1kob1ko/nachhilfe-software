import { numberedLines, type PlanPart } from "@/lib/textinterpretation";

/**
 * A story line by line, exactly as pasted, with a line number every 5 lines (Textinterpretation). Each line
 * still knows its number (hover, screen readers via the list), so "Z. 12" can be found without counting.
 */
export function NumberedStory({
  text,
  countBlank = false,
  title,
  author,
  year,
  kind,
  className = "",
  headingLevel = 2,
}: {
  text: string;
  countBlank?: boolean;
  title?: string;
  author?: string;
  year?: string;
  kind?: string;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const lines = numberedLines(text, countBlank);
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={`ti-story ${className}`} data-testid="nummerierter-text">
      {title && (
        <div className="ti-story-head">
          {kind && <p className="ti-story-kind">{kind}</p>}
          <H className="ti-story-title">{title}</H>
          {(author || year) && <p className="ti-story-by">{[author ? `von ${author}` : "", year ? `(${year})` : ""].filter(Boolean).join(" ")}</p>}
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

/** The seven parts of the Schreibplan with their hint and word budget. */
export function SchreibplanList({ plan, className = "" }: { plan: PlanPart[]; className?: string }) {
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
