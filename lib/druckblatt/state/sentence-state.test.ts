/**
 * Prüft den Reducer des Satzbaukastens (`lib/druckblatt/state/sentence-state.ts`).
 *
 * Port von `aufgaben_webseite/src/features/sentence-builder/store/sentence-store.test.ts`
 * (vitest → node:test, Zustand-Store → reiner Reducer).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CONSTRAINTS } from "../definition/constraints";
import { DEFAULT_SENTENCE_BOX } from "../definition/sentence-box-defaults";
import { buildSentenceLayout } from "../rendering/build-sentence-layout";
import {
  SATZBAUKASTEN_START,
  mergeSentenceBox,
  naechsteSpaltenKennung,
  parseEntries,
  satzbaukastenReducer,
  sanitizeLines,
  sanitizeTable,
  type SatzbaukastenAktion,
  type SatzbaukastenZustand,
} from "./sentence-state";

const mach = (aktionen: readonly SatzbaukastenAktion[]): SatzbaukastenZustand =>
  aktionen.reduce(satzbaukastenReducer, SATZBAUKASTEN_START);

const spalten = (aktionen: readonly SatzbaukastenAktion[]) => mach(aktionen).definition.columns;

/* --- Startzustand --------------------------------------------------------- */

test("satzbaukasten: zeigt das Vorbildblatt", () => {
  assert.deepEqual(SATZBAUKASTEN_START.definition, DEFAULT_SENTENCE_BOX);
  assert.equal(SATZBAUKASTEN_START.definition.columns.length, 3);
});

test("satzbaukasten: ergibt ein Layout, das auf eine Seite passt", () => {
  assert.equal(buildSentenceLayout(SATZBAUKASTEN_START.definition).pages.length, 1);
});

/* --- Spalten bearbeiten --------------------------------------------------- */

test("satzbaukasten: fügt eine Spalte an", () => {
  const danach = spalten([{ art: "spalteHinzufuegen", rolle: "ergaenzung" }]);
  assert.equal(danach.length, 4);
  assert.equal(danach[3]?.role, "ergaenzung");
});

/* Vorgaben je Rolle, damit man nicht bei jeder neuen Spalte Fall und Artikel
 * von Hand nachziehen muss. */
test("satzbaukasten: setzt Fall und Artikel passend zur Rolle", () => {
  const hinzugefuegt = spalten([{ art: "spalteHinzufuegen", rolle: "objekt" }])[3];
  assert.equal(hinzugefuegt?.kasus, "akkusativ");
  assert.equal(hinzugefuegt?.article, "unbestimmt");
});

test("satzbaukasten: vergibt eindeutige Kennungen", () => {
  const danach = spalten([
    { art: "spalteHinzufuegen", rolle: "verb" },
    { art: "spalteHinzufuegen", rolle: "verb" },
  ]);
  const kennungen = danach.map((spalte) => spalte.id);
  assert.equal(new Set(kennungen).size, kennungen.length);
  assert.deepEqual(kennungen.slice(3), ["spalte-1", "spalte-2"]);
});

test("satzbaukasten: Kennungen bleiben reproduzierbar", () => {
  /* Ohne Uhr und ohne Zufall: derselbe Zustand ergibt dieselbe nächste Kennung. */
  assert.equal(naechsteSpaltenKennung(DEFAULT_SENTENCE_BOX.columns), "spalte-1");
  assert.equal(naechsteSpaltenKennung([...DEFAULT_SENTENCE_BOX.columns, { ...DEFAULT_SENTENCE_BOX.columns[0]!, id: "spalte-7" }]), "spalte-8");
});

test("satzbaukasten: fügt über die Obergrenze hinaus nichts mehr an", () => {
  const viele = Array.from({ length: 10 }, () => ({ art: "spalteHinzufuegen", rolle: "ergaenzung" }) as const);
  assert.equal(spalten(viele).length, CONSTRAINTS.sentenceColumns.max);
});

test("satzbaukasten: entfernt eine Spalte", () => {
  assert.deepEqual(spalten([{ art: "spalteEntfernen", kennung: "verb" }]).map((spalte) => spalte.id), [
    "subjekt",
    "objekt",
  ]);
});

test("satzbaukasten: verschiebt eine Spalte", () => {
  assert.deepEqual(
    spalten([{ art: "spalteVerschieben", kennung: "objekt", richtung: -1 }]).map((spalte) => spalte.id),
    ["subjekt", "objekt", "verb"],
  );
});

test("satzbaukasten: lässt die äußerste Spalte nicht aus dem Blatt fallen", () => {
  const danach = spalten([
    { art: "spalteVerschieben", kennung: "subjekt", richtung: -1 },
    { art: "spalteVerschieben", kennung: "objekt", richtung: 1 },
  ]);
  assert.deepEqual(danach.map((spalte) => spalte.id), ["subjekt", "verb", "objekt"]);
});

