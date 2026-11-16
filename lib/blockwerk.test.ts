/**
 * Blockwerk (lib/blockwerk.ts): Teile legen, volle Reihen und Spalten räumen, Punkte, Kombo, Blitz und neue Teile.
 * Ohne Datenbank; die Runden am Server prüft lib/lernspiele.test.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { blitz, FELDER, FORM_NAMEN, gueltigePunkte, leeresBrett, naechsteKombo, neueTeile, passt, passtIrgendwo, punkteFuer, SEITE, setze, steckt, teilAus, wuerdeRaeumen, type Brett } from "./blockwerk";

/** Ein Brett aus acht Zeilen mit „#“ (belegt) und „.“ (frei). */
function brettAus(zeilen: string[]): Brett {
  return zeilen.flatMap((z) => [...z].map((c) => (c === "#" ? 1 : null)));
}

/** Fester Zufall für wiederholbare Prüfungen. */
function zufall(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

test("alle Formen sind gültig und kleiner als das Brett", () => {
  for (const n of FORM_NAMEN) {
    const t = teilAus(n);
    assert.ok(t.zellen.length >= 1 && t.zellen.length <= 9, n);
    assert.ok(t.breite <= 5 && t.hoehe <= 5, n);
    for (const [r, s] of t.zellen) assert.ok(r < t.hoehe && s < t.breite, n);
    assert.ok(passtIrgendwo(leeresBrett(), t), n);
  }
});

test("passt: Rand und belegte Felder", () => {
  const b = leeresBrett();
  const balken = teilAus("5-");
  assert.equal(passt(b, balken, 0, 3), true);
  assert.equal(passt(b, balken, 0, 4), false, "ragt rechts hinaus");
  assert.equal(passt(b, balken, -1, 0), false);
  b[0 * SEITE + 2] = 0;
  assert.equal(passt(b, balken, 0, 0), false, "ein Feld ist belegt");
  // eine Ecke passt in die Lücke neben einem belegten Feld
  const ecke = teilAus("E2"); // .# / ##
  b[0] = 3;
  assert.equal(passt(b, ecke, 0, 0), true);
});

test("eine volle Reihe und eine volle Spalte verschwinden zugleich", () => {
  const b = brettAus([
    "#######.",
    ".......#",
    ".......#",
    ".......#",
    ".......#",
    ".......#",
    ".......#",
    "........",
  ]);
  assert.equal(passt(b, teilAus("2|"), 6, 7), false, "Zeile 6, Spalte 7 ist belegt");
  const eins = teilAus("1");
  const z1 = setze(b, eins, 7, 7);
  assert.deepEqual(z1.spalten, [], "Spalte 7 hat oben noch eine Lücke");
  const z2 = setze(z1.brett, eins, 0, 7);
  assert.deepEqual(z2.reihen, [0]);
  assert.deepEqual(z2.spalten, [7]);
  assert.equal(z2.weg.length, 15, "8 + 8 Felder, die Ecke zählt einmal");
  assert.ok(z2.brett.every((x) => x === null), "alles frei");
});

test("Punkte: Felder, Linien im Quadrat, Kombo und leeres Brett", () => {
  const b = brettAus(["#######.", "........", "........", "........", "........", "........", "........", "........"]);
  const zug = setze(b, teilAus("1"), 0, 7);
  assert.equal(punkteFuer(zug, 1, 1), 1 + 10 + 300);
  assert.equal(punkteFuer(zug, 1, 3), 1 + 30 + 300);
  const ohne = setze(leeresBrett(), teilAus("Q2"), 3, 3);
  assert.equal(punkteFuer(ohne, 4, 5), 4, "ohne Linie zählt die Kombo nicht");
  // zwei Linien zugleich: 40
  const zwei = brettAus(["#######.", "#######.", "........", "........", "........", "........", "........", "#......."]);
  const z = setze(zwei, teilAus("2|"), 0, 7);
  assert.equal(z.reihen.length, 2);
  assert.equal(punkteFuer(z, 2, 1), 2 + 40);
});

test("Kombo steigt beim Abräumen und endet nach drei Zügen ohne Linie", () => {
  let k = { kombo: 0, ohne: 0 };
  k = naechsteKombo(k.kombo, k.ohne, 1);
  assert.deepEqual(k, { kombo: 1, ohne: 0 });
  k = naechsteKombo(k.kombo, k.ohne, 2);
  assert.equal(k.kombo, 2);
  k = naechsteKombo(k.kombo, k.ohne, 0);
  k = naechsteKombo(k.kombo, k.ohne, 0);
  assert.equal(k.kombo, 2, "zwei Züge ohne Linie: die Kombo hält");
  k = naechsteKombo(k.kombo, k.ohne, 0);
  assert.equal(k.kombo, 0);
});

test("Blitz räumt 3 × 3, am Rand nach innen gerückt", () => {
  const voll: Brett = Array.from({ length: FELDER }, () => 2);
  const mitte = blitz(voll, 4, 4);
  assert.equal(mitte.weg.length, 9);
  assert.equal(mitte.brett.filter((x) => x === null).length, 9);
  const ecke = blitz(voll, 0, 0);
  assert.equal(ecke.weg.length, 9);
  for (const i of [0, 1, 2, 8, 9, 10, 16, 17, 18]) assert.equal(ecke.brett[i], null);
  // nach dem Blitz passt ein 3 × 3-Quadrat
  assert.equal(passtIrgendwo(ecke.brett, teilAus("Q3")), true);
});

test("Vorschau: was ein Zug abräumen würde", () => {
  const b = brettAus(["######..", "........", "........", "........", "........", "........", "........", "........"]);
  assert.equal(wuerdeRaeumen(b, teilAus("2-"), 0, 6).size, 8);
  assert.equal(wuerdeRaeumen(b, teilAus("2-"), 1, 6).size, 0);
  assert.equal(wuerdeRaeumen(b, teilAus("3-"), 0, 6).size, 0, "passt nicht: nichts");
});

test("neue Teile: immer drei, mindestens eines passt, wenn es geht", () => {
  const rng = zufall(7);
  // fast voll: nur ein Feld frei
  const fast = Array.from({ length: FELDER }, () => 1) as Brett;
  fast[27] = null;
  for (let i = 0; i < 30; i++) {
    const t = neueTeile(fast, rng);
    assert.equal(t.length, 3);
    assert.ok(t.some((x) => passtIrgendwo(fast, x)), "ein Teil passt in das eine Feld");
  }
  // leer: alle passen, und es gibt Abwechslung
  const formen = new Set<string>();
  for (let i = 0; i < 60; i++) for (const t of neueTeile(leeresBrett(), rng)) formen.add(t.form);
  assert.ok(formen.size >= 15, `nur ${formen.size} Formen`);
  // die ids sind eindeutig
  const ids = neueTeile(leeresBrett(), rng).map((t) => t.id);
  assert.equal(new Set(ids).size, 3);
});

test("steckt: erst wenn keines der übrigen Teile mehr passt", () => {
  const fast = Array.from({ length: FELDER }, () => 1) as Brett;
  fast[0] = null;
  assert.equal(steckt(fast, [teilAus("2-"), null, teilAus("Q2")]), true);
  assert.equal(steckt(fast, [teilAus("2-"), teilAus("1"), null]), false);
  assert.equal(steckt(fast, [null, null, null]), false, "ohne Teile kommen neue");
});

test("Punkte vom Gerät werden begrenzt", () => {
  assert.equal(gueltigePunkte(1234.4), 1234);
  assert.equal(gueltigePunkte(-5), 0);
  assert.equal(gueltigePunkte("100"), 0);
  assert.equal(gueltigePunkte(Number.POSITIVE_INFINITY), 0);
  assert.equal(gueltigePunkte(5e9), 1_000_000);
});
