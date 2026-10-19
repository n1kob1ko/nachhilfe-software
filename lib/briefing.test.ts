/**
 * Tagesbriefing (niko, 18.10.2026): die einfache Version aus den Daten, die KI-Fassung ohne Namen, nur
 * Übungen aus dem Bestand, Minuten passend zur geplanten Dauer, gespeichert pro Schüler und Tag (ein
 * Doppelklick kostet nichts), der Lernstand bleibt unverändert, und ohne KI bleibt die einfache Version.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde.
 * Alle Namen und Texte sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD"])
  delete process.env[k];

const NOTIZ =
  "Mutter Gerlinde hat erzählt, dass Lena mit Bruder Ilvo übt. Klassenlehrerin Novak ist zufrieden, Frau Berger (Nachbarin) hilft. Lena Hofer kürzt schon sicherer.";

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const planung = await import("./planung/repo");
  const zeit = await import("./planung/zeit");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const now = new Date();
  const heute = zeit.wienerDatum(now);
  const tag = (n: number) => zeit.tagAddieren(heute, n);
  const student = (name: string, extra: Partial<Parameters<typeof repo.createStudent>[0]> = {}) =>
    repo.createStudent({
      name,
      grade: 6,
      klasse: 2,
      teacher_id: niko.id,
      school: "",
      school_type: "Mittelschule",
      subjects: ["Mathematik"],
      current_topics: "PRIVAT-THEMA",
      strengths_note: "PRIVAT-STAERKE",
      weaknesses_note: "PRIVAT-SCHWAECHE",
      goals: "Lena will bei der Schularbeit eine 2 schaffen.",
      notes: "PRIVAT-NOTIZ Telefon 0664 1234567",
      ...extra,
    });
  const sid = student("Lena Hofer", { ki_hinweise: "Lena braucht kurze Sätze." });
  student("Max Muster", { goals: "" });
  const kuerzen = repo.createSkill("Mathematik", "Bruchrechnung", "Brüche kürzen", 5, 7);
  const erweitern = repo.createSkill("Mathematik", "Bruchrechnung", "Brüche erweitern", 5, 7);
  const lesen = repo.createSkill("Deutsch", "Lesen", "Sinnerfassendes Lesen", 5, 7);
  const doku = (tageZurueck: number, topic: string, skill: string, understanding: number, extra: Partial<Parameters<typeof repo.saveLesson>[0]> = {}) =>
    repo.saveLesson({
      student_id: sid,
      teacher_id: niko.id,
      starts_at: `${tag(-tageZurueck)}T15:00`,
      duration_min: 60,
      subject: "Mathematik",
      topic,
      status: "abgeschlossen",
      activities: "Kürzen mit Primfaktoren",
      mistakes: "Teiler übersehen",
      understanding,
      tutor_notes: "",
      next_steps: "Kürzen wiederholen",
      skill_ids: [skill],
      ...extra,
    });
  doku(14, "Brüche erweitern", erweitern, 4);
  doku(7, "Brüche kürzen", kuerzen, 2, { tutor_notes: NOTIZ, difficulties: "Große Zahlen", positives: "Erweitern sitzt" });
  repo.addTest({
    student_id: sid,
    date: tag(10),
    subject: "Mathematik",
    kind: "Schularbeit",
    topic: "Brüche",
    grade: null,
    points: null,
    max_points: null,
    notes: "PRIVAT-TEST-NOTIZ",
    skill_ids: [kuerzen],
    title: "2. Mathematik-Schularbeit",
    topics: ["Brüche"],
    status: "geplant",
  });
  const aufgabe = (skill: string) => ({ type: "calc" as const, skillId: skill, difficulty: "mittel" as const, prompt: "6/8 kürzen", data: {}, answer: { accepted: ["3/4"], mode: "value" as const }, solution: "", hints: [], errorMap: [] });
  const blatt = (title: string, skill: string, extra: Partial<Parameters<typeof repo.createWorksheet>[0]> = {}) =>
    repo.createWorksheet({ title, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Bruchrechnung", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [skill], ...extra }, [aufgabe(skill)]);
  const kuerzenBlatt = blatt("Kürzen für Lena", kuerzen, { student_id: sid });
  const entwurf = blatt("Kürzen Entwurf", kuerzen, { status: "entwurf" });
  const deutsch = blatt("Lesen", lesen, { subject: "Deutsch" });
  const vorlage = repo.createTemplate({ name: "Kürzen kompakt", subject: "Mathematik", settings: JSON.stringify({ skillIds: [kuerzen] }), source_worksheet_id: null, teacher_id: niko.id });
  // a published place today: 90 minutes
  const raum = planung.createRaum({ building: "Hauptgebäude", name: "Gruppe 1", mode: "vor_ort" });
  const platz = planung.legePlatzAn({ week_start: zeit.wochenstartVon(heute), weekday: zeit.wochentagVon(heute), start_min: 1200, geplante_dauer: 90, teacher_id: niko.id, student_id: sid, room_id: raum });
  assert.ok(platz.ok);
  assert.equal(planung.veroeffentlicheWoche(zeit.wochenstartVon(heute)).ok, true);
  return { db, repo, niko, sid, kuerzen, erweitern, kuerzenBlatt, entwurf, deutsch, vorlage, heute, platzId: platz.ok ? platz.id : 0 };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `antwort` (nach `ms` Millisekunden). */
