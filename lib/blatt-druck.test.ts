import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("ausgefülltes Blatt: alle Antworten der Zuweisung, Zeit und Hilfen; als Probeschularbeit Punkte je Aufgabe und Note", async () => {
  const repo = await import("./repo");
  const { db } = await import("./db");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const { blattFuerZuweisung, blattTitel } = await import("./blatt-druck");
  const { BLATT_STANDARD, leseMappeOptionen, mappeQuery } = await import("./mappe-druck");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Jonas Druck", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count: 4, taskType: "calc", useAI: false });
  repo.updateWorksheetMeta(wid, { title: "Jonas – Brüche kürzen" });
  const tasks = repo.listTasks(wid);
  let n = 0;
  const senden = (aid: number, i: number, answer: string, o: { leer?: boolean; timeMs?: number } = {}) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId: tasks[i].id, answer, timeMs: o.timeMs ?? 120_000, activeMs: 60_000, hintsUsed: 0, leer: o.leer, submissionId: `druck-${aid}-${i}-${n++}-xxxxxxxxxx` });
  const richtig = (i: number) => tasks[i].answer.accepted?.[0] ?? "";

  // Übung: 1 richtig, 2 falsch-dann-richtig, 3 einmal falsch (noch offen), 4 nicht begonnen; eine Hilfe
  const aid = repo.assignWorksheet(wid, sid);
  await senden(aid, 0, richtig(0));
  await senden(aid, 1, "999");
  await senden(aid, 1, richtig(1));
  await senden(aid, 2, "998");
  repo.recordHintUse({ assignment_id: aid, task_id: tasks[2].id, student_id: sid, hint_index: 0, unit_id: null });
  repo.recordHintUse({ assignment_id: aid, task_id: tasks[2].id, student_id: sid, hint_index: 0, unit_id: null });
  const b = blattFuerZuweisung(aid)!;
  assert.equal(blattTitel(b), "Brüche kürzen", "ohne den Vornamen vorne, der steht im Namensfeld");
  assert.deepEqual(b.uebung.aufgaben.map((a) => a.bewertung), ["richtig", "richtig", "falsch", "nicht"]);
  assert.equal(b.uebung.aufgaben[1].versuch, 2);
  assert.equal(b.uebung.richtig, 2);
  assert.equal(b.uebung.bearbeitet, 3);
  assert.equal(b.minuten, 8, "4 Versuche zu je 2 Minuten");
  assert.equal(b.aktivMinuten, 4);
  assert.equal(b.hilfen, 1, "dieselbe Hilfe zählt einmal");
  assert.equal(b.probe, null);
  assert.equal(blattFuerZuweisung(999_999), null);

  // Druck: alle Aufgaben und das Datum sind beim Blatt der Standard, und abwählen bleibt abgewählt
  const o = leseMappeOptionen({}, blattTitel(b), BLATT_STANDARD);
  assert.equal(o.open, true);
  assert.equal(o.date, true);
  const q = mappeQuery({ ...o, open: false }, blattTitel(b), BLATT_STANDARD);
  assert.equal(q, "offen=0");
  assert.equal(leseMappeOptionen(Object.fromEntries(new URLSearchParams(q)), blattTitel(b), BLATT_STANDARD).open, false);

  // Probeschularbeit: Test mit Punkten, eine Aufgabe leer abgegeben
  const testId = repo.addTest({ student_id: sid, date: "2026-12-03", subject: "Mathematik", kind: "Schularbeit", topic: "", title: "1. SA", topics: ["Brüche"], grade: null, points: null, max_points: null, notes: "", skill_ids: [], teacher_id: teacher.id } as never);
  db().prepare("UPDATE worksheets SET probe_test_id = ? WHERE id = ?").run(testId, wid);
  const { setzePunkte } = await import("./probeschularbeit");
  tasks.forEach((t, i) => setzePunkte(t.id, i + 1)); // 1 + 2 + 3 + 4 = 10 Punkte
  const pid = repo.assignWorksheet(wid, sid);
  assert.equal(repo.getAssignment(pid)!.mode, "test");
  await senden(pid, 0, richtig(0));
  await senden(pid, 1, "999");
  await senden(pid, 2, richtig(2));
  await senden(pid, 3, "", { leer: true });
  const p = blattFuerZuweisung(pid)!;
  assert.deepEqual(p.uebung.aufgaben.map((a) => a.bewertung), ["richtig", "falsch", "richtig", "falsch"]);
  assert.equal(p.uebung.aufgaben[3].leer, true, "leer abgegeben steht als nicht bearbeitet da");
  assert.equal(p.uebung.aufgaben[3].antwort, null);
  assert.equal(p.uebung.aufgaben[1].leer, undefined);
  assert.ok(p.probe);
  assert.deepEqual([...p.probe.jeAufgabe.values()], [
    { erreicht: 1, max: 1 },
    { erreicht: 0, max: 2 },
    { erreicht: 3, max: 3 },
    { erreicht: 0, max: 4 },
  ]);
  assert.equal(p.probe.ergebnis.erreicht, 4);
  assert.equal(p.probe.ergebnis.gesamt, 10);
  assert.ok(p.probe.ergebnis.note, "alles bearbeitet: es gibt eine Note");
  assert.equal(p.probe.ergebnis.note!.note, 5);
  assert.ok(p.assignment.completed_at);
  assert.equal(p.datum, p.assignment.completed_at);
});
