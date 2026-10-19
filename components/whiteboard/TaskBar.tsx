"use client";

import { Fragment } from "react";
import { MathText } from "../MathText";
import type { BoardCheck } from "@/lib/whiteboard-check";
import type { BoardGrade } from "@/lib/whiteboard-grades";

/** One task on the page: `key` is its tag (set:n), `top` where it starts on the board. */
export type BoardTask = { key: string; set: string; n: number; taskId: number | null; top: number };
/** KI prüfen for one task: running, the KI's suggestion, or why there is none. */
export type TaskCheck = { busy: true } | { result: BoardCheck } | { error: string };
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
  /** KI prüfen per task; null when the KI cannot read pictures (no button then) */
  checks: Record<string, TaskCheck> | null;
  onCheck: (key: string, taskId: number) => void;
};

/**
 * Task bar at the top of the board: one number per task on the page, so nobody misses the tasks further down
 * (niko: „da erscheinen nur 2 aufgaben und der rest wird gar nicht angezeigt“). A tap jumps to the task. The
 * teacher grades the task on screen here (lib/whiteboard-grades.ts); the mark shows on both devices.
 */
export function TaskBar({ tasks, current, grades, canGrade, onGo, onGrade, onSolution, checks, onCheck }: Props) {
  const cur = tasks.find((t) => t.key === current) ?? null;
  const curGrade = cur?.taskId ? grades[cur.taskId] : undefined;
  const check = cur && checks ? checks[cur.key] : undefined;
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
          {checks && (
            <button
              type="button"
              className="wb-grade-btn"
              onClick={() => onCheck(cur.key, cur.taskId!)}
              disabled={check !== undefined && "busy" in check}
              title="Die KI liest, was zu dieser Aufgabe geschrieben steht, und schlägt eine Bewertung vor. Du entscheidest."
              data-testid="ki-pruefen"
            >
              {check && "busy" in check ? "KI prüft …" : "KI prüfen"}
            </button>
          )}
          <button type="button" className="wb-grade-btn" onClick={() => onSolution(cur.key, cur.taskId!)} title="Die Lösung rechts neben die Aufgabe schreiben, auch beim Schüler">
            Lösung zeigen
          </button>
        </div>
      )}
      {canGrade && cur?.taskId && check && !("busy" in check) && <CheckNote check={check} grade={curGrade} onTake={(review) => onGrade(cur.taskId!, review)} />}
    </div>
  );
}

/**
 * The KI's suggestion for the task on screen, for the teacher only. It counts only when the teacher takes it over
 * (or grades otherwise); what the KI read is shown, so a misread is easy to spot.
 */
function CheckNote({ check, grade, onTake }: { check: Exclude<TaskCheck, { busy: true }>; grade: BoardGrade | undefined; onTake: (review: Review) => void }) {
  if ("error" in check) {
    return (
      <div className="wb-quick-group wb-check" role="alert" data-testid="ki-fehler">
        <p className="wb-check-text">{check.error}</p>
      </div>
    );
  }
  const { bewertung, grund, gelesen } = check.result;
  return (
    <div className="wb-quick-group wb-check" role="status" data-testid="ki-vorschlag">
      <div className="wb-check-text">
        <p>
          <span className="wb-check-label">KI-Vorschlag:</span>{" "}
          {bewertung === "unklar" ? <strong>nicht sicher</strong> : <strong className={`wb-check-${bewertung}`}>{MARKS[bewertung].sign} {GRADES.find((g) => g.review === bewertung)!.label}</strong>}
          {grund && (
            <>
              {" · "}
              <MathText text={grund} />
            </>
          )}
          {bewertung === "unklar" ? " Bitte bewerte selbst." : ""}
        </p>
        {gelesen && (
          <p className="wb-check-read">
            Gelesen:{" "}
            {gelesen
              .split("|")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <span aria-hidden> │ </span>}
                  <MathText text={line} />
                </Fragment>
              ))}
          </p>
        )}
      </div>
      {bewertung !== "unklar" &&
        (grade === bewertung ? (
          <span className="wb-check-done">Übernommen</span>
        ) : (
          <button type="button" className="wb-grade-btn wb-check-take" onClick={() => onTake(bewertung)} data-testid="ki-uebernehmen">
            Übernehmen
          </button>
        ))}
    </div>
  );
}
