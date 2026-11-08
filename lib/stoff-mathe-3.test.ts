/**
 * Stoffzettel Mathematik 3. Klasse (niko, 08.11.2026): „es kann einige Sachen nicht zuweisen oder es ist nicht ganz
 * richtig, und dann ist in der Einheit nicht alles dabei“. Der Stoffzettel (Zahlen, Potenzen, Flächeninhalte) muss
 * jede Zeile mit Lerninhalt der richtigen Fähigkeit zuordnen, mit KI und ohne; Überschriften und Teile des Buchs
 * („Teste Dein Wissen“, „Übungsbuch“) sind Umfang; jede dieser Fähigkeiten hat Aufgaben ohne KI.
 *
 * Kein Schlüssel, kein Aufruf nach außen: die Antwort der KI ist von Hand nach dem Foto geschrieben
 * (lib/fixtures/stoff-mathe-3g.ts). Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import { STOFF_MATHE_3G, STOFF_MATHE_3G_LERNINHALTE, STOFF_MATHE_3G_UMFANG } from "./fixtures/stoff-mathe-3g";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "stoff-mathe-3-"));
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR",
])
  delete process.env[k];

const NEU = ["mathe.potenzen.addieren", "mathe.negativ.verbinden", "mathe.flaechen.vielecke"];

async function setup(klasse = 3) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lena Probe", grade: 4 + klasse, klasse, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  return { repo, teacher, sid, student: repo.getStudent(sid)! };
}

test("3. Klasse: every line of the Stoffzettel gets its skill, with and without the KI; headings and book parts are scope", async () => {
  const { student } = await setup();
  const ps = await import("./pruefungsstoff");
  const lesung = ps.lesungAusAntwort(STOFF_MATHE_3G, { dateien: 1 });
  assert.equal(lesung.punkte.length, STOFF_MATHE_3G.punkte.length, "nothing lost");

  for (const o of STOFF_MATHE_3G_UMFANG) {
    const pkt = lesung.punkte.find((x) => x.original === o)!;
    assert.equal(pkt.gruppe, "umfang", o);
    assert.equal(pkt.skill_id, null, o);
  }
  // the field „Stoff“ gets the learning contents only, not „Übungsbuch“ or „Teste Dein Wissen“
  assert.equal(lesung.kopf.themen.length, STOFF_MATHE_3G_LERNINHALTE.length);
  assert.ok(lesung.kopf.themen.every((t) => !/übungsbuch|teste dein|vermischte|sprache der/i.test(t)), lesung.kopf.themen.join(" | "));

  for (const ki of [true, false]) {
    const zugeordnet = ps.ordneZu(lesung.punkte, { fach: "Mathematik", student, ki });
    for (const [original, skill] of STOFF_MATHE_3G_LERNINHALTE) {
      const pkt = zugeordnet.find((x) => x.original === original)!;
      assert.equal(pkt.zuordnung, "sicher", `${ki ? "mit" : "ohne"} KI: ${original} → ${pkt.skill_id ?? "nichts"} (${pkt.vorschlaege.join(", ")})`);
      assert.equal(pkt.skill_id, skill, `${ki ? "mit" : "ohne"} KI: ${original}`);
    }
    // nothing stays as „ohne passende Fähigkeit“: the rest is scope
    assert.equal(zugeordnet.filter((x) => x.status === "pruefung" && x.gruppe !== "umfang" && x.zuordnung !== "sicher").length, 0);
    assert.deepEqual(new Set(ps.skillsAus(zugeordnet)), new Set(STOFF_MATHE_3G_LERNINHALTE.map(([, s]) => s)));
  }

  // the KI learns the short words too: what the KI writes as „inhalt“ alone also finds the skill without KI
  const kurz = ps.ordneZu(
    STOFF_MATHE_3G_LERNINHALTE.map(([o]) => ({ ...lesung.punkte.find((x) => x.original === o)!, original: o.replace(/\s*\(S\.[^)]*\)\s*$/, "") })),
    { fach: "Mathematik", student, ki: false },
  );
  kurz.forEach((pkt, i) => assert.equal(pkt.skill_id, STOFF_MATHE_3G_LERNINHALTE[i][1], pkt.original));
});

test("3. Klasse: the Potenzregeln and the new skills are in the KI list and the pool from the 7. Schulstufe on, not before", async () => {
  const { student, repo } = await setup(3);
  const ps = await import("./pruefungsstoff");
  const ids = ps.kandidatenFuer(student, "Mathematik").map((k) => k.id);
  for (const id of ["mathe.potenzen.regeln", "mathe.potenzen.schreibweise", ...NEU, "mathe.negativ.rational", "mathe.geometrie.koordinaten"]) assert.ok(ids.includes(id), id);
  assert.equal(repo.getSkill("mathe.potenzen.regeln")!.grade_min, 7);

  const zweite = repo.getStudent(repo.createStudent({ name: "Max Probe", grade: 6, klasse: 2, teacher_id: repo.listTeachers()[0].id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" }))!;
  const frueher = ps.kandidatenFuer(zweite, "Mathematik").map((k) => k.id);
  for (const id of ["mathe.potenzen.regeln", "mathe.potenzen.addieren", "mathe.negativ.verbinden"]) assert.equal(frueher.includes(id), false, id);
});

test("an existing database moves the Potenzregeln to the 7. Schulstufe once, a teacher's own range stays", async () => {
  const { openDatabase } = await import("./db");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "stoff-mathe-db-")), "alt.db");
  let conn = openDatabase(file);
  conn.prepare("UPDATE skills SET grade_min = 8 WHERE id = 'mathe.potenzen.regeln'").run();
  conn.close();
  conn = openDatabase(file);
  assert.equal((conn.prepare("SELECT grade_min FROM skills WHERE id = 'mathe.potenzen.regeln'").get() as { grade_min: number }).grade_min, 7);
  // the new skills are added to an existing database
  for (const id of NEU) assert.ok(conn.prepare("SELECT 1 FROM skills WHERE id = ?").get(id), id);
  conn.prepare("UPDATE skills SET grade_min = 6 WHERE id = 'mathe.potenzen.regeln'").run();
  conn.close();
  conn = openDatabase(file);
  assert.equal((conn.prepare("SELECT grade_min FROM skills WHERE id = 'mathe.potenzen.regeln'").get() as { grade_min: number }).grade_min, 6);
  conn.close();
});

test("the whole reading: one request, the Stoffzettel counts as read, all learning contents linked", async () => {
  const { student, sid, teacher } = await setup();
  const ps = await import("./pruefungsstoff");
  const { saveUpload } = await import("./materials");
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: STOFF_MATHE_3G, refusal: false, model: req.model, usage: { input: 6_500, output: 3_000, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  process.env.ANTHROPIC_API_KEY = "test";
  try {
    const id = saveUpload({ name: "zettel.jpg", data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) }, { title: "Stoffzettel", studentId: sid, teacherId: teacher.id }).id;
    const r = await ps.liesPruefungsstoff({ materialIds: [id], studentId: sid, teacherId: teacher.id, heute: "2026-11-08", fach: "Mathematik" });
    assert.equal(gefragt.length, 1);
    const text = (gefragt[0].content as { type: string; text?: string }[]).find((t) => t.type === "text")!.text!;
    for (const neu of ["mathe.potenzen.regeln", ...NEU]) assert.match(text, new RegExp(neu.replace(/\./g, "\\.")), `${neu} goes along with the request`);
    assert.match(String(gefragt[0].system ?? ""), /Teste dein Wissen, Vermischte Aufgaben, Übungsbuch/);
    const zugeordnet = ps.ordneZu(r.lesung.punkte, { fach: "Mathematik", student, ki: true });
    assert.equal(zugeordnet.filter((x) => x.zuordnung === "sicher").length, STOFF_MATHE_3G_LERNINHALTE.length);
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
    router.setTransport(null);
  }
});

test("the skills of the Stoffzettel all have tasks without KI, and they are right", async () => {
  await setup();
  const { generateForSlot, hasBuiltInGenerator } = await import("./generators");
  const { rechenwegTask } = await import("./generators-mathe");
  const { checkOwnSolution, gradeMathTask } = await import("./math-task");
  const { DIFFICULTIES, mixFor } = await import("./curriculum");
  const { leseFigur, figurSzene } = await import("./figur");
  const { vieleckPlan } = await import("./generators-figur");
  let seed = 7;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const way = (steps: string[], result = "") => JSON.stringify({ steps, result });

  for (const [, id] of STOFF_MATHE_3G_LERNINHALTE) assert.ok(hasBuiltInGenerator(id), id);

  // every slot of the mix gives a real task (no „Erkläre …“) and its own solution counts as right
  for (const id of NEU)
    for (const d of DIFFICULTIES)
      for (const category of mixFor("Mathematik", id))
        for (let i = 0; i < 4; i++) {
          const t = generateForSlot({ skillId: id, skillName: id, difficulty: d, category, subject: "Mathematik", grade: 7 }, rng, i);
          assert.notEqual(t.type, "free", `${id} ${d} ${category}: ${t.prompt}`);
          assert.equal(checkOwnSolution(t), null, `${id} ${d} ${category}: ${t.prompt}`);
        }

  // Verbindung der vier Grundrechnungsarten: the Rechenweg and the result are right (checked by the app and by plain JS)
  for (const d of DIFFICULTIES)
    for (let i = 0; i < 25; i++) {
      const t = rechenwegTask("mathe.negativ.verbinden", d, rng)!;
      assert.equal(checkOwnSolution(t), null, String(t.data.start));
      assert.equal(gradeMathTask(t, way(t.solutionSteps ?? [], t.answer.accepted![0])).check.correct, true, String(t.data.start));
      const js = (s: string) => Function(`return (${s.replace(/−/g, "-").replace(/·/g, "*").replace(/:/g, "/")})`)() as number;
      const wert = js(String(t.data.start));
      assert.equal(wert, Number(t.answer.accepted![0]), String(t.data.start));
      for (const z of t.solutionSteps ?? []) assert.equal(js(z), wert, `${t.data.start} = ${z}`);
    }

  // Potenzen addieren: the result is the sum of the given terms
  for (const d of DIFFICULTIES)
    for (let i = 0; i < 25; i++) {
      const t = generateForSlot({ skillId: "mathe.potenzen.addieren", skillName: "", difficulty: d, category: "rechnung", subject: "Mathematik", grade: 7 }, rng, i);
      assert.equal(t.type, "calc");
      const { checkAnswer } = await import("./tasks");
      assert.equal(checkAnswer(t, t.answer.accepted![0]).correct, true, t.prompt);
      // the same terms in another order count too, a typical error does not
      assert.equal(checkAnswer(t, t.answer.accepted![0].split(" + ").reverse().join(" + ")).correct, true, t.prompt);
      for (const f of t.errorMap) assert.equal(checkAnswer(t, f.answer).correct, false, `${t.prompt}: ${f.answer}`);
    }

  // Vielecke: the area by „Ergänzen“ equals the Gaussian formula, the figure keeps the polygon and draws it
  for (let lv = 0; lv <= 3; lv++)
    for (let i = 0; i < 60; i++) {
      const p = vieleckPlan(lv, rng);
      const n = p.ecken.length;
      const gauss = Math.abs(p.ecken.reduce((s, q, k) => s + q[0] * p.ecken[(k + 1) % n][1] - p.ecken[(k + 1) % n][0] * q[1], 0)) / 2;
      assert.equal(p.flaeche, gauss);
      assert.ok(p.ecken.every(([x, y]) => x >= p.x0 && x <= p.x0 + p.b && y >= p.y0 && y <= p.y0 + p.h));
      if (lv >= 1) assert.ok(p.x0 < 0 && p.y0 < 0 && p.x0 + p.b > 0 && p.y0 + p.h > 0, "over all four quadrants");
    }
  const t = generateForSlot({ skillId: "mathe.flaechen.vielecke", skillName: "", difficulty: "mittel", category: "rechnung", subject: "Mathematik", grade: 7 }, rng, 0);
  const fig = leseFigur(t.data.figure);
  assert.ok(fig && fig.art === "koordinaten" && fig.vieleck?.length === fig.punkte.length);
  const szene = figurSzene(t.data.figure)!;
  assert.ok(szene.teile.some((x) => x.t === "weg" && x.zu && x.p.length === fig.punkte.length), "the polygon is drawn");
  assert.match(szene.beschreibung, /Vieleck ABC/);
  // a polygon through a point that does not exist is dropped, the rest of the figure stays
  const kaputt = leseFigur({ ...(t.data.figure as object), vieleck: ["A", "B", "Z"] });
  assert.ok(kaputt && kaputt.art === "koordinaten" && !kaputt.vieleck);
});
