/**
 * Schreibaufträge der SRDP (lib/schreibauftrag.ts, lib/schreibauftrag-store.ts): the Textsorten with their
 * Schreibplan and word budgets, the Arbeitsaufträge, the Hinweise without KI (the model texts get no Tipp, a missing
 * Anrede or Konjunktiv is pointed at), the examples, the store, the builder's Teilübungen instead of short mini
 * tasks, and the KI correction, which stays as it was for every Textsorte but the Textinterpretation.
 * No KI call leaves the test: every request goes to router.setTransport.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

type AIRequest = import("./ai/router").AIRequest;
type AIResult = import("./ai/providers/types").AIResult;
type BuilderSettings = import("./builder").BuilderSettings;
type SorteKey = import("./schreibauftrag").SorteKey;
type AuftragView = import("./schreibauftrag").AuftragView;

const usage = { input: 900, output: 300, cacheWrite: 0, cacheRead: 0 };
const sa = () => import("./schreibauftrag");
const docOf = async (text: string) => (await import("./text-doc")).docFromText(text);

/** The eight new Textsorten (the Textinterpretation has its own tests in lib/textinterpretation.test.ts). */
const NEW: Exclude<SorteKey, "textinterpretation">[] = ["zusammenfassung", "leserbrief", "eroerterung", "kommentar", "meinungsrede", "textanalyse", "offenerbrief", "empfehlung"];

