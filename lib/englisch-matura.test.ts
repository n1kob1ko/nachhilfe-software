/**
 * Formate der Englisch-Matura (lib/englisch-matura-formate.ts, lib/englisch-matura.ts, lib/englisch-matura-pruefen.ts):
 * Reading (True or False mit Beleg, Multiple Choice, Multiple Matching, Short Answers), Language in Use (Banked Gap
 * Fill, Open Gap Fill, Editing, Word Formation) und Writing. Geprüft wird die Bewertung jedes Formats, auch was die
 * Lehrkraft entscheidet, die eigenen Generatoren über viele Seeds, der KI-Weg mit einem Transport-Ersatz (kein
 * Schlüssel, kein Aufruf nach außen), die Schülerseite ohne Lösung, das A4-Blatt und die Mappe.
 * Alle Texte sind eigene; alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

import { CATEGORIES, categoriesFor, mixFor, type Difficulty } from "./curriculum";
import {
  ENGLISCH_MATURA,
  englischAntwortText,
  englischAuftrag,
  englischFalscheAntwort,
  englischFormat,
  englischLeer,
  englischLoesung,
  englischPunkte,
  englischRichtigeAntwort,
  pruefeEnglisch,
  wortRahmen,
  type EnglischMaturaFormat,
} from "./englisch-matura-formate";
import { ENGLISCH_MATURA_GEN, englischMaturaAufgabe, FAEHIGKEIT_FORMAT } from "./englisch-matura";
import { BANKED_GAP, EDITING, LESETEXTE, OPEN_GAP, SCHREIBAUFTRAEGE, WORD_FORMATION } from "./englisch-matura-texte";
import { maturaFormat } from "./matura-formate";
import { wordCount } from "./lesen";
import { checkAnswer, GAP, type TaskDraft } from "./tasks";

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

const DIFFS: Difficulty[] = ["sehr leicht", "leicht", "mittel", "schwer", "sehr schwer"];
const basis = { skillIds: [] as string[], difficulty: "mittel" as Difficulty, solution: "", hints: [], errorMap: [] };

// ---------- eigene kleine Aufgaben, eine je Format ----------

const TEXT = [
  "Every Thursday evening, the small library in Fernbrook stays open until ten o'clock. The idea came from Ruth Calloway, who has worked there for twelve years. She noticed that many young people had nowhere quiet to study after school.",
  "At first, only six students came. Now more than forty visit each week. They bring their own laptops, but the library lends tablets to anyone who needs one. Tea is free, and biscuits cost twenty cents.",
  "Not everyone liked the plan. Some neighbours were worried about noise in the street. Ruth invited them to visit on a Thursday, and most of them changed their minds. One of them now helps students with maths.",
  "The library hopes to open on Tuesdays too, but it still needs more volunteers. Anyone over eighteen can apply at the front desk.",
].join("\n\n");
const LESE = { passage: TEXT, passageTitle: "The Lantern Library" };

const WAHR_FALSCH: TaskDraft = {
  ...basis,
  skillId: "englisch.os.reading.true-false",
  category: "matura-true-false",
  type: "zuordnung",
  prompt: englischAuftrag("matura-true-false", 4),
  data: {
    ...LESE,
    zuordnung: {
      statements: ["The library is open late every evening.", "Ruth Calloway has worked at the library for more than ten years.", "Students must bring their own laptops.", "A neighbour now helps students with maths."],
      options: ["True", "False"],
      art: "richtig-falsch",
    },
  },
  answer: {
    pairs: [1, 0, 1, 0],
    belege: [
      "Every Thursday evening, the small library in Fernbrook stays open until ten o'clock.",
      "The idea came from Ruth Calloway, who has worked there for twelve years.",
      "They bring their own laptops, but the library lends tablets to anyone who needs one.",
      "One of them now helps students with maths.",
    ],
  },
};
const FRAGEN: TaskDraft = {
  ...basis,
  skillId: "englisch.os.reading.multiple-choice",
  category: "matura-reading-mc",
  type: "zuordnung",
  prompt: englischAuftrag("matura-reading-mc", 3),
  data: {
    ...LESE,
    zuordnung: {
      statements: ["Why did Ruth start the evening openings?", "What do students get for free?", "What does the library need before it can open on Tuesdays?"],
      options: [],
      art: "fragen",
      choices: [
        ["Young people needed a quiet place to study.", "The library wanted more money.", "Her neighbours asked her to.", "The library had too many books."],
        ["Biscuits", "Tea", "Laptops", "Books to keep"],
        ["A bigger room", "More tablets", "More volunteers", "Permission from the neighbours"],
      ],
    },
  },
  answer: { pairs: [0, 1, 2] },
};
const MATCHING: TaskDraft = {
  ...basis,
  skillId: "englisch.os.reading.multiple-matching",
  category: "matura-matching",
  type: "zuordnung",
  prompt: englischAuftrag("matura-matching", 4, 1, "ueberschriften"),
  data: {
    ...LESE,
    zuordnung: {
      statements: ["Paragraph 1", "Paragraph 2", "Paragraph 3", "Paragraph 4"],
      options: ["A quiet place after school", "Growing numbers", "Worried neighbours", "Plans for the future", "A new café opens"],
      art: "ueberschriften",
    },
  },
  answer: { pairs: [0, 1, 2, 3] },
};
const KURZ: TaskDraft = {
  ...basis,
  skillId: "englisch.os.reading.short-answers",
  category: "matura-short-answers",
  type: "cloze",
  prompt: `${englischAuftrag("matura-short-answers", 3)}\n\n1 Until what time is the library open on Thursdays? ${GAP}\n2 How many students came at first? ${GAP}\n3 Who can apply to volunteer? ${GAP}`,
  data: LESE,
  answer: { blanks: [["ten o'clock", "10 o'clock", "10 pm"], ["six", "6", "six students"], ["anyone over eighteen", "people over eighteen"]], mode: "text", maxWords: 4, teilpunkte: true },
};
const KASTEN: TaskDraft = {
  ...basis,
  skillId: "englisch.os.liu.gap-fill-choice",
  category: "matura-banked-gap",
  type: "cloze",
  prompt: `${englischAuftrag("matura-banked-gap", 4, 2)}\n\nA garden on the roof\nOur school has (1) ${GAP} a garden on its roof. Students (2) ${GAP} vegetables there (3) ${GAP} spring. The food is (4) ${GAP} in the canteen.`,
  data: { wortliste: ["built", "every", "grow", "quickly", "since", "used"] },
  answer: { blanks: [["built"], ["grow"], ["every"], ["used"]], mode: "text", teilpunkte: true },
};
const OFFEN: TaskDraft = {
  ...basis,
  skillId: "englisch.os.liu.open-gap-fill",
  category: "matura-open-gap",
  type: "cloze",
  prompt: `${englischAuftrag("matura-open-gap", 4)}\n\nMia\nMia has lived in Graz (1) ${GAP} 2019. She goes to school (2) ${GAP} bike, and she is better at English (3) ${GAP} her brother. (4) ${GAP} weekends she plays football.`,
  data: {},
  answer: { blanks: [["since"], ["by"], ["than"], ["At", "On"]], mode: "text", teilpunkte: true },
};
const EDIT: TaskDraft = {
  ...basis,
  skillId: "englisch.os.liu.editing",
  category: "matura-editing",
  type: "cloze",
  prompt: `${englischAuftrag("matura-editing", 6)}\n\nA summer in Dublin\n${[
    "Last summer I have visited my cousin in Dublin.",
    "We went to the museum and the old castle.",
    "The weather was more better than we expected.",
    "Every evening we cooked dinner together.",
    "I would like to go there the again next year.",
    "My cousin she wants to visit me in Vienna.",
  ]
    .map((z, i) => `${i + 1} ${z} ${GAP}`)
    .join("\n")}`,
  data: { editing: true },
  answer: { blanks: [["have"], ["✓"], ["more"], ["✓"], ["the"], ["she"]], mode: "text", teilpunkte: true },
};
const WORTBILDUNG: TaskDraft = {
  ...basis,
  skillId: "englisch.os.vocab.word-formation",
  category: "matura-word-formation",
  type: "cloze",
  prompt: `${englischAuftrag("matura-word-formation", 4)}\n\nThe concert\nThe concert was a great (1) ${GAP} (SUCCEED). Everyone was (2) ${GAP} (EXCITE) about the (3) ${GAP} (PERFORM). It was (4) ${GAP} (BELIEVE) good.`,
  data: {},
  answer: { blanks: [["success"], ["excited"], ["performance"], ["unbelievably"]], mode: "text", teilpunkte: true },
};
const SCHREIBEN: TaskDraft = {
  ...basis,
  skillId: "englisch.os.writing.article",
  category: "matura-writing",
  type: "free",
  prompt: "Your school magazine is looking for articles about clubs.\n\nWrite an article about a club at your school. Write about 200 words.\n\nIn your article, you should:\n• describe what the club does\n• explain why students join it\n• suggest how the club could grow",
  data: { schreibauftrag: { textsorte: "article", woerter: 200 }, lines: 16 },
  answer: { criteria: ["Task achievement"] },
};
const HAND: TaskDraft[] = [WAHR_FALSCH, FRAGEN, MATCHING, KURZ, KASTEN, OFFEN, EDIT, WORTBILDUNG, SCHREIBEN];

const tf = (wahl: (number | null)[], belege: string[]) => JSON.stringify({ wahl, belege });
const RICHTIGE_BELEGE = ["Every Thursday evening, the", "The idea came from", "They bring their own", "One of them now"];

test("die Formate von Hand sind gültig, ihre richtigen Antworten zählen, das Format wird auch ohne Kategorie erkannt", () => {
  for (const t of HAND) {
    assert.equal(pruefeEnglisch(t), null, t.category!);
    assert.equal(englischFormat(t), t.category);
    // an der Form erkannt; Open Gap Fill und Word Formation sind ohne Kategorie gewöhnliche Lückentexte mit Teilpunkten
    if (t.category !== "matura-open-gap" && t.category !== "matura-word-formation") assert.equal(englischFormat({ ...t, category: null }), t.category, `${t.category} an der Form erkannt`);
    assert.equal(maturaFormat(t), null, `${t.category} ist kein Format der Mathe-Matura`);
    const r = englischRichtigeAntwort(t);
    if (t.type === "free") assert.equal(r, null);
    else assert.equal(checkAnswer(t, r!).correct, true, t.category!);
  }
  assert.deepEqual(
    HAND.map((t) => englischPunkte(t)),
    [4, 3, 4, 3, 4, 4, 6, 4, null],
    "ein Punkt je Aussage, Frage, Lücke oder Zeile; Writing nach Schwierigkeit",
  );
});

test("True or False: True/False prüft die App, den Beleg am Anfang des Satzes; was unsicher ist, entscheidet die Lehrkraft", () => {
  assert.equal(checkAnswer(WAHR_FALSCH, tf([1, 0, 1, 0], RICHTIGE_BELEGE)).correct, true);
  // auch weniger Wörter, wenn kein anderer Satz so beginnt, und andere Schreibung
  assert.equal(checkAnswer(WAHR_FALSCH, tf([1, 0, 1, 0], ["every thursday evening", "The idea came", "They bring their own laptops,", "One of them"])).correct, true);
  // True und False verwechselt: sicher falsch, mit Nummer
  const falsch = checkAnswer(WAHR_FALSCH, tf([0, 0, 1, 0], RICHTIGE_BELEGE));
  assert.deepEqual([falsch.correct, falsch.wrongGaps, falsch.errorLabel], [false, [1], "True und False verwechselt"]);
  assert.match(falsch.feedback, /^Bei 1 stimmt True oder False nicht\.$/);
  assert.equal(falsch.onFinal, "teilweise", "drei von vier richtig: im letzten Versuch teilweise richtig");
  // ohne Beleg: falsch
  const ohne = checkAnswer(WAHR_FALSCH, tf([1, 0, 1, 0], ["Every Thursday evening, the", "", "They bring their own", "One of them now"]));
  assert.deepEqual([ohne.correct, ohne.wrongGaps, ohne.errorLabel], [false, [2], "Beleg fehlt"]);
  assert.match(ohne.feedback, /Bei 2 fehlt die Begründung aus dem Text\./);
  // ein anderer Satz als Beleg: nie falsch, die Lehrkraft schaut
  const anders = checkAnswer(WAHR_FALSCH, tf([1, 0, 1, 0], ["Every Thursday evening, the", "She noticed that many", "They bring their own", "One of them now"]));
  assert.equal(anders.correct, null);
  assert.equal(anders.feedback, "True oder False stimmt überall. Bei 2 schaut sich deine Lehrerin bzw. dein Lehrer die Begründung an.");
  // sicher falsch und unsicher zusammen: falsch, im letzten Versuch für die Lehrkraft
  const beides = checkAnswer(WAHR_FALSCH, tf([1, 0, 0, 0], ["Every Thursday evening, the", "She noticed that many", "They bring their own", "One of them now"]));
  assert.deepEqual([beides.correct, beides.onFinal], [false, "offen"]);
  // keine Wahl: fehlt noch
  const leer = checkAnswer(WAHR_FALSCH, tf([1, null, 1, 0], RICHTIGE_BELEGE));
  assert.match(leer.feedback, /Bei 2 fehlt noch True oder False\./);
  // wenig richtig: im letzten Versuch nicht teilweise
  assert.equal(checkAnswer(WAHR_FALSCH, tf([0, 1, 0, 0], RICHTIGE_BELEGE)).onFinal, null);
  // die alte Form (nur die Wahl als Liste) ist lesbar
  assert.equal(checkAnswer(WAHR_FALSCH, "[1,0,1,0]").correct, false);
});

test("Multiple Choice und Matching: je Item für sich, ein Buchstabe nur einmal", () => {
  const mc = checkAnswer(FRAGEN, "[0,2,2]");
  assert.deepEqual([mc.correct, mc.wrongGaps, mc.errorLabel], [false, [2], "Falsche Antwort gewählt"]);
  assert.match(mc.feedback, /^Bei Frage 2 stimmt die Antwort nicht\.$/);
  assert.equal(checkAnswer(FRAGEN, "[0,1,2]").correct, true);
  assert.equal(checkAnswer(FRAGEN, "[0,0,0]").correct, false, "bei Multiple Choice darf ein Buchstabe öfter vorkommen");
  assert.ok(!checkAnswer(FRAGEN, "[0,0,0]").feedback.includes("nur einmal"));
  const doppelt = checkAnswer(MATCHING, "[0,0,2,3]");
  assert.deepEqual([doppelt.correct, doppelt.errorLabel], [false, "Einen Buchstaben zweimal verwendet"]);
  assert.match(doppelt.feedback, /Jeder Buchstabe passt nur einmal\./);
  const fehlt = checkAnswer(MATCHING, "[0,1,null,3]");
  assert.match(fehlt.feedback, /Bei 3 fehlt noch ein Buchstabe\./);
  assert.equal(checkAnswer(MATCHING, "[0,1,4,3]").errorLabel, "Falsch zugeordnet");
});

test("Short Answers: höchstens vier Wörter; andere Worte bewertet die Lehrkraft, nie falsch", () => {
  assert.equal(checkAnswer(KURZ, JSON.stringify(["until ten o'clock", "Six", "anyone over eighteen"])).correct, true, "enthält die erwartete Antwort");
  const lang = checkAnswer(KURZ, JSON.stringify(["it is open until ten o'clock", "six", "anyone over eighteen"]));
  assert.deepEqual([lang.correct, lang.wrongGaps, lang.errorLabel], [false, [1], "Mehr als vier Wörter"]);
  const anders = checkAnswer(KURZ, JSON.stringify(["late at night", "six", "adults"]));
  assert.equal(anders.correct, null);
  assert.equal(anders.feedback, "1 von 3 Antworten stimmen sicher. Bei Frage 1 und 3 schaut sich deine Lehrerin bzw. dein Lehrer die Antwort an.");
  assert.equal(checkAnswer(KURZ, JSON.stringify(["not ten o'clock", "six", "anyone over eighteen"])).correct, null, "verneint: die Lehrkraft entscheidet");
  const leer = checkAnswer(KURZ, JSON.stringify(["", "six", "anyone over eighteen"]));
  assert.match(leer.feedback, /Frage 1 ist noch nicht beantwortet\./);
});

test("Language in Use: Wörter aus dem Kasten, ein Wort, Editing mit ✓, Word Formation", () => {
  assert.equal(checkAnswer(KASTEN, JSON.stringify(["Built", "grow", "every", "used."])).correct, true);
  assert.equal(checkAnswer(KASTEN, JSON.stringify(["built", "grow", "since", "used"])).errorLabel, "Falsches Wort aus dem Kasten");
  assert.equal(checkAnswer(KASTEN, JSON.stringify(["built", "grow", "each", "used"])).errorLabel, "Wort nicht aus dem Kasten");
  const doppelt = checkAnswer(KASTEN, JSON.stringify(["built", "built", "every", "used"]));
  assert.equal(doppelt.errorLabel, "Ein Wort zweimal verwendet");
  assert.match(doppelt.feedback, /Jedes Wort aus dem Kasten passt nur einmal\./);
  assert.equal(checkAnswer(OFFEN, JSON.stringify(["since", "by", "than", "on"])).correct, true, "beide Lösungen zählen");
  const offen = checkAnswer(OFFEN, JSON.stringify(["for", "by", "than", "At"]));
  assert.deepEqual([offen.wrongGaps, offen.onFinal], [[1], "teilweise"]);
  assert.match(offen.feedback, /^Lücke 1 stimmt nicht\.$/);
  // Editing: jedes Häkchen zählt als ✓
  assert.equal(checkAnswer(EDIT, JSON.stringify(["have", "ok", "more", "✔", "the", "she"])).correct, true);
  assert.equal(checkAnswer(EDIT, JSON.stringify(["have", "the", "more", "✓", "the", "she"])).errorLabel, "Richtige Zeile nicht erkannt");
  assert.equal(checkAnswer(EDIT, JSON.stringify(["✓", "✓", "more", "✓", "the", "she"])).errorLabel, "Überflüssiges Wort übersehen");
  assert.equal(checkAnswer(EDIT, JSON.stringify(["visited", "✓", "more", "✓", "the", "she"])).errorLabel, "Falsches Wort gestrichen");
  assert.match(checkAnswer(EDIT, JSON.stringify(["have", "", "more", "✓", "the", "she"])).feedback, /In Zeile 2 fehlt noch ein Wort oder ✓\./);
  assert.equal(checkAnswer(WORTBILDUNG, JSON.stringify(["success", "excited", "performance", "unbelievably"])).correct, true);
  assert.deepEqual(checkAnswer(WORTBILDUNG, JSON.stringify(["succeed", "excited", "performance", "unbelievably"])).wrongGaps, [1]);
});

test("Writing: eine freie Antwort, die Lehrkraft bewertet; Prüfung von Textsorte, Wortanzahl und drei Punkten", () => {
  assert.equal(checkAnswer(SCHREIBEN, "My club is great.").correct, null);
  assert.deepEqual(wortRahmen(250), { min: 225, max: 275 });
  assert.match(pruefeEnglisch({ ...SCHREIBEN, prompt: SCHREIBEN.prompt.replace("\n• suggest how the club could grow", "") })!, /genau drei Punkte/);
  assert.match(pruefeEnglisch({ ...SCHREIBEN, data: { schreibauftrag: { textsorte: "poem", woerter: 200 } } })!, /Textsorte/);
  assert.match(pruefeEnglisch({ ...SCHREIBEN, data: { schreibauftrag: { textsorte: "article", woerter: 50 } } })!, /zwischen 100 und 500/);
  assert.match(pruefeEnglisch({ ...SCHREIBEN, answer: { sample: "Far too short." } })!, /Mustertext hat 3 Wörter, verlangt sind 180 bis 220/);
});

test("pruefeEnglisch: was nicht in die Form passt, wird mit einem deutschen Satz abgelehnt", () => {
  const z = WAHR_FALSCH.data.zuordnung!;
  const fall: [TaskDraft, RegExp][] = [
    [{ ...WAHR_FALSCH, data: { ...WAHR_FALSCH.data, passage: "Too short." } }, /Lesetext \(mindestens 80 Wörter\)/],
    [{ ...WAHR_FALSCH, answer: { ...WAHR_FALSCH.answer, belege: ["Every Thursday evening", ...WAHR_FALSCH.answer.belege!.slice(1)] } }, /kein ganzer Satz aus dem Text/],
    [{ ...WAHR_FALSCH, answer: { ...WAHR_FALSCH.answer, belege: ["The library is closed on Mondays.", ...WAHR_FALSCH.answer.belege!.slice(1)] } }, /kein ganzer Satz aus dem Text/],
    [{ ...WAHR_FALSCH, answer: { ...WAHR_FALSCH.answer, pairs: [0, 0, 0, 0] } }, /mindestens eine Aussage ist True und mindestens eine False/i],
    [{ ...WAHR_FALSCH, data: { ...WAHR_FALSCH.data, zuordnung: { ...z, statements: z.statements.slice(0, 2) } } }, /mindestens drei Aussagen/],
    [{ ...FRAGEN, data: { ...FRAGEN.data, zuordnung: { ...FRAGEN.data.zuordnung!, choices: [["a", "b", "c"], ...FRAGEN.data.zuordnung!.choices!.slice(1)] } } }, /genau vier Antworten/],
    [{ ...MATCHING, data: { ...MATCHING.data, zuordnung: { ...MATCHING.data.zuordnung!, options: MATCHING.data.zuordnung!.options.slice(0, 4) } } }, /mindestens eine bleibt übrig/],
    [{ ...MATCHING, answer: { pairs: [0, 0, 2, 3] } }, /nur einmal/],
    [{ ...KURZ, answer: { ...KURZ.answer, blanks: [["the library is open until ten"], ["six"], ["anyone"]] } }, /mehr als 4 Wörter/],
    [{ ...KASTEN, data: { wortliste: ["built", "every", "grow", "used", "since"] } }, /mindestens zwei Wörter, die übrig bleiben/],
    [{ ...KASTEN, data: { wortliste: ["built", "every", "grow", "quickly", "since"] } }, /„used“ fehlt im Kasten/],
    [{ ...OFFEN, answer: { ...OFFEN.answer, blanks: [["since"], ["by bike"], ["than"], ["At"]] } }, /genau ein Wort/],
    [{ ...EDIT, answer: { ...EDIT.answer, blanks: [["have"], ["✓"], ["more"], ["✓"], ["the"], ["he"]] } }, /„he“ steht nicht in Zeile 6/],
    [{ ...EDIT, answer: { ...EDIT.answer, blanks: [["have"], ["went"], ["more"], ["✓"], ["the"], ["she"]] } }, /mindestens zwei richtige Zeilen/],
    [{ ...WORTBILDUNG, answer: { ...WORTBILDUNG.answer, blanks: [["succeed"], ["excited"], ["performance"], ["unbelievably"]] } }, /Lösung das Grundwort selbst/],
    [{ ...WORTBILDUNG, prompt: WORTBILDUNG.prompt.replace(" (SUCCEED)", "") }, /Grundwort in Großbuchstaben/],
  ];
  for (const [t, grund] of fall) assert.match(pruefeEnglisch(t) ?? "in Ordnung", grund, t.category!);
});

test("die Lösung in einer Zeile und die Antwort des Schülers als Text (Ergebnisseite, Lösungsseite)", () => {
  assert.equal(englischLoesung(WAHR_FALSCH), "1 False (Every Thursday evening, the …) · 2 True (The idea came from …) · 3 False (They bring their own …) · 4 True (One of them now …)");
  assert.equal(englischLoesung(MATCHING), "1 A · 2 B · 3 C · 4 D");
  assert.equal(englischLoesung(EDIT), "1 have · 2 ✓ · 3 more · 4 ✓ · 5 the · 6 she");
  assert.equal(englischLoesung(SCHREIBEN), null);
  assert.equal(englischAntwortText(WAHR_FALSCH, tf([1, 0, null, 0], ["Every Thursday", "", "", "One of them"])), "1 False (Every Thursday) · 2 True · 3 ? · 4 True (One of them)");
  assert.equal(englischAntwortText(FRAGEN, "[0,2,1]"), "1 A · 2 C · 3 B");
  assert.equal(englischAntwortText(KASTEN, '["built","grow","","used"]'), "1 built · 2 grow · 3 ? · 4 used");
  for (const t of HAND.filter((x) => x.type !== "free")) assert.equal(checkAnswer(t, englischFalscheAntwort(t)!).correct, false, t.category!);
});

// ---------- eigene Texte und Generatoren ----------

test("eigene Texte: Belege stehen Wort für Wort im Text, Mustertexte in der verlangten Länge, keine Gedankenstriche", () => {
  for (const a of SCHREIBAUFTRAEGE) {
    const { min, max } = wortRahmen(a.woerter);
    const n = wordCount(a.muster);
    assert.ok(n >= min && n <= max, `${a.id}: ${n} Wörter, verlangt ${min} bis ${max}`);
  }
  const alles = JSON.stringify([LESETEXTE, OPEN_GAP, BANKED_GAP, WORD_FORMATION, EDITING, SCHREIBAUFTRAEGE]);
  assert.ok(!alles.includes("—"), "kein Gedankenstrich");
  assert.ok(!/ – /.test(alles), "kein Halbgeviertstrich mit Leerzeichen");
  assert.ok(LESETEXTE.length >= 6 && OPEN_GAP.length >= 5 && BANKED_GAP.length >= 5 && WORD_FORMATION.length >= 5 && EDITING.length >= 5 && SCHREIBAUFTRAEGE.length >= 10);
});

test("Generatoren: jedes Format, jede Schwierigkeit, viele Seeds: gültig, die richtige Antwort zählt, eine falsche nicht", () => {
  const rng = mulberry32(2026);
  const gesehen = new Map<EnglischMaturaFormat, Set<string>>();
  for (const k of ENGLISCH_MATURA)
    for (const d of DIFFS)
      for (let i = 0; i < 30; i++) {
        const t = englischMaturaAufgabe(k, d, rng);
        assert.equal(pruefeEnglisch(t), null, `${k} ${d}: ${pruefeEnglisch(t)}`);
        assert.equal(t.category, k);
        assert.equal(t.sourceType, "eigen");
        assert.ok(t.hints.length >= 2 && t.solution.trim(), k);
        const json = JSON.stringify(t);
        assert.ok(!json.includes("—") && !/ – /.test(json), `${k}: Gedankenstrich`);
        if (k !== "matura-writing") {
          assert.equal(checkAnswer(t, englischRichtigeAntwort(t)!).correct, true, `${k} richtig`);
          assert.equal(checkAnswer(t, englischFalscheAntwort(t)!).correct, false, `${k} falsch`);
        } else assert.equal(checkAnswer(t, "A text.").correct, null);
        gesehen.set(k, (gesehen.get(k) ?? new Set()).add(t.prompt.slice(0, 400) + JSON.stringify(t.data.zuordnung ?? null)));
      }
  for (const k of ENGLISCH_MATURA) assert.ok(gesehen.get(k)!.size >= 5, `${k}: genug Abwechslung`);
  // jede Fähigkeit hat ihren Generator und ihr Format; die Writing-Fähigkeiten ihre Textsorte
  for (const [id, k] of Object.entries(FAEHIGKEIT_FORMAT)) {
    const t = ENGLISCH_MATURA_GEN[id](mulberry32(5), "mittel");
    assert.equal(t.category, k, id);
    assert.equal(t.skillId, id);
  }
  assert.equal(ENGLISCH_MATURA_GEN["englisch.os.writing.formal-email"](mulberry32(1), "mittel").data.schreibauftrag!.textsorte, "email-formal");
  assert.ok(ENGLISCH_MATURA_GEN["englisch.os.writing.complaint"](mulberry32(1), "mittel").prompt.toLowerCase().includes("complain"));
});

test("Aufgabentypen: neun Formate im Builder, Gemischt gibt jeder Fähigkeit ihr Format, die Schnellrunde nicht", async () => {
  const { categoriesFitQuickRound } = await import("./quick-round");
  const { standardPunkte } = await import("./probeschularbeit-regeln");
  const keys = categoriesFor("Englisch").map((c) => c.key);
  for (const k of ENGLISCH_MATURA) assert.ok(keys.includes(k), k);
  for (const c of CATEGORIES.Englisch.filter((x) => ENGLISCH_MATURA.includes(x.key as EnglischMaturaFormat))) {
    assert.match(c.label, /^Matura: /);
    assert.equal(categoriesFitQuickRound([c]), false, c.key);
  }
  for (const [id, k] of Object.entries(FAEHIGKEIT_FORMAT)) assert.deepEqual(mixFor("Englisch", id), [k], id);
  assert.ok(!mixFor("Englisch", "englisch.tenses.presentsimple").some((k) => ENGLISCH_MATURA.includes(k as EnglischMaturaFormat)), "andere Fähigkeiten wie bisher");
  assert.equal(standardPunkte({ ...WAHR_FALSCH, difficulty: "schwer" }), 4);
  assert.equal(standardPunkte({ ...EDIT, difficulty: "leicht" }), 6);
  assert.equal(standardPunkte({ ...SCHREIBEN, difficulty: "schwer" }), 4, "Writing nach Schwierigkeit");
});

// ---------- Builder ----------

test("Builder: leere Aufgaben je Format, Prüfung vor dem Senden, ohne KI das Format oder ein Hinweis", async () => {
  const builder = await import("./builder");
  const { generateForSlot } = await import("./generators");
  for (const k of ENGLISCH_MATURA) {
    const leer = builder.blankTask("cloze", "englisch.os.reading.true-false", k, "mittel");
    assert.equal(englischFormat(leer), k);
    assert.ok(builder.checkTask(leer), `${k}: eine leere Aufgabe geht nicht hinaus`);
    assert.deepEqual(englischLeer(k).type, leer.type);
  }
  for (const t of HAND) {
    assert.equal(builder.checkTask(t), null, t.category!);
    assert.deepEqual(builder.normalizeTask(t).answer, t.answer, `${t.category}: das Speichern ändert die Lösung nicht`);
    assert.deepEqual(builder.normalizeTask(t).data.zuordnung, t.data.zuordnung);
  }
  assert.match(builder.checkTask({ ...KURZ, answer: { ...KURZ.answer, blanks: [["one two three four five"], ["six"], ["anyone"]] } })!, /mehr als 4 Wörter/);

  const settings = { studentId: null, subject: "Englisch", schoolType: "Gymnasium", klasse: 7, difficulty: "mittel" as const, focus: "", useAI: false, title: "" };
  const ids = ["englisch.os.reading.true-false", "englisch.os.reading.multiple-matching", "englisch.os.liu.editing", "englisch.os.writing.essay"];
  const gemischt = await builder.generateTasks({ ...settings, skillIds: ids, count: 4, categories: [] }, null);
  assert.equal(gemischt.typFehlt, undefined);
  assert.deepEqual(gemischt.tasks.map((t) => t.category).sort(), ["matura-editing", "matura-matching", "matura-true-false", "matura-writing"]);
  for (const t of gemischt.tasks) assert.equal(builder.checkTask(t), null, t.prompt.slice(0, 80));
  assert.equal(gemischt.tasks.find((t) => t.category === "matura-writing")!.data.schreibauftrag!.textsorte, "essay");
  // ein anderes Format desselben Teils kommt so, wie es verlangt ist
  const anders = await builder.generateTasks({ ...settings, skillIds: ["englisch.os.reading.true-false"], count: 2, categories: ["matura-short-answers"] }, null);
  assert.equal(anders.typFehlt, undefined);
  assert.ok(anders.tasks.every((t) => t.category === "matura-short-answers"));
  // „Reading comprehension“ bei einer Reading-Fähigkeit: ihr Format, ohne Hinweis
  const lesen = await builder.generateTasks({ ...settings, skillIds: ["englisch.os.reading.multiple-choice"], count: 1, categories: ["reading"] }, null);
  assert.deepEqual([lesen.typFehlt, lesen.tasks[0].category], [undefined, "matura-reading-mc"]);
  // ein Format eines anderen Teils: das eigene Format, gezählt
  const fremd = await builder.generateTasks({ ...settings, skillIds: ["englisch.os.liu.open-gap-fill"], count: 2, categories: ["matura-true-false"] }, null);
  assert.equal(fremd.typFehlt, 2);
  assert.ok(fremd.tasks.every((t) => t.category === "matura-open-gap"));
  // eine Fähigkeit ohne Matura-Texte: kein Matura-Format, ehrlich als Lückentext
  const grammatik = generateForSlot({ skillId: "englisch.tenses.presentsimple", skillName: "Present Simple", difficulty: "mittel", category: "matura-true-false", subject: "Englisch" }, mulberry32(3));
  assert.deepEqual([grammatik.category, grammatik.type], ["gap", "cloze"]);
});

// ---------- KI, mit einem Transport-Ersatz ----------

const KI = {
  topic: "Reading", difficulty: "mittel", passage: null, options: null, correct_option: null, accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null,
  case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null, answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null,
  criteria: ["passt zum Text"], solution: "Siehe Text.", solution_steps: [], estimated_time_sec: 600, hints: ["Lies zuerst die Aussagen."], common_errors: [] as { answer: string; label: string }[],
};
const SCHREIB_MUSTER = Array.from({ length: 25 }, (_, i) => `Sentence number ${i + 1} of my article is here.`).join(" ");
/** Gültige KI-Aufgaben je Format (eigene Inhalte). */
const KI_GUT: Record<EnglischMaturaFormat, Record<string, unknown>> = {
  "matura-true-false": {
    ...KI, category: "matura-true-false", format: "zuordnung", skill_ids: ["englisch.os.reading.true-false"], prompt: "Read the text. Are the statements true or false?", passage: TEXT, passage_title: "The Lantern Library",
    statements: WAHR_FALSCH.data.zuordnung!.statements, pairs: [1, 0, 1, 0], justifications: WAHR_FALSCH.answer.belege,
  },
  "matura-reading-mc": {
    ...KI, category: "matura-reading-mc", format: "zuordnung", skill_ids: ["englisch.os.reading.multiple-choice"], prompt: "Answer the questions.", passage: TEXT, passage_title: "The Lantern Library",
    statements: FRAGEN.data.zuordnung!.statements, question_options: FRAGEN.data.zuordnung!.choices, pairs: [0, 1, 2],
  },
  "matura-matching": {
    ...KI, category: "matura-matching", format: "zuordnung", skill_ids: ["englisch.os.reading.multiple-matching"], prompt: "Match the headings.", passage: TEXT, passage_title: "The Lantern Library",
    matching_type: "headings", statements: MATCHING.data.zuordnung!.statements, options: MATCHING.data.zuordnung!.options, pairs: [0, 1, 2, 3],
  },
  "matura-short-answers": {
    ...KI, category: "matura-short-answers", format: "cloze", skill_ids: ["englisch.os.reading.short-answers"], passage: TEXT, passage_title: "The Lantern Library",
    prompt: `Answer in no more than four words.\n\n${KURZ.prompt.split("\n\n")[1]}`, blanks: [["ten o'clock"], ["six", "six students who came on the very first evening"], ["anyone over eighteen"]],
  },
  "matura-banked-gap": {
    ...KI, category: "matura-banked-gap", format: "cloze", skill_ids: ["englisch.os.liu.gap-fill-choice"], prompt: KASTEN.prompt.split("\n\n").slice(1).join("\n\n"),
    blanks: KASTEN.answer.blanks, word_bank: ["used", "built", "since", "grow", "every", "quickly"],
  },
  "matura-open-gap": { ...KI, category: "matura-open-gap", format: "cloze", skill_ids: ["englisch.os.liu.open-gap-fill"], prompt: `Fill in one word.\n\n${OFFEN.prompt.split("\n\n")[1]}`, blanks: OFFEN.answer.blanks },
  "matura-editing": { ...KI, category: "matura-editing", format: "cloze", skill_ids: ["englisch.os.liu.editing"], prompt: EDIT.prompt.split("\n\n")[1], blanks: [["have"], ["correct"], ["more"], ["✓"], ["the"], ["she"]] },
  "matura-word-formation": { ...KI, category: "matura-word-formation", format: "cloze", skill_ids: ["englisch.os.vocab.word-formation"], prompt: WORTBILDUNG.prompt.split("\n\n")[1], blanks: WORTBILDUNG.answer.blanks },
  "matura-writing": {
    ...KI, category: "matura-writing", format: "free", skill_ids: ["englisch.os.writing.article"], prompt: SCHREIBEN.prompt.replace(/• /g, "- "), text_type: "article", word_count: 200, sample_answer: SCHREIB_MUSTER,
  },
};

