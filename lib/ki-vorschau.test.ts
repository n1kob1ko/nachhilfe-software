/**
 * Empfehlung und Diagnose nur mit Vorschau (E0): „Direkt an … senden“ bei einer Empfehlung und „Diagnose starten“ legen Aufgaben der KI
 * nur als Vorschau ab (ohne Einheit, `unit_id` NULL); an den Schüler geht erst mit „Senden“ genau das, was die Vorschau zeigt, und nur
 * einmal; „Verwerfen“ schickt nichts; geht die KI nicht, steht der Grund da und nichts ist gesendet; ohne KI alles wie bisher. Kein
 * Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt, mit festen Tokens. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers/types";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR",
])
  delete process.env[k];

/** ohne eigenen Generator: hier schreibt die KI */
const RUNDEN = "mathe.zahlen.runden";
const ROEMISCH = "mathe.zahlen.roemisch";
/** mit Generator: hier nie die KI */
const KUERZEN = "mathe.brueche.kuerzen";
const USAGE = { input: 2_000, output: 1_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 };

/** eine Aufgabe, wie die KI sie bei „aufgaben“ liefert */
const kiAufgabe = (prompt: string, antwort: string, skill = RUNDEN, difficulty = "mittel") => ({
  category: "rechnen", format: "calc", skill_ids: [skill], topic: "Zahlen", difficulty, prompt, passage: null, options: null, correct_option: null,
  accepted_answers: [antwort], numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null,
  answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["Runden"], solution: "Auf die Ziffer danach schauen.", solution_steps: [], estimated_time_sec: 60, hints: ["Welche Ziffer entscheidet?"], common_errors: [],
});
const FUENF = { tasks: ["862 auf Zehner", "4 449 auf Hunderter", "15 hoch auf Zehner", "7 351 auf Tausender", "95 auf Zehner"].map((p, i) => kiAufgabe(`Runde ${p}.`, String(i + 1))) };

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const kv = await import("./ki-vorschau");
  const nb = await import("./ki-nachschub");
  const d = await import("./diagnose");
  const { nextSteps } = await import("./recommend");
  const { dayOf } = await import("./exams");
  const router = await import("./ai/router");
  const { resetKiModusCache } = await import("./ai/modus");
  resetKiModusCache();
  router.resetRouter();
  router.setTransport(null);
  const gefragt: AIRequest[] = [];
  /** die KI „an“: jede Anfrage geht an diesen Ersatz, nie nach außen */
  const kiAn = (antwort: (req: AIRequest) => unknown = () => FUENF) =>
    router.setTransport(async (req) => {
      gefragt.push(req);
      return { parsed: antwort(req), refusal: false, model: req.model, usage: USAGE };
    });
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  /** zwei falsche Antworten zu dieser Fähigkeit: die Empfehlung „Schwäche“ dazu */
  const schwach = (sid: number, skill: string) => {
    const ws = repo.createWorksheet(
      { title: "Training", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [skill], status: "freigegeben" },
      [1, 2].map((i) => ({ type: "calc" as const, skillId: skill, difficulty: "mittel" as const, prompt: `${skill} ${i}`, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] })),
    );
    const asg = repo.assignWorksheet(ws, sid);
    for (const t of repo.listTasks(ws))
      repo.recordAttempt({ assignment_id: asg, task_id: t.id, student_id: sid, skill_id: skill, attempt_no: 1, answer: "2", correct: 0, final: 1, time_ms: 30_000, active_ms: 25_000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "" });
    db().prepare("UPDATE assignments SET completed_at = datetime('now') WHERE id = ?").run(asg);
    const rec = nextSteps(sid, { today: dayOf(new Date()), limit: 10 }).find((r) => r.skill.id === skill && !r.openAssignmentId);
    assert.ok(rec, `a recommendation for ${skill}`);
    return rec!;
  };
  const zaehle = (tabelle: "worksheets" | "assignments") => db().prepare(`SELECT COUNT(*) FROM ${tabelle}`).pluck().get() as number;
  const heute = dayOf(new Date());
  return { db, repo, kv, nb, d, router, teacher, schueler, schwach, kiAn, gefragt, zaehle, heute };
}

