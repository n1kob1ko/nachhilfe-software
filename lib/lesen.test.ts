import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type AIRequest = import("./ai/router").AIRequest;
type Draft = import("./tasks").TaskDraft;

// ---------- a reading text (written for these tests) ----------
const TITLE = "Das Fundstück im Keller";
const P = [
  "Als Mira am Samstagmorgen in den Keller hinunterging, wollte sie eigentlich nur ihr altes Fahrrad holen. Der Frühling war endlich gekommen, und sie hatte ihrer Freundin Jana versprochen, mit ihr zum Badesee zu fahren. Doch hinter dem Fahrrad, zwischen verstaubten Kartons, entdeckte sie eine kleine Holzkiste mit einem rostigen Schloss.",
  "Neugierig trug Mira die Kiste nach oben in die Küche. Ihr Großvater saß dort bei seinem Kaffee und las die Zeitung. Als er die Kiste sah, legte er die Zeitung langsam zur Seite. „Die habe ich seit fünfzig Jahren nicht mehr gesehen“, sagte er leise. Seine Stimme klang ganz anders als sonst.",
  "Der Großvater erzählte, dass er die Kiste als Bub von seinem eigenen Vater bekommen hatte. Damals wohnte die Familie in einem kleinen Dorf in den Bergen. Weil das Geld knapp war, bekam er zum Geburtstag keine Spielsachen, sondern diese Kiste, die sein Vater selbst geschnitzt hatte. Darin hatte er seine wertvollsten Schätze aufbewahrt: Murmeln, einen Kompass und Briefe von seinem besten Freund.",
  "Mira wollte die Kiste sofort öffnen, aber der Schlüssel fehlte. Gemeinsam suchten sie in allen Schubladen. Der Großvater wirkte dabei unruhig, fast ein bisschen ängstlich. Schließlich fand Mira einen winzigen Schlüssel in einer Blechdose voller Knöpfe. Er passte. Mit einem leisen Klicken sprang das Schloss auf.",
  "In der Kiste lagen tatsächlich drei Murmeln, ein Kompass mit gesprungenem Glas und ein Bündel vergilbter Briefe. Der Großvater nahm den obersten Brief heraus und begann zu lesen. Nach einer Weile lächelte er und wischte sich mit dem Handrücken über die Augen. Der Brief war von Toni, seinem Freund aus dem Dorf, der später nach Kanada ausgewandert war.",
  "Mira vergaß den Badesee völlig. Sie rief Jana an und sagte ab. Den ganzen Nachmittag saß sie neben ihrem Großvater und hörte seinen Geschichten zu. Am Abend fragte sie ihn, ob sie gemeinsam versuchen könnten, Toni zu finden. Der Großvater zögerte kurz, dann nickte er. „Vielleicht ist es noch nicht zu spät“, meinte er.",
];
const TEXT = P.join("\n\n");

