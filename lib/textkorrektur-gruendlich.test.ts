import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type AIRequest = import("./ai/router").AIRequest;

const STORY = [
  "Am Samstag fuhr ich mit meinen Freund Max zum See.",
  "Wir fuhren mit dem Fahrad. Dann gehte ich ins Wasser.",
  "Ich blieb lange im Haus weil es regnete. Es war sehr sehr schön.",
];
const para = (...lines: string[]) => lines.map((x) => ({ t: "p" as const, r: [{ x }] }));
const f = (quote: string, replacement: string, category: string, explanation: string, o: { kind?: string; sure?: boolean } = {}) => ({
  quote,
  replacement,
  category,
  kind: o.kind ?? "fehler",
  rule: category,
  explanation,
  skill_id: null,
  sure: o.sure ?? true,
});

/** Step 1 answers for every sentence but 3.1; step 2 judges by the quoted change. */
function fakeKI(o: { calls: AIRequest[]; failCheck?: boolean; einfach?: boolean }) {
  return async (req: AIRequest) => {
    o.calls.push(req);
    const prompt = String(req.content);
    const usage = { input: 1000, output: 800, cacheWrite: 0, cacheRead: 0 };
    let data: unknown;
    if (req.fn === "textkorrektur") {
      data = {
        findings: [{ para: 2, quote: "Fahrad", replacement: "Fahrrad", category: "rechtschreibung", kind: "fehler", rule: "rr", explanation: "Fahrrad schreibt man mit rr.", skill_id: null }],
        hints: [],
        strengths: [],
        main_issue: null,
        recommendation: null,
        recommendation_skill_id: null,
      };
    } else if (req.fn === "textanalyse") {
      data = {
        sentences: [
          {
            id: "1.1",
            corrected: "Am Samstag fuhr ich mit meinem Freund [Name] zum See.",
            findings: [
              f("meinen Freund", "meinem Freund", "grammatik", "Nach „mit“ steht der Dativ."),
              // overlaps the one before: counted, not silently lost
              f("meinen", "meinem", "grammatik", "Dativ."),
            ],
          },
          { id: "2.1", corrected: "Wir fuhren mit dem Fahrrad.", findings: [f("Fahrad", "Fahrrad", "rechtschreibung", "Fahrrad schreibt man mit rr.")] },
          {
            id: "2.2",
            corrected: "Dann ging ich ins Wasser.",
            findings: [f("gehte", "ging", "grammatik", "Nach „dann“ steht der Dativ."), f("ins Wasser", "in das Wasser", "grammatik", "„ins“ ist Umgangssprache.")],
          },
          { id: "3.2", corrected: "Es war wunderschön.", findings: [f("sehr sehr schön", "wunderschön", "ausdruck", "Ein Wort statt der Wiederholung.", { kind: "stil", sure: false })] },
        ],
        hints: [{ category: "aufbau", para: null, text: "Der Schluss fehlt." }],
        strengths: ["Klare Reihenfolge"],
        main_issue: "Fälle",
        recommendation: null,
        recommendation_skill_id: null,
      };
    } else {
      if (o.failCheck) throw new Error("Netzwerk weg");
      const checks: unknown[] = [];
      for (const m of prompt.matchAll(/^Vorschlag (\d+) [^\n]*\n[^\n]*\n[^\n]*\nÄnderung: „([^“]*)“/gm)) {
        const nr = Number(m[1]);
        const q = m[2];
        const base = { nr, explanation_ok: true, better_replacement: null, better_explanation: null, reason: "" };
        if (q === "ins Wasser") checks.push({ ...base, verdict: "falsch", better_replacement: "ins Wasser", reason: "„ins“ ist richtig." });
        else if (q === "meinen Freund") checks.push({ ...base, verdict: "unsicher", reason: "Vielleicht ist der Akkusativ gemeint." });
        else if (q === "gehte") checks.push({ ...base, verdict: "richtig", explanation_ok: false, better_explanation: "Die Vergangenheit von „gehen“ heißt „ging“." });
        else checks.push({ ...base, verdict: "richtig" });
      }
      data = { checks, missed: [{ para: 3, quote: "lange", replacement: "lang", category: "ausdruck", kind: "stil", rule: "Wortwahl", explanation: "Kürzer.", skill_id: null }] };
    }
    return { parsed: data, refusal: false, model: req.model, usage };
  };
}

