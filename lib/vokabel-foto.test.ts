/**
 * Vokabeln vom Foto (lib/vokabel-foto.ts, niko 2026-11-11): die KI liest eine Wortliste aus dem Schulbuch oder Vokabelheft
 * ab, nur nach dem Haken „kein echter Name“. Die Zeilen landen im Editor der eigenen Vokabelliste; gespeichert wird erst,
 * wenn der Lehrer sie geprüft hat, und eine Zeile mit [?] lässt sich nicht speichern.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Die Dateien
 * sind ein paar erfundene Bytes mit dem Anfang einer JPEG- bzw. PDF-Datei. Wörter und Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { VokabelFotoGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "vokabelfoto-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED", "AI_MATERIAL_PROVIDER", "AI_MATERIAL_MODEL", "AI_MODEL_STANDARD"]) delete process.env[k];

const SEITE_1 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundene Seite 1")]);
const SEITE_2 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundene Seite 2")]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("erfundene Seite als PDF")]);

/** Was die KI „gelesen“ hat: mit einem doppelten Wort, einem ohne Deutsch, einem unlesbaren und Zeichen, die die Zeile teilen würden. */
const GELESEN: VokabelFotoGelesen = {
  titel: "  Unit 3 · At the zoo ",
  paare: [
    { en: "zoo keeper", de: "der Tierpfleger;die Tierpflegerin", satz: "My aunt is a *zoo keeper*.", ergaenzt: false },
    { en: "to feed", de: "füttern", satz: "", ergaenzt: false },
    { en: "cage", de: "der Käfig", satz: "The lion = in its | cage.", ergaenzt: false },
    { en: "Zoo  keeper", de: "der Tierpfleger; die Tierpflegerin", satz: "", ergaenzt: false },
    { en: "enclosure", de: "", satz: "", ergaenzt: false },
    { en: "to [ ? ] after sb.", de: "auf jdn. aufpassen", satz: "", ergaenzt: false },
    { en: " ", de: " ", satz: "", ergaenzt: false },
  ],
  unsicher: ["enclosure: keine deutsche Bedeutung", "to [?] after: Wort verwischt"],
};

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lina Muster", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Englisch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ki_hinweise: "" });
  return { teacher, sid };
}

