import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const gym1 = { school_type: "Gymnasium", klasse: 1, grade: 5 };
const ms2 = { school_type: "Mittelschule", klasse: 2, grade: 6 };
const ms3 = { school_type: "Mittelschule", klasse: 3, grade: 7 };
// a Stoffzettel of a 1. Klasse as the KI reads it: book chapter names, one per line
const ERSTE_SA = ["Natürliche Zahlen", "der Zahlenstrahl", "Vergleichen", "Ordnen natürlicher Zahlen", "Stellenwerttafel", "das dekadische Zahlensystem", "Runden von natürlichen Zahlen", "Addieren natürlicher Zahlen"];

test("Stoff zuordnen: a Stoffzettel of natural numbers gets its skills ticked, the heading stays open", async () => {
  const { stoffVorschlag } = await import("./lehrplan");
  const v = stoffVorschlag(ERSTE_SA, "Mathematik", gym1);
  const best = Object.fromEntries(v.map((x) => [x.topic, x.best]));
  for (const t of ["der Zahlenstrahl", "Vergleichen", "Ordnen natürlicher Zahlen", "Stellenwerttafel", "das dekadische Zahlensystem"]) assert.deepEqual(best[t], ["mathe.zahlen.gross"], t);
  assert.deepEqual(best["Runden von natürlichen Zahlen"], ["mathe.zahlen.runden"]);
  assert.deepEqual(best["Addieren natürlicher Zahlen"], ["mathe.zahlen.addieren"]);
  // the heading over its parts ticks nothing more; its suggestions are still there to tick
  assert.deepEqual(best["Natürliche Zahlen"], []);
  assert.ok(v[0].skills.length > 0);
  // the ticked ones come first, and every topic keeps its own row
  assert.equal(v.length, ERSTE_SA.length);
  for (const x of v) assert.deepEqual(x.skills.slice(0, x.best.length).map((s) => s.id), x.best);
  assert.equal(new Set(v.flatMap((x) => x.best)).size, 3);
});

test("Stoff zuordnen: only what is clear is ticked", async () => {
  const { stoffVorschlag } = await import("./lehrplan");
  const best = (topics: string[], student = ms2, fach = "Mathematik") => Object.fromEntries(stoffVorschlag(topics, fach, student).map((x) => [x.topic, x.best]));

  // „Vergleichen“ alone: decimals, fractions or natural numbers? Suggested, not ticked
  const allein = stoffVorschlag(["Vergleichen"], "Mathematik", gym1)[0];
  assert.deepEqual(allein.best, []);
  assert.ok(["mathe.dezimal.vergleichen", "mathe.brueche.vergleichen", "mathe.zahlen.gross"].every((id) => allein.skills.some((s) => s.id === id)));
  // next to fraction topics it means fractions; two skills in one topic are both ticked
  const b = best(["Erweitern und Kürzen", "Brüche addieren und subtrahieren", "Vergleichen"]);
  assert.deepEqual(b["Erweitern und Kürzen"].sort(), ["mathe.brueche.erweitern", "mathe.brueche.kuerzen"]);
  assert.deepEqual(b["Brüche addieren und subtrahieren"].sort(), ["mathe.brueche.addieren", "mathe.brueche.subtrahieren"]);
  assert.deepEqual(b["Vergleichen"], ["mathe.brueche.vergleichen"]);

  // a topic naming a whole Thema ticks its skills of the student's Schulstufe
  const bruch = stoffVorschlag(["Bruchrechnung"], "Mathematik", ms2)[0];
  assert.ok(bruch.best.length >= 4 && bruch.best.length <= 8);
  for (const id of bruch.best) {
    const s = bruch.skills.find((x) => x.id === id)!;
    assert.ok(s.area === "Bruchrechnung" && !s.parent_id && s.grade_min <= 6 && s.grade_max >= 6, id);
  }
  // also under another name of the Thema: Kommasetzung is Beistrichsetzung
  assert.ok(best(["Kommasetzung"], ms2, "Deutsch")["Kommasetzung"].every((id) => id.startsWith("deutsch.beistrich.")));
  assert.ok(best(["Kommasetzung"], ms2, "Deutsch")["Kommasetzung"].length >= 3);
  // „Bild“ in „Bildergeschichte“ is no Bildergeschichte
  assert.deepEqual(best(["Bildergeschichte"], ms2, "Deutsch")["Bildergeschichte"], []);
  // a word that is nowhere gives nothing, not something vague
  assert.deepEqual(stoffVorschlag(["Kapitel 4", "Photosynthese"], "Mathematik", ms3).map((x) => [x.best, x.skills]), [[[], []], [[], []]]);
});

