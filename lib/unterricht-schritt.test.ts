/**
 * Der Schritt im Unterricht (niko, 27.10.2026): ein ausführlicher Lehrertext ohne Paket, „Ausführlicher erklären“ einmal je
 * Fähigkeit und Schulstufe, Lösung und typische Fehler an jedem Schritt, die nächste Übung bereit, die Zeit passt sich an.
 *
 * Ohne KI nach außen: der Transport wird ersetzt (beim Lesen der Vorgabe mit der von Hand geschriebenen Antwort aus
 * lib/fixtures/stoff-englisch-more.ts, bei „Ausführlicher erklären“ mit einer festen Antwort). Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import { STOFF_ENGLISCH_MORE } from "./fixtures/stoff-englisch-more";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "unterricht-schritt-"));
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR",
])
  delete process.env[k];

// ---------- the time adapts (without the database) ----------

/** The Englisch plan of 100 minutes (lib/stundenplan.test.ts): Einstieg, three topics, Abschluss. */
const PLAN = [
  { id: -1, minuten: 10, thema: null, kontrolle: false },
  { id: -2, minuten: 10, thema: "Past Simple", kontrolle: false },
  { id: -3, minuten: 15, thema: "Past Simple", kontrolle: false },
  { id: -4, minuten: 10, thema: "Past Simple", kontrolle: true },
  { id: -5, minuten: 10, thema: "E-Mail", kontrolle: false },
  { id: -6, minuten: 10, thema: "E-Mail", kontrolle: false },
  { id: -7, minuten: 10, thema: "E-Mail", kontrolle: true },
  { id: -8, minuten: 5, thema: "Tagesablauf", kontrolle: false },
  { id: -9, minuten: 10, thema: "Tagesablauf", kontrolle: false },
  { id: -10, minuten: 5, thema: "Tagesablauf", kontrolle: true },
  { id: -11, minuten: 5, thema: null, kontrolle: false },
];
const THEMA = (t: string) => PLAN.filter((s) => s.thema === t).map((s) => s.id);
const summeVon = (m: Record<string, number>, ids: number[]) => ids.reduce((a, id) => a + m[id], 0);

