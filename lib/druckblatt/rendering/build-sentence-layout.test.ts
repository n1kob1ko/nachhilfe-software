/**
 * Prüft `buildSentenceLayout` aus `lib/druckblatt/rendering/build-sentence-layout.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/rendering/build-sentence-layout.test.ts` übernommen
 * (vitest → node:test, Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede
 * Vitest-Erwartung hat hier eine Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mm } from "../units";
import { DEFAULT_SENTENCE_BOX } from "../definition/sentence-box-defaults";
import type { SentenceBoxDefinition } from "../definition/sentence-box-types";
import { buildSentenceLayout } from "./build-sentence-layout";

/** Entspricht vitest `toBeCloseTo(wert, stellen)`: |ist - soll| < 0.5 * 10^-stellen. */
function closeTo(ist: number, soll: number, stellen = 2): void {
  const toleranz = 0.5 * 10 ** -stellen;
  assert.ok(Math.abs(ist - soll) < toleranz, `${ist} weicht von ${soll} um mehr als ${toleranz} ab`);
}

const box = (patch: Partial<SentenceBoxDefinition> = {}): SentenceBoxDefinition => ({
  ...DEFAULT_SENTENCE_BOX,
  ...patch,
});

const firstPage = (definition: SentenceBoxDefinition) => buildSentenceLayout(definition).pages[0]!;

const model = buildSentenceLayout(DEFAULT_SENTENCE_BOX);

test("buildSentenceLayout -- das Vorbildblatt: passt auf eine Seite", () => {
  assert.equal(model.pages.length, 1);
});

test("buildSentenceLayout -- das Vorbildblatt: setzt so viele Zeilen wie die längste Spalte Einträge hat", () => {
  assert.equal(model.rowCount, 6);
  assert.equal(model.pages[0]!.table!.rows.length, 6);
});

/* Der Kern: „einen Hund", nicht „der Hund". */
test("buildSentenceLayout -- das Vorbildblatt: bildet den Akkusativ in der Objektspalte", () => {
  const texts = model.pages[0]!.table!.rows.map((row) => row.cells[2]!.text);
  assert.deepEqual(texts, [
    "einen Hund",
    "eine Blume",
    "ein Auto",
    "einen Baum",
    "eine Katze",
    "ein Haus",
  ]);
});

/* Ungleich lange Spalten sind der Normalfall -- Zelle bleibt leer, nichts rückt nach. */
test("buildSentenceLayout -- das Vorbildblatt: lässt kurze Spalten leer, statt nachrücken zu lassen", () => {
  const rows = model.pages[0]!.table!.rows;
  assert.equal(rows[0]!.cells[0]!.text, "Ich");
  assert.equal(rows[1]!.cells[0]!.text, "");
  assert.equal(rows[3]!.cells[1]!.text, "");
  assert.equal(rows[3]!.cells[2]!.text, "einen Baum");
});

test("buildSentenceLayout -- das Vorbildblatt: setzt die gewünschten Schreibzeilen", () => {
  assert.equal(model.placedLines, 5);
  assert.deepEqual(model.pages[0]!.writingLines.map((line) => line.number), [1, 2, 3, 4, 5]);
});

test("buildSentenceLayout -- das Vorbildblatt: gibt jeder Schreibzeile die vier Linien der Lineatur 1", () => {
  const line = model.pages[0]!.writingLines[0]!;
  assert.deepEqual(line.lines.map((entry) => entry.role), [
    "oberlinie",
    "mittellinie",
    "grundlinie",
    "unterlinie",
  ]);
  assert.equal(line.bandHeight, 15);
});

test("buildSentenceLayout -- das Vorbildblatt: zeigt Titel und Auftrag nur auf der ersten Seite", () => {
  assert.ok(model.pages[0]!.header?.instruction.includes("Lies die Wörter"));
});

