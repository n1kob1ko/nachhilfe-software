/**
 * Datenqualität: own corrections of the skill structure (Einordnung, verschieben, Dubletten,
 * zusammenführen, Voraussetzungen, Lehrplan links) are stored separately, logged as 'korrektur' and can be reset.
 * The official tables skills, curricula and curriculum_nodes stay byte-identical.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const OFFICIAL_TABLES = ["skills", "curricula", "curriculum_nodes"] as const;
async function officialSnapshot() {
  const { db } = await import("./db");
  return Object.fromEntries(OFFICIAL_TABLES.map((t) => [t, db().prepare(`SELECT * FROM ${t} ORDER BY id`).all()]));
}
async function korrekturen() {
  const { db } = await import("./db");
  return (db().prepare("SELECT COUNT(*) AS n FROM skill_history WHERE kind = 'korrektur'").get() as { n: number }).n;
}
async function niko() {
  const repo = await import("./repo");
  return repo.listTeachers().find((t) => t.name === "Niko")!;
}
async function importBundled(file: string, change?: (pkg: NonNullable<ReturnType<typeof import("./curriculum-import").readBundled>>) => void) {
  const imp = await import("./curriculum-import");
  const pkg = imp.readBundled(file)!;
  change?.(pkg);
  const p = imp.preview(pkg, null);
  assert.deepEqual(p.diff.errors, []);
  assert.equal(imp.applyImport(p.id!).ok, true, file);
}
async function nodeId(code: string): Promise<number> {
  const { db } = await import("./db");
  return (db().prepare("SELECT id FROM curriculum_nodes WHERE code = ?").get(code) as { id: number }).id;
}

let official: Awaited<ReturnType<typeof officialSnapshot>>;
/** Created as test data before the snapshot: the same names as built-in skills. */
let dupKuerzen = "";
let dupErweitern = "";
let deutschKuerzen = "";

test("setup: Lehrplan Mathematik and Deutsch imported, three skills with known names created, then the official tables are recorded", async () => {
  const repo = await import("./repo");
  const { MAX_STUFE } = await import("./school");
  assert.equal(MAX_STUFE, 13);
  await importBundled("ris-ms-mathematik.json");
  await importBundled("ris-ms-deutsch.json");
  dupKuerzen = repo.createSkill("Mathematik", "Bruchrechnung", "kürzen.", 5, 9);
  dupErweitern = repo.createSkill("Mathematik", "Brüche", "Erweitern", 5, 9);
  deutschKuerzen = repo.createSkill("Deutsch", "Grammatik", "Kürzen", 5, 9);
  official = await officialSnapshot();
  assert.ok(official.skills.length > 50 && official.curricula.length === 2 && official.curriculum_nodes.length > 300);
});