test("re-timing: the first topic ran over, later topics shrink in proportion, a Lernkontrolle keeps 5 minutes, done steps stay", async () => {
  const sp = await import("./stundenplan");
  // after 40 minutes the teacher moves on to the Lernkontrolle of Past Simple (planned from minute 35)
  const t = sp.neuTakten(PLAN, { fertig: [-1, -2, -3], aktuell: -4, jetzt: 40, rest: 60 });
  assert.deepEqual(t.verschoben, []);
  assert.equal(t.minuten[-4], 10, "the topic on screen keeps its minutes");
  assert.equal(t.minuten[-11], 5, "the Abschluss keeps its minutes");
  // 45 minutes for 50 planned, in steps of 5 like the plan
  assert.equal(summeVon(t.minuten, THEMA("E-Mail")), 25);
  assert.equal(summeVon(t.minuten, THEMA("Tagesablauf")), 20);
  for (const id of [-7, -10]) assert.ok(t.minuten[id] >= sp.KONTROLLE_MIN, `Lernkontrolle ${id}: ${t.minuten[id]}`);
  // done steps as planned; the open ones from now on, one after the other, ending with the time left
  assert.deepEqual([t.minuten[-1], t.minuten[-2], t.minuten[-3]], [10, 10, 15]);
  assert.deepEqual([t.ab[-1], t.ab[-2], t.ab[-3]], [0, 10, 20]);
  assert.equal(t.ab[-4], 40);
  const offen = PLAN.slice(3).map((s) => s.id);
  for (let i = 1; i < offen.length; i++) assert.equal(t.ab[offen[i]], t.ab[offen[i - 1]] + t.minuten[offen[i - 1]]);
  assert.equal(t.ab[-11] + t.minuten[-11], 100);

  // never longer than planned: time to spare stretches nothing
  const frueh = sp.neuTakten(PLAN, { fertig: [-1], aktuell: -2, jetzt: 6, rest: 94 });
  for (const s of PLAN) assert.equal(frueh.minuten[s.id], s.minuten, `${s.id}`);
  assert.equal(frueh.ab[-2], 6);

  // a topic that would drop under 10 minutes goes to next time instead of being squeezed
  const spaet = sp.neuTakten(PLAN, { fertig: [-1, -2, -3], aktuell: -4, jetzt: 62, rest: 38, vorher: t });
  assert.deepEqual(spaet.verschoben, THEMA("Tagesablauf"));
  assert.equal(summeVon(spaet.minuten, THEMA("E-Mail")), 23);
  for (const id of THEMA("Tagesablauf")) {
    assert.equal(spaet.minuten[id], 0);
    assert.equal(spaet.ab[id], undefined, "no minute a–b for next time");
  }
  assert.ok(spaet.minuten[-7] >= sp.KONTROLLE_MIN);
  assert.equal(spaet.ab[-11] + spaet.minuten[-11], 100);
  // done steps keep what they had
  assert.deepEqual([spaet.minuten[-3], spaet.ab[-3]], [t.minuten[-3], t.ab[-3]]);

  // it stays next time while the teacher goes on; the shortened topic on screen stays short
  const weiter = sp.neuTakten(PLAN, { fertig: [-1, -2, -3, -4], aktuell: -5, jetzt: 70, rest: 30, vorher: spaet });
  assert.deepEqual(weiter.verschoben, THEMA("Tagesablauf"));
  assert.equal(summeVon(weiter.minuten, THEMA("E-Mail")), 23, "not stretched back to 30");
  assert.deepEqual([weiter.minuten[-4], weiter.ab[-4]], [spaet.minuten[-4], spaet.ab[-4]], "a done step does not change");
  // opening one of its steps brings the topic back
  const zurueck = sp.neuTakten(PLAN, { fertig: [-1, -2, -3, -4], aktuell: -8, jetzt: 70, rest: 30, vorher: spaet });
  assert.deepEqual(zurueck.verschoben, []);
  assert.equal(zurueck.ab[-8], 70);
});

// ---------- with the database ----------

