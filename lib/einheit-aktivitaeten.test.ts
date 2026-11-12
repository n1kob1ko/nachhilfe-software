/**
 * Alles, was der Schüler in einer Einheit macht, kommt mit Dauer in die Dokumentation (niko 2026-11-12: „alles was Schüler machen
 * sollte immer dazu kommen, wie lange sie für etwas brauchen usw.“): Übungen, Minitest, Whiteboard, Lernspiele, Duelle, Vokabeln,
 * Textarbeit. Keine KI, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const DIV = "mathe.brueche.dividieren";
const sql = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lea Zeitmesser", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik", "Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const aufgabe = (i: number) => ({ type: "calc" as const, skillId: DIV, difficulty: "mittel" as const, prompt: `${i}/4 : 1/2 = ?`, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] });
  const blatt = (titel: string, n: number) =>
    repo.createWorksheet(
      { title: titel, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [DIV], status: "freigegeben" },
      Array.from({ length: n }, (_, i) => aufgabe(i + 1)),
    );
  /** one final answer per task, `ms` each, answered at `at` */
  const antworte = (asg: number, unitId: number, xs: boolean[], o: { ms?: number; at?: number; offen?: boolean } = {}) => {
    const a = repo.getAssignment(asg)!;
    const tasks = repo.listTasks(a.worksheet_id);
    xs.forEach((ok, i) => {
      repo.recordAttempt({ assignment_id: asg, task_id: tasks[i].id, student_id: a.student_id, skill_id: DIV, attempt_no: 1, answer: ok ? "1" : "2", correct: ok ? 1 : 0, final: 1, time_ms: o.ms ?? 60_000, active_ms: o.ms ?? 60_000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "", unit_id: unitId, review: o.offen && i === xs.length - 1 ? "offen" : null, created_at: o.at ? sql(o.at + i * 1000) : undefined });
    });
  };
  const runde = (art: string, skill: string, von: number, sek: number, richtig: number, anzahl: number, o: { endlos?: number; duell?: number } = {}) =>
    Number(
      db()
        .prepare("INSERT INTO spielrunden (student_id, art, skill_id, grund, anzahl, richtig, created_at, beendet_at, endlos, duell_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(sid, art, skill, o.duell ? "duell" : "fach", anzahl, richtig, sql(von), sql(von + sek * 1000), o.endlos ?? null, o.duell ?? null).lastInsertRowid,
    );
  return { db, repo, units, teacher, sid, blatt, antworte, runde };
}

