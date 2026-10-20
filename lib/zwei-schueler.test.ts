import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Zwei Schüler gleichzeitig beim selben Lehrer (D26), im Unterricht (Fehlerbericht vom 2026-10-20):
 * zwei Einheiten laufen, beide Mathematik. Alles, was für einen Schüler gesendet wird, landet in
 * SEINER Einheit (nie in der zuletzt oder zuerst gestarteten), jedes Tablet zeigt die Einheit, die
 * an ihm gewählt wurde, und ein Senden erreicht nur das Tablet dieser Einheit.
 */
const kid = (name: string, teacherId: number) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule" as const, subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

async function setup() {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const devices = await import("./devices");
  const learning = await import("./learning");
  const wb = await import("./whiteboard");
  const hub = await import("./whiteboard-hub");
  const builder = await import("./builder");
  const { buildWorksheet } = await import("./service");
  const [niko, thomas] = ["Niko", "Thomas"].map((n) => repo.listTeachers().find((t) => t.name === n)!);
  const lena = repo.createStudent(kid("Lena Probst", niko.id));
  const jonas = repo.createStudent(kid("Jonas Weber", niko.id));
  const clara = repo.createStudent(kid("Clara Huber", niko.id));
  const emil = repo.createStudent(kid("Emil Gruber", thomas.id));
  /** an exercise made for this student (worksheets.student_id), as the builder saves it */
  const sheetFor = async (studentId: number | null) => {
    const { id } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.dividieren"], difficulty: "leicht", count: 2, taskType: "calc", useAI: false });
    repo.updateWorksheetMeta(id, { student_id: studentId });
    return id;
  };
  /** pairs a tablet of the teacher; `key` keeps the guessing protection apart */
  const pair = (teacherId: number, key: string) => {
    const out = devices.pairDevice(devices.createPairCode(teacherId, teacherId).code, key);
    assert.ok("token" in out);
    return out.device;
  };
  /** an open tablet stream: collects what the hub sends to this tablet */
  const listen = (deviceId: number) => {
    const got: { type: string; reason?: unknown }[] = [];
    const stop = hub.subscribe(live.deviceChannel(deviceId), { clientId: `t${deviceId}`, role: "schueler", name: "Tablet", pageId: null, send: (e) => got.push(e) });
    return { got, stop, refreshes: () => got.filter((e) => e.type === "refresh").length };
  };
  const fresh = (id: number) => devices.getDevice(id)!;
  return { db, repo, units, live, devices, learning, wb, builder, niko, thomas, lena, jonas, clara, emil, sheetFor, pair, listen, fresh };
}

