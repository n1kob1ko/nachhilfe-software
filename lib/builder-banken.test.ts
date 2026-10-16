/**
 * Der Bankweg im Übungs-Builder (Phase 1 des Merges, Schritt 6): Fähigkeiten mit Bank
 * (`lib/ai/banken.ts`) bekommen ihre KI-Aufgaben in Bankform — dieselbe Aufgabe, die `bankItemTask`
 * (lib/generators.ts) aus demselben Eintrag bauen würde. Alles andere läuft unverändert über den
 * allgemeinen Auftrag (`generatePlanWithAI`), und was der Bankweg nicht liefert, holt der eingebaute
 * Generator. Eine geplante Kategorie, deren Formate die Bank nicht kennt, bekommt **keine** Bankaufgabe.
 *
 * Getestet mit einem ausgetauschten Transport: es gibt in dieser Umgebung keinen Schlüssel, und es geht
 * auch keine Anfrage hinaus. Es wird nichts erfunden — jede Antwort kommt aus der Testdatei.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { BANK_ANWEISUNG } from "./ai";
import { bankItemTask } from "./generators";
import { bankUsable } from "./banks";
import { checkAnswer } from "./tasks";
import type { BankId } from "./banks";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

type AIRequest = import("./ai/router").AIRequest;
type AIResult = import("./ai/providers/types").AIResult;
type BuilderSettings = import("./builder").BuilderSettings;

// ---------- die Fähigkeiten ----------
const ARTIKEL = "deutsch.grammatik.artikel";
const ADJEKTIV = "deutsch.grammatik.adjektivdeklination";
const PRAEPOSITIONEN = "deutsch.grammatik.praepositionen";
const PRAETERITUM = "deutsch.grammatik.praeteritum";
const PERFEKT = "deutsch.grammatik.perfekt";
const DASDASS = "deutsch.recht.dasdass";
const HAUPTGLIED = "deutsch.satz.hauptsatz-gliedsatz";
/** Eine Deutsch-Fähigkeit ohne Bank: für sie muss alles bleiben, wie es war. */
const ZEITEN = "deutsch.grammatik.zeiten";

const GENUS_OF: Record<string, string> = { der: "m", die: "f", das: "n" };

// ---------- gültige Bankeinträge je Bank (genau die Form der Dateien) ----------
const BANK_ITEMS: Record<BankId, unknown[]> = {
  artikel: [
    { word: "Hund", article: "der", translation: "dog", tags: ["Tiere"] },
    { word: "Sonne", article: "die", translation: "sun", tags: ["Natur"] },
    { word: "Auto", article: "das", translation: "car", tags: ["Verkehr"] },
  ],
  adjektivdeklination: [
    { prefix: "Wegen des stark", middle: " Regen", suffix: " wurde das Spiel abgesagt.", options1: ["-e", "-er", "-en", "-em"], correct1: "-en", options2: ["-", "-e", "-en", "-s"], correct2: "-s", solution: "Wegen des starken Regens wurde das Spiel abgesagt." },
    { prefix: "Ich sehe den klein", middle: " Hund", suffix: " im Garten.", options1: ["-e", "-er", "-en", "-em"], correct1: "-en", options2: ["-", "-e", "-en", "-s"], correct2: "-", solution: "Ich sehe den kleinen Hund im Garten." },
  ],
  praepositionen: [
    { prefix: "Das Buch liegt auf ", noun: "Tisch", article: "der", suffix: ".", options: ["dem", "der", "den", "das"], correct: "dem", kasus: "Dativ", solution: "Das Buch liegt auf dem Tisch." },
    { prefix: "Ich hänge das Bild an ", noun: "Wand", article: "die", suffix: ".", options: ["die", "der", "dem", "den"], correct: "die", kasus: "Akkusativ", solution: "Ich hänge das Bild an die Wand." },
  ],
  praeteritum: [
    { q: "Gestern ___ ich in die Schule.", blanks: [["ging"]], solution: "gehen ist stark: ich ging", hint: "Welche Zeitform verlangt „gestern“?", errors: { gehte: "schwache Form bei starkem Verb" } },
    { q: "Früher ___ er jeden Tag Vokabeln.", blanks: [["lernte"]], solution: "schwache Verben bilden -te: er lernte", hint: "Schwache Verben bekommen -te." },
  ],
  perfekt: [
    { q: "Wir ___ gestern lange ___.", blanks: [["haben"], ["gelernt"]], solution: "lernen bildet das Perfekt mit haben: wir haben gelernt", hint: "Hilfsverb und Partizip II stehen getrennt.", errors: { "hat gelernt": "falsches Hilfsverb" } },
    { q: "Sie ___ letzten Sommer nach Wien ___.", blanks: [["ist"], ["gefahren"]], solution: "fahren bildet das Perfekt mit sein: sie ist gefahren", hint: "Bewegungsverben bilden das Perfekt mit sein." },
  ],
  "das-dass": [
    { q: "Ich hoffe, ___ du kommst.", blanks: [["dass"]], solution: "„dass“ leitet den Nebensatz ein: Ich hoffe, dass du kommst.", hint: "Mach die Ersatzprobe mit „dieses/welches“.", errors: { das: "Ersatzprobe mit „dieses“ nicht möglich" }, explanation: "„dass“ ist eine Konjunktion und leitet den Nebensatz ein." },
    { q: "___ Buch, ___ ich gelesen habe, war spannend.", blanks: [["Das"], ["das"]], solution: "„Das“ ist Artikel, „das“ ist Pronomen.", hint: "Ersatzprobe mit „dieses“.", explanation: "Beides schreibt sich „das“; nur die Konjunktion heißt „dass“." },
  ],
  "hauptsatz-gliedsatz": [
    { parts: [{ text: "Ich gehe heute früh schlafen", type: "HS" }, { text: "weil ich morgen eine Schularbeit habe", type: "GS" }] },
    { parts: [{ text: "Der Hund bellt laut", type: "HS" }, { text: "obwohl er gerade gefressen hat", type: "GS" }] },
  ],
};