const kid = (name: string, teacherId: number) => ({
  name, grade: 4, klasse: 4, teacher_id: teacherId, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

async function setup(name: string) {
  const repo = await import("./repo");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const router = await import("./ai/router");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: null, subject: "Deutsch", topic: "Erlebniserzählung", title: "Am See", prompt: "Erzähle von einem Ausflug." });
  assert.ok(texts.saveText(text.id, para(...STORY), 0).ok);
  router.resetRouter();
  return { tc, router, niko, textId: text.id };
}

const by = (items: import("./text-correction").CorrectionItem[], quote: string) => items.find((i) => i.quote === quote)!;

test("gründlich: Satz für Satz, zweite Prüfung, Regeln; was zweifelhaft ist, ist markiert", async () => {
  const s = await setup("Max Muster");
  const calls: AIRequest[] = [];
  s.router.setTransport(fakeKI({ calls }));
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true, method: "gruendlich" });
  assert.ok(res.ok);
  const c = s.tc.getCorrection(res.correctionId)!;
  assert.equal(c.ai_status, "fertig");
  assert.equal(c.method, "gruendlich");
  assert.deepEqual(calls.map((r) => r.fn), ["textanalyse", "textpruefung"]);
  const [analyse, pruefung] = calls.map((r) => String(r.content));
  assert.match(analyse, /^\[3\.1\] Ich blieb lange im Haus weil es regnete\.$/m, "every sentence goes out numbered");
  assert.match(analyse, /^\[1\.1\] Am Samstag fuhr ich mit meinen Freund \[Name\] zum See\.$/m);
  for (const p of [analyse, pruefung]) assert.ok(!p.includes("Max"), "names never leave the app");
  assert.match(pruefung, /Vorher: {2}Dann gehte ich ins Wasser\.\nNachher: Dann ging ich ins Wasser\./, "the check sees the whole sentence before and after");
  assert.match(pruefung, /\[2\] Wir fuhren mit dem ⟦Fahrrad⟧\. Dann ⟦ging⟧ ich ⟦in das Wasser⟧\./, "and the text with every suggestion");

  assert.equal(c.unchecked, "3.1", "a sentence the KI left out is reported");
  assert.equal(c.verify_status, "ok");
  assert.ok(c.dropped >= 1, "the overlapping finding is counted");
  const items = s.tc.listItems(c.id);
  assert.equal(by(items, "Fahrad").review, "", "confirmed: nothing to flag");
  assert.equal(by(items, "Fahrad").origin, "analyse");
  assert.equal(by(items, "meinen Freund").review, "lehrer");
  assert.match(by(items, "meinen Freund").review_note, /unsicher/);
  const tense = by(items, "gehte");
  assert.equal(tense.explanation, "Die Vergangenheit von „gehen“ heißt „ging“.", "a wrong explanation is replaced");
  assert.equal(tense.review, "lehrer");
  const wrong = by(items, "ins Wasser");
  assert.deepEqual([wrong.status, wrong.review, wrong.decided_by], ["abgelehnt", "verworfen", null], "a wrong suggestion is sorted out, not shown");
  const rule = by(items, "Haus weil");
  assert.deepEqual([rule.origin, rule.review, rule.replacement], ["regel", "", "Haus, weil"], "the program's rule, confirmed by the check");
  assert.equal(by(items, "sehr sehr schön").review, "lehrer", "the analysis was not sure: stays marked even when the check agrees");
  const missed = by(items, "lange");
  assert.deepEqual([missed.origin, missed.review], ["pruefung", "lehrer"]);
  assert.ok(items.every((i) => i.status === "offen" || i.review === "verworfen"), "nothing is accepted without the teacher");

  // „Alle übernehmen“ leaves out what is marked
  s.tc.decideAll(c.id, "uebernommen", s.niko.id);
  const after = s.tc.listItems(c.id);
  assert.equal(by(after, "Fahrad").status, "uebernommen");
  assert.equal(by(after, "Haus weil").status, "uebernommen");
  for (const q of ["meinen Freund", "gehte", "sehr sehr schön", "lange"]) assert.equal(by(after, q).status, "offen", q);
  assert.equal(by(after, "ins Wasser").status, "abgelehnt");
  // the teacher brings a sorted-out one back: open again, marked
  s.tc.decideItem(c.id, wrong.id, "offen", s.niko.id);
  assert.deepEqual([by(s.tc.listItems(c.id), "ins Wasser").status, by(s.tc.listItems(c.id), "ins Wasser").review], ["offen", "lehrer"]);
  // a sorted-out suggestion never counts
  assert.equal(s.tc.overview(after.filter((i) => i.quote !== "ins Wasser")).fehler, 2);
  s.router.setTransport(null);
});

