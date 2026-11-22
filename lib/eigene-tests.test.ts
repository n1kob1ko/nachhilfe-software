/**
 * Eigene Tests (lib/eigene-tests.ts, lib/eigene-tests-speicher.ts): der Europe-Test wie im Artifact (82 Punkte, Lösungen),
 * Bewertung je Zeile und Lücke, Mehrfachwahl mit Abzug, Ansicht ohne Lösungen, Freigabe und Abgaben. Namen sind erfunden.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { EIGENE_TESTS, eigenerTest } from "./eigene-tests-liste";
import { bewerteTest, gesamtPunkte, leereFelder, lueckenStuecke, noteFuer, normLuecke, pruefeTest, saubereAntworten, testAnsicht, type Antworten, type EigenerTest } from "./eigene-tests";

process.env.DATABASE_PATH = ":memory:";

const EU = eigenerTest("europe-geography")!;

/** Alle Antworten richtig, offene Fragen leer. */
function richtigeAntworten(t: EigenerTest): Antworten {
  const a: Antworten = {};
  for (const teil of t.teile)
    for (const f of teil.fragen) {
      if (f.art === "auswahl") a[f.id] = f.items.map(([, l]) => l);
      if (f.art === "rf") a[f.id] = f.items.map(([, w]) => w);
      if (f.art === "luecken") a[f.id] = f.luecken.map((l) => l[0]);
      if (f.art === "mc") a[f.id] = f.richtig;
      if (f.art === "mehrfach") a[f.id] = f.richtige;
      if (f.art === "offen") a[f.id] = "Meine Antwort.";
    }
  return a;
}

test("Alle Tests sind in Ordnung, und ihre Bilder gibt es", () => {
  for (const t of EIGENE_TESTS) {
    assert.deepEqual(pruefeTest(t), [], t.key);
    if (t.bild) assert.ok(existsSync(path.join(process.cwd(), "public", t.bild.src)), `Bild fehlt: ${t.bild.src}`);
  }
});

test("Europe – Geography: wie im Artifact, 4 Teile, 29 Fragen, 82 Punkte", () => {
  assert.equal(EU.teile.length, 4);
  assert.equal(EU.teile.flatMap((t) => t.fragen).length, 29);
  assert.equal(gesamtPunkte(EU), 82);
  assert.deepEqual(
    testAnsicht(EU).teile.map((t) => t.punkte),
    [28, 16, 16, 22],
  );
});

test("Alles richtig: alle Punkte außer den offenen Fragen, die warten", () => {
  const e = bewerteTest(EU, richtigeAntworten(EU));
  assert.equal(e.offen, 4);
  assert.equal(e.punkte, 82 - 9);
  assert.equal(e.gesamt, 82);
  // mit den offenen Fragen (Lehrkraft bzw. Schüler)
  const voll = bewerteTest(EU, richtigeAntworten(EU), { A9: 2, C7: 2, C8: 2, D7: 3 });
  assert.equal(voll.punkte, 82);
  assert.equal(voll.offen, 0);
  assert.equal(voll.note, "Sehr gut (1)");
});

test("Teilpunkte: je Zeile, Lücke und Aussage ein Punkt; Mehrfachwahl zieht für falsche ab", () => {
  const a = richtigeAntworten(EU);
  a.A1 = ["Ural Mountains", "Danube", "Caspian Sea", "", "Black Sea", "Bosporus", "Sea of Marmara", "Dardanelles", "Aegean Sea"];
  a.A5 = [0, 1, 2]; // zwei richtig, eine falsch: 1 Punkt
  a.A7 = [1, 3, 5, 0]; // drei richtig, eine falsch: 2 Punkte
  a.D1 = [true, true, true, false, null, true]; // 2. und 5. falsch
  a.B2 = ["three", "SHIELD ", "platforms", "Iron Ore"];
  const e = bewerteTest(EU, a);
  const f = (id: string) => e.fragen.find((x) => x.id === id)!;
  assert.equal(f("A1").punkte, 7);
  assert.deepEqual(
    f("A1").zeilen!.filter((z) => !z.richtig).map((z) => z.loesung),
    ["Ural River", "Caucasus"],
  );
  assert.equal(f("A5").punkte, 1);
  assert.equal(f("A5").falschAngekreuzt, 1);
  assert.equal(f("A7").punkte, 2);
  assert.equal(f("D1").punkte, 4);
  assert.equal(f("B2").punkte, 3);
  assert.equal(f("B2").zeilen![2].loesung, "Platform");
});

