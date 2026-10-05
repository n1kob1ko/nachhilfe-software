import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup() {
  const repo = await import("./repo");
  const { db } = await import("./db");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  const newStudent = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  return { repo, db, auth, niko, thomas, newStudent };
}

test("a student never has two running units, not even from two teachers or a direct insert", async () => {
  const { db, niko, thomas, newStudent } = await setup();
  const units = await import("./units");
  const sid = newStudent("Doppelt Test");
  const first = units.startUnit(niko.id, sid);
  const second = units.startUnit(niko.id, sid);
  const fromThomas = units.startUnit(thomas.id, sid);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(fromThomas.created, false);
  assert.equal(fromThomas.unit.id, first.unit.id);
  assert.equal(fromThomas.unit.teacher_id, niko.id, "the running unit keeps its teacher");
  assert.throws(
    () => db().prepare("INSERT INTO units (teacher_id, student_id, status, started_at, last_activity_at) VALUES (?, ?, 'gestartet', ?, ?)").run(niko.id, sid, "x", "x"),
    /UNIQUE/,
    "the database itself refuses a second running unit",
  );
  assert.equal(units.runningUnits().filter((u) => u.student_id === sid).length, 1);

  // only the unit's teacher or an admin may end it
  assert.equal(units.canManageUnit(niko, first.unit), true);
  assert.equal(units.canManageUnit({ id: thomas.id, is_admin: 0 }, first.unit), false);
  assert.equal(units.canManageUnit({ id: thomas.id, is_admin: 1 }, first.unit), true);

  // after the end a new unit can start
  units.finishUnit(first.unit.id, "beendet", { byTeacherId: niko.id });
  assert.equal(units.startUnit(thomas.id, sid).created, true);
});

test("a running unit lives in the database: a new session (reload, closed browser) still finds it", async () => {
  const { auth, niko, newStudent } = await setup();
  const units = await import("./units");
  const sid = newStudent("Reload Test");
  const { unit } = units.startUnit(niko.id, sid, { subject: "Mathematik" });
  const s1 = auth.createSession(niko.id);
  auth.deleteSession(s1.token); // "logout, unit keeps running"
  const s2 = auth.createSession(niko.id);
  assert.equal(auth.teacherForToken(s1.token), null, "the old session is gone on the server");
  assert.equal(auth.teacherForToken(s2.token)?.id, niko.id);
  const running = units.runningUnits(niko.id).find((u) => u.student_id === sid)!;
  assert.equal(running.id, unit.id);
  assert.equal(running.subject, "Mathematik");
  assert.equal(running.started_at, unit.started_at);
});

test("practice without a running unit is stored as self-practice and never billed", async () => {
  const { repo, niko, newStudent } = await setup();
  const { buildWorksheet, submitAnswer } = await import("./service");
  const units = await import("./units");
  const sid = newStudent("Allein Test");
  const student = repo.getStudent(sid)!;
  const { id: wid } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count: 3, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(wid, sid);
  for (const t of repo.listTasks(wid)) await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: t.answer.accepted?.[0] ?? "", timeMs: 15_000, hintsUsed: 0 });
  const attempts = repo.listAttemptsForAssignment(aid);
  assert.equal(attempts.length, 3);
  assert.ok(attempts.every((a) => a.unit_id === null), "no unit, so no unit id");
  const doc = repo.getLessonForAssignment(aid)!;
  assert.equal(doc.kind, "selbststaendig");
  assert.equal(units.listUnits({ studentId: sid }).length, 0, "no tutoring unit was created");
  assert.equal(repo.billingEntries({ from: "0000", to: "9999" }).filter((r) => r.student_id === sid).length, 0, "not billed");

  // an idle unit is closed before the next answer, so later self-practice is not counted as tutoring
  const { unit } = units.startUnit(niko.id, sid, { at: Date.now() - 4 * 3600_000 });
  const { id: wid2 } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count: 1, taskType: "calc", useAI: false });
  const aid2 = repo.assignWorksheet(wid2, sid);
  const t = repo.listTasks(wid2)[0];
  await submitAnswer({ token: student.access_token, assignmentId: aid2, taskId: t.id, answer: t.answer.accepted?.[0] ?? "", timeMs: 10_000, hintsUsed: 0 });
  assert.equal(units.getUnit(unit.id)!.ended_by, "automatisch");
  assert.equal(repo.listAttemptsForAssignment(aid2)[0].unit_id, null);
});

test("billing: teachers without admin rights only see their own lessons", async () => {
  const { niko, thomas } = await setup();
  const { scopeToViewer } = await import("./billing");
  assert.deepEqual(scopeToViewer({ monat: "2026-10", lehrer: String(niko.id) }, { id: thomas.id, is_admin: 0 }), { monat: "2026-10", lehrer: String(thomas.id) });
  assert.deepEqual(scopeToViewer({ monat: "2026-10" }, { id: niko.id, is_admin: 1 }), { monat: "2026-10" });
});

