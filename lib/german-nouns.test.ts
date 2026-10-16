/**
 * Prüft die Nomen- und Artikelformen aus `lib/german-nouns.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/language/german-nouns.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildNounPhrase, genusMarker, isPronoun, nounPhraseFrom, parseNoun, type NounPhraseOptions } from "./german-nouns";

const akkusativ: NounPhraseOptions = { kasus: "akkusativ", article: "unbestimmt" };
const nominativ: NounPhraseOptions = { kasus: "nominativ", article: "bestimmt" };

// ---------- parseNoun: Genus aus der Eingabe ----------

test("parseNoun: liest das Genus aus dem bestimmten Artikel", () => {
  assert.deepEqual(parseNoun("der Hund"), { noun: "Hund", genus: "m" });
  assert.deepEqual(parseNoun("die Blume"), { noun: "Blume", genus: "f" });
  assert.deepEqual(parseNoun("das Auto"), { noun: "Auto", genus: "n" });
});

test("parseNoun: liest das Genus aus dem Kürzel in Klammern", () => {
  assert.deepEqual(parseNoun("Hund (m)"), { noun: "Hund", genus: "m" });
  assert.deepEqual(parseNoun("Blume (f)"), { noun: "Blume", genus: "f" });
  assert.deepEqual(parseNoun("Auto (n)"), { noun: "Auto", genus: "n" });
  assert.deepEqual(parseNoun("Kinder (pl)"), { noun: "Kinder", genus: "plural" });
});

test("parseNoun: versteht ausgeschriebene und abgekürzte Kürzel", () => {
  assert.equal(parseNoun("Hund (maskulin)").genus, "m");
  assert.equal(parseNoun("Blume (fem.)").genus, "f");
  assert.equal(parseNoun("Auto [n]").genus, "n");
});

// Das Kuerzel ist die ausdruecklichere Angabe und gewinnt deshalb.
test("parseNoun: lässt das Kürzel gegen einen widersprechenden Artikel gewinnen", () => {
  assert.deepEqual(parseNoun("die Kinder (pl)"), { noun: "Kinder", genus: "plural" });
});

/*
 * Nicht raten. Ein falsch geratener Artikel auf einem Blatt fuer die erste
 * Klasse ist schlimmer als ein sichtbar fehlender.
 */
test("parseNoun: rät kein Genus, wenn keines dasteht", () => {
  assert.deepEqual(parseNoun("Hund"), { noun: "Hund", genus: null });
});

test("parseNoun: behandelt „die“ als Femininum, nicht als Plural", () => {
  /* Im Grundwortschatz der ersten Klassen ist das der weit haeufigere Fall.
   * Wer den Plural meint, schreibt ihn hin. */
  assert.equal(parseNoun("die Blume").genus, "f");
});

test("parseNoun: lässt ein Wort in Ruhe, das zufällig wie ein Artikel anfängt", () => {
  assert.deepEqual(parseNoun("Dachs"), { noun: "Dachs", genus: null });
  /* „der“ allein ist kein Artikel plus Nomen, sondern nur ein Wort. */
  assert.deepEqual(parseNoun("der"), { noun: "der", genus: null });
});

test("parseNoun: behält mehrteilige Nomen zusammen", () => {
  assert.deepEqual(parseNoun("das kleine Haus"), { noun: "kleine Haus", genus: "n" });
});

test("parseNoun: ignoriert ein unbekanntes Kürzel, statt es zu verschlucken", () => {
  assert.ok(parseNoun("Smiley (:-))").noun.includes("Smiley"));
});

test("parseNoun: verkraftet Leerraum und leere Eingabe", () => {
  assert.deepEqual(parseNoun("   der    Hund  "), { noun: "Hund", genus: "m" });
  assert.deepEqual(parseNoun("   "), { noun: "", genus: null });
});

// ---------- buildNounPhrase: Akkusativ, unbestimmt ----------

/* Der Fall aus dem Arbeitsblatt: „einen Hund“, aber „eine Blume“. */
test("buildNounPhrase: bildet die Formen, die auf dem Blatt stehen sollen", () => {
  assert.equal(nounPhraseFrom("der Hund", akkusativ).text, "einen Hund");
  assert.equal(nounPhraseFrom("die Blume", akkusativ).text, "eine Blume");
  assert.equal(nounPhraseFrom("das Auto", akkusativ).text, "ein Auto");
});

test("buildNounPhrase: meldet ein unbekanntes Genus, statt einen Artikel zu erfinden", () => {
  const phrase = nounPhraseFrom("Hund", akkusativ);
  assert.equal(phrase.text, "Hund");
  assert.deepEqual(phrase.issues, ["genusUnbekannt"]);
});

