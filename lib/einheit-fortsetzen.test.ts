/**
 * „Einheit fortsetzen“ (Audit 2026-11-07): ein Tipp zu viel auf „Einheit beenden“ ist bis FORTSETZEN_MINUTEN danach
 * nicht endgültig. Die Einheit läuft wieder, der Abschluss verschwindet aus „offen“, das zweite Beenden schreibt dieselbe
 * Dokumentation neu (Dauer, automatische Felder). Nicht nach einem automatischen Ende, nicht nach der Frist, nicht wenn
 * der Schüler schon in einer anderen Einheit sitzt. Erfundene Namen, keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { endUnit } = await import("./learning");
  const { offeneAbschluesse } = await import("./situation");
  const { autoFelderVon } = await import("./einschaetzung");
  const [niko, thomas] = repo.listTeachers();
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const DIV = "mathe.brueche.dividieren";
  let nr = 0;
  const aufgabe = (prompt: string) => ({ type: "calc" as const, skillId: DIV, difficulty: "mittel" as const, prompt, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] });
  /** drei Aufgaben zu Dividieren, in der Einheit gesendet und richtig gelöst */
  const geloest = (unitId: number, sid: number, at: number) => {
    const ws = repo.createWorksheet(
      { title: "Brüche dividieren", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [DIV], status: "freigegeben" },
      [aufgabe(`3/4 : 1/2 = ? (${++nr})`), aufgabe(`2/3 : 1/3 = ? (${++nr})`), aufgabe(`5/6 : 1/6 = ? (${++nr})`)],
    );
    const asg = repo.assignWorksheet(ws, sid, "", unitId);
    for (const t of repo.listTasks(ws)) {
      repo.recordAttempt({ assignment_id: asg, task_id: t.id, student_id: sid, skill_id: DIV, attempt_no: 1, answer: "1", correct: 1, final: 1, time_ms: 30_000, active_ms: 25_000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "", unit_id: unitId });
    }
    void at;
  };
  return { repo, units, endUnit, offeneAbschluesse, autoFelderVon, niko, thomas, schueler, geloest };
}

test("zu früh beendet → fortsetzen → läuft wieder, Abschluss nicht mehr offen → nochmal beenden schreibt dieselbe Dokumentation neu", async () => {
  const s = await setup();
  const sid = s.schueler("Mia Bruchfeld");
  const jetzt = Date.now();
  const unit = s.units.startUnit(s.niko.id, sid, { subject: "Mathematik", at: jetzt - 50 * 60_000 }).unit;
  s.geloest(unit.id, sid, jetzt - 20 * 60_000);
  const lessonId = s.endUnit(unit.id, { byTeacherId: s.niko.id, at: jetzt - 3 * 60_000 })!;
  assert.ok(lessonId);
  const beendet = s.units.getUnit(unit.id)!;
  assert.equal(beendet.status, "beendet");
  assert.deepEqual(s.units.fortsetzbar(beendet, jetzt), { ok: true, restMinuten: 7 });
  assert.equal(s.offeneAbschluesse(s.niko.id, { now: new Date(jetzt) }).length, 1, "der Abschluss wartet");
  const dokuVorher = s.repo.getLesson(lessonId)!;
  assert.equal(dokuVorher.duration_min, 47);
  assert.ok(s.autoFelderVon(dokuVorher).has("activities"), "„Was wurde gemacht“ hat die App geschrieben");
  assert.match(dokuVorher.activities, /3 Aufgaben|Brüche dividieren/);

  const wieder = s.units.resumeUnit(unit.id, jetzt);
  assert.ok(wieder);
  assert.equal(wieder.status, "gestartet");
  assert.equal(wieder.ended_at, null);
  assert.equal(wieder.ended_by, "");
  assert.equal(wieder.end_reason, "");
  assert.equal(s.units.runningUnitForStudent(sid)?.id, unit.id, "läuft wieder");
  assert.equal(s.offeneAbschluesse(s.niko.id, { now: new Date(jetzt) }).length, 0, "kein offener Abschluss, solange sie läuft");
  assert.equal(s.units.resumeUnit(unit.id, jetzt), null, "eine laufende Einheit lässt sich nicht fortsetzen");

  // noch drei Aufgaben, zehn Minuten später wirklich beendet: dieselbe Dokumentation, neue Dauer, „Was wurde gemacht“ neu
  s.geloest(unit.id, sid, jetzt + 5 * 60_000);
  const l2 = s.endUnit(unit.id, { byTeacherId: s.niko.id, at: jetzt + 10 * 60_000 });
  assert.equal(l2, lessonId, "keine zweite Dokumentation");
  const doku = s.repo.getLesson(lessonId)!;
  assert.equal(doku.duration_min, 60);
  assert.equal(doku.status, "abgeschlossen");
  assert.ok(s.autoFelderVon(doku).has("activities"), "immer noch automatisch, also beim nächsten Mal wieder neu");
  assert.notEqual(doku.activities, dokuVorher.activities, "die sechs Aufgaben stehen drin, nicht nur die ersten drei");
  assert.equal(s.repo.listLessons(sid).filter((l) => l.unit_id === unit.id).length, 1);
  assert.equal(s.offeneAbschluesse(s.niko.id, { now: new Date(jetzt + 10 * 60_000) }).length, 1);
});

