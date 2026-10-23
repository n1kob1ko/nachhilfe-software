/**
 * Regeln der KI-Textkorrektur für die Textsorten der Schreibaufträge (lib/text-correction-rules.ts, niko 2026-10-20):
 * jede Textsorte aus lib/schreibauftrag.ts bekommt ihre eigene Regel, ein Leserbrief nicht mehr die Brief-Regel mit
 * Ort und Datum. Die Regeln für die übrigen Textarten bleiben, wie sie waren. Kein KI-Aufruf.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SORTEN } from "./schreibauftrag";
import { kindCriteria } from "./text-correction-rules";

const ALLGEMEIN = kindCriteria("irgendwas");

test("jede Textsorte eines Schreibauftrags hat ihre eigene Regel", () => {
  for (const s of Object.values(SORTEN)) {
    const rule = kindCriteria(s.name);
    assert.notEqual(rule, ALLGEMEIN, s.name);
    const head = rule.split(":")[0];
    if (s.key === "textinterpretation") assert.match(head, /^Textinterpretation/);
    else assert.equal(head, s.name, `${s.name} bekommt die Regel „${head}“`);
  }
});

test("Leserbrief verlangt kein Ort und Datum, der offene Brief schon", () => {
  assert.match(kindCriteria("Leserbrief"), /Ort und Datum sind beim Leserbrief nicht nötig/);
  assert.ok(!/^Brief:/.test(kindCriteria("Leserbrief")));
  assert.match(kindCriteria("Offener Brief"), /^Offener Brief: Ort und Datum/);
});

test("die anderen Textarten behalten ihre Regel", () => {
  assert.match(kindCriteria("Brief"), /^Brief: Ort und Datum/);
  assert.match(kindCriteria("Letter"), /^Brief:/);
  assert.match(kindCriteria("Beschwerdebrief"), /^Beschwerdebrief:/);
  assert.match(kindCriteria("Geschäftsbrief"), /^Geschäftsbrief:/);
  assert.match(kindCriteria("Inhaltsangabe"), /^Inhaltsangabe:/);
  assert.match(kindCriteria("Summary"), /^Inhaltsangabe:/);
  assert.match(kindCriteria("Erörterung"), /^Erörterung:/);
  assert.match(kindCriteria("Essay"), /^Erörterung:/);
  assert.match(kindCriteria("Textanalyse"), /^Textanalyse:/);
  assert.match(kindCriteria("Interpretation"), /^Textinterpretation/);
  assert.match(kindCriteria("Bericht"), /^Bericht:/);
  assert.match(kindCriteria("Erlebniserzählung"), /^Erzählung:/);
});

test("Zusammenfassung: Konjunktiv I nur für die Oberstufe, keine Gedankenstriche", () => {
  assert.match(kindCriteria("Zusammenfassung"), /in der Oberstufe mit Konjunktiv I/);
  for (const k of ["Leserbrief", "Offener Brief", "Kommentar", "Meinungsrede", "Empfehlung", "Zusammenfassung"]) assert.ok(!/—| – /.test(kindCriteria(k)), k);
});

// Bewerbung in der 4. Klasse (niko, 2026-10-23): eigene Regeln für Bewerbungsschreiben und Lebenslauf, vor „Brief“
test("Bewerbungsschreiben, Motivationsschreiben und Bewerbung bekommen die Normbrief-Regel, nicht die Brief-Regel", () => {
  for (const k of ["Bewerbungsschreiben", "Motivationsschreiben", "Bewerbung", "Bewerbungsbrief", "Bewerbung für die berufspraktischen Tage"]) {
    const rule = kindCriteria(k);
    assert.match(rule, /^Bewerbungsschreiben \(Normbrief\):/, k);
    assert.ok(!/^Brief:/.test(rule), k);
  }
  const rule = kindCriteria("Bewerbungsschreiben");
  // die Teile des Normbriefs
  for (const teil of ["Absender", "Telefon und E-Mail", "Empfänger", "Ort und Datum", "Betreff", "Anrede", "Text in Absätzen", "Grußformel", "Unterschrift", "Beilagen"]) assert.ok(rule.includes(teil), teil);
  // die Inhaltspunkte
  for (const punkt of ["von der Stelle erfahren", "Interesse", "Schulsituation", "Stärken, jede mit einem Beispiel", "Bitte um ein Gespräch oder eine Antwort", "Hinweis auf die Beilagen"]) assert.ok(rule.includes(punkt), punkt);
  assert.match(rule, /Höflichkeitsform „Sie“, „Ihnen“, „Ihr“ groß/);
  assert.match(rule, /keine privaten Angaben/);
  assert.match(rule, /„Mit freundlichen Grüßen“ ohne Beistrich/);
});

test("Bewerbung und Lebenslauf: lieber kein Hinweis als ein falscher", () => {
  const bewerbung = kindCriteria("Bewerbungsschreiben");
  // was vom Papier kommt, zeigt keine Anordnung; übliche Schreibweisen sind kein Fehler; Namen und Adressen bleiben
  assert.match(bewerbung, /Anordnung, Leerzeilen, rechtsbündig oder fett sind im Text nicht zu sehen und kein Fehler/);
  assert.match(bewerbung, /wie das Datum geschrieben ist .* ist kein Fehler/);
  assert.match(bewerbung, /Ein fehlender Teil ist ein Hinweis zum ganzen Text, keine Stelle im Text/);
  const lebenslauf = kindCriteria("Lebenslauf");
  assert.match(lebenslauf, /^Lebenslauf \(tabellarisch\):/);
  assert.match(lebenslauf, /fehlende Satzzeichen, Verben oder Artikel in den Zeilen sind kein Fehler/);
  assert.match(lebenslauf, /„\|“ trennt nur die Spalten/);
  for (const rule of [bewerbung, lebenslauf]) {
    assert.match(rule, /Namen, Adressen, Telefonnummern und E-Mail-Adressen nicht verbessern/);
    assert.ok(!/—| – /.test(rule), "no em dash, no spaced en dash");
  }
});

test("Lebenslauf: Abschnitte, neueste Station zuerst, einheitliche Zeitangaben, nur Wichtiges", () => {
  const rule = kindCriteria("Tabellarischer Lebenslauf");
  for (const teil of ["persönliche Daten", "Schulbildung", "praktische Erfahrungen", "Kenntnisse", "Interessen", "Ort, Datum und Unterschrift"]) assert.ok(rule.includes(teil), teil);
  assert.match(rule, /neueste Station zuerst/);
  assert.match(rule, /Zeitangaben einheitlich/);
  assert.match(rule, /nur Angaben, die für die Bewerbung wichtig sind/);
  // beides in einem Text: beide Regeln
  const beides = kindCriteria("Lebenslauf und Bewerbungsschreiben");
  assert.ok(beides.includes(rule) && beides.includes(kindCriteria("Bewerbungsschreiben")));
  // die Brief-Regeln bleiben, wie sie waren
  assert.match(kindCriteria("Brief"), /^Brief: Ort und Datum/);
  assert.match(kindCriteria("Beschwerdebrief"), /^Beschwerdebrief:/);
});

test("Bewerbungsschreiben und Lebenslauf stehen in der Auswahl der Textsorten, die Regel geht in die Anfrage", async () => {
  const { TEXT_KINDS } = await import("./texts");
  assert.ok(TEXT_KINDS.includes("Bewerbungsschreiben") && TEXT_KINDS.includes("Lebenslauf"));
  const { headerLines } = await import("./ai/textkorrektur");
  const { levelFor } = await import("./text-correction-rules");
  const zeilen = headerLines({ subject: "Deutsch", kind: "Bewerbungsschreiben", task: "", level: levelFor("Gymnasium", 4), blocks: [], skills: [] }).join("\n");
  assert.match(zeilen, /Anforderungen der Textsorte: Bewerbungsschreiben \(Normbrief\)/);
  assert.match(zeilen, /\(8\. Schulstufe\)/);
});
