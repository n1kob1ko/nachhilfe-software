import assert from "node:assert/strict";
import test from "node:test";
import type { AblaufDerEinheit } from "./cockpit";
import type { BriefLine } from "./summary";

process.env.DATABASE_PATH = ":memory:";

const d = (text: string): BriefLine => ({ text, from: "daten" });
const l = (text: string): BriefLine => ({ text, from: "lehrer" });
const brief = (o: Partial<Record<"done" | "good" | "difficulties" | "errors" | "next" | "dates", BriefLine[]>> = {}) => ({ done: [], good: [], difficulties: [], errors: [], next: [], dates: [], ...o });
const s = (id: number, titel: string) => ({ id, titel });

test("Abschluss: four fields from the brief and from what the teacher tapped, nothing invented", async () => {
  const { abschlussKarte } = await import("./abschluss");
  const ablauf: AblaufDerEinheit = {
    art: "paket",
    titel: "Die vier Fälle",
    ergebnis: {
      erledigt: [s(1, "Einstieg"), s(2, "Erklärung")],
      uebersprungen: [s(3, "Beispiel")],
      nichtErreicht: [s(4, "Kontrolle")],
      wiederholt: [{ ...s(2, "Erklärung"), mal: 2 }],
      nichtVerstanden: [{ ...s(2, "Erklärung"), mal: 1 }],
    },
  };
  const k = abschlussKarte(
    brief({
      done: [d("Grammatik: Fälle"), d("4 Aufgaben bearbeitet, 3 richtig (75 %)")],
      good: [d("Nominativ (2 von 2 richtig)"), l("Hat gut mitgemacht")],
      difficulties: [d("Dativ: 1 von 2 richtig")],
      errors: [d("Fall verwechselt (1×)")],
      next: [d("Dativ (Schwäche)")],
      dates: [d("Schularbeit Deutsch in 9 Tagen (Di., 3.11.)")],
    }),
    ablauf,
  );
  assert.deepEqual(k.gemacht.map((x) => x.text), ["Grammatik: Fälle", "4 Aufgaben bearbeitet, 3 richtig (75 %)", "Lernpaket „Die vier Fälle“: 2 von 4 Schritten (Einstieg, Erklärung)"]);
  assert.deepEqual(k.gut.map((x) => [x.text, x.von]), [["Nominativ (2 von 2 richtig)", "daten"], ["Hat gut mitgemacht", "lehrer"]]);
  assert.deepEqual(k.schwierig.map((x) => x.text), ["Dativ: 1 von 2 richtig", "Fehler: Fall verwechselt (1×)", "Nicht verstanden: Erklärung"]);
  assert.deepEqual(k.naechstes.map((x) => x.text), ["Dativ (Schwäche)", "Weiter mit: Kontrolle", "Wiederholen: Erklärung (2×)", "Übersprungen: Beispiel", "Schularbeit Deutsch in 9 Tagen (Di., 3.11.)"]);
});

test("Abschluss: without evidence „Gut verstanden“ stays empty; a chosen but unused package adds nothing", async () => {
  const { abschlussKarte } = await import("./abschluss");
  const unbenutzt: AblaufDerEinheit = { art: "plan", titel: "Plan für heute", ergebnis: { erledigt: [], uebersprungen: [], nichtErreicht: [s(-1, "Einstieg"), s(-2, "Üben")], wiederholt: [], nichtVerstanden: [] } };
  const k = abschlussKarte(brief({ done: [d("Bruchrechnen")] }), unbenutzt);
  assert.deepEqual(k.gut, [], "every step marked „Weiter“ is no proof of understanding");
  assert.deepEqual(k.naechstes, [], "not reached is only said when the steps were used");
  assert.deepEqual(k.gemacht.map((x) => x.text), ["Bruchrechnen"]);

  const plan: AblaufDerEinheit = { art: "plan", titel: "Plan für heute", ergebnis: { erledigt: [s(-1, "Einstieg")], uebersprungen: [], nichtErreicht: [s(-2, "Üben")], wiederholt: [], nichtVerstanden: [] } };
  const p = abschlussKarte(null, plan);
  assert.deepEqual(p.gemacht.map((x) => x.text), ["Plan für heute: 1 von 2 Schritten (Einstieg)"]);
  assert.deepEqual(p.naechstes.map((x) => x.text), ["Weiter mit: Üben"]);
  assert.deepEqual(abschlussKarte(brief({ next: [d("A"), d("A")] }), null).naechstes.length, 1, "a line only once");
});

