/**
 * Archiv (lib/archiv.ts): Übungen, Zuweisungen, Bibliotheksaufgaben und Textarbeiten verlassen die Listen,
 * Versuche, Dokumentation und Lernstand bleiben. Wiederherstellen bringt sie zurück; nur Besitzer und Verwaltung dürfen.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const SKILL = "mathe.brueche.dividieren";
const kid = (name: string, teacherId: number | null) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects: ["Mathematik", "Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

async function setup(name: string) {
  const repo = await import("./repo");
  const archiv = await import("./archiv");
  const service = await import("./service");
  const [niko, thomas] = ["Niko", "Thomas"].map((n) => repo.listTeachers().find((t) => t.name === n)!);
  const sid = repo.createStudent(kid(name, niko.id));
  const student = repo.getStudent(sid)!;
  // Niko made the exercise for his student (as the builder stores it)
  const { id: wid } = await service.buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: [SKILL], difficulty: "leicht", count: 3, taskType: "calc", useAI: false });
  (await import("./db")).db().prepare("UPDATE worksheets SET teacher_id = ?, student_id = ? WHERE id = ?").run(niko.id, sid, wid);
  const aid = repo.assignWorksheet(wid, sid);
  return { repo, archiv, service, niko: { id: niko.id, is_admin: 0 }, thomas: { id: thomas.id, is_admin: 0 }, sid, student, wid, aid };
}

/** Answers the first two tasks of the assignment right through the student's own link. */
async function answer(s: Awaited<ReturnType<typeof setup>>, n = 2) {
  for (const t of s.repo.listTasks(s.wid).slice(0, n)) {
    await s.service.submitAnswer({ token: s.student.access_token, assignmentId: s.aid, taskId: t.id, answer: t.answer.accepted?.[0] ?? "", timeMs: 20_000, hintsUsed: 0 });
  }
}

const lernstand = (s: Awaited<ReturnType<typeof setup>>) => {
  const a = s.service.analyzeStudent(s.sid, Date.parse("2030-01-01T12:00:00Z"))!;
  const skill = a.skills.find((x) => x.skill.id === SKILL)!;
  return { mastery: skill.mastery, done: skill.tasksDone, overall: a.overall.mastery };
};

test("archiving an exercise keeps answers, documentation and Lernstand, and takes it out of lists, search and the student's open work", async () => {
  const s = await setup("Lena Archiv");
  const { repo, archiv } = s;
  await answer(s);
  const attempts = repo.listAttemptsForAssignment(s.aid).length;
  const doc = repo.getLessonForAssignment(s.aid);
  assert.ok(attempts >= 2 && doc, "answers and the automatic documentation exist");
  const before = lernstand(s);
  assert.equal(before.done, 2);
  const searchBefore = repo.searchTasks({ skillIds: [SKILL], subject: "Mathematik" }).filter((t) => t.worksheet_id === s.wid).length;
  assert.ok(searchBefore > 0, "its tasks are found for reuse");

  assert.deepEqual(archiv.archiveWorksheet(s.wid, s.niko), { ok: true });

  // everything that counts stays
  assert.equal(repo.listAttemptsForAssignment(s.aid).length, attempts, "no answer is lost");
  assert.equal(repo.getLessonForAssignment(s.aid)?.id, doc!.id, "the documentation stays");
  assert.deepEqual(lernstand(s), before, "the Lernstand is the same");
  assert.equal(repo.listAttemptsForStudent(s.sid).length, attempts, "the answers keep counting");
  // … but it is gone from the lists, search and the student's open work
  assert.ok(!repo.listWorksheets().some((w) => w.id === s.wid), "not in the exercise list");
  assert.ok(repo.listWorksheets({ archiv: "nur" }).some((w) => w.id === s.wid), "in the Archiv");
  assert.equal(repo.searchTasks({ skillIds: [SKILL], subject: "Mathematik" }).filter((t) => t.worksheet_id === s.wid).length, 0, "not offered for reuse");
  assert.ok(!repo.listAssignments(s.sid).some((a) => a.id === s.aid), "the student does not see it as open");
  assert.ok(repo.assignmentArchived(s.aid));
  const all = repo.listAssignments(s.sid, { archiv: "alle" }).find((a) => a.id === s.aid);
  assert.equal(all?.archiviert, 1, "documentation still finds it, marked as archived");
  assert.ok(repo.getWorksheet(s.wid)?.archived_at && repo.getWorksheet(s.wid)?.archived_by === s.niko.id, "when and by whom");

  // Wiederherstellen brings it back unchanged
  assert.deepEqual(archiv.restoreWorksheet(s.wid, s.niko), { ok: true });
  assert.ok(repo.listWorksheets().some((w) => w.id === s.wid));
  assert.ok(repo.listAssignments(s.sid).some((a) => a.id === s.aid));
  assert.equal(repo.getWorksheet(s.wid)?.archived_at, null);
  assert.deepEqual(lernstand(s), before);
});