type Q = Record<string, unknown>;
const q = (aspect: string, format: string, prompt: string, o: Q = {}): Q => ({
  aspect, format, prompt, sample_answer: null, criteria: [], several_answers_right: false, evidence: [], gap_text: null, options: null, correct_option: null, answer_lines: null, hint: null, ...o,
});
/** What a good KI answers for this text: one question per aspect (two for info). */
const POOL: Record<string, Q[]> = {
  info: [
    q("info", "lueckentext", "Ergänze die Lücken mit Wörtern aus dem Text.", { gap_text: "Schließlich fand Mira einen winzigen [[Schlüssel]] in einer Blechdose voller [[Knöpfe]].", evidence: [{ paragraph: 4, quote: "Schließlich fand Mira einen winzigen Schlüssel in einer Blechdose voller Knöpfe." }] }),
    q("info", "offen", "Was findet Mira in der Kiste?", { sample_answer: "Drei Murmeln, einen Kompass und alte Briefe.", criteria: ["nennt Murmeln, Kompass und Briefe"], evidence: [{ paragraph: 5, quote: "In der Kiste lagen tatsächlich drei Murmeln, ein Kompass mit gesprungenem Glas und ein Bündel vergilbter Briefe." }] }),
  ],
  zusammenhang: [q("zusammenhang", "offen", "Warum bekam der Großvater als Kind eine selbst geschnitzte Kiste statt Spielsachen?", { sample_answer: "Weil seine Familie wenig Geld hatte.", criteria: ["nennt das fehlende Geld als Grund"], evidence: [{ paragraph: 3, quote: "Weil das Geld knapp war, bekam er zum Geburtstag keine Spielsachen" }] })],
  wort: [q("wort", "offen", "Was bedeutet das Wort „vergilbt“ in Abschnitt 5?", { sample_answer: "Alt und gelblich geworden.", criteria: ["erklärt die Bedeutung (alt, gelb geworden)"], evidence: [{ paragraph: 5, quote: "ein Bündel vergilbter Briefe" }], answer_lines: 2 })],
  beleg: [q("beleg", "offen", "Welche Stelle im Text zeigt, dass der Großvater beim Anblick der Kiste gerührt ist? Schreibe sie ab.", { sample_answer: "„Seine Stimme klang ganz anders als sonst.“", criteria: ["zitiert eine passende Stelle aus Abschnitt 2"], evidence: [{ paragraph: 2, quote: "Seine Stimme klang ganz anders als sonst." }] })],
  schluss: [q("schluss", "offen", "Warum wirkt der Großvater bei der Suche nach dem Schlüssel unruhig? Stelle eine Vermutung an.", { sample_answer: "Er hat Angst vor den Erinnerungen an seinen Freund.", criteria: ["Vermutung passt zum Text", "begründet mit einer Textstelle"], several_answers_right: true, evidence: [{ paragraph: 4, quote: "Der Großvater wirkte dabei unruhig, fast ein bisschen ängstlich." }] })],
  zusammenfassen: [q("zusammenfassen", "offen", "Fasse den fünften Abschnitt in zwei bis drei Sätzen zusammen.", { sample_answer: "In der Kiste liegen Murmeln, ein Kompass und Briefe. Der Großvater liest einen Brief von seinem Freund Toni und ist gerührt.", criteria: ["Inhalt der Kiste", "Brief von Toni"] })],
  begruenden: [q("begruenden", "offen", "Findest du es richtig, dass Mira den Ausflug mit Jana absagt? Begründe deine Meinung.", { sample_answer: "Ja, weil der Nachmittag mit dem Großvater etwas Besonderes ist.", criteria: ["eigene Meinung", "Begründung mit dem Text"], several_answers_right: true })],
};

/** The choice question when the plan asks for multiple choice. */
const MC = q("zusammenhang", "mc", "Warum bekam der Großvater zum Geburtstag keine Spielsachen?", {
  options: ["Weil er keine Spielsachen mochte.", "Weil das Geld knapp war.", "Weil sein Vater Spielsachen verboten hat."],
  correct_option: 1,
  evidence: [{ paragraph: 3, quote: "Weil das Geld knapp war, bekam er zum Geburtstag keine Spielsachen" }],
});

const MC_INFO = q("info", "mc", "Was ist am Kompass in der Kiste kaputt?", {
  options: ["Die Nadel", "Das Glas", "Der Deckel"],
  correct_option: 1,
  evidence: [{ paragraph: 5, quote: "ein Kompass mit gesprungenem Glas" }],
});

/** A stand-in for the KI: a text when asked for one, the questions of the plan when asked for questions. */
function fakeKI(o: { calls?: AIRequest[]; mutate?: (qs: Q[], call: number) => Q[]; fail?: boolean } = {}) {
  let questionCalls = 0;
  return async (req: AIRequest) => {
    o.calls?.push(req);
    if (o.fail) throw new Error("Netzwerk weg");
    const prompt = String(req.content);
    let data: unknown;
    if (/Schreibe einen Lesetext/.test(prompt)) data = { title: TITLE, paragraphs: P };
    else {
      const plan = [...prompt.matchAll(/^(\d+)\. aspect=(\w+) \([^)]*\), format=(\w+)/gm)].map((m) => ({ slot: Number(m[1]), aspect: m[2], format: m[3] }));
      const taken: Record<string, number> = {};
      let qs: Q[] = plan.map((p): Q => {
        const list = POOL[p.aspect];
        const pick = list[Math.min(list.length - 1, (taken[p.aspect] = (taken[p.aspect] ?? -1) + 1))];
        return p.format === "mc" ? { ...(p.aspect === "info" ? MC_INFO : MC), slot: p.slot } : { ...pick, slot: p.slot };
      });
      qs = o.mutate ? o.mutate(qs, questionCalls) : qs;
      questionCalls++;
      data = { questions: qs };
    }
    return { parsed: data, refusal: false, model: req.model, usage: { input: 1500, output: 1200, cacheWrite: 0, cacheRead: 0 } };
  };
}

