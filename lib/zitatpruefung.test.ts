/**
 * Zitatprüfung (lib/zitatpruefung.ts, Plan 4.2): jedes Zitat und jede Zeilenangabe der KI wird im Text gesucht; was
 * nicht gefunden wird, fällt heraus und wird gezählt. Textbeilage und Schülertext sind für diesen Test geschrieben,
 * alle Namen erfunden. Ohne Datenbank und ohne KI.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { pruefeBeleg, pruefeStelle, pruefeText, pruefgrundlage, saetze, zitatTeile } from "./zitatpruefung";

const BEILAGE = [
  "Am Bahnhof von Grünwald gibt es seit vierzig Jahren einen Kiosk.",
  "Frau Halbedl verkauft dort Zeitungen, Kaugummi und Fahrkarten.",
  "Jeden Morgen um sechs Uhr schiebt sie die Rollläden hoch",
  "und stellt die Körbe mit den Äpfeln vor die Tür.",
  "„Die Leute brauchen etwas Frisches“, sagt sie und lacht.",
  "Seit dem Sommer fahren aber weniger Züge, und der Bahnhof",
  "wird leiser. Viele Pendler nehmen jetzt das Auto oder den",
  "Schnellbus, der an der Umfahrung hält. Die Gemeinde über-",
  "legt, den Kiosk zu schließen und dort Fahrradboxen aufzu-",
  "stellen. Frau Halbedl will kämpfen: „Ein Bahnhof ohne",
  "Menschen ist nur noch eine Haltestelle“, schreibt sie",
  "in einem Brief an den Bürgermeister.",
].join("\n");

const SCHUELER = [
  "Der Bericht „Der Kiosk bleibt“ aus dem Grünwalder Boten erzählt von einem Kiosk, der schließen soll.",
  "Die Besitzerin sagt, ein Bahnhof ohne Menschen sei „nur noch eine Haltestelle“ (Z. 13). Das finde ich traurig.",
  "Ich meine, die Gemeinde sollte den Kiosk behalten, weil er ein Treffpunkt ist.",
];

const g = pruefgrundlage({ beilage: BEILAGE, schueler: SCHUELER, titel: "Der Kiosk bleibt", medium: "Grünwalder Bote" });

test("Zitat mit Zeile: gefunden und an der Stelle, eine Zeile daneben gilt; sonst verworfen", () => {
  assert.deepEqual(pruefeStelle("Die Besitzerin verkauft „Zeitungen, Kaugummi und Fahrkarten“ (Z. 2).", g), { ok: true });
  assert.deepEqual(pruefeStelle("„Zeitungen, Kaugummi und Fahrkarten“ (Z. 3)", g), { ok: true }, "eine Zeile daneben");
  assert.deepEqual(pruefeStelle("„Zeitungen, Kaugummi und Fahrkarten“ (Z. 9)", g), { ok: false, grund: "zeile" });
  assert.deepEqual(pruefeStelle("Sie verkauft auch „frische Semmeln und Kipferl“ (Z. 2).", g), { ok: false, grund: "zitat" }, "erfunden");
  assert.deepEqual(pruefeStelle("Ein guter Text greift auf, dass der Kiosk „Treffpunkt der Gemeinde“ ist.", g), { ok: false, grund: "zitat" }, "erfunden, ohne Zeile");
});

test("Zitat über Zeilen, mit getrenntem Wort, gekürzt oder angepasst", () => {
  assert.deepEqual(pruefeStelle("„Ein Bahnhof ohne Menschen ist nur noch eine Haltestelle“ (Z. 10f.)", g), { ok: true });
  assert.deepEqual(pruefeStelle("Die Gemeinde „überlegt, den Kiosk zu schließen“ (Z. 8f.).", g), { ok: true }, "über-/legt am Zeilenende");
  assert.deepEqual(pruefeStelle("„Jeden Morgen […] schiebt sie die Rollläden hoch“ (Z. 3)", g), { ok: true });
  assert.deepEqual(pruefeStelle("„[Sie] stellt die Körbe mit den Äpfeln vor die Tür“ (Z. 4)", g), { ok: true });
  assert.deepEqual(pruefeStelle("„Jeden Morgen […] schließt sie den Kiosk“ (Z. 3)", g), { ok: false, grund: "zitat" }, "ein Teil steht nicht im Text");
  assert.deepEqual(zitatTeile("…"), []);
  assert.deepEqual(pruefeStelle("„…“ (Z. 3)", g), { ok: false, grund: "zitat" }, "nichts zu prüfen: nicht als Tatsache");
});

test("Titel und Medium in Anführungszeichen sind kein Zitat", () => {
  assert.deepEqual(pruefeStelle("Der Bericht „Der Kiosk bleibt“ im „Grünwalder Bote“ handelt von einem Kiosk.", g), { ok: true });
});

test("Zeilenangabe ohne Zitat: die Zeile muss es geben", () => {
  assert.deepEqual(pruefeStelle("Ab Z. 6 geht es um die Folgen für den Bahnhof.", g), { ok: true });
  assert.deepEqual(pruefeStelle("In Z. 6–9 steht die Gegenposition.", g), { ok: true });
  assert.deepEqual(pruefeStelle("In Z. 40 kommt der Bürgermeister zu Wort.", g), { ok: false, grund: "zeile" });
  assert.deepEqual(pruefeStelle("Der Schluss (Zeile 12 bis 15) bleibt offen.", g), { ok: false, grund: "zeile" });
});

test("Aus dem Schülertext: Zitat im Schülertext gefunden; seine eigene (falsche) Zeile darf die KI nennen", () => {
  assert.deepEqual(pruefeStelle("Der Text beginnt mit „Der Bericht“ und nennt das Medium.", g), { ok: true });
  assert.deepEqual(pruefeStelle("Die Wendung „Das finde ich traurig“ ist eine eigene Meinung.", g), { ok: true });
  assert.deepEqual(pruefeStelle("Das Zitat „nur noch eine Haltestelle“ (Z. 13) steht eigentlich in Z. 11.", g), { ok: true }, "die Angabe des Schülers beim selben Zitat");
  assert.deepEqual(pruefeStelle("Das Zitat „nur noch eine Haltestelle“ (Z. 7) passt.", g), { ok: false, grund: "zeile" });
  assert.deepEqual(pruefeStelle("Der Text sagt „der Kiosk ist ein Denkmal“.", g), { ok: false, grund: "zitat" });
});

test("Sätze: Zitate, „Z. 12“ und „z. B.“ bleiben ganz", () => {
  assert.deepEqual(saetze("Gut ist der Bezug (Z. 2). Es fehlt z. B. ein Beispiel. Das Zitat „Die Leute brauchen etwas Frisches. Sagt sie.“ passt."), [
    "Gut ist der Bezug (Z. 2).",
    "Es fehlt z. B. ein Beispiel.",
    "Das Zitat „Die Leute brauchen etwas Frisches. Sagt sie.“ passt.",
  ]);
  assert.deepEqual(saetze("Das gelingt! Warum? Weil es stimmt."), ["Das gelingt!", "Warum?", "Weil es stimmt."]);
});

test("pruefeText: nur der Satz mit erfundenem Zitat oder falscher Zeile fällt heraus, gezählt", () => {
  const out = pruefeText(
    "Der Bezug zur Textbeilage stimmt. Das Zitat „Zeitungen, Kaugummi und Fahrkarten“ (Z. 2) belegt den Inhalt gut. Der Text erwähnt „die alte Bahnhofsuhr“ (Z. 5). Ab Z. 30 fehlt die Gegenseite.\nDie Meinung ist begründet.",
    g,
  );
  assert.equal(out.verworfen, 2);
  assert.equal(out.text, "Der Bezug zur Textbeilage stimmt. Das Zitat „Zeitungen, Kaugummi und Fahrkarten“ (Z. 2) belegt den Inhalt gut.\nDie Meinung ist begründet.");
  assert.deepEqual(pruefeText("Ohne Zitate bleibt alles.", g), { text: "Ohne Zitate bleibt alles.", verworfen: 0 });
});

test("Belege: die Stelle rechnet die App; falsche Quelle wird berichtigt, falsche Zeile verworfen", () => {
  assert.deepEqual(pruefeBeleg({ zitat: "Die Leute brauchen etwas Frisches", quelle: "textbeilage", zeile: "5" }, g), { zitat: "Die Leute brauchen etwas Frisches", quelle: "textbeilage", stelle: "Z. 5" });
  assert.deepEqual(pruefeBeleg({ zitat: "„Die Leute brauchen etwas Frisches“", quelle: "textbeilage", zeile: null }, g), { zitat: "Die Leute brauchen etwas Frisches", quelle: "textbeilage", stelle: "Z. 5" });
  assert.equal(pruefeBeleg({ zitat: "Die Leute brauchen etwas Frisches", quelle: "textbeilage", zeile: "Z. 9" }, g), null);
  assert.equal(pruefeBeleg({ zitat: "Die Leute brauchen etwas Frisches", quelle: "textbeilage", zeile: "neun" }, g), null);
  assert.deepEqual(pruefeBeleg({ zitat: "weil er ein Treffpunkt ist", quelle: "schuelertext" }, g), { zitat: "weil er ein Treffpunkt ist", quelle: "schuelertext", stelle: null });
  assert.deepEqual(pruefeBeleg({ zitat: "weil er ein Treffpunkt ist", quelle: "textbeilage" }, g), { zitat: "weil er ein Treffpunkt ist", quelle: "schuelertext", stelle: null }, "steht nur im Schülertext");
  assert.equal(pruefeBeleg({ zitat: "weil er ein Denkmal ist", quelle: "schuelertext" }, g), null);
  assert.equal(pruefeBeleg({ zitat: "er", quelle: "schuelertext" }, g), null, "zu kurz zum Prüfen");
});

test("Ohne Schülertext (Erwartungshorizont): nur die Textbeilage zählt", () => {
  const nur = pruefgrundlage({ beilage: BEILAGE });
  assert.deepEqual(pruefeStelle("„weil er ein Treffpunkt ist“", nur), { ok: false, grund: "zitat" });
  assert.deepEqual(pruefeStelle("Die Position: „Ein Bahnhof ohne Menschen ist nur noch eine Haltestelle“ (Z. 10–11).", nur), { ok: true });
  assert.deepEqual(pruefeStelle("Z. 13", nur), { ok: false, grund: "zeile" });
});
