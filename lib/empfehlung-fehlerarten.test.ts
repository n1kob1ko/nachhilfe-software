/**
 * Findings of the review of the central recommendation and the Fehlerarten: narrow error-type rules,
 * the typical error and documented mistakes in the recommendation, falling skills, the practice →
 * Überprüfung cycle for every exercise, Stoff without skills, traceable AI suggestions, exports,
 * automatic documentation and the upgrade of older databases.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const DAY = 86_400_000;
const DIVIDIEREN = "mathe.brueche.dividieren";
const kid = (name: string, teacherId: number | null, o: Partial<{ school_type: string; klasse: number; grade: number; subjects: string[]; current_topics: string }> = {}) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ...o,
});
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

async function setup(name: string, o: Parameters<typeof kid>[2] = {}) {
  const repo = await import("./repo");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id, o));
  const { nextSteps } = await import("./recommend");
  const { dayOf } = await import("./exams");
  const steps = () => nextSteps(sid, { today: dayOf(new Date()), limit: 10 });
  return { repo, niko, sid, student: repo.getStudent(sid)!, steps };
}
/** One exercise with one task per skill, assigned; rec() writes a final answer days ago. */
async function practice(sid: number, skills: string[], kind: "uebung" | "diagnose" = "uebung") {
  const repo = await import("./repo");
  const w = repo.createWorksheet(
    { title: "Training", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind, source: "generator", skill_ids: [] },
    skills.map((skillId) => ({ type: "calc" as const, skillId, difficulty: "mittel" as const, prompt: skillId, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] })),
  );
  const aid = repo.assignWorksheet(w, sid);
  const t = Object.fromEntries(repo.listTasks(w).map((x) => [x.skillId, x]));
  const rec = (skill: string, correct: number, daysAgo = 1, o: { errorType?: string; source?: string; label?: string; unitId?: number } = {}) =>
    repo.recordAttempt({
      assignment_id: aid, task_id: t[skill].id, student_id: sid, skill_id: skill, answer: correct ? "1" : "2", correct, final: 1, attempt_no: 1, time_ms: 30_000, hints_used: 0, solution_viewed: 0,
      error_label: o.label ?? null, feedback: "", created_at: ago(daysAgo), error_type: o.errorType ?? null, error_type_source: o.errorType ? (o.source ?? "vorschlag") : null, unit_id: o.unitId ?? null,
    });
  return { w, aid, t, rec };
}

