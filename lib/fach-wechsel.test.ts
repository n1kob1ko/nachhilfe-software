/**
 * „Fach ändern“ in der laufenden Einheit (niko, 12.11.2026: die Einheit startete in Deutsch, die Schülerin brauchte
 * Mathe). Ein Tippen setzt das Fach, der Plan geht im neuen Fach neu los, und das gewählte Fach gilt am Ende auch in
 * der Dokumentation. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const learning = await import("./learning");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Mia Beispiel", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Deutsch", "Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(teacher.id, sid, { subject: "Deutsch" }).unit;
  return { db, repo, units, c, learning, teacher, sid, unit };
}

test("Fach ändern: das Fach der Einheit wird das gewählte, der Ablauf fängt neu an, Notizen bleiben", async () => {
  const s = await setup();
  // a Deutsch plan was already in use: a step done and a note written
  const vorher = s.c.cockpit(s.unit.id, { mitPlan: true });
  const erster = vorher.plan[0];
  if (erster) {
    s.c.markiereSchritt(s.unit.id, erster.id, "erledigt");
    s.c.setzeNotiz(s.unit.id, erster.id, "Notiz bleibt");
  }
  const out = s.c.wechsleFach(s.unit.id, "mathematik");
  assert.deepEqual(out, { ok: true, fach: "Mathematik", geaendert: true }, "eingetippt klein: in der Schreibweise des Fachs");
  const u = s.units.getUnit(s.unit.id)!;
  assert.equal(u.subject, "Mathematik");
  assert.equal(u.fach_gewaehlt, 1);
  const stand = s.c.leseStand(s.unit.id);
  assert.equal(stand.paket_id, null);
  assert.equal(stand.plan, null, "der Plan kommt neu aus den Daten des neuen Fachs");
  assert.deepEqual(stand.erledigt, []);
  if (erster) assert.equal(stand.notizen[String(erster.id)], "Notiz bleibt");
  // the same subject again: nothing starts over
  assert.deepEqual(s.c.wechsleFach(s.unit.id, "Mathematik"), { ok: true, fach: "Mathematik", geaendert: false });
  assert.ok("fehler" in s.c.wechsleFach(s.unit.id, "   "), "ohne Fach geht nichts");
  s.units.finishUnit(s.unit.id, "abgebrochen");
});

test("Fach ändern: auch der geführte Ablauf fängt bei „Start“ an, mit dem alten Thema geht es nicht weiter", async () => {
  const s = await setup();
  const ablauf = await import("./einheit-ablauf");
  const thema = s.repo.listSkills().find((x) => x.subject === "Deutsch")!.id;
  // Deutsch: neues Thema gewählt, ein Thema steht fest, die Einheit ist schon beim Üben
  ablauf.waehleWeg(s.unit.id, "neu", [thema]);
  ablauf.setzeStufe(s.unit.id, "ueben");
  assert.equal(ablauf.leseAblauf(s.unit.id).stufe, "ueben");
  s.c.wechsleFach(s.unit.id, "Mathematik");
  const a = ablauf.leseAblauf(s.unit.id);
  assert.equal(a.weg, null, "„Was machen wir heute?“ wird im neuen Fach neu gefragt");
  assert.equal(a.stufe, "start");
  assert.deepEqual(a.skillIds, [], "das Thema aus Deutsch gilt in Mathematik nicht");
  assert.equal(a.aktuell, null);
  // dasselbe Fach noch einmal antippen: nichts fängt neu an
  ablauf.waehleWeg(s.unit.id, "neu");
  s.c.wechsleFach(s.unit.id, "Mathematik");
  assert.equal(ablauf.leseAblauf(s.unit.id).stufe, "stoff");
  s.units.finishUnit(s.unit.id, "abgebrochen");
});

test("Fach ändern: das gewählte Fach steht am Ende in der Dokumentation", async () => {
  const s = await setup();
  s.c.wechsleFach(s.unit.id, "Mathematik");
  const lessonId = s.learning.endUnit(s.unit.id, { byTeacherId: s.teacher.id })!;
  assert.equal(s.repo.getLesson(lessonId)?.subject, "Mathematik", "nicht das erste Fach im Profil (Deutsch)");
  assert.ok("fehler" in s.c.wechsleFach(s.unit.id, "Englisch"), "nach dem Ende nicht mehr");
});

test("ohne „Fach ändern“ bleibt es wie bisher: das Fach kommt aus den Übungen, sonst aus Plan oder Profil", async () => {
  const s = await setup();
  const lessonId = s.learning.endUnit(s.unit.id, { byTeacherId: s.teacher.id })!;
  assert.equal(s.repo.getLesson(lessonId)?.subject, "Deutsch");
});

test("Fach ändern: der Stoff des alten Fachs (Vorgabe, vorbereiteter Stoff) gilt im neuen Fach nicht mehr", async () => {
  const s = await setup();
  const ablauf = await import("./einheit-ablauf");
  const vorgabe = await import("./vorgabe");
  ablauf.waehleWeg(s.unit.id, "neu");
  await vorgabe.speichereVorgabe({ unitId: s.unit.id, teacherId: s.teacher.id, text: "Erörterung: Einleitung und Argumente", materialIds: [], testId: null, keinName: false, heute: "2026-11-26" });
  assert.ok(vorgabe.vorgabeDerEinheit(s.unit.id), "in Deutsch steht der Stoff da");
  const pid = Number(s.db().prepare("INSERT INTO stoffpakete (student_id, teacher_id, unit_id, status, fach, thema) VALUES (?, ?, ?, 'fertig', 'Deutsch', 'Erörterung')").run(s.sid, s.teacher.id, s.unit.id).lastInsertRowid);
  assert.equal(ablauf.stoffpaketDerEinheit(s.unit.id)?.id, pid);
  s.c.wechsleFach(s.unit.id, "Mathematik");
  assert.equal(vorgabe.vorgabeDerEinheit(s.unit.id), null, "„Heute: Erörterung“ steht in Mathematik nicht mehr da (Test 26.11.2026, M1)");
  assert.equal(ablauf.stoffpaketDerEinheit(s.unit.id), null, "der vorbereitete Stoff aus Deutsch auch nicht");
  assert.equal(ablauf.freiesThema(s.unit.id), null);
  // zurück in Deutsch ist der vorbereitete Stoff wieder da (er wurde nicht gelöscht)
  s.c.wechsleFach(s.unit.id, "Deutsch");
  assert.equal(ablauf.stoffpaketDerEinheit(s.unit.id)?.id, pid);
  s.units.finishUnit(s.unit.id, "abgebrochen");
});

test("Start ohne Plan: die Einheit beginnt im Fach vom letzten Mal, nicht im ersten Fach des Profils", async () => {
  const s = await setup();
  // setup: das Profil nennt Deutsch zuerst; letztes Mal war Mathematik dran
  s.c.wechsleFach(s.unit.id, "Mathematik");
  s.learning.endUnit(s.unit.id, { byTeacherId: s.teacher.id });
  assert.equal(s.learning.expectedSubject(s.sid, Date.now()), "Mathematik", "Test 26.11.2026, M2: Mia hatte zuletzt Deutsch, die Einheit startete in Mathematik");
  assert.equal(s.learning.expectedSubject(s.sid, Date.now(), "Deutsch"), "Deutsch", "die Vorbereitung von heute geht vor");
  // ein neuer Schüler ohne Einheit: wie bisher das erste Fach des Profils
  const neu = s.repo.createStudent({
    name: "Paul Beispiel", grade: 7, klasse: 3, teacher_id: s.teacher.id, school: "", school_type: "AHS", subjects: ["Englisch", "Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  assert.equal(s.learning.expectedSubject(neu, Date.now()), "Englisch");
});
