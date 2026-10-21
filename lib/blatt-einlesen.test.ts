/**
 * Gelöstes Blatt einlesen (niko, 21.10.2026): Fotos eines auf Papier gelösten Tests, die KI liest jede Aufgabe,
 * der Lehrer prüft und übernimmt es ins Profil (Lernstand, bei einer echten Prüfung Note und Punkte).
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Die
 * Seiten sind ein paar erfundene Bytes mit dem Anfang einer JPEG-Datei. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BlattGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "blatt-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundene Seite eines Übungsblatts")]);
const GESTERN = "2026-10-20";

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { saveUpload } = await import("./materials");
  const { faehigkeitenFuer } = await import("./blatt-einlesen");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Mia Probe", grade: 8, klasse: 4, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const student = repo.getStudent(sid)!;
  const skills = faehigkeitenFuer(student, "Mathematik");
  assert.ok(skills.length >= 2, "the student has Mathematik skills to pick from");
  const seite = () => saveUpload({ name: "seite.jpg", data: JPEG }, { title: "Gelöstes Blatt", subject: "Mathematik", studentId: sid, teacherId: teacher.id }).id;
  return { repo, teacher, sid, student, skills, seite };
}

const gelesen = (skillId: string): BlattGelesen => ({
  aufgaben: [
    { nr: "1", aufgabe: "(2x^3)^2 · 3x", thema: "Potenzregeln", faehigkeit: skillId, antwort: "12x^7", bewertung: "richtig", punkte: 2, punkte_max: 2, fehler: "egal", korrektur_auf_blatt: true, unsicher: false },
    { nr: "2a", aufgabe: "Kürze 12/18", thema: "Brüche kürzen", faehigkeit: "gibt-es-nicht", antwort: "6/9", bewertung: "teilweise", punkte: 1, punkte_max: 2, fehler: "nicht ganz gekürzt", korrektur_auf_blatt: true, unsicher: false },
    { nr: "2b", aufgabe: "Berechne 15 % von 80", thema: "Prozentrechnung", faehigkeit: skillId, antwort: "", bewertung: "leer", punkte: 5, punkte_max: 3, fehler: "", korrektur_auf_blatt: false, unsicher: true },
    { nr: "3", aufgabe: "   ", thema: "", faehigkeit: null, antwort: "", bewertung: "falsch", punkte: null, punkte_max: null, fehler: "", korrektur_auf_blatt: false, unsicher: false },
  ],
  gesamt_punkte: 3,
  gesamt_max: 7,
  note: 7,
  titel: "Probeschularbeit Potenzen",
  unsicher: ["Aufgabe 2b schwer lesbar"],
});

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `antwort`. */
async function mitKi(antwort: BlattGelesen) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: antwort, refusal: false, model: req.model, usage: { input: 3_000, output: 800, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("the reading is checked: known skills only, sensible points, a grade 1 to 5, empty rows dropped", async () => {
  const { student, skills } = await setup();
  const { vorschlagAusGelesen } = await import("./blatt-einlesen");
  const v = vorschlagAusGelesen(gelesen(skills[0].id), { erlaubt: new Set(skills.map((s) => s.id)), fach: "Mathematik", student });
  assert.equal(v.zeilen.length, 3, "the row without a task is dropped");
  const [a, b, c] = v.zeilen;
  assert.equal(a.skillId, skills[0].id);
  assert.equal(a.fehler, "", "a right answer has no error text");
  assert.equal(a.pruefen, false);
  assert.notEqual(b.skillId, "gibt-es-nicht", "an unknown skill id never gets through");
  assert.equal(b.pruefen, true, "a guessed or missing skill is marked for checking");
  assert.equal(c.punkte, null, "more points than possible are not taken over");
  assert.equal(c.max, 3);
  assert.equal(c.pruefen, true, "the KI was not sure");
  assert.equal(v.note, null, "a grade 7 does not exist");
  assert.equal(v.gesamt, 3);
  assert.equal(v.gesamtMax, 7);
  assert.equal(v.titel, "Probeschularbeit Potenzen");
  assert.ok(v.hinweise.some((h) => h.includes("2b schwer lesbar")));
});

test("pages go to the KI with the skill list and no name; without the KI nothing is read", async () => {
  const { teacher, sid, skills, seite } = await setup();
  const { liesBlatt, blattLesbar } = await import("./blatt-einlesen");
  assert.equal(blattLesbar().ok, false, "no key: the teacher fills it in by hand");
  await assert.rejects(liesBlatt({ materialIds: [seite()], studentId: sid, teacherId: teacher.id, fach: "Mathematik" }));

  process.env.ANTHROPIC_API_KEY = "test-nicht-echt";
  const ki = await mitKi(gelesen(skills[0].id));
  try {
    const v = await liesBlatt({ materialIds: [seite(), seite()], studentId: sid, teacherId: teacher.id, fach: "Mathematik" });
    assert.equal(v.zeilen.length, 3);
    assert.equal(ki.gefragt.length, 1, "one call for all pages");
    const req = JSON.stringify(ki.gefragt[0]);
    assert.ok(!req.includes("Mia") && !req.includes("Probe\""), "no name from the app goes to the KI");
    assert.ok(req.includes(skills[0].id), "the skill list goes along");
    assert.equal((req.match(/image\/jpeg/g) ?? []).length >= 2, true, "both pages go along");
  } finally {
    ki.aus();
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test("a Probeschularbeit on paper counts for the Lernstand on its day, with the points from the sheet", async () => {
  const { repo, teacher, sid, skills, seite } = await setup();
  const { speichereBlatt } = await import("./blatt-einlesen");
  const { ergebnis } = await import("./probeschularbeit");
  const sa = repo.addTest({ student_id: sid, date: "2026-11-05", subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "1. Schularbeit", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
  const m = seite();
  const zeile = { antwort: "", fehler: "", pruefen: false, skillId: skills[0].id };
  const out = speichereBlatt({
    studentId: sid,
    teacherId: teacher.id,
    fach: "Mathematik",
    datum: GESTERN,
    titel: "Probeschularbeit Potenzen",
    art: "probe",
    testId: sa,
    note: null,
    gesamt: null,
    gesamtMax: null,
    materialIds: [m],
    zeilen: [
      { ...zeile, nr: "1", aufgabe: "(2x^3)^2", bewertung: "richtig", punkte: null, max: 2 },
      { ...zeile, nr: "2", aufgabe: "x^5 : x^2", bewertung: "teilweise", punkte: 1.5, max: 4, fehler: "Vorzeichen vergessen" },
      { ...zeile, nr: "3", aufgabe: "Kürze 12/18", bewertung: "leer", punkte: null, max: 2, skillId: skills[1].id },
    ],
  });
  assert.ok(!("error" in out), JSON.stringify(out));
  const ws = repo.getWorksheet(out.worksheetId)!;
  assert.equal(ws.kind, "ueberpruefung");
  assert.equal(repo.getAssignment(out.assignmentId)!.completed_at?.slice(0, 10), GESTERN, "solved on the day of the sheet, not today");
  const attempts = repo.listAttemptsForAssignment(out.assignmentId);
  assert.deepEqual(attempts.map((a) => a.review), ["richtig", "teilweise", "falsch"], "leer counts as wrong");
  assert.ok(attempts.every((a) => a.final && a.created_at.startsWith(GESTERN)));
  assert.equal(attempts[1].feedback, "Vorzeichen vergessen");
  const e = ergebnis(out.assignmentId)!;
  assert.equal(e.gesamt, 8);
  assert.equal(e.erreicht, 3.5, "2 + 1,5 from the sheet + 0");
  assert.equal(repo.getTest(sa)!.status, "geplant", "a Probeschularbeit leaves the real one alone");
  assert.equal(out.testId, sa);
  const { getMaterial } = await import("./materials");
  assert.match(getMaterial(m)!.title, /Probeschularbeit Potenzen/, "the stored page gets the name of the sheet");
});

test("a real Schularbeit gets its grade and points; wrong input is refused", async () => {
  const { repo, teacher, sid, skills } = await setup();
  const { speichereBlatt } = await import("./blatt-einlesen");
  const basis = { studentId: sid, teacherId: teacher.id, fach: "Mathematik", datum: GESTERN, titel: "", art: "pruefung" as const, materialIds: [] };
  const zeilen = [{ nr: "1", aufgabe: "3/4 + 1/8", antwort: "7/8", bewertung: "richtig" as const, punkte: 3, max: 3, skillId: skills[0].id, fehler: "", pruefen: false }];

  const neu = speichereBlatt({ ...basis, testId: null, pruefungsart: "Test", note: 2, gesamt: 21, gesamtMax: 24, zeilen });
  assert.ok(!("error" in neu));
  const t = repo.getTest(neu.testId!)!;
  assert.equal(t.kind, "Test");
  assert.equal(t.status, "geschrieben");
  assert.deepEqual([t.grade, t.points, t.max_points, t.date], [2, 21, 24, GESTERN]);

  const geplant = repo.addTest({ student_id: sid, date: GESTERN, subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
  const alt = speichereBlatt({ ...basis, testId: geplant, note: 3, gesamt: 17, gesamtMax: 24, zeilen });
  assert.ok(!("error" in alt));
  assert.deepEqual([repo.getTest(geplant)!.grade, repo.getTest(geplant)!.status], [3, "geschrieben"]);

  const fehler = (e: Partial<Parameters<typeof speichereBlatt>[0]>) => {
    const out = speichereBlatt({ ...basis, testId: null, note: null, gesamt: null, gesamtMax: null, zeilen, ...e });
    return "error" in out ? out.error : null;
  };
  assert.match(fehler({ datum: "2099-01-01" })!, /Zukunft/);
  assert.match(fehler({ datum: "2026-02-30" })!, /gültiges Datum/);
  assert.match(fehler({ zeilen: [{ ...zeilen[0], aufgabe: " " }] })!, /mindestens eine Aufgabe/);
  assert.match(fehler({ zeilen: [{ ...zeilen[0], punkte: 4 }] })!, /mehr Punkte/);
  assert.match(fehler({ note: 6 })!, /1 bis 5/);
  assert.match(fehler({ gesamt: 30, gesamtMax: 24 })!, /mehr Punkte/);
  const fremd = repo.createStudent({ name: "Leo Beispiel", grade: 8, klasse: 4, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const fremdTest = repo.addTest({ student_id: fremd, date: GESTERN, subject: "Mathematik", kind: "Test", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
  assert.match(fehler({ testId: fremdTest })!, /anderen Schüler/);
});
