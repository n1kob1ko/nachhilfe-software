import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type Draft = import("./tasks").TaskDraft;
const GL = "mathe.gleichungen.einfach";
const BR = "mathe.brueche.addieren";
const PR = "mathe.prozent.prozentwert";

const draft = (o: Partial<Draft> & Pick<Draft, "type" | "prompt" | "answer">): Draft => ({ skillId: GL, skillIds: [GL], difficulty: "mittel", data: {}, solution: "", hints: [], errorMap: [], ...o });

const GLEICHUNG = draft({
  type: "rechenweg",
  category: "rechenweg",
  prompt: "Löse die Gleichung. Schreib jeden Rechenschritt in eine eigene Zeile.",
  data: { start: "3x + 7 = 22" },
  answer: { accepted: ["5"], needWay: true },
  solution: "3x + 7 = 22 | − 7\n3x = 15 | : 3\nx = 5",
  solutionSteps: ["3x = 15", "x = 5"],
});
const BRUCH = draft({
  type: "rechenweg",
  category: "rechenweg",
  skillId: BR,
  skillIds: [BR],
  prompt: "Berechne. Schreib jeden Rechenschritt in eine eigene Zeile.",
  data: { start: "1/2 + 1/4" },
  answer: { accepted: ["3/4"], needWay: true },
  solutionSteps: ["2/4 + 1/4", "3/4"],
});
const FAHRRAD = draft({
  type: "sachaufgabe",
  category: "sachaufgabe",
  skillId: PR,
  skillIds: [PR],
  prompt: "Ein Fahrrad kostet 480 €. Im Sonderangebot gibt es 15 % Rabatt.",
  data: {
    parts: [
      { label: "a)", prompt: "Wie viel Euro beträgt der Rabatt?", kind: "zahl" },
      { label: "b)", prompt: "Wie viel kostet das Fahrrad nach der Ermäßigung?", kind: "zahl" },
      { label: "c)", prompt: "Erkläre, wie du den neuen Preis berechnet hast.", kind: "text", lines: 3 },
    ],
  },
  answer: {
    parts: [
      { accepted: ["72 €"], unit: "€", solution: "480 € : 100 · 15 = 72 €" },
      { accepted: ["408 €"], unit: "€", follow: "480 - a", solution: "480 € − 72 € = 408 €" },
      { sample: "Ich habe zuerst 15 % von 480 € berechnet und den Rabatt dann vom Preis abgezogen." },
    ],
  },
});

const way = (steps: string[], result = "", board = false) => JSON.stringify({ steps, result, ...(board ? { board } : {}) });
const parts = (...p: { steps?: string[]; result?: string; text?: string }[]) => JSON.stringify({ parts: p });

async function setup(name: string, tasks: Draft[]) {
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const { submitAnswer } = await import("./service");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name, grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const wid = repo.createWorksheet({ title: "Rechenwege", subject: "Mathematik", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "Gleichungen", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [GL] }, tasks);
  const aid = repo.assignWorksheet(wid, sid);
  const saved = repo.listTasks(wid);
  let n = 0;
  const answer = (taskId: number, text: string, submissionId = `rechenweg-${name.replace(/\W/g, "")}-${String(++n).padStart(6, "0")}`) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId, answer: text, timeMs: 40_000, hintsUsed: 0, submissionId });
  return { repo, niko, sid, aid, wid, student, tasks: saved, answer };
}

// ---------- 1, 4, 5, 6: Rechenwege ----------

test("1. equation in several steps: every line and the result are checked", async () => {
  const { gradeMathTask } = await import("./math-task");
  const r = gradeMathTask(GLEICHUNG, way(["3x = 15", "x = 5"], "5"));
  assert.equal(r.check.correct, true);
  assert.deepEqual(r.view.steps!.map((s) => s.status), ["ok", "ok"]);
  assert.equal(r.view.way, "richtig");
  // the student may copy the equation first, write "x = 5" as the result and use the signs of the bar
  assert.equal(gradeMathTask(GLEICHUNG, way(["3x + 7 = 22", "3x = 22 − 7", "3x = 15", "x = 15 : 3", "x = 5"], "x = 5")).check.correct, true);
  // without a typed result the last line counts
  const fromWay = gradeMathTask(GLEICHUNG, way(["3x = 15", "x = 5"]));
  assert.equal(fromWay.check.correct, true);
  assert.equal(fromWay.view.result!.fromWay, true);
});

