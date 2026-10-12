/**
 * Prüft die Aufgabenbanken unter `data/banks/` (Phase 1 des Merges, Inhalte aus dem Artikel Trainer).
 *
 * Die Zahlen in diesen Tests sind aus der Quelle gemessen. Ein fehlerhafter Neu-Import fällt damit
 * auf: falsche Anzahl, verlorene Einträge, doppelte Schlüssel oder ein `correct`, das nicht in den
 * angebotenen Optionen steht.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GAP } from "./tasks";
import {
  BANK_FILES,
  BANK_IDS,
  bankFile,
  bankItems,
  bankStats,
  bankUsable,
  parseBank,
  readBank,
  useBankContentForTest,
  withoutReview,
  type AdjektivdeklinationItem,
  type ArtikelItem,
  type BankId,
  type ClozeItem,
  type DasDassItem,
  type HauptsatzGliedsatzItem,
  type PraepositionenItem,
} from "./banks";

/** Die Themendateien der Quelle, in fester Reihenfolge. */
const TOPICS = ["Allgemein", "Einfach", "Grusel", "Tiere", "charkteresierung"];
const DAS_DASS_PREFIX = "Setze „das“ oder „dass“ ein: ";

/** Schlüssel je Bank: das Feld, das einen Eintrag eindeutig macht. */
const artikelKey = (i: ArtikelItem) => `${i.word}\u0000${i.article}`;
const adjKey = (i: AdjektivdeklinationItem) => `${i.prefix}\u0000${i.middle}\u0000${i.suffix}\u0000${i.solution}`;
const clozeKey = (i: ClozeItem) => `${i.q}\u0000${i.solution}`;
const sentenceOf = (i: DasDassItem) => i.q.replace(DAS_DASS_PREFIX, "");
const partsKey = (i: HauptsatzGliedsatzItem) => i.parts.map((p) => p.text).join(" ");

/** Anzahl der Lücken eines Lückentexts (dieselbe Zählung wie `lib/tasks.ts` gapCount). */
const gaps = (q: string) => q.split(GAP).length - 1;

const artikel = () => bankItems("artikel");
const adjektivdeklination = () => bankItems("adjektivdeklination");
const praepositionen = () => bankItems("praepositionen");
const praeteritum = () => bankItems("praeteritum");
const perfekt = () => bankItems("perfekt");
const dasDass = () => bankItems("das-dass");
const hauptsatzGliedsatz = () => bankItems("hauptsatz-gliedsatz");

test("jede Bankdatei existiert und erfüllt ihr Schema", () => {
  for (const id of BANK_IDS) {
    assert.ok(fs.existsSync(bankFile(id)), `${BANK_FILES[id]} fehlt`);
    assert.doesNotThrow(() => readBank(id), `${BANK_FILES[id]} verletzt sein Schema`);
    assert.ok(bankItems(id).length > 0, `${BANK_FILES[id]} ist leer`);
  }
  const stats = bankStats();
  assert.equal(stats.length, BANK_IDS.length);
  for (const stat of stats) {
    assert.equal(stat.error, null, `${stat.file}: ${stat.error}`);
    assert.ok(stat.label.length > 0, `${stat.id} hat keine deutsche Bezeichnung`);
  }
});

test("die Zahlen der Banken stimmen mit der Quelle überein", () => {
  // articles: 2867 Zeilen, 1926 verschiedene Wörter; „Laster“ ist ein echter Homograph und behält
  // beide Artikel, deshalb 1927 Einträge.
  assert.equal(artikel().length, 1927);
  assert.equal(new Set(artikel().map((i) => i.word)).size, 1926);
  // adjectiv_declension: 3 × 100
  assert.equal(adjektivdeklination().length, 300);
  // prepositions/test.json
  assert.equal(praepositionen().length, 100);
  // past_tense/allgemein.json (100) + die zwei Präteritum-Einträge aus lib/generators.ts
  assert.equal(praeteritum().length, 102);
  // past_perfect_tense/test.json (20) + die zwei Perfekt-Einträge aus lib/generators.ts
  assert.equal(perfekt().length, 22);
  // das_dass.json (339) + die acht DAS_DASS-Einträge aus lib/generators.ts
  assert.equal(dasDass().length, 347);
  // satzbau/syntax_sentences.json
  assert.equal(hauptsatzGliedsatz().length, 301);
});

