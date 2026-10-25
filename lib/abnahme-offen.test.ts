/**
 * Offene Punkte der Abnahme (niko, 25.10.2026): „Was steht heute an?“ ohne KI zerlegt „Gleichungen mit negativen Zahlen“
 * in Teile und lässt mehrere Fähigkeiten wählen; ein Schritt ohne Lernpaket sagt, fragt und nennt die erwartete Antwort;
 * ein neuer Schüler ohne Signal bekommt geprüfte Pakete zum Wählen; „Zur ersten Übung“; eine schon eingetragene Prüfung
 * wird nicht noch einmal angeboten; das allgemeine Budget heißt nach seinem Anbieter; die Textbeilage aus dem Material der
 * Prüfung. Kein Schlüssel, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { Lernpaket } from "./lernpakete";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR",
])
  delete process.env[k];

const MATHE_SA = ["mathe.gleichungen.einfach", "mathe.negativ.addieren", "mathe.negativ.multiplizieren", "mathe.gleichungen.text"];

/** Ein Gymnasiast (3. Klasse) mit Mathematik-Schularbeit in zwei Wochen und einer laufenden Einheit. */
async function mathe() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { tagAddieren, wienerDatum } = await import("./planung/zeit");
  const heute = wienerDatum(new Date());
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Tobias Zahlwerk", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const testId = repo.addTest({ student_id: sid, date: tagAddieren(heute, 14), subject: "Mathematik", kind: "Schularbeit", topic: "Gleichungen", grade: null, points: null, max_points: null, notes: "", skill_ids: MATHE_SA, title: "", topics: ["Gleichungen", "Negative Zahlen"], status: "geplant", teacher_id: teacher.id, material_id: null });
  const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik" }).unit;
  return { repo, teacher, sid, unit, heute, testId };
}

// ---------- 1. „Was steht heute an?“ ohne KI: Teile und mehrere Fähigkeiten ----------

test("teileVon: „mit“, „bei“, „sowie“ split a point; a single topic stays whole", async () => {
  const { teileVon } = await import("./vorgabe");
  assert.deepEqual(teileVon("Gleichungen mit negativen Zahlen"), ["Gleichungen", "negativen Zahlen"]);
  assert.deepEqual(teileVon("Brüche sowie Prozent"), ["Brüche", "Prozent"]);
  assert.deepEqual(teileVon("Gleichungen"), ["Gleichungen"]);
  // a part without a real word does not count
  assert.deepEqual(teileVon("Rechnen mit x"), ["Rechnen mit x"]);
});

test("without KI „Gleichungen mit negativen Zahlen“ offers candidates for each part, and several skills can be confirmed", async () => {
  const { unit, teacher, heute } = await mathe();
  const vg = await import("./vorgabe");
  const cockpit = await import("./cockpit");
  const out = await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Gleichungen mit negativen Zahlen, Schularbeit in zwei Wochen", materialIds: [], testId: null, keinName: false, heute });
  assert.ok("ok" in out);
  const v = vg.vorgabeDerEinheit(unit.id)!;
  assert.deepEqual(v.punkte.map((p) => p.inhalt), ["Gleichungen", "negativen Zahlen"]);
  const gl = v.punkte[0];
  const neg = v.punkte[1];
  assert.equal(gl.zuordnung, "unklar");
  assert.ok(gl.vorschlaege.includes("mathe.gleichungen.einfach"), `Gleichungen: ${gl.vorschlaege.join(", ")}`);
  assert.ok(gl.vorschlaege.every((id) => id.startsWith("mathe.gleichungen.")), gl.vorschlaege.join(", "));
  assert.ok(neg.vorschlaege.includes("mathe.negativ.addieren"), `negative Zahlen: ${neg.vorschlaege.join(", ")}`);

  // two for „Gleichungen“, one for „negativen Zahlen“
  assert.ok(vg.bestaetigeVorgabe(unit.id, new Map([[0, ["mathe.gleichungen.einfach", "mathe.gleichungen.text"]], [1, ["mathe.negativ.addieren", null]]]), teacher.id));
  const danach = vg.vorgabeDerEinheit(unit.id)!;
  assert.deepEqual([...danach.skillIds].sort(), ["mathe.gleichungen.einfach", "mathe.gleichungen.text", "mathe.negativ.addieren"]);
  assert.equal(danach.punkte.filter((p) => p.inhalt === "Gleichungen").length, 2, "one point per chosen skill, same words");
  assert.ok(danach.punkte.every((p) => p.zuordnung === "bestaetigt"));
  const plan = cockpit.planDerEinheit(unit.id);
  for (const id of danach.skillIds) assert.ok(plan.some((s) => s.skillId === id && s.titel.startsWith("Üben: ")), `a step for ${id}: ${plan.map((s) => s.titel).join(" | ")}`);
});

