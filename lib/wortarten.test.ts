import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type AIRequest = import("./ai/router").AIRequest;
type Draft = import("./tasks").TaskDraft;
type Wortart = import("./wortarten").Wortart;

const W = "deutsch.wortarten.bestimmen";
const sub = (w: string) => `${W}.${w}`;
const NVA = ["nomen", "verb", "adjektiv"];

/** Everything a student sees or types for a task: prompt, options, gap answers, the text to correct, hints. */
const shown = (t: Draft) => [t.prompt, ...(t.data.options ?? []), ...(t.answer.blanks ?? []).flat(), t.data.faulty ?? "", ...(t.answer.accepted ?? []), ...t.hints].join("\n");
/** The right answer in the form the solver sends it. */
const rightAnswer = (t: Draft) => (t.data.options && typeof t.answer.correct === "number" ? String(t.answer.correct) : t.answer.blanks ? JSON.stringify(t.answer.blanks.map((b) => b[0])) : (t.answer.accepted?.[0] ?? ""));

async function setup(name: string, o: { schoolType?: string; klasse?: number } = {}) {
  const repo = await import("./repo");
  const auth = await import("./auth");
  const router = await import("./ai/router");
  const builder = await import("./builder");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name, grade: 3, klasse: o.klasse ?? 3, teacher_id: niko.id, school: "", school_type: o.schoolType ?? "Volksschule", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, router, builder, niko, sid };
}

const settings = (o: Partial<import("./builder").BuilderSettings>): import("./builder").BuilderSettings => ({
  studentId: null, subject: "Deutsch", schoolType: "Volksschule", klasse: 3, skillIds: [W], difficulty: "mittel", count: 12, categories: [], focus: "", useAI: false, title: "", ...o,
});

// ---------- the bank and the settings ----------
test("the sentence bank: every sentence parses, every Wortart has sentences, the skills exist", async () => {
  const wa = await import("./wortarten");
  const { CURRICULUM } = await import("./curriculum");
  assert.ok(wa.BANK.length >= 70);
  for (const w of wa.WORTARTEN) assert.ok(wa.BANK.some((s) => s.toks.some((t) => t.wa === w)), `no sentence with ${w}`);
  for (const w of [...wa.WORTARTEN, "unterarten"]) assert.ok(CURRICULUM.some((s) => s.id === sub(w) && s.parentId === W), `skill ${sub(w)}`);
  // Grundeinstellung by Schulstufe (Lehrplan VS: Nomen, Verb, Adjektiv); the teacher's choice wins
  assert.deepEqual(wa.wortartenFor([W], 3)!.allowed, NVA);
  assert.deepEqual(wa.wortartenFor([W], 5)!.allowed, [...NVA, "artikel", "pronomen", "praeposition"]);
  assert.deepEqual(wa.wortartenFor([W], 6)!.allowed, [...wa.WORTARTEN]);
  assert.equal(wa.wortartenFor([W], 6)!.unterarten, false);
  assert.equal(wa.wortartenFor([W], 8)!.unterarten, true);
  assert.deepEqual(wa.wortartenFor([W, sub("verb"), sub("konjunktion")], 8)!.allowed, ["verb", "konjunktion"]);
  assert.equal(wa.wortartenFor([W, sub("verb"), sub("konjunktion")], 8)!.unterarten, false, "Unterarten only when chosen");
  // Aktueller Stoff „Präpositionen“ in the 4. Klasse VS: added to the Grundeinstellung
  assert.deepEqual(wa.wortartenFor([W], 4, { current: [sub("praeposition")] })!.allowed, [...NVA, "praeposition"]);
  assert.equal(wa.wortartenFor(["deutsch.grammatik.faelle"], 6), null);
  assert.equal(wa.wortartenFor(["deutsch.wortarten.nomen"], 3)!.nomenOnly, true);
});

