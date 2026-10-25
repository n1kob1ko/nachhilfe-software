/**
 * Vorbereitung automatisch (niko, 25.10.2026): die Reihenfolge Prüfung > Schulstoff > vom Schüler gemeldet >
 * wiederholte Fehler > offene Ziele > Wiederholung, nur geprüfte Pakete, Heute und Unterricht wählen dasselbe, das
 * Briefing gilt je Datenstand (auch an späteren Tagen), und die KI läuft im Hintergrund nur, wenn alles erlaubt ist,
 * und blockiert nie. Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import type { Lernpaket } from "./lernpakete";
import type { Signal, SchuelerStufe } from "./vorbereitung-auto";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR",
])
  delete process.env[k];

// ---------- the ranking, without the database ----------

const paket = (o: Partial<Lernpaket> & { id: number; title: string }): Lernpaket => ({
  fach: "Deutsch", schulart: "Volksschule", klasse: 4, schulstufe: 4, thema: "", skill_ids: [], schwierigkeit: "mittel", dauer_minuten: 50, ziel: "",
  quelle: "hand", status: "geprueft", created_by: null, created_at: "", updated_at: "", geprueft_von: 1, geprueft_am: "2026-10-01", praesentation_id: null,
  ki_call_id: null, geprueft_von_name: null, schritt_zahl: 5, minuten_summe: 50, ...o,
});
const vs4: SchuelerStufe = { school_type: "Volksschule", grade: 4, subjects: ["Deutsch"] };
const gleich = (a: string, b: string) => a === b;
const sig = (art: Signal["art"], skill: string, o: Partial<Signal> = {}): Signal => ({ art, fach: "Deutsch", skill_ids: [skill], stoff: [], thema: skill, warum: `${art}: ${skill}`, ...o });

test("Reihenfolge: Prüfung > Schulstoff > vom Schüler gemeldet > wiederholte Fehler > offene Ziele > Lernstand > Wiederholung > letzte Einheit", async () => {
  const { waehleAutomatisch, SIGNAL_RANG } = await import("./vorbereitung-auto");
  const arten: Signal["art"][] = ["pruefung", "schulstoff", "wunsch", "fehler", "ziel", "lernstand", "wiederholung", "letzte_einheit"];
  assert.deepEqual([...arten].sort((a, b) => SIGNAL_RANG[b] - SIGNAL_RANG[a]), arten);
  // every kind with its own package; the signals arrive in reverse order
  const signale = [...arten].reverse().map((a) => sig(a, `d.${a}`));
  const pakete = arten.map((a, i) => paket({ id: i + 1, title: `Paket ${a}`, skill_ids: [`d.${a}`] }));
  for (const [i, art] of arten.entries()) {
    const w = waehleAutomatisch({ pakete: pakete.slice(i), student: vs4, fach: "Deutsch", signale, verwandt: gleich });
    assert.equal(w.art, "paket");
    assert.equal(w.art === "paket" && w.signal.art, art, `ohne die Pakete davor gewinnt ${art}`);
    assert.equal(w.art === "paket" && w.warum, `${art}: d.${art}`, "das Warum nennt das Signal");
    assert.equal(w.art === "paket" && w.luecke?.art, i === 0 ? undefined : "pruefung", "und sagt, dass für die Prüfung ein Paket fehlt");
  }
});

test("Gleichstand: die frühere Prüfung zuerst, sonst die Reihenfolge, in der die Signale kamen", async () => {
  const { ordneSignale } = await import("./vorbereitung-auto");
  const spaet = sig("pruefung", "d.spaet", { tage: 20 });
  const frueh = sig("pruefung", "d.frueh", { tage: 5 });
  const f1 = sig("fehler", "d.f1");
  const f2 = sig("fehler", "d.f2");
  const ordne = (signale: Signal[]) => ordneSignale({ fach: "Deutsch", student: vs4, signale }).map((s) => s.skill_ids[0]);
  assert.deepEqual(ordne([f2, spaet, f1, frueh]), ["d.frueh", "d.spaet", "d.f2", "d.f1"]);
  assert.deepEqual(ordne([f1, f2]), ["d.f1", "d.f2"], "gleich stark: wie sie kamen");
  const mathe = sig("pruefung", "m.x", { fach: "Mathematik", tage: 1 });
  assert.deepEqual(ordne([mathe, f1]), ["d.f1"], "ein anderes Fach zählt nicht");
});

test("Empfehlungen der App als Signal: Schulstoff, wiederholter Fehler (auch bei einer Schwäche), Lernstand, Wiederholung", async () => {
  const { artVonEmpfehlung } = await import("./vorbereitung-auto");
  assert.equal(artVonEmpfehlung({ rule: 1 }), null, "die Prüfung kommt aus den Prüfungen selbst");
  assert.equal(artVonEmpfehlung({ rule: 2 }), "schulstoff");
  assert.equal(artVonEmpfehlung({ rule: 3 }), "lernstand");
  assert.equal(artVonEmpfehlung({ rule: 3, repeatedError: "3× Vorzeichenfehler" }), "fehler");
  assert.equal(artVonEmpfehlung({ rule: 4 }), "fehler");
  assert.equal(artVonEmpfehlung({ rule: 5 }), "lernstand");
  assert.equal(artVonEmpfehlung({ rule: 6 }), "wiederholung");
  assert.equal(artVonEmpfehlung({ rule: 7 }), null, "„Weiter“ ist kein Grund für heute");
});

test("nur geprüft: ein ungeprüftes KI-Paket wird nie vorausgewählt, auch wenn es besser passt", async () => {
  const { waehleAutomatisch, fokusAus } = await import("./vorbereitung-auto");
  const { vorbereitetText } = await import("./heute");
  const ki = paket({ id: 1, title: "Fälle von der KI", skill_ids: ["d.pruefung"], quelle: "ki", geprueft_am: null });
  const geprueft = paket({ id: 2, title: "Artikel", skill_ids: ["d.fehler"], praesentation_id: 7 });
  const signale = [sig("pruefung", "d.pruefung"), sig("fehler", "d.fehler")];
  let w = waehleAutomatisch({ pakete: [ki, geprueft], student: vs4, fach: "Deutsch", signale, verwandt: gleich });
  assert.equal(w.art === "paket" && w.paket.id, 2);
  assert.deepEqual(w.art === "paket" && w.entwuerfe.map((p) => p.id), [1], "das KI-Paket steht nur als Entwurf da");
  assert.equal(vorbereitetText(w, []), "Lernpaket „Artikel“ · mit Präsentation");
  w = waehleAutomatisch({ pakete: [ki], student: vs4, fach: "Deutsch", signale, verwandt: gleich });
  assert.equal(w.art, "kein_paket", "ohne geprüftes Paket: der Plan aus den Daten");
  assert.equal(vorbereitetText(w, [{ minuten: 10, titel: "a", beschreibung: "", uebung: "U1" }, { minuten: 40, titel: "b", beschreibung: "", uebung: null }]), "Plan aus den Daten: 2 Schritte, 1 Übung bereit");
  // the plan's focus never carries the student's words
  const wunsch: Signal = { ...sig("wunsch", "d.faelle"), thema: "Die vier Fälle", warum: "Lena schreibt: „Den Dativ verstehe ich nicht.“" };
  const f = fokusAus({ art: "kein_paket", signal: wunsch, thema: "Die vier Fälle", entwuerfe: [] })!;
  assert.equal(f.beschreibung, "Vom Schüler gemeldet: Die vier Fälle");
  assert.ok(!JSON.stringify(f).includes("verstehe"));
});

test("die Karte: die nahe Prüfung, die das Thema gewählt hat, steht einmal (im Warum)", async () => {
  const { heuteKarte } = await import("./heute");
  const pruefung = sig("pruefung", "m.brueche", { fach: "Mathematik", stoff: ["Brüche"], thema: "Brüche", warum: "Schularbeit am 30.10. – Brüche", tage: 5 });
  const k = heuteKarte({ wahl: { art: "kein_paket", signal: pruefung, thema: "Brüche", entwuerfe: [] }, schritte: [], woEsHakt: [], pruefung: { titel: "Schularbeit Mathematik", datum: "2026-10-30", days: 5 } });
  assert.equal(k.pruefung, null);
  assert.equal(k.empfehlung, "Schularbeit Mathematik am 30. Okt. (in 5 Tagen) – Brüche");
  assert.equal(k.warumPruefung, true);
  assert.equal(k.fach, "Mathematik", "in diesem Fach startet die Einheit");
  const ki = heuteKarte({ wahl: null, schritte: [], woEsHakt: ["Aus den Daten"], pruefung: null, kiWoEsHakt: ["Dativ nach Präpositionen wird verwechselt."] });
  assert.deepEqual(ki.schwierigkeiten, ["Dativ nach Präpositionen wird verwechselt."], "mit KI-Briefing: seine Schwierigkeiten");
  assert.equal(ki.mitKi, true);
});

// ---------- with the database ----------

function beispiel(): Record<string, unknown> {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  return JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
}

const KI_ANTWORT = {
  letzter_stand: ["Zuletzt Artikel geübt."],
  wo_es_hakt: ["Artikel bei Nomen auf -ung werden verwechselt."],
  plan: [
    { minuten: 10, titel: "Einstieg", beschreibung: "Wiederholen.", uebung_id: null },
    { minuten: 30, titel: "Üben", beschreibung: "Artikel.", uebung_id: null },
    { minuten: 10, titel: "Abschluss", beschreibung: "Hausübung.", uebung_id: null },
  ],
  uebungen: [],
  hinweis: null,
};

let nr = 0;
async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const lp = await import("./lernpakete");
  const c = await import("./cockpit");
  const auto = await import("./vorbereitung-auto");
  const heute = await import("./heute");
  const briefing = await import("./briefing");
  const ba = await import("./briefing-auto");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  const { resetKiModusCache } = await import("./ai/modus");
  resetKiModusCache();
  router.resetRouter();
  ba.vergissAutoFuerTests();
  const gefragt: AIRequest[] = [];
  /** the KI: answers (after `ms`), fails, or is off */
  const ki = (art: "antwortet" | "fehler" | "aus", ms = 0) => {
    router.resetRouter();
    if (art === "aus") return router.setTransport(null);
    router.setTransport(async (req) => {
      gefragt.push(req);
      if (ms) await new Promise((r) => setTimeout(r, ms));
      if (art === "fehler") throw new Error("Anbieter nicht erreichbar");
      return { parsed: KI_ANTWORT, refusal: false, model: req.model, usage: { input: 2_500, output: 1_500, cacheWrite: 0, cacheRead: 0 } };
    });
  };
  ki("aus");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string, o: Partial<Parameters<typeof repo.createStudent>[0]> = {}) =>
    repo.createStudent({
      name, grade: 4, klasse: 4, teacher_id: teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ...o,
    });
  const neuesPaket = (o: { skills?: string[]; titel?: string; geprueft?: boolean; fach?: string } = {}) => {
    const d = beispiel();
    d.titel = o.titel ?? `Die vier Fälle ${++nr}`;
    if (o.skills) d.faehigkeiten = o.skills;
    const out = lp.importiereLernpaket(JSON.stringify(d), teacher.id);
    assert.ok("id" in out, "id" in out ? "" : out.fehler.join("\n"));
    if (o.geprueft !== false) assert.ok("ok" in lp.markiereGeprueft(out.id, teacher.id, { hinweiseGeprueft: true }));
    return lp.getLernpaket(out.id)!;
  };
  const tag = zeit.wienerDatum();
  const pruefung = (sid: number, inTagen: number, fach: string, stoff: string[], skills: string[] = []) =>
    repo.addTest({ student_id: sid, date: zeit.tagAddieren(tag, inTagen), subject: fach, kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: skills, title: "", topics: stoff, status: "geplant", teacher_id: teacher.id, material_id: null });
  /** today's published slot from 23:00 to midnight: never over while the test runs */
  const platz = (sid: number) =>
    Number(
      db()
        .prepare(
          `INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, created_at, updated_at)
           VALUES (?, ?, 1380, 60, ?, ?, NULL, 'veroeffentlicht', 0, datetime('now'), datetime('now'))`,
        )
        .run(zeit.wochenstartVon(tag), zeit.wochentagVon(tag), teacher.id, sid).lastInsertRowid,
    );
  /** wrong answers on a skill, with the same kind of error */
  const fehler = (sid: number, skill: string, n: number, typ: string | null = "regel") => {
    const ws = repo.createWorksheet(
      { title: `Übung ${skill}`, subject: "Deutsch", grade: 4, school_type: "Volksschule", klasse: 4, topic: "x", difficulty: "mittel", task_type: "free", kind: "uebung", source: "manuell", skill_ids: [skill] },
      [{ type: "free", skillId: skill, difficulty: "mittel", prompt: "Welcher Artikel passt?", data: {}, answer: { accepted: ["das"], mode: "text" }, solution: "", hints: [], errorMap: [] }],
    );
    const asg = repo.assignWorksheet(ws, sid, "");
    const taskId = repo.listTasks(ws)[0].id;
    for (let i = 1; i <= n; i++)
      db().prepare("INSERT INTO attempts (assignment_id, task_id, student_id, skill_id, attempt_no, answer, correct, final, error_type) VALUES (?, ?, ?, ?, ?, 'der', 0, 1, ?)").run(asg, taskId, sid, skill, i, typ);
    return ws;
  };
  const kosten = (sid: number | null, usd: number) =>
    db().prepare("INSERT INTO ai_calls (created_at, fn, tier, model, provider, status, cost_usd, test, student_id) VALUES (?, 'briefing', 'standard', 'claude-sonnet-5-5', 'anthropic', 'ok', ?, 0, ?)").run(new Date().toISOString(), usd, sid);
  const karte = (sid: number, o: { kiVorbereiten?: boolean } = {}) => {
    const punkte = heute.tagesplan(teacher.id).filter((p) => p.studentId === sid);
    return heute.heuteKarten(teacher.id, punkte, new Date(), o).get(sid)!;
  };
  return { db, repo, units, lp, c, auto, heute, briefing, ba, zeit, router, teacher, schueler, neuesPaket, tag, pruefung, platz, fehler, kosten, karte, ki, gefragt };
}