test("a point that names one skill clearly is not split", async () => {
  const { teileRegelPunkte } = await import("./vorgabe");
  await mathe();
  const roh = (t: string) => ({ gruppe: "sonstiges" as const, original: t, inhalt: t, einheit: "", dokument: 0, quelle: "lehrer" as const, status: "pruefung" as const, grund: "", skill_id: null });
  const st = { school_type: "Gymnasium", klasse: 3, grade: 7 };
  assert.deepEqual(teileRegelPunkte([roh("Gleichungen mit Klammern")], "Mathematik", st).map((p) => p.original), ["Gleichungen mit Klammern"]);
  assert.deepEqual(teileRegelPunkte([roh("Gleichungen mit negativen Zahlen")], "Mathematik", st).map((p) => p.original), ["Gleichungen", "negativen Zahlen"]);
});

// ---------- 2. Plan ohne Lernpaket: sagen, fragen, erwartete Antwort ----------

test("a plan step without a package says the skill's explanation and asks the first task of the exercise it would send", async () => {
  const { unit, repo, teacher } = await mathe();
  const cockpit = await import("./cockpit");
  const { EXPLAIN } = await import("./erklaerungen");
  const plan = cockpit.planDerEinheit(unit.id);
  const sa = plan.find((s) => s.skillId && MATHE_SA.includes(s.skillId))!;
  assert.ok(sa, plan.map((s) => s.titel).join(" | "));
  const f = cockpit.planFuehrung(unit.id, sa);
  assert.equal(f.sagt, EXPLAIN[sa.skillId!]);
  assert.ok(f.fragt && f.fragt.length > 3, `fragt: ${f.fragt}`);
  assert.ok(f.antwort && f.antwort.length > 0, `antwort: ${f.antwort}`);
  // the same again (no random preview) …
  assert.deepEqual(cockpit.planFuehrung(unit.id, sa), f);
  // … and the exercise sent starts with that very task
  const out = await cockpit.sendeAusGenerator(unit.id, sa.skillId!, teacher.id);
  assert.ok("worksheetId" in out, JSON.stringify(out));
  const erste = repo.listTasks(out.worksheetId)[0];
  assert.equal(cockpit.frageText(erste), f.fragt);
  assert.equal(cockpit.antwortText(erste), f.antwort);
  // after sending, the step shows the first task of the exercise sent
  assert.deepEqual(cockpit.planFuehrung(unit.id, sa), f);
  // a step without skill or exercise (Einstieg) has nothing to ask
  const einstieg = plan.find((s) => !s.skillId && !s.uebung)!;
  assert.deepEqual(cockpit.planFuehrung(unit.id, einstieg), { sagt: null, fragt: null, antwort: null });
});

test("frageText and antwortText: choices with letters, the start of a calculation, the accepted answer", async () => {
  const { frageText, antwortText } = await import("./cockpit");
  const mc = { prompt: "Welcher Fall?", data: { options: ["Nominativ", "Dativ"] }, answer: { correct: 1 }, solution: "" };
  assert.equal(frageText(mc), "Welcher Fall?\nA) Nominativ   B) Dativ");
  assert.equal(antwortText(mc), "B) Dativ");
  const calc = { prompt: "Löse die Gleichung.", data: { start: "3x + 4 = 19" }, answer: { accepted: ["5"] }, solution: "x = 5" };
  assert.equal(frageText(calc), "Löse die Gleichung.\n3x + 4 = 19");
  assert.equal(antwortText(calc), "5");
});

// ---------- 3. neuer Schüler ohne Signal: geprüfte Pakete zum Wählen ----------

const paket = (o: Partial<Lernpaket> & { id: number; title: string }): Lernpaket => ({
  fach: "Deutsch", schulart: "Volksschule", klasse: 4, schulstufe: 4, thema: "", skill_ids: [], schwierigkeit: "mittel", dauer_minuten: 50, ziel: "",
  quelle: "hand", status: "geprueft", created_by: null, created_at: "", updated_at: "", geprueft_von: 1, geprueft_am: "2026-10-01", praesentation_id: null,
  ki_call_id: null, geprueft_von_name: null, schritt_zahl: 5, minuten_summe: 50, ...o,
});

