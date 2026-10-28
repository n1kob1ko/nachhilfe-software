/** F0b: eine Schreibweise für Daten in der Lehrer-Oberfläche (lib/datum.ts): „Mi 28.10.“ kurz, „28.10.2026“ lang, Tag in Wien. */
import assert from "node:assert/strict";
import test from "node:test";
import { datumKurz, datumLang, datumWieOptionen, kalendertag, tagMonat, uhrzeit } from "./datum";

test("short and long, always in numbers, the day as in Vienna", () => {
  assert.equal(tagMonat("2026-10-28"), "28.10.");
  assert.equal(datumKurz("2026-10-28"), "Mi 28.10.");
  assert.equal(datumKurz("2026-10-28", { wochentag: "lang" }), "Mittwoch, 28.10.");
  assert.equal(datumKurz("2026-11-04", { wochentag: false }), "4.11.");
  assert.equal(datumLang("2026-10-28"), "28.10.2026");
  assert.equal(datumLang("2026-10-28", { wochentag: "kurz" }), "Mi 28.10.2026");
  // SQLite datetime('now') is UTC: 23:30 UTC is already the next day in Vienna
  assert.equal(kalendertag("2026-10-28 23:30:00"), "2026-10-29");
  // a local time without zone (the planning) stays the day as written
  assert.equal(kalendertag("2026-10-28T23:30"), "2026-10-28");
  assert.equal(tagMonat("kein Datum"), "");
});

test("formatDate options keep their meaning: year → long, weekday in front, a time after, month and year written out", () => {
  assert.equal(datumWieOptionen("2026-10-28", { day: "numeric", month: "short" }), "28.10.");
  assert.equal(datumWieOptionen("2026-10-28", { day: "numeric", month: "short", year: "numeric" }), "28.10.2026");
  assert.equal(datumWieOptionen("2026-10-28", { weekday: "short", day: "numeric", month: "numeric" }), "Mi 28.10.");
  assert.equal(datumWieOptionen("2026-10-28", { weekday: "long", day: "numeric", month: "long" }), "Mittwoch, 28.10.");
  assert.equal(datumWieOptionen("2026-10-28 13:05:00", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), "28.10., 14:05");
  assert.equal(datumWieOptionen("2026-10-28", { month: "long", year: "numeric" }), "Oktober 2026");
  assert.equal(uhrzeit("2026-10-28T09:15"), "09:15");
  assert.equal(uhrzeit("2026-10-28"), "");
});
