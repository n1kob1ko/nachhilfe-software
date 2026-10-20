/**
 * Prüft die englischen Grammatik-Aufgaben ohne KI (lib/englisch-grammatik.ts) und die Kurzformen beim
 * Vergleichen (lib/englisch-kurzformen.ts): jede Fähigkeit in jeder Stufe und jedem Format, mit vielen
 * Startwerten. Die gespeicherte Lösung wird angenommen, jede falsche Option und jeder typische Fehler
 * abgelehnt (mit seinem Etikett), Kurz- und Langform zählen gleich, auf einem Blatt steht keine Aufgabe
 * doppelt und kein Satz ist kaputt. Deutsche Aufgaben werden geprüft wie bisher.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CURRICULUM, DIFFICULTIES, categoriesFor, type Difficulty, type TaskType } from "./curriculum";
import { ENGLISCH_GRAMMATIK_IDS, englischAufgabe, englischFormate, type EnglischFormat } from "./englisch-grammatik";
import { langform, PARTIZIPIEN } from "./englisch-kurzformen";
import { UNREGELMAESSIG, verb } from "./englisch-woerter";
import { aufgabenSchluessel } from "./figur";
import { checkFix } from "./fix-text";
import { correctionTask, generateBuiltIn, generateForSlot, hasBuiltInGenerator } from "./generators";
import { checkAnswer, gapCount, GAP, normalizeText, sameAnswer, type TaskDraft } from "./tasks";

const SEEDS = 20;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every task of every skill, level and format, SEEDS times. */
const ALLE: { id: string; d: Difficulty; f: EnglischFormat; t: TaskDraft }[] = [];
for (const id of ENGLISCH_GRAMMATIK_IDS)
  for (const d of DIFFICULTIES)
    for (const f of englischFormate(id))
      for (let s = 0; s < SEEDS; s++) {
        const t = englischAufgabe(id, f, d, mulberry32(s * 7919 + d.length * 31 + f.length));
        assert.ok(t, `${id} ${d} ${f}: keine Aufgabe`);
        ALLE.push({ id, d, f, t });
      }

const wo = (x: { id: string; d: Difficulty; f: EnglischFormat; t: TaskDraft }) => `${x.id} [${x.d}, ${x.f}] ${x.t.prompt.replace(/\n/g, " / ")}${x.t.data.faulty ? ` ⟨${x.t.data.faulty}⟩` : ""}`;
/** The right answers of a task as checkAnswer takes them: every alternative of every gap, every accepted text. */
function richtige(t: TaskDraft): string[] {
  if (t.type === "mc") return [String(t.answer.correct)];
  if (t.answer.blanks) {
    const erste = t.answer.blanks.map((b) => b[0]);
    return t.answer.blanks.flatMap((b, i) => b.map((alt) => JSON.stringify(erste.map((x, j) => (j === i ? alt : x)))));
  }
  return t.answer.accepted ?? [];
}
/** An answer in the form of the task: gap texts as a JSON list, with every gap changed by `f`. */
const alsAntwort = (t: TaskDraft, given: string, f: (s: string) => string) => (t.answer.blanks ? JSON.stringify((JSON.parse(given) as string[]).map(f)) : f(given));