async function setup(name = "Max Muster") {
  const repo = await import("./repo");
  const auth = await import("./auth");
  const router = await import("./ai/router");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name, grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, router, niko, sid };
}

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ subject: "Deutsch", school_type: "Mittelschule", klasse: "2", count: "8", difficulty: "mittel", ...o })) f.set(k, v);
  return f;
};

// ---------- 1: own text, no KI ----------
test("1. own text without KI: one exercise, the text shared by 8 questions, every kind of question, the cloze from the text", async () => {
  const { repo, sid, niko, router } = await setup("Eigen Text");
  router.setTransport(null);
  const { createReadingDraft, readingSettingsFromForm } = await import("./lesen-draft");
  const { readingSet, readingIssues, ASPECT_KEYS, wordCount } = await import("./lesen");
  const s = readingSettingsFromForm(form({ student_id: String(sid), text_source: "eigen", title: TITLE, text: TEXT, questions: "ki" }));
  const out = await createReadingDraft(s, niko.id);
  assert.ok(out.id, JSON.stringify(out));
  assert.equal(out.warning, undefined, "without KI the questions come from templates, nothing failed");
  const w = repo.getWorksheet(out.id!)!;
  assert.equal(w.status, "entwurf", "the teacher checks it before it is sent");
  assert.equal(w.title, "Eigen – Leseverständnis: Das Fundstück im Keller");
  const tasks = repo.listTasks(w.id);
  assert.equal(tasks.length, 8);
  assert.deepEqual(readingSet(tasks), { title: TITLE, text: TEXT }, "one text for all questions, not 8 copies to edit");
  assert.ok(wordCount(TEXT) > 300, "a text of Unterstufe length");
  const aspects = new Set(tasks.map((t) => t.data.aspect));
  assert.deepEqual([...aspects].sort(), [...ASPECT_KEYS].sort(), "all seven kinds of questions");
  assert.ok(tasks.every((t) => t.skillId === `deutsch.text.verstehen.${t.data.aspect}`));
  const cloze = tasks.find((t) => t.type === "cloze")!;
  assert.ok(cloze, "one Lückentext");
  assert.equal(tasks.filter((t) => t.data.options).length, 0, "no multiple choice by default");
  assert.deepEqual(readingIssues(cloze, TEXT, tasks), [], "the cloze sentence is word for word from the text");
  const wort = tasks.find((t) => t.data.aspect === "wort")!;
  const quoted = wort.prompt.match(/„([^“]+)“/)![1];
  assert.ok(TEXT.includes(quoted), `the word to explain is in the text: ${quoted}`);
  assert.ok(new Set(tasks.map((t) => t.prompt)).size === 8, "no question twice");
  assert.equal(JSON.parse(w.settings!).lesen.questions, "vorlage");
});

