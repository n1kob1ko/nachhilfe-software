"use client";

import { Lightbulb } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { MathText } from "@/components/MathText";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { Funken, vibriere } from "./SpielTeile";

/**
 * Das Spielfeld von „Zahlenstrahl“ (lib/lernspiele-strahl.ts): oben die gesuchte Zahl, darunter der Zahlenstrahl. Die
 * Zahlen stehen über den Teilstrichen, der Zeiger hängt darunter, damit der Finger nichts verdeckt. Irgendwo auf den
 * Strahl tippen oder ziehen setzt den Zeiger auf den nächsten Teilstrich (am Laptop die Pfeiltasten), „Prüfen“ zählt.
 *
 * - Richtig: der Zeiger wird grün, über dem Teilstrich steht die Zahl, die nächste Karte kommt.
 * - Falsch: der Zeiger wird rot, die richtige Stelle bekommt ein grünes Fähnchen, darunter steht, welche Zahl getroffen
 *   wurde, und der Weg. Weiter geht es, wenn der Zeiger an der richtigen Stelle sitzt (wie bei den Kisten: erst mit der
 *   richtigen Antwort).
 *
 * Welche Zahl unter dem Zeiger liegt, steht vor dem Prüfen nirgends: das abzulesen ist die Aufgabe. Gezählt wird das
 * erste Prüfen je Karte; das macht Lernspiel.tsx (`onPruefe`).
 */
