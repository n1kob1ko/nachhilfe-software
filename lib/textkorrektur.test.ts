import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type AIRequest = import("./ai/router").AIRequest;

/** Errors the stand-in KI knows: every occurrence in a paragraph becomes a finding. */
const RULES = [
  { find: "Fahrad", replacement: "Fahrrad", category: "rechtschreibung", kind: "fehler", rule: "Doppelkonsonant", explanation: "Fahrrad schreibt man mit rr.", skill_id: "deutsch.recht.sss" },
  { find: "meinen Freund", replacement: "meinem Freund", category: "grammatik", kind: "fehler", rule: "Dativ nach Präposition", explanation: "Nach der Präposition „mit“ steht der Dativ.", skill_id: "deutsch.grammatik.faelle" },
  { find: "gehte", replacement: "ging", category: "grammatik", kind: "fehler", rule: "Zeitform Präteritum", explanation: "Das Präteritum von gehen ist ging.", skill_id: "deutsch.grammatik.zeiten" },
  { find: "wir gehen", replacement: "wir gingen", category: "Zeitform", kind: "fehler", rule: "Zeitform Präteritum", explanation: "Du erzählst in der Vergangenheit, also gingen.", skill_id: "deutsch.grammatik.zeiten" },
  { find: "Haus weil", replacement: "Haus, weil", category: "Beistrich", kind: "fehler", rule: "Beistrich vor weil", explanation: "Vor „weil“ steht ein Beistrich.", skill_id: "deutsch.beistrich.nebensatz" },
  { find: "sehr sehr schön", replacement: "wunderschön", category: "stil", kind: "stil", rule: "Wiederholung", explanation: "Ein Wort statt der Wiederholung klingt besser.", skill_id: null },
];

function fakeKI(o: { calls?: AIRequest[]; delayMs?: number; mutate?: (data: Record<string, unknown>) => unknown; fail?: boolean } = {}) {
  return async (req: AIRequest) => {
    o.calls?.push(req);
    if (o.delayMs) await new Promise((r) => setTimeout(r, o.delayMs));
    if (o.fail) throw new Error("Netzwerk weg");
    const prompt = String(req.content);
    const findings: Record<string, unknown>[] = [];
    for (const m of prompt.matchAll(/^\[(\d+)\](?: \(Überschrift\))? (.*)$/gm)) {
      for (const r of RULES) {
        let at = m[2].indexOf(r.find);
        while (at >= 0) {
          findings.push({ para: Number(m[1]), quote: r.find, replacement: r.replacement, category: r.category, kind: r.kind, rule: r.rule, explanation: r.explanation, skill_id: r.skill_id });
          at = m[2].indexOf(r.find, at + 1);
        }
      }
    }
    const data = { findings, hints: [{ category: "aufbau", para: null, text: "Dein Schluss fehlt noch: Wie ging der Tag zu Ende?" }], strengths: ["Lebendige Einleitung"], main_issue: "Zeitformen", recommendation: "Übung zu Präteritum und Perfekt", recommendation_skill_id: "deutsch.grammatik.zeiten" };
    return { parsed: o.mutate ? o.mutate(data) : data, refusal: false, model: req.model, usage: { input: 2000, output: 1500, cacheWrite: 0, cacheRead: 0 } };
  };
}

const kid = (name: string, teacherId: number, school_type = "Volksschule", klasse = 4) => ({
  name, grade: klasse, klasse, teacher_id: teacherId, school: "", school_type, subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});
const para = (...lines: string[]) => lines.map((x) => ({ t: "p" as const, r: [{ x }] }));

const STORY = [
  "Am Samstag fuhr ich mit meinen Freund Max zum See.",
  "Wir fuhren mit dem Fahrad. Dann gehte ich ins Wasser.",
  "Ich blieb lange im Haus weil es regnete. Es war sehr sehr schön.",
];

async function setup(name = "Max Muster", school = "Volksschule", klasse = 4) {
  const repo = await import("./repo");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const router = await import("./ai/router");
  const { db } = await import("./db");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id, school, klasse));
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: null, subject: "Deutsch", topic: "Erlebniserzählung", title: "Am See", prompt: "Erzähle von einem Ausflug." });
  const saved = texts.saveText(text.id, para(...STORY), 0);
  assert.ok(saved.ok);
  return { repo, texts, tc, router, db, niko, sid, textId: text.id };
}

