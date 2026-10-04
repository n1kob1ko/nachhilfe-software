"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Lightbulb, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitAnswerAction } from "@/app/actions";

export type ClientTask = {
  id: number;
  type: string;
  prompt: string;
  options: string[] | null;
  passage: string | null;
  blanks: number;
  hints: string[];
  triesUsed: number;
  finished: { correct: boolean; solution: string } | null;
};

type Feedback = { correct: boolean | null; text: string; final: boolean; solution?: string; sample?: string; selfAssess?: boolean };

const GAP = "___";

export function Solver({ token, assignmentId, title, tasks: initial, maxTries }: { token: string; assignmentId: number; title: string; tasks: ClientTask[]; maxTries: number }) {
  const [tasks, setTasks] = useState(initial);
  const firstOpen = initial.findIndex((t) => !t.finished);
  const [index, setIndex] = useState(firstOpen === -1 ? initial.length : firstOpen);
  const done = tasks.filter((t) => t.finished).length;
  const correct = tasks.filter((t) => t.finished?.correct).length;

  if (index >= tasks.length) {
    const ratio = tasks.length ? correct / tasks.length : 0;
    return (
      <div className="py-6 text-center">
        <p className="text-[15px] font-medium text-ink-2">{title}</p>
        <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.02em]">
          {ratio >= 0.8 ? "Super gemacht!" : ratio >= 0.5 ? "Gut gearbeitet!" : "Geschafft – dranbleiben!"}
        </h1>
        <p className="num mt-2 text-[20px]">
          {correct} von {tasks.length} Aufgaben richtig
        </p>
        <p className="mx-auto mt-3 max-w-[48ch] text-ink-2">Deine Ergebnisse sind gespeichert. Deine Nachhilfelehrerin bzw. dein Nachhilfelehrer sieht, wo du schon sicher bist und was ihr noch übt.</p>
        <Link href={`/lernen/${token}`} className="btn btn-primary mt-8">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const task = tasks[index];
  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-4 text-[14px]">
          <Link href={`/lernen/${token}`} className="font-medium text-ink-2 hover:text-ink">
            ← {title}
          </Link>
          <span className="num shrink-0 text-ink-2">
            Aufgabe {index + 1} von {tasks.length}
          </span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {tasks.map((t, i) => (
            <span
              key={t.id}
              className={`h-1.5 flex-1 rounded-full ${t.finished ? (t.finished.correct ? "bg-green" : "bg-red") : i === index ? "bg-accent" : "bg-[var(--bar-track)]"}`}
            />
          ))}
        </div>
        <p className="sr-only">
          {done} von {tasks.length} erledigt
        </p>
      </div>
      <TaskCard
        key={task.id}
        task={task}
        token={token}
        assignmentId={assignmentId}
        maxTries={maxTries}
        onFinished={(c, solution) => setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, finished: { correct: c, solution } } : t)))}
        onNext={() => setIndex((i) => i + 1)}
        isLast={index === tasks.length - 1}
      />
    </div>
  );
}

