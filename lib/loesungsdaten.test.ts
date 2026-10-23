import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { freigabeVon, hoehere, isFreigabe, zeigtAlles, zeigtHilfen, zeigtLoesung } from "./freigabe";
import { EIN_SCHRITT, KEIN_WEG, lehrerErklaerung, loesungsdaten, loesungsSchritte, OHNE_SCHRITTE } from "./loesungsdaten";
import type { TaskDraft } from "./tasks";

process.env.DATABASE_PATH = ":memory:";

const task = (t: Partial<TaskDraft>): TaskDraft => ({
  type: "calc",
  skillId: "mathe.brueche.addieren",
  difficulty: "mittel",
  prompt: "",
  data: {},
  answer: {},
  solution: "",
  hints: [],
  errorMap: [],
  ...t,
});

test("Freigabe: alte Zuweisungen behalten, was sie hatten", () => {
  assert.equal(freigabeVon({ freigabe: null, solutions_visible: 0 }), "hilfen", "bisher: Hilfen ja, Lösung erst am Ende");
  assert.equal(freigabeVon({ freigabe: null, solutions_visible: 1 }), "loesung", "bisher „Lösungen freigeben“");
  assert.equal(freigabeVon({ freigabe: "alles", solutions_visible: 1 }), "alles");
  assert.equal(freigabeVon({ freigabe: "quatsch", solutions_visible: 0 }), "hilfen", "Unbekanntes zählt wie früher");
  assert.equal(freigabeVon({}), "hilfen");
  assert.ok(isFreigabe("nichts") && !isFreigabe("Nichts") && !isFreigabe(null));
  assert.deepEqual(
    (["nichts", "hilfen", "loesung", "alles"] as const).map((f) => [zeigtHilfen(f), zeigtLoesung(f), zeigtAlles(f)]),
    [
      [false, false, false],
      [true, false, false],
      [true, true, false],
      [true, true, true],
    ],
  );
  assert.equal(hoehere("hilfen", "loesung"), "loesung");
  assert.equal(hoehere("alles", "loesung"), "alles", "„Lösung zeigen“ nimmt nichts zurück");
});

test("Lösungsschritte: für jeden Typ welche, oder der Grund, warum keine", () => {
  assert.deepEqual(loesungsSchritte(task({ solutionSteps: [" 1/2 + 1/4 ", "= 3/4", ""] })).schritte, ["1/2 + 1/4", "= 3/4"]);
  assert.deepEqual(loesungsSchritte(task({ type: "free", solution: "Musterantwort" })), { schritte: [], ohneSchritte: OHNE_SCHRITTE.free });
  assert.equal(loesungsSchritte(task({ type: "memorize" })).ohneSchritte, OHNE_SCHRITTE.memorize);
  assert.deepEqual(loesungsSchritte(task({ type: "order", answer: { steps: ["Erst", "Dann"] } })).schritte, ["Erst", "Dann"]);
  assert.deepEqual(loesungsSchritte(task({ type: "fix", answer: { fixes: [{ wrong: "meinen", right: "meinem", label: "Dativ nach „mit“" }] } })).schritte, ["„meinen“ → „meinem“: Dativ nach „mit“"]);
  assert.deepEqual(
    loesungsSchritte(task({ type: "zuordnung", data: { zuordnung: { statements: ["a", "b"], options: ["eins", "zwei", "drei", "vier"] } }, answer: { pairs: [2, 0] } })).schritte,
    ["1 → C: drei", "2 → A: eins"],
  );
  assert.deepEqual(loesungsSchritte(task({ solution: "6/8 + 1/8\n= 7/8" })).schritte, ["6/8 + 1/8", "= 7/8"]);
  assert.deepEqual(loesungsSchritte(task({ type: "cloze", answer: { blanks: [["der"], ["die"]] } })).schritte, ["Lücke 1: der", "Lücke 2: die"]);
  assert.deepEqual(loesungsSchritte(task({ type: "grammar", solution: "went" })), { schritte: [], ohneSchritte: EIN_SCHRITT });
  assert.deepEqual(loesungsSchritte(task({})), { schritte: [], ohneSchritte: KEIN_WEG });
});

test("Erklärung für den Lehrer: eigene vor der der Fähigkeit; falsche Antworten mit Grund", () => {
  const ohne = lehrerErklaerung(task({}));
  assert.ok(ohne.erklaerung.length > 20, "die Fähigkeit hat eine Erklärung");
  assert.ok(ohne.achten.length > 0, "ohne eigene Fehler die typischen der Fähigkeit");
  assert.equal(lehrerErklaerung(task({ teacherNote: "  Auf den Nenner schauen.  " })).erklaerung, "Auf den Nenner schauen.");
  const mc = lehrerErklaerung(task({ type: "mc", data: { options: ["1/2", "1/3"] }, errorMap: [{ answer: "1", label: "Größerer Nenner" }] }));
  assert.deepEqual(mc.achten, ["b) 1/3: Größerer Nenner"]);
  assert.deepEqual(loesungsdaten(task({ altWays: [" Über 1 % ", ""] })).wege, ["Über 1 %"]);
  assert.equal(lehrerErklaerung(task({ skillId: "gibt.es.nicht" })).erklaerung, "");
});

test("Generatoren liefern andere Wege nur, wo es sie gibt", async () => {
  const { generateForSlot } = await import("./generators");
  const slot = (skillId: string, difficulty: "sehr leicht" | "mittel") => ({ skillId, skillName: skillId, difficulty, category: "rechnung", subject: "Mathematik" });
  let r = 7;
  const rng = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const prozent = generateForSlot(slot("mathe.prozent.prozentwert", "mittel"), rng);
  assert.ok(prozent.altWays?.some((w) => w.startsWith("Mit dem Faktor")), "Prozentwert: mit dem Faktor");
  // zwei Zahlen addieren: dafür gibt es keinen zweiten Weg
  for (let i = 0; i < 10; i++) assert.deepEqual(generateForSlot(slot("mathe.negativ.addieren", "sehr leicht"), rng).altWays ?? [], []);
});

