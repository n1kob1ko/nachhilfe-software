import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

const ZEITEN = "deutsch.grammatik.zeiten";

async function setup(name: string, tasks: import("./tasks").TaskDraft[]) {
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const { submitAnswer } = await import("./service");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name, grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "Gymnasium", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const wid = repo.createWorksheet({ title: "Zeitformen", subject: "Deutsch", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "Zeitformen", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [ZEITEN] }, tasks);
  const aid = repo.assignWorksheet(wid, sid);
  const saved = repo.listTasks(wid);
  let n = 0;
  const answer = (taskId: number, text: string, submissionId = `uebungstyp-${name.replace(/\W/g, "")}-${String(++n).padStart(6, "0")}`) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId, answer: text, timeMs: 30_000, hintsUsed: 0, submissionId });
  return { repo, niko, sid, aid, tasks: saved, answer };
}

const draft = (o: Partial<import("./tasks").TaskDraft> & Pick<import("./tasks").TaskDraft, "type" | "prompt" | "answer">): import("./tasks").TaskDraft => ({
  skillId: ZEITEN, skillIds: [ZEITEN], difficulty: "mittel", data: {}, solution: "", hints: [], errorMap: [], ...o,
});

const CLOZE = draft({
  type: "cloze",
  category: "lueckentext",
  prompt: "Gestern ___ ich mit meinen Freunden im Park. Danach ___ wir ein Eis ___.",
  answer: { blanks: [["war", "spielte"], ["haben"], ["gegessen"]], mode: "exact" },
});
const FIX = draft({
  type: "fix",
  category: "korrigieren",
  prompt: "Im Text sind Fehler. Schreibe ihn richtig.",
  data: { faulty: "Gestern bin ich mit meinen Freund in den Park gegangen. Wir haben Fussball gespielt weil das Wetter schön war." },
  answer: {
    accepted: [
      "Gestern bin ich mit meinem Freund in den Park gegangen. Wir haben Fußball gespielt, weil das Wetter schön war.",
      "Gestern bin ich mit meinem Freund in den Park gegangen. Wir haben Fussball gespielt, weil das Wetter schön war.",
    ],
    mode: "exact",
    fixes: [{ wrong: "meinen", right: "meinem", label: "Dativ nach „mit“", errorType: "grammatik" }],
    criteria: ["Dativ nach „mit“", "Beistrich vor „weil“"],
  },
});
const FREE = draft({
  type: "free",
  category: "offen",
  prompt: "Erkläre, warum sich die Hauptfigur am Ende der Geschichte anders verhält.",
  data: { lines: 6 },
  answer: { sample: "Sie hat gemerkt, dass ihre Freunde ihr helfen.", criteria: ["nennt einen Grund aus der Geschichte", "begründet mit „weil“ oder „denn“"] },
});

test("Lückentext: several gaps, other right answers, case as the task says, wrong gaps named", async () => {
  const { checkAnswer } = await import("./tasks");
  assert.equal(checkAnswer(CLOZE, JSON.stringify(["war", "haben", "gegessen"])).correct, true);
  assert.equal(checkAnswer(CLOZE, JSON.stringify(["spielte", "haben", "gegessen"])).correct, true, "another right answer for gap 1");
  const half = checkAnswer(CLOZE, JSON.stringify(["war", "hatten", "gegessen"]));
  assert.equal(half.correct, false);
  assert.deepEqual(half.wrongGaps, [2], "only the wrong gap is marked");
  assert.equal(checkAnswer(CLOZE, JSON.stringify(["War", "haben", "gegessen"])).correct, false, "case counts when the task says so");
  assert.equal(checkAnswer({ ...CLOZE, answer: { ...CLOZE.answer, mode: "text" } }, JSON.stringify(["War", "haben", " gegessen "])).correct, true, "case ignored when the task says so");
});

