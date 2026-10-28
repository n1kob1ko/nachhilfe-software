/**
 * Hausübung zurück (E2): Antworten am Gerät zählen für den Lernstand nur geprüft, offene stehen in „Zu bewerten“ mit dem Chip
 * „Hausübung“; Papier über „Arbeit fotografieren“ an derselben Zuweisung, ohne unit_id, mit der Hausübung verknüpft; die Stände bis
 * „nicht abgegeben“ (nie falsch, nie im Lernstand); die Zeile für Heute und Unterricht, der Schritt „Hausübung besprechen“ im Plan,
 * schwierige Themen als Signal; der Abschluss der nächsten Einheit, „besser“ nur mit Ergebnis vorher und nachher; kein Schritt ohne
 * Hausübung. Ohne KI: der Transport ist aus. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR",
])
  delete process.env[k];

const DIV = "mathe.brueche.dividieren";
const KUE = "mathe.brueche.kuerzen";
const TAG = 86_400_000;
let nr = 0;

/** „YYYY-MM-DD HH:MM:SS“ (UTC), wie SQLite datetime('now') speichert */
const sqlZeit = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const hz = await import("./hausuebung-zurueck");
  const ab = await import("./abschluss");
  const { endUnit } = await import("./learning");
  const { wienerDatum, tagAddieren } = await import("./planung/zeit");
  const router = await import("./ai/router");
  router.resetRouter();
  router.setTransport(null);
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const aufgabe = (skill: string, frei = false) =>
    frei
      ? { type: "free" as const, skillId: skill, difficulty: "mittel" as const, prompt: `Erkläre ${skill} Nr. ${++nr}`, data: {}, answer: { sample: "So." }, solution: "So.", hints: [], errorMap: [] }
      : { type: "calc" as const, skillId: skill, difficulty: "mittel" as const, prompt: `Rechne ${skill} Nr. ${++nr}`, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "Kehrwert", hints: [], errorMap: [] };
  /** eine freigegebene Hausübung mit Übung (wie „Hausübung freigeben“), zugewiesen um `am` */
  const hausuebung = (sid: number, o: { tasks: ReturnType<typeof aufgabe>[]; faellig: string | null; am: number; unitId?: number | null }) => {
    const ws = repo.createWorksheet(
      { title: `${repo.getStudent(sid)!.name.split(" ")[0]} – Hausübung: Brüche`, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [DIV, KUE], status: "freigegeben", student_id: sid },
      o.tasks,
    );
    const asg = repo.assignWorksheet(ws, sid, "", null);
    db().prepare("UPDATE assignments SET assigned_at = ? WHERE id = ?").run(sqlZeit(o.am), asg);
    const hw = repo.addHomework({ student_id: sid, subject: "Mathematik", description: "8 Aufgaben Brüche", due_date: o.faellig, status: "offen", notes: "Hausübung vorbereitet (Abschluss)", assignment_id: asg, unit_id: o.unitId ?? null });
    return { ws, asg, hw };
  };
  /** je Aufgabe der Reihe nach eine abgeschlossene Antwort am Gerät, ohne Einheit: true, false, „teilweise“ oder „offen“ */
  const antworte = (asg: number, xs: (boolean | "teilweise" | "offen")[], unitId: number | null = null) => {
    const a = repo.getAssignment(asg)!;
    const tasks = repo.listTasks(a.worksheet_id);
    return xs.map((x, i) => {
      const t = tasks[i];
      return repo.recordAttempt({
        assignment_id: asg, task_id: t.id, student_id: a.student_id, skill_id: t.skillId ?? null, attempt_no: 1, answer: x === true ? "1" : "2", correct: x === true ? 1 : 0, final: 1, time_ms: 30_000,
        hints_used: 0, solution_viewed: 0, error_label: null, feedback: "", unit_id: unitId, level: 3, review: x === "teilweise" ? "teilweise" : x === "offen" ? "offen" : null,
      });
    });
  };
  const start = (sid: number, at: number) => units.startUnit(teacher.id, sid, { subject: "Mathematik", at }).unit;
  const ende = (unitId: number, at: number) => endUnit(unitId, { byTeacherId: teacher.id, at })!;
  const heute = wienerDatum(new Date());
  return { db, repo, units, hz, ab, teacher, schueler, aufgabe, hausuebung, antworte, start, ende, heute, tagAddieren, wienerDatum };
}

