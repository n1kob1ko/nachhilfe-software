import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

/**
 * Gerade Anführungszeichen ("…") sind kein Fehler (niko, 2026-10-20): Schülerinnen und Schüler tippen sie, die KI hat
 * sie in „…“ verbessert, beim Zitieren in der Textinterpretation ebenso wie bei der wörtlichen Rede. Eine Änderung nur
 * der Art der Anführungszeichen wird kein Vorschlag, und eine echte Verbesserung behält die geraden. Erfundene Texte.
 */

type AIRequest = import("./ai/router").AIRequest;
type Item = import("./text-correction").CorrectionItem;

const para = (...lines: string[]) => lines.map((x) => ({ t: "p" as const, r: [{ x }] }));
const f = (quote: string, replacement: string, category: string, explanation: string) => ({ quote, replacement, category, kind: "fehler", rule: category, explanation, skill_id: null, sure: true });
const level = { maxStyle: 5, maxMarks: 20 };

test("Anführungszeichen: gerade und deutsche gelten gleich, Fehlen ist ein Fehler", async () => {
  const { onlyQuotesDiffer, keepQuoteStyle, quoteStyleHint } = await import("./text-correction-checks");
  assert.equal(onlyQuotesDiffer('"Haus"', "„Haus“"), true);
  assert.equal(onlyQuotesDiffer('"Haus"', "»Haus«"), true);
  assert.equal(onlyQuotesDiffer("'Haus'", "‚Haus‘"), true);
  assert.equal(onlyQuotesDiffer('"Haus"', '"Haus"'), false, "the same is no difference");
  assert.equal(onlyQuotesDiffer('"Haus" sagte', "„Haus“, sagte"), false, "a Beistrich more is a correction");
  assert.equal(onlyQuotesDiffer("'Haus'", "„Haus“"), false, "single and double ones are not the same");
  assert.equal(onlyQuotesDiffer("Haus", "„Haus“"), false, "missing quotation marks are an error");

  assert.equal(keepQuoteStyle('"Hallo" sagte', "„Hallo“, sagte"), '"Hallo", sagte');
  assert.equal(keepQuoteStyle("„Hallo“ sagte", "„Hallo“, sagte"), "„Hallo“, sagte", "who writes „…“ keeps them");
  assert.equal(keepQuoteStyle("„Hallo\" sagte", "„Hallo“, sagte"), "„Hallo“, sagte", "mixed at the place: as the KI writes");
  const text = 'Sie rief "Komm!" und lief.\nDer Satz Ich bleibe hier zeigt Mut.';
  assert.equal(keepQuoteStyle("Ich bleibe hier", "„Ich bleibe hier“", text), '"Ich bleibe hier"', "no quotation marks at the place: the text decides");
  assert.equal(keepQuoteStyle("Ich bleibe hier", "„Ich bleibe hier“", "Der Satz Ich bleibe hier zeigt Mut."), "„Ich bleibe hier“", "none anywhere: as the KI writes");
  assert.equal(keepQuoteStyle("Ich bleibe hier", "„Ich bleibe hier“", 'Sie rief „Komm!“ und "Lauf!".'), "„Ich bleibe hier“", "a mixed text: as the KI writes");
  assert.equal(keepQuoteStyle("gehts", "geht’s", "Das geht's nicht. Wie gehts?"), "geht's", "the apostrophe the student types");
  assert.equal(keepQuoteStyle("Hause", "Haus", text), "Haus", "nothing to do without quotation marks");

  assert.equal(quoteStyleHint("Verwende bei Zitaten die deutschen Anführungszeichen unten und oben („…“) statt der geraden."), true);
  assert.equal(quoteStyleHint("Achte auf typografische Anführungszeichen."), true);
  assert.equal(quoteStyleHint("Zitate brauchen Anführungszeichen und eine Zeilenangabe."), false);
  assert.equal(quoteStyleHint("Bei zwei Zitaten fehlen die Anführungszeichen unten."), false, "missing ones stay");
  assert.equal(quoteStyleHint("Achte auf die Zeitform im zweiten Teil."), false);
});