// ---------- 1 + 2: Volksschule, Nomen/Verb/Adjektiv ----------
test("1–2. Volksschule with Nomen, Verb, Adjektiv: no task, option, gap or hint needs another Wortart", async () => {
  const { builder } = await setup("Vera Volksschule");
  const wa = await import("./wortarten");
  const other = /präposition|konjunktion|adverb(?!ial)|pronomen|artikel|verhältniswort|bindewort|umstandswort|fürwort/i;
  for (const skillIds of [[W], [W, sub("nomen"), sub("verb"), sub("adjektiv")], [sub("nomen"), sub("verb"), sub("adjektiv")]])
    for (const categories of [[], ["wortarten"], ["lueckentext"], ["korrigieren"], ["fehler"], ["mc"]])
      for (const difficulty of ["sehr leicht", "leicht", "mittel", "schwer", "sehr schwer"] as const) {
        const { tasks, source } = await builder.generateTasks(settings({ skillIds, categories, difficulty, count: 6 }), null);
        assert.equal(source, "generator");
        for (const t of tasks) {
          const where = `${skillIds.join("+")} ${categories.join() || "gemischt"} ${difficulty}: ${t.prompt}`;
          assert.ok(!other.test(shown(t)), `${where} names another Wortart: ${shown(t)}`);
          // 2: the options of a choice question are only Nomen, Verb, Adjektiv (or „kein …“)
          for (const o of t.data.options ?? []) assert.ok(/^(\S+ = )?(kein )?(Nomen|Verb|Adjektiv)$/.test(o), `${where}: option „${o}“`);
          for (const b of t.answer.blanks ?? []) assert.ok(wa.wortartenIn(b[0]).every((w) => NVA.includes(w)), `${where}: gap ${b[0]}`);
          assert.deepEqual(wa.checkWortartTask(t, wa.wortartenFor(skillIds, 3)!, t.category ?? null), { reject: [], review: [] }, where);
          // the Lernstand moves only for the chosen Wortarten
          assert.ok((t.skillIds ?? []).every((id) => !id.startsWith(`${W}.`) || NVA.includes(id.slice(W.length + 1))), `${where}: ${t.skillIds}`);
        }
      }
});

// ---------- 3 + 4: Unterstufe and advanced ----------
test("3. Unterstufe: Artikel, Pronomen, Präpositionen from the 1. Klasse, all Wortarten from the 2. Klasse, the teacher's choice is kept", async () => {
  const { builder } = await setup("Udo Unterstufe", { schoolType: "Mittelschule", klasse: 1 });
  const wa = await import("./wortarten");
  const asked = async (klasse: number, skillIds: string[]) => {
    const seen = new Set<Wortart>();
    for (let r = 0; r < 4; r++) {
      const { tasks } = await builder.generateTasks(settings({ schoolType: "Mittelschule", klasse, skillIds, count: 16 }), null);
      for (const t of tasks) for (const w of wa.wortartenIn(shown(t))) seen.add(w);
    }
    return seen;
  };
  const first = await asked(1, [W]);
  for (const w of ["artikel", "pronomen", "praeposition"] as Wortart[]) assert.ok(first.has(w), `1. Klasse practises ${w}`);
  for (const w of ["konjunktion", "adverb"] as Wortart[]) assert.ok(!first.has(w), `1. Klasse: no ${w} yet`);
  const second = await asked(2, [W]);
  for (const w of ["konjunktion", "adverb"] as Wortart[]) assert.ok(second.has(w), `2. Klasse practises ${w}`);
  const chosen = await asked(2, [W, sub("konjunktion"), sub("adverb")]);
  assert.deepEqual([...chosen].sort(), ["adverb", "konjunktion"], "only the chosen Wortarten");
});

