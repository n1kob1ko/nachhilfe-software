"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Presentation } from "lucide-react";
import { sendToBoardAction, type SendState } from "@/app/whiteboard-actions";
import { shortNames } from "@/lib/vornamen";

type Props = {
  worksheetId: number;
  tasks: { id: number; label: string }[];
  units: { unit_id: number; student_name: string }[];
  /** the board of the exercise's student, when their unit runs; else nothing is preselected while two run */
  defaultUnitId?: number | null;
};

/**
 * "Auf Whiteboard senden" on an exercise: the tasks appear on the board as text the student can write under.
 * With two units at once (D26) both boards are offered as two buttons; the exercise's student is preselected,
 * never simply the first unit started.
 */
export function SendToBoard({ worksheetId, tasks, units, defaultUnitId }: Props) {
  const [state, action, busy] = useActionState<SendState, FormData>(sendToBoardAction, null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [unitId, setUnitId] = useState(units.find((u) => u.unit_id === defaultUnitId)?.unit_id ?? (units.length === 1 ? units[0].unit_id : 0));
  const names = shortNames(units.map((u) => u.student_name));

  if (units.length === 0) {
    return (
      <div className="panel grid gap-2 px-4 py-4">
        <span className="label">Auf Whiteboard senden</span>
        <p className="text-[13px] text-ink-3">Nur während einer laufenden Einheit.</p>
      </div>
    );
  }
  const toggle = (id: number) => setPicked((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  return (
    <form action={action} className="panel grid gap-3 px-4 py-4" aria-label="Auf Whiteboard senden">
      <input type="hidden" name="worksheet_id" value={worksheetId} />
      <span className="label flex items-center gap-1.5">
        <Presentation size={14} aria-hidden /> Auf Whiteboard senden
      </span>
      {units.length > 1 ? (
        <fieldset className="grid gap-1.5">
          <legend className="sr-only">Auf welches Whiteboard?</legend>
          <div className="flex flex-wrap gap-2">
            {units.map((u, i) => (
              <label
                key={u.unit_id}
                className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent"
              >
                <input type="radio" name="unit_id" value={u.unit_id} checked={unitId === u.unit_id} onChange={() => setUnitId(u.unit_id)} required className="accent-[var(--accent)]" />
                Whiteboard von {names[i]}
              </label>
            ))}
          </div>
          {!unitId && <p className="text-[13px] text-ink-2">Gerade laufen zwei Einheiten. Wähle das Whiteboard.</p>}
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="unit_id" value={unitId} />
          <p className="text-[13px] text-ink-2">Aufs Whiteboard von {units[0].student_name}</p>
        </>
      )}
      <fieldset className="grid max-h-[260px] gap-1 overflow-y-auto">
        <legend className="sr-only">Aufgaben</legend>
        {tasks.map((t, i) => (
          <label key={t.id} className="flex items-start gap-2 rounded-md px-1 py-1 text-[13px] hover:bg-paper">
            <input type="checkbox" name="task_id" value={t.id} className="mt-0.5 h-4 w-4 shrink-0" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
            <span className="min-w-0">
              <span className="num font-semibold">{i + 1}.</span> <span className="line-clamp-2">{t.label}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <button className="btn btn-primary" disabled={busy || !unitId}>
        {picked.size ? `${picked.size} ${picked.size === 1 ? "Aufgabe" : "Aufgaben"} senden` : `Alle ${tasks.length} Aufgaben senden`}
      </button>
      {state?.ok && (
        <p className="text-[13px] text-green" role="status">
          {state.ok}{" "}
          <Link href={`/tafel/${unitId}`} className="font-medium underline">
            Whiteboard öffnen
          </Link>
        </p>
      )}
      {state?.error && (
        <p className="text-[13px] text-red" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * "Aufs Whiteboard" next to „An Max senden“ while a unit runs: all tasks at once onto the student's board, where
 * maths is written with the pen and the teacher grades each task (docs/mathe-whiteboard.md).
 */
export function BoardSendButton({ worksheetId, unitId, student, small }: { worksheetId: number; unitId: number; /** with two units at once: „Whiteboard von Anna“ */ student?: string; small?: boolean }) {
  const [state, action, busy] = useActionState<SendState, FormData>(sendToBoardAction, null);
  // `contents`: der Knopf steht in der Zeile der anderen Sende-Knöpfe, die Rückmeldung bricht als eigene Zeile
  // über die ganze Breite um, statt eingerückt unter dem Knopf zu hängen
  return (
    <form action={action} className="contents">
      <input type="hidden" name="worksheet_id" value={worksheetId} />
      <input type="hidden" name="unit_id" value={unitId} />
      <button className={`btn btn-secondary w-fit ${small ? "" : "btn-lg"}`} disabled={busy} title="Alle Aufgaben aufs Whiteboard: der Schüler rechnet mit dem Stift, du bewertest jede Aufgabe dort">
        <Presentation size={small ? 15 : 18} aria-hidden /> {busy ? "Wird gesendet …" : student ? `Whiteboard von ${student}` : "Aufs Whiteboard"}
      </button>
      {state?.ok && (
        <p className="basis-full text-[14px] text-green" role="status">
          {state.ok}{" "}
          <Link href={`/tafel/${unitId}`} className="font-medium underline">
            Whiteboard öffnen
          </Link>
        </p>
      )}
      {state?.error && (
        <p className="basis-full text-[14px] text-red" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
