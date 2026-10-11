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

const maskedWith = (names: string[], text: string) => maskText(text, namePattern(names)).masked;

test("Namen, die auch Wörter sind: nur ersetzt, wo sie als Name stehen (Test 2026-10-10: „Niemand weiß“, „a young fox“)", () => {
  // the two everyday words that were hidden in the test, and the KI could not correct them
  assert.equal(masked("Herr Direktor Weiß kam. Niemand weiß, wo er war."), "Herr Direktor [Name] kam. Niemand weiß, wo er war.");
  assert.equal(masked("The leader, Mrs Fox, showed us a young fox. The fox was hurt."), "The leader, Mrs [Name], showed us a young fox. The fox was hurt.");
  // a noun after an article or a possessive stays, an adjective in lower case too
  assert.equal(masked("Unsere Lehrerin, Frau Sommer, fuhr im Sommer weg. Frau Sommers Auto war alt."), "Unsere Lehrerin, Frau [Name], fuhr im Sommer weg. Frau [Name]s Auto war alt.");
  assert.deepEqual(detectNames(["Frau Hofer kam. Frau Hofers Auto war alt."]), ["Hofer"], "the genitive is no second name");
  assert.equal(masked("Elfriede Stern sah keinen Stern. Ein heller Stern fiel."), "[Name] [Name] sah keinen Stern. Ein heller Stern fiel.");
  assert.equal(masked("Andrea Wolf heulte wie ein Wolf."), "[Name] [Name] heulte wie ein Wolf.");
  assert.equal(masked("Laut Herrn Klein ist die Klasse zu klein."), "Laut Herrn [Name] ist die Klasse zu klein.");
  // privacy first: before a surname in spoken German, or a capital in English, the name stays hidden
  assert.equal(masked("Frau Sommer kam. Die Sommer hat gesagt, wir gehen zum Wolf."), "Frau [Name] kam. Die [Name] hat gesagt, wir gehen zum Wolf.");
  assert.equal(masked("Herr Wolf kam. Die Sommer und der Wolf lachten, beim Wolf gab es Kuchen."), "Herr [Name] kam. Die Sommer und der [Name] lachten, beim [Name] gab es Kuchen.");
  assert.equal(masked("Herr Müller kam. Der Müller war nett, beim Müller gab es Saft."), "Herr [Name] kam. Der [Name] war nett, beim [Name] gab es Saft.", "a frequent surname from a trade: hidden everywhere, as before");
  assert.equal(masked("I met Mrs Fox. I think that Fox is nice."), "I met Mrs [Name]. I think that [Name] is nice.");
  // „Dear“ is a form of address, „Sir“ is no name
  assert.deepEqual(detectNames(["Dear Hope, I hope you are well. Dear Sir, thank you."]), ["Hope"]);
  assert.equal(masked("Dear Hope, I hope you are well. Dear Sir, thank you."), "Dear [Name], I hope you are well. Dear Sir, thank you.");
});

test("Namen der Lehrkraft, die auch Wörter sind: groß geschrieben oder nach Anrede und Verwandtschaft ersetzt", () => {
  assert.equal(maskedWith(["Ernst"], "Opa Ernst nahm das ernst. Ernst lachte. opa ernst kam."), "Opa [Name] nahm das ernst. [Name] lachte. opa [Name] kam.");
  assert.equal(maskedWith(["Will", "Mark"], "I will play with Will and Mark. Uncle Mark got a good mark."), "I will play with [Name] and [Name]. Uncle [Name] got a good mark.");
  assert.equal(maskedWith(["Weiß"], "frau weiß kam. Niemand weiß es."), "frau [Name] kam. Niemand weiß es.", "a student writing the name small after „frau“");
  // a name that is no word stays hidden in every spelling, as before
  assert.equal(maskedWith(["Lena"], "lena und LENA kamen. Lenas Hund bellte."), "[Name] und [Name] kamen. [Name]s Hund bellte.");
});
