/**
 * Anpassung im Unterricht (niko, 25.10.2026): die Regeln ohne Datenbank (jede Regel, Schwellen, Voraussetzung, nur
 * Fähigkeiten von heute), dann mit Datenbank die Quellen A → B → C, die Sperren der KI, KI-Fehler → Generator,
 * schlecht bewertete Aufgaben, zwei Einheiten zugleich und „Richtig / Teilweise / Falsch“ im Cockpit. Kein Schlüssel,
 * kein Aufruf nach außen: der Transport wird ersetzt. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { Antwort, Lage } from "./steuerung-regeln";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR",
])
  delete process.env[k];

const DIV = "mathe.brueche.dividieren";
const MUL = "mathe.brueche.multiplizieren";
const KUE = "mathe.brueche.kuerzen";

// ---------- the rules, without the database ----------

let nr = 0;
/** an answer: right at once, or wrong with an error label */
const a = (o: Partial<Antwort> = {}): Antwort => ({ taskId: ++nr, skillId: DIV, correct: true, hints: 0, timeMs: 30_000, solutionViewed: false, errorType: null, errorLabel: null, ...o });
const falsch = (o: Partial<Antwort> = {}) => a({ correct: false, errorType: "regel", errorLabel: "Kehrwert vergessen", ...o });
const lage = (o: Partial<Lage> = {}): Lage => ({
  antworten: [],
  aufgaben: 3,
  skillId: DIV,
  stufen: { [DIV]: 3 },
  heute: { vorgabe: [], schritt: [DIV], pruefung: [] },
  voraussetzungen: { [DIV]: [MUL] },
  lernstand: { [DIV]: 0.4, [MUL]: 0.5 },
  hilfe: true,
  naechsterSchritt: true,
  fehlerAufgaben: [],
  lehrer: null,
  ...o,
});

test("nothing sent or answered yet: no proposal", async () => {
  const { schlageVor } = await import("./steuerung-regeln");
  assert.equal(schlageVor(lage()), null);
  assert.equal(schlageVor(lage({ antworten: [falsch()] })), null, "one wrong answer is below the threshold");
  assert.equal(schlageVor(lage({ antworten: [a(), a()] })), null, "two of three tasks right: not yet");
});

test("2 wrong answers: an easier task of the same skill, with the repeated error in plain words", async () => {
  const { schlageVor, FEHLER_AB, FENSTER } = await import("./steuerung-regeln");
  assert.equal(FEHLER_AB, 2);
  const t = nr + 1;
  const v = schlageVor(lage({ antworten: [falsch({ taskId: t }), falsch({ taskId: t })] }))!;
  assert.equal(v.grund, "2 Fehler: Kehrwert vergessen");
  assert.equal(v.ausloeser, "antworten");
  assert.deepEqual(v.haupt, { art: "leichter", skillId: DIV, level: 2, fokus: "Kehrwert vergessen" });
  assert.deepEqual(v.andere.map((o) => o.art), ["voraussetzung", "erklaeren"], "the other ways under „Andere Möglichkeit“");
  assert.equal(v.andere[0].skillId, MUL);
  // different labels: no error named
  assert.equal(schlageVor(lage({ antworten: [falsch({ errorLabel: "a" }), falsch({ errorLabel: "b", errorType: "rechenfehler" })] }))!.grund, "2 Fehler");
  // only the last FENSTER answers count: two old errors and five right ones after them
  const alt = [falsch(), falsch(), ...Array.from({ length: FENSTER }, () => a())];
  assert.notEqual(schlageVor(lage({ antworten: alt }))?.haupt.art, "leichter");
  // a solution looked at counts as wrong
  assert.equal(schlageVor(lage({ antworten: [a({ solutionViewed: true }), falsch()] }))!.haupt.art, "leichter");
});

