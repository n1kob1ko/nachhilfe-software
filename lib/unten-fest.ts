/**
 * Ausgleich für die Leisten unten am Handy (Lehrer: components/Nav.tsx TabBar, Schüler-App: SchuelerNav).
 *
 * iOS 26 hat einen Fehler mit `position: fixed`: nach dem Tippen in ein Feld (Tastatur auf und wieder zu) und beim
 * Einklappen der Safari-Leiste bleibt der Bereich, an dem fixierte Elemente hängen, verschoben. Die Leiste wandert dann
 * beim Scrollen mit oder bleibt mitten im Bild stehen (niko, 26.11.2026: „Warum bewegt sich der Balken mit“, Video vom
 * Monatsbericht). Apple: WebKit-Bug 297779, Stand Ende 2026 nicht verlässlich behoben.
 *
 * `window.visualViewport` sagt, wo der sichtbare Bereich wirklich ist. Liegt sein unterer Rand nicht dort, wo die
 * Leiste hängt (`innerHeight`), schiebt components/UntenFest.tsx die Leiste um genau diesen Abstand. Nicht beim
 * Schreiben (dann ist die Tastatur offen und die Leiste soll dahinter bleiben) und nicht beim Hineinzoomen.
 */
export type Sichtbar = { offsetTop: number; height: number; scale: number };

/** Pixel, um die die Leiste nach unten (+) oder oben (−) muss; 0 = alles in Ordnung. */
export function versatzUnten(v: Sichtbar, innerHeight: number, schreibt: boolean): number {
  if (schreibt || v.scale > 1.01) return 0;
  const d = Math.round(v.offsetTop + v.height - innerHeight);
  return Math.abs(d) <= 1 ? 0 : d;
}