test("Fehler korrigieren: the student rewrites the text; fixed, missed and extra changes are told apart", async () => {
  const { checkAnswer } = await import("./tasks");
  const { checkFix } = await import("./fix-text");
  const right = FIX.answer.accepted![0];
  assert.equal(checkAnswer(FIX, right).correct, true);
  assert.equal(checkAnswer(FIX, FIX.answer.accepted![1]).correct, true, "another accepted version");
  assert.equal(checkAnswer(FIX, right.replace(/\s+/g, "  ")).correct, true, "spaces do not count");

  const unchanged = checkAnswer(FIX, FIX.data.faulty!);
  assert.equal(unchanged.correct, false);
  // compared with the closest right version (the one that accepts "Fussball"): two errors
  assert.match(unchanged.feedback, /0 von 2 Fehlern/);

  // one of three corrected, nothing else touched
  const one = "Gestern bin ich mit meinem Freund in den Park gegangen. Wir haben Fussball gespielt weil das Wetter schön war.";
  const r = checkFix(FIX.data.faulty!, FIX.answer.accepted!, one, { labels: FIX.answer.fixes });
  assert.equal(r.correct, false);
  // closest version: the one that keeps "Fussball", so only the comma is missing
  assert.equal(r.fixed, 1);
  assert.equal(r.missed.length, 1);
  assert.equal(r.extra, 0);

  // the error is not corrected but something right is changed
  const wrong = "Gestern war ich mit meinen Freund in den Park gegangen. Wir haben Fußball gespielt, weil das Wetter schön war.";
  const w = checkFix(FIX.data.faulty!, FIX.answer.accepted!, wrong, { labels: FIX.answer.fixes });
  assert.equal(w.missed[0].wrong, "meinen");
  assert.equal(w.missed[0].label, "Dativ nach „mit“", "the teacher's description of the error");
  assert.equal(w.extra, 1, "„bin“ → „war“ was right before");
  const res = checkAnswer(FIX, wrong);
  assert.equal(res.errorLabel, "Dativ nach „mit“");
  assert.equal(res.errorType, "grammatik");
  assert.match(res.feedback, /2 von 3 Fehlern/);
  assert.match(res.feedback, /richtig war/);
});

test("Fehler korrigieren in the app: original and answer are kept, three tries, the Fehlerart comes from the task", async () => {
  const { tasks, answer, repo, aid } = await setup("Fix Test", [FIX]);
  const t = tasks[0];
  const first = await answer(t.id, t.data.faulty!.replace("meinen", "meinem"));
  assert.equal(first.correct, false);
  assert.equal(first.final, false);
  const a = repo.listAttemptsForAssignment(aid)[0];
  assert.equal(a.answer, t.data.faulty!.replace("meinen", "meinem"), "the student's text is stored as written");
  assert.equal(repo.getTask(t.id)!.data.faulty, FIX.data.faulty, "the original stays unchanged");
  const done = await answer(t.id, FIX.answer.accepted![0]);
  assert.equal(done.correct, true);
  assert.equal(done.final, true);
  assert.equal(done.expected, FIX.answer.accepted![0], "the right text to compare with");
  const wrongTry = repo.listAttemptsForAssignment(aid)[0];
  assert.equal(wrongTry.error_type, null, "the missing comma has no described Fehlerart");
});

