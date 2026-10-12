/**
 * Prüft den Reducer der Lesetabelle (`lib/druckblatt/state/worksheet-state.ts`).
 *
 * Port von `aufgaben_webseite/src/features/worksheet-generator/store/worksheet-store.test.ts`
 * (vitest → node:test, Zustand-Store → reiner Reducer). Die Zusagen sind dieselben; jede
 * Vitest-Erwartung hat hier eine Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CONSTRAINTS } from "../definition/constraints";
import { DEFAULT_WORKSHEET } from "../definition/defaults";
import { buildLayoutModel } from "../rendering/build-layout";
import {
  LESETABELLE_START,
  lesetabelleReducer,
  mergeDefinition,
  sanitizeGrid,
  type LesetabelleAktion,
  type LesetabelleZustand,
} from "./worksheet-state";

/** Führt mehrere Aktionen hintereinander aus — wie die Oberfläche beim Tippen. */
const mach = (aktionen: readonly LesetabelleAktion[], start = LESETABELLE_START): LesetabelleZustand =>
  aktionen.reduce(lesetabelleReducer, start);

const definition = (aktionen: readonly LesetabelleAktion[]) => mach(aktionen).definition;

/* --- Grundverhalten ------------------------------------------------------- */

test("lesetabelle: startet mit der Standardvorlage", () => {
  assert.deepEqual(LESETABELLE_START.definition, DEFAULT_WORKSHEET);
  assert.equal(LESETABELLE_START.zoom, 1);
  assert.equal(LESETABELLE_START.fehler, null);
});

test("lesetabelle: ersetzt den Zustand, statt ihn zu mutieren", () => {
  const vorher = LESETABELLE_START.definition;
  const nachher = definition([{ art: "meta", patch: { title: "Neu" } }]);
  assert.notEqual(nachher, vorher);
  assert.equal(vorher.title, DEFAULT_WORKSHEET.title);
  assert.equal(nachher.title, "Neu");
});

test("lesetabelle: setzt auf die Standardvorlage zurück", () => {
  const zustand = mach([{ art: "meta", patch: { title: "Irgendwas" } }, { art: "zuruecksetzen" }]);
  assert.deepEqual(zustand.definition, DEFAULT_WORKSHEET);
});

/* --- Begrenzung von Nutzereingaben --------------------------------------- */

test("lesetabelle: begrenzt die Spaltenzahl nach unten", () => {
  assert.equal(definition([{ art: "raster", patch: { columns: 0 } }]).grid.columns, CONSTRAINTS.columns.min);
});

test("lesetabelle: begrenzt die Schriftgröße nach oben", () => {
  assert.equal(
    definition([{ art: "schrift", patch: { fontSize: 500 } }]).typography.fontSize,
    CONSTRAINTS.fontSize.max,
  );
});

test("lesetabelle: fängt NaN aus leeren Zahlenfeldern ab", () => {
  assert.equal(
    definition([{ art: "raster", patch: { columns: Number.NaN } }]).grid.columns,
    CONSTRAINTS.columns.min,
  );
});

test("lesetabelle: begrenzt Ränder einzeln und gemeinsam", () => {
  const einzeln = definition([{ art: "raender", patch: { top: 999 } }]);
  assert.equal(einzeln.page.margins.top, CONSTRAINTS.margin.max);
  assert.equal(einzeln.page.margins.left, DEFAULT_WORKSHEET.page.margins.left);

  const gemeinsam = definition([{ art: "alleRaender", millimeter: 0 }]).page.margins;
  assert.deepEqual(
    [gemeinsam.top, gemeinsam.right, gemeinsam.bottom, gemeinsam.left],
    [CONSTRAINTS.margin.min, CONSTRAINTS.margin.min, CONSTRAINTS.margin.min, CONSTRAINTS.margin.min],
  );
});

test("lesetabelle: begrenzt den Zoom", () => {
  assert.equal(mach([{ art: "zoom", faktor: 99 }]).zoom, CONSTRAINTS.zoom.max);
  assert.equal(mach([{ art: "zoom", faktor: 0 }]).zoom, CONSTRAINTS.zoom.min);
});

/*
 * Kernversprechen dieser Schicht: egal was die Oberfläche schickt, die Domain
 * bekommt nie einen Wert, an dem sie scheitert. Dieser Test ist die Klammer um
 * alle Einzelbegrenzungen oben.
 */
