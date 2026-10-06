/**
 * Real student data: current material, the central recommendation, prerequisites, error types,
 * diagnosis, task library, material upload, summaries, statistics and data quality.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const DAY = 86_400_000;
const kid = (name: string, teacherId: number | null, o: Partial<{ school_type: string; klasse: number; grade: number; subjects: string[]; current_topics: string }> = {}) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ...o,
});
const plusDays = (today: string, n: number) => new Date(Date.parse(`${today}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

async function setup(name: string) {
  const repo = await import("./repo");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  return { repo, niko, sid, student: repo.getStudent(sid)! };
}
/** One exercise with one task per skill, assigned; rec() writes a final answer days ago. */
async function practice(sid: number, skills: string[]) {
  const repo = await import("./repo");
  const w = repo.createWorksheet(
    { title: "Training", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [] },
    skills.map((skillId) => ({ type: "calc" as const, skillId, difficulty: "mittel" as const, prompt: skillId, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] })),
  );
  const aid = repo.assignWorksheet(w, sid);
  const t = Object.fromEntries(repo.listTasks(w).map((x) => [x.skillId, x]));
  const rec = (skill: string, correct: number, daysAgo = 1, o: { errorType?: string; source?: string; label?: string } = {}) =>
    repo.recordAttempt({
      assignment_id: aid, task_id: t[skill].id, student_id: sid, skill_id: skill, answer: correct ? "1" : "2", correct, final: 1, attempt_no: 1, time_ms: 30_000, hints_used: 0, solution_viewed: 0,
      error_label: o.label ?? null, feedback: "", created_at: new Date(Date.now() - daysAgo * DAY).toISOString(), error_type: o.errorType ?? null, error_type_source: o.errorType ? (o.source ?? "vorschlag") : null,
    });
  return { w, aid, t, rec };
}

// ---------- Phase 2 ----------
test("a student gets current material per subject; a new one replaces the old, which stays as history", async () => {
  const { niko, sid } = await setup("Clara Stoff");
  const cm = await import("./current-material");
  const { dayOf } = await import("./exams");
  const today = dayOf(new Date());
  const first = cm.setCurrentMaterial({ student_id: sid, subject: "Mathematik", topic: "Brüche", subtopic: "", skill_ids: ["mathe.brueche.kuerzen", "gibt.es.nicht"], since: plusDays(today, -20), priority: 2, note: "", source: "unterricht" }, niko.id);
  assert.deepEqual(cm.getMaterial(first)!.skill_ids, ["mathe.brueche.kuerzen"], "unknown skills are dropped");
  const second = cm.setCurrentMaterial({ student_id: sid, subject: "Mathematik", topic: "Gleichungen", subtopic: "Gleichungen mit Klammern", skill_ids: ["mathe.gleichungen.klammern"], since: today, priority: 1, note: "Probe nicht vergessen", source: "schularbeit" }, niko.id);
  cm.setCurrentMaterial({ student_id: sid, subject: "Deutsch", topic: "Beistrich", subtopic: "", skill_ids: [], since: today, priority: 3, note: "", source: "hausuebung" }, niko.id);

  const active = cm.activeMaterial(sid);
  assert.deepEqual(active.map((m) => m.subject), ["Mathematik", "Deutsch"], "one per subject, high priority first");
  assert.equal(active[0].id, second);
  assert.equal(cm.materialLabel(active[0]), "Gleichungen mit Klammern");
  assert.equal(active[0].source, "schularbeit");
  const history = cm.materialHistory(sid);
  assert.deepEqual(history.map((m) => m.id), [first], "the replaced entry is kept with ended_at");
  assert.ok(history[0].ended_at);
  assert.throws(() => cm.setCurrentMaterial({ student_id: sid, subject: "Mathematik", topic: " ", subtopic: "", skill_ids: [], since: today, priority: 2, note: "", source: "unterricht" }, niko.id), /Thema/);
  cm.endCurrentMaterial(active[1].id);
  assert.deepEqual(cm.activeMaterial(sid).map((m) => m.subject), ["Mathematik"]);
  // the official curriculum is not touched: the skill rows are unchanged
  const repo = await import("./repo");
  assert.equal(repo.getSkill("mathe.gleichungen.klammern")!.area, "Gleichungen");
});

