import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type AIRequest = import("./ai/router").AIRequest;

test("Testtexte: jede Fehlerstelle eindeutig, jede Korrektur ergibt einen anderen Text, Fallen vorhanden", async () => {
  const { TEXT_CASES } = await import("./ai/textkorrektur-test-faelle");
  assert.ok(TEXT_CASES.length >= 5);
  for (const c of TEXT_CASES) {
    for (const e of c.errors) {
      const t = c.blocks[e.para - 1]?.text ?? "";
      assert.equal(t.split(e.wrong).length, 2, `${c.nr}: „${e.wrong}“ genau einmal in Absatz ${e.para}`);
      assert.ok(e.right.length > 0 && e.right.every((r) => r !== e.wrong), `${c.nr}: ${e.wrong}`);
    }
    for (const z of [...c.correct, ...(c.neutral ?? [])]) assert.ok(c.blocks[z.para - 1]?.text.includes(z.text), `${c.nr}: „${z.text}“`);
    assert.ok(!/Haohao/i.test(JSON.stringify(c)), "no real student text");
  }
});

test("Abgleich mit der Musterkorrektur: richtig, falsch korrigiert, Falle, zusätzlich, markiert, aussortiert", async () => {
  const { evaluate } = await import("./ai/textkorrektur-test");
  const c = {
    nr: "X",
    title: "Test",
    subject: "Deutsch",
    schoolType: "Volksschule",
    klasse: 4,
    textKind: "Erzählung",
    task: "",
    blocks: [{ text: "Wir furen mit meine Oma zum See und assen Paradeiser.", heading: false }],
    errors: [
      { para: 1, wrong: "furen", right: ["fuhren"], category: "rechtschreibung", what: "fuhren" },
      { para: 1, wrong: "meine Oma", right: ["meiner Oma"], category: "grammatik", what: "Dativ" },
      { para: 1, wrong: "assen", right: ["aßen"], category: "rechtschreibung", what: "aßen" },
    ],
    correct: [{ para: 1, text: "Paradeiser", why: "österreichisch" }],
  };
  const t = c.blocks[0].text;
  const item = (quote: string, replacement: string, o: { kind?: "fehler" | "stil"; review?: "" | "lehrer" | "verworfen"; at?: number } = {}) => {
    const start = o.at ?? t.indexOf(quote);
    return { block: 0, pos_start: start, pos_end: start + quote.length, quote, replacement, kind: o.kind ?? "fehler", category: "x", review: o.review ?? "", review_note: "", origin: "" as const, explanation: "" };
  };
  const r = evaluate(c, [
    item("furen", "fuhren"),
    // the case is wrong: found, but not an accepted correction
    item("meine Oma", "meinen Oma", { review: "lehrer" }),
    item("Paradeiser", "Tomaten"),
    item("zum See", "an den See", { kind: "stil" }),
    item("assen", "aßen", { review: "verworfen" }),
  ]);
  assert.deepEqual(
    { ...r.score },
    { errors: 3, found: 2, fixed: 1, wrongFix: 1, missed: 1, traps: 1, extraFehler: 0, extraStil: 1, unplaced: 0, flaggedFixed: 0, flaggedDoubtful: 1, unflaggedDoubtful: 1, sortedOutFixed: 1, sortedOutDoubtful: 0 },
  );
  assert.deepEqual(r.errors.map((e) => e.status), ["richtig", "falsch", "verpasst"]);
  // one suggestion that fixes two errors at once counts for both
  const both = evaluate(c, [{ ...item("furen mit meine Oma", "fuhren mit meiner Oma") }]);
  assert.equal(both.score.fixed, 2);
});