const kiReq = () => ({
  subject: "Englisch",
  skills: Object.keys(FAEHIGKEIT_FORMAT).map((id) => ({ id, name: id, area: "Matura", difficulty: "mittel" as Difficulty })),
  categories: CATEGORIES.Englisch,
});

test("KI: gültige Aufgaben jedes Formats werden übernommen, gemischt, der Arbeitsauftrag ist der eigene", async () => {
  const { aiTaskToDraft } = await import("./ai");
  const req = kiReq();
  const reihen = new Set<string>();
  for (const k of ENGLISCH_MATURA) {
    for (let seed = 1; seed <= 8; seed++) {
      const d = aiTaskToDraft(KI_GUT[k] as never, req, mulberry32(seed), req.categories.find((c) => c.key === k))!;
      assert.ok(d, `${k} Seed ${seed}`);
      assert.equal(d.category, k);
      assert.equal(d.sourceType, "ki");
      assert.equal(pruefeEnglisch(d), null, k);
      if (k !== "matura-writing") assert.equal(checkAnswer(d, englischRichtigeAntwort(d)!).correct, true, `${k}: die richtige Antwort nach dem Mischen`);
      if (k === "matura-reading-mc") {
        reihen.add(JSON.stringify(d.data.zuordnung!.choices));
        assert.deepEqual(d.answer.pairs!.map((p, i) => d.data.zuordnung!.choices![i][p]), ["Young people needed a quiet place to study.", "Tea", "More volunteers"]);
      }
      if (k === "matura-true-false") assert.equal(d.prompt, englischAuftrag(k, 4), "der eigene Auftrag");
      if (k === "matura-short-answers") assert.deepEqual(d.answer.blanks![1], ["six"], "eine Antwort mit mehr als vier Wörtern fällt weg");
      if (k === "matura-banked-gap") assert.deepEqual(d.data.wortliste, ["built", "every", "grow", "quickly", "since", "used"]);
      if (k === "matura-editing") assert.deepEqual(d.answer.blanks![1], ["✓"]);
      if (k === "matura-writing") {
        assert.equal((d.prompt.match(/^• /gm) ?? []).length, 3);
        assert.ok(d.answer.criteria!.some((c) => c.startsWith("Task achievement")) && d.answer.criteria!.includes("Wortanzahl: 180 bis 220 Wörter"));
      }
      for (const p of [d.prompt, ...(d.data.zuordnung?.statements ?? [])]) assert.ok(!p.includes("—"), k);
    }
  }
  assert.ok(reihen.size >= 4, "die Antworten werden gemischt");
});

