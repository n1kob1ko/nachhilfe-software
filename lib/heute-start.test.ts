/**
 * Heute bis zur ersten Übung (PR A1): die Karte zeigt die Länge der Einheit und immer die nächste Prüfung, „Einheit
 * starten“ nimmt den Platz der Karte (auch bei zwei Schülern gleichzeitig), und „Übung senden“ aus dem Plan hält den
 * Plan fest wie ein Paketschritt. Kein Schlüssel, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
])
  delete process.env[k];

/** Montag, 12. Oktober 2026, 08:30 in Wien (UTC+2): Minute 510. */
const MONTAG = "2026-10-12";
const MORGEN = new Date("2026-10-12T06:30:00Z");

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const planung = await import("./planung/repo");
  const units = await import("./units");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({ name, grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const raum = planung.createRaum({ building: "Hauptgebäude", name: "Raum Ost", mode: "vor_ort" });
  const platz = (studentId: number, start: number, dauer: number, gleichzeitig = false) => {
    const res = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: start, geplante_dauer: dauer, teacher_id: teacher.id, student_id: studentId, room_id: raum, gleichzeitig });
    assert.ok(res.ok, JSON.stringify(res));
    return res.ok ? res.id : 0;
  };
  return { repo, planung, units, teacher, schueler, platz };
}

// ---------- 1. die Karte: Dauer und nächste Prüfung ----------

test("die Karte: die nächste Prüfung steht immer da, kurz; nah ist sie hervorgehoben", async () => {
  const { heuteKarte, pruefungName } = await import("./heute");
  const nah = heuteKarte({ wahl: null, schritte: [], woEsHakt: [], pruefung: { titel: "Englisch-Schularbeit", datum: "2026-10-18", days: 6 }, dauerMin: 100 });
  assert.equal(nah.pruefung, "Englisch-Schularbeit in 6 Tagen");
  assert.equal(nah.pruefungNah, true);
  assert.equal(nah.dauerMin, 100);
  const weit = heuteKarte({ wahl: null, schritte: [], woEsHakt: [], pruefung: { titel: "Mathematik-Test", datum: "2026-12-07", days: 56 } });
  assert.equal(weit.pruefung, "Mathematik-Test in 56 Tagen", "auch nach 30 Tagen auf der Karte");
  assert.equal(weit.pruefungNah, false);
  assert.equal(weit.dauerMin, null);
  assert.equal(heuteKarte({ wahl: null, schritte: [], woEsHakt: [], pruefung: { titel: "Test", datum: "2026-10-13", days: 1 } }).pruefung, "Test morgen");
  assert.equal(heuteKarte({ wahl: null, schritte: [], woEsHakt: [], pruefung: null, dauerMin: 0 }).dauerMin, null, "ohne Uhrzeit keine Dauer");
  assert.equal(pruefungName({ title: "", kind: "Schularbeit", subject: "Englisch" }), "Englisch-Schularbeit");
  assert.equal(pruefungName({ title: "2. Mathematik-Schularbeit", kind: "Schularbeit", subject: "Mathematik" }), "2. Mathematik-Schularbeit");
  assert.equal(pruefungName({ kind: "Test", subject: "" }), "Test");
});

test("Heute: Dauer aus dem Platz, ohne Platz die geplante Dauer; die Prüfung auch in 75 Tagen", async () => {
  const { repo, planung, teacher, schueler, platz } = await setup();
  const { tagesplan, heuteKarten } = await import("./heute");
  const { tagAddieren } = await import("./planung/zeit");
  const lena = schueler("Lena Probst");
  const jonas = schueler("Jonas Feldner");
  platz(lena, 14 * 60, 100);
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  // a unit planned by hand, without a Platz: 50 minutes
  repo.saveLesson({ student_id: jonas, teacher_id: teacher.id, starts_at: `${MONTAG}T16:00`, duration_min: 50, subject: "Mathematik", topic: "", status: "geplant", activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [] });
  repo.addTest({ student_id: lena, date: tagAddieren(MONTAG, 75), subject: "Englisch", kind: "Schularbeit", topic: "Past tense", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "", topics: [], status: "geplant", teacher_id: teacher.id, material_id: null });

  const punkte = tagesplan(teacher.id, MORGEN);
  assert.deepEqual(punkte.map((p) => p.studentName), ["Lena Probst", "Jonas Feldner"]);
  const karten = heuteKarten(teacher.id, punkte, MORGEN);
  const l = karten.get(punkte[0].key)!;
  assert.equal(l.dauerMin, 100);
  assert.equal(l.pruefung, "Englisch-Schularbeit in 75 Tagen", "weiter weg als das Briefing schaut (60 Tage)");
  assert.equal(l.pruefungNah, false);
  const j = karten.get(punkte[1].key)!;
  assert.equal(j.dauerMin, 50, "die von Hand geplante Dauer, mit der auch der Plan rechnet");
  assert.equal(j.pruefung, null);
});

