import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChanges, comparable } from "./text-correction-checks";
import { compareVersions, hidesGrammar } from "./text-correction-diff";

const changesOf = (s: string, c: string) => compareVersions(s, c).changes.map((x) => [s.slice(x.start, x.end), x.replacement]);
/** the student's sentence with every change applied reads like the KI's version */
const roundTrip = (s: string, c: string) => assert.equal(comparable(applyChanges(s, compareVersions(s, c).changes).text), comparable(c), c);

test("Fassungsvergleich: ein falsches Wort wird eine Änderung, auch wenn die KI es nicht aufzählt", () => {
  const s = "Ein weiterer Vorteil ist, dass man keine Angst haben muss, wenn man im Spiel ein Fehler macht.";
  const c = "Ein weiterer Vorteil ist, dass man keine Angst haben muss, wenn man im Spiel einen Fehler macht.";
  assert.deepEqual(changesOf(s, c), [["ein", "einen"]]);
  roundTrip(s, c);
});

test("Fassungsvergleich: ein Beistrich kommt oder geht mit dem Wort davor", () => {
  assert.deepEqual(changesOf("Ich habe mich für dieses Modell entschieden um darin meine Jause zu transportieren.", "Ich habe mich für dieses Modell entschieden, um darin meine Jause zu transportieren."), [["entschieden", "entschieden,"]]);
  assert.deepEqual(changesOf("Manche Lernspiele, trainieren außerdem das logische Denken.", "Manche Lernspiele trainieren außerdem das logische Denken."), [["Lernspiele,", "Lernspiele"]]);
});

test("Fassungsvergleich: ein Wort, das nur den Platz wechselt, ergibt eine einzige Änderung", () => {
  const s = "Deshalb die Lehrer müssten ständig durch die Klasse gehen.";
  const c = "Deshalb müssten die Lehrer ständig durch die Klasse gehen.";
  assert.deepEqual(changesOf(s, c), [["die Lehrer müssten", "müssten die Lehrer"]]);
  roundTrip(s, c);
  const s2 = "Wenn sich auch in der Schule Computerspiele erlauben, sitzen Jugendliche noch länger vor dem Bildschirm.";
  const c2 = "Wenn Computerspiele auch in der Schule erlaubt werden, sitzen Jugendliche noch länger vor dem Bildschirm.";
  assert.deepEqual(changesOf(s2, c2), [["sich auch in der Schule Computerspiele erlauben", "Computerspiele auch in der Schule erlaubt werden"]]);
  roundTrip(s2, c2);
});

test("Fassungsvergleich: eine falsche Fügung wird als Ganzes ersetzt, gleiche Wörter bleiben draußen", () => {
  const s = "Im folgenden Text wird über dem Thema „Zocken und Lernen“ erörtert.";
  const c = "Im folgenden Text wird das Thema „Zocken und Lernen“ erörtert.";
  assert.deepEqual(changesOf(s, c), [["über dem", "das"]]);
  roundTrip(s, c);
});

test("Fassungsvergleich: andere Anführungszeichen oder ein fehlender Schlusspunkt sind keine Änderung", () => {
  assert.deepEqual(changesOf("Er sagte: „Komm her!“", 'Er sagte: "Komm her!"'), []);
  assert.deepEqual(changesOf("Das stimmt.", "Das stimmt"), []);
  assert.deepEqual(compareVersions("Das stimmt.", ""), { changes: [], hidden: [], rewrite: false, unrelated: false });
});

test("Fassungsvergleich: ein Platzhalter des Datenschutzfilters steht für unsere Wörter und wird nie vorgeschlagen", () => {
  const lea = compareVersions("Am Ende erkannte Lea, dass nicht jede Frage beantwortet werden muss.", "Am Ende erkennt [PERSON_NAME], dass nicht jede Frage beantwortet werden muss.");
  assert.deepEqual(lea.changes.map((x) => x.replacement), ["erkennt"]);
  assert.deepEqual(lea.hidden.map((h) => h.text), ["Lea"]);
  const berger = compareVersions("Our teacher, Mrs Berger, always say that trips are fun.", "Our teacher, [PERSON_NAME], always says that trips are fun.");
  assert.deepEqual(berger.changes.map((x) => x.replacement), ["says"]);
  assert.deepEqual(berger.hidden.map((h) => h.text), ["Mrs Berger"]);
  // the change next to the placeholder gets the student's word back
  assert.deepEqual(changesOf("Dann erkennt Lea dass sie loslassen muss.", "Dann erkennt [PERSON_NAME], dass sie loslassen muss."), [["Lea", "Lea,"]]);
});

test("Fassungsvergleich: ein ausgeblendetes Grammatikwort wird erkannt, ein Name nicht", () => {
  const sie = compareVersions("Ich bin froh, das Sie mir geholfen haben.", "Ich bin froh, dass [PERSON_NAME] mir geholfen haben.");
  assert.deepEqual(sie.changes.map((x) => x.replacement), ["dass"]);
  assert.deepEqual(sie.hidden.map((h) => h.text), ["Sie"]);
  assert.equal(hidesGrammar("Sie"), true);
  assert.equal(hidesGrammar("sie nicht"), true);
  assert.equal(hidesGrammar("Lea"), false);
  assert.equal(hidesGrammar("Mrs Berger"), false);
});

test("Fassungsvergleich: eine fremde Fassung ergibt nichts, ein umgeschriebener Satz eine einzige Änderung", () => {
  assert.equal(compareVersions("Das ist ein Satz über Hunde und Katzen.", "Morgen fahren wir alle gemeinsam nach Wien.").unrelated, true);
  const s = "Die Mutter hat gestern den alten Kasten in den Keller getragen.";
  const c = "Gestern trug die Mutter den alten Kasten hinunter in den Keller.";
  const r = compareVersions(s, c);
  assert.equal(r.rewrite, true);
  assert.equal(r.changes.length, 1);
  roundTrip(s, c);
});