test("KI: Aufgaben in falscher Form fallen weg, mit Grund", async () => {
  const { aiTaskToDraft } = await import("./ai");
  const req = kiReq();
  const gut = KI_GUT;
  const kaputt: [EnglischMaturaFormat, Record<string, unknown>, RegExp][] = [
    ["matura-true-false", { ...gut["matura-true-false"], justifications: ["The library is closed on Mondays.", ...WAHR_FALSCH.answer.belege!.slice(1)] }, /kein ganzer Satz aus dem Text/],
    ["matura-true-false", { ...gut["matura-true-false"], pairs: [1, 0, 1] }, /pairs/],
    ["matura-true-false", { ...gut["matura-true-false"], passage: "A short text." }, /Lesetext/],
    ["matura-reading-mc", { ...gut["matura-reading-mc"], question_options: [["a", "b", "c"], ["a", "b", "c", "d"], ["a", "b", "c", "d"]] }, /genau vier Antworten/],
    ["matura-reading-mc", { ...gut["matura-reading-mc"], pairs: [0, 1, 4] }, /pairs/],
    ["matura-matching", { ...gut["matura-matching"], options: MATCHING.data.zuordnung!.options.slice(0, 4) }, /übrig/],
    ["matura-matching", { ...gut["matura-matching"], pairs: [0, 0, 2, 3] }, /nur einmal/],
    ["matura-short-answers", { ...gut["matura-short-answers"], blanks: [["the library stays open until ten"], ["six"], ["anyone over eighteen"]] }, /Antwort/],
    ["matura-banked-gap", { ...gut["matura-banked-gap"], word_bank: ["built", "grow", "every", "used"] }, /übrig bleiben/],
    ["matura-open-gap", { ...gut["matura-open-gap"], blanks: [["since"], ["by"], ["than"]] }, /3 Lösungen/],
    ["matura-editing", { ...gut["matura-editing"], blanks: [["have"], ["went"], ["more"], ["✓"], ["the"], ["she"]] }, /mindestens zwei richtige Zeilen/],
    ["matura-word-formation", { ...gut["matura-word-formation"], blanks: [["succeed"], ["excited"], ["performance"], ["unbelievably"]] }, /Grundwort selbst/],
    ["matura-writing", { ...gut["matura-writing"], prompt: "Write an article. Write about 200 words.\n\nIn your article, you should:\n• describe the club\n• explain why" }, /genau drei Punkte/],
    ["matura-writing", { ...gut["matura-writing"], sample_answer: "Too short." }, /Mustertext hat 2 Wörter/],
    ["matura-writing", { ...gut["matura-writing"], text_type: null }, /Textsorte fehlt/],
  ];
  for (const [k, roh, grund] of kaputt) {
    const gruende: string[] = [];
    const d = aiTaskToDraft(roh as never, req, mulberry32(1), req.categories.find((c) => c.key === k), (r) => gruende.push(r));
    assert.equal(d, null, `${k}: ${JSON.stringify(roh).slice(0, 160)}`);
    assert.match(gruende.join("; "), grund, k);
  }
});