export function StrahlFeld({
  karte,
  auftrag,
  onPruefe,
  onWeiter,
}: {
  karte: SpielKarte;
  auftrag: string;
  /** die Nummer des Teilstrichs unter dem Zeiger; zurück kommt, ob sie stimmt */
  onPruefe: (wahl: string) => boolean;
  /** der Zeiger sitzt richtig und die Karte ist fertig; `sauber`: beim ersten Prüfen richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const strahl = karte.strahl ?? { werte: [], beschriftet: [] };
  const n = Math.max(1, strahl.werte.length - 1);
  const ziel = Number(karte.richtig);
  const [bei, setBei] = useState<number | null>(null);
  const [stand, setStand] = useState<"richtig" | "falsch" | null>(null);
  // nach einem Fehler: der Teilstrich, der geprüft wurde (bleibt stehen, bis die Karte fertig ist)
  const [daneben, setDaneben] = useState<number | null>(null);
  const [breite, setBreite] = useState(0);
  const bahn = useRef<HTMLDivElement | null>(null);
  const zeiger = useRef<HTMLSpanElement | null>(null);
  const zieht = useRef(false);
  const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // die Breite der Bahn in Pixeln: der Zeiger wandert über transform
  useLayoutEffect(() => {
    const el = bahn.current;
    if (!el) return;
    const miss = () => setBreite(el.getBoundingClientRect().width);
    miss();
    const ro = new ResizeObserver(miss);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pruefe = useCallback(
    (i: number) => {
      if (stand) return;
      if (onPruefe(String(i))) {
        vibriere(12);
        setStand("richtig");
        return;
      }
      vibriere([28, 40, 28]);
      setDaneben(i);
      setStand("falsch");
      if (!ruhig()) zeiger.current?.animate?.([{ rotate: "0deg" }, { rotate: "-9deg" }, { rotate: "7deg" }, { rotate: "-4deg" }, { rotate: "0deg" }], { duration: 420, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
    },
    [onPruefe, stand],
  );

  // nach dem Prüfen: richtig → weiter; falsch → der Zeiger wird wieder frei, die richtige Stelle bleibt markiert
  useEffect(() => {
    if (stand === "richtig") {
      const t = setTimeout(() => onWeiter(daneben === null), daneben === null ? 850 : 650);
      return () => clearTimeout(t);
    }
    if (stand === "falsch") {
      const t = setTimeout(() => setStand(null), 900);
      return () => clearTimeout(t);
    }
    // läuft einmal je Prüfung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand]);

  const setze = useCallback(
    (i: number) => {
      const neu = Math.max(0, Math.min(n, i));
      setBei((alt) => {
        if (alt !== neu) vibriere(3);
        return neu;
      });
      return neu;
    },
    [n],
  );
  const strichBei = (clientX: number) => {
    const r = bahn.current?.getBoundingClientRect();
    return r && r.width > 0 ? Math.round(((clientX - r.left) / r.width) * n) : 0;
  };
  // nach einem Fehler reicht es, den Zeiger an die richtige Stelle zu setzen
  const gesetzt = (i: number) => {
    if (daneben !== null && i === ziel) pruefe(i);
  };

  const runter = (e: PointerEvent<HTMLDivElement>) => {
    if (stand) return;
    zieht.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setze(strichBei(e.clientX));
  };
  const weiter = (e: PointerEvent<HTMLDivElement>) => {
    if (zieht.current && !stand) setze(strichBei(e.clientX));
  };
  const hoch = (e: PointerEvent<HTMLDivElement>) => {
    if (!zieht.current) return;
    zieht.current = false;
    if (!stand) gesetzt(setze(strichBei(e.clientX)));
  };

  // am Laptop: Pfeiltasten schieben den Zeiger, die Eingabetaste prüft
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || stand) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const neu = setze((bei ?? Math.round(n / 2)) + (bei === null ? 0 : e.key === "ArrowLeft" ? -1 : 1));
        gesetzt(neu);
      } else if (e.key === "Enter" && bei !== null && daneben === null) {
        e.preventDefault();
        pruefe(bei);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `gesetzt` hängt an denselben Werten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bei, stand, daneben, n, setze, pruefe]);

  const ort = bei ?? Math.round(n / 2);
  const x = (i: number) => `${(i / n) * 100}%`;
  // lange Zahlen am Rand brauchen Platz: der Strahl rückt ein, die Schrift wird kleiner
  const laengste = Math.max(0, ...strahl.beschriftet.map((i) => (strahl.werte[i] ?? "").length));
  const rand = Math.round(Math.max(18, Math.min(36, laengste * 3.7)));
  // der Abstand der Zahlen am Strahl: jeder zweite beschriftete Strich ist der lange in der Mitte
  const schritt = strahl.beschriftet.length > 1 ? strahl.beschriftet[1] - strahl.beschriftet[0] : n;
  const fahne = stand === "richtig" || daneben !== null;
  const zeigerStand = stand ?? (bei === null ? "leer" : undefined);

  return (
    <>
      <p className="ls-auftrag">{auftrag}</p>
      <div className="ls-reihe">
        <div className="ls-satzblatt ls-strahlblatt" data-stand={stand ?? undefined} data-knapp={daneben !== null ? "" : undefined} data-testid="strahl-blatt">
          <p className="ls-strahl-frage">
            <span>Wo liegt</span>
            <b className="ls-strahl-zahl" data-testid="strahl-zahl">
              <MathText text={karte.wort} />
            </b>
          </p>
          <div
            className="ls-strahl"
            data-klein={laengste >= 7 ? "" : undefined}
            style={{ "--rand": `${rand}px` } as CSSProperties}
            role="slider"
            tabIndex={0}
            aria-label="Zeiger am Zahlenstrahl"
            aria-valuemin={1}
            aria-valuemax={n + 1}
            aria-valuenow={ort + 1}
            aria-valuetext={bei === null ? "noch nicht gesetzt" : `Teilstrich ${ort + 1} von ${n + 1}`}
            onPointerDown={runter}
            onPointerMove={weiter}
            onPointerUp={hoch}
            onPointerCancel={hoch}
            data-testid="strahl"
          >
            <div ref={bahn} className="ls-strahl-bahn">
              <span className="ls-strahl-linie" data-beide={strahl.beide ? "" : undefined} aria-hidden />
              {strahl.werte.map((w, i) => {
                const zahl = strahl.beschriftet.includes(i);
                return (
                  <span
                    key={i}
                    className="ls-strich"
                    data-art={zahl ? "zahl" : schritt >= 4 && schritt % 2 === 0 && (i - strahl.beschriftet[0]) % (schritt / 2) === 0 ? "mitte" : undefined}
                    data-ziel={fahne && i === ziel ? "" : undefined}
                    data-wahl={bei === i && !fahne ? "" : undefined}
                    style={{ left: x(i) }}
                    aria-hidden
                  >
                    {zahl && (
                      <span className="ls-strich-zahl">
                        <MathText text={w} />
                      </span>
                    )}
                  </span>
                );
              })}
              {fahne && (
                <span className="ls-fahne" style={{ left: x(ziel) }} data-testid="strahl-fahne">
                  <b>
                    <MathText text={strahl.werte[ziel]} />
                  </b>
                </span>
              )}
              <span
                ref={zeiger}
                className="ls-zeiger"
                data-stand={zeigerStand}
                style={{ transform: `translateX(${(breite * ort) / n}px)` }}
                aria-hidden
              >
                <i />
              </span>
            </div>
          </div>
          {stand === "richtig" && daneben === null && <Funken />}
        </div>

        {/* in der Mitte: nach einem Fehler, welche Zahl getroffen wurde, und der Weg zur richtigen */}
        <div className="ls-reihe-mitte ls-strahl-mitte">
          {daneben !== null && stand !== "richtig" && (
            <div className="ls-regel ls-regel-frei ls-regel-strahl" role="status">
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden />
                <span>
                  Fast! Das war{" "}
                  <b>
                    <MathText text={strahl.werte[daneben]} />
                  </b>
                  {karte.tipps?.[String(daneben)] ? `. ${karte.tipps[String(daneben)]}.` : "."}
                </span>
              </p>
              <p className="ls-regel-text" data-mathe="">
                <MathText text={karte.regel} />
              </p>
            </div>
          )}
        </div>

        {daneben === null ? (
          <button type="button" className="ls-knopf ls-los ls-pruefen" disabled={bei === null || !!stand} onClick={() => bei !== null && pruefe(bei)} data-testid="strahl-pruefen">
            Prüfen
          </button>
        ) : (
          <p className="ls-strahl-weiter" role="status">
            {stand === "richtig" ? "Genau da!" : "Schieb den Zeiger zur grünen Zahl."}
          </p>
        )}
      </div>
    </>
  );
}