// ---------- writing an answer in another way: contractions, apostrophes, spaces ----------
const gleicheSchreibung = (from: string, to: string) => (from[0] !== from[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to);
const NICHT: [RegExp, string][] = [
  [/\b(do|does|did|is|are|was|were|have|has|had|will|would|could|should|must) not\b/gi, ""],
  [/\bcan ?not\b/gi, "can't"],
];
const KURZ_VERB: Record<string, string> = { do: "don't", does: "doesn't", did: "didn't", is: "isn't", are: "aren't", was: "wasn't", were: "weren't", have: "haven't", has: "hasn't", had: "hadn't", will: "won't", would: "wouldn't", could: "couldn't", should: "shouldn't", must: "mustn't" };
const partizip = (w: string) => PARTIZIPIEN.has(w) || /ed$/.test(w);
/** The answer with its long forms contracted where English allows it (does not → doesn't, I am → I'm). */
function zusammengezogen(s: string): string {
  return s
    .replace(NICHT[0][0], (m, v: string) => gleicheSchreibung(m, KURZ_VERB[v.toLowerCase()]))
    .replace(NICHT[1][0], (m) => gleicheSchreibung(m, NICHT[1][1]))
    .replace(/\bI am (?=[a-z])/g, "I'm ")
    .replace(/\b(you|we|they) are (?=[a-z])/gi, "$1're ")
    .replace(/\b(he|she|it) is (?=\w+ing\b)/gi, "$1's ")
    .replace(/\b(I|you|we|they) have (\w+)/gi, (m, p: string, w: string) => (partizip(w) ? `${p}'ve ${w}` : m));
}
/** The same answer written in other ways that count the same. */
const VARIANTEN: [string, (s: string) => string][] = [
  ["Langform", (s) => langform(s)],
  ["Kurzform", zusammengezogen],
  ["can not / cannot", (s) => langform(s).replace(/\bcan not\b/g, "cannot")],
  ["gebogene Apostrophe", (s) => zusammengezogen(s).replace(/'/g, "’")],
  ["Leerzeichen", (s) => `  ${zusammengezogen(s).replace(/ /g, "  ")} `],
];

test("die Fähigkeiten sind echte Fähigkeiten des Lehrplans und haben eine eingebaute Quelle", () => {
  assert.ok(ENGLISCH_GRAMMATIK_IDS.length >= 20, "mindestens 20 Fähigkeiten");
  for (const id of ENGLISCH_GRAMMATIK_IDS) {
    const skill = CURRICULUM.find((s) => s.id === id);
    assert.ok(skill, `${id} steht nicht im Lehrplan`);
    assert.equal(skill.subject, "Englisch");
    assert.equal(hasBuiltInGenerator(id), true, `${id}: „Aufgaben nur mit KI“`);
    assert.deepEqual(englischFormate(id).slice(0, 3), ["cloze", "mc", "fix"], `${id}: Lückentext, Multiple Choice und Fehler korrigieren`);
  }
});

test("jede Aufgabe hat das Format, das sie verspricht, und ihre Texte sind ganz", () => {
  const TYP: Record<EnglischFormat, TaskType> = { cloze: "cloze", mc: "mc", fix: "fix", kurz: "grammar", uebersetzen: "grammar" };
  const kaputt = /[{}]|undefined|null|NaN| {2}| [,.?!]|\.\.|—| – /;
  for (const x of ALLE) {
    const { t } = x;
    assert.equal(t.type, TYP[x.f], wo(x));
    assert.equal(t.skillId, x.id, wo(x));
    assert.equal(t.difficulty, x.d, wo(x));
    const zeilen = t.prompt.split("\n");
    assert.ok(zeilen.every((z) => z.trim() && !kaputt.test(z)), `kaputte Aufgabe: ${wo(x)}`);
    if (t.type !== "fix") assert.ok(zeilen.length >= 2, `Auftrag und Satz: ${wo(x)}`);
    assert.ok(t.solution.trim() && !t.solution.includes(GAP) && !kaputt.test(t.solution), `Lösung: ${wo(x)} → ${t.solution}`);
    assert.ok(t.hints.length >= 2 && t.hints.every((h) => h.trim() && !kaputt.test(h)), `Hilfen: ${wo(x)}`);
    for (const e of t.errorMap) assert.ok(e.label.trim() && !/—| – /.test(e.label), `Fehler-Etikett: ${e.label}`);
    if (t.type !== "mc") assert.equal(t.answer.contractions, true, `Kurzformen zählen: ${wo(x)}`);
    if (t.type === "cloze") {
      assert.equal(gapCount(t.prompt), t.answer.blanks!.length, `Lücken: ${wo(x)}`);
      assert.ok(t.answer.blanks!.every((b) => b.length && b.every((a) => a.trim())), wo(x));
    }
    if (t.type === "mc") {
      const o = t.data.options!;
      assert.ok(o.length >= 3 && o.length <= 4, `3 bis 4 Optionen: ${wo(x)}`);
      assert.equal(new Set(o.map((a) => langform(normalizeText(a)))).size, o.length, `doppelte Option: ${wo(x)} ${o.join(" / ")}`);
      assert.ok(o.every((a) => a.trim() && !kaputt.test(a)), wo(x));
    }
    if (t.type === "fix") {
      const n = x.d === "sehr leicht" || x.d === "leicht" || x.d === "leicht bis mittel" ? 1 : x.d === "mittel" ? 2 : 3;
      assert.equal(t.answer.criteria![0], n === 1 ? "Der Fehler ist verbessert." : `Alle ${n} Fehler sind verbessert.`, `Anzahl der Sätze: ${wo(x)}`);
      assert.ok(!kaputt.test(t.data.faulty!), wo(x));
      // every sentence starts with a capital letter and ends with a full stop or a question mark
      for (const satz of [t.data.faulty!, ...t.answer.accepted!]) assert.match(satz, /^[“A-Z].*[.?!”]$/, wo(x));
    }
    if (t.type === "grammar") assert.ok(t.answer.accepted!.length && t.answer.accepted!.every((a) => a.trim()), wo(x));
  }
});

test("die gespeicherte Lösung gilt als richtig, jede falsche Option und jeder typische Fehler als falsch", () => {
  for (const x of ALLE) {
    const { t } = x;
    for (const r of richtige(t)) assert.equal(checkAnswer(t, r).correct, true, `richtige Antwort ${r} abgelehnt: ${wo(x)}`);
    if (t.type === "mc") {
      t.data.options!.forEach((_, i) => {
        if (i === t.answer.correct) return;
        const r = checkAnswer(t, String(i));
        assert.equal(r.correct, false, wo(x));
        assert.ok(r.errorLabel, `Option ${t.data.options![i]} ohne Etikett: ${wo(x)}`);
      });
    }
    for (const e of t.errorMap) {
      const given = t.type === "mc" ? e.answer : t.answer.blanks ? JSON.stringify(e.answer.split(" | ")) : e.answer;
      const r = checkAnswer(t, given);
      assert.equal(r.correct, false, `Fehler „${e.answer}“ gilt als richtig: ${wo(x)}`);
      assert.equal(r.errorLabel, e.label, `Etikett von „${e.answer}“: ${wo(x)}`);
      // also when it is written with contractions, curly apostrophes or extra spaces
      if (t.type !== "mc") for (const [, v] of VARIANTEN) assert.equal(checkAnswer(t, alsAntwort(t, given, v)).correct, false, `Fehler „${e.answer}“ als Variante richtig: ${wo(x)}`);
    }
    if (t.type === "fix") {
      // the text as it is: wrong, with the label of one of its errors
      const r = checkAnswer(t, t.data.faulty!);
      assert.equal(r.correct, false, wo(x));
      assert.ok(r.errorLabel && t.answer.fixes!.some((f) => f.label === r.errorLabel), `kein Etikett für den Fehlertext: ${wo(x)}`);
      assert.equal(r.errorType, "grammatik", wo(x));
    }
  }
});

test("Kurzformen, Apostrophe, Leerzeichen und ein großer Anfangsbuchstabe zählen wie die Langform", () => {
  let kurz = 0;
  for (const x of ALLE) {
    const { t } = x;
    if (t.type === "mc") continue;
    for (const r of richtige(t)) {
      for (const [name, v] of VARIANTEN) {
        const given = alsAntwort(t, r, v);
        if (name === "Kurzform" && given !== r) kurz++;
        assert.equal(checkAnswer(t, given).correct, true, `${name}: ${given} abgelehnt: ${wo(x)}`);
      }
      // a capital letter at the start (the gap at the start of a sentence; fix texts are compared exactly)
      if (t.type !== "fix") assert.equal(checkAnswer(t, alsAntwort(t, r, (s) => s.charAt(0).toUpperCase() + s.slice(1))).correct, true, wo(x));
    }
  }
  assert.ok(kurz > 200, `es kommen genug Antworten mit Kurzform vor (${kurz})`);
});

test("die erwarteten Antworten haben keine mehrdeutige Kurzform (he's finished: is oder has?)", () => {
  // 's and 'd before a past participle could be is or has, would or had
  const mehrdeutig = /\b(?:he|she|it|there|that|what|who|where|how|here|i|you|we|they)'[sd] (\w+)/gi;
  for (const x of ALLE) {
    if (x.t.type === "mc") continue;
    for (const r of richtige(x.t)) for (const m of r.matchAll(mehrdeutig)) assert.ok(!partizip(m[1].toLowerCase()), `${m[0]}: ${wo(x)}`);
  }
});

test("langform: genau eine Langform, nur wo die Kurzform stimmt", () => {
  const gleich: [string, string][] = [
    ["She doesn't like spiders.", "She does not like spiders."],
    ["He isn't at home.", "He is not at home."],
    ["I'm reading a book.", "I am reading a book."],
    ["We won't be late.", "We will not be late."],
    ["I can't swim.", "I cannot swim."],
    ["I can't swim.", "I can not swim."],
    ["They're playing football.", "They are playing football."],
    ["We've finished our homework.", "We have finished our homework."],
    ["He's playing tennis.", "He is playing tennis."],
    ["She's got a dog.", "She has got a dog."],
    ["It’s raining.", "It is raining."],
    ["Doesn’t", "does not"],
    ["didn't", "did not"],
  ];
  for (const [a, b] of gleich) {
    assert.equal(langform(a).toLowerCase(), langform(b).toLowerCase(), `${a} = ${b}`);
    assert.equal(sameAnswer(a, b, "text", true), true, `${a} = ${b}`);
  }
  const verschieden: [string, string][] = [
    ["He's playing tennis.", "He has playing tennis."],
    ["She's got a dog.", "She is got a dog."],
    ["Yes, I'm.", "Yes, I am."],
    ["doesn't", "don't"],
    ["won't", "want"],
    ["can't", "can"],
    ["its", "it is"],
    ["Tom's bike", "Tom is bike"],
    ["isn't", "aren't"],
    ["We've a dog.", "We have a dog."],
  ];
  for (const [a, b] of verschieden) assert.equal(sameAnswer(a, b, "text", true), false, `${a} ≠ ${b}`);
  // the verb in front of its subject stays as it is
  assert.equal(langform("Don't you like it?"), "Don't you like it?");
  assert.equal(langform("Doesn't she play the piano?"), "Doesn't she play the piano?");
});

test("die unregelmäßigen Verben: über 100, mit Varianten, jede 3. Form wird erkannt", () => {
  assert.ok(UNREGELMAESSIG.length >= 100, `${UNREGELMAESSIG.length} Verben`);
  assert.equal(new Set(UNREGELMAESSIG.map((u) => u.base)).size, UNREGELMAESSIG.length, "kein Verb doppelt");
  for (const u of UNREGELMAESSIG) {
    assert.ok(u.past.length && u.pp.length && u.de.trim(), u.base);
    // regular ones (burned, learned) are found by their -ed
    for (const pp of u.pp) assert.ok(partizip(pp), `${pp} fehlt in PARTIZIPIEN`);
  }
  const formen = (base: string) => [verb(base).past, ...verb(base).pastAlt, "/", verb(base).pp, ...verb(base).ppAlt].join(" ");
  assert.equal(formen("learn"), "learnt learned / learnt learned");
  assert.equal(formen("dream"), "dreamt dreamed / dreamt dreamed");
  assert.equal(formen("burn"), "burnt burned / burnt burned");
  assert.equal(formen("spell"), "spelt spelled / spelt spelled");
  assert.equal(formen("get"), "got / got gotten");
  assert.equal(formen("go"), "went / gone");
});

test("die Stufen: leichte Wörter und ein Satz unten, schwerere Wörter und mehr Sätze oben", () => {
  const verbenIn = (d: Difficulty) => ALLE.filter((x) => x.id === "englisch.vocab.irregular" && x.d === d && x.f === "kurz").map((x) => verb(x.t.prompt.split("\n")[1].split(" ")[0]));
  assert.ok(verbenIn("sehr leicht").every((v) => v.stufe === 0), "sehr leicht: nur Grundwortschatz");
  const schwer = verbenIn("sehr schwer");
  assert.ok(schwer.filter((v) => v.stufe >= 1).length >= schwer.length / 3, "sehr schwer: meist schwerere Verben");
  // Fehler korrigieren: ein Satz, auf „mittel“ zwei, ab „schwer“ drei (im Test oben für jede Aufgabe geprüft)
  const saetze = (d: Difficulty) => ALLE.filter((x) => x.f === "fix" && x.d === d).map((x) => x.t.solution.split("\n").filter((z) => z.startsWith("→")).length);
  assert.ok(saetze("sehr leicht").every((n) => n === 1));
  assert.ok(saetze("sehr schwer").every((n) => n === 3));
});

test("auf einem Blatt steht keine Aufgabe doppelt", () => {
  for (const id of ENGLISCH_GRAMMATIK_IDS) {
    const skill = CURRICULUM.find((s) => s.id === id)!;
    for (const difficulty of ["sehr leicht", "mittel", "sehr schwer"] as Difficulty[])
      for (const taskType of ["mixed", "mc", "cloze", "grammar", "fix", "calc"] as const) {
        const tasks = generateBuiltIn({ subject: "Englisch", skills: [{ id, name: skill.name }], difficulty, count: 10, taskType, seed: 4242 });
        assert.equal(tasks.length, 10, `${id} ${difficulty} ${taskType}`);
        const keys = tasks.map(aufgabenSchluessel);
        assert.equal(new Set(keys).size, 10, `${id} ${difficulty} ${taskType}: doppelt ${keys.find((k, i) => keys.indexOf(k) !== i)}`);
        assert.ok(tasks.every((t) => t.type !== "free"), `${id} ${taskType}: keine Erklärungsaufgabe`);
        if (taskType === "mc" || taskType === "cloze" || taskType === "fix") assert.ok(tasks.every((t) => t.type === taskType), `${id} ${taskType}`);
      }
  }
  // ein Blatt mit zwei Fähigkeiten
  const zwei = generateBuiltIn({ subject: "Englisch", skills: [{ id: "englisch.tenses.presentsimple", name: "Present Simple" }, { id: "englisch.grammar.someany", name: "some und any" }], difficulty: "leicht", count: 20, taskType: "mixed", seed: 7 });
  assert.equal(new Set(zwei.map(aufgabenSchluessel)).size, 20);
});

test("Builder: jeder Aufgabentyp, und was die Fähigkeit nicht hat, kommt ehrlich als Lückentext", () => {
  const typen = categoriesFor("Englisch").filter((c) => !["offen", "writing", "reading", "auswendig"].includes(c.key));
  for (const id of ENGLISCH_GRAMMATIK_IDS) {
    for (const c of typen) {
      for (const difficulty of ["sehr leicht", "schwer"] as Difficulty[]) {
        const t = generateForSlot({ skillId: id, skillName: id, difficulty, category: c.key, subject: "Englisch" }, mulberry32(11));
        assert.equal(t.skillId, id);
        if (t.category === c.key) assert.ok(c.formats.includes(t.type), `${id} ${c.key}: Format ${t.type}`);
        else assert.deepEqual([t.category, t.type], ["gap", "cloze"], `${id} ${c.key}: statt dessen ${t.category}`);
        assert.equal(checkAnswer(t, richtige(t)[0]).correct, true, `${id} ${c.key}`);
      }
    }
    // Lückentext, Multiple Choice und Fehler korrigieren gibt es für jede Fähigkeit
    for (const k of ["gap", "mc", "korrigieren", "grammar"]) assert.equal(generateForSlot({ skillId: id, skillName: id, difficulty: "mittel", category: k, subject: "Englisch" }, mulberry32(3)).category, k, `${id} ${k}`);
    assert.equal(correctionTask(id, "mittel", mulberry32(5))?.type, "fix", id);
  }
  // Translation: bei den unregelmäßigen Verben eine echte Übersetzung Deutsch → Englisch
  const u = generateForSlot({ skillId: "englisch.vocab.irregular", skillName: "Irregular verbs", difficulty: "mittel", category: "translation", subject: "Englisch" }, mulberry32(1));
  assert.equal(u.category, "translation");
  const deutsch = u.prompt.split("\n")[1];
  const gemeint = UNREGELMAESSIG.find((x) => x.de === deutsch);
  assert.ok(gemeint, `deutsches Wort: ${deutsch}`);
  assert.equal(checkAnswer(u, gemeint.base).correct, true);
  assert.equal(checkAnswer(u, gemeint.past[0]).correct, gemeint.past[0] === gemeint.base);
  // Teilfähigkeiten ohne eigene Muster nehmen die ihrer Fähigkeit
  const teil = generateForSlot({ skillId: "englisch.tenses.presentsimple.eigene", skillName: "Eigene", generatorSkillId: "englisch.tenses.presentsimple", difficulty: "leicht", category: "mc", subject: "Englisch" }, mulberry32(2));
  assert.equal(teil.type, "mc");
  assert.deepEqual(teil.skillIds, ["englisch.tenses.presentsimple.eigene", "englisch.tenses.presentsimple"]);
});

test("Deutsch wird geprüft wie bisher: keine Kurzformen, gleiches Ergebnis", () => {
  const bisher = (given: string, expected: string, mode: "text" | "exact") => normalizeText(given, mode === "exact") === normalizeText(expected, mode === "exact");
  const paare: [string, string][] = [
    ["geht's", "geht es"],
    ["Wie geht’s?", "Wie geht's?"],
    ["hab's", "habe es"],
    ["Haus", "haus"],
    ["  das   Haus ", "das Haus"],
    ["doesn't", "does not"],
    ["I'm", "I am"],
    ["dass", "das"],
  ];
  for (const [a, b] of paare) for (const mode of ["text", "exact"] as const) assert.equal(sameAnswer(a, b, mode), bisher(a, b, mode), `${a} / ${b} (${mode})`);
  // die deutschen Generatoren setzen das Kennzeichen nie
  const deutsch = CURRICULUM.filter((s) => s.subject === "Deutsch" && hasBuiltInGenerator(s.id));
  assert.ok(deutsch.length > 5);
  for (const s of deutsch)
    for (const taskType of ["mixed", "cloze", "mc", "grammar"] as const)
      for (const t of generateBuiltIn({ subject: "Deutsch", skills: [{ id: s.id, name: s.name }], difficulty: "mittel", count: 6, taskType, seed: 99 })) {
        assert.equal(t.answer.contractions, undefined, s.id);
        for (const r of richtige(t)) assert.equal(checkAnswer(t, r).correct, true, s.id);
        for (const e of t.errorMap) if (!t.answer.blanks || t.answer.blanks.length === 1) assert.equal(checkAnswer(t, t.answer.blanks ? JSON.stringify([e.answer]) : e.answer).errorLabel, e.label, s.id);
      }
  // Fehler korrigieren: Ergebnis und Etikett genau wie checkFix (das erste nicht verbesserte Wort)
  for (const id of ["deutsch.grammatik.zeiten", "deutsch.grammatik.artikel", "deutsch.recht.sss", "deutsch.beistrich.nebensatz"]) {
    for (let s = 0; s < 10; s++) {
      const t = correctionTask(id, "schwer", mulberry32(s))!;
      for (const given of [t.data.faulty!, t.answer.accepted![0], `${t.answer.accepted![0]} `, t.answer.accepted![0].replace(/\.$/, "")]) {
        const r = checkAnswer(t, given);
        const f = checkFix(t.data.faulty!, t.answer.accepted!, given, { caseSensitive: true, labels: t.answer.fixes });
        assert.equal(r.correct, f.correct, `${id}: ${given}`);
        assert.equal(r.errorLabel, f.missed[0]?.label || null, `${id}: ${given}`);
      }
    }
  }
});

test("auf dem Blatt des Schülers: Kurz- und Langform richtig, „Richtig“ zeigt seine eigene Fassung", async () => {
  process.env.DATABASE_PATH = ":memory:";
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Kurzform Test", grade: 5, klasse: 1, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Englisch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  let n = 0;
  for (const taskType of ["fix", "cloze", "grammar"] as const) {
    const { id: wid, source } = await buildWorksheet({ subject: "Englisch", schoolType: "Mittelschule", klasse: 1, skillIds: ["englisch.tenses.presentsimple.fragen"], difficulty: "leicht", count: 8, taskType, useAI: false });
    assert.equal(source, "generator");
    const aid = repo.assignWorksheet(wid, sid);
    for (const t of repo.listTasks(wid)) {
      assert.equal(t.answer.contractions, true, "das Kennzeichen bleibt beim Speichern");
      const richtig = t.answer.blanks ? JSON.stringify(t.answer.blanks.map((b) => b[0])) : t.answer.accepted![0];
      const anders = alsAntwort(t, richtig, (s) => (/n't|'m\b/.test(s) ? langform(s) : zusammengezogen(s)).replace(/'/g, "’"));
      if (anders.replace(/’/g, "'") === richtig) continue;
      n++;
      const r = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: anders, timeMs: 10_000, hintsUsed: 0, submissionId: `kurzform-${String(t.id).padStart(12, "0")}` });
      assert.equal(r.correct, true, `${anders} für ${richtig}`);
      if (t.type === "fix") assert.equal(r.expected, anders, "die eigene Fassung ist die richtige, nichts wird rot markiert");
    }
  }
  assert.ok(n >= 6, `genug Antworten mit Kurz- oder Langform (${n})`);
});