test("Abschluss: a confirmed text grade under „Heute gemacht“ and its weak criteria under „Noch schwierig“; an open one only with its link", async () => {
  const { abschlussKarte } = await import("./abschluss");
  const stufen = { inhalt: 3, textstruktur: 2, stil: 3, sprachrichtigkeit: 4 } as const;
  const b = brief({
    done: [d("E-Mail"), d("Textarbeit „My weekend“ (E-Mail, 124 Wörter): 2 von 3 Arbeitsaufträgen erfüllt, Note 3 (Inhalt 3, Aufbau 2, Ausdruck 3, Sprache 4)"), d("Textarbeit „The lost key“ (Story, 90 Wörter): Bewertung offen"), d("Textarbeit „Notizen“ (12 Wörter)"), l("Textarbeit „My weekend“ besprochen")],
    difficulties: [d("Past Simple: 1 von 3 richtig")],
  });
  const k = abschlussKarte(b, null, [
    { id: 4, titel: "My weekend", textsorte: "E-Mail", bewertung: { stand: "bestaetigt", note: 3, stufen, erfuellt: 2, von: 3 } },
    { id: 5, titel: "The lost key", textsorte: "Story", bewertung: { stand: "offen" }, vorschlag: true },
    { id: 6, titel: "Notizen", textsorte: "" },
  ]);
  assert.deepEqual(
    k.gemacht.map((x) => [x.text, x.link?.label ?? null]),
    [
      ["Textarbeit „Notizen“ (12 Wörter)", null],
      ["Textarbeit „My weekend“ besprochen", null],
      ["E-Mail „My weekend“: Note 3 (2 von 3 Arbeitsaufträgen erfüllt)", null],
      ["Story „The lost key“: Bewertung offen", "Bewertung übernehmen"],
    ],
    "the documentation's line (and its bare topic line) is replaced, the teacher's own words and a text without a grade stay",
  );
  assert.equal(k.gemacht[3].link?.href, "/texte/5/korrektur?teil=aufgabe");
  assert.deepEqual(k.schwierig.map((x) => x.text), ["Past Simple: 1 von 3 richtig", "E-Mail „My weekend“: Sprache 4"], "only the confirmed grade's weak criteria; nothing from the open one");
  assert.deepEqual(k.gut, [], "a grade is no proof of „Gut verstanden“");

  // open without a proposal: „Korrigieren“; a KI proposal never shows as a number
  const o = abschlussKarte(null, null, [{ id: 8, titel: "Bewerbung Tischlerei", textsorte: "Bewerbungsschreiben", bewertung: { stand: "offen" }, vorschlag: false }]);
  assert.deepEqual(o.gemacht.map((x) => [x.text, x.link?.label, x.link?.href]), [["Bewerbungsschreiben „Bewerbung Tischlerei“: Bewertung offen", "Korrigieren", "/texte/8/korrektur"]]);
  assert.deepEqual(o.schwierig, []);
  // confirmed without an overall grade: the levels
  const ohne = abschlussKarte(null, null, [{ id: 9, titel: "Interpretation", textsorte: "Textinterpretation", bewertung: { stand: "bestaetigt", note: null, stufen: { inhalt: 2, textstruktur: 2, stil: 5, sprachrichtigkeit: 3 }, erfuellt: null, von: null } }]);
  assert.deepEqual(ohne.gemacht.map((x) => x.text), ["Textinterpretation „Interpretation“: bewertet (Inhalt 2, Aufbau 2, Ausdruck 5, Sprache 3)"]);
  assert.deepEqual(ohne.schwierig.map((x) => x.text), ["Textinterpretation „Interpretation“: Ausdruck 5"]);
});

