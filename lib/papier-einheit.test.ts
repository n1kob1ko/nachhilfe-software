/**
 * Arbeit fotografieren (lib/papier-einheit.ts): eine Übung der laufenden Einheit, auf Papier gelöst, wird gegen ihre
 * ORIGINAL-Aufgaben gelesen, von der App nachgeprüft, von der Lehrkraft geprüft und erst mit „Übernehmen“ an derselben
 * Zuweisung gespeichert (unit_id gesetzt), wie am Gerät.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Die Seiten sind ein
 * paar erfundene Bytes mit dem Anfang einer JPEG-Datei. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BlattMitAufgabenGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";
import type { TaskDraft } from "./tasks";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "papier-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundene Seite eines gezeichneten Übungsblatts")]);
const BR = "mathe.brueche.addieren";
const GL = "mathe.gleichungen.einfach";

const draft = (o: Partial<TaskDraft> & Pick<TaskDraft, "type" | "prompt" | "answer">): TaskDraft => ({ skillId: BR, skillIds: [BR], difficulty: "mittel", data: {}, solution: "", hints: [], errorMap: [], ...o });
const AUFGABEN: TaskDraft[] = [
  draft({ type: "calc", prompt: "Lena rechnet: 1/2 + 1/4 = ?", answer: { accepted: ["3/4"], mode: "value" }, solution: "2/4 + 1/4 = 3/4" }),
  draft({ type: "rechenweg", skillId: GL, skillIds: [GL], prompt: "Löse die Gleichung.", data: { start: "3x + 7 = 22" }, answer: { accepted: ["5"], needWay: true }, solutionSteps: ["3x = 15", "x = 5"] }),
  draft({ type: "calc", prompt: "Wie viel sind 15 % von 80?", answer: { accepted: ["12"], mode: "value" }, solution: "80 : 100 · 15 = 12" }),
  draft({ type: "mc", prompt: "Wie viele Drittel sind ein Ganzes?", data: { options: ["2", "3", "4"] }, answer: { correct: 1 } }),
];

async function setup() {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { saveUpload } = await import("./materials");
  const p = await import("./papier-einheit");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({ name, grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const sid = schueler("Lena Rechtl");
  const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik", at: Date.now() - 20 * 60_000 }).unit;
  const blatt = (studentId: number | null, title = "Brüche und Gleichungen") =>
    repo.createWorksheet(
      { title, subject: "Mathematik", grade: 7, school_type: "Mittelschule", klasse: 3, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [BR, GL], status: "freigegeben", student_id: studentId },
      AUFGABEN,
    );
  const seite = () => saveUpload({ name: "seite.jpg", data: JPEG }, { title: "Gelöstes Blatt", subject: "Mathematik", studentId: sid, teacherId: teacher.id }).id;
  return { db, repo, units, p, teacher, schueler, sid, unit, blatt, seite };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `antwort`. */