test("already the easiest level: the prerequisite from the skill graph, otherwise „Einfacher erklären“", async () => {
  const { schlageVor } = await import("./steuerung-regeln");
  const zwei = [falsch(), falsch()];
  const v = schlageVor(lage({ antworten: zwei, stufen: { [DIV]: 1 } }))!;
  assert.match(v.grund, /schon die leichteste Stufe/);
  assert.equal(v.haupt.art, "voraussetzung");
  assert.equal(v.haupt.skillId, MUL);
  assert.equal(v.haupt.level, 3, "the prerequisite's level fits its Lernstand (50 % → mittel)");
  // a secure prerequisite is no way back
  const sicher = schlageVor(lage({ antworten: zwei, stufen: { [DIV]: 1 }, lernstand: { [DIV]: 0.4, [MUL]: 0.9 } }))!;
  assert.equal(sicher.haupt.art, "erklaeren");
  // of two prerequisites, one of today's comes first, then the weakest
  const zweiVor = lage({ antworten: zwei, stufen: { [DIV]: 1 }, voraussetzungen: { [DIV]: [MUL, KUE] }, lernstand: { [MUL]: 0.6, [KUE]: 0.2 } });
  assert.equal(schlageVor(zweiVor)!.haupt.skillId, KUE);
  assert.equal(schlageVor({ ...zweiVor, heute: { vorgabe: [MUL], schritt: [DIV], pruefung: [] } })!.haupt.skillId, MUL);
  // nothing to explain and nothing easier: no proposal
  assert.equal(schlageVor(lage({ antworten: zwei, stufen: { [DIV]: 1 }, voraussetzungen: {}, hilfe: false })), null);
});

test("a repeated error: a task on exactly this error first, when a generator can build one", async () => {
  const { schlageVor } = await import("./steuerung-regeln");
  const ART = "deutsch.grammatik.artikel";
  const zwei = [falsch({ skillId: ART, errorLabel: "Falscher Artikel", errorType: "grammatik" }), falsch({ skillId: ART, errorLabel: "Falscher Artikel", errorType: "grammatik" })];
  const v = schlageVor(lage({ antworten: zwei, skillId: ART, stufen: { [ART]: 3 }, heute: { vorgabe: [], schritt: [ART], pruefung: [] }, fehlerAufgaben: [ART] }))!;
  assert.equal(v.haupt.art, "fehler");
  assert.equal(v.haupt.fokus, "Falscher Artikel");
  assert.equal(v.andere[0].art, "leichter");
  // without such a generator: the easier task, the error still named
  assert.equal(schlageVor(lage({ antworten: zwei, skillId: ART, stufen: { [ART]: 3 }, heute: { vorgabe: [], schritt: [ART], pruefung: [] } }))!.haupt.art, "leichter");
});

test("hints on most tasks: together at the board, no new task", async () => {
  const { schlageVor } = await import("./steuerung-regeln");
  const v = schlageVor(lage({ antworten: [a({ hints: 1 }), a({ hints: 2 }), a()] }))!;
  assert.equal(v.grund, "Hilfe bei 2 von 3 Aufgaben");
  assert.equal(v.haupt.art, "tafel");
  assert.deepEqual(v.andere.map((o) => o.art), ["leichter"]);
  assert.equal(schlageVor(lage({ antworten: [a({ hints: 1 }), a(), a({ hints: 1 }), a()] }))?.haupt.art ?? null, null, "half of the tasks is not most");
  assert.equal(schlageVor(lage({ antworten: [a({ hints: 1 })] })), null, "one task is too few");
});

test("all right at the first try: harder when fast, next step otherwise; the threshold follows short exercises", async () => {
  const { schlageVor, SCHNELL_MS } = await import("./steuerung-regeln");
  const schnell = schlageVor(lage({ antworten: [a(), a(), a()] }))!;
  assert.equal(schnell.haupt.art, "schwerer");
  assert.equal(schnell.haupt.level, 4);
  assert.deepEqual(schnell.andere.map((o) => o.art), ["weiter"]);
  assert.match(schnell.grund, /^3 von 3 richtig, schnell/);
  const langsam = schlageVor(lage({ antworten: [a({ timeMs: SCHNELL_MS + 1 }), a({ timeMs: SCHNELL_MS * 2 }), a({ timeMs: SCHNELL_MS * 3 })] }))!;
  assert.equal(langsam.haupt.art, "weiter");
  assert.equal(langsam.grund, "3 von 3 richtig");
  assert.equal(schlageVor(lage({ antworten: [a(), a(), a()], stufen: { [DIV]: 5 } }))!.haupt.art, "weiter", "the hardest level: only next");
  assert.equal(schlageVor(lage({ antworten: [a(), a(), a()], stufen: { [DIV]: 5 }, naechsterSchritt: false })), null);
  assert.equal(schlageVor(lage({ antworten: [a()], aufgaben: 1 }))!.grund.startsWith("1 von 1 richtig"), true, "a check with one task");
  // right in the second try is not „all right at once“
  const t = nr + 1;
  assert.equal(schlageVor(lage({ antworten: [falsch({ taskId: t }), a({ taskId: t }), a(), a()] })), null);
});