test("4. advanced students get harder grammar, not just longer sentences: Unterarten, adverbial Adjektive, Nominalisierungen, Relativpronomen", async () => {
  const { builder } = await setup("Ada Oberstufe", { schoolType: "Gymnasium", klasse: 4 });
  const hard = /Relativpronomen|adverbial gebraucht|Hilfsverb|Modalverb|beim |Personalpronomen|Possessivpronomen|Demonstrativpronomen|Unterart|Pronomenart|bestimmter Artikel|unbestimmter Artikel/;
  const easy = await builder.generateTasks(settings({ skillIds: [W], difficulty: "leicht", count: 20 }), null);
  const adv = await builder.generateTasks(settings({ schoolType: "Gymnasium", klasse: 4, skillIds: [W], difficulty: "schwer", count: 20 }), null);
  const words = (ts: Draft[]) => ts.map((t) => (t.prompt.match(/„([^“]+)“/)?.[1] ?? "").split(/\s+/).length).reduce((a, b) => a + b, 0) / ts.length;
  assert.equal(easy.tasks.filter((t) => hard.test(`${t.prompt}\n${t.solution}\n${(t.data.options ?? []).join(" ")}`)).length, 0, "Volksschule leicht: no hard grammar");
  assert.ok(adv.tasks.filter((t) => hard.test(`${t.prompt}\n${t.solution}\n${(t.data.options ?? []).join(" ")}`)).length >= 4, "8. Schulstufe schwer: hard grammar in many tasks");
  assert.ok(adv.tasks.some((t) => /pronomen|artikel|verb/i.test((t.data.options ?? []).join(" ")) && (t.data.options ?? []).some((o) => /Personal|Possessiv|Relativ|Demonstrativ|bestimmt|Hilfs|Modal|Voll/.test(o))), "an Unterart question");
  assert.ok(words(adv.tasks) > words(easy.tasks), "longer sentences too");
});

// ---------- 5 + 6: real tasks, concrete solutions ----------
test("5–6. every task is a real determination task with a concrete, complete solution; only „Freie Antwort“ asks for an explanation, with a sample", async () => {
  const { builder } = await setup("Lukas Lösung", { schoolType: "Mittelschule", klasse: 2 });
  const wa = await import("./wortarten");
  const { checkAnswer } = await import("./tasks");
  const formats = new Set<string>();
  for (const [schoolType, klasse] of [["Volksschule", 3], ["Mittelschule", 2], ["Gymnasium", 4]] as const)
    for (const categories of [[], ["wortarten"], ["lueckentext"], ["korrigieren"], ["fehler"], ["mc"], ["offen"]]) {
      const { tasks } = await builder.generateTasks(settings({ schoolType, klasse, categories, count: 8 }), null);
      for (const t of tasks) {
        const where = `${schoolType} ${klasse} ${categories.join() || "gemischt"}: ${t.prompt}`;
        formats.add(t.type);
        assert.equal(builder.checkTask(t), null, where);
        assert.ok(!wa.isPlaceholder(t.solution) && !wa.isPlaceholder(t.answer.sample), `${where}: placeholder`);
        assert.ok(!/eine passende antwort|eine korrekte erklärung|ein eigenes beispiel|individuelle schülerlösung/i.test(`${t.solution}\n${t.answer.sample ?? ""}`), where);
        if (categories[0] === "offen") {
          // explanation only when asked for, with a worked sample and criteria
          assert.equal(t.type, "free", where);
          assert.ok((t.answer.sample ?? "").length >= 30 && /„[^“]+“| = /.test(t.answer.sample!), `${where}: sample ${t.answer.sample}`);
          assert.ok((t.answer.criteria ?? []).length >= 2, where);
          continue;
        }
        assert.notEqual(t.type, "free", `${where}: free answer in a determination type`);
        assert.ok(!/^(erkläre|beschreibe|was ist|was sind|wie erkennt)/im.test(t.prompt), `${where}: explanation question`);
        // the solution names every asked word with its Wortart („kleine = Adjektiv“)
        assert.match(t.solution, /\S+ = \S+|^(Nomen|Verben?|Adjektiv(e)?|Artikel|Pronomen|Präposition(en)?|Konjunktion(en)?|Adverb(ien)?): /m, `${where}: ${t.solution}`);
        assert.equal(checkAnswer(t, rightAnswer(t)).correct, true, `${where}: rejects its own answer ${rightAnswer(t)}`);
      }
    }
  for (const f of ["cloze", "mc", "fix", "free"]) assert.ok(formats.has(f), `format ${f} used`);
  // the explanation task of before („Erkläre in eigenen Worten, wie man bei … vorgeht“) does not come any more
  const { generateForSlot } = await import("./generators");
  for (let v = 0; v < 6; v++) {
    const t = generateForSlot({ skillId: W, skillName: "Wortarten bestimmen", difficulty: "mittel", category: null, subject: "Deutsch", grade: 3 }, Math.random, v);
    assert.ok(!/Erkläre in eigenen Worten|Erfinde eine eigene Aufgabe|Welcher Fehler passiert/.test(t.prompt), t.prompt);
  }
});

