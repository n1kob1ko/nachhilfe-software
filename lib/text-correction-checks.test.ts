import assert from "node:assert/strict";
import test from "node:test";
import { applyChanges, comparable, finalProblems, mismatchOf, ruleFindings, sameErrorElsewhere, sentencesOf, shapeOf, splitSentences } from "./text-correction-checks";

const parts = (t: string) => splitSentences(t).map((s) => t.slice(s.start, s.end));

test("Sätze: Abkürzungen, Ordnungszahlen und Zeilenangaben trennen keinen Satz", () => {
  assert.deepEqual(parts("Wir spielen z. B. Fußball. Das macht Spaß!"), ["Wir spielen z. B. Fußball.", "Das macht Spaß!"]);
  assert.deepEqual(parts("Am 3. Jänner fuhren wir los. Es war kalt."), ["Am 3. Jänner fuhren wir los.", "Es war kalt."]);
  assert.deepEqual(parts("In Z. 12 steht es, vgl. Abs. zwei. Dann folgt der Schluss."), ["In Z. 12 steht es, vgl. Abs. zwei.", "Dann folgt der Schluss."]);
  assert.deepEqual(parts("Er fragte: „Kommst du?“ Ich nickte."), ["Er fragte: „Kommst du?“", "Ich nickte."]);
  assert.deepEqual(parts("Er rief: „Halt!“, und lief weg. Wir warteten..."), ["Er rief: „Halt!“, und lief weg.", "Wir warteten..."]);
  assert.deepEqual(parts("  ohne Punkt am Ende  "), ["ohne Punkt am Ende"]);
  assert.deepEqual(parts("   "), []);
  assert.deepEqual(parts("I went to Mr. Smith. He was nice."), ["I went to Mr. Smith.", "He was nice."]);
});

test("Sätze: Nummern „Absatz.Satz“, Überschrift als ein Satz", () => {
  const s = sentencesOf([
    { text: "Zocken und Lernen", heading: true },
    { text: "Viele spielen. Manche lernen dabei.", heading: false },
    { text: "", heading: false },
    { text: "Am Ende zählt es.", heading: false },
  ]);
  assert.deepEqual(
    s.map((x) => [x.id, x.text]),
    [
      ["1.1", "Zocken und Lernen"],
      ["2.1", "Viele spielen."],
      ["2.2", "Manche lernen dabei."],
      ["4.1", "Am Ende zählt es."],
    ],
  );
});

test("Änderungen anwenden: Stellen im neuen Text, überlappende werden übersprungen", () => {
  const t = "Ich habe ein Fehler gemacht weil ich müde war.";
  const a = { start: t.indexOf("ein Fehler"), end: t.indexOf("ein Fehler") + 10, replacement: "einen Fehler" };
  const b = { start: t.indexOf("gemacht weil"), end: t.indexOf("gemacht weil") + 12, replacement: "gemacht, weil" };
  const c = { start: t.indexOf("Fehler"), end: t.indexOf("Fehler") + 6, replacement: "Irrtum" };
  const r = applyChanges(t, [b, c, a]);
  assert.equal(r.text, "Ich habe einen Fehler gemacht, weil ich müde war.");
  assert.deepEqual(r.skipped, [c]);
  assert.equal(r.text.slice(r.placed[0].at.start, r.placed[0].at.end), "einen Fehler");
  assert.equal(r.text.slice(r.placed[1].at.start, r.placed[1].at.end), "gemacht, weil");
});

test("Vergleichbar: Anführungszeichen, Striche und Leerzeichen spielen keine Rolle", () => {
  assert.equal(comparable("„Zocken und Lernen“ – gut , oder?"), comparable('"Zocken und Lernen" - gut, oder?'));
});

test("Form einer Änderung", () => {
  assert.deepEqual(
    { ...shapeOf("Haus weil", "Haus, weil") },
    { punct: true, letters: false, caseOnly: false, toUpper: false, toLower: false, words: false, spaces: false },
  );
  const s = shapeOf("beim essen", "beim Essen");
  assert.equal(s.caseOnly, true);
  assert.equal(s.toUpper, true);
  assert.equal(s.toLower, false);
  assert.equal(shapeOf("über dem Thema", "das Thema").words, true);
  assert.equal(shapeOf("Spass", "Spaß").letters, true);
  assert.equal(shapeOf("Ich gehe nach hause und Spiele", "Ich gehe nach Hause und spiele").toUpper, true);
  assert.equal(shapeOf("Ich gehe nach hause und Spiele", "Ich gehe nach Hause und spiele").toLower, true);
});

