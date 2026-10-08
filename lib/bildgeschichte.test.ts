import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-bg-"));
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

type AIRequest = import("./ai/router").AIRequest;

// the first bytes decide the type; the rest only makes each file different
const png = (seed: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`png-${seed}`)]);
const jpg = (seed: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`jpg-${seed}`)]);
const webp = (seed: string) => Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP", "latin1"), Buffer.from(`webp-${seed}`)]);

const kid = (name: string, teacherId: number, school_type = "Volksschule", klasse = 3) => ({
  name, grade: klasse, klasse, teacher_id: teacherId, school: "", school_type, subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

async function setup(name: string) {
  const repo = await import("./repo");
  const ps = await import("./picture-story");
  const texts = await import("./texts");
  const units = await import("./units");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  const unitId = units.startUnit(niko.id, sid, { subject: "Deutsch" }).unit.id;
  const settings = ps.cleanSettings({ schoolType: "Volksschule", klasse: "3", targetWords: "120", starters: "Eines Tages …\nPlötzlich …\n\nZum Glück …", hints: "Schreibe in der Vergangenheit.", lines: "14", sourceKind: "eigen", sourceNote: "Zeichnungen: Niko" });
  return { repo, ps, texts, units, niko, sid, unitId, settings };
}

test("create: pictures in order, settings, linked to student, teacher, unit, subject and Textsorte", async () => {
  const s = await setup("Mia Bild");
  const text = s.ps.createPictureStory({
    studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, subject: "Deutsch", title: "Der verlorene Ball", prompt: "Schreibe zu den Bildern.", settings: s.settings,
    images: [
      { name: "1.png", data: png("a"), caption: "Ein Bub spielt mit dem Ball." },
      { name: "2.jpg", data: jpg("b"), caption: "Der Ball fliegt über den Zaun." },
      { name: "3.webp", data: webp("c") },
    ],
  });
  assert.equal(text.topic, "Bildgeschichte");
  assert.equal(text.student_id, s.sid);
  assert.equal(text.teacher_id, s.niko.id);
  assert.equal(text.unit_id, s.unitId);
  assert.equal(text.subject, "Deutsch");
  const story = s.ps.getPictureStory(text.id)!;
  assert.deepEqual([story.school_type, story.klasse, story.target_words, story.lines], ["Volksschule", 3, 120, 14]);
  assert.deepEqual(story.starters, ["Eines Tages …", "Plötzlich …", "Zum Glück …"], "empty lines are dropped");
  assert.equal(story.source_kind, "eigen");
  const imgs = s.ps.storyImages(text.id);
  assert.deepEqual(imgs.map((i) => [i.position, i.mime, i.caption]), [
    [1, "image/png", "Ein Bub spielt mit dem Ball."],
    [2, "image/jpeg", "Der Ball fliegt über den Zaun."],
    [3, "image/webp", ""],
  ]);
  for (const i of imgs) assert.ok(fs.existsSync(s.ps.imageFile(i)), "file stored under uploads/bildgeschichten");
  assert.ok(s.ps.imageFile(imgs[0]).startsWith(path.join(process.env.UPLOADS_PATH!, "bildgeschichten")), "inside the uploads folder the backup copies");
  // the text is part of the unit (Dokumente der Einheit, Lernverlauf)
  assert.ok(s.texts.textsForUnit(s.unitId).some((t) => t.id === text.id));
  // nothing lands in the material list or the library
  const { listMaterials } = await import("./materials");
  assert.equal(listMaterials().length, 0);
});

test("server checks every file: type from the content, size, count; nothing stored on a wrong file", async () => {
  const s = await setup("Ben Prüfung");
  const base = { studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, subject: "Deutsch", title: "X", prompt: "", settings: s.settings };
  const before = s.texts.textsForStudent(s.sid).length;
  assert.throws(() => s.ps.createPictureStory({ ...base, images: [] }), /mindestens ein Bild/);
  assert.throws(() => s.ps.createPictureStory({ ...base, images: [{ name: "bild.png", data: Buffer.from("GIF89a....") }] }), /kein Bild im Format JPG, PNG oder WebP/);
  assert.throws(() => s.ps.createPictureStory({ ...base, images: [{ name: "x.jpg", data: Buffer.from("%PDF-1.7 ...") }] }), /kein Bild/, "a PDF named .jpg is refused");
  assert.throws(() => s.ps.createPictureStory({ ...base, images: [{ name: "x.svg", data: Buffer.from("<svg onload=alert(1)>") }] }), /kein Bild/);
  const big = Buffer.alloc(s.ps.MAX_IMAGE_BYTES + 1);
  png("x").copy(big);
  assert.throws(() => s.ps.createPictureStory({ ...base, images: [{ name: "gross.png", data: big }] }), /zu groß/);
  const many = Array.from({ length: s.ps.MAX_IMAGES + 1 }, (_, i) => ({ name: `${i}.png`, data: png(`m${i}`) }));
  assert.throws(() => s.ps.createPictureStory({ ...base, images: many }), /Höchstens 12 Bilder/);
  assert.throws(() => s.ps.createPictureStory({ ...base, images: [{ name: "ok.png", data: png("ok") }, { name: "leer.png", data: Buffer.alloc(0) }] }), /leer/);
  assert.equal(s.texts.textsForStudent(s.sid).length, before, "no text was created");
  // file names are never used as paths
  const t = s.ps.createPictureStory({ ...base, images: [{ name: "../../etc/passwd.png", data: png("pfad") }] });
  const img = s.ps.storyImages(t.id)[0];
  assert.equal(img.file_name, "passwd.png");
  assert.match(img.stored_path, /^[0-9a-f]{64}\.png$/);
});

test("settings are kept within limits", async () => {
  const { cleanSettings } = await import("./picture-story");
  const c = cleanSettings({ schoolType: "Volksschule", klasse: "9", targetWords: "-5", starters: Array.from({ length: 20 }, (_, i) => `Satz ${i}`), lines: "500", sourceKind: "geklaut" });
  assert.equal(c.klasse, null, "no 9th class in a Volksschule");
  assert.equal(c.targetWords, null);
  assert.equal(c.starters.length, 8);
  assert.equal(c.lines, 26);
  assert.equal(c.sourceKind, "");
  assert.equal(cleanSettings({ schoolType: "Phantasie" }).schoolType, "");
});

test("change: reorder, describe, add and remove pictures; the written text stays; unused files are removed", async () => {
  const s = await setup("Ella Ordnung");
  const t = s.ps.createPictureStory({
    studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, subject: "Deutsch", title: "Ordnung", prompt: "", settings: s.settings,
    images: [{ name: "a.png", data: png("o1") }, { name: "b.png", data: png("o2") }, { name: "c.png", data: png("o3") }],
  });
  assert.ok(s.texts.saveText(t.id, [{ t: "p", r: [{ x: "Es war einmal ein Ball." }] }], 0).ok);
  const [a, b, c] = s.ps.storyImages(t.id);
  s.ps.updatePictureStory(t.id, {
    title: "Ordnung neu", subject: "Deutsch", prompt: "Neu", settings: { ...s.settings, lines: 40 },
    order: [{ id: c.id, caption: "Zuerst" }, { upload: 0, caption: "Neu dazu" }, { id: a.id }],
    uploads: [{ name: "d.jpg", data: jpg("o4") }],
  });
  const now = s.ps.storyImages(t.id);
  assert.deepEqual(now.map((i) => i.file_name), ["c.png", "d.jpg", "a.png"]);
  assert.deepEqual(now.map((i) => i.position), [1, 2, 3]);
  assert.deepEqual(now.map((i) => i.caption), ["Zuerst", "Neu dazu", ""]);
  assert.ok(!fs.existsSync(s.ps.imageFile(b)), "the removed picture's file is gone");
  const text = s.texts.getText(t.id)!;
  assert.equal(text.title, "Ordnung neu");
  assert.equal(text.body, '[{"t":"p","r":[{"x":"Es war einmal ein Ball."}]}]', "the story itself is not touched");
  assert.equal(s.ps.getPictureStory(t.id)!.lines, 40);
  // a picture of another story cannot be pulled in
  const other = s.ps.createPictureStory({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, subject: "Deutsch", title: "Andere", prompt: "", settings: s.settings, images: [{ name: "z.png", data: png("o9") }] });
  const foreign = s.ps.storyImages(other.id)[0];
  assert.throws(() => s.ps.updatePictureStory(t.id, { title: "x", subject: "", prompt: "", settings: s.settings, order: [{ id: foreign.id }], uploads: [] }), /gehört nicht/);
  assert.throws(() => s.ps.updatePictureStory(t.id, { title: "x", subject: "", prompt: "", settings: s.settings, order: [], uploads: [] }), /mindestens ein Bild/);
  assert.throws(() => s.ps.updatePictureStory(t.id, { title: "x", subject: "", prompt: "", settings: s.settings, order: [{ id: a.id }, { id: a.id }], uploads: [] }), /doppelt/);
  // the same picture in two stories: removing it from one keeps the other's file
  const twin = s.ps.createPictureStory({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, subject: "Deutsch", title: "Zwilling", prompt: "", settings: s.settings, images: [{ name: "same.png", data: png("o1") }] });
  s.ps.updatePictureStory(t.id, { title: "x", subject: "", prompt: "", settings: s.settings, order: [{ id: c.id }], uploads: [] });
  assert.ok(fs.existsSync(s.ps.imageFile(s.ps.storyImages(twin.id)[0])), "file still used by the other story");
});

test("hand in: only the version the device has saved; the text becomes fertig", async () => {
  const s = await setup("Tom Abgabe");
  const t = s.ps.createPictureStory({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, subject: "Deutsch", title: "Abgabe", prompt: "", settings: s.settings, images: [{ name: "a.png", data: png("h1") }] });
  const saved = s.texts.saveText(t.id, [{ t: "p", r: [{ x: "Der Hund lief weg." }] }], 0);
  assert.ok(saved.ok);
  assert.deepEqual(s.ps.handIn(t.id, 0), { ok: false, reason: "veraltet", version: 1 }, "an older version is not handed in");
  assert.equal(s.texts.getText(t.id)!.status, "offen");
  assert.deepEqual(s.ps.handIn(t.id, 1), { ok: true });
  assert.equal(s.texts.getText(t.id)!.status, "fertig");
  assert.deepEqual(s.ps.handIn(t.id, 1), { ok: true }, "a repeated request (lost answer) is fine");
  assert.deepEqual(s.ps.handIn(999999, 1), { ok: false, reason: "fehlt" });
});

test("access: a picture names its student, so tablet and laptop routes can refuse other students' pictures", async () => {
  const s = await setup("Ida Zugriff");
  const t = s.ps.createPictureStory({ studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, subject: "Deutsch", title: "Z", prompt: "", settings: s.settings, images: [{ name: "a.png", data: png("z1") }] });
  const img = s.ps.storyImages(t.id)[0];
  assert.equal(s.ps.imageWithOwner(img.id)!.student_id, s.sid);
  assert.equal(s.ps.imageWithOwner(img.id + 9999), null);
  assert.equal(s.ps.imageWithOwner(Number.NaN), null);
});

test("KI correction: Bildgeschichte criteria, the teacher's descriptions as the only picture context, names masked, story level", async () => {
  const s = await setup("Noah Korrektur");
  const router = await import("./ai/router");
  const tc = await import("./text-correction");
  const { correctionPrompt } = await import("./ai/textkorrektur");
  const t = s.ps.createPictureStory({
    studentId: s.sid, teacherId: s.niko.id, unitId: s.unitId, subject: "Deutsch", title: "Der Ball", prompt: "Erzähle die Bildgeschichte.",
    settings: { ...s.settings, schoolType: "Mittelschule", klasse: 2 },
    images: [{ name: "a.png", data: png("k1"), caption: "Noah spielt im Garten mit dem Ball." }, { name: "b.png", data: png("k2"), caption: "" }],
  });
  assert.ok(s.texts.saveText(t.id, [{ t: "p", r: [{ x: "Noah spielte im Garten. Plötzlich flog der Ball über den Zaun und alle lachten laut." }] }], 0).ok);
  const text = s.texts.getText(t.id)!;
  assert.equal(tc.levelOfText(text).label, "2. Klasse Mittelschule", "the story's own Schulart and Klasse");
  const req = tc.correctionRequest(text, s.texts.textDoc(text));
  assert.deepEqual(req.pictures, { count: 2, captions: ["[Name] spielt im Garten mit dem Ball.", ""] }, "names in descriptions are masked too");
  const prompt = correctionPrompt(req);
  assert.match(prompt, /Textsorte: Bildgeschichte/);
  for (const k of ["Einleitung", "Handlungsablauf", "Bilderfolge", "Spannung", "Wortwahl", "Schluss", "Rechtschreibung und Grammatik"]) assert.ok(prompt.includes(k), k);
  assert.match(prompt, /Bild 1: \[Name\] spielt im Garten mit dem Ball\./);
  assert.match(prompt, /Bild 2: \(keine Beschreibung\)/);
  assert.match(prompt, /Behaupte nichts über die Bilder, was dort nicht steht/);
  assert.ok(!prompt.includes("Noah"), "no name leaves the app");
  assert.ok(!/\.png|bildgeschichten|sha/i.test(prompt), "no file, path or picture data");
  const preview = tc.aiPreview(text);
  assert.deepEqual(preview.pictures, ["Bild 1: [Name] spielt im Garten mit dem Ball.", "Bild 2: (keine Beschreibung)"]);

  // without any description the KI is told not to judge the pictures at all
  const bare = correctionPrompt({ ...req, pictures: { count: 4, captions: ["", "", "", ""] } });
  assert.match(bare, /Beurteile den Zusammenhang mit den Bildern nicht/);
  assert.ok(!/Bild 1:/.test(bare));

  // the correction runs as for every text, with the pictures' context in the request
  const calls: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (r: AIRequest) => {
    calls.push(r);
    return { parsed: { findings: [{ para: 1, quote: "lachten laut", replacement: "lachten", category: "ausdruck", kind: "stil", rule: "", explanation: "Kürzer wirkt stärker.", skill_id: null }], hints: [], strengths: ["Spannender Anfang"], main_issue: null, recommendation: null, recommendation_skill_id: null }, refusal: false, model: r.model, usage: { input: 900, output: 300, cacheWrite: 0, cacheRead: 0 } };
  });
  const res = await tc.startAICorrection(t.id, s.niko.id, { consent: true, wait: true });
  assert.ok(res.ok);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0].content), /Bilderfolge: 2 Bilder/);
  assert.equal(tc.getCorrection(res.correctionId)!.level, "2. Klasse Mittelschule");
  router.setTransport(null);
});

