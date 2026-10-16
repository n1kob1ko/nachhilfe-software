import { mm, pt } from '../units';
import type { SentenceColumn } from '../content/sentence-box';
import type { SentenceBoxDefinition } from './sentence-box-types';

/**
 * Startzustand des Satzbaukastens.
 *
 * Bewusst genau das Blatt, das als Vorlage diente: „Ich habe / sehe / male"
 * mit sechs Objekten. Wer den Generator oeffnet, sieht sofort ein fertiges,
 * brauchbares Arbeitsblatt und muss nicht erst verstehen, was ein
 * „Satzbaukasten mit Rollen" sein soll.
 *
 * Die Objekte stehen mit bestimmtem Artikel da -- das ist die Schreibweise,
 * in der das Genus notiert wird. Auf dem Blatt erscheint daraus der
 * Akkusativ: „einen Hund", „eine Blume", „ein Auto".
 */

export const DEFAULT_SENTENCE_COLUMNS: readonly SentenceColumn[] = [
  {
    id: 'subjekt',
    role: 'subjekt',
    heading: 'Wer?',
    /* Ein Pronomen -- bekommt keinen Artikel und wird deshalb auch nicht
     * als „Genus unbekannt" beanstandet. */
    entries: ['Ich'],
    kasus: 'nominativ',
    article: 'ohne',
  },
  {
    id: 'verb',
    role: 'verb',
    heading: 'Was tue ich?',
    entries: ['habe', 'sehe', 'male'],
    kasus: 'nominativ',
    article: 'ohne',
  },
  {
    id: 'objekt',
    role: 'objekt',
    heading: 'Wen oder was?',
    entries: ['der Hund', 'die Blume', 'das Auto', 'der Baum', 'die Katze', 'das Haus'],
    kasus: 'akkusativ',
    article: 'unbestimmt',
  },
];

export const DEFAULT_SENTENCE_BOX: SentenceBoxDefinition = {
  title: 'Sätze bauen',
  showTitle: true,
  instruction:
    'Lies die Wörter in der Tabelle laut vor. Baue daraus eigene Sätze und lies sie vor. ' +
    'Schreibe danach fünf Sätze auf.',
  boxHeading: 'Satzbaukasten',
  linesHeading: 'Deine Sätze',
  showPageNumbers: true,
  page: {
    size: 'a4',
    orientation: 'portrait',
    margins: { top: mm(20), right: mm(15), bottom: mm(20), left: mm(15) },
  },
  typography: {
    /* Deutlich groesser als Fliesstext: Das Blatt richtet sich an Kinder, die
     * gerade erst lesen lernen. */
    fontSize: pt(16),
    lineHeight: 1.4,
    letterSpacing: pt(0),
    bold: false,
  },
  table: {
    rowHeight: mm(14),
    borders: 'all',
    showHeadings: true,
  },
  columns: DEFAULT_SENTENCE_COLUMNS,
  lines: {
    count: 5,
    /* Klasse 1 als Vorgabe -- das Vierliniensystem gibt die Buchstabenhoehe
     * vor, eine einzelne Linie taete das nicht. */
    lineatur: 'lineatur1',
    spacing: null,
    numbered: true,
  },
};
