import assert from "node:assert/strict";
import test from "node:test";

/**
 * Der Wochentag ist die gefährlichste Stelle des Merges (§6): die Quell-Repos zählen 0 = Sonntag,
 * dieses Repo ISO 1 = Montag … 7 = Sonntag. Diese Tests nageln die Umrechnung und den
 * Europe/Vienna-Wochenstart fest — `lib/planung/zeit.ts` ist die einzige Stelle, die das darf.
 */
import {
  TAG_SCHLUESSEL,
  WOCHENTAGE,
  alsQuellWochentag,
  auf10,
  ausQuellWochentag,
  istDatum,
  labelMinuten,
  minutenLabel,
  tagAddieren,
  wienerDatum,
  wienerMinuten,
  wienerWochenstart,
  wochenLabel,
  wochenstartVon,
  wochentagVon,
} from "./zeit";

test("Quell-Wochentag 0 = Sonntag wird zu ISO 7 = Sonntag, alles andere bleibt", () => {
  assert.equal(ausQuellWochentag(0), 7, "0 (Sonntag in der Quelle) ist hier 7");
  assert.equal(ausQuellWochentag(1), 1);
  assert.equal(ausQuellWochentag(2), 2);
  assert.equal(ausQuellWochentag(3), 3);
  assert.equal(ausQuellWochentag(4), 4);
  assert.equal(ausQuellWochentag(5), 5);
  assert.equal(ausQuellWochentag(6), 6);
  assert.equal(alsQuellWochentag(7), 0, "ISO-Sonntag ist in der Quelle 0");
  assert.equal(alsQuellWochentag(1), 1);
  assert.throws(() => ausQuellWochentag(7), /0–6/, "7 ist kein Quell-Wochentag");
  assert.throws(() => ausQuellWochentag(-1), /0–6/);
  assert.throws(() => alsQuellWochentag(0 as never), /1–7/, "0 ist kein ISO-Wochentag");
});

test("Hin und zurück ergibt für jeden ISO-Tag wieder denselben Tag", () => {
  for (const tag of WOCHENTAGE) assert.equal(ausQuellWochentag(alsQuellWochentag(tag)), tag);
  for (let quell = 0; quell <= 6; quell++) assert.equal(alsQuellWochentag(ausQuellWochentag(quell)), quell);
  assert.deepEqual([...TAG_SCHLUESSEL], ["1", "2", "3", "4", "5", "6", "7"]);
});

test("Wochentag und Wochenstart eines Kalenderdatums (Montag ist der erste Tag)", () => {
  assert.equal(wochentagVon("2026-10-12"), 1, "12.10.2026 ist ein Montag");
  assert.equal(wochentagVon("2026-10-18"), 7, "18.10.2026 ist ein Sonntag");
  assert.equal(wochentagVon("2026-10-17"), 6);
  assert.equal(wochenstartVon("2026-10-12"), "2026-10-12");
  assert.equal(wochenstartVon("2026-10-18"), "2026-10-12", "der Sonntag gehört zur Woche davor");
  assert.equal(wochenstartVon("2026-10-19"), "2026-10-19");
  assert.equal(tagAddieren("2026-10-12", 6), "2026-10-18");
  assert.equal(tagAddieren("2026-11-01", 1), "2026-11-02", "über den Monatswechsel");
  assert.equal(tagAddieren("2026-01-01", -1), "2025-12-31", "über den Jahreswechsel");
});

test("„heute“ und der Wochenstart werden in Europe/Vienna gerechnet, nicht in UTC", () => {
  // 18.10.2026 22:30 UTC ist in Wien (UTC+2) schon Montag, der 19.10.
  assert.equal(wienerDatum(new Date("2026-10-18T22:30:00Z")), "2026-10-19");
  assert.equal(wienerWochenstart(new Date("2026-10-18T22:30:00Z")), "2026-10-19");
  assert.equal(wienerMinuten(new Date("2026-10-18T22:30:00Z")), 30);
  // und umgekehrt: 18.10.2026 21:30 UTC ist in Wien noch Sonntag, also gehört es zur Vorwoche
  assert.equal(wienerDatum(new Date("2026-10-18T21:30:00Z")), "2026-10-18");
  assert.equal(wienerWochenstart(new Date("2026-10-18T21:30:00Z")), "2026-10-12");
  // Zeitumstellung: 29.03.2026 ist der letzte Sonntag im März (02:00 → 03:00)
  assert.equal(wienerDatum(new Date("2026-03-29T00:30:00Z")), "2026-03-29");
  assert.equal(wienerMinuten(new Date("2026-03-29T00:30:00Z")), 1 * 60 + 30, "vor der Umstellung UTC+1");
  assert.equal(wienerMinuten(new Date("2026-03-29T23:30:00Z")), 1 * 60 + 30, "nach der Umstellung UTC+2, schon der 30.");
  assert.equal(wienerDatum(new Date("2026-03-29T23:30:00Z")), "2026-03-30");
  assert.equal(wienerWochenstart(new Date("2026-03-29T23:30:00Z")), "2026-03-30", "der 30.03.2026 ist ein Montag");
  assert.equal(wienerWochenstart(new Date("2026-03-29T00:30:00Z")), "2026-03-23");
});

test("Minuten ab Mitternacht: Beschriftung, Raster und Grenzen", () => {
  assert.equal(minutenLabel(540), "09:00");
  assert.equal(minutenLabel(0), "00:00");
  assert.equal(minutenLabel(1439), "23:59");
  assert.equal(labelMinuten("09:00"), 540);
  assert.equal(labelMinuten("9:00"), 540);
  assert.equal(labelMinuten("24:00"), null);
  assert.equal(labelMinuten("09:60"), null);
  assert.equal(labelMinuten("neun"), null);
  assert.equal(auf10(543), 540, "Startzeiten rasten auf 10 Minuten ein (D19)");
  assert.equal(auf10(545), 550);
  assert.equal(auf10(540), 540);
});

test("Datumsangaben werden geprüft, bevor sie in die Datenbank gehen", () => {
  assert.equal(istDatum("2026-10-12"), true);
  assert.equal(istDatum("2026-02-30"), false, "den 30. Februar gibt es nicht");
  assert.equal(istDatum("12.10.2026"), false);
  assert.equal(istDatum("2026-10-12T10:00"), false);
  assert.equal(istDatum(""), false);
  assert.equal(istDatum(20261012), false);
  assert.equal(wochenLabel("2026-10-12"), "12. – 18. Oktober 2026");
  assert.equal(wochenLabel("2026-10-31"), "26. Oktober – 1. November 2026", "Wochen über den Monatswechsel");
});
