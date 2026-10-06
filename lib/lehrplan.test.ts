import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const DAY = 86_400_000;
const kid = (name: string, teacherId: number | null, o: Partial<{ school_type: string; klasse: number; grade: number; subjects: string[] }> = {}) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ...o,
});
const plusDays = (today: string, n: number) => new Date(Date.parse(`${today}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

test("licence check: only CC0, CC BY, CC BY-SA, own and official content may go into the task bank", async () => {
  const { licenseTerms, taskBankAllowed, saveSource, getSource, commercialSources } = await import("./lehrplan");
  assert.deepEqual(licenseTerms("CC BY-SA 4.0"), { kind: "CC BY-SA", commercial: 1, derivatives: 1, shareAlike: true });
  assert.equal(licenseTerms("CC0 1.0").commercial, 1);
  assert.equal(licenseTerms("CC BY-NC 4.0").commercial, 0);
  assert.equal(licenseTerms("CC BY-ND 4.0").derivatives, 0);
  assert.equal(licenseTerms("CC BY-NC-SA 4.0").commercial, 0);
  assert.equal(licenseTerms("Alle Rechte vorbehalten").commercial, null);

  const ok = (license: string, source_type: "oer" | "referenz" = "oer") => {
    saveSource({ key: `t-${license.replace(/\W+/g, "").toLowerCase()}-${source_type}`, name: license, source_type, license });
    return taskBankAllowed(getSource(`t-${license.replace(/\W+/g, "").toLowerCase()}-${source_type}`)!);
  };
  assert.equal(ok("CC0 1.0").ok, true);
  assert.equal(ok("CC BY 4.0").ok, true);
  assert.equal(ok("CC BY-SA 4.0").ok, true);
  assert.equal(ok("CC BY-NC 4.0").ok, false);
  assert.equal(ok("CC BY-ND 4.0").ok, false);
  assert.equal(ok("unbekannt").ok, false);
  assert.equal(ok("CC BY 4.0", "referenz").ok, false, "reference sources are never copied, whatever their licence");

  assert.equal(taskBankAllowed(getSource("iqs")!).ok, false, "IQS/Matura is reference only");
  assert.equal(taskBankAllowed(getSource("ris-ms")!).ok, true, "the Lehrplan is an official work");
  const keys = commercialSources().map((s) => s.key);
  assert.ok(keys.includes("lernheft") && keys.includes("claude"));
  assert.ok(!keys.includes("iqs"));
});

test("every skill has a stable code and its own source; official sources only carry verified metadata", async () => {
  const repo = await import("./repo");
  const { getSource } = await import("./lehrplan");
  const skills = repo.listSkills();
  assert.ok(skills.every((s) => s.code && /^AT-(MAT|DEU|ENG)-\d{2}-/.test(s.code)));
  assert.equal(new Set(skills.map((s) => s.code)).size, skills.length, "codes are unique");
  assert.equal(repo.getSkill("mathe.brueche.dividieren")?.code, "AT-MAT-05-BRUCHRECHNUNG-DIVIDIEREN");
  assert.ok(skills.every((s) => s.source_id === getSource("lernheft")!.id), "built-in skills are the app's own structure");
  assert.match(getSource("ris-ms")!.attribution_text, /BGBl\. II Nr\. 185\/2012/);
  assert.match(getSource("ris-ms")!.notes, /NOR40271471/);
  for (const key of ["ris-vs", "ris-ahs", "ris-htl", "ris-hak"]) assert.equal(getSource(key)?.license, "amtliches Werk (§ 7 UrhG)");
});

test("school type and class → Schulstufe; skills are filtered for the student, unclear levels are not narrowed", async () => {
  const { skillsForStudent } = await import("./lehrplan");
  const ms2 = skillsForStudent({ school_type: "Mittelschule", klasse: 2, grade: 6 }, "Mathematik");
  assert.ok(ms2.some((s) => s.id === "mathe.prozent.prozentwert"));
  assert.ok(!ms2.some((s) => s.id === "mathe.potenzen.regeln"), "Potenzen start in Schulstufe 8");
  const unclear = skillsForStudent({ school_type: "", klasse: 2, grade: 6 }, "Mathematik");
  assert.ok(unclear.some((s) => s.id === "mathe.potenzen.regeln"), "unclear level: every skill of the subject");
});

test("official Lehrplan packages: valid, complete per school type, links to missing skills are skipped with a warning", async () => {
  const imp = await import("./curriculum-import");
  const { db } = await import("./db");
  const { curriculumTree, getCurriculum, curriculumClasses } = await import("./lehrplan");
  const ris = imp.bundledPackages().filter((p) => p.file.startsWith("ris-"));
  assert.deepEqual(ris.map((p) => p.file.replace(/^ris-|\.json$/g, "")).sort(), ["ahs-deutsch", "ahs-englisch", "ahs-mathematik", "hak-deutsch", "hak-englisch", "hak-mathematik", "htl-deutsch", "htl-englisch", "htl-mathematik", "ms-deutsch", "ms-englisch", "ms-mathematik", "vs-deutsch", "vs-englisch", "vs-mathematik"]);
  for (const p of ris) {
    const pkg = imp.readBundled(p.file)!;
    assert.deepEqual(imp.validate(pkg), [], p.file);
    assert.equal(p.sourceType, "lehrplan");
    assert.ok(p.nodes > 40, `${p.file} has the wording`);
    assert.equal(new Set(pkg.nodes!.map((n) => n.code)).size, pkg.nodes!.length, `${p.file}: codes are unique`);
    assert.ok(pkg.nodes!.every((n) => !/\d[a-zäöü]{3,}\d|^\s|\s$/.test(n.name)), `${p.file}: no footnote digits or stray spaces in names`);
  }

  const ms = imp.readBundled("ris-ms-mathematik.json")!;
  const p1 = imp.preview(ms, null);
  assert.deepEqual(p1.diff.errors, []);
  assert.equal(p1.diff.newNodes, ms.nodes!.length);
  assert.equal(p1.diff.newLinks, ms.skill_nodes!.length, "all Mittelschule links point to existing skills");
  assert.equal(imp.applyImport(p1.id!).ok, true);
  const c = getCurriculum("ris-ms-mathematik")!;
  assert.equal(c.source?.key, "ris-ms");
  assert.deepEqual(curriculumClasses(c.id).map((k) => k.name), ["1. Klasse", "2. Klasse", "3. Klasse", "4. Klasse"]);
  const k2 = curriculumTree(c.id, 2);
  assert.equal(k2.length, 1);
  assert.deepEqual(k2[0].children.map((k) => k.name), ["2. Klasse"], "the class filter keeps only that class");
  const linked = db().prepare("SELECT COUNT(*) AS n FROM skill_curriculum sc JOIN curriculum_nodes n ON n.id = sc.node_id WHERE n.curriculum_id = ?").get(c.id) as { n: number };
  assert.equal(linked.n, ms.skill_nodes!.length);
  assert.equal(imp.preview(ms, null).diff.alreadyImported, true);

  // Volksschule: the skills come with the own structure package; until then the links are skipped
  const vs = imp.readBundled("ris-vs-mathematik.json")!;
  const p2 = imp.preview(vs, null);
  assert.ok(p2.diff.warnings.some((w) => /gibt es noch nicht/.test(w)));
  const withVs = imp.preview(vs, null, new Set(imp.readBundled("volksschule-eigene-struktur.json")!.skills!.map((s) => s.id)));
  assert.ok(!withVs.diff.warnings.some((w) => /gibt es noch nicht/.test(w)), "in a batch the own structure brings the skills along");
  assert.ok(withVs.diff.newLinks > p2.diff.newLinks);
  imp.discardImport(withVs.id!);
  assert.equal(imp.applyImport(p2.id!).ok, true);
  assert.equal(imp.bundledPackages().find((p) => p.file === "ris-vs-mathematik.json")!.pendingLinks, 0, "nothing to add while the skills are missing");
});

test("browsing skills: Fach › Schulart › Klasse filters the skills that are there, a skill fits several classes", async () => {
  const { browseSkills, branchesWithSkills } = await import("./lehrplan");
  const { schoolBranch, klasseLabel, klassenRange, SCHOOL_BRANCHES } = await import("./school");
  assert.deepEqual(SCHOOL_BRANCHES.map((b) => b.label), ["Volksschule", "Mittelschule", "AHS Unterstufe", "AHS Oberstufe", "HTL", "HAK"]);
  const ms = schoolBranch("mittelschule")!;
  const ahsO = schoolBranch("ahs-oberstufe")!;
  const htl = schoolBranch("htl")!;
  assert.equal(klasseLabel(ms, 3), "3. Klasse");
  assert.equal(klasseLabel(htl, 3), "III. Jahrgang");
  assert.equal(klassenRange(ahsO), "5.–8. Klasse");
  assert.equal(klassenRange(htl), "I.–V. Jahrgang");

  const ids = (o: Parameters<typeof browseSkills>[0]) => browseSkills(o).map((s) => s.id);
  // Bruchrechnung starts in Schulstufe 5 = 1. Klasse MS
  assert.ok(ids({ subject: "Mathematik", branch: ms, klasse: 1 }).includes("mathe.brueche.kuerzen"));
  assert.ok(!ids({ subject: "Mathematik", branch: ms, klasse: 1 }).includes("mathe.potenzen.regeln"), "Potenzen start in Schulstufe 8");
  assert.ok(ids({ subject: "Mathematik", branch: ms, klasse: 4 }).includes("mathe.potenzen.regeln"));
  // the same skill belongs to several classes without being stored twice
  const classes = ms.classes.filter((k) => ids({ subject: "Mathematik", branch: ms, klasse: k }).includes("mathe.brueche.kuerzen"));
  assert.deepEqual(classes, [1, 2, 3, 4]);
  assert.equal(ids({ subject: "Mathematik", branch: ms, klasse: 1 }).filter((id) => id === "mathe.brueche.kuerzen").length, 1, "once per view");
  // AHS Oberstufe and HTL use the same Schulstufen as their class numbers say
  assert.ok(ids({ subject: "Mathematik", branch: ahsO, klasse: 5 }).includes("mathe.potenzen.regeln"));
  assert.equal(ids({ subject: "Deutsch", branch: ms }).filter((id) => id.startsWith("mathe.")).length, 0, "the subject filter holds");
  // Volksschule only has its own skills, and only after that package is imported
  assert.ok(ids({ subject: "Mathematik", branch: schoolBranch("volksschule")!, klasse: 3 }).every((id) => id.startsWith("mathe.vs.")));
  assert.ok(branchesWithSkills("Mathematik").length >= 5);
  assert.deepEqual(branchesWithSkills("Erdkunde"), []);
});

test("import: preview with counts, nothing changes before confirming, no duplicates, re-import is recognised", async () => {
  const imp = await import("./curriculum-import");
  const repo = await import("./repo");
  const { db } = await import("./db");
  const before = repo.listSkills().length;

  const pkgs = imp.bundledPackages();
  const vs = pkgs.find((p) => p.file === "volksschule-eigene-struktur.json")!;
  assert.equal(vs.sourceType, "eigen");
  assert.equal(vs.imported, false);
  const pkg = imp.readBundled(vs.file)!;

  const p1 = imp.preview(pkg, null);
  assert.deepEqual(p1.diff.errors, []);
  assert.equal(p1.diff.newSkills.length, 45);
  assert.ok(p1.diff.newTopics.includes("Mathematik › Zahlen und Zahlenraum"));
  assert.ok(!p1.diff.newTopics.some((t) => t.endsWith("Rechtschreibung")), "Rechtschreibung exists already");
  assert.ok(p1.diff.newLinks > 30);
  assert.equal(repo.listSkills().length, before, "a preview changes nothing");

  assert.deepEqual(imp.applyImport(p1.id!).ok, true);
  assert.equal(repo.listSkills().length, before + 45);
  const s = repo.getSkill("mathe.vs.schriftlich.dividieren")!;
  assert.equal(s.school_types, "Volksschule");
  assert.equal(s.code, "AT-MAT-04-SCHRIFTLICHE-RECHENVERFAHREN-SCHRIFTLICH-DIVIDIEREN");
  const { prerequisitesOf } = await import("./lehrplan");
  assert.deepEqual(prerequisitesOf("mathe.vs.schriftlich.dividieren").sort(), ["mathe.vs.muldiv.rest", "mathe.vs.schriftlich.multiplizieren"]);

  // the same package again: recognised, nothing new, cannot be applied twice
  const p2 = imp.preview(pkg, null);
  assert.equal(p2.diff.alreadyImported, true);
  assert.equal(p2.diff.newSkills.length, 0);
  assert.equal(p2.diff.unchanged, 45);
  assert.equal(imp.applyImport(p2.id!).ok, false);
  assert.equal(imp.applyImport(p1.id!).ok, false, "an applied preview cannot be applied again");

  // a newer version: one skill changed, one new, one duplicate under another id, one foreign skill
  const v2 = structuredClone(pkg);
  v2.label = "VS v2";
  v2.skills![0].learning_objective = "Neu formuliert";
  v2.skills!.push({ id: "mathe.vs.zahlen.roemisch", subject: "Mathematik", area: "Zahlen und Zahlenraum", name: "Römische Zahlen", grade_min: 4, grade_max: 4 });
  v2.skills!.push({ id: "mathe.vs.zahlen.doppelt", subject: "Mathematik", area: "zahlen und zahlenraum", name: "Runden ", grade_min: 3, grade_max: 4 });
  v2.skills!.push({ id: "mathe.brueche.kuerzen", subject: "Mathematik", area: "Bruchrechnung", name: "Kürzen (anders)", grade_min: 5, grade_max: 9 });
  const p3 = imp.preview(v2, null);
  assert.deepEqual(p3.diff.newSkills, ["mathe.vs.zahlen.roemisch"]);
  assert.deepEqual(p3.diff.changedSkills, [{ id: "mathe.vs.zahlen.zr10", fields: ["learning_objective"] }]);
  assert.deepEqual(p3.diff.duplicates, [{ id: "mathe.vs.zahlen.doppelt", existing: "mathe.vs.zahlen.runden" }]);
  assert.deepEqual(p3.diff.conflicts.map((c) => c.id), ["mathe.brueche.kuerzen"]);
  assert.equal(imp.applyImport(p3.id!).ok, true);
  assert.equal(repo.getSkill("mathe.vs.zahlen.zr10")?.learning_objective, "Neu formuliert");
  assert.equal(repo.getSkill("mathe.vs.zahlen.doppelt"), null, "duplicates are skipped");
  assert.equal(repo.getSkill("mathe.brueche.kuerzen")?.name, "Kürzen", "skills of another source are never overwritten");
  const hist = db().prepare("SELECT before FROM skill_history WHERE skill_id = 'mathe.vs.zahlen.zr10'").get() as { before: string };
  assert.match(hist.before, /Zahlen bis 10 sicher erfassen/, "the earlier version is kept");
});

test("after the Volksschule structure is imported, the missing Lehrplan links can be added", async () => {
  const imp = await import("./curriculum-import");
  const pending = imp.bundledPackages().find((p) => p.file === "ris-vs-mathematik.json")!;
  assert.equal(pending.imported, true);
  assert.ok(pending.pendingLinks > 20);
  const p = imp.preview(imp.readBundled(pending.file)!, null);
  assert.equal(p.diff.alreadyImported, false);
  assert.equal(p.diff.newNodes, 0);
  assert.equal(imp.applyImport(p.id!).ok, true);
  assert.equal(imp.bundledPackages().find((x) => x.file === pending.file)!.pendingLinks, 0);
});

test("import validation and the DEMO package", async () => {
  const imp = await import("./curriculum-import");
  const repo = await import("./repo");
  const { db } = await import("./db");
  assert.ok(imp.preview("{kein json", null).diff.errors.length > 0);
  const bad = imp.preview({ format: "x", label: "", source: { key: "iqs-copy", name: "IQS", source_type: "referenz" }, skills: [{ id: "Bad Id", subject: "", area: "", name: "", grade_min: 9, grade_max: 2 }] }, null);
  assert.equal(bad.id, null);
  assert.ok(bad.diff.errors.some((e) => /Referenzquellen/.test(e)));
  assert.ok(bad.diff.errors.some((e) => /Schulstufen/.test(e)));

  const demo = imp.readBundled("demo-beispiel.json")!;
  assert.equal(demo.source.source_type, "demo");
  const p = imp.preview(demo, null);
  assert.equal(p.diff.newNodes, 5);
  assert.equal(imp.applyImport(p.id!).ok, true);
  const nodes = db().prepare("SELECT n.name FROM curriculum_nodes n JOIN curricula c ON c.id = n.curriculum_id WHERE c.key = 'demo-ms-mathematik'").all() as { name: string }[];
  assert.ok(nodes.every((n) => n.name.startsWith("DEMO")), "demo data is labelled as such");
  assert.ok(repo.getSkill("mathe.demo.bruchvergleich"));
  assert.equal(imp.removeDemo("demo-lehrplan"), true);
  assert.equal(repo.getSkill("mathe.demo.bruchvergleich"), null);
  assert.equal(imp.removeDemo("ris-ms"), false, "real sources are never removed");
});

test("exam topics → skill suggestions only, never a wrong automatic mapping", async () => {
  const { matchSkills, splitTopics } = await import("./lehrplan");
  assert.deepEqual(splitTopics("Brüche, Prozentrechnung und Sachaufgaben"), ["Brüche", "Prozentrechnung", "Sachaufgaben"]);
  const ms2 = { school_type: "Mittelschule", klasse: 2, grade: 6 };
  const br = matchSkills("Brüche dividieren", "Mathematik", { student: ms2 });
  assert.equal(br[0].skill.id, "mathe.brueche.dividieren");
  assert.ok(matchSkills("Bruchrechnung", "Mathematik", { student: ms2 }).every((m) => m.skill.area === "Bruchrechnung"));
  assert.ok(matchSkills("Prozent", "Mathematik", { student: ms2 }).some((m) => m.skill.id === "mathe.prozent.grundwert"));
  assert.deepEqual(matchSkills("Kapitel 4", "Mathematik", { student: ms2 }), [], "nothing vague");
  assert.deepEqual(matchSkills("Photosynthese", "Mathematik"), []);
  assert.ok(!matchSkills("Potenzen", "Mathematik", { student: ms2 }).length, "not above the student's level");
});

test("exams: quick entry, reminders after 14/7/3 days, configurable, preparation plan", async () => {
  const repo = await import("./repo");
  const exams = await import("./exams");
  const { setExamThresholds, examThresholds } = await import("./lehrplan");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const thomas = repo.listTeachers().find((t) => t.name === "Thomas")!;
  const today = exams.dayOf(new Date());

  assert.equal(exams.reminderStage(20), null);
  assert.equal(exams.reminderStage(14), "vorbereiten");
  assert.equal(exams.reminderStage(8), "vorbereiten");
  assert.equal(exams.reminderStage(7), "prioritaet");
  assert.equal(exams.reminderStage(3), "bald");
  assert.equal(exams.reminderStage(0), "bald");
  assert.equal(exams.reminderStage(-1), null);

  const sid = repo.createStudent(kid("Eva Prüfung", niko.id));
  const other = repo.createStudent(kid("Olli Anders", thomas.id));
  const id = repo.addTest({ student_id: sid, date: plusDays(today, 9), subject: "Mathematik", kind: "Schularbeit", topic: "", title: "2. Schularbeit", topics: ["Brüche", "Prozent"], grade: null, points: null, max_points: null, notes: "", skill_ids: ["mathe.brueche.dividieren", "mathe.brueche.multiplizieren", "mathe.prozent.prozentwert"], teacher_id: niko.id });
  repo.addTest({ student_id: other, date: plusDays(today, 2), subject: "Mathematik", kind: "Test", topic: "Prozent", grade: null, points: null, max_points: null, notes: "", skill_ids: [] });
  assert.equal(repo.getTest(id)?.status, "geplant");

  const mine = exams.examReminders(today, { teacherId: niko.id });
  assert.deepEqual(mine.map((r) => [r.student_name, r.days, r.stage]), [["Eva Prüfung", 9, "vorbereiten"]], "each teacher sees the exams of their students");
  assert.equal(exams.examReminders(today, { teacherId: thomas.id })[0].stage, "bald");

  setExamThresholds([10, 5, 2]);
  assert.deepEqual(examThresholds(), [10, 5, 2]);
  assert.equal(exams.examReminders(today, { teacherId: niko.id })[0].stage, "vorbereiten");
  setExamThresholds([7, 3, 1]);
  assert.equal(exams.examReminders(today, { teacherId: niko.id }).length, 0, "9 days is outside the first threshold now");
  setExamThresholds([14, 7, 3]);

  // Eva: multiplying sits partly, dividing is weak, Prozent untested
  const w = repo.createWorksheet({ title: "x", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [] }, [
    { type: "calc", skillId: "mathe.brueche.dividieren", difficulty: "mittel", prompt: "a", data: {}, answer: { accepted: ["1"], mode: "value" }, solution: "", hints: [], errorMap: [] },
    { type: "calc", skillId: "mathe.brueche.multiplizieren", difficulty: "mittel", prompt: "b", data: {}, answer: { accepted: ["1"], mode: "value" }, solution: "", hints: [], errorMap: [] },
  ]);
  const aid = repo.assignWorksheet(w, sid);
  const [div, mul] = repo.listTasks(w);
  for (let i = 0; i < 4; i++) {
    repo.recordAttempt({ assignment_id: aid, task_id: div.id, student_id: sid, skill_id: div.skillId, answer: "x", correct: i === 3 ? 1 : 0, final: 1, attempt_no: 1, time_ms: 1, hints_used: 0, solution_viewed: 0, error_label: "Kehrwert vergessen", feedback: "" });
    repo.recordAttempt({ assignment_id: aid, task_id: mul.id, student_id: sid, skill_id: mul.skillId, answer: "x", correct: i === 0 ? 0 : 1, final: 1, attempt_no: 1, time_ms: 1, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "" });
  }
  const prep = exams.examPrep(id, today)!;
  assert.equal(prep.days, 9);
  assert.deepEqual(prep.skills.map((s) => [s.skill.id, s.status]), [
    ["mathe.brueche.dividieren", "kritisch"],
    ["mathe.prozent.prozentwert", "nicht getestet"],
    ["mathe.brueche.multiplizieren", "üben"],
  ].sort((a, b) => ["kritisch", "üben", "nicht getestet"].indexOf(a[1]) - ["kritisch", "üben", "nicht getestet"].indexOf(b[1])));
  assert.deepEqual(prep.untested.map((s) => s.skill.id), ["mathe.prozent.prozentwert"]);
  assert.deepEqual(prep.plan.map((p) => [p.skill.id, p.count]), [["mathe.brueche.dividieren", 5], ["mathe.brueche.multiplizieren", 4], ["mathe.prozent.prozentwert", 3]]);
  assert.equal(prep.totalTasks, 12);

  // result after the exam: no longer reminded, counts as evidence
  repo.setTestResult(id, { grade: 3, points: null, max_points: null });
  assert.equal(repo.getTest(id)?.status, "geschrieben");
  assert.equal(exams.examReminders(today, { teacherId: niko.id }).length, 0);
});

test("recommendations follow the rule order: exam, prerequisite, errors, long ago, next skill", async () => {
  const repo = await import("./repo");
  const { nextSteps } = await import("./recommend");
  const { dayOf } = await import("./exams");
  const today = dayOf(new Date());
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid("Rita Regel", niko.id));
  const w = repo.createWorksheet({ title: "x", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [] },
    ["mathe.brueche.kuerzen", "mathe.brueche.multiplizieren", "mathe.negativ.addieren", "mathe.prozent.prozentwert", "mathe.brueche.erweitern"].map((skillId) => ({ type: "calc" as const, skillId, difficulty: "mittel" as const, prompt: skillId, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] })));
  const aid = repo.assignWorksheet(w, sid);
  const t = Object.fromEntries(repo.listTasks(w).map((x) => [x.skillId, x]));
  const rec = (skill: string, correct: number, daysAgo: number, error: string | null = null) =>
    repo.recordAttempt({ assignment_id: aid, task_id: t[skill].id, student_id: sid, skill_id: skill, answer: "x", correct, final: 1, attempt_no: 1, time_ms: 1, hints_used: 0, solution_viewed: 0, error_label: error, feedback: "", created_at: new Date(Date.now() - daysAgo * DAY).toISOString() });
  for (let i = 0; i < 3; i++) rec("mathe.brueche.kuerzen", i ? 0 : 1, 1); // prerequisite of multiplying, weak
  for (let i = 0; i < 3; i++) rec("mathe.negativ.addieren", 0, 2, "Vorzeichen vergessen"); // frequent recent error
  for (let i = 0; i < 4; i++) rec("mathe.prozent.prozentwert", 1, 40); // long ago
  for (let i = 0; i < 8; i++) rec("mathe.brueche.erweitern", 1, 1); // sits → next skill
  repo.addTest({ student_id: sid, date: plusDays(today, 5), subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["mathe.brueche.multiplizieren"] });

  const steps = nextSteps(sid, { today, limit: 10 });
  const first = (rule: number) => steps.find((s) => s.rule === rule);
  assert.equal(steps[0].rule, 1);
  assert.equal(steps[0].skill.id, "mathe.brueche.multiplizieren");
  assert.match(steps[0].reason, /in 5 Tagen/);
  assert.equal(first(2)?.skill.id, "mathe.brueche.kuerzen");
  assert.equal(first(3)?.skill.id, "mathe.negativ.addieren");
  assert.equal(first(4)?.skill.id, "mathe.prozent.prozentwert");
  assert.ok(first(5) && ["mathe.brueche.addieren", "mathe.brueche.subtrahieren"].includes(first(5)!.skill.id));
  assert.deepEqual(steps.map((s) => s.rule), [...steps.map((s) => s.rule)].sort(), "sorted by rule");
});

test("tracking → skill: an answer stores teacher, difficulty and counts for the skill and its parent", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const { buildWorksheet, submitAnswer, analyzeStudent } = await import("./service");
  const thomas = repo.listTeachers().find((t) => t.name === "Thomas")!;
  const sid = repo.createStudent(kid("Toni Track", null));
  const u = units.startUnit(thomas.id, sid, { subject: "Mathematik" }).unit;
  const { id: w } = await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: ["mathe.brueche.dividieren.kehrwert"], difficulty: "schwer", count: 1, taskType: "calc", useAI: false });
  const aid = repo.assignWorksheet(w, sid, "", u.id);
  const task = repo.listTasks(w)[0];
  assert.equal(task.level, 4);
  // a free-text explanation task, rated by the student (no AI)
  await submitAnswer({ token: repo.getStudent(sid)!.access_token, assignmentId: aid, taskId: task.id, answer: "Zähler und Nenner tauschen, 2/3 → 3/2", timeMs: 30_000, hintsUsed: 1, selfAssessed: true });
  const a = repo.listAttemptsForStudent(sid).at(-1)!;
  assert.equal(a.teacher_id, thomas.id, "the teacher of the unit");
  assert.equal(a.unit_id, u.id);
  assert.equal(a.level, 4);
  assert.equal(a.hints_used, 1);
  assert.ok(a.skill_ids?.includes("mathe.brueche.dividieren"), "counts for the parent skill too");
  const st = analyzeStudent(sid)!.skills.find((s) => s.skill.id === "mathe.brueche.dividieren.kehrwert")!;
  assert.ok(st.mastery! > 0.5, "one correct answer with a hint raises the Lernstand");
});

test("empirical difficulty needs 30 answers before a level is suggested", async () => {
  const { statsOf, EMPIRICAL_MIN } = await import("./lehrplan");
  const row = (correct: number, t: number, h = 0) => ({ correct, time_ms: t, hints_used: h, solution_viewed: 0 });
  assert.equal(statsOf([row(1, 1000), row(0, 3000)]).suggestedLevel, null);
  const many = Array.from({ length: EMPIRICAL_MIN }, (_, i) => row(i % 10 < 4 ? 1 : 0, 1000 * (i + 1), i % 2));
  const s = statsOf(many);
  assert.equal(s.successRate, 0.4);
  assert.equal(s.helpRate, 0.5);
  assert.equal(s.medianTimeSec, 16);
  assert.equal(s.suggestedLevel, 4);
});

test("student migration: clear legacy rows are mapped, ambiguous ones are flagged and not guessed", async () => {
  const { openDatabase } = await import("./db");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-mig-"));
  const file = path.join(dir, "alt.db");
  let conn = openDatabase(file);
  const add = conn.prepare("INSERT INTO students (name, grade, school_type, klasse, subjects, access_token) VALUES (?, ?, ?, NULL, '[]', lower(hex(randomblob(8))))");
  add.run("Alt MS", 6, "Mittelschule");
  add.run("Alt BHS", 11, "BHS (HAK, HTL, HLW …)");
  add.run("Alt leer", 7, "");
  conn.prepare("INSERT INTO students (name, grade, school_type, klasse, subjects, access_token) VALUES ('Widerspruch', 9, 'Mittelschule', 2, '[]', 'x1')").run();
  conn.exec("ALTER TABLE students DROP COLUMN stufe_status");
  conn.close();
  conn = openDatabase(file);
  const rows = Object.fromEntries((conn.prepare("SELECT name, school_type, klasse, grade, stufe_status FROM students").all() as { name: string; stufe_status: string }[]).map((r) => [r.name, r]));
  assert.deepEqual(rows["Alt MS"], { name: "Alt MS", school_type: "Mittelschule", klasse: 2, grade: 6, stufe_status: "eindeutig" });
  assert.deepEqual(rows["Alt BHS"], { name: "Alt BHS", school_type: "BHS (HAK, HTL, HLW …)", klasse: null, grade: 11, stufe_status: "unklar" });
  assert.equal(rows["Alt leer"].stufe_status, "unklar");
  assert.equal(rows["Widerspruch"].stufe_status, "unklar", "stored Schulstufe 9 does not fit 2. Klasse MS");
  conn.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
