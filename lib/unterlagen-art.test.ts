/**
 * Art der Unterlagen in „Was steht heute an?“ (niko, 27.10.2026: „Das Fotografieren einer beliebigen Schulübung ist nicht
 * automatisch dasselbe wie das Erfassen des gesamten Schularbeitsstoffs“): je Datei eine Rolle, nur der Stoffzettel legt den
 * Prüfungsstoff fest, eine Erklärung oder ein Blatt mit Aufgaben gibt die Themen für heute. Die Lehrkraft ändert die Rolle
 * ohne neue Anfrage; vorhandenes Material wird gewählt statt neu fotografiert und kostet nichts, wenn es schon gelesen ist.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt (wie in lib/pruefungsstoff.test.ts) und antwortet mit
 * der von Hand geschriebenen Antwort (lib/fixtures/stoff-englisch-more.ts) oder einem erfundenen Arbeitsblatt. Die Dateien
 * sind ein paar erfundene Bytes mit dem Anfang einer JPEG-Datei. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { PruefungsstoffGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";
import { STOFF_ENGLISCH_MORE } from "./fixtures/stoff-englisch-more";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "unterlagen-art-"));
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR",
])
  delete process.env[k];

const HEUTE = "2026-10-27";
let n = 0;
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundenes Blatt ${++n}`)]);

/** Ein erfundenes Arbeitsblatt aus der Schule: Übungen zum Past Simple, oben „Unit 4“. */
const ARBEITSBLATT = (rolle: "aufgaben" | "stoffzettel"): PruefungsstoffGelesen => ({
  art: null,
  fach: "Englisch",
  datum: null,
  titel: "Worksheet Past Simple",
  dokumente: [{ nr: 1, rolle, titel: "Worksheet Past Simple" }],
  punkte: [
    { gruppe: "umfang", original: "Unit 4", inhalt: "Unit 4", einheit: "Unit 4", dokument: 1, status: "pruefung", grund: null, skill_id: null },
    { gruppe: "grammatik", original: "Past simple: regular verbs", inhalt: "Past Simple", einheit: "Unit 4", dokument: 1, status: "pruefung", grund: null, skill_id: "englisch.tenses.pastsimple" },
  ],
  schwierigkeiten: [],
  termin_text: null,
  unsicher: [],
});

async function einheit() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { saveUpload } = await import("./materials");
  const units = await import("./units");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lena Beispiel", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Englisch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const upload = (title = "Für heute") => saveUpload({ name: "blatt.jpg", data: jpeg() }, { title, studentId: sid, teacherId: teacher.id }).id;
  const unit = units.startUnit(teacher.id, sid, { subject: "Englisch" }).unit;
  return { repo, teacher, sid, upload, unit, units };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `antwort`. */
async function mitKi(antwort: PruefungsstoffGelesen | ((req: AIRequest) => PruefungsstoffGelesen)) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: typeof antwort === "function" ? antwort(req) : antwort, refusal: false, model: req.model, usage: { input: 6_500, output: 3_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}
const bilder = (req: AIRequest) => (req.content as { type: string }[]).filter((t) => t.type === "image").length;