test("4. right result with a wrong line: not counted as right, the teacher decides", async () => {
  const { gradeMathTask } = await import("./math-task");
  const r = gradeMathTask(GLEICHUNG, way(["3x = 29", "x = 5"], "5"));
  assert.equal(r.check.correct, null, "neither right nor wrong: for the teacher");
  assert.equal(r.view.result!.status, "richtig");
  assert.equal(r.view.steps![0].status, "fehler");
  assert.match(r.check.feedback, /Zeile 1/);
  // no working at all: the right result alone is not enough when the task asks for the way
  assert.equal(gradeMathTask(GLEICHUNG, way([], "5")).check.correct, null);
  // done on the whiteboard: the teacher looks at it
  assert.match(gradeMathTask(GLEICHUNG, way([], "5", true)).check.feedback, /Whiteboard/);
  // without the need for a way the result is enough
  assert.equal(gradeMathTask({ ...GLEICHUNG, answer: { ...GLEICHUNG.answer, needWay: false } }, way([], "5")).check.correct, true);
});

test("5. wrong result with a partly right way: the first wrong line is named, the right lines stay right", async () => {
  const { gradeMathTask } = await import("./math-task");
  const r = gradeMathTask(GLEICHUNG, way(["3x = 15", "x = 3"], "3"));
  assert.equal(r.check.correct, false);
  assert.deepEqual(r.view.steps!.map((s) => s.status), ["ok", "fehler"]);
  assert.match(r.check.feedback, /Zeile 2/);
  // a sign error: the following lines are right with the error (Folgefehler), the error type is suggested
  const sign = gradeMathTask(GLEICHUNG, way(["3x = 22 + 7", "3x = 29", "x = 29/3"], "29/3"));
  assert.equal(sign.check.correct, false);
  assert.deepEqual(sign.view.steps!.map((s) => s.status), ["fehler", "folge", "folge"]);
  assert.equal(sign.check.errorType, "vorzeichen");
  // the last try with a partly right way stays wrong (the teacher can raise it to teilweise)
  assert.equal(sign.check.onFinal ?? null, null);
});

test("6. other right ways count: no fixed order of steps", async () => {
  const { gradeMathTask } = await import("./math-task");
  for (const steps of [
    ["3x = 15", "x = 5"],
    ["x + 7/3 = 22/3", "x = 22/3 - 7/3", "x = 15/3", "x = 5"],
    ["7 + 3x = 22", "3x = 22 - 7", "x = 15 : 3", "x = 5"],
    ["3x + 7 - 7 = 22 - 7 | −7", "3x / 3 = 15 / 3", "x = 5"],
  ])
    assert.equal(gradeMathTask(GLEICHUNG, way(steps, "5")).check.correct, true, steps.join(" → "));
  // a term: different common denominators are both right
  for (const steps of [["2/4 + 1/4", "3/4"], ["4/8 + 2/8", "6/8", "3/4"], ["0,5 + 0,25", "0,75"]])
    assert.equal(gradeMathTask(BRUCH, way(steps, "3/4")).check.correct, true, steps.join(" → "));
});

