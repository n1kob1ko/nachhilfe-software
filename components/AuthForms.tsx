"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction, createTeacherAction, loginAction, resetTeacherPasswordAction, type FormState } from "@/app/session-actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Einen Moment …" : children}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-[14px] ${state.error ? "bg-red-wash text-red" : "bg-green-wash text-green"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="weiter" value={next ?? "/"} />
      <label className="field">
        <span className="label">Benutzername</span>
        <input key={state?.values?.username} className="input" name="username" autoComplete="username" autoCapitalize="none" required autoFocus={!state?.values?.username} defaultValue={state?.values?.username} />
      </label>
      <label className="field">
        <span className="label">Passwort</span>
        <input key={state ? "retry" : "first"} className="input" name="password" type="password" autoComplete="current-password" required autoFocus={!!state?.values?.username} />
      </label>
      <Message state={state} />
      <Submit>Anmelden</Submit>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="grid gap-4">
      <label className="field">
        <span className="label">Bisheriges Passwort</span>
        <input className="input" name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        <span className="label">Neues Passwort</span>
        <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="text-[12px] text-ink-3">Mindestens 8 Zeichen.</span>
      </label>
      <label className="field">
        <span className="label">Neues Passwort wiederholen</span>
        <input className="input" name="repeat" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <Message state={state} />
      <Submit>Passwort speichern</Submit>
    </form>
  );
}

export function NewTeacherForm() {
  const [state, action] = useActionState(createTeacherAction, null);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span className="label">Name</span>
          <input className="input" name="name" required placeholder="z. B. Lisa" />
        </label>
        <label className="field">
          <span className="label">Benutzername (optional)</span>
          <input className="input" name="username" autoCapitalize="none" placeholder="wird aus dem Namen gebildet" />
        </label>
      </div>
      <Message state={state} />
      <div>
        <Submit>Lehrer anlegen</Submit>
      </div>
    </form>
  );
}

/** Gives a colleague a new one-time start password; it is shown once, right here. */
export function ResetPasswordForm({ teacherId }: { teacherId: number }) {
  const [state, action] = useActionState(resetTeacherPasswordAction.bind(null, teacherId), null);
  return (
    // "contents": the button sits in the account row, the message spans the row below it
    <form action={action} className="contents">
      <ResetButton />
      {state && (
        <div className="order-last basis-full">
          <Message state={state} />
        </div>
      )}
    </form>
  );
}

function ResetButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-ghost btn-sm" disabled={pending}>
      Passwort zurücksetzen
    </button>
  );
}
