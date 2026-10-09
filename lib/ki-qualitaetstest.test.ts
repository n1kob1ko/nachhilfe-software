import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "AI_PROVIDER"]) delete process.env[k];
// as on Railway: OpenRouter with its default models, Textkorrektur on Sonnet (the key is a dummy, the transport is replaced)
process.env.OPENROUTER_API_KEY = "test-ohne-wert";
process.env.AI_TEXT_MODEL = "anthropic/claude-sonnet-5.5";

const base = {
  topic: "t", difficulty: "mittel", passage: null, options: null, correct_option: null, accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null,
  case_sensitive: false, faulty_text: null, corrected_text: null, text_errors: null, answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null,
  round_to: null, parts: null, criteria: ["richtig gelöst"], solution_steps: [], estimated_time_sec: 60, hints: ["Bring die Zahlen auf eine Seite."], common_errors: [],
};
const EQ = (start: string, steps: string[], result: string) => ({
  ...base, format: "rechenweg", category: "rechenweg", skill_ids: ["mathe.gleichungen.einfach"], prompt: "Löse die Gleichung. Schreib jeden Rechenschritt in eine eigene Zeile.", math_start: start, variable: "x", accepted_answers: [result], solution_steps: steps, solution: steps.join(", "),
});
const PARAS = [
  "Der Igel Stachel wohnte am Rand eines großen Gartens. Im Herbst wurden die Tage kürzer und die Nächte kalt.",
  "Stachel suchte einen warmen Platz. Unter der alten Hecke fand er einen Haufen Laub, der trocken und weich war.",
  "Dort rollte er sich zusammen und schlief bis zum Frühling.",
];
const QUESTIONS = ["Wo wohnte der Igel?", "Warum suchte Stachel einen warmen Platz?", "Was bedeutet das Wort trocken hier?"];

