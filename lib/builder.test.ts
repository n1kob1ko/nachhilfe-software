import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

async function setup() {
  const repo = await import("./repo");
  const builder = await import("./builder");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const newStudent = (name: string, extra: Partial<Parameters<typeof repo.createStudent>[0]> = {}) =>
    repo.createStudent({
      name, grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ...extra,
    });
  const settings = (o: Partial<import("./builder").BuilderSettings> = {}): import("./builder").BuilderSettings => ({
    studentId: null, subject: "Mathematik", schoolType: "Gymnasium", klasse: 3, skillIds: ["mathe.brueche.dividieren.kehrwert"],
    difficulty: "mittel", count: 5, categories: [], focus: "", useAI: false, title: "", ...o,
  });
  return { repo, builder, niko, newStudent, settings };
}

const KEHRWERT = "mathe.brueche.dividieren.kehrwert";
const DIVIDIEREN = "mathe.brueche.dividieren";

test("the AI prompt carries the student context, skills with difficulty and the chosen task types", async () => {
  const { buildPrompt } = await import("./ai");
  const { categoriesFor } = await import("./curriculum");
  const prompt = buildPrompt({
    subject: "Mathematik",
    level: "3. Klasse Gymnasium",
    skills: [{ id: KEHRWERT, name: "Kehrwert korrekt bilden", area: "Bruchrechnung", parentName: "Brüche dividieren", difficulty: "leicht" }],
    count: 10,
    categories: categoriesFor("Mathematik").filter((c) => c.key === "textaufgabe" || c.key === "fehler"),
    studentContext: "Max, 3. Klasse Gymnasium.\nKann Multiplikation gut, vergisst oft den Kehrwert.",
    focusNote: "Fußball",
    avoid: ["3/4 : 1/2 = ?"],
  });
  assert.match(prompt, /genau 10 Aufgaben/);
  assert.match(prompt, /3\. Klasse Gymnasium/);
  assert.match(prompt, /mathe\.brueche\.dividieren\.kehrwert: Bruchrechnung › Brüche dividieren › Kehrwert korrekt bilden – leicht/);
  assert.match(prompt, /textaufgabe: Textaufgabe/);
  assert.match(prompt, /fehler: Fehler finden/);
  assert.match(prompt, /vergisst oft den Kehrwert/);
  assert.match(prompt, /Fußball/);
  assert.match(prompt, /3\/4 : 1\/2/);
});

