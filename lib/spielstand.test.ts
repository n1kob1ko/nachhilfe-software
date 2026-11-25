/**
 * Spielstand (lib/spielstand.ts, niko 2026-11-25: „es soll den Stand halten“): merken, neuer schlägt älter, nur eigene
 * offene Runden, die Kopie vom Gerät gewinnt, wenn sie neuer ist, und gemerkte Runden räumen sich nicht weg.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const st = await import("./spielstand");
  const teacher = repo.listTeachers()[0];
  const neu = (name: string) => {
    const id = repo.createStudent({ name, grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
    return repo.getStudent(id)!;
  };
  return { db, sp, st, a: neu("Mira Test"), b: neu("Ben Test") };
}

test("Spielstand: merken und holen, neuer schlägt älter, nur eigene offene Runden", async () => {
  const { sp, st, a, b } = await setup();
  const r = sp.starteRunde(a, "artikel");
  assert.equal(st.holeSpielstand(a.id, "lernspiel:artikel"), null);
  assert.equal(st.merkeSpielstand(a.id, "lernspiel:artikel", { pos: 3 }, [r.rundeId], 2000), true);
  assert.deepEqual(st.holeSpielstand(a.id, "lernspiel:artikel"), { stand: { pos: 3 }, at: 2000 });
  // ein älterer Stand (z. B. eine verspätete Anfrage) überschreibt nicht
  assert.equal(st.merkeSpielstand(a.id, "lernspiel:artikel", { pos: 1 }, [r.rundeId], 1000), false);
  assert.equal((st.holeSpielstand(a.id, "lernspiel:artikel")!.stand as { pos: number }).pos, 3);
  // fremde Runde (anderer Schüler am selben Tablet), Unsinn, falscher Name: nein
  assert.equal(st.merkeSpielstand(b.id, "lernspiel:artikel", { pos: 5 }, [r.rundeId], 3000), false);
  assert.equal(st.merkeSpielstand(a.id, "lernspiel:artikel", { pos: 5 }, [], 3000), false);
  assert.equal(st.merkeSpielstand(a.id, "x y", { pos: 5 }, [r.rundeId], 3000), false);
  assert.equal(st.merkeSpielstand(a.id, "lernspiel:artikel", "x".repeat(st.STAND_MAX_ZEICHEN), [r.rundeId], 3000), false);
  assert.equal(st.holeSpielstand(b.id, "lernspiel:artikel"), null);
  // die Kopie vom Gerät ist neuer: sie gilt und wird gemerkt; eine ältere nicht
  assert.equal((st.besterSpielstand(a.id, "lernspiel:artikel", { stand: { pos: 7 }, runden: [r.rundeId], at: 4000 })!.stand as { pos: number }).pos, 7);
  assert.equal((st.besterSpielstand(a.id, "lernspiel:artikel", { stand: { pos: 2 }, runden: [r.rundeId], at: 1500 })!.stand as { pos: number }).pos, 7);
  // die Kopie eines anderen Schülers zählt nicht
  assert.equal(st.besterSpielstand(b.id, "lernspiel:artikel", { stand: { pos: 9 }, runden: [r.rundeId], at: 9000 }), null);
  // Runde beendet: der Stand ist weg
  sp.beendeRunde(a.id, r.rundeId, r.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  assert.equal(st.holeSpielstand(a.id, "lernspiel:artikel"), null);
  assert.equal(st.merkeSpielstand(a.id, "lernspiel:artikel", { pos: 3 }, [r.rundeId], 9000), false);
});

test("Spielstand: gemerkte Runden bleiben über Nacht, andere offene räumen sich weg; vergessen löscht", async () => {
  const { db, sp, st, a } = await setup();
  const gemerkt = sp.starteRunde(a, "artikel");
  const offen = sp.starteRunde(a, "praepositionen");
  assert.ok(st.merkeSpielstand(a.id, "lernspiel:artikel", { pos: 1 }, [gemerkt.rundeId], 1000));
  db().prepare("UPDATE spielrunden SET created_at = datetime('now', '-3 day') WHERE id IN (?, ?)").run(gemerkt.rundeId, offen.rundeId);
  sp.starteRunde(a, "artikel");
  const da = (id: number) => !!db().prepare("SELECT 1 FROM spielrunden WHERE id = ?").get(id);
  assert.equal(da(gemerkt.rundeId), true, "mit Stand: bleibt");
  assert.equal(da(offen.rundeId), false, "ohne Stand: weg");
  assert.notEqual(st.holeSpielstand(a.id, "lernspiel:artikel"), null);
  st.vergissSpielstand(a.id, "lernspiel:artikel");
  assert.equal(st.holeSpielstand(a.id, "lernspiel:artikel"), null);
});
