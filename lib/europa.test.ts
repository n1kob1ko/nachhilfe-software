/**
 * Europa (lib/europa.ts): die 47 Länder mit Hauptstadt, Flagge und Karte, Karten und falsche Antworten, Schreiben wie
 * im Test, der Stand je Teil (erobert), Verwechslungen, Rennen, großer Test mit Note, und am Server die Runden.
 * Alle Namen von Schülern sind erfunden.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  abstandHalten,
  erobert,
  europaDuellKarten,
  europaKarte,
  europaRunde,
  europaStand,
  flagge,
  frageText,
  geschriebenAls,
  grosserTest,
  land,
  LAENDER,
  lageText,
  note,
  paarTipp,
  pruefeGeschrieben,
  rennenKarten,
  sitzt,
  TYPISCHE_PAARE,
  verwechslerKarten,
  verwechslungen,
  vonKey,
  waehleLaender,
  wahlFuer,
  woLiegt,
} from "./europa";
import { KARTE } from "./europa-karte";
import { DUELL_ARTEN, istDuellArt } from "./lernspiele-typen";
import { zufall } from "./phantombild";

process.env.DATABASE_PATH = ":memory:";

test("47 Länder: eindeutig, Nachbarn gegenseitig, jedes mit Pfad, Mitte, Hauptstadt-Punkt und Flagge", () => {
  assert.equal(LAENDER.length, 47);
  assert.equal(new Set(LAENDER.map((l) => l.code)).size, 47);
  assert.equal(new Set(LAENDER.map((l) => l.name)).size, 47);
  for (const l of LAENDER) {
    for (const n of l.nachbarn) assert.ok(land(n)?.nachbarn.includes(l.code), `${l.code} – ${n} nicht gegenseitig`);
    assert.ok(l.nachbarn.length > 0 || l.insel, `${l.name}: weder Nachbarn noch Insel`);
    assert.ok(KARTE.laender[l.code]?.startsWith("M"), `Pfad fehlt: ${l.name}`);
    assert.ok(KARTE.mitte[l.code] && KARTE.stadt[l.code], `Punkte fehlen: ${l.name}`);
    const [x, y] = KARTE.stadt[l.code];
    assert.ok(x > 0 && x < KARTE.breite && y > 0 && y < KARTE.hoehe, `Hauptstadt außerhalb: ${l.name}`);
    assert.ok(existsSync(path.join(process.cwd(), "public", flagge(l.code))), `Flagge fehlt: ${l.name}`);
  }
  // Stichproben
  assert.equal(land("at")?.hauptstadt, "Wien");
  assert.equal(land("ch")?.hauptstadt, "Bern");
  assert.equal(land("tr")?.hauptstadt, "Ankara");
  assert.deepEqual([...land("li")!.nachbarn].sort(), ["at", "ch"]);
});

test("Fragen als Sätze, mit Artikel und Mehrzahl", () => {
  assert.equal(woLiegt(land("ch")!), "Wo liegt die Schweiz?");
  assert.equal(woLiegt(land("nl")!), "Wo liegen die Niederlande?");
  assert.equal(woLiegt(land("at")!), "Wo liegt Österreich?");
  assert.equal(frageText(land("sk")!, "stadt"), "Wie heißt die Hauptstadt der Slowakei?");
  assert.equal(frageText(land("gb")!, "stadt"), "Wie heißt die Hauptstadt des Vereinigten Königreichs?");
  assert.equal(frageText(land("nl")!, "landFlagge"), "Welche Flagge haben die Niederlande?");
  assert.equal(lageText(land("dk")!), "Dänemark grenzt nur an Deutschland.");
  assert.equal(lageText(land("li")!), "Liechtenstein grenzt an Schweiz und Österreich.");
  assert.match(lageText(land("mt")!), /^Malta ist eine kleine Insel/);
  assert.match(lageText(land("nl")!), /^Die Niederlande grenzen an/);
});

test("Antworten zur Wahl: vier verschiedene, genau eine richtig, Nachbarn und eigene Verwechsler zuerst", () => {
  for (let i = 0; i < 30; i++) {
    const rng = zufall(i);
    const l = LAENDER[i % 47];
    for (const frage of ["welches", "stadt", "flaggeLand", "landFlagge"] as const) {
      const w = wahlFuer(l, frage, rng);
      assert.equal(w.length, 4);
      assert.equal(new Set(w).size, 4);
      assert.ok(w.includes(frage === "stadt" ? l.hauptstadt : l.name));
    }
  }
  const sk = land("sk")!;
  assert.ok(wahlFuer(sk, "welches", zufall(1), { verwechselt: ["si"] }).includes("Slowenien"));
  assert.deepEqual(wahlFuer(sk, "stadt", zufall(1), { nur: ["si"] }).sort(), ["Bratislava", "Ljubljana"]);
});

test("Runde zum Üben: je Land Lage, Hauptstadt, Flagge; nie dasselbe Land direkt hintereinander", () => {
  const codes = ["at", "de", "ch", "it", "fr", "sk", "si", "hu"];
  const karten = europaRunde(codes, "ueben", zufall(4));
  assert.equal(karten.length, 24);
  assert.equal(new Set(karten.map((k) => k.key)).size, 24);
  for (let i = 1; i < karten.length; i++) assert.notEqual(karten[i].europa!.land, karten[i - 1].europa!.land);
  for (const k of karten) {
    const d = k.europa!;
    if (d.antwort === "kacheln" || d.antwort === "flaggen") assert.equal(k.faecher.length, 4);
    else assert.deepEqual(k.faecher, [k.richtig]);
    assert.equal(k.richtig, d.frage === "stadt" ? land(d.land)!.hauptstadt : land(d.land)!.name);
  }
  // wie im Test: geschrieben (oder auf der Karte getippt), nie Kacheln
  const test = europaRunde(codes, "test", zufall(5));
  assert.ok(test.every((k) => k.europa!.antwort === "schreiben" || k.europa!.antwort === "karte"));
  assert.ok(test.filter((k) => k.europa!.teil === "hauptstadt").every((k) => k.europa!.antwort === "schreiben"));
  assert.deepEqual(abstandHalten([], 2), []);
});

test("Schreiben: andere Namen und Akzente zählen, kleine Tippfehler „fast“, ein anderes Land nie", () => {
  const p = (e: string, c: string, was: "land" | "stadt") => pruefeGeschrieben(e, land(c)!, was);
  assert.equal(p("reykjavik", "is", "stadt"), "richtig");
  assert.equal(p("Oesterreich", "at", "land"), "richtig");
  assert.equal(p("Holland", "nl", "land"), "richtig");
  assert.equal(p("Weißrussland", "by", "land"), "richtig");
  assert.equal(p("Chisinau", "md", "stadt"), "richtig");
  assert.equal(p("Kyjiw", "ua", "stadt"), "richtig");
  assert.equal(p("Tallin", "ee", "stadt"), "fast");
  assert.equal(p("Lisabon", "pt", "stadt"), "fast");
  assert.equal(p("Slovakei", "sk", "land"), "fast");
  assert.equal(p("Slowenien", "sk", "land"), "falsch");
  assert.equal(p("Bukarest", "hu", "stadt"), "falsch");
  assert.equal(p("Zürich", "ch", "stadt"), "falsch");
  assert.equal(p("", "at", "land"), "falsch");
  assert.equal(p("Rom", "it", "stadt"), "richtig");
  assert.equal(p("Ron", "it", "stadt"), "falsch", "kurze Wörter: kein Tippfehler");
  assert.equal(geschriebenAls("slowenien", "land"), "Slowenien");
  assert.equal(geschriebenAls("Laibach", "stadt"), "Ljubljana");
  assert.equal(geschriebenAls("Gotham", "stadt"), "Gotham");
});

test("Stand: ein Teil sitzt nach zwei richtigen Runden hintereinander; alle drei: erobert", () => {
  const runde = (ok: Record<string, boolean>) => ({ antworten: Object.entries(ok).map(([key, richtig]) => ({ key, richtig })) });
  const s = europaStand([
    runde({ "europa:at:lage": true, "europa:at:hauptstadt": true, "europa:at:flagge": true, "europa:sk:lage": false }),
    // Rennen: „~2“ ist dieselbe Karte
    runde({ "europa:at:lage": true, "europa:at:hauptstadt": true, "europa:at:flagge~2": true, "europa:sk:lage": true }),
  ]);
  assert.equal(s.get("europa:at:flagge")?.sicher, true);
  assert.equal(s.get("europa:sk:lage")?.sicher, false);
  const st = sitzt(s);
  assert.deepEqual(st.at, ["lage", "hauptstadt", "flagge"]);
  assert.equal(st.sk, undefined);
  assert.equal(erobert(st), 1);
  assert.deepEqual(vonKey("europa:at:lage"), { code: "at", teil: "lage" });
  assert.equal(vonKey("europa:zz:lage"), null);

  // Auswahl: Fehler zuerst, eroberte zuletzt, nur aus der Region
  const codes = waehleLaender(s, { anzahl: 8, wiederholen: ["sk"], rng: zufall(1) });
  assert.equal(codes.length, 8);
  assert.ok(codes.includes("sk") && !codes.includes("at"));
  const mitte = LAENDER.filter((l) => l.region === "mitte").map((l) => l.code);
  assert.ok(waehleLaender(s, { anzahl: 8, codes: mitte, rng: zufall(2) }).every((c) => mitte.includes(c)));
});

test("Verwechslungen: aus falschen Wahlen werden Paare; Verwechsler-Karten nur mit den beiden", () => {
  const runden = [
    { karten: [], antworten: [{ key: "europa:sk:lage", wahl: "Slowenien", richtig: false }, { key: "europa:hu:hauptstadt", wahl: "Bukarest", richtig: false }] },
    { karten: [], antworten: [{ key: "europa:si:lage", wahl: "Slowakei", richtig: false }, { key: "europa:at:flagge", wahl: "", richtig: false }] },
  ];
  const paare = verwechslungen(runden, new Map());
  assert.deepEqual(paare[0], { teil: "lage", a: "si", b: "sk", mal: 2, tipp: paarTipp("lage", "sk", "si") });
  assert.equal(paare[1].teil, "hauptstadt");
  assert.deepEqual([paare[1].a, paare[1].b], ["hu", "ro"]);
  assert.equal(paare.length, 2, "nichts gewählt ist keine Verwechslung");

  const karten = verwechslerKarten(paare, zufall(3));
  assert.equal(karten.length, 4);
  for (const k of karten) {
    if (k.europa!.antwort !== "karte") assert.equal(k.faecher.length, 2);
    assert.ok(k.europa!.tipp, "mit Merkhilfe");
  }
  // typische Paare: alle Länder gibt es, jede Merkhilfe ist ein Satz
  for (const p of TYPISCHE_PAARE) assert.ok(land(p.a) && land(p.b) && p.tipp.endsWith("."));
  assert.ok(verwechslerKarten(TYPISCHE_PAARE.map((p) => ({ ...p, mal: 0 })), zufall(4)).length >= 10);
});

test("Rennen: alle Länder, keine doppelten Keys; großer Test: jedes Land einmal; Note nach Prozent", () => {
  const r = rennenKarten("lage", zufall(1));
  assert.equal(r.length, 90);
  assert.equal(new Set(r.map((k) => k.key)).size, 90);
  assert.ok(r.every((k) => k.europa!.antwort === "karte" && k.europa!.modus === "rennen"));
  assert.ok(rennenKarten("flagge", zufall(2)).every((k) => k.europa!.frage === "flaggeLand" && k.faecher.length === 4));

  const g = grosserTest(LAENDER.map((l) => l.code), "alles", zufall(3));
  assert.equal(g.length, 47);
  assert.equal(new Set(g.map((k) => k.europa!.land)).size, 47);
  assert.ok(g.every((k) => k.europa!.antwort === "schreiben"));
  const teile = new Map<string, number>();
  for (const k of g) teile.set(k.europa!.teil, (teile.get(k.europa!.teil) ?? 0) + 1);
  assert.ok([...teile.values()].every((n) => n >= 15), "gemischt: alle drei Teile etwa gleich oft");

  assert.deepEqual(note(47, 47), { note: 1, wort: "Sehr gut" });
  assert.equal(note(40, 47).note, 2);
  assert.equal(note(31, 47).note, 3);
  assert.equal(note(24, 47).note, 4);
  assert.equal(note(23, 47).note, 5);
  assert.equal(europaKarte("zz", "lage", "ueben", zufall(1)), null);
});

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Mia Test", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Deutsch", "Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, sp, student: repo.getStudent(id)! };
}

test("Server: für alle, Test in Geografie als Grund; Runden, Stand, Verwechsler, Rennen mit Rekord", async () => {
  const { repo, sp, student } = await setup();
  const heute = "2026-11-22";
  assert.deepEqual(sp.europaWahl(student, heute), {});
  assert.ok(!sp.spielVorschlaege(student, { heute }).some((v) => v.art === "europa"), "keine Kachel bei den Fächern");
  repo.addTest({ student_id: student.id, date: "2026-11-25", subject: "Geografie", kind: "Test", topic: "Europa", grade: null, points: null, max_points: null, notes: "", skill_ids: [], status: "geplant" });
  assert.deepEqual(sp.europaWahl(student, heute), { grund: "Test in 3 Tagen" });

  // Üben: 8 Länder, 24 Karten; eine Verwechslung
  const a = sp.starteRunde(student, "europa", { heute, europa: { modus: "ueben" }, rng: zufall(1) });
  assert.equal(a.karten.length, 24);
  assert.ok(a.karten.every((k) => k.skill === "geo.europa"));
  const falsch = a.karten.find((k) => k.europa!.teil === "lage")!;
  const nachbar = land(land(falsch.europa!.land)!.nachbarn[0] ?? "at")!;
  sp.beendeRunde(student.id, a.rundeId, a.karten.map((k) => ({ key: k.key, wahl: k.key === falsch.key ? nachbar.name : k.richtig })));
  assert.equal(sp.europaVerwechsler(student.id).length, 1);
  assert.deepEqual(sp.europaSitzt(student.id), {});

  // wie im Test: der Fehler kommt wieder; alles richtig → sieben Länder erobert
  const b = sp.starteRunde(student, "europa", { heute, europa: { modus: "test" }, rng: zufall(2) });
  assert.ok(b.karten.some((k) => k.europa!.land === falsch.europa!.land), "das falsche Land kommt wieder");
  const vorher = new Set(a.karten.map((k) => k.europa!.land));
  sp.beendeRunde(student.id, b.rundeId, b.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  const st = sp.europaSitzt(student.id);
  const beide = [...new Set(b.karten.map((k) => k.europa!.land))].filter((c) => vorher.has(c) && c !== falsch.europa!.land);
  assert.ok(beide.every((c) => st[c]?.length === 3), "zweimal ganz richtig: erobert");
  assert.notEqual(st[falsch.europa!.land]?.length, 3);

  // Verwechsler: das eigene Paar zuerst
  const v = sp.starteRunde(student, "europa", { heute, europa: { modus: "verwechsler" }, rng: zufall(3) });
  assert.equal(v.karten[0].europa!.modus, "verwechsler");
  assert.ok(v.karten.some((k) => k.europa!.land === nachbar.code || k.europa!.land === falsch.europa!.land));

  // Region: nur Länder aus Nordeuropa
  const n = sp.starteRunde(student, "europa", { heute, europa: { modus: "ueben", region: "nord" }, rng: zufall(4) });
  assert.ok(n.karten.every((k) => land(k.europa!.land)!.region === "nord"));

  // großer Test mit Flaggen: 47 Karten
  const g = sp.starteRunde(student, "europa", { heute, europa: { modus: "gross", thema: "flagge" }, rng: zufall(5) });
  assert.equal(g.karten.length, 47);

  // Rennen: zählt nur die beantworteten Karten; Rekord je Thema
  const r = sp.starteRunde(student, "europa", { heute, europa: { modus: "rennen", thema: "hauptstadt" }, endlos: "neu", rng: zufall(6) });
  assert.equal(r.endlos, r.rundeId);
  assert.equal(sp.europaRennenThema(student.id, r.rundeId), "hauptstadt");
  const e = sp.beendeRunde(student.id, r.rundeId, r.karten.slice(0, 12).map((k, i) => ({ key: k.key, wahl: i < 10 ? k.richtig : "Nirgendwo" })), { teil: true });
  assert.deepEqual([e?.richtig, e?.anzahl], [10, 12]);
  assert.deepEqual(sp.europaRekorde(student.id), { lage: 0, hauptstadt: 10, flagge: 0 });
  assert.equal(sp.europaRekorde(student.id, r.rundeId).hauptstadt, 0, "ohne dieses Rennen");
  assert.equal(sp.europaRennenThema(student.id, a.rundeId), null);
});

test("Duell: 12 Karten im Kachelfeld, eindeutig, Flaggen mit Bild", () => {
  assert.ok(istDuellArt("europa") && DUELL_ARTEN.includes("europa"));
  assert.ok(!istDuellArt("blatt"), "andere eigene Felder bleiben ohne Duell");
  for (let s = 1; s <= 40; s++) {
    const k = europaDuellKarten(zufall(s));
    assert.equal(k.length, 12);
    assert.equal(new Set(k.map((x) => x.key)).size, 12);
    assert.equal(new Set(k.map((x) => x.europa!.land)).size, 12, "jedes Land nur einmal");
    for (const x of k) {
      assert.equal(x.form, "kacheln");
      assert.equal(x.faecher.length, 4);
      assert.ok(x.faecher.includes(x.richtig));
      assert.equal(new Set(x.faecher).size, 4);
      if (x.europa!.teil === "flagge") assert.equal(x.bild?.src, flagge(x.europa!.land));
      else assert.ok(!x.bild && x.vor.length > 0);
      if (x.europa!.teil === "lage") {
        // keine falsche Antwort grenzt auch an alle genannten Nachbarn
        const genannt = LAENDER.filter((l) => x.vor.includes(l.name)).map((l) => l.code);
        for (const f of x.faecher.filter((f) => f !== x.richtig)) {
          const andere = LAENDER.find((l) => l.name === f)!;
          assert.ok(!genannt.every((c) => andere.nachbarn.includes(c)), `${x.vor}${f}`);
        }
      }
    }
  }
  const eine = europaDuellKarten(zufall(7)).find((x) => x.europa!.teil === "hauptstadt")!;
  assert.match(eine.vor, /^Die Hauptstadt (von|der|des) /);
});
