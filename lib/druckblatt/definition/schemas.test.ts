/**
 * Prüft die zod-4-Schemas der drei Blattdefinitionen (`lib/druckblatt/definition/schemas.ts`).
 *
 * Diese Schemas sind neu: die Quelldatei hatte keine Validierung (kein zod, die
 * Definitionstypen wurden nie geprüft). Geprüft wird deshalb zweierlei — dass eine
 * gültige Definition unverändert durchkommt, und dass eine ungültige mit einem
 * brauchbaren deutschen Satz abgelehnt wird.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_WORKSHEET } from "./defaults";
import { DEFAULT_SENTENCE_BOX } from "./sentence-box-defaults";
import { DEFAULT_TRACING } from "./tracing-defaults";
import {
  BLATTARTEN,
  fehlendeSchriftHinweis,
  pruefeBlatt,
  pruefeJson,
  pruefeLesetabelle,
  pruefeNachmalblatt,
  pruefeSatzbaukasten,
} from "./schemas";

/** Der Fehlertext als ein Satz — so, wie die Oberfläche ihn anzeigt. */
const text = (fehler: readonly string[]): string => fehler.join(" ");

/* --- Gültige Definitionen kommen unverändert durch ----------------------- */

test("schemas: die Vorgabe der Lesetabelle ist gültig und kommt unverändert zurück", () => {
  const ergebnis = pruefeLesetabelle(DEFAULT_WORKSHEET);
  assert.equal(ergebnis.ok, true);
  assert.deepEqual(ergebnis.ok && ergebnis.definition, DEFAULT_WORKSHEET);
});

test("schemas: die Vorgabe des Satzbaukastens ist gültig", () => {
  const ergebnis = pruefeSatzbaukasten(DEFAULT_SENTENCE_BOX);
  assert.equal(ergebnis.ok, true);
  assert.deepEqual(ergebnis.ok && ergebnis.definition, DEFAULT_SENTENCE_BOX);
});

test("schemas: die Vorgabe des Nachmalblatts ist gültig", () => {
  const ergebnis = pruefeNachmalblatt(DEFAULT_TRACING);
  assert.equal(ergebnis.ok, true);
  assert.deepEqual(ergebnis.ok && ergebnis.definition, DEFAULT_TRACING);
});

test("schemas: eine Wortliste ist genauso gültig wie eine Silbenmatrix", () => {
  const mitWoertern = {
    ...DEFAULT_WORKSHEET,
    content: { kind: "wordList", words: ["Mama", "Oma"] },
  };
  const ergebnis = pruefeLesetabelle(mitWoertern);
  assert.equal(ergebnis.ok, true);
  assert.deepEqual(ergebnis.ok && ergebnis.definition.content, {
    kind: "wordList",
    words: ["Mama", "Oma"],
  });
});

test("schemas: jede Blattart lässt sich über ihre Kennung prüfen", () => {
  assert.equal(pruefeBlatt("lesetabelle", DEFAULT_WORKSHEET).ok, true);
  assert.equal(pruefeBlatt("satzbaukasten", DEFAULT_SENTENCE_BOX).ok, true);
  assert.equal(pruefeBlatt("nachmalblatt", DEFAULT_TRACING).ok, true);
  assert.deepEqual([...BLATTARTEN], ["lesetabelle", "satzbaukasten", "nachmalblatt"]);
});

test("schemas: der Weg über JSON erhält die Definition", () => {
  const ergebnis = pruefeJson("satzbaukasten", JSON.stringify(DEFAULT_SENTENCE_BOX));
  assert.equal(ergebnis.ok, true);
  assert.deepEqual(ergebnis.ok && ergebnis.definition, DEFAULT_SENTENCE_BOX);
});

/* --- Ungültiges wird abgelehnt, und zwar mit einem lesbaren Satz ---------- */

test("schemas: ein fehlendes Feld nennt das Feld auf Deutsch", () => {
  const ergebnis = pruefeLesetabelle({});
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Titel: fehlt oder hat die falsche Art/);
});

test("schemas: eine Spaltenzahl unter 1 wird abgelehnt", () => {
  const ergebnis = pruefeLesetabelle({
    ...DEFAULT_WORKSHEET,
    grid: { ...DEFAULT_WORKSHEET.grid, columns: 0 },
  });
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Spalten: mindestens 1/);
});

