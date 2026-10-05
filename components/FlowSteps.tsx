import { Check } from "lucide-react";

const STEPS = ["Erstellen", "Vorschau prüfen", "Senden", "Ergebnis"];

/** Where the teacher is in the exercise flow: create → preview → send → result. */
export function FlowSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="no-print mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px]" aria-label="Ablauf einer Übung">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const on = n === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={on ? "step" : undefined}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${on ? "bg-accent text-white" : done ? "bg-green-wash text-green" : "bg-panel text-ink-3"}`}>
              {done ? <Check size={13} aria-hidden /> : n}
            </span>
            <span className={on ? "font-semibold text-ink" : "text-ink-2"}>{label}</span>
            {n < STEPS.length && <span className="h-px w-5 bg-line-strong" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
