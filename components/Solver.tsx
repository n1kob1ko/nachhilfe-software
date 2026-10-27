"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, BookOpenText, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, ClipboardCheck, CloudOff, Lightbulb, ListChecks, RotateCcw, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitAnswerAction } from "@/app/actions";
import { recordHintAction } from "@/app/builder-actions";
import { deviceRecordHintAction, deviceSubmitAnswerAction } from "@/app/device-actions";
import { laptopRecordHintAction, laptopSubmitAnswerAction } from "@/app/laptop-actions";
import { buchstabe, hintLabel, isReview, kreisZahl, REVIEWS } from "@/lib/tasks";
import type { MathAnswer as MathDraft } from "@/lib/math-check";
import type { MathView } from "@/lib/math-task";
import { clozeParts } from "@/lib/math-format";
import { splitFractions } from "@/lib/math-text";
import { checkedMath, initialMath, markMath, MathAnswerInput, mathAnswer, mathReady, mathTouched, restoreMath, type MathState, type MathTaskView } from "./MathAnswer";
import { GenusBadge } from "./TaskPreview";
import { FigurBild, figurKopf } from "./Figur";
import { MathText } from "./MathText";
import { FixCompare } from "./FixMarks";
import { ReadingTextView } from "./ReadingText";
import { MemorizeTextBox } from "./MemorizeText";
import { UmlautBar, type TextTarget } from "./UmlautBar";
import { isMemorizeLevel, type MemorizeLevel } from "@/lib/memorize";

export type ClientTask = {
  id: number;
  type: string;
  prompt: string;
  options: string[] | null;
  passage: string | null;
  /** Leseverständnis: the shared text, on the first question only; every question is about it (lib/lesen.ts). */
  reading?: { title: string; text: string; lang: string; zeilen?: boolean; leerzeilen?: boolean } | null;
  blanks: number;
  /** Cloze: the gaps are word endings; a gap may stay empty (= keine Endung, lib/tasks.ts AnswerSpec.endings). */
  endings?: boolean;
  /** Order tasks: the steps in the (shuffled) order they are shown. */
  steps: string[] | null;
  /** Matura „2 aus 5“ (lib/matura-formate.ts): so viele Antworten sind anzukreuzen; null = eine Antwort. */
  pick?: number | null;
  /** Lückentext zum Ankreuzen: je Lücke (① ②) die Satzteile; die Antwort ist der gewählte Satzteil. */
  gapOptions?: string[][] | null;
  /**
   * Zuordnung: die Aussagen und die Antworten A bis D, ohne die Lösung. Englisch-Matura: art sagt, ob es True or
   * False, Multiple Choice zum Text (choices: je Frage die Antworten A bis D) oder Multiple Matching ist.
   */
  zuordnung?: { statements: string[]; options: string[]; art?: string | null; choices?: string[][] | null } | null;
  /**
   * Englisch-Matura (lib/englisch-matura-formate.ts): lesetext = der Text steht neben den Fragen, wortliste = die Wörter
   * im Kasten, maxWords = Short Answers, editing = Zeilen mit ✓, schreiben = Writing mit dem Rahmen der Wortanzahl.
   */
  englisch?: {
    format: string;
    lesetext: { title: string } | null;
    wortliste: string[] | null;
    maxWords: number | null;
    editing: boolean;
    schreiben: { textsorte: string; woerter: number; min: number; max: number } | null;
  } | null;
  hints: string[];
  /** Hints already opened earlier (stored per hint). */
  hintsOpened: number;
  /**
   * Set when the teacher has released the solutions for this exercise (Freigabe „Hilfen und Lösung“); steps, other
   * ways, the explanation and what to watch for only with „Alles“ (lib/freigabe.ts).
   */
  released: { solution: string; answer: string | null; steps?: string[]; ways?: string[]; explanation?: string; watch?: string[] } | null;
  triesUsed: number;
  /** Fehler korrigieren: the text with errors the student corrects. */
  faulty: string | null;
  /** Freie Antwort: 1 = one line, more = a text field of about that many lines. */
  lines: number | null;
  /** Artikel-Aufgaben: das Genus des Nomens (m/f/n) für die Färbung nach D10; null, wenn keines gesetzt ist. */
  genus: "m" | "f" | "n" | null;
  /** Rechenweg and Sachaufgabe: the equation or term, the parts (components/MathAnswer.tsx). */
  math: MathTaskView | null;
  /** Aufgabe mit Bild: das fertige SVG ohne Lösung (lib/figur.ts figurSvg); null ohne Bild. */
  figur?: string | null;
  /** Quellenangabe einer übernommenen Aufgabe („aufgabenpool.at, 1_234“), klein unter der Aufgabe; null ohne. */
  quelle?: string | null;
  /**
   * correct null: waits for the teacher's grade. review: the teacher's grade (richtig, teilweise, falsch).
   * given and expected: the student's corrected text and the right one (Fehler korrigieren).
   */
  finished: { correct: boolean | null; solution: string; review?: string | null; sample?: string | null; given?: string | null; expected?: string | null; math?: MathView | null } | null;
};

type AnswerInput = { assignmentId: number; taskId: number; answer: string; timeMs: number; activeMs: number; hintsUsed: number; giveUp?: boolean; submissionId: string };

