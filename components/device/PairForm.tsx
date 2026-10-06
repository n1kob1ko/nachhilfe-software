"use client";

import { useActionState } from "react";
import { pairDeviceAction, type PairState } from "@/app/device-actions";

export function PairForm() {
  const [state, action, pending] = useActionState<PairState, FormData>(pairDeviceAction, null);
  return (
    <form action={action} className="grid gap-4">
      <label className="field">
        <span className="label">Verbindungscode</span>
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
        />
      </label>
      {state?.error && (
        <p className="text-[14px] text-red" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Wird verbunden …" : "Tablet verbinden"}
      </button>
    </form>
  );
}
