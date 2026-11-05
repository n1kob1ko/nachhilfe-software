import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

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

const STUFEN = ["sehr leicht", "leicht", "mittel", "schwer", "sehr schwer"] as const;
const SEEDS = 30;

/** Die Antwort, die ein Kind eintippt: bei Lücken das JSON der ersten Alternativen. */
const richtigeAntworten = (t: { answer: { accepted?: string[]; blanks?: string[][] } }): string[] =>
  t.answer.blanks ? [JSON.stringify(t.answer.blanks.map((b) => b[0]))] : (t.answer.accepted ?? []);

test("Mathe-Grundlagen: every skill exists, every task is complete, every right answer is right, no typical error is", async () => {
  const { MATHE_GRUNDLAGEN } = await import("./mathe-grundlagen");
  const { checkAnswer } = await import("./tasks");
  const repo = await import("./repo");
  const ids = new Set(repo.listSkills().map((s) => s.id));
  const fehlt: string[] = [];
  const pruefe = (ok: boolean, text: string) => {
    if (!ok) fehlt.push(text);
  };
  for (const [skillId, gen] of Object.entries(MATHE_GRUNDLAGEN)) {
    assert.ok(ids.has(skillId), `${skillId} is no skill`);
    for (const diff of STUFEN) {
      const ersteZeilen = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) {
        const t = gen(mulberry32(seed), diff);
        const wo = `${skillId} ${diff} #${seed}: ${t.prompt}`;
        assert.equal(t.skillId, skillId, wo);
        // „null“ ist hier ein deutsches Wort („ein Faktor ist null“)
        pruefe(!/NaN|undefined|Infinity|\[object/.test(`${t.prompt}\n${t.solution}\n${t.hints.join("\n")}`), `${wo}: NaN/undefined`);
        pruefe(t.solution.trim().length > 0 && t.hints.length >= 2, `${wo}: solution or hints missing`);
        const richtig = richtigeAntworten(t);
        assert.ok(richtig.length > 0, wo);
        for (const a of richtig) pruefe(checkAnswer(t, a).correct === true, `${wo} → ${a} should be right`);
        for (const e of t.errorMap) {
          // bei Lücken tippt das Kind die Werte einzeln: „6 | -1“ sind zwei Lücken
          const eingabe = t.answer.blanks ? JSON.stringify(e.answer.split(" | ")) : e.answer;
          const r = checkAnswer(t, eingabe);
          pruefe(!r.correct, `${wo} → typical error ${e.answer} (${e.label}) counts as right`);
          pruefe(r.correct || r.errorLabel === e.label, `${wo} → typical error ${e.answer} gets the label ${r.errorLabel}, not ${e.label}`);
          pruefe(!/^-?0$/.test(e.answer), `${wo} → typical error 0`);
        }
        ersteZeilen.add(t.prompt.split("\n")[0]);
      }
      pruefe(ersteZeilen.size >= 8, `${skillId} ${diff}: only ${ersteZeilen.size} different tasks in ${SEEDS}`);
    }
  }
  assert.deepEqual(fehlt.slice(0, 40), [], `${fehlt.length} problems`);
});

test("Mathe-Grundlagen: the skills now have built-in tasks, as calculation, multiple choice and gap", async () => {
  const { MATHE_GRUNDLAGEN } = await import("./mathe-grundlagen");
  const { generateBuiltIn, hasBuiltInGenerator } = await import("./generators");
  const { checkAnswer } = await import("./tasks");
  for (const skillId of Object.keys(MATHE_GRUNDLAGEN)) {
    assert.ok(hasBuiltInGenerator(skillId), skillId);
    for (const taskType of ["calc", "mc", "cloze", "mixed"] as const) {
      const tasks = generateBuiltIn({ subject: "Mathematik", skills: [{ id: skillId, name: skillId }], difficulty: "mittel", count: 6, taskType, seed: 7 } as Parameters<typeof generateBuiltIn>[0]);
      assert.equal(tasks.length, 6, `${skillId} ${taskType}`);
      for (const t of tasks) {
        assert.doesNotMatch(t.prompt, /Erkläre in eigenen Worten/, `${skillId} ${taskType}`);
        if (t.type === "mc") {
          assert.equal(checkAnswer(t, String(t.answer.correct)).correct, true, `${skillId} mc ${t.prompt}`);
          assert.ok((t.data.options ?? []).length >= 2, `${skillId} mc ${t.prompt}`);
        } else {
          for (const a of richtigeAntworten(t)) assert.equal(checkAnswer(t, a).correct, true, `${skillId} ${taskType} ${t.prompt} → ${a}`);
        }
      }
    }
  }
});