test("satzbaukasten: ignoriert unbekannte Spalten still", () => {
  const vorher = SATZBAUKASTEN_START.definition.columns;
  const danach = spalten([
    { art: "spalteVerschieben", kennung: "gibtsnicht", richtung: 1 },
    { art: "spalteAendern", kennung: "gibtsnicht", patch: { heading: "x" } },
    { art: "spalteEntfernen", kennung: "gibtsnicht" },
  ]);
  assert.deepEqual(danach, vorher);
});

test("satzbaukasten: ändert Überschrift, Fall und Artikel einer Spalte", () => {
  const danach = spalten([
    { art: "spalteAendern", kennung: "objekt", patch: { heading: "Wen?", kasus: "dativ" } },
  ])[2];
  assert.equal(danach?.heading, "Wen?");
  assert.equal(danach?.kasus, "dativ");
  /* Nicht genanntes bleibt stehen. */
  assert.equal(danach?.article, "unbestimmt");
});

/*
 * Sonst bliebe nach „Objekt -> Verb -> Objekt" ein Dativ stehen, den irgendwann
 * jemand gesetzt hat — und niemand fände den Grund für „einem Hund".
 */
test("satzbaukasten: zieht Fall und Artikel beim Rollenwechsel mit", () => {
  const danach = spalten([
    { art: "spalteAendern", kennung: "objekt", patch: { kasus: "dativ" } },
    { art: "spalteRolle", kennung: "objekt", rolle: "verb" },
    { art: "spalteRolle", kennung: "objekt", rolle: "objekt" },
  ]);
  assert.equal(danach[2]?.kasus, "akkusativ");
  assert.equal(danach[2]?.article, "unbestimmt");
});

/* --- Einträge übernehmen -------------------------------------------------- */

test("satzbaukasten: macht aus jeder Zeile einen Eintrag", () => {
  assert.deepEqual(parseEntries("der Hund\ndie Blume\n\n  das Auto  "), [
    "der Hund",
    "die Blume",
    "das Auto",
  ]);
});

test("satzbaukasten: schreibt Einträge in die richtige Spalte", () => {
  const danach = spalten([
    { art: "spalteEintraege", kennung: "verb", text: "lese\nschreibe" },
  ]);
  assert.deepEqual(danach[1]?.entries, ["lese", "schreibe"]);
  assert.deepEqual(danach[0]?.entries, ["Ich"]);
});

test("satzbaukasten: lässt eine Spalte auch ganz leeren", () => {
  assert.deepEqual(
    spalten([{ art: "spalteEintraege", kennung: "verb", text: "" }])[1]?.entries,
    [],
  );
});

/* --- Schreibzeilen -------------------------------------------------------- */

test("satzbaukasten: begrenzt die Zeilenzahl", () => {
  assert.equal(
    mach([{ art: "zeilen", patch: { count: 9999 } }]).definition.lines.count,
    CONSTRAINTS.writingLines.max,
  );
  assert.equal(
    mach([{ art: "zeilen", patch: { count: -5 } }]).definition.lines.count,
    CONSTRAINTS.writingLines.min,
  );
});

/*
 * `null` und `undefined` bedeuten hier VERSCHIEDENES: nicht angefasst gegen
 * ausdrücklich auf die Vorgabe zurück.
 */
test("satzbaukasten: unterscheidet „nicht angefasst“ von „zurück auf Vorgabe“", () => {
  assert.equal(mach([{ art: "zeilen", patch: { spacing: 12 } }]).definition.lines.spacing, 12);
  assert.equal(
    mach([
      { art: "zeilen", patch: { spacing: 12 } },
      { art: "zeilen", patch: { count: 3 } },
    ]).definition.lines.spacing,
    12,
  );
  assert.equal(
    mach([
      { art: "zeilen", patch: { spacing: 12 } },
      { art: "zeilen", patch: { spacing: null } },
    ]).definition.lines.spacing,
    null,
  );
});

test("satzbaukasten: wechselt die Lineatur", () => {
  assert.equal(
    mach([{ art: "zeilen", patch: { lineatur: "lineatur2" } }]).definition.lines.lineatur,
    "lineatur2",
  );
});

/* --- Blatt und Tabelle ---------------------------------------------------- */

test("satzbaukasten: begrenzt die Ränder", () => {
  const { margins } = mach([{ art: "alleRaender", millimeter: 999 }]).definition.page;
  assert.equal(margins.top, CONSTRAINTS.margin.max);
  assert.equal(margins.left, CONSTRAINTS.margin.max);
});

