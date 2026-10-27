/**
 * Der Plan für die ganze Einheit (lib/stundenplan.ts, niko 27.10.2026): mehrere Themen nach Vorrang, Grundlagen zuerst,
 * je Thema Erklären → Üben → Lernkontrolle, geprüfte Lernpakete bevorzugt und auf die Minuten des Themas gebracht, die
 * Minuten zusammen genau die Dauer der Einheit. Ohne KI: der Transport wird ersetzt und antwortet nur beim Lesen der
 * Vorgabe (mit der von Hand geschriebenen Antwort aus lib/fixtures/stoff-englisch-more.ts); der Plan selbst fragt nie.
 * Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import { STOFF_ENGLISCH_MORE } from "./fixtures/stoff-englisch-more";
import type { Signal } from "./vorbereitung-auto";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "stundenplan-"));
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR",
])
  delete process.env[k];

const summe = (xs: { minuten: number }[]) => xs.reduce((a, s) => a + s.minuten, 0);

// ---------- without the database ----------

test("how many topics fit, and their minutes by rank: 3 in 100 minutes, 2 up to 60, 1 up to 40, each at least 20", async () => {
  const sp = await import("./stundenplan");
  assert.equal(sp.themenZahl(100), 3);
  assert.equal(sp.themenZahl(90), 3);
  assert.equal(sp.themenZahl(60), 2);
  assert.equal(sp.themenZahl(50), 2);
  assert.equal(sp.themenZahl(45), 1, "two topics of 17 minutes are too short");
  assert.equal(sp.themenZahl(40), 1);
  assert.deepEqual(sp.rahmen(100), { einstieg: 10, abschluss: 5, themen: 85 });
  assert.deepEqual(sp.themenMinuten(3, 85), [35, 30, 20]);
  assert.deepEqual(sp.themenMinuten(3, 75), [25, 25, 25], "never under 20");
  assert.deepEqual(sp.themenMinuten(2, 40), [20, 20]);
  for (const m of [20, 25, 30, 45, 50, 55, 60, 75, 90, 100, 120]) {
    const r = sp.rahmen(m);
    assert.equal(r.einstieg + r.abschluss + summe(sp.themenMinuten(sp.themenZahl(m), r.themen).map((minuten) => ({ minuten }))), m, `${m} Minuten`);
  }
});

/** Ein Signal wie aus lib/vorbereitung-auto.ts. */
const sig = (art: Signal["art"], skill_ids: string[], o: Partial<Signal> = {}): Signal => ({ art, fach: "Englisch", skill_ids, stoff: [], thema: skill_ids[0] ?? "", warum: `${art}: ${skill_ids.join(", ")}`, ...o });
const NAMEN: Record<string, string> = { past: "Past Simple", present: "Present Simple", email: "E-Mail", order: "Wortstellung", vocab: "Tagesablauf", fragen: "Fragen" };

function eingabe(o: { minuten?: number; signale: Signal[]; lernstand?: Record<string, number>; voraussetzungen?: Record<string, string[]> }) {
  return {
    minuten: o.minuten ?? 100,
    signale: o.signale,
    pakete: [],
    verwandt: (a: string, b: string) => a === b || (a === "present" && b === "fragen") || (a === "fragen" && b === "present"),
    name: (id: string) => NAMEN[id] ?? null,
    voraussetzungen: (id: string) => o.voraussetzungen?.[id] ?? [],
    lernstand: (id: string) => o.lernstand?.[id] ?? null,
  };
}