test("Terme: equal as a polynomial, in the form the task asks for", async () => {
  const { pruefeTerm, hatForm } = await import("./term-check");
  const z = { vars: ["x", "y"], form: "zusammengefasst" as const };
  const f = { vars: ["x", "y"], form: "faktorisiert" as const };
  assert.deepEqual(pruefeTerm("7y + 2x", "2x + 7y", z), { gleich: true, form: true, lesbar: true });
  assert.deepEqual(pruefeTerm("2x+7y", "2x + 7y", z), { gleich: true, form: true, lesbar: true });
  assert.equal(pruefeTerm("3x + 4y − x + 3y", "2x + 7y", z).form, false, "copied prompt is not zusammengefasst");
  assert.equal(pruefeTerm("3x + 4y − x + 3y", "2x + 7y", z).gleich, true);
  assert.equal(pruefeTerm("2(x + 3)", "2x + 6", z).form, false, "a bracket is not aufgelöst");
  assert.equal(pruefeTerm("2x + 5", "2x + 6", z).gleich, false);
  assert.equal(pruefeTerm("x² − 6x + 9", "x^2 - 6x + 9", z).gleich, true);
  assert.equal(pruefeTerm("x·x − 6x + 9", "x^2 - 6x + 9", z).form, true, "x·x is one monomial");
  assert.equal(pruefeTerm("2a + 1", "2x + 1", z).lesbar, false, "a letter of no task is unreadable");
  assert.equal(pruefeTerm("x^2 − 25y", "x^2 − 25y^2", z).gleich, false, "a missing monomial is no match");
  assert.equal(pruefeTerm("x^2 − 25y^2", "x^2 − 25y", z).gleich, false);

  assert.equal(hatForm("2x(3x − 1)", f), true);
  assert.equal(hatForm("2·(3x − 1)·x", f), true);
  assert.equal(hatForm("−3(x + 2)", f), true);
  assert.equal(hatForm("(x + 3)^2", f), true);
  assert.equal(hatForm("(x + 3)(x − 3)", f), true);
  assert.equal(hatForm("6x^2 − 2x", f), false, "not factored at all");
  assert.equal(hatForm("2(4x + 6)", f), false, "a 2 is still inside");
  assert.equal(hatForm("2(3x^2 − x)", f), false, "an x is still inside");
  assert.equal(hatForm("2x(3x − 1) + 1", f), false, "a sum, not a product");
});

test("Terme in a task: the copied prompt and the half factored term are not right, and the feedback says why", async () => {
  const { MATHE_GRUNDLAGEN } = await import("./mathe-grundlagen");
  const { checkAnswer } = await import("./tasks");
  for (let seed = 1; seed <= 40; seed++) {
    const t = MATHE_GRUNDLAGEN["mathe.terme.zusammenfassen"](mulberry32(seed), "mittel");
    const angabe = t.prompt.replace(/^Fasse zusammen: /, "");
    const r = checkAnswer(t, angabe);
    assert.equal(r.correct, false, t.prompt);
    assert.match(r.feedback, /noch nicht fertig/, t.prompt);
    const k = MATHE_GRUNDLAGEN["mathe.terme.klammern"](mulberry32(seed), "mittel");
    assert.equal(checkAnswer(k, k.prompt.replace(/^.*: /, "")).correct, false, k.prompt);
  }
  let halb = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const t = MATHE_GRUNDLAGEN["mathe.terme.herausheben"](mulberry32(seed), "leicht");
    const ausmult = t.prompt.replace(/^.*: /, "");
    assert.equal(checkAnswer(t, ausmult).correct, false, "the prompt itself is not herausgehoben");
    const teilweise = t.errorMap.find((e) => e.label.startsWith("Nicht den größten"));
    if (teilweise) {
      const r = checkAnswer(t, teilweise.answer);
      assert.equal(r.correct, false, teilweise.answer);
      assert.equal(r.errorLabel, teilweise.label);
      assert.match(r.feedback, /gemeinsamer Faktor/);
      halb++;
    }
  }
  assert.ok(halb > 5, String(halb));
});

test("German thousands in an answer: 3.000 is three thousand, 0.125 stays a decimal", async () => {
  const { parseNumber } = await import("./tasks");
  assert.equal(parseNumber("3.000"), 3000);
  assert.equal(parseNumber("12.500,5"), 12500.5);
  assert.equal(parseNumber("1.250.000"), 1250000);
  assert.equal(parseNumber("0.125"), 0.125);
  assert.equal(parseNumber("2.5"), 2.5);
  assert.equal(parseNumber("3,75"), 3.75);
});

test("Terme on the student's device: the worksheet keeps the term check, the copied prompt is not right, the result is", async () => {
  const repo = await import("./repo");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({
    name: "Term Kind", grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 3, skillIds: ["mathe.terme.zusammenfassen"], difficulty: "mittel", count: 3, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(wid, sid, "");
  const [t] = repo.listTasks(wid);
  assert.ok(t.answer.term, "the term check is stored with the task");
  const r1 = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: t.prompt.replace(/^Fasse zusammen: /, ""), timeMs: 10_000, hintsUsed: 0 });
  assert.equal(r1.correct, false);
  assert.match(r1.feedback, /noch nicht fertig/);
  // gleich, nur in anderer Reihenfolge und ohne Leerzeichen
  const umgedreht = t.answer.accepted![0].split(/ (?=[+−])/).reverse().map((g, i) => (i === 0 ? g.replace(/^\+ /, "") : /^[+−]/.test(g) ? g : `+ ${g}`)).join(" ");
  const r2 = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: umgedreht.replace(/\s/g, ""), timeMs: 10_000, hintsUsed: 0 });
  assert.equal(r2.correct, true, `${t.answer.accepted![0]} as ${umgedreht}`);
});
