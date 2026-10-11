import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

/**
 * A replacement must fit the place it is meant for (Textkorrektur, 2026-10-11). In the test with the unseen texts
 * (N07) the second check wrote „gieng dann allein“ for „alleine“ after „gieng dann“: taken over, the Endfassung would
 * have read „gieng dann gieng dann allein“. Synthetic texts only.
 */

type AIRequest = import("./ai/router").AIRequest;
type Item = import("./text-correction").CorrectionItem;

const para = (...lines: string[]) => lines.map((x) => ({ t: "p" as const, r: [{ x }] }));
const N07 = ["Am Montag war mein Bruder krank.", "Ich gieng dann alleine zur Schule, weil der Bus schon weg war."];
const f = (quote: string, replacement: string, category: string, explanation: string, o: { kind?: string; sure?: boolean } = {}) => ({
  quote, replacement, category, kind: o.kind ?? "fehler", rule: category, explanation, skill_id: null, sure: o.sure ?? true,
});

/** Step 1 corrects „gieng“ and „alleine“; step 2 answers for „alleine“ with the wording of N07 (`better`), confirms the rest. */
function fakeKI(o: { better?: string; einfach?: { quote: string; replacement: string }[] } = {}) {
  return async (req: AIRequest) => {
    const prompt = String(req.content);
    const usage = { input: 1000, output: 800, cacheWrite: 0, cacheRead: 0 };
    let data: unknown;
    if (req.fn === "textkorrektur") {
      const findings = (o.einfach ?? []).map((x) => ({ para: 2, ...f(x.quote, x.replacement, "ausdruck", "Passt besser.") }));
      data = { findings, hints: [], strengths: [], main_issue: null, recommendation: null, recommendation_skill_id: null };
    } else if (req.fn === "textanalyse") {
      data = {
        sentences: [
          { id: "1.1", corrected: N07[0], findings: [] },
          {
            id: "2.1",
            corrected: "Ich ging dann allein zur Schule, weil der Bus schon weg war.",
            findings: [f("gieng", "ging", "rechtschreibung", "„ging“ schreibt man ohne e."), f("alleine", "allein", "ausdruck", "„allein“ passt besser in einen Bericht.", { kind: "stil", sure: false })],
          },
        ],
        hints: [], strengths: [], main_issue: null, recommendation: null, recommendation_skill_id: null,
      };
    } else {
      const checks: unknown[] = [];
      for (const m of prompt.matchAll(/^Vorschlag (\d+) [^\n]*\n[^\n]*\n[^\n]*\nÄnderung: „([^“]*)“/gm)) {
        const base = { nr: Number(m[1]), explanation_ok: true, better_replacement: null, better_explanation: null, reason: "" };
        if (m[2] === "alleine" && o.better) checks.push({ ...base, verdict: "falsch", better_replacement: o.better, reason: "„alleine“ ist korrekt und kein Fehler." });
        else checks.push({ ...base, verdict: "richtig" });
      }
      data = { checks, missed: [] };
    }
    return { parsed: data, refusal: false, model: req.model, usage };
  };
}

async function setup(name: string, lines = N07) {
  const repo = await import("./repo");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const router = await import("./ai/router");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({ name, grade: 4, klasse: 4, teacher_id: niko.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: null, subject: "Deutsch", topic: "Bericht", title: "Der Schulweg", prompt: "Berichte." });
  assert.ok(texts.saveText(text.id, para(...lines), 0).ok);
  router.resetRouter();
  return { tc, texts, router, niko, textId: text.id };
}

const by = (items: Item[], quote: string) => items.find((i) => i.quote === quote)!;
const endText = (tc: typeof import("./text-correction"), c: import("./text-correction").CorrectionRow) => tc.applyAccepted(tc.snapshotDoc(c), tc.listItems(c.id)).doc.map((b) => b.r.map((r) => r.x).join(""));
/** Everything about the suggestions but the one in question, to see that nothing else changed. */
const othersOf = (items: Item[], id: number) => JSON.stringify(items.filter((i) => i.id !== id));

// ---------- the check itself ----------

