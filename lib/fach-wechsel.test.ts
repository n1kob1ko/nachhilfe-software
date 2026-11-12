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