async function mitKi(antwort: (req: AIRequest) => unknown, ms = 0) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    if (ms) await new Promise((r) => setTimeout(r, ms));
    return { parsed: antwort(req), refusal: false, model: req.model, usage: { input: 3_000, output: 900, cacheWrite: 0, cacheRead: 0, reasoning: 300 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

const KI_ANTWORT = (ids: string[]) => ({
  letzter_stand: ["Zuletzt Kürzen, Verständnis 2/5.", "[Name] übt zu Hause mit."],
  wo_es_hakt: ["Teiler werden übersehen."],
  plan: [
    { minuten: 10, titel: "Einstieg", beschreibung: "Erweitern wiederholen.", uebung_id: null },
    { minuten: 45, titel: "Kürzen üben", beschreibung: "Mit Primfaktoren.", uebung_id: ids[0] ?? null },
    { minuten: 25, titel: "Schularbeit", beschreibung: "Gemischte Aufgaben.", uebung_id: "U9999" },
    { minuten: 10, titel: "Abschluss", beschreibung: "Hausübung festlegen.", uebung_id: null },
  ],
  uebungen: [
    { id: ids[0] ?? "x", warum: "Genau das Kürzen." },
    { id: "erfunden-1", warum: "gibt es nicht" },
  ],
  hinweis: "Schularbeit in 10 Tagen.",
});

test("einfache Version: letzter Stand, wo es hakt, Schularbeit, Plan auf die geplante Dauer, Übungen aus dem Bestand", async () => {
  const s = await setup();
  const { briefingDaten, einfachesBriefing } = await import("./briefing");
  const d = briefingDaten(s.sid)!;
  assert.equal(d.minuten, 90, "die geplante Dauer des Platzes");
  assert.equal(d.platzId, s.platzId);
  assert.equal(d.zeit, "20:00–21:30");
  const b = einfachesBriefing(d);
  assert.match(b.letzterStand[0], /Mathematik: Brüche kürzen · Verständnis 2\/5/);
  assert.ok(b.letzterStand.some((x) => x.startsWith("Nächstes Mal: Kürzen wiederholen")));
  assert.ok(b.woEsHakt.some((x) => x.startsWith("Brüche kürzen")), b.woEsHakt.join(" | "));
  assert.match(b.schularbeit!, /2\. Mathematik-Schularbeit am .* \(in 10 Tagen\), Stoff: Brüche/);
  assert.equal(b.plan.reduce((a, p) => a + p.minuten, 0), 90, "die Minuten ergeben die geplante Dauer");
  assert.ok(b.plan.some((p) => p.titel === "Schularbeit vorbereiten" && p.uebung === `U${s.kuerzenBlatt}`), "die Vorbereitung bekommt die passende Übung");
  const ids = d.kandidaten.map((k) => k.id);
  assert.ok(ids.includes(`U${s.kuerzenBlatt}`));
  assert.ok(ids.includes(`V${s.vorlage}`), "die Vorlage zum Kürzen");
  assert.ok(!ids.includes(`U${s.entwurf}`), "kein Entwurf");
  assert.ok(!ids.includes(`U${s.deutsch}`), "kein anderes Fach");
  assert.ok(b.uebungen.every((u) => ids.includes(u.id)));
});

test("einfache Version ohne Daten: kein Fehler, Plan auf die Vorgabe von 100 Minuten", async () => {
  const s = await setup();
  const { briefingDaten, einfachesBriefing } = await import("./briefing");
  const leer = s.repo.listStudents().find((x) => x.name === "Max Muster")!;
  const d = briefingDaten(leer.id)!;
  assert.equal(d.minuten, 100);
  const b = einfachesBriefing(d);
  assert.deepEqual(b.letzterStand, ["Noch keine Dokumentation einer Einheit."]);
  assert.equal(b.schularbeit, null);
  assert.equal(b.plan.reduce((a, p) => a + p.minuten, 0), 100);
});

test("an die KI: keine Namen (Schüler, Lehrer, Eltern, Geschwister, andere Schüler), keine Profil-Notizen; Ziele, Schulstufe, Fach, Schularbeit schon", async () => {
  const s = await setup();
  const ki = await mitKi(() => KI_ANTWORT([]));
  try {
    const { erstelleBriefing } = await import("./briefing");
    const res = await erstelleBriefing(s.sid, s.niko.id);
    assert.ok(res.ok, JSON.stringify(res));
    assert.equal(ki.gefragt.length, 1);
    const req = ki.gefragt[0];
    assert.equal(req.fn, "briefing");
    const alles = `${req.system}\n${String(req.content)}`;
    for (const name of ["Lena", "Hofer", "Gerlinde", "Ilvo", "Novak", "Berger", "Max", "Muster", "Niko"]) assert.ok(!new RegExp(`\\b${name}\\b`, "i").test(alles), `${name} geht nicht mit`);
    assert.ok(alles.includes("Mutter [Name] hat erzählt"), "der Name nach „Mutter“ ist ersetzt");
    assert.ok(alles.includes("Bruder [Name]"));
    for (const privat of ["PRIVAT-NOTIZ", "PRIVAT-STAERKE", "PRIVAT-SCHWAECHE", "PRIVAT-THEMA", "PRIVAT-TEST-NOTIZ", "0664"]) assert.ok(!alles.includes(privat), `${privat} bleibt draußen`);
    assert.ok(alles.includes("Ziele: [Name] will bei der Schularbeit eine 2 schaffen."), "Ziele gehen mit");
    assert.ok(alles.includes("Schulstufe 6"));
    assert.ok(alles.includes("Fächer: Mathematik"));
    assert.match(alles, /Nächste Schularbeit: 2\. Mathematik-Schularbeit am .* \(in 10 Tagen\)/);
    assert.ok(alles.includes("geplante Dauer 90 Minuten"));
    assert.ok(alles.includes("Beobachtungen: Mutter [Name]"), "Beobachtungen der Dokumentation gehen mit");
    assert.ok(req.system.includes("[Name] braucht kurze Sätze."), "die KI-Hinweise hängen am Systemprompt, ohne Namen");
    assert.ok(alles.includes(`U${s.kuerzenBlatt}: Übung „Kürzen für [Name]“`), "Titel aus dem Bestand ohne Namen");
  } finally {
    ki.aus();
  }
});

test("KI-Antwort: nur Übungen aus dem Bestand, Minuten passend zur geplanten Dauer", async () => {
  const s = await setup();
  const { briefingDaten } = await import("./briefing");
  const { pruefeKiBriefing } = await import("./ai/briefing");
  const d = briefingDaten(s.sid)!;
  const ok = pruefeKiBriefing(KI_ANTWORT([`U${s.kuerzenBlatt}`]), d);
  assert.ok(!("fehler" in ok));
  assert.equal(ok.verworfen, 2, "U9999 im Plan und eine erfundene Übung");
  assert.deepEqual(ok.inhalt.plan.map((p) => p.uebung), [null, `U${s.kuerzenBlatt}`, null, null]);
  assert.deepEqual(ok.inhalt.plan.map((p) => p.minuten), [10, 45, 25, 10], "passt die Summe, bleiben die Minuten der KI");
  assert.deepEqual(ok.inhalt.uebungen.map((u) => u.id), [`U${s.kuerzenBlatt}`]);
  assert.match(ok.inhalt.schularbeit!, /in 10 Tagen/, "das Datum kommt aus der App");

  const falsch = KI_ANTWORT([]);
  falsch.plan = falsch.plan.map((p, i) => ({ ...p, minuten: [5, 20, 20, 5][i] }));
  const skaliert = pruefeKiBriefing(falsch, d);
  assert.ok(!("fehler" in skaliert));
  assert.equal(skaliert.inhalt.plan.reduce((a, p) => a + p.minuten, 0), 90, "50 Minuten werden auf 90 gebracht");
  assert.deepEqual(skaliert.inhalt.plan.map((p) => p.minuten), [10, 35, 35, 10]);

  const leer = pruefeKiBriefing({ ...KI_ANTWORT([]), plan: [] }, d);
  assert.ok("fehler" in leer, "ohne Plan keine brauchbare Antwort");
});

test("Minuten verteilen: die Summe stimmt immer", async () => {
  const { verteileMinuten } = await import("./briefing");
  assert.deepEqual(verteileMinuten([1, 1, 1, 1], 100), [25, 25, 25, 25]);
  assert.deepEqual(verteileMinuten([0, 0], 60), [30, 30], "ohne brauchbare Werte gleich verteilt");
  for (const [werte, gesamt] of [
    [[1, 0.5, 2.5, 2, 2, 0.5], 100],
    [[3, 7], 47],
    [[10, 10, 10], 5],
    [[-4, 9, Number.NaN, 2], 90],
  ] as [number[], number][]) {
    const m = verteileMinuten(werte, gesamt);
    assert.equal(m.reduce((a, b) => a + b, 0), gesamt, `${werte} → ${m}`);
    assert.ok(m.every((x) => x >= 0 && Number.isInteger(x)));
  }
});

test("gespeichert pro Schüler und Tag: Doppelklick fragt einmal, Wiederöffnen kostet nichts, „Neu erstellen“ fragt neu", async () => {
  const s = await setup();
  const ki = await mitKi(() => KI_ANTWORT([]), 50);
  try {
    const { erstelleBriefing, gespeichertesBriefing } = await import("./briefing");
    const [a, b] = await Promise.all([erstelleBriefing(s.sid, s.niko.id), erstelleBriefing(s.sid, s.niko.id)]);
    assert.ok(a.ok && b.ok);
    assert.equal(ki.gefragt.length, 1, "ein Doppelklick ist eine Anfrage");
    assert.equal(a.briefing.id, b.briefing.id);
    const wieder = await erstelleBriefing(s.sid, s.niko.id);
    assert.ok(wieder.ok && !wieder.neu, "das gespeicherte kommt zurück");
    assert.equal(ki.gefragt.length, 1, "Wiederöffnen fragt nicht");
    const g = gespeichertesBriefing(s.sid, s.heute)!;
    assert.ok(g.kosten, "Kosten aus dem Protokoll");
    assert.equal(g.kosten.tokensEin, 3_000);
    assert.equal(g.kosten.tokensAus, 900);
    assert.equal(g.kosten.denken, 300);
    assert.ok(g.kosten.usd > 0);
    const neu = await erstelleBriefing(s.sid, s.niko.id, { neu: true });
    assert.ok(neu.ok && neu.neu);
    assert.equal(ki.gefragt.length, 2, "„Neu erstellen“ fragt neu");
    assert.equal((s.db().prepare("SELECT COUNT(*) AS n FROM briefings WHERE student_id = ?").get(s.sid) as { n: number }).n, 1, "eins pro Tag");
    const calls = s.db().prepare("SELECT fn, trigger, cost_usd FROM ai_calls WHERE fn = 'briefing'").all() as { fn: string; trigger: string; cost_usd: number }[];
    assert.equal(calls.length, 2);
    assert.ok(calls.every((c) => c.trigger === "briefing" && c.cost_usd > 0), "jede Anfrage mit echten Tokens und Kosten im Protokoll");
  } finally {
    ki.aus();
  }
});

test("die KI ändert nie den Lernstand", async () => {
  const s = await setup();
  const { analyzeStudent } = await import("./service");
  // one point in time: the Lernstand fades with time, the comparison must not
  const zeitpunkt = Date.now();
  const stand = () => ({
    mastery: analyzeStudent(s.sid, zeitpunkt)!.skills.map((x) => [x.skill.id, x.mastery, x.evidence]),
    zeilen: ["attempts", "skill_snapshots", "lessons", "tests", "assignments"].map((t) => (s.db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n),
    doku: s.db().prepare("SELECT * FROM lessons ORDER BY id").all(),
  });
  const vorher = stand();
  const ki = await mitKi(() => ({ ...KI_ANTWORT([]), wo_es_hakt: ["Kürzen sitzt jetzt sicher: 100 %"] }));
  try {
    const { erstelleBriefing } = await import("./briefing");
    assert.ok((await erstelleBriefing(s.sid, s.niko.id)).ok);
    assert.ok((await erstelleBriefing(s.sid, s.niko.id, { neu: true })).ok);
  } finally {
    ki.aus();
  }
  assert.deepEqual(stand(), vorher, "Lernstand, Versuche, Dokumentationen und Schularbeiten unverändert");
});

test("ohne KI: eine Meldung, nichts gespeichert, die einfache Version bleibt", async () => {
  const s = await setup();
  const { erstelleBriefing, gespeichertesBriefing, briefingDaten, einfachesBriefing } = await import("./briefing");
  const res = await erstelleBriefing(s.sid, s.niko.id);
  assert.ok(!res.ok);
  assert.match(res.error, /KI ist ausgeschaltet|kein Schlüssel/);
  assert.equal(gespeichertesBriefing(s.sid, s.heute), null);
  assert.ok(einfachesBriefing(briefingDaten(s.sid)!).plan.length > 0);
});

test("ein neuer Eintrag nach dem Briefing ändert den Datenstand", async () => {
  const s = await setup();
  const { datenStand } = await import("./briefing");
  const vorher = datenStand(s.sid);
  assert.equal(datenStand(s.sid), vorher, "ohne Änderung gleich");
  s.repo.saveLesson({ student_id: s.sid, teacher_id: s.niko.id, starts_at: `${s.heute}T10:00`, duration_min: 60, subject: "Mathematik", topic: "Neu", status: "abgeschlossen", activities: "", mistakes: "", understanding: 3, tutor_notes: "", next_steps: "", skill_ids: [] });
  assert.notEqual(datenStand(s.sid), vorher);
});

test("Namen nach Familien- und Schulrollen", async () => {
  const { namesAfterRelation } = await import("./name-detection");
  assert.deepEqual(namesAfterRelation(["Mutter Gerlinde ruft an. Vater (Ahmet) holt ab. Schwester: Ilvy übt mit. Klassenlehrerin Novak ist zufrieden."]), ["Gerlinde", "Ahmet", "Ilvy", "Novak"]);
  assert.deepEqual(namesAfterRelation(["Die Mutter Hilfe anbieten. Bruder hilft. Oma Frau Huber."]), [], "Nomen, Kleingeschriebenes und Anreden sind keine Namen");
});

test("manueller KI-Modus: der Prompt zum Kopieren ohne Namen, die eingefügte Antwort wird gespeichert, kostet nichts", async () => {
  const s = await setup();
  const { pendingManual, answerManual, resetManualForTests } = await import("./ai/providers/manual");
  const { resetRouter } = await import("./ai/router");
  resetManualForTests();
  resetRouter();
  process.env.AI_PROVIDER = "manual";
  try {
    const { erstelleBriefing } = await import("./briefing");
    const laeuft = erstelleBriefing(s.sid, s.niko.id);
    let offen = pendingManual();
    for (let i = 0; i < 50 && !offen.length; i++) {
      await new Promise((r) => setTimeout(r, 10));
      offen = pendingManual();
    }
    assert.equal(offen.length, 1, "eine Anfrage wartet");
    assert.ok(!/\b(Lena|Hofer|Gerlinde|Novak)\b/.test(offen[0].prompt), "keine Namen im Prompt zum Kopieren");
    assert.deepEqual(answerManual(offen[0].id, JSON.stringify(KI_ANTWORT([`U${s.kuerzenBlatt}`]))), { ok: true });
    const res = await laeuft;
    assert.ok(res.ok && res.neu);
    assert.equal(res.briefing.kosten?.usd, 0);
    assert.deepEqual(res.briefing.inhalt.uebungen.map((u) => u.id), [`U${s.kuerzenBlatt}`]);
  } finally {
    delete process.env.AI_PROVIDER;
    resetManualForTests();
  }
});