async function corrected(s: Awaited<ReturnType<typeof setup>>, transport = fakeKI()) {
  s.router.resetRouter();
  s.router.setTransport(transport);
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true });
  assert.ok(res.ok, JSON.stringify(res));
  const c = s.tc.getCorrection(res.correctionId)!;
  return { c, items: s.tc.listItems(c.id) };
}

const find = (items: import("./text-correction").CorrectionItem[], quote: string) => items.find((i) => i.quote === quote)!;

test("1–4: spelling, grammar, tenses and punctuation are marked at the exact place, with category and explanation", async () => {
  const s = await setup();
  const { c, items } = await corrected(s);
  assert.equal(c.ai_status, "fertig");
  const doc = s.tc.snapshotDoc(c);
  const at = (i: (typeof items)[number]) => doc[i.block!].r.map((r) => r.x).join("").slice(i.pos_start!, i.pos_end!);

  const spelling = find(items, "Fahrad");
  assert.equal(spelling.category, "rechtschreibung");
  assert.equal(at(spelling), "Fahrad");
  const grammar = find(items, "meinen Freund");
  assert.deepEqual([grammar.category, grammar.replacement, grammar.explanation], ["grammatik", "meinem Freund", "Nach der Präposition „mit“ steht der Dativ."]);
  assert.equal(grammar.block, 0);
  const tense = find(items, "gehte");
  assert.equal(tense.category, "grammatik");
  assert.equal(tense.rule, "Zeitform Präteritum");
  const comma = find(items, "Haus weil");
  assert.equal(comma.category, "zeichensetzung", "„Beistrich“ is understood as Zeichensetzung");
  assert.equal(comma.replacement, "Haus, weil");
  const style = find(items, "sehr sehr schön");
  assert.equal(style.kind, "stil", "style suggestions are kept apart from errors");
  const hint = items.find((i) => i.kind === "hinweis")!;
  assert.equal(hint.category, "struktur");
  assert.equal(hint.block, null);
  assert.ok(items.every((i) => i.status === "offen" && i.source === "ki"), "nothing is accepted without the teacher");
  assert.equal(c.level, "4. Klasse Volksschule");
  s.router.setTransport(null);
});

test("6–8, 17: the original stays as it is; single accept/reject; Endfassung and overview count only accepted ones", async () => {
  const s = await setup("Lena Original");
  const before = s.texts.getText(s.textId)!;
  const { c, items } = await corrected(s);
  s.tc.decideItem(c.id, find(items, "meinen Freund").id, "uebernommen", s.niko.id);
  s.tc.decideItem(c.id, find(items, "Fahrad").id, "uebernommen", s.niko.id);
  s.tc.decideItem(c.id, find(items, "gehte").id, "abgelehnt", s.niko.id);
  // the teacher words one suggestion differently before accepting it
  s.tc.decideItem(c.id, find(items, "sehr sehr schön").id, "uebernommen", s.niko.id, "richtig schön");

  const after = s.texts.getText(s.textId)!;
  assert.equal(after.body, before.body, "the student's text is never changed by a correction");
  assert.equal(after.version, before.version);
  assert.equal(s.tc.getCorrection(c.id)!.body, before.body, "the snapshot is the original version");

  const now = s.tc.listItems(c.id);
  const final = s.tc.applyAccepted(s.tc.snapshotDoc(c), now).doc.map((b) => b.r.map((r) => r.x).join(""));
  assert.deepEqual(final, [
    "Am Samstag fuhr ich mit meinem Freund Max zum See.",
    "Wir fuhren mit dem Fahrrad. Dann gehte ich ins Wasser.",
    "Ich blieb lange im Haus weil es regnete. Es war richtig schön.",
  ]);
  const o = s.tc.overview(now);
  assert.equal(o.fehler, 2, "only the two accepted errors count, not the rejected or open ones");
  assert.equal(o.stil, 1);
  assert.equal(o.open, now.filter((i) => i.status === "offen").length);
  assert.equal(o.rejected, 1);
  assert.deepEqual(o.categories.map((x) => [x.key, x.fehler, x.stil]), [["rechtschreibung", 1, 0], ["grammatik", 1, 0], ["ausdruck", 0, 1]]);
  assert.equal(o.mainIssue, null, "no problem occurs twice yet");

  // reject everything still open, then accept all of one category
  s.tc.decideAll(c.id, "uebernommen", s.niko.id, { category: "zeichensetzung" });
  assert.equal(find(s.tc.listItems(c.id), "Haus weil").status, "uebernommen");
  s.tc.decideAll(c.id, "abgelehnt", s.niko.id);
  assert.equal(s.tc.overview(s.tc.listItems(c.id)).open, 0);
  assert.equal(find(s.tc.listItems(c.id), "gehte").status, "abgelehnt", "„Alle“ only touches open ones");
  s.router.setTransport(null);
});

