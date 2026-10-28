"use client";

import { useFormStatus } from "react-dom";
import { Printer } from "lucide-react";

function Knopf({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-secondary w-fit" disabled={pending} data-testid="schritt-drucken">
      <Printer size={16} aria-hidden /> {pending ? "Wird vorbereitet …" : label}
    </button>
  );
}

/**
 * „Drucken“ neben „Übung senden“ (lib/cockpit.ts `druckeImSchritt`): die Aktion ist an Einheit und Schritt gebunden, baut dieselbe
 * Übung ohne Zuweisung und öffnet die A4-Seite (Schüler- oder Lehrerfassung wie immer dort wählbar).
 */
export function DruckenKnopf({ action, label = "Drucken" }: { action: () => Promise<void>; label?: string }) {
  return (
    <form action={action}>
      <Knopf label={label} />
    </form>
  );
}
