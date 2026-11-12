"use client";

import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { gesetzt, KartenInhalt, type Stand } from "./KartenInhalt";
import { vibriere } from "./SpielTeile";

/** So weit muss die Karte zur Seite, damit das Loslassen zählt. */
const SCHWELLE = 84;

/**
 * Das Spielfeld für Karten mit zwei Antworten (lib/lernspiele-antwort.ts): „das oder dass?“, „haben oder sein?“,
 * „Hauptsatz oder Gliedsatz?“ und „Teilbar oder nicht?“. Die Karte wird nach links oder rechts gewischt, die erste
 * Antwort liegt links, die zweite rechts. Wischen geht überall auf dem Feld, nicht nur auf der Karte (der Daumen muss
 * nicht nach oben); die zwei Schilder unten lassen sich auch antippen, am Laptop zählen die Pfeiltasten.
 *
 * - Richtig: die Antwort steht grün in der Lücke, die Karte fliegt zu ihrer Seite hinaus, oben steht kurz der ganze
 *   richtige Satz.
 * - Falsch: die Karte kommt zurück, die Wahl steht durchgestrichen in der Lücke, darunter die Regel, das richtige
 *   Schild leuchtet. Weiter geht es erst mit dem Wisch zur richtigen Seite (wie bei den Kisten).
 *
 * Ziehen läuft ohne React-Zustand je Bewegung (nur transform am Element). Gezählt wird die erste Wahl je Karte; das
 * macht Lernspiel.tsx (`onPruefe`).
 */