// ---------- Fehlerarten: narrow rules ----------
test("error types: no Rechenfehler for any wrong small number, numbers in gaps are no spelling errors, units only when asked", async () => {
  const { suggestErrorType } = await import("./error-types");
  const calc = (accepted: string, prompt = "") => ({ type: "calc" as const, data: {}, prompt, answer: { accepted: [accepted], mode: "value" as const }, category: null });
  // one or two digits: one digit off says nothing (finding: 5 → 3 and 12 → 18 were Rechenfehler)
  assert.equal(suggestErrorType(calc("5"), "3", null, "Mathematik"), null);
  assert.equal(suggestErrorType(calc("12"), "18", null, "Mathematik"), null);
  assert.equal(suggestErrorType(calc("43"), "34", null, "Mathematik"), "rechenfehler", "swapped digits stay a slip");
  assert.equal(suggestErrorType(calc("125"), "135", null, "Mathematik"), "rechenfehler", "one digit off in a longer number");
  assert.equal(suggestErrorType(calc("0,25"), "0,35", null, "Mathematik"), null, "leading zeros are no digits");
  // ×10 is a unit error only when a unit is involved
  assert.equal(suggestErrorType(calc("5"), "50", null, "Mathematik"), null);
  assert.equal(suggestErrorType(calc("350", "Wie viele Zentimeter sind 3,5 m?"), "35", null, "Mathematik"), "einheit");
  assert.equal(suggestErrorType(calc("12 m²"), "12 cm", null, "Mathematik"), "einheit", "number right, unit wrong");
  assert.equal(suggestErrorType(calc("350"), "350 cm", null, "Mathematik"), null, "a unit nobody asked for is no Einheitenfehler");

  // cloze tasks made from calculations: the number in the gap is checked like a number
  const gap = (blank: string, mode: "value" | "text" = "value") => ({ type: "cloze" as const, data: {}, prompt: "Ergebnis: ___", answer: { blanks: [[blank]], mode }, category: null });
  assert.equal(suggestErrorType(gap("18,5"), JSON.stringify(["18,6"]), null, "Mathematik"), "rechenfehler");
  assert.equal(suggestErrorType(gap("-125"), JSON.stringify(["125"]), null, "Mathematik"), "vorzeichen");
  assert.equal(suggestErrorType(gap("18,5", "text"), JSON.stringify(["18,6"]), null, "Mathematik"), "rechenfehler", "an AI gap with a number in text mode");
  assert.equal(suggestErrorType(gap("1945", "text"), JSON.stringify(["1954"]), null, "Deutsch"), null, "a number in Deutsch: no spelling, no Rechenfehler");
  assert.equal(suggestErrorType(gap("4,5"), JSON.stringify(["4,6"]), null, "Mathematik"), null);

  // end to end: what the student submits on a Prozentrechnung sheet is stored with the right kind
  const { repo, sid, student } = await setup("Paul Prozent");
  const { submitAnswer } = await import("./service");
  const w = repo.createWorksheet(
    { title: "Prozent", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "generator", skill_ids: [] },
    [{ type: "cloze", skillId: "mathe.prozent.prozentwert", difficulty: "mittel", prompt: "15 % von 123,33 €\nErgebnis: ___", data: {}, answer: { blanks: [["18,5"]], mode: "value" }, solution: "", hints: [], errorMap: [] }],
  );
  const aid = repo.assignWorksheet(w, sid);
  const task = repo.listTasks(w)[0];
  await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: task.id, answer: JSON.stringify(["18,6"]), timeMs: 10_000, hintsUsed: 0 });
  const [stored] = repo.listAttemptsForAssignment(aid);
  assert.deepEqual([stored.error_type, stored.error_type_source], ["rechenfehler", "vorschlag"]);
});

test("error types: spelling and grammar only in languages, inflection is grammar, each gap against its own solution", async () => {
  const { suggestErrorType } = await import("./error-types");
  const word = (accepted: string, mode: "text" | "exact" = "text") => ({ type: "grammar" as const, data: {}, answer: { accepted: [accepted], mode }, category: null });
  const cloze = (blanks: string[][]) => ({ type: "cloze" as const, data: {}, answer: { blanks, mode: "text" as const }, category: null });
  // only the ending differs: Kasus, plural, 3rd person -s → Grammatikfehler
  assert.equal(suggestErrorType(word("seinem"), "seinen", null, "Deutsch"), "grammatik");
  assert.equal(suggestErrorType(word("Kinder"), "Kindern", null, "Deutsch"), "grammatik");
  assert.equal(suggestErrorType(cloze([["einem"]]), JSON.stringify(["einen"]), null, "Deutsch"), "grammatik");
  assert.equal(suggestErrorType(cloze([["walks"]]), JSON.stringify(["walk"]), null, "Englisch"), "grammatik");
  // a letter off inside the word is still spelling
  assert.equal(suggestErrorType(word("Fahrrad"), "Farrad", null, "Deutsch"), "rechtschreibung");
  assert.equal(suggestErrorType(word("Hund"), "Hunt", null, "Deutsch"), "rechtschreibung");
  assert.equal(suggestErrorType(word("Montag", "exact"), "montag", null, "Deutsch"), "rechtschreibung", "capitalisation where it counts");
  // outside a language no word rules (an AI task in Mathematik with a text answer)
  assert.equal(suggestErrorType(word("3x + 2"), "3x - 2", null, "Mathematik"), null);
  // a right gap with other capitalisation does not decide; the wrong gap is compared with its own solution only
  assert.equal(suggestErrorType(cloze([["Hund"], ["Katze"]]), JSON.stringify(["hund", "Maus"]), null, "Deutsch"), null);
  assert.equal(suggestErrorType(cloze([["Fahrrad"], ["Auto"]]), JSON.stringify(["Fahrrad", "Farrad"]), null, "Deutsch"), null);

  // label keywords fit the subject
  const calc = { type: "calc" as const, data: {}, answer: { accepted: ["0,5"], mode: "value" as const }, category: null };
  assert.equal(suggestErrorType(calc, "5", "Komma an falscher Stelle", "Mathematik"), null, "Komma in Mathematik is no Grammatikfehler");
  assert.equal(suggestErrorType(word("Haus"), "Haus,", "Komma vergessen", "Deutsch"), "grammatik");
  assert.notEqual(suggestErrorType(word("don't"), "not", "negative Form falsch", "Englisch"), "vorzeichen");
  assert.equal(suggestErrorType(calc, "-0,5", "Vorzeichen vergessen", "Mathematik"), "vorzeichen");
  assert.equal(suggestErrorType(calc, "2", "Kehrwert vergessen", "Mathematik"), "regel");
});

