/**
 * Strenger werten (Test mit vier Test-Lehrern, 26.11.2026, M5): Bei zwei Auswahlmöglichkeiten gab es drei Versuche; erst falsch,
 * dann richtig zählte als „richtig“, obwohl nach dem ersten Fehler nur noch die richtige Antwort übrig ist. Und in einer
 * Nomen-Übung galt „wanderer, baum“ (klein geschrieben) als „Alle Lücken richtig“. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const mc = (n: number) => ({
  type: "mc" as const, skillId: "deutsch.wortarten.nomen", difficulty: "mittel" as const, prompt: `Ist „Baum“ ein Nomen? (${n} Möglichkeiten)`,
  data: { options: ["ja", "nein", "vielleicht", "nie"].slice(0, n) }, answer: { correct: 0 }, solution: "ja", hints: [], errorMap: [],
});

test("Auswahlaufgaben: so viele Versuche, dass am Ende nie nur noch die richtige Antwort übrig ist", async () => {
  const { triesForTask, MAX_TRIES } = await import("./service");
  assert.equal(triesForTask("normal", mc(2)), 1, "zwei Möglichkeiten: ein Versuch");
  assert.equal(triesForTask("normal", mc(3)), 2);
  assert.equal(triesForTask("normal", mc(4)), MAX_TRIES);
  assert.equal(triesForTask("test", mc(4)), 1, "im Kurztest immer einer");
  assert.equal(triesForTask("normal", { type: "cloze", data: {} }), MAX_TRIES, "andere Aufgaben wie bisher");
});

test("Zwei Möglichkeiten: die erste falsche Antwort schließt die Aufgabe ab, sie zählt als falsch", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { submitAnswer } = await import("./service");
  const { clientTasks } = await import("./solver-tasks");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Mia Beispiel", grade: 3, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const wid = repo.createWorksheet(
    { title: "Nomen", subject: "Deutsch", grade: 3, school_type: "Volksschule", klasse: 3, topic: "Wortarten", difficulty: "mittel", task_type: "mc", kind: "uebung", source: "manuell", skill_ids: ["deutsch.wortarten.nomen"] },
    [mc(2), mc(3)],
  );
  const aid = repo.assignWorksheet(wid, sid);
  const [zwei, drei] = repo.listTasks(wid);
  const assignment = repo.getAssignment(aid)!;
  const sicht = clientTasks(assignment);
  assert.deepEqual(sicht.map((t) => t.maxTries), [1, 2], "das Gerät kennt die Versuche je Aufgabe");
  const falsch = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: zwei.id, answer: "1", timeMs: 1000, hintsUsed: 0 });
  assert.equal(falsch.correct, false);
  assert.equal(falsch.final, true, "kein zweiter Versuch");
  assert.doesNotMatch(falsch.feedback, /noch \d+ Versuch/);
  const erster = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: drei.id, answer: "1", timeMs: 1000, hintsUsed: 0 });
  assert.equal(erster.final, false);
  assert.match(erster.feedback, /noch 1 Versuch\./, erster.feedback);
  const zweiter = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: drei.id, answer: "2", timeMs: 1000, hintsUsed: 0 });
  assert.equal(zweiter.final, true);
});

test("Nomen herausschreiben: klein geschrieben ist falsch, mit einem Hinweis auf die Großschreibung", async () => {
  const wa = await import("./wortarten");
  const { checkAnswer } = await import("./tasks");
  const setting = wa.wortartenFor(["deutsch.wortarten.nomen"], 3)!;
  let gefunden = 0;
  for (let v = 0; v < 40; v++) {
    let seed = v + 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const t = wa.wortartenTask({ skillId: "deutsch.wortarten.nomen", setting, difficulty: "mittel", category: "lueckentext", variant: v }, rng);
    if (!/^Schreib (alle Nomen|das Nomen) aus dem Satz heraus/.test(t.prompt)) continue;
    gefunden++;
    const richtig = t.answer.blanks!.map((b) => b[0]);
    assert.equal(checkAnswer(t, JSON.stringify(richtig)).correct, true, t.prompt);
    const klein = checkAnswer(t, JSON.stringify(richtig.map((w) => w.toLowerCase())));
    assert.equal(klein.correct, false, `klein geschrieben gilt als richtig: ${richtig.join(", ")}`);
    assert.match(klein.feedback, /groß/i, klein.feedback);
  }
  assert.ok(gefunden > 0, "keine Aufgabe „Nomen herausschreiben“ gefunden");
});

test("Verben herausschreiben: Groß- und Kleinschreibung zählt weiter nicht (ein Verb am Satzanfang)", async () => {
  const { checkAnswer } = await import("./tasks");
  const t = { type: "cloze" as const, data: {}, answer: { blanks: [["läuft"]], mode: "text" as const }, errorMap: [] };
  assert.equal(checkAnswer(t, JSON.stringify(["Läuft"])).correct, true);
});

test("Gerätezeile: eine freie Antwort, die auf die Bewertung wartet, zählt nicht als falsch", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const { submitAnswer } = await import("./service");
  const { fehlerVon } = await import("./live-zaehlen");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Emre Beispiel", grade: 11, klasse: 7, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik" }).unit;
  const frei = { type: "free" as const, skillId: null, difficulty: "mittel" as const, prompt: "Erkläre die Produktregel.", data: { lines: 5 }, answer: { criteria: ["Regel richtig"] }, solution: "", hints: [], errorMap: [] };
  const wid = repo.createWorksheet(
    { title: "Produktregel", subject: "Mathematik", grade: 11, school_type: "Gymnasium", klasse: 7, topic: "Differenzieren", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [] },
    [frei, mc(4), mc(3)],
  );
  const aid = repo.assignWorksheet(wid, sid, "", unit.id);
  const [f, m] = repo.listTasks(wid);
  const r = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: f.id, answer: "u'v + uv'", timeMs: 1000, hintsUsed: 0 });
  assert.equal(r.pendingReview, true);
  const zeile = live.unitAssignments(unit.id).find((a) => a.id === aid)!;
  assert.equal(zeile.done_count, 1);
  assert.equal(zeile.offen_count, 1, "eine Antwort wartet auf die Bewertung");
  assert.equal(fehlerVon({ done: zeile.done_count, correct: zeile.correct_count, wartet: zeile.offen_count }), 0, "nichts ist bewertet, also nichts falsch");
  // eine wirklich falsche Antwort zählt weiter
  for (const antwort of ["1", "2", "3"]) await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: m.id, answer: antwort, timeMs: 1000, hintsUsed: 0 });
  const danach = live.unitAssignments(unit.id).find((a) => a.id === aid)!;
  assert.equal(fehlerVon({ done: danach.done_count, correct: danach.correct_count, wartet: danach.offen_count }), 1);
  assert.equal(fehlerVon({ done: 3, correct: 1 }), 2, "ein alter Stand ohne „wartet“ zählt wie bisher");
});
