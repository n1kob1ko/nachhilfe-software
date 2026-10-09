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
        if (q === "ins Wasser") checks.push({ ...base, verdict: "falsch", reason: "„ins“ ist richtig." });
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
