import { Fragment } from "react";
import {
  shortAnswer,
  type SheetDoc,
  type SheetOptions,
  type SheetTask,
  type WorkArea as WorkAreaType,
} from "@/lib/arbeitsblatt";
import { GAP } from "@/lib/tasks";
import { MathLine, RichText } from "./MathLine";
import { Lines, WorkField } from "./WorkArea";
import { Marked } from "@/components/FixMarks";
import { markFaultyText } from "@/lib/fix-text";

const letter = (i: number) => String.fromCharCode(97 + i);

function Header({
  doc,
  o,
  teacher,
}: {
  doc: SheetDoc;
  o: SheetOptions;
  teacher: boolean;
}) {
  const meta = [
    o.subject && doc.subject,
    o.klasse && doc.klasseLabel,
    o.topic && doc.topic,
  ].filter(Boolean) as string[];
  return (
    <header className="ab-head">
      <div className="ab-head-main">
        <h1 className="ab-title">
          <MathLine text={o.title} />
          {teacher && <span className="ab-tag">Lehrerfassung</span>}
        </h1>
        {meta.length > 0 && <p className="ab-meta">{meta.join(" · ")}</p>}
        {(o.skill || teacher) && doc.skills.length > 0 && (
          <p className="ab-meta">Fähigkeit: {doc.skills.join(", ")}</p>
        )}
      </div>
      {!teacher && (o.name || o.date) && (
        <div className="ab-fields">
          {o.name && (
            <p className="ab-field">
              <span>Name:</span>
              <span className="ab-field-line">{doc.studentName}</span>
            </p>
          )}
          {o.date && (
            <p className="ab-field">
              <span>Datum:</span>
              <span className="ab-field-line" />
            </p>
          )}
        </div>
      )}
    </header>
  );
}

function Passage({ text }: { text: string }) {
  return (
    <div className="ab-passage">
      <RichText text={text} />
    </div>
  );
}

/** "Berechne …" – field for working – "Ergebnis: ___": the result line comes after the field. */
function PromptAroundArea({
  prompt,
  gapsMm,
  area,
}: {
  prompt: string;
  gapsMm: number[];
  area: WorkAreaType;
}) {
  const lines = prompt.trimEnd().split("\n");
  const last = lines.pop()!;
  const tailGaps = last.split(GAP).length - 1;
  return (
    <>
      <RichText
        text={lines.join("\n")}
        gapsMm={gapsMm.slice(0, gapsMm.length - tailGaps)}
      />
      <WorkField area={area} />
      <div className="ab-result">
        <RichText text={last} gapsMm={gapsMm.slice(gapsMm.length - tailGaps)} />
      </div>
    </>
  );
}

