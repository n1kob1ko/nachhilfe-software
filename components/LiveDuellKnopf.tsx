"use client";

import { Swords, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { liveDuellAbbrechenAction, liveDuellStandAction, liveDuellStartenAction } from "@/app/wettspiel-actions";
import type { DuellSicht } from "@/lib/duelle";
import { SPIEL_ARTEN, SPIEL_TITEL, type SpielArt } from "@/lib/lernspiele-typen";

/**
 * Im Unterricht mit zwei Schülern gleichzeitig (D26): ein Live-Duell starten (lib/duelle.ts). Beide sehen es in ihrer
 * Schüler-App, tippen „Bereit“ und spielen 2 Minuten dieselben Karten. Hier steht der Stand (jede 2 Sekunden).
 */
export function LiveDuellKnopf({ aId, bId }: { aId: number; bId: number }) {
  const [offen, setOffen] = useState(false);
  const [art, setArt] = useState<SpielArt>(SPIEL_ARTEN[0]);
  const [stand, setStand] = useState<(DuellSicht & { vonId: number }) | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const holen = useCallback(async () => setStand(await liveDuellStandAction(aId, bId)), [aId, bId]);
  useEffect(() => {
    void holen();
  }, [holen]);
  const laeuft = stand && (stand.status === "offen" || stand.status === "laeuft");
  useEffect(() => {
    if (!laeuft && !offen) return;
    const t = setInterval(() => void holen(), 2000);
    return () => clearInterval(t);
  }, [laeuft, offen, holen]);

  async function starten() {
    setFehler(null);
    const r = await liveDuellStartenAction(aId, bId, art);
    if (!r.ok) return setFehler(r.fehler);
    await holen();
  }

  const zeile = (s: DuellSicht["ich"]) => `${s.name}: ${stand?.status === "offen" ? (s.bereit ? "bereit" : "wartet auf „Bereit“") : `${s.richtig} richtig${s.fertig ? ", fertig" : ""}`}`;
  const rest = stand?.endeAt ? Math.max(0, Math.ceil((stand.endeAt - Date.now()) / 1000)) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-surface px-4 text-[15px] font-semibold text-ink shadow-[var(--shadow-card)] hover:bg-panel"
        data-testid="live-duell-knopf"
      >
        <Swords size={16} aria-hidden /> Live-Duell
        {laeuft && <span className="h-2 w-2 rounded-full bg-amber" aria-label="läuft" />}
      </button>
      {offen && (
        <div className="pop panel absolute top-full left-0 z-30 mt-2 w-[min(360px,calc(100vw-2rem))] p-4 shadow-[var(--shadow-pop,var(--shadow-card))]" role="dialog" aria-label="Live-Duell">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-[15px] font-semibold">Live-Duell, 2 Minuten</p>
            <button type="button" onClick={() => setOffen(false)} aria-label="Schließen" className="text-ink-3">
              <X size={18} aria-hidden />
            </button>
          </div>
          {laeuft && stand ? (
            <div className="mt-2 grid gap-1 text-[15px]">
              <p className="text-ink-2">{SPIEL_TITEL[stand.art]}{stand.status === "laeuft" && rest !== null ? ` · noch ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")}` : ""}</p>
              <p>{zeile(stand.ich)}</p>
              {stand.gegner && <p>{zeile(stand.gegner)}</p>}
              {stand.status === "offen" && <p className="mt-1 text-[13px] text-ink-3">Beide öffnen ihre Schüler-App: dort steht oben „Live-Duell“.</p>}
              <button
                type="button"
                className="btn btn-secondary mt-3 w-fit"
                onClick={() => {
                  void liveDuellAbbrechenAction(stand.id).then(holen);
                }}
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <>
              {stand?.status === "fertig" && stand.gegner && (
                <p className="mt-2 rounded-xl bg-panel px-3 py-2 text-[15px]">
                  Letztes Duell: {stand.ausgang === "gleich" ? "unentschieden" : `${stand.ausgang === "gewonnen" ? stand.ich.name : stand.gegner.name} gewinnt`} {stand.ich.richtig} : {stand.gegner.richtig}
                </p>
              )}
              <p className="mt-3 text-[13px] text-ink-3">Spiel</p>
              <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Spiel">
                {SPIEL_ARTEN.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === art}
                    onClick={() => setArt(s)}
                    className={`treffer min-h-[40px] rounded-full px-3 text-[14px] font-semibold ${s === art ? "bg-ink text-surface" : "bg-panel text-ink"}`}
                  >
                    {SPIEL_TITEL[s]}
                  </button>
                ))}
              </div>
              {fehler && (
                <p className="mt-2 text-[14px] text-red" role="alert">
                  {fehler}
                </p>
              )}
              <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => void starten()}>
                Duell starten
              </button>
              <p className="mt-2 text-[13px] text-ink-3">Gewonnen hat, wer mehr beim ersten Mal richtig hat. Die Runden zählen wie normale Lernspiele.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