test("the exercise builder preselects the current material; the AI only gets Thema and Unterthema", async () => {
  const { niko, sid } = await setup("Bruno Builder");
  const cm = await import("./current-material");
  const builder = await import("./builder");
  const { dayOf } = await import("./exams");
  cm.setCurrentMaterial({ student_id: sid, subject: "Mathematik", topic: "Gleichungen", subtopic: "Gleichungen mit Klammern", skill_ids: ["mathe.gleichungen.klammern"], since: dayOf(new Date()), priority: 2, note: "Name der Lehrerin: Frau Huber", source: "unterricht" }, niko.id);
  const ctx = builder.studentContext(sid)!;
  assert.match(ctx.suggestions[0].key, /^stoff:/, "the current material is the first suggestion, which the form preselects");
  assert.deepEqual(ctx.suggestions[0].skillIds, ["mathe.gleichungen.klammern"]);
  assert.equal(ctx.suggestions[0].title, "Aktueller Stoff: Gleichungen mit Klammern");
  const ai = builder.contextForAI(ctx, ["mathe.gleichungen.klammern"]);
  assert.match(ai, /Aktueller Stoff in der Schule: Gleichungen mit Klammern/);
  assert.doesNotMatch(ai, /Huber|Bruno/, "no note, no name");

  // without chosen skills the builder still offers the best matching skill, as a suggestion only
  const other = (await import("./repo")).createStudent(kid("Ohne Skill", niko.id));
  cm.setCurrentMaterial({ student_id: other, subject: "Mathematik", topic: "Prozentrechnung", subtopic: "Grundwert", skill_ids: [], since: dayOf(new Date()), priority: 2, note: "", source: "unterricht" }, niko.id);
  const c2 = builder.studentContext(other)!;
  assert.match(c2.suggestions[0].key, /^stoff:/);
  assert.match(c2.suggestions[0].reason, /vorgeschlagen/);
  assert.equal(cm.activeMaterial(other)[0].skill_ids.length, 0, "nothing is linked automatically");
});

test("an exam comes before the current material, a weak skill is recommended with a weak prerequisite as cause", async () => {
  const { niko, sid, repo } = await setup("Paula Prio");
  const { nextSteps } = await import("./recommend");
  const cm = await import("./current-material");
  const { dayOf } = await import("./exams");
  const today = dayOf(new Date());
  const { rec } = await practice(sid, ["mathe.brueche.multiplizieren", "mathe.brueche.dividieren", "mathe.brueche.kuerzen"]);
  for (let i = 0; i < 4; i++) rec("mathe.brueche.dividieren", i === 0 ? 1 : 0, 2, { errorType: "regel" });
  for (let i = 0; i < 3; i++) rec("mathe.brueche.multiplizieren", i === 0 ? 0 : 1, 2);
  cm.setCurrentMaterial({ student_id: sid, subject: "Mathematik", topic: "Brüche", subtopic: "Brüche kürzen", skill_ids: ["mathe.brueche.kuerzen"], since: today, priority: 2, note: "", source: "unterricht" }, niko.id);

  let steps = nextSteps(sid, { today, limit: 10 });
  assert.equal(steps[0].rule, 2, "without an exam the current material leads");
  assert.equal(steps.find((s) => s.rule === 3)?.skill.id, "mathe.brueche.dividieren", "the weak skill is recommended");
  const weak = steps.find((s) => s.rule === 3)!;
  assert.equal(weak.cause?.skill.id, "mathe.brueche.multiplizieren", "its prerequisite at 62 % may be the cause");
  assert.match(weak.reason, /3 Fehler zuletzt/);

  repo.addTest({ student_id: sid, date: plusDays(today, 8), subject: "Mathematik", kind: "Schularbeit", topic: "Brüche", grade: null, points: null, max_points: null, notes: "", skill_ids: ["mathe.brueche.dividieren"] });
  steps = nextSteps(sid, { today, limit: 10 });
  assert.equal(steps[0].rule, 1, "an exam comes first");
  assert.equal(steps[0].skill.id, "mathe.brueche.dividieren");
  assert.equal(steps[0].reason, "Schularbeit in 8 Tagen · Lernstand 30 % · 3 Fehler zuletzt: Regel nicht verstanden · mögliche Ursache: Multiplizieren (62 %)");
  assert.equal(steps.filter((s) => s.skill.id === "mathe.brueche.dividieren").length, 1, "each skill once, with all its reasons");
});