test("lesetabelle: hält die Definition auch bei Extremeingaben layoutfähig", () => {
  const zustand = mach([
    { art: "raster", patch: { columns: -100, columnGap: 9999, rowHeight: -50 } },
    { art: "schrift", patch: { fontSize: 0, lineHeight: 0 } },
    { art: "alleRaender", millimeter: 9999 },
  ]);
  assert.doesNotThrow(() => buildLayoutModel(zustand.definition));
});

/* --- Inhalte -------------------------------------------------------------- */

test("lesetabelle: zerlegt eingefügten Freitext in eine Wortliste", () => {
  assert.deepEqual(definition([{ art: "woerter", text: "Hund, Katze\nMaus" }]).content, {
    kind: "wordList",
    words: ["Hund", "Katze", "Maus"],
  });
});

test("lesetabelle: ändert die Matrix, wenn eine aktiv ist", () => {
  const content = definition([{ art: "matrix", patch: { onsets: ["B", "D"] } }]).content;
  assert.equal(content.kind, "matrix");
  if (content.kind === "matrix") {
    assert.deepEqual(content.config.onsets, ["B", "D"]);
    /* Übrige Matrixfelder bleiben unangetastet. */
    assert.deepEqual(content.config.nuclei, ["a", "e", "i", "o", "u"]);
  }
});

test("lesetabelle: ignoriert Matrix-Änderungen, wenn eine Wortliste aktiv ist", () => {
  const nachher = definition([
    { art: "woerter", text: "Hund" },
    { art: "matrix", patch: { onsets: ["B"] } },
  ]).content;
  assert.deepEqual(nachher, { kind: "wordList", words: ["Hund"] });
});

test("lesetabelle: übernimmt auch die fertigen Inhaltsvorlagen", () => {
  const zustand = mach([{ art: "inhalt", content: { kind: "wordList", words: ["Oma"] } }]);
  assert.deepEqual(zustand.definition.content, { kind: "wordList", words: ["Oma"] });
});

/* --- Definition rein ------------------------------------------------------ */

test("lesetabelle: lädt eine geprüfte Definition", () => {
  const zustand = mach([{ art: "laden", definition: { ...DEFAULT_WORKSHEET, title: "Geöffnet" } }]);
  assert.equal(zustand.definition.title, "Geöffnet");
  assert.equal(zustand.fehler, null);
});

test("lesetabelle: lehnt eine unmögliche Definition ab und sagt warum", () => {
  const vorher = LESETABELLE_START.definition;
  const zustand = mach([{ art: "laden", definition: { ...DEFAULT_WORKSHEET, grid: {} } }]);
  /* Der Zustand bleibt stehen — ein kaputtes Blatt ersetzt kein gutes. */
  assert.equal(zustand.definition, vorher);
  assert.match(zustand.fehler ?? "", /Spalten: fehlt oder hat die falsche Art/);
});

test("lesetabelle: die nächste Eingabe löscht die Ladefehlermeldung", () => {
  const zustand = mach([
    { art: "laden", definition: 42 },
    { art: "meta", patch: { title: "Weiter" } },
  ]);
  assert.equal(zustand.fehler, null);
});

/* --- mergeDefinition — Laden alter Stände --------------------------------- */

test("mergeDefinition: ergänzt fehlende Felder aus der Standardvorlage", () => {
  const merged = mergeDefinition({ title: "Alt" });
  assert.equal(merged.title, "Alt");
  assert.deepEqual(merged.grid, DEFAULT_WORKSHEET.grid);
  assert.deepEqual(merged.typography, DEFAULT_WORKSHEET.typography);
});

test("mergeDefinition: ergänzt teilweise vorhandene Unterobjekte", () => {
  const merged = mergeDefinition({ grid: { columns: 3 } });
  assert.equal(merged.grid.columns, 3);
  assert.equal(merged.grid.rowHeight, DEFAULT_WORKSHEET.grid.rowHeight);
});

test("mergeDefinition: begrenzt beschädigte gespeicherte Werte", () => {
  const merged = mergeDefinition({ grid: { columns: 9999 } });
  assert.equal(merged.grid.columns, CONSTRAINTS.columns.max);
  assert.doesNotThrow(() => buildLayoutModel(merged));
});

test("mergeDefinition: liefert aus einem leeren Objekt die vollständige Standardvorlage", () => {
  assert.deepEqual(mergeDefinition({}), DEFAULT_WORKSHEET);
});

test("sanitizeGrid: lässt gültige Werte stehen und ergänzt fehlende", () => {
  const grid = sanitizeGrid(DEFAULT_WORKSHEET.grid, { columns: 4 });
  assert.equal(grid.columns, 4);
  assert.equal(grid.rowHeight, DEFAULT_WORKSHEET.grid.rowHeight);
});
