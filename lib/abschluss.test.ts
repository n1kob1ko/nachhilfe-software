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
