import type { PageGeometry } from "@/lib/druckblatt/rendering/geometry";
import { cssMm } from "@/lib/druckblatt/units";

/**
 * Die `@page`-Regel zur Laufzeit.
 *
 * `@page` lässt sich nicht über CSS-Variablen steuern, das Papierformat hängt aber
 * an der Definition (A4, A5, US Letter, hoch oder quer). Deshalb dieser eine,
 * bewusst kleine Ausbruch aus der statischen Stylesheet-Welt — dieselbe Bauart wie
 * `PageStyle` in `components/arbeitsblatt/Sheet.tsx`.
 *
 * `margin: 0` ist die Kernaussage: Der Browser soll keine eigenen Ränder setzen.
 * Das erledigt der Satzspiegel im Blatt, denn nur so kann die Vorschau
 * geometrisch identisch mit dem Ausdruck sein.
 *
 * Die Werte kommen aus der Geometrie des Layoutmodells — also aus denselben
 * Millimetern wie das Blatt selbst.
 */
export function PrintPageRule({ geometry }: { readonly geometry: PageGeometry }) {
  return (
    <style>{`@page { size: ${cssMm(geometry.pageWidth)} ${cssMm(geometry.pageHeight)}; margin: 0; }`}</style>
  );
}