async function mitKi(antwort: BlattMitAufgabenGelesen) {
  process.env.ANTHROPIC_API_KEY = "test-nicht-echt";
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: antwort, refusal: false, model: req.model, usage: { input: 5_000, output: 1_200, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return {
    gefragt,
    aus: () => {
      router.setTransport(null);
      delete process.env.ANTHROPIC_API_KEY;
    },
  };
}

const LESUNG: BlattMitAufgabenGelesen = {
  aufgaben: [
    { nr: 1, antwort: "3/4", rechenweg: [], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
    { nr: 2, antwort: "x = 5", rechenweg: ["3x = 15", "x = 5"], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
    // the reading says right, the app checks 15 against 12: unsure, no grade chosen
    { nr: 3, antwort: "15", rechenweg: [], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
    { nr: 4, antwort: "B", rechenweg: [], bewertung: "richtig", unsicher: true, grund: "Das Kreuz ist undeutlich.", punkte: null },
    // a task that is not on the sheet: never a row
    { nr: 9, antwort: "7", rechenweg: [], bewertung: "falsch", unsicher: false, grund: "", punkte: null },
  ],
  anderes_blatt: false,
};

test("a sheet sent in the unit is read against its original tasks: one row per task, solutions go along, no name, nothing saved before „Übernehmen“", async () => {
  const s = await setup();
  const ws = s.blatt(s.sid);
  const asg = s.repo.assignWorksheet(ws, s.sid, "", s.unit.id);
  const tasks = s.repo.listTasks(ws);
  const blaetter = s.p.blaetterDerEinheit(s.unit.id);
  assert.deepEqual(blaetter.map((b) => [b.key, b.art, b.aufgaben.length]), [[`z${asg}`, "gesendet", 4]]);
  assert.equal(blaetter[0].titel, "Brüche und Gleichungen");

  const ki = await mitKi(LESUNG);
  try {
    const tor = s.p.papierTor(s.sid);
    assert.ok(tor.erlaubt && /^Lesen kostet ca\. \d+ Cent$/.test(tor.kosten), "the cost is shown before reading");
    assert.equal(ki.gefragt.length, 0, "showing the cost reads nothing");
    const v = await s.p.liesPapier({ unitId: s.unit.id, blattKey: `z${asg}`, materialIds: [s.seite(), s.seite()], teacherId: s.teacher.id });
    assert.equal(ki.gefragt.length, 1, "one call for all pages");
    const req = JSON.stringify(ki.gefragt[0]);
    assert.ok(!/Lena|Rechtl/.test(req), "no name from the app goes to the KI, not even inside a task");
    assert.ok(req.includes("Lösung: 3x = 15") && req.includes("Wie viel sind 15 % von 80?"), "the original tasks with their solutions go along");

    assert.equal(v.zeilen.length, 4, "exactly one row per task of the sheet, none invented");
    assert.deepEqual(new Set(v.zeilen.map((z) => z.taskId)), new Set(tasks.map((t) => t.id)));
    assert.deepEqual(v.zeilen.slice(0, 2).map((z) => z.taskId), [tasks[2].id, tasks[3].id], "unsure rows first");
    const [prozent, auswahl] = v.zeilen;
    assert.equal(prozent.pruefen, true);
    assert.equal(prozent.offen, true, "read and app disagree: no grade chosen");
    assert.match(prozent.grund ?? "", /App prüft die Antwort als falsch/);
    assert.equal(auswahl.pruefen, true);
    assert.equal(auswahl.offen, false, "unsure, but the reading's proposal stays preselected");
    assert.equal(auswahl.grund, "Das Kreuz ist undeutlich.");
    const sicher = v.zeilen.filter((z) => !z.pruefen);
    assert.deepEqual(sicher.map((z) => z.bewertung), ["richtig", "richtig"]);
    assert.ok(v.hinweise.some((h) => h.includes("nicht auf diesem Blatt")));
    assert.match(v.zeilen.find((z) => z.taskId === tasks[1].id)!.loesung ?? "", /x = 5/, "the teacher sees the solution");

    assert.equal(s.repo.listAttemptsForAssignment(asg).length, 0, "reading stores no answer");
    assert.deepEqual(s.p.papierDerEinheit(s.unit.id), []);
    assert.equal(s.repo.getAssignment(asg)!.completed_at, null);
  } finally {
    ki.aus();
  }
});

test("„Übernehmen“: checked, the answers go to the SAME assignment with the unit, teilweise is half the points, and the Abschluss says it", async () => {
  const s = await setup();
  const ws = s.blatt(s.sid);
  s.db().prepare("UPDATE tasks SET points = 2 WHERE worksheet_id = ?").run(ws);
  const asg = s.repo.assignWorksheet(ws, s.sid, "", s.unit.id);
  const tasks = s.repo.listTasks(ws);
  const ki = await mitKi(LESUNG);
  const m = s.seite();
  let v;
  try {
    v = await s.p.liesPapier({ unitId: s.unit.id, blattKey: `z${asg}`, materialIds: [m], teacherId: s.teacher.id });
  } finally {
    ki.aus();
  }
  const eingabe = { unitId: s.unit.id, teacherId: s.teacher.id, blatt: `z${asg}`, materialIds: [m], gelesen: "ki" as const };
  // Gemeinsame Bewertung (C3): yellow rows no longer block „Übernehmen“; undecided they are saved as answers waiting for the
  // teacher („Zu bewerten“), never as a result. That path is tested in lib/zu-bewerten.test.ts; here the teacher decides all.
  assert.equal(s.repo.listAttemptsForAssignment(asg).length, 0, "reading stores no answer");

  // the teacher: 15 % is wrong, the cross is fine („Passt so“), the equation only partly
  const geprueft = v.zeilen.map((z) =>
    z.taskId === tasks[2].id ? { ...z, bewertung: "falsch" as const, offen: false, pruefen: false } : z.taskId === tasks[1].id ? { ...z, bewertung: "teilweise" as const, fehler: "Probe fehlt" } : { ...z, pruefen: false },
  );
  // what the browser sends for the task text or the points does not count: the sheet's own
  const out = s.p.speicherePapier({ ...eingabe, zeilen: geprueft.map((z) => ({ ...z, aufgabe: "anders", max: 99 })) });
  assert.ok(!("error" in out), JSON.stringify(out));
  assert.equal(out.assignmentId, asg, "the same assignment, no second one");
  const attempts = s.repo.listAttemptsForAssignment(asg);
  assert.equal(attempts.length, 4);
  assert.ok(attempts.every((a) => a.unit_id === s.unit.id && a.final === 1), "in this unit, finished");
  assert.deepEqual(tasks.map((t) => attempts.find((a) => a.task_id === t.id)!.review), ["richtig", "teilweise", "falsch", "richtig"]);
  assert.ok(s.repo.getAssignment(asg)!.completed_at, "done: it leaves the student's device");
  const [p] = s.p.papierDerEinheit(s.unit.id);
  assert.deepEqual(p, { titel: "Brüche und Gleichungen", von: 4, richtig: 2, teilweise: 1, punkte: 5, max: 8, unsicher: 2, assignmentId: asg });
  const { papierZeile } = await import("./blatt-regeln");
  assert.equal(papierZeile(p), "Auf Papier: Übung „Brüche und Gleichungen“ 5 von 8 Punkten, 2 unsicher geprüft");
  assert.match((await import("./materials")).getMaterial(m)!.title, /Brüche und Gleichungen/, "the page is named after the sheet");
  assert.deepEqual(s.p.blaetterDerEinheit(s.unit.id), [], "a sheet fully graded is not offered again");
  assert.deepEqual(s.p.speicherePapier({ ...eingabe, zeilen: geprueft }), { error: "Dieses Blatt gehört nicht zu dieser Einheit, oder es ist schon ganz bewertet." });

  // like digital work: in the unit's report, and in the Abschluss with its own line
  const { endUnit } = await import("./learning");
  const ab = await import("./abschluss");
  const lessonId = endUnit(s.unit.id, { byTeacherId: s.teacher.id })!;
  const karte = ab.karteDerEinheit(s.unit.id, s.repo.getLesson(lessonId)!);
  assert.ok(karte.gemacht.some((z) => z.text === "Auf Papier: Übung „Brüche und Gleichungen“ 5 von 8 Punkten, 2 unsicher geprüft" && z.von === "papier"));
  assert.ok(karte.gemacht.some((z) => z.text.startsWith("4 Aufgaben bearbeitet, 2 richtig")), "the answers count like answers on the device");
});

test("the app checks first where it can: accepted answers and numbers, a choice, the Rechenweg; unreadable is never wrong", async () => {
  const { appUrteil } = await import("./papier-einheit");
  const { zusammenfuehren, papierZeile, papierErgebnis, unsichereZuerst } = await import("./blatt-regeln");
  const [bruch, gleichung, prozent, auswahl] = AUFGABEN;
  assert.equal(appUrteil(bruch, "0,75"), "richtig", "an equal value is right");
  assert.equal(appUrteil(bruch, "2/6"), "falsch");
  assert.equal(appUrteil(prozent, "12"), "richtig");
  assert.equal(appUrteil(gleichung, "x = 5", ["3x = 15", "x = 5"]), "richtig", "the read Rechenweg goes through the app's parser");
  assert.notEqual(appUrteil(gleichung, "x = 7", ["3x = 21", "x = 7"]), "richtig");
  assert.equal(appUrteil(auswahl, "B"), "richtig");
  assert.equal(appUrteil(auswahl, "a)"), "falsch");
  assert.equal(appUrteil(auswahl, "vielleicht"), null, "not a choice it knows: the reading counts");
  assert.equal(appUrteil(draft({ type: "free", prompt: "Erkläre.", answer: { sample: "…" } }), "Weil …"), null, "a free answer is the teacher's");
  assert.equal(appUrteil(bruch, "  "), null);

  assert.deepEqual(zusammenfuehren({ bewertung: "nicht_lesbar", unsicher: false, grund: "verwischt" }, null), { bewertung: "falsch", offen: true, pruefen: true, warUnsicher: true, grund: "Nicht lesbar: verwischt" }, "no grade chosen: never wrong by itself");
  assert.equal(zusammenfuehren({ bewertung: "falsch", unsicher: false, grund: "Vorzeichen" }, "richtig").offen, true);
  assert.deepEqual(zusammenfuehren({ bewertung: "falsch", unsicher: false, grund: "Vorzeichen" }, "falsch"), { bewertung: "falsch", offen: false, pruefen: false, warUnsicher: false, grund: "Vorzeichen" });
  assert.equal(zusammenfuehren({ bewertung: "leer", unsicher: false, grund: "" }, null).pruefen, false);
  assert.deepEqual(unsichereZuerst([{ pruefen: false, n: 1 }, { pruefen: true, n: 2 }, { pruefen: false, n: 3 }]).map((z) => z.n), [2, 1, 3]);
  const ohnePunkte = papierErgebnis("Kürzen", [
    { bewertung: "richtig", punkte: null, max: null },
    { bewertung: "teilweise", punkte: null, max: null, warUnsicher: true },
    { bewertung: "leer", punkte: null, max: null },
  ]);
  assert.equal(papierZeile(ohnePunkte), "Auf Papier: Übung „Kürzen“ 1 von 3 richtig, 1 teilweise, 1 unsicher geprüft");
});

test("KI off: no reading, the same preview by hand with the original tasks; a printed sheet that was never sent gets its assignment in the unit", async () => {
  const s = await setup();
  const { zeilenOhneLesung } = await import("./blatt-regeln");
  const tor = s.p.papierTor(s.sid);
  assert.equal(tor.erlaubt, false);
  assert.match(!tor.erlaubt ? tor.grund : "", /selbst ein/);
  // made for the student during the unit and printed, never sent
  const ws = s.blatt(s.sid, "Lena – Gemischte Übung");
  const [b] = s.p.blaetterDerEinheit(s.unit.id);
  assert.deepEqual([b.key, b.art, b.titel], [`u${ws}`, "erstellt", "Gemischte Übung"], "printed sheets are offered too, without the first name");
  await assert.rejects(s.p.liesPapier({ unitId: s.unit.id, blattKey: b.key, materialIds: [s.seite()], teacherId: s.teacher.id }), /selbst ein/);

  const zeilen = zeilenOhneLesung(b.aufgaben);
  assert.ok(zeilen.every((z) => z.offen && !z.pruefen && z.taskId), "one row per original task, no grade chosen");
  const eingabe = { unitId: s.unit.id, teacherId: s.teacher.id, blatt: b.key, materialIds: [], gelesen: "hand" as const };
  assert.deepEqual(s.p.speicherePapier({ ...eingabe, zeilen }), { error: "Bitte jede Aufgabe bewerten." });
  const out = s.p.speicherePapier({ ...eingabe, zeilen: zeilen.map((z, i) => ({ ...z, offen: false, bewertung: i === 0 ? ("falsch" as const) : ("richtig" as const) })) });
  assert.ok(!("error" in out), JSON.stringify(out));
  const a = s.repo.getAssignment(out.assignmentId)!;
  assert.equal(a.unit_id, s.unit.id);
  assert.equal(a.worksheet_id, ws, "the same exercise, now assigned in this unit");
  assert.ok(a.delivered_at && a.completed_at, "never pops up on the device");
  assert.equal(a.mode, "normal");
  assert.equal(s.repo.listAttemptsForUnit(s.unit.id).length, 4);
  assert.deepEqual(s.p.papierDerEinheit(s.unit.id).map((p) => [p.richtig, p.von, p.unsicher]), [[3, 4, 0]]);
  assert.equal((s.db().prepare("SELECT gelesen FROM papier_arbeiten").get() as { gelesen: string }).gelesen, "hand");
});

test("never the sheet of another student, neither offered nor read nor saved", async () => {
  const s = await setup();
  const andere = s.schueler("Jonas Feder");
  const fremd = s.blatt(andere, "Jonas – Brüche");
  // even assigned to this student in this unit, a sheet made for another student is not his
  s.repo.assignWorksheet(fremd, s.sid, "", s.unit.id);
  // and the other student's own assignment, sent in his own unit, is never this unit's
  const seineUnit = s.units.startUnit(s.teacher.id, andere, { subject: "Mathematik" }).unit;
  const seins = s.repo.assignWorksheet(s.blatt(andere, "Jonas – Gleichungen"), andere, "", seineUnit.id);
  assert.deepEqual(s.p.blaetterDerEinheit(s.unit.id), []);
  const ki = await mitKi(LESUNG);
  try {
    for (const key of [`u${fremd}`, `z${seins}`]) {
      await assert.rejects(s.p.liesPapier({ unitId: s.unit.id, blattKey: key, materialIds: [s.seite()], teacherId: s.teacher.id }), /gehört nicht zu dieser Einheit/);
      const out = s.p.speicherePapier({ unitId: s.unit.id, teacherId: s.teacher.id, blatt: key, materialIds: [], gelesen: "hand", zeilen: [] });
      assert.ok("error" in out);
    }
    assert.equal(ki.gefragt.length, 0, "nothing went to the KI");
  } finally {
    ki.aus();
  }
  assert.equal(s.repo.listAttemptsForAssignment(seins).length, 0);
});

test("„Ein anderes Blatt“ in the unit goes the way of „Gelöstes Blatt einlesen“, but belongs to the unit", async () => {
  const s = await setup();
  const out = s.p.speicherePapier({
    unitId: s.unit.id,
    teacherId: s.teacher.id,
    blatt: s.p.ANDERES_BLATT,
    fach: "Mathematik",
    titel: "Arbeitsblatt aus der Schule",
    materialIds: [],
    gelesen: "hand",
    zeilen: [
      { nr: "1", aufgabe: "2/3 + 1/6", antwort: "5/6", bewertung: "richtig", punkte: null, max: null, skillId: BR, fehler: "", pruefen: false },
      { nr: "2", aufgabe: "3/4 - 1/2", antwort: "1/2", bewertung: "falsch", punkte: null, max: null, skillId: BR, fehler: "", pruefen: false },
    ],
  });
  assert.ok(!("error" in out), JSON.stringify(out));
  const a = s.repo.getAssignment(out.assignmentId)!;
  assert.equal(a.unit_id, s.unit.id);
  assert.equal(a.mode, "normal", "not mistaken for the unit's Minitest");
  assert.ok(s.repo.listAttemptsForAssignment(a.id).every((x) => x.unit_id === s.unit.id));
  assert.deepEqual(s.p.papierDerEinheit(s.unit.id).map((p) => [p.titel, p.richtig, p.von]), [["Arbeitsblatt aus der Schule", 1, 2]]);
  const pruefen = s.p.speicherePapier({ unitId: s.unit.id, teacherId: s.teacher.id, blatt: s.p.ANDERES_BLATT, materialIds: [], gelesen: "ki", zeilen: [{ nr: "1", aufgabe: "x", antwort: "", bewertung: "richtig", punkte: null, max: null, skillId: null, fehler: "", pruefen: true }] });
  assert.deepEqual(pruefen, { error: "Bitte zuerst die gelb markierten Zeilen prüfen." });
  // an ended unit takes nothing any more
  s.units.finishUnit(s.unit.id, "beendet", { byTeacherId: s.teacher.id });
  assert.deepEqual(s.p.speicherePapier({ unitId: s.unit.id, teacherId: s.teacher.id, blatt: s.p.ANDERES_BLATT, materialIds: [], gelesen: "hand", zeilen: [] }), { error: "Die Einheit ist schon beendet." });
});

test("tasks already answered on the device are left out; the unit's printed Minitest is offered as such", async () => {
  const s = await setup();
  const ws = s.blatt(s.sid);
  const asg = s.repo.assignWorksheet(ws, s.sid, "", s.unit.id);
  const [erste] = s.repo.listTasks(ws);
  s.repo.recordAttempt({ assignment_id: asg, task_id: erste.id, student_id: s.sid, skill_id: erste.skillId, attempt_no: 1, answer: "3/4", correct: 1, final: 1, time_ms: 20_000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "", unit_id: s.unit.id });
  const mini = s.blatt(s.sid, "Minitest Brüche");
  s.db().prepare("UPDATE worksheets SET minitest_unit_id = ? WHERE id = ?").run(s.unit.id, mini);
  const blaetter = s.p.blaetterDerEinheit(s.unit.id);
  const gesendet = blaetter.find((b) => b.key === `z${asg}`)!;
  assert.equal(gesendet.aufgaben.length, 3);
  assert.equal(gesendet.schonFertig, 1);
  assert.ok(!gesendet.aufgaben.some((a) => a.taskId === erste.id));
  assert.equal(blaetter.find((b) => b.key === `u${mini}`)?.art, "minitest");
});
