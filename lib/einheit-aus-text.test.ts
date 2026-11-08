/**
 * Einheit aus Text übernehmen (niko, 08.11.2026): eine Zusammenfassung aus einem Claude-Chat einfügen, die KI füllt das
 * Formular „Einheit nachtragen“ aus, gespeichert werden Einheit, Erkenntnisse und das besprochene Prüfungsergebnis.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Alle Namen sind
 * erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import type { EinheitGelesen } from "./einheit-aus-text-regeln";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const TEXT = `Die Einheit mit Lorenz Beispiel am 8. November:
1. Schularbeit besprochen
* Ergebnis: 47 von 69 Punkten, also ein Befriedigend.
* Punkte verloren beim Lesetext (8/16) und beim Geschichte-Schreiben (8/20).
2. Erkenntnisse
* Den Fall bestimmt Lorenz über den Begleiter statt über die Frage.
* Aufgabenstellungen liest er nicht genau.
* Gut lief: Wo/Wohin.`;

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { skillsForPrompt } = await import("./lehrplan");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lorenz Beispiel", grade: 5, klasse: 1, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const student = repo.getStudent(sid)!;
  const skills = skillsForPrompt(student, "Deutsch");
  assert.ok(skills.length >= 2, "the student has Deutsch skills to pick from");
  return { repo, teacher, sid, student, skills };
}

const gelesen = (a: string, b: string): EinheitGelesen => ({
  fach: "deutsch",
  thema: "Schularbeit besprochen, die vier Fälle",
  datum: "2026-11-08",
  gemacht: ["Schularbeit besprochen (47/69, Befriedigend)", "  ", "Übungspaket 1 bearbeitet"],
  fehler: [
    { text: "Bestimmt den Fall über den Begleiter statt über die Frage", faehigkeit: a, fehlerart: "regel" },
    { text: "Liest Aufgabenstellungen nicht genau", faehigkeit: "gibt-es-nicht", fehlerart: "gelesen" },
    { text: "liest aufgabenstellungen nicht genau", faehigkeit: null, fehlerart: null },
    { text: "Verb passt nicht zur Person", faehigkeit: b, fehlerart: "quatsch" },
  ],
  gut: ["Wo/Wohin, wenn er den Artikel kennt"],
  verstaendnis: 3.4,
  faehigkeiten: [a, b, a, "gibt-es-nicht"],
  beobachtungen: "",
  naechstes_mal: "Übungspaket 2: Zeitformen, Fall über die Frage",
  pruefung: { art: "Schularbeit", punkte: 47, max: 69, note: 3, teile: ["Lesetext 8/16", "Geschichte 8/20"] },
});

async function mitKi(antwort: EinheitGelesen) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: antwort, refusal: false, model: req.model, usage: { input: 2_000, output: 600, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("the reading is checked: own subjects, known skills and Fehlerarten, no doubles, Verständnis and grade 1 to 5", async () => {
  const { skills } = await setup();
  const { entwurfAusGelesen } = await import("./einheit-aus-text");
  const [a, b] = skills;
  const e = entwurfAusGelesen(gelesen(a.id, b.id), { faecher: ["Deutsch"], erlaubt: new Set(skills.map((s) => s.id)), heute: "2026-11-08" });
  assert.equal(e.fach, "Deutsch", "the subject is matched to the student's own spelling");
  assert.deepEqual(e.gemacht, ["Schularbeit besprochen (47/69, Befriedigend)", "Übungspaket 1 bearbeitet"]);
  assert.equal(e.fehler.length, 3, "the same error twice is kept once");
  assert.equal(e.fehler[0].skillId, a.id);
  assert.equal(e.fehler[1].skillId, null, "an unknown skill id never gets through");
  assert.equal(e.fehler[1].fehlerart, "gelesen");
  assert.equal(e.fehler[2].fehlerart, null, "an unknown Fehlerart never gets through");
  assert.deepEqual(e.skillIds, [a.id, b.id]);
  assert.equal(e.verstaendnis, 3);
  assert.equal(e.datum, "2026-11-08");
  assert.deepEqual(e.pruefung, { art: "Schularbeit", punkte: 47, max: 69, note: 3, teile: ["Lesetext 8/16", "Geschichte 8/20"] });

  const zukunft = entwurfAusGelesen({ ...gelesen(a.id, b.id), datum: "2026-12-01", pruefung: { art: "Test", punkte: 80, max: 69, note: 7, teile: [] } }, { faecher: ["Deutsch"], erlaubt: new Set(), heute: "2026-11-08" });
  assert.equal(zukunft.datum, null, "a date after today is not taken");
  assert.equal(zukunft.pruefung, null, "more points than possible: no exam result");
});

test("the text goes to the KI without names and keeps its lines; the draft fills the form", async () => {
  const { sid, teacher, skills } = await setup();
  const { entwurfAusText, getEntwurf } = await import("./einheit-aus-text");
  const ki = await mitKi(gelesen(skills[0].id, skills[1].id));
  try {
    const { id, hinweis } = await entwurfAusText({ studentId: sid, teacherId: teacher.id, text: TEXT });
    assert.equal(hinweis, null);
    assert.equal(ki.gefragt.length, 1);
    const req = ki.gefragt[0];
    assert.equal(req.fn, "einheit_text");
    const prompt = JSON.stringify(req.content);
    assert.ok(!prompt.includes("Lorenz") && !prompt.includes("Beispiel am"), "no name of the student goes to the KI");
    assert.ok(prompt.includes("über den Begleiter statt über die Frage"), "the content goes along");
    assert.ok(prompt.includes("\\n* Aufgabenstellungen"), "the lines stay lines");
    assert.ok(prompt.includes(skills[0].id), "the skill list goes along");
    const e = getEntwurf(id, sid)!;
    assert.equal(e.entwurf.fehler.length, 3);
    assert.equal(getEntwurf(id, sid + 1), null, "a draft belongs to its student");
  } finally {
    ki.aus();
  }
});

test("without KI the text lands line by line under „Was wurde gemacht?“", async () => {
  const { sid, teacher } = await setup();
  const { entwurfAusText, getEntwurf } = await import("./einheit-aus-text");
  const { id, hinweis } = await entwurfAusText({ studentId: sid, teacherId: teacher.id, text: TEXT });
  assert.match(hinweis ?? "", /nicht eingerichtet/);
  const e = getEntwurf(id, sid)!;
  assert.equal(e.entwurf.ohneKi, true);
  assert.equal(e.entwurf.gemacht[1], "Schularbeit besprochen", "the numbering is dropped");
  assert.ok(!e.entwurf.gemacht.join(" ").includes("Lorenz"), "names are removed here too");
  await assert.rejects(entwurfAusText({ studentId: sid, teacherId: teacher.id, text: "   " }), /Text einfügen/);
});

test("saving stores the Erkenntnisse once and fills only what the exam is missing", async () => {
  const { repo, sid, teacher, skills } = await setup();
  const { entwurfAusText, getEntwurf, nachDemSpeichern, offenePruefungen } = await import("./einheit-aus-text");
  const { listErkenntnisse, setzeErkenntnisStatus } = await import("./erkenntnisse");
  const testId = repo.addTest({ student_id: sid, date: "2026-10-20", subject: "Deutsch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [] });
  repo.addTest({ student_id: sid, date: "2026-10-01", subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [] });
  assert.deepEqual(offenePruefungen(sid, "Deutsch").map((t) => t.id), [testId], "only exams of the subject without a result");

  const ki = await mitKi(gelesen(skills[0].id, skills[1].id));
  let id: number;
  try {
    ({ id } = await entwurfAusText({ studentId: sid, teacherId: teacher.id, text: TEXT }));
  } finally {
    ki.aus();
  }
  const e = getEntwurf(id, sid)!.entwurf;
  const lessonId = repo.saveLesson({ student_id: sid, teacher_id: teacher.id, starts_at: "2026-11-08T14:00", duration_min: 100, subject: "Deutsch", topic: e.thema, status: "abgeschlossen", activities: "", mistakes: e.fehler.map((f) => f.text).join("\n"), understanding: 3, tutor_notes: "", next_steps: "", skill_ids: e.skillIds });
  const pruefung = { ...e.pruefung!, testId, datum: "2026-11-08" };
  const out = nachDemSpeichern({ entwurfId: id, studentId: sid, lessonId, teacherId: teacher.id, subject: "Deutsch", fehler: e.fehler, gut: e.gut, pruefung });
  assert.deepEqual(out, { erkenntnisse: 4, testId });

  const alle = listErkenntnisse(sid);
  assert.equal(alle.filter((x) => x.art === "fehler").length, 3);
  assert.equal(alle.filter((x) => x.art === "staerke").length, 1);
  const fall = alle.find((x) => x.text.startsWith("Bestimmt den Fall"))!;
  assert.equal(fall.skill_id, skills[0].id);
  assert.equal(fall.error_type, "regel");
  assert.equal(fall.lesson_id, lessonId);
  assert.equal(fall.test_id, testId);

  const t = repo.listTests(sid).find((x) => x.id === testId)!;
  assert.equal(t.grade, 3);
  assert.equal(t.points, 47);
  assert.equal(t.max_points, 69);
  assert.equal(t.notes, "47/69 Punkte · Lesetext 8/16 · Geschichte 8/20");

  assert.deepEqual(nachDemSpeichern({ entwurfId: id, studentId: sid, lessonId, teacherId: teacher.id, subject: "Deutsch", fehler: e.fehler, gut: e.gut, pruefung }), { erkenntnisse: 0, testId: null }, "a draft is saved only once");
  assert.equal(listErkenntnisse(sid).length, 4);

  setzeErkenntnisStatus(fall.id, sid, "erledigt");
  assert.equal(listErkenntnisse(sid, { status: "offen", art: "fehler" }).length, 2);
  repo.deleteLesson(lessonId);
  assert.equal(listErkenntnisse(sid).length, 0, "deleting the lesson removes its Erkenntnisse");
});

test("a new exam is added with the given date when none is open", async () => {
  const { repo, sid, teacher } = await setup();
  const { nachDemSpeichern } = await import("./einheit-aus-text");
  const { db } = await import("./db");
  const id = Number(db().prepare("INSERT INTO einheit_text_entwuerfe (student_id, teacher_id, text, entwurf) VALUES (?, ?, '', '{}')").run(sid, teacher.id).lastInsertRowid);
  const lessonId = repo.saveLesson({ student_id: sid, teacher_id: teacher.id, starts_at: "2026-11-08T14:00", duration_min: 100, subject: "Deutsch", topic: "", status: "abgeschlossen", activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [] });
  const out = nachDemSpeichern({ entwurfId: id, studentId: sid, lessonId, teacherId: teacher.id, subject: "Deutsch", fehler: [], gut: [], pruefung: { art: "Schularbeit", punkte: 47, max: 69, note: 3, teile: [], testId: null, datum: "2026-11-03" } });
  const t = repo.listTests(sid).find((x) => x.id === out.testId)!;
  assert.equal(t.date, "2026-11-03");
  assert.equal(t.grade, 3);
  assert.equal(t.status, "geschrieben");
});
