"use client";

import { SpellCheck } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { startTextTestAction, textTestStateAction, type TextTestResult } from "@/app/(tutor)/mehr/ki-kosten/actions";
import { Info } from "@/components/Info";
import { Pill } from "@/components/ui";
import { WAYS, type TestSet, type TextTestState, type WayKey, type WayResult } from "@/lib/ai/textkorrektur-test-types";

const usd = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: x > 0 && x < 0.1 ? 4 : 2 })} $`;
const sec = (ms: number) => `${(ms / 1000).toLocaleString("de-AT", { maximumFractionDigits: 0 })} s`;

/** One row per way of correcting the run measured, summed over the texts where every one of them ran. */
function Totals({ totals, ways, texts }: { totals: Partial<Record<WayKey, WayResult>>; ways: readonly WayKey[]; texts: number }) {
  const cols: [string, string, (w: WayResult) => string][] = [
    ["Richtig korrigiert", "eingebaute Fehler, die der Vorschlag so verbessert wie die Musterkorrektur", (w) => `${w.score.fixed}/${w.score.errors}`],
    ["Falsch korrigiert", "Fehler gefunden, aber die Verbesserung stimmt nicht (von Hand nachprüfen)", (w) => String(w.score.wrongFix)],
    ["Verpasst", "eingebaute Fehler ohne Vorschlag", (w) => String(w.score.missed)],
    ["Richtiges geändert", "richtige Stellen, die als Fehler oder Stil markiert wurden", (w) => String(w.score.traps)],
    ["Weitere", "Vorschläge an Stellen ohne eingebauten Fehler (Fehler/Stil), von Hand nachprüfen", (w) => `${w.score.extraFehler}/${w.score.extraStil}`],
    ["Zweifelhaft ohne Markierung", "falsch korrigiert, Richtiges geändert oder weitere Fehler-Markierung, ohne „genau prüfen“", (w) => String(w.score.unflaggedDoubtful)],
    ["Richtige markiert", "richtige Korrekturen mit „genau prüfen“ (Mehrarbeit)", (w) => String(w.score.flaggedFixed)],
    ["Aussortiert", "von der zweiten Prüfung aussortiert: zweifelhafte/richtige", (w) => `${w.score.sortedOutDoubtful}/${w.score.sortedOutFixed}`],
    ["Kosten", "Summe der Anfragen", (w) => usd(w.usd)],
    ["Zeit je Text", "Wartezeit im Schnitt", (w) => sec(texts ? w.ms / texts : 0)],
  ];
  return (
    <div className="panel mt-3 overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-[14px]">
        <thead>
          <tr className="border-b border-line text-[12px] text-ink-3">
            <th className="px-5 py-3 font-semibold">Verfahren</th>
            {cols.map(([h, title]) => (
              <th key={h} className="px-3 py-3 text-right font-semibold" title={title}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {WAYS.filter((w) => ways.includes(w.key)).map((w) => {
            const t = totals[w.key];
            return (
              <tr key={w.key}>
                <td className="px-5 py-3 font-semibold">{w.label}</td>
                {cols.map(([h, , f]) => (
                  <td key={h} className="num whitespace-nowrap px-3 py-3 text-right">
                    {t ? f(t) : "–"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Mehr › KI-Kosten: the synthetic texts with their key, one-step correction against „gründlich“, or the independent texts with „gründlich neu“; at most 2 €. */
export function AITextTest({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<TextTestState | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const take = useCallback((r: TextTestResult) => {
    if ("error" in r) setError(r.error);
    else {
      setError("");
      setState(r.state);
    }
  }, []);
  useEffect(() => {
    textTestStateAction().then(take, () => {});
  }, [take]);
  const running = state?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => textTestStateAction().then(take, () => {}), 5_000);
    return () => clearInterval(t);
  }, [running, take]);
  const results = state?.results ?? [];
  const spent = results.reduce((s, r) => s + r.ways.filter((w) => ["einfach", "gruendlich", "gruendlich_neu"].includes(w.way)).reduce((n, w) => n + w.usd, 0), 0);
  const complete = results.filter((r) => r.ways.length === (state?.ways.length ?? WAYS.length)).length;
  const run = (set: TestSet) => start(async () => take(await startTextTestAction(set)));
  return (
    <div>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button className="btn btn-secondary" disabled={!enabled || pending || running} onClick={() => run("bekannt")}>
          <SpellCheck size={15} className="text-accent" aria-hidden />
          {running && state?.set === "bekannt" ? "Textkorrektur-Test läuft …" : "Textkorrektur-Test starten"}
        </button>
        <Info label="Was macht der Textkorrektur-Test?">
          Erfundene Schülertexte (Volksschule bis Oberstufe, Deutsch und Englisch) mit eingebauten Fehlern und unabhängig geprüfter Musterkorrektur. Jeder Text wird dreimal korrigiert, mit echten Anfragen: normal, gründlich wie bisher und gründlich neu (Satzprüfung mit Fassungsvergleich). Läuft im Hintergrund, meist 10 bis 20 Minuten, kostet etwa 1,60 € und höchstens 2 € (zählt zum Monatsbudget). Jeder Vorschlag mit Erklärung steht im Server-Log.
        </Info>
        <button className="btn btn-secondary" disabled={!enabled || pending || running} onClick={() => run("unabhaengig")}>
          <SpellCheck size={15} className="text-accent" aria-hidden />
          {running && state?.set === "unabhaengig" ? "Unabhängiger Test läuft …" : "Unabhängiger Test starten"}
        </button>
        <Info label="Was macht der unabhängige Test?">
          14 neue erfundene Schülertexte, an denen die KI-Anweisungen nie verbessert wurden (Volksschule bis Matura, Deutsch und Englisch), mit eigener Musterkorrektur. Jeder Text wird einmal so korrigiert, wie Lehrer es bekommen: gründlich neu. Läuft im Hintergrund, etwa 10 Minuten, kostet etwa 1 € und höchstens 2 € (zählt zum Monatsbudget). Jeder Vorschlag mit Erklärung steht im Server-Log.
        </Info>
      </span>
      {error && <p className="mt-3 text-[14px] text-red">{error}</p>}
      {state && (
        <div className="mt-4">
          <p className="text-[14px] text-ink-2">
            {state.set === "unabhaengig" ? "Unabhängiger Test. " : ""}
            {running ? `Läuft: ${results.length} von ${state.total} Texten fertig${state.active.length ? `, gerade ${state.active.join(", ")}` : ""}.` : `Fertig: ${complete} von ${state.total} Texten vollständig.`} Bisher {usd(spent)} (Grenze {usd(state.capUsd)}).
          </p>
          {state.totals && <Totals totals={state.totals} ways={state.ways} texts={complete} />}
          {results.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {results.map((r) => (
                <li key={r.nr} className="panel px-5 py-3 text-[14px]">
                  <p>
                    <span className="num font-semibold">{r.nr}</span> {r.title} <span className="text-ink-3">· {r.level}</span> {r.status !== "fertig" && <Pill tone={r.status === "fehler" ? "red" : "amber"}>{r.status}</Pill>}
                  </p>
                  <p className="text-ink-2">{r.summary}</p>
                  {r.lines.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[13px] text-accent">Ergebnisse ansehen</summary>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] text-ink-2">{r.lines.join("\n")}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
