import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
delete process.env.INITIAL_TEACHER_PASSWORD;
const env = process.env as Record<string, string | undefined>;

test("the public start password never logs in on the production server", async () => {
  const { checkLogin } = await import("./auth");
  const { setPassword } = await import("./auth");
  const repo = await import("./repo");
  const thomas = repo.listTeachers().find((t) => t.name === "Thomas")!;
  assert.ok(checkLogin("thomas", "lernheft"), "locally the demo password works");
  env.NODE_ENV = "production";
  try {
    assert.equal(checkLogin("thomas", "lernheft"), null, "on the server it counts as wrong");
    env.ALLOW_DEFAULT_PASSWORD = "1";
    assert.ok(checkLogin("thomas", "lernheft"), "test runs can allow it explicitly");
    delete env.ALLOW_DEFAULT_PASSWORD;
    setPassword(thomas.id, "ein-eigenes-passwort");
    assert.ok(checkLogin("thomas", "ein-eigenes-passwort"));
    assert.equal(checkLogin("thomas", "lernheft"), null, "after the change the old start password is gone");
  } finally {
    env.NODE_ENV = "test";
  }
  env.NODE_ENV = "test";
  assert.equal(checkLogin("thomas", "lernheft"), null, "also locally once changed");
});

test("start passwords for new or reset accounts are random and readable", async () => {
  const { randomStartPassword } = await import("./password");
  const a = randomStartPassword();
  assert.match(a, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.notEqual(a, randomStartPassword());
  assert.doesNotMatch(a, /[01ilo]/, "no look-alike characters");
});

test("login attempts are limited per name and per address, with the same message for unknown names", async () => {
  const { loginBlockedMinutes, noteFailedLogin, clearFailedLogins } = await import("./auth");
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) noteFailedLogin("niemand", "10.0.0.1", t0);
  assert.equal(loginBlockedMinutes("niemand", "10.0.0.9", t0), 10, "an unknown name is locked exactly like a real one");
  assert.equal(loginBlockedMinutes("niko", "10.0.0.1", t0), 0, "5 failures do not yet block the address");
  clearFailedLogins("niemand");

  // one address tries many names: after 20 failures it waits 15 minutes, for every name
  for (let i = 0; i < 20; i++) noteFailedLogin(`name${i}`, "10.0.0.2", t0 + i);
  assert.equal(loginBlockedMinutes("niko", "10.0.0.2", t0 + 20), 15);
  assert.equal(loginBlockedMinutes("niko", "10.0.0.3", t0 + 20), 0, "other addresses are not affected");
  assert.equal(loginBlockedMinutes("niko", "10.0.0.2", t0 + 16 * 60_000), 0, "the wait runs out");

  // failures spread over more than 15 minutes do not add up
  for (let i = 0; i < 19; i++) noteFailedLogin(`x${i}`, "10.0.0.4", t0);
  noteFailedLogin("x", "10.0.0.4", t0 + 16 * 60_000);
  assert.equal(loginBlockedMinutes("niko", "10.0.0.4", t0 + 16 * 60_000), 0);
});

test("the client address comes from the proxy, not from a made-up header", async () => {
  const { clientIp } = await import("./client-ip");
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(clientIp(h({ "x-real-ip": "84.1.1.1", "x-forwarded-for": "1.2.3.4, 84.1.1.1" })), "84.1.1.1");
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 84.1.1.1" })), "84.1.1.1", "the first entry can be set by anyone");
  assert.equal(clientIp(h({})), "local");
});

