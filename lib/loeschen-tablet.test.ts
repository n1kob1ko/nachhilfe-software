import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/** Simulation 27.11.2026: nach „Übung löschen“ zeigte das Tablet weiter „Aufgabe 11 von 21“ der gelöschten Übung. */
test("Übung gelöscht: das Tablet der laufenden Einheit geht zum Start", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({
    name: "Lena Löschen", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(niko.id, sid, { subject: "Deutsch" }).unit;
  const neu = () =>
    repo.createWorksheet(
      { title: "Fehler im Text", subject: "Deutsch", grade: 6, school_type: "AHS", klasse: 2, topic: "x", difficulty: "mittel", task_type: "free", kind: "uebung", source: "manuell", skill_ids: [], status: "freigegeben" },
      [{ type: "free", skillId: null, difficulty: "mittel", prompt: "Schreib.", data: {}, answer: { criteria: ["x"] }, solution: "", hints: [], errorMap: [] }],
    );
  const ws = neu();
  const asg = repo.assignWorksheet(ws, sid, "", unit.id);
  live.showOnTablet(units.getUnit(unit.id)!, { kind: "aufgabe", assignmentId: asg });
  const ids = live.einheitenMit({ worksheetId: ws });
  assert.deepEqual(ids, [unit.id]);
  repo.deleteWorksheet(ws);
  live.nachLoeschen(ids);
  assert.equal(units.getUnit(unit.id)!.device_view, "");
  // eine andere Übung am Tablet bleibt, wenn eine Zuweisung daneben gelöscht wird
  const zwei = repo.assignWorksheet(neu(), sid, "", unit.id);
  const drei = repo.assignWorksheet(neu(), sid, "", unit.id);
  live.showOnTablet(units.getUnit(unit.id)!, { kind: "aufgabe", assignmentId: zwei });
  const vonDrei = live.einheitenMit({ assignmentId: drei });
  repo.deleteAssignment(drei);
  live.nachLoeschen(vonDrei);
  assert.equal(units.getUnit(unit.id)!.device_view, `aufgabe:${zwei}`);
});
