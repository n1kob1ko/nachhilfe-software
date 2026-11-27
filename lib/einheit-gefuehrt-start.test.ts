import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/** Simulation 27.11.2026: ein Paket von der Übungsseite vor der Wahl am Start warf die Einheit in den früheren Unterricht. */
test("eine neue Einheit bleibt im geführten Ablauf, auch wenn zuerst eine Übung von der Übungsseite hinausgeht", async () => {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { zeigtGefuehrt } = await import("./einheit-ablauf");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({
    name: "Yusuf Start", grade: 10, klasse: 2, teacher_id: niko.id, school: "", school_type: "HTL", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(niko.id, sid, { subject: "Deutsch" }).unit;
  const ws = repo.createWorksheet(
    { title: "Paket", subject: "Deutsch", grade: 10, school_type: "HTL", klasse: 2, topic: "Erörterung", difficulty: "mittel", task_type: "free", kind: "uebung", source: "manuell", skill_ids: [], status: "freigegeben" },
    [{ type: "free", skillId: null, difficulty: "mittel", prompt: "Erörtere.", data: {}, answer: { criteria: ["x"] }, solution: "", hints: [], errorMap: [] }],
  );
  repo.assignWorksheet(ws, sid, "", unit.id);
  assert.equal(zeigtGefuehrt(unit.id), true);
  // eine Einheit aus der Zeit davor (ohne Zeile) mit gesendeter Übung bleibt, wo sie war
  db().prepare("DELETE FROM einheit_ablauf WHERE unit_id = ?").run(unit.id);
  assert.equal(zeigtGefuehrt(unit.id), false);
});
