import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Live-Duelle am Schüler-Tablet (niko 2026-11-25: „ich habe gerade 2 schüler gleichzeitig und die sind am tablet …
 * ich möchte, dass sie duelle auch von der schüler ansicht machen können“): die Ansicht „duell:<id>“ geht wie die
 * anderen über units.device_view; wer am Tablet startet, ist gleich bereit, der andere tippt „Bereit“.
 */
test("Tablet-Ansicht Live-Duell: lesen, zeigen, Live-Status, Start vom Tablet", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const duelle = await import("./duelle");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const neu = (name: string) =>
    repo.getStudent(
      repo.createStudent({
        name, grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Deutsch"],
        current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
      }),
    )!;
  const mia = neu("Mia Duell");
  const ben = neu("Ben Duell");
  const uMia = units.startUnit(niko.id, mia.id, { subject: "Deutsch" }).unit;
  units.startUnit(niko.id, ben.id, { subject: "Deutsch" });
  assert.equal(units.runningUnits(niko.id).length, 2);

  assert.deepEqual(live.parseView("duell:12"), { kind: "duell", id: 12 });
  assert.deepEqual(live.parseView("duell:x"), { kind: "start" });

  // so macht es tabletLiveDuellStartenAction: Mia fordert Ben heraus und ist gleich bereit
  const r = duelle.starteLiveDuell(niko.id, mia.id, ben.id, "artikel");
  assert.ok(r.ok, r.ok ? "" : r.fehler);
  if (!r.ok) return;
  duelle.bereit(mia.id, r.id);
  live.showOnTablet(uMia, { kind: "duell", id: r.id });
  assert.equal(units.getUnit(uMia.id)!.device_view, `duell:${r.id}`);
  assert.equal(live.liveSnapshot(uMia.id)?.spiel?.titel, "Live-Duell");

  // Bens Tablet: der Ruf „Ein Duell wartet“; Mia sieht sich schon als bereit
  assert.equal(duelle.wartendesLiveDuell(ben.id), r.id);
  assert.equal(duelle.duellSicht(mia.id, r.id)?.ich.bereit, true);
  assert.equal(duelle.duellSicht(ben.id, r.id)?.status, "offen");
  // Ben tippt „Bereit“: es geht los
  duelle.bereit(ben.id, r.id);
  assert.equal(duelle.duellSicht(ben.id, r.id)?.status, "laeuft");
});