test("Kategorie oder Erklärung passt nicht zur Änderung", () => {
  assert.match(mismatchOf({ category: "zeichensetzung", quote: "ein Fehler", replacement: "einen Fehler", explanation: "Akkusativ." })!, /Zeichensetzung/);
  assert.match(mismatchOf({ category: "rechtschreibung", quote: "Haus weil", replacement: "Haus, weil", explanation: "Beistrich vor weil." })!, /Satzzeichen/);
  assert.match(mismatchOf({ category: "rechtschreibung", quote: "Essen", replacement: "essen", explanation: "Nomen werden großgeschrieben." })!, /Großschreibung/);
  assert.match(mismatchOf({ category: "rechtschreibung", quote: "Spass", replacement: "Spaß", explanation: "Verben schreibt man klein." })!, /Kleinschreibung/);
  assert.match(mismatchOf({ category: "rechtschreibung", quote: "dass", replacement: "das", explanation: "Nach kurzem Vokal steht ss statt ß." })!, /ß/);
  // passt
  assert.equal(mismatchOf({ category: "rechtschreibung", quote: "beim essen", replacement: "beim Essen", explanation: "Nach „beim“ wird das Verb zum Nomen und großgeschrieben." }), null);
  assert.equal(mismatchOf({ category: "zeichensetzung", quote: "Haus weil", replacement: "Haus, weil", explanation: "Vor „weil“ steht ein Beistrich." }), null);
  assert.equal(mismatchOf({ category: "grammatik", quote: "eine Zeitverschwendung ist", replacement: "eine Zeitverschwendung sind", explanation: "Das Subjekt „Spiele“ steht im Plural." }), null);
  // a rule names both sides; only the explanation counts
  assert.equal(mismatchOf({ category: "rechtschreibung", quote: "Im folgenden", replacement: "Im Folgenden", rule: "Groß- und Kleinschreibung", explanation: "„Folgenden“ ist hier ein Nomen und wird großgeschrieben." }), null);
  assert.equal(mismatchOf({ category: "rechtschreibung", quote: "Ergebniss", replacement: "Ergebnis", rule: "s, ss oder ß", explanation: "Ergebnis schreibt man mit einem s." }), null);
  assert.equal(mismatchOf({ category: "rechtschreibung", quote: "im folgenden", replacement: "im Folgenden", explanation: "Nicht kleingeschrieben, sondern großgeschrieben, weil es ein Nomen ist." }), null);
});

test("Regeln: Beistrich vor dass/weil/wenn, aber nicht nach „und“, „so“, „ohne“ oder am Satzanfang", () => {
  const blocks = [
    { text: "Zocken", heading: true },
    { text: "Viele sagen dass Spiele schaden. Ich glaube aber, dass wenn man spielt man lernt. Ich spiele so dass ich lerne. Er ging ohne dass er grüßte. Immer wenn ich spiele, lache ich. Und weil es regnet, bleiben wir.", heading: false },
  ];
  const f = ruleFindings(blocks, { english: false }).filter((x) => x.category === "zeichensetzung");
  assert.deepEqual(
    f.map((x) => [x.para, x.quote, x.replacement]),
    [
      [2, "sagen dass", "sagen, dass"],
      [2, "dass wenn", "dass, wenn"],
    ],
  );
  assert.equal(blocks[1].text.slice(f[0].start, f[0].end), "sagen dass");
});

test("Regeln: Kleinbuchstabe am Satzanfang, doppeltes Wort, englisches i", () => {
  const de = ruleFindings([{ text: "es war schön. wir spielten spielten lange. Das war z. B. gut. Die die kamen, blieben.", heading: false }], { english: false });
  assert.deepEqual(
    de.map((x) => [x.quote, x.replacement, x.category]),
    [
      ["es", "Es", "rechtschreibung"],
      ["wir", "Wir", "rechtschreibung"],
      ["spielten spielten", "spielten", "ausdruck"],
    ],
  );
  const en = ruleFindings([{ text: "Yesterday i went home. then i slept. I'm fine, it's OK.", heading: false }], { english: true });
  assert.deepEqual(
    en.map((x) => [x.quote, x.replacement]),
    [
      ["then", "Then"],
      ["i", "I"],
      ["i", "I"],
    ],
  );
  // keine Beistrich-Regel im Englischen
  assert.equal(ruleFindings([{ text: "I know that you are right.", heading: false }], { english: true }).length, 0);
});

test("Text nach allen Änderungen: Zusammenstöße werden sichtbar", () => {
  assert.deepEqual(
    finalProblems("Ich habe habe es gemacht , weil ich es wollte.. ende", { english: false }).map((p) => p.what),
    ["„habe“ steht zweimal", "Satzzeichen doppelt oder mit Leerzeichen davor", "Satzzeichen doppelt oder mit Leerzeichen davor"],
  );
  assert.deepEqual(finalProblems("Es war gut. dann ging ich.", { english: false }).map((p) => p.what), ["Kleinbuchstabe am Satzanfang"]);
  assert.deepEqual(finalProblems("Das ist gut... Wirklich. Z. B. hier, 3.5 m.", { english: false }), []);
});

