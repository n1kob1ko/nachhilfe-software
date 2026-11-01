/**
 * Textinterpretation (lib/textinterpretation.ts, lib/textinterpretation-store.ts): line numbers, Schreibplan and
 * word budget, the Arbeitsauftrag, the Hinweise without KI (a right text is never flagged), the example, the
 * builder's Teilübungen instead of short mini interpretations, and the KI correction with a mock transport.
 * No KI call leaves the test: every request goes to router.setTransport.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

type AIRequest = import("./ai/router").AIRequest;
type AIResult = import("./ai/providers/types").AIResult;
type BuilderSettings = import("./builder").BuilderSettings;

const SKILL = "deutsch.os.matura.textinterpretation";
const usage = { input: 900, output: 300, cacheWrite: 0, cacheRead: 0 };

const ti = () => import("./textinterpretation");
const ex = () => import("./textinterpretation-beispiel");
const docOf = async (text: string) => (await import("./text-doc")).docFromText(text);

const kid = (name: string, teacherId: number, school_type = "Gymnasium", klasse = 7) => ({
  name, grade: klasse, klasse, teacher_id: teacherId, school: "", school_type, subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

async function setup(name: string) {
  const repo = await import("./repo");
  const store = await import("./textinterpretation-store");
  const texts = await import("./texts");
  const units = await import("./units");
  const b = await ex();
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  const unitId = units.startUnit(niko.id, sid, { subject: "Deutsch" }).unit.id;
  const out = store.cleanSettings({ title: b.BEISPIEL_TITEL, author: b.BEISPIEL_AUTORIN, year: b.BEISPIEL_JAHR, kind: "Kurzgeschichte", story: b.BEISPIEL_GESCHICHTE, target: "500", prompt: "" });
  if ("error" in out) throw new Error(out.error);
  return { repo, store, texts, units, niko, sid, unitId, settings: out.settings };
}

/** Replaces the KI providers; every request is recorded, nothing leaves the test. */
async function withStub<T>(answer: (r: AIRequest) => unknown, run: () => Promise<T>): Promise<{ out: T; calls: AIRequest[] }> {
  const router = await import("./ai/router");
  router.resetRouter();
  const calls: AIRequest[] = [];
  router.setTransport(async (r): Promise<AIResult> => {
    calls.push(r);
    return { parsed: r.schema.parse(answer(r)), refusal: false, model: r.model, usage, costUsd: 0.001 };
  });
  try {
    return { out: await run(), calls };
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
}

// ---------- line numbers ----------

test("line numbers: line breaks stay as pasted, a number every 5 lines, empty lines not counted unless asked", async () => {
  const { numberedLines, lastLine, cleanStory, lineLabel } = await ti();
  const raw = "\r\n\r\nErste Zeile   \r\nZweite\tZeile\r\n\r\nDritte\nVierte\nFünfte\nSechste\n\n\n";
  assert.equal(cleanStory(raw), "Erste Zeile\nZweite    Zeile\n\nDritte\nVierte\nFünfte\nSechste", "Windows line ends, tabs, trailing spaces and outer empty lines go; the rest stays");
  const lines = numberedLines(raw);
  assert.deepEqual(lines.map((l) => l.n), [1, 2, null, 3, 4, 5, 6]);
  assert.deepEqual(lines.filter((l) => l.shown).map((l) => l.n), [5]);
  assert.equal(lines[4].text, "Vierte");
  assert.equal(lastLine(lines), 6);
  const counted = numberedLines(raw, true);
  assert.deepEqual(counted.map((l) => l.n), [1, 2, 3, 4, 5, 6, 7], "with empty lines counted, the empty line is line 3");
  assert.equal(counted[4].text, "Vierte");
  assert.deepEqual(counted.filter((l) => l.shown).map((l) => l.text), ["Vierte"]);
  assert.deepEqual(numberedLines("   \n\n"), []);
  assert.equal(lineLabel(12), "Z. 12");
  assert.equal(lineLabel(100, 101), "Z. 100f.");
  assert.equal(lineLabel(11, 13), "Z. 11–13");
});

test("line numbers of the example: 68 lines, first and last sentence mirror each other, numbers 5 to 65", async () => {
  const { numberedLines, lastLine } = await ti();
  const b = await ex();
  const lines = numberedLines(b.BEISPIEL_GESCHICHTE);
  assert.equal(lastLine(lines), 68);
  assert.equal(lines.length, 68, "no empty lines");
  assert.equal(lines[0].text, "Um sieben Uhr zwölf steht der Alte an der Haltestelle.");
  assert.equal(lines[67].text, "Um sieben Uhr zwölf stehen zwei an der Haltestelle.");
  assert.deepEqual(lines.filter((l) => l.shown).map((l) => l.n), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65]);
});

