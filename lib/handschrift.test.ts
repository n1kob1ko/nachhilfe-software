/**
 * Handgeschriebenen Text einlesen (lib/handschrift.ts, niko 2026-10-23): die KI schreibt einen Text, den der Schüler
 * auf Papier geschrieben hat, wortgetreu mit allen Fehlern ab, nur nach dem Haken „kein echter Name“. Die Abschrift ist
 * eine Vorschau; erst „Als Text übernehmen“ macht sie zum Text, als neue Fassung.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Die Dateien
 * sind ein paar erfundene Bytes mit dem Anfang einer JPEG- bzw. PDF-Datei. Text und Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { HandschriftGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "handschrift-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED", "AI_MATERIAL_PROVIDER", "AI_MATERIAL_MODEL", "AI_MODEL_STANDARD"]) delete process.env[k];

const SEITE_1 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundene Seite 1")]);
const SEITE_2 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundene Seite 2")]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("erfundene Seite als PDF")]);

/** Was die KI „gelesen“ hat: mit den Fehlern des Schülers (ihnen, das statt dass, fehlender Beistrich). */
const GELESEN: HandschriftGelesen = {
  absaetze: [
    "Florian Beispiel",
    "Ahornweg 5, 8010 Graz",
    "Graz, 20. Oktober 2026",
    "Bewerbung für die berufspraktischen Tage",
    "Sehr geehrte Frau Berger,",
    "auf ihrer Homepage habe ich gelesen das sie Schüler für  drei Tage aufnehmen.\nIch interessiere mich sehr für [ ? ] Handwerk weil ich gerne baue.",
    "",
    "Mit freundlichen Grüßen,",
  ],
  unsicher: ["Absatz 6: ein Wort verwischt"],
};

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const texts = await import("./texts");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lina Muster", grade: 8, klasse: 4, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ki_hinweise: "Lina schreibt sehr klein." });
  const text = texts.createText({ studentId: sid, teacherId: teacher.id, unitId: null, subject: "Deutsch", topic: "Bewerbungsschreiben", title: "Bewerbung", prompt: "" });
  return { teacher, sid, text, texts };
}