test("Heute und Unterricht wählen dasselbe: eine Prüfung im zweiten Fach startet die Einheit in diesem Fach", async () => {
  const s = await setup();
  const sid = s.schueler("Ilka Zweifach", { subjects: ["Mathematik", "Deutsch"] });
  s.platz(sid);
  const p = s.neuesPaket({ titel: "Die vier Fälle" });
  s.pruefung(sid, 5, "Deutsch", ["Die vier Fälle"], ["deutsch.grammatik.faelle"]);
  const k = s.karte(sid);
  assert.equal(k.thema, "Die vier Fälle");
  assert.equal(k.fach, "Deutsch");
  assert.match(k.vorbereitet!, /^Lernpaket „Die vier Fälle“/);
  assert.match(k.empfehlung!, /Schularbeit/);
  assert.equal(s.heute.fachHeute(sid, s.teacher.id), "Deutsch", "nicht das erste Fach im Profil");
  const { expectedSubject } = await import("./learning");
  const fach = expectedSubject(sid, Date.now(), s.heute.fachHeute(sid, s.teacher.id));
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: fach }).unit;
  assert.equal(s.c.cockpit(unit.id).paket?.id, p.id, "der Unterricht nimmt das Paket, das Heute zeigte");
  const a = s.auto.autoFuerEinheit(s.units.getUnit(unit.id)!)!;
  assert.equal(a.art === "paket" && a.paket.id, p.id);
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("ohne geprüftes Paket: der geführte Plan beginnt mit dem Thema von Heute, Übungen aus dem Bestand vor der Aufgabenbank", async () => {
  const s = await setup();
  const sid = s.schueler("Tamo Fehlerfrei");
  s.platz(sid);
  const ws = s.fehler(sid, "deutsch.grammatik.artikel", 3);
  s.db().prepare("UPDATE worksheets SET status = 'freigegeben' WHERE id = ?").run(ws);
  const k = s.karte(sid);
  assert.equal(k.thema, "Artikel bestimmen", JSON.stringify(k));
  assert.match(k.empfehlung!, /^Fehler: Artikel bestimmen – 3× /, "Warum: der wiederholte Fehler");
  assert.match(k.vorbereitet!, /^Plan aus den Daten: \d Schritte/);
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  const plan = s.c.planDerEinheit(unit.id);
  const ueben = plan.find((x) => x.titel.startsWith("Üben"))!;
  assert.equal(ueben.titel, "Üben: Artikel bestimmen", "derselbe Schwerpunkt im Unterricht");
  assert.match(ueben.beschreibung, /^Fehler: Artikel bestimmen/);
  const d = s.briefing.briefingDaten(sid, { fokus: s.heute.fokusHeute(sid, s.teacher.id) })!;
  const b = s.briefing.einfachesBriefing(d);
  assert.equal(b.plan.find((x) => x.titel === "Üben: Artikel bestimmen")?.uebung, `Z${s.repo.listAssignments(sid)[0].id}`, "die offene Übung aus dem Bestand, nicht die Aufgabenbank");
  s.units.finishUnit(unit.id, "abgebrochen");
});

