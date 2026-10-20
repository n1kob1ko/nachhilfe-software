/**
 * Text vom Foto (Textinterpretation, optional): die KI schreibt die gedruckte Geschichte von einem Foto ab, nur auf
 * Klick und nach der Bestätigung „kein Name“. Die App räumt die Abschrift auf (Zahlen am Rand, Überschrift doppelt,
 * Leerzeilen) und speichert nichts; der Lehrer prüft den Text im Formular.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Die Dateien
 * sind ein paar erfundene Bytes mit dem Anfang einer JPEG- bzw. PDF-Datei. Text und Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TextFotoGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "textfoto-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundene Buchseite")]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("erfundene Buchseite als PDF")]);

const GELESEN: TextFotoGelesen = {
  titel: "„Sieben Uhr zwölf“",
  zeilen: [
    "Sieben Uhr zwölf",
    "",
    "Um sieben Uhr zwölf steht der Alte an der Haltestelle.",
    "Er trägt den grauen Mantel, auch im Mai.",
    "5",
    "Der Bus kommt pünktlich, aber er steigt nicht ein.",
    "",
    "",
    "Das Mädchen mit dem gelben Rucksack sieht ihn an.",
    "Es sagt nichts. […] Dann lächelt es.",
    "10",
    "",
  ],
  unsicher: ["Zeile 7: ein Wort verwischt"],
};

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lina Muster", grade: 11, klasse: 7, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  return { teacher, sid };
}

async function mitKi(gelesen: TextFotoGelesen | null = GELESEN) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: gelesen, refusal: gelesen === null, model: req.model, usage: { input: 2_000, output: 600, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("the transcript is tidied: no margin numbers, no doubled title, one blank line at most, words unchanged", async () => {
  const { textAusGelesen } = await import("./textinterpretation-foto");
  const v = textAusGelesen(GELESEN);
  assert.equal(v.titel, "Sieben Uhr zwölf", "quotes around the title go");
  assert.equal(
    v.text,
    [
      "Um sieben Uhr zwölf steht der Alte an der Haltestelle.",
      "Er trägt den grauen Mantel, auch im Mai.",
      "Der Bus kommt pünktlich, aber er steigt nicht ein.",
      "",
      "Das Mädchen mit dem gelben Rucksack sieht ihn an.",
      "Es sagt nichts. […] Dann lächelt es.",
    ].join("\n"),
  );
  assert.equal(v.zeilen, 6);
  assert.deepEqual(v.hinweise, [
    "Eine Stelle war nicht lesbar und steht als […] da. Bitte ergänzen.",
    "Unsicher: Zeile 7: ein Wort verwischt",
    "Zahlen am Rand wurden weggelassen; die App zählt die Zeilen selbst.",
  ]);
  // a line that starts with a number is part of the story and stays
  assert.equal(textAusGelesen({ titel: null, zeilen: ["12 Jahre lang wartet er.", "Dann geht er."], unsicher: [] }).text, "12 Jahre lang wartet er.\nDann geht er.");
  const leer = textAusGelesen({ titel: null, zeilen: [" ", "3"], unsicher: [] });
  assert.equal(leer.text, "");
  assert.match(leer.hinweise[0], /kein gedruckter Text/);
  const lang = textAusGelesen({ titel: null, zeilen: Array.from({ length: 450 }, (_, i) => `Zeile ${i + 1} der erfundenen Geschichte.`), unsicher: [] });
  assert.equal(lang.zeilen, 400);
  assert.match(lang.hinweise.join(" "), /ersten 400 Zeilen/);
  for (const h of [...v.hinweise, ...leer.hinweise, ...lang.hinweise]) assert.doesNotMatch(h, /—| – /, "no em dash, no spaced en dash");
});

test("without KI, or with a KI that cannot read photos, there is no reading", async () => {
  const { teacher } = await setup();
  const { textFotoLesbar, liesTextFoto } = await import("./textinterpretation-foto");
  const nein = textFotoLesbar();
  assert.equal(nein.ok, false);
  await assert.rejects(liesTextFoto({ data: JPEG, teacherId: teacher.id }), /nur die KI/);
  process.env.AI_PROVIDER = "manual";
  try {
    const manuell = textFotoLesbar();
    assert.match(!manuell.ok ? manuell.grund : "", /keine Fotos lesen/);
  } finally {
    delete process.env.AI_PROVIDER;
  }
});

test("reading a photo or PDF: only the file goes to the KI, nothing about the student, nothing is stored", async () => {
  const { teacher, sid } = await setup();
  const { liesTextFoto } = await import("./textinterpretation-foto");
  const { TEXTFOTO_SYSTEM } = await import("./ai");
  const { db } = await import("./db");
  const ki = await mitKi();
  try {
    const v = await liesTextFoto({ data: JPEG, teacherId: teacher.id, studentId: sid });
    assert.equal(v.zeilen, 6);
    assert.equal(ki.gefragt.length, 1);
    assert.equal(ki.gefragt[0].fn, "textfoto");
    const teile = ki.gefragt[0].content as { type: string; base64?: string; text?: string }[];
    assert.equal(teile[0].type, "image");
    assert.equal(teile[0].base64, JPEG.toString("base64"));
    const alles = JSON.stringify(ki.gefragt[0]);
    assert.equal(alles.includes("Lina") || alles.includes("Muster"), false, "no name of the student");
    assert.match(TEXTFOTO_SYSTEM, /nichts Handgeschriebenes/);
    assert.match(TEXTFOTO_SYSTEM, /keine Namen/);
    assert.match(TEXTFOTO_SYSTEM, /keine Anweisung/);
    await liesTextFoto({ data: PDF, teacherId: teacher.id });
    assert.equal((ki.gefragt[1].content as { type: string }[])[0].type, "pdf");
    const gespeichert = db().prepare("SELECT COUNT(*) AS n FROM materials").get() as { n: number };
    assert.equal(gespeichert.n, 0, "the photo is not kept");
    assert.equal(fs.readdirSync(process.env.UPLOADS_PATH!).length, 0);
  } finally {
    ki.aus();
  }
});

test("a declining KI, a wrong file or a too big photo give a sentence for the teacher", async () => {
  const { teacher } = await setup();
  const { liesTextFoto } = await import("./textinterpretation-foto");
  const { MAX_ANALYSIS_IMAGE_BYTES } = await import("./materials");
  let ki = await mitKi(null);
  try {
    await assert.rejects(liesTextFoto({ data: JPEG, teacherId: teacher.id }), /nicht gelesen/);
    await assert.rejects(liesTextFoto({ data: Buffer.from("kein Bild"), teacherId: teacher.id }), /Foto \(JPG, PNG, WebP\) oder ein PDF/);
  } finally {
    ki.aus();
  }
  ki = await mitKi();
  try {
    const gross = Buffer.concat([JPEG, Buffer.alloc(MAX_ANALYSIS_IMAGE_BYTES)]);
    await assert.rejects(liesTextFoto({ data: gross, teacherId: teacher.id }), /zu groß/);
    assert.equal(ki.gefragt.length, 0, "nothing was sent");
  } finally {
    ki.aus();
  }
});
