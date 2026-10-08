"use client";

import { Check, CornerDownRight, HelpCircle, Plus, Presentation, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { MathAnswer, PartStatus, PartView, ValueVerdict } from "@/lib/math-check";
import type { MathView, StepView } from "@/lib/math-task";
import { MathText } from "./MathText";

/**
 * The student's side of the two maths formats: a Rechenweg line by line plus a separate Ergebnis,
 * and Sachaufgaben with one answer per part. Plain typing ("3/4", "x^2", "sqrt(2)") with a bar for the
 * signs a tablet keyboard hides; each line shows how the app reads it. The checks are on the server
 * (lib/math-task.ts); here only what the student typed and the marks that came back.
 */

/** What the student sees of a maths task (never the result). */
export type MathTaskView = {
  /** The equation or term to work on, shown above the lines. */
  start: string | null;
  /** The unknown of an equation ("x"): the Ergebnis field reads "x = …". */
  unknown: string | null;
  /** The task asks for the working, not only the result. */
  needWay: boolean;
  /** Sachaufgabe: the parts a), b), c). */
  parts: PartView[] | null;
  /** A unit is running: the student can do the working on the whiteboard instead. */
  board: boolean;
};

type Line = { id: number; text: string; mark?: StepView };
type Part = { lines: Line[]; result: string; text: string; check?: { status: PartStatus; feedback: string }; resultStatus?: ValueVerdict["status"] };
export type MathState = { lines: Line[]; result: string; board: boolean; resultStatus?: ValueVerdict["status"]; parts: Part[] };

let nextId = 1;
const line = (text = "", mark?: StepView): Line => ({ id: nextId++, text, mark });
const toLines = (texts: string[] | undefined, marks?: StepView[]) => {
  const list = (texts ?? []).map((t, i) => line(t, marks?.[i]));
  return list.length ? list : [line()];
};

export function initialMath(m: MathTaskView): MathState {
  return { lines: [line()], result: "", board: false, parts: (m.parts ?? []).map(() => ({ lines: [line()], result: "", text: "" })) };
}

/** Back from a draft on the device (what was typed but not sent yet). */
export function restoreMath(m: MathTaskView, d: MathAnswer): MathState {
  return {
    lines: toLines(d.steps),
    result: d.result ?? "",
    board: Boolean(d.board) && m.board,
    parts: (m.parts ?? []).map((_, i) => ({ lines: toLines(d.parts?.[i]?.steps), result: d.parts?.[i]?.result ?? "", text: d.parts?.[i]?.text ?? "" })),
  };
}

/** A finished task: the lines as they were checked. */
export function checkedMath(m: MathTaskView, v: MathView): MathState {
  return {
    lines: toLines(v.steps?.map((s) => s.line), v.steps),
    result: v.result?.fromWay ? "" : (v.result?.given ?? ""),
    board: false,
    resultStatus: v.result?.status,
    parts: (m.parts ?? []).map((p, i) => {
      const r = v.parts?.[i];
      return {
        lines: toLines(r?.steps?.map((s) => s.line), r?.steps),
        result: p.kind === "text" ? "" : (r?.given ?? ""),
        text: p.kind === "text" ? (r?.text ?? r?.given ?? "") : "",
        check: r ? { status: r.status, feedback: r.feedback } : undefined,
      };
    }),
  };
}

const filled = (lines: Line[]) => lines.map((l) => l.text.trim()).filter(Boolean);

/** What is sent and stored: the lines without empty ones, the Ergebnis, the parts. */
export function mathAnswer(m: MathTaskView, s: MathState): MathAnswer {
  if (m.parts) return { parts: s.parts.map((p, i) => (m.parts![i].kind === "text" ? { text: p.text.trim() } : { steps: filled(p.lines), result: p.result.trim() })) };
  return { steps: filled(s.lines), result: s.result.trim(), ...(s.board ? { board: true } : {}) };
}

export function mathTouched(s: MathState) {
  return s.board || s.result.trim() !== "" || filled(s.lines).length > 0 || s.parts.some((p) => p.text.trim() || p.result.trim() || filled(p.lines).length);
}

/** Enough to send: a Rechenweg needs the working (or the whiteboard) and something to check; a Sachaufgabe one answered part. */
export function mathReady(m: MathTaskView, s: MathState) {
  if (m.parts) return s.parts.some((p, i) => (m.parts![i].kind === "text" ? p.text.trim() : p.result.trim() || filled(p.lines).length));
  const way = filled(s.lines).length > 0;
  return (way || s.result.trim() !== "") && (!m.needWay || way || s.board);
}

/** The marks of a check on the lines that were sent (the server reads them without the empty ones). */
export function markMath(m: MathTaskView, s: MathState, v: MathView | undefined): MathState {
  if (!v) return s;
  const marked = (lines: Line[], marks?: StepView[]) => {
    const kept = lines.filter((l) => l.text.trim());
    return kept.length ? kept.map((l, i) => ({ ...l, mark: marks?.[i] })) : [line()];
  };
  return {
    ...s,
    lines: marked(s.lines, v.steps),
    resultStatus: v.result && !v.result.fromWay ? v.result.status : undefined,
    parts: s.parts.map((p, i) => {
      const r = v.parts?.[i];
      return { ...p, lines: marked(p.lines, r?.steps), check: r ? { status: r.status, feedback: r.feedback } : undefined };
    }),
  };
}

// ---------- typing: one field at a time gets the signs from the bar ----------
type Target = { el: HTMLInputElement | HTMLTextAreaElement; set: (v: string) => void };

/** The signs a tablet keyboard hides; inserted where the cursor is. The cursor goes before `after`. */
const SIGNS: { label: ReactNode; insert: string; after?: string; name: string }[] = [
  { label: <MathText text="a/b" />, insert: "/", name: "Bruchstrich" },
  { label: "x²", insert: "²", name: "hoch 2" },
  { label: <MathText text="x^n" />, insert: "^", name: "hoch" },
  { label: "√", insert: "√(", after: ")", name: "Wurzel" },
  { label: "·", insert: " · ", name: "mal" },
  { label: ":", insert: " : ", name: "geteilt" },
  { label: "−", insert: " − ", name: "minus" },
  { label: "=", insert: " = ", name: "ist gleich" },
  { label: "(", insert: "(", name: "Klammer auf" },
  { label: ")", insert: ")", name: "Klammer zu" },
  { label: "%", insert: " %", name: "Prozent" },
];

function SignBar({ target, unknown }: { target: React.RefObject<Target | null>; unknown: string | null }) {
  const put = (insert: string, after = "") => {
    const t = target.current;
    if (!t || t.el.disabled) return;
    const v = t.el.value;
    const from = t.el.selectionStart ?? v.length;
    const to = t.el.selectionEnd ?? v.length;
    // no double spaces around a sign
    let ins = insert;
    if (v.slice(0, from).endsWith(" ")) ins = ins.replace(/^ /, "");
    if (v.slice(to).startsWith(" ")) ins = ins.replace(/ $/, "");
    const next = v.slice(0, from) + ins + after + v.slice(to);
    t.set(next);
    const caret = from + ins.length;
    requestAnimationFrame(() => {
      t.el.focus();
      t.el.setSelectionRange(caret, caret);
    });
  };
  const signs = unknown ? [{ label: unknown, insert: unknown, name: unknown }, ...SIGNS] : SIGNS;
  return (
    <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Rechenzeichen">
      {signs.map((s) => (
        <button
          key={s.name}
          type="button"
          // keeps the cursor (and the tablet keyboard) in the field
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => put(s.insert, s.after)}
          className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-2.5 text-[18px] font-semibold text-ink hover:border-accent hover:text-accent"
          aria-label={s.name}
          title={s.name}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** Shown under a line when the app types it differently than it was typed (fractions, powers, roots). */
const typeset = (s: string) => /[/^²³√*]|sqrt|wurzel/i.test(s);

function Mark({ mark }: { mark?: StepView }) {
  if (!mark || mark.status === "notiz") return null;
  if (mark.status === "ok")
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-wash text-green" title="Stimmt">
        <Check size={16} aria-label="stimmt" />
      </span>
    );
  if (mark.status === "folge")
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-wash text-amber" title={mark.note}>
        <CornerDownRight size={15} aria-label="mit dem Fehler davor richtig weitergerechnet" />
      </span>
    );
  if (mark.status === "fehler")
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-wash text-red" title="Hier passt etwas nicht">
        <X size={16} aria-label="hier passt etwas nicht" />
      </span>
    );
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel text-ink-3" title={mark.note ?? "Kann die App nicht sicher prüfen"}>
      <HelpCircle size={16} aria-label="nicht sicher prüfbar" />
    </span>
  );
}

function WayLines({
  lines,
  onChange,
  disabled,
  target,
  label,
  first,
}: {
  lines: Line[];
  onChange: (lines: Line[]) => void;
  disabled: boolean;
  target: React.RefObject<Target | null>;
  label: string;
  /** Placeholder of the first line. */
  first: string;
}) {
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const [focus, setFocus] = useState<{ id: number; at?: number } | null>(null);
  useEffect(() => {
    if (!focus) return;
    const el = inputs.current.get(focus.id);
    if (!el) return;
    el.focus();
    const at = focus.at ?? el.value.length;
    el.setSelectionRange(at, at);
    setFocus(null);
  }, [focus]);

  const set = (id: number, text: string) => onChange(lines.map((l) => (l.id === id ? { id: l.id, text } : l)));
  const add = (after: number) => {
    const n = line();
    const i = lines.findIndex((l) => l.id === after);
    onChange([...lines.slice(0, i + 1), n, ...lines.slice(i + 1)].slice(0, 30));
    setFocus({ id: n.id });
  };
  const remove = (id: number) => {
    const i = lines.findIndex((l) => l.id === id);
    const rest = lines.filter((l) => l.id !== id);
    onChange(rest.length ? rest : [line()]);
    const prev = rest[Math.max(0, i - 1)];
    if (prev) setFocus({ id: prev.id });
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>, l: Line) => {
    if (e.key === "Enter") {
      // a new line instead of sending the form
      e.preventDefault();
      add(l.id);
    } else if (e.key === "Backspace" && l.text === "" && lines.length > 1) {
      e.preventDefault();
      remove(l.id);
    }
  };

  return (
    <ol className="squared rounded-xl border border-line-strong px-2 py-2 sm:px-3" aria-label={label}>
      {lines.map((l, i) => {
        const wrong = l.mark?.status === "fehler";
        return (
          <li key={l.id} className="py-1">
            <div className="flex items-center gap-2">
              <span className="num w-6 shrink-0 text-right text-[13px] font-semibold text-ink-3" aria-hidden>
                {i + 1}
              </span>
              <input
                ref={(el) => {
                  if (el) inputs.current.set(l.id, el);
                  else inputs.current.delete(l.id);
                }}
                value={l.text}
                disabled={disabled}
                onChange={(e) => set(l.id, e.target.value)}
                onFocus={(e) => void (target.current = { el: e.currentTarget, set: (v) => set(l.id, v) })}
                onKeyDown={(e) => keys(e, l)}
                placeholder={i === 0 ? first : ""}
                aria-label={`Zeile ${i + 1}`}
                aria-invalid={wrong || undefined}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className={`min-h-[46px] min-w-0 flex-1 rounded-lg border bg-surface/90 px-3 text-[19px] font-medium outline-none disabled:opacity-80 ${
                  wrong ? "border-red bg-red-wash/60" : "border-line focus:border-accent"
                }`}
              />
              <span className="flex w-7 shrink-0 justify-center">
                <Mark mark={l.mark} />
              </span>
              {!disabled && (
                <button
                  type="button"
                  className="btn btn-ghost h-11 w-11 shrink-0 px-0 text-ink-3"
                  onClick={() => remove(l.id)}
                  disabled={lines.length === 1 && !l.text}
                  aria-label={`Zeile ${i + 1} löschen`}
                >
                  <Trash2 size={17} aria-hidden />
                </button>
              )}
            </div>
            {(typeset(l.text) || (l.mark?.status === "unklar" && l.mark.note)) && (
              <p className="mt-0.5 ml-8 text-[16px] text-ink-2">
                {typeset(l.text) && <MathText text={l.text} />}
                {l.mark?.status === "unklar" && l.mark.note && <span className="ml-2 text-[13px] text-ink-3">{l.mark.note}</span>}
              </p>
            )}
          </li>
        );
      })}
      {!disabled && (
        <li className="pt-1 pl-8">
          <button type="button" className="btn btn-ghost h-11 text-[15px]" onClick={() => add(lines[lines.length - 1].id)} disabled={lines.length >= 30}>
            <Plus size={17} aria-hidden /> Zeile
          </button>
        </li>
      )}
    </ol>
  );
}

const RESULT_TONE: Record<string, string> = { richtig: "border-green bg-green-wash/60", teilweise: "border-amber bg-amber-wash/60", falsch: "border-red bg-red-wash/60" };

function ResultField({
  value,
  onChange,
  disabled,
  target,
  prefix,
  status,
  id,
  label = "Ergebnis",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  target: React.RefObject<Target | null>;
  prefix: string | null;
  status?: string;
  id: string;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label htmlFor={id} className="text-[15px] font-semibold text-ink-2">
        {label}
      </label>
      <span className="flex items-center gap-2">
        {prefix && <span className="text-[19px] font-semibold">{prefix} =</span>}
        <input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => void (target.current = { el: e.currentTarget, set: onChange })}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={`input min-h-[46px] w-[min(260px,60vw)] text-[19px] font-semibold disabled:opacity-80 ${status ? (RESULT_TONE[status] ?? "") : ""}`}
        />
      </span>
      {typeset(value) && (
        <span className="text-[17px] text-ink-2">
          <MathText text={prefix ? `${prefix} = ${value}` : value} />
        </span>
      )}
    </div>
  );
}

