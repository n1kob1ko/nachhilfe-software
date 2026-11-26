import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/** niko 2026-11-26: Monatsbericht für Eltern (Punkt 8) und Notenverlauf (Punkt 9). */
test("Notenverlauf: Noten nach Datum, Schnitt vor und seit der Nachhilfe je Fach", async () => {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { notenverlauf, nachhilfeBeginn } = await import("./notenverlauf");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const id = repo.createStudent({
    name: "Nora Note", grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  assert.equal(notenverlauf(id).punkte.length, 0);
  const t = (date: string, subject: string, grade: number | null, status?: "geplant" | "geschrieben" | "abgesagt") =>
    repo.addTest({ student_id: id, date, subject, kind: "Schularbeit", topic: "", grade, points: null, max_points: null, notes: "", skill_ids: [], status });
  t("2026-03-10", "Mathematik", 5);
  t("2026-06-10", "Mathematik", 4);
  t("2026-10-20", "Mathematik", 3);
  t("2026-11-20", "Mathematik", 2);
  t("2026-11-21", "Deutsch", 2);
  t("2026-12-15", "Mathematik", null, "geplant");
  t("2026-11-22", "Mathematik", 1, "abgesagt");
  db().prepare("INSERT INTO lessons (student_id, starts_at, duration_min, subject, status) VALUES (?, '2026-09-15T15:00', 100, 'Mathematik', 'abgeschlossen')").run(id);
  assert.equal(nachhilfeBeginn(id), "2026-09-15");
  const v = notenverlauf(id);
  assert.deepEqual(v.punkte.map((p) => p.note), [5, 4, 3, 2, 2]);
  const m = v.faecher.find((f) => f.fach === "Mathematik")!;
  assert.equal(m.vorher, 4.5);
  assert.equal(m.seither, 2.5);
  assert.equal(notenverlauf(id, "2026-10-31").punkte.length, 3);
});

test("Monatsbericht: Einheiten, Tests und Zu Hause des Monats", async () => {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { monatsbericht, monatVerschieben, monatName, istMonat } = await import("./monatsbericht");
  assert.equal(monatVerschieben("2026-01", -1), "2025-12");
  assert.equal(monatVerschieben("2026-12", 1), "2027-01");
  assert.equal(monatName("2026-01"), "Jänner 2026");
  assert.equal(istMonat("2026-13"), false);
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const id = repo.createStudent({
    name: "Max Monat", grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const ins = db().prepare("INSERT INTO lessons (student_id, starts_at, duration_min, subject, topic, status, kind) VALUES (?, ?, 100, 'Mathematik', ?, ?, 'stunde')");
  ins.run(id, "2026-11-03T15:00", "Brüche", "abgeschlossen");
  ins.run(id, "2026-11-17T15:00", "Gleichungen", "abgeschlossen");
  ins.run(id, "2026-10-20T15:00", "Oktober", "abgeschlossen");
  ins.run(id, "2026-11-24T15:00", "abgesagt", "abgesagt");
  repo.addTest({ student_id: id, date: "2026-11-20", subject: "Mathematik", kind: "Schularbeit", topic: "", title: "2. Schularbeit", grade: 2, points: null, max_points: null, notes: "", skill_ids: [], status: "geschrieben" });
  repo.addTest({ student_id: id, date: "2026-12-10", subject: "Mathematik", kind: "Test", topic: "Prozent", grade: null, points: null, max_points: null, notes: "", skill_ids: [], status: "geplant" });
  db().prepare("INSERT INTO spielrunden (student_id, art, skill_id, anzahl, richtig, created_at, beendet_at) VALUES (?, 'rechnen', 'x', 10, 8, '2026-11-10 16:00:00', '2026-11-10 16:06:00')").run(id);
  const b = monatsbericht(id, "2026-11");
  assert.equal(b.monatName, "November 2026");
  assert.deepEqual(b.einheiten.map((e) => e.thema), ["Brüche", "Gleichungen"]);
  assert.equal(b.minuten, 200);
  assert.deepEqual(b.tests.map((t) => [t.titel, t.note, t.geplant]), [["2. Schularbeit", 2, false], ["Prozent", null, true]]);
  assert.equal(b.zuHause.tage, 1);
  assert.equal(b.zuHause.minuten, 6);
  assert.equal(b.noten.punkte.length, 1);
});
