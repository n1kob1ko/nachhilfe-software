/**
 * Material passt (B0, offene Punkte 1–4 des Testlaufs Phase A): eine Übung aus dem Bestand geht nur mit Aufgaben der Fähigkeit
 * des Schritts hinaus (nie das Blatt eines anderen Schülers), der Stoffzettel aus „Was steht heute an?“ kommt mit einem Tippen
 * an die eingetragene Prüfung, ein Thema vom Blatt steht gleich als vorläufiger Block im Plan, und bei „Writing“ kommen die
 * Textsorten vor der Rechtschreibung.
 *
 * Ohne KI nach außen: der Transport wird ersetzt und antwortet mit der von Hand geschriebenen Antwort
 * (lib/fixtures/stoff-englisch-more.ts) oder einem erfundenen Arbeitsblatt. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { PruefungsstoffGelesen } from "./ai";
import { STOFF_ENGLISCH_MORE } from "./fixtures/stoff-englisch-more";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "material-passt-"));
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR",
])
  delete process.env[k];

const PAST = "englisch.tenses.pastsimple";
const IRREGULAR = "englisch.vocab.irregular";
let nr = 0;
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundenes Blatt ${++nr}`)]);

async function setup(antwort: () => unknown = () => STOFF_ENGLISCH_MORE) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  router.resetRouter();
  router.setTransport(async (req) => ({ parsed: antwort(), refusal: false, model: req.model, usage: { input: 6_500, output: 3_500, cacheWrite: 0, cacheRead: 0, reasoning: 0 } }));
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({ name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Englisch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const sid = schueler("Jana Probefeld");
  const heute = zeit.wienerDatum();
  const pruefung = (tage: number, kind = "Schularbeit", skill_ids: string[] = [], subject = "Englisch") =>
    repo.addTest({ student_id: sid, date: zeit.tagAddieren(heute, tage), subject, kind, topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids, title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });
  const start = () => units.startUnit(teacher.id, sid, { subject: "Englisch" }).unit;
  const upload = (title = "Für heute") => saveUpload({ name: "blatt.jpg", data: jpeg() }, { title, studentId: sid, teacherId: teacher.id }).id;
  const { saveUpload } = await import("./materials");
  return { db, repo, units, c, zeit, router, teacher, sid, schueler, heute, pruefung, start, upload, aus: () => router.setTransport(null) };
}

type Aufgabe = { type: "grammar"; skillId: string; difficulty: "mittel"; prompt: string; data: Record<string, never>; answer: { accepted: string[]; mode: "text" }; solution: string; hints: string[]; errorMap: never[] };
const aufgabe = (skillId: string, prompt: string, loesung: string): Aufgabe => ({ type: "grammar", skillId, difficulty: "mittel", prompt, data: {}, answer: { accepted: [loesung], mode: "text" }, solution: loesung, hints: [], errorMap: [] });
const past = (n: number, start = 0) => Array.from({ length: n }, (_, i) => aufgabe(PAST, `Yesterday we ___ (watch) film number ${start + i + 1}.`, "watched"));
const dritteForm = (n: number) => Array.from({ length: n }, (_, i) => aufgabe(IRREGULAR, `Write the 3rd form (past participle): verb ${i + 1}`, "gone"));

// ---------- 1 the exercise fits the step's skill ----------

test("1: a mixed exercise goes out only with the step's tasks (at least three), never another student's sheet", async () => {
  const s = await setup();
  const mp = await import("./material-passt");
  const ober = (id: string) => s.repo.getSkill(id)?.parent_id ?? null;
  // pure rule: all fit → whole; three fit → cut down; two fit → skipped; a task without a skill does not fit
  assert.deepEqual(mp.auswahlZur(past(4), PAST, ober), { aufgaben: past(4), gekuerzt: false });
  assert.equal(mp.auswahlZur([...past(3), ...dritteForm(2)], PAST, ober)?.gekuerzt, true);
  assert.equal(mp.auswahlZur([...past(3), ...dritteForm(2)], PAST, ober)?.aufgaben.length, 3);
  assert.equal(mp.auswahlZur([...past(2), ...dritteForm(4)], PAST, ober), null);
  assert.equal(mp.passtZurFaehigkeit({ skillId: null }, PAST, ober), false);
  assert.equal(mp.passtZurFaehigkeit({ skillId: IRREGULAR, skillIds: [IRREGULAR, PAST] }, PAST, ober), true, "task_skills count");

  // the near Schularbeit makes Past Simple a topic of the plan
  s.pruefung(6, "Schularbeit", [PAST]);
  const andere = s.schueler("Timo Beispielmann");
  const blatt = (title: string, aufgaben: Aufgabe[], studentId: number | null = null) =>
    s.repo.createWorksheet({ title, subject: "Englisch", grade: 6, school_type: "Gymnasium", klasse: 2, topic: "Tenses", difficulty: "mittel", task_type: "grammar", kind: "uebung", source: "generator", skill_ids: [PAST, IRREGULAR], student_id: studentId }, aufgaben);
  // the demo case: „Einheit: Past Simple“ of another student, alternating Past Simple and „3rd form“
  const fremd = blatt("Einheit: Past Simple", [...past(4), ...dritteForm(4)]);
  s.repo.assignWorksheet(fremd, andere);
  const fremdPersoenlich = blatt("Timo – Past Simple", past(5), andere);
  assert.equal(mp.fuerSchuelerNutzbar(s.repo.getWorksheet(fremd)!, s.sid), false, "assigned to another student");
  assert.equal(mp.fuerSchuelerNutzbar(s.repo.getWorksheet(fremdPersoenlich)!, s.sid), false, "made for another student");

  const unit = s.start();
  let plan = s.c.planDerEinheit(unit.id);
  let ueben = plan.find((x) => x.art === "ueben" && x.skillId === PAST)!;
  assert.ok(ueben, plan.map((x) => x.titel).join(" | "));
  assert.ok(![`U${fremd}`, `U${fremdPersoenlich}`].includes(ueben.uebung ?? ""), "no sheet of another student in the plan");
  // even if an older, frozen plan named it, it does not go out: new tasks from the generator instead
  assert.equal(s.c.bestandsUebung({ uebung: `U${fremd}`, skillId: PAST }, s.sid), null);
  assert.ok(s.c.aufgabenImSchritt(unit.id, { ...ueben, uebung: `U${fremd}` }).every((t) => mp.passtZurFaehigkeit(t, PAST, ober)));

  // generic material (no student, never assigned): cut down to its Past Simple tasks
  const allgemein = blatt("Verbs revision", [aufgabe(IRREGULAR, "Write the 3rd form (past participle): go", "gone"), ...past(3, 10), ...dritteForm(1)]);
  s.db().prepare("UPDATE units SET status = 'beendet' WHERE id = ?").run(unit.id);
  const unit2 = s.start();
  plan = s.c.planDerEinheit(unit2.id);
  ueben = plan.find((x) => x.art === "ueben" && x.skillId === PAST)!;
  assert.equal(ueben.uebung, `U${allgemein}`, "generic material from the Bestand comes first");
  const b = s.c.bestandsUebung(ueben, s.sid)!;
  assert.equal(b.gekuerzt, true);
  assert.equal(b.aufgaben.length, 3);
  // sending: a new exercise with only the Past Simple tasks, for this unit, remembered at the step; the plan is frozen
  const out = await s.c.sendeBestand(unit2.id, ueben.id, s.teacher.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  assert.notEqual(out.worksheetId, allgemein);
  const gesendet = s.repo.listTasks(out.worksheetId);
  assert.equal(gesendet.length, 3);
  assert.ok(gesendet.every((t) => t.skillId === PAST && !/3rd form/.test(t.prompt)), gesendet.map((t) => t.prompt).join(" | "));
  const ws = s.repo.getWorksheet(out.worksheetId)!;
  assert.equal(ws.student_id, s.sid);
  assert.equal(ws.source_worksheet_id, allgemein);
  assert.deepEqual(ws.skill_ids, [PAST]);
  assert.equal(s.repo.getAssignment(out.assignmentId)?.unit_id, unit2.id);
  const stand = s.c.leseStand(unit2.id);
  assert.deepEqual(stand.gesendet[ueben.id], [out.worksheetId]);
  assert.ok(stand.plan, "the first send freezes the plan");
  assert.equal(s.repo.listTasks(allgemein).length, 5, "the original stays as it was");

  // a whole sheet that fits goes out as it is
  const ganz = blatt("Past Simple only", past(4, 20));
  assert.equal(s.c.bestandsUebung({ uebung: `U${ganz}`, skillId: PAST }, s.sid)?.gekuerzt, false);
  // too few fitting tasks: skipped
  const wenig = blatt("Mostly irregular", [...past(2, 30), ...dritteForm(3)]);
  assert.equal(s.c.bestandsUebung({ uebung: `U${wenig}`, skillId: PAST }, s.sid), null);
  s.aus();
});

test("1: the prepared next exercise and the steering follow-ups use only tasks of the skill and no other student's sheet", async () => {
  const s = await setup();
  const mp = await import("./material-passt");
  const steuerung = await import("./steuerung");
  const ober = (id: string) => s.repo.getSkill(id)?.parent_id ?? null;
  s.pruefung(6, "Schularbeit", [PAST]);
  const andere = s.schueler("Timo Beispielmann");
  const fremd = s.repo.createWorksheet({ title: "Einheit: Past Simple", subject: "Englisch", grade: 6, school_type: "Gymnasium", klasse: 2, topic: "Tenses", difficulty: "mittel", task_type: "grammar", kind: "uebung", source: "generator", skill_ids: [PAST, IRREGULAR] }, [...past(4), ...dritteForm(4)]);
  s.repo.assignWorksheet(fremd, andere);
  const unit = s.start();
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  const [einstieg, erklaeren] = plan;
  const ueben = plan.find((x) => x.art === "ueben" && x.skillId === PAST)!;
  s.c.markiereSchritt(unit.id, einstieg.id, "erledigt");
  s.c.markiereSchritt(unit.id, erklaeren.id, "erledigt");
  // a frozen plan that still names the other student's sheet: the step is prepared from the generator instead
  s.db().prepare("UPDATE einheit_cockpit SET plan = ? WHERE unit_id = ?").run(JSON.stringify(s.c.leseStand(unit.id).plan!.map((x) => (x.id === ueben.id ? { ...x, uebung: `U${fremd}` } : x))), unit.id);
  assert.ok(s.c.haltBereit(unit.id).includes(ueben.id), "prepared from the generator");
  const bereit = JSON.parse((s.db().prepare("SELECT aufgaben FROM einheit_bereit WHERE unit_id = ? AND schritt_id = ?").get(unit.id, ueben.id) as { aufgaben: string }).aufgaben) as Aufgabe[];
  assert.ok(bereit.length > 0 && bereit.every((t) => mp.passtZurFaehigkeit(t, PAST, ober)));

  // steering (A Bestand → B Generator): tasks of exactly this skill, never from the other student's sheet
  const eigene = s.repo.createWorksheet({ title: "Past Simple drill", subject: "Englisch", grade: 6, school_type: "Gymnasium", klasse: 2, topic: "Tenses", difficulty: "mittel", task_type: "grammar", kind: "uebung", source: "manuell", skill_ids: [PAST] }, past(2, 50));
  const a = steuerung.bestand(unit.id, { skillId: PAST, level: 3 });
  assert.ok(a.length > 0);
  const fremdeFragen = new Set(s.repo.listTasks(fremd).map((t) => t.prompt));
  assert.ok(a.every((t) => !fremdeFragen.has(t.prompt) && mp.passtZurFaehigkeit(t, PAST, ober)), a.map((t) => t.prompt).join(" | "));
  assert.ok(a.some((t) => s.repo.listTasks(eigene).some((x) => x.prompt === t.prompt)), "a generic sheet is fine");
  s.aus();
});

// ---------- 2 the Stoffzettel reaches the exam ----------

test("2: the Stoffzettel read today goes to the entered exam with one tap; nothing there is lost, no exam is made", async () => {
  let datum = "";
  const s = await setup(() => ({ ...STOFF_ENGLISCH_MORE, datum }));
  const vg = await import("./vorgabe");
  const ps = await import("./pruefungsstoff");
  const unit = s.start();
  datum = s.zeit.tagAddieren(s.heute, 10);
  const zettel = s.upload("Stoffzettel");
  const inhalt = s.upload();
  const zaehle = () => (s.db().prepare("SELECT COUNT(*) AS n FROM tests").get() as { n: number }).n;

  // no exam entered: no offer, nothing made (the date in the text stays „Prüfung eintragen“)
  await vg.speichereVorgabe({ unitId: unit.id, teacherId: s.teacher.id, text: "Heute Past Simple", materialIds: [zettel, inhalt], testId: null, keinName: true, heute: s.heute });
  let v = vg.vorgabeDerEinheit(unit.id)!;
  assert.equal(vg.stoffzettelZurPruefung(v, "Englisch", s.heute), null);
  assert.equal(zaehle(), 0);

  // two exams in Englisch and one in Mathematik: the one on the Stoffzettel's date
  s.pruefung(6, "Schularbeit");
  const test1 = s.pruefung(10, "Test");
  s.pruefung(9, "Schularbeit", [], "Mathematik");
  // what the exam has already: a row the teacher confirmed and one she excluded
  ps.speichereStoff(test1, [
    { gruppe: "wortschatz", original: "Clothes", inhalt: "Kleidung", einheit: "", dokument: 0, quelle: "lehrer", status: "pruefung", grund: "", skill_id: "englisch.vocab.tagesablauf", zuordnung: "bestaetigt", vorschlaege: [] },
    { gruppe: "sonstiges", original: "Songs", inhalt: "Lieder", einheit: "", dokument: 0, quelle: "lehrer", status: "ausgeschlossen", grund: "Vom Lehrer ausgeschlossen", skill_id: null, zuordnung: "keine", vorschlaege: [] },
  ]);
  const vorher = zaehle();
  v = vg.vorgabeDerEinheit(unit.id)!;
  const z = vg.stoffzettelZurPruefung(v, "Englisch", s.heute)!;
  assert.equal(z.test.id, test1, "the exam on the Stoffzettel's date");
  assert.equal(z.uebernommen, false);
  assert.equal(vg.stoffKnopfText(z.test), `Stoff zum Test am ${Number(datum.slice(8, 10))}.${Number(datum.slice(5, 7))}. übernehmen`);
  assert.equal(vg.stoffKnopfText({ kind: "Schularbeit", date: "2026-11-06" }), "Stoff zur Schularbeit am 6.11. übernehmen");

  assert.deepEqual(vg.stoffZurPruefung(unit.id, test1 + 99, s.heute), { fehler: "Diese Prüfung passt nicht zum Stoffzettel." });
  assert.deepEqual(vg.stoffZurPruefung(unit.id, test1, s.heute), { ok: true, testId: test1 });
  assert.equal(zaehle(), vorher, "no exam made");
  const zeilen = ps.stoffDerPruefung(test1);
  // kept: the teacher's decisions
  assert.equal(zeilen.find((x) => x.original === "Clothes")?.zuordnung, "bestaetigt");
  assert.equal(zeilen.find((x) => x.original === "Songs")?.status, "ausgeschlossen");
  // added like the Stoffzettel in the profile: wording → content → skill, excluded and unclear rows
  const cont = zeilen.find((x) => x.original === "continuous")!;
  assert.equal(cont.inhalt, "Present Continuous");
  assert.equal(cont.status, "pruefung");
  assert.equal(zeilen.find((x) => x.original === "videos (Stones, Twins etc.)")?.status, "ausgeschlossen");
  assert.equal(zeilen.find((x) => x.original === "should / shouldn’t")?.status, "unklar");
  assert.ok(!zeilen.some((x) => x.quelle === "lehrer" && x.original !== "Clothes" && x.original !== "Songs"), "today's text is not exam scope");
  const t = s.repo.getTest(test1)!;
  assert.ok(t.skill_ids.includes("englisch.tenses.presentprogressive"));
  assert.ok(t.skill_ids.includes("englisch.vocab.tagesablauf"), "the confirmed row still counts");
  assert.equal(t.material_id, zettel, "the Stoffzettel is the exam's file");
  assert.ok((t.topics ?? []).includes("Present Simple"));
  assert.equal(t.lesung_id, v.lesungId);
  assert.equal(vg.stoffzettelZurPruefung(v, "Englisch", s.heute)?.uebernommen, true, "offered once");
  // a second tap changes nothing
  const anzahl = zeilen.length;
  assert.deepEqual(vg.stoffZurPruefung(unit.id, test1, s.heute), { ok: true, testId: test1 });
  assert.equal(ps.stoffDerPruefung(test1).length, anzahl);
  s.aus();
});

// ---------- 3 topics from a worksheet at once ----------

/** Ein erfundenes Arbeitsblatt: Past Simple, das die Wörter nicht eindeutig machen, und Irregular verbs. */
const ARBEITSBLATT: PruefungsstoffGelesen = {
  art: null,
  fach: "Englisch",
  datum: null,
  titel: "Worksheet",
  dokumente: [{ nr: 1, rolle: "aufgaben", titel: "Worksheet" }],
  punkte: [
    { gruppe: "grammatik", original: "Past simple and irregular verbs", inhalt: "Past Simple", einheit: null, dokument: 1, status: "pruefung", grund: null, skill_id: PAST },
    { gruppe: "grammatik", original: "Irregular verbs", inhalt: "Irregular Verbs", einheit: null, dokument: 1, status: "pruefung", grund: null, skill_id: IRREGULAR },
  ],
  schwierigkeiten: [],
  termin_text: null,
  unsicher: [],
};

