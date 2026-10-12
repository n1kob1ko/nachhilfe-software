import { mm, pt } from '../units';
import type { ContentSource, WorksheetDefinition } from './types';

/**
 * Startzustand der Anwendung: eine klassische Lesetabelle fuer Klasse 1.
 *
 * Der Generator soll beim Oeffnen bereits etwas Sinnvolles zeigen -- ein
 * leeres Blatt zwingt die Lehrkraft, das Werkzeug erst zu verstehen, bevor
 * sie sieht, wofuer es gut ist.
 */

export const DEFAULT_MATRIX_CONTENT: ContentSource = {
  kind: 'matrix',
  config: {
    onsets: ['M', 'L', 'S', 'F', 'R'],
    nuclei: ['a', 'e', 'i', 'o', 'u'],
    coda: '',
    order: 'onset-major',
    capitalize: false,
  },
};

export const DEFAULT_WORD_LIST: ContentSource = {
  kind: 'wordList',
  words: ['Mama', 'Oma', 'Sofa', 'Nase', 'Lupe', 'Hase', 'Rose', 'Besen'],
};

export const DEFAULT_WORKSHEET: WorksheetDefinition = {
  title: 'Lesetabelle',
  subtitle: '',
  showTitle: true,
  showPageNumbers: true,
  page: {
    size: 'a4',
    orientation: 'portrait',
    margins: { top: mm(20), right: mm(15), bottom: mm(20), left: mm(15) },
  },
  grid: {
    columns: 5,
    columnGap: mm(4),
    rowGap: mm(4),
    rowHeight: mm(18),
    decoration: 'baseline',
  },
  typography: {
    fontSize: pt(24),
    lineHeight: 1.4,
    letterSpacing: pt(1),
    bold: false,
  },
  coloring: 'alternating',
  content: DEFAULT_MATRIX_CONTENT,
};
