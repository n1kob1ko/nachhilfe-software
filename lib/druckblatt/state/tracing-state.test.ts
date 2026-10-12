/**
 * Prüft den Reducer des Nachmalblatts (`lib/druckblatt/state/tracing-state.ts`).
 *
 * Port von `aufgaben_webseite/src/features/letter-tracing/store/tracing-store.test.ts`
 * (vitest → node:test, Zustand-Store → reiner Reducer).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CONSTRAINTS } from "../definition/constraints";
import { DEFAULT_TRACING } from "../definition/tracing-defaults";
import { buildTracingLayout } from "../rendering/build-tracing-layout";
import {
  NACHMALBLATT_START,
  mergeTracing,
  nachmalblattReducer,
  sanitizeRows,
  sanitizeTracingLines,
  type NachmalblattAktion,
  type NachmalblattZustand,
} from "./tracing-state";

const mach = (aktionen: readonly NachmalblattAktion[]): NachmalblattZustand =>
  aktionen.reduce(nachmalblattReducer, NACHMALBLATT_START);

const definition = (aktionen: readonly NachmalblattAktion[]) => mach(aktionen).definition;

/* --- Startzustand --------------------------------------------------------- */

test("nachmalblatt: zeigt ein fertiges Blatt", () => {
  assert.deepEqual(NACHMALBLATT_START.definition, DEFAULT_TRACING);
  assert.equal(buildTracingLayout(DEFAULT_TRACING).pages.length, 1);
});

test("nachmalblatt: beginnt mit Druckschrift — der einzigen mitgelieferten", () => {
  assert.equal(NACHMALBLATT_START.definition.script, "druckschrift");
});

/* --- Inhalt --------------------------------------------------------------- */

test("nachmalblatt: übernimmt getippten Text", () => {
  assert.equal(definition([{ art: "inhalt", content: "m n o" }]).content, "m n o");
});

/* Wer „a–z" wählt und danach „Umlaute", will beides — nicht nur das zweite. */
test("nachmalblatt: hängt Vorlagen an, statt zu ersetzen", () => {
  const danach = definition([
    { art: "inhalt", content: "a b" },
    { art: "inhaltAnhaengen", text: "ä ö" },
  ]);
  assert.equal(danach.content, "a b ä ö");
});

test("nachmalblatt: hängt an leeren Inhalt ohne führendes Leerzeichen an", () => {
  const danach = definition([
    { art: "inhalt", content: "   " },
    { art: "inhaltAnhaengen", text: "a b" },
  ]);
  assert.equal(danach.content, "a b");
});

test("nachmalblatt: wechselt die Einheit", () => {
  assert.equal(definition([{ art: "einheit", unit: "word" }]).unit, "word");
});

/* --- Hilfen --------------------------------------------------------------- */

test("nachmalblatt: begrenzt die Wiederholungen", () => {
  assert.equal(
    definition([{ art: "uebungszeilen", patch: { repeats: 999 } }]).rows.repeats,
    CONSTRAINTS.traceRepeats.max,
  );
  assert.equal(
    definition([{ art: "uebungszeilen", patch: { repeats: 0 } }]).rows.repeats,
    CONSTRAINTS.traceRepeats.min,
  );
});

test("nachmalblatt: begrenzt die freien Zeilen", () => {
  assert.equal(
    definition([{ art: "uebungszeilen", patch: { freeRows: 99 } }]).rows.freeRows,
    CONSTRAINTS.traceFreeRows.max,
  );
});

test("nachmalblatt: übernimmt Darstellung und Verlauf", () => {
  const rows = definition([{ art: "uebungszeilen", patch: { style: "outline", fade: "half" } }]).rows;
  assert.equal(rows.style, "outline");
  assert.equal(rows.fade, "half");
});

test("nachmalblatt: lässt die Vorlage abschalten", () => {
  assert.equal(definition([{ art: "uebungszeilen", patch: { showModel: false } }]).rows.showModel, false);
});

/* --- Schrift und Größe ---------------------------------------------------- */

test("nachmalblatt: wechselt die Schrift", () => {
  assert.equal(definition([{ art: "schulschrift", script: "va" }]).script, "va");
});

/* Die Schrift ist wählbar, auch wenn die Datei fehlt — der Layouter meldet
 * den Ersatz, statt die Auswahl zu verweigern. */
test("nachmalblatt: lässt auch eine fehlende Schrift wählen und meldet den Ersatz", () => {
  const model = buildTracingLayout(definition([{ art: "schulschrift", script: "va" }]));
  assert.equal(model.metrics.scriptSubstituted, true);
  assert.equal(model.metrics.script, "druckschrift");
});

test("nachmalblatt: begrenzt die Feinjustierung", () => {
  assert.equal(
    definition([{ art: "groesseJustieren", wert: 99 }]).sizeAdjust,
    CONSTRAINTS.sizeAdjust.max,
  );
  assert.equal(
    definition([{ art: "groesseJustieren", wert: 0 }]).sizeAdjust,
    CONSTRAINTS.sizeAdjust.min,
  );
});

/* --- Lineatur ------------------------------------------------------------- */

