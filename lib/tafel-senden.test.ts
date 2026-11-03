import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Lernkontrolle am Whiteboard (Fehlerbericht von niko, 2026-11-03): eine Übung mit mehreren Aufgaben kommt mit ALLEN
 * Aufgaben aufs Whiteboard, nicht nur mit der ersten; nochmal Senden bringt nichts doppelt („Aufgabe 1 / 1 / 1“), und
 * zeigt das Tablet das Whiteboard, landet eine neue Übung dort.
 */
async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const live = await import("./live");
  const devices = await import("./devices");
  const wb = await import("./whiteboard");
  const tafel = await import("./tafel-senden");
  const { buildWorksheet } = await import("./service");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const vincent = repo.createStudent({
    name: "Vincent Test", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const out = devices.pairDevice(devices.createPairCode(niko.id, niko.id).code, "tafel-senden");
  assert.ok("token" in out);
  const unit = units.startUnit(niko.id, vincent, { subject: "Mathematik" }).unit;
  const sheet = async (count: number) => {
    const { id } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.dividieren"], difficulty: "leicht", count, taskType: "calc", useAI: false });
    return { worksheetId: id, assignmentId: repo.assignWorksheet(id, vincent, "", unit.id) };
  };
  const board = wb.ensureBoardForUnit(unit.id)!;
  /** what is waiting to be drawn on the board: the task numbers per insert */
  const queued = () => wb.pendingInserts(board.id).map((i) => (i.payload.kind === "tasks" ? i.payload.tasks.map((t) => t.number) : []));
  /** a device draws the waiting inserts, as the Whiteboard component does (customData.aufgabe per task) */
  const draw = () => {
    const page = board.current_page_id ?? wb.listPages(board.id)[0].id;
    for (const ins of wb.pendingInserts(board.id)) {
      assert.ok(wb.claimInsert(board.id, ins.id));
      if (ins.payload.kind !== "tasks") continue;
      wb.applyElements(
        page,
        ins.payload.tasks.map((t, i) => ({ id: `e${ins.id}-${i}`, type: "text", version: 1, versionNonce: 1, text: t.prompt, customData: { aufgabe: { n: t.number, set: `s${ins.id}`, task: t.taskId } } })),
      );
    }
  };
  return { repo, units, live, wb, tafel, unit, sheet, queued, draw, board };
}

test("Lernkontrolle aufs Whiteboard: alle Aufgaben, nichts doppelt, neue Übungen landen am Whiteboard", async () => {
  const { repo, units, live, tafel, unit, sheet, queued, draw, board } = await setup();
  const kontrolle = await sheet(3);
  live.showOnTablet(unit, { kind: "aufgabe", assignmentId: kontrolle.assignmentId });

  // „Auf Whiteboard“: alle drei Aufgaben, nicht nur die erste offene
  assert.equal(tafel.uebungAufsWhiteboard(unit.id, kontrolle.assignmentId), 3);
  assert.deepEqual(queued(), [[1, 2, 3]]);

  // nochmal: es steht schon alles da (auch solange es noch nicht gezeichnet ist)
  assert.equal(tafel.uebungAufsWhiteboard(unit.id, kontrolle.assignmentId), 0);
  draw();
  assert.equal(tafel.uebungAufsWhiteboard(unit.id, kontrolle.assignmentId), 0, "gezeichnet: nicht noch einmal");
  assert.equal(tafel.aufgabenAmWhiteboard(board.id).size, 3);

  // das Tablet zeigt das Whiteboard: eine neu gesendete Übung kommt dorthin, das Tablet bleibt am Whiteboard
  live.showOnTablet(unit, { kind: "tafel" });
  const neu = await sheet(2);
  tafel.zeigeUebung(units.getUnit(unit.id)!, neu.assignmentId);
  assert.equal(live.parseView(units.getUnit(unit.id)!.device_view).kind, "tafel");
  assert.deepEqual(queued(), [[1, 2]]);
  assert.ok(repo.getAssignment(neu.assignmentId), "die Übung ist trotzdem zugewiesen");

  // zeigt das Tablet die Aufgaben, geht eine neue Übung wie bisher in die Aufgabenansicht
  live.showOnTablet(units.getUnit(unit.id)!, { kind: "start" });
  const dritte = await sheet(2);
  tafel.zeigeUebung(units.getUnit(unit.id)!, dritte.assignmentId);
  assert.deepEqual(live.parseView(units.getUnit(unit.id)!.device_view), { kind: "aufgabe", assignmentId: dritte.assignmentId });
});