test("Stoff zuordnen: what the teacher picks instead is remembered for the same words", async () => {
  const { stoffVorschlag, merkeZuordnung, stoffSchluessel } = await import("./lehrplan");
  assert.equal(stoffSchluessel("Runden von natürlichen Zahlen"), stoffSchluessel("Runden natürlicher Zahlen"));
  assert.equal(stoffSchluessel("der, die, das"), "");

  // no suggestion → the teacher picks one → the next Stoffzettel with these words has it ticked
  assert.deepEqual(stoffVorschlag(["Kopfrechentricks"], "Mathematik", gym1)[0].best, []);
  merkeZuordnung("Mathematik", "Kopfrechentricks", ["mathe.zahlen.rechengesetze", "gibt.es.nicht"], null);
  const danach = stoffVorschlag(["Kopfrechentricks"], "Mathematik", gym1)[0];
  assert.deepEqual(danach.best, ["mathe.zahlen.rechengesetze"]);
  assert.equal(danach.gemerkt, true);
  assert.equal(danach.skills[0].id, "mathe.zahlen.rechengesetze");
  // only for this subject
  assert.deepEqual(stoffVorschlag(["Kopfrechentricks"], "Deutsch", gym1)[0].best, []);

  // „nothing fits“ is remembered too: a ticked suggestion that was unticked stays unticked
  assert.deepEqual(stoffVorschlag(["Zinsen"], "Mathematik", ms3)[0].best, ["mathe.prozent.zinsen"]);
  merkeZuordnung("Mathematik", "Zinsen", [], null);
  assert.deepEqual(stoffVorschlag(["Zinsen"], "Mathematik", ms3)[0].best, []);
  merkeZuordnung("Mathematik", "Zinsen", ["mathe.prozent.zinsen"], null);

  // an earlier pick from another Thema does not count where the Schularbeit is clearly about something else
  merkeZuordnung("Mathematik", "Vergleichen", ["mathe.zahlen.gross"], null);
  assert.deepEqual(stoffVorschlag(ERSTE_SA, "Mathematik", gym1)[2].best, ["mathe.zahlen.gross"]);
  const brueche = stoffVorschlag(["Erweitern und Kürzen", "Brüche addieren und subtrahieren", "Vergleichen"], "Mathematik", ms2)[2];
  assert.deepEqual(brueche.best, ["mathe.brueche.vergleichen"]);
  assert.equal(brueche.gemerkt, false);
});

test("Stoff zuordnen: Suchwörter find what the skill name does not say", async () => {
  const { matchSkills } = await import("./lehrplan");
  const first = (topic: string, student: object = gym1) => matchSkills(topic, "Mathematik", { student: student as typeof gym1 })[0]?.skill.id;
  assert.equal(first("Stellenwerttafel"), "mathe.zahlen.gross");
  assert.equal(first("der Zahlenstrahl"), "mathe.zahlen.gross");
  assert.equal(first("Überschlagsrechnung"), "mathe.zahlen.runden");
  assert.equal(first("Distributivgesetz"), "mathe.zahlen.rechengesetze");
  assert.equal(first("Brüche dividieren", ms2), "mathe.brueche.dividieren");
  // a common word („Zahlen“) counts less than a rare one: no longer „Sachaufgaben mit natürlichen Zahlen“ first
  assert.equal(first("Runden von natürlichen Zahlen"), "mathe.zahlen.runden");
  assert.equal(first("Addieren natürlicher Zahlen"), "mathe.zahlen.addieren");
});
