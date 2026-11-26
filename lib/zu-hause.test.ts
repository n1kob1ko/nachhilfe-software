import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const sql = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/** niko 2026-11-26: „Üben zu Hause sichtbar machen“ – was seit der letzten Einheit außerhalb des Unterrichts geübt wurde. */
test("zu Hause geübt: zählt Spiele und Vokabeln zwischen den Einheiten, nicht im Unterricht", async () => {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { zuHauseGeuebt, zuHauseSatz } = await import("./zu-hause");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const id = repo.createStudent({
    name: "Lea Haus", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const tag = 86_400_000;
  const t0 = Date.parse("2026-11-16T15:00:00Z");
  // erste Einheit: 16.11., 15:00–16:40
  const u1 = units.startUnit(niko.id, id, { subject: "Deutsch" }).unit;
  db().prepare("UPDATE units SET status = 'beendet', started_at = ?, ended_at = ?, last_activity_at = ? WHERE id = ?").run(new Date(t0).toISOString(), new Date(t0 + 100 * 60_000).toISOString(), new Date(t0 + 100 * 60_000).toISOString(), u1.id);
  const runde = (start: number, min: number, anzahl: number, richtig: number, art = "artikel") =>
    db().prepare("INSERT INTO spielrunden (student_id, art, skill_id, anzahl, richtig, created_at, beendet_at) VALUES (?, ?, 'x', ?, ?, ?, ?)").run(id, art, anzahl, richtig, sql(start), sql(start + min * 60_000));
  runde(t0 + 30 * 60_000, 10, 12, 12); // in der Einheit: zählt nicht
  runde(t0 + 1 * tag, 8, 12, 9); // 17.11.
  runde(t0 + 1 * tag + 3_600_000, 50, 20, 20); // 17.11., lang: höchstens 30 min
  runde(t0 + 3 * tag, 5, 10, 7, "europa"); // 19.11.
  // zweite Einheit am 23.11.
  const beginn2 = new Date(t0 + 7 * tag).toISOString();
  const z = zuHauseGeuebt(id, beginn2)!;
  assert.equal(z.seitEinheit, true);
  assert.equal(z.tage, 2);
  assert.equal(z.minuten, 8 + 30 + 5);
  assert.equal(z.anzahl, 42);
  assert.equal(z.richtig, 36);
  assert.deepEqual(z.was.map((w) => w.titel)[0], "der, die, das");
  assert.match(zuHauseSatz(z), /^Zu Hause seit der letzten Einheit: an 2 Tagen geübt, 43 min, 42 Aufgaben, 86 % richtig \(/);
  // nichts dazwischen
  const leer = zuHauseGeuebt(id, new Date(t0 + 100 * 60_000 + 1000).toISOString())!;
  assert.equal(leer.tage, 0);
  assert.equal(zuHauseSatz(leer), "Zu Hause seit der letzten Einheit: nicht geübt.");
});