test("one line per thing the student did, in order, with result and how long it took", async () => {
  const s = await setup();
  const { aktivitaetenDerEinheit, aktivitaetZeile } = await import("./einheit-aktivitaeten");
  const { gradeBoardTask } = await import("./whiteboard-grades");
  const { ensureBoardForUnit, queueInsert } = await import("./whiteboard");
  const beginn = Date.now() - 60 * 60_000;
  const unit = s.units.startUnit(s.teacher.id, s.sid, { subject: "Mathematik", at: beginn }).unit;
  const min = (n: number) => beginn + n * 60_000;

  // Minitest at the start: 3 tasks, 40 s each
  const mt = s.repo.assignWorksheet(s.blatt("Lea – Minitest Brüche", 3), s.sid, "", unit.id, "test");
  s.antworte(mt, unit.id, [true, true, false], { ms: 40_000, at: min(2) });
  // an exercise: 4 of 5 done, one waits for the teacher
  const ue = s.repo.assignWorksheet(s.blatt("Brüche dividieren", 5), s.sid, "", unit.id);
  s.antworte(ue, unit.id, [true, false, true, true], { ms: 3 * 60_000, at: min(10), offen: true });
  // two tasks sent to the board at min 25 and graded there
  const tafel = s.blatt("Tafelaufgaben", 2);
  const board = ensureBoardForUnit(unit.id)!;
  queueInsert(board.id, { kind: "tasks", title: "Tafelaufgaben", worksheetId: tafel, tasks: s.repo.listTasks(tafel).map((t, i) => ({ number: i + 1, prompt: t.prompt, options: null, taskId: t.id })) });
  s.db().prepare("UPDATE whiteboard_inserts SET created_at = ?").run(new Date(min(25)).toISOString());
  for (const [i, review] of (["richtig", "teilweise"] as const).entries()) {
    assert.deepEqual(gradeBoardTask({ studentId: s.sid, unitId: unit.id, teacherId: s.teacher.id, taskId: s.repo.listTasks(tafel)[i].id, review }), { ok: true, grade: review });
  }
  s.db().prepare("UPDATE attempts SET created_at = ?, review_at = ? WHERE answer = 'Am Whiteboard gerechnet'").run(sql(min(33)), new Date(min(33)).toISOString());
  // games on the tablet: two normal rounds of Wortschatz, an endless run of two rounds, a duel; one round before the unit
  s.runde("wortschatz", "deutsch.wortschatz.wortfelder", min(40), 150, 10, 12);
  s.runde("wortschatz", "deutsch.wortschatz.wortfelder", min(43), 90, 11, 12);
  const lauf = s.runde("artikel", "deutsch.grammatik.artikel", min(46), 120, 12, 12);
  s.db().prepare("UPDATE spielrunden SET endlos = ? WHERE id = ?").run(lauf, lauf);
  s.runde("artikel", "deutsch.grammatik.artikel", min(48), 60, 5, 7, { endlos: lauf });
  s.runde("artikel", "deutsch.grammatik.artikel", min(50), 120, 8, 10, { duell: 7 });
  s.runde("rechnen", "mathe.kopfrechnen", beginn - 3 * 60_000, 60, 12, 12);
  // Vokabeln of an own list
  const liste = Number(s.db().prepare("INSERT INTO vokabellisten (student_id, title, text) VALUES (?, 'Unit 3', 'dog – Hund')").run(s.sid).lastInsertRowid);
  s.db().prepare("INSERT INTO vokabelrunden (student_id, liste_id, anzahl, richtig, created_at, beendet_at) VALUES (?, ?, 10, 8, ?, ?)").run(s.sid, liste, sql(min(53)), sql(min(57)));
  // a text, written from min 5 to min 20
  const text = Number(s.db().prepare("INSERT INTO texts (student_id, unit_id, title, created_at, updated_at) VALUES (?, ?, 'Mein Ausflug', ?, ?)").run(s.sid, unit.id, new Date(min(5)).toISOString(), new Date(min(20)).toISOString()).lastInsertRowid);
  s.db().prepare("INSERT INTO text_units (text_id, unit_id, words_before, words_after, first_at, last_at) VALUES (?, ?, 0, 140, ?, ?)").run(text, unit.id, new Date(min(5)).toISOString(), new Date(min(20)).toISOString());

  const xs = aktivitaetenDerEinheit(unit.id, min(60));
  assert.deepEqual(xs.map(aktivitaetZeile), [
    "Minitest: 2 von 3 richtig, 2 min",
    "Textarbeit „Mein Ausflug“: 140 Wörter dazu, ca. 15 min",
    "Übung „Brüche dividieren“: 4 von 5 Aufgaben, 2 richtig, 1 Antwort noch zu bewerten, 12 min",
    "Am Whiteboard „Tafelaufgaben“: 1 von 2 richtig, 1 teilweise, ca. 8 min",
    "Lernspiel Wortschatz: 21 von 24 richtig in 2 Runden, 4 min",
    "Lernspiel der, die, das (Endlos): 17 Punkte in 2 Runden, 3 min",
    "Duell der, die, das: 8 von 10 richtig, 2 min",
    "Vokabeln „Unit 3“: 8 von 10 richtig, 4 min",
  ]);
  assert.ok(!xs.some((a) => a.titel.includes("Kopfrechnen")), "a round before the unit is not part of it");
  assert.ok(!xs.some((a) => a.titel.startsWith("Lea")), "the first name in front of a title is left out");

  // the unit ends: the documentation has it, with durations
  const { endUnit, readReport } = await import("./learning");
  const lessonId = endUnit(unit.id, { byTeacherId: s.teacher.id, at: min(60) })!;
  const lesson = s.repo.getLesson(lessonId)!;
  assert.equal(readReport(lesson)?.aktivitaeten?.length, 8, "stored with the unit's report");
  assert.match(lesson.activities, /Lernspiel Wortschatz: 21 von 24 richtig in 2 Runden, 4 min\./);
  assert.match(lesson.activities, /Vokabeln „Unit 3“: 8 von 10 richtig, 4 min\./);
  assert.match(lesson.activities, /Textarbeit „Mein Ausflug“ \(140 Wörter, ca\. 15 min\)/);
  assert.match(lesson.summary, /Außerdem: .*Lernspiel Wortschatz/);

  // the Abschluss: each under „Übungen“, the Minitest with its duration; „Bestätigen“ writes it into „Heute gemacht“
  const ab = await import("./abschluss");
  const k = ab.karteDerEinheit(unit.id, lesson);
  const uebungen = ab.punkteDerKarte(k).find((p) => p.punkt === "uebungen")!.zeilen.map((z) => z.text);
  assert.deepEqual(uebungen, [
    "Übung „Brüche dividieren“: 4 von 5 Aufgaben, 2 richtig, 1 Antwort noch zu bewerten, 12 min",
    "Am Whiteboard „Tafelaufgaben“: 1 von 2 richtig, 1 teilweise, ca. 8 min",
    "Lernspiel Wortschatz: 21 von 24 richtig in 2 Runden, 4 min",
    "Lernspiel der, die, das (Endlos): 17 Punkte in 2 Runden, 3 min",
    "Duell der, die, das: 8 von 10 richtig, 2 min",
    "Vokabeln „Unit 3“: 8 von 10 richtig, 4 min",
  ]);
  assert.ok(k.gemacht.some((z) => z.text === "Minitest am Anfang: 2 von 3 richtig, 2 min"), k.gemacht.map((z) => z.text).join("\n"));
  ab.bestaetigeAbschluss(lessonId);
  const nach = s.repo.getLesson(lessonId)!.activities;
  assert.match(nach, /^Lernspiel Wortschatz: 21 von 24 richtig in 2 Runden, 4 min$/m);
  assert.match(nach, /^Minitest am Anfang: 2 von 3 richtig, 2 min$/m);
});