// ---------- 2 + 3: the KI writes the text and the questions ----------
test("2–3. KI: a coherent text in paragraphs and 8 different questions with sample answers and Belege; no names are sent", async () => {
  const { repo, sid, niko, router } = await setup("Max Geheim");
  const calls: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(fakeKI({ calls }));
  const { createReadingDraft, readingSettingsFromForm } = await import("./lesen-draft");
  const { readingSet, readingIssues, paragraphsOf, similarity, SIMILAR } = await import("./lesen");
  const s = readingSettingsFromForm(form({ student_id: String(sid), text_source: "ki", topic: "Ein altes Geheimnis", text_type: "erzaehlung", words: "450", questions: "ki" }));
  const out = await createReadingDraft(s, niko.id);
  assert.ok(out.id, JSON.stringify(out));
  assert.equal(out.warning, undefined);
  assert.equal(calls.length, 2, "one call for the text, one for the questions");
  for (const c of calls) assert.ok(!JSON.stringify(c.content).includes("Max") && !JSON.stringify(c.content).includes("Geheim\""), "the KI never gets the student's name");
  assert.match(calls[0].system, /übernimm keine Texte/, "no copied texts");
  assert.match(String(calls[0].content), /ungefähr 450 Wörter/);
  assert.match(String(calls[1].content), /^\[3\] Der Großvater erzählte/m, "the questions are asked about the numbered paragraphs");

  const w = repo.getWorksheet(out.id!)!;
  assert.equal(w.source, "ki");
  const tasks = repo.listTasks(w.id);
  const r = readingSet(tasks)!;
  assert.equal(r.title, TITLE);
  assert.equal(paragraphsOf(r.text).length, 6, "paragraphs kept");
  assert.equal(tasks.length, 8);
  assert.equal(new Set(tasks.map((t) => t.data.aspect)).size, 7);
  assert.deepEqual(tasks.map((t) => t.type), ["cloze", "free", "free", "free", "free", "free", "free", "free"], "mostly own answers, one Lückentext, no MC unless allowed");
  for (let i = 0; i < tasks.length; i++) for (let j = i + 1; j < tasks.length; j++) assert.ok(similarity(tasks[i].prompt, tasks[j].prompt) < SIMILAR, `${i + 1} and ${j + 1} differ`);
  for (const t of tasks) assert.deepEqual(readingIssues(t, r.text, tasks), [], `nothing to check: ${t.prompt}`);
  const cloze = tasks[0];
  assert.match(cloze.prompt, /winzigen ___ in einer Blechdose voller ___/);
  assert.deepEqual(cloze.answer.blanks, [["Schlüssel"], ["Knöpfe"]]);
  const zus = tasks.find((t) => t.data.aspect === "zusammenhang")!;
  assert.equal(zus.answer.sample, "Weil seine Familie wenig Geld hatte.");
  assert.deepEqual(zus.answer.evidence, [{ paragraph: 3, quote: "Weil das Geld knapp war, bekam er zum Geburtstag keine Spielsachen" }]);
  const schluss = tasks.find((t) => t.data.aspect === "schluss")!;
  assert.match(schluss.answer.criteria![0], /Verschiedene Antworten sind richtig/, "interpretation: several right answers");
  router.setTransport(null);
});

test("3b. unsuitable KI questions: a twin is dropped and asked for again once, invented Belege and paragraphs are marked", async () => {
  const { repo, niko, router } = await setup("Kontrolle Frage");
  const calls: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(
    fakeKI({
      calls,
      mutate: (qs, call) =>
        call === 0
          ? qs.map((x, i) =>
              i === 7
                ? { ...x, prompt: "Warum bekam der Großvater als Kind eine selbst geschnitzte Kiste und keine Spielsachen?" } // the same as question 2
                : i === 1
                  ? { ...x, evidence: [{ paragraph: 3, quote: "Der Großvater war sehr reich" }] } // not in the text
                  : i === 2
                    ? { ...x, prompt: "Was bedeutet das Wort „vergilbt“ in Abschnitt 9?" } // there is no paragraph 9
                    : x,
            )
          : qs.map((x) => ({ ...x, prompt: "Wem gehörten die Briefe in der Kiste ursprünglich?", sample_answer: "Dem Großvater; Toni hatte sie ihm geschrieben.", evidence: [{ paragraph: 5, quote: "Der Brief war von Toni" }] })),
    }),
  );
  const { createReadingDraft, readingSettingsFromForm } = await import("./lesen-draft");
  const { readingIssues } = await import("./lesen");
  const out = await createReadingDraft(readingSettingsFromForm(form({ text_source: "eigen", title: TITLE, text: TEXT, questions: "ki" })), niko.id);
  assert.equal(calls.length, 2, "one question call and one more for the missing question, never more");
  assert.match(String(calls[1].content), /Diese Fragen gibt es schon/);
  const tasks = repo.listTasks(out.id!);
  assert.equal(tasks.length, 8, "the twin was replaced");
  assert.equal(tasks[7].prompt, "Wem gehörten die Briefe in der Kiste ursprünglich?");
  assert.deepEqual(readingIssues(tasks[1], TEXT, tasks), ["Der Beleg „Der Großvater war sehr reich“ steht so nicht im Text.", "Es fehlt eine Textstelle als Beleg."].slice(0, 1));
  assert.deepEqual(readingIssues(tasks[2], TEXT, tasks), ["Die Frage nennt Abschnitt 9, der Text hat 6 Abschnitte."]);
  // a question not about this text, and a twin the teacher typed
  const { readingIssues: issues } = await import("./lesen");
  const off = { ...tasks[1], prompt: "Welche Farbe hat das Auto des Nachbarn?" };
  assert.ok(issues(off, TEXT, tasks).includes("Die Frage nennt nichts, was im Text vorkommt."));
  const twin = { ...tasks[5], prompt: tasks[1].prompt };
  assert.ok(issues(twin, TEXT, tasks).some((x) => x.startsWith("Sehr ähnlich wie Frage")));
  router.setTransport(null);
});