test("keine doppelten Schlüssel innerhalb einer Bank", () => {
  const keys: Record<BankId, string[]> = {
    artikel: artikel().map(artikelKey),
    adjektivdeklination: adjektivdeklination().map(adjKey),
    praepositionen: praepositionen().map((i: PraepositionenItem) => `${i.prefix}\u0000${i.noun}\u0000${i.suffix}\u0000${i.correct}`),
    praeteritum: praeteritum().map(clozeKey),
    perfekt: perfekt().map(clozeKey),
    "das-dass": dasDass().map(sentenceOf),
    "hauptsatz-gliedsatz": hauptsatzGliedsatz().map(partsKey),
  };
  for (const id of BANK_IDS) {
    const list = keys[id];
    assert.equal(new Set(list).size, list.length, `${BANK_FILES[id]} enthält doppelte Einträge`);
  }
  // Ein einziger Wort-Schlüssel kommt zweimal vor: „Laster“ (der Laster = truck, das Laster = vice).
  const doppelt = [...new Set(artikel().map((i) => i.word))].filter((w) => artikel().filter((i) => i.word === w).length > 1);
  assert.deepEqual(doppelt, ["Laster"]);
  assert.deepEqual(
    artikel()
      .filter((i) => i.word === "Laster")
      .map((i) => i.article)
      .sort(),
    ["das", "der"],
  );
});

test("jeder artikel-Eintrag hat einen gültigen Artikel und mindestens ein Tag", () => {
  for (const item of artikel()) {
    assert.ok(["der", "die", "das"].includes(item.article), `${item.word}: Artikel „${item.article}“`);
    assert.ok(item.tags.length >= 1, `${item.word}: kein Tag`);
    for (const tag of item.tags) assert.ok(TOPICS.includes(tag), `${item.word}: unbekanntes Tag „${tag}“`);
    assert.equal(new Set(item.tags).size, item.tags.length, `${item.word}: Tag doppelt`);
  }
  // 543 Wörter stehen in mehr als einer Themendatei, ihre tags sind zusammengelegt.
  const mehrfach = artikel().filter((i) => i.tags.length > 1);
  const woerter = new Set(mehrfach.map((i) => i.word));
  woerter.add("Laster"); // der Homograph: zwei Einträge mit je einem Tag
  assert.equal(woerter.size, 543);
});

test("correct/correct1/correct2 stehen immer in den angebotenen Optionen", () => {
  for (const item of adjektivdeklination()) {
    assert.ok(item.options1.includes(item.correct1), `${item.prefix}…: correct1 „${item.correct1}“ fehlt in options1`);
    assert.ok(item.options2.includes(item.correct2), `${item.prefix}…: correct2 „${item.correct2}“ fehlt in options2`);
    assert.ok(item.solution.length > 0, `${item.prefix}…: kein Lösungssatz`);
  }
  for (const item of praepositionen()) {
    assert.ok(item.options.includes(item.correct), `${item.prefix}${item.noun}: correct „${item.correct}“ fehlt in options`);
    assert.ok(["der", "die", "das"].includes(item.article), `${item.noun}: Genus „${item.article}“`);
  }
});

test("das-dass: jede Zeile hat eine Erklärung und so viele Lücken wie Lücken im Satz", () => {
  for (const item of dasDass()) {
    assert.ok(item.explanation.trim().length > 0, `${item.q}: keine Erklärung`);
    assert.equal(item.blanks.length, gaps(item.q), `${item.q}: Lückenzahl passt nicht`);
    for (const blank of item.blanks) assert.ok(blank.length >= 1 && blank[0].length > 0, `${item.q}: leere Lücke`);
  }
  // zwei Sätze prüfen Artikel UND Konjunktion und haben deshalb zwei verschiedene Lösungen:
  // 129 aus der Quelle, dazu der handgeschriebene Eintrag „Ich weiß, ___ ___ stimmt.“
  const zwei = dasDass().filter((i) => i.blanks.length === 2);
  assert.equal(zwei.length, 130);
  const verschieden = zwei.filter((i) => new Set(i.blanks.map((b) => b[0].toLowerCase())).size > 1);
  assert.equal(verschieden.length, 3);
  for (const item of verschieden) assert.deepEqual([...item.blanks.map((b) => b[0].toLowerCase())].sort(), ["das", "dass"]);
});

test("die Lückentexte haben je Lücke eine Lösung und eine Hilfe", () => {
  for (const [name, items] of [
    ["praeteritum", praeteritum()],
    ["perfekt", perfekt()],
    ["das-dass", dasDass()],
  ] as [string, ClozeItem[]][]) {
    for (const item of items) {
      assert.equal(item.blanks.length, gaps(item.q), `${name}: „${item.q}“ hat ${gaps(item.q)} Lücken, aber ${item.blanks.length} Lösungen`);
      assert.ok(item.solution.length > 0, `${name}: „${item.q}“ ohne Lösung`);
      assert.ok(item.hint.length > 0, `${name}: „${item.q}“ ohne Hilfe`);
      for (const [answer, label] of Object.entries(item.errors ?? {})) {
        assert.ok(label.length > 0, `${name}: „${item.q}“: Fehler „${answer}“ ohne Bezeichnung`);
        if (item.blanks.length === 1) assert.notEqual(answer, item.blanks[0][0], `${name}: „${item.q}“: Fehler gleich Lösung`);
      }
    }
  }
  // die vier Einträge aus lib/generators.ts sind wirklich in den Banken gelandet
  const qs = [...praeteritum(), ...perfekt()].map((i) => i.q);
  for (const q of [
    "Gestern ___ ich mit meinen Freunden im Park. (spielen, Präteritum)",
    "Früher ___ er jeden Tag mit dem Rad zur Schule. (fahren, Präteritum)",
    "Letzten Sommer ___ wir nach Italien ___. (fahren, Perfekt)",
    "Wir ___ gestern lange ___. (lernen, Perfekt)",
  ])
    assert.ok(qs.includes(q), `„${q}“ fehlt in den Präteritum-/Perfekt-Banken`);
  // und die acht das/dass-Einträge ebenso
  const saetze = dasDass().map(sentenceOf);
  for (const s of ["Ich hoffe, ___ du morgen kommst.", "___ ist mir egal.", "Ich weiß, ___ ___ stimmt."])
    assert.ok(saetze.includes(s), `„${s}“ fehlt in der das/dass-Bank`);
});