test("Freie Antwort: saved for the teacher, counted only after the grade; teilweise counts half", async () => {
  const { tasks, answer, repo, niko, sid, aid } = await setup("Frei Test", [FREE, FREE, FREE]);
  const { reviewAnswer, analyzeStudent } = await import("./service");
  const { taskScore } = await import("./mastery");
  const text = "Am Anfang ist sie allein und traut sich nichts zu. Am Ende hilft ihr ihre Freundin. Deshalb ist sie mutiger geworden, weil sie nicht mehr allein ist.";
  const sid1 = "frei-abgabe-000000000001";
  const r = await answer(tasks[0].id, text, sid1);
  assert.equal(r.pendingReview, true);
  assert.equal(r.correct, null, "never wrong just because it is worded differently");
  assert.equal(r.final, true);
  assert.match(r.sample!, /Freunde/);
  const again = await answer(tasks[0].id, text, sid1);
  assert.deepEqual(again, r, "the same submission again: same result");
  assert.equal(repo.listAttemptsForAssignment(aid).length, 1, "stored once");
  assert.equal(repo.listAttemptsForStudent(sid).length, 0, "does not count for Lernstand yet");
  assert.equal(repo.pendingReviews({ studentId: sid }).length, 1);
  assert.equal(analyzeStudent(sid)!.skills.find((s) => s.skill.id === ZEITEN)?.mastery ?? null, null, "nothing measured yet");

  await answer(tasks[1].id, "Weil sie mutiger ist.");
  await answer(tasks[2].id, "Weiß ich nicht.");
  const [c, b, a] = repo.pendingReviews({ studentId: sid });
  assert.ok("ok" in reviewAnswer(a.id, "richtig", niko.id));
  assert.ok("ok" in reviewAnswer(b.id, "teilweise", niko.id));
  assert.ok("ok" in reviewAnswer(c.id, "falsch", niko.id));
  assert.ok("error" in reviewAnswer(c.id, "super", niko.id), "only richtig, teilweise, falsch");
  assert.equal(repo.pendingReviews({ studentId: sid }).length, 0);
  const counted = repo.listAttemptsForStudent(sid);
  assert.equal(counted.length, 3);
  const byId = new Map(counted.map((x) => [x.id, x]));
  assert.equal(taskScore(byId.get(a.id)!), 1);
  assert.equal(taskScore(byId.get(b.id)!), 0.5);
  assert.equal(taskScore(byId.get(c.id)!), 0);
  assert.equal(byId.get(a.id)!.review_by, niko.id);
  const m = analyzeStudent(sid)!.skills.find((s) => s.skill.id === ZEITEN)!.mastery!;
  assert.ok(m > 0.4 && m < 0.6, `one right, one half, one wrong: about the middle (${m})`);
  // a grade can be changed
  assert.ok("ok" in reviewAnswer(c.id, "richtig", niko.id));
  assert.equal(repo.getAttempt(c.id)!.correct, 1);
});

test("a task the app checks itself cannot be graded by the teacher, an unfinished try neither", async () => {
  const { tasks, answer, repo, niko, aid } = await setup("Kein Lehrer", [CLOZE, FIX]);
  const { reviewAnswer } = await import("./service");
  await answer(tasks[0].id, JSON.stringify(["war", "haben", "gegessen"]));
  const cloze = repo.listAttemptsForAssignment(aid)[0];
  assert.ok("error" in reviewAnswer(cloze.id, "falsch", niko.id));
  await answer(tasks[1].id, FIX.data.faulty!.replace("meinen", "meinem"));
  const open = repo.listAttemptsForAssignment(aid).find((x) => x.task_id === tasks[1].id)!;
  assert.ok("error" in reviewAnswer(open.id, "richtig", niko.id), "the student still has tries left");
});

test("Gemischte Aufgaben: each skill gets its fitting types in turn, little multiple choice", async () => {
  const { planSlots } = await import("./builder");
  const { categoriesFor } = await import("./curriculum");
  const { getSkill } = await import("./repo");
  const skill = { skill: getSkill(ZEITEN)!, parent: null, difficulty: "mittel" as const };
  const plan = planSlots("Deutsch", [skill], [], 10);
  const kinds = plan.map((p) => p.category);
  for (const k of ["lueckentext", "korrigieren", "offen"]) assert.ok(kinds.includes(k), `${k} is in the mix`);
  assert.equal(kinds.filter((k) => k === "mc").length, 0);
  // chosen types: exactly these, in equal parts
  const two = planSlots("Deutsch", [skill], categoriesFor("Deutsch").filter((c) => c.key === "lueckentext" || c.key === "korrigieren"), 10).map((p) => p.category);
  assert.equal(two.filter((k) => k === "lueckentext").length, 5);
  assert.equal(two.filter((k) => k === "korrigieren").length, 5);
});