/** Fähigkeit und geplante Kategorie, unter der jede Bank erreicht werden muss. */
const BANK_CASES: [BankId, string, string][] = [
  ["artikel", ARTIKEL, "grammatik"],
  ["adjektivdeklination", ADJEKTIV, "lueckentext"],
  ["praepositionen", PRAEPOSITIONEN, "lueckentext"],
  ["praeteritum", PRAETERITUM, "lueckentext"],
  ["perfekt", PERFEKT, "lueckentext"],
  ["das-dass", DASDASS, "lueckentext"],
  ["hauptsatz-gliedsatz", HAUPTGLIED, "grammatik"],
];

// ---------- der ausgetauschte Transport ----------
/** Antwort, die der Anbieter nicht verwerten kann (Schema verletzt): der Bankweg meldet dann einen Fehler. */
const NO_ANSWER = Symbol("keine verwertbare Antwort");

const usage = { input: 900, output: 400, cacheWrite: 0, cacheRead: 0 };

/** Ersetzt die Anbieter; `answer` bekommt jede Anfrage und liefert die rohe Antwort (kein Netzzugriff). */
async function withStub<T>(answer: (r: AIRequest) => unknown, run: () => Promise<T>): Promise<{ out: T; calls: AIRequest[] }> {
  const router = await import("./ai/router");
  router.resetRouter();
  const calls: AIRequest[] = [];
  router.setTransport(async (r): Promise<AIResult> => {
    calls.push(r);
    const raw = answer(r);
    if (raw === NO_ANSWER) return { parsed: null, refusal: false, failure: "schema", model: r.model, usage };
    return { parsed: r.schema.parse(raw), refusal: false, model: r.model, usage, costUsd: 0.001 };
  });
  try {
    return { out: await run(), calls };
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
}

/** Der Bankauftrag ist an der Systemanweisung erkennbar (BANK_SYSTEM, lib/ai/banken.ts). */
const isBank = (r: AIRequest) => r.system.includes("Aufgabenbanken");
/** Wie viele Einträge der Bankauftrag verlangt. */
const bankCount = (r: AIRequest) => Number(/Erstelle jetzt (\d+)/.exec(String(r.content))?.[1] ?? 0);
/** Die Fähigkeiten des allgemeinen Auftrags, in der Reihenfolge des Plans. */
const askedPlan = (r: AIRequest) =>
  [...String(r.content).matchAll(/^\d+\. category=(\S+)(?: \([^)]*\))?(?:, format=[^,]+)?, skill_id=(\S+)$/gm)].map((m) => ({ category: m[1], skillId: m[2] }));

