"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronRight, CircleDashed, CloudOff, Lightbulb, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitAnswerAction } from "@/app/actions";
import { recordHintAction } from "@/app/builder-actions";
import { deviceRecordHintAction, deviceSubmitAnswerAction } from "@/app/device-actions";
import { laptopRecordHintAction, laptopSubmitAnswerAction } from "@/app/laptop-actions";
import { hintLabel, isReview, REVIEWS } from "@/lib/tasks";
import { splitFractions } from "@/lib/math-text";
import { MathText } from "./MathText";
import { FixCompare } from "./FixMarks";

export type ClientTask = {
  id: number;
  type: string;
  prompt: string;
  options: string[] | null;
  passage: string | null;
  blanks: number;
  /** Order tasks: the steps in the (shuffled) order they are shown. */
  steps: string[] | null;
  hints: string[];
  /** Hints already opened earlier (stored per hint). */
  hintsOpened: number;
  /** Set when the teacher has released the solutions for this exercise. */
  released: { solution: string; answer: string | null } | null;
  triesUsed: number;
  /** Fehler korrigieren: the text with errors the student corrects. */
  faulty: string | null;
  /** Freie Antwort: 1 = one line, more = a text field of about that many lines. */
  lines: number | null;
  /**
   * correct null: waits for the teacher's grade. review: the teacher's grade (richtig, teilweise, falsch).
   * given and expected: the student's corrected text and the right one (Fehler korrigieren).
   */
  finished: { correct: boolean | null; solution: string; review?: string | null; sample?: string | null; given?: string | null; expected?: string | null } | null;
};

type AnswerInput = { assignmentId: number; taskId: number; answer: string; timeMs: number; activeMs: number; hintsUsed: number; giveUp?: boolean; submissionId: string };

/** One id per click on "Prüfen": a repeat after a lost connection carries the same id and is stored once. */
function newSubmissionId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // plain http in the local network has no randomUUID
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Feedback = { correct: boolean | null; text: string; final: boolean; partial?: boolean; solution?: string; sample?: string; pending?: boolean; expected?: string; given?: string };

/**
 * What the student typed but has not sent yet stays on the device (per exercise and task), so a reload or a
 * lost connection does not lose it. On the laptop the keys start with the prefix the laptop clears on "Fertig".
 */
const draftKey = (via: Via, assignmentId: number, taskId: number) => `${via === "laptop" ? "lernheft-laptop-antwort-" : "lernheft-antwort-"}${assignmentId}-${taskId}`;
type Draft = { choice?: number | null; text?: string; gaps?: string[]; order?: number[] };
function readDraft(key: string): Draft | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d));
    else localStorage.removeItem(key);
  } catch {
    // private mode or full storage: the answer only lives on screen
  }
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const GAP = "___";

type Via = "link" | "geraet" | "laptop";

