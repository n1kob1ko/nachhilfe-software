"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { praesentationMitKiAction } from "@/app/praesentation-actions";
import { ManualAustausch } from "@/components/ai/ManualAustausch";

const dauerText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * „Präsentation erstellen“ auf der Seite eines geprüften Lernpakets (lib/praesentation-ki.ts). Die geschätzten Kosten
 * stehen am Knopf; hat das Paket schon eine Präsentation, heißt er „Neue Präsentation erstellen“ und fragt erst nach.
 * Während die KI schreibt, läuft die Zeit mit; danach zeigt die Seite den Vorschlag. Bei einem Fehler bleibt alles
 * stehen und „Erneut versuchen“ fragt noch einmal. Ist die KI aus, sagt der Bereich das, und der Knopf bleibt aus.
 */
export function PraesentationKiKnopf(props: {
  paketId: number;
  /** „ca. 12–26 Cent“ oder „kostet nichts (manueller Modus)“ */
  kosten: string;
  /** null: die KI kann gefragt werden; sonst warum nicht */
  kiAus: string | null;
  /** das Paket hat schon eine Präsentation */
  neu: boolean;
}) {
  const [laeuft, starten] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [fragen, setFragen] = useState(false);
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
    // a second click while the first is on its way does nothing (the server would wait for the same request anyway)
    if (unterwegs.current || props.kiAus) return;
    unterwegs.current = true;
    setFehler(null);
    setFragen(false);
    starten(async () => {
      try {
        const res = await praesentationMitKiAction(props.paketId);
        if (res.ok) {
          window.location.assign(`/mehr/lernpakete/${props.paketId}?vorschlag=1#praesentation-vorschlag`);
          return;
        }
        setFehler(`${res.error} Es wurde nichts gespeichert.`);
      } catch {
        setFehler("Keine Antwort vom Server. Ist der Vorschlag doch fertig geworden, steht er nach dem Neuladen hier.");
      } finally {
        unterwegs.current = false;
      }
    });
  };

  const aus = laeuft || Boolean(props.kiAus);
  return (
    <div className="grid gap-3" data-testid="praesentation-ki">
      <ManualAustausch aktiv={laeuft} />
      {props.kiAus && (
        <p className="rounded-lg bg-amber-wash px-4 py-3 text-[14px] text-amber" role="status">
          {props.kiAus}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3" aria-live="polite">
        {laeuft ? (
          <p className="flex min-w-[16rem] flex-1 items-start gap-2 text-[14.5px]" data-testid="praesentation-ki-laeuft">
            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-accent" aria-hidden />
            <span>
              Die KI erstellt die Präsentation … <span className="num font-semibold">{dauerText(seit)}</span>
              <span className="block text-[13px] text-ink-3">Das dauert meist ein bis drei Minuten. Danach siehst du Folien und Vortragstext als Vorschlag.</span>
            </span>
          </p>
        ) : fragen ? (
          <div className="grid w-full gap-3 rounded-lg bg-accent-wash px-4 py-3" role="group" aria-label="Neue Präsentation erstellen?">
            <p className="text-[14px]">
              Die KI erstellt eine neue Präsentation ({props.kosten}). Die jetzige bleibt unter Präsentationen erhalten; erst mit „Übernehmen“ ersetzt die neue sie in diesem Paket.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={senden} disabled={aus}>
                <Sparkles size={16} aria-hidden /> Ja, neu erstellen
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setFragen(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="button" className={`btn ${props.neu ? "btn-secondary" : "btn-primary"} max-w-full flex-wrap gap-x-2 gap-y-0 py-2 whitespace-normal`} onClick={props.neu ? () => setFragen(true) : senden} disabled={aus} title={props.kiAus ?? props.kosten}>
              <Sparkles size={16} aria-hidden /> {props.neu ? "Neue Präsentation erstellen" : "Präsentation erstellen"}
              <span className="font-normal opacity-80">· {props.kosten}</span>
            </button>
            {fehler && (
              <button type="button" className="btn btn-secondary" onClick={senden} disabled={aus}>
                <RotateCcw size={16} aria-hidden /> Erneut versuchen
              </button>
            )}
          </>
        )}
        {fehler && (
          <p className="w-full rounded-lg bg-red-wash px-4 py-3 text-[14px] text-red" role="alert" data-testid="praesentation-ki-fehler">
            {fehler}
          </p>
        )}
      </div>
    </div>
  );
}
