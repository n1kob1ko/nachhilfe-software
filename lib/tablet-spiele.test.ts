import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Lernspiele am Schüler-Tablet in der Einheit (niko 2026-11-12: „was wenn der schüler in der einheit spielen will wie
 * kann ich ihm das aufs tablet senden?“): die Ansicht „spiele“ (die Liste) und „spiel:<art>“ (ein Spiel) gehen wie die
 * anderen Ansichten über units.device_view, und der Lehrer sieht im Live-Status, was gespielt wird.
 */
test("Tablet-Ansicht Spiele: hin und zurück gelesen, Live-Status zeigt das Spiel", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const devices = await import("./devices");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const mia = repo.createStudent({
    name: "Mia Test", grade: 5, klasse: 1, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  assert.ok("token" in devices.pairDevice(devices.createPairCode(niko.id, niko.id).code, "tablet-spiele"));
  const unit = units.startUnit(niko.id, mia, { subject: "Deutsch" }).unit;

  assert.deepEqual(live.parseView("spiele"), { kind: "spiele" });
  assert.deepEqual(live.parseView("spiel:wortschatz"), { kind: "spiel", art: "wortschatz" });
  // ein Spiel, das es nicht gibt, ist die Startansicht
  assert.deepEqual(live.parseView("spiel:schach"), { kind: "start" });

  live.showOnTablet(unit, { kind: "spiele" });
  assert.equal(units.getUnit(unit.id)!.device_view, "spiele");
  let s = live.liveSnapshot(unit.id)!;
  assert.equal(s.view, "spiele");
  assert.equal(s.spiel, null);

  live.showOnTablet(units.getUnit(unit.id)!, { kind: "spiel", art: "wortschatz" });
  assert.equal(units.getUnit(unit.id)!.device_view, "spiel:wortschatz");
  s = live.liveSnapshot(unit.id)!;
  assert.equal(s.view, "spiel");
  assert.deepEqual(s.spiel, { titel: "Wortschatz" });
});
