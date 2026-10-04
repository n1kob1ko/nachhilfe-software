import assert from "node:assert/strict";
import test from "node:test";
import { CURRICULUM, DIFFICULTIES } from "./curriculum";
import { generateBuiltIn, hasBuiltInGenerator } from "./generators";
import { checkAnswer, parseNumber } from "./tasks";
import { masteryAt, taskScore } from "./analysis";

test("parseNumber understands fractions, mixed numbers and decimals", () => {
  assert.equal(parseNumber("3/4"), 0.75);
  assert.equal(parseNumber("1 1/2"), 1.5);
  assert.equal(parseNumber("0,75"), 0.75);
  assert.equal(parseNumber("-2"), -2);
  assert.equal(parseNumber("x = 5"), 5);
  assert.equal(parseNumber("abc"), null);
});

test("every built-in task accepts its own solution and rejects its typical errors", () => {
  for (const skill of CURRICULUM.filter((s) => hasBuiltInGenerator(s.id))) {
    for (const difficulty of DIFFICULTIES) {
      for (const taskType of ["calc", "mc", "cloze", "mixed"] as const) {
        const tasks = generateBuiltIn({ subject: skill.subject, skills: [{ id: skill.id, name: skill.name }], difficulty, count: 6, taskType, seed: 42 });
        assert.ok(tasks.length > 0, `${skill.id} produced no tasks`);
        for (const t of tasks) {
          const right =
            t.data.options && typeof t.answer.correct === "number"
              ? String(t.answer.correct)
              : t.answer.blanks
                ? JSON.stringify(t.answer.blanks.map((b) => b[0]))
                : (t.answer.accepted?.[0] ?? "");
          if (t.type === "free") continue;
          assert.equal(checkAnswer(t, right).correct, true, `${skill.id}: "${t.prompt}" rejects its own answer ${right}`);
          for (const e of t.errorMap) {
            if (t.answer.blanks && t.answer.blanks.length > 1) continue;
            const wrong = t.answer.blanks ? JSON.stringify([e.answer]) : e.answer;
            const r = checkAnswer(t, wrong);
            assert.equal(r.correct, false, `${skill.id}: typical error "${e.answer}" counted as correct for "${t.prompt}"`);
            assert.equal(r.errorLabel, e.label);
          }
        }
      }
    }
  }
});

test("fraction division recognises the forgotten reciprocal", () => {
  const [t] = generateBuiltIn({ subject: "Mathematik", skills: [{ id: "mathe.brueche.dividieren", name: "Dividieren" }], difficulty: "mittel", count: 1, taskType: "calc", seed: 3 });
  const label = t.errorMap.find((e) => e.label === "Kehrwert vergessen");
  assert.ok(label);
  assert.equal(checkAnswer(t, label.answer).errorLabel, "Kehrwert vergessen");
});

test("mastery rewards first tries and recent evidence", () => {
  assert.equal(taskScore({ correct: 1, attempt_no: 1, hints_used: 0, solution_viewed: 0 }), 1);
  assert.ok(taskScore({ correct: 1, attempt_no: 2, hints_used: 1, solution_viewed: 0 }) < 0.7);
  assert.equal(taskScore({ correct: 0, attempt_no: 3, hints_used: 0, solution_viewed: 0 }), 0);
  const now = Date.now();
  const day = 86_400_000;
  const oldBad = { skillId: "x", score: 0, weight: 1, at: now - 90 * day, source: "aufgabe" as const };
  const newGood = { skillId: "x", score: 1, weight: 1, at: now - day, source: "aufgabe" as const };
  assert.ok(masteryAt([oldBad, newGood], now)! > 0.6);
  assert.ok(masteryAt([newGood], now)! < 1, "one task is never 100 %");
});
