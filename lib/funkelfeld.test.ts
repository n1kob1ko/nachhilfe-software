/**
 * Funkelfeld (lib/funkelfeld.ts): Linien finden, abräumen, Strahlen und Funken, Nachfallen, neues Feld und Mischen.
 * Ohne Datenbank; die Runden am Server prüft lib/lernspiele.test.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { einZug, fallen, funkelZufall, funkeZuenden, gueltigeFunkelPunkte, gruppen, hatZug, linien, mische, neuesFeld, PLAETZE, platz, raeumeAb, SPALTEN, tausche, tauschWirkt, zugBonus, type Feld, type Zaehler } from "./funkelfeld";

/** Ein Feld aus sieben Zeilen mit Ziffern (die Form) und „.“ (leer). */
function feldAus(zeilen: string[], z: Zaehler = { n: 0 }): Feld {
  return zeilen.flatMap((zeile) => [...zeile].map((c) => (c === "." ? null : { id: ++z.n, f: Number(c) })));
}

/** Ein Feld ohne Linien: die Formen wechseln schräg (keine drei gleichen nebeneinander oder übereinander). */
const ruhig = ["0123401", "1234012", "2340123", "3401234", "4012340", "0123401", "1234012"];

test("ein ruhiges Feld hat keine Linien", () => {
  assert.equal(linien(feldAus(ruhig)).length, 0);
});

test("drei, vier und fünf in einer Reihe werden gefunden", () => {
  const f = feldAus(["0001234", ...ruhig.slice(1)]);
  const l = linien(f);
  assert.equal(l.length, 1);
  assert.deepEqual(l[0].zellen, [0, 1, 2]);
  assert.equal(l[0].richtung, "waag");
  const vier = feldAus(["2222014", ...ruhig.slice(1)]);
  assert.equal(linien(vier)[0].zellen.length, 4);
  // senkrecht
  const s = feldAus(["3123401", "3234012", "3340123", ...ruhig.slice(3)]);
  assert.ok(linien(s).some((x) => x.richtung === "senk" && x.zellen.length >= 3));
});

test("ein Tausch ohne Linie wirkt nicht, einer mit Linie schon", () => {
  // Reihe 0: 0 0 1 0 …: die 1 mit der 0 darunter tauschen? darunter steht in ruhig[1][2] eine 3
  const f = feldAus(["0010234", "1204012", ...ruhig.slice(2)]);
  // Platz 2 (eine 1) mit Platz 9 (eine 0, Reihe 1 Spalte 2) tauschen: oben steht dann 0 0 0
  assert.equal(f[9]!.f, 0);
  assert.ok(tauschWirkt(f, 2, 9));
  assert.ok(!tauschWirkt(f, 4, 5));
  // nur Nachbarn
  assert.ok(!tauschWirkt(f, 0, 2));
});

test("vier in einer Reihe werden ein Strahl, wo getauscht wurde", () => {
  const z: Zaehler = { n: 100 };
  const f = feldAus(["1111023", ...ruhig.slice(1)]);
  const s = raeumeAb(f, { bei: [2], stufe: 1, zaehler: z });
  assert.deepEqual(s.neu, [{ i: 2, sp: "reihe" }]);
  assert.equal(s.feld[2]?.sp, "reihe");
  assert.equal(s.feld[2]?.f, 1);
  assert.equal(s.feld[0], null);
  assert.equal(s.feld[3], null);
  // drei sind weg (der vierte ist jetzt der Strahl)
  assert.equal(s.weg.length, 3);
});

test("fünf in einer Linie oder ein Winkel werden ein Funke", () => {
  const z: Zaehler = { n: 100 };
  const fuenf = raeumeAb(feldAus(["2222203", ...ruhig.slice(1)]), { stufe: 1, zaehler: z });
  assert.equal(fuenf.neu[0].sp, "funke");
  assert.equal(fuenf.feld[fuenf.neu[0].i]?.f, -1);
  // ein L: Reihe 0 Spalten 0–2 und Spalte 0 Reihen 0–2
  const l = feldAus(["3334012", "3234012", "3340123", "4012340", "0123401", "1234012", "2340123"]);
  const g = gruppen(l);
  assert.equal(g.length, 1);
  assert.equal(g[0].zellen.length, 5);
  const s = raeumeAb(l, { stufe: 1, zaehler: z });
  assert.deepEqual(s.neu, [{ i: 0, sp: "funke" }]);
});

test("ein Strahl in einer Linie räumt seine ganze Reihe", () => {
  const z: Zaehler = { n: 100 };
  const f = feldAus([ruhig[0], "4440123", ...ruhig.slice(2)], z);
  f[platz(1, 0)] = { id: 999, f: 4, sp: "reihe" };
  const s = raeumeAb(f, { stufe: 1, zaehler: z });
  for (let sp = 0; sp < SPALTEN; sp++) assert.equal(s.feld[platz(1, sp)], null, `Spalte ${sp}`);
  assert.ok(s.ausgeloest.some((a) => a.sp === "reihe"));
  assert.ok(s.weg.some((w) => w.durch === "strahl"));
});