/** One task as the student gets it: prompt, choices, room to work and write. */
function StudentTask({ t, o }: { t: SheetTask; o: SheetOptions }) {
  const { task, plan } = t;
  return (
    <div className={o.numbers ? "ab-task" : "ab-task ab-task-plain"}>
      {o.numbers && <span className="ab-num">{t.n}</span>}
      <div className="ab-body">
        {plan.areaBeforeLastLine && plan.area ? (
          <PromptAroundArea
            prompt={task.prompt}
            gapsMm={plan.gapsMm}
            area={plan.area}
          />
        ) : (
          <RichText text={task.prompt} gapsMm={plan.gapsMm} />
        )}
        {task.type === "fix" && task.data.faulty && <p className="ab-faulty">{task.data.faulty}</p>}
        {task.data.options && (
          <ol
            className={
              plan.optionColumns === 2
                ? "ab-options ab-options-2"
                : "ab-options"
            }
          >
            {task.data.options.map((x, i) => (
              <li key={i}>
                <span className="ab-box" aria-hidden />
                <span className="ab-option-letter">{letter(i)})</span>
                <span>
                  <MathLine text={x} />
                </span>
              </li>
            ))}
          </ol>
        )}
        {task.data.steps && (
          <ul className="ab-steps">
            {task.data.steps.map((s, i) => (
              <li key={i}>
                <span className="ab-step-box" aria-hidden />
                <span>
                  <MathLine text={s} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {plan.area && !plan.areaBeforeLastLine && (
          <WorkField area={plan.area} />
        )}
        {plan.lines > 0 && (
          <Lines count={plan.lines} label={plan.answerLabel} />
        )}
      </div>
    </div>
  );
}

/** The task with its solution, solution path, skill, difficulty and typical errors (teacher version only). */
function TeacherTask({ t, o }: { t: SheetTask; o: SheetOptions }) {
  const { task } = t;
  const answer = shortAnswer(task);
  const steps = task.solutionSteps?.length ? task.solutionSteps : null;
  const errors = task.errorMap.filter(
    (e, i, all) =>
      all.findIndex((x) => x.answer === e.answer && x.label === e.label) === i,
  );
  return (
    <div className={o.numbers ? "ab-task" : "ab-task ab-task-plain"}>
      {o.numbers && <span className="ab-num">{t.n}</span>}
      <div className="ab-body">
        <RichText
          text={task.prompt}
          gapsMm={t.plan.gapsMm}
          gapAnswers={
            task.answer.blanks?.map((b) => b[0] ?? null) ??
            (task.prompt.split(GAP).length === 2
              ? [task.answer.accepted?.[0] ?? null]
              : undefined)
          }
        />
        {task.data.options && (
          <ol
            className={
              t.plan.optionColumns === 2
                ? "ab-options ab-options-2"
                : "ab-options"
            }
          >
            {task.data.options.map((x, i) => (
              <li
                key={i}
                className={task.answer.correct === i ? "ab-correct" : undefined}
              >
                <span className="ab-box" aria-hidden>
                  {task.answer.correct === i ? "✓" : ""}
                </span>
                <span className="ab-option-letter">{letter(i)})</span>
                <span>
                  <MathLine text={x} />
                </span>
              </li>
            ))}
          </ol>
        )}
        {task.type === "fix" && task.data.faulty && (
          <Marked marks={markFaultyText(task.data.faulty, task.answer.accepted?.[0] ?? task.data.faulty, task.answer.mode !== "text")} className="ab-faulty" />
        )}
        {task.data.steps && !task.answer.steps && (
          <ul className="ab-steps">
            {task.data.steps.map((s, i) => (
              <li key={i}>
                <span className="ab-step-box" aria-hidden />
                <MathLine text={s} />
              </li>
            ))}
          </ul>
        )}
        <div className="ab-solution">
          {answer && (
            <p>
              <b>Lösung:</b> <MathLine text={answer} />
            </p>
          )}
          {task.type === "fix" && (task.answer.accepted?.length ?? 0) > 1 && (
            <p>
              <b>Auch richtig:</b> {task.answer.accepted!.slice(1).join(" · ")}
            </p>
          )}
          {task.answer.blanks?.some((b) => b.length > 1) && (
            <p>
              <b>Auch richtig:</b>{" "}
              {task.answer.blanks
                .map((b, i) => (b.length > 1 ? `Lücke ${i + 1}: ${b.slice(1).join(", ")}` : ""))
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {task.type === "fix" && task.answer.fixes && task.answer.fixes.length > 0 && (
            <div className="ab-solution-errors">
              <b>Fehler im Text:</b>
              <ul>
                {task.answer.fixes.map((f, i) => (
                  <li key={i}>
                    „{f.wrong || "–"}“ → „{f.right || "–"}“{f.label ? `: ${f.label}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {task.answer.sample && (
            <p>
              <b>{answer ? "Musterantwort:" : "Lösung (Muster):"}</b>{" "}
              <MathLine text={task.answer.sample} />
            </p>
          )}
          {task.answer.criteria && task.answer.criteria.length > 0 && (
            <div className="ab-solution-errors">
              <b>Darauf kommt es an:</b>
              <ul>
                {task.answer.criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {(task.solution || steps) && (
            <div className="ab-solution-path">
              <b>Lösungsweg:</b>
              {steps ? (
                <ol>
                  {steps.map((s, i) => (
                    <li key={i}>
                      <MathLine text={s} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="ab-pre">
                  <MathLine text={task.solution} />
                </p>
              )}
            </div>
          )}
          <p className="ab-solution-meta">
            {[
              t.skillName && `Fähigkeit: ${t.skillName}`,
              `Schwierigkeit: ${task.difficulty}`,
              t.typeLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {errors.length > 0 && (
            <div className="ab-solution-errors">
              <b>Typische Fehler:</b>
              <ul>
                {errors.map((e, i) => (
                  <li key={i}>
                    {task.data.options && /^\d+$/.test(e.answer) ? (
                      <>
                        {letter(Number(e.answer))}): {e.label}
                      </>
                    ) : e.answer ? (
                      <>
                        „<MathLine text={e.answer} />
                        “: {e.label}
                      </>
                    ) : (
                      e.label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Answers on a page of their own, to cut off or hand out later. No teacher information. */
function SolutionPage({ doc, o }: { doc: SheetDoc; o: SheetOptions }) {
  return (
    <section className="ab-solutions" aria-label="Lösungen">
      <h2 className="ab-solutions-title">
        Lösungen · <MathLine text={o.title} />
      </h2>
      <ol className="ab-solutions-list">
        {doc.tasks.map((t) => {
          const a = shortAnswer(t.task) ?? t.task.answer.sample ?? null;
          return (
            <li key={t.n}>
              <span className="ab-num">{t.n}</span>
              <div>
                {a ? (
                  <MathLine text={a} />
                ) : (
                  <span className="ab-muted">offene Antwort</span>
                )}
                {t.task.solution && (
                  <p className="ab-pre ab-muted">
                    <MathLine text={t.task.solution} />
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Sheet({ doc, o }: { doc: SheetDoc; o: SheetOptions }) {
  const teacher = o.fassung === "lehrer";
  return (
    <article className="ab-sheet" lang="de">
      <Header doc={doc} o={o} teacher={teacher} />
      <div className="ab-tasks">
        {doc.tasks.map((t) => (
          <Fragment key={t.n}>
            {t.passage && <Passage text={t.passage} />}
            {teacher ? (
              <TeacherTask t={t} o={o} />
            ) : (
              <StudentTask t={t} o={o} />
            )}
          </Fragment>
        ))}
      </div>
      {!teacher && o.solutions === "seite" && <SolutionPage doc={doc} o={o} />}
    </article>
  );
}

/** @page rules: A4 portrait, a wider left margin for punching, page numbers when chosen. */
export function PageStyle({ o }: { o: Pick<SheetOptions, "pages" | "title"> }) {
  const esc = (s: string) =>
    s.replace(/[\\"]/g, "\\$&").replace(/\n/g, " ").slice(0, 80);
  const numbers = o.pages
    ? `@bottom-right { content: "Seite " counter(page) " von " counter(pages); font: 8.5pt sans-serif; color: #555; }
       @bottom-left { content: "${esc(o.title)}"; font: 8.5pt sans-serif; color: #777; }`
    : "";
  return (
    <style>{`@page { size: A4 portrait; margin: 14mm 15mm 15mm 20mm; ${numbers} }`}</style>
  );
}