test("review before merge: no automatic 'falsch' for right working the app reads differently", async () => {
  const { gradeMathTask } = await import("./math-task");
  // side calculations in a term are right in themselves, not errors
  const sqrt = { ...BRUCH, data: { start: "sqrt(16) + 3^2" }, answer: { accepted: ["13"], needWay: true } };
  assert.deepEqual(gradeMathTask(sqrt, way(["sqrt(16) = 4", "3^2 = 9", "4 + 9 = 13"], "13")).view.steps!.map((s) => s.status), ["ok", "ok", "ok"]);
  assert.equal(gradeMathTask(BRUCH, way(["1/2 = 2/4", "2/4 + 1/4 = 3/4"], "3/4")).check.correct, true);
  assert.equal(gradeMathTask(BRUCH, way(["1/2 = 2/4", "2/4 + 1/4 = 3/8"], "3/8")).view.steps![1].status, "fehler", "a wrong line stays wrong");
  // the result written in the last line in other ways
  for (const last of ["L = {5}", "Lösung: x = 5", "5 = x"]) assert.equal(gradeMathTask(GLEICHUNG, way(["3x = 15", last])).check.correct, true, last);
  // no result found and the last line is words: the teacher decides, not "falsch"
  const words = gradeMathTask(GLEICHUNG, way(["3x = 15", "x ist dann fünf"]));
  assert.equal(words.check.correct, null);
  assert.equal(words.view.result!.status, "unklar");
  // stopping half way is still reliably no result
  assert.equal(gradeMathTask(GLEICHUNG, way(["3x = 15"])).check.correct, false);
  // a) not readable: b) built on it is for the teacher as well
  const two = { ...FAHRRAD, data: { parts: FAHRRAD.data.parts!.slice(0, 2) }, answer: { parts: FAHRRAD.answer.parts!.slice(0, 2) } };
  const r = gradeMathTask(two, parts({ result: "siebzig" }, { result: "410 €" }));
  assert.deepEqual(r.view.parts!.map((p) => p.status), ["offen", "offen"]);
  assert.equal(r.check.correct, null);
});

test("review before merge: resending, two devices and a second teacher grade never count twice", async () => {
  const { tasks, answer, repo, niko, sid, aid } = await setup("Rechenweg mehrfach", [GLEICHUNG, GLEICHUNG, GLEICHUNG]);
  const { reviewAnswer } = await import("./service");
  const counted = (taskId: number) => repo.listAttemptsForStudent(sid).filter((a) => a.task_id === taskId);
  const rows = (taskId: number) => repo.listAttemptsForAssignment(aid).filter((a) => a.task_id === taskId);
  await answer(tasks[0].id, way(["3x = 15", "x = 5"], "5"));
  const again = await answer(tasks[0].id, way(["3x = 15", "x = 3"], "3"));
  assert.match(again.feedback, /schon abgeschlossen/);
  assert.equal(counted(tasks[0].id).length, 1);
  // tablet and laptop send at the same time on the last tries
  const wrong = way(["3x = 15", "x = 3"], "3");
  await answer(tasks[1].id, wrong);
  await Promise.all([answer(tasks[1].id, wrong), answer(tasks[1].id, wrong), answer(tasks[1].id, way(["3x = 15", "x = 5"], "5"))]);
  assert.equal(rows(tasks[1].id).length, 3);
  assert.equal(rows(tasks[1].id).filter((a) => a.final).length, 1);
  // waiting for the teacher: a resend adds nothing, a second grade replaces the first
  await answer(tasks[2].id, way(["3x = 29", "x = 5"], "5"));
  await answer(tasks[2].id, way(["3x = 15", "x = 5"], "5"));
  assert.equal(rows(tasks[2].id).length, 1);
  const open = repo.pendingReviews({ studentId: sid })[0];
  reviewAnswer(open.id, "richtig", niko.id);
  reviewAnswer(open.id, "teilweise", niko.id);
  assert.deepEqual(counted(tasks[2].id).map((a) => a.review), ["teilweise"]);
});

// ---------- 2: equivalent results ----------