test("line references: Z. 12, Z. 100f., Z. 12 ff., Z. 11–13, Zeile 5 bis 7, Z. 20, 61", async () => {
  const { parseLineRefs } = await ti();
  assert.deepEqual(parseLineRefs("Z. 12"), [{ from: 12, to: 12 }]);
  assert.deepEqual(parseLineRefs("Z. 100f."), [{ from: 100, to: 101 }]);
  assert.deepEqual(parseLineRefs("Z. 12 ff."), [{ from: 12, to: "ff" }]);
  assert.deepEqual(parseLineRefs("Z. 11–13"), [{ from: 11, to: 13 }]);
  assert.deepEqual(parseLineRefs("vgl. Zeile 5 bis 7"), [{ from: 5, to: 7 }]);
  assert.deepEqual(parseLineRefs("Z. 20, 61"), [{ from: 20, to: 20 }, { from: 61, to: 61 }]);
  assert.deepEqual(parseLineRefs("Z. 1–23, Z. 24–40, Z. 41 ff."), [{ from: 1, to: 23 }, { from: 24, to: 40 }, { from: 41, to: "ff" }]);
  assert.deepEqual(parseLineRefs("ebd."), []);
});

// ---------- Schreibplan, word budget, Arbeitsauftrag ----------

test("word budget: seven parts in school order, rounded to 5, together about the target", async () => {
  const { schreibplan, wordRange, cleanTarget, DEFAULT_TARGET } = await ti();
  const plan = schreibplan(500);
  assert.deepEqual(plan.map((p) => p.key), ["einleitung", "inhalt", "form", "sprache", "figur", "deutung", "schluss"]);
  assert.deepEqual(plan.map((p) => p.words), [50, 75, 75, 100, 75, 75, 50]);
  for (const target of [150, 380, 500, 640, 1000, 1500]) {
    const sum = schreibplan(target).reduce((s, p) => s + p.words, 0);
    assert.ok(Math.abs(sum - target) <= 20, `${target}: ${sum}`);
    assert.ok(schreibplan(target).every((p) => p.words % 5 === 0 && p.words >= 10));
  }
  assert.deepEqual(wordRange(500), { min: 450, max: 550 });
  assert.deepEqual(wordRange(600), { min: 540, max: 660 });
  assert.equal(cleanTarget(""), DEFAULT_TARGET);
  assert.equal(cleanTarget("abc"), 500);
  assert.equal(cleanTarget("20"), 150);
  assert.equal(cleanTarget("9000"), 1500);
  assert.equal(cleanTarget("720"), 720);
  assert.match(schreibplan(500, "Märchen")[2].hint, /Merkmale des Märchens/);
  assert.match(schreibplan(500)[2].hint, /Merkmale der Kurzgeschichte/);
  assert.match(schreibplan(500)[3].hint, /Zitat, Zeile und Wirkung/);
});

test("Arbeitsauftrag: Textsorte, the text it refers to, four Arbeitsaufträge and the word range", async () => {
  const { defaultArbeitsauftrag } = await ti();
  const a = defaultArbeitsauftrag({ title: "Sieben Uhr zwölf", author: "Ida Brunnhofer", year: "2026", kind: "Kurzgeschichte", target: 500 });
  assert.match(a, /^Verfasse eine Textinterpretation zur Kurzgeschichte „Sieben Uhr zwölf“ von Ida Brunnhofer \(2026\)\./);
  assert.equal(a.split("\n").filter((l) => l.startsWith("• ")).length, 4);
  assert.match(a, /Zitaten und Zeilenangaben/);
  assert.match(a, /Schreib zwischen 450 und 550 Wörter\.$/);
  const b = defaultArbeitsauftrag({ title: "Am Fluss", author: "", year: "", kind: "Romanauszug", target: 700 });
  assert.match(b, /zum Romanauszug „Am Fluss“\./, "without author and year, and the right article");
  assert.match(b, /zwischen 630 und 770 Wörter/);
});

