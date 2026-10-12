/**
 * Prüft die Wertebereiche aus `lib/druckblatt/definition/constraints.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/worksheet/constraints.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { clamp, clampInt, CONSTRAINTS } from "./constraints";

test("clamp: laesst gueltige Werte unveraendert", () => {
  assert.equal(clamp(18, "fontSize"), 18);
});

test("clamp: begrenzt nach unten und oben", () => {
  assert.equal(clamp(2, "fontSize"), CONSTRAINTS.fontSize.min);
  assert.equal(clamp(999, "fontSize"), CONSTRAINTS.fontSize.max);
});

test("clamp: faengt NaN und Infinity ab", () => {
  assert.equal(clamp(Number.NaN, "columns"), CONSTRAINTS.columns.min);
  assert.equal(clamp(Number.POSITIVE_INFINITY, "columns"), CONSTRAINTS.columns.max);
  assert.equal(clamp(Number.NEGATIVE_INFINITY, "columns"), CONSTRAINTS.columns.min);
});

test("clampInt: schneidet Nachkommastellen ab", () => {
  assert.equal(clampInt(4.9, "columns"), 4);
});

test("clampInt: liefert nie einen Wert unter 1 Spalte -- sonst teilt der Layouter durch 0", () => {
  assert.equal(clampInt(0, "columns"), 1);
  assert.equal(clampInt(-5, "columns"), 1);
});