test("prerequisites: the teacher adds and removes them; a removed standard link stays removed after a restart", async () => {
  const { niko } = await setup("Leo Link");
  const lp = await import("./lehrplan");
  assert.ok(lp.prerequisitesOf("mathe.brueche.dividieren").includes("mathe.brueche.multiplizieren"), "standard link");
  assert.ok("error" in lp.addPrerequisite("mathe.brueche.multiplizieren", "mathe.brueche.dividieren", niko.id), "no circles");
  assert.ok("error" in lp.addPrerequisite("mathe.brueche.dividieren", "mathe.brueche.dividieren", niko.id));
  assert.ok("ok" in lp.addPrerequisite("mathe.brueche.dividieren", "mathe.brueche.kuerzen", niko.id));
  const links = lp.prerequisiteLinks("mathe.brueche.dividieren");
  assert.equal(links.find((l) => l.other_id === "mathe.brueche.kuerzen")?.origin, "lehrer");
  assert.equal(links.find((l) => l.other_id === "mathe.brueche.multiplizieren")?.origin, "app");
  lp.removePrerequisite("mathe.brueche.dividieren", "mathe.brueche.multiplizieren", niko.id);
  assert.ok(!lp.prerequisitesOf("mathe.brueche.dividieren").includes("mathe.brueche.multiplizieren"));
  assert.ok(lp.prerequisiteLinks("mathe.brueche.dividieren").some((l) => l.other_id === "mathe.brueche.multiplizieren" && l.removed_at), "kept as removed row");

  // a restart seeds the standard links again: a removed one must not come back
  const { openDatabase } = await import("./db");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-")), "t.db");
  let conn = openDatabase(file);
  conn.prepare("UPDATE skill_links SET removed_at = datetime('now'), origin = origin WHERE skill_id = 'mathe.brueche.dividieren' AND other_id = 'mathe.brueche.multiplizieren'").run();
  conn.close();
  conn = openDatabase(file);
  const row = conn.prepare("SELECT removed_at FROM skill_links WHERE skill_id = 'mathe.brueche.dividieren' AND other_id = 'mathe.brueche.multiplizieren'").get() as { removed_at: string | null };
  assert.ok(row.removed_at, "still removed after the restart");
  conn.close();
  // back to the standard links for the following tests
  assert.ok("ok" in lp.addPrerequisite("mathe.brueche.dividieren", "mathe.brueche.multiplizieren", niko.id));
  lp.removePrerequisite("mathe.brueche.dividieren", "mathe.brueche.kuerzen", niko.id);
  assert.deepEqual(lp.prerequisitesOf("mathe.brueche.dividieren"), ["mathe.brueche.multiplizieren"]);
});

