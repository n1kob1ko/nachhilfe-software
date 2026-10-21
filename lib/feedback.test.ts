import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "feedback-"));

const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");

async function setup() {
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const fb = await import("./feedback");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  return { fb, niko };
}

test("feedback is stored with page, device and the browser's last errors, newest first", async () => {
  const { fb, niko } = await setup();
  const a = fb.saveFeedback({ teacherId: niko.id, art: "fehler", text: "  Beim Speichern springt die Seite.  ", seite: "/schueler/3", bildschirm: "1024×768", modus: "dunkel", browser: "Mozilla/5.0 (Macintosh) Safari/605 Touch", fehler: ["a", "b", "c", "d", "e", "f", "g"] });
  const b = fb.saveFeedback({ teacherId: niko.id, art: "unbekannt", text: "Mehr Platz im Whiteboard" });
  assert.ok("id" in a && "id" in b);
  const list = fb.listFeedback();
  assert.deepEqual(list.map((f) => f.id), [b.id, a.id], "newest first");
  const first = fb.getFeedback(a.id)!;
  assert.equal(first.text, "Beim Speichern springt die Seite.");
  assert.equal(first.teacher_name, niko.name);
  assert.deepEqual(first.fehler, ["c", "d", "e", "f", "g"], "only the last five errors");
  assert.equal(fb.getFeedback(b.id)!.art, "sonstiges", "an unknown kind becomes Sonstiges");
  assert.equal(fb.kurzerBrowser(first.browser), "Safari auf iPad");
});

test("text is required; a screenshot must really be a picture", async () => {
  const { fb, niko } = await setup();
  assert.deepEqual(fb.saveFeedback({ teacherId: niko.id, art: "fehler", text: " " }), { error: "Bitte kurz schreiben, was los ist." });
  const html = fb.saveFeedback({ teacherId: niko.id, art: "fehler", text: "Bild", bild: Buffer.from("<html>") });
  assert.ok("error" in html);
  const ok = fb.saveFeedback({ teacherId: niko.id, art: "wunsch", text: "Mit Bild", bild: PNG });
  assert.ok("id" in ok);
  const f = fb.getFeedback(ok.id)!;
  assert.match(f.bild ?? "", /^feedback-[0-9a-f]{64}\.png$/);
  assert.ok(fs.existsSync(fb.feedbackBildDatei(f.bild!)));
});

test("ticking off moves a point from offen to erledigt and back; the copy text lists it", async () => {
  const { fb, niko } = await setup();
  const r = fb.saveFeedback({ teacherId: niko.id, art: "wunsch", text: "Zeile eins\nZeile zwei", seite: "/uebungen" });
  assert.ok("id" in r);
  const before = fb.feedbackZahlen();
  assert.ok(fb.setFeedbackStatus(r.id, "erledigt"));
  assert.equal(fb.feedbackZahlen().erledigt, before.erledigt + 1);
  assert.ok(fb.getFeedback(r.id)!.erledigt_at);
  assert.ok(!fb.listFeedback({ status: "offen" }).some((f) => f.id === r.id));
  fb.setFeedbackStatus(r.id, "offen");
  assert.equal(fb.getFeedback(r.id)!.erledigt_at, null);
  const text = fb.feedbackAlsText([fb.getFeedback(r.id)!]);
  assert.match(text, /^1\. Wunsch · /);
  assert.match(text, /Seite: \/uebungen/);
  assert.match(text, / {3}Zeile zwei/);
  assert.equal(fb.listFeedback({ teacherId: niko.id + 999 }).length, 0, "a teacher sees only their own");
});
