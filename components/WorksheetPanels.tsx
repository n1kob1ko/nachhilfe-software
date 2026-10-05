"use client";

import { BookmarkPlus, Send } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { releaseAction, saveTemplateAction, type ActionResult } from "@/app/builder-actions";

type Student = { id: number; name: string };

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
export function ReleasePanel({ worksheetId, students, defaultStudentId, taskCount }: { worksheetId: number; students: Student[]; defaultStudentId: number | null; taskCount: number }) {
  const [state, action] = useActionState<ActionResult, FormData>(releaseAction, null);
  const name = students.find((s) => s.id === defaultStudentId)?.name.split(" ")[0];
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="worksheet_id" value={worksheetId} />
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
      <p className="text-[13px] text-ink-2">{taskCount} Aufgaben. Die Lösungen bleiben verborgen, bis du sie zeigst.</p>
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