test("Ersatz passt zur Stelle: das Beispiel aus N07 wird erkannt, die richtige Verbesserung nicht", async () => {
  const { replacementProblem, acceptProblem } = await import("./text-correction-checks");
  const t = N07[1];
  const at = (q: string, replacement: string) => ({ start: t.indexOf(q), end: t.indexOf(q) + q.length, replacement, quote: q });
  assert.match(replacementProblem(t, at("alleine", "gieng dann allein"))!, /„gieng dann“ zweimal hintereinander/);
  assert.equal(replacementProblem(t, at("alleine", "allein")), null);
  assert.equal(replacementProblem(t, at("gieng", "ging")), null);
  // also when „gieng“ → „ging“ is accepted first: the text then reads „ging dann gieng dann allein“, the check sees the snapshot
  const gieng = at("gieng", "ging");
  const bad = acceptProblem(t, at("alleine", "gieng dann allein"), [gieng]);
  assert.deepEqual([bad?.alone, /zweimal/.test(bad?.why ?? "")], [true, true]);
  assert.equal(acceptProblem(t, at("alleine", "allein"), [gieng]), null);
});

test("Ersatz passt zur Stelle: mehrfach vorkommende Wörter und Wörter, die doppelt stehen dürfen", async () => {
  const { replacementProblem } = await import("./text-correction-checks");
  const fit = (t: string, q: string, replacement: string, from = 0) => replacementProblem(t, { start: t.indexOf(q, from), end: t.indexOf(q, from) + q.length, replacement, quote: q });
  assert.match(fit("Wir gingen dann nach Hause.", "nach", "dann nach")!, /„dann“ zweimal/);
  assert.match(fit("Wir gingen dann nach Hause.", "dann", "dann nach")!, /„nach“ zweimal/, "the word after the place, too");
  // the same word elsewhere in the sentence is no doubling
  assert.equal(fit("Das Haus, das alt ist, das mag ich.", "das", "dass", 10), null);
  assert.equal(fit("Das Haus ist alt. Das Haus ist groß.", "groß", "sehr groß"), null);
  // words that can stand twice („die die“, „dass sie sie“), as in finalProblems
  assert.equal(fit("Sie sagte, dass sie liebt.", "liebt", "sie liebt"), null);
  assert.equal(fit("Die Kinder, Schule haben, lernen.", "Schule", "die Schule"), null);
  // a doubling the student wrote is not the suggestion's fault
  assert.equal(fit("Ich ich ging heim.", "ich ging", "ich gehe"), null);
  assert.match(fit("Ich ging heim.", "ging", "Ich ging")!, /„Ich“ zweimal/, "case does not matter");
  // a repetition the student meant, made exact by a right correction, is no echo of the neighbours
  assert.equal(fit("Wir liefen und liefen und lifen.", "lifen", "liefen"), null);
  assert.match(fit("Wir liefen und lifen.", "lifen", "liefen und liefen")!, /„liefen und“ zweimal|„und liefen“ zweimal/);
  // a word taken out so that its neighbours stand twice
  assert.match(fit("Er sagte und sagte nichts.", "und", "")!, /„sagte“ zweimal/);
});

test("Ersatz passt zur Stelle: Satzzeichen, Leerzeichen, Platzhalter und die Stelle selbst", async () => {
  const { replacementProblem } = await import("./text-correction-checks");
  const fit = (t: string, q: string, replacement: string) => replacementProblem(t, { start: t.indexOf(q), end: t.indexOf(q) + q.length, replacement, quote: q });
  assert.match(fit("Er kam nach Hause.", "Hause", "Hause.")!, /Satzzeichen doppelt/);
  assert.match(fit("Er hat gesagt, dass er kommt.", "gesagt", "gesagt,")!, /Satzzeichen doppelt/);
  assert.match(fit("Er kam nach Hause.", "Hause", "Hause ")!, /Leerzeichen davor/);
  assert.match(fit("Er kauft Obst usw.", "usw", "usw.")!, /Satzzeichen doppelt/, "„usw..“");
  // right ones
  assert.equal(fit("Er hat gesagt das er kommt.", "gesagt das", "gesagt, dass"), null);
  assert.equal(fit("Er kauft Obst usw und geht.", "usw", "usw."), null);
  assert.equal(fit("Und dann ... nichts.", "nichts", "gar nichts"), null);
  assert.equal(fit("Tiere zb Hunde.", "zb", "z. B."), null);
  assert.equal(fit("Es war am 3 Mai.", "3", "3."), null);
  // a sign the student already doubled next to the place is not blamed on it
  assert.equal(fit("Er kam,, und ging.", "ging", "ging weg"), null);
  // placeholders of the KI never go into the text
  assert.match(fit("Er ging heim.", "Er", "[Name] er")!, /Platzhalter „\[Name\]“/);
  assert.match(fit("Er ging heim.", "Er", "[PERSON_NAME]")!, /Platzhalter/);
  // the place itself
  assert.match(replacementProblem("Kurz.", { start: 3, end: 9, replacement: "x" })!, /gibt es im Text nicht/);
  assert.match(replacementProblem("Er ging heim.", { start: 3, end: 7, replacement: "lief", quote: "geht" })!, /stimmt nicht mehr/);
});