test("Einordnung: an override changes what listSkills, getSkill and the student lists show, stores only differences, and can be reset", async () => {
  const repo = await import("./repo");
  const dq = await import("./datenqualitaet");
  const { skillsForStudent, browseSkills } = await import("./lehrplan");
  const { schoolBranch } = await import("./school");
  const me = await niko();
  const id = "mathe.potenzen.regeln";
  const third = { school_type: "Mittelschule", klasse: 3, grade: 7 };
  assert.ok(!skillsForStudent(third, "Mathematik").some((s) => s.id === id), "Potenzen start in Schulstufe 8");

  const n0 = await korrekturen();
  const res = dq.setSkillOverride(id, { area: "Potenzen und Wurzeln", subtopic: "Rechenregeln", grade_min: 7, grade_max: 11, practice_shift: "frueher", note: " kommt  oft schon in der 3. " }, me.id);
  assert.deepEqual(res, { ok: true, changed: true });
  assert.equal(await korrekturen(), n0 + 1, "one log entry per correction");
  const s = repo.getSkill(id)!;
  assert.deepEqual([s.area, s.subtopic, s.grade_min, s.grade_max, s.practice_shift], ["Potenzen und Wurzeln", "Rechenregeln", 7, 11, "frueher"]);
  assert.equal(repo.listSkills().find((x) => x.id === id)!.area, "Potenzen und Wurzeln");
  assert.ok(skillsForStudent(third, "Mathematik").some((x) => x.id === id), "the own Schulstufe counts for the student lists (activeSkills)");
  assert.ok(browseSkills({ subject: "Mathematik", branch: schoolBranch("mittelschule"), klasse: 3 }).some((x) => x.id === id));
  const row = dq.skillOverride(id)!;
  assert.equal(row.grade_max, null, "a value equal to the original is not stored");
  assert.equal(row.note, "kommt oft schon in der 3.");
  assert.equal(row.teacher_id, me.id);

  // the same values again: nothing written, nothing logged
  assert.deepEqual(dq.setSkillOverride(id, { area: "Potenzen und Wurzeln", grade_min: 7 }, me.id), { ok: true, changed: false });
  assert.equal(await korrekturen(), n0 + 1);
  // invalid input changes nothing
  for (const bad of [{ grade_min: 0 }, { grade_max: 14 }, { grade_min: 12 }, { grade_min: 6.5 }, { practice_shift: "bald" }, { area: "   " }]) {
    assert.ok("error" in dq.setSkillOverride(id, bad, me.id), JSON.stringify(bad));
  }
  assert.ok("error" in dq.setSkillOverride("gibt.es.nicht", { area: "X" }, me.id));
  assert.equal(await korrekturen(), n0 + 1);
  assert.equal(repo.getSkill(id)!.grade_min, 7);

  // the original value again → back to NULL; the subtopic can be emptied on purpose
  dq.setSkillOverride(id, { area: "Potenzen" }, me.id);
  assert.equal(dq.skillOverride(id)!.area, null);
  assert.equal(repo.getSkill(id)!.area, "Potenzen");

  // keepMerge only resets the Einordnung; a full reset brings back the original
  assert.deepEqual(dq.resetSkillOverride(id, me.id), { ok: true });
  assert.equal(dq.skillOverride(id), null, "nothing left: the override row is deleted");
  const back = repo.getSkill(id)!;
  assert.deepEqual([back.area, back.subtopic, back.grade_min, back.grade_max, back.practice_shift], ["Potenzen", "", 8, 11, ""]);
  assert.ok(!skillsForStudent(third, "Mathematik").some((x) => x.id === id));
  const n1 = await korrekturen();
  assert.deepEqual(dq.resetSkillOverride(id, me.id), { ok: true });
  assert.equal(await korrekturen(), n1, "resetting nothing logs nothing");
});

test("Fähigkeiten verschieben: several skills of one subject into another Thema; Teilfähigkeiten in the same Thema go along", async () => {
  const repo = await import("./repo");
  const dq = await import("./datenqualitaet");
  const me = await niko();
  const n0 = await korrekturen();
  const res = dq.moveSkills(["mathe.brueche.addieren", "mathe.brueche.subtrahieren"], " Brüche  addieren ", me.id);
  assert.deepEqual(res, { ok: true, moved: 4 }, "addieren, subtrahieren and the two Teilfähigkeiten of addieren");
  assert.equal(await korrekturen(), n0 + 4);
  for (const id of ["mathe.brueche.addieren", "mathe.brueche.subtrahieren", "mathe.brueche.addieren.hauptnenner", "mathe.brueche.addieren.gemischt"]) {
    assert.equal(repo.getSkill(id)!.area, "Brüche addieren", id);
  }
  assert.equal(repo.getSkill("mathe.brueche.kuerzen")!.area, "Bruchrechnung", "the rest stays");
  assert.ok(!repo.listSkills().some((s) => s.area === "Bruchrechnung" && s.id.startsWith("mathe.brueche.addieren")));

  assert.ok("error" in dq.moveSkills(["mathe.brueche.kuerzen", "deutsch.recht.gross"], "Gemischt", me.id), "one subject at a time");
  assert.ok("error" in dq.moveSkills(["mathe.brueche.kuerzen"], " ", me.id));
  assert.ok("error" in dq.moveSkills([], "Brüche", me.id));
  assert.ok("error" in dq.moveSkills(["gibt.es.nicht"], "Brüche", me.id));

  // moving back to the original Thema leaves no override behind
  assert.deepEqual(dq.moveSkills(["mathe.brueche.addieren", "mathe.brueche.subtrahieren"], "Bruchrechnung", me.id), { ok: true, moved: 4 });
  assert.equal(dq.skillOverride("mathe.brueche.addieren"), null);
  assert.equal(dq.skillOverride("mathe.brueche.addieren.gemischt"), null);
});

