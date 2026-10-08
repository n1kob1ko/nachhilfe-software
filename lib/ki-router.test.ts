import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

const Answer = z.object({ ok: z.boolean() });
type Call = { model: string; system: string; maxTokens: number; thinking?: string; effort?: string; cache?: string };

/** A stand-in for Claude that records what it was asked. */
function fakeTransport(calls: Call[], o: { fail?: boolean; slowMs?: number; data?: unknown } = {}) {
  return async (p: import("./ai/router").AIRequest) => {
    calls.push({ model: p.model, system: p.system, maxTokens: p.maxTokens, thinking: p.thinking, effort: p.effort, cache: p.cache });
    if (o.slowMs)
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, o.slowMs);
        p.signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        });
      });
    if (o.fail) throw new Error("Netzwerk weg");
    return { parsed: o.data ?? { ok: true }, refusal: false, model: p.model, usage: { input: 1000, output: 200, cacheWrite: 0, cacheRead: 0 } };
  };
}

test("prices: cost per model from the price table, unknown models get the price of their tier", async () => {
  const { costOf, priceFor } = await import("./ai/config");
  const u = { input: 1_000_000, output: 1_000_000, cacheWrite: 0, cacheRead: 0 };
  assert.equal(costOf("claude-haiku-4-5", "fast", u), 6);
  assert.equal(costOf("claude-sonnet-5-5", "standard", u), 12);
  assert.equal(costOf("claude-opus-5-5", "deep", u), 24);
  assert.equal(costOf("claude-sonnet-5-5", "standard", { input: 0, output: 0, cacheWrite: 1_000_000, cacheWrite1h: 1_000_000, cacheRead: 1_000_000 }), 2.5 + 4 + 0.2);
  assert.equal(priceFor("claude-neu-9", "fast").known, false);
  assert.equal(costOf("claude-neu-9", "fast", u), 6, "unknown model: price of the default fast model");
  process.env.AI_PRICES_JSON = JSON.stringify({ "claude-neu-9": { in: 3, out: 7 } });
  assert.equal(costOf("claude-neu-9", "fast", u), 10);
  delete process.env.AI_PRICES_JSON;
});

test("models come from environment variables, the defaults only when none is set", async () => {
  const { modelFor } = await import("./ai/config");
  assert.equal(modelFor("fast"), "claude-haiku-4-5");
  process.env.AI_MODEL_FAST = "claude-haiku-9";
  assert.equal(modelFor("fast"), "claude-haiku-9");
  delete process.env.AI_MODEL_FAST;
});

test("request shape: no thinking for short answers, no effort for the small model", async () => {
  const { requestShape } = await import("./ai/providers/anthropic");
  const { FUNCTIONS } = await import("./ai/config");
  assert.deepEqual(requestShape("claude-haiku-4-5", FUNCTIONS.echtzeit), { output_config: {} });
  assert.deepEqual(requestShape("claude-sonnet-5-5", FUNCTIONS.freitext), { thinking: { type: "between_tools" }, output_config: { effort: "low" } });
  assert.deepEqual(requestShape("claude-sonnet-5-5", FUNCTIONS.aufgaben), { thinking: { type: "adaptive" }, output_config: { effort: "medium" } });
  assert.deepEqual(requestShape("claude-opus-5-5", FUNCTIONS.analyse), { output_config: { effort: "low" } });
});

test("router: off without key, logs every request, reuses identical ones, limits tokens", async () => {
  const r = await import("./ai/router");
  const { db } = await import("./db");
  const out = await r.runAI("analyse", Answer, "sys", "frage");
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.status, "aus");
  assert.equal((db().prepare("SELECT COUNT(*) AS n FROM ai_calls").get() as { n: number }).n, 0, "nothing logged while off");

  const calls: Call[] = [];
  r.setTransport(fakeTransport(calls));
  const a = await r.runAI("analyse", Answer, "sys", "frage", { maxTokens: 999_999, meta: { teacherId: 1, trigger: "test" } });
  assert.ok(a.ok);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "claude-sonnet-5-5");
  assert.equal(calls[0].maxTokens, 3_000, "a caller cannot raise the limit of the function");
  const row = db().prepare("SELECT * FROM ai_calls ORDER BY id DESC LIMIT 1").get() as Record<string, unknown>;
  assert.equal(row.fn, "analyse");
  assert.equal(row.model, "claude-sonnet-5-5");
  assert.equal(row.input_tokens, 1000);
  assert.equal(row.output_tokens, 200);
  assert.equal(row.status, "ok");
  assert.equal(row.teacher_id, 1);
  assert.ok(Math.abs((row.cost_usd as number) - (1000 * 2 + 200 * 10) / 1e6) < 1e-12);

  const again = await r.runAI("analyse", Answer, "sys", "frage");
  assert.ok(again.ok && again.reused, "same question within the reuse time: answered from memory");
  assert.equal(calls.length, 1);

  // two identical requests at the same time: one goes out
  const [x, y] = await Promise.all([r.runAI("aufgaben", Answer, "sys", "gleich"), r.runAI("aufgaben", Answer, "sys", "gleich")]);
  assert.ok(x.ok && y.ok);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].cache, "5m", "task generation caches its system prompt");
  // task generation never reuses a finished answer (each click must bring new tasks)
  await r.runAI("aufgaben", Answer, "sys", "gleich");
  assert.equal(calls.length, 3);
  r.setTransport(null);
  r.resetRouter();
});