/** Alle Felder, die das Antwortschema des allgemeinen Auftrags verlangt (WorksheetSchema). */
const AI_TASK_BASE = {
  category: "lueckentext", format: "cloze", skill_ids: [] as string[], topic: "Zeitformen", difficulty: "mittel",
  prompt: "", passage: null, options: null, correct_option: null, accepted_answers: null, numeric: false, blanks: null,
  sample_answer: null, steps: null, case_sensitive: true, faulty_text: null, corrected_text: null, text_errors: null,
  answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null,
  criteria: ["Die Antwort passt zum Satz."], solution: "Gestern ging ich in die Schule.", solution_steps: [],
  estimated_time_sec: 60, hints: ["Achte auf die Zeitform."], common_errors: [],
};

/** Eine gültige Antwort des allgemeinen Auftrags für einen geplanten Aufgabentyp. */
function genericTask(category: string, skillId: string, marker: string): Record<string, unknown> {
  const base = { ...AI_TASK_BASE, category, skill_ids: [skillId], prompt: marker };
  switch (category) {
    case "lueckentext":
    case "rechtschreibung":
      return { ...base, format: "cloze", prompt: `${marker} Gestern ___ ich in die Schule.`, blanks: [["ging"]] };
    case "korrigieren":
      return { ...base, format: "fix", faulty_text: "Ich habe gestern ein Buch gelest.", corrected_text: "Ich habe gestern ein Buch gelesen.", text_errors: [{ wrong: "gelest", right: "gelesen", label: "falsche Verbform", error_type: null }], solution: "gelest → gelesen" };
    case "offen":
      return { ...base, format: "free", sample_answer: "Das gebeugte Verb steht im Gliedsatz am Ende.", answer_lines: 3, solution: "Das gebeugte Verb steht im Gliedsatz am Ende." };
    default:
      return { ...base, format: "mc", options: ["der", "die", "das"], correct_option: 0, solution: "der Hund bellt laut." };
  }
}

/** Die Antwort des allgemeinen Auftrags: je Planzeile eine Aufgabe in ihrem Typ. */
const genericAnswer = (r: AIRequest) => ({ tasks: askedPlan(r).map((p, i) => genericTask(p.category, p.skillId, `KI-Aufgabe ${i + 1}`)) });

const settings = (o: Partial<BuilderSettings> = {}): BuilderSettings => ({
  studentId: null, subject: "Deutsch", schoolType: "Gymnasium", klasse: 3, skillIds: [ARTIKEL],
  difficulty: "mittel", count: 3, categories: [], focus: "", useAI: true, title: "", ...o,
});

// ---------- jede Bank erreicht den Bankweg und liefert die Form des Generators ----------
for (const [bank, skillId, category] of BANK_CASES) {
  test(`${bank}: die KI-Einträge werden zu genau der Aufgabe, die der eingebaute Generator daraus baut`, async () => {
    const builder = await import("./builder");
    const { out, calls } = await withStub(
      (r) => (isBank(r) ? BANK_ITEMS[bank].slice(0, bankCount(r)) : genericAnswer(r)),
      () => builder.generateTasks(settings({ skillIds: [skillId], categories: [category], count: 2 }), null),
    );
    assert.equal(calls.length, 1, "beide Plätze kommen aus dem Bankweg — der allgemeine Auftrag wird nicht gebraucht");
    assert.ok(isBank(calls[0]), "eine Bankanfrage");
    assert.ok(String(calls[0].content).startsWith(BANK_ANWEISUNG[bank]), "die Anweisung dieser Bank steht im Auftrag");
    assert.match(String(calls[0].content), /Erstelle jetzt 2 Einträge/);

    assert.equal(out.source, "ki");
    assert.equal(out.aiError, undefined, "alles kam von der KI, also keine Meldung");
    assert.equal(out.tasks.length, 2);
    // dieselbe Umsetzung wie `bankItemTask` (der eingebaute Generator kennt keinen zweiten Aufbau)
    const expected = bankItemTask(bank, BANK_ITEMS[bank][0] as never, "mittel", () => 0.5)!;
    for (const t of out.tasks) {
      assert.equal(t.type, expected.type, `${bank}: Antwortformat`);
      assert.equal(t.category, category, `${bank}: der Plan bestimmt den Aufgabentyp`);
      assert.equal(t.skillId, skillId, `${bank}: Fähigkeit`);
      assert.ok(t.skillIds!.includes(skillId), `${bank}: die Fähigkeit steht auch in skillIds`);
      assert.equal(t.sourceType, "ki", `${bank}: Herkunft`);
      assert.equal(t.difficulty, "mittel");
      assert.equal(builder.checkTask(t), null, `${bank}: unvollständig: ${t.prompt}`);
    }
    // Teilfähigkeit: die Elternfähigkeit kommt wie bei jeder anderen Aufgabe dazu (Lernstand, lib/builder.ts)
    if (skillId === PRAEPOSITIONEN) for (const t of out.tasks) assert.ok(t.skillIds!.includes("deutsch.grammatik.faelle"), "die Elternfähigkeit fehlt in skillIds");
    assert.equal(out.tasks[0].prompt, expected.prompt, `${bank}: Aufgabenstellung wie aus dem Bankeintrag`);
    assert.deepEqual(out.tasks[0].answer.blanks, expected.answer.blanks, `${bank}: Lücken wie aus dem Bankeintrag`);
    assert.equal(out.tasks[0].answer.mode, expected.answer.mode);
  });
}

