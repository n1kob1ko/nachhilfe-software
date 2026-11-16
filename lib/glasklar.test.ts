/**
 * Glasklar (lib/glasklar.ts, lib/glasklar-themen.ts): Züge, Lösbarkeit der Lagen, eindeutige Begriffe je Thema und die
 * Auswahl einer Stufe. Ohne Datenbank.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { allesSortiert, glasZufall, hatZug, istZu, legeAus, loesbar, neuMischen, pruefeZug, stufeFuer, zieh, type Glas, type Sorten } from "./glasklar";
import { GLAS_THEMEN, glasKandidaten, sortenVon, stoffKandidaten, themaVonKey, waehleGlasKarten, WORTART_WOERTER, wortartenFuer } from "./glasklar-themen";

const sorte: Sorten = { a1: "A", a2: "A", a3: "A", b1: "B", b2: "B", b3: "B" };

test("Züge: nur auf dieselbe Sorte oder ins leere Glas; voll geht nicht; ein zugemachtes Glas bleibt", () => {
  const g: Glas[] = [["a1", "b1"], ["b2"], [], ["a2", "a3", "b3"]];
  assert.deepEqual(pruefeZug(g, 0, 1, sorte, 3), { art: "zug", key: "b1", auf: "b2" });
  assert.deepEqual(pruefeZug(g, 0, 2, sorte, 3), { art: "zug", key: "b1" });
  assert.deepEqual(pruefeZug(g, 1, 0, sorte, 3), { art: "zug", key: "b2", auf: "b1" });
  assert.deepEqual(pruefeZug(g, 3, 1, sorte, 3), { art: "zug", key: "b3", auf: "b2" });
  assert.deepEqual(pruefeZug(g, 1, 3, sorte, 3), { art: "voll" });
  const g2: Glas[] = [["a1", "b1"], ["a2"], []];
  assert.deepEqual(pruefeZug(g2, 0, 1, sorte, 3), { art: "falsch", key: "b1", auf: "a2" });
  assert.deepEqual(pruefeZug(g2, 2, 0, sorte, 3), { art: "nichts" }, "aus einem leeren Glas kommt nichts");
  const zu: Glas[] = [["a1", "a2", "a3"], []];
  assert.ok(istZu(zu[0], sorte, 3));
  assert.deepEqual(pruefeZug(zu, 0, 1, sorte, 3), { art: "nichts" }, "ein volles Glas mit einer Sorte ist zu");
  assert.deepEqual(zieh(g, 0, 2), [["a1"], ["b2"], ["b1"], ["a2", "a3", "b3"]]);
  assert.deepEqual(g[0], ["a1", "b1"], "zieh ändert die alte Lage nicht");
});

test("Lösbarkeit: der Löser findet einen Weg, wenn es einen gibt, und erkennt eine Sackgasse", () => {
  assert.ok(loesbar([["a1", "b1", "a2"], ["b2", "a3", "b3"], [], []], sorte, 3));
  assert.ok(allesSortiert([["a1", "a2", "a3"], ["b1", "b2", "b3"], []], sorte, 3));
  // zwei volle Gläser, kein Platz: nichts geht
  assert.equal(hatZug([["a1", "b1", "a2"], ["b2", "a3", "b3"]], sorte, 3), false);
  assert.equal(loesbar([["a1", "b1", "a2"], ["b2", "a3", "b3"]], sorte, 3), false);
});

test("Stufen: werden größer, höchstens sieben Gläser", () => {
  let vorher = 0;
  for (let n = 1; n <= 12; n++) {
    const s = stufeFuer(n);
    assert.ok(s.sorten + s.leer <= 7, `Stufe ${n}: ${s.sorten + s.leer} Gläser`);
    assert.ok(s.sorten * s.hoehe >= vorher || n >= 7, `Stufe ${n} nicht kleiner`);
    vorher = s.sorten * s.hoehe;
  }
});

test("Auslegen: jede Stufe ist lösbar, kein Glas ist schon fertig, gleicher Zufall gleiche Lage", () => {
  for (let n = 1; n <= 8; n++) {
    const s = stufeFuer(n);
    const sortenMap: Sorten = {};
    const keys: string[] = [];
    for (let i = 0; i < s.sorten; i++) for (let j = 0; j < s.hoehe; j++) {
      const k = `s${i}-${j}`;
      sortenMap[k] = `S${i}`;
      keys.push(k);
    }
    for (let seed = 1; seed <= 12; seed++) {
      const lage = legeAus(keys, sortenMap, { hoehe: s.hoehe, leer: s.leer, rng: glasZufall(seed * 97 + n) });
      assert.deepEqual(lage.flat().sort(), [...keys].sort(), "alle Begriffe liegen da");
      assert.ok(lage.filter((g) => !g.length).length >= s.leer, "leere Gläser");
      assert.ok(lage.length <= 8);
      assert.ok(!lage.some((g) => g.length > 1 && g.every((k) => sortenMap[k] === sortenMap[g[0]])), "kein Glas schon sortiert");
      assert.ok(loesbar(lage, sortenMap, s.hoehe), `Stufe ${n}, Zufall ${seed}: lösbar`);
      assert.deepEqual(legeAus(keys, sortenMap, { hoehe: s.hoehe, leer: s.leer, rng: glasZufall(seed * 97 + n) }), lage);
    }
  }
});

test("Neu mischen: zugemachte Gläser bleiben, der Rest ist wieder lösbar", () => {
  const s: Sorten = { ...sorte, c1: "C", c2: "C", c3: "C" };
  const lage: Glas[] = [["a1", "a2", "a3"], ["b1", "c1", "b2"], ["c2", "b3", "c3"], []];
  const neu = neuMischen(lage, s, 3, glasZufall(5));
  assert.deepEqual(neu[0], ["a1", "a2", "a3"]);
  assert.deepEqual(neu.flat().sort(), lage.flat().sort());
  assert.ok(loesbar(neu, s, 3));
});

test("Themen: jeder Begriff gehört zu genau einer Sorte, jedes Thema hat genug für seine größte Stufe", () => {
  for (const t of GLAS_THEMEN) {
    for (const stufe of [t.ab, Math.max(t.ab, 7)]) {
      const pool = glasKandidaten(t.id, stufe);
      const sorten = sortenVon(t.id, pool);
      assert.ok(sorten.length >= 2, `${t.id}: mindestens zwei Sorten`);
      const jeBegriff = new Map<string, Set<string>>();
      for (const k of pool) {
        assert.equal(themaVonKey(k.karte.key), t.id);
        assert.equal(k.karte.skill, t.skill);
        assert.ok(k.karte.wort && k.karte.wort.length <= 16, `${t.id}: „${k.karte.wort}“ passt in ein Glas`);
        jeBegriff.set(k.karte.wort!, new Set([...(jeBegriff.get(k.karte.wort!) ?? []), k.karte.richtig]));
      }
      for (const [w, s] of jeBegriff) assert.equal(s.size, 1, `${t.id}: „${w}“ steht in ${[...s].join(" und ")}`);
      assert.equal(new Set(pool.map((k) => k.karte.key)).size, pool.length, `${t.id}: Keys eindeutig`);
      const genug = sorten.filter((s) => pool.filter((k) => k.karte.richtig === s).length >= 4);
      assert.ok(genug.length >= Math.min(3, sorten.length), `${t.id}: genug Sorten mit vier Begriffen`);
    }
  }
});

test("Wortarten: kein Wort steht in zwei Wortarten, die Volksschule hat drei", () => {
  const alle = Object.values(WORTART_WOERTER).flat().map((w) => w!.toLowerCase());
  assert.equal(new Set(alle).size, alle.length);
  assert.deepEqual(wortartenFuer(3), ["nomen", "verb", "adjektiv"]);
  assert.equal(sortenVon("wortarten", glasKandidaten("wortarten", 3)).length, 3);
  assert.equal(sortenVon("wortarten", glasKandidaten("wortarten", 7)).length, 7);
});

test("Fälle: nur männliche Nomen, der Artikel bestimmt den Fall", () => {
  const pool = glasKandidaten("faelle", 6);
  const by = (w: string) => pool.find((k) => k.karte.wort === w)?.karte.richtig;
  assert.equal(by("dem Hund"), "Dativ");
  assert.equal(by("den Hund"), "Akkusativ");
  assert.equal(by("des Hundes"), "Genitiv");
  assert.equal(by("der Hund"), "Nominativ");
  assert.equal(by("einen Vater"), "Akkusativ");
});

test("Auswahl einer Stufe: so viele Sorten und Begriffe wie verlangt, Fehler zuerst, nicht zuletzt gesehene", () => {
  const pool = glasKandidaten("faelle", 6);
  const reihenfolge = sortenVon("faelle", pool);
  const karten = waehleGlasKarten(pool, { reihenfolge, sorten: 3, hoehe: 4, rng: glasZufall(3) });
  assert.equal(karten.length, 12);
  const sorten = [...new Set(karten.map((k) => k.richtig))];
  assert.equal(sorten.length, 3);
  for (const s of sorten) assert.equal(karten.filter((k) => k.richtig === s).length, 4);
  for (const k of karten) assert.deepEqual(k.faecher, reihenfolge.filter((s) => sorten.includes(s)), "Fächer in der Reihenfolge des Themas");
  const proNomen = new Map<string, number>();
  for (const k of karten) proNomen.set(k.wort!.split(" ")[1].replace(/e?s$/, ""), (proNomen.get(k.wort!.split(" ")[1].replace(/e?s$/, "")) ?? 0) + 1);
  assert.ok(Math.max(...proNomen.values()) <= 2, "höchstens zwei Formen desselben Nomens");

  const fehler = pool.find((k) => k.karte.richtig === "Genitiv")!.karte.key;
  const mitFehler = waehleGlasKarten(pool, { reihenfolge, sorten: 2, hoehe: 4, wiederholen: [fehler], rng: glasZufall(9) });
  assert.ok(mitFehler.some((k) => k.key === fehler), "der Fehler kommt wieder");

  const zuletzt = pool.filter((k) => k.karte.richtig === "Dativ").slice(0, 40).map((k) => k.karte.key);
  const neu = waehleGlasKarten(pool, { reihenfolge: ["Dativ", "Akkusativ"], sorten: 2, hoehe: 4, zuletzt, rng: glasZufall(4) });
  assert.ok(neu.filter((k) => k.richtig === "Dativ").every((k) => !zuletzt.includes(k.key)), "zuletzt gesehene kommen erst später");

  // ein Thema mit weniger Sorten (der, die, das) bleibt bei seinen
  const artikel = glasKandidaten("artikel", 5);
  assert.equal(new Set(waehleGlasKarten(artikel, { reihenfolge: sortenVon("artikel", artikel), sorten: 5, hoehe: 4, rng: glasZufall(1) }).map((k) => k.richtig)).size, 3);
});

test("Dein Stoff: nur Antworten mit mindestens drei kurzen Fragen werden Gläser", () => {
  const k = (frage: string, richtig: string) => ({ art: "wahl" as const, frage, richtig, falsch: ["x"], merke: "" });
  const karten = [
    k("Trilobit", "Erdaltertum"),
    k("Urfarn", "Erdaltertum"),
    k("Panzerfisch", "Erdaltertum"),
    k("Tyrannosaurus", "Erdmittelalter"),
    k("Ammonit", "Erdmittelalter"),
    k("Archaeopteryx", "Erdmittelalter"),
    k("Mammut", "Erdneuzeit"),
    k("Wann lebte der Mensch? Eine lange Frage über die Zeit", "Erdneuzeit"),
    k("Das ___ ist alt", "Erdaltertum"),
  ];
  const pool = stoffKandidaten(karten, "bio.evolution");
  assert.deepEqual([...new Set(pool.map((p) => p.karte.richtig))].sort(), ["Erdaltertum", "Erdmittelalter"]);
  assert.equal(pool.length, 6);
  assert.ok(pool.every((p) => p.karte.skill === "bio.evolution" && themaVonKey(p.karte.key) === "stoff"));
  assert.deepEqual(stoffKandidaten(karten.slice(0, 4), "x"), [], "nur ein Glas: nichts für Glasklar");
});
