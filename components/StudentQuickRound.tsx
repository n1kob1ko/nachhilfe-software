"use client";

/**
 * Schnellrunde (Phase 2 des Merges, D11): derselbe Schülermodus, aber im Durchlauf — Ablauf nach dem
 * Micro-Widget der Tutoring-Plattform (`SatzbauMicroWidget.tsx`), ohne dessen Drag-drop, Artikel- und
 * Text-Aufgaben:
 *
 *   Anfang (Intro) → eine Aufgabe nach der anderen mit einem einzigen Tipp → die Rückmeldung bleibt kurz
 *   stehen, dann kommt die nächste Aufgabe von selbst → Ende (Outro) mit dem Ergebnis.
 *
 * Es ist **keine eigene Ablage**: jeder Tipp geht über genau denselben Abgabeweg wie sonst
 * (app/actions.ts submitAnswerAction, app/device-actions.ts, app/laptop-actions.ts), mit derselben
 * Abgabe-ID, derselben Zeitmessung (useActiveTime) und denselben Hilfen (recordHintAction). Ergebnis und
 * Analyse sehen deshalb genau dasselbe wie im üblichen Ablauf.
 *
 * Große Flächen fürs Tablet: jede Antwort ist mindestens 76 px hoch, die Rückmeldung steht als Band.
 */
