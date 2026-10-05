"use client";

import { useState } from "react";
import { prettyFormula, type TaskForBoard } from "@/lib/whiteboard-templates";

export type WorksheetForBoard = { id: number; title: string; tasks: TaskForBoard[] };
type Range = { xMin: number; xMax: number; yMin: number; yMax: number };

type Props = {
  worksheets: WorksheetForBoard[];
  onClose: () => void;
  onTasks: (title: string, tasks: TaskForBoard[]) => void;
  onSolution: (t: TaskForBoard) => void;
  onText: (text: string, framed: boolean) => void;
  onFormula: (f: string) => void;
  onTable: (rows: number, cols: number, headings: string[]) => void;
  onCoordinates: (r: Range) => void;
  onNewPage: (kind: "leer" | "kariert" | "liniert" | "koordinaten") => void;
};

const RANGES: { label: string; r: Range }[] = [
  { label: "−5 bis 5", r: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 } },
  { label: "0 bis 10", r: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 } },
  { label: "−10 bis 10", r: { xMin: -10, xMax: 10, yMin: -6, yMax: 6 } },
];

/** Side panel of the teacher: put tasks, solutions, text, formulas, tables and paper onto the board. */
export function InsertPanel(p: Props) {
  const [open, setOpen] = useState<number | null>(p.worksheets[0]?.id ?? null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [framed, setFramed] = useState(true);
  const [formula, setFormula] = useState("");
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  const [heads, setHeads] = useState("");

  const keyOf = (w: number, t: number) => `${w}:${t}`;
  const toggle = (k: string) => setPicked((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])));

  return (
    <aside className="wb-panel" aria-label="Einfügen">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[16px] font-semibold">Einfügen</h2>
        <button className="wb-btn" onClick={p.onClose} aria-label="Schließen">
          ×
        </button>
      </div>
      <div className="grid gap-6 overflow-y-auto px-4 py-4">
        <section>
          <h3 className="wb-h">Neue Seite</h3>
          <div className="grid grid-cols-2 gap-2">
            <button className="wb-chip" onClick={() => p.onNewPage("leer")}>Leere Fläche</button>
            <button className="wb-chip" onClick={() => p.onNewPage("kariert")}>Kariert</button>
            <button className="wb-chip" onClick={() => p.onNewPage("liniert")}>Liniert</button>
            <button className="wb-chip" onClick={() => p.onNewPage("koordinaten")}>Koordinatensystem</button>
          </div>
        </section>

        <section>
          <h3 className="wb-h">Aufgaben des Schülers</h3>
          {p.worksheets.length === 0 && <p className="text-[13px] text-ink-2">Noch keine Übungen gesendet.</p>}
          <div className="grid gap-2">
            {p.worksheets.map((w) => (
              <div key={w.id} className="rounded-lg border border-line">
                <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[14px] font-medium" onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id}>
                  <span className="min-w-0 truncate">{w.title}</span>
                  <span className="text-ink-3">{open === w.id ? "–" : "+"}</span>
                </button>
                {open === w.id && (
                  <div className="grid gap-1 border-t border-line px-2 py-2">
                    {w.tasks.map((t) => (
                      <div key={t.number} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-panel">
                        <label className="flex min-w-0 flex-1 items-start gap-2 text-[13px]">
                          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={picked.has(keyOf(w.id, t.number))} onChange={() => toggle(keyOf(w.id, t.number))} />
                          <span>
                            <span className="num font-semibold">{t.number})</span> {t.prompt}
                          </span>
                        </label>
                        {t.solution && (
                          <button className="shrink-0 text-[12px] font-medium text-green hover:underline" onClick={() => p.onSolution(t)}>
                            Lösung
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="mt-1 flex flex-wrap gap-2 px-1">
                      <button
                        className="wb-chip wb-chip-primary"
                        disabled={!w.tasks.some((t) => picked.has(keyOf(w.id, t.number)))}
                        onClick={() => {
                          p.onTasks(w.title, w.tasks.filter((t) => picked.has(keyOf(w.id, t.number))));
                          setPicked(new Set());
                        }}
                      >
                        Ausgewählte einfügen
                      </button>
                      <button className="wb-chip" onClick={() => p.onTasks(w.title, w.tasks)}>
                        Alle {w.tasks.length}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="wb-h">Text oder Erklärung</h3>
          <textarea className="input min-h-[90px] text-[14px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Beim Addieren zuerst auf gleichen Nenner bringen." />
          <label className="mt-2 flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="h-5 w-5" checked={framed} onChange={(e) => setFramed(e.target.checked)} /> als Erklärung im Kasten
          </label>
          <button
            className="wb-chip wb-chip-primary mt-2"
            disabled={!text.trim()}
            onClick={() => {
              p.onText(text, framed);
              setText("");
            }}
          >
            Einfügen
          </button>
        </section>

        <section>
          <h3 className="wb-h">Formel</h3>
          <input className="input text-[14px]" value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="z. B. a^2 + b^2 = c^2" />
          {formula && <p className="mt-1 text-[18px]">{prettyFormula(formula)}</p>}
          <p className="mt-1 text-[12px] text-ink-3">^2 wird hochgestellt, sqrt( ) zur Wurzel, * zum Malpunkt.</p>
          <button
            className="wb-chip wb-chip-primary mt-2"
            disabled={!formula.trim()}
            onClick={() => {
              p.onFormula(formula);
              setFormula("");
            }}
          >
            Einfügen
          </button>
        </section>

        <section>
          <h3 className="wb-h">Tabelle</h3>
          <div className="flex items-center gap-2 text-[13px]">
            <label className="flex items-center gap-1">
              Zeilen <input type="number" min={1} max={15} className="input w-16" value={rows} onChange={(e) => setRows(Math.max(1, Math.min(15, Number(e.target.value) || 1)))} />
            </label>
            <label className="flex items-center gap-1">
              Spalten <input type="number" min={1} max={8} className="input w-16" value={cols} onChange={(e) => setCols(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
            </label>
          </div>
          <input className="input mt-2 text-[14px]" value={heads} onChange={(e) => setHeads(e.target.value)} placeholder="Überschriften, mit Komma getrennt (optional)" />
          <button className="wb-chip wb-chip-primary mt-2" onClick={() => p.onTable(rows, cols, heads.split(",").map((h) => h.trim()).filter(Boolean))}>
            Einfügen
          </button>
        </section>

        <section>
          <h3 className="wb-h">Koordinatensystem</h3>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button key={r.label} className="wb-chip" onClick={() => p.onCoordinates(r.r)}>
                {r.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
