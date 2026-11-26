/**
 * Der Stoff von heute ohne KI (Test mit vier Test-Lehrern, 26.11.2026, Punkt M4): der getippte Text wurde holprig zerlegt.
 * „Buch Seite 45 48“ wurde ein eigenes Thema, eine Klammer wurde am Komma zerrissen, „Tier- und Pflanzenzelle“ am „und“,
 * und „Adjektiv erkennen“ landete nicht bei den Adjektiven.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  return { l: await import("./lehrplan"), v: await import("./vorgabe") };
}

test("Themen trennen: eine Klammer bleibt ganz, „Tier- und Pflanzenzelle“ auch", async () => {
  const { l } = await setup();
  assert.deepEqual(l.splitTopics("Produktregel und Kettenregel, Kurvendiskussion (Extremstellen, Wendepunkte)"), ["Produktregel", "Kettenregel", "Kurvendiskussion (Extremstellen, Wendepunkte)"]);
  assert.deepEqual(l.splitTopics("Aufbau, Unterschied Tier- und Pflanzenzelle"), ["Aufbau", "Unterschied Tier- und Pflanzenzelle"]);
  assert.deepEqual(l.splitTopics("Brüche, Prozent und Sachaufgaben"), ["Brüche", "Prozent", "Sachaufgaben"], "wie bisher");
});

test("Text ohne KI: Buchseiten sind kein Thema, sondern der Umfang", async () => {
  const { v } = await setup();
  for (const text of ["Wortarten: Nomen erkennen, Adjektiv erkennen. Buch Seite 45-48", "Nomen erkennen, Adjektiv erkennen, Buch S. 45 bis 48", "Nomen erkennen und Adjektiv erkennen (Seite 45, 48)"]) {
    const punkte = v.regelLesung(text).punkte;
    const themen = punkte.filter((p) => p.gruppe !== "umfang").map((p) => p.original);
    assert.ok(themen.includes("Nomen erkennen") && themen.includes("Adjektiv erkennen"), `${text}: ${JSON.stringify(themen)}`);
    assert.ok(!themen.some((t) => /buch|seite|^s$|\d/i.test(t)), `kein Thema aus der Seitenangabe: ${JSON.stringify(themen)}`);
    const umfang = punkte.filter((p) => p.gruppe === "umfang");
    assert.equal(umfang.length, 1, `die Seitenangabe steht einmal als Umfang da: ${JSON.stringify(punkte.map((p) => [p.original, p.gruppe]))}`);
    assert.match(umfang[0].original, /45/);
  }
  const zelle = v.regelLesung("Die Zelle: Aufbau, Zellorganellen, Unterschied Tier- und Pflanzenzelle").punkte.map((p) => p.original);
  assert.ok(zelle.includes("Unterschied Tier- und Pflanzenzelle"), JSON.stringify(zelle));
});

test("Zuordnen ohne KI: „Adjektiv erkennen“ meint die Adjektive, „Nomen erkennen“ die Nomen", async () => {
  const { l } = await setup();
  const vs3 = { school_type: "VS", klasse: 3, grade: 3 };
  const r = l.stoffVorschlag(["Nomen erkennen", "Adjektiv erkennen", "Verben erkennen"], "Deutsch", vs3);
  assert.deepEqual(r[0].best, ["deutsch.wortarten.nomen"]);
  assert.deepEqual(r[1].best, ["deutsch.wortarten.bestimmen.adjektiv"]);
  assert.deepEqual(r[2].best, ["deutsch.wortarten.bestimmen.verb"]);
  assert.deepEqual(l.stoffVorschlag(["Adjektive erkennen"], "Deutsch", vs3)[0].best, ["deutsch.wortarten.bestimmen.adjektiv"], "auch allein und in der Mehrzahl");
});