test("router: timeout and errors fall back, three failures pause the KI", async () => {
  const r = await import("./ai/router");
  const { FUNCTIONS } = await import("./ai/config");
  r.resetRouter();
  const calls: Call[] = [];
  const old = FUNCTIONS.echtzeit.timeoutMs;
  FUNCTIONS.echtzeit.timeoutMs = 30;
  r.setTransport(fakeTransport(calls, { slowMs: 1000 }));
  const t = await r.runAI("echtzeit", Answer, "sys", "langsam");
  assert.equal(!t.ok && t.status, "timeout");
  FUNCTIONS.echtzeit.timeoutMs = old;
  r.setTransport(fakeTransport(calls, { fail: true }));
  assert.equal((await r.runAI("echtzeit", Answer, "sys", "a")).ok, false);
  const third = await r.runAI("echtzeit", Answer, "sys", "b");
  assert.equal(!third.ok && third.status, "fehler");
  const n = calls.length;
  const paused = await r.runAI("echtzeit", Answer, "sys", "c");
  assert.equal(!paused.ok && paused.status, "pausiert");
  assert.equal(calls.length, n, "while paused nothing is sent");
  assert.equal(r.breakerState().paused, true);
  r.setTransport(null);
  r.resetRouter();
});

test("budget: above 100 % realtime stops, above 120 % everything; test rows do not count", async () => {
  const r = await import("./ai/router");
  const log = await import("./ai/log");
  const { db } = await import("./db");
  db().exec("DELETE FROM ai_calls");
  process.env.AI_MONTHLY_BUDGET_USD = "1";
  const calls: Call[] = [];
  r.setTransport(fakeTransport(calls));
  const add = (usd: number, test = false) => log.logCall({ fn: "aufgaben", tier: "standard", model: "m", teacherId: null, unitId: null, trigger: "", input: 0, output: 0, cacheWrite: 0, cacheRead: 0, durationMs: 0, costUsd: usd, status: "ok", test });
  add(5, true);
  assert.equal(log.budgetState().level, "ok", "a test run does not count");
  add(0.85);
  assert.equal(log.budgetState().level, "warnung");
  add(0.2);
  assert.equal(log.budgetState().level, "echtzeit-aus");
  const live = await r.runAI("echtzeit", Answer, "sys", "x");
  assert.equal(!live.ok && live.status, "budget");
  assert.ok((await r.runAI("analyse", Answer, "sys", "y")).ok, "other functions still run");
  add(0.2);
  assert.equal(log.budgetState().level, "aus");
  const blocked = await r.runAI("analyse", Answer, "sys", "z");
  assert.equal(!blocked.ok && blocked.status, "budget");
  delete process.env.AI_MONTHLY_BUDGET_USD;
  db().exec("DELETE FROM ai_calls");
  r.setTransport(null);
  r.resetRouter();
});

