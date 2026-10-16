"use client";

import { useState, useTransition } from "react";
import { setManualModeAction } from "@/app/(tutor)/mehr/ki-kosten/actions";

/**
 * Der Schalter für den manuellen KI-Modus auf Mehr › KI-Kosten.
 *
 * Er schreibt `ki_modus` in `app_settings` (lib/ai/modus.ts). `AI_PROVIDER=manual` bzw.
 * `AI_<AREA>_PROVIDER=manual` in den Umgebungsvariablen hat weiter Vorrang; das steht daneben.
 */
export function KiModusSchalter({ manuell }: { manuell: boolean }) {
  const [wert, setWert] = useState(manuell);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, start] = useTransition();

  const umschalten = (neu: boolean) => {
    setFehler(null);
    setWert(neu);
    start(async () => {
      const antwort = await setManualModeAction(neu);
      if ("error" in antwort) {
        setWert(!neu);
        setFehler(antwort.error);
      }
    });
  };

  return (
    <div className="panel px-5 py-4">
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="h-5 w-5 shrink-0" style={{ accentColor: "var(--accent)" }} checked={wert} disabled={laeuft} onChange={(e) => umschalten(e.currentTarget.checked)} />
        <span className="text-[15px] font-semibold">Manueller KI-Modus</span>
      </label>
      <p className="mt-2 text-[13.5px] text-ink-2">
        Die App zeigt den vollständigen Prompt zum Kopieren und prüft die eingefügte Antwort mit derselben Reparatur und Validierung wie eine Antwort über die API. Es geht keine Anfrage hinaus
        und es entstehen keine Kosten. Namen sind vor der Anzeige durch [Name] ersetzt.
      </p>
      <p className="mt-2 text-[12.5px] text-ink-3">
        In den Umgebungsvariablen hat <code className="font-mono">AI_&lt;BEREICH&gt;_PROVIDER=manual</code> bzw. <code className="font-mono">AI_PROVIDER=manual</code> Vorrang vor diesem Schalter.
        Nur die Administration kann ihn umstellen.
      </p>
      {fehler && (
        <p className="mt-2 text-[13px] text-red" role="alert">
          {fehler}
        </p>
      )}
    </div>
  );
}
