import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const kid = (name: string, teacherId: number) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule" as const, subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

test("a tablet is paired once with a code that works once and only for ten minutes", async () => {
  const repo = await import("./repo");
  const devices = await import("./devices");
  const { db } = await import("./db");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;

  const { code } = devices.createPairCode(niko.id, niko.id);
  assert.match(code, /^\d{6}$/);
  assert.equal(devices.openPairCode(niko.id)?.code, code);

  const wrong = devices.pairDevice(code === "000000" ? "111111" : "000000", "ip-a");
  assert.ok("error" in wrong);

  const late = devices.pairDevice(code, "ip-a", Date.now() + 11 * 60_000);
  assert.ok("error" in late, "an expired code does not work");

  const ok = devices.pairDevice(` ${code.slice(0, 3)} ${code.slice(3)} `, "ip-a");
  assert.ok("token" in ok, "spaces in the code are ignored");
  assert.equal(ok.device.teacher_id, niko.id);
  assert.equal(ok.device.name, "Niko – Schüler-Tablet");
  assert.equal(devices.deviceForToken(ok.token)?.id, ok.device.id);
  const stored = db().prepare("SELECT token_hash FROM student_devices WHERE id = ?").get(ok.device.id) as { token_hash: string };
  assert.notEqual(stored.token_hash, ok.token, "only the hash of the secret is stored");
  assert.equal(devices.deviceForToken(stored.token_hash), null, "the stored hash is no key");

  assert.ok("error" in devices.pairDevice(code, "ip-b"), "a code works once");
  assert.equal(devices.hasDevice(niko.id), true);

  devices.renameDevice(ok.device.id, "  Tablet blau  ");
  assert.equal(devices.getDevice(ok.device.id)?.name, "Tablet blau");

  devices.revokeDevice(ok.device.id);
  assert.equal(devices.deviceForToken(ok.token), null, "a disconnected tablet loses access at once");
  assert.equal(devices.hasDevice(niko.id), false);
});

test("guessing codes is blocked after eight wrong tries", async () => {
  const repo = await import("./repo");
  const devices = await import("./devices");
  const thomas = repo.listTeachers().find((t) => t.name === "Thomas")!;
  const { code } = devices.createPairCode(thomas.id, thomas.id);
  const other = code === "999999" ? "999998" : "999999";
  for (let i = 0; i < 8; i++) assert.ok("error" in devices.pairDevice(other, "ip-guess"));
  assert.equal(devices.pairingBlocked("ip-guess"), true);
  const blocked = devices.pairDevice(code, "ip-guess");
  assert.ok("error" in blocked && /Zu viele/.test(blocked.error), "even the right code waits while blocked");
  assert.ok("token" in devices.pairDevice(code, "ip-other"), "other tablets are not affected");
});

test("tablet → teacher → running unit → student; two teachers never mix", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const learning = await import("./learning");
  const devices = await import("./devices");
  const { buildWorksheet } = await import("./service");
  const [niko, thomas] = ["Niko", "Thomas"].map((n) => repo.listTeachers().find((t) => t.name === n)!);

  const anna = repo.createStudent(kid("Anna Test", niko.id));
  const max = repo.createStudent(kid("Max Test", niko.id));
  const lea = repo.createStudent(kid("Lea Test", thomas.id));

  // Niko has no tablet any more (revoked above): sending says so instead of failing silently
  assert.equal(devices.hasDevice(niko.id), false);
  const a = units.startUnit(niko.id, anna, { subject: "Mathematik" }).unit;
  const l = units.startUnit(thomas.id, lea, { subject: "Mathematik" }).unit;
  assert.equal(units.activeUnitForTeacher(niko.id)?.id, a.id);
  assert.equal(units.activeUnitForTeacher(thomas.id)?.id, l.id);

  const { id: w1 } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.dividieren"], difficulty: "leicht", count: 2, taskType: "calc", useAI: false });
  const forAnna = repo.assignWorksheet(w1, anna, "", a.id);
  const { id: w2 } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.dividieren"], difficulty: "leicht", count: 2, taskType: "calc", useAI: false });
  const forLea = repo.assignWorksheet(w2, lea, "", l.id);

  assert.deepEqual(live.unitAssignments(a.id).map((x) => x.id), [forAnna]);
  assert.deepEqual(live.unitAssignments(l.id).map((x) => x.id), [forLea]);
  assert.equal(live.unitAssignment(l.id, forAnna), null, "Thomas's tablet cannot open Anna's exercise");

  assert.deepEqual(live.showOnTablet(a, { kind: "aufgabe", assignmentId: forAnna }), { status: "kein-geraet" });
  // Thomas has a tablet but it is not connected right now
  assert.deepEqual(live.showOnTablet(l, { kind: "aufgabe", assignmentId: forLea }), { status: "offline", device: "tablet" });
  assert.equal(live.liveSnapshot(l.id)?.current?.state, "nicht angekommen", "offline: not counted as delivered");
  assert.equal(live.markDelivered(forLea), true);
  assert.equal(live.liveSnapshot(l.id)?.current?.state, "arbeitet");

  // Anna → Max: the tablet only ever sees the running unit, so nothing of Anna is left
  learning.endUnit(a.id, { byTeacherId: niko.id });
  assert.equal(units.activeUnitForTeacher(niko.id), null, "after the end: Bereit für die nächste Einheit");
  const m = units.startUnit(niko.id, max).unit;
  assert.equal(units.activeUnitForTeacher(niko.id)?.id, m.id);
  assert.deepEqual(live.unitAssignments(m.id), []);
  assert.equal(live.unitAssignment(m.id, forAnna), null);
  assert.equal(repo.getAssignment(forAnna)?.student_id, anna, "Anna's work stays on the server");
  assert.equal(units.activeUnitForTeacher(thomas.id)?.id, l.id, "Thomas is not affected");
});
