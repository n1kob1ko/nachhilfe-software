/**
 * Bildgeschichte erstellen (Plan 5.2, lib/bildfolge.ts): Plan über den Router, dann Bilder über OpenRouter, mit
 * Kosten im Protokoll, gegen Budget und Grenze je Schüler. Kein Name und kein Foto in einer Anfrage, Bilder wie
 * hochgeladene gespeichert und nur als Bild ausgeliefert, „Dieses Bild neu“ lässt die anderen Bilder stehen,
 * Schülerseiten zeigen nichts von KI.
 *
 * Kein Schlüssel, kein Aufruf nach außen: Text- und Bild-Transport werden ersetzt und schreiben mit, was gefragt
 * wurde; fetch wirft. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import type { ImageRequest } from "./ai/providers/types";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-bildfolge-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "AI_DISABLED", "AI_IMAGE_MODEL", "AI_IMAGE_PRICE_USD", "AI_STUDENT_LIMIT_EUR"])
  delete process.env[k];

// no request may leave the app in these tests
const echtesFetch = globalThis.fetch;
let fetchAufrufe = 0;
globalThis.fetch = (async () => {
  fetchAufrufe++;
  throw new Error("kein Aufruf nach außen in Tests");
}) as typeof fetch;

/** A real PNG header (the app checks the type from the content), different per call. */
let n = 0;
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`erstellt-${++n}`)]);

const PLAN = {
  titel: "Der Drache im Baum",
  figuren: "the girl: about 9, short red hair, yellow raincoat, green boots; the dog: small, white with a brown ear",
  ort: "a park in autumn, afternoon",
  szenen: Array.from({ length: 6 }, (_, i) => ({ bild: `scene ${i + 1}: the girl and the dog in the park`, beschreibung: `Szene ${i + 1}` })),
};

const kid = (name: string, teacherId: number) => ({
  name, grade: 3, klasse: 3, teacher_id: teacherId, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ki_hinweise: `${name.split(" ")[0]} liest gern über Tiere.`,
});

async function setup(name = "Leonie Wurzbacher") {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const router = await import("./ai/router");
  const bf = await import("./bildfolge");
  const ps = await import("./picture-story");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  router.resetRouter();
  const texte: AIRequest[] = [];
  const bilder: ImageRequest[] = [];
  router.setTransport(async (req) => {
    texte.push(req);
    return { parsed: structuredClone(PLAN), refusal: false, model: req.model, usage: { input: 1_200, output: 900, cacheWrite: 0, cacheRead: 0 }, costUsd: 0.004 };
  });
  router.setImageTransport(async (req) => {
    bilder.push(req);
    return { data: png(), model: req.model, usage: { input: 300, output: 1_290, cacheWrite: 0, cacheRead: 0 }, costUsd: 0.0387 };
  });
  return { repo, router, bf, ps, niko, sid, texte, bilder };
}

async function sechsBilder(s: Awaited<ReturnType<typeof setup>>, beschreibung = "Ein Mädchen und ihr Hund finden im Park einen Drachen im Baum.") {
  const plan = await s.bf.planeBildfolge({ beschreibung, anzahl: 6, schulart: "Volksschule", klasse: 3 }, { teacherId: s.niko.id, studentId: s.sid });
  assert.ok(plan.ok, plan.ok ? "" : plan.error);
  const bilder = [];
  for (const sz of plan.szenen) {
    const r = await s.bf.erstelleBild(plan.id, sz.szene, { teacherId: s.niko.id });
    assert.ok(r.ok, r.ok ? "" : r.error);
    bilder.push(r.bild);
  }
  return { plan, bilder };
}

