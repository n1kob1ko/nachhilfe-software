import type { PlanTeil } from "@/lib/schreibauftrag";
import { numberedLines } from "@/lib/textinterpretation";

/** A story or Textbeilage on A4 line by line as pasted, a line number every 5 lines in the margin (Schreibaufträge). */
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

/** The Schreibplan on the A4 sheet: the parts with their word budget and a short hint, and what to look out for. */
export function PrintSchreibplan({ plan, target, merkmale = [] }: { plan: PlanTeil[]; target: number; merkmale?: string[] }) {
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
      {merkmale.length > 0 && (
        <p className="ab-plan-merkmale" data-testid="druck-merkmale">
          <b>Achte auf:</b> {merkmale.join(" · ")}
        </p>
      )}
    </section>
  );
}