test("2. fractions: equivalent results are right, the form only counts when the task asks for it", async () => {
  const { gradeMathTask } = await import("./math-task");
  const ok = (r: string, t = BRUCH) => gradeMathTask(t, way(["2/4 + 1/4"], r)).check;
  assert.equal(ok("3/4").correct, true);
  assert.equal(ok("0,75").correct, true);
  assert.equal(ok("75 %").correct, true, "3/4 = 75 % when no form is asked for");
  assert.equal(ok("6/8").correct, true, "not reduced but equal: right when no form is asked for");
  const reduced = { ...BRUCH, answer: { ...BRUCH.answer, form: "gekuerzt" as const } };
  const notReduced = ok("6/8", reduced);
  assert.equal(notReduced.correct, false);
  assert.equal(notReduced.onFinal, "teilweise", "the value is right: half on the last try");
  assert.equal(ok("2/3").correct, false);
  const { checkValue } = await import("./math-check");
  assert.equal(checkValue("1/2", { accepted: ["0,5"] }).status, "richtig");
  assert.equal(checkValue("50 %", { accepted: ["1/2"] }).status, "richtig");
  assert.equal(checkValue("0,33", { accepted: ["1/3"], round: 2 }).status, "richtig", "rounded as asked");
  const slip = checkValue("0,34", { accepted: ["1/3"], round: 2 });
  assert.deepEqual([slip.status, slip.issue], ["falsch", "rundung"], "rounded the wrong way: wrong, and the feedback says why");
  assert.equal(checkValue("7200 ct", { accepted: ["72 €"], unit: "€" }).status, "richtig", "units are converted");
  assert.equal(checkValue("72", { accepted: ["72 €"], unit: "€" }).status, "teilweise", "unit missing");
  assert.equal(checkValue("72 kg", { accepted: ["72 €"], unit: "€" }).status, "falsch", "wrong unit");
  assert.equal(checkValue("x = 2 oder x = 3", { accepted: ["2; 3"] }).status, "richtig", "two solutions in any order");
});

// ---------- 3: Sachaufgabe ----------

test("3. percent task with three parts: each part graded, Folgefehler counted, words go to the teacher", async () => {
  const { gradeMathTask } = await import("./math-task");
  const all = gradeMathTask(FAHRRAD, parts({ steps: ["480 : 100 = 4,8", "4,8 · 15 = 72"], result: "72 €" }, { steps: ["480 - 72 = 408"], result: "408 €" }, { text: "Ich ziehe den Rabatt vom Preis ab." }));
  assert.deepEqual(all.view.parts!.map((p) => p.status), ["richtig", "richtig", "offen"]);
  assert.equal(all.check.correct, null, "the answer in words: the teacher grades the rest");
  // a) wrong, b) right with the student's own a): Folgefehler
  const follow = gradeMathTask(FAHRRAD, parts({ result: "70 €" }, { steps: ["480 − 70 = 410"], result: "410 €" }, { text: "Preis minus Rabatt." }));
  assert.deepEqual(follow.view.parts!.map((p) => p.status), ["falsch", "folge", "offen"]);
  assert.equal(follow.check.correct, false, "a) is wrong: try again");
  // number parts and a missing unit
  const unit = gradeMathTask(FAHRRAD, parts({ result: "72" }, { result: "408 €" }, { text: "So." }));
  assert.equal(unit.view.parts![0].status, "teilweise");
  // only number parts: all right is right
  const two = { ...FAHRRAD, data: { parts: FAHRRAD.data.parts!.slice(0, 2) }, answer: { parts: FAHRRAD.answer.parts!.slice(0, 2) } };
  assert.equal(gradeMathTask(two, parts({ result: "72 €" }, { result: "408 €" })).check.correct, true);
  // the last try with one of two right: teilweise
  assert.equal(gradeMathTask(two, parts({ result: "72 €" }, { result: "400 €" })).check.onFinal, "teilweise");
});

// ---------- 7, 8, 10: service, teacher, tracking, saving ----------

