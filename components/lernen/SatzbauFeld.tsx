"use client";

import { Lightbulb } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { REIHE_TRENNER, type SpielKarte } from "@/lib/lernspiele-typen";
import { Funken, vibriere } from "./SpielTeile";

/**
 * Das Spielfeld von „Satzbau“ (lib/satzbau-saetze.ts): der Anfang des Satzes steht auf dem Blatt, die übrigen Teile
 * liegen gemischt darunter. Ein Teil antippen setzt es an die nächste freie Stelle; ein gesetztes Teil antippen holt
 * es zurück (am Laptop auch die Rücktaste).
 *
 * - Liegt das letzte Teil, wird geprüft. Richtig: das Blatt leuchtet, die nächste Karte kommt.
 * - Falsch: die falschen Stellen werden rot, wandern zurück, und darunter stehen der richtige Satz und die Regel.
 *   Weiter geht es, wenn der Satz richtig gebaut ist (wie bei den Kisten: erst mit der richtigen Antwort).
 *
 * Gezählt wird der erste geprüfte Satz je Karte; das macht Lernspiel.tsx (`onPruefe`).
 */
export function SatzbauFeld({
  karte,
  auftrag,
  onPruefe,
  onWeiter,
}: {
  karte: SpielKarte;
  auftrag: string;
  /** der gebaute Satz (Teile mit REIHE_TRENNER); zurück kommt, ob er stimmt */
  onPruefe: (wahl: string) => boolean;
  /** der Satz stimmt und die Karte ist fertig; `sauber`: beim ersten Prüfen richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const teile = karte.faecher;
  const richtig = karte.richtig.split(REIHE_TRENNER);
  // die gesetzten Teile als Plätze in `teile`, in der Reihenfolge des Satzes
  const [gelegt, setGelegt] = useState<number[]>([]);
  const [stand, setStand] = useState<"richtig" | "falsch" | null>(null);
  const [hatFehler, setHatFehler] = useState(false);
  const blatt = useRef<HTMLDivElement | null>(null);
  const imSatz = useRef(new Map<number, HTMLElement>());
  const inAblage = useRef(new Map<number, HTMLElement>());
  // ein Teil auf dem Weg: wo es vor dem Tippen war (für den Flug an seinen neuen Platz)
  const flug = useRef<{ i: number; von: DOMRect } | null>(null);
  const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setze = (i: number) => {
    if (stand || gelegt.includes(i)) return;
    const el = inAblage.current.get(i);
    if (el) flug.current = { i, von: el.getBoundingClientRect() };
    setGelegt([...gelegt, i]);
  };
  const hole = useCallback(
    (i: number) => {
      if (stand) return;
      const el = imSatz.current.get(i);
      if (el) flug.current = { i, von: el.getBoundingClientRect() };
      setGelegt((g) => g.filter((x) => x !== i));
    },
    [stand],
  );

  // das Teil fliegt von seinem alten Platz an den neuen (nur transform)
  useLayoutEffect(() => {
    const f = flug.current;
    flug.current = null;
    if (!f || ruhig()) return;
    const el = (gelegt.includes(f.i) ? imSatz : inAblage).current.get(f.i);
    if (!el?.animate) return;
    const nach = el.getBoundingClientRect();
    const dx = f.von.left - nach.left;
    const dy = f.von.top - nach.top;
    if (!dx && !dy) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }, [gelegt]);

  // liegt das letzte Teil, wird nach einem Augenblick geprüft
  const voll = gelegt.length === teile.length;
  useEffect(() => {
    if (!voll || stand) return;
    const t = setTimeout(() => {
      const ok = onPruefe(gelegt.map((i) => teile[i]).join(REIHE_TRENNER));
      if (ok) {
        vibriere(12);
        setStand("richtig");
        return;
      }
      vibriere([28, 40, 28]);
      setStand("falsch");
      if (!ruhig()) blatt.current?.animate?.([{ rotate: "0deg" }, { rotate: "-1.6deg" }, { rotate: "1.3deg" }, { rotate: "-0.8deg" }, { rotate: "0deg" }], { duration: 420, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
    }, 240);
    return () => clearTimeout(t);
    // geprüft wird genau einmal je volle Reihe; `onPruefe` und `teile` gehören zur selben Karte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voll, stand]);

  // nach dem Prüfen: richtig → weiter; falsch → ab der ersten falschen Stelle zurück in die Ablage
  useEffect(() => {
    if (stand === "richtig") {
      const t = setTimeout(() => onWeiter(!hatFehler), 800);
      return () => clearTimeout(t);
    }
    if (stand === "falsch") {
      const t = setTimeout(() => {
        const ersteFalsche = gelegt.findIndex((i, ort) => teile[i] !== richtig[ort]);
        setGelegt(gelegt.slice(0, Math.max(0, ersteFalsche)));
        setHatFehler(true);
        setStand(null);
      }, 1000);
      return () => clearTimeout(t);
    }
    // läuft einmal je Prüfung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand]);

  // Rücktaste holt das letzte Teil zurück, Ziffern setzen ein Teil der Ablage
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || stand) return;
      if (e.key === "Backspace" && gelegt.length) {
        e.preventDefault();
        hole(gelegt[gelegt.length - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gelegt, stand, hole]);

  const frei = teile.length - gelegt.length;
  // nach einem falschen Versuch: alles vor der ersten falschen Stelle bleibt, der Rest wandert zurück
  const ersteFalsche = stand === "falsch" ? gelegt.findIndex((i, ort) => teile[i] !== richtig[ort]) : -1;
  return (
    <>
      <p className="ls-auftrag">{auftrag}</p>
      <div className="ls-reihe">
        <div ref={blatt} className="ls-satzblatt" data-stand={stand ?? undefined} data-knapp={hatFehler ? "" : undefined} data-testid="satzbau-blatt">
          {karte.marke && <span className="ls-satzart">{karte.marke}</span>}
          <p className="ls-bau" aria-live="polite">
            <span className="ls-fest">{karte.vor}</span>{" "}
            {gelegt.map((i, ort) => (
              <Fragment key={`t${i}`}>
                <span className="ls-bau-stelle">
                <button
                  ref={(el) => {
                    if (el) imSatz.current.set(i, el);
                    else imSatz.current.delete(i);
                  }}
                  type="button"
                  className="ls-teil ohne-druck"
                  data-ort="satz"
                  data-stand={stand === "richtig" ? "richtig" : stand === "falsch" ? (ort < ersteFalsche ? "richtig" : "falsch") : undefined}
                  onClick={() => hole(i)}
                  aria-label={`${teile[i]} zurücklegen`}
                >
                  {teile[i]}
                </button>
                {ort === teile.length - 1 && <span className="ls-fest">{karte.nach}</span>}
                </span>{" "}
              </Fragment>
            ))}
            {Array.from({ length: frei }, (_, n) => (
              <Fragment key={`p${n}`}>
                <span className="ls-bau-stelle">
                  <span className="ls-platz" data-naechster={n === 0 ? "" : undefined} aria-hidden />
                  {n === frei - 1 && <span className="ls-fest">{karte.nach}</span>}
                </span>{" "}
              </Fragment>
            ))}
          </p>
          {stand === "richtig" && <Funken />}
        </div>

        {/* in der Mitte: nach einem Fehler der richtige Satz und die Regel; die Teile liegen unten beim Daumen */}
        <div className="ls-reihe-mitte">
          {hatFehler && stand !== "richtig" && (
            <div className="ls-regel ls-regel-frei" role="status">
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden /> Fast! Richtig ist
              </p>
              <p className="ls-regel-loesung">
                <b className="ls-richtig">{karte.loesung}</b>
              </p>
              <p className="ls-regel-text">{karte.regel}</p>
            </div>
          )}
        </div>

        <div className="ls-ablage" role="group" aria-label="Teile des Satzes">
          {teile.map((t, i) => {
            const weg = gelegt.includes(i);
            return (
              <button
                key={i}
                ref={(el) => {
                  if (el) inAblage.current.set(i, el);
                  else inAblage.current.delete(i);
                }}
                type="button"
                className="ls-teil ohne-druck"
                data-ort="ablage"
                data-weg={weg ? "" : undefined}
                disabled={weg || !!stand}
                aria-hidden={weg ? true : undefined}
                onClick={() => setze(i)}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
