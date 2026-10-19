/**
 * Mathe am Whiteboard (niko, 19.10.2026): „Die Übungen die generiert werden wie hier für mathe sind unbrauchbar
 * da es nicht klar ersichtlich ist was genau gemeint ist … am whiteboard erscheinen nur 2 aufgaben … wie wird dann
 * das geprüft wenn der Schüler am Whiteboard die aufgabe löst.“
 *
 * - Hochzahlen bleiben bei ihrer Basis, auch in Brüchen („x^2/x^9“), und nirgends steht ein „^“.
 * - Eine Lücke in der Hochzahl („3^___“) steht hochgestellt.
 * - Am Whiteboard sind Hochzahlen hochgestellt, jede Aufgabe trägt ihre Marke für die Aufgabenleiste.
 * - Der Lehrer bewertet jede Aufgabe am Whiteboard (richtig, teilweise, falsch); das zählt wie eine Lehrerbewertung.
 * Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type Draft = import("./tasks").TaskDraft;
type Node = import("./math-format").MathNode;
const GL = "mathe.gleichungen.einfach";
const draft = (o: Partial<Draft> & Pick<Draft, "type" | "prompt" | "answer">): Draft => ({ skillId: GL, skillIds: [GL], difficulty: "mittel", data: {}, solution: "", hints: [], errorMap: [], ...o });

/** Every plain text in the nodes, to look for a caret that was left over. */
const strings = (nodes: Node[]): string[] =>
  nodes.flatMap((n) => (typeof n === "string" ? [n] : n.t === "frac" ? [...strings(n.num), ...strings(n.den)] : strings(n.body)));

test("a power belongs to its base, also in a fraction; nowhere is a caret left", async () => {
  const { parseMath } = await import("./math-format");
  const { splitFractions } = await import("./math-text");

  assert.deepEqual(parseMath("x^2/x^9"), [{ t: "frac", minus: false, num: ["x", { t: "sup", body: ["2"] }], den: ["x", { t: "sup", body: ["9"] }] }]);
  assert.deepEqual(parseMath("x^14/x^9"), [{ t: "frac", minus: false, num: ["x", { t: "sup", body: ["14"] }], den: ["x", { t: "sup", body: ["9"] }] }]);
  // the three examples from niko's screenshots
  for (const s of ["(2a^2*b)^3/(4a^3*b)", "(x^4)^3 · x^2/x^9", "(3·x)^4 = 3^ ___ · x^ ___ = ___ · x^4", "(2^3 · 2^4) : 2^5 · 2^2"])
    assert.ok(!strings(parseMath(s)).some((t) => t.includes("^")), s);
  const big = parseMath("(2a^2*b)^3/(4a^3*b)");
  assert.equal(big.length, 1);
  assert.deepEqual(big[0], { t: "frac", minus: false, num: ["(2a", { t: "sup", body: ["2"] }, " · b)", { t: "sup", body: ["3"] }], den: ["4a", { t: "sup", body: ["3"] }, " · b"] });

  assert.deepEqual(splitFractions("x^2/3"), [{ minus: false, num: "x^2", den: "3" }], "x² over 3");
  assert.deepEqual(splitFractions("1/x^2"), [{ minus: false, num: "1", den: "x^2" }]);
  assert.deepEqual(splitFractions("a^-2/b"), [{ minus: false, num: "a^-2", den: "b" }]);
  assert.deepEqual(splitFractions("(a)^(2)/b"), [{ minus: false, num: "(a)^(2)", den: "b" }], "brackets with a power stay");
  assert.deepEqual(splitFractions("(a+b)/2"), [{ minus: false, num: "a+b", den: "2" }], "a bracket alone loses them under the bar");
  assert.deepEqual(parseMath("x^(2/3)"), ["x", { t: "sup", body: ["2/3"] }], "a fraction never starts inside an exponent");
  for (const s of ["km/h", "5m/s", "und/oder"]) assert.deepEqual(splitFractions(s), [s], s);
});