test("backup, rotation and restore with test data", async () => {
  const { openDatabase } = await import("./db");
  const s = await import("./sicherungen");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-sicherung-"));
  const dbFile = path.join(dir, "nachhilfe.db");
  const p = { dbFile, uploadsDir: path.join(dir, "uploads"), backupDir: path.join(dir, "backups") };
  try {
    let conn = openDatabase(dbFile);
    const tid = (conn.prepare("SELECT id FROM teachers LIMIT 1").get() as { id: number }).id;
    conn.prepare("INSERT INTO students (name, grade, teacher_id, access_token) VALUES ('Testschülerin Anna', 6, ?, 'tok-anna')").run(tid);
    fs.mkdirSync(p.uploadsDir);
    fs.writeFileSync(path.join(p.uploadsDir, "blatt.pdf"), "%PDF-1.4 testmaterial");

    const b = s.createBackup(conn, p, new Date("2026-10-06T10:00:00Z"));
    assert.equal(b.name, "sicherung-2026-10-06T10-00-00Z");
    assert.equal(b.counts.students, 1);
    assert.equal(b.files, 1);
    assert.ok(!s.backupDue(p.backupDir, 24, Date.parse("2026-10-06T20:00:00Z")));
    assert.ok(s.backupDue(p.backupDir, 24, Date.parse("2026-10-07T10:00:00Z")));

    // after the backup: the student is deleted, the file is gone, a new one came in
    conn.prepare("DELETE FROM students").run();
    fs.rmSync(path.join(p.uploadsDir, "blatt.pdf"));
    fs.writeFileSync(path.join(p.uploadsDir, "neu.pdf"), "%PDF-1.4 später");
    assert.ok(s.applyPendingRestore(dbFile) === null, "nothing staged, nothing happens");

    assert.deepEqual(s.stageRestore("../etc", p), { error: "Diese Sicherung gibt es nicht." });
    assert.deepEqual(s.stageRestore(b.name, p), { ok: true });
    assert.equal(s.pendingRestore(dbFile), b.name);
    conn.close();

    // the next start: the backup is swapped in before the database is opened
    const restored = s.applyPendingRestore(dbFile, p.uploadsDir, new Date("2026-10-06T12:00:00Z"));
    assert.equal(restored, b.name);
    conn = openDatabase(dbFile);
    assert.equal((conn.prepare("SELECT name FROM students").get() as { name: string }).name, "Testschülerin Anna");
    assert.equal(fs.readFileSync(path.join(p.uploadsDir, "blatt.pdf"), "utf8"), "%PDF-1.4 testmaterial");
    assert.ok(!fs.existsSync(path.join(p.uploadsDir, "neu.pdf")));
    const before = path.join(dir, "vor-wiederherstellung-2026-10-06T12-00-00Z");
    assert.ok(fs.existsSync(path.join(before, "uploads", "neu.pdf")), "the state before the restore is kept");
    assert.ok(fs.existsSync(path.join(before, "nachhilfe.db")));
    assert.equal(s.pendingRestore(dbFile), null);

    // a broken copy is set aside, the data stay as they are
    const pending = path.join(dir, "restore-pending");
    fs.mkdirSync(pending);
    fs.writeFileSync(path.join(pending, "nachhilfe.db"), "kaputt");
    conn.close();
    assert.equal(s.applyPendingRestore(dbFile, p.uploadsDir), null);
    conn = openDatabase(dbFile);
    assert.equal((conn.prepare("SELECT COUNT(*) AS n FROM students").get() as { n: number }).n, 1);
    assert.ok(fs.readdirSync(dir).some((n) => n.startsWith("restore-fehlgeschlagen-")));

    // a damaged backup is refused
    fs.appendFileSync(path.join(p.backupDir, b.name, "nachhilfe.db"), "x");
    assert.ok("error" in s.stageRestore(b.name, p));

    // rotation keeps the newest
    for (let h = 11; h < 16; h++) s.createBackup(conn, p, new Date(`2026-10-06T${h}:00:00Z`));
    s.rotateBackups(p.backupDir, 3);
    assert.deepEqual(
      s.listBackups(p.backupDir).map((x) => x.name),
      ["sicherung-2026-10-06T15-00-00Z", "sicherung-2026-10-06T14-00-00Z", "sicherung-2026-10-06T13-00-00Z"],
    );
    conn.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
