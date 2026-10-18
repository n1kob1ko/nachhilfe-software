/**
 * Anthropic direkt (2026-10-18): der Adapter mit einem nachgebauten SDK-Client (kein echter Aufruf),
 * das eigene Monatsbudget von Anthropic und die Anbieterspalte im Kostenprotokoll.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "AI_PROVIDER", "AI_TEXT_MODEL", "AI_MONTHLY_BUDGET_EUR", "AI_MONTHLY_BUDGET_USD", "ANTHROPIC_MONTHLY_BUDGET_USD"]) delete process.env[k];

type Body = { model: string; system: { text: string; cache_control?: unknown }[]; thinking?: { type: string }; output_config: { effort?: string; format?: { type: string; schema: unknown } } };
type Reply = { text: string; stop?: string; usage?: Record<string, unknown> } | { status: number; message: string };

/** A stand-in for the SDK client: records each request body and answers with the next reply. */
function fakeClient(replies: Reply[]) {
  const seen: Body[] = [];
  const client = {
    beta: {
      messages: {
        stream: (body: Body) => ({
          finalMessage: async () => {
            seen.push(body);
            const r = replies[Math.min(seen.length - 1, replies.length - 1)];
            if ("status" in r) throw Object.assign(new Error(`${r.status} ${r.message}`), { status: r.status });
            return {
              model: body.model,
              stop_reason: r.stop ?? "end_turn",
              content: [{ type: "thinking", thinking: "" }, { type: "text", text: r.text }],
              usage: { input_tokens: 1000, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens_details: { thinking_tokens: 120 }, ...r.usage },
            };
          },
        }),
      },
    },
  };
  return { seen, client };
}

async function setup(replies: Reply[]) {
  const r = await import("./ai/router");
  const { setAnthropicClientForTests } = await import("./ai/providers/anthropic");
  const { db } = await import("./db");
  r.resetRouter();
  r.setTransport(null);
  db().exec("DELETE FROM ai_calls");
  process.env.ANTHROPIC_API_KEY = "test-key";
  const fake = fakeClient(replies);
  setAnthropicClientForTests(fake.client);
  return { ...fake, r, db: db() };
}

const task = { format: "calc", category: "rechnung", skill_ids: ["mathe.x"], topic: "t", difficulty: "leicht", prompt: "Rechne 2 + 3.", accepted_answers: ["5"], numeric: true, solution: "5", solution_steps: ["2 + 3 = 5"], estimated_time_sec: 30, hints: ["Zähl weiter."], common_errors: [], criteria: ["5"] };
const genReq = { subject: "Mathematik", level: "2. Klasse Volksschule", skills: [{ id: "mathe.x", name: "Plus", area: "Rechnen", difficulty: "leicht" as const }], count: 1, categories: [] };

test("Anthropic: small schema as structured output, the answer checked by the app, real tokens and cost logged", async () => {
  const { seen, db } = await setup([{ text: '{"correct":true,"feedback":"Passt.","error_label":null,"error_type":null}' }]);
  const { gradeFreeText } = await import("./ai/features");
  const out = await gradeFreeText({ prompt: "a", sample: "b" }, "c");
  assert.ok(out.ok);
  assert.equal(out.ok && out.data.feedback, "Passt.");
  const body = seen[0];
  assert.equal(body.model, "claude-sonnet-5-5", "Sonnet 5.5 is the default on Anthropic");
  assert.equal(body.output_config.format?.type, "json_schema");
  assert.equal("parse" in (body.output_config.format ?? {}), false, "the SDK does not parse (it would throw away the tokens of a bad answer)");
  assert.deepEqual(body.thinking, { type: "between_tools" }, "freitext answers directly");
  assert.doesNotMatch(body.system[0].text, /JSON-Schema/);
  const row = db.prepare("SELECT * FROM ai_calls ORDER BY id DESC LIMIT 1").get() as Record<string, unknown>;
  assert.equal(row.provider, "anthropic");
  assert.equal(row.input_tokens, 1000);
  assert.equal(row.output_tokens, 300);
  assert.equal(row.thinking_tokens, 120);
  assert.ok(Math.abs((row.cost_usd as number) - (1000 * 2 + 300 * 10) / 1e6) < 1e-12, "tokens × list price of Sonnet 5.5");
});