// ---------- der Genus-Abgleich und die Form der Artikel-Aufgabe ----------
test("Artikel: Bankform mit der/die/das, data.genus und der Lösung unter den Optionen — ohne Generator", async () => {
  const builder = await import("./builder");
  const { out, calls } = await withStub(
    (r) => (isBank(r) ? BANK_ITEMS.artikel.slice(0, bankCount(r)) : genericAnswer(r)),
    () => builder.generateTasks(settings({ skillIds: [ARTIKEL], categories: ["grammatik"], count: 3 }), null),
  );
  assert.equal(calls.length, 1, "nur die Bankanfrage");
  assert.equal(out.tasks.length, 3);
  // genau die drei Wörter der KI — der eingebaute Generator würde andere Nomen aus der Datei ziehen
  assert.deepEqual(out.tasks.map((t) => t.prompt), ["Welchen Artikel hat das Nomen „Hund“?", "Welchen Artikel hat das Nomen „Sonne“?", "Welchen Artikel hat das Nomen „Auto“?"]);
  for (const t of out.tasks) {
    assert.equal(t.type, "mc");
    assert.equal(t.category, "grammatik");
    assert.deepEqual([...t.data.options!].sort(), ["das", "der", "die"], "die drei Artikel stehen zur Auswahl");
    const article = t.data.options![t.answer.correct!];
    assert.equal(t.data.genus, GENUS_OF[article], "data.genus für die Färbung (D10)");
    assert.equal(checkAnswer(t, String(t.answer.correct)).correct, true, "die eigene Lösung wird angenommen");
    for (const e of t.errorMap) assert.equal(checkAnswer(t, e.answer).correct, false, "die typischen Fehler werden abgelehnt");
  }
});

// ---------- eine Fähigkeit ohne Bank bleibt unberührt ----------
test("eine Fähigkeit ohne Bank läuft unverändert über den allgemeinen KI-Weg", async () => {
  const builder = await import("./builder");
  const { out, calls } = await withStub(
    (r) => {
      assert.ok(!isBank(r), "für eine Fähigkeit ohne Bank darf keine Bankanfrage hinausgehen");
      return genericAnswer(r);
    },
    () => builder.generateTasks(settings({ skillIds: [ZEITEN], categories: ["lueckentext"], count: 2 }), null),
  );
  assert.equal(calls.length, 1);
  const prompt = String(calls[0].content);
  assert.match(prompt, /Erstelle genau 2 Aufgaben/);
  assert.match(prompt, /category=lueckentext/);
  assert.ok(prompt.includes(ZEITEN), "die gewählte Fähigkeit steht im Auftrag");
  assert.equal(out.source, "ki");
  assert.equal(out.aiError, undefined);
  assert.deepEqual(askedPlan(calls[0]), [{ category: "lueckentext", skillId: ZEITEN }, { category: "lueckentext", skillId: ZEITEN }]);
  assert.equal(out.tasks.length, 2);
  for (const t of out.tasks) {
    assert.equal(t.type, "cloze");
    assert.equal(t.category, "lueckentext");
    assert.equal(t.skillId, ZEITEN);
    assert.equal(t.sourceType, "ki");
    assert.equal(builder.checkTask(t), null);
  }
});