test("KI im Builder: die Regeln der Englisch-Matura nur, wenn ein Format verlangt ist; ungültige Aufgaben macht der Generator", async () => {
  const router = await import("./ai/router");
  const { buildPrompt } = await import("./ai");
  const builder = await import("./builder");
  const gefragt: string[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    const prompt = typeof req.content === "string" ? req.content : "";
    gefragt.push(prompt);
    const plan = [...prompt.matchAll(/^\d+\. category=(\S+?)[ ,].*skill_id=(\S+)/gm)].map((m) => m[1] as EnglischMaturaFormat);
    // True or False kommt immer mit einem Beleg, der nicht im Text steht: diese Aufgabe darf nie übernommen werden
    const tasks = plan.map((k) => (k === "matura-true-false" ? { ...KI_GUT[k], justifications: ["KAPUTT: not in the text.", "x", "y", "z"] } : KI_GUT[k]));
    return { parsed: { tasks }, refusal: false, model: req.model, usage: { input: 2_000, output: 800, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  try {
    const out = await builder.generateTasks(
      {
        studentId: null, subject: "Englisch", schoolType: "Gymnasium", klasse: 7, difficulty: "mittel", focus: "", useAI: true, title: "", count: 3,
        skillIds: ["englisch.os.reading.true-false", "englisch.os.liu.open-gap-fill", "englisch.os.writing.article"], categories: ["matura-true-false", "matura-open-gap", "matura-writing"],
      },
      null,
    );
    assert.ok(gefragt.length >= 1);
    assert.match(gefragt[0], /Englisch-Matura-Formate/);
    assert.match(gefragt[0], /Übernimm nichts aus früheren Maturen, aus dem Aufgabenpool, aus Schulbüchern oder vom IQS/);
    assert.ok(!gefragt[0].includes("AHS-Mathematik-Matura"), "die Regeln der Mathe-Matura nicht");
    assert.equal(out.tasks.length, 3);
    for (const t of out.tasks) {
      assert.equal(pruefeEnglisch(t), null, t.prompt.slice(0, 80));
      assert.ok(!JSON.stringify(t).includes("KAPUTT"), "die ungültige KI-Aufgabe ist nicht dabei");
    }
    const wf = out.tasks.find((t) => t.category === "matura-true-false")!;
    assert.notEqual(wf.sourceType, "ki", "True or False kommt aus den eigenen Texten");
    assert.equal(out.tasks.filter((t) => t.sourceType === "ki").length, 2);
  } finally {
    router.setTransport(null);
  }
  // ohne Format der Englisch-Matura keine Regeln dazu; keine Namen im Auftrag
  const ohne = buildPrompt({ subject: "Englisch", level: "7. Klasse", skills: [{ id: "englisch.tenses.presentsimple", name: "Present Simple", area: "Tenses", difficulty: "mittel" }], count: 2, categories: CATEGORIES.Englisch.filter((c) => c.key === "gap") });
  assert.ok(!ohne.includes("Englisch-Matura-Formate"));
});

// ---------- Schülerseite, Tafel ----------

test("Schülerseite: Aussagen, Fragen, Wörter im Kasten und Wortgrenze ohne Lösung; bewertet wie oben, Unsicheres für die Lehrkraft", async () => {
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const { clientTasks } = await import("./solver-tasks");
  const { submitAnswer, reviewAnswer } = await import("./service");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Testkind Englisch", grade: 11, klasse: 7, teacher_id: niko.id, school: "", school_type: "Gymnasium", subjects: ["Englisch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const wid = repo.createWorksheet({ title: "Matura Englisch", subject: "Englisch", grade: 11, school_type: "Gymnasium", klasse: 7, topic: "", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [] }, HAND);
  const aid = repo.assignWorksheet(wid, sid);
  const sicht = () => clientTasks(repo.getAssignment(aid)!);
  const view = sicht();
  const json = JSON.stringify(view);
  for (const geheim of ['"pairs"', '"belege"', '"blanks":[', '"answer"', '"errorMap"', '"sample"', "unbelievably", "performance", '"than"']) assert.ok(!json.includes(geheim), `Schülerseite enthält ${geheim}`);
  const [wf, mc, match, kurz, kasten, , edit, , schreiben] = view;
  assert.deepEqual(wf.zuordnung, { statements: WAHR_FALSCH.data.zuordnung!.statements, options: ["True", "False"], art: "richtig-falsch" });
  assert.deepEqual(mc.zuordnung!.choices, FRAGEN.data.zuordnung!.choices);
  assert.equal(match.zuordnung!.options.length, 5);
  assert.deepEqual(wf.englisch!.lesetext, { title: "The Lantern Library" }, "der Text steht neben den Fragen");
  assert.equal(wf.passage, TEXT);
  assert.deepEqual([kurz.blanks, kurz.englisch!.maxWords], [3, 4]);
  assert.deepEqual(kasten.englisch!.wortliste, KASTEN.data.wortliste);
  assert.equal(edit.englisch!.editing, true);
  assert.deepEqual(schreiben.englisch!.schreiben, { textsorte: "article", woerter: 200, min: 180, max: 220 });
  assert.equal(schreiben.lines, 16);
  for (const c of view) assert.equal(c.released, null);

  const student = repo.getStudent(sid)!;
  const gespeichert = repo.listTasks(wid);
  const antworte = (i: number, answer: string) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId: gespeichert[i].id, answer, timeMs: 30_000, activeMs: 30_000, hintsUsed: 0, giveUp: false });
  // True or False: ein Beleg aus einem anderen Satz geht an die Lehrkraft, nicht falsch
  const offen = await antworte(0, tf([1, 0, 1, 0], ["Every Thursday evening, the", "She noticed that many", "They bring their own", "One of them now"]));
  assert.deepEqual([offen.correct, offen.final, offen.pendingReview], [null, true, true]);
  assert.match(offen.feedback, /Bei 2 schaut sich deine Lehrerin bzw\. dein Lehrer die Begründung an\./);
  const versuch = repo.listAttemptsForAssignment(aid).find((a) => a.task_id === gespeichert[0].id)!;
  assert.equal(versuch.review, "offen");
  assert.ok("ok" in reviewAnswer(versuch.id, "richtig", niko.id), "die Lehrkraft bewertet");
  // Open Gap Fill: zweimal eine Lücke falsch, dann teilweise richtig (drei von vier)
  for (let n = 0; n < 2; n++) {
    const r = await antworte(5, JSON.stringify(["for", "by", "than", "At"]));
    assert.deepEqual([r.correct, r.final, r.wrongGaps], [false, false, [1]]);
  }
  const letzt = await antworte(5, JSON.stringify(["for", "by", "than", "At"]));
  assert.deepEqual([letzt.correct, letzt.final, letzt.review], [false, true, "teilweise"]);
  // „teilweise“ kann die Lehrkraft ändern
  const teil = repo.listAttemptsForAssignment(aid).find((a) => a.task_id === gespeichert[5].id && a.final)!;
  assert.ok("ok" in reviewAnswer(teil.id, "richtig", niko.id));
  // alles andere richtig
  for (const i of [1, 2, 3, 4, 6, 7]) {
    const r = await antworte(i, englischRichtigeAntwort(HAND[i])!);
    assert.equal(r.correct, true, HAND[i].category!);
  }
  const writing = await antworte(8, "My favourite club is the chess club.");
  assert.deepEqual([writing.correct, writing.pendingReview], [null, true]);
  const danach = JSON.stringify(sicht());
  assert.ok(!danach.includes('"pairs"') && !danach.includes('"belege"'));
});

test("Tafel: Fragen mit A bis D und die Wörter im Kasten; die Lösung nie am Schülergerät", async () => {
  const repo = await import("./repo");
  const { boardTask, boardTaskForStudent } = await import("./whiteboard-content");
  const wid = repo.createWorksheet({ title: "Tafel Englisch", subject: "Englisch", grade: 11, school_type: "Gymnasium", klasse: 7, topic: "", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [] }, [FRAGEN, KASTEN, WAHR_FALSCH]);
  const [mc, kasten, wf] = repo.listTasks(wid);
  const m = boardTask(mc);
  assert.match(m.prompt, /1 {2}Why did Ruth start the evening openings\?\n {4}A Young people needed a quiet place to study\./);
  assert.equal(m.options, null);
  assert.match(boardTask(kasten).prompt, /Box: built {2}· {2}every/);
  assert.match(boardTask(wf).solution!, /^Lösung: 1 False \(Every Thursday evening, the …\)/);
  for (const t of [mc, kasten, wf]) assert.equal("solution" in boardTaskForStudent(t), false);
});

// ---------- A4 und Mappe ----------

test("A4: True/False-Tabelle, Fragen mit Kästchen, Wörter im Kasten; die Lösung nur in der Lehrerfassung und auf der Lösungsseite", async () => {
  const { buildSheet, DEFAULTS, planTask } = await import("./arbeitsblatt");
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  for (const t of [WAHR_FALSCH, FRAGEN, MATCHING]) assert.deepEqual([planTask(t, "Englisch", DEFAULTS).lines], [0], t.category!);
  assert.equal(planTask(SCHREIBEN, "Englisch", DEFAULTS).lines, 22, "Zeilen für 200 Wörter plus 10 %");
  assert.ok(planTask(KURZ, "Englisch", DEFAULTS).gapsMm.every((mm) => mm >= 50), "Platz für vier Wörter");
  const tasks = [WAHR_FALSCH, FRAGEN, KASTEN, SCHREIBEN];
  const doc = buildSheet({ title: "Matura Englisch", subject: "Englisch", klasseLabel: "7. Klasse", topic: "", studentName: null, tasks }, () => null, DEFAULTS);
  const render = (o: Partial<typeof DEFAULTS>) => renderToStaticMarkup(createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Matura Englisch", ...o } }));
  const zahl = (html: string, s: string) => html.split(s).length - 1;

  const schueler = render({});
  assert.equal(zahl(schueler, 'class="ab-lese-title" lang="en">The Lantern Library</h2>'), 1, "der Text einmal, mit Titel");
  assert.equal(zahl(schueler, 'class="ab-absatz-nr"'), 4, "nummerierte Absätze");
  assert.ok(schueler.includes("First four words") && schueler.includes(">True</th>") && schueler.includes(">False</th>"));
  assert.equal(zahl(schueler, 'class="ab-box"'), 4 * 2 + 3 * 4, "True und False je Aussage, A bis D je Frage");
  assert.ok(schueler.includes('<p class="ab-wortkasten" lang="en"><span>built</span>'));
  assert.ok(!schueler.includes("✕"), "nichts angekreuzt");
  for (const geheim of ["Lösung", "Every Thursday evening, the …", "Task achievement"]) assert.ok(!schueler.includes(geheim), `Schülerblatt enthält ${geheim}`);

  const lehrer = render({ solutions: "lehrer", fassung: "lehrer" });
  assert.equal(zahl(lehrer, ">✕</span>"), 4 + 3, "die richtigen Kreuze");
  assert.ok(lehrer.includes("Every Thursday evening, the …"), "die ersten Wörter des Belegs");
  assert.ok(lehrer.includes("Task achievement"), "die Kriterien beim Writing");

  const seite = render({ solutions: "seite" });
  assert.ok(seite.includes("1 False (Every Thursday evening, the …) · 2 True (The idea came from …)"));
  assert.ok(seite.includes("1 A · 2 B · 3 C"));
  assert.ok(seite.includes("1 built · 2 grow · 3 every · 4 used"));
});

test("Mappe: die Wahl und die Belege des Schülers in der Tabelle, bei Fehlern das Richtige daneben", async () => {
  const { leseAntwort } = await import("./mappe");
  const { EnglischAntworten } = await import("../components/arbeitsblatt/EnglischMatura");
  assert.deepEqual(leseAntwort(WAHR_FALSCH, tf([0, 0, 1, 0], ["Every Thursday", "", "They bring", "One of"])), { art: "englisch", wahl: [0, 0, 1, 0], belege: ["Every Thursday", "", "They bring", "One of"] });
  assert.deepEqual(leseAntwort(FRAGEN, "[0,2,null]"), { art: "englisch", wahl: [0, 2, null], belege: [] });
  assert.deepEqual(leseAntwort(KASTEN, '["built","grow","every","used"]'), { art: "luecken", werte: ["built", "grow", "every", "used"] });
  const html = renderToStaticMarkup(
    createElement(EnglischAntworten, { task: WAHR_FALSCH, wahl: [0, 0, 1, 0], belege: ["Every Thursday", "She noticed that", "They bring their own", "One of them now"], richtig: { wahl: [1, 0, 1, 0], belege: ["", WAHR_FALSCH.answer.belege![1], "", ""] } }),
  );
  assert.ok(html.includes("← richtig: False"));
  assert.ok(html.includes("The idea came from …"), "der richtige Beleg neben dem, der nicht passt");
  assert.equal(html.split(">✕</span>").length - 1, 4);
  const mc = renderToStaticMarkup(createElement(EnglischAntworten, { task: FRAGEN, wahl: [0, 2, 2], richtig: { wahl: [0, 1, 2], belege: [] } }));
  assert.equal(mc.split("← richtig").length - 1, 1);
});