test("gründlich: fällt die zweite Prüfung aus, ist jeder Vorschlag markiert", async () => {
  const s = await setup("Lisa Prüfung");
  const calls: AIRequest[] = [];
  s.router.setTransport(fakeKI({ calls, failCheck: true }));
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true, method: "gruendlich" });
  assert.ok(res.ok);
  const c = s.tc.getCorrection(res.correctionId)!;
  assert.equal(c.ai_status, "fertig", "step 1 is kept");
  assert.equal(c.verify_status, "fehler");
  const items = s.tc.listItems(c.id).filter((i) => i.kind !== "hinweis");
  assert.ok(items.length > 0);
  assert.ok(items.every((i) => i.review === "lehrer" && /fehlgeschlagen/.test(i.review_note)));
  s.router.setTransport(null);
});

test("Gründlich nachprüfen: offene KI-Vorschläge werden ersetzt, Entscheidungen bleiben", async () => {
  const s = await setup("Tom Nachprüfung");
  const calls: AIRequest[] = [];
  s.router.setTransport(fakeKI({ calls }));
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true });
  assert.ok(res.ok);
  const c = s.tc.getCorrection(res.correctionId)!;
  assert.equal(c.method, "einfach", "one request unless chosen otherwise");
  assert.deepEqual(calls.map((r) => r.fn), ["textkorrektur"]);
  const first = s.tc.listItems(c.id);
  s.tc.decideItem(c.id, by(first, "Fahrad").id, "uebernommen", s.niko.id);
  s.tc.addTeacherItem(c.id, { block: 0, start: 0, end: 2, category: "rechtschreibung", kind: "fehler", replacement: "Im", explanation: "Test" }, s.niko.id);

  const no = s.tc.startThoroughRecheck(c.id, s.niko.id, { consent: false });
  assert.ok(!("then" in no) && !no.ok, "never without consent");
  const again = await s.tc.startThoroughRecheck(c.id, s.niko.id, { consent: true, wait: true });
  assert.ok(again.ok && !again.reused);
  const c2 = s.tc.getCorrection(c.id)!;
  assert.equal(c2.method, "gruendlich");
  const items = s.tc.listItems(c.id);
  assert.equal(items.filter((i) => i.quote === "Fahrad").length, 1, "the decided place is not suggested again");
  assert.equal(by(items, "Fahrad").status, "uebernommen");
  assert.ok(items.some((i) => i.source === "lehrer"), "the teacher's own correction stays");
  assert.ok(items.some((i) => i.quote === "gehte" && i.origin === "analyse"));
  s.router.setTransport(null);
});

test("einfach: die Regelprüfungen markieren, was nicht zur Änderung passt", async () => {
  const s = await setup("Eva Einfach");
  const calls: AIRequest[] = [];
  const base = fakeKI({ calls });
  s.router.setTransport(async (req) => {
    const r = await base(req);
    const d = r.parsed as { findings: Record<string, unknown>[] };
    d.findings.push({ para: 3, quote: "Haus weil", replacement: "Haus, weil", category: "rechtschreibung", kind: "fehler", rule: "Beistrich", explanation: "Vor „weil“ steht ein Beistrich.", skill_id: null });
    return r;
  });
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true, method: "einfach" });
  assert.ok(res.ok);
  const items = s.tc.listItems(res.correctionId);
  assert.equal(by(items, "Fahrad").review, "");
  assert.equal(by(items, "Haus weil").review, "lehrer");
  assert.match(by(items, "Haus weil").review_note, /Satzzeichen/);
  assert.ok(!items.some((i) => i.origin === "regel"), "no extra suggestions without a check");
  s.router.setTransport(null);
});

