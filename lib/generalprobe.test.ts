import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

// Fixes from the Generalprobe on 2026-11-05 (teacher on the phone, student on the tablet)

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("„Berechne und kürze“: the right value unreduced is not right yet, counts half on the last try", async () => {
  const { checkAnswer, nichtGekuerzt } = await import("./tasks");
  const task = {
    type: "calc" as const,
    prompt: "Berechne und kürze das Ergebnis: 3/8 · 7/6",
    data: {},
    answer: { accepted: ["7/16"], mode: "value" as const },
    errorMap: [],
  };
  assert.equal(checkAnswer(task, "7/16").correct, true);
  const halb = checkAnswer(task, "21/48");
  assert.equal(halb.correct, false, "21/48 has the right value but is not reduced");
  assert.equal(halb.onFinal, "teilweise");
  assert.equal(halb.errorLabel, "Ergebnis nicht gekürzt");
  assert.match(halb.feedback, /Kürze/);
  assert.equal(checkAnswer(task, "0,4375").correct, true, "a decimal number is no fraction to reduce");
  assert.equal(checkAnswer({ ...task, prompt: "Berechne: 3/8 · 7/6" }, "21/48").correct, true, "without „kürze“ the value is enough");
  assert.equal(checkAnswer({ ...task, prompt: "Berechne: 3/8 · 7/6", answer: { ...task.answer, form: "gekuerzt" } }, "21/48").correct, false);

  for (const [s, v] of [["14/48", true], ["7/24", false], ["2 3/6", true], ["2 1/2", false], ["5", false], ["1/1", false]] as const) {
    assert.equal(nichtGekuerzt(s), v, s);
  }
});

test("„Berechne und kürze“ from the generator: every accepted answer stays right, the unreduced value is caught", async () => {
  const { MATHE_RECHNUNGEN } = await import("./mathe-rechnungen");
  const { checkAnswer } = await import("./tasks");
  let erwischt = 0;
  for (const op of ["addieren", "subtrahieren", "multiplizieren", "dividieren"]) {
    for (const diff of ["leicht", "mittel", "schwer"] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const t = MATHE_RECHNUNGEN[`mathe.brueche.${op}`](mulberry32(seed), diff);
        assert.match(t.prompt, /kürze/);
        for (const a of t.answer.accepted ?? []) assert.equal(checkAnswer(t, a).correct, true, `${t.prompt} → ${a}`);
        // the same value with numerator and denominator doubled
        const m = (t.answer.accepted ?? []).map((a) => a.match(/^(-?)(\d+)\/(\d+)$/)).find(Boolean);
        if (m) {
          const r = checkAnswer(t, `${m[1]}${Number(m[2]) * 2}/${Number(m[3]) * 2}`);
          assert.equal(r.correct, false, t.prompt);
          assert.equal(r.onFinal, "teilweise");
          erwischt++;
        }
      }
    }
  }
  assert.ok(erwischt > 100, String(erwischt));
});

test("live status: the teacher sees what the student typed when it was wrong", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({
    name: "Live Kind", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const unit = units.startUnit(niko.id, sid, { subject: "Mathematik" }).unit;
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.dividieren"], difficulty: "leicht", count: 2, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(wid, sid, "", unit.id);
  const [t1] = repo.listTasks(wid);

  await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t1.id, answer: "99/7", timeMs: 10_000, hintsUsed: 0 });
  const last = live.liveSnapshot(unit.id)!.current!.last!;
  assert.equal(last.correct, false);
  assert.equal(last.answer, "99/7");

  await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t1.id, answer: t1.answer.accepted![0], timeMs: 10_000, hintsUsed: 0 });
  const next = live.liveSnapshot(unit.id)!.current!;
  assert.equal(next.taskNo, 2, "on to the next task");
  assert.equal(next.last, null);
  const prev = repo.listAttemptsForAssignment(aid).at(-1)!;
  assert.equal(Boolean(prev.correct), true);
});

test("Abschluss: after 6 of 6 no „Schwäche“, the homework says why it is not sure yet", async () => {
  const { abschlussKarte } = await import("./abschluss");
  const { ergebnisThemen } = await import("./hausuebung");
  const t = (o: { firstTry?: boolean; tries?: number; correct?: boolean } = {}) => ({ assignmentId: 1, skillId: "mathe.brueche.dividieren", skill: "Dividieren", correct: true, finished: true, firstTry: true, tries: 1, help: "keine" as const, ...o });
  const sechs = [t(), t(), t({ firstTry: false, tries: 2 }), t(), t(), t()];
  const belege = { aufgaben: sechs, fehler: [], beobachtungen: [], reaktionen: [], minitest: null, vorgabe: [], geuebt: [], pruefung: null, eigene: {} };
  const d = (text: string) => ({ text, from: "daten" as const });
  const brief = { done: [], good: [], difficulties: [], errors: [], next: [d("Dividieren (Schwäche)"), d("Addieren (Fehler)")], dates: [] };
  const k = abschlussKarte(brief, null, [], belege);
  assert.deepEqual(k.naechstes.map((z) => z.text), ["Dividieren (festigen)", "Addieren (Fehler)"], "Addieren was not practised today");
  // one wrong today: still a Schwäche
  const k2 = abschlussKarte(brief, null, [], { ...belege, aufgaben: [...sechs.slice(1), t({ correct: false, firstTry: false })] });
  assert.equal(k2.naechstes[0].text, "Dividieren (Schwäche)");

  const [th] = ergebnisThemen(belege);
  assert.equal(th.stand, "teilweise");
  assert.equal(th.grund, "noch nicht sicher: 6 von 6 richtig, 5 beim ersten Versuch ohne Hilfe");
});