test("the teacher's sign („versteht es nicht“, „Falsch“) brings the easier way; answers come first", async () => {
  const { schlageVor } = await import("./steuerung-regeln");
  const nicht = schlageVor(lage({ lehrer: "nicht_verstanden" }))!;
  assert.equal(nicht.ausloeser, "lehrer");
  assert.equal(nicht.grund, "Schüler versteht es nicht");
  assert.equal(nicht.haupt.art, "leichter");
  assert.ok(!nicht.andere.some((o) => o.art === "erklaeren"), "the help is already on screen");
  const f = schlageVor(lage({ lehrer: "falsch" }))!;
  assert.equal(f.grund, "Frage falsch beantwortet");
  assert.ok(f.andere.some((o) => o.art === "erklaeren"));
  assert.equal(schlageVor(lage({ lehrer: "falsch", antworten: [falsch(), falsch()] }))!.ausloeser, "antworten");
  // without an exercise the level comes from the Lernstand
  assert.equal(schlageVor(lage({ lehrer: "nicht_verstanden", stufen: {}, lernstand: { [DIV]: 0.6 } }))!.haupt.level, 2);
});

test("it stays with today's skills: Vorgabe > step > exam; a prerequisite of today's skill belongs to it", async () => {
  const { schlageVor, zielSkill } = await import("./steuerung-regeln");
  const fremd = "mathe.zahlen.runden";
  const heute = { vorgabe: ["mathe.brueche.addieren"], schritt: [DIV], pruefung: [KUE] };
  assert.equal(zielSkill(fremd, { heute, voraussetzungen: {} }), "mathe.brueche.addieren", "the Vorgabe first");
  assert.equal(zielSkill(fremd, { heute: { ...heute, vorgabe: [] }, voraussetzungen: {} }), DIV, "then the step");
  assert.equal(zielSkill(fremd, { heute: { vorgabe: [], schritt: [], pruefung: [KUE] }, voraussetzungen: {} }), KUE, "then the exam");
  assert.equal(zielSkill(MUL, { heute, voraussetzungen: { [DIV]: [MUL] } }), MUL, "a prerequisite of today's skill");
  assert.equal(zielSkill(fremd, { heute: { vorgabe: [], schritt: [], pruefung: [] }, voraussetzungen: {} }), fremd, "nothing for today: its own");
  const v = schlageVor(lage({ antworten: [falsch({ skillId: fremd }), falsch({ skillId: fremd })], heute }))!;
  assert.equal(v.haupt.skillId, "mathe.brueche.addieren");
});

test("where a task comes from: A before B before C; C locked with its reason", async () => {
  const { quelleFuer } = await import("./steuerung-regeln");
  const ki = { erlaubt: true as const, kosten: "ca. 2 Cent" };
  assert.deepEqual(quelleFuer({ bestand: 2, generator: true, ki }), { quelle: "A", gesperrt: null });
  assert.deepEqual(quelleFuer({ bestand: 0, generator: true, ki }), { quelle: "B", gesperrt: null });
  assert.deepEqual(quelleFuer({ bestand: 0, generator: false, ki }), { quelle: "C", gesperrt: null });
  assert.deepEqual(quelleFuer({ bestand: 0, generator: false, ki: { erlaubt: false, grund: "Die KI ist aus." } }), { quelle: "C", gesperrt: "Die KI ist aus." });
});

// ---------- with the database ----------