test("a gap in an exponent is raised, in the app and on the A4 sheet, and the caret goes", async () => {
  const { clozeParts, parseMath } = await import("./math-format");
  assert.deepEqual(clozeParts("(3·x)^4 = 3^ ___ · x^___ = ___ · x^4"), [
    { text: "(3·x)^4 = 3", raised: true },
    { text: " · x", raised: true },
    { text: " = ", raised: false },
    { text: " · x^4", raised: false },
  ]);
  assert.deepEqual(parseMath("3^ ___"), ["3", { t: "sup", body: ["___"] }], "where the gap is not an input, it is still raised");

  const { TaskBody } = await import("../components/TaskPreview");
  const task = draft({ type: "cloze", prompt: "(3·x)^4 = 3^ ___ · x^ ___ = ___ · x^4", answer: { blanks: [["4"], ["4"], ["81"]] } });
  const html = renderToStaticMarkup(createElement(TaskBody, { task, showSolution: false }));
  assert.equal((html.match(/Lücke, Hochzahl/g) ?? []).length, 2);
  assert.equal((html.match(/aria-label="Lücke"/g) ?? []).length, 1);
  assert.ok(!html.includes("^"), html);

  const { RichText } = await import("../components/arbeitsblatt/MathLine");
  const sheet = renderToStaticMarkup(createElement(RichText, { text: task.prompt, gapsMm: [20, 20, 20] }));
  assert.equal((sheet.match(/<sup class="ab-sup"><span class="ab-gap" style="width:7mm"/g) ?? []).length, 2, "raised and short");
  assert.ok(!sheet.includes("^"));
});

const measure = (s: string, size: number) => s.length * size * 0.5;

test("whiteboard: powers raised, fractions with a bar, brackets kept on one line, every piece of a task tagged", async () => {
  const { tasksTemplate } = await import("./whiteboard-templates");
  const els = tasksTemplate(
    [
      { number: 1, prompt: "Vereinfache den Term vollständig und schreibe den Rechenweg Zeile für Zeile auf.\n(2^3 · 2^4) : 2^5 · 2^2", options: null, taskId: 7 },
      { number: 2, prompt: "Vereinfache den Bruch so weit wie möglich: (2a^2 · b)^3/(4a^3 · b)", options: null, taskId: 8 },
    ],
    { x: 0, y: 0 },
    { measure, set: "abc123", worksheetId: 3, title: "Potenzen" },
  );
  const texts = els.filter((e) => e.type === "text");
  assert.ok(!texts.some((e) => String(e.text).includes("^")), JSON.stringify(texts.map((e) => e.text)));
  // "2^3": a small 3 a little higher than the 2 in front of it
  const three = texts.find((e) => e.text === "3" && Number(e.fontSize) < 30)!;
  const base = texts.find((e) => String(e.text).endsWith("(2") && e.fontSize === 30)!;
  assert.ok(three && base, "the power is its own, smaller piece");
  assert.ok(Number(three.y) <= Number(base.y) && Number(three.x) > Number(base.x));
  // the fraction of task 2 has its bar, the bracket was not broken over two lines
  const bars = els.filter((e) => e.type === "line");
  assert.equal(bars.length, 1);
  assert.ok(texts.some((e) => e.text === "(2a") && texts.some((e) => e.text === "4a"));

  const tagged = els.filter((e) => e.customData);
  assert.equal(tagged.length, els.length - 1, "everything but the title belongs to a task");
  assert.deepEqual(
    [...new Set(tagged.map((e) => JSON.stringify(e.customData)))],
    [JSON.stringify({ aufgabe: { n: 1, set: "abc123", task: 7, ws: 3 } }), JSON.stringify({ aufgabe: { n: 2, set: "abc123", task: 8, ws: 3 } })],
  );
  const areas = els.filter((e) => e.type === "rectangle");
  assert.equal(areas.length, 2);
  assert.ok(areas.every((a) => Number(a.height) >= 280), "room to calculate with the pen");

  // without a measure: one text, powers as raised digits
  const flat = tasksTemplate([{ number: 1, prompt: "(2^3 · 2^4) : 2^5 · 2^-2", options: null }], { x: 0, y: 0 });
  const one = flat.filter((e) => e.type === "text");
  assert.equal(one.length, 1);
  assert.equal(one[0].text, "1) (2³ · 2⁴) : 2⁵ · 2⁻²");
  assert.ok(flat.every((e) => !e.customData), "without a set nothing is tagged");
});

