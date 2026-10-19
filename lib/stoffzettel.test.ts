/**
 * Stoffzettel (niko, 19.10.2026): Foto oder PDF vom Stoff einer Schularbeit. Die KI liest Art, Fach, Termin,
 * Bezeichnung und Stoff (nur nach der Bestätigung „kein Name darauf“), die App prüft das und füllt damit das
 * Formular; der Zettel hängt an der Schularbeit. Ohne KI wird er nur angehängt.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Die
 * Dateien sind ein paar erfundene Bytes mit dem Anfang einer JPEG- bzw. PDF-Datei. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StoffzettelGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "stoffzettel-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const HEUTE = "2026-10-19";
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundener Stoffzettel")]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("erfundener Stoffzettel als PDF")]);

const GELESEN: StoffzettelGelesen = {
  art: "2. Schularbeit",
  fach: "M",
  datum: "2026-11-12",
  titel: "2. Mathematik-Schularbeit",
  themen: ["1. Brüche kürzen, erweitern", "- Prozentrechnung", "Brüche kürzen", "Sachaufgaben mit Prozent"],
  unsicher: [],
};

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { saveUpload } = await import("./materials");
  const teacher = repo.listTeachers()[0];
  const neu = (name: string, subjects: string[]) =>
    repo.createStudent({ name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects, current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const sid = neu("Mia Probe", ["Mathematik", "Englisch"]);
  const andere = neu("Leo Beispiel", ["Deutsch"]);
  const upload = (data: Buffer, name: string, studentId = sid) => saveUpload({ name, data }, { title: "Stoffzettel", studentId, teacherId: teacher.id }).id;
  return { repo, teacher, sid, andere, upload };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `gelesen` (null = die KI lehnt ab). */
