/**
 * Regeln der KI-Textkorrektur für die Textsorten der Schreibaufträge (lib/text-correction-rules.ts, niko 2026-10-20):
 * jede Textsorte aus lib/schreibauftrag.ts bekommt ihre eigene Regel, ein Leserbrief nicht mehr die Brief-Regel mit
 * Ort und Datum. Die Regeln für die übrigen Textarten bleiben, wie sie waren. Kein KI-Aufruf.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SORTEN } from "./schreibauftrag";
import { kindCriteria } from "./text-correction-rules";

const ALLGEMEIN = kindCriteria("irgendwas");

test("jede Textsorte eines Schreibauftrags hat ihre eigene Regel", () => {
  for (const s of Object.values(SORTEN)) {
    const rule = kindCriteria(s.name);
    assert.notEqual(rule, ALLGEMEIN, s.name);
    const head = rule.split(":")[0];
    if (s.key === "textinterpretation") assert.match(head, /^Textinterpretation/);
    else assert.equal(head, s.name, `${s.name} bekommt die Regel „${head}“`);
  }
});

test("Leserbrief verlangt kein Ort und Datum, der offene Brief schon", () => {
  assert.match(kindCriteria("Leserbrief"), /Ort und Datum sind beim Leserbrief nicht nötig/);
  assert.ok(!/^Brief:/.test(kindCriteria("Leserbrief")));
  assert.match(kindCriteria("Offener Brief"), /^Offener Brief: Ort und Datum/);
});

test("die anderen Textarten behalten ihre Regel", () => {
  assert.match(kindCriteria("Brief"), /^Brief: Ort und Datum/);
  assert.match(kindCriteria("Letter"), /^Brief:/);
  assert.match(kindCriteria("Beschwerdebrief"), /^Beschwerdebrief:/);
  assert.match(kindCriteria("Geschäftsbrief"), /^Geschäftsbrief:/);
  assert.match(kindCriteria("Inhaltsangabe"), /^Inhaltsangabe:/);
  assert.match(kindCriteria("Summary"), /^Inhaltsangabe:/);
  assert.match(kindCriteria("Erörterung"), /^Erörterung:/);
  assert.match(kindCriteria("Essay"), /^Erörterung:/);
  assert.match(kindCriteria("Textanalyse"), /^Textanalyse:/);
  assert.match(kindCriteria("Interpretation"), /^Textinterpretation/);
  assert.match(kindCriteria("Bericht"), /^Bericht:/);
  assert.match(kindCriteria("Erlebniserzählung"), /^Erzählung:/);
});

test("Zusammenfassung: Konjunktiv I nur für die Oberstufe, keine Gedankenstriche", () => {
  assert.match(kindCriteria("Zusammenfassung"), /in der Oberstufe mit Konjunktiv I/);
  for (const k of ["Leserbrief", "Offener Brief", "Kommentar", "Meinungsrede", "Empfehlung", "Zusammenfassung"]) assert.ok(!/—| – /.test(kindCriteria(k)), k);
});