// ---------- Was bei Schülern ankommt ----------

const GEHEIM = {
  loesung: "LOESUNG-7Q",
  schritt: "SCHRITT-7Q",
  notiz: "NOTIZ-7Q",
  weg: "WEG-7Q",
  hilfe: "HILFE-7Q",
  antwort: "ANTWORT-7Q",
};

async function setup() {
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const { buildWorksheet } = await import("./service");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Lena Probe", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count: 1, taskType: "calc", useAI: false });
  const [t] = repo.listTasks(wid);
  repo.updateTask(t.id, {
    ...t,
    prompt: "Kürze 4/8.",
    answer: { accepted: [GEHEIM.antwort], mode: "text" },
    solution: GEHEIM.loesung,
    solutionSteps: [GEHEIM.schritt, "zweiter Schritt"],
    teacherNote: GEHEIM.notiz,
    altWays: [GEHEIM.weg],
    hints: [GEHEIM.hilfe],
  });
  return { repo, sid, wid, taskId: t.id };
}

const finde = (json: string) => Object.entries(GEHEIM).filter(([, v]) => json.includes(v)).map(([k]) => k);

test("Schülerdaten: nur was freigegeben ist, wird überhaupt geschickt", async () => {
  const { repo, sid, wid } = await setup();
  const { clientTasks } = await import("./solver-tasks");
  const aid = repo.assignWorksheet(wid, sid);
  const gesendet = () => finde(JSON.stringify(clientTasks(repo.getAssignment(aid)!)));

  // eine alte Zuweisung ohne Freigabe: wie bisher nur Hilfen
  assert.equal(repo.getAssignment(aid)!.freigabe, null);
  assert.deepEqual(gesendet(), ["hilfe"]);
  repo.setFreigabe(aid, "nichts");
  assert.deepEqual(gesendet(), []);
  repo.setFreigabe(aid, "hilfen");
  assert.deepEqual(gesendet(), ["hilfe"]);
  repo.setFreigabe(aid, "loesung");
  assert.deepEqual(gesendet(), ["loesung", "hilfe", "antwort"]);
  assert.equal(repo.getAssignment(aid)!.solutions_visible, 1, "ältere Leser sehen „Lösungen freigegeben“");
  repo.setFreigabe(aid, "alles");
  assert.deepEqual(gesendet(), Object.keys(GEHEIM));
  // der alte Schalter setzt die passende Stufe
  repo.setSolutionsVisible(aid, false);
  assert.equal(freigabeVon(repo.getAssignment(aid)!), "hilfen");
  assert.equal(repo.getAssignment(aid)!.solutions_visible, 0);
});

test("Schülerdaten: alte Zuweisung mit freigegebenen Lösungen bleibt bei „Hilfen und Lösung“", async () => {
  const { repo, sid, wid } = await setup();
  const { db } = await import("./db");
  const { clientTasks } = await import("./solver-tasks");
  const aid = repo.assignWorksheet(wid, sid);
  db().prepare("UPDATE assignments SET solutions_visible = 1, freigabe = NULL WHERE id = ?").run(aid);
  assert.deepEqual(finde(JSON.stringify(clientTasks(repo.getAssignment(aid)!))), ["loesung", "hilfe", "antwort"]);
});

test("Schülerdaten: ein Minitest gibt nichts frei, auch bei „Alles“", async () => {
  const { repo, sid, wid } = await setup();
  const { clientTasks } = await import("./solver-tasks");
  const aid = repo.assignWorksheet(wid, sid, "", null, "test");
  repo.setFreigabe(aid, "alles");
  assert.deepEqual(finde(JSON.stringify(clientTasks(repo.getAssignment(aid)!))), []);
});

test("Schülertafel und Schülerblatt: nie Erklärung, Schritte oder Wege", async () => {
  const { repo, taskId } = await setup();
  const { boardTaskForStudent } = await import("./whiteboard-content");
  assert.deepEqual(finde(JSON.stringify(boardTaskForStudent(repo.getTask(taskId)!))), []);

  const { buildSheet, DEFAULTS } = await import("./arbeitsblatt");
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  const t = repo.getTask(taskId)!;
  const doc = buildSheet({ title: "Brüche", subject: "Mathematik", klasseLabel: "Mittelschule, 2. Klasse", topic: "Brüche", studentName: "Lena Probe", tasks: [t] }, () => "Kürzen", DEFAULTS);
  const render = (o: Partial<typeof DEFAULTS>) => renderToStaticMarkup(createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Brüche", ...o } }));
  // Schülerfassung, auch mit Lösungsseite: Lösung ja (der Lehrer druckt sie bewusst), Lehrerdaten nie
  assert.deepEqual(finde(render({})), []);
  const seite = finde(render({ solutions: "seite" }));
  for (const nie of ["notiz", "weg", "hilfe"]) assert.ok(!seite.includes(nie), `Lösungsseite zeigt ${nie}`);
  // Lehrerfassung: alles (die Schritte stehen dort an Stelle des Lösungstexts)
  const lehrer = render({ solutions: "lehrer", fassung: "lehrer" });
  for (const k of ["antwort", "schritt", "notiz", "weg"]) assert.ok(finde(lehrer).includes(k), `Lehrerfassung ohne ${k}`);
  assert.ok(lehrer.includes("Für dich:") && lehrer.includes("Anderer Weg:"));
});
