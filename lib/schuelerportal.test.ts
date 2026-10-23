/**
 * Die Übersicht der Schüler-App (lib/schuelerportal.ts): nur die eigenen Daten, nichts Unfreigegebenes, erledigte
 * Hausübungen im Verlauf, nur kommende Prüfungen. Alle Namen und Texte sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const HEUTE = "2026-10-23";
const GEHEIM = ["INTERN-Testnotiz", "INTERN-Hausübungsnotiz", "INTERN-Lehrernotiz", "INTERN-Vortragstext", "INTERN-Musterlösung", "INTERN-Erklärung", "INTERN-Beschreibung", "INTERN-Schwierigkeiten"];

async function setup() {
  const repo = await import("./repo");
  const sp = await import("./schuelerportal");
  const { db } = await import("./db");
  const teacher = repo.listTeachers()[0];
  return { repo, sp, db, teacher };
}

let nr = 0;
async function schueler(name: string) {
  const { repo, teacher } = await setup();
  const id = repo.createStudent({
    name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "INTERN-Lehrernotiz",
  });
  return repo.getStudent(id)!;
}

async function uebung(sid: number, title: string, o: { freigabe?: "nichts" | "hilfen" | "loesung" | "alles"; mode?: "normal" | "test" } = {}) {
  const { repo } = await setup();
  const w = repo.createWorksheet(
    { title, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [], teacher_id: null },
    [1, 2].map(() => ({
      type: "calc" as const, skillId: "mathe.brueche.kuerzen", difficulty: "mittel" as const, prompt: "2/4 kürzen", data: {}, answer: { accepted: ["1/2"], mode: "value" as const },
      solution: "INTERN-Musterlösung", hints: ["Teile durch 2."], errorMap: [], teacherNote: "INTERN-Erklärung",
    })),
  );
  const aid = repo.assignWorksheet(w, sid, "", null, o.mode ?? "normal");
  if (o.freigabe) repo.setFreigabe(aid, o.freigabe);
  const fertig = () => {
    for (const t of repo.listTasks(w))
      repo.recordAttempt({ assignment_id: aid, task_id: t.id, student_id: sid, skill_id: t.skillId, answer: "1/2", correct: 1, final: 1, attempt_no: 1, time_ms: 5_000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "" });
    repo.completeAssignmentIfDone(aid);
  };
  return { aid, worksheetId: w, fertig };
}

/** Eine Präsentation (mit Vortragstext), ein Lernpaket damit und eine Einheit des Schülers mit diesem Paket im Cockpit. */
async function praesentationInEinheit(sid: number, titel: string, o: { status?: "aktiv" | "archiviert"; einheit?: boolean } = {}) {
  const { db, teacher } = await setup();
  const conn = db();
  const token = `tok${String(++nr).padStart(21, "0")}`;
  const pid = Number(
    conn
      .prepare("INSERT INTO praesentationen (title, fach, thema, beschreibung, token, start_pfad, notizen, status) VALUES (?, 'Mathematik', 'Brüche', 'INTERN-Beschreibung', ?, 'index.html', ?, ?)")
      .run(titel, token, JSON.stringify({ 1: "INTERN-Vortragstext" }), o.status ?? "aktiv").lastInsertRowid,
  );
  const paket = Number(conn.prepare("INSERT INTO lernpakete (title, fach, praesentation_id) VALUES (?, 'Mathematik', ?)").run(`Paket ${titel}`, pid).lastInsertRowid);
  if (o.einheit !== false) {
    const unit = Number(
      conn.prepare("INSERT INTO units (teacher_id, student_id, status, started_at, ended_at, last_activity_at) VALUES (?, ?, 'beendet', ?, ?, ?)").run(teacher.id, sid, "2026-10-20T14:00:00.000Z", "2026-10-20T15:30:00.000Z", "2026-10-20T15:30:00.000Z").lastInsertRowid,
    );
    conn.prepare("INSERT INTO einheit_cockpit (unit_id, paket_id) VALUES (?, ?)").run(unit, paket);
  }
  return pid;
}

