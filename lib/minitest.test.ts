import assert from "node:assert/strict";
import test from "node:test";
import type * as repo from "./repo";

process.env.DATABASE_PATH = ":memory:";

test("a Minitest gives one try per task; every other exercise keeps three", async () => {
  const { triesFor, MAX_TRIES } = await import("./service");
  const { isAssignmentMode, isMinitest, showsQuickRound } = await import("./quick-round");
  assert.equal(triesFor("test"), 1);
  assert.equal(triesFor("normal"), MAX_TRIES);
  assert.equal(triesFor(undefined), MAX_TRIES);
  assert.equal(isAssignmentMode("test"), true);
  assert.equal(isMinitest("test"), true);
  assert.equal(isMinitest("schnell"), false);
  assert.equal(showsQuickRound("test", [{ type: "mc", options: ["a", "b"] }]), false, "a Minitest is never a Schnellrunde");
});

test("the tasks of a Minitest go round the skills, weak skills and wrong tasks first", async () => {
  const { vorlagen } = await import("./minitest");
  const t = (id: number, skillId: string | null) => ({ id, skillId }) as repo.Task;
  const stoff = {
    faehigkeiten: [
      { id: "b", name: "B", area: "", anzahl: 2, falsch: 1 },
      { id: "a", name: "A", area: "", anzahl: 3, falsch: 0 },
    ],
    aufgaben: [
      { task: t(4, "b"), fach: "Mathematik", richtig: false },
      { task: t(1, "a"), fach: "Mathematik", richtig: true },
      { task: t(2, "a"), fach: "Mathematik", richtig: true },
      { task: t(3, "a"), fach: "Mathematik", richtig: true },
      { task: t(5, "b"), fach: "Mathematik", richtig: true },
      { task: t(6, null), fach: "Mathematik", richtig: true },
    ],
  };
  assert.deepEqual(vorlagen(stoff, 6).map((v) => v.task.id), [4, 1, 6, 5, 2, 6]);
  assert.deepEqual(vorlagen(stoff, 2).map((v) => v.task.id), [4, 1]);
});

