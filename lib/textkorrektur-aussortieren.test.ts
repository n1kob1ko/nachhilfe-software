import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

/**
 * The second check alone does not sort out what step 1 made both in its list and in its own sentence (Textkorrektur,
 * 2026-10-11). In the tests of 2026-10-09 to 2026-10-11 all 7 suggestions of „gründlich neu“ sorted out because the
 * check wanted the student's words kept were right; the same verdict with an empty better_replacement was only marked.
 * Such a suggestion is now marked for the teacher („Genau prüfen“). Synthetic texts only, none of the test sets.
 */

type AIRequest = import("./ai/router").AIRequest;
type Item = import("./text-correction").CorrectionItem;
type Verdict = { verdict: string; better?: string | null; reason: string };

const para = (...lines: string[]) => lines.map((x) => ({ t: "p" as const, r: [{ x }] }));
const f = (quote: string, replacement: string, category: string, explanation: string, o: { kind?: string; sure?: boolean } = {}) => ({
  quote, replacement, category, kind: o.kind ?? "fehler", rule: category, explanation, skill_id: null, sure: o.sure ?? true,
});

/** Step 1 answers with `sentences`; step 2 judges every suggestion by its quoted change (`verdicts`), confirms the rest. */
function fakeKI(sentences: unknown[], verdicts: Record<string, Verdict>, calls: AIRequest[] = []) {
  return async (req: AIRequest) => {
    calls.push(req);
    const usage = { input: 1000, output: 800, cacheWrite: 0, cacheRead: 0 };
    let data: unknown;
    if (req.fn === "textanalyse") data = { sentences, hints: [], strengths: [], main_issue: null, recommendation: null, recommendation_skill_id: null };
    else {
      const checks: unknown[] = [];
      for (const m of String(req.content).matchAll(/^Vorschlag (\d+) [^\n]*\n[^\n]*\n[^\n]*\nÄnderung: „([^“]*)“/gm)) {
        const v = verdicts[m[2]] ?? { verdict: "richtig", reason: "" };
        checks.push({ nr: Number(m[1]), verdict: v.verdict, explanation_ok: true, better_replacement: v.better ?? null, better_explanation: null, reason: v.reason });
      }
      data = { checks, missed: [] };
    }
    return { parsed: data, refusal: false, model: req.model, usage };
  };
}

async function run(subject: string, lines: string[], sentences: unknown[], verdicts: Record<string, Verdict>) {
  const before = process.env.AI_TEXT_GRUENDLICH;
  process.env.AI_TEXT_GRUENDLICH = "neu";
  const repo = await import("./repo");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const router = await import("./ai/router");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({ name: "Kim Probe", grade: 4, klasse: 4, teacher_id: niko.id, school: "", school_type: "Volksschule", subjects: [subject], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: null, subject, topic: "Erzählung", title: "Mein Wochenende", prompt: "Erzähle." });
  assert.ok(texts.saveText(text.id, para(...lines), 0).ok);
  router.resetRouter();
  const calls: AIRequest[] = [];
  router.setTransport(fakeKI(sentences, verdicts, calls));
  try {
    const res = await tc.startAICorrection(text.id, niko.id, { consent: true, wait: true, method: "gruendlich" });
    assert.ok(res.ok);
    const c = tc.getCorrection(res.correctionId)!;
    assert.deepEqual([c.ai_status, c.verify_status], ["fertig", "ok"]);
    assert.deepEqual(calls.map((r) => r.fn), ["textanalyse", "textpruefung"], "no extra KI request");
    return { tc, niko, c };
  } finally {
    router.setTransport(null);
    if (before === undefined) delete process.env.AI_TEXT_GRUENDLICH;
    else process.env.AI_TEXT_GRUENDLICH = before;
  }
}

const by = (items: Item[], quote: string) => items.find((i) => i.quote === quote)!;
const endText = (tc: typeof import("./text-correction"), c: import("./text-correction").CorrectionRow) => tc.applyAccepted(tc.snapshotDoc(c), tc.listItems(c.id)).doc.map((b) => b.r.map((r) => r.x).join(""));