const PART_TONE: Record<PartStatus, string> = { richtig: "bg-green-wash text-green", folge: "bg-green-wash text-green", teilweise: "bg-amber-wash text-amber", falsch: "bg-red-wash text-red", offen: "bg-accent-wash text-ink" };
const PART_WORD: Record<PartStatus, string> = { richtig: "Richtig", folge: "Richtig weitergerechnet", teilweise: "Teilweise richtig", falsch: "Noch nicht richtig", offen: "Bewertet deine Lehrerin bzw. dein Lehrer" };

export function MathAnswerInput({
  task,
  value,
  onChange,
  disabled,
  boardHref,
  taskId,
}: {
  task: MathTaskView;
  value: MathState;
  onChange: (s: MathState) => void;
  disabled: boolean;
  /** The whiteboard of the running unit; null when it is on another device (laptop). */
  boardHref: string | null;
  taskId: number;
}) {
  const target = useRef<Target | null>(null);
  const bar = !disabled && <SignBar target={target} unknown={task.unknown} />;

  if (task.parts) {
    const setPart = (i: number, p: Partial<Part>) => onChange({ ...value, parts: value.parts.map((x, j) => (j === i ? { ...x, ...p, check: undefined, resultStatus: undefined } : x)) });
    return (
      <div className="mt-6 space-y-5">
        {bar && <div className="sticky top-0 z-10 -mx-1 bg-paper/95 px-1 py-2 backdrop-blur">{bar}</div>}
        {task.parts.map((p, i) => {
          const part = value.parts[i];
          const name = p.label || `${String.fromCharCode(97 + i)})`;
          return (
            <section key={i} className="rounded-xl border border-line bg-surface px-4 py-4 sm:px-5" aria-label={`Teilaufgabe ${name}`}>
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <span className="text-[19px] font-semibold text-accent">{name}</span>
                <p className="min-w-0 flex-1 text-[18px] font-medium">
                  <MathText text={p.prompt} />
                </p>
                {part.check && <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${PART_TONE[part.check.status]}`}>{PART_WORD[part.check.status]}</span>}
              </div>
              {p.kind === "text" ? (
                <textarea
                  className="input mt-3 text-[17px] leading-relaxed"
                  rows={Math.min(8, Math.max(3, p.lines ?? 3))}
                  value={part.text}
                  disabled={disabled}
                  onChange={(e) => setPart(i, { text: e.target.value })}
                  placeholder="Deine Antwort in Worten"
                  aria-label={`Antwort zu ${name}`}
                />
              ) : (
                <div className="mt-3 space-y-3">
                  <WayLines lines={part.lines} onChange={(lines) => setPart(i, { lines })} disabled={disabled} target={target} label={`Rechnung zu ${name}`} first="Deine Rechnung" />
                  <ResultField id={`r-${taskId}-${i}`} label="Antwort" value={part.result} onChange={(result) => setPart(i, { result })} disabled={disabled} target={target} prefix={null} status={part.check ? partTone(part.check.status) : undefined} />
                </div>
              )}
              {part.check && part.check.status !== "richtig" && <p className="mt-2 text-[15px] text-ink-2">{part.check.feedback}</p>}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {task.start && (
        <p className="text-[24px] font-semibold tracking-[-0.01em]">
          <MathText text={task.start} />
        </p>
      )}
      {bar}
      <WayLines
        lines={value.lines}
        onChange={(lines) => onChange({ ...value, lines, resultStatus: undefined })}
        disabled={disabled}
        target={target}
        label="Dein Rechenweg"
        first={task.start ? `z. B. ${task.start}` : "Deine erste Rechnung"}
      />
      <ResultField
        id={`r-${taskId}`}
        value={value.result}
        onChange={(result) => onChange({ ...value, result, resultStatus: undefined })}
        disabled={disabled}
        target={target}
        prefix={task.unknown}
        status={value.resultStatus}
      />
      {task.board && task.needWay && !disabled && (
        <label className="flex min-h-[44px] w-fit cursor-pointer items-center gap-3 text-[15px] text-ink-2">
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={value.board} onChange={(e) => onChange({ ...value, board: e.target.checked })} />
          <span>
            Ich rechne am Whiteboard
            {boardHref ? (
              <>
                {" · "}
                <a href={boardHref} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                  <Presentation size={15} aria-hidden /> Whiteboard öffnen
                </a>
              </>
            ) : (
              " (am Tablet)"
            )}
          </span>
        </label>
      )}
      {!disabled && task.needWay && !value.board && <p className="text-[13px] text-ink-3">Schreib jeden Rechenschritt in eine eigene Zeile. Mit der Eingabetaste kommt eine neue Zeile.</p>}
    </div>
  );
}

const partTone = (s: PartStatus) => (s === "folge" ? "richtig" : s === "offen" ? undefined : s);