test("Ersatz passt zur Stelle: kurze und lange Sätze, Anfang und Ende des Absatzes", async () => {
  const { replacementProblem } = await import("./text-correction-checks");
  const fit = (t: string, q: string, replacement: string, from = 0) => replacementProblem(t, { start: t.indexOf(q, from), end: t.indexOf(q, from) + q.length, replacement, quote: q });
  assert.equal(fit("Er gieng.", "gieng", "ging"), null, "at the end of a short paragraph");
  assert.equal(fit("gieng er?", "gieng", "Ging"), null, "at its start");
  assert.match(fit("Ich gieng.", "gieng", "ich ging")!, /„Ich“ zweimal/, "the word before at the start of the paragraph");
  const long = `Am Morgen waren wir sehr sehr müde, ${"weil wir am Abend davor lange auf dem Fest im Dorf waren, ".repeat(5)}und dann gieng ich alleine heim.`;
  assert.equal(fit(long, "alleine", "allein"), null, "a doubling far from the place does not count");
  assert.match(fit(long, "alleine", "gieng ich allein")!, /„gieng ich“ zweimal/);
  assert.equal(fit(long, "gieng", "ging", long.length - 40), null);
});

test("Mehrere übernommene Korrekturen: Überschneidung und was erst zusammen schadet, wird nicht übernommen", async () => {
  const { acceptProblem } = await import("./text-correction-checks");
  const t = "Er lief langsam schnell heim.";
  const at = (q: string, replacement: string) => ({ start: t.indexOf(q), end: t.indexOf(q) + q.length, replacement });
  // each alone is fine, together „sehr sehr“
  assert.equal(acceptProblem(t, at("langsam", "sehr"), []), null);
  assert.equal(acceptProblem(t, at("schnell", "sehr"), []), null);
  const both = acceptProblem(t, at("schnell", "sehr"), [at("langsam", "sehr")]);
  assert.deepEqual([both?.alone, both?.why], [false, "Zusammen mit den schon übernommenen Korrekturen: Danach stünde „sehr“ zweimal hintereinander."]);
  // overlapping places
  const over = acceptProblem(t, at("langsam schnell", "rasch"), [at("schnell", "flott")]);
  assert.deepEqual([over?.alone, /überschneidet sich/.test(over?.why ?? "")], [false, true]);
  // one after the other, the positions shift: still checked at the right place
  const u = "Ich gieng dann alleine heim und gieng dann schlafen.";
  const second = u.lastIndexOf("gieng");
  const accepted = [{ start: 4, end: 9, replacement: "ging" }, { start: 15, end: 22, replacement: "ganz allein" }];
  assert.equal(acceptProblem(u, { start: second, end: second + 5, replacement: "ging", quote: "gieng" }, accepted), null);
  assert.match(acceptProblem(u, { start: second, end: second + 5, replacement: "und ging" }, accepted)!.why, /„und“ zweimal/);
});

// ---------- the second check ----------

