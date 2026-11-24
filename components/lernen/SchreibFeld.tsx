"use client";

import { Check, Lightbulb, PenLine } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { pruefeKarte, SCHREIB_MAX, schreibAnfang, type SchreibErgebnis } from "@/lib/antwort-schreiben";
import type { SpielArt, SpielKarte } from "@/lib/lernspiele-typen";
import { eingesetzt, gesetzt, KartenInhalt, type Stand } from "./KartenInhalt";
import { Funken, vibriere } from "./SpielTeile";
import "./bioschreib.css";

/**
 * Selbst schreiben statt auswählen (lib/antwort-schreiben.ts; niko 2026-11-24: „mit der zeit kommt es mir so vor als
 * würde man einfach raten“). Oben das Blatt mit dem Satz, was man schreibt, steht gleich in der Lücke; darunter das
 * Feld mit „Weiß ich nicht“ und „Fertig“ (am Laptop die Eingabetaste). Die Tastatur des Handys bleibt offen.
 *
 * - Richtig: das Feld wird grün, die nächste Karte kommt.
 * - Fast (ein Tippfehler): zählt als richtig, die richtige Schreibung steht da, weiter mit „Weiter“.
 * - Falsch oder „Weiß ich nicht“: die richtige Antwort und die Regel stehen da, und weiter geht es erst, wenn sie
 *   geschrieben ist (wie bei den anderen Feldern: erst mit der richtigen Antwort). Die Karte kommt drei Karten später
 *   noch einmal (Lernspiel.tsx).
 *
 * Gezählt wird der erste Versuch: stimmt er (auch „fast“), meldet das Feld genau `karte.richtig`, sonst das Geschriebene.
 */
export function SchreibFeld({
  art,
  karte,
  auftrag,
  onPruefe,
  onWeiter,
}: {
  art: SpielArt;
  karte: SpielKarte;
  auftrag: string;
  /** `karte.richtig`, wenn es stimmt, sonst das Geschriebene; zurück kommt, ob es stimmt */
  onPruefe: (wahl: string) => boolean;
  /** die Karte ist fertig; `sauber`: beim ersten Versuch richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const [eingabe, setEingabe] = useState("");
  const [stand, setStand] = useState<{ art: SchreibErgebnis; text: string } | null>(null);
  // nach dem ersten Fehler: die richtige Antwort steht da und muss geschrieben werden
  const [hatFehler, setHatFehler] = useState(false);
  const [wackeln, setWackeln] = useState(0);
  const feld = useRef<HTMLInputElement | null>(null);
  const blatt = useRef<HTMLDivElement | null>(null);
  const anfang = schreibAnfang(art, karte);
  const richtigText = eingesetzt(karte);

  useEffect(() => {
    feld.current?.focus({ preventScroll: true });
  }, []);

  // richtig: kurz zeigen, dann weiter
  useEffect(() => {
    if (stand?.art !== "richtig") return;
    const t = setTimeout(() => onWeiter(!hatFehler), hatFehler ? 650 : 750);
    return () => clearTimeout(t);
  }, [stand, hatFehler, onWeiter]);

  const schuettle = () => {
    vibriere([28, 40, 28]);
    setWackeln((n) => n + 1);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      blatt.current?.animate?.([{ translate: "0" }, { translate: "-7px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "0" }], { duration: 360, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
  };

  const antworte = (text: string) => {
    if (stand) return;
    const r: SchreibErgebnis = text ? pruefeKarte(art, karte, text) : "falsch";
    if (hatFehler) {
      // jetzt zählt nichts mehr: nur die richtige Antwort führt weiter
      if (r === "falsch") {
        schuettle();
        return;
      }
      vibriere(12);
      setStand({ art: "richtig", text });
      return;
    }
    if (r === "falsch") {
      onPruefe(text);
      schuettle();
      setHatFehler(true);
      setEingabe("");
      feld.current?.focus({ preventScroll: true });
      return;
    }
    onPruefe(karte.richtig);
    vibriere(12);
    setStand({ art: r, text });
  };
  const fertig = (e: FormEvent) => {
    e.preventDefault();
    const text = eingabe.trim();
    if (text) antworte(text);
  };

  const kartenStand: Stand = stand ? { wahl: karte.richtig, richtig: true } : null;
  const probe = eingabe.trim() ? eingabe : anfang && !hatFehler ? `${anfang}…` : undefined;
  return (
    <>
      <p className="ls-auftrag">{hatFehler && stand?.art !== "richtig" ? "Schreib jetzt die richtige Antwort." : auftrag}</p>
      <div className="ls-reihe ls-schreibfeld">
        <div ref={blatt} className="ls-satzblatt ls-kachelblatt" data-stand={stand ? "richtig" : undefined} data-knapp={hatFehler || stand?.art === "fast" ? "" : undefined} data-testid="schreib-blatt">
          {karte.bild && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ls-kachel-bild" src={karte.bild.src} alt={karte.bild.alt} draggable={false} />
          )}
          <div className="ls-kachel-satz" key={`w${wackeln}`}>
            {/* die Lücke zeigt das Geschriebene; nach „fast“ steht dort die richtige Schreibung */}
            <KartenInhalt karte={karte} stand={kartenStand} probe={stand ? undefined : probe} />
          </div>
          {stand?.art === "richtig" && !hatFehler && <Funken />}
        </div>

        <form className="bs-schreiben" onSubmit={fertig}>
          <input
            ref={feld}
            className="bs-feld"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            disabled={!!stand}
            data-ok={stand ? "" : undefined}
            placeholder={hatFehler ? richtigText : anfang ? `Beginnt mit „${anfang}“` : "Deine Antwort"}
            aria-label="Deine Antwort"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={SCHREIB_MAX + 10}
            data-testid="schreib-feld"
          />
          {!stand && (
            <div className="bs-knoepfe">
              <button type="button" className="ls-knopf" data-zweit="" onClick={() => antworte("")} disabled={hatFehler} data-testid="schreib-weiss-nicht">
                Weiß ich nicht
              </button>
              <button type="submit" className="ls-knopf ls-los" disabled={!eingabe.trim()} data-testid="schreib-fertig">
                Fertig
              </button>
            </div>
          )}
        </form>

        <div className="ls-reihe-mitte">
          {stand?.art === "fast" ? (
            <div className="ls-regel ls-regel-frei" role="status" data-testid="schreib-hilfe">
              <p className="ls-regel-kopf">
                <Check size={16} strokeWidth={3} aria-hidden /> Richtig! Achte auf die Schreibung
              </p>
              <p className="ls-regel-loesung">
                <b className="ls-richtig" data-testid="schreib-richtig">
                  {gesetzt(karte, richtigText)}
                </b>
              </p>
              <button type="button" className="ls-knopf ls-los mt-3 w-full" onClick={() => onWeiter(true)} autoFocus data-testid="schreib-weiter">
                Weiter
              </button>
            </div>
          ) : hatFehler && stand?.art !== "richtig" ? (
            <div className="ls-regel ls-regel-frei" role="status" data-testid="schreib-hilfe">
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden /> Fast! Richtig ist
              </p>
              <p className="ls-regel-loesung">
                <b className="ls-richtig" data-testid="schreib-richtig">
                  {gesetzt(karte, richtigText)}
                </b>
              </p>
              {karte.regel && <p className="ls-regel-text">{gesetzt(karte, karte.regel)}</p>}
            </div>
          ) : !stand ? (
            <p className="ls-schreib-tipp">
              <PenLine size={15} aria-hidden /> Selbst geschrieben merkst du es dir besser.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
