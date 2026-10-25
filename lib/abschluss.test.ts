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