test("UI texts: no em dash, no spaced en dash, du-form", async () => {
  const { defaultArbeitsauftrag, schreibplan, hinweise, numberedLines, teiluebungen } = await ti();
  const b = await ex();
  const doc = await docOf("Ein Satz ohne viel. „Kondukteur“ und „Billett“ (Z. 99). Noch ein Satz mit einigen Wörtern dazu, damit es reicht und weiter geht.");
  const strings = [
    defaultArbeitsauftrag({ title: "T", author: "A B", year: "1", kind: "Parabel", target: 500 }),
    ...schreibplan(500).flatMap((p) => [p.title, p.hint]),
    ...hinweise(doc, { title: b.BEISPIEL_TITEL, author: b.BEISPIEL_AUTORIN, target: 500, lines: numberedLines(b.BEISPIEL_GESCHICHTE) }).map((h) => h.text),
    ...teiluebungen(b.BEISPIEL_QUELLE, 14).flatMap((t) => [t.prompt, ...t.hints, ...(t.answer.criteria ?? [])]),
  ];
  for (const s of strings) {
    assert.ok(!s.includes("—"), s);
    assert.ok(!/ – /.test(s), s);
    assert.ok(!/\bSie\b|\bIhre?\b/.test(s), `du-form: ${s}`);
  }
});

// ---------- the example ----------

test("example: about 500 words in the seven parts, every quote stands in the story at the given lines", async () => {
  const { numberedLines, quotesOf, findInStory, TEIL_KEYS, wordRange } = await ti();
  const { countWords } = await import("./text-doc");
  const b = await ex();
  assert.deepEqual(b.BEISPIEL_INTERPRETATION.map((p) => p.teil), TEIL_KEYS);
  const words = countWords(b.beispielInterpretation());
  const { min, max } = wordRange(500);
  assert.ok(words >= min && words <= max, `${words} words`);
  const lines = numberedLines(b.BEISPIEL_GESCHICHTE);
  const quotes = quotesOf(await docOf(b.beispielInterpretation())).filter((q) => q.text !== b.BEISPIEL_TITEL);
  assert.ok(quotes.length >= 12, `${quotes.length} quotes`);
  for (const q of quotes) {
    assert.ok(q.hasRef && q.refs.length, `„${q.text}“ has a line`);
    const found = findInStory(lines, q.text);
    assert.ok(found.length, `„${q.text}“ is in the story`);
    const ok = q.refs.some((r) => found.some((f) => f.from >= r.from && f.to <= (r.to === "ff" ? 68 : r.to)));
    assert.ok(ok, `„${q.text}“ stands in ${JSON.stringify(q.refs)}: ${JSON.stringify(found)}`);
  }
  // the parts name what the school asks for
  const text = b.beispielInterpretation();
  for (const k of ["Kurzgeschichte", "Deutungshypothese", "unvermittelte Beginn", "offene Ende", "namenlosen Figuren", "Z. 1–24", "Z. 56 ff.", "Dialekt", "Anapher", "Vergleich", "Titel"]) assert.ok(text.includes(k), k);
});

// ---------- Hinweise ----------

const info = async () => {
  const { numberedLines } = await ti();
  const b = await ex();
  return { title: b.BEISPIEL_TITEL, author: b.BEISPIEL_AUTORIN, target: 500, lines: numberedLines(b.BEISPIEL_GESCHICHTE) };
};
const tips = (hs: { tone: string; key: string }[]) => hs.filter((h) => h.tone === "tipp").map((h) => h.key);

test("hints: the model interpretation gets no tip at all", async () => {
  const { hinweise } = await ti();
  const b = await ex();
  const hs = hinweise(await docOf(b.beispielInterpretation()), await info());
  assert.deepEqual(tips(hs), []);
  assert.deepEqual(hs.map((h) => h.key), ["umfang", "einleitung", "zitate", "absaetze"]);
  assert.ok(hs.every((h) => h.tone === "gut"));
});

