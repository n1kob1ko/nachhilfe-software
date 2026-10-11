import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR"]) delete process.env[k];

/**
 * Textkorrektur when the KI fails (2026-10-11): a failed run never reads as a text without errors, a failed second
 * check keeps step 1's suggestions (marked, none accepted), „Erneut versuchen“ repeats only what failed, once per
 * click, after the budget check, and keeps every decision of the teacher. The requests go through the real OpenRouter
 * adapter to a local stand-in, so the answers are what OpenRouter sends: N01 (step 1 without a usable answer) and N14
 * (step 2 back after 1.3 s, 0 tokens, 0 cost: an error in an HTTP 200). Synthetic texts only, none of the test sets.
 */

type Mode =
  | "ok"
  | "fehlerfrei"
  | "keine-saetze"
  | "leer"
  | "keine-choices"
  | "fehler-im-body"
  | "json"
  | "schema"
  | "abgeschnitten"
  | "http401"
  | "http429"
  | "http500"
  | "haengt";
type Step = "analyse" | "pruefung";

const LINES = ["Am Samstag gieng ich mit meinem Bruder in den Park.", "Wir spielten Fußball. Danach assen wir ein Eis."];
const CLEAN = ["Am Samstag ging ich mit meinem Bruder in den Park.", "Wir spielten Fußball. Danach aßen wir ein Eis."];
const f = (quote: string, replacement: string, category: string, explanation: string) => ({ quote, replacement, category, kind: "fehler", rule: category, explanation, skill_id: null, sure: true });
/** What step 1 finds: the same two mistakes wherever they are */
const MISTAKES = [f("gieng", "ging", "rechtschreibung", "„ging“ schreibt man ohne e."), f("assen", "aßen", "rechtschreibung", "Nach langem a steht ß.")];
/** Step 1's answer for every sentence of the prompt („[1.1] …“), as „gründlich neu“ asks for it */
function analysis(prompt: string, mode: Mode) {
  const sentences =
    mode === "keine-saetze"
      ? []
      : [...prompt.matchAll(/^\[(\d+\.\d+)\] (.*)$/gm)].map(([, id, text]) => {
          const findings = MISTAKES.filter((m) => text.includes(m.quote));
          return { id, corrected: findings.reduce((t, m) => t.replace(m.quote, m.replacement), text), findings };
        });
  return { sentences, hints: [], strengths: ["Klarer Ablauf"], main_issue: "Rechtschreibung", recommendation: "Übung zu ß", recommendation_skill_id: null };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A local stand-in for OpenRouter: answers step 1 and step 2 as `mode` says, records every request. */
async function fakeOpenRouter() {
  const s = { analyse: "ok" as Mode, pruefung: "ok" as Mode, delayMs: 0, seen: [] as { step: Step; user: string }[] };
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const body = JSON.parse(raw) as { model: string; messages: { content: unknown }[] };
      const user = String(body.messages[1]?.content ?? "");
      const step: Step = /^Vorschlag \d+ /m.test(user) ? "pruefung" : "analyse";
      s.seen.push({ step, user });
      if (s.delayMs) await sleep(s.delayMs);
      const mode = s[step];
      if (mode === "haengt") return; // never answers: the router's timeout decides
      const send = (status: number, payload: unknown) => {
        res.statusCode = status;
        res.setHeader("content-type", "application/json");
        res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
      };
      const usage = { prompt_tokens: 1200, completion_tokens: 600, cost: 0.02 };
      const reply = (content: string, finish = "stop") => send(200, { model: body.model, choices: [{ finish_reason: finish, message: { content } }], usage });
      if (mode === "http401") return send(401, { error: { message: "No auth credentials found", code: 401 } });
      if (mode === "http429") return send(429, { error: { message: "Rate limit exceeded: sk-or-v1-geheim", code: 429 } });
      if (mode === "http500") return send(500, { error: { message: "Internal Server Error", code: 500 } });
      // N14: back at once, no tokens, no cost, the model behind OpenRouter failed
      if (mode === "fehler-im-body") return send(200, { error: { code: 502, message: "Upstream error from Anthropic: Overloaded" } });
      if (mode === "keine-choices") return send(200, { id: "gen-1", model: body.model, choices: [] });
      if (mode === "leer") return reply("");
      if (mode === "json") return reply("Hier ist meine Korrektur: alles in Ordnung!");
      // a wrong shape the app cannot repair (most others are repaired to an answer without sentences, see test 2)
      if (mode === "schema") return reply(JSON.stringify({ sentences: "keine" }));
      if (mode === "abgeschnitten") return reply('{"sentences": [{"id": "1.1", "corrected": "Am Samstag ging', "length");
      if (step === "analyse") return reply(JSON.stringify(analysis(user, mode)));
      const checks = [...user.matchAll(/^Vorschlag (\d+) /gm)].map((m) => ({ nr: Number(m[1]), verdict: "richtig", explanation_ok: true, better_replacement: null, better_explanation: null, reason: "Die Regel verlangt das." }));
      return reply(JSON.stringify({ checks, missed: [] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { s, url, steps: () => s.seen.map((x) => x.step), server };
}

/** The stand-in for one test, shut down and the settings removed when the test ends, also when it fails. */
async function apiFor(t: { after: (fn: () => void | Promise<void>) => void }) {
  const a = await fakeOpenRouter();
  t.after(async () => {
    for (const k of ["AI_PROVIDER", "OPENROUTER_API_KEY", "OPENROUTER_BASE_URL", "AI_TEXT_MODEL", "AI_TEXT_GRUENDLICH", "AI_MONTHLY_BUDGET_USD"]) delete process.env[k];
    a.server.closeAllConnections();
    await new Promise<void>((r) => a.server.close(() => r()));
  });
  return a;
}

let nr = 0;
/** A new student and text, OpenRouter set up as on Railway (Sonnet 5.5 for the Textkorrektur, „gründlich neu“). */
async function setup(api: { url: string }, lines: string[] = LINES) {
  Object.assign(process.env, { AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "or-test-key", OPENROUTER_BASE_URL: api.url, AI_TEXT_MODEL: "anthropic/claude-sonnet-5.5", AI_TEXT_GRUENDLICH: "neu" });
  const repo = await import("./repo");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const router = await import("./ai/router");
  const { db } = await import("./db");
  router.resetRouter();
  router.setTransport(null);
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  nr += 1;
  const sid = repo.createStudent({ name: `Kim Ausfall${nr}`, grade: 4, klasse: 4, teacher_id: niko.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: null, subject: "Deutsch", topic: "Erzählung", title: `Mein Samstag ${nr}`, prompt: "Erzähle von deinem Wochenende." });
  // a different text each time: an answer the router remembers is never reused across tests
  const own = lines.map((l, i) => (i === lines.length - 1 ? `${l} Es war Tag ${nr}.` : l));
  assert.ok(texts.saveText(text.id, own.map((x) => ({ t: "p" as const, r: [{ x }] })), 0).ok);
  const first = (db().prepare("SELECT COALESCE(MAX(id), 0) AS id FROM ai_calls").get() as { id: number }).id;
  /** the cost log of this test: one row per request (cache rows included) */
  const calls = () => db().prepare("SELECT fn, status, cost_usd AS cost, error FROM ai_calls WHERE id > ? ORDER BY id").all(first) as { fn: string; status: string; cost: number; error: string }[];
  const start = () => tc.startAICorrection(text.id, niko.id, { consent: true, wait: true, method: "gruendlich" });
  return { tc, router, db, niko, textId: text.id, calls, start };
}

const by = <T extends { quote: string }>(items: T[], q: string) => items.filter((i) => i.quote === q);

test("1: eine vollständig erfolgreiche Korrektur: abgeschlossen, nichts zu wiederholen, nichts gespeichert, was nicht gebraucht wird", async (t) => {
  const api = await apiFor(t);
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  const c = s.tc.getCorrection(res.correctionId)!;
  assert.deepEqual([c.ai_status, c.verify_status, c.verify_error, c.analysis, c.ai_error], ["fertig", "ok", "", "", null]);
  const items = s.tc.listItems(c.id);
  assert.deepEqual(items.filter((i) => i.kind !== "hinweis").map((i) => [i.quote, i.replacement, i.status, i.review]), [["gieng", "ging", "offen", ""], ["assen", "aßen", "offen", ""]]);
  assert.equal(s.tc.retryKind(c), null);
  assert.deepEqual(api.steps(), ["analyse", "pruefung"]);
  assert.deepEqual(s.calls().map((r) => [r.fn, r.status]), [["textanalyse", "ok"], ["textpruefung", "ok"]]);
});

test("2: ein fehlerfreier Text ist fertig ohne Vorschläge; eine Antwort ohne einen einzigen Satz ist ein Fehler, nie „fehlerfrei“", async (t) => {
  const api = await apiFor(t);
  api.s.analyse = "fehlerfrei";
  let s = await setup(api, CLEAN);
  const clean = await s.start();
  assert.ok(clean.ok);
  const c = s.tc.getCorrection(clean.correctionId)!;
  assert.deepEqual([c.ai_status, c.verify_status, c.unchecked], ["fertig", "ok", ""], "every sentence answered");
  assert.equal(s.tc.listItems(c.id).filter((i) => i.kind !== "hinweis").length, 0);
  assert.deepEqual(api.steps(), ["analyse"], "nothing to check a second time");

  api.s.analyse = "keine-saetze";
  s = await setup(api, CLEAN);
  const none = await s.start();
  assert.ok(none.ok);
  const n = s.tc.getCorrection(none.correctionId)!;
  assert.deepEqual([n.ai_status, n.ai_error], ["fehler", "Die KI hat keinen Satz des Textes beantwortet."]);
  assert.equal(s.tc.listItems(n.id).length, 0);
  assert.equal(s.tc.retryKind(n), "ganz");
  // „Erneut versuchen“ asks the KI again: the unusable answer is not remembered and reused (it would fail again for free)
  api.s.analyse = "fehlerfrei";
  const again = await s.tc.retryAICorrection(n.id, s.niko.id, { wait: true });
  assert.deepEqual(again, { ok: true, correctionId: n.id, reused: false });
  const after = s.tc.getCorrection(n.id)!;
  assert.deepEqual([after.ai_status, after.verify_status, after.unchecked], ["fertig", "ok", ""]);
  assert.deepEqual(s.calls().map((r) => [r.fn, r.status]), [["textanalyse", "ok"], ["textanalyse", "ok"]], "a new request, no cache row");
});

test("3: leere, abgeschnittene oder unlesbare Antworten und Fehler des Anbieters: eine klare Meldung ohne Text des Anbieters", async (t) => {
  const api = await apiFor(t);
  const cases: [Mode, string, string][] = [
    ["leer", "Die KI hat eine leere Antwort geschickt.", "abgelehnt"],
    ["keine-choices", "Die KI hat eine leere Antwort geschickt.", "abgelehnt"],
    ["fehler-im-body", "Der KI-Anbieter hat einen Fehler gemeldet.", "abgelehnt"],
    ["json", "Die Antwort der KI war nicht lesbar.", "abgelehnt"],
    ["schema", "Die Antwort der KI hatte nicht die erwartete Form.", "abgelehnt"],
    ["abgeschnitten", "Die Antwort der KI war unvollständig.", "abgelehnt"],
    ["http500", "Der KI-Anbieter hat einen Fehler gemeldet.", "fehler"],
    ["http429", "Der KI-Anbieter ist gerade überlastet.", "fehler"],
    ["http401", "Der KI-Anbieter hat den Zugang abgelehnt. Der API-Schlüssel muss geprüft werden.", "fehler"],
  ];
  for (const [mode, message, status] of cases) {
    api.s.analyse = mode;
    api.s.seen.length = 0;
    const s = await setup(api);
    const res = await s.start();
    assert.ok(res.ok, mode);
    const c = s.tc.getCorrection(res.correctionId)!;
    assert.deepEqual([c.ai_status, c.ai_error], ["fehler", message], mode);
    assert.equal(s.tc.listItems(c.id).length, 0, `${mode}: no suggestion, nothing that reads as „fehlerfrei“`);
    assert.ok(!/Anthropic|Overloaded|Rate limit|credentials|Internal Server|sk-or/.test(c.ai_error!), `${mode}: no provider text for the teacher`);
    // the technical reason is in the cost log, for whoever looks into it later
    const rows = s.calls();
    assert.deepEqual(rows.map((r) => [r.fn, r.status]), [["textanalyse", status]], mode);
    assert.ok(rows[0].error.length > 0, `${mode}: reason logged`);
    // OpenRouter: one free repeat on overload and server errors only, no request at all for step 2
    assert.deepEqual(api.steps(), mode === "http500" || mode === "http429" ? ["analyse", "analyse"] : ["analyse"], mode);
  }
  // N14's signature in the log: the provider's error, no tokens, no cost
  api.s.analyse = "fehler-im-body";
  const s = await setup(api);
  await s.start();
  const [row] = s.calls();
  assert.match(row.error, /OpenRouter meldet einen Fehler \(502\): Upstream error/);
  assert.equal(row.cost, 0);
});

test("4: Zeitlimit: die Korrektur ist fehlgeschlagen, der Lehrer liest es, nichts wird bezahlt", async (t) => {
  const { FUNCTIONS } = await import("./ai/config");
  const before = FUNCTIONS.textanalyse.timeoutMs;
  FUNCTIONS.textanalyse.timeoutMs = 300;
  const api = await apiFor(t);
  api.s.analyse = "haengt";
  try {
    const s = await setup(api);
    const res = await s.start();
    assert.ok(res.ok);
    const c = s.tc.getCorrection(res.correctionId)!;
    assert.deepEqual([c.ai_status, c.ai_error], ["fehler", "Die KI hat nicht rechtzeitig geantwortet."]);
    assert.deepEqual(s.calls().map((r) => [r.fn, r.status, r.cost]), [["textanalyse", "timeout", 0]]);
    assert.equal(s.tc.retryKind(c), "ganz");
  } finally {
    FUNCTIONS.textanalyse.timeoutMs = before;
  }
});

test("5 + 7: N01 – Schritt 1 ohne lesbare Antwort; „Erneut versuchen“ startet die ganze Korrektur einmal, wie zugestimmt", async (t) => {
  const api = await apiFor(t);
  api.s.analyse = "json";
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  let c = s.tc.getCorrection(res.correctionId)!;
  assert.deepEqual([c.ai_status, c.ai_error, c.method], ["fehler", "Die Antwort der KI war nicht lesbar.", "gruendlich"]);
  assert.equal(s.tc.retryKind(c), "ganz");
  // the KI answers again
  api.s.analyse = "ok";
  const again = await s.tc.retryAICorrection(c.id, s.niko.id, { wait: true });
  assert.deepEqual(again, { ok: true, correctionId: c.id, reused: false });
  c = s.tc.getCorrection(c.id)!;
  assert.deepEqual([c.ai_status, c.verify_status, c.method], ["fertig", "ok", "gruendlich"]);
  assert.equal(s.tc.listItems(c.id).filter((i) => i.kind !== "hinweis").length, 2);
  assert.deepEqual(api.steps(), ["analyse", "analyse", "pruefung"]);
  assert.deepEqual(s.calls().map((r) => [r.fn, r.status]), [["textanalyse", "abgelehnt"], ["textanalyse", "ok"], ["textpruefung", "ok"]]);
});

test("6: N14 – nur die zweite Prüfung fällt aus: Vorschläge bleiben, als nicht kontrolliert markiert, keiner wird übernommen", async (t) => {
  const api = await apiFor(t);
  api.s.pruefung = "fehler-im-body";
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  const c = s.tc.getCorrection(res.correctionId)!;
  assert.deepEqual([c.ai_status, c.verify_status, c.verify_error], ["fertig", "fehler", "Der KI-Anbieter hat einen Fehler gemeldet."]);
  const items = s.tc.listItems(c.id).filter((i) => i.kind !== "hinweis");
  assert.deepEqual(items.map((i) => i.quote), ["gieng", "assen"], "step 1's suggestions stay");
  assert.ok(items.every((i) => i.status === "offen" && i.review === "lehrer" && i.review_note.includes("Nicht kontrolliert: Die zweite Prüfung ist fehlgeschlagen.")));
  assert.equal(s.tc.decideAll(c.id, "uebernommen", s.niko.id), 0, "„Alle übernehmen“ takes none of them");
  assert.ok(s.tc.listItems(c.id).every((i) => i.status !== "uebernommen"));
  // step 1's answer is kept for „Erneut versuchen“ (masked text only)
  const kept = JSON.parse(c.analysis) as { version: string; data: { sentences: unknown[] } };
  assert.equal(kept.version, "neu");
  assert.equal(kept.data.sentences.length, 4, "every sentence of the text");
  assert.equal(s.tc.retryKind(c), "pruefung");
  assert.deepEqual(s.calls().map((r) => [r.fn, r.status, r.cost]), [["textanalyse", "ok", 0.02], ["textpruefung", "abgelehnt", 0]]);
});

test("7 + 9: „Erneut versuchen“ wiederholt nur die zweite Prüfung; Entscheidungen des Lehrers bleiben, auch bei erneutem Ausfall", async (t) => {
  const api = await apiFor(t);
  api.s.pruefung = "keine-choices";
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  const id = res.correctionId;
  const firstCall = s.tc.getCorrection(id)!.ai_call_id;
  // the teacher decides before trying again: accepts one suggestion (it says it was not checked), adds an own correction and a hint
  const [gieng] = by(s.tc.listItems(id), "gieng");
  assert.ok("item" in s.tc.decideItem(id, gieng.id, "uebernommen", s.niko.id)!);
  const at = s.tc.snapshotDoc(s.tc.getCorrection(id)!)[1].r[0].x.indexOf("Fußball");
  assert.ok("item" in s.tc.addTeacherItem(id, { block: 1, start: at, end: at + 7, category: "ausdruck", kind: "stil", replacement: "Fußball im Park", explanation: "Genauer." }, s.niko.id));
  assert.ok("item" in s.tc.addTeacherItem(id, { block: null, start: null, end: null, category: "struktur", kind: "hinweis", replacement: "", explanation: "Schreib noch einen Schluss." }, s.niko.id));
  const decided = () => s.tc.listItems(id).filter((i) => i.decided_by !== null).map((i) => [i.id, i.quote, i.replacement, i.status, i.source, i.explanation, i.review_note]);
  const before = decided();
  assert.equal(before.length, 3);

  // the second check fails again: nothing but the reason changes
  api.s.pruefung = "http500";
  const failed = await s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  assert.ok(failed.ok);
  let c = s.tc.getCorrection(id)!;
  assert.deepEqual([c.ai_status, c.verify_status, c.verify_error], ["fertig", "fehler", "Der KI-Anbieter hat einen Fehler gemeldet."]);
  assert.deepEqual(decided(), before);
  assert.deepEqual(by(s.tc.listItems(id), "assen").map((i) => [i.status, i.review]), [["offen", "lehrer"]], "the open one is still there, still marked");
  assert.deepEqual(api.steps(), ["analyse", "pruefung", "pruefung", "pruefung"], "step 1 not again; OpenRouter's one free repeat on a 500");

  // now it works: only the second check, only for what is still open; step 1 is not paid again
  api.s.pruefung = "ok";
  const ok = await s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  assert.deepEqual(ok, { ok: true, correctionId: id, reused: false });
  c = s.tc.getCorrection(id)!;
  assert.deepEqual([c.ai_status, c.verify_status, c.verify_error, c.analysis, c.ai_call_id], ["fertig", "ok", "", "", firstCall]);
  assert.deepEqual(api.steps(), ["analyse", "pruefung", "pruefung", "pruefung", "pruefung"]);
  assert.match(api.s.seen.at(-1)!.user, /Änderung: „assen“/);
  assert.doesNotMatch(api.s.seen.at(-1)!.user, /Änderung: „gieng“/, "a decided place is not checked again");
  assert.deepEqual(decided(), before, "every decision stays as it was");
  const items = s.tc.listItems(id);
  assert.equal(by(items, "gieng").length, 1, "no second suggestion where the teacher accepted");
  assert.deepEqual(by(items, "assen").map((i) => [i.status, i.review]), [["offen", ""]], "checked now");
  assert.equal(items.filter((i) => i.kind === "hinweis" && i.explanation === "Schreib noch einen Schluss.").length, 1);
  assert.equal(s.tc.retryKind(c), null);
  assert.ok("error" in (s.tc.retryAICorrection(id, s.niko.id) as { error: string }), "nothing left to repeat");
});

test("9: hat der Lehrer schon alle Vorschläge entschieden, braucht die Wiederholung keine Anfrage", async (t) => {
  const api = await apiFor(t);
  api.s.pruefung = "leer";
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  const id = res.correctionId;
  const [gieng] = by(s.tc.listItems(id), "gieng");
  const [assen] = by(s.tc.listItems(id), "assen");
  assert.ok("item" in s.tc.decideItem(id, gieng.id, "uebernommen", s.niko.id)!);
  assert.ok("item" in s.tc.decideItem(id, assen.id, "abgelehnt", s.niko.id)!);
  const rows = s.calls().length;
  const ok = await s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  assert.ok(ok.ok);
  assert.deepEqual(api.steps(), ["analyse", "pruefung"], "nothing left to check: no request");
  assert.equal(s.calls().length, rows, "no row in the cost log");
  const c = s.tc.getCorrection(id)!;
  assert.deepEqual([c.verify_status, c.analysis], ["ok", ""]);
  assert.deepEqual(s.tc.listItems(id).filter((i) => i.kind !== "hinweis").map((i) => [i.quote, i.status]), [["gieng", "uebernommen"], ["assen", "abgelehnt"]]);
});

test("7: nach erfolgreicher Wiederholung sind die offenen Vorschläge kontrolliert, wie bei einem Lauf ohne Ausfall", async (t) => {
  const api = await apiFor(t);
  api.s.pruefung = "leer";
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  api.s.pruefung = "ok";
  await s.tc.retryAICorrection(res.correctionId, s.niko.id, { wait: true });
  const items = s.tc.listItems(res.correctionId).filter((i) => i.kind !== "hinweis");
  assert.deepEqual(items.map((i) => [i.quote, i.replacement, i.status, i.review]), [["gieng", "ging", "offen", ""], ["assen", "aßen", "offen", ""]]);
  assert.equal(s.tc.decideAll(res.correctionId, "uebernommen", s.niko.id), 2, "checked suggestions can be accepted together again");
});

test("8 + 9: Doppelklick auf „Erneut versuchen“ sendet einmal; was der Lehrer währenddessen entscheidet, bleibt", async (t) => {
  const api = await apiFor(t);
  api.s.pruefung = "fehler-im-body";
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  const id = res.correctionId;
  api.s.pruefung = "ok";
  api.s.delayMs = 300;
  const first = s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  const second = s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  const third = s.tc.retryAICorrection(id, s.niko.id);
  assert.deepEqual(await second, { ok: true, correctionId: id, reused: true });
  assert.deepEqual(third, { ok: true, correctionId: id, reused: true });
  // while it runs: the page shows it, the suggestions of step 1 are still there and can be decided
  const running = s.tc.getCorrection(id)!;
  assert.deepEqual([running.ai_status, s.tc.verifyState(running)], ["fertig", "laeuft"]);
  const [assen] = by(s.tc.listItems(id), "assen");
  assert.ok("item" in s.tc.decideItem(id, assen.id, "abgelehnt", s.niko.id)!);
  assert.deepEqual(await first, { ok: true, correctionId: id, reused: false });
  assert.deepEqual(api.steps(), ["analyse", "pruefung", "pruefung"], "one request for three clicks");
  const items = s.tc.listItems(id);
  assert.deepEqual(by(items, "assen").map((i) => [i.status, i.decided_by]), [["abgelehnt", s.niko.id]], "the decision made meanwhile stays, no new suggestion there");
  assert.deepEqual(by(items, "gieng").map((i) => [i.status, i.review]), [["offen", ""]]);
});

test("10: Kosten: keine doppelten Anfragen oder Einträge; aufgebrauchtes Budget oder Pause: nichts wird gesendet", async (t) => {
  const api = await apiFor(t);
  api.s.pruefung = "fehler-im-body";
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  const id = res.correctionId;
  assert.deepEqual(s.calls().map((r) => [r.fn, r.status]), [["textanalyse", "ok"], ["textpruefung", "abgelehnt"]]);

  // the month's budget is used up: refused before anything is claimed or sent
  process.env.AI_MONTHLY_BUDGET_USD = "0.01";
  api.s.pruefung = "ok";
  const broke = s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  assert.deepEqual(broke, { ok: false, error: "Das KI-Budget für diesen Monat ist aufgebraucht. Es wurde nichts an die KI gesendet." });
  assert.equal(s.tc.getCorrection(id)!.verify_status, "fehler", "not claimed");
  delete process.env.AI_MONTHLY_BUDGET_USD;

  // the KI pauses after three outages in a row: refused as well
  const r = s.router;
  const { z } = await import("zod");
  api.s.analyse = "http401";
  for (let i = 0; i < 3; i++) await r.runAI("textanalyse", z.object({ x: z.string() }), "sys", `pause ${i}`);
  assert.equal(r.breakerState().paused, true);
  const paused = s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  assert.ok(!(paused instanceof Promise) && !paused.ok && /Pause/.test(paused.error));
  r.resetRouter();
  const rows = s.calls().length;
  const seen = api.s.seen.length;

  const ok = await s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  assert.ok(ok.ok && !ok.reused);
  assert.equal(api.s.seen.length - seen, 1, "one request");
  assert.deepEqual(s.calls().slice(rows).map((r) => [r.fn, r.status, r.cost]), [["textpruefung", "ok", 0.02]], "one row, no cache row, step 1 not again");
  // the whole correction: step 1 paid once, step 2 once per try (the failed one cost nothing)
  const text = s.calls().filter((r) => r.fn.startsWith("text"));
  assert.deepEqual(text.map((r) => [r.fn, r.status, r.cost]), [["textanalyse", "ok", 0.02], ["textpruefung", "abgelehnt", 0], ["textanalyse", "fehler", 0], ["textanalyse", "fehler", 0], ["textanalyse", "fehler", 0], ["textpruefung", "ok", 0.02]]);
});

test("eine unterbrochene Wiederholung (Neustart des Servers) gilt nach dem Zeitlimit als fehlgeschlagen und kann neu gestartet werden", async (t) => {
  const api = await apiFor(t);
  api.s.pruefung = "leer";
  const s = await setup(api);
  const res = await s.start();
  assert.ok(res.ok);
  const id = res.correctionId;
  const { FUNCTIONS } = await import("./ai/config");
  const long = new Date(Date.now() - FUNCTIONS.textpruefung.timeoutMs - 120_000).toISOString();
  s.db().prepare("UPDATE text_corrections SET verify_status = 'laeuft', ai_started_at = ? WHERE id = ?").run(long, id);
  const c = s.tc.getCorrection(id)!;
  assert.deepEqual([s.tc.verifyState(c), s.tc.retryKind(c)], ["fehler", "pruefung"]);
  api.s.pruefung = "ok";
  const again = await s.tc.retryAICorrection(id, s.niko.id, { wait: true });
  assert.ok(again.ok && !again.reused);
  assert.equal(s.tc.getCorrection(id)!.verify_status, "ok");
});

test("Meldungen: verständlich, mit den HTTP-Fällen; alte gespeicherte Fehler ohne den Text des Anbieters", async () => {
  const { failureText, shownFailure } = await import("./text-correction-core");
  assert.equal(failureText("anbieter", 402), "Beim KI-Anbieter ist das Guthaben aufgebraucht.");
  assert.equal(failureText("anbieter", 503), "Der KI-Anbieter hat einen Fehler gemeldet.");
  assert.equal(failureText("nicht_erreichbar"), "Die KI war nicht erreichbar.");
  assert.equal(shownFailure("Die KI war nicht erreichbar (OpenRouter antwortet mit 500: {\"error\":\"x\"})."), "Die KI war nicht erreichbar.");
  assert.equal(shownFailure("Die Korrektur konnte nicht gespeichert werden (SQLITE_BUSY: database is locked)."), "Die Korrektur konnte nicht gespeichert werden.");
  assert.equal(shownFailure("Die KI hat nicht rechtzeitig geantwortet."), "Die KI hat nicht rechtzeitig geantwortet.");
  assert.equal(shownFailure(null), "");
});
