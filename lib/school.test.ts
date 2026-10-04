import assert from "node:assert/strict";
import test from "node:test";
import { klassenLabel, migrateLegacy, rangeLabel, schulstufe } from "./school";

test("Austrian classes map onto the continuous Schulstufe", () => {
  assert.equal(schulstufe("Volksschule", 3), 3);
  assert.equal(schulstufe("Mittelschule", 1), 5);
  assert.equal(schulstufe("Gymnasium", 4), 8);
  assert.equal(schulstufe("Gymnasium", 5), 9);
  assert.equal(schulstufe("HTL", 1), 9);
  assert.equal(schulstufe("HAK", 5), 13);
  assert.equal(schulstufe("Mittelschule", 7), 8, "class is clamped to the school type");
});

test("labels read the way tutors talk", () => {
  assert.equal(klassenLabel("Mittelschule", 2), "2. Klasse Mittelschule");
  assert.equal(klassenLabel("Gymnasium", 6), "6. Klasse Gymnasium (Oberstufe)");
  assert.equal(klassenLabel("HAK", 1, { short: true }), "1. Kl. HAK");
  assert.equal(rangeLabel(5, 9), "MS 1–4 · AHS 1–5 · HTL/HAK 1");
});

test("old Schulstufe rows are migrated to school type and class", () => {
  assert.deepEqual(migrateLegacy("AHS-Oberstufe", 10), { type: "Gymnasium", klasse: 6 });
  assert.deepEqual(migrateLegacy("Mittelschule", 6), { type: "Mittelschule", klasse: 2 });
  assert.deepEqual(migrateLegacy("BHS (HAK, HTL, HLW …)", 11), { type: "HTL", klasse: 3 });
});
