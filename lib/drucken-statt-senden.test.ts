/**
 * Drucken statt senden (lib/cockpit.ts `druckeImSchritt`, Phase-C-Test: der Weg brauchte 6 Tippen): „Drucken“ neben „Übung senden“
 * baut genau die Übung, die der Schritt senden würde, ohne Zuweisung (der Schüler sieht sie nirgends), merkt sie als in dieser
 * Einheit gedruckt, und „Arbeit fotografieren“ wählt sie vor. Ein zweites Tippen druckt dieselbe Übung.
 *
 * Ohne KI: kein Schlüssel; der Transport wird ersetzt und zählt mit, damit sicher nichts hinausgeht. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const PAST = "englisch.tenses.pastsimple";

/** The full example of docs/lernpaket-format.md (Deutsch, VS 4, „Die vier Fälle“). */
function beispiel(): Record<string, unknown> & { schritte: Record<string, unknown>[] } {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  return JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
}

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const p = await import("./papier-einheit");
  const router = await import("./ai/router");
  let anfragen = 0;
  router.resetRouter();
  router.setTransport(async () => {
    anfragen++;
    throw new Error("keine KI im Test");
  });
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string, fach: string, schulform: "Volksschule" | "Gymnasium", klasse: number) =>
    repo.createStudent({ name, grade: klasse, klasse, teacher_id: teacher.id, school: "", school_type: schulform, subjects: [fach], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const zuweisungen = (worksheetId: number) => repo.listAssignmentsForWorksheet(worksheetId).length;
  return { db, repo, units, c, p, teacher, schueler, zuweisungen, anfragen: () => anfragen, aus: () => router.setTransport(null) };
}

test("a package step: printed, never assigned, marked for this unit; the same sheet again on a second tap; Arbeit fotografieren preselects it", async () => {
  const s = await setup();
  const lp = await import("./lernpakete");
  const d = beispiel();
  d.titel = "Die vier Fälle (Druck)";
  const imp = lp.importiereLernpaket(JSON.stringify(d), s.teacher.id);
  assert.ok("id" in imp);
  const paket = lp.getLernpaket(imp.id)!;
  const mara = s.schueler("Mara Druckl", "Deutsch", "Volksschule", 4);
  const theo = s.schueler("Theo Papierl", "Deutsch", "Volksschule", 4);
  const um = s.units.startUnit(s.teacher.id, mara, { subject: "Deutsch", at: Date.now() - 20 * 60_000 }).unit;
  const ut = s.units.startUnit(s.teacher.id, theo, { subject: "Deutsch", at: Date.now() - 20 * 60_000 }).unit;
  s.c.waehlePaket(um.id, paket.id);
  s.c.waehlePaket(ut.id, paket.id);
  const schritt = paket.schritte.find((x) => x.aufgaben.length > 0)!;

  const out = await s.c.druckeImSchritt(um.id, schritt.id, s.teacher.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  const w = s.repo.getWorksheet(out.worksheetId)!;
  assert.equal(w.student_id, mara, "this unit's student");
  assert.equal(s.repo.listTasks(w.id).length, schritt.aufgaben.length, "exactly the tasks the step would send");
  assert.equal(s.zuweisungen(w.id), 0, "printed, not sent: no assignment, nothing on the student's pages");
  assert.equal(s.c.gedrucktImSchritt(um.id, schritt.id), w.id);
  assert.equal(s.c.leseStand(um.id).gesendet[schritt.id], undefined, "printing is not sending");

  const nochmal = await s.c.druckeImSchritt(um.id, schritt.id, s.teacher.id);
  assert.deepEqual(nochmal, { worksheetId: w.id }, "a second tap prints the same sheet");

  // Arbeit fotografieren: the printed sheet is offered and preselected from the step
  const blaetter = s.p.blaetterDerEinheit(um.id);
  const b = s.p.blattZurUebung(blaetter, w.id);
  assert.ok(b);
  assert.deepEqual([b.key, b.art, b.assignmentId], [`u${w.id}`, "gedruckt", null]);
  assert.equal(s.p.blattFehler({ unitId: um.id, studentId: mara, blattKey: b.key }), null);

  // the other unit at the same time: nothing printed there, and the sheet is never offered to the other student
  assert.equal(s.c.gedrucktImSchritt(ut.id, schritt.id), null);
  assert.equal(s.p.blattZurUebung(s.p.blaetterDerEinheit(ut.id), w.id), null);
  assert.notEqual(s.p.blattFehler({ unitId: ut.id, studentId: theo, blattKey: b.key }), null);

  // a step without tasks prints nothing; a unit that ended neither
  assert.ok("fehler" in (await s.c.druckeImSchritt(um.id, paket.schritte[0].id, s.teacher.id)));
  s.units.finishUnit(ut.id, "abgebrochen");
  assert.ok("fehler" in (await s.c.druckeImSchritt(ut.id, schritt.id, s.teacher.id)));
  assert.equal(s.anfragen(), 0, "no KI");
  s.aus();
});

test("a plan step: an exercise from the Bestand is printed as this student's own copy; the Lernkontrolle from the generators; never assigned", async () => {
  const s = await setup();
  const zeit = await import("./planung/zeit");
  const jana = s.schueler("Jana Druckfeld", "Englisch", "Gymnasium", 2);
  s.repo.addTest({ student_id: jana, date: zeit.tagAddieren(zeit.wienerDatum(), 6), subject: "Englisch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [PAST], title: "", topics: [], status: "geplant", teacher_id: s.teacher.id, material_id: null });
  const aufgabe = (i: number) => ({ type: "grammar" as const, skillId: PAST, difficulty: "mittel" as const, prompt: `Yesterday we ___ (watch) film number ${i}.`, data: {}, answer: { accepted: ["watched"], mode: "text" as const }, solution: "watched", hints: [], errorMap: [] });
  // generic material without a student: it stays as it is and is never marked for one unit
  const bestand = s.repo.createWorksheet(
    { title: "Past Simple only", subject: "Englisch", grade: 6, school_type: "Gymnasium", klasse: 2, topic: "Tenses", difficulty: "mittel", task_type: "grammar", kind: "uebung", source: "generator", skill_ids: [PAST], student_id: null, status: "freigegeben" },
    [1, 2, 3, 4].map(aufgabe),
  );
  const unit = s.units.startUnit(s.teacher.id, jana, { subject: "Englisch", at: Date.now() - 20 * 60_000 }).unit;
  const plan = s.c.planDerEinheit(unit.id);
  const ueben = plan.find((x) => x.art === "ueben" && x.skillId === PAST)!;
  assert.ok(ueben, plan.map((x) => x.titel).join(" | "));
  assert.equal(ueben.uebung, `U${bestand}`);

  const out = await s.c.druckeImSchritt(unit.id, ueben.id, s.teacher.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  assert.notEqual(out.worksheetId, bestand, "a copy for this student");
  const w = s.repo.getWorksheet(out.worksheetId)!;
  assert.deepEqual([w.student_id, w.source_worksheet_id, w.title], [jana, bestand, "Jana – Past Simple only"]);
  assert.equal(s.repo.listTasks(w.id).length, 4);
  assert.equal(s.zuweisungen(w.id), 0);
  assert.equal((s.db().prepare("SELECT gedruckt_unit_id FROM worksheets WHERE id = ?").get(bestand) as { gedruckt_unit_id: number | null }).gedruckt_unit_id, null, "the shared exercise is not marked");
  assert.ok(s.c.leseStand(unit.id).plan, "like sending, printing keeps the plan as it was");

  const kontrolle = plan.find((x) => x.art === "kontrolle" && x.skillId === PAST);
  assert.ok(kontrolle, plan.map((x) => x.titel).join(" | "));
  const lk = await s.c.druckeImSchritt(unit.id, kontrolle.id, s.teacher.id);
  assert.ok("worksheetId" in lk, JSON.stringify(lk));
  assert.ok(s.repo.listTasks(lk.worksheetId).length > 0);
  assert.equal(s.zuweisungen(lk.worksheetId), 0);
  assert.equal(s.c.gedrucktImSchritt(unit.id, kontrolle.id), lk.worksheetId);

  // both are offered on paper, the newest first
  const blaetter = s.p.blaetterDerEinheit(unit.id).filter((b) => b.art === "gedruckt");
  assert.deepEqual(blaetter.map((b) => b.worksheetId).sort(), [w.id, lk.worksheetId].sort());
  assert.equal(s.repo.listAssignmentsForWorksheet(bestand).length, 0);
  assert.equal(s.anfragen(), 0, "no KI");
  s.aus();
});