test("schemas: eine unmögliche Schriftgröße wird abgelehnt", () => {
  const ergebnis = pruefeLesetabelle({
    ...DEFAULT_WORKSHEET,
    typography: { ...DEFAULT_WORKSHEET.typography, fontSize: 500 },
  });
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Schriftgröße: höchstens 72/);
});

test("schemas: ein unbekannter Wert nennt die erlaubten zur Auswahl", () => {
  const ergebnis = pruefeLesetabelle({ ...DEFAULT_WORKSHEET, coloring: "regenbogen" });
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Silbenfarben: muss einer von „none“, „alternating“ sein/);
});

test("schemas: ein Satzbaukasten ohne Spalte wird abgelehnt", () => {
  const ergebnis = pruefeSatzbaukasten({ ...DEFAULT_SENTENCE_BOX, columns: [] });
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Spalten: mindestens 1/);
});

test("schemas: zwei gleiche Spalten-Kennungen werden abgelehnt", () => {
  const doppelt = DEFAULT_SENTENCE_BOX.columns.map((spalte) => ({ ...spalte, id: "gleich" }));
  const ergebnis = pruefeSatzbaukasten({ ...DEFAULT_SENTENCE_BOX, columns: doppelt });
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Kennungen müssen verschieden sein/);
});

test("schemas: mehr Spalten als erlaubt werden abgelehnt", () => {
  const viele = [...DEFAULT_SENTENCE_BOX.columns, ...DEFAULT_SENTENCE_BOX.columns];
  const ergebnis = pruefeSatzbaukasten({ ...DEFAULT_SENTENCE_BOX, columns: viele });
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Spalten: höchstens 5/);
});

test("schemas: die Feinjustierung des Nachmalblatts hat enge Grenzen", () => {
  const ergebnis = pruefeNachmalblatt({ ...DEFAULT_TRACING, sizeAdjust: 5 });
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Schriftgröße feinjustieren: höchstens 1.4/);
});

test("schemas: `model` ist als eingestellte Darstellung nicht erlaubt", () => {
  /* `model` entsteht beim Rechnen; eingestellt wird nur ghost oder outline. */
  const ergebnis = pruefeNachmalblatt({
    ...DEFAULT_TRACING,
    rows: { ...DEFAULT_TRACING.rows, style: "model" },
  });
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Darstellung: muss einer von „ghost“, „outline“ sein/);
});

test("schemas: kaputtes JSON ist derselbe Fall wie eine ungültige Definition", () => {
  const ergebnis = pruefeJson("lesetabelle", "{kein json");
  assert.equal(ergebnis.ok, false);
  assert.match(text(ergebnis.ok ? [] : ergebnis.fehler), /Lesetabelle: der gespeicherte Inhalt ist kein gültiges JSON/);
});

test("schemas: `null` und eine Zahl statt einer Definition werden abgelehnt", () => {
  for (const wert of [null, 42, "text", [], undefined]) {
    const ergebnis = pruefeLesetabelle(wert);
    assert.equal(ergebnis.ok, false, `erwartet ungültig: ${String(wert)}`);
    assert.ok(!ergebnis.ok && ergebnis.fehler.length > 0);
  }
});

test("schemas: NaN und Infinity sind keine Maße", () => {
  const ergebnis = pruefeLesetabelle({
    ...DEFAULT_WORKSHEET,
    grid: { ...DEFAULT_WORKSHEET.grid, rowHeight: Number.NaN },
  });
  assert.equal(ergebnis.ok, false);

  const unendlich = pruefeLesetabelle({
    ...DEFAULT_WORKSHEET,
    page: { ...DEFAULT_WORKSHEET.page, margins: { ...DEFAULT_WORKSHEET.page.margins, top: Number.POSITIVE_INFINITY } },
  });
  assert.equal(unendlich.ok, false);
});

/* --- Fehlende Schulschriften -------------------------------------------- */

test("schemas: eine fehlende Schriftdatei wird gemeldet, die mitgelieferte nicht", () => {
  assert.equal(fehlendeSchriftHinweis("druckschrift"), null);
  assert.match(fehlendeSchriftHinweis("va") ?? "", /Gruenewald VA/);
  assert.match(fehlendeSchriftHinweis("la") ?? "", /Keine frei lizenzierte Fassung/);
});
