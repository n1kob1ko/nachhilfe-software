"use client";

import { Check, Delete, Lightbulb } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MathText } from "@/components/MathText";
import { tippAnzeige, tippFertig, tippStimmt, tippTaste, tippZiel } from "@/lib/lernspiele-antwort";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { Funken, vibriere } from "./SpielTeile";

/** Welche Tasten der Ziffernblock neben den Ziffern braucht (für alle Karten der Runde gleich, damit nichts springt). */
export type ZiffernTasten = { komma: boolean; minus: boolean; bruch: boolean };

/**
 * Das Spielfeld von „Kopfrechnen“, wenn das Ergebnis eine Zahl ist (lib/lernspiele-antwort.ts): oben das Blatt mit der
 * Rechnung und dem Feld für das Ergebnis, unten beim Daumen ein Ziffernblock. Das Ergebnis wird eingetippt, nicht aus
 * drei Kisten gewählt; der goldene Haken prüft (am Laptop die Ziffern und die Eingabetaste).
 *
 * - Richtig: das Feld wird grün, die nächste Karte kommt.
 * - Falsch: das Feld wird rot, darunter stehen das richtige Ergebnis und der Rechenweg. Weiter geht es, wenn das
 *   richtige Ergebnis im Feld steht (wie bei den Kisten: erst mit der richtigen Antwort).
 *
 * Gezählt wird das erste Prüfen je Karte; das macht Lernspiel.tsx (`onPruefe`).
 */