test("Gleicher Fehler an anderer Stelle nur mit gleichem Nachbarwort", () => {
  const blocks = ["Man spielt um spaß zu haben.", "Wir essen. Beim spaß zu haben vergisst man die Zeit. Der spaß endet nie."];
  const fix = { para: 1, start: blocks[0].indexOf("spaß"), end: blocks[0].indexOf("spaß") + 4, quote: "spaß", replacement: "Spaß" };
  const more = sameErrorElsewhere(blocks, [fix], [fix]);
  assert.deepEqual(
    more.map((m) => [m.para, blocks[m.para - 1].slice(m.start, m.end), m.replacement, m.from]),
    [[2, "spaß", "Spaß", 1]],
  );
  assert.equal(more[0].start, blocks[1].indexOf("spaß zu"));
  // das/dass: one neighbour word says too little („ist, das ein Gasthaus“ / „ist „das Wohnzimmer“)
  const t = ["Ihr Argument ist, das ein Gasthaus fehlt.", "Sie sagt, das Wirtshaus ist das Wohnzimmer des Dorfes."];
  const dass = { para: 1, start: t[0].indexOf("das "), end: t[0].indexOf("das ") + 3, quote: "das", replacement: "dass" };
  assert.deepEqual(sameErrorElsewhere(t, [dass], [dass]), []);
});

test("Urteile der zweiten Prüfung: falsch mit derselben Verbesserung ist nur ein Zweifel, „falsch“ ohne Verbesserung auch, „so lassen“ sortiert aus", async () => {
  const { applyVerdicts } = await import("./ai/textkorrektur-gruendlich");
  const base = { block: 0, pos_start: 0, pos_end: 5, quote: "furen", replacement: "fuhren", category: "rechtschreibung", kind: "fehler", rule: "", explanation: "h", review: "" as const, review_note: "", origin: "analyse" as const };
  const proposals = [{ k: 0, para: 1, start: 0, end: 5, quote: "furen", replacement: "fuhren" }];
  const check = (o: Record<string, unknown>) => applyVerdicts([base], proposals, { checks: [{ nr: 1, verdict: "falsch", explanation_ok: true, better_replacement: null, better_explanation: null, reason: "x", ...o }], missed: [] }, null).items[0];
  assert.equal(check({ better_replacement: "fuhren" }).review, "lehrer");
  assert.equal(check({ better_replacement: "fuhren" }).replacement, "fuhren");
  assert.equal(check({ better_replacement: "furen" }).review, "verworfen", "the original was right");
  // „falsch“ without a better wording threw out right suggestions in the real test: marked, not sorted out
  assert.deepEqual([check({ verdict: "nicht richtig" }).review, check({ verdict: "nicht richtig" }).replacement], ["lehrer", "fuhren"]);
  assert.match(check({ verdict: "falsch" }).review_note, /hält das für falsch: x/);
  const better = check({ better_replacement: "fuhr", better_explanation: "Präteritum." });
  assert.deepEqual([better.replacement, better.explanation, better.review], ["fuhr", "Präteritum.", "lehrer"]);
});

test("Notizen werden zwischen Wörtern gekürzt, nie mitten im Wort", async () => {
  const { clip, withNote } = await import("./text-correction-checks");
  assert.equal(clip("kurz genug", 20), "kurz genug");
  assert.equal(clip("Die Erklärung passt nicht genau zur Änderung im Satz", 30), "Die Erklärung passt nicht …");
  assert.ok(clip("Wort ".repeat(200), 450).length <= 450);
  const it = { block: 0, pos_start: 0, pos_end: 1, quote: "a", replacement: "b", category: "", kind: "fehler", rule: "", explanation: "", review: "" as const, review_note: "x ".repeat(220).trim() };
  const noted = withNote(it, "Die zweite Prüfung ist unsicher: Dieser Satz ist lang genug, um gekürzt zu werden.");
  assert.equal(noted.review, "lehrer");
  assert.ok(noted.review_note.endsWith(" …") && noted.review_note.length <= 450);
});

test("Brief: nach der Anrede mit Beistrich beginnt der Absatz klein", () => {
  const blocks = [
    { text: "Sehr geehrte Damen und Herren,", heading: false },
    { text: "am 3. Jänner habe ich bestellt. leider kam nichts.", heading: false },
  ];
  assert.deepEqual(ruleFindings(blocks, { english: false }).map((f) => f.quote), ["leider"]);
  assert.deepEqual(ruleFindings([blocks[1]], { english: false }).map((f) => f.quote), ["am", "leider"]);
});
