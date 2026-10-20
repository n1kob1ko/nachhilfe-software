/**
 * Prüft die KI-Einträge für die Aufgabenbanken (Phase 1 des Merges, Schritte 6 und 7):
 * die Anweisungen aus `Artikel Trainer/AI_prompts.md`, die Prüfung gegen das Bankschema, den
 * Genus-Abgleich der Artikel-Einträge über `lib/german-nouns.ts` und den Weg von einem KI-Eintrag zur
 * Aufgabe. Dazu der Nachweis, dass ein Eintrag mit `review: true` in der Datei bleibt und trotzdem aus
 * den Übungen verschwindet.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { BANK_IDS, bankItems, bankStats, bankUsable, useBankContentForTest, type ArtikelItem } from "./banks";
import { bankItemTask, generateBuiltIn } from "./generators";
import { checkAnswer } from "./tasks";
import { ARTIKEL_ANWEISUNG, ARTIKEL_ARTICLES, ADJEKTIVDEKLINATION_ANWEISUNG, BANK_ANWEISUNG, BANK_SKILL, DAS_DASS_ANWEISUNG, HAUPTSATZ_GLIEDSATZ_ANWEISUNG, PRAEPOSITIONEN_ANWEISUNG, PRAETERITUM_ANWEISUNG, PERFEKT_ANWEISUNG, aiBankItemToDraft, aiBankItemsToDrafts, artikelGenusAbgleich, bankArraySchema, bankItemSchema, bankOfSkill, buildBankPrompt, generateBankItemsWithAI } from "./ai/banken";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

/** Ein gültiger Artikel-Eintrag in Bankform. */
const HUND: ArtikelItem = { word: "Hund", article: "der", translation: "dog", tags: ["Tiere"] };
/** Ein gültiger Präteritum-Eintrag in Bankform. */
const GING = { q: "Gestern ___ ich in die Schule. (gehen)", blanks: [["ging"]], solution: "gehen ist stark: ich ging", hint: "Welche Zeitform verlangt „gestern“?", errors: { gehte: "schwache Form bei starkem Verb" } };

