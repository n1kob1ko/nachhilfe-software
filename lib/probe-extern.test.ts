/**
 * Eigene Probeschularbeit (lib/probe-extern.ts): Angabe und Musterlösung, außerhalb der App gemacht, werden gelesen (zuerst der
 * Text eines PDFs, sonst auf Tippen die KI), über die Nummer zusammengeführt, geprüft und erst mit „Übernehmen“ eine
 * Probeschularbeit zur Schularbeit. Der Schüler schreibt sie am Gerät (Modus 'test') oder auf Papier (Arbeit fotografieren);
 * die Musterlösung geht nie an seine Seiten.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Die PDFs baut der Test
 * selbst (Text mit einfacher Schrift, dazu ein „eingescanntes“ ohne Text), die Fotos sind ein paar erfundene Bytes mit dem Anfang
 * einer JPEG-Datei. Alle Namen und Aufgaben sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BlattMitAufgabenGelesen, ProbeAngabeGelesen, ProbeLoesungGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";
import { eindeutigeFaehigkeit, liesLoesungMitNummern, liesTextMitNummern, loesungenEinfuegen, ohneProbeWort, zeilenAusLesung, type ProbeZeile } from "./probe-extern-regeln";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "probe-extern-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const BR = "mathe.brueche.addieren";
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundenes Foto einer gezeichneten Angabe")]);
/** Steht nur in der Musterlösung: darf nie auf einer Schülerseite stehen. */
const GEHEIM = "Musterweg 3/4 + 1/8 = 7/8";

// ---------- synthetic PDFs ----------

