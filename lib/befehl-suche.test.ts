import { test } from "node:test";
import assert from "node:assert/strict";
import { befehlTreffer } from "./befehl-suche";

test("Befehlsmenü: der Anfang des Namens zählt am meisten", () => {
  assert.equal(befehlTreffer("Anna Gruber 3. Kl. AHS", "ann"), 1);
  assert.ok(befehlTreffer("Anna Gruber 3. Kl. AHS", "gru") < 1);
  assert.ok(befehlTreffer("Anna Gruber 3. Kl. AHS", "gru") > befehlTreffer("Alle Einheiten", "gru", ["Wer hat wann mit wem gearbeitet, Gruppen"]));
});

test("Befehlsmenü: kein Raten über verstreute Buchstaben", () => {
  assert.equal(befehlTreffer("Alle Einheiten", "ann", ["Wer hat wann mit wem gearbeitet, pro Monat"]), 0);
  assert.equal(befehlTreffer("Planung", "ann"), 0);
  assert.equal(befehlTreffer("Heute", "xyz"), 0);
});

test("Befehlsmenü: Umlaute und ß sind egal", () => {
  assert.equal(befehlTreffer("Schüler", "schuler"), 1);
  assert.equal(befehlTreffer("Übung erstellen", "ubung"), 1);
  assert.ok(befehlTreffer("Räume", "Raume") > 0);
});

test("Befehlsmenü: zusammengesetzte Wörter erst ab drei Buchstaben", () => {
  assert.ok(befehlTreffer("Schülergeräte", "geräte") > 0);
  assert.ok(befehlTreffer("Aufgabenbibliothek", "bib") > 0);
  assert.equal(befehlTreffer("Schüler", "le"), 0);
  assert.ok(befehlTreffer("Lena Berger", "le") > 0);
});

test("Befehlsmenü: mehrere Wörter müssen alle vorkommen", () => {
  assert.ok(befehlTreffer("Anna Gruber 3. Kl. AHS", "anna ahs") > 0);
  assert.equal(befehlTreffer("Anna Gruber 3. Kl. AHS", "anna ms"), 0);
});

test("Befehlsmenü: die Beschreibung der Seite findet sie auch", () => {
  const n = befehlTreffer("Abrechnung", "csv", ["Stattgefundene Einheiten pro Monat, auch als CSV"]);
  assert.ok(n > 0 && n < befehlTreffer("Abrechnung", "abr"));
});