test("token isolation: a student gets only their own exams, homework, materials and lessons", async () => {
  const { repo, sp } = await setup();
  const anna = await schueler("Anna Beispiel");
  const bert = await schueler("Bert Muster");
  assert.equal(repo.getStudentByToken(anna.access_token)?.id, anna.id);
  assert.equal(repo.getStudentByToken("kein-gueltiger-token"), null);

  repo.addTest({ student_id: bert.id, date: "2026-11-05", subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "Berts Schularbeit", topics: ["Prozente"], status: "geplant" });
  repo.addHomework({ student_id: bert.id, subject: "Deutsch", description: "Berts Hausübung", due_date: "2026-10-25", status: "offen", notes: "" });
  const berts = await uebung(bert.id, "Berts Übung", { freigabe: "loesung" });
  const bertsPraes = await praesentationInEinheit(bert.id, "Berts Präsentation");
  repo.saveLesson({ student_id: bert.id, teacher_id: null, starts_at: "2026-10-20T14:00", duration_min: 50, subject: "Englisch", topic: "Berts Stunde", status: "abgeschlossen", activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [] });

  // Anna has a link to Bert's exercise in her homework (should never happen; even then she gets no link to it)
  repo.addHomework({ student_id: anna.id, subject: "Mathematik", description: "Annas Hausübung", due_date: "2026-10-26", status: "offen", notes: "", assignment_id: berts.aid });

  const alles = JSON.stringify({
    p: sp.kommendePruefungen(anna.id, HEUTE),
    h: sp.hausuebungen(anna.id, HEUTE),
    pr: sp.praesentationenFuer(anna.id),
    u: sp.uebungenMitLoesung(anna.id),
    s: sp.vergangeneStunden(anna.id, { now: Date.parse("2026-10-23T12:00:00Z") }),
  });
  for (const fremd of ["Bert", "Berts", "Prozente"]) assert.ok(!alles.includes(fremd), `nothing of Bert in Anna's overview (${fremd})`);
  assert.equal(sp.hausuebungen(anna.id, HEUTE).offen[0].uebungId, null, "a linked exercise of another student is never offered");
  assert.equal(sp.praesentationFreigegeben(anna.id, bertsPraes), false, "Bert's presentation cannot be opened with Anna's link");
  assert.equal(sp.praesentationFreigegeben(bert.id, bertsPraes), true);
});

test("upcoming exams: only planned ones from today on, the nearest first", async () => {
  const { repo, sp } = await setup();
  const s = await schueler("Clara Probe");
  const neu = (date: string, title: string, status: "geplant" | "geschrieben" | "abgesagt" = "geplant", topics: string[] = []) =>
    repo.addTest({ student_id: s.id, date, subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "INTERN-Testnotiz", skill_ids: [], title, topics, status });
  neu("2026-11-20", "spät", "geplant", ["Gleichungen"]);
  neu("2026-10-23", "heute", "geplant", ["Brüche", "Dezimalzahlen"]);
  neu("2026-10-22", "gestern, noch ohne Ergebnis");
  neu("2026-10-30", "abgesagt", "abgesagt");
  neu("2026-10-10", "geschrieben", "geschrieben");
  const liste = sp.kommendePruefungen(s.id, HEUTE);
  assert.deepEqual(liste.map((t) => t.titel), ["heute", "spät"]);
  assert.equal(liste[0].tage, 0);
  assert.equal(liste[1].tage, 28);
  assert.deepEqual(liste[0].stoff, ["Brüche", "Dezimalzahlen"]);
  assert.ok(!JSON.stringify(liste).includes("INTERN"), "the teacher's note of an exam is not in the data");
  assert.ok(!("notes" in liste[0]) && !("grade" in liste[0]));
});

