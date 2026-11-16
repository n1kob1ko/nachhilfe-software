import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("ganzes Blatt: Stoff-vorbereiten-Blätter und settings.blatt, die Wahl der Lehrkraft gewinnt", async () => {
  const { alsBlatt, mitBlatt } = await import("./blatt");
  assert.equal(alsBlatt(null), false);
  assert.equal(alsBlatt(""), false);
  assert.equal(alsBlatt("kaputt{"), false);
  assert.equal(alsBlatt(JSON.stringify({ useAI: true })), false);
  assert.equal(alsBlatt(JSON.stringify({ stoffpaket: { id: 3, rolle: "uebung" } })), true);
  assert.equal(alsBlatt(JSON.stringify({ blatt: true })), true);
  assert.equal(alsBlatt(JSON.stringify({ stoffpaket: { id: 3, rolle: "test" }, blatt: false })), false);

  const vorher = JSON.stringify({ stoffpaket: { id: 3, rolle: "test" }, useAI: true });
  const aus = mitBlatt(vorher, false);
  assert.equal(alsBlatt(aus), false);
  assert.deepEqual(JSON.parse(aus), { stoffpaket: { id: 3, rolle: "test" }, useAI: true, blatt: false });
  // die Rolle bleibt lesbar, damit ein Test weiter im Testmodus gesendet wird (lib/repo.ts assignWorksheet)
  assert.match(aus, /"rolle":"test"/);
  assert.equal(alsBlatt(mitBlatt(null, true)), true);
  assert.equal(alsBlatt(mitBlatt("[1,2]", true)), true);
});

test("hängt fest: lange an einer Aufgabe oder zweimal falsch, nie bei einer abgeschlossenen", async () => {
  const { haengtFest, HAENGT_MINUTEN } = await import("./blatt");
  const jetzt = Date.parse("2026-11-16T10:00:00Z");
  const vor = (min: number) => new Date(jetzt - min * 60_000).toISOString();
  const basis = { state: "arbeitet", since: vor(1), test: false, tries: 0, last: null };

  assert.equal(haengtFest(basis, jetzt), null);
  assert.equal(haengtFest({ ...basis, since: vor(HAENGT_MINUTEN.uebung) }, jetzt), `seit ${HAENGT_MINUTEN.uebung} Minuten an derselben Aufgabe`);
  assert.equal(haengtFest({ ...basis, tries: 1, last: { correct: false, final: false } }, jetzt), null);
  assert.equal(haengtFest({ ...basis, tries: 2, last: { correct: false, final: false } }, jetzt), "2 Versuche falsch");
  // fertig, wartet auf die Lehrkraft, nicht am Arbeiten, keine Meldung vom Gerät
  assert.equal(haengtFest({ ...basis, since: vor(30), tries: 3, last: { correct: false, final: true } }, jetzt), null);
  assert.equal(haengtFest({ ...basis, since: vor(30), tries: 1, last: { correct: false, final: false, pending: true } }, jetzt), null);
  assert.equal(haengtFest({ ...basis, since: vor(30), state: "fertig" }, jetzt), null);
  assert.equal(haengtFest({ ...basis, since: null }, jetzt), null);
  // im Test zählt nur die Zeit, und erst später
  assert.equal(haengtFest({ ...basis, test: true, since: vor(HAENGT_MINUTEN.uebung) }, jetzt), null);
  assert.equal(haengtFest({ ...basis, test: true, since: vor(HAENGT_MINUTEN.test) }, jetzt), `seit ${HAENGT_MINUTEN.test} Minuten an derselben Aufgabe`);
});

test("Blatt abgeben im Test: eine leere Aufgabe zählt als nicht bearbeitet und schließt das Blatt ab; in der Übung gilt leer nicht", async () => {
  const repo = await import("./repo");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Lena Blatt", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count: 3, taskType: "calc", useAI: false });
  const tasks = repo.listTasks(wid);
  assert.equal(tasks.length, 3);
  const senden = (aid: number, t: (typeof tasks)[number], answer: string, leer = false) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer, timeMs: 20_000, activeMs: 15_000, hintsUsed: 0, leer, submissionId: `blatt-${aid}-${t.id}-${leer ? "l" : "a"}-xxxxxxxx` });

  // Test: zwei beantwortet, eine leer
  const aid = repo.assignWorksheet(wid, sid, "", null, "test");
  await senden(aid, tasks[0], tasks[0].answer.accepted?.[0] ?? "");
  await senden(aid, tasks[1], "999");
  const leer = await senden(aid, tasks[2], "", true);
  assert.equal(leer.final, true);
  assert.equal(leer.correct, false);
  const versuche = repo.listAttemptsForAssignment(aid);
  const l = versuche.find((a) => a.task_id === tasks[2].id)!;
  assert.equal(l.final, 1);
  assert.equal(l.correct, 0);
  assert.equal(l.solution_viewed, 0, "nicht als „Lösung angesehen“");
  assert.equal(l.review, null, "nicht für die Lehrkraft zum Bewerten");
  assert.equal(l.error_label, "nicht bearbeitet");
  assert.equal(l.feedback, "Nicht bearbeitet.");
  assert.equal(l.time_ms, 20_000);
  assert.ok(repo.getAssignment(aid)!.completed_at, "das Blatt ist abgeschlossen");

  // Übung: leer wird ignoriert, die Antwort wird normal geprüft (ein Versuch von dreien, nicht abgeschlossen)
  const uid = repo.assignWorksheet(wid, sid, "", null, "normal");
  const r = await senden(uid, tasks[0], "999", true);
  assert.equal(r.final, false);
  const u = repo.listAttemptsForAssignment(uid)[0];
  assert.equal(u.answer, "999");
  assert.notEqual(u.error_label, "nicht bearbeitet");
});