import { CheckCircle2, ChevronRight, Lightbulb, RotateCcw, XCircle, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { submitAnswerAction } from "@/app/actions";
import { recordHintAction } from "@/app/builder-actions";
import { deviceRecordHintAction, deviceSubmitAnswerAction } from "@/app/device-actions";
import { laptopRecordHintAction, laptopSubmitAnswerAction } from "@/app/laptop-actions";
import { hintLabel } from "@/lib/tasks";
import { MathText } from "./MathText";
import { newSubmissionId, useActiveTime, type ClientTask } from "./Solver";
import { FigurBild } from "./Figur";

/** So lange bleibt die Rückmeldung stehen, dann kommt die nächste Aufgabe (wie im Vorbild). */
export const QUICK_FEEDBACK_MS = 1200;

type AnswerInput = { assignmentId: number; taskId: number; answer: string; timeMs: number; activeMs: number; hintsUsed: number; submissionId: string };
type Via = "link" | "geraet" | "laptop";
type Phase = "intro" | "session" | "outro";
type Feedback = { correct: boolean | null; text: string; final: boolean; solution?: string };

export function StudentQuickRound({
  token,
  assignmentId,
  title,
  tasks,
  via = "link",
  homeHref,
}: {
  token: string;
  assignmentId: number;
  title: string;
  /** die offenen Aufgaben der Übung (bereits beantwortete sind nicht mehr dabei) */
  tasks: ClientTask[];
  via?: Via;
  homeHref?: string;
}) {
  const home = homeHref ?? `/lernen/${token}`;
  const open = tasks.filter((t) => !t.finished);
  const [phase, setPhase] = useState<Phase>(open.length ? "intro" : "outro");
  const [queue, setQueue] = useState<ClientTask[]>(open);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const [doneIds, setDoneIds] = useState<number[]>([]);
  const [failed, setFailed] = useState<AnswerInput | null>(null);
  const [pending, start] = useTransition();
  const active = useActiveTime();
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // gegen den Doppeltipp: der zweite Tipp desselben Moments zählt nicht als zweiter Versuch
  const sending = useRef(false);

  const total = queue.length;
  // die letzte Aufgabe ist durch: das Ende zeigt das Ergebnis, ohne dass noch etwas gesetzt werden muss
  const finished = phase !== "intro" && index >= total;
  const current = phase === "session" && !finished ? queue[index] : undefined;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  // die nächste Aufgabe: kein „Weiter“-Knopf, sie kommt von selbst
  const moveOn = useCallback(() => {
    sending.current = false;
    setPicked(null);
    setFeedback(null);
    setHintsShown(0);
    startedAt.current = Date.now();
    setIndex((i) => i + 1);
  }, []);

  const deliver = useCallback(
    (input: AnswerInput) =>
      start(async () => {
        let res: Awaited<ReturnType<typeof submitAnswerAction>>;
        try {
          res = via === "geraet" ? await deviceSubmitAnswerAction(input) : via === "laptop" ? await laptopSubmitAnswerAction(input) : await submitAnswerAction({ token, ...input });
        } catch {
          // kein Netz: dieselbe Abgabe (gleiche Abgabe-ID) noch einmal senden, nichts geht verloren
          sending.current = false;
          setFailed(input);
          setPicked(null);
          return;
        }
        setFailed(null);
        setAnswered((n) => n + 1);
        if (res.correct) setCorrectCount((n) => n + 1);
        if (res.final) setDoneIds((ids) => [...new Set([...ids, input.taskId])]);
        setFeedback({ correct: res.correct, text: res.feedback, final: res.final, solution: res.final ? res.solution : undefined });
        clearTimer();
        timer.current = setTimeout(moveOn, QUICK_FEEDBACK_MS);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- genügt so: Abgabeweg und Rückmeldung ändern sich nicht
    [via, token, clearTimer, moveOn],
  );

  const pick = useCallback(
    (option: number) => {
      if (!current || picked !== null || sending.current || failed) return;
      sending.current = true;
      setPicked(option);
      deliver({
        assignmentId,
        taskId: current.id,
        answer: String(option),
        timeMs: Date.now() - startedAt.current,
        activeMs: active.take(),
        hintsUsed: hintsShown,
        submissionId: newSubmissionId(),
      });
    },
    [current, picked, pending, failed, deliver, assignmentId, active, hintsShown],
  );

  // die Zifferntasten wählen die Antwort (am Desktop; am Tablet wird getippt)
  useEffect(() => {
    if (phase !== "session" || !current) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > (current.options?.length ?? 0)) return;
      e.preventDefault();
      pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, current, pick]);

  const openHint = () => {
    if (!current || hintsShown >= current.hints.length) return;
    const i = hintsShown;
    setHintsShown(i + 1);
    void (via === "geraet" ? deviceRecordHintAction(assignmentId, current.id, i) : via === "laptop" ? laptopRecordHintAction(assignmentId, current.id, i) : recordHintAction(token, assignmentId, current.id, i)).catch(() => {});
  };

  const startRound = (list: ClientTask[]) => {
    clearTimer();
    sending.current = false;
    setQueue(list);
    setIndex(0);
    setPicked(null);
    setFeedback(null);
    setHintsShown(0);
    setFailed(null);
    setCorrectCount(0);
    setAnswered(0);
    setDoneIds([]);
    startedAt.current = Date.now();
    setPhase(list.length ? "session" : "outro");
  };

  const flow = (children: React.ReactNode) => (
    <div className="mx-auto w-full max-w-[760px]">
      <p className="mb-1 text-center text-[15px] font-medium text-ink-2">{title}</p>
      {children}
    </div>
  );

  if (phase === "intro") {
    return flow(
      <section className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-wash text-accent">
          <Zap size={26} aria-hidden />
        </span>
        <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.02em]">Schnellrunde</h1>
        <p className="mx-auto mt-2 max-w-[42ch] text-[16px] text-ink-2">
          {total === 1 ? "Eine Aufgabe" : `${total} Aufgaben`}, große Flächen, ein Tipp genügt. Es gibt keinen „Weiter“-Knopf: die nächste Aufgabe kommt von selbst.
        </p>
        <button type="button" className="btn btn-primary btn-lg mt-6 min-h-[60px] min-w-[220px] text-[18px]" onClick={() => startRound(queue)} autoFocus>
          Los geht&apos;s
        </button>
      </section>,
    );
  }

  if (phase === "outro" || finished) {
    const remaining = queue.filter((t) => !doneIds.includes(t.id));
    const graded = answered || total;
    return flow(
      <section className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">{correctCount === total ? "Alles richtig!" : "Geschafft!"}</h1>
        <p className="num mt-2 text-[22px]">
          {correctCount} von {graded} richtig
        </p>
        {remaining.length > 0 && <p className="mt-2 text-[15px] text-ink-2">Noch offen: {remaining.length === 1 ? "eine Aufgabe" : `${remaining.length} Aufgaben`}. Übe sie gleich noch einmal.</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {remaining.length > 0 && (
            <button type="button" className="btn btn-primary btn-lg min-h-[56px]" onClick={() => startRound(remaining)}>
              <RotateCcw size={18} aria-hidden /> Nochmal üben
            </button>
          )}
          <a href={home} className="btn btn-secondary btn-lg min-h-[56px]">
            Zurück zur Übersicht
          </a>
        </div>
      </section>,
    );
  }

  if (!current) {
    // alle Aufgaben waren schon beantwortet
    return flow(
      <section className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <h1 className="text-[26px] font-semibold">Diese Übung ist fertig</h1>
        <a href={home} className="btn btn-primary btn-lg mt-6 min-h-[56px]">
          Zurück zur Übersicht
        </a>
      </section>,
    );
  }

  const options = current.options ?? [];
  const locked = picked !== null || pending || Boolean(feedback) || Boolean(failed);
  const progress = total ? Math.min(1, answered / total) : 0;

  return flow(
    <section aria-label="Schnellrunde">
      <header className="mb-4">
        <div className="mb-2 flex items-baseline justify-between gap-4 text-[15px] text-ink-2">
          <span className="num font-semibold" aria-live="polite">
            {answered === 0 ? "Tippe eine Antwort" : `${correctCount}/${answered} richtig`}
          </span>
          <span className="num">
            Aufgabe {index + 1} von {total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bar-track)]" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span className="block h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <p className="mb-5 text-center text-[22px] leading-snug font-medium">
        <MathText text={current.prompt} />
      </p>
      {/* Aufgabe mit Bild: das Bild unter der Frage, mittig */}
      {current.figur && <FigurBild svg={current.figur} groesser={1.2} className="mx-auto mb-5" />}
      {current.quelle && <p className="-mt-3 mb-5 text-center text-[12px] text-ink-3">Quelle: {current.quelle}</p>}

      {hintsShown > 0 && (
        <ul className="mb-4 space-y-2">
          {current.hints.slice(0, hintsShown).map((h, i) => (
            <li key={i} className="flex gap-2 rounded-xl bg-amber-wash px-4 py-3 text-[16px] text-amber">
              <Lightbulb size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="block text-[13px] font-semibold">{hintLabel(i)}</span>
                <MathText text={h} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <ul className="grid gap-3">
        {options.map((o, i) => {
          const chosen = picked === i;
          const right = Boolean(feedback?.final && feedback.correct && chosen);
          const wrong = Boolean(feedback?.final && !feedback.correct && chosen);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(i)}
                disabled={locked}
                aria-pressed={chosen}
                className={`flex min-h-[76px] w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left text-[19px] leading-snug transition-colors sm:min-h-[84px] sm:text-[21px] ${
                  right
                    ? "border-green bg-green-wash text-green"
                    : wrong
                      ? "border-red bg-red-wash text-red"
                      : chosen
                        ? "border-accent bg-accent-wash"
                        : locked
                          ? "border-line bg-panel text-ink-3"
                          : "border-line-strong bg-surface hover:border-accent active:scale-[0.99]"
                }`}
              >
                <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel text-[16px] font-semibold text-ink-2" aria-hidden>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <MathText text={o} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hintsShown < current.hints.length && !feedback && !failed && (
        <button type="button" className="btn btn-secondary mt-4 min-h-[52px]" onClick={openHint} disabled={locked}>
          <Lightbulb size={17} aria-hidden /> {hintLabel(hintsShown)}
        </button>
      )}

      <div className="mt-5 min-h-[70px]" aria-live="assertive">
        {feedback && (
          <div role="status" className={`flex items-start gap-3 rounded-xl px-4 py-3 text-[17px] ${feedback.correct ? "bg-green-wash text-green" : "bg-red-wash text-red"}`}>
            {feedback.correct ? <CheckCircle2 size={22} className="mt-0.5 shrink-0" aria-hidden /> : <XCircle size={22} className="mt-0.5 shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                <MathText text={feedback.text} />
              </span>
              {feedback.solution && (
                <span className="mt-1 block text-[15px] text-ink-2">
                  Lösung: <MathText text={feedback.solution} />
                </span>
              )}
            </span>
          </div>
        )}
        {failed && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-wash px-4 py-3 text-[15px]">
            <span className="min-w-0 flex-1">Das Senden hat nicht geklappt. Deine Antwort ist noch da.</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                // dieselbe Abgabe-ID: ein zweiter Versuch entsteht dabei nicht
                sending.current = true;
                deliver(failed);
              }}
            >
              Nochmal senden <ChevronRight size={15} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </section>,
  );
}
