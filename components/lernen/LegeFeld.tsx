"use client";

import { Delete, Lightbulb } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { legeAnzeige, legeKacheln, legeStimmt, legeZiel } from "@/lib/lernspiele-antwort";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { Funken, vibriere } from "./SpielTeile";

/**
 * Das Spielfeld von „Irregular Verbs“ und „Präteritum“ (lib/lernspiele-antwort.ts): oben das Blatt mit dem Satz und der
 * Lücke, unten beim Daumen die Buchstaben. Ein Buchstabe antippen setzt ihn in die Lücke, die Rücktaste holt den
 * letzten zurück, „Prüfen“ zählt (am Laptop die Buchstaben, die Rücktaste und die Eingabetaste). Wie lang das Wort ist,
 * steht nirgends, und es liegen ein paar Buchstaben zu viel da: so lässt sich auch „goed“ legen.
 *
 * - Richtig: das Wort wird grün, die nächste Karte kommt.
 * - Falsch: das Wort wird rot, darunter stehen die richtige Form und die Regel. Weiter geht es, wenn die richtige Form
 *   gelegt ist (wie bei den Kisten: erst mit der richtigen Antwort).
 *
 * Gezählt wird das erste Prüfen je Karte; das macht Lernspiel.tsx (`onPruefe`).
 */