test("plan, then six pictures: the figures go with every picture, the first picture is the reference for the rest", async () => {
  const s = await setup();
  const { plan, bilder } = await sechsBilder(s);
  assert.equal(plan.titel, "Der Drache im Baum");
  assert.equal(s.texte.length, 1, "one plan request");
  assert.equal(s.texte[0].fn, "bildplan");
  assert.match(String(s.texte[0].content), /Anzahl der Bilder: 6/);
  assert.match(String(s.texte[0].content), /8–9 Jahre/, "age from Volksschule, 3. Klasse");
  assert.equal(s.bilder.length, 6);
  for (const req of s.bilder) {
    assert.ok(req.prompt.includes(PLAN.figuren), "the fixed figures in every picture request");
    assert.match(req.prompt, /No text, letters/);
    assert.equal(req.model, "google/gemini-3.1-flash-lite-image", "the default picture model");
    assert.equal(req.aspectRatio, "4:3");
  }
  assert.equal(s.bilder[0].references.length, 0, "the first picture has nothing to keep yet");
  const erstes = fs.readFileSync(s.ps.imageFile(s.bf.bildfolgeBild(bilder[0].id)!)).toString("base64");
  for (const req of s.bilder.slice(1)) assert.deepEqual(req.references, [{ mime: "image/png", base64: erstes }], "the first picture as reference");
  assert.deepEqual(bilder.map((b) => b.szene), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(bilder.map((b) => b.beschreibung), PLAN.szenen.map((x) => x.beschreibung));
  assert.equal(fetchAufrufe, 0);
});

test("cost: every request in ai_calls, the price OpenRouter reported, else the list price; for the student, counted in the general budget", async () => {
  const s = await setup();
  await sechsBilder(s);
  const { db } = await import("./db");
  const rows = db().prepare("SELECT fn, provider, model, student_id, cost_usd, status, trigger FROM ai_calls ORDER BY id").all() as { fn: string; provider: string; model: string; student_id: number; cost_usd: number; status: string; trigger: string }[];
  assert.equal(rows.length, 7);
  assert.equal(rows[0].fn, "bildplan");
  assert.equal(rows[0].cost_usd, 0.004);
  for (const r of rows.slice(1)) {
    assert.deepEqual([r.fn, r.provider, r.status, r.trigger, r.student_id], ["bild", "openrouter", "ok", "bildgeschichte", s.sid]);
    assert.equal(r.cost_usd, 0.0387);
  }
  const { monthSpend } = await import("./ai/log");
  assert.ok(monthSpend(Date.now(), "allgemein") >= 6 * 0.0387 - 1e-9, "pictures count against the OpenRouter budget");
  // without a reported price: the list price of the model
  s.router.setImageTransport(async (req) => ({ data: png(), model: req.model, usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 } }));
  const f = db().prepare("SELECT id FROM bildfolgen ORDER BY id DESC").get() as { id: number };
  assert.ok((await s.bf.erstelleBild(f.id, 2, { teacherId: s.niko.id })).ok);
  const last = db().prepare("SELECT cost_usd FROM ai_calls ORDER BY id DESC").get() as { cost_usd: number };
  assert.equal(last.cost_usd, 0.039);
  // the estimate before the click: one picture about 3.5 euro cents, six with the plan well under 30
  const k = s.bf.kostenSchaetzung();
  assert.ok(k.bildCent > 3 && k.bildCent < 4, String(k.bildCent));
  assert.ok(k.planCent + 6 * k.bildCent < 30, String(k.planCent + 6 * k.bildCent));
});

test("no name of a student or teacher in any request, not even when the teacher types one", async () => {
  const s = await setup("Leonie Wurzbacher");
  await sechsBilder(s, "Leonie Wurzbacher und Niko gehen mit dem Hund in den Park und finden einen Drachen.");
  const alles = JSON.stringify([s.texte.map((r) => [r.system, r.content]), s.bilder.map((r) => r.prompt)]);
  for (const name of ["Leonie", "Wurzbacher", "Niko"]) assert.ok(!alles.includes(name), `${name} left the app`);
  assert.match(String(s.texte[0].content), /\[Name\]/);
  // a name the model brings back (by chance a student's) does not reach the picture model either
  s.router.setTransport(async (req) => {
    s.texte.push(req);
    return { parsed: { ...structuredClone(PLAN), figuren: "Leonie: a girl with red hair" }, refusal: false, model: req.model, usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0 } };
  });
  const plan = await s.bf.planeBildfolge({ beschreibung: "Ein Kind findet einen Drachen im Baum.", anzahl: 4, schulart: "", klasse: null }, { teacherId: s.niko.id, studentId: null });
  assert.ok(plan.ok);
  assert.equal(plan.szenen.length, 4);
  await s.bf.erstelleBild(plan.id, 1, { teacherId: s.niko.id });
  assert.ok(!s.bilder.at(-1)!.prompt.includes("Leonie"));
});

