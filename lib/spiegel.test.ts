import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Schüler-Bildschirm (niko 2026-11-12, statt scrcpy): der Lehrer sieht in der Einheit, was DreamStudy am
 * Tablet zeigt, und kann eingreifen. Das Tablet nimmt nur auf, solange ein Lehrer zuschaut, jeder neue
 * Zuschauer bekommt ein ganzes Bild, und Befehle erreichen nur das Tablet dieser Einheit.
 */
const kid = (name: string, teacherId: number) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule" as const, subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const devices = await import("./devices");
  const hub = await import("./whiteboard-hub");
  const spiegel = await import("./spiegel");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const lena = repo.createStudent(kid("Lena Probst", niko.id));
  const jonas = repo.createStudent(kid("Jonas Weber", niko.id));
  const pair = (key: string) => {
    const out = devices.pairDevice(devices.createPairCode(niko.id, niko.id).code, key);
    assert.ok("token" in out);
    return out.device;
  };
  const listen = (channel: string, role: "lehrer" | "schueler", id: string, onPresence?: () => void) => {
    const got: { type: string; [k: string]: unknown }[] = [];
    const stop = hub.subscribe(channel, { clientId: id, role, name: id, pageId: null, send: (e) => got.push(e) });
    onPresence?.();
    return {
      got,
      stop: () => {
        stop();
        onPresence?.();
      },
    };
  };
  return { repo, units, live, devices, spiegel, niko, lena, jonas, pair, listen };
}

test("the tablet records only while a teacher watches, and each new watcher asks for a full picture", async () => {
  const { units, live, spiegel, niko, lena, pair, listen } = await setup();
  const unit = units.startUnit(niko.id, lena, { subject: "Mathematik" }).unit;
  const tab = pair("a");
  const tablet = listen(live.deviceChannel(tab.id), "schueler", "tab");
  assert.equal(spiegel.spiegelAktiv(unit.id), false);

  const lehrer = listen(spiegel.spiegelChannel(unit.id), "lehrer", "l1", () => spiegel.spiegelMelden(unit));
  assert.equal(spiegel.spiegelAktiv(unit.id), true);
  assert.deepEqual(tablet.got.filter((e) => e.type === "spiegel").at(-1), { type: "spiegel", an: true, neu: true });

  // what the tablet records goes straight to the watching teacher
  spiegel.spiegelSenden(unit.id, [{ type: 4, timestamp: 1, data: { width: 800, height: 1280 } }]);
  assert.equal(lehrer.got.filter((e) => e.type === "ev").length, 1);

  lehrer.stop();
  assert.equal(spiegel.spiegelAktiv(unit.id), false);
  assert.deepEqual(tablet.got.filter((e) => e.type === "spiegel").at(-1), { type: "spiegel", an: false, neu: false });
  tablet.stop();
});

test("with two students at once, commands and the recording request reach only the tablet of that unit", async () => {
  const { units, live, devices, spiegel, niko, lena, jonas, pair, listen } = await setup();
  const a = units.startUnit(niko.id, lena, { subject: "Mathematik" }).unit;
  const b = units.startUnit(niko.id, jonas, { subject: "Mathematik" }).unit;
  const t1 = pair("a");
  const t2 = pair("b");
  assert.ok(devices.chooseDeviceUnit(t1.id, a.id));
  assert.ok(devices.chooseDeviceUnit(t2.id, b.id));
  const s1 = listen(live.deviceChannel(t1.id), "schueler", "t1");
  const s2 = listen(live.deviceChannel(t2.id), "schueler", "t2");

  const lehrer = listen(spiegel.spiegelChannel(a.id), "lehrer", "l", () => spiegel.spiegelMelden(a));
  assert.equal(s1.got.filter((e) => e.type === "spiegel").length, 1);
  assert.equal(s2.got.filter((e) => e.type === "spiegel").length, 0, "Jonas' tablet does not record");

  assert.equal(spiegel.steuern(a, { art: "zeiger", phase: "down", x: 10, y: 20 }), 1);
  assert.deepEqual(s1.got.at(-1), { type: "steuern", c: { art: "zeiger", phase: "down", x: 10, y: 20 } });
  assert.equal(s2.got.filter((e) => e.type === "steuern").length, 0);
  lehrer.stop();
  s1.stop();
  s2.stop();
});

test("only small, well-formed commands reach the tablet", async () => {
  const { spiegel } = await setup();
  const p = spiegel.pruefeSteuern;
  assert.deepEqual(p({ art: "zeiger", phase: "up", x: 12.345, y: 3 }), { art: "zeiger", phase: "up", x: 12.3, y: 3 });
  assert.equal(p({ art: "zeiger", phase: "hover", x: 1, y: 1 }), null);
  assert.equal(p({ art: "zeiger", phase: "down", x: -5, y: 1 }), null);
  assert.equal(p({ art: "zeiger", phase: "down", x: "1", y: 1 }), null);
  assert.deepEqual(p({ art: "taste", key: "ä" }), { art: "taste", key: "ä" });
  assert.deepEqual(p({ art: "taste", key: "€" }), { art: "taste", key: "€" });
  assert.deepEqual(p({ art: "taste", key: "Backspace" }), { art: "taste", key: "Backspace" });
  assert.equal(p({ art: "taste", key: "F5" }), null);
  assert.equal(p({ art: "taste", key: "ab" }), null);
  assert.equal(p({ art: "text", text: "x".repeat(5000) })?.art, "text");
  assert.equal((p({ art: "text", text: "x".repeat(5000) }) as { text: string }).text.length, 2000);
  assert.equal(p({ art: "text", text: "" }), null);
  assert.deepEqual(p({ art: "rad", x: 1, y: 2, dx: 0, dy: 99999 }), { art: "rad", x: 1, y: 2, dx: 0, dy: 5000 });
  assert.equal(p({ art: "skript", code: "alert(1)" }), null);
  assert.equal(p(null), null);
});
