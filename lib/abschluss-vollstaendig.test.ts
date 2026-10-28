/**
 * Dokumentation vollständig (F1, niko, Abschnitt 12): die elf Punkte in seiner Reihenfolge, jeder nur mit Beleg; „Verbessert“ nur mit
 * geprüften Antworten derselben Fähigkeit vorher und heute; Fehler je Aufgabe, nicht je Versuch; eine aus dem Schritt gedruckte und
 * auf Papier übernommene Übung zählt für „Weiter mit“ wie am Gerät. Keine KI, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AbschlussBelege, AufgabeBeleg } from "./abschluss";
import type { AblaufDerEinheit } from "./cockpit";
import type { BriefLine } from "./summary";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const DIV = "mathe.brueche.dividieren";
const PAST = "englisch.tenses.pastsimple";
const d = (text: string): BriefLine => ({ text, from: "daten" });
const t = (o: Partial<AufgabeBeleg> = {}): AufgabeBeleg => ({ assignmentId: 1, skillId: PAST, skill: "Past Simple", correct: true, finished: true, firstTry: true, tries: 1, help: "keine", ...o });
const belege = (o: Partial<AbschlussBelege> = {}): AbschlussBelege => ({ aufgaben: [], fehler: [], beobachtungen: [], reaktionen: [], minitest: null, vorgabe: [], geuebt: [], pruefung: null, eigene: {}, ...o });

test("the eleven points in niko's order, each line with its point; a point without evidence is left out", async () => {
  const { abschlussKarte, hatSichereErgebnisse, punkteDerKarte, PUNKTE } = await import("./abschluss");
  assert.deepEqual(
    PUNKTE.map(([, label]) => label),
    ["Themen", "Erklärungen", "Übungen", "Richtig und falsch", "Hilfen", "Noch schwierig", "Verbessert", "Auf Papier", "Textarbeit", "Hausübung", "Nächstes Mal"],
  );
  const ablauf: AblaufDerEinheit = {
    art: "plan",
    titel: "Plan für heute",
    ergebnis: { erledigt: [{ id: 1, titel: "Erklären" }], uebersprungen: [], nichtErreicht: [{ id: 3, titel: "Schreiben" }], wiederholt: [], nichtVerstanden: [{ id: 1, titel: "Erklären", mal: 1 }] },
    themen: ["Past Simple"],
    schritte: 3,
  };
  const stufen = { inhalt: 2, textstruktur: 2, stil: 2, sprachrichtigkeit: 4 } as const;
  const k = abschlussKarte(
    { done: [d("Grammatik: Past Simple"), d("5 Aufgaben bearbeitet, 3 richtig (60 %)")], good: [], difficulties: [d("Past Simple: 3 von 5 richtig")], errors: [], next: [d("Past Simple (Schwäche)")], dates: [] },
    ablauf,
    [{ id: 7, titel: "My weekend", textsorte: "E-Mail", bewertung: { stand: "bestaetigt", note: 3, stufen, erfuellt: 2, von: 2 } }],
    belege({
      aufgaben: [t(), t({ help: "hinweis", firstTry: false }), t({ help: "loesung", correct: false, firstTry: false }), t({ correct: false, firstTry: false, tries: 2 }), t()],
      fehler: ["Signalwort übersehen bei 2 Aufgaben (vermutet)"],
      uebungen: ["Past Simple üben"],
      unterlagen: ["Arbeitsblatt Schule"],
      beispiele: ["Past Simple"],
      ausfuehrlich: ["Past Simple"],
      papier: [{ titel: "Kurze Kontrolle", von: 2, richtig: 2, teilweise: 0, punkte: null, max: null, unsicher: 0 }],
      besser: ["Past Simple: von 2 von 5 auf 3 von 5 richtig (Einheit vom 21.10.)"],
      hausuebung: { text: "Hausübung: 6 Aufgaben Past Simple, fällig Mi., 4.11.", zeile: null },
    }),
  );
  const punkte = punkteDerKarte(k);
  assert.deepEqual(
    punkte.map((p) => p.punkt),
    ["themen", "erklaerungen", "uebungen", "ergebnisse", "hilfen", "schwierig", "besser", "papier", "texte", "hausuebung", "naechstes"],
    "every point has evidence here, in niko's order",
  );
  const von = (punkt: string) => punkte.find((p) => p.punkt === punkt)!.zeilen.map((z) => z.text);
  assert.deepEqual(von("themen"), ["Grammatik: Past Simple", "Thema: Past Simple", "Plan für heute: 1 von 3 Schritten (Erklären)"]);
  assert.deepEqual(von("erklaerungen"), ["Unterlage gezeigt: Arbeitsblatt Schule", "Beispiel im Schritt gezeigt: Past Simple", "Ausführlicher erklärt: Past Simple"]);
  assert.deepEqual(von("uebungen"), ["Übung: „Past Simple üben“"]);
  assert.deepEqual(von("ergebnisse"), ["5 Aufgaben bearbeitet, 3 richtig (60 %)"]);
  assert.deepEqual(von("hilfen"), ["Hilfe am Gerät bei 2 Aufgaben (Past Simple): Hinweis 1×, Lösung angesehen 1×", "Nicht verstanden: Erklären"]);
  assert.deepEqual(von("schwierig"), ["Past Simple: 3 von 5 richtig", "Fehler: Signalwort übersehen bei 2 Aufgaben (vermutet)", "E-Mail „My weekend“: Sprache 4"]);
  assert.deepEqual(von("besser"), ["Past Simple: von 2 von 5 auf 3 von 5 richtig (Einheit vom 21.10.)"]);
  assert.deepEqual(von("papier"), ["Auf Papier: Übung „Kurze Kontrolle“ 2 von 2 richtig"]);
  assert.deepEqual(von("texte"), ["E-Mail „My weekend“: Note 3 (2 von 2 Arbeitsaufträgen erfüllt)"]);
  assert.deepEqual(von("hausuebung"), ["Hausübung: 6 Aufgaben Past Simple, fällig Mi., 4.11."]);
  assert.deepEqual(von("naechstes"), ["Past Simple (Schwäche)", "Weiter mit: Schreiben"]);
  // the four fields stay what „Dokumentation bestätigen“ writes: „Verbessert“ is a checked result, so under „Gut verstanden“
  assert.ok(k.gut.some((z) => z.punkt === "besser" && z.von === "lernstand"));
  assert.equal(hatSichereErgebnisse(k.gut), false, "better than before is not „Gut verstanden“: the card still says „Keine sicheren Ergebnisse“");
  assert.ok(k.gemacht.some((z) => z.punkt === "hilfen" && z.von === "antworten"));
});

test("nothing invented: without evidence the points are left out, and an empty unit has no point at all", async () => {
  const { abschlussKarte, punkteDerKarte, hilfenZeile, verbesserungsZeile } = await import("./abschluss");
  assert.deepEqual(punkteDerKarte(abschlussKarte(null, null, [], belege())), [], "no line is filled in");
  // answers without help: no „Hilfen“; no example, no paper, no homework, no improvement
  const nur = punkteDerKarte(abschlussKarte({ done: [d("Grammatik: Past Simple"), d("2 Aufgaben bearbeitet, 2 richtig (100 %)")], good: [], difficulties: [], errors: [], next: [], dates: [] }, null, [], belege({ aufgaben: [t(), t()], uebungen: [], beispiele: [], ausfuehrlich: [], besser: [] })));
  assert.deepEqual(nur.map((p) => p.punkt), ["themen", "ergebnisse"]);
  assert.equal(hilfenZeile([t(), t()]), null);
  assert.equal(hilfenZeile([t({ help: "erklaerung", firstTry: false })]), "Hilfe am Gerät bei 1 Aufgabe (Past Simple): mehrere Hinweise 1×");
  // an improvement only with a checked result before and today, and only when today is better
  assert.equal(verbesserungsZeile("Past Simple", { punkte: 2, von: 5 }, { punkte: 4, von: 5 }, "21.10."), "Past Simple: von 2 von 5 auf 4 von 5 richtig (Einheit vom 21.10.)");
  assert.equal(verbesserungsZeile("Past Simple", { punkte: 1.5, von: 4 }, { punkte: 3, von: 4 }, null), "Past Simple: von 1,5 von 4 auf 3 von 4 richtig");
  assert.equal(verbesserungsZeile("Past Simple", null, { punkte: 5, von: 5 }, "21.10."), null, "nothing before: no improvement");
  assert.equal(verbesserungsZeile("Past Simple", { punkte: 0, von: 0 }, { punkte: 5, von: 5 }, "21.10."), null, "nothing checked before");
  assert.equal(verbesserungsZeile("Past Simple", { punkte: 2, von: 5 }, null, "21.10."), null, "nothing checked today");
  assert.equal(verbesserungsZeile("Past Simple", { punkte: 4, von: 5 }, { punkte: 4, von: 5 }, "21.10."), null, "the same is no improvement");
  assert.equal(verbesserungsZeile("Past Simple", { punkte: 4, von: 5 }, { punkte: 3, von: 5 }, "21.10."), null);
  // the teacher's corrected field keeps her text, under the field's own point
  const eigen = punkteDerKarte(abschlussKarte(null, null, [], belege({ eigene: { schwierig: "Tempo" } })));
  assert.deepEqual(eigen.map((p) => [p.punkt, p.zeilen.map((z) => z.text)]), [["schwierig", ["Tempo"]]]);
});

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const ab = await import("./abschluss");
  const { endUnit } = await import("./learning");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({ name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const aufgabe = (i: number) => ({ type: "calc" as const, skillId: DIV, difficulty: "mittel" as const, prompt: `${i}/4 : 1/2 = ?`, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] });
  /** five tasks on Dividieren sent in the unit */
  const sende = (unitId: number, sid: number, titel = "Brüche dividieren") => {
    const ws = repo.createWorksheet(
      { title: titel, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [DIV], status: "freigegeben" },
      [1, 2, 3, 4, 5].map(aufgabe),
    );
    return repo.assignWorksheet(ws, sid, "", unitId);
  };
  /** one final answer per task: true right, false wrong („Kehrwert vergessen“); `offen` waits for the teacher */
  const antworte = (unitId: number, asg: number, xs: boolean[], o: { offen?: boolean; hints?: number; at?: number } = {}) => {
    const a = repo.getAssignment(asg)!;
    const tasks = repo.listTasks(a.worksheet_id);
    xs.forEach((ok, i) => {
      const task = tasks[i];
      repo.recordAttempt({ assignment_id: asg, task_id: task.id, student_id: a.student_id, skill_id: DIV, attempt_no: 1, answer: ok ? "1" : "2", correct: ok ? 1 : 0, final: 1, time_ms: 30_000, active_ms: 25_000, hints_used: i === 0 ? (o.hints ?? 0) : 0, solution_viewed: 0, error_label: ok ? null : "Kehrwert vergessen", feedback: "", unit_id: unitId, review: o.offen ? "offen" : null, created_at: o.at ? new Date(o.at).toISOString().replace("T", " ").slice(0, 19) : undefined });
    });
  };
  return { db, repo, units, ab, endUnit, teacher, schueler, sende, antworte };
}

