import { mm, mmToPt, scaleMm, type Mm, type Pt } from '../units';
import { buildTraceRow, splitTraceItems, type TraceCell } from '../content/tracing';
import type { TracingDefinition } from '../definition/tracing-types';
import { computePageGeometry, estimateTextBlockHeight, type PageGeometry } from './geometry';
import { HANDWRITING_SCRIPTS, resolveScript, type ScriptId } from './handwriting-scripts';
import { LINEATUREN, lineaturGeometry, type PositionedLine } from './lineatur';

/**
 * Uebersetzt eine Nachmalblatt-Definition in ein fertiges Layoutmodell.
 *
 * DER KERN DIESER RECHNUNG ist die Schriftgroesse: Ein Kleinbuchstabe muss
 * genau ins Mittelband der Lineatur passen. Nur dann malt das Kind Formen
 * nach, die zu den Linien gehoeren -- eine zu grosse Schrift laesst
 * Oberlaengen ins Nichts ragen, eine zu kleine haengt in der Luft.
 *
 * Reine Funktion.
 */

/** Luft zwischen Kopfbereich und erster Zeile. */
const HEADER_GAP: Mm = mm(6);

export interface TracingLayoutRow {
  /** Laufende Nummer ueber das Blatt, 0-basiert. */
  readonly index: number;
  /** Linien der Lineatur, relativ zur Oberkante der Zeile. */
  readonly lines: readonly PositionedLine[];
  readonly bandHeight: Mm;
  /**
   * Die Uebungszeichen. Leer bei einer freien Zeile -- die traegt nur
   * Linien.
   */
  readonly cells: readonly TraceCell[];
  /** Breite eines Feldes. Alle gleich, damit die Zeichen untereinander stehen. */
  readonly cellWidth: Mm;
}

export interface TracingLayoutPage {
  readonly index: number;
  readonly pageNumber: number;
  readonly header: { readonly title: string; readonly instruction: string } | null;
  readonly rows: readonly TracingLayoutRow[];
}

export interface TracingLayoutMetrics {
  /** Schriftgroesse der Uebungszeichen -- aus dem Mittelband gerechnet. */
  readonly fontSize: Pt;
  /** Abstand von Zeilenanfang zu Zeilenanfang. */
  readonly pitch: Mm;
  /** Welche Schrift tatsaechlich gesetzt wird. */
  readonly script: ScriptId;
  /** Ob ersatzweise eine andere Schrift verwendet wird, weil die Datei fehlt. */
  readonly scriptSubstituted: boolean;
}

export interface TracingLayoutModel {
  readonly geometry: PageGeometry;
  readonly metrics: TracingLayoutMetrics;
  readonly pages: readonly TracingLayoutPage[];
  /** Wie viele Uebungselemente gesetzt wurden. */
  readonly itemCount: number;
}

/**
 * Schriftgroesse aus der Lineatur.
 *
 * Das Mittelband ist der Abstand zwischen Mittel- und Grundlinie -- also
 * genau ein `gap` der Lineatur. Die x-Hoehe der Schrift soll dieses Band
 * fuellen; die Schriftgroesse ergibt sich aus dem Verhaeltnis.
 *
 * Bei `blanko` gibt es kein Band. Dann wird ein Ersatzmass verwendet, damit
 * ein Blatt ohne Linien nicht mit unsichtbar kleiner Schrift entsteht.
 */
export function fontSizeForBand(bandGap: Mm, scriptId: ScriptId, adjust: number): Pt {
  const ratio = HANDWRITING_SCRIPTS[scriptId].xHeightRatio;
  const gap = bandGap > 0 ? bandGap : mm(6);
  return mmToPt(scaleMm(mm(gap / ratio), adjust));
}