test("hints: right ways of quoting are never flagged", async () => {
  const { hinweise } = await ti();
  const intro = "In der Kurzgeschichte „Sieben Uhr zwölf“ von Ida Brunnhofer wartet ein alter Mann auf einen Bus, der nicht mehr kommt, und eine junge Frau wartet mit ihm.";
  const variants = [
    "Er setzt sich nie, „weil man im Sitzen den Bus zu spät sieht“ (Z. 38f.).", // over two lines
    "Er setzt sich nie, „weil man im Sitzen den Bus zu spät sieht“ (Z. 39).", // one line off
    "„Wir danken für Ihr Verständnis“ (Z. 7–8) klingt höflich.",
    "In Z. 24 heißt es: „Er wartet. Die Straße bleibt leer.“", // the line before the quote
    "„Er wartet weiter“, Zeile 24, zeigt den Stillstand.",
    "Die Straße wirkt „wie eine graue Zunge“ (vgl. Z. 15).",
    "Der Alte wartet „an der Haltestelle“ (Z. 68).", // stands in Z. 1 and Z. 68
    "Das Ende ist offen (Z. 56 ff.): „Um sieben Uhr zwölf stehen zwei an der Haltestelle“ (Z. 56 ff.).",
    "Er spricht Dialekt: „I wort auf'n Bus“ (Z. 31) und „Der kummt scho“ (ebd.).",
    "Der Zettel spricht „[a]ufgrund rückläufiger Fahrgastzahlen“ (Z. 4).", // adapted with [ ]: not checked
    "Er sagt, er warte „auf den Bus“ (Z. 59).", // not word for word in Z. 31: is in Z. 59
    "Die Frau „schaut ihm nach“ (Z. 54), der Alte bleibt.",
    "Brunnhofers Sprache ist knapp: „Er wartet.“ (Z. 24).",
  ];
  for (const v of variants) {
    const hs = hinweise(await docOf(`${intro}\n${v}`), await info());
    assert.ok(!tips(hs).includes("zitate") && !tips(hs).includes("stelle") && !tips(hs).includes("zeilen") && !tips(hs).includes("einleitung"), `${v}\n${JSON.stringify(hs)}`);
  }
  // the genitive and another order of the title words count as naming them
  const g = hinweise(await docOf("Brunnhofers Kurzgeschichte zeigt um sieben Uhr zwölf einen alten Mann, der an einer Haltestelle steht und wartet, obwohl kein Bus mehr fährt."), await info());
  assert.ok(!tips(g).includes("einleitung"), JSON.stringify(g));
});

test("hints: length, opening, quotes without line, lines the story does not have, a quote at another place, paragraphs", async () => {
  const { hinweise } = await ti();
  const i = await info();
  assert.deepEqual(hinweise([], i).map((h) => [h.key, h.tone]), [["umfang", "info"]]);
  assert.match(hinweise([], i)[0].text, /450 bis 550/);

  const short = hinweise(await docOf("Der Text handelt von einem Mann. Er wartet auf den Bus, aber der kommt nicht. Am Ende sind zwei da und warten gemeinsam."), i);
  assert.match(short.find((h) => h.key === "umfang")!.text, /Es fehlen noch etwa/);
  const intro = short.find((h) => h.key === "einleitung")!;
  assert.equal(intro.tone, "tipp");
  assert.match(intro.text, /weder Ida Brunnhofer noch den Titel „Sieben Uhr zwölf“/);

  const noAuthor = hinweise(await docOf("Die Kurzgeschichte „Sieben Uhr zwölf“ erzählt von einem alten Mann, der jeden Morgen an der Haltestelle wartet, obwohl kein Bus mehr kommt."), i);
  assert.match(noAuthor.find((h) => h.key === "einleitung")!.text, /den Namen Ida Brunnhofer nicht/);

  const body = [
    "Die Kurzgeschichte „Sieben Uhr zwölf“ von Ida Brunnhofer erzählt von einem alten Mann, der jeden Morgen auf einen Bus wartet.",
    "Er trägt einen „grauen Rock“ und spricht Dialekt: „I wort auf'n Bus“.",
    "Die kurzen Sätze „Er wartet. Die Straße bleibt leer.“ (Z. 12) zeigen den Stillstand. In Z. 120 endet der Text.",
  ].join("\n");
  const hs = hinweise(await docOf(body), i);
  const z = hs.find((h) => h.key === "zitate")!;
  assert.equal(z.tone, "tipp");
  assert.match(z.text, /^1 von 3 Zitaten haben eine Zeilenangabe/);
  assert.match(z.text, /„grauen Rock“/);
  assert.match(hs.find((h) => h.key === "zeilen")!.text, /Der Text hat 68 Zeilen\. Prüf die Angabe Z\. 120\./);
  assert.match(hs.find((h) => h.key === "stelle")!.text, /„Er wartet\. Die Straße bleibt leer\.“ steht in Z\. 24/);
  const a = hs.find((h) => h.key === "absaetze")!;
  assert.equal(a.tone, "info", "a short text is not asked for more paragraphs yet");

  // a long text in two paragraphs: the Schreibplan has seven parts
  const long = hinweise(await docOf(`${"Wort ".repeat(200)}\n${"Wort ".repeat(150)}`), i);
  assert.equal(long.find((h) => h.key === "absaetze")!.tone, "tipp");
  // much more than the range is a tip, never a mistake
  const tooLong = hinweise(await docOf("Wort ".repeat(700)), i);
  assert.match(tooLong.find((h) => h.key === "umfang")!.text, /etwas mehr als 550/);

  // the words of a grade never appear
  for (const h of [...short, ...noAuthor, ...hs, ...long, ...tooLong]) assert.ok(!/falsch|fehler|note\b/i.test(h.text), h.text);
});