async function mitBlatt() {
  const s = await setup(() => ARBEITSBLATT);
  const vg = await import("./vorgabe");
  const unit = s.start();
  await vg.speichereVorgabe({ unitId: unit.id, teacherId: s.teacher.id, text: "", materialIds: [s.upload()], testId: null, keinName: true, heute: s.heute });
  return { ...s, vg, unit };
}

test("3: an unclear topic of a worksheet is a provisional block at once, preselected, and nothing of it counts", async () => {
  const s = await mitBlatt();
  const v = s.vg.vorgabeDerEinheit(s.unit.id)!;
  const i = v.punkte.findIndex((p) => p.inhalt === "Past Simple");
  assert.equal(v.punkte[i].zuordnung, "unklar", "still to confirm, not forced");
  assert.equal(v.punkte[i].vorauswahl, PAST, "the KI's skill, the words support it: ticked already");
  assert.deepEqual(v.skillIds, [IRREGULAR], "a preselection is no skill yet");
  const plan = s.c.planDerEinheit(s.unit.id);
  const block = plan.find((x) => x.vorlaeufig)!;
  assert.ok(block, plan.map((x) => x.titel).join(" | "));
  assert.equal(block.titel, "Past Simple · noch bestätigen");
  assert.equal(block.skillId, null);
  assert.equal(block.uebung, null);
  assert.equal(s.c.planHatUebung(block, new Map()), false, "no exercise: nothing for the Lernstand");
  assert.equal((await import("./praesentation-unterricht")).schrittDerEinheit(s.unit.id, block.id), null, "no presentation to show or make");
  const themen = (await import("./stundenplan")).themenDesPlans(plan).map((t) => t.name);
  assert.deepEqual(themen.slice(0, 2), ["Past Simple · noch bestätigen", "Irregular verbs"], "in the sheet's order");
  // done without confirming: no line in the documentation
  const [einstieg] = plan;
  s.c.markiereSchritt(s.unit.id, einstieg.id, "erledigt");
  s.c.markiereSchritt(s.unit.id, block.id, "erledigt");
  const a = s.c.ablaufDerEinheit(s.unit.id)!;
  const namen = [...a.ergebnis.erledigt, ...a.ergebnis.nichtErreicht, ...a.ergebnis.uebersprungen].map((x) => x.titel).join(" | ");
  assert.equal(/noch bestätigen/.test(namen), false, namen);
  assert.equal((a.themen ?? []).some((t) => /noch bestätigen/.test(t)), false);
  s.aus();
});

