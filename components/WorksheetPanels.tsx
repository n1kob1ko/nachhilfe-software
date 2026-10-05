"use client";

import { BookmarkPlus, CheckCircle2 } from "lucide-react";
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
    <button className="btn btn-primary" disabled={pending}>
      {pending ? label : children}
    </button>
  );
}

/** Draft → released: checks every task, then sends it to the student (with the running unit, if any). */
export function ReleasePanel({ worksheetId, students, defaultStudentId, taskCount }: { worksheetId: number; students: Student[]; defaultStudentId: number | null; taskCount: number }) {
  const [state, action] = useActionState<ActionResult, FormData>(releaseAction, null);
  const name = students.find((s) => s.id === defaultStudentId)?.name.split(" ")[0];
  return (
    <form action={action} className="panel grid gap-3 border-accent px-4 py-4" style={{ borderColor: "var(--accent)" }}>
      <input type="hidden" name="worksheet_id" value={worksheetId} />
      <span className="label flex items-center gap-1.5">
        <CheckCircle2 size={14} aria-hidden /> Entwurf freigeben
      </span>
      <p className="text-[13px] text-ink-2">Der Schüler sieht die Übung erst nach der Freigabe. Lösungen bleiben für ihn verborgen, bis du sie freigibst.</p>
      <label className="field">
        <span className="label">Senden an</span>
        <select className="input" name="student_id" defaultValue={defaultStudentId ?? ""}>
          <option value="">Nur freigeben, niemandem senden</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Busy label="Wird geprüft …">{name ? `Freigeben und an ${name} senden` : `${taskCount} Aufgaben freigeben`}</Busy>
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
