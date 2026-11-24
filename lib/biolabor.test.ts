/**
 * Biolabor (lib/biolabor.ts, lib/biolabor-inhalt.ts): der Stoff ist vollständig und sauber, Kreuzungsschemata stimmen,
 * Schreiben wie im Test, der Stand, und am Server wer es sieht und welche Aufgaben kommen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BIO_EINTRAEGE,
  BIO_THEMEN,
  bioRunde,
  bioStand,
  SCHREIB_JE_RUNDE,
  BLOCK_THEMEN,
  lehrerNr,
  schreibbar,
  eintragKarten,
  eintraegeFuer,
  felder,
  feldWahl,
  genotyp,
  merkeFuer,
  normal,
  pruefeGeschrieben,
  pruefeSchema,
  schemaText,
  vonKey,
  waehleEintraege,
  LEBEN,
  LEVELS,
  LEVEL_TITEL,
  levelAuswahl,
  levelEintraege,
  levelOffen,
  levelStand,
  levelVon,
  sterneFuer,
} from "./biolabor";
import type { KreuzungEintrag } from "./biolabor-inhalt";
import { zufall } from "./phantombild";

process.env.DATABASE_PATH = ":memory:";

const kreuzung = (id: string) => BIO_EINTRAEGE.find((e): e is KreuzungEintrag => e.id === id && e.art === "kreuzung")!;

test("Der Stoff: jedes Thema des Teststoffs, eindeutige ids, jede Frage mit genug falschen Antworten", () => {
  const titel = BIO_THEMEN.map((t) => t.titel);
  for (const t of ["Grundlagen der Vererbung", "Glossar Genetik", "Glossar aus dem Heft", "Weitergabe der Erbinformation", "DNA und Chromosomen", "Mendel’sche Regeln", "Kreuzungsschemata", "Vererbung beim Menschen", "Gentechnik", "Gentechnik und Lebensmittel", "Biotechnik", "Das Nervensystem", "Das Gehirn", "Das Rückenmark", "Lernen und Gedächtnis", "Das unwillkürliche Nervensystem", "Sympathikus und Parasympathikus"])
    assert.ok(titel.includes(t), t);
  const ids = BIO_EINTRAEGE.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "ids doppelt");
  for (const e of BIO_EINTRAEGE) {
    assert.ok(BIO_THEMEN.some((t) => t.id === e.thema), `${e.id}: Thema`);
    assert.match(e.id, /^[a-z0-9-]+$/);
    if (e.art === "wahl" || e.art === "kreuzung") {
      assert.ok(e.falsch.length >= 1, `${e.id}: falsche Antworten`);
      assert.ok(!e.falsch.includes(e.richtig), `${e.id}: richtig unter falsch`);
      assert.equal(new Set(e.falsch).size, e.falsch.length, `${e.id}: falsch doppelt`);
    }
    if (e.art === "wahl" && e.schreib) assert.ok(e.schreib.map(normal).includes(normal(e.richtig)) || e.schreib.length > 0, e.id);
  }
  // jedes Thema hat genug zum Üben
  for (const t of BIO_THEMEN) assert.ok(BIO_EINTRAEGE.filter((e) => e.thema === t.id && e.art !== "erklaeren").length >= 4, t.id);
  assert.ok(BIO_EINTRAEGE.length >= 200, `nur ${BIO_EINTRAEGE.length} Einträge`);
  // die Bilder gibt es
  for (const b of ["hintergrund", "dna", "maskottchen-ruhig", "maskottchen-jubel", "maskottchen-denkt"])
    assert.ok(existsSync(path.join(process.cwd(), "public/spiele/biolabor", `${b}.webp`)), b);
});

test("Fachlich: die wichtigsten Fakten stimmen", () => {
  const richtig = (id: string) => {
    const e = BIO_EINTRAEGE.find((x) => x.id === id);
    return e && (e.art === "wahl" || e.art === "zuordnen" || e.art === "kreuzung") ? e.richtig : e?.art === "begriff" ? e.begriff : undefined;
  };
  assert.equal(richtig("d-46"), "46");
  assert.equal(richtig("d-23"), "23");
  assert.equal(richtig("d-at"), "T");
  assert.equal(richtig("d-gc"), "G");
  // wie im Buch (Expedition Biologie 4, S. 8–17, 54–72)
  assert.equal(richtig("b-pgen"), "Elterngeneration");
  assert.equal(richtig("n-sensibel"), "sensorische Nerven");
  assert.equal(richtig("h-stamm"), "Nachhirn");
  assert.equal(richtig("h-abschnitte"), "5");
  assert.equal(richtig("h-eizelle"), "22 + X");
  assert.deepEqual(kreuzung("k-wunder-p").allele, ["r", "w"]);
  assert.deepEqual(kreuzung("k-rhesus").allele, ["Rh", "rh"]);
  assert.equal(richtig("e-kurz"), "Sekunden bis wenige Minuten");
  assert.equal(richtig("x-dolly"), "Dolly");
  assert.equal(richtig("m-1"), "Uniformitätsregel");
  assert.equal(richtig("m-2"), "Spaltungsregel");
  assert.equal(richtig("m-3"), "Unabhängigkeitsregel");
  assert.equal(richtig("m-31"), "3 : 1");
  assert.equal(richtig("m-121"), "1 : 2 : 1");
  assert.equal(richtig("h-mann"), "XY");
  assert.equal(richtig("t-insulin"), "rote Gentechnik");
  assert.equal(richtig("t-mais"), "grüne Gentechnik");
  assert.equal(richtig("t-wasch"), "weiße Gentechnik");
  assert.equal(richtig("y-herz-schnell"), "Sympathikus");
  assert.equal(richtig("y-verdauung-an"), "Parasympathikus");
  assert.equal(richtig("h-klein"), "Kleinhirn");
});

test("Kreuzungsschema: Genotypen in der üblichen Reihenfolge, die Felder stimmen zu den Fragen", () => {
  assert.equal(genotyp("r", "R", ["R", "r"]), "Rr");
  assert.equal(genotyp("0", "A", ["A", "B", "0"]), "A0");
  assert.equal(genotyp("B", "A", ["A", "B", "0"]), "AB");
  assert.equal(genotyp("Y", "X", ["X", "Y"]), "XY");
  assert.deepEqual(feldWahl(["R", "r"]), ["RR", "Rr", "rr"]);
  assert.deepEqual(feldWahl(["X", "Y"]), ["XX", "XY"]);
  assert.deepEqual(feldWahl(["A", "B", "0"]), ["AA", "AB", "A0", "BB", "B0", "00"]);
  assert.equal(schemaText(kreuzung("k-erbse-p")), "Rr|Rr|Rr|Rr");
  assert.equal(schemaText(kreuzung("k-erbse-f1")), "RR|Rr|Rr|rr");
  assert.equal(schemaText(kreuzung("k-blut-a0b0")), "AB|A0|B0|00");
  assert.equal(schemaText(kreuzung("k-blut-ab00")), "A0|A0|B0|B0");
  assert.equal(schemaText(kreuzung("k-geschlecht")), "XX|XY|XX|XY");
  // jedes Feld ist ein möglicher Genotyp der Kreuzung
  for (const k of BIO_EINTRAEGE.filter((e): e is KreuzungEintrag => e.art === "kreuzung")) {
    for (const f of felder(k.mutter, k.vater, k.allele)) assert.ok(feldWahl(k.allele).includes(f), `${k.id}: ${f}`);
    for (const g of [...k.mutter, ...k.vater]) assert.ok(k.allele.includes(g), `${k.id}: ${g}`);
  }
});

test("Kreuzungsschema prüfen: Reihenfolge der Keimzellen egal, falsche Stellen werden genannt", () => {
  const k = kreuzung("k-erbse-rueck"); // Rr × rr
  assert.deepEqual(pruefeSchema(k, { gameten: null, felder: ["Rr", "Rr", "rr", "rr"] }), { ok: true, falsch: [] });
  // „rR“ zählt wie „Rr“
  assert.equal(pruefeSchema(k, { gameten: null, felder: ["rR", "Rr", "rr", "rr"] }).ok, true);
  assert.deepEqual(pruefeSchema(k, { gameten: null, felder: ["Rr", "rr", "rr", "rr"] }).falsch, ["f1"]);
  // wie im Test: Keimzellen der Mutter vertauscht, Felder passen dazu
  assert.equal(pruefeSchema(k, { gameten: ["r", "R", "r", "r"], felder: ["rr", "rr", "Rr", "Rr"] }).ok, true);
  // falsche Keimzellen beim Vater
  const r = pruefeSchema(k, { gameten: ["R", "r", "R", "r"], felder: ["RR", "Rr", "Rr", "rr"] });
  assert.equal(r.ok, false);
  assert.ok(r.falsch.includes("g2") && r.falsch.includes("g3"));
});

test("Schreiben wie im Test: Artikel, Umlaute und kleine Tippfehler, aber nie ein anderer Begriff", () => {
  assert.equal(pruefeGeschrieben("die Mitose", ["Mitose"]), "richtig");
  assert.equal(pruefeGeschrieben("Uniformitaetsregel", ["Uniformitätsregel"]), "richtig");
  assert.equal(pruefeGeschrieben("in der Bauchspeicheldrüse", ["Bauchspeicheldrüse"]), "richtig");
  assert.equal(pruefeGeschrieben("Uniformitätsregl", ["Uniformitätsregel"]), "fast");
  assert.equal(pruefeGeschrieben("Meiose", ["Mitose"]), "falsch", "Meiose ist nie fast Mitose");
  assert.equal(pruefeGeschrieben("Dendrit", ["Axon", "Nervenfaser"]), "falsch");
  assert.equal(pruefeGeschrieben("47", ["46"]), "falsch", "Zahlen genau");
  assert.equal(pruefeGeschrieben("46", ["46"]), "richtig");
  assert.equal(pruefeGeschrieben("XX", ["XY"]), "falsch");
  assert.equal(pruefeGeschrieben("", ["Gen"]), "falsch");
  assert.equal(pruefeGeschrieben("sensorische Nerven", ["sensible Nerven", "sensorische Nerven"]), "richtig");
});

test("Karten: Üben mit Kacheln, wie im Test geschrieben, Schema mit Frage danach", () => {
  const rng = zufall(3);
  const k = kreuzung("k-blut-a0b0");
  const [schema, frage] = eintragKarten(k, "ueben", rng);
  assert.equal(schema.key, "bio:k-blut-a0b0");
  assert.equal(schema.bio?.art, "schema");
  assert.equal(schema.bio?.schema?.gameten, true);
  assert.equal(schema.richtig, "AB|A0|B0|00");
  assert.equal(frage.key, "bio:k-blut-a0b0:frage");
  assert.ok(frage.faecher.includes("A, B, AB und 0"));
  assert.equal(vonKey(frage.key), "k-blut-a0b0");
  assert.equal(eintragKarten(k, "test", rng)[0].bio?.schema?.gameten, false, "wie im Test: Keimzellen selbst");

  const wahl = BIO_EINTRAEGE.find((e) => e.id === "w-mitose")!;
  assert.equal(eintragKarten(wahl, "ueben", rng)[0].faecher.length, 4);
  const t = eintragKarten(wahl, "test", rng)[0];
  assert.equal(t.bio?.art, "schreiben");
  assert.deepEqual(t.faecher, ["Mitose"]);
  // ohne Schreibweise bleibt es auch im Test beim Antippen
  assert.equal(eintragKarten(BIO_EINTRAEGE.find((e) => e.id === "d-watson")!, "test", rng)[0].bio?.art, "kacheln");
  const begriff = eintragKarten(BIO_EINTRAEGE.find((e) => e.id === "b-allel")!, "ueben", rng)[0];
  assert.equal(begriff.faecher.length, 4);
  assert.ok(begriff.faecher.includes("Allel"));
  assert.equal(new Set(begriff.faecher).size, 4);
  // offene Fragen nur im Test
  assert.ok(!eintraegeFuer("alle", "ueben").some((e) => e.art === "erklaeren"));
  assert.ok(eintraegeFuer("alle", "test").some((e) => e.art === "erklaeren"));
  assert.ok(eintraegeFuer("mensch", "ueben").every((e) => ["nerven", "gehirn", "rueckenmark", "lernen", "vegetativ", "sympathikus"].includes(e.thema)));
});

test("Runden: Fehler zuerst, sicher nach zweimal richtig, großer Test aus allen Themen", () => {
  const rng = zufall(5);
  const r1 = bioRunde(new Map(), { auswahl: "genetik", modus: "ueben", rng });
  const eintraege = new Set(r1.map((k) => vonKey(k.key)));
  assert.equal(eintraege.size, 10);
  // eine Runde mit einem Fehler
  const fehler = r1[0];
  const runde = (karten: typeof r1, falsch?: string) => ({ antworten: karten.map((k) => ({ key: k.key, richtig: k.key !== falsch })) });
  let stand = bioStand([runde(r1, fehler.key)]);
  assert.equal([...stand.values()].filter((s) => s.sicher).length, 0);
  const r2 = bioRunde(stand, { auswahl: "genetik", modus: "ueben", wiederholen: [vonKey(fehler.key)!], rng });
  assert.ok(r2.some((k) => vonKey(k.key) === vonKey(fehler.key)), "der Fehler kommt wieder");
  // neue Einträge vor den schon gesehenen
  assert.ok(r2.filter((k) => eintraege.has(vonKey(k.key))).length <= 2);
  stand = bioStand([runde(r1, fehler.key), runde(r1)]);
  assert.equal([...stand.values()].filter((s) => s.sicher).length, 9, "zweimal hintereinander richtig");

  const gross = bioRunde(new Map(), { auswahl: "alle", modus: "ueben", gross: true, rng });
  const themen = new Set(gross.map((k) => k.bio?.thema));
  assert.equal(new Set(gross.map((k) => vonKey(k.key))).size, 24);
  assert.ok(themen.size >= 12, `nur ${themen.size} Themen`);
  assert.ok(gross.every((k) => k.bio?.modus === "test"));
  const offene = new Set(gross.filter((k) => k.bio?.art === "selbst").map((k) => k.key)).size;
  assert.ok(offene <= 8, `${offene} offene Fragen`);
  // höchstens ein Drittel offene Fragen
  const w = waehleEintraege(eintraegeFuer("weitergabe", "test"), new Map(), { anzahl: 6, rng });
  assert.ok(w.filter((e) => e.art === "erklaeren").length <= 2);
});

test("Blockwerk: nur Fragen zum Selbstschreiben, aus vielen Themen, Fehler zuerst", () => {
  const rng = zufall(7);
  // nur Fragen der Lehrerin und das Glossar aus dem Heft (niko: „es sind zu viele Fragen“)
  const pool = BIO_EINTRAEGE.filter((e) => schreibbar(e) && BLOCK_THEMEN.includes(e.thema));
  assert.ok(pool.length >= 80, `nur ${pool.length} Fragen zum Schreiben`);
  const r = bioRunde(new Map(), { auswahl: "alle", modus: "ueben", schreiben: true, rng });
  assert.equal(r.length, SCHREIB_JE_RUNDE);
  assert.ok(r.every((k) => k.bio?.art === "schreiben" && k.faecher.length === 1), "nichts zum Ankreuzen");
  assert.ok(r.every((k) => BLOCK_THEMEN.includes(k.bio!.thema)));
  const fehler = pool.find((e) => e.art === "begriff")!;
  const r2 = bioRunde(new Map(), { auswahl: "alle", modus: "ueben", schreiben: true, wiederholen: [fehler.id, "x-gibt-es-nicht"], rng });
  assert.ok(r2.some((k) => vonKey(k.key) === fehler.id));
  // was man nur ankreuzen kann (Sympathikus oder Parasympathikus, offene Fragen, Schemata) kommt nicht
  const nie = new Set(BIO_EINTRAEGE.filter((e) => !schreibbar(e)).map((e) => e.id));
  for (let i = 0; i < 20; i++) assert.ok(bioRunde(new Map(), { auswahl: "alle", modus: "test", schreiben: true, rng }).every((k) => !nie.has(vonKey(k.key)!)));
});

test("Glossar aus dem Heft: die Begriffe der Schülerin in ihren Worten, zum Schreiben", () => {
  const heft = BIO_EINTRAEGE.filter((e) => e.thema === "heft");
  const begriffe = heft.flatMap((e) => (e.art === "begriff" ? [e.begriff] : []));
  for (const b of ["Gen", "Allel", "Karyogramm", "homologe Chromosomen", "Merkmalsträger", "Mendel’sche Regeln", "dominant-rezessiver Erbgang", "intermediärer Erbgang", "Hybrid", "Stammbaum", "Parentalgeneration", "F2-Generation"])
    assert.ok(begriffe.includes(b), b);
  assert.ok(heft.every(schreibbar));
  const ib = BIO_EINTRAEGE.find((e) => e.id === "v-intermediaer");
  assert.ok(ib?.art === "begriff" && /kein Merkmal setzt sich durch/i.test(ib.erklaerung));
  assert.equal(pruefeGeschrieben("Elterngeneration", ["Parentalgeneration", "Elterngeneration", "P-Generation", "P", "E"]), "richtig");
  assert.equal(pruefeGeschrieben("Chromosomensatz", ["Karyogramm"]), "falsch");
});

test("Fragen der Lehrerin: jede Nummer vom Blatt, der Reihe nach, mit Nummer, Lösungen stimmen", () => {
  const l = BIO_EINTRAEGE.filter((e) => e.thema === "lehrerin");
  const nrs = new Set(l.map((e) => lehrerNr(e)));
  for (let n = 1; n <= 24; n++) if (n !== 18) assert.ok(nrs.has(n), `Frage ${n} fehlt`);
  assert.ok(!nrs.has(null), "jede hat eine Nummer");
  const richtig = (id: string) => {
    const e = BIO_EINTRAEGE.find((x) => x.id === id)!;
    return e.art === "wahl" || e.art === "kreuzung" ? e.richtig : "";
  };
  assert.equal(richtig("l-14"), "Paar 4");
  assert.equal(richtig("l-15"), "Fall 2");
  assert.equal(richtig("l-11-kind"), "A0");
  assert.equal(richtig("l-11-partner"), "B0");
  assert.equal(richtig("l-12-koerper"), "46");
  assert.equal(richtig("l-19-21"), "falsch");
  assert.equal(richtig("k-l-erbse-f2"), "3 gelb : 1 grün");
  assert.equal(felder(kreuzung("k-l-erbse-f1").mutter, kreuzung("k-l-erbse-f1").vater, ["G", "g"]).join(" "), "Gg Gg Gg Gg");
  assert.equal(felder(kreuzung("k-l-meer-f2").mutter, kreuzung("k-l-meer-f2").vater, ["S", "s"]).join(" "), "SS Ss Ss ss");
  // eine Runde: der Reihe nach wie auf dem Blatt, die Nummer steht oben, zuerst Frage 1
  const r = bioRunde(new Map(), { auswahl: "lehrerin", modus: "test", rng: zufall(4) });
  const n = r.map((k) => lehrerNr({ id: vonKey(k.key)!, thema: "lehrerin" })!);
  assert.deepEqual(n, [...n].sort((a, b) => a - b));
  assert.equal(n[0], 1);
  assert.match(r[0].bio!.ueber!, /^Frage 1 der Lehrerin/);
  // sicher Gewusstes kommt erst später: dann geht es mit den nächsten Nummern weiter
  const stand = bioStand([{ antworten: r.map((k) => ({ key: k.key, richtig: true })) }, { antworten: r.map((k) => ({ key: k.key, richtig: true })) }]);
  const r2 = bioRunde(stand, { auswahl: "lehrerin", modus: "test", rng: zufall(5) });
  assert.ok(lehrerNr({ id: vonKey(r2[0].key)!, thema: "lehrerin" })! > 1);
});

async function setup(o: { grade?: number; klasse?: number; subjects?: string[] } = {}) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Mia Test", grade: o.grade ?? 8, klasse: o.klasse ?? 4, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: o.subjects ?? ["Deutsch", "Englisch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, sp, student: repo.getStudent(id)! };
}

test("Server: wer es sieht, Runden und Stand", async () => {
  const { repo, sp, student } = await setup();
  const heute = "2026-11-23";
  assert.equal(sp.bioWahl(student, heute), null, "ohne Biologie nicht");
  repo.addTest({ student_id: student.id, date: "2026-11-26", subject: "Biologie", kind: "Test", topic: "Genetik", grade: null, points: null, max_points: null, notes: "", skill_ids: [], status: "geplant" });
  assert.deepEqual(sp.bioWahl(student, heute), { grund: "Test in 3 Tagen" });
  // 2. Klasse mit Bio-Test über Blätter: kein Biolabor; mit Genetik als Stoff schon
  const klein = repo.getStudent(repo.createStudent({ ...student, name: "Lea Test", grade: 6, klasse: 2, subjects: ["Biologie"] }))!;
  assert.equal(sp.bioWahl(klein, heute), null);
  repo.addTest({ student_id: klein.id, date: "2026-11-27", subject: "Biologie", kind: "Test", topic: "Blätter", grade: null, points: null, max_points: null, notes: "", skill_ids: [], status: "geplant" });
  assert.equal(sp.bioWahl(klein, heute), null);
  const vierte = repo.getStudent(repo.createStudent({ ...student, name: "Ben Test", subjects: ["Biologie"] }))!;
  assert.deepEqual(sp.bioWahl(vierte, heute), {});

  const a = sp.starteRunde(student, "bio", { heute, bio: { auswahl: "schema", modus: "ueben" }, rng: zufall(1) });
  assert.ok(a.karten.length >= 10);
  assert.ok(a.karten.every((k) => k.skill === "bio.genetik-mensch" && k.bio?.thema === "schema"));
  const falsch = a.karten.find((k) => k.bio?.art === "schema")!;
  sp.beendeRunde(student.id, a.rundeId, a.karten.map((k) => ({ key: k.key, wahl: k.key === falsch.key ? "RR|RR|RR|RR" : k.richtig })));
  const b = sp.starteRunde(student, "bio", { heute, bio: { auswahl: "alle", modus: "test", gross: true }, rng: zufall(2) });
  assert.ok(b.karten.some((k) => k.key === falsch.key), "der Fehler kommt wieder");
  sp.beendeRunde(student.id, b.rundeId, b.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  const sicher = sp.bioSicher(student.id);
  // neue Einträge kommen zuerst, also war jeder erst einmal richtig: noch nichts sicher (zweimal richtig: Test oben)
  assert.equal(sicher.length, 0);
  assert.ok(!sicher.includes(vonKey(falsch.key)!));
  const themen = sp.bioThemenStand(student.id);
  assert.equal(themen.length, BIO_THEMEN.length);
  assert.ok(themen.find((t) => t.id === "schema")!.gesehen >= 5);
  assert.ok(!sp.spielVorschlaege(vierte, { heute }).some((v) => v.art === "bio"), "keine Kachel bei den Fächern");
  // Blockwerk: Endlos-Lauf mit Fragen zum Schreiben
  const c = sp.starteRunde(student, "bio", { heute, endlos: "neu", bloecke: true, bio: { auswahl: "alle", modus: "test", schreiben: true }, rng: zufall(3) });
  assert.equal(c.karten.length, 10);
  assert.ok(c.karten.every((k) => k.bio?.art === "schreiben"));
  assert.ok(sp.istBlockwerk(student.id, c.rundeId));
  // Labor-Mission: ein Level, ganz richtig = drei Sterne
  const d = sp.starteRunde(student, "bio", { heute, bio: { auswahl: levelAuswahl(4), modus: "test" }, rng: zufall(5) });
  assert.equal(d.karten.length, levelEintraege(4).length);
  sp.beendeRunde(student.id, d.rundeId, d.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  assert.deepEqual(sp.bioLevelStand(student.id), { 4: 3 });
});

test("Labor-Mission: jede Frage der Lehrerin ist ein Level, Sterne nach Fehlern, ein Stern öffnet das nächste", () => {
  const lehrerin = BIO_EINTRAEGE.filter((e) => e.thema === "lehrerin");
  assert.deepEqual(LEVELS, [...new Set(lehrerin.map((e) => lehrerNr(e)!))].sort((a, b) => a - b), "jede Nummer vom Blatt ist ein Level");
  assert.equal(LEVELS.length, 23);
  for (const n of LEVELS) assert.ok(LEVEL_TITEL[n] && levelEintraege(n).length > 0, `Level ${n}`);
  assert.equal(LEVELS.flatMap((n) => levelEintraege(n)).length, lehrerin.length, "alle Einträge kommen vor");
  // die Frage der Lehrerin selbst kommt am Schluss
  const l1 = levelEintraege(1);
  assert.equal(l1[l1.length - 1].art, "erklaeren");
  assert.equal(levelVon(levelAuswahl(16)), 16);
  assert.equal(levelVon("level-18"), null, "18 gehört zu 19");
  assert.equal(levelVon("lehrerin"), null);

  const karten = bioRunde(new Map(), { auswahl: levelAuswahl(16), modus: "ueben", rng: zufall(4) });
  assert.ok(karten.every((k) => k.bio?.thema === "lehrerin" && k.bio.ueber?.includes("16")));
  assert.equal(karten.filter((k) => k.bio?.art === "schema").length, 2, "zwei Kreuzungsschemata");

  assert.deepEqual([0, 1, 2, LEBEN].map(sterneFuer), [3, 2, 1, 0]);
  const runde = (n: number, fehler: number) => {
    const ks = bioRunde(new Map(), { auswahl: levelAuswahl(n), modus: "test", rng: zufall(n) });
    return { antworten: ks.map((k, i) => ({ key: k.key, richtig: i >= fehler })) };
  };
  const stand = levelStand([runde(1, 2), runde(1, 0), runde(11, 3), runde(4, 1), { antworten: [...runde(5, 0).antworten, ...runde(6, 0).antworten] }]);
  assert.deepEqual(stand, { 1: 3, 4: 2, 11: 0 }, "beste Runde zählt, gemischte Runden nicht");
  assert.ok(levelOffen(1, {}) && levelOffen(20, {}), "der Anfang jeder Welt ist offen");
  assert.ok(!levelOffen(2, {}));
  assert.ok(levelOffen(2, stand) && !levelOffen(12, stand), "Level 11 ohne Stern öffnet 12 nicht");
  assert.ok(levelOffen(19, { 17: 1 }), "nach 17 kommt 19");
});

test("Merksatz: jede Karte zeigt nach einem Fehler einen passenden Satz (statt Animationen)", () => {
  for (const e of BIO_EINTRAEGE) assert.ok(merkeFuer(e).length > 10, e.id);
  const satz = (id: string) => merkeFuer(BIO_EINTRAEGE.find((e) => e.id === id)!);
  assert.match(satz("w-mitose"), /Mitose/);
  assert.match(satz("w-wo-meiose"), /Meiose/);
  assert.match(satz("b-gen"), /^Gen: /);
  assert.match(satz("g-umwelt"), /Umwelt/);
  const karten = eintragKarten(BIO_EINTRAEGE.find((e) => e.id === "w-meiose")!, "ueben", zufall(1));
  assert.equal(karten[0].regel, satz("w-meiose"));
});