test("nachmalblatt: wechselt die Lineatur", () => {
  assert.equal(
    definition([{ art: "zeilen", patch: { lineatur: "lineatur2" } }]).lines.lineatur,
    "lineatur2",
  );
});

/* Der Kern des Blatts: Die Lineatur bestimmt die Schriftgröße mit. */
test("nachmalblatt: macht die Schrift bei engerer Lineatur kleiner", () => {
  const weit = buildTracingLayout(DEFAULT_TRACING).metrics.fontSize;
  const eng = buildTracingLayout(definition([{ art: "zeilen", patch: { lineatur: "lineatur2" } }])).metrics.fontSize;
  assert.ok(eng < weit, `erwartet kleiner als ${weit}, war ${eng}`);
});

test("nachmalblatt: unterscheidet „nicht angefasst“ von „zurück auf Vorgabe“", () => {
  assert.equal(mach([{ art: "zeilen", patch: { spacing: 9 } }]).definition.lines.spacing, 9);
  assert.equal(
    mach([
      { art: "zeilen", patch: { spacing: 9 } },
      { art: "zeilen", patch: { lineatur: "lineatur2" } },
    ]).definition.lines.spacing,
    9,
  );
  assert.equal(
    mach([
      { art: "zeilen", patch: { spacing: 9 } },
      { art: "zeilen", patch: { spacing: null } },
    ]).definition.lines.spacing,
    null,
  );
});

/* --- Blatt ---------------------------------------------------------------- */

test("nachmalblatt: begrenzt die Ränder", () => {
  assert.equal(
    definition([{ art: "alleRaender", millimeter: 999 }]).page.margins.top,
    CONSTRAINTS.margin.max,
  );
});

test("nachmalblatt: setzt alles zurück", () => {
  const zustand = mach([
    { art: "inhalt", content: "xyz" },
    { art: "schulschrift", script: "sas" },
    { art: "zuruecksetzen" },
  ]);
  assert.deepEqual(zustand.definition, DEFAULT_TRACING);
});

test("nachmalblatt: hält die Definition auch bei Extremeingaben layoutfähig", () => {
  const zustand = mach([
    { art: "uebungszeilen", patch: { repeats: -3, freeRows: 999 } },
    { art: "groesseJustieren", wert: 99 },
    { art: "schrift", patch: { fontSize: 999 } },
    { art: "alleRaender", millimeter: 9999 },
  ]);
  assert.doesNotThrow(() => buildTracingLayout(zustand.definition));
});

/* --- Definition rein ------------------------------------------------------ */

test("nachmalblatt: lädt eine geprüfte Definition", () => {
  const zustand = mach([{ art: "laden", definition: { ...DEFAULT_TRACING, title: "Geöffnet" } }]);
  assert.equal(zustand.definition.title, "Geöffnet");
  assert.equal(zustand.fehler, null);
});

test("nachmalblatt: lehnt eine unmögliche Definition ab und sagt warum", () => {
  const zustand = mach([{ art: "laden", definition: { ...DEFAULT_TRACING, script: "krakelschrift" } }]);
  assert.equal(zustand.definition, NACHMALBLATT_START.definition);
  assert.match(zustand.fehler ?? "", /Schulschrift: muss einer von/);
});

/* --- mergeTracing — Laden alter Stände ------------------------------------ */

test("mergeTracing: füllt fehlende Felder aus den Vorgaben", () => {
  const merged = mergeTracing({ title: "Alt" });
  assert.equal(merged.title, "Alt");
  assert.deepEqual(merged.rows, DEFAULT_TRACING.rows);
});

test("mergeTracing: begrenzt unmögliche gespeicherte Werte", () => {
  assert.equal(mergeTracing({ rows: { repeats: 999 } }).rows.repeats, CONSTRAINTS.traceRepeats.max);
  assert.equal(mergeTracing({ sizeAdjust: 99 }).sizeAdjust, CONSTRAINTS.sizeAdjust.max);
});

test("mergeTracing: ergibt aus einem leeren Stand genau die Vorgaben", () => {
  assert.deepEqual(mergeTracing({}), DEFAULT_TRACING);
});

test("sanitizeRows und sanitizeTracingLines: ergänzen fehlende Felder", () => {
  const rows = sanitizeRows(DEFAULT_TRACING.rows, { repeats: 4 });
  assert.equal(rows.repeats, 4);
  assert.equal(rows.fade, DEFAULT_TRACING.rows.fade);

  const zeilen = sanitizeTracingLines(DEFAULT_TRACING.lines, { lineatur: "lineatur3" });
  assert.equal(zeilen.lineatur, "lineatur3");
  assert.equal(zeilen.spacing, DEFAULT_TRACING.lines.spacing);
});

/* --- Zoom ----------------------------------------------------------------- */

test("nachmalblatt: begrenzt den Zoom", () => {
  assert.equal(mach([{ art: "zoom", faktor: 99 }]).zoom, CONSTRAINTS.zoom.max);
});

test("nachmalblatt: passt das Blatt in die verfügbare Breite ein", () => {
  const zoom = mach([{ art: "zoomEinpassen", breitePx: 700, seiteMm: 210 }]).zoom;
  assert.ok(zoom > CONSTRAINTS.zoom.min);
  assert.ok(zoom <= 1);
});