test("hints: a quote of the title is no quote, no quotes at all is a tip from 100 words", async () => {
  const { hinweise } = await ti();
  const i = await info();
  const few = hinweise(await docOf("„Sieben Uhr zwölf“ von Ida Brunnhofer ist eine Kurzgeschichte über das Warten."), i);
  assert.equal(few.find((h) => h.key === "zitate"), undefined);
  const many = hinweise(await docOf(`„Sieben Uhr zwölf“ von Ida Brunnhofer ist eine Kurzgeschichte. ${"Der Mann wartet. ".repeat(40)}`), i);
  assert.match(many.find((h) => h.key === "zitate")!.text, /Noch keine Zitate/);
});

// ---------- the Schreibauftrag ----------

test("assignment: a Textarbeit with Textsorte, Arbeitsauftrag and the story with its line breaks", async () => {
  const s = await setup("Lena Auftrag");
  const text = s.store.createInterpretation({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, settings: s.settings });
  assert.equal(text.topic, "Textinterpretation");
  assert.equal(text.title, "Textinterpretation zu „Sieben Uhr zwölf“");
  assert.equal(text.subject, "Deutsch");
  assert.equal(text.unit_id, s.unitId);
  assert.match(text.prompt, /^Verfasse eine Textinterpretation zur Kurzgeschichte „Sieben Uhr zwölf“ von Ida Brunnhofer \(2026\)/);
  assert.match(text.prompt, /zwischen 450 und 550 Wörter/);
  const v = s.store.interpretationFor(text.id)!;
  assert.deepEqual([v.title, v.author, v.year, v.kind, v.target, v.countBlank], ["Sieben Uhr zwölf", "Ida Brunnhofer", "2026", "Kurzgeschichte", 500, false]);
  assert.equal(v.text.split("\n").length, 68, "the line breaks are kept");
  assert.equal(s.store.interpretationContext(text.id)!.lines, 68);
  assert.deepEqual([...s.store.interpretationIds([text.id, text.id + 1000])], [text.id]);

  // the teacher changes target and Arbeitsauftrag: the written text stays
  assert.ok(s.texts.saveText(text.id, [{ t: "p", r: [{ x: "Mein Anfang." }] }], 0).ok);
  const changed = s.store.cleanSettings({ ...s.settings, target: "600", prompt: "Interpretiere den Text. Schreib etwa 600 Wörter." });
  assert.ok("settings" in changed);
  s.store.updateInterpretation(text.id, changed.settings);
  const after = s.texts.getText(text.id)!;
  assert.equal(after.prompt, "Interpretiere den Text. Schreib etwa 600 Wörter.");
  assert.equal(after.words, 2);
  assert.equal(s.store.interpretationFor(text.id)!.target, 600);
  assert.equal(s.store.interpretationFor(after.id + 999), null);
});

