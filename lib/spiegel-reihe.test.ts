import assert from "node:assert/strict";
import test from "node:test";
import { SpiegelReihe } from "./spiegel-reihe";

/** niko 2026-11-24 „immer noch laggy“: the tablet sends without waiting, the teacher puts the packets back in order. */

test("Pakete in Reihenfolge gehen sofort durch", () => {
  const r = new SpiegelReihe<string>();
  assert.deepEqual(r.rein("a", 0, ["x"], 0), [["x"]]);
  assert.deepEqual(r.rein("a", 1, ["y"], 1), [["y"]]);
});

test("ein überholtes Paket wartet auf das davor", () => {
  const r = new SpiegelReihe<string>();
  r.rein("a", 0, ["0"], 0);
  assert.deepEqual(r.rein("a", 2, ["2"], 1), []);
  assert.deepEqual(r.rein("a", 3, ["3"], 2), []);
  assert.equal(r.wartezeit(2), 1499);
  assert.deepEqual(r.rein("a", 1, ["1"], 3), [["1"], ["2"], ["3"]]);
  assert.equal(r.wartezeit(3), null);
});

test("Paket 1 überholt das ganze Bild (0) einer neuen Aufnahme: 0 kommt trotzdem zuerst", () => {
  const r = new SpiegelReihe<string>();
  assert.deepEqual(r.rein("neu", 1, ["1"], 0), []);
  assert.deepEqual(r.rein("neu", 0, ["bild"], 5), [["bild"], ["1"]]);
});

test("ein später zuschauender Lehrer beginnt mitten in der Aufnahme", () => {
  const r = new SpiegelReihe<string>();
  assert.deepEqual(r.rein("a", 500, ["500"], 0), [["500"]]);
  assert.deepEqual(r.rein("a", 499, ["alt"], 1), []);
  assert.deepEqual(r.rein("a", 501, ["501"], 2), [["501"]]);
});

test("ein verlorenes Paket wird nach der Frist übersprungen", () => {
  const r = new SpiegelReihe<string>(1000);
  r.rein("a", 0, ["0"], 0);
  r.rein("a", 2, ["2"], 100);
  r.rein("a", 3, ["3"], 200);
  assert.deepEqual(r.faellig(900), { pakete: [], uebersprungen: false });
  assert.deepEqual(r.faellig(1100), { pakete: [["2"], ["3"]], uebersprungen: true });
  // kommt es doch noch, ist es zu spät
  assert.deepEqual(r.rein("a", 1, ["1"], 1200), []);
  assert.deepEqual(r.rein("a", 4, ["4"], 1300), [["4"]]);
});

test("neue Aufnahme (Tablet neu geladen) fängt von vorne an; doppelte Pakete zählen einmal", () => {
  const r = new SpiegelReihe<string>();
  r.rein("a", 0, ["a0"], 0);
  r.rein("a", 1, ["a1"], 0);
  assert.deepEqual(r.rein("b", 0, ["b0"], 1), [["b0"]]);
  assert.deepEqual(r.rein("b", 0, ["b0"], 2), []);
});

test("alte Tablet-Seite ohne Nummern: wie es kommt", () => {
  const r = new SpiegelReihe<string>();
  assert.deepEqual(r.rein(undefined, undefined, ["x"], 0), [["x"]]);
  assert.deepEqual(r.rein("a", -1, ["y"], 0), [["y"]]);
});

test("ein ganzes Bild hinter einer Lücke wartet nicht auf die verlorenen Pakete davor", () => {
  const r = new SpiegelReihe<string>(1500, (ev) => ev[0] === "bild");
  r.rein("a", 0, ["0"], 0);
  assert.deepEqual(r.rein("a", 2, ["2"], 10), []);
  assert.deepEqual(r.rein("a", 3, ["bild", "x"], 20), [["bild", "x"]]);
  assert.equal(r.wartezeit(20), null);
  assert.deepEqual(r.rein("a", 1, ["1"], 30), []);
  assert.deepEqual(r.rein("a", 4, ["4"], 40), [["4"]]);
});