// ---------- PR 5: automatic Abschluss, every source with its label ----------

type Belege = import("./abschluss").AbschlussBelege;
type Aufgabe = import("./abschluss").AufgabeBeleg;
const DIV = "mathe.brueche.dividieren";
const MUL = "mathe.brueche.multiplizieren";
/** a task at the device: right at the first try unless said otherwise */
const t = (o: Partial<Aufgabe> = {}): Aufgabe => ({ assignmentId: 1, skillId: DIV, skill: "Dividieren", correct: true, finished: true, firstTry: true, tries: 1, help: "keine", ...o });
const falschT = (o: Partial<Aufgabe> = {}) => t({ correct: false, firstTry: false, tries: 2, ...o });
const belege = (o: Partial<Belege> = {}): Belege => ({ aufgaben: [], fehler: [], beobachtungen: [], reaktionen: [], minitest: null, vorgabe: [], geuebt: [], pruefung: null, eigene: {}, ...o });
const frage = (antwort: "richtig" | "teilweise" | "falsch", skillIds = [DIV], titel = "Wie dividiert man Brüche?") => ({ titel, art: "frage", antwort, skillIds });

test("„Gut verstanden“ rules: 3 at the first try without a wrong answer; 2 right plus your „Richtig“; a harder task solved", async () => {
  const { gutVerstanden, hatSichereErgebnisse, GUT_ERSTER_VERSUCH, GUT_MIT_BEOBACHTUNG } = await import("./abschluss");
  assert.equal(GUT_ERSTER_VERSUCH, 3);
  assert.equal(GUT_MIT_BEOBACHTUNG, 2);
  // rule 1
  const r1 = gutVerstanden(belege({ aufgaben: [t(), t(), t()] }));
  assert.deepEqual(r1.map((z) => [z.text, z.von]), [["Dividieren: 3 von 3 im ersten Versuch richtig", "antworten"]]);
  assert.equal(hatSichereErgebnisse(r1), true);
  assert.deepEqual(gutVerstanden(belege({ aufgaben: [t(), t()] })), [], "two are not enough");
  assert.deepEqual(gutVerstanden(belege({ aufgaben: [t(), t(), t(), falschT()] })), [], "one wrong answer on the skill: not secure");
  assert.deepEqual(gutVerstanden(belege({ aufgaben: [t(), t(), t(), t({ firstTry: false, tries: 2 })] })), [], "right only at the second try counts as a wrong answer");
  assert.deepEqual(gutVerstanden(belege({ aufgaben: [t(), t(), t(), t({ help: "loesung", correct: false, firstTry: false })] })), [], "a solution looked at counts as wrong");
  assert.equal(gutVerstanden(belege({ aufgaben: [t(), t(), t(), t({ firstTry: false, help: "hinweis" })] })).length, 1, "a hint is no wrong answer");
  // rule 2: two right + the teacher's „Richtig“ on a question of this skill, with both sources named
  const r2 = gutVerstanden(belege({ aufgaben: [t({ firstTry: false, help: "hinweis" }), t()], beobachtungen: [frage("richtig")] }));
  assert.deepEqual(r2.map((z) => [z.text, z.von, z.auch]), [["Dividieren: 2 von 2 richtig, Frage „Wie dividiert man Brüche?“ richtig beantwortet", "antworten", "beobachtung"]]);
  // a „Richtig“ for another skill does not help; it stands as an observation only
  const fremd = gutVerstanden(belege({ aufgaben: [t(), t()], beobachtungen: [frage("richtig", [MUL])] }));
  assert.deepEqual(fremd.map((z) => z.von), ["beobachtung"]);
  assert.equal(hatSichereErgebnisse(fremd), false, "an observation alone is no secure result");
  assert.equal(hatSichereErgebnisse([]), false);
  // your „Falsch“ or „Teilweise“ rules a skill out, even with 3 right
  assert.deepEqual(gutVerstanden(belege({ aufgaben: [t(), t(), t()], beobachtungen: [frage("teilweise")] })), []);
  // rule 3: a harder task (Anpassung) solved, only when every answer of it was right
  const schwer = (ts: Aufgabe[]) => gutVerstanden(belege({ aufgaben: ts, reaktionen: [{ art: "schwerer", skillId: DIV, skill: "Dividieren", assignmentId: 9 }] }));
  assert.deepEqual(schwer([t({ assignmentId: 9 }), t({ assignmentId: 9 })]).map((z) => [z.text, z.von, z.auch]), [["Schwerere Aufgabe geschafft: Dividieren (2 von 2 richtig)", "anpassung", "antworten"]]);
  assert.deepEqual(schwer([t({ assignmentId: 9 }), falschT({ assignmentId: 9 })]), [], "a wrong answer on the harder task: nothing");
  assert.deepEqual(schwer([t({ assignmentId: 9 })]), [], "one task is too few");
});

