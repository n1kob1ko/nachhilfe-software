/**
 * Der geführte Ablauf in einem Fach, zu dem die App keine Fähigkeiten kennt (Test mit vier Test-Lehrern, 26.11.2026, S2):
 * ohne KI stand nach dem Eintippen des Stoffs fünfmal „keine passende Fähigkeit“ da, und es ging nicht weiter. Jetzt ist das
 * Eingetippte das Thema von heute: „Erklären“ und „Üben“ gehen damit weiter, und es steht in der Dokumentation.
 * Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

async function setup(fach: string) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Jonas Beispiel", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "MS", subjects: ["Mathematik", "Biologie"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(teacher.id, sid, { subject: fach }).unit;
  return { repo, units, teacher, sid, unit, ablauf: await import("./einheit-ablauf"), vorgabe: await import("./vorgabe") };
}

test("Nebenfach ohne KI: der eingetippte Stoff ist das Thema von heute, und es geht weiter zu Erklären", async () => {
  const s = await setup("Biologie");
  s.ablauf.waehleWeg(s.unit.id, "neu");
  assert.equal(s.ablauf.freiesThema(s.unit.id), null, "ohne Vorgabe gibt es noch kein Thema");
  assert.ok("fehler" in s.ablauf.stoffFertig(s.unit.id), "ohne Stoff geht es nicht weiter");
  const out = await s.vorgabe.speichereVorgabe({ unitId: s.unit.id, teacherId: s.teacher.id, text: "Die Zelle: Aufbau, Zellorganellen. Buch Seite 45-48", materialIds: [], testId: null, keinName: false, heute: "2026-11-26" });
  assert.ok("ok" in out);
  assert.deepEqual(s.vorgabe.vorgabeDerEinheit(s.unit.id)!.skillIds, [], "zu Biologie kennt die App keine Fähigkeit");
  const frei = s.ablauf.freiesThema(s.unit.id)!;
  assert.match(frei.titel, /Zelle/);
  assert.doesNotMatch(frei.titel, /Seite|45/, "die Seitenangabe ist kein Thema");
  assert.ok(frei.punkte.includes("Zellorganellen"), JSON.stringify(frei.punkte));
  assert.match(frei.umfang, /45/);
  assert.deepEqual(s.ablauf.stoffFertig(s.unit.id), { ok: true });
  assert.equal(s.ablauf.leseAblauf(s.unit.id).stufe, "erklaeren");
  assert.deepEqual(s.ablauf.setzeStufe(s.unit.id, "ueben"), { ok: true });
});

test("Nebenfach ohne KI: das Thema von heute steht in der Dokumentation", async () => {
  const s = await setup("Biologie");
  s.ablauf.waehleWeg(s.unit.id, "neu");
  await s.vorgabe.speichereVorgabe({ unitId: s.unit.id, teacherId: s.teacher.id, text: "Die Zelle: Aufbau, Zellorganellen", materialIds: [], testId: null, keinName: false, heute: "2026-11-26" });
  s.ablauf.stoffFertig(s.unit.id);
  const { endUnit } = await import("./learning");
  const lessonId = endUnit(s.unit.id)!;
  const lesson = s.repo.getLesson(lessonId)!;
  assert.match(lesson.activities, /Thema heute: .*Zelle/);
});

test("Mit erkannten Fähigkeiten gibt es kein freies Thema; was nicht erkannt wurde, wird genannt", async () => {
  const s = await setup("Mathematik");
  s.ablauf.waehleWeg(s.unit.id, "neu");
  await s.vorgabe.speichereVorgabe({ unitId: s.unit.id, teacherId: s.teacher.id, text: "Brüche kürzen, Quantenphysik", materialIds: [], testId: null, keinName: false, heute: "2026-11-26" });
  const v = s.vorgabe.vorgabeDerEinheit(s.unit.id)!;
  assert.ok(v.skillIds.length > 0, "Brüche kürzen ist erkannt");
  assert.equal(s.ablauf.freiesThema(s.unit.id), null);
  assert.deepEqual(s.ablauf.ohneFaehigkeit(s.unit.id), ["Quantenphysik"]);
  assert.deepEqual(s.ablauf.stoffFertig(s.unit.id), { ok: true });
  assert.deepEqual(s.ablauf.leseAblauf(s.unit.id).skillIds, v.skillIds);
});