test("formats: seconds, minutes, hours; open answers only after grading; nothing handed in", async () => {
  const { dauerText, aktivitaetErgebnis, aktivitaetZeile } = await import("./einheit-aktivitaeten");
  assert.equal(dauerText(40_000), "40 s");
  assert.equal(dauerText(150_000), "3 min");
  assert.equal(dauerText(65 * 60_000), "1 h 05 min");
  const basis = { art: "uebung" as const, titel: "Kürzen", start: 0, ende: 0, dauerMs: null, richtig: 0 };
  assert.equal(aktivitaetErgebnis({ ...basis, aufgaben: 3, bearbeitet: 1, offen: 1 }), "1 von 3 Aufgaben, 1 Antwort noch zu bewerten");
  assert.equal(aktivitaetErgebnis({ ...basis, aufgaben: 3, bearbeitet: 0 }), "0 von 3 Aufgaben");
  assert.equal(aktivitaetZeile({ ...basis, art: "papier", aufgaben: 4, bearbeitet: 4, richtig: 3 }), "Auf Papier „Kürzen“: 3 von 4 richtig", "paper has no duration");
  assert.equal(aktivitaetZeile({ ...basis, art: "whiteboard", titel: "", seiten: 2 }), "Whiteboard: 2 Seiten");
});

test("a unit without anything on the device: no lines, nothing invented", async () => {
  const s = await setup();
  const { aktivitaetenDerEinheit } = await import("./einheit-aktivitaeten");
  const unit = s.units.startUnit(s.teacher.id, s.sid, { subject: "Mathematik", at: Date.now() - 30 * 60_000 }).unit;
  // an unfinished game round does not count (like the Lernstand)
  s.db().prepare("INSERT INTO spielrunden (student_id, art, skill_id, anzahl, created_at) VALUES (?, 'artikel', 'deutsch.grammatik.artikel', 12, ?)").run(s.sid, sql(Date.now() - 10 * 60_000));
  assert.deepEqual(aktivitaetenDerEinheit(unit.id), []);
  assert.deepEqual(aktivitaetenDerEinheit(999_999), []);
});
