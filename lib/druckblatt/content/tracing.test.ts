/**
 * Prüft die Nachmal-Zeilen aus `lib/druckblatt/content/tracing.ts`.
 *
 * Aus `aufgaben_webseite/src/domain/content/tracing.test.ts` übernommen (vitest → node:test,
 * Merge-Plan §3.2/§4 Phase 5). Die Zusagen sind dieselben; jede Vitest-Erwartung hat hier eine
 * Entsprechung.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildTraceRow, splitTraceItems, type TraceRowConfig } from "./tracing";

const config = (patch: Partial<TraceRowConfig> = {}): TraceRowConfig => ({
  repeats: 6,
  showModel: true,
  style: "ghost",
  fade: "linear",
  ...patch,
});

const styles = (cells: readonly { style: string }[]) => cells.map((cell) => cell.style);
const strengths = (cells: readonly { strength: number }[]) => cells.map((cell) => cell.strength);

/* Wer „6 mal" einstellt, bekommt sechs Zeichen -- nicht sieben. */
test("buildTraceRow -- Grundverhalten: zählt die Vorlage als erste Wiederholung mit", () => {
  assert.equal(buildTraceRow("a", config({ repeats: 6 })).length, 6);
});

test("buildTraceRow -- Grundverhalten: setzt die Vorlage voran, wenn sie gewünscht ist", () => {
  const row = buildTraceRow("a", config({ repeats: 3, fade: "off" }));
  assert.deepEqual(styles(row), ["model", "ghost", "ghost"]);
  assert.equal(row[0]!.strength, 1);
});

test("buildTraceRow -- Grundverhalten: lässt die Vorlage weg, wenn sie abgeschaltet ist", () => {
  const row = buildTraceRow("a", config({ repeats: 3, showModel: false, fade: "off" }));
  assert.deepEqual(styles(row), ["ghost", "ghost", "ghost"]);
});

test("buildTraceRow -- Grundverhalten: trägt in jeder Zelle denselben Text", () => {
  const row = buildTraceRow(" Ma ", config({ repeats: 3 }));
  assert.ok(row.every((cell) => cell.text === "Ma"));
});

test("buildTraceRow -- Grundverhalten: liefert für leere Eingabe nichts", () => {
  assert.deepEqual(buildTraceRow("", config()), []);
  assert.deepEqual(buildTraceRow("   ", config()), []);
});

test("buildTraceRow -- Grundverhalten: liefert bei null Wiederholungen nichts", () => {
  assert.deepEqual(buildTraceRow("a", config({ repeats: 0 })), []);
  assert.deepEqual(buildTraceRow("a", config({ repeats: -3 })), []);
});

test("buildTraceRow -- Grundverhalten: übernimmt die gewählte Darstellung", () => {
  const row = buildTraceRow("a", config({ repeats: 2, style: "outline", fade: "off" }));
  assert.deepEqual(styles(row), ["model", "outline"]);
});

test("buildTraceRow -- abnehmende Hilfe: lässt bei „aus“ alle gleich stark", () => {
  const row = buildTraceRow("a", config({ repeats: 4, fade: "off" }));
  assert.deepEqual(strengths(row), [1, 1, 1, 1]);
});

/* Der didaktische Kern: Das Kind löst sich beim Schreiben von der Vorlage. */
test("buildTraceRow -- abnehmende Hilfe: nimmt bei „linear“ bis zum Zeilenende ab", () => {
  const row = buildTraceRow("a", config({ repeats: 5, fade: "linear" }));
  assert.equal(row[0]!.strength, 1);
  for (let index = 2; index < row.length; index += 1) {
    assert.ok(row[index]!.strength < row[index - 1]!.strength);
  }
});

test("buildTraceRow -- abnehmende Hilfe: endet bei „linear“ mit einer leeren Position", () => {
  const row = buildTraceRow("a", config({ repeats: 5, fade: "linear" }));
  assert.equal(row[row.length - 1]!.style, "empty");
  assert.equal(row[row.length - 1]!.strength, 0);
});

/*
 * Unterhalb einer gewissen Stärke ist auf Papier nichts mehr zu sehen. Ein
 * fast unsichtbarer Rest wäre schlimmer als eine ehrlich leere Stelle: Das
 * Kind sucht sonst nach etwas, das nicht da ist.
 */
test("buildTraceRow -- abnehmende Hilfe: macht kaum noch Sichtbares ganz leer", () => {
  const row = buildTraceRow("a", config({ repeats: 12, fade: "linear" }));
  for (const cell of row) {
    assert.ok(cell.strength === 0 || cell.strength >= 0.15);
  }
});

test("buildTraceRow -- abnehmende Hilfe: teilt bei „halb“ die Zeile", () => {
  const row = buildTraceRow("a", config({ repeats: 5, fade: "half" }));
  assert.deepEqual(styles(row), ["model", "ghost", "ghost", "empty", "empty"]);
});

/* Lieber eine Hilfe mehr als eine zu wenig. */
test("buildTraceRow -- abnehmende Hilfe: rundet bei „halb“ zugunsten der Hilfe auf", () => {
  const row = buildTraceRow("a", config({ repeats: 4, fade: "half" }));
  assert.deepEqual(styles(row), ["model", "ghost", "ghost", "empty"]);
});

/*
 * Sonst wäre bei abgeschalteter Vorlage der erste Buchstabe schwächer als
 * bei eingeschalteter — dieselbe Einstellung sähe zweimal anders aus.
 */
test("buildTraceRow -- abnehmende Hilfe: rechnet den Verlauf unabhängig von der Vorlage", () => {
  const withModel = buildTraceRow("a", config({ repeats: 4, fade: "linear" }));
  const without = buildTraceRow("a", config({ repeats: 3, showModel: false, fade: "linear" }));
  assert.deepEqual(strengths(withModel).slice(1), strengths(without));
});

test("buildTraceRow -- abnehmende Hilfe: kommt mit einer einzigen Wiederholung zurecht", () => {
  assert.deepEqual(styles(buildTraceRow("a", config({ repeats: 1 }))), ["model"]);
  assert.deepEqual(
    styles(buildTraceRow("a", config({ repeats: 1, showModel: false, fade: "linear" }))),
    ["ghost"],
  );
});

test("splitTraceItems: macht aus jedem Zeichen ein Element", () => {
  assert.deepEqual(splitTraceItems("abc", "letter"), ["a", "b", "c"]);
});

test("splitTraceItems: lässt Leerzeichen bei Buchstaben weg", () => {
  assert.deepEqual(splitTraceItems("a b c", "letter"), ["a", "b", "c"]);
});

test("splitTraceItems: behält Umlaute als ein Zeichen", () => {
  assert.deepEqual(splitTraceItems("äöüß", "letter"), ["ä", "ö", "ü", "ß"]);
});

test("splitTraceItems: trennt Silben und Wörter an Komma, Leerzeichen und Zeilenumbruch", () => {
  assert.deepEqual(splitTraceItems("Ma, Me\nMi Mo", "syllable"), ["Ma", "Me", "Mi", "Mo"]);
  assert.deepEqual(splitTraceItems("Hund; Katze", "word"), ["Hund", "Katze"]);
});

test("splitTraceItems: verkraftet mehrfache Trenner", () => {
  assert.deepEqual(splitTraceItems("Ma,,  Me", "word"), ["Ma", "Me"]);
});

test("splitTraceItems: liefert für leere Eingabe nichts", () => {
  assert.deepEqual(splitTraceItems("", "letter"), []);
  assert.deepEqual(splitTraceItems("  ", "word"), []);
});
