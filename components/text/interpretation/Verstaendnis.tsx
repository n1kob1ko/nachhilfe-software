"use client";

import { useState } from "react";
import { LESEMETHODE } from "@/lib/kurzgeschichten";

/**
 * Erst verstehen, dann schreiben (lib/kurzgeschichten.ts): neben einer Geschichte aus der Sammlung die Lesemethode in
 * vier Schritten und die Verständnisfragen zum mündlichen Beantworten. Die Lehrkraft bekommt die Musterantworten mit
 * (hinter „Musterantworten zeigen“), das Gerät des Schülers nur die Fragen.
 */
export function Verstaendnis({ fragen }: { fragen: { frage: string; antwort?: string }[] }) {
  const [zeigen, setZeigen] = useState(false);
  const mitAntworten = fragen.some((f) => f.antwort);
  return (
    <details className="ti-box mt-4" data-testid="verstaendnis">
      <summary className="ti-summary">Erst verstehen: Lesemethode und {fragen.length} Fragen</summary>
      <ol className="mt-2 grid list-decimal gap-1 pl-5 text-[14px] text-ink-2">
        {LESEMETHODE.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="mt-3 text-[14px] font-semibold">Beantworte die Fragen zuerst mündlich, dann schreib.</p>
      {mitAntworten && (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setZeigen((z) => !z)} aria-pressed={zeigen} data-testid="musterantworten">
          {zeigen ? "Musterantworten ausblenden" : "Musterantworten zeigen"}
        </button>
      )}
      <ol className="mt-2 grid list-decimal gap-2 pl-5 text-[14.5px]">
        {fragen.map((f) => (
          <li key={f.frage}>
            {f.frage}
            {zeigen && f.antwort && <p className="mt-0.5 text-[13.5px] text-ink-2">{f.antwort}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
}