test("two units at once: a send goes to the exercise's student, never just the latest or the first unit", async () => {
  const { repo, units, live, wb, builder, niko, thomas, lena, jonas, clara, emil, sheetFor } = await setup();
  const a = units.startUnit(niko.id, lena, { subject: "Mathematik" }).unit;
  const b = units.startUnit(niko.id, jonas, { subject: "Mathematik" }).unit;
  const e = units.startUnit(thomas.id, emil, { subject: "Mathematik" }).unit;
  assert.deepEqual(units.runningUnits(niko.id).map((u) => u.id), [a.id, b.id], "both run");

  // whose exercise it is decides
  assert.deepEqual(units.sendTargets(niko.id, lena).map((u) => u.id), [a.id]);
  assert.deepEqual(units.sendTargets(niko.id, jonas).map((u) => u.id), [b.id]);
  assert.deepEqual(units.sendTargets(niko.id, null).map((u) => u.id), [a.id, b.id], "a library task: one button per student");
  assert.deepEqual(units.sendTargets(niko.id, clara).map((u) => u.id), [a.id, b.id], "an exercise of neither: both offered");
  assert.deepEqual(units.sendTargets(thomas.id, jonas).map((u) => u.id), [e.id], "one unit running: as before");

  // „An Jonas senden“: the unit of the exercise's student, or the unit named by the button
  const forJonas = await sheetFor(jonas);
  const target = units.unitForSend(niko.id, null, repo.getWorksheet(forJonas)!.student_id);
  if ("error" in target) throw new Error(target.error);
  assert.equal(target.id, b.id, "Jonas's exercise goes to Jonas's unit");
  const noGuess = units.unitForSend(niko.id, null, null);
  assert.ok("error" in noGuess && /zwei Einheiten/.test(noGuess.error), "two units and nothing to go by: no guess");
  const picked = units.unitForSend(niko.id, a.id, jonas);
  assert.ok(!("error" in picked) && picked.id === a.id, "the button names the unit");
  assert.ok("error" in units.unitForSend(thomas.id, b.id, null), "never into another teacher's unit");

  // the send itself, as „An Jonas senden“ does it: released to the unit's student, shown in that unit
  const out = builder.releaseWorksheet(forJonas, target.student_id);
  assert.ok(out.assignmentId);
  live.showOnTablet(target, { kind: "aufgabe", assignmentId: out.assignmentId });
  assert.deepEqual(live.unitAssignments(b.id).map((x) => x.id), [out.assignmentId], "in Jonas's unit");
  assert.deepEqual(live.unitAssignments(a.id), [], "nothing in Lena's unit");
  assert.equal(units.getUnit(a.id)!.device_view, "", "Lena's view is untouched");
  assert.equal(live.resendUnit(niko.id, out.assignmentId)?.id, b.id, "„Erneut senden“ stays in Jonas's unit");
  assert.equal(live.resendUnit(thomas.id, out.assignmentId), null);

  // „Auf Whiteboard senden“: Jonas's board is preselected, the tasks land only there
  assert.equal(wb.ownBoardFor(niko.id, jonas), b.id);
  assert.equal(wb.ownBoardFor(niko.id, lena), a.id);
  assert.equal(wb.ownBoardFor(niko.id, clara), null, "no own board: the teacher picks");
  const boardA = wb.ensureBoardForUnit(a.id)!;
  const boardB = wb.ensureBoardForUnit(wb.ownBoardFor(niko.id, jonas)!)!;
  assert.notEqual(boardA.id, boardB.id, "each unit has its own board");
  wb.queueInsert(boardB.id, { kind: "tasks", title: "Brüche", worksheetId: forJonas, tasks: [] });
  assert.equal(wb.pendingInserts(boardB.id).length, 1, "on Jonas's board");
  assert.equal(wb.pendingInserts(boardA.id).length, 0, "not on Lena's board");

  // a single task of Lena's exercise goes to Lena (also while Jonas started later)
  const forLena = await sheetFor(lena);
  const one = builder.sendSingleTask(repo.listTasks(forLena)[0].id, lena, niko.id);
  assert.equal(repo.getAssignment(one.assignmentId!)?.unit_id, a.id);
});