test("9–10: the student writes on: the old correction stays at its version, unchanged paragraphs keep their decisions; reopening costs nothing", async () => {
  const s = await setup("Tom Weiter");
  const calls: AIRequest[] = [];
  const { c, items } = await corrected(s, fakeKI({ calls }));
  s.tc.decideItem(c.id, find(items, "meinen Freund").id, "uebernommen", s.niko.id);
  s.tc.decideItem(c.id, find(items, "Fahrad").id, "abgelehnt", s.niko.id);
  assert.equal(calls.length, 1);

  // reload / open again: same correction, no new KI request
  const again = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true });
  assert.ok(again.ok && again.reused && again.correctionId === c.id);
  assert.equal(calls.length, 1, "the same version is never sent twice");
  assert.deepEqual(s.tc.listItems(c.id).map((i) => [i.id, i.status]), s.tc.listItems(c.id).map((i) => [i.id, i.status]));

  // the student changes the second paragraph and adds a fourth
  const t = s.texts.getText(s.textId)!;
  const v2 = s.texts.saveText(s.textId, para(STORY[0], "Wir fuhren mit dem Rad. Dann gehte ich schwimmen.", STORY[2], "Am Abend wir gehen nach Hause."), t.version);
  assert.ok(v2.ok);
  const old = s.tc.getCorrection(c.id)!;
  assert.equal(old.version, t.version, "the old correction keeps its version and snapshot");
  assert.equal(s.tc.snapshotDoc(old)[1].r[0].x, STORY[1]);

  const next = s.tc.ensureCorrection(s.textId, s.niko.id);
  assert.notEqual(next.id, c.id);
  const carried = s.tc.listItems(next.id);
  assert.deepEqual(carried.map((i) => [i.quote, i.status]), [["meinen Freund", "uebernommen"], ["Haus weil", "offen"], ["sehr sehr schön", "offen"]], "paragraphs 1 and 3 are unchanged: carried with their status; paragraph 2 changed: nothing carried (not the rejected „Fahrad“)");
  const run = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true });
  assert.ok(run.ok && !run.reused);
  assert.equal(calls.length, 2);
  const fresh = s.tc.listItems(next.id);
  assert.equal(fresh.filter((i) => i.quote === "meinen Freund").length, 1, "no second mark on a place already decided");
  assert.equal(find(fresh, "meinen Freund").status, "uebernommen");
  assert.ok(fresh.some((i) => i.quote === "wir gehen" && i.block === 3), "the new paragraph is checked");
  const doc = s.tc.snapshotDoc(s.tc.getCorrection(next.id)!);
  for (const i of fresh.filter((x) => x.pos_start !== null)) assert.equal(doc[i.block!].r.map((r) => r.x).join("").slice(i.pos_start!, i.pos_end!), i.quote, "every mark sits on its quote");
  s.router.setTransport(null);
});

test("5: an essay of more than 800 words: every repeated error at its own place, the limit of the level is kept", async () => {
  const s = await setup("Eva Lang", "Gymnasium", 7);
  const t = s.texts.getText(s.textId)!;
  const long = Array.from({ length: 33 }, (_, i) => `Absatz ${i + 1}: Am Morgen fuhr ich mit meinen Freund und dem Fahrad zum Haus weil wir dort lernen wollten und es war sehr sehr schön dort.`);
  assert.ok(s.texts.saveText(s.textId, para(...long), t.version).ok);
  assert.ok(s.texts.getText(s.textId)!.words >= 800, `words: ${s.texts.getText(s.textId)!.words}`);
  const started = Date.now();
  const { c, items } = await corrected(s);
  assert.ok(Date.now() - started < 2000, "placing the marks is fast");
  const level = s.tc.levelOfText(s.texts.getText(s.textId)!);
  assert.equal(level.band, "oberstufe");
  const placedItems = items.filter((i) => i.pos_start !== null);
  assert.ok(placedItems.length <= level.maxMarks);
  assert.ok(items.filter((i) => i.kind === "stil").length <= level.maxStyle, "style suggestions are capped (15 in the Oberstufe)");
  assert.equal(new Set(placedItems.map((i) => `${i.block}:${i.pos_start}`)).size, placedItems.length, "no two marks on the same place");
  assert.ok(c.dropped > 0, "what is over the limit is counted as dropped");
  const doc = s.tc.snapshotDoc(c);
  for (const i of placedItems) assert.equal(doc[i.block!].r.map((r) => r.x).join("").slice(i.pos_start!, i.pos_end!), i.quote);
  s.router.setTransport(null);
});

