"use client";

import "@/components/lernen/arena.css";
import { ChevronRight, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { tabletLiveDuellAction, tabletLiveDuellStartenAction } from "@/app/wettspiel-actions";
import { SPIEL_TITEL, type SpielArt } from "@/lib/lernspiele-typen";

/**
 * Live-Duelle am Schüler-Tablet (niko 2026-11-25: „zwei Schüler gleichzeitig, beide am Tablet, kein eigenes Handy“).
 * Wer spielt, sagt das Tablet (app/wettspiel-actions.ts, tabletLiveDuell*). Links sind hier immer <a>, nie next/link:
 * ein Prefetch von /geraet/ansicht würde die Ansicht umschalten.
 */

/** Oben am Tablet: der andere (oder der Lehrer) hat ein Live-Duell gestartet. Fragt alle 3 Sekunden nach. */
export function TabletDuellRuf({ anfang }: { anfang: number | null }) {
  const [id, setId] = useState(anfang);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void tabletLiveDuellAction().then(setId);
    }, 3000);
    return () => clearInterval(t);
  }, []);
  if (!id) return null;
  return (
    <a
      href={`/geraet/ansicht?zu=duell:${id}`}
      className="ar-ruf fixed top-3 left-1/2 z-[70] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2"
      data-testid="tablet-duell-ruf"
    >
      <Swords size={28} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold tracking-wide uppercase opacity-85">Live-Duell</span>
        <span className="block text-[18px] font-bold">Ein Duell wartet auf dich</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[15px] font-bold text-[#1f5fd0]">
        Mitmachen <ChevronRight size={16} aria-hidden />
      </span>
    </a>
  );
}

/** In „Spiele“ am Tablet: den anderen Schüler der Stunde herausfordern. `spiele`: passende zuerst, `mehr`: der Rest. */
export function TabletDuellStart({ gegner, spiele, mehr }: { gegner: string; spiele: SpielArt[]; mehr: SpielArt[] }) {
  const [offen, setOffen] = useState(false);
  const [alle, setAlle] = useState(spiele.length === 0);
  const [art, setArt] = useState<SpielArt | null>(spiele[0] ?? mehr[0] ?? null);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function starten() {
    if (!art) return;
    setSendet(true);
    setFehler(null);
    const r = await tabletLiveDuellStartenAction(art);
    if (!r.ok) {
      setSendet(false);
      return setFehler(r.fehler);
    }
    window.location.href = "/geraet";
  }

  const chip = (s: SpielArt) => (
    <button
      key={s}
      type="button"
      aria-pressed={s === art}
      onClick={() => setArt(s)}
      className={`treffer min-h-[44px] rounded-full px-4 text-[15px] font-semibold ${s === art ? "bg-ink text-surface" : "bg-panel text-ink"}`}
    >
      {SPIEL_TITEL[s]}
    </button>
  );

  if (!offen) {
    return (
      <button type="button" onClick={() => setOffen(true)} className="ar-ruf mb-5 w-full text-left" data-testid="tablet-duell-start">
        <Swords size={28} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold tracking-wide uppercase opacity-85">Live-Duell · 2 Minuten</span>
          <span className="block text-[18px] font-bold">Gegen {gegner} spielen</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[15px] font-bold text-[#1f5fd0]">
          Herausfordern <ChevronRight size={16} aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <div className="panel mb-5 p-5" role="group" aria-label="Live-Duell">
      <p className="flex items-center gap-2 text-[18px] font-semibold">
        <Swords size={20} className="text-accent" aria-hidden /> Live-Duell gegen {gegner}
      </p>
      <p className="mt-1 text-[15px] text-ink-2">Ihr spielt 2 Minuten dieselben Karten. Wer mehr beim ersten Mal richtig hat, gewinnt.</p>
      <p className="mt-4 text-[13px] text-ink-3">Spiel</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {spiele.map(chip)}
        {alle && mehr.map(chip)}
        {!alle && mehr.length > 0 && (
          <button type="button" onClick={() => setAlle(true)} className="treffer min-h-[44px] rounded-full px-4 text-[15px] font-semibold text-ink-2">
            Alle Spiele …
          </button>
        )}
      </div>
      {fehler && (
        <p className="mt-3 text-[15px] text-red" role="alert">
          {fehler}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={() => void starten()} disabled={!art || sendet} data-testid="tablet-duell-los">
          Duell starten
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOffen(false)}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
