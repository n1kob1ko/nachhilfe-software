/**
 * Prüft `buildLayoutModel`/`resolveContent` aus `lib/druckblatt/rendering/build-layout.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/rendering/build-layout.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mm, pt } from "../units";
import { DEFAULT_WORKSHEET } from "../definition/defaults";
import type { ContentSource, WorksheetDefinition } from "../definition/types";
import { buildLayoutModel, resolveContent } from "./build-layout";

/** Entspricht vitest `toBeCloseTo(wert, stellen)`: |ist - soll| < 0.5 * 10^-stellen. */
function closeTo(ist: number, soll: number, stellen = 2): void {
  const toleranz = 0.5 * 10 ** -stellen;
  assert.ok(Math.abs(ist - soll) < toleranz, `${ist} weicht von ${soll} um mehr als ${toleranz} ab`);
}

/**
 * Eigene Testfixtur statt DEFAULT_WORKSHEET: diese Tests pruefen die
 * Layoutregeln, nicht die redaktionelle Vorbelegung. Sonst wuerde jede
 * Aenderung an den Defaults hier Tests rot faerben, ohne dass ein Fehler
 * vorliegt.
 */
function makeDefinition(overrides: Partial<WorksheetDefinition> = {}): WorksheetDefinition {
  return {
    title: "",
    subtitle: "",
    showTitle: false,
    showPageNumbers: false,
    page: {
      size: "a4",
      orientation: "portrait",
      margins: { top: mm(20), right: mm(20), bottom: mm(20), left: mm(20) },
    },
    grid: {
      columns: 4,
      columnGap: mm(10),
      rowGap: mm(0),
      rowHeight: mm(20),
      decoration: "none",
    },
    typography: { fontSize: pt(10), lineHeight: 1, letterSpacing: pt(0), bold: false },
    coloring: "none",
    content: { kind: "wordList", words: [] },
    ...overrides,
  };
}

const words = (count: number): ContentSource => ({
  kind: "wordList",
  words: Array.from({ length: count }, (_, i) => `Wort${i}`),
});

test("resolveContent: putzt Wortlisten und ueberlaesst die Spaltenzahl dem Raster", () => {
  const result = resolveContent({ kind: "wordList", words: [" Hund ", "", "   ", "Katze"] });
  assert.deepEqual(result.cells, ["Hund", "Katze"]);
  assert.equal(result.columns, null);
});

test("resolveContent: erzwingt bei einer Matrix deren Spaltenzahl", () => {
  const result = resolveContent({
    kind: "matrix",
    config: {
      onsets: ["M", "L", "S"],
      nuclei: ["a", "e", "i", "o", "u"],
      coda: "",
      order: "onset-major",
      capitalize: false,
    },
  });
  assert.equal(result.columns, 5);
  assert.equal(result.cells.length, 15);
});

test("buildLayoutModel -- Geometrie und Umbruch: rechnet Zellbreite und Zeilen pro Seite korrekt aus", () => {
  const model = buildLayoutModel(makeDefinition({ content: words(100) }));

  // 170mm Nutzbreite, 4 Spalten, 3 x 10mm Abstand -> 140/4
  assert.equal(model.metrics.cellWidth, 35);
  // 257mm Nutzhoehe / 20mm Zeilenhoehe -> 12 Zeilen
  // 100 Zellen / 4 Spalten -> 25 Zeilen -> 3 Seiten (12 + 12 + 1)
  assert.equal(model.pages.length, 3);
  assert.equal(model.pages[0]!.rows.length, 12);
  assert.equal(model.pages[2]!.rows.length, 1);
  assert.equal(model.cellCount, 100);
});

test("buildLayoutModel -- Geometrie und Umbruch: nummeriert Seiten 1-basiert und indiziert sie 0-basiert", () => {
  const model = buildLayoutModel(makeDefinition({ content: words(100) }));
  assert.deepEqual(model.pages.map((p) => p.pageNumber), [1, 2, 3]);
  assert.deepEqual(model.pages.map((p) => p.index), [0, 1, 2]);
});

test("buildLayoutModel -- Geometrie und Umbruch: zaehlt Zeilenindizes ueber Seitengrenzen hinweg durch", () => {
  const model = buildLayoutModel(makeDefinition({ content: words(100) }));
  assert.equal(model.pages[0]!.rows[0]!.index, 0);
  assert.equal(model.pages[1]!.rows[0]!.index, 12);
});

test("buildLayoutModel -- Geometrie und Umbruch: vergibt Spaltenindizes zyklisch", () => {
  const model = buildLayoutModel(makeDefinition({ content: words(6) }));
  const columns = model.pages[0]!.rows.flatMap((row) => row.cells.map((cell) => cell.column));
  assert.deepEqual(columns, [0, 1, 2, 3, 0, 1]);
});