test("a gap accepts the school names of a Wortart; the example from the task works", async () => {
  const wa = await import("./wortarten");
  const { checkAnswer } = await import("./tasks");
  const setting = wa.wortartenFor([W], 3)!;
  const t = wa.widenNames({ type: "cloze", skillId: W, difficulty: "leicht", prompt: "Bestimme die Wortarten.\n„Der kleine Hund schläft.“\nkleine: ___\nHund: ___\nschläft: ___", data: {}, answer: { blanks: [["Adjektiv"], ["Nomen"], ["Verb"]], mode: "text" }, solution: "kleine = Adjektiv\nHund = Nomen\nschläft = Verb", hints: [], errorMap: [] });
  assert.deepEqual(wa.checkWortartTask(t, setting, "wortarten"), { reject: [], review: [] });
  assert.equal(checkAnswer(t, JSON.stringify(["Eigenschaftswort", "Namenwort", "Tunwort"])).correct, true);
  assert.equal(checkAnswer(t, JSON.stringify(["adjektiv", "nomen", "verb"])).correct, true);
  assert.deepEqual(checkAnswer(t, JSON.stringify(["Adverb", "Nomen", "Verb"])).wrongGaps, [1]);
});

// ---------- 7: Adverb or Adjektiv ----------
test("7. wrong Adverb/Adjektiv assignments are rejected, doubtful ones go to the teacher", async () => {
  const wa = await import("./wortarten");
  const all = wa.wortartenFor([W], 6)!;
  const mc = (sentence: string, word: string, options: string[], correct: number): Draft => ({ type: "mc", skillId: W, difficulty: "mittel", prompt: `Welche Wortart hat das Wort in eckigen Klammern?\n„${sentence.replace(word, `[${word}]`)}“`, data: { options }, answer: { correct }, solution: `${word} = ${options[correct]}`, hints: [], errorMap: [] });
  const opts = ["Adjektiv", "Adverb", "Verb", "Nomen"];
  assert.match(wa.checkWortartTask(mc("Er läuft schnell.", "schnell", opts, 1), all, "wortarten").reject.join(), /„schnell“ ist ein Adjektiv \(adverbial gebraucht\), kein Adverb/);
  assert.deepEqual(wa.checkWortartTask(mc("Er läuft schnell.", "schnell", opts, 0), all, "wortarten").reject, []);
  assert.match(wa.checkWortartTask(mc("Wir spielen gern Fußball.", "gern", opts, 0), all, "wortarten").reject.join(), /„gern“ ist ein Adverb, kein Adjektiv/);
  assert.deepEqual(wa.checkWortartTask(mc("Wir spielen gern Fußball.", "gern", opts, 1), all, "wortarten").reject, []);
  // a gap text and a solution line say the same
  const cloze: Draft = { type: "cloze", skillId: W, difficulty: "mittel", prompt: "Bestimme die Wortarten.\n„Sie singt laut.“\nsingt: ___\nlaut: ___", data: {}, answer: { blanks: [["Verb"], ["Adverb"]], mode: "text" }, solution: "singt = Verb, laut = Adverb", hints: [], errorMap: [] };
  assert.match(wa.checkWortartTask(cloze, all, "wortarten").reject.join(), /„laut“ ist ein Adjektiv/);
  // a word the app does not know called Adverb, or a known word with another Wortart: the teacher decides
  assert.match(wa.checkWortartTask(mc("Er antwortet flugs.", "flugs", opts, 1), all, "wortarten").review.join(), /„flugs“ ein Adverb oder ein adverbial gebrauchtes Adjektiv/);
  assert.match(wa.checkWortartTask(mc("Der kleine Hund bellt.", "kleine", opts, 3), all, "wortarten").review.join(), /Ist „kleine“ hier wirklich ein Nomen\?/);
  // the generator's own tasks explain the adverbial Adjektiv instead of calling it an Adverb
  const tasks = Array.from({ length: 200 }, (_, v) => wa.wortartenTask({ skillId: W, setting: wa.wortartenFor([W], 8)!, difficulty: v % 2 ? "schwer" : "sehr schwer", category: null, variant: v }));
  const adverbial = tasks.filter((t) => /adverbial gebraucht/.test(t.solution));
  assert.ok(adverbial.length > 0, "adverbial Adjektive are practised at a high level");
  for (const t of adverbial) assert.ok(!/(schnell|langsam|laut|leise|sorgfältig|gründlich|vorsichtig) = Adverb/.test(t.solution), t.solution);
});

