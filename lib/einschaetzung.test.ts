import assert from "node:assert/strict";
import test from "node:test";
import type { TaskLine, UnitReport } from "./learning";

process.env.DATABASE_PATH = ":memory:";

/** A task line: `r` right at the first try, `h` right after a hint, `s` right after a wrong try, `f` wrong, `l` solution viewed. */
function aufgabe(art: "r" | "h" | "s" | "f" | "l", i: number, o: Partial<TaskLine> = {}): TaskLine {
  return {
    taskId: i,
    assignmentId: 1,
    worksheet: "Übung",
    position: i,
    prompt: `Aufgabe ${i}`,
    skillId: "mathe.brueche.kuerzen",
    skill: "Kürzen",
    difficulty: "mittel",
    tries: art === "s" ? 2 : 1,
    correct: art !== "f" && art !== "l",
    finished: true,
    firstTry: art === "r",
    help: art === "h" ? "hinweis" : art === "l" ? "loesung" : "keine",
    solvedAfterHelp: art === "h",
    corrected: art === "s" ? "selbst" : null,
    timeMs: 30_000,
    activeMs: 30_000,
    errors: [],
    errorTypes: [],
    at: i,
    ...o,
  };
}

function bericht(arten: string, o: Partial<UnitReport> = {}): UnitReport {
  const tasks = [...arten].map((a, i) => aufgabe(a as "r", i));
  const done = tasks.filter((t) => t.finished);
  const correct = done.filter((t) => t.correct).length;
  return {
    version: 1,
    unitId: 1,
    startedAt: "2026-10-19T14:00:00.000Z",
    endedAt: "2026-10-19T15:30:00.000Z",
    durationMs: 90 * 60_000,
    activeMs: 0,
    subjects: ["Mathematik"],
    topics: ["Bruchrechnen"],
    subtopics: ["Kürzen"],
    worksheets: [],
    tasksDone: done.length,
    correct,
    wrong: done.length - correct,
    successRate: done.length ? correct / done.length : null,
    firstTry: done.filter((t) => t.firstTry).length,
    multiTry: 0,
    difficulties: [],
    skills: [],
    development: { firstHalf: null, secondHalf: null, direction: null },
    errors: [],
    errorTypes: [],
    correction: { selbst: tasks.filter((t) => t.corrected === "selbst").length, nachHilfe: 0, nicht: 0 },
    help: { tasks: tasks.filter((t) => t.help !== "keine").length, hinweis: 0, erklaerung: 0, loesung: 0, solvedAfterHelp: tasks.filter((t) => t.solvedAfterHelp).length },
    speed: { avgMs: 30_000, slow: [], fast: [], pauses: 0, manyRetries: 0 },
    problemTasks: [],
    tasks,
    texts: [],
    ...o,
  };
}

test("no tasks on the device: no scale values, it says why", async () => {
  const { einschaetzen } = await import("./einschaetzung");
  const e = einschaetzen(bericht(""), [], "Mathematik");
  assert.equal(e.stufe, null);
  assert.equal(e.titel, "Keine Aufgaben am Gerät");
  assert.deepEqual(e.werte, { understanding: null, concentration: null, participation: null });
  assert.match(e.saetze.join(" "), /keine Aufgaben gelöst/);
});

test("too few tasks: the numbers, but no values on the scales", async () => {
  const { einschaetzen, MIN_AUFGABEN } = await import("./einschaetzung");
  const e = einschaetzen(bericht("rrr"), [], "Mathematik");
  assert.equal(MIN_AUFGABEN, 4);
  assert.equal(e.stufe, null);
  assert.equal(e.werte.understanding, null);
  assert.equal(e.saetze[0], "3 von 3 Aufgaben richtig (100 %), 3 beim ersten Versuch ohne Hilfe.");
});

test("everything right at the first try, steady: very good on every scale", async () => {
  const { einschaetzen } = await import("./einschaetzung");
  const e = einschaetzen(bericht("rrrrrrrr"), [], "Mathematik");
  assert.deepEqual(e.werte, { understanding: 5, concentration: 5, participation: 5 });
  assert.equal(e.stufe, 5);
  assert.equal(e.titel, "Sehr gut gelaufen");
  assert.equal(e.vergleich, null, "nothing to compare with yet");
  assert.match(e.gruende.concentration!, /keine längeren Pausen/);
});

test("many wrong answers, pauses and giving up lower the scales, with reasons", async () => {
  const { einschaetzen } = await import("./einschaetzung");
  const r = bericht("rffllhff", { speed: { avgMs: 60_000, slow: [], fast: [], pauses: 3, manyRetries: 0 }, development: { firstHalf: 0.5, secondHalf: 0.1, direction: "schlechter" } });
  const e = einschaetzen(r, [], "Mathematik");
  assert.ok(e.werte.understanding! <= 2, `understanding ${e.werte.understanding}`);
  assert.ok(e.werte.concentration! <= 2, `concentration ${e.werte.concentration}`);
  assert.match(e.gruende.concentration!, /3 längere Pausen/);
  assert.match(e.gruende.concentration!, /gegen Ende mehr Fehler/);
  assert.match(e.gruende.participation!, /2× gleich den Lösungsweg angesehen/);
  assert.ok(e.stufe! <= 2);
  assert.ok(e.saetze.includes("Gegen Ende mehr Fehler, vielleicht müde."));
});