test("structured AI tasks become app tasks; broken parts are repaired or dropped", async () => {
  const { aiTaskToDraft } = await import("./ai");
  const { categoriesFor } = await import("./curriculum");
  const { checkAnswer } = await import("./tasks");
  const req = { subject: "Mathematik", skills: [{ id: KEHRWERT, name: "Kehrwert", area: "Bruchrechnung", difficulty: "leicht" as const }], categories: categoriesFor("Mathematik") };
  const base = {
    category: "rechnung", format: "calc" as const, skill_ids: [KEHRWERT, "erfunden.id"], topic: "Bruchrechnung", difficulty: "leicht" as const,
    prompt: "Berechne 3/4 : 1/2.", passage: null, options: null, correct_option: null, accepted_answers: null, numeric: true, blanks: null,
    sample_answer: null, steps: null, solution: "3/4 · 2/1 = 6/4 = 3/2", solution_steps: ["Kehrwert von 1/2 ist 2/1", "3/4 · 2/1 = 6/4", " 6/4 = 3/2 "], estimated_time_sec: 60, hints: ["Dividieren heißt mit dem Kehrwert multiplizieren.", "Kehrwert: Zähler und Nenner tauschen.", ""],
    common_errors: [{ answer: "3/8", label: "Kehrwert vergessen" }],
  };
  const calc = aiTaskToDraft({ ...base, accepted_answers: ["3/2", "1 1/2"] }, req)!;
  assert.equal(calc.type, "calc");
  assert.deepEqual(calc.skillIds, [KEHRWERT], "unknown skill ids are dropped");
  assert.equal(calc.hints.length, 2, "empty hints are dropped");
  assert.deepEqual(calc.solutionSteps, ["Kehrwert von 1/2 ist 2/1", "3/4 · 2/1 = 6/4", "6/4 = 3/2"]);
  assert.equal(calc.estimatedTimeSec, 60);
  assert.equal(calc.sourceType, "ki");
  assert.equal(checkAnswer(calc, "1,5").correct, true);
  assert.equal(checkAnswer(calc, "3/8").errorLabel, "Kehrwert vergessen");

  const mc = aiTaskToDraft({ ...base, format: "mc", category: "mc", options: ["3/8", "3/2", "2/3"], correct_option: 1 }, req)!;
  assert.equal(mc.type, "mc");
  assert.equal(mc.answer.correct, 1);
  const badMc = aiTaskToDraft({ ...base, format: "mc", options: ["a", "b"], correct_option: 5, accepted_answers: ["3/2"] }, req)!;
  assert.equal(badMc.type, "calc", "an out-of-range correct option falls back to the short answer");

  const cloze = aiTaskToDraft({ ...base, format: "cloze", category: "lueckentext", prompt: "3/4 : 1/2 = 3/4 · ___ = ___", blanks: [["2/1", "2"], ["3/2"]] }, req)!;
  assert.equal(cloze.type, "cloze");
  assert.equal(checkAnswer(cloze, JSON.stringify(["2", "3/2"])).correct, true);
  const clozeMismatch = aiTaskToDraft({ ...base, format: "cloze", prompt: "3/4 : 1/2 = ___", blanks: [["a"], ["b"]], accepted_answers: null, sample_answer: "x" }, req)!;
  assert.notEqual(clozeMismatch.type, "cloze", "gap count and blanks must match");

  const steps = ["Kehrwert von 1/2 bilden: 2/1", "Multiplizieren: 3/4 · 2/1 = 6/4", "Kürzen: 3/2"];
  const order = aiTaskToDraft({ ...base, format: "order", category: "ordnen", prompt: "Bring die Schritte in die richtige Reihenfolge.", steps }, req, () => 0)!;
  assert.equal(order.type, "order");
  assert.deepEqual(order.answer.steps, steps);
  assert.notDeepEqual(order.data.steps, steps, "the student sees the steps shuffled");
  const right = JSON.stringify(steps.map((s) => order.data.steps!.indexOf(s)));
  assert.equal(checkAnswer(order, right).correct, true);
  assert.equal(checkAnswer(order, JSON.stringify([0, 1, 2].filter(() => true))).correct, JSON.stringify([0, 1, 2]) === right);
  assert.equal(aiTaskToDraft({ ...base, prompt: "  " }, req), null);
});

test("the builder makes a draft from settings: sub-skill, task types, automatic difficulty from the student's progress", async () => {
  const { repo, builder, niko, newStudent, settings } = await setup();
  const sid = newStudent("Max Muster", { weaknesses_note: "Division von Brüchen, Textaufgaben", current_topics: "Bruchrechnung" });
  // Max has done some division of fractions before: 1 of 4 right
  const old = repo.createWorksheet({ title: "alt", subject: "Mathematik", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [DIVIDIEREN] }, [
    { type: "calc", skillId: DIVIDIEREN, difficulty: "mittel", prompt: "1/2 : 1/4", data: {}, answer: { accepted: ["2"], mode: "value" }, solution: "", hints: [], errorMap: [] },
  ]);
  const aid = repo.assignWorksheet(old, sid);
  const task = repo.listTasks(old)[0];
  for (const [i, ok] of [0, 0, 0, 1].entries()) {
    repo.recordAttempt({ assignment_id: aid, task_id: task.id, student_id: sid, skill_id: DIVIDIEREN, answer: "x", correct: ok, final: 1, attempt_no: 1, time_ms: 1000, hints_used: 0, solution_viewed: 0, error_label: ok ? null : "Kehrwert vergessen", feedback: "", created_at: new Date(Date.now() - (5 - i) * 86400000).toISOString() });
  }

  const ctx = builder.studentContext(sid)!;
  assert.equal(ctx.first, "Max");
  assert.match(ctx.level, /^3\. Klasse Gymnasium/);
  assert.ok(ctx.suggestions.some((s) => s.skillIds[0] === KEHRWERT), "the frequent error points at the sub-skill Kehrwert");
  assert.ok(builder.contextForAI(ctx, [KEHRWERT]).includes("Kehrwert vergessen"));
  const forAI = builder.contextForAI(ctx, [KEHRWERT]);
  assert.ok(!forAI.includes("Max") && !forAI.includes("Muster"), "no name goes to the AI");
  assert.ok(!forAI.includes("Textaufgaben"), "no free-text profile notes go to the AI");
  assert.match(forAI, /Schulstufe 7/);
  assert.match(forAI, /mathe\.brueche\.dividieren: Dividieren – 0\.\d+, (kritisch|üben)/);

  const { id } = await builder.createDraft(settings({ studentId: sid, difficulty: "automatisch", categories: ["rechnung", "fehler", "ordnen"], count: 6 }), niko.id);
  const w = repo.getWorksheet(id)!;
  assert.equal(w.status, "entwurf");
  assert.equal(w.student_id, sid);
  assert.equal(w.title, "Max – Bruchrechnung: Dividieren › Kehrwert korrekt bilden");
  const tasks = repo.listTasks(id);
  assert.equal(tasks.length, 6);
  assert.ok(tasks.every((t) => t.skillId === KEHRWERT));
  assert.ok(tasks.every((t) => (t.skillIds ?? []).includes(KEHRWERT)));
  const ctxNow = builder.studentContext(sid)!;
  const expected = (await import("./curriculum")).difficultyFor(ctxNow.mastery[DIVIDIEREN]);
  assert.ok(tasks.every((t) => t.difficulty === expected), `automatic difficulty uses the parent's progress (${expected})`);
  assert.deepEqual([...new Set(tasks.map((t) => t.category))].sort(), ["fehler", "ordnen", "rechnung"]);
  assert.ok(tasks.some((t) => t.type === "order"));
  for (const t of tasks) assert.equal(builder.checkTask(t), null, `task ${t.position} is complete: ${t.prompt}`);
  assert.equal(repo.listAssignments(sid).filter((a) => a.worksheet_id === id).length, 0, "students never get drafts");
});