test("without AI: chosen types come in exactly that format from the generators", async () => {
  const builder = await import("./builder");
  const base = { studentId: null, subject: "Deutsch", schoolType: "Gymnasium", klasse: 3, skillIds: [ZEITEN], difficulty: "mittel" as const, count: 10, focus: "", useAI: false, title: "" };
  const { tasks, source } = await builder.generateTasks({ ...base, categories: ["lueckentext", "korrigieren"] }, null);
  assert.equal(source, "generator");
  assert.equal(tasks.filter((t) => t.type === "cloze").length, 5);
  assert.equal(tasks.filter((t) => t.type === "fix").length, 5);
  for (const t of tasks) assert.equal(builder.checkTask(t), null, `complete: ${t.prompt}`);
  const fix = tasks.find((t) => t.type === "fix")!;
  const { checkAnswer } = await import("./tasks");
  assert.equal(checkAnswer(fix, fix.answer.accepted![0]).correct, true);
  assert.equal(checkAnswer(fix, fix.data.faulty!).correct, false);
  const mixed = await builder.generateTasks({ ...base, categories: [] }, null);
  assert.ok(new Set(mixed.tasks.map((t) => t.type)).size >= 3, "mixed means different formats");
  assert.ok(mixed.tasks.filter((t) => t.type === "mc").length <= 2);
});

test("with AI: five Lückentexte asked for are five real Lückentexte; multiple choice is not accepted instead", async () => {
  const r = await import("./ai/router");
  const builder = await import("./builder");
  const aiTask = (o: Record<string, unknown>) => ({
    category: "lueckentext", format: "cloze", skill_ids: [ZEITEN], topic: "Zeitformen", difficulty: "mittel", prompt: "", passage: null, options: null, correct_option: null,
    accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null, case_sensitive: true, faulty_text: null, corrected_text: null, text_errors: null,
    answer_lines: null, criteria: ["Perfekt mit „sein“ bei Bewegung"], solution: "Perfekt: sein/haben + Partizip II.", solution_steps: [], estimated_time_sec: 60, hints: ["Welche Zeit verlangt die Klammer?"], common_errors: [],
    ...o,
  });
  const requests: string[] = [];
  r.resetRouter();
  r.setTransport(async (p) => {
    requests.push(typeof p.content === "string" ? p.content : JSON.stringify(p.content));
    const tasks =
      requests.length === 1
        ? [
            aiTask({ prompt: "Gestern ___ ich ins Kino ___. (gehen, Perfekt)", blanks: [["bin"], ["gegangen"]] }),
            aiTask({ prompt: "Welche Form ist richtig?", format: "mc", options: ["bin gegangen", "habe gegangen"], correct_option: 0, blanks: null }),
            aiTask({ prompt: "Wir ___ lange ___. (schlafen, Perfekt)", blanks: [["haben"], ["geschlafen"]] }),
            aiTask({ prompt: "Ergänze: Sie ___ nach Hause. (laufen, Präteritum)", options: ["lief", "läuft"], correct_option: 0, blanks: null }),
            aiTask({ prompt: "Er ___ das Buch ___. (lesen, Perfekt)", blanks: [["hat"], ["gelesen"]] }),
          ]
        : [
            aiTask({ prompt: "Ihr ___ zu spät ___. (kommen, Perfekt)", blanks: [["seid"], ["gekommen"]] }),
            aiTask({ prompt: "Du ___ mir ___. (helfen, Perfekt)", blanks: [["hast"], ["geholfen"]] }),
          ];
    return { parsed: { tasks }, refusal: false, model: p.model, usage: { input: 1000, output: 1000, cacheWrite: 0, cacheRead: 0 } };
  });
  const out = await builder.generateTasks({ studentId: null, subject: "Deutsch", schoolType: "Gymnasium", klasse: 3, skillIds: [ZEITEN], difficulty: "mittel", count: 5, categories: ["lueckentext"], focus: "", useAI: true, title: "" }, null);
  r.setTransport(null);
  r.resetRouter();
  assert.equal(out.source, "ki");
  assert.equal(out.tasks.length, 5);
  assert.ok(out.tasks.every((t) => t.type === "cloze" && t.category === "lueckentext"), out.tasks.map((t) => t.type).join(","));
  assert.ok(!out.tasks.some((t) => t.data.options), "no answer options in a Lückentext");
  assert.equal(requests.length, 2, "the two missing ones were asked for once more");
  assert.match(requests[0], /Aufgabenplan/);
  const t = out.tasks[0];
  assert.deepEqual(t.answer.criteria, ["Perfekt mit „sein“ bei Bewegung"], "criteria are stored with the task");
  assert.equal(t.answer.mode, "exact");
});