test("Anführungszeichen: aus „…“ statt \"…\" wird kein Vorschlag und nichts Verworfenes, echte Fehler bleiben", async () => {
  const { anchorFindings } = await import("./text-correction-core");
  const doc = para('Im Text heißt es "Der Regen hörte nicht auf" (Z. 4).', 'Die Mutter sagt "Komm bald heim" und geht.', "Der Satz Ich bleibe hier (Z. 9) zeigt ihren Mut.", 'Er fragt "Wo bist du" ganz leise.');
  const finding = (p: number, quote: string, replacement: string) => ({ para: p, ...f(quote, replacement, "zeichensetzung", "Erklärung.") });
  const r = anchorFindings(
    doc,
    {
      findings: [
        finding(1, '"Der Regen hörte nicht auf"', "„Der Regen hörte nicht auf“"),
        finding(2, 'sagt "Komm bald heim"', "sagt: „Komm bald heim“"),
        finding(3, "Ich bleibe hier", "„Ich bleibe hier“"),
        // the KI quotes with „…“ itself: found in the text all the same, the student's marks stay
        finding(4, "„Wo bist du“", "„Wo bist du?“"),
      ],
      hints: [
        { para: null, category: "struktur", text: "Verwende die deutschen Anführungszeichen unten und oben statt der geraden." },
        { para: 3, category: "struktur", text: "Bei einem Zitat fehlt die Zeilenangabe." },
      ],
    },
    { pattern: null, level, skills: new Set() },
  );
  const placed = r.items.filter((i) => i.kind !== "hinweis").map((i) => [i.block, i.quote, i.replacement]);
  assert.deepEqual(placed, [
    [1, 'sagt "Komm bald heim"', 'sagt: "Komm bald heim"'],
    [2, "Ich bleibe hier", '"Ich bleibe hier"'],
    [3, '"Wo bist du"', '"Wo bist du?"'],
  ]);
  assert.deepEqual(r.items.filter((i) => i.kind === "hinweis").map((i) => i.explanation), ["Bei einem Zitat fehlt die Zeilenangabe."]);
  assert.equal(r.dropped, 0, "nothing counts as verworfen: there was nothing to correct");
});

test("Anführungszeichen: wer „…“ schreibt, bekommt „…“, ein Ersatz ohne Stelle auch die geraden", async () => {
  const { anchorFindings } = await import("./text-correction-core");
  const finding = (p: number, quote: string, replacement: string) => ({ para: p, ...f(quote, replacement, "zeichensetzung", "Erklärung.") });
  const german = anchorFindings(para("Die Mutter sagt „Komm bald heim“ und geht."), { findings: [finding(1, "sagt „Komm", "sagt: „Komm")], hints: [] }, { pattern: null, level, skills: new Set() });
  assert.deepEqual(german.items.map((i) => [i.quote, i.replacement]), [["sagt „Komm", "sagt: „Komm"]]);
  // a quote the KI changed (not in the text): a note on the paragraph, with the student's kind of marks
  const note = anchorFindings(para('Sie ruft "Halt" und bleibt stehen.'), { findings: [finding(1, 'ruft "Stopp"', "ruft: „Stopp“")], hints: [] }, { pattern: null, level, skills: new Set() });
  assert.deepEqual(note.items.map((i) => [i.pos_start, i.replacement]), [[null, 'ruft: "Stopp"']]);
});

test("Anführungszeichen: die zweite Prüfung kann sie nicht zurück in „…“ verbessern", async () => {
  const { applyVerdicts, maskedProposals } = await import("./ai/textkorrektur-gruendlich");
  const t = 'Die Mutter sagt "Komm bald heim" und geht.';
  const q = 'sagt "Komm bald heim"';
  const item = { block: 0, pos_start: t.indexOf(q), pos_end: t.indexOf(q) + q.length, quote: q, replacement: 'sagt: "Komm bald heim"', category: "zeichensetzung", kind: "fehler", rule: "", explanation: "Doppelpunkt.", review: "" as const, review_note: "", origin: "analyse" as const };
  const proposals = maskedProposals([t], [item], null);
  const check = (better: string) => applyVerdicts([item], proposals, { checks: [{ nr: 1, verdict: "falsch", explanation_ok: true, better_replacement: better, better_explanation: null, reason: "x" }], missed: [] }, null, t).items[0];
  const better = check("sagt: „Komm bald heim!“");
  assert.deepEqual([better.replacement, better.review], ['sagt: "Komm bald heim!"', "lehrer"], "a better wording keeps the straight ones");
  assert.equal(check('sagt „Komm bald heim“').review, "verworfen", "the place as the student wrote it, only with „…“: right as it is");
  const same = check("sagt: „Komm bald heim“");
  assert.deepEqual([same.replacement, same.review], ['sagt: "Komm bald heim"', "lehrer"], "the same wording with „…“: a doubt, not a change");
  assert.match(same.review_note, /widerspricht sich/);
});