test("topics: the Vorgabe first (those the exam names in front), then the other signals; the same skill is one topic", async () => {
  const sp = await import("./stundenplan");
  const vorgabe = sig("vorgabe", ["vocab", "order", "past"]);
  const themen = sp.waehleThemen(eingabe({ signale: [vorgabe, sig("pruefung", ["past", "email"], { tage: 6 }), sig("fehler", ["present"])] }));
  assert.deepEqual(
    themen.map((t) => [t.name, t.minuten]),
    [
      ["Past Simple", 35],
      ["Tagesablauf", 30],
      ["Wortstellung", 20],
    ],
  );
  // a short Vorgabe leaves room for the exam, then the repeated error; a related skill is merged
  const kurz = sp.waehleThemen(eingabe({ signale: [sig("vorgabe", ["fragen"]), sig("pruefung", ["past", "email"], { tage: 6 }), sig("fehler", ["present"])] }));
  assert.deepEqual(
    kurz.map((t) => [t.name, t.art]),
    [
      ["Fragen", "vorgabe"],
      ["Past Simple", "pruefung"],
      ["E-Mail", "pruefung"],
    ],
    "Present Simple is the parent of Fragen: no own topic",
  );
  assert.equal(sp.waehleThemen(eingabe({ minuten: 50, signale: kurz.map((t) => sig(t.art, [t.skillId!])) })).length, 2);
  assert.equal(sp.waehleThemen(eingabe({ minuten: 40, signale: kurz.map((t) => sig(t.art, [t.skillId!])) })).length, 1);
});

test("prerequisites first: a weak one gets a Grundlage block, a weak one that is a topic today moves in front; no data is not weak", async () => {
  const sp = await import("./stundenplan");
  const voraussetzungen = { past: ["present"] };
  const eins = sp.waehleThemen(eingabe({ minuten: 40, signale: [sig("vorgabe", ["past"])], lernstand: { present: 0.4 }, voraussetzungen }));
  assert.equal(eins[0].grundlage, "present");
  const plan = sp.bauePlan(eins, 40, { uebung: () => null, schritte: () => [], einstieg: { beschreibung: "", hausuebung: null }, name: (id) => NAMEN[id] ?? null, lernstand: () => 0.4 });
  assert.deepEqual(
    plan.map((s) => s.titel),
    ["Einstieg und Wiederholung", "Grundlage: Present Simple", "Erklären: Past Simple", "Üben: Past Simple", "Lernkontrolle: Past Simple", "Abschluss"],
  );
  assert.equal(summe(plan), 40);
  assert.equal(sp.waehleThemen(eingabe({ minuten: 40, signale: [sig("vorgabe", ["past"])], voraussetzungen }))[0].grundlage, null, "no data: not weak");
  assert.equal(sp.waehleThemen(eingabe({ minuten: 40, signale: [sig("vorgabe", ["past"])], lernstand: { present: 0.75 }, voraussetzungen }))[0].grundlage, null, "gut is secure");
  // the prerequisite is a topic of today: it comes first, without an extra block
  const zwei = sp.waehleThemen(eingabe({ signale: [sig("vorgabe", ["past"]), sig("pruefung", ["email", "present"], { tage: 6 })], lernstand: { present: 0.4 }, voraussetzungen }));
  assert.deepEqual(
    zwei.map((t) => [t.name, t.minuten, t.grundlage]),
    [
      ["Present Simple", 20, null],
      ["Past Simple", 35, null],
      ["E-Mail", 30, null],
    ],
  );
});