test("with AI: a correction task keeps the faulty and the corrected text and the described errors", async () => {
  const { aiTaskToDraft } = await import("./ai");
  const { categoriesFor } = await import("./curriculum");
  const { checkAnswer } = await import("./tasks");
  const cats = categoriesFor("Deutsch");
  const wanted = cats.find((c) => c.key === "korrigieren")!;
  const t = aiTaskToDraft(
    {
      category: "korrigieren", format: "fix", skill_ids: ["deutsch.grammatik.faelle"], topic: "Fälle", difficulty: "mittel", prompt: "Verbessere den Satz.", passage: null, options: ["a", "b"], correct_option: 0,
      accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null, case_sensitive: true,
      faulty_text: "Gestern bin ich mit meinen Freund in den Park gegangen.", corrected_text: "Gestern bin ich mit meinem Freund in den Park gegangen.",
      text_errors: [{ wrong: "meinen", right: "meinem", label: "Dativ nach „mit“", error_type: "grammatik" }], answer_lines: 2, criteria: ["Dativ nach „mit“"],
      solution: "Nach „mit“ steht der Dativ.", solution_steps: [], estimated_time_sec: 60, hints: [], common_errors: [],
    },
    { subject: "Deutsch", skills: [{ id: "deutsch.grammatik.faelle", name: "Fälle", area: "Grammatik", difficulty: "mittel" }], categories: cats },
    Math.random,
    wanted,
  )!;
  assert.equal(t.type, "fix", "answer options sent along do not turn it into multiple choice");
  assert.equal(t.data.options, undefined);
  assert.equal(t.data.faulty, "Gestern bin ich mit meinen Freund in den Park gegangen.");
  assert.equal(t.answer.fixes?.[0].label, "Dativ nach „mit“");
  assert.equal(checkAnswer(t, "Gestern bin ich mit meinem Freund in den Park gegangen.").correct, true);
  // a "correction" without a corrected text is not a correction task
  const broken = aiTaskToDraft({ category: "korrigieren", format: "mc", skill_ids: [], topic: "", difficulty: "mittel", prompt: "Was ist falsch?", passage: null, options: ["a", "b"], correct_option: 0, accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null, answer_lines: null, criteria: [], solution: "", solution_steps: [], estimated_time_sec: 30, hints: [], common_errors: [] }, { subject: "Deutsch", skills: [], categories: cats }, Math.random, wanted);
  assert.equal(broken, null);
});

test("A4: room to write for free answers and corrections, criteria only in the teacher version", async () => {
  const { planTask } = await import("./arbeitsblatt");
  const o = { space: "mittel" as const, field: "auto" as const };
  assert.ok(planTask(FIX, "Deutsch", o).lines >= 3, "the corrected text is written out again");
  assert.equal(planTask({ ...FREE, data: { lines: 1 } }, "Deutsch", o).lines, 1);
  assert.equal(planTask(FREE, "Deutsch", o).lines, 6, "as many lines as the teacher chose");
  assert.ok(planTask(FREE, "Deutsch", { ...o, space: "gross" }).lines > planTask(FREE, "Deutsch", { ...o, space: "klein" }).lines);
  const cloze = planTask(CLOZE, "Deutsch", o);
  assert.equal(cloze.gapsMm.length, 3);
  assert.ok(cloze.gapsMm[0] >= cloze.gapsMm[1], "room for the longest right answer (spielte)");
});
