"use client";

import { useState, useTransition } from "react";
import { setKiModusAction } from "@/app/(tutor)/mehr/ki-kosten/actions";
import type { KiModus } from "@/lib/ai/modus";

export type AnbieterOption = { modus: KiModus; name: string; was: string; bereit: boolean; fehlt?: string };

/**
 * Die Anbieterwahl auf Mehr › KI-Kosten: Anthropic (Standard), OpenRouter oder der manuelle KI-Modus.
 *
 * Sie schreibt `ki_modus` in `app_settings` (lib/ai/modus.ts). `AI_PROVIDER` bzw.
 * `AI_<AREA>_PROVIDER` in den Umgebungsvariablen hat weiter Vorrang; das steht darunter. Fehlt dem
 * gewählten Anbieter der Schlüssel, ist die KI aus — die Wahl schaltet nie von selbst um.
 */
export function KiAnbieterWahl({ modus, optionen, vorrang }: { modus: KiModus; optionen: AnbieterOption[]; vorrang: string | null }) {
  const [wert, setWert] = useState(modus);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, start] = useTransition();

  const waehlen = (neu: KiModus) => {
    const vorher = wert;
    setFehler(null);
    setWert(neu);
    start(async () => {
      const antwort = await setKiModusAction(neu);
      if ("error" in antwort) {
        setWert(vorher);
        setFehler(antwort.error);
      }
    });
  };

  return (
    <div className="panel px-5 py-4">
      <fieldset className="space-y-2" disabled={laeuft}>
        <legend className="mb-2 text-[15px] font-semibold">Wer beantwortet die KI-Anfragen?</legend>
        {optionen.map((o) => (
          <label key={o.modus} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3">
            <input type="radio" name="ki-modus" value={o.modus} checked={wert === o.modus} onChange={() => waehlen(o.modus)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
            <span className="text-[14px]">
              <b>{o.name}</b> <span className="text-ink-2">· {o.was}</span>
              {!o.bereit && o.fehlt && <span className={`mt-1 block text-[13px] ${wert === o.modus ? "text-red" : "text-ink-3"}`}>{o.fehlt}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      {vorrang && <p className="mt-3 text-[13px] text-amber">{vorrang}</p>}
      <p className="mt-3 text-[12.5px] text-ink-3">
        Fehlt dem gewählten Anbieter der Schlüssel, ist die KI aus und die App arbeitet ohne KI weiter. Es wird nie von selbst auf einen anderen Anbieter umgeschaltet. In den Umgebungsvariablen hat{" "}
        <code className="font-mono">AI_PROVIDER</code> bzw. <code className="font-mono">AI_&lt;BEREICH&gt;_PROVIDER</code> Vorrang. Nur die Administration kann umstellen.
      </p>
      {fehler && (
        <p className="mt-2 text-[13px] text-red" role="alert">
          {fehler}
        </p>
      )}
    </div>
  );
}