test("3c. KI not reachable: the questions come from templates and the teacher is told", async () => {
  const { repo, niko, router } = await setup("Ohne Netz");
  router.resetRouter();
  router.setTransport(fakeKI({ fail: true }));
  const { createReadingDraft, readingSettingsFromForm } = await import("./lesen-draft");
  const out = await createReadingDraft(readingSettingsFromForm(form({ text_source: "eigen", title: TITLE, text: TEXT, questions: "ki" })), niko.id);
  assert.equal(out.warning, "ki");
  assert.equal(repo.listTasks(out.id!).length, 8);
  const ki = await createReadingDraft(readingSettingsFromForm(form({ text_source: "ki", topic: "Wald" })), niko.id);
  assert.match(ki.error!, /Der Text konnte nicht erstellt werden/, "no text, no exercise");
  router.setTransport(null);
  const { readingProblem } = await import("./lesen-draft");
  assert.match(readingProblem(readingSettingsFromForm(form({ text_source: "ki", topic: "Wald" })))!, /braucht es die KI/);
  assert.match(readingProblem(readingSettingsFromForm(form({ text_source: "eigen", text: "Zu kurz." })))!, /sehr kurz/);
});

// ---------- 4: editing ----------
test("4. the teacher edits the text once for all questions, and questions, samples and Belege; the checks follow", async () => {
  const { repo, niko, router } = await setup("Bearbeiten");
  router.setTransport(null);
  const { createReadingDraft, readingSettingsFromForm, saveReadingText, readingBlankQuestion, regenerateReadingQuestion } = await import("./lesen-draft");
  const { normalizeTask, checkTask } = await import("./builder");
  const { readingSet, readingIssues } = await import("./lesen");
  const out = await createReadingDraft(readingSettingsFromForm(form({ text_source: "eigen", title: TITLE, text: TEXT, count: "6" })), niko.id);
  const wid = out.id!;
  const edited = TEXT.replace("Toni", "Anton").replace("Toni", "Anton");
  assert.deepEqual(saveReadingText(wid, { title: "Die Holzkiste", text: edited }), {});
  const tasks = repo.listTasks(wid);
  assert.ok(tasks.every((t) => t.data.passage === edited && t.data.passageTitle === "Die Holzkiste"), "every question has the new text");

  const zus = tasks.find((t) => t.data.aspect === "zusammenhang")!;
  const { id, worksheet_id: _w, position: _p, ...d } = zus;
  void _w, void _p;
  const changed: Draft = { ...d, prompt: "Warum bekam der Großvater keine Spielsachen?", answer: { ...d.answer, sample: "Weil die Familie wenig Geld hatte.", evidence: [{ paragraph: 3, quote: "  Weil das Geld knapp war  " }, { paragraph: 2, quote: "" }] } };
  repo.updateTask(id, normalizeTask(changed));
  const saved = repo.getTask(id)!;
  assert.equal(saved.answer.sample, "Weil die Familie wenig Geld hatte.");
  assert.deepEqual(saved.answer.evidence, [{ paragraph: 3, quote: "Weil das Geld knapp war" }], "empty Belege dropped, text trimmed");
  assert.deepEqual(readingIssues(saved, edited, repo.listTasks(wid)), []);
  assert.equal(checkTask(saved), null);
  // a Beleg in the wrong paragraph is found
  assert.deepEqual(readingIssues({ ...saved, answer: { ...saved.answer, evidence: [{ paragraph: 4, quote: "Weil das Geld knapp war" }] } }, edited), ["Der Beleg steht in Abschnitt 3, nicht in Abschnitt 4."]);

  const blank = readingBlankQuestion(wid, "beleg", "free")!;
  assert.equal(blank.data.passage, edited, "a new question comes with the text");
  assert.equal(blank.skillId, "deutsch.text.verstehen.beleg");
  const mc = readingBlankQuestion(wid, "info", "reading")!;
  assert.deepEqual(mc.data.options, ["", "", ""]);
  repo.addTask(wid, blank);
  assert.ok(readingSet(repo.listTasks(wid)), "still one reading exercise");

  // "Neu erstellen" without KI: another question of the same kind about the same text
  const before = repo.getTask(tasks[1].id)!;
  const r = await regenerateReadingQuestion(before.id, niko.id);
  assert.equal(r?.ok, true);
  const after = repo.getTask(before.id)!;
  assert.notEqual(after.prompt, before.prompt);
  assert.equal(after.data.passage, edited);
});