// ---------- the AI: checked by the app, whatever the provider ----------
const AI_BASE = {
  topic: "Wortarten", difficulty: "mittel", passage: null, options: null, correct_option: null, accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null, case_sensitive: false,
  faulty_text: null, corrected_text: null, text_errors: null, answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["Jedes Wort richtig bestimmt."],
  solution_steps: [], estimated_time_sec: 60, hints: ["Setz „der, die, das“ davor."], common_errors: [],
};
const aiTask = (o: Record<string, unknown> & { prompt: string }) => ({ ...AI_BASE, category: "wortarten", skill_ids: [W], ...o });
const GOOD = aiTask({ format: "cloze", prompt: "Bestimme die Wortarten.\n„Die müde Katze schläft.“\nmüde: ___\nKatze: ___\nschläft: ___", blanks: [["Adjektiv"], ["Nomen"], ["Verb"]], solution: "müde = Adjektiv, Katze = Nomen, schläft = Verb" });
const DOUBT = aiTask({ format: "cloze", prompt: "Bestimme die Wortart.\n„Der kleine Hund bellt.“\nkleine: ___", blanks: [["Nomen"]], solution: "kleine = Nomen" });
const BAD = [
  aiTask({ format: "mc", prompt: "Welche Wortart hat das Wort in eckigen Klammern?\n„Er läuft [schnell].“", options: ["Nomen", "Verb", "Adjektiv", "Adverb"], correct_option: 3, solution: "schnell = Adverb" }),
  aiTask({ format: "free", category: "offen", prompt: "Erkläre, was ein Nomen ist.", sample_answer: "Eine passende Antwort.", solution: "Individuelle Schülerlösung" }),
  aiTask({ format: "grammar", prompt: "Was ist ein Verb? Erkläre in einem Satz.", accepted_answers: ["Ein Tunwort"], solution: "Ein Tunwort" }),
  aiTask({ format: "mc", prompt: "Welche Wortart hat das Wort in eckigen Klammern?\n„Die Ente schwimmt [auf] dem Teich.“", options: ["Nomen", "Präposition", "Verb"], correct_option: 1, solution: "auf = Präposition" }),
];

