"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { aiInsightAction, type InsightState } from "@/app/actions";

export function AIInsight({ studentId, enabled }: { studentId: number; enabled: boolean }) {
  const [state, setState] = useState<InsightState>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button className="btn btn-secondary" disabled={!enabled || pending} onClick={() => start(async () => setState(await aiInsightAction(studentId)))}>
        <Sparkles size={15} className="text-accent" aria-hidden />
        {pending ? "Claude analysiert …" : "KI-Einschätzung erstellen"}
      </button>
      {!enabled && <p className="mt-2 text-[13px] text-ink-3">Benötigt einen ANTHROPIC_API_KEY (siehe README). Die Auswertung oben funktioniert auch ohne.</p>}
      {state && "error" in state && <p className="mt-3 text-[14px] text-red">{state.error}</p>}
      {state && "summary" in state && (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-[13px] font-semibold text-ink-2">Einschätzung</h3>
            <p className="max-w-[70ch]">{state.summary}</p>
          </div>
          <div>
            <h3 className="mb-1 text-[13px] font-semibold text-ink-2">Plan für die nächste Einheit</h3>
            <ol className="list-decimal space-y-1 pl-5">
              {state.next_lesson_plan.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <div className="md:col-span-2">
            <h3 className="mb-1 text-[13px] font-semibold text-ink-2">Notiz für die Eltern</h3>
            <p className="max-w-[70ch] text-ink-2">{state.parent_note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
