/**
 * Selbst schreiben statt auswählen (lib/antwort-schreiben.ts): welche Karten sich schreiben lassen, wie geprüft wird
 * (Tippfehler, streng), was zum Schreiben wiederkommt, und dass lib/lernspiele.ts es in die Runden einbaut. Alle Namen
 * sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { SpielKarte } from "./lernspiele-typen";

process.env.DATABASE_PATH = ":memory:";

const karte = (k: Partial<SpielKarte>): SpielKarte => ({ key: "k", vor: "", nach: "", faecher: [], richtig: "", loesung: "", regel: "", ...k });

test("Prüfen: Groß/klein, Leerzeichen, Apostrophe und Kurzformen zählen nie", async () => {
  const s = await import("./antwort-schreiben");
  assert.equal(s.pruefeSchreiben("  Takes ", "takes", { streng: true }), "richtig");
  assert.equal(s.pruefeSchreiben("is  eating.", "is eating", { streng: true }), "richtig");
  assert.equal(s.pruefeSchreiben("doesn’t play", "does not play", { streng: true, englisch: true }), "richtig");
  assert.equal(s.pruefeSchreiben("does not play", "doesn't play", { streng: true, englisch: true }), "richtig");
  assert.equal(s.pruefeSchreiben("", "takes"), "falsch");
});

test("Prüfen: ein Tippfehler ist „fast“ (zählt), aber nie eine falsche Antwort der Karte", async () => {
  const s = await import("./antwort-schreiben");
  assert.equal(s.pruefeSchreiben("Personifkation", "Personifikation"), "fast");
  assert.equal(s.pruefeSchreiben("Metpaher", "Metapher"), "fast", "zwei Buchstaben vertauscht");
  assert.equal(s.pruefeSchreiben("Baeume", "die Bäume"), "fast", "Umlaut und Artikel");
  assert.equal(s.pruefeSchreiben("die Bäume", "die Bäume"), "richtig");
  assert.equal(s.pruefeSchreiben("Personfikaton", "Personifikation"), "fast", "ab 12 Buchstaben zwei daneben");
  assert.equal(s.pruefeSchreiben("Prsnfkaton", "Personifikation"), "falsch");
  // kurze Wörter müssen stimmen
  assert.equal(s.pruefeSchreiben("nei", "nie"), "falsch");
  // eine falsche Antwort ist kein Tippfehler, auch wenn sie nur einen Buchstaben weg ist
  assert.equal(s.pruefeSchreiben("Metapher", "Metaphern", { falsche: ["Metapher"] }), "falsch");
  // näher an einer falschen Antwort: falsch
  assert.equal(s.pruefeSchreiben("Anaphr", "Anapher", { falsche: ["Anaphra"] }), "falsch");
  // streng: kein Tippfehler zählt
  assert.equal(s.pruefeSchreiben("hofftst", "hofftest", { streng: true }), "falsch");
  // `auch`: eine andere Antwort, die ebenso stimmt
  assert.equal(s.pruefeSchreiben("Metapher", "Personifikation", { auch: ["Metapher"] }), "richtig");
});

test("Prüfen je Spiel: Irregular Verbs und Präteritum streng, Stilmittel mit Tippfehlern", async () => {
  const s = await import("./antwort-schreiben");
  const told = karte({ vor: "Yesterday Noah ", nach: "us a story.", faecher: ["telled", "was telling", "told"], richtig: "told", hinweis: "(tell)" });
  assert.equal(s.pruefeKarte("irregular", told, "Told"), "richtig");
  assert.equal(s.pruefeKarte("irregular", told, "telled"), "falsch");
  assert.equal(s.pruefeKarte("irregular", told, "tolt"), "falsch");
  const stil = karte({ vor: "Die Sonne ", mitte: "lacht", nach: ".", faecher: ["Personifikation", "Vergleich", "Hyperbel"], richtig: "Personifikation", auch: ["Metapher"] });
  assert.equal(s.pruefeKarte("stilmittel", stil, "personifikaton"), "fast");
  assert.equal(s.pruefeKarte("stilmittel", stil, "metapher"), "richtig");
  assert.equal(s.pruefeKarte("stilmittel", stil, "Vergleich"), "falsch");
});

test("Schreibbar: nur, wo die Antwort eindeutig ist", async () => {
  const s = await import("./antwort-schreiben");
  // Verbform mit Grundform: ja; is/am/are ohne Grundform: nein
  assert.equal(s.schreibForm("zeiten", karte({ faecher: ["walks", "walk", "is walking"], richtig: "walks", hinweis: "(walk)" })), "schreiben");
  assert.equal(s.schreibForm("grammatik", karte({ faecher: ["is", "am", "are"], richtig: "is" })), null);
  assert.equal(s.schreibForm("irregular", karte({ form: "legen", faecher: ["telled", "was telling", "told"], richtig: "told" })), "schreiben");
  // der, die, das; Endungen; Wischen: nie
  assert.equal(s.schreibForm("artikel", karte({ wort: "Haus", faecher: ["der", "die", "das"], richtig: "das" })), null);
  assert.equal(s.schreibForm("deklination", karte({ faecher: ["-e", "-en", "-er"], richtig: "-en" })), null);
  assert.equal(s.schreibForm("dasdass", karte({ faecher: ["das", "dass"], richtig: "dass" })), null);
  // die eigenen Fehler: die richtige Stelle schreiben (zwei Antworten reichen)
  assert.equal(s.schreibForm("fehler", karte({ form: "wischen", faecher: ["wieder", "wider"], richtig: "wieder" })), "schreiben");
  // Quiz: eine Frage zu einem Wort ja, „Welcher …?“ und Sätze nein
  assert.equal(s.schreibForm("quizdeutsch", karte({ vor: "Mehrzahl von „der Baum“:", faecher: ["die Baumen", "die Baums", "die Bäume"], richtig: "die Bäume" })), "schreiben");
  assert.equal(s.schreibForm("quizenglisch", karte({ vor: "„always“ heißt", faecher: ["nie", "manchmal", "immer"], richtig: "immer" })), "schreiben");
  assert.equal(s.schreibForm("quizdeutsch", karte({ vor: "Welcher Buchstabe ist ein Selbstlaut?", faecher: ["t", "b", "a"], richtig: "a" })), null);
  assert.equal(s.schreibForm("quizdeutsch", karte({ vor: "Treffender als „machen“ in „Hausübung machen“:", faecher: ["haben", "erledigen", "tun"], richtig: "erledigen" })), null);
  assert.equal(s.schreibForm("quizenglisch", karte({ vor: "Ort vor Zeit – richtig:", faecher: ["a b.", "I go to school every day.", "c d."], richtig: "I go to school every day." })), null);
  assert.equal(s.schreibForm("quizdeutsch", karte({ vor: "Eine Inhaltsangabe schreibt man im", faecher: ["Präteritum", "Futur", "Präsens"], richtig: "Präsens" })), null, "ohne Wort in Anführungszeichen");
  // Mathe-Quiz: eine ganze Zahl am Ziffernblock, gerundete nicht
  assert.equal(s.schreibForm("quizmathe", karte({ mathe: true, vor: "x + 10 = 25, also x =", faecher: ["35", "15", "14", "25"], richtig: "15" })), "tippen");
  assert.equal(s.schreibForm("quizmathe", karte({ mathe: true, vor: "Zylinder: r = 1 cm, h = 17 cm. V =", faecher: ["53,41 cm³", "17,8 cm³"], richtig: "53,41 cm³" })), null);
  assert.equal(s.schreibForm("quizmathe", karte({ mathe: true, vor: "Welche Zahl ist ein Vielfaches von 5?", faecher: ["16", "15", "14"], richtig: "15" })), null);
  // Wortschatz: mit Anfangsbuchstaben
  const w = karte({ vor: "Die alte Tür ", nach: " laut.", faecher: ["knarrte", "kicherte", "tropfte"], richtig: "knarrte" });
  assert.equal(s.schreibForm("wortschatz", w), "schreiben");
  assert.equal(s.schreibAnfang("wortschatz", w), "k");
  assert.equal(s.schreibAnfang("zeiten", w), null);
});

test("Was zum Schreiben kommt: die letzte Antwort war richtig; geschrieben falsch geht zurück zur Auswahl", async () => {
  const s = await import("./antwort-schreiben");
  const st = s.schreibStand([
    [
      { key: "a", form: "kacheln", richtig: true },
      { key: "b", form: "kacheln", richtig: true },
      { key: "c", form: "kacheln", richtig: false },
    ],
    [
      { key: "b", form: "schreiben", richtig: false },
      { key: "d", form: "kacheln", richtig: true },
      { key: "e", form: "schreiben", richtig: true },
    ],
  ]);
  assert.deepEqual([...st.schreiben].sort(), ["a", "d", "e"]);
  // vorziehen: mit Auswahl richtig, noch nie geschrieben; die ältesten zuerst
  assert.deepEqual(st.offen, ["a", "d"]);

  const k = [karte({ key: "a", faecher: ["walks", "walk", "is walking"], richtig: "walks", hinweis: "(walk)" }), karte({ key: "x", faecher: ["takes", "take", "is taking"], richtig: "takes", hinweis: "(take)" })];
  assert.deepEqual(s.mitSchreiben("zeiten", k, { schreiben: st.schreiben }).map((x) => x.form), ["schreiben", undefined]);
  assert.deepEqual(s.mitSchreiben("zeiten", k, { schwer: true }).map((x) => x.form), ["schreiben", "schreiben"]);
  assert.deepEqual(s.mitSchreiben("artikel", k, { schwer: true }), k, "ein Spiel ohne Schreiben bleibt");
});

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Lio Test", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Englisch", "Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, sp, student: repo.getStudent(id)! };
}
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test("Runden: was mit Auswahl richtig war, kommt in der nächsten Runde zum Schreiben; Schwer schreibt alles; Torlauf nie", async () => {
  const { db, sp, student } = await setup();
  const a = sp.starteRunde(student, "irregular", { rng: rng(3) });
  assert.ok(a.karten.length >= 8);
  assert.ok(a.karten.every((k) => k.form !== "schreiben"), "am Anfang: legen");
  sp.beendeRunde(student.id, a.rundeId, a.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  const b = sp.starteRunde(student, "irregular", { rng: rng(4) });
  const vorher = new Set(a.karten.map((k) => k.key));
  const wieder = b.karten.filter((k) => vorher.has(k.key));
  assert.ok(wieder.length >= 2, "zwei kommen gleich wieder");
  assert.ok(wieder.every((k) => k.form === "schreiben"), "zum Schreiben");
  assert.ok(b.karten.filter((k) => !vorher.has(k.key)).every((k) => k.form !== "schreiben"), "neue bleiben beim Legen");
  // gespeichert, wie sie gespielt werden
  const gespeichert = JSON.parse((db().prepare("SELECT karten FROM spielrunden WHERE id = ?").get(b.rundeId) as { karten: string }).karten) as SpielKarte[];
  assert.deepEqual(gespeichert.map((k) => k.form), b.karten.map((k) => k.form));

  const c = sp.starteRunde(student, "irregular", { rng: rng(5), schwer: true });
  assert.ok(c.karten.every((k) => k.form === "schreiben"), "Schwer: alles");
  const t = sp.starteRunde(student, "irregular", { rng: rng(6), schwer: true, endlos: "neu", tor: true });
  assert.ok(t.karten.every((k) => k.form !== "schreiben"), "Torlauf: Tore");
  const t2 = sp.starteRunde(student, "irregular", { rng: rng(7), schwer: true, endlos: t.endlos });
  assert.ok(t2.karten.every((k) => k.form !== "schreiben"), "auch fortgesetzt");
});

test("Quiz: beschreibende Antworten und Silbentrennung", async () => {
  const s = await import("./antwort-schreiben");
  assert.equal(s.schreibForm("quizdeutsch", karte({ vor: "„Die da oben“ gegen „wir hier unten“ baut", faecher: ["ein Feindbild", "x", "y"], richtig: "ein Feindbild" })), null);
  assert.equal(s.schreibForm("quizdeutsch", karte({ vor: "Spannungswörter wie „plötzlich“ gehören", faecher: ["nicht hinein", "x", "y"], richtig: "nicht hinein" })), null);
  assert.equal(s.schreibForm("quizdeutsch", karte({ vor: "Der Mann, der dort steht: „der dort steht“ ist", faecher: ["ein Attributsatz (Relativsatz)", "x", "y"], richtig: "ein Attributsatz (Relativsatz)" })), null);
  assert.equal(s.pruefeSchreiben("Kin-der", "Kin-der"), "richtig");
  assert.equal(s.pruefeSchreiben("Kinder", "Kin-der"), "falsch");
  assert.equal(s.pruefeSchreiben("Ki-nder", "Kin-der"), "falsch");
});

test("Blätter, Europa, Biolabor: beim Üben kommt, was richtig war, zum Schreiben wie im Test", async () => {
  const { sp, student } = await setup();
  const a = sp.starteRunde(student, "blatt", { rng: rng(8), blatt: { modus: "kacheln", alle: true } });
  assert.ok(a.karten.every((k) => k.blatt?.modus === "kacheln"));
  const richtig = new Set(a.karten.filter((_, i) => i % 3 !== 0).map((k) => k.key));
  sp.beendeRunde(student.id, a.rundeId, a.karten.map((k) => ({ key: k.key, wahl: richtig.has(k.key) ? k.richtig : "falsch" })));
  const b = sp.starteRunde(student, "blatt", { rng: rng(9), blatt: { modus: "kacheln", alle: true } });
  for (const k of b.karten) {
    assert.equal(k.blatt?.modus, richtig.has(k.key) ? "schreiben" : "kacheln", k.key);
    if (richtig.has(k.key)) assert.deepEqual(k.faecher, [k.richtig]);
  }

  const e = sp.starteRunde(student, "europa", { rng: rng(10), europa: { modus: "ueben", region: "ost" } });
  sp.beendeRunde(student.id, e.rundeId, e.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  const vorher = new Set(e.karten.map((k) => k.key));
  // nur vier Länder: dieselben kommen wieder
  const f = sp.starteRunde(student, "europa", { rng: rng(11), europa: { modus: "ueben", region: "ost" } });
  const wieder = f.karten.filter((k) => vorher.has(k.key) && k.europa?.teil !== "lage");
  assert.ok(wieder.length > 0, "ein Land kommt wieder");
  assert.ok(wieder.every((k) => k.europa?.antwort === "schreiben"), "Hauptstadt und Flagge: geschrieben");
});