test("7 + KI: the app checks every Wortarten task of the KI; rejected ones are made again or by the generator, doubtful ones wait for the teacher", async () => {
  const { builder, router, repo, niko, sid } = await setup("Kim KI");
  const calls: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (r: AIRequest) => {
    calls.push(r);
    // first round: two usable tasks and four bad ones; then only bad ones
    const tasks = calls.length === 1 ? [GOOD, DOUBT, ...BAD] : BAD;
    return { parsed: { tasks }, refusal: false, model: r.model, usage: { input: 1000, output: 900, cacheWrite: 0, cacheRead: 0 } };
  });
  const { id, aiError } = await builder.createDraft(settings({ studentId: sid, categories: ["wortarten"], count: 6, useAI: true }), niko.id);
  router.setTransport(null);
  assert.equal(calls.length, 2, "what did not pass is asked for once more");
  const prompt = String(calls[0].content);
  assert.match(prompt, /Erlaubte Wortarten: Nomen, Verb, Adjektiv\. Andere Wortarten \(Artikel, Pronomen, Präposition, Konjunktion, Adverb\)/);
  assert.match(prompt, /keine Adverbien/);
  assert.match(prompt, /nie Platzhalter/i);
  assert.ok(!prompt.includes("Kim"), "no name leaves the app");
  const tasks = repo.listTasks(id);
  assert.equal(tasks.length, 6);
  const prompts = tasks.map((t) => t.prompt);
  assert.ok(prompts.includes(GOOD.prompt as string));
  for (const b of BAD) assert.ok(!prompts.includes(b.prompt as string), `rejected: ${b.prompt}`);
  assert.equal(tasks.filter((t) => t.sourceType === "ki").length, 2);
  assert.equal(tasks.filter((t) => t.sourceType === "eigen").length, 4, "the rest from the generator");
  assert.ok(aiError, "the teacher learns that tasks were made without KI");
  // the KI's gap answers accept the school names; the Lernstand moves for each asked Wortart
  const good = tasks.find((t) => t.prompt === GOOD.prompt)!;
  assert.ok(good.answer.blanks![0].includes("Eigenschaftswort"));
  for (const w of NVA) assert.ok(good.skillIds!.includes(sub(w)), `${sub(w)} tracked`);
  // the doubtful task: shown to the teacher, blocks sending until checked
  const doubt = tasks.find((t) => t.prompt === DOUBT.prompt)!;
  assert.match(doubt.data.pruefen!.join(), /Ist „kleine“ hier wirklich ein Nomen\? Bekannt als Adjektiv/);
  assert.match(builder.checkTask(doubt) ?? "", /^Bitte prüfen: Ist „kleine“/);
  assert.match(builder.releaseWorksheet(id, sid).error ?? "", /Bitte prüfen/);
  // the teacher corrects it in the editor: saved = checked
  const { pruefen: _p, ...data } = doubt.data;
  void _p;
  repo.updateTask(doubt.id, { ...doubt, data, answer: { ...doubt.answer, blanks: [["Adjektiv"]] }, solution: "kleine = Adjektiv" });
  assert.equal(builder.releaseWorksheet(id, sid).error, undefined);
});

