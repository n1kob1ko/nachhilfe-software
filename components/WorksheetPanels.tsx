"use client";

import { BookmarkPlus, Send, Zap } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { releaseAction, saveTemplateAction, type ActionResult } from "@/app/builder-actions";

type Student = { id: number; name: string };

/**
 * Schnellrunde (lib/quick-round.ts): `eligible` kommt aus derselben Prüfung, die die Schülerseite
 * benutzt (`isQuickRound` über die fertigen Aufgaben), `wished` aus dem Builder-Haken. Ist die Übung
 * nicht geeignet, steht der Grund daneben und der Haken lässt sich nicht setzen.
 */
export type QuickRoundChoice = { eligible: boolean; reason: string | null; wished: boolean };

function Msg({ r }: { r: ActionResult }) {
  if (!r) return null;
  return (
    <p className={`text-[13px] ${r.error ? "text-red" : "text-green"}`} role={r.error ? "alert" : "status"}>
      {r.error ?? r.ok}
    </p>
  );
}

function Busy({ children, label }: { children: React.ReactNode; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-lg w-fit" disabled={pending}>
      {pending ? label : children}
    </button>
  );
}

/** Draft → sent: checks every task, then sends it to the student (into the running unit, if any). */
export function ReleasePanel({
  worksheetId,
  students,
  defaultStudentId,
  taskCount,
  quickRound,
}: {
  worksheetId: number;
  students: Student[];
  defaultStudentId: number | null;
  taskCount: number;
  quickRound: QuickRoundChoice;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(releaseAction, null);
  const name = students.find((s) => s.id === defaultStudentId)?.name.split(" ")[0];
  const [quick, setQuick] = useState(quickRound.eligible && quickRound.wished);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="worksheet_id" value={worksheetId} />
      {/* immer gesendet: „off“ heißt aus, auch wenn im Builder ein Haken stand */}
      <input type="hidden" name="quick_round" value={quick ? "on" : "off"} />
      {name ? (
        <>
          <input type="hidden" name="student_id" value={defaultStudentId!} />
          <Busy label="Wird gesendet …">
            <Send size={18} aria-hidden /> An {name} senden
          </Busy>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="field min-w-[220px]">
            <span className="label">An wen senden?</span>
            <select className="input" name="student_id" defaultValue="" required>
              <option value="" disabled>
                Schüler wählen
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Busy label="Wird gesendet …">
            <Send size={18} aria-hidden /> Senden
          </Busy>
        </div>
      )}
      <p className="text-[13px] text-ink-2">{taskCount} Aufgaben · Lösungen bleiben verborgen</p>
      <div className="grid gap-1">
        <label className={`flex min-h-[44px] items-center gap-2 text-[14px] ${quickRound.eligible ? "cursor-pointer" : "text-ink-3"}`}>
          <input type="checkbox" checked={quick} disabled={!quickRound.eligible} onChange={(e) => setQuick(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          <Zap size={15} className={quick ? "text-accent" : ""} aria-hidden />
          Als Schnellrunde senden
        </label>
        <p className="text-[12.5px] text-ink-3">
          {quickRound.eligible
            ? "Ein Tipp pro Aufgabe, kurze Rückmeldung, automatisch weiter. Versuche, Zeit und Hilfen werden wie sonst gespeichert."
            : quickRound.reason ?? "Diese Übung passt nicht in eine Schnellrunde."}
        </p>
      </div>
      <Msg r={state} />
    </form>
  );
}

export function SaveTemplatePanel({ worksheetId, suggestion }: { worksheetId: number; suggestion: string }) {
  const [state, action] = useActionState<ActionResult, FormData>(saveTemplateAction, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="worksheet_id" value={worksheetId} />
      <label className="field">
        <span className="label flex items-center gap-1.5">
          <BookmarkPlus size={14} aria-hidden /> Als Vorlage speichern
        </span>
        <input className="input" name="name" defaultValue={suggestion} required />
      </label>
      <label className="flex items-center gap-2 text-[13px] text-ink-2">
        <input type="checkbox" name="with_tasks" defaultChecked className="accent-[var(--accent)]" />
        Diese Aufgaben übernehmen (sonst jedes Mal neu erstellen)
      </label>
      <button className="btn btn-secondary btn-sm justify-self-start">Vorlage speichern</button>
      <Msg r={state} />
    </form>
  );
}
