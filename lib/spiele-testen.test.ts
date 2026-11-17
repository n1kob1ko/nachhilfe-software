/**
 * Spiele testen (lib/spiele-testen.ts): der Test-Schüler einer Lehrkraft steht in keiner Liste, nicht in der
 * Bestenliste der Kinder und zählt beim Löschen des Lehrers nicht als Verlauf. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const st = await import("./spiele-testen");
  const teacher = repo.listTeachers()[0];
  const kind = repo.createStudent({
    name: "Mira Beispiel", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, repo, st, teacher, kind: repo.getStudent(kind)! };
}

/** Eine beendete Blockwerk-Runde mit Punkten, wie sie ein Spiel schreibt. */
function blockwerkRunde(db: () => import("better-sqlite3").Database, studentId: number, punkte: number) {
  const id = Number(
    db()
      .prepare("INSERT INTO spielrunden (student_id, art, skill_id, karten, anzahl, richtig, beendet_at, bloecke) VALUES (?, 'artikel', 'deutsch.grammatik.artikel', '[]', 12, 10, datetime('now'), ?)")
      .run(studentId, punkte).lastInsertRowid,
  );
  db().prepare("UPDATE spielrunden SET endlos = ? WHERE id = ?").run(id, id);
  return id;
}

test("Test-Schüler: eigene Klasse, alle drei Fächer, Liga aus, keine Lehrkraft, in keiner Liste", async () => {
  const { db, repo, st, teacher, kind } = await setup();
  assert.equal(st.testSchuelerVon(teacher.id), null);

  const s = st.testSchuelerEinstellen(teacher, "Mittelschule", 2);
  assert.equal(s.name, `${teacher.name.split(" ")[0]} Test`);
  assert.deepEqual([s.school_type, s.klasse, s.grade], ["Mittelschule", 2, 6]);
  assert.deepEqual(s.subjects, ["Mathematik", "Deutsch", "Englisch"]);
  assert.equal(s.spiele_test, teacher.id);
  assert.equal(s.teacher_id, null);
  assert.ok(st.istTestSchueler(s) && !st.istTestSchueler(kind));
  assert.equal((db().prepare("SELECT wettspiel FROM students WHERE id = ?").get(s.id) as { wettspiel: string }).wettspiel, "nein");

  // derselbe Schüler, neue Klasse, gleicher Link
  const wieder = st.testSchuelerEinstellen(teacher, "Gymnasium", 7);
  assert.equal(wieder.id, s.id);
  assert.equal(wieder.access_token, s.access_token);
  assert.deepEqual([wieder.school_type, wieder.klasse, wieder.grade], ["Gymnasium", 7, 11]);
  // Unsinn wird begrenzt
  assert.deepEqual(st.testStufe("Volksschule", 9), { school_type: "Volksschule", klasse: 4, grade: 4 });
  assert.deepEqual(st.testStufe("gibt es nicht", 0), { school_type: "Gymnasium", klasse: 1, grade: 5 });

  assert.deepEqual(repo.listStudents().map((x) => x.id), [kind.id], "nur echte Schüler in der Liste");
  assert.ok(repo.getStudentByToken(s.access_token), "die Schüler-App öffnet ihn trotzdem");
  const { hasData } = await import("./demo");
  db().prepare("DELETE FROM students WHERE id = ?").run(kind.id);
  assert.equal(hasData(), false, "ein Test-Schüler allein ist keine Schülerdaten");
});

test("Bestenliste: die Kinder sehen den Test-Schüler nie, er sieht sich als „Du“; Spielstand löschen setzt zurück", async () => {
  const { db, st, teacher, kind } = await setup();
  const sp = await import("./lernspiele");
  const s = st.testSchuelerEinstellen(teacher, "Gymnasium", 3);
  blockwerkRunde(db, kind.id, 120);
  blockwerkRunde(db, s.id, 900);

  const fuerKind = sp.punkteBestenliste(kind, "bloecke");
  assert.deepEqual(fuerKind.zeilen.map((z) => z.punkte), [120], "900 Testpunkte stehen nicht in der Liste des Kindes");
  const fuerTest = sp.punkteBestenliste(s, "bloecke");
  assert.equal(fuerTest.ich?.name, "Du");
  assert.equal(fuerTest.ich?.punkte, 900);

  assert.equal(st.testRunden(s.id), 1);
  assert.equal(st.testSpielstandLoeschen(teacher.id), 1);
  assert.equal(st.testRunden(s.id), 0);
  assert.equal(st.testRunden(kind.id), 1, "die Runden des Kindes bleiben");
});

test("Lehrer löschen: der Test-Schüler zählt nicht als Verlauf und nicht als zu übergebender Schüler", async () => {
  const { repo, st } = await setup();
  const konten = await import("./lehrer-konten");
  const neu = repo.listTeachers()[1];
  st.testSchuelerEinstellen(neu, "HTL", 1);
  assert.equal(konten.hatVerlauf(neu.id), false);
});
