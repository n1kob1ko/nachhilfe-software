/**
 * Statistik über reale Schülerdaten (lib/statistik.ts): a small known dataset, every aggregate checked
 * exactly, the filters, and that no name or student id is in the result.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const DAY = 86_400_000;
const NOW = Date.now();
const NAMES = ["Annika Zahlmann", "Bruno Quirinsky", "Cleo Wolkenfeld"];
const K = "mathe.brueche.kuerzen";
const D = "mathe.brueche.dividieren";
const N = "mathe.negativ.addieren";
const G = "deutsch.beistrich.aufzaehlung";

const kid = (name: string) => ({
  name, grade: 6, klasse: 2, teacher_id: null, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

type Step = { ok?: boolean; err?: string; by?: "vorschlag" | "lehrer"; hints?: number; s?: number; giveUp?: boolean };

/**
 * The dataset (3 students A, B, C):
 *   W1 Übung:    T1 "Kürze 6/8" (Kürzen, leicht = 2), T2 "Berechne 3/4 : 1/2" (Dividieren, schwer = 4),
 *                T3 "Kürze 10/15" (a duplicate skill merged into Kürzen, mittel = 3)
 *   W2 Übung:    a copy of T1 (same text, skill and format), T1 is also saved in the library
 *   WD Diagnose: TD "Berechne (−5) + (−7)" (Negative Zahlen, mittel)
 *   WG Deutsch:  TG with a gap (Aufzählungen, mittel)
 *   WP Übung:    TP "Probeaufgabe 1" on an own skill, answered right now (exact Lernstand)
 * plus five Schularbeiten/Tests, one of them cancelled.
 */
