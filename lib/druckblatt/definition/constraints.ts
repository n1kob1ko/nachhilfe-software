/**
 * Zulaessige Wertebereiche der Arbeitsblatt-Definition.
 *
 * Zwei Ebenen der Fehlerbehandlung, bewusst getrennt:
 *
 *   Rand (Store/UI)   -> `clamp`: Nutzereingaben werden sanft begrenzt.
 *                        Eine Lehrkraft soll nie einen Absturz sehen, nur
 *                        weil sie beim Tippen kurz "0 Spalten" stehen hat.
 *   Kern (Geometrie)  -> `InvalidGeometryError`: kommt trotzdem ein
 *                        unmoeglicher Wert an, ist das ein Programmierfehler
 *                        und soll laut scheitern, nicht still danebenrechnen.
 */

export interface Range {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const CONSTRAINTS = {
  columns: { min: 1, max: 16, step: 1 },
  /** Punkt. Unter 10pt wird es fuer Leseanfaenger unbrauchbar. */
  fontSize: { min: 10, max: 72, step: 1 },
  lineHeight: { min: 1, max: 3, step: 0.05 },
  letterSpacing: { min: 0, max: 10, step: 0.5 },
  /** Millimeter. */
  rowHeight: { min: 5, max: 100, step: 1 },
  gap: { min: 0, max: 40, step: 1 },
  /** Millimeter. 5mm ist bei den meisten Druckern der nicht bedruckbare Rand. */
  margin: { min: 5, max: 60, step: 1 },
  zoom: { min: 0.25, max: 2, step: 0.05 },

  /* --- Satzbaukasten ------------------------------------------------------ */
  /**
   * Spalten des Satzbaukastens. Enger begrenzt als das Raster der
   * Lesetabelle: Ein Satz aus mehr als fuenf Bausteinen ist fuer die
   * Zielklassenstufe kein Satz mehr, sondern eine Zumutung.
   */
  sentenceColumns: { min: 1, max: 5, step: 1 },
  /** Wie viele Saetze das Kind schreiben soll. 0 heisst: keine Schreibzeilen. */
  writingLines: { min: 0, max: 40, step: 1 },

  /* --- Buchstaben nachmalen ----------------------------------------------- */
  /**
   * Wiederholungen je Uebungszeile, die Vorlage eingerechnet.
   * Unter zwei gaebe es nichts nachzumalen; ueber zwoelf wird jedes Zeichen
   * so schmal, dass die Form nicht mehr zu erkennen ist.
   */
  traceRepeats: { min: 2, max: 12, step: 1 },
  /** Freie Zeilen nach jeder Vorlagenzeile. */
  traceFreeRows: { min: 0, max: 4, step: 1 },
  /**
   * Feinjustierung der Schriftgroesse. 1 = genau ins Mittelband gerechnet.
   * Der Spielraum ist eng gehalten: Wer weiter abweichen muss, hat die
   * falsche x-Hoehe hinterlegt und sollte die korrigieren.
   */
  sizeAdjust: { min: 0.7, max: 1.4, step: 0.05 },
} as const satisfies Record<string, Range>;

export type ConstraintKey = keyof typeof CONSTRAINTS;

/**
 * Begrenzt einen Wert auf den erlaubten Bereich.
 *
 * `NaN` ist keine Groesse und faellt auf `min` zurueck. `Infinity` dagegen hat
 * eine Richtung und wird an das jeweilige Ende geklemmt -- ein Nutzer, der
 * "99999" tippt, will das Maximum, nicht das Minimum.
 */
export function clamp(value: number, key: ConstraintKey): number {
  const { min, max } = CONSTRAINTS[key];
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Wie `clamp`, zusaetzlich auf ganze Zahlen abgerundet. */
export function clampInt(value: number, key: ConstraintKey): number {
  return Math.trunc(clamp(value, key));
}
