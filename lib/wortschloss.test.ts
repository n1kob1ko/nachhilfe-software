import { test } from "node:test";
import assert from "node:assert/strict";
import { bewerte, ersteWahl, gross, gueltigeWortPunkte, schlossWort, tastatur, tastenFarben, wortPunkte } from "./wortschloss";
import { STOFF_WORT, stoffWoerter, vokabelWoerter, waehleWortKarten, wortKandidaten, WORT_THEMEN } from "./wortschloss-themen";
import { festerZufall } from "./lernspiele-typen";

test("bewerte: grün, gold, grau", () => {
  assert.deepEqual(bewerte("trank", "trank"), ["ja", "ja", "ja", "ja", "ja"]);
  assert.deepEqual(bewerte("knart", "trank"), ["fast", "fast", "ja", "fast", "fast"]);
  assert.deepEqual(bewerte("blumo", "trank"), ["nein", "nein", "nein", "nein", "nein"]);
});

test("bewerte: doppelte Buchstaben leuchten nur so oft, wie sie im Wort sind", () => {
  // „eeeee“ gegen „gegen“: zwei e im Wort, beide an der richtigen Stelle; die anderen grau
  assert.deepEqual(bewerte("eeeee", "gegen"), ["nein", "ja", "nein", "ja", "nein"]);
  // „ellen“ gegen „gegen“: e an 1 und 4 im Wort (Index 1, 3); getippt e an 0 und 3
  assert.deepEqual(bewerte("ellen", "gegen"), ["fast", "nein", "nein", "ja", "ja"]);
  // ein e im Wort: nur das erste getippte e leuchtet gold
  assert.deepEqual(bewerte("seele", "haben"), ["nein", "fast", "nein", "nein", "nein"]);
});

test("bewerte: Umlaute und ß sind eigene Buchstaben", () => {
  assert.deepEqual(bewerte("glaser", "gläser"), ["ja", "ja", "nein", "ja", "ja", "ja"]);
  assert.deepEqual(bewerte("füsse", "füßex"), ["ja", "ja", "nein", "nein", "fast"]);
});

test("tastenFarben: grün schlägt gold", () => {
  const m = tastenFarben(["knart", "trank"], "trank");
  assert.equal(m.get("t"), "ja");
  assert.equal(m.get("k"), "ja");
  assert.equal(tastenFarben(["blumo"], "trank").get("b"), "nein");
});

test("schlossWort: nur Buchstaben, 3 bis 10", () => {
  assert.equal(schlossWort(" Gläser "), "gläser");
  assert.equal(schlossWort("go"), null);
  assert.equal(schlossWort("ice cream"), null);
  assert.equal(schlossWort("don't"), null);
  assert.equal(schlossWort("verantwortung"), null);
  assert.equal(gross("ß"), "ß");
  assert.equal(gross("ä"), "Ä");
});

test("tastatur: Umlaute nur, wenn ein Wort sie braucht", () => {
  assert.equal(tastatur(["went", "gone"]).flat().includes("ü"), false);
  assert.equal(tastatur(["went", "aß"]).flat().includes("ß"), true);
  assert.equal(tastatur(["went"])[0][5], "z");
});

test("Punkte: die erste Reihe zählt am meisten, mal die Stufe; die Wertung nimmt die erste Reihe", () => {
  assert.equal(wortPunkte(1, 1), 100);
  assert.equal(wortPunkte(2, 3), 180);
  assert.equal(wortPunkte(7, 1), 0);
  assert.equal(gueltigeWortPunkte(-5), 0);
  assert.equal(gueltigeWortPunkte(9e9), 3_000_000);
  assert.equal(gueltigeWortPunkte("x"), 0);
  assert.equal(ersteWahl("TRANK", "trank"), "trank");
  assert.equal(ersteWahl("trinkte", "trank"), "trinkte");
});

test("Themen: jedes feste Thema hat genug tippbare, eindeutige Wörter", () => {
  for (const t of WORT_THEMEN) {
    const pool = wortKandidaten(t.id);
    assert.ok(pool.length >= 12, `${t.id}: ${pool.length}`);
    for (const k of pool) {
      assert.ok(schlossWort(k.karte.richtig), `${t.id}: ${k.karte.richtig}`);
      assert.ok(k.karte.wort && k.karte.marke && k.karte.regel, k.karte.key);
      assert.ok(k.karte.key.startsWith(`wort:${t.id}:`));
    }
    assert.equal(new Set(pool.map((k) => k.karte.key)).size, pool.length, t.id);
  }
  const prae = wortKandidaten("praeteritum").find((k) => k.karte.wort === "trinken")!;
  assert.equal(prae.karte.richtig, "trank");
  const p2 = wortKandidaten("partizip").find((k) => k.karte.wort === "gehen")!;
  assert.equal(p2.karte.richtig, "gegangen");
  assert.match(p2.karte.marke!, /ist/);
  const mz = wortKandidaten("mehrzahl").find((k) => k.karte.wort === "das Glas")!;
  assert.equal(mz.karte.richtig, "Gläser");
  assert.equal(wortKandidaten("irregular").filter((k) => k.karte.wort === "go").length, 2);
});

test("Vokabeln und Spielkarten: nur Antworten aus einem Wort", () => {
  const v = (en: string, de: string) => ({ karte: { key: `vokabeln:${en}=${de}`, wort: en, richtig: de, vor: "", nach: "", faecher: [], loesung: "", regel: "" }, stufe: 1 as const, en: [en], de: [de] });
  const w = vokabelWoerter([v("to run", "laufen"), v("ice cream", "Eis"), v("butterfly", "der Schmetterling")], "eigen");
  assert.deepEqual(w.map((k) => [k.karte.wort, k.karte.richtig]), [["laufen", "run"], ["der Schmetterling", "butterfly"]]);
  const s = stoffWoerter(
    [
      { art: "wahl", frage: "Hauptstadt von Frankreich?", richtig: "Paris", falsch: ["Lyon"], merke: "" },
      { art: "wahl", frage: "Wie viel ist 2 + 2?", richtig: "4", falsch: ["5"], merke: "" },
      { art: "reihe", frage: "Ordne", teile: ["a", "b", "c"], merke: "" },
    ],
    "stoff.eigen",
  );
  assert.equal(s.length, 1);
  assert.equal(s[0].karte.richtig, "Paris");
  assert.ok(s[0].karte.key.startsWith(`wort:${STOFF_WORT}:`));
});

test("waehleWortKarten: erst kurze Wörter, Fehler zuerst, ein Verb nur einmal", () => {
  const pool = wortKandidaten("irregular");
  const rng = festerZufall(7);
  const a = waehleWortKarten(pool, { stufe: 1, rng });
  assert.equal(a.length, 4);
  assert.ok(a.every((k) => k.richtig.length <= 6));
  const verben = a.map((k) => k.wort);
  assert.equal(new Set(verben).size, verben.length);
  const lang = pool.find((k) => k.karte.richtig === "forgotten")!;
  const b = waehleWortKarten(pool, { stufe: 3, wiederholen: [lang.karte.key], rng });
  assert.equal(b[0].richtig, "forgotten");
});