// ---------- Regeln ohne Datenbank ----------

test("states: open, handed in (n of m), graded (x of y right, partial half), not handed in after the due date; never wrong", async () => {
  const { hausuebungStatus, zahlen, statusText, punkte, themenAus, besser, briefingZeile } = await import("./hausuebung-zurueck");
  const z = (xs: Parameters<typeof zahlen>[0]) => zahlen(xs);
  const nichts = z(["unbearbeitet", "unbearbeitet", "unbearbeitet"]);
  assert.equal(hausuebungStatus(nichts, { faellig: "2026-11-04", stichtag: "2026-11-03" }), "offen");
  assert.equal(hausuebungStatus(nichts, { faellig: "2026-11-04", stichtag: "2026-11-04" }), "offen", "on the due day itself still open …");
  assert.equal(hausuebungStatus(nichts, { faellig: "2026-11-04", stichtag: "2026-11-04", zumUnterricht: true }), "nicht_abgegeben", "… but not for the lesson that day");
  assert.equal(hausuebungStatus(nichts, { faellig: "2026-11-04", stichtag: "2026-11-05" }), "nicht_abgegeben");
  assert.equal(hausuebungStatus(nichts, { faellig: null, stichtag: "2026-12-24" }), "offen", "without a due date never „not handed in“");
  assert.equal(hausuebungStatus(nichts, { faellig: "2026-11-04", stichtag: "2026-11-05", abgehakt: true }), "abgegeben", "ticked off by hand: handed in, nothing read");

  const teil = z(["richtig", "offen", "unbearbeitet"]);
  assert.equal(hausuebungStatus(teil, { faellig: "2026-11-04", stichtag: "2026-11-03" }), "abgegeben");
  assert.equal(statusText({ ...teil, status: "abgegeben", faellig: null }), "abgegeben (2 von 3 bearbeitet, 1 Antwort zu bewerten)");
  // an answer waiting for the teacher keeps it „abgegeben“, even after the due date
  assert.equal(hausuebungStatus(teil, { faellig: "2026-11-04", stichtag: "2026-11-09" }), "abgegeben");
  const fertig = z(["richtig", "teilweise", "falsch", "richtig"]);
  assert.equal(hausuebungStatus(fertig, { faellig: "2026-11-04", stichtag: "2026-11-03" }), "bewertet");
  assert.equal(punkte(fertig), 2.5);
  assert.equal(statusText({ ...fertig, status: "bewertet", faellig: null }), "bewertet (2,5 von 4 richtig)");
  const halb = z(["richtig", "falsch", "unbearbeitet", "unbearbeitet"]);
  assert.equal(hausuebungStatus(halb, { faellig: "2026-11-04", stichtag: "2026-11-03" }), "abgegeben", "half done before the due date: still handed in");
  assert.equal(hausuebungStatus(halb, { faellig: "2026-11-04", stichtag: "2026-11-05" }), "bewertet", "after the due date: what is there is graded");
  assert.equal(statusText({ ...halb, status: "bewertet", faellig: null }), "bewertet (1 von 2 richtig, 2 von 4 bearbeitet)");
  assert.equal(statusText({ ...nichts, status: "nicht_abgegeben", faellig: "2026-11-04" }), "nicht abgegeben");
  assert.equal(statusText({ ...nichts, status: "offen", faellig: "2026-11-04" }), "offen, fällig Mi 4.11.");

  // per topic from checked answers only: difficult under half, good from two all right
  const t = themenAus(
    [
      { skillId: "pc", bewertung: "richtig" }, { skillId: "pc", bewertung: "teilweise" }, { skillId: "pc", bewertung: "richtig" },
      { skillId: "psq", bewertung: "falsch" }, { skillId: "psq", bewertung: "teilweise" }, { skillId: "psq", bewertung: "offen" }, { skillId: "psq", bewertung: "falsch" },
      { skillId: "ps", bewertung: "richtig" }, { skillId: "ps", bewertung: "richtig" },
      { skillId: "nix", bewertung: "unbearbeitet" }, { skillId: "nix", bewertung: "offen" },
    ],
    (id) => ({ pc: "Present Continuous", psq: "Past Simple Questions", ps: "Present Simple" })[id] ?? id,
  );
  assert.deepEqual(t.map((x) => [x.skillId, x.von, x.punkte, x.stand]), [["pc", 3, 2.5, "teilweise"], ["psq", 3, 0.5, "schwierig"], ["ps", 2, 2, "gut"]], "nothing for a topic without a checked answer");
  // „besser“ only with a checked result before and after
  assert.equal(besser({ punkte: 1, von: 4 }, { punkte: 3, von: 4 }), true);
  assert.equal(besser(null, { punkte: 3, von: 4 }), false);
  assert.equal(besser({ punkte: 1, von: 4 }, { punkte: 0, von: 0 }), false);
  assert.equal(besser({ punkte: 3, von: 4 }, { punkte: 3, von: 4 }), false);

  const e = { ...z(["richtig", "richtig", "richtig", "richtig", "richtig", "richtig", "falsch", "falsch", "falsch"]), status: "bewertet" as const, faellig: null, themen: t.filter((x) => x.skillId === "psq"), gegeben: "2026-10-28" };
  assert.equal(briefingZeile(e as never), "Hausübung: 6 von 9 richtig · Past Simple Questions noch schwierig");
  assert.equal(briefingZeile({ ...e, ...nichts, status: "nicht_abgegeben", faellig: "2026-11-04", themen: [] } as never), "Hausübung: nicht abgegeben (fällig Mi 4.11.)");
});

