/**
 * Prüft den Satzbaukasten aus `lib/druckblatt/content/sentence-box.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/content/sentence-box.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 *
 * Die Artikelbildung kommt aus `lib/german-nouns.ts` (Phase 1, dort schon portiert) — diese Tests
 * prüfen deshalb mit, dass die Wiederverwendung trägt.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  collectEntryIssues,
  resolveColumn,
  resolveSentenceBox,
  rowCount,
  sampleSentence,
  sentenceCombinations,
  type SentenceColumn,
} from "./sentence-box";

const column = (patch: Partial<SentenceColumn> = {}): SentenceColumn => ({
  id: "c1",
  role: "objekt",
  heading: "",
  entries: [],
  kasus: "akkusativ",
  article: "unbestimmt",
  ...patch,
});

/** Der Kasten aus dem Vorbild-Arbeitsblatt. */
const exampleBox: SentenceColumn[] = [
  column({ id: "subj", role: "subjekt", article: "ohne", kasus: "nominativ", entries: ["Ich"] }),
  column({ id: "verb", role: "verb", article: "ohne", entries: ["habe", "sehe", "male"] }),
  column({
    id: "obj",
    role: "objekt",
    entries: ["der Hund", "die Blume", "das Auto", "der Baum", "die Katze", "das Haus"],
  }),
];

const textsOf = (resolved: ReturnType<typeof resolveColumn>) =>
  resolved.entries.map((entry) => entry.text);

/* Der Kern der Uebung: „einen Hund", aber „eine Blume". */
test("resolveColumn -- Artikel werden gerechnet: bildet den Akkusativ passend zum Genus", () => {
  const resolved = resolveColumn(column({ entries: ["der Hund", "die Blume", "das Auto"] }));
  assert.deepEqual(textsOf(resolved), ["einen Hund", "eine Blume", "ein Auto"]);
});

test("resolveColumn -- Artikel werden gerechnet: lässt Verben unangetastet", () => {
  const resolved = resolveColumn(column({ role: "verb", entries: ["habe", "sehe", "male"] }));
  assert.deepEqual(textsOf(resolved), ["habe", "sehe", "male"]);
});

/* Ein Verb ist kein Nomen -- selbst wenn die Spalte einen Kasus traegt,
 * darf daraus nie ein Artikel entstehen. */
test("resolveColumn -- Artikel werden gerechnet: setzt auch dann keinen Artikel vor ein Verb, wenn die Spalte einen fordert", () => {
  const resolved = resolveColumn(
    column({ role: "verb", article: "bestimmt", entries: ["der Hund"] }),
  );
  assert.deepEqual(textsOf(resolved), ["der Hund"]);
});

test("resolveColumn -- Artikel werden gerechnet: bildet in der Subjektspalte den Nominativ", () => {
  const resolved = resolveColumn(
    column({ role: "subjekt", kasus: "nominativ", article: "bestimmt", entries: ["der Hund"] }),
  );
  assert.deepEqual(textsOf(resolved), ["der Hund"]);
});

test("resolveColumn -- Artikel werden gerechnet: bildet in der Ergänzungsspalte den Dativ", () => {
  const resolved = resolveColumn(
    column({ role: "ergaenzung", kasus: "dativ", article: "bestimmt", entries: ["die Schule"] }),
  );
  assert.deepEqual(textsOf(resolved), ["der Schule"]);
});

test("resolveColumn -- Artikel werden gerechnet: wirft leere Zeilen weg", () => {
  const resolved = resolveColumn(column({ entries: ["der Hund", "", "   ", "die Blume"] }));
  assert.deepEqual(textsOf(resolved), ["einen Hund", "eine Blume"]);
});

test("resolveColumn -- Artikel werden gerechnet: vergibt stabile Kennungen je Eintrag", () => {
  const resolved = resolveColumn(column({ id: "obj", entries: ["der Hund", "die Blume"] }));
  assert.deepEqual(resolved.entries.map((entry) => entry.id), ["obj-0", "obj-1"]);
});