test("Anthropic: the large task schema goes into the instructions, small slips are repaired", async () => {
  // Anthropic refuses output schemas with more than 16 nullable fields; TaskSchema has more
  const { seen } = await setup([{ text: "```json\n" + JSON.stringify({ tasks: [task] }) + "\n```" }]);
  const { generateWithAI } = await import("./ai/features");
  const out = await generateWithAI(genReq);
  assert.equal(out?.length, 1, "the answer without the empty fields is used");
  assert.equal(seen[0].output_config.format, undefined, "no structured output for this schema");
  assert.match(seen[0].system[0].text, /JSON-Schema/);
  assert.deepEqual(seen[0].thinking, { type: "adaptive" });
});

test("Anthropic: a cut-off answer is no answer, but its tokens and cost are logged", async () => {
  const { db } = await setup([{ text: '{"correct":true,"feedb', stop: "max_tokens", usage: { output_tokens: 900 } }]);
  const { gradeFreeText } = await import("./ai/features");
  const out = await gradeFreeText({ prompt: "a", sample: "b" }, "c");
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.cause, "unvollstaendig");
  const row = db.prepare("SELECT * FROM ai_calls ORDER BY id DESC LIMIT 1").get() as Record<string, unknown>;
  assert.equal(row.status, "abgelehnt");
  assert.equal(row.output_tokens, 900);
  assert.ok((row.cost_usd as number) > 0, "paid tokens are counted");
  assert.equal(row.error, "Antwort abgeschnitten: Token-Grenze erreicht");
  const { breakerState } = await import("./ai/router");
  assert.equal(breakerState().failures, 0, "an answer is no outage");
});

test("Anthropic: a schema the API refuses is asked once more with the schema in the instructions", async () => {
  const { seen } = await setup([
    { status: 400, message: '{"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema: too many parameters with union types"}}' },
    { text: '{"correct":false,"feedback":"Fast.","error_label":"Rechnung","error_type":null}' },
  ]);
  const { gradeFreeText } = await import("./ai/features");
  const out = await gradeFreeText({ prompt: "a", sample: "b" }, "c");
  assert.ok(out.ok);
  assert.equal(seen.length, 2, "one more request, not more");
  assert.equal(seen[1].output_config.format, undefined);
  assert.match(seen[1].system[0].text, /JSON-Schema/);
});

test("Anthropic: another 400 is the provider's error with its code, no second request", async () => {
  const { seen } = await setup([{ status: 400, message: "model: not found" }]);
  const { gradeFreeText } = await import("./ai/features");
  const out = await gradeFreeText({ prompt: "a", sample: "b" }, "c");
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.cause, "anbieter");
  assert.equal(!out.ok && out.code, 400);
  assert.equal(seen.length, 1);
  assert.doesNotMatch(!out.ok ? out.message : "", /test-key/, "the key never shows up");
});

test("Anthropic: a refusal comes back as refused", async () => {
  await setup([{ text: "", stop: "refusal" }]);
  const { gradeFreeText } = await import("./ai/features");
  const out = await gradeFreeText({ prompt: "a", sample: "b" }, "c");
  assert.equal(!out.ok && out.cause, "verweigert");
});

test("Anthropic: request shape per model", async () => {
  const { requestShape } = await import("./ai/providers/anthropic");
  const { FUNCTIONS } = await import("./ai/config");
  assert.deepEqual(requestShape("claude-sonnet-5-5", FUNCTIONS.textanalyse), { thinking: { type: "adaptive" }, output_config: { effort: "medium" } });
  assert.deepEqual(requestShape("claude-haiku-5-5", FUNCTIONS.echtzeit), { thinking: { type: "disabled" }, output_config: { effort: "low" } });
  assert.deepEqual(requestShape("claude-haiku-4-5", FUNCTIONS.echtzeit), { output_config: {} });
});

