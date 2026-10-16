/**
 * Prüft die Wortlisten-Ein- und -Ausgabe aus `lib/druckblatt/content/word-list.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/content/word-list.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { formatWordList, parseWordList } from "./word-list";

test("parseWordList: trennt an Zeilenumbruch, Komma, Semikolon und Tabulator", () => {
  assert.deepEqual(parseWordList("Hund\nKatze,Maus;Vogel\tFisch"), [
    "Hund",
    "Katze",
    "Maus",
    "Vogel",
    "Fisch",
  ]);
});

test("parseWordList: entfernt Leerraum und leere Eintraege", () => {
  assert.deepEqual(parseWordList("  Hund  ,, \n\n  Katze "), ["Hund", "Katze"]);
});

test("parseWordList: behaelt Leerzeichen innerhalb eines Eintrags", () => {
  assert.deepEqual(parseWordList("Guten Morgen\nHallo"), ["Guten Morgen", "Hallo"]);
});

test("parseWordList: kommt mit Windows-Zeilenenden zurecht", () => {
  assert.deepEqual(parseWordList("Hund\r\nKatze"), ["Hund", "Katze"]);
});

test("parseWordList: liefert fuer leere Eingaben ein leeres Array", () => {
  assert.deepEqual(parseWordList(""), []);
  assert.deepEqual(parseWordList("  \n , ; "), []);
});

test("formatWordList: schreibt einen Eintrag je Zeile", () => {
  assert.equal(formatWordList(["Hund", "Katze"]), "Hund\nKatze");
});

test("formatWordList: ist zum Parser invers", () => {
  const words = ["Hund", "Katze", "Guten Morgen"];
  assert.deepEqual(parseWordList(formatWordList(words)), words);
});