test("Textkorrektur-Test: beide Wege laufen mit der KI, fünf Arten werden verglichen, Kosten bleiben unter der Grenze", async () => {
  const { runTextTest, WAYS } = await import("./ai/textkorrektur-test");
  const { TEXT_CASES } = await import("./ai/textkorrektur-test-faelle");
  const router = await import("./ai/router");
  router.resetRouter();
  const calls: AIRequest[] = [];
  const cases = TEXT_CASES.slice(0, 2);
  router.setTransport(async (req) => {
    calls.push(req);
    const prompt = String(req.content);
    const c = cases.find((x) => prompt.includes(x.blocks[1].text.slice(0, 40)))!;
    const usage = { input: 3000, output: 2000, cacheWrite: 0, cacheRead: 0 };
    if (req.fn === "textkorrektur") {
      // finds every error but the last, fixes them as the key says
      const findings = c.errors.slice(0, -1).map((e) => ({ para: e.para, quote: e.wrong, replacement: e.right[0], category: e.category, kind: "fehler", rule: "r", explanation: "e", skill_id: null }));
      return { parsed: { findings, hints: [], strengths: [], main_issue: null, recommendation: null, recommendation_skill_id: null }, refusal: false, model: req.model, usage };
    }
    if (req.fn === "textanalyse") {
      const sentences = [...prompt.matchAll(/^\[(\d+)\.(\d+)\](?: \(Überschrift\))? (.*)$/gm)].map((m) => ({ id: `${m[1]}.${m[2]}`, para: Number(m[1]), text: m[3] }));
      const out = sentences.map((s) => ({
        id: s.id,
        corrected: "",
        findings: c.errors.filter((e) => e.para === s.para && s.text.includes(e.wrong)).map((e) => ({ quote: e.wrong, replacement: e.right[0], category: e.category, kind: "fehler", rule: "r", explanation: "e", skill_id: null, sure: true })),
      }));
      return { parsed: { sentences: out, hints: [], strengths: [], main_issue: null, recommendation: null, recommendation_skill_id: null }, refusal: false, model: req.model, usage };
    }
    const checks = [...prompt.matchAll(/^Vorschlag (\d+) /gm)].map((m) => ({ nr: Number(m[1]), verdict: "richtig", explanation_ok: true, better_replacement: null, better_explanation: null, reason: "" }));
    return { parsed: { checks, missed: [] }, refusal: false, model: req.model, usage };
  });
  const lines: string[] = [];
  const state = await runTextTest({ cases, capUsd: 5, log: (l) => lines.push(l) });
  router.setTransport(null);
  assert.equal(state.running, false);
  assert.deepEqual(state.results.map((r) => r.status), ["fertig", "fertig"]);
  assert.deepEqual(
    calls.map((r) => r.fn).sort(),
    ["textanalyse", "textanalyse", "textkorrektur", "textkorrektur", "textpruefung", "textpruefung"],
    "two ways with real requests, the other three derived from the same answers",
  );
  const t = state.totals!;
  assert.deepEqual(Object.keys(t), WAYS.map((w) => w.key));
  const errors = cases.reduce((n, c) => n + c.errors.filter((e) => !e.optional).length, 0);
  assert.equal(t.einfach.score.errors, errors);
  assert.equal(t.einfach.score.missed, 2, "the stand-in misses the last error of each text");
  assert.ok(t.gruendlich.score.fixed >= errors - 2, JSON.stringify(t.gruendlich.score));
  assert.ok(t.gruendlich.calls === 4 && t.einfach.calls === 2);
  assert.ok(t.gruendlich.usd > t.einfach.usd, "cost of each way from the logged requests");
  assert.ok(lines.some((l) => l.startsWith("[KI-Textkorrektur-Test] ") && l.includes(" gruendlich v1 ")), "every suggestion goes to the log");
  assert.ok(lines.every((l) => !/sk-or-|OPENROUTER_API_KEY/.test(l)));

  // a cap that one text could pass: nothing is sent
  calls.length = 0;
  router.setTransport(async () => {
    throw new Error("darf nicht gerufen werden");
  });
  const capped = await runTextTest({ cases: cases.slice(0, 1), capUsd: 0.0001, log: () => {} });
  router.setTransport(null);
  assert.equal(capped.results[0].status, "übersprungen");
});