test("praepositionen: Kasus abgeleitet, Genus ohne Farbwert", () => {
  const items = praepositionen();
  const kasus = { Dativ: 0, Akkusativ: 0, offen: 0 };
  for (const item of items) {
    if (item.kasus === null) kasus.offen++;
    else kasus[item.kasus]++;
    // dem/den sind eindeutig, die übrigen Formen folgen aus der Präposition (keine Genitivpräposition)
    if (item.correct === "dem" || item.correct === "der") assert.equal(item.kasus, "Dativ", `${item.prefix}${item.noun}`);
    if (item.correct === "den" || item.correct === "die" || item.correct === "das") assert.equal(item.kasus, "Akkusativ", `${item.prefix}${item.noun}`);
    // der Farbwert der Quelle wird nicht mitgeführt
    assert.equal((item as unknown as Record<string, unknown>).noun_color, undefined);
  }
  assert.deepEqual(kasus, { Dativ: 48, Akkusativ: 52, offen: 0 });
});

test("hauptsatz-gliedsatz: genau ein Haupt- und ein Gliedsatz", () => {
  for (const item of hauptsatzGliedsatz()) {
    assert.equal(item.parts.length, 2, `${partsKey(item)}: ${item.parts.length} Teile`);
    assert.equal(item.parts.filter((p) => p.type === "HS").length, 1, `${partsKey(item)}: kein eindeutiger Hauptsatz`);
    assert.equal(item.parts.filter((p) => p.type === "GS").length, 1, `${partsKey(item)}: kein eindeutiger Gliedsatz`);
  }
});

test("review: true wird vom Loader übersprungen, bleibt aber in der Datei", () => {
  const fixture = [
    { q: "Ich hoffe, ___ du kommst.", blanks: [["dass"]], solution: "x", hint: "y", explanation: "e", review: true },
    { q: "Er sagt, ___ er Zeit hat.", blanks: [["dass"]], solution: "x", hint: "y", explanation: "e" },
  ];
  const parsed = parseBank("das-dass", JSON.stringify(fixture));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.items.length, 2, "die Datei behält den markierten Eintrag");
    assert.equal(withoutReview(parsed.items).length, 1, "der markierte Eintrag wird übersprungen");
  }
  // der Standardzugriff liefert genau die Einträge ohne review
  for (const id of BANK_IDS) {
    const alle = bankItems(id) as { review?: boolean }[];
    const uebbar = bankUsable(id) as { review?: boolean }[];
    assert.deepEqual(uebbar, withoutReview(alle), `${BANK_FILES[id]}: review wird nicht übersprungen`);
    assert.equal(alle.length - uebbar.length, bankStats().find((s) => s.id === id)!.review);
  }
});

test("fehlende oder kaputte Bankdatei: der Test scheitert laut, die App läuft weiter", () => {
  try {
    // fehlende Datei: keine Ausnahme, aber bankStats meldet den Grund
    useBankContentForTest({ artikel: null });
    assert.deepEqual(bankUsable("artikel"), []);
    assert.deepEqual(bankItems("artikel"), []);
    assert.ok(bankStats().find((s) => s.id === "artikel")!.error, "fehlende Datei wird nicht gemeldet");
    assert.throws(() => readBank("artikel"), /artikel\.json/);
    assert.equal(parseBank("artikel", "kein json").ok, false);

    // kaputte Datei
    useBankContentForTest({ artikel: "{ kaputt" });
    assert.deepEqual(bankUsable("artikel"), []);
    assert.match(bankStats().find((s) => s.id === "artikel")!.error ?? "", /kein gültiges JSON/);

    // gültiges JSON, falsches Schema
    useBankContentForTest({ artikel: JSON.stringify([{ word: "Haus", article: "das" }]) });
    assert.match(bankStats().find((s) => s.id === "artikel")!.error ?? "", /Schema/);

    // eine andere Bank bleibt davon unberührt: bankStats zählt je Bank getrennt
    assert.equal(bankStats().find((s) => s.id === "perfekt")!.error, null);
  } finally {
    useBankContentForTest(null);
  }
  assert.equal(bankItems("artikel").length, 1927, "nach dem Test müssen die echten Banken wieder gelesen werden");
});
