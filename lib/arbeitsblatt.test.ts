import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildSheet,
  DEFAULTS,
  optionsQuery,
  planTask,
  readOptions,
  writingLines,
  type SheetOptions,
} from "./arbeitsblatt";
import { parseMath, textBlocks } from "./math-format";
import type { TaskDraft } from "./tasks";

const task = (t: Partial<TaskDraft>): TaskDraft => ({
  type: "calc",
  skillId: "mathe.brueche.addieren",
  difficulty: "mittel",
  prompt: "",
  data: {},
  answer: {},
  solution: "",
  hints: [],
  errorMap: [],
  ...t,
});

test("maths: fractions with a bar, powers, roots and proper signs", () => {
  assert.deepEqual(parseMath("3/4 + 2/5"), [
    { t: "frac", minus: false, num: ["3"], den: ["4"] },
    " + ",
    { t: "frac", minus: false, num: ["2"], den: ["5"] },
  ]);
  assert.deepEqual(parseMath("x^2 · x^(n+1)"), [
    "x",
    { t: "sup", body: ["2"] },
    " · x",
    { t: "sup", body: ["n+1"] },
  ]);
  assert.deepEqual(parseMath("10^-3 m"), [
    "10",
    { t: "sup", body: ["−3"] },
    " m",
  ]);
  assert.deepEqual(parseMath("√(16) + sqrt(9)"), [
    { t: "root", body: ["16"] },
    " + ",
    { t: "root", body: ["9"] },
  ]);
  assert.deepEqual(parseMath("(x^2+1)/2"), [
    {
      t: "frac",
      minus: false,
      num: ["x", { t: "sup", body: ["2"] }, "+1"],
      den: ["2"],
    },
  ]);
  assert.deepEqual(parseMath("2 * 3 - 4 <= 5"), ["2 · 3 − 4 ≤ 5"]);
  // not maths: stays as written
  assert.deepEqual(parseMath("km/h und/oder, E-Mail, 20 %"), [
    "km/h und/oder, E-Mail, 20 %",
  ]);
});

test("tables written as Markdown become table blocks", () => {
  assert.deepEqual(
    textBlocks(
      "Ergänze:\n| x | 1 | 2 |\n|---|---|---|\n| 2x | ___ | ___ |\nDanach:",
    ),
    [
      { t: "text", text: "Ergänze:" },
      { t: "table", head: ["x", "1", "2"], rows: [["2x", "___", "___"]] },
      { t: "text", text: "Danach:" },
    ],
  );
  assert.equal(textBlocks("a | b").length, 1, "a single pipe is no table");
});

test("settings: defaults need no parameters, changes survive the URL", () => {
  const d = readOptions({}, "Brüche");
  assert.deepEqual(d, { ...DEFAULTS, title: "Brüche" });
  assert.equal(optionsQuery(d, "Brüche"), "");
  const changed: SheetOptions = {
    ...d,
    title: "Test",
    name: false,
    space: "gross",
    solutions: "lehrer",
    fassung: "lehrer",
    field: "liniert",
    skill: true,
  };
  const q = optionsQuery(changed, "Brüche", [["eintrag", "4"]]);
  assert.deepEqual(
    readOptions(Object.fromEntries(new URLSearchParams(q)), "Brüche"),
    changed,
  );
  // the teacher version only exists when it was chosen
  assert.equal(readOptions({ fassung: "lehrer" }, "x").fassung, "schueler");
  assert.equal(
    readOptions({ platz: "riesig", loesungen: "alle" }, "x").space,
    "mittel",
  );
});

test("room: squared field for calculations, more with more space, none when switched off", () => {
  const calc = task({
    prompt: "Berechne: 3/4 + 1/8",
    answer: { accepted: ["7/8"], mode: "value" },
  });
  const small = planTask(calc, "Mathematik", { space: "klein", field: "auto" });
  const big = planTask(calc, "Mathematik", { space: "gross", field: "auto" });
  assert.equal(small.area?.kind, "kariert");
  assert.ok(big.area!.heightMm > small.area!.heightMm);
  assert.equal(big.lines, 1);
  assert.equal(big.answerLabel, "Ergebnis:");
  assert.equal(
    planTask(calc, "Mathematik", { space: "mittel", field: "keins" }).area,
    null,
  );
  assert.equal(
    planTask(calc, "Mathematik", { space: "mittel", field: "leer" }).area?.kind,
    "leer",
  );
  // an inline gap ("Ergebnis: ___") replaces the answer line
  const inline = planTask(
    task({
      prompt: "Berechne 2 + 3.\nErgebnis: ___",
      answer: { accepted: ["5"] },
    }),
    "Mathematik",
    { space: "mittel", field: "auto" },
  );
  assert.equal(inline.lines, 0);
  assert.equal(inline.gapsMm.length, 1);
  // languages: no squared field, one answer line
  const grammar = planTask(
    task({
      type: "grammar",
      prompt: "Setze ins Präteritum: ich gehe",
      answer: { accepted: ["ich ging"] },
    }),
    "Deutsch",
    { space: "mittel", field: "auto" },
  );
  assert.equal(grammar.area, null);
  assert.equal(grammar.lines, 1);
});

