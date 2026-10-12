/**
 * Prüft die Silbentrennung aus `lib/druckblatt/language/syllables.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/language/syllables.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { countSyllables, splitIntoSyllables } from "./syllables";

test("splitIntoSyllables -- Grundregeln: gibt einen einzelnen Konsonanten an die zweite Silbe ab", () => {
  assert.deepEqual(splitIntoSyllables("Vater"), ["Va", "ter"]);
  assert.deepEqual(splitIntoSyllables("Blume"), ["Blu", "me"]);
  assert.deepEqual(splitIntoSyllables("Mama"), ["Ma", "ma"]);
});

test("splitIntoSyllables -- Grundregeln: laesst bei mehreren Konsonanten nur den letzten zur zweiten Silbe wandern", () => {
  assert.deepEqual(splitIntoSyllables("Fenster"), ["Fens", "ter"]);
  assert.deepEqual(splitIntoSyllables("Wasser"), ["Was", "ser"]);
  assert.deepEqual(splitIntoSyllables("Quelle"), ["Quel", "le"]);
});

test("splitIntoSyllables -- Grundregeln: trennt direkt, wenn zwei Vokalkerne aufeinandertreffen", () => {
  assert.deepEqual(splitIntoSyllables("Bauer"), ["Bau", "er"]);
});

test("splitIntoSyllables -- Grundregeln: verarbeitet mehr als zwei Silben", () => {
  assert.deepEqual(splitIntoSyllables("Elefant"), ["E", "le", "fant"]);
});

test("splitIntoSyllables -- unteilbare Buchstabengruppen: haelt sch, ch, ck, ph, th und qu zusammen", () => {
  assert.deepEqual(splitIntoSyllables("Schule"), ["Schu", "le"]);
  assert.deepEqual(splitIntoSyllables("lachen"), ["la", "chen"]);
  assert.deepEqual(splitIntoSyllables("Zucker"), ["Zu", "cker"]);
  assert.deepEqual(splitIntoSyllables("Mathe"), ["Ma", "the"]);
  assert.deepEqual(splitIntoSyllables("Sophie"), ["So", "phie"]);
});

test("splitIntoSyllables -- unteilbare Buchstabengruppen: trennt st, pf, tz und ng nach aktueller Rechtschreibung", () => {
  assert.deepEqual(splitIntoSyllables("Apfel"), ["Ap", "fel"]);
  assert.deepEqual(splitIntoSyllables("Katze"), ["Kat", "ze"]);
  assert.deepEqual(splitIntoSyllables("singen"), ["sin", "gen"]);
});

test("splitIntoSyllables -- unteilbare Buchstabengruppen: behandelt Diphthonge als einen Silbenkern", () => {
  assert.deepEqual(splitIntoSyllables("Auto"), ["Au", "to"]);
  assert.deepEqual(splitIntoSyllables("Haus"), ["Haus"]);
});

test("splitIntoSyllables -- unteilbare Buchstabengruppen: behandelt ss und ss-Ersatz korrekt", () => {
  assert.deepEqual(splitIntoSyllables("Strasse"), ["Stras", "se"]);
  assert.deepEqual(splitIntoSyllables("Straße"), ["Stra", "ße"]);
});

test("splitIntoSyllables -- Randfaelle: liefert fuer leere Eingaben ein leeres Array", () => {
  assert.deepEqual(splitIntoSyllables(""), []);
  assert.deepEqual(splitIntoSyllables("   "), []);
});

test("splitIntoSyllables -- Randfaelle: gibt einsilbige und vokallose Woerter unveraendert zurueck", () => {
  assert.deepEqual(splitIntoSyllables("a"), ["a"]);
  assert.deepEqual(splitIntoSyllables("Ma"), ["Ma"]);
  assert.deepEqual(splitIntoSyllables("pfff"), ["pfff"]);
});

test("splitIntoSyllables -- Randfaelle: erhaelt die Gross- und Kleinschreibung", () => {
  assert.deepEqual(splitIntoSyllables("VATER"), ["VA", "TER"]);
});

test("splitIntoSyllables -- Randfaelle: respektiert einen manuell gesetzten Bindestrich als Silbengrenze", () => {
  // Ohne Bindestrich scheitert die Heuristik an Komposita -- das ist der
  // dokumentierte Ausweg fuer die Lehrkraft.
  assert.deepEqual(splitIntoSyllables("Haustür"), ["Haus", "tür"]);
  assert.deepEqual(splitIntoSyllables("Haus-tür"), ["Haus-", "tür"]);
  assert.deepEqual(splitIntoSyllables("Regenbogen"), ["Re", "gen", "bo", "gen"]);
});

/*
 * Invariante des gesamten Verfahrens: Silben duerfen Zeichen umsortieren
 * oder verlieren -- deshalb wird sie hier explizit festgenagelt.
 * Bricht dieser Test, ist die Anzeige auf dem Arbeitsblatt falsch.
 */
test("splitIntoSyllables -- Randfaelle: rekonstruiert das Eingabewort verlustfrei", () => {
  const words = [
    "Vater",
    "Fenster",
    "Schule",
    "Elefant",
    "Zucker",
    "Auto",
    "Straße",
    "Haus-tür",
    "Bauer",
    "pfff",
  ];
  for (const word of words) {
    assert.equal(splitIntoSyllables(word).join(""), word);
  }
});

test("countSyllables: zaehlt die Silben", () => {
  assert.equal(countSyllables("Elefant"), 3);
  assert.equal(countSyllables("Haus"), 1);
  assert.equal(countSyllables(""), 0);
});
