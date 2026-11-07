"use client";

import { useState } from "react";
import { Square } from "lucide-react";

/**
 * „Einheit beenden“ mit einer Rückfrage (Audit 2026-11-07: ein Tipp zu viel beendete die Einheit endgültig). Erster Tipp
 * zeigt „Einheit mit Max beenden?“ mit „Ja, beenden“ und „Noch nicht“; erst „Ja, beenden“ ruft die Server Action.
 * Danach kann die Lehrkraft auf dem Abschluss noch FORTSETZEN_MINUTEN lang „Einheit fortsetzen“ (lib/units.ts).
 */
export function EinheitBeenden({ action, name, className }: { action: () => Promise<void>; name: string; className?: string }) {
  const [frage, setFrage] = useState(false);
  if (!frage) {
    return (
      <button type="button" className={className} onClick={() => setFrage(true)} data-testid="einheit-beenden">
        <Square size={17} aria-hidden /> Einheit beenden
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-wash px-3 py-2" role="group" aria-label="Einheit beenden?" data-testid="einheit-beenden-frage">
      <span className="text-[15px] font-semibold">Einheit mit {name} beenden?</span>
      <button className="btn btn-primary">Ja, beenden</button>
      <button type="button" className="btn btn-ghost" onClick={() => setFrage(false)} autoFocus>
        Noch nicht
      </button>
    </form>
  );
}