test("Schulstoff, offene Ziele und gemeldete Probleme kommen als Signal, in der richtigen Reihenfolge", async () => {
  const s = await setup();
  const n = await import("./schueler-notiz");
  const sid = s.schueler("Rena Ziele", { current_topics: "Die vier Fälle" });
  s.repo.saveLesson({ student_id: sid, teacher_id: s.teacher.id, starts_at: `${s.zeit.tagAddieren(s.tag, -3)}T15:00`, duration_min: 50, subject: "Deutsch", topic: "Wortarten", status: "abgeschlossen", activities: "", mistakes: "", understanding: 3, tutor_notes: "", next_steps: "Die vier Fälle weiter üben", skill_ids: [] });
  assert.ok("ok" in n.speichereWunsch(sid, "Ich verstehe die vier Fälle nicht."));
  const b = s.auto.schuelerBasis(s.repo.getStudent(sid)!, new Date());
  const signale = s.auto.signaleFuer(b, { datum: s.tag, fach: "", wuensche: s.auto.wuenscheFuer(sid, null) });
  const arten = s.auto.ordneSignale({ fach: "", student: { school_type: "Volksschule", grade: 4, subjects: ["Deutsch"] }, signale }).map((x) => x.art);
  assert.deepEqual([...new Set(arten)], ["schulstoff", "wunsch", "ziel", "letzte_einheit"], arten.join(","));
  const ziel = signale.find((x) => x.art === "ziel")!;
  assert.match(ziel.warum, /^Nächstes Mal \(Einheit am .*\): Die vier Fälle weiter üben/);
  assert.match(signale.find((x) => x.art === "schulstoff")!.warum, /^Schulstoff laut Profil: Die vier Fälle/);
});

