/**
 * Prüft `buildTracingLayout`/`fontSizeForBand` aus
 * `lib/druckblatt/rendering/build-tracing-layout.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/rendering/build-tracing-layout.test.ts` übernommen
 * (vitest → node:test, Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede
 * Vitest-Erwartung hat hier eine Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mm } from "../units";
import { DEFAULT_TRACING } from "../definition/tracing-defaults";
import type { TracingDefinition } from "../definition/tracing-types";
import { buildTracingLayout, fontSizeForBand } from "./build-tracing-layout";
import { HANDWRITING_SCRIPTS } from "./handwriting-scripts";
import { LINEATUREN } from "./lineatur";

/** Entspricht vitest `toBeCloseTo(wert, stellen)`: |ist - soll| < 0.5 * 10^-stellen. */
function closeTo(ist: number, soll: number, stellen = 2): void {
  const toleranz = 0.5 * 10 ** -stellen;
  assert.ok(Math.abs(ist - soll) < toleranz, `${ist} weicht von ${soll} um mehr als ${toleranz} ab`);
}

const sheet = (patch: Partial<TracingDefinition> = {}): TracingDefinition => ({
  ...DEFAULT_TRACING,
  ...patch,
});

const allRows = (model: ReturnType<typeof buildTracingLayout>) =>
  model.pages.flatMap((page) => page.rows);

/*
 * Der Kern des Blatts: Ein Kleinbuchstabe füllt das Mittelband. Sonst malt
 * das Kind Formen nach, die nicht zu den Linien gehören.
 */
test("fontSizeForBand -- die Schrift muss ins Band passen: rechnet die Größe so, dass die x-Höhe dem Mittelband entspricht", () => {
  const gap = LINEATUREN.lineatur1.gap; // 5 mm
  const ratio = HANDWRITING_SCRIPTS.druckschrift.xHeightRatio;
  const size = fontSizeForBand(gap, "druckschrift", 1);

  /* Zurückgerechnet: Größe in mm mal Verhältnis ergibt wieder das Band. */
  const xHeightMm = (size * 25.4) / 72 / (1 / ratio);
  closeTo(xHeightMm, gap, 3);
});

test("fontSizeForBand -- die Schrift muss ins Band passen: wird bei engerer Lineatur kleiner", () => {
  assert.ok(
    fontSizeForBand(LINEATUREN.lineatur2.gap, "druckschrift", 1) <
      fontSizeForBand(LINEATUREN.lineatur1.gap, "druckschrift", 1),
  );
});

test("fontSizeForBand -- die Schrift muss ins Band passen: folgt der Feinjustierung", () => {
  const base = fontSizeForBand(mm(5), "druckschrift", 1);
  closeTo(fontSizeForBand(mm(5), "druckschrift", 1.2), base * 1.2, 3);
});

/* Ein Blatt ohne Linien darf nicht mit unsichtbar kleiner Schrift entstehen. */
test("fontSizeForBand -- die Schrift muss ins Band passen: nimmt ohne Band ein Ersatzmaß", () => {
  assert.ok(fontSizeForBand(mm(0), "druckschrift", 1) > 0);
});

test("fontSizeForBand -- die Schrift muss ins Band passen: berücksichtigt die x-Höhe der jeweiligen Schrift", () => {
  /* Die Schreibschriften haben eine kleinere x-Höhe und brauchen deshalb
   * eine größere Schriftgröße für dasselbe Band. */
  assert.ok(fontSizeForBand(mm(5), "va", 1) > fontSizeForBand(mm(5), "druckschrift", 1));
});

test("buildTracingLayout -- Zeilen: macht aus jedem Buchstaben eine Übungszeile", () => {
  const model = buildTracingLayout(
    sheet({ content: "a b c", rows: { ...DEFAULT_TRACING.rows, freeRows: 0 } }),
  );
  assert.equal(model.itemCount, 3);
  assert.equal(allRows(model).length, 3);
});

/* Nach dem Nachfahren soll das Kind frei schreiben — sonst endet die Übung
 * beim Nachfahren, und genau das ist nicht das Ziel. */
test("buildTracingLayout -- Zeilen: hängt die freien Zeilen an jede Vorlagenzeile", () => {
  const model = buildTracingLayout(
    sheet({ content: "a b", rows: { ...DEFAULT_TRACING.rows, freeRows: 2 } }),
  );
  const rows = allRows(model);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((row) => row.cells.length > 0), [true, false, false, true, false, false]);
});

