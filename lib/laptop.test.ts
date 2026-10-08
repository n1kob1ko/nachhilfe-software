import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const kid = (name: string, teacherId: number) => ({
  name, grade: 3, klasse: 3, teacher_id: teacherId, school: "", school_type: "Volksschule" as const, subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

async function setup() {
  const repo = await import("./repo");
  const [niko, thomas] = ["Niko", "Thomas"].map((n) => repo.listTeachers().find((t) => t.name === n)!);
  return { repo, niko, thomas };
}

test("a laptop code belongs to one running unit, works once, runs out and cannot be guessed", async () => {
  const { repo, niko, thomas } = await setup();
  const units = await import("./units");
  const laptop = await import("./laptop");
  const { db } = await import("./db");
  laptop.resetJoinTries();
  const max = repo.createStudent(kid("Max Code", niko.id));
  const u = units.startUnit(niko.id, max).unit;

  const { code } = laptop.createLaptopCode(u.id, niko.id)!;
  assert.match(code, /^\d{6}$/);
  assert.equal(laptop.openLaptopCode(u.id)?.code, code);
  const second = laptop.createLaptopCode(u.id, niko.id)!;
  assert.equal(laptop.openLaptopCode(u.id)?.code, second.code, "one code per unit: the new one replaces the old");
  if (second.code !== code) assert.ok("error" in laptop.requestLaptopAccess(code, { key: "ip-x", label: "" }), "the old code is gone");

  const later = laptop.requestLaptopAccess(second.code, { key: "ip-a", label: "Windows · Chrome" }, Date.now() + 11 * 60_000);
  assert.ok("error" in later, "a code runs out after ten minutes");

  const ok = laptop.requestLaptopAccess(` ${second.code.slice(0, 3)} ${second.code.slice(3)} `, { key: "ip-a", label: "Windows · Chrome" });
  assert.ok("token" in ok, "spaces in the code are ignored");
  assert.equal(ok.session.status, "wartet");
  assert.match(ok.session.check_code, /^\d{2}$/);
  assert.equal(laptop.openLaptopCode(u.id), null, "the code is used up");
  assert.ok("error" in laptop.requestLaptopAccess(second.code, { key: "ip-b", label: "" }), "a code works once");
  const stored = db().prepare("SELECT token_hash FROM laptop_sessions WHERE id = ?").get(ok.session.id) as { token_hash: string };
  assert.notEqual(stored.token_hash, ok.token, "only the hash of the secret is stored");
  assert.equal(laptop.laptopForToken(stored.token_hash), null, "the stored hash is no key");
  assert.equal(laptop.laptopForToken(ok.token)?.id, ok.session.id);

  // guessing: eight wrong codes per address, then blocked, even with the right code
  const fresh = laptop.createLaptopCode(u.id, niko.id)!;
  const wrong = fresh.code === "999999" ? "999998" : "999999";
  for (let i = 0; i < 8; i++) assert.ok("error" in laptop.requestLaptopAccess(wrong, { key: "ip-guess", label: "" }));
  const blocked = laptop.requestLaptopAccess(fresh.code, { key: "ip-guess", label: "" });
  assert.ok("error" in blocked && /Zu viele/.test(blocked.error));
  // and many addresses together are stopped too
  for (let i = 0; i < 100; i++) laptop.requestLaptopAccess(wrong, { key: `ip-${i}`, label: "" });
  assert.equal(laptop.joinBlocked("ip-new"), true, "a hundred wrong codes from anywhere stop all tries for a while");
  assert.equal(laptop.joinBlocked("ip-new", Date.now() + 11 * 60_000), false, "and only for a while");
  laptop.resetJoinTries();

  // a tablet code is never a laptop code, and no code for a unit that is not running
  const lea = repo.createStudent(kid("Lea Code", thomas.id));
  const l = units.startUnit(thomas.id, lea).unit;
  units.finishUnit(l.id, "abgebrochen", { byTeacherId: thomas.id });
  assert.equal(laptop.createLaptopCode(l.id, thomas.id), null);
});

test("only the teacher's confirmation opens the unit; a new laptop replaces the old; requests run out", async () => {
  const { repo, niko } = await setup();
  const units = await import("./units");
  const laptop = await import("./laptop");
  const live = await import("./live");
  laptop.resetJoinTries();
  const max = repo.createStudent(kid("Max Bestätigung", niko.id));
  const anna = repo.createStudent(kid("Anna Bestätigung", niko.id));
  const u = units.startUnit(niko.id, max).unit;
  const a = units.startUnit(niko.id, anna).unit;

  const join = (unitId: number, key: string) => {
    const r = laptop.requestLaptopAccess(laptop.createLaptopCode(unitId, niko.id)!.code, { key, label: "Mac · Safari" });
    assert.ok("token" in r);
    return r;
  };
  const first = join(u.id, "ip-1");
  assert.equal(laptop.laptopState(laptop.getLaptop(first.session.id)!), "wartet");
  assert.equal(live.liveSnapshot(u.id)?.laptop.request?.check, first.session.check_code, "the teacher sees the same check number");
  assert.equal(laptop.approveLaptop(a.id, first.session.id).ok, false, "a request can only be confirmed in its own unit");
  assert.equal(laptop.approveLaptop(u.id, first.session.id).ok, true);
  assert.equal(laptop.activeLaptop(u.id)?.id, first.session.id);
  assert.equal(laptop.activeLaptop(a.id), null, "Anna's unit has no laptop");
  assert.equal(live.studentDevice(u), "laptop");
  assert.equal(live.liveSnapshot(u.id)?.laptop.active?.id, first.session.id);

  const second = join(u.id, "ip-2");
  const out = laptop.approveLaptop(u.id, second.session.id);
  assert.deepEqual(out.ended, [first.session.id], "one laptop per unit: the earlier one loses access");
  assert.equal(laptop.laptopState(laptop.getLaptop(first.session.id)!), "beendet");
  assert.equal(laptop.laptopEndReason(laptop.getLaptop(first.session.id)!), "ersetzt");

  const third = join(u.id, "ip-3");
  assert.equal(laptop.rejectLaptop(u.id, third.session.id), true);
  assert.equal(laptop.approveLaptop(u.id, third.session.id).ok, false, "a rejected request stays rejected");

  const fourth = join(u.id, "ip-4");
  const late = Date.now() + 11 * 60_000;
  assert.equal(laptop.laptopState(laptop.getLaptop(fourth.session.id)!, late), "beendet", "an unanswered request runs out");
  assert.equal(laptop.approveLaptop(u.id, fourth.session.id, late).ok, false);
  assert.equal(laptop.activeLaptop(u.id)?.id, second.session.id);
});

test("a laptop only reaches its own unit's student, and loses access when the unit ends", async () => {
  const { repo, niko, thomas } = await setup();
  const units = await import("./units");
  const laptop = await import("./laptop");
  const live = await import("./live");
  const learning = await import("./learning");
  const texts = await import("./texts");
  laptop.resetJoinTries();
  const max = repo.createStudent(kid("Max Grenzen", niko.id));
  const lea = repo.createStudent(kid("Lea Grenzen", thomas.id));
  const u = units.startUnit(niko.id, max).unit;
  const l = units.startUnit(thomas.id, lea).unit;
  const maxText = texts.createText({ studentId: max, teacherId: niko.id, unitId: u.id, subject: "Deutsch", topic: "Erzählung", title: "Ausflug", prompt: "" });
  const leaText = texts.createText({ studentId: lea, teacherId: thomas.id, unitId: l.id, subject: "Deutsch", topic: "Brief", title: "Brief", prompt: "" });

  const r = laptop.requestLaptopAccess(laptop.createLaptopCode(u.id, niko.id)!.code, { key: "ip-g", label: "" });
  assert.ok("token" in r);
  let s = laptop.laptopForToken(r.token)!;
  assert.equal(laptop.laptopMayWrite(s, maxText), false, "nothing before the teacher confirms");
  laptop.approveLaptop(u.id, s.id);
  s = laptop.laptopForToken(r.token)!;
  assert.equal(laptop.laptopMayWrite(s, maxText), true);
  assert.equal(laptop.laptopMayWrite(s, leaText), false, "never another student's text");
  assert.equal(live.unitText(u, leaText.id), null);
  assert.equal(live.unitText(l, maxText.id), null);

  // sending in the unit goes to the laptop; Thomas's unit is untouched
  assert.deepEqual(live.showOnTablet(u, { kind: "text", textId: maxText.id }), { status: "offline", device: "laptop" });
  assert.equal(live.studentDevice(l), null);
  assert.equal(live.liveSnapshot(l.id)?.laptop.active, null);

  // the unit ends: access is gone at once; texts typed offline may still arrive for a few minutes
  learning.endUnit(u.id, { byTeacherId: niko.id });
  s = laptop.laptopForToken(r.token)!;
  assert.equal(laptop.laptopState(s), "beendet");
  assert.equal(laptop.laptopEndReason(s), "einheit");
  assert.equal(laptop.activeLaptop(u.id), null);
  assert.equal(laptop.laptopMayWrite(s, maxText), true, "late save of an open text right after the end");
  assert.equal(laptop.laptopMayWrite(s, maxText, Date.now() + 11 * 60_000), false, "but not later");
  assert.equal(laptop.laptopMayWrite(s, leaText), false);
  assert.equal(laptop.createLaptopCode(u.id, niko.id), null, "no new code for an ended unit");

  // the teacher ends the access: no late saves
  const u2 = units.startUnit(niko.id, max).unit;
  const r2 = laptop.requestLaptopAccess(laptop.createLaptopCode(u2.id, niko.id)!.code, { key: "ip-g", label: "" });
  assert.ok("token" in r2);
  laptop.approveLaptop(u2.id, r2.session.id);
  assert.equal(laptop.endLaptop(r2.session.id, "lehrer"), true);
  const s2 = laptop.laptopForToken(r2.token)!;
  assert.equal(laptop.laptopEndReason(s2), "lehrer");
  assert.equal(laptop.laptopMayWrite(s2, maxText), false);
  assert.equal(live.studentDevice(u2), null, "without tablet and laptop: no device");

  // the old laptop of the first unit cannot reach the new unit of the same student
  assert.equal(laptop.laptopForToken(r.token)!.unit_id, u.id);
});

test("an ending nobody noticed (server restart, automatic end) still ends the access", async () => {
  const { repo, niko } = await setup();
  const units = await import("./units");
  const laptop = await import("./laptop");
  laptop.resetJoinTries();
  const max = repo.createStudent(kid("Max Neustart", niko.id));
  const u = units.startUnit(niko.id, max).unit;
  const r = laptop.requestLaptopAccess(laptop.createLaptopCode(u.id, niko.id)!.code, { key: "ip-n", label: "" });
  assert.ok("token" in r);
  laptop.approveLaptop(u.id, r.session.id);
  // only the unit row changes, the session row still says "aktiv"
  units.finishUnit(u.id, "abgebrochen");
  const s = laptop.laptopForToken(r.token)!;
  assert.equal(s.status, "aktiv");
  assert.equal(laptop.laptopState(s), "beendet");
  assert.equal(laptop.activeLaptop(u.id), null);
});

test("device label keeps only system and browser", async () => {
  const { deviceLabel } = await import("./laptop");
  assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"), "Windows · Chrome");
  assert.equal(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"), "Mac · Safari");
  assert.equal(deviceLabel("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"), "Chromebook · Chrome");
  assert.equal(deviceLabel(null), "Unbekanntes Gerät");
});

test("after signing out the secret is worth nothing, also for late saves", async () => {
  const { repo, niko } = await setup();
  const units = await import("./units");
  const laptop = await import("./laptop");
  const learning = await import("./learning");
  const texts = await import("./texts");
  laptop.resetJoinTries();
  const max = repo.createStudent(kid("Max Abmelden", niko.id));
  const u = units.startUnit(niko.id, max).unit;
  const t = texts.createText({ studentId: max, teacherId: niko.id, unitId: u.id, subject: "Deutsch", topic: "", title: "T", prompt: "" });
  const r = laptop.requestLaptopAccess(laptop.createLaptopCode(u.id, niko.id)!.code, { key: "ip-s", label: "" });
  assert.ok("token" in r);
  laptop.approveLaptop(u.id, r.session.id);
  learning.endUnit(u.id, { byTeacherId: niko.id });
  assert.equal(laptop.laptopMayWrite(laptop.laptopForToken(r.token), t), true, "right after the end: late save allowed");
  assert.equal(laptop.signOutLaptop(r.session.id), false, "it had already ended");
  assert.equal(laptop.laptopMayWrite(laptop.laptopForToken(r.token), t), false, "after the clean-up: nothing");
});
