"use client";

import { FlaskConical } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { pruefeGeschrieben } from "@/lib/biolabor";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { Funken, vibriere } from "./SpielTeile";
import "./bioschreib.css";

/**
 * Eine Biolabor-Frage zum Selbstschreiben im Blockwerk (niko 2026-11-23: „beim test kein ankreuzen … sie muss die
 * antwort schreiben“). Oben die Frage, darunter das Feld; geprüft wird wie im Biolabor „Wie im Test“
 * (lib/biolabor.ts `pruefeGeschrieben`: Groß/klein, Artikel und Umlaute egal, ein Buchstabe daneben ist „fast“ und
 * zählt als gewusst).
 *
 * - Richtig: das Feld wird grün, die neuen Teile kommen.
 * - Fast: zählt, die richtige Schreibung steht da, weiter mit „Weiter“.
 * - Falsch oder „Weiß ich nicht“: die richtige Antwort und der Merksatz stehen da, weiter mit „Weiter“; die Frage
 *   kommt drei Karten später noch einmal (Lernspiel.tsx).
 *
 * Gezählt wird der erste Versuch; das macht Lernspiel.tsx (`onPruefe`).
 */
export function BioSchreibFeld({
  karte,
  onPruefe,
  onWeiter,
}: {
  karte: SpielKarte;
  /** `karte.richtig`, wenn es stimmt, sonst das Geschriebene; zurück kommt, ob es stimmt */
  onPruefe: (wahl: string) => boolean;
  /** die Karte ist fertig; `sauber`: beim ersten Versuch richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const daten = karte.bio;
  const [eingabe, setEingabe] = useState("");
  const [stand, setStand] = useState<{ art: "richtig" | "fast" | "falsch"; text: string } | null>(null);
  const feld = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    feld.current?.focus({ preventScroll: true });
  }, []);

  // richtig: kurz zeigen, dann weiter
  useEffect(() => {
    if (stand?.art !== "richtig") return;
    const t = setTimeout(() => onWeiter(true), 750);
    return () => clearTimeout(t);
  }, [stand, onWeiter]);

  const antworte = (text: string) => {
    if (stand) return;
    const r = text ? pruefeGeschrieben(text, [karte.richtig, ...(daten?.auch ?? [])]) : "falsch";
    if (r === "falsch") {
      onPruefe(text);
      vibriere([28, 40, 28]);
    } else {
      onPruefe(karte.richtig);
      vibriere(12);
    }
    setStand({ art: r, text });
  };
  const pruefen = (e: FormEvent) => {
    e.preventDefault();
    const text = eingabe.trim();
    if (text) antworte(text);
  };

  return (
    <>
      <p className="ls-auftrag">Schreib die Antwort selbst, wie im Test.</p>
      <div className="ls-reihe">
        <div className="ls-satzblatt bs-blatt" data-stand={stand ? (stand.art === "falsch" ? "falsch" : "richtig") : undefined} data-knapp={stand && stand.art !== "richtig" ? "" : undefined} data-testid="bio-block-frage">
          {daten?.ueber && <p className="bs-ueber">{daten.ueber}</p>}
          <p className="bs-frage" data-lang={(daten?.frage.length ?? 0) > 110 ? "" : undefined}>
            {daten?.frage ?? karte.loesung}
          </p>
          {stand?.art === "richtig" && <Funken />}
        </div>

        <form className="bs-schreiben" onSubmit={pruefen}>
          <input
            ref={feld}
            className="bs-feld"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            disabled={!!stand}
            data-ok={stand ? (stand.art === "falsch" ? "nein" : "") : undefined}
            placeholder="Deine Antwort"
            aria-label="Deine Antwort"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={60}
            data-testid="bio-block-feld"
          />
          {!stand && (
            <div className="bs-knoepfe">
              <button type="button" className="ls-knopf" data-zweit="" onClick={() => antworte("")} data-testid="bio-block-weiss-nicht">
                Weiß ich nicht
              </button>
              <button type="submit" className="ls-knopf ls-los" disabled={!eingabe.trim()} data-testid="bio-block-pruefen">
                Fertig
              </button>
            </div>
          )}
        </form>

        <div className="ls-reihe-mitte">
          {stand && stand.art !== "richtig" && (
            <div className="ls-regel ls-regel-frei" role="status" data-testid="bio-block-hilfe">
              <p className="ls-regel-kopf">
                <FlaskConical size={16} aria-hidden /> {stand.art === "fast" ? "Fast! Achte auf die Schreibung" : stand.text ? "Nicht ganz. Richtig ist" : "So heißt es"}
              </p>
              <p className="ls-regel-loesung">
                <b className="ls-richtig" data-testid="bio-block-richtig">
                  {karte.richtig}
                </b>
              </p>
              {stand.art === "falsch" && karte.regel && <p className="ls-regel-text">{karte.regel}</p>}
              <button type="button" className="ls-knopf ls-los mt-3 w-full" onClick={() => onWeiter(stand.art === "fast")} autoFocus data-testid="bio-block-weiter">
                Weiter
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
