/**
 * Prüft die Umrechnung Millimeter → Bildpunkte (`lib/druckblatt/state/zoom.ts`).
 *
 * Das ist die eine Rechnung, die zwischen dem Papier und dem Bildschirm steht:
 * Das Blatt wird immer in Millimetern gesetzt und für die Vorschau nur skaliert.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CONSTRAINTS } from "../definition/constraints";
import { FIT_PADDING_PX, PX_PER_MM, begrenzeZoom, zoomFuerBreite } from "./zoom";

test("zoom: rechnet nach der CSS-Referenz um (96 dpi)", () => {
  assert.equal(Math.round(PX_PER_MM * 1000) / 1000, 3.78);
  /* Eine A4-Breite von 210 mm sind rund 794 Bildpunkte. */
  assert.equal(Math.round(210 * PX_PER_MM), 794);
});

test("zoom: passt ein A4-Blatt in einen 1000 px breiten Behälter", () => {
  const zoom = zoomFuerBreite(1000, 210);
  assert.equal(zoom, begrenzeZoom((1000 - FIT_PADDING_PX) / (210 * PX_PER_MM)));
  assert.ok(zoom !== null && zoom > 0.9 && zoom < 1.3);
});

test("zoom: lässt einen Rand frei, damit das Blatt nicht klebt", () => {
  const zoom = zoomFuerBreite(210 * PX_PER_MM, 210);
  assert.ok(zoom !== null && zoom < 1);
});

test("zoom: begrenzt auf den erlaubten Bereich", () => {
  assert.equal(zoomFuerBreite(100_000, 210), CONSTRAINTS.zoom.max);
  assert.equal(zoomFuerBreite(1, 210), CONSTRAINTS.zoom.min);
});

test("zoom: meldet einen unmessbaren Behälter als null", () => {
  assert.equal(zoomFuerBreite(0, 210), null);
  assert.equal(zoomFuerBreite(-40, 210), null);
  assert.equal(zoomFuerBreite(Number.NaN, 210), null);
  assert.equal(zoomFuerBreite(1000, 0), null);
  assert.equal(zoomFuerBreite(1000, Number.NaN), null);
});

test("begrenzeZoom: klemmt wie die Definition es erlaubt", () => {
  assert.equal(begrenzeZoom(1.5), 1.5);
  assert.equal(begrenzeZoom(99), CONSTRAINTS.zoom.max);
  assert.equal(begrenzeZoom(Number.NaN), CONSTRAINTS.zoom.min);
});