// ---------- mit Datenbank ----------

test("digital: answers carry the homework link, count for the Lernstand only when checked, open ones wait in „Zu bewerten“ as „Hausübung“", async () => {
  const s = await setup();
  const sid = s.schueler("Lena Muster");
  const { asg, hw } = s.hausuebung(sid, { tasks: [s.aufgabe(DIV), s.aufgabe(DIV), s.aufgabe(KUE, true)], faellig: s.tagAddieren(s.heute, 3), am: Date.now() - TAG });
  const ids = s.antworte(asg, [true, false, "offen"]);
  assert.equal(s.hz.hausuebungZurZuweisung(s.repo.getAttempt(ids[0])!.assignment_id), hw, "the answer leads to its homework");
  // the Lernstand reads the counted answers only: the open one is not there
  const gezaehlt = () => s.repo.listAttemptsForStudent(sid).map((a) => a.id);
  assert.deepEqual(gezaehlt(), ids.slice(0, 2));
  const e = s.hz.hausuebungErgebnis(hw)!;
  assert.deepEqual([e.status, e.bearbeitet, e.bewertet, e.richtig, e.offen, e.geraet, e.papier], ["abgegeben", 3, 2, 1, 1, true, false]);
  const offen = (await import("./zu-bewerten")).zuBewerten({ studentId: sid });
  assert.equal(offen.length, 1);
  assert.equal(offen[0].quelle, "hausuebung");
  const { QUELLE_TEXT } = await import("./zu-bewerten");
  assert.equal(QUELLE_TEXT[offen[0].quelle], "Hausübung");

  // graded: now it counts, and the homework is graded
  const { bewerteAntwort } = await import("./bewerten");
  assert.ok("ok" in bewerteAntwort(ids[2], "richtig", s.teacher.id));
  assert.deepEqual(gezaehlt(), ids);
  const f = s.hz.hausuebungErgebnis(hw)!;
  assert.deepEqual([f.status, f.bewertet, f.richtig], ["bewertet", 3, 2]);
  assert.equal(s.hz.statusText(f), "bewertet (2 von 3 richtig)");
});