async function dataset() {
  const repo = await import("./repo");
  const { db } = await import("./db");
  const { dayOf } = await import("./exams");
  const [A, B, C] = NAMES.map((n) => repo.createStudent(kid(n)));

  // a duplicate of Kürzen, merged into it under Mehr › Datenqualität
  const dup = repo.createSkill("Mathematik", "Bruchrechnung", "Kürzen (alt)", 5, 9);
  db().prepare("INSERT INTO skill_overrides (skill_id, merged_into, updated_at) VALUES (?, ?, ?)").run(dup, K, new Date(NOW).toISOString());
  const probe = repo.createSkill("Mathematik", "Probe", "Statistikprobe", 5, 9);

  const sheet = (kind: "uebung" | "diagnose", subject: string, tasks: [string, "leicht" | "mittel" | "schwer", string][]) => {
    const id = repo.createWorksheet(
      { title: "Statistik", subject, grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind, source: "manuell", skill_ids: [] },
      tasks.map(([skillId, difficulty, prompt]) => ({ type: "calc" as const, skillId, difficulty, prompt, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: ["a", "b"], errorMap: [] })),
    );
    return { id, tasks: repo.listTasks(id) };
  };
  const w1 = sheet("uebung", "Mathematik", [[K, "leicht", "Kürze 6/8"], [D, "schwer", "Berechne 3/4 : 1/2"], [dup, "mittel", "Kürze 10/15"]]);
  const w2 = sheet("uebung", "Mathematik", [[K, "leicht", "Kürze 6/8"]]);
  const wd = sheet("diagnose", "Mathematik", [[N, "mittel", "Berechne (−5) + (−7)"]]);
  const wg = sheet("uebung", "Deutsch", [[G, "mittel", "Äpfel ___ Birnen und Kirschen\nSetze den Beistrich."]]);
  const wp = sheet("uebung", "Mathematik", [[probe, "mittel", "Probeaufgabe 1"]]);
  const [t1, t2, t3] = w1.tasks;
  const lib = await import("./library");
  const saved = lib.saveToLibrary(t1.id);
  assert.ok("id" in saved);

  const solve = (wid: number, sid: number, task: { id: number; skillId: string | null }, daysAgo: number, steps: Step[], aid = repo.assignWorksheet(wid, sid)) => {
    steps.forEach((st, i) =>
      repo.recordAttempt({
        assignment_id: aid, task_id: task.id, student_id: sid, skill_id: task.skillId, answer: st.ok ? "1" : "2", correct: st.ok ? 1 : 0, final: i === steps.length - 1 ? 1 : 0,
        attempt_no: i + 1, time_ms: (st.s ?? 10) * 1000, hints_used: st.hints ?? 0, solution_viewed: st.giveUp ? 1 : 0, error_label: null, feedback: "",
        created_at: at(daysAgo), error_type: st.err ?? null, error_type_source: st.err ? (st.by ?? "vorschlag") : null,
      }),
    );
    return aid;
  };
  const wrong3 = (o: Step = {}): Step[] => [o, o, o];

  // W1, first round for A, B, C: T1, T2 and T3 in the same assignment
  const a1A = solve(w1.id, A, t1, 2, [{ err: "rechenfehler" }, { err: "rechenfehler" }, { err: "fluechtig", by: "lehrer" }]);
  const a1B = solve(w1.id, B, t1, 2, [{ ok: true, s: 20 }]);
  const a1C = solve(w1.id, C, t1, 2, [{ hints: 1, s: 15 }, { giveUp: true, hints: 2, s: 25 }]);
  solve(w1.id, A, t2, 2, [{ ok: true, s: 40 }], a1A);
  solve(w1.id, B, t2, 2, [{ ok: true, s: 50 }], a1B);
  solve(w1.id, C, t2, 2, [{ ok: true, s: 60 }], a1C);
  solve(w1.id, A, t3, 2, [{ ok: true }], a1A);
  solve(w1.id, B, t3, 2, [{ err: "vorzeichen" }, { ok: true }], a1B);
  solve(w1.id, C, t3, 2, [{ ok: true, hints: 1 }], a1C);
  // W1, second round for A and B
  const a1A2 = solve(w1.id, A, t2, 1, [{ ok: true, s: 70 }]);
  solve(w1.id, A, t3, 1, [{ ok: true }], a1A2);
  solve(w1.id, B, t2, 1, [{ ok: true, s: 80 }]);
  // W2: the copy of T1; B's answer is 100 days old
  solve(w2.id, A, w2.tasks[0], 3, [{ err: "rechenfehler", by: "lehrer", hints: 1 }, { hints: 1 }, { hints: 1 }]);
  solve(w2.id, B, w2.tasks[0], 100, [{ s: 20 }, { s: 20 }, { err: "regel", s: 20 }]);
  // diagnosis
  const td = wd.tasks[0];
  solve(wd.id, A, td, 5, [{ ok: true, s: 20 }]);
  solve(wd.id, B, td, 5, [{ ok: true, s: 20 }]);
  solve(wd.id, C, td, 5, [{ err: "vorzeichen" }, { err: "vorzeichen" }, { err: "vorzeichen", by: "lehrer" }]);
  solve(wd.id, A, td, 5, [{ err: "vorzeichen" }, { ok: true }]);
  solve(wd.id, B, td, 5, wrong3());
  // Deutsch
  solve(wg.id, A, wg.tasks[0], 4, [{ ok: true }]);
  solve(wg.id, C, wg.tasks[0], 4, wrong3({ err: "grammatik" }));
  // own skill, answered right now: A right at the first try, B looked at the solution
  solve(wp.id, A, wp.tasks[0], 0, [{ ok: true }]);
  solve(wp.id, B, wp.tasks[0], 0, [{ giveUp: true }]);

  // Schularbeiten and tests
  const day = (offset: number) => dayOf(new Date(NOW + offset * DAY));
  const exam = (student_id: number, offset: number, kind: string, subject: string, skill_ids: string[], topics: string[], status: "geplant" | "geschrieben" | "abgesagt", topic = topics.join(", ")) =>
    repo.addTest({ student_id, date: day(offset), subject, kind, topic, topics, grade: null, points: null, max_points: null, notes: "", skill_ids, status });
  exam(A, -20, "Schularbeit", "Mathematik", [K, D], ["Brüche", "Textaufgaben"], "geschrieben");
  exam(B, 10, "Schularbeit", "Mathematik", [dup, N], ["brüche ", "Negative Zahlen"], "geplant");
  exam(C, -200, "Test", "Mathematik", [K], [], "geschrieben", "Brüche, Prozent");
  exam(A, -5, "Schularbeit", "Mathematik", [N], ["Negative Zahlen"], "abgesagt");
  exam(C, -30, "Schularbeit", "Deutsch", [G], ["Beistriche"], "geschrieben");

  return { students: [A, B, C], dup, probe, w1, w2, wd, wg, wp, libraryId: (saved as { id: number }).id };
}

