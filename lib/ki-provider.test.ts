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
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(reply(body)));
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
