/**
 * Das Ende eines Tests am Gerät (Minitest, Lernkontrolle, Probeschularbeit): nur geprüfte Antworten zählen. Was die Lehrkraft
 * noch bewertet, steht nie als falsch da („0 von 4 richtig“, solange alle vier warten, war eine erfundene Note).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { testErgebnis } from "./tasks";

test("test end: nothing waits → x von N richtig; all wait → abgegeben; some wait → only the checked ones", () => {
  assert.equal(testErgebnis(3, 4, 0), "3 von 4 richtig");
  assert.equal(testErgebnis(0, 4, 0), "0 von 4 richtig");
  assert.equal(testErgebnis(0, 4, 4), "4 von 4 abgegeben", "a Probeschularbeit with free answers: never „0 von 4 richtig“");
  assert.equal(testErgebnis(1, 4, 2), "Bisher 1 von 2 richtig");
  assert.equal(testErgebnis(0, 4, 3, 3), "3 von 4 abgegeben", "one left out: not counted as handed in");
  assert.equal(testErgebnis(2, 5, 1, 4), "Bisher 2 von 3 richtig");
});