test("3: confirming turns the provisional block into the skill's block, also after the lesson began; „Keine passt“ drops it", async () => {
  const s = await mitBlatt();
  const v = s.vg.vorgabeDerEinheit(s.unit.id)!;
  const i = v.punkte.findIndex((p) => p.inhalt === "Past Simple");
  const plan = s.c.cockpit(s.unit.id, { mitPlan: true }).plan;
  const block = plan.find((x) => x.vorlaeufig)!;
  // the lesson has begun: the plan is frozen
  assert.ok(s.c.markiereSchritt(s.unit.id, plan[0].id, "erledigt"));
  assert.ok(s.vg.bestaetigeVorgabe(s.unit.id, new Map([[i, [PAST]]]), s.teacher.id));
  const danach = s.c.leseStand(s.unit.id);
  assert.ok(danach.erledigt.includes(plan[0].id), "what was done stays");
  assert.equal(danach.plan!.some((x) => x.vorlaeufig), false);
  const neu = danach.plan!.filter((x) => x.skillId === PAST);
  assert.deepEqual(
    neu.map((x) => x.art),
    ["erklaeren", "ueben", "kontrolle"],
  );
  assert.equal(
    neu.reduce((m, x) => m + x.minuten, 0),
    block.minuten,
    "the block's minutes",
  );
  const order = danach.plan!.map((x) => x.id);
  assert.equal(order.indexOf(neu[0].id), plan.indexOf(block), "at the block's place");
  assert.equal(new Set(order).size, order.length, "ids stay unique");
  assert.deepEqual(s.vg.vorgabeDerEinheit(s.unit.id)!.skillIds.sort(), [IRREGULAR, PAST].sort());
  s.aus();

  // „Keine passt“ after the lesson began: the block goes, no Past Simple topic from the words
  const t = await mitBlatt();
  const v2 = t.vg.vorgabeDerEinheit(t.unit.id)!;
  const j = v2.punkte.findIndex((p) => p.inhalt === "Past Simple");
  const plan2 = t.c.cockpit(t.unit.id, { mitPlan: true }).plan;
  t.c.markiereSchritt(t.unit.id, plan2[0].id, "erledigt");
  assert.ok(t.vg.bestaetigeVorgabe(t.unit.id, new Map([[j, [null]]]), t.teacher.id));
  const ohne = t.c.leseStand(t.unit.id).plan!;
  assert.equal(ohne.some((x) => x.vorlaeufig || x.skillId === PAST), false, ohne.map((x) => x.titel).join(" | "));
  assert.equal(t.vg.vorgabeDerEinheit(t.unit.id)!.punkte[j].keinePasst, true);
  // and before anything is done the plan is made again without it
  t.db().prepare("DELETE FROM einheit_cockpit WHERE unit_id = ?").run(t.unit.id);
  assert.equal(t.c.planDerEinheit(t.unit.id).some((x) => x.vorlaeufig || /Past Simple/.test(x.titel)), false);
  t.aus();
});

