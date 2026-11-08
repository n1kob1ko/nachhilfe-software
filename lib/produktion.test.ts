import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  let conn = openDatabase(dbFile);
  try {
    const tid = (conn.prepare("SELECT id FROM teachers LIMIT 1").get() as { id: number }).id;
    conn.prepare("INSERT INTO students (name, grade, teacher_id, access_token) VALUES ('Testschülerin Anna', 6, ?, 'tok-anna')").run(tid);
    fs.mkdirSync(p.uploadsDir);
    fs.writeFileSync(path.join(p.uploadsDir, "blatt.pdf"), "%PDF-1.4 testmaterial");

    const b = await s.createBackup(conn, p, new Date("2026-10-06T10:00:00Z"));
    assert.equal(b.name, "sicherung-2026-10-06T10-00-00Z");
    assert.equal(b.counts.students, 1);
    assert.equal(b.files, 1);
    assert.ok(!s.backupDue(p.backupDir, 24, Date.parse("2026-10-06T20:00:00Z")));
    assert.ok(s.backupDue(p.backupDir, 24, Date.parse("2026-10-07T10:00:00Z")));
    // the copy is stored compressed, the restore still sees the full database
    assert.ok(fs.existsSync(path.join(p.backupDir, b.name, "nachhilfe.db.gz")));
    assert.ok(!fs.existsSync(path.join(p.backupDir, b.name, "nachhilfe.db")));


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
    fs.appendFileSync(path.join(p.backupDir, b.name, "nachhilfe.db.gz"), "x");
    assert.ok("error" in s.stageRestore(b.name, p));

    // a backup folder copied by hand into restore-pending (compressed) is unpacked at the start
    const good = (await s.createBackup(conn, p, new Date("2026-10-06T10:30:00Z"))).name;
    fs.cpSync(path.join(p.backupDir, good), pending, { recursive: true });
    fs.writeFileSync(path.join(pending, "quelle.txt"), good);
    conn.close();
    assert.equal(s.applyPendingRestore(dbFile, p.uploadsDir, new Date("2026-10-06T12:30:00Z")), good);
    conn = openDatabase(dbFile);
    assert.equal((conn.prepare("SELECT COUNT(*) AS n FROM students").get() as { n: number }).n, 1);
    fs.rmSync(path.join(p.backupDir, good), { recursive: true });

    // rotation keeps the newest
    for (let h = 11; h < 16; h++) await s.createBackup(conn, p, new Date(`2026-10-06T${h}:00:00Z`));
    s.rotateBackups(p.backupDir, 3);
    assert.deepEqual(
      s.listBackups(p.backupDir).map((x) => x.name),
      ["sicherung-2026-10-06T15-00-00Z", "sicherung-2026-10-06T14-00-00Z", "sicherung-2026-10-06T13-00-00Z"],
    );
    conn.close();
  } finally {
    // an open SQLite handle blocks removing its folder on Windows (EPERM): close what this test
    // opened, including the connection db() caches, before the temporary directory goes
    if (conn.open) conn.close();
    const { closeDatabase } = await import("./db");
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("full volume: old uncompressed backups are compressed, then the oldest make room", async () => {
  const s = await import("./sicherungen");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-platz-"));
  try {
    // three backups the way they were written before compression (raw nachhilfe.db)
    const data = Buffer.alloc(200_000, "lernheft ");
    for (const d of ["01", "02", "03"]) {
      const b = path.join(dir, `sicherung-2026-11-${d}T06-00-00Z`);
      fs.mkdirSync(b);
      fs.writeFileSync(path.join(b, "nachhilfe.db"), data);
      fs.writeFileSync(path.join(b, "manifest.json"), JSON.stringify({ name: path.basename(b), createdAt: `2026-11-${d}T06:00:00Z`, dbBytes: data.length, files: 0, uploadBytes: 0, counts: {}, dbSha256: crypto.createHash("sha256").update(data).digest("hex") }));
    }
    const out = await s.compressOldBackups(dir);
    assert.equal(out.count, 3);
    assert.ok(out.freed > 3 * 150_000);
    for (const n of fs.readdirSync(dir)) {
      assert.ok(fs.existsSync(path.join(dir, n, "nachhilfe.db.gz")));
      assert.ok(!fs.existsSync(path.join(dir, n, "nachhilfe.db")));
    }
    // a compressed old backup still restores (checksum of the uncompressed database)
    const dbFile = path.join(dir, "live", "nachhilfe.db");
    assert.deepEqual(s.stageRestore("sicherung-2026-11-01T06-00-00Z", { dbFile, uploadsDir: path.join(dir, "live", "uploads"), backupDir: dir }), { ok: true });
    assert.deepEqual(fs.readFileSync(path.join(dir, "live", "restore-pending", "nachhilfe.db")), data);

    // not enough free space: the oldest go first, but the newest `minKeep` always stay
    let free = 0;
    const removed = s.makeRoom(dir, 1_000, () => free, 2);
    assert.deepEqual(removed, ["sicherung-2026-11-01T06-00-00Z"]);
    assert.deepEqual(s.listBackups(dir).map((b) => b.name), ["sicherung-2026-11-03T06-00-00Z", "sicherung-2026-11-02T06-00-00Z"]);
    free = Infinity;
    assert.deepEqual(s.makeRoom(dir, 1_000, () => free, 1), [], "enough space: nothing is removed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the Docker image carries the files the server reads at runtime: Lehrplan packages and task banks", () => {
  const docker = fs.readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8");
  const runtime = docker.slice(docker.lastIndexOf("\nFROM "));
  for (const dir of ["curriculum", "data/banks"]) {
    assert.ok(runtime.includes(`COPY --from=build /app/${dir} ./${dir}`), `Dockerfile copies ${dir} into the image that runs`);
    assert.ok(fs.readdirSync(path.join(process.cwd(), dir)).some((f) => f.endsWith(".json")), `${dir} has its files in the repo`);
  }
  // data/ stays out of the build (local database), only the banks come along
  const ignore = fs.readFileSync(path.join(process.cwd(), ".dockerignore"), "utf8").split("\n").map((l) => l.trim());
  assert.ok(ignore.includes("data") && ignore.indexOf("!data/banks") > ignore.indexOf("data"));
  assert.ok(!ignore.some((l) => /^curriculum/.test(l)));
});
