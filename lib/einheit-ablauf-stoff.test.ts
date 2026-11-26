/**
 * Geführter Ablauf, neues Thema mit Fotos (niko, 26.11.2026): Fotos → ein Lauf von „Stoff vorbereiten“ → „Übernehmen und
 * erklären“ → die Schritte des Lernpakets in „Erklären“ → das Übungsblatt aus dem Stoff ans Tablet → Dokumentation. Kein
 * Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "ablauf-stoff-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const KUE = "mathe.brueche.kuerzen";
const aufgabe = (o: Record<string, unknown>) => ({
  category: "rechnung", format: "calc", skill_ids: [KUE], topic: "Brüche kürzen", difficulty: "mittel", passage: null, options: null, correct_option: null,
  accepted_answers: null, numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null,
  text_errors: null, answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null,
  criteria: ["vollständig gekürzt"], solution: "", solution_steps: [], estimated_time_sec: 60, hints: ["Suche den größten gemeinsamen Teiler."], common_errors: [], ...o,
});
const BRUECHE = [["18/24", "3/4"], ["15/25", "3/5"], ["14/21", "2/3"], ["16/40", "2/5"], ["27/36", "3/4"], ["12/16", "3/4"], ["10/15", "2/3"], ["20/30", "2/3"]];
const kuerzen = () => BRUECHE.map(([b, e]) => aufgabe({ prompt: `Kürze ${b} so weit wie möglich.`, accepted_answers: [e], solution: `${b} = ${e}` }));

const schritt = (art: string, titel: string, o: Record<string, string> = {}) => ({ art, titel, minuten: 10, lehrer_sagt: `${titel}: so geht es.`, lehrer_fragt: "", erwartete_antwort: "", bei_fehler: "", notiz: "", ...o });
const ANTWORT = () => ({
  thema: "Brüche kürzen",
  skill_ids: [KUE],
  unsicher: [],
  lernzettel: { titel: "Brüche kürzen", einleitung: "Kürzen heißt teilen.", abschnitte: [{ ueberschrift: "Kürzen", text: "Der Wert bleibt gleich.", merke: "", beispiele: [] }], typische_fehler: [] },
  unterricht: {
    ziel: "Brüche vollständig kürzen.",
    schritte: [
      schritt("einstieg", "Pizza teilen"),
      schritt("erklaerung", "Kürzen"),
      schritt("frage", "Kurz gefragt", { lehrer_fragt: "Kürze 6/8.", erwartete_antwort: "3/4" }),
      schritt("uebung", "Üben"),
      schritt("kontrolle", "Kontrolle"),
    ],
  },
  uebungsblatt: kuerzen(),
  test: [],
  vorbereitungstest: [],
  spielkarten: [],
});
const block = (text: string) => ({ art: "text", text, punkte: [], zeilen: [], schritt: false });
const DECK = { titel: "Brüche kürzen", folien: [1, 2, 3].map((n) => ({ titel: `Folie ${n}`, bloecke: [block("Kürzen heißt teilen.")], notiz: `Sag ${n}.`, schritte: [n], pruefen: [] })) };

test("neues Thema mit Fotos: Stoff vorbereiten in der Einheit → übernehmen → Schritte erklären → Übungsblatt → Dokumentation", async () => {
  const router = await import("./ai/router");
  router.resetRouter();
  router.setTransport(async (req: AIRequest) => {
    const parsed = req.fn === "praesentation" ? DECK : ANTWORT();
    return { parsed, refusal: false, model: req.model, usage: { input: 20_000, output: 12_000, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  const repo = await import("./repo");
  const units = await import("./units");
  const ab = await import("./einheit-ablauf");
  const sp = await import("./stoffpaket");
  const cockpit = await import("./cockpit");
  const { saveUpload } = await import("./materials");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Mira Fotofrau", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(teacher.id, sid, { at: Date.now() - 30 * 60_000, subject: "Mathematik" }).unit;
  ab.waehleWeg(unit.id, "neu");
  assert.equal(ab.stoffpaketDerEinheit(unit.id), null);
  assert.ok("fehler" in ab.stoffUebernehmen(unit.id, teacher.id), "nothing to take over yet");

  // the big button in „Stoff“: photos → one run (presentation, Übungsblatt, Lernzettel)
  const foto = saveUpload({ name: "buch.jpg", data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundenes Foto")]) }, { title: "Stoff vorbereiten", subject: "Mathematik", studentId: sid, teacherId: teacher.id }).id;
  const r = sp.starteStoffpaket({ studentId: sid, teacherId: teacher.id, unitId: unit.id, fach: "Mathematik", anweisung: "", materialIds: [foto], teile: ["praesentation", "uebung", "lernzettel"], keinName: true });
  assert.ok("id" in r, JSON.stringify(r));
  assert.equal(ab.stoffpaketDerEinheit(unit.id)?.status, "laeuft");
  await sp.warteAuf(r.id);
  const p = ab.stoffpaketDerEinheit(unit.id)!;
  assert.equal(p.status, "fertig", p.fehler);
  assert.equal(ab.offenesStoffBlatt(unit.id), null, "not before it is taken over");

  // „Übernehmen und erklären“: the package is the unit's flow, its topics are today's, Erklären starts at the first step
  assert.deepEqual(ab.stoffUebernehmen(unit.id, teacher.id), { ok: true });
  assert.equal(sp.getStoffpaket(r.id)!.status, "uebernommen");
  const paket = ab.erklaerPaket(unit.id)!;
  assert.ok(paket, "the package explains");
  assert.equal(cockpit.leseStand(unit.id).paket_id, p.paket_id);
  const schritte = ab.erklaerSchritte(paket);
  assert.deepEqual(schritte.map((s) => s.art), ["einstieg", "erklaerung", "frage"], "Übung and Kontrolle are done at the tablet");
  const a = ab.leseAblauf(unit.id);
  assert.deepEqual([a.stufe, a.skillIds, a.aktuell, a.schrittId], ["erklaeren", [KUE], KUE, schritte[0].id]);

  // „Weiter“ through the steps; a practice step of the package is no step of „Erklären“
  const uebung = paket.schritte.find((s) => s.art === "uebung")!;
  assert.ok("fehler" in ab.setzeSchritt(unit.id, uebung.id));
  assert.deepEqual(ab.setzeSchritt(unit.id, schritte[2].id), { ok: true });
  assert.equal(cockpit.setzeAntwort(unit.id, schritte[2].id, "richtig"), true);

  // „Verstanden: Übungen ans Tablet senden“: the Übungsblatt from the photos first (what app/ablauf-actions.ts does)
  const blatt = ab.offenesStoffBlatt(unit.id);
  assert.equal(blatt, p.uebung_id);
  const aid = repo.assignWorksheet(blatt!, sid, "", unit.id);
  assert.equal(ab.offenesStoffBlatt(unit.id), null, "sent once");
  assert.equal(ab.uebenStand(unit.id).letzte?.assignmentId, aid);
  assert.equal(ab.uebenStand(unit.id).letzte?.auswertung.aufgaben, 8);

  // the documentation: what was explained, not „Lernpaket: 0 von 5 Schritten“
  const { endUnit } = await import("./learning");
  const lessonId = endUnit(unit.id)!;
  const lesson = repo.getLesson(lessonId)!;
  assert.match(lesson.activities, /Erklärt mit Präsentation: „Brüche kürzen“, 3 von 3 Schritten; Fragen: 1 richtig\./);
  assert.doesNotMatch(lesson.activities, /Lernpaket „/);
  assert.equal(lesson.next_steps.includes("Weiter mit „"), false);
  router.setTransport(null);
});
