import { mm, scaleMm, type Mm } from '../units';

/**
 * Schullineaturen -- die Linienvorgabe fuer handschriftliche Zeilen.
 *
 * GENERATORUNABHAENGIG. Jedes Blatt, auf dem etwas geschrieben werden soll,
 * braucht das: Satzbaukasten, Schreiblinienblatt, Lueckentext, Diktat. Deshalb
 * liegt es in `rendering/` neben der Seitengeometrie und nicht bei einem
 * Generator.
 *
 * MASSE: DIN 16552-1 „Lineaturen fuer Handschrift" (Mai 2005). Die
 * Lineaturnummern 1 bis 4 entsprechen der Grundschulklasse. Alle Angaben in
 * Millimetern, wie im Handel beschrieben:
 *
 *   Lineatur 0   4 Linien   6 / 6 / 6 mm     Schreiblernheft, 1. Klasse
 *   Lineatur 1   4 Linien   5 / 5 / 5 mm     1. Klasse
 *   Lineatur 2   4 Linien   4 / 4 / 4 mm     2. Klasse
 *   Lineatur 3   2 Linien   3,5 mm           3. Klasse
 *   Lineatur 4   1 Linie    10 mm Abstand    4. Klasse
 *
 * Das Vierliniensystem gibt Schreibanfaengern nicht nur die Grundlinie vor,
 * sondern auch die Hoehe der Buchstaben: Zwischen Mittel- und Grundlinie liegt
 * das Mittelband (a, e, o), darueber die Oberlaenge (h, k, l), darunter die
 * Unterlaenge (g, p, y). Ohne diese Hilfslinien schreiben Erstklaessler
 * Buchstaben in beliebiger Groesse -- deshalb ist eine einzelne Linie fuer die
 * erste Klasse kein Ersatz.
 *
 * Reine Rechnung ohne Zustand. Welche Linie wie DICK oder in welcher FARBE
 * erscheint, entscheidet der Renderer anhand der Rolle -- hier stehen nur
 * Positionen.
 */

export const LINEATUR_IDS = [
  'blanko',
  'lineatur0',
  'lineatur1',
  'lineatur2',
  'lineatur3',
  'lineatur4',
] as const;
export type LineaturId = (typeof LINEATUR_IDS)[number];

/**
 * Wozu eine Linie da ist. Der Renderer leitet daraus die Optik ab: Die
 * Grundlinie traegt die Schrift und wird kraeftig gezeichnet, die Hilfslinien
 * duenn. Waere das hier schon eine Farbe oder Strichstaerke, koennte ein
 * PDF-Renderer die Werte nicht anders waehlen.
 */
export type LineRole = 'oberlinie' | 'mittellinie' | 'grundlinie' | 'unterlinie';

export interface LineaturSpec {
  readonly id: LineaturId;
  /** Abstand zwischen zwei benachbarten Linien einer Zeile. */
  readonly gap: Mm;
  /** Linien von oben nach unten. Leer bei `blanko`. */
  readonly roles: readonly LineRole[];
  /**
   * Luft zwischen dem Ende einer Schreibzeile und dem Anfang der naechsten.
   *
   * Vorgabe ist der Linienabstand selbst -- damit steht die Seite in einem
   * gleichmaessigen Raster, so wie ein Schulheft. Wer mehr Platz zum
   * Korrigieren will, erhoeht den Wert in der Blattdefinition.
   */
  readonly spacing: Mm;
  /** Fuer welche Klassenstufe die Lineatur gedacht ist. Nur zur Anzeige. */
  readonly grade: number | null;
}

export const LINEATUREN: Record<LineaturId, LineaturSpec> = {
  blanko: { id: 'blanko', gap: mm(0), roles: [], spacing: mm(10), grade: null },
  lineatur0: {
    id: 'lineatur0',
    gap: mm(6),
    roles: ['oberlinie', 'mittellinie', 'grundlinie', 'unterlinie'],
    spacing: mm(6),
    grade: 1,
  },
  lineatur1: {
    id: 'lineatur1',
    gap: mm(5),
    roles: ['oberlinie', 'mittellinie', 'grundlinie', 'unterlinie'],
    spacing: mm(5),
    grade: 1,
  },
  lineatur2: {
    id: 'lineatur2',
    gap: mm(4),
    roles: ['oberlinie', 'mittellinie', 'grundlinie', 'unterlinie'],
    spacing: mm(4),
    grade: 2,
  },
  lineatur3: {
    id: 'lineatur3',
    gap: mm(3.5),
    /* Zwei Linien: geschrieben wird zwischen Mittel- und Grundlinie. Ober-
     * und Unterlaengen ragen frei heraus -- ab der dritten Klasse zumutbar. */
    roles: ['mittellinie', 'grundlinie'],
    spacing: mm(5),
    grade: 3,
  },
  lineatur4: {
    id: 'lineatur4',
    /* Eine einzelne Linie hat keinen Innenabstand; die 10 mm sind der
     * Zeilenabstand und stehen deshalb unter `spacing`. */
    gap: mm(0),
    roles: ['grundlinie'],
    spacing: mm(10),
    grade: 4,
  },
};

export interface PositionedLine {
  readonly role: LineRole;
  /** Abstand von der Oberkante der Schreibzeile. */
  readonly offset: Mm;
}

export interface LineaturGeometry {
  /** Oberste bis unterste Linie. 0 bei einer einzelnen Linie und bei blanko. */
  readonly bandHeight: Mm;
  /** Von Zeilenanfang zu Zeilenanfang -- Bandhoehe plus Luft. */
  readonly pitch: Mm;
  readonly lines: readonly PositionedLine[];
}

/**
 * Rechnet eine Lineatur in Positionen um.
 *
 * @param spacing Ueberschreibt die Vorgabe der Lineatur. `null` heisst:
 *                Vorgabe verwenden.
 */
export function lineaturGeometry(spec: LineaturSpec, spacing: Mm | null = null): LineaturGeometry {
  const gapCount = Math.max(0, spec.roles.length - 1);
  const bandHeight = scaleMm(spec.gap, gapCount);
  const effectiveSpacing = spacing ?? spec.spacing;

  return {
    bandHeight,
    pitch: mm(bandHeight + effectiveSpacing),
    lines: spec.roles.map((role, index) => ({ role, offset: scaleMm(spec.gap, index) })),
  };
}

/**
 * Gesamthoehe eines Blocks aus `count` Schreibzeilen.
 *
 * Nach der letzten Zeile steht keine Luft mehr -- sonst haette der Block
 * unten einen Rand, den niemand angefordert hat, und die Berechnung der
 * passenden Zeilenzahl pro Seite waere um eine Zeile daneben.
 */
export function writingBlockHeight(geometry: LineaturGeometry, count: number): Mm {
  if (count <= 0) return mm(0);
  return mm(geometry.pitch * (count - 1) + geometry.bandHeight);
}

/**
 * Wie viele Schreibzeilen in die verfuegbare Hoehe passen.
 *
 * Das Epsilon faengt Faelle ab, in denen eine Zeile rechnerisch um 10^-13 mm
 * zu hoch ist -- dieselbe Vorsichtsmassnahme wie bei `computeRowsPerPage`.
 */
export function fitWritingLines(available: Mm, geometry: LineaturGeometry): number {
  if (available <= 0) return 0;
  if (geometry.pitch <= 0) return geometry.bandHeight <= available ? 1 : 0;

  const epsilon = 1e-9;
  const spacing = geometry.pitch - geometry.bandHeight;
  return Math.max(0, Math.floor((available + spacing + epsilon) / geometry.pitch));
}