/** One id per click on "Prüfen": a repeat after a lost connection carries the same id and is stored once. */
export function newSubmissionId() {
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
type Draft = {
  choice?: number | null;
  text?: string;
  gaps?: string[];
  order?: number[];
  math?: MathDraft;
  /** Auswendig schreiben: die gewählte Stufe der Hilfe. */
  level?: number;
  /** Matura „2 aus 5“: die angekreuzten Antworten. */
  picks?: number[];
  /** Zuordnung: je Aussage der gewählte Buchstabe (0 = A), null = noch keiner. */
  pairs?: (number | null)[];
  /** True or False: je Aussage die ersten Wörter des Belegs. */
  belege?: string[];
};
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
  test = false,
  probe = false,
  kontrolle = false,
}: {
  token: string;
  assignmentId: number;
  title: string;
  tasks: ClientTask[];
  maxTries: number;
  /**
   * Minitest (lib/minitest.ts): erst ein Startbildschirm, dann ohne Tipps und ohne „Ich komme nicht weiter“,
   * je Aufgabe einmal abgeben, ohne Rückmeldung dazwischen; richtig oder falsch erst am Ende.
   */
  test?: boolean;
  /** Probeschularbeit (lib/probeschularbeit.ts): läuft wie ein Minitest, nur Anfang und Ende sagen „Probeschularbeit“ */
  probe?: boolean;
  /** Lernkontrolle am Ende eines Themas (lib/cockpit.ts, Notiz LERNKONTROLLE): läuft wie ein Minitest, ist aber über den Stoff von heute */
  kontrolle?: boolean;
  /** "geraet": on the teacher's student tablet, "laptop": on the student's own laptop for this unit; both authorised by
   * their device instead of the student link */
  via?: Via;
  homeHref?: string;
}) {
  const [tasks, setTasks] = useState(initial);
  const firstOpen = initial.findIndex((t) => !t.finished);
  const [index, setIndex] = useState(firstOpen === -1 ? initial.length : firstOpen);
  // Minitest: der Startbildschirm, solange noch keine Aufgabe abgegeben ist
  const [begonnen, setBegonnen] = useState(!test || initial.some((t) => t.finished));
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
  const reading = initial[0]?.reading ?? null;
  // Leseverständnis: on a small screen either the text or the question, the student switches
  const [view, setView] = useState<"text" | "frage">("text");
  // the next question not answered yet (after the open one, then from the start); none left: the end
  const nextOpen = (from: number) => {
    for (let k = 1; k <= tasks.length; k++) {
      const j = (from + k) % tasks.length;
      if (!tasks[j].finished && j !== from) return j;
    }
    return tasks.length;
  };
  const noun = reading ? "Frage" : "Aufgabe";
  const tone = (t: ClientTask) =>
    t.finished ? (t.finished.correct === null || t.finished.review === "teilweise" ? "amber" : t.finished.correct ? "green" : "red") : null;

  if (test && index >= tasks.length) {
    return (
      <div className="py-6 text-center" data-testid="minitest-ende">
        <p className="text-[15px] font-medium text-ink-2">{title}</p>
        <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.02em]">{probe ? "Probeschularbeit geschafft" : kontrolle ? "Lernkontrolle geschafft" : "Minitest geschafft"}</h1>
        <p className="num mt-2 text-[20px]">
          {correct} von {tasks.length} richtig
        </p>
        {waiting > 0 && (
          <p className="num mt-1 text-[16px] text-ink-2">
            {waiting === 1 ? "1 Antwort wird" : `${waiting} Antworten werden`} noch von deiner Lehrerin bzw. deinem Lehrer bewertet.
          </p>
        )}
        <ol className="mx-auto mt-6 flex max-w-[480px] flex-wrap justify-center gap-2" aria-label="Deine Aufgaben">
          {tasks.map((t, i) => {
            const c = tone(t);
            return (
              <li
                key={t.id}
                aria-label={`Aufgabe ${i + 1}: ${c === "green" ? "richtig" : c === "amber" ? "wird bewertet" : "falsch"}`}
                className={`num flex h-12 w-12 flex-col items-center justify-center rounded-full text-[13px] leading-none font-semibold ${
                  c === "green" ? "bg-green-wash text-green" : c === "amber" ? "bg-amber-wash text-amber" : "bg-red-wash text-red"
                }`}
              >
                <span>{i + 1}</span>
                {c === "green" ? <Check size={14} aria-hidden /> : c === "amber" ? <CircleDashed size={14} aria-hidden /> : <X size={14} aria-hidden />}
              </li>
            );
          })}
        </ol>
        <p className="mx-auto mt-6 max-w-[44ch] text-ink-2">
          {probe
            ? "Die Punkte und die Note bekommst du von deiner Lehrerin bzw. deinem Lehrer. Ihr schaut euch alles gemeinsam an."
            : kontrolle
              ? "Ihr schaut euch die Aufgaben gleich gemeinsam an."
              : "Fehler sind hier gut: Sie zeigen, was ihr heute übt. Ihr schaut euch den Test gleich gemeinsam an."}
        </p>
        <div className="mt-8 flex justify-center">
          <HomeLink href={home} plain={via !== "link"} className="btn btn-primary">
            Zurück zur Übersicht
          </HomeLink>
        </div>
      </div>
    );
  }

  if (test && !begonnen) {
    return (
      <div className="mx-auto max-w-[560px] py-6 text-center" data-testid="minitest-start">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-wash text-accent" aria-hidden>
          <ClipboardCheck size={28} strokeWidth={1.75} />
        </span>
        <p className="mt-4 text-[15px] font-medium text-ink-2">{title}</p>
        <h1 className="mt-1 text-[34px] font-semibold tracking-[-0.02em]">{probe ? "Probeschularbeit" : kontrolle ? "Lernkontrolle" : "Minitest"}</h1>
        <p className="num mt-2 text-[20px]">
          {probe ? `${tasks.length} Aufgaben wie bei der Schularbeit` : kontrolle ? `${tasks.length} Aufgaben zu dem, was du heute geübt hast` : `${tasks.length} Aufgaben über den Stoff vom letzten Mal`}
        </p>
        <ul className="mx-auto mt-6 grid max-w-[440px] gap-3 text-left text-[17px]">
          <li className="flex gap-3">
            <Check size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden /> Ohne Tipps, jede Aufgabe gibst du einmal ab.
          </li>
          <li className="flex gap-3">
            <Check size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden /> Weißt du etwas nicht? Mach mit „Später“ weiter und komm am Schluss zurück.
          </li>
          <li className="flex gap-3">
            <Check size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />{" "}
            {probe ? "Jede Aufgabe hat Punkte. Am Ende gibt es eine Note, wie bei der Schularbeit." : "Es gibt keine Note. Danach schaut ihr euch alles gemeinsam an."}
          </li>
        </ul>
        <button type="button" className="btn btn-primary btn-lg mt-8" onClick={() => setBegonnen(true)} autoFocus>
          Los geht&apos;s <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    );
  }

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
          {reading && waiting === tasks.length ? `Alle ${tasks.length} Antworten abgegeben` : `${correct} von ${tasks.length} ${reading ? "Fragen" : "Aufgaben"} richtig`}
        </p>
        {waiting > 0 && (
          <p className="num mt-1 text-[16px] text-ink-2">
            {waiting === 1 ? "1 Antwort wird" : `${waiting} Antworten werden`} noch von deiner Lehrerin bzw. deinem Lehrer bewertet.
          </p>
        )}
        <p className="mx-auto mt-3 max-w-[48ch] text-ink-2">Deine Ergebnisse sind gespeichert. Deine Nachhilfelehrerin bzw. dein Nachhilfelehrer sieht, wo du schon sicher bist und was ihr noch übt.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {reading && (
            <button type="button" className="btn btn-secondary" onClick={() => setIndex(0)}>
              Text und Antworten ansehen
            </button>
          )}
          <HomeLink href={home} plain={via !== "link"} className="btn btn-primary">
            Zurück zur Übersicht
          </HomeLink>
        </div>
      </div>
    );
  }

  const task = tasks[index];
  const card = (
    <TaskCard
      key={task.id}
      task={task}
      token={token}
      via={via}
      assignmentId={assignmentId}
      maxTries={maxTries}
      reading={Boolean(reading)}
      onFinished={(f) => setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, finished: f } : t)))}
      onNext={() => setIndex(reading || test ? nextOpen(index) : index + 1)}
      isLast={reading || test ? nextOpen(index) === tasks.length : index === tasks.length - 1}
      test={test}
      onSkip={test && nextOpen(index) !== tasks.length ? () => setIndex(nextOpen(index)) : undefined}
    />
  );
  if (reading) {
    const go = (i: number) => {
      setIndex(i);
      setView("frage");
    };
    return (
      <div className="lesen-breit">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <HomeLink href={home} plain={via !== "link"} className="min-w-0 text-[14px] font-medium text-ink-2 hover:text-ink">
            ← {title}
          </HomeLink>
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Fragen">
            {tasks.map((t, i) => {
              const c = tone(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Frage ${i + 1}${t.finished ? (t.finished.correct === null ? ", abgegeben" : t.finished.correct ? ", richtig" : ", erledigt") : ""}`}
                  className={`num flex h-11 w-11 items-center justify-center rounded-full border text-[15px] font-semibold transition-colors ${
                    i === index
                      ? "border-accent bg-accent text-on-fill"
                      : c === "green"
                        ? "border-transparent bg-green-wash text-green"
                        : c === "amber"
                          ? "border-transparent bg-amber-wash text-amber"
                          : c === "red"
                            ? "border-transparent bg-red-wash text-red"
                            : "border-line-strong bg-surface text-ink-2 hover:border-ink-3"
                  }`}
                >
                  {t.finished && i !== index ? <Check size={16} aria-hidden /> : i + 1}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="sticky top-0 z-10 -mx-1 mb-4 flex gap-1 rounded-full bg-panel p-1 lg:hidden" role="tablist" aria-label="Ansicht">
          {(["text", "frage"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold ${view === v ? "bg-surface shadow-[var(--shadow-card)]" : "text-ink-2"}`}
            >
              {v === "text" ? <BookOpenText size={17} aria-hidden /> : <ListChecks size={17} aria-hidden />}
              {v === "text" ? "Text" : `Frage ${index + 1} von ${tasks.length}`}
            </button>
          ))}
        </div>
        <div className="lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <section
            aria-label="Lesetext"
            className={`${view === "frage" ? "hidden lg:block" : ""} rounded-2xl border border-line bg-surface px-5 py-6 md:px-8 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto`}
          >
            <ReadingTextView title={reading.title} text={reading.text} size="lg" lang={reading.lang} zeilen={reading.zeilen} leerzeilen={reading.leerzeilen} />
            <button type="button" className="btn btn-primary mt-6 lg:hidden" onClick={() => setView("frage")}>
              Zu Frage {index + 1} <ChevronRight size={17} aria-hidden />
            </button>
          </section>
          <section aria-label={`Frage ${index + 1}`} className={view === "text" ? "hidden lg:block" : ""}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="num text-[15px] font-semibold text-ink-2" aria-live="polite">
                Frage {index + 1} von {tasks.length}
              </p>
              <span className="flex gap-1">
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-panel disabled:opacity-30" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Zur vorigen Frage">
                  <ChevronLeft size={18} aria-hidden />
                </button>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-panel disabled:opacity-30" disabled={index === tasks.length - 1} onClick={() => go(index + 1)} aria-label="Zur nächsten Frage">
                  <ChevronRight size={18} aria-hidden />
                </button>
              </span>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-5 py-5 md:px-6">{card}</div>
            <p className="num mt-3 text-[13px] text-ink-3">
              {done} von {tasks.length} beantwortet
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-4 text-[14px]">
          <HomeLink href={home} plain={via !== "link"} className="font-medium text-ink-2 hover:text-ink">
            ← {title}
          </HomeLink>
          <span className="num shrink-0 text-ink-2">
            {noun} {index + 1} von {tasks.length}
          </span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {tasks.map((t, i) => (
            <span
              key={t.id}
              className={`h-1.5 flex-1 rounded-full ${
                t.finished && test
                  ? "bg-ink-3"
                  : t.finished
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
          {done} von {tasks.length} {test ? "abgegeben" : "erledigt"}
        </p>
      </div>
      {card}
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
  reading = false,
  test = false,
  onSkip,
}: {
  task: ClientTask;
  token: string;
  via: Via;
  assignmentId: number;
  maxTries: number;
  /** a question about the reading text next to it: smaller, "Abgeben" for answers the teacher grades */
  reading?: boolean;
  onFinished: (f: NonNullable<ClientTask["finished"]>) => void;
  onNext: () => void;
  isLast: boolean;
  /** Minitest: „Abgeben“ statt „Prüfen“, keine Rückmeldung, danach gleich die nächste offene Aufgabe */
  test?: boolean;
  /** Minitest: die Aufgabe für später lassen (nur, wenn es noch eine andere offene gibt) */
  onSkip?: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState(task.faulty ?? "");
  const [gaps, setGaps] = useState<string[]>(() => Array(task.blanks).fill(""));
  // Matura-Formate (lib/matura-formate.ts): „2 aus 5“ kreuzt mehrere an, die Zuordnung gibt jeder Aussage einen Buchstaben
  const mehrfach = Boolean(task.pick && task.options);
  const [picks, setPicks] = useState<number[]>([]);
  const [pairs, setPairs] = useState<(number | null)[]>(() => (task.zuordnung?.statements ?? []).map(() => null));
  // Englisch-Matura (lib/englisch-matura-formate.ts): True or False mit Beleg, Multiple Choice je Frage, Wörter aus dem Kasten
  const en = task.englisch ?? null;
  const richtigFalsch = task.zuordnung?.art === "richtig-falsch";
  const fragen = task.zuordnung?.art === "fragen";
  const [belege, setBelege] = useState<string[]>(() => (task.zuordnung?.statements ?? []).map(() => ""));
  // die Lücke, in die ein Wort aus dem Kasten kommt
  const [aktiv, setAktiv] = useState(0);
  // Auswendig schreiben: wie viel vom Text noch zu sehen ist (lib/memorize.ts)
  const [level, setLevel] = useState<MemorizeLevel>(0);
  // die Umlautleiste schreibt in das Textfeld, das zuletzt den Fokus hatte
  const umlaut = useRef<TextTarget | null>(null);
  const [hintsShown, setHintsShown] = useState(Math.min(task.hintsOpened, task.hints.length));
  const [order, setOrder] = useState<number[]>(() => (task.steps ?? []).map((_, i) => i));
  const m = task.math;
  const [math, setMath] = useState<MathState | null>(() => (m ? (task.finished?.math ? checkedMath(m, task.finished.math) : initialMath(m)) : null));
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
  // the answer is kept on this device while it is written (shown in a Leseverständnis)
  const [kept, setKept] = useState(false);
  useEffect(() => {
    startedAt.current = Date.now();
    if (!task.finished) {
      const d = readDraft(key);
      if (d) {
        if (typeof d.choice === "number" && task.options && d.choice < task.options.length) setChoice(d.choice);
        if (typeof d.text === "string") setText(d.text);
        if (Array.isArray(d.gaps) && d.gaps.length === task.blanks) setGaps(d.gaps.map(String));
        if (Array.isArray(d.order) && d.order.length === (task.steps?.length ?? 0)) setOrder(d.order);
        if (isMemorizeLevel(d.level)) setLevel(d.level);
        if (Array.isArray(d.picks) && task.options) setPicks(d.picks.filter((i) => Number.isInteger(i) && i >= 0 && i < task.options!.length));
        const z = task.zuordnung;
        if (Array.isArray(d.pairs) && z && d.pairs.length === z.statements.length)
          setPairs(d.pairs.map((p, i) => (typeof p === "number" && Number.isInteger(p) && p >= 0 && p < (z.choices?.[i]?.length ?? z.options.length) ? p : null)));
        if (Array.isArray(d.belege) && z && d.belege.length === z.statements.length) setBelege(d.belege.map(String));
        if (m && d.math && typeof d.math === "object") setMath(restoreMath(m, d.math));
      }
    }
    restored.current = true;
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per task
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    if (final) return writeDraft(key, null);
    const changed =
      choice !== null ||
      (task.faulty ? text !== task.faulty : text !== "") ||
      gaps.some((g) => g) ||
      order.some((o, i) => o !== i) ||
      (math !== null && mathTouched(math)) ||
      level > 0 ||
      picks.length > 0 ||
      pairs.some((p) => p !== null) ||
      belege.some((b) => b.trim());
    writeDraft(key, changed ? { choice, text, gaps, order, level, picks, pairs, belege, ...(m && math ? { math: mathAnswer(m, math) } : {}) } : null);
    setKept(changed);
  }, [key, final, choice, text, gaps, order, math, m, task.faulty, level, picks, pairs, belege]);

  // „2 aus 5“ und Zuordnung schicken ein JSON-Array von Indizes (lib/tasks.ts checkAnswer), der Lückentext die Satzteile,
  // True or False die Wahl und die Belege ({ wahl, belege }, lib/englisch-matura-pruefen.ts)
  const answer =
    m && math
      ? JSON.stringify(mathAnswer(m, math))
      : task.zuordnung
        ? richtigFalsch
          ? JSON.stringify({ wahl: pairs, belege: belege.map((b) => b.trim()) })
          : JSON.stringify(pairs)
        : task.options
          ? mehrfach
            ? JSON.stringify([...picks].sort((a, b) => a - b))
            : choice === null
              ? ""
              : String(choice)
          : task.steps
            ? JSON.stringify(order)
            : task.blanks > 0
              ? JSON.stringify(gaps)
              : text;
  // a correction task needs a changed text: the faulty one as it is is never the answer
  const unchanged = task.faulty !== null && text.trim() === task.faulty.trim();
  const canSubmit =
    !pending &&
    !final &&
    (m && math ? mathReady(m, math) : task.zuordnung ? pairs.every((p) => p !== null) : task.options ? (mehrfach ? picks.length > 0 : choice !== null) : task.steps ? true : task.blanks > 0 ? (task.endings ? gaps.some((g) => g.trim()) : gaps.every((g) => g.trim())) : text.trim().length > 0 && !unchanged);
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

  // the newest onNext: deliver is made once, the Minitest moves on with it
  const next = useRef(onNext);
  next.current = onNext;

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
        if (m && res.math && !test) setMath((s) => s && markMath(m, s, res.math));
        const given = task.faulty !== null ? input.answer : undefined;
        const partial = res.review === "teilweise";
        setFeedback({ correct: res.correct, text: res.feedback, final: res.final, partial, solution: res.solution, sample: res.sample, pending: res.pendingReview, expected: res.expected, given });
        if (res.final) {
          writeDraft(draftKey(via, assignmentId, task.id), null);
          onFinished({ correct: res.pendingReview ? null : Boolean(res.correct), review: res.review ?? null, solution: res.solution ?? "", sample: res.sample ?? null, given: given ?? null, expected: res.expected ?? null, math: res.math ?? null });
          // Minitest: keine Rückmeldung zur einzelnen Aufgabe, gleich weiter
          if (test) next.current();
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onFinished is a fresh arrow each render
    [via, token, test],
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

  // Aufgabe mit Bild und Lücken: die Frage (erste Zeile ohne Lücke) steht über dem Bild, die Lücken darunter
  const bildKopf = task.figur && task.blanks > 0 ? figurKopf(task.prompt, GAP) : null;
  // Englisch-Matura mit Lücken: der Arbeitsauftrag über dem Kasten mit den Wörtern, der Text darunter
  const enKopf = en && !bildKopf && task.blanks > 0 && task.prompt.includes("\n\n") && !task.prompt.split("\n\n")[0].includes(GAP) ? task.prompt.split("\n\n")[0] : null;
  const clozeText = bildKopf ? task.prompt.slice(bildKopf.length + 1) : enKopf ? task.prompt.slice(enKopf.length + 2) : task.prompt;
  const promptParts = useMemo(() => clozeParts(clozeText, GAP), [clozeText]);
  // the teacher grades the answer: it is handed in, not checked
  const handIn = test || (reading && (task.type === "free" || (task.type === "reading" && !task.options))) || Boolean(en?.schreiben);
  // Englisch-Matura, Reading: der Text mit nummerierten Absätzen, am großen Bildschirm neben den Fragen
  const lesetext = en?.lesetext && task.passage ? en.lesetext : null;
  // Banked Gap Fill: ein Wort aus dem Kasten kommt in die gewählte Lücke, dann geht es zur nächsten leeren
  const wortRein = (w: string) => {
    const next = gaps.map((x, j) => (j === aktiv ? w : x));
    setGaps(next);
    setWrongGaps((x) => x.filter((n) => n !== aktiv + 1));
    const leer = next.findIndex((x, j) => j > aktiv && !x.trim());
    const irgendeine = next.findIndex((x) => !x.trim());
    setAktiv(leer >= 0 ? leer : irgendeine >= 0 ? irgendeine : aktiv);
  };
  const zuLang = en?.maxWords ? gaps.map((g, i) => (words(g) > en.maxWords! ? i + 1 : 0)).filter(Boolean) : [];

  return (
    <article className={lesetext ? "lesen-breit lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-start lg:gap-8" : undefined}>
      {lesetext ? (
        <section
          aria-label="Lesetext"
          className="mb-6 rounded-2xl border border-line bg-surface px-5 py-6 md:px-8 lg:sticky lg:top-4 lg:mb-0 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
        >
          <ReadingTextView title={lesetext.title} text={task.passage!} size="lg" lang="en" />
        </section>
      ) : (
        task.passage &&
        (task.type === "memorize" ? (
          // Auswendig schreiben: der Text mit der gewählten Hilfe-Stufe (lib/memorize.ts); fertig steht
          // der ganze Text wieder da (dann sind die Stufen nur noch Anzeige)
          <MemorizeTextBox passage={task.passage} level={final ? 0 : level} onChange={setLevel} disabled={final} />
        ) : (
          <div className="ruled mb-6 rounded-xl border border-line bg-surface px-5 py-1 text-[17px]"><MathText text={task.passage} /></div>
        ))
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) send();
        }}
      >
        {bildKopf && (
          <p className="text-[21px] leading-snug font-medium whitespace-pre-line">
            <MathText text={bildKopf} />
          </p>
        )}
        {bildKopf && <FigurBild svg={task.figur} groesser={1.2} className="mb-3" />}
        {enKopf && (
          <p className="mb-4 text-[18px] leading-snug font-medium" lang="en">
            {enKopf}
          </p>
        )}
        {en?.wortliste && (
          <div className="mb-5 rounded-xl border border-line bg-panel px-4 py-3">
            <p className="text-[13px] font-semibold text-ink-2">{final ? "Wörter im Kasten" : "Wörter im Kasten: tippe ein Wort an, es kommt in die markierte Lücke."}</p>
            <div className="mt-2 flex flex-wrap gap-2" lang="en">
              {en.wortliste.map((w) => {
                const benutzt = gaps.some((g) => g.trim().toLowerCase() === w.toLowerCase());
                return (
                  <button
                    key={w}
                    type="button"
                    disabled={final}
                    onClick={() => wortRein(w)}
                    aria-label={benutzt ? `${w}, schon verwendet` : w}
                    className={`min-h-[40px] rounded-lg border px-3 text-[16px] font-medium transition-colors ${
                      benutzt ? "border-line text-ink-3 line-through" : "border-line-strong bg-surface hover:border-ink-3"
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {task.gapOptions ? (
          // Lückentext zum Ankreuzen: statt Eingabefeldern stehen ① ② im Satz, gefüllt mit dem angekreuzten Satzteil
          <p className="text-[21px] leading-[2.1] font-medium">
            {promptParts.map((p, i) => (
              <span key={i} className="whitespace-pre-line">
                <MathText text={p.text} />
                {i < promptParts.length - 1 && (
                  <span
                    className={`mx-1 inline-flex min-h-[40px] items-baseline gap-1.5 rounded-lg border-2 px-2 align-baseline text-[19px] ${
                      wrongGaps.includes(i + 1) ? "border-red bg-red-wash text-red" : gaps[i] ? "border-accent bg-accent-wash/60 text-accent" : "border-dashed border-line-strong text-ink-3"
                    }`}
                  >
                    <span aria-hidden>{kreisZahl(i + 1)}</span>
                    {gaps[i] ? <MathText text={gaps[i]} /> : <span className="inline-block w-10" aria-hidden />}
                    {!gaps[i] && <span className="sr-only">Lücke {i + 1}, noch nichts angekreuzt</span>}
                  </span>
                )}
              </span>
            ))}
          </p>
        ) : task.blanks > 0 ? (
          <p className={`${reading || en ? "text-[18px] leading-[2.2]" : "text-[21px] leading-[2.1]"} font-medium`} lang={en ? "en" : undefined}>
            {promptParts.map((p, i) => (
              <span key={i} className="whitespace-pre-line">
                {en ? p.text : <MathText text={p.text} />}
                {i < promptParts.length - 1 && (
                  <>
                    <input
                      ref={i === 0 ? (el) => void (inputRef.current = el) : undefined}
                      value={gaps[i]}
                      disabled={final}
                      onChange={(e) => {
                        setGaps((g) => g.map((x, j) => (j === i ? e.target.value : x)));
                        setWrongGaps((w) => w.filter((n) => n !== i + 1));
                      }}
                      onFocus={(e) => {
                        setAktiv(i);
                        umlaut.current = { el: e.currentTarget, set: (v) => setGaps((g) => g.map((x, j) => (j === i ? v : x))) };
                      }}
                      aria-label={p.raised ? `Lücke ${i + 1}, Hochzahl` : en?.editing ? `Zeile ${i + 1}` : en?.maxWords ? `Antwort ${i + 1}` : `Lücke ${i + 1}`}
                      aria-invalid={wrongGaps.includes(i + 1) || undefined}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      // grows with the answer: long words and several words fit, the line wraps around it
                      // a gap in an exponent ("3^___") sits raised and smaller, like the power it stands for
                      style={{ width: `min(100%, ${Math.max(p.raised ? 3 : 6, gaps[i].length + 2)}ch)` }}
                      className={`inline-block border-0 border-b-2 py-0 text-center font-semibold outline-none disabled:opacity-70 ${
                        p.raised ? "relative -top-[0.7em] mx-0.5 min-h-[36px] px-1 text-[15px]" : "mx-1 min-h-[44px] px-2 text-[19px]"
                      } ${
                        wrongGaps.includes(i + 1) ? "border-red bg-red-wash text-red" : "border-accent bg-accent-wash/60 text-accent focus:bg-accent-wash"
                      } ${en?.wortliste && !final && i === aktiv ? "rounded-t-md ring-2 ring-accent" : ""}`}
                    />
                    {/* Editing: eine richtige Zeile bekommt ein ✓ */}
                    {en?.editing && !final && (
                      <button
                        type="button"
                        onClick={() => {
                          setGaps((g) => g.map((x, j) => (j === i ? "✓" : x)));
                          setWrongGaps((w) => w.filter((n) => n !== i + 1));
                        }}
                        aria-label={`Zeile ${i + 1} ist richtig`}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border align-middle text-[17px] ${gaps[i] === "✓" ? "border-accent bg-accent text-on-fill" : "border-line-strong bg-surface hover:border-ink-3"}`}
                      >
                        ✓
                      </button>
                    )}
                  </>
                )}
              </span>
            ))}
          </p>
        ) : (
          <p className={`${reading || en ? "text-[19px] leading-snug" : "text-[21px] leading-snug"} font-medium whitespace-pre-line`} lang={en ? "en" : undefined}>
            {reading || en ? task.prompt : <MathText text={task.prompt} />}
          </p>
        )}
        {/* Aufgabe mit Bild: das Bild unter der Frage (bei Lücken ohne eigene Fragezeile darüber) */}
        {task.figur && !bildKopf && <FigurBild svg={task.figur} groesser={1.2} />}
        {task.quelle && <p className="mt-2 text-[12px] text-ink-3">Quelle: {task.quelle}</p>}
        {/* Umlaute für Lückentexte: eine Tablet-Tastatur gibt ä ö ü ß nicht immer her (components/UmlautBar.tsx) */}
        {task.blanks > 0 && !task.gapOptions && !final && !en && <UmlautBar target={umlaut} className="mt-3" />}
        {en?.maxWords && !final && (
          <p className={`mt-3 text-[14px] ${zuLang.length ? "font-semibold text-amber" : "text-ink-3"}`} aria-live="polite">
            {zuLang.length
              ? `Bei ${zuLang.join(" und ")} sind es mehr als ${en.maxWords} Wörter.`
              : `Höchstens ${en.maxWords} Wörter je Antwort.`}
          </p>
        )}
        {en?.editing && !final && <p className="mt-3 text-[14px] text-ink-3">Schreib das überflüssige Wort neben die Zeile. Ist die Zeile richtig, tippe auf ✓.</p>}

        {task.gapOptions && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {task.gapOptions.map((g, i) => (
              <fieldset key={i} className={`min-w-0 rounded-xl border px-3 pt-1 pb-3 ${wrongGaps.includes(i + 1) ? "border-red" : "border-line"}`}>
                <legend className="px-1 text-[15px] font-semibold text-ink-2">Lücke {kreisZahl(i + 1)}</legend>
                <div className="grid gap-2">
                  {g.map((o, j) => (
                    <label
                      key={j}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-[17px] transition-colors ${
                        gaps[i] === o ? "border-accent bg-accent-wash" : "border-line-strong hover:border-ink-3"
                      } ${final ? "cursor-default" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`luecke-${task.id}-${i}`}
                        className="mt-1.5 accent-[var(--accent)]"
                        checked={gaps[i] === o}
                        disabled={final}
                        onChange={() => {
                          setGaps((x) => x.map((v, k) => (k === i ? o : v)));
                          setWrongGaps((w) => w.filter((n) => n !== i + 1));
                        }}
                      />
                      <span className="min-w-0"><MathText text={o} /></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {task.options && mehrfach && (
          <div className="mt-6">
            <p className="flex flex-wrap justify-between gap-x-3 text-[14px] text-ink-2">
              <span>{task.pick === 2 ? "Genau zwei Antworten sind richtig." : `Genau ${task.pick} Antworten sind richtig.`}</span>
              <span className={`num ${picks.length > (task.pick ?? 0) ? "font-semibold text-amber" : "text-ink-3"}`} aria-live="polite">
                {picks.length} von {task.pick} angekreuzt
              </span>
            </p>
            <div className="mt-2 grid gap-2" role="group" aria-label="Antwortmöglichkeiten">
              {task.options.map((o, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-[17px] transition-colors ${
                    picks.includes(i) ? "border-accent bg-accent-wash" : "border-line-strong hover:border-ink-3"
                  } ${final ? "cursor-default" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1.5 size-4 shrink-0 accent-[var(--accent)]"
                    checked={picks.includes(i)}
                    disabled={final}
                    onChange={() => setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                  />
                  <span className="min-w-0"><MathText text={o} /></span>
                </label>
              ))}
            </div>
          </div>
        )}

        {task.zuordnung && richtigFalsch && (
          // True or False: je Aussage True oder False und die ersten Wörter des Satzes, der es zeigt
          <ol className="mt-6 grid gap-3" aria-label="Aussagen" lang="en">
            {task.zuordnung.statements.map((st, i) => (
              <li key={i} className={`rounded-xl border bg-surface px-4 py-3 ${wrongGaps.includes(i + 1) ? "border-red" : "border-line-strong"}`}>
                <p className="flex gap-2.5 text-[17px]">
                  <span className="num font-semibold text-ink-3">{i + 1}</span>
                  <span className="min-w-0">{st}</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label={`Aussage ${i + 1}: True oder False`}>
                  {task.zuordnung!.options.map((o, k) => (
                    <label
                      key={k}
                      className={`flex h-11 min-w-[88px] cursor-pointer items-center justify-center rounded-lg border px-4 text-[16px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                        pairs[i] === k ? "border-accent bg-accent text-on-fill" : "border-line-strong bg-surface hover:border-ink-3"
                      } ${final ? "cursor-default" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`zuordnung-${task.id}-${i}`}
                        className="sr-only"
                        checked={pairs[i] === k}
                        disabled={final}
                        onChange={() => {
                          setPairs((p) => p.map((x, j) => (j === i ? k : x)));
                          setWrongGaps((w) => w.filter((n) => n !== i + 1));
                        }}
                      />
                      {o}
                    </label>
                  ))}
                </div>
                <label className="mt-2.5 block">
                  <span className="text-[13px] font-semibold text-ink-2" lang="de">
                    Begründung: die ersten vier Wörter des Satzes
                  </span>
                  <input
                    className="input mt-1 text-[16px]"
                    value={belege[i] ?? ""}
                    disabled={final}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBelege((b) => b.map((x, j) => (j === i ? v : x)));
                      setWrongGaps((w) => w.filter((n) => n !== i + 1));
                    }}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </label>
              </li>
            ))}
          </ol>
        )}

        {task.zuordnung && fragen && (
          // Multiple Choice zum Text: je Frage vier Antworten A bis D
          <ol className="mt-6 grid gap-3" aria-label="Fragen" lang="en">
            {task.zuordnung.statements.map((st, i) => (
              <li key={i} className={`rounded-xl border bg-surface px-4 py-3 ${wrongGaps.includes(i + 1) ? "border-red" : "border-line-strong"}`}>
                <p className="flex gap-2.5 text-[17px] font-medium">
                  <span className="num font-semibold text-ink-3">{i + 1}</span>
                  <span className="min-w-0">{st}</span>
                </p>
                <div className="mt-2.5 grid gap-2" role="radiogroup" aria-label={`Antwort auf Frage ${i + 1}`}>
                  {(task.zuordnung!.choices?.[i] ?? []).map((o, k) => (
                    <label
                      key={k}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-[16px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                        pairs[i] === k ? "border-accent bg-accent-wash" : "border-line-strong bg-surface hover:border-ink-3"
                      } ${final ? "cursor-default" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`zuordnung-${task.id}-${i}`}
                        className="sr-only"
                        checked={pairs[i] === k}
                        disabled={final}
                        onChange={() => {
                          setPairs((p) => p.map((x, j) => (j === i ? k : x)));
                          setWrongGaps((w) => w.filter((n) => n !== i + 1));
                        }}
                      />
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[14px] font-semibold ${pairs[i] === k ? "bg-accent text-on-fill" : "bg-panel text-ink-2"}`}>{buchstabe(k)}</span>
                      <span className="min-w-0 pt-0.5">{o}</span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}

        {task.zuordnung && !richtigFalsch && !fragen && (
          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-start">
            <ol className="grid gap-3" aria-label="Aussagen" lang={en ? "en" : undefined}>
              {task.zuordnung.statements.map((st, i) => (
                <li key={i} className={`rounded-xl border bg-surface px-4 py-3 ${wrongGaps.includes(i + 1) ? "border-red" : "border-line-strong"}`}>
                  <p className="flex gap-2.5 text-[17px]">
                    <span className="num font-semibold text-ink-3">{i + 1}</span>
                    <span className="min-w-0">{en ? st : <MathText text={st} />}</span>
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label={`Buchstabe für Aussage ${i + 1}`}>
                    {task.zuordnung!.options.map((_, k) => (
                      <label
                        key={k}
                        className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border text-[17px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                          pairs[i] === k ? "border-accent bg-accent text-on-fill" : "border-line-strong bg-surface hover:border-ink-3"
                        } ${final ? "cursor-default" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`zuordnung-${task.id}-${i}`}
                          className="sr-only"
                          checked={pairs[i] === k}
                          disabled={final}
                          onChange={() => {
                            setPairs((p) => p.map((x, j) => (j === i ? k : x)));
                            setWrongGaps((w) => w.filter((n) => n !== i + 1));
                          }}
                        />
                        {buchstabe(k)}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            {/* am Handy stehen die Antworten über den Aussagen: erst lesen, dann zuordnen */}
            <ul className="grid gap-2 rounded-xl border border-line bg-panel px-4 py-3 max-md:order-first" aria-label={`Antworten A bis ${buchstabe(task.zuordnung.options.length - 1)}`} lang={en ? "en" : undefined}>
              {task.zuordnung.options.map((o, k) => (
                <li key={k} className="flex gap-3 text-[17px]">
                  <span className="w-5 shrink-0 font-semibold text-ink-2">{buchstabe(k)}</span>
                  <span className="min-w-0">{en ? o : <MathText text={o} />}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {task.options && !mehrfach && (
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
            {final && !test && feedback?.given && feedback.expected ? (
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
                  onFocus={(e) => void (umlaut.current = { el: e.currentTarget, set: (v) => setText(v) })}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                {!final && <UmlautBar target={umlaut} className="mt-2" />}
                {unchanged && !final && <p className="mt-1 text-[13px] text-ink-3">Verbessere die Fehler direkt im Text.</p>}
              </>
            )}
          </div>
        )}

        {m && math && (
          <MathAnswerInput
            task={m}
            taskId={task.id}
            value={math}
            onChange={setMath}
            disabled={final || pending}
            boardHref={via === "link" ? `/lernen/${token}/tafel` : via === "geraet" ? "/geraet/ansicht?zu=tafel" : null}
          />
        )}

        {task.type === "memorize" && task.passage && (
          <div className="mt-6">
            <label htmlFor={`mem-${task.id}`} className="text-[13px] font-semibold text-ink-2">
              Dein Text aus dem Gedächtnis
            </label>
            <textarea
              id={`mem-${task.id}`}
              ref={(el) => void (inputRef.current = el)}
              className="input mt-1 text-[17px] leading-relaxed"
              rows={Math.min(16, Math.max(3, Math.ceil(task.passage.length / 55) + 1))}
              value={text}
              disabled={final}
              onChange={(e) => setText(e.target.value)}
              onFocus={(e) => void (umlaut.current = { el: e.currentTarget, set: (v) => setText(v) })}
              placeholder="Schreib den Text hier auf"
              aria-label="Dein Text aus dem Gedächtnis"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <p className="num mt-1 flex justify-between gap-3 text-[13px] text-ink-3">
              <span>{kept && !final ? "Entwurf auf diesem Gerät gespeichert" : ""}</span>
              <span aria-live="polite">{words(text) === 1 ? "1 Wort" : `${words(text)} Wörter`}</span>
            </p>
            {!final && <UmlautBar target={umlaut} className="mt-2" />}
          </div>
        )}

        {task.type !== "memorize" && !task.options && !task.zuordnung && !task.steps && task.blanks === 0 && task.faulty === null && !m &&
          ((task.type === "free" || task.type === "reading") && task.lines !== 1 ? (
            <div className="mt-6">
              <textarea
                ref={(el) => void (inputRef.current = el)}
                className="input text-[17px] leading-relaxed"
                rows={Math.min(16, Math.max(reading ? 4 : 5, task.lines ?? 6))}
                value={text}
                disabled={final}
                onChange={(e) => setText(e.target.value)}
                onFocus={(e) => void (umlaut.current = { el: e.currentTarget, set: (v) => setText(v) })}
                placeholder={en?.schreiben ? "Dein Text" : "Deine Antwort"}
                aria-label={en?.schreiben ? "Dein Text" : "Deine Antwort"}
                // Writing wie bei der Matura: ohne Rechtschreibprüfung
                lang={en ? "en" : undefined}
                spellCheck={en?.schreiben ? false : undefined}
              />
              <p className="num mt-1 flex justify-between gap-3 text-[13px] text-ink-3">
                <span>{(reading || en?.schreiben) && kept && !final ? "Entwurf auf diesem Gerät gespeichert" : ""}</span>
                {en?.schreiben ? (
                  <span aria-live="polite" className={words(text) > 0 && (words(text) < en.schreiben.min || words(text) > en.schreiben.max) ? "font-semibold text-amber" : ""}>
                    {words(text)} Wörter, verlangt {en.schreiben.min} bis {en.schreiben.max}
                  </span>
                ) : (
                  <span aria-live="polite">{words(text) === 1 ? "1 Wort" : `${words(text)} Wörter`}</span>
                )}
              </p>
              {!final && !en && <UmlautBar target={umlaut} className="mt-2" />}
            </div>
          ) : (
            <>
              <input
                ref={(el) => void (inputRef.current = el)}
                className="input mt-6 max-w-[360px] text-[19px] font-semibold"
                value={text}
                disabled={final}
                onChange={(e) => setText(e.target.value)}
                onFocus={(e) => void (umlaut.current = { el: e.currentTarget, set: (v) => setText(v) })}
                placeholder="Deine Antwort"
                autoComplete="off"
                inputMode={task.type === "calc" ? "text" : undefined}
                aria-label="Antwort"
                style={task.type === "free" ? { maxWidth: "100%" } : undefined}
              />
              {/* Umlaute nur bei Textantworten; eine Rechnung braucht sie nicht */}
              {!final && task.type !== "calc" && <UmlautBar target={umlaut} className="mt-2" />}
            </>
          ))}
        {task.type === "calc" && !task.options && task.blanks === 0 &&
          ((text.includes("/") && splitFractions(text).some((x) => typeof x !== "string")) || /\^\(?\d/.test(text) ? (
            <p className="mt-2 text-[17px] text-ink-2" aria-live="polite">
              <span className="text-[13px] text-ink-3">Deine Antwort: </span>
              <MathText text={text} />
            </p>
          ) : task.prompt.includes("^") ? (
            <p className="mt-2 text-[13px] text-ink-3">
              Hochzahlen schreibst du mit ^: x^5, das wird zu <MathText text="x^5" />.
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-3">
              Brüche schreibst du so: 3/4, das wird zu <MathText text="3/4" />. Kommazahlen mit Beistrich: 0,75.
            </p>
          ))}

        {hintsShown > 0 && (
          <ul className="mt-6 space-y-2">
            {task.hints.slice(0, hintsShown).map((h, i) => (
              <li key={i} className="flex gap-2 rounded-lg bg-amber-wash px-4 py-2.5 text-[15px] text-amber">
                <Lightbulb size={17} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  <span className="block text-[12.5px] font-semibold">{hintLabel(i)}</span>
                  <MathText text={h} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {feedback && !feedback.pending && !test && (
          <div
            role="status"
            className={`mt-6 flex gap-3 rounded-xl px-4 py-3 text-[16px] ${feedback.correct ? "bg-green-wash text-green" : feedback.partial ? "bg-amber-wash text-amber" : "bg-red-wash text-red"}`}
          >
            {feedback.correct ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden /> : <XCircle size={20} className="mt-0.5 shrink-0" aria-hidden />}
            <span className="font-medium"><MathText text={feedback.text} /></span>
          </div>
        )}

        {feedback?.pending && !test && (
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

        {final && feedback?.solution && !feedback.pending && !test && (
          <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-4">
            <p className="text-[14px] font-semibold text-ink-2">Lösungsweg</p>
            <p className="mt-1 text-[16px] whitespace-pre-line"><MathText text={feedback.solution} /></p>
            {task.genus && (
              <p className="mt-2">
                <GenusBadge genus={task.genus} />
              </p>
            )}
          </div>
        )}

        {task.released && !final && (
          <details className="mt-4 rounded-xl border border-line bg-surface px-5 py-3">
            <summary className="cursor-pointer text-[14px] font-semibold text-ink-2">Lösung ansehen (von deinem Lehrer gezeigt)</summary>
            {task.released.answer && <p className="mt-2 font-semibold"><MathText text={task.released.answer} /></p>}
            <p className="mt-1 text-[16px] whitespace-pre-line"><MathText text={task.released.solution} /></p>
            <ReleasedMore r={task.released} />
          </details>
        )}
        {task.released && final && hasMore(task.released) && (
          <details className="mt-4 rounded-xl border border-line bg-surface px-5 py-3">
            <summary className="cursor-pointer text-[14px] font-semibold text-ink-2">Schritt für Schritt (von deinem Lehrer gezeigt)</summary>
            <ReleasedMore r={task.released} />
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
                {pending ? (handIn ? "Wird gesendet …" : "Wird geprüft …") : handIn ? "Abgeben" : "Prüfen"}
              </button>
              {test && onSkip && (
                <button type="button" className="btn btn-ghost h-11" disabled={pending} onClick={onSkip}>
                  Später <ChevronRight size={16} aria-hidden />
                </button>
              )}
              {!test && hintsShown < task.hints.length && (
                <button type="button" className="btn btn-secondary h-11" onClick={openHint}>
                  <Lightbulb size={16} aria-hidden /> {hintLabel(hintsShown)}
                </button>
              )}
              {!test && (tries > 0 || hintsShown >= task.hints.length) && (
                <button type="button" className="btn btn-ghost h-11" disabled={pending} onClick={() => send({ giveUp: true })}>
                  Ich komme nicht weiter
                </button>
              )}
              {tries > 0 && !test && (
                <span className="num text-[14px] text-ink-3">
                  Versuch {tries + 1} von {maxTries}
                </span>
              )}
            </>
          )}
          {final && !test && (
            <button type="button" className="btn btn-primary h-11 px-6 text-[15px]" onClick={onNext} autoFocus>
              {isLast ? "Fertig" : reading ? "Nächste Frage" : "Nächste Aufgabe"} <ChevronRight size={17} aria-hidden />
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
 * difference to the total time. Exported so the Schnellrunde measures time the same way.
 */
export function useActiveTime() {
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

type Released = NonNullable<ClientTask["released"]>;
const hasMore = (r: Released) => Boolean(r.steps?.length || r.ways?.length || r.explanation || r.watch?.length);

/** Freigabe „Alles“: Schritte, andere Wege, worum es geht und worauf man achtet; nur was der Lehrer freigegeben hat. */
function ReleasedMore({ r }: { r: Released }) {
  if (!hasMore(r)) return null;
  const list = (title: string, items: string[], ordered = false) => {
    const Tag = ordered ? "ol" : "ul";
    return (
      <div className="mt-3">
        <p className="text-[14px] font-semibold text-ink-2">{title}</p>
        <Tag className={`mt-1 space-y-1 pl-5 text-[16px] ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((x, i) => (
            <li key={i}>
              <MathText text={x} />
            </li>
          ))}
        </Tag>
      </div>
    );
  };
  return (
    <>
      {r.steps?.length ? list("Schritt für Schritt", r.steps, true) : null}
      {r.ways?.length ? list(r.ways.length === 1 ? "Ein anderer Weg" : "Andere Wege", r.ways) : null}
      {r.explanation && (
        <div className="mt-3">
          <p className="text-[14px] font-semibold text-ink-2">Worum es geht</p>
          <p className="mt-1 text-[16px]">
            <MathText text={r.explanation} />
          </p>
        </div>
      )}
      {r.watch?.length ? list("Darauf achten", r.watch) : null}
    </>
  );
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
