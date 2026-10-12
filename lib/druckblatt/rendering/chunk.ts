/**
 * Aufteilung einer Sequenz in Bloecke fester Groesse.
 *
 * Wird zweimal gebraucht und ist beide Male dieselbe Operation:
 *   Zellen -> Zeilen  (Blockgroesse = Spaltenzahl)
 *   Zeilen -> Seiten  (Blockgroesse = Zeilen pro Seite)
 */

export class InvalidChunkSizeError extends Error {
  constructor(size: number) {
    super(`Blockgroesse muss eine positive ganze Zahl sein, erhalten: ${size}`);
    this.name = 'InvalidChunkSizeError';
  }
}

/**
 * @throws {InvalidChunkSizeError} bei `size < 1` -- ein solcher Aufruf wuerde
 *         eine Endlosschleife bzw. unendlich viele Seiten erzeugen.
 * @returns Bloecke der Laenge `size`; der letzte darf kuerzer sein.
 *          Leere Eingabe ergibt ein leeres Array (KEINE leere Seite --
 *          diese Entscheidung trifft `buildLayoutModel`).
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isFinite(size) || size < 1) {
    throw new InvalidChunkSizeError(size);
  }

  const blockSize = Math.trunc(size);
  const result: T[][] = [];

  for (let i = 0; i < items.length; i += blockSize) {
    result.push(items.slice(i, i + blockSize));
  }

  return result;
}