export function ZiffernFeld({
  karte,
  auftrag,
  tasten,
  onPruefe,
  onWeiter,
}: {
  karte: SpielKarte;
  auftrag: string;
  tasten: ZiffernTasten;
  /** `karte.richtig`, wenn das Getippte stimmt, sonst das Getippte; zurück kommt, ob es stimmt */
  onPruefe: (wahl: string) => boolean;
  /** das richtige Ergebnis steht da und die Karte ist fertig; `sauber`: beim ersten Prüfen richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const ziel = tippZiel(karte.richtig) ?? { wert: karte.richtig, einheit: "", bruch: false };
  const [text, setText] = useState("");
  const [stand, setStand] = useState<"richtig" | "falsch" | null>(null);
  // nach einem Fehler: was zuerst getippt wurde (bleibt stehen, bis die Karte fertig ist)
  const [daneben, setDaneben] = useState<string | null>(null);
  const feld = useRef<HTMLSpanElement | null>(null);
  const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wackle = () => {
    if (!ruhig()) feld.current?.animate?.([{ translate: "0" }, { translate: "-7px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "0" }], { duration: 360, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
  };

  const pruefe = useCallback(() => {
    if (stand || !tippFertig(text)) return;
    const stimmt = tippStimmt(text, ziel);
    // nach dem ersten Fehler zählt nichts mehr: nur das richtige Ergebnis führt weiter
    const ok = daneben === null ? onPruefe(stimmt ? karte.richtig : `${tippAnzeige(text)}${ziel.einheit ? ` ${ziel.einheit}` : ""}`) : stimmt;
    if (ok) {
      vibriere(12);
      setStand("richtig");
      return;
    }
    vibriere([28, 40, 28]);
    setStand("falsch");
    wackle();
    // `ziel` gehört zur Karte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand, text, daneben, onPruefe, karte.richtig]);

  // nach dem Prüfen: richtig → weiter; falsch → das Feld wird wieder frei, Ergebnis und Weg stehen darunter
  useEffect(() => {
    if (stand === "richtig") {
      const t = setTimeout(() => onWeiter(daneben === null), daneben === null ? 750 : 600);
      return () => clearTimeout(t);
    }
    if (stand === "falsch") {
      const t = setTimeout(() => {
        setDaneben((d) => d ?? text);
        setText("");
        setStand(null);
      }, 850);
      return () => clearTimeout(t);
    }
    // läuft einmal je Prüfung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand]);

  const druecke = useCallback(
    (taste: string) => {
      if (stand) return;
      const neu = tippTaste(text, taste);
      if (neu === text) return;
      vibriere(3);
      setText(neu);
      // nach einem Fehler reicht es, das richtige Ergebnis einzutippen
      if (daneben !== null && tippStimmt(neu, ziel)) {
        vibriere(12);
        setStand("richtig");
      }
    },
    // `ziel` gehört zur Karte
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stand, text, daneben, karte.richtig],
  );

  // am Laptop: Ziffern, Komma, Minus, Schrägstrich, Rücktaste und Eingabetaste
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const taste = /^\d$/.test(e.key) ? e.key : e.key === "," || e.key === "." ? (tasten.komma ? "," : "") : e.key === "-" ? (tasten.minus ? "±" : "") : e.key === "/" ? (tasten.bruch ? "/" : "") : e.key === "Backspace" ? "<" : "";
      if (taste) {
        e.preventDefault();
        druecke(taste);
      } else if (e.key === "Enter") {
        e.preventDefault();
        pruefe();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [druecke, pruefe, tasten]);

  const zeile = (t: string): ReactNode => {
    if (!t.includes("/")) return tippAnzeige(t);
    const [z, n] = t.split("/");
    return (
      <>
        {z.startsWith("−") && "−"}
        <span className="frac">
          <span className="frac-num">{z.replace("−", "")}</span>
          <span className="frac-den">{n || " "}</span>
        </span>
      </>
    );
  };
  const taste = (t: string, inhalt: ReactNode = t, o: { name?: string; art?: string; aus?: boolean; testid?: string; breit?: number } = {}) => (
    <button
      key={t}
      type="button"
      className="ls-taste ohne-druck"
      data-art={o.art}
      style={o.breit ? { gridColumn: `span ${o.breit}` } : undefined}
      data-aus={o.aus ? "" : undefined}
      disabled={!!stand || o.aus}
      onClick={() => (t === "ok" ? pruefe() : druecke(t))}
      aria-label={o.name}
      data-testid={o.testid ?? `taste-${t}`}
    >
      {inhalt}
    </button>
  );

  return (
    <>
      <p className="ls-auftrag">{daneben !== null ? "Tipp jetzt das richtige Ergebnis ein." : auftrag}</p>
      <div className="ls-reihe ls-ziffern">
        <div className="ls-satzblatt ls-rechenblatt" data-stand={stand ?? undefined} data-knapp={daneben !== null ? "" : undefined} data-testid="ziffern-blatt">
          <p className="ls-satz" data-mathe="">
            <MathText text={karte.vor.trimEnd()} />{" "}
            <span className="ls-eingabe-zeile">
              <span ref={feld} className="ls-eingabe" data-stand={stand ?? undefined} data-leer={text ? undefined : ""} data-testid="ziffern-feld" aria-live="polite">
                {zeile(text)}
                {!stand && <i className="ls-caret" aria-hidden />}
              </span>
              {ziel.einheit && <span className="ls-einheit">{ziel.einheit}</span>}
            </span>
            {karte.nach && (
              <>
                {" "}
                <MathText text={karte.nach} />
              </>
            )}
          </p>
          {karte.hinweis && <p className="ls-bedeutung">{karte.hinweis}</p>}
          {stand === "richtig" && daneben === null && <Funken />}
        </div>

        {/* in der Mitte: nach einem Fehler das richtige Ergebnis und der Rechenweg */}
        <div className="ls-reihe-mitte ls-ziffern-mitte">
          {daneben !== null && (
            <div className="ls-regel ls-regel-frei ls-regel-ziffern" role="status" data-mathe="">
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden /> Fast! Richtig ist
              </p>
              <p className="ls-regel-loesung">
                <b className="ls-richtig" data-testid="ziffern-richtig">
                  <MathText text={karte.richtig} />
                </b>
              </p>
              <p className="ls-regel-text" data-mathe="">
                <MathText text={karte.regel} />
              </p>
            </div>
          )}
        </div>

        <div className="ls-block" role="group" aria-label="Ziffernblock" data-testid="ziffernblock">
          <div className="ls-block-ziffern">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((z) => taste(z))}
            {/* die Null nimmt den Platz der Tasten, die diese Runde nicht braucht */}
            {tasten.komma && taste(",", ",", { name: "Komma" })}
            {taste("0", "0", { breit: 3 - Number(tasten.komma) - Number(tasten.bruch) })}
            {tasten.bruch && taste("/", <span className="ls-taste-bruch" aria-hidden />, { name: "Bruchstrich" })}
          </div>
          <div className="ls-block-rand">
            {taste("<", <Delete size={24} aria-hidden />, { name: "Löschen", art: "zurueck", aus: !text })}
            {tasten.minus && taste("±", "+/−", { name: "Vorzeichen wechseln", art: "zeichen" })}
            {taste("ok", <Check size={30} strokeWidth={3} aria-hidden />, { name: "Prüfen", art: "ok", aus: !tippFertig(text) || daneben !== null, testid: "ziffern-pruefen" })}
          </div>
        </div>
      </div>
    </>
  );
}