// ---------- Fehlerarten: traceable ----------
test("an AI category stays as suggestion when the teacher changes it; export, Dokumentation and unit report show Fehlerarten", async () => {
  const { repo, niko, sid } = await setup("Kira Korrektur");
  const { rec, aid } = await practice(sid, [DIVIDIEREN, "mathe.brueche.multiplizieren"]);
  const ki = rec(DIVIDIEREN, 0, 1, { errorType: "wortschatz", source: "ki", label: "Kehrwert vergessen" });
  const app = rec("mathe.brueche.multiplizieren", 0, 1, { errorType: "vorzeichen" });
  assert.equal(repo.getAttempt(ki)!.error_type_suggested, "wortschatz", "the AI's category is kept as suggestion");
  assert.equal(repo.getAttempt(ki)!.error_type_suggested_source, "ki");
  assert.equal(repo.getAttempt(app)!.error_type_suggested_source, "vorschlag");
  repo.setAttemptErrorType(ki, "grammatik", niko.id);
  const changed = repo.getAttempt(ki)!;
  assert.deepEqual([changed.error_type, changed.error_type_source, changed.error_type_suggested, changed.error_type_suggested_source], ["grammatik", "lehrer", "wortschatz", "ki"]);
  const { suggestionBy } = await import("./error-types");
  assert.equal(`${suggestionBy(changed.error_type_suggested_source)} war: …`, "KI-Vorschlag war: …");
  assert.equal(suggestionBy("vorschlag"), "Vorschlag der App");

  // CSV: the label is "Fehler", the category "Fehlerart" with its source and the suggestion
  const { DATASETS } = await import("./exports");
  const t = DATASETS.find((d) => d.key === "ergebnisse")!.build();
  const col = (name: string) => t.headers.indexOf(name);
  for (const h of ["Fehler", "Fehlerart", "Fehlerart-Quelle", "Vorschlag"]) assert.ok(col(h) >= 0, h);
  const row = t.rows.find((r) => r[0] === ki)!;
  assert.equal(row[col("Fehler")], "Kehrwert vergessen");
  assert.equal(row[col("Fehlerart")], "Grammatikfehler");
  assert.equal(row[col("Fehlerart-Quelle")], "vom Lehrer");
  assert.equal(row[col("Vorschlag")], "Wortschatzproblem (KI-Vorschlag)");

  // automatic Dokumentation of self-practice names the Fehlerarten
  const { describeAssignment } = await import("./autodoc");
  assert.match(describeAssignment(aid)!.tutor_notes, /Fehlerarten: Grammatikfehler, Vorzeichenfehler \(Vorschlag\)\./);

  // the unit report counts them per kind
  const units = await import("./units");
  const { buildUnitReport } = await import("./learning");
  const u = units.startUnit(niko.id, sid, { subject: "Mathematik" }).unit;
  const p = await practice(sid, [DIVIDIEREN]);
  p.rec(DIVIDIEREN, 0, 0, { errorType: "vorzeichen", unitId: u.id });
  const r = buildUnitReport(units.getUnit(u.id)!);
  assert.deepEqual(r.errorTypes, [{ type: "vorzeichen", count: 1, confirmed: 0 }]);
  assert.deepEqual(r.tasks[0].errorTypes, ["vorzeichen"]);
});

