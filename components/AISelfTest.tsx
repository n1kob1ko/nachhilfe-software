"use client";

import { FlaskConical } from "lucide-react";
import { useState, useTransition } from "react";
import { selfTestAction, type SelfTestState } from "@/app/(tutor)/mehr/ki-kosten/actions";
import { Info } from "@/components/Info";
import { Pill } from "@/components/ui";

const usd = (x: number) => (x > 0 && x < 0.0001 ? "unter 0,0001 $" : `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: x > 0 && x < 0.1 ? 4 : 2 })} $`);

/** Mehr › KI-Kosten: a tiny request, then one Deutsch exercise, one Mathematik exercise and one Textkorrektur with invented data. */
export function AISelfTest({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<SelfTestState>(null);
  const [pending, start] = useTransition();
  const steps = state && "steps" in state ? state.steps : [];
  const total = steps.reduce((s, x) => s + x.usd, 0);
  return (
    <div>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button className="btn btn-secondary" disabled={!enabled || pending} onClick={() => start(async () => setState(await selfTestAction()))}>
          <FlaskConical size={15} className="text-accent" aria-hidden />
          {pending ? "KI wird getestet …" : "KI testen"}
        </button>
        <Info label="Was macht der KI-Test?">
          Zuerst eine sehr kleine Anfrage. Antwortet der Anbieter, folgen drei echte Anfragen mit erfundenen Daten: eine Deutschübung (Wortarten, 3. Klasse Volksschule), eine Mathematikübung (Gleichungen, 3. Klasse Mittelschule) und eine kurze Textkorrektur. Zusammen meist unter 5 Cent; die Kosten zählen zum Monatsbudget.
        </Info>
      </span>
      {state && "error" in state && <p className="mt-3 text-[14px] text-red">{state.error}</p>}
      {steps.length > 0 && (
        <div className="mt-4 space-y-3">
          {steps.map((s) => (
            <div key={s.key} className="panel px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{s.label}</span>
                <Pill tone={s.ok ? "green" : "red"}>{s.ok ? "ok" : "nicht bestanden"}</Pill>
                <span className="num text-[13px] text-ink-3">
                  {s.model || "–"} · {(s.ms / 1000).toLocaleString("de-AT", { maximumFractionDigits: 1 })}&nbsp;s · {usd(s.usd)}
                </span>
              </div>
              <p className="mt-1 text-[14px] text-ink-2">{s.message}</p>
              {s.details.length > 0 && <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] text-ink-2">{s.details.join("\n")}</pre>}
            </div>
          ))}
          <p className="text-[13px] text-ink-3">Zusammen {usd(total)}, wie vom Anbieter abgerechnet.</p>
        </div>
      )}
    </div>
  );
}
