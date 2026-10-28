/**
 * Hausübung vorbereitet (E1): der Vorschlag aus den geprüften Ergebnissen (schwierig, teilweise, gut; Höchstzahlen), die Reihenfolge der
 * Quellen (Bibliothek, Generator, erst dann die KI), offene Antworten unter „Zu bewerten“ zählen nicht, die Fälligkeit aus dem nächsten
 * Termin oder leer, „Hausübung freigeben“ gesperrt bis jede neue Aufgabe geprüft ist, und erst dann Übung und Hausübung mit `unit_id`;
 * „Heute keine Hausübung“ in der Dokumentation; ohne KI. Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Alle Namen
 * sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR",
])
  delete process.env[k];

const DIV = "mathe.brueche.dividieren";
const KUE = "mathe.brueche.kuerzen";
const RUNDEN = "mathe.zahlen.runden";
const USAGE = { input: 2_000, output: 1_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 };
let nr = 0;

/** eine Aufgabe, wie die KI sie bei „neue_aufgabe“ liefert */
const kiAufgabe = (prompt: string, antwort: string) => ({
  category: "rechnen", format: "calc", skill_ids: [RUNDEN], topic: "Zahlen", difficulty: "mittel", prompt, passage: null, options: null, correct_option: null,
  accepted_answers: [antwort], numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null,
  answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["Runden"], solution: "Auf die Ziffer danach schauen.", solution_steps: [], estimated_time_sec: 90, hints: ["Welche Ziffer entscheidet?"], common_errors: [],
});
const NEU = { tasks: [kiAufgabe("Runde 862 auf Zehner.", "860"), kiAufgabe("Runde 4 449 auf Hunderter.", "4400")] };

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const hu = await import("./hausuebung");
  const ab = await import("./abschluss");
  const { endUnit } = await import("./learning");
  const router = await import("./ai/router");
  const { resetKiModusCache } = await import("./ai/modus");
  resetKiModusCache();
  router.resetRouter();
  router.setTransport(null);
  const kiAn = () => router.setTransport(async (req) => ({ parsed: NEU, refusal: false, model: req.model, usage: USAGE }));
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const aufgabe = (skill: string, prompt: string, difficulty: "leicht" | "mittel" = "mittel") => ({
    type: "calc" as const, skillId: skill, difficulty, prompt, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "Kehrwert", hints: [], errorMap: [],
  });
  /** `n` Aufgaben zu einer Fähigkeit, in der Einheit gesendet */
  const sende = (unitId: number | null, sid: number, skill: string, n: number) => {
    const ws = repo.createWorksheet(
      { title: `Üben ${skill}`, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [skill], status: "freigegeben", student_id: sid },
      Array.from({ length: n }, () => aufgabe(skill, `Aufgabe ${skill} Nr. ${++nr}`)),
    );
    return repo.assignWorksheet(ws, sid, "", unitId);
  };
  /** je Aufgabe eine endgültige Antwort: true richtig, false falsch; `review` „offen“ = wartet auf die Lehrkraft */
  const antworte = (unitId: number | null, asg: number, xs: boolean[], review: string | null = null) => {
    const a = repo.getAssignment(asg)!;
    const tasks = repo.listTasks(a.worksheet_id);
    xs.forEach((ok, i) => {
      const t = tasks[i % tasks.length];
      repo.recordAttempt({ assignment_id: asg, task_id: t.id, student_id: a.student_id, skill_id: t.skillId ?? null, attempt_no: 1, answer: ok ? "1" : "2", correct: ok ? 1 : 0, final: 1, time_ms: 30_000, active_ms: 25_000, hints_used: 0, solution_viewed: 0, error_label: ok ? null : "Falsch", feedback: "", unit_id: unitId, level: 3, review });
    });
  };
  /** ein Eintrag der Aufgabenbibliothek */
  const bibliothek = (skill: string, prompt: string, sourceType?: string) =>
    repo.createWorksheet(
      { title: prompt, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "bibliothek", source: "manuell", skill_ids: [skill] },
      [{ ...aufgabe(skill, prompt), ...(sourceType ? { sourceType } : {}) }],
    );
  const start = (sid: number) => units.startUnit(teacher.id, sid, { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  const ende = (unitId: number) => endUnit(unitId, { byTeacherId: teacher.id })!;
  const zaehle = (sql: string, ...p: unknown[]) => db().prepare(sql).pluck().get(...p) as number;
  return { db, repo, units, hu, ab, router, kiAn, teacher, schueler, sende, antworte, bibliothek, start, ende, zaehle };
}

// ---------- Regeln ohne Datenbank ----------

const aufgaben = (skillId: string, skill: string, xs: { ok: boolean; tries?: number }[]) =>
  xs.map((x, i) => ({ assignmentId: 1, skillId, skill, correct: x.ok, finished: true, firstTry: x.ok && (x.tries ?? 1) === 1, tries: x.tries ?? 1, help: "keine" as const, i }));

test("weighting: difficult first (about 4), partial next, good only as 1–2 repetitions and only without two weaker topics; at most 3 topics and 10 tasks", async () => {
  const { ergebnisThemen, auswahl } = await import("./hausuebung");
  const b = {
    aufgaben: [
      ...aufgaben("pc", "Present Continuous", [{ ok: true }, { ok: true, tries: 2 }, { ok: false }, { ok: true }, { ok: false }]),
      ...aufgaben("psq", "Past Simple Questions", [{ ok: false }, { ok: false }, { ok: true }, { ok: false }]),
      ...aufgaben("ps", "Present Simple", [{ ok: true }, { ok: true }, { ok: true }, { ok: true }]),
    ],
    beobachtungen: [],
    reaktionen: [],
  };
  const t = ergebnisThemen(b);
  assert.deepEqual(t.map((x) => [x.skillId, x.stand]), [["psq", "schwierig"], ["pc", "teilweise"], ["ps", "gut"]]);
  assert.equal(t[0].grund, "noch schwierig: 1 von 4 richtig");
  assert.equal(t[1].grund, "teilweise: 3 von 5 richtig");
  // two weaker topics: no repetition of the good one
  assert.deepEqual(auswahl(t).map((x) => [x.skillId, x.soll]), [["psq", 4], ["pc", 4]]);
  // one weaker topic: the good one with 2 repetition tasks
  assert.deepEqual(auswahl(t.filter((x) => x.skillId !== "pc")).map((x) => [x.skillId, x.soll]), [["psq", 4], ["ps", 2]]);
  assert.deepEqual(auswahl(t.filter((x) => x.skillId === "ps")).map((x) => [x.skillId, x.soll]), [["ps", 2]]);
  // four difficult topics: three of them, 10 tasks
  const vier = ["a", "b", "c", "d"].map((id) => ({ skillId: id, stand: "schwierig" as const }));
  const w = auswahl(vier);
  assert.deepEqual(w.map((x) => x.soll), [4, 3, 3]);
  assert.ok(w.reduce((s, x) => s + x.soll, 0) <= 10);

  // your „Falsch“ at a question and an easier task in the unit make a topic difficult; your „Richtig“ alone counts as good
  const o = ergebnisThemen({
    aufgaben: [...aufgaben("x", "Kürzen", [{ ok: true }, { ok: true }, { ok: true }])],
    beobachtungen: [
      { titel: "Was heißt kürzen?", art: "frage", antwort: "falsch", skillIds: ["x"] },
      { titel: "Erkläre Runden", art: "frage", antwort: "richtig", skillIds: ["r"] },
    ],
    reaktionen: [{ art: "leichter", skillId: "y", skill: "Dividieren", assignmentId: null }],
  });
  assert.deepEqual(o.map((x) => [x.skillId, x.stand]), [["x", "schwierig"], ["y", "schwierig"], ["r", "gut"]]);
  assert.match(o[0].grund, /Frage „Was heißt kürzen\?“ falsch beantwortet/);
});

test("duration: per task type as a range, writing by word count, shown in 5-minute steps", async () => {
  const { minutenFuer, dauer } = await import("./hausuebung");
  const t = (type: string, data = {}) => ({ type, data, estimatedTimeSec: null }) as never;
  assert.deepEqual(minutenFuer(t("mc")), [1, 2]);
  assert.deepEqual(minutenFuer(t("rechenweg")), [3, 4]);
  assert.deepEqual(minutenFuer(t("free")), [3, 3]);
  assert.deepEqual(minutenFuer(t("free", { schreibauftrag: { textsorte: "E-Mail", woerter: 60 } })), [4, 6]);
  assert.deepEqual(minutenFuer({ type: "calc", data: {}, estimatedTimeSec: 120 }), [2, 3]);
  // 8 closed tasks and a short writing task: 12–22 min
  const d = dauer([...Array.from({ length: 8 }, () => t("cloze")), t("free", { schreibauftrag: { textsorte: "E-Mail", woerter: 60 } })]);
  assert.deepEqual([d.von, d.bis, d.text], [12, 22, "ca. 10–25 min"]);
  assert.equal(dauer([t("mc")]).text, "ca. 5 min");
  assert.equal(dauer([]).text, "");
});

// ---------- mit der Datenbank ----------

test("sources in order: library first, then the generator; nothing sent in this unit or solved lately; no KI, nothing reaches the student before the release", async () => {
  const s = await setup();
  const sid = s.schueler("Ilvy Bruchmoser");
  // a library task the student solved four days ago (another assignment) does not come back
  const alt = s.bibliothek(DIV, "Bibliothek: 7/8 : 1/4 = ?");
  const altAsg = s.repo.assignWorksheet(alt, sid, "", null);
  s.antworte(null, altAsg, [true]);
  const gut = s.bibliothek(DIV, "Bibliothek: 3/5 : 3/10 = ?");
  const unit = s.start(sid);
  // Dividieren: 1 of 4 right → difficult; Kürzen 3 of 3 first try → good (no repetition: only one weaker topic? then 2)
  s.antworte(unit.id, s.sende(unit.id, sid, DIV, 4), [false, false, true, false]);
  s.antworte(unit.id, s.sende(unit.id, sid, KUE, 3), [true, true, true]);
  s.ende(unit.id);
  const vorher = { ws: s.zaehle("SELECT COUNT(*) FROM worksheets WHERE student_id = ?", sid), hw: s.zaehle("SELECT COUNT(*) FROM homework") };

  const v = s.hu.hausuebungDerEinheit(unit.id)!;
  assert.equal(v.status, "vorschlag");
  assert.equal(v.gespeichert, false);
  assert.deepEqual(v.themen.map((t) => [t.skillId, t.stand, t.soll, t.aufgaben.length]), [[DIV, "schwierig", 4, 4], [KUE, "gut", 2, 2]]);
  const div = v.themen[0];
  assert.equal(div.grund, "noch schwierig: 1 von 4 richtig");
  assert.equal(div.aufgaben[0].herkunft, "bibliothek", "the library first");
  assert.equal(s.repo.listTasks(gut)[0].prompt, div.aufgaben[0].task.prompt);
  assert.ok(div.aufgaben.slice(1).every((a) => a.herkunft === "generator"), "then the generator");
  const prompts = v.aufgaben.map((a) => a.task.prompt);
  assert.ok(!prompts.includes("Bibliothek: 7/8 : 1/4 = ?"), "solved lately: not again");
  assert.ok(!prompts.some((p) => p.startsWith("Aufgabe ")), "nothing that was sent in this unit");
  assert.equal(new Set(v.aufgaben.map((a) => a.key)).size, v.aufgaben.length, "no task twice");
  assert.equal(v.gesperrt, null, "library and generator tasks may go out");
  assert.ok(v.dauer.text.startsWith("ca. "));
  // the same proposal on the next look (fixed seeds), still unsaved
  assert.deepEqual(s.hu.hausuebungDerEinheit(unit.id)!.aufgaben.map((a) => a.key), v.aufgaben.map((a) => a.key));
  assert.equal(s.zaehle("SELECT COUNT(*) FROM ai_calls"), 0);
  assert.equal(s.zaehle("SELECT COUNT(*) FROM einheit_hausuebung"), 0);
  assert.deepEqual({ ws: s.zaehle("SELECT COUNT(*) FROM worksheets WHERE student_id = ?", sid), hw: s.zaehle("SELECT COUNT(*) FROM homework") }, vorher, "nothing for the student yet");

  // Ändern: swap takes the next candidate of the same order, remove drops one, the count refills
  const erste = div.aufgaben[0].key;
  assert.deepEqual(s.hu.tauscheAufgabe(unit.id, DIV, erste, s.teacher.id), { ok: true });
  const nach = s.hu.hausuebungDerEinheit(unit.id)!;
  assert.equal(nach.gespeichert, true);
  assert.ok(!nach.themen[0].aufgaben.some((a) => a.key === erste));
  assert.equal(nach.themen[0].aufgaben.length, 4);
  assert.deepEqual(s.hu.entferneAufgabe(unit.id, KUE, nach.themen[1].aufgaben[0].key, s.teacher.id), { ok: true });
  assert.equal(s.hu.hausuebungDerEinheit(unit.id)!.themen[1].aufgaben.length, 1);
  assert.deepEqual(s.hu.setzeAnzahl(unit.id, DIV, 6, s.teacher.id), { ok: true });
  assert.equal(s.hu.hausuebungDerEinheit(unit.id)!.themen[0].aufgaben.length, 6);
  assert.ok(!s.hu.hausuebungDerEinheit(unit.id)!.aufgaben.some((a) => a.key === erste), "a swapped task does not come back");
  assert.deepEqual(s.hu.setzeAnzahl(unit.id, KUE, 0, s.teacher.id), { ok: true });
  assert.deepEqual(s.hu.hausuebungDerEinheit(unit.id)!.themen.map((t) => t.skillId), [DIV]);
  // Kürzen comes back from today's topics
  assert.ok(s.hu.hausuebungDerEinheit(unit.id)!.planThemen.some((p) => p.skillId === KUE));
  assert.deepEqual(s.hu.themaDazu(unit.id, KUE, s.teacher.id), { ok: true });
  assert.deepEqual(s.hu.hausuebungDerEinheit(unit.id)!.themen.map((t) => [t.skillId, t.stand]), [[DIV, "schwierig"], [KUE, "gut"]]);
  assert.deepEqual(s.hu.neuBauen(unit.id, s.teacher.id), { ok: true });
  assert.equal(s.hu.hausuebungDerEinheit(unit.id)!.gespeichert, false, "back to the proposal");
  assert.equal(s.zaehle("SELECT COUNT(*) FROM homework"), 0);
});

test("answers waiting in „Zu bewerten“ are no result: the card says so and can build from today's topics", async () => {
  const s = await setup();
  const sid = s.schueler("Pia Wartenberg");
  const unit = s.start(sid);
  s.db().prepare("INSERT INTO einheit_vorgabe (unit_id, student_id, text, skill_ids) VALUES (?, ?, ?, ?)").run(unit.id, sid, "Heute Dividieren", JSON.stringify([DIV]));
  s.antworte(unit.id, s.sende(unit.id, sid, DIV, 3), [false, false, false], "offen");
  s.ende(unit.id);
  const v = s.hu.hausuebungDerEinheit(unit.id)!;
  assert.equal(v.ohneErgebnisse, true);
  assert.equal(v.offen, 3);
  assert.deepEqual(v.themen, [], "three wrong but open answers are not „noch schwierig“");
  assert.deepEqual(v.planThemen.map((p) => p.skillId), [DIV]);
  assert.deepEqual(s.hu.neuBauen(unit.id, s.teacher.id, { ausPlan: true }), { ok: true });
  const p = s.hu.hausuebungDerEinheit(unit.id)!;
  assert.equal(p.ausPlan, true);
  assert.equal(p.ohneErgebnisse, false);
  assert.deepEqual(p.themen.map((t) => [t.skillId, t.stand, t.aufgaben.length]), [[DIV, "plan", 3]]);
});

test("due date: the next planned unit of the student; without one it stays empty and must be chosen", async () => {
  const s = await setup();
  const { tagAddieren, wienerDatum, wochenstartVon, wochentagVon } = await import("./planung/zeit");
  const mit = s.schueler("Toni Terminfest");
  const ohne = s.schueler("Ria Ohnetermin");
  const heute = wienerDatum();
  const termin = tagAddieren(heute, 6);
  s.db()
    .prepare("INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, status, created_at, updated_at) VALUES (?, ?, 900, 100, ?, ?, 'veroeffentlicht', datetime('now'), datetime('now'))")
    .run(wochenstartVon(termin), wochentagVon(termin), s.teacher.id, mit);
  assert.equal(s.hu.naechsterTermin(mit, heute), termin);
  assert.equal(s.hu.naechsterTermin(ohne, heute), null);

  const u1 = s.start(mit);
  s.antworte(u1.id, s.sende(u1.id, mit, DIV, 4), [false, true, false, false]);
  s.ende(u1.id);
  const v1 = s.hu.hausuebungDerEinheit(u1.id)!;
  assert.deepEqual([v1.faellig, v1.faelligAusTermin], [termin, true]);

  const u2 = s.start(ohne);
  s.antworte(u2.id, s.sende(u2.id, ohne, DIV, 4), [false, true, false, false]);
  s.ende(u2.id);
  const v2 = s.hu.hausuebungDerEinheit(u2.id)!;
  assert.deepEqual([v2.faellig, v2.faelligAusTermin], [null, false], "no invented date");
  assert.deepEqual(s.hu.freigeben(u2.id, { faellig: "", teacherId: s.teacher.id }), { fehler: "Bitte eine Fälligkeit wählen." });
  assert.equal(s.zaehle("SELECT COUNT(*) FROM homework WHERE student_id = ?", ohne), 0);
});

test("KI only when library and generator have nothing: on tap with cost (0 € budget), „ungeprüft“; release blocked until every new task is checked; then one exercise and one homework with unit_id", async () => {
  const s = await setup();
  const portal = await import("./schuelerportal");
  const { tagAddieren, wienerDatum } = await import("./planung/zeit");
  s.kiAn();
  const sid = s.schueler("Mats Rundinger");
  const unit = s.start(sid);
  s.antworte(unit.id, s.sende(unit.id, sid, RUNDEN, 3), [false, false, true]);
  s.ende(unit.id);
  const v = s.hu.hausuebungDerEinheit(unit.id)!;
  assert.deepEqual(v.themen.map((t) => [t.skillId, t.stand, t.aufgaben.length, t.soll]), [[RUNDEN, "schwierig", 0, 4]]);
  assert.ok(v.ki.erlaubt && !v.ki.automatisch, "with 0 € per unit only on tap");
  assert.ok(v.ki.erlaubt && v.ki.kosten?.startsWith("ca. "));
  assert.equal(v.gesperrt, "Noch keine Aufgabe in der Hausübung.");
  // by itself: nothing at 0 €
  assert.equal(await s.hu.kiAutomatisch(unit.id), 0);
  assert.equal(s.zaehle("SELECT COUNT(*) FROM ai_calls"), 0);

  // on tap: the KI's tasks as a preview, unchecked; the call counts for the unit
  assert.deepEqual(await s.hu.kiAufgaben(unit.id, RUNDEN, { automatisch: false, teacherId: s.teacher.id }), { ok: true });
  assert.equal(s.zaehle("SELECT COUNT(*) FROM ai_calls WHERE fn = 'neue_aufgabe' AND unit_id = ?", unit.id), 1);
  const k = s.hu.hausuebungDerEinheit(unit.id)!;
  assert.deepEqual(k.themen[0].aufgaben.map((a) => [a.herkunft, a.geprueft]), [["ki", false], ["ki", false]]);
  assert.match(k.gesperrt!, /^2 neue Aufgaben sind noch nicht geprüft/);
  const faellig = tagAddieren(wienerDatum(), 7);
  assert.deepEqual(s.hu.freigeben(unit.id, { faellig, teacherId: s.teacher.id }), { fehler: k.gesperrt });
  assert.equal(s.zaehle("SELECT COUNT(*) FROM homework"), 0, "nothing before the release");
  assert.equal(s.zaehle("SELECT COUNT(*) FROM assignments WHERE student_id = ? AND unit_id IS NULL", sid), 0);

  s.hu.setzeGeprueft(unit.id, RUNDEN, k.themen[0].aufgaben[0].key, true, s.teacher.id);
  assert.match(s.hu.hausuebungDerEinheit(unit.id)!.gesperrt!, /^Eine neue Aufgabe ist noch nicht geprüft/);
  s.hu.setzeGeprueft(unit.id, RUNDEN, k.themen[0].aufgaben[1].key, true, s.teacher.id);
  assert.equal(s.hu.hausuebungDerEinheit(unit.id)!.gesperrt, null);
  s.hu.setzeNotiz(unit.id, "Zuerst die Regel im Heft lesen.", s.teacher.id);

  const out = s.hu.freigeben(unit.id, { faellig, teacherId: s.teacher.id });
  assert.ok("ok" in out);
  const hw = s.db().prepare("SELECT * FROM homework WHERE id = ?").get(out.homeworkId) as { unit_id: number; assignment_id: number; due_date: string; description: string; student_id: number };
  assert.equal(hw.unit_id, unit.id);
  assert.equal(hw.due_date, faellig);
  assert.equal(hw.student_id, sid);
  assert.match(hw.description, /^2 Aufgaben \(Runden und Überschlagen 2\), ca\. 5–10 min – Zuerst die Regel im Heft lesen\.$/);
  const asg = s.repo.getAssignment(hw.assignment_id)!;
  assert.equal(asg.worksheet_id, out.worksheetId);
  assert.equal(asg.unit_id, null, "answers at home do not count as this unit");
  const ws = s.repo.getWorksheet(out.worksheetId)!;
  assert.equal(ws.student_id, sid);
  assert.equal(ws.status, "freigegeben");
  assert.deepEqual(s.repo.listTasks(out.worksheetId).map((t) => t.sourceType), ["ki", "ki"], "the origin stays on the task");
  assert.equal(s.zaehle("SELECT COUNT(*) FROM worksheets WHERE student_id = ? AND title LIKE '%Hausübung%'", sid), 1, "exactly one exercise");
  // the student portal: as homework with its exercise, without KI words
  const p = portal.hausuebungen(sid);
  assert.deepEqual(p.offen.map((h) => [h.id, h.uebungId]), [[out.homeworkId, hw.assignment_id]]);
  assert.doesNotMatch(JSON.stringify(p) + ws.title, /\bKI\b|ungeprüft|neu erstellt/);
  // Abschluss and documentation
  const lesson = s.repo.getLessonForUnit(unit.id)!;
  const zeile = s.ab.karteDerEinheit(unit.id, lesson).gemacht.find((z) => z.von === "hausuebung");
  assert.match(zeile!.text, /^Hausübung: 2 Aufgaben \(Runden und Überschlagen 2\), ca\. 5–10 min, fällig /);
  assert.ok(!s.ab.karteDerEinheit(unit.id, lesson).naechstes.some((z) => z.text.startsWith("Hausübung")), "not twice under „Nächstes Mal“");
  assert.equal(lesson.homework_note, zeile!.text);
  assert.equal(s.hu.hausuebungDerEinheit(unit.id)!.status, "freigegeben");
  assert.ok("fehler" in s.hu.freigeben(unit.id, { faellig, teacherId: s.teacher.id }), "released once");
  assert.ok("fehler" in s.hu.entferneAufgabe(unit.id, RUNDEN, k.themen[0].aufgaben[0].key, s.teacher.id));
});

test("within the unit's KI budget the app asks by itself, once per topic, still as unchecked preview", async () => {
  const s = await setup();
  const eb = await import("./ai/einheit-budget");
  s.kiAn();
  const sid = s.schueler("Lenz Budgetmair");
  const unit = s.start(sid);
  s.antworte(unit.id, s.sende(unit.id, sid, RUNDEN, 3), [false, false, false]);
  s.ende(unit.id);
  eb.setzeBudgetDerEinheit(unit.id, 0.3, { admin: true });
  const v = s.hu.hausuebungDerEinheit(unit.id)!;
  assert.ok(v.ki.erlaubt && v.ki.automatisch);
  assert.equal(await s.hu.kiAutomatisch(unit.id), 1);
  assert.equal(await s.hu.kiAutomatisch(unit.id), 0, "not twice");
  assert.equal(s.zaehle("SELECT COUNT(*) FROM ai_calls WHERE fn = 'neue_aufgabe' AND unit_id = ?", unit.id), 1);
  assert.ok(s.hu.hausuebungDerEinheit(unit.id)!.aufgaben.every((a) => a.herkunft === "ki" && !a.geprueft));
  assert.equal(s.zaehle("SELECT COUNT(*) FROM homework"), 0);
});

test("„Heute keine Hausübung“ is recorded in Abschluss and documentation, and can be taken back", async () => {
  const s = await setup();
  const sid = s.schueler("Ida Ohnehaus");
  const unit = s.start(sid);
  s.antworte(unit.id, s.sende(unit.id, sid, DIV, 4), [false, false, true, false]);
  const lessonId = s.ende(unit.id);
  assert.deepEqual(s.hu.ueberspringe(unit.id, s.teacher.id), { ok: true });
  assert.equal(s.hu.hausuebungDerEinheit(unit.id)!.status, "uebersprungen");
  const karte = s.ab.karteDerEinheit(unit.id, s.repo.getLesson(lessonId)!);
  assert.ok(karte.gemacht.some((z) => z.text === "Heute keine Hausübung" && z.von === "hausuebung"));
  assert.equal(s.ab.bestaetigeAbschluss(lessonId), true);
  assert.match(s.repo.getLesson(lessonId)!.activities, /^Heute keine Hausübung$/m);
  assert.equal(s.repo.getLesson(lessonId)!.homework_note, "", "the documentation's homework field stays empty");
  assert.equal(s.zaehle("SELECT COUNT(*) FROM homework"), 0);
  assert.equal(s.zaehle("SELECT COUNT(*) FROM ai_calls"), 0);
  // taken back after confirming: the line goes from the automatic field again
  assert.deepEqual(s.hu.zuruecknehmen(unit.id), { ok: true });
  assert.equal(s.hu.hausuebungDerEinheit(unit.id)!.status, "vorschlag");
  assert.doesNotMatch(s.repo.getLesson(lessonId)!.activities, /Hausübung/);
});

test("KI off: proposal from library and generator only; a topic without any source says to add it yourself; no KI call", async () => {
  const s = await setup();
  process.env.AI_DISABLED = "1";
  try {
    const sid = s.schueler("Nele Ohnekabel");
    const unit = s.start(sid);
    s.antworte(unit.id, s.sende(unit.id, sid, RUNDEN, 2), [false, false]);
    s.antworte(unit.id, s.sende(unit.id, sid, DIV, 4), [true, false, true, false]);
    s.ende(unit.id);
    const v = s.hu.hausuebungDerEinheit(unit.id)!;
    assert.deepEqual(v.ki, { erlaubt: false, grund: "Die KI ist aus." });
    const runden = v.themen.find((t) => t.skillId === RUNDEN)!;
    const div = v.themen.find((t) => t.skillId === DIV)!;
    assert.equal(runden.aufgaben.length, 0);
    assert.equal(s.hu.fehlt(runden), 4);
    assert.ok(div.aufgaben.length > 0 && div.aufgaben.every((a) => a.herkunft === "generator"));
    assert.deepEqual(await s.hu.kiAufgaben(unit.id, RUNDEN, { automatisch: false, teacherId: s.teacher.id }), { fehler: "Die KI ist aus." });
    assert.equal(s.zaehle("SELECT COUNT(*) FROM ai_calls"), 0);
    // the release takes what is there (Dividieren); the empty topic is not in it
    const out = s.hu.freigeben(unit.id, { faellig: "2099-01-05", teacherId: s.teacher.id });
    assert.ok("ok" in out);
    const hw = s.db().prepare("SELECT description FROM homework WHERE id = ?").pluck().get(out.homeworkId) as string;
    assert.match(hw, /^\d+ Aufgaben \(Dividieren \d+\), ca\. /);
    assert.doesNotMatch(hw, /Runden/);
  } finally {
    delete process.env.AI_DISABLED;
  }
});
