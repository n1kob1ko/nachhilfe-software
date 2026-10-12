/**
 * Prüft die Seitengeometrie aus `lib/druckblatt/rendering/geometry.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/rendering/geometry.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mm, pt } from "../units";
import type { Margins, PageConfig, TypographyConfig } from "../definition/types";
import {
  computeCellWidth,
  computePageGeometry,
  computeRowsPerPage,
  deriveMinRowHeight,
  fitColumnGap,
  InvalidGeometryError,
  PAGE_SIZES,
} from "./geometry";

/** Entspricht vitest `toBeCloseTo(wert, stellen)`: |ist - soll| < 0.5 * 10^-stellen. */
function closeTo(ist: number, soll: number, stellen = 2): void {
  const toleranz = 0.5 * 10 ** -stellen;
  assert.ok(Math.abs(ist - soll) < toleranz, `${ist} weicht von ${soll} um mehr als ${toleranz} ab`);
}

const margins = (value: number): Margins => ({
  top: mm(value),
  right: mm(value),
  bottom: mm(value),
  left: mm(value),
});

const page = (overrides: Partial<PageConfig> = {}): PageConfig => ({
  size: "a4",
  orientation: "portrait",
  margins: margins(20),
  ...overrides,
});

const typography: TypographyConfig = {
  fontSize: pt(18),
  lineHeight: 1.4,
  letterSpacing: pt(0),
  bold: false,
};

test("PAGE_SIZES: bildet A4 mit den ISO-Massen ab", () => {
  assert.equal(PAGE_SIZES.a4.width, 210);
  assert.equal(PAGE_SIZES.a4.height, 297);
});

test("computePageGeometry: zieht die Raender von der Blattflaeche ab", () => {
  const geometry = computePageGeometry(page(), mm(0));
  assert.equal(geometry.contentWidth, 170); // 210 - 2*20
  assert.equal(geometry.contentHeight, 257); // 297 - 2*20
});

test("computePageGeometry: tauscht Breite und Hoehe im Querformat", () => {
  const geometry = computePageGeometry(page({ orientation: "landscape" }), mm(0));
  assert.equal(geometry.pageWidth, 297);
  assert.equal(geometry.pageHeight, 210);
  assert.equal(geometry.contentWidth, 257);
});

test("computePageGeometry: zieht den Kopfbereich von der Nutzhoehe ab", () => {
  const geometry = computePageGeometry(page(), mm(20));
  assert.equal(geometry.contentHeight, 257);
  assert.equal(geometry.bodyHeight, 237);
});

test("computePageGeometry: laesst die Nutzhoehe nicht negativ werden", () => {
  const geometry = computePageGeometry(page(), mm(1000));
  assert.equal(geometry.bodyHeight, 0);
});

test("computePageGeometry: wirft, wenn die Raender das Blatt aufbrauchen", () => {
  assert.throws(() => computePageGeometry(page({ margins: margins(150) }), mm(0)), InvalidGeometryError);
});

test("computeCellWidth: verteilt die Breite abzueglich der Zwischenraeume", () => {
  // 170mm, 4 Spalten, 3 Zwischenraeume a 10mm -> 140/4
  assert.equal(computeCellWidth(mm(170), 4, mm(10)), 35);
});

test("computeCellWidth: rechnet ohne Zwischenraum bei einer Spalte", () => {
  assert.equal(computeCellWidth(mm(170), 1, mm(10)), 170);
});

test("computeCellWidth: wirft bei ungueltiger Spaltenzahl", () => {
  assert.throws(() => computeCellWidth(mm(170), 0, mm(0)), InvalidGeometryError);
  assert.throws(() => computeCellWidth(mm(170), 2.5, mm(0)), InvalidGeometryError);
});

test("computeCellWidth: wirft, wenn die Zwischenraeume die Breite aufbrauchen", () => {
  assert.throws(() => computeCellWidth(mm(20), 10, mm(10)), InvalidGeometryError);
});

test("fitColumnGap: laesst einen passenden Abstand unveraendert", () => {
  assert.equal(fitColumnGap(mm(170), 4, mm(10)), 10);
});

test("fitColumnGap: verkleinert einen zu grossen Abstand, statt das Layout zu sprengen", () => {
  // 90mm, 5 Spalten: hoechstens (90 - 5*1) / 4 = 21.25mm Abstand
  assert.equal(fitColumnGap(mm(90), 5, mm(40)), 21.25);
  assert.ok(computeCellWidth(mm(90), 5, fitColumnGap(mm(90), 5, mm(40))) > 0);
});

test("fitColumnGap: liefert bei einer Spalte immer 0 -- dort gibt es keinen Zwischenraum", () => {
  assert.equal(fitColumnGap(mm(170), 1, mm(10)), 0);
});

test("fitColumnGap: wird nie negativ, auch wenn selbst Mindestbreiten nicht passen", () => {
  assert.equal(fitColumnGap(mm(2), 10, mm(10)), 0);
});

test("computeRowsPerPage: beruecksichtigt, dass zwischen n Zeilen nur n-1 Abstaende liegen", () => {
  // 100mm: 5 Zeilen a 18mm + 4 Abstaende a 2mm = 98mm -> passt
  //        6 Zeilen a 18mm + 5 Abstaende a 2mm = 118mm -> passt nicht
  assert.equal(computeRowsPerPage(mm(100), mm(18), mm(2)), 5);
});

test("computeRowsPerPage: rechnet ohne Abstand exakt", () => {
  assert.equal(computeRowsPerPage(mm(100), mm(20), mm(0)), 5);
});

test("computeRowsPerPage: erzeugt durch Float-Rauschen keine Extraseite", () => {
  // 3 * 33.333... mm ergibt binaer minimal mehr als 100mm
  assert.equal(computeRowsPerPage(mm(100), mm(100 / 3), mm(0)), 3);
});

test("computeRowsPerPage: liefert 0, wenn nicht einmal eine Zeile passt", () => {
  assert.equal(computeRowsPerPage(mm(10), mm(20), mm(0)), 0);
  assert.equal(computeRowsPerPage(mm(0), mm(20), mm(0)), 0);
});

test("computeRowsPerPage: wirft bei nicht-positiver Zeilenhoehe", () => {
  assert.throws(() => computeRowsPerPage(mm(100), mm(0), mm(0)), InvalidGeometryError);
  assert.throws(() => computeRowsPerPage(mm(100), mm(-5), mm(0)), InvalidGeometryError);
});

test("deriveMinRowHeight: leitet die Mindesthoehe aus Schriftgroesse und Zeilenhoehe ab", () => {
  // 18pt = 6.35mm, * 1.4
  closeTo(deriveMinRowHeight(typography), 8.89, 2);
});