const kid = (name: string, teacherId: number, school_type = "Gymnasium", klasse = 7) => ({
  name, grade: klasse, klasse, teacher_id: teacherId, school: "", school_type, subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

/** The example of a Textsorte as the writing view sees it. */
async function viewOf(sorte: SorteKey, o: Partial<AuftragView> = {}): Promise<AuftragView> {
  const { beispielFor, SORTEN } = await sa();
  const b = beispielFor(sorte);
  return { sorte, ...b.beilage, countBlank: false, target: SORTEN[sorte].target, situation: b.situation, ...o };
}

async function hintsOn(sorte: SorteKey, text: string, o: Partial<AuftragView> = {}) {
  const { hinweiseFor } = await sa();
  return hinweiseFor(await docOf(text), await viewOf(sorte, o));
}
const tone = (hs: { key: string; tone: string }[], key: string) => hs.find((h) => h.key === key)?.tone;

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

async function setup(name: string) {
  const repo = await import("./repo");
  const store = await import("./schreibauftrag-store");
  const texts = await import("./texts");
  const units = await import("./units");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  const unitId = units.startUnit(niko.id, sid, { subject: "Deutsch" }).unit.id;
  return { repo, store, texts, units, niko, sid, unitId };
}

/** The settings of a Schreibauftrag about the example's Textbeilage. */
async function exampleSettings(sorte: SorteKey, o: Record<string, unknown> = {}) {
  const { beispielFor } = await sa();
  const { cleanAuftragSettings } = await import("./schreibauftrag-store");
  const b = beispielFor(sorte);
  const out = cleanAuftragSettings(sorte, { title: b.beilage.title, author: b.beilage.author, year: b.beilage.year, medium: b.beilage.medium, kind: b.beilage.kind, story: b.beilage.text, situation: b.situation, target: "", prompt: "", ...o });
  if ("error" in out) throw new Error(out.error);
  return out.settings;
}

// ---------- the Textsorten ----------

test("Textsorten: every SRDP Textsorte has its skill, a default target, three to six parts and formal features", async () => {
  const { SORTEN, SORTE_KEYS, sorteOfSkill, isSorte } = await sa();
  assert.deepEqual(SORTE_KEYS, [...NEW, "textinterpretation"]);
  const targets = Object.fromEntries(SORTE_KEYS.map((k) => [k, SORTEN[k].target]));
  assert.deepEqual(targets, { zusammenfassung: 300, leserbrief: 300, eroerterung: 600, kommentar: 450, meinungsrede: 600, textanalyse: 600, offenerbrief: 450, empfehlung: 300, textinterpretation: 500 });
  for (const k of NEW) {
    const s = SORTEN[k];
    assert.equal(s.key, k);
    assert.equal(s.skill, `deutsch.os.matura.${k}`);
    assert.equal(sorteOfSkill(s.skill), k);
    assert.ok(s.parts.length >= 4 && s.parts.length <= 6, k);
    assert.ok(Math.abs(s.parts.reduce((n, p) => n + p.share, 0) - 1) < 1e-9, `${k}: the shares add up to the whole`);
    assert.equal(new Set(s.parts.map((p) => p.key)).size, s.parts.length, `${k}: part keys are unique`);
    assert.ok(s.parts.every((p) => p.title && p.hint && p.criteria.length === 3), k);
    assert.ok(s.merkmale.length >= 4, `${k}: formal features`);
    assert.ok(s.checks.length >= 2, `${k}: Hinweise of its own`);
  }
  assert.equal(sorteOfSkill("deutsch.os.matura.aufgabe"), null, "the Operatoren are no Schreibauftrag");
  assert.equal(sorteOfSkill("deutsch.os.matura.textinterpretation"), "textinterpretation");
  assert.equal(sorteOfSkill(null), null);
  assert.ok(isSorte("leserbrief") && !isSorte("brief"));
});

test("Schreibplan: a word budget per part, rounded to 5, following the target the teacher sets", async () => {
  const { planFor, SORTEN } = await sa();
  for (const k of NEW) {
    const plan = planFor({ sorte: k, target: SORTEN[k].target, kind: SORTEN[k].defaultKind });
    assert.deepEqual(plan.map((p) => p.key), SORTEN[k].parts.map((p) => p.key));
    assert.ok(plan.every((p) => p.words % 5 === 0 && p.words >= 10), k);
    const sum = plan.reduce((n, p) => n + p.words, 0);
    assert.ok(Math.abs(sum - SORTEN[k].target) <= 5 * plan.length, `${k}: ${sum}`);
  }
  assert.deepEqual(planFor({ sorte: "leserbrief", target: 300, kind: "Kommentar" }).map((p) => p.words), [45, 30, 150, 75]);
  assert.deepEqual(planFor({ sorte: "leserbrief", target: 400, kind: "Kommentar" }).map((p) => p.words), [60, 40, 200, 100]);
  assert.deepEqual(planFor({ sorte: "eroerterung", target: 600, kind: "Kolumne" }).map((p) => p.words), [60, 90, 180, 180, 90]);
  // a target out of range falls back to the Textsorte's default
  assert.deepEqual(planFor({ sorte: "empfehlung", target: Number.NaN, kind: "Reportage" }).map((p) => p.words), [45, 75, 120, 60]);
  // the Textinterpretation keeps its seven parts
  assert.equal(planFor({ sorte: "textinterpretation", target: 500, kind: "Kurzgeschichte" }).length, 7);
});

test("Arbeitsauftrag: Textsorte, Textbeilage with medium and date, Schreibsituation, three tasks and the word range", async () => {
  const { arbeitsauftrag, SORTEN } = await sa();
  const a = { title: "Ausgeschlafen lernt es sich besser", author: "Helene Baumgartl", year: "12. März 2026", medium: "Der Talblick", kind: "Kommentar" };
  const lb = arbeitsauftrag({ ...a, sorte: "leserbrief", target: 300, situation: "Du schreibst als Schülerin oder Schüler." });
  assert.equal(
    lb,
    [
      "Verfasse einen Leserbrief zum Kommentar „Ausgeschlafen lernt es sich besser“ von Helene Baumgartl (Der Talblick, 12. März 2026).",
      "Du schreibst als Schülerin oder Schüler.",
      "Bearbeite dabei die folgenden Arbeitsaufträge:",
      "• Gib kurz wieder, welche Position der Text vertritt.",
      "• Nimm mit Argumenten Stellung zu dieser Position.",
      "• Richte am Schluss einen Appell an eine Gruppe, die dir wichtig ist.",
      "Schreib zwischen 270 und 330 Wörter.",
    ].join("\n"),
  );
  // the question of the Erörterung goes into the second task, without doubled quotation marks
  assert.match(arbeitsauftrag({ ...a, sorte: "eroerterung", kind: "Kolumne", target: 600, situation: "„Soll der Unterricht später beginnen?“" }), /• Erörtere die Frage „Soll der Unterricht später beginnen\?“ mit Argumenten/);
  // the addressee of the offener Brief and the target group of the Empfehlung
  assert.match(arbeitsauftrag({ ...a, sorte: "offenerbrief", kind: "Bericht", target: 450, situation: "die Direktorin der Schule" }), /^Verfasse einen offenen Brief an die Direktorin der Schule\.\nNimm dabei Bezug auf den Bericht „/);
  assert.match(arbeitsauftrag({ ...a, sorte: "empfehlung", kind: "Reportage", target: 300, situation: "die Eltern der ersten Klassen" }), /^Verfasse eine Empfehlung für die Eltern der ersten Klassen\.\nGrundlage ist die Reportage „/);
  // without a Schreibsituation there is still a whole Arbeitsauftrag
  assert.match(arbeitsauftrag({ ...a, sorte: "offenerbrief", kind: "Bericht", target: 450, situation: "" }), /^Verfasse einen offenen Brief zum Thema des Berichts „/);
  for (const k of NEW) {
    const text = arbeitsauftrag({ ...a, kind: SORTEN[k].defaultKind, sorte: k, target: SORTEN[k].target, situation: SORTEN[k].situation ? "Eine Situation." : "" });
    assert.equal((text.match(/^• /gm) ?? []).length, 3, `${k}: three Arbeitsaufträge`);
    assert.ok(!/[—]| – /.test(text), `${k}: no dashes`);
    assert.ok(!/\b(?:Sie|Ihr|Ihre)\b/.test(text), `${k}: du, not Sie`);
    assert.ok(text.includes("(Der Talblick, 12. März 2026)"), k);
  }
});

test("Textbeilage: a reference with medium and date, kinds of Sachtexte, wrapped lines from a web page", async () => {
  const { beilageReference, kindsOf, isKindOf, wrapLines, hasLongLines, auftragTitle } = await sa();
  assert.equal(beilageReference({ title: "Titel", author: "Erfundene Autorin", medium: "Stadtzeitung", year: "3. Februar 2026" }), "„Titel“ von Erfundene Autorin (Stadtzeitung, 3. Februar 2026)");
  assert.equal(beilageReference({ title: "Titel", author: "", medium: "", year: "2026" }), "„Titel“ (2026)");
  assert.ok(kindsOf("leserbrief").includes("Kommentar") && !kindsOf("leserbrief").includes("Kurzgeschichte"));
  assert.ok(kindsOf("textinterpretation").includes("Kurzgeschichte"));
  assert.ok(isKindOf("kommentar", "Bericht") && !isKindOf("kommentar", "Parabel"));
  assert.equal(auftragTitle("offenerbrief", "Jugendtreff schließt künftig um 20 Uhr"), "Offener Brief zu „Jugendtreff schließt künftig um 20 Uhr“");

  const web = `${"Ein langer Absatz aus einer Webseite mit vielen Wörtern hintereinander. ".repeat(6).trim()}\n\nZweiter Absatz, kurz.`;
  assert.ok(hasLongLines(web));
  const wrapped = wrapLines(web);
  const lines = wrapped.split("\n");
  assert.ok(lines.every((l) => l.length <= 62), "lines of about 62 characters");
  assert.ok(lines.length >= 8);
  assert.equal(lines.at(-2), "", "an empty line stays");
  assert.equal(lines.at(-1), "Zweiter Absatz, kurz.", "a line that fits stays as it is");
  assert.equal(wrapped.replace(/\s+/g, " "), web.replace(/\s+/g, " "), "no word is lost or split");
  assert.ok(!hasLongLines(wrapped));
});

// ---------- the examples ----------

test("examples: every Textsorte has a Textbeilage and a model text within the word range, part by part", async () => {
  const { beispielFor, beispielText, SORTEN, isKindOf } = await sa();
  const { countWords } = await import("./text-doc");
  const { wordRange, numberedLines, lastLine } = await import("./textinterpretation");
  for (const k of NEW) {
    const b = beispielFor(k);
    assert.ok(isKindOf(k, b.beilage.kind), `${k}: ${b.beilage.kind}`);
    assert.ok(b.beilage.title && b.beilage.author && b.beilage.medium && b.beilage.year, k);
    const lines = numberedLines(b.beilage.text);
    assert.ok(lastLine(lines) >= 25 && lastLine(lines) <= 40, `${k}: ${lastLine(lines)} lines`);
    assert.ok(lines.every((l) => l.text.length <= 62), `${k}: printed lines`);
    assert.deepEqual(b.teile.map((t) => t.key), SORTEN[k].parts.map((p) => p.key), `${k}: one model part per part of the Schreibplan`);
    const { min, max } = wordRange(SORTEN[k].target);
    const words = countWords(beispielText(k));
    assert.ok(words >= min && words <= max, `${k}: ${words} words, ${min} to ${max}`);
    assert.ok(!/[—]| – /.test(beispielText(k)), `${k}: no dashes`);
    if (SORTEN[k].situation?.pflicht) assert.ok(b.situation, `${k}: the Schreibsituation it needs`);
  }
});

test("examples: the model texts get no Tipp, only Passt and Info", async () => {
  const { beispielText } = await sa();
  for (const k of NEW) {
    const hs = await hintsOn(k, beispielText(k));
    assert.deepEqual(hs.filter((h) => h.tone === "tipp"), [], k);
    assert.equal(tone(hs, "umfang"), "gut", k);
    assert.equal(tone(hs, "absaetze"), "gut", k);
  }
});

test("examples: every quote of the model Textanalyse stands at the line it gives", async () => {
  const { beispielFor, beispielText } = await sa();
  const { findInStory, numberedLines, quotesOf, bareText } = await import("./textinterpretation");
  const b = beispielFor("textanalyse");
  const lines = numberedLines(b.beilage.text);
  const quotes = quotesOf(await docOf(beispielText("textanalyse"))).filter((q) => ![b.beilage.title, b.beilage.medium].map(bareText).includes(bareText(q.text)));
  assert.ok(quotes.length >= 8);
  for (const q of quotes) {
    assert.ok(q.refs.length, q.text);
    const found = findInStory(lines, q.text);
    assert.ok(found.length, `„${q.text}“ stands in the Textbeilage`);
    const r = q.refs[0];
    const to = r.to === "ff" ? 99 : r.to;
    assert.ok(found.some((f) => f.from >= r.from && f.to <= to), `„${q.text}“ at Z. ${r.from}`);
  }
});

// ---------- Hinweise ----------

test("Hinweise: what a Textsorte needs is pointed at, and a right text is not flagged", async () => {
  const { beispielText } = await sa();
  // Leserbrief without Betreff, Anrede and Gruß
  const plain = beispielText("leserbrief").split("\n").slice(2, -2).join("\n");
  const lb = await hintsOn("leserbrief", plain);
  assert.equal(tone(lb, "betreff"), "tipp");
  assert.equal(tone(lb, "anrede"), "tipp");
  assert.equal(tone(lb, "gruss"), "tipp");
  assert.equal(tone(lb, "bezug"), "gut", "the Bezug is still there");

  // Zusammenfassung: own opinion, copied passages and no Konjunktiv are pointed at
  const zf = await hintsOn(
    "zusammenfassung",
    [
      "Der Zeitungsartikel „Jeder Tropfen zählt“ von Agnes Pröll ist am 8. Mai 2026 in der Zeitung „Der Talblick“ erschienen.",
      `Im August mussten mehrere Gemeinden verbieten, Gärten zu gießen und Pools zu befüllen. ${"Die Autorin schreibt über Wasser und Regen in der Region. ".repeat(10)}`,
      "Ich finde das Sammeln von Regen sehr gut.",
    ].join("\n"),
  );
  assert.equal(tone(zf, "eigeneWorte"), "tipp");
  assert.match(zf.find((h) => h.key === "eigeneWorte")!.text, /„Im August mussten mehrere Gemeinden verbieten/);
  assert.equal(tone(zf, "meinung"), "tipp");
  assert.match(zf.find((h) => h.key === "meinung")!.text, /Ich finde das Sammeln/);
  assert.equal(tone(zf, "konjunktiv"), "tipp");
  assert.equal(tone(zf, "bezug"), "gut");
  // a quoted opinion is not the writer's
  const quoted = await hintsOn("zusammenfassung", `${beispielText("zusammenfassung")}\nDie Hydrologin sagt: „Ich finde, das lohnt sich.“`);
  assert.equal(tone(quoted, "meinung"), "gut");

  // Erörterung with the title of the Textbeilage as heading and one side only
  const er = await hintsOn("eroerterung", `Schluss mit der Hausübung!\nFelix Wanninger schreibt im Familienjournal über die Hausübung. ${"Die Hausübung ist schlecht, weil sie zum Beispiel Zeit kostet. ".repeat(30)}`);
  assert.equal(tone(er, "ueberschrift"), "tipp");
  assert.match(er.find((h) => h.key === "ueberschrift")!.text, /Titel der Textbeilage/);
  assert.equal(tone(er, "abwaegen"), "tipp");
  assert.equal(tone(er, "argumente"), "gut");

  // Meinungsrede without questions, without addressing the audience and without thanks
  const mr = await hintsOn("meinungsrede", `Liebe Mitschülerinnen und Mitschüler!\nDie Kolumne „Schluss mit der Hausübung!“ fordert viel. ${"Die Hausübung kostet Zeit, weil sie lang ist, zum Beispiel am Abend. ".repeat(25)}`);
  assert.equal(tone(mr, "anrede"), "gut");
  assert.equal(tone(mr, "fragen"), "tipp");
  assert.equal(tone(mr, "publikum"), "tipp");
  assert.equal(tone(mr, "dank"), "info", "a thank-you is a custom, never a fault");

  // offener Brief without date and demand; Empfehlung without a recommendation at the end
  const ob = await hintsOn("offenerbrief", `Sehr geehrte Frau Bürgermeisterin,\nder Bericht in der Stadtzeitung Neustein hat uns geärgert. ${"Der Treff ist wichtig, weil viele dort sind, zum Beispiel Lehrlinge. ".repeat(20)}\nMit freundlichen Grüßen\nEine Klasse`);
  assert.equal(tone(ob, "datum"), "tipp");
  assert.equal(tone(ob, "forderung"), "tipp");
  assert.equal(tone(ob, "gruss"), "gut");
  const em = await hintsOn("empfehlung", `Reparieren lernen\nDie Stadtzeitung Neustein berichtet über das Reparaturcafé. ${"Es ist dort nett, weil man zum Beispiel Kaffee bekommt. ".repeat(20)}`);
  assert.equal(tone(em, "empfehlung"), "tipp");
  assert.equal(tone(em, "ueberschrift"), "gut");

  // Textanalyse: a quote without a line number and a line the Textbeilage does not have
  const ta = await hintsOn("textanalyse", `Der Kommentar „Ausgeschlafen lernt es sich besser“ von Helene Baumgartl erschien im „Der Talblick“. ${"Die Autorin argumentiert sachlich. ".repeat(20)} Sie schreibt „Faul? Nein. Müde.“ und später „Das alles stimmt.“ (Z. 90).`);
  assert.equal(tone(ta, "zitate"), "tipp", "one quote without a line number");
  assert.match(ta.find((h) => h.key === "zitate")!.text, /1 von 2 Zitaten/, "the medium in quotation marks is no quote");
  assert.equal(tone(ta, "zeilen"), "tipp");

  // the Bezug: the Kommentar needs one of title, author or medium anywhere; the Zusammenfassung all of them at the start
  const ko = await hintsOn("kommentar", `Zu spät für die Jugend\n${"Der Treff schließt früher, weil sich Nachbarn beschweren, zum Beispiel über Lärm. ".repeat(10)}`);
  assert.equal(tone(ko, "bezug"), "tipp");
  const ko2 = await hintsOn("kommentar", `Zu spät für die Jugend\n${"Der Treff schließt früher, weil sich Nachbarn beschweren, zum Beispiel über Lärm. ".repeat(10)}\nSo berichtet die Stadtzeitung Neustein.`);
  assert.equal(tone(ko2, "bezug"), "gut");
  const zf2 = await hintsOn("zusammenfassung", `Der Artikel „Jeder Tropfen zählt“ erschien in einer Zeitung. ${"Die Autorin sagt, Regen sei wichtig. ".repeat(10)}`);
  assert.equal(tone(zf2, "bezug"), "tipp");
  assert.match(zf2.find((h) => h.key === "bezug")!.text, /den Namen Agnes Pröll und das Medium „Der Talblick“/);
});

test("Hinweise: a short start gets only the length, and the hints never grade", async () => {
  const { hinweiseFor } = await sa();
  for (const k of NEW) {
    const hs = hinweiseFor(await docOf("Ein Anfang."), await viewOf(k));
    assert.deepEqual(hs.map((h) => h.key), ["umfang"], k);
    assert.equal(hs[0].tone, "info");
  }
  const empty = hinweiseFor([], await viewOf("leserbrief"));
  assert.match(empty[0].text, /Noch nichts geschrieben\. Ziel: 270 bis 330 Wörter\./);
});

// ---------- the store ----------

test("store: a Leserbrief is a Textarbeit with its Textbeilage, medium and Schreibsituation; the Textinterpretation does not see it", async () => {
  const s = await setup("Mia Leserbrief");
  const ti = await import("./textinterpretation-store");
  const settings = await exampleSettings("leserbrief");
  const text = s.store.createAuftrag({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, settings });
  assert.equal(text.topic, "Leserbrief");
  assert.equal(text.title, "Leserbrief zu „Ausgeschlafen lernt es sich besser“");
  assert.equal(text.unit_id, s.unitId);
  assert.match(text.prompt, /^Verfasse einen Leserbrief zum Kommentar „Ausgeschlafen lernt es sich besser“ von Helene Baumgartl \(Der Talblick, 12\. März 2026\)\.\nDu schreibst als Schülerin/);
  const v = s.store.auftragFor(text.id)!;
  assert.deepEqual([v.sorte, v.title, v.author, v.medium, v.year, v.kind, v.target, v.countBlank], ["leserbrief", "Ausgeschlafen lernt es sich besser", "Helene Baumgartl", "Der Talblick", "12. März 2026", "Kommentar", 300, false]);
  assert.equal(v.text.split("\n").length, 32, "the line breaks are kept");
  assert.equal(v.situation, "Du schreibst als Schülerin oder Schüler einer Oberstufe aus der Region.");
  assert.deepEqual([...s.store.auftragIds([text.id, text.id + 1000])], [[text.id, "leserbrief"]]);

  // the Textinterpretation's functions only see Textinterpretationen
  assert.equal(ti.interpretationFor(text.id), null);
  assert.equal(ti.interpretationContext(text.id), null);
  assert.equal(ti.getInterpretation(text.id), null);
  assert.equal(ti.settingsOf(text.id), null);
  assert.deepEqual([...ti.interpretationIds([text.id])], []);
  assert.throws(() => ti.updateInterpretation(text.id, (ti.cleanSettings({ title: "T", story: "a\nb\nc\nd\ne" }) as { settings: Parameters<typeof ti.updateInterpretation>[1] }).settings), /Diese Textinterpretation gibt es nicht/);

  // the teacher changes target, Schreibsituation and Arbeitsauftrag: the written text stays
  assert.ok(s.texts.saveText(text.id, [{ t: "p", r: [{ x: "Mein Anfang." }] }], 0).ok);
  const changed = await exampleSettings("leserbrief", { target: "350", situation: "Du schreibst als Elternvertreterin.", prompt: "" });
  s.store.updateAuftrag(text.id, changed);
  const after = s.texts.getText(text.id)!;
  assert.match(after.prompt, /Du schreibst als Elternvertreterin\./);
  assert.match(after.prompt, /zwischen 320 und 390 Wörter/);
  assert.equal(after.words, 2);
  assert.equal(s.store.auftragFor(text.id)!.target, 350);
  assert.equal(s.store.auftragSettingsOf(text.id)!.situation, "Du schreibst als Elternvertreterin.");
  // the Textsorte of a Schreibauftrag does not change
  assert.throws(() => s.store.updateAuftrag(text.id, { ...changed, sorte: "kommentar" }), /Diesen Schreibauftrag gibt es nicht/);
  assert.equal(s.store.auftragFor(text.id + 999), null);
});

test("store: what is missing is said; kind, target and Schreibsituation fall back to the Textsorte's", async () => {
  const { cleanAuftragSettings } = await import("./schreibauftrag-store");
  const beilage = Array.from({ length: 12 }, (_, i) => `Zeile ${i + 1} des Artikels.`).join("\n");
  assert.deepEqual(cleanAuftragSettings("kommentar", { title: "", story: beilage }), { error: "Bitte den Titel der Textbeilage eingeben." });
  assert.deepEqual(cleanAuftragSettings("kommentar", { title: "T", story: " " }), { error: "Bitte den Text der Textbeilage einfügen." });
  assert.deepEqual(cleanAuftragSettings("textinterpretation", { title: "", story: beilage }), { error: "Bitte den Titel der Geschichte eingeben." });
  const web = cleanAuftragSettings("kommentar", { title: "T", story: "Ein ganzer Absatz ohne Zeilenumbruch, so wie er aus einer Webseite kommt." }) as { error: string };
  assert.match(web.error, /nur 1 Zeile/);
  assert.match(web.error, /„Zeilen umbrechen“/);
  const ok = cleanAuftragSettings("empfehlung", { title: "„Titel“", story: beilage, kind: "Kurzgeschichte", target: "abc", medium: "  Die   Zeitung ", situation: " die  Eltern " });
  assert.ok("settings" in ok);
  assert.deepEqual([ok.settings.title, ok.settings.kind, ok.settings.target, ok.settings.medium, ok.settings.situation], ["Titel", "Reportage", 300, "Die Zeitung", "die Eltern"]);
  assert.match(ok.settings.prompt, /^Verfasse eine Empfehlung für die Eltern\./);
  // a Textsorte without Schreibsituation keeps none, the Textinterpretation no medium
  const ta = cleanAuftragSettings("textanalyse", { title: "T", story: beilage, situation: "Eine Situation", medium: "Zeitung" });
  assert.ok("settings" in ta && ta.settings.situation === "" && ta.settings.medium === "Zeitung");
  const ti = cleanAuftragSettings("textinterpretation", { title: "T", story: beilage, medium: "Zeitung" });
  assert.ok("settings" in ti && ti.settings.medium === "" && ti.settings.kind === "Kurzgeschichte" && ti.settings.target === 500);
});

test("store: the migration adds Textsorte, medium and Schreibsituation; old rows are Textinterpretationen", async () => {
  const { db } = await import("./db");
  const cols = (db().prepare("PRAGMA table_info(text_interpretations)").all() as { name: string; dflt_value: string | null }[]).map((c) => [c.name, c.dflt_value]);
  const by = Object.fromEntries(cols);
  assert.equal(by.sorte, "'textinterpretation'");
  assert.equal(by.story_medium, "''");
  assert.equal(by.situation, "''");
});

// ---------- the builder ----------

const settings = (o: Partial<BuilderSettings> = {}): BuilderSettings => ({
  studentId: null, subject: "Deutsch", schoolType: "Gymnasium", klasse: 7, skillIds: ["deutsch.os.matura.leserbrief"],
  difficulty: "mittel", count: 4, categories: [], focus: "", useAI: true, title: "", ...o,
});

test("builder: every Textsorte makes Teilübungen on its Textbeilage with line numbers, without asking the KI", async () => {
  const builder = await import("./builder");
  const { SORTEN, beispielFor, maxTeiluebungen } = await sa();
  const { readingSet, readingIssues, readingSetIssues } = await import("./lesen");
  for (const k of NEW) {
    const s = SORTEN[k];
    const { out, calls } = await withStub(() => {
      throw new Error("no KI for Schreibaufträge");
    }, () => builder.generateTasks(settings({ skillIds: [s.skill], count: s.parts.length }), null));
    assert.equal(calls.length, 0, `${k}: no request to the KI`);
    assert.equal(out.source, "generator");
    assert.deepEqual(out.tasks.map((t) => t.data.teil), s.parts.map((p) => p.key), k);
    const b = beispielFor(k);
    for (const t of out.tasks) {
      assert.equal(t.type, "free");
      assert.equal(t.skillId, s.skill);
      assert.equal(t.data.zeilen, true);
      assert.equal(t.data.schreibsorte, k);
      assert.equal(t.data.passage, b.beilage.text, `${k}: without a Textbeilage of the student's own: the example`);
      assert.equal(t.data.passageTitle, `„${b.beilage.title}“ von ${b.beilage.author} (${b.beilage.medium}, ${b.beilage.year})`);
      assert.equal(t.data.textsorte, b.beilage.kind);
      assert.ok(t.answer.sample, `${k}: the model text is the sample answer`);
      assert.equal(t.answer.criteria?.length, 3);
      assert.match(t.prompt, new RegExp(s.eines));
      assert.ok(!/[—]| – /.test(t.prompt), t.prompt);
      assert.equal(builder.checkTask(t), null, `${k}: ready to send`);
    }
    const set = readingSet(out.tasks)!;
    assert.equal(set.zeilen, true, "the Textbeilage is shown once, with line numbers");
    assert.deepEqual(readingSetIssues(out.tasks), []);
    for (const t of out.tasks) assert.deepEqual(readingIssues(t, set.text, out.tasks), [], t.prompt);

    // every part twice at most: more is not useful
    const many = await builder.generateTasks(settings({ skillIds: [s.skill], count: 30, useAI: false }), null);
    assert.equal(many.tasks.length, maxTeiluebungen(k), k);
    assert.equal(new Set(many.tasks.map((t) => t.prompt)).size, many.tasks.length, `${k}: no prompt twice`);
  }
});

test("builder: two Textsorten and another skill in one exercise, only the other skill goes to the KI", async () => {
  const builder = await import("./builder");
  const ZEITEN = "deutsch.grammatik.zeiten";
  const { out, calls } = await withStub(
    (r) => ({
      tasks: [...String(r.content).matchAll(/^\d+\. category=(\S+)(?: \([^)]*\))?(?:, format=[^,]+)?, skill_id=(\S+)$/gm)].map((m, i) => ({
        category: m[1], format: "free", skill_ids: [m[2]], topic: "Zeiten", difficulty: "mittel", prompt: `KI-Aufgabe ${i + 1}: Erkläre das Perfekt.`, passage: null, options: null, correct_option: null,
        accepted_answers: null, numeric: false, blanks: null, sample_answer: "Das Perfekt …", steps: null, case_sensitive: true, faulty_text: null, corrected_text: null, text_errors: null,
        answer_lines: 3, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["passt"], solution: "Perfekt", solution_steps: [],
        estimated_time_sec: 60, hints: [], common_errors: [],
      })),
    }),
    () => builder.generateTasks(settings({ skillIds: ["deutsch.os.matura.leserbrief", "deutsch.os.matura.kommentar", ZEITEN], categories: ["offen"], count: 6 }), null),
  );
  assert.equal(calls.length, 1, "the KI is asked for the other skill only");
  const plan = [...String(calls[0].content).matchAll(/^\d+\. category=\S+.*skill_id=(\S+)$/gm)].map((m) => m[1]);
  assert.ok(plan.length > 0 && plan.every((id) => id === ZEITEN), "no Schreibauftrag in the KI's plan");
  const lb = out.tasks.filter((t) => t.data.schreibsorte === "leserbrief");
  const ko = out.tasks.filter((t) => t.data.schreibsorte === "kommentar");
  assert.ok(lb.length && ko.length);
  assert.ok(lb.every((t) => t.data.passageTitle?.startsWith("„Ausgeschlafen")), "each Textsorte on its own Textbeilage");
  assert.ok(ko.every((t) => t.data.passageTitle?.startsWith("„Jugendtreff")));
  assert.ok(out.tasks.filter((t) => t.skillId === ZEITEN).every((t) => !t.data.teil));
});

test("builder: the student's own Textbeilage, a draft for one Schreibauftrag, and „Neu erstellen“ keeps part and Textbeilage", async () => {
  const s = await setup("Ben Teilübung");
  const builder = await import("./builder");
  const repo = await import("./repo");
  const beilage = Array.from({ length: 30 }, (_, i) => `Zeile ${i + 1}: Die Schule plant einen neuen Pausenhof.`).join("\n");
  const own = s.store.cleanAuftragSettings("kommentar", { title: "Ein Hof für alle", author: "Erfundener Autor", medium: "Erfundene Zeitung", year: "1. Juni 2026", kind: "Bericht", story: beilage });
  assert.ok("settings" in own);
  const text = s.store.createAuftrag({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, settings: own.settings });
  // another Textsorte of the same student is no source for the Kommentar
  s.store.createAuftrag({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, settings: await exampleSettings("leserbrief") });

  const forStudent = await builder.generateTasks(settings({ studentId: s.sid, skillIds: ["deutsch.os.matura.kommentar"], count: 2, useAI: false }), builder.studentContext(s.sid));
  assert.ok(forStudent.tasks.every((t) => t.data.passageTitle === "„Ein Hof für alle“ von Erfundener Autor (Erfundene Zeitung, 1. Juni 2026)" && t.data.textsorte === "Bericht"), "the student's latest Kommentar");
  assert.ok(forStudent.tasks.every((t) => !t.answer.sample), "no model text for a Textbeilage DreamStudy does not know");
  const forTi = await builder.generateTasks(settings({ studentId: s.sid, skillIds: ["deutsch.os.matura.textinterpretation"], count: 1, useAI: false }), builder.studentContext(s.sid));
  assert.equal(forTi.tasks[0].data.passageTitle, "„Sieben Uhr zwölf“ von Ida Brunnhofer (2026)", "no Textinterpretation of the student: the example story");

  const draft = await builder.createDraft({ ...settings({ studentId: s.sid, skillIds: ["deutsch.os.matura.kommentar"], count: 4, useAI: false }), title: "Teilübungen" }, s.niko.id, { auftragTextId: text.id });
  const tasks = repo.listTasks(draft.id);
  assert.deepEqual(tasks.map((t) => t.data.teil), ["einstieg", "bezug", "meinung", "schluss"]);
  const meinung = tasks.find((t) => t.data.teil === "meinung")!;
  const before = meinung.prompt;
  assert.deepEqual(await builder.regenerateTask(meinung.id), { ok: true });
  const again = repo.getTask(meinung.id)!;
  assert.equal(again.data.teil, "meinung");
  assert.equal(again.data.schreibsorte, "kommentar");
  assert.notEqual(again.prompt, before, "the other wording");
  assert.equal(again.data.passage, meinung.data.passage);
  assert.equal(again.data.passageTitle, meinung.data.passageTitle, "medium and date are read back from the heading");
  await builder.regenerateTask(meinung.id);
  assert.equal(repo.getTask(meinung.id)!.prompt, before, "and back");
});

test("builder: „Neu erstellen“ on the example keeps the model text as sample answer", async () => {
  const { teiluebungenFor, beispielQuelle, nextTeiluebungFor, quelleFromTask } = await sa();
  for (const k of NEW) {
    const [t] = teiluebungenFor(beispielQuelle(k), 1);
    const q = quelleFromTask(t)!;
    assert.deepEqual([q.sorte, q.title, q.author, q.medium, q.year, q.kind], [k, beispielQuelle(k).title, beispielQuelle(k).author, beispielQuelle(k).medium, beispielQuelle(k).year, beispielQuelle(k).kind], k);
    const next = nextTeiluebungFor(t)!;
    assert.equal(next.data.teil, t.data.teil);
    assert.notEqual(next.prompt, t.prompt);
    assert.equal(next.answer.sample, t.answer.sample, `${k}: the sample stays`);
  }
});

test("recommendation path: a worksheet for one Textsorte is Teilübungen, without KI", async () => {
  const { buildWorksheet } = await import("./service");
  const repo = await import("./repo");
  const { out, calls } = await withStub(() => {
    throw new Error("no KI");
  }, () => buildWorksheet({ subject: "Deutsch", schoolType: "Gymnasium", klasse: 7, skillIds: ["deutsch.os.matura.eroerterung"], difficulty: "mittel", count: 10, taskType: "mixed", kind: "uebung" } as Parameters<typeof buildWorksheet>[0]));
  assert.equal(calls.length, 0);
  const tasks = repo.listTasks(out.id);
  assert.equal(tasks.length, 10, "every part of the Erörterung twice");
  assert.ok(tasks.every((t) => t.data.teil && t.data.zeilen && t.type === "free" && t.data.schreibsorte === "eroerterung"));
});

// ---------- KI correction ----------

test("KI correction: a Leserbrief is corrected as before, without the Textinterpretation's context; names are masked", async () => {
  const s = await setup("Nora Korrektur");
  const tc = await import("./text-correction");
  const { correctionPrompt } = await import("./ai/textkorrektur");
  const { beispielText } = await sa();
  const text = s.store.createAuftrag({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, settings: await exampleSettings("leserbrief") });
  assert.ok(s.texts.saveText(text.id, await docOf(`${beispielText("leserbrief")}\nNora findet das wichtig.`), 0).ok);
  const t = s.texts.getText(text.id)!;
  const req = tc.correctionRequest(t, s.texts.textDoc(t));
  assert.equal(req.kind, "Leserbrief");
  assert.equal(req.source, null, "no source line for any Textsorte but the Textinterpretation");
  const prompt = correctionPrompt(req);
  assert.ok(prompt.includes("Textsorte: Leserbrief"));
  assert.ok(!prompt.includes("Interpretierter Text"));
  assert.ok(!prompt.includes("Nora"), "the student's name is masked");
  assert.ok(!prompt.includes("Es ist zehn vor acht, erste Stunde"), "the Textbeilage is not sent");

  const { out, calls } = await withStub(
    () => ({ findings: [], hints: [], strengths: ["Klarer Aufbau"], main_issue: null, recommendation: null, recommendation_skill_id: null }),
    async () => tc.startAICorrection(text.id, s.niko.id, { consent: true, wait: true }),
  );
  assert.ok(out.ok, JSON.stringify(out));
  assert.equal(calls.length, 1, "the KI only on click");
  assert.ok(!String(calls[0].content).includes("Interpretierter Text"));
});

// ---------- print ----------

test("print: the worksheet of a Schreibauftrag is a URL setting like the Textinterpretation's", async () => {
  const { readTextPrintOptions, AUFTRAG_BLATT_LABEL, INTERPRETATION_BLATT_LABEL } = await import("./text-print");
  assert.equal(readTextPrintOptions({ blatt: "leer" }, "T").blatt, "leer");
  assert.equal(AUFTRAG_BLATT_LABEL.leer, "Arbeitsblatt: Auftrag, Textbeilage und Schreibplan");
  assert.equal(INTERPRETATION_BLATT_LABEL.leer, "Arbeitsblatt: Auftrag, Text und Schreibplan");
});
