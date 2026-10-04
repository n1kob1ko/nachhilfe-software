import { TASK_TYPES } from "@/lib/curriculum";
import type { Task } from "@/lib/repo";
import { GAP } from "@/lib/tasks";

function withGaps(text: string) {
  const parts = text.split(GAP);
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <span className="mx-1 inline-block w-20 border-b-2 border-ink-3 align-baseline" aria-label="Lücke" />}
    </span>
  ));
}

export function answerText(t: Task) {
  if (t.data.options && typeof t.answer.correct === "number") return `${String.fromCharCode(97 + t.answer.correct)}) ${t.data.options[t.answer.correct]}`;
  if (t.answer.blanks) return t.answer.blanks.map((b) => b[0]).join(" · ");
  if (t.answer.accepted) return t.answer.accepted[0];
  return null;
}

export function TaskPreview({ task, index, showSolution, skillName, passageShown }: { task: Task; index: number; showSolution: boolean; skillName?: string; passageShown?: boolean }) {
  return (
    <li className="print-break grid grid-cols-[32px_1fr] gap-3 py-5">
      <span className="num pt-0.5 text-[15px] font-semibold text-ink-3">{index}.</span>
      <div className="min-w-0">
        {task.data.passage && !passageShown && (
          <blockquote className="ruled mb-4 max-w-[70ch] rounded-lg bg-paper px-4 py-1 text-[15px]">{task.data.passage}</blockquote>
        )}
        <p className="max-w-[70ch] text-[16px] leading-relaxed whitespace-pre-line">{withGaps(task.prompt)}</p>
        {task.data.options && (
          <ol className="mt-2 space-y-1">
            {task.data.options.map((o, i) => (
              <li key={i} className={`flex gap-2 ${showSolution && task.answer.correct === i ? "font-semibold text-green" : ""}`}>
                <span className="text-ink-3">{String.fromCharCode(97 + i)})</span>
                {o}
              </li>
            ))}
          </ol>
        )}
        {!task.data.options && !task.answer.blanks && !showSolution && <div className="mt-3 h-8 max-w-[360px] border-b border-dashed border-line-strong" aria-hidden />}
        <p className="no-print mt-2 text-[12px] text-ink-3">
          {TASK_TYPES[task.type]}
          {skillName && ` · ${skillName}`}
        </p>
        {showSolution && (
          <div className="mt-3 rounded-lg border border-[#cfe3d6] bg-green-wash px-4 py-3 text-[14px]">
            {answerText(task) && (
              <p>
                <span className="font-semibold">Lösung:</span> {answerText(task)}
              </p>
            )}
            <p className="mt-1 whitespace-pre-line text-ink-2">{task.solution}</p>
            {task.hints.length > 0 && <p className="mt-2 text-[13px] text-ink-3">Hilfen: {task.hints.join(" · ")}</p>}
            {task.errorMap.length > 0 && (
              <p className="mt-1 text-[13px] text-ink-3">
                Typische Fehler: {task.errorMap.map((e) => e.label).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
