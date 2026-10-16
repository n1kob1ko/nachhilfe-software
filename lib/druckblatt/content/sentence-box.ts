import {
  nounPhraseFrom,
  type ArticleMode,
  type Kasus,
  type NounIssue,
} from '../../german-nouns';

/**
 * Der Satzbaukasten -- Spalten, aus denen Kinder Saetze zusammensetzen.
 *
 *   Ich | habe  | einen Hund
 *       | sehe  | eine Blume
 *       | male  | ein Auto
 *
 * Der Reiz der Uebung ist das Kreuzprodukt: drei Verben und sechs Objekte
 * ergeben achtzehn Saetze, und jedes Kind findet seine eigenen. Die Spalten
 * sind deshalb ausdruecklich UNTERSCHIEDLICH LANG -- das ist kein Sonderfall,
 * sondern der Normalfall.
 *
 * Was diese Datei tut: aus Rohtexten Anzeigetexte machen. Der Artikel wird
 * dabei gerechnet, nicht getippt (siehe `language/german-nouns.ts`) -- „einen
 * Hund", aber „eine Blume". Was die Lehrkraft eintippt, ist das Nomen mit
 * seinem Genus; welche Form daraus wird, entscheidet die Spalte.
 *
 * Was diese Datei NICHT tut: Sie weiss nichts von Millimetern, Seiten oder
 * Schreiblinien. Das Layout liegt in `rendering/build-sentence-layout.ts`.
 */

export const COLUMN_ROLES = ['subjekt', 'verb', 'objekt', 'ergaenzung'] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

export interface SentenceColumn {
  /** Stabil ueber Umsortieren hinweg -- taugt als React-key. */
  readonly id: string;
  readonly role: ColumnRole;
  /** Ueberschrift ueber der Spalte. Leer heisst: keine. */
  readonly heading: string;
  /** Rohtexte, wie eingegeben. Die Auswertung passiert erst beim Aufloesen. */
  readonly entries: readonly string[];
  /** Wirkt nur bei Rollen, die Nomen tragen. */
  readonly kasus: Kasus;
  readonly article: ArticleMode;
}

/**
 * Welche Rolle Nomen traegt und deshalb einen Artikel bekommt.
 *
 * Verben nicht: „habe" bleibt „habe". Alles andere kann ein Nomen sein --
 * auch das Subjekt („Der Hund bellt"). Dass in der ersten Klasse meist ein
 * Pronomen dort steht, faengt die Pronomenliste der Sprachschicht ab.
 */
export const ROLE_TAKES_ARTICLE: Record<ColumnRole, boolean> = {
  subjekt: true,
  verb: false,
  objekt: true,
  ergaenzung: true,
};

/** Was der Fall normalerweise ist, wenn eine Spalte neu angelegt wird. */
export const ROLE_DEFAULT_KASUS: Record<ColumnRole, Kasus> = {
  subjekt: 'nominativ',
  verb: 'nominativ',
  objekt: 'akkusativ',
  /* „mit dem Ball", „in der Schule" -- Ergaenzungen stehen meist im Dativ. */
  ergaenzung: 'dativ',
};

export const ROLE_DEFAULT_ARTICLE: Record<ColumnRole, ArticleMode> = {
  subjekt: 'bestimmt',
  verb: 'ohne',
  /* Unbestimmt, weil „einen Hund" das ist, was auf solchen Blaettern steht:
   * irgendeinen, nicht einen bestimmten. */
  objekt: 'unbestimmt',
  ergaenzung: 'bestimmt',
};

/* --- Aufloesen ---------------------------------------------------------------- */

export interface ResolvedEntry {
  readonly id: string;
  /** Was auf dem Blatt steht. */
  readonly text: string;
  /** Was eingegeben wurde -- fuer Fehlermeldungen, die man wiederfindet. */
  readonly source: string;
  readonly issues: readonly NounIssue[];
}

export interface ResolvedColumn {
  readonly id: string;
  readonly role: ColumnRole;
  readonly heading: string;
  readonly entries: readonly ResolvedEntry[];
}

/** Leere Zeilen fliegen raus -- eine Leerzeile im Kasten ist immer ein Versehen. */
const nonEmpty = (value: string): boolean => value.trim() !== '';

export function resolveColumn(column: SentenceColumn): ResolvedColumn {
  const takesArticle = ROLE_TAKES_ARTICLE[column.role];

  const entries = column.entries.filter(nonEmpty).map((source, index): ResolvedEntry => {
    const id = `${column.id}-${index}`;
    if (!takesArticle) return { id, text: source.trim(), source, issues: [] };

    const phrase = nounPhraseFrom(source, { kasus: column.kasus, article: column.article });
    return { id, text: phrase.text, source, issues: phrase.issues };
  });

  return { id: column.id, role: column.role, heading: column.heading, entries };
}

export function resolveSentenceBox(
  columns: readonly SentenceColumn[],
): readonly ResolvedColumn[] {
  return columns.map(resolveColumn);
}

/* --- Kennzahlen fuer die Oberflaeche ------------------------------------------ */

/** Zeilen der Tabelle: so viele, wie die laengste Spalte Eintraege hat. */
export function rowCount(columns: readonly ResolvedColumn[]): number {
  return columns.reduce((max, column) => Math.max(max, column.entries.length), 0);
}

/**
 * Wie viele verschiedene Saetze sich bauen lassen -- das Kreuzprodukt.
 *
 * Leere Spalten zaehlen nicht mit, sonst waere das Ergebnis immer 0, waehrend
 * man die erste Spalte tippt. Ohne jeden Eintrag ist es 0.
 */
export function sentenceCombinations(columns: readonly ResolvedColumn[]): number {
  const filled = columns.filter((column) => column.entries.length > 0);
  if (filled.length === 0) return 0;
  return filled.reduce((product, column) => product * column.entries.length, 1);
}

export interface EntryIssue {
  readonly columnId: string;
  readonly entryId: string;
  readonly source: string;
  readonly issue: NounIssue;
}

/**
 * Alle Beanstandungen in einer flachen Liste.
 *
 * Die Oberflaeche zeigt sie ueber der Vorschau. Ein stillschweigend
 * artikelloses Nomen mitten in einer Tabelle uebersieht man beim Korrekturlesen
 * -- eine Liste am Rand nicht.
 */
export function collectEntryIssues(columns: readonly ResolvedColumn[]): readonly EntryIssue[] {
  return columns.flatMap((column) =>
    column.entries.flatMap((entry) =>
      entry.issues.map((issue) => ({
        columnId: column.id,
        entryId: entry.id,
        source: entry.source,
        issue,
      })),
    ),
  );
}

/**
 * Ein Beispielsatz aus der ersten Zeile jeder Spalte.
 *
 * Zweck ist nicht die Vollstaendigkeit, sondern die Kontrolle: Wenn hier
 * „Ich habe einen Blume" steht, sieht man den Fehler sofort -- ohne achtzehn
 * Kombinationen im Kopf zu bilden.
 */
export function sampleSentence(columns: readonly ResolvedColumn[]): string {
  const parts = columns
    .map((column) => column.entries[0]?.text ?? '')
    .filter((part) => part !== '');
  if (parts.length === 0) return '';
  return `${parts.join(' ')}.`;
}
