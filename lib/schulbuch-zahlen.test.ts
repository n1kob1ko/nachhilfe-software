import assert from "node:assert/strict";
import test from "node:test";
import { DIFFICULTIES, type Difficulty } from "./curriculum";
import { generateForSlot } from "./generators";
import { rechenwegTask, sachaufgabeTask } from "./generators-mathe";
import { checkOwnSolution, gradeMathTask } from "./math-task";
import {
  DINGE,
  STUFE,
  bruchListe,
  dingFall,
  gcd,
  gleichungEinfach,
  gleichungKlammern,
  hauptnenner,
  kuerzenAufgabe,
  potenzAufgabe,
  preisSpanne,
  prozentFall,
  type BruchOp,
  type Stufe,
} from "./schulbuch-zahlen";
import { checkAnswer, parseNumber, type TaskDraft } from "./tasks";
import { VORNAMEN } from "./textaufgaben";

const SKILLS = [
  "mathe.brueche.kuerzen",
  "mathe.brueche.erweitern",
  "mathe.brueche.addieren",
  "mathe.brueche.subtrahieren",
  "mathe.brueche.multiplizieren",
  "mathe.brueche.dividieren",
  "mathe.negativ.addieren",
  "mathe.negativ.multiplizieren",
  "mathe.prozent.prozentwert",
  "mathe.prozent.prozentsatz",
  "mathe.prozent.grundwert",
  "mathe.gleichungen.einfach",
  "mathe.gleichungen.klammern",
  "mathe.gleichungen.text",
  "mathe.potenzen.regeln",
];
const STUFEN: Stufe[] = [0, 1, 2, 3, 4];
const N = 200;

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const slot = (skillId: string, difficulty: Difficulty, category: string) => ({ skillId, skillName: skillId, difficulty, category, subject: "Mathematik" });
const visible = (t: TaskDraft) => [t.prompt, t.solution, ...t.hints, ...(t.data.options ?? [])].join("\n");
const rightAnswer = (t: TaskDraft) =>
  t.data.options && typeof t.answer.correct === "number" ? String(t.answer.correct) : t.answer.blanks ? JSON.stringify(t.answer.blanks.map((b) => b[0])) : (t.answer.accepted?.[0] ?? "");
