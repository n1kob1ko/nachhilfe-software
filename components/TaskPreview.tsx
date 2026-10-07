import { categoryLabel, TASK_TYPES } from "@/lib/curriculum";
import type { Task } from "@/lib/repo";
import { GAP, hintLabel, type TaskDraft } from "@/lib/tasks";
import { MathText } from "./MathText";

function withGaps(text: string) {
  const parts = text.split(GAP);
  return parts.map((p, i) => (
    <span key={i}>
      <MathText text={p} />
      {i < parts.length - 1 && <span className="mx-1 inline-block w-20 border-b-2 border-ink-3 align-baseline" aria-label="Lücke" />}
    </span>
  ));
}

export function answerText(t: Pick<TaskDraft, "data" | "answer">) {
  if (t.data.options && typeof t.answer.correct === "number") return `${String.fromCharCode(97 + t.answer.correct)}) ${t.data.options[t.answer.correct]}`;
  if (t.answer.steps) return t.answer.steps.map((s, i) => `${i + 1}. ${s}`).join("  ");
  if (t.answer.blanks) return t.answer.blanks.map((b) => b[0]).join(" · ");
  if (t.answer.accepted) return t.answer.accepted[0];
  return null;
}

/** The task as the student sees it, plus the solution block for the teacher. */
export function TaskBody({ task, showSolution, skillName, subject, passageShown }: { task: TaskDraft; showSolution: boolean; skillName?: string; subject?: string; passageShown?: boolean }) {
  const cat = subject ? categoryLabel(subject, task.category) : null;
  return (
    <div className="min-w-0">
      {task.data.passage && !passageShown && <blockquote className="ruled mb-4 max-w-[70ch] rounded-lg bg-paper px-4 py-1 text-[15px]"><MathText text={task.data.passage} /></blockquote>}
      <p className="max-w-[70ch] text-[16px] leading-relaxed whitespace-pre-line">{task.prompt ? withGaps(task.prompt) : <span className="text-ink-3 italic">Noch keine Aufgabenstellung</span>}</p>
      {task.data.options && (
        <ol className="mt-2 space-y-1">
          {task.data.options.map((o, i) => (
            <li key={i} className={`flex gap-2 ${showSolution && task.answer.correct === i ? "font-semibold text-green" : ""}`}>
              <span className="text-ink-3">{String.fromCharCode(97 + i)})</span>
              <span>
                <MathText text={o} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {task.data.steps && (
        <ul className="mt-2 space-y-1">
          {task.data.steps.map((s, i) => (
            <li key={i} className="flex gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-[15px]">
              <span className="num text-ink-3" aria-hidden>
                ☐
              </span>
              <span>
                <MathText text={s} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {!task.data.options && !task.data.steps && !task.answer.blanks && !showSolution && <div className="mt-3 h-8 max-w-[360px] border-b border-dashed border-line-strong" aria-hidden />}
      <p className="no-print mt-2 text-[12px] text-ink-3">
        {cat ?? TASK_TYPES[task.type]}
        {cat && cat !== TASK_TYPES[task.type] && ` (${TASK_TYPES[task.type]})`}
        {skillName && ` · ${skillName}`}
        {` · ${task.difficulty}`}
      </p>
      {showSolution && (
        <div className="mt-3 rounded-lg border border-[#cfe3d6] bg-green-wash px-4 py-3 text-[14px]">
          {answerText(task) && (
            <p>
              <span className="font-semibold">Lösung:</span> <MathText text={answerText(task)} />
            </p>
          )}
          {task.answer.sample && !answerText(task) && (
            <p>
              <span className="font-semibold">Musterlösung:</span> <MathText text={task.answer.sample} />
            </p>
          )}
          {task.solution && <p className="mt-1 whitespace-pre-line text-ink-2"><MathText text={task.solution} /></p>}
          {task.hints.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[13px] text-ink-2">
              {task.hints.map((h, i) => (
                <li key={i}>
                  <span className="font-semibold text-ink-3">{hintLabel(i)}:</span> <MathText text={h} />
                </li>
              ))}
            </ul>
          )}
          {task.errorMap.length > 0 && (
            <p className="mt-1 text-[13px] text-ink-3">
              Typische Fehler: {task.errorMap.map((e) => e.label).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskPreview({ task, index, showSolution, skillName, subject, passageShown }: { task: Task; index: number; showSolution: boolean; skillName?: string; subject?: string; passageShown?: boolean }) {
  return (
    <li className="print-break grid grid-cols-[32px_1fr] gap-3 py-5">
      <span className="num pt-0.5 text-[15px] font-semibold text-ink-3">{index}.</span>
      <TaskBody task={task} showSolution={showSolution} skillName={skillName} subject={subject} passageShown={passageShown} />
    </li>
  );
}