test("roles from the fixture: the Stoffzettel sets the exam scope, the table of contents only adds details; the role is kept on the file", async () => {
  const { upload, teacher, sid, repo } = await einheit();
  const ps = await import("./pruefungsstoff");
  const { getMaterial } = await import("./materials");
  const zettel = upload("Stoffzettel");
  const inhalt = upload();
  const ki = await mitKi(STOFF_ENGLISCH_MORE);
  try {
    const r = await ps.liesPruefungsstoff({ materialIds: [zettel, inhalt], studentId: sid, teacherId: teacher.id, heute: HEUTE, fach: "Englisch" });
    assert.match(ki.gefragt[0].system, /erklaerung \(Buchseite, Merkblatt/);
    assert.match(ki.gefragt[0].system, /aufgaben \(Arbeitsblatt, Schulübung/);
    assert.match(ki.gefragt[0].system, /Nur ein stoffzettel legt den Prüfungsumfang fest/);
    assert.deepEqual(r.lesung.dokumente.map((d) => d.rolle), ["stoffzettel", "inhaltsverzeichnis"]);
    assert.deepEqual(r.lesung.dokumente.map((d) => ps.ROLLE_SATZ[d.rolle]), ["legt den Prüfungsstoff fest", "ist ein Inhaltsverzeichnis"]);
    assert.equal(getMaterial(zettel)!.rolle, "stoffzettel", "the role is on the file");
    assert.equal(getMaterial(inhalt)!.rolle, "inhaltsverzeichnis");
    assert.equal(getMaterial(zettel)!.rolle_geprueft, 0, "the KI's role, not the teacher's");
    // the scope as before: a Prüfung gets the Stoffzettel's points, nothing only from the worksheet rule
    const testId = repo.addTest({ student_id: sid, date: "2026-11-06", subject: "Englisch", kind: "Test", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "1st test", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
    const zeilen = ps.stoffAusLesung(testId, r.id);
    assert.equal(zeilen.find((z) => z.original === "continuous")!.status, "pruefung");
    assert.ok(repo.getTest(testId)!.skill_ids.includes("englisch.tenses.presentprogressive"));
  } finally {
    ki.aus();
  }
});

test("a worksheet photo marked „enthält Aufgaben“ gives today's topics but never exam scope", async () => {
  const { upload, teacher, sid, repo, unit } = await einheit();
  const vg = await import("./vorgabe");
  const ps = await import("./pruefungsstoff");
  const cockpit = await import("./cockpit");
  const blatt = upload();
  const ki = await mitKi(ARBEITSBLATT("aufgaben"));
  try {
    const out = await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "", materialIds: [blatt], testId: null, keinName: true, heute: HEUTE });
    assert.ok("ok" in out);
    const v = vg.vorgabeDerEinheit(unit.id)!;
    // today: what the sheet practises, without the unit heading
    assert.deepEqual(v.punkte.map((p) => p.inhalt), ["Past Simple"]);
    assert.deepEqual(v.skillIds, ["englisch.tenses.pastsimple"]);
    assert.ok(cockpit.planDerEinheit(unit.id).some((s) => s.titel === "Üben: Past Simple"), "the plan follows the sheet");
    assert.deepEqual(vg.dateienDerVorgabe(v), [{ materialId: blatt, art: "Foto", gelesen: true, rolle: "aufgaben" }]);
    // solved on paper: „Arbeit fotografieren“ right under the Vorgabe, until the unit has its first paper work
    assert.equal(vg.blattMitAufgabenOffen(unit.id), true);
    const p = await import("./papier-einheit");
    const zeile = { nr: "1", aufgabe: "Yesterday I ___ (play) football.", antwort: "played", bewertung: "richtig" as const, punkte: null, max: null, skillId: "englisch.tenses.pastsimple", fehler: "", pruefen: false };
    const papier = p.speicherePapier({ unitId: unit.id, teacherId: teacher.id, blatt: p.ANDERES_BLATT, zeilen: [zeile], materialIds: [], gelesen: "hand", fach: "Englisch", titel: "Worksheet Past Simple" });
    assert.ok(!("error" in papier), JSON.stringify(papier));
    assert.equal(vg.blattMitAufgabenOffen(unit.id), false);
    // no exam scope: no comparison, no topics for the field „Stoff“, at a Prüfung only „noch zu klären“
    assert.equal(vg.pruefungZurVorgabe(v, "Englisch", HEUTE), null);
    const l = ps.getLesung(v.lesungId)!;
    assert.deepEqual(l.lesung.kopf.themen, []);
    const testId = repo.addTest({ student_id: sid, date: "2026-11-10", subject: "Englisch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
    const zeilen = ps.stoffAusLesung(testId, l.id);
    const past = zeilen.find((z) => z.inhalt === "Past Simple")!;
    assert.equal(past.status, "unklar", "kept, not lost, but not Prüfungsstoff");
    assert.match(past.grund, /Blatt mit Aufgaben/);
    assert.deepEqual(repo.getTest(testId)!.skill_ids, [], "the worksheet links no skill to the exam");
    assert.equal(zeilen.some((z) => z.status === "pruefung" && z.gruppe !== "umfang"), false);
  } finally {
    ki.aus();
  }

  // „Prüfung eintragen“ from the Vorgabe: the worksheet's topic stays out of the Stoff, the sheet is not the Stoffzettel
  const { resetRouter } = await import("./ai/router");
  resetRouter();
  const ki2 = await mitKi(() => ({ ...ARBEITSBLATT("aufgaben"), termin_text: "nächste Woche" }));
  try {
    await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "", materialIds: [upload()], testId: null, keinName: true, heute: HEUTE });
    const v = vg.vorgabeDerEinheit(unit.id)!;
    assert.equal(v.terminText, "nächste Woche");
    const neu = vg.pruefungAusVorgabe(unit.id, { datum: "2026-11-03", art: "Test", teacherId: teacher.id, heute: HEUTE });
    assert.ok("ok" in neu);
    const t = repo.getTest(neu.testId)!;
    assert.deepEqual(t.topics, []);
    assert.deepEqual(t.skill_ids, []);
    assert.equal(t.material_id, null, "a worksheet is not attached as the Stoffzettel");
  } finally {
    ki2.aus();
  }
});

test("changing a role recomputes the Vorgabe without a new KI request and is kept on the file", async () => {
  const { upload, teacher, unit } = await einheit();
  const vg = await import("./vorgabe");
  const ps = await import("./pruefungsstoff");
  const { getMaterial } = await import("./materials");
  const blatt = upload();
  // the KI takes a worksheet for a Stoffzettel; the teacher's text is document 0
  const zettel = ARBEITSBLATT("stoffzettel");
  const ki = await mitKi({ ...zettel, punkte: [{ gruppe: "grammatik", original: "Present Simple", inhalt: "Present Simple", einheit: null, dokument: 0, status: "pruefung", grund: null, skill_id: "englisch.tenses.presentsimple" }, ...zettel.punkte] });
  try {
    await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Present Simple", materialIds: [blatt], testId: null, keinName: true, heute: HEUTE });
    assert.equal(ki.gefragt.length, 1);
    let v = vg.vorgabeDerEinheit(unit.id)!;
    assert.deepEqual(v.punkte.map((p) => p.inhalt), ["Present Simple"], "a Stoffzettel is compared, not today's topic");
    assert.ok(vg.pruefungZurVorgabe(v, "Englisch", HEUTE), "taken for a Stoffzettel it would set the exam scope");

    // one tap: „enthält Aufgaben“
    assert.ok(vg.aendereRolle(unit.id, blatt, "aufgaben"));
    assert.equal(ki.gefragt.length, 1, "no new request");
    v = vg.vorgabeDerEinheit(unit.id)!;
    assert.deepEqual(v.punkte.map((p) => p.inhalt), ["Present Simple", "Past Simple"], "the teacher's point first, then the sheet's");
    assert.ok(v.skillIds.includes("englisch.tenses.pastsimple"));
    assert.equal(vg.pruefungZurVorgabe(v, "Englisch", HEUTE), null, "no exam scope any more");
    assert.equal(vg.dateienDerVorgabe(v)[0].rolle, "aufgaben");
    assert.equal(getMaterial(blatt)!.rolle, "aufgaben");
    assert.equal(getMaterial(blatt)!.rolle_geprueft, 1);

    // the same file read again: the teacher's role stays, still no request
    const wieder = await ps.liesPruefungsstoff({ materialIds: [blatt], angabe: "Heute Present Simple", studentId: unit.student_id, teacherId: teacher.id, heute: HEUTE, fach: "Englisch" });
    assert.equal(wieder.neu, false);
    assert.equal(wieder.lesung.dokumente[0].rolle, "aufgaben");
    assert.equal(ki.gefragt.length, 1);

    // and back
    assert.ok(vg.aendereRolle(unit.id, blatt, "stoffzettel"));
    assert.deepEqual(vg.vorgabeDerEinheit(unit.id)!.punkte.map((p) => p.inhalt), ["Present Simple"]);
    assert.equal(vg.aendereRolle(unit.id, upload(), "aufgaben"), false, "only a file of this Vorgabe");
    assert.equal(ki.gefragt.length, 1);
  } finally {
    ki.aus();
  }
});

test("existing material: listed newest first, chosen instead of a new photo, a file read before costs nothing", async () => {
  const { upload, teacher, unit, units, sid } = await einheit();
  const vg = await import("./vorgabe");
  const zettel = upload("Stoffzettel");
  const inhalt = upload("Inhaltsverzeichnis");
  const ki = await mitKi(STOFF_ENGLISCH_MORE);
  try {
    await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "", materialIds: [zettel, inhalt], testId: null, keinName: true, heute: HEUTE });
    assert.equal(ki.gefragt.length, 1);
    const ersteLesung = vg.vorgabeDerEinheit(unit.id)!.lesungId;

    // the next unit: the same sheets chosen from the list
    units.finishUnit(unit.id, "beendet");
    const zweite = units.startUnit(teacher.id, sid, { subject: "Englisch" }).unit;
    const liste = vg.materialZurWahl(sid);
    assert.deepEqual(liste.slice(0, 2).map((m) => m.id), [inhalt, zettel], "newest first");
    assert.equal(liste[1].rolle, "stoffzettel", "the role is known from the reading");
    // without the tick: what was read before is used, nothing goes to the KI
    await vg.speichereVorgabe({ unitId: zweite.id, teacherId: teacher.id, text: "", materialIds: [zettel, inhalt], testId: null, keinName: false, heute: HEUTE });
    assert.equal(ki.gefragt.length, 1, "cache hit");
    let v = vg.vorgabeDerEinheit(zweite.id)!;
    assert.equal(v.lesungId, ersteLesung);
    assert.equal(v.hinweis, "");
    assert.ok(v.punkte.length > 0);

    // with a new text: only the text is read, the photos are not sent again
    await vg.speichereVorgabe({ unitId: zweite.id, teacherId: teacher.id, text: "Heute vor allem Past Simple", materialIds: [zettel, inhalt], testId: null, keinName: true, heute: HEUTE });
    assert.equal(ki.gefragt.length, 2);
    assert.equal(bilder(ki.gefragt[1]), 0, "no photo paid twice");
    v = vg.vorgabeDerEinheit(zweite.id)!;
    assert.equal(v.lesungId, ersteLesung, "compared with the sheets read before");
    assert.ok(vg.pruefungZurVorgabe(v, "Englisch", HEUTE), "the Stoffzettel still sets the scope to compare with");
  } finally {
    ki.aus();
  }
});

test("without KI: the text by rules, photos stored with a plain sentence; a file at a Prüfung counts as its Stoffzettel", async () => {
  const { upload, teacher, unit, repo, sid } = await einheit();
  const vg = await import("./vorgabe");
  const blatt = upload();
  const zettel = upload();
  repo.addTest({ student_id: sid, date: "2026-11-06", subject: "Englisch", kind: "Test", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: zettel });
  const out = await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Present Simple", materialIds: [blatt, zettel], testId: null, keinName: false, heute: HEUTE });
  assert.ok("ok" in out);
  const v = vg.vorgabeDerEinheit(unit.id)!;
  assert.equal(v.hinweis, "Lesen kann nur die KI, und die ist gerade nicht eingerichtet. Die Fotos und PDFs sind gespeichert. DreamStudy hat deinen Text selbst zerlegt.");
  assert.deepEqual(v.punkte.map((p) => p.inhalt), ["Present Simple"]);
  assert.deepEqual(v.materialIds, [blatt, zettel]);
  assert.deepEqual(
    vg.dateienDerVorgabe(v).map((d) => [d.gelesen, d.rolle]),
    [
      [false, null],
      [false, "stoffzettel"],
    ],
  );
});
