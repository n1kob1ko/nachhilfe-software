/**
 * Prüft das Netz unter dem Layout (`lib/druckblatt/state/aufbau.ts`).
 *
 * Der Kern rechnet rein und wirft bei unmöglichen Maßen (`InvalidGeometryError`).
 * In der Oberfläche darf daraus kein weißes Fenster werden — hier wird geprüft,
 * dass aus der Ausnahme ein deutscher Satz wird.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mm } from "../units";
import { DEFAULT_WORKSHEET } from "../definition/defaults";
import { DEFAULT_SENTENCE_BOX } from "../definition/sentence-box-defaults";
import { DEFAULT_TRACING } from "../definition/tracing-defaults";
import {
  baueLesetabelle,
  baueNachmalblatt,
  baueSatzbaukasten,
  gezeichneteZeichen,
} from "./aufbau";

test("aufbau: die Vorgaben ergeben je ein Blatt", () => {
  const lesetabelle = baueLesetabelle(DEFAULT_WORKSHEET);
  assert.equal(lesetabelle.ok, true);
  assert.equal(lesetabelle.ok && lesetabelle.model.pages.length, 1);

  const satzbaukasten = baueSatzbaukasten(DEFAULT_SENTENCE_BOX);
  assert.equal(satzbaukasten.ok, true);
  assert.equal(satzbaukasten.ok && satzbaukasten.model.pages.length, 1);

  const nachmalblatt = baueNachmalblatt(DEFAULT_TRACING);
  assert.equal(nachmalblatt.ok, true);
  assert.equal(nachmalblatt.ok && nachmalblatt.model.pages.length, 1);
});

test("aufbau: meldet unmögliche Ränder als Satz statt als Ausnahme", () => {
  const kaputt = {
    ...DEFAULT_WORKSHEET,
    page: { ...DEFAULT_WORKSHEET.page, margins: { top: mm(200), right: mm(15), bottom: mm(200), left: mm(15) } },
  };
  const ergebnis = baueLesetabelle(kaputt);
  assert.equal(ergebnis.ok, false);
  assert.match(ergebnis.ok ? "" : ergebnis.fehler, /lässt sich mit diesen Maßen nicht setzen/);
});

test("aufbau: meldet auch bei Satzbaukasten und Nachmalblatt statt zu werfen", () => {
  const seite = { ...DEFAULT_TRACING.page, margins: { top: mm(300), right: mm(15), bottom: mm(15), left: mm(15) } };
  assert.equal(baueNachmalblatt({ ...DEFAULT_TRACING, page: seite }).ok, false);
  assert.equal(baueSatzbaukasten({ ...DEFAULT_SENTENCE_BOX, page: seite }).ok, false);
});

test("aufbau: zählt die gezeichneten Übungszeichen", () => {
  const ergebnis = baueNachmalblatt(DEFAULT_TRACING);
  assert.equal(ergebnis.ok, true);
  if (ergebnis.ok) {
    /* Fünf Buchstaben („a b c d e") mal sieben Wiederholungen. */
    assert.equal(gezeichneteZeichen(ergebnis.model), 35);
  }
});
