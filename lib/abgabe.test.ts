import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup(name: string, count = 2) {
  const repo = await import("./repo");
  const { db } = await import("./db");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name, grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(wid, sid);
  const tasks = repo.listTasks(wid);
  const right = (t: (typeof tasks)[number]) => t.answer.accepted?.[0] ?? "";
  const answer = (taskId: number, text: string, submissionId?: string, extra: { giveUp?: boolean } = {}) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId, answer: text, timeMs: 20_000, hintsUsed: 0, submissionId, ...extra });
  const attempts = (taskId?: number) => repo.listAttemptsForAssignment(aid).filter((a) => taskId === undefined || a.task_id === taskId);
  return { repo, db, niko, sid, student, aid, tasks, right, answer, attempts, submitAnswer };
}

const id = (n: number) => `abgabe-${String(n).padStart(12, "0")}`;

test("the same submission sent twice (connection broke after the click) is stored and graded once", async () => {
  const { repo, aid, tasks, right, answer, attempts } = await setup("Doppelt Senden");
  const t = tasks[0];
  const first = await answer(t.id, right(t), id(1));
  const docBefore = repo.getLessonForAssignment(aid)!;
  const again = await answer(t.id, right(t), id(1));
  assert.deepEqual(again, first, "the repeat gets the very same result");
  assert.equal(attempts(t.id).length, 1, "one answer, not two");
  assert.equal(attempts(t.id)[0].submission_id, id(1));
  assert.equal(first.attemptNo, 1);

  // documentation and Lernstand only know one answer
  const doc = repo.getLessonForAssignment(aid)!;
  assert.equal(doc.id, docBefore.id);
  assert.equal(doc.summary, docBefore.summary);
  assert.equal(repo.listAttemptsForStudent(attempts()[0].student_id).length, 1);
});

test("a repeat that arrives while the first request is still being handled is not stored twice", async () => {
  const { tasks, answer, attempts } = await setup("Gleichzeitig");
  const t = tasks[0];
  const results = await Promise.all([answer(t.id, "7/9", id(2)), answer(t.id, "7/9", id(2)), answer(t.id, "7/9", id(2))]);
  assert.equal(attempts(t.id).length, 1);
  assert.ok(results.every((r) => r.attemptNo === 1 && r.correct === false));
});

test("a new click is a new attempt; repeating the old one later does not count again", async () => {
  const { tasks, right, answer, attempts } = await setup("Neuer Versuch");
  const t = tasks[0];
  const wrong = await answer(t.id, "7/9", id(3));
  assert.equal(wrong.correct, false);
  assert.match(wrong.feedback, /noch 2 Versuche/);
  assert.equal((await answer(t.id, "7/9", id(3))).attemptNo, 1, "the repeat is still attempt 1");
  const second = await answer(t.id, right(t), id(4));
  assert.equal(second.attemptNo, 2, "a deliberate new attempt counts");
  assert.equal(second.correct, true);
  // a late repeat of the first attempt: its own result, nothing new stored
  const late = await answer(t.id, "7/9", id(3));
  assert.equal(late.attemptNo, 1);
  assert.equal(late.correct, false);
  assert.deepEqual(attempts(t.id).map((a) => [a.attempt_no, a.correct, a.final]), [[1, 0, 0], [2, 1, 1]]);
  // a third, different submission after the task is done is refused as before
  const after = await answer(t.id, right(t), id(5));
  assert.match(after.feedback, /schon abgeschlossen/);
  assert.equal(attempts(t.id).length, 2);
});

test("giving up twice in a row (repeat) stores one solution view", async () => {
  const { tasks, answer, attempts } = await setup("Aufgeben");
  const t = tasks[1];
  const a = await answer(t.id, "", id(6), { giveUp: true });
  const b = await answer(t.id, "", id(6), { giveUp: true });
  assert.deepEqual(b, a);
  assert.equal(attempts(t.id).length, 1);
  assert.equal(attempts(t.id)[0].solution_viewed, 1);
});

test("the database refuses a second answer with the same submission id", async () => {
  const { db, tasks, answer, attempts } = await setup("Datenbank");
  const t = tasks[0];
  await answer(t.id, "7/9", id(7));
  const row = attempts(t.id)[0];
  assert.throws(
    () =>
      db()
        .prepare("INSERT INTO attempts (assignment_id, task_id, student_id, attempt_no, answer, correct, submission_id) VALUES (?, ?, ?, 2, 'x', 0, ?)")
        .run(row.assignment_id, row.task_id, row.student_id, id(7)),
    /UNIQUE/,
  );
  // answers without an id (older devices, the demo) are not affected
  await answer(t.id, "7/9");
  await answer(t.id, "7/9");
  assert.equal(attempts(t.id).length, 3);
});

test("submission ids are checked: no foreign results, no reuse for another task, no odd values", async () => {
  const a = await setup("Anna Id");
  const b = await setup("Ben Id");
  await a.answer(a.tasks[0].id, a.right(a.tasks[0]), id(8));
  // Ben's device happens to send the same id: it is Ben's own new answer, Anna's result stays hers
  const ben = await b.answer(b.tasks[0].id, "7/9", id(8));
  assert.equal(ben.correct, false);
  assert.equal(b.attempts().length, 1);
  assert.equal(a.attempts().length, 1);
  // the same id for another task of the same student is not a repeat
  await assert.rejects(() => a.answer(a.tasks[1].id, "1/2", id(8)), /Abgabe nicht erkannt/);
  await assert.rejects(() => a.answer(a.tasks[1].id, "1/2", "kurz"), /Abgabe nicht erkannt/);
  await assert.rejects(() => a.answer(a.tasks[1].id, "1/2", "x".repeat(65)), /Abgabe nicht erkannt/);
  assert.equal(a.attempts(a.tasks[1].id).length, 0);
});