test("homework: open ones first by due date, done ones move to the history and stay there after a reload", async () => {
  const { repo, sp, db } = await setup();
  const s = await schueler("Dora Fall");
  const ue = await uebung(s.id, "Brüche üben");
  repo.addHomework({ student_id: s.id, subject: "Mathematik", description: "Buch S. 40", due_date: "2026-10-28", status: "offen", notes: "INTERN-Hausübungsnotiz" });
  repo.addHomework({ student_id: s.id, subject: "Deutsch", description: "Gedicht lernen", due_date: "2026-10-21", status: "offen", notes: "" });
  repo.addHomework({ student_id: s.id, subject: "Englisch", description: "Vokabeln", due_date: null, status: "offen", notes: "" });
  repo.addHomework({ student_id: s.id, subject: "Mathematik", description: "Übung am Handy", due_date: "2026-10-24", status: "offen", notes: "", assignment_id: ue.aid });
  repo.addHomework({ student_id: s.id, subject: "Deutsch", description: "Schon abgehakt", due_date: "2026-10-19", status: "erledigt", notes: "" });

  let h = sp.hausuebungen(s.id, HEUTE);
  assert.deepEqual(h.offen.map((x) => x.beschreibung), ["Gedicht lernen", "Übung am Handy", "Buch S. 40", "Vokabeln"], "earliest due first, without a date last");
  assert.equal(h.offen[0].zustand, "ueberfaellig");
  assert.equal(h.offen[1].uebungId, ue.aid, "the linked exercise can be opened");
  assert.deepEqual(h.erledigt.map((x) => x.beschreibung), ["Schon abgehakt"]);
  assert.ok(!JSON.stringify(h).includes("INTERN"), "the homework note stays with the teacher");

  // the student finishes the linked exercise: the homework is done, without a tick
  ue.fertig();
  // ticked off by the teacher
  const id = (db().prepare("SELECT id FROM homework WHERE description = 'Buch S. 40'").get() as { id: number }).id;
  repo.setHomeworkStatus(id, "erledigt");
  h = sp.hausuebungen(s.id, HEUTE);
  assert.deepEqual(h.offen.map((x) => x.beschreibung), ["Gedicht lernen", "Vokabeln"]);
  assert.deepEqual(h.erledigt.map((x) => x.beschreibung), ["Buch S. 40", "Übung am Handy", "Schon abgehakt"], "the history, the latest due first");
  // the state is read from the database, so a new read (a reload) gives the same lists
  assert.deepEqual(sp.hausuebungen(s.id, HEUTE), h);

  // an archived exercise is no longer offered as a link
  db().prepare("UPDATE assignments SET archived_at = datetime('now') WHERE id = ?").run(ue.aid);
  assert.equal(sp.hausuebungen(s.id, HEUTE).erledigt.find((x) => x.beschreibung === "Übung am Handy")?.uebungId, null);
});

test("materials: only presentations of the student's own units, and only exercises whose solution is released", async () => {
  const { sp, db } = await setup();
  const s = await schueler("Emil Versuch");
  const gezeigt = await praesentationInEinheit(s.id, "Brüche kürzen");
  const archiviert = await praesentationInEinheit(s.id, "Alte Folien", { status: "archiviert" });
  const nieVerwendet = await praesentationInEinheit(s.id, "Nie verwendet", { einheit: false });
  const pr = sp.praesentationenFuer(s.id);
  assert.deepEqual(pr.map((p) => p.titel), ["Brüche kürzen"]);
  assert.equal(sp.praesentationFreigegeben(s.id, gezeigt), true);
  assert.equal(sp.praesentationFreigegeben(s.id, archiviert), false, "an archived presentation is not offered");
  assert.equal(sp.praesentationFreigegeben(s.id, nieVerwendet), false, "a presentation never used with this student is not released to him");
  assert.deepEqual(Object.keys(pr[0]).sort(), ["fach", "id", "thema", "titel", "zuletzt"], "no description, no notes, no token");

  await uebung(s.id, "Stufe Nichts", { freigabe: "nichts" });
  await uebung(s.id, "Stufe Hilfen", { freigabe: "hilfen" });
  await uebung(s.id, "Ältere Zeile ohne Stufe");
  const mitLoesung = await uebung(s.id, "Stufe Lösung", { freigabe: "loesung" });
  await uebung(s.id, "Stufe Alles", { freigabe: "alles" });
  await uebung(s.id, "Minitest", { freigabe: "alles", mode: "test" });
  const weg = await uebung(s.id, "Archiviert", { freigabe: "alles" });
  db().prepare("UPDATE assignments SET archived_at = datetime('now') WHERE id = ?").run(weg.aid);
  mitLoesung.fertig();

  const u = sp.uebungenMitLoesung(s.id);
  assert.deepEqual(u.map((x) => x.titel).sort(), ["Stufe Alles", "Stufe Lösung"], "only „Hilfen und Lösung“ and „Alles“, no Minitest, nothing archived");
  assert.equal(u.find((x) => x.titel === "Stufe Alles")?.mitErklaerung, true, "the explanation only with „Alles“");
  assert.equal(u.find((x) => x.titel === "Stufe Lösung")?.mitErklaerung, false);
  assert.equal(u.find((x) => x.titel === "Stufe Lösung")?.fertig, true);

  const daten = JSON.stringify({ pr, u });
  for (const g of GEHEIM) assert.ok(!daten.includes(g), `${g} is not in the student's materials`);
});

