/**
 * Gemeinsame Bewertung (lib/zu-bewerten.ts, lib/bewerten.ts): Gerät, Papier, Probeschularbeit und Text in einer Liste „Zu
 * bewerten“, je Einheit und je Schüler; eine offene Antwort zählt nirgends, bis die Lehrkraft sie bewertet, und die Bewertung
 * aus der Liste ist dieselbe wie auf der Ergebnis-Seite.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Die Seiten sind ein paar erfundene Bytes mit dem Anfang
 * einer JPEG-Datei. Alle Namen und Aufgaben sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BlattMitAufgabenGelesen } from "./ai";
import type { TaskDraft } from "./tasks";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "zu-bewerten-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundene Seite eines gezeichneten Blatts")]);
const BR = "mathe.brueche.addieren";
const GL = "mathe.gleichungen.einfach";

const draft = (o: Partial<TaskDraft> & Pick<TaskDraft, "type" | "prompt" | "answer">): TaskDraft => ({ skillId: BR, skillIds: [BR], difficulty: "mittel", data: {}, solution: "", hints: [], errorMap: [], ...o });
/** Für das Papier: dieselben vier Aufgaben wie in lib/papier-einheit.test.ts */
const PAPIER: TaskDraft[] = [
  draft({ type: "calc", prompt: "1/2 + 1/4 = ?", answer: { accepted: ["3/4"], mode: "value" }, solution: "2/4 + 1/4 = 3/4" }),
  draft({ type: "rechenweg", skillId: GL, skillIds: [GL], prompt: "Löse die Gleichung.", data: { start: "3x + 7 = 22" }, answer: { accepted: ["5"], needWay: true }, solutionSteps: ["3x = 15", "x = 5"] }),
  draft({ type: "calc", prompt: "Wie viel sind 15 % von 80?", answer: { accepted: ["12"], mode: "value" }, solution: "80 : 100 · 15 = 12" }),
  draft({ type: "mc", prompt: "Wie viele Drittel sind ein Ganzes?", data: { options: ["2", "3", "4"] }, answer: { correct: 1 } }),
];
const LESUNG: BlattMitAufgabenGelesen = {
  aufgaben: [
    { nr: 1, antwort: "3/4", rechenweg: [], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
    { nr: 2, antwort: "x = 5", rechenweg: ["3x = 15", "x = 5"], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
    // the reading says right, the app checks 15 against 12
    { nr: 3, antwort: "15", rechenweg: [], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
    { nr: 4, antwort: "B", rechenweg: [], bewertung: "richtig", unsicher: true, grund: "Das Kreuz ist undeutlich.", punkte: null },
  ],
  anderes_blatt: false,
};

async function setup() {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const service = await import("./service");
  const p = await import("./papier-einheit");
  const zb = await import("./zu-bewerten");
  const { bewerteAntwort } = await import("./bewerten");
  const { saveUpload } = await import("./materials");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({ name, grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const blatt = (studentId: number | null, title: string, tasks: TaskDraft[]) =>
    repo.createWorksheet(
      { title, subject: "Mathematik", grade: 7, school_type: "Mittelschule", klasse: 3, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [BR, GL], status: "freigegeben", student_id: studentId },
      tasks,
    );
  const seite = (sid: number) => saveUpload({ name: "seite.jpg", data: JPEG }, { title: "Gelöstes Blatt", subject: "Mathematik", studentId: sid, teacherId: teacher.id }).id;
  /** am Gerät antworten, wie der Schüler: in der laufenden Einheit bekommt die Antwort ihre unit_id */
  const antworte = async (sid: number, aid: number, taskId: number, answer: string) => {
    const s = repo.getStudent(sid)!;
    await service.submitAnswer({ token: s.access_token, assignmentId: aid, taskId, answer, timeMs: 30_000, hintsUsed: 0 });
    return repo.listAttemptsForAssignment(aid).filter((a) => a.task_id === taskId).at(-1)!;
  };
  /** eine Probeschularbeit zu einer geplanten Schularbeit: drei Teilaufgaben mit Musterlösung und Punkten */
  const probe = (sid: number) => {
    const testId = repo.addTest({
      student_id: sid, date: "2026-11-20", subject: "Mathematik", kind: "Schularbeit", topic: "Brüche", grade: null, points: null, max_points: null, notes: "",
      skill_ids: [BR], title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null,
    });
    const ws = blatt(sid, "Probeschularbeit: Brüche", [
      draft({ type: "free", prompt: "Erkläre, warum 2/4 und 1/2 gleich groß sind.", answer: { sample: "Man kann 2/4 mit 2 kürzen." }, solution: "Kürzen mit 2 gibt 1/2.", data: { nummer: "1a" } }),
      draft({ type: "free", prompt: "Wie kürzt man 6/8?", answer: { sample: "Durch 2: 3/4" }, solution: "6/8 = 3/4", data: { nummer: "1b" } }),
      draft({ type: "free", prompt: "Wie viel sind 15 % von 80?", answer: { sample: "12" }, solution: "80 : 100 · 15 = 12", data: { nummer: "2" } }),
    ]);
    db().prepare("UPDATE worksheets SET probe_test_id = ?, kind = 'ueberpruefung' WHERE id = ?").run(testId, ws);
    const tasks = repo.listTasks(ws);
    [2, 1, 3].forEach((pt, i) => db().prepare("UPDATE tasks SET points = ? WHERE id = ?").run(pt, tasks[i].id));
    return { testId, ws, tasks };
  };
  return { db, repo, units, service, p, zb, bewerteAntwort, teacher, schueler, blatt, seite, antworte, probe };
}

async function mitKi(antwort: BlattMitAufgabenGelesen) {
  process.env.ANTHROPIC_API_KEY = "test-nicht-echt";
  const router = await import("./ai/router");
  router.resetRouter();
  router.setTransport(async (req) => ({ parsed: antwort, refusal: false, model: req.model, usage: { input: 5_000, output: 1_200, cacheWrite: 0, cacheRead: 0, reasoning: 0 } }));
  return () => {
    router.setTransport(null);
    delete process.env.ANTHROPIC_API_KEY;
  };
}

test("one list for a unit and for a student: device, paper, Probeschularbeit and text, with why each is open; never another student's", async () => {
  const s = await setup();
  const mara = s.schueler("Mara Feldner");
  const timo = s.schueler("Timo Brandl");
  const unit = s.units.startUnit(s.teacher.id, mara, { subject: "Mathematik", at: Date.now() - 30 * 60_000 }).unit;

  // Gerät: a free answer with a solution, and one whose task has none
  const frei = s.blatt(mara, "Mara – Erklären", [
    draft({ type: "free", prompt: "Erkläre, was ein Nenner ist.", answer: { sample: "Die Zahl unter dem Bruchstrich." } }),
    draft({ type: "free", prompt: "Schreib eine eigene Bruchaufgabe.", answer: { sample: "" } }),
  ]);
  const freiAid = s.repo.assignWorksheet(frei, mara, "", unit.id);
  const [erklaeren, eigene] = s.repo.listTasks(frei);
  await s.antworte(mara, freiAid, erklaeren.id, "Die untere Zahl.");
  await s.antworte(mara, freiAid, eigene.id, "3/5 + 1/5");

  // Papier: two rows stay unsure and undecided at „Übernehmen“
  const papier = s.blatt(mara, "Mara – Brüche und Gleichungen", PAPIER);
  const papierAid = s.repo.assignWorksheet(papier, mara, "", unit.id);
  const aus = await mitKi(LESUNG);
  let v;
  try {
    v = await s.p.liesPapier({ unitId: unit.id, blattKey: `z${papierAid}`, materialIds: [s.seite(mara)], teacherId: s.teacher.id });
  } finally {
    aus();
  }
  assert.ok(v.lesungId, "the reading is kept on the server");
  const out = s.p.speicherePapier({ unitId: unit.id, teacherId: s.teacher.id, blatt: `z${papierAid}`, materialIds: [], gelesen: "ki", zeilen: v.zeilen });
  assert.ok(!("error" in out), JSON.stringify(out));
  const papierAntworten = s.repo.listAttemptsForAssignment(papierAid);
  assert.equal(papierAntworten.length, 4);
  assert.equal(papierAntworten.filter((a) => a.review === "offen").length, 2, "the two unsure rows wait for the teacher");
  assert.equal(s.repo.listAttemptsForUnit(unit.id).filter((a) => a.assignment_id === papierAid).length, 2, "only the decided ones count");

  // Probeschularbeit am Gerät
  const pr = s.probe(mara);
  const probeAid = s.repo.assignWorksheet(pr.ws, mara, "", unit.id);
  await s.antworte(mara, probeAid, pr.tasks[0].id, "Weil man kürzen kann.");

  // Text with Arbeitsaufträge, handed in, no grade yet
  const { createText, setTextStatus } = await import("./texts");
  const text = createText({ studentId: mara, teacherId: s.teacher.id, unitId: unit.id, subject: "Deutsch", topic: "Bericht", title: "Mein Schulweg", prompt: "1. Beschreibe deinen Schulweg.\n2. Nenne zwei Gefahren." });
  setTextStatus(text.id, "fertig");

  // another student's open answer, in no unit
  const fremd = s.blatt(timo, "Timo – Erklären", [draft({ type: "free", prompt: "Erkläre, was ein Zähler ist.", answer: { sample: "Die obere Zahl." } })]);
  const fremdAid = s.repo.assignWorksheet(fremd, timo);
  await s.antworte(timo, fremdAid, s.repo.listTasks(fremd)[0].id, "oben");

  const liste = s.zb.zuBewerten({ unitId: unit.id });
  const art = (z: (typeof liste)[number]) => `${z.quelle}:${z.grund}`;
  assert.deepEqual(liste.map(art), ["geraet:frei", "geraet:loesung", "papier:app", "papier:ki", "probe:frei", "text:frei"]);
  assert.ok(liste.every((z) => z.studentId === mara), "never another student's");
  const [g, ohneLoesung, app, ki, pz, t] = liste;
  assert.ok(g.art === "antwort" && g.antwort === "Die untere Zahl." && g.loesung === "Die Zahl unter dem Bruchstrich." && g.max === null);
  assert.ok(ohneLoesung.art === "antwort" && ohneLoesung.loesung === "");
  assert.ok(app.art === "antwort" && app.antwort === "15" && /App prüft die Antwort als falsch/.test(app.grundText) && app.loesung.includes("12"));
  assert.ok(ki.art === "antwort" && ki.grundText === "Das Kreuz ist undeutlich." && ki.vorschlag === "richtig");
  assert.ok(pz.art === "antwort" && pz.max === 2 && pz.nr === "1a" && pz.titel === "Brüche" && pz.loesung === "Kürzen mit 2 gibt 1/2.");
  assert.ok(t.art === "text" && t.textId === text.id && t.href === `/texte/${text.id}/korrektur`);
  assert.equal(s.zb.zuBewertenTitel(liste), "5 Antworten und 1 Text noch zu bewerten");

  // the student's list: the same rows (all of them belong to this unit), Timo's only his own
  assert.deepEqual(s.zb.zuBewerten({ studentId: mara }).map((z) => z.key), liste.map((z) => z.key));
  assert.deepEqual(s.zb.zuBewerten({ studentId: timo }).map(art), ["geraet:frei"]);
  assert.deepEqual(s.zb.zuBewerten({ unitId: 9999 }), []);

  // „Zu erledigen“ on the start page leads into this list
  const { zuErledigen } = await import("./zu-erledigen");
  const { wienerDatum } = await import("./planung/zeit");
  s.repo.completeAssignmentIfDone(freiAid);
  const punkt = zuErledigen(s.teacher.id, wienerDatum(new Date())).offen.find((x) => x.key === `a${freiAid}`);
  assert.equal(punkt?.href, `/schueler/${mara}#zu-bewerten`);
});

test("grading in the list writes what the result page writes: the same answer row, Lernstand and points", async () => {
  const s = await setup();
  const { reviewAnswer, analyzeStudent } = s.service;
  const zwilling = async (name: string) => {
    const sid = s.schueler(name);
    const ws = s.blatt(sid, `${name} – Erklären`, [
      draft({ type: "free", prompt: "Erkläre, was ein Nenner ist.", answer: { sample: "Die Zahl unter dem Bruchstrich." } }),
      draft({ type: "calc", prompt: "1/3 + 1/3 = ?", answer: { accepted: ["2/3"], mode: "value" } }),
    ]);
    const aid = s.repo.assignWorksheet(ws, sid);
    const [frei, calc] = s.repo.listTasks(ws);
    await s.antworte(sid, aid, calc.id, "2/3");
    return { sid, a: await s.antworte(sid, aid, frei.id, "Die untere Zahl.") };
  };
  const ueberListe = await zwilling("Lia Sommer");
  const ueberSeite = await zwilling("Ida Sommer");
  assert.equal(ueberListe.a.review, "offen");
  assert.equal(analyzeStudent(ueberListe.sid)!.skills.find((x) => x.skill.id === BR)?.tasksDone, 1, "an open answer does not count yet");

  const zeile = s.zb.zuBewerten({ studentId: ueberListe.sid })[0];
  assert.ok(zeile.art === "antwort" && zeile.attemptId === ueberListe.a.id);
  assert.ok(!("error" in s.bewerteAntwort(zeile.attemptId, "teilweise", s.teacher.id)));
  assert.ok(!("error" in reviewAnswer(ueberSeite.a.id, "teilweise", s.teacher.id)));

  const zeileVon = (id: number) => {
    const { review, correct, review_by, final } = s.repo.getAttempt(id)!;
    return { review, correct, review_by, final };
  };
  assert.deepEqual(zeileVon(ueberListe.a.id), zeileVon(ueberSeite.a.id));
  assert.deepEqual(zeileVon(ueberListe.a.id), { review: "teilweise", correct: 0, review_by: s.teacher.id, final: 1 });
  const stand = (sid: number) => analyzeStudent(sid)!.skills.filter((x) => x.mastery !== null).map((x) => [x.skill.id, Math.round(x.mastery! * 1000) / 1000]); // seconds apart: rounded
  assert.deepEqual(stand(ueberListe.sid), stand(ueberSeite.sid), "the same Lernstand");
  assert.equal(s.repo.listAttemptsForStudent(ueberListe.sid).length, 2, "now it counts");
  assert.deepEqual(s.zb.zuBewerten({ studentId: ueberListe.sid }), [], "graded: out of the list");
  assert.deepEqual(s.bewerteAntwort(ueberListe.a.id, "vielleicht", s.teacher.id), { error: "Unbekannte Bewertung." });
});

test("open answers count neither for „Gut verstanden“ nor „Noch schwierig“ nor the Lernstand; the confirmed documentation says „Bewertung offen“ and follows a later grade", async () => {
  const s = await setup();
  const ab = await import("./abschluss");
  const { endUnit, readReport } = await import("./learning");
  const sid = s.schueler("Noah Wieser");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik", at: Date.now() - 40 * 60_000 }).unit;
  const ws = s.blatt(sid, "Noah – Brüche", [
    draft({ type: "calc", prompt: "1/5 + 2/5 = ?", answer: { accepted: ["3/5"], mode: "value" } }),
    draft({ type: "calc", prompt: "1/7 + 3/7 = ?", answer: { accepted: ["4/7"], mode: "value" } }),
    draft({ type: "calc", prompt: "2/9 + 5/9 = ?", answer: { accepted: ["7/9"], mode: "value" } }),
    draft({ type: "free", prompt: "Erkläre, wie man gleichnamige Brüche addiert.", answer: { sample: "Zähler addieren, Nenner bleibt." } }),
  ]);
  const aid = s.repo.assignWorksheet(ws, sid, "", unit.id);
  const tasks = s.repo.listTasks(ws);
  for (const [i, a] of ["3/5", "4/7", "7/9"].entries()) await s.antworte(sid, aid, tasks[i].id, a);
  const offen = await s.antworte(sid, aid, tasks[3].id, "Man addiert alles.");
  assert.equal(offen.review, "offen");
  assert.equal(s.repo.listAttemptsForStudent(sid).length, 3, "the Lernstand reads only the three checked answers");

  const lessonId = endUnit(unit.id, { byTeacherId: s.teacher.id })!;
  let lesson = s.repo.getLesson(lessonId)!;
  assert.equal(readReport(lesson)!.tasks.length, 3, "the open answer is not in the unit's report");
  let karte = ab.karteDerEinheit(unit.id, lesson);
  const offenZeile = karte.gemacht.find((z) => z.text === "Bewertung offen: 1 Antwort");
  assert.ok(offenZeile, JSON.stringify(karte.gemacht));
  assert.equal(offenZeile.link?.href, "#zu-bewerten");
  assert.ok(karte.gut.some((z) => z.text.startsWith("Brüche addieren") || z.text.includes("3 von 3 im ersten Versuch")), `only the three checked answers decide: ${JSON.stringify(karte.gut)}`);
  assert.ok(!karte.schwierig.some((z) => /Fehler/.test(z.text)), "an open answer is no error");

  // confirmed anyway: the documentation says it, no invented result
  assert.ok(ab.bestaetigeAbschluss(lessonId));
  lesson = s.repo.getLesson(lessonId)!;
  assert.match(lesson.activities, /Bewertung offen: 1 Antwort/);

  // graded later from the list: report, card and the automatic fields follow
  assert.ok(!("error" in s.bewerteAntwort(offen.id, "falsch", s.teacher.id)));
  lesson = s.repo.getLesson(lessonId)!;
  assert.equal(readReport(lesson)!.tasks.length, 4);
  karte = ab.karteDerEinheit(unit.id, lesson);
  assert.ok(!karte.gemacht.some((z) => z.text.startsWith("Bewertung offen")));
  assert.ok(!karte.gut.some((z) => z.text.includes("im ersten Versuch richtig")), "now a wrong answer of the skill: not „gut verstanden“ any more");
  assert.doesNotMatch(lesson.activities, /Bewertung offen/);
  assert.equal(s.repo.listAttemptsForStudent(sid).length, 4);
});

test("„Übernehmen“ counts the unsure rows from the reading the server kept, not from the browser", async () => {
  const s = await setup();
  const sid = s.schueler("Ella Kogler");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik", at: Date.now() - 20 * 60_000 }).unit;
  const ws = s.blatt(sid, "Ella – Brüche und Gleichungen", PAPIER);
  const aid = s.repo.assignWorksheet(ws, sid, "", unit.id);
  const tasks = s.repo.listTasks(ws);
  const aus = await mitKi(LESUNG);
  let v;
  try {
    v = await s.p.liesPapier({ unitId: unit.id, blattKey: `z${aid}`, materialIds: [s.seite(sid)], teacherId: s.teacher.id });
  } finally {
    aus();
  }
  const eingabe = { unitId: unit.id, teacherId: s.teacher.id, blatt: `z${aid}`, materialIds: [] };
  // a row the server knows as sure cannot be left open by the browser
  const ohne = v.zeilen.map((z) => (z.taskId === tasks[0].id ? { ...z, offen: true, pruefen: true } : z));
  assert.deepEqual(s.p.speicherePapier({ ...eingabe, gelesen: "ki", zeilen: ohne }), { error: "Bitte jede Aufgabe bewerten." });
  assert.equal(s.repo.listAttemptsForAssignment(aid).length, 0);

  // forged: every row „sure“, „read by hand“, the 15 % graded right; the server still knows two rows were unsure
  const gefaelscht = v.zeilen.map((z) => ({ ...z, bewertung: "richtig" as const, offen: false, pruefen: false, warUnsicher: false, grund: "" }));
  const out = s.p.speicherePapier({ ...eingabe, gelesen: "hand", zeilen: gefaelscht });
  assert.ok(!("error" in out), JSON.stringify(out));
  const row = s.db().prepare("SELECT gelesen, unsicher, lesung_id FROM papier_arbeiten WHERE id = ?").get(out.papierId) as { gelesen: string; unsicher: number; lesung_id: number };
  assert.deepEqual([row.gelesen, row.unsicher, row.lesung_id], ["ki", 2, v.lesungId]);
  assert.equal(s.p.papierDerEinheit(unit.id)[0].unsicher, 2);
  assert.ok((s.db().prepare("SELECT uebernommen_at FROM papier_lesungen WHERE id = ?").get(v.lesungId) as { uebernommen_at: string | null }).uebernommen_at, "a reading is used once");

  // without a reading: a typed answer whose grade contradicts the app's own check counts as unsure too
  const ws2 = s.blatt(sid, "Ella – Nochmal", PAPIER);
  const [b] = s.p.blaetterDerEinheit(unit.id).filter((x) => x.worksheetId === ws2);
  const { zeilenOhneLesung } = await import("./blatt-regeln");
  const hand = zeilenOhneLesung(b.aufgaben).map((z, i) => ({ ...z, offen: false, bewertung: "richtig" as const, antwort: i === 2 ? "15" : "" }));
  assert.deepEqual(s.p.speicherePapier({ ...eingabe, blatt: b.key, gelesen: "ki", zeilen: hand.map((z, i) => (i === 1 ? { ...z, pruefen: true, offen: true } : z)) }), { error: "Bitte jede Aufgabe bewerten." }, "no reading: nothing may stay open");
  const out2 = s.p.speicherePapier({ ...eingabe, blatt: b.key, gelesen: "ki", zeilen: hand });
  assert.ok(!("error" in out2));
  const row2 = s.db().prepare("SELECT gelesen, unsicher FROM papier_arbeiten WHERE id = ?").get(out2.papierId) as { gelesen: string; unsicher: number };
  assert.deepEqual([row2.gelesen, row2.unsicher], ["hand", 1], "„ki“ from the browser does not count; 15 graded right contradicts the app");
});

test("a Probeschularbeit on paper without a unit, from the exam card: same reading, no unit_id, open rows in the student's list, the grade only when nothing is open", async () => {
  const s = await setup();
  const ab = await import("./abschluss");
  const { ergebnis, probeschularbeitenZu } = await import("./probeschularbeit");
  const mara = s.schueler("Mara Feldner");
  const timo = s.schueler("Timo Brandl");
  const pr = s.probe(mara);
  const [b] = s.p.blaetterOhneEinheit(mara);
  assert.deepEqual([b.key, b.art, b.titel, b.aufgaben.map((a) => a.nr)], [`u${pr.ws}`, "probe", "Probeschularbeit: Brüche", ["1a", "1b", "2"]]);
  assert.deepEqual(s.p.blaetterOhneEinheit(timo), [], "never another student's Probeschularbeit");

  const lesung: BlattMitAufgabenGelesen = {
    aufgaben: [
      { nr: 1, antwort: "Weil man 2/4 kürzen kann.", rechenweg: [], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
      { nr: 2, antwort: "3/4", rechenweg: [], bewertung: "richtig", unsicher: true, grund: "Die Zahl ist halb verdeckt.", punkte: null },
      { nr: 3, antwort: "", rechenweg: [], bewertung: "nicht_lesbar", unsicher: true, grund: "verwischt", punkte: null },
    ],
    anderes_blatt: false,
  };
  const aus = await mitKi(lesung);
  let v;
  try {
    await assert.rejects(s.p.liesPapier({ unitId: null, studentId: timo, blattKey: b.key, materialIds: [], teacherId: s.teacher.id }), /gehört nicht zu diesem Schüler/);
    v = await s.p.liesPapier({ unitId: null, studentId: mara, blattKey: b.key, materialIds: [s.seite(mara)], teacherId: s.teacher.id });
  } finally {
    aus();
  }
  assert.deepEqual(s.p.speicherePapier({ unitId: null, studentId: timo, teacherId: s.teacher.id, blatt: b.key, materialIds: [], gelesen: "ki", zeilen: v.zeilen }), { error: "Diese Probeschularbeit gehört nicht zu diesem Schüler, oder sie ist schon ganz bewertet." });
  const out = s.p.speicherePapier({ unitId: null, studentId: mara, teacherId: s.teacher.id, blatt: b.key, materialIds: [], gelesen: "ki", zeilen: v.zeilen });
  assert.ok(!("error" in out), JSON.stringify(out));
  const a = s.repo.getAssignment(out.assignmentId)!;
  assert.deepEqual([a.unit_id, a.mode, a.worksheet_id], [null, "test", pr.ws]);
  assert.ok(s.repo.listAttemptsForAssignment(a.id).every((x) => x.unit_id === null));

  // on the exam card: points so far, the grade follows
  let e = ergebnis(a.id)!;
  assert.deepEqual([e.erreicht, e.offen, e.note], [2, 2, null]);
  assert.equal(probeschularbeitenZu(pr.testId)[0].ergebnis?.offen, 2);
  assert.equal(ab.noteFolgt(e.offen), "Note folgt: 2 Antworten zu bewerten");
  assert.equal(ab.probeZeile({ titel: "Brüche", erreicht: 2, gesamt: 6, note: null, offen: 2, bearbeitet: 3, aufgaben: 3, papier: true }), "Probeschularbeit „Brüche“ auf Papier: 2 von 6 Punkten, Note folgt: 2 Antworten zu bewerten");
  assert.deepEqual(s.p.papierArbeitOhneEinheit(out.papierId, mara), { titel: "Probeschularbeit: Brüche", von: 3, richtig: 1, teilweise: 0, punkte: null, max: null, unsicher: 2, offen: 2, assignmentId: a.id });
  assert.equal(s.p.papierArbeitOhneEinheit(out.papierId, timo), null);

  const liste = s.zb.zuBewerten({ studentId: mara });
  assert.deepEqual(liste.map((z) => z.art === "antwort" && [z.quelle, z.papier, z.grund, z.nr, z.max]), [
    ["probe", true, "ki", "1b", 1],
    ["probe", true, "ki", "2", 3],
  ]);
  assert.deepEqual(s.zb.zuBewerten({ studentId: timo }), []);

  // graded one by one: the grade only once nothing is open
  assert.ok(!("error" in s.bewerteAntwort(liste[0].art === "antwort" ? liste[0].attemptId : 0, "richtig", s.teacher.id)));
  e = ergebnis(a.id)!;
  assert.deepEqual([e.erreicht, e.offen, e.note], [3, 1, null]);
  assert.ok(!("error" in s.bewerteAntwort(liste[1].art === "antwort" ? liste[1].attemptId : 0, "teilweise", s.teacher.id)));
  e = ergebnis(a.id)!;
  assert.equal(e.offen, 0);
  assert.equal(e.erreicht, 4.5, "teilweise = half the points");
  assert.ok(e.note, "now the grade");
  assert.deepEqual(s.zb.zuBewerten({ studentId: mara }), []);
  const p = s.p.papierArbeitOhneEinheit(out.papierId, mara)!;
  assert.deepEqual([p.richtig, p.teilweise, p.punkte, p.max, p.offen], [2, 1, 4.5, 6, undefined], "the paper line follows the later grades");
});
