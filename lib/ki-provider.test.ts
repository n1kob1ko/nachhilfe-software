import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

type Seen = { path: string; auth: string; body: Record<string, unknown> };

/** A local stand-in for an OpenAI-compatible API: records each request and answers with `reply`. */
async function fakeApi(reply: (body: Record<string, unknown>) => unknown) {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      seen.push({ path: req.url ?? "", auth: String(req.headers.authorization ?? ""), body });
      const out = reply(body) as { status?: number; error?: string };
      res.setHeader("content-type", "application/json");
      if (out?.status) res.statusCode = out.status;
      res.end(out?.status ? (out.error ?? "") : JSON.stringify(out));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { seen, url, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const chat = (content: string, usage: Record<string, unknown> = {}) => ({ model: "antwortendes-modell", choices: [{ finish_reason: "stop", message: { content } }], usage: { prompt_tokens: 1000, completion_tokens: 100, ...usage } });

function clean(...keys: string[]) {
  for (const k of keys) delete process.env[k];
}

test("routing: provider and model per area from environment variables, Anthropic by default", async () => {
  const { routeFor } = await import("./ai/config");
  const { aiEnabled } = await import("./ai/router");
  assert.deepEqual(routeFor("echtzeit"), { provider: "anthropic", model: "claude-haiku-4-5", area: "REALTIME" });
  assert.deepEqual(routeFor("neue_aufgabe"), { provider: "anthropic", model: "claude-sonnet-5-5", area: "EXERCISE" });

  process.env.AI_REALTIME_PROVIDER = "openrouter";
  process.env.AI_REALTIME_MODEL = "deepseek/beispiel-modell";
  assert.deepEqual(routeFor("echtzeit"), { provider: "openrouter", model: "deepseek/beispiel-modell", area: "REALTIME" });
  assert.equal(routeFor("aufgaben").provider, "anthropic", "other areas keep their provider");

  // another provider without a model: no id is guessed, the area stays off
  process.env.AI_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "test";
  assert.deepEqual(routeFor("block"), { provider: "deepseek", model: "", area: "ANALYSIS" });
  assert.equal(aiEnabled("block"), false);
  process.env.AI_ANALYSIS_MODEL = "deepseek-beispiel";
  assert.equal(aiEnabled("block"), true);
  assert.equal(aiEnabled("echtzeit"), false, "realtime is on OpenRouter, which has no key");

  process.env.AI_PROVIDER = "unbekannt";
  assert.equal(routeFor("aufgaben").provider, "anthropic", "an unknown provider name falls back to Anthropic");
  clean("AI_REALTIME_PROVIDER", "AI_REALTIME_MODEL", "AI_PROVIDER", "DEEPSEEK_API_KEY", "AI_ANALYSIS_MODEL");
});

test("OpenRouter: with only its key every area runs there, with the default models and their prices", async () => {
  const { routeFor, priceFor, FUNCTIONS } = await import("./ai/config");
  const { aiEnabled } = await import("./ai/router");
  assert.equal(aiEnabled(), false, "no key: KI off");
  process.env.OPENROUTER_API_KEY = "or-test";
  for (const fn of Object.keys(FUNCTIONS) as (keyof typeof FUNCTIONS)[]) {
    const r = routeFor(fn);
    assert.equal(r.provider, "openrouter", fn);
    assert.equal(r.model, fn === "tiefenanalyse" ? "anthropic/claude-sonnet-5.5" : "anthropic/claude-haiku-5.5", fn);
    assert.equal(priceFor(r.model, FUNCTIONS[fn].tier).known, true, `${fn}: price known`);
  }
  assert.equal(aiEnabled("aufgaben"), true);
  process.env.AI_TEXT_MODEL = "anthropic/claude-sonnet-5.5";
  assert.equal(routeFor("textkorrektur").model, "anthropic/claude-sonnet-5.5", "a model per area still wins");
  process.env.ANTHROPIC_API_KEY = "a-test";
  assert.equal(routeFor("aufgaben").provider, "anthropic", "with both keys Anthropic stays the default");
  process.env.AI_PROVIDER = "openrouter";
  assert.equal(routeFor("aufgaben").provider, "openrouter", "AI_PROVIDER decides");
  clean("OPENROUTER_API_KEY", "AI_TEXT_MODEL", "ANTHROPIC_API_KEY", "AI_PROVIDER");
});

test("OpenRouter: the large task schema goes into the instructions for Claude models, missing null fields are filled in", async () => {
  // Anthropic refuses output schemas with more than 16 nullable fields (live error 2026-10-09: "Schemas contains too many parameters with union types")
  const task = { format: "calc", category: "rechnung", skill_ids: ["mathe.x"], topic: "t", difficulty: "leicht", prompt: "Rechne 2 + 3.", accepted_answers: ["5"], numeric: true, solution: "5", solution_steps: ["2 + 3 = 5"], estimated_time_sec: 30, hints: ["Zähl weiter."], common_errors: [], criteria: ["5"] };
  const api = await fakeApi(() => chat(JSON.stringify({ tasks: [task] }), { cost: 0.001 }));
  const r = await import("./ai/router");
  const { generateWithAI } = await import("./ai/features");
  r.resetRouter();
  Object.assign(process.env, { OPENROUTER_BASE_URL: api.url, OPENROUTER_API_KEY: "or-key" });
  const out = await generateWithAI({ subject: "Mathematik", level: "2. Klasse Volksschule", skills: [{ id: "mathe.x", name: "Plus", area: "Rechnen", difficulty: "leicht" }], count: 1, categories: [] });
  assert.equal(out?.length, 1, "the answer without the empty fields is used");
  assert.equal(out![0].answer.accepted?.[0], "5");
  const body = api.seen[0].body;
  assert.equal(body.model, "anthropic/claude-haiku-5.5");
  assert.equal(body.response_format, undefined, "no json_schema for this schema");
  assert.match(JSON.stringify(body.messages), /JSON-Schema/);

  // small schemas still go as json_schema
  const { gradeFreeText } = await import("./ai/features");
  await gradeFreeText({ prompt: "a", sample: "b" }, "c");
  assert.equal((api.seen[1].body.response_format as { type: string }).type, "json_schema");
  await api.close();
  clean("OPENROUTER_BASE_URL", "OPENROUTER_API_KEY");
});

test("OpenRouter: a model that refuses the schema is asked once more with the schema in the instructions", async () => {
  let n = 0;
  const api = await fakeApi((body) => (n++ === 0 && body.response_format ? { status: 400, error: '{"error":{"message":"Provider returned error: output schema is not supported"}}' } : chat('{"correct":true,"feedback":"Passt.","error_label":null,"error_type":null}')));
  const r = await import("./ai/router");
  const { gradeFreeText } = await import("./ai/features");
  r.resetRouter();
  Object.assign(process.env, { OPENROUTER_BASE_URL: api.url, OPENROUTER_API_KEY: "or-key" });
  const out = await gradeFreeText({ prompt: "a", sample: "b" }, "c");
  assert.ok(out.ok);
  assert.equal(api.seen.length, 2, "one more request, not more");
  assert.equal(api.seen[1].body.response_format, undefined);
  await api.close();
  clean("OPENROUTER_BASE_URL", "OPENROUTER_API_KEY");
});

test("answers outside the shape: small slips repaired, a task that still does not fit is dropped, the reason is logged without content", async () => {
  const { z } = await import("zod");
  const { parseLenient, repair } = await import("./ai/providers/repair");
  const S = z.object({ tasks: z.array(z.object({ format: z.enum(["mc", "calc"]), n: z.number().int(), form: z.enum(["bruch", "dezimal"]).nullable(), note: z.string().nullable(), hints: z.array(z.string()), ok: z.boolean() })) });
  const json = z.toJSONSchema(S, { io: "input" });
  assert.deepEqual(repair({ tasks: [{ format: "MC", n: "3", form: "", ok: "true" }] }, json), { tasks: [{ format: "mc", n: 3, form: null, note: null, hints: [], ok: true }] });
  const r = parseLenient(S, { tasks: [{ format: "calc", n: 1 }, { format: "essay", n: 2 }, { format: "mc", n: 2.0 }] }, json);
  assert.equal(r.data?.tasks.length, 2, "the task in an unknown format is dropped, the others stay");
  assert.equal(r.dropped, 1);
  assert.match(r.problem!, /1 Eintrag verworfen: tasks\.1\.format/);
  assert.equal(parseLenient(S, { tasks: "keine" }, json).data, null);

  const task = { format: "calc", category: "rechnung", skill_ids: ["mathe.x"], topic: "t", difficulty: "leicht", prompt: "Rechne 2 + 3.", accepted_answers: ["5"], numeric: true, solution: "5", solution_steps: ["2 + 3 = 5"], estimated_time_sec: "30", hints: ["Zähl weiter."], criteria: ["5"], result_form: "" };
  const api = await fakeApi(() => chat(JSON.stringify({ tasks: [task, { ...task, format: "aufsatz" }] }), { cost: 0.001 }));
  const r2 = await import("./ai/router");
  const { generateWithAI } = await import("./ai/features");
  const { recentCalls } = await import("./ai/log");
  r2.resetRouter();
  Object.assign(process.env, { OPENROUTER_BASE_URL: api.url, OPENROUTER_API_KEY: "or-key" });
  const out = await generateWithAI({ subject: "Mathematik", level: "2. Klasse Volksschule", skills: [{ id: "mathe.x", name: "Plus", area: "Rechnen", difficulty: "leicht" }], count: 2, categories: [] });
  assert.equal(out?.length, 1, "one usable task instead of none");
  const row = recentCalls(1)[0];
  assert.equal(row.status, "ok");
  assert.match(row.error, /verworfen: tasks\.1\.format/);
  assert.doesNotMatch(row.error, /Rechne/, "no content in the log");
  await api.close();

  const cut = await fakeApi(() => ({ model: "m", choices: [{ finish_reason: "length", message: { content: '{"tasks":[{"format":"calc"' } }], usage: { prompt_tokens: 10, completion_tokens: 10, cost: 0.0001 } }));
  r2.resetRouter();
  process.env.OPENROUTER_BASE_URL = cut.url;
  assert.equal(await generateWithAI({ subject: "Mathematik", level: "x", skills: [], count: 1, categories: [] }), null);
  assert.equal(recentCalls(1)[0].error, "Antwort abgeschnitten: Token-Grenze erreicht");
  await cut.close();
  clean("OPENROUTER_BASE_URL", "OPENROUTER_API_KEY");
});

test("compatible API: the app's free-text check runs unchanged through another provider", async () => {
  const api = await fakeApi(() => chat('{"correct":true,"feedback":"Passt.","error_label":null,"error_type":null}'));
  const r = await import("./ai/router");
  const { gradeFreeText } = await import("./ai/features");
  const { recentCalls } = await import("./ai/log");
  r.resetRouter();
  Object.assign(process.env, { AI_ANALYSIS_PROVIDER: "compatible", AI_ANALYSIS_MODEL: "mein-modell", AI_COMPATIBLE_BASE_URL: `${api.url}/v1/`, AI_COMPATIBLE_API_KEY: "geheim" });

  const out = await gradeFreeText({ prompt: "Warum ist der Himmel blau?", sample: "Streuung" }, "Wegen der Streuung", { teacherId: 1 });
  assert.ok(out.ok);
  assert.equal(out.data.correct, true);
  assert.equal(api.seen.length, 1);
  const { path, auth, body } = api.seen[0];
  assert.equal(path, "/v1/chat/completions");
  assert.equal(auth, "Bearer geheim");
  assert.equal(body.model, "mein-modell");
  assert.equal(body.max_tokens, 900);
  assert.equal((body.response_format as { type: string }).type, "json_schema");
  const messages = body.messages as { role: string; content: string }[];
  assert.equal(messages[0].role, "system");
  assert.match(messages[1].content, /Wegen der Streuung/);

  const row = recentCalls(1)[0];
  assert.equal(row.fn, "freitext");
  assert.equal(row.model, "antwortendes-modell");
  assert.equal(row.input_tokens, 1000);
  assert.equal(row.output_tokens, 100);
  assert.ok(row.cost_usd > 0, "unknown model: estimated with the price of its tier");
  assert.ok(!JSON.stringify(row).includes("geheim"), "the key is never logged");
  await api.close();
  clean("AI_ANALYSIS_PROVIDER", "AI_ANALYSIS_MODEL", "AI_COMPATIBLE_BASE_URL", "AI_COMPATIBLE_API_KEY");
});

test("OpenRouter: reports its own price, thinking only where the function may think", async () => {
  const api = await fakeApi(() => chat('{"ok":true}', { cost: 0.0042, prompt_tokens_details: { cached_tokens: 400 } }));
  const r = await import("./ai/router");
  const { recentCalls } = await import("./ai/log");
  const { z } = await import("zod");
  r.resetRouter();
  Object.assign(process.env, { AI_PROVIDER: "openrouter", OPENROUTER_BASE_URL: api.url, OPENROUTER_API_KEY: "or-key", AI_REALTIME_MODEL: "deepseek/schnell", AI_EXERCISE_MODEL: "anthropic/claude-sonnet" });

  assert.ok((await r.runAI("echtzeit", z.object({ ok: z.boolean() }), "sys", "kontext")).ok);
  assert.ok((await r.runAI("neue_aufgabe", z.object({ ok: z.boolean() }), "sys", "aufgabe")).ok);
  const [live, task] = api.seen.map((s) => s.body);
  assert.equal(live.model, "deepseek/schnell");
  assert.equal(live.reasoning, undefined, "realtime answers directly");
  assert.deepEqual(task.reasoning, { effort: "low" });
  assert.deepEqual(task.usage, { include: true });
  // Anthropic models behind OpenRouter keep the prompt cache
  assert.deepEqual((task.messages as { content: { cache_control?: unknown }[] }[])[0].content[0].cache_control, { type: "ephemeral" });

  const row = recentCalls(2)[1];
  assert.equal(row.fn, "echtzeit");
  assert.equal(row.cost_usd, 0.0042, "the price OpenRouter charged");
  assert.equal(row.input_tokens, 600);
  assert.equal(row.cache_read_tokens, 400);
  await api.close();
  clean("AI_PROVIDER", "OPENROUTER_BASE_URL", "OPENROUTER_API_KEY", "AI_REALTIME_MODEL", "AI_EXERCISE_MODEL");
});

test("DeepSeek: schema in the instructions, JSON in a code fence is accepted, wrong JSON is no answer", async () => {
  let answer = '```json\n{"ok": true}\n```';
  const api = await fakeApi(() => chat(answer, { prompt_cache_hit_tokens: 300 }));
  const r = await import("./ai/router");
  const { z } = await import("zod");
  r.resetRouter();
  Object.assign(process.env, { AI_PROVIDER: "deepseek", DEEPSEEK_BASE_URL: api.url, DEEPSEEK_API_KEY: "ds-key", AI_ANALYSIS_MODEL: "deepseek-beispiel" });
  const schema = z.object({ ok: z.boolean() });

  const ok = await r.runAI("analyse", schema, "Schätze ein.", "daten 1");
  assert.ok(ok.ok);
  const body = api.seen[0].body;
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.match((body.messages as { content: string }[])[0].content, /JSON-Schema/);

  answer = '{"ok": "vielleicht"}';
  const wrong = await r.runAI("analyse", schema, "Schätze ein.", "daten 2");
  assert.equal(wrong.ok, false);
  assert.equal(!wrong.ok && wrong.status, "abgelehnt");
  await api.close();
  clean("AI_PROVIDER", "DEEPSEEK_BASE_URL", "DEEPSEEK_API_KEY", "AI_ANALYSIS_MODEL");
});

test("material: a provider that cannot read PDFs is not asked, and the KI does not pause for it", async () => {
  const api = await fakeApi(() => chat("{}"));
  const r = await import("./ai/router");
  const { analyzeMaterialWithAI } = await import("./ai/features");
  r.resetRouter();
  Object.assign(process.env, { AI_MATERIAL_PROVIDER: "deepseek", AI_MATERIAL_MODEL: "deepseek-beispiel", DEEPSEEK_BASE_URL: api.url, DEEPSEEK_API_KEY: "ds-key" });
  for (let i = 0; i < 4; i++) await assert.rejects(analyzeMaterialWithAI({ mime: "application/pdf", base64: `JVBERi0${i}` }, { skills: [] }), /DeepSeek kann keine PDFs lesen/);
  assert.equal(api.seen.length, 0);
  assert.equal(r.breakerState().paused, false);
  await api.close();
  clean("AI_MATERIAL_PROVIDER", "AI_MATERIAL_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_API_KEY");
});

test("an unreachable provider: { ok: false }, no exception, like an Anthropic outage", async () => {
  const r = await import("./ai/router");
  const { z } = await import("zod");
  r.resetRouter();
  Object.assign(process.env, { AI_PROVIDER: "compatible", AI_COMPATIBLE_BASE_URL: "http://127.0.0.1:9", AI_COMPATIBLE_API_KEY: "x", AI_REALTIME_MODEL: "m" });
  const out = await r.runAI("echtzeit", z.object({ ok: z.boolean() }), "sys", "x");
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.status, "fehler");
  clean("AI_PROVIDER", "AI_COMPATIBLE_BASE_URL", "AI_COMPATIBLE_API_KEY", "AI_REALTIME_MODEL");
});