test("a placeholder sample answer is rejected for every skill, and the generic explanation task has none", async () => {
  const { aiTaskToDraft } = await import("./ai");
  const { categoriesFor } = await import("./curriculum");
  const { generateForSlot } = await import("./generators");
  const builder = await import("./builder");
  const offen = categoriesFor("Mathematik").find((c) => c.key === "offen")!;
  const req = { subject: "Mathematik", skills: [{ id: "mathe.brueche.kuerzen", name: "Kürzen", area: "Brüche", difficulty: "mittel" as const }], categories: [] };
  const free = (sample: string) => aiTaskToDraft({ ...AI_BASE, category: "offen", skill_ids: ["mathe.brueche.kuerzen"], format: "free", prompt: "Erkläre, wie man kürzt.", sample_answer: sample, solution: sample } as never, req, Math.random, offen);
  for (const p of ["Eine passende Antwort.", "Eine korrekte Erklärung mit einem passenden Beispiel.", "Ein eigenes Beispiel", "Individuelle Schülerlösung", "Antworten können variieren."]) assert.equal(free(p), null, p);
  assert.ok(free("Man dividiert Zähler und Nenner durch dieselbe Zahl: 6/8 = 3/4 (beide durch 2)."));
  assert.match(builder.checkTask({ type: "free", skillId: "x", difficulty: "mittel", prompt: "Erkläre …", data: {}, answer: { sample: "Eine passende Antwort." }, solution: "", hints: [], errorMap: [] }) ?? "", /Platzhalter/);
  // a skill without a stored explanation: criteria instead of an invented sample
  const t = generateForSlot({ skillId: "englisch.translation.sentences", skillName: "Sätze übersetzen", difficulty: "mittel", category: "offen", subject: "Englisch" }, Math.random, 0);
  assert.equal(t.answer.sample, undefined);
  assert.ok(t.answer.criteria!.length >= 2);
  assert.equal(builder.checkTask(t), null, "complete: the teacher grades by the criteria");
});

// ---------- 8: the rest still works ----------
test("8. builder → released → solved on the device (tablet and laptop send the same answer) → Lernstand per Wortart; A4 for student and teacher", async () => {
  const { builder, repo, niko, sid } = await setup("Paula Praxis", { schoolType: "Volksschule", klasse: 4 });
  const { submitAnswer, analyzeStudent } = await import("./service");
  const { id } = await builder.createDraft(settings({ studentId: sid, klasse: 4, skillIds: [W, sub("nomen"), sub("verb"), sub("adjektiv")], count: 8 }), niko.id);
  const out = builder.releaseWorksheet(id, sid);
  assert.equal(out.error, undefined);
  const tasks = repo.listTasks(id);
  const student = repo.getStudent(sid)!;
  for (const t of tasks) {
    if (t.type === "free") continue;
    const r = await submitAnswer({ token: student.access_token, assignmentId: out.assignmentId!, taskId: t.id, answer: rightAnswer(t), timeMs: 30_000, hintsUsed: 0 });
    assert.equal(r.correct, true, `${t.prompt}: ${rightAnswer(t)}`);
  }
  const a = analyzeStudent(sid)!;
  for (const w of NVA) assert.ok((a.skills.find((s) => s.skill.id === sub(w))?.mastery ?? 0) > 0, `Lernstand ${sub(w)}`);
  assert.ok((a.skills.find((s) => s.skill.id === W)?.mastery ?? 0) > 0, "Lernstand Wortarten bestimmen");

  // A4: the student sheet has the gaps but no solution, the teacher sheet the concrete solution
  const { buildSheet, DEFAULTS } = await import("./arbeitsblatt");
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  const doc = buildSheet({ title: "Wortarten", subject: "Deutsch", klasseLabel: "VS, 4. Klasse", topic: "Wortarten", studentName: null, tasks }, (x) => x, DEFAULTS);
  const render = (fassung: "schueler" | "lehrer") => renderToStaticMarkup(createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Wortarten", fassung } }));
  const sheet = render("schueler");
  const teacher = render("lehrer");
  const line = tasks.filter((t) => t.type === "cloze" || t.type === "mc").map((t) => t.solution.split("\n")[0]).find((l) => / = /.test(l) && !tasks.some((t) => `${t.prompt}\n${t.data.faulty ?? ""}`.includes(l)))!;
  assert.ok(!sheet.includes(line), `student sheet shows the solution ${line}`);
  assert.ok(teacher.includes(line.replace("„", "&quot;")) || teacher.includes(line), `teacher sheet lacks ${line}`);
  assert.equal(sheet.split('class="ab-num"').length - 1, tasks.length);
});