test("not handed in: never wrong, nothing in the Lernstand; the next unit offers 3 of its tasks together; once discussed it is gone", async () => {
  const s = await setup();
  const sid = s.schueler("Tim Beispiel");
  const { hw } = s.hausuebung(sid, { tasks: [s.aufgabe(DIV), s.aufgabe(DIV), s.aufgabe(KUE), s.aufgabe(KUE)], faellig: s.tagAddieren(s.heute, -1), am: Date.now() - 5 * TAG });
  const e = s.hz.hausuebungErgebnis(hw)!;
  assert.deepEqual([e.status, e.bewertet, e.richtig], ["nicht_abgegeben", 0, 0]);
  assert.equal(s.repo.listAttemptsForStudent(sid).length, 0, "no answer: nothing counts, nothing is wrong");
  const { analyzeStudent } = await import("./service");
  assert.equal(analyzeStudent(sid)!.skills.find((x) => x.skill.id === DIV)?.mastery ?? null, null);

  const unit = s.start(sid, Date.now() - 20 * 60_000);
  const plan = (await import("./stundenplan")).stundenplanFuer(sid, { fach: "Mathematik", platzId: null, unitId: unit.id });
  const schritt = plan.find((x) => x.art === "hausuebung")!;
  assert.ok(schritt, JSON.stringify(plan.map((x) => x.titel)));
  assert.equal(plan.indexOf(schritt), 1, "right after the Einstieg");
  assert.equal(schritt.titel, "Hausübung nicht abgegeben");
  assert.equal(schritt.hausuebung, hw);
  assert.match(schritt.beschreibung, /zählt nicht als falsch\. Löst 3 Aufgaben daraus gemeinsam/);
  assert.equal(s.hz.besprechenSchritt(e).taskIds.length, 3);
  assert.equal(plan.reduce((x, y) => x + y.minuten, 0), 100, "within the planned length");
  assert.equal(schritt.minuten, 10);

  // its Abschluss says so; nothing under „Noch schwierig“ from it
  const lessonId = s.ende(unit.id, Date.now() - 60_000);
  const karte = s.ab.karteDerEinheit(unit.id, s.repo.getLesson(lessonId)!);
  const tag = `${Number(e.gegeben!.slice(8, 10))}.${Number(e.gegeben!.slice(5, 7))}.`;
  assert.ok(karte.gemacht.some((z) => z.text === `Hausübung vom ${tag}: nicht abgegeben` && z.von === "hausuebung"), JSON.stringify(karte.gemacht));
  assert.ok(!karte.schwierig.some((z) => z.von === "hausuebung"));
  // a unit after the due date had it: the next one does not bring it up again
  assert.equal(s.hz.hausuebungFuerEinheit(sid, { vor: new Date(Date.now() + TAG).toISOString(), fach: "Mathematik" }), null);
});

