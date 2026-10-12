import type { Mm } from '../units';
import type { PageGeometry } from './geometry';

/**
 * Das LayoutModel -- die Naht zwischen Logik und Darstellung.
 *
 * Es beschreibt ein fertig ausgerechnetes Arbeitsblatt: welche Seiten es gibt,
 * welche Zellen darauf liegen, wie gross alles in Millimetern ist. Es enthaelt
 * KEINE Farben, keine CSS-Klassen, kein React.
 *
 * Ein Renderer ist damit ein reiner Uebersetzer dieses Modells:
 *   - renderers/screen  -> DOM-Knoten mit mm-Einheiten (Bildschirm + Druck)
 *   - (spaeter) pdf     -> pdf-lib-Zeichenbefehle
 *   - (spaeter) test    -> Textausgabe fuer Snapshot-Tests
 *
 * Ein neuer Ausgabekanal erfordert deshalb keine Aenderung an der Logik.
 */

export interface LayoutCell {
  /** Stabil ueber Neuberechnungen hinweg -- taugt als React-key. */
  readonly id: string;
  /** Laufender Index ueber das gesamte Arbeitsblatt, 0-basiert. */
  readonly index: number;
  readonly text: string;
  /**
   * Silben in Lesereihenfolge. Bei abgeschalteter Silbenfarbe genau ein
   * Element mit dem vollstaendigen Text -- der Renderer braucht so keine
   * Fallunterscheidung.
   */
  readonly syllables: readonly string[];
  /** Spaltenindex innerhalb der Zeile, 0-basiert. */
  readonly column: number;
}

export interface LayoutRow {
  /** Zeilenindex ueber das gesamte Arbeitsblatt, 0-basiert. */
  readonly index: number;
  readonly cells: readonly LayoutCell[];
}

export interface LayoutHeader {
  readonly title: string;
  readonly subtitle: string;
}

export interface LayoutPage {
  /** 0-basiert, fuer Arrays. */
  readonly index: number;
  /** 1-basiert, fuer die Anzeige ("Seite 1 von 3"). */
  readonly pageNumber: number;
  readonly header: LayoutHeader | null;
  readonly rows: readonly LayoutRow[];
}

export interface LayoutMetrics {
  readonly columns: number;
  readonly cellWidth: Mm;
  readonly rowHeight: Mm;
  readonly columnGap: Mm;
  readonly rowGap: Mm;
}

export interface LayoutModel {
  readonly geometry: PageGeometry;
  readonly metrics: LayoutMetrics;
  readonly pages: readonly LayoutPage[];
  /** Gesamtzahl gesetzter Zellen -- fuer Statusanzeige und Tests. */
  readonly cellCount: number;
}
