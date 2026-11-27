import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("satzUm: the sentence around a place, quotes after the stop included", async () => {
  const { satzUm } = await import("./text-uebung");
  const t = "Ich gehe heim. Er sagt: „Komm mit.“ Dann regnet es";
  const at = (w: string) => {
    const s = t.indexOf(w);
    const [a, b] = satzUm(t, s, s + w.length);
    return t.slice(a, b);
  };
  assert.equal(at("gehe"), "Ich gehe heim.");
  assert.equal(at("sagt"), "Er sagt: „Komm mit.“");
  assert.equal(at("regnet"), "Dann regnet es");
});

test("verteile: one area as usual; several by number of errors, 3 to 6 each, never more than usual", async () => {
  const { verteile } = await import("./text-uebung");
  assert.deepEqual(verteile([4], [8]), [8]);
  assert.deepEqual(verteile([6, 3, 1], [8, 8, 8]), [6, 4, 3]);
  assert.deepEqual(verteile([1, 1], [8, 2]), [6, 2]);
});

test("„Übungen zu allen Fehlern senden“: one exercise with every open area of the text, then own sentences; all count as practised", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const ab = await import("./einheit-ablauf");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const { docFromText } = await import("./text-doc");
  const tu = await import("./text-uebung");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Lea Satz", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(teacher.id, sid, { subject: "Deutsch" }).unit;
  const satz = "Ich weis das es regnet. Wir gehen in die schule und lernen viel. Morgen ist frei";
  const t = texts.createText({ studentId: sid, teacherId: teacher.id, unitId: unit.id, subject: "Deutsch", topic: "", title: "Mein Tag", prompt: "" });
  texts.saveFromPaper(t.id, docFromText(satz));
  const c = tc.ensureCorrection(t.id, teacher.id, unit.id);
  assert.equal(tu.textUebungPlan(unit.id), null, "nothing marked yet");
  const stelle = (wort: string, neu: string) => {
    const start = satz.indexOf(wort);
    const out = tc.addTeacherItem(c.id, { block: 0, start, end: start + wort.length, category: "rechtschreibung", kind: "fehler", replacement: neu, explanation: "" }, teacher.id);
    assert.ok("item" in out, JSON.stringify(out));
  };
  stelle("weis", "weiß");
  stelle("das", "dass");
  stelle("schule", "Schule");

  const plan = tu.textUebungPlan(unit.id)!;
  assert.deepEqual(plan.bereiche.map((b) => b.skillId), ["deutsch.recht.sss", "deutsch.recht.dasdass", "deutsch.recht.gross"]);
  // own sentences: the first one holds two errors, both fixed in its right version
  assert.deepEqual(plan.eigene.map((e) => [e.data.faulty, e.answer.accepted]), [
    ["Ich weis das es regnet.", ["Ich weiß dass es regnet."]],
    ["Wir gehen in die schule und lernen viel.", ["Wir gehen in die Schule und lernen viel."]],
  ]);

  const out = tu.sendeZuDenTextFehlern(unit.id, teacher.id);
  assert.ok(!("fehler" in out), JSON.stringify(out));
  const aufgaben = repo.listTasks(out.worksheetId);
  assert.equal(aufgaben.length, plan.bereiche.reduce((n, b) => n + b.aufgaben, 0) + plan.eigene.length);
  assert.equal(aufgaben.at(-1)!.type, "fix", "own sentences come last");
  assert.equal(repo.getAssignment(out.assignmentId)?.unit_id, unit.id);
  // every area counts as practised: the card goes on, nothing is offered twice
  assert.deepEqual(ab.textFehler(unit.id)!.skills.map((x) => x.offen), [false, false, false]);
  assert.equal(tu.textUebungPlan(unit.id), null);
  assert.equal(tu.laufendeEinheitDesTexts(t.id), unit.id);

  // the exercise deleted again: the areas are open again, the button is back
  repo.deleteAssignment(out.assignmentId);
  assert.equal(tu.textUebungPlan(unit.id)?.bereiche.length, 3);
});
