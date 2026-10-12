import { mm, pt } from '../units';
import type { TracingDefinition } from './tracing-types';

/**
 * Startzustand des Nachmalblatts: die ersten Buchstaben in Lineatur 1.
 *
 * Wer den Generator oeffnet, soll ein fertiges, brauchbares Blatt sehen --
 * nicht erst verstehen muessen, was „abnehmende Hilfe" bedeutet.
 */
export const DEFAULT_TRACING: TracingDefinition = {
  title: 'Buchstaben nachspuren',
  showTitle: true,
  instruction:
    'Fahre die blassen Buchstaben nach. Schreibe danach selbst weiter, bis die Zeile voll ist.',
  showPageNumbers: true,
  page: {
    size: 'a4',
    orientation: 'portrait',
    margins: { top: mm(18), right: mm(15), bottom: mm(18), left: mm(15) },
  },
  typography: { fontSize: pt(13), lineHeight: 1.4, letterSpacing: pt(0), bold: false },

  script: 'druckschrift',
  sizeAdjust: 1,

  unit: 'letter',
  content: 'a b c d e',
  rows: {
    repeats: 7,
    showModel: true,
    style: 'ghost',
    /* Abnehmende Hilfe als Vorgabe -- das ist der Punkt der Uebung. */
    fade: 'linear',
    freeRows: 1,
  },
  lines: {
    /* Klasse 1: Das Vierliniensystem gibt die Buchstabenhoehe vor. */
    lineatur: 'lineatur1',
    spacing: null,
  },
};