let data: Awaited<ReturnType<typeof dataset>>;

test("difficult skills: rates per skill from the final answers, merged duplicates count for their target", async () => {
  data = await dataset();
  const st = await import("./statistik");
  const s = st.statistics({ now: NOW });
  assert.deepEqual(s.filter, { subject: null, days: null, diagnosis: "mit" });
  assert.deepEqual(s.subjects, ["Mathematik", "Deutsch"]);
  assert.deepEqual(s.totals, { answers: 23, wrongTries: 21, students: 3, tasks: 6 });

  assert.equal(st.SKILL_MIN, 5);
  assert.deepEqual(s.skills.rows.map((r) => r.skill.id), [K, N, D], "hardest first");
  assert.equal(s.skills.belowMin, 2, "Aufzählungen and the own skill have 2 answers each");
  assert.ok(!s.skills.rows.some((r) => r.skill.id === data.dup), "the merged duplicate does not appear on its own");
  const [kuerzen, negativ, dividieren] = s.skills.rows;
  // Kürzen: T1 (5 answers, 1 right) and T3 via the merged duplicate (4 answers, all right)
  assert.deepEqual(kuerzen, {
    skill: { id: K, name: "Kürzen", parent: null, area: "Bruchrechnung", subject: "Mathematik" },
    answers: 9, students: 3, successRate: 5 / 9, firstTryRate: 3 / 9, hintsPerTask: 4 / 9, medianTimeSec: 20,
  });
  assert.deepEqual(
    [negativ.answers, negativ.students, negativ.successRate, negativ.firstTryRate, negativ.hintsPerTask, negativ.medianTimeSec],
    [5, 3, 3 / 5, 2 / 5, 0, 20],
    "diagnosis answers count by default",
  );
  assert.deepEqual([dividieren.answers, dividieren.successRate, dividieren.firstTryRate, dividieren.medianTimeSec], [5, 1, 1, 60]);
});

test("frequent error types: wrong tries per Fehlerart, teacher-confirmed ones, top skills, wrong tries without a type", async () => {
  const st = await import("./statistik");
  const s = st.statistics({ now: NOW });
  assert.deepEqual(s.errorTypes.rows.map((r) => [r.type, r.label, r.count, r.confirmed, r.skills.map((x) => [x.skill.id, x.count])]), [
    ["vorzeichen", "Vorzeichenfehler", 5, 1, [[N, 4], [K, 1]]],
    ["rechenfehler", "Rechenfehler", 3, 1, [[K, 3]]],
    ["grammatik", "Grammatikfehler", 3, 0, [[G, 3]]],
    ["fluechtig", "Flüchtigkeitsfehler", 1, 1, [[K, 1]]],
    ["regel", "Regel nicht verstanden", 1, 0, [[K, 1]]],
  ]);
  assert.equal(s.errorTypes.wrong, 21, "every wrong try, final or not; a viewed solution is not a wrong try");
  assert.equal(s.errorTypes.withoutType, 8);
});

