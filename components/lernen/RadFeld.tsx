"use client";

import { ChevronsUpDown, Lightbulb } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { KartenInhalt, type Stand } from "./KartenInhalt";
import { Funken, vibriere } from "./SpielTeile";

/**
 * Das Spielfeld für Sätze mit einer Lücke und drei bis sechs Antworten (lib/lernspiele-antwort.ts): „Präposition und
 * Fall“, „Adjektiv-Endungen“, „English Tenses“ und „English Grammar“. Oben das Blatt mit dem Satz, unten beim Daumen
 * ein Rad mit den Antworten. Beim Drehen steht die Antwort schon in der Lücke: man liest den ganzen Satz und hört, ob
 * er stimmt. „Prüfen“ zählt. Am Anfang steht das Rad auf keiner Antwort.
 *
 * Das Rad ist eine Liste, die der Browser selbst rollt und einrastet (scroll-snap); eine Zeile antippen dreht sie in
 * die Mitte. Am Laptop: Pfeil hoch und runter oder die Ziffern, die Eingabetaste prüft.
 *
 * - Richtig: die Lücke wird grün, die nächste Karte kommt.
 * - Falsch: die Lücke wird rot, darunter stehen die richtige Antwort und die Regel. Weiter geht es, wenn das Rad auf
 *   der richtigen Antwort steht (wie bei den Kisten: erst mit der richtigen Antwort).
 *
 * Gezählt wird das erste Prüfen je Karte; das macht Lernspiel.tsx (`onPruefe`).
 */