test("was die Lehrkraft in die Dokumentation geschrieben hat, bleibt beim zweiten Beenden", async () => {
  const s = await setup();
  const sid = s.schueler("Ben Muster");
  const jetzt = Date.now();
  const unit = s.units.startUnit(s.niko.id, sid, { subject: "Mathematik", at: jetzt - 40 * 60_000 }).unit;
  const lessonId = s.endUnit(unit.id, { byTeacherId: s.niko.id, at: jetzt - 60_000 })!;
  const l = s.repo.getLesson(lessonId)!;
  s.repo.saveLesson({ ...l, activities: "Brüche kürzen am Whiteboard, dann 6 Aufgaben" }, lessonId);
  assert.ok(s.units.resumeUnit(unit.id, jetzt));
  s.endUnit(unit.id, { byTeacherId: s.niko.id, at: jetzt + 5 * 60_000 });
  assert.equal(s.repo.getLesson(lessonId)!.activities, "Brüche kürzen am Whiteboard, dann 6 Aufgaben");
});

test("nicht fortsetzbar: nach der Frist, nach automatischem Ende, bei einer anderen laufenden Einheit des Schülers", async () => {
  const s = await setup();
  const jetzt = Date.now();
  const a = s.schueler("Anna Beispiel");
  const ua = s.units.startUnit(s.niko.id, a, { at: jetzt - 60 * 60_000 }).unit;
  s.endUnit(ua.id, { byTeacherId: s.niko.id, at: jetzt - 11 * 60_000 });
  assert.equal(s.units.fortsetzbar(s.units.getUnit(ua.id)!, jetzt).ok, false, "11 Minuten sind zu lang");
  assert.equal(s.units.resumeUnit(ua.id, jetzt), null);
  assert.equal(s.units.fortsetzbar(s.units.getUnit(ua.id)!, jetzt - 2 * 60_000).restMinuten, 1, "9 Minuten später: noch 1 Minute");

  const b = s.schueler("Ben Muster");
  const ub = s.units.startUnit(s.niko.id, b, { at: jetzt - 60 * 60_000 }).unit;
  s.endUnit(ub.id, { at: jetzt - 60_000, estimated: true, reason: "keine Aktivität" }); // automatisch
  assert.equal(s.units.getUnit(ub.id)!.ended_by, "automatisch");
  assert.equal(s.units.fortsetzbar(s.units.getUnit(ub.id)!, jetzt).ok, false);
  assert.equal(s.units.resumeUnit(ub.id, jetzt), null);

  const c = s.schueler("Cleo Probe");
  const uc = s.units.startUnit(s.niko.id, c, { at: jetzt - 60 * 60_000 }).unit;
  s.endUnit(uc.id, { byTeacherId: s.niko.id, at: jetzt - 60_000 });
  const neu = s.units.startUnit(s.thomas.id, c, { at: jetzt - 30_000 }).unit; // Cleo sitzt schon bei Thomas
  assert.notEqual(neu.id, uc.id);
  assert.equal(s.units.fortsetzbar(s.units.getUnit(uc.id)!, jetzt).ok, false);
  assert.equal(s.units.resumeUnit(uc.id, jetzt), null);
  assert.equal(s.units.getUnit(uc.id)!.status, "beendet", "nichts verändert");
});
