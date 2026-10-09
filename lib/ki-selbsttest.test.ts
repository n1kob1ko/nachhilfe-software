import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "AI_PROVIDER"]) delete process.env[k];

const base = {
  topic: "t", difficulty: "leicht", passage: null, options: null, correct_option: null, accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null,
  case_sensitive: false, faulty_text: null, corrected_text: null, text_errors: null, answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null,
  round_to: null, parts: null, criteria: ["richtig bestimmt"], solution_steps: [], estimated_time_sec: 60, hints: ["Denk an die Probe."], common_errors: [],
};
const DE = [
  { ...base, format: "cloze", category: "wortarten", skill_ids: ["deutsch.wortarten.bestimmen"], prompt: "Bestimme die Wortarten.\n„Die müde Katze schläft.“\nmüde: ___\nKatze: ___\nschläft: ___", blanks: [["Adjektiv"], ["Nomen"], ["Verb"]], solution: "müde = Adjektiv, Katze = Nomen, schläft = Verb" },
  { ...base, format: "cloze", category: "wortarten", skill_ids: ["deutsch.wortarten.bestimmen"], prompt: "Bestimme die Wortarten.\n„Der kleine Hund bellt.“\nkleine: ___\nHund: ___\nbellt: ___", blanks: [["Adjektiv"], ["Nomen"], ["Verb"]], solution: "kleine = Adjektiv, Hund = Nomen, bellt = Verb" },
];
const MA = [
  { ...base, format: "rechenweg", category: "rechenweg", skill_ids: ["mathe.gleichungen.einfach"], prompt: "Löse die Gleichung. Schreib jeden Rechenschritt in eine eigene Zeile.", math_start: "3x + 7 = 22", variable: "x", accepted_answers: ["5"], solution_steps: ["3x = 15", "x = 5"], solution: "3x = 15, x = 5" },
  {
    ...base, format: "sachaufgabe", category: "sachaufgabe", skill_ids: ["mathe.gleichungen.text"], prompt: "Lena kauft 3 Hefte zu je 2 € und einen Stift um 4 €.", solution: "a) 6 €, b) 10 €",
    parts: [
      { label: "a)", prompt: "Was kosten die Hefte?", kind: "zahl", answers: ["6 €"], unit: "€", follow: null, solution: "3 · 2 = 6", sample_answer: null },
      { label: "b)", prompt: "Was zahlt sie insgesamt?", kind: "zahl", answers: ["10 €"], unit: "€", follow: "a + 4", solution: "6 + 4 = 10", sample_answer: null },
    ],
  },
];
const TEXT = {
  findings: [
    { para: 1, quote: "Hunt", replacement: "Hund", category: "rechtschreibung", kind: "fehler", rule: "Auslaut", explanation: "Hund schreibt man mit d.", skill_id: null },
    { para: 1, quote: "grosen", replacement: "großen", category: "rechtschreibung", kind: "fehler", rule: "ß", explanation: "Nach langem o steht ß.", skill_id: null },
    { para: 1, quote: "geholt dan", replacement: "geholt. Dann", category: "zeichensetzung", kind: "fehler", rule: "Satzende", explanation: "Hier endet ein Satz.", skill_id: null },
    { para: 1, quote: "nach hause", replacement: "nach Hause", category: "rechtschreibung", kind: "fehler", rule: "Großschreibung", explanation: "„nach Hause“ schreibt man groß.", skill_id: null },
  ],
  hints: [], strengths: ["Anschaulich erzählt."], main_issue: "Rechtschreibung", recommendation: null, recommendation_skill_id: null,
};

test("KI-Selbsttest: a tiny request first, then one Deutsch, one Mathematik and one Textkorrektur request, each with model, time and cost", async () => {
  const r = await import("./ai/router");
  const { runSelfTest } = await import("./ai/selbsttest");
  const { monthSpend } = await import("./ai/log");
  const asked: { fn: string; prompt: string; maxTokens: number }[] = [];
  r.setTransport(async (p) => {
    const prompt = typeof p.content === "string" ? p.content : "";
    asked.push({ fn: p.fn, prompt, maxTokens: p.maxTokens });
    const parsed = p.fn === "verbindungstest" ? { ok: true } : p.fn === "textkorrektur" ? TEXT : { tasks: prompt.includes("Fach: Deutsch") ? DE : MA };
    return { parsed: p.schema.parse(parsed), refusal: false, model: "anthropic/claude-haiku-5.5", usage: { input: 1000, output: 500, cacheWrite: 0, cacheRead: 0 }, costUsd: 0.001 };
  });
  const steps = await runSelfTest({ teacherId: null });
  assert.deepEqual(asked.map((a) => a.fn), ["verbindungstest", "aufgaben", "aufgaben", "textkorrektur"], "four requests, no more");
  assert.equal(asked[0].maxTokens, 50, "the first request is tiny");
  assert.match(asked[1].prompt, /3\. Klasse Volksschule/);
  assert.match(asked[1].prompt, /Erlaubte Wortarten: Nomen, Verb, Adjektiv\./, "Volksschule: only Nomen, Verb and Adjektiv");
  for (const s of steps) {
    assert.equal(s.ok, true, `${s.key}: ${s.message}`);
    assert.equal(s.model, "anthropic/claude-haiku-5.5");
    assert.equal(s.usd, 0.001, "the cost reported by the provider");
  }
  assert.equal(steps.find((s) => s.key === "text")!.message, "4 von 4 eingebauten Fehlern gefunden, 4 Markierungen insgesamt.");
  assert.ok(Math.abs(monthSpend() - 0.004) < 1e-9, "test requests count for the budget");
  r.setTransport(null);
  r.resetRouter();
});

