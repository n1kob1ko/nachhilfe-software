"use client";

import { useActionState } from "react";
import { joinLaptopAction, type JoinState } from "@/app/laptop-actions";

/** The six-digit Zugangscode from the teacher's screen. It is sent in the form body, never in the address. */
export function JoinForm() {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinLaptopAction, null);
  return (
    <form action={action} className="grid gap-4">
      <label className="field">
        <span className="label">Zugangscode</span>
        <input
          className="input num !h-16 text-center !text-[32px] tracking-[0.3em]"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
          placeholder="000000"
          data-testid="join-code"
        />
      </label>
      {state?.error && (
        <p className="text-[14px] text-red" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Wird verbunden …" : "Verbinden"}
      </button>
    </form>
  );
}
