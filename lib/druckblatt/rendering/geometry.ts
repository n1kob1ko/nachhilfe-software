import { mm, ptToMm, scaleMm, subMm, type Mm } from '../units';
import type { Margins, PageConfig, PageSizeId, TypographyConfig } from '../definition/types';

/**
 * Seitengeometrie in Millimetern -- die physikalische Grundlage des Layouts.
 *
 * Alles hier ist reine Rechnung ohne Zustand: gleiche Eingabe, gleiche
 * Ausgabe. Genau deshalb kann der Ausdruck der Bildschirmvorschau exakt
 * entsprechen -- beide lesen dieselben Zahlen.
 */

export interface PageSize {
  readonly width: Mm;
  readonly height: Mm;
  readonly label: string;
}

export const PAGE_SIZES: Record<PageSizeId, PageSize> = {
  a4: { width: mm(210), height: mm(297), label: 'A4' },
  a5: { width: mm(148), height: mm(210), label: 'A5' },
  letter: { width: mm(215.9), height: mm(279.4), label: 'US Letter' },
};

export interface PageGeometry {
  readonly pageWidth: Mm;
  readonly pageHeight: Mm;
  /** Der Renderer positioniert den Satzspiegel damit absolut auf dem Blatt. */
  readonly margins: Margins;
  /** Breite zwischen linkem und rechtem Rand. */
  readonly contentWidth: Mm;
  /** Hoehe zwischen oberem und unterem Rand, inklusive Kopfbereich. */
  readonly contentHeight: Mm;
  /** Hoehe des Kopfbereichs (Titel + Abstand). 0, wenn kein Titel. */
  readonly headerHeight: Mm;
  /** Fuer Zellen tatsaechlich verfuegbare Hoehe. */
  readonly bodyHeight: Mm;
}

export class InvalidGeometryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGeometryError';
  }
}

/** Abstand zwischen Kopfbereich und erster Zeile. */
const HEADER_GAP: Mm = mm(6);

/**
 * Hoehe des Kopfbereichs aus der Typografie ableiten.
 * Titel wird 1.15-fach zur Grundschrift gesetzt, plus Zeile fuer den Untertitel.
 */
export function deriveHeaderHeight(typography: TypographyConfig, hasSubtitle: boolean): Mm {
  const titleHeight = scaleMm(ptToMm(typography.fontSize), 1.15 * typography.lineHeight);
  const subtitleHeight = hasSubtitle
    ? scaleMm(ptToMm(typography.fontSize), 0.7 * typography.lineHeight)
    : mm(0);
  return mm(titleHeight + subtitleHeight + HEADER_GAP);
}

/**
 * Kleinstmoegliche Zeilenhoehe, bei der der Text nicht ueberlaeuft.
 * Der Layouter hebt zu kleine Wunschwerte hierauf an, statt Text zu kappen.
 */
export function deriveMinRowHeight(typography: TypographyConfig): Mm {
  return scaleMm(ptToMm(typography.fontSize), typography.lineHeight);
}

/**
 * Mittlere Zeichenbreite als Anteil der Schriftgroesse.
 *
 * Fuer deutsche Fliesstexte in einer Serifenlosen liegt der Wert erfahrungs-
 * gemaess bei etwa 0,5. Bewusst grosszuegig angesetzt: Ueberschaetzte Breite
 * bedeutet eine geschaetzte Zeile zu viel und damit etwas Luft, unterschaetzte
 * bedeutet Text, der ueber den Seitenrand laeuft.
 */
const AVERAGE_GLYPH_RATIO = 0.52;

/**
 * Schaetzt die Hoehe eines umbrechenden Textblocks.
 *
 * WARUM EINE SCHAETZUNG: Wie viele Zeilen ein Absatz wirklich braucht, weiss
 * erst der Browser beim Setzen. Die Domain-Schicht hat keinen Zugriff auf
 * Schriftmetriken -- und soll ihn auch nicht bekommen, sonst waere sie an den
 * Browser gebunden und ein PDF-Renderer bekaeme andere Ergebnisse.
 *
 * FOLGE EINER FEHLSCHAETZUNG: zu hoch geschaetzt heisst etwas ungenutzter
 * Platz, zu niedrig heisst eine Schreibzeile zu viel auf der Seite. Deshalb
 * die grosszuegige Zeichenbreite und das Aufrunden -- der Fehler soll in die
 * harmlose Richtung gehen.
 *
 * Ausdrueckliche Zeilenumbrueche im Text werden beachtet.
 */
