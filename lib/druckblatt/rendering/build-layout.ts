import { maxMm, mm } from '../units';
import { generateSyllableMatrix } from '../content/matrix';
import { splitIntoSyllables } from '../language/syllables';
import type { ContentSource, WorksheetDefinition } from '../definition/types';
import { chunk } from './chunk';
import {
  computeCellWidth,
  computePageGeometry,
  computeRowsPerPage,
  deriveHeaderHeight,
  deriveMinRowHeight,
  fitColumnGap,
} from './geometry';
import type { LayoutCell, LayoutModel, LayoutPage, LayoutRow } from './layout-model';

/**
 * Uebersetzt eine Arbeitsblatt-Definition in ein fertiges LayoutModel.
 *
 * Die Funktion ist rein und der einzige offizielle Weg von "Definition" zu
 * "Darstellung". Ihre Pipeline:
 *
 *   Inhalt aufloesen -> Spalten festlegen -> Geometrie -> Zeilen -> Seiten
 *
 * Jede Stufe ist einzeln getestet; dieser Test hier prueft das Zusammenspiel.
 */

export interface ResolvedContent {
  readonly cells: readonly string[];
  /**
   * Von der Inhaltsquelle erzwungene Spaltenzahl, oder `null`, wenn die
   * Rasterkonfiguration entscheiden darf. Eine Silbenmatrix erzwingt ihre
   * Breite -- sonst waere die Tabellenlogik zerstoert.
   */
  readonly columns: number | null;
}

export function resolveContent(source: ContentSource): ResolvedContent {
  switch (source.kind) {
    case 'wordList':
      return {
        cells: source.words.map((word) => word.trim()).filter((word) => word !== ''),
        columns: null,
      };
    case 'matrix': {
      const matrix = generateSyllableMatrix(source.config);
      return { cells: matrix.cells, columns: matrix.columns };
    }
  }
}

export function buildLayoutModel(definition: WorksheetDefinition): LayoutModel {
  const content = resolveContent(definition.content);
  const columns = Math.max(1, Math.trunc(content.columns ?? definition.grid.columns));

  const hasHeader = definition.showTitle && definition.title.trim() !== '';
  const headerHeight = hasHeader
    ? deriveHeaderHeight(definition.typography, definition.subtitle.trim() !== '')
    : mm(0);

  const geometry = computePageGeometry(definition.page, headerHeight);

  /*
   * Der Spaltenabstand gibt nach, wenn er sonst das Blatt sprengen wuerde --
   * die Spaltenzahl ist die inhaltliche Vorgabe und bleibt unangetastet.
   */
  const columnGap = fitColumnGap(geometry.contentWidth, columns, definition.grid.columnGap);
  const cellWidth = computeCellWidth(geometry.contentWidth, columns, columnGap);

  /*
   * Die gewuenschte Zeilenhoehe wird angehoben, wenn die Schrift sonst
   * ueberliefe. Lieber weniger Zeilen pro Seite als abgeschnittene Woerter.
   */
  const rowHeight = maxMm(definition.grid.rowHeight, deriveMinRowHeight(definition.typography));

  /*
   * Passt rechnerisch keine einzige Zeile (extreme Raender + riesige Schrift),
   * setzen wir trotzdem eine Zeile pro Seite. Ein leicht ueberlaufendes Blatt
   * ist ein sichtbares, korrigierbares Problem -- eine Division durch 0 oder
   * unendlich viele Seiten waeren es nicht.
   */
  const rowsPerPage = Math.max(
    1,
    computeRowsPerPage(geometry.bodyHeight, rowHeight, definition.grid.rowGap),
  );

  const cells: LayoutCell[] = content.cells.map((text, index) => ({
    id: `cell-${index}`,
    index,
    text,
    column: index % columns,
    syllables: definition.coloring === 'none' ? [text] : splitIntoSyllables(text),
  }));

  const rows: LayoutRow[] = chunk(cells, columns).map((rowCells, index) => ({
    index,
    cells: rowCells,
  }));

  /*
   * Ohne Inhalt genau eine leere Seite: die Vorschau soll ein Blatt zeigen,
   * damit Format- und Randaenderungen sichtbar bleiben, bevor Woerter da sind.
   */
  const pageChunks = rows.length > 0 ? chunk(rows, rowsPerPage) : [[]];

  const header = hasHeader ? { title: definition.title, subtitle: definition.subtitle } : null;

  const pages: LayoutPage[] = pageChunks.map((pageRows, index) => ({
    index,
    pageNumber: index + 1,
    header,
    rows: pageRows,
  }));

  return {
    geometry,
    metrics: {
      columns,
      cellWidth,
      rowHeight,
      columnGap,
      rowGap: definition.grid.rowGap,
    },
    pages,
    cellCount: cells.length,
  };
}
