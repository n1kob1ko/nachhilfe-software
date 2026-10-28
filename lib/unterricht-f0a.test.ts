/**
 * Offene Punkte aus den Testläufen C, D und E im Unterricht (F0a): frei gewordene Minuten gehen an das nächste Üben, der Plan
 * behält spät am Abend und nach Mitternacht seine Dauer, „Anderes Thema“ geht auch mit einem gewählten Lernpaket, „Schwerere
 * Aufgaben“ hat einen Weg über die KI (immer erst als Vorschau) und die Vorschau neuer Aufgaben hat „Drucken“.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt, mit festen Tokens. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR",
])
  delete process.env[k];

const DIV = "mathe.brueche.dividieren";
const MUL = "mathe.brueche.multiplizieren";
const KUE = "mathe.brueche.kuerzen";
const RUNDEN = "mathe.zahlen.runden";
const USAGE = { input: 2_000, output: 1_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 };

/** eine Aufgabe, wie die KI sie bei „neue_aufgabe“ liefert */
const kiAufgabe = (prompt: string, antwort: string) => ({
  category: "rechnen", format: "calc", skill_ids: [RUNDEN], topic: "Zahlen", difficulty: "schwer", prompt, passage: null, options: null, correct_option: null,
  accepted_answers: [antwort], numeric: true, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null,
  answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["Runden"], solution: "Auf die Ziffer danach schauen.", solution_steps: [], estimated_time_sec: 60, hints: ["Welche Ziffer entscheidet?"], common_errors: [],
});
const NEU = { tasks: [kiAufgabe("Runde 86 249 auf Tausender.", "86000"), kiAufgabe("Runde 4 449 951 auf Zehntausender.", "4450000")] };

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const sp = await import("./stundenplan");
  const k = await import("./knoepfe");
  const nb = await import("./ki-nachschub");
  const eb = await import("./ai/einheit-budget");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  const { resetKiModusCache } = await import("./ai/modus");
  resetKiModusCache();
  router.resetRouter();
  router.setTransport(null);
  const gefragt: AIRequest[] = [];
  /** die KI „an“: jede Anfrage geht an diesen Ersatz, nie nach außen */
  const kiAn = () =>
    router.setTransport(async (req) => {
      gefragt.push(req);
      return { parsed: NEU, refusal: false, model: req.model, usage: USAGE };
    });
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string, o: { fach?: string; schulart?: string; klasse?: number } = {}) =>
    repo.createStudent({
      name, grade: 6, klasse: o.klasse ?? 2, teacher_id: teacher.id, school: "", school_type: o.schulart ?? "Mittelschule", subjects: [o.fach ?? "Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  /** eine Einheit mit festgehaltenem Plan aus Blöcken (je Fähigkeit und Minuten), Einstieg und Abschluss je 10 Minuten */
  const einheit = (sid: number, bloecke: [string, number][], vor = 15) => {
    const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik", at: Date.now() - vor * 60_000 }).unit;
    const roh = [
      { titel: "Einstieg und Wiederholung", minuten: 10, beschreibung: "", uebung: null, skillId: null, art: "einstieg" as const, thema: null, quelle: null },
      ...bloecke.flatMap(([id, m]) => sp.schritteZurFaehigkeit(id, m)),
      { titel: "Abschluss", minuten: 10, beschreibung: "", uebung: null, skillId: null, art: "abschluss" as const, thema: null, quelle: null },
    ];
    const plan = roh.map((s, i) => ({ ...s, id: -(i + 1) }));
    db().prepare("INSERT INTO einheit_cockpit (unit_id, plan) VALUES (?, ?)").run(unit.id, JSON.stringify(plan));
    return { unit, plan, ids: (thema: string) => plan.filter((s) => s.thema === thema).map((s) => s.id) };
  };
  /** das Ende des Plans: der späteste offene Schritt, mit seinen neu getakteten Minuten */
  const ende = (d: ReturnType<typeof c.cockpit>) => Math.max(...d.plan.filter((x) => d.ab.has(x.id)).map((x) => d.ab.get(x.id)! + d.minuten.get(x.id)!));
  const zaehle = (tabelle: "worksheets" | "assignments") => db().prepare(`SELECT COUNT(*) FROM ${tabelle}`).pluck().get() as number;
  return { db, repo, units, c, sp, k, nb, eb, zeit, router, teacher, schueler, einheit, ende, kiAn, gefragt, zaehle };
}

const ok = <T extends object>(x: T | { fehler: string }): T => {
  assert.ok(!("fehler" in x), "fehler" in x ? x.fehler : "");
  return x as T;
};

// ---------- 1. freed minutes go to the next practice steps ----------

/** Der Englisch-Plan von 100 Minuten (wie lib/unterricht-schritt.test.ts), mit Üben-Schritten. */
const PLAN = [
  { id: -1, minuten: 10, thema: null, kontrolle: false },
  { id: -2, minuten: 10, thema: "Past Simple", kontrolle: false },
  { id: -3, minuten: 15, thema: "Past Simple", kontrolle: false, ueben: true },
  { id: -4, minuten: 10, thema: "Past Simple", kontrolle: true },
  { id: -5, minuten: 10, thema: "E-Mail", kontrolle: false },
  { id: -6, minuten: 10, thema: "E-Mail", kontrolle: false, ueben: true },
  { id: -7, minuten: 10, thema: "E-Mail", kontrolle: true },
  { id: -8, minuten: 5, thema: "Tagesablauf", kontrolle: false },
  { id: -9, minuten: 10, thema: "Tagesablauf", kontrolle: false, ueben: true },
  { id: -10, minuten: 5, thema: "Tagesablauf", kontrolle: true },
  { id: -11, minuten: 5, thema: null, kontrolle: false },
];
const endeVon = (t: { minuten: Record<string, number>; ab: Record<string, number>; verschoben: number[] }, ids: number[]) => Math.max(...ids.filter((id) => !t.verschoben.includes(id) && t.ab[id] !== undefined).map((id) => t.ab[id] + t.minuten[id]));

test("re-timing: after „Thema verstanden“ the freed minutes go to the next practice steps (up to 25 each); the plan ends at 100, not at 81", async () => {
  const sp = await import("./stundenplan");
  // Phase D: at minute 15 the teacher says Past Simple is understood; Erklären and Üben are left out, the Lernkontrolle stays
  const t = sp.neuTakten(PLAN, { fertig: [-1, -2, -3], aktuell: -4, jetzt: 15, rest: 85 });
  assert.deepEqual(t.verschoben, []);
  assert.equal(endeVon(t, PLAN.map((s) => s.id)), 100, "ends with the unit");
  assert.equal(t.frei, undefined);
  // the Lernkontrollen, the explanations, Einstieg and Abschluss keep their minutes
  for (const s of PLAN.filter((x) => !x.ueben && x.id !== -1)) assert.equal(t.minuten[s.id], s.minuten, `${s.id}`);
  // 85 − 65 = 20 minutes: first to the next practice step up to 25, the rest to the one after
  assert.equal(t.minuten[-6], 25);
  assert.equal(t.minuten[-9], 15);
  for (const id of [-6, -9]) assert.ok(t.minuten[id] <= sp.UEBEN_MAX);

  // the first steps were quicker (the Einstieg took 6 instead of 10): the next practice step gets the 4 minutes
  const frueh = sp.neuTakten(PLAN, { fertig: [-1], aktuell: -2, jetzt: 6, rest: 94 });
  assert.equal(frueh.minuten[-3], 19);
  for (const s of PLAN.filter((x) => x.id !== -3 && x.id !== -1)) assert.equal(frueh.minuten[s.id], s.minuten, `${s.id}`);
  assert.equal(endeVon(frueh, PLAN.map((s) => s.id)), 100);

  // the time is short: nothing is given, later topics shrink as before
  const spaet = sp.neuTakten(PLAN, { fertig: [-1, -2, -3], aktuell: -4, jetzt: 40, rest: 60 });
  for (const id of [-6, -9]) assert.ok(spaet.minuten[id] <= PLAN.find((x) => x.id === id)!.minuten, "not stretched");
  assert.ok(endeVon(spaet, PLAN.map((s) => s.id)) <= 100, "shrunk to fit");
  assert.equal(spaet.frei, undefined);
});

test("re-timing: after „Anderes Thema“ the moved topic's minutes go to the practice of the rest; what no practice can take is „frei“", async () => {
  const sp = await import("./stundenplan");
  // Phase D: at minute 20 the teacher switches from Past Simple to E-Mail; Üben and Lernkontrolle of Past Simple go to next time
  const vorher = { minuten: {}, ab: {}, verschoben: [-3, -4] };
  const t = sp.neuTakten(PLAN, { fertig: [-1, -2], aktuell: -5, jetzt: 20, rest: 80, vorher });
  assert.deepEqual(t.verschoben, [-3, -4]);
  // 80 minutes for 55 planned: E-Mail's practice up to 25, the rest to Tagesablauf's
  assert.equal(t.minuten[-6], 25);
  assert.equal(t.minuten[-9], 20);
  assert.equal(endeVon(t, PLAN.map((s) => s.id)), 100, "not at 61");
  for (const id of [-7, -10]) assert.equal(t.minuten[id], PLAN.find((x) => x.id === id)!.minuten, "the Lernkontrolle as planned");

  // only the Lernkontrolle and the Abschluss are left: nothing to give the time to, it stays free
  const rest = sp.neuTakten(PLAN, { fertig: [-1, -2, -3, -5, -6, -7, -8, -9], aktuell: -4, jetzt: 30, rest: 70 });
  assert.equal(rest.frei, 70 - 10 - 5 - 5);
  assert.equal(rest.minuten[-4], 10);
  assert.ok(endeVon(rest, PLAN.map((s) => s.id)) < 100);

  // the practice steps take what is free in order, each up to 25 minutes; a step already longer takes nothing
  const v = sp.verteileFrei([{ id: 1, minuten: 15 }, { id: 2, minuten: 30 }, { id: 3, minuten: 20 }], 30);
  assert.deepEqual([...v.minuten], [[1, 25], [3, 25]]);
  assert.equal(v.rest, 15);
  assert.deepEqual(sp.verteileFrei([], 12), { minuten: new Map(), rest: 12 });
  assert.deepEqual(sp.verteileFrei([{ id: 1, minuten: 15 }], -3), { minuten: new Map(), rest: 0 });
});

test("in the unit: „Thema verstanden“ fills the plan up to the unit's end; time left with no practice: a topic from the data comes in before the Abschluss", async () => {
  const s = await setup();
  const sid = s.schueler("Rosa Zeitreich");
  const heute = s.zeit.wienerDatum();
  s.repo.addTest({ student_id: sid, date: s.zeit.tagAddieren(heute, 6), subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [KUE], title: "", topics: [], status: "geplant", teacher_id: s.teacher.id, material_id: null });
  const { unit, plan, ids } = s.einheit(sid, [[DIV, 45], [MUL, 35]], 15);
  s.c.markiereSchritt(unit.id, -1, "erledigt");
  const [erklaeren] = ids("Dividieren");
  ok(s.k.themaVerstanden(unit.id, erklaeren, s.teacher.id));
  const d = s.c.cockpit(unit.id);
  assert.equal(s.ende(d) + (d.frei ?? 0), 100);
  const uebenMul = plan.find((x) => x.thema === "Multiplizieren" && x.art === "ueben")!;
  assert.ok(d.minuten.get(uebenMul.id)! > uebenMul.minuten);

  // the teacher goes on through Multiplizieren quickly: at minute 30 only its Lernkontrolle and the Abschluss are left
  const [kDiv] = ids("Dividieren").slice(-1);
  s.c.markiereSchritt(unit.id, kDiv, "erledigt");
  const [eMul, uMul, kMul] = ids("Multiplizieren");
  s.c.markiereSchritt(unit.id, eMul, "erledigt");
  s.db().prepare("UPDATE units SET started_at = ? WHERE id = ?").run(new Date(Date.now() - 30 * 60_000).toISOString(), unit.id);
  s.c.markiereSchritt(unit.id, uMul, "erledigt");
  const e = s.c.cockpit(unit.id);
  assert.equal(e.planAktuell?.id, kMul);
  const frei = e.frei ?? 0;
  assert.ok(frei >= s.sp.THEMA_REST_MIN, `frei ${frei}`);
  assert.equal(s.ende(e) + frei, 100);

  // the choice is the same as for „Anderes Thema“ (here the next exam); nothing is moved, the step on screen stays
  const wahl = s.k.themenZurWahl(unit.id, e, null).filter((w) => w.art === "neu");
  assert.ok(wahl.some((w) => w.art === "neu" && w.skillId === KUE), JSON.stringify(wahl));
  const r = ok(s.k.themaDazu(unit.id, KUE, s.teacher.id));
  assert.equal(r.nach, "Kürzen");
  const f = s.c.cockpit(unit.id);
  assert.equal(f.planAktuell?.id, kMul, "the Lernkontrolle stays on screen");
  assert.equal(f.verschoben.size, 0, "nothing moved");
  const block = f.plan.filter((x) => x.zusatz);
  assert.ok(block.length >= 2 && block.every((x) => x.skillId === KUE && x.thema === "Kürzen"));
  assert.equal(block.reduce((a, x) => a + f.minuten.get(x.id)!, 0), frei, "exactly the free minutes");
  const order = f.plan.map((x) => x.id);
  assert.ok(order.indexOf(block.at(-1)!.id) < order.indexOf(plan.at(-1)!.id), "before the Abschluss");
  assert.equal(s.ende(f), 100);
  assert.equal(f.frei ?? 0, 0);
  // the Abschluss line says it was added, not switched
  assert.match(s.k.angepasstZeile(s.k.knoepfeDerEinheit(unit.id))!, /Thema dazu \(Kürzen\)/);
  // a second time there is no time left
  assert.deepEqual(s.k.themaDazu(unit.id, KUE, s.teacher.id), { fehler: "Dieses Thema steht nicht zur Wahl." });
  s.units.finishUnit(unit.id, "abgebrochen");
});

// ---------- 2. the planned length is the planned length, also late in the evening ----------

test("late in the evening: the plan keeps the slot's length; past midnight the unit's slot still gives it (not the next day's)", async () => {
  const s = await setup();
  const { briefingDaten } = await import("./briefing");
  const sid = s.schueler("Timo Nachtschicht");
  // a slot of 50 minutes on 27.10. at 22:00 (it cannot go past midnight), for this student
  const tag = "2026-10-27";
  const platz = Number(
    s.db()
      .prepare(
        `INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, unit_id, created_at, updated_at)
         VALUES (?, ?, 1320, 50, ?, ?, NULL, 'veroeffentlicht', 0, NULL, datetime('now'), datetime('now'))`,
      )
      .run(s.zeit.wochenstartVon(tag), s.zeit.wochentagVon(tag), s.teacher.id, sid).lastInsertRowid,
  );
  // 23:30 in Vienna: the day of the slot
  assert.equal(briefingDaten(sid, { now: new Date("2026-10-27T22:30:00Z"), platzId: platz, kandidaten: false })?.minuten, 50);
  // 00:20 in Vienna, the next day: before F0a the slot was not „today“ any more and the plan took the student's default (100)
  assert.equal(briefingDaten(sid, { now: new Date("2026-10-27T23:20:00Z"), platzId: platz, kandidaten: false })?.minuten, 50);
  // another student's slot never counts
  const fremd = s.schueler("Ina Fremdplatz");
  assert.equal(briefingDaten(fremd, { now: new Date("2026-10-27T23:20:00Z"), platzId: platz, kandidaten: false })?.minuten, 100);
});

// ---------- 3. „Anderes Thema“ with a chosen Lernpaket ----------

test("„Anderes Thema“ with a chosen Lernpaket: the package becomes a topic of the plan with its state; its open steps go to „Nächstes Mal“", async () => {
  const s = await setup();
  const lp = await import("./lernpakete");
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  const d = JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
  // the example ends with its Lernkontrolle; with an Abschluss as the frame of the package
  d.schritte.push({ ...d.schritte[0], art: "abschluss", titel: "Abschluss", aufgaben: [] });
  d.dauer_minuten += d.schritte[0].minuten;
  const imp = lp.importiereLernpaket(JSON.stringify(d), s.teacher.id);
  assert.ok("id" in imp, JSON.stringify(imp));
  const p = lp.getLernpaket(imp.id)!;
  const sid = s.schueler("Uli Wechselfall", { fach: "Deutsch", schulart: "Volksschule", klasse: 4 });
  // the next exam names another Deutsch skill: it is on offer
  const ziel = s.repo.listSkills().find((x) => x.subject === "Deutsch" && !p.skill_ids.includes(x.id) && x.parent_id !== p.skill_ids[0])!;
  s.repo.addTest({ student_id: sid, date: s.zeit.tagAddieren(s.zeit.wienerDatum(), 5), subject: "Deutsch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [ziel.id], title: "", topics: [], status: "geplant", teacher_id: s.teacher.id, material_id: null });
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  assert.deepEqual(s.c.waehlePaket(unit.id, p.id), { ok: true });
  const [einstieg, erklaerung] = p.schritte;
  const abschluss = p.schritte.find((x) => x.art === "abschluss")!;
  assert.equal(abschluss.id, p.schritte.at(-1)!.id);
  const mitAufgaben = p.schritte.find((x) => x.aufgaben.length > 0 && x.art !== "kontrolle")!;
  s.c.markiereSchritt(unit.id, einstieg.id, "erledigt");
  s.c.markiereSchritt(unit.id, erklaerung.id, "erledigt");
  s.c.setzeNotiz(unit.id, erklaerung.id, "Hat gut mitgemacht.");
  const gesendet = ok(s.c.sendeSchritt(unit.id, mitAufgaben.id, s.teacher.id));
  const vorher = s.c.cockpit(unit.id);
  assert.equal(vorher.paket?.id, p.id);

  const wahl = s.k.themenZurWahl(unit.id, vorher, mitAufgaben.id);
  assert.ok(wahl.some((w) => w.art === "neu" && w.skillId === ziel.id), JSON.stringify(wahl));
  const r = ok(s.k.wechsleThema(unit.id, mitAufgaben.id, { skillId: ziel.id }, s.teacher.id));
  assert.equal(r.nach, ziel.name);

  const c = s.c.cockpit(unit.id);
  assert.equal(c.paket, null, "now the plan of the unit");
  // every package step is still there, with its id, its source and its state
  for (const x of p.schritte) {
    const ps = c.plan.find((y) => y.id === x.id);
    assert.ok(ps, `step ${x.id} kept`);
    assert.deepEqual(ps.quelle, { paketId: p.id, schrittId: x.id });
  }
  assert.ok(c.stand.erledigt.includes(einstieg.id) && c.stand.erledigt.includes(erklaerung.id), "what was done stays done");
  assert.equal(c.stand.notizen[erklaerung.id], "Hat gut mitgemacht.");
  assert.deepEqual(c.stand.gesendet[mitAufgaben.id], [gesendet.worksheetId], "the sent exercise stays with its step");
  // the open steps of the package (not its frame) go to „Nächstes Mal“; nothing is deleted
  const offen = p.schritte.filter((x) => x.id !== einstieg.id && x.id !== erklaerung.id && x.id !== abschluss.id && x.art !== "einstieg" && x.art !== "abschluss").map((x) => x.id);
  assert.deepEqual([...c.verschoben].sort(), [...r.verschoben].sort());
  assert.ok(offen.filter((id) => id !== mitAufgaben.id).every((id) => c.verschoben.has(id)), JSON.stringify([...c.verschoben]));
  assert.ok(!c.verschoben.has(abschluss.id), "the package's Abschluss stays the end of the unit");
  // the new topic is on screen, as a block after the package's steps
  const block = c.plan.filter((x) => x.zusatz);
  assert.ok(block.length >= 2 && block.every((x) => x.skillId === ziel.id));
  assert.equal(c.planAktuell?.id, block[0].id);
  // the Abschluss reads it as a plan: done steps, and the package's open steps under „Weiter mit“
  const ab = s.c.ablaufDerEinheit(unit.id)!;
  assert.equal(ab.art, "plan");
  assert.ok(ab.ergebnis.erledigt.some((x) => x.id === erklaerung.id));
  assert.ok(ab.ergebnis.nichtErreicht.length > 0);
  const log = s.k.knoepfeDerEinheit(unit.id).find((e) => e.art === "thema")!;
  assert.deepEqual([log.inhalt.von, log.inhalt.nach], [p.thema || p.title, ziel.name]);
  // the other buttons work on the package's steps as plan steps
  assert.ok(s.c.markiereSchritt(unit.id, block[0].id, "erledigt"));
  assert.ok(s.c.zeigeSchritt(unit.id, mitAufgaben.id), "a package step can be opened again");
  s.units.finishUnit(unit.id, "abgebrochen");
});

// ---------- 4. „Schwerere Aufgaben“ through the KI, always as a preview; 5. „Drucken“ in the preview ----------

/** Eine Einheit zu Runden (kein Generator, nichts im Bestand): „Schwerere Aufgaben“ hat ohne KI nichts. */
async function rundenEinheit(s: Awaited<ReturnType<typeof setup>>, name: string) {
  const sid = s.schueler(name);
  const e = s.einheit(sid, [[RUNDEN, 40]], 15);
  const ueben = e.plan.find((x) => x.art === "ueben")!.id;
  return { sid, ...e, ueben };
}

test("„Schwerere Aufgaben“ without tasks without KI: „Schwerere Aufgaben erstellen“ on tap, as a preview; only „Senden“ sends exactly them", async () => {
  const s = await setup();
  const { sid, unit, ueben } = await rundenEinheit(s, "Lia Hochstufe");
  const v = s.k.schwererVorschau(unit.id, ueben);
  assert.ok("fehler" in v && v.option, JSON.stringify(v));
  assert.match(v.fehler, /keine Aufgaben ohne KI/);
  const b = s.k.schwererBedarf(unit.id, ueben, v.option!)!;
  assert.equal(b.ziel.art, "schwerer");
  assert.equal(b.ziel.skillId, RUNDEN);
  assert.equal(b.ziel.level, v.option!.level);

  // KI off: no request, the line says why there is nothing
  process.env.AI_DISABLED = "1";
  const aus = s.nb.nachschubAnzeige(unit.id, b, sid);
  assert.equal(aus.tor.ki.erlaubt, false);
  assert.ok("fehler" in (await s.nb.erstelleNachschub(unit.id, b, { automatisch: false, teacherId: s.teacher.id })));
  delete process.env.AI_DISABLED;

  // standard 0 €: nothing by itself, the tap shows the cost
  s.kiAn();
  const a = s.nb.nachschubAnzeige(unit.id, b, sid);
  assert.equal(a.gleich, false, "budget 0 €: nothing without a tap");
  assert.match(a.kosten ?? "", /^ca\. \d+ Cent$/);
  const vorher = { ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") };
  const n = await s.nb.erstelleNachschub(unit.id, b, { automatisch: false, teacherId: s.teacher.id });
  assert.ok(!("fehler" in n) && n.status === "bereit", JSON.stringify(n));
  assert.equal(s.gefragt.length, 1);
  assert.equal(s.gefragt[0].fn, "neue_aufgabe");
  assert.deepEqual({ ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") }, vorher, "nothing for the student before „Senden“");
  assert.equal(s.db().prepare("SELECT unit_id FROM ai_calls ORDER BY id DESC LIMIT 1").pluck().get(), unit.id);
  // the preview stays the same on the next look, without a new request
  assert.equal(s.nb.nachschubAnzeige(unit.id, b, sid).eintrag?.id, n.id);

  const out = ok(await s.k.sendeSchwererKi(unit.id, ueben, n.id, s.teacher.id));
  assert.equal(s.repo.getAssignment(out.assignmentId)?.student_id, sid);
  assert.deepEqual(s.repo.listTasks(out.worksheetId).map((t) => t.prompt), n.aufgaben.map((t) => t.prompt), "exactly the previewed tasks");
  assert.equal(s.repo.getWorksheet(out.worksheetId)?.source, "ki");
  const log = s.k.knoepfeDerEinheit(unit.id).filter((e) => e.art === "schwerer");
  assert.equal(log.length, 1);
  assert.equal(log[0].inhalt.quelleAufgaben, "C");
  assert.equal(log[0].inhalt.stufe, b.ziel.level);
  assert.match(s.k.angepasstZeile(s.k.knoepfeDerEinheit(unit.id))!, /schwerere Aufgaben \(Runden/);
  // sent once: a second tap does not send again; a new tap on the button asks anew (a new round)
  assert.ok("fehler" in (await s.k.sendeSchwererKi(unit.id, ueben, n.id, s.teacher.id)));
  const nochmal = s.k.schwererVorschau(unit.id, ueben);
  assert.ok("fehler" in nochmal && nochmal.option);
  assert.notEqual(s.k.schwererBedarf(unit.id, ueben, nochmal.option!)!.schluessel, b.schluessel);
  // another step's preview cannot be sent through this step
  assert.ok("fehler" in (await s.k.sendeSchwererKi(unit.id, ueben - 1, n.id, s.teacher.id)));
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("„Schwerere Aufgaben“ within the unit's KI budget: asked without a further tap, still only as a preview; over the budget back to the tap", async () => {
  const s = await setup();
  s.kiAn();
  s.eb.setzeStandardBudget(0.3);
  const { sid, unit, ueben } = await rundenEinheit(s, "Max Budgetrand");
  const v = s.k.schwererVorschau(unit.id, ueben);
  assert.ok("fehler" in v && v.option);
  const b = s.k.schwererBedarf(unit.id, ueben, v.option!)!;
  const a = s.nb.nachschubAnzeige(unit.id, b, sid);
  assert.equal(a.gleich, true, "the page asks by itself after showing (components/cockpit/Knoepfe.tsx)");
  const n = await s.nb.erstelleNachschub(unit.id, b, { automatisch: true, teacherId: unit.teacher_id });
  assert.ok(!("fehler" in n) && n.status === "bereit" && n.automatisch);
  assert.equal(s.zaehle("assignments"), 0, "never sent unchecked");
  // never twice by itself for the same
  assert.ok("fehler" in (await s.nb.erstelleNachschub(unit.id, { ...b, schluessel: b.schluessel }, { automatisch: true, teacherId: unit.teacher_id })) || s.gefragt.length === 1);
  assert.equal(s.gefragt.length, 1);
  // over the budget: only on tap, with the reason
  s.db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, unit_id) VALUES (?, 'echtzeit', 'fast', 'claude-sonnet-5-5', 'anthropic', 'ok', 0.5, 0, ?)").run(new Date().toISOString(), unit.id);
  const b2 = { ...b, schluessel: `${b.schluessel}:2` };
  const a2 = s.nb.nachschubAnzeige(unit.id, b2, sid);
  assert.equal(a2.gleich, false);
  assert.match(a2.hinweis ?? "", /Budget dieser Einheit erreicht/);
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("„Drucken“ in the preview: exactly these tasks on A4, not sent, marked as printed in this unit for „Arbeit fotografieren“; a second tap prints the same", async () => {
  const s = await setup();
  const papier = await import("./papier-einheit");
  s.kiAn();
  const { sid, unit, ueben } = await rundenEinheit(s, "Ida Papierweg");
  // in the step: fewer than three tasks without KI, new ones from the KI as a preview (lib/ki-nachschub.ts)
  const c = s.c.cockpit(unit.id, { mitPlan: true });
  const schritt = c.plan.find((x) => x.id === ueben)!;
  const b = s.nb.bedarfImSchritt(unit.id, c, schritt, s.repo.getStudent(sid)!)!;
  assert.ok(b, "the step needs tasks");
  const n = await s.nb.erstelleNachschub(unit.id, b, { automatisch: false, teacherId: s.teacher.id });
  assert.ok(!("fehler" in n) && n.status === "bereit");
  const out = ok(await s.nb.druckeNachschub(unit.id, n.id, s.teacher.id));
  assert.equal(s.zaehle("assignments"), 0, "printed is not sent");
  assert.deepEqual(s.repo.listTasks(out.worksheetId).map((t) => t.prompt), s.nb.vorschauAufgaben(n).map((x) => x.t.prompt));
  assert.equal(s.repo.getWorksheet(out.worksheetId)?.student_id, sid);
  assert.equal(s.c.gedrucktImSchritt(unit.id, ueben), out.worksheetId, "the step says „gedruckt“");
  assert.equal(s.nb.nachschub(n.id)?.status, "gedruckt");
  assert.ok(papier.blaetterDerEinheit(unit.id).some((x) => x.worksheetId === out.worksheetId && x.art === "gedruckt"), "offered for „Arbeit fotografieren“");
  assert.deepEqual(await s.nb.druckeNachschub(unit.id, n.id, s.teacher.id), { worksheetId: out.worksheetId }, "the same sheet again");
  assert.ok("fehler" in (await s.nb.sendeNachschub(unit.id, n.id, s.teacher.id)), "printed, not sent afterwards");

  // „Schwerere Aufgaben“: printing logs the button like sending, with „gedruckt“
  const v = s.k.schwererVorschau(unit.id, ueben);
  assert.ok("fehler" in v && v.option);
  const bs = s.k.schwererBedarf(unit.id, ueben, v.option!)!;
  const ns = await s.nb.erstelleNachschub(unit.id, bs, { automatisch: false, teacherId: s.teacher.id });
  assert.ok(!("fehler" in ns) && ns.status === "bereit");
  const gedruckt = ok(await s.k.druckeSchwererKi(unit.id, ueben, ns.id, s.teacher.id));
  assert.equal(s.zaehle("assignments"), 0);
  const log = s.k.knoepfeDerEinheit(unit.id).filter((e) => e.art === "schwerer");
  assert.deepEqual(log.map((e) => [e.inhalt.gedruckt, e.inhalt.worksheetId]), [[true, gedruckt.worksheetId]]);
  ok(await s.k.druckeSchwererKi(unit.id, ueben, ns.id, s.teacher.id));
  assert.equal(s.k.knoepfeDerEinheit(unit.id).filter((e) => e.art === "schwerer").length, 1, "printed again: logged once");
  // a preview of another unit cannot be printed here
  const andere = s.units.startUnit(s.teacher.id, s.schueler("Ole Nebenan"), { subject: "Mathematik" }).unit;
  assert.ok("fehler" in (await s.nb.druckeNachschub(andere.id, ns.id, s.teacher.id)));
  s.units.finishUnit(unit.id, "abgebrochen");
});