test("Briefing je Datenstand: am nächsten Tag mit denselben Daten wiederverwendet, nach neuen Daten veraltet; alte Zeilen bleiben lesbar", async () => {
  const s = await setup();
  const sid = s.schueler("Lena Morgen");
  s.platz(sid);
  s.fehler(sid, "deutsch.grammatik.artikel", 2);
  s.ki("antwortet");
  const heute = new Date();
  const res = await s.briefing.erstelleBriefing(sid, s.teacher.id, { now: heute });
  assert.ok(res.ok && res.neu, JSON.stringify(res));
  assert.equal(s.gefragt.length, 1);
  const stand = res.briefing.stand;
  const gespeichert = s.db().prepare("SELECT daten FROM briefings WHERE id = ?").get(res.briefing.id) as { daten: string };
  assert.ok(JSON.parse(gespeichert.daten).einfach.plan.length > 0, "die Fassung aus den Daten ist mitgespeichert");

  // the next day, nothing changed: the same briefing, no request
  const morgen = new Date(heute.getTime() + 86_400_000);
  const wieder = await s.briefing.erstelleBriefing(sid, s.teacher.id, { now: morgen, fokus: s.heute.fokusHeute(sid, null, morgen) });
  assert.ok(wieder.ok && !wieder.neu, "gilt weiter");
  assert.equal(wieder.ok && wieder.briefing.id, res.briefing.id);
  assert.equal(s.gefragt.length, 1, "kostet nichts");
  assert.equal(s.briefing.fuerHeute(res.briefing, { minuten: 100, schularbeit: null }).plan.reduce((a, p) => a + p.minuten, 0), 100, "an einem Tag mit anderer Dauer: die Minuten passen");

  // new answers: the data state changes, the stored one is stale, a new one is made
  s.fehler(sid, "deutsch.grammatik.artikel", 1);
  const d = s.briefing.briefingDaten(sid, { fokus: s.heute.fokusHeute(sid, s.teacher.id) })!;
  assert.notEqual(d.stand, stand);
  assert.equal(s.briefing.gespeichertesBriefing(sid, { stand: d.stand }), null, "zum neuen Stand gibt es keins");
  assert.equal(s.briefing.gespeichertesBriefing(sid)?.id, res.briefing.id, "das alte bleibt lesbar (als veraltet)");
  const neu = await s.briefing.erstelleBriefing(sid, s.teacher.id);
  assert.ok(neu.ok && neu.neu);
  assert.equal(s.gefragt.length, 2);

  // a row from before this change (no data version, another way of computing the state): readable, and stale
  s.db().prepare("DELETE FROM briefings").run();
  s.db()
    .prepare("INSERT INTO briefings (student_id, teacher_id, datum, platz_id, minuten, stand, inhalt, verworfen, call_id, created_at) VALUES (?, ?, ?, NULL, 50, 'alterstand', ?, 0, NULL, ?)")
    .run(sid, s.teacher.id, s.zeit.tagAddieren(s.tag, -2), JSON.stringify({ inhalt: { ...s.briefing.einfachesBriefing(d), hinweis: "alt" } }), new Date(Date.now() - 2 * 86_400_000).toISOString());
  const alt = s.briefing.gespeichertesBriefing(sid)!;
  assert.equal(alt.inhalt.hinweis, "alt");
  assert.notEqual(alt.stand, d.stand, "veraltet");
  s.ki("aus");
});

