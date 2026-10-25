/**
 * Prüfungsstoff (niko, 25.10.2026: „Stoff erkennen“): mehrere Unterlagen einer Prüfung in einer Anfrage gelesen, der
 * Stoffzettel legt den Umfang fest, das Inhaltsverzeichnis ergänzt nur, Ausgeschlossenes bleibt ausgeschlossen, und
 * die Zuordnung zu Fähigkeiten erzwingt nichts. Dazu die „Vorgabe für heute“ (lib/vorgabe.ts) im Unterricht.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und antwortet mit einer von Hand geschriebenen
 * Antwort (lib/fixtures/stoff-englisch-more.ts, nach zwei echten Fotos). Die Dateien hier sind ein paar erfundene
 * Bytes mit dem Anfang einer JPEG-Datei. Alle Namen sind erfunden.
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
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "pruefungsstoff-"));
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR",
])
  delete process.env[k];

const HEUTE = "2026-10-25";
let n = 0;
const jpeg = (extra = 0) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundenes Blatt ${++n}`), Buffer.alloc(extra)]);

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { saveUpload } = await import("./materials");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Mia Probe", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Englisch", "Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const upload = (data: Buffer = jpeg()) => saveUpload({ name: "blatt.jpg", data }, { title: "Stoffzettel", studentId: sid, teacherId: teacher.id }).id;
  return { repo, teacher, sid, upload };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `antwort` (null = die KI lehnt ab). */