test("print options: the empty worksheet is a URL setting like the others", async () => {
  const { readTextPrintOptions, textPrintQuery } = await import("./text-print");
  const o = readTextPrintOptions({ blatt: "leer" }, "Titel");
  assert.equal(o.blatt, "leer");
  assert.equal(textPrintQuery(o, "Titel"), "blatt=leer");
  assert.equal(readTextPrintOptions({ blatt: "etwas" }, "Titel").blatt, "geschichte");
});

test("backup: the new tables are exported with the texts", async () => {
  const { db } = await import("./db");
  const { exportBackup } = await import("./backup");
  const b = exportBackup(db());
  assert.ok("picture_stories" in b.tables && "picture_story_images" in b.tables);
  const names = Object.keys(b.tables);
  assert.ok(names.indexOf("texts") < names.indexOf("picture_stories") && names.indexOf("picture_stories") < names.indexOf("picture_story_images"), "parents before children");
});

test("deleting a student removes the picture files only used by their stories", async () => {
  const s = await setup("Lea Weg");
  const other = s.repo.createStudent(kid("Ben Bleibt", s.niko.id));
  const make = (studentId: number, images: { name: string; data: Buffer }[]) =>
    s.ps.createPictureStory({ studentId, teacherId: s.niko.id, unitId: null, subject: "Deutsch", title: "T", prompt: "", settings: s.settings, images });
  const lea = make(s.sid, [{ name: "eigen.png", data: png("nur-lea") }, { name: "geteilt.png", data: png("beide") }]);
  make(other, [{ name: "geteilt.png", data: png("beide") }]);
  const [own, shared] = s.ps.storyImages(lea.id).map((i) => s.ps.imageFile(i));
  assert.ok(fs.existsSync(own) && fs.existsSync(shared));
  const files = s.ps.studentImageFiles(s.sid);
  s.repo.deleteStudent(s.sid);
  s.ps.dropFilesIfUnused(files);
  assert.equal(s.ps.getPictureStory(lea.id), null, "rows go with the student");
  assert.ok(!fs.existsSync(own), "the picture only Lea used is gone");
  assert.ok(fs.existsSync(shared), "the same picture in Ben's story stays");
});
