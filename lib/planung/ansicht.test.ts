import assert from "node:assert/strict";
import test from "node:test";
import { anzeigeBereich, sichtbareTage, startTag, tagesListe } from "./ansicht";
import type { Wochentag } from "./zeit";

const nachmittag = { "1": [{ start: 14 * 60, end: 20 * 60 }], "3": [{ start: 15 * 60, end: 19 * 60 + 30 }] };

test("Wochenansicht: gezeigt wird nur die Arbeitszeit, auf volle Stunden", () => {
  assert.deepEqual(anzeigeBereich([], [{ verfuegbarkeit: nachmittag }]), { von: 14 * 60, bis: 20 * 60 }, "ohne leeren Vormittag");
  assert.deepEqual(anzeigeBereich([{ startMin: 12 * 60 + 30, dauer: 100 }], [{ verfuegbarkeit: nachmittag }]), { von: 12 * 60, bis: 20 * 60 }, "ein früher Platz erweitert den Bereich");
  assert.deepEqual(anzeigeBereich([{ startMin: 16 * 60, dauer: 60 }], []), { von: 16 * 60, bis: 20 * 60 }, "mindestens vier Stunden");
  assert.deepEqual(anzeigeBereich([{ startMin: 22 * 60, dauer: 100 }], []), { von: 20 * 60, bis: 24 * 60 }, "am Tagesende nach vorne verlängert");
  assert.deepEqual(anzeigeBereich([], [{ verfuegbarkeit: {} }]), { von: 8 * 60, bis: 18 * 60 }, "ohne Daten wie bisher 08–18");
});

test("Wochenansicht: Samstag und Sonntag nur, wenn dort jemand kann oder etwas steht", () => {
  const tage = ([1, 2, 3, 4, 5, 6, 7] as Wochentag[]).map((tag) => ({ tag }));
  const nur = (xs: { tag: Wochentag }[]) => xs.map((t) => t.tag);
  assert.deepEqual(nur(sichtbareTage(tage, [], [{ verfuegbarkeit: nachmittag }])), [1, 2, 3, 4, 5], "Montag bis Freitag immer");
  assert.deepEqual(nur(sichtbareTage(tage, [{ weekday: 7 }], [])), [1, 2, 3, 4, 5, 7], "ein Platz am Sonntag zeigt den Sonntag");
  assert.deepEqual(nur(sichtbareTage(tage, [], [{ verfuegbarkeit: { "6": [{ start: 540, end: 720 }] } }])), [1, 2, 3, 4, 5, 6], "Verfügbarkeit am Samstag zeigt den Samstag");
  assert.deepEqual(nur(sichtbareTage(tage, [], [{ verfuegbarkeit: { "6": [] } }])), [1, 2, 3, 4, 5], "eine leere Liste zählt nicht");
});

test("Tagesansicht: offen ist heute, sonst der erste Tag mit einem Platz", () => {
  const tage = ([1, 2, 3, 4, 5] as Wochentag[]).map((tag) => ({ tag }));
  assert.equal(startTag(tage, [{ weekday: 4 }], 2), 2, "in der laufenden Woche heute");
  assert.equal(startTag(tage, [{ weekday: 4 }, { weekday: 3 }], null), 3, "in einer anderen Woche der erste belegte Tag");
  assert.equal(startTag(tage, [{ weekday: 4 }], 6), 4, "heute ist Samstag und der Samstag wird nicht gezeigt");
  assert.equal(startTag(tage, [], null), 1, "leere Woche: Montag");
});

test("Tagesansicht: Plätze und Lücken eines Tages nach Startzeit", () => {
  const liste = tagesListe(
    [
      { id: 7, startMin: 17 * 60 },
      { id: 3, startMin: 15 * 60 },
      { id: 2, startMin: 17 * 60 },
    ],
    [{ start: 16 * 60 + 30, end: 17 * 60 }],
  );
  assert.deepEqual(
    liste.map((e) => (e.art === "platz" ? `P${e.platz.id}` : `L${e.luecke.start}`)),
    ["P3", "L990", "P2", "P7"],
  );
});