// ---------- der Bankweg degradiert, statt zu brechen ----------
test("ein Fehler im Bankweg fällt auf den allgemeinen KI-Weg zurück", async () => {
  const builder = await import("./builder");
  const { out, calls } = await withStub(
    (r) => (isBank(r) ? NO_ANSWER : genericAnswer(r)),
    () => builder.generateTasks(settings({ skillIds: [ARTIKEL], categories: ["grammatik"], count: 2 }), null),
  );
  assert.equal(calls.length, 2, "erst der Bankweg, dann derselbe Platz im allgemeinen Auftrag");
  assert.ok(isBank(calls[0]));
  assert.ok(!isBank(calls[1]));
  assert.deepEqual(askedPlan(calls[1]), [{ category: "grammatik", skillId: ARTIKEL }, { category: "grammatik", skillId: ARTIKEL }], "genau die Plätze, die der Bankweg offen ließ");
  assert.equal(out.source, "ki");
  assert.equal(out.aiError, undefined, "der allgemeine Weg hat geliefert");
  assert.equal(out.tasks.length, 2);
  for (const t of out.tasks) {
    assert.equal(t.sourceType, "ki");
    assert.equal(t.category, "grammatik");
    assert.equal(t.skillId, ARTIKEL);
    assert.equal(builder.checkTask(t), null);
  }
});

test("unbrauchbare Bankeinträge (kein Fehler, aber keine Aufgabe) fallen ebenfalls auf den allgemeinen Weg", async () => {
  const builder = await import("./builder");
  // ohne article/genus: `parseAiBankItem` lehnt den Eintrag ab, es wird aber kein Fehler gemeldet
  const { out, calls } = await withStub(
    (r) => (isBank(r) ? [{ word: "Hund", tags: ["Tiere"] }] : genericAnswer(r)),
    () => builder.generateTasks(settings({ skillIds: [ARTIKEL], categories: ["grammatik"], count: 2 }), null),
  );
  assert.equal(calls.length, 2);
  assert.ok(isBank(calls[0]));
  assert.ok(!isBank(calls[1]));
  assert.equal(out.tasks.length, 2);
  for (const t of out.tasks) {
    assert.equal(t.sourceType, "ki", "die Aufgaben kommen aus dem allgemeinen Weg");
    assert.equal(t.category, "grammatik");
    assert.equal(t.skillId, ARTIKEL);
    assert.equal(builder.checkTask(t), null);
  }
});

test("wenn auch der allgemeine Weg nichts liefert, füllt der Generator — und der Grund steht in aiError", async () => {
  const builder = await import("./builder");
  const { out, calls } = await withStub(
    (r) => (isBank(r) ? NO_ANSWER : { tasks: [] }),
    () => builder.generateTasks(settings({ skillIds: [ARTIKEL], categories: ["grammatik"], count: 2 }), null),
  );
  assert.equal(calls.length, 4, "zwei Runden, je Bankweg und allgemeiner Auftrag");
  assert.equal(out.source, "generator");
  assert.match(out.aiError ?? "", /verwertbare Antwort/, "der Grund des Bankwegs wird genannt");
  assert.equal(out.tasks.length, 2, "die Übung ist trotzdem vollständig");
  const bank = bankUsable("artikel");
  for (const t of out.tasks) {
    assert.notEqual(t.sourceType, "ki");
    assert.equal(t.type, "mc");
    assert.equal(t.category, "grammatik");
    assert.equal(t.skillId, ARTIKEL);
    assert.ok(bank.some((i) => t.prompt.includes(`„${i.word}“`)), `kein Bankeintrag in „${t.prompt}“`);
    assert.equal(builder.checkTask(t), null);
  }
});

test("ein teilweise gescheiterter Bankweg steht neben dem Hinweis auf die ohne KI erstellten Aufgaben", async () => {
  const builder = await import("./builder");
  // der allgemeine Weg liefert nur für den ersten Auftrag etwas; der zweite Platz bleibt dem Generator
  const out = (await withStub(
    (r) => (isBank(r) ? NO_ANSWER : askedPlan(r).length > 1 ? { tasks: [genericTask("grammatik", ARTIKEL, "KI-Aufgabe 1")] } : { tasks: [] }),
    () => builder.generateTasks(settings({ skillIds: [ARTIKEL], categories: ["grammatik"], count: 2 }), null),
  )).out;
  assert.match(out.aiError ?? "", /verwertbare Antwort/, "der Grund des Bankwegs steht dabei");
  assert.match(out.aiError ?? "", /kam von der KI nicht im gewünschten Typ/, "und der bisherige Hinweis bleibt");
  assert.equal(out.tasks.filter((t) => t.sourceType === "ki").length, 1);
  assert.equal(out.tasks.length, 2, "die Übung ist trotzdem vollständig");
  for (const t of out.tasks) {
    assert.equal(t.category, "grammatik");
    assert.equal(t.skillId, ARTIKEL);
    assert.equal(builder.checkTask(t), null);
  }
});

