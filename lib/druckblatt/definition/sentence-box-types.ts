import type { Mm } from '../units';
import type { SentenceColumn } from '../content/sentence-box';
import type { LineaturId } from '../rendering/lineatur';
import type { PageConfig, TypographyConfig } from './types';

/**
 * Der Satzbaukasten als reine Beschreibung -- WAS gedruckt werden soll.
 *
 * ZWEITER BLATTTYP, NICHT ERWEITERUNG DER LESETABELLE. Eine Lesetabelle ist
 * ein gleichmaessiges Raster aus Zellen; hier haben die Spalten eigene,
 * unterschiedlich lange Listen, darunter stehen Schreibzeilen, und oben steht
 * ein Aufgabentext. Das in `WorksheetDefinition` zu quetschen haette beide
 * Typen unlesbar gemacht -- siehe ADR 0008.
 *
 * GETEILT wird, was wirklich beiden gehoert: Seitenformat, Raender,
 * Typografie, Seitengeometrie. Das sind Eigenschaften des PAPIERS, nicht des
 * Inhalts.
 *
 * Wie bei der Lesetabelle: keine CSS-Klassen, keine Pixel, keine Farben.
 * Serialisierbar, versionierbar, teilbar.
 */

/** Wie die Tabelle gerahmt wird. */
export type TableBorders = 'all' | 'outline' | 'columns' | 'none';

export interface SentenceTableConfig {
  /** Mindesthoehe einer Zeile. Wird bei zu grosser Schrift angehoben. */
  readonly rowHeight: Mm;
  readonly borders: TableBorders;
  /** Ueberschriften der Spalten zeigen -- nur sinnvoll, wenn welche gesetzt sind. */
  readonly showHeadings: boolean;
}

export interface WritingLinesConfig {
  /** Wie viele Saetze das Kind schreiben soll. 0 heisst: keine Zeilen. */
  readonly count: number;
  readonly lineatur: LineaturId;
  /**
   * Luft zwischen den Schreibzeilen. `null` nimmt die Vorgabe der Lineatur --
   * das ergibt ein Raster wie im Schulheft.
   */
  readonly spacing: Mm | null;
  /** Zeilen durchnummerieren („1.", „2.", …), wie auf dem Vorbildblatt. */
  readonly numbered: boolean;
}

export interface SentenceBoxDefinition {
  readonly title: string;
  readonly showTitle: boolean;
  /** Der Arbeitsauftrag in ganzen Saetzen. Leer heisst: keiner. */
  readonly instruction: string;
  /** Ueberschrift ueber dem Kasten, z. B. „Satzbaukasten:". */
  readonly boxHeading: string;
  /** Ueberschrift ueber den Schreibzeilen, z. B. „Deine Sätze:". */
  readonly linesHeading: string;
  readonly showPageNumbers: boolean;
  readonly page: PageConfig;
  readonly typography: TypographyConfig;
  readonly table: SentenceTableConfig;
  readonly columns: readonly SentenceColumn[];
  readonly lines: WritingLinesConfig;
}
