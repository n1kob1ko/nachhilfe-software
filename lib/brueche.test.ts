import assert from "node:assert/strict";
import test from "node:test";
import { splitFractions } from "./math-text";
import { solutionTemplate, tasksTemplate } from "./whiteboard-templates";

const fractions = (s: string) => splitFractions(s).filter((p) => typeof p !== "string");

test("Brüche werden erkannt", () => {
  assert.deepEqual(splitFractions("Rechne 3/4 + 1/8"), ["Rechne ", { minus: false, num: "3", den: "4" }, " + ", { minus: false, num: "1", den: "8" }]);
  assert.deepEqual(fractions("-5/8 · 2"), [{ minus: true, num: "5", den: "8" }]);
  assert.deepEqual(fractions("x/2 = 4"), [{ minus: false, num: "x", den: "2" }]);
  assert.deepEqual(fractions("(a+b)/2"), [{ minus: false, num: "a+b", den: "2" }]);
  assert.deepEqual(fractions("12/(x-1)"), [{ minus: false, num: "12", den: "x-1" }]);
  assert.deepEqual(fractions("Ist 2/3 größer?"), [{ minus: false, num: "2", den: "3" }]);
});

test("Schrägstriche ohne Bruch bleiben stehen", () => {
  for (const s of ["und/oder", "km/h", "0,5/2", "1/2/3", "Seite 12/a3", "er/sie"]) assert.deepEqual(splitFractions(s), [s], s);
  assert.deepEqual(splitFractions(""), []);
});

const measure = (s: string, size: number) => s.length * size * 0.5;

test("Whiteboard zeichnet Brüche mit Bruchstrich", () => {
  const els = tasksTemplate([{ number: 1, prompt: "Kürze 6/8", options: [] }], { x: 0, y: 0 }, { measure });
  const texts = els.filter((e) => e.type === "text").map((e) => e.text);
  assert.ok(texts.includes("6") && texts.includes("8"), JSON.stringify(texts));
  assert.ok(!texts.some((t) => String(t).includes("6/8")));
  const bar = els.find((e) => e.type === "line");
  assert.ok(bar, "Bruchstrich fehlt");
  const num = els.find((e) => e.type === "text" && e.text === "6")!;
  const den = els.find((e) => e.type === "text" && e.text === "8")!;
  assert.ok(Number(num.y) < Number(bar.y) && Number(bar.y) < Number(den.y), "Zähler über dem Strich, Nenner darunter");
  // the work area starts below the fraction
  const area = els.find((e) => e.type === "rectangle")!;
  assert.ok(Number(area.y) > Number(den.y));
});

test("Ohne Messfunktion und ohne Brüche bleibt der Text ein Stück", () => {
  assert.equal(tasksTemplate([{ number: 1, prompt: "Kürze 6/8", options: [] }], { x: 0, y: 0 }).filter((e) => e.type === "text").length, 1);
  assert.equal(tasksTemplate([{ number: 1, prompt: "Rechne 3 + 4", options: [] }], { x: 0, y: 0 }, { measure }).filter((e) => e.type === "text").length, 1);
  const sol = solutionTemplate({ number: 2, prompt: "", options: [], solution: "3/4" }, { x: 0, y: 0 }, measure);
  assert.ok(sol.some((e) => e.type === "line" && e.strokeColor === "#15803d"));
});