test("Phase C: one topic gets no 60 minutes of practice: no step longer than 25 minutes, a second round instead, the minutes stay", async () => {
  const sp = await import("./stundenplan");
  const hilfen = { uebung: () => null, schritte: () => [], einstieg: { beschreibung: "", hausuebung: null }, name: (id: string) => NAMEN[id] ?? null, lernstand: () => null };
  const plan = (minuten: number) => sp.bauePlan(sp.waehleThemen(eingabe({ minuten, signale: [sig("vorgabe", ["past"])] })), minuten, hilfen);
  // 100 minutes, only Past Simple: Erklären → Üben → Lernkontrolle → second round → Lernkontrolle
  const hundert = plan(100);
  assert.deepEqual(zeilen(hundert), [
    "Einstieg und Wiederholung 10",
    "Erklären: Past Simple 15",
    "Üben: Past Simple 25",
    "Lernkontrolle: Past Simple 10",
    "Üben, 2. Runde: Past Simple 25",
    "Lernkontrolle, 2. Runde: Past Simple 10",
    "Abschluss 5",
  ]);
  assert.deepEqual(
    hundert.map((s) => s.art),
    ["einstieg", "erklaeren", "ueben", "kontrolle", "ueben", "kontrolle", "abschluss"],
  );
  assert.ok(hundert.every((s) => s.thema === null || s.thema === "Past Simple"));
  // 50 minutes, one topic: nothing to split, exactly 50
  const fuenfzig = plan(50);
  assert.deepEqual(zeilen(fuenfzig), ["Einstieg und Wiederholung 5", "Erklären: Past Simple 10", "Üben: Past Simple 20", "Lernkontrolle: Past Simple 10", "Abschluss 5"]);
  // a little over: Erklären takes it (at most 15)
  assert.deepEqual(zeilen(plan(60)).slice(1, 4), ["Erklären: Past Simple 15", "Üben: Past Simple 25", "Lernkontrolle: Past Simple 10"]);
  for (const m of [40, 45, 50, 55, 60, 75, 90, 100, 120, 150]) {
    const p = plan(m);
    assert.equal(summe(p), m, `${m} Minuten: never stretched, never shorter`);
    assert.ok(p.every((s) => s.art !== "ueben" || s.minuten <= sp.UEBEN_MAX), `${m}: ${zeilen(p).join(" | ")}`);
  }
  // several topics stay as they were (one round each)
  const zwei = sp.bauePlan(sp.waehleThemen(eingabe({ signale: [sig("vorgabe", ["past"]), sig("pruefung", ["email"], { tage: 6 })] })), 100, hilfen);
  assert.equal(zwei.filter((s) => s.art === "kontrolle").length, 2);
  assert.equal(summe(zwei), 100);
  assert.deepEqual(sp.uebenRunden(85, 15, 10, false), { erklaeren: 15, ueben: 60, runden: 1 }, "not alone: as before");
});

// ---------- with the database ----------

