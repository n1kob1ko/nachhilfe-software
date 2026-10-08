import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const kid = (name: string, teacherId: number) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule" as const, subjects: ["Mathematik", "Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});
const para = (...lines: string[]) => lines.map((x) => ({ t: "p" as const, r: [{ x }] }));
const words = (n: number, w = "Wort") => Array.from({ length: n }, () => w).join(" ");

test("a Textarbeit is saved with versions, conflicts never lose a text, and earlier versions are kept", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const texts = await import("./texts");
  const { db } = await import("./db");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid("Max Text", niko.id));
  const t0 = Date.now() - 40 * 60_000;
  const { unit } = units.startUnit(niko.id, sid, { at: t0 });

  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: unit.id, subject: "Deutsch", topic: "Erlebniserzählung", title: " Mein aufregender Ausflug ", prompt: "Erzähle von einem Ausflug." });
  assert.equal(text.title, "Mein aufregender Ausflug");
  assert.equal(text.version, 0);
  assert.equal(text.student_name, "Max Text");
  assert.deepEqual(texts.textDoc(text), []);
  assert.equal(texts.textsForUnit(unit.id).length, 1, "starting it in the unit links it to the unit");
  assert.equal(texts.textsForUnit(unit.id)[0].started_here, 1);

  const v1 = texts.saveText(text.id, para("Am Montag fuhren wir los."), 0);
  assert.ok(v1.ok && !v1.unchanged);
  assert.equal(v1.version, 1);
  assert.equal(v1.words, 5);
  // the same request again (the answer got lost on the way): no conflict, nothing changes
  const repeat = texts.saveText(text.id, para("Am Montag fuhren wir los."), 0);
  assert.ok(repeat.ok && repeat.unchanged);
  assert.equal(repeat.version, 1);

  // someone else changed it in the meantime: refused, with the stored text
  const stale = texts.saveText(text.id, para("Ganz etwas anderes."), 0);
  assert.equal(stale.ok, false);
  assert.ok(!stale.ok && stale.reason === "konflikt");
  if (!stale.ok && stale.reason === "konflikt") {
    assert.equal(stale.version, 1);
    assert.deepEqual(stale.body, para("Am Montag fuhren wir los."));
  }
  const forced = texts.saveText(text.id, para("Ganz etwas anderes."), 0, { force: true });
  assert.ok(forced.ok);
  assert.equal(forced.version, 2);
  assert.equal(texts.listRevisions(text.id).length, 1, "the overwritten version is kept");
  // and again right away, although a revision was just written: a version from elsewhere is never lost
  const elsewhere = texts.saveText(text.id, para("Am Tablet weitergeschrieben, vier Wörter."), 2);
  assert.ok(elsewhere.ok);
  assert.ok(texts.saveText(text.id, para("Ganz etwas anderes."), 2, { force: true }).ok);
  assert.ok(texts.listRevisions(text.id).some((r) => r.version === 3), "the tablet's version is kept as well");
  assert.ok(texts.saveText(text.id, para("Ganz etwas anderes!"), 4).ok);

  // a long text, written in many saves within minutes: one revision at most every five minutes
  const long = para(...Array.from({ length: 30 }, (_, i) => `${i + 1}. ${words(12, "Satz")}`));
  let at = Date.now();
  let version = 5;
  for (let i = 1; i <= long.length; i++) {
    const r = texts.saveText(text.id, long.slice(0, i), version, { at: (at += 10_000) });
    assert.ok(r.ok, `save ${i}`);
    version = r.version;
  }
  const full = texts.getText(text.id)!;
  assert.equal(full.words, 30 * 13);
  assert.equal(full.version, 35);
  assert.ok(texts.listRevisions(text.id).length <= 4, "not a revision per save");

  // most of it deleted at once: the text before is kept, however recent the last revision
  const before = texts.listRevisions(text.id).length;
  const cut = texts.saveText(text.id, long.slice(0, 2), version, { at: at + 1000 });
  assert.ok(cut.ok);
  const revs = texts.listRevisions(text.id);
  assert.equal(revs.length, before + 1);
  assert.equal(revs[0].words, 30 * 13);

  // and it can be brought back; the short version is kept as well
  const back = texts.restoreRevision(text.id, revs[0].id);
  assert.ok(back.ok);
  assert.equal(texts.getText(text.id)!.words, 30 * 13);
  assert.equal(texts.listRevisions(text.id)[0].words, 2 * 13);

  const tu = db().prepare("SELECT words_before, words_after FROM text_units WHERE text_id = ? AND unit_id = ?").get(text.id, unit.id) as { words_before: number; words_after: number };
  assert.deepEqual(tu, { words_before: 0, words_after: 30 * 13 }, "the unit knows how much was written in it");
});

