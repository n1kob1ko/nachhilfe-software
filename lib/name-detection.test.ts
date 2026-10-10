import assert from "node:assert/strict";
import test from "node:test";
import { detectNames, parseNames } from "./name-detection";
import { maskText, namePattern } from "./text-correction-core";
import { TEXT_CASES } from "./ai/textkorrektur-test-faelle";

const masked = (text: string) => maskText(text, namePattern(detectNames([text]))).masked;

test("Namenserkennung: Vornamen, Anrede, Nachname nach Vorname, überall im Text ersetzt", () => {
  assert.deepEqual(detectNames(["Gestern traf ich Lena Hofer und Frau Novak. Später kam Mrs. Berger’s dog."]), ["Lena", "Hofer", "Novak", "Berger"]);
  assert.equal(masked("Lena Hofer kam. Hofer lachte, Lenas Hund bellte."), "[Name] [Name] kam. [Name] lachte, [Name]s Hund bellte.");
  assert.deepEqual(detectNames(["Herr Dr. Huber und Frau Lehrerin Gruber-Wimmer sprachen mit Eva-Maria."]), ["Huber", "Gruber", "Wimmer", "Eva", "Maria"]);
});

test("Namenserkennung: Grammatikwörter, Rollen und Nomen bleiben stehen", () => {
  // the words OpenRouter's guardrail hid in test 3 (2026-10-09)
  for (const t of ["Ich glaube, das Sie recht haben.", "Wenn man im Spiel ein Fehler macht, lernt man.", "Wenn sich auch in der Schule Computerspiele erlauben, ist es gut."]) {
    assert.deepEqual(detectNames([t]), [], t);
    assert.equal(masked(t), t);
  }
  assert.deepEqual(detectNames(["Die Frau Lehrerin war streng. Herr Bürgermeister sprach."]), [], "a role is no name");
  assert.deepEqual(detectNames(["Eine Frau Namens Anna kam.", "Mein Herr Gott!"]), ["Anna"], "„eine Frau“ is no form of address");
  assert.deepEqual(detectNames(["Lukas Mutter rief. Lukas Geschenk war groß. Ich hatte auch ein Geschenk."]), ["Lukas"], "„Mutter“ and a word seen after „ein“ are nouns");
  assert.deepEqual(detectNames(["Lenas Fahrradschloss klemmte."]), ["Lena"], "no surname after a genitive");
  assert.deepEqual(detectNames(["Im August fuhr ich mit Rose und Ernst ans Meer."]), [], "first names that are also words are not listed");
});

test("Namenserkennung auf den 9 erfundenen Testtexten: jeder Name gefunden, kein anderes Wort, kein Fehler verdeckt", () => {
  const expected: Record<string, string[]> = {
    K01: ["Lukas"],
    K02: ["Berger", "Novak"],
    K03: ["Lena", "Hofer"],
    K04: [],
    K05: [],
    K06: ["Verena", "Hollauer"],
    K07: ["Miriam", "Holzknecht", "Lea"],
    K08: ["Oliver", "Berger", "Lena", "Sophie"],
    K09: [],
  };
  let words = 0;
  let hidden = 0;
  for (const c of TEXT_CASES) {
    const names = detectNames([c.task, ...c.blocks.map((b) => b.text)]);
    assert.deepEqual(names, expected[c.nr], c.nr);
    const pattern = namePattern(names);
    c.blocks.forEach((b, i) => {
      const m = maskText(b.text, pattern);
      words += b.text.split(/\s+/).filter(Boolean).length;
      hidden += m.names.length;
      // an error may stand next to a name („fand Lea“), but the words it changes are never replaced
      for (const e of c.errors.filter((e) => e.para === i + 1)) {
        const right = new Set(e.right[0].split(/[\s,.;:!?]+/));
        const changed = e.wrong.split(/[\s,.;:!?]+/).filter((w) => w && !right.has(w));
        assert.deepEqual(changed.filter((w) => maskText(w, pattern).names.length), [], `${c.nr}: ${e.wrong}`);
      }
    });
  }
  assert.ok(hidden / words < 0.02, `${hidden} of ${words} words replaced (the guardrail hid 16 % in test 3)`);
});

test("Weitere Namen der Lehrkraft: Komma, Strichpunkt oder Zeile, ohne Leeres und Doppeltes", () => {
  assert.deepEqual(parseNames(" Bello, Frau Huber;\n,Bello , 42 , Dr. Eva Gruber"), ["Bello", "Huber", "Eva Gruber"], "„Frau“ would be replaced everywhere");
});