async function setup() {
  const { db } = await import("./db");
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const st = await import("./steuerung");
  const router = await import("./ai/router");
  const { resetKiModusCache } = await import("./ai/modus");
  resetKiModusCache();
  router.resetRouter();
  router.setTransport(null);
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const aufgabe = (prompt: string, difficulty: "sehr leicht" | "leicht" | "mittel" | "schwer", skill = DIV) => ({
    type: "calc" as const, skillId: skill, difficulty, prompt, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [],
  });
  /** an exercise of three tasks sent in the unit */
  const sende = (unitId: number, sid: number, difficulty: "leicht" | "mittel" = "mittel") => {
    const ws = repo.createWorksheet(
      { title: "Brüche dividieren", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty, task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [DIV], status: "freigegeben" },
      [aufgabe(`3/4 : 1/2 = ? (${++nr})`, difficulty), aufgabe(`2/3 : 1/3 = ? (${++nr})`, difficulty), aufgabe(`5/6 : 1/6 = ? (${++nr})`, difficulty)],
    );
    return repo.assignWorksheet(ws, sid, "", unitId);
  };
  /** answers on the exercise: true = right at once, false = wrong („Kehrwert vergessen“) */
  const antworte = (unitId: number, asg: number, xs: boolean[]) => {
    const a = repo.getAssignment(asg)!;
    const tasks = repo.listTasks(a.worksheet_id);
    xs.forEach((ok, i) => {
      const t = tasks[i % tasks.length];
      repo.recordAttempt({ assignment_id: asg, task_id: t.id, student_id: a.student_id, skill_id: t.skillId ?? null, attempt_no: 1, answer: ok ? "1" : "2", correct: ok ? 1 : 0, final: ok ? 1 : 0, time_ms: 30_000, active_ms: 25_000, hints_used: 0, solution_viewed: 0, error_label: ok ? null : "Kehrwert vergessen", feedback: "", unit_id: unitId });
    });
  };
  return { db, repo, units, c, st, router, teacher, schueler, sende, antworte, aufgabe, resetKiModusCache };
}