let nr = 0;
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundener Stoffzettel ${++nr}`)]);

/** Antwort des Ersatz-Transports bei „Ausführlicher erklären“. */
const AUSFUEHRLICH = {
  sagt: "Mit dem Past Simple erzählst du, was schon vorbei ist. Bei regelmäßigen Verben hängst du -ed an: play wird played. Viele wichtige Verben sind unregelmäßig, die lernst du auswendig: go wird went. Signalwörter sind yesterday, last week oder two days ago. Im Satz bleibt die Form für alle Personen gleich.",
  beispiel: { aufgabe: "Yesterday I ___ (walk) to school.", rechnung: [], loesung: "walked – regelmäßig, also -ed" },
  frage: "What did you do last weekend?",
  antwort: "z. B. I played football.",
  frage_rechnung: null,
  fehler: ["-ed bei unregelmäßigen Verben (goed): die Liste der unregelmäßigen Verben üben", "did und Past-Form zusammen (did went): nach did steht die Grundform"],
};

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  let antwort: unknown = STOFF_ENGLISCH_MORE;
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: req.fn === "ausfuehrlich" ? AUSFUEHRLICH : antwort, refusal: false, model: req.model, usage: { input: 1_200, output: 900, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string, klasse = 2) =>
    repo.createStudent({
      name, grade: 4 + klasse, klasse, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Englisch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const sid = schueler("Lina Probestein");
  const heute = zeit.wienerDatum();
  repo.addTest({ student_id: sid, date: zeit.tagAddieren(heute, 6), subject: "Englisch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["englisch.tenses.pastsimple", "englisch.writing.email"], title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
  /** started `vor` minutes ago, with the Vorgabe of the Stoffzettel: the plan of lib/stundenplan.test.ts */
  const start = async (vor = 0) => {
    const unit = units.startUnit(teacher.id, sid, { subject: "Englisch", at: Date.now() - vor * 60_000 }).unit;
    const { saveUpload } = await import("./materials");
    const vg = await import("./vorgabe");
    const datei = saveUpload({ name: "zettel.jpg", data: jpeg() }, { title: "Stoffzettel", studentId: sid, teacherId: teacher.id }).id;
    assert.ok("ok" in (await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "", materialIds: [datei], testId: null, keinName: true, heute })));
    return unit;
  };
  /** the unit began `vor` minutes ago (the clock moves on) */
  const begonnen = (unitId: number, vor: number) => db().prepare("UPDATE units SET started_at = ? WHERE id = ?").run(new Date(Date.now() - vor * 60_000).toISOString(), unitId);
  const kiAufrufe = (fn?: string) => (db().prepare(`SELECT COUNT(*) AS n FROM ai_calls${fn ? " WHERE fn = ?" : ""}`).get(...(fn ? [fn] : [])) as { n: number }).n;
  const zaehle = (tabelle: "worksheets" | "assignments") => (db().prepare(`SELECT COUNT(*) AS n FROM ${tabelle}`).get() as { n: number }).n;
  return { db, repo, units, c, zeit, router, teacher, sid, schueler, start, begonnen, gefragt, kiAufrufe, zaehle, setAntwort: (a: unknown) => (antwort = a) };
}

test("the plan re-times when the teacher moves on: 100-minute Englisch, the first topic ran over, Minute a–b follows", async () => {
  const s = await setup();
  const unit = await s.start(10);
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  assert.equal(plan.length, 11);
  const [einstieg, erklaeren, ueben, kontrolle] = plan;
  assert.ok(s.c.markiereSchritt(unit.id, einstieg.id, "erledigt"));
  s.begonnen(unit.id, 20);
  assert.ok(s.c.markiereSchritt(unit.id, erklaeren.id, "erledigt"));
  // Üben was planned until minute 35; the teacher moves on at 40
  s.begonnen(unit.id, 40);
  assert.ok(s.c.markiereSchritt(unit.id, ueben.id, "erledigt"));
  const d = s.c.cockpit(unit.id, { mitPlan: true });
  assert.equal(d.planAktuell?.id, kontrolle.id);
  assert.equal(d.ab.get(kontrolle.id), 40, "Minute 40–50");
  assert.equal(d.minuten.get(kontrolle.id), 10);
  assert.equal(d.ab.get(einstieg.id), 0, "done steps keep their time");
  assert.equal(d.ab.get(ueben.id), 20);
  const themen = (await import("./stundenplan")).themenDesPlans(plan.map((x) => ({ ...x, minuten: d.minuten.get(x.id) ?? x.minuten })));
  assert.deepEqual(
    themen.map((t) => t.minuten),
    [35, 25, 20],
    "E-Mail and Tagesablauf share the 45 minutes left, in steps of 5",
  );
  const letzter = plan.at(-1)!;
  assert.equal(d.ab.get(letzter.id)! + d.minuten.get(letzter.id)!, 100, "the plan's own length, not more");
  assert.equal(d.verschoben.size, 0);

  // the Lernkontrolle takes long: at minute 64 the last topic no longer fits and goes to next time
  s.begonnen(unit.id, 64);
  assert.ok(s.c.markiereSchritt(unit.id, kontrolle.id, "erledigt"));
  const e = s.c.cockpit(unit.id, { mitPlan: true });
  const tagesablauf = plan.filter((x) => x.thema === "Wortschatz: Tagesablauf").map((x) => x.id);
  assert.deepEqual([...e.verschoben].sort(), [...tagesablauf].sort());
  assert.ok(tagesablauf.every((id) => !e.ab.has(id)));
  assert.equal(e.planAktuell?.thema, "E-Mail an Freunde schreiben");
  // the steps of next time are not reached: the documentation and the Abschluss say „Weiter mit …“
  const z = s.c.zusammenfassung(plan, plan.map((x) => x.id), e.stand);
  assert.ok(tagesablauf.every((id) => z.nichtErreicht.some((x) => x.id === id)));
  s.router.setTransport(null);
});

test("the time left: never more than the plan, never past the end of the slot", async () => {
  const s = await setup();
  const unit = await s.start();
  const jetzt = new Date("2026-10-27T14:40:00Z"); // 15:40 in Vienna
  const fake = { id: unit.id, started_at: "2026-10-27T14:00:00.000Z" };
  assert.deepEqual(s.c.zeitDerEinheit(fake, 100, jetzt), { jetzt: 40, rest: 60 }, "without a slot: planned minutes minus elapsed");
  // a slot 15:00–16:00 for this unit: 20 minutes left
  const tag = "2026-10-27";
  s.db()
    .prepare(
      `INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, unit_id, created_at, updated_at)
       VALUES (?, ?, 900, 60, ?, ?, NULL, 'veroeffentlicht', 0, ?, datetime('now'), datetime('now'))`,
    )
    .run(s.zeit.wochenstartVon(tag), s.zeit.wochentagVon(tag), s.teacher.id, s.sid, unit.id);
  assert.deepEqual(s.c.zeitDerEinheit(fake, 100, jetzt), { jetzt: 40, rest: 20 });
  // a long slot does not stretch the plan
  s.db().prepare("UPDATE geplante_einheiten SET geplante_dauer = 180 WHERE unit_id = ?").run(unit.id);
  assert.deepEqual(s.c.zeitDerEinheit(fake, 100, jetzt), { jetzt: 40, rest: 60 });
  s.router.setTransport(null);
});

test("the next exercise is ready: only one step ahead, never visible to the student, rebuilt when it no longer fits, sent as is", async () => {
  const s = await setup();
  const unit = await s.start();
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  const [einstieg, erklaeren, ueben, kontrolle] = plan;
  assert.equal(ueben.art, "ueben");
  assert.equal(kontrolle.art, "kontrolle");
  const vorher = { ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") };
  const bereit = () => (s.db().prepare("SELECT schritt_id, schluessel, aufgaben FROM einheit_bereit WHERE unit_id = ? ORDER BY schritt_id DESC").all(unit.id) as { schritt_id: number; schluessel: string; aufgaben: string }[]);
  // on the Einstieg: the next step with an exercise (Üben), not the one after it
  assert.deepEqual(s.c.haltBereit(unit.id), [ueben.id]);
  assert.deepEqual(bereit().map((r) => r.schritt_id), [ueben.id]);
  // nothing for the student: no exercise, no assignment
  assert.deepEqual({ ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") }, vorher);
  // what the step shows is what is ready
  const fertig = JSON.parse(bereit()[0].aufgaben) as { prompt: string }[];
  assert.deepEqual(s.c.aufgabenImSchritt(unit.id, ueben).map((a) => a.prompt), fertig.map((a) => a.prompt));
  s.c.markiereSchritt(unit.id, einstieg.id, "erledigt");
  s.c.markiereSchritt(unit.id, erklaeren.id, "erledigt");
  // on Üben: its own exercise (not sent yet) and the Lernkontrolle next
  assert.deepEqual(s.c.haltBereit(unit.id), [ueben.id, kontrolle.id]);
  // no longer fitting (another plan, level or count): built again
  s.db().prepare("UPDATE einheit_bereit SET schluessel = 'alt', aufgaben = '[]' WHERE unit_id = ? AND schritt_id = ?").run(unit.id, kontrolle.id);
  s.c.haltBereit(unit.id);
  const neu = bereit().find((r) => r.schritt_id === kontrolle.id)!;
  assert.notEqual(neu.schluessel, "alt");
  assert.equal((JSON.parse(neu.aufgaben) as unknown[]).length, 3, "three tasks for the Lernkontrolle");
  // sending takes exactly the ready tasks and removes them
  const zuSenden = (JSON.parse(bereit().find((r) => r.schritt_id === ueben.id)!.aufgaben) as { prompt: string }[]).map((a) => a.prompt);
  const out = await s.c.sendeAusGenerator(unit.id, ueben.skillId!, s.teacher.id, ueben.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  assert.deepEqual(s.repo.listTasks(out.worksheetId).map((t) => t.prompt), zuSenden);
  assert.equal(s.repo.getWorksheet(out.worksheetId)?.source, "generator");
  assert.ok(!bereit().some((r) => r.schritt_id === ueben.id));
  // the Lernkontrolle sent is the one prepared
  const lk = (JSON.parse(bereit().find((r) => r.schritt_id === kontrolle.id)!.aufgaben) as { prompt: string }[]).map((a) => a.prompt);
  s.c.markiereSchritt(unit.id, ueben.id, "erledigt");
  const out2 = await s.c.sendeAusGenerator(unit.id, kontrolle.skillId!, s.teacher.id, kontrolle.id);
  assert.ok("worksheetId" in out2);
  assert.deepEqual(s.repo.listTasks(out2.worksheetId).map((t) => t.prompt), lk);
  // a finished unit keeps nothing ready
  s.db().prepare("UPDATE units SET status = 'beendet' WHERE id = ?").run(unit.id);
  assert.deepEqual(s.c.haltBereit(unit.id), []);
  assert.equal(bereit().length, 0);
  s.router.setTransport(null);
});

test("teacher script without a package: the whole explanation, a worked example from a real task, then the question", async () => {
  const s = await setup();
  const unit = await s.start();
  const { EXPLAIN } = await import("./erklaerungen");
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  const email = plan.find((x) => x.art === "erklaeren" && x.skillId === "englisch.writing.email");
  const past = plan.find((x) => x.art === "erklaeren" && x.skillId === "englisch.tenses.pastsimple")!;
  if (email) assert.equal(s.c.planFuehrung(unit.id, email).sagt, EXPLAIN["englisch.writing.email"], "not cut");
  const f = s.c.planFuehrung(unit.id, past);
  assert.equal(f.sagt, EXPLAIN["englisch.tenses.pastsimple"]);
  const aufgaben = s.c.aufgabenImSchritt(unit.id, past);
  assert.ok(aufgaben.length >= 2);
  assert.equal(f.fragt, s.c.frageText(aufgaben[0]));
  // Abnahme Phase A: the worked example is a task of the same skill that the student does not get
  const bsp = s.c.beispielZur(unit.id, past.skillId!, aufgaben)!;
  assert.ok(bsp && [bsp.skillId, ...(bsp.skillIds ?? [])].includes(past.skillId));
  assert.deepEqual(f.zeigt, { aufgabe: s.c.frageText(bsp), loesung: s.c.loesungText(bsp) });
  const ueben = plan.find((x) => x.art === "ueben" && x.skillId === past.skillId)!;
  const kontrolle = plan.find((x) => x.art === "kontrolle" && x.skillId === past.skillId)!;
  const andere = [...s.c.aufgabenImSchritt(unit.id, ueben), ...s.c.aufgabenImSchritt(unit.id, kontrolle)];
  const gesendet = new Set([...aufgaben, ...andere].map(s.c.frageText));
  assert.ok(!gesendet.has(s.c.planFuehrung(unit.id, past, [], andere).zeigt!.aufgabe), "none of the tasks the topic sends");

  // an exercise from the Bestand that mixes skills: the question is of the step's skill, the example of none of its tasks
  const aufgabe = (skillId: string, prompt: string, loesung: string) => ({ type: "grammar" as const, skillId, difficulty: "mittel" as const, prompt, data: {}, answer: { accepted: [loesung], mode: "text" as const }, solution: loesung, hints: [], errorMap: [] });
  const gemischt = s.repo.createWorksheet(
    { title: "Verbs revision", subject: "Englisch", grade: 6, school_type: "Gymnasium", klasse: 2, topic: "Past Simple", difficulty: "mittel", task_type: "grammar", kind: "uebung", source: "manuell", skill_ids: ["englisch.tenses.pastsimple", "englisch.vocab.irregular"] },
    [
      aufgabe("englisch.vocab.irregular", "Write the 3rd form (past participle): go", "gone"),
      aufgabe("englisch.tenses.pastsimple", "Yesterday we ___ (watch) a film.", "watched"),
      aufgabe("englisch.tenses.pastsimple", "Last week she ___ (visit) her aunt.", "visited"),
      aufgabe("englisch.tenses.pastsimple", "Two days ago they ___ (play) chess.", "played"),
    ],
  );
  const g = s.c.planFuehrung(unit.id, { ...ueben, art: "erklaeren", uebung: `U${gemischt}` });
  assert.equal(g.fragt, "Yesterday we ___ (watch) a film.", "the task of another skill is not asked");
  assert.ok(g.zeigt && !/3rd form|Yesterday we|Last week she|Two days ago/.test(g.zeigt.aufgabe), `example from the exercise: ${g.zeigt?.aufgabe}`);

  // long texts stay readable: the first sentences, the rest under „Mehr“
  const lang = "Erster Satz mit z. B. einer Abkürzung. Zweiter Satz ist auch da. Dritter Satz kommt hier. Vierter Satz und noch viel mehr Text, damit es sich lohnt.";
  const { kurz, rest } = s.c.ersteSaetze(lang);
  assert.equal(kurz, "Erster Satz mit z. B. einer Abkürzung. Zweiter Satz ist auch da. Dritter Satz kommt hier.");
  assert.equal(rest, "Vierter Satz und noch viel mehr Text, damit es sich lohnt.");
  assert.deepEqual(s.c.ersteSaetze("Kurz. Und gut. Fertig. Ende."), { kurz: "Kurz. Und gut. Fertig. Ende.", rest: "" }, "a short rest stays visible");
  // background: the teacher's own line first, at most two lines
  const h = s.c.hintergrundZu("englisch.tenses.pastsimple", ["Ziel: Erzählen in der Vergangenheit", "", null]);
  assert.equal(h[0], "Ziel: Erzählen in der Vergangenheit");
  assert.ok(h.length <= 2 && h.length >= 1);
  assert.deepEqual(s.c.hintergrundZu(null), []);
  s.router.setTransport(null);
});

test("„Ausführlicher erklären“: one paid call, then from the store for every student of that Schulstufe; no student data in the prompt", async () => {
  const s = await setup();
  const a = await import("./ausfuehrlich");
  const skill = "englisch.tenses.pastsimple";
  const lina = s.repo.getStudent(s.sid)!;
  const ben = s.repo.getStudent(s.schueler("Ben Musterkind"))!;
  const stufe = a.schulstufeVon(lina);
  assert.equal(a.schulstufeVon(ben), stufe);
  assert.ok(a.istDuenn((await import("./cockpit")).erklaerungZu(skill)), "Past Simple has a short text");
  const tor = a.ausfuehrlichTor();
  assert.ok(tor.erlaubt);
  if (tor.erlaubt) assert.match(tor.kosten, /^ca\. \d+ Cent$/);

  const vorher = s.kiAufrufe("ausfuehrlich");
  const eins = await a.erklaereAusfuehrlich(skill, stufe, s.teacher.id);
  assert.ok(eins.ok && eins.neu);
  assert.equal(s.kiAufrufe("ausfuehrlich"), vorher + 1);
  const row = s.db().prepare("SELECT cost_usd, unit_id, status FROM ai_calls WHERE fn = 'ausfuehrlich'").get() as { cost_usd: number; unit_id: number | null; status: string };
  assert.ok(row.cost_usd > 0 && row.status === "ok" && row.unit_id === null);
  // the request knows skill, Fach and Schulstufe, no student
  const req = s.gefragt.find((r) => r.fn === "ausfuehrlich")!;
  const text = `${req.system}\n${JSON.stringify(req.content)}`;
  assert.match(text, /Schulstufe: 6/);
  assert.match(text, /Fach: Englisch/);
  for (const n of ["Lina", "Probestein", "Ben", "Musterkind"]) assert.ok(!text.includes(n), n);

  // a second tap and another student of the same Schulstufe: from the store, no cost
  const zwei = await a.erklaereAusfuehrlich(skill, stufe, s.teacher.id);
  assert.ok(zwei.ok && !zwei.neu);
  const drei = await a.erklaereAusfuehrlich(skill, a.schulstufeVon(ben), s.teacher.id);
  assert.ok(drei.ok && !drei.neu);
  assert.equal(s.kiAufrufe("ausfuehrlich"), vorher + 1);
  assert.deepEqual(a.gespeicherteErklaerung(skill, stufe)?.fehler.length, 2);
  // two taps at the same moment: one call
  const [x, y] = await Promise.all([a.erklaereAusfuehrlich(skill, 7, s.teacher.id), a.erklaereAusfuehrlich(skill, 7, s.teacher.id)]);
  assert.ok(x.ok && y.ok);
  assert.equal(s.kiAufrufe("ausfuehrlich"), vorher + 2);

  // KI off: the button says so, nothing is asked, the stored text stays readable
  process.env.AI_DISABLED = "1";
  try {
    assert.deepEqual(a.ausfuehrlichTor(), { erlaubt: false, grund: "Die KI ist aus." });
    const aus = await a.erklaereAusfuehrlich("englisch.writing.email", stufe, s.teacher.id);
    assert.deepEqual(aus, { ok: false, error: "Die KI ist aus." });
    assert.equal(s.kiAufrufe("ausfuehrlich"), vorher + 2);
    assert.ok(a.gespeicherteErklaerung(skill, stufe));
  } finally {
    delete process.env.AI_DISABLED;
  }
  s.router.setTransport(null);
});

test("„Ausführlicher erklären“ in Mathematik: a part with a wrong calculation is left out, the rest stays", async () => {
  const { pruefeAusfuehrlich } = await import("./ai/ausfuehrlich");
  const gut = {
    sagt: "Brüche mit gleichem Nenner addierst du, indem du die Zähler addierst. Der Nenner bleibt gleich. Zum Beispiel 1/5 + 2/5 = 3/5. Danach kürzt du, wenn es geht.",
    beispiel: { aufgabe: "2/7 + 3/7", rechnung: ["2/7 + 3/7 = 5/7"], loesung: "5/7" },
    frage: "Was ist 1/4 + 2/4?",
    antwort: "3/4",
    frage_rechnung: "1/4 + 2/4 = 3/4",
    fehler: ["Nenner mitaddieren (2/8): der Nenner sagt nur, wie groß die Teile sind", "nicht kürzen"],
  };
  const ok = pruefeAusfuehrlich(gut, "Mathematik");
  assert.ok("inhalt" in ok && ok.weggelassen === 0 && ok.inhalt.beispiel && ok.inhalt.frage);
  const falsch = pruefeAusfuehrlich({ ...gut, beispiel: { ...gut.beispiel, rechnung: ["2/7 + 3/7 = 5/14"] }, frage_rechnung: "1/4 + 2/4 = 3/8" }, "Mathematik");
  assert.ok("inhalt" in falsch);
  assert.equal(falsch.inhalt.beispiel, null);
  assert.equal(falsch.inhalt.frage, null);
  assert.equal(falsch.inhalt.antwort, null);
  assert.equal(falsch.weggelassen, 2);
  assert.ok(falsch.inhalt.sagt, "the text itself is right and stays");
  // a wrong chain in the text itself drops the text
  const text = pruefeAusfuehrlich({ ...gut, sagt: gut.sagt.replace("1/5 + 2/5 = 3/5", "1/5 + 2/5 = 3/10") }, "Mathematik");
  assert.ok("inhalt" in text && text.inhalt.sagt === null);
  // nothing usable left
  assert.ok("fehler" in pruefeAusfuehrlich({ ...gut, sagt: "", beispiel: { ...gut.beispiel, rechnung: ["1 + 1 = 3"] }, frage: "" }, "Mathematik"));
  // outside Mathematik nothing is calculated
  assert.ok("inhalt" in pruefeAusfuehrlich({ ...gut, beispiel: { ...gut.beispiel, rechnung: ["1 + 1 = 3"] } }, "Englisch"));
});