test("Empfehlung mit KI: nur eine Vorschau mit Kosten vorher; erst „Senden“ weist genau diese Aufgaben zu, einmal; ai_calls trägt den Schüler", async () => {
  const s = await setup();
  s.kiAn();
  const sid = s.schueler("Ilvy Rundmann");
  const rec = s.schwach(sid, RUNDEN);
  const weg = s.kv.empfehlungWeg(sid, rec);
  assert.ok(weg.ki && /^ca\. \d+ Cent$/.test(weg.kosten), JSON.stringify(weg));

  const vorher = { w: s.zaehle("worksheets"), a: s.zaehle("assignments") };
  const out = await s.kv.empfehlungUebernehmen(sid, rec.key, { teacherId: s.teacher.id, today: s.heute });
  assert.ok("vorschau" in out, JSON.stringify(out));
  const n = out.vorschau;
  assert.equal(n.status, "bereit");
  assert.equal(n.unitId, null);
  assert.equal(n.studentId, sid);
  assert.equal(n.aufgaben.length, rec.count);
  assert.deepEqual({ w: s.zaehle("worksheets"), a: s.zaehle("assignments") }, vorher, "nothing reaches the student before „Senden“");
  assert.equal(s.gefragt.length, 1);
  const call = s.db().prepare("SELECT fn, student_id, unit_id, trigger FROM ai_calls WHERE id = ?").get(n.callId) as { fn: string; student_id: number; unit_id: number | null; trigger: string };
  assert.deepEqual(call, { fn: "aufgaben", student_id: sid, unit_id: null, trigger: "empfehlung" });

  // a second tap brings the same preview, without asking again; the open preview hides the button
  const noch = await s.kv.empfehlungUebernehmen(sid, rec.key, { teacherId: s.teacher.id, today: s.heute });
  assert.ok("vorschau" in noch && noch.vorschau.id === n.id);
  assert.equal(s.gefragt.length, 1);
  assert.deepEqual(s.kv.offeneVorschauen(sid).map((x) => x.id), [n.id]);

  // „Senden“: exactly these tasks, once
  const gesendet = s.kv.sendeVorschau(sid, n.id, s.teacher.id);
  assert.ok(!("fehler" in gesendet), JSON.stringify(gesendet));
  const zweimal = s.kv.sendeVorschau(sid, n.id, s.teacher.id);
  assert.deepEqual(zweimal, { fehler: "Diese Aufgaben sind schon gesendet." });
  assert.equal(s.zaehle("assignments"), vorher.a + 1);
  assert.deepEqual(s.repo.listTasks(gesendet.worksheetId).map((t) => t.prompt), n.aufgaben.map((t) => t.prompt));
  const w = s.repo.getWorksheet(gesendet.worksheetId)!;
  const wie = s.kv.empfehlungAnfrage(s.repo.getStudent(sid)!, rec, s.teacher.id);
  assert.deepEqual([w.title, w.source, w.kind, w.difficulty], [wie.title, "ki", rec.kind, rec.difficulty], "the same exercise as „Direkt an … senden“ built before");
  assert.match(s.repo.getAssignment(gesendet.assignmentId)!.note, /^Empfehlung \(/);
  assert.deepEqual(s.kv.offeneVorschauen(sid), []);
  // another student cannot send it
  const fremd = s.schueler("Ole Fremd");
  assert.ok("fehler" in s.kv.sendeVorschau(fremd, n.id, s.teacher.id));
  s.router.setTransport(null);
});

test("Empfehlung: „Verwerfen“ schickt nichts; die KI geht nicht: Grund, nichts gesendet, „Ohne KI senden“ wie bisher", async () => {
  const s = await setup();
  s.kiAn();
  const sid = s.schueler("Pia Wegwerf");
  const rec = s.schwach(sid, RUNDEN);
  const vorher = s.zaehle("assignments");
  const out = await s.kv.empfehlungUebernehmen(sid, rec.key, { teacherId: s.teacher.id, today: s.heute });
  assert.ok("vorschau" in out);
  assert.equal(s.kv.verwirfVorschau(sid, out.vorschau.id), true);
  assert.deepEqual(s.kv.sendeVorschau(sid, out.vorschau.id, s.teacher.id), { fehler: "Diese Aufgaben gibt es nicht mehr." });
  assert.equal(s.zaehle("assignments"), vorher, "„Verwerfen“ assigns nothing");

  // the KI fails: the reason, nothing sent, no silent fallback
  s.router.setTransport(async (req) => {
    s.gefragt.push(req);
    throw new Error("Zeitüberschreitung beim Anbieter");
  });
  const kaputt = await s.kv.empfehlungUebernehmen(sid, rec.key, { teacherId: s.teacher.id, today: s.heute });
  assert.ok("vorschau" in kaputt && kaputt.vorschau.status === "fehler", JSON.stringify(kaputt));
  assert.match(kaputt.vorschau.problem, /Zeitüberschreitung/);
  assert.equal(s.zaehle("assignments"), vorher);
  // the KI answers without a task: also a reason
  s.kiAn(() => ({ tasks: [] }));
  const daneben = await s.kv.empfehlungUebernehmen(sid, rec.key, { teacherId: s.teacher.id, today: s.heute });
  assert.ok("vorschau" in daneben && daneben.vorschau.status === "fehler" && /keine passenden Aufgaben/.test(daneben.vorschau.problem), JSON.stringify(daneben));
  assert.equal(s.zaehle("assignments"), vorher);

  // „Ohne KI senden“: the generator as before, assigned at once; the old reason is gone
  const n = s.gefragt.length;
  const ohne = await s.kv.empfehlungUebernehmen(sid, rec.key, { teacherId: s.teacher.id, today: s.heute, ohneKi: true });
  assert.ok("worksheetId" in ohne, JSON.stringify(ohne));
  assert.equal(s.gefragt.length, n, "no KI call");
  assert.equal(s.zaehle("assignments"), vorher + 1);
  assert.notEqual(s.repo.getWorksheet(ohne.worksheetId)!.source, "ki");
  assert.equal(s.kv.vorschauZu(sid, s.kv.schluesselEmpfehlung(rec.key))!.status, "verworfen");
  s.router.setTransport(null);
});

test("Empfehlung ohne KI (aus, Monatsbudget, Grenze des Schülers): gleich gesendet wie bisher, ohne Vorschau, mit dem Grund", async () => {
  const s = await setup();
  const sid = s.schueler("Timo Ohnekai");
  const rec = s.schwach(sid, RUNDEN);
  assert.deepEqual(s.kv.empfehlungWeg(sid, rec), { ki: false, grund: null }, "KI off: no reason, as before");
  const vorher = s.zaehle("assignments");
  const out = await s.kv.empfehlungUebernehmen(sid, rec.key, { teacherId: s.teacher.id, today: s.heute });
  assert.ok("worksheetId" in out);
  assert.equal(s.zaehle("assignments"), vorher + 1);
  assert.equal(s.db().prepare("SELECT COUNT(*) FROM einheit_ki_aufgaben").pluck().get(), 0);
  assert.equal(s.db().prepare("SELECT COUNT(*) FROM ai_calls").pluck().get(), 0);

  // the student's limit: the KI is on, but not for this student; the generator goes out at once
  s.kiAn();
  const grenze = s.schueler("Rosa Grenze");
  const r2 = s.schwach(grenze, RUNDEN);
  s.db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, student_id) VALUES (?, 'aufgaben', 'standard', 'claude-sonnet-5-5', 'anthropic', 'ok', 9, 0, ?)").run(new Date().toISOString(), grenze);
  const weg = s.kv.empfehlungWeg(grenze, r2);
  assert.ok(!weg.ki && /KI-Grenze/.test(weg.grund ?? ""), JSON.stringify(weg));
  const o2 = await s.kv.empfehlungUebernehmen(grenze, r2.key, { teacherId: s.teacher.id, today: s.heute });
  assert.ok("worksheetId" in o2);
  assert.equal(s.gefragt.length, 0);

  // a skill with its own generator: never the KI, as before
  const gen = s.schueler("Kai Kuerzer");
  const r3 = s.schwach(gen, KUERZEN);
  assert.equal(s.kv.empfehlungWeg(gen, r3).ki, true, "buildWorksheet asked the KI for every skill when it is on");
  s.router.setTransport(null);
});