test("paketeZumWaehlen: only checked packages with steps, subject, school type and level of the student, at most three by title", async () => {
  const { paketeZumWaehlen } = await import("./vorbereitung-auto");
  const pakete = [
    paket({ id: 1, title: "Wortarten kennen" }),
    paket({ id: 2, title: "Die vier Fälle" }),
    paket({ id: 3, title: "Entwurf", status: "entwurf" }),
    paket({ id: 4, title: "Mathe", fach: "Mathematik" }),
    paket({ id: 5, title: "Dritte Klasse", schulstufe: 3 }),
    paket({ id: 6, title: "Leer", schritt_zahl: 0 }),
    paket({ id: 7, title: "Importiert, ungeprüft", quelle: "import", geprueft_am: null }),
    paket({ id: 8, title: "Satzglieder" }),
    paket({ id: 9, title: "Zeitformen" }),
  ];
  const student = { school_type: "Volksschule", grade: 4, subjects: ["Deutsch"] };
  assert.deepEqual(paketeZumWaehlen({ pakete, fach: "", student }).map((p) => p.title), ["Die vier Fälle", "Satzglieder", "Wortarten kennen"]);
  assert.deepEqual(paketeZumWaehlen({ pakete, fach: "Mathematik", student }).map((p) => p.title), ["Mathe"]);
});

// ---------- 4. Zur ersten Übung ----------

test("ersteUebung: from a step without tasks to the first open step with tasks, only before anything was sent", async () => {
  const { ersteUebung } = await import("./cockpit");
  const order = [1, 2, 3, 4, 5, 6, 7];
  const mit = new Set([6, 7]);
  const hat = (id: number) => mit.has(id);
  const s = { erledigt: [] as number[], uebersprungen: [] as number[] };
  assert.equal(ersteUebung(order, s, 1, hat, false), 6);
  assert.equal(ersteUebung(order, s, 6, hat, false), null, "the step itself has tasks");
  assert.equal(ersteUebung(order, s, 1, hat, true), null, "something was sent already");
  assert.equal(ersteUebung(order, { erledigt: [6], uebersprungen: [] }, 1, hat, false), 7, "a done step is not the target");
  // the order of this unit counts, not the package's
  assert.equal(ersteUebung([1, 7, 2, 3, 4, 5, 6], s, 1, hat, false), 7);
  assert.equal(ersteUebung(order, s, null, hat, false), null);
});

test("jumping to the first exercise only shows the step: nothing is done or skipped, the order stays", async () => {
  const { unit } = await mathe();
  const cockpit = await import("./cockpit");
  const plan = cockpit.planDerEinheit(unit.id);
  const ziel = plan.find((s) => s.skillId)!;
  assert.ok(cockpit.zeigeSchritt(unit.id, ziel.id));
  const s = cockpit.leseStand(unit.id);
  assert.equal(s.aktuell, ziel.id);
  assert.deepEqual([s.erledigt, s.uebersprungen], [[], []]);
  assert.equal(cockpit.hatBegonnen(s), false, "a Vorgabe may still re-plan");
  // „Weiter“ there goes on in order and comes back to the steps before
  cockpit.markiereSchritt(unit.id, ziel.id, "erledigt");
  const c = cockpit.cockpit(unit.id);
  const i = c.plan.findIndex((x) => x.id === ziel.id);
  assert.equal(c.planAktuell!.id, c.plan[i + 1]?.id ?? c.plan[0].id);
});

// ---------- 5. Prüfung schon eingetragen ----------

test("terminDatum and schonEingetragen: the same exam is found by subject, kind and date window", async () => {
  const { terminDatum, schonEingetragen } = await import("./vorgabe");
  const heute = "2026-10-25"; // a Sunday
  assert.equal(terminDatum("Schularbeit in zwei Wochen", heute), "2026-11-08");
  assert.equal(terminDatum("Test nächste Woche", heute), "2026-11-01");
  assert.equal(terminDatum("Test am Dienstag", heute), "2026-10-27");
  assert.equal(terminDatum("SA am 8.11.", heute), "2026-11-08");
  assert.equal(terminDatum("Test morgen", heute), "2026-10-26");
  assert.equal(terminDatum("Test", heute), null);
  const tests = [
    { id: 1, date: "2026-11-08", subject: "Mathematik", kind: "Schularbeit", title: "" },
    { id: 2, date: "2026-11-02", subject: "Englisch", kind: "Test", title: "" },
  ];
  assert.equal(schonEingetragen("Schularbeit in zwei Wochen", tests, heute, "Mathematik")?.id, 1);
  assert.equal(schonEingetragen("Schularbeit in zwei Wochen", tests, heute, "Deutsch"), null, "another subject");
  assert.equal(schonEingetragen("Test in zwei Wochen", tests, heute, "Mathematik"), null, "another kind");
  assert.equal(schonEingetragen("Schularbeit in vier Wochen", tests, heute, "Mathematik"), null, "too far from the date in the text");
  assert.equal(schonEingetragen("Test nächste Woche", tests, heute, "Englisch")?.id, 2);
});