test("3: confirmed before the lesson began, the topic keeps the sheet's place in the new plan", async () => {
  const s = await mitBlatt();
  const v = s.vg.vorgabeDerEinheit(s.unit.id)!;
  const i = v.punkte.findIndex((p) => p.inhalt === "Past Simple");
  const st = await import("./stundenplan");
  assert.deepEqual(st.themenDesPlans(s.c.planDerEinheit(s.unit.id)).map((t) => t.name).slice(0, 2), ["Past Simple · noch bestätigen", "Irregular verbs"]);
  assert.ok(s.vg.bestaetigeVorgabe(s.unit.id, new Map([[i, [PAST]]]), s.teacher.id));
  assert.deepEqual(s.vg.vorgabeDerEinheit(s.unit.id)!.skillIds, [PAST, IRREGULAR]);
  assert.deepEqual(st.themenDesPlans(s.c.planDerEinheit(s.unit.id)).map((t) => t.name).slice(0, 2), ["Past Simple", "Irregular verbs"]);
  s.aus();
});

// ---------- 4 writing before spelling ----------

test("4: for „Writing“ the kinds of text come before spelling, with and without KI", async () => {
  const s = await setup();
  const ps = await import("./pruefungsstoff");
  const student = s.repo.getStudent(s.sid)!;
  const punkt = (original: string, gruppe: "writing" | "sonstiges" = "writing") => ({ gruppe, original, inhalt: original, einheit: "", dokument: 0, quelle: "lehrer" as const, status: "pruefung" as const, grund: "", skill_id: null });
  for (const ki of [true, false]) {
    const [w] = ps.ordneZu([punkt("Writing")], { fach: "Englisch", student, ki });
    assert.equal(w.zuordnung, "unklar");
    const capitals = w.vorschlaege.indexOf("englisch.writing.capitals");
    assert.notEqual(w.vorschlaege[0], "englisch.writing.capitals", w.vorschlaege.join(", "));
    assert.ok(w.vorschlaege.slice(0, 2).includes("englisch.writing.email"), w.vorschlaege.join(", "));
    assert.ok(capitals === -1 || capitals === w.vorschlaege.length - 1, `spelling last: ${w.vorschlaege.join(", ")}`);
    const [sa] = ps.ordneZu([punkt("Schreibaufgabe", "sonstiges")], { fach: "Englisch", student, ki });
    assert.ok(!sa.vorschlaege.length || sa.vorschlaege[0] !== "englisch.writing.capitals");
  }
  // the order itself: kinds of text, then helps, then spelling; a Beschreibung is a kind of text
  assert.deepEqual(ps.schreibenZuerst(["englisch.writing.capitals", "englisch.writing.linking", "englisch.writing.email", "englisch.writing.description"]), [
    "englisch.writing.email",
    "englisch.writing.description",
    "englisch.writing.linking",
    "englisch.writing.capitals",
  ]);
  assert.deepEqual(ps.schreibenZuerst(["deutsch.recht.getrennt-zusammen", "deutsch.beschreiben.person"]), ["deutsch.beschreiben.person", "deutsch.recht.getrennt-zusammen"]);
  // other points keep their order
  const [g] = ps.ordneZu([{ ...punkt("Past simple and irregular verbs", "sonstiges"), gruppe: "grammatik" }], { fach: "Englisch", student, ki: false });
  assert.ok(g.vorschlaege.length === 0 || g.vorschlaege[0] !== "englisch.writing.email");
  s.aus();
});
