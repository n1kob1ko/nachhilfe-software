"use client";

import { Trash2 } from "lucide-react";
import { deleteBillingEntryAction } from "@/app/actions";
import { WegForm } from "@/components/Meldung";

/**
 * Abrechnung: löscht eine Einheit ganz (`deleteBillingEntry` in lib/billing.ts). Die Zeile verschwindet sofort, unten
 * steht sechs Sekunden „Rückgängig“; erst danach wird gelöscht (components/Meldung.tsx). Die Zeilen der Einheit tragen
 * `data-zeile="einheit-<id>"` (Liste am Handy und Tabelle).
 */
export function BillingDelete({ id, wer, kurz }: { id: number; wer: string; kurz: string }) {
  return (
    <WegForm action={() => deleteBillingEntryAction(id)} zeile={`einheit-${id}`} text={`Einheit ${kurz} gelöscht`}>
      <button className="btn btn-ghost btn-sm !px-2.5" aria-label={`Einheit ${wer} löschen`} title="Einheit löschen">
        <Trash2 size={15} aria-hidden />
      </button>
    </WegForm>
  );
}
