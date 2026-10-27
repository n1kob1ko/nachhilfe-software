"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { praesImUnterrichtAction } from "@/app/praesentation-actions";
import { ManualAustausch } from "@/components/ai/ManualAustausch";

const dauerText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * „Entwurf erstellen“ im Schritt (lib/praesentation-unterricht.ts): die geschätzten Kosten stehen am Knopf. Während die KI schreibt,
 * läuft die Zeit mit; danach lädt die Seite und zeigt den Entwurf am Schritt. Bei einem Fehler bleibt alles stehen, „Erneut versuchen“
 * fragt noch einmal. Ohne KI ist der Knopf aus und der Grund steht darunter.
 */
export function PraesentationSchrittKnopf(props: { unitId: number; schrittId: number; kosten: string; kiAus: string | null }) {
  const [laeuft, starten] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [seit, setSeit] = useState(0);
  const unterwegs = useRef(false);

  useEffect(() => {
    if (!laeuft) return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [laeuft]);

  const senden = () => {
    if (unterwegs.current || props.kiAus) return;
    unterwegs.current = true;
    setFehler(null);
    starten(async () => {
      try {
        const res = await praesImUnterrichtAction(props.unitId, props.schrittId);
        if (res.ok) {
          window.location.assign(`/einheiten/${props.unitId}#praesentation-schritt`);
          return;
        }
        setFehler(`${res.error} Es wurde nichts gespeichert.`);
      } catch {
        setFehler("Keine Antwort vom Server. Ist der Entwurf doch fertig geworden, steht er nach dem Neuladen hier.");
      } finally {
        unterwegs.current = false;
      }
    });
  };

  return (
    <div className="grid gap-2" data-testid="praesentation-erstellen-knopf">
      <ManualAustausch aktiv={laeuft} />
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {laeuft ? (
          <p className="flex min-w-[14rem] flex-1 items-start gap-2 text-[14.5px]">
            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-accent" aria-hidden />
            <span>
              Die KI erstellt den Entwurf … <span className="num font-semibold">{dauerText(seit)}</span>
              <span className="block text-[13px] text-ink-3">Das dauert meist ein bis drei Minuten. Du kannst inzwischen weiter unterrichten.</span>
            </span>
          </p>
        ) : (
          <>
            <button type="button" className="btn btn-primary max-w-full flex-wrap gap-x-2 gap-y-0 py-2 whitespace-normal" onClick={senden} disabled={Boolean(props.kiAus)}>
              <Sparkles size={16} aria-hidden /> Entwurf erstellen
              {!props.kiAus && <span className="font-normal opacity-80">· {props.kosten}</span>}
            </button>
            {fehler && (
              <button type="button" className="btn btn-secondary" onClick={senden}>
                <RotateCcw size={16} aria-hidden /> Erneut versuchen
              </button>
            )}
          </>
        )}
      </div>
      {props.kiAus && <p className="text-[13.5px] text-ink-2">{props.kiAus}</p>}
      {fehler && (
        <p className="rounded-lg bg-red-wash px-3 py-2 text-[14px] text-red" role="alert">
          {fehler}
        </p>
      )}
    </div>
  );
}