export function Solver({
  token,
  assignmentId,
  title,
  tasks: initial,
  maxTries,
  via = "link",
  homeHref,
}: {
  token: string;
  assignmentId: number;
  title: string;
  tasks: ClientTask[];
  maxTries: number;
  /** "geraet": on the teacher's student tablet, "laptop": on the student's own laptop for this unit; both authorised by
   * their device instead of the student link */
  via?: Via;
  homeHref?: string;
}) {
  const [tasks, setTasks] = useState(initial);
  const firstOpen = initial.findIndex((t) => !t.finished);
  const [index, setIndex] = useState(firstOpen === -1 ? initial.length : firstOpen);
  const home = homeHref ?? `/lernen/${token}`;
  // on the tablet and the laptop the teacher sees live which task is open and for how long
  useEffect(() => {
    if (via === "link") return;
    const t = tasks[Math.min(index, tasks.length - 1)];
    if (!t) return;
    void fetch(via === "geraet" ? "/geraet/status" : "/mitmachen/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, taskId: t.id, taskNo: Math.min(index + 1, tasks.length), total: tasks.length }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the open task changes
  }, [index, via, assignmentId]);
  const done = tasks.filter((t) => t.finished).length;
  const correct = tasks.filter((t) => t.finished?.correct).length;
  const waiting = tasks.filter((t) => t.finished && t.finished.correct === null).length;

  if (index >= tasks.length) {
    const graded = tasks.length - waiting;
    const ratio = graded ? correct / graded : 1;
    return (
      <div className="py-6 text-center">
        <p className="text-[15px] font-medium text-ink-2">{title}</p>
        <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.02em]">
          {ratio >= 0.8 ? "Super gemacht!" : ratio >= 0.5 ? "Gut gearbeitet!" : "Geschafft – dranbleiben!"}
        </h1>
        <p className="num mt-2 text-[20px]">
          {correct} von {tasks.length} Aufgaben richtig
        </p>
        {waiting > 0 && (
          <p className="num mt-1 text-[16px] text-ink-2">
            {waiting === 1 ? "1 Antwort wird" : `${waiting} Antworten werden`} noch von deiner Lehrerin bzw. deinem Lehrer bewertet.
          </p>
        )}
        <p className="mx-auto mt-3 max-w-[48ch] text-ink-2">Deine Ergebnisse sind gespeichert. Deine Nachhilfelehrerin bzw. dein Nachhilfelehrer sieht, wo du schon sicher bist und was ihr noch übt.</p>
        <HomeLink href={home} plain={via !== "link"} className="btn btn-primary mt-8">
          Zurück zur Übersicht
        </HomeLink>
      </div>
    );
  }

  const task = tasks[index];
  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-4 text-[14px]">
          <HomeLink href={home} plain={via !== "link"} className="font-medium text-ink-2 hover:text-ink">
            ← {title}
          </HomeLink>
          <span className="num shrink-0 text-ink-2">
            Aufgabe {index + 1} von {tasks.length}
          </span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {tasks.map((t, i) => (
            <span
              key={t.id}
              className={`h-1.5 flex-1 rounded-full ${
                t.finished
                  ? t.finished.correct === null || t.finished.review === "teilweise"
                    ? "bg-amber"
                    : t.finished.correct
                      ? "bg-green"
                      : "bg-red"
                  : i === index
                    ? "bg-accent"
                    : "bg-[var(--bar-track)]"
              }`}
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
        via={via}
        assignmentId={assignmentId}
        maxTries={maxTries}
        onFinished={(f) => setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, finished: f } : t)))}
        onNext={() => setIndex((i) => i + 1)}
        isLast={index === tasks.length - 1}
      />
    </div>
  );
}

