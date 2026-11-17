"use client";

import { Lightbulb, Timer } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { gesetzt, KartenInhalt, type Stand } from "./KartenInhalt";
import { funkenHier } from "./Funkenregen";
import { klang } from "./klang";
import { vibriere } from "./SpielTeile";

/**
 * Die Frage im Brett (niko 2026-11-16: „die spiele sollen die schüler süchtig machen … das spielkonzept … komisch
 * aufgebaut“): statt eines eigenen Bildschirms schiebt sich die Frage unter dem Brett hoch, wo sonst die Teile liegen;
 * das Brett bleibt sichtbar. Die Antworten sind große Kacheln (höchstens vier), ein Tipp zählt sofort.
 *
 * - Richtig: die Kachel leuchtet, Funken fliegen, die neuen Teile kommen (`onWeiter(true, schnell)`). Wer innerhalb von
 *   `SCHNELL_MS` antwortet, ist „blitzschnell“ (Bonus im Brett). Der Balken oben läuft so lange.
 * - Falsch: die Kachel ist durchgestrichen, die richtige leuchtet, die Regel steht da; weiter geht es mit einem Tipp auf
 *   die richtige (wie in den anderen Spielen).
 *
 * Gezählt wird wie immer in Lernspiel.tsx (`onPruefe` beim ersten Tipp).
 */

export const SCHNELL_MS = 6000;

export function BrettFrage({
  karte,
  optionen,
  auftrag,
  kopf,
  onPruefe,
  onWeiter,
  onFunken,
}: {
  karte: SpielKarte;
  /** die Kacheln in fester Reihenfolge, mit der richtigen Antwort */
  optionen: string[];
  auftrag: string;
  /** wofür die Frage ist (neue Teile, Rettung) */
  kopf: ReactNode;
  onPruefe: (wahl: string) => boolean;
  onWeiter: (sauber: boolean, schnell: boolean) => void;
  /** Funken an dieser Stelle (Bildschirm-Koordinaten) */
  onFunken?: (x: number, y: number) => void;
}) {
  const [stand, setStand] = useState<{ i: number; richtig: boolean } | null>(null);
  const [daneben, setDaneben] = useState(-1);
  const [fertig, setFertig] = useState(false);
  const start = useRef(0);
  const knoepfe = useRef<(HTMLButtonElement | null)[]>([]);
  const blatt = useRef<HTMLDivElement | null>(null);
  const ziel = optionen.indexOf(karte.richtig);

  useEffect(() => {
    start.current = performance.now();
  }, []);

  const funken = (i: number) => {
    const el = knoepfe.current[i];
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (onFunken) onFunken(r.left + r.width / 2, r.top + r.height / 2);
    else for (const farbe of ["#22c283", "#ffd76e", "#ffffff"]) funkenHier(r.left + r.width / 2, r.top + r.height / 2, farbe, { n: 7, kraft: 0.9 });
  };

  const tippe = useCallback(
    (i: number) => {
      if (fertig || i < 0 || i >= optionen.length || i === daneben) return;
      // nach einem Fehler führt nur die richtige weiter
      if (daneben >= 0) {
        if (i !== ziel) return;
        setFertig(true);
        setStand({ i, richtig: true });
        klang.richtig();
        vibriere(10);
        setTimeout(() => onWeiter(false, false), 420);
        return;
      }
      const ok = onPruefe(optionen[i]);
      if (ok) {
        const schnell = performance.now() - start.current <= SCHNELL_MS;
        setFertig(true);
        setStand({ i, richtig: true });
        klang.richtig(schnell);
        vibriere([10, 30, 16]);
        funken(i);
        setTimeout(() => onWeiter(true, schnell), 560);
        return;
      }
      setDaneben(i);
      setStand({ i, richtig: false });
      klang.falsch();
      vibriere([28, 40, 28]);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        blatt.current?.animate?.([{ translate: "0" }, { translate: "-8px" }, { translate: "7px" }, { translate: "-4px" }, { translate: "0" }], { duration: 360, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
    },
    // funken liest nur Refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fertig, optionen, daneben, ziel, onPruefe, onWeiter],
  );

  // am Laptop: die Ziffern
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= optionen.length) {
        e.preventDefault();
        tippe(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [optionen.length, tippe]);

  const kartenStand: Stand = stand ? { wahl: optionen[stand.i], richtig: stand.richtig } : null;
  const lang = optionen.some((o) => o.length > 16);
  return (
    <div className="bwf" data-stand={stand ? (stand.richtig ? "richtig" : "falsch") : undefined} data-testid="bw-frage">
      <div className="bwf-kopf">{kopf}</div>
      {/* läuft SCHNELL_MS lang: so lange ist eine richtige Antwort „blitzschnell“ */}
      <div className="bwf-zeit" data-aus={daneben >= 0 || fertig ? "" : undefined} style={{ "--ms": `${SCHNELL_MS}ms` } as CSSProperties} aria-hidden>
        <Timer size={14} strokeWidth={2.6} />
        <span>
          <i />
        </span>
      </div>
      <div ref={blatt} className="bwf-blatt">
        <p className="bwf-auftrag">{daneben >= 0 && !fertig ? "Tipp die richtige Antwort an." : (karte.auftrag ?? auftrag)}</p>
        <div className="bwf-satz">
          <KartenInhalt karte={karte} stand={kartenStand} />
        </div>
      </div>
      <div className="bwf-kacheln" data-lang={lang ? "" : undefined} role="group" aria-label="Antworten">
        {optionen.map((o, i) => (
          <button
            key={o}
            ref={(el) => {
              knoepfe.current[i] = el;
            }}
            type="button"
            className="bwf-kachel ohne-druck"
            data-richtig={stand?.richtig && stand.i === i ? "" : undefined}
            data-falsch={i === daneben ? "" : undefined}
            data-zeigen={daneben >= 0 && i === ziel && !fertig ? "" : undefined}
            disabled={fertig || i === daneben || (daneben >= 0 && i !== ziel)}
            onClick={() => tippe(i)}
            aria-keyshortcuts={String(i + 1)}
            data-testid={`bwf-kachel-${i}`}
            style={{ "--i": i } as CSSProperties}
          >
            <span>{gesetzt(karte, o)}</span>
          </button>
        ))}
      </div>
      {daneben >= 0 && karte.regel && (
        <p className="bwf-regel" role="status">
          <Lightbulb size={16} aria-hidden /> {gesetzt(karte, karte.regel)}
        </p>
      )}
    </div>
  );
}

/** Höchstens vier Kacheln: die richtige und die ersten falschen, in der Reihenfolge der Karte. */
export function brettOptionen(karte: SpielKarte): string[] {
  const f = karte.faecher;
  if (f.length < 2 || !f.includes(karte.richtig)) return [];
  if (f.length <= 4) return f;
  const falsche = f.filter((x) => x !== karte.richtig).slice(0, 3);
  // die richtige an einer festen, aber nicht immer gleichen Stelle
  const stelle = [...karte.key].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
  return [...falsche.slice(0, stelle), karte.richtig, ...falsche.slice(stelle)];
}
