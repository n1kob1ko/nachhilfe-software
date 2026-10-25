"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { korrigiereFeldAction } from "@/app/session-actions";

/**
 * Ein Feld der Abschlusskarte (lib/abschluss.ts), schnell korrigierbar: ein Tippen auf das Feld (oder den Stift) öffnet
 * ein Textfeld mit den Zeilen, „Speichern“ schreibt nur dieses Feld und bestätigt nicht. Leer gespeichert: das Feld
 * kommt wieder aus den Daten. Ohne `lessonId` (fremde Einheit) nur lesen. Links in den Zeilen bleiben Links.
 */
export function AbschlussFeld({ lessonId, feld, label, text, children }: { lessonId: number | null; feld: string; label: string; text: string; children: React.ReactNode }) {
  const [offen, setOffen] = useState(false);
  const [wert, setWert] = useState(text);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const oeffnen = () => {
    setWert(text);
    setFehler(null);
    setOffen(true);
  };
  const speichern = () =>
    start(async () => {
      const r = await korrigiereFeldAction(lessonId!, feld, wert);
      if ("fehler" in r) return setFehler(r.fehler);
      setOffen(false);
      router.refresh();
    });
  return (
    <div data-testid={`abschluss-feld-${feld}`}>
      <dt className="flex min-h-[20px] items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
        {lessonId !== null && !offen && (
          <button type="button" onClick={oeffnen} aria-label={`${label} korrigieren`} className="-my-3 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-panel hover:text-ink" data-testid={`feld-korrigieren-${feld}`}>
            <Pencil size={15} aria-hidden />
          </button>
        )}
      </dt>
      <dd className="mt-1 text-[15.5px]">
        {offen ? (
          <div className="grid gap-2">
            <textarea
              className="input field-sizing-content min-h-[120px] text-[15px]"
              value={wert}
              onChange={(e) => setWert(e.target.value)}
              aria-label={label}
              autoFocus
              maxLength={2000}
              data-testid={`feld-text-${feld}`}
            />
            <p className="text-[13px] text-ink-3">Eine Zeile pro Punkt. Leer gespeichert, kommt das Feld wieder aus den Daten.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={speichern} data-testid={`feld-speichern-${feld}`}>
                Speichern
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setOffen(false)}>
                Abbrechen
              </button>
            </div>
            {fehler && (
              <p className="text-[13px] text-red" role="alert">
                {fehler}
              </p>
            )}
          </div>
        ) : lessonId !== null ? (
          // a tap on the field opens it; a link inside (e.g. „Bewertung übernehmen“) stays a link
          <div
            className="-mx-2 cursor-text rounded-xl px-2 py-0.5 transition-colors hover:bg-panel/60"
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("a, button")) oeffnen();
            }}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </dd>
    </div>
  );
}