test("Abschluss with belege: each source in its field with its label, nothing without evidence", async () => {
  const { abschlussKarte, hatSichereErgebnisse } = await import("./abschluss");
  const b = brief({
    done: [d("Bruchrechnung: Dividieren, Multiplizieren"), d("7 Aufgaben bearbeitet, 5 richtig (71 %)")],
    good: [d("Multiplizieren (1 von 1 richtig)")],
    difficulties: [d("Dividieren: 2 von 4 richtig")],
    errors: [d("Rechenfehler (2×)")],
    next: [d("Dividieren (Schwäche)"), d("Addieren (Prüfung)")],
    dates: [d("Schularbeit Mathematik in 9 Tagen (Di., 3.11.): Brüche"), d("Hausübung Mathematik: S. 34, bis Mi., 28.10.")],
  });
  const k = abschlussKarte(
    b,
    null,
    [],
    belege({
      aufgaben: [falschT(), falschT(), t(), t(), t({ assignmentId: 2, skillId: MUL, skill: "Multiplizieren" }), t({ assignmentId: 3 }), t({ assignmentId: 3 })],
      fehler: ["Kehrwert vergessen (2×)", "Rechenfehler (1×, vermutet)"],
      beobachtungen: [frage("richtig", [MUL], "Was ist der Kehrwert?"), frage("falsch", [DIV], "Warum mal den Kehrwert?")],
      reaktionen: [{ art: "leichter", skillId: DIV, skill: "Dividieren", assignmentId: 3 }],
      minitest: { von: 4, erledigt: 4, richtig: 3, falsch: ["Kürzen"] },
      vorgabe: [{ id: DIV, name: "Dividieren" }, { id: "mathe.brueche.kuerzen", name: "Kürzen" }],
      geuebt: [DIV, MUL],
      pruefung: { art: "Schularbeit", fach: "Mathematik", datum: "Di., 3.11.", offen: ["Kürzen", "Addieren", "Subtrahieren", "Erweitern"] },
    }),
  );
  const zeilen = (xs: { text: string; von: string }[]) => xs.map((x) => `${x.text} [${x.von}]`);
  assert.deepEqual(zeilen(k.gemacht), [
    "Bruchrechnung: Dividieren, Multiplizieren [antworten]",
    "7 Aufgaben bearbeitet, 5 richtig (71 %) [antworten]",
    "Minitest am Anfang: 3 von 4 richtig [antworten]",
    "Aus deiner Vorgabe geübt: Dividieren [vorgabe]",
  ]);
  // the documentation's „sicher“ line (1 of 1) is no rule: only the teacher's observation stays, labelled
  assert.deepEqual(zeilen(k.gut), ["Frage „Was ist der Kehrwert?“: richtig beantwortet [beobachtung]"]);
  assert.equal(hatSichereErgebnisse(k.gut), false, "the card says „Keine sicheren Ergebnisse“");
  assert.deepEqual(zeilen(k.schwierig), [
    "Dividieren: 2 von 4 richtig [antworten]",
    "Fehler: Kehrwert vergessen (2×) [antworten]",
    "Fehler: Rechenfehler (1×, vermutet) [antworten]",
    "Minitest: Fehler bei Kürzen [antworten]",
    "Frage „Warum mal den Kehrwert?“: falsch beantwortet [beobachtung]",
    "Leichtere Aufgabe nötig bei Dividieren (danach 2 von 2 richtig) [anpassung]",
  ]);
  assert.deepEqual(
    zeilen(k.naechstes),
    [
      "Schularbeit Mathematik am Di., 3.11.: zuletzt nicht geübt: Kürzen, Addieren, Subtrahieren und 1 weiterer Punkt [pruefung]",
      "Aus deiner Vorgabe noch offen: Kürzen [vorgabe]",
      "Dividieren (Schwäche) [lernstand]",
      "Hausübung Mathematik: S. 34, bis Mi., 28.10. [hausuebung]",
    ],
    "the exam first (its line replaces the documentation's and a recommendation it already names), at most three points, then the Vorgabe",
  );
});