test("zweite Prüfung: eine Verbesserung, die nicht an die Stelle passt, überschreibt den ursprünglichen Vorschlag nicht", async () => {
  const { applyVerdicts, betterMisfit, maskedProposals } = await import("./ai/textkorrektur-gruendlich");
  const t = N07[1];
  const item = (q: string, replacement: string) => ({ block: 0, pos_start: t.indexOf(q), pos_end: t.indexOf(q) + q.length, quote: q, replacement, category: "ausdruck", kind: "stil", rule: "", explanation: "Erklärung.", review: "" as const, review_note: "", origin: "analyse" as const });
  const items = [item("gieng", "ging"), item("alleine", "allein")];
  const proposals = maskedProposals([t], items, null);
  const verdict = (better: string) => ({ checks: [{ nr: 1, verdict: "richtig", explanation_ok: true, better_replacement: null, better_explanation: null, reason: "" }, { nr: 2, verdict: "falsch", explanation_ok: true, better_replacement: better, better_explanation: "Neu.", reason: "„alleine“ ist korrekt." }], missed: [] });
  const out = applyVerdicts(items, proposals, verdict("gieng dann allein"), null).items;
  assert.deepEqual([out[1].replacement, out[1].explanation, out[1].review], ["allein", "Erklärung.", "lehrer"], "the first suggestion stays, marked");
  assert.match(out[1].review_note, /Ihre Fassung „gieng dann allein“ wurde nicht übernommen, weil sie nicht genau an diese Stelle passt: Danach stünde „gieng dann“ zweimal hintereinander\. Begründung der Prüfung: „alleine“ ist korrekt\./);
  assert.deepEqual(out[0], items[0], "the other suggestion is untouched");
  // a wording that fits replaces it as before
  const fits = applyVerdicts(items, proposals, verdict("ganz allein"), null).items[1];
  assert.deepEqual([fits.replacement, fits.explanation, fits.review], ["ganz allein", "Neu.", "lehrer"]);
  // the words after the place, a word that may stand twice, a sign: never for the second check's wording either
  const p = { quote: "gieng", before: "Ich ", after: " dann alleine zur Schule" };
  assert.match(betterMisfit(p, "ging dann")!, /„dann“ zweimal/);
  assert.match(betterMisfit({ quote: "kennt", before: "Er ", after: " sie gut." }, "kennt sie")!, /„sie“ steht schon direkt nach der Stelle/);
  assert.match(betterMisfit({ quote: "liebt", before: "Sie sagte, dass sie ", after: "." }, "sie liebt")!, /„sie“ steht schon direkt vor/);
  assert.match(betterMisfit({ quote: "Hause", before: "nach ", after: "." }, "Hause.")!, /Satzzeichen/);
  assert.equal(betterMisfit(p, "ging"), null);
  assert.equal(betterMisfit({ quote: "dann alleine", before: "Ich gieng ", after: " zur" }, "dann allein"), null, "the place starts with the word itself");
});

// ---------- the whole way to the Endfassung ----------

test("gründlich, N07 von der Korrektur bis zur Endfassung: der ursprüngliche Vorschlag bleibt, nichts steht doppelt", async () => {
  const s = await setup("Paul Weg");
  s.router.setTransport(fakeKI({ better: "gieng dann allein" }));
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true, method: "gruendlich" });
  assert.ok(res.ok);
  const c = s.tc.getCorrection(res.correctionId)!;
  assert.equal(c.verify_status, "ok");
  const items = s.tc.listItems(c.id);
  const alleine = by(items, "alleine");
  assert.deepEqual([alleine.replacement, alleine.status, alleine.review], ["allein", "offen", "lehrer"]);
  assert.match(alleine.review_note, /„gieng dann allein“ wurde nicht übernommen/);
  assert.ok(items.every((i) => !i.replacement.includes("gieng dann")), "the misfit wording is stored nowhere");
  // accepted one after the other, in both orders
  const before = s.texts.getText(s.textId)!.body;
  assert.ok("item" in s.tc.decideItem(c.id, by(items, "gieng").id, "uebernommen", s.niko.id)!);
  assert.ok("item" in s.tc.decideItem(c.id, alleine.id, "uebernommen", s.niko.id)!);
  assert.deepEqual(endText(s.tc, c), [N07[0], "Ich ging dann allein zur Schule, weil der Bus schon weg war."]);
  assert.equal(s.texts.getText(s.textId)!.body, before, "the student's text never changes");
  assert.equal(s.tc.getCorrection(c.id)!.body, before, "nor the snapshot");
  // the teacher's own wording with the same mistake is refused, the accepted suggestion stays as it is
  const refused = s.tc.decideItem(c.id, alleine.id, "uebernommen", s.niko.id, "gieng dann allein")!;
  assert.ok("error" in refused);
  assert.match(refused.error, /^Nicht übernommen: Danach stünde „gieng dann“ zweimal hintereinander\.$/);
  assert.deepEqual([by(s.tc.listItems(c.id), "alleine").replacement, by(s.tc.listItems(c.id), "alleine").status], ["allein", "uebernommen"]);
  assert.deepEqual(endText(s.tc, c), [N07[0], "Ich ging dann allein zur Schule, weil der Bus schon weg war."]);
  s.router.setTransport(null);
});

