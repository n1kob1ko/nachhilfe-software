import "./funkelfeld.css";
import type { Spezial } from "@/lib/funkelfeld";

/**
 * Die Steine von Funkelfeld als Bilder (components/lernen/FunkelFeld.tsx), ohne Zustand: so passen sie auch auf die
 * Kachel im Tab „Spiele“ und auf den Anfang.
 */

export const FORM_NAMEN = ["Kreis", "Raute", "Dreieck", "Quadrat", "Sechseck"];

/** Ein Stein als Bild: die Form in ihrer Farbe mit Licht oben; ein Strahl hat drei helle Linien, ein Funke ist ein Stern. */
export function SteinBild({ f, sp }: { f: number; sp?: Spezial }) {
  if (sp === "funke")
    return (
      <svg viewBox="0 0 40 40" className="ff-bild" aria-hidden>
        <circle cx="20" cy="20" r="15" className="ff-funke-hof" />
        <path d="M20 3 L24.2 15.8 L37 20 L24.2 24.2 L20 37 L15.8 24.2 L3 20 L15.8 15.8 Z" className="ff-funke" />
      </svg>
    );
  return (
    <svg viewBox="0 0 40 40" className="ff-bild" aria-hidden>
      {f === 0 ? (
        <circle cx="20" cy="20" r="14.5" className="ff-form" />
      ) : f === 1 ? (
        <path d="M20 4.5 L35.5 20 L20 35.5 L4.5 20 Z" className="ff-form" />
      ) : f === 2 ? (
        <path d="M20 6 L35 32.5 L5 32.5 Z" className="ff-form" />
      ) : f === 3 ? (
        <rect x="6.5" y="6.5" width="27" height="27" rx="7" className="ff-form" />
      ) : (
        <path d="M20 4.5 L33.5 12.25 L33.5 27.75 L20 35.5 L6.5 27.75 L6.5 12.25 Z" className="ff-form" />
      )}
      <ellipse cx="17" cy="13" rx="6.5" ry="3.6" className="ff-licht" />
      {sp === "reihe" && (
        <g className="ff-streifen">
          <line x1="8" y1="15" x2="32" y2="15" />
          <line x1="6" y1="20" x2="34" y2="20" />
          <line x1="8" y1="25" x2="32" y2="25" />
        </g>
      )}
      {sp === "spalte" && (
        <g className="ff-streifen">
          <line x1="15" y1="8" x2="15" y2="32" />
          <line x1="20" y1="6" x2="20" y2="34" />
          <line x1="25" y1="8" x2="25" y2="32" />
        </g>
      )}
    </svg>
  );
}

/** Ein kleines Feld für den Anfang von Funkelfeld. */
export function MiniFunkel() {
  const reihen = [
    [0, 1, 2, 3],
    [1, 1, 4, 1],
    [3, 2, 0, 4],
  ];
  return (
    <span className="ff-mini">
      {reihen.flatMap((r, i) =>
        r.map((f, j) => (
          <span key={`${i}-${j}`} className="ff-mini-stein" data-f={f} data-an={i === 1 && f === 1 ? "" : undefined}>
            <SteinBild f={f} sp={i === 2 && j === 3 ? "reihe" : undefined} />
          </span>
        )),
      )}
    </span>
  );
}

/** Das Zeichen für Funkelfeld auf dem Knopf: drei Steine. */
export function FunkelZeichen() {
  return (
    <span className="ff-zeichen" aria-hidden>
      {[0, 2, 1].map((f) => (
        <span key={f} data-f={f}>
          <SteinBild f={f} />
        </span>
      ))}
    </span>
  );
}
