import type { Mm, Pt } from '../units';
import type { SyllableMatrixConfig } from '../content/matrix';

/**
 * Das Arbeitsblatt als reine Beschreibung -- WAS gedruckt werden soll.
 *
 * Diese Struktur enthaelt bewusst keinerlei Darstellungsdetails (keine
 * CSS-Klassen, keine Pixel, keine Farbwerte). Wie daraus ein sichtbares
 * Blatt wird, entscheiden ausschliesslich Renderer und Design-Tokens.
 * Damit ist eine Definition serialisierbar, versionierbar und teilbar.
 */

export type PageSizeId = 'a4' | 'a5' | 'letter';
export type Orientation = 'portrait' | 'landscape';

export interface Margins {
  readonly top: Mm;
  readonly right: Mm;
  readonly bottom: Mm;
  readonly left: Mm;
}

export interface PageConfig {
  readonly size: PageSizeId;
  readonly orientation: Orientation;
  readonly margins: Margins;
}

export interface TypographyConfig {
  readonly fontSize: Pt;
  /** Zeilenhoehe als Faktor der Schriftgroesse. */
  readonly lineHeight: number;
  readonly letterSpacing: Pt;
  readonly bold: boolean;
}

/** Wie eine Zelle optisch gerahmt wird. */
export type CellDecoration = 'none' | 'baseline' | 'box';

export interface GridConfig {
  /** Wunsch-Spaltenzahl. Eine Silbenmatrix ueberschreibt diesen Wert. */
  readonly columns: number;
  readonly columnGap: Mm;
  readonly rowGap: Mm;
  /** Mindesthoehe einer Zeile. Wird bei zu grosser Schrift angehoben. */
  readonly rowHeight: Mm;
  readonly decoration: CellDecoration;
}

/** Silbenfarbe: aus, oder abwechselnd zwei Farben (Silbenbogen-Prinzip). */
export type SyllableColoring = 'none' | 'alternating';

export type ContentSource =
  | { readonly kind: 'wordList'; readonly words: readonly string[] }
  | { readonly kind: 'matrix'; readonly config: SyllableMatrixConfig };

export interface WorksheetDefinition {
  readonly title: string;
  readonly subtitle: string;
  readonly showTitle: boolean;
  readonly showPageNumbers: boolean;
  readonly page: PageConfig;
  readonly grid: GridConfig;
  readonly typography: TypographyConfig;
  readonly coloring: SyllableColoring;
  readonly content: ContentSource;
}