test("einfach: ein Vorschlag, der nicht an seine Stelle passt, ist nicht anwendbar und kann nicht übernommen werden", async () => {
  const s = await setup("Rosa Weg");
  s.router.setTransport(fakeKI({ einfach: [{ quote: "alleine", replacement: "gieng dann allein" }, { quote: "Bus", replacement: "Schulbus" }] }));
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true, method: "einfach" });
  assert.ok(res.ok);
  const c = s.tc.getCorrection(res.correctionId)!;
  const items = s.tc.listItems(c.id);
  const bad = by(items, "alleine");
  assert.deepEqual([bad.status, bad.review, bad.decided_by], ["abgelehnt", "unpassend", null]);
  assert.match(bad.review_note, /^Nicht anwendbar: Danach stünde „gieng dann“ zweimal hintereinander\./);
  assert.deepEqual([by(items, "Bus").status, by(items, "Bus").review], ["offen", ""]);
  // not accepted, not brought back, not even with the teacher's own wording; nothing else changes
  const snapshot = othersOf(items, bad.id);
  for (const [status, own] of [["uebernommen", undefined], ["uebernommen", "allein"], ["offen", undefined]] as const) {
    const r = s.tc.decideItem(c.id, bad.id, status, s.niko.id, own)!;
    assert.ok("error" in r && /kann nicht übernommen werden/.test(r.error), status);
  }
  assert.deepEqual([by(s.tc.listItems(c.id), "alleine").status, by(s.tc.listItems(c.id), "alleine").review], ["abgelehnt", "unpassend"]);
  assert.equal(othersOf(s.tc.listItems(c.id), bad.id), snapshot);
  // „Alle übernehmen“ takes the fitting one only
  assert.equal(s.tc.decideAll(c.id, "uebernommen", s.niko.id), 1);
  assert.deepEqual(endText(s.tc, c), [N07[0], "Ich gieng dann alleine zur Schule, weil der Schulbus schon weg war."]);
  // the place stays free for the teacher's own correction, which is checked the same way
  const at = N07[1].indexOf("alleine");
  const own = (replacement: string) => s.tc.addTeacherItem(c.id, { block: 1, start: at, end: at + 7, category: "ausdruck", kind: "stil", replacement, explanation: "" }, s.niko.id);
  const wrong = own("gieng dann allein");
  assert.ok("error" in wrong && /zweimal/.test(wrong.error));
  assert.ok("item" in own("allein"));
  assert.deepEqual(endText(s.tc, c), [N07[0], "Ich gieng dann allein zur Schule, weil der Schulbus schon weg war."]);
  // a new run removes the not applicable one like the open ones
  s.router.setTransport(fakeKI({ better: "gieng dann allein" }));
  const again = await s.tc.startThoroughRecheck(c.id, s.niko.id, { consent: true, wait: true });
  assert.ok(again.ok);
  assert.equal(s.tc.listItems(c.id).filter((i) => i.review === "unpassend").length, 0);
  s.router.setTransport(null);
});