test("past lessons: date, subject, topic and what was practised; nothing of the teacher's documentation", async () => {
  const { repo, sp, db, teacher } = await setup();
  const s = await schueler("Fritz Vorlage");
  const conn = db();
  const unit = Number(
    conn.prepare("INSERT INTO units (teacher_id, student_id, status, started_at, ended_at, last_activity_at) VALUES (?, ?, 'beendet', ?, ?, ?)").run(teacher.id, s.id, "2026-10-21T14:00:00.000Z", "2026-10-21T15:30:00.000Z", "2026-10-21T15:30:00.000Z").lastInsertRowid,
  );
  const lesson = repo.saveLesson({
    student_id: s.id, teacher_id: teacher.id, unit_id: unit, starts_at: "2026-10-21T16:00", duration_min: 90, subject: "Mathematik", topic: "Brüche kürzen", status: "abgeschlossen",
    activities: "", mistakes: "INTERN-Schwierigkeiten", understanding: 2, tutor_notes: "INTERN-Lehrernotiz", next_steps: "", skill_ids: ["mathe.brueche.kuerzen", "gibt-es-nicht"],
    difficulties: "INTERN-Schwierigkeiten", summary: "INTERN-Lehrernotiz",
  });
  repo.setFamilyNote(lesson, "INTERN-Lehrernotiz", "ki");
  const ue = await uebung(s.id, "In der Einheit");
  conn.prepare("UPDATE assignments SET unit_id = ? WHERE id = ?").run(unit, ue.aid);
  for (const t of repo.listTasks(ue.worksheetId))
    repo.recordAttempt({ assignment_id: ue.aid, task_id: t.id, student_id: s.id, skill_id: t.skillId, answer: "1/2", correct: t.position === 1 ? 1 : 0, final: 1, attempt_no: 1, time_ms: 5_000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "", unit_id: unit });
  repo.saveLesson({ student_id: s.id, teacher_id: null, starts_at: "2026-10-18T10:00", duration_min: 50, subject: "Deutsch", topic: "Abgesagt", status: "abgesagt", activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [] });
  repo.saveLesson({ student_id: s.id, teacher_id: null, starts_at: "2026-10-30T10:00", duration_min: 50, subject: "Deutsch", topic: "Noch geplant", status: "geplant", activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [] });
  repo.saveLesson({ student_id: s.id, teacher_id: null, kind: "selbststaendig", starts_at: "2026-10-19T10:00", duration_min: 10, subject: "Mathematik", topic: "Allein geübt", status: "abgeschlossen", activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [] });

  const liste = sp.vergangeneStunden(s.id, { now: Date.parse("2026-10-23T12:00:00Z") });
  assert.equal(liste.length, 1, "only completed tutoring lessons, no cancelled, planned or own practice");
  const st = liste[0];
  assert.equal(st.datum, "2026-10-21");
  assert.equal(st.thema, "Brüche kürzen");
  assert.equal(st.geuebt.length, 1, "unknown skills are left out");
  assert.equal(st.aufgaben, 2);
  assert.equal(st.richtig, 1);
  assert.deepEqual(Object.keys(st).sort(), ["aufgaben", "datum", "fach", "geuebt", "id", "richtig", "thema"]);
  assert.ok(!JSON.stringify(liste).includes("INTERN"), "no notes, difficulties, summary or family note");
});