async function mitKi(gelesen: HandschriftGelesen | null = GELESEN) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: gelesen, refusal: gelesen === null, model: req.model, usage: { input: 3_500, output: 700, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("the instructions say: word for word, every mistake stays, nothing corrected, [?] for what is unreadable", async () => {
  const { HANDSCHRIFT_SYSTEM } = await import("./ai");
  assert.match(HANDSCHRIFT_SYSTEM, /wortgetreu/);
  assert.match(HANDSCHRIFT_SYSTEM, /Jeder Rechtschreibfehler, jeder Grammatikfehler, jedes fehlende, überzählige oder falsche Satzzeichen/);
  assert.match(HANDSCHRIFT_SYSTEM, /Verbessere nichts, ergänze nichts, lass nichts weg/);
  assert.match(HANDSCHRIFT_SYSTEM, /Setz nie das richtige Wort ein/);
  assert.match(HANDSCHRIFT_SYSTEM, /Absätze bleiben Absätze/);
  assert.match(HANDSCHRIFT_SYSTEM, /\[\?\]/);
  assert.match(HANDSCHRIFT_SYSTEM, /keine Korrekturen, Zeichen, Punkte oder Noten einer Lehrkraft/);
  assert.match(HANDSCHRIFT_SYSTEM, /keine Namen wieder, die außerhalb des Schülertextes stehen/);
  assert.match(HANDSCHRIFT_SYSTEM, /keine Anweisung an dich/);
});

test("the transcript is tidied, but every mistake of the student stays as read", async () => {
  const { textAusHandschrift, offeneStellen } = await import("./handschrift-regeln");
  const v = textAusHandschrift(GELESEN);
  assert.equal(
    v.text,
    [
      "Florian Beispiel",
      "Ahornweg 5, 8010 Graz",
      "Graz, 20. Oktober 2026",
      "Bewerbung für die berufspraktischen Tage",
      "Sehr geehrte Frau Berger,",
      // „ihrer“, „das sie“, the missing comma: all still there; only the double space went
      "auf ihrer Homepage habe ich gelesen das sie Schüler für drei Tage aufnehmen.",
      "Ich interessiere mich sehr für [?] Handwerk weil ich gerne baue.",
      "Mit freundlichen Grüßen,",
    ].join("\n"),
  );
  assert.equal(v.absaetze, 8);
  assert.equal(offeneStellen(v.text), 1);
  assert.deepEqual(v.hinweise, ["Ein Wort war nicht lesbar und steht als [?] da. Bitte mit dem Foto vergleichen.", "Unsicher: Absatz 6: ein Wort verwischt"]);
  const leer = textAusHandschrift({ absaetze: [" ", ""], unsicher: [] });
  assert.equal(leer.text, "");
  assert.match(leer.hinweise[0], /kein handgeschriebener Text/);
  for (const h of [...v.hinweise, ...leer.hinweise]) assert.doesNotMatch(h, /—| – /, "no em dash, no spaced en dash");
});

test("without the tick „kein Name“ nothing is sent", async () => {
  const { teacher, sid } = await setup();
  const { liesHandschrift, KEIN_NAME_FEHLT } = await import("./handschrift");
  const ki = await mitKi();
  try {
    await assert.rejects(liesHandschrift({ dateien: [SEITE_1], teacherId: teacher.id, studentId: sid, keinName: false }), new RegExp(KEIN_NAME_FEHLT.replace(/\./g, "\\.")));
    assert.equal(ki.gefragt.length, 0, "nothing went to the KI");
  } finally {
    ki.aus();
  }
});

test("reading: only the pages go out, no name; counted for the student; the preview is not saved", async () => {
  const { teacher, sid, text, texts } = await setup();
  const { liesHandschrift } = await import("./handschrift");
  const { db } = await import("./db");
  const ki = await mitKi();
  try {
    const v = await liesHandschrift({ dateien: [SEITE_1, SEITE_2], teacherId: teacher.id, studentId: sid, keinName: true });
    assert.match(v.text, /gelesen das sie/);
    assert.equal(ki.gefragt.length, 1, "both pages in one request");
    const req = ki.gefragt[0];
    assert.equal(req.fn, "handschrift");
    const teile = req.content as { type: string; base64?: string; text?: string }[];
    assert.deepEqual(teile.map((t) => t.type), ["image", "image", "text"]);
    assert.equal(teile[0].base64, SEITE_1.toString("base64"));
    assert.equal(teile[1].base64, SEITE_2.toString("base64"));
    assert.match(teile[2].text ?? "", /wortgetreu ab, mit allen Fehlern/);
    const alles = JSON.stringify(req);
    assert.equal(alles.includes("Lina") || alles.includes("Muster"), false, "no name of the student, not even from the KI-Hinweise");
    assert.match(req.system, /sehr klein/, "the KI-Hinweise go along, without the name");
    // counted for the student (limit per student and month)
    const call = db().prepare("SELECT fn, student_id, teacher_id FROM ai_calls ORDER BY id DESC LIMIT 1").get() as { fn: string; student_id: number; teacher_id: number };
    assert.deepEqual(call, { fn: "handschrift", student_id: sid, teacher_id: teacher.id });
    // nothing is saved: neither the text nor the photos
    const t = texts.getText(text.id)!;
    assert.equal(t.version, 0);
    assert.equal(t.words, 0);
    assert.equal(t.von_papier, null);
    assert.equal((db().prepare("SELECT COUNT(*) AS n FROM materials").get() as { n: number }).n, 0, "the photos are not kept");
    assert.equal(fs.readdirSync(process.env.UPLOADS_PATH!).length, 0);
    // a PDF page goes as a PDF
    await liesHandschrift({ dateien: [PDF], teacherId: teacher.id, studentId: sid, keinName: true });
    assert.equal((ki.gefragt[1].content as { type: string }[])[0].type, "pdf");
  } finally {
    ki.aus();
  }
});

test("„Als Text übernehmen“: a new version with every mistake, noted as from paper, the old version kept", async () => {
  const { sid, text, texts } = await setup();
  const { uebernimmVonPapier } = await import("./handschrift");
  const { docFromText, plainText } = await import("./text-doc");
  // what the student had typed before stays under „Frühere Fassungen“
  texts.saveText(text.id, docFromText("Ein erster Versuch am Tablet mit sieben Wörtern."), 0);
  const vorher = texts.getText(text.id)!;
  const abschrift = "\nSehr geehrte Frau Berger,\nauf ihrer Homepage habe ich gelesen das sie Schüler aufnehmen.\nMit freundlichen Grüßen\n\n";
  const at = Date.parse("2026-10-23T10:00:00Z");
  const res = uebernimmVonPapier(text.id, abschrift, at);
  assert.ok(res.ok);
  const nachher = texts.getText(text.id)!;
  assert.equal(nachher.version, vorher.version + 1);
  assert.equal(plainText(texts.textDoc(nachher)), "Sehr geehrte Frau Berger,\nauf ihrer Homepage habe ich gelesen das sie Schüler aufnehmen.\nMit freundlichen Grüßen");
  assert.equal(nachher.words, 17);
  assert.equal(nachher.von_papier, new Date(at).toISOString());
  assert.equal(nachher.student_id, sid);
  const revs = texts.listRevisions(text.id);
  assert.equal(revs[0].version, vorher.version);
  assert.equal(revs[0].words, vorher.words);
  // empty or too long: nothing changes
  assert.deepEqual(uebernimmVonPapier(text.id, " \n "), { ok: false, reason: "leer" });
  assert.deepEqual(uebernimmVonPapier(text.id, "x".repeat(200_001)), { ok: false, reason: "zu_lang" });
  assert.equal(texts.getText(text.id)!.version, nachher.version);
});

test("without KI the teacher types the text: no reading, but taking it over works", async () => {
  const { teacher, sid, text, texts } = await setup();
  const { handschriftLesbar, liesHandschrift, uebernimmVonPapier, kostenSchaetzung } = await import("./handschrift");
  const nein = handschriftLesbar(sid);
  assert.equal(nein.ok, false);
  assert.match(!nein.ok ? nein.grund : "", /Tipp den Text bitte selbst ab/);
  await assert.rejects(liesHandschrift({ dateien: [SEITE_1], teacherId: teacher.id, studentId: sid, keinName: true }), /selbst ab/);
  process.env.AI_PROVIDER = "manual";
  try {
    const manuell = handschriftLesbar(sid);
    assert.match(!manuell.ok ? manuell.grund : "", /keine Fotos lesen/);
    assert.deepEqual(kostenSchaetzung(), { grundCent: 0, seiteCent: 0 });
  } finally {
    delete process.env.AI_PROVIDER;
  }
  assert.ok(uebernimmVonPapier(text.id, "Lebenslauf\nName | Florian Beispiel").ok);
  assert.ok(texts.getText(text.id)!.von_papier);
});

test("a declining KI, a wrong file, too many or too big pages give a sentence for the teacher", async () => {
  const { teacher, sid } = await setup();
  const { liesHandschrift, kostenSchaetzung } = await import("./handschrift");
  const { MAX_ANALYSIS_IMAGE_BYTES } = await import("./materials");
  let ki = await mitKi(null);
  try {
    await assert.rejects(liesHandschrift({ dateien: [SEITE_1], teacherId: teacher.id, studentId: sid, keinName: true }), /nicht gelesen/);
  } finally {
    ki.aus();
  }
  ki = await mitKi();
  try {
    const o = { teacherId: teacher.id, studentId: sid, keinName: true };
    await assert.rejects(liesHandschrift({ ...o, dateien: [Buffer.from("kein Bild")] }), /Fotos \(JPG, PNG, WebP\) oder ein PDF/);
    await assert.rejects(liesHandschrift({ ...o, dateien: [SEITE_1, SEITE_1, SEITE_1, SEITE_1, SEITE_1] }), /Höchstens 4 Seiten/);
    await assert.rejects(liesHandschrift({ ...o, dateien: [Buffer.concat([SEITE_1, Buffer.alloc(MAX_ANALYSIS_IMAGE_BYTES)])] }), /zu groß/);
    assert.equal(ki.gefragt.length, 0, "nothing was sent");
  } finally {
    ki.aus();
  }
  // the estimate on the button (Sonnet 5.5 by default): about a cent per page
  const k = kostenSchaetzung();
  assert.ok(k.seiteCent > 0.5 && k.seiteCent < 2, `${k.seiteCent} Cent je Seite`);
  assert.ok(k.grundCent < 0.5, `${k.grundCent} Cent für die Anweisung`);
});