test("the level decides: a Volksschul-Text gets at most 3 style suggestions", async () => {
  const s = await setup("Pia Klein");
  const t = s.texts.getText(s.textId)!;
  assert.ok(s.texts.saveText(s.textId, para(...Array.from({ length: 6 }, () => "Es war sehr sehr schön.")), t.version).ok);
  const { items } = await corrected(s);
  assert.equal(items.filter((i) => i.kind === "stil").length, 3);
  const { correctionPrompt } = await import("./ai/textkorrektur");
  const req = s.tc.correctionRequest(s.texts.getText(s.textId)!, s.tc.snapshotDoc(s.tc.latestCorrection(s.textId)!));
  const prompt = correctionPrompt(req);
  assert.match(prompt, /Schulstufe: 4\. Klasse Volksschule/);
  assert.match(prompt, /Volksschule: Markiere nur Fehler, die ein Kind dieser Stufe schon kennen kann/);
  assert.match(prompt, /Höchstens 3 Stilvorschläge/);
  s.router.setTransport(null);
});

test("names never leave the app: student and teacher names become [Name] and come back in the answer", async () => {
  const s = await setup("Jonas Beispiel");
  const t = s.texts.getText(s.textId)!;
  assert.ok(s.texts.saveText(s.textId, para("Jonas ging mit Niko und meinen Freund zum See.", "Jonas Beispiel war froh."), t.version).ok);
  const calls: AIRequest[] = [];
  const naming = fakeKI({
    calls,
    mutate: (d) => ({ ...d, findings: [...(d.findings as object[]), { para: 1, quote: "[Name] ging", replacement: "[Name] ging dann", category: "ausdruck", kind: "stil", rule: "", explanation: "Test.", skill_id: null }] }),
  });
  const { items } = await corrected(s, naming);
  const sent = JSON.stringify(calls[0].content) + calls[0].system;
  assert.ok(!/Jonas|Beispiel|Niko/.test(sent), "no name in the request");
  assert.match(String(calls[0].content), /\[1\] \[Name\] ging mit \[Name\] und meinen Freund zum See\./);
  const named = items.find((i) => i.rule === "" && i.kind === "stil")!;
  assert.equal(named.quote, "Jonas ging", "the mark sits on the original text");
  assert.equal(named.replacement, "Jonas ging dann", "the name is put back into the suggestion");
  assert.equal(find(items, "meinen Freund").pos_start, "Jonas ging mit Niko und ".length);
  s.router.setTransport(null);
});