const winAnsi = (s: string) => [...s].map((c) => (c === "(" || c === ")" || c === "\\" ? `\\${c}` : c)).join("");
/** Ein PDF mit einer Seite: jede Zeile als Text in Helvetica (11 pt), oder ohne Text (nur ein Rechteck, wie gescannt). */
function pdf(zeilen: string[] | null): Buffer {
  const inhalt = zeilen ? zeilen.map((z, i) => `BT /F1 11 Tf 72 ${760 - i * 16} Td (${winAnsi(z)}) Tj ET`).join("\n") : "0.5 g 72 72 400 600 re f";
  const roh = Buffer.from(inhalt, "latin1");
  const objekte = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  const teile: Buffer[] = [Buffer.from("%PDF-1.7\n", "latin1")];
  const offsets: number[] = [];
  let pos = teile[0].length;
  objekte.forEach((o, i) => {
    offsets[i + 1] = pos;
    const b = o === null ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${roh.length} >>\nstream\n`, "latin1"), roh, Buffer.from("\nendstream\nendobj\n", "latin1")]) : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, "latin1");
    teile.push(b);
    pos += b.length;
  });
  let x = `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objekte.length; i++) x += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  teile.push(Buffer.from(`${x}trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`, "latin1"));
  return Buffer.concat(teile);
}

const ANGABE_TEXT = [
  "Probeschularbeit Brüche",
  "Name: ____________ Klasse: ____",
  "1. Familie Rechtl kauft Saft.",
  "a) Berechne 3/4 + 1/8. (2 P)",
  "b) Kürze 6/8 so weit wie möglich. (1 P)",
  "2. Wie viel sind 15 % von 80? (3 P)",
  "3. Erkläre, warum 2/4 und 1/2 gleich groß sind. (2 Punkte)",
];
const LOESUNG_TEXT = ["Musterlösung zur Probeschularbeit", "1a) Erweitern: 6/8 + 1/8 = 7/8", "1b) Gekürzt: 3/4", "2. Rechnung: 80 : 100 · 15 = 12"];
const L = { "1a": "Erweitern: 6/8 + 1/8 = 7/8", "1b": "Gekürzt: 3/4", "2": "Rechnung: 80 : 100 · 15 = 12" };

// ---------- setup ----------

async function setup() {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { saveUpload } = await import("./materials");
  const p = await import("./probe-extern");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({ name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const sid = schueler("Mira Rechtl");
  const pruefung = (studentId: number) =>
    repo.addTest({ student_id: studentId, date: "2099-11-20", subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [BR], title: "2. Schularbeit", topics: ["Brüche"], status: "geplant", teacher_id: teacher.id, material_id: null });
  const testId = pruefung(sid);
  const datei = (name: string, data: Buffer, studentId = sid) => saveUpload({ name, data }, { title: p.DATEI_TITEL.angabe, subject: "Mathematik", studentId, teacherId: teacher.id }).id;
  const zaehle = () => (db().prepare("SELECT COUNT(*) AS n FROM worksheets").get() as { n: number }).n;
  return { db, repo, p, teacher, schueler, sid, pruefung, testId, datei, zaehle };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet je nach Funktion und Systemprompt. */
async function mitKi(antwort: (req: AIRequest) => unknown) {
  process.env.ANTHROPIC_API_KEY = "test-nicht-echt";
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: antwort(req), refusal: false, model: req.model, usage: { input: 6_000, output: 1_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return {
    gefragt,
    aus: () => {
      router.setTransport(null);
      delete process.env.ANTHROPIC_API_KEY;
    },
  };
}

const KI_ANGABE: ProbeAngabeGelesen = {
  aufgaben: [
    { nr: "1", einleitung: "Familie Rechtl kauft Saft.", teile: [{ teil: "a", text: "Berechne 3/4 + 1/8.", punkte: 2, faehigkeit: BR }, { teil: "b", text: "Kürze 6/8 so weit wie möglich.", punkte: null, faehigkeit: "erfunden.gibt.es.nicht" }], unsicher: false, grund: "" },
    { nr: "Aufgabe 2", einleitung: "", teile: [{ teil: "", text: "Wie viel sind 15 % von 80?", punkte: 3, faehigkeit: null }], unsicher: false, grund: "" },
    // the reading itself is not sure about the number
    { nr: "3", einleitung: "", teile: [{ teil: "", text: "Erkläre, warum 2/4 und 1/2 gleich groß sind.", punkte: 2, faehigkeit: null }], unsicher: true, grund: "Die Nummer ist verwischt." },
  ],
  titel: "Probeschularbeit Brüche",
  unsicher: [],
};
const KI_LOESUNG: ProbeLoesungGelesen = {
  loesungen: [
    { nr: "1", teil: "a", loesung: GEHEIM, unsicher: false },
    { nr: "1", teil: "b)", loesung: "3/4", unsicher: false },
    // a solution to a task the Angabe does not have: never a row
    { nr: "7", teil: "", loesung: "42", unsicher: false },
  ],
  unsicher: [],
};
const antwortKi = (req: AIRequest) => (JSON.stringify(req).includes("Musterlösung einer Probeschularbeit ab") ? KI_LOESUNG : KI_ANGABE);

// ---------- rules ----------

test("rules: a numbered text becomes tasks with parts and points; the solution maps by number, missing is „Lösung fehlt“, unclear is unsure", () => {
  const a = liesTextMitNummern(ANGABE_TEXT);
  assert.equal(a.titel, "Probeschularbeit Brüche", "the head line is the title, the name line is left out");
  assert.deepEqual(
    a.aufgaben.map((x) => [x.nr, x.einleitung, x.teile.map((t) => [t.teil, t.text, t.punkte])]),
    [
      ["1", "Familie Rechtl kauft Saft.", [["a", "Berechne 3/4 + 1/8.", 2], ["b", "Kürze 6/8 so weit wie möglich.", 1]]],
      ["2", "", [["", "Wie viel sind 15 % von 80?", 3]]],
      ["3", "", [["", "Erkläre, warum 2/4 und 1/2 gleich groß sind.", 2]]],
    ],
  );
  const l = liesLoesungMitNummern(LOESUNG_TEXT);
  assert.deepEqual(l.loesungen.map((x) => [x.nr, x.teil, x.loesung]), [["1", "a", L["1a"]], ["1", "b", L["1b"]], ["2", "", L["2"]]]);

  const v = zeilenAusLesung(a, l, { erlaubt: new Set([BR]) });
  assert.deepEqual(v.zeilen.map((z) => [z.aufgabe, z.teil, z.punkte, z.loesung, z.unsicher]), [
    ["1", "a", 2, L["1a"], false],
    ["1", "b", 1, L["1b"], false],
    ["2", "", 3, L["2"], false],
    ["3", "", 2, "", false],
  ]);
  assert.ok(v.hinweise.some((h) => h.includes("Bei einer Teilaufgabe fehlt die Lösung")), "a missing solution is named, never invented");

  // a solution only for the whole task, a doubled number, a solution without a task
  const zwei = zeilenAusLesung(a, { loesungen: [{ nr: "1", teil: "", loesung: "a) 7/8 b) 3/4", unsicher: false }, { nr: "2", teil: "", loesung: "12", unsicher: false }, { nr: "2", teil: "", loesung: "12,0", unsicher: false }, { nr: "5", teil: "c", loesung: "x", unsicher: false }], unsicher: [] }, { erlaubt: new Set() });
  const [eins, zweiZeile] = [zwei.zeilen.find((z) => z.aufgabe === "1" && z.teil === "a")!, zwei.zeilen.find((z) => z.aufgabe === "2")!];
  assert.equal(eins.unsicher, true);
  assert.match(eins.grund, /nennt nur Aufgabe 1/);
  assert.equal(zweiZeile.unsicher, true, "two solutions to one number: unsure");
  assert.ok(zwei.hinweise.some((h) => h.includes("5c")), "a solution without a task is named");
  assert.equal(zwei.zeilen.length, 4, "never a row for a solution without a task");
  assert.ok(zwei.zeilen.slice(0, 2).every((z) => z.unsicher), "unsure rows first");

  // a number out of order is not a new task (a number inside the text), „Aufgabe 9“ out of order is one, but unsure
  const lose = liesTextMitNummern(["1. Rechne:", "12. März ist ein Datum.", "Aufgabe 9 Was fehlt?"]);
  assert.deepEqual(lose.aufgaben.map((x) => [x.nr, x.unsicher]), [["1", false], ["9", true]]);
  assert.match(lose.aufgaben[0].teile[0].text, /12\. März/);
});

test("rules: only the Musterlösung pasted fills the rows already there by number; a word match only when clearly ahead; no doubled title", () => {
  // the Angabe read from the PDF, the Musterlösung pasted (no KI): the solutions go in by number, the teacher's rows stay
  const ohne = zeilenAusLesung(liesTextMitNummern(ANGABE_TEXT), null, { erlaubt: new Set([BR]) });
  const zeilen = ohne.zeilen.map((z, k) => ({ ...z, k, punkte: z.aufgabe === "3" ? 4 : z.punkte, skillId: z.aufgabe === "1" ? BR : null }));
  const v = loesungenEinfuegen(zeilen, liesLoesungMitNummern(LOESUNG_TEXT));
  assert.deepEqual(
    v.zeilen.map((z) => [z.k, `${z.aufgabe}${z.teil}`, z.loesung, z.punkte, z.skillId, z.unsicher]),
    [
      [0, "1a", L["1a"], 2, BR, false],
      [1, "1b", L["1b"], 1, BR, false],
      [2, "2", L["2"], 3, null, false],
      [3, "3", "", 4, null, false],
    ],
  );
  assert.ok(v.hinweise.some((h) => h.includes("Bei einer Teilaufgabe fehlt die Lösung")), "a missing solution is named, never invented");
  assert.equal(zeilen[0].loesung, "", "the rows passed in are not changed");
  // the solution to 2 missing: „3)“ after „1b)“ is still task 3 when the Angabe has a 3, not the text of 1b
  const luecke = loesungenEinfuegen(zeilen, liesLoesungMitNummern(["1a) 7/8", "1b) 3/4", "3) Beide sind die Hälfte."], new Set([1, 2, 3])));
  assert.deepEqual(luecke.zeilen.map((z) => [`${z.aufgabe}${z.teil}`, z.loesung, z.unsicher]), [["1a", "7/8", false], ["1b", "3/4", false], ["2", "", false], ["3", "Beide sind die Hälfte.", false]]);
  assert.deepEqual(liesLoesungMitNummern(["1a) 7/8", "1b) 3/4", "3) Beide sind die Hälfte."]).loesungen.map((x) => `${x.nr}${x.teil}`), ["1a", "1b"], "without the Angabe's numbers a jump stays text");
  assert.equal(liesTextMitNummern(["1. Rechne:", "12. März ist ein Datum."], new Set([1, 2])).aufgaben.length, 1, "a number the Angabe does not have stays text");
  const ganz = loesungenEinfuegen(zeilen, { loesungen: [{ nr: "1", teil: "", loesung: "a) 7/8 b) 3/4", unsicher: false }, { nr: "7", teil: "", loesung: "x", unsicher: false }], unsicher: [] });
  assert.deepEqual(ganz.zeilen.slice(0, 2).map((z) => [`${z.aufgabe}${z.teil}`, z.unsicher]), [["1a", true], ["1b", true]], "a solution only for the whole task: unsure and first");
  assert.ok(ganz.hinweise.some((h) => h.includes("7")), "a solution without a task is named");

  // a word suggestion only when it is ahead of every other skill: a tie („berechnen“ in Prozentwert and Prozentsatz) gives none
  const P = "mathe.prozent.prozentwert";
  assert.equal(eindeutigeFaehigkeit([{ id: P, score: 1.1, via: "faehigkeit" }, { id: "mathe.prozent.prozentsatz", score: 1.1, via: "faehigkeit" }], new Set([P, BR])), null);
  assert.equal(eindeutigeFaehigkeit([{ id: "mathe.prozent.prozentsatz", score: 1.4, via: "faehigkeit" }, { id: P, score: 1.1, via: "faehigkeit" }], new Set([P])), null, "another skill is ahead");
  assert.equal(eindeutigeFaehigkeit([{ id: "mathe.brueche", score: 3, via: "thema" }, { id: BR, score: 2.2, via: "faehigkeit" }, { id: P, score: 1.1, via: "faehigkeit" }], new Set([P, BR])), BR);
  assert.equal(eindeutigeFaehigkeit([{ id: BR, score: 2.2, via: "thema" }], new Set([BR])), null, "only the Thema matched: no skill");
  assert.equal(eindeutigeFaehigkeit([], new Set([BR])), null);

  // the title of the sheet already says Probeschularbeit: not twice in „Mira – Probeschularbeit: …“
  assert.equal(ohneProbeWort("Probeschularbeit Brüche"), "Brüche");
  assert.equal(ohneProbeWort("Probeschularbeit: Brüche und Prozent"), "Brüche und Prozent");
  assert.equal(ohneProbeWort("probe-schularbeit – Gleichungen"), "Gleichungen");
  assert.equal(ohneProbeWort("Brüche"), "Brüche");
  assert.equal(ohneProbeWort("Probeschularbeit"), "");
  assert.equal(ohneProbeWort("Probeschularbeiten im Mai"), "Probeschularbeiten im Mai");
});

// ---------- reading ----------

test("a PDF with text is read by the app itself: rows filled, no KI call, nothing saved", async () => {
  const s = await setup();
  const ki = await mitKi(() => {
    throw new Error("no KI for a PDF with text");
  });
  try {
    const angabe = s.datei("probe_brueche.pdf", pdf(ANGABE_TEXT));
    const loesung = s.datei("loesung_brueche.pdf", pdf(LOESUNG_TEXT));
    const vorher = s.zaehle();
    const l = await s.p.liesProbe({ studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, angabeIds: [angabe], loesungIds: [loesung], ki: false });
    assert.equal(ki.gefragt.length, 0);
    assert.deepEqual(l.quelle, { angabe: "text", loesung: "text" });
    assert.deepEqual(l.offen, { angabe: 0, loesung: 0 }, "nothing left for the KI");
    assert.deepEqual(l.zeilen.map((z) => [`${z.aufgabe}${z.teil}`, z.loesung]), [["1a", L["1a"]], ["1b", L["1b"]], ["2", L["2"]], ["3", ""]]);
    // by the words only a skill of the Schularbeit itself is suggested: „15 % von 80“ is not guessed into some other skill
    assert.ok(l.zeilen.every((z) => z.skillId === null || z.skillId === BR), JSON.stringify(l.zeilen.map((z) => z.skillId)));
    assert.equal(s.zaehle(), vorher, "reading creates no exercise");
  } finally {
    ki.aus();
  }
});

test("photos and a scanned PDF: the cost first, then on the tap one KI call per field, no name, mapped by number; nothing saved before „Übernehmen“", async () => {
  const s = await setup();
  const angabe = s.datei("angabe.jpg", JPEG);
  const loesung = s.datei("loesung_scan.pdf", pdf(null));
  const ohne = await s.p.liesProbe({ studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, angabeIds: [angabe], loesungIds: [loesung], ki: false });
  assert.deepEqual(ohne.zeilen, [], "without KI the check view opens empty");
  assert.deepEqual(ohne.offen, { angabe: 1, loesung: 1 });
  const aus = s.p.probeTor(s.sid);
  assert.ok(!aus.erlaubt && /selbst ein/.test(aus.grund), "KI off: the teacher types the tasks");

  const ki = await mitKi(antwortKi);
  try {
    assert.ok(s.p.probeTor(s.sid).erlaubt);
    assert.match(s.p.kostenProbe(ohne.offen), /^Lesen kostet ca\. \d+ Cent$/, "the cost is shown before reading");
    assert.equal(ki.gefragt.length, 0, "showing the cost reads nothing");
    const vorher = s.zaehle();
    const l = await s.p.liesProbe({ studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, angabeIds: [angabe], loesungIds: [loesung], ki: true });
    assert.equal(ki.gefragt.length, 2, "one call for the Angabe, one for the Musterlösung");
    assert.ok(ki.gefragt.every((r) => r.fn === "probe"));
    const req = JSON.stringify(ki.gefragt);
    assert.ok(!/Mira|Rechtl/.test(req), "no name from the app goes to the KI");
    assert.ok(JSON.stringify(ki.gefragt[1]).includes("1a, 1b, 2, 3"), "the Musterlösung request knows the numbers of the Angabe");
    assert.deepEqual(l.quelle, { angabe: "ki", loesung: "ki" });

    assert.equal(l.zeilen.length, 4, "one row per part, none invented");
    assert.deepEqual([l.zeilen[0].aufgabe, l.zeilen[0].unsicher], ["3", true], "the unsure row first");
    assert.match(l.zeilen[0].grund, /verwischt/);
    const z = Object.fromEntries(l.zeilen.map((x) => [`${x.aufgabe}${x.teil}`, x]));
    assert.equal(z["1a"].loesung, GEHEIM);
    assert.equal(z["1b"].loesung, "3/4");
    assert.equal(z["2"].loesung, "", "Lösung fehlt");
    assert.equal(z["1a"].einleitung, "Familie Rechtl kauft Saft.");
    assert.equal(z["1a"].skillId, BR);
    assert.equal(z["1b"].skillId === "erfunden.gibt.es.nicht", false, "only skills from the list");
    assert.equal(z["1b"].punkte, null, "no points when none are printed");
    assert.ok(l.hinweise.some((h) => h.includes("7")), "the solution without a task is named");
    assert.equal(s.zaehle(), vorher, "reading creates no exercise");

    // the same files again: the router answers from memory, nothing is paid twice
    await s.p.liesProbe({ studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, angabeIds: [angabe], loesungIds: [loesung], ki: true });
    assert.equal(ki.gefragt.length, 2);
  } finally {
    ki.aus();
  }
});

// ---------- Übernehmen ----------

const fertig = (zeilen: ProbeZeile[]): ProbeZeile[] => zeilen.map((z) => ({ ...z, unsicher: false, punkte: z.punkte ?? 1 }));

test("„Übernehmen“: unsure rows and missing points block; then one task per part linked to the exam, with points, solution, number and source", async () => {
  const s = await setup();
  const angabe = s.datei("probe_brueche.pdf", pdf(ANGABE_TEXT));
  const loesung = s.datei("loesung_brueche.pdf", pdf(LOESUNG_TEXT));
  const l = await s.p.liesProbe({ studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, angabeIds: [angabe], loesungIds: [loesung], ki: false });
  // the sheet's own title already says Probeschularbeit: not twice in the exercise title
  const basis = { studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, titel: "Probeschularbeit Brüche", angabeIds: [angabe], loesungIds: [loesung], gelesen: "text" as const };

  const vorher = s.zaehle();
  const unsicher = s.p.uebernimmProbe({ ...basis, zeilen: l.zeilen.map((z, i) => ({ ...z, unsicher: i === 0 })) });
  assert.ok("error" in unsicher && /unsicher/.test(unsicher.error));
  const ohnePunkte = s.p.uebernimmProbe({ ...basis, zeilen: l.zeilen.map((z, i) => ({ ...z, punkte: i === 1 ? null : z.punkte })) });
  assert.ok("error" in ohnePunkte && /Punkte/.test(ohnePunkte.error));
  const doppelt = s.p.uebernimmProbe({ ...basis, zeilen: l.zeilen.map((z) => ({ ...z, aufgabe: "1", teil: "a" })) });
  assert.ok("error" in doppelt && /zweimal/.test(doppelt.error));
  const fremd = s.p.uebernimmProbe({ ...basis, zeilen: fertig(l.zeilen), testId: s.pruefung(s.schueler("Jonas Fremdl")) });
  assert.ok("error" in fremd && /anderen Schüler/.test(fremd.error));
  assert.equal(s.zaehle(), vorher, "nothing is created before a valid „Übernehmen“");

  // shown unsure first, saved in the order of the sheet
  const out = s.p.uebernimmProbe({ ...basis, zeilen: fertig([...l.zeilen].reverse()) });
  assert.ok("worksheetId" in out, JSON.stringify(out));
  const w = s.repo.getWorksheet(out.worksheetId)!;
  assert.equal(w.probe_test_id, s.testId);
  assert.equal(w.student_id, s.sid);
  assert.equal(w.title, "Mira – Probeschularbeit: Brüche");
  assert.deepEqual(s.p.externDaten(w), { angabe: [angabe], loesung: [loesung], datei: "probe_brueche.pdf", gelesen: "text" });
  const tasks = s.repo.listTasks(w.id);
  assert.deepEqual(tasks.map((t) => t.data.nummer), ["1a", "1b", "2", "3"]);
  assert.ok(tasks.every((t) => t.type === "free" && t.quelle === "eigene Probeschularbeit (Datei probe_brueche.pdf)"));
  assert.equal(tasks[0].prompt, "Aufgabe 1: Familie Rechtl kauft Saft.\n\na) Berechne 3/4 + 1/8.");
  assert.equal(tasks[2].prompt, "Aufgabe 2: Wie viel sind 15 % von 80?");
  assert.deepEqual(tasks.map((t) => [t.solution, t.answer.sample]), [[L["1a"], L["1a"]], [L["1b"], L["1b"]], [L["2"], L["2"]], ["", ""]]);
  const { punkteDerAufgaben } = await import("./probeschularbeit");
  assert.deepEqual([...punkteDerAufgaben(w.id).values()], [2, 1, 3, 2]);
  assert.equal(s.repo.getTest(s.testId)!.status, "geplant", "the exam stays as it is; no date or exam is made");
  assert.equal(s.repo.listTests(s.sid).length, 1);
});

/** A worksheet taken over from the reading above, with the KI's Musterlösung. */
async function uebernommen(s: Awaited<ReturnType<typeof setup>>) {
  const angabe = s.datei("probe.pdf", pdf(ANGABE_TEXT));
  const zeilen: ProbeZeile[] = [
    { aufgabe: "1", teil: "a", einleitung: "Familie Rechtl kauft Saft.", text: "Berechne 3/4 + 1/8.", punkte: 2, loesung: GEHEIM, skillId: BR, unsicher: false, grund: "" },
    { aufgabe: "1", teil: "b", einleitung: "Familie Rechtl kauft Saft.", text: "Kürze 6/8.", punkte: 1, loesung: "3/4", skillId: BR, unsicher: false, grund: "" },
    { aufgabe: "2", teil: "", einleitung: "", text: "Wie viel sind 15 % von 80?", punkte: 3, loesung: "12", skillId: null, unsicher: false, grund: "" },
  ];
  const out = s.p.uebernimmProbe({ studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, titel: "Brüche", zeilen, angabeIds: [angabe], loesungIds: [], gelesen: "hand" });
  assert.ok("worksheetId" in out);
  return out.worksheetId;
}

test("student side: the Musterlösung never reaches the device, not before and not after an answer; graded by the teacher, teilweise is half, the grade from the Notenschlüssel", async () => {
  const s = await setup();
  const wid = await uebernommen(s);
  const aid = s.repo.assignWorksheet(wid, s.sid);
  assert.equal(s.repo.getAssignment(aid)!.mode, "test", "on the device like a Schularbeit");
  const { clientTasks } = await import("./solver-tasks");
  const { submitAnswer } = await import("./service");
  const { ergebnis } = await import("./probeschularbeit");
  const geheim = (x: unknown) => JSON.stringify(x).includes(GEHEIM) || JSON.stringify(x).includes("Musterweg");
  assert.equal(geheim(clientTasks(s.repo.getAssignment(aid)!)), false, "not in the tasks before");
  s.repo.setFreigabe(aid, "alles");
  assert.equal(geheim(clientTasks(s.repo.getAssignment(aid)!)), false, "not even with „Alles“ released");

  const student = s.repo.getStudent(s.sid)!;
  const tasks = s.repo.listTasks(wid);
  const antworten = ["7/8", "6/8", "15"];
  for (const [i, t] of tasks.entries()) {
    const r = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: antworten[i], timeMs: 30_000, hintsUsed: 0 });
    assert.equal(geheim(r), false, "not in the answer to a submission");
    assert.equal(r.pendingReview, true, "a free answer waits for the teacher, never wrong by wording");
  }
  assert.equal(geheim(clientTasks(s.repo.getAssignment(aid)!)), false, "not after the answers either");
  assert.equal(ergebnis(aid)!.note, null, "no grade before the teacher graded");

  const { reviewAnswer } = await import("./service");
  const finals = s.repo.listAttemptsForAssignment(aid).filter((a) => a.final);
  const bewertung = ["richtig", "teilweise", "falsch"];
  finals.forEach((a, i) => assert.ok(!("error" in reviewAnswer(a.id, bewertung[i], s.teacher.id))));
  const e = ergebnis(aid)!;
  assert.equal(e.erreicht, 2.5, "2 for 1a, half of 1 for 1b, 0 for 2");
  assert.equal(e.gesamt, 6);
  assert.equal(e.note?.note, 5, "2,5 of 6 is Nicht genügend with the standard key");
});

test("on paper: Arbeit fotografieren offers the Probeschularbeit, reads it against its numbers and the Musterlösung, half points and the grade in the Abschluss", async () => {
  const s = await setup();
  const wid = await uebernommen(s);
  const units = await import("./units");
  const papier = await import("./papier-einheit");
  const unit = units.startUnit(s.teacher.id, s.sid, { subject: "Mathematik", at: Date.now() - 20 * 60_000 }).unit;
  const blatt = papier.blaetterDerEinheit(unit.id).find((b) => b.worksheetId === wid);
  assert.ok(blatt, "the Probeschularbeit is a sheet of the unit");
  assert.equal(blatt.art, "probe");
  assert.deepEqual(blatt.aufgaben.map((a) => a.nr), ["1a", "1b", "2"], "the numbers of the sheet");
  assert.equal(blatt.aufgaben[0].loesung, GEHEIM, "the teacher (and the reading) get the Musterlösung");

  const lesung: BlattMitAufgabenGelesen = {
    aufgaben: [
      { nr: 1, antwort: "7/8", rechenweg: [], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
      { nr: 2, antwort: "6/8", rechenweg: [], bewertung: "teilweise", unsicher: false, grund: "Nicht ganz gekürzt.", punkte: null },
      { nr: 3, antwort: "", rechenweg: [], bewertung: "nicht_lesbar", unsicher: true, grund: "Verwischt.", punkte: null },
    ],
    anderes_blatt: false,
  };
  const ki = await mitKi(() => lesung);
  try {
    const seite = (await import("./materials")).saveUpload({ name: "seite.jpg", data: JPEG }, { title: "Gelöstes Blatt", subject: "Mathematik", studentId: s.sid, teacherId: s.teacher.id }).id;
    const v = await papier.liesPapier({ unitId: unit.id, blattKey: blatt.key, materialIds: [seite], teacherId: s.teacher.id });
    const req = JSON.stringify(ki.gefragt[0]);
    assert.ok(req.includes("auf dem Blatt: 1a") && req.includes("auf dem Blatt: 1b"), "the KI finds the answers by the sheet's numbers");
    assert.ok(req.includes(GEHEIM), "graded against the Musterlösung");
    assert.ok(!/Mira|Rechtl/.test(req.replace("Familie Rechtl", "")) && !req.includes("Mira"), "no name of the student");
    assert.equal(v.zeilen[0].nr, "2", "the unreadable row first");
    assert.equal(v.zeilen[0].offen, true, "unreadable is never wrong: the teacher decides");

    const zeilen = v.zeilen.map((z) => (z.nr === "2" ? { ...z, bewertung: "falsch" as const, offen: false, pruefen: false } : z));
    const out = papier.speicherePapier({ unitId: unit.id, teacherId: s.teacher.id, blatt: blatt.key, zeilen, materialIds: [seite], gelesen: "ki" });
    assert.ok("papierId" in out, JSON.stringify(out));
    const { ergebnis } = await import("./probeschularbeit");
    const e = ergebnis(out.assignmentId)!;
    assert.deepEqual([e.erreicht, e.gesamt, e.note?.note], [2.5, 6, 5]);
    assert.equal(s.repo.getAssignment(out.assignmentId)!.mode, "test");

    const ab = await import("./abschluss");
    const { endUnit } = await import("./learning");
    const lesson = s.repo.getLesson(endUnit(unit.id, { byTeacherId: s.teacher.id })!)!;
    const b = ab.belegeDerEinheit(unit.id, lesson);
    assert.deepEqual(b.papier, [], "the Probeschularbeit has its own line instead of the paper line");
    assert.equal(b.minitest, null, "a Probeschularbeit is no Minitest");
    const zeile = "Probeschularbeit „Brüche“ auf Papier: 2,5 von 6 Punkten, Note 5 (Nicht genügend)";
    assert.deepEqual(b.proben?.map(ab.probeZeile), [zeile]);
    assert.ok(ab.abschlussKarte(null, null, [], b).gemacht.some((z) => z.text === zeile && z.von === "papier"), "the line stands under „Heute gemacht“");
  } finally {
    ki.aus();
  }
});

test("only this student's files and exams; another student's file is never read or taken over", async () => {
  const s = await setup();
  const andere = s.schueler("Jonas Fremdl");
  const fremd = s.datei("fremd.pdf", pdf(ANGABE_TEXT), andere);
  await assert.rejects(s.p.liesProbe({ studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, angabeIds: [fremd], loesungIds: [], ki: false }), /Angabe hochladen/);
  await assert.rejects(s.p.liesProbe({ studentId: s.sid, testId: s.pruefung(andere), teacherId: s.teacher.id, angabeIds: [s.datei("a.pdf", pdf(ANGABE_TEXT))], loesungIds: [], ki: false }), /anderen Schüler/);
  const out = s.p.uebernimmProbe({ studentId: s.sid, testId: s.testId, teacherId: s.teacher.id, titel: "", zeilen: fertig(zeilenAusLesung(liesTextMitNummern(ANGABE_TEXT), null).zeilen), angabeIds: [fremd], loesungIds: [], gelesen: "hand" });
  assert.ok("error" in out && /Angabe/.test(out.error));
});
