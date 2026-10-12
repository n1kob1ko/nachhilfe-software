/**
 * Prüft die Millimeter- und Punktrechnung aus `lib/druckblatt/units.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/units.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 *
 * Liegt bewusst INNERHALB von `lib/druckblatt/`: `lib/units.ts` dieses Repos meint Einheiten
 * (Nachhilfestunden), nicht Millimeter. Der Merge-Plan warnt ausdrücklich vor der Namensgleichheit.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { addMm, cssMm, cssPt, maxMm, mm, mmToPt, pt, ptToMm, scaleMm, subMm } from "./units";

/** Entspricht vitest `toBeCloseTo(wert, stellen)`: |ist - soll| < 0.5 * 10^-stellen. */
function closeTo(ist: number, soll: number, stellen = 2): void {
  const toleranz = 0.5 * 10 ** -stellen;
  assert.ok(Math.abs(ist - soll) < toleranz, `${ist} weicht von ${soll} um mehr als ${toleranz} ab`);
}

// ---------- Einheitenumrechnung ----------

test("Einheitenumrechnung: rechnet 72pt in exakt 25.4mm um", () => {
  closeTo(ptToMm(pt(72)), 25.4, 10);
});

test("Einheitenumrechnung: rechnet 25.4mm in exakt 72pt um", () => {
  closeTo(mmToPt(mm(25.4)), 72, 10);
});

test("Einheitenumrechnung: ist verlustfrei umkehrbar", () => {
  closeTo(mmToPt(ptToMm(pt(18))), 18, 10);
});

// ---------- Arithmetik ----------

test("Arithmetik: addiert mehrere Millimeterwerte", () => {
  assert.equal(addMm(mm(10), mm(5), mm(2.5)), 17.5);
});

test("Arithmetik: addiert ohne Argumente zu 0", () => {
  assert.equal(addMm(), 0);
});

test("Arithmetik: subtrahiert und skaliert", () => {
  assert.equal(subMm(mm(20), mm(7)), 13);
  assert.equal(scaleMm(mm(10), 1.5), 15);
});

test("Arithmetik: liefert das Maximum", () => {
  assert.equal(maxMm(mm(4), mm(9), mm(6)), 9);
});

// ---------- CSS-Ausgabe ----------

test("CSS-Ausgabe: haengt die Einheit an", () => {
  assert.equal(cssMm(mm(210)), "210mm");
  assert.equal(cssPt(pt(18)), "18pt");
});

test("CSS-Ausgabe: rundet Float-Rauschen auf 3 Nachkommastellen weg", () => {
  assert.equal(cssMm(mm(0.1 + 0.2)), "0.3mm");
  assert.equal(cssMm(ptToMm(pt(18))), "6.35mm");
});