test("satzbaukasten: begrenzt die Schriftgröße", () => {
  assert.equal(
    mach([{ art: "schrift", patch: { fontSize: 0 } }]).definition.typography.fontSize,
    CONSTRAINTS.fontSize.min,
  );
});

test("satzbaukasten: übernimmt den Rahmenstil", () => {
  assert.equal(
    mach([{ art: "tabelle", patch: { borders: "none" } }]).definition.table.borders,
    "none",
  );
});

test("satzbaukasten: setzt alles zurück", () => {
  const zustand = mach([
    { art: "meta", patch: { title: "Anders" } },
    { art: "spalteEntfernen", kennung: "verb" },
    { art: "zuruecksetzen" },
  ]);
  assert.deepEqual(zustand.definition, DEFAULT_SENTENCE_BOX);
});

test("satzbaukasten: hält die Definition auch bei Extremeingaben layoutfähig", () => {
  const zustand = mach([
    { art: "tabelle", patch: { rowHeight: -5 } },
    { art: "zeilen", patch: { count: 99999, spacing: -3 } },
    { art: "schrift", patch: { fontSize: 999, lineHeight: 0 } },
    { art: "alleRaender", millimeter: 9999 },
  ]);
  assert.doesNotThrow(() => buildSentenceLayout(zustand.definition));
});

/* --- Definition rein ------------------------------------------------------ */

test("satzbaukasten: lädt eine geprüfte Definition", () => {
  const zustand = mach([{ art: "laden", definition: { ...DEFAULT_SENTENCE_BOX, title: "Geöffnet" } }]);
  assert.equal(zustand.definition.title, "Geöffnet");
  assert.equal(zustand.fehler, null);
});

test("satzbaukasten: lehnt eine Definition ohne Spalte ab und sagt warum", () => {
  const zustand = mach([{ art: "laden", definition: { ...DEFAULT_SENTENCE_BOX, columns: [] } }]);
  assert.equal(zustand.definition, SATZBAUKASTEN_START.definition);
  assert.match(zustand.fehler ?? "", /Spalten: mindestens 1/);
});

/* --- mergeSentenceBox — Laden alter Stände -------------------------------- */

test("mergeSentenceBox: füllt fehlende Felder aus den Vorgaben", () => {
  const merged = mergeSentenceBox({ title: "Alt" });
  assert.equal(merged.title, "Alt");
  assert.deepEqual(merged.columns, DEFAULT_SENTENCE_BOX.columns);
  assert.deepEqual(merged.lines, DEFAULT_SENTENCE_BOX.lines);
});

test("mergeSentenceBox: begrenzt unmögliche gespeicherte Werte", () => {
  assert.equal(mergeSentenceBox({ lines: { count: 9999 } }).lines.count, CONSTRAINTS.writingLines.max);
});

test("mergeSentenceBox: ergibt aus einem leeren Stand genau die Vorgaben", () => {
  assert.deepEqual(mergeSentenceBox({}), DEFAULT_SENTENCE_BOX);
});

test("sanitizeLines und sanitizeTable: ergänzen fehlende Felder", () => {
  const zeilen = sanitizeLines(DEFAULT_SENTENCE_BOX.lines, { count: 3 });
  assert.equal(zeilen.count, 3);
  assert.equal(zeilen.lineatur, DEFAULT_SENTENCE_BOX.lines.lineatur);

  const tabelle = sanitizeTable(DEFAULT_SENTENCE_BOX.table, { borders: "outline" });
  assert.equal(tabelle.borders, "outline");
  assert.equal(tabelle.rowHeight, DEFAULT_SENTENCE_BOX.table.rowHeight);
});

/* --- Zoom — geteilter Zustand -------------------------------------------- */

test("satzbaukasten: begrenzt den Zoom wie bei der Lesetabelle", () => {
  assert.equal(mach([{ art: "zoom", faktor: 99 }]).zoom, CONSTRAINTS.zoom.max);
  assert.equal(mach([{ art: "zoom", faktor: 0 }]).zoom, CONSTRAINTS.zoom.min);
});

test("satzbaukasten: passt das Blatt in die verfügbare Breite ein", () => {
  const zoom = mach([{ art: "zoomEinpassen", breitePx: 1000, seiteMm: 210 }]).zoom;
  assert.ok(zoom > 1);
  assert.ok(zoom < CONSTRAINTS.zoom.max);
});

test("satzbaukasten: lässt den Zoom bei unmöglicher Blattbreite stehen", () => {
  const zustand = mach([
    { art: "zoom", faktor: 1 },
    { art: "zoomEinpassen", breitePx: 1000, seiteMm: 0 },
  ]);
  assert.equal(zustand.zoom, 1);
});
