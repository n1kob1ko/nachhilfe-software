import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.INITIAL_TEACHER_PASSWORD = "server-start-7Hq";

test("with INITIAL_TEACHER_PASSWORD set, accounts on the public start password get the server's one", async () => {
  const { openDatabase, accountsOnPublicDefault } = await import("./db");
  const { hashPassword, verifyPassword } = await import("./password");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-start-"));
  const file = path.join(dir, "nachhilfe.db");
  try {
    let conn = openDatabase(file);
    // an older installation: Thomas still waits on "lernheft", Niko has changed his password
    conn.prepare("UPDATE teachers SET password_hash = ?, must_change_password = 1 WHERE username = 'thomas'").run(hashPassword("lernheft"));
    conn.prepare("UPDATE teachers SET password_hash = ?, must_change_password = 0 WHERE username = 'niko'").run(hashPassword("nikos-eigenes"));
    assert.deepEqual(accountsOnPublicDefault(conn).map((t) => t.username), ["thomas"]);
    conn.close();

    conn = openDatabase(file);
    const hash = (u: string) => (conn.prepare("SELECT password_hash FROM teachers WHERE username = ?").get(u) as { password_hash: string }).password_hash;
    assert.ok(verifyPassword("server-start-7Hq", hash("thomas")));
    assert.ok(!verifyPassword("lernheft", hash("thomas")));
    assert.ok(verifyPassword("nikos-eigenes", hash("niko")), "changed passwords are never touched");
    assert.equal(accountsOnPublicDefault(conn).length, 0);
    conn.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
