import type { UnitReport } from "@/lib/learning";

const mins = (ms: number) => `${Math.max(0, Math.round(ms / 60_000))} min`;

/** The six things recorded automatically during a unit, in one short list. */
export function UnitSummary({ r }: { r: UnitReport }) {
  const helps = [r.help.hinweis && `${r.help.hinweis}× Hinweis`, r.help.erklaerung && `${r.help.erklaerung}× Erklärung`, r.help.loesung && `${r.help.loesung}× Lösung`].filter(Boolean).join(", ");
  const progress = r.skills
    .filter((s) => s.before !== null && s.after !== null && Math.round((s.after! - s.before!) * 100) !== 0)
    .sort((a, b) => Math.abs(b.after! - b.before!) - Math.abs(a.after! - a.before!))
    .slice(0, 3)
    .map((s) => `${s.name} ${Math.round(s.before! * 100)} % → ${Math.round(s.after! * 100)} %`);
  const rows: [string, string][] = [
    ["Dauer", mins(r.durationMs)],
    ["Bearbeitete Aufgaben", r.tasksDone === 0 ? "keine am Gerät" : `${r.tasksDone}${r.worksheets.length ? ` aus ${r.worksheets.map((w) => w.title).join(", ")}` : ""}`],
    ["Ergebnis", r.tasksDone === 0 ? "–" : `${r.correct} von ${r.tasksDone} richtig${r.successRate !== null ? ` (${Math.round(r.successRate * 100)} %)` : ""}`],
    ["Schwierigkeiten", r.errors.length ? r.errors.slice(0, 3).map((e) => `${e.label} (${e.count}×)`).join(", ") : "keine erkannt"],
    ["Hilfen", r.help.tasks ? `${r.help.tasks} ${r.help.tasks === 1 ? "Aufgabe" : "Aufgaben"} mit Hilfe${helps ? `: ${helps}` : ""}` : "keine"],
    ...(r.texts?.length ? [["Textarbeiten", r.texts.map((t) => `${t.title} (${t.words} ${t.words === 1 ? "Wort" : "Wörter"}${t.startedHere ? "" : `, ${t.added >= 0 ? "+" : ""}${t.added}`})`).join(", ")] as [string, string]] : []),
    ["Fortschritt", progress.length ? progress.join(" · ") : r.development.direction ? { besser: "wurde im Lauf der Einheit besser", gleich: "gleichbleibend", schlechter: "ließ gegen Ende nach" }[r.development.direction] : "noch zu wenig Aufgaben"],
  ];
  return (
    <dl className="panel grid gap-x-6 gap-y-3 px-5 py-4 text-[15px] sm:grid-cols-[180px_minmax(0,1fr)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-2">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
