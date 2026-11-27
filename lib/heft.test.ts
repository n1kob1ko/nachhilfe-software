/**
 * Heft am Tablet (lib/heft.ts, niko 26.11.2026): eine Mathe-Übung kommt als karierte Seite, der Schüler schreibt mit dem Stift,
 * beim „Fertig“ liest die KI alle Aufgaben in EINER Anfrage gegen die Original-Aufgaben, die App prüft nach und übernimmt selbst:
 * sicher gelesen zählt, unsicher wartet auf den Lehrer. Kein Schlüssel, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BlattMitAufgabenGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";
import type { TaskDraft } from "./tasks";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "heft-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("erfundene Heftseite")]);
const BR = "mathe.brueche.addieren";
const draft = (o: Partial<TaskDraft> & Pick<TaskDraft, "type" | "prompt" | "answer">): TaskDraft => ({ skillId: BR, skillIds: [BR], difficulty: "mittel", data: {}, solution: "", hints: [], errorMap: [], ...o });
const AUFGABEN: TaskDraft[] = [
  draft({ type: "calc", prompt: "1/2 + 1/4 = ?", answer: { accepted: ["3/4"], mode: "value" } }),
  draft({ type: "calc", prompt: "1/3 + 1/3 = ?", answer: { accepted: ["2/3"], mode: "value" } }),
  draft({ type: "calc", prompt: "1/5 + 2/5 = ?", answer: { accepted: ["3/5"], mode: "value" } }),
];
const LESUNG: BlattMitAufgabenGelesen = {
  aufgaben: [
    { nr: 1, antwort: "3/4", rechenweg: ["2/4 + 1/4"], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
    { nr: 2, antwort: "2/6", rechenweg: [], bewertung: "falsch", unsicher: false, grund: "Nenner addiert.", punkte: null },
    { nr: 3, antwort: "3/5", rechenweg: [], bewertung: "richtig", unsicher: true, grund: "Die Ziffer ist undeutlich.", punkte: null },
  ],
  anderes_blatt: false,
};

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const heft = await import("./heft");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lena Rechtl", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik", at: Date.now() - 20 * 60_000 }).unit;
  const ws = repo.createWorksheet(
    { title: "Lena – Brüche addieren", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [BR], status: "freigegeben", student_id: sid },
    AUFGABEN,
  );
  const aid = repo.assignWorksheet(ws, sid, "", unit.id);
  return { repo, units, heft, teacher, sid, unit, aid };
}

async function mitKi(antwort: BlattMitAufgabenGelesen | null) {
  process.env.ANTHROPIC_API_KEY = "test-nicht-echt";
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    if (!antwort) throw new Error("KI nicht erreichbar");
    return { parsed: antwort, refusal: false, model: req.model, usage: { input: 6_000, output: 900, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return {
    gefragt,
    aus: () => {
      router.setTransport(null);
      delete process.env.ANTHROPIC_API_KEY;
    },
  };
}

test("only with a KI that reads pictures, only Mathe, never on the student's own laptop", async () => {
  const s = await setup();
  assert.equal(s.heft.gehtAlsHeft(s.unit), false, "no KI: no Heft (nobody would check it)");
  const ki = await mitKi(LESUNG);
  try {
    assert.equal(s.heft.gehtAlsHeft(s.unit), true);
    assert.equal(s.heft.gehtAlsHeft({ ...s.unit, subject: "Deutsch" }), false);
  } finally {
    ki.aus();
  }
});

test("strokes are kept to the page: unknown tasks drop, numbers stay on the page, too much is refused", async () => {
  const s = await setup();
  s.heft.alsHeft(s.aid);
  const h = s.heft.getHeft(s.aid)!;
  assert.equal(h.titel, "Brüche addieren", "no first name on the page");
  assert.deepEqual(h.aufgaben.map((a) => [a.nr, a.urteil]), [["1", null], ["2", null], ["3", null]]);
  assert.deepEqual(h.felder.map((f) => [f.hoehe, f.striche.length]), [[520, 0], [520, 0], [520, 0]]);
  const [t1, t2] = h.aufgaben.map((a) => a.taskId);
  const f = s.heft.bereinige([{ taskId: t1, hoehe: 99_999, striche: [[10, 20, 2000, -5, "x", 3], [1]] }, { taskId: 424242, hoehe: 600, striche: [[1, 1]] }, { taskId: t2, hoehe: 880, striche: "kaputt" }], h.aufgaben.map((a) => a.taskId))!;
  assert.deepEqual(f[0], { taskId: t1, hoehe: 2600, striche: [[10, 20, 1000, 0]] });
  assert.deepEqual(f[1], { taskId: t2, hoehe: 880, striche: [] });
  assert.equal(f.length, 3, "one field per task, in the order of the sheet");
  assert.equal(s.heft.bereinige([{ taskId: t1, hoehe: 600, striche: Array.from({ length: 80 }, () => Array.from({ length: 6000 }, () => 5)) }], [t1]), null);

  assert.deepEqual(s.heft.speichereHeft(h, f), { version: 1 });
  assert.equal(s.heft.getHeft(s.aid)!.felder[0].striche.length, 1, "saved as the student writes");
});

test("„Fertig“: the pages become the student's material, ONE request reads all tasks, the app takes over: sure counts, unsure waits", async () => {
  const s = await setup();
  s.heft.alsHeft(s.aid);
  const ki = await mitKi(LESUNG);
  try {
    const h = s.heft.getHeft(s.aid)!;
    assert.ok("fehler" in s.heft.gibAb(h, h.felder, [Buffer.from("kein png")]), "only PNG pages");
    assert.ok("fehler" in s.heft.gibAb(h, h.felder, []), "no pages, nothing to check");
    // every field carries a stroke: a field without one is „nicht bearbeitet“ (KI9, further down)
    const geschrieben = h.felder.map((f) => ({ ...f, striche: [[10, 20, 60, 80]] }));
    assert.deepEqual(s.heft.gibAb(h, geschrieben, [PNG, PNG]), { ok: true });
    assert.equal(s.heft.getHeft(s.aid)!.status, "pruefen");
    assert.ok("fehler" in s.heft.speichereHeft(s.heft.getHeft(s.aid)!, h.felder), "handed in: no more writing");
    await s.heft.warteAufHeft(s.aid);

    assert.equal(ki.gefragt.length, 1, "one request for all tasks and pages");
    assert.ok(!/Lena|Rechtl/.test(JSON.stringify(ki.gefragt[0])), "no name goes to the KI");
    const g = s.heft.getHeft(s.aid)!;
    assert.equal(g.status, "geprueft", g.grund);
    assert.equal(g.materialIds.length, 1, "the same page twice is one material");
    assert.deepEqual(g.aufgaben.map((a) => a.urteil), ["richtig", "falsch", "offen"], "sure readings count, the unsure one waits for the teacher");
    const versuche = s.repo.listAttemptsForAssignment(s.aid);
    assert.ok(versuche.every((v) => v.unit_id === s.unit.id), "answers of the unit, like at the tablet");
    assert.equal(versuche.find((v) => v.review === "offen")?.answer, "3/5");

    // Üben counts what is decided; the open one is not „falsch“
    const { uebenStand } = await import("./einheit-ablauf");
    const u = uebenStand(s.unit.id);
    assert.deepEqual([u.gesamt.fertig, u.gesamt.richtig, u.gesamt.falsch], [2, 1, 1]);
    assert.equal(u.letzte?.fertig, true);
    assert.equal(s.heft.heftDerEinheit(s.unit.id)?.assignmentId, s.aid);
  } finally {
    ki.aus();
  }
});

test("the KI does not answer: the reason stays on the Heft, „Noch einmal prüfen“ works later", async () => {
  const s = await setup();
  s.heft.alsHeft(s.aid);
  let ki = await mitKi(null);
  try {
    const h = s.heft.getHeft(s.aid)!;
    assert.deepEqual(s.heft.gibAb(h, h.felder, [PNG]), { ok: true });
    await s.heft.warteAufHeft(s.aid);
    const f = s.heft.getHeft(s.aid)!;
    assert.equal(f.status, "fehler");
    assert.ok(f.grund.length > 0);
    assert.equal(s.repo.listAttemptsForAssignment(s.aid).length, 0, "nothing counts");
  } finally {
    ki.aus();
  }
  ki = await mitKi(LESUNG);
  try {
    await s.heft.pruefeHeft(s.aid);
    assert.equal(s.heft.getHeft(s.aid)!.status, "geprueft");
  } finally {
    ki.aus();
  }
});

test("KI9: eine leere Aufgabe im Heft ist „nicht bearbeitet“, nicht falsch; im Abschluss heißt das Heft nicht „Auf Papier“", async () => {
  const s = await setup();
  s.heft.alsHeft(s.aid);
  // Die Lesung nennt die dritte Aufgabe „falsch“, obwohl im Feld nichts steht: die App weiß es besser, dort ist kein Strich.
  const ki = await mitKi({
    aufgaben: [
      { nr: 1, antwort: "3/4", rechenweg: [], bewertung: "richtig", unsicher: false, grund: "", punkte: null },
      { nr: 2, antwort: "2/6", rechenweg: [], bewertung: "falsch", unsicher: false, grund: "Nenner addiert.", punkte: null },
      { nr: 3, antwort: "", rechenweg: [], bewertung: "falsch", unsicher: false, grund: "Keine Antwort.", punkte: null },
    ],
    anderes_blatt: false,
  });
  try {
    const h = s.heft.getHeft(s.aid)!;
    const strich = [[10, 20, 60, 80]];
    const felder = h.felder.map((f, i) => ({ ...f, striche: i < 2 ? strich : [] }));
    assert.deepEqual(s.heft.gibAb(h, felder, [PNG]), { ok: true });
    await s.heft.warteAufHeft(s.aid);
    const g = s.heft.getHeft(s.aid)!;
    assert.equal(g.status, "geprueft", g.grund);
    assert.deepEqual(g.aufgaben.map((a) => a.urteil), ["richtig", "falsch", null], "die leere Aufgabe hat kein Urteil");
    const versuche = s.repo.listAttemptsForAssignment(s.aid);
    assert.equal(versuche.length, 2, "für die leere Aufgabe gibt es keine Antwort, sie zählt nirgends");
    assert.ok(s.repo.getAssignment(s.aid)!.completed_at, "das Heft ist trotzdem abgeschlossen");

    const { uebenStand } = await import("./einheit-ablauf");
    const u = uebenStand(s.unit.id);
    assert.deepEqual([u.gesamt.aufgaben, u.gesamt.fertig, u.gesamt.richtig, u.gesamt.falsch], [3, 2, 1, 1]);
    assert.equal(u.letzte?.fertig, true, "Üben geht weiter, es wartet nicht auf die leere Aufgabe");

    const { papierDerEinheit } = await import("./papier-einheit");
    const { papierZeile } = await import("./blatt-regeln");
    const [p] = papierDerEinheit(s.unit.id);
    assert.equal(papierZeile(p), "Im Heft am Tablet: Übung „Brüche addieren“ 1 von 2 richtig, 1 nicht bearbeitet");

    const { aktivitaetenDerEinheit, aktivitaetName } = await import("./einheit-aktivitaeten");
    const a = aktivitaetenDerEinheit(s.unit.id).find((x) => x.assignmentId === s.aid)!;
    assert.equal(aktivitaetName(a), "Im Heft am Tablet „Brüche addieren“");
    assert.deepEqual([a.aufgaben, a.bearbeitet], [3, 2]);
  } finally {
    ki.aus();
  }
});