test("7 + 8. the teacher grades what the app cannot check safely; only reliable grades count for the Lernstand", async () => {
  const { tasks, answer, repo, niko, sid, aid } = await setup("Rechenweg Lehrer", [GLEICHUNG, GLEICHUNG, FAHRRAD]);
  const { reviewAnswer } = await import("./service");
  const { taskScore } = await import("./mastery");
  // right result, wrong line: saved for the teacher, counts nowhere yet
  const r = await answer(tasks[0].id, way(["3x = 29", "x = 5"], "5"));
  assert.equal(r.correct, null);
  assert.equal(r.pendingReview, true);
  assert.equal(r.final, true);
  assert.equal(r.math?.steps?.[0].status, "fehler", "the student sees which line does not fit");
  assert.equal(repo.listAttemptsForStudent(sid).length, 0, "not in the Lernstand");
  const pending = repo.pendingReviews({ studentId: sid });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].error_type_source, "vorschlag", "a suggested Fehlerart, not confirmed");
  // a wrong result with a clear error: counted as wrong, its Fehlerart only suggested
  const w = await answer(tasks[1].id, way(["3x = 22 + 7", "3x = 29"], "29/3"));
  assert.equal(w.correct, false);
  assert.equal(w.final, false, "two more tries");
  assert.equal(w.math?.steps?.[0].status, "fehler");
  const wrongTry = repo.listAttemptsForAssignment(aid).find((a) => a.task_id === tasks[1].id)!;
  assert.equal(wrongTry.error_type, "vorzeichen");
  assert.equal(wrongTry.error_type_source, "vorschlag");
  const ok = await answer(tasks[1].id, way(["3x = 15", "x = 5"], "5"));
  assert.equal(ok.correct, true);
  // the Sachaufgabe with words: the number parts are checked, the whole waits for the teacher
  const s = await answer(tasks[2].id, parts({ result: "72 €" }, { result: "408 €" }, { text: "Rabatt abziehen." }));
  assert.equal(s.pendingReview, true);
  assert.deepEqual(s.math?.parts?.map((p) => p.status), ["richtig", "richtig", "offen"]);
  const counted = repo.listAttemptsForStudent(sid).filter((a) => a.final);
  assert.equal(counted.length, 1, "only the reliably graded one counts");
  // the teacher grades: then it counts, teilweise half
  const [sach, eq] = repo.pendingReviews({ studentId: sid });
  assert.ok("ok" in reviewAnswer(eq.id, "teilweise", niko.id));
  assert.ok("ok" in reviewAnswer(sach.id, "richtig", niko.id));
  assert.equal(repo.pendingReviews({ studentId: sid }).length, 0);
  const byId = new Map(repo.listAttemptsForStudent(sid).map((a) => [a.id, a]));
  assert.equal(taskScore(byId.get(eq.id)!), 0.5);
  assert.equal(taskScore(byId.get(sach.id)!), 1);
});

test("8. the last try decides: unit missing three times is teilweise (automatic), a wrong result stays wrong", async () => {
  const unitTask = draft({ type: "rechenweg", category: "rechenweg", skillId: PR, skillIds: [PR], prompt: "Berechne 15 % von 480 €.", answer: { accepted: ["72 €"], unit: "€", needWay: true } });
  const { tasks, answer, repo, sid } = await setup("Rechenweg Einheit", [unitTask, GLEICHUNG]);
  for (let i = 0; i < 3; i++) await answer(tasks[0].id, way(["480 : 100 = 4,8", "4,8 · 15 = 72"], "72"));
  const fin = repo.listAttemptsForStudent(sid).find((a) => a.task_id === tasks[0].id && a.final)!;
  assert.equal(fin.review, "teilweise");
  assert.equal(fin.review_by ?? null, null, "graded by the app, not by a teacher");
  for (let i = 0; i < 3; i++) await answer(tasks[1].id, way(["3x = 15", "x = 3"], "3"));
  const wrong = repo.listAttemptsForStudent(sid).find((a) => a.task_id === tasks[1].id && a.final)!;
  assert.equal(wrong.correct, 0);
  assert.equal(wrong.review ?? null, null);
});

test("10. the same answer sent twice (lost connection) is stored once and gets the same marks", async () => {
  const { tasks, answer, repo, aid } = await setup("Rechenweg doppelt", [GLEICHUNG]);
  const body = way(["3x = 15", "x = 3"], "3");
  const a = await answer(tasks[0].id, body, "rechenweg-doppelt-0000000001");
  const b = await answer(tasks[0].id, body, "rechenweg-doppelt-0000000001");
  assert.deepEqual(a, b);
  assert.equal(repo.listAttemptsForAssignment(aid).length, 1);
  assert.deepEqual(a.math?.steps?.map((s) => s.status), ["ok", "fehler"]);
});

// ---------- 9: what the student's devices get ----------

