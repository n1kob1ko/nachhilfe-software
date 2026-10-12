import { CONSTRAINTS, clamp } from "../definition/constraints";

/**
 * Der Vorschau-Zoom — flüchtiger Oberflächenzustand, den jeder Blattgenerator
 * braucht.
 *
 * Bewusst getrennt von der Definition und nicht Teil des Dokuments: Der
 * Zoomfaktor der letzten Sitzung gehört nicht in eine gespeicherte Vorlage.
 *
 * Die Rechnung selbst ist rein und steht deshalb hier statt in einer Komponente —
 * „wie groß muss das Blatt auf diesem Schirm sein“ ist eine Umrechnung von
 * Millimetern in Bildpunkte und keine Gestaltungsfrage.
 */

/** CSS-Referenz: 96 Bildpunkte je Zoll, 25,4 mm je Zoll. */
export const PX_PER_MM = 96 / 25.4;

/** Rand, der beim Einpassen frei bleibt, damit das Blatt nicht klebt. */
export const FIT_PADDING_PX = 48;

/** 1 = Originalgröße (1 mm des Blattes = 1 mm auf dem Schirm). */
export const ZOOM_MIN = CONSTRAINTS.zoom.min;
export const ZOOM_MAX = CONSTRAINTS.zoom.max;
export const ZOOM_STEP = CONSTRAINTS.zoom.step;

export const begrenzeZoom = (faktor: number): number => clamp(faktor, "zoom");

/**
 * Faktor, bei dem ein Blatt der Breite `seiteMm` in `breitePx` passt.
 *
 * `null` heißt: nicht messbar (kein Behälter, Blattbreite 0, etwa in einem
 * versteckten Reiter). Der Aufrufer lässt den Zoom dann stehen, statt ihn auf
 * einen Wert zu setzen, der nichts mit dem Bildschirm zu tun hat.
 */
export function zoomFuerBreite(breitePx: number, seiteMm: number): number | null {
  if (!Number.isFinite(breitePx) || !Number.isFinite(seiteMm) || breitePx <= 0 || seiteMm <= 0) return null;
  return begrenzeZoom((breitePx - FIT_PADDING_PX) / (seiteMm * PX_PER_MM));
}