test("Abschluss with belege: a skill secure by the rules leaves „Noch schwierig“; a field corrected in the card shows exactly that text; only the Ablauf proves nothing", async () => {
  const { abschlussKarte } = await import("./abschluss");
  const b = brief({ difficulties: [d("Dividieren: 3 von 4 richtig, 1× mit Hilfe")], good: [l("Hat gut mitgemacht")] });
  const sicher = [t(), t(), t(), t({ firstTry: false, help: "hinweis" })];
  const k = abschlussKarte(b, null, [], belege({ aufgaben: sicher }));
  assert.deepEqual(k.gut.map((z) => [z.text, z.von]), [["Dividieren: 3 von 4 im ersten Versuch richtig", "antworten"], ["Hat gut mitgemacht", "lehrer"]]);
  assert.deepEqual(k.schwierig, []);
  const eigen = abschlussKarte(b, null, [], belege({ aufgaben: sicher, eigene: { schwierig: "Kehrwert noch unsicher\n\nTempo" } }));
  assert.deepEqual(eigen.schwierig.map((z) => [z.text, z.von]), [["Kehrwert noch unsicher", "eigen"], ["Tempo", "eigen"]]);
  // only the Ablauf, no answers: nothing secure
  const plan: AblaufDerEinheit = { art: "plan", titel: "Plan für heute", ergebnis: { erledigt: [s(-1, "Einstieg")], uebersprungen: [], nichtErreicht: [s(-2, "Üben")], wiederholt: [], nichtVerstanden: [] } };
  const nurAblauf = abschlussKarte(brief({ done: [d("Bruchrechnen")] }), plan, [], belege());
  assert.deepEqual(nurAblauf.gut, []);
  assert.deepEqual(nurAblauf.gemacht.map((z) => [z.text, z.von]), [["Bruchrechnen", "daten"], ["Plan für heute: 1 von 2 Schritten (Einstieg)", "ablauf"]]);
});

test("Abschluss: the text for the documentation leaves out your notes and marks an observation", async () => {
  const { dokuText } = await import("./abschluss");
  assert.equal(
    dokuText([
      { text: "Dividieren: 3 von 3 im ersten Versuch richtig", von: "antworten" },
      { text: "Frage „X“: richtig beantwortet", von: "beobachtung" },
      { text: "Hat gut mitgemacht", von: "lehrer" },
    ]),
    "Dividieren: 3 von 3 im ersten Versuch richtig\nFrage „X“: richtig beantwortet (Beobachtung)",
  );
});