test("Lücken wie im Artifact: Groß/klein, Leerzeichen und Akzente egal, Zahlen mit Punkt oder Komma", () => {
  assert.equal(normLuecke(" Ariane. "), "ariane");
  assert.equal(normLuecke("Érze"), "erze");
  const a = richtigeAntworten(EU);
  a.C2 = ["1.500", "1,800", "2000"];
  a.D2 = ["10,18", "738", "107", "30"];
  a.A8 = ["ariane"];
  const e = bewerteTest(EU, a);
  for (const id of ["C2", "D2", "A8"]) assert.equal(e.fragen.find((x) => x.id === id)!.punkte, e.fragen.find((x) => x.id === id)!.max, id);
  // eine leere Lücke ist nie richtig
  assert.equal(bewerteTest(EU, { ...a, A8: [""] }).fragen.find((x) => x.id === "A8")!.punkte, 0);
});

test("Note zur Orientierung: 89 / 76 / 63 / 50 %", () => {
  assert.equal(noteFuer(89), "Sehr gut (1)");
  assert.equal(noteFuer(88), "Gut (2)");
  assert.equal(noteFuer(63), "Befriedigend (3)");
  assert.equal(noteFuer(50), "Genügend (4)");
  assert.equal(noteFuer(49), "Nicht genügend (5)");
});

test("Die Ansicht für den Schüler hat keine Lösungen", () => {
  const ansicht = JSON.stringify(testAnsicht(EU));
  for (const geheim of ['"items"', '"richtig"', '"richtige"', '"luecken":[', '"muster"', "in favour of a"]) assert.ok(!ansicht.includes(geheim), geheim);
  assert.ok(ansicht.includes("Ural River")); // als Option zur Auswahl schon
  assert.deepEqual(lueckenStuecke("a {0} b {1} c", 2), ["a ", " b ", " c"]);
});

test("Leere Felder und saubere Antworten (die Abgabe kommt aus dem Browser)", () => {
  assert.equal(leereFelder(EU, {}), 9 + 3 + 1 + 1 + 1 + 5 + 1 + 1 + 1 + 4 + 4 + 1 + 4 + 3 + 5 + 3 + 4 + 2 + 6 + 4 + 1 + 1 + 4 + 1 + 1);
  assert.equal(leereFelder(testAnsicht(EU), richtigeAntworten(EU)), 0);
  const s = saubereAntworten(EU, { A1: ["Ural Mountains", "<script>", 3], A3: 9, A5: [0, 0, 7, 2], A9: "x".repeat(9000), Z9: "?" });
  assert.deepEqual((s.A1 as string[]).slice(0, 3), ["Ural Mountains", "", ""]);
  assert.equal(s.A3, null);
  assert.deepEqual(s.A5, [0, 2]);
  assert.equal((s.A9 as string).length, 4000);
  assert.ok(!("Z9" in s));
});

test("Speicher: nur freigeschaltet sichtbar, Abgabe, Selbstbewertung und Lehrkraft vor Schüler", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./eigene-tests-speicher");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Mia Test", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Englisch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  assert.deepEqual(sp.testsFuer(repo.getStudent(id)!), []);
  sp.freigeben(id, "europe-geography", teacher.id);
  sp.freigeben(id, "europe-geography", teacher.id); // zweimal ist einmal
  assert.deepEqual(sp.testsFuer(repo.getStudent(id)!).map((t) => t.key), ["europe-geography"]);
  assert.throws(() => sp.freigeben(id, "gibt-es-nicht", teacher.id));

  const a = sp.abgeben(id, EU, richtigeAntworten(EU), 1834.4);
  assert.equal(a.sekunden, 1834);
  assert.equal(sp.ergebnisVon(a)!.offen, 4);
  sp.setzeSelbst(a.id, id, "D7", 3);
  assert.throws(() => sp.setzeSelbst(a.id, id, "D7", 4), /0 bis 3/);
  assert.throws(() => sp.setzeSelbst(a.id, id, "A1", 1), /gibt es nicht/);
  assert.throws(() => sp.setzeSelbst(a.id, id + 1, "D7", 1), /gibt es nicht/);
  assert.equal(sp.ergebnisVon(sp.getAbgabe(a.id)!)!.punkte, 73 + 3);
  sp.setzeLehrer(a.id, "D7", 1);
  assert.equal(sp.ergebnisVon(sp.getAbgabe(a.id)!)!.punkte, 73 + 1);
  sp.setzeLehrer(a.id, "D7", null);
  assert.equal(sp.ergebnisVon(sp.getAbgabe(a.id)!)!.punkte, 73 + 3);
  assert.equal(sp.abgabenVon(id, "europe-geography").length, 1);

  sp.zuruecknehmen(id, "europe-geography");
  assert.deepEqual(sp.testsFuer(repo.getStudent(id)!), []);
  assert.equal(sp.abgabenVon(id).length, 1); // die Abgabe bleibt
});

test("Keine Lösung im Browser: die Seite des Schülers lädt die Testdateien nie", async () => {
  const { readFileSync } = await import("node:fs");
  for (const datei of ["lib/eigene-tests.ts", "components/lernen/EigenerTest.tsx"]) {
    const text = readFileSync(path.join(process.cwd(), datei), "utf8");
    assert.ok(!/from "[^"]*eigene-tests(-liste|\/)/.test(text), datei);
  }
});
