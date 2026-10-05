import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const el = (id: string, version: number, extra: Record<string, unknown> = {}) => ({
  id, type: "freedraw", version, versionNonce: 1000, x: 0, y: 0, points: [[0, 0], [5, 5]], index: `a${id}`, ...extra,
});

async function setup() {
  const repo = await import("./repo");
  const units = await import("./units");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const wb = await import("./whiteboard");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Tafel Test", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const { unit } = units.startUnit(niko.id, sid, { subject: "Mathematik" });
  const board = wb.ensureBoardForUnit(unit.id)!;
  return { repo, units, wb, niko, student: repo.getStudent(sid)!, unit, board };
}

test("a unit gets one board with a first page, linked to student and teacher", async () => {
  const { wb, unit, board, niko, student } = await setup();
  assert.equal(board.unit_id, unit.id);
  assert.equal(board.student_id, student.id);
  assert.equal(board.teacher_id, niko.id);
  assert.equal(wb.ensureBoardForUnit(unit.id)!.id, board.id, "opening again returns the same board");
  const pages = wb.listPages(board.id);
  assert.equal(pages.length, 1);
  assert.equal(board.current_page_id, pages[0].id);
});

test("merging: the newer version wins, an older one is ignored, ties are decided the same everywhere", async () => {
  const { wb, board } = await setup();
  const page = board.current_page_id!;
  assert.equal(wb.applyElements(page, [el("x", 3)]).length, 1);
  assert.equal(wb.applyElements(page, [el("x", 2)]).length, 0, "an older version does not overwrite");
  assert.equal(wb.applyElements(page, [el("x", 3, { versionNonce: 5000 })]).length, 0, "same version, higher nonce loses");
  assert.equal(wb.applyElements(page, [el("x", 3, { versionNonce: 1 })]).length, 1, "same version, lower nonce wins");
  assert.equal(wb.applyElements(page, [el("x", 4, { isDeleted: true })]).length, 1);
  wb.flushBoard(board.id);
  assert.equal(wb.listPages(board.id)[0].element_count, 0, "deleted elements are kept but not counted");
  assert.equal(wb.pageElements(page)[0].isDeleted, true);
});

test("only drawing elements are accepted; links and embeds are dropped", async () => {
  const { wb } = await setup();
  assert.equal(wb.sanitize({ ...el("e", 1), type: "embeddable" }), null);
  assert.equal(wb.sanitize({ ...el("i", 1), type: "image" }), null);
  assert.equal(wb.sanitize({ ...el("v", 0) }), null, "version must be positive");
  const clean = wb.sanitize({ ...el("t", 1), type: "text", text: "3/4", link: "javascript:alert(1)", customData: { a: 1 } })!;
  assert.equal(clean.link, undefined);
  assert.equal(clean.customData, undefined);
});

test("pages: add, duplicate with new ids, clear, delete keeps the last page", async () => {
  const { wb, board } = await setup();
  const first = board.current_page_id!;
  wb.applyElements(first, [el("a", 1), el("b", 1)]);
  const second = wb.addPage(board.id, { afterPageId: first, title: "Kariert" });
  const copy = wb.duplicatePage(board.id, first)!;
  const pages = wb.listPages(board.id);
  assert.deepEqual(pages.map((p) => p.id), [first, copy, second], "the copy sits right after its original");
  const copied = wb.pageElements(copy);
  assert.equal(copied.length, 2);
  assert.ok(copied.every((e) => e.id !== "a" && e.id !== "b"), "copies get their own ids");
  const cleared = wb.clearPage(first);
  assert.equal(cleared.length, 2);
  assert.ok(cleared.every((e) => e.isDeleted && e.version === 2));
  assert.ok(wb.deletePage(board.id, second));
  assert.ok(wb.deletePage(board.id, copy));
  assert.equal(wb.deletePage(board.id, first), null, "the last page stays");
});

test("a task sent to the board is drawn by exactly one device", async () => {
  const { wb, board } = await setup();
  const id = wb.queueInsert(board.id, { kind: "tasks", title: "Brüche", tasks: [{ number: 1, prompt: "3/4 + 2/5 = ?", options: null }] });
  assert.equal(wb.pendingInserts(board.id).length, 1);
  assert.equal(wb.claimInsert(board.id, id), true);
  assert.equal(wb.claimInsert(board.id, id), false, "a second device does not draw it again");
  assert.equal(wb.pendingInserts(board.id).length, 0);
});

test("the student writes only while the unit runs; teacher operations stay with the teacher", async () => {
  const { wb, units, unit, board, student, niko } = await setup();
  const { studentAccess } = await import("./whiteboard-access");
  const { sync } = await import("./whiteboard-routes");
  const req = (body: unknown) => new Request("http://x/sync", { method: "POST", body: JSON.stringify(body) });
  const page = board.current_page_id!;

  let access = studentAccess(student.access_token, String(unit.id));
  assert.ok("viewer" in access && access.viewer.canWrite);
  if (!("viewer" in access)) return;
  assert.equal((await sync(board, access.viewer, req({ op: "elements", pageId: page, elements: [el("s", 1)] }))).status, 200);
  assert.equal((await sync(board, access.viewer, req({ op: "page.add" }))).status, 403, "students cannot add pages");
  assert.equal(studentAccess("falsch", String(unit.id)).hasOwnProperty("error"), true);

  units.finishUnit(unit.id, "beendet", { byTeacherId: niko.id });
  access = studentAccess(student.access_token, String(unit.id));
  assert.ok("viewer" in access && !access.viewer.canWrite);
  if (!("viewer" in access)) return;
  assert.equal((await sync(board, access.viewer, req({ op: "elements", pageId: page, elements: [el("s", 2)] }))).status, 403);
  assert.equal((await sync(board, access.viewer, req({ op: "load", pageId: page }))).status, 200, "the board can still be looked at");
  assert.equal(wb.pageElements(page).find((e) => e.id === "s")!.version, 1);
});