test("average Lernstand per skill over the students with evidence, with n", async () => {
  const st = await import("./statistik");
  const { analyzeStudent } = await import("./service");
  const s = st.statistics({ now: NOW });
  // the own skill was answered right now: A 1 correct answer → 75 %, B solution viewed → 25 %
  const probe = s.mastery.find((m) => m.skill.id === data.probe)!;
  assert.deepEqual([probe.mean, probe.students], [0.5, 2]);
  for (const [id, n] of [[K, 3], [D, 3], [N, 3], [G, 2]] as const) {
    const values = data.students.map((sid) => analyzeStudent(sid, NOW)!.skills.find((x) => x.skill.id === id)?.mastery ?? null).filter((v): v is number => v !== null);
    const row = s.mastery.find((m) => m.skill.id === id)!;
    assert.equal(row.students, n, id);
    assert.equal(values.length, n);
    assert.ok(Math.abs(row.mean - values.reduce((a, b) => a + b, 0) / n) < 1e-12, id);
  }
  assert.ok(!s.mastery.some((m) => m.skill.id === data.dup), "the merged duplicate's answers count for Kürzen");
  assert.ok(s.mastery.every((m, i) => i === 0 || s.mastery[i - 1].mean <= m.mean), "lowest first");
  assert.ok(!s.mastery.some((m) => m.skill.id === "mathe.prozent.grundwert"), "only skills somebody has evidence for");
});

test("tasks: copies grouped, rates, expected rate by level, unusually easy and hard only from the minimum", async () => {
  const st = await import("./statistik");
  const s = st.statistics({ now: NOW });
  assert.deepEqual(st.EXPECTED_SUCCESS, { 1: 0.95, 2: 0.8, 3: 0.65, 4: 0.45, 5: 0.25 });
  assert.equal(st.UNUSUAL_DEVIATION, 0.25);
  assert.equal(st.TASK_MIN, 5);
  assert.deepEqual(s.tasks.map((t) => t.prompt), ["Kürze 6/8", "Berechne 3/4 : 1/2", "Berechne (−5) + (−7)", "Kürze 10/15", "Äpfel … Birnen und Kirschen", "Probeaufgabe 1"]);
  const [t1, t2, td, t3] = s.tasks;
  assert.deepEqual(t1, {
    taskId: data.w2.tasks[0].id, worksheetId: data.w2.id, libraryId: data.libraryId, prompt: "Kürze 6/8", type: "calc",
    skill: { id: K, name: "Kürzen", parent: null, area: "Bruchrechnung", subject: "Mathematik" }, subject: "Mathematik", level: 2, copies: 2,
    answers: 5, students: 3, successRate: 0.2, firstTryRate: 0.2, hintsPerTask: 0.6, helpRate: 0.4, medianTimeSec: 30,
    expected: 0.8, deviation: -0.6, unusual: "schwer", suggestedLevel: null,
  });
  assert.deepEqual([t2.worksheetId, t2.libraryId, t2.level, t2.answers, t2.successRate, t2.expected, t2.deviation, t2.unusual, t2.medianTimeSec], [data.w1.id, null, 4, 5, 1, 0.45, 0.55, "leicht", 60]);
  assert.deepEqual([td.worksheetId, td.answers, td.successRate, td.deviation, td.unusual], [data.wd.id, 5, 0.6, -0.05, null], "close to the expectation");
  assert.equal(t3.skill?.id, K, "the merged duplicate is shown as its target");
  assert.deepEqual([t3.answers, t3.successRate, t3.firstTryRate, t3.hintsPerTask, t3.medianTimeSec, t3.deviation, t3.unusual], [4, 1, 0.5, 0.25, 10, 0.35, null], "too few answers to flag");
});

test("topics in Schularbeiten and tests: Themen via skills, Stichwörter as typed, cancelled ones left out", async () => {
  const st = await import("./statistik");
  const s = st.statistics({ now: NOW });
  assert.equal(s.tests.total, 4);
  assert.equal(s.tests.students, 3);
  assert.deepEqual(s.tests.byKind, [{ kind: "Schularbeit", tests: 3 }, { kind: "Test", tests: 1 }]);
  assert.deepEqual(s.tests.areas, [
    { label: "Bruchrechnung", subject: "Mathematik", tests: 3, students: 3, byKind: [{ kind: "Schularbeit", tests: 2 }, { kind: "Test", tests: 1 }] },
    { label: "Beistrichsetzung", subject: "Deutsch", tests: 1, students: 1, byKind: [{ kind: "Schularbeit", tests: 1 }] },
    { label: "Negative Zahlen", subject: "Mathematik", tests: 1, students: 1, byKind: [{ kind: "Schularbeit", tests: 1 }] },
  ]);
  assert.deepEqual(s.tests.topics.map((t) => [t.label, t.subject, t.tests, t.students]), [
    ["Brüche", "Mathematik", 3, 3],
    ["Beistriche", "Deutsch", 1, 1],
    ["Negative Zahlen", "Mathematik", 1, 1],
    ["Prozent", "Mathematik", 1, 1],
    ["Textaufgaben", "Mathematik", 1, 1],
  ]);
});