test("error types: suggested by rule, confirmed or changed by the teacher, traceable, used by Lernstand and recommendation", async () => {
  const { niko, sid, student, repo } = await setup("Emil Fehler");
  const { suggestErrorType } = await import("./error-types");
  const { submitAnswer, analyzeStudent } = await import("./service");
  const calc = (accepted: string) => ({ type: "calc" as const, data: {}, answer: { accepted: [accepted], mode: "value" as const }, category: null });
  assert.equal(suggestErrorType(calc("-12"), "12", null), "vorzeichen");
  assert.equal(suggestErrorType(calc("3,5"), "35", null), "einheit");
  assert.equal(suggestErrorType(calc("43"), "34", null), "rechenfehler");
  assert.equal(suggestErrorType(calc("43"), "7", null), null, "no rule fits: no guess");
  assert.equal(suggestErrorType(calc("3/4"), "4/3", "Kehrwert vergessen"), "regel", "a known misconception of the task");
  assert.equal(suggestErrorType(calc("3/4"), "1", "Vorzeichenfehler beim Umformen"), "vorzeichen");
  const word = (accepted: string, category: string | null = null) => ({ type: "grammar" as const, data: {}, answer: { accepted: [accepted], mode: "text" as const }, category });
  assert.equal(suggestErrorType(word("Fahrrad"), "Farrad", null, "Deutsch"), "rechtschreibung");
  assert.equal(suggestErrorType(word("went"), "goed", null, "Englisch"), "grammatik");
  assert.equal(suggestErrorType(word("bicycle", "vocabulary"), "car", null, "Englisch"), "wortschatz");

  const w = repo.createWorksheet(
    { title: "Negative Zahlen", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [] },
    [{ type: "calc", skillId: "mathe.negativ.addieren", difficulty: "mittel", prompt: "(−5) + (−7) = ?", data: {}, answer: { accepted: ["-12"], mode: "value" }, solution: "−12", hints: [], errorMap: [] }],
  );
  const aid = repo.assignWorksheet(w, sid);
  const task = repo.listTasks(w)[0];
  for (let i = 0; i < 3; i++) await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: task.id, answer: "12", timeMs: 20_000, hintsUsed: 0 });
  const tries = repo.listAttemptsForAssignment(aid);
  assert.equal(tries.length, 3);
  assert.ok(tries.every((a) => a.error_type === "vorzeichen" && a.error_type_source === "vorschlag" && a.error_type_suggested === "vorzeichen"), "every wrong try gets the suggestion");

  const before = analyzeStudent(sid)!.skills.find((s) => s.skill.id === "mathe.negativ.addieren")!.mastery!;
  const final = tries.find((a) => a.final)!;
  repo.setAttemptErrorType(final.id, "fluechtig", niko.id);
  const changed = repo.getAttempt(final.id)!;
  assert.equal(changed.error_type, "fluechtig");
  assert.equal(changed.error_type_source, "lehrer");
  assert.equal(changed.error_type_suggested, "vorzeichen", "the app's suggestion stays visible");
  assert.equal(changed.error_type_by, niko.id);
  assert.ok(changed.error_type_at);
  const after = analyzeStudent(sid)!;
  assert.ok(after.skills.find((s) => s.skill.id === "mathe.negativ.addieren")!.mastery! > before, "a confirmed careless error counts milder");
  assert.deepEqual(after.errorTypes.map((e) => [e.type, e.count, e.confirmed]), [["vorzeichen", 2, 0], ["fluechtig", 1, 1]]);
  const { setSetting } = await import("./lehrplan");
  const { CARELESS_SETTING } = await import("./service");
  setSetting(CARELESS_SETTING, "aus");
  assert.equal(analyzeStudent(sid)!.skills.find((s) => s.skill.id === "mathe.negativ.addieren")!.mastery!.toFixed(4), before.toFixed(4), "can be switched off");
  setSetting(CARELESS_SETTING, "an");

  const { nextSteps } = await import("./recommend");
  const { dayOf } = await import("./exams");
  const step = nextSteps(sid, { today: dayOf(new Date()), limit: 10 }).find((s) => s.skill.id === "mathe.negativ.addieren");
  assert.ok(step, "the skill with repeated errors is recommended");
  assert.equal(step.errorType, "vorzeichen");
  // a correct answer cannot get an error type
  const okId = repo.recordAttempt({ assignment_id: aid, task_id: task.id, student_id: sid, skill_id: "mathe.negativ.addieren", answer: "-12", correct: 1, final: 0, attempt_no: 9, time_ms: 1, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "" });
  repo.setAttemptErrorType(okId, "rechenfehler", niko.id);
  assert.equal(repo.getAttempt(okId)!.error_type, null);
});

// ---------- Phase 3 ----------
/** The right answer of a task as the student app sends it, and a surely wrong one. */
function answers(t: { data: { options?: string[]; steps?: string[] }; answer: { correct?: number; accepted?: string[]; blanks?: string[][]; steps?: string[] } }) {
  if (t.data.options && typeof t.answer.correct === "number") return { right: String(t.answer.correct), wrong: String((t.answer.correct + 1) % t.data.options.length) };
  if (t.answer.blanks) return { right: JSON.stringify(t.answer.blanks.map((b) => b[0])), wrong: JSON.stringify(t.answer.blanks.map(() => "999999")) };
  if (t.data.steps && t.answer.steps) {
    const right = t.answer.steps.map((s) => t.data.steps!.indexOf(s));
    return { right: JSON.stringify(right), wrong: JSON.stringify([...right].reverse()) };
  }
  return { right: t.answer.accepted![0], wrong: "999999" };
}