test("the preview editor: edit, reorder, delete, add, regenerate; release checks and assigns", async () => {
  const { repo, builder, niko, newStudent, settings } = await setup();
  const sid = newStudent("Lea Beispiel");
  const { id } = await builder.createDraft(settings({ studentId: sid, count: 3 }), niko.id);
  let tasks = repo.listTasks(id);
  const [a, b, c] = tasks.map((t) => t.id);

  repo.moveTask(c, -1);
  assert.deepEqual(repo.listTasks(id).map((t) => t.id), [a, c, b]);
  repo.deleteTask(a);
  assert.deepEqual(repo.listTasks(id).map((t) => [t.id, t.position]), [[c, 1], [b, 2]]);

  const blank = builder.blankTask("order", KEHRWERT, "ordnen", "leicht");
  const nid = repo.addTask(id, blank, c);
  assert.deepEqual(repo.listTasks(id).map((t) => t.id), [c, nid, b]);
  assert.match(builder.releaseWorksheet(id, sid).error ?? "", /Aufgabe 2: Die Aufgabenstellung fehlt/);
  assert.equal(repo.getWorksheet(id)!.status, "entwurf");

  const filled = builder.normalizeTask({ ...blank, prompt: "Ordne die Schritte.", answer: { steps: ["Kehrwert bilden", "Multiplizieren", "Kürzen"] }, hints: ["Was kommt zuerst?", " ", "Beginne mit dem Kehrwert."], skillIds: [KEHRWERT, DIVIDIEREN] });
  assert.deepEqual(filled.hints, ["Was kommt zuerst?", "Beginne mit dem Kehrwert."]);
  assert.equal(filled.data.steps!.length, 3);
  assert.notDeepEqual(filled.data.steps, filled.answer.steps);
  repo.updateTask(nid, filled);
  const saved = repo.getTask(nid)!;
  assert.deepEqual(saved.skillIds?.sort(), [DIVIDIEREN, KEHRWERT].sort(), "a task can train several skills");
  assert.ok(repo.getWorksheet(id)!.skill_ids.includes(DIVIDIEREN), "the exercise lists every skill of its tasks");

  const before = repo.getTask(b)!.prompt;
  const re = await builder.regenerateTask(b, { difficulty: "schwer" });
  assert.equal(re.ok, true);
  assert.equal(repo.getTask(b)!.difficulty, "schwer");
  assert.equal(repo.getTask(b)!.position, 3, "regenerating keeps the place");
  assert.notEqual(repo.getTask(b)!.prompt === before && repo.getTask(b)!.difficulty === "mittel", true);

  const out = builder.releaseWorksheet(id, sid);
  assert.equal(out.error, undefined);
  assert.equal(repo.getWorksheet(id)!.status, "freigegeben");
  const asg = repo.listAssignments(sid).find((x) => x.worksheet_id === id)!;
  assert.ok(asg, "released and sent to the student");
  assert.equal(repo.getAssignment(asg.id)!.solutions_visible, 0, "solutions are hidden by default");
  repo.setSolutionsVisible(asg.id, true);
  assert.equal(repo.getAssignment(asg.id)!.solutions_visible, 1);
  tasks = repo.listTasks(id);
  assert.equal(tasks.length, 3);
});

