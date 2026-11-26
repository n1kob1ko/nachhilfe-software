import assert from "node:assert/strict";
import test from "node:test";
import { istVeralteteAktion, sollSelbstNeuLaden } from "./neue-version";

process.env.DATABASE_PATH = ":memory:";

test("veraltete Server Action wird erkannt, andere Fehler nicht", () => {
  const next = new Error('Server Action "7f3a" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action');
  assert.equal(istVeralteteAktion(next), true);
  assert.equal(istVeralteteAktion("Read more: https://nextjs.org/docs/messages/failed-to-find-server-action"), true);
  assert.equal(istVeralteteAktion(new Error("Failed to fetch")), false);
  assert.equal(istVeralteteAktion(undefined), false);
});

test("selbst neu laden nur bei Schülern, ohne Schreiben, nach Leerlauf", () => {
  assert.equal(sollSelbstNeuLaden({ bereich: "schueler", leerlaufMs: 31_000, schreibt: false }), true);
  assert.equal(sollSelbstNeuLaden({ bereich: "schueler", leerlaufMs: 5_000, schreibt: false }), false);
  assert.equal(sollSelbstNeuLaden({ bereich: "schueler", leerlaufMs: 90_000, schreibt: true }), false);
  assert.equal(sollSelbstNeuLaden({ bereich: "lehrer", leerlaufMs: 90_000, schreibt: false }), false);
});

test("Unterrichtspause: nur aktive gestartete Einheiten halten ein Update auf", async () => {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { unterrichtLaeuft } = await import("./unterrichtspause");
  assert.equal(unterrichtLaeuft(), false);
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const id = repo.createStudent({
    name: "Pia Pause", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const u = units.startUnit(niko.id, id, { subject: "Deutsch" }).unit;
  assert.equal(unterrichtLaeuft(), true);
  // vergessen: seit einer Stunde nichts passiert
  db().prepare("UPDATE units SET last_activity_at = ? WHERE id = ?").run(new Date(Date.now() - 3_600_000).toISOString(), u.id);
  assert.equal(unterrichtLaeuft(), false);
});