test("key missing: „Bilder erstellen ist nicht eingerichtet“, no request, nothing stored", async () => {
  const s = await setup();
  s.router.setImageTransport(null);
  assert.equal(s.router.imagesReady(), false);
  assert.equal(s.bf.bilderAusGrund(s.sid), "Bilder erstellen ist nicht eingerichtet.");
  const plan = await s.bf.planeBildfolge({ beschreibung: "Ein Mädchen findet einen Drachen im Baum.", anzahl: 6, schulart: "", klasse: null }, { teacherId: s.niko.id, studentId: s.sid });
  assert.deepEqual(plan, { ok: false, error: "Bilder erstellen ist nicht eingerichtet." });
  const out = await s.router.runImage("a dragon", []);
  assert.equal(out.ok, false);
  assert.equal(s.texte.length + s.bilder.length + fetchAufrufe, 0);
  const { db } = await import("./db");
  assert.equal((db().prepare("SELECT COUNT(*) AS n FROM bildfolgen").get() as { n: number }).n, 0);
  assert.equal((db().prepare("SELECT COUNT(*) AS n FROM ai_calls").get() as { n: number }).n, 0);
  // with the key the pictures are set up (the request itself is not made here)
  process.env.OPENROUTER_API_KEY = "or-test";
  assert.equal(s.router.imagesReady(), true);
  process.env.AI_DISABLED = "1";
  assert.equal(s.router.imagesReady(), false, "KI switched off: no pictures either");
  delete process.env.AI_DISABLED;
  delete process.env.OPENROUTER_API_KEY;
});

test("budget used up or the student's limit reached: no request, the plan and a picture are refused", async () => {
  const s = await setup();
  const { plan } = await sechsBilder(s);
  const vorher = [s.texte.length, s.bilder.length];
  const { logCall } = await import("./ai/log");
  // the student's limit (3 € a month) first
  logCall({ fn: "textkorrektur", tier: "standard", provider: "anthropic", model: "x", teacherId: null, unitId: null, studentId: s.sid, trigger: "", input: 0, output: 0, cacheWrite: 0, cacheRead: 0, durationMs: 0, costUsd: 4, status: "ok" });
  assert.match(s.bf.bilderAusGrund(s.sid)!, /Grenze für diesen Schüler/);
  assert.equal(s.bf.bilderAusGrund(null), null, "a story for nobody is not stopped by one student's limit");
  const nochmal = await s.bf.erstelleBild(plan.id, 3, { teacherId: s.niko.id });
  assert.equal(nochmal.ok, false);
  const direkt = await s.router.runImage("a dragon", [], { meta: { studentId: s.sid } });
  assert.equal(direkt.ok ? "" : direkt.cause, "schuelergrenze");
  // then the general budget (10 € a month)
  logCall({ fn: "textkorrektur", tier: "standard", provider: "openrouter", model: "x", teacherId: null, unitId: null, trigger: "", input: 0, output: 0, cacheWrite: 0, cacheRead: 0, durationMs: 0, costUsd: 50, status: "ok" });
  assert.equal(s.bf.bilderAusGrund(null), "Das KI-Budget für diesen Monat ist aufgebraucht.");
  const neu = await s.bf.planeBildfolge({ beschreibung: "Ein Mädchen findet einen Drachen im Baum.", anzahl: 6, schulart: "", klasse: null }, { teacherId: s.niko.id, studentId: null });
  assert.equal(neu.ok, false);
  const ohne = await s.router.runImage("a dragon", []);
  assert.equal(ohne.ok ? "" : ohne.cause, "budget");
  assert.deepEqual([s.texte.length, s.bilder.length], vorher, "no request at all");
});