test("2 wrong answers in the unit: „Leichtere Aufgabe senden“ from the generator (B), to this unit's student; after it the proposal waits for new answers", async () => {
  const s = await setup();
  const sid = s.schueler("Pia Kehrwert");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  s.c.waehleFaehigkeit(unit.id, DIV);
  assert.equal(s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id, { mitPlan: true })), null, "nothing sent yet");
  const asg = s.sende(unit.id, sid);
  s.antworte(unit.id, asg, [false, false]);
  const v = s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id, { mitPlan: true }))!;
  assert.equal(v.grund, "2 Fehler: Kehrwert vergessen");
  assert.equal(v.haupt?.label, "Leichtere Aufgabe senden");
  assert.equal(v.haupt?.quelle, "B", "nothing in stock at level 2: the generator");
  assert.equal(v.zusatz, null, "no KI hint without KI");
  assert.ok(!v.andere.some((k) => k.quelle === "C"), "B has something: no KI offered");

  const out = s.st.sendeAngepasst(unit.id, v.haupt!.option, s.teacher.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  const neu = s.repo.getAssignment(out.assignmentId)!;
  assert.equal(neu.student_id, sid);
  assert.equal(neu.unit_id, unit.id);
  const tasks = s.repo.listTasks(out.worksheetId);
  assert.ok(tasks.length >= 1 && tasks.length <= 3);
  assert.ok(tasks.every((t) => t.skillId === DIV && t.level === 2), "same skill, one level easier");
  assert.equal(s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id)), null, "after sending: no proposal until new answers");

  // right and fast on the easier one: harder (or next)
  s.antworte(unit.id, out.assignmentId, tasks.map(() => true));
  const gut = s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id))!;
  assert.equal(gut.haupt?.option.art, "schwerer");
  assert.equal(gut.haupt?.option.level, 3);
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("A before B: a released exercise at the right level; already sent and badly rated tasks stay out", async () => {
  const s = await setup();
  const sid = s.schueler("Ole Bestand");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  const leicht = [s.aufgabe("1/2 : 1/4 = ? (Bestand 1)", "leicht"), s.aufgabe("1/3 : 1/6 = ? (Bestand 2)", "leicht"), s.aufgabe("1/5 : 1/10 = ? (Bestand 3)", "leicht")];
  const ws = s.repo.createWorksheet(
    { title: "Dividieren leicht", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "leicht", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [DIV], status: "freigegeben" },
    leicht,
  );
  // a draft is not in stock
  s.repo.createWorksheet({ title: "Entwurf", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "leicht", task_type: "calc", kind: "uebung", source: "ki", skill_ids: [DIV], status: "entwurf" }, [s.aufgabe("Entwurf : 1 = ?", "leicht")]);
  const { bewerte } = await import("./bewertungen");
  assert.ok("ok" in bewerte(s.repo.listTasks(ws)[2], "Mathematik", s.teacher.id, { sterne: 1, gruende: ["loesung_falsch"], kommentar: "" }));

  const o = { art: "leichter" as const, skillId: DIV, level: 2, fokus: null };
  const a = s.st.bestand(unit.id, o);
  assert.deepEqual(a.map((t) => t.prompt), ["1/3 : 1/6 = ? (Bestand 2)", "1/2 : 1/4 = ? (Bestand 1)"], "the badly rated and the draft stay out");
  const asg = s.sende(unit.id, sid);
  s.antworte(unit.id, asg, [false, false]);
  const v = s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id))!;
  assert.equal(v.haupt?.quelle, "A");
  const out = s.st.sendeAngepasst(unit.id, v.haupt!.option, s.teacher.id);
  assert.ok("quelle" in out && out.quelle === "A");
  assert.equal(s.st.bestand(unit.id, o).length, 0, "what was sent in this unit is not offered again");
  // badly rated generator tasks stay out too
  const b = s.st.ausGenerator(unit.id, o);
  const { ausgeblendet, aufgabeSchluessel } = await import("./bewertungen");
  const weg = ausgeblendet();
  assert.ok(b.every((t) => !weg.has(aufgabeSchluessel(t))));
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("two units at once: the proposal and the task belong to the unit whose student answered", async () => {
  const s = await setup();
  const a = s.schueler("Ida Links");
  const b = s.schueler("Ben Rechts");
  const ua = s.units.startUnit(s.teacher.id, a, { subject: "Mathematik" }).unit;
  const ub = s.units.startUnit(s.teacher.id, b, { subject: "Mathematik" }).unit;
  s.sende(ua.id, a);
  const asgB = s.sende(ub.id, b);
  s.antworte(ub.id, asgB, [false, false]);
  assert.equal(s.st.vorschlagDerEinheit(ua.id, s.c.cockpit(ua.id)), null, "Ida has not answered");
  const v = s.st.vorschlagDerEinheit(ub.id, s.c.cockpit(ub.id))!;
  const out = s.st.sendeAngepasst(ub.id, v.haupt!.option, s.teacher.id);
  assert.ok("assignmentId" in out);
  assert.equal(s.repo.getAssignment(out.assignmentId)!.student_id, b);
  assert.equal(s.repo.getAssignment(out.assignmentId)!.unit_id, ub.id);
  s.units.finishUnit(ua.id, "abgebrochen");
  s.units.finishUnit(ub.id, "abgebrochen");
});

