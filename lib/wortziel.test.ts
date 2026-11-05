import assert from "node:assert/strict";
import { test } from "node:test";
import { wortzielAusAufgabe } from "./wortziel";

test("Wortziel aus der Aufgabenstellung", () => {
  assert.equal(wortzielAusAufgabe("Beschreibe deinen Lieblingsort in Graz (ca. 120 Wörter). Achte auf Beistriche."), 120);
  assert.equal(wortzielAusAufgabe("Schreibe mindestens 200 Wörter."), 200);
  assert.equal(wortzielAusAufgabe("Umfang: 250–300 Wörter"), 280);
  assert.equal(wortzielAusAufgabe("Write about 150 words."), 150);
  assert.equal(wortzielAusAufgabe("Write 200 to 250 words."), 230);
  assert.equal(wortzielAusAufgabe("Erzähle von deinem Ausflug."), null);
  assert.equal(wortzielAusAufgabe("Lies die 3 Wörter vor."), null);
  assert.equal(wortzielAusAufgabe(null), null);
});
