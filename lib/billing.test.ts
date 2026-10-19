import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup() {
  const repo = await import("./repo");
  const billing = await import("./billing");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  const newStudent = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const nachtragen = (studentId: number, teacherId: number, startsAt: string, status: "abgeschlossen" | "geplant" = "abgeschlossen") =>
    repo.saveLesson({
      student_id: studentId, teacher_id: teacherId, starts_at: startsAt, duration_min: startsAt.endsWith("T00:00") ? 0 : 60, subject: "Biologie", topic: "Zelle",
      status, activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [],
    });
  return { repo, billing, niko, thomas, newStudent, nachtragen };
}

test("Abrechnung: die neueste Einheit steht oben, auch im CSV", async () => {
  const { billing, niko, newStudent, nachtragen } = await setup();
  const anna = newStudent("Anna Reihenfolge");
  const bert = newStudent("Bert Reihenfolge");
  const alt = nachtragen(anna, niko.id, "2026-10-02T15:00");
  const mitte = nachtragen(bert, niko.id, "2026-10-09T00:00");
  const neu = nachtragen(anna, niko.id, "2026-10-16T14:00");
  const neuSpaeter = nachtragen(bert, niko.id, "2026-10-16T17:30");
  const rows = billing.resolveBilling({ monat: "2026-10" }).rows;
  assert.deepEqual(rows.map((r) => r.id), [neuSpaeter, neu, mitte, alt]);
  const csv = billing.billingCsv(rows).split(/\r?\n/).filter(Boolean);
  assert.match(csv[1], /^16\.10\.2026;Niko;Bert Reihenfolge/);
  assert.match(csv[4], /^02\.10\.2026/);
});

test("Abrechnung: eine nachgetragene Einheit lässt sich ganz löschen, nur vom eigenen Lehrer oder der Verwaltung", async () => {
  const { repo, billing, niko, thomas, newStudent, nachtragen } = await setup();
  const clara = newStudent("Clara Loeschen");
  const vonNiko = nachtragen(clara, niko.id, "2026-10-06T00:00");
  const vonThomas = nachtragen(clara, thomas.id, "2026-10-07T16:00");
  const geplant = nachtragen(clara, niko.id, "2026-10-30T16:00", "geplant");
  const abgerechnet = () => billing.resolveBilling({ monat: "2026-10", schueler: String(clara) }).rows.map((r) => r.id);
  assert.deepEqual(abgerechnet(), [vonThomas, vonNiko]);

  assert.deepEqual(billing.deleteBillingEntry(vonNiko, { id: thomas.id, is_admin: 0 }), { ok: false, error: "fremd" }, "Thomas darf Nikos Einheit nicht löschen");
  assert.deepEqual(billing.deleteBillingEntry(geplant, { id: niko.id, is_admin: 1 }), { ok: false, error: "weg" }, "eine nur geplante Einheit steht nicht in der Abrechnung");
  assert.deepEqual(abgerechnet(), [vonThomas, vonNiko], "nichts gelöscht");

  assert.deepEqual(billing.deleteBillingEntry(vonThomas, { id: thomas.id, is_admin: 0 }), { ok: true }, "die eigene Einheit");
  assert.deepEqual(billing.deleteBillingEntry(vonNiko, { id: niko.id, is_admin: 1 }), { ok: true });
  assert.deepEqual(abgerechnet(), []);
  assert.deepEqual(repo.listLessons(clara).map((l) => l.id), [geplant], "auch aus dem Lernverlauf weg, die geplante bleibt");
  assert.deepEqual(billing.deleteBillingEntry(vonNiko, { id: niko.id, is_admin: 1 }), { ok: false, error: "weg" }, "zweimal löschen geht ins Leere");
});

test("Abrechnung: eine Einheit aus der App wird mit Dokumentation gelöscht, gelöste Aufgaben bleiben im Lernstand", async () => {
  const { repo, billing, niko, thomas, newStudent } = await setup();
  const { buildWorksheet, submitAnswer } = await import("./service");
  const units = await import("./units");
  const learning = await import("./learning");
  const sid = newStudent("Dora Einheit");
  const student = repo.getStudent(sid)!;
  const { unit } = units.startUnit(niko.id, sid, { at: Date.now() - 40 * 60_000, subject: "Mathematik" });
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count: 2, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(wid, sid);
  for (const t of repo.listTasks(wid)) await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: t.answer.accepted?.[0] ?? "", timeMs: 15_000, hintsUsed: 0 });
  const lessonId = learning.endUnit(unit.id, { byTeacherId: niko.id })!;
  assert.ok(repo.getLesson(lessonId));

  assert.deepEqual(billing.deleteBillingEntry(lessonId, { id: thomas.id, is_admin: 0 }), { ok: false, error: "fremd" });
  assert.deepEqual(billing.deleteBillingEntry(lessonId, { id: niko.id, is_admin: 0 }), { ok: true });
  assert.equal(repo.getLesson(lessonId), null, "die Dokumentation ist weg");
  assert.equal(units.getUnit(unit.id), null, "die Einheit ist weg, auch aus Lernverlauf und Einheiten");
  assert.equal(units.listUnits({ studentId: sid }).length, 0);
  const attempts = repo.listAttemptsForAssignment(aid);
  assert.equal(attempts.length, 2, "die gelösten Aufgaben bleiben");
  assert.ok(attempts.every((a) => a.unit_id === null));
  assert.equal(repo.billingEntries({ from: "0000", to: "9999" }).filter((r) => r.student_id === sid).length, 0);
});

test("Abrechnung: eine laufende Einheit wird nicht gelöscht", async () => {
  const { repo, billing, niko, newStudent } = await setup();
  const { db } = await import("./db");
  const units = await import("./units");
  const sid = newStudent("Emil Laeuft");
  const { unit } = units.startUnit(niko.id, sid);
  // eine abgeschlossene Zeile an einer laufenden Einheit entsteht normal nicht, hier von Hand
  const lessonId = repo.saveLesson({
    student_id: sid, teacher_id: niko.id, starts_at: "2026-10-19T09:00", duration_min: 60, subject: "Mathematik", topic: "",
    status: "abgeschlossen", activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [],
  });
  db().prepare("UPDATE lessons SET unit_id = ? WHERE id = ?").run(unit.id, lessonId);
  assert.deepEqual(billing.deleteBillingEntry(lessonId, { id: niko.id, is_admin: 1 }), { ok: false, error: "laeuft" });
  assert.ok(repo.getLesson(lessonId));
  assert.equal(units.getUnit(unit.id)?.status, "gestartet");
});
