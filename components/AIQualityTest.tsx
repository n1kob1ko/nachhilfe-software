"use client";

import { ClipboardCheck } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { qualityTestStateAction, startQualityTestAction, type QualityTestState } from "@/app/(tutor)/mehr/ki-kosten/actions";
import { Info } from "@/components/Info";
import { Pill } from "@/components/ui";
import type { RunState } from "@/lib/ai/qualitaetstest";

const usd = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: x > 0 && x < 0.1 ? 4 : 2 })} $`;
const sec = (ms: number) => `${(ms / 1000).toLocaleString("de-AT", { maximumFractionDigits: 1 })} s`;

/** Mehr › KI-Kosten: 20 lessons with invented data and a few comparisons, in the background, at most 1 €. */
export function AIQualityTest({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<RunState | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const take = useCallback((r: QualityTestState) => {
    if ("error" in r) setError(r.error);
    else {
      setError("");
      setState(r.state);
    }
  }, []);

  useEffect(() => {
    qualityTestStateAction().then(take, () => {});
  }, [take]);
  const running = state?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => qualityTestStateAction().then(take, () => {}), 4_000);
    return () => clearInterval(t);
  }, [running, take]);

  const results = state?.results ?? [];
  const total = results.reduce((s, r) => s + r.usd, 0);
  const done = results.filter((r) => r.status !== "übersprungen");
  const avg = done.length ? done.reduce((s, r) => s + r.ms, 0) / done.length : 0;
  return (
    <div>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button className="btn btn-secondary" disabled={!enabled || pending || running} onClick={() => start(async () => take(await startQualityTestAction()))}>
          <ClipboardCheck size={15} className="text-accent" aria-hidden />
          {running ? "Qualitätstest läuft …" : "Qualitätstest starten"}
        </button>
        <Info label="Was macht der Qualitätstest?">
          20 Unterrichtstests von der Volksschule bis zur Oberstufe (Übungen, Leseverständnis, Textkorrektur) mit erfundenen Daten, dazu Vergleiche für Tempo und Modell. Läuft im Hintergrund, meist 5 bis 10 Minuten. Kostet höchstens 1 €, meist deutlich weniger; die Kosten zählen zum Monatsbudget. Die Ergebnisse stehen hier und vollständig im Server-Log.
        </Info>
      </span>
      {error && <p className="mt-3 text-[14px] text-red">{error}</p>}
      {state && (
        <div className="mt-4">
          <p className="text-[14px] text-ink-2">
            {running ? `Läuft: ${results.length} von ${state.total} Tests fertig${state.active.length ? `, gerade ${state.active.join(", ")}` : ""}.` : `Fertig: ${done.length} von ${state.total} Tests${results.length > done.length ? `, ${results.length - done.length} übersprungen` : ""}.`} Bisher {usd(total)} (Grenze {usd(state.capUsd)}), im Schnitt {sec(avg)} je Test.
          </p>
          {results.length > 0 && (
            <div className="panel mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] text-ink-3">
                    <th className="px-5 py-3 font-semibold">Nr.</th>
                    <th className="px-3 py-3 font-semibold">Test</th>
                    <th className="px-3 py-3 font-semibold">Modell</th>
                    <th className="px-3 py-3 text-right font-semibold">Dauer</th>
                    <th className="px-3 py-3 text-right font-semibold">Kosten</th>
                    <th className="px-5 py-3 font-semibold">Ergebnis der App-Prüfung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {results.map((r) => (
                    <tr key={r.nr} className="align-top">
                      <td className="num px-5 py-3">{r.nr}</td>
                      <td className="px-3 py-3">
                        <span className="font-semibold">{r.title}</span>
                        <span className="block text-[12px] text-ink-3">
                          {r.level}
                          {r.variant ? ` · ${r.variant}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[12px]">{r.models.join(", ") || "–"}</td>
                      <td className="num whitespace-nowrap px-3 py-3 text-right">
                        {sec(r.ms)}
                        <span className="block text-[12px] text-ink-3">{r.calls.length} Aufrufe</span>
                      </td>
                      <td className="num whitespace-nowrap px-3 py-3 text-right">{usd(r.usd)}</td>
                      <td className="px-5 py-3">
                        {r.status !== "fertig" && <Pill tone={r.status === "fehler" ? "red" : "amber"}>{r.status}</Pill>} <span className="text-ink-2">{r.summary}</span>
                        {r.lines.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[13px] text-accent">Ausgaben ansehen</summary>
                            <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] text-ink-2">{r.lines.join("\n")}</pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