test("stored like uploaded pictures, served as an image only; a story takes them over, marked „mit KI erstellt“ for teachers", async () => {
  const s = await setup();
  const { bilder } = await sechsBilder(s);
  const b = s.bf.bildfolgeBild(bilder[0].id)!;
  assert.equal(b.mime, "image/png");
  assert.ok(s.ps.imageFile(b).startsWith(path.join(process.env.UPLOADS_PATH!, "bildgeschichten")), "same folder as uploaded pictures");
  const { sendImage } = await import("./picture-story-routes");
  const res = sendImage(b);
  assert.equal(res.headers.get("Content-Type"), "image/png");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(res.headers.get("Content-Security-Policy")!, /default-src 'none'/);
  // something that is not a picture is not stored
  s.router.setImageTransport(async (req) => ({ data: Buffer.from("<script>alert(1)</script>"), model: req.model, usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, costUsd: 0.04 }));
  const falsch = await s.bf.erstelleBild(bilder[0].bildfolgeId, 2, { teacherId: s.niko.id });
  assert.equal(falsch.ok, false);
  assert.equal(s.bf.bildfolgeBild(bilder[1].id)?.id, bilder[1].id, "the earlier picture of the scene stays");

  const units = await import("./units");
  const unitId = units.startUnit(s.niko.id, s.sid, { subject: "Deutsch" }).unit.id;
  const text = s.ps.createPictureStory({
    studentId: s.sid, teacherId: s.niko.id, unitId, subject: "Deutsch", title: "Der Drache im Baum", prompt: "Schreibe zu den Bildern.",
    settings: s.ps.cleanSettings({ schoolType: "Volksschule", klasse: "3" }),
    images: bilder.map((x) => ({ kiBild: x.id, caption: x.beschreibung })),
  });
  const imgs = s.ps.storyImages(text.id);
  assert.deepEqual(imgs.map((i) => [i.position, i.ki, i.szene, i.caption]), bilder.map((x, i) => [i + 1, 1, x.szene, x.beschreibung]));
  assert.equal(sendImage(imgs[0]).headers.get("Content-Type"), "image/png");
  // the student's page: the pictures like any Bildgeschichte, nothing about KI
  const view = JSON.stringify(s.ps.storyForEditor(text.id, "/geraet/bild"));
  assert.ok(!/\bKI\b|\bki\b|erstellt|bildfolge|szene|openrouter|gemini/i.test(view), view);
});

test("„Dieses Bild neu“: only that scene again, with the same figures and the first picture; the other five stay", async () => {
  const s = await setup();
  const { bilder } = await sechsBilder(s);
  const units = await import("./units");
  const unitId = units.startUnit(s.niko.id, s.sid, { subject: "Deutsch" }).unit.id;
  const text = s.ps.createPictureStory({
    studentId: s.sid, teacherId: s.niko.id, unitId, subject: "Deutsch", title: "Drache", prompt: "", settings: s.ps.cleanSettings({}),
    images: bilder.map((x) => ({ kiBild: x.id, caption: x.beschreibung })),
  });
  const vorher = s.ps.storyImages(text.id);
  const zahl = s.bilder.length;
  const neu = await s.bf.erstelleBild(bilder[2].bildfolgeId, 3, { teacherId: s.niko.id });
  assert.ok(neu.ok);
  assert.equal(s.bilder.length, zahl + 1, "one picture request");
  const req = s.bilder.at(-1)!;
  assert.ok(req.prompt.includes(PLAN.figuren) && req.prompt.includes(PLAN.szenen[2].bild));
  assert.equal(req.references.length, 1, "the first picture as reference");
  assert.equal(s.bf.bildfolgeBild(bilder[2].id), null, "the scene's earlier picture left the Bilderfolge");
  assert.ok(fs.existsSync(s.ps.imageFile(vorher[2])), "the story still uses its file");
  // the teacher saves the form: the new picture in place 3, the others as they were
  s.ps.updatePictureStory(text.id, {
    title: "Drache", subject: "Deutsch", prompt: "", settings: s.ps.cleanSettings({}), uploads: [],
    order: vorher.map((i, k) => (k === 2 ? { ki: neu.bild.id, caption: i.caption } : { id: i.id, caption: i.caption })),
  });
  const nachher = s.ps.storyImages(text.id);
  assert.equal(nachher.length, 6);
  for (const k of [0, 1, 3, 4, 5]) assert.deepEqual([nachher[k].id, nachher[k].stored_path], [vorher[k].id, vorher[k].stored_path], `picture ${k + 1} unchanged`);
  assert.notEqual(nachher[2].stored_path, vorher[2].stored_path);
  assert.deepEqual([nachher[2].position, nachher[2].ki, nachher[2].szene, nachher[2].caption], [3, 1, 3, vorher[2].caption]);
  assert.ok(!fs.existsSync(s.ps.imageFile(vorher[2])), "the old file is gone once nothing uses it");
  // scene 1 again: another picture of the story as reference, never the old one of itself
  await s.bf.erstelleBild(bilder[0].bildfolgeId, 1, { teacherId: s.niko.id });
  const ref = s.bilder.at(-1)!.references[0].base64;
  assert.equal(ref, fs.readFileSync(s.ps.imageFile(s.bf.bildfolgeBild(bilder[1].id)!)).toString("base64"));
});

