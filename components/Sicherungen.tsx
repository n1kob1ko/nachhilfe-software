"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { backupNowAction, stageRestoreAction } from "@/app/sicherung-actions";
import type { FormState } from "@/app/session-actions";

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-[14px] ${state.error ? "bg-red-wash text-red" : "bg-green-wash text-green"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

function Submit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? "Einen Moment …" : children}
    </button>
  );
}

export function BackupNowForm() {
  const [state, action] = useActionState(backupNowAction, null);
  return (
    <form action={action} className="grid justify-items-start gap-2">
      <Submit className="btn btn-primary">Jetzt sichern</Submit>
      <Message state={state} />
    </form>
  );
}

export function StageRestoreForm({ name }: { name: string }) {
  const [state, action] = useActionState(stageRestoreAction.bind(null, name), null);
  return (
    <form action={action} className="grid justify-items-start gap-2">
      <Submit className="btn btn-secondary btn-sm">Diese Sicherung wiederherstellen</Submit>
      <Message state={state} />
    </form>
  );
}