async function mitKi(gelesen: StoffzettelGelesen | null = GELESEN) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: gelesen, refusal: gelesen === null, model: req.model, usage: { input: 1_500, output: 200, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("the reading is checked: known kinds and subjects only, a real date close by, topics one by one", async () => {
  const { vorschlagAusGelesen, artVomZettel, fachVomZettel } = await import("./stoffzettel");
  const faecher = ["Mathematik", "Englisch"];

  const v = vorschlagAusGelesen(GELESEN, { heute: HEUTE, faecher });
  assert.equal(v.art, "Schularbeit");
  assert.equal(v.fach, "Mathematik", "M is Mathematik");
  assert.equal(v.datum, "2026-11-12");
  assert.equal(v.titel, "2. Mathematik-Schularbeit");
  assert.deepEqual(v.themen, ["Brüche kürzen", "erweitern", "Prozentrechnung", "Sachaufgaben mit Prozent"], "list marks gone, commas split, no doubles");
  assert.deepEqual(v.hinweise, []);

  assert.equal(artVomZettel("Vokabeltest Unit 3"), "Vokabeltest");
  assert.equal(artVomZettel("M-SA"), "Schularbeit");
  assert.equal(artVomZettel("mündliche Wiederholung"), "Mündliche Prüfung");
  assert.equal(artVomZettel("Lernzielkontrolle"), null, "an unknown kind stays empty");
  assert.equal(fachVomZettel("Bio", faecher), "Biologie", "a school subject outside the profile is fine");
  assert.equal(fachVomZettel("ENGLISCH", faecher), "Englisch");
  assert.equal(fachVomZettel("Kochen", faecher), null);

  const leer = vorschlagAusGelesen({ art: null, fach: "Kochen", datum: null, titel: null, themen: [], unsicher: ["Zeile 3 verwischt"] }, { heute: HEUTE, faecher });
  assert.deepEqual([leer.art, leer.fach, leer.datum, leer.titel, leer.themen], [null, null, null, "", []]);
  assert.deepEqual(leer.hinweise, ["Fach „Kochen“ nicht erkannt. Bitte wählen.", "Kein Datum gefunden. Bitte eintragen.", "Keinen Stoff gefunden. Bitte eintragen.", "Unsicher: Zeile 3 verwischt"]);

  const datum = (d: string) => vorschlagAusGelesen({ ...GELESEN, datum: d }, { heute: HEUTE, faecher });
  assert.equal(datum("2026-02-30").datum, null, "a day that does not exist");
  assert.match(datum("2026-02-30").hinweise[0], /gibt es nicht/);
  assert.equal(datum("12.11.2026").datum, null, "only YYYY-MM-DD");
  assert.equal(datum("2028-01-10").datum, null, "more than a year ahead");
  assert.equal(datum("2026-08-01").datum, null, "long past");
  assert.equal(datum("2026-10-10").datum, "2026-10-10", "a few days past is kept");
  assert.match(datum("2026-10-10").hinweise[0], /Vergangenheit/);

  const viele = vorschlagAusGelesen({ ...GELESEN, themen: Array.from({ length: 15 }, (_, i) => `Thema ${i + 1}`) }, { heute: HEUTE, faecher });
  assert.equal(viele.themen.length, 12);
  assert.match(viele.hinweise.join(" "), /ersten 12/);
});

test("without KI, or with a KI that cannot read photos, the sheet is only attached", async () => {
  const { upload, sid, teacher } = await setup();
  const { stoffzettelLesbar, liesStoffzettel } = await import("./stoffzettel");
  const nein = stoffzettelLesbar();
  assert.equal(nein.ok, false);
  assert.match(!nein.ok ? nein.grund : "", /nur die KI/);
  await assert.rejects(liesStoffzettel({ materialId: upload(JPEG, "zettel.jpg"), studentId: sid, teacherId: teacher.id, heute: HEUTE }), /nur die KI/);
  process.env.AI_PROVIDER = "manual";
  try {
    const manuell = stoffzettelLesbar();
    assert.match(!manuell.ok ? manuell.grund : "", /keine Fotos lesen/);
  } finally {
    delete process.env.AI_PROVIDER;
  }
});

test("reading a photo or a PDF: only the file, today's date and the subjects go to the KI, never a name", async () => {
  const { upload, sid, teacher } = await setup();
  const { liesStoffzettel } = await import("./stoffzettel");
  const ki = await mitKi();
  try {
    const foto = upload(JPEG, "zettel.jpg");
    const v = await liesStoffzettel({ materialId: foto, studentId: sid, teacherId: teacher.id, heute: HEUTE });
    assert.equal(v.fach, "Mathematik");
    assert.equal(v.datum, "2026-11-12");
    assert.equal(ki.gefragt.length, 1);
    assert.equal(ki.gefragt[0].fn, "stoffzettel");
    const teile = ki.gefragt[0].content as { type: string; base64?: string; text?: string }[];
    assert.equal(teile[0].type, "image");
    assert.equal(teile[0].base64, JPEG.toString("base64"));
    assert.match(teile[1].text ?? "", /Heute ist der 2026-10-19\. Fächer des Schülers bei uns: Mathematik, Englisch/);
    const alles = JSON.stringify(ki.gefragt[0]);
    assert.equal(alles.includes("Mia") || alles.includes("Probe"), false, "no name of the student");

    const pdf = upload(PDF, "stoff.pdf");
    await liesStoffzettel({ materialId: pdf, studentId: sid, teacherId: teacher.id, heute: HEUTE });
    assert.equal((ki.gefragt[1].content as { type: string }[])[0].type, "pdf");
  } finally {
    ki.aus();
  }
});

test("when the KI declines or the photo is too big, a sentence for the teacher, the sheet stays", async () => {
  const { upload, sid, teacher } = await setup();
  const { liesStoffzettel } = await import("./stoffzettel");
  const { getMaterial } = await import("./materials");
  const ki = await mitKi(null);
  try {
    const foto = upload(JPEG, "zettel.jpg");
    await assert.rejects(liesStoffzettel({ materialId: foto, studentId: sid, teacherId: teacher.id, heute: HEUTE }), /nicht gelesen/);
    assert.ok(getMaterial(foto), "the sheet is still there for a second try");
    const gross = upload(Buffer.concat([JPEG, Buffer.alloc(6 * 1024 * 1024)]), "gross.jpg");
    await assert.rejects(liesStoffzettel({ materialId: gross, studentId: sid, teacherId: teacher.id, heute: HEUTE }), /zu groß für die KI/);
    await assert.rejects(liesStoffzettel({ materialId: 9999, studentId: sid, teacherId: teacher.id, heute: HEUTE }), /gibt es nicht mehr/);
    assert.equal(ki.gefragt.length, 1, "too big and missing files never reach the KI");
  } finally {
    ki.aus();
  }
});

test("saved with the Schularbeit: the sheet gets its name and Stoff, deleting it keeps the Schularbeit", async () => {
  const { repo, upload, sid, andere, teacher } = await setup();
  const { stoffzettelFuer } = await import("./stoffzettel");
  const { getMaterial, deleteMaterial } = await import("./materials");

  const foto = upload(JPEG, "zettel.jpg");
  const t = { student_id: sid, title: "2. Mathematik-Schularbeit", kind: "Schularbeit", subject: "Mathematik", topics: ["Brüche kürzen", "Prozentrechnung"] };
  const id = stoffzettelFuer(foto, t);
  assert.equal(id, foto);
  const testId = repo.addTest({ ...t, date: "2026-11-12", topic: t.topics.join(", "), grade: null, points: null, max_points: null, notes: "", skill_ids: [], teacher_id: teacher.id, material_id: id });
  assert.equal(repo.getTest(testId)!.material_id, foto);
  const m = getMaterial(foto)!;
  assert.equal(m.title, "Stoffzettel 2. Mathematik-Schularbeit");
  assert.equal(m.subject, "Mathematik");
  assert.equal(m.topic, "Brüche kürzen, Prozentrechnung");
  assert.equal(m.student_id, sid);

  // a sheet of another student (the same file uploaded there first) is linked, but not renamed
  const fremd = upload(PDF, "fremd.pdf", andere);
  assert.equal(stoffzettelFuer(fremd, t), fremd);
  assert.equal(getMaterial(fremd)!.title, "Stoffzettel");
  assert.equal(stoffzettelFuer(0, t), null);
  assert.equal(stoffzettelFuer(9999, t), null);

  assert.equal(deleteMaterial(foto), true);
  assert.equal(repo.getTest(testId)!.material_id, null, "the Schularbeit stays, without the sheet");
});
