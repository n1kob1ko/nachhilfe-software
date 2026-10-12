/**
 * Prüft die Blockaufteilung aus `lib/druckblatt/rendering/chunk.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/rendering/chunk.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { chunk, InvalidChunkSizeError } from "./chunk";

test("chunk: teilt gleichmaessig auf", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6], 3), [
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("chunk: laesst den letzten Block kuerzer", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("chunk: liefert fuer leere Eingaben ein leeres Array, keine leere Seite", () => {
  assert.deepEqual(chunk([], 4), []);
});

test("chunk: kommt mit Bloecken groesser als die Eingabe zurecht", () => {
  assert.deepEqual(chunk([1, 2], 10), [[1, 2]]);
});

test("chunk: schneidet gebrochene Blockgroessen ab", () => {
  assert.deepEqual(chunk([1, 2, 3, 4], 2.9), [
    [1, 2],
    [3, 4],
  ]);
});

test("chunk: wirft bei Blockgroesse < 1 -- sonst entstuenden unendlich viele Seiten", () => {
  assert.throws(() => chunk([1], 0), InvalidChunkSizeError);
  assert.throws(() => chunk([1], -3), InvalidChunkSizeError);
  assert.throws(() => chunk([1], Number.NaN), InvalidChunkSizeError);
});

test("chunk: kopiert die Eingabe, statt sie zu veraendern", () => {
  const input = [1, 2, 3];
  const result = chunk(input, 2);
  result[0]![0] = 99;
  assert.deepEqual(input, [1, 2, 3]);
});