test("the automatic Dokumentation follows the setting for careless errors", async () => {
  const { repo, niko, sid } = await setup("Flo Flüchtig");
  const { rec, aid } = await practice(sid, [DIVIDIEREN]);
  const id = rec(DIVIDIEREN, 0, 1);
  repo.setAttemptErrorType(id, "fluechtig", niko.id);
  const { describeAssignment } = await import("./autodoc");
  const { setSetting, CARELESS_SETTING } = await import("./lehrplan");
  assert.equal(describeAssignment(aid)!.understanding, 2, "a confirmed careless error counts 0.3");
  setSetting(CARELESS_SETTING, "aus");
  try {
    assert.equal(describeAssignment(aid)!.understanding, 1, "switched off: it counts as wrong");
  } finally {
    setSetting(CARELESS_SETTING, "an");
  }
});

// ---------- the recommendation ----------
test("a weak skill carries its typical error to the AI builder and names it in the reason", async () => {
  const { sid, steps } = await setup("Tim Typisch");
  const { rec } = await practice(sid, [DIVIDIEREN]);
  for (let i = 0; i < 4; i++) rec(DIVIDIEREN, 0, 2, { label: "Kehrwert vergessen" });
  const step = steps().find((s) => s.skill.id === DIVIDIEREN)!;
  assert.equal(step.rule, 3, "weak comes before the error rule");
  assert.match(step.focusNote ?? "", /Kehrwert vergessen/, "the AI builder still gets the typical error");
  assert.match(step.reason, /4 Fehler zuletzt: „Kehrwert vergessen“/);
});

test("mistakes the teacher documented in Einheiten count as recent errors; automatic entries do not", async () => {
  const { repo, niko, sid, steps } = await setup("Lena Lektion");
  const { localStamp } = await import("./autodoc");
  const lesson = (daysAgo: number, kind = "stunde") =>
    repo.saveLesson({
      student_id: sid, teacher_id: niko.id, kind, starts_at: localStamp(Date.now() - daysAgo * DAY), duration_min: 50, subject: "Mathematik", topic: "Brüche", status: "abgeschlossen",
      activities: "", mistakes: "Kehrwert vergessen", understanding: 4, tutor_notes: "", next_steps: "", skill_ids: [DIVIDIEREN],
    } as Parameters<typeof repo.saveLesson>[0]);
  lesson(3);
  lesson(8);
  lesson(1, "selbststaendig");
  lesson(20); // too long ago
  const step = steps().find((s) => s.skill.id === DIVIDIEREN);
  assert.ok(step, "the documented mistakes lead to a recommendation");
  assert.equal(step.rule, 4);
  assert.match(step.reason, /^2× „Kehrwert vergessen“/);
  assert.equal(step.recentErrors, 2);
  assert.match(step.focusNote ?? "", /Kehrwert vergessen/);
});

test("a skill that dropped clearly is recommended for review", async () => {
  const { sid, steps } = await setup("Fritz Fallend");
  const { rec } = await practice(sid, ["mathe.brueche.addieren"]);
  for (let i = 0; i < 10; i++) rec("mathe.brueche.addieren", 1, 25);
  for (let i = 0; i < 3; i++) rec("mathe.brueche.addieren", 0, 2);
  const step = steps().find((s) => s.skill.id === "mathe.brueche.addieren");
  assert.ok(step, "the falling skill is recommended");
  assert.equal(step.rule, 6);
  assert.match(step.reason, /^um \d+ Punkte gefallen · Lernstand \d+ %/);
});

