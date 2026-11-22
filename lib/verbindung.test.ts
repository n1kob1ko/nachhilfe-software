import { test } from "node:test";
import assert from "node:assert/strict";
import { sicher, VERBINDUNG_WEG, verbindungWeg } from "./verbindung";

const sofort = async () => {};

test("sicher: klappt der Aufruf, kommt seine Antwort (auch ein fehler des Servers)", async () => {
  assert.deepEqual(await sicher(async () => ({ rundeId: 3 }), [1], sofort), { rundeId: 3 });
  const keine = await sicher(async () => ({ fehler: "Keine Karten." }), [1], sofort);
  assert.deepEqual(keine, { fehler: "Keine Karten." });
  assert.equal(verbindungWeg(keine), false);
});

test("sicher: wirft der Aufruf (Deploy, kein Netz), wird es mit Pausen nochmal versucht", async () => {
  let n = 0;
  const pausen: number[] = [];
  const r = await sicher(
    async () => {
      if (++n < 3) throw new Error("Failed to fetch");
      return { rundeId: 7 };
    },
    [10, 20, 30],
    async (ms) => void pausen.push(ms),
  );
  assert.deepEqual(r, { rundeId: 7 });
  assert.deepEqual(pausen, [10, 20]);
});

test("sicher: klappt nie, dann VERBINDUNG_WEG statt einer Ausnahme (das Spiel bleibt nicht auf der letzten Karte stehen)", async () => {
  let n = 0;
  const r = await sicher(
    async () => {
      n++;
      throw new Error("Server Action not found");
    },
    [1, 1],
    sofort,
  );
  assert.equal(n, 3);
  assert.deepEqual(r, { fehler: VERBINDUNG_WEG });
  assert.equal(verbindungWeg(r), true);
});
