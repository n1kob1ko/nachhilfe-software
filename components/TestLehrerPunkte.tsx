"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { testLehrerPunkteAction } from "@/app/eigene-test-actions";

/**
 * Punkte der Lehrkraft für eine offene Frage eines eigenen Tests (lib/eigene-tests.ts). Sie gelten vor der
 * Selbstbewertung des Schülers; „Zurücknehmen“ lässt wieder die des Schülers gelten.
 */
export function TestLehrerPunkte({ abgabeId, frage, max, lehrer }: { abgabeId: number; frage: string; max: number; lehrer: number | null }) {
  const [wert, setWert] = useState<number | null>(lehrer);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const router = useRouter();
  const setze = (p: number | null) => {
    const vorher = wert;
    setWert(p);
    setFehler(null);
    starte(async () => {
      const r = await testLehrerPunkteAction(abgabeId, frage, p);
      if (r.fehler) {
        setFehler(r.fehler);
        setWert(vorher);
      } else router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-[15px]" data-testid={`lehrer-punkte-${frage}`}>
      <span className="w-full font-semibold sm:w-auto">Deine Punkte:</span>
      {Array.from({ length: max + 1 }, (_, p) => (
        <button
          key={p}
          type="button"
          disabled={laeuft}
          onClick={() => setze(p)}
          aria-pressed={wert === p}
          className={`num min-h-[44px] min-w-[48px] rounded-xl border-[1.5px] px-3 font-semibold ${wert === p ? "border-accent bg-accent text-on-fill" : "border-accent bg-surface text-accent"}`}
        >
          {p}
        </button>
      ))}
      {wert !== null && (
        <button type="button" className="btn btn-ghost btn-sm" disabled={laeuft} onClick={() => setze(null)}>
          Zurücknehmen
        </button>
      )}
      {fehler && (
        <span className="w-full text-[14px] text-red" role="alert">
          {fehler}
        </span>
      )}
    </div>
  );
}