test("assignment: what is missing is said, the target defaults to 500, empty lines can count", async () => {
  const { cleanSettings } = await import("./textinterpretation-store");
  const story = Array.from({ length: 12 }, (_, i) => `Zeile ${i + 1} der Geschichte.`).join("\n");
  assert.deepEqual(cleanSettings({ title: "", story }), { error: "Bitte den Titel der Geschichte eingeben." });
  assert.deepEqual(cleanSettings({ title: "T", story: "  " }), { error: "Bitte den Text der Geschichte einfügen." });
  assert.match((cleanSettings({ title: "T", story: "Ein ganzer Absatz ohne Zeilenumbruch, so wie er aus einer Webseite kommt." }) as { error: string }).error, /nur 1 Zeile/);
  assert.match((cleanSettings({ title: "T", story: "x\n".repeat(401) }) as { error: string }).error, /höchstens 400/);
  const ok = cleanSettings({ title: "„Der Titel“", story: `${story}\n\nNach der Leerzeile.`, kind: "unbekannt", countBlank: "1", year: " 1949 " });
  assert.ok("settings" in ok);
  assert.equal(ok.settings.title, "Der Titel", "quotation marks around the title go");
  assert.equal(ok.settings.kind, "Kurzgeschichte");
  assert.equal(ok.settings.target, 500);
  assert.equal(ok.settings.countBlank, true);
  assert.equal(ok.settings.year, "1949");
  assert.match(ok.settings.prompt, /zur Kurzgeschichte „Der Titel“ \(1949\)/);
});

test("backup: the stories are exported after the texts", async () => {
  const { db } = await import("./db");
  const { exportBackup } = await import("./backup");
  const names = Object.keys(exportBackup(db()).tables);
  assert.ok(names.includes("text_interpretations"));
  assert.ok(names.indexOf("texts") < names.indexOf("text_interpretations"));
});

test("print options: the worksheet and the interpretation with the story are URL settings", async () => {
  const { readTextPrintOptions, textPrintQuery } = await import("./text-print");
  assert.equal(readTextPrintOptions({ blatt: "beides" }, "T").blatt, "beides");
  assert.equal(textPrintQuery(readTextPrintOptions({ blatt: "beides" }, "T"), "T"), "blatt=beides");
  assert.equal(readTextPrintOptions({ blatt: "leer" }, "T").blatt, "leer");
});

// ---------- the builder ----------

const settings = (o: Partial<BuilderSettings> = {}): BuilderSettings => ({
  studentId: null, subject: "Deutsch", schoolType: "Gymnasium", klasse: 7, skillIds: [SKILL],
  difficulty: "mittel", count: 5, categories: [], focus: "", useAI: true, title: "", ...o,
});

test("builder: Textinterpretation makes Teilübungen on a whole story with line numbers, without asking the KI", async () => {
  const builder = await import("./builder");
  const { readingSet, readingIssues, readingSetIssues } = await import("./lesen");
  const b = await ex();
  const { out, calls } = await withStub(() => {
    throw new Error("no KI for Textinterpretation");
  }, () => builder.generateTasks(settings({ count: 5 }), null));
  assert.equal(calls.length, 0, "no request to the KI");
  assert.equal(out.source, "generator");
  assert.equal(out.aiError, undefined);
  assert.equal(out.tasks.length, 5);
  assert.deepEqual(out.tasks.map((t) => t.data.teil), ["einleitung", "inhalt", "sprache", "form", "figur"]);
  for (const t of out.tasks) {
    assert.equal(t.type, "free");
    assert.equal(t.skillId, SKILL);
    assert.equal(t.data.zeilen, true);
    assert.equal(t.data.passage, b.BEISPIEL_GESCHICHTE, "without a story of the student's own: the example");
    assert.equal(t.data.passageTitle, "„Sieben Uhr zwölf“ von Ida Brunnhofer (2026)");
    assert.ok(t.answer.sample, "the model interpretation is the sample answer");
    assert.ok((t.answer.criteria ?? []).length >= 3);
    assert.ok(!/^Erkläre/.test(t.prompt));
    assert.equal(builder.checkTask(t), null, "ready to send");
  }
  assert.match(out.tasks[0].prompt, /Deutungshypothese/);
  assert.match(out.tasks[1].prompt, /Präsens/);
  assert.match(out.tasks[2].prompt, /Zeilenangabe/);
  const set = readingSet(out.tasks)!;
  assert.equal(set.zeilen, true, "the story is shown once, with line numbers");
  assert.deepEqual(readingSetIssues(out.tasks), []);
  for (const t of out.tasks) assert.deepEqual(readingIssues(t, set.text, out.tasks), [], t.prompt);

  // more than every part twice is not useful: the exercise gets at most 14
  const many = await builder.generateTasks(settings({ count: 20, useAI: false }), null);
  assert.equal(many.tasks.length, 14);
  assert.equal(new Set(many.tasks.map((t) => t.prompt)).size, 14, "no prompt twice");
});