test("next unit: one line, „Hausübung besprechen“ with the wrong tasks, difficult topics first; Abschluss with the result and „besser“ only with a result before and after", async () => {
  const s = await setup();
  const sid = s.schueler("Mia Probe");
  // the unit three days ago: Brüche dividieren 1 of 4 right
  const t0 = Date.now() - 3 * TAG;
  const u1 = s.start(sid, t0);
  const { createWorksheet, assignWorksheet } = s.repo;
  const ws1 = createWorksheet({ title: "Üben", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [DIV], status: "freigegeben", student_id: sid }, [s.aufgabe(DIV), s.aufgabe(DIV), s.aufgabe(DIV), s.aufgabe(DIV)]);
  s.antworte(assignWorksheet(ws1, sid, "", u1.id), [true, false, false, false], u1.id);
  s.ende(u1.id, t0 + 50 * 60_000);
  // the homework given in that Abschluss: dividieren 3 of 4, kürzen 1,5 of 4 and one free answer waiting
  const { asg, hw } = s.hausuebung(sid, {
    tasks: [s.aufgabe(DIV), s.aufgabe(DIV), s.aufgabe(DIV), s.aufgabe(DIV), s.aufgabe(KUE), s.aufgabe(KUE), s.aufgabe(KUE), s.aufgabe(KUE), s.aufgabe(KUE, true)],
    faellig: s.heute,
    am: t0 + 51 * 60_000,
    unitId: u1.id,
  });
  const ids = s.antworte(asg, [true, true, true, false, false, false, "teilweise", true, "offen"]);
  // the homework is not part of the unit it was given in
  assert.equal(s.hz.hausuebungFuerEinheit(sid, { vor: u1.started_at, fach: "Mathematik", ausser: u1.id }), null);

  const u2 = s.start(sid, Date.now() - 30 * 60_000);
  const e = s.hz.hausuebungFuerEinheit(sid, { vor: u2.started_at, fach: "Mathematik", ausser: u2.id })!;
  assert.equal(e.homeworkId, hw);
  assert.equal(s.hz.briefingZeile(e), `Hausübung: 9 von 9 bearbeitet · bisher 4,5 von 8 richtig · 1 Antwort zu bewerten · ${s.repo.getSkill(KUE)!.name} noch schwierig`);
  assert.match(s.hz.quelleText(e), /^Hausübung vom \d+\.\d+\., am Gerät$/);
  // the open answer of the homework is in this unit's „Zu bewerten“, but not counted as the unit's own
  const zb = await import("./zu-bewerten");
  const liste = zb.zuBewerten({ unitId: u2.id });
  assert.deepEqual(liste.map((z) => z.quelle), ["hausuebung"]);
  assert.equal(zb.offeneDerEinheit(liste), 0);

  // the plan: „Hausübung besprechen“ after the Einstieg with the wrong and partial tasks, 10 minutes of the 100; kürzen is a topic
  const { stundenplanFuer } = await import("./stundenplan");
  const plan = stundenplanFuer(sid, { fach: "Mathematik", platzId: null, unitId: u2.id });
  const schritt = plan[1];
  assert.deepEqual([schritt.art, schritt.titel, schritt.minuten, schritt.hausuebung], ["hausuebung", "Hausübung besprechen", 10, hw]);
  const tasks = s.repo.listTasks(s.repo.getAssignment(asg)!.worksheet_id);
  assert.deepEqual(s.hz.besprechenSchritt(e).taskIds, [tasks[3].id, tasks[4].id, tasks[5].id, tasks[6].id], "the wrong and partly right ones");
  assert.match(schritt.beschreibung, /Besprecht die 4 falsch oder teilweise gelösten Aufgaben/);
  assert.equal(plan.reduce((x, y) => x + y.minuten, 0), 100);
  assert.ok(plan.some((x) => x.skillId === KUE && x.art === "erklaeren"), "the topic still difficult in the homework is in the plan");
  assert.deepEqual(s.hz.hausuebungSignale(e).map((x) => [x.art, x.skill_ids[0]]), [["ziel", KUE]]);
  assert.ok(s.hz.hausuebungSignale(e)[0].warum.includes(`${s.repo.getSkill(KUE)!.name} 1,5 von 4 richtig`));

  // graded later: the homework is graded
  const { bewerteAntwort } = await import("./bewerten");
  assert.ok("ok" in bewerteAntwort(ids[8], "falsch", s.teacher.id));
  const lessonId = s.ende(u2.id, Date.now() - 60_000);
  const karte = s.ab.karteDerEinheit(u2.id, s.repo.getLesson(lessonId)!);
  const tag = `${Number(e.gegeben!.slice(8, 10))}.${Number(e.gegeben!.slice(5, 7))}.`;
  const hu = karte.gemacht.filter((z) => z.von === "hausuebung").map((z) => z.text);
  const dividieren = s.repo.getSkill(DIV)!.name;
  assert.deepEqual(hu, [`Hausübung vom ${tag}: 4,5 von 9 richtig (bewertet)`, `${dividieren} besser als in der Einheit vom ${tag}: 3 von 4 richtig (vorher 1 von 4)`], "„besser“ only for the skill with a result before");
  assert.deepEqual(karte.schwierig.filter((z) => z.von === "hausuebung").map((z) => z.text), [`Hausübung vom ${tag}: ${s.repo.getSkill(KUE)!.name} 1,5 von 5 richtig`]);
  assert.ok(!karte.naechstes.some((z) => z.text.includes("8 Aufgaben Brüche")), "graded and discussed: no longer „Nächstes Mal“");
});

