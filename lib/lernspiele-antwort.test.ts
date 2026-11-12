import assert from "node:assert/strict";
import { test } from "node:test";
import { antwortForm, drehbar, haeufigsteForm, legbar, legeAnzeige, legeKacheln, legeStimmt, mitAntwortForm, tippAnzeige, tippbar, tippFertig, tippStimmt, tippTaste, tippZiel, wischbar } from "./lernspiele-antwort";
import { kandidaten, waehleKarten } from "./lernspiele-karten";
import { themenKandidaten } from "./lernspiele-themen";
import { festerZufall, type SpielKarte } from "./lernspiele-typen";

const karten = (skill: string) => themenKandidaten(skill).map((k) => k.karte);
const tippe = (tasten: string) => [...tasten].reduce((text, t) => tippTaste(text, t), "");

test("Ziffernblock: das Ergebnis einer Karte als Zahl und Einheit", () => {
  assert.deepEqual(tippZiel("56"), { wert: "56", einheit: "", bruch: false });
  assert.deepEqual(tippZiel("74,5 dm"), { wert: "74,5", einheit: "dm", bruch: false });
  assert.deepEqual(tippZiel("2 472 000 cm"), { wert: "2472000", einheit: "cm", bruch: false });
  assert.deepEqual(tippZiel("60 %"), { wert: "60", einheit: "%", bruch: false });
  assert.deepEqual(tippZiel("−11"), { wert: "−11", einheit: "", bruch: false });
  assert.deepEqual(tippZiel("6/7"), { wert: "6/7", einheit: "", bruch: true });
  // gemischte Zahlen, Terme, Potenzen und Wörter lassen sich nicht tippen
  for (const nein of ["1 1/12", "10^5", "a^8", "10x + 7y", "ja", "8 h 51 min", ""]) assert.equal(tippZiel(nein), null, nein);
});

test("Ziffernblock: die Tasten schreiben nur, was eine Zahl sein kann", () => {
  assert.equal(tippe("56"), "56");
  assert.equal(tippe("07"), "7", "keine Null vorne");
  assert.equal(tippe(",5"), "0,5", "ein Komma am Anfang bekommt die Null davor");
  assert.equal(tippe("3,,5"), "3,5", "nur ein Komma");
  assert.equal(tippe("12±"), "−12");
  assert.equal(tippe("±12±"), "12", "das Vorzeichen lässt sich wieder wegnehmen");
  assert.equal(tippe("6/7"), "6/7");
  assert.equal(tippe("/7"), "7", "kein Bruchstrich ohne Zähler");
  assert.equal(tippe("3/07"), "3/7");
  assert.equal(tippe("3,5/2"), "3,52", "kein Bruch aus einer Kommazahl");
  assert.equal(tippe("123<"), "12");
  assert.equal(tippe("12345678901234"), "1234567890", "das Feld hat ein Ende");
  assert.equal(tippFertig("12,"), false);
  assert.equal(tippFertig("3/"), false);
  assert.equal(tippFertig("3/0"), false);
  assert.equal(tippFertig("−"), false);
  assert.equal(tippFertig("0"), true);
});

test("Ziffernblock: Zahlen zählen nach ihrem Wert, ein Bruch genau so, wie er dasteht", () => {
  const z = (r: string) => tippZiel(r)!;
  assert.equal(tippStimmt("56", z("56")), true);
  assert.equal(tippStimmt("54", z("56")), false);
  assert.equal(tippStimmt("0,50", z("0,5")), true);
  assert.equal(tippStimmt("2472000", z("2 472 000 cm")), true);
  assert.equal(tippStimmt("−11", z("−11")), true);
  assert.equal(tippStimmt("11", z("−11")), false);
  assert.equal(tippStimmt("6/7", z("6/7")), true);
  assert.equal(tippStimmt("30/35", z("6/7")), false, "ungekürzt ist beim Kürzen falsch");
  assert.equal(tippStimmt("1/2", z("0,5")), false);
  assert.equal(tippStimmt("", z("0")), false);
  assert.equal(tippAnzeige("2472000"), "2 472 000");
  assert.equal(tippAnzeige("2000"), "2000", "vier Stellen stehen zusammen, wie auf den Karten");
  assert.equal(tippAnzeige("−25000,5"), "−25 000,5");
});