test("archiving one student's copy leaves the exercise and the other students' copies alone", async () => {
  const s = await setup("Tim Kopie");
  const { repo, archiv } = s;
  const other = repo.createStudent(kid("Ida Kopie", s.niko.id));
  const otherAid = repo.assignWorksheet(s.wid, other);
  await answer(s, 1);
  const before = lernstand(s);

  assert.deepEqual(archiv.archiveAssignment(s.aid, s.niko), { ok: true });
  assert.ok(!repo.listAssignments(s.sid).some((a) => a.id === s.aid), "gone for this student");
  assert.ok(repo.listAssignments(s.sid, { archiv: "nur" }).some((a) => a.id === s.aid), "in this student's Archiv");
  assert.ok(repo.listAssignments(other).some((a) => a.id === otherAid), "the other student keeps it");
  assert.ok(repo.listWorksheets().some((w) => w.id === s.wid), "the exercise stays in the list");
  assert.deepEqual(lernstand(s), before, "the Lernstand is the same");
  assert.equal(repo.listAttemptsForAssignment(s.aid).length, 1);

  // with the whole exercise archived, the copy comes back with the exercise only
  archiv.archiveWorksheet(s.wid, s.niko);
  assert.ok(!repo.listAssignments(other).some((a) => a.id === otherAid), "archiving the exercise hides every copy");
  const refused = archiv.restoreAssignment(s.aid, s.niko);
  assert.equal(refused.ok, false);
  assert.ok(repo.assignmentArchived(s.aid), "nothing changed");
  archiv.restoreWorksheet(s.wid, s.niko);
  assert.ok(repo.listAssignments(other).some((a) => a.id === otherAid));
  assert.ok(!repo.listAssignments(s.sid).some((a) => a.id === s.aid), "the copy archived on its own stays archived");
  assert.deepEqual(archiv.restoreAssignment(s.aid, s.niko), { ok: true });
  assert.ok(repo.listAssignments(s.sid).some((a) => a.id === s.aid));
});

test("sending an archived exercise again takes it out of the archive", async () => {
  const s = await setup("Jan Senden");
  const { repo, archiv } = s;
  archiv.archiveWorksheet(s.wid, s.niko);
  const other = repo.createStudent(kid("Mia Senden", s.niko.id));
  const aid = repo.assignWorksheet(s.wid, other);
  assert.equal(repo.getWorksheet(s.wid)?.archived_at, null);
  assert.ok(repo.listAssignments(other).some((a) => a.id === aid), "never sent as an invisible exercise");
});

test("only the owner and the admins archive and restore; without an owner every teacher", async () => {
  const s = await setup("Ella Rechte");
  const { repo, archiv } = s;
  const fremd = archiv.archiveWorksheet(s.wid, s.thomas);
  assert.equal(fremd.ok, false, "another teacher may not");
  assert.equal(repo.getWorksheet(s.wid)?.archived_at, null);
  assert.equal(archiv.archiveAssignment(s.aid, s.thomas).ok, false);
  assert.deepEqual(archiv.archiveWorksheet(s.wid, { ...s.thomas, is_admin: 1 }), { ok: true }, "the admin may");
  assert.equal(archiv.restoreWorksheet(s.wid, s.thomas).ok, false);
  assert.deepEqual(archiv.restoreWorksheet(s.wid, s.niko), { ok: true }, "the owner may");

  // the teacher of the unit the copy was sent in may archive that copy
  const units = await import("./units");
  const { unit } = units.startUnit(s.thomas.id, s.sid);
  const inUnit = repo.assignWorksheet(s.wid, s.sid, "", unit.id);
  assert.deepEqual(archiv.archiveAssignment(inUnit, s.thomas), { ok: true });

  // an exercise nobody owns (older rows, demo data): every teacher, as with delete
  const orphan = repo.createWorksheet(
    { title: "Alt", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [] },
    [],
  );
  assert.deepEqual(archiv.archiveWorksheet(orphan, s.thomas), { ok: true });
  assert.equal(archiv.archiveWorksheet(999_999, s.niko).ok, false, "unknown id");
});

