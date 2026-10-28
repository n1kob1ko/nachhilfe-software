/**
 * Die Lehrer-Knöpfe am Schritt (D1): „Einfacher erklären“, „Weitere Beispiele“, „Schwerere Aufgaben“, „Thema verstanden“,
 * „Anderes Thema“. Was jeder Knopf mit Plan, Schritten und Übungen tut, dass kein Beispiel zweimal kommt, die Zeilen im Abschluss,
 * die KI nur auf Tippen (mit Kosten, mit der Grenze des Schülers) und alles ohne KI. Kein Schlüssel, kein Aufruf nach außen: der
 * Transport wird ersetzt. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
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

/** Antwort des Ersatz-Transports bei „Einfacher erklären lassen“ (ohne Zahlen im Text, das Beispiel richtig gerechnet). */
const EINFACH = {
  sagt: "Durch einen Bruch teilen heißt: mit dem umgedrehten Bruch malnehmen. Du drehst nur den zweiten Bruch um und rechnest dann ganz normal mal.",
  beispiel: { aufgabe: "1/2 : 1/4 = ?", rechnung: ["1/2 · 4/1 = 4/2 = 2"], loesung: "2" },
  frage: "Was machst du mit dem zweiten Bruch?",
  antwort: "Ich drehe ihn um.",
  frage_rechnung: null,
  fehler: ["Den ersten Bruch umgedreht: nur der zweite wird umgedreht"],
};

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const sp = await import("./stundenplan");
  const k = await import("./knoepfe");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  const { resetKiModusCache } = await import("./ai/modus");
  resetKiModusCache();
  router.resetRouter();
  router.setTransport(null);
  const gefragt: AIRequest[] = [];
  /** the KI „on“: every request goes to this stand-in, never outside */
  const kiAn = () =>
    router.setTransport(async (req) => {
      gefragt.push(req);
      return { parsed: EINFACH, refusal: false, model: req.model, usage: { input: 1_200, output: 900, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
    });
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  /** a unit of 100 minutes, started `vor` minutes ago, with a held plan: Einstieg, Dividieren (45), Multiplizieren (35), Abschluss */
  const einheit = (sid: number, vor = 15) => {
    const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik", at: Date.now() - vor * 60_000 }).unit;
    const roh = [
      { titel: "Einstieg und Wiederholung", minuten: 10, beschreibung: "", uebung: null, skillId: null, art: "einstieg" as const, thema: null, quelle: null },
      ...sp.schritteZurFaehigkeit(DIV, 45),
      ...sp.schritteZurFaehigkeit(MUL, 35),
      { titel: "Abschluss", minuten: 10, beschreibung: "", uebung: null, skillId: null, art: "abschluss" as const, thema: null, quelle: null },
    ];
    const plan = roh.map((s, i) => ({ ...s, id: -(i + 1) }));
    db().prepare("INSERT INTO einheit_cockpit (unit_id, plan) VALUES (?, ?)").run(unit.id, JSON.stringify(plan));
    return { unit, plan, ids: (thema: string) => plan.filter((s) => s.thema === thema).map((s) => s.id) };
  };
  const kiAufrufe = (fn: string) => db().prepare("SELECT COUNT(*) FROM ai_calls WHERE fn = ?").pluck().get(fn) as number;
  const zaehle = (tabelle: "worksheets" | "assignments") => db().prepare(`SELECT COUNT(*) FROM ${tabelle}`).pluck().get() as number;
  const sendFragen = (unitId: number) =>
    (db().prepare("SELECT worksheet_id FROM assignments WHERE unit_id = ?").all(unitId) as { worksheet_id: number }[]).flatMap((w) => repo.listTasks(w.worksheet_id).map(c.gleicheFrage));
  return { db, repo, units, c, sp, k, zeit, router, teacher, schueler, einheit, kiAn, gefragt, kiAufrufe, zaehle, sendFragen };
}

const ok = <T extends object>(x: T | { fehler: string }): T => {
  assert.ok(!("fehler" in x), "fehler" in x ? x.fehler : "");
  return x as T;
};

test("the plan of the tests: Dividieren with Erklären, Üben and a Lernkontrolle, then Multiplizieren", async () => {
  const s = await setup();
  const { plan, ids } = s.einheit(s.schueler("Ada Probe"));
  assert.equal(plan.reduce((a, x) => a + x.minuten, 0), 100);
  assert.deepEqual(ids("Dividieren").map((id) => plan.find((x) => x.id === id)!.art), ["erklaeren", "ueben", "kontrolle"]);
  assert.ok(ids("Multiplizieren").length >= 2);
});

test("„Einfacher erklären“ without KI: says nothing simpler is stored, brings a new example; it never comes again, in no later exercise", async () => {
  const s = await setup();
  const sid = s.schueler("Mira Teilfeld");
  const { unit, ids } = s.einheit(sid);
  const [erklaeren, ueben] = ids("Dividieren");
  const vorher = { ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") };

  const eins = ok(s.k.einfacherErklaeren(unit.id, erklaeren, s.teacher.id));
  assert.equal(eins.eintrag.text, null, "the step already says the skill's short text: nothing simpler without KI");
  assert.equal(eins.eintrag.beispiele?.length, 1);
  const b = eins.eintrag.beispiele![0];
  assert.equal(b.herkunft, "generator");
  assert.ok(b.aufgabe && b.loesung);
  // KI off: the card offers nothing to pay for, only the sentence
  const e = s.k.knoepfeDerEinheit(unit.id)[0];
  assert.deepEqual(s.k.einfacherKiAngebot(e, s.repo.getStudent(sid)!), { erlaubt: false, grund: "Die KI ist aus." });
  assert.deepEqual(await s.k.einfacherMitKi(unit.id, e.id, s.teacher.id), { fehler: "Die KI ist aus." });
  assert.equal(s.kiAufrufe("einfacher"), 0);

  // not the unit's own example, and the next taps bring other ones
  const beispiel = s.c.beispielDerEinheit(unit.id, DIV);
  assert.notEqual(b.frage, beispiel && s.c.gleicheFrage(beispiel));
  const zwei = ok(s.k.einfacherErklaeren(unit.id, erklaeren, s.teacher.id));
  const drei = ok(s.k.einfacherErklaeren(unit.id, erklaeren, s.teacher.id));
  const fragen = [b, zwei.eintrag.beispiele![0], drei.eintrag.beispiele![0]].map((x) => x.frage);
  assert.equal(new Set(fragen).size, 3, fragen.join(" | "));

  // nothing went to the student
  assert.deepEqual({ ws: s.zaehle("worksheets"), asg: s.zaehle("assignments") }, vorher);
  // the Üben step's exercise takes none of them
  const imUeben = s.c.aufgabenImSchritt(unit.id, s.c.cockpit(unit.id).plan.find((x) => x.id === ueben)!).map(s.c.gleicheFrage);
  assert.ok(imUeben.length > 0);
  for (const f of fragen) assert.ok(!imUeben.includes(f), f);
  // a step without a skill: no button effect
  assert.deepEqual(s.k.einfacherErklaeren(unit.id, -1, s.teacher.id), { fehler: "Zu diesem Schritt gibt es keine Fähigkeit." });
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("„Einfacher erklären lassen“: only on tap, with the cost shown, stored per skill and Schulstufe, then free for every student; no student data in the prompt", async () => {
  const s = await setup();
  s.kiAn();
  const lina = s.schueler("Lina Sonnwald");
  const { unit, ids } = s.einheit(lina);
  const [erklaeren] = ids("Dividieren");
  ok(s.k.einfacherErklaeren(unit.id, erklaeren, s.teacher.id));
  assert.equal(s.kiAufrufe("einfacher"), 0, "the tap on „Einfacher erklären“ asks no KI");
  const e = s.k.knoepfeDerEinheit(unit.id)[0];
  const angebot = s.k.einfacherKiAngebot(e, s.repo.getStudent(lina)!);
  assert.ok(angebot?.erlaubt);
  if (angebot?.erlaubt) assert.match(angebot.kosten, /^ca\. \d+ Cent$/);

  assert.deepEqual(await s.k.einfacherMitKi(unit.id, e.id, s.teacher.id), { ok: true });
  assert.equal(s.kiAufrufe("einfacher"), 1);
  const nach = s.k.knoepfeDerEinheit(unit.id)[0];
  assert.equal(nach.inhalt.text, EINFACH.sagt);
  assert.equal(nach.inhalt.quelle, "ki");
  assert.equal(nach.inhalt.beispiele?.[0].herkunft, "generator", "the new example stays the one from the generator");
  const req = s.gefragt.find((r) => r.fn === "einfacher")!;
  const text = `${req.system}\n${JSON.stringify(req.content)}`;
  for (const n of ["Lina", "Sonnwald", "Ben", "Bruchteil"]) assert.ok(!text.includes(n), n);
  // a second tap on the KI: nothing more, no cost
  assert.deepEqual(await s.k.einfacherMitKi(unit.id, e.id, s.teacher.id), { ok: true });
  assert.equal(s.kiAufrufe("einfacher"), 1);

  // the next tap in this unit: the KI text was shown, nothing simpler is left, no KI offered again
  const zwei = ok(s.k.einfacherErklaeren(unit.id, erklaeren, s.teacher.id));
  assert.equal(zwei.eintrag.text, null);
  assert.equal(s.k.einfacherKiAngebot(s.k.knoepfeDerEinheit(unit.id)[1], s.repo.getStudent(lina)!), null);
  assert.match((await s.k.einfacherMitKi(unit.id, zwei.id, s.teacher.id) as { fehler: string }).fehler, /nicht gespeichert/);
  assert.equal(s.kiAufrufe("einfacher"), 1);

  // another student of the same Schulstufe: the stored text at once, without KI, even with the KI off
  s.router.setTransport(null);
  const ben = s.schueler("Ben Bruchteil");
  const b = s.einheit(ben);
  const fuerBen = ok(s.k.einfacherErklaeren(b.unit.id, b.ids("Dividieren")[0], s.teacher.id));
  assert.equal(fuerBen.eintrag.text, EINFACH.sagt);
  assert.equal(fuerBen.eintrag.quelle, "ki");
  assert.equal(s.kiAufrufe("einfacher"), 1);
  s.units.finishUnit(unit.id, "abgebrochen");
  s.units.finishUnit(b.unit.id, "abgebrochen");
});

test("the student's KI limit blocks the KI part of „Einfacher erklären“; the rest still works", async () => {
  const s = await setup();
  s.kiAn();
  const sid = s.schueler("Pia Grenzfall");
  const { unit, ids } = s.einheit(sid);
  s.db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, student_id) VALUES (?, 'aufgaben', 'standard', 'claude-sonnet-5-5', 'anthropic', 'ok', 9, 0, ?)").run(new Date().toISOString(), sid);
  const r = ok(s.k.einfacherErklaeren(unit.id, ids("Dividieren")[0], s.teacher.id));
  assert.equal(r.eintrag.text, null);
  assert.equal(r.eintrag.beispiele?.length, 1, "the new example comes without KI");
  const e = s.k.knoepfeDerEinheit(unit.id)[0];
  const angebot = s.k.einfacherKiAngebot(e, s.repo.getStudent(sid)!);
  assert.ok(angebot && !angebot.erlaubt);
  if (angebot && !angebot.erlaubt) assert.match(angebot.grund, /KI-Grenze/);
  assert.match((await s.k.einfacherMitKi(unit.id, e.id, s.teacher.id) as { fehler: string }).fehler, /KI-Grenze/);
  assert.equal(s.kiAufrufe("einfacher"), 0);
  assert.equal(s.k.knoepfeDerEinheit(unit.id)[0].inhalt.text, null);
  // the other buttons do not need the KI
  ok(s.k.weitereBeispiele(unit.id, ids("Dividieren")[0], s.teacher.id));
  s.router.setTransport(null);
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("„Weitere Beispiele“: two worked examples each tap, never one shown or sent before, only for the teacher", async () => {
  const s = await setup();
  const sid = s.schueler("Tom Zaehler");
  const { unit, ids } = s.einheit(sid);
  const [erklaeren, ueben] = ids("Dividieren");
  // an exercise of the step went out first
  ok(await s.c.sendeAusGenerator(unit.id, DIV, s.teacher.id, ueben));
  const gesendet = s.sendFragen(unit.id);
  assert.ok(gesendet.length > 0);
  const vorher = s.zaehle("assignments");
  const alle: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = ok(s.k.weitereBeispiele(unit.id, erklaeren, s.teacher.id));
    assert.equal(r.beispiele.length, 2);
    for (const b of r.beispiele) {
      assert.ok(b.aufgabe && b.loesung, "task and solution");
      assert.ok(!gesendet.includes(b.frage), `already sent: ${b.frage}`);
      alle.push(b.frage);
    }
  }
  assert.equal(new Set(alle).size, 6, alle.join(" | "));
  const beispiel = s.c.beispielDerEinheit(unit.id, DIV);
  if (beispiel) assert.ok(!alle.includes(s.c.gleicheFrage(beispiel)), "not the unit's example");
  assert.equal(s.zaehle("assignments"), vorher, "nothing sent");
  assert.equal(s.k.knoepfeDerEinheit(unit.id).filter((e) => e.art === "beispiele").length, 3);
  assert.deepEqual(s.k.weitereBeispiele(unit.id, -1, s.teacher.id), { fehler: "Zu diesem Schritt gibt es keine Fähigkeit." });
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("„Schwerere Aufgaben“: a preview one level up, only tasks of the step's skill; „Senden“ sends exactly them; up to level 5", async () => {
  const s = await setup();
  const sid = s.schueler("Eva Stufenreich");
  const { unit, ids } = s.einheit(sid);
  const ueben = ids("Dividieren")[1];
  const start = s.k.aktuelleStufe(unit.id, sid, DIV);
  const v = s.k.schwererVorschau(unit.id, ueben) as Exclude<ReturnType<typeof s.k.schwererVorschau>, { fehler: string }>;
  assert.ok(!("fehler" in v), JSON.stringify(v));
  assert.equal(v.stufe, start + 1);
  assert.equal(v.option.art, "schwerer");
  assert.equal(v.option.skillId, DIV);
  assert.ok(v.aufgaben.length > 0);
  for (const t of v.aufgaben) assert.ok([t.skillId, ...(t.skillIds ?? [])].includes(DIV), `${t.skillId}`);
  // the preview asks nothing and sends nothing; a second look shows the same tasks
  assert.equal(s.zaehle("assignments"), 0);
  const nochmal = s.k.schwererVorschau(unit.id, ueben) as typeof v;
  assert.deepEqual(nochmal.aufgaben.map(s.c.gleicheFrage), v.aufgaben.map(s.c.gleicheFrage));

  const out = ok(s.k.sendeSchwerer(unit.id, ueben, s.teacher.id));
  const a = s.repo.getAssignment(out.assignmentId)!;
  assert.equal(a.student_id, sid);
  assert.equal(a.unit_id, unit.id);
  assert.deepEqual(s.repo.listTasks(out.worksheetId).map(s.c.gleicheFrage), v.aufgaben.map(s.c.gleicheFrage), "sent exactly what the preview showed");
  const log = s.k.knoepfeDerEinheit(unit.id).filter((e) => e.art === "schwerer");
  assert.equal(log.length, 1);
  assert.equal(log[0].inhalt.stufe, start + 1);
  assert.equal(log[0].thema, "Dividieren");
  assert.ok(s.c.reaktionenDerEinheit(unit.id).some((r) => r.art === "schwerer" && r.skillId === DIV));

  // the next preview starts from what was just sent
  assert.equal(s.k.aktuelleStufe(unit.id, sid, DIV), start + 1);
  let stufe = start + 1;
  while (stufe < 5) {
    ok(s.k.sendeSchwerer(unit.id, ueben, s.teacher.id));
    stufe++;
    assert.equal(s.k.aktuelleStufe(unit.id, sid, DIV), stufe);
  }
  assert.match((s.k.schwererVorschau(unit.id, ueben) as { fehler: string }).fehler, /schwersten Stufe/);
  // a step without a skill
  assert.deepEqual(s.k.schwererVorschau(unit.id, -1), { fehler: "Zu diesem Schritt gibt es keine Fähigkeit." });
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("„Thema verstanden“: the rest of the topic is left out, the short Lernkontrolle stays on screen, the rest is re-timed; the Lernstand stays", async () => {
  const s = await setup();
  const { analyzeStudent } = await import("./service");
  const sid = s.schueler("Jonas Verstand");
  const { unit, ids } = s.einheit(sid, 15);
  const [erklaeren, ueben, kontrolle] = ids("Dividieren");
  s.c.markiereSchritt(unit.id, -1, "erledigt");
  const lernstand = JSON.stringify(analyzeStudent(sid)?.skills.find((x) => x.skill.id === DIV)?.mastery ?? null);

  const r = ok(s.k.themaVerstanden(unit.id, erklaeren, s.teacher.id));
  assert.deepEqual(r.weggelassen, [erklaeren, ueben]);
  assert.equal(r.kontrolle, kontrolle);
  const c = s.c.cockpit(unit.id);
  assert.equal(c.planAktuell?.id, kontrolle, "the Lernkontrolle is on screen");
  assert.deepEqual([...c.nichtNoetig].sort(), [erklaeren, ueben].sort());
  assert.ok(c.stand.uebersprungen.includes(erklaeren) && c.stand.uebersprungen.includes(ueben));
  assert.ok(!c.stand.uebersprungen.includes(kontrolle));
  // re-timed from now (F0a): the freed minutes go to the next practice step (up to 25 minutes), the Lernkontrolle and the
  // explanation keep their minutes, and the plan ends with the unit at minute 100, never later
  const ende = Math.max(...c.plan.filter((x) => c.ab.has(x.id)).map((x) => c.ab.get(x.id)! + c.minuten.get(x.id)!));
  assert.equal(ende + (c.frei ?? 0), 100, `ends at ${ende}, ${c.frei ?? 0} minutes free`);
  assert.equal(c.minuten.get(kontrolle), c.plan.find((x) => x.id === kontrolle)!.minuten, "the Lernkontrolle as planned, not shorter, not longer");
  for (const x of c.plan.filter((p) => p.thema === "Multiplizieren")) {
    const m = c.minuten.get(x.id)!;
    if (x.art === "ueben") assert.ok(m > x.minuten && m <= s.sp.UEBEN_MAX, `Üben ${x.minuten} → ${m}`);
    else assert.equal(m, x.minuten, `${x.art} keeps its minutes`);
  }
  // the decision is stored with the time; the Lernstand did not move
  const log = s.k.knoepfeDerEinheit(unit.id).find((e) => e.art === "verstanden")!;
  assert.deepEqual(log.inhalt, { schritte: [erklaeren, ueben], kontrolle });
  assert.match(log.at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  assert.equal(JSON.stringify(analyzeStudent(sid)?.skills.find((x) => x.skill.id === DIV)?.mastery ?? null), lernstand);
  // the Abschluss does not list them as skipped to repeat
  const ab = s.c.ablaufDerEinheit(unit.id)!;
  assert.ok(!ab.ergebnis.uebersprungen.some((x) => x.id === erklaeren || x.id === ueben));

  // the teacher leaves the Lernkontrolle out too
  assert.deepEqual(s.k.kontrolleWeglassen(unit.id, log.id), { ok: true });
  const c2 = s.c.cockpit(unit.id);
  assert.ok(c2.stand.uebersprungen.includes(kontrolle));
  assert.equal(c2.planAktuell?.id, ids("Multiplizieren")[0]);
  assert.ok(c2.nichtNoetig.has(kontrolle));
  assert.equal(s.k.knoepfeDerEinheit(unit.id).find((e) => e.art === "verstanden")!.inhalt.kontrolle, null);
  assert.ok("fehler" in s.k.kontrolleWeglassen(unit.id, log.id), "only once");
  assert.deepEqual(s.k.themaVerstanden(unit.id, erklaeren, s.teacher.id), { fehler: "Von diesem Thema ist nichts mehr offen." });
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("„Anderes Thema“: a topic of the plan; the open steps of the topic on screen go to „Nächstes Mal“, nothing is deleted", async () => {
  const s = await setup();
  const sid = s.schueler("Lea Wechsel");
  const { unit, plan, ids } = s.einheit(sid, 15);
  const [erklaeren, ueben, kontrolle] = ids("Dividieren");
  s.c.markiereSchritt(unit.id, -1, "erledigt");
  s.c.markiereSchritt(unit.id, erklaeren, "erledigt");
  const wahl = s.k.themenZurWahl(unit.id, s.c.cockpit(unit.id), ueben);
  assert.deepEqual(wahl.filter((w) => w.art === "plan").map((w) => w.name), ["Multiplizieren"]);

  const r = ok(s.k.wechsleThema(unit.id, ueben, { thema: "Multiplizieren" }, s.teacher.id));
  assert.deepEqual(r.verschoben, [ueben, kontrolle]);
  const c = s.c.cockpit(unit.id);
  assert.equal(c.planAktuell?.id, ids("Multiplizieren")[0]);
  assert.deepEqual([...c.verschoben].sort(), [ueben, kontrolle].sort());
  assert.equal(c.plan.length, plan.length, "nothing deleted");
  assert.ok(c.stand.erledigt.includes(erklaeren), "what was done stays done");
  assert.ok(!c.stand.uebersprungen.includes(ueben));
  const ab = s.c.ablaufDerEinheit(unit.id)!;
  assert.ok(ab.ergebnis.nichtErreicht.some((x) => x.id === ueben), "on „Nächstes Mal“ in the Abschluss");
  const log = s.k.knoepfeDerEinheit(unit.id).find((e) => e.art === "thema")!;
  assert.deepEqual([log.inhalt.von, log.inhalt.nach], ["Dividieren", "Multiplizieren"]);
  // a topic not on offer
  assert.deepEqual(s.k.wechsleThema(unit.id, ids("Multiplizieren")[0], { thema: "Erfunden" }, s.teacher.id), { fehler: "Dieses Thema steht nicht zur Wahl." });
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("„Anderes Thema“: the skill of the next exam comes in as a block with the minutes the old topic frees; the unit gets no longer", async () => {
  const s = await setup();
  const sid = s.schueler("Nico Pruefling");
  const heute = s.zeit.wienerDatum();
  s.repo.addTest({ student_id: sid, date: s.zeit.tagAddieren(heute, 6), subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [KUE], title: "", topics: [], status: "geplant", teacher_id: s.teacher.id, material_id: null });
  const { unit, plan, ids } = s.einheit(sid, 15);
  const [erklaeren, ueben, kontrolle] = ids("Dividieren");
  s.c.markiereSchritt(unit.id, -1, "erledigt");
  const wahl = s.k.themenZurWahl(unit.id, s.c.cockpit(unit.id), erklaeren);
  const kue = wahl.find((w) => w.art === "neu" && w.skillId === KUE);
  assert.ok(kue, JSON.stringify(wahl));
  assert.match(kue.warum, /^Schularbeit /);
  assert.ok(!wahl.some((w) => w.art === "neu" && (w.skillId === DIV || w.skillId === MUL)), "nothing already in the plan");

  const r = ok(s.k.wechsleThema(unit.id, erklaeren, { skillId: KUE }, s.teacher.id));
  assert.deepEqual(r.verschoben, [erklaeren, ueben, kontrolle]);
  assert.equal(r.nach, "Kürzen");
  const c = s.c.cockpit(unit.id);
  const block = c.plan.filter((x) => x.zusatz);
  assert.ok(block.length >= 2 && block.every((x) => x.skillId === KUE));
  assert.equal(block.reduce((a, x) => a + x.minuten, 0), 45, "the minutes Dividieren freed");
  assert.equal(c.planAktuell?.id, block[0].id);
  // after Dividieren, before Multiplizieren; every old step still there
  const order = c.plan.map((x) => x.id);
  assert.ok(order.indexOf(block[0].id) > order.indexOf(kontrolle) && order.indexOf(block[0].id) < order.indexOf(ids("Multiplizieren")[0]));
  for (const x of plan) assert.ok(order.includes(x.id));
  const ende = Math.max(...c.plan.filter((x) => c.ab.has(x.id)).map((x) => c.ab.get(x.id)! + c.minuten.get(x.id)!));
  assert.ok(ende <= 100, `ends at ${ende}`);
  // the new block's steps work with the other buttons
  ok(s.k.weitereBeispiele(unit.id, block[0].id, s.teacher.id));
  // a skill that is not on offer
  assert.deepEqual(s.k.wechsleThema(unit.id, block[0].id, { skillId: "mathe.zahlen.runden" }, s.teacher.id), { fehler: "Dieses Thema steht nicht zur Wahl." });
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("the Abschluss: „Angepasst: …“ under what was done, „Lehrkraft: Thema verstanden“ as the teacher's observation, never as a result", async () => {
  const s = await setup();
  const ab = await import("./abschluss");
  const { endUnit } = await import("./learning");
  const sid = s.schueler("Kim Abschluss");
  const { unit, ids } = s.einheit(sid, 30);
  const [erklaeren, ueben] = ids("Dividieren");
  ok(s.k.einfacherErklaeren(unit.id, erklaeren, s.teacher.id));
  ok(s.k.weitereBeispiele(unit.id, erklaeren, s.teacher.id));
  ok(s.k.sendeSchwerer(unit.id, ueben, s.teacher.id));
  ok(s.k.themaVerstanden(unit.id, ueben, s.teacher.id));
  // the short Lernkontrolle is on screen; the teacher goes on with Multiplizieren instead
  ok(s.k.wechsleThema(unit.id, ids("Dividieren")[2], { thema: "Multiplizieren" }, s.teacher.id));

  const eintraege = s.k.knoepfeDerEinheit(unit.id);
  assert.equal(s.k.angepasstZeile(eintraege), "Angepasst: einfacher erklärt (Dividieren), weitere Beispiele (Dividieren), schwerere Aufgaben (Dividieren), anderes Thema (Multiplizieren statt Dividieren)");
  assert.deepEqual(s.k.verstandenZeilen(eintraege), ["Lehrkraft: Thema verstanden (Dividieren)"]);
  assert.equal(s.k.angepasstZeile([{ art: "thema", thema: "Dividieren", inhalt: { von: "Dividieren", nach: "Kürzen" } }]), "Angepasst: anderes Thema (Kürzen statt Dividieren)");
  assert.equal(s.k.angepasstZeile([]), null);

  const lessonId = endUnit(unit.id, { byTeacherId: s.teacher.id })!;
  const k = ab.karteDerEinheit(unit.id, s.repo.getLesson(lessonId)!);
  const angepasst = k.gemacht.find((z) => z.text.startsWith("Angepasst:"));
  assert.ok(angepasst, k.gemacht.map((z) => z.text).join("\n"));
  assert.equal(angepasst.von, "anpassung");
  assert.match(angepasst.text, /einfacher erklärt \(Dividieren\)/);
  assert.match(angepasst.text, /schwerere Aufgaben \(Dividieren\)/);
  const verstanden = k.gut.find((z) => z.text === "Lehrkraft: Thema verstanden (Dividieren)");
  assert.ok(verstanden, k.gut.map((z) => z.text).join("\n"));
  assert.equal(verstanden.von, "beobachtung");
  assert.equal(ab.hatSichereErgebnisse(k.gut), false, "no answer was graded: nothing secure");
  assert.match(ab.dokuText(k.gut), /Lehrkraft: Thema verstanden \(Dividieren\) \(Beobachtung\)/);
});

test("with a chosen Lernpaket: „Einfacher erklären“ takes the package's „Bei Fehler“, „Thema verstanden“ keeps its Lernkontrolle, „Anderes Thema“ points elsewhere", async () => {
  const s = await setup();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const lp = await import("./lernpakete");
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  const d = JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
  const imp = lp.importiereLernpaket(JSON.stringify(d), s.teacher.id);
  assert.ok("id" in imp);
  const p = lp.getLernpaket(imp.id)!;
  const sid = s.repo.createStudent({
    name: "Uli Faelle", grade: 4, klasse: 4, teacher_id: s.teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  assert.deepEqual(s.c.waehlePaket(unit.id, p.id), { ok: true });
  const [einstieg, erklaerung] = p.schritte;
  const kontrolle = p.schritte.find((x) => x.art === "kontrolle")!;

  const r = ok(s.k.einfacherErklaeren(unit.id, erklaerung.id, s.teacher.id));
  assert.equal(r.eintrag.text, erklaerung.bei_fehler.trim());
  assert.equal(r.eintrag.quelle, "paket");

  // „Anderes Thema“ offers only new skills, none of the package's (F0a: the package becomes a topic of the plan, see the test below)
  const wahl = s.k.themenZurWahl(unit.id, s.c.cockpit(unit.id), einstieg.id);
  assert.ok(wahl.every((w) => w.art === "neu" && !p.skill_ids.includes(w.skillId)), JSON.stringify(wahl));
  assert.deepEqual(s.k.wechsleThema(unit.id, einstieg.id, { thema: "Irgendwas" }, s.teacher.id), { fehler: "Dieses Thema steht nicht zur Wahl." });
  assert.equal(s.c.cockpit(unit.id).paket?.id, p.id, "nothing changed");

  s.c.markiereSchritt(unit.id, einstieg.id, "erledigt");
  const v = ok(s.k.themaVerstanden(unit.id, erklaerung.id, s.teacher.id));
  assert.equal(v.kontrolle, kontrolle.id);
  assert.deepEqual(v.weggelassen, p.schritte.filter((x) => x.id !== einstieg.id && x.id !== kontrolle.id).map((x) => x.id));
  assert.equal(s.c.cockpit(unit.id).aktuell?.id, kontrolle.id);
  assert.deepEqual(s.c.ablaufDerEinheit(unit.id)!.ergebnis.uebersprungen, [], "left out by the teacher's decision: nothing to repeat");
  s.units.finishUnit(unit.id, "abgebrochen");
});