// ---------- der Plan entscheidet: nur passende Kategorien bekommen eine Bankaufgabe ----------
test("die geplante Kategorie wird eingehalten: „Lückentext“ bekommt für Artikel keine Auswahlaufgabe aus der Bank", async () => {
  const builder = await import("./builder");
  const { out, calls } = await withStub(
    (r) => {
      assert.ok(!isBank(r), "Artikel (Bankform mc) passt nicht in eine Kategorie, die nur cloze erlaubt");
      return genericAnswer(r);
    },
    () => builder.generateTasks(settings({ skillIds: [ARTIKEL], categories: ["lueckentext"], count: 2 }), null),
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(askedPlan(calls[0]), [{ category: "lueckentext", skillId: ARTIKEL }, { category: "lueckentext", skillId: ARTIKEL }]);
  assert.equal(out.tasks.length, 2);
  for (const t of out.tasks) {
    assert.equal(t.type, "cloze", "die Kategorie „Lückentext“ lässt nur cloze zu");
    assert.equal(t.category, "lueckentext");
    assert.equal(t.sourceType, "ki");
    assert.equal(builder.checkTask(t), null);
  }
});

test("die geplante Kategorie wird eingehalten: „Grammatik“ bekommt für Präteritum keinen Lückentext aus der Bank", async () => {
  const builder = await import("./builder");
  const { out, calls } = await withStub(
    (r) => {
      assert.ok(!isBank(r), "Präteritum (Bankform cloze) passt nicht in eine Kategorie, die nur mc/grammar erlaubt");
      return genericAnswer(r);
    },
    () => builder.generateTasks(settings({ skillIds: [PRAETERITUM], categories: ["grammatik"], count: 2 }), null),
  );
  assert.equal(calls.length, 1);
  assert.equal(out.tasks.length, 2);
  for (const t of out.tasks) {
    assert.equal(t.type, "mc");
    assert.equal(t.category, "grammatik");
    assert.equal(t.sourceType, "ki");
    assert.equal(builder.checkTask(t), null);
  }
});

test("bei gemischten Aufgaben entscheidet der Plan je Platz: nur die passende Kategorie geht in die Bank", async () => {
  const builder = await import("./builder");
  const { out, calls } = await withStub(
    (r) => (isBank(r) ? BANK_ITEMS.artikel.slice(0, bankCount(r)) : genericAnswer(r)),
    () => builder.generateTasks(settings({ skillIds: [ARTIKEL], categories: [], count: 4 }), null),
  );
  // mixFor("deutsch.grammatik.artikel") = korrigieren, lueckentext, offen, grammatik — nur grammatik lässt mc zu
  const bankCalls = calls.filter(isBank);
  const genericCalls = calls.filter((r) => !isBank(r));
  assert.equal(bankCalls.length, 1, "genau eine Bankanfrage");
  assert.equal(bankCount(bankCalls[0]), 1, "nur der eine Platz, dessen Kategorie mc erlaubt");
  assert.equal(genericCalls.length, 1, "die übrigen drei Plätze gehen in den allgemeinen Auftrag");
  assert.deepEqual(askedPlan(genericCalls[0]).map((p) => p.category), ["korrigieren", "lueckentext", "offen"]);
  assert.equal(out.tasks.length, 4);
  // der Bankplatz: mc mit der Kategorie des Plans
  const fromBank = out.tasks.filter((t) => t.prompt.startsWith("Welchen Artikel hat das Nomen"));
  assert.equal(fromBank.length, 1);
  assert.equal(fromBank[0].type, "mc");
  assert.equal(fromBank[0].category, "grammatik");
  // die übrigen: die Typen des Plans, nicht die Form der Bank
  assert.deepEqual([...new Set(out.tasks.filter((t) => t !== fromBank[0]).map((t) => t.category))].sort(), ["korrigieren", "lueckentext", "offen"]);
  for (const t of out.tasks) assert.equal(builder.checkTask(t), null, t.prompt);
});
