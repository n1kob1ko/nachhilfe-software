import { maxMm, mm, type Mm } from '../units';
import {
  resolveSentenceBox,
  rowCount as countRows,
  type ResolvedColumn,
} from '../content/sentence-box';
import type { SentenceBoxDefinition } from '../definition/sentence-box-types';
import {
  computeCellWidth,
  computePageGeometry,
  deriveMinRowHeight,
  estimateTextBlockHeight,
} from './geometry';
import { fitWritingLines, LINEATUREN, lineaturGeometry, type LineaturGeometry } from './lineatur';
import type {
  SentenceLayoutCell,
  SentenceLayoutModel,
  SentenceLayoutPage,
  SentenceLayoutRow,
  WritingLineBlock,
} from './sentence-layout-model';

/**
 * Uebersetzt eine Satzbaukasten-Definition in ein fertiges Layoutmodell.
 *
 * Der Ablauf unterscheidet sich vom Lesetabellen-Layouter in einem Punkt
 * grundlegend: Ein Blatt besteht hier aus ZWEI Bloecken verschiedener Art --
 * oben ein Kasten mit fester Zeilenhoehe, darunter Schreibzeilen mit eigener
 * Geometrie. Der Umbruch muss beide gegeneinander abwaegen.
 *
 * Die Reihenfolge steht fest und ist die Absicht der Lehrkraft:
 *
 *   Kopf -> Kasten (vollstaendig) -> Schreibzeilen (so viele wie gewuenscht)
 *
 * Der Kasten hat Vorrang: Er wird nie gekuerzt, sondern notfalls auf mehrere
 * Seiten verteilt. Die Schreibzeilen kommen danach und fuellen, was uebrig
 * ist -- notfalls auf weiteren Seiten. Andersherum stuende ein halber
 * Satzbaukasten auf dem Blatt, und die Uebung waere kaputt.
 *
 * Reine Funktion. Der einzige offizielle Weg von Definition zu Darstellung.
 */

/** Luft zwischen Kopf, Kasten und Schreibzeilen. */
const SECTION_GAP: Mm = mm(6);

/** Hoehe einer Zwischenueberschrift („Satzbaukasten:", „Deine Sätze:"). */
function headingHeight(definition: SentenceBoxDefinition, heading: string): Mm {
  if (heading.trim() === '') return mm(0);
  return estimateTextBlockHeight(heading, mm(10_000), definition.typography);
}

interface Section {
  readonly heading: string;
  readonly height: Mm;
}

export function buildSentenceLayout(definition: SentenceBoxDefinition): SentenceLayoutModel {
  const columns = resolveSentenceBox(definition.columns);
  const columnCount = Math.max(1, columns.length);

  /*
   * Der Kopfbereich liegt im normalen Fluss, nicht in einem eigenen
   * Kopfrahmen wie bei der Lesetabelle: Der Arbeitsauftrag ist Fliesstext und
   * bricht um. Seine Hoehe ist deshalb geschaetzt -- siehe
   * `estimateTextBlockHeight`.
   */
  const geometry = computePageGeometry(definition.page, mm(0));

  const headerHeight = computeHeaderHeight(definition, geometry.contentWidth);
  const columnWidth = computeCellWidth(geometry.contentWidth, columnCount, mm(0));
  const rowHeight = maxMm(definition.table.rowHeight, deriveMinRowHeight(definition.typography));

  const headings = collectHeadings(definition, columns);
  const headingRowHeight = headings === null ? mm(0) : rowHeight;

  const lineatur = lineaturGeometry(
    LINEATUREN[definition.lines.lineatur],
    definition.lines.spacing,
  );

  const boxSection: Section = {
    heading: definition.boxHeading,
    height: headingHeight(definition, definition.boxHeading),
  };
  const linesSection: Section = {
    heading: definition.linesHeading,
    height: headingHeight(definition, definition.linesHeading),
  };

  const rows = buildRows(columns, columnCount);
  const pages = paginate({
    definition,
    contentHeight: geometry.contentHeight,
    headerHeight,
    rows,
    headings,
    headingRowHeight,
    rowHeight,
    columnWidth,
    lineatur,
    boxSection,
    linesSection,
  });

  return {
    geometry,
    metrics: {
      columns: columnCount,
      columnWidth,
      rowHeight,
      linePitch: lineatur.pitch,
      sectionGap: SECTION_GAP,
    },
    pages,
    rowCount: countRows(columns),
    placedLines: pages.reduce((sum, page) => sum + page.writingLines.length, 0),
  };
}

/* --- Bausteine ---------------------------------------------------------------- */

function computeHeaderHeight(definition: SentenceBoxDefinition, width: Mm): Mm {
  const title =
    definition.showTitle && definition.title.trim() !== ''
      ? estimateTextBlockHeight(definition.title, width, definition.typography)
      : mm(0);
  const instruction = estimateTextBlockHeight(definition.instruction, width, definition.typography);
  if (title === 0 && instruction === 0) return mm(0);
  return mm(title + instruction + SECTION_GAP);
}

/** Ueberschriftenzeile -- nur, wenn wenigstens eine Spalte eine traegt. */
function collectHeadings(
  definition: SentenceBoxDefinition,
  columns: readonly ResolvedColumn[],
): readonly string[] | null {
  if (!definition.table.showHeadings) return null;
  const headings = columns.map((column) => column.heading);
  return headings.some((heading) => heading.trim() !== '') ? headings : null;
}

