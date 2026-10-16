/**
 * Prüft die Schullineaturen aus `lib/druckblatt/rendering/lineatur.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/rendering/lineatur.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mm } from "../units";
import {
  fitWritingLines,
  LINEATUREN,
  LINEATUR_IDS,
  lineaturGeometry,
  writingBlockHeight,
} from "./lineatur";

/*
 * Diese Zahlen sind nachgeschlagen, nicht geschaetzt. Wer sie aendert,
 * aendert damit, wie gross ein Erstklaessler schreibt -- deshalb stehen sie
 * hier noch einmal als Zusage.
 */
test("Lineaturen -- die Maße nach DIN 16552-1: hält die Linienabstände der Klassenstufen ein", () => {
  assert.equal(LINEATUREN.lineatur0.gap, 6);
  assert.equal(LINEATUREN.lineatur1.gap, 5);
  assert.equal(LINEATUREN.lineatur2.gap, 4);
  assert.equal(LINEATUREN.lineatur3.gap, 3.5);
});

test("Lineaturen -- die Maße nach DIN 16552-1: nutzt das Vierliniensystem für die Klassen 1 und 2", () => {
  for (const id of ["lineatur0", "lineatur1", "lineatur2"] as const) {
    assert.deepEqual(LINEATUREN[id].roles, ["oberlinie", "mittellinie", "grundlinie", "unterlinie"]);
  }
});

test("Lineaturen -- die Maße nach DIN 16552-1: kommt ab Klasse 3 mit weniger Linien aus", () => {
  assert.equal(LINEATUREN.lineatur3.roles.length, 2);
  assert.deepEqual(LINEATUREN.lineatur4.roles, ["grundlinie"]);
});

test("Lineaturen -- die Maße nach DIN 16552-1: ordnet jede Lineatur ihrer Klassenstufe zu", () => {
  assert.equal(LINEATUREN.lineatur1.grade, 1);
  assert.equal(LINEATUREN.lineatur2.grade, 2);
  assert.equal(LINEATUREN.blanko.grade, null);
});

test("Lineaturen -- die Maße nach DIN 16552-1: führt jede Kennung als Eintrag", () => {
  for (const id of LINEATUR_IDS) assert.equal(LINEATUREN[id].id, id);
});

test("lineaturGeometry: setzt die vier Linien im Abstand der Lineatur", () => {
  const geometry = lineaturGeometry(LINEATUREN.lineatur1);
  assert.deepEqual(geometry.lines.map((line) => line.offset), [0, 5, 10, 15]);
  assert.equal(geometry.bandHeight, 15);
});

test("lineaturGeometry: rechnet den Zeilenabstand aus Band und Luft", () => {
  /* Lineatur 2: Band 3 x 4 mm = 12 mm, dazu 4 mm Luft. */
  assert.equal(lineaturGeometry(LINEATUREN.lineatur2).pitch, 16);
});

test("lineaturGeometry: lässt die Luft überschreiben", () => {
  const geometry = lineaturGeometry(LINEATUREN.lineatur1, mm(10));
  assert.equal(geometry.bandHeight, 15);
  assert.equal(geometry.pitch, 25);
});

/* Eine einzelne Linie hat kein Band -- die 10 mm sind der Zeilenabstand. */
test("lineaturGeometry: behandelt die Einzellinie ohne Bandhöhe", () => {
  const geometry = lineaturGeometry(LINEATUREN.lineatur4);
  assert.equal(geometry.bandHeight, 0);
  assert.equal(geometry.pitch, 10);
  assert.deepEqual(geometry.lines, [{ role: "grundlinie", offset: 0 }]);
});

test("lineaturGeometry: liefert für blanko gar keine Linien", () => {
  const geometry = lineaturGeometry(LINEATUREN.blanko);
  assert.deepEqual(geometry.lines, []);
  assert.equal(geometry.bandHeight, 0);
});

/*
 * Nach der letzten Zeile steht keine Luft. Sonst haette der Block unten
 * einen Rand, den niemand angefordert hat -- und die Zeilenzahl pro Seite
 * waere systematisch um eins daneben.
 */
test("writingBlockHeight: zählt die Luft nur zwischen den Zeilen", () => {
  const geometry = lineaturGeometry(LINEATUREN.lineatur1); // Band 15, Pitch 20
  assert.equal(writingBlockHeight(geometry, 1), 15);
  assert.equal(writingBlockHeight(geometry, 2), 35);
  assert.equal(writingBlockHeight(geometry, 3), 55);
});

test("writingBlockHeight: ist ohne Zeilen null", () => {
  assert.equal(writingBlockHeight(lineaturGeometry(LINEATUREN.lineatur1), 0), 0);
  assert.equal(writingBlockHeight(lineaturGeometry(LINEATUREN.lineatur1), -3), 0);
});

const lineatur1 = lineaturGeometry(LINEATUREN.lineatur1); // Band 15, Pitch 20

test("fitWritingLines: ist die Umkehrung der Höhenrechnung", () => {
  for (const count of [1, 2, 5, 12]) {
    assert.equal(fitWritingLines(writingBlockHeight(lineatur1, count), lineatur1), count);
  }
});

test("fitWritingLines: rundet ab, statt eine angeschnittene Zeile zu setzen", () => {
  assert.equal(fitWritingLines(mm(34), lineatur1), 1);
  assert.equal(fitWritingLines(mm(35), lineatur1), 2);
});

test("fitWritingLines: liefert null, wenn nicht einmal eine Zeile passt", () => {
  assert.equal(fitWritingLines(mm(10), lineatur1), 0);
  assert.equal(fitWritingLines(mm(0), lineatur1), 0);
  assert.equal(fitWritingLines(mm(-5), lineatur1), 0);
});

/* Fliesskommarauschen darf keine Zeile kosten. */
test("fitWritingLines: verträgt Rundungsrauschen", () => {
  assert.equal(fitWritingLines(mm(35 - 1e-12), lineatur1), 2);
});