test("gründlich: Änderungen, die nicht zum eigenen Satz der KI passen, und Verbesserungen, die nur Nachbarwörter wiederholen", async () => {
  const { offSentence, echoesNeighbours } = await import("./ai/textkorrektur-gruendlich");
  const { comparable } = await import("./text-correction-checks");
  const s = "Die Direktorin überreichte die Siegerklasse einen Pokal.";
  const corrected = comparable("Die Direktorin überreichte der Siegerklasse einen Pokal.");
  // a short quote with a long replacement leaves the wrong words in front
  assert.deepEqual([...offSentence(s, [{ quote: "Pokal", replacement: "der Siegerklasse den Pokal" }], corrected)], [0]);
  assert.deepEqual([...offSentence(s, [{ quote: "die Siegerklasse", replacement: "der Siegerklasse" }], corrected)], []);
  // a correct change next to one the model left out of the findings stays unmarked
  const two = "Wir furen mit meine Oma zum See.";
  assert.deepEqual([...offSentence(two, [{ quote: "furen", replacement: "fuhren" }], comparable("Wir fuhren mit meiner Oma an den See."))], []);

  assert.equal(echoesNeighbours({ quote: "voll", before: "Die 2a gewann ", after: " knapp vor der 2c." }, "voll knapp"), true);
  assert.equal(echoesNeighbours({ quote: "das", before: "behauptet, das Wirtshaus ist „", after: " Wohnzimmer des Dorfes“" }, "das Wohnzimmer"), true);
  assert.equal(echoesNeighbours({ quote: "voll", before: "Die 2a gewann ", after: " knapp vor der 2c." }, "sehr"), false);
  assert.equal(echoesNeighbours({ quote: "voll", before: "Die 2a gewann ", after: " knappe Siege." }, "voll knapp"), false, "only whole words");
});

test("gründlich: ein Platzhalter des Datenschutzfilters im Satz der KI steht für den Namen, die Notiz zeigt die Fassung der KI", async () => {
  const { holds, offSentence, analysisFindings, sentencesFor } = await import("./ai/textkorrektur-gruendlich");
  const { comparable } = await import("./text-correction-checks");
  // test 2026-10-09: right changes next to a name were marked, because the KI saw „[PERSON_NAME]“ there
  const s = "Our teacher, Mrs Berger, always say that trips are fun.";
  const own = comparable("Our teacher, [PERSON_NAME], always says that trips are fun.");
  assert.deepEqual([...offSentence(s, [{ quote: "always say", replacement: "always says" }], own)], []);
  assert.equal(holds(comparable("Während die Mutter packt, findet [PERSON_NAME] in einer Dose den Schlüssel."), "packt, findet Lea in"), true);
  assert.equal(holds(comparable("Am Ende erkennt [PERSON_NAME], dass sie loslassen muss."), "erkennt Lea"), true);
  assert.equal(holds(comparable("Am Ende erkennt [PERSON_NAME], dass sie loslassen muss."), "erkennt Lea, dass"), true);
  assert.equal(holds(comparable("Am Ende erkennt [PERSON_NAME], dass sie loslassen muss."), "erkannte Lea"), false);
  assert.equal(holds(comparable("Am Ende erkennt [PERSON_NAME], dass sie loslassen muss."), "erkennt Lea dass sie loslassen"), false, "the comma after the placeholder still counts");
  assert.equal(holds(comparable("Am Ende erkennt sie, dass sie loslassen muss."), "erkennt Lea"), false, "without a placeholder nothing is left open");
  // the short-quote case of test 1 is still caught
  const p = "Die Direktorin überreichte die Siegerklasse einen Pokal.";
  assert.deepEqual([...offSentence(p, [{ quote: "Pokal", replacement: "der Siegerklasse den Pokal" }], comparable("Die Direktorin überreichte der Siegerklasse den Pokal."))], [0]);

  const req = { subject: "Deutsch", schoolType: "Gymnasium", klasse: 4, textKind: "Bericht", task: "", level: { maxStyle: 2, maxMarks: 20 }, blocks: [{ text: p, heading: false }] } as unknown as Parameters<typeof sentencesFor>[0];
  const sentences = sentencesFor(req);
  const { findings } = analysisFindings(sentences, { sentences: [{ id: sentences[0].id, corrected: "Die [PERSON_NAME] überreichte der Siegerklasse den Pokal.", findings: [{ quote: "Pokal", replacement: "der Siegerklasse den Pokal", category: "grammatik", kind: "fehler", explanation: "Dativ.", sure: true }] }] } as never);
  assert.equal(findings[0].review, "lehrer");
  assert.equal(findings[0].review_note, "Die KI würde den ganzen Satz anders verbessern: „Die … überreichte der Siegerklasse den Pokal.“");
});

