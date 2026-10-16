import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Verfügbarkeit als JSON-Spalte: schreiben → lesen → derselbe Wert, und kaputtes JSON darf die App
 * nie zum Absturz bringen. Die Tage sind ISO (1 = Montag … 7 = Sonntag).
 */
import {
  istVerfuegbarkeitLeer,
  normalisiereVerfuegbarkeit,
  parseVerfuegbarkeit,
  parseVerfuegbarkeitStreng,
  serializeVerfuegbarkeit,
  spannenFuerTag,
  verfuegbarkeitLabel,
  verfuegbarkeitMinuten,
} from "./verfuegbarkeit";

test("Verfügbarkeit: schreiben, lesen, derselbe Wert", () => {
  const wert = {
    "1": [{ start: 540, end: 720 }],
    "3": [
      { start: 600, end: 690 },
      { start: 840, end: 1020 },
    ],
    "7": [{ start: 0, end: 1440 }],
  };
  const gelesen = parseVerfuegbarkeit(serializeVerfuegbarkeit(wert));
  assert.deepEqual(gelesen, wert);
  assert.deepEqual(parseVerfuegbarkeit(JSON.stringify(gelesen)), gelesen, "zweiter Umlauf ändert nichts");
  assert.equal(verfuegbarkeitMinuten(gelesen), 180 + 90 + 180 + 1440);
  assert.equal(istVerfuegbarkeitLeer(gelesen), false);
  assert.equal(istVerfuegbarkeitLeer({}), true);
  assert.deepEqual(spannenFuerTag(gelesen, 3), [
    { start: 600, end: 690 },
    { start: 840, end: 1020 },
  ]);
  assert.deepEqual(spannenFuerTag(gelesen, 2), [], "ein fehlender Tag ist frei");
});

test("kaputtes JSON und falsche Formen ergeben eine leere Verfügbarkeit statt eines Absturzes", () => {
  assert.deepEqual(parseVerfuegbarkeit("{kaputt"), {});
  assert.deepEqual(parseVerfuegbarkeit(""), {});
  assert.deepEqual(parseVerfuegbarkeit(null), {});
  assert.deepEqual(parseVerfuegbarkeit(undefined), {});
  assert.deepEqual(parseVerfuegbarkeit("null"), {});
  assert.deepEqual(parseVerfuegbarkeit("[1,2,3]"), {});
  assert.deepEqual(parseVerfuegbarkeit('{"0":[{"start":540,"end":600}]}'), {}, "Tag 0 gibt es hier nicht");
  assert.deepEqual(parseVerfuegbarkeit('{"1":[{"start":720,"end":540}]}'), {}, "Ende vor Beginn");
  assert.deepEqual(parseVerfuegbarkeit('{"1":"09:00-10:00"}'), {});
  assert.deepEqual(parseVerfuegbarkeit('{"1":[{"start":"540","end":"600"}]}'), {});
  // die strenge Prüfung (Schreibweg) meldet es dagegen
  assert.equal(parseVerfuegbarkeitStreng("{kaputt").ok, false);
  assert.equal(parseVerfuegbarkeitStreng('{"1":[{"start":720,"end":540}]}').ok, false);
  assert.deepEqual(parseVerfuegbarkeitStreng("").ok && parseVerfuegbarkeitStreng(""), { ok: true, wert: {} });
});

test("Überlappungen werden zusammengefasst, Aneinandergrenzendes verschmolzen, sortiert", () => {
  assert.deepEqual(normalisiereVerfuegbarkeit({ "2": [{ start: 900, end: 960 }, { start: 600, end: 660 }] }), {
    "2": [
      { start: 600, end: 660 },
      { start: 900, end: 960 },
    ],
  });
  assert.deepEqual(normalisiereVerfuegbarkeit({ "2": [{ start: 600, end: 700 }, { start: 660, end: 780 }] }), { "2": [{ start: 600, end: 780 }] });
  assert.deepEqual(normalisiereVerfuegbarkeit({ "2": [{ start: 600, end: 660 }, { start: 660, end: 720 }] }), { "2": [{ start: 600, end: 720 }] });
  assert.deepEqual(normalisiereVerfuegbarkeit({ "2": [{ start: 600, end: 600 }] }), {}, "leere Spanne fällt weg");
  assert.equal(serializeVerfuegbarkeit({ "1": [{ start: 600, end: 660 }] }), '{"1":[{"start":600,"end":660}]}');
  assert.equal(verfuegbarkeitLabel({ "1": [{ start: 840, end: 1080 }], "3": [{ start: 540, end: 660 }] }), "Mo 14:00–18:00 · Mi 09:00–11:00");
  assert.equal(verfuegbarkeitLabel({}), "keine");
});
