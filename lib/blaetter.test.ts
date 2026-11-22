/**
 * Blätter bestimmen (lib/blaetter.ts): die Liste „Blättersammlung 2.D“, Karten und falsche Antworten, Schreiben wie im
 * Test, der Stand je Blatt, und am Server wer es sieht und welche Blätter kommen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { antworten, blattBild, blattKarten, blattStand, FAMILIEN, mitArtikel, PFLANZEN, pflanze, pruefeGeschrieben, vonKey, waehleBlaetter } from "./blaetter";
import { zufall } from "./phantombild";

process.env.DATABASE_PATH = ":memory:";

test("Die Liste: 26 Pflanzen, 19 Familien, wie gedruckt, und zu jeder ein Bild", () => {
  assert.equal(PFLANZEN.length, 26);
  assert.deepEqual(
    PFLANZEN.map((p) => p.nr),
    Array.from({ length: 26 }, (_, i) => i + 1),
  );
  assert.equal(FAMILIEN.length, 19);
  // Stichproben aus der gedruckten Liste (nicht aus der Handschrift)
  assert.equal(pflanze(7)?.familie, "Ölbaumgewächse");
  assert.equal(pflanze(10)?.familie, "Bittereschengewächse");
  assert.equal(pflanze(17)?.familie, "Hülsenfrüchtler");
  assert.equal(pflanze(20)?.familie, "Geißblattgewächse");
  assert.deepEqual(
    PFLANZEN.filter((p) => p.familie === "Seifenbaumgewächse").map((p) => p.name),
    ["Berg-Ahorn", "Feld-Ahorn", "Spitz-Ahorn"],
  );
  for (const p of PFLANZEN) {
    assert.ok(existsSync(path.join(process.cwd(), "public", blattBild(p.nr))), `Bild fehlt: ${p.name}`);
    assert.ok(p.merkmal.length > 10 && p.merkmal.endsWith("."));
  }
});

test("Karten: je Blatt erst Name, dann Familie; vier verschiedene Antworten mit genau einer richtigen", () => {
  const rng = zufall(3);
  const karten = blattKarten([2, 22, 13], "kacheln", rng);
  assert.deepEqual(
    karten.map((k) => k.key),
    ["blatt:2:name", "blatt:2:familie", "blatt:22:name", "blatt:22:familie", "blatt:13:name", "blatt:13:familie"],
  );
  assert.equal(karten[1].blatt?.name, "Berg-Ahorn");
  assert.equal(karten[0].blatt?.name, undefined, "die Namenskarte verrät den Namen nicht");
  for (let s = 1; s <= 200; s++) {
    const r = zufall(s);
    for (const p of PFLANZEN) {
      for (const teil of ["name", "familie"] as const) {
        const a = antworten(p, teil, r);
        const richtig = teil === "name" ? p.name : p.familie;
        assert.equal(a.length, 4);
        assert.equal(new Set(a).size, 4, `doppelt: ${a.join(", ")}`);
        assert.equal(a.filter((x) => x === richtig).length, 1);
      }
    }
  }
  // ähnliche Blätter als falsche Antworten: beim Spitz-Ahorn meist andere gelappte Blätter
  const gelappt = new Set(PFLANZEN.filter((p) => p.form === "gelappt").map((p) => p.name));
  const a = antworten(pflanze(22)!, "name", zufall(9));
  assert.ok(a.filter((x) => gelappt.has(x)).length >= 3);
  // Schreiben: keine Kacheln
  assert.deepEqual(blattKarten([5], "schreiben", rng)[0].faecher, ["Efeu"]);
});

test("Frage nach der Familie mit dem richtigen Artikel", () => {
  assert.equal(mitArtikel("Efeu"), "der Efeu");
  assert.equal(mitArtikel("Spitz-Ahorn"), "der Spitz-Ahorn");
  assert.equal(mitArtikel("Götterbaum"), "der Götterbaum");
  assert.equal(mitArtikel("Linde"), "die Linde");
  assert.equal(mitArtikel("Citrus"), "Citrus");
});

test("Schreiben wie im Test: Groß/klein, Bindestrich und ß egal, kleine Tippfehler „fast“, andere Pflanzen falsch", () => {
  assert.equal(pruefeGeschrieben("rotbuche", "Rot-Buche", "name"), "richtig");
  assert.equal(pruefeGeschrieben(" Berg Ahorn ", "Berg-Ahorn", "name"), "richtig");
  assert.equal(pruefeGeschrieben("Haselnuß", "Haselnuss", "name"), "richtig");
  assert.equal(pruefeGeschrieben("Olbaumgewächse", "Ölbaumgewächse", "familie"), "fast");
  assert.equal(pruefeGeschrieben("Seifenbaumgewächs", "Seifenbaumgewächse", "familie"), "fast");
  assert.equal(pruefeGeschrieben("Bittereschengewäsche", "Bittereschengewächse", "familie"), "fast");
  assert.equal(pruefeGeschrieben("Liguser", "Liguster", "name"), "fast");
  // eine andere Antwort der Liste ist nie „fast“
  assert.equal(pruefeGeschrieben("Feld-Ahorn", "Berg-Ahorn", "name"), "falsch");
  assert.equal(pruefeGeschrieben("Weidengewächse", "Weinrebengewächse", "familie"), "falsch");
  assert.equal(pruefeGeschrieben("Ulme", "Linde", "name"), "falsch");
  assert.equal(pruefeGeschrieben("Ahorn", "Berg-Ahorn", "name"), "falsch");
  assert.equal(pruefeGeschrieben("", "Efeu", "name"), "falsch");
  assert.equal(pruefeGeschrieben("Efe", "Efeu", "name"), "falsch", "kurze Wörter genau");
});

test("Stand: sicher nach zwei gekonnten Runden hintereinander (Name und Familie), ein Fehler setzt zurück", () => {
  const runde = (nr: number, name: boolean, familie: boolean) => ({
    antworten: [
      { key: `blatt:${nr}:name`, richtig: name },
      { key: `blatt:${nr}:familie`, richtig: familie },
    ],
  });
  const s = blattStand([runde(1, true, true), runde(2, true, false), runde(1, true, true), runde(2, true, true), runde(3, true, true), runde(3, false, true), runde(3, true, true)]);
  assert.equal(s.get(1)?.sicher, true);
  assert.equal(s.get(2)?.sicher, false, "nur eine gekonnte Runde nach dem Fehler");
  assert.equal(s.get(3)?.sicher, false);
  assert.equal(s.get(3)?.gesehen, 3);
  assert.equal(vonKey("blatt:99:name"), null);

  // Auswahl: zuerst die Fehler, dann nie gesehene, sichere zuletzt
  const stand = new Map([[1, { gesehen: 2, sicher: true, zuletzt: 4 }]]);
  const nrs = waehleBlaetter(stand, { anzahl: 8, wiederholen: [5], rng: zufall(1) });
  assert.equal(nrs.length, 8);
  assert.ok(nrs.includes(5) && !nrs.includes(1));
  assert.equal(waehleBlaetter(stand, { anzahl: 26, rng: zufall(2) }).length, 26);
});

async function setup(o: { subjects?: string[] } = {}) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Lea Test", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: o.subjects ?? ["Deutsch", "Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, sp, student: repo.getStudent(id)! };
}

test("Server: nur mit Biologie (Profil oder geplanter Test), Runden mit 8 oder allen Blättern, Fehler kommen wieder", async () => {
  const { repo, sp, student } = await setup();
  const heute = "2026-11-22";
  assert.equal(sp.blaetterWahl(student, heute), null, "ohne Biologie nicht");
  assert.ok(!sp.spielVorschlaege(student, { heute }).some((v) => v.art === "blatt"), "keine Kachel bei den Fächern");
  repo.addTest({ student_id: student.id, date: "2026-11-27", subject: "Biologie", kind: "Test", topic: "Blätter", grade: null, points: null, max_points: null, notes: "", skill_ids: [], status: "geplant" });
  assert.deepEqual(sp.blaetterWahl(student, heute), { grund: "Test in 5 Tagen" });
  const bio = repo.getStudent(repo.createStudent({ ...student, name: "Bio Test", subjects: ["Biologie"] }))!;
  assert.deepEqual(sp.blaetterWahl(bio, heute), {});

  const a = sp.starteRunde(student, "blatt", { heute, blatt: { modus: "kacheln" }, rng: zufall(1) });
  assert.equal(a.karten.length, 16);
  assert.ok(a.karten.every((k) => k.skill === "bio.blaetter" && k.blatt?.modus === "kacheln" && k.faecher.length === 4));
  const falsch = a.karten.find((k) => k.blatt?.teil === "familie")!;
  sp.beendeRunde(student.id, a.rundeId, a.karten.map((k) => ({ key: k.key, wahl: k.key === falsch.key ? "nix" : k.richtig })));
  assert.equal(sp.geseheneBlaetter(student.id).length, 8);
  assert.deepEqual(sp.sichereBlaetter(student.id), []);

  const b = sp.starteRunde(student, "blatt", { heute, blatt: { modus: "schreiben", alle: true }, rng: zufall(2) });
  assert.equal(b.karten.length, 52);
  assert.ok(b.karten.some((k) => k.key === falsch.key), "der Fehler kommt wieder");
  assert.ok(b.karten.every((k) => k.faecher.length === 1));
  sp.beendeRunde(student.id, b.rundeId, b.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  // die 7 Blätter, die zweimal ganz richtig waren, sind sicher
  assert.equal(sp.sichereBlaetter(student.id).length, 7);
  assert.ok(!sp.sichereBlaetter(student.id).includes(falsch.blatt!.nr));
});