export function WischFeld({
  karte,
  auftrag,
  rest,
  onPruefe,
  onWeiter,
  children,
}: {
  karte: SpielKarte;
  auftrag: string;
  /** wie viele Karten noch hinter dieser liegen (für den Stapel) */
  rest: number;
  /** die gewählte Antwort; zurück kommt, ob sie stimmt */
  onPruefe: (wahl: string) => boolean;
  /** die Karte ist zur richtigen Seite hinaus; `sauber`: beim ersten Wisch richtig */
  onWeiter: (sauber: boolean) => void;
  /** die Zeile mit dem zuletzt gelösten Satz */
  children?: ReactNode;
}) {
  const [links, rechts] = karte.faecher;
  const [stand, setStand] = useState<Stand>(null);
  const [hatFehler, setHatFehler] = useState(false);
  const [falschGewaehlt, setFalschGewaehlt] = useState<string | null>(null);
  // das Schild, über dem die Karte gerade hängt
  const [ziel, setZiel] = useState<0 | 1 | null>(null);
  const [wackeln, setWackeln] = useState(0);
  const karteEl = useRef<HTMLDivElement | null>(null);
  const zug = useRef<{ id: number; x0: number; y0: number; x: number; t: number; vx: number } | null>(null);
  const zielJetzt = useRef<0 | 1 | null>(null);
  const fertig = useRef(false);
  const fehler = useRef(false);
  const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Die Karte an ihren Platz beim Ziehen; die Stempel werden mit dem Weg deutlicher. */
  const lege = (dx: number, dy: number) => {
    const el = karteEl.current;
    if (!el) return;
    el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px) rotate(${dx * 0.05}deg)` : "";
    el.style.setProperty("--links", String(Math.min(1, Math.max(0, -dx / SCHWELLE))));
    el.style.setProperty("--rechts", String(Math.min(1, Math.max(0, dx / SCHWELLE))));
  };
  const zeige = (neu: 0 | 1 | null) => {
    if (neu === zielJetzt.current) return;
    zielJetzt.current = neu;
    setZiel(neu);
    if (neu !== null) vibriere(3);
  };

  const antworte = useCallback(
    (seite: 0 | 1, von = { x: 0, y: 0 }) => {
      if (fertig.current) return;
      const wahl = karte.faecher[seite];
      // nach dem ersten Fehler zählt nichts mehr: nur die richtige Seite führt weiter
      const ok = fehler.current ? wahl === karte.richtig : onPruefe(wahl);
      const el = karteEl.current;
      zeige(null);
      if (!ok) {
        fehler.current = true;
        vibriere([28, 40, 28]);
        if (el) {
          el.style.transition = "";
          lege(0, 0);
          // wackeln über `rotate` (transform gehört dem Ziehen)
          if (!ruhig() && el.animate) el.animate([{ rotate: "-1.5deg" }, { rotate: "-6deg" }, { rotate: "4deg" }, { rotate: "-3.5deg" }, { rotate: "1deg" }, { rotate: "-1.5deg" }], { duration: 420, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
        }
        setStand({ wahl, richtig: false });
        setFalschGewaehlt(wahl);
        setHatFehler(true);
        setWackeln((n) => n + 1);
        return;
      }
      fertig.current = true;
      vibriere(12);
      setStand({ wahl, richtig: true });
      const sauber = !fehler.current;
      if (!el?.animate) {
        setTimeout(() => onWeiter(sauber), 500);
        return;
      }
      el.style.setProperty("--links", "0");
      el.style.setProperty("--rechts", "0");
      if (ruhig()) {
        lege(0, 0);
        void el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 560, fill: "forwards" }).finished.then(() => onWeiter(sauber));
        return;
      }
      // die Karte fliegt zu ihrer Seite hinaus, die Antwort steht dabei grün in der Lücke (der ganze Satz steht danach
      // oben). Gewischt ist sie schon in Fahrt: ease-out; angetippt bleibt sie einen Augenblick stehen und kippt dann weg.
      const r = seite === 0 ? -1 : 1;
      const weit = r * (window.innerWidth * 0.5 + el.offsetWidth * 0.6);
      const start = { transform: `translate(${von.x}px, ${von.y}px) rotate(${von.x * 0.05}deg)`, opacity: 1 };
      const ende = { transform: `translate(${weit}px, ${von.y - 24}px) rotate(${r * 18}deg)`, opacity: 0 };
      el.style.transition = "none";
      const flug = von.x
        ? el.animate([start, { ...ende, opacity: 0.7 }], { duration: 250, easing: "cubic-bezier(0.33, 0.7, 0.5, 1)", fill: "forwards" })
        : el.animate([start, { ...start, offset: 0.3, easing: "cubic-bezier(0.77, 0, 0.175, 1)" }, ende], { duration: 520, fill: "forwards" });
      void flug.finished.then(() => onWeiter(sauber));
    },
    [karte, onPruefe, onWeiter],
  );

  // ---------- ziehen ----------

  const runter = (e: PointerEvent<HTMLDivElement>) => {
    // die Schilder sind Knöpfe: dort beginnt kein Wisch
    if (fertig.current || zug.current || (e.target as Element).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    zug.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: e.timeStamp, vx: 0 };
    if (karteEl.current) karteEl.current.dataset.zieht = "";
  };
  const bewegt = (e: PointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    if (!z || z.id !== e.pointerId) return;
    const dx = e.clientX - z.x0;
    const dt = e.timeStamp - z.t;
    if (dt > 0) z.vx = 0.6 * z.vx + 0.4 * ((e.clientX - z.x) / dt);
    z.x = e.clientX;
    z.t = e.timeStamp;
    lege(dx, (e.clientY - z.y0) * 0.18);
    zeige(dx <= -SCHWELLE ? 0 : dx >= SCHWELLE ? 1 : null);
  };
  const los = (e: PointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    if (!z || z.id !== e.pointerId) return;
    zug.current = null;
    const el = karteEl.current;
    if (el) delete el.dataset.zieht;
    const dx = e.clientX - z.x0;
    const dy = (e.clientY - z.y0) * 0.18;
    // ein schneller kurzer Wisch zählt auch
    const wurf = e.type === "pointerup" && Math.abs(z.vx) > 0.45 && Math.abs(dx) > 28 && Math.sign(z.vx) === Math.sign(dx);
    if (e.type === "pointerup" && (Math.abs(dx) >= SCHWELLE || wurf)) antworte(dx < 0 ? 0 : 1, { x: dx, y: dy });
    else {
      lege(0, 0);
      zeige(null);
    }
  };

  // am Laptop: Pfeil links und rechts (oder 1 und 2)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const seite = e.key === "ArrowLeft" || e.key === "1" ? 0 : e.key === "ArrowRight" || e.key === "2" ? 1 : null;
      if (seite === null) return;
      e.preventDefault();
      antworte(seite);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [antworte]);

  const falsch = !!stand && !stand.richtig;
  const schild = (seite: 0 | 1) => {
    const f = karte.faecher[seite];
    return (
      <button
        type="button"
        className="ls-wisch-ziel ohne-druck"
        data-seite={seite === 0 ? "links" : "rechts"}
        data-ziel={ziel === seite ? "" : undefined}
        data-zeigen={hatFehler && f === karte.richtig ? "" : undefined}
        data-falsch={hatFehler && f === falschGewaehlt ? "" : undefined}
        onClick={() => antworte(seite)}
        aria-keyshortcuts={seite === 0 ? "ArrowLeft" : "ArrowRight"}
        data-testid={`wisch-${seite === 0 ? "links" : "rechts"}`}
      >
        {seite === 0 && <ChevronLeft size={22} strokeWidth={3} aria-hidden />}
        <span>{gesetzt(karte, f)}</span>
        {seite === 1 && <ChevronRight size={22} strokeWidth={3} aria-hidden />}
      </button>
    );
  };

  return (
    <>
      <p className="ls-auftrag">{hatFehler ? "Wisch jetzt zur richtigen Seite." : auftrag}</p>
      {children}
      <div className="ls-wisch" onPointerDown={runter} onPointerMove={bewegt} onPointerUp={los} onPointerCancel={los} data-testid="wisch-feld">
        <div className="ls-stapel" data-falsch={falsch ? "" : undefined} data-mathe={karte.mathe ? "" : undefined}>
          {rest >= 2 && <div className="ls-karte" data-tiefe="2" aria-hidden />}
          {rest >= 1 && <div className="ls-karte" data-tiefe="1" aria-hidden />}
          <div ref={karteEl} className="ls-karte ls-wischkarte" data-tiefe="0" data-stand={stand ? (stand.richtig ? "richtig" : "falsch") : undefined} data-testid="wisch-karte">
            <KartenInhalt key={`w${wackeln}`} karte={karte} stand={stand} />
            <span className="ls-stempel" data-seite="links" aria-hidden>
              {gesetzt(karte, links)}
            </span>
            <span className="ls-stempel" data-seite="rechts" aria-hidden>
              {gesetzt(karte, rechts)}
            </span>
          </div>

          {falsch && (
            <div className="ls-regel" role="status" data-mathe={karte.mathe ? "" : undefined}>
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden /> Fast! Richtig ist
              </p>
              <p className="ls-regel-loesung">
                <b className="ls-richtig" data-testid="wisch-richtig">
                  {karte.einsatz && karte.einsatz.toLowerCase() !== karte.richtig ? `${karte.richtig} (${karte.einsatz})` : gesetzt(karte, karte.richtig)}
                </b>
              </p>
              <p className="ls-regel-text" data-mathe={karte.mathe ? "" : undefined}>
                {gesetzt(karte, karte.regel)}
              </p>
            </div>
          )}
        </div>

        <div className="ls-wisch-ziele" role="group" aria-label="Antworten">
          {schild(0)}
          {schild(1)}
        </div>
      </div>
    </>
  );
}