test("builder: other skills are built as before, a mixed exercise gets Teilübungen only for Textinterpretation", async () => {
  const builder = await import("./builder");
  const ZEITEN = "deutsch.grammatik.zeiten";
  const offline = await builder.generateTasks(settings({ skillIds: [ZEITEN], klasse: 3, count: 3, useAI: false }), null);
  assert.ok(offline.tasks.every((t) => !t.data.teil && !t.data.zeilen));
  const { out, calls } = await withStub(
    (r) => ({
      tasks: [...String(r.content).matchAll(/^\d+\. category=(\S+)(?: \([^)]*\))?(?:, format=[^,]+)?, skill_id=(\S+)$/gm)].map((m, i) => ({
        category: m[1], format: "free", skill_ids: [m[2]], topic: "Zeiten", difficulty: "mittel", prompt: `KI-Aufgabe ${i + 1}: Erkläre das Perfekt.`, passage: null, options: null, correct_option: null,
        accepted_answers: null, numeric: false, blanks: null, sample_answer: "Das Perfekt …", steps: null, case_sensitive: true, faulty_text: null, corrected_text: null, text_errors: null,
        answer_lines: 3, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["passt"], solution: "Perfekt", solution_steps: [],
        estimated_time_sec: 60, hints: [], common_errors: [],
      })),
    }),
    () => builder.generateTasks(settings({ skillIds: [SKILL, ZEITEN], categories: ["offen"], count: 4 }), null),
  );
  assert.equal(calls.length, 1, "the KI is asked for the other skill only");
  const plan = [...String(calls[0].content).matchAll(/^\d+\. category=\S+.*skill_id=(\S+)$/gm)].map((m) => m[1]);
  assert.deepEqual(plan, [ZEITEN, ZEITEN], "Textinterpretation is not in the KI's plan");
  const interp = out.tasks.filter((t) => t.skillId === SKILL);
  const other = out.tasks.filter((t) => t.skillId === ZEITEN);
  assert.equal(interp.length, 2);
  assert.equal(other.length, 2);
  assert.ok(interp.every((t) => t.data.teil && t.data.zeilen));
  assert.ok(other.every((t) => t.prompt.startsWith("KI-Aufgabe") && !t.data.teil));
});

test("builder: the student's own story, a draft for one Textinterpretation, and „Neu erstellen“ keeps part and story", async () => {
  const s = await setup("Jonas Teile");
  const builder = await import("./builder");
  const repo = await import("./repo");
  const own = s.store.cleanSettings({ title: "Die Brücke", author: "Erfundene Autorin", story: Array.from({ length: 30 }, (_, i) => `Zeile ${i + 1}: Der Fluss rauscht unter der alten Brücke.`).join("\n"), kind: "Parabel" });
  assert.ok("settings" in own);
  const text = s.store.createInterpretation({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, settings: own.settings });
  const forStudent = await builder.generateTasks(settings({ studentId: s.sid, count: 2, useAI: false }), builder.studentContext(s.sid));
  assert.ok(forStudent.tasks.every((t) => t.data.passageTitle === "„Die Brücke“ von Erfundene Autorin" && t.data.textsorte === "Parabel"), "the student's latest story");
  assert.ok(forStudent.tasks.every((t) => !t.answer.sample), "no model answer for a story DreamStudy does not know");

  const draft = await builder.createDraft({ ...settings({ studentId: s.sid, count: 7, useAI: false }), title: "Teilübungen" }, s.niko.id, { auftragTextId: text.id });
  const tasks = repo.listTasks(draft.id);
  assert.equal(tasks.length, 7);
  assert.deepEqual(tasks.map((t) => t.data.teil), ["einleitung", "inhalt", "sprache", "form", "figur", "deutung", "schluss"]);
  const form = tasks.find((t) => t.data.teil === "form")!;
  const before = form.prompt;
  const res = await builder.regenerateTask(form.id);
  assert.deepEqual(res, { ok: true });
  const again = repo.getTask(form.id)!;
  assert.equal(again.data.teil, "form");
  assert.notEqual(again.prompt, before, "the other wording");
  assert.match(again.prompt, /Merkmale der Parabel/);
  assert.equal(again.data.passage, form.data.passage);
  await builder.regenerateTask(form.id);
  assert.equal(repo.getTask(form.id)!.prompt, before, "and back");
});