test("Heute: zwei Plätze eines Schülers am selben Tag, jede Karte hat die Daten ihrer eigenen Einheit (F0b)", async () => {
  const { planung, units, teacher, schueler, platz } = await setup();
  const { tagesplan, heuteKarten } = await import("./heute");
  const lena = schueler("Lena Probst");
  const frueh = platz(lena, 8 * 60, 50);
  const spaet = platz(lena, 15 * 60, 100);
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  const vorher = tagesplan(teacher.id, MORGEN);
  assert.deepEqual(vorher.map((p) => p.key), [`platz-${frueh}`, `platz-${spaet}`]);
  const karten = heuteKarten(teacher.id, vorher, MORGEN);
  assert.equal(karten.size, 2, "eine Karte je Platz, nicht je Schüler");
  assert.equal(karten.get(`platz-${frueh}`)!.dauerMin, 50);
  assert.equal(karten.get(`platz-${spaet}`)!.dauerMin, 100, "die zweite Karte zeigt nicht die Daten der ersten Einheit");

  // the first unit runs in Deutsch: its card has that unit, the second Platz stays its own, still to start
  units.startUnit(teacher.id, lena, { at: MORGEN.getTime(), platzId: frueh, subject: "Deutsch" });
  const nachher = tagesplan(teacher.id, MORGEN);
  const k = heuteKarten(teacher.id, nachher, MORGEN);
  const erste = nachher.find((p) => p.platzId === frueh)!;
  const zweite = nachher.find((p) => p.platzId === spaet)!;
  assert.notEqual(erste.einheitId, null);
  assert.equal(zweite.einheitId, null);
  assert.equal(k.get(erste.key)!.fach, "Deutsch", "die Karte der laufenden Einheit");
  assert.equal(k.get(zweite.key)!.dauerMin, 100);
  assert.notEqual(k.get(zweite.key), k.get(erste.key));
});

// ---------- 2. „Einheit starten“ nimmt den Platz der Karte ----------

test("Einheit starten: der Platz der Karte, nicht der erste offene des Tages", async () => {
  const { planung, units, teacher, schueler, platz } = await setup();
  const lena = schueler("Lena Probst");
  const frueh = platz(lena, 8 * 60, 50); // 08:00–08:50, am nächsten an 08:30
  const spaet = platz(lena, 15 * 60, 100); // 15:00–16:40
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  const { unit } = units.startUnit(teacher.id, lena, { at: MORGEN.getTime(), platzId: spaet });
  assert.equal(units.platzFuerEinheit(unit)?.id, spaet);
  assert.equal(planung.getGeplanteEinheit(frueh)?.unit_id, null, "der andere Platz bleibt offen");
});

test("Einheit starten: ohne Platz wie bisher; ein fremder oder schon vergebener Platz gilt nicht", async () => {
  const { planung, units, teacher, schueler, platz } = await setup();
  const lena = schueler("Lena Probst");
  const mia = schueler("Mia Sander");
  const frueh = platz(lena, 8 * 60, 50);
  const spaet = platz(lena, 15 * 60, 100);
  const miasPlatz = platz(mia, 10 * 60, 50);
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  // without a Platz (manual unit, other pages): the open Platz nearest to now, as before
  const ohne = units.startUnit(teacher.id, lena, { at: MORGEN.getTime() }).unit;
  assert.equal(units.platzFuerEinheit(ohne)?.id, frueh);
  units.finishUnit(ohne.id, "beendet", { byTeacherId: teacher.id, at: MORGEN.getTime() + 60_000 });
  // another student's Platz is never taken: the rule applies (the remaining open Platz)
  const fremd = units.startUnit(teacher.id, lena, { at: MORGEN.getTime() + 120_000, platzId: miasPlatz }).unit;
  assert.equal(units.platzFuerEinheit(fremd)?.id, spaet);
  assert.equal(planung.getGeplanteEinheit(miasPlatz)?.unit_id, null);
  units.finishUnit(fremd.id, "beendet", { byTeacherId: teacher.id, at: MORGEN.getTime() + 180_000 });
  // a Platz that already has a unit is not taken a second time
  const nochmal = units.startUnit(teacher.id, lena, { at: MORGEN.getTime() + 240_000, platzId: frueh }).unit;
  assert.equal(units.platzFuerEinheit(nochmal), null);
});