test("compared with the last units of the same subject: better, and faster", async () => {
  const { einschaetzen } = await import("./einschaetzung");
  const vorher = (arten: string, avgMs: number) => bericht(arten, { speed: { avgMs, slow: [], fast: [], pauses: 0, manyRetries: 0 } });
  const frueher = [
    { report: vorher("rrffrfrf", 50_000), fach: "Mathematik" }, // 50 %
    { report: vorher("rrrrrrrr", 20_000), fach: "Englisch" }, // another subject: not compared
    { report: vorher("rfrfrfrrrf", 46_000), fach: "Mathematik" }, // 60 %
  ];
  const jetzt = bericht("rrrrrrrsf", { speed: { avgMs: 30_000, slow: [], fast: [], pauses: 0, manyRetries: 0 } }); // 8 of 9
  const e = einschaetzen(jetzt, frueher, "Mathematik");
  assert.equal(e.vergleich?.einheiten, 2);
  assert.equal(e.vergleich?.fach, "Mathematik");
  assert.equal(e.vergleich?.richtung, "besser");
  assert.ok(e.saetze.includes("Besser als in den letzten 2 Einheiten in Mathematik: 89 % statt 55 % richtig."), e.saetze.join(" | "));
  assert.ok(e.saetze.includes("Schneller als zuletzt: 30 s statt 48 s pro Aufgabe."), e.saetze.join(" | "));

  // without earlier units of that subject there is no comparison: other subjects do not compare
  assert.equal(einschaetzen(jetzt, frueher, "Deutsch").vergleich, null);
});

test("the fields: positives, difficulties, review topics and the next goal", async () => {
  const { autoWerte, einschaetzen } = await import("./einschaetzung");
  const skill = (name: string, state: "sicher" | "unsicher" | "problem", correct: number, done: number) => ({ skillId: name, name, area: "Bruchrechnen", subject: "Mathematik", done, correct, firstTry: correct, withHelp: 0, rate: 0, avgTimeMs: 0, before: null, after: null, state });
  const r = bericht("rrrrff", {
    skills: [skill("Kürzen", "sicher", 4, 4), skill("Dividieren", "problem", 0, 2)],
    errorTypes: [{ type: "bruch", count: 2, confirmed: 2 }, { type: "fluechtig", count: 1, confirmed: 0 }],
  });
  const w = autoWerte(r, einschaetzen(r, [], "Mathematik"), ["Dividieren (Schwäche)"]);
  assert.equal(w.positives, "Sicher: Kürzen (4 von 4).");
  assert.equal(w.difficulties, "Dividieren: 0 von 2 richtig\nHäufige Fehler: Fehler beim Bruchrechnen (2×), Flüchtigkeitsfehler (1×, vermutet)");
  assert.equal(w.review_topics, "Dividieren");
  assert.equal(w.next_steps, "Dividieren (Schwäche)");
});

test("ending a unit fills the documentation; what the teacher wrote stays", async () => {
  const repo = await import("./repo");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const units = await import("./units");
  const learning = await import("./learning");
  const { autoFelderVon, leseEinschaetzung } = await import("./einschaetzung");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Mia Probe", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const { unit } = units.startUnit(teacher.id, sid, { at: Date.now() - 60 * 60_000, subject: "Mathematik" });
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count: 6, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(wid, sid);
  for (const [i, t] of repo.listTasks(wid).entries()) {
    const answer = i < 5 ? (t.answer.accepted?.[0] ?? "") : (t.errorMap[0]?.answer ?? "0");
    await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer, timeMs: 25_000, activeMs: 25_000, hintsUsed: 0 });
  }

  const lessonId = learning.endUnit(unit.id, { byTeacherId: teacher.id })!;
  const lesson = repo.getLesson(lessonId)!;
  const e = leseEinschaetzung(lesson)!;
  assert.ok(e, "the assessment is stored");
  assert.ok(e.stufe !== null);
  assert.equal(lesson.understanding, e.werte.understanding);
  assert.equal(lesson.concentration, e.werte.concentration);
  assert.equal(lesson.participation, e.werte.participation);
  assert.equal(lesson.motivation, null, "motivation stays with the teacher");
  assert.ok(lesson.next_steps.length > 0, "the next goal comes from the recommendation");
  const auto = autoFelderVon(lesson);
  for (const f of ["understanding", "concentration", "participation", "next_steps"]) assert.ok(auto.has(f), `${f} is marked automatic`);
  assert.equal(lesson.reviewed_at, null);

  // the teacher sets the concentration; writing the documentation again keeps it and refreshes the rest
  const anders = e.werte.concentration === 2 ? 3 : 2;
  repo.saveLesson({ ...lesson, concentration: anders }, lesson.id);
  assert.ok(!autoFelderVon(repo.getLesson(lessonId)!).has("concentration"), "a changed field is the teacher's");
  learning.writeLearningDoc(units.getUnit(unit.id)!, Date.now());
  const again = repo.getLesson(lessonId)!;
  assert.equal(again.concentration, anders, "the teacher's value stays");
  assert.ok(!autoFelderVon(again).has("concentration"));
  assert.equal(again.understanding, e.werte.understanding, "automatic values are refreshed");
});