// ---------- 5: a long text ----------
const LONG = [
  ...P,
  ...P.map((p) => p.replaceAll("Mira", "Lena").replaceAll("Toni", "Fritz")),
  ...P.map((p) => p.replaceAll("Mira", "Sara").replaceAll("Großvater", "Onkel")),
  ...P.map((p) => p.replaceAll("Mira", "Emma").replaceAll("Kiste", "Truhe")),
].join("\n\n");

test("5. a text of about 1000 words: kept whole, questions over the text, printed once, sent to the student once", async () => {
  const { repo, sid, niko, router } = await setup("Langer Text");
  router.setTransport(null);
  const { wordCount, paragraphsOf, readingSet } = await import("./lesen");
  assert.ok(wordCount(LONG) >= 1000, String(wordCount(LONG)));
  const { createReadingDraft, readingSettingsFromForm } = await import("./lesen-draft");
  const out = await createReadingDraft(readingSettingsFromForm(form({ student_id: String(sid), text_source: "eigen", title: "Drei Kisten", text: LONG, count: "10" })), niko.id);
  const tasks = repo.listTasks(out.id!);
  assert.equal(tasks.length, 10);
  assert.equal(paragraphsOf(readingSet(tasks)!.text).length, 24);
  const aid = repo.assignWorksheet(out.id!, sid);
  const { clientTasks } = await import("./solver-tasks");
  const ct = clientTasks(repo.getAssignment(aid)!);
  assert.equal(ct[0].reading?.text, LONG);
  assert.ok(ct.every((t) => t.passage === null), "no text per question");
  assert.ok(ct.slice(1).every((t) => !t.reading), "the text is sent once");
  assert.ok(JSON.stringify(ct).length < LONG.length * 1.6, "the page carries the text once");
});