async function setup(name: string) {
  const repo = await import("./repo");
  const { startUnit } = await import("./units");
  const { generateBuiltIn } = await import("./generators");
  const teacher = repo.listTeachers()[0];
  const studentId = repo.createStudent({ name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "mag Fußball", weaknesses_note: "", goals: "", notes: "Mutter heißt Erna" });
  const unit = startUnit(teacher.id, studentId).unit;
  const tasks = generateBuiltIn({ subject: "Mathematik", skills: [{ id: "mathe.negativ.addieren", name: "Addieren" }], difficulty: "mittel", count: 4, taskType: "calc", seed: 3 }).filter((t) => t.answer.accepted);
  const wid = repo.createWorksheet({ title: `${name} – Übung`, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Negative Zahlen", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "generator", skill_ids: ["mathe.negativ.addieren"] }, tasks);
  const assignmentId = repo.assignWorksheet(wid, studentId, "", unit.id);
  return { repo, teacher, student: repo.getStudent(studentId)!, unit, assignmentId, tasks: repo.listTasks(wid) };
}

test("live context: learning data only, no name and no notes", async () => {
  const live = await import("./ai/realtime");
  const s = await setup("Zyprian Quellmann");
  const { submitAnswer } = await import("./service");
  await submitAnswer({ token: s.student.access_token, assignmentId: s.assignmentId, taskId: s.tasks[0].id, answer: "999", timeMs: 1000, hintsUsed: 0 });
  const ctx = await live.liveContext(s.unit.id, s.tasks[0].id, s.assignmentId, ["falsche_antwort"]);
  const text = JSON.stringify(ctx);
  for (const word of ["Zyprian", "Quellmann", "Fußball", "Erna"]) assert.ok(!text.includes(word), `${word} must not be sent`);
  assert.equal(ctx!.payload.fach, "Mathematik");
  assert.match(String(ctx!.payload.schule), /Mittelschule/);
  assert.equal((ctx!.payload.antworten as unknown[]).length, 1);
  const block = JSON.stringify(await live.blockContext(s.unit.id, s.assignmentId));
  for (const word of ["Zyprian", "Quellmann"]) assert.ok(!block.includes(word), "the exercise title with the name is not sent either");
});

test("live triggers: right answers cost nothing, wrong ones are bundled, a solved task is skipped", async () => {
  const live = await import("./ai/realtime");
  const r = await import("./ai/router");
  const { db } = await import("./db");
  const s = await setup("Bea Test");
  const { submitAnswer } = await import("./service");
  // virtual clock and timers
  let now = Date.now();
  const timers: { due: number; fn: () => Promise<void>; id: number }[] = [];
  let seq = 0;
  r.setClock(() => now);
  live.setScheduler({ after: (ms, fn) => (timers.push({ due: now + ms, fn, id: ++seq }), seq), cancel: (id) => void timers.splice(timers.findIndex((t) => t.id === id), 1) });
  const advance = async (ms: number) => {
    now += ms;
    for (const t of timers.filter((x) => x.due <= now).sort((a, b) => a.due - b.due)) {
      timers.splice(timers.indexOf(t), 1);
      await t.fn();
    }
    await live.settle();
  };
  const sent: unknown[] = [];
  r.setTransport(async (p) => {
    sent.push(p.content);
    return { parsed: { error_type: "vorzeichen", misconception: "Vorzeichen", confidence: 3, recommended_action: "quatsch", difficulty_adjustment: -4, hint: "Schau auf das Vorzeichen.", next_skill: "gibt-es-nicht", needs_new_exercise: true, teacher_note: "x" }, refusal: false, model: p.model, usage: { input: 10, output: 5, cacheWrite: 0, cacheRead: 0 } };
  });
  const answer = (i: number, a: string) => submitAnswer({ token: s.student.access_token, assignmentId: s.assignmentId, taskId: s.tasks[i].id, answer: a, timeMs: 1000, hintsUsed: 0 });
  const right = (i: number) => s.tasks[i].answer.accepted![0];
  live.resetLiveStats();

  await answer(0, right(0));
  await advance(60_000);
  assert.equal(sent.length, 0, "a right answer is no reason to ask");

  // wrong, then right within the waiting time: skipped
  await answer(1, "999");
  await advance(10_000);
  await answer(1, right(1));
  await advance(60_000);
  assert.equal(sent.length, 0);
  assert.equal(live.liveStats.skippedSolved, 1);

  // wrong twice and a hint: one request that sees both answers
  await answer(2, "999");
  await advance(5_000);
  live.onHint({ unitId: s.unit.id, teacherId: s.teacher.id, taskId: s.tasks[2].id, assignmentId: s.assignmentId, hintIndex: 0 });
  await advance(5_000);
  await answer(2, "998");
  await advance(5_000);
  assert.equal(sent.length, 1, "bundled into one analysis");
  const payload = JSON.parse(sent[0] as string);
  assert.equal(payload.antworten.length, 2);
  assert.deepEqual(new Set(payload.ausloeser), new Set(["falsche_antwort", "hilfe_angefordert", "wiederholter_fehlversuch"]));
  // the model's answer is checked before it is shown
  const stored = (await import("./ai/insights")).latestInsight(s.unit.id, "echtzeit")!.data;
  assert.equal(stored.confidence, 1);
  assert.equal(stored.recommended_action, "weiter");
  assert.equal(stored.difficulty_adjustment, -1);
  assert.equal(stored.next_skill, null);
  assert.equal(live.aiLiveState(s.unit.id).hint?.hint, "Schau auf das Vorzeichen.");

  // the next one keeps the minimum gap of 20 seconds
  await answer(3, "999");
  await answer(3, "998");
  await advance(3_000);
  assert.equal(sent.length, 1, "not within 20 seconds of the last analysis");
  await advance(20_000);
  assert.equal(sent.length, 2);
  // measured data is untouched: attempts are what the app recorded
  const n = db().prepare("SELECT COUNT(*) AS n FROM attempts WHERE unit_id = ?").get(s.unit.id) as { n: number };
  assert.equal(n.n, 7);
  r.setTransport(null);
  r.setClock(null);
  live.setScheduler(null);
  live.forgetUnit(s.unit.id);
});

test("free text: without an answer from Claude the student rates the answer", async () => {
  const r = await import("./ai/router");
  const repo = await import("./repo");
  const { submitAnswer } = await import("./service");
  const s = await setup("Cleo Test");
  const wid = repo.createWorksheet({ title: "Freitext", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [] }, [
    { type: "free", skillId: null, difficulty: "mittel", prompt: "Erkläre das Kürzen.", data: {}, answer: { sample: "Zähler und Nenner durch dieselbe Zahl teilen." }, solution: "…", hints: [], errorMap: [] },
  ]);
  const aid = repo.assignWorksheet(wid, s.student.id, "", s.unit.id);
  const task = repo.listTasks(wid)[0];
  r.resetRouter();
  r.setTransport(async () => {
    throw new Error("weg");
  });
  const res = await submitAnswer({ token: s.student.access_token, assignmentId: aid, taskId: task.id, answer: "teilen", timeMs: 1000, hintsUsed: 0 });
  assert.equal(res.needsSelfAssessment, true);
  r.setTransport(async (p) => ({ parsed: { correct: true, feedback: "Gut.", error_label: null, error_type: null }, refusal: false, model: p.model, usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0 } }));
  const ok = await submitAnswer({ token: s.student.access_token, assignmentId: aid, taskId: task.id, answer: "teilen", timeMs: 1000, hintsUsed: 0 });
  assert.equal(ok.correct, true);
  r.setTransport(null);
  r.resetRouter();
});

test("new exercise on click: from Claude when possible, from the generator when not", async () => {
  const r = await import("./ai/router");
  const live = await import("./ai/realtime");
  const s = await setup("Dora Test");
  const { submitAnswer } = await import("./service");
  await submitAnswer({ token: s.student.access_token, assignmentId: s.assignmentId, taskId: s.tasks[0].id, answer: "999", timeMs: 1000, hintsUsed: 0 });
  live.forgetUnit(s.unit.id);
  r.resetRouter();
  r.setTransport(async () => {
    throw new Error("weg");
  });
  const out = await live.newExerciseForUnit(s.unit.id, s.teacher.id);
  assert.ok(out.ok && out.source === "generator");
  assert.equal(s.repo.listTasks(s.repo.getAssignment(out.ok ? out.assignmentId : 0)!.worksheet_id).length, 2);
  r.setTransport(null);
  r.resetRouter();
});

test("60-minute test mode: runs through, counts calls and costs, survives an outage", async () => {
  const { simulateLesson, reportMarkdown } = await import("./ai/simulation");
  const run = await simulateLesson({ minutes: 20, seed: 2 });
  assert.ok(run.answers > 10);
  assert.ok(run.total.calls > 0 && run.total.calls < run.naive.calls, "fewer calls than one per answer");
  assert.ok(run.total.usd > 0);
  assert.ok(run.rows.some((x) => x.fn === "echtzeit" && x.model === "claude-haiku-4-5"));
  const outage = await simulateLesson({ minutes: 20, seed: 2, outage: true });
  assert.ok(outage.answers > 10, "the unit runs on without KI");
  assert.equal(outage.total.calls, 0);
  assert.ok(outage.total.failed > 0);
  const md = reportMarkdown(run, outage);
  assert.match(md, /## 1\. API-Aufrufe/);
  assert.match(md, /## 5\. Wo es noch günstiger geht/);
  const { db } = await import("./db");
  const leaked = db().prepare("SELECT COUNT(*) AS n FROM ai_calls WHERE test = 0 AND unit_id IN (SELECT id FROM units WHERE student_id IN (SELECT id FROM students WHERE name LIKE 'Testschüler%'))").get() as { n: number };
  assert.equal(leaked.n, 0, "simulation rows are marked as test");
});
