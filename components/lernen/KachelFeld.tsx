"use client";

import { Check, Lightbulb } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { gesetzt, KartenInhalt, type Stand } from "./KartenInhalt";
import { Funken, vibriere } from "./SpielTeile";

/**
 * Das Spielfeld für Sätze mit einer Lücke und drei bis sechs Antworten (lib/lernspiele-antwort.ts): „Präposition und
 * Fall“, „Adjektiv-Endungen“, „English Tenses“, „English Grammar“ und „Wortschatz“. Oben das Blatt mit dem Satz,
 * darunter beim Daumen die Antworten als große Kacheln, wie man es aus beliebten Lern-Apps kennt (Wortbank):
 *
 * - Eine Kachel antippen: das Wort fliegt in die Lücke und zählt sofort (niko 2026-11-16: „dieses Prüfen ist zu
 *   anstrengend … wenn der Spieler klickt, soll es sofort zählen“). Auf ihrem Platz bleibt ein leerer Rahmen.
 * - Unten kommt ein Streifen hoch: grün „Super!“ (die nächste Karte kommt), oder rot mit der richtigen Antwort und der
 *   Regel. Die falsche Kachel ist dann durchgestrichen, die richtige leuchtet; weiter geht es mit der richtigen
 *   Antwort (wie bei den Kisten).
 *
 * Am Laptop: die Ziffern tippen eine Kachel an.
 * Gezählt wird der erste Tipp je Karte; das macht Lernspiel.tsx (`onPruefe`).
 */