test("Diagnose mit KI: das ganze Blatt wartet auf die Vorschau (die neuen markiert, leicht zuerst); „Senden“ macht die Diagnose", async () => {
  const s = await setup();
  s.kiAn((req) => {
    // one task per asked skill, in the asked difficulty
    const m = [...JSON.stringify(req.content).matchAll(/mathe\.zahlen\.(runden|roemisch)/g)].map((x) => x[0]);
    return { tasks: [...new Set(m)].map((id, i) => kiAufgabe(`Neue Aufgabe ${i + 1} zu ${id}`, String(i + 1), id)) };
  });
  const sid = s.schueler("Lena Diagnos");
  const input = { studentId: sid, subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: [RUNDEN, KUERZEN, ROEMISCH, "mathe.brueche.erweitern", "mathe.brueche.vergleichen"], topics: [], teacherId: s.teacher.id, useAI: true, seed: 5 };
  const vorher = { w: s.zaehle("worksheets"), a: s.zaehle("assignments") };
  const out = await s.kv.diagnoseVorschau(input);
  assert.ok(out && "vorschau" in out, JSON.stringify(out));
  const n = out.vorschau;
  assert.equal(n.status, "bereit", n.problem);
  assert.deepEqual({ w: s.zaehle("worksheets"), a: s.zaehle("assignments") }, vorher, "nothing goes out before „Senden“");
  assert.deepEqual(new Set(n.aufgaben.map((t) => t.skillId)), new Set([RUNDEN, ROEMISCH]), "the KI only for skills without a generator");
  assert.ok(n.dazu.length >= 3 && n.dazu.every((t) => t.skillId !== RUNDEN && t.skillId !== ROEMISCH), "the others without KI, in the same sheet");
  const reihe = s.nb.vorschauAufgaben(n);
  const plan = s.d.planDiagnosis(input.skillIds);
  assert.deepEqual(reihe.map((x) => x.t.skillId), plan.map((p) => p.skillId), "in the order of the diagnosis (easy first)");
  assert.deepEqual(reihe.filter((x) => x.neu).map((x) => x.t.skillId).sort(), [ROEMISCH, RUNDEN]);
  const call = s.db().prepare("SELECT student_id, trigger FROM ai_calls WHERE id = ?").get(n.callId);
  assert.deepEqual(call, { student_id: sid, trigger: "diagnose" });

  const gesendet = s.kv.sendeVorschau(sid, n.id, s.teacher.id);
  assert.ok(!("fehler" in gesendet) && gesendet.art === "diagnose", JSON.stringify(gesendet));
  assert.ok("fehler" in s.kv.sendeVorschau(sid, n.id, s.teacher.id), "a double tap sends once");
  assert.equal(s.zaehle("assignments"), vorher.a + 1);
  const w = s.repo.getWorksheet(gesendet.worksheetId)!;
  assert.deepEqual([w.kind, w.status, w.source, w.student_id, w.title], ["diagnose", "freigegeben", "ki", sid, "Lena – Diagnose: Natürliche Zahlen, Bruchrechnung"]);
  assert.deepEqual(s.repo.listTasks(w.id).map((t) => t.prompt), reihe.map((x) => x.t.prompt));
  assert.ok(s.d.diagnosisResult(gesendet.assignmentId, { today: s.heute }), "the result page works on it");
  s.router.setTransport(null);
});