test("Dubletten: found by the normalized name within one subject, never merged by themselves", async () => {
  const repo = await import("./repo");
  const dq = await import("./datenqualitaet");
  assert.equal(dq.normalizeName("  Groß-  und KLEIN-schreibung!"), dq.normalizeName("gross und klein schreibung"));
  assert.equal(dq.normalizeName("Brüche kürzen"), dq.normalizeName("Brueche Kuerzen"));
  assert.equal(dq.normalizeName("Café"), "cafe");

  const pairs = dq.findDuplicates("Mathematik");
  const kuerzen = pairs.find((p) => [p.a.id, p.b.id].includes(dupKuerzen));
  assert.ok(kuerzen, "„kürzen.“ is a duplicate of „Kürzen“");
  assert.deepEqual([kuerzen.a.id, kuerzen.b.id], ["mathe.brueche.kuerzen", dupKuerzen]);
  assert.equal(kuerzen.sameArea, true);
  assert.equal(kuerzen.keep, "mathe.brueche.kuerzen", "without answers the older one is suggested");
  assert.equal(kuerzen.a.area, "Bruchrechnung");
  assert.equal(kuerzen.a.tasks, 0);
  assert.ok(!pairs.some((p) => [p.a.id, p.b.id].includes(dupErweitern)), "another Thema only on request");
  const cross = dq.findDuplicates("Mathematik", { crossArea: true }).find((p) => [p.a.id, p.b.id].includes(dupErweitern));
  assert.ok(cross && !cross.sameArea && [cross.a.id, cross.b.id].includes("mathe.brueche.erweitern"));
  assert.ok(!dq.findDuplicates(null, { crossArea: true }).some((p) => [p.a.id, p.b.id].includes(deutschKuerzen)), "never across subjects");
  assert.ok(!dq.findDuplicates("Deutsch").some((p) => p.subject === "Mathematik"));

  // finding changes nothing
  assert.equal(dq.skillOverride(dupKuerzen), null);
  assert.ok(repo.listSkills().some((s) => s.id === dupKuerzen));
});

