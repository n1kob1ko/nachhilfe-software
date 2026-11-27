"use client";

import { Eye, Lightbulb, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { LERNWORT_MAX, lernwortStimmt, lernwortVergleich } from "@/lib/lernwoerter-text";
import type { SpielKarte } from "@/lib/lernspiele-typen";
import { KartenInhalt, type Stand } from "./KartenInhalt";
import { Funken, vibriere } from "./SpielTeile";
import "./bioschreib.css";
import "./lernwort.css";

/**
 * Lernwörter (lib/lernwoerter.ts; niko 2026-11-27: „das Wort wird vorgelesen und das Kind schreibt es“).
 *
 * 1. **Anschauen** (neu oder zuletzt falsch, `karte.lernwort.zeigen`): das Wort steht groß da, im Satz markiert, und
 *    wird vorgelesen. Mit „Gemerkt“ verschwindet es.
 * 2. **Schreiben**: der Satz mit Lücke, das Wort wird vorgelesen (🔊 noch einmal), das Kind schreibt es. War das Wort
 *    zuletzt richtig, beginnt die Karte hier: nur hören, wie beim Diktat. „Zeig mir das Wort“ hilft, wenn man nichts hört.
 *
 * Geprüft wird jeder Buchstabe, auch groß und klein. Falsch: das richtige Wort steht da, die falschen Buchstaben rot,
 * dazu woran man denken muss; weiter geht es erst, wenn es richtig geschrieben ist (die Karte kommt später noch einmal,
 * Lernspiel.tsx). Ohne deutsche Stimme im Gerät wird jedes Wort zuerst gezeigt.
 */
export function LernwortFeld({
  karte,
  onPruefe,
  onWeiter,
}: {
  karte: SpielKarte;
  /** `karte.richtig`, wenn es stimmt, sonst das Geschriebene */
  onPruefe: (wahl: string) => boolean;
  /** die Karte ist fertig; `sauber`: beim ersten Versuch richtig */
  onWeiter: (sauber: boolean) => void;
}) {
  const stimme = useDeutscheStimme();
  const zeigen = karte.lernwort?.zeigen !== false || stimme === null;
  const [phase, setPhase] = useState<"anschauen" | "schreiben">(zeigen ? "anschauen" : "schreiben");
  const [eingabe, setEingabe] = useState("");
  const [fertig, setFertig] = useState(false);
  // nach dem ersten Fehler: das richtige Wort steht da und muss abgeschrieben werden
  const [fehler, setFehler] = useState<string | null>(null);
  const [wackeln, setWackeln] = useState(0);
  const feld = useRef<HTMLInputElement | null>(null);
  const blatt = useRef<HTMLDivElement | null>(null);
  const gesprochen = useRef("");

  const vorlesen = useCallback(() => {
    if (!stimme) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(karte.richtig);
      u.voice = stimme;
      u.lang = stimme.lang;
      u.rate = 0.8;
      speechSynthesis.speak(u);
    } catch {
      // kein Vorlesen möglich: das Wort steht ohnehin da oder lässt sich zeigen
    }
  }, [stimme, karte.richtig]);

  // ohne Stimme (noch nicht geladen oder keine deutsche): zuerst anschauen
  useEffect(() => {
    if (stimme === null && phase === "schreiben" && !fehler && !eingabe) setPhase("anschauen");
  }, [stimme, phase, fehler, eingabe]);

  // jede Phase liest das Wort einmal vor, sobald eine Stimme da ist
  useEffect(() => {
    const schluessel = `${phase}`;
    if (!stimme || gesprochen.current === schluessel) return;
    gesprochen.current = schluessel;
    vorlesen();
  }, [phase, stimme, vorlesen]);

  useEffect(() => {
    if (phase === "schreiben") feld.current?.focus({ preventScroll: true });
  }, [phase, stimme]);

  useEffect(() => () => {
    try {
      speechSynthesis.cancel();
    } catch {}
  }, []);

  // richtig: kurz zeigen, dann weiter
  useEffect(() => {
    if (!fertig) return;
    const t = setTimeout(() => onWeiter(!fehler), fehler ? 650 : 800);
    return () => clearTimeout(t);
  }, [fertig, fehler, onWeiter]);

  const schuettle = () => {
    vibriere([28, 40, 28]);
    setWackeln((n) => n + 1);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      blatt.current?.animate?.([{ translate: "0" }, { translate: "-7px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "0" }], { duration: 360, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
  };

  const abschicken = (e: FormEvent) => {
    e.preventDefault();
    const text = eingabe.trim();
    if (!text || fertig) return;
    const stimmt = lernwortStimmt(text, karte.richtig);
    if (fehler !== null) {
      // jetzt zählt nichts mehr: nur das richtige Wort führt weiter
      if (!stimmt) return schuettle();
      vibriere(12);
      setFertig(true);
      return;
    }
    if (!stimmt) {
      onPruefe(text);
      schuettle();
      setFehler(text);
      setEingabe("");
      feld.current?.focus({ preventScroll: true });
      return;
    }
    onPruefe(karte.richtig);
    vibriere(12);
    setFertig(true);
  };

  // ein Diktat-Wort, solange noch offen ist, ob vorgelesen werden kann: kurz nur das leere Blatt (kein Wort verraten)
  if (stimme === undefined && !zeigen && fehler === null)
    return (
      <>
        <p className="ls-auftrag">Hör gut zu und schreib das Wort.</p>
        <div className="ls-reihe ls-schreibfeld">
          <div className="ls-satzblatt ls-kachelblatt lw-blatt" aria-busy="true" />
        </div>
      </>
    );

  const hoerKnopf = stimme ? (
    <button type="button" className="lw-hoeren treffer" onClick={vorlesen} aria-label="Wort anhören" data-testid="lw-hoeren">
      <Volume2 size={26} aria-hidden />
    </button>
  ) : null;

  if (phase === "anschauen") {
    return (
      <>
        <p className="ls-auftrag">Schau dir das Wort genau an.</p>
        <div className="ls-reihe ls-schreibfeld">
          <div className="ls-satzblatt ls-kachelblatt lw-blatt" data-testid="lw-anschauen">
            <div className="lw-wortzeile">
              <p className="lw-wort" lang="de" data-testid="lw-wort">
                {karte.richtig}
              </p>
              {hoerKnopf}
            </div>
            {karte.loesung !== karte.richtig && (
              <p className="ls-satz lw-satz">
                {karte.vor}
                <mark className="lw-markiert">{karte.richtig}</mark>
                {karte.nach}
              </p>
            )}
            {karte.regel && <p className="lw-regel">{karte.regel}</p>}
          </div>
          <div className="ls-reihe-mitte" />
          <button type="button" className="ls-knopf ls-los lw-gemerkt" onClick={() => setPhase("schreiben")} autoFocus data-testid="lw-gemerkt">
            Gemerkt, jetzt schreiben
          </button>
        </div>
      </>
    );
  }

  const stand: Stand = fertig ? { wahl: karte.richtig, richtig: true } : null;
  return (
    <>
      <p className="ls-auftrag">{fehler !== null && !fertig ? "Schreib das Wort jetzt richtig ab." : zeigen ? "Schreib das Wort." : "Hör gut zu und schreib das Wort."}</p>
      <div className="ls-reihe ls-schreibfeld">
        <div ref={blatt} className="ls-satzblatt ls-kachelblatt lw-blatt" data-stand={fertig ? "richtig" : undefined} data-knapp={fehler !== null ? "" : undefined} data-testid="lw-blatt">
          <div className="lw-wortzeile">
            <div className="ls-kachel-satz" key={`w${wackeln}`}>
              <KartenInhalt karte={karte} stand={stand} probe={fertig ? undefined : eingabe.trim() || undefined} />
            </div>
            {hoerKnopf}
          </div>
          {fertig && fehler === null && <Funken />}
        </div>

        <form className="bs-schreiben" onSubmit={abschicken}>
          <input
            ref={feld}
            className="bs-feld"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            disabled={fertig}
            data-ok={fertig ? "" : undefined}
            placeholder={fehler !== null ? karte.richtig : "Dein Wort"}
            aria-label="Dein Wort"
            lang="de"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={LERNWORT_MAX + 10}
            data-testid="lw-feld"
          />
          {!fertig && (
            <div className="bs-knoepfe">
              {fehler === null && !zeigen ? (
                <button type="button" className="ls-knopf" data-zweit="" onClick={() => setPhase("anschauen")} data-testid="lw-zeigen">
                  <Eye size={18} className="mr-1.5" aria-hidden /> Zeig es mir
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="ls-knopf ls-los" disabled={!eingabe.trim()} data-testid="lw-fertig">
                Fertig
              </button>
            </div>
          )}
        </form>

        <div className="ls-reihe-mitte">
          {fehler !== null && !fertig && (
            <div className="ls-regel ls-regel-frei" role="status" data-testid="lw-hilfe">
              <p className="ls-regel-kopf">
                <Lightbulb size={16} aria-hidden /> Fast! So schreibt man es
              </p>
              <p className="lw-vergleich" lang="de" data-testid="lw-richtig">
                {lernwortVergleich(karte.richtig, fehler).map((b, i) => (
                  <span key={i} data-falsch={b.falsch ? "" : undefined}>
                    {b.z}
                  </span>
                ))}
              </p>
              <p className="ls-regel-text">
                Du hast <s>{fehler}</s> geschrieben. {karte.regel}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Eine deutsche Stimme zum Vorlesen (österreichisch, wenn es eine gibt). `undefined`: wird noch gesucht (die Stimmen
 * kommen in manchen Browsern erst nach einem Moment); `null`: keine da.
 */
function useDeutscheStimme(): SpeechSynthesisVoice | null | undefined {
  const [stimme, setStimme] = useState<SpeechSynthesisVoice | null | undefined>(undefined);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStimme(null);
      return;
    }
    const suche = () => {
      const alle = speechSynthesis.getVoices();
      const de = alle.filter((v) => v.lang?.toLowerCase().startsWith("de"));
      return de.find((v) => v.lang.toLowerCase() === "de-at") ?? de.find((v) => v.lang.toLowerCase() === "de-de" && v.localService) ?? de[0] ?? null;
    };
    const gefunden = suche();
    if (gefunden) {
      setStimme(gefunden);
      return;
    }
    const neu = () => {
      const v = suche();
      if (v) setStimme(v);
    };
    speechSynthesis.addEventListener?.("voiceschanged", neu);
    // nach einer Weile ohne Stimme: ohne Vorlesen spielen
    const t = setTimeout(() => setStimme((s) => (s === undefined ? null : s)), 1200);
    return () => {
      speechSynthesis.removeEventListener?.("voiceschanged", neu);
      clearTimeout(t);
    };
  }, []);
  return stimme;
}