test("buildLayoutModel -- Geometrie und Umbruch: laesst die Matrix die Spaltenzahl des Rasters ueberschreiben", () => {
  const model = buildLayoutModel(
    makeDefinition({
      grid: { ...makeDefinition().grid, columns: 4 },
      content: {
        kind: "matrix",
        config: {
          onsets: ["M", "L", "S"],
          nuclei: ["a", "e", "i", "o", "u"],
          coda: "",
          order: "onset-major",
          capitalize: false,
        },
      },
    }),
  );
  assert.equal(model.metrics.columns, 5);
  assert.equal(model.pages[0]!.rows.length, 3);
});

test("buildLayoutModel -- Kopfbereich: reserviert Hoehe nur, wenn ein Titel angezeigt wird", () => {
  const without = buildLayoutModel(makeDefinition({ content: words(4) }));
  assert.equal(without.geometry.headerHeight, 0);
  assert.equal(without.pages[0]!.header, null);

  const withTitle = buildLayoutModel(
    makeDefinition({ title: "Lesen", showTitle: true, content: words(4) }),
  );
  assert.ok(withTitle.geometry.headerHeight > 0);
  assert.ok(withTitle.geometry.bodyHeight < withTitle.geometry.contentHeight);
  assert.deepEqual(withTitle.pages[0]!.header, { title: "Lesen", subtitle: "" });
});

test("buildLayoutModel -- Kopfbereich: behandelt einen aktivierten, aber leeren Titel wie keinen Titel", () => {
  const model = buildLayoutModel(makeDefinition({ title: "   ", showTitle: true }));
  assert.equal(model.geometry.headerHeight, 0);
  assert.equal(model.pages[0]!.header, null);
});

test("buildLayoutModel -- Silben: liefert bei abgeschalteter Faerbung genau eine Silbe je Zelle", () => {
  const model = buildLayoutModel(
    makeDefinition({ coloring: "none", content: { kind: "wordList", words: ["Elefant"] } }),
  );
  assert.deepEqual(model.pages[0]!.rows[0]!.cells[0]!.syllables, ["Elefant"]);
});

test("buildLayoutModel -- Silben: trennt bei aktivierter Faerbung in Silben", () => {
  const model = buildLayoutModel(
    makeDefinition({ coloring: "alternating", content: { kind: "wordList", words: ["Elefant"] } }),
  );
  assert.deepEqual(model.pages[0]!.rows[0]!.cells[0]!.syllables, ["E", "le", "fant"]);
});

test("buildLayoutModel -- Randfaelle: liefert ohne Inhalt genau eine leere Seite", () => {
  const model = buildLayoutModel(makeDefinition());
  assert.equal(model.pages.length, 1);
  assert.deepEqual(model.pages[0]!.rows, []);
  assert.equal(model.cellCount, 0);
});

test("buildLayoutModel -- Randfaelle: hebt eine zu kleine Zeilenhoehe auf das Textmass an", () => {
  const model = buildLayoutModel(
    makeDefinition({
      grid: { ...makeDefinition().grid, rowHeight: mm(5) },
      typography: { fontSize: pt(24), lineHeight: 1.4, letterSpacing: pt(0), bold: false },
    }),
  );
  // 24pt = 8.467mm, * 1.4 = 11.85mm > 5mm Wunschhoehe
  closeTo(model.metrics.rowHeight, 11.85, 1);
});

test("buildLayoutModel -- Randfaelle: erzeugt auch bei extremen Werten endlich viele Seiten", () => {
  const model = buildLayoutModel(
    makeDefinition({
      content: words(10),
      grid: { ...makeDefinition().grid, rowHeight: mm(1000) },
    }),
  );
  assert.equal(model.pages.length, 3); // 10 Zellen / 4 Spalten = 3 Zeilen, 1 Zeile je Seite
});

test("buildLayoutModel -- Randfaelle: gibt den Spaltenabstand nach, wenn Spaltenzahl und Blattbreite kollidieren", () => {
  const model = buildLayoutModel(
    makeDefinition({
      content: words(10),
      grid: { ...makeDefinition().grid, columns: 12, columnGap: mm(40) },
    }),
  );
  assert.equal(model.metrics.columns, 12);
  assert.ok(model.metrics.columnGap < 40);
  assert.ok(model.metrics.cellWidth > 0);
});

test("buildLayoutModel -- Randfaelle: erzeugt keine identischen Zell-IDs", () => {
  const model = buildLayoutModel(makeDefinition({ content: words(50) }));
  const ids = model.pages.flatMap((p) => p.rows.flatMap((r) => r.cells.map((c) => c.id)));
  assert.equal(new Set(ids).size, 50);
});

test("DEFAULT_WORKSHEET: ergibt ein gueltiges Layout auf genau einer Seite", () => {
  const model = buildLayoutModel(DEFAULT_WORKSHEET);
  assert.equal(model.pages.length, 1);
  assert.equal(model.metrics.columns, 5);
  assert.equal(model.cellCount, 25);
  assert.notEqual(model.pages[0]!.header, null);
});