test("Ziffernblock: welche Themen von „Kopfrechnen“ getippt werden", () => {
  for (const skill of ["mathe.vs.muldiv.einmaleins", "mathe.zahlen.runden", "mathe.masse.laengen", "mathe.negativ.addieren", "mathe.gleichungen.einfach", "mathe.prozent.prozentsatz", "mathe.brueche.kuerzen"]) {
    const ks = karten(skill);
    assert.ok(ks.length > 50, skill);
    assert.ok(ks.every(tippbar), `${skill}: alle Karten werden getippt`);
    // was getippt richtig ist, ist genau die richtige Kiste
    for (const k of ks) assert.ok(tippStimmt(tippZiel(k.richtig)!.wert, tippZiel(k.richtig)!), k.richtig);
  }
  // gemischte Zahlen, Terme und ja/nein bleiben bei den Kisten
  for (const skill of ["mathe.brueche.addieren", "mathe.brueche.dezimal", "mathe.terme.binomisch", "mathe.potenzen.regeln", "mathe.teilbarkeit.regeln"]) assert.ok(!karten(skill).some(tippbar), skill);
  // wo ein Überschlag reicht, wird nur getippt, was höchstens drei Ziffern hat
  const dezimal = karten("mathe.dezimal.multiplizieren");
  assert.ok(dezimal.some(tippbar) && !dezimal.every(tippbar));
  for (const k of dezimal.filter(tippbar)) assert.ok(tippZiel(k.richtig)!.wert.replace(/\D/g, "").replace(/^0+/, "").length <= 3, k.richtig);
});

test("Buchstaben legen: die Kacheln reichen für die Antwort und für den typischen Fehler", () => {
  for (const art of ["irregular", "praeteritum"] as const) {
    const ks = kandidaten(art).map((k) => k.karte);
    assert.ok(ks.length > 90 && ks.every(legbar), art);
    for (const k of ks) {
      const kacheln = legeKacheln(k);
      const rest = [...kacheln];
      for (const b of k.richtig.toLowerCase()) {
        const i = rest.indexOf(b);
        assert.ok(i >= 0, `${k.richtig}: ${b} fehlt`);
        rest.splice(i, 1);
      }
      assert.ok(rest.length >= 2 && rest.length <= 3, `${k.richtig}: ${rest.length} Buchstaben zu viel`);
      assert.notEqual(kacheln.slice(0, k.richtig.length).join(""), k.richtig.toLowerCase(), `${k.richtig} steht schon da`);
      assert.deepEqual(legeKacheln(k), kacheln, "immer dieselbe Reihenfolge");
      assert.ok(kacheln.length <= 16);
    }
  }
  const put = kandidaten("irregular").map((k) => k.karte).find((k) => k.richtig === "put" && k.faecher.includes("putted"))!;
  assert.deepEqual([...legeKacheln(put)].sort().join(""), "depttu", "aus den Kacheln von „put“ lässt sich auch „putted“ legen");
});

test("Buchstaben legen: groß und klein zählt nicht, am Satzanfang steht das Wort groß da", () => {
  const karte = { key: "x", vor: "", nach: "wir ins Kino?", faecher: ["Gingen", "Gehten", "Gehen"], richtig: "Gingen", loesung: "", regel: "" } satisfies SpielKarte;
  assert.equal(legeStimmt("gingen", karte), true);
  assert.equal(legeStimmt("gehten", karte), false);
  assert.equal(legeAnzeige("gin", karte), "Gin");
  assert.equal(legeAnzeige("", karte), "");
  assert.equal(legeAnzeige("went", { ...karte, richtig: "went" }), "went");
  // zwei Wörter, ein Artikel-Wort oder ein markierter Satzteil werden nicht gelegt
  assert.equal(legbar({ ...karte, richtig: "was going" }), false);
  assert.equal(legbar({ ...karte, wort: "Haus" }), false);
  assert.equal(legbar({ ...karte, mitte: "dem Hund" }), false);
});