test("ein Funke räumt alle Steine einer Form", () => {
  const z: Zaehler = { n: 100 };
  const f = feldAus(ruhig, z);
  f[0] = { id: 500, f: -1, sp: "funke" };
  const s = funkeZuenden(f, 0, 1, { zaehler: z });
  assert.equal(s.feld.filter((x) => x && x.f === 1).length, 0);
  assert.equal(s.feld[0], null);
  assert.ok(s.punkte > 0);
  // zwei Funken: alles
  const zwei = [...f];
  zwei[1] = { id: 501, f: -1, sp: "funke" };
  assert.equal(funkeZuenden(zwei, 0, 1, { zaehler: z }).feld.filter(Boolean).length, 0);
});

test("Kettenreaktion zählt mehr: Punkte mal Stufe", () => {
  const f = feldAus(["0001234", ...ruhig.slice(1)]);
  const a = raeumeAb(f, { stufe: 1, zaehler: { n: 100 } });
  const b = raeumeAb(f, { stufe: 3, zaehler: { n: 100 } });
  assert.equal(b.punkte, a.punkte * 3);
});

test("Nachfallen füllt jede Lücke und neue Steine kommen von oben", () => {
  const z: Zaehler = { n: 100 };
  const f = feldAus(["...1234", ...ruhig.slice(1)], z);
  const unten = f[platz(6, 0)]!.id;
  const n = fallen(f, { rng: funkelZufall(3), zaehler: z });
  assert.equal(n.feld.filter(Boolean).length, PLAETZE);
  assert.equal(n.von.size, 3);
  for (const v of n.von.values()) assert.equal(v, 1);
  assert.equal(n.feld[platz(6, 0)]!.id, unten);
  // eine Lücke in der Mitte: der Stein darüber fällt einen Platz
  const g = feldAus(ruhig, z);
  const oben = g[platz(2, 3)]!.id;
  g[platz(3, 3)] = null;
  const m = fallen(g, { rng: funkelZufall(5), zaehler: z });
  assert.equal(m.feld[platz(3, 3)]!.id, oben);
});

test("ein neues Feld hat keine fertige Linie und mindestens einen Zug", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const f = neuesFeld({ rng: funkelZufall(seed), zaehler: { n: 0 } });
    assert.equal(f.length, PLAETZE);
    assert.equal(linien(f).length, 0, `seed ${seed}`);
    assert.ok(hatZug(f), `seed ${seed}`);
    const z = einZug(f)!;
    assert.ok(tauschWirkt(f, z[0], z[1]));
    assert.ok(linien(tausche(f, z[0], z[1])).length > 0);
  }
});

test("Mischen behält alle Steine und bringt einen Zug", () => {
  const f = neuesFeld({ rng: funkelZufall(9), zaehler: { n: 0 } });
  const m = mische(f, funkelZufall(11));
  assert.deepEqual(
    m.map((s) => s!.id).sort((a, b) => a - b),
    f.map((s) => s!.id).sort((a, b) => a - b),
  );
  assert.ok(hatZug(m));
  assert.equal(linien(m).length, 0);
});

test("ein ganzes Spiel läuft stabil: abräumen und nachfallen, bis nichts mehr liegt", () => {
  const z: Zaehler = { n: 0 };
  const rng = funkelZufall(42);
  let f = neuesFeld({ rng, zaehler: z });
  let punkte = 0;
  for (let zug = 0; zug < 120; zug++) {
    if (!hatZug(f)) f = mische(f, rng);
    const [a, b] = einZug(f)!;
    f = tausche(f, a, b);
    if (f[a]?.sp === "funke" || f[b]?.sp === "funke") {
      const s = f[a]?.sp === "funke" ? funkeZuenden(f, a, b, { zaehler: z }) : funkeZuenden(f, b, a, { zaehler: z });
      punkte += s.punkte;
      f = fallen(s.feld, { rng, zaehler: z }).feld;
    }
    for (let stufe = 1; linien(f).length && stufe < 30; stufe++) {
      const s = raeumeAb(f, { bei: [a, b], stufe, zaehler: z });
      punkte += s.punkte;
      f = fallen(s.feld, { rng, zaehler: z }).feld;
    }
    assert.equal(f.filter(Boolean).length, PLAETZE);
    assert.equal(linien(f).length, 0);
    // jede id gibt es nur einmal
    assert.equal(new Set(f.map((s) => s!.id)).size, PLAETZE);
  }
  assert.ok(punkte > 1000);
});

test("Züge für eine Antwort und gültige Punkte", () => {
  assert.equal(zugBonus(0, true), 6);
  assert.equal(zugBonus(6, true), 5);
  assert.equal(zugBonus(100, true), 3);
  assert.equal(zugBonus(0, false), 2);
  assert.equal(gueltigeFunkelPunkte(-5), 0);
  assert.equal(gueltigeFunkelPunkte("x"), 0);
  assert.equal(gueltigeFunkelPunkte(1e12), 3_000_000);
  assert.equal(gueltigeFunkelPunkte(12.6), 13);
});
