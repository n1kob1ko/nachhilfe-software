import { Check, CornerDownRight, HelpCircle, X } from "lucide-react";
import { PART_STATUS, WAY_STATUS, type StepStatus } from "@/lib/math-check";
import type { MathView, StepView } from "@/lib/math-task";
import type { TaskDraft } from "@/lib/tasks";
import { MathText } from "./MathText";

/**
 * The student's Rechenweg as the teacher reads it: every line with the app's mark, the Ergebnis, and
 * each part of a Sachaufgabe. A suggested Fehlerart is only a suggestion until the teacher confirms it.
 */

const ICON: Record<StepStatus, { icon: typeof Check; cls: string; text: string } | null> = {
  ok: { icon: Check, cls: "text-green", text: "stimmt" },
  folge: { icon: CornerDownRight, cls: "text-amber", text: "Folgefehler" },
  fehler: { icon: X, cls: "text-red", text: "Fehler" },
  unklar: { icon: HelpCircle, cls: "text-ink-3", text: "nicht sicher prüfbar" },
  notiz: null,
};

function Lines({ steps }: { steps: StepView[] }) {
  if (!steps.length) return <p className="text-[13px] text-ink-3">kein Rechenweg</p>;
  return (
    <ol className="squared max-w-[640px] rounded-lg border border-line px-3 py-1.5 text-[15px]">
      {steps.map((s, i) => {
        const m = ICON[s.status];
        const Icon = m?.icon;
        return (
          <li key={i} className="flex items-baseline gap-2 py-0.5">
            <span className="num w-5 shrink-0 text-right text-[12px] text-ink-3">{i + 1}</span>
            <span className={`min-w-0 flex-1 ${s.status === "fehler" ? "font-semibold text-red" : ""}`}>
              <MathText text={s.line} />
            </span>
            {m && Icon && (
              <span className={`inline-flex shrink-0 items-center gap-1 text-[12px] ${m.cls}`}>
                <Icon size={13} aria-hidden />
                {s.status === "fehler" && s.note ? `Vorschlag: ${s.note}` : (s.note ?? m.text)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const RESULT_CLS: Record<string, string> = { richtig: "text-green", teilweise: "text-amber", falsch: "text-red", unklar: "text-ink-2" };
const RESULT_TEXT: Record<string, string> = { richtig: "richtig", teilweise: "teilweise richtig", falsch: "falsch", unklar: "nicht sicher prüfbar" };

export function MathWork({ task, view, board }: { task: Pick<TaskDraft, "type" | "data">; view: MathView; board?: boolean }) {
  if (task.type === "sachaufgabe")
    return (
      <ol className="mt-3 space-y-3">
        {(task.data.parts ?? []).map((p, i) => {
          const r = view.parts?.[i];
          return (
            <li key={i} className="rounded-lg border border-line bg-paper px-3 py-2">
              <p className="text-[14px]">
                <span className="font-semibold">{p.label || `${String.fromCharCode(97 + i)})`}</span> <MathText text={p.prompt} />
              </p>
              {p.kind === "text" ? (
                <p className="mt-1 text-[15px] whitespace-pre-line">{r?.given || <span className="text-ink-3">keine Antwort</span>}</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {r?.steps && r.steps.length > 0 && <Lines steps={r.steps} />}
                  <p className="text-[15px]">
                    Antwort: <span className="font-semibold">{r?.given ? <MathText text={r.given} /> : "–"}</span>
                  </p>
                </div>
              )}
              {r && (
                <p className={`mt-1 text-[13px] font-semibold ${r.status === "falsch" ? "text-red" : r.status === "teilweise" || r.status === "offen" ? "text-amber" : "text-green"}`}>
                  {PART_STATUS[r.status]}
                  {r.status !== "richtig" && r.status !== "offen" && <span className="font-normal text-ink-2"> · {r.feedback}</span>}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    );
  return (
    <div className="mt-3 space-y-1.5">
      {board && !view.steps?.length ? <p className="text-[13px] text-ink-2">Rechenweg am Whiteboard</p> : <Lines steps={view.steps ?? []} />}
      {view.result && (
        <p className="text-[14px]">
          Ergebnis: <span className="font-semibold">{view.result.given ? <MathText text={view.result.given} /> : "–"}</span>
          {view.result.fromWay && <span className="text-ink-3"> (aus der letzten Zeile)</span>}
          <span className={`ml-2 font-semibold ${RESULT_CLS[view.result.status] ?? ""}`}>{RESULT_TEXT[view.result.status]}</span>
          {view.way && <span className="ml-2 text-ink-2">· {WAY_STATUS[view.way]}</span>}
        </p>
      )}
    </div>
  );
}
