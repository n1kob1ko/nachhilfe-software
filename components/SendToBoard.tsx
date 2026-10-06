"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Presentation } from "lucide-react";
import { sendToBoardAction, type SendState } from "@/app/whiteboard-actions";

type Props = {
  worksheetId: number;
  tasks: { id: number; label: string }[];
  units: { unit_id: number; student_name: string }[];
};

/** "Auf Whiteboard senden" on an exercise: the tasks appear on the board as text the student can write under. */
export function SendToBoard({ worksheetId, tasks, units }: Props) {
  const [state, action, busy] = useActionState<SendState, FormData>(sendToBoardAction, null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [unitId, setUnitId] = useState(units[0]?.unit_id ?? 0);

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
        <select className="input" name="unit_id" value={unitId} onChange={(e) => setUnitId(Number(e.target.value))} aria-label="Whiteboard von">
          {units.map((u) => (
            <option key={u.unit_id} value={u.unit_id}>
              Whiteboard von {u.student_name}
            </option>
          ))}
        </select>
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
      <button className="btn btn-primary" disabled={busy}>
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
