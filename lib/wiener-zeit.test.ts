/**
 * Vienna time on a server in UTC (Railway): „heute“ on the start page, the times of lessons and the
 * correction of lessons written before the server knew its time zone.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/** Runs `fn` with the process in another time zone and restores the old one. */
async function inZone<T>(tz: string, fn: () => T | Promise<T>): Promise<T> {
  const old = process.env.TZ;
  process.env.TZ = tz;
  try {
    return await fn();
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
}

test("Vienna time: date and lesson time stay Vienna time on a server in UTC", async () => {
  const { wienerDatum, wienerZeitstempel } = await import("./planung/zeit");
  const { localStamp } = await import("./autodoc");
  await inZone("UTC", () => {
    // 00:35 in Vienna on a Tuesday is still Monday in UTC (niko's start page after midnight)
    const nachMitternacht = new Date("2026-10-19T22:35:00Z");
    assert.equal(wienerDatum(nachMitternacht), "2026-10-20");
    assert.equal(wienerZeitstempel(nachMitternacht), "2026-10-20T00:35");
    // summer time +2, winter time +1
    assert.equal(localStamp(Date.parse("2026-10-19T14:59:30Z")), "2026-10-19T16:59");
    assert.equal(localStamp(Date.parse("2026-12-01T14:59:30Z")), "2026-12-01T15:59");
    assert.equal(wienerZeitstempel(Date.parse("2026-12-01T23:00:00Z")), "2026-12-02T00:00");
  });
});

test("Vienna time: the server sets its time zone when it starts", async () => {
  await inZone("UTC", async () => {
    const old = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    try {
      const { register } = await import("../instrumentation");
      await register();
      assert.equal(process.env.TZ, "Europe/Vienna");
      assert.equal(new Date("2026-10-19T22:35:00Z").getDate(), 20, "local dates are Vienna dates now");
    } finally {
      if (old === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = old;
    }
  });
  assert.equal(fs.readFileSync(path.join(__dirname, "..", "Dockerfile"), "utf8").includes("TZ=Europe/Vienna"), true, "the container runs in Vienna time as well");
});

test("upgrade: lessons of units written in UTC move to Vienna time once", async () => {
  const { openDatabase } = await import("./db");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-")), "alt.db");
  let conn = openDatabase(file);
  conn.pragma("foreign_keys = OFF");
  const unit = conn.prepare("INSERT INTO units (teacher_id, student_id, status, started_at, ended_at, last_activity_at) VALUES (1, 1, 'beendet', ?, ?, ?)");
  const lesson = conn.prepare("INSERT INTO lessons (student_id, unit_id, starts_at, duration_min, subject, status) VALUES (1, ?, ?, 60, 'Mathematik', 'abgeschlossen')");
  const add = (startedAt: string, startsAt: string) => Number(lesson.run(Number(unit.run(startedAt, startedAt, startedAt).lastInsertRowid), startsAt).lastInsertRowid);
  // written in UTC: the start is the UTC time of the unit
  const sommer = add("2026-10-19T14:59:12.345Z", "2026-10-19T14:59");
  const winter = add("2026-12-01T09:00:00.000Z", "2026-12-01T09:00");
  const nacht = add("2026-10-19T22:35:00.000Z", "2026-10-19T22:35");
  // already Vienna time (written after the fix), or changed by the teacher: stays
  const wien = add("2026-10-20T13:00:00.000Z", "2026-10-20T15:00");
  const lehrer = add("2026-10-21T13:00:00.000Z", "2026-10-21T14:30");
  conn.close();

  conn = openDatabase(file);
  const start = (id: number) => (conn.prepare("SELECT starts_at FROM lessons WHERE id = ?").get(id) as { starts_at: string }).starts_at;
  assert.equal(start(sommer), "2026-10-19T16:59");
  assert.equal(start(winter), "2026-12-01T10:00");
  assert.equal(start(nacht), "2026-10-20T00:35", "after midnight in Vienna it is the next day");
  assert.equal(start(wien), "2026-10-20T15:00");
  assert.equal(start(lehrer), "2026-10-21T14:30");
  conn.close();
  // a later start changes nothing
  conn = openDatabase(file);
  assert.equal(start(sommer), "2026-10-19T16:59");
  assert.equal(start(nacht), "2026-10-20T00:35");
  conn.close();
});
