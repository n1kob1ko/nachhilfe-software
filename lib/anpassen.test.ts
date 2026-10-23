/**
 * „Anpassen“ im Cockpit und die KI-Grenze je Schüler und Monat (Plan 2.2, niko 2026-10-23): die KI bekommt
 * Schritte und Tatsachen ohne Namen, ihre Vorschläge sind ungeprüft, übernommene gelten nur für diese Einheit,
 * Paket und Lernstand bleiben, ohne KI sagt der Knopf es. Die Grenze: student_id in jedem Aufruf zu einem Schüler,
 * Hinweis ab 1 €, Stopp ab 3 €, beides per Umgebungsvariable.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED", "AI_USD_PER_EUR", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD"])
  delete process.env[k];

/** The full example of docs/lernpaket-format.md (Deutsch, VS 4, „Die vier Fälle“, 7 steps). */
function beispiel(): Record<string, unknown> {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  return JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
}

let nr = 0;
async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const lp = await import("./lernpakete");
  const c = await import("./cockpit");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 4, klasse: 4, teacher_id: teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const sid = schueler("Mirela Brandauer");
  const andere = schueler("Ilvo Kranzl");
  const d = beispiel();
  d.titel = `Die vier Fälle ${++nr}`;
  const imp = lp.importiereLernpaket(JSON.stringify(d), teacher.id);
  assert.ok("id" in imp);
  const paket = lp.getLernpaket(imp.id)!;
  // a wrong answer on the package's skill, with the student's and another student's name in it
  const skill = "deutsch.grammatik.faelle";
  const ws = repo.createWorksheet(
    { title: "Fälle", subject: "Deutsch", grade: 4, school_type: "Volksschule", klasse: 4, topic: "Fälle", difficulty: "mittel", task_type: "free", kind: "uebung", source: "manuell", skill_ids: [skill] },
    [{ type: "free", skillId: skill, difficulty: "mittel", prompt: "Mirela gibt Ilvo den Ball. In welchem Fall steht „Ilvo“?", data: {}, answer: { accepted: ["3. Fall"], mode: "text" }, solution: "", hints: [], errorMap: [] }],
  );
  const asg = repo.assignWorksheet(ws, sid, "");
  const taskId = repo.listTasks(ws)[0].id;
  db()
    .prepare("INSERT INTO attempts (assignment_id, task_id, student_id, skill_id, attempt_no, answer, correct, error_label, error_type) VALUES (?, ?, ?, ?, 1, ?, 0, ?, ?)")
    .run(asg, taskId, sid, skill, "4. Fall, weil Mirela was gibt", "Wem-Frage nicht gestellt", "regel");
  const unit = units.startUnit(teacher.id, sid, { subject: "Deutsch" }).unit;
  assert.ok("ok" in c.waehlePaket(unit.id, paket.id));
  return { db, repo, lp, c, teacher, sid, andere, paket, unit };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `antwort`. */