test("the OpenRouter adapter: the image endpoint, the key only in the header, the picture and the price from the answer", async () => {
  const { imageBody, openRouterImageTransport } = await import("./ai/providers/openai-compatible");
  const body = imageBody({ model: "m/x", prompt: "p", references: [{ mime: "image/png", base64: "QUJD" }], aspectRatio: "4:3", signal: new AbortController().signal });
  assert.deepEqual(body, { model: "m/x", prompt: "p", n: 1, aspect_ratio: "4:3", input_references: [{ type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } }] });
  assert.ok(!("input_references" in imageBody({ model: "m/x", prompt: "p", references: [], aspectRatio: "4:3", signal: new AbortController().signal })));
  process.env.OPENROUTER_API_KEY = "or-geheim";
  const bild = png();
  const gesehen: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    gesehen.push({ url, init });
    return new Response(JSON.stringify({ data: [{ b64_json: bild.toString("base64"), media_type: "image/png" }], usage: { prompt_tokens: 300, completion_tokens: 1290, cost: 0.0387 } }), { status: 200 });
  }) as typeof fetch;
  try {
    const r = await openRouterImageTransport({ model: "google/gemini-3.1-flash-lite-image", prompt: "a dragon", references: [], aspectRatio: "4:3", signal: new AbortController().signal });
    assert.equal(gesehen[0].url, "https://openrouter.ai/api/v1/images");
    assert.equal((gesehen[0].init.headers as Record<string, string>).authorization, "Bearer or-geheim");
    assert.ok(!String(gesehen[0].init.body).includes("or-geheim"), "the key is never in the body");
    assert.deepEqual(r.data, bild);
    assert.equal(r.costUsd, 0.0387);
    assert.equal(r.usage.output, 1290);
    // a chat completion with modalities ["image", "text"] answers with a data URL: read as well
    globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${bild.toString("base64")}` } }] } }] }), { status: 200 })) as typeof fetch;
    assert.deepEqual((await openRouterImageTransport({ model: "x/y", prompt: "p", references: [], aspectRatio: "4:3", signal: new AbortController().signal })).data, bild);
    // an answer without a picture: no data, a reason without content
    globalThis.fetch = (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as typeof fetch;
    const leer = await openRouterImageTransport({ model: "x/y", prompt: "p", references: [], aspectRatio: "4:3", signal: new AbortController().signal });
    assert.equal(leer.data, null);
    assert.equal(leer.problem, "Antwort ohne Bild");
  } finally {
    delete process.env.OPENROUTER_API_KEY;
    globalThis.fetch = echtesFetch;
  }
});
