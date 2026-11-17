/**
 * Torlauf (lib/torlauf.ts): Tempo, Torstellen, Antworten auf den Toren, Hindernisse, Treffer und Punkte.
 * Ohne Datenbank; die Runden am Server prüft lib/lernspiele.test.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { festerZufall } from "./lernspiele-typen";
import {
  antwortAufSpur,
  FREI_VOR_TOR,
  gueltigeTorPunkte,
  HUERDE_HOEHE,
  lesezeit,
  passierbar,
  reiheBei,
  reihenAbstand,
  SICHT,
  SPRUNG_DAUER,
  sprungHoehe,
  streckeNach,
  tempo,
  TEMPO_MAX,
  TEMPO_START,
  torFaktor,
  torOptionen,
  torSpuren,
  torStelle,
  trifft,
} from "./torlauf";

const karte = (key: string, faecher: string[], richtig: string) => ({ key, faecher, richtig });

test("das Tempo steigt mit der Strecke und bleibt unter dem Höchsten", () => {
  assert.equal(tempo(0), TEMPO_START);
  assert.ok(tempo(500) > tempo(100));
  assert.equal(tempo(100_000), TEMPO_MAX);
  assert.equal(tempo(-50), TEMPO_START);
});

test("alle fünf Tore beginnt eine neue Strecke, die Lesezeit wird kürzer, aber nie zu kurz", () => {
  assert.equal(streckeNach(0), 1);
  assert.equal(streckeNach(4), 1);
  assert.equal(streckeNach(5), 2);
  assert.equal(streckeNach(12), 3);
  assert.ok(lesezeit(1) > lesezeit(3));
  assert.equal(lesezeit(50), 4.5);
});

test("die Tore stehen hinter dem Horizont, hinter allem Geplanten und lassen Zeit zum Lesen", () => {
  for (const spieler of [0, 300, 2000, 9000]) {
    for (const strecke of [1, 3, 8]) {
      const s = torStelle(spieler, spieler + 40, strecke);
      assert.ok(s > spieler + SICHT, "erst hinter dem Horizont");
      assert.ok(s >= spieler + 40 + FREI_VOR_TOR, "Platz vor dem Tor");
      assert.ok((s - spieler) / tempo(spieler) >= lesezeit(strecke) - 1e-9, "Zeit zum Lesen");
    }
  }
  // schon weit geplant: dann dahinter
  assert.equal(torStelle(0, 200, 1), 200 + FREI_VOR_TOR);
});

test("auf den Toren stehen höchstens drei Antworten, die richtige immer dabei", () => {
  const k = karte("a1", ["der", "die", "das", "den"], "das");
  const o = torOptionen(k);
  assert.equal(o.length, 3);
  assert.ok(o.includes("das"));
  assert.deepEqual(torOptionen(k), o, "immer dieselbe Reihenfolge");
  assert.deepEqual(torOptionen(karte("b", ["das", "dass"], "dass")).sort(), ["das", "dass"]);
  // die richtige steht nicht immer an derselben Stelle
  const stellen = new Set(["a", "b", "c", "d", "e", "f"].map((key) => torOptionen(karte(key, ["x", "y", "z"], "y")).indexOf("y")));
  assert.ok(stellen.size >= 2);
  // ohne Auswahl keine Tore
  assert.deepEqual(torOptionen(karte("c", [], "Haus")), []);
  assert.deepEqual(torOptionen(karte("d", ["a", "b"], "c")), []);
  assert.deepEqual(torOptionen(karte("e", ["a", "a"], "a")), [], "doppelte zählen einmal");
});

test("zwei Antworten stehen außen, drei auf allen Spuren", () => {
  assert.deepEqual(torSpuren(3), [0, 1, 2]);
  assert.deepEqual(torSpuren(2), [0, 2]);
  assert.equal(antwortAufSpur(2, 0), 0);
  assert.equal(antwortAufSpur(2, 1), -1, "in der Mitte die Wand");
  assert.equal(antwortAufSpur(2, 2), 1);
  assert.equal(antwortAufSpur(3, 1), 1);
});

test("jede Reihe Hindernisse lässt einen Weg frei", () => {
  const rng = festerZufall(7);
  for (let strecke = 1; strecke <= 8; strecke++) {
    for (let i = 0; i < 400; i++) {
      const reihe = reiheBei(100, strecke, rng);
      const hindernisse = reihe.filter((d) => d.art !== "stern");
      assert.ok(passierbar(hindernisse), `Strecke ${strecke}: ${JSON.stringify(reihe)}`);
      assert.ok(hindernisse.length >= 1);
      if (strecke === 1) assert.equal(hindernisse.length, 1, "am Anfang nur eines je Reihe");
      // Sterne liegen nie auf der Spur eines Hindernisses
      for (const st of reihe.filter((d) => d.art === "stern")) assert.ok(!hindernisse.some((h) => h.spur === st.spur), "Stern auf freier Spur");
      for (const d of reihe) assert.ok(d.spur >= 0 && d.spur <= 2);
    }
    const a = reihenAbstand(strecke, rng);
    assert.ok(a >= 9 && a <= 20);
  }
  assert.ok(!passierbar([0, 1, 2].map((spur) => ({ s: 0, spur, art: "kiste" as const }))));
  assert.ok(passierbar([0, 1, 2].map((spur) => ({ s: 0, spur, art: "huerde" as const }))), "über Hürden springt man");
});

test("Kisten treffen, über Hürden hilft ein Sprung, daneben trifft nichts", () => {
  const kiste = { s: 50, spur: 1, art: "kiste" as const };
  const huerde = { s: 50, spur: 1, art: "huerde" as const };
  assert.ok(trifft(kiste, 50, 1, 0));
  assert.ok(trifft(kiste, 50, 1, 1.2), "über eine Kiste kommt man nicht");
  assert.ok(!trifft(kiste, 50, 0, 0), "andere Spur");
  assert.ok(!trifft(kiste, 52, 1, 0), "noch weit weg");
  assert.ok(trifft(huerde, 50, 1, 0));
  assert.ok(!trifft(huerde, 50, 1, HUERDE_HOEHE + 0.1));
  // mitten im Sprung ist man hoch genug, am Anfang und Ende nicht
  assert.ok(sprungHoehe(SPRUNG_DAUER / 2) > HUERDE_HOEHE);
  assert.equal(sprungHoehe(0), 0);
  assert.equal(sprungHoehe(SPRUNG_DAUER + 0.1), 0);
  // beim Spurwechsel genau dazwischen trifft die Kiste noch nicht
  assert.ok(!trifft(kiste, 50, 0.45, 0));
});

test("Fieber und Punkte", () => {
  assert.equal(torFaktor(0), 1);
  assert.equal(torFaktor(2), 1);
  assert.equal(torFaktor(3), 2);
  assert.equal(torFaktor(6), 3);
  assert.equal(torFaktor(40), 3);
  assert.equal(gueltigeTorPunkte(1234.4), 1234);
  assert.equal(gueltigeTorPunkte(-5), 0);
  assert.equal(gueltigeTorPunkte("viel"), 0);
  assert.equal(gueltigeTorPunkte(Number.POSITIVE_INFINITY), 0);
  assert.equal(gueltigeTorPunkte(9e12), 5_000_000);
});