export function RadFeld({
  karte,
  auftrag,
  onPruefe,
  onWeiter,
}: {
  karte: SpielKarte;
  auftrag: string;
  /** die Antwort in der Mitte des Rades; zurück kommt, ob sie stimmt */
  onPruefe: (wahl: string) => boolean;
  /** die richtige Antwort steht in der Lücke und die Karte ist fertig; `sauber`: beim ersten Prüfen richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const optionen = karte.faecher;
  const ziel = optionen.indexOf(karte.richtig);
  // die Zeile in der Mitte des Rades; -1: noch keine Antwort („Dreh am Rad“)
  const [bei, setBei] = useState(-1);
  const [stand, setStand] = useState<"richtig" | "falsch" | null>(null);
  const [hatFehler, setHatFehler] = useState(false);
  // was beim ersten Prüfen in der Lücke stand
  const [daneben, setDaneben] = useState<string | null>(null);
  const rolle = useRef<HTMLDivElement | null>(null);
  const blatt = useRef<HTMLDivElement | null>(null);
  const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hoehe = () => (rolle.current?.firstElementChild as HTMLElement | null)?.offsetHeight || 52;
  const gerollt = () => {
    const el = rolle.current;
    if (!el) return;
    const neu = Math.max(-1, Math.min(optionen.length - 1, Math.round(el.scrollTop / hoehe()) - 1));
    setBei((alt) => {
      if (alt !== neu) vibriere(3);
      return neu;
    });
  };
  const dreheAuf = useCallback(
    (i: number) => {
      if (i < 0 || i >= optionen.length) return;
      rolle.current?.scrollTo({ top: (i + 1) * hoehe(), behavior: ruhig() ? "auto" : "smooth" });
    },
    [optionen.length],
  );

  const pruefe = useCallback(() => {
    if (stand || bei < 0) return;
    const wahl = optionen[bei];
    // nach dem ersten Fehler zählt nichts mehr: nur die richtige Antwort führt weiter
    const ok = hatFehler ? wahl === karte.richtig : onPruefe(wahl);
    if (ok) {
      vibriere(12);
      setStand("richtig");
      return;
    }
    vibriere([28, 40, 28]);
    setDaneben(wahl);
    setStand("falsch");
    if (!ruhig()) blatt.current?.animate?.([{ translate: "0" }, { translate: "-7px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "0" }], { duration: 360, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
  }, [stand, bei, optionen, hatFehler, onPruefe, karte.richtig]);

  // nach dem Prüfen: richtig → weiter; falsch → das Rad wird wieder frei, Antwort und Regel stehen darunter
  useEffect(() => {
    if (stand === "richtig") {
      const t = setTimeout(() => onWeiter(!hatFehler), hatFehler ? 650 : 800);
      return () => clearTimeout(t);
    }
    if (stand === "falsch") {
      const t = setTimeout(() => {
        setHatFehler(true);
        setStand(null);
      }, 900);
      return () => clearTimeout(t);
    }
    // läuft einmal je Prüfung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand]);

  // nach einem Fehler reicht es, das Rad auf die richtige Antwort zu drehen (sobald es dort ruht)
  useEffect(() => {
    if (!hatFehler || stand || bei !== ziel) return;
    const t = setTimeout(() => {
      vibriere(12);
      setStand("richtig");
    }, 380);
    return () => clearTimeout(t);
  }, [hatFehler, stand, bei, ziel]);

  // am Laptop: Pfeil hoch und runter drehen, eine Ziffer springt zur Antwort, die Eingabetaste prüft
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || stand) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        dreheAuf(Math.max(0, Math.min(optionen.length - 1, bei + (e.key === "ArrowDown" ? 1 : -1))));
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= optionen.length) {
        e.preventDefault();
        dreheAuf(Number(e.key) - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!hatFehler) pruefe();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stand, bei, optionen.length, hatFehler, dreheAuf, pruefe]);

  const kartenStand: Stand = stand === "richtig" ? { wahl: karte.richtig, richtig: true } : stand === "falsch" && daneben !== null ? { wahl: daneben, richtig: false } : null;
  const fern = (i: number) => Math.min(2, Math.abs(i - bei));
  return (
    <>
      <p className="ls-auftrag">{hatFehler ? "Dreh jetzt auf die richtige Antwort." : auftrag}</p>
      <div className="ls-reihe ls-radfeld">
        <div ref={blatt} className="ls-satzblatt ls-radblatt" data-stand={stand ?? undefined} data-knapp={hatFehler ? "" : undefined} data-testid="rad-blatt">
          <KartenInhalt karte={karte} stand={kartenStand} probe={bei >= 0 ? optionen[bei] : undefined} />
        </div>

        {/* in der Mitte: nach einem Fehler die richtige Antwort und die Regel */}
        <div className="ls-reihe-mitte">
          {hatFehler && (
            <div className="ls-regel ls-regel-frei" role="status">
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden /> Fast! Richtig ist
              </p>
              <p className="ls-regel-loesung">
                <b className="ls-richtig" data-testid="rad-richtig">
                  {karte.einsatz && karte.einsatz.toLowerCase() !== karte.richtig ? `${karte.richtig} (${karte.einsatz})` : karte.richtig}
                </b>
              </p>
              <p className="ls-regel-text">{karte.regel}</p>
            </div>
          )}
        </div>

        <div className="ls-rad" data-stand={stand ?? undefined} data-leer={bei < 0 ? "" : undefined} data-testid="rad">
          <span className="ls-rad-band" aria-hidden />
          <div ref={rolle} className="ls-rad-rolle" role="listbox" aria-label="Antworten" aria-orientation="vertical" onScroll={gerollt} data-fest={stand ? "" : undefined}>
            <div className="ls-rad-zeile ls-rad-hinweis" data-ab={fern(-1)} aria-hidden>
              <ChevronsUpDown size={20} aria-hidden /> Dreh am Rad
            </div>
            {optionen.map((o, i) => (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={i === bei}
                className="ls-rad-zeile ohne-druck"
                data-ab={fern(i)}
                data-lang={o.length > 15 ? "" : undefined}
                data-zeigen={hatFehler && i === ziel ? "" : undefined}
                onClick={() => dreheAuf(i)}
                disabled={!!stand}
                aria-keyshortcuts={String(i + 1)}
                data-testid={`rad-${i}`}
              >
                {o}
              </button>
            ))}
          </div>
          {/* die Funken kommen vom Rad, nicht über dem Satz */}
          {stand === "richtig" && !hatFehler && <Funken />}
        </div>
        {hatFehler ? (
          <p className="ls-strahl-weiter" role="status">
            {stand === "richtig" ? "Genau so!" : "Die richtige Antwort steht oben."}
          </p>
        ) : (
          <button type="button" className="ls-knopf ls-los ls-pruefen" disabled={bei < 0 || !!stand} onClick={pruefe} data-testid="rad-pruefen">
            Prüfen
          </button>
        )}
      </div>
    </>
  );
}
