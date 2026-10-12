import type { Mm } from '../units';
import type { ColumnRole } from '../content/sentence-box';
import type { PageGeometry } from './geometry';
import type { PositionedLine } from './lineatur';

/**
 * Das Layoutmodell des Satzbaukastens -- die Naht zwischen Logik und
 * Darstellung, wie `layout-model.ts` fuer die Lesetabelle.
 *
 * Es beschreibt ein fertig ausgerechnetes Blatt: welche Seite welchen
 * Tabellenteil traegt, wo die Schreiblinien liegen, alles in Millimetern.
 * Keine Farben, keine CSS-Klassen, kein React -- ein PDF-Renderer kaeme mit
 * genau denselben Angaben aus.
 */

export interface SentenceLayoutCell {
  /** Stabil ueber Neuberechnungen hinweg -- taugt als React-key. */
  readonly id: string;
  readonly text: string;
  readonly column: number;
  /** Fuer den Renderer, der Verben anders setzen darf als Nomen. */
  readonly role: ColumnRole;
}

export interface SentenceLayoutRow {
  readonly index: number;
  /** Immer so viele Eintraege wie Spalten -- leere Zellen sind leerer Text. */
  readonly cells: readonly SentenceLayoutCell[];
}

export interface SentenceLayoutTable {
  /** `null`, wenn keine Ueberschriften gesetzt oder abgeschaltet sind. */
  readonly headings: readonly string[] | null;
  readonly rows: readonly SentenceLayoutRow[];
  readonly columnWidth: Mm;
  readonly rowHeight: Mm;
  /** Ob dies der erste Tabellenteil ist -- danach richtet sich die Ueberschrift. */
  readonly isFirstPart: boolean;
}

export interface WritingLineBlock {
  /** 1-basiert ueber das gesamte Blatt -- die Nummer, die vorn steht. */
  readonly number: number;
  /** Linien relativ zur Oberkante dieser Schreibzeile. */
  readonly lines: readonly PositionedLine[];
  /** Oberste bis unterste Linie. */
  readonly bandHeight: Mm;
}

export interface SentenceLayoutPage {
  /** 0-basiert, fuer Arrays. */
  readonly index: number;
  /** 1-basiert, fuer die Anzeige. */
  readonly pageNumber: number;
  /** Titel und Arbeitsauftrag -- nur auf der ersten Seite. */
  readonly header: { readonly title: string; readonly instruction: string } | null;
  /** Ueberschrift ueber dem Kasten. `null`, wenn hier keine Tabelle steht. */
  readonly boxHeading: string | null;
  readonly table: SentenceLayoutTable | null;
  /** Ueberschrift ueber den Schreibzeilen. `null`, wenn hier keine beginnen. */
  readonly linesHeading: string | null;
  readonly writingLines: readonly WritingLineBlock[];
}

export interface SentenceLayoutMetrics {
  readonly columns: number;
  readonly columnWidth: Mm;
  readonly rowHeight: Mm;
  /** Von Schreibzeile zu Schreibzeile. */
  readonly linePitch: Mm;
  /** Abstand zwischen den Bloecken (Kopf, Kasten, Schreibzeilen). */
  readonly sectionGap: Mm;
}

export interface SentenceLayoutModel {
  readonly geometry: PageGeometry;
  readonly metrics: SentenceLayoutMetrics;
  readonly pages: readonly SentenceLayoutPage[];
  /** Gesetzte Tabellenzeilen -- fuer Statusanzeige und Tests. */
  readonly rowCount: number;
  /** Tatsaechlich gesetzte Schreibzeilen. Kann kleiner sein als gewuenscht. */
  readonly placedLines: number;
}
