/**
 * Ein- und Ausgabe von Wortlisten als Freitext.
 *
 * Lehrkraefte tippen Wortlisten nicht in Formularfelder, sie fuegen sie aus
 * Word, Excel oder einer E-Mail ein. Der Parser muss deshalb mit Zeilenumbruch,
 * Komma, Semikolon und Tabulator gleichermassen umgehen.
 *
 * Leerzeichen INNERHALB eines Eintrags bleiben erhalten -- "Guten Morgen" ist
 * ein gueltiger Zelleninhalt, keine zwei Woerter.
 */

const SEPARATORS = /[\n\r,;\t]+/;

export function parseWordList(text: string): string[] {
  return text
    .split(SEPARATORS)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/** Umkehrung fuer die Anzeige im Textfeld: ein Eintrag je Zeile. */
export function formatWordList(words: readonly string[]): string {
  return words.join('\n');
}
