"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { BudgetAntwort } from "@/app/(tutor)/mehr/ki-kosten/actions";

function Speichern() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-secondary" disabled={pending} data-testid="einheit-budget-speichern">
      {pending ? "Wird gespeichert …" : "Speichern"}
    </button>
  );
}

/** Mehr › KI-Kosten: „Automatisch je Einheit bis … €“, nur für die Administration (lib/ai/einheit-budget.ts). */
export function EinheitBudgetForm({ action, eur, max }: { action: (prev: BudgetAntwort, form: FormData) => Promise<BudgetAntwort>; eur: number; max: number }) {
  const [state, formAction] = useActionState<BudgetAntwort, FormData>(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label className="flex flex-wrap items-center gap-2 text-[15px]">
        Automatisch je Einheit bis
        <input
          name="eur"
          type="text"
          inputMode="decimal"
          defaultValue={eur.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          className="input num text-right"
          style={{ width: "6.5rem", minHeight: 44 }}
          aria-describedby="einheit-budget-hinweis"
          data-testid="einheit-budget-eingabe"
        />
        €
      </label>
      <Speichern />
      <p id="einheit-budget-hinweis" className="w-full text-[13px] text-ink-3">
        0 € = automatisch aus. Höchstens {max.toLocaleString("de-AT", { minimumFractionDigits: 2 })} €.
      </p>
      {state && (
        <p role={"ok" in state ? "status" : "alert"} className={`w-full text-[13.5px] ${"ok" in state ? "text-green" : "text-red"}`}>
          {"ok" in state ? (state.eur > 0 ? `Gespeichert: bis ${state.eur.toLocaleString("de-AT", { minimumFractionDigits: 2 })} € je Einheit.` : "Gespeichert: automatisch aus.") : state.error}
        </p>
      )}
    </form>
  );
}