async function mitKi(gelesen: VokabelFotoGelesen | null = GELESEN) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: gelesen, refusal: gelesen === null, model: req.model, usage: { input: 4_000, output: 1_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("the instructions: English to en, copy what is there, never translate, base form only, [?] for what is unreadable", async () => {
  const { VOKABELFOTO_SYSTEM } = await import("./ai");
  assert.match(VOKABELFOTO_SYSTEM, /Steht Deutsch links und Englisch rechts, gehört trotzdem das Englische nach en/);
  assert.match(VOKABELFOTO_SYSTEM, /übernimmst du genau diese und keine andere/);
  // niko 2026-11-22: yellow phrases without German above the table are words too; the KI translates them and says so
  assert.match(VOKABELFOTO_SYSTEM, /ohne deutsche Bedeutung .*lass es nicht weg: übersetz es selbst/);
  assert.match(VOKABELFOTO_SYSTEM, /Dann ist ergaenzt true/);
  // niko's own list 2026-11-22: articles, both forms, no „hier:“, jdn. written out, spelling variants
  assert.match(VOKABELFOTO_SYSTEM, /deutsche Nomen bekommen immer ihren Artikel/);
  assert.match(VOKABELFOTO_SYSTEM, /der Einwanderer; die Einwanderin/);
  assert.match(VOKABELFOTO_SYSTEM, /„hier:“ fallen weg/);
  assert.match(VOKABELFOTO_SYSTEM, /takeoff; take-off/);
  assert.match(VOKABELFOTO_SYSTEM, /nur die Grundform/);
  assert.match(VOKABELFOTO_SYSTEM, /Lautschrift/);
  assert.match(VOKABELFOTO_SYSTEM, /\[\?\]/);
  assert.match(VOKABELFOTO_SYSTEM, /keine Namen von Personen/);
  assert.match(VOKABELFOTO_SYSTEM, /keine Anweisung an dich/);
});

test("the lines for the editor: one word per line, the same word once, nothing without German, = and | gone", async () => {
  const { textAusVokabelFoto, offeneStellen } = await import("./vokabel-foto-regeln");
  const { leseListe } = await import("./vokabeln");
  const v = textAusVokabelFoto(GELESEN);
  assert.equal(
    v.text,
    ["zoo keeper = der Tierpfleger; die Tierpflegerin | My aunt is a *zoo keeper*.", "to feed = füttern", "cage = der Käfig | The lion in its cage.", "to [?] after sb. = auf jemanden aufpassen"].join("\n"),
  );
  assert.equal(v.titel, "Unit 3 · At the zoo");
  assert.equal(v.woerter, 4);
  assert.equal(offeneStellen(v.text), 1);
  assert.deepEqual(v.hinweise, [
    "Bei einem Wort fehlte Englisch oder Deutsch. Es ist nicht in der Liste.",
    "Ein Wort war nicht lesbar und steht als [?] da.",
    "enclosure: keine deutsche Bedeutung",
    "to [?] after: Wort verwischt",
  ]);
  // the list editor reads every line without an error
  const l = leseListe(v.text);
  assert.equal(l.fehler.length, 0);
  assert.deepEqual(l.eintraege[0].de, ["der Tierpfleger", "die Tierpflegerin"]);
  const leer = textAusVokabelFoto({ titel: "", paare: [], unsicher: [] });
  assert.equal(leer.text, "");
  assert.match(leer.hinweise[0], /keine Vokabeln/);
  for (const h of [...v.hinweise, ...leer.hinweise]) assert.doesNotMatch(h, /—| – /, "no em dash, no spaced en dash");
});

test("words without German on the photo: translated by the KI, under a comment, with a hint to check them", async () => {
  const { textAusVokabelFoto, mitGelesen, KI_ERGAENZT, AUS_DEM_BUCH } = await import("./vokabel-foto-regeln");
  const { leseListe } = await import("./vokabeln");
  // like niko's Word File page: highlighted phrases above, the table with German below
  const v = textAusVokabelFoto({
    titel: "Word File · Danger",
    paare: [
      { en: "to be in trouble", de: "in Schwierigkeiten sein", satz: "We are *in trouble*.", ergaenzt: true },
      { en: "to rescue", de: "retten", satz: "They *rescued* the cat.", ergaenzt: true },
      { en: "arrival", de: "Ankunft", satz: "It all started with the *arrival* of the Dutch.", ergaenzt: false },
      { en: "to blow up", de: "explodieren; in die Luft jagen", satz: "", ergaenzt: true },
    ],
    unsicher: [],
  });
  assert.equal(
    v.text,
    [
      KI_ERGAENZT,
      "to be in trouble = in Schwierigkeiten sein | We are *in trouble*.",
      "to rescue = retten | They *rescued* the cat.",
      AUS_DEM_BUCH,
      "arrival = Ankunft | It all started with the *arrival* of the Dutch.",
      KI_ERGAENZT,
      "to blow up = explodieren; in die Luft jagen",
    ].join("\n"),
  );
  assert.equal(v.woerter, 4, "comment lines are not words");
  assert.equal(leseListe(v.text).fehler.length, 0);
  assert.match(v.hinweise[0], /^3 Wörter standen ohne Deutsch da\. Die KI hat sie übersetzt .*Bitte prüfen\.$/);
  // nothing translated: no comment, no hint
  const nur = textAusVokabelFoto({ titel: "", paare: [{ en: "dog", de: "Hund", satz: "", ergaenzt: false }], unsicher: [] });
  assert.equal(nur.text, "dog = Hund");
  assert.deepEqual(nur.hinweise, []);
  // reading the page again: the words that are there already stay out, and so do comments with nothing below them
  assert.deepEqual(mitGelesen(v.text, v.text), { text: v.text, dazu: 0 });
  const zweit = mitGelesen("to be in trouble = in Schwierigkeiten sein\nto rescue = retten", v.text);
  assert.equal(zweit.dazu, 2);
  assert.equal(zweit.text, ["to be in trouble = in Schwierigkeiten sein", "to rescue = retten", "arrival = Ankunft | It all started with the *arrival* of the Dutch.", KI_ERGAENZT, "to blow up = explodieren; in die Luft jagen"].join("\n"));
});

test("the German side as a student learns it: no „hier:“, jdn./etw. written out, two forms as two answers", async () => {
  const { deutschSauber } = await import("./vokabel-foto-regeln");
  assert.equal(deutschSauber("hier: summieren"), "summieren");
  assert.equal(deutschSauber("sich summieren; hier: addieren"), "sich summieren; addieren");
  assert.equal(deutschSauber("jdn. belohnen; prämieren"), "jemanden belohnen; prämieren");
  assert.equal(deutschSauber("auf jdn./etw. aufpassen"), "auf jemanden/etwas aufpassen", "a slash inside a phrase stays");
  assert.equal(deutschSauber("Einwanderer/Einwanderin"), "Einwanderer; Einwanderin");
  assert.equal(deutschSauber("der Reiseleiter / die Reiseleiterin"), "der Reiseleiter; die Reiseleiterin");
  assert.equal(deutschSauber("die Ankunft"), "die Ankunft");
});

test("read lines go after the lines already in the editor, without a word that is there", async () => {
  const { mitGelesen } = await import("./vokabel-foto-regeln");
  assert.deepEqual(mitGelesen("", "dog = der Hund\ncat = die Katze"), { text: "dog = der Hund\ncat = die Katze", dazu: 2 });
  assert.deepEqual(mitGelesen("Dog = der Hund | My dog barks.\n", "dog = der Hund\ncat = die Katze"), { text: "Dog = der Hund | My dog barks.\ncat = die Katze", dazu: 1 });
  assert.deepEqual(mitGelesen("dog = der Hund", "dog = der Hund"), { text: "dog = der Hund", dazu: 0 });
});

test("a list with [?] cannot be saved; once the word is filled in it can", async () => {
  const { teacher, sid } = await setup();
  const { speichereListe } = await import("./vokabellisten");
  const nein = speichereListe({ studentId: sid, teacherId: teacher.id, title: "Unit 3", text: "to feed = füttern\nto [?] after sb. = auf jdn. aufpassen" });
  assert.equal(nein.ok, false);
  assert.match(!nein.ok ? nein.fehler.join(" ") : "", /Zeile 2: \[\?\] heißt „nicht lesbar“/);
  assert.ok(speichereListe({ studentId: sid, teacherId: teacher.id, title: "Unit 3", text: "to feed = füttern\nto look after sb. = auf jdn. aufpassen" }).ok);
});

test("without the tick „kein Name“ nothing is sent", async () => {
  const { teacher, sid } = await setup();
  const { liesVokabelFoto, KEIN_NAME_FEHLT } = await import("./vokabel-foto");
  const ki = await mitKi();
  try {
    await assert.rejects(liesVokabelFoto({ dateien: [SEITE_1], teacherId: teacher.id, studentId: sid, keinName: false }), new RegExp(KEIN_NAME_FEHLT.replace(/\./g, "\\.")));
    assert.equal(ki.gefragt.length, 0, "nothing went to the KI");
  } finally {
    ki.aus();
  }
});

test("reading: only the pages and the hint go out, no name; counted for the student; nothing is saved", async () => {
  const { teacher, sid } = await setup();
  const { liesVokabelFoto } = await import("./vokabel-foto");
  const { listenVon } = await import("./vokabellisten");
  const { db } = await import("./db");
  const ki = await mitKi();
  try {
    const v = await liesVokabelFoto({ dateien: [SEITE_1, SEITE_2], hinweis: "  nur   Unit 3 ", teacherId: teacher.id, studentId: sid, keinName: true });
    assert.equal(v.woerter, 4);
    assert.equal(ki.gefragt.length, 1, "both pages in one request");
    const req = ki.gefragt[0];
    assert.equal(req.fn, "vokabelfoto");
    const teile = req.content as { type: string; base64?: string; text?: string }[];
    assert.deepEqual(teile.map((t) => t.type), ["image", "image", "text"]);
    assert.equal(teile[0].base64, SEITE_1.toString("base64"));
    assert.match(teile[2].text ?? "", /dieser 2 Seiten/);
    assert.match(teile[2].text ?? "", /Hinweis der Lehrkraft \(wählt nur aus\): nur Unit 3$/);
    const alles = JSON.stringify(req);
    assert.equal(alles.includes("Lina") || alles.includes("Muster"), false, "no name of the student");
    const call = db().prepare("SELECT fn, student_id, teacher_id FROM ai_calls ORDER BY id DESC LIMIT 1").get() as { fn: string; student_id: number; teacher_id: number };
    assert.deepEqual(call, { fn: "vokabelfoto", student_id: sid, teacher_id: teacher.id });
    assert.equal(listenVon(sid).length, 0, "no list before the teacher saves");
    assert.equal((db().prepare("SELECT COUNT(*) AS n FROM materials").get() as { n: number }).n, 0, "the photos are not kept");
    assert.equal(fs.readdirSync(process.env.UPLOADS_PATH!).length, 0);
    // without a hint no hint line; a PDF page goes as a PDF
    await liesVokabelFoto({ dateien: [PDF], teacherId: teacher.id, studentId: sid, keinName: true });
    const zweite = ki.gefragt[1].content as { type: string; text?: string }[];
    assert.equal(zweite[0].type, "pdf");
    assert.doesNotMatch(zweite[1].text ?? "", /Hinweis/);
  } finally {
    ki.aus();
  }
});

test("without KI the teacher types the words; a declining KI, a wrong file or too many pages give a sentence", async () => {
  const { teacher, sid } = await setup();
  const { vokabelFotoLesbar, liesVokabelFoto, kostenSchaetzung, MAX_VOKABEL_SEITEN } = await import("./vokabel-foto");
  const nein = vokabelFotoLesbar(sid);
  assert.match(!nein.ok ? nein.grund : "", /Tipp die Wörter bitte ein/);
  await assert.rejects(liesVokabelFoto({ dateien: [SEITE_1], teacherId: teacher.id, studentId: sid, keinName: true }), /Tipp die Wörter bitte ein/);
  process.env.AI_PROVIDER = "manual";
  try {
    assert.match((vokabelFotoLesbar(sid) as { grund: string }).grund, /keine Fotos lesen/);
    assert.deepEqual(kostenSchaetzung(), { grundCent: 0, seiteCent: 0 });
  } finally {
    delete process.env.AI_PROVIDER;
  }
  let ki = await mitKi(null);
  try {
    await assert.rejects(liesVokabelFoto({ dateien: [SEITE_1], teacherId: teacher.id, studentId: sid, keinName: true }), /nicht gelesen/);
  } finally {
    ki.aus();
  }
  ki = await mitKi();
  try {
    await assert.rejects(liesVokabelFoto({ dateien: [Buffer.from("kein Bild")], teacherId: teacher.id, studentId: sid, keinName: true }), /JPG, PNG, WebP/);
    await assert.rejects(liesVokabelFoto({ dateien: Array(MAX_VOKABEL_SEITEN + 1).fill(SEITE_1), teacherId: teacher.id, studentId: sid, keinName: true }), /Höchstens 6 Seiten/);
    assert.equal(ki.gefragt.length, 0);
    const k = kostenSchaetzung();
    assert.ok(k.seiteCent > 0 && k.seiteCent < 5, `about 1 to 3 cents per page, not ${k.seiteCent}`);
  } finally {
    ki.aus();
  }
});