test("any finished exercise on a weak skill starts the Überprüfung, also one from the builder; a finished check ends it", async () => {
  const { repo, sid, steps } = await setup("Bea Builder");
  const { db } = await import("./db");
  const finish = (aid: number, daysAgo: number) => db().prepare("UPDATE assignments SET completed_at = ? WHERE id = ?").run(ago(daysAgo), aid);
  // the weak answers come from a finished diagnosis, which is neither practice nor check
  const diag = await practice(sid, [DIVIDIEREN], "diagnose");
  for (let i = 0; i < 4; i++) diag.rec(DIVIDIEREN, 0, 3);
  finish(diag.aid, 3);
  assert.equal(steps().find((s) => s.skill.id === DIVIDIEREN)?.kind, "uebung");
  // made in the builder (here for the Teilfähigkeit), sent without a recommendation note
  const sheet = (kind: "uebung" | "ueberpruefung", skill: string) => {
    const w = repo.createWorksheet(
      { title: kind, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind, source: "generator", skill_ids: [skill] },
      [{ type: "calc", skillId: skill, difficulty: "mittel", prompt: "1/2 : 1/4", data: {}, answer: { accepted: ["2"], mode: "value" }, solution: "", hints: [], errorMap: [] }],
    );
    return repo.assignWorksheet(w, sid, "");
  };
  const practiceId = sheet("uebung", "mathe.brueche.dividieren.kehrwert");
  let step = steps().find((s) => s.skill.id === DIVIDIEREN)!;
  assert.equal(step.kind, "uebung", "while it is open, no check yet");
  assert.equal(step.openAssignmentId, practiceId);
  finish(practiceId, 1);
  step = steps().find((s) => s.skill.id === DIVIDIEREN)!;
  assert.equal(step.kind, "ueberpruefung");
  assert.match(step.reason, /^Übung erledigt, jetzt überprüfen/);
  assert.equal(step.count, 5);
  finish(sheet("ueberpruefung", DIVIDIEREN), 0.5);
  assert.equal(steps().find((s) => s.skill.id === DIVIDIEREN)?.kind, "uebung", "checked after the practice: back to practice");
});

test("current material without ticked skills still counts, with a skill above the class as suggestion; each Stoff card has its own builder suggestion", async () => {
  const { niko, sid, steps } = await setup("Sami Stoff", { subjects: ["Mathematik", "Deutsch"] });
  const cm = await import("./current-material");
  const builder = await import("./builder");
  const { dayOf } = await import("./exams");
  const today = dayOf(new Date());
  // 2. Klasse MS = Schulstufe 6, "Gleichungen mit Klammern" is Stoff from Schulstufe 7
  const mathe = cm.setCurrentMaterial({ student_id: sid, subject: "Mathematik", topic: "Gleichungen", subtopic: "Gleichungen mit Klammern", skill_ids: [], since: today, priority: 1, note: "", source: "unterricht" }, niko.id);
  const first = steps()[0];
  assert.equal(first.rule, 2);
  assert.equal(first.skill.id, "mathe.gleichungen.klammern");
  assert.equal(first.materialId, mathe);
  assert.match(first.reason, /^Aktueller Stoff: Gleichungen mit Klammern \(Fähigkeit vorgeschlagen\)/);
  assert.deepEqual(cm.getMaterial(mathe)!.skill_ids, [], "nothing is stored");

  const deutsch = cm.setCurrentMaterial({ student_id: sid, subject: "Deutsch", topic: "Beistrichsetzung", subtopic: "Aufzählungen", skill_ids: [], since: today, priority: 2, note: "", source: "hausuebung" }, niko.id);
  const ctx = builder.studentContext(sid)!;
  assert.deepEqual(ctx.suggestions.find((s) => s.key === `stoff:${mathe}`)?.skillIds, ["mathe.gleichungen.klammern"]);
  assert.deepEqual(ctx.suggestions.find((s) => s.key === `stoff:${deutsch}`)?.skillIds, ["deutsch.beistrich.aufzaehlung"], "the Deutsch card opens with its own Stoff");
});