test("Übernehmen prüft erneut: überschneidende Stellen, was zusammen schadet, ein Text, der nicht mehr zum Vorschlag passt", async () => {
  const s = await setup("Ida Weg", ["Er lief langsam schnell heim.", "Ich gieng dann alleine zur Schule."]);
  s.router.setTransport(fakeKI({ einfach: [] }));
  const c = s.tc.ensureCorrection(s.textId, s.niko.id);
  const db = (await import("./db")).db();
  const t = "Er lief langsam schnell heim.";
  const add = (block: number, q: string, replacement: string, status = "offen", text = t) => {
    const start = text.indexOf(q);
    const r = db.prepare("INSERT INTO text_correction_items (correction_id, block, pos_start, pos_end, quote, replacement, category, kind, rule, explanation, status, source, created_at) VALUES (?, ?, ?, ?, ?, ?, 'ausdruck', 'stil', '', 'Erklärung.', ?, 'ki', '2026-10-11')").run(c.id, block, start, start + q.length, q, replacement, status);
    return Number(r.lastInsertRowid);
  };
  const langsam = add(0, "langsam", "sehr");
  const schnell = add(0, "schnell", "sehr");
  const both = add(0, "langsam schnell", "rasch");
  assert.ok("item" in s.tc.decideItem(c.id, langsam, "uebernommen", s.niko.id)!);
  const items = s.tc.listItems(c.id);
  // together with the accepted one: refused, stays open; overlapping: refused, stays open
  const r1 = s.tc.decideItem(c.id, schnell, "uebernommen", s.niko.id)!;
  assert.ok("error" in r1 && /Zusammen mit den schon übernommenen Korrekturen: Danach stünde „sehr“ zweimal/.test(r1.error));
  const r2 = s.tc.decideItem(c.id, both, "uebernommen", s.niko.id)!;
  assert.ok("error" in r2 && /überschneidet sich/.test(r2.error));
  assert.deepEqual(s.tc.listItems(c.id).map((i) => [i.quote, i.status, i.review]), items.map((i) => [i.quote, i.status, i.review]), "nothing changed");
  // „Alle übernehmen“ skips them as well
  assert.equal(s.tc.decideAll(c.id, "uebernommen", s.niko.id), 0);
  assert.deepEqual(endText(s.tc, c), ["Er lief sehr schnell heim.", "Ich gieng dann alleine zur Schule."]);
  // the stored place does not hold the quoted words any more (data from before): set aside, the others stay as they are
  const moved = add(1, "alleine", "allein", "offen", "Ich gieng dann alleine zur Schule.");
  db.prepare("UPDATE text_correction_items SET quote = 'allein' WHERE id = ?").run(moved);
  const keep = othersOf(s.tc.listItems(c.id), moved);
  const r3 = s.tc.decideItem(c.id, moved, "uebernommen", s.niko.id)!;
  assert.ok("error" in r3 && /stimmt nicht mehr mit dem Vorschlag überein/.test(r3.error));
  assert.deepEqual([by(s.tc.listItems(c.id), "allein").status, by(s.tc.listItems(c.id), "allein").review], ["abgelehnt", "unpassend"]);
  assert.equal(othersOf(s.tc.listItems(c.id), moved), keep);
  assert.deepEqual(endText(s.tc, c), ["Er lief sehr schnell heim.", "Ich gieng dann alleine zur Schule."]);
  s.router.setTransport(null);
});

test("Text nach der KI-Korrektur geändert: die alte Korrektur bleibt bei ihrer Fassung, die neue übernimmt nur, was noch passt", async () => {
  const s = await setup("Leo Weg");
  s.router.setTransport(fakeKI({ better: "gieng dann allein" }));
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true, method: "gruendlich" });
  assert.ok(res.ok);
  const old = s.tc.getCorrection(res.correctionId)!;
  const items = s.tc.listItems(old.id);
  assert.ok("item" in s.tc.decideItem(old.id, by(items, "gieng").id, "uebernommen", s.niko.id)!);
  // the student rewrites the sentence: „alleine“ moves
  const t = s.texts.getText(s.textId)!;
  assert.ok(s.texts.saveText(s.textId, para(N07[0], "Dann gieng ich alleine los."), t.version).ok);
  const next = s.tc.ensureCorrection(s.textId, s.niko.id);
  assert.equal(s.tc.listItems(next.id).filter((i) => i.block === 1).length, 0, "nothing of the changed paragraph is carried over");
  // the old correction still refers to its own version: accepting there is checked against that snapshot
  assert.ok("item" in s.tc.decideItem(old.id, by(items, "alleine").id, "uebernommen", s.niko.id)!);
  assert.deepEqual(endText(s.tc, old), [N07[0], "Ich ging dann allein zur Schule, weil der Bus schon weg war."]);
  assert.deepEqual(endText(s.tc, next), [N07[0], "Dann gieng ich alleine los."], "the new version is untouched");
  s.router.setTransport(null);
});
