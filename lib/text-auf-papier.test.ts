import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/** Simulation 27.11.2026: ein auf Papier begonnener Text stand am Tablet als „Schreiben“, bevor er fotografiert war. */
test("auf Papier: nicht am Schülergerät, bis der Text vom Foto übernommen ist", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { createText, nochAufPapier, textsForUnit } = await import("./texts");
  const { uebernimmVonPapier } = await import("./handschrift");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({
    name: "Anna Papier", grade: 8, klasse: 4, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Englisch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(niko.id, sid, { subject: "Englisch" }).unit;
  const papier = createText({ studentId: sid, teacherId: niko.id, unitId: unit.id, subject: "Englisch", topic: "E-Mail", title: "My holidays", prompt: "", aufPapier: true });
  createText({ studentId: sid, teacherId: niko.id, unitId: unit.id, subject: "Englisch", topic: "Story", title: "Am Tablet", prompt: "" });
  const sichtbar = () => textsForUnit(unit.id).filter((t) => !nochAufPapier(t)).map((t) => t.title);
  assert.deepEqual(sichtbar(), ["Am Tablet"]);
  assert.equal(uebernimmVonPapier(papier.id, "Dear Tom,\nLast summer I went to Italy.").ok, true);
  assert.deepEqual(sichtbar(), ["My holidays", "Am Tablet"]);
});