test("paper: the homework sheet is offered in „Arbeit fotografieren“ (unit and profile), graded against its tasks, linked to the homework, no unit_id", async () => {
  const s = await setup();
  const p = await import("./papier-einheit");
  const { zeilenOhneLesung } = await import("./blatt-regeln");
  const sid = s.schueler("Ben Test");
  const { asg, hw, ws } = s.hausuebung(sid, { tasks: [s.aufgabe(DIV), s.aufgabe(DIV), s.aufgabe(DIV)], faellig: s.heute, am: Date.now() - 2 * TAG });
  // from the profile without a unit, and in the next unit
  assert.deepEqual(p.blaetterOhneEinheit(sid).map((b) => [b.art, b.homeworkId, b.worksheetId]), [["hausuebung", hw, ws]]);
  const unit = s.start(sid, Date.now() - 10 * 60_000);
  const b = p.blaetterDerEinheit(unit.id).find((x) => x.homeworkId === hw)!;
  assert.deepEqual([b.art, b.key, b.titel, b.aufgaben.length], ["hausuebung", `z${asg}`, "Hausübung: Brüche", 3]);
  const zeilen = zeilenOhneLesung(b.aufgaben).map((z, i) => ({ ...z, offen: false, bewertung: i === 2 ? ("falsch" as const) : ("richtig" as const) }));
  const out = p.speicherePapier({ unitId: unit.id, teacherId: s.teacher.id, blatt: b.key, materialIds: [], gelesen: "hand", zeilen });
  assert.ok(!("error" in out), JSON.stringify(out));
  assert.equal(out.assignmentId, asg, "the same assignment");
  const attempts = s.repo.listAttemptsForAssignment(asg);
  assert.equal(attempts.length, 3);
  assert.ok(attempts.every((a) => a.unit_id === null), "a homework is no lesson: no unit_id");
  assert.equal((s.db().prepare("SELECT homework_id FROM papier_arbeiten WHERE id = ?").get(out.papierId) as { homework_id: number }).homework_id, hw);
  assert.deepEqual(p.papierDerEinheit(unit.id), [], "not a paper line of the unit's own work");
  assert.ok(p.papierArbeit(out.papierId, unit.id), "the line after „Übernehmen“");
  const e = s.hz.hausuebungErgebnis(hw)!;
  assert.deepEqual([e.status, e.richtig, e.bewertet, e.papier, e.geraet], ["bewertet", 2, 3, true, false]);
  assert.match(s.hz.quelleText(e), /auf Papier, von dir geprüft$/);
  assert.equal(s.repo.listAttemptsForStudent(sid).length, 3, "into the Lernstand like digital answers");
  assert.deepEqual(p.blaetterDerEinheit(unit.id).filter((x) => x.homeworkId === hw), [], "graded: not offered again");
});

test("no homework: no line, no step", async () => {
  const s = await setup();
  const sid = s.schueler("Ida Leer");
  // a homework without exercise (free text) has no results either
  s.repo.addHomework({ student_id: sid, subject: "Mathematik", description: "Buch S. 12", due_date: s.tagAddieren(s.heute, -1), status: "offen", notes: "" });
  const unit = s.start(sid, Date.now() - 5 * 60_000);
  assert.equal(s.hz.hausuebungFuerEinheit(sid, { vor: unit.started_at, fach: "Mathematik", ausser: unit.id }), null);
  const plan = (await import("./stundenplan")).stundenplanFuer(sid, { fach: "Mathematik", platzId: null, unitId: unit.id });
  assert.ok(!plan.some((x) => x.art === "hausuebung"));
  // a homework not due yet and not done: a line on Heute, but no step
  const { hw } = s.hausuebung(sid, { tasks: [s.aufgabe(DIV)], faellig: s.tagAddieren(s.heute, 4), am: Date.now() - 60 * 60_000 });
  const e = s.hz.hausuebungFuerEinheit(sid, { vor: new Date().toISOString(), fach: "Mathematik" })!;
  assert.equal(e.homeworkId, hw);
  assert.equal(e.status, "offen");
  assert.equal(s.hz.schrittNoetig(e), false);
  assert.match(s.hz.briefingZeile(e), /^Hausübung: noch offen, fällig /);
});