// ---------- small fixes ----------
test("profile topics prefill only the Thema; a cleared date is today's local day", async () => {
  const { niko, sid } = await setup("Ida Datum");
  const cm = await import("./current-material");
  assert.equal(cm.profileTopic("Bruchrechnen und Gleichungen"), "Bruchrechnen");
  assert.equal(cm.profileTopic("Bruchrechnen, Gleichungen"), "Bruchrechnen");
  assert.equal(cm.profileTopic(""), "");
  const tz = process.env.TZ;
  process.env.TZ = "Europe/Vienna";
  try {
    // 00:30 in Vienna is still the day before in UTC
    const id = cm.setCurrentMaterial({ student_id: sid, subject: "Mathematik", topic: "Brüche", subtopic: "", skill_ids: [], since: "", priority: 2, note: "", source: "unterricht" }, niko.id, new Date("2026-10-05T22:30:00Z"));
    assert.equal(cm.getMaterial(id)!.since, "2026-10-06");
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
});

test("upgrade: links of an earlier curriculum import are marked as import, AI categories become suggestions", async () => {
  const { openDatabase } = await import("./db");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-")), "alt.db");
  let conn = openDatabase(file);
  // the state before these columns existed
  conn.exec("ALTER TABLE skill_links DROP COLUMN origin");
  conn.exec("ALTER TABLE attempts DROP COLUMN error_type_suggested_source");
  const pkg = { format: "lernheft-curriculum/1", skills: [{ id: "mathe.potenzen.regeln", prerequisites: ["mathe.brueche.multiplizieren"] }, { id: DIVIDIEREN, prerequisites: ["mathe.brueche.multiplizieren"] }] };
  conn.prepare("INSERT INTO curriculum_imports (source_key, label, content_hash, payload, diff, status, created_at, applied_at) VALUES ('x', 'Paket', 'h', ?, '{}', 'importiert', datetime('now'), datetime('now'))").run(JSON.stringify(pkg));
  const link = conn.prepare("INSERT OR IGNORE INTO skill_links (skill_id, other_id, kind) VALUES (?, ?, 'voraussetzung')");
  link.run("mathe.potenzen.regeln", "mathe.brueche.multiplizieren");
  link.run("deutsch.grammatik.zeiten", "deutsch.grammatik.faelle");
  conn.pragma("foreign_keys = OFF");
  const attempt = conn.prepare("INSERT INTO attempts (assignment_id, task_id, student_id, attempt_no, answer, correct, error_type, error_type_source, error_type_suggested) VALUES (1, 1, 1, 1, 'x', 0, ?, ?, ?)");
  const app = Number(attempt.run("vorzeichen", "vorschlag", "vorzeichen").lastInsertRowid);
  const ki = Number(attempt.run("wortschatz", "ki", null).lastInsertRowid);
  const own = Number(attempt.run("grammatik", "lehrer", null).lastInsertRowid);
  conn.close();

  conn = openDatabase(file);
  const origin = (skill: string, other: string) => (conn.prepare("SELECT origin FROM skill_links WHERE skill_id = ? AND other_id = ?").get(skill, other) as { origin: string }).origin;
  assert.equal(origin("mathe.potenzen.regeln", "mathe.brueche.multiplizieren"), "import", "from the applied import");
  assert.equal(origin(DIVIDIEREN, "mathe.brueche.multiplizieren"), "app", "a built-in link stays Standard, even when the package has it too");
  assert.equal(origin("deutsch.grammatik.zeiten", "deutsch.grammatik.faelle"), "app", "in no package: not guessed");
  const sug = (id: number) => conn.prepare("SELECT error_type_suggested AS s, error_type_suggested_source AS src FROM attempts WHERE id = ?").get(id);
  assert.deepEqual(sug(app), { s: "vorzeichen", src: "vorschlag" });
  assert.deepEqual(sug(ki), { s: "wortschatz", src: "ki" });
  assert.deepEqual(sug(own), { s: null, src: null });
  // a later start does not touch the rows again
  conn.prepare("UPDATE skill_links SET origin = 'lehrer' WHERE skill_id = 'deutsch.grammatik.zeiten'").run();
  conn.close();
  conn = openDatabase(file);
  assert.equal(origin("deutsch.grammatik.zeiten", "deutsch.grammatik.faelle"), "lehrer");
  conn.close();
});