export function estimateTextBlockHeight(
  text: string,
  width: Mm,
  typography: TypographyConfig,
): Mm {
  if (text.trim() === '' || width <= 0) return mm(0);

  const fontHeight = ptToMm(typography.fontSize);
  const glyphWidth = fontHeight * AVERAGE_GLYPH_RATIO;
  const perLine = Math.max(1, Math.floor(width / glyphWidth));

  const lines = text
    .split('\n')
    .reduce((sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.length / perLine)), 0);

  return scaleMm(fontHeight, lines * typography.lineHeight);
}

/**
 * @throws {InvalidGeometryError} wenn die Raender groesser sind als das Blatt.
 */
export function computePageGeometry(page: PageConfig, headerHeight: Mm): PageGeometry {
  const size = PAGE_SIZES[page.size];
  const isLandscape = page.orientation === 'landscape';
  const pageWidth = isLandscape ? size.height : size.width;
  const pageHeight = isLandscape ? size.width : size.height;

  const contentWidth = mm(pageWidth - page.margins.left - page.margins.right);
  const contentHeight = mm(pageHeight - page.margins.top - page.margins.bottom);

  if (contentWidth <= 0 || contentHeight <= 0) {
    throw new InvalidGeometryError(
      `Raender lassen keine Nutzflaeche uebrig (${contentWidth}mm x ${contentHeight}mm). ` +
        'Werte muessen vor dem Layout begrenzt werden -- siehe definition/constraints.ts.',
    );
  }

  return {
    pageWidth,
    pageHeight,
    margins: page.margins,
    contentWidth,
    contentHeight,
    headerHeight,
    bodyHeight: mm(Math.max(0, subMm(contentHeight, headerHeight))),
  };
}

/**
 * @throws {InvalidGeometryError} bei weniger als einer Spalte oder wenn die
 *         Spaltenabstaende die gesamte Breite aufbrauchen.
 */
export function computeCellWidth(contentWidth: Mm, columns: number, columnGap: Mm): Mm {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new InvalidGeometryError(`Spaltenzahl muss >= 1 und ganzzahlig sein, erhalten: ${columns}`);
  }

  const totalGap = columnGap * (columns - 1);
  const width = mm((contentWidth - totalGap) / columns);

  if (width <= 0) {
    throw new InvalidGeometryError(
      `${columns} Spalten mit ${columnGap}mm Abstand passen nicht in ${contentWidth}mm Breite.`,
    );
  }

  return width;
}

/** Kleinste Zellbreite, die noch als Zelle durchgeht. */
const MIN_CELL_WIDTH: Mm = mm(1);

/**
 * Verkleinert den Spaltenabstand so weit, dass die Spalten noch aufs Blatt
 * passen.
 *
 * Notwendig, weil Spaltenzahl und Spaltenabstand unabhaengig voneinander
 * gueltig sein koennen und trotzdem zusammen nicht passen: eine Silbenmatrix
 * erzwingt ihre Spaltenzahl, ein grosser Abstand plus schmales Blatt sprengt
 * dann die Breite. Statt zu scheitern gibt das Layout hier nach -- die
 * Spaltenzahl ist die Absicht der Lehrkraft, der Abstand nur Kosmetik.
 */
export function fitColumnGap(contentWidth: Mm, columns: number, requestedGap: Mm): Mm {
  if (columns <= 1) return mm(0);
  const maxGap = (contentWidth - columns * MIN_CELL_WIDTH) / (columns - 1);
  return mm(Math.max(0, Math.min(requestedGap, maxGap)));
}

/**
 * Anzahl vollstaendig passender Zeilen pro Seite.
 *
 * Zwischen n Zeilen liegen n-1 Abstaende, deshalb die Verschiebung um `rowGap`.
 * Das Epsilon faengt Faelle ab, in denen eine Zeile rechnerisch um 10^-13 mm
 * zu hoch ist und dadurch eine Seite mehr entstuende.
 *
 * @returns Kann 0 sein, wenn nicht einmal eine Zeile passt. Der Aufrufer
 *          entscheidet, was dann geschieht.
 * @throws {InvalidGeometryError} bei nicht-positiver Zeilenhoehe.
 */
export function computeRowsPerPage(bodyHeight: Mm, rowHeight: Mm, rowGap: Mm): number {
  if (rowHeight <= 0) {
    throw new InvalidGeometryError(`Zeilenhoehe muss > 0 sein, erhalten: ${rowHeight}mm`);
  }

  const epsilon = 1e-9;
  return Math.max(0, Math.floor((bodyHeight + rowGap + epsilon) / (rowHeight + rowGap)));
}