test("a regenerated task takes the origin of its new content, not the old source and licence", async () => {
  const { repo, builder } = await setup();
  const { saveSource, getSource } = await import("./lehrplan");
  const { db } = await import("./db");
  const oer = saveSource({ key: "oer-neu-erstellen", name: "OER-Blatt", source_type: "oer", license: "CC BY 4.0" });
  const draft = (prompt: string, o: { sourceType: string; sourceId?: number }) =>
    ({ type: "calc" as const, skillId: KEHRWERT, difficulty: "mittel" as const, prompt, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [], ...o });
  // an exercise made with Claude, holding an imported OER task and a Claude task
  const w = repo.createWorksheet(
    { title: "Gemischt", subject: "Mathematik", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "ki", skill_ids: [KEHRWERT] },
    [draft("Kehrwert von 2/3?", { sourceType: "oer", sourceId: oer }), draft("Kehrwert von 4/5?", { sourceType: "ki" })],
  );
  const [imported, ki] = repo.listTasks(w);
  const itemId = db().prepare("INSERT INTO source_items (source_id, item_id) VALUES (?, 'blatt-1')").run(oer).lastInsertRowid;
  db().prepare("UPDATE tasks SET source_item_id = ? WHERE id = ?").run(itemId, imported.id);
  for (const t of [imported, ki]) {
    assert.equal((await builder.regenerateTask(t.id, { useAI: false })).ok, true);
    const now = repo.getTask(t.id)!;
    assert.deepEqual([now.sourceType, now.sourceId], ["eigen", getSource("lernheft")!.id], "generator content is the app's own");
  }
  const item = db().prepare("SELECT source_item_id FROM tasks WHERE id = ?").get(imported.id) as { source_item_id: number | null };
  assert.equal(item.source_item_id, null, "and no longer an item of the OER source");
});