test("budget: Anthropic has its own 90 $ per month, OpenRouter keeps 10 €, each stops only its own provider", async () => {
  const { r, db } = await setup([{ text: '{"correct":true,"feedback":"Passt.","error_label":null,"error_type":null}' }]);
  const log = await import("./ai/log");
  const { budget } = await import("./ai/config");
  const { gradeFreeText } = await import("./ai/features");
  assert.equal(budget("anthropic").monthlyUsd, 90);
  assert.equal(budget("anthropic").currency, "usd");
  assert.equal(budget().monthlyEur, 10, "the general budget stays at 10 €");
  const add = (provider: "anthropic" | "openrouter", usd: number, at = Date.now()) =>
    log.logCall({ fn: "aufgaben", tier: "standard", provider, model: "m", teacherId: null, unitId: null, trigger: "", input: 0, output: 0, cacheWrite: 0, cacheRead: 0, durationMs: 0, costUsd: usd, status: "ok", at });

  add("openrouter", 50);
  assert.equal(log.budgetState(Date.now(), "allgemein").level, "aus");
  assert.equal(log.budgetState(Date.now(), "anthropic").level, "ok", "OpenRouter costs do not count for Anthropic");
  assert.ok((await gradeFreeText({ prompt: "a", sample: "b" }, "c")).ok, "Anthropic runs while the OpenRouter budget is used up");
  assert.equal(r.budgetUsedUp("textkorrektur"), false, "the Textkorrektur check before sending asks the Anthropic budget too");

  // last month's costs do not count: the credits start again each month
  const lastMonth = new Date();
  lastMonth.setUTCDate(1);
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  add("anthropic", 500, lastMonth.getTime());
  assert.equal(log.budgetState(Date.now(), "anthropic").level, "ok");

  add("anthropic", 72);
  assert.equal(log.budgetState(Date.now(), "anthropic").level, "warnung", "over 80 % of 90 $");
  add("anthropic", 18);
  assert.equal(log.budgetState(Date.now(), "anthropic").level, "aus");
  r.resetRouter();
  const stopped = await gradeFreeText({ prompt: "a", sample: "b" }, "anders");
  assert.equal(!stopped.ok && stopped.status, "budget");
  assert.equal(r.budgetUsedUp("textkorrektur"), true);
  process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "200";
  assert.equal(log.budgetState(Date.now(), "anthropic").level, "ok");
  delete process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
  db.exec("DELETE FROM ai_calls");
});

test("upgrade: old cost rows get their provider from the model name", async () => {
  const { openDatabase } = await import("./db");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-ai-calls-"));
  const file = path.join(dir, "alt.db");
  const old = new Database(file);
  old.exec(`CREATE TABLE ai_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, fn TEXT NOT NULL, tier TEXT NOT NULL, model TEXT NOT NULL,
    teacher_id INTEGER, unit_id INTEGER, trigger TEXT NOT NULL DEFAULT '', input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', test INTEGER NOT NULL DEFAULT 0)`);
  const ins = old.prepare("INSERT INTO ai_calls (created_at, fn, tier, model, status) VALUES ('2026-10-01T00:00:00.000Z', 'aufgaben', 'standard', ?, 'ok')");
  for (const m of ["anthropic/claude-haiku-5.5", "claude-sonnet-5-5", "manuell", "m"]) ins.run(m);
  old.close();
  const conn = openDatabase(file);
  const rows = conn.prepare("SELECT model, provider, thinking_tokens FROM ai_calls ORDER BY id").all() as { model: string; provider: string; thinking_tokens: number | null }[];
  conn.close();
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(
    rows.map((x) => [x.model, x.provider, x.thinking_tokens]),
    [
      ["anthropic/claude-haiku-5.5", "openrouter", null],
      ["claude-sonnet-5-5", "anthropic", null],
      ["manuell", "manual", null],
      ["m", "", null],
    ],
  );
});

test("cleanup", async () => {
  const { setAnthropicClientForTests } = await import("./ai/providers/anthropic");
  setAnthropicClientForTests(null);
  delete process.env.ANTHROPIC_API_KEY;
});
