"use client";

import { Printer } from "lucide-react";

/**
 * Drucken über den Browser (ADR 0001) — kein PDF-Werkzeug.
 *
 * `vorDruck` darf den Ausdruck ablehnen: Es liefert `false`, wenn vorher noch etwas
 * zu klären ist (bei den Blattgeneratoren: eine Definition, die das Schema nicht
 * annimmt). Dann öffnet sich der Druckdialog nicht. Ohne die Eigenschaft verhält
 * sich der Knopf wie bisher.
 */
export function PrintButton({ vorDruck, label = "Drucken" }: { vorDruck?: () => boolean; label?: string }) {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => {
        if (vorDruck && !vorDruck()) return;
        window.print();
      }}
    >
      <Printer size={15} aria-hidden /> {label}
    </button>
  );
}