test("further names: the app finds friends and others, the teacher unticks a word or adds one, and exactly that goes out", async () => {
  const s = await setup("Jonas Beispiel");
  const t = s.texts.getText(s.textId)!;
  assert.ok(s.texts.saveText(s.textId, para("Ich ging mit Lena Hofer und Frau Novak zum See.", "Hofer lachte, weil Sie froh war. Mein Hund Bello bellte."), t.version).ok);
  const text = s.texts.getText(s.textId)!;
  const preview = s.tc.aiPreview(text);
  assert.deepEqual(preview.names, ["Lena", "Hofer", "Novak"], "„Sie“ and „Mein Hund“ are no names; „Bello“ is not on the list");
  assert.match(preview.masked[0], /Lena Hofer/, "the dialog replaces the found names itself, so they can be unticked");
  // without the dialog: what the app finds
  const req = s.tc.correctionRequest(text, s.texts.textDoc(text));
  assert.equal(req.blocks[1].text, "[Name] lachte, weil Sie froh war. Mein Hund Bello bellte.");
  // the teacher unticks „Hofer“ and adds „Bello“
  const calls: AIRequest[] = [];
  s.router.resetRouter();
  s.router.setTransport(fakeKI({ calls }));
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true, names: ["Lena", "Novak", "Bello"] });
  assert.ok(res.ok);
  const sent = String(calls[0].content);
  assert.match(sent, /\[1\] Ich ging mit \[Name\] Hofer und Frau \[Name\] zum See\./);
  assert.match(sent, /\[2\] Hofer lachte, weil Sie froh war\. Mein Hund \[Name\] bellte\./);
  assert.ok(!/Lena|Novak|Bello|Jonas/.test(sent));
  assert.equal(s.tc.getCorrection(res.correctionId)!.masked_names, JSON.stringify(["Lena", "Novak", "Bello"]), "kept for a later „gründlich nachprüfen“");
  const again = s.tc.aiPreview(text, ["Lena", "Novak", "Bello"]);
  assert.deepEqual([again.names, again.kept], [["Lena", "Hofer", "Novak", "Bello"], ["Lena", "Novak", "Bello"]], "the dialog of „gründlich nachprüfen“ starts from that choice");
  s.router.setTransport(null);
});

test("13: KI not reachable: the error is kept, nothing changes, the teacher can correct by hand", async () => {
  const s = await setup("Ida Ausfall");
  s.router.resetRouter();
  s.router.setTransport(fakeKI({ fail: true }));
  const res = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true });
  assert.ok(res.ok);
  const c = s.tc.getCorrection(res.correctionId)!;
  assert.equal(c.ai_status, "fehler");
  assert.match(c.ai_error!, /nicht erreichbar/);
  assert.equal(s.tc.listItems(c.id).length, 0);
  // by hand: mark "Fahrad" in paragraph 2
  const start = STORY[1].indexOf("Fahrad");
  const added = s.tc.addTeacherItem(c.id, { block: 1, start, end: start + 6, category: "rechtschreibung", kind: "fehler", replacement: "Fahrrad", explanation: "Mit rr." }, s.niko.id);
  assert.ok("item" in added && added.item.status === "uebernommen" && added.item.source === "lehrer" && added.item.quote === "Fahrad");
  assert.ok("error" in s.tc.addTeacherItem(c.id, { block: 1, start, end: start + 3, category: "grammatik", kind: "fehler", replacement: "x", explanation: "" }, s.niko.id), "no second mark on the same place");
  assert.ok("error" in s.tc.addTeacherItem(c.id, { block: 7, start: 0, end: 2, category: "grammatik", kind: "fehler", replacement: "x", explanation: "" }, s.niko.id));
  // retry works once the KI is back
  s.router.resetRouter();
  s.router.setTransport(fakeKI());
  const retry = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true });
  assert.ok(retry.ok && retry.correctionId === c.id && !retry.reused);
  const items = s.tc.listItems(c.id);
  assert.equal(items.filter((i) => i.quote === "Fahrad").length, 1, "the teacher's own mark stays the only one there");
  assert.equal(find(items, "Fahrad").source, "lehrer");
  s.router.setTransport(null);
});

test("without a key and without consent nothing is sent", async () => {
  const s = await setup("Ben Ohne");
  s.router.setTransport(null);
  const off = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true });
  assert.ok(!off.ok && /nicht eingerichtet/.test(off.error));
  s.router.setTransport(fakeKI());
  const noConsent = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: false });
  assert.ok(!noConsent.ok && /bestätigen/.test(noConsent.error));
  assert.equal(s.tc.latestCorrection(s.textId), null, "nothing created");
  s.router.setTransport(null);
});

