import type { CSSProperties } from "react";

/** Kleine Teile, die mehrere Spielfelder der Lernspiele brauchen (Lernspiel.tsx, PaarFeld.tsx). */

export const vibriere = (muster: number | number[]) => {
  try {
    navigator.vibrate?.(muster);
  } catch {
    /* nicht jedes Gerät kann es */
  }
};

/** Funken und „+1“, wenn eine Karte richtig landet (nur Deko, bei weniger Bewegung aus). */
export function Funken() {
  return (
    <span className="ls-funken" aria-hidden>
      <b>+1</b>
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} style={{ "--w": `${i * 45 + (i % 2) * 18}deg`, "--d": `${58 + (i % 3) * 18}px` } as CSSProperties} />
      ))}
    </span>
  );
}