const primeFactors = (n: number) => {
  const out: number[] = [];
  for (let p = 2; n > 1; p++) while (n % p === 0) [out[out.length], n] = [p, n / p];
  return out;
};
/** Denominators of the fractions written in a text ("3/4", "(3)/(4)"). */
const nennerIn = (text: string) => [...text.matchAll(/(?<![\d,^])\d+\s*\/\s*\(?(\d+)/g)].map((m) => Number(m[1]));
/** Euro amounts written in a text ("49,90 €"). */
const euroIn = (text: string) => [...text.matchAll(/(\d+(?:,\d+)?) ?€/g)].map((m) => m[1]);

/** Every task of every maths skill, per level: calculations and word problems. */
const TASKS = new Map<string, TaskDraft[]>();
function tasks(skillId: string, difficulty: Difficulty, category: "rechnung" | "textaufgabe"): TaskDraft[] {
  const key = `${skillId}|${difficulty}|${category}`;
  if (!TASKS.has(key)) {
    const rng = seeded(7 + key.length * 31 + SKILLS.indexOf(skillId));
    TASKS.set(key, Array.from({ length: N }, () => generateForSlot(slot(skillId, difficulty, category), rng)));
  }
  return TASKS.get(key)!;
}

test("Schulbuch-Zahlen: every calculation and word problem accepts its own answer and names its typical errors", () => {
  for (const s of SKILLS)
    for (const d of DIFFICULTIES)
      for (const cat of ["rechnung", "textaufgabe"] as const)
        for (const t of tasks(s, d, cat)) {
          assert.equal(checkAnswer(t, rightAnswer(t)).correct, true, `${s} ${d} ${cat}: ${t.prompt} → ${rightAnswer(t)}`);
          for (const e of t.errorMap) {
            const r = checkAnswer(t, t.answer.blanks ? JSON.stringify([e.answer]) : e.answer);
            assert.equal(r.correct, false, `${s} ${d}: the typical error ${e.answer} is judged right (${t.prompt})`);
            assert.equal(r.errorLabel, e.label, `${s} ${d}: ${e.answer} gets its own label`);
          }
          assert.doesNotMatch(visible(t), /—| – /, `${s}: no dashes in the task text`);
        }
});

test("Schulbuch-Zahlen: fractions have denominators that fit together", () => {
  // the common denominator per level: 2/7 + 3/7, then 1/2 + 1/4, then at most 24 (36 for three fractions)
  const maxHN = [10, 12, 24, 24, 36];
  for (const op of ["+", "−"] as BruchOp[])
    for (const lv of STUFEN)
      for (const r of bruchListe(lv, op)) {
        assert.ok(hauptnenner(r) <= maxHN[lv], `${r.terms.map((f) => `${f.n}/${f.d}`).join(` ${op} `)}: common denominator ${hauptnenner(r)}`);
        assert.ok(r.result.n > 0, "the result is positive");
        if (lv === 0) assert.equal(new Set(r.terms.map((f) => f.d)).size, 1, "sehr leicht: the same denominator");
      }
  for (const op of ["·", ":"] as BruchOp[])
    for (const lv of STUFEN)
      for (const r of bruchListe(lv, op)) {
        for (const f of [...r.terms, r.result]) assert.ok(f.d <= 20 && !primeFactors(f.d).some((p) => p > 7), `${op} ${lv}: denominator ${f.d}`);
        // mittel may give sevenths after Kürzen über Kreuz (3/7 · 1/3 = 1/7), the hard levels no longer
        if (lv >= 2) assert.ok(r.result.d <= 12, `${op} ${lv}: result ${r.result.n}/${r.result.d}`);
        if (lv >= 3) assert.ok([1, 2, 3, 4, 5, 6, 8, 9, 10, 12].includes(r.result.d), `${op} ${lv}: result ${r.result.n}/${r.result.d}`);
      }
  // the known bad example: 7/10 + 10/11 = 177/110
  for (const s of ["mathe.brueche.addieren", "mathe.brueche.subtrahieren", "mathe.brueche.multiplizieren", "mathe.brueche.dividieren", "mathe.brueche.kuerzen", "mathe.brueche.erweitern"])
    for (const d of DIFFICULTIES)
      for (const cat of ["rechnung", "textaufgabe"] as const)
        for (const t of tasks(s, d, cat))
          for (const n of nennerIn(`${t.prompt}\n${t.answer.accepted?.[0] ?? ""}`)) assert.ok(n > 0 && !primeFactors(n).some((p) => p > 7), `${s} ${d}: denominator ${n} in ${t.prompt}`);
  for (const lv of STUFEN) {
    const rng = seeded(3 + lv);
    for (let i = 0; i < N; i++) {
      const { q, r, k } = kuerzenAufgabe(rng, lv);
      assert.equal(gcd(q.n, q.d), k, "Kürzen: the given number is the greatest common divisor");
      assert.equal(gcd(r.n, r.d), 1);
      assert.ok(q.d <= [40, 60, 120, 250, 300][lv]);
    }
  }
});

test("Schulbuch-Zahlen: prices fit the item, percentages give clean results", () => {
  for (const ding of DINGE) {
    const [lo, hi] = preisSpanne(ding);
    assert.ok(hi <= 4 * lo, `${ding.ein}: prices from ${lo} to ${hi} €`);
    for (const g of ding.preise.flat()) assert.ok([0, 50, 90].includes(Math.round(g * 100) % 100), `${ding.ein}: ${g} € ends in ,00 ,50 or ,90`);
  }
  for (const lv of STUFEN) {
    const rng = seeded(11 + lv);
    for (let i = 0; i < N; i++) {
      const f = dingFall(rng, lv);
      const [lo, hi] = preisSpanne(f.ding);
      assert.ok(f.G >= lo && f.G <= hi, `${f.ding.ein} costs ${f.G} €`);
      assert.ok(Math.abs(f.W * 100 - Math.round(f.W * 100)) < 1e-9, `${f.p} % of ${f.G} € is whole cents`);
      assert.ok(Math.abs((f.G * f.p) / 100 - f.W) < 1e-9);
      if (lv <= 1) assert.equal(f.W % 1, 0, `easy levels: ${f.p} % of ${f.G} € is whole euros`);
    }
    for (const art of ["wert", "satz", "grund"] as const)
      for (let i = 0; i < N; i++) {
        const { G, p, W } = prozentFall(rng, lv, art);
        assert.ok(Math.abs((G * p) / 100 - W) < 1e-9, `${p} % of ${G} = ${W}`);
        assert.ok(Math.abs(W * 100 - Math.round(W * 100)) < 1e-9, "whole cents");
        if (lv <= 1) assert.ok(W % 1 === 0 && p % 5 === 0, `easy levels: ${p} % of ${G} € = ${W} €`);
      }
  }
  for (const s of ["mathe.prozent.prozentwert", "mathe.prozent.prozentsatz", "mathe.prozent.grundwert"])
    for (const d of DIFFICULTIES)
      for (const cat of ["rechnung", "textaufgabe"] as const)
        for (const t of tasks(s, d, cat)) {
          for (const e of euroIn(t.prompt)) assert.match(e, /^\d+(,\d\d)?$/, `${s} ${d}: money as 49,90 or 50 (${t.prompt})`);
          assert.doesNotMatch(t.answer.accepted?.[0] ?? "", /,\d{3}/, `${s} ${d}: at most two decimals (${t.prompt})`);
          if (STUFE[d] <= 1) assert.doesNotMatch(t.answer.accepted?.[0] ?? "", /,/, `${s} ${d}: easy levels have whole results (${t.prompt})`);
        }
});

test("Schulbuch-Zahlen: equations have whole solutions (simple fractions only at sehr schwer), never x = 0", () => {
  for (const lv of STUFEN) {
    const rng = seeded(21 + lv);
    for (let i = 0; i < N; i++)
      for (const g of [gleichungEinfach(rng, lv), gleichungKlammern(rng, lv)]) {
        assert.notEqual(g.x.n, 0, `${g.start}: x = 0`);
        if (lv <= 3) assert.equal(g.x.d, 1, `${g.start}: whole solution`);
        else assert.ok([1, 2, 3, 4, 5].includes(g.x.d), `${g.start}: x = ${g.x.n}/${g.x.d}`);
        if (lv === 0) assert.ok(g.x.n > 0 && g.x.n <= 20, `${g.start}: sehr leicht has a small positive solution`);
      }
  }
  for (const s of ["mathe.gleichungen.einfach", "mathe.gleichungen.klammern", "mathe.gleichungen.text"])
    for (const d of DIFFICULTIES)
      for (const t of tasks(s, d, "textaufgabe")) {
        const a = t.answer.accepted?.[0] ?? "";
        const x = parseNumber(a);
        assert.ok(x !== null && x > 0, `${s} ${d}: a positive solution (${t.prompt} → ${a})`);
        // prices with cents (0,45 €) only from schwer on
        if (STUFE[d] <= 2) assert.ok(Number.isInteger(x), `${s} ${d}: a word problem has a whole solution (${t.prompt} → ${a})`);
        else assert.match(a, /^\d+(,\d\d?)?$|^\d+\/[2-5]$/, `${s} ${d}: ${t.prompt} → ${a}`);
      }
});

test("Schulbuch-Zahlen: powers have small exponents and a natural prompt", () => {
  for (const lv of STUFEN) {
    const rng = seeded(31 + lv);
    for (let i = 0; i < N; i++) {
      const p = potenzAufgabe(rng, lv);
      assert.ok(p.e >= 1 && p.e <= 15, `${p.start}: exponent ${p.e}`);
      for (const m of p.start.matchAll(/\^(\d+)/g)) assert.ok(Number(m[1]) <= 15, `${p.start}`);
      assert.ok(!p.errors.some((e) => e.answer === p.steps[p.steps.length - 1]), "no typical error equals the result");
    }
  }
  for (const d of DIFFICULTIES)
    for (const cat of ["rechnung", "textaufgabe"] as const)
      for (const t of tasks("mathe.potenzen.regeln", d, cat)) {
        assert.doesNotMatch(t.prompt, /\^\?|Exponent/, `natural prompt: ${t.prompt}`);
        for (const m of t.prompt.matchAll(/\^(\d+)/g)) assert.ok(Number(m[1]) <= 15, t.prompt);
      }
});

test("Schulbuch-Zahlen: negative numbers are written with a real minus sign", () => {
  for (const s of ["mathe.negativ.addieren", "mathe.negativ.multiplizieren"])
    for (const d of DIFFICULTIES)
      for (const cat of ["rechnung", "textaufgabe"] as const)
        for (const t of tasks(s, d, cat)) {
          if (cat === "rechnung") assert.match(t.prompt, /−/, `${s} ${d}: ${t.prompt}`);
          assert.doesNotMatch(t.prompt, /(^|[\s(])-\d/, `${s} ${d}: no hyphen as minus (${t.prompt})`);
          if (STUFE[d] <= 2) assert.doesNotMatch(t.answer.accepted?.[0] ?? "", /,/, `${s} ${d}: whole results`);
        }
});

test("Schulbuch-Zahlen: every maths skill has real word problems with several contexts", () => {
  const names = new RegExp(`\\b(${VORNAMEN.join("|")})\\b`, "g");
  // a context is told apart by how the story begins, without names and numbers
  const opening = (prompt: string) =>
    prompt
      .replace(names, "N")
      .replace(/[−-]?\d+([,/]\d+)?/g, "#")
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
  for (const s of SKILLS) {
    const contexts = new Set<string>();
    for (const d of DIFFICULTIES) {
      const level = new Set<string>();
      for (const t of tasks(s, d, "textaufgabe")) {
        assert.equal(t.category, "textaufgabe", `${s} ${d}: a word problem, not a bare calculation`);
        assert.match(t.prompt, /\?/, `${s} ${d}: asks a question (${t.prompt})`);
        assert.ok(t.prompt.split(/\s+/).length >= 10, `${s} ${d}: a whole story (${t.prompt})`);
        assert.doesNotMatch(t.prompt, /^(Berechne|Kürze|Erweitere|Löse|Vereinfache|Schreib als)/, `${s} ${d}: ${t.prompt}`);
        contexts.add(opening(t.prompt));
        level.add(opening(t.prompt));
      }
      assert.ok(level.size >= 2, `${s} ${d}: only one context (${[...level].join(" | ")})`);
    }
    assert.ok(contexts.size >= 5, `${s}: only ${contexts.size} contexts (${[...contexts].join(" | ")})`);
  }
});

test("Schulbuch-Zahlen: Rechenweg and Sachaufgabe tasks check their own solution for every maths skill", () => {
  const way = (steps: string[], result = "") => JSON.stringify({ steps, result });
  const rng = seeded(41);
  for (const s of SKILLS)
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < 20; i++) {
        const t = rechenwegTask(s, d, rng);
        if (!t) {
          assert.equal(s, "mathe.brueche.erweitern", `${s} ${d}: a Rechenweg`);
          break;
        }
        assert.equal(checkOwnSolution(t), null, `${s} ${d}: ${t.data.start ?? t.prompt}`);
        assert.equal(gradeMathTask(t, way(t.solutionSteps ?? [], t.answer.accepted![0])).check.correct, true, `${s} ${d}: ${t.data.start ?? t.prompt}`);
        assert.doesNotMatch([t.prompt, t.solution, ...t.hints].join("\n"), /—| – /);
      }
      for (let i = 0; i < 10; i++) {
        const t = sachaufgabeTask(s, d, rng);
        assert.ok(t, `${s} ${d}: a Sachaufgabe`);
        assert.equal(checkOwnSolution(t), null, `${s} ${d}: ${t.prompt}`);
        const views = t.data.parts ?? [];
        const sols = t.answer.parts ?? [];
        assert.ok(views.length >= 2);
        const answer = JSON.stringify({ parts: views.map((v, k) => (v.kind === "zahl" ? { steps: [], result: sols[k]?.accepted?.[0] ?? "" } : { text: sols[k]?.sample ?? "" })) });
        const graded = gradeMathTask(t, answer);
        for (const [k, p] of (graded.parts ?? []).entries()) if (views[k].kind === "zahl") assert.equal(p.status, "richtig", `${s} ${d}: ${views[k].prompt}`);
        assert.doesNotMatch([t.prompt, ...t.hints, ...views.map((v, k) => `${v.prompt} ${sols[k]?.sample ?? ""} ${sols[k]?.solution ?? ""}`)].join("\n"), /—| – /);
      }
    }
});