test("the tablet may write while its teacher teaches the student and shortly after; texts continue in later units", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const texts = await import("./texts");
  const learning = await import("./learning");
  const { unitBrief } = await import("./summary");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const other = repo.listTeachers().find((t) => t.id !== niko.id)!;
  const sid = repo.createStudent(kid("Lena Schreib", niko.id));
  const t0 = Date.now() - 60 * 60_000;
  const { unit } = units.startUnit(niko.id, sid, { at: t0 });
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: unit.id, subject: "Deutsch", topic: "Erlebniserzählung", title: "Mein aufregender Ausflug", prompt: "" });

  assert.equal(texts.deviceMayWrite(niko.id, text), true);
  assert.equal(texts.deviceMayWrite(other.id, text), false, "another teacher's tablet never");
  const saved = texts.saveText(text.id, para(words(246, "Ausflug")), 0);
  assert.ok(saved.ok);

  const end = Date.now();
  const lessonId = learning.endUnit(unit.id, { at: end, byTeacherId: niko.id })!;
  assert.equal(texts.deviceMayWrite(niko.id, text, end + 5 * 60_000), true, "the last seconds of typing still arrive");
  assert.equal(texts.deviceMayWrite(niko.id, text, end + 11 * 60_000), false);

  // the documentation recognises the Textarbeit, without its content
  const lesson = repo.getLesson(lessonId)!;
  assert.equal(lesson.subject, "Deutsch", "no exercises: the subject comes from the text");
  assert.equal(lesson.topic, "Erlebniserzählung");
  assert.match(lesson.summary, /der Textarbeit „Mein aufregender Ausflug“ \(Erlebniserzählung, 246 Wörter\)/);
  assert.match(lesson.activities, /Textarbeit „Mein aufregender Ausflug“/);
  assert.ok(!lesson.summary.includes("Ausflug Ausflug"), "the text itself is not copied into the documentation");
  const report = learning.readReport(lesson)!;
  assert.deepEqual(report.texts, [{ id: text.id, title: "Mein aufregender Ausflug", topic: "Erlebniserzählung", subject: "Deutsch", words: 246, added: 246, startedHere: true }]);
  const brief = unitBrief(lessonId)!;
  assert.ok(brief.done.some((l) => l.text.includes("Mein aufregender Ausflug")));

  // a late save after the end: counted for the unit it was written in
  const late = texts.saveText(text.id, para(words(250, "Ausflug")), saved.ok ? saved.version : 0);
  assert.ok(late.ok);
  assert.equal(texts.textsForUnit(unit.id)[0].words_after, 250);

  // the next unit: the text is continued, the new unit records where it started
  const next = units.startUnit(niko.id, sid).unit;
  assert.notEqual(next.id, unit.id);
  const more = texts.saveText(text.id, para(words(300, "Ausflug")), late.ok ? late.version : 0);
  assert.ok(more.ok);
  const here = texts.textsForUnit(next.id);
  assert.equal(here.length, 1);
  assert.equal(here[0].started_here, 0);
  assert.equal(here[0].words_before, 250);
  assert.equal(here[0].words_after, 300);
  assert.deepEqual(texts.unitsOfText(text.id).map((u) => u.unit_id), [unit.id, next.id]);
  assert.equal(texts.textsForUnit(unit.id)[0].words_after, 250, "the earlier unit keeps its count");
  assert.equal(texts.textsForStudent(sid)[0].id, text.id);
  units.finishUnit(next.id, "abgebrochen");
});

test("saving over HTTP: only from the app's pages, validated, conflicts as 409; the tablet view can show a text", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const texts = await import("./texts");
  const live = await import("./live");
  const { handleTextSave } = await import("./text-routes");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid("Paul Netz", niko.id));
  const otherKid = repo.createStudent(kid("Anna Fremd", niko.id));
  const { unit } = units.startUnit(niko.id, sid);
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: unit.id, subject: "Deutsch", topic: "", title: "Bericht", prompt: "" });
  const foreign = texts.createText({ studentId: otherKid, teacherId: niko.id, unitId: null, subject: "", topic: "", title: "Fremd", prompt: "" });

  const req = (body: unknown, site = "same-origin") =>
    new Request("http://localhost/x", { method: "POST", headers: { "sec-fetch-site": site, "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const save = (r: Request, id = text.id, mayWrite = true) => handleTextSave(r, id, { mayWrite: () => mayWrite, by: "schueler" });

  assert.equal((await save(req({ version: 0, body: para("x") }, "cross-site"))).status, 403);
  assert.equal((await save(req({ version: 0, body: para("x") }), text.id, false)).status, 403);
  assert.equal((await save(req({ version: 0, body: para("x") }), 999_999)).status, 404);
  assert.equal((await save(req("{kaputt"))).status, 400);
  assert.equal((await save(req({ body: para("x") }))).status, 400, "the version is required");
  assert.equal((await save(req({ version: 0, body: [{ t: "p", r: [{ x: "a", style: "red" }] }] }))).status, 400);
  const ok = await save(req({ version: 0, body: para("Heute war Sportfest.") }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).version, 1);
  const conflict = await save(req({ version: 0, body: para("Etwas anderes") }));
  assert.equal(conflict.status, 409);
  assert.deepEqual((await conflict.json()).body, para("Heute war Sportfest."));

  // the tablet view
  assert.deepEqual(live.parseView(`text:${text.id}`), { kind: "text", textId: text.id });
  assert.equal(live.unitText(unit, text.id)?.id, text.id);
  assert.equal(live.unitText(unit, foreign.id), null, "another student's text never appears on this tablet");
  live.showOnTablet(units.getUnit(unit.id)!, { kind: "text", textId: text.id });
  assert.equal(units.getUnit(unit.id)!.device_view, `text:${text.id}`);
  const snap = live.liveSnapshot(unit.id)!;
  assert.equal(snap.view, "text");
  assert.equal(snap.text?.id, text.id);
  assert.equal(snap.text?.words, 3);
  units.finishUnit(unit.id, "abgebrochen");
});