test("14: invalid or incomplete KI data: an unusable answer is an error, single bad entries are dropped or kept without a place", async () => {
  const s = await setup("Uwe Unsinn");
  s.router.resetRouter();
  s.router.setTransport(async (req) => ({ parsed: null, refusal: false, model: req.model, usage: { input: 10, output: 10, cacheWrite: 0, cacheRead: 0 } }));
  const bad = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true });
  assert.ok(bad.ok);
  assert.equal(s.tc.getCorrection(bad.correctionId)!.ai_status, "fehler");
  assert.match(s.tc.getCorrection(bad.correctionId)!.ai_error!, /keine verwertbare Antwort/);

  const messy = fakeKI({
    mutate: (d) => ({
      ...d,
      findings: [
        ...(d.findings as object[]),
        { para: 9, quote: "See", replacement: "Meer", category: "grammatik", kind: "fehler", rule: "", explanation: "x", skill_id: null }, // no such paragraph
        { para: 1, quote: "See", replacement: "Meer", category: "Farbe", kind: "fehler", rule: "", explanation: "x", skill_id: null }, // unknown category
        { para: 1, quote: "Samstag", replacement: "Samstag", category: "grammatik", kind: "fehler", rule: "", explanation: "x", skill_id: null }, // no change
        { para: 1, quote: "", replacement: "x", category: "grammatik", kind: "fehler", rule: "", explanation: "x", skill_id: null }, // no quote
        { para: 1, quote: "Sonntag", replacement: "Montag", category: "inhalt", kind: "fehler", rule: "", explanation: "Erfunden.", skill_id: "erfunden.id" }, // not in the text
        { para: 2, quote: "Wir  fuhren", replacement: "Wir fahren", category: "grammatik", kind: "fehler", rule: "", explanation: "Zwei Leerzeichen im Zitat.", skill_id: null },
      ],
    }),
  });
  s.router.resetRouter();
  s.router.setTransport(messy);
  const again = await s.tc.startAICorrection(s.textId, s.niko.id, { consent: true, wait: true });
  assert.ok(again.ok);
  const c = s.tc.getCorrection(again.correctionId)!;
  assert.equal(c.ai_status, "fertig");
  assert.equal(c.dropped, 4);
  const items = s.tc.listItems(c.id);
  const ghost = find(items, "Sonntag");
  assert.equal(ghost.pos_start, null, "a quote that is not in the text is never marked at a guessed place");
  assert.equal(ghost.skill_id, null, "unknown skill ids are not kept");
  const spaced = items.find((i) => i.explanation === "Zwei Leerzeichen im Zitat.")!;
  assert.equal(spaced.quote, "Wir fuhren", "small differences in spaces and quotes are tolerated");
  s.router.setTransport(null);
});

test("15–16: two teachers at the same time with different students; nothing crosses over", async () => {
  const repo = await import("./repo");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const router = await import("./ai/router");
  const auth = await import("./auth");
  const teachers = repo.listTeachers();
  const [a, b] = [teachers[0], teachers[1] ?? teachers[0]];
  const s1 = repo.createStudent(kid("Clara Eins", a.id));
  const s2 = repo.createStudent(kid("David Zwei", b.id, "Gymnasium", 3));
  const t1 = texts.createText({ studentId: s1, teacherId: a.id, unitId: null, subject: "Deutsch", topic: "Erlebniserzählung", title: "Eins", prompt: "" });
  const t2 = texts.createText({ studentId: s2, teacherId: b.id, unitId: null, subject: "Deutsch", topic: "Beschwerdebrief", title: "Zwei", prompt: "" });
  texts.saveText(t1.id, para("Ich fuhr mit meinen Freund zum Fahrad Geschäft und es war schön."), 0);
  texts.saveText(t2.id, para("Ich blieb im Haus weil es regnete und wir gehen später einkaufen."), 0);
  router.resetRouter();
  const calls: AIRequest[] = [];
  router.setTransport(fakeKI({ calls, delayMs: 50 }));
  const [r1, r2] = await Promise.all([tc.startAICorrection(t1.id, a.id, { consent: true, wait: true }), tc.startAICorrection(t2.id, b.id, { consent: true, wait: true })]);
  assert.ok(r1.ok && r2.ok);
  assert.equal(calls.length, 2);
  const i1 = tc.listItems(r1.correctionId);
  const i2 = tc.listItems(r2.correctionId);
  assert.deepEqual(i1.filter((i) => i.pos_start !== null).map((i) => i.quote).sort(), ["Fahrad", "meinen Freund"]);
  assert.deepEqual(i2.filter((i) => i.pos_start !== null).map((i) => i.quote).sort(), ["Haus weil", "wir gehen"]);
  assert.equal(tc.getCorrection(r1.correctionId)!.ai_consent_by, a.id);
  assert.equal(tc.getCorrection(r2.correctionId)!.ai_consent_by, b.id);
  assert.equal(tc.getCorrection(r2.correctionId)!.level, "3. Klasse Gymnasium (Unterstufe)");
  // an item id of one correction cannot be decided through another
  assert.equal(tc.decideItem(r1.correctionId, i2[0].id, "uebernommen", a.id), null);
  assert.equal(tc.listItems(r2.correctionId)[0].status, "offen");
  assert.equal(tc.removeTeacherItem(r1.correctionId, i2[0].id), false);
  assert.ok(auth); // teacher routes require a login (checked in the browser test)
  router.setTransport(null);
});

