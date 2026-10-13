import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv, toCsv, unprotectCell } from "./csv";

/**
 * Der CSV-Leser der Phase 7. Gelesen wird genau das Format, das `toCsv` schreibt — Semikolon,
 * UTF-8 mit oder ohne BOM, CRLF oder LF, Anführungszeichen mit `""` als Escape, Semikolon und
 * Zeilenumbruch auch **innerhalb** eines Feldes.
 */
test("parseCsv liest BOM, Anführungszeichen, Semikolon und Zeilenumbruch im Feld", () => {
  const text = '\uFEFFName;Notiz;Zahl\r\nMax;"Er sagte ""ja""; gut";3\r\nAnna;"zwei\nZeilen";4\r\n';
  const rows = parseCsv(text);
  assert.deepEqual(rows, [
    ["Name", "Notiz", "Zahl"],
    ["Max", 'Er sagte "ja"; gut', "3"],
    ["Anna", "zwei\nZeilen", "4"],
  ]);
  // jede Zelle ist Text — auch die, die wie eine Zahl aussieht
  assert.equal(typeof rows[1][2], "string");
  assert.equal(rows[1][2], "3");
});

test("parseCsv: LF ohne BOM, kein Zeilenumbruch am Ende, leere Datei", () => {
  assert.deepEqual(parseCsv("a;b\nc;d"), [
    ["a", "b"],
    ["c", "d"],
  ]);
  // ein Umbruch am Ende macht keine leere Zeile
  assert.deepEqual(parseCsv("a;b\n"), [["a", "b"]]);
  assert.deepEqual(parseCsv("a;b\r\n"), [["a", "b"]]);
  assert.deepEqual(parseCsv(""), []);
  // ein leeres Feld am Ende der Zeile bleibt erhalten
  assert.deepEqual(parseCsv("a;;\r\n"), [["a", "", ""]]);
  // ein Anführungszeichen mitten im Feld ist ein normales Zeichen
  assert.deepEqual(parseCsv('Er sagte "ja";x'), [['Er sagte "ja"', "x"]]);
  assert.deepEqual(parseCsv('"";x'), [["", "x"]]);
});

test("parseCsv und toCsv sind ein Umlauf: der Export liest sich unverändert zurück", () => {
  const headers = ["Name", "Notiz", "Zahl"];
  const rows = [
    ["Max; Huber", 'Er sagte "ja"; gut', 3],
    ["Anna\nZeile", "=SUMME(A1)", "-1"],
    ["", "normal", null],
  ];
  assert.deepEqual(parseCsv(toCsv(headers, rows)), [
    ["Name", "Notiz", "Zahl"],
    ["Max; Huber", 'Er sagte "ja"; gut', "3"],
    ["Anna\nZeile", "'=SUMME(A1)", "'-1"],
    ["", "normal", ""],
  ]);
});

test("die Textmarke des Exports fällt beim Lesen weg — eine Zelle bleibt Text", () => {
  assert.equal(unprotectCell("'=SUMME(A1)"), "=SUMME(A1)");
  assert.equal(unprotectCell("'+1"), "+1");
  assert.equal(unprotectCell("'-1"), "-1");
  assert.equal(unprotectCell("'@x"), "@x");
  // nur die Marke des Exports: ein Apostroph vor normalem Text bleibt stehen
  assert.equal(unprotectCell("'ne Sache"), "'ne Sache");
  assert.equal(unprotectCell("Max"), "Max");
  const csv = toCsv(["a"], [["=SUMME(A1)"], ["-1"], ["+2"], ["@x"]]);
  assert.deepEqual(
    parseCsv(csv).slice(1).map((r) => unprotectCell(r[0])),
    ["=SUMME(A1)", "-1", "+2", "@x"],
  );
});
