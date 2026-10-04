import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("student practice is documented automatically and stays out of billing", async () => {
  const repo = await import("./repo");
  const { buildWorksheet, submitAnswer, analyzeStudent } = await import("./service");
  const { checkAnswer } = await import("./tasks");

  const thomas = repo.listTeachers().find((t) => t.name === "Thomas");
  assert.ok(thomas, "default teachers are created");
  assert.deepEqual(repo.listTeachers().map((t) => t.name), ["Niko", "Thomas"]);

  const sid = repo.createStudent({
    name: "Test Kind", grade: 6, klasse: 2, teacher_id: thomas.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.dividieren"], difficulty: "leicht", count: 3, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(wid, sid);
  const tasks = repo.listTasks(wid);

  // first task: typical error, then right
  const t1 = tasks[0];
  const wrong = t1.errorMap[0]?.answer ?? "0";
  await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t1.id, answer: wrong, timeMs: 30_000, hintsUsed: 1 });
  let doc = repo.getLessonForAssignment(aid);
  assert.ok(doc, "an entry exists after the first answer");
  assert.equal(doc.kind, "selbststaendig");
  assert.equal(doc.teacher_id, thomas.id);
  assert.equal(doc.understanding, null, "no understanding rating before the sheet is finished");

  for (const t of tasks) {
    const right = t.answer.accepted?.[0] ?? "";
    assert.equal(checkAnswer(t, right).correct, true);
    await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: right, timeMs: 20_000, hintsUsed: 0 });
  }
  doc = repo.getLessonForAssignment(aid)!;
  assert.match(doc.activities, /3 von 3 Aufgaben erledigt, 3 richtig \(2 beim ersten Versuch/);
  assert.ok(doc.understanding && doc.understanding >= 4);
  assert.match(doc.tutor_notes, /1 Hilfe genutzt/);
  if (t1.errorMap[0]) assert.match(doc.mistakes, new RegExp(t1.errorMap[0].label));
  assert.equal(repo.listLessons(sid).length, 1, "one entry per assignment, updated in place");

  const month = doc.starts_at.slice(0, 7);
  assert.equal(repo.billingEntries({ from: `${month}-01T00:00`, to: "9999-12-31T00:00" }).length, 0, "practice is not billed");
  repo.saveLesson({ student_id: sid, teacher_id: thomas.id, starts_at: `${month}-02T15:00`, duration_min: 60, subject: "Mathematik", topic: "Brüche", status: "abgeschlossen", activities: "", mistakes: "", understanding: 3, tutor_notes: "Gut mitgearbeitet.", next_steps: "", skill_ids: [] });
  const billed = repo.billingEntries({ from: `${month}-01T00:00`, to: "9999-12-31T00:00", teacherId: thomas.id });
  assert.equal(billed.length, 1);
  assert.equal(billed[0].teacher_name, "Thomas");
  assert.equal(billed[0].tutor_notes, "Gut mitgearbeitet.");

  // the automatic entry must not count the same answers twice
  const a = analyzeStudent(sid)!;
  const skill = a.skills.find((s) => s.skill.id === "mathe.brueche.dividieren")!;
  assert.ok(skill.evidence <= 3, `evidence ${skill.evidence} counts attempts only`);
});