export function buildTracingLayout(definition: TracingDefinition): TracingLayoutModel {
  const geometry = computePageGeometry(definition.page, mm(0));

  const spec = LINEATUREN[definition.lines.lineatur];
  const lineatur = lineaturGeometry(spec, definition.lines.spacing);
  const script = resolveScript(definition.script);

  const fontSize = fontSizeForBand(spec.gap, script.effective.id, definition.sizeAdjust);

  const items = splitTraceItems(definition.content, definition.unit);
  const cellWidth = mm(geometry.contentWidth / Math.max(1, definition.rows.repeats));

  /*
   * Je Uebungselement eine Vorlagenzeile plus die gewuenschten freien Zeilen.
   * Die freien Zeilen tragen dasselbe Element nicht mehr -- dort schreibt das
   * Kind selbst.
   */
  const freeRows = Math.max(0, Math.trunc(definition.rows.freeRows));
  const rows: TracingLayoutRow[] = [];

  for (const item of items) {
    rows.push({
      index: rows.length,
      lines: lineatur.lines,
      bandHeight: lineatur.bandHeight,
      cells: buildTraceRow(item, definition.rows),
      cellWidth,
    });
    for (let free = 0; free < freeRows; free += 1) {
      rows.push({
        index: rows.length,
        lines: lineatur.lines,
        bandHeight: lineatur.bandHeight,
        cells: [],
        cellWidth,
      });
    }
  }

  /* --- Seitenumbruch -------------------------------------------------------
   * Der Kopfbereich steht nur auf der ersten Seite; ab der zweiten ist die
   * volle Hoehe frei. Deshalb passen dort mehr Zeilen -- das wird getrennt
   * gerechnet statt mit dem kleineren Wert fuer alle.
   */
  const headerHeight = computeHeaderHeight(definition, geometry.contentWidth);
  const firstPage = fitRows(mm(geometry.contentHeight - headerHeight), lineatur.pitch);
  const otherPages = fitRows(geometry.contentHeight, lineatur.pitch);

  const pages: TracingLayoutPage[] = [];
  const remaining = [...rows];
  const header =
    headerHeight > 0
      ? { title: definition.showTitle ? definition.title : '', instruction: definition.instruction }
      : null;

  while (remaining.length > 0 || pages.length === 0) {
    const capacity = pages.length === 0 ? firstPage : otherPages;
    const taken = remaining.splice(0, Math.max(1, capacity));
    pages.push({
      index: pages.length,
      pageNumber: pages.length + 1,
      header: pages.length === 0 ? header : null,
      rows: taken,
    });
    if (remaining.length === 0) break;
  }

  return {
    geometry,
    metrics: {
      fontSize,
      pitch: lineatur.pitch,
      script: script.effective.id,
      scriptSubstituted: script.substituted,
    },
    pages,
    itemCount: items.length,
  };
}

function computeHeaderHeight(definition: TracingDefinition, width: Mm): Mm {
  const title =
    definition.showTitle && definition.title.trim() !== ''
      ? estimateTextBlockHeight(definition.title, width, definition.typography)
      : mm(0);
  const instruction = estimateTextBlockHeight(definition.instruction, width, definition.typography);
  if (title === 0 && instruction === 0) return mm(0);
  return mm(title + instruction + HEADER_GAP);
}

/**
 * Wie viele Zeilen in die Hoehe passen.
 *
 * Dieselbe Rechnung wie in `fitWritingLines`, aber ueber die volle Zeilenhoehe
 * statt ueber Band plus Luft -- hier hat jede Zeile dieselbe Hoehe, und der
 * Abstand nach der letzten faellt nicht ins Gewicht.
 */
function fitRows(available: Mm, pitch: Mm): number {
  if (available <= 0 || pitch <= 0) return 0;
  const epsilon = 1e-9;
  return Math.max(0, Math.floor((available + epsilon) / pitch));
}

/** Alle Zellen einer Seite -- fuer Tests und Statusanzeige. */
export function countTracedCells(model: TracingLayoutModel): number {
  return model.pages.reduce(
    (sum, page) => sum + page.rows.reduce((rowSum, row) => rowSum + row.cells.length, 0),
    0,
  );
}