test("9. tablet and laptop get the task without its result; a finished task shows the student's own lines", async () => {
  const { tasks, answer, repo, aid } = await setup("Rechenweg Gerät", [GLEICHUNG, FAHRRAD]);
  const { clientTasks } = await import("./solver-tasks");
  const before = clientTasks(repo.getAssignment(aid)!);
  const json = JSON.stringify(before);
  for (const secret of ["408", "72 €", "15 | : 3", "480 - a", "Rabatt dann vom Preis"]) assert.ok(!json.includes(secret), `not sent to the student: ${secret}`);
  assert.equal(before[0].math?.start, "3x + 7 = 22");
  assert.equal(before[0].math?.unknown, "x");
  assert.equal(before[1].math?.parts?.length, 3);
  await answer(tasks[0].id, way(["3x = 15", "x = 5"], "5"));
  const after = clientTasks(repo.getAssignment(aid)!);
  assert.deepEqual(after[0].finished?.math?.steps?.map((s) => s.line), ["3x = 15", "x = 5"]);
});

// ---------- safety of the parser ----------

test("typed maths is never run as code: only numbers, letters as unknowns and signs", async () => {
  const { parseExpr, evaluate } = await import("./math-expr");
  for (const evil of ["process.exit(1)", "constructor", "alert(1)", "__proto__", "x.constructor('return 1')()", "require('fs')", "1; 2", "a[0]", "`1`", "${1}"])
    assert.equal(parseExpr(evil, { vars: ["x"] }), null, evil);
  assert.equal(parseExpr("(".repeat(60) + "1" + ")".repeat(60)), null, "too deep");
  assert.equal(parseExpr("1+".repeat(200) + "1"), null, "too long");
  assert.ok(!Number.isFinite(evaluate(parseExpr("10^999")!)), "huge numbers are not finite");
  assert.equal(evaluate(parseExpr("2/3 : 1/2")!), 4 / 3, "the fraction bar binds first");
  assert.equal(evaluate(parseExpr("√16 + 2²")!), 8);
  assert.equal(evaluate(parseExpr("3x", { vars: ["x"] })!, { x: 2 }), 6);
  const { gradeMathTask } = await import("./math-task");
  const weird = gradeMathTask(GLEICHUNG, way(["process.exit(1)"], "5"));
  assert.equal(weird.view.steps![0].status, "notiz", "words are a note, never code");
});

// ---------- 6 (builder): generators, AI, editor check ----------

test("generators: Rechenweg and Sachaufgabe tasks for every maths skill check their own solution", async () => {
  const { rechenwegTask, sachaufgabeTask } = await import("./generators-mathe");
  const { checkOwnSolution, gradeMathTask } = await import("./math-task");
  const { DIFFICULTIES } = await import("./curriculum");
  let seed = 11;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const skills = ["mathe.gleichungen.einfach", "mathe.gleichungen.klammern", "mathe.gleichungen.text", "mathe.brueche.kuerzen", BR, "mathe.brueche.dividieren", "mathe.negativ.multiplizieren", "mathe.potenzen.regeln", PR, "mathe.prozent.grundwert"];
  for (const s of skills)
    for (const d of DIFFICULTIES)
      for (let i = 0; i < 8; i++) {
        const t = rechenwegTask(s, d, rng);
        assert.ok(t, `${s} ${d}`);
        assert.equal(checkOwnSolution(t), null, `${s}: ${t.data.start ?? t.prompt}`);
        assert.equal(gradeMathTask(t, way(t.solutionSteps ?? [], t.answer.accepted![0])).check.correct, true, `own solution right: ${t.data.start ?? t.prompt}`);
      }
  for (const s of [PR, "mathe.prozent.grundwert", BR, "mathe.gleichungen.text"])
    for (const d of DIFFICULTIES) {
      const t = sachaufgabeTask(s, d, rng);
      assert.ok(t, `${s} ${d}`);
      assert.equal(checkOwnSolution(t), null, t.prompt);
      assert.ok((t.data.parts ?? []).length >= 2);
    }
});

