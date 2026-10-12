/**
 * Generator fuer Lesetabellen (Silbenmatrix).
 *
 * Eine Lesetabelle kombiniert Anlaute mit Vokalen zu Silben:
 *
 *      onset-major            nucleus-major
 *      Ma Me Mi Mo Mu         Ma La Sa
 *      La Le Li Lo Lu         Me Le Se
 *      Sa Se Si So Su         Mi Li Si
 *
 * Die Leserichtung bestimmt, was geuebt wird: onset-major traniert das
 * Durchgleiten eines Anlauts, nucleus-major den Vokalwechsel.
 */

export type MatrixOrder = 'onset-major' | 'nucleus-major';

export interface SyllableMatrixConfig {
  /** Anlaute, z. B. ['M', 'L', 'S', 'F']. */
  readonly onsets: readonly string[];
  /** Vokale/Silbenkerne, z. B. ['a', 'e', 'i', 'o', 'u']. */
  readonly nuclei: readonly string[];
  /** Optionaler Auslaut, z. B. 'n' fuer "Man Men Min ...". */
  readonly coda: string;
  readonly order: MatrixOrder;
  /** Ersten Buchstaben grossschreiben (Leseanfang mit Grossbuchstaben). */
  readonly capitalize: boolean;
}

export interface GeneratedMatrix {
  readonly cells: string[];
  /**
   * Spaltenzahl, die sich aus der Matrix ergibt. Sie ueberschreibt die
   * Rasterkonfiguration -- eine Lesetabelle waere sonst nicht mehr lesbar.
   */
  readonly columns: number;
}

const clean = (values: readonly string[]): string[] =>
  values.map((v) => v.trim()).filter((v) => v !== '');

const capitalizeFirst = (value: string): string =>
  value === '' ? value : value[0]!.toUpperCase() + value.slice(1);

/**
 * Erzeugt die Zellen einer Silbenmatrix in Leserichtung (zeilenweise).
 *
 * Leere oder nur aus Leerzeichen bestehende Eintraege werden verworfen.
 * Ist eine der beiden Achsen danach leer, ist das Ergebnis leer -- das ist
 * ein gueltiger Zwischenzustand waehrend der Eingabe, kein Fehler.
 */
export function generateSyllableMatrix(config: SyllableMatrixConfig): GeneratedMatrix {
  const onsets = clean(config.onsets);
  const nuclei = clean(config.nuclei);
  const coda = config.coda.trim();

  if (onsets.length === 0 || nuclei.length === 0) {
    return { cells: [], columns: 1 };
  }

  const combine = (onset: string, nucleus: string): string => {
    const syllable = `${onset}${nucleus}${coda}`;
    return config.capitalize ? capitalizeFirst(syllable) : syllable;
  };

  if (config.order === 'onset-major') {
    return {
      cells: onsets.flatMap((onset) => nuclei.map((nucleus) => combine(onset, nucleus))),
      columns: nuclei.length,
    };
  }

  return {
    cells: nuclei.flatMap((nucleus) => onsets.map((onset) => combine(onset, nucleus))),
    columns: onsets.length,
  };
}