// ---------- 8–12: answering, grading, Lernstand ----------
test("8–12. the student answers several questions; open answers wait for the teacher; graded per aspect; no double submissions", async () => {
  const { repo, sid, niko, router } = await setup("Lisa Lesen");
  router.resetRouter();
  router.setTransport(fakeKI());
  const { createReadingDraft, readingSettingsFromForm } = await import("./lesen-draft");
  const out = await createReadingDraft(readingSettingsFromForm(form({ student_id: String(sid), text_source: "eigen", title: TITLE, text: TEXT, questions: "ki", mc: "on" })), niko.id);
  router.setTransport(null);
  const tasks = repo.listTasks(out.id!);
  const mc = tasks.find((t) => t.data.options)!;
  assert.equal(tasks.length, 8);
  assert.equal(tasks.filter((t) => t.data.options).length, 2, "with MC allowed: at most one in four questions");
  const aid = repo.assignWorksheet(out.id!, sid);
  const student = repo.getStudent(sid)!;
  const { submitAnswer, reviewAnswer, analyzeStudent } = await import("./service");
  let n = 0;
  const answer = (taskId: number, text: string, submissionId = `lesen-abgabe-${String(++n).padStart(8, "0")}`) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId, answer: text, timeMs: 40_000, hintsUsed: 0, submissionId });

  const cloze = tasks.find((t) => t.type === "cloze")!;
  const r1 = await answer(cloze.id, JSON.stringify(["schlüssel", " Knöpfe "]));
  assert.equal(r1.correct, true, "cloze: checked automatically, case and spaces do not matter");
  const r2 = await answer(mc.id, String(mc.answer.correct));
  assert.equal(r2.correct, true);
  const zus = tasks.find((t) => t.data.aspect === "beleg")!;
  const own = "Im 2. Abschnitt: Seine Stimme klang anders als sonst.";
  const sub = "lesen-frei-000000000001";
  const r3 = await answer(zus.id, own, sub);
  assert.equal(r3.pendingReview, true, "different wording is never marked wrong by the app");
  assert.equal(r3.correct, null);
  assert.equal(r3.sample, "„Seine Stimme klang ganz anders als sonst.“");
  assert.deepEqual(await answer(zus.id, own, sub), r3, "12. the same submission again: same result");
  assert.equal(repo.listAttemptsForAssignment(aid).filter((a) => a.task_id === zus.id).length, 1, "stored once");
  const second = await answer(zus.id, "Noch einmal anders.", "lesen-frei-000000000002");
  assert.equal(second.final, true, "a handed-in answer stays as it is");
  assert.equal(repo.listAttemptsForAssignment(aid).filter((a) => a.task_id === zus.id).length, 1, "a new submission id after the final answer adds nothing");
  const schluss = tasks.find((t) => t.data.aspect === "schluss")!;
  await answer(schluss.id, "Vielleicht ist er traurig, weil er an Toni denkt.");

  // 11: before the grade only the automatic ones count; the KI never grades
  const skill = (id: string) => analyzeStudent(sid)!.skills.find((s) => s.skill.id === id)?.mastery ?? null;
  assert.equal(skill("deutsch.text.verstehen.beleg"), null, "open answer not counted before the grade");
  assert.ok(skill("deutsch.text.verstehen.info")! > 0.5, "the cloze counts for Informationen entnehmen");
  assert.ok(skill("deutsch.text.verstehen.zusammenhang")! > 0.5, "the choice question counts for Zusammenhänge");
  assert.equal(repo.pendingReviews({ studentId: sid }).length, 2);

  // 10: the teacher grades
  const [a, b] = repo.pendingReviews({ studentId: sid }).sort((x, y) => x.task_id - y.task_id);
  assert.ok("ok" in reviewAnswer(a.id, a.task_id === zus.id ? "richtig" : "teilweise", niko.id));
  assert.ok("ok" in reviewAnswer(b.id, b.task_id === zus.id ? "richtig" : "teilweise", niko.id));
  assert.equal(repo.pendingReviews({ studentId: sid }).length, 0);
  assert.ok(skill("deutsch.text.verstehen.beleg")! > 0.5, "Textstellen als Beleg: right");
  const sch = skill("deutsch.text.verstehen.schluss")!;
  assert.ok(sch > 0.2 && sch < 0.8, `Schlussfolgern: teilweise (${sch})`);
  assert.ok(skill("deutsch.text.verstehen") !== null, "the main skill Leseverständnis is measured too");
  const counted = repo.listAttemptsForStudent(sid);
  assert.equal(counted.length, 4, "4 answers, each once");
});