test("Welche Karte wie beantwortet wird: tippen, legen, wischen, Rad; Artikel und Fälle bleiben bei den Kisten", () => {
  const rng = festerZufall(7);
  for (const k of waehleKarten("irregular", { stufen: [0, 1, 2, 3], rng })) assert.equal(k.form, "legen");
  for (const k of waehleKarten("praeteritum", { stufen: [0, 1, 2, 3], rng })) assert.equal(k.form, "legen");
  for (const k of waehleKarten("rechnen", { pool: themenKandidaten("mathe.vs.muldiv.einmaleins"), stufen: [0, 1, 2], rng })) assert.equal(k.form, "tippen");
  for (const k of waehleKarten("rechnen", { pool: themenKandidaten("mathe.brueche.addieren"), stufen: [0, 1, 2], rng })) assert.equal(k.form, undefined);
  for (const art of ["artikel", "faelle"] as const) for (const k of waehleKarten(art, { stufen: [0, 1, 2, 3], rng })) assert.equal(k.form, undefined, art);
  // zwei Antworten werden gewischt (auch „Teilbar oder nicht?“ beim Kopfrechnen), drei bis fünf stehen am Rad
  for (const art of ["dasdass", "perfekt", "satzteile"] as const) for (const k of waehleKarten(art, { stufen: [0, 1, 2, 3], rng })) assert.equal(k.form, "wischen", art);
  for (const k of waehleKarten("rechnen", { pool: themenKandidaten("mathe.teilbarkeit.regeln"), stufen: [0, 1, 2], rng })) assert.equal(k.form, "wischen");
  for (const art of ["praepositionen", "deklination"] as const) for (const k of waehleKarten(art, { stufen: [0, 1, 2, 3], rng })) assert.equal(k.form, "rad", art);
  for (const k of waehleKarten("zeiten", { pool: themenKandidaten("englisch.tenses.pastsimple"), stufen: [0, 1, 2, 3], rng })) assert.equal(k.form, "rad");
  for (const k of waehleKarten("grammatik", { pool: themenKandidaten("englisch.grammar.someany"), stufen: [0, 1, 2, 3], rng })) assert.equal(k.form, "rad");
  // eine Karte mit eigener Form behält sie, und der Vorrat wird nicht verändert
  const satz = waehleKarten("satzbau", { stufen: [0, 1, 2, 3], rng });
  assert.ok(satz.every((k) => k.form === "reihe"));
  const vorrat = kandidaten("irregular")[0].karte;
  assert.equal(vorrat.form, undefined);
  assert.equal(mitAntwortForm("irregular", [vorrat])[0].form, "legen");
  assert.equal(vorrat.form, undefined);
  assert.equal(antwortForm("artikel", vorrat), undefined);
  // für den Anfang des Spiels: wie die meisten Karten eines Themas beantwortet werden
  assert.equal(haeufigsteForm("rechnen", karten("mathe.zahlen.vorrang")), "tippen");
  assert.equal(haeufigsteForm("rechnen", karten("mathe.terme.klammern")), undefined);
  assert.equal(haeufigsteForm("rechnen", karten("mathe.teilbarkeit.regeln")), "wischen");
  assert.equal(haeufigsteForm("zeiten", karten("englisch.tenses.future")), "rad");
});

test("Wischen braucht genau zwei Antworten, das Rad drei bis sechs in einem Satz mit Lücke", () => {
  const karte: SpielKarte = { key: "k", vor: "Ich weiß,", nach: "du kommst.", faecher: ["das", "dass"], richtig: "dass", loesung: "", regel: "" };
  assert.equal(wischbar(karte), true);
  assert.equal(drehbar(karte), false);
  assert.equal(antwortForm("dasdass", karte), "wischen");
  // ein Spiel für das Rad mit nur zwei Antworten wird gewischt
  assert.equal(antwortForm("grammatik", karte), "wischen");
  const drei = { ...karte, faecher: ["das", "dass", "des"] };
  assert.equal(wischbar(drei), false);
  assert.equal(drehbar(drei), true);
  assert.equal(antwortForm("grammatik", drei), "rad");
  assert.equal(antwortForm("dasdass", drei), undefined);
  // die richtige Antwort muss dabei sein; ein Artikel-Wort, eine Rechnung oder ein markierter Teil kommen nicht ans Rad
  assert.equal(wischbar({ ...karte, richtig: "des" }), false);
  assert.equal(drehbar({ ...drei, richtig: "der" }), false);
  assert.equal(drehbar({ ...drei, wort: "Haus" }), false);
  assert.equal(drehbar({ ...drei, mathe: true }), false);
  assert.equal(drehbar({ ...drei, mitte: "dem Hund" }), false);
  assert.equal(drehbar({ ...drei, faecher: ["a", "b", "c", "d", "e", "f", "dass"] }), false);
  // ein markierter Teil mit zwei Antworten wird gewischt (Hauptsatz oder Gliedsatz, teilbar: ja oder nein)
  assert.equal(wischbar({ ...karte, mitte: "dass du kommst" }), true);
});
