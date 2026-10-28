/**
 * KI-Budget je Einheit (D2): jede KI-Anfrage im Unterricht zählt zu ihrer Einheit (`ai_calls.unit_id`), die App erstellt fehlende
 * Aufgaben nur unter dem Betrag der Einheit von selbst und nie ohne Vorschau, darüber nur auf Tippen mit dem Grund; Standard 0 € ändert
 * nichts; Briefing und Live-Analyse zählen mit; die Grenze je Schüler geht vor. Kein Schlüssel, kein Aufruf nach außen: der Transport
 * wird ersetzt, mit festen Tokens. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR",
])
  delete process.env[k];

const DIV = "mathe.brueche.dividieren";
const RUNDEN = "mathe.zahlen.runden";
const USAGE = { input: 2_000, output: 1_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 };

/** eine Aufgabe, wie die KI sie bei „neue_aufgabe“ liefert */
const kiAufgabe = (prompt: string, antwort: string) => ({
  category: "rechnen", format: "calc", skill_ids: [RUNDEN], topic: "Zahlen", difficulty: "mittel", prompt, passage: null, options: null, correct_option: null,
  accepted_answers: [antwort], numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null,
  answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["Runden"], solution: "Auf die Ziffer danach schauen.", solution_steps: [], estimated_time_sec: 60, hints: ["Welche Ziffer entscheidet?"], common_errors: [],
});
const NEU = { tasks: [kiAufgabe("Runde 862 auf Zehner.", "860"), kiAufgabe("Runde 4 449 auf Hunderter.", "4400")] };

/** Antwort bei „Einfacher erklären lassen“ (D1) */
const EINFACH = {
  sagt: "Durch einen Bruch teilen heißt: mit dem umgedrehten Bruch malnehmen. Du drehst nur den zweiten Bruch um und rechnest dann ganz normal mal.",
  beispiel: { aufgabe: "1/2 : 1/4 = ?", rechnung: ["1/2 · 4/1 = 4/2 = 2"], loesung: "2" },
  frage: "Was machst du mit dem zweiten Bruch?",
  antwort: "Ich drehe ihn um.",
  frage_rechnung: null,
  fehler: ["Den ersten Bruch umgedreht: nur der zweite wird umgedreht"],
};

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const st = await import("./steuerung");
  const nb = await import("./ki-nachschub");
  const eb = await import("./ai/einheit-budget");
  const router = await import("./ai/router");
  const { resetKiModusCache } = await import("./ai/modus");
  resetKiModusCache();
  router.resetRouter();
  router.setTransport(null);
  const gefragt: AIRequest[] = [];
  /** die KI „an“: jede Anfrage geht an diesen Ersatz, nie nach außen */
  const kiAn = (antwort: (req: AIRequest) => unknown = (req) => (req.fn === "einfacher" ? EINFACH : NEU)) =>
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
  const aufgabe = (prompt: string, skill = RUNDEN) => ({
    type: "calc" as const, skillId: skill, difficulty: "mittel" as const, prompt, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [],
  });
  /**
   * Eine Einheit zu „Runden“, in der nur noch „Neue passende Aufgabe erstellen“ (C) bleibt: zwei Aufgaben aus dem Bestand gesendet,
   * beide falsch; im Bestand und im Generator gibt es zu Runden nichts mehr (lib/steuerung.test.ts).
   */
  const nurC = (name: string) => {
    const sid = schueler(name);
    const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik" }).unit;
    c.waehleFaehigkeit(unit.id, RUNDEN);
    const ws = repo.createWorksheet(
      { title: "Runden", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Zahlen", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [RUNDEN], status: "freigegeben" },
      [aufgabe("Runde 347 auf Zehner."), aufgabe("Runde 1 250 auf Hunderter.")],
    );
    const asg = repo.assignWorksheet(ws, sid, "", unit.id);
    for (const t of repo.listTasks(ws))
      repo.recordAttempt({ assignment_id: asg, task_id: t.id, student_id: sid, skill_id: t.skillId ?? null, attempt_no: 1, answer: "2", correct: 0, final: 0, time_ms: 30_000, active_ms: 25_000, hints_used: 0, solution_viewed: 0, error_label: "Falsch gerundet", feedback: "", unit_id: unit.id });
    const vorschlag = () => st.vorschlagDerEinheit(unit.id, c.cockpit(unit.id, { mitPlan: true }))!;
    return { sid, unit, vorschlag };
  };
  /** Kosten, die schon in der Einheit liegen (ohne Schüler: die Grenze je Schüler bleibt unberührt) */
  const kostenInEinheit = (unitId: number, usd: number, fn = "echtzeit") =>
    db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, unit_id) VALUES (?, ?, 'fast', 'claude-sonnet-5-5', 'anthropic', 'ok', ?, 0, ?)").run(new Date().toISOString(), fn, usd, unitId);
  const aufrufe = (fn: string) => db().prepare("SELECT COUNT(*) FROM ai_calls WHERE fn = ?").pluck().get(fn) as number;
  const zaehle = (tabelle: "worksheets" | "assignments") => db().prepare(`SELECT COUNT(*) FROM ${tabelle}`).pluck().get() as number;
  const usdPerEur = (await import("./ai/config")).budget().usdPerEur;
  return { db, repo, units, c, st, nb, eb, router, teacher, schueler, kiAn, gefragt, nurC, kostenInEinheit, aufrufe, zaehle, usdPerEur };
}