test("resolveColumn -- Artikel werden gerechnet: behält den Rohtext, damit man die Meldung wiederfindet", () => {
  const resolved = resolveColumn(column({ entries: ["der Hund"] }));
  assert.equal(resolved.entries[0]!.source, "der Hund");
});

test("resolveColumn -- Mängel werden gemeldet: meldet ein Nomen ohne Genus", () => {
  const resolved = resolveColumn(column({ entries: ["Hund"] }));
  assert.equal(resolved.entries[0]!.text, "Hund");
  assert.deepEqual(resolved.entries[0]!.issues, ["genusUnbekannt"]);
});

/* Pronomen sind vollstaendige Phrasen -- sonst waere jede Subjektspalte der
 * ersten Klasse voller Warnungen. */
test("resolveColumn -- Mängel werden gemeldet: meldet nichts für Pronomen", () => {
  const resolved = resolveColumn(
    column({ role: "subjekt", article: "bestimmt", entries: ["Ich", "Du", "Wir"] }),
  );
  assert.deepEqual(textsOf(resolved), ["Ich", "Du", "Wir"]);
  assert.deepEqual(collectEntryIssues([resolved]), []);
});

test("resolveColumn -- Mängel werden gemeldet: sammelt Mängel über alle Spalten mit Herkunft ein", () => {
  const issues = collectEntryIssues(
    resolveSentenceBox([
      column({ id: "a", entries: ["der Hund", "Blume"] }),
      column({ id: "b", entries: ["Auto"] }),
    ]),
  );
  assert.deepEqual(issues, [
    { columnId: "a", entryId: "a-1", source: "Blume", issue: "genusUnbekannt" },
    { columnId: "b", entryId: "b-0", source: "Auto", issue: "genusUnbekannt" },
  ]);
});

const resolved = resolveSentenceBox(exampleBox);

/* Ungleich lange Spalten sind der Normalfall, nicht der Sonderfall. */
test("Kennzahlen: richtet sich nach der längsten Spalte", () => {
  assert.equal(rowCount(resolved), 6);
});

test("Kennzahlen: zählt das Kreuzprodukt der Spalten", () => {
  assert.equal(sentenceCombinations(resolved), 1 * 3 * 6);
});

/* Sonst stünde beim Tippen der ersten Spalte dauernd 0 da. */
test("Kennzahlen: ignoriert leere Spalten beim Zählen", () => {
  const withEmpty = resolveSentenceBox([...exampleBox, column({ id: "leer", entries: [] })]);
  assert.equal(sentenceCombinations(withEmpty), 18);
});

test("Kennzahlen: zählt ohne jeden Eintrag null", () => {
  assert.equal(sentenceCombinations(resolveSentenceBox([column({ entries: [] })])), 0);
  assert.equal(rowCount(resolveSentenceBox([])), 0);
});

/* Die schnellste Kontrolle, die es gibt: Steht hier „einen Blume", sieht
 * man den Fehler, ohne achtzehn Kombinationen im Kopf zu bilden. */
test("sampleSentence: setzt aus der ersten Zeile jeder Spalte einen Satz", () => {
  assert.equal(sampleSentence(resolveSentenceBox(exampleBox)), "Ich habe einen Hund.");
});

test("sampleSentence: überspringt leere Spalten", () => {
  const box = resolveSentenceBox([
    column({ id: "a", role: "subjekt", article: "ohne", entries: ["Ich"] }),
    column({ id: "leer", role: "verb", entries: [] }),
    column({ id: "c", entries: ["der Hund"] }),
  ]);
  assert.equal(sampleSentence(box), "Ich einen Hund.");
});

test("sampleSentence: liefert ohne Inhalt eine leere Zeichenkette", () => {
  assert.equal(sampleSentence([]), "");
});