async function fakeRouter<T>(answer: (prompt: string, schema: { parse: (x: unknown) => unknown }, model: string) => unknown, run: (router: typeof import("./ai/router")) => Promise<T>): Promise<T> {
  const router = await import("./ai/router");
  router.setTransport(async (p) => {
    const prompt = typeof p.content === "string" ? p.content : "";
    return { parsed: p.schema.parse(answer(prompt, p.schema as { parse: (x: unknown) => unknown }, p.model)), refusal: false, model: p.model, usage: { input: 900, output: 400, cacheWrite: 0, cacheRead: 0 }, costUsd: 0.001 };
  });
  try {
    return await run(router);
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
}

// ---------- die Anweisungen ----------

test("für jede Bank gibt es eine Anweisung, und die sechs Fähigkeiten aus Phase 1 haben eine Bank", () => {
  for (const [bank, skill] of Object.entries(BANK_SKILL)) {
    assert.ok(BANK_ANWEISUNG[bank as keyof typeof BANK_ANWEISUNG].length > 200, `${bank}: Anweisung fehlt oder ist zu kurz`);
    assert.equal(bankOfSkill(skill), bank, `${skill}: keine Bank`);
    assert.equal(bankItemSchema(bank as keyof typeof BANK_SKILL).safeParse({}).success, false, `${bank}: leeres Objekt gilt als gültig`);
    assert.equal(bankArraySchema(bank as keyof typeof BANK_SKILL).safeParse([]).success, true);
  }
  assert.equal(bankOfSkill("mathe.brueche.kuerzen"), null, "keine Bank für Mathematik");
  // die Banken der sechs Fähigkeiten sind alle dabei
  for (const id of ["deutsch.grammatik.artikel", "deutsch.grammatik.adjektivdeklination", "deutsch.grammatik.praepositionen", "deutsch.grammatik.praeteritum", "deutsch.grammatik.perfekt", "deutsch.satz.hauptsatz-gliedsatz"])
    assert.ok(Object.values(BANK_SKILL).includes(id), `${id} fehlt`);
});

test("die drei Vorlagen aus AI_prompts.md stehen vollständig in den Anweisungen", () => {
  // Artikel: Rolle, Aufgabe, Mischung der Artikel, englische Übersetzung, kein Plural, nur JSON
  assert.match(ARTIKEL_ANWEISUNG, /Experte für die deutsche Sprache/);
  assert.match(ARTIKEL_ANWEISUNG, /Mischung aus den Artikeln "der", "die" und "das"/);
  assert.match(ARTIKEL_ANWEISUNG, /präzise englische Übersetzung/);
  assert.match(ARTIKEL_ANWEISUNG, /kein Plural/i);
  assert.match(ARTIKEL_ANWEISUNG, /valides JSON-Array/);
  for (const field of ["word", "article", "translation", "tags"]) assert.ok(ARTIKEL_ANWEISUNG.includes(`"${field}"`), `Artikel: Feld ${field} fehlt`);
  // Adjektivdeklination: zwei Lücken, die vier Optionen, das Beispiel der Vorlage, `solution` statt `translation`
  assert.match(ADJEKTIVDEKLINATION_ANWEISUNG, /Deutsch als Fremdsprache \(DaF\)/);
  assert.match(ADJEKTIVDEKLINATION_ANWEISUNG, /zwei Lücken/);
  assert.match(ADJEKTIVDEKLINATION_ANWEISUNG, /Wegen des stark/);
  assert.match(ADJEKTIVDEKLINATION_ANWEISUNG, /\["-", "-e", "-en", "-s"\]/);
  for (const field of ["prefix", "middle", "suffix", "options1", "correct1", "options2", "correct2", "solution"]) assert.ok(ADJEKTIVDEKLINATION_ANWEISUNG.includes(field), `Adjektivdeklination: Feld ${field} fehlt`);
  // Präpositionen: eine Lücke, Kasus, vier Optionen — aber das Farbfeld der Vorlage nicht mehr
  assert.match(PRAEPOSITIONEN_ANWEISUNG, /Wechselpräpositionen/);
  assert.match(PRAEPOSITIONEN_ANWEISUNG, /Das Buch liegt auf/);
  assert.match(PRAEPOSITIONEN_ANWEISUNG, /"kasus": "Dativ"/);
  for (const field of ["prefix", "noun", "article", "suffix", "options", "correct", "kasus", "solution"]) assert.ok(PRAEPOSITIONEN_ANWEISUNG.includes(field), `Präpositionen: Feld ${field} fehlt`);
  assert.ok(!PRAEPOSITIONEN_ANWEISUNG.includes("noun_color"), "das Farbfeld der Vorlage gehört nicht in die Bank (D10)");
  assert.ok(!PRAEPOSITIONEN_ANWEISUNG.includes("#3b82f6"), "die Farbwerte der Vorlage gehören nicht in die Bank (D10)");
  // die drei weiteren Banken der Phase verlangen ihre Bankfelder
  for (const feld of ["- q:", "- blanks:", "- solution:", "- hint:"]) assert.ok(PRAETERITUM_ANWEISUNG.includes(feld), `Präteritum: Feld ${feld} fehlt`);
  assert.match(PRAETERITUM_ANWEISUNG, /starke Verben/);
  assert.match(PERFEKT_ANWEISUNG, /Partizip II/);
  assert.match(PERFEKT_ANWEISUNG, /"sein"/);
  assert.match(DAS_DASS_ANWEISUNG, /Ersatzprobe/);
  assert.ok(DAS_DASS_ANWEISUNG.includes("- explanation:"), "das/dass: die Begründung (explanation) fehlt");
  assert.match(HAUPTSATZ_GLIEDSATZ_ANWEISUNG, /"type": "HS"/);
  assert.match(HAUPTSATZ_GLIEDSATZ_ANWEISUNG, /Gliedsatz kann nicht allein stehen/);
  assert.ok(HAUPTSATZ_GLIEDSATZ_ANWEISUNG.includes("parts"));
  // die drei Artikel der Bank stehen in der Anweisung
  for (const a of ARTIKEL_ARTICLES) assert.ok(ARTIKEL_ANWEISUNG.includes(`"${a}"`), `Artikel ${a} fehlt`);
});

test("buildBankPrompt: Anzahl, Thema, Formverbot und die schon vorhandenen Einträge", () => {
  const prompt = buildBankPrompt("praepositionen", { count: 7, topic: "Küche", avoid: ["Das Buch liegt auf ___ Tisch."] });
  assert.ok(prompt.startsWith(PRAEPOSITIONEN_ANWEISUNG), "die Anweisung steht vollständig am Anfang");
  assert.match(prompt, /Erstelle jetzt 7 Einträge zum Thema „Küche“/);
  assert.match(prompt, /genau "Küche"/);
  assert.match(prompt, /Das Buch liegt auf ___ Tisch\./);
  assert.match(prompt, /Antworte ausschließlich mit dem JSON-Array\./);
  // die Platzhalter der Vorlage werden ersetzt, nicht wörtlich ausgegeben
  for (const bank of Object.keys(BANK_ANWEISUNG) as (keyof typeof BANK_ANWEISUNG)[]) {
    const p = buildBankPrompt(bank, { count: 3 });
    assert.ok(!p.includes("[HIER"), `${bank}: Platzhalter der Vorlage steht noch im Auftrag`);
    assert.match(p, /Erstelle jetzt 3 Einträge/);
    assert.match(p, /Thema/);
  }
  assert.match(buildBankPrompt("artikel", { count: 1 }), /Erstelle jetzt 1 Eintrag\b/);
});

// ---------- das Bankschema entscheidet ----------

test("ein KI-Eintrag, der das Bankschema verletzt, wird abgelehnt", () => {
  const gut = aiBankItemToDraft("artikel", HUND, { difficulty: "mittel" });
  assert.ok(gut, "ein gültiger Eintrag wird angenommen");
  assert.equal(gut.type, "mc");
  assert.equal(gut.sourceType, "ki");

  const faelle: [string, string, unknown][] = [
    ["fehlendes Pflichtfeld (tags)", "artikel", { word: "Hund", article: "der", translation: "dog" }],
    ["zusätzliches Feld", "artikel", { ...HUND, note: "passt schon" }],
    ["unbekannter Artikel", "artikel", { ...HUND, article: "ein" }],
    // Ein Plural ist nur erkennbar, wenn das Modell ihn mitteilt („(pl)“) — german-nouns hat bewusst
    // kein Wörterbuch und liest „die“ als Femininum (siehe lib/german-nouns.ts).
    ["Plural", "artikel", { word: "die Kinder (pl)", article: "die", tags: ["Prüfung"] }],
    ["Lückenzahl passt nicht", "praeteritum", { q: "Gestern ___ ich ___ Hause.", blanks: [["ging"]], solution: "x", hint: "y" }],
    ["Lösung fehlt in den Optionen", "praepositionen", { prefix: "Das Buch liegt auf ", noun: "Tisch", article: "der", suffix: ".", options: ["der", "das", "den"], correct: "dem", kasus: "Dativ", solution: "x" }],
    ["correct1 fehlt in options1", "adjektivdeklination", { prefix: "Wegen des stark", middle: " Regen", suffix: " wurde abgesagt.", options1: ["-e", "-er", "-en"], correct1: "-em", options2: ["-s"], correct2: "-s", solution: "x" }],
    ["kein HS in den Teilen", "hauptsatz-gliedsatz", { parts: [{ text: "a", type: "GS" }, { text: "b", type: "GS" }] }],
    ["leeres Objekt", "perfekt", {}],
    ["kein Objekt", "perfekt", "Ich habe gelernt."],
  ];
  for (const [name, bank, raw] of faelle) {
    const warum: string[] = [];
    const draft = aiBankItemToDraft(bank as keyof typeof BANK_SKILL, raw, { difficulty: "mittel", why: (r) => warum.push(r) });
    assert.equal(draft, null, `${name}: hätte abgelehnt werden müssen`);
    assert.equal(warum.length, 1, `${name}: kein Grund gemeldet`);
    assert.ok(warum[0].length > 5, `${name}: Grund zu kurz: ${warum[0]}`);
  }
});

test("aus gültigen KI-Einträgen werden Aufgaben in der Form des eingebauten Generators", () => {
  const artikel = aiBankItemToDraft("artikel", HUND, { difficulty: "schwer" })!;
  assert.equal(artikel.type, "mc");
  assert.equal(artikel.skillId, "deutsch.grammatik.artikel");
  assert.equal(artikel.difficulty, "schwer");
  assert.deepEqual([...artikel.data.options!].sort(), ["das", "der", "die"]);
  assert.equal(artikel.data.genus, "m", "data.genus für die Färbung (D10)");
  assert.equal(artikel.data.options![artikel.answer.correct!], "der");
  assert.equal(checkAnswer(artikel, String(artikel.answer.correct)).correct, true, "die eigene Lösung wird angenommen");
  for (const e of artikel.errorMap) assert.equal(checkAnswer(artikel, e.answer).correct, false, "die typischen Fehler werden abgelehnt");

  const praeteritum = aiBankItemToDraft("praeteritum", GING, { difficulty: "mittel" })!;
  assert.equal(praeteritum.type, "cloze");
  assert.equal(praeteritum.skillId, "deutsch.grammatik.praeteritum");
  assert.equal(praeteritum.answer.mode, "exact");
  assert.equal(checkAnswer(praeteritum, JSON.stringify(["ging"])).correct, true);
  assert.equal(checkAnswer(praeteritum, JSON.stringify(["gehte"])).errorLabel, "schwache Form bei starkem Verb");

  // derselbe Weg wie `bankItemTask` direkt: kein zweiter Aufbau der Aufgabe
  const direkt = bankItemTask("artikel", HUND, "mittel", () => 0.5)!;
  assert.equal(direkt.type, "mc");
  assert.equal(direkt.prompt, `Welchen Artikel hat das Nomen „Hund“?`);
  // Lückentexte der Banken laufen über dieselbe Umsetzung wie ihre Generatoren
  assert.equal(bankItemTask("das-dass", { q: "Ich hoffe, ___ du kommst.", blanks: [["dass"]], solution: "x", hint: "y", explanation: "Nebensatz" }, "mittel")!.skillId, "deutsch.recht.dasdass");

  const gemischt = aiBankItemsToDrafts("artikel", [HUND, { word: "Sonne", article: "die" }, { word: "Haus", article: "das", tags: ["Allgemein"] }], { difficulty: "mittel" });
  assert.equal(gemischt.drafts.length, 2);
  assert.equal(gemischt.rejected.length, 1);
  assert.match(gemischt.rejected[0], /artikel: /);
});

// ---------- Genus-Abgleich über german-nouns (nur wenn ein Geschlecht dasteht) ----------

test("Artikel: der Genus-Abgleich stimmt mit german-nouns überein und rät nie", () => {
  // stimmig: das Geschlecht steht als Artikel da
  assert.deepEqual(artikelGenusAbgleich(HUND), { status: "ok", word: "Hund", genus: "m", article: "der", abgeleitet: false });
  // stimmig: das Nomen bringt sein Geschlecht selbst mit, german-nouns liest es und bildet den Artikel zurück
  assert.deepEqual(artikelGenusAbgleich({ word: "der Hund", article: "der", tags: ["x"] }), { status: "ok", word: "Hund", genus: "m", article: "der", abgeleitet: false });
  assert.deepEqual(artikelGenusAbgleich({ word: "Hund (m)", article: "der", tags: ["x"] }).status, "ok");
  // nur das Geschlecht: der Artikel kommt aus german-nouns (Genus → Artikel), nicht aus dem Nichts
  const abgeleitet = artikelGenusAbgleich({ word: "Hund", genus: "maskulin", tags: ["x"] });
  assert.deepEqual(abgeleitet, { status: "ok", word: "Hund", genus: "m", article: "der", abgeleitet: true });
  // Widerspruch: das Nomen sagt ein anderes Geschlecht als das Feld
  const widerspruch = artikelGenusAbgleich({ word: "der Hund", article: "die", tags: ["x"] });
  assert.equal(widerspruch.status, "widerspruch");
  assert.match(widerspruch.status === "widerspruch" ? widerspruch.reason : "", /Genus widersprüchlich/);
  assert.equal(artikelGenusAbgleich({ word: "Blume", article: "der", genus: "f", tags: ["x"] }).status, "widerspruch");
  // Plural kennt die Bank nicht
  const plural = artikelGenusAbgleich({ word: "die Kinder (pl)", article: "die", tags: ["x"] });
  assert.equal(plural.status, "widerspruch");
  assert.match(plural.status === "widerspruch" ? plural.reason : "", /Plural/);
  // kein Geschlecht angegeben: nichts geprüft und nichts geraten
  assert.deepEqual(artikelGenusAbgleich({ word: "Hund", tags: ["x"] }), { status: "ohne", word: "Hund" });
  assert.deepEqual(artikelGenusAbgleich({}), { status: "ohne", word: "" });
  assert.deepEqual(artikelGenusAbgleich(null), { status: "ohne", word: "" });
  for (const roh of ["Hund", 7, [], undefined]) assert.equal(artikelGenusAbgleich(roh).status === "widerspruch", false, `${String(roh)}: ohne Angabe kein Widerspruch`);
});

test("Artikel: ein Widerspruch lehnt den Eintrag ab, ein fehlendes Geschlecht wird nicht erfunden", () => {
  const warum: string[] = [];
  assert.equal(aiBankItemToDraft("artikel", { word: "der Hund", article: "die", tags: ["Tiere"] }, { difficulty: "mittel", why: (r) => warum.push(r) }), null);
  assert.match(warum[0], /Genus widersprüchlich/);

  // ohne Geschlecht: kein Artikel, also kein Eintrag — aber auch kein geratener
  warum.length = 0;
  assert.equal(aiBankItemToDraft("artikel", { word: "Hund", tags: ["Tiere"] }, { difficulty: "mittel", why: (r) => warum.push(r) }), null);
  assert.match(warum[0], /kein Geschlecht angegeben/);

  // nur das Geschlecht: german-nouns bildet den Artikel, der Eintrag wird angenommen
  const abgeleitet = aiBankItemToDraft("artikel", { word: "Blume", genus: "f", translation: "flower", tags: ["Natur"] }, { difficulty: "mittel" })!;
  assert.equal(abgeleitet.data.options![abgeleitet.answer.correct!], "die");
  assert.equal(abgeleitet.data.genus, "f");
  // und das Nomen wird dabei von Artikel und Kürzel befreit
  const normalisiert = aiBankItemToDraft("artikel", { word: "das Auto (n)", article: "das", tags: ["Verkehr"] }, { difficulty: "mittel" })!;
  assert.match(normalisiert.prompt, /„Auto“/);
});

// ---------- der Weg über den Router ----------

test("generateBankItemsWithAI: gültige Einträge werden Aufgaben, unbrauchbare gemeldet", async () => {
  const gesehen: string[] = [];
  // Der zweite Eintrag passt in das Schema des Anbieters, verletzt aber die Regel der Bank
  // (zwei Lücken im Satz, nur eine Lösung) — solche Einträge fallen einzeln heraus.
  const kaputt = { q: "Gestern ___ ich ___ Hause.", blanks: [["ging"]], solution: "x", hint: "y" };
  const ergebnis = await fakeRouter(
    (prompt) => {
      gesehen.push(prompt);
      return [GING, kaputt];
    },
    (router) => generateBankItemsWithAI("praeteritum", { count: 2, difficulty: "mittel", topic: "Vergangenheit", meta: { trigger: "test-banken" } }),
  );
  assert.equal(gesehen.length, 1, "genau eine Anfrage");
  assert.match(gesehen[0], /Erstelle jetzt 2 Einträge zum Thema „Vergangenheit“/);
  assert.ok(gesehen[0].startsWith(PRAETERITUM_ANWEISUNG));
  assert.ok(!("error" in ergebnis), "kein Fehler erwartet");
  if ("error" in ergebnis) return;
  assert.equal(ergebnis.items.length, 1, "nur der geprüfte Eintrag gilt");
  assert.equal(ergebnis.drafts.length, 1);
  assert.equal(ergebnis.drafts[0].skillId, "deutsch.grammatik.praeteritum");
  assert.equal(ergebnis.rejected.length, 1);
  assert.match(ergebnis.rejected[0], /2 Lücken im Satz, aber 1 Lösungen/);
});

test("generateBankItemsWithAI: eine Antwort ohne Array ist ein Fehler, kein leeres Ergebnis", async () => {
  const router = await import("./ai/router");
  router.setTransport(async (p) => ({ parsed: { eintraege: [] }, refusal: false, model: p.model, usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 }, costUsd: 0.0005 }));
  try {
    const ergebnis = await generateBankItemsWithAI("perfekt", { count: 2, difficulty: "mittel" });
    assert.ok("error" in ergebnis, "ein fehlendes Array wird gemeldet");
    if ("error" in ergebnis) assert.match(ergebnis.error, /JSON-Array/);
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
});

test("ohne Schlüssel läuft nichts — und es wird auch kein Ergebnis erfunden", async () => {
  const router = await import("./ai/router");
  router.setTransport(null);
  router.resetRouter();
  assert.equal(router.aiEnabled("aufgaben"), false);
  const ergebnis = await generateBankItemsWithAI("artikel", { count: 2, difficulty: "mittel" });
  assert.ok("error" in ergebnis, "ohne Schlüssel kommt der Grund zurück");
  if ("error" in ergebnis) assert.match(ergebnis.error, /ausgeschaltet|Schlüssel/);
});

// ---------- die Prüfung der Banken (Schritt 7) ----------

test("runBankPruefung: beanstandete Einträge kommen mit Grund und geprüftem Vorschlag zurück", async () => {
  const { runBankPruefung } = await import("./ai/qualitaetstest");
  const alle = bankItems("artikel");
  const zweiter = alle[1];
  const zeilen: string[] = [];
  const ergebnis = await fakeRouter(
    (prompt) => {
      const nummern = [...prompt.matchAll(/^(\d+)\. \{/gm)].map((m) => Number(m[1]));
      return {
        items: nummern.map((nr) =>
          nr === 2
            ? { nr, ok: false, reason: "Der Artikel passt nicht zum Genus des Nomens.", fix: { word: "Abendessen", article: "das", translation: "dinner", tags: ["Allgemein"] } }
            : { nr, ok: true, reason: "", fix: null },
        ),
      };
    },
    (router) => runBankPruefung({ banks: ["artikel"], limit: 3, perRequest: 3, meta: { trigger: "test-bankpruefung" }, log: (l) => zeilen.push(l) }),
  );
  assert.equal(ergebnis.ran, true, ergebnis.message);
  const bank = ergebnis.banks[0];
  assert.equal(bank.id, "artikel");
  assert.equal(bank.total, 1914);
  assert.equal(bank.checked, 3);
  assert.equal(bank.unanswered, 0);
  assert.equal(bank.flagged.length, 1);
  const flag = bank.flagged[0];
  assert.equal(flag.nr, 2, "die Nummer zählt ab 1 wie in der Datei");
  assert.deepEqual(flag.item, zweiter, "genau der Eintrag aus der Datei");
  assert.match(flag.reason, /Artikel/);
  assert.deepEqual(flag.fix, { word: "Abendessen", article: "das", translation: "dinner", tags: ["Allgemein"] }, "der Vorschlag wird gegen das Bankschema geprüft");
  assert.equal(flag.fixProblem, null);
  assert.match(ergebnis.message, /1 von 3 geprüften Einträgen markiert/);
  assert.ok(zeilen.some((z) => z.startsWith("[KI-Qualitaetstest] artikel eintrag-2 ")), "jeder Eintrag kommt in eine Log-Zeile");
  assert.ok(zeilen.at(-1)!.startsWith("[KI-Qualitaetstest] banken "));
});

test("runBankPruefung: ein Vorschlag, der das Bankschema verletzt, wird nicht übernommen", async () => {
  const { runBankPruefung } = await import("./ai/qualitaetstest");
  const ergebnis = await fakeRouter(
    (prompt) => ({ items: [...prompt.matchAll(/^(\d+)\. \{/gm)].map((m) => ({ nr: Number(m[1]), ok: Number(m[1]) === 1 ? false : true, reason: "Genus falsch", fix: { word: "Abend", article: "die", tags: [] } })) }),
    () => runBankPruefung({ banks: ["artikel"], limit: 1, perRequest: 1, log: () => {} }),
  );
  const flag = ergebnis.banks[0].flagged[0];
  assert.equal(flag.fix, null, "ein Vorschlag ohne tags ist kein Bankeintrag");
  assert.match(flag.fixProblem ?? "", /Vorschlag verworfen/);
});

test("runBankPruefung ohne Schlüssel: nichts geprüft, nichts markiert, klare Meldung", async () => {
  const router = await import("./ai/router");
  router.setTransport(null);
  router.resetRouter();
  const { runBankPruefung } = await import("./ai/qualitaetstest");
  const ergebnis = await runBankPruefung({ banks: ["artikel", "perfekt"], log: () => {} });
  assert.equal(ergebnis.ran, false);
  assert.match(ergebnis.message, /kein Schlüssel/);
  for (const bank of ergebnis.banks) {
    assert.equal(bank.checked, 0, `${bank.id}: nichts darf als geprüft gelten`);
    assert.equal(bank.flagged.length, 0);
    assert.ok(bank.total > 0, `${bank.id}: die Anzahl der Einträge steht trotzdem da`);
  }
});

test("bankPruefungPrompt: die Regeln der Bank stehen im Auftrag, die Einträge sind Daten", async () => {
  const { bankPruefungPrompt } = await import("./ai/qualitaetstest");
  const prompt = bankPruefungPrompt("artikel", [HUND], 0);
  assert.match(prompt, /Aufgabenbank „Artikel bestimmen“/);
  assert.ok(prompt.includes(ARTIKEL_ANWEISUNG), "dieselbe Anweisung wie für neue Einträge");
  assert.match(prompt, /1\. \{"word":"Hund"/);
  assert.match(prompt, /ok=true nur, wenn/);
});

test("der Bericht ohne Schlüssel behauptet nicht, dass Einträge geprüft wurden", async () => {
  const { bericht } = await import("../scripts/banks-pruefung");
  const banks = bankStats().map((s) => ({ id: s.id, file: s.file, label: s.label, total: s.total, usable: s.usable, review: s.review, checked: 0, unanswered: 0, flagged: [] }));
  const md = bericht({ ran: false, message: "Die KI ist ausgeschaltet oder es ist kein Schlüssel hinterlegt – es wurde kein einziger Eintrag geprüft.", model: "m", banks, usd: 0 }, { stand: "2026-10-12T00:00:00.000Z", ids: [] });
  assert.match(md, /# Prüfung der Aufgabenbanken/);
  assert.match(md, /\*\*Die Prüfung hat NICHT stattgefunden\.\*\*/);
  assert.match(md, /Es wurde kein Eintrag geprüft, nichts in `data\/banks\/` geändert/);
  assert.match(md, /npm run banks:pruefung/);
  assert.ok(md.includes("ANTHROPIC_API_KEY=… npm run banks:pruefung\n"), "der genaue Befehl steht im Bericht");
  assert.ok(md.includes("npm run banks:pruefung -- --limit 20"), "der billige Probelauf steht im Bericht");
});

test("der Bericht mit Ergebnis nennt je Bank die Zahlen und jeden beanstandeten Eintrag", async () => {
  const { bericht } = await import("../scripts/banks-pruefung");
  const banks = bankStats().map((s, i) => ({
    id: s.id,
    file: s.file,
    label: s.label,
    total: s.total,
    usable: s.usable,
    review: s.review,
    checked: i === 0 ? 3 : 0,
    unanswered: 0,
    flagged: i === 0 ? [{ bank: s.id, nr: 2, item: { word: "Abendessen", article: "das", tags: ["x"] }, reason: "Artikel falsch", fix: null, fixProblem: "Vorschlag verworfen: …" }] : [],
  }));
  const md = bericht({ ran: true, message: "1 von 3 geprüften Einträgen markiert", model: "m-test", banks, usd: 0.02 }, { stand: "2026-10-12T00:00:00.000Z", limit: 20, ids: [] });
  assert.ok(!md.includes("NICHT stattgefunden"), "ein gelaufener Lauf meldet keinen Ausfall");
  assert.match(md, /Modell: m-test/);
  assert.match(md, /Probelauf: höchstens 20 Einträge je Bank/);
  assert.match(md, /\| Artikel bestimmen \| artikel\.json \| 1914 \| 1914 \| 0 \| 3 \| 1 \|/);
  assert.match(md, /### Artikel bestimmen \(`artikel\.json`\) — 1/);
  assert.match(md, /- \*\*Nr\. 2\*\* .*Grund: Artikel falsch/);
  assert.match(md, /Vorschlag verworfen/);
  assert.match(md, /npm run banks:pruefung -- --setzen/);
});

// ---------- review: true von der Datei bis in die Übung ----------
test("review: true: der Eintrag bleibt in der Bank und verschwindet aus den Aufgaben", () => {
  const fixture = [
    { word: "Zwiebel", article: "die", translation: "onion", tags: ["Prüfung"], review: true },
    { word: "Haus", article: "das", translation: "house", tags: ["Prüfung"] },
  ];
  try {
    useBankContentForTest({ artikel: JSON.stringify(fixture) });
    // (a) in der Datei und in bankItems bleibt er stehen
    assert.equal(bankItems("artikel").length, 2, "der markierte Eintrag bleibt in der Bank");
    assert.deepEqual(bankItems("artikel")[0], fixture[0]);
    const stat = bankStats().find((s) => s.id === "artikel")!;
    assert.equal(stat.total, 2);
    assert.equal(stat.review, 1);
    assert.equal(stat.usable, 1);
    // (b) der Zugriff der Generatoren überspringt ihn
    assert.equal(bankUsable("artikel").length, 1);
    assert.equal(bankUsable("artikel")[0].word, "Haus");
    // (c) und damit entsteht keine einzige Aufgabe mehr daraus
    const tasks = generateBuiltIn({ subject: "Deutsch", skills: [{ id: "deutsch.grammatik.artikel", name: "Artikel bestimmen" }], difficulty: "mittel", count: 40, taskType: "mc", seed: 4711 });
    assert.ok(tasks.length > 0, "die Bank liefert weiter Aufgaben");
    assert.ok(tasks.every((t) => !t.prompt.includes("Zwiebel")), "der markierte Eintrag wird nicht mehr geübt");
    assert.ok(tasks.some((t) => t.prompt.includes("Haus")), "die übrigen Einträge bleiben nutzbar");
  } finally {
    useBankContentForTest(null);
  }
  assert.equal(bankItems("artikel").length, 1914, "nach dem Test müssen die echten Banken wieder gelesen werden");
});

test("review: true gilt für jede Bank: markierte Einträge sind nie in bankUsable", () => {
  for (const id of BANK_IDS) {
    const alle = bankItems(id) as { review?: boolean }[];
    const nutzbar = bankUsable(id) as { review?: boolean }[];
    assert.equal(nutzbar.filter((i) => i.review === true).length, 0, `${id}: ein markierter Eintrag ist übbar`);
    assert.equal(alle.length - nutzbar.length, bankStats().find((s) => s.id === id)!.review, `${id}: Zählung passt nicht`);
  }
});
