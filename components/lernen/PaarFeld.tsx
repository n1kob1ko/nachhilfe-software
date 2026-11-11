"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { bretter, gemischt, nochmalBrett, type SpielKarte } from "@/lib/lernspiele-typen";
import { Funken, vibriere } from "./SpielTeile";

/**
 * Das Spielfeld von „Vokabel-Paare“ (lib/lernspiele-vokabeln.ts): links die englischen Wörter, rechts die deutschen in
 * anderer Reihenfolge. Ein Wort antippen, dann das passende auf der anderen Seite; die Seite ist egal.
 *
 * - Richtig: beide Kärtchen leuchten grün und verschwinden, oben steht das Paar („bridge = die Brücke“).
 * - Falsch: beide wackeln rot und bleiben stehen. Gezählt wird der erste Versuch je englischem Wort.
 * - Eine Runde hat bis zu zwei Bretter mit je höchstens sechs Paaren. Waren Wörter zuerst falsch, kommt zum Schluss
 *   ein Brett „Noch einmal“ mit ihnen (zählt nicht mehr, übt aber).
 *
 * Wer zählt und speichert, bleibt in Lernspiel.tsx: das Feld meldet nur jeden Versuch, jedes gelöste Paar und das Ende.
 */
export function PaarFeld({
  karten,
  auftrag,
  onVersuch,
  onRichtig,
  onFalsch,
  onFertig,
  children,
}: {
  karten: SpielKarte[];
  auftrag: string;
  /** jeder Versuch: welches deutsche Wort zu welchem englischen getippt wurde */
  onVersuch: (karte: SpielKarte, wahl: string) => void;
  /** ein Paar ist gelöst; `sauber`: ohne falschen Versuch davor */
  onRichtig: (karte: SpielKarte, sauber: boolean) => void;
  onFalsch: () => void;
  onFertig: () => void;
  /** steht zwischen dem Auftrag und dem Brett: die Zeile mit dem letzten Paar */
  children?: ReactNode;
}) {
  const alleBretter = useMemo(() => bretter(karten), [karten]);
  const [brettNr, setBrettNr] = useState(0);
  const [nochmal, setNochmal] = useState<SpielKarte[] | null>(null);
  const brett = nochmal ?? alleBretter[brettNr] ?? [];
  // die deutschen Wörter in anderer Reihenfolge; neu gemischt je Brett
  const rechts = useMemo(() => {
    let r = gemischt(brett, Math.random);
    // nie genau dieselbe Reihenfolge wie links (bei zwei, drei Paaren kommt das sonst vor)
    if (brett.length > 1 && r.every((k, i) => k.key === brett[i].key)) r = [...r.slice(1), r[0]];
    return r;
  }, [brett]);

  const [wahl, setWahl] = useState<{ seite: "en" | "de"; key: string } | null>(null);
  const [weg, setWeg] = useState<Set<string>>(new Set());
  const [gut, setGut] = useState<{ key: string; n: number } | null>(null);
  const [daneben, setDaneben] = useState<{ en: string; de: string; n: number } | null>(null);
  // Wörter, die in der Runde zuerst falsch waren (für das Brett zum Schluss), und die auf diesem Brett falschen
  const falschInRunde = useRef(new Set<string>());
  const falschAufBrett = useRef(new Set<string>());
  const zaehler = useRef(0);
  const fertig = useRef(false);
  const knoepfe = useRef(new Map<string, HTMLButtonElement>());
  const wackle = (id: string) => {
    const el = knoepfe.current.get(id);
    if (!el?.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ rotate: "0deg" }, { rotate: "-3.5deg" }, { rotate: "3deg" }, { rotate: "-2deg" }, { rotate: "0deg" }], { duration: 420, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
  };

  const weiter = useCallback(() => {
    falschAufBrett.current = new Set();
    setWeg(new Set());
    setWahl(null);
    setGut(null);
    setDaneben(null);
    if (!nochmal && brettNr + 1 < alleBretter.length) {
      setBrettNr(brettNr + 1);
      return;
    }
    const schwer = nochmal ? [] : nochmalBrett(karten, falschInRunde.current);
    if (schwer.length) {
      setNochmal(schwer);
      return;
    }
    if (!fertig.current) {
      fertig.current = true;
      onFertig();
    }
  }, [nochmal, brettNr, alleBretter.length, karten, onFertig]);

  // ist das Brett leer, kommt nach einem Atemzug das nächste
  const leer = brett.length > 0 && weg.size >= brett.length;
  useEffect(() => {
    if (!leer) return;
    const t = setTimeout(weiter, 520);
    return () => clearTimeout(t);
  }, [leer, weiter]);

  const pruefe = (en: SpielKarte, de: SpielKarte) => {
    const n = ++zaehler.current;
    onVersuch(en, de.richtig);
    if (en.key === de.key) {
      vibriere(12);
      setGut({ key: en.key, n });
      setWahl(null);
      setDaneben(null);
      onRichtig(en, !nochmal ? !falschInRunde.current.has(en.key) : !falschAufBrett.current.has(en.key));
      // kurz grün stehen lassen, dann weg
      setTimeout(() => setWeg((w) => new Set(w).add(en.key)), 300);
      return;
    }
    vibriere([28, 40, 28]);
    if (!nochmal) falschInRunde.current.add(en.key);
    falschAufBrett.current.add(en.key);
    setDaneben({ en: en.key, de: de.key, n });
    setWahl(null);
    wackle(`en-${en.key}`);
    wackle(`de-${de.key}`);
    // das Rot geht von selbst wieder weg (außer es kam schon der nächste Versuch)
    setTimeout(() => setDaneben((d) => (d?.n === n ? null : d)), 900);
    onFalsch();
  };

  const tippe = (seite: "en" | "de", karte: SpielKarte) => {
    if (weg.has(karte.key) || gut?.key === karte.key) return;
    if (!wahl || wahl.seite === seite) {
      // noch nichts gewählt, oder auf derselben Seite umentschieden (noch einmal antippen nimmt die Wahl zurück)
      setWahl(wahl?.seite === seite && wahl.key === karte.key ? null : { seite, key: karte.key });
      setDaneben(null);
      return;
    }
    const andere = brett.find((k) => k.key === wahl.key);
    if (!andere) return;
    pruefe(seite === "en" ? karte : andere, seite === "en" ? andere : karte);
  };

  const kaertchen = (seite: "en" | "de", karte: SpielKarte, zeile: number) => {
    const text = seite === "en" ? (karte.wort ?? "") : karte.richtig;
    const falsch = daneben && (seite === "en" ? daneben.en : daneben.de) === karte.key;
    const istGut = gut?.key === karte.key;
    const istWeg = weg.has(karte.key);
    return (
      <button
        key={`${seite}-${karte.key}`}
        ref={(el) => {
          if (el) knoepfe.current.set(`${seite}-${karte.key}`, el);
          else knoepfe.current.delete(`${seite}-${karte.key}`);
        }}
        type="button"
        lang={seite}
        className="ls-paar ohne-druck"
        data-seite={seite}
        data-lang={text.length > 20 ? 3 : text.length > 12 ? 2 : 1}
        data-wahl={wahl?.seite === seite && wahl.key === karte.key ? "" : undefined}
        data-stand={istGut ? "richtig" : falsch ? "falsch" : undefined}
        data-weg={istWeg ? "" : undefined}
        disabled={istWeg}
        aria-pressed={wahl?.seite === seite && wahl.key === karte.key}
        style={{ gridColumn: seite === "en" ? 1 : 2, gridRow: zeile + 2, "--n": zeile } as CSSProperties}
        onClick={() => tippe(seite, karte)}
      >
        {text}
        {istGut && seite === "de" && <Funken key={gut.n} />}
      </button>
    );
  };

  return (
    <>
      <p className="ls-auftrag">{nochmal ? "Noch einmal: diese Wörter waren schwer." : auftrag}</p>
      {children}
      {/* key: jedes Brett tritt neu ein */}
      <div className="ls-paare" key={nochmal ? "nochmal" : brettNr} role="group" aria-label="Wortpaare" data-testid="paar-feld">
        <span className="ls-paare-kopf" style={{ gridColumn: 1 }}>
          Englisch
        </span>
        <span className="ls-paare-kopf" style={{ gridColumn: 2 }}>
          Deutsch
        </span>
        {brett.map((k, i) => kaertchen("en", k, i))}
        {rechts.map((k, i) => kaertchen("de", k, i))}
      </div>
    </>
  );
}