test("login: passwords are hashed, wrong passwords are throttled, sessions are checked on the server", async () => {
  const { db, auth, niko } = await setup();
  const rows = db().prepare("SELECT password_hash FROM teachers").all() as { password_hash: string }[];
  assert.ok(rows.every((r) => r.password_hash.startsWith("scrypt$") && !r.password_hash.includes("lernheft")));
  assert.equal(auth.teacherForToken("ausgedacht"), null, "an invented cookie value is no session");
  for (let i = 0; i < 5; i++) auth.noteFailedLogin("thomas");
  assert.ok(auth.loginBlockedMinutes("thomas") > 0, "locked after 5 wrong passwords");
  assert.equal(auth.loginBlockedMinutes("niko"), 0, "other accounts are not affected");
  auth.clearFailedLogins("thomas");
  assert.equal(auth.loginBlockedMinutes("thomas"), 0);
  const expired = auth.createSession(niko.id);
  db().prepare("UPDATE teacher_sessions SET expires_at = '2000-01-01' WHERE token = ?").run(expired.token);
  assert.equal(auth.teacherForToken(expired.token), null, "expired sessions are refused");
  db().prepare("UPDATE teachers SET active = 0 WHERE id = ?").run(niko.id);
  const s = auth.createSession(niko.id);
  assert.equal(auth.teacherForToken(s.token), null, "deactivated teachers lose access at once");
  db().prepare("UPDATE teachers SET active = 1 WHERE id = ?").run(niko.id);
});

test("export: the JSON backup holds every row and restores into an empty database unchanged", async () => {
  const { db, auth, niko } = await setup();
  const { seedDemo } = await import("./demo");
  const { exportBackup, restoreBackup, backupCounts } = await import("./backup");
  const { openDatabase } = await import("./db");
  seedDemo();
  auth.createSession(niko.id);

  const b = exportBackup();
  const json = JSON.parse(JSON.stringify(b));
  // every table except the login sessions, with every row
  const tables = (db().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
  for (const t of tables) {
    if (t === "teacher_sessions") {
      assert.equal(json.tables[t], undefined, "sessions are not exported");
      continue;
    }
    const { c } = db().prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get() as { c: number };
    assert.equal(json.tables[t].rows.length, c, `all rows of ${t}`);
  }
  assert.ok(json.tables.attempts.rows.length > 100, "demo data is in there");
  assert.ok(json.tables.teachers.rows.every((r: { password_hash: unknown }) => r.password_hash === null), "no password hashes");

  const other = openDatabase(":memory:");
  const restored = restoreBackup(other, json);
  assert.deepEqual(restored, backupCounts(b));
  const again = exportBackup(other);
  for (const t of Object.keys(b.tables)) assert.deepEqual(again.tables[t].rows, b.tables[t].rows, `table ${t} is identical after restore`);
  const hash = (other.prepare("SELECT password_hash, must_change_password FROM teachers WHERE username = 'niko'").get() as { password_hash: string; must_change_password: number });
  assert.ok(hash.password_hash.startsWith("scrypt$"), "after a restore the start password applies");
  assert.equal(hash.must_change_password, 1);
  assert.throws(() => restoreBackup(other, { format: "etwas-anderes" }), /keine Lernheft-Sicherung/);
});

test("export: every CSV dataset builds, and cells cannot run as spreadsheet formulas", async () => {
  await setup();
  const { DATASETS, datasetCsv } = await import("./exports");
  const { toCsv } = await import("./csv");
  for (const d of DATASETS) {
    const csv = datasetCsv(d.key)!;
    assert.ok(csv.body.startsWith("﻿"), `${d.key} has a BOM for Excel`);
    const header = csv.body.slice(1).split("\r\n")[0];
    assert.equal(header.split(";").length, d.build().headers.length, `${d.key} header`);
  }
  const out = toCsv(["a", "b", "c"], [["=SUMME(A1)", 'Er sagte "ja"; gut', -3.5]]);
  assert.equal(out, '﻿a;b;c\r\n\'=SUMME(A1);"Er sagte ""ja""; gut";-3,5\r\n');
  assert.equal(datasetCsv("passwoerter"), null, "only known datasets");
});

test("upgrading an old database closes duplicate running units and marks old automatic ends", async () => {
  const { openDatabase } = await import("./db");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-")), "alt.db");
  let conn = openDatabase(file);
  conn.exec("DROP INDEX idx_units_running");
  conn.exec("INSERT INTO students (name, grade, access_token) VALUES ('Alt', 6, 'tok-alt')");
  const ins = conn.prepare("INSERT INTO units (teacher_id, student_id, status, started_at, ended_at, last_activity_at, end_reason, ended_by) VALUES (1, 1, ?, ?, ?, ?, ?, '')");
  ins.run("gestartet", "2026-10-01T10:00:00.000Z", null, "2026-10-01T10:00:00.000Z", "");
  ins.run("gestartet", "2026-10-01T10:01:00.000Z", null, "2026-10-01T10:01:00.000Z", "");
  ins.run("beendet", "2026-09-01T10:00:00.000Z", "2026-09-01T11:00:00.000Z", "2026-09-01T10:00:00.000Z", "automatisch beendet, Endzeit geschätzt");
  conn.close();
  conn = openDatabase(file);
  const rows = conn.prepare("SELECT id, status, ended_by, end_estimated FROM units ORDER BY id").all() as { id: number; status: string; ended_by: string; end_estimated: number }[];
  assert.deepEqual(rows.map((r) => r.status), ["gestartet", "abgebrochen", "beendet"]);
  assert.equal(rows[2].ended_by, "automatisch");
  assert.equal(rows[2].end_estimated, 1);
  assert.ok(conn.prepare("SELECT 1 FROM sqlite_master WHERE name = 'idx_units_running'").get());
  conn.close();
});