export function KachelFeld({
  karte,
  auftrag,
  onPruefe,
  onWeiter,
}: {
  karte: SpielKarte;
  auftrag: string;
  /** die Antwort in der Lücke; zurück kommt, ob sie stimmt */
  onPruefe: (wahl: string) => boolean;
  /** die richtige Antwort steht in der Lücke und die Karte ist fertig; `sauber`: beim ersten Prüfen richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const optionen = karte.faecher;
  const ziel = optionen.indexOf(karte.richtig);
  // die Kachel in der Lücke; -1: die Lücke ist leer
  const [bei, setBei] = useState(-1);
  const [stand, setStand] = useState<"richtig" | "falsch" | null>(null);
  // die Kachel, die beim ersten Prüfen falsch war (durchgestrichen); gesetzt heißt: es gab einen Fehler
  const [daneben, setDaneben] = useState(-1);
  const hatFehler = daneben >= 0;
  const blatt = useRef<HTMLDivElement | null>(null);
  const kacheln = useRef(new Map<number, HTMLElement>());
  // eine Kachel auf dem Weg in die Lücke: wo sie vor dem Tippen war
  const flug = useRef<DOMRect | null>(null);
  const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setze = useCallback(
    (i: number) => {
      // eine Kachel ist schon in der Lücke: sie zählt gleich, bis dahin geht nichts anderes
      if (stand || bei >= 0 || i < 0 || i >= optionen.length || i === daneben) return;
      const el = kacheln.current.get(i);
      if (el) flug.current = el.getBoundingClientRect();
      vibriere(4);
      setBei(i);
    },
    [stand, optionen.length, daneben, bei],
  );

  // das Wort fliegt von der Kachel in die Lücke (nur transform)
  useLayoutEffect(() => {
    const von = flug.current;
    flug.current = null;
    if (!von || ruhig()) return;
    const el = blatt.current?.querySelector<HTMLElement>(".ls-luecke");
    if (!el?.animate) return;
    const nach = el.getBoundingClientRect();
    const dx = von.left + von.width / 2 - (nach.left + nach.width / 2);
    const dy = von.top + von.height / 2 - (nach.top + nach.height / 2);
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(1.15)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }, [bei]);

  const pruefe = useCallback(() => {
    if (stand || bei < 0) return;
    // nach dem ersten Fehler zählt nichts mehr: nur die richtige Antwort führt weiter, eine andere springt zurück
    if (hatFehler && bei !== ziel) {
      vibriere([28, 40, 28]);
      if (!ruhig()) blatt.current?.animate?.([{ translate: "0" }, { translate: "-7px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "0" }], { duration: 360, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
      setBei(-1);
      return;
    }
    const ok = hatFehler || onPruefe(optionen[bei]);
    if (ok) {
      vibriere(12);
      setStand("richtig");
      return;
    }
    vibriere([28, 40, 28]);
    setDaneben(bei);
    setStand("falsch");
    if (!ruhig()) blatt.current?.animate?.([{ translate: "0" }, { translate: "-7px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "0" }], { duration: 360, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
  }, [stand, bei, optionen, hatFehler, ziel, onPruefe]);

  // nach dem Prüfen: richtig → weiter; falsch → das falsche Wort geht zurück, Antwort und Regel bleiben unten stehen
  useEffect(() => {
    if (stand === "richtig") {
      const t = setTimeout(() => onWeiter(!hatFehler), hatFehler ? 650 : 800);
      return () => clearTimeout(t);
    }
    if (stand === "falsch") {
      const t = setTimeout(() => {
        setBei(-1);
        setStand(null);
      }, 900);
      return () => clearTimeout(t);
    }
    // läuft einmal je Prüfung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand]);

  // die Kachel zählt, sobald sie in der Lücke gelandet ist (kurz den ganzen Satz zeigen)
  useEffect(() => {
    if (stand || bei < 0) return;
    const t = setTimeout(pruefe, 260);
    return () => clearTimeout(t);
  }, [stand, bei, pruefe]);

  // am Laptop: die Ziffern tippen eine Kachel an
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || stand) return;
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= optionen.length) {
        e.preventDefault();
        setze(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stand, optionen.length, setze]);

  const kartenStand: Stand = stand === "richtig" ? { wahl: karte.richtig, richtig: true } : stand === "falsch" ? { wahl: optionen[daneben], richtig: false } : null;
  // lange Antworten (englische Zeiten) stehen untereinander, kurze zu zweit nebeneinander
  const lang = optionen.some((o) => o.length > 13);
  const loesung = karte.einsatz && karte.einsatz.toLowerCase() !== karte.richtig ? `${karte.richtig} (${karte.einsatz})` : karte.richtig;
  return (
    <>
      <p className="ls-auftrag">{hatFehler && stand !== "richtig" ? "Tipp jetzt die richtige Antwort an." : auftrag}</p>
      <div className="ls-reihe ls-kachelfeld">
        <div ref={blatt} className="ls-satzblatt ls-kachelblatt" data-stand={stand ?? undefined} data-knapp={hatFehler ? "" : undefined} data-testid="kachel-blatt">
          <div className="ls-kachel-satz">
            <KartenInhalt karte={karte} stand={kartenStand} probe={bei >= 0 ? optionen[bei] : undefined} />
          </div>
          {stand === "richtig" && !hatFehler && <Funken />}
        </div>

        <div className="ls-kacheln" data-lang={lang ? "" : undefined} data-ungerade={optionen.length % 2 ? "" : undefined} role="group" aria-label="Antworten" data-testid="kacheln">
          {optionen.map((o, i) => {
            const drin = i === bei;
            return (
              <button
                key={o}
                ref={(el) => {
                  if (el) kacheln.current.set(i, el);
                  else kacheln.current.delete(i);
                }}
                type="button"
                className="ls-kachel ohne-druck"
                data-drin={drin ? "" : undefined}
                data-falsch={i === daneben ? "" : undefined}
                data-zeigen={hatFehler && i === ziel && !drin ? "" : undefined}
                aria-pressed={drin}
                disabled={!!stand || i === daneben || (bei >= 0 && !drin)}
                onClick={() => setze(i)}
                aria-keyshortcuts={String(i + 1)}
                data-testid={`kachel-${i}`}
              >
                <span>{gesetzt(karte, o)}</span>
              </button>
            );
          })}
        </div>

        {/* unten beim Daumen: der Streifen mit dem Ergebnis */}
        <div className="ls-kachel-fuss">
          {stand === "richtig" ? (
            <div className="ls-bescheid" data-art="richtig" role="status" data-testid="kachel-bescheid">
              <p className="ls-bescheid-kopf">
                <Check size={20} strokeWidth={3} aria-hidden /> {hatFehler ? "Genau so!" : "Super!"}
              </p>
            </div>
          ) : hatFehler ? (
            <div className="ls-bescheid" data-art="falsch" role="status" data-testid="kachel-bescheid">
              <p className="ls-bescheid-kopf">
                <Lightbulb size={18} aria-hidden /> Fast! Richtig ist <b data-testid="kachel-richtig">{gesetzt(karte, loesung)}</b>
              </p>
              <p className="ls-bescheid-text">{gesetzt(karte, karte.regel)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