test("two tablets: each picks its student, a send reaches only the tablet of that unit, the end frees the choice", async () => {
  const { db, units, live, devices, learning, niko, thomas, lena, jonas, emil, pair, listen, fresh } = await setup();
  const t1 = pair(niko.id, "ip-1");
  const t2 = pair(niko.id, "ip-2");
  const tt = pair(thomas.id, "ip-3");

  // one unit: nothing changes, every tablet shows it
  const a = units.startUnit(niko.id, lena, { subject: "Mathematik" }).unit;
  assert.equal(devices.deviceUnit(fresh(t1.id)).unit?.id, a.id);
  assert.equal(devices.deviceUnit(fresh(t2.id)).unit?.id, a.id);
  assert.deepEqual(live.liveSnapshot(a.id)!.parallel, { units: [], tablets: [] });

  // a second unit starts: a tablet without a choice asks „Wer arbeitet an diesem Gerät?“
  const b = units.startUnit(niko.id, jonas, { subject: "Mathematik" }).unit;
  const ask = devices.deviceUnit(fresh(t1.id));
  assert.equal(ask.unit, null);
  assert.deepEqual(ask.choices.map((u) => u.id), [a.id, b.id]);

  // the security rule stays: only a running unit of the tablet's own teacher
  const e = units.startUnit(thomas.id, emil).unit;
  assert.equal(devices.chooseDeviceUnit(t1.id, e.id), false, "not Thomas's student");
  assert.equal(devices.chooseDeviceUnit(tt.id, a.id), false, "Thomas's tablet cannot pick Lena");
  assert.equal(devices.deviceUnit(fresh(tt.id)).unit?.id, e.id, "Thomas's tablet is not affected");

  assert.equal(live.moveTablet(t1.id, a.id), true, "Lena taps her name");
  assert.equal(live.moveTablet(t2.id, b.id), true, "Jonas taps his");
  assert.equal(devices.deviceUnit(fresh(t1.id)).unit?.id, a.id);
  assert.equal(devices.deviceUnit(fresh(t2.id)).unit?.id, b.id);
  assert.deepEqual(devices.devicesOfUnit(b).map((d) => d.id), [t2.id]);
  const snap = live.liveSnapshot(b.id)!;
  assert.deepEqual(snap.parallel.units.map((u) => u.student), ["Lena", "Jonas"]);
  assert.deepEqual(
    snap.parallel.tablets.map((t) => [t.id, t.unitId]),
    [[t1.id, a.id], [t2.id, b.id]],
  );

  // both tablets are open; whatever happens in one unit reaches only its tablet
  const l1 = listen(t1.id);
  const l2 = listen(t2.id);
  assert.equal(live.tabletOnline(a), true);
  assert.equal(live.tabletOnline(b), true);
  const sent = live.showOnTablet(units.getUnit(b.id)!, { kind: "tafel" });
  assert.deepEqual(sent, { status: "gesendet", device: "tablet" });
  assert.equal(l2.refreshes(), 1, "Jonas's tablet switches to his board");
  assert.equal(l1.refreshes(), 0, "Lena's tablet is not flipped");
  assert.equal(units.getUnit(a.id)!.device_view, "", "Lena's view is untouched");
  live.showOnTablet(units.getUnit(a.id)!, { kind: "start" });
  assert.equal(l1.refreshes(), 1);
  assert.equal(l2.refreshes(), 1);

  // Lena's tablet goes offline: only her unit says so
  l1.stop();
  assert.equal(live.tabletOnline(a), false);
  assert.equal(live.tabletOnline(b), true);
  assert.deepEqual(live.showOnTablet(units.getUnit(a.id)!, { kind: "tafel" }), { status: "offline", device: "tablet" });

  // „Wechseln“: asks again
  assert.equal(live.moveTablet(t1.id, null), true);
  assert.equal(devices.deviceUnit(fresh(t1.id)).choices.length, 2);
  live.moveTablet(t1.id, a.id);

  // Lena's unit ends: every tablet of the teacher hears it, the choice is gone, the one left shows Jonas
  const before = l2.refreshes();
  learning.endUnit(a.id, { byTeacherId: niko.id });
  assert.ok(l2.refreshes() > before, "the tablets reload on the end");
  assert.equal((db().prepare("SELECT unit_id FROM student_devices WHERE id = ?").get(t1.id) as { unit_id: number | null }).unit_id, null, "the choice is freed");
  assert.equal(devices.deviceUnit(fresh(t1.id)).unit?.id, b.id, "one unit left: the tablet shows it");
  assert.equal(devices.deviceUnit(fresh(t2.id)).unit?.id, b.id);
  assert.equal(devices.chooseDeviceUnit(t1.id, a.id), false, "an ended unit cannot be chosen");
  assert.deepEqual(live.liveSnapshot(b.id)!.parallel, { units: [], tablets: [] });
  l2.stop();

  // the last one ends: „Bereit für die nächste Einheit“
  learning.endUnit(b.id, { byTeacherId: niko.id });
  assert.deepEqual(devices.deviceUnit(fresh(t2.id)), { unit: null, choices: [] });
});