function TaskCard({
  task,
  token,
  assignmentId,
  maxTries,
  onFinished,
  onNext,
  isLast,
}: {
  task: ClientTask;
  token: string;
  assignmentId: number;
  maxTries: number;
  onFinished: (correct: boolean, solution: string) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [gaps, setGaps] = useState<string[]>(() => Array(task.blanks).fill(""));
  const [hintsShown, setHintsShown] = useState(0);
  const [tries, setTries] = useState(task.triesUsed);
  const [feedback, setFeedback] = useState<Feedback | null>(task.finished ? { correct: task.finished.correct, text: "Diese Aufgabe hast du schon bearbeitet.", final: true, solution: task.finished.solution } : null);
  const [pending, start] = useTransition();
  const startedAt = useRef(Date.now());
  const active = useActiveTime();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const final = feedback?.final ?? false;

  useEffect(() => {
    startedAt.current = Date.now();
    inputRef.current?.focus();
  }, []);

  const answer = task.options ? (choice === null ? "" : String(choice)) : task.blanks > 0 ? JSON.stringify(gaps) : text;
  const canSubmit = !pending && !final && (task.options ? choice !== null : task.blanks > 0 ? gaps.every((g) => g.trim()) : text.trim().length > 0);

  const send = (extra: { giveUp?: boolean; selfAssessed?: boolean } = {}) =>
    start(async () => {
      const elapsed = Date.now() - startedAt.current;
      startedAt.current = Date.now();
      const activeMs = active.take();
      const res = await submitAnswerAction({ token, assignmentId, taskId: task.id, answer, timeMs: elapsed, activeMs, hintsUsed: hintsShown, ...extra });
      if (res.needsSelfAssessment) {
        setFeedback({ correct: null, text: res.feedback, final: false, sample: res.sample, selfAssess: true });
        return;
      }
      setTries(res.attemptNo);
      setFeedback({ correct: res.correct, text: res.feedback, final: res.final, solution: res.solution });
      if (res.final) onFinished(Boolean(res.correct), res.solution ?? "");
    });

  const promptParts = useMemo(() => task.prompt.split(GAP), [task.prompt]);

  return (
    <article>
      {task.passage && <div className="ruled mb-6 rounded-xl border border-line bg-surface px-5 py-1 text-[17px]">{task.passage}</div>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) send();
        }}
      >
        {task.blanks > 0 ? (
          <p className="text-[21px] leading-[2.1] font-medium">
            {promptParts.map((p, i) => (
              <span key={i} className="whitespace-pre-line">
                {p}
                {i < promptParts.length - 1 && (
                  <input
                    ref={i === 0 ? (el) => void (inputRef.current = el) : undefined}
                    value={gaps[i]}
                    disabled={final}
                    onChange={(e) => setGaps((g) => g.map((x, j) => (j === i ? e.target.value : x)))}
                    aria-label={`Lücke ${i + 1}`}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="mx-1 inline-block w-[150px] border-0 border-b-2 border-accent bg-accent-wash/60 px-2 py-0 text-center text-[19px] font-semibold text-accent outline-none focus:bg-accent-wash disabled:opacity-70"
                  />
                )}
              </span>
            ))}
          </p>
        ) : (
          <p className="text-[21px] leading-snug font-medium whitespace-pre-line">{task.prompt}</p>
        )}

        {task.options && (
          <div className="mt-6 grid gap-2" role="radiogroup" aria-label="Antwortmöglichkeiten">
            {task.options.map((o, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-[17px] transition-colors ${
                  choice === i ? "border-accent bg-accent-wash" : "border-line-strong hover:border-ink-3"
                } ${final ? "cursor-default" : ""}`}
              >
                <input type="radio" name="choice" className="mt-1.5 accent-[var(--accent)]" checked={choice === i} disabled={final} onChange={() => setChoice(i)} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        )}

        {!task.options && task.blanks === 0 &&
          (task.type === "free" || task.type === "reading" ? (
            <textarea
              ref={(el) => void (inputRef.current = el)}
              className="input mt-6 min-h-[140px] text-[17px]"
              value={text}
              disabled={final || feedback?.selfAssess}
              onChange={(e) => setText(e.target.value)}
              placeholder="Deine Antwort"
            />
          ) : (
            <input
              ref={(el) => void (inputRef.current = el)}
              className="input mt-6 max-w-[360px] text-[19px] font-semibold"
              value={text}
              disabled={final}
              onChange={(e) => setText(e.target.value)}
              placeholder="Deine Antwort"
              autoComplete="off"
              inputMode={task.type === "calc" ? "text" : undefined}
              aria-label="Antwort"
            />
          ))}
        {task.type === "calc" && !task.options && task.blanks === 0 && <p className="mt-2 text-[13px] text-ink-3">Brüche schreibst du so: 3/4. Kommazahlen mit Beistrich: 0,75.</p>}

        {hintsShown > 0 && (
          <ul className="mt-6 space-y-2">
            {task.hints.slice(0, hintsShown).map((h, i) => (
              <li key={i} className="flex gap-2 rounded-lg bg-amber-wash px-4 py-2.5 text-[15px] text-[#5c3a00]">
                <Lightbulb size={17} className="mt-0.5 shrink-0" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        )}

        {feedback && !feedback.selfAssess && (
          <div
            role="status"
            className={`mt-6 flex gap-3 rounded-xl px-4 py-3 text-[16px] ${feedback.correct ? "bg-green-wash text-green" : "bg-red-wash text-red"}`}
          >
            {feedback.correct ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden /> : <XCircle size={20} className="mt-0.5 shrink-0" aria-hidden />}
            <span className="font-medium">{feedback.text}</span>
          </div>
        )}

        {feedback?.selfAssess && (
          <div className="mt-6 rounded-xl border border-line bg-surface px-5 py-4">
            <p className="text-[14px] font-semibold text-ink-2">Musterlösung</p>
            <p className="mt-1 whitespace-pre-line">{feedback.sample}</p>
            <p className="mt-4 font-medium">{feedback.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => send({ selfAssessed: true })}>
                Ja, hatte ich richtig
              </button>
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => send({ selfAssessed: false })}>
                Nein, noch nicht
              </button>
            </div>
          </div>
        )}

        {final && feedback?.solution && (
          <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-4">
            <p className="text-[14px] font-semibold text-ink-2">Lösungsweg</p>
            <p className="mt-1 text-[16px] whitespace-pre-line">{feedback.solution}</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {!final && !feedback?.selfAssess && (
            <>
              <button className="btn btn-primary h-11 px-6 text-[15px]" disabled={!canSubmit}>
                {pending ? "Wird geprüft …" : "Prüfen"}
              </button>
              {hintsShown < task.hints.length && (
                <button type="button" className="btn btn-secondary h-11" onClick={() => setHintsShown((h) => h + 1)}>
                  <Lightbulb size={16} aria-hidden /> {hintsShown === 0 ? "Hilfe anzeigen" : "Noch eine Hilfe"}
                </button>
              )}
              <button type="button" className="btn btn-ghost h-11" disabled={pending} onClick={() => send({ giveUp: true })}>
                Lösung zeigen
              </button>
              {tries > 0 && task.type !== "free" && (
                <span className="num text-[14px] text-ink-3">
                  Versuch {tries + 1} von {maxTries}
                </span>
              )}
            </>
          )}
          {final && (
            <button type="button" className="btn btn-primary h-11 px-6 text-[15px]" onClick={onNext} autoFocus>
              {isLast ? "Fertig" : "Nächste Aufgabe"} <ChevronRight size={17} aria-hidden />
            </button>
          )}
        </div>
      </form>
    </article>
  );
}

/**
 * Counts only the time the student is actually working: page visible and some input
 * (typing, clicking, scrolling) within the last minute. Long pauses show up as the
 * difference to the total time.
 */
function useActiveTime() {
  const ms = useRef(0);
  const lastInput = useRef(Date.now());
  useEffect(() => {
    const mark = () => {
      lastInput.current = Date.now();
    };
    const events = ["keydown", "pointerdown", "pointermove", "scroll", "input", "focusin"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    let last = Date.now();
    const tick = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastInput.current < 60_000) ms.current += now - last;
      last = now;
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(tick);
    };
  }, []);
  return {
    take() {
      const v = ms.current;
      ms.current = 0;
      return v;
    },
  };
}