test("buildSentenceLayout -- Spalten und Überschriften: macht alle Spalten gleich breit", () => {
  /* A4 mit 15 mm Rand links und rechts: 180 mm auf drei Spalten. */
  assert.equal(model.metrics.columns, 3);
  closeTo(model.metrics.columnWidth, 60);
});

test("buildSentenceLayout -- Spalten und Überschriften: zeigt Überschriften, wenn welche gesetzt sind", () => {
  assert.deepEqual(firstPage(DEFAULT_SENTENCE_BOX).table!.headings, [
    "Wer?",
    "Was tue ich?",
    "Wen oder was?",
  ]);
});

test("buildSentenceLayout -- Spalten und Überschriften: lässt die Überschriftenzeile weg, wenn sie abgeschaltet ist", () => {
  const page = firstPage(box({ table: { ...DEFAULT_SENTENCE_BOX.table, showHeadings: false } }));
  assert.equal(page.table!.headings, null);
});

test("buildSentenceLayout -- Spalten und Überschriften: lässt die Überschriftenzeile weg, wenn keine Spalte eine trägt", () => {
  const columns = DEFAULT_SENTENCE_BOX.columns.map((column) => ({ ...column, heading: "" }));
  assert.equal(firstPage(box({ columns })).table!.headings, null);
});

test("buildSentenceLayout -- Spalten und Überschriften: kommt ohne jede Spalte zurecht", () => {
  const withoutColumns = buildSentenceLayout(box({ columns: [] }));
  assert.equal(withoutColumns.rowCount, 0);
  assert.equal(withoutColumns.pages[0]!.table, null);
  /* Die Schreibzeilen stehen trotzdem -- ein Blatt nur zum Schreiben ist
   * eine zulaessige Verwendung. */
  assert.equal(withoutColumns.placedLines, 5);
});

test("buildSentenceLayout -- Umbruch: bleibt ohne Inhalt bei genau einer Seite", () => {
  const empty = buildSentenceLayout(
    box({ columns: [], lines: { ...DEFAULT_SENTENCE_BOX.lines, count: 0 } }),
  );
  assert.equal(empty.pages.length, 1);
  assert.equal(empty.placedLines, 0);
});

test("buildSentenceLayout -- Umbruch: schiebt überzählige Schreibzeilen auf die nächste Seite", () => {
  const many = buildSentenceLayout(box({ lines: { ...DEFAULT_SENTENCE_BOX.lines, count: 40 } }));
  assert.ok(many.pages.length > 1);
  assert.equal(many.placedLines, 40);
});

test("buildSentenceLayout -- Umbruch: nummeriert Schreibzeilen über Seitengrenzen hinweg durch", () => {
  const many = buildSentenceLayout(box({ lines: { ...DEFAULT_SENTENCE_BOX.lines, count: 40 } }));
  const numbers = many.pages.flatMap((page) => page.writingLines.map((line) => line.number));
  assert.deepEqual(numbers, Array.from({ length: 40 }, (_, index) => index + 1));
});

test("buildSentenceLayout -- Umbruch: setzt die Überschrift der Schreibzeilen nur einmal", () => {
  const many = buildSentenceLayout(box({ lines: { ...DEFAULT_SENTENCE_BOX.lines, count: 40 } }));
  const withHeading = many.pages.filter((page) => page.linesHeading !== null);
  assert.equal(withHeading.length, 1);
});

/*
 * Der Kasten hat Vorrang. Ein Blatt mit halbem Satzbaukasten und schon
 * beginnenden Schreibzeilen waere unbrauchbar -- die Kinder koennten die
 * Saetze nicht mehr bauen.
 */
test("buildSentenceLayout -- Umbruch: setzt keine Schreibzeile, solange der Kasten nicht fertig ist", () => {
  const many = Array.from({ length: 60 }, (_, index) => `das Wort${index}`);
  const columns = [{ ...DEFAULT_SENTENCE_BOX.columns[2]!, entries: many }];
  const overflow = buildSentenceLayout(box({ columns }));

  const tablePages = overflow.pages.filter((page) => page.table !== null);
  assert.ok(tablePages.length > 1);
  for (const page of tablePages.slice(0, -1)) {
    assert.deepEqual(page.writingLines, []);
  }
});