test("Diagnose: „Verwerfen“ schickt nichts; die KI geht nicht: Grund, nichts gesendet; ohne KI oder ohne Haken wie bisher", async () => {
  const s = await setup();
  s.kiAn(() => ({ tasks: [kiAufgabe("Runde 862 auf Zehner.", "860", RUNDEN, "leicht")] }));
  const sid = s.schueler("Mats Verwerf");
  const input = { studentId: sid, subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: [RUNDEN, KUERZEN], topics: [], teacherId: s.teacher.id, useAI: true, seed: 3 };
  const vorher = s.zaehle("assignments");
  const out = await s.kv.diagnoseVorschau(input);
  assert.ok(out && "vorschau" in out && out.vorschau.status === "bereit");
  assert.equal(s.kv.verwirfVorschau(sid, out.vorschau.id), true);
  assert.ok("fehler" in s.kv.sendeVorschau(sid, out.vorschau.id, s.teacher.id));
  assert.equal(s.zaehle("assignments"), vorher);

  s.router.setTransport(async () => {
    throw new Error("Anbieter nicht erreichbar");
  });
  const kaputt = await s.kv.diagnoseVorschau(input);
  assert.ok(kaputt && "vorschau" in kaputt && kaputt.vorschau.status === "fehler" && /nicht erreichbar/.test(kaputt.vorschau.problem), JSON.stringify(kaputt));
  assert.equal(s.zaehle("assignments"), vorher);

  // without the tick, or only skills with a generator: no preview, createDiagnosis as before (never the KI)
  s.kiAn();
  assert.equal(await s.kv.diagnoseVorschau({ ...input, useAI: false }), null);
  assert.equal(await s.kv.diagnoseVorschau({ ...input, skillIds: [KUERZEN, "mathe.brueche.erweitern"] }), null);
  const calls = s.db().prepare("SELECT COUNT(*) FROM ai_calls").pluck().get();
  const d = await s.d.createDiagnosis(input);
  assert.equal(s.db().prepare("SELECT COUNT(*) FROM ai_calls").pluck().get(), calls, "createDiagnosis never asks the KI");
  assert.equal(s.repo.getWorksheet(d.worksheetId)!.source, "generator");
  assert.equal(s.zaehle("assignments"), vorher + 1);

  // KI off: no preview at all
  s.router.setTransport(null);
  assert.equal(await s.kv.diagnoseVorschau(input), null);
});