test("the server keeps only the task tag of an element", async () => {
  const wb = await import("./whiteboard");
  const el = (customData: unknown) => wb.sanitize({ id: "t", type: "text", version: 1, versionNonce: 1, text: "1)", customData });
  assert.deepEqual(el({ aufgabe: { n: 2, set: "ab-1", task: 5, ws: 9, extra: "x" }, evil: true })!.customData, { aufgabe: { n: 2, set: "ab-1", task: 5, ws: 9 } });
  assert.deepEqual(el({ aufgabe: { n: 2, set: "ab", task: -1 } })!.customData, { aufgabe: { n: 2, set: "ab" } }, "a wrong task id is dropped");
  assert.equal(el({ aufgabe: { n: 0, set: "ab" } })!.customData, undefined);
  assert.equal(el({ aufgabe: { n: 1, set: "<b>" } })!.customData, undefined);
  assert.equal(el({ generationData: { html: "<script>" } })!.customData, undefined);
});

async function setup() {
  const repo = await import("./repo");
  const units = await import("./units");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const wb = await import("./whiteboard");
  const { sync } = await import("./whiteboard-routes");
  const { studentAccess } = await import("./whiteboard-access");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Tafel Rechner", grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const wid = repo.createWorksheet({ title: "Potenzen", subject: "Mathematik", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "Potenzen", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [GL] }, [
    draft({ type: "rechenweg", category: "rechenweg", prompt: "Vereinfache.", data: { start: "(2^3 · 2^4) : 2^5" }, answer: { accepted: ["4"], needWay: true }, solution: "2^7 : 2^5 = 2^2 = 4" }),
    draft({ type: "calc", prompt: "Berechne 2^5.", answer: { accepted: ["32"] }, solution: "2^5 = 32" }),
    draft({ type: "calc", prompt: "Berechne 3^2.", answer: { accepted: ["9"] }, solution: "3^2 = 9" }),
  ]);
  const tasks = repo.listTasks(wid);
  const { unit } = units.startUnit(niko.id, sid, { subject: "Mathematik" });
  const board = wb.ensureBoardForUnit(unit.id)!;
  const teacher = { role: "lehrer" as const, name: "Niko", canWrite: true, teacherId: niko.id };
  const access = studentAccess(student.access_token, String(unit.id));
  if (!("viewer" in access)) throw new Error("no student access");
  const call = async (viewer: typeof teacher | typeof access.viewer, body: Record<string, unknown>) => {
    const res = await sync(board, viewer, new Request("http://x/sync", { method: "POST", body: JSON.stringify({ clientId: "c1", ...body }) }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { repo, wb, niko, student, wid, tasks, unit, board, teacher, studentViewer: access.viewer, call };
}

test("the teacher grades a task worked out on the board: it counts like a Lehrerbewertung, only the teacher may", async () => {
  const { repo, student, wid, tasks, unit, teacher, studentViewer, call } = await setup();
  const { BOARD_ANSWER } = await import("./whiteboard-grades");

  // only sent to the board, never as an exercise: the grade makes the assignment, in the running unit
  assert.equal(repo.listAssignments(student.id).length, 0);
  let r = await call(teacher, { op: "grade", taskId: tasks[0].id, review: "richtig" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.grades, { [tasks[0].id]: "richtig" });
  const [assignment] = repo.listAssignments(student.id);
  assert.equal(assignment.worksheet_id, wid);
  assert.equal(assignment.unit_id, unit.id);
  let attempts = repo.listAttemptsForAssignment(assignment.id);
  assert.equal(attempts.length, 1);
  assert.deepEqual([attempts[0].answer, attempts[0].correct, attempts[0].final, attempts[0].review, attempts[0].review_by, attempts[0].unit_id], [BOARD_ANSWER, 1, 1, "richtig", teacher.teacherId, unit.id]);

  // a second tap changes the grade, it does not add an answer
  r = await call(teacher, { op: "grade", taskId: tasks[0].id, review: "teilweise" });
  attempts = repo.listAttemptsForAssignment(assignment.id);
  assert.equal(attempts.length, 1);
  assert.deepEqual([attempts[0].review, attempts[0].correct], ["teilweise", 0]);

  // a task the student already answered in the exercise: the teacher's grade from the board replaces the app's
  const { submitAnswer } = await import("./service");
  const done = await submitAnswer({ token: student.access_token, assignmentId: assignment.id, taskId: tasks[1].id, answer: "32", timeMs: 20_000, hintsUsed: 0 });
  assert.equal(done.correct, true);
  r = await call(teacher, { op: "grade", taskId: tasks[1].id, review: "falsch" });
  assert.equal(r.status, 200);
  const second = repo.listAttemptsForAssignment(assignment.id).filter((a) => a.task_id === tasks[1].id);
  assert.equal(second.length, 1);
  assert.deepEqual([second[0].answer, second[0].review, second[0].correct], ["32", "falsch", 0]);

  // both count for the Lernstand (no grade waits), task 3 stays open
  const counted = repo.listAttemptsForStudent(student.id).filter((a) => a.assignment_id === assignment.id);
  assert.equal(counted.length, 2);
  assert.equal(repo.getAssignment(assignment.id)!.completed_at, null);

  // the student's board asks how the tasks stand; it may not grade or fetch a solution
  r = await call(studentViewer, { op: "grades", taskIds: tasks.map((t) => t.id) });
  assert.deepEqual(r.body.grades, { [tasks[0].id]: "teilweise", [tasks[1].id]: "falsch" });
  assert.equal((await call(studentViewer, { op: "grade", taskId: tasks[2].id, review: "richtig" })).status, 403);
  assert.equal((await call(studentViewer, { op: "solution", taskId: tasks[0].id })).status, 403);
  r = await call(teacher, { op: "solution", taskId: tasks[0].id });
  assert.deepEqual(r.body, { number: 1, solution: "2^7 : 2^5 = 2^2 = 4" });

  assert.equal((await call(teacher, { op: "grade", taskId: tasks[2].id, review: "super" })).status, 400);
  assert.equal((await call(teacher, { op: "grade", taskId: 99_999, review: "richtig" })).status, 400);
  r = await call(teacher, { op: "grade", taskId: tasks[2].id, review: "richtig" });
  assert.equal(repo.getAssignment(assignment.id)!.completed_at !== null, true, "all three graded: the exercise is done");
});

test("a task whose solution the student looked at keeps that; tasks go to the board without their solution", async () => {
  const { repo, student, wid, tasks, teacher, call } = await setup();
  const { submitAnswer } = await import("./service");
  const aid = repo.assignWorksheet(wid, student.id);
  await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: tasks[1].id, answer: "", timeMs: 1_000, hintsUsed: 0, giveUp: true });
  const r = await call(teacher, { op: "grade", taskId: tasks[1].id, review: "richtig" });
  assert.equal(r.status, 400);
  assert.match(String(r.body.error), /Lösung angesehen/);
  assert.deepEqual((await call(teacher, { op: "grades", taskIds: [tasks[1].id] })).body.grades, { [tasks[1].id]: "loesung" });

  const { boardTaskForStudent, boardTask } = await import("./whiteboard-content");
  assert.equal(boardTask(repo.getTask(tasks[0].id)!).solution, "2^7 : 2^5 = 2^2 = 4", "the teacher's panel still has it");
  const sent = boardTaskForStudent(repo.getTask(tasks[0].id)!);
  assert.equal("solution" in sent, false);
  // whatever a caller passes, the queue keeps no solution
  const { wb, board } = await setup();
  const id = wb.queueInsert(board.id, { kind: "tasks", title: "Potenzen", worksheetId: wid, tasks: [boardTask(repo.getTask(tasks[0].id)!)] });
  const queued = wb.pendingInserts(board.id).find((i) => i.id === id)!.payload;
  assert.ok(queued.kind === "tasks" && !JSON.stringify(queued).includes("2^7") && queued.tasks[0].taskId === tasks[0].id && queued.worksheetId === wid);
  assert.deepEqual(sent, { number: 1, prompt: "Vereinfache.\n(2^3 · 2^4) : 2^5", options: null, taskId: tasks[0].id });
});