test("buildSentenceLayout -- Umbruch: wiederholt die Spaltenüberschriften auf jedem Tabellenteil", () => {
  const many = Array.from({ length: 60 }, (_, index) => `das Wort${index}`);
  const columns = [{ ...DEFAULT_SENTENCE_BOX.columns[2]!, entries: many, heading: "Wen?" }];
  const overflow = buildSentenceLayout(box({ columns }));

  for (const page of overflow.pages.filter((page) => page.table !== null)) {
    assert.deepEqual(page.table!.headings, ["Wen?"]);
  }
  assert.equal(overflow.pages[0]!.table!.isFirstPart, true);
  assert.equal(overflow.pages[1]!.table!.isFirstPart, false);
});

test("buildSentenceLayout -- Umbruch: verteilt alle Tabellenzeilen, ohne eine zu verlieren", () => {
  const many = Array.from({ length: 60 }, (_, index) => `das Wort${index}`);
  const columns = [{ ...DEFAULT_SENTENCE_BOX.columns[2]!, entries: many }];
  const overflow = buildSentenceLayout(box({ columns }));

  const placed = overflow.pages.reduce((sum, page) => sum + (page.table?.rows.length ?? 0), 0);
  assert.equal(placed, 60);
});

const linesOnFirstPage = (definition: SentenceBoxDefinition) =>
  buildSentenceLayout(definition).pages[0]!.writingLines.length;

test("buildSentenceLayout -- Lineatur wirkt aufs Layout: bringt bei enger Lineatur mehr Zeilen auf die Seite", () => {
  const wide = box({
    columns: [],
    lines: { ...DEFAULT_SENTENCE_BOX.lines, count: 40, lineatur: "lineatur1" },
  });
  const narrow = box({
    columns: [],
    lines: { ...DEFAULT_SENTENCE_BOX.lines, count: 40, lineatur: "lineatur2" },
  });
  assert.ok(linesOnFirstPage(narrow) > linesOnFirstPage(wide));
});

test("buildSentenceLayout -- Lineatur wirkt aufs Layout: lässt den Zeilenabstand überschreiben", () => {
  const tight = box({
    columns: [],
    lines: { ...DEFAULT_SENTENCE_BOX.lines, count: 40, spacing: mm(2) },
  });
  const loose = box({
    columns: [],
    lines: { ...DEFAULT_SENTENCE_BOX.lines, count: 40, spacing: mm(25) },
  });
  assert.ok(linesOnFirstPage(tight) > linesOnFirstPage(loose));
});

test("buildSentenceLayout -- Lineatur wirkt aufs Layout: setzt bei blanko keine Linien, aber reserviert den Platz", () => {
  const blanko = buildSentenceLayout(
    box({ columns: [], lines: { ...DEFAULT_SENTENCE_BOX.lines, lineatur: "blanko", count: 3 } }),
  );
  assert.equal(blanko.placedLines, 3);
  assert.deepEqual(blanko.pages[0]!.writingLines[0]!.lines, []);
});

test("buildSentenceLayout -- Zeilenhöhe: hebt eine zu kleine Zeilenhöhe auf das Schriftmaß an", () => {
  const tight = buildSentenceLayout(
    box({ table: { ...DEFAULT_SENTENCE_BOX.table, rowHeight: mm(1) } }),
  );
  /* 16 pt bei Zeilenhoehe 1.4 sind rund 7,9 mm -- deutlich mehr als 1 mm. */
  assert.ok(tight.metrics.rowHeight > 7);
});

test("buildSentenceLayout -- Zeilenhöhe: respektiert eine großzügige Zeilenhöhe", () => {
  const loose = buildSentenceLayout(
    box({ table: { ...DEFAULT_SENTENCE_BOX.table, rowHeight: mm(25) } }),
  );
  assert.equal(loose.metrics.rowHeight, 25);
});
