/**
 * Prüft die Silbenmatrix aus `lib/druckblatt/content/matrix.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/content/matrix.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateSyllableMatrix, type SyllableMatrixConfig } from "./matrix";

const base: SyllableMatrixConfig = {
  onsets: ["M", "L"],
  nuclei: ["a", "e", "i"],
  coda: "",
  order: "onset-major",
  capitalize: false,
};

test("generateSyllableMatrix: kombiniert anlautweise und setzt die Spaltenzahl auf die Vokalanzahl", () => {
  const result = generateSyllableMatrix(base);
  assert.deepEqual(result.cells, ["Ma", "Me", "Mi", "La", "Le", "Li"]);
  assert.equal(result.columns, 3);
});

test("generateSyllableMatrix: kombiniert vokalweise und setzt die Spaltenzahl auf die Anlautanzahl", () => {
  const result = generateSyllableMatrix({ ...base, order: "nucleus-major" });
  assert.deepEqual(result.cells, ["Ma", "La", "Me", "Le", "Mi", "Li"]);
  assert.equal(result.columns, 2);
});

test("generateSyllableMatrix: haengt einen Auslaut an", () => {
  const result = generateSyllableMatrix({ ...base, nuclei: ["a"], coda: "n" });
  assert.deepEqual(result.cells, ["Man", "Lan"]);
});

test("generateSyllableMatrix: schreibt auf Wunsch gross", () => {
  const result = generateSyllableMatrix({
    ...base,
    onsets: ["m"],
    nuclei: ["a", "e"],
    capitalize: true,
  });
  assert.deepEqual(result.cells, ["Ma", "Me"]);
});

test("generateSyllableMatrix: verwirft leere Achseneintraege", () => {
  const result = generateSyllableMatrix({ ...base, onsets: ["M", "  ", ""], nuclei: ["a"] });
  assert.deepEqual(result.cells, ["Ma"]);
  assert.equal(result.columns, 1);
});

test("generateSyllableMatrix: liefert bei leerer Achse ein leeres Ergebnis statt eines Fehlers", () => {
  assert.deepEqual(generateSyllableMatrix({ ...base, onsets: [] }), { cells: [], columns: 1 });
  assert.deepEqual(generateSyllableMatrix({ ...base, nuclei: ["  "] }), { cells: [], columns: 1 });
});

test("generateSyllableMatrix: erzeugt fuer jede Kombination genau eine Zelle", () => {
  const result = generateSyllableMatrix({
    ...base,
    onsets: ["M", "L", "S", "F"],
    nuclei: ["a", "e", "i", "o", "u"],
  });
  assert.equal(result.cells.length, 20);
  assert.equal(new Set(result.cells).size, 20);
});
