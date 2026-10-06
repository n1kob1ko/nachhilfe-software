import { CheckCircle2, XCircle } from "lucide-react";
import { SectionTitle } from "@/components/ui";
import { errorTypeLabel } from "@/lib/error-types";
import { HELP_LABEL, type TaskLine, type UnitReport } from "@/lib/learning";

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const mins = (ms: number) => `${Math.max(0, Math.round(ms / 60_000))} min`;
const secs = (ms: number | null) => (ms === null ? "–" : ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")} s`);

const STATE = {
  sicher: { label: "sicher", cls: "text-green" },
  unsicher: { label: "unsicher", cls: "text-amber" },
  problem: { label: "Problem", cls: "text-red" },
} as const;

/** All data collected during a unit, grouped the way a tutor reads it. */
export function UnitReportView({ r }: { r: UnitReport }) {
  const task = (id: number) => r.tasks.find((t) => t.taskId === id)!;
  if (r.tasksDone === 0 && r.tasks.length === 0) {
    return <p className="text-[14px] text-ink-2">Keine Aufgaben am Gerät bearbeitet.</p>;
  }
  const facts: [string, string][] = [
    ["Fach", r.subjects.join(", ") || "–"],
    ["Thema", r.topics.join(", ") || "–"],
    ["Unterthemen", r.subtopics.join(", ") || "–"],
    ["Übungen", r.worksheets.map((w) => w.title).join(" · ") || "–"],
    ["Schwierigkeit", r.difficulties.map((d) => `${d.level} (${d.count})`).join(", ") || "–"],
    ["Dauer / aktiv", `${mins(r.durationMs)} / ${mins(r.activeMs)} aktiv gearbeitet`],
  ];
  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {[
          ["Aufgaben", String(r.tasksDone)],
          ["Richtig", `${r.correct} (${pct(r.successRate)})`],
          ["Falsch", String(r.wrong)],
          ["1. Versuch ohne Hilfe", String(r.firstTry)],
          ["Mehrere Versuche", String(r.multiTry)],
          ["Mit Hilfe", String(r.help.tasks)],
          ["Ø Zeit pro Aufgabe", secs(r.speed.avgMs)],
          ["Verlauf in der Einheit", r.development.direction ? { besser: "wird besser", gleich: "gleichbleibend", schlechter: "lässt nach" }[r.development.direction] : "zu wenig Aufgaben"],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <dt className="text-[12px] font-semibold text-ink-3">{k}</dt>
            <dd className="num mt-0.5 text-[17px] font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <dl className="grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-[140px_1fr]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <SectionTitle>Ergebnis pro Fähigkeit</SectionTitle>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-3">
                <th className="px-4 py-2.5 font-semibold">Fähigkeit</th>
                <th className="px-2 py-2.5 text-right font-semibold">Aufgaben</th>
                <th className="px-2 py-2.5 text-right font-semibold">richtig</th>
                <th className="px-2 py-2.5 text-right font-semibold">1. Versuch</th>
                <th className="px-2 py-2.5 text-right font-semibold">mit Hilfe</th>
                <th className="px-2 py-2.5 text-right font-semibold">Ø Zeit</th>
                <th className="px-2 py-2.5 font-semibold">Stand vorher → nachher</th>
                <th className="px-4 py-2.5 font-semibold">Einschätzung</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-line">
              {r.skills.map((s) => (
                <tr key={s.skillId}>
                  <td className="px-4 py-2.5 font-sans">
                    <span className="font-medium">{s.name}</span> <span className="text-ink-3">· {s.area}</span>
                  </td>
                  <td className="px-2 py-2.5 text-right">{s.done}</td>
                  <td className="px-2 py-2.5 text-right">{s.correct}</td>
                  <td className="px-2 py-2.5 text-right">{s.firstTry}</td>
                  <td className="px-2 py-2.5 text-right">{s.withHelp}</td>
                  <td className="px-2 py-2.5 text-right">{secs(s.avgTimeMs)}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {pct(s.before)} → <span className="font-semibold">{pct(s.after)}</span>
                    {s.before !== null && s.after !== null && Math.abs(s.after - s.before) >= 0.01 && (
                      <span className={s.after > s.before ? "text-green" : "text-red"}>
                        {" "}
                        ({s.after > s.before ? "+" : ""}
                        {Math.round((s.after - s.before) * 100)})
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-2.5 font-sans font-semibold ${STATE[s.state].cls}`}>{STATE[s.state].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <SectionTitle>Fehleranalyse</SectionTitle>
          {r.errors.length === 0 ? (
            <p className="text-[14px] text-ink-2">Keine typischen Fehler erkannt.</p>
          ) : (
            <ul className="space-y-1.5 text-[14px]">
              {r.errors.map((e) => (
                <li key={e.label} className="flex justify-between gap-3">
                  <span>
                    <span className="font-medium text-red">{e.label}</span>
                    {e.skills.length > 0 && <span className="text-ink-3"> · {e.skills.join(", ")}</span>}
                  </span>
                  <span className="num shrink-0 text-ink-2">{e.count > 1 ? `${e.count}× wiederkehrend` : "1×"}</span>
                </li>
              ))}
            </ul>
          )}
          {r.errorTypes && r.errorTypes.length > 0 && (
            <p className="mt-3 text-[14px] text-ink-2">
              Fehlerarten:{" "}
              {r.errorTypes
                .map((e) => {
                  const more = [e.count > 1 ? `${e.count}×` : "", e.confirmed ? "" : "Vorschlag"].filter(Boolean);
                  return `${errorTypeLabel(e.type)}${more.length ? ` (${more.join(", ")})` : ""}`;
                })
                .join(", ")}
            </p>
          )}
          <p className="mt-3 text-[14px] text-ink-2">
            Fehler selbst korrigiert: <span className="num font-semibold text-ink">{r.correction.selbst}</span> nur mit der Rückmeldung,{" "}
            <span className="num font-semibold text-ink">{r.correction.nachHilfe}</span> nach einer Hilfe; nicht gelöst: <span className="num font-semibold text-ink">{r.correction.nicht}</span>.
          </p>
          {r.problemTasks.length > 0 && <TaskList title="Aufgaben mit Schwierigkeiten" tasks={r.problemTasks.map(task)} />}
        </section>
        <section>
          <SectionTitle>Hilfestellungen</SectionTitle>
          <ul className="space-y-1.5 text-[14px]">
            <li className="flex justify-between gap-3">
              <span>Aufgaben mit Hilfe</span>
              <span className="num font-semibold">{r.help.tasks}</span>
            </li>
            <li className="flex justify-between gap-3 text-ink-2">
              <span>davon ein Hinweis gereicht</span>
              <span className="num">{r.help.hinweis}</span>
            </li>
            <li className="flex justify-between gap-3 text-ink-2">
              <span>ausführliche Erklärung nötig</span>
              <span className="num">{r.help.erklaerung}</span>
            </li>
            <li className="flex justify-between gap-3 text-ink-2">
              <span>Lösungsweg angesehen</span>
              <span className="num">{r.help.loesung}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>danach selbstständig gelöst</span>
              <span className="num font-semibold">{r.help.solvedAfterHelp}</span>
            </li>
          </ul>
          {r.help.tasks > 0 && <TaskList title="Aufgaben mit Hilfe" tasks={r.tasks.filter((t) => t.help !== "keine")} showHelp />}
        </section>
      </div>

      <section>
        <SectionTitle>Geschwindigkeit und Sicherheit</SectionTitle>
        <div className="grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
          <p>
            Sicher gearbeitet: <span className="font-medium">{r.skills.filter((s) => s.state === "sicher").map((s) => s.name).join(", ") || "–"}</span>
          </p>
          <p>
            Unsicher: <span className="font-medium">{r.skills.filter((s) => s.state !== "sicher").map((s) => s.name).join(", ") || "–"}</span>
          </p>
          <p>
            Lange Pausen (über 2 min ohne Eingabe): <span className="num font-semibold">{r.speed.pauses}</span>
          </p>
          <p>
            Aufgaben mit drei Versuchen: <span className="num font-semibold">{r.speed.manyRetries}</span>
          </p>
        </div>
        <div className="mt-2 grid gap-6 sm:grid-cols-2">
          {r.speed.slow.length > 0 && <TaskList title="Besonders langsam" tasks={r.speed.slow.map(task)} />}
          {r.speed.fast.length > 0 && <TaskList title="Besonders schnell" tasks={r.speed.fast.map(task)} />}
        </div>
      </section>

      <details className="text-[14px]">
        <summary className="cursor-pointer font-semibold text-ink-2 hover:text-ink">Alle {r.tasks.length} Aufgaben im Detail</summary>
        <div className="panel mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-3">
                <th className="px-4 py-2 font-semibold">Aufgabe</th>
                <th className="px-2 py-2 font-semibold">Fähigkeit</th>
                <th className="px-2 py-2 text-right font-semibold">Versuche</th>
                <th className="px-2 py-2 font-semibold">Hilfe</th>
                <th className="px-2 py-2 text-right font-semibold">Zeit</th>
                <th className="px-4 py-2 font-semibold">Ergebnis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.tasks.map((t) => (
                <tr key={`${t.assignmentId}-${t.taskId}`} className="align-top">
                  <td className="max-w-[36ch] px-4 py-2">{t.prompt}</td>
                  <td className="px-2 py-2 text-ink-2">
                    {t.skill}
                    <div className="text-[12px] text-ink-3">{t.difficulty}</div>
                  </td>
                  <td className="num px-2 py-2 text-right">{t.tries}</td>
                  <td className="px-2 py-2 text-ink-2">{HELP_LABEL[t.help]}</td>
                  <td className="num px-2 py-2 text-right">{secs(t.activeMs)}</td>
                  <td className="px-4 py-2">
                    <Result t={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Result({ t }: { t: TaskLine }) {
  if (!t.finished) return <span className="text-ink-3">nicht fertig</span>;
  return (
    <span className={`inline-flex flex-col ${t.correct ? "text-green" : "text-red"}`}>
      <span className="inline-flex items-center gap-1 font-medium">
        {t.correct ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
        {t.correct ? (t.firstTry ? "richtig, 1. Versuch" : t.corrected === "nach-hilfe" ? "nach Hilfe korrigiert" : t.corrected === "selbst" ? "selbst korrigiert" : "richtig") : "falsch"}
      </span>
      {t.errors.length > 0 && <span className="text-[12px]">{t.errors.join(", ")}</span>}
      {t.errors.length === 0 && t.errorTypes && t.errorTypes.length > 0 && <span className="text-[12px]">{t.errorTypes.map(errorTypeLabel).join(", ")}</span>}
    </span>
  );
}

function TaskList({ title, tasks, showHelp }: { title: string; tasks: TaskLine[]; showHelp?: boolean }) {
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-[13px] font-semibold text-ink-2">{title}</h3>
      <ul className="space-y-1 text-[13px]">
        {tasks.slice(0, 6).map((t) => (
          <li key={`${t.assignmentId}-${t.taskId}`} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{t.prompt}</span>
            <span className="shrink-0 text-ink-3">{showHelp ? `${HELP_LABEL[t.help]}${t.solvedAfterHelp ? ", dann gelöst" : ""}` : `${t.skill} · ${secs(t.activeMs)}`}</span>
          </li>
        ))}
        {tasks.length > 6 && <li className="text-ink-3">und {tasks.length - 6} weitere</li>}
      </ul>
    </div>
  );
}
