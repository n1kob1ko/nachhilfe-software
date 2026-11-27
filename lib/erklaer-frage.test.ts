/**
 * Die Frage in „Erklären“ (Test mit vier Test-Lehrern, 26.11.2026, M8): Was der Lehrer beim Erklären laut fragt, stand danach als
 * erste Aufgabe in der Übung; das Kind sah sie zweimal und kannte die Antwort schon. Und bei Fähigkeiten ohne eingebaute Aufgaben
 * („Produktregel“) stand unter der Frage nach dem typischen Fehler die Regel als erwartete Antwort.
 * Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Jonas Beispiel", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "MS", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik" }).unit;
  return { repo, teacher, sid, unit, c: await import("./cockpit") };
}

const KUERZEN = "mathe.brueche.kuerzen";

test("Was der Lehrer beim Erklären gefragt hat, steht in keiner Übung der Einheit, und die Frage bleibt dieselbe", async () => {
  const s = await setup();
  assert.ok(s.repo.getSkill(KUERZEN), "die Fähigkeit gibt es");
  const schritt = { id: 0, uebung: null, skillId: KUERZEN, art: "erklaeren" as const };
  const f = s.c.planFuehrung(s.unit.id, schritt);
  assert.ok(f.fragt && f.antwort, JSON.stringify(f));
  assert.equal(s.c.merkeFrage(s.unit.id, schritt), true, "festgehalten, sobald sie auf dem Schirm war");
  assert.equal(s.c.merkeFrage(s.unit.id, schritt), false, "die erste bleibt");
  for (const runde of [1, 2]) {
    const out = await s.c.sendeAusGenerator(s.unit.id, KUERZEN, s.teacher.id);
    assert.ok("worksheetId" in out, JSON.stringify(out));
    const aufgaben = s.repo.listTasks(out.worksheetId);
    assert.ok(aufgaben.length >= 3, `Übung ${runde}: ${aufgaben.length} Aufgaben`);
    assert.ok(aufgaben.every((t) => s.c.frageText(t) !== f.fragt), `Übung ${runde} stellt die Frage aus dem Erklären noch einmal`);
  }
  const danach = s.c.planFuehrung(s.unit.id, schritt);
  assert.equal(danach.fragt, f.fragt, "zurück im Erklären steht dieselbe Frage");
  assert.equal(danach.antwort, f.antwort);
});

test("Ohne festgehaltene Frage (alter Plan, „Mehr Werkzeuge“) bleibt es wie bisher: die Frage ist die erste Aufgabe der Übung", async () => {
  const s = await setup();
  const schritt = { id: 0, uebung: null, skillId: KUERZEN, art: "erklaeren" as const };
  const f = s.c.planFuehrung(s.unit.id, schritt);
  assert.equal(f.fragt, s.c.frageText(s.c.aufgabenImSchritt(s.unit.id, schritt)[0]));
});

test("Fähigkeit ohne eingebaute Aufgaben: die erwartete Antwort passt zur Frage", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { generateBuiltIn, hasBuiltInGenerator, EXPLAIN } = await import("./generators");
  const { typischeFehler } = await import("./themen");
  const skill = repo.listSkills().find((x) => x.subject === "Mathematik" && !hasBuiltInGenerator(x.id) && EXPLAIN[x.id] && typischeFehler(x.id).length > 0);
  assert.ok(skill, "eine Mathe-Fähigkeit ohne Generator, mit Erklärung und typischen Fehlern");
  const aufgaben = generateBuiltIn({ subject: "Mathematik", skills: [{ id: skill!.id, name: skill!.name }], difficulty: "mittel", count: 3, taskType: "free", seed: 1 });
  const erklaere = aufgaben.find((t) => /^Erkläre in eigenen Worten/.test(t.prompt))!;
  const fehler = aufgaben.find((t) => /^Welcher Fehler/.test(t.prompt))!;
  const erfinde = aufgaben.find((t) => /^Erfinde eine eigene Aufgabe/.test(t.prompt))!;
  assert.ok(erklaere && fehler && erfinde, aufgaben.map((t) => t.prompt).join(" | "));
  assert.equal(erklaere.answer.sample, EXPLAIN[skill!.id], "die Erklärung ist die Musterantwort zu „Erkläre …“");
  assert.notEqual(fehler.answer.sample, EXPLAIN[skill!.id], "die Regel ist keine Antwort auf die Frage nach dem typischen Fehler");
  assert.ok(typischeFehler(skill!.id).some((x) => fehler.answer.sample?.includes(x)), `typische Fehler als Musterantwort: ${fehler.answer.sample}`);
  assert.ok(!erfinde.answer.sample, "eine erfundene Aufgabe hat keine eine Musterantwort");
  assert.doesNotMatch(erfinde.solution, new RegExp(EXPLAIN[skill!.id].slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("„Lieber auf Papier“ zweimal: dasselbe Blatt noch einmal, kein zweites mit demselben Namen (Test 26.11.2026, K12)", async () => {
  const s = await setup();
  const ablauf = await import("./einheit-ablauf");
  assert.equal(ablauf.gedruckteUebungZu(s.unit.id, KUERZEN), null);
  const out = await s.c.sendeAusGenerator(s.unit.id, KUERZEN, s.teacher.id, null, "drucken");
  assert.ok("worksheetId" in out);
  assert.equal(ablauf.gedruckteUebungZu(s.unit.id, KUERZEN), out.worksheetId, "das gedruckte, noch nicht fotografierte Blatt");
  assert.equal(ablauf.gedruckteUebungZu(s.unit.id, "mathe.brueche.erweitern"), null, "ein anderes Thema bekommt sein eigenes Blatt");
});
