import assert from "node:assert/strict";
import test from "node:test";
import type { Lernpaket } from "./lernpakete";
import type { HeutePunkt } from "./heute";
import type * as repo from "./repo";

process.env.DATABASE_PATH = ":memory:";

const skill = (name: string) => ({ id: name.toLowerCase(), name }) as repo.Skill;
const paket = (title: string) => ({ id: 1, title }) as Lernpaket;
const signal = { art: "pruefung" as const, fach: "Mathematik", skill_ids: [], stoff: ["Brüche"], thema: "Brüche", warum: "Schularbeit am 4.11. – Brüche" };

test("the card on Heute: package or recommendation as topic, two difficulties, the next exam, why", async () => {
  const { heuteKarte } = await import("./heute");
  const { KEINE_SCHWACHSTELLE } = await import("./briefing");
  const schritte = [{ rule: 3 as const, skill: skill("Brüche kürzen"), reason: "Lernstand 40 %" }];
  const k = heuteKarte({
    wahl: { art: "paket", paket: paket("Brüche dividieren"), signal, warum: "Schularbeit am 4.11. – Brüche", passung: "faehigkeit", unsicher: false, luecke: null, entwuerfe: [] },
    schritte,
    woEsHakt: ["Brüche kürzen: 40 % (üben)", "Fehler „Kehrwert vergessen“ 3×", "Zuletzt schwierig: Textaufgaben"],
    pruefung: { titel: "Schularbeit Mathematik", datum: "2026-11-04", days: 10 },
  });
  assert.equal(k.thema, "Brüche dividieren");
  assert.equal(k.empfehlung, "Schularbeit am 4.11. – Brüche");
  assert.deepEqual(k.schwierigkeiten, ["Brüche kürzen: 40 % (üben)", "Fehler „Kehrwert vergessen“ 3×"], "at most two");
  assert.equal(k.pruefung, "Schularbeit Mathematik in 10 Tagen");
  assert.equal(k.pruefungNah, true);

  const ohne = heuteKarte({ wahl: { art: "ohne_signal" }, schritte, woEsHakt: [KEINE_SCHWACHSTELLE], pruefung: { titel: "Test", datum: "2026-12-20", days: 56 } });
  assert.equal(ohne.thema, "Brüche kürzen", "without a package: the top recommendation");
  assert.equal(ohne.empfehlung, "Schwäche: Brüche kürzen – Lernstand 40 %");
  assert.deepEqual(ohne.schwierigkeiten, [], "„nothing to see“ is no difficulty");
  assert.equal(ohne.pruefung, "Test in 56 Tagen", "the next exam is always on the card");
  assert.equal(ohne.pruefungNah, false, "but not highlighted");

  const laeuft = heuteKarte({ wahl: { art: "gewaehlt", paket: paket("Gewählt") }, paketTitel: "Im Cockpit", schritte, woEsHakt: [], pruefung: null });
  assert.equal(laeuft.thema, "Im Cockpit", "a started unit's package goes first");

  const luecke = heuteKarte({ wahl: { art: "kein_paket", signal, thema: "Brüche", entwuerfe: [] }, schritte: [], woEsHakt: [], pruefung: null });
  assert.equal(luecke.thema, "Brüche");
  assert.equal(luecke.empfehlung, "Schularbeit am 4.11. – Brüche");
  assert.deepEqual(
    heuteKarte({ wahl: null, schritte: [], woEsHakt: [], pruefung: null }),
    { thema: null, schwierigkeiten: [], pruefung: null, pruefungNah: false, dauerMin: null, empfehlung: null, warumPruefung: false, vorbereitet: null, fach: "", mitKi: false },
    "nothing known: nothing shown",
  );
});

test("the next student of today: the first open one whose time is not over", async () => {
  const { naechsterPunkt, offen } = await import("./heute");
  const p = (key: string, startMin: number, o: Partial<HeutePunkt> = {}): HeutePunkt => ({
    key, zeit: "x", startMin, endeMin: startMin + 100, studentId: startMin, studentName: key, ort: "", fach: "", platzId: null,
    einheitId: null, einheitStatus: null, einheitLehrer: null, nichtStattgefunden: false, ohnePlatz: false, erledigt: false, ...o,
  });
  // 10:00 in Vienna (UTC+1 on 25 October 2026, after the change to winter time)
  const now = new Date("2026-10-25T09:00:00.000Z");
  const punkte = [p("frueh", 7 * 60), p("laeuft", 9 * 60, { einheitId: 5, einheitStatus: "gestartet" }), p("spaeter", 15 * 60), p("abend", 18 * 60)];
  assert.equal(naechsterPunkt(punkte, now)?.key, "spaeter", "over and running ones are not next");
  assert.equal(offen(punkte[1]), false);
  assert.equal(naechsterPunkt([p("vorbei", 15 * 60, { nichtStattgefunden: true })], now), null);
});