test("recommendation path: a worksheet for Textinterpretation is Teilübungen, without KI", async () => {
  const { buildWorksheet } = await import("./service");
  const repo = await import("./repo");
  const { out, calls } = await withStub(() => {
    throw new Error("no KI");
  }, () => buildWorksheet({ subject: "Deutsch", schoolType: "Gymnasium", klasse: 7, skillIds: [SKILL], difficulty: "mittel", count: 10, taskType: "mixed", kind: "uebung" } as Parameters<typeof buildWorksheet>[0]));
  assert.equal(calls.length, 0);
  const tasks = repo.listTasks(out.id);
  assert.equal(tasks.length, 10);
  assert.ok(tasks.every((t) => t.data.teil && t.data.zeilen && t.type === "free"));
});

// ---------- KI correction ----------

test("KI correction: recognised as Textinterpretation, the school's seven parts, the story is not sent, the author is no hidden name", async () => {
  const s = await setup("Clara Korrektur");
  const tc = await import("./text-correction");
  const { correctionPrompt } = await import("./ai/textkorrektur");
  const { kindCriteria } = await import("./text-correction-rules");
  const b = await ex();
  const text = s.store.createInterpretation({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, settings: s.settings });
  const written = `${b.beispielInterpretation()}\nClara findet das Ende schön.`;
  assert.ok(s.texts.saveText(text.id, await docOf(written), 0).ok);
  const t = s.texts.getText(text.id)!;
  assert.ok(!tc.foundNames(t, s.texts.textDoc(t)).some((n) => /Brunnhofer/.test(n)), "the author is not masked");
  const req = tc.correctionRequest(t, s.texts.textDoc(t));
  assert.equal(req.kind, "Textinterpretation");
  assert.deepEqual(req.source, { title: "Sieben Uhr zwölf", author: "Ida Brunnhofer", year: "2026", kind: "Kurzgeschichte", lines: 68 });
  const prompt = correctionPrompt(req);
  for (const k of ["Textsorte: Textinterpretation", "Deutungshypothese", "Inhaltsangabe im Präsens", "Gliederung in Abschnitte mit Zeilenangaben", "Zitat, Zeilenangabe und Wirkung", "Charakterisierung der Hauptfigur", "Bedeutung des Titels", "begründeter eigener Stellungnahme"]) assert.ok(prompt.includes(k), k);
  assert.match(prompt, /Interpretierter Text: Kurzgeschichte „Sieben Uhr zwölf“ von Ida Brunnhofer \(2026\), 68 Zeilen\./);
  assert.match(prompt, /Prüfe Zitate und Zeilenangaben nicht auf Richtigkeit/);
  assert.ok(!prompt.includes("Jetzt steckt er die Hand in die Tasche"), "a line of the story that the interpretation does not quote is not sent");
  assert.ok(prompt.includes("Brunnhofer"), "the author's name stays in the text");
  assert.ok(!prompt.includes("Clara"), "the student's name is masked");
  // Textanalyse keeps its own rule
  assert.match(kindCriteria("Textanalyse"), /^Textanalyse:/);
  assert.match(kindCriteria("Interpretation"), /^Textinterpretation/);

  const { out, calls } = await withStub(
    () => ({ findings: [], hints: [], strengths: ["Klarer Aufbau"], main_issue: null, recommendation: null, recommendation_skill_id: null }),
    async () => tc.startAICorrection(text.id, s.niko.id, { consent: true, wait: true }),
  );
  assert.ok(out.ok, JSON.stringify(out));
  assert.equal(calls.length, 1);
  assert.match(String(calls[0].content), /Textinterpretation \(Oberstufe/);
  assert.match(String(calls[0].content), /Interpretierter Text: Kurzgeschichte/);
});
