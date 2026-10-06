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