test("Minitest: from the last unit's material, one try, no hints; it shows in the report and the Einschätzung", async () => {
  const repo = await import("./repo");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const units = await import("./units");
  const learning = await import("./learning");
  const { clientTasks } = await import("./solver-tasks");
  const { erstelleMinitest, letzterStoff, minitestDerEinheit } = await import("./minitest");
  const { leseEinschaetzung } = await import("./einschaetzung");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Mia Probe", grade: 5, klasse: 1, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const richtig = (t: repo.Task) => t.answer.accepted?.[0] ?? "";
  const antworte = (aid: number, t: repo.Task, answer: string) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer, timeMs: 30_000, activeMs: 30_000, hintsUsed: 0 });

  // no earlier unit: nothing to test yet
  const ersteEinheit = units.startUnit(teacher.id, sid, { at: Date.now() - 2.5 * 60 * 60_000, subject: "Mathematik" }).unit;
  assert.equal(letzterStoff(sid, ersteEinheit.id), null);
  assert.throws(() => erstelleMinitest({ unitId: ersteEinheit.id, teacherId: teacher.id, ziel: "geraet" }), /keine frühere Einheit/);

  // the earlier unit: Brüche kürzen, one task wrong to the end
  const wid = (await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 1, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count: 4, taskType: "calc", useAI: false })).id;
  const aid = repo.assignWorksheet(wid, sid, "", ersteEinheit.id);
  const [t0, t1, t2, t3] = repo.listTasks(wid);
  await antworte(aid, t0, richtig(t0));
  await antworte(aid, t1, richtig(t1));
  await antworte(aid, t2, richtig(t2));
  for (let i = 0; i < 3; i++) await antworte(aid, t3, "999");
  learning.endUnit(ersteEinheit.id, { byTeacherId: teacher.id });

  const { unit } = units.startUnit(teacher.id, sid, { at: Date.now() - 30 * 60_000, subject: "Mathematik" });
  const stoff = letzterStoff(sid, unit.id)!;
  assert.equal(stoff.unit.id, ersteEinheit.id);
  assert.equal(stoff.fach, "Mathematik");
  assert.equal(stoff.aufgaben[0].task.id, t3.id, "the wrong task first");
  assert.equal(stoff.aufgaben[0].richtig, false);
  assert.deepEqual(stoff.faehigkeiten.map((f) => [f.id, f.anzahl, f.falsch]), [["mathe.brueche.kuerzen", 4, 1]]);

  // printed first: an exercise of the unit without an assignment
  const druck = erstelleMinitest({ unitId: unit.id, teacherId: teacher.id, anzahl: 5, ziel: "druck", seed: 7 });
  assert.equal(druck.assignmentId, null);
  assert.equal(druck.neu, true);
  const w = repo.getWorksheet(druck.worksheetId)!;
  assert.equal(w.kind, "ueberpruefung");
  assert.match(w.title, /^Mia – Minitest: /);
  const aufgaben = repo.listTasks(w.id);
  assert.equal(aufgaben.length, 5);
  const alt = new Set(repo.listTasks(wid).map((t) => t.prompt));
  assert.ok(aufgaben.every((t) => !alt.has(t.prompt)), "new variants, not the tasks from last time");
  assert.ok(aufgaben.every((t) => t.skillId === "mathe.brueche.kuerzen" && t.type !== "free"));
  assert.equal(minitestDerEinheit(unit.id)?.assignment, null);

  // then to the tablet after all: the same exercise, now as a Minitest; no second one
  const geraet = erstelleMinitest({ unitId: unit.id, teacherId: teacher.id, ziel: "geraet" });
  assert.equal(geraet.worksheetId, druck.worksheetId);
  assert.equal(geraet.neu, false);
  const a = repo.getAssignment(geraet.assignmentId!)!;
  assert.equal(a.mode, "test");
  assert.equal(a.unit_id, unit.id);
  assert.equal(erstelleMinitest({ unitId: unit.id, teacherId: teacher.id, ziel: "geraet" }).assignmentId, a.id);

  // the student's view: no hints
  const sicht = clientTasks(a);
  assert.ok(sicht.every((t) => t.hints.length === 0));

  // one try: a wrong answer is final at once
  const [m0, m1, m2] = aufgaben;
  const falsch = await antworte(a.id, m0, "999");
  assert.equal(falsch.final, true);
  assert.equal(falsch.attemptNo, 1);
  await antworte(a.id, m1, richtig(m1));
  await antworte(a.id, m2, richtig(m2));
  const nochmal = await antworte(a.id, m0, richtig(m0));
  assert.match(nochmal.feedback, /schon abgeschlossen/);

  // the unit's own practice after the test
  const uebung = (await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 1, skillIds: ["mathe.brueche.erweitern"], difficulty: "leicht", count: 2, taskType: "calc", useAI: false })).id;
  const uaid = repo.assignWorksheet(uebung, sid, "", unit.id);
  for (const t of repo.listTasks(uebung)) await antworte(uaid, t, richtig(t));
  learning.endUnit(unit.id, { byTeacherId: teacher.id });

  const report = learning.readReport(repo.getLessonForUnit(unit.id)!)!;
  assert.deepEqual(report.minitest, { von: 5, erledigt: 3, richtig: 2, falsch: [report.minitest!.falsch[0]] });
  const e = leseEinschaetzung(repo.getLessonForUnit(unit.id)!)!;
  assert.ok(e.saetze.some((x) => /^Minitest am Anfang: 2 von 5 richtig \(3 abgegeben\), Fehler bei /.test(x)), e.saetze.join(" | "));

  // the next unit: its material is this unit's practice and the test; a Minitest is never material itself
  const naechste = units.startUnit(teacher.id, sid, { at: Date.now() - 5 * 60_000, subject: "Mathematik" }).unit;
  const neu = letzterStoff(sid, naechste.id)!;
  assert.equal(neu.unit.id, unit.id);
  assert.deepEqual(neu.faehigkeiten.map((f) => f.id), ["mathe.brueche.erweitern"]);
});