test("archived library tasks leave the library, its counts and the task search", async () => {
  const s = await setup("Noah Bibliothek");
  const { repo, archiv } = s;
  const lib = await import("./library");
  const task = repo.listTasks(s.wid)[0];
  const saved = lib.saveToLibrary(task.id, { teacherId: s.niko.id });
  assert.ok("id" in saved && !saved.existing);
  const id = (saved as { id: number }).id;
  const count = lib.libraryCount();
  assert.ok(lib.searchLibrary({ subject: "Mathematik" }).some((e) => e.id === id));

  assert.deepEqual(archiv.archiveWorksheet(id, s.niko), { ok: true });
  assert.ok(!lib.searchLibrary({ subject: "Mathematik" }).some((e) => e.id === id), "not in the library");
  assert.ok(!lib.searchLibrary({ q: task.prompt.slice(0, 6) }).some((e) => e.id === id), "not found by the search");
  assert.ok(lib.searchLibrary({ archived: true }).some((e) => e.id === id), "in the library's Archiv");
  assert.equal(lib.libraryCount(), count - 1);
  assert.equal(lib.libraryCount(true), 1);
  assert.ok(!repo.searchTasks({ skillIds: [SKILL] }).some((t) => t.worksheet_id === id), "not offered in the builder");
  assert.equal(lib.getLibraryEntry(id)?.archived_at !== null, true, "its page still opens");
  // saving the same task again makes a fresh entry instead of pointing at the archived one
  const again = lib.saveToLibrary(task.id, { teacherId: s.niko.id });
  assert.ok("id" in again && !again.existing && again.id !== id);

  archiv.restoreWorksheet(id, s.niko);
  assert.ok(lib.searchLibrary({ subject: "Mathematik" }).some((e) => e.id === id));
});

test("archived texts leave the student's list and the tablet; the unit's documentation keeps them", async () => {
  const s = await setup("Paul Text");
  const { repo, archiv } = s;
  const units = await import("./units");
  const texts = await import("./texts");
  const live = await import("./live");
  const { unit } = units.startUnit(s.niko.id, s.sid);
  const text = texts.createText({ studentId: s.sid, teacherId: s.niko.id, unitId: unit.id, subject: "Deutsch", topic: "Bericht", title: "Der Ausflug", prompt: "" });
  texts.saveText(text.id, [{ t: "p", r: [{ x: "Wir fuhren mit dem Bus." }] }], 0);
  assert.ok(live.unitText(unit, text.id), "the tablet may show it");

  assert.equal(archiv.archiveText(text.id, s.thomas).ok, false, "another teacher may not");
  assert.deepEqual(archiv.archiveText(text.id, s.niko), { ok: true });
  assert.ok(!texts.textsForStudent(s.sid).some((t) => t.id === text.id), "not in the list of texts");
  assert.ok(texts.textsForStudent(s.sid, { archiv: "nur" }).some((t) => t.id === text.id), "in the Archiv");
  assert.equal(live.unitText(unit, text.id), null, "the tablet no longer offers it");
  const doc = texts.textsForUnit(unit.id).find((t) => t.id === text.id);
  assert.ok(doc && doc.archived_at, "the unit's documentation keeps it, marked");
  assert.equal(texts.getText(text.id)?.words, 5, "the text itself is unchanged");

  assert.deepEqual(archiv.restoreText(text.id, s.niko), { ok: true });
  assert.ok(texts.textsForStudent(s.sid).some((t) => t.id === text.id));
  assert.ok(live.unitText(unit, text.id));
  assert.equal(repo.getStudent(s.sid)?.id, s.sid);
});

test("deleting still removes answers and documentation (that is what the warning says)", async () => {
  const s = await setup("Lea Löschen");
  const { repo } = s;
  await answer(s, 1);
  assert.ok(repo.getLessonForAssignment(s.aid));
  repo.deleteWorksheet(s.wid);
  assert.equal(repo.listAttemptsForAssignment(s.aid).length, 0);
  assert.equal(repo.getLessonForAssignment(s.aid), null);
});