// ---------- the whole way, with a KI that answers like the real one did ----------

const LINES = ['In der Geschichte heißt es "Der Regen hörte nicht auf" (Z. 4).', 'Die Mutter sagt "Komm bald heim" und geht weg.', "Am Ende lacht das Kind wieder."];

function fakeKI(calls: AIRequest[]) {
  return async (req: AIRequest) => {
    calls.push(req);
    const usage = { input: 1000, output: 800, cacheWrite: 0, cacheRead: 0 };
    const hints = [{ category: "struktur", para: null, text: "Verwende bei Zitaten die deutschen Anführungszeichen unten und oben." }];
    const rest = { strengths: [], main_issue: null, recommendation: null, recommendation_skill_id: null };
    let data: unknown;
    if (req.fn === "textkorrektur") {
      data = {
        findings: [
          { para: 1, ...f('"Der Regen hörte nicht auf"', "„Der Regen hörte nicht auf“", "zeichensetzung", "Im Deutschen stehen die Anführungszeichen unten und oben.") },
          { para: 2, ...f('sagt "Komm', "sagt: „Komm", "zeichensetzung", "Vor der wörtlichen Rede steht ein Doppelpunkt.") },
        ],
        hints,
        ...rest,
      };
    } else if (req.fn === "textanalyse") {
      data = {
        sentences: [
          { id: "1.1", corrected: "In der Geschichte heißt es „Der Regen hörte nicht auf“ (Z. 4).", findings: [f('"Der Regen hörte nicht auf"', "„Der Regen hörte nicht auf“", "zeichensetzung", "Im Deutschen stehen die Anführungszeichen unten und oben.")] },
          { id: "2.1", corrected: "Die Mutter sagt: „Komm bald heim“ und geht weg.", findings: [f('sagt "Komm', "sagt: „Komm", "zeichensetzung", "Vor der wörtlichen Rede steht ein Doppelpunkt.")] },
          { id: "3.1", corrected: LINES[2], findings: [] },
        ],
        hints,
        ...rest,
      };
    } else {
      const checks: unknown[] = [];
      for (const m of String(req.content).matchAll(/^Vorschlag (\d+) /gm)) checks.push({ nr: Number(m[1]), verdict: "richtig", explanation_ok: true, better_replacement: null, better_explanation: null, reason: "" });
      data = { checks, missed: [] };
    }
    return { parsed: data, refusal: false, model: req.model, usage };
  };
}

async function run(method: "einfach" | "gruendlich", version: "bisher" | "neu", name: string) {
  const before = process.env.AI_TEXT_GRUENDLICH;
  process.env.AI_TEXT_GRUENDLICH = version;
  const repo = await import("./repo");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const router = await import("./ai/router");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({ name, grade: 11, klasse: 7, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: null, subject: "Deutsch", topic: "Textinterpretation", title: "Eine Kurzgeschichte", prompt: "Interpretiere." });
  assert.ok(texts.saveText(text.id, para(...LINES), 0).ok);
  router.resetRouter();
  const calls: AIRequest[] = [];
  router.setTransport(fakeKI(calls));
  try {
    const res = await tc.startAICorrection(text.id, niko.id, { consent: true, wait: true, method });
    assert.ok(res.ok);
    const c = tc.getCorrection(res.correctionId)!;
    return { c, items: tc.listItems(c.id) };
  } finally {
    router.setTransport(null);
    if (before === undefined) delete process.env.AI_TEXT_GRUENDLICH;
    else process.env.AI_TEXT_GRUENDLICH = before;
  }
}

const shown = (items: Item[]) => items.map((i) => [i.kind, i.quote, i.replacement]);

for (const [method, version] of [["einfach", "bisher"], ["gruendlich", "bisher"], ["gruendlich", "neu"]] as const) {
  test(`Anführungszeichen ${method}${method === "gruendlich" ? ` ${version}` : ""}: das gerade Zitat ist kein Fehler, der fehlende Doppelpunkt schon`, async () => {
    const { c, items } = await run(method, version, `Alex ${method} ${version}`);
    assert.equal(c.ai_status, "fertig");
    assert.deepEqual(shown(items), [["fehler", 'sagt "Komm', 'sagt: "Komm']], "no mark at the quotation, no hint about the marks");
    assert.equal(c.dropped, 0);
  });
}