test("„Verbessert“ from the stored Lernstand: only with checked answers of the same skill in an earlier unit and today", async () => {
  const s = await setup();
  const { tagKurz } = await import("./hausuebung-zurueck");
  const { wienerDatum } = await import("./planung/zeit");
  const sid = s.schueler("Ida Bruchmoser");
  const tag = Date.now() - 3 * 86_400_000;
  // the unit before: 2 of 5 right
  const u1 = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik", at: tag }).unit;
  s.antworte(u1.id, s.sende(u1.id, sid), [true, true, false, false, false], { at: tag + 10 * 60_000 });
  s.endUnit(u1.id, { byTeacherId: s.teacher.id, at: tag + 50 * 60_000 });
  assert.ok(s.db().prepare("SELECT 1 FROM skill_snapshots WHERE unit_id = ? AND skill_id = ? AND practiced = 1").get(u1.id, DIV), "the Lernstand was stored with the unit");
  // today: 4 of 5 right, one with a hint
  const u2 = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  s.antworte(u2.id, s.sende(u2.id, sid), [true, true, true, true, false], { hints: 1 });
  const l2 = s.endUnit(u2.id, { byTeacherId: s.teacher.id })!;
  const k = s.ab.karteDerEinheit(u2.id, s.repo.getLesson(l2)!);
  const vorher = tagKurz(wienerDatum(new Date(u1.started_at)));
  assert.deepEqual(k.gut.filter((z) => z.punkt === "besser").map((z) => [z.text, z.von]), [[`Dividieren: von 2 von 5 auf 4 von 5 richtig (Einheit vom ${vorher})`, "lernstand"]]);
  assert.ok(k.gemacht.some((z) => z.text === "Hilfe am Gerät bei 1 Aufgabe (Dividieren): Hinweis 1×"), k.gemacht.map((z) => z.text).join("\n"));
  assert.ok(k.gemacht.some((z) => z.text === "Übung: „Brüche dividieren“" && z.punkt === "uebungen"));
  // „Bestätigen“ writes it into the documentation
  s.ab.bestaetigeAbschluss(l2);
  assert.match(s.repo.getLesson(l2)!.positives ?? "", /Dividieren: von 2 von 5 auf 4 von 5 richtig/);

  // another student: the first unit ever, nothing before → no improvement, however good today is
  const sid2 = s.schueler("Jonas Erstling");
  const u3 = s.units.startUnit(s.teacher.id, sid2, { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  s.antworte(u3.id, s.sende(u3.id, sid2), [true, true, true, true, true]);
  const l3 = s.endUnit(u3.id, { byTeacherId: s.teacher.id })!;
  assert.deepEqual(s.ab.karteDerEinheit(u3.id, s.repo.getLesson(l3)!).gut.filter((z) => z.punkt === "besser"), []);

  // before only answers still waiting for the teacher: not checked, so no improvement
  const sid3 = s.schueler("Lea Offenbach");
  const u4 = s.units.startUnit(s.teacher.id, sid3, { subject: "Mathematik", at: tag }).unit;
  s.antworte(u4.id, s.sende(u4.id, sid3), [false, false, false, false, false], { offen: true, at: tag + 10 * 60_000 });
  s.antworte(u4.id, s.sende(u4.id, sid3, "Brüche dividieren 2"), [false], { at: tag + 10 * 60_000 });
  s.endUnit(u4.id, { byTeacherId: s.teacher.id, at: tag + 50 * 60_000 });
  const u5 = s.units.startUnit(s.teacher.id, sid3, { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  s.antworte(u5.id, s.sende(u5.id, sid3), [true, true, true]);
  // before: 0 of 1 checked (the open ones do not count), today 3 of 3: an improvement on the checked answer only
  assert.deepEqual(s.ab.verbesserungen(u5.id, sid3, u5.started_at), [`Dividieren: von 0 von 1 auf 3 von 3 richtig (Einheit vom ${tagKurz(wienerDatum(new Date(u4.started_at)))})`]);
  // today only open answers: nothing checked today, no line
  const sid4 = s.schueler("Mats Wartner");
  const u6 = s.units.startUnit(s.teacher.id, sid4, { subject: "Mathematik", at: tag }).unit;
  s.antworte(u6.id, s.sende(u6.id, sid4), [false, false], { at: tag + 10 * 60_000 });
  s.endUnit(u6.id, { byTeacherId: s.teacher.id, at: tag + 50 * 60_000 });
  const u7 = s.units.startUnit(s.teacher.id, sid4, { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  const asg7 = s.sende(u7.id, sid4);
  s.antworte(u7.id, asg7, [true, true], { offen: true });
  assert.deepEqual(s.ab.verbesserungen(u7.id, sid4, u7.started_at), []);
  // confirmed with „Bewertung offen“; graded later from the list, the confirmed documentation follows with the new line
  const l7 = s.endUnit(u7.id, { byTeacherId: s.teacher.id })!;
  assert.ok(s.ab.bestaetigeAbschluss(l7));
  assert.match(s.repo.getLesson(l7)!.activities, /Bewertung offen: 2 Antworten/);
  assert.doesNotMatch(s.repo.getLesson(l7)!.positives ?? "", /von 0 von 2/);
  const { bewerteAntwort } = await import("./bewerten");
  for (const a of s.repo.listAttemptsForAssignment(asg7)) assert.ok(!("error" in bewerteAntwort(a.id, "richtig", s.teacher.id)));
  const nach = s.repo.getLesson(l7)!;
  assert.doesNotMatch(nach.activities, /Bewertung offen/);
  assert.match(nach.positives ?? "", new RegExp(`Dividieren: von 0 von 2 auf 2 von 2 richtig \\(Einheit vom ${tagKurz(wienerDatum(new Date(u6.started_at))).replace(/\./g, "\\.")}\\)`));
});

test("errors count tasks, not tries: three wrong tries at one task are one task", async () => {
  const s = await setup();
  const sid = s.schueler("Nils Probierer");
  const u = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  const asg = s.sende(u.id, sid);
  const [a, b] = s.repo.listTasks(s.repo.getAssignment(asg)!.worksheet_id);
  const versuch = (taskId: number, nr: number, ok: boolean) =>
    s.repo.recordAttempt({ assignment_id: asg, task_id: taskId, student_id: sid, skill_id: DIV, attempt_no: nr, answer: ok ? "1" : "2", correct: ok ? 1 : 0, final: ok || nr === 3 ? 1 : 0, time_ms: 20_000, active_ms: 15_000, hints_used: 0, solution_viewed: 0, error_label: ok ? null : "Kehrwert vergessen", feedback: "", unit_id: u.id });
  versuch(a.id, 1, false);
  versuch(a.id, 2, false);
  versuch(a.id, 3, false);
  versuch(b.id, 1, false);
  versuch(b.id, 2, true);
  const lessonId = s.endUnit(u.id, { byTeacherId: s.teacher.id })!;
  const lesson = s.repo.getLesson(lessonId)!;
  assert.deepEqual(s.ab.belegeDerEinheit(u.id, lesson).fehler, ["Kehrwert vergessen bei 2 Aufgaben"], "4 wrong tries, 2 tasks");
  const { unitBrief } = await import("./summary");
  assert.deepEqual(unitBrief(lessonId)!.errors.map((l) => l.text), ["Kehrwert vergessen bei 2 Aufgaben"], "„Auf einen Blick“ counts the same way");
  const k = s.ab.karteDerEinheit(u.id, lesson);
  assert.ok(k.schwierig.some((z) => z.text === "Fehler: Kehrwert vergessen bei 2 Aufgaben" && z.punkt === "schwierig"));
});

test("explanations used in the unit: the worked example of the step and „Ausführlicher erklären“, only of this unit", async () => {
  const s = await setup();
  const sid = s.schueler("Rosa Beispielhof");
  const u = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  const anders = s.units.startUnit(s.teacher.id, s.schueler("Timo Nebenan"), { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  s.db().prepare("INSERT INTO einheit_beispiele (unit_id, skill_id, schritt_id, aufgabe) VALUES (?, ?, 2, '{}')").run(u.id, DIV);
  const anfrage = (unitId: number) =>
    Number(s.db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, unit_id, status) VALUES (datetime('now'), 'ausfuehrlich', 'standard', 'test', ?, 'ok')").run(unitId).lastInsertRowid);
  const { FASSUNG } = await import("./ausfuehrlich");
  s.db().prepare("INSERT INTO ki_erklaerungen (skill_id, schulstufe, fassung, inhalt, call_id) VALUES (?, 6, ?, '{}', ?)").run(DIV, FASSUNG, anfrage(u.id));
  // written for the other unit: reused here it is just the text of the step, not „Ausführlicher erklärt“ in this unit
  s.db().prepare("INSERT INTO ki_erklaerungen (skill_id, schulstufe, fassung, inhalt, call_id) VALUES ('mathe.brueche.kuerzen', 6, ?, '{}', ?)").run(FASSUNG, anfrage(anders.id));
  const lessonId = s.endUnit(u.id, { byTeacherId: s.teacher.id })!;
  const k = s.ab.karteDerEinheit(u.id, s.repo.getLesson(lessonId)!);
  const erklaerungen = s.ab.punkteDerKarte(k).find((p) => p.punkt === "erklaerungen")!;
  assert.deepEqual(erklaerungen.zeilen.map((z) => z.text), ["Beispiel im Schritt gezeigt: Dividieren", "Ausführlicher erklärt: Dividieren"]);
  // nothing of it in the other unit
  const l2 = s.endUnit(anders.id, { byTeacherId: s.teacher.id })!;
  const k2 = s.ab.karteDerEinheit(anders.id, s.repo.getLesson(l2)!);
  assert.ok(!s.ab.punkteDerKarte(k2).some((p) => p.punkt === "erklaerungen" && p.zeilen.some((z) => z.text.startsWith("Beispiel"))));
  assert.deepEqual(s.ab.belegeDerEinheit(anders.id, s.repo.getLesson(l2)!).ausfuehrlich, ["Kürzen"]);
});

test("a printed step solved on paper counts like the device: not „Weiter mit“ any more", async () => {
  const s = await setup();
  const c = await import("./cockpit");
  const p = await import("./papier-einheit");
  const { zeilenOhneLesung } = await import("./blatt-regeln");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  router.resetRouter();
  router.setTransport(async () => {
    throw new Error("keine KI im Test");
  });
  try {
    const sid = s.repo.createStudent({ name: "Eva Papierer", grade: 6, klasse: 2, teacher_id: s.teacher.id, school: "", school_type: "Gymnasium", subjects: ["Englisch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
    s.repo.addTest({ student_id: sid, date: zeit.tagAddieren(zeit.wienerDatum(), 6), subject: "Englisch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [PAST], title: "", topics: [], status: "geplant", teacher_id: s.teacher.id, material_id: null });
    const u = s.units.startUnit(s.teacher.id, sid, { subject: "Englisch", at: Date.now() - 60 * 60_000 }).unit;
    const plan = c.planDerEinheit(u.id);
    const kontrolle = plan.find((x) => x.art === "kontrolle" && x.skillId === PAST)!;
    assert.ok(kontrolle, plan.map((x) => x.titel).join(" | "));
    // the teacher went on to the Kontrolle and printed it; never tapped „Weiter“ there
    c.zeigeSchritt(u.id, kontrolle.id);
    const druck = await c.druckeImSchritt(u.id, kontrolle.id, s.teacher.id);
    assert.ok("worksheetId" in druck, JSON.stringify(druck));
    const vorher = c.ablaufDerEinheit(u.id)!;
    assert.ok(vorher.ergebnis.nichtErreicht.some((x) => x.id === kontrolle.id) || !vorher.ergebnis.erledigt.some((x) => x.id === kontrolle.id), "printed is not done");
    // the paper comes back: all right, checked by hand
    const blatt = p.blattZurUebung(p.blaetterDerEinheit(u.id), druck.worksheetId)!;
    const zeilen = zeilenOhneLesung(blatt.aufgaben).map((z) => ({ ...z, offen: false, bewertung: "richtig" as const }));
    const out = p.speicherePapier({ unitId: u.id, teacherId: s.teacher.id, blatt: blatt.key, zeilen, materialIds: [], gelesen: "hand" });
    assert.ok(!("error" in out), JSON.stringify(out));
    const nachher = c.ablaufDerEinheit(u.id)!;
    assert.ok(nachher.ergebnis.erledigt.some((x) => x.id === kontrolle.id), "on paper, taken over: done");
    const lessonId = s.endUnit(u.id, { byTeacherId: s.teacher.id })!;
    const k = s.ab.karteDerEinheit(u.id, s.repo.getLesson(lessonId)!);
    assert.ok(!k.naechstes.some((z) => z.text.startsWith("Weiter mit") && z.text.includes(kontrolle.titel)), k.naechstes.map((z) => z.text).join("\n"));
    assert.ok(k.gemacht.some((z) => z.punkt === "papier" && z.text.startsWith("Auf Papier:")), "the paper line is there");
    assert.ok(!(s.repo.getLesson(lessonId)!.next_steps ?? "").includes(kontrolle.titel), "nor in the documentation written at the end");
  } finally {
    router.setTransport(null);
  }
});
