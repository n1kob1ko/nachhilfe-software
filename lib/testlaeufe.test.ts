/**
 * Testläufe A–D (niko, 25.10.2026: Abnahme der Vereinfachung): was die Durchläufe im Browser gefunden haben, hier mit
 * der Datenbank festgehalten. Mathematik-Vorgabe ohne „Grammatik“, ein Vorgabe-Punkt zum Bestätigen lässt die nahe
 * Schularbeit im Plan, die Worte des Anbieters bleiben aus dem Hinweis, und der Abschluss nennt eine Textarbeit nicht
 * doppelt und nicht als „nicht geübt“. Kein Schlüssel, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

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
  const sid = repo.createStudent({ name: "Paul Rechner", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  repo.addTest({ student_id: sid, date: tagAddieren(heute, 14), subject: "Mathematik", kind: "Schularbeit", topic: "Gleichungen", grade: null, points: null, max_points: null, notes: "", skill_ids: MATHE_SA, title: "", topics: ["Gleichungen", "Negative Zahlen"], status: "geplant", teacher_id: teacher.id, material_id: null });
  const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik" }).unit;
  return { repo, teacher, sid, unit, heute };
}

test("a Mathematik Vorgabe: what the exam also asks for is „weitere Themen“, never „weitere Grammatik“", async () => {
  const { unit, teacher, heute } = await mathe();
  const vg = await import("./vorgabe");
  const out = await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Bruchrechnen", materialIds: [], testId: null, keinName: false, heute });
  assert.ok("ok" in out);
  const v = vg.vorgabeDerEinheit(unit.id)!;
  const p = vg.pruefungZurVorgabe(v, "Mathematik", heute)!;
  assert.ok(p, "the near Schularbeit is found");
  const abw = vg.abweichung(v.punkte, v.skillIds, p, "Mathematik").join(" ");
  assert.match(abw, /weitere Themen/);
  assert.equal(/Grammatik/.test(abw), false);
  // a language keeps its word
  assert.match(vg.abweichung(v.punkte, v.skillIds, p, "Deutsch").join(" "), /weitere Grammatik/);
});

test("a Vorgabe point still to confirm comes first, the near Schularbeit keeps its step with an exercise; after confirming, the Vorgabe leads", async () => {
  const { unit, teacher, heute } = await mathe();
  const vg = await import("./vorgabe");
  const cockpit = await import("./cockpit");
  await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Gleichungen mit negativen Zahlen, Schularbeit in zwei Wochen", materialIds: [], testId: null, keinName: false, heute });
  const v = vg.vorgabeDerEinheit(unit.id)!;
  const i = v.punkte.findIndex((p) => p.zuordnung === "unklar" && p.vorschlaege.length > 0);
  assert.ok(i >= 0, "the rule path leaves the point to confirm");
  assert.deepEqual(v.skillIds, [], "nothing forced onto a skill");

  const plan = cockpit.planDerEinheit(unit.id);
  const titel = plan.map((s) => s.titel);
  const vorgabeSchritt = titel.findIndex((t) => t.startsWith("Üben: "));
  // the plan for the whole unit (lib/stundenplan.ts): the Schularbeit is a topic of its own, its practice step in the exam format
  const sa = plan.findIndex((s) => s.art === "ueben" && s.pruefung === true);
  assert.ok(vorgabeSchritt >= 0 && sa > vorgabeSchritt, `the Vorgabe first, then the Schularbeit: ${titel.join(" | ")}`);
  assert.ok(MATHE_SA.includes(plan[sa].skillId ?? ""), "something to send without confirming: an exercise for the exam's skill");

  const wahl = v.punkte[i].vorschlaege[0];
  assert.ok(vg.bestaetigeVorgabe(unit.id, new Map([[i, wahl]]), teacher.id));
  const danach = cockpit.planDerEinheit(unit.id);
  assert.ok(danach.some((s) => s.skillId === wahl && s.titel.startsWith("Üben: ")), "confirmed: an exercise for the chosen skill");
  const erst = danach.findIndex((s) => s.skillId === wahl);
  const pruefung = danach.findIndex((s) => s.pruefung === true && s.skillId !== wahl);
  assert.ok(erst >= 0 && (pruefung < 0 || erst < pruefung), "the Vorgabe leads, the Schularbeit after it");
});

test("the KI not reachable: the hint says so in plain words, without the provider's code or JSON", async () => {
  const { unit, teacher, heute } = await mathe();
  const vg = await import("./vorgabe");
  const router = await import("./ai/router");
  process.env.AI_PROVIDER = "compatible";
  process.env.AI_COMPATIBLE_BASE_URL = "http://127.0.0.1:9/v1";
  process.env.AI_COMPATIBLE_API_KEY = "nur-ein-test";
  router.resetRouter();
  let gefragt = 0;
  router.setTransport(async () => {
    gefragt += 1;
    throw new Error('503: {"error":{"message":"upstream overloaded","type":"server_error"}}');
  });
  try {
    const out = await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "Heute Gleichungen", materialIds: [], testId: null, keinName: false, heute });
    assert.ok("ok" in out);
    assert.ok(gefragt >= 1, "the KI was asked");
    const h = vg.vorgabeDerEinheit(unit.id)!.hinweis;
    assert.match(h, /^Die KI war nicht erreichbar\. Lernheft hat deinen Text selbst zerlegt\./);
    assert.equal(/503|\{|upstream/.test(h), false, h);
  } finally {
    router.setTransport(null);
    router.resetRouter();
    for (const k of ["AI_PROVIDER", "AI_COMPATIBLE_BASE_URL", "AI_COMPATIBLE_API_KEY"]) delete process.env[k];
  }
});

test("Abschluss: a title that starts with its Textsorte is not doubled", async () => {
  const { abschlussKarte } = await import("./abschluss");
  const k = abschlussKarte(null, null, [
    { id: 1, titel: "Textinterpretation zu „Der letzte Bus“", textsorte: "Textinterpretation", bewertung: { stand: "offen" }, vorschlag: true },
    { id: 2, titel: "Der rote Schal", textsorte: "Erörterung", bewertung: { stand: "offen" }, vorschlag: true },
  ]);
  const texte = k.gemacht.map((z) => z.text);
  assert.ok(texte.includes("Textinterpretation zu „Der letzte Bus“: Bewertung offen"), texte.join(" | "));
  assert.ok(texte.includes("Erörterung „Der rote Schal“: Bewertung offen"), texte.join(" | "));
});

test("Abschluss: a Textinterpretation written today does not count as „zuletzt nicht geübt“ for the exam", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const texts = await import("./texts");
  const ab = await import("./abschluss");
  const { endUnit } = await import("./learning");
  const { docFromText } = await import("./text-doc");
  const { tagAddieren, wienerDatum } = await import("./planung/zeit");
  const heute = wienerDatum(new Date());
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Ida Lesewald", grade: 12, klasse: 4, teacher_id: teacher.id, school: "", school_type: "HTL", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const TI = "deutsch.os.matura.textinterpretation";
  assert.ok(repo.getSkill(TI));
  repo.addTest({ student_id: sid, date: tagAddieren(heute, 10), subject: "Deutsch", kind: "Schularbeit", topic: "Textinterpretation", grade: null, points: null, max_points: null, notes: "", skill_ids: [TI], title: "", topics: ["Textinterpretation"], status: "geplant", teacher_id: teacher.id, material_id: null });
  const unit = units.startUnit(teacher.id, sid, { subject: "Deutsch", at: Date.now() - 50 * 60_000 }).unit;

  const ohne = endUnit(unit.id, { byTeacherId: teacher.id })!;
  const vorher = ab.belegeDerEinheit(unit.id, repo.getLesson(ohne)!).pruefung!;
  assert.deepEqual(vorher.offen, ["Textinterpretation"], "without a text it is still open");

  const t = texts.createText({ studentId: sid, teacherId: teacher.id, unitId: unit.id, subject: "Deutsch", topic: "Textinterpretation", title: "Textinterpretation zu „Der letzte Bus“", prompt: "Interpretiere die Kurzgeschichte." });
  assert.ok(texts.saveText(t.id, docFromText("Die Kurzgeschichte erzählt von einem Mädchen, das an einer Haltestelle wartet und den letzten Bus verpasst."), 0).ok);
  texts.setTextStatus(t.id, "fertig");
  const p = ab.belegeDerEinheit(unit.id, repo.getLesson(ohne)!).pruefung!;
  assert.deepEqual(p.offen, [], "the Textarbeit of today counts as practised");
  assert.equal(/nicht geübt/.test(ab.pruefungsZeile(p)), false);
});