const DE = ["Ich glaube dass unsere Klasse morgen gewinnt.", "Mein Opa erzählen gern Geschichten. Am Abend las ich ein Buch.", "Das Fest war sehr schön. Wir hatten fiel Spaß."];
const DE_STEP1 = [
  // list and sentence agree, the KI is not sure
  { id: "1.1", corrected: "Ich glaube, dass unsere Klasse morgen gewinnt.", findings: [f("glaube dass", "glaube, dass", "zeichensetzung", "Vor „dass“ steht ein Beistrich.", { sure: false })] },
  // list and sentence agree; listed, but the KI's sentence leaves the place as it is
  { id: "2.1", corrected: "Mein Opa erzählt gern Geschichten.", findings: [f("erzählen", "erzählt", "grammatik", "Zu „Opa“ passt „erzählt“.")] },
  { id: "2.2", corrected: "Am Abend las ich ein Buch.", findings: [f("Abend las", "Abend, las", "zeichensetzung", "Nach der Zeitangabe steht ein Beistrich.")] },
  // only in the KI's sentence, not in its list
  { id: "3.1", corrected: "Das Fest war wunderschön.", findings: [] },
  { id: "3.2", corrected: "Wir hatten viel Spaß.", findings: [f("fiel", "viel", "rechtschreibung", "„viel“ schreibt man mit v.")] },
];

test("zweite Prüfung: was Liste und Satzfassung der ersten gleich verbessern, wird markiert statt aussortiert", async () => {
  const { tc, niko, c } = await run("Deutsch", DE, DE_STEP1, {
    // the check wants the student's words kept: as the place itself, or as the place with the word after it
    "glaube dass": { verdict: "falsch", better: "glaube dass", reason: "Der Beistrich ist hier wahlfrei." },
    erzählen: { verdict: "falsch", better: "erzählen gern", reason: "Der Text steht in der Vergangenheit." },
    "Abend las": { verdict: "falsch", better: "Abend las", reason: "Nach einer kurzen Zeitangabe steht kein Beistrich." },
    "sehr schön": { verdict: "falsch", better: "sehr schön", reason: "„sehr schön“ ist richtig." },
    fiel: { verdict: "falsch", better: null, reason: "Das Wort ist unklar." },
  });
  const items = tc.listItems(c.id);
  const comma = by(items, "glaube dass");
  assert.deepEqual([comma.status, comma.review], ["offen", "lehrer"], "both of step 1 against the check: a doubt, shown");
  assert.match(comma.review_note, /nicht sicher/);
  assert.match(comma.review_note, /Die zweite Prüfung würde die Stelle lassen, wie sie ist: Der Beistrich ist hier wahlfrei\./);
  const verb = by(items, "erzählen");
  assert.deepEqual([verb.status, verb.review, verb.replacement], ["offen", "lehrer", "erzählt"], "the check's words with the neighbour word mean the same");
  assert.match(verb.review_note, /würde die Stelle lassen, wie sie ist: Der Text steht in der Vergangenheit\./);
  // the same verdict without the student's words was marked before and stays so
  const spelling = by(items, "fiel");
  assert.deepEqual([spelling.status, spelling.review], ["offen", "lehrer"]);
  assert.match(spelling.review_note, /hält das für falsch: Das Wort ist unklar\./);
  // step 1 itself disagreed with itself: the check decides, as before
  const listOnly = by(items, "Abend las");
  assert.deepEqual([listOnly.status, listOnly.review], ["abgelehnt", "verworfen"]);
  assert.match(listOnly.review_note, /Von der zweiten Prüfung aussortiert: Nach einer kurzen Zeitangabe/);
  const silent = items.find((i) => i.replacement === "wunderschön")!;
  assert.deepEqual([silent.origin, silent.status, silent.review], ["fassung", "abgelehnt", "verworfen"]);

  // nothing marked goes through „Alle übernehmen“
  assert.equal(tc.decideAll(c.id, "uebernommen", niko.id), 0);
  assert.ok(tc.listItems(c.id).every((i) => i.status !== "uebernommen"));
  assert.deepEqual(endText(tc, c), DE, "the text stays as the student wrote it");
  // the teacher accepts the right one by hand
  const taken = tc.decideItem(c.id, comma.id, "uebernommen", niko.id);
  assert.ok(taken && "item" in taken && taken.item?.status === "uebernommen");
  assert.equal(endText(tc, c)[0], "Ich glaube, dass unsere Klasse morgen gewinnt.");
});