test("buildNounPhrase: weiß, dass es keinen unbestimmten Plural gibt", () => {
  const phrase = nounPhraseFrom("Kinder (pl)", akkusativ);
  assert.equal(phrase.text, "Kinder");
  assert.deepEqual(phrase.issues, ["keinUnbestimmterPlural"]);
});

// ---------- buildNounPhrase: die übrigen Fälle ----------

test("buildNounPhrase: bildet den bestimmten Artikel in allen drei Fällen", () => {
  const cases = [
    ["nominativ", "der Hund"],
    ["akkusativ", "den Hund"],
    ["dativ", "dem Hund"],
  ] as const;
  for (const [kasus, expected] of cases) assert.equal(nounPhraseFrom("der Hund", { kasus, article: "bestimmt" }).text, expected);
});

test("buildNounPhrase: unterscheidet Femininum und Maskulinum im Dativ", () => {
  const dativ = { kasus: "dativ", article: "bestimmt" } as const;
  assert.equal(nounPhraseFrom("die Blume", dativ).text, "der Blume");
  assert.equal(nounPhraseFrom("der Hund", dativ).text, "dem Hund");
});

test("buildNounPhrase: bildet den unbestimmten Dativ", () => {
  const dativ = { kasus: "dativ", article: "unbestimmt" } as const;
  assert.equal(nounPhraseFrom("der Hund", dativ).text, "einem Hund");
  assert.equal(nounPhraseFrom("die Blume", dativ).text, "einer Blume");
});

/*
 * Der Dativ Plural verlangt am Nomen ein -n ("den Hunden"). Das haengt an
 * der Pluralbildung, die ohne Woerterbuch nicht zu haben ist -- also wird
 * nur der Artikel gebildet und der Rest gemeldet.
 */
test("buildNounPhrase: meldet den Dativ Plural, statt still eine halbe Form zu liefern", () => {
  const phrase = nounPhraseFrom("Kinder (pl)", { kasus: "dativ", article: "bestimmt" });
  assert.equal(phrase.text, "den Kinder");
  assert.deepEqual(phrase.issues, ["dativPlural"]);
});

test("buildNounPhrase: lässt das Nomen bei „ohne Artikel“ unangetastet", () => {
  assert.equal(nounPhraseFrom("der Hund", { kasus: "akkusativ", article: "ohne" }).text, "Hund");
  /* Ohne Artikel gibt es auch nichts zu beanstanden. */
  assert.deepEqual(nounPhraseFrom("Hund", { kasus: "akkusativ", article: "ohne" }).issues, []);
});

test("buildNounPhrase: liefert für leere Eingabe leeren Text ohne Beanstandung", () => {
  assert.deepEqual(buildNounPhrase({ noun: "", genus: null }, akkusativ), { text: "", issues: [] });
});

// ---------- Pronomen ----------

test("Pronomen werden erkannt", () => {
  for (const word of ["ich", "Ich", " DU ", "wir", "man"]) assert.equal(isPronoun(word), true, word);
  assert.equal(isPronoun("Hund"), false);
});

/*
 * Der Grund fuer die Liste: Ohne sie beanstandet jede Subjektspalte der
 * ersten Klasse („Ich“, „Du“, „Wir“) ein fehlendes Genus. Nach einer Minute
 * waere die Warnung nur noch Rauschen, das niemand mehr liest.
 */
test("Pronomen verlangen keinen Artikel und melden nichts", () => {
  const phrase = nounPhraseFrom("Ich", nominativ);
  assert.equal(phrase.text, "Ich");
  assert.deepEqual(phrase.issues, []);
});

test("ein Nomen wird trotzdem beanstandet", () => {
  assert.deepEqual(nounPhraseFrom("Hund", nominativ).issues, ["genusUnbekannt"]);
});

// ---------- genusMarker ----------

test("genusMarker: gibt die Wörterbuch-Schreibweise zurück", () => {
  assert.equal(genusMarker("m"), "der");
  assert.equal(genusMarker("f"), "die");
  assert.equal(genusMarker("n"), "das");
});

/* Rundlauf: Was der Marker schreibt, muss der Parser wieder lesen koennen.
 * Diese Zusage traegt spaeter die KI-Anbindung -- das Modell markiert das
 * Genus mit dem bestimmten Artikel. */
test("genusMarker ist zum Parser invers", () => {
  for (const genus of ["m", "f", "n"] as const) assert.equal(parseNoun(`${genusMarker(genus)} Ding`).genus, genus);
});