test("builder without AI: the two formats can be chosen and come exactly as chosen; mixed maths uses them", async () => {
  const builder = await import("./builder");
  const base = { studentId: null, subject: "Mathematik", schoolType: "Gymnasium", klasse: 3, skillIds: [GL], difficulty: "mittel" as const, count: 6, focus: "", useAI: false, title: "" };
  const { tasks, source } = await builder.generateTasks({ ...base, categories: ["rechenweg", "sachaufgabe"] }, null);
  assert.equal(source, "generator");
  assert.equal(tasks.filter((t) => t.type === "rechenweg").length, 3);
  assert.equal(tasks.filter((t) => t.type === "sachaufgabe").length, 3);
  for (const t of tasks) assert.equal(builder.checkTask(t), null, `complete: ${t.prompt}`);
  const mixed = await builder.generateTasks({ ...base, categories: [] }, null);
  assert.ok(mixed.tasks.some((t) => t.type === "rechenweg"), "mixed maths has Rechenwege");
  // a teacher's own task: the check tells what does not fit
  assert.match(builder.checkTask({ ...GLEICHUNG, answer: { ...GLEICHUNG.answer, accepted: ["4"] } }) ?? "", /erfüllt die Gleichung nicht/);
  assert.match(builder.checkTask({ ...GLEICHUNG, solutionSteps: ["3x = 15", "x = 4"] }) ?? "", /Zeile 2/);
  assert.equal(builder.checkTask({ ...FAHRRAD, answer: { parts: [FAHRRAD.answer.parts![0], { ...FAHRRAD.answer.parts![1], follow: "480 + a" }, FAHRRAD.answer.parts![2]] } })?.includes("Folgefehler"), true);
});

test("with AI: a Rechenweg whose own solution does not fit is dropped; a Sachaufgabe keeps only a working Folgefehler formula", async () => {
  const { aiTaskToDraft } = await import("./ai");
  const { categoriesFor } = await import("./curriculum");
  const cats = categoriesFor("Mathematik");
  const base = {
    skill_ids: [GL], topic: "Gleichungen", difficulty: "mittel" as const, passage: null, options: null, correct_option: null, numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null,
    faulty_text: null, corrected_text: null, text_errors: null, answer_lines: null, result_unit: null, result_form: null, round_to: null, criteria: [], estimated_time_sec: 120, hints: [], common_errors: [],
  };
  const req = { subject: "Mathematik", skills: [{ id: GL, name: "Gleichungen", area: "Algebra", difficulty: "mittel" as const }], categories: cats };
  const good = aiTaskToDraft({ ...base, category: "rechenweg", format: "rechenweg", prompt: "Löse.", math_start: "2x + 3 = 11", variable: "x", accepted_answers: ["4"], parts: null, solution: "2x = 8, x = 4", solution_steps: ["2x = 8", "x = 4"] }, req, Math.random, cats.find((c) => c.key === "rechenweg"))!;
  assert.equal(good.type, "rechenweg");
  assert.equal(good.data.start, "2x + 3 = 11");
  const bad = aiTaskToDraft({ ...base, category: "rechenweg", format: "rechenweg", prompt: "Löse.", math_start: "2x + 3 = 11", variable: "x", accepted_answers: ["5"], parts: null, solution: "", solution_steps: [] }, req, Math.random, cats.find((c) => c.key === "rechenweg"));
  assert.equal(bad, null, "a wrong result from the AI is never used");
  const asCalc = aiTaskToDraft({ ...base, category: "rechenweg", format: "rechenweg", prompt: "Löse die Gleichung.", math_start: "2x + 3 = 11", variable: "x", accepted_answers: ["4"], parts: null, solution: "", solution_steps: [] }, req, Math.random, cats.find((c) => c.key === "rechnung"));
  assert.equal(asCalc, null, "a Rechenweg never becomes a bare calculation without its equation");
  const sach = aiTaskToDraft(
    {
      ...base, category: "sachaufgabe", format: "sachaufgabe", prompt: "Ein Fahrrad kostet 480 €, es gibt 15 % Rabatt.", math_start: null, variable: null, accepted_answers: null, solution: "", solution_steps: [],
      parts: [
        { label: "a)", prompt: "Rabatt in Euro?", kind: "zahl", answers: ["72 €"], unit: "€", follow: null, sample_answer: null, solution: "480 : 100 · 15" },
        { label: "b)", prompt: "Neuer Preis?", kind: "zahl", answers: ["408 €"], unit: "€", follow: "480 + a", sample_answer: null, solution: "480 − 72" },
        { label: "c)", prompt: "Erkläre.", kind: "text", answers: null, unit: null, follow: null, sample_answer: "Preis minus Rabatt.", solution: "" },
      ],
    },
    req,
    Math.random,
    cats.find((c) => c.key === "sachaufgabe"),
  )!;
  assert.equal(sach.type, "sachaufgabe");
  assert.equal(sach.answer.parts?.[1].follow, null, "480 + a does not give 408: no Folgefehler formula");
});

