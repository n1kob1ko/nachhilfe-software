"use client";

import { Trash2 } from "lucide-react";
import { deleteBillingEntryAction } from "@/app/actions";

/** Abrechnung: deletes one Einheit for good after asking (`deleteBillingEntry` in lib/billing.ts). */
export function BillingDelete({ id, wer, zurueck }: { id: number; wer: string; zurueck: string }) {
  return (
    <form
      action={deleteBillingEntryAction.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Einheit ${wer} ganz löschen? Sie verschwindet auch aus dem Lernverlauf. Das lässt sich nicht rückgängig machen.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="zurueck" value={zurueck} />
      <button className="btn btn-ghost btn-sm !px-2.5" aria-label={`Einheit ${wer} löschen`} title="Einheit löschen">
        <Trash2 size={15} aria-hidden />
      </button>
    </form>
  );
}
