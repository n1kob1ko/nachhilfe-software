import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { VERBINDUNG_WEG } from "@/lib/verbindung";

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

/**
 * Die Verbindung ist weg (lib/verbindung.ts): das Spiel hält an und bietet „Neu laden“, statt die letzte Karte immer
 * wieder zu stellen. `onNeuLaden` fehlt: die Seite einfach neu laden.
 */
export function Abriss({ onNeuLaden }: { onNeuLaden?: () => void }) {
  // direkt in die Spielfläche (`.ls`): im Kopf oder einem Feld läge sie unter den Teilen, die danach kommen
  const [ziel, setZiel] = useState<Element | null>(null);
  useEffect(() => setZiel(document.querySelector(".ls") ?? document.body), []);
  if (!ziel) return null;
  return createPortal(
    <div className="ls-abriss" role="alertdialog" aria-modal="true" aria-labelledby="ls-abriss-text" data-testid="verbindung-weg">
      <div className="ls-blatt ls-abriss-karte">
        <p id="ls-abriss-text" className="text-[17px]">
          {VERBINDUNG_WEG}
        </p>
        <button type="button" className="ls-knopf ls-los mt-4 w-full" onClick={onNeuLaden ?? (() => window.location.reload())} autoFocus>
          Neu laden
        </button>
      </div>
    </div>,
    ziel,
  );
}