// ---------- 13 + 14: A4 ----------
test("13–14. A4: the student sheet has title, the whole text with numbered paragraphs, numbered questions and room to write; the teacher sheet adds samples, Erwartungshorizont and Belege", async () => {
  const { repo, niko, router } = await setup("Druck");
  router.resetRouter();
  router.setTransport(fakeKI());
  const { createReadingDraft, readingSettingsFromForm } = await import("./lesen-draft");
  const out = await createReadingDraft(readingSettingsFromForm(form({ text_source: "eigen", title: TITLE, text: TEXT, questions: "ki" })), niko.id);
  router.setTransport(null);
  const tasks = repo.listTasks(out.id!);
  const { buildSheet, DEFAULTS } = await import("./arbeitsblatt");
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  const doc = buildSheet({ title: "Leseverständnis", subject: "Deutsch", klasseLabel: "MS, 2. Klasse", topic: "Lesen", studentName: null, tasks }, (id) => id, DEFAULTS);
  assert.deepEqual(doc.reading, { title: TITLE, text: TEXT });
  assert.ok(doc.tasks.every((t) => t.passage === null), "the text is printed once, before the questions");
  const render = (fassung: "schueler" | "lehrer") => renderToStaticMarkup(createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Leseverständnis", fassung } }));
  const student = render("schueler");
  assert.equal(student.split(TITLE).length - 1, 1, "title of the text once");
  assert.equal(student.split('class="ab-absatz"').length - 1, 6, "six paragraphs");
  assert.ok(student.includes('<span class="ab-absatz-nr">6</span>'), "numbered");
  assert.ok(student.includes("Fragen zum Text"));
  assert.ok(student.indexOf("ab-lesetext") < student.indexOf("ab-tasks"), "text before the questions");
  assert.equal(student.split('class="ab-num"').length - 1, 8, "eight numbered questions");
  assert.ok(student.includes("ab-line"), "lines to write on");
  for (const hidden of ["Weil seine Familie wenig Geld hatte", "Erwartungshorizont", "Beleg im Text", "Musterantwort"]) assert.ok(!student.includes(hidden), `student sheet shows "${hidden}"`);
  const teacher = render("lehrer");
  for (const shown of ["Weil seine Familie wenig Geld hatte", "Erwartungshorizont", "Beleg im Text", "Abschnitt 3: „Weil das Geld knapp war", "Verschiedene Antworten sind richtig", "Schlüssel"]) assert.ok(teacher.includes(shown), `teacher sheet lacks "${shown}"`);
  assert.ok(teacher.includes("ab-lesetext"), "the teacher sheet has the text too");
});

// ---------- 15: the rest still works ----------
test("15. other exercises are unchanged: a short Textverständnis task keeps its own passage, a worksheet without shared text is no reading set", async () => {
  const { readingSet } = await import("./lesen");
  const { buildSheet, DEFAULTS } = await import("./arbeitsblatt");
  const one: Draft = { type: "reading", skillId: "deutsch.text.verstehen", difficulty: "mittel", prompt: "Wer kommt?", data: { passage: "Tom kommt heute.", options: ["Tom", "Ben"] }, answer: { correct: 0 }, solution: "", hints: [], errorMap: [] };
  const other: Draft = { ...one, data: { passage: "Ben geht.", options: ["Tom", "Ben"] }, answer: { correct: 1 } };
  const calc: Draft = { type: "calc", skillId: "mathe.brueche.addieren", difficulty: "mittel", prompt: "1/2 + 1/4", data: {}, answer: { accepted: ["3/4"], mode: "value" }, solution: "", hints: [], errorMap: [] };
  assert.equal(readingSet([one]), null, "one task is no reading exercise");
  assert.equal(readingSet([one, other]), null, "different texts");
  assert.equal(readingSet([one, calc]), null);
  const doc = buildSheet({ title: "Mix", subject: "Deutsch", klasseLabel: "", topic: "", studentName: null, tasks: [one, other] }, () => null, DEFAULTS);
  assert.equal(doc.reading, null);
  assert.deepEqual(doc.tasks.map((t) => t.passage), ["Tom kommt heute.", "Ben geht."], "each short text above its task, as before");
  const { checkAnswer } = await import("./tasks");
  assert.equal(checkAnswer(one, "0").correct, true);
});