test("filters: time window, diagnosis with/without/only, subject", async () => {
  const st = await import("./statistik");
  // 90 days: B's old answer on the copy of T1 and the old test drop out; the planned test stays
  const recent = st.statistics({ now: NOW, days: 90 });
  assert.equal(recent.totals.answers, 22);
  const t1 = recent.tasks.find((t) => t.prompt === "Kürze 6/8")!;
  assert.deepEqual([t1.answers, t1.successRate, t1.unusual], [4, 0.25, null], "below the minimum: no flag");
  const k = recent.skills.rows.find((r) => r.skill.id === K)!;
  assert.deepEqual([k.answers, k.successRate], [8, 5 / 8]);
  assert.deepEqual(recent.skills.rows.map((r) => r.skill.id), [N, K, D], "Negative Zahlen (60 %) is now harder than Kürzen (62.5 %)");
  assert.ok(!recent.errorTypes.rows.some((r) => r.type === "regel"));
  assert.deepEqual([recent.errorTypes.wrong, recent.errorTypes.withoutType], [18, 6]);
  assert.equal(recent.tests.total, 3);
  assert.deepEqual(recent.tests.areas[0], { label: "Bruchrechnung", subject: "Mathematik", tests: 2, students: 2, byKind: [{ kind: "Schularbeit", tests: 2 }] });
  assert.deepEqual(recent.tests.topics[0].label, "Brüche");
  assert.equal(recent.tests.topics[0].tests, 2);

  const only = st.statistics({ now: NOW, diagnosis: "nur" });
  assert.deepEqual(only.totals, { answers: 5, wrongTries: 7, students: 3, tasks: 1 });
  assert.deepEqual(only.skills.rows.map((r) => r.skill.id), [N]);
  assert.deepEqual(only.errorTypes.rows.map((r) => [r.type, r.count, r.confirmed]), [["vorzeichen", 4, 1]]);
  assert.equal(only.errorTypes.withoutType, 3);
  assert.deepEqual(only.tasks.map((t) => t.worksheetId), [data.wd.id]);

  const without = st.statistics({ now: NOW, diagnosis: "ohne" });
  assert.equal(without.totals.answers, 18);
  assert.deepEqual(without.skills.rows.map((r) => r.skill.id), [K, D]);
  assert.ok(!without.tasks.some((t) => t.worksheetId === data.wd.id));
  assert.deepEqual(without.errorTypes.rows.find((r) => r.type === "vorzeichen")?.count, 1);

  const deutsch = st.statistics({ now: NOW, subject: "Deutsch" });
  assert.equal(deutsch.totals.answers, 2);
  assert.deepEqual(deutsch.skills, { rows: [], belowMin: 1 });
  assert.deepEqual(deutsch.errorTypes.rows.map((r) => [r.type, r.count]), [["grammatik", 3]]);
  assert.deepEqual(deutsch.mastery.map((m) => [m.skill.id, m.students]), [[G, 2]]);
  assert.deepEqual(deutsch.tasks.map((t) => t.prompt), ["Äpfel … Birnen und Kirschen"]);
  assert.equal(deutsch.tests.total, 1);
  assert.deepEqual(deutsch.subjects, ["Mathematik", "Deutsch"], "the chips keep every subject");
});

test("privacy: only counts, no names and no student ids in the result", async () => {
  const st = await import("./statistik");
  for (const f of [{}, { days: 30 }, { diagnosis: "nur" as const }, { subject: "Mathematik" }]) {
    const out = JSON.stringify(st.statistics({ now: NOW, ...f }));
    for (const name of NAMES.flatMap((n) => n.split(" "))) assert.ok(!out.includes(name), `${name} must not appear`);
    assert.doesNotMatch(out, /student_?id/i);
  }
});