test("room: coordinate system when a graph is asked for, cloze gaps sized by the answer", () => {
  const graph = planTask(
    task({
      prompt:
        "Zeichne den Graphen der Funktion f(x) = 2x − 1 in das Koordinatensystem.",
    }),
    "Mathematik",
    { space: "mittel", field: "auto" },
  );
  assert.equal(graph.area?.kind, "koordinaten");
  const cloze = planTask(
    task({
      type: "cloze",
      prompt: "Er ___ gestern ins Kino. Sie ___ müde.",
      answer: { blanks: [["ging"], ["war"]] },
    }),
    "Deutsch",
    { space: "mittel", field: "auto" },
  );
  assert.equal(cloze.gapsMm.length, 2);
  assert.equal(cloze.lines, 0);
  assert.equal(cloze.area, null);
  const long = planTask(
    task({
      type: "cloze",
      prompt: "___",
      answer: { blanks: [["Donaudampfschifffahrtsgesellschaft"]] },
    }),
    "Deutsch",
    { space: "mittel", field: "auto" },
  );
  assert.ok(long.gapsMm[0] > cloze.gapsMm[0]);
});

test("writing tasks get enough lines: from the sample answer, the kind of text and a word count", () => {
  const short = writingLines(
    {
      prompt: "Warum ist der Himmel blau?",
      answer: { sample: "Wegen der Streuung des Lichts." },
    },
    "mittel",
  );
  const essay = writingLines(
    {
      prompt: "Schreibe eine Geschichte über deinen schönsten Ferientag.",
      answer: {},
    },
    "mittel",
  );
  const words = writingLines(
    { prompt: "Write a letter to your friend (about 120 words).", answer: {} },
    "mittel",
  );
  assert.ok(short >= 2 && short <= 4, `short: ${short}`);
  assert.ok(essay >= 12, `essay: ${essay}`);
  assert.ok(words >= 14, `words: ${words}`);
  assert.ok(
    writingLines({ prompt: "Schreibe eine Geschichte.", answer: {} }, "klein") <
      essay,
  );
  assert.ok(
    writingLines(
      { prompt: "x", answer: { sample: "y".repeat(5000) } },
      "gross",
    ) <= 20,
    "never more than fits on a page",
  );
});

test("student sheet never shows teacher information; the teacher version shows all of it", async () => {
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  const tasks = [
    task({
      prompt: "Berechne: 3/4 + 1/8",
      answer: { accepted: ["7/8"] },
      solution: "Gemeinsamer Nenner 8: 6/8 + 1/8 = 7/8",
      errorMap: [{ answer: "4/12", label: "Zähler und Nenner addiert" }],
      hints: ["Suche den gemeinsamen Nenner."],
    }),
    task({
      type: "mc",
      prompt: "Welcher Bruch ist größer?",
      data: { options: ["1/2", "1/3"] },
      answer: { correct: 0 },
      errorMap: [{ answer: "1", label: "Größerer Nenner = größerer Bruch" }],
    }),
  ];
  const doc = buildSheet(
    {
      title: "Brüche",
      subject: "Mathematik",
      klasseLabel: "Mittelschule, 2. Klasse",
      topic: "Brüche",
      studentName: "Mia Muster",
      tasks,
    },
    () => "Brüche addieren",
    DEFAULTS,
  );
  const render = (o: Partial<SheetOptions>) =>
    renderToStaticMarkup(
      createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Brüche", ...o } }),
    );

  const student = render({});
  for (const hidden of [
    "Lösung",
    "Zähler und Nenner addiert",
    "Schwierigkeit",
    "Fähigkeit",
    "Typische Fehler",
    "Gemeinsamer Nenner",
    "Suche den gemeinsamen",
  ])
    assert.ok(!student.includes(hidden), `student sheet shows "${hidden}"`);
  assert.ok(student.includes("Mia Muster"));
  assert.ok(student.includes('class="frac"'), "fractions are typeset");
  assert.ok(!/3\/4/.test(student), "no 3/4 with a slash");
  // with lehrer chosen, the student sheet is still clean
  assert.ok(!render({ solutions: "lehrer" }).includes("Lösung"));

  const page = render({ solutions: "seite" });
  assert.ok(page.includes("ab-solutions"));
  for (const hidden of ["Typische Fehler", "Schwierigkeit", "Hilfe 1"])
    assert.ok(!page.includes(hidden), `solution page shows "${hidden}"`);

  const teacher = render({ solutions: "lehrer", fassung: "lehrer" });
  for (const shown of [
    "Lehrerfassung",
    "Lösung:",
    "Lösungsweg:",
    "Fähigkeit: Brüche addieren",
    "Schwierigkeit: mittel",
    "Typische Fehler:",
    "Zähler und Nenner addiert",
    "b): Größerer Nenner",
  ])
    assert.ok(teacher.includes(shown), `teacher version lacks "${shown}"`);
  assert.ok(
    !teacher.includes("Mia Muster"),
    "the teacher version has no name field",
  );
  assert.ok(
    !teacher.includes("ab-area"),
    "no squared fields in the teacher version",
  );
});