async function mitKi(antwort: (req: AIRequest) => unknown, kosten = { input: 2_500, output: 1_200 }) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: antwort(req), refusal: false, model: req.model, usage: { ...kosten, cacheWrite: 0, cacheRead: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

/** `falsch`: the id of the fact with the wrong answer (F1, F2 … depend on what the app knows). */
const ANTWORT = (falsch: string) => ({
  vorschlaege: [
    { schritt: "S3", art: "beispiel", titel: "Beispiel mit Wem-Frage", text: "Die Oma schenkt dem Kind ein Buch. Wem schenkt sie es? Dem Kind: 3. Fall.", antwort: "3. Fall", tatsachen: [falsch, "F9"] },
    { schritt: "S2", art: "leichter", titel: "Nur zwei Fälle", text: "Ist „der Hund“ in „Der Hund bellt.“ 1. oder 4. Fall?", antwort: "1. Fall", tatsachen: [] },
    { schritt: "S2", art: "schwerer", titel: "ohne Antwort", text: "Bestimme alle Fälle im Satz.", antwort: null, tatsachen: [] },
    { schritt: "S99", art: "bei_fehler", titel: "gibt es nicht", text: "…", antwort: null, tatsachen: [] },
    { schritt: "s4", art: "bei_fehler", titel: "Frage mit Zeitwort", text: "Die Wem-Frage immer mit dem Zeitwort stellen: Wem gibt sie?", antwort: "nicht nötig", tatsachen: [] },
  ],
});

test("Anpassen: Schritte und Tatsachen ohne Namen; Vorschläge ungeprüft, nur für diese Einheit; Paket und Lernstand bleiben", async () => {
  const s = await setup();
  const a = await import("./anpassen");
  const falsch = a.anpassenDaten(s.unit.id)!.tatsachen.find((t) => t.text.startsWith("Falsch am"))!;
  assert.ok(falsch, "the wrong answer is a fact");
  const ki = await mitKi(() => ANTWORT(falsch.id));
  const paketVorher = JSON.stringify(s.lp.getLernpaket(s.paket.id));
  const zeilen = () => ["attempts", "skill_snapshots", "lessons", "tests", "lernpaket_schritte"].map((t) => (s.db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n);
  const vorher = zeilen();

  const out = await a.erstelleAnpassungen(s.unit.id, s.teacher.id);
  assert.deepEqual(out, { ok: true, anzahl: 3, verworfen: 3 }, "unknown step, unknown fact and a harder question without answer are dropped");
  assert.equal(ki.gefragt.length, 1);
  const req = ki.gefragt[0];
  const gesendet = `${req.system}\n${JSON.stringify(req.content)}`;
  for (const name of ["Mirela", "Brandauer", "Ilvo", "Kranzl"]) assert.ok(!gesendet.includes(name), `${name} geht nicht hinaus`);
  assert.ok(gesendet.includes("[Name]"), "names are replaced, not dropped");
  assert.ok(gesendet.includes("Wem-Frage nicht gestellt"), "the recent wrong answer goes along");
  assert.ok(gesendet.includes("Regel nicht verstanden"), "with its Fehlerart");
  assert.ok(gesendet.includes("S1: [Einstieg] Detektivfragen"), "the steps in the unit's order");
  assert.equal(req.fn, "anpassen");

  const offen = a.anpassungen(s.unit.id, "vorschlag");
  assert.equal(offen.length, 3);
  assert.deepEqual(offen.map((x) => x.art), ["beispiel", "leichter", "bei_fehler"]);
  assert.equal(offen[2].antwort, "", "„Bei Fehler“ has no expected answer");
  assert.equal(offen[0].bezug.length, 1, "only facts from the list, as the app wrote them");
  assert.match(offen[0].bezug[0], /^Falsch am .*„Mirela gibt Ilvo den Ball/, "the teacher sees the app's own fact, names and all");
  const schritte = s.c.cockpit(s.unit.id).schritte;
  assert.equal(offen[0].schritt_id, schritte[2].id);

  // accept one, discard one: for this unit only
  assert.ok(a.entscheide(s.unit.id, offen[0].id, "uebernommen"));
  assert.ok(a.entscheide(s.unit.id, offen[1].id, "verworfen"));
  assert.ok(!a.entscheide(s.unit.id, offen[1].id, "uebernommen"), "a discarded one does not come back by itself");
  assert.ok(!a.entscheide(s.unit.id + 1, offen[2].id, "uebernommen"), "not from another unit");
  assert.deepEqual(a.anpassungen(s.unit.id, "uebernommen").map((x) => x.id), [offen[0].id]);
  assert.equal(JSON.stringify(s.lp.getLernpaket(s.paket.id)), paketVorher, "the package never changes");
  assert.deepEqual(zeilen(), vorher, "nothing in Lernstand, diagnosis, documentation or tests");
  const unit2 = (await import("./units")).startUnit(s.teacher.id, s.andere, { subject: "Deutsch" }).unit;
  s.c.waehlePaket(unit2.id, s.paket.id);
  assert.equal(a.anpassungen(unit2.id).length, 0, "another unit with the same package sees nothing of it");

  // again: new suggestions replace the open ones, taken and discarded stay and are named as already suggested
  await a.erstelleAnpassungen(s.unit.id, s.teacher.id);
  assert.equal(ki.gefragt.length, 2);
  assert.ok(JSON.stringify(ki.gefragt[1].content).includes("Schon vorgeschlagen"));
  assert.deepEqual(a.anpassungen(s.unit.id, "uebernommen").map((x) => x.id), [offen[0].id]);
  assert.equal(a.anpassungen(s.unit.id, "vorschlag").length, 3);
  assert.equal(a.anpassungen(s.unit.id, "verworfen").length, 1);
  ki.aus();
});

test("Anpassen ohne KI, ohne Paket oder über der Grenze: eine Meldung, nichts gespeichert, das Cockpit bleibt", async () => {
  const s = await setup();
  const a = await import("./anpassen");
  const router = await import("./ai/router");
  router.setTransport(null);
  assert.equal(a.anpassenStatus(s.sid).moeglich, false);
  assert.match(a.anpassenStatus(s.sid).grund!, /KI ist aus/);
  const out = await a.erstelleAnpassungen(s.unit.id, s.teacher.id);
  assert.equal(out.ok, false);
  assert.equal(a.anpassungen(s.unit.id).length, 0);
  assert.equal((s.db().prepare("SELECT COUNT(*) AS n FROM ai_calls").get() as { n: number }).n, 0, "nothing sent, nothing logged");

  const ki = await mitKi(() => ANTWORT("F1"));
  s.c.waehlePaket(s.unit.id, null);
  assert.equal(a.anpassenDaten(s.unit.id), null);
  assert.deepEqual(await a.erstelleAnpassungen(s.unit.id, s.teacher.id), { ok: false, error: "Für „Anpassen“ braucht die Einheit ein Lernpaket mit Schritten." });
  s.c.waehlePaket(s.unit.id, s.paket.id);

  const { logCall } = await import("./ai/log");
  logCall({ fn: "briefing", tier: "standard", provider: "anthropic", model: "claude-sonnet-5-5", teacherId: null, unitId: null, studentId: s.sid, trigger: "", input: 0, output: 0, cacheWrite: 0, cacheRead: 0, durationMs: 0, costUsd: 3.5, status: "ok" });
  assert.equal(a.anpassenStatus(s.sid).moeglich, false);
  assert.match(a.anpassenStatus(s.sid).grund!, /KI-Grenze für diesen Schüler/);
  assert.equal((await a.erstelleAnpassungen(s.unit.id, s.teacher.id)).ok, false);
  assert.equal(ki.gefragt.length, 0);
  ki.aus();
});

test("pruefeAnpassen: nur Schritte und Tatsachen aus der Liste, leichter und schwerer nur mit Antwort, höchstens sechs", async () => {
  const { pruefeAnpassen } = await import("./ai/anpassen");
  const d = { schritte: [{ nr: "S1", id: 11 }, { nr: "S2", id: 12 }] as never, tatsachen: [{ id: "F1", text: "Lernstand 40 %" }] };
  const v = (o: object) => ({ schritt: "S1", art: "beispiel" as const, titel: "", text: "Beispiel", antwort: null, tatsachen: [], ...o });
  const out = pruefeAnpassen({ vorschlaege: [v({ tatsachen: ["f1", "F1", "F7"] }), v({ art: "schwerer", antwort: "  " }), ...Array.from({ length: 8 }, () => v({ schritt: "S2" }))] }, d);
  assert.ok(!("fehler" in out));
  assert.equal(out.vorschlaege.length, 6);
  assert.deepEqual(out.vorschlaege[0].bezug, ["Lernstand 40 %"], "case and duplicates do not matter");
  assert.equal(out.vorschlaege[0].titel, "Zusatzbeispiel", "an empty title gets the kind's name");
  assert.equal(out.vorschlaege[1].schritt_id, 12);
  assert.equal(out.verworfen, 1 + 1 + 3, "an unknown fact, a harder question without answer, three over the limit");
  assert.deepEqual(pruefeAnpassen({ vorschlaege: [v({ schritt: "S5" })] }, d), { fehler: "Die KI hat keinen brauchbaren Vorschlag geliefert." });
});

test("Grenze je Schüler: student_id im Protokoll, Hinweis ab 1 €, Stopp ab 3 €, andere Schüler und Testläufe unberührt", async () => {
  const s = await setup();
  const { z } = await import("zod");
  const router = await import("./ai/router");
  const { logCall, costByStudent } = await import("./ai/log");
  const k = await import("./ai/schueler-kosten");
  const ki = await mitKi(() => ({ ok: true }), { input: 0, output: 0 });
  const Antwort = z.object({ ok: z.boolean() });
  const letzte = () => s.db().prepare("SELECT student_id, status, error FROM ai_calls ORDER BY id DESC LIMIT 1").get() as { student_id: number | null; status: string; error: string };

  // the student comes from meta.studentId, else from the unit; requests about no one stay without
  assert.ok((await router.runAI("analyse", Antwort, "sys", "a", { meta: { studentId: s.sid } })).ok);
  assert.equal(letzte().student_id, s.sid);
  assert.ok((await router.runAI("echtzeit", Antwort, "sys", "b", { meta: { unitId: s.unit.id } })).ok);
  assert.equal(letzte().student_id, s.sid, "realtime requests only name the unit");
  assert.ok((await router.runAI("druckblatt", Antwort, "sys", "c", { meta: { teacherId: s.teacher.id } })).ok);
  assert.equal(letzte().student_id, null);
  assert.ok((await router.runAI("analyse", Antwort, "sys", "d", { meta: { studentId: 99_999 } })).ok, "an unknown student does not break a request");
  assert.equal(letzte().student_id, null);

  const g = k.schuelerGrenze();
  assert.deepEqual(g, { warnEur: 1, stopEur: 3, usdPerEur: 1.12 }, "defaults: 1 € and 3 €, 1.12 $ per €");
  const zahle = (usd: number, studentId = s.sid, test = false) =>
    logCall({ fn: "briefing", tier: "standard", provider: "anthropic", model: "claude-sonnet-5-5", teacherId: null, unitId: null, studentId, trigger: "", input: 0, output: 0, cacheWrite: 0, cacheRead: 0, durationMs: 0, costUsd: usd, status: "ok", test });
  assert.equal(k.schuelerStand(s.sid).stufe, "ok");
  zahle(1.1);
  assert.equal(k.schuelerStand(s.sid).stufe, "ok", "1.10 $ are 0.98 €");
  zahle(0.05);
  assert.equal(k.schuelerStand(s.sid).stufe, "warnung");
  assert.match(k.grenzeHinweis(k.schuelerStand(s.sid), "Mirela")!, /^KI-Kosten für Mirela in diesem Monat: 1,\d\d €\. Ab 3,00 € stoppt/);
  assert.ok((await router.runAI("analyse", Antwort, "sys", "e", { meta: { studentId: s.sid } })).ok, "the warning stops nothing");
  zahle(10, s.sid, true);
  assert.equal(k.schuelerStand(s.sid).stufe, "warnung", "test runs do not count");
  zahle(2.3);
  assert.equal(k.schuelerStand(s.sid).stufe, "aus");
  assert.equal(router.schuelerGestoppt("analyse", s.sid), true);

  const vorher = ki.gefragt.length;
  const nein = await router.runAI("analyse", Antwort, "sys", "f", { meta: { studentId: s.sid } });
  assert.ok(!nein.ok && nein.status === "budget" && nein.cause === "schuelergrenze");
  assert.match(!nein.ok ? nein.message : "", /KI-Grenze für diesen Schüler ist in diesem Monat erreicht \(3,00 €\)/);
  assert.deepEqual(letzte(), { student_id: s.sid, status: "budget", error: "Grenze je Schüler" });
  assert.equal((await router.runAI("echtzeit", Antwort, "sys", "g", { meta: { unitId: s.unit.id } })).ok, false, "also through the unit");
  assert.equal(ki.gefragt.length, vorher, "nothing was sent");
  assert.ok((await router.runAI("analyse", Antwort, "sys", "h", { meta: { studentId: s.andere } })).ok, "another student carries on");
  assert.ok((await router.runAI("druckblatt", Antwort, "sys", "i", {})).ok, "requests about no student carry on");
  assert.ok((await router.runAI("analyse", Antwort, "sys", "a", { meta: { studentId: s.sid } })).ok, "an answer already there costs nothing and is still given");

  const zeilen = costByStudent(new Date().toISOString().slice(0, 7));
  assert.equal(zeilen[0].id, s.sid, "Mehr › KI-Kosten: the most expensive student first");
  assert.equal(zeilen[0].key, "Mirela Brandauer");

  // configurable: the limits and the rate
  process.env.AI_STUDENT_LIMIT_EUR = "10";
  process.env.AI_STUDENT_WARN_EUR = "4";
  assert.equal(k.schuelerStand(s.sid).stufe, "ok", "3.45 $ are below 4 €");
  process.env.AI_USD_PER_EUR = "0.5";
  assert.equal(k.schuelerStand(s.sid).stufe, "warnung", "3.45 $ are 6.90 € at 0.50 $ per €");
  process.env.AI_STUDENT_LIMIT_EUR = "0";
  process.env.AI_USD_PER_EUR = "0.1";
  assert.equal(k.schuelerStand(s.sid).stufe, "warnung", "0 switches the stop off");
  for (const v of ["AI_STUDENT_LIMIT_EUR", "AI_STUDENT_WARN_EUR", "AI_USD_PER_EUR"]) delete process.env[v];
  ki.aus();
});