// ---------- 11: A4 ----------

test("11. A4: squared paper for the working, a result line, solutions and working only in the teacher version", async () => {
  const { buildSheet, DEFAULTS, planTask, shortAnswer } = await import("./arbeitsblatt");
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  const o = { space: "mittel" as const, field: "auto" as const };
  const plan = planTask(GLEICHUNG, "Mathematik", o);
  assert.equal(plan.area?.kind, "kariert");
  assert.ok(plan.area!.heightMm >= 60, "room for several lines of working");
  assert.equal(plan.answerLabel, "Ergebnis: x =");
  assert.ok(planTask(GLEICHUNG, "Mathematik", { ...o, space: "gross" }).area!.heightMm > plan.area!.heightMm);
  const sp = planTask(FAHRRAD, "Mathematik", o);
  assert.deepEqual(sp.parts!.map((p) => p.area?.kind ?? null), ["kariert", "kariert", null]);
  assert.ok(sp.parts![2].lines >= 2, "lines for the answer in words");
  assert.equal(shortAnswer(GLEICHUNG), "x = 5");
  assert.equal(shortAnswer(FAHRRAD), "a) 72 €   b) 408 €   c) (in Worten)");

  const doc = buildSheet({ title: "Rechenwege", subject: "Mathematik", klasseLabel: "AHS, 3. Klasse", topic: "Gleichungen", studentName: "Mia Muster", tasks: [GLEICHUNG, FAHRRAD] }, () => "Gleichungen", DEFAULTS);
  const render = (fassung: "schueler" | "lehrer") => renderToStaticMarkup(createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Rechenwege", fassung } }));
  const student = render("schueler");
  assert.ok(student.includes("ab-area-kariert"), "squared paper");
  assert.ok(student.includes("3x + 7 = 22"));
  assert.ok(student.includes("Ergebnis: x ="));
  assert.ok(student.includes("Erkläre, wie du"));
  for (const hidden of ["408", "Lösungsweg", "Folgefehler", "Rabatt dann vom Preis"]) assert.ok(!student.includes(hidden), `student sheet shows "${hidden}"`);
  const teacher = render("lehrer");
  for (const shown of ["x = 5", "3x = 15", "408", "Folgefehler", "Rabatt dann vom Preis", "Lösungsweg"]) assert.ok(teacher.includes(shown), `teacher sheet lacks "${shown}"`);
});

// ---------- 12: nothing else changed ----------

test("12. other tasks work as before: a calculation is still checked by its value, a choice by its option", async () => {
  const { checkAnswer } = await import("./tasks");
  const calc = draft({ type: "calc", prompt: "Berechne 3/4 + 1/8.", answer: { accepted: ["7/8"], mode: "value" } });
  assert.equal(checkAnswer(calc, "7/8").correct, true);
  assert.equal(checkAnswer(calc, "0,875").correct, true);
  assert.equal(checkAnswer(calc, "4/12").correct, false);
  const mc = draft({ type: "mc", prompt: "Welcher Bruch ist größer?", data: { options: ["1/2", "1/3"] }, answer: { correct: 0 } });
  assert.equal(checkAnswer(mc, "0").correct, true);
  assert.equal(checkAnswer(mc, "1").correct, false);
  const { TEACHER_GRADED } = await import("./tasks");
  assert.ok(!TEACHER_GRADED.has("calc") && !TEACHER_GRADED.has("mc"), "the app keeps grading these itself");
});