test("Betrag: Standard 0 € (automatisch aus); die Lehrkraft senkt je Einheit, nur die Administration erhöht; Formularwerte", async () => {
  const s = await setup();
  assert.equal(s.eb.betragAus("0,30"), 0.3);
  assert.equal(s.eb.betragAus(" 1 € "), 1);
  assert.equal(s.eb.betragAus("0.305"), 0.31);
  for (const x of ["", "-1", "abc", "6", "1,2,3"]) assert.equal(s.eb.betragAus(x), null, x);

  const sid = s.schueler("Mira Sparsam");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  assert.deepEqual(s.eb.einheitBudget(unit.id), { budgetEur: 0, eigen: false, standardEur: 0, kostenEur: 0, automatisch: false, erreicht: false });
  assert.equal(s.eb.kostenZeile(s.eb.einheitBudget(unit.id)), "KI heute: 0,00 € · automatisch aus");

  // a teacher cannot raise it above the standard
  assert.deepEqual(s.eb.setzeBudgetDerEinheit(unit.id, 0.2, { admin: false }), { fehler: "Erhöhen über 0,00 € kann nur die Administration." });
  s.eb.setzeStandardBudget(0.3);
  assert.equal(s.eb.einheitBudget(unit.id).budgetEur, 0.3);
  assert.equal(s.eb.kostenZeile(s.eb.einheitBudget(unit.id)), "KI heute: 0,00 € von 0,30 €");
  assert.deepEqual(s.eb.setzeBudgetDerEinheit(unit.id, 0.1, { admin: false }), { ok: true }, "lowering is fine");
  assert.deepEqual(s.eb.budgetDerEinheitEur(unit.id), { eur: 0.1, eigen: true });
  assert.ok("fehler" in s.eb.setzeBudgetDerEinheit(unit.id, 0.5, { admin: false }));
  assert.deepEqual(s.eb.setzeBudgetDerEinheit(unit.id, 0.5, { admin: true }), { ok: true }, "the administration may raise it");
  assert.ok("fehler" in s.eb.setzeBudgetDerEinheit(unit.id, 9, { admin: true }), "never above the maximum");
  assert.deepEqual(s.eb.setzeBudgetDerEinheit(unit.id, null, { admin: false }), { ok: true }, "back to the standard");
  assert.deepEqual(s.eb.budgetDerEinheitEur(unit.id), { eur: 0.3, eigen: false });
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("unit_id: the D1 KI call („Einfacher erklären lassen“), any call for the unit's student, and the briefing from before the start", async () => {
  const s = await setup();
  const sp = await import("./stundenplan");
  const k = await import("./knoepfe");
  s.kiAn();
  const sid = s.schueler("Tara Zuordnung");
  // a briefing in the morning, before the unit (and one test run, and one of yesterday): only today's real one goes to the unit
  const morgen = new Date(Date.now() - 20 * 60_000).toISOString();
  const brief = (at: string, test = 0) =>
    s.db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, student_id) VALUES (?, 'briefing', 'standard', 'claude-sonnet-5-5', 'anthropic', 'ok', 0.01, ?, ?)").run(at, test, sid).lastInsertRowid;
  const heute = brief(morgen);
  const probe = brief(morgen, 1);
  const gestern = brief(new Date(Date.now() - 30 * 3_600_000).toISOString());
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  const einheitVon = (id: number | bigint) => s.db().prepare("SELECT unit_id FROM ai_calls WHERE id = ?").pluck().get(id);
  assert.equal(einheitVon(heute), unit.id);
  assert.equal(einheitVon(probe), null);
  assert.equal(einheitVon(gestern), null);

  // „Einfacher erklären lassen“: counts to the unit, and still carries no student
  const plan = [...sp.schritteZurFaehigkeit(DIV, 45)].map((x, i) => ({ ...x, id: -(i + 1) }));
  s.db().prepare("INSERT INTO einheit_cockpit (unit_id, plan) VALUES (?, ?)").run(unit.id, JSON.stringify(plan));
  const erklaeren = plan.find((x) => x.thema === "Dividieren")!.id;
  const e = k.einfacherErklaeren(unit.id, erklaeren, s.teacher.id);
  assert.ok(!("fehler" in e));
  assert.deepEqual(await k.einfacherMitKi(unit.id, k.knoepfeDerEinheit(unit.id)[0].id, s.teacher.id), { ok: true });
  const row = s.db().prepare("SELECT unit_id, student_id, cost_usd FROM ai_calls WHERE fn = 'einfacher'").get() as { unit_id: number; student_id: number | null; cost_usd: number };
  assert.equal(row.unit_id, unit.id);
  assert.equal(row.student_id, null, "no student data in the request");
  assert.ok(row.cost_usd > 0);

  // any request about the student while the unit runs (Foto vom Stoff, Probeschularbeit, Präsentation …) counts to it
  const { z } = await import("zod");
  s.kiAn(() => ({ ok: true }));
  const r = await s.router.runAI("analyse", z.object({ ok: z.boolean() }), "sys", "frage", { meta: { teacherId: s.teacher.id, studentId: sid, trigger: "test" } });
  assert.ok(r.ok);
  assert.equal(s.db().prepare("SELECT unit_id FROM ai_calls WHERE fn = 'analyse' ORDER BY id DESC").pluck().get(), unit.id);
  // after the unit: no unit
  s.units.finishUnit(unit.id, "abgebrochen");
  await s.router.runAI("analyse", z.object({ ok: z.boolean() }), "sys", "frage danach", { meta: { teacherId: s.teacher.id, studentId: sid, trigger: "test" } });
  assert.equal(s.db().prepare("SELECT unit_id FROM ai_calls WHERE fn = 'analyse' ORDER BY id DESC").pluck().get(), null);

  // the Abschluss: one line per function, summed
  const zeilen = s.eb.kostenJeFunktion(unit.id);
  assert.deepEqual(zeilen.map((z) => z.fn).sort(), ["analyse", "briefing", "einfacher"]);
  const summe = zeilen.reduce((x, z) => x + z.usd, 0);
  assert.ok(Math.abs(summe - s.eb.kostenDerEinheitUsd(unit.id)) < 1e-12);
  s.router.setTransport(null);
});

test("default 0 €: nothing is asked by itself; C stays on tap with its cost, as today", async () => {
  const s = await setup();
  s.kiAn();
  const { unit, vorschlag } = s.nurC("Nils Standard");
  const v = vorschlag();
  const neu = v.andere.find((k) => k.quelle === "C")!;
  assert.equal(neu.gesperrt, null);
  assert.match(neu.kosten ?? "", /^ca\. \d+ Cent$/);
  const vorher = { ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") };
  assert.equal(await s.nb.nachschubAutomatisch(unit.id), 0);
  assert.equal(s.gefragt.length, 0, "no KI call");
  assert.equal(s.nb.nachschubDerEinheit(unit.id).length, 0);
  assert.deepEqual({ ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") }, vorher);
  const a = s.nb.nachschubImVorschlag(unit.id, null, v)!;
  assert.equal(a.gleich, false, "nothing is about to start");
  assert.equal(a.hinweis, null, "no new line under the button");
  assert.equal(s.eb.hintergrundGestoppt(unit.id), false);
  s.units.finishUnit(unit.id, "abgebrochen");
  s.router.setTransport(null);
});

test("under the budget: new tasks by themselves, marked as preview; the student gets nothing until „Senden“", async () => {
  const s = await setup();
  s.kiAn();
  s.eb.setzeStandardBudget(0.3);
  const { sid, unit, vorschlag } = s.nurC("Ella Vorschau");
  const v = vorschlag();
  const vorher = s.nb.nachschubImVorschlag(unit.id, null, v)!;
  assert.equal(vorher.gleich, true, "the page says it is being made");
  const asg = s.zaehle("assignments");

  assert.equal(await s.nb.nachschubAutomatisch(unit.id), 1);
  assert.equal(s.gefragt.length, 1);
  assert.equal(s.gefragt[0].fn, "neue_aufgabe");
  const n = s.nb.nachschubDerEinheit(unit.id)[0];
  assert.equal(n.status, "bereit");
  assert.equal(n.automatisch, true);
  assert.deepEqual(n.aufgaben.map((t) => t.prompt), ["Runde 862 auf Zehner.", "Runde 4 449 auf Hunderter."]);
  const call = s.db().prepare("SELECT id, unit_id, student_id, trigger, cost_usd FROM ai_calls WHERE fn = 'neue_aufgabe'").get() as { id: number; unit_id: number; student_id: number; trigger: string; cost_usd: number };
  assert.deepEqual({ unit: call.unit_id, student: call.student_id, trigger: call.trigger, id: n.callId }, { unit: unit.id, student: sid, trigger: "nachschub_automatisch", id: call.id });
  assert.equal(s.zaehle("assignments"), asg, "nothing went to the student");
  assert.equal(s.nb.nachschubImVorschlag(unit.id, null, vorschlag())!.eintrag?.status, "bereit", "the card shows the preview");

  // never twice for the same need
  assert.equal(await s.nb.nachschubAutomatisch(unit.id), 0);
  assert.equal(s.gefragt.length, 1);

  // „Senden“: exactly these tasks, to this student, in this unit; a second tap sends nothing
  const out = await s.nb.sendeNachschub(unit.id, n.id, s.teacher.id);
  assert.ok(!("fehler" in out), JSON.stringify(out));
  const a = s.repo.getAssignment(out.assignmentId)!;
  assert.deepEqual({ student: a.student_id, unit: a.unit_id }, { student: sid, unit: unit.id });
  assert.deepEqual(s.repo.listTasks(out.worksheetId).map((t) => t.prompt), ["Runde 862 auf Zehner.", "Runde 4 449 auf Hunderter."]);
  assert.equal(s.repo.getWorksheet(out.worksheetId)!.source, "ki");
  assert.deepEqual(await s.nb.sendeNachschub(unit.id, n.id, s.teacher.id), { fehler: "Diese Aufgaben sind schon gesendet." });
  assert.equal(s.zaehle("assignments"), asg + 1);
  // the cost line counts it
  assert.ok(s.eb.einheitBudget(unit.id).kostenEur > 0);
  assert.match(s.eb.kostenZeile(s.eb.einheitBudget(unit.id)), /^KI heute: (unter )?0,0\d € von 0,30 €$/);
  s.units.finishUnit(unit.id, "abgebrochen");
  s.router.setTransport(null);
});

test("a step of the plan with too few tasks: the KI fills up to three, the ones without KI go along, all after „Senden“", async () => {
  const s = await setup();
  s.kiAn();
  s.eb.setzeStandardBudget(0.3);
  const sid = s.schueler("Jonas Schritt");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  const plan = [{ titel: "Runden üben", minuten: 20, beschreibung: "", uebung: null, skillId: RUNDEN, art: "ueben" as const, thema: "Runden", quelle: null, id: -1 }];
  s.db().prepare("INSERT INTO einheit_cockpit (unit_id, plan) VALUES (?, ?)").run(unit.id, JSON.stringify(plan));
  const dazu = [{ type: "calc" as const, skillId: RUNDEN, difficulty: "mittel" as const, prompt: "Runde 75 auf Zehner.", data: {}, answer: { accepted: ["80"], mode: "value" as const }, solution: "", hints: [], errorMap: [] }];
  const b = { schluessel: s.nb.schluesselSchritt(-1, RUNDEN, 0), schrittId: -1, ziel: { art: "schritt" as const, skillId: RUNDEN, level: 3, fokus: null, kontrolle: false, anzahl: 2 }, dazu };
  const n = await s.nb.erstelleNachschub(unit.id, b, { automatisch: true, teacherId: s.teacher.id });
  assert.ok(!("fehler" in n) && n.status === "bereit");
  const out = await s.nb.sendeNachschub(unit.id, n.id, s.teacher.id);
  assert.ok(!("fehler" in out), JSON.stringify(out));
  assert.deepEqual(s.repo.listTasks(out.worksheetId).map((t) => t.prompt), ["Runde 75 auf Zehner.", "Runde 862 auf Zehner.", "Runde 4 449 auf Hunderter."]);
  assert.equal(s.repo.getAssignment(out.assignmentId)!.unit_id, unit.id);
  assert.equal(s.c.leseStand(unit.id).gesendet[-1]?.length, 1, "the step knows it was sent");
  s.units.finishUnit(unit.id, "abgebrochen");
  s.router.setTransport(null);
});

test("over the budget: no request by itself; on tap with the cost and the reason, still with a preview", async () => {
  const s = await setup();
  s.kiAn();
  s.eb.setzeStandardBudget(0.3);
  const { unit, vorschlag } = s.nurC("Paul Grenze");
  // spent + estimate above the budget, spent alone below it
  const schaetzung = s.nb.schaetzungUsd(s.nb.ANZAHL_VORSCHLAG);
  s.kostenInEinheit(unit.id, 0.3 * s.usdPerEur - schaetzung / 2);
  assert.equal(s.eb.einheitBudget(unit.id).erreicht, false);
  assert.deepEqual(s.eb.automatischFrei(unit.id, schaetzung), { erlaubt: false, grund: "Budget dieser Einheit erreicht (0,30 €)" });
  assert.equal(await s.nb.nachschubAutomatisch(unit.id), 0);
  assert.equal(s.gefragt.length, 0);
  const a = s.nb.nachschubImVorschlag(unit.id, null, vorschlag())!;
  assert.equal(a.gleich, false);
  assert.equal(a.hinweis, "Budget dieser Einheit erreicht (0,30 €). Neue Aufgaben nur auf Tippen.");
  assert.match(a.kosten ?? "", /^ca\. \d+ Cent$/);
  assert.equal(vorschlag().andere.find((k) => k.quelle === "C")!.gesperrt, null, "the tap still works");

  // on tap: one request, as a preview, nothing sent
  const asg = s.zaehle("assignments");
  const n = await s.nb.erstelleNachschub(unit.id, a.bedarf, { automatisch: false, teacherId: s.teacher.id });
  assert.ok(!("fehler" in n) && n.status === "bereit" && !n.automatisch);
  assert.equal(s.gefragt.length, 1);
  assert.equal(s.zaehle("assignments"), asg);
  // the line under the unit
  assert.match(s.eb.kostenZeile(s.eb.einheitBudget(unit.id)), /^KI heute: 0,\d\d € von 0,30 €$/);
  assert.equal(s.nb.nachschubTor(unit.id, unit.student_id, s.nb.ANZAHL_VORSCHLAG).automatisch.erlaubt, false, "still nothing by itself");
  s.units.finishUnit(unit.id, "abgebrochen");
  s.router.setTransport(null);
});

test("„Neue passende Aufgabe erstellen“ on tap (default 0 €): the same preview as by itself; nothing reaches the student before „Senden“", async () => {
  const s = await setup();
  s.kiAn();
  const { sid, unit, vorschlag } = s.nurC("Lea Tippen");
  const v = vorschlag();
  const k = v.andere.find((x) => x.quelle === "C")!;
  // the button sends the option; the action builds the need from it (app/cockpit-actions.ts vorschlagNeuAction)
  const b = s.nb.bedarfAusOption(s.c.leseStand(unit.id).steuerung.bis, null, k.option)!;
  assert.equal(b.schluessel, s.nb.bedarfImVorschlag(s.c.leseStand(unit.id).steuerung.bis, null, v)!.schluessel, "the same need as the card's");
  const vorher = { ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") };
  const n = await s.nb.erstelleNachschub(unit.id, b, { automatisch: false, teacherId: s.teacher.id });
  assert.ok(!("fehler" in n), JSON.stringify(n));
  assert.deepEqual({ status: n.status, automatisch: n.automatisch }, { status: "bereit", automatisch: false });
  assert.equal(s.gefragt.length, 1);
  assert.deepEqual({ ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") }, vorher, "no sheet and nothing sent yet");
  assert.equal(s.nb.nachschubImVorschlag(unit.id, null, vorschlag())!.eintrag?.id, n.id, "the card shows this preview, without C");

  // „Verwerfen“: nothing goes out; a new tap makes a new preview
  assert.equal(s.nb.verwirfNachschub(unit.id, n.id), true);
  assert.deepEqual({ ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") }, vorher);
  const m = await s.nb.erstelleNachschub(unit.id, b, { automatisch: false, teacherId: s.teacher.id });
  assert.ok(!("fehler" in m) && m.status === "bereit");
  assert.equal(s.zaehle("assignments"), vorher.asg);

  // „Senden“: exactly these tasks, once
  const out = await s.nb.sendeNachschub(unit.id, m.id, s.teacher.id);
  assert.ok(!("fehler" in out), JSON.stringify(out));
  assert.equal(s.repo.getAssignment(out.assignmentId)!.student_id, sid);
  assert.deepEqual(s.repo.listTasks(out.worksheetId).map((t) => t.prompt), ["Runde 862 auf Zehner.", "Runde 4 449 auf Hunderter."]);
  assert.equal(s.zaehle("assignments"), vorher.asg + 1);

  // KI off: the tap gives the reason, nothing is asked
  process.env.AI_DISABLED = "1";
  const { resetKiModusCache } = await import("./ai/modus");
  resetKiModusCache();
  try {
    const aus = await s.nb.erstelleNachschub(unit.id, { ...b, schluessel: `${b.schluessel}:aus` }, { automatisch: false, teacherId: s.teacher.id });
    assert.ok("fehler" in aus, JSON.stringify(aus));
    assert.equal(s.gefragt.length, 2);
  } finally {
    delete process.env.AI_DISABLED;
    resetKiModusCache();
  }
  s.units.finishUnit(unit.id, "abgebrochen");
  s.router.setTransport(null);
});

test("the student's limit wins over the unit's budget; a running request is reserved against the budget", async () => {
  const s = await setup();
  s.kiAn();
  s.eb.setzeStandardBudget(5);
  const { sid, unit, vorschlag } = s.nurC("Rosa Grenze");
  s.db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, student_id) VALUES (?, 'aufgaben', 'standard', 'claude-sonnet-5-5', 'anthropic', 'ok', 9, 0, ?)").run(new Date().toISOString(), sid);
  assert.equal(await s.nb.nachschubAutomatisch(unit.id), 0);
  assert.equal(s.gefragt.length, 0);
  const a = s.nb.nachschubImVorschlag(unit.id, null, vorschlag())!;
  assert.equal(a.tor.ki.erlaubt, false);
  assert.match(a.hinweis ?? "", /KI-Grenze/);
  assert.equal(a.kosten, null);
  const n = await s.nb.erstelleNachschub(unit.id, a.bedarf, { automatisch: false, teacherId: s.teacher.id });
  assert.ok("fehler" in n && /KI-Grenze/.test(n.fehler), "not on tap either");
  s.db().prepare("DELETE FROM ai_calls WHERE student_id = ?").run(sid);

  // two requests at once: the second sees the first one's estimate (budget just for one)
  const eine = s.nb.schaetzungUsd(s.nb.ANZAHL_VORSCHLAG);
  assert.deepEqual(s.eb.setzeBudgetDerEinheit(unit.id, Math.ceil((eine * 1.5 * 100) / s.usdPerEur) / 100, { admin: true }), { ok: true });
  let weiter: () => void = () => {};
  s.kiAn();
  s.router.setTransport(async (req) => {
    s.gefragt.push(req);
    await new Promise<void>((r) => (weiter = r));
    return { parsed: NEU, refusal: false, model: req.model, usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 } };
  });
  const erste = s.nb.erstelleNachschub(unit.id, a.bedarf, { automatisch: true, teacherId: s.teacher.id });
  await new Promise((r) => setTimeout(r, 20));
  const andere = { ...a.bedarf, schluessel: `${a.bedarf.schluessel}:2` };
  const zweite = await s.nb.erstelleNachschub(unit.id, andere, { automatisch: true, teacherId: s.teacher.id });
  assert.ok("fehler" in zweite && /Budget dieser Einheit erreicht/.test(zweite.fehler), JSON.stringify(zweite));
  weiter();
  const fertig = await erste;
  assert.ok(!("fehler" in fertig) && fertig.status === "bereit");
  assert.equal(s.gefragt.length, 1);
  s.units.finishUnit(unit.id, "abgebrochen");
  s.router.setTransport(null);
});

test("background KI: the live analysis counts to the unit; at 0 € it runs as today, with a budget it stops once it is reached", async () => {
  const s = await setup();
  const live = await import("./ai/realtime");
  const { submitAnswer } = await import("./service");
  const { generateBuiltIn } = await import("./generators");
  const sid = s.schueler("Lio Hintergrund");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  const tasks = generateBuiltIn({ subject: "Mathematik", skills: [{ id: "mathe.negativ.addieren", name: "Addieren" }], difficulty: "mittel", count: 6, taskType: "calc", seed: 5 }).filter((t) => t.answer.accepted);
  const wid = s.repo.createWorksheet({ title: "Negative Zahlen", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Negative Zahlen", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "generator", skill_ids: ["mathe.negativ.addieren"] }, tasks);
  const assignmentId = s.repo.assignWorksheet(wid, sid, "", unit.id);
  const ts = s.repo.listTasks(wid);
  const token = s.repo.getStudent(sid)!.access_token;
  // virtual clock and timers
  let now = Date.now();
  const timers: { due: number; fn: () => Promise<void>; id: number }[] = [];
  let seq = 0;
  s.router.setClock(() => now);
  live.setScheduler({ after: (ms, fn) => (timers.push({ due: now + ms, fn, id: ++seq }), seq), cancel: (id) => void timers.splice(timers.findIndex((t) => t.id === id), 1) });
  const advance = async (ms: number) => {
    now += ms;
    for (const t of timers.filter((x) => x.due <= now).sort((a, b) => a.due - b.due)) {
      timers.splice(timers.indexOf(t), 1);
      await t.fn();
    }
    await live.settle();
  };
  s.kiAn(() => ({ error_type: "vorzeichen", misconception: "Vorzeichen", confidence: 3, recommended_action: "weiter", difficulty_adjustment: 0, hint: "Schau auf das Vorzeichen.", next_skill: null, needs_new_exercise: false, teacher_note: "" }));
  live.resetLiveStats();
  const falsch = async (i: number) => {
    await submitAnswer({ token, assignmentId, taskId: ts[i].id, answer: "999", timeMs: 1000, hintsUsed: 0 });
    await advance(60_000);
  };
  const analysen = () => s.gefragt.filter((r) => r.fn === "echtzeit").length;

  await falsch(0);
  assert.equal(analysen(), 1);
  assert.equal(s.db().prepare("SELECT unit_id FROM ai_calls WHERE fn = 'echtzeit'").pluck().get(), unit.id, "counted to the unit");
  assert.ok(s.eb.einheitBudget(unit.id).kostenEur > 0, "and shown in the line");
  // 0 €: even with high costs in the unit, the analysis runs as today
  s.kostenInEinheit(unit.id, 2);
  await falsch(1);
  assert.equal(analysen(), 2);
  assert.equal(live.liveStats.skippedBudget, 0);
  // a budget, reached: no more background requests in this unit
  s.eb.setzeBudgetDerEinheit(unit.id, 0.3, { admin: true });
  assert.equal(s.eb.hintergrundGestoppt(unit.id), true);
  await falsch(2);
  assert.equal(analysen(), 2);
  assert.equal(live.liveStats.skippedBudget, 1);
  s.router.setTransport(null);
  s.router.setClock(null);
  live.setScheduler(null);
  live.forgetUnit(unit.id);
  s.units.finishUnit(unit.id, "abgebrochen");
});