test("buildTracingLayout -- Zeilen: gibt freien Zeilen dieselben Linien wie den Vorlagenzeilen", () => {
  const model = buildTracingLayout(
    sheet({ content: "a", rows: { ...DEFAULT_TRACING.rows, freeRows: 1 } }),
  );
  const [first, second] = allRows(model);
  assert.deepEqual(second!.lines, first!.lines);
  assert.equal(second!.bandHeight, first!.bandHeight);
});

test("buildTracingLayout -- Zeilen: teilt die Breite gleichmäßig auf die Wiederholungen", () => {
  const model = buildTracingLayout(sheet({ rows: { ...DEFAULT_TRACING.rows, repeats: 6 } }));
  /* A4 mit 15 mm Rand: 180 mm auf sechs Felder. */
  closeTo(allRows(model)[0]!.cellWidth, 30);
});

test("buildTracingLayout -- Zeilen: setzt Silben und Wörter statt Buchstaben", () => {
  const silben = buildTracingLayout(sheet({ unit: "syllable", content: "Ma Me Mi" }));
  assert.equal(silben.itemCount, 3);
  assert.equal(silben.pages[0]!.rows[0]!.cells[0]!.text, "Ma");
});

test("buildTracingLayout -- Zeilen: kommt ohne Inhalt mit einer leeren Seite zurecht", () => {
  const model = buildTracingLayout(sheet({ content: "" }));
  assert.equal(model.itemCount, 0);
  assert.equal(model.pages.length, 1);
  assert.deepEqual(model.pages[0]!.rows, []);
});

test("buildTracingLayout -- Schriftwahl: meldet keine Ersetzung, wenn die Datei vorliegt", () => {
  const model = buildTracingLayout(sheet({ script: "druckschrift" }));
  assert.equal(model.metrics.script, "druckschrift");
  assert.equal(model.metrics.scriptSubstituted, false);
});

/*
 * Ein Nachmalblatt in der falschen Schrift wäre schlimmer als eines, das
 * sagt, dass die Schrift fehlt — das Kind übt sonst die falschen Formen.
 */
test("buildTracingLayout -- Schriftwahl: fällt sichtbar zurück, wenn die Schriftdatei fehlt", () => {
  const model = buildTracingLayout(sheet({ script: "va" }));
  assert.equal(model.metrics.script, "druckschrift");
  assert.equal(model.metrics.scriptSubstituted, true);
});

test("buildTracingLayout -- Umbruch: bleibt bei wenigen Zeilen auf einer Seite", () => {
  assert.equal(buildTracingLayout(DEFAULT_TRACING).pages.length, 1);
});

test("buildTracingLayout -- Umbruch: bricht bei vielen Zeilen um", () => {
  const model = buildTracingLayout(
    sheet({ content: "abcdefghijklmnopqrstuvwxyz", rows: { ...DEFAULT_TRACING.rows, freeRows: 2 } }),
  );
  assert.ok(model.pages.length > 1);
});

test("buildTracingLayout -- Umbruch: verliert dabei keine Zeile", () => {
  const model = buildTracingLayout(
    sheet({ content: "abcdefghijklmnopqrstuvwxyz", rows: { ...DEFAULT_TRACING.rows, freeRows: 2 } }),
  );
  assert.equal(allRows(model).length, 26 * 3);
});

test("buildTracingLayout -- Umbruch: nummeriert die Zeilen über Seitengrenzen hinweg durch", () => {
  const model = buildTracingLayout(sheet({ content: "abcdefghijklmnopqrstuvwxyz" }));
  assert.deepEqual(
    allRows(model).map((row) => row.index),
    Array.from({ length: allRows(model).length }, (_, index) => index),
  );
});

/* Der Kopfbereich steht nur auf Seite eins — ab Seite zwei ist mehr Platz. */
test("buildTracingLayout -- Umbruch: setzt auf die Folgeseiten mehr Zeilen als auf die erste", () => {
  const model = buildTracingLayout(
    sheet({ content: "abcdefghijklmnopqrstuvwxyz", rows: { ...DEFAULT_TRACING.rows, freeRows: 1 } }),
  );
  assert.ok(model.pages[1]!.rows.length > model.pages[0]!.rows.length);
  assert.equal(model.pages[1]!.header, null);
});
