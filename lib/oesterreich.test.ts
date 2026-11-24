/**
 * Österreich erobern (lib/oesterreich.ts, lib/oesterreich-inhalt.ts): der Stoff ist vollständig und lösbar, Karte,
 * Schreiben und Zahlen, Sterne je Level, und am Server wer es sieht und welche Karten kommen. Namen erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ALTERSAUFBAU,
  alleEintraege,
  balkenTrifft,
  BOSS_ANZAHL,
  BOSS_LEVEL,
  BUNDESLAENDER,
  karteVon,
  LEVELS,
  levelStand,
  oeRunde,
  oeStand,
  pruefeGeschrieben,
  REIHE_TRENNER,
  alsSchreiben,
  tippbar,
  vonKey,
  zahlAus,
} from "./oesterreich";
import { LAND_PFADE, STADT_ORTE } from "./oesterreich-karte";

process.env.DATABASE_PATH = ":memory:";

const rng = () => 0.42;

test("Stoff: 9 Level, eines je Bundesland, Wien zuletzt; jeder Eintrag lösbar", () => {
  assert.equal(LEVELS.length, 9);
  assert.deepEqual(new Set(LEVELS.map((l) => l.land)).size, 9);
  assert.equal(LEVELS[LEVELS.length - 1].land, "w");
  assert.equal(LEVELS[LEVELS.length - 1].nr, BOSS_LEVEL);
  const ids = alleEintraege().map((x) => x.e.id);
  assert.equal(new Set(ids).size, ids.length, "Einträge eindeutig");
  for (const l of LEVELS.filter((x) => x.nr !== BOSS_LEVEL)) {
    assert.ok(l.eintraege.length >= 8 && l.eintraege.length <= 20, `Level ${l.nr}: ${l.eintraege.length}`);
    assert.ok(l.zettel.length > 0);
  }
  for (const { e } of alleEintraege()) {
    assert.match(e.id, /^[a-z0-9-]+$/);
    if (e.art === "wahl") {
      assert.ok(!e.falsch.includes(e.richtig), e.id);
      assert.equal(new Set([e.richtig, ...e.falsch]).size, 4, `${e.id}: vier verschiedene Kacheln`);
    }
    if (e.art === "gruppe") assert.ok(e.gruppen.includes(e.richtig), e.id);
    if (e.art === "balken") for (const z of e.ziel) assert.ok(ALTERSAUFBAU.some((a) => String(a.ab) === z.replace(/^[mf]/, "")), `${e.id}: ${z}`);
    const k = karteVon(e, 1, rng);
    if (k.faecher.length && e.art !== "land" && e.art !== "stadt") assert.ok(k.faecher.includes(k.richtig), `${e.id}: Lösung unter den Kacheln`);
    assert.ok(k.loesung.length > 0);
  }
});

test("Zahlen im Stoff: Einwohner-Gruppen und Ausländeranteil passen zu den Bundesländern", () => {
  for (const { e } of alleEintraege()) {
    if (e.art !== "gruppe") continue;
    const b = BUNDESLAENDER.find((x) => x.id === e.land)!;
    if (e.gruppen[0] === "über 1 Million") {
      const g = b.einwohner > 1_000_000 ? 0 : b.einwohner > 500_000 ? 1 : 2;
      assert.equal(e.richtig, e.gruppen[g], e.id);
    } else assert.equal(e.richtig, e.gruppen[b.auslaender > 19.6 ? 0 : 1], e.id);
  }
  const reihe = alleEintraege().find((x) => x.e.id === "e-reihe")!.e;
  assert.ok(reihe.art === "reihe");
  const nachEinw = [...BUNDESLAENDER].sort((a, b) => b.einwohner - a.einwohner).map((b) => b.name);
  assert.deepEqual(reihe.teile, nachEinw.slice(0, 4));
});

test("Karte: alle Bundesländer und Hauptstädte da", () => {
  for (const b of BUNDESLAENDER) {
    assert.ok(LAND_PFADE[b.id]?.d.startsWith("M"), b.id);
    assert.ok(STADT_ORTE[b.id], b.id);
  }
});

test("Antworten: Balken, Zahlen, Schreiben, Reihe", () => {
  assert.ok(balkenTrifft(["55", "60"], "m55"));
  assert.ok(balkenTrifft(["55"], "f55"));
  assert.ok(balkenTrifft(["f85"], "f85"));
  assert.ok(!balkenTrifft(["f85"], "m85"));
  assert.ok(!balkenTrifft(["10"], "m15"));
  assert.equal(zahlAus("−9"), -9);
  assert.equal(zahlAus("- 9"), -9);
  assert.equal(zahlAus("minus 9"), -9);
  assert.equal(zahlAus("9"), 9);
  assert.equal(zahlAus("neun"), null);
  assert.equal(pruefeGeschrieben("Landflucht", ["Landflucht"]), "richtig");
  assert.equal(pruefeGeschrieben("die Landflucht", ["Landflucht"]), "richtig");
  assert.equal(pruefeGeschrieben("Landflugt", ["Landflucht"]), "fast");
  assert.equal(pruefeGeschrieben("Stadtflucht", ["Landflucht"]), "falsch");
  assert.equal(pruefeGeschrieben("Demografie", ["Demographie", "Demografie"]), "richtig");
  assert.equal(pruefeGeschrieben("Sankt Pölten", ["St. Pölten", "Sankt Pölten"]), "richtig");
  assert.equal(pruefeGeschrieben("St. Pölten", ["St. Pölten"]), "richtig");
  const e = alleEintraege().find((x) => x.e.id === "z-reihe")!.e;
  const k = karteVon(e, 5, rng);
  assert.equal(k.richtig, ["Staat", "Bundesland", "Bezirk", "Gemeinde", "Adresse"].join(REIHE_TRENNER));
  assert.notEqual(k.oe?.teile?.join(), "Staat,Bundesland,Bezirk,Gemeinde,Adresse", "nicht schon richtig gemischt");
});

test("Runden und Sterne: Level ganz, Endgegner 15 aus allen, Sterne aus den Fehlern", () => {
  const leer = new Map();
  const l4 = oeRunde(leer, { was: "level", level: 4 }, rng);
  assert.equal(l4.length, LEVELS[3].eintraege.length);
  assert.ok(l4.every((k) => vonKey(k.key)?.level === 4));
  const boss = oeRunde(leer, { was: "level", level: BOSS_LEVEL }, Math.random);
  assert.equal(boss.length, BOSS_ANZAHL);
  assert.equal(new Set(boss.map((k) => k.key)).size, BOSS_ANZAHL);
  const begriffe = oeRunde(leer, { was: "begriffe" }, rng);
  assert.ok(begriffe.length >= 10 && begriffe.every((k) => k.oe?.art === "schreiben" || k.oe?.art === "zahl"));
  assert.equal(oeRunde(leer, { was: "fehler" }, rng).length, 0);

  const runde = (karten: typeof l4, falsch: number, offen = 0) => ({
    antworten: karten.map((k, i) => ({ key: k.key, wahl: i < offen ? "" : i < falsch ? "x" : k.richtig, richtig: i >= falsch })),
  });
  assert.deepEqual(levelStand([runde(l4, 0)]), { 4: 3 });
  assert.deepEqual(levelStand([runde(l4, 1), runde(l4, 2)]), { 4: 2 });
  assert.deepEqual(levelStand([runde(l4, 3)]), {}, "drei Fehler: verloren");
  assert.deepEqual(levelStand([runde(l4, 1, 1)]), {}, "nicht fertig gespielt");
  assert.deepEqual(levelStand([runde(boss, 3)]), { 9: 2 });
  assert.deepEqual(levelStand([runde(begriffe, 0)]), {}, "Begriffe sind kein Level");

  const st = oeStand([runde(l4, 2)]);
  assert.equal([...st.values()].filter((s) => s.zuletztFalsch).length, 2);
  const fehler = oeRunde(st, { was: "fehler" }, rng);
  assert.equal(fehler.length, 2);
});

test("Selbst schreiben: Schwer, Endgegner, und nach einer richtigen Antwort", () => {
  const leer = new Map();
  const normal = oeRunde(leer, { was: "level", level: 1 }, rng);
  assert.ok(normal.some((k) => k.oe?.art === "land"), "zuerst mit Antippen");
  const schwer = oeRunde(leer, { was: "level", level: 1, schwer: true }, rng);
  assert.ok(schwer.every((k) => k.oe?.art === "schreiben"), "Schwer: alles geschrieben");
  const tirol = schwer.find((k) => k.oe?.eintrag === "l-t")!;
  assert.equal(tirol.richtig, "Tirol");
  assert.equal(tirol.oe?.zeigeLand, "t");
  assert.equal(tirol.oe?.frage, "Wie heißt das markierte Bundesland?");
  const klein = schwer.find((k) => k.oe?.eintrag === "l-klein")!;
  assert.equal(klein.oe?.zeigeLand, undefined, "nicht verraten");
  assert.equal(klein.oe?.frage, "Schreib das flächenmäßig kleinste Bundesland.");
  // einmal richtig: kommt zum Schreiben wieder
  const st = oeStand([{ antworten: normal.map((k) => ({ key: k.key, wahl: k.richtig, richtig: k.oe?.eintrag !== "l-t" })) }]);
  const zweite = oeRunde(st, { was: "level", level: 1 }, rng);
  assert.equal(zweite.find((k) => k.oe?.eintrag === "l-v")?.oe?.art, "schreiben");
  assert.equal(zweite.find((k) => k.oe?.eintrag === "l-t")?.oe?.art, "land", "zuletzt falsch: wieder mit Antippen");
  const boss = oeRunde(leer, { was: "level", level: BOSS_LEVEL }, rng);
  for (const k of boss) {
    const e = alleEintraege().find((x) => x.e.id === k.oe?.eintrag)!.e;
    if (tippbar(e)) assert.equal(k.oe?.art, "schreiben", e.id);
  }
  const graz = alsSchreiben(alleEintraege().find((x) => x.e.id === "h-graz")!.e, 2, rng);
  assert.equal(graz.richtig, "Graz");
  assert.equal(graz.oe?.zeigeStadt, "st");
  const gem = alsSchreiben(alleEintraege().find((x) => x.e.id === "k-gemeinden")!.e, 3, rng);
  assert.equal(pruefeGeschrieben("2000", [gem.richtig, ...(gem.oe?.auch ?? [])]), "richtig");
  assert.equal(pruefeGeschrieben("2.000", [gem.richtig, ...(gem.oe?.auch ?? [])]), "richtig");
  const pz = alsSchreiben(alleEintraege().find((x) => x.e.id === "d-anteil")!.e, 6, rng);
  assert.equal(pruefeGeschrieben("19,6", [pz.richtig, ...(pz.oe?.auch ?? [])]), "richtig");
  const noe = alsSchreiben(alleEintraege().find((x) => x.e.id === "k-ooe")!.e, 3, rng);
  assert.equal(pruefeGeschrieben("OÖ", [noe.richtig]), "richtig");
  assert.ok(!tippbar(alleEintraege().find((x) => x.e.id === "z-doppelt")!.e), "lange Sätze bleiben zum Antippen");
});

test("Server: wer es sieht, Runde starten und beenden", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const neu = (name: string, grade: number, subjects: string[]) =>
    repo.getStudent(
      repo.createStudent({ name, grade, klasse: grade - 4, teacher_id: teacher.id, school: "BG Wien", school_type: "AHS", subjects, current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" }),
    )!;
  const heute = "2026-11-24";
  assert.equal(sp.oesterreichWahl(neu("Ida Test", 7, ["Mathematik"]), heute), null, "ohne Geografie nicht");
  assert.equal(sp.oesterreichWahl(neu("Ben Test", 8, ["GWB"]), heute), null, "andere Klasse nicht");
  const s = neu("Max Test", 7, ["Deutsch", "GWB"]);
  assert.deepEqual(sp.oesterreichWahl(s, heute), {});
  assert.equal(sp.oesterreichWahl(s, "2026-11-27"), null, "nach dem Test weg");
  repo.addTest({ student_id: s.id, date: "2026-11-26", subject: "GWB", kind: "Test", topic: "Österreich", grade: null, points: null, max_points: null, notes: "", skill_ids: [], status: "geplant" });
  assert.deepEqual(sp.oesterreichWahl(s, heute), { grund: "Test in 2 Tagen" });
  assert.equal(sp.oesterreichWahl(s, "2026-11-27"), null);
  // ein anderer mit GW-Test zum Thema Bevölkerung, aber 8. Schulstufe: auch
  const t = neu("Lea Test", 8, ["Englisch"]);
  repo.addTest({ student_id: t.id, date: "2026-12-01", subject: "Geografie", kind: "Test", topic: "Bevölkerung in Österreich", grade: null, points: null, max_points: null, notes: "", skill_ids: [], status: "geplant" });
  assert.ok(sp.oesterreichWahl(t, heute)?.grund);

  const r = sp.starteRunde(s, "oesterreich", { heute, oe: { was: "level", level: 1 } });
  assert.equal(r.karten.length, LEVELS[0].eintraege.length);
  sp.beendeRunde(s.id, r.rundeId, r.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  const st = sp.oesterreichStand(s.id);
  assert.deepEqual(st.level, { 1: 3 });
  assert.deepEqual(st.falsch, []);
  assert.ok(!sp.spielVorschlaege(s, { heute }).some((v) => v.art === "oesterreich"), "keine Kachel bei den Fächern");
});
