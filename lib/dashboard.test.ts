/** Das Dashboard auf Heute (lib/dashboard.ts): Balken der Woche und Reihenfolge des Fortschritts. */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("Woche: gehalten je Tag, geplant nur ab heute und ohne Einheit, Wochenende nur mit Einträgen", async () => {
  const { wochenBalken } = await import("./dashboard");
  const balken = wochenBalken(
    "2026-10-26",
    "2026-10-28",
    ["2026-10-26", "2026-10-26", "2026-10-28"],
    // Montag vorbei: ein offener Termin dort zählt nicht mehr; heute einer, Donnerstag und Samstag je einer
    ["2026-10-26", "2026-10-28", "2026-10-29", "2026-10-31"],
  );
  assert.deepEqual(
    balken.map((t) => [t.kurz, t.gehalten, t.geplant, t.heute]),
    [
      ["Mo", 2, 0, false],
      ["Di", 0, 0, false],
      ["Mi", 1, 1, true],
      ["Do", 0, 1, false],
      ["Fr", 0, 0, false],
      ["Sa", 0, 1, false],
    ],
  );
});

test("Fortschritt: größtes Plus zuerst, ohne Daten zuletzt", async () => {
  const { fortschrittSortieren } = await import("./dashboard");
  const f = (name: string, trend: "up" | "flat" | "down" | "none", delta: number | null) => ({ id: name.length, name, stand: 0.5, trend, delta, besserIn: null });
  const r = fortschrittSortieren([f("Ohne", "none", null), f("Sinkt", "down", -8), f("Stark", "up", 15), f("Stabil", "flat", 1), f("Etwas", "up", 6)]);
  assert.deepEqual(r.map((x) => x.name), ["Stark", "Etwas", "Stabil", "Sinkt", "Ohne"]);
});
