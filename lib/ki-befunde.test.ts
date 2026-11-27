/**
 * Befunde aus dem Test mit echter KI (27.11.2026, KI1 bis KI12), soweit sie ohne Datenbank prüfbar sind: gemischte Zahlen im
 * Rechenweg, Brüche auf Folien, Beispielnamen, vertauschte Summanden, das Blatt zum Fotografieren ohne Namen, die Zeile im
 * Abschluss für das Heft am Tablet. Kein Schlüssel, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { beispielNamen, beispielNamenZeile } from "./ai/beispielnamen";
import { druckLinkZumFotografieren, readOptions } from "./arbeitsblatt";
import { papierZeile } from "./blatt-regeln";
import { generateBuiltIn } from "./generators";
import { evaluate, parseExpr } from "./math-expr";
import { checkOwnSolution } from "./math-task";
import { ohneReihenfolge } from "./math-text";
import { blockHtml, deckHtml, inline } from "./praesentation-html";

const wert = (s: string) => {
  const n = parseExpr(s);
  return n ? evaluate(n) : null;
};
const rechenweg = (start: string, accepted: string[], solutionSteps: string[] = []) => checkOwnSolution({ type: "rechenweg", prompt: "Berechne.", data: { start }, answer: { accepted }, solutionSteps } as never);

// ---------- KI3 ----------

test("KI3: eine gemischte Zahl ist eine Zahl: „1 3/8“ ist 11/8, auch mitten in einer Rechnung", () => {
  assert.equal(wert("1 3/8"), 1.375);
  assert.equal(wert("-1 3/8"), -1.375);
  assert.equal(wert("5 - 1 3/8"), 3.625);
  assert.equal(wert("2 · 1 1/2"), 3);
  assert.equal(wert("12 3/4"), 12.75);
  assert.equal(wert("1 1/2 + 2 3/4"), 4.25);
});

test("KI3: zwei Zahlen nebeneinander ohne Bruch bleiben unlesbar, ein Komma davor macht keine gemischte Zahl", () => {
  assert.equal(wert("3 4"), null);
  assert.equal(wert("1,5 3/4"), null);
  assert.equal(wert("1 3/4/5"), null);
});

test("KI3: eine Aufgabe der KI mit gemischter Zahl als Ergebnis besteht die Prüfung der App", () => {
  assert.equal(rechenweg("5/8 + 3/4", ["1 3/8"]), null);
  assert.equal(rechenweg("5/8 + 3/4", ["1 3/8"], ["5/8 + 6/8", "11/8", "1 3/8"]), null);
  assert.equal(rechenweg("1 1/2 + 2 3/4", ["4 1/4"], ["3/2 + 11/4", "17/4", "4 1/4"]), null);
  assert.equal(rechenweg("5/8 + 3/4", ["1 2/8"]), "Das Ergebnis passt nicht zur Angabe.", "ein falsches Ergebnis fällt weiter auf");
});

// ---------- KI6 ----------

test("KI6: Folien zeigen Brüche mit Bruchstrich, wie überall in der App", () => {
  assert.equal(inline("1/2 + 1/3"), '<span class="bruch"><span>1</span><span>2</span></span> + <span class="bruch"><span>1</span><span>3</span></span>');
  assert.match(blockHtml({ art: "merksatz", text: "**Erweitern:** 1/2 = 3/6", punkte: [], zeilen: [], schritt: false }), /<strong>Erweitern:<\/strong> <span class="bruch"><span>1<\/span><span>2<\/span><\/span> = <span class="bruch">/);
  assert.match(deckHtml({ titel: "Brüche", folien: [] }), /\.bruch\{/, "die Folien bringen ihre eigene Darstellung mit");
});

test("KI6: was kein Bruch ist, bleibt Text: Wörter, Seiten, Schuljahre; und nichts wird zu Markup", () => {
  assert.equal(inline("und/oder, 60 km/h"), "und/oder, 60 km/h");
  assert.equal(inline("Buch S. 86/87"), "Buch S. 86/87");
  assert.equal(inline("Seite 12/13 lesen"), "Seite 12/13 lesen");
  assert.equal(inline("Schuljahr 2026/27"), "Schuljahr 2026/27");
  assert.equal(inline('<b>1/2</b> "x"'), '&lt;b&gt;<span class="bruch"><span>1</span><span>2</span></span>&lt;/b&gt; &quot;x&quot;');
});

// ---------- KI7 ----------

test("KI7: Beispielnamen sind nie der Name eines Schülers oder einer Lehrkraft der App", () => {
  const namen = beispielNamen(["Lena Test", "Jonas Huber", "Mia Mustermann"], 3);
  assert.equal(namen.length, 4);
  assert.ok(!namen.some((n) => ["Lena", "Jonas", "Mia", "Huber", "Test"].includes(n)), namen.join(", "));
  assert.notDeepEqual(beispielNamen([], 1), beispielNamen([], 2), "nicht immer dieselben vier");
  assert.deepEqual(beispielNamen([], 5), beispielNamen([], 5), "derselbe Lauf, dieselben Namen");
});

test("KI7: die Zeile für die KI nennt nur die erlaubten Vornamen, nie einen echten", () => {
  const zeile = beispielNamenZeile(["Emil", "Sara"]);
  assert.match(zeile, /Emil, Sara/);
  assert.match(zeile, /nur/);
  assert.equal(beispielNamenZeile([]), "");
});

// ---------- KI11 ----------

test("KI11: vertauschte Summanden oder Faktoren sind dieselbe Rechnung", () => {
  assert.equal(ohneReihenfolge("Berechne und kürze das Ergebnis: 3/4 + 3/10"), ohneReihenfolge("Berechne und kürze das Ergebnis: 3/10 + 3/4"));
  assert.equal(ohneReihenfolge("7 · 8"), ohneReihenfolge("8 · 7"));
  assert.notEqual(ohneReihenfolge("Berechne: 3/4 - 3/10"), ohneReihenfolge("Berechne: 3/10 - 3/4"), "Minus ist nicht vertauschbar");
  assert.equal(ohneReihenfolge("Berechne: 3 + 4 · 5"), "Berechne: 3 + 4 · 5", "gemischte Rechnungen bleiben, wie sie sind");
  assert.equal(ohneReihenfolge("Schreib den Satz richtig: der hund + die katze"), "Schreib den Satz richtig: der hund + die katze");
});

test("KI11: ein Blatt Brüche addieren stellt keine Rechnung zweimal, auch nicht vertauscht", () => {
  for (const id of ["mathe.brueche.addieren", "mathe.brueche.multiplizieren"]) {
    for (let seed = 1; seed <= 40; seed++) {
      const tasks = generateBuiltIn({ subject: "Mathematik", skills: [{ id, name: id }], difficulty: "mittel", count: 8, taskType: "mixed", seed, grade: 6 } as never);
      const rechnungen = tasks.map((t) => ohneReihenfolge(t.prompt.split("\n")[0]));
      assert.equal(new Set(rechnungen).size, rechnungen.length, `${id} (seed ${seed}): ${tasks.map((t) => t.prompt.split("\n")[0]).join(" | ")}`);
    }
  }
});

// ---------- KI2 ----------

test("KI2: ein Blatt, das danach fotografiert wird, druckt kein Namensfeld; die Lehrkraft kann es wieder einschalten", () => {
  const link = druckLinkZumFotografieren(12, 7);
  assert.equal(link, "/arbeitsblatt/12?einheit=7&name=0");
  const sp = Object.fromEntries(new URL(link, "http://x").searchParams);
  assert.equal(readOptions(sp, "Brüche").name, false);
  assert.equal(readOptions({ ...sp, name: "1" }, "Brüche").name, true);
});

// ---------- KI9 ----------

test("KI9: das Heft am Tablet heißt im Abschluss nicht „Auf Papier“, und leere Aufgaben stehen als „nicht bearbeitet“ da", () => {
  const basis = { titel: "Brüche addieren", von: 7, richtig: 6, teilweise: 0, punkte: null, max: null, unsicher: 0 };
  assert.equal(papierZeile({ ...basis, heft: true, leer: 1 }), "Im Heft am Tablet: Übung „Brüche addieren“ 6 von 7 richtig, 1 nicht bearbeitet");
  assert.equal(papierZeile({ ...basis, heft: true }), "Im Heft am Tablet: Übung „Brüche addieren“ 6 von 7 richtig");
  assert.equal(papierZeile(basis), "Auf Papier: Übung „Brüche addieren“ 6 von 7 richtig", "Papier bleibt Papier");
});

// ---------- KI3, KI11: das Übungsblatt aus „Stoff vorbereiten“ ----------

const ADD = "mathe.brueche.addieren";
const kiAufgabe = (o: Record<string, unknown>) => ({
  category: "rechnung", format: "calc", skill_ids: [ADD], topic: "Brüche addieren", difficulty: "mittel", passage: null, options: null, correct_option: null,
  accepted_answers: null, numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null,
  text_errors: null, answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null,
  criteria: [], solution: "", solution_steps: [], estimated_time_sec: 60, hints: ["Bring beide Brüche auf denselben Nenner."], common_errors: [], ...o,
});
const kiRechenweg = (start: string, ergebnis: string, weg: string[]) => kiAufgabe({ category: "rechenweg", format: "rechenweg", prompt: `Berechne ${start} und schreib den Rechenweg auf.`, math_start: start, accepted_answers: [ergebnis], solution_steps: weg });

test("KI3 und KI11: gemischte Zahl bleibt am Blatt, vertauschte Rechnung nur einmal, und was wegfällt, steht in einfachen Worten da", async () => {
  const { stoffpaketAusAntwort } = await import("./ai/stoffpaket");
  const raw = {
    thema: "Brüche addieren", skill_ids: [ADD], unsicher: [], lernzettel: null, unterricht: null, test: [], vorbereitungstest: [], spielkarten: [],
    uebungsblatt: [
      kiRechenweg("5/8 + 3/4", "1 3/8", ["5/8 + 6/8", "11/8", "1 3/8"]),
      kiAufgabe({ prompt: "Berechne: 3/10 + 3/4", accepted_answers: ["21/20"] }),
      kiAufgabe({ prompt: "Berechne: 3/4 + 3/10", accepted_answers: ["21/20"] }),
      kiRechenweg("1/2 + 1/3", "5/7", ["1/2 + 1/3", "5/7"]),
    ],
  };
  const e = stoffpaketAusAntwort(raw as never, { fach: "Mathematik", teile: ["uebung"], faehigkeiten: [{ id: ADD, name: "Brüche addieren", area: "Brüche", subject: "Mathematik" }], schulart: "Mittelschule", klasse: 2 }, () => 0.5);
  const blatt = e.blaetter.uebung;
  assert.deepEqual(blatt.map((t) => t.type), ["rechenweg", "calc"], "die gemischte Zahl ist dabei, die vertauschte Rechnung nur einmal");
  assert.deepEqual(blatt[0].answer.accepted, ["1 3/8"]);
  assert.equal(e.weggelassen.length, 1, e.weggelassen.join("\n"));
  assert.equal(e.weggelassen[0], "Übungsblatt, Aufgabe 4 fehlt: Die Lösung der KI passt nicht zur Angabe, darum hat die App die Aufgabe weggelassen.");
  assert.doesNotMatch(e.weggelassen.join(" "), /rechenweg:|\[Start|Prüfung nicht bestanden/, "keine technische Meldung für die Lehrkraft");
});