test("Zusammenführen: the duplicate disappears, its answers count for the target, links are copied with origin 'lehrer'; itself, other subjects and chains are rejected", async () => {
  const repo = await import("./repo");
  const dq = await import("./datenqualitaet");
  const lp = await import("./lehrplan");
  const { analyzeStudent } = await import("./service");
  const me = await niko();
  const target = "mathe.brueche.kuerzen";

  // an answer on the duplicate
  const sid = repo.createStudent({ name: "Doris Dublette", grade: 6, klasse: 2, teacher_id: me.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const w = repo.createWorksheet(
    { title: "Kürzen", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [dupKuerzen] },
    [{ type: "calc", skillId: dupKuerzen, difficulty: "mittel", prompt: "6/8 kürzen", data: {}, answer: { accepted: ["3/4"], mode: "value" }, solution: "", hints: [], errorMap: [] }],
  );
  const aid = repo.assignWorksheet(w, sid);
  const task = repo.listTasks(w)[0];
  repo.recordAttempt({ assignment_id: aid, task_id: task.id, student_id: sid, skill_id: dupKuerzen, answer: "3/4", correct: 1, final: 1, attempt_no: 1, time_ms: 20_000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "" });
  const before = analyzeStudent(sid)!;
  assert.equal(before.skills.find((s) => s.skill.id === dupKuerzen)?.tasksDone, 1);
  assert.equal(before.skills.find((s) => s.skill.id === target)?.tasksDone, 0);
  assert.equal(dq.findDuplicates("Mathematik").find((p) => p.b.id === dupKuerzen)?.keep, dupKuerzen, "the one with answers is suggested to stay");

  // links of the duplicate: what it needs, what needs it, Lehrplan entries
  assert.ok("ok" in lp.addPrerequisite(dupKuerzen, "mathe.negativ.addieren", me.id), "copied");
  assert.ok("ok" in lp.addPrerequisite(dupKuerzen, "mathe.brueche.addieren", me.id), "would be a circle on the target (Addieren needs Kürzen)");
  assert.ok("ok" in lp.addPrerequisite(dupKuerzen, "mathe.brueche.erweitern", me.id), "removed on the target by the teacher");
  assert.ok("ok" in lp.addPrerequisite(target, "mathe.brueche.erweitern", me.id));
  lp.removePrerequisite(target, "mathe.brueche.erweitern", me.id);
  assert.ok("ok" in lp.addPrerequisite("mathe.prozent.prozentwert", dupKuerzen, me.id), "needs the duplicate → needs the target");
  const shared = await nodeId("MS-MAT-1-B1-K1-I4"); // linked to Kürzen by the import
  const own = await nodeId("MS-MAT-1-B1-K1-I1");
  assert.ok(!dq.curriculumLinks(target).some((l) => l.node_id === own));
  assert.deepEqual(dq.addCurriculumLink(dupKuerzen, own, me.id), { ok: true });
  assert.deepEqual(dq.addCurriculumLink(dupKuerzen, shared, me.id), { ok: true });

  // rejected: itself, another subject, a skill with Teilfähigkeiten, unknown skills
  assert.ok("error" in dq.mergeSkills(dupKuerzen, dupKuerzen, me.id));
  assert.match((dq.mergeSkills(deutschKuerzen, target, me.id) as { error: string }).error, /Fachs/);
  assert.match((dq.mergeSkills("mathe.brueche.addieren", "mathe.brueche.subtrahieren", me.id) as { error: string }).error, /Teilfähigkeiten/);
  assert.ok("error" in dq.mergeSkills("gibt.es.nicht", target, me.id));
  assert.equal(dq.skillOverride(dupKuerzen), null, "nothing written by a rejected merge");

  const n0 = await korrekturen();
  const res = dq.mergeSkills(dupKuerzen, target, me.id);
  assert.deepEqual(res, { ok: true, prerequisites: 2, curriculum: 1, skipped: 1 });
  assert.equal(await korrekturen(), n0 + 1);

  // hidden everywhere, still readable on its own
  assert.ok(!repo.listSkills().some((s) => s.id === dupKuerzen));
  assert.ok(!lp.browseSkills({ subject: "Mathematik" }).some((s) => s.id === dupKuerzen), "activeSkills");
  assert.equal(repo.getSkill(dupKuerzen)!.merged_into, target);
  assert.equal(repo.skillAliases().get(dupKuerzen), target);
  assert.ok(!dq.findDuplicates("Mathematik").some((p) => [p.a.id, p.b.id].includes(dupKuerzen)));
  // the answer counts for the target
  const after = analyzeStudent(sid)!;
  assert.equal(after.skills.find((s) => s.skill.id === target)?.tasksDone, 1);
  assert.ok(!after.skills.some((s) => s.skill.id === dupKuerzen));

  // copied links, visible as own ones; a circle is skipped, a removed link stays removed
  const needs = lp.prerequisiteLinks(target);
  assert.equal(needs.find((l) => l.other_id === "mathe.negativ.addieren")?.origin, "lehrer");
  assert.ok(!needs.some((l) => l.other_id === "mathe.brueche.addieren"), "no circle");
  assert.ok(needs.find((l) => l.other_id === "mathe.brueche.erweitern")?.removed_at, "a link the teacher removed is not brought back");
  assert.equal(lp.prerequisiteLinks("mathe.prozent.prozentwert").find((l) => l.other_id === target)?.origin, "lehrer");
  const links = dq.curriculumLinks(target);
  assert.equal(links.find((l) => l.node_id === own)?.origin, "lehrer");
  assert.equal(links.find((l) => l.node_id === shared)?.origin, "import", "an existing link is not touched");
  // the Lehrplan view shows the target, not the merged duplicate
  const c = lp.getCurriculum("ris-ms-mathematik")!;
  const inTree = (nodes: ReturnType<typeof lp.curriculumTree>): string[] => nodes.flatMap((n) => [...n.skills.map((s) => s.id), ...inTree(n.children)]);
  const ids = inTree(lp.curriculumTree(c.id));
  assert.ok(ids.includes(target) && !ids.includes(dupKuerzen));

  // no chains, no circles
  assert.match((dq.mergeSkills(dupKuerzen, "mathe.brueche.erweitern", me.id) as { error: string }).error, /schon/);
  assert.match((dq.mergeSkills("mathe.brueche.erweitern", dupKuerzen, me.id) as { error: string }).error, /selbst/);
  assert.match((dq.mergeSkills(target, "mathe.brueche.erweitern", me.id) as { error: string }).error, /Dublette/);
  assert.ok("error" in dq.mergeSkills(target, dupKuerzen, me.id), "no circle");
  assert.deepEqual(dq.mergedInto(target), [{ id: dupKuerzen, name: "kürzen." }]);
  assert.ok(dq.ownCorrections().some((o) => o.skill_id === dupKuerzen && o.merged_into === target));

  // a note on the merged skill, then only the Einordnung is reset: still merged
  dq.setSkillOverride(dupKuerzen, { note: "doppelt angelegt" }, me.id);
  dq.resetSkillOverride(dupKuerzen, me.id, { keepMerge: true });
  assert.deepEqual([dq.skillOverride(dupKuerzen)?.merged_into, dq.skillOverride(dupKuerzen)?.note], [target, ""]);

  // undo: visible again, answers count for itself, copied links stay (visible and removable)
  assert.deepEqual(dq.unmergeSkills(dupKuerzen, me.id), { ok: true });
  assert.equal(dq.skillOverride(dupKuerzen), null);
  assert.ok(repo.listSkills().some((s) => s.id === dupKuerzen));
  assert.equal(analyzeStudent(sid)!.skills.find((s) => s.skill.id === dupKuerzen)?.tasksDone, 1);
  assert.ok(lp.prerequisitesOf(target).includes("mathe.negativ.addieren"));
  assert.ok("error" in dq.unmergeSkills(dupKuerzen, me.id));

  // merged again, then "Zurücksetzen" in Eigene Korrekturen undoes the merge as well
  assert.ok("ok" in dq.mergeSkills(dupKuerzen, target, me.id));
  assert.ok("error" in dq.mergeSkills(dupKuerzen, target, me.id), "merged once is enough");
  dq.resetSkillOverride(dupKuerzen, me.id);
  assert.equal(repo.getSkill(dupKuerzen)!.merged_into, null);
});

test("Voraussetzungen: adding and removing is logged as 'korrektur' with the other skill; rejected ones log nothing", async () => {
  const dq = await import("./datenqualitaet");
  const lp = await import("./lehrplan");
  const me = await niko();
  const link = (skill: string, before: string) => lp.prerequisiteLinks(skill).find((l) => l.other_id === before);
  const latest = () => {
    const [c] = dq.corrections(1);
    return [c.skill_id, c.action, c.label, c.detail, c.teacher_name];
  };

  // an own prerequisite
  const n0 = await korrekturen();
  assert.equal(link("mathe.potenzen.regeln", "mathe.brueche.erweitern"), undefined);
  assert.deepEqual(dq.addSkillPrerequisite("mathe.potenzen.regeln", "mathe.brueche.erweitern", me.id), { ok: true });
  assert.deepEqual([link("mathe.potenzen.regeln", "mathe.brueche.erweitern")?.origin, link("mathe.potenzen.regeln", "mathe.brueche.erweitern")?.removed_at], ["lehrer", null]);
  assert.equal(await korrekturen(), n0 + 1);
  assert.deepEqual(latest(), ["mathe.potenzen.regeln", "voraussetzung_hinzugefuegt", "Voraussetzung hinzugefügt", "Erweitern", "Niko"]);
  assert.deepEqual(dq.addSkillPrerequisite("mathe.potenzen.regeln", "mathe.brueche.erweitern", me.id), { ok: true });
  assert.equal(await korrekturen(), n0 + 1, "already there: nothing logged");
  // a circle, itself, an unknown skill: rejected, nothing written or logged
  assert.match((dq.addSkillPrerequisite("mathe.brueche.erweitern", "mathe.potenzen.regeln", me.id) as { error: string }).error, /Kreis/);
  assert.ok("error" in dq.addSkillPrerequisite("mathe.potenzen.regeln", "mathe.potenzen.regeln", me.id));
  assert.ok("error" in dq.addSkillPrerequisite("mathe.potenzen.regeln", "gibt.es.nicht", me.id));
  assert.equal(link("mathe.brueche.erweitern", "mathe.potenzen.regeln"), undefined);
  assert.equal(await korrekturen(), n0 + 1);

  // a built-in one removed: the row stays, the previous state is logged
  assert.deepEqual(dq.removeSkillPrerequisite("mathe.gleichungen.text", "mathe.gleichungen.einfach", me.id), { ok: true });
  assert.ok(link("mathe.gleichungen.text", "mathe.gleichungen.einfach")?.removed_at);
  assert.ok(!lp.prerequisitesOf("mathe.gleichungen.text").includes("mathe.gleichungen.einfach"));
  assert.deepEqual(latest(), ["mathe.gleichungen.text", "voraussetzung_entfernt", "Voraussetzung entfernt", "Einfache lineare Gleichungen", "Niko"]);
  assert.deepEqual(dq.removeSkillPrerequisite("mathe.gleichungen.text", "mathe.gleichungen.einfach", me.id), { ok: true });
  assert.ok("error" in dq.removeSkillPrerequisite("mathe.gleichungen.text", "mathe.brueche.kuerzen", me.id), "no such link");
  assert.equal(await korrekturen(), n0 + 2, "removing twice logs once");

  // taken back: active again, its origin kept
  assert.deepEqual(dq.addSkillPrerequisite("mathe.gleichungen.text", "mathe.gleichungen.einfach", me.id), { ok: true });
  assert.deepEqual([link("mathe.gleichungen.text", "mathe.gleichungen.einfach")?.origin, link("mathe.gleichungen.text", "mathe.gleichungen.einfach")?.removed_at], ["app", null]);
  assert.equal(latest()[3], "wieder aufgenommen: Einfache lineare Gleichungen");
  assert.equal(await korrekturen(), n0 + 3);
  assert.deepEqual(await officialSnapshot(), official, "skills, curricula and curriculum_nodes are not written");
});

test("Lehrplan links: removed ones keep their row and can be taken back; only entries of the same subject can be added", async () => {
  const dq = await import("./datenqualitaet");
  const lp = await import("./lehrplan");
  const { db } = await import("./db");
  const me = await niko();
  const skill = "mathe.brueche.kuerzen";
  const shared = await nodeId("MS-MAT-1-B1-K1-I4");
  const c = lp.getCurriculum("ris-ms-mathematik")!;
  const linkedThere = () => {
    const walk = (nodes: ReturnType<typeof lp.curriculumTree>): boolean => nodes.some((n) => (n.id === shared && n.skills.some((s) => s.id === skill)) || walk(n.children));
    return walk(lp.curriculumTree(c.id));
  };
  assert.ok(linkedThere());

  const n0 = await korrekturen();
  assert.deepEqual(dq.removeCurriculumLink(skill, shared, me.id), { ok: true });
  assert.equal(await korrekturen(), n0 + 1);
  const removed = dq.curriculumLinks(skill).find((l) => l.node_id === shared)!;
  assert.ok(removed.removed_at, "the row stays, marked as removed");
  assert.equal(removed.changed_by, me.id);
  assert.equal(removed.short, "MS");
  assert.equal(removed.klasse_name, "1. Klasse");
  assert.ok(!linkedThere(), "the Lehrplan view leaves it out");
  assert.deepEqual(dq.removeCurriculumLink(skill, shared, me.id), { ok: true });
  assert.equal(await korrekturen(), n0 + 1, "removing twice logs once");
  assert.ok("error" in dq.removeCurriculumLink(skill, 999_999, me.id));

  // taking it back clears removed_at and keeps the origin
  assert.deepEqual(dq.addCurriculumLink(skill, shared, me.id), { ok: true });
  const back = dq.curriculumLinks(skill).find((l) => l.node_id === shared)!;
  assert.deepEqual([back.removed_at, back.origin], [null, "import"]);
  assert.ok(linkedThere());

  // candidates: curricula of the same subject, no containers, nothing linked already
  const curricula = dq.linkableCurricula(skill);
  assert.deepEqual(curricula.map((x) => x.key), ["ris-ms-mathematik"]);
  assert.deepEqual(curricula[0].classes.map((k) => k.name), ["1. Klasse", "2. Klasse", "3. Klasse", "4. Klasse"]);
  const candidates = dq.candidateNodes(skill, curricula[0].id, 1);
  assert.ok(candidates.length > 20 && candidates.every((n) => n.klasse === 1 && !["fach", "klasse", "semester"].includes(n.kind)));
  assert.ok(!candidates.some((n) => n.id === shared), "already linked");
  assert.deepEqual(dq.candidateNodes(skill, dq.linkableCurricula("deutsch.recht.gross")[0].id), [], "not from another subject");
  const deutsch = (db().prepare("SELECT n.id FROM curriculum_nodes n JOIN curricula c ON c.id = n.curriculum_id WHERE c.subject = 'Deutsch' AND n.kind = 'kompetenz' LIMIT 1").get() as { id: number }).id;
  assert.match((dq.addCurriculumLink(skill, deutsch, me.id) as { error: string }).error, /anderen Fach/);
  assert.ok("error" in dq.addCurriculumLink(skill, await nodeId("MS-MAT-2"), me.id), "a class is no entry to link");
  assert.ok("error" in dq.addCurriculumLink(skill, 999_999, me.id));

  // removed again for the re-import below
  dq.removeCurriculumLink(skill, shared, me.id);
});

test("every correction is logged in skill_history as 'korrektur' with the previous state and the teacher", async () => {
  const { db } = await import("./db");
  const dq = await import("./datenqualitaet");
  const me = await niko();
  const rows = db().prepare("SELECT skill_id, import_id, before, kind, teacher_id, changed_at FROM skill_history WHERE kind = 'korrektur' ORDER BY id").all() as {
    skill_id: string; import_id: number | null; before: string; kind: string; teacher_id: number | null; changed_at: string;
  }[];
  assert.ok(rows.length >= 20);
  assert.ok(rows.every((r) => r.teacher_id === me.id && r.import_id === null && r.changed_at));
  const entries = rows.map((r) => ({ skill: r.skill_id, ...(JSON.parse(r.before) as { action: string; previous: unknown; detail: string }) }));
  assert.deepEqual(
    [...new Set(entries.map((e) => e.action))].sort(),
    ["einordnung", "lehrplan_entfernt", "lehrplan_hinzugefuegt", "trennen", "verschieben", "voraussetzung_entfernt", "voraussetzung_hinzugefuegt", "zuruecksetzen", "zusammenfuehren"],
  );
  const first = entries.find((e) => e.skill === "mathe.potenzen.regeln")!;
  assert.equal(first.previous, null, "before the first correction there was no override");
  assert.match(first.detail, /Thema: Potenzen → Potenzen und Wurzeln/);
  assert.match(first.detail, /Schulstufe 8–11 → 7–11/);
  const reset = entries.find((e) => e.skill === "mathe.potenzen.regeln" && e.action === "zuruecksetzen")!;
  assert.equal((reset.previous as { grade_min: number }).grade_min, 7, "the previous override is kept");
  const merge = entries.find((e) => e.action === "zusammenfuehren")!;
  assert.match(merge.detail, /zusammengeführt mit „Kürzen“ · 2 Voraussetzungen übernommen · 1 Lehrplan-Verknüpfung übernommen/);
  const unlinked = entries.find((e) => e.action === "lehrplan_entfernt")!;
  assert.equal((unlinked.previous as { removed_at: string | null }).removed_at, null);

  const log = dq.corrections(3);
  assert.equal(log.length, 3);
  assert.equal(log[0].action, "lehrplan_entfernt", "newest first");
  assert.equal(log[0].skill_name, "Kürzen");
  assert.equal(log[0].teacher_name, "Niko");
  assert.equal(log[0].label, "Lehrplan entfernt");
  assert.match(log[0].detail, /^MS 1\. Klasse · MS-MAT-1-B1-K1-I4 /);
});

test("after all corrections the official tables skills, curricula and curriculum_nodes are byte-identical", async () => {
  const now = await officialSnapshot();
  assert.deepEqual(now, official);
  assert.equal(JSON.stringify(now), JSON.stringify(official));
});

test("a removed Lehrplan link stays removed when a newer version of the Lehrplan is imported", async () => {
  const dq = await import("./datenqualitaet");
  const shared = await nodeId("MS-MAT-1-B1-K1-I4");
  await importBundled("ris-ms-mathematik.json", (pkg) => {
    pkg.label += " (neue Fassung)";
    pkg.nodes![5].text += " (geändert)";
  });
  const link = dq.curriculumLinks("mathe.brueche.kuerzen").find((l) => l.node_id === shared)!;
  assert.ok(link.removed_at, "INSERT OR IGNORE keeps the removed row");
});

test("corrections and removed links survive a restart of a database file", async () => {
  const dbm = await import("./db");
  const dq = await import("./datenqualitaet");
  const repo = await import("./repo");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-dq-")), "t.db");
  dbm.resetForTests();
  process.env.DATABASE_PATH = file;
  await importBundled("ris-ms-mathematik.json");
  const me = await niko();
  const shared = await nodeId("MS-MAT-1-B1-K1-I4");
  assert.ok("ok" in dq.removeCurriculumLink("mathe.brueche.kuerzen", shared, me.id));
  assert.ok("ok" in dq.setSkillOverride("mathe.gleichungen.text", { area: "Sachaufgaben", practice_shift: "spaeter" }, me.id));
  assert.ok("ok" in dq.mergeSkills("mathe.prozent.grundwert", "mathe.prozent.prozentwert", me.id));

  // restart: schema, migrations and the seed run again on the same file
  dbm.resetForTests();
  process.env.DATABASE_PATH = file;
  assert.ok(dq.curriculumLinks("mathe.brueche.kuerzen").find((l) => l.node_id === shared)?.removed_at, "still removed");
  assert.deepEqual([repo.getSkill("mathe.gleichungen.text")!.area, repo.getSkill("mathe.gleichungen.text")!.practice_shift], ["Sachaufgaben", "spaeter"]);
  assert.equal(repo.skillAliases().get("mathe.prozent.grundwert"), "mathe.prozent.prozentwert");
  assert.equal(repo.getSkill("mathe.gleichungen.text")!.area, "Sachaufgaben");
  dbm.resetForTests();
});