test("KI-Selbsttest: when the tiny request fails, nothing else is sent", async () => {
  const r = await import("./ai/router");
  const { runSelfTest } = await import("./ai/selbsttest");
  let n = 0;
  r.setTransport(async () => {
    n++;
    throw new Error("OpenRouter antwortet mit 401: Unauthorized");
  });
  const steps = await runSelfTest();
  assert.equal(n, 1);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].ok, false);
  assert.match(steps[0].message, /401/);
  r.setTransport(null);
  r.resetRouter();
});

test("KI-Selbsttest: a Wortarten task beyond the Volksschule level fails the Deutsch step", async () => {
  const r = await import("./ai/router");
  const { runSelfTest } = await import("./ai/selbsttest");
  const pronomen = { ...DE[0], format: "mc", prompt: "Welche Wortart hat das Wort in eckigen Klammern?\n„[Er] spielt.“", blanks: null, options: ["Nomen", "Pronomen", "Verb"], correct_option: 1, solution: "Er = Pronomen" };
  r.setTransport(async (p) => {
    const prompt = typeof p.content === "string" ? p.content : "";
    const parsed = p.fn === "verbindungstest" ? { ok: true } : p.fn === "textkorrektur" ? TEXT : { tasks: prompt.includes("Fach: Deutsch") ? [pronomen, pronomen] : MA };
    return { parsed: p.schema.parse(parsed), refusal: false, model: "m", usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0 }, costUsd: 0 };
  });
  const steps = await runSelfTest();
  const de = steps.find((s) => s.key === "deutsch")!;
  assert.equal(de.ok, false, "the app rejects Pronomen in the 3rd class, nothing usable is left");
  assert.match(de.message, /0 von 2/);
  r.setTransport(null);
  r.resetRouter();
});

test("KI-Selbsttest: a task the app does not let through is shown with the reason", async () => {
  const r = await import("./ai/router");
  const { runSelfTest } = await import("./ai/selbsttest");
  // a wrong line in the working, and a part result whose unit is only in its own field (that one is kept)
  const wrongWay = { ...MA[0], solution_steps: ["3x = 29", "x = 5"] };
  const bareUnit = { ...MA[1], parts: MA[1].parts!.map((p) => ({ ...p, answers: [p.answers![0].replace(" €", "")] })) };
  r.setTransport(async (p) => {
    const prompt = typeof p.content === "string" ? p.content : "";
    const parsed = p.fn === "verbindungstest" ? { ok: true } : p.fn === "textkorrektur" ? TEXT : { tasks: prompt.includes("Fach: Deutsch") ? DE : [wrongWay, bareUnit] };
    return { parsed: p.schema.parse(parsed), refusal: false, model: "m", usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0 }, costUsd: 0 };
  });
  const ma = (await runSelfTest()).find((s) => s.key === "mathe")!;
  assert.equal(ma.ok, false);
  assert.match(ma.message, /1 von 2/);
  const rejected = ma.details.filter((d) => d.startsWith("Verworfen:"));
  assert.equal(rejected.length, 1);
  assert.match(rejected[0], /rechenweg: Im Lösungsweg passt Zeile 1 nicht .*Weg: 3x = 29 \| x = 5/);
  assert.ok(ma.details.some((d) => d.includes("a) Was kosten die Hefte?")), "the Sachaufgabe with „6“ and unit € is kept");
  r.setTransport(null);
  r.resetRouter();
});

test("Rechenweg from the KI: a result only in the last line of the working is taken from there and checked", async () => {
  const { fillPlan } = await import("./ai/features");
  const { categoriesFor } = await import("./curriculum");
  const req = {
    subject: "Mathematik", level: "3. Klasse Mittelschule", count: 1, categories: categoriesFor("Mathematik").filter((c) => c.key === "rechenweg"),
    skills: [{ id: "mathe.gleichungen.einfach", name: "Gleichungen", area: "Gleichungen", difficulty: "mittel" as const }],
    plan: [{ skillId: "mathe.gleichungen.einfach", category: "rechenweg" }],
  };
  const t = { ...MA[0], math_start: "5x - 8 = 27", accepted_answers: null, solution_steps: ["5x = 35", "x = 7"] };
  const [ok] = fillPlan([t as never], req);
  assert.deepEqual(ok?.answer.accepted, ["7"]);
  // a wrong last line is still caught by the check
  const rejected: string[] = [];
  const [bad] = fillPlan([{ ...t, solution_steps: ["5x = 35", "x = 8"] } as never], req, Math.random, rejected);
  assert.equal(bad, null);
  assert.match(rejected[0], /rechenweg: /);
});
