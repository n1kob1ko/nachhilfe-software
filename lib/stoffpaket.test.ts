/**
 * Stoff vorbereiten (niko, 16.11.2026): Fotos vom Buch und ein Text → in einem Lauf Lernzettel, Übungsblatt, Test,
 * Vorbereitungstest und Lernpaket mit Präsentation. Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und
 * schreibt mit, was gefragt wurde. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "stoffpaket-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const KUE = "mathe.brueche.kuerzen";
const aufgabe = (o: Record<string, unknown>) => ({
  category: "rechnung", format: "calc", skill_ids: [KUE], topic: "Brüche kürzen", difficulty: "mittel", passage: null, options: null, correct_option: null,
  accepted_answers: null, numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null,
  text_errors: null, answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null,
  criteria: ["vollständig gekürzt"], solution: "", solution_steps: [], estimated_time_sec: 60, hints: ["Suche den größten gemeinsamen Teiler."], common_errors: [], ...o,
});
const BRUECHE = [["18/24", "3/4"], ["15/25", "3/5"], ["14/21", "2/3"], ["16/40", "2/5"], ["27/36", "3/4"], ["12/16", "3/4"], ["10/15", "2/3"], ["20/30", "2/3"], ["9/12", "3/4"]];
const kuerzen = (n: number, schwer = "mittel") => BRUECHE.slice(0, n).map(([b, e], i) => aufgabe({ prompt: `Kürze ${b} so weit wie möglich.`, accepted_answers: [e], solution: `${b} = ${e}`, difficulty: i === 0 ? schwer : "mittel" }));

const ANTWORT = () => ({
  thema: "Brüche kürzen",
  skill_ids: [KUE, "gibt.es.nicht"],
  unsicher: ["Seite 2 unten unscharf"],
  lernzettel: {
    titel: "Brüche kürzen",
    einleitung: "Kürzen heißt: Zähler und Nenner durch dieselbe Zahl teilen.",
    abschnitte: [
      { ueberschrift: "Was heißt kürzen?", text: "Der Wert bleibt gleich.\n\nNur die Zahlen werden kleiner.", merke: "Zähler und Nenner durch dieselbe Zahl.", beispiele: [{ aufgabe: "Kürze 12/18.", loesung: "12/18 = 2/3 (durch 6)" }] },
      { ueberschrift: "", text: "", merke: "", beispiele: [] },
    ],
    typische_fehler: ["Nur den Zähler teilen. Richtig: beide."],
  },
  unterricht: {
    ziel: "Brüche vollständig kürzen.",
    schritte: [
      { art: "einstieg", titel: "Pizza teilen", minuten: 5, lehrer_sagt: "Wir teilen eine Pizza.", lehrer_fragt: "", erwartete_antwort: "", bei_fehler: "", notiz: "" },
      { art: "erklaerung", titel: "Kürzen", minuten: 15, lehrer_sagt: "Zähler und Nenner durch dieselbe Zahl.", lehrer_fragt: "Was bleibt gleich?", erwartete_antwort: "der Wert", bei_fehler: "", notiz: "" },
      { art: "uebung", titel: "Üben", minuten: 20, lehrer_sagt: "Jetzt du.", lehrer_fragt: "", erwartete_antwort: "", bei_fehler: "", notiz: "" },
      { art: "kontrolle", titel: "Kontrolle", minuten: 10, lehrer_sagt: "Zeig, was du kannst.", lehrer_fragt: "", erwartete_antwort: "", bei_fehler: "", notiz: "" },
    ],
  },
  uebungsblatt: [aufgabe({ category: "gibtsnicht", prompt: "x" }), ...kuerzen(8)],
  test: kuerzen(6, "schwer"),
  vorbereitungstest: kuerzen(4),
  spielkarten: [
    { art: "wahl", frage: "Kürze 6/8.", richtig: "3/4", falsch: ["6/4", "3/8", "2/4"], teile: [], merke: "Zähler und Nenner durch 2." },
    { art: "wahl", frage: "Beim Kürzen bleibt der ___ gleich.", richtig: "Wert", falsch: ["Nenner"], teile: [], merke: "" },
    { art: "wahl", frage: "Kürze 10/15.", richtig: "2/3", falsch: ["1/3", "5/3"], teile: [], merke: "" },
    { art: "wahl", frage: "Kürze 9/12.", richtig: "3/4", falsch: ["3/3"], teile: [], merke: "" },
    { art: "reihe", frage: "Ordne die Schritte", richtig: "", falsch: [], teile: ["ggT suchen", "Zähler teilen", "Nenner teilen"], merke: "" },
    { art: "wahl", frage: "Kaputt", richtig: "", falsch: [], teile: [], merke: "" },
  ],
});

const block = (text: string) => ({ art: "text", text, punkte: [], zeilen: [], schritt: false });
const DECK = { titel: "Brüche kürzen", folien: [1, 2, 3, 4].map((n) => ({ titel: `Folie ${n}`, bloecke: [block("Kürzen heißt teilen.")], notiz: `Sag ${n}.`, schritte: [n], pruefen: [] })) };

async function mitKi(antwort: (req: AIRequest) => unknown = (req) => (req.fn === "praesentation" ? DECK : ANTWORT())) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    const parsed = antwort(req);
    return { parsed, refusal: parsed === null, model: req.model, usage: { input: 20_000, output: 12_000, cacheWrite: 0, cacheRead: 0, reasoning: 4_000 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { saveUpload } = await import("./materials");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Lena Testfrau", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const foto = (n: number) => saveUpload({ name: `seite-${n}.jpg`, data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundenes Foto ${n}`)]) }, { title: "Stoff vorbereiten", subject: "Mathematik", studentId: sid, teacherId: teacher.id }).id;
  return { repo, teacher, sid, foto };
}

test("without KI there is nothing to start: the reason is a plain sentence", async () => {
  const { sid, teacher, foto } = await setup();
  const sp = await import("./stoffpaket");
  const geht = sp.stoffpaketMoeglich({ studentId: sid, dateien: 1 });
  assert.equal(geht.ok, false);
  const r = sp.starteStoffpaket({ studentId: sid, teacherId: teacher.id, fach: "Mathematik", anweisung: "", materialIds: [foto(1)], teile: ["lernzettel"], keinName: true });
  assert.ok("fehler" in r && /KI/.test(r.fehler));
});

test("checks before anything is paid: Fach, files or text, „kein Name“, at least one part", async () => {
  const { sid, teacher, foto } = await setup();
  const ki = await mitKi();
  const sp = await import("./stoffpaket");
  const f = foto(1);
  const fehler = (e: Partial<Parameters<typeof sp.starteStoffpaket>[0]>) => {
    const r = sp.starteStoffpaket({ studentId: sid, teacherId: teacher.id, fach: "Mathematik", anweisung: "", materialIds: [f], teile: ["lernzettel"], keinName: true, ...e });
    return "fehler" in r ? r.fehler : "";
  };
  assert.match(fehler({ fach: "" }), /Fach/);
  assert.match(fehler({ materialIds: [], anweisung: "" }), /Fotos/);
  assert.match(fehler({ keinName: false }), /kein Name/);
  assert.match(fehler({ teile: [] }), /Teil/);
  assert.equal(ki.gefragt.length, 0);
  ki.aus();
});

test("one run: photos + text without names + what the app knows → Lernzettel, three sheets, Lernpaket and presentation", async () => {
  const { repo, sid, teacher, foto } = await setup();
  // a Schularbeit in two weeks: the test becomes its Probeschularbeit
  const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const testId = repo.addTest({ student_id: sid, date: in14, subject: "Mathematik", kind: "Schularbeit", topic: "Brüche", title: "1. SA", grade: null, points: null, max_points: null, notes: "", skill_ids: [], topics: ["Brüche"] } as never);
  const ki = await mitKi();
  const sp = await import("./stoffpaket");
  const r = sp.starteStoffpaket({ studentId: sid, teacherId: teacher.id, fach: "Mathematik", anweisung: "Lena verwechselt kürzen und erweitern. SA am 3.12.", materialIds: [foto(1), foto(2)], teile: [...sp.ALLE_TEILE], keinName: true });
  assert.ok("id" in r, JSON.stringify(r));
  await sp.warteAuf(r.id);
  const p = sp.getStoffpaket(r.id)!;
  assert.equal(p.status, "fertig", p.fehler);

  // what left the app
  const [anfrage, praes] = ki.gefragt;
  assert.equal(anfrage.fn, "stoffpaket");
  const teile = anfrage.content as { type: string; text?: string }[];
  assert.equal(teile.filter((t) => t.type === "image").length, 2);
  const text = teile.find((t) => t.type === "text")!.text!;
  assert.doesNotMatch(text, /Lena|Testfrau/);
  assert.match(text, /\[Name\] verwechselt kürzen/);
  assert.match(text, /Schularbeit am/);
  assert.match(text, /2\. Klasse Mittelschule \(Schulstufe 6\)/);
  assert.match(text, new RegExp(KUE.replace(/\./g, "\\.")));
  assert.equal(praes.fn, "praesentation");
  assert.doesNotMatch(JSON.stringify(praes.content), /Lena/);

  // the result
  assert.equal(p.thema, "Brüche kürzen");
  assert.deepEqual(p.skill_ids, [KUE]);
  assert.deepEqual(p.unsicher, ["Seite 2 unten unscharf"]);
  assert.equal(p.lernzettel?.abschnitte.length, 1, "the empty section is left out");
  const blaetter = sp.blaetterVon(p);
  assert.deepEqual(
    blaetter.map((b) => [b.blatt, b.anzahl]),
    [["vorbereitung", 4], ["uebung", 8], ["test", 6]],
  );
  assert.ok(p.weggelassen.some((w) => /unbekannter Aufgabentyp/.test(w)));
  const testBlatt = repo.getWorksheet(p.test_id!)!;
  assert.equal(testBlatt.status, "entwurf");
  assert.equal(testBlatt.kind, "ueberpruefung");
  assert.equal(p.pruefung_id, testId);
  // hard tasks last, like a Schularbeit
  assert.equal(repo.listTasks(p.test_id!).at(-1)!.difficulty, "schwer");
  assert.ok(p.paket_id && p.praes_entwurf_id);
  const { getLernpaket } = await import("./lernpakete");
  const paket = getLernpaket(p.paket_id!)!;
  assert.equal(paket.status, "entwurf");
  assert.equal(paket.schritte.find((s) => s.art === "uebung")!.aufgaben.length, 8);
  assert.equal(paket.schritte.reduce((s, x) => s + x.minuten, 0), 50);
  assert.equal(p.call_ids.length, 2);
  assert.ok(sp.kostenUsd(p) > 0);

  // the Vorbereitungstest runs like a test: one try, no hints
  const vorb = repo.assignWorksheet(p.vorbereitung_id!, sid);
  assert.equal(repo.getAssignment(vorb)!.mode, "test");
  ki.aus();
});

test("„Alles übernehmen“: package checked, presentation saved, chosen for the running unit, Lernzettel in the student app", async () => {
  const { sid, teacher, foto } = await setup();
  const units = await import("./units");
  const unit = units.startUnit(teacher.id, sid, { at: Date.now() - 5 * 60_000, subject: "Mathematik" }).unit;
  const ki = await mitKi();
  const sp = await import("./stoffpaket");
  const r = sp.starteStoffpaket({ studentId: sid, teacherId: teacher.id, unitId: unit.id, fach: "Mathematik", anweisung: "", materialIds: [foto(3)], teile: [...sp.ALLE_TEILE], keinName: true });
  assert.ok("id" in r);
  await sp.warteAuf(r.id);
  const out = sp.uebernimmStoffpaket(r.id, teacher.id);
  assert.ok("ok" in out, JSON.stringify(out));
  assert.match(out.ziel, /laufenden Einheit/);
  const p = sp.getStoffpaket(r.id)!;
  assert.equal(p.status, "uebernommen");
  const { getLernpaket } = await import("./lernpakete");
  assert.equal(getLernpaket(p.paket_id!)!.status, "geprueft");
  assert.ok(p.praesentation_id);
  const { leseStand } = await import("./cockpit");
  assert.equal(leseStand(unit.id).paket_id, p.paket_id);
  const portal = await import("./schuelerportal");
  assert.deepEqual(portal.lernzettelFuer(sid).map((z) => z.titel), ["Brüche kürzen"]);
  assert.ok(portal.praesentationFreigegeben(sid, p.praesentation_id!));
  // die Spielkarten sind jetzt im Spiel „Dein Stoff“ (lib/spielkarten.ts)
  const sk = await import("./spielkarten");
  const [satz] = sk.spielkartenVon(r.id);
  assert.equal(satz.karten, 5, "die kaputte Karte ist weggefallen");
  assert.equal(satz.aktiv, 1);
  assert.equal(satz.titel, "Brüche kürzen");
  assert.equal(sk.spielSatz(sid)?.id, satz.id);
  assert.ok(p.weggelassen.some((w) => /^Spielkarte 6:/.test(w)));
  ki.aus();
});

test("„Verwerfen“ removes the unsent drafts and archives the package; a failed KI answer says why", async () => {
  const { repo, sid, teacher, foto } = await setup();
  const ki = await mitKi();
  const sp = await import("./stoffpaket");
  const r = sp.starteStoffpaket({ studentId: sid, teacherId: teacher.id, fach: "Mathematik", anweisung: "Brüche kürzen", materialIds: [], teile: ["uebung", "praesentation"], keinName: false });
  assert.ok("id" in r, JSON.stringify(r));
  await sp.warteAuf(r.id);
  const p = sp.getStoffpaket(r.id)!;
  assert.equal(p.status, "fertig");
  assert.equal(p.test_id, null, "only the parts asked for");
  assert.equal(p.lernzettel, null);
  assert.ok(sp.verwirfStoffpaket(r.id));
  assert.equal(repo.getWorksheet(p.uebung_id!), null);
  const { getLernpaket } = await import("./lernpakete");
  assert.equal(getLernpaket(p.paket_id!)!.status, "archiviert");
  ki.aus();

  // Spielkarten eines Laufs sind bis „Alles übernehmen“ nicht im Spiel; „Verwerfen“ löscht sie
  const ki3 = await mitKi();
  const r3 = sp.starteStoffpaket({ studentId: sid, teacherId: teacher.id, fach: "Mathematik", anweisung: "Brüche kürzen", materialIds: [], teile: ["spielkarten"], keinName: false });
  assert.ok("id" in r3);
  await sp.warteAuf(r3.id);
  assert.equal(sp.getStoffpaket(r3.id)!.status, "fertig", "nur Spielkarten ist auch ein Ergebnis");
  const sk = await import("./spielkarten");
  assert.equal(sk.spielkartenVon(r3.id)[0].aktiv, 0);
  assert.equal(sk.spielSatz(sid), null);
  assert.ok(sp.verwirfStoffpaket(r3.id));
  assert.deepEqual(sk.spielkartenVon(r3.id), []);
  ki3.aus();

  const leer = await mitKi(() => ({ thema: "", skill_ids: [], unsicher: [], lernzettel: null, unterricht: null, uebungsblatt: [], test: [], vorbereitungstest: [] }));
  const r2 = sp.starteStoffpaket({ studentId: sid, teacherId: teacher.id, fach: "Mathematik", anweisung: "", materialIds: [foto(4)], teile: ["lernzettel", "uebung"], keinName: true });
  assert.ok("id" in r2);
  await sp.warteAuf(r2.id);
  const p2 = sp.getStoffpaket(r2.id)!;
  assert.equal(p2.status, "fehler");
  assert.match(p2.fehler, /nichts Brauchbares/);
  leer.aus();
});