function TaskCard({
  task,
  token,
  via,
  assignmentId,
  maxTries,
  onFinished,
  onNext,
  isLast,
}: {
  task: ClientTask;
  token: string;
  via: Via;
  assignmentId: number;
  maxTries: number;
  onFinished: (f: NonNullable<ClientTask["finished"]>) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState(task.faulty ?? "");
  const [gaps, setGaps] = useState<string[]>(() => Array(task.blanks).fill(""));
  const [hintsShown, setHintsShown] = useState(Math.min(task.hintsOpened, task.hints.length));
  const [order, setOrder] = useState<number[]>(() => (task.steps ?? []).map((_, i) => i));
  const [tries, setTries] = useState(task.triesUsed);
  const [feedback, setFeedback] = useState<Feedback | null>(
    task.finished
      ? {
          correct: task.finished.correct,
          text:
            task.finished.correct === null
              ? "Deine Antwort ist gespeichert. Deine Lehrerin bzw. dein Lehrer schaut sie sich an."
              : task.finished.review && isReview(task.finished.review)
                ? `Bewertet: ${REVIEWS[task.finished.review]}.`
                : "Diese Aufgabe hast du schon bearbeitet.",
          partial: task.finished.review === "teilweise",
          final: true,
          solution: task.finished.solution,
          sample: task.finished.sample ?? undefined,
          pending: task.finished.correct === null,
          given: task.finished.given ?? undefined,
          expected: task.finished.expected ?? undefined,
        }
      : null,
  );
  const [wrongGaps, setWrongGaps] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const startedAt = useRef(Date.now());
  const active = useActiveTime();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const final = feedback?.final ?? false;

  const key = draftKey(via, assignmentId, task.id);
  const restored = useRef(false);
  useEffect(() => {
    startedAt.current = Date.now();
    if (!task.finished) {
      const d = readDraft(key);
      if (d) {
        if (typeof d.choice === "number" && task.options && d.choice < task.options.length) setChoice(d.choice);
        if (typeof d.text === "string") setText(d.text);
        if (Array.isArray(d.gaps) && d.gaps.length === task.blanks) setGaps(d.gaps.map(String));
        if (Array.isArray(d.order) && d.order.length === (task.steps?.length ?? 0)) setOrder(d.order);
      }
    }
    restored.current = true;
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per task
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    if (final) return writeDraft(key, null);
    const changed = choice !== null || (task.faulty ? text !== task.faulty : text !== "") || gaps.some((g) => g) || order.some((o, i) => o !== i);
    writeDraft(key, changed ? { choice, text, gaps, order } : null);
  }, [key, final, choice, text, gaps, order, task.faulty]);

  const answer = task.options ? (choice === null ? "" : String(choice)) : task.steps ? JSON.stringify(order) : task.blanks > 0 ? JSON.stringify(gaps) : text;
  // a correction task needs a changed text: the faulty one as it is is never the answer
  const unchanged = task.faulty !== null && text.trim() === task.faulty.trim();
  const canSubmit = !pending && !final && (task.options ? choice !== null : task.steps ? true : task.blanks > 0 ? gaps.every((g) => g.trim()) : text.trim().length > 0 && !unchanged);
  const move = (pos: number, dir: -1 | 1) =>
    setOrder((o) => {
      const j = pos + dir;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[pos], next[j]] = [next[j], next[pos]];
      return next;
    });
  const openHint = () => {
    const i = hintsShown;
    setHintsShown(i + 1);
    void (via === "geraet"
      ? deviceRecordHintAction(assignmentId, task.id, i)
      : via === "laptop"
        ? laptopRecordHintAction(assignmentId, task.id, i)
        : recordHintAction(token, assignmentId, task.id, i)
    ).catch(() => {});
  };

  // an answer that did not reach the server stays here and is sent again, never typed twice
  const [unsent, setUnsent] = useState<null | { input: AnswerInput; network: boolean }>(null);

  const deliver = useCallback(
    (input: AnswerInput) =>
      start(async () => {
        let res: Awaited<ReturnType<typeof submitAnswerAction>>;
        try {
          res = via === "geraet" ? await deviceSubmitAnswerAction(input) : via === "laptop" ? await laptopSubmitAnswerAction(input) : await submitAnswerAction({ token, ...input });
        } catch (e) {
          setUnsent({ input, network: e instanceof TypeError || !navigator.onLine });
          return;
        }
        setUnsent(null);
        setTries(res.attemptNo);
        setWrongGaps(res.final ? [] : (res.wrongGaps ?? []));
        const given = task.faulty !== null ? input.answer : undefined;
        setFeedback({ correct: res.correct, text: res.feedback, final: res.final, solution: res.solution, sample: res.sample, pending: res.pendingReview, expected: res.expected, given });
        if (res.final) {
          writeDraft(draftKey(via, assignmentId, task.id), null);
          onFinished({ correct: res.pendingReview ? null : Boolean(res.correct), solution: res.solution ?? "", sample: res.sample ?? null, given: given ?? null, expected: res.expected ?? null });
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onFinished is a fresh arrow each render
    [via, token],
  );

  const send = (extra: { giveUp?: boolean } = {}) => {
    // still waiting to be sent: the same submission again, not a second attempt
    if (unsent && unsent.input.answer === answer && Boolean(unsent.input.giveUp) === Boolean(extra.giveUp)) {
      deliver(unsent.input);
      return;
    }
    const elapsed = Date.now() - startedAt.current;
    startedAt.current = Date.now();
    const activeMs = active.take();
    deliver({ assignmentId, taskId: task.id, answer, timeMs: elapsed, activeMs, hintsUsed: hintsShown, ...extra, submissionId: newSubmissionId() });
  };

  // back online: send what is waiting
  useEffect(() => {
    if (!unsent?.network) return;
    const again = () => deliver(unsent.input);
    window.addEventListener("online", again);
    const id = window.setInterval(() => navigator.onLine && again(), 15_000);
    return () => {
      window.removeEventListener("online", again);
      window.clearInterval(id);
    };
  }, [unsent, deliver]);

  const promptParts = useMemo(() => task.prompt.split(GAP), [task.prompt]);

  return (
    <article>
      {task.passage && <div className="ruled mb-6 rounded-xl border border-line bg-surface px-5 py-1 text-[17px]"><MathText text={task.passage} /></div>}

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
                <MathText text={p} />
                {i < promptParts.length - 1 && (
                  <input
                    ref={i === 0 ? (el) => void (inputRef.current = el) : undefined}
                    value={gaps[i]}
                    disabled={final}
                    onChange={(e) => {
                      setGaps((g) => g.map((x, j) => (j === i ? e.target.value : x)));
                      setWrongGaps((w) => w.filter((n) => n !== i + 1));
                    }}
                    aria-label={`Lücke ${i + 1}`}
                    aria-invalid={wrongGaps.includes(i + 1) || undefined}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    // grows with the answer: long words and several words fit, the line wraps around it
                    style={{ width: `min(100%, ${Math.max(6, gaps[i].length + 2)}ch)` }}
                    className={`mx-1 inline-block min-h-[44px] border-0 border-b-2 px-2 py-0 text-center text-[19px] font-semibold outline-none disabled:opacity-70 ${
                      wrongGaps.includes(i + 1) ? "border-red bg-red-wash text-red" : "border-accent bg-accent-wash/60 text-accent focus:bg-accent-wash"
                    }`}
                  />
                )}
              </span>
            ))}
          </p>
        ) : (
          <p className="text-[21px] leading-snug font-medium whitespace-pre-line"><MathText text={task.prompt} /></p>
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
                <span><MathText text={o} /></span>
              </label>
            ))}
          </div>
        )}

        {task.steps && (
          <ol className="mt-6 grid gap-2" aria-label="Schritte ordnen">
            {order.map((stepIndex, pos) => (
              <li key={stepIndex} className="flex items-center gap-3 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-[17px]">
                <span className="num w-6 shrink-0 font-semibold text-ink-3">{pos + 1}.</span>
                <span className="min-w-0 flex-1"><MathText text={task.steps![stepIndex]} /></span>
                {!final && (
                  <span className="flex shrink-0 gap-1">
                    <button type="button" className="btn btn-ghost btn-sm h-10 w-10" disabled={pos === 0} onClick={() => move(pos, -1)} aria-label={`„${task.steps![stepIndex]}“ nach oben`}>
                      <ArrowUp size={18} aria-hidden />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm h-10 w-10" disabled={pos === order.length - 1} onClick={() => move(pos, 1)} aria-label={`„${task.steps![stepIndex]}“ nach unten`}>
                      <ArrowDown size={18} aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        {task.faulty !== null && (
          <div className="mt-6">
            <p className="text-[13px] font-semibold text-ink-2">Text mit Fehlern</p>
            <p className="mt-1 rounded-xl border border-line bg-panel px-5 py-3 text-[17px] leading-relaxed whitespace-pre-line">{task.faulty}</p>
            {final && feedback?.given && feedback.expected ? (
              <FixCompare faulty={task.faulty} given={feedback.given} expected={feedback.expected} className="mt-4" />
            ) : (
              <>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <label htmlFor={`fix-${task.id}`} className="text-[13px] font-semibold text-ink-2">
                    Dein verbesserter Text
                  </label>
                  {!final && (
                    <button type="button" className="btn btn-ghost btn-sm h-11" disabled={!text || unchanged} onClick={() => setText(task.faulty ?? "")}>
                      <RotateCcw size={15} aria-hidden /> Zurücksetzen
                    </button>
                  )}
                </div>
                <textarea
                  id={`fix-${task.id}`}
                  ref={(el) => void (inputRef.current = el)}
                  className="input mt-1 text-[17px] leading-relaxed"
                  rows={Math.min(14, Math.max(3, Math.ceil(task.faulty.length / 55) + 1))}
                  value={text}
                  disabled={final}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                {unchanged && !final && <p className="mt-1 text-[13px] text-ink-3">Verbessere die Fehler direkt im Text.</p>}
              </>
            )}
          </div>
        )}

        {!task.options && !task.steps && task.blanks === 0 && task.faulty === null &&
          ((task.type === "free" || task.type === "reading") && task.lines !== 1 ? (
            <div className="mt-6">
              <textarea
                ref={(el) => void (inputRef.current = el)}
                className="input text-[17px] leading-relaxed"
                rows={Math.min(16, Math.max(5, task.lines ?? 6))}
                value={text}
                disabled={final}
                onChange={(e) => setText(e.target.value)}
                placeholder="Deine Antwort"
                aria-label="Deine Antwort"
              />
              <p className="num mt-1 text-right text-[13px] text-ink-3" aria-live="polite">
                {words(text) === 1 ? "1 Wort" : `${words(text)} Wörter`}
              </p>
            </div>
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
              style={task.type === "free" ? { maxWidth: "100%" } : undefined}
            />
          ))}
        {task.type === "calc" && !task.options && task.blanks === 0 &&
          (text.includes("/") && splitFractions(text).some((x) => typeof x !== "string") ? (
            <p className="mt-2 text-[17px] text-ink-2" aria-live="polite">
              <span className="text-[13px] text-ink-3">Deine Antwort: </span>
              <MathText text={text} />
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-3">
              Brüche schreibst du so: 3/4, das wird zu <MathText text="3/4" />. Kommazahlen mit Beistrich: 0,75.
            </p>
          ))}

        {hintsShown > 0 && (
          <ul className="mt-6 space-y-2">
            {task.hints.slice(0, hintsShown).map((h, i) => (
              <li key={i} className="flex gap-2 rounded-lg bg-amber-wash px-4 py-2.5 text-[15px] text-[#5c3a00]">
                <Lightbulb size={17} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  <span className="block text-[12.5px] font-semibold">{hintLabel(i)}</span>
                  <MathText text={h} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {feedback && !feedback.pending && (
          <div
            role="status"
            className={`mt-6 flex gap-3 rounded-xl px-4 py-3 text-[16px] ${feedback.correct ? "bg-green-wash text-green" : feedback.partial ? "bg-amber-wash text-amber" : "bg-red-wash text-red"}`}
          >
            {feedback.correct ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden /> : <XCircle size={20} className="mt-0.5 shrink-0" aria-hidden />}
            <span className="font-medium"><MathText text={feedback.text} /></span>
          </div>
        )}

        {feedback?.pending && (
          <>
            <div role="status" className="mt-6 flex gap-3 rounded-xl bg-accent-wash px-4 py-3 text-[16px] text-ink">
              <CircleDashed size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span className="font-medium">{feedback.text}</span>
            </div>
            {feedback.sample && (
              <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-4">
                <p className="text-[14px] font-semibold text-ink-2">So könnte eine Antwort aussehen</p>
                <p className="mt-1 text-[16px] whitespace-pre-line"><MathText text={feedback.sample} /></p>
              </div>
            )}
          </>
        )}

        {final && feedback?.solution && !feedback.pending && (
          <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-4">
            <p className="text-[14px] font-semibold text-ink-2">Lösungsweg</p>
            <p className="mt-1 text-[16px] whitespace-pre-line"><MathText text={feedback.solution} /></p>
          </div>
        )}

        {task.released && !final && (
          <details className="mt-4 rounded-xl border border-line bg-surface px-5 py-3">
            <summary className="cursor-pointer text-[14px] font-semibold text-ink-2">Lösung ansehen (von deinem Lehrer gezeigt)</summary>
            {task.released.answer && <p className="mt-2 font-semibold"><MathText text={task.released.answer} /></p>}
            <p className="mt-1 text-[16px] whitespace-pre-line"><MathText text={task.released.solution} /></p>
          </details>
        )}

        {unsent && !pending && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-amber-wash px-4 py-3 text-[15px]">
            <CloudOff size={18} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              {unsent.network ? "Keine Verbindung. Deine Antwort ist noch da und wird gesendet, sobald das Internet wieder geht." : "Das Senden hat nicht geklappt."}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => deliver(unsent.input)}>
              Nochmal senden
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {!final && (
            <>
              <button className="btn btn-primary h-11 px-6 text-[15px]" disabled={!canSubmit}>
                {pending ? "Wird geprüft …" : "Prüfen"}
              </button>
              {hintsShown < task.hints.length && (
                <button type="button" className="btn btn-secondary h-11" onClick={openHint}>
                  <Lightbulb size={16} aria-hidden /> {hintLabel(hintsShown)}
                </button>
              )}
              {(tries > 0 || hintsShown >= task.hints.length) && (
                <button type="button" className="btn btn-ghost h-11" disabled={pending} onClick={() => send({ giveUp: true })}>
                  Ich komme nicht weiter
                </button>
              )}
              {tries > 0 && (
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

/** On the tablet the way back changes what it shows, so it must never be prefetched: a plain link there. */
function HomeLink({ href, plain, className, children }: { href: string; plain: boolean; className: string; children: React.ReactNode }) {
  return plain ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