test("zweite Prüfung: dasselbe für Englisch; was sie bestätigt, bleibt unmarkiert", async () => {
  const lines = ["My sister play the piano every day. Yesterday we go to the park."];
  const { tc, niko, c } = await run(
    "Englisch",
    lines,
    [
      { id: "1.1", corrected: "My sister plays the piano every day.", findings: [f("play", "plays", "grammatik", "With he, she or it the verb takes -s.")] },
      { id: "1.2", corrected: "Yesterday we went to the park.", findings: [f("go", "went", "grammatik", "Past simple with „yesterday“.")] },
    ],
    { play: { verdict: "falsch", better: "play", reason: "The story is in the past, so „plays“ is a tense error." } },
  );
  const items = tc.listItems(c.id);
  assert.deepEqual([by(items, "play").status, by(items, "play").review], ["offen", "lehrer"]);
  assert.deepEqual([by(items, "go").status, by(items, "go").review], ["offen", ""]);
  assert.equal(tc.decideAll(c.id, "uebernommen", niko.id), 1);
  assert.deepEqual(endText(tc, c), ["My sister play the piano every day. Yesterday we went to the park."]);
});

test("zweite Prüfung: wann Liste und Satzfassung übereinstimmen, in beiden Fassungen von „gründlich“", async () => {
  const { analysisFindings, applyVerdicts, comparedFindings, sentencesFor } = await import("./ai/textkorrektur-gruendlich");
  const text = "Ich glaube dass er kommt. Wir spielten Fusball. Er lachte laut.";
  const req = { subject: "Deutsch", blocks: [{ text, heading: false }] } as unknown as Parameters<typeof sentencesFor>[0];
  const sentences = sentencesFor(req);
  const data = {
    sentences: [
      { id: sentences[0].id, corrected: "Ich glaube, dass er kommt.", findings: [f("glaube dass", "glaube, dass", "zeichensetzung", "Beistrich vor „dass“.")] },
      // the list says „Fußball“, the KI's sentence keeps the student's word
      { id: sentences[1].id, corrected: "Wir spielten Fusball.", findings: [f("Fusball", "Fußball", "rechtschreibung", "Fußball mit ß.")] },
      // no sentence of the KI to compare with
      { id: sentences[2].id, corrected: "", findings: [f("lachte laut", "lachte sehr laut", "ausdruck", "Genauer.", { kind: "stil" })] },
    ],
  } as never;
  const flags = (fs: { quote: string; agreed?: boolean }[]) => Object.fromEntries(fs.map((x) => [x.quote, Boolean(x.agreed)]));
  assert.deepEqual(flags(analysisFindings(sentences, data).findings), { "glaube dass": true, Fusball: false, "lachte laut": false }, "bisher");
  assert.deepEqual(flags(comparedFindings(sentences, data).findings), { "glaube dass": true, Fusball: false, "lachte laut": false }, "neu");

  // applyVerdicts: the same verdict, with and without that agreement
  const item = (agreed: boolean) => ({ block: 0, pos_start: 4, pos_end: 15, quote: "glaube dass", replacement: "glaube, dass", category: "zeichensetzung", kind: "fehler", rule: "", explanation: "Beistrich vor „dass“.", review: "" as const, review_note: "", origin: "analyse" as const, ...(agreed ? { agreed } : {}) });
  const proposals = [0, 1].map((k) => ({ k, para: 1, start: 4, end: 15, quote: "glaube dass", replacement: "glaube, dass", before: "Ich ", after: " er kommt." }));
  const check = (nr: number) => ({ nr, verdict: "falsch", explanation_ok: true, better_replacement: "glaube dass", better_explanation: null, reason: "Wahlfrei." });
  const out = applyVerdicts([item(true), item(false)], proposals, { checks: [check(1), check(2)], missed: [] }, null).items;
  assert.deepEqual([out[0].review, out[0].replacement], ["lehrer", "glaube, dass"]);
  assert.equal(out[1].review, "verworfen");
});