test("gründlich: Analyse und Prüfung bekommen das Antwortschema in den Anweisungen, damit Sonnet nachdenkt", async () => {
  const { chatBody } = await import("./ai/providers/openai-compatible");
  const { AnalysisSchema } = await import("./ai/textkorrektur-gruendlich");
  const req = { fn: "textanalyse" as const, provider: "openrouter" as const, model: "anthropic/claude-sonnet-5.5", maxTokens: 20_000, system: "S", cache: "aus" as const, content: "P", thinking: "adaptiv" as const, effort: "medium" as const, schema: AnalysisSchema, signal: new AbortController().signal, timeoutMs: 1000 };
  const inPrompt = chatBody({ ...req, schemaInPrompt: true }) as Record<string, unknown>;
  assert.equal(inPrompt.response_format, undefined);
  assert.deepEqual(inPrompt.reasoning, { effort: "medium" });
  assert.match((inPrompt.messages as { content: string }[])[0].content, /JSON-Schema/);
  assert.equal(((chatBody(req) as Record<string, unknown>).response_format as { type: string }).type, "json_schema");
});

test("Vorschläge mit einem fremden Platzhalter wie [PERSON_NAME] passen nicht zum Text und fallen weg", async () => {
  const { anchorFindings } = await import("./text-correction-core");
  const doc = para("Ich glaube, das Sie für alle da ist.");
  const finding = (quote: string, replacement: string) => ({ para: 1, quote, replacement, category: "rechtschreibung", kind: "fehler", rule: "", explanation: "Hier steht die Konjunktion „dass“.", skill_id: null });
  const r = anchorFindings(doc, { findings: [finding("glaube, [PERSON_NAME] für", "glaube, dass Sie für"), finding("das Sie", "dass Sie")], hints: [] }, { pattern: null, level: { maxStyle: 5, maxMarks: 20 }, skills: new Set() });
  assert.deepEqual(r.items.map((i) => i.quote), ["das Sie"]);
  assert.equal(r.dropped, 1);
});

test("Stelle finden: ganze Wörter zuerst, ein einzelner Buchstabe nie mitten im Wort", async () => {
  const { findQuote } = await import("./text-correction-core");
  const t = "We had a great time, Lena and i went home.";
  assert.equal(findQuote(t, "i", 0, [])?.start, t.indexOf(" i ") + 1);
  assert.equal(findQuote("It was time to go.", "i", 0, []), null);
  assert.equal(findQuote("Das Fahrrad und das Fahrradschloss", "Fahrrad", 10, [])?.start, 4, "a whole word before a part of a word");
  assert.equal(findQuote("Die Fahrradschlösser", "Fahrrad", 0, [])?.start, 4, "longer quotes may be part of a word");
});