test("a task keeps its origin over a restart; only the upgrade that adds the column takes it from the exercise", async () => {
  const { openDatabase } = await import("./db");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-herkunft-"));
  const file = path.join(dir, "alt.db");
  let conn = openDatabase(file);
  const ws = conn.prepare("INSERT INTO worksheets (title, subject, grade, difficulty, task_type, source) VALUES ('Mit Claude', 'Mathematik', 7, 'mittel', 'calc', 'ki')").run().lastInsertRowid;
  const id = conn.prepare("INSERT INTO tasks (worksheet_id, position, type, difficulty, prompt) VALUES (?, 1, 'calc', 'mittel', 'Kehrwert von 2/3?')").run(ws).lastInsertRowid;
  // the state before tasks had an origin
  conn.exec("ALTER TABLE tasks DROP COLUMN source_type");
  conn.close();
  conn = openDatabase(file);
  const origin = () => (conn.prepare("SELECT source_type FROM tasks WHERE id = ?").get(id) as { source_type: string }).source_type;
  assert.equal(origin(), "ki", "on the upgrade: a task of an exercise made with Claude");
  // e.g. generator content after "Neu erstellen", or the teacher set it in the library
  conn.prepare("UPDATE tasks SET source_type = 'eigen' WHERE id = ?").run(id);
  conn.close();
  conn = openDatabase(file);
  assert.equal(origin(), "eigen", "a later start does not change it back");
  conn.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("hints used, sub-skill progress rolls up, unit link, reuse and templates", async () => {
  const { repo, builder, niko, newStudent, settings } = await setup();
  const units = await import("./units");
  const { submitAnswer } = await import("./service");
  const sid = newStudent("Tom Probe");
  const other = newStudent("Ida Probe");
  const unit = units.startUnit(niko.id, sid).unit;
  const { id } = await builder.createDraft(settings({ studentId: sid, count: 2, categories: ["rechnung"] }), niko.id);
  const { assignmentId } = builder.releaseWorksheet(id, sid);
  assert.ok(assignmentId);
  assert.equal(repo.getAssignment(assignmentId!)!.unit_id, unit.id, "the assignment belongs to the running tutoring unit");
  const token = repo.getStudent(sid)!.access_token;
  const [t1, t2] = repo.listTasks(id);

  repo.recordHintUse({ assignment_id: assignmentId!, task_id: t1.id, student_id: sid, hint_index: 0, unit_id: unit.id });
  repo.recordHintUse({ assignment_id: assignmentId!, task_id: t1.id, student_id: sid, hint_index: 0, unit_id: unit.id });
  repo.recordHintUse({ assignment_id: assignmentId!, task_id: t1.id, student_id: sid, hint_index: 1, unit_id: unit.id });
  assert.deepEqual(repo.hintUsesForAssignment(assignmentId!).map((h) => h.hint_index), [0, 1], "each hint is stored once");

  const right = (t: typeof t1) => t.answer.accepted?.[0] ?? String(t.answer.correct ?? "");
  const r1 = await submitAnswer({ token, assignmentId: assignmentId!, taskId: t1.id, answer: right(t1), timeMs: 20000, hintsUsed: 2 });
  const r2 = await submitAnswer({ token, assignmentId: assignmentId!, taskId: t2.id, answer: right(t2), timeMs: 20000, hintsUsed: 0 });
  assert.equal(r1.correct, true);
  assert.equal(r2.correct, true);
  const attempts = repo.listAttemptsForStudent(sid);
  assert.ok(attempts.every((x) => x.unit_id === unit.id));
  assert.ok(attempts.every((x) => x.skill_ids?.includes(KEHRWERT) && x.skill_ids?.includes(DIVIDIEREN)), "sub-skill answers count for the parent skill too");
  const analysis = (await import("./service")).analyzeStudent(sid)!;
  const parent = analysis.skills.find((s) => s.skill.id === DIVIDIEREN)!;
  const sub = analysis.skills.find((s) => s.skill.id === KEHRWERT)!;
  assert.ok(parent.mastery !== null && sub.mastery !== null, "both the sub-skill and its parent have progress");

  // edits after answers are not done in place; "Anpassen" makes a copy
  assert.ok(repo.worksheetAttemptCount(id) > 0);
  const copy = builder.copyAsDraft(id, other, niko.id)!;
  assert.equal(repo.getWorksheet(copy)!.status, "entwurf");
  assert.equal(repo.getWorksheet(copy)!.title, repo.getWorksheet(id)!.title.replace("Tom", "Ida"));
  assert.equal(repo.getWorksheet(copy)!.source_worksheet_id, id);
  assert.equal(repo.listTasks(copy).length, 2);

  // one task to a student
  const single = builder.sendSingleTask(t1.id, other, niko.id);
  assert.ok(single.worksheetId);
  assert.equal(repo.listTasks(single.worksheetId!).length, 1);
  assert.ok(repo.listAssignments(other).some((a) => a.worksheet_id === single.worksheetId));

  // reuse a single task from the task bank
  const found = repo.searchTasks({ skillIds: [KEHRWERT], subject: "Mathematik", excludeWorksheetId: copy });
  assert.ok(found.length > 0 && found[0].skillIds?.includes(KEHRWERT));

  // templates: with fixed tasks, and settings only
  const fixed = builder.saveTemplate(id, "Bruchrechnung – 15 Minuten Wiederholung", true, niko.id)!;
  const fresh = builder.saveTemplate(id, "Kehrwert neu", false, niko.id)!;
  const a = await builder.draftFromTemplate(fixed, other, niko.id);
  assert.equal(repo.getWorksheet(a.id!)!.title, "Ida – Bruchrechnung – 15 Minuten Wiederholung");
  assert.deepEqual(repo.listTasks(a.id!).map((t) => t.prompt), [t1.prompt, t2.prompt]);
  const b = await builder.draftFromTemplate(fresh, other, niko.id);
  assert.equal(repo.listTasks(b.id!).length, 2, "the template remembers the number of tasks");
  assert.equal(repo.getWorksheet(b.id!)!.student_id, other);
  assert.equal(repo.getTemplate(fixed)!.used_count, 1);
});
