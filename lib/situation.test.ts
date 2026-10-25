import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("the situation: a running unit leads to Unterricht, today's open documentation to Abschluss, else Heute", async () => {
  const { lage, lageHref, unterrichtZiel, abschlussZiel } = await import("./situation");
  const heute = "2026-10-25";
  const laufend = [
    { id: 8, started_at: "2026-10-25T08:50:00.000Z" },
    { id: 7, started_at: "2026-10-25T08:40:00.000Z" },
  ];
  assert.equal(unterrichtZiel(laufend), 7, "two at once: the one started first");
  assert.equal(unterrichtZiel([]), null);

  const offen = [
    { unitId: 3, endedAt: "2026-10-25T09:10:00.000Z" },
    { unitId: 4, endedAt: "2026-10-25T10:30:00.000Z" },
    { unitId: 2, endedAt: "2026-10-24T15:00:00.000Z" },
  ];
  assert.equal(abschlussZiel(offen, heute), 4, "the latest of today");
  assert.equal(abschlussZiel([{ unitId: 2, endedAt: "2026-10-24T15:00:00.000Z" }], heute), null, "yesterday's open documentation does not trap");
  // 23:30 UTC on the 24th is already the 25th in Vienna
  assert.equal(abschlussZiel([{ unitId: 5, endedAt: "2026-10-24T23:30:00.000Z" }], heute), 5, "the day in Vienna");

  assert.deepEqual(lage(laufend, offen, heute), { art: "unterricht", unitId: 7 }, "a running unit goes first");
  assert.deepEqual(lage([], offen, heute), { art: "abschluss", unitId: 4 });
  assert.deepEqual(lage([], [], heute), { art: "heute" });
  assert.equal(lageHref({ art: "heute" }), "/");
  assert.equal(lageHref({ art: "abschluss", unitId: 4 }), "/einheiten/4");
});

test("open documentation: own ended units with reviewed_at empty, newest first; confirming takes one off", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const { endUnit } = await import("./learning");
  const { offeneAbschluesse, lageFuer } = await import("./situation");
  const { bestaetigeDoku } = await import("./abschluss");
  const [niko, thomas] = repo.listTeachers();
  const neu = (name: string, teacherId: number) =>
    repo.createStudent({
      name, grade: 5, klasse: 1, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const jetzt = Date.now();
  const a = units.startUnit(niko.id, neu("Ida Probe", niko.id), { at: jetzt - 90 * 60_000 }).unit;
  const b = units.startUnit(niko.id, neu("Jan Probe", niko.id), { at: jetzt - 80 * 60_000 }).unit;
  const fremd = units.startUnit(thomas.id, neu("Kim Probe", thomas.id), { at: jetzt - 70 * 60_000 }).unit;
  assert.deepEqual(lageFuer(niko.id), { art: "unterricht", unitId: a.id }, "two running: the first one");

  const la = endUnit(a.id, { byTeacherId: niko.id, at: jetzt - 20 * 60_000 })!;
  endUnit(b.id, { byTeacherId: niko.id, at: jetzt - 10 * 60_000 });
  endUnit(fremd.id, { byTeacherId: thomas.id, at: jetzt - 5 * 60_000 });
  const offen = offeneAbschluesse(niko.id);
  assert.deepEqual(offen.map((o) => o.unitId), [b.id, a.id], "own units only, newest first");
  assert.equal(lageFuer(niko.id).art, "abschluss");

  const vorher = repo.getLesson(la)!;
  assert.equal(bestaetigeDoku(la), true);
  assert.equal(bestaetigeDoku(la), false, "a second time changes nothing");
  const nachher = repo.getLesson(la)!;
  assert.ok(nachher.reviewed_at, "confirmed");
  assert.deepEqual({ ...nachher, reviewed_at: null }, { ...vorher, reviewed_at: null }, "no other field changes");
  assert.deepEqual(offeneAbschluesse(niko.id).map((o) => o.unitId), [b.id]);
  for (const o of offeneAbschluesse(niko.id)) bestaetigeDoku(o.lessonId);
  assert.deepEqual(lageFuer(niko.id), { art: "heute" });
});