test("gründlich neu: Vorschläge aus dem Fassungsvergleich, die Liste der KI liefert die Erklärungen", async () => {
  const { comparedFindings, sentencesFor, SILENT_EXPLANATION } = await import("./ai/textkorrektur-gruendlich");
  const text = [
    "Im folgenden Text wird über dem Thema erörtert.",
    "Man probiert es, wenn man im Spiel ein Fehler macht.",
    "Deshalb die Lehrer müssten ständig schauen.",
    "Ich blieb im Haus weil es regnete.",
    "Die Rede war kurtz.",
    "Ich weiß, das das stimmt.",
  ].join(" ");
  const req = { subject: "Deutsch", blocks: [{ text, heading: false }] } as unknown as Parameters<typeof sentencesFor>[0];
  const sentences = sentencesFor(req);
  const id = (k: number) => sentences[k].id;
  const { findings } = comparedFindings(sentences, {
    sentences: [
      // the list says „über das“, the KI's own sentence drops the preposition: the version wins, marked, both shown
      { id: id(0), corrected: "Im folgenden Text wird das Thema erörtert.", findings: [f("über dem", "über das", "grammatik", "Nach „über“ steht der Akkusativ.", { sure: false })] },
      // fixed in the sentence, never listed
      { id: id(1), corrected: "Man probiert es, wenn man im Spiel einen Fehler macht.", findings: [] },
      // list and version agree on the moved verb
      { id: id(2), corrected: "Deshalb müssten die Lehrer ständig schauen.", findings: [f("Deshalb die Lehrer müssten", "Deshalb müssten die Lehrer", "satzbau", "Nach „deshalb“ steht das Verb an zweiter Stelle.")] },
      // listed, but the KI's own sentence leaves the place as it is
      { id: id(3), corrected: "Ich blieb im Haus weil es regnete.", findings: [f("Haus weil", "Haus, weil", "zeichensetzung", "Vor „weil“ steht ein Beistrich.")] },
      // fehlerfrei bis auf kurtz, listed and written the same way
      { id: id(4), corrected: "Die Rede war kurz.", findings: [f("kurtz", "kurz", "rechtschreibung", "„kurz“ ohne t.")] },
      // the quote stands twice in the sentence: it belongs where the version changes it
      { id: id(5), corrected: "Ich weiß, dass das stimmt.", findings: [f("das", "dass", "rechtschreibung", "Das Bindewort „dass“ schreibt man mit ss.")] },
    ],
  } as never);
  const by = (q: string) => findings.find((x) => x.quote === q)!;
  assert.equal(by("über dem").replacement, "das");
  assert.equal(by("über dem").origin, "fassung");
  assert.equal(by("über dem").explanation, SILENT_EXPLANATION, "the list's explanation belongs to another change");
  assert.match(by("über dem").review_note!, /nicht sicher.*„über dem“ → „über das“/);
  assert.equal(by("ein").replacement, "einen");
  assert.equal(by("ein").review, "lehrer");
  assert.equal(by("ein").category, "grammatik");
  assert.equal(by("Deshalb die Lehrer müssten").replacement, "Deshalb müssten die Lehrer");
  assert.equal(by("Deshalb die Lehrer müssten").review, "", "list and version agree");
  assert.equal(by("Deshalb die Lehrer müssten").explanation, "Nach „deshalb“ steht das Verb an zweiter Stelle.");
  assert.equal(by("Haus weil").review, "lehrer");
  assert.match(by("Haus weil").review_note!, /lässt die KI diese Stelle unverändert/);
  assert.equal(by("kurtz").review, "");
  assert.equal(by("kurtz").origin, "analyse");
  assert.equal(by("das").replacement, "dass");
  assert.equal(by("das").review, "");
  assert.equal(by("das").from, text.indexOf("das das"));
  assert.equal(findings.filter((x) => x.quote === "das").length, 1);
  // every change sits exactly where the sentence has it
  for (const x of findings) assert.equal(text.slice(x.from!, x.from! + x.quote.length), x.quote);
});