test("a task is saved in the library, found by search and filters, edited, duplicated and reused", async () => {
  const { repo, niko, sid } = await setup("Lena Bibliothek");
  const lib = await import("./library");
  const src = repo.createWorksheet(
    { title: "Brüche üben", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Bruchrechnung", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [] },
    [
      { type: "calc", skillId: "mathe.brueche.dividieren", difficulty: "schwer", prompt: "Berechne 3/4 : 1/2", data: {}, answer: { accepted: ["3/2"], mode: "value" }, solution: "3/4 · 2/1 = 3/2", hints: ["Kehrwert"], errorMap: [] },
      { type: "calc", skillId: "mathe.brueche.kuerzen", difficulty: "leicht", prompt: "Kürze 6/8", data: {}, answer: { accepted: ["3/4"], mode: "value" }, solution: "", hints: [], errorMap: [], sourceType: "ki" },
    ],
  );
  const [div, kuerzen] = repo.listTasks(src);
  const saved = lib.saveToLibrary(div.id, { teacherId: niko.id, tags: ["Schularbeit", " #Kehrwert ", "Schularbeit"] });
  assert.ok("id" in saved && !saved.existing);
  const id = (saved as { id: number }).id;
  assert.deepEqual(lib.saveToLibrary(div.id), { id, existing: true }, "the same task is not stored twice");
  const entry = lib.getLibraryEntry(id)!;
  assert.equal(entry.task.prompt, "Berechne 3/4 : 1/2");
  assert.equal(entry.task.solution, "3/4 · 2/1 = 3/2");
  assert.deepEqual(entry.tags, ["Schularbeit", "Kehrwert"]);
  assert.equal(entry.topic, "Bruchrechnung");
  assert.equal(entry.origin, "eigen");
  assert.equal(repo.getWorksheet(id)!.kind, "bibliothek");
  assert.equal(repo.listTasks(src).length, 2, "the exercise keeps its tasks");
  assert.ok(!repo.listWorksheets().some((w) => w.id === id), "library entries are not listed as exercises");

  const ki = (lib.saveToLibrary(kuerzen.id) as { id: number }).id;
  assert.equal(lib.getLibraryEntry(ki)!.origin, "ki");
  assert.deepEqual(lib.searchLibrary({ q: "Kehrwert" }).map((e) => e.id), [id], "search looks at text, solution and tags");
  assert.deepEqual(lib.searchLibrary({ tag: "schularbeit" }).map((e) => e.id), [id]);
  assert.deepEqual(lib.searchLibrary({ origin: "ki" }).map((e) => e.id), [ki]);
  assert.deepEqual(lib.searchLibrary({ difficulty: "schwer" }).map((e) => e.id), [id]);
  assert.deepEqual(lib.searchLibrary({ schoolType: "Mittelschule", klasse: 2 }).map((e) => e.id).sort(), [id, ki].sort());
  assert.deepEqual(lib.searchLibrary({ skillId: "mathe.brueche.kuerzen" }).map((e) => e.id), [ki]);
  assert.deepEqual(lib.libraryFacets("Mathematik").tags, ["Kehrwert", "Schularbeit"]);

  assert.ok(lib.updateLibraryEntry(id, { title: "Bruchdivision mit Kehrwert", schoolType: "Gymnasium", klasse: 3, topic: "Brüche", tags: ["Test"] }));
  const edited = lib.getLibraryEntry(id)!;
  assert.deepEqual([edited.title, edited.school_type, edited.klasse, edited.grade, edited.topic, edited.tags], ["Bruchdivision mit Kehrwert", "Gymnasium", 3, 7, "Brüche", ["Test"]]);
  const copy = lib.duplicateLibraryEntry(id, niko.id)!;
  assert.equal(lib.getLibraryEntry(copy)!.title, "Bruchdivision mit Kehrwert (Kopie)");
  assert.deepEqual(lib.getLibraryEntry(copy)!.tags, ["Test"]);

  // reuse: in the editor's search library tasks come first; a selection becomes a new draft exercise
  const found = repo.searchTasks({ skillIds: ["mathe.brueche.dividieren"], subject: "Mathematik", excludeWorksheetId: src });
  assert.equal(found[0].worksheet_kind, "bibliothek");
  const other = repo.createWorksheet({ title: "Deutsch", subject: "Deutsch", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "grammar", kind: "uebung", source: "manuell", skill_ids: [] }, [
    { type: "grammar", skillId: null, difficulty: "mittel", prompt: "Setze das Komma", data: {}, answer: { accepted: ["x"], mode: "text" }, solution: "", hints: [], errorMap: [] },
  ]);
  const deutsch = (lib.saveToLibrary(repo.listTasks(other)[0].id) as { id: number }).id;
  const made = lib.exerciseFromLibrary([id, ki, deutsch], { studentId: sid, teacherId: niko.id });
  assert.ok("id" in made);
  assert.equal(made.skipped, 1, "a task of another subject is left out");
  const ex = repo.getWorksheet(made.id)!;
  assert.deepEqual([ex.kind, ex.status, ex.student_id, ex.subject, ex.title], ["uebung", "entwurf", sid, "Mathematik", "Lena – Brüche, Bruchrechnung"]);
  assert.deepEqual(repo.listTasks(made.id).map((t) => t.prompt), ["Berechne 3/4 : 1/2", "Kürze 6/8"]);
  assert.equal(repo.listTasks(made.id)[1].sourceType, "ki", "the origin travels with the copy");

  // sending one library task gives an ordinary exercise, not a library entry
  const { sendSingleTask } = await import("./builder");
  const sent = sendSingleTask(lib.getLibraryEntry(id)!.task.id, sid, niko.id);
  assert.equal(repo.getWorksheet(sent.worksheetId!)!.kind, "uebung");
  assert.ok(sent.assignmentId);

  assert.ok(lib.deleteLibraryEntry(id));
  assert.equal(lib.getLibraryEntry(id), null);
  assert.equal(repo.listTasks(made.id).length, 2, "exercises keep their copy");
  assert.equal(lib.deleteLibraryEntry(made.id), false, "only library entries can be deleted here");
});

test("planning a diagnosis: 5–10 tasks, easy to hard, spread over the topics", async () => {
  const d = await import("./diagnose");
  const { schoolBranch } = await import("./school");
  const skills = d.diagnosisSkills({ subject: "Mathematik", branch: schoolBranch("mittelschule"), klasse: 2, topics: ["Bruchrechnung", "Negative Zahlen"] });
  assert.deepEqual(skills.map((s) => s.id), [
    "mathe.brueche.kuerzen", "mathe.negativ.addieren", "mathe.brueche.erweitern", "mathe.negativ.multiplizieren",
    "mathe.brueche.addieren", "mathe.brueche.subtrahieren", "mathe.brueche.multiplizieren", "mathe.brueche.dividieren",
  ]);
  const plan = d.planDiagnosis(skills.map((s) => s.id));
  assert.equal(plan.length, 8);
  assert.deepEqual(plan.map((p) => p.difficulty), ["leicht", "leicht", "leicht", "mittel", "mittel", "mittel", "schwer", "schwer"]);
  assert.deepEqual(d.planDiagnosis(["a"]).map((p) => p.difficulty), ["leicht", "mittel", "mittel", "schwer", "schwer"]);
  assert.equal(d.planDiagnosis(["a", "b"]).length, 6);
  assert.equal(d.planDiagnosis(["a", "b", "c", "d"]).length, 8);
  assert.equal(d.planDiagnosis(Array.from({ length: 14 }, (_, i) => `s${i}`)).length, 10);
  assert.deepEqual(d.planDiagnosis([]), []);
});

test("a diagnosis lands in the normal tracking, marked as diagnosis, and updates the Lernstand", async () => {
  const { repo, niko, sid, student } = await setup("Paul Diagnose");
  const d = await import("./diagnose");
  const lib = await import("./library");
  const { submitAnswer, analyzeStudent } = await import("./service");
  const { dayOf } = await import("./exams");
  // a library task for Kürzen (leicht) is used before the generator
  const own = repo.createWorksheet({ title: "x", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "leicht", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [] }, [
    { type: "calc", skillId: "mathe.brueche.kuerzen", difficulty: "leicht", prompt: "Kürze 10/15 so weit wie möglich.", data: {}, answer: { accepted: ["2/3"], mode: "value" }, solution: "10/15 = 2/3", hints: [], errorMap: [] },
  ]);
  lib.saveToLibrary(repo.listTasks(own)[0].id);
  assert.equal(analyzeStudent(sid)!.skills.find((s) => s.skill.id === "mathe.brueche.dividieren")!.mastery, null, "nothing known before");

  const skills = ["mathe.brueche.kuerzen", "mathe.brueche.multiplizieren", "mathe.brueche.dividieren"];
  const out = await d.createDiagnosis({ studentId: sid, subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: skills, topics: ["Bruchrechnung"], teacherId: niko.id, useAI: false, seed: 7 });
  const w = repo.getWorksheet(out.worksheetId)!;
  assert.deepEqual([w.kind, w.status, w.title], ["diagnose", "freigegeben", "Paul – Diagnose: Bruchrechnung"]);
  const tasks = repo.listTasks(w.id);
  assert.equal(tasks.length, 6, "two tasks per skill with three skills");
  const fromLib = new Set(lib.searchLibrary({ subject: "Mathematik" }).map((e) => e.task.prompt));
  assert.ok(out.fromLibrary >= 1);
  assert.equal(tasks.filter((t) => fromLib.has(t.prompt)).length, out.fromLibrary, "library tasks are used before the generator");
  assert.ok(fromLib.has(tasks[0].prompt) && tasks[0].skillId === "mathe.brueche.kuerzen", "easy tasks first, the library task among them");
  assert.deepEqual(tasks.map((t) => t.difficulty), ["leicht", "leicht", "leicht", "schwer", "schwer", "schwer"]);
  assert.ok(repo.getAssignment(out.assignmentId)!.note.startsWith(d.DIAGNOSE_NOTE));
  assert.ok(repo.listWorksheets().some((x) => x.id === w.id), "a diagnosis is listed with the exercises");
  assert.ok(d.diagnosesOf(sid).some((a) => a.id === out.assignmentId));

  let r = d.diagnosisResult(out.assignmentId, { today: dayOf(new Date()) })!;
  assert.equal(r.done, 0);
  assert.ok(r.skills.every((s) => s.status === "offen"));

  // the student answers on the tablet: Kürzen right, Multiplizieren once right once wrong, Dividieren wrong
  for (const t of tasks) {
    const { right, wrong } = answers(t);
    const correct = t.skillId === "mathe.brueche.kuerzen" || (t.skillId === "mathe.brueche.multiplizieren" && t.difficulty === "leicht");
    for (let i = 0; i < (correct ? 1 : 3); i++) {
      await submitAnswer({ token: student.access_token, assignmentId: out.assignmentId, taskId: t.id, answer: correct ? right : wrong, timeMs: 20_000, hintsUsed: 0 });
    }
  }
  const tracked = repo.listAttemptsForStudent(sid);
  assert.equal(tracked.filter((a) => a.final).length, 6, "every answer is in the normal tracking");
  const marked = (await import("./db")).db().prepare("SELECT COUNT(*) AS n FROM attempts x JOIN assignments a ON a.id = x.assignment_id JOIN worksheets w ON w.id = a.worksheet_id WHERE x.student_id = ? AND w.kind = 'diagnose'").get(sid) as { n: number };
  assert.equal(marked.n, tracked.length, "and marked as diagnosis through its exercise");

  const m = (id: string) => analyzeStudent(sid)!.skills.find((s) => s.skill.id === id)!.mastery!;
  assert.ok(m("mathe.brueche.kuerzen") > 0.7, "the Lernstand rises for what sits");
  assert.ok(m("mathe.brueche.dividieren") < 0.3, "and falls for what does not");

  r = d.diagnosisResult(out.assignmentId, { today: dayOf(new Date()) })!;
  assert.ok(r.finished);
  assert.deepEqual(r.skills.map((s) => [s.skill.id, s.status]), [
    ["mathe.brueche.kuerzen", "sicher"],
    ["mathe.brueche.multiplizieren", "unsicher"],
    ["mathe.brueche.dividieren", "kritisch"],
  ]);
  assert.equal(r.skills[2].tasks.length, 2);
  assert.ok(r.skills[2].tasks.every((t) => t.correct === false && t.tries === 3));
  // Dividieren needs Multiplizieren (unsure in the diagnosis); Multiplizieren needs Kürzen (sure) → one gap
  assert.deepEqual(r.gaps.map((g) => [g.skill.id, g.for.map((x) => x.id), g.reason]), [["mathe.brueche.multiplizieren", ["mathe.brueche.dividieren"], "in der Diagnose unsicher"]]);
  assert.ok(r.next.length > 0 && r.next.every((n) => ["mathe.brueche.multiplizieren", "mathe.brueche.dividieren"].includes(n.skill.id)), "next steps follow the diagnosis");
});