test("Lernverlauf: confirmed text errors are listed by category, the Lernstand does not change", async () => {
  const s = await setup("Nora Verlauf");
  const mastery = await import("./mastery");
  const before = JSON.stringify(s.db().prepare("SELECT * FROM skill_snapshots WHERE student_id = ?").all(s.sid)) + JSON.stringify(s.repo.listAttemptsForStudent(s.sid));
  const { c, items } = await corrected(s);
  for (const q of ["meinen Freund", "gehte", "Fahrad"]) s.tc.decideItem(c.id, find(items, q).id, "uebernommen", s.niko.id);
  const errs = s.tc.textErrorsForStudent(s.sid);
  assert.deepEqual(errs.map((e) => [e.category, e.count]), [["grammatik", 2], ["rechtschreibung", 1]]);
  const info = s.tc.correctionInfoForStudent(s.sid).get(s.textId)!;
  assert.equal(info.fehler, 3);
  assert.equal(info.open, items.length - 3);
  const after = JSON.stringify(s.db().prepare("SELECT * FROM skill_snapshots WHERE student_id = ?").all(s.sid)) + JSON.stringify(s.repo.listAttemptsForStudent(s.sid));
  assert.equal(after, before, "no attempts, no snapshots: the Lernstand stays as it was");
  assert.ok(mastery);
  const o = s.tc.overview(s.tc.listItems(c.id));
  assert.equal(o.mainIssue, "Grammatik", "two grammar errors with different rules: the category is the main issue");
  assert.equal(s.tc.recommendationOf(s.tc.getCorrection(c.id)!, o)?.skillId, "deutsch.grammatik.faelle");
  // sharing shows only accepted ones to the student
  assert.equal(s.tc.sharedCorrection(s.textId), null);
  s.tc.setShared(c.id, true);
  assert.deepEqual(s.tc.sharedCorrection(s.textId)!.items.map((i) => i.quote).sort(), ["Fahrad", "gehte", "meinen Freund"]);
  s.router.setTransport(null);
});

test("pure helpers: quotes with typographic marks, overlapping places, Endfassung keeps formatting", async () => {
  const { findQuote, applyAccepted, segmentsOf, maskText, namePattern } = await import("./text-correction-core");
  assert.deepEqual(findQuote("Er sagte „Hallo“ und ging.", '"Hallo"', 0, []), { start: 9, end: 16 });
  assert.deepEqual(findQuote("das das das", "das", 4, [{ start: 4, end: 7 }]), { start: 8, end: 11 }, "the next free occurrence after the previous finding");
  assert.equal(findQuote("Hallo", "Tschüss", 0, []), null);
  const doc = [{ t: "p" as const, r: [{ x: "Ich ging mit " }, { x: "meinen", b: 1 as const }, { x: " Freund." }] }];
  const out = applyAccepted(doc, [{ id: 1, block: 0, pos_start: 13, pos_end: 19, replacement: "meinem", status: "uebernommen" }]);
  assert.deepEqual(out.doc[0].r, [{ x: "Ich ging mit " }, { x: "meinem", b: 1 }, { x: " Freund." }]);
  assert.deepEqual(out.changes.get(0), [{ start: 13, end: 19, id: 1 }]);
  const seg = segmentsOf(doc[0], [{ id: 1, pos_start: 13, pos_end: 26 }]);
  assert.deepEqual(seg.map((x) => [x.itemId, x.start, x.runs.map((r) => r.x).join("")]), [[null, 0, "Ich ging mit "], [1, 13, "meinen Freund"], [null, 26, "."]]);
  const m = maskText("Annas Hund und Anna.", namePattern(["Anna Berg"]));
  assert.equal(m.masked, "[Name] Hund und [Name].");
  assert.equal(m.toOrig[m.masked.indexOf("Hund")], 6);
});