test("C only when A and B have nothing, and only if the KI may: off, manual mode, budget, the student's limit", async () => {
  const s = await setup();
  const RUNDEN = "mathe.zahlen.runden";
  const sid = s.schueler("Tim Runden");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  s.c.waehleFaehigkeit(unit.id, RUNDEN);
  const ws = s.repo.createWorksheet(
    { title: "Runden", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Zahlen", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [RUNDEN], status: "freigegeben" },
    [s.aufgabe("Runde 347 auf Zehner.", "mittel", RUNDEN), s.aufgabe("Runde 1 250 auf Hunderter.", "mittel", RUNDEN)],
  );
  const asg = s.repo.assignWorksheet(ws, sid, "", unit.id);
  s.antworte(unit.id, asg, [false, false]);
  const blick = () => s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id, { mitPlan: true }))!;

  // KI off: C is there, locked with a reason; the main button is a way without a task
  let v = blick();
  const neu = () => v.andere.find((k) => k.quelle === "C")!;
  assert.equal(v.haupt?.quelle ?? null, null, "no task from A or B");
  assert.equal(neu().gesperrt, "Die KI ist aus.");
  assert.equal(neu().kosten, null);
  assert.deepEqual(s.st.kiTor(sid), { erlaubt: false, grund: "Die KI ist aus." });

  // KI on: C with its cost on the button
  s.router.setTransport(async () => {
    throw new Error("nicht gebraucht");
  });
  v = blick();
  assert.equal(neu().gesperrt, null);
  assert.match(neu().kosten ?? "", /^ca\. \d+ Cent$/);
  // manual mode: too slow for the lesson
  process.env.AI_PROVIDER = "manual";
  assert.equal(s.st.kiTor(sid).erlaubt, false);
  assert.match((s.st.kiTor(sid) as { grund: string }).grund, /manuellen KI-Modus/);
  delete process.env.AI_PROVIDER;
  // the month's budget used up
  process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "1";
  s.db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, student_id) VALUES (?, 'aufgaben', 'standard', 'claude-sonnet-5-5', 'anthropic', 'ok', 1.5, 0, NULL)").run(new Date().toISOString());
  assert.match((s.st.kiTor(sid) as { grund: string }).grund, /Budget/);
  delete process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
  s.db().prepare("DELETE FROM ai_calls").run();
  // the student's limit
  s.db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, student_id) VALUES (?, 'aufgaben', 'standard', 'claude-sonnet-5-5', 'anthropic', 'ok', 9, 0, ?)").run(new Date().toISOString(), sid);
  assert.match((s.st.kiTor(sid) as { grund: string }).grund, /KI-Grenze/);
  s.db().prepare("DELETE FROM ai_calls").run();
  assert.equal(s.st.kiTor(sid).erlaubt, true);
  s.router.setTransport(null);
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("C on the teacher's tap: KI tasks go through the checks into the preview; when the KI fails, the reason, no silent stand-in", async () => {
  const s = await setup();
  const nb = await import("./ki-nachschub");
  const sid = s.schueler("Eva Neu");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  const asg = s.sende(unit.id, sid);
  s.antworte(unit.id, asg, [false, false]);
  const gefragt: string[] = [];
  const kiAufgabe = (prompt: string, o: Record<string, unknown> = {}) => ({
    category: "rechnen", format: "calc", skill_ids: [DIV], topic: "Brüche", difficulty: "leicht", prompt, passage: null, options: null, correct_option: null,
    accepted_answers: ["2"], numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null,
    answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["Kehrwert"], solution: "Mit dem Kehrwert multiplizieren.", solution_steps: [], estimated_time_sec: 60, hints: ["Kehrwert?"], common_errors: [],
    ...o,
  });
  s.router.resetRouter();
  s.router.setTransport(async (req) => {
    gefragt.push(typeof req.content === "string" ? req.content : JSON.stringify(req.content));
    return { parsed: { tasks: [kiAufgabe("1 : 1/2 = ?"), kiAufgabe("1/2 : 1/4 = ?")] }, refusal: false, model: req.model, usage: { input: 2_000, output: 1_500, cacheWrite: 0, cacheRead: 0 } };
  });
  const b = nb.bedarfAusOption(0, null, { art: "fehler", skillId: DIV, level: 2, fokus: "Kehrwert vergessen" })!;
  const ok = await nb.erstelleNachschub(unit.id, b, { automatisch: false, teacherId: s.teacher.id });
  assert.ok(!("fehler" in ok) && ok.status === "bereit", JSON.stringify(ok));
  assert.equal(gefragt.length, 1);
  assert.match(gefragt[0], /Kehrwert vergessen/, "the error to practise goes into the request");
  const out = await nb.sendeNachschub(unit.id, ok.id, s.teacher.id);
  assert.ok(!("fehler" in out), JSON.stringify(out));
  const ws = s.repo.getAssignment(out.assignmentId)!;
  assert.equal(ws.student_id, sid);
  assert.equal(s.repo.getWorksheet(ws.worksheet_id)!.difficulty, "leicht");
  const kosten = s.db().prepare("SELECT COUNT(*) AS n FROM ai_calls WHERE fn = 'neue_aufgabe' AND student_id = ?").get(sid) as { n: number };
  assert.equal(kosten.n, 1, "the cost lands with this student");

  // the KI fails: the reason, nothing goes to the student
  s.router.resetRouter();
  s.router.setTransport(async () => {
    throw new Error("weg");
  });
  const vorher = s.repo.listAssignments(sid).length;
  const ersatz = await nb.erstelleNachschub(unit.id, nb.bedarfAusOption(1, null, { art: "leichter", skillId: DIV, level: 2, fokus: null })!, { automatisch: false, teacherId: s.teacher.id });
  assert.ok(!("fehler" in ersatz) && ersatz.status === "fehler" && ersatz.problem.length > 0, JSON.stringify(ersatz));
  assert.equal(s.repo.listAssignments(sid).length, vorher);
  s.router.setTransport(null);
  s.router.resetRouter();
  s.units.finishUnit(unit.id, "abgebrochen");
});

