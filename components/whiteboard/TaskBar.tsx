"use client";

import { Fragment } from "react";
import type { BoardGrade } from "@/lib/whiteboard-grades";

/** One task on the page: `key` is its tag (set:n), `top` where it starts on the board. */
export type BoardTask = { key: string; set: string; n: number; taskId: number | null; top: number };
type Review = "richtig" | "teilweise" | "falsch";

const MARKS: Record<BoardGrade, { sign: string; label: string; cls: string }> = {
  richtig: { sign: "✓", label: "richtig", cls: "wb-task-richtig" },
  teilweise: { sign: "½", label: "teilweise richtig", cls: "wb-task-teilweise" },
  falsch: { sign: "✗", label: "falsch", cls: "wb-task-falsch" },
  offen: { sign: "…", label: "wartet auf deine Bewertung", cls: "wb-task-offen" },
  loesung: { sign: "L", label: "Lösung angesehen", cls: "wb-task-offen" },
};
const GRADES: { review: Review; label: string }[] = [
  { review: "richtig", label: "Richtig" },
  { review: "teilweise", label: "Teilweise" },
  { review: "falsch", label: "Falsch" },
];

type Props = {
  tasks: BoardTask[];
  /** the task on screen */
  current: string | null;
  grades: Record<number, BoardGrade>;
  /** the unit's teacher: grades the task on screen and shows its solution */
  canGrade: boolean;
  onGo: (key: string) => void;
  onGrade: (taskId: number, review: Review) => void;
  onSolution: (key: string, taskId: number) => void;
};

/**
 * Task bar at the top of the board: one number per task on the page, so nobody misses the tasks further down
 * (niko: „da erscheinen nur 2 aufgaben und der rest wird gar nicht angezeigt“). A tap jumps to the task. The
 * teacher grades the task on screen here (lib/whiteboard-grades.ts); the mark shows on both devices.
 */
export function TaskBar({ tasks, current, grades, canGrade, onGo, onGrade, onSolution }: Props) {
  const cur = tasks.find((t) => t.key === current) ?? null;
  const curGrade = cur?.taskId ? grades[cur.taskId] : undefined;
  return (
    <div className="wb-tasks">
      <nav className="wb-quick-group wb-tasks-row" aria-label="Aufgaben auf dieser Seite">
        <span className="wb-tasks-label">Aufgabe</span>
        {tasks.map((t, i) => {
          const g = t.taskId ? grades[t.taskId] : undefined;
          const mark = g ? MARKS[g] : null;
          return (
            <Fragment key={t.key}>
              {i > 0 && tasks[i - 1].set !== t.set && <span className="wb-sep" aria-hidden />}
              <button
                type="button"
                className={`wb-task ${t.key === current ? "wb-task-on" : ""} ${mark?.cls ?? ""}`}
                onClick={() => onGo(t.key)}
                aria-current={t.key === current ? "step" : undefined}
                aria-label={`Aufgabe ${t.n}${mark ? `, ${mark.label}` : ""}`}
                title={`Zu Aufgabe ${t.n}${mark ? ` (${mark.label})` : ""}`}
              >
                {t.n}
                {mark && (
                  <span className="wb-task-mark" aria-hidden>
                    {mark.sign}
                  </span>
                )}
              </button>
            </Fragment>
          );
        })}
      </nav>
      {canGrade && cur?.taskId && (
        <div className="wb-quick-group wb-grade" role="group" aria-label={`Aufgabe ${cur.n} bewerten`}>
          <span className="wb-tasks-label">Aufgabe {cur.n}</span>
          {GRADES.map((g) => (
            <button
              key={g.review}
              type="button"
              className={`wb-grade-btn wb-grade-${g.review} ${curGrade === g.review ? "wb-grade-on" : ""}`}
              aria-pressed={curGrade === g.review}
              onClick={() => onGrade(cur.taskId!, g.review)}
              title={`Aufgabe ${cur.n} als ${MARKS[g.review].label} werten`}
            >
              <span aria-hidden>{MARKS[g.review].sign}</span> {g.label}
            </button>
          ))}
          <span className="wb-sep" aria-hidden />
          <button type="button" className="wb-grade-btn" onClick={() => onSolution(cur.key, cur.taskId!)} title="Die Lösung rechts neben die Aufgabe schreiben, auch beim Schüler">
            Lösung zeigen
          </button>
        </div>
      )}
    </div>
  );
}
