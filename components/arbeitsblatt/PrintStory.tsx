import { numberedLines, type PlanPart } from "@/lib/textinterpretation";

/** A story on A4 line by line as pasted, a line number every 5 lines in the margin (Textinterpretation). */
export function PrintStory({ text, countBlank = false }: { text: string; countBlank?: boolean }) {
  return (
    <div className="ab-zeilen" data-testid="druck-text-zeilen">
      {numberedLines(text, countBlank).map((l, i) => (
        <p key={i} className="ab-zeile">
          <span className="ab-zeile-nr">{l.shown ? l.n : ""}</span>
          {l.text || " "}
        </p>
      ))}
    </div>
  );
}

/** The Schreibplan on the A4 sheet: the seven parts with their word budget and a short hint. */
export function PrintSchreibplan({ plan, target }: { plan: PlanPart[]; target: number }) {
  return (
    <section className="ab-plan" data-testid="druck-schreibplan">
      <p className="ab-plan-title">Schreibplan (ca. {target} Wörter)</p>
      <ol className="ab-plan-list">
        {plan.map((p) => (
          <li key={p.key}>
            <b>{p.title}</b> <span className="ab-plan-words">(ca. {p.words} Wörter)</span>: {p.hint}
          </li>
        ))}
      </ol>
    </section>
  );
}