test("Upgrade: eine alte Tabelle einheit_ki_aufgaben (unit_id NOT NULL) wird gelockert und bekommt student_id; Zeilen bleiben", async () => {
  const { openDatabase } = await import("./db");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e0-upgrade-"));
  const file = path.join(dir, "alt.db");
  try {
    const neu = openDatabase(file);
    // make it look like before E0: the table as PR #161 created it, with one row of a unit
    neu.exec("DROP TABLE einheit_ki_aufgaben");
    neu.exec(`CREATE TABLE einheit_ki_aufgaben (
      id INTEGER PRIMARY KEY AUTOINCREMENT, unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE, schluessel TEXT NOT NULL, schritt_id INTEGER,
      ziel TEXT NOT NULL DEFAULT '{}', automatisch INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'laeuft', aufgaben TEXT NOT NULL DEFAULT '[]',
      dazu TEXT NOT NULL DEFAULT '[]', fehler TEXT NOT NULL DEFAULT '', call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL,
      worksheet_id INTEGER REFERENCES worksheets(id) ON DELETE SET NULL, teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    const t = neu.prepare("SELECT id FROM teachers LIMIT 1").pluck().get() as number;
    const sid = Number(neu.prepare("INSERT INTO students (name, grade, access_token) VALUES ('Alma Altbestand', 6, 'e0-upgrade')").run().lastInsertRowid);
    const uid = Number(neu.prepare("INSERT INTO units (teacher_id, student_id, started_at, last_activity_at) VALUES (?, ?, datetime('now'), datetime('now'))").run(t, sid).lastInsertRowid);
    neu.prepare("INSERT INTO einheit_ki_aufgaben (unit_id, schluessel, status) VALUES (?, 'live', 'bereit')").run(uid);
    neu.close();

    const conn = openDatabase(file);
    const cols = conn.prepare("PRAGMA table_info(einheit_ki_aufgaben)").all() as { name: string; notnull: number }[];
    assert.equal(cols.find((c) => c.name === "unit_id")?.notnull, 0);
    assert.ok(cols.some((c) => c.name === "student_id"));
    assert.deepEqual(conn.prepare("SELECT unit_id, schluessel, status, student_id FROM einheit_ki_aufgaben").all(), [{ unit_id: uid, schluessel: "live", status: "bereit", student_id: null }]);
    conn.prepare("INSERT INTO einheit_ki_aufgaben (unit_id, student_id, schluessel) VALUES (NULL, ?, 'empfehlung:3:x')").run(sid);
    conn.close();
    // a second start changes nothing
    const nochmal = openDatabase(file);
    assert.equal(nochmal.prepare("SELECT COUNT(*) FROM einheit_ki_aufgaben").pluck().get(), 2);
    nochmal.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