export function LegeFeld({
  karte,
  auftrag,
  onPruefe,
  onWeiter,
}: {
  karte: SpielKarte;
  auftrag: string;
  /** `karte.richtig`, wenn das gelegte Wort stimmt, sonst das gelegte Wort; zurück kommt, ob es stimmt */
  onPruefe: (wahl: string) => boolean;
  /** das richtige Wort liegt und die Karte ist fertig; `sauber`: beim ersten Prüfen richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const kacheln = useMemo(() => legeKacheln(karte), [karte]);
  // die gelegten Kacheln als Plätze in `kacheln`, in der Reihenfolge des Wortes
  const [gelegt, setGelegt] = useState<number[]>([]);
  const [stand, setStand] = useState<"richtig" | "falsch" | null>(null);
  const [hatFehler, setHatFehler] = useState(false);
  const wortEl = useRef<HTMLButtonElement | null>(null);
  const letzter = useRef<HTMLSpanElement | null>(null);
  const tasten = useRef(new Map<number, HTMLButtonElement>());
  // ein Buchstabe auf dem Weg: wo seine Kachel lag (für den Flug in die Lücke)
  const flug = useRef<DOMRect | null>(null);
  const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wort = gelegt.map((i) => kacheln[i]).join("");

  const pruefe = useCallback(
    (w: string) => {
      if (stand || !w) return;
      const stimmt = legeStimmt(w, karte);
      // nach dem ersten Fehler zählt nichts mehr: nur die richtige Form führt weiter
      const ok = hatFehler ? stimmt : onPruefe(stimmt ? karte.richtig : legeAnzeige(w, karte));
      if (ok) {
        vibriere(12);
        setStand("richtig");
        return;
      }
      vibriere([28, 40, 28]);
      setStand("falsch");
      if (!ruhig()) wortEl.current?.animate?.([{ translate: "0" }, { translate: "-7px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "0" }], { duration: 360, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
    },
    [stand, hatFehler, onPruefe, karte],
  );

  // nach dem Prüfen: richtig → weiter; falsch → die Buchstaben wandern zurück, Form und Regel stehen darunter
  useEffect(() => {
    if (stand === "richtig") {
      const t = setTimeout(() => onWeiter(!hatFehler), hatFehler ? 600 : 750);
      return () => clearTimeout(t);
    }
    if (stand === "falsch") {
      const t = setTimeout(() => {
        setGelegt([]);
        setHatFehler(true);
        setStand(null);
      }, 900);
      return () => clearTimeout(t);
    }
    // läuft einmal je Prüfung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand]);

  const setze = useCallback(
    (i: number) => {
      if (stand || gelegt.includes(i)) return;
      flug.current = tasten.current.get(i)?.getBoundingClientRect() ?? null;
      vibriere(3);
      const neu = [...gelegt, i];
      setGelegt(neu);
      // nach einem Fehler reicht es, die richtige Form zu legen
      if (hatFehler && legeStimmt(neu.map((n) => kacheln[n]).join(""), karte)) {
        vibriere(12);
        setStand("richtig");
      }
    },
    [stand, gelegt, hatFehler, kacheln, karte],
  );
  const zurueck = useCallback(() => {
    if (stand || !gelegt.length) return;
    vibriere(3);
    setGelegt(gelegt.slice(0, -1));
  }, [stand, gelegt]);

  // der Buchstabe fliegt von seiner Kachel in die Lücke (nur transform)
  useLayoutEffect(() => {
    const von = flug.current;
    flug.current = null;
    const el = letzter.current;
    if (!von || !el?.animate || ruhig()) return;
    const nach = el.getBoundingClientRect();
    const dx = von.left + von.width / 2 - (nach.left + nach.width / 2);
    const dy = von.top + von.height / 2 - (nach.top + nach.height / 2);
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(1.25)` }, { transform: "none" }], { duration: 190, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }, [gelegt]);

  // am Laptop: ein Buchstabe setzt die erste freie Kachel damit, die Rücktaste holt zurück, die Eingabetaste prüft
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || stand) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        zurueck();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!hatFehler) pruefe(wort);
      } else if (e.key.length === 1) {
        const i = kacheln.findIndex((b, n) => b === e.key.toLowerCase() && !gelegt.includes(n));
        if (i >= 0) {
          e.preventDefault();
          setze(i);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stand, hatFehler, kacheln, gelegt, wort, setze, zurueck, pruefe]);

  const haengt = karte.richtig.startsWith("-");
  const nach = haengt || /^[\s,.;:!?]/.test(karte.nach) || !karte.nach ? karte.nach : ` ${karte.nach}`;
  const zeige = legeAnzeige(wort, karte);
  return (
    <>
      <p className="ls-auftrag">{hatFehler ? "Leg jetzt die richtige Form." : auftrag}</p>
      <div className="ls-reihe ls-legen">
        <div className="ls-satzblatt ls-legeblatt" data-stand={stand ?? undefined} data-knapp={hatFehler ? "" : undefined} data-testid="lege-blatt">
          <p className="ls-satz">
            {karte.vor.trimEnd()}
            {karte.vor.trim() ? " " : ""}
            <button ref={wortEl} type="button" className="ls-legewort ohne-druck" data-stand={stand ?? undefined} data-leer={wort ? undefined : ""} onClick={zurueck} disabled={!!stand || !wort} aria-label={wort ? `${zeige}: letzten Buchstaben zurücknehmen` : "Lücke"} data-testid="lege-wort">
              {[...zeige].map((b, n) => (
                <span key={`${n}-${gelegt[n]}`} ref={n === gelegt.length - 1 ? letzter : undefined}>
                  {b}
                </span>
              ))}
              {!stand && <i className="ls-caret" aria-hidden />}
            </button>
            {nach}
          </p>
          {karte.hinweis && <p className="ls-bedeutung">{karte.hinweis}</p>}
          {stand === "richtig" && !hatFehler && <Funken />}
        </div>

        {/* in der Mitte: nach einem Fehler die richtige Form und die Regel */}
        <div className="ls-reihe-mitte">
          {hatFehler && (
            <div className="ls-regel ls-regel-frei" role="status">
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden /> Fast! Richtig ist
              </p>
              <p className="ls-regel-loesung">
                <b className="ls-richtig" data-testid="lege-richtig">
                  {legeZiel(karte)}
                </b>
              </p>
              <p className="ls-regel-text">{karte.regel}</p>
            </div>
          )}
        </div>

        <div className="ls-kacheln" role="group" aria-label="Buchstaben" data-viele={kacheln.length > 12 ? "" : undefined} data-testid="lege-kacheln">
          {kacheln.map((b, i) => {
            const weg = gelegt.includes(i);
            return (
              <button
                key={i}
                ref={(el) => {
                  if (el) tasten.current.set(i, el);
                  else tasten.current.delete(i);
                }}
                type="button"
                className="ls-kachel ohne-druck"
                data-weg={weg ? "" : undefined}
                disabled={weg || !!stand}
                aria-hidden={weg ? true : undefined}
                onClick={() => setze(i)}
              >
                {b}
              </button>
            );
          })}
        </div>
        <div className="ls-lege-knoepfe">
          <button type="button" className="ls-knopf ls-lege-zurueck" data-zweit="" onClick={zurueck} disabled={!!stand || !wort} aria-label="Letzten Buchstaben zurücknehmen" data-testid="lege-zurueck">
            <Delete size={24} aria-hidden />
          </button>
          {hatFehler ? (
            <p className="ls-strahl-weiter" role="status">
              {stand === "richtig" ? "Genau so!" : "Die richtige Form steht oben."}
            </p>
          ) : (
            <button type="button" className="ls-knopf ls-los ls-pruefen" disabled={!wort || !!stand} onClick={() => pruefe(wort)} data-testid="lege-pruefen">
              Prüfen
            </button>
          )}
        </div>
      </div>
    </>
  );
}