test("KI im Hintergrund: Heute wartet nie; danach steht das KI-Briefing auf der Karte, ein zweites Öffnen fragt nicht", async () => {
  const s = await setup();
  const sid = s.schueler("Mara Hintergrund");
  s.platz(sid);
  s.fehler(sid, "deutsch.grammatik.artikel", 3);
  s.ki("antwortet", 100);
  const vorher = s.karte(sid, { kiVorbereiten: true });
  assert.equal(vorher.mitKi, false, "bis dahin die Fassung aus den Daten");
  assert.equal(s.gefragt.length, 0, "beim Rechnen der Seite ist noch nichts gefragt");
  await s.ba.warteteAufAuto();
  assert.equal(s.gefragt.length, 1);
  const req = s.gefragt[0];
  assert.match(String(req.content), /Schwerpunkt der App \(Wiederholte Fehler\): Artikel bestimmen/);
  const nachher = s.karte(sid, { kiVorbereiten: true });
  assert.equal(nachher.mitKi, true);
  assert.deepEqual(nachher.schwierigkeiten, ["Artikel bei Nomen auf -ung werden verwechselt."]);
  await s.ba.warteteAufAuto();
  assert.equal(s.gefragt.length, 1, "zum selben Datenstand nur einmal");
  assert.equal(nachher.thema, vorher.thema, "die KI ändert das Thema nicht");
  s.ki("aus");
});