/**
 * Baut die Zeilen der Tabelle.
 *
 * Ungleich lange Spalten sind hier der Normalfall: Wo eine Spalte keinen
 * Eintrag mehr hat, entsteht eine leere Zelle -- kein Umbruch, kein
 * Nachruecken. Genau so sieht die Uebung aus.
 */
function buildRows(
  columns: readonly ResolvedColumn[],
  columnCount: number,
): readonly SentenceLayoutRow[] {
  const total = countRows(columns);

  return Array.from({ length: total }, (_, index) => {
    const cells: SentenceLayoutCell[] = Array.from({ length: columnCount }, (_, position) => {
      const column = columns[position];
      const entry = column?.entries[index];
      return {
        id: entry?.id ?? `leer-${index}-${position}`,
        text: entry?.text ?? '',
        column: position,
        role: column?.role ?? 'ergaenzung',
      };
    });
    return { index, cells };
  });
}

interface PaginateInput {
  readonly definition: SentenceBoxDefinition;
  readonly contentHeight: Mm;
  readonly headerHeight: Mm;
  readonly rows: readonly SentenceLayoutRow[];
  readonly headings: readonly string[] | null;
  readonly headingRowHeight: Mm;
  readonly rowHeight: Mm;
  readonly columnWidth: Mm;
  readonly lineatur: LineaturGeometry;
  readonly boxSection: Section;
  readonly linesSection: Section;
}

/**
 * Verteilt Kasten und Schreibzeilen auf Seiten.
 *
 * Die Schleife laeuft, solange etwas zu setzen ist. Eine Sicherung gegen
 * Endlosschleifen gibt es trotzdem: Passt auf einer frischen Seite nicht
 * einmal eine Zeile, wird eine erzwungen. Ein leicht ueberlaufendes Blatt ist
 * ein sichtbares, korrigierbares Problem -- unendlich viele Seiten waeren es
 * nicht.
 */
function paginate(input: PaginateInput): readonly SentenceLayoutPage[] {
  const pages: SentenceLayoutPage[] = [];

  let remainingRows = [...input.rows];
  let remainingLines = Math.max(0, Math.trunc(input.definition.lines.count));
  let placedLines = 0;
  let firstTablePart = true;

  while (pages.length === 0 || remainingRows.length > 0 || remainingLines > 0) {
    const isFirstPage = pages.length === 0;
    let available = mm(input.contentHeight - (isFirstPage ? input.headerHeight : 0));

    /* --- Kasten ----------------------------------------------------------- */
    let table: SentenceLayoutPage['table'] = null;
    let boxHeading: string | null = null;

    if (remainingRows.length > 0) {
      const withHeading = mm(available - input.boxSection.height);
      const perPage = Math.floor(
        (withHeading - input.headingRowHeight) / Math.max(input.rowHeight, 1e-9),
      );
      /* Mindestens eine Zeile, sonst kaeme die Tabelle nie voran. */
      const take = Math.max(1, Math.min(remainingRows.length, perPage));
      const taken = remainingRows.slice(0, take);

      table = {
        headings: input.headings,
        rows: taken,
        columnWidth: input.columnWidth,
        rowHeight: input.rowHeight,
        isFirstPart: firstTablePart,
      };
      boxHeading = input.boxSection.heading.trim() === '' ? null : input.boxSection.heading;

      const used = mm(
        input.boxSection.height + input.headingRowHeight + input.rowHeight * taken.length,
      );
      available = mm(available - used - SECTION_GAP);
      remainingRows = remainingRows.slice(take);
      firstTablePart = false;
    }

    /* --- Schreibzeilen ------------------------------------------------------
     * Erst wenn der Kasten vollstaendig gesetzt ist. Ein Blatt mit halbem
     * Kasten und schon beginnenden Schreibzeilen waere unbrauchbar.
     */
    const writingLines: WritingLineBlock[] = [];
    let linesHeading: string | null = null;

    if (remainingRows.length === 0 && remainingLines > 0) {
      const startsHere = placedLines === 0 && input.linesSection.heading.trim() !== '';
      const forHeading = startsHere ? input.linesSection.height : mm(0);
      const room = mm(available - forHeading);

      let fits = Math.min(remainingLines, fitWritingLines(room, input.lineatur));
      /* Auf einer frischen Seite ohne Platz fuer eine einzige Zeile wuerde die
       * Schleife nie enden -- also eine erzwingen. */
      if (fits === 0 && table === null) fits = 1;

      if (fits > 0) {
        if (startsHere) linesHeading = input.linesSection.heading;
        for (let index = 0; index < fits; index += 1) {
          placedLines += 1;
          writingLines.push({
            number: placedLines,
            lines: input.lineatur.lines,
            bandHeight: input.lineatur.bandHeight,
          });
        }
        remainingLines -= fits;
      }
    }

    pages.push({
      index: pages.length,
      pageNumber: pages.length + 1,
      header: isFirstPage ? { title: headerTitle(input.definition), instruction: input.definition.instruction } : null,
      boxHeading,
      table,
      linesHeading,
      writingLines,
    });

    /* Nichts gesetzt und nichts mehr zu tun -- fertig. */
    if (remainingRows.length === 0 && remainingLines === 0) break;
  }

  return pages;
}

function headerTitle(definition: SentenceBoxDefinition): string {
  return definition.showTitle ? definition.title : '';
}