// ---------- the cockpit: „Richtig / Teilweise / Falsch“ and the teacher's sign ----------

test("„Richtig / Teilweise / Falsch“ per question step: stored, „Falsch“ brings the easier way, old rows still load", async () => {
  const s = await setup();
  const lp = await import("./lernpakete");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  const d = JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
  d.titel = `Die vier Fälle (Steuerung ${++nr})`;
  const imp = lp.importiereLernpaket(JSON.stringify(d), s.teacher.id);
  assert.ok("id" in imp);
  const p = lp.getLernpaket(imp.id)!;
  const frage = p.schritte.find((x) => x.art === "frage")!;
  const andere = p.schritte.find((x) => x.art === "erklaerung" || x.art === "einstieg")!;
  const sid = s.schueler("Lia Frage");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  assert.ok("ok" in s.c.waehlePaket(unit.id, p.id));

  assert.equal(s.c.setzeAntwort(unit.id, andere.id, "richtig"), false, "only questions and checks");
  assert.equal(s.c.setzeAntwort(unit.id, frage.id, "falsch"), true);
  let st = s.c.cockpit(unit.id).stand;
  assert.equal(st.antworten[frage.id], "falsch");
  assert.deepEqual(st.steuerung.signal, { schritt: frage.id, art: "falsch" });
  assert.deepEqual(s.c.antwortenDerEinheit(unit.id), [{ schrittId: frage.id, titel: frage.titel, art: "frage", antwort: "falsch", skillIds: ["deutsch.grammatik.faelle"] }], "with the skills of the step, for the Abschluss");
  // the step on screen gets the easier way, in its card
  s.c.zeigeSchritt(unit.id, frage.id);
  const v = s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id))!;
  assert.equal(v.ausloeser, "lehrer");
  assert.equal(v.grund, "Frage falsch beantwortet");
  // „Richtig“ takes the sign back, the answer stays as evidence
  s.c.setzeAntwort(unit.id, frage.id, "teilweise");
  st = s.c.cockpit(unit.id).stand;
  assert.equal(st.steuerung.signal, null);
  assert.equal(st.antworten[frage.id], "teilweise");
  assert.equal(s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id)), null);

  // „Schüler versteht es nicht“ is a sign too; „Nicht nötig“ (reagiert) and „Weiter“ end it
  s.c.merkeSchritt(unit.id, frage.id, "nichtVerstanden");
  assert.equal(s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id))?.grund, "Schüler versteht es nicht");
  s.c.reagiert(unit.id);
  assert.equal(s.st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id)), null);
  s.c.merkeSchritt(unit.id, frage.id, "nichtVerstanden");
  s.c.markiereSchritt(unit.id, frage.id, "erledigt");
  assert.equal(s.c.cockpit(unit.id).stand.steuerung.signal, null);

  // a row from before (without antworten and steuerung) still loads
  const u2 = s.units.startUnit(s.teacher.id, s.schueler("Rolf Alt"), { subject: "Deutsch" }).unit;
  s.db().prepare("INSERT INTO einheit_cockpit (unit_id, paket_id, reihenfolge, erledigt, uebersprungen, notizen, gesendet) VALUES (?, ?, '[]', '[]', '[]', '{}', '{}')").run(u2.id, p.id);
  s.db().prepare("UPDATE einheit_cockpit SET steuerung = NULL WHERE unit_id = ?").run(u2.id);
  const alt = s.c.cockpit(u2.id).stand;
  assert.deepEqual(alt.antworten, {});
  assert.deepEqual(alt.steuerung, { bis: 0, signal: null });
  assert.deepEqual(s.c.antwortenDerEinheit(u2.id), []);
  s.units.finishUnit(unit.id, "abgebrochen");
  s.units.finishUnit(u2.id, "abgebrochen");
});