test("gründlich neu: ausgeblendete Wörter werden erkannt; fehlt ein Grammatikwort wie „Sie“, ist der Satz markiert", async () => {
  const { comparedFindings, hiddenInVersions, sentencesFor } = await import("./ai/textkorrektur-gruendlich");
  const text = "Ich bin froh, das Sie mir geholfen haben. Am Ende erkannte Lea, dass sie loslassen muss.";
  const req = { subject: "Deutsch", blocks: [{ text, heading: false }] } as unknown as Parameters<typeof sentencesFor>[0];
  const sentences = sentencesFor(req);
  const data = {
    sentences: [
      { id: sentences[0].id, corrected: "Ich bin froh, dass [PERSON_NAME] mir geholfen haben.", findings: [f("das", "dass", "rechtschreibung", "Bindewort dass.")] },
      { id: sentences[1].id, corrected: "Am Ende erkennt [PERSON_NAME], dass sie loslassen muss.", findings: [f("erkannte", "erkennt", "grammatik", "Präsens.")] },
    ],
  } as never;
  const r = comparedFindings(sentences, data);
  assert.deepEqual(r.hidden.map((h) => [h.text, h.grammar]), [["Sie", true], ["Lea", false]]);
  const das = r.findings.find((x) => x.quote === "das")!;
  assert.equal(das.review, "lehrer");
  assert.match(das.review_note!, /Datenschutzfilter hat in diesem Satz „Sie“ ausgeblendet/);
  // right next to what the filter hid: the KI did not see all of it (a name and a noun look the same to it)
  const erkannte = r.findings.find((x) => x.quote === "erkannte")!;
  assert.equal(erkannte.review, "lehrer");
  assert.match(erkannte.review_note!, /Direkt neben Wörtern, die der Datenschutzfilter ausgeblendet hat/);
  // „bisher“ sees the hidden words in the sentences the KI wrote out
  assert.deepEqual(hiddenInVersions(sentences, data).map((h) => h.text), ["Sie", "Lea"]);
});

test("gründlich neu: eine Änderung nur aus der Satzfassung verliert die Markierung, wenn die zweite Prüfung sie bestätigt und erklärt", async () => {
  const { applyVerdicts, SILENT_EXPLANATION } = await import("./ai/textkorrektur-gruendlich");
  const it = (review_note: string) => ({ block: 0, pos_start: 0, pos_end: 3, quote: "ein", replacement: "einen", category: "grammatik", kind: "fehler", rule: "", explanation: SILENT_EXPLANATION, review: "lehrer" as const, review_note, origin: "fassung" as const });
  const items = [it("Nur in der Satzfassung der KI, nicht in ihrer Liste."), it("Nur in der Satzfassung der KI, nicht in ihrer Liste."), it("In ihrer Liste schlägt die KI „ein“ → „eine“ vor, in ihrer Satzfassung diese Lösung.")];
  const proposals = items.map((_, k) => ({ k, para: 1, start: 0, end: 3, quote: "ein", replacement: "einen" }));
  const check = (nr: number, better: string | null) => ({ nr, verdict: "richtig", explanation_ok: true, better_replacement: null, better_explanation: better, reason: "Akkusativ nach machen.", category: "grammatik" });
  const out = applyVerdicts(items, proposals, { checks: [check(1, "„machen“ verlangt den Akkusativ: einen Fehler."), check(2, null), check(3, "Akkusativ.")], missed: [] }, null).items;
  assert.equal(out[0].review, "");
  assert.equal(out[0].explanation, "„machen“ verlangt den Akkusativ: einen Fehler.");
  assert.equal(out[1].review, "lehrer", "no explanation: still marked");
  assert.equal(out[2].review, "lehrer", "list and version disagree: still marked");
});

test("gründlich neu: was die KI aus den Kennzeichnungen der Anweisung abschreibt, gehört nicht zur Satzfassung", async () => {
  const { versionText } = await import("./ai/textkorrektur-gruendlich");
  assert.equal(versionText("[3.3[PERSON_NAME] nennt sie hohe Kosten.", "Als Gründe nennt sie hohe Kosten."), "[PERSON_NAME] nennt sie hohe Kosten.");
  assert.equal(versionText("[2.1] Das stimmt.", "Das stimmt."), "Das stimmt.");
  assert.equal(versionText("(Überschrift) Beschwerde über einen Rucksack", "Beschwerde über einen Rucksack"), "Beschwerde über einen Rucksack");
  assert.equal(versionText("[1] Punkt eins", "[1] Punkt eins"), "[1] Punkt eins", "the student's own bracket stays");
  assert.equal(versionText(null, "Das stimmt."), "");
});
