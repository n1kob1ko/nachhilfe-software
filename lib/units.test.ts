import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("a unit writes the Basis-Dokumentation at once and the Lern-Dokumentation at its end", async () => {
  const repo = await import("./repo");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const units = await import("./units");
  const learning = await import("./learning");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");

  const niko = auth.checkLogin("niko", INITIAL_PASSWORD);
  assert.ok(niko, "seeded teachers can log in with the initial password");
  assert.equal(niko.must_change_password, 1);
  assert.equal(auth.checkLogin("niko", "falsch"), null);

  const sid = repo.createStudent({
    name: "Max Test", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const t0 = Date.now() - 50 * 60_000;
  const unit = units.startUnit(niko.id, sid, t0);
  assert.equal(unit.status, "gestartet");
  assert.equal(unit.teacher_name, "Niko");
  assert.equal(units.startUnit(niko.id, sid).id, unit.id, "starting twice returns the running unit");

  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.dividieren", "mathe.brueche.multiplizieren"], difficulty: "leicht", count: 6, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(wid, sid);
  const tasks = repo.listTasks(wid);
  for (const [i, t] of tasks.entries()) {
    const right = t.answer.accepted?.[0] ?? "";
    if (i === 0) await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: t.errorMap[0]?.answer ?? "0", timeMs: 40_000, activeMs: 30_000, hintsUsed: 0 });
    if (i === 1) {
      await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: "", timeMs: 90_000, activeMs: 20_000, hintsUsed: 2, giveUp: true });
      continue;
    }
    await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: right, timeMs: 20_000, activeMs: 18_000, hintsUsed: i === 2 ? 1 : 0 });
  }
  assert.equal(repo.listAttemptsForUnit(unit.id).length, tasks.length + 1, "every attempt belongs to the unit");
  assert.equal(repo.getLessonForAssignment(aid), null, "practice inside a unit gets no separate self-study entry");

  const lessonId = learning.endUnit(unit.id)!;
  const ended = units.getUnit(unit.id)!;
  assert.equal(ended.status, "beendet");
  assert.ok(ended.ended_at);
  const lesson = repo.getLesson(lessonId)!;
  assert.equal(lesson.unit_id, unit.id);
  assert.equal(lesson.teacher_id, niko.id);
  assert.equal(lesson.reviewed_at, null, "waiting for the teacher");
  const r = learning.readReport(lesson)!;
  assert.equal(r.tasksDone, 6);
  assert.equal(r.correct, 5);
  assert.equal(r.help.loesung, 1);
  assert.equal(r.help.hinweis, 1);
  assert.equal(r.correction.selbst, 1, "first task was wrong, then corrected without help");
  assert.ok(r.activeMs < r.tasks.reduce((s, t) => s + t.timeMs, 0));
  assert.match(lesson.summary, /Max arbeitete in dieser Einheit an Bruchrechnung/);
  assert.match(lesson.summary, /Von 6 Aufgaben wurden 5 richtig gelöst/);

  const history = learning.skillHistory(sid);
  const div = history.find((h) => h.skillId === "mathe.brueche.dividieren");
  assert.ok(div && div.points.length === 1 && div.points[0].practiced);

  const month = lesson.starts_at.slice(0, 7);
  const billed = repo.billingEntries({ from: `${month}-01T00:00`, to: "9999-12-31T00:00" });
  assert.equal(billed.length, 1);

  // a forgotten unit is ended automatically and still documented
  const u2 = units.startUnit(niko.id, sid, Date.now() - 5 * 3600_000);
  learning.sweepIdleUnits();
  const swept = units.getUnit(u2.id)!;
  assert.equal(swept.status, "beendet");
  assert.match(swept.end_reason, /automatisch/);
  assert.ok(repo.getLessonForUnit(u2.id));

  // a cancelled unit stays in the protocol but is not billed
  const u3 = units.startUnit(niko.id, sid);
  units.finishUnit(u3.id, "abgebrochen", "Schüler nicht erschienen");
  assert.equal(repo.getLessonForUnit(u3.id), null);
  assert.equal(units.listUnits({ studentId: sid }).length, 3);
});
