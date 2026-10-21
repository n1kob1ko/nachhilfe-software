/**
 * Das Zeichen von MC Dream Education: Doktorhut, goldenes „m“ und das offene Buch darunter, ohne Schrift
 * (`public/brand/mark.png`, aus dem Logo ausgeschnitten), und das ganze Logo mit Schriftzug
 * (`public/brand/logo.png`). Das Buch gehört immer dazu (niko).
 * Bilder statt Icons, weil es das echte Logo des Instituts ist; das App-Symbol im Browser kommt aus
 * `app/icon.png` und `app/apple-icon.png`.
 *
 * Im Dunkelmodus (niko, 21.10.2026: kein weißes Feld hinter dem Logo) kommt die dunkle Fassung
 * `mark-dunkel.png` / `logo-dunkel.png`: Schwarz ist dort Hell, Gold und Rot bleiben. Beide Bilder
 * stehen im HTML, app/globals.css blendet je nach `data-theme` eines aus.
 */

/** Seitenverhältnis des Zeichens (Breite : Höhe). */
const ZEICHEN_VERHAELTNIS = 8000 / 4993;
/** Seitenverhältnis des ganzen Logos (Breite : Höhe). */
const LOGO_VERHAELTNIS = 8000 / 7222;

/** Nur das Zeichen. Neben einem Schriftzug ist es Schmuck (`alt=""`), allein trägt es den Namen. */
export function BrandMark({ height = 40, alleine = false, className = "" }: { height?: number; alleine?: boolean; className?: string }) {
  const w = Math.round(height * ZEICHEN_VERHAELTNIS);
  const alt = alleine ? "MC Dream Education" : "";
  return (
    <>
      <img src="/brand/mark.png" width={w} height={height} alt={alt} className={`marke-hell shrink-0 select-none ${className}`} draggable={false} />
      <img src="/brand/mark-dunkel.png" width={w} height={height} alt={alt} className={`marke-dunkel shrink-0 select-none ${className}`} draggable={false} />
    </>
  );
}

/** Das ganze Logo mit „梦成教育 · MC Dream Education“, z. B. auf der Anmeldeseite und im Druck. */
export function BrandLogo({ width = 220, className = "" }: { width?: number; className?: string }) {
  const h = Math.round(width / LOGO_VERHAELTNIS);
  return (
    <>
      <img src="/brand/logo.png" width={width} height={h} alt="MC Dream Education" className={`marke-hell select-none ${className}`} draggable={false} />
      <img src="/brand/logo-dunkel.png" width={width} height={h} alt="MC Dream Education" className={`marke-dunkel select-none ${className}`} draggable={false} />
    </>
  );
}
