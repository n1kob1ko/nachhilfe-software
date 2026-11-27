import assert from "node:assert/strict";
import test from "node:test";
import { generateBuiltIn, istErklaerVorlage } from "./generators";
import { hatQuiz } from "./lernspiele-quiz";
import { checkAnswer } from "./tasks";
import { THEMEN } from "./themen";

/** Simulation 27.11.2026: ohne KI kam zu „Halbschriftlich multiplizieren“ (Volksschule) nur „Erfinde eine eigene Aufgabe …“. */
test("ohne eigenen Generator: Aufgaben aus dem Quiz des Fachs, lösbar und von der App geprüft", () => {
  const t = generateBuiltIn({ subject: "Mathematik", skills: [{ id: "mathe.vs.muldiv.halbschriftlich", name: "Halbschriftlich multiplizieren und dividieren" }], difficulty: "mittel", count: 8, taskType: "mixed", grade: 3, seed: 7 });
  assert.equal(t.length, 8);
  assert.ok(t.every((x) => x.type === "mc" || x.type === "cloze"));
  assert.ok(t.some((x) => x.type === "cloze"), "eine Zahl als Lücke wird auch getippt");
  for (const x of t) {
    const richtig = x.type === "mc" ? String(x.answer.correct) : JSON.stringify(x.answer.blanks!.map((b) => b[0]));
    assert.equal(checkAnswer(x, richtig).correct, true, x.prompt);
    assert.ok(!istErklaerVorlage(x.prompt));
    assert.ok(x.hints.every((h) => !h.includes(x.type === "mc" ? x.data.options![x.answer.correct!] : x.answer.blanks![0][0])), "der Denkanstoß verrät das Ergebnis nicht");
  }
});

test("Multiple Choice nur gewählt, Freitext bleibt die Vorlage", () => {
  const skills = [{ id: "mathe.teilbarkeit.primzahlen", name: "Primzahlen" }];
  const mc = generateBuiltIn({ subject: "Mathematik", skills, difficulty: "mittel", count: 5, taskType: "mc", grade: 6, seed: 1 });
  assert.ok(mc.length > 0 && mc.every((x) => x.type === "mc"));
  const frei = generateBuiltIn({ subject: "Mathematik", skills, difficulty: "mittel", count: 2, taskType: "free", grade: 6, seed: 1 });
  assert.ok(frei.every((x) => x.type === "free"));
});

test("fast jedes Thema des Lehrplans mit Quizfragen bekommt ohne KI echte Aufgaben", () => {
  const ids: { id: string; name: string }[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(walk);
    const o = x as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.name === "string" && /^(mathe|deutsch|englisch)\./.test(o.id)) ids.push({ id: o.id, name: o.name });
    Object.values(o).forEach(walk);
  };
  walk(THEMEN);
  const mitQuiz = [...new Map(ids.map((s) => [s.id, s])).values()].filter((s) => hatQuiz(s.id));
  const nurVorlagen = mitQuiz.filter((s) => {
    const fach = s.id.startsWith("mathe") ? "Mathematik" : s.id.startsWith("deutsch") ? "Deutsch" : "Englisch";
    return generateBuiltIn({ subject: fach, skills: [s], difficulty: "mittel", count: 6, taskType: "mixed", grade: 7, seed: 1 }).every((x) => x.type === "free");
  });
  assert.ok(nurVorlagen.length <= 15, `nur Vorlagen: ${nurVorlagen.map((s) => s.id).join(", ")}`);
});
