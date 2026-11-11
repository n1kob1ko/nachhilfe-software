/**
 * Lernspiel „Satzbau“ (lib/satzbau-saetze.ts, lib/lernspiele-karten.ts): jeder Satz hat einen festen Anfang und genau
 * eine Reihenfolge der übrigen Teile; die Teile liegen nie schon richtig da. Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup(o: { grade?: number; school_type?: string } = {}) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Mira Test", grade: o.grade ?? 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: o.school_type ?? "AHS", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, repo, sp, student: repo.getStudent(id)! };
}

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test("Sätze: fester Anfang, drei bis vier Teile, kein Teil doppelt, Satzzeichen am Ende", async () => {
  const { SATZBAU, SATZBAU_MARKE, SATZBAU_REGEL } = await import("./satzbau-saetze");
  const alle = SATZBAU.flatMap((g) => g.saetze);
  assert.ok(alle.length >= 160, `genug Sätze (${alle.length})`);
  assert.equal(new Set(alle).size, alle.length, "kein Satz doppelt");
  for (const g of SATZBAU) {
    assert.ok(SATZBAU_MARKE[g.typ] && SATZBAU_REGEL[g.typ].length > 30, g.typ);
    for (const satz of g.saetze) {
      const teile = satz.split("|").map((t) => t.trim());
      assert.ok(teile.every(Boolean), `${satz}: kein leerer Teil`);
      assert.ok(/[.?!]$/.test(satz), `${satz}: Satzzeichen am Ende`);
      assert.ok(/^[A-ZÄÖÜ]/.test(teile[0]), `${satz}: der Anfang ist groß geschrieben`);
      const frei = teile.slice(1);
      assert.ok(frei.length >= 3 && frei.length <= 4, `${satz}: drei oder vier Teile zum Ordnen`);
      assert.equal(new Set(frei.map((t) => t.replace(/[.?!]$/, "").toLowerCase())).size, frei.length, `${satz}: kein Teil doppelt`);
      assert.ok(!/[.?!,]$/.test(frei.slice(0, -1).join(" ")), `${satz}: Satzzeichen nur am letzten Teil`);
      // Stufe 1 hat immer drei Teile, damit die Kleinen nicht raten müssen
      if (g.stufe === 1) assert.equal(frei.length, 3, satz);
      // Fragen enden mit Fragezeichen, alles andere mit Punkt
      assert.equal(satz.endsWith("?"), g.typ === "frage", satz);
      // der Gliedsatz beginnt nach dem Komma mit der Konjunktion; steht er vorne, endet der feste Teil mit dem Komma
      if (g.typ === "gliedsatz" || g.typ === "gliedsatz-klammer") assert.ok(/, (weil|dass|wenn|ob|bis|obwohl)$/.test(teile[0]), satz);
      if (g.typ === "gliedsatz-vorn") assert.ok(teile[0].endsWith(","), satz);
    }
  }
  for (const stufe of [1, 2, 3]) assert.ok(SATZBAU.filter((g) => g.stufe === stufe).flatMap((g) => g.saetze).length >= 30, `Stufe ${stufe}: genug für mehrere Runden`);
});

test("Karten: Teile gemischt und nie schon richtig, die Lösung ist der ganze Satz", async () => {
  const k = await import("./lernspiele-karten");
  const { REIHE_TRENNER } = await import("./lernspiele-typen");
  const alle = k.kandidaten("satzbau");
  assert.equal(new Set(alle.map((c) => c.karte.key)).size, alle.length);
  for (const { karte } of alle) {
    assert.equal(karte.form, "reihe");
    const richtig = karte.richtig.split(REIHE_TRENNER);
    assert.deepEqual([...karte.faecher].sort(), [...richtig].sort(), `${karte.key}: dieselben Teile`);
    assert.notDeepEqual(karte.faecher, richtig, `${karte.key}: liegt nicht schon richtig da`);
    assert.equal(karte.loesung, `${karte.vor} ${richtig.join(" ")}${karte.nach}`);
    assert.ok(karte.regel.length > 30 && karte.marke);
  }
  const karte = k.satzbauKarte("Heute | gehen | wir | ins Kino.", { typ: "verbzweit" }, 1);
  assert.equal(karte.vor, "Heute");
  assert.equal(karte.nach, ".");
  assert.equal(karte.richtig, "gehen | wir | ins Kino");
  assert.equal(karte.loesung, "Heute gehen wir ins Kino.");
  // dieselbe Karte liegt immer gleich da (beide Spieler eines Duells sehen dasselbe)
  assert.deepEqual(k.satzbauKarte("Heute | gehen | wir | ins Kino.", { typ: "verbzweit" }, 1).faecher, karte.faecher);
});

test("Runde: Stufen nach Schulstufe, zählt den ersten gebauten Satz, Volksschule hat ihre eigene Fähigkeit", async () => {
  const { sp, student, db } = await setup();
  const k = await import("./lernspiele-karten");
  assert.deepEqual(k.stufenFuer("satzbau", 3, null), [1]);
  assert.deepEqual(k.stufenFuer("satzbau", 4, 0.8), [1, 2]);
  assert.deepEqual(k.stufenFuer("satzbau", 7, null), [1, 2, 3]);
  assert.deepEqual(k.stufenFuer("satzbau", 7, 0.3), [1, 2]);
  assert.deepEqual(k.stufenFuer("satzbau", 7, 0.9), [2, 3]);

  const { rundeId, karten } = sp.starteRunde(student, "satzbau", { rng: rng(3) });
  assert.equal(karten.length, 12);
  // zehn richtig, zwei in falscher Reihenfolge
  const e = sp.beendeRunde(student.id, rundeId, karten.map((c, i) => ({ key: c.key, wahl: i < 10 ? c.richtig : c.faecher.join(" | ") })))!;
  assert.equal(e.richtig, 10);
  assert.equal(e.nochmal.length, 2);
  assert.equal((db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(rundeId) as { skill_id: string }).skill_id, "deutsch.satz.satzglieder");
  assert.equal(sp.skillFuerSpiel(student, "satzbau", "2026-11-11"), "deutsch.satz.satzglieder");

  const klein = await setup({ grade: 3, school_type: "Volksschule" });
  const runde = klein.sp.starteRunde(klein.student, "satzbau", { rng: rng(4) });
  assert.equal(runde.karten.length, 12);
  assert.ok(runde.karten.every((c) => c.faecher.length === 3), "3. Klasse: nur Sätze mit drei Teilen");
  assert.equal((klein.db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(runde.rundeId) as { skill_id: string }).skill_id, "deutsch.vs.sprache.satzglieder");
});