async function mitKi(antwort: PruefungsstoffGelesen | null | ((req: AIRequest) => PruefungsstoffGelesen | null) = STOFF_ENGLISCH_MORE) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    const a = typeof antwort === "function" ? antwort(req) : antwort;
    return { parsed: a, refusal: a === null, model: req.model, usage: { input: 6_500, output: 3_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

const teile = (req: AIRequest) => req.content as { type: string; text?: string }[];
const finde = <T extends { original: string }>(xs: T[], original: string) => {
  const x = xs.find((p) => p.original === original);
  assert.ok(x, `„${original}“ fehlt`);
  return x!;
};

test("both documents in one request: the Stoffzettel sets the scope, the table of contents adds details, nothing is lost or invented", async () => {
  const { sid, upload, teacher } = await setup();
  const ps = await import("./pruefungsstoff");
  const zettel = upload();
  const inhalt = upload();
  const ki = await mitKi();
  try {
    const r = await ps.liesPruefungsstoff({ materialIds: [zettel, inhalt], studentId: sid, teacherId: teacher.id, heute: HEUTE, fach: "Englisch" });
    assert.equal(ki.gefragt.length, 1, "one request for both files");
    assert.equal(ki.gefragt[0].fn, "stoffzettel");
    assert.equal(teile(ki.gefragt[0]).filter((t) => t.type === "image").length, 2);
    const text = teile(ki.gefragt[0]).find((t) => t.type === "text")!.text!;
    assert.match(text, /Dateien: 2 \(Dokument 1 bis 2/);
    assert.match(text, /englisch\.tenses\.presentprogressive \| Present Progressive .*Present Continuous/, "the skills go along with their other names");
    assert.equal(text.includes("Mia"), false, "no name from the app");

    const l = r.lesung;
    assert.equal(r.neu, true);
    assert.deepEqual(l.dokumente.map((d) => d.rolle), ["stoffzettel", "inhaltsverzeichnis"]);
    assert.deepEqual([l.kopf.art, l.kopf.fach, l.kopf.datum], ["Test", "Englisch", "2026-11-06"]);
    assert.equal(l.punkte.length, STOFF_ENGLISCH_MORE.punkte.length, "nothing lost");
    assert.equal(l.weggelassen, 0);
    for (const p of l.punkte) assert.ok(STOFF_ENGLISCH_MORE.punkte.some((x) => x.original === p.original), `nothing invented: ${p.original}`);
    assert.ok(l.punkte.every((p) => !/unit\s*[4-9]/i.test(`${p.einheit} ${p.original}`)), "Units 1–3 only");

    // what the Stoffzettel excludes stays excluded, also in the table of contents
    for (const o of ["videos (Stones, Twins etc.)", "songs"]) assert.equal(finde(l.punkte, o).status, "ausgeschlossen");
    for (const o of ["MORE! A song 4 U: Where did you go?", "MORE! A song 4 U: When they come after you", "The Story of the Stones 1: It’s only a dream", "The Twins 1: The bike tour (apologising / expressing strong dislike)"]) {
      const p = finde(l.punkte, o);
      assert.equal(p.status, "ausgeschlossen", o);
      assert.match(p.grund, /^Laut Stoffzettel nicht Stoff/);
      assert.equal(p.skill_id, null);
    }
    // a unit's title is scope, never a skill
    const titel = finde(l.punkte, "Unit 2: How embarrassing!");
    assert.equal(titel.gruppe, "umfang");
    assert.equal(titel.skill_id, null);
    assert.equal(finde(l.punkte, "continuous").status, "pruefung", "Present Continuous is Prüfungsstoff");
    assert.equal(finde(l.punkte, "should / shouldn’t").status, "unklar", "should/shouldn't is still to clarify");
    const hoot = finde(l.punkte, "Class reader Hoot");
    assert.equal(hoot.gruppe, "lektuere");
    assert.equal(hoot.status, "pruefung");
    assert.equal(finde(l.punkte, "Vocabulary: School subjects").quelle, "inhaltsverzeichnis");
    assert.equal(finde(l.punkte, "school subjects").quelle, "stoffzettel");
    // the topics for the field „Stoff“ come from the Stoffzettel, not from the table of contents
    assert.ok(l.kopf.themen.includes("Present Continuous"));
    assert.equal(l.kopf.themen.includes("Hörtext: ein Stundenplan"), false);
  } finally {
    ki.aus();
  }
});

test("mapping: clear ones linked, unclear ones to confirm, a unit title or the class reader never a skill, writing types mapped", async () => {
  const { sid, upload, teacher, repo } = await setup();
  const ps = await import("./pruefungsstoff");
  const ki = await mitKi();
  try {
    const r = await ps.liesPruefungsstoff({ materialIds: [upload(), upload()], studentId: sid, teacherId: teacher.id, heute: HEUTE, fach: "Englisch" });
    const testId = repo.addTest({ student_id: sid, date: "2026-11-06", subject: "Englisch", kind: "Test", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "1st test", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
    const zeilen = ps.stoffAusLesung(testId, r.id);
    assert.equal(zeilen.length, r.lesung.punkte.length, "every point is stored, also without a skill");
    const z = (o: string) => finde(zeilen, o);

    for (const [o, id] of [
      ["present tense simple", "englisch.tenses.presentsimple"],
      ["continuous", "englisch.tenses.presentprogressive"],
      ["past tense simple", "englisch.tenses.pastsimple"],
      ["signal words (z.B. right now, usually, last week)", "englisch.tenses.simple-progressive"],
      ["yes/no-questions and questions with question words", "englisch.grammar.fragen"],
      ["irregular verbs", "englisch.vocab.irregular"],
      ["picture story", "englisch.writing.story"],
      ["email", "englisch.writing.email"],
      ["answer to an email", "englisch.writing.email"],
      ["daily routines", "englisch.vocab.tagesablauf"],
      ["the word order", "englisch.grammar.wortstellung"],
    ] as const) {
      assert.equal(z(o).zuordnung, "sicher", o);
      assert.equal(z(o).skill_id, id, o);
    }
    // the KI and the words disagree: a short confirmation, both offered
    const fragen = z("statements/ questions/ negation");
    assert.equal(fragen.zuordnung, "unklar");
    assert.equal(fragen.skill_id, null);
    assert.equal(fragen.vorschlaege[0], "englisch.tenses.presentsimple.fragen");
    // no skill fits: stays Prüfungsstoff without one, nothing forced
    for (const o of ["dialogue", "invitation", "postcard", "school subjects", "Halloween"]) {
      assert.equal(z(o).skill_id, null, o);
      assert.equal(z(o).status, "pruefung", o);
    }
    assert.equal(z("Unit 2: How embarrassing!").skill_id, null);
    assert.equal(z("Unit 2: How embarrassing!").zuordnung, "keine");
    assert.equal(z("Class reader Hoot").skill_id, null);
    assert.equal(z("Class reader Hoot").status, "pruefung", "Hoot is kept");

    const t = repo.getTest(testId)!;
    for (const id of ["englisch.tenses.presentprogressive", "englisch.writing.story", "englisch.writing.email"]) assert.ok(t.skill_ids.includes(id), id);
    assert.equal(t.skill_ids.includes("englisch.grammar.modal-basics"), false, "should/shouldn't is unclear: not counted yet");
    assert.equal(t.skill_ids.includes("englisch.vocab.gefuehle"), false, "a unit title never");
    assert.equal(t.lesung_id, r.id);

    // confirm: the chosen skill counts, and the choice is remembered for the same words
    assert.ok(ps.bestaetigeZuordnung(testId, fragen.id, "englisch.tenses.presentsimple.fragen", teacher.id));
    assert.ok(ps.setzeStatus(testId, z("should / shouldn’t").id, "pruefung"));
    const nachher = repo.getTest(testId)!;
    assert.ok(nachher.skill_ids.includes("englisch.tenses.presentsimple.fragen"));
    assert.ok(nachher.skill_ids.includes("englisch.grammar.modal-basics"), "„Gehört dazu“ counts it");
    const wieder = ps.ordneZu([{ ...finde(r.lesung.punkte, "statements/ questions/ negation") }], { fach: "Englisch", student: repo.getStudent(sid)!, ki: true });
    assert.equal(wieder[0].zuordnung, "sicher", "remembered for the next sheet");
  } finally {
    ki.aus();
  }
});

test("the scope: a point of the table of contents from Unit 4 is left out when the Stoffzettel names Units 1–3", async () => {
  const ps = await import("./pruefungsstoff");
  const mit4 = { ...STOFF_ENGLISCH_MORE, punkte: [...STOFF_ENGLISCH_MORE.punkte, { gruppe: "grammatik" as const, original: "Present perfect", inhalt: "Present Perfect", einheit: "Unit 4", dokument: 2, status: "pruefung" as const, grund: null, skill_id: "englisch.tenses.presentperfect" }] };
  const l = ps.lesungAusAntwort(mit4, { dateien: 2 });
  assert.equal(l.punkte.some((p) => p.original === "Present perfect"), false);
  assert.equal(l.weggelassen, 1);
  assert.deepEqual([...ps.unitsImUmfang(["More Units 1-3"])], [1, 2, 3]);
  // on the Stoffzettel itself nothing is dropped
  const aufZettel = ps.lesungAusAntwort({ ...mit4, punkte: mit4.punkte.map((p) => (p.original === "Present perfect" ? { ...p, dokument: 1 } : p)) }, { dateien: 2 });
  assert.ok(aufZettel.punkte.some((p) => p.original === "Present perfect"));
});

test("the same files are never paid twice: cached by content and prompt version, also without KI afterwards", async () => {
  const { sid, upload, teacher } = await setup();
  const ps = await import("./pruefungsstoff");
  const a = upload();
  const b = upload();
  const ki = await mitKi();
  let erst: { id: number };
  try {
    erst = await ps.liesPruefungsstoff({ materialIds: [a, b], studentId: sid, teacherId: teacher.id, heute: HEUTE, fach: "Englisch" });
    const zweit = await ps.liesPruefungsstoff({ materialIds: [b, a], studentId: sid, teacherId: teacher.id, heute: HEUTE, fach: "Englisch" });
    assert.equal(ki.gefragt.length, 1, "a cache hit makes no second call");
    assert.equal(zweit.neu, false);
    assert.equal(zweit.id, erst.id);
    assert.ok(ps.getLesung(erst.id)!.callId, "the call is linked for its cost");
  } finally {
    ki.aus();
  }
  const ohne = await ps.liesPruefungsstoff({ materialIds: [a, b], studentId: sid, teacherId: teacher.id, heute: HEUTE, fach: "Englisch" });
  assert.equal(ohne.id, erst.id, "the stored reading, KI off");
  assert.equal(ohne.neu, false);
  assert.notEqual(ps.lesungsSchluessel({ hashes: ["x"], angabe: "", kandidaten: [] }), ps.lesungsSchluessel({ hashes: ["x"], angabe: "anders", kandidaten: [] }));
});

test("limits: at most 8 files, a photo too big for the KI, only photos and PDFs", async () => {
  const { sid, upload, teacher } = await setup();
  const ps = await import("./pruefungsstoff");
  const ki = await mitKi();
  try {
    const neun = Array.from({ length: 9 }, () => upload());
    await assert.rejects(ps.liesPruefungsstoff({ materialIds: neun, studentId: sid, teacherId: teacher.id, heute: HEUTE }), /Höchstens 8/);
    await assert.rejects(ps.liesPruefungsstoff({ materialIds: [upload(jpeg(6 * 1024 * 1024))], studentId: sid, teacherId: teacher.id, heute: HEUTE }), /zu groß/);
    await assert.rejects(ps.liesPruefungsstoff({ materialIds: [], studentId: sid, teacherId: teacher.id, heute: HEUTE }), /Bitte Fotos wählen/);
    assert.equal(ki.gefragt.length, 0);
    assert.equal(ps.MAX_DATEIEN, 8);
  } finally {
    ki.aus();
  }
});

test("budget used up or the student's limit reached: no call and a clear sentence", async () => {
  const { sid, upload, teacher } = await setup();
  const ps = await import("./pruefungsstoff");
  const ki = await mitKi();
  try {
    await ps.liesPruefungsstoff({ materialIds: [upload()], studentId: sid, teacherId: teacher.id, heute: HEUTE });
    assert.equal(ki.gefragt.length, 1);
    process.env.AI_STUDENT_LIMIT_EUR = "0.000001";
    await assert.rejects(ps.liesPruefungsstoff({ materialIds: [upload()], studentId: sid, teacherId: teacher.id, heute: HEUTE }), /KI-Grenze für diesen Schüler/);
    delete process.env.AI_STUDENT_LIMIT_EUR;
    process.env.AI_MONTHLY_BUDGET_USD = "0.000001";
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "0.000001";
    await assert.rejects(ps.liesPruefungsstoff({ materialIds: [upload()], studentId: sid, teacherId: teacher.id, heute: HEUTE }), /Budget/);
    assert.equal(ki.gefragt.length, 1, "no second call");
  } finally {
    delete process.env.AI_STUDENT_LIMIT_EUR;
    delete process.env.AI_MONTHLY_BUDGET_USD;
    delete process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
    ki.aus();
  }
});

// ---------- Vorgabe für heute ----------

async function einheit() {
  const s = await setup();
  const units = await import("./units");
  const unit = units.startUnit(s.teacher.id, s.sid, { subject: "Englisch" }).unit;
  return { ...s, unit };
}

test("without KI: the teacher's text still becomes the Vorgabe, files are attached, a date is only offered", async () => {
  const { unit, upload, teacher, repo, sid } = await einheit();
  const vg = await import("./vorgabe");
  const r = vg.regelLesung("Heute Present Simple und Signal Words. Er tut sich schwer mit Fragen. Nächste Woche Test.");
  assert.deepEqual(r.punkte.map((p) => p.inhalt), ["Present Simple", "Signal Words", "Fragen"]);
  assert.deepEqual(r.schwierigkeiten, ["Er tut sich schwer mit Fragen."]);
  assert.match(r.termin_text ?? "", /Test nächste Woche/i);

  const blatt = upload();
  const out = await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Present Simple und Signal Words. Nächste Woche Test.", materialIds: [blatt], testId: null, keinName: true, heute: HEUTE });
  assert.ok("ok" in out);
  const v = vg.vorgabeDerEinheit(unit.id)!;
  assert.deepEqual(v.materialIds, [blatt], "the file is attached");
  assert.match(v.hinweis, /nicht eingerichtet/);
  assert.ok(v.skillIds.includes("englisch.tenses.simple-progressive"), "Signal Words found by the words");
  assert.equal(v.punkte.every((p) => p.quelle === "lehrer"), true);
  assert.match(v.terminText, /nächste Woche/i);
  assert.equal(repo.listTests(sid).length, 0, "a date is never entered by itself");
  assert.deepEqual(vg.pruefungAusVorgabe(unit.id, { datum: "", art: "Test", teacherId: teacher.id, heute: HEUTE }), { fehler: "Bitte ein Datum ab heute wählen." });
  const neu = vg.pruefungAusVorgabe(unit.id, { datum: "2026-11-02", art: "Test", teacherId: teacher.id, heute: HEUTE });
  assert.ok("ok" in neu);
  assert.equal(repo.getTest(neu.testId)!.date, "2026-11-02");
  assert.equal(vg.vorgabeDerEinheit(unit.id)!.terminText, "", "offered once");
});

test("the Vorgabe ranks above the Prüfung, switches the plan only before the first step, otherwise „Plan anpassen“", async () => {
  const { unit, teacher, repo, sid } = await einheit();
  const cockpit = await import("./cockpit");
  const vg = await import("./vorgabe");
  const auto = await import("./vorbereitung-auto");
  repo.addTest({ student_id: sid, date: "2026-11-03", subject: "Englisch", kind: "Test", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["englisch.tenses.pastsimple"], title: "", topics: ["Past Simple"], status: "geplant", teacher_id: teacher.id, material_id: null });
  // without a Vorgabe: as before
  assert.equal(auto.vorgabeSignal(unit.id, "Englisch"), null);
  const vorher = cockpit.planDerEinheit(unit.id);
  assert.ok(vorher.some((s) => /Schularbeit vorbereiten/.test(s.titel)), "the near Prüfung leads without a Vorgabe");

  await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Present Continuous und Fragen", materialIds: [], testId: null, keinName: false, heute: HEUTE });
  assert.equal(auto.SIGNAL_RANG.vorgabe > auto.SIGNAL_RANG.pruefung, true);
  const w = auto.autoFuerEinheit((await import("./units")).getUnit(unit.id)!);
  assert.ok(w && w.art !== "ohne_signal" && w.signal.art === "vorgabe");
  assert.equal(vg.vorgabeDerEinheit(unit.id)!.angewendet, true, "nothing done yet: the plan follows at once");
  const plan = cockpit.planDerEinheit(unit.id);
  assert.deepEqual(plan.slice(1, -1).map((s) => s.titel), ["Üben: Present Progressive"], "the exact name of a skill is clear without KI");
  const [klar, offen] = vg.vorgabeDerEinheit(unit.id)!.punkte;
  assert.equal(klar.zuordnung, "sicher");
  assert.equal(offen.zuordnung, "unklar", "„Fragen“ is not forced onto a skill: to confirm on the card");
  assert.ok(offen.vorschlaege.includes("englisch.tenses.presentsimple.fragen"));
  assert.ok(vg.bestaetigeVorgabe(unit.id, new Map([[1, "englisch.tenses.presentsimple.fragen"]]), teacher.id));
  assert.deepEqual(vg.vorgabeDerEinheit(unit.id)!.skillIds, ["englisch.tenses.presentprogressive", "englisch.tenses.presentsimple.fragen"]);
  assert.equal(cockpit.planDerEinheit(unit.id).filter((s) => s.titel.startsWith("Üben")).length, 2, "confirmed: the plan follows, nothing done yet");
  assert.equal(plan.some((s) => /Schularbeit vorbereiten/.test(s.titel)), false);

  // a step done: a new Vorgabe does not change the running plan by itself
  const erster = cockpit.cockpit(unit.id, { mitPlan: true }).plan[0];
  assert.ok(cockpit.markiereSchritt(unit.id, erster.id, "erledigt"));
  await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Irregular Verbs", materialIds: [], testId: null, keinName: false, heute: HEUTE });
  assert.equal(vg.vorgabeDerEinheit(unit.id)!.angewendet, false);
  assert.ok(cockpit.leseStand(unit.id).erledigt.includes(erster.id), "progress kept");
  assert.deepEqual(vg.wendeVorgabeAn(unit.id, { erzwingen: true }), { angewendet: true });
  const neu = cockpit.cockpit(unit.id, { mitPlan: true });
  assert.deepEqual(neu.stand.erledigt, [], "„Plan anpassen“ starts again");
  assert.ok(neu.plan.some((s) => s.titel === "Üben: Irregular verbs"));

  vg.entferneVorgabe(unit.id);
  assert.equal(vg.vorgabeDerEinheit(unit.id), null);
});

test("Abweichung: what the Stoffzettel also asks for and today does not plan, in one sentence", async () => {
  const { unit, teacher, repo, sid, upload } = await einheit();
  const ps = await import("./pruefungsstoff");
  const vg = await import("./vorgabe");
  const ki = await mitKi();
  let lesungId: number;
  try {
    lesungId = (await ps.liesPruefungsstoff({ materialIds: [upload(), upload()], studentId: sid, teacherId: teacher.id, heute: HEUTE, fach: "Englisch" })).id;
  } finally {
    ki.aus();
  }
  const testId = repo.addTest({ student_id: sid, date: "2026-11-06", subject: "Englisch", kind: "Test", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "1st test", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
  ps.stoffAusLesung(testId, lesungId);
  await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Present Simple, Present Continuous und Signal Words. Dazu Songs.", materialIds: [], testId: null, keinName: false, heute: HEUTE });
  const v = vg.vorgabeDerEinheit(unit.id)!;
  const p = vg.pruefungZurVorgabe(v, "Englisch", HEUTE)!;
  assert.equal(p.testId, testId);
  const abw = vg.abweichung(v.punkte, v.skillIds, p, "Englisch");
  assert.match(abw[0], /^Laut Stoffzettel auch .*Past Simple.* – heute nicht geplant\.$/);
  assert.match(abw[0], /Writing/);
  assert.equal(/Present Continuous|Signal Words/.test(abw[0]), false, "what is planned is not listed");
  assert.match(abw[1] ?? "", /^Laut Stoffzettel nicht Stoff: Songs/);
});

test("the teacher's text goes without names; files are read only after the tick", async () => {
  const { unit, teacher, upload } = await einheit();
  const vg = await import("./vorgabe");
  const ki = await mitKi((req) => ({ ...STOFF_ENGLISCH_MORE, dokumente: [], punkte: [{ gruppe: "grammatik", original: "Past Simple", inhalt: "Past Simple", einheit: null, dokument: 0, status: "pruefung", grund: null, skill_id: "englisch.tenses.pastsimple" }], schwierigkeiten: teile(req).some((t) => t.type === "image") ? ["Bild"] : [] }));
  try {
    const out = await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Mia übt heute Past Simple", materialIds: [upload()], testId: null, keinName: false, heute: HEUTE });
    assert.ok("ok" in out);
    assert.equal(ki.gefragt.length, 1);
    assert.equal(teile(ki.gefragt[0]).some((t) => t.type === "image"), false, "no tick: the photo is only attached");
    assert.equal(JSON.stringify(ki.gefragt[0]).includes("Mia"), false, "the name is masked");
    const v = vg.vorgabeDerEinheit(unit.id)!;
    assert.deepEqual(v.skillIds, ["englisch.tenses.pastsimple"]);
    assert.match(v.hinweis, /kein Name/);
  } finally {
    ki.aus();
  }
});