let nr = 0;
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundener Stoffzettel ${++nr}`)]);

/** The full example of docs/lernpaket-format.md (7 steps, 50 minutes, with its own check), made an Englisch package. */
function beispiel(): Record<string, unknown> {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  return JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
}

async function setup(o: { fach?: string } = {}) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const lp = await import("./lernpakete");
  const c = await import("./cockpit");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    // only reading the Vorgabe asks (a hand-written answer); the plan itself never does
    return { parsed: STOFF_ENGLISCH_MORE, refusal: false, model: req.model, usage: { input: 6_500, output: 3_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  const teacher = repo.listTeachers()[0];
  const fach = o.fach ?? "Englisch";
  const sid = repo.createStudent({
    name: "Mira Plantest", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: [fach],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const heute = zeit.wienerDatum();
  const pruefung = (inTagen: number, skills: string[]) =>
    repo.addTest({ student_id: sid, date: zeit.tagAddieren(heute, inTagen), subject: fach, kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: skills, title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
  /** today's published slot at 15:00 with `dauer` minutes */
  const platz = (dauer: number) =>
    db()
      .prepare(
        `INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, created_at, updated_at)
         VALUES (?, ?, 900, ?, ?, ?, NULL, 'veroeffentlicht', 0, datetime('now'), datetime('now'))`,
      )
      .run(zeit.wochenstartVon(heute), zeit.wochentagVon(heute), dauer, teacher.id, sid);
  const paket = (titel: string, skills: string[], geprueft = true) => {
    const d = beispiel();
    Object.assign(d, { titel, fach, schulart: "Gymnasium", klasse: 2, thema: titel, faehigkeiten: skills });
    const out = lp.importiereLernpaket(JSON.stringify(d), teacher.id);
    assert.ok("id" in out, "id" in out ? "" : out.fehler.join("\n"));
    if (geprueft) assert.ok("ok" in lp.markiereGeprueft(out.id, teacher.id, { hinweiseGeprueft: true }));
    return lp.getLernpaket(out.id)!;
  };
  /** the Vorgabe for today: one photo of the Stoffzettel, read by the stand-in for the KI */
  const vorgabe = async (unitId: number, text = "") => {
    const { saveUpload } = await import("./materials");
    const vg = await import("./vorgabe");
    const datei = saveUpload({ name: "zettel.jpg", data: jpeg() }, { title: "Stoffzettel", studentId: sid, teacherId: teacher.id }).id;
    return vg.speichereVorgabe({ unitId, teacherId: teacher.id, text, materialIds: [datei], testId: null, keinName: true, heute });
  };
  const start = () => units.startUnit(teacher.id, sid, { subject: fach }).unit;
  const kiAufrufe = () => (db().prepare("SELECT COUNT(*) AS n FROM ai_calls").get() as { n: number }).n;
  return { db, repo, units, lp, c, zeit, router, teacher, sid, heute, pruefung, platz, paket, vorgabe, start, gefragt, kiAufrufe };
}

/** The plan as „Titel Minuten“, to compare and to show. */
const zeilen = (plan: { titel: string; minuten: number }[]) => plan.map((s) => `${s.titel} ${s.minuten}`);

test("Englisch, 100 minutes, the Vorgabe from the Stoffzettel and a Schularbeit in 6 days: three topics in order, 100 minutes, each with a Lernkontrolle", async () => {
  const s = await setup();
  s.pruefung(6, ["englisch.tenses.pastsimple", "englisch.writing.email"]);
  const unit = s.start();
  assert.ok("ok" in (await s.vorgabe(unit.id)));
  const ki = s.gefragt.length;
  const calls = s.kiAufrufe();
  const sp = await import("./stundenplan");
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  if (process.env.PLAN_ZEIGEN) console.log(zeilen(plan).join("\n"));
  assert.deepEqual(zeilen(plan), [
    "Einstieg und Wiederholung 10",
    "Erklären: Past Simple 10",
    "Üben: Past Simple 15",
    "Lernkontrolle: Past Simple 10",
    "Erklären: E-Mail an Freunde schreiben 10",
    "Üben: E-Mail an Freunde schreiben 10",
    "Lernkontrolle: E-Mail an Freunde schreiben 10",
    "Erklären: Wortschatz: Tagesablauf 5",
    "Üben: Wortschatz: Tagesablauf 10",
    "Lernkontrolle: Wortschatz: Tagesablauf 5",
    "Abschluss 5",
  ]);
  const themen = sp.themenDesPlans(plan);
  assert.ok(themen.length <= 3);
  assert.deepEqual(
    themen.map((t) => [t.name, t.minuten]),
    [
      ["Past Simple", 35],
      ["E-Mail an Freunde schreiben", 30],
      ["Wortschatz: Tagesablauf", 20],
    ],
    "the Vorgabe's skills, those of the Schularbeit in front",
  );
  assert.equal(summe(plan), 100);
  for (const t of themen) assert.ok(plan.some((x) => t.ids.includes(x.id) && x.art === "kontrolle" && x.skillId), `${t.name}: a Lernkontrolle`);
  assert.equal(plan.find((x) => x.art === "ueben" && x.thema === "Past Simple")?.pruefung, true, "the Schularbeit's skill: also the exam format");
  assert.equal(s.c.cockpit(unit.id).stand.plan, null, "only read: nothing held yet");
  // the same plan without KI
  process.env.AI_DISABLED = "1";
  try {
    assert.deepEqual(s.c.planDerEinheit(unit.id), plan);
  } finally {
    delete process.env.AI_DISABLED;
  }
  assert.equal(s.gefragt.length, ki, "the plan asks nobody");
  assert.equal(s.kiAufrufe(), calls);
  s.router.setTransport(null);
});

/** `n` wrong answers on a skill, so its Lernstand is weak. */
async function falsch(s: Awaited<ReturnType<typeof setup>>, skillId: string, n = 3) {
  const ws = s.repo.createWorksheet(
    { title: "Übung", subject: "Englisch", grade: 6, school_type: "Gymnasium", klasse: 2, topic: "Übung", difficulty: "mittel", task_type: "free", kind: "uebung", source: "manuell", skill_ids: [skillId] },
    [{ type: "free", skillId, difficulty: "mittel", prompt: "She ___ (go) to school every day.", data: {}, answer: { accepted: ["goes"], mode: "text" }, solution: "", hints: [], errorMap: [] }],
  );
  const asg = s.repo.assignWorksheet(ws, s.sid, "");
  const taskId = s.repo.listTasks(ws)[0].id;
  for (let i = 1; i <= n; i++)
    s.db().prepare("INSERT INTO attempts (assignment_id, task_id, student_id, skill_id, attempt_no, answer, correct, final) VALUES (?, ?, ?, ?, ?, 'go', 0, 1)").run(asg, taskId, s.sid, skillId, i);
}

test("a weak prerequisite: Present Simple comes first as a short Grundlage block, taken from the topic's minutes", async () => {
  const s = await setup();
  s.platz(40);
  s.pruefung(6, ["englisch.tenses.pastsimple"]);
  await falsch(s, "englisch.tenses.presentsimple");
  const unit = s.start();
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  assert.deepEqual(
    plan.map((x) => x.titel),
    ["Einstieg und Wiederholung", "Grundlage: Present Simple", "Erklären: Past Simple", "Üben: Past Simple", "Lernkontrolle: Past Simple", "Abschluss"],
  );
  assert.equal(summe(plan), 40);
  const g = plan[1];
  assert.equal(g.art, "grundlage");
  assert.equal(g.thema, "Past Simple", "part of the topic");
  assert.deepEqual(g.quelle, { skillId: "englisch.tenses.presentsimple" });
  assert.match(g.beschreibung, /Present Simple sitzt noch nicht \(\d+ %\)/);
  s.router.setTransport(null);
});

test("Phase C: a confirmed block that is the only topic is split the same way", async () => {
  const s = await setup();
  const sp = await import("./stundenplan");
  const allein = sp.schritteZurFaehigkeit("englisch.tenses.pastsimple", 85, true);
  assert.deepEqual(
    allein.map((x) => [x.art, x.minuten]),
    [["erklaeren", 15], ["ueben", 25], ["kontrolle", 10], ["ueben", 25], ["kontrolle", 10]],
  );
  assert.deepEqual(sp.schritteZurFaehigkeit("englisch.tenses.pastsimple", 35).map((x) => x.art), ["erklaeren", "ueben", "kontrolle"], "beside other topics: one round");
  s.router.setTransport(null);
});

test("50 minutes: at most two topics, together exactly 50 minutes", async () => {
  const s = await setup();
  s.platz(50);
  s.pruefung(6, ["englisch.tenses.pastsimple", "englisch.writing.email"]);
  const unit = s.start();
  await s.vorgabe(unit.id);
  const sp = await import("./stundenplan");
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  const themen = sp.themenDesPlans(plan);
  assert.equal(themen.length, 2);
  assert.deepEqual(themen.map((t) => t.name), ["Past Simple", "E-Mail an Freunde schreiben"]);
  assert.equal(summe(plan), 50);
  assert.ok(themen.every((t) => t.minuten >= 20));
  s.router.setTransport(null);
});

test("a checked package becomes the topic's block, scaled to its minutes; an unchecked one is not used; the plan stays after the first send", async () => {
  const s = await setup();
  s.pruefung(6, ["englisch.tenses.pastsimple", "englisch.writing.email", "englisch.vocab.tagesablauf"]);
  const p = s.paket("Past Simple kompakt", ["englisch.tenses.pastsimple"]);
  const entwurf = s.paket("E-Mails schreiben", ["englisch.writing.email"], false);
  assert.equal(p.minuten_summe, 50);
  const unit = s.start();
  const sp = await import("./stundenplan");
  let d = s.c.cockpit(unit.id, { mitPlan: true });
  assert.equal(d.paket, null, "a suggested package is no longer the whole unit");
  const plan = d.plan;
  const themen = sp.themenDesPlans(plan);
  assert.deepEqual(
    themen.map((t) => [t.name, t.minuten, t.paketId]),
    [
      ["Past Simple", 35, p.id],
      ["E-Mail an Freunde schreiben", 30, null],
      ["Wortschatz: Tagesablauf", 20, null],
    ],
  );
  const block = plan.filter((x) => x.thema === "Past Simple");
  assert.deepEqual(block.map((x) => x.titel), p.schritte.map((x) => x.titel), "the package's steps in their order, its own check instead of ours");
  assert.deepEqual(block.map((x) => x.quelle), p.schritte.map((x) => ({ paketId: p.id, schrittId: x.id })));
  assert.ok(block.every((x) => x.art === "paket" && x.skillId === "englisch.tenses.pastsimple"));
  assert.equal(summe(block), 35, "50 minutes of the package in 35");
  assert.equal(summe(plan), 100);
  assert.ok(!plan.some((x) => x.quelle && "paketId" in x.quelle && x.quelle.paketId === entwurf.id), "never the unchecked package");
  assert.equal(d.planQuellen.get(block[0].id)?.schritt.id, p.schritte[0].id, "the cockpit knows the package step");

  // sending the tasks of a package step holds the plan
  const frage = block.find((x) => p.schritte.find((y) => y.id === (x.quelle as { schrittId: number }).schrittId)!.aufgaben.length)!;
  const out = s.c.sendeSchritt(unit.id, frage.id, s.teacher.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  d = s.c.cockpit(unit.id, { mitPlan: true });
  assert.deepEqual(d.stand.plan, plan, "held as it was");
  assert.deepEqual(d.stand.gesendet[frage.id], [out.worksheetId]);
  // a new checked package and a Vorgabe afterwards change nothing
  const neu = s.paket("E-Mails kompakt", ["englisch.writing.email"]);
  assert.ok("ok" in (await s.vorgabe(unit.id)));
  d = s.c.cockpit(unit.id, { mitPlan: true });
  assert.deepEqual(d.plan, plan);
  assert.ok(!d.plan.some((x) => x.quelle && "paketId" in x.quelle && x.quelle.paketId === neu.id));
  s.router.setTransport(null);
});

test("before the first tap a Vorgabe rebuilds the plan; a package the teacher picks keeps today's one-package mode", async () => {
  const s = await setup();
  s.pruefung(6, ["englisch.writing.email"]);
  const p = s.paket("Past Simple kompakt", ["englisch.tenses.pastsimple"]);
  const unit = s.start();
  const sp = await import("./stundenplan");
  const vorher = sp.themenDesPlans(s.c.cockpit(unit.id, { mitPlan: true }).plan).map((t) => t.name);
  assert.equal(vorher[0], "E-Mail an Freunde schreiben");
  await s.vorgabe(unit.id);
  const nachher = sp.themenDesPlans(s.c.cockpit(unit.id, { mitPlan: true }).plan);
  assert.deepEqual(nachher.map((t) => t.name), ["E-Mail an Freunde schreiben", "Wortschatz: Tagesablauf", "Satzstellung im Aussagesatz"], "the Vorgabe counts at once");

  // the teacher picks the package: exactly this package, as before
  assert.ok("ok" in s.c.waehlePaket(unit.id, p.id));
  const d = s.c.cockpit(unit.id, { mitPlan: true });
  assert.equal(d.paket?.id, p.id);
  assert.deepEqual(d.plan, []);
  assert.deepEqual(d.schritte.map((x) => x.id), p.schritte.map((x) => x.id));
  assert.equal(d.planQuellen.size, 0);
  s.units.finishUnit(unit.id, "abgebrochen");

  // chosen for the day before the unit: the same
  assert.ok("ok" in s.c.bereiteVor(s.sid, s.heute, p.id, s.teacher.id));
  const zweite = s.start();
  assert.equal(s.c.cockpit(zweite.id, { mitPlan: true }).paket?.id, p.id);
  s.router.setTransport(null);
});

test("the Lernkontrolle: three tasks, one try without hints, not counted as Minitest; Richtig/Teilweise/Falsch is kept with its skill", async () => {
  const s = await setup();
  s.pruefung(6, ["englisch.tenses.pastsimple"]);
  const unit = s.start();
  const { LERNKONTROLLE } = await import("./quick-round");
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  const k = plan.find((x) => x.art === "kontrolle" && x.thema === "Past Simple")!;
  const out = await s.c.sendeAusGenerator(unit.id, "englisch.tenses.pastsimple", s.teacher.id, k.id);
  assert.ok("assignmentId" in out, JSON.stringify(out));
  const a = s.repo.getAssignment(out.assignmentId)!;
  assert.equal(a.mode, "test");
  assert.equal(a.note, LERNKONTROLLE);
  const tasks = s.repo.listTasks(out.worksheetId);
  assert.equal(tasks.length, 3);
  assert.match(s.repo.getWorksheet(out.worksheetId)!.title, /^Mira – Lernkontrolle: Past Simple$/);
  // the teacher's live line names it „Lernkontrolle“, not „Minitest“ (Abnahme Phase A)
  const { liveSnapshot } = await import("./live");
  assert.equal(liveSnapshot(unit.id)!.current?.kontrolle, true);
  const d = s.c.cockpit(unit.id);
  assert.deepEqual(d.stand.plan, plan, "held by the send");
  assert.deepEqual(d.stand.gesendet[k.id], [out.worksheetId]);
  // without the step: the practice step gets the exercise, not the check
  const ueben = await s.c.sendeAusGenerator(unit.id, "englisch.tenses.pastsimple", s.teacher.id);
  assert.ok("assignmentId" in ueben);
  assert.notEqual(s.repo.getAssignment(ueben.assignmentId)!.mode, "test");
  assert.deepEqual(s.c.cockpit(unit.id).stand.gesendet[plan.find((x) => x.art === "ueben" && x.thema === "Past Simple")!.id], [ueben.worksheetId]);

  // an answer to the Lernkontrolle: the unit report does not call it a Minitest
  s.db().prepare("INSERT INTO attempts (assignment_id, task_id, student_id, skill_id, attempt_no, answer, correct, final, unit_id) VALUES (?, ?, ?, ?, 1, 'x', 1, 1, ?)").run(out.assignmentId, tasks[0].id, s.sid, "englisch.tenses.pastsimple", unit.id);
  const { buildUnitReport } = await import("./learning");
  assert.equal(buildUnitReport(s.units.getUnit(unit.id)!).minitest, undefined);

  // what the teacher heard
  assert.equal(s.c.setzeAntwort(unit.id, k.id, "teilweise"), true);
  assert.equal(s.c.setzeAntwort(unit.id, plan[0].id, "falsch"), false, "not on the Einstieg");
  const e = plan.find((x) => x.art === "erklaeren")!;
  assert.equal(s.c.setzeAntwort(unit.id, e.id, "richtig"), true);
  assert.deepEqual(
    s.c.antwortenDerEinheit(unit.id).map((x) => [x.titel, x.art, x.antwort, x.skillIds]),
    [
      ["Erklären: Past Simple", "frage", "richtig", ["englisch.tenses.pastsimple"]],
      ["Lernkontrolle: Past Simple", "kontrolle", "teilweise", ["englisch.tenses.pastsimple"]],
    ],
  );

  // the Abschluss reads it: „Heute gemacht“ names the topics, „Gut verstanden“ the teacher's „Richtig“ with its skill
  const ab = await import("./abschluss");
  assert.ok(s.c.markiereSchritt(unit.id, e.id, "erledigt"));
  const ablauf = s.c.ablaufDerEinheit(unit.id)!;
  assert.deepEqual(ablauf.themen, ["Past Simple"]);
  assert.ok(ab.abschlussKarte(null, ablauf).gemacht.some((z) => z.text === "Thema: Past Simple"));
  const beobachtungen = s.c.antwortenDerEinheit(unit.id).map(({ titel, art, antwort, skillIds }) => ({ titel, art, antwort, skillIds }));
  const gut = ab.gutVerstanden({ aufgaben: [], beobachtungen, reaktionen: [] });
  assert.equal(gut.length, 1, JSON.stringify(gut));
  assert.match(gut[0].text, /„Erklären: Past Simple“/);
  assert.equal(gut[0].von, "beobachtung");

  // Abnahme Phase A: the Abschluss shows the measured result of the Lernkontrolle, not only what the teacher heard
  const { endUnit } = await import("./learning");
  const lesson = s.repo.getLesson(endUnit(unit.id, { byTeacherId: s.teacher.id })!)!;
  const belege = ab.belegeDerEinheit(unit.id, lesson);
  assert.deepEqual(belege.lernkontrollen, [{ skill: "Past Simple", von: 3, erledigt: 1, richtig: 1 }]);
  assert.ok(ab.abschlussKarte(null, ablauf, [], belege).gemacht.some((z) => z.text === "Lernkontrolle Past Simple: 1 von 3 richtig (1 abgegeben)" && z.von === "antworten"));
  s.router.setTransport(null);
});