test("the Vorgabe card's exam: „Schularbeit in zwei Wochen“ is already in, nothing to enter twice", async () => {
  const { unit, teacher, heute, repo, sid, testId } = await mathe();
  const vg = await import("./vorgabe");
  await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Gleichungen mit negativen Zahlen, Schularbeit in zwei Wochen", materialIds: [], testId: null, keinName: false, heute });
  const v = vg.vorgabeDerEinheit(unit.id)!;
  assert.match(v.terminText, /Schularbeit in zwei Wochen/i);
  assert.equal(vg.schonEingetragen(v.terminText, repo.upcomingTests(heute, sid), heute, "Mathematik")?.id, testId);
});

// ---------- 6. KI-Kosten: der Name des allgemeinen Budgets ----------

test("budgetName: the general budget is named after the providers that use it", async () => {
  const { budgetName } = await import("./ai/providers");
  const keiner = () => false;
  assert.equal(budgetName("anthropic", ["anthropic"], keiner), "Anthropic");
  assert.equal(budgetName("allgemein", ["compatible", "compatible"], keiner), "(Anbieter: OpenAI-kompatibel)");
  assert.equal(budgetName("allgemein", ["openrouter", "deepseek"], keiner), "(Anbieter: OpenRouter, DeepSeek)");
  // nobody uses it: the providers set up for it, else OpenRouter
  assert.equal(budgetName("allgemein", ["anthropic", "manual"], (id) => id === "deepseek"), "(Anbieter: DeepSeek)");
  assert.equal(budgetName("allgemein", ["anthropic"], keiner), "(Anbieter: OpenRouter)");
});

// ---------- 7. Textbeilage aus dem Material der Prüfung ----------

const GESCHICHTE = [
  "Die Brücke im Nebel",
  "",
  ...Array.from({ length: 12 }, (_, i) => `Zeile ${i + 1}: Am Morgen lag der Nebel so dicht über dem Fluss, dass Mira die andere Seite nicht sehen konnte.`),
].join("\n");

test("beilageZurPruefung: the Angabe of a text of the exam, else the Textbeilage of an earlier Schreibauftrag; else nothing", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const store = await import("./schreibauftrag-store");
  const { speichereAngabe } = await import("./schreibauftrag-bewertung");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Nora Feldweg", grade: 12, klasse: 4, teacher_id: teacher.id, school: "", school_type: "HTL", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const testId = repo.addTest({ student_id: sid, date: "2026-11-04", subject: "Deutsch", kind: "Schularbeit", topic: "Textinterpretation", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "", topics: ["Textinterpretation"], status: "geplant", teacher_id: teacher.id, material_id: null });
  assert.equal(store.beilageZurPruefung(testId, "textinterpretation"), null, "nothing there: the field stays empty");

  const s = store.cleanAuftragSettings("textinterpretation", { title: "Der kurze Weg", story: GESCHICHTE.split("\n").slice(2).join("\n"), author: "Erfundene Autorin", testId });
  assert.ok("settings" in s);
  const t = store.createAuftrag({ studentId: sid, teacherId: teacher.id, unitId: null, settings: s.settings });
  const frueher = store.beilageZurPruefung(testId, "textinterpretation")!;
  assert.equal(frueher.title, "Der kurze Weg");
  assert.equal(frueher.author, "Erfundene Autorin");
  assert.match(frueher.quelle, /Schreibauftrag „Der kurze Weg“/);
  assert.equal(store.beilageZurPruefung(testId, "eroerterung"), null, "another Textsorte");

  // an Angabe with the whole story goes first, its first line is the title
  speichereAngabe(t.id, "kurz", teacher.id);
  assert.equal(store.beilageZurPruefung(testId, "textinterpretation")!.title, "Der kurze Weg", "a short Angabe is no Textbeilage");
  speichereAngabe(t.id, GESCHICHTE, teacher.id);
  const a = store.beilageZurPruefung(testId, "textinterpretation")!;
  assert.equal(a.title, "Die Brücke im Nebel");
  assert.ok(a.story.startsWith("Zeile 1:"), a.story.slice(0, 40));
  assert.match(a.quelle, /Angabe/);
});