async function fake(r: typeof import("./ai/router"), seen: { fn: string; model: string; thinking: string; effort: string; prompt: string }[], tasksFor: (prompt: string) => unknown[]) {
  r.setTransport(async (p) => {
    const prompt = typeof p.content === "string" ? p.content : "";
    seen.push({ fn: p.fn, model: p.model, thinking: p.thinking, effort: p.effort, prompt });
    let parsed: unknown;
    if (p.fn === "lesen" && prompt.startsWith("Schreibe einen Lesetext")) parsed = { title: "Stachel", paragraphs: PARAS };
    else if (p.fn === "lesen") {
      const n = Number(/Fragenplan \((\d+)/.exec(prompt)?.[1] ?? 0);
      parsed = {
        questions: QUESTIONS.slice(0, n).map((q, i) => ({ slot: i + 1, aspect: "info", format: "offen", prompt: q, sample_answer: "Eine Antwort aus dem Text.", criteria: ["nennt die Stelle"], several_answers_right: false, evidence: [{ paragraph: i + 1, quote: PARAS[i].split(".")[0] }], gap_text: null, options: null, correct_option: null, answer_lines: 2, hint: null })),
      };
    } else if (p.fn === "textkorrektur")
      parsed = {
        findings: [
          { para: 2, quote: "Stal", replacement: "Stall", category: "rechtschreibung", kind: "fehler", rule: "Mitlautverdopplung", explanation: "Nach kurzem a: ll.", skill_id: null },
          { para: 4, quote: "Jause", replacement: "Brotzeit", category: "ausdruck", kind: "fehler", rule: "Wortwahl", explanation: "Erfunden falsch.", skill_id: null },
          { para: 5, quote: "nach hause", replacement: "nach Hause", category: "rechtschreibung", kind: "fehler", rule: "Großschreibung", explanation: "Hause groß.", skill_id: null },
          { para: 5, quote: "Gibtsnicht", replacement: "x", category: "rechtschreibung", kind: "fehler", rule: "r", explanation: "Steht nicht im Text.", skill_id: null },
        ],
        hints: [], strengths: ["Lebendig erzählt."], main_issue: null, recommendation: null, recommendation_skill_id: null,
      };
    else parsed = { tasks: tasksFor(prompt) };
    return { parsed: p.schema.parse(parsed), refusal: false, model: p.model, usage: { input: 1000, output: 800, cacheWrite: 0, cacheRead: 0, reasoning: 300 }, costUsd: 0.002 };
  });
}

test("KI-Qualitätstest: each case runs through the app's functions, with model, time, tokens, cost and the app's checks", async () => {
  const r = await import("./ai/router");
  const { runQualityTest, LOG_PREFIX } = await import("./ai/qualitaetstest");
  const F = await import("./ai/qualitaetstest-faelle");
  const C06 = F.LESSONS.find((c) => c.nr === "06")!;
  const seen: Parameters<typeof fake>[1] = [];
  let round = 0;
  // the first answer has one task the app's line check rejects (3x = 16 is wrong), the second round brings it right
  await fake(r, seen, (prompt) => {
    if (prompt.includes("Erstelle genau 2")) return round++ === 0 ? [EQ("3x + 7 = 22", ["3x = 15", "x = 5"], "5"), EQ("2x - 4 = 12", ["2x = 16", "x = 7"], "7")] : [EQ("2x - 4 = 12", ["2x = 16", "x = 8"], "8")];
    return [EQ("5x = 20", ["x = 4"], "4")];
  });
  const lines: string[] = [];
  const exercise = { nr: "X1", group: "Unterstufe" as const, title: "Gleichungen", kind: "aufgaben" as const, subject: "Mathematik", schoolType: "Mittelschule", klasse: 3, skills: [{ id: "mathe.gleichungen.einfach", name: "Einfache lineare Gleichungen", area: "Gleichungen", difficulty: "mittel" as const }] };
  const state = await runQualityTest({
    log: (l) => lines.push(l),
    concurrency: 2,
    cases: [
      { ...exercise, plan: ["rechenweg", "rechenweg"] },
      { ...exercise, nr: "X2", plan: ["rechenweg", "rechenweg"], split: true, variant: "eine Anfrage je Aufgabe" },
      { ...exercise, nr: "X3", plan: ["rechenweg"], override: { thinking: "aus", model: "anthropic/claude-sonnet-5.5" }, rounds: 1 },
      { nr: "X4", group: "Volksschule", title: "Lesen", kind: "lesen", subject: "Deutsch", schoolType: "Volksschule", klasse: 3, topic: "Igel", textType: "erzaehlung", difficulty: "leicht", words: 60, aspects: ["info", "zusammenhang", "wort"], cloze: false, mc: false },
      C06,
    ],
  });
  assert.equal(state.running, false);
  assert.deepEqual(state.results.map((x) => x.nr), ["X1", "X2", "X3", "X4", "06"], "in the order of the cases");
  const [x1, x2, x3, x4, c06] = state.results;

  // like the builder: the rejected task is asked for once more
  assert.equal(x1.calls.length, 2);
  assert.match(x1.summary, /^2\/2 Aufgaben von der KI angenommen, 1 verworfen/);
  assert.ok(x1.lines.some((l) => l.startsWith("Verworfen: Runde 1: rechenweg/rechenweg")), x1.lines.join("\n"));
  assert.equal(x1.calls[0].reasoning, 300, "thinking tokens as the provider reports them");
  assert.equal(x1.usd, 0.004);

  assert.equal(x2.calls.length, 2, "one request per task");
  assert.ok(seen.some((s) => s.model === "anthropic/claude-sonnet-5.5" && s.thinking === "aus"), "the comparison's model and thinking reach the provider");
  assert.deepEqual(x3.models, ["anthropic/claude-sonnet-5.5"]);
  assert.ok(seen.filter((s) => s.fn === "aufgaben" && s.model !== "anthropic/claude-sonnet-5.5").every((s) => s.thinking === "adaptiv" && s.effort === "medium"), "the other cases keep the app's settings");

  assert.match(x4.summary, /3\/3 Fragen/);
  assert.match(x4.summary, /3 mit Textbeleg/);

  // the Textkorrektur against the known errors and the correct Austrian words
  assert.match(c06.summary, /^2\/12 eingebaute Fehler gefunden, 1 richtige Stellen als falsch markiert/);
  assert.match(c06.summary, /1 ohne Stelle/, "a quote that is not in the text becomes a note, as in the app");
  assert.ok(c06.lines.includes("Richtig, aber markiert: Jause – „Jause“ → „Brotzeit“ (fehler)"));

  // everything in the log, one line per task or finding, never longer than the limit
  assert.ok(lines.some((l) => l.startsWith(`${LOG_PREFIX} X1 aufgabe-2 `)));
  assert.ok(lines.some((l) => l.startsWith(`${LOG_PREFIX} X4 text-1 `)));
  assert.ok(lines.some((l) => l.startsWith(`${LOG_PREFIX} 06 abgleich `)));
  assert.ok(lines.at(-1)!.startsWith(`${LOG_PREFIX} ende `));
  assert.ok(lines.every((l) => l.length < 3_100));
  r.setTransport(null);
  r.resetRouter();
});

test("KI-Qualitätstest: a case that could go over the limit is skipped, nothing is sent for it", async () => {
  const r = await import("./ai/router");
  const { runQualityTest, reserveFor } = await import("./ai/qualitaetstest");
  const F = await import("./ai/qualitaetstest-faelle");
  const seen: Parameters<typeof fake>[1] = [];
  await fake(r, seen, () => []);
  const c20 = F.LESSONS.find((c) => c.nr === "20")!;
  assert.ok(reserveFor(c20) > 0.01, "a long text on the configured model");
  const state = await runQualityTest({ cases: [c20], capUsd: 0.01, log: () => {} });
  assert.equal(seen.length, 0);
  assert.equal(state.results[0].status, "übersprungen");
  assert.match(state.results[0].summary, /Grenze 0\.01 \$/);
  r.setTransport(null);
  r.resetRouter();
});

test("KI-Qualitätstest: every case stays far below 1 € at most, and all cases fit the plan of the request", async () => {
  const { reserveFor } = await import("./ai/qualitaetstest");
  const F = await import("./ai/qualitaetstest-faelle");
  // 20 lessons, row 3 in two parts
  assert.equal(new Set(F.LESSONS.map((c) => c.nr.slice(0, 2))).size, 20);
  assert.equal(new Set(F.ALL_CASES.map((c) => c.nr)).size, F.ALL_CASES.length, "numbers are unique");
  for (const c of F.ALL_CASES) assert.ok(reserveFor(c) < 0.25, `${c.nr}: ${reserveFor(c)}`);
  // every known error and every correct place is really in the text
  for (const c of F.ALL_CASES) {
    if (c.kind !== "text") continue;
    const text = c.blocks.map((b) => b.text).join("\n");
    for (const k of c.known) assert.ok(text.includes(k.wrong), `${c.nr}: ${k.wrong}`);
    for (const t of c.traps) assert.ok(text.includes(t), `${c.nr}: ${t}`);
  }
});

test("KI-Qualitätstest: long log lines are split without cutting at a space and join up again", async () => {
  const { logLines, LOG_PREFIX } = await import("./ai/qualitaetstest");
  const payload = { p: "Wort ".repeat(1_500).trim(), n: 1 };
  const lines = logLines("13 text-2", payload);
  assert.ok(lines.length > 1);
  const parts = lines.map((l) => {
    const m = /^\[KI-Qualitaetstest\] 13 text-2 \[(\d+)\/(\d+)\] (.*)$/s.exec(l)!;
    assert.equal(Number(m[2]), lines.length);
    assert.ok(!/^\s|\s$/.test(m[3]), "no space at the ends");
    return m[3];
  });
  assert.deepEqual(JSON.parse(parts.join("")), payload);
  assert.equal(logLines("01 ergebnis", { a: 1 })[0], `${LOG_PREFIX} 01 ergebnis {"a":1}`);
});

test("Router: settings of the quality test never touch other requests, and its answers are not reused", async () => {
  const r = await import("./ai/router");
  const { z } = await import("zod");
  const seen: string[] = [];
  r.setTransport(async (p) => {
    seen.push(`${p.model}/${p.thinking}`);
    return { parsed: { ok: true }, refusal: false, model: p.model, usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0 } };
  });
  const S = z.object({ ok: z.boolean() });
  // textkorrektur answers the same text from memory for a day
  await r.runAI("textkorrektur", S, "s", "gleicher Text");
  const again = await r.runAI("textkorrektur", S, "s", "gleicher Text");
  assert.equal(again.ok && again.reused, true);
  const inTest = await r.withAIOverride({ tag: "qt1", thinking: "aus", model: "m-test" }, () => r.runAI("textkorrektur", S, "s", "gleicher Text"));
  assert.equal(inTest.ok && inTest.reused, false, "a test run asks the provider itself");
  const after = await r.runAI("textkorrektur", S, "s", "gleicher Text");
  assert.equal(after.ok && after.reused, true);
  assert.equal(seen.length, 2);
  assert.match(seen[0], /\/adaptiv$/);
  assert.equal(seen[1], "m-test/aus");
  r.setTransport(null);
  r.resetRouter();
});