test("KI im Hintergrund nur, wenn alles erlaubt ist: Schalter, KI aus, manueller Modus, Budget, Grenze des Schülers; ein Fehler lässt die Daten stehen", async () => {
  const s = await setup();
  const sid = s.schueler("Nils Grenze");
  s.platz(sid);
  s.fehler(sid, "deutsch.grammatik.artikel", 3);
  const auftrag = () => {
    const fokus = s.heute.fokusHeute(sid, s.teacher.id);
    const d = s.briefing.briefingDaten(sid, { fokus })!;
    return { studentId: sid, teacherId: s.teacher.id, platzId: null, fokus, stand: d.stand };
  };
  const ohneKi = async (erwartet: string, was: string) => {
    assert.equal(s.ba.bereiteBriefingVor(auftrag()), erwartet, was);
    const k = s.karte(sid, { kiVorbereiten: true });
    await s.ba.warteteAufAuto();
    assert.equal(s.gefragt.length, 0, `${was}: keine Anfrage`);
    assert.equal(k.mitKi, false);
    assert.ok(k.thema && k.vorbereitet, `${was}: die Karte steht aus den Daten`);
  };

  // KI off (no key)
  await ohneKi("ki_aus", "KI aus");
  s.ki("antwortet");
  // switched off under Erweitert › KI-Kosten
  s.ba.setzeAutoBriefing(false);
  await ohneKi("aus", "Schalter aus");
  s.ba.setzeAutoBriefing(true);
  // the manual mode: someone would have to copy the prompt
  process.env.AI_PROVIDER = "manual";
  await ohneKi("manuell", "manueller Modus");
  delete process.env.AI_PROVIDER;
  // the month's budget over the warning mark (here: 1 $ budget, 0,90 $ spent)
  process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "1";
  s.kosten(null, 0.9);
  await ohneKi("budget", "Budget");
  delete process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
  // the student's limit: from 1 € in this month only on a click
  s.kosten(sid, 1.2);
  await ohneKi("schuelergrenze", "Grenze des Schülers");
  s.db().prepare("DELETE FROM ai_calls").run();

  // the KI fails: the data version stays, the error is not retried at once
  s.ki("fehler");
  assert.equal(s.ba.bereiteBriefingVor(auftrag()), "gestartet");
  await s.ba.warteteAufAuto();
  assert.ok(s.gefragt.length >= 1, "gefragt, aber ohne Erfolg");
  const k = s.karte(sid, { kiVorbereiten: true });
  assert.equal(k.mitKi, false);
  assert.ok(k.thema);
  assert.equal(s.briefing.gespeichertesBriefing(sid), null, "nichts gespeichert");
  assert.equal(s.ba.bereiteBriefingVor(auftrag()), "pausiert", "nicht gleich noch einmal");
  // a unit started without the KI: the guided steps come from the data
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  assert.ok(s.c.planDerEinheit(unit.id).length >= 3, "der geführte Unterricht hat seine Schritte");
  s.units.finishUnit(unit.id, "abgebrochen");
  s.ki("aus");
});

test("Kosten je Briefing: geschätzt aus Größe und Preis, gemessen ab drei Aufrufen, ohne die KI zu fragen", async () => {
  const s = await setup();
  const k = s.ba.autoKosten();
  assert.equal(k.quelle, "geschaetzt");
  assert.ok(k.cent > 2 && k.cent < 3, `Sonnet 5.5: unter 3 Cent (${k.cent.toFixed(2)})`);
  assert.ok(Math.abs(k.monatEuro - (k.cent * s.ba.BRIEFINGS_IM_MONAT) / 100) < 1e-9);
  for (let i = 0; i < 3; i++) s.kosten(null, 0.0224);
  const m = s.ba.autoKosten();
  assert.equal(m.quelle, "gemessen");
  assert.ok(Math.abs(m.cent - 2) < 1e-9, "0,0224 $ = 2 Cent");
  assert.equal(s.gefragt.length, 0);
  assert.equal(s.ba.AUTO_STANDARD, true, "Standard an: unter 3 Cent je Briefing");
});
