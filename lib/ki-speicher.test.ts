/**
 * Gespeicherte Antworten der KI (lib/ai/speicher.ts): dieselbe Anfrage wird auch nach einem Neustart nicht noch
 * einmal bezahlt, eine Antwort für einen Schüler kommt nie bei einem anderen an, und nach dem Fenster der Funktion
 * wird neu gefragt. Der „Neustart“ ist ein eigener Prozess auf derselben Datenbankdatei.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import type { AIRequest } from "./ai/providers";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-ki-speicher-"));
const file = path.join(dir, "test.db");
process.env.DATABASE_PATH = file;
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

test.after(async () => {
  (await import("./db")).closeDatabase();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function setup() {
  const repo = await import("./repo");
  const router = await import("./ai/router");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: { antwort: `Antwort ${gefragt.length}` }, refusal: false, model: req.model, usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } };
  });
  return { router, gefragt, a: schueler("Tamsin Vogl"), b: schueler("Orest Gruber") };
}

test("nach einem Neustart: dieselbe Anfrage kommt aus der Datenbank, eine andere oder ein anderer Schüler fragt neu", async () => {
  const { z } = await import("zod");
  const s = await setup();
  const Antwort = z.object({ antwort: z.string() });
  const erst = await s.router.runAI("analyse", Antwort, "sys", "Lernstand 40 %", { meta: { studentId: s.a } });
  assert.ok(erst.ok && !erst.reused);
  assert.equal(s.gefragt.length, 1);

  // a fresh process on the same database file: nothing of this module's memory is there
  const kind = path.join(dir, "neustart.mts");
  const router = pathToFileURL(path.resolve("lib/ai/router.ts")).href;
  const db = pathToFileURL(path.resolve("lib/db.ts")).href;
  fs.writeFileSync(
    kind,
    // the stand-in transport never looks at the schema: an empty one keeps the script free of packages
    `const r = await import(${JSON.stringify(router)});
let calls = 0;
r.setTransport(async (req) => { calls++; return { parsed: { antwort: "neu" }, refusal: false, model: req.model, usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } }; });
const A = {};
const gleich = await r.runAI("analyse", A, "sys", "Lernstand 40 %", { meta: { studentId: ${s.a} } });
const andererSchueler = await r.runAI("analyse", A, "sys", "Lernstand 40 %", { meta: { studentId: ${s.b} } });
const andereFrage = await r.runAI("analyse", A, "sys", "Lernstand 45 %", { meta: { studentId: ${s.a} } });
const ohneSpeicher = await r.runAI("notiz", A, "sys", "Lernstand 40 %", { meta: { studentId: ${s.a} } });
(await import(${JSON.stringify(db)})).closeDatabase();
console.log(JSON.stringify({ calls, gleich, andererSchueler, andereFrage, ohneSpeicher }));
`,
  );
  const out = JSON.parse(
    execFileSync(process.execPath, ["--import", "tsx", kind], { env: { ...process.env, DATABASE_PATH: file }, encoding: "utf8" })
      .trim()
      .split("\n")
      .pop()!,
  );
  assert.deepEqual(out.gleich.data, { antwort: "Antwort 1" }, "the same request: the stored answer");
  assert.equal(out.gleich.reused, true);
  assert.equal(out.andererSchueler.reused, false, "never another student's answer, even with the same prompt");
  assert.equal(out.andererSchueler.data.antwort, "neu");
  assert.equal(out.andereFrage.reused, false);
  assert.equal(out.ohneSpeicher.reused, false, "a function without reuse (notiz) asks every time");
  assert.equal(out.calls, 3);
});

test("das Fenster der Funktion: danach wird neu gefragt, Abgelaufenes wird gelöscht; resetRouter leert den Speicher", async () => {
  const { z } = await import("zod");
  const { db } = await import("./db");
  const { FUNCTIONS } = await import("./ai/config");
  const s = await setup();
  const Antwort = z.object({ antwort: z.string() });
  let jetzt = Date.parse("2026-10-23T10:00:00Z");
  s.router.setClock(() => jetzt);
  try {
    await s.router.runAI("analyse", Antwort, "sys", "Frage", { meta: { studentId: s.a } });
    const zeile = db().prepare("SELECT fn, student_id, created_at, expires_at FROM ai_cache").get() as { fn: string; student_id: number; created_at: number; expires_at: number };
    assert.deepEqual(zeile, { fn: "analyse", student_id: s.a, created_at: jetzt, expires_at: jetzt + FUNCTIONS.analyse.reuseMs });
    assert.ok(!JSON.stringify(db().prepare("SELECT * FROM ai_cache").all()).includes("Tamsin"), "no name stored with it");

    jetzt += FUNCTIONS.analyse.reuseMs - 1000;
    assert.equal((await s.router.runAI("analyse", Antwort, "sys", "Frage", { meta: { studentId: s.a } })).ok && s.gefragt.length, 1, "inside the window: reused");
    jetzt += 2000;
    const neu = await s.router.runAI("analyse", Antwort, "sys", "Frage", { meta: { studentId: s.a } });
    assert.ok(neu.ok && !neu.reused);
    assert.equal(s.gefragt.length, 2, "after the window: asked again");
    assert.equal((db().prepare("SELECT COUNT(*) AS n FROM ai_cache").get() as { n: number }).n, 1, "the expired row was replaced");

    s.router.resetRouter();
    assert.equal((db().prepare("SELECT COUNT(*) AS n FROM ai_cache").get() as { n: number }).n, 0);
  } finally {
    s.router.setClock(null);
    s.router.setTransport(null);
  }
});