test("zwei Schüler gleichzeitig: jeder bekommt seinen eigenen Platz", async () => {
  const { planung, units, teacher, schueler, platz } = await setup();
  const lena = schueler("Lena Probst");
  const mia = schueler("Mia Sander");
  const lenaFrueh = platz(lena, 8 * 60, 50);
  const lenaMittag = platz(lena, 9 * 60, 100, true);
  const miaMittag = platz(mia, 9 * 60, 100, true);
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  const a = units.startUnit(teacher.id, mia, { at: MORGEN.getTime(), platzId: miaMittag }).unit;
  const b = units.startUnit(teacher.id, lena, { at: MORGEN.getTime() + 1000, platzId: lenaMittag }).unit;
  assert.equal(units.platzFuerEinheit(a)?.id, miaMittag);
  assert.equal(units.platzFuerEinheit(b)?.id, lenaMittag);
  assert.equal(planung.getGeplanteEinheit(lenaFrueh)?.unit_id, null);
});

// ---------- 3. „Übung senden“ aus dem Plan hält den Plan fest ----------

const MATHE_SA = ["mathe.gleichungen.einfach", "mathe.negativ.addieren", "mathe.negativ.multiplizieren", "mathe.gleichungen.text"];

/** Ein Gymnasiast mit Mathematik-Schularbeit in zwei Wochen und einer laufenden Einheit ohne Lernpaket. */
async function mathe() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { tagAddieren, wienerDatum } = await import("./planung/zeit");
  const heute = wienerDatum(new Date());
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Tobias Zahlwerk", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  repo.addTest({ student_id: sid, date: tagAddieren(heute, 14), subject: "Mathematik", kind: "Schularbeit", topic: "Gleichungen", grade: null, points: null, max_points: null, notes: "", skill_ids: MATHE_SA, title: "", topics: ["Gleichungen", "Negative Zahlen"], status: "geplant", teacher_id: teacher.id, material_id: null });
  const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik" }).unit;
  return { repo, teacher, sid, unit };
}

test("Übung senden aus dem Plan: der Plan wird beim ersten Senden festgehalten und die Übung beim Schritt gemerkt", async () => {
  const { unit, teacher } = await mathe();
  const cockpit = await import("./cockpit");
  const plan = cockpit.planDerEinheit(unit.id);
  // the practice step of the Schularbeit's skill (since the plan for the whole unit its explanation comes first and sends nothing)
  const sa = plan.find((s) => s.skillId && MATHE_SA.includes(s.skillId) && s.art === "ueben")!;
  assert.ok(sa, plan.map((s) => s.titel).join(" | "));
  assert.equal(cockpit.leseStand(unit.id).plan, null, "vorher ist nichts festgehalten");

  const out = await cockpit.sendeAusGenerator(unit.id, sa.skillId!, teacher.id, sa.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  const s = cockpit.leseStand(unit.id);
  assert.deepEqual(s.plan, plan, "der Plan von vor dem Senden");
  assert.deepEqual(s.gesendet[sa.id], [out.worksheetId], "wie bei einem Paketschritt");
  assert.equal(cockpit.hatBegonnen(s), true, "eine neue Vorgabe ändert den Ablauf nicht mehr von selbst");
  assert.deepEqual(cockpit.cockpit(unit.id, { mitPlan: true }).plan, plan, "die Einheit zeigt den festgehaltenen Plan");

  // a second exercise for the same step is added; from the tools (no step) it goes to the step of the skill
  const zwei = await cockpit.sendeAusGenerator(unit.id, sa.skillId!, teacher.id, sa.id);
  const drei = await cockpit.sendeAusGenerator(unit.id, sa.skillId!, teacher.id);
  assert.ok("worksheetId" in zwei && "worksheetId" in drei);
  assert.deepEqual(cockpit.leseStand(unit.id).gesendet[sa.id], [out.worksheetId, zwei.worksheetId, drei.worksheetId]);
  assert.deepEqual(cockpit.leseStand(unit.id).plan, plan, "der Plan bleibt");
});

test("Übung senden ohne Plan-Schritt (eigene Fähigkeit): der Plan wird trotzdem festgehalten", async () => {
  const { unit, teacher } = await mathe();
  const cockpit = await import("./cockpit");
  const plan = cockpit.planDerEinheit(unit.id);
  const fremd = "mathe.brueche.kuerzen";
  assert.ok(!plan.some((s) => s.skillId === fremd));
  const out = await cockpit.sendeAusGenerator(unit.id, fremd, teacher.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  const s = cockpit.leseStand(unit.id);
  assert.deepEqual(s.plan, plan);
  assert.deepEqual(s.gesendet, {}, "kein Schritt, bei dem die Übung stehen könnte");
});
