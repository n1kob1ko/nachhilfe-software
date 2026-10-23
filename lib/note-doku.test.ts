/**
 * Note für jede Textarbeit (2026-10-23): die KI schlägt in derselben Anfrage wie „Aufgabe erfüllt?“ die vier Kriterien und
 * eine Note vor; erst „Bewertung übernehmen“ macht daraus eine Bewertung. Dann steht sie in der Dokumentation der Einheit
 * (vorher „Bewertung offen“ und ein Punkt in „Zu erledigen“) und zählt einmal für den Lernstand der Fähigkeit des Texts.
 * Schüler, Firmen und Texte sind erfunden. No KI call leaves the test: every request goes to router.setTransport.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

type AIRequest = import("./ai/router").AIRequest;
type AIResult = import("./ai/providers/types").AIResult;

const usage = { input: 1500, output: 600, cacheWrite: 0, cacheRead: 0 };

async function withStub<T>(answer: (r: AIRequest) => unknown, run: () => Promise<T>): Promise<{ out: T; calls: AIRequest[] }> {
  const router = await import("./ai/router");
  router.resetRouter();
  const calls: AIRequest[] = [];
  router.setTransport(async (r): Promise<AIResult> => {
    calls.push(r);
    const a = answer(r);
    if (a instanceof Error) throw a;
    return { parsed: r.fn === "bewertung" ? r.schema.parse(a) : a, refusal: false, model: r.model, usage, costUsd: 0.001 };
  });
  try {
    return { out: await run(), calls };
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
}

const sprachAntwort = { findings: [], hints: [], strengths: ["Klarer Aufbau"], main_issue: "", recommendation: "", recommendation_skill_id: null };

const kid = (name: string, teacherId: number, school_type = "Mittelschule", klasse = 4) => ({
  name, grade: klasse, klasse, teacher_id: teacherId, school: "", school_type, subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

const AUFGABE = [
  "Schreib eine Bewerbung für die Schnuppertage aus der Anzeige.",
  "- Sag, wo du von der Stelle erfahren hast.",
  "- Begründe dein Interesse und nenne eine Stärke mit Beispiel.",
  "- Bitte um ein Vorstellungsgespräch.",
].join("\n");

const BRIEF = [
  "Sehr geehrte Frau Kornberger,",
  "in der Zeitung habe ich gelesen, dass die Tischlerei Holzwurm Schnupperlehrlinge sucht. Ich arbeite gern mit Holz, weil ich mit meinem Opa schon ein Vogelhaus gebaut habe. Ich bin verlässlich und komme nie zu spät.",
  "Ich freue mich auf Ihre Antwort.",
  "Mit freundlichen Grüßen",
].join("\n");

const kriterien = (s: [number, number, number, number]) =>
  (["inhalt", "textstruktur", "stil", "sprachrichtigkeit"] as const).map((k, i) => ({ kriterium: k, stufe: s[i], begruendung: "Passt im Wesentlichen.", belege: [] }));
const auftraege = (st: string[]) => st.map((status, i) => ({ nr: i + 1, status, begruendung: "Steht im Text.", belege: [] }));

/** Eine Bewerbung, geschrieben in einer Einheit, abgegeben; die Einheit läuft noch. */
async function inEinheit(name: string) {
  const repo = await import("./repo");
  const units = await import("./units");
  const texts = await import("./texts");
  const sb = await import("./schreibauftrag-bewertung");
  const learning = await import("./learning");
  const { docFromText } = await import("./text-doc");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  const { unit } = units.startUnit(niko.id, sid, { at: Date.now() - 50 * 60_000 });
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: unit.id, subject: "Deutsch", topic: "Bewerbungsschreiben", title: "Bewerbung Tischlerei", prompt: AUFGABE });
  assert.ok(texts.saveText(text.id, docFromText(BRIEF), 0).ok);
  texts.setTextStatus(text.id, "fertig");
  return { repo, units, texts, sb, learning, niko, sid, unitId: unit.id, textId: text.id };
}

const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
const lernstand = async (sid: number, skill: string) => (await import("./service")).analyzeStudent(sid)!.skills.find((s) => s.skill.id === skill)?.mastery ?? null;

test("Fähigkeit des Texts: die Textsorte bei der Schulstufe des Schülers, sonst keine", async () => {
  const { skillFuerText } = await import("./text-note");
  const { listSkills } = await import("./repo");
  const skills = listSkills();
  const id = (o: Parameters<typeof skillFuerText>[0]) => skillFuerText(o, skills)?.id ?? null;
  assert.equal(id({ fach: "Deutsch", textsorte: "Bewerbungsschreiben", schulstufe: 8 }), "deutsch.schreiben.bewerbung", "die Bewerbung der 4. Klasse");
  assert.equal(id({ fach: "Deutsch", textsorte: "Bewerbungsschreiben", schulstufe: 11 }), "deutsch.os.bewerbung.schreiben");
  assert.equal(id({ fach: "Deutsch", textsorte: "Lebenslauf", schulstufe: 8 }), "deutsch.schreiben.lebenslauf");
  assert.equal(id({ fach: "Deutsch", textsorte: "Erlebniserzählung", schulstufe: 6 }), "deutsch.schreiben.erzaehlung");
  assert.equal(id({ fach: "Deutsch", textsorte: "Erlebniserzählung", schulstufe: 8 }), null, "keine Erzählung im Lehrplan der 8. Schulstufe: zählt nicht");
  assert.equal(id({ fach: "Deutsch", textsorte: "Beschreibung", schulstufe: 6 }), null, "zu ungenau: lieber keine als eine falsche");
  assert.equal(id({ fach: "Englisch", textsorte: "Letter", schulstufe: 6 }), "englisch.writing.email");
  assert.equal(id({ fach: "Mathematik", textsorte: "Bericht", schulstufe: 7 }), null);
  assert.equal(id({ fach: "Deutsch", textsorte: "", schulstufe: 11, sorteSkill: "deutsch.os.matura.leserbrief" }), "deutsch.os.matura.leserbrief", "Schreibauftrag: die Textsorte des Auftrags");
});

test("Vorschlag der Note für eine normale Textarbeit: Kriterien der Schulstufe, Gesamtnote, Sprache nach der Korrektur, wenn sie schon fertig ist", async () => {
  const s = await inEinheit("Nelia Vorschlag");
  // die Sprache zuerst: dann bekommt die KI ihre Fehlerzahl
  const sprache = await withStub(() => sprachAntwort, async () => (await import("./text-correction")).startAICorrection(s.textId, s.niko.id, { consent: true, wait: true }));
  assert.equal(sprache.out.ok, true);
  const vorher = await lernstand(s.sid, "deutsch.schreiben.bewerbung");
  const { calls } = await withStub(
    () => ({ auftraege: auftraege(["erfuellt", "teilweise", "fehlt"]), kriterien: kriterien([3, 2, 3, 4]), note: 1 }),
    async () => s.sb.startAufgabenPruefung(s.textId, s.niko.id, { consent: true, wait: true }),
  );
  assert.equal(calls.length, 1, "eine Anfrage für Aufträge und Note");
  const anfrage = `${calls[0].system}\n${calls[0].content}`;
  assert.ok(anfrage.includes("- inhalt (Inhalt): Arbeitsaufträge erfüllt"));
  assert.ok(anfrage.includes("- sprachrichtigkeit (Sprachrichtigkeit): "));
  assert.ok(anfrage.includes("nicht an der Matura"));
  assert.match(String(calls[0].content), /Korrektur der Sprache \(schon gemacht\): 0 Fehler in \d+ Wörtern/);

  const v = s.sb.bewertungInfo(s.textId).vorschlag!;
  assert.deepEqual(v.kriterien.map((k) => [k.key, k.stufe]), [["inhalt", 3], ["textstruktur", 2], ["stil", 3], ["sprachrichtigkeit", 4]]);
  assert.equal(v.note, 2, "eine Note außerhalb der Stufen wird auf die beste Stufe gesetzt");
  assert.equal(v.ohneInhalt, false);
  assert.equal(s.sb.bewertungInfo(s.textId).bestaetigt, null, "ein Vorschlag ist keine Bewertung");
  assert.equal(await lernstand(s.sid, "deutsch.schreiben.bewerbung"), vorher, "ein Vorschlag ändert den Lernstand nicht");

  // ohne fertige Korrektur der Sprache: die KI beurteilt selbst
  const t = await inEinheit("Oskar Gleichzeitig");
  const ohne = await withStub(() => ({ auftraege: auftraege(["erfuellt", "erfuellt", "erfuellt"]), kriterien: kriterien([2, 2, 2, 3]), note: 2 }), async () => t.sb.startAufgabenPruefung(t.textId, t.niko.id, { consent: true, wait: true }));
  assert.ok(String(ohne.calls[0].content).includes("Korrektur der Sprache: liegt noch nicht vor."));
  assert.equal(t.sb.bewertungInfo(t.textId).vorschlag!.note, 2);
});

test("Fehlt eine Angabe und ist ein Auftrag deshalb nicht zu beurteilen: kein Vorschlag für Inhalt und keine Note", async () => {
  const s = await inEinheit("Pia Ohneangabe");
  await withStub(() => ({ auftraege: auftraege(["erfuellt", "nicht_beurteilbar", "erfuellt"]), kriterien: kriterien([2, 2, 3, 3]), note: 2 }), async () => s.sb.startAufgabenPruefung(s.textId, s.niko.id, { consent: true, wait: true }));
  const v = s.sb.bewertungInfo(s.textId).vorschlag!;
  assert.equal(v.ohneInhalt, true);
  assert.deepEqual(v.kriterien.map((k) => k.key), ["textstruktur", "stil", "sprachrichtigkeit"]);
  assert.equal(v.note, null);
});

test("Dokumentation: „Bewertung offen“ und ein Punkt in „Zu erledigen“, bis die Lehrkraft übernimmt; dann die Zahlen, ohne Notizen der Lehrkraft zu ändern; Lernstand einmal", async () => {
  const s = await inEinheit("Ramon Doku");
  const ze = await import("./zu-erledigen");
  // ein Klick: Sprache und Aufgabe mit Note, noch während der Einheit
  await withStub(
    (r) => (r.fn === "bewertung" ? { auftraege: auftraege(["erfuellt", "teilweise", "erfuellt"]), kriterien: kriterien([3, 2, 3, 4]), note: 3 } : sprachAntwort),
    async () => s.sb.korrigierenStarten(s.textId, s.niko.id, { consent: true, aufgabe: true, wait: true }),
  );
  assert.ok(s.sb.bewertungInfo(s.textId).vorschlag, "der Vorschlag ist da");
  const vorher = await lernstand(s.sid, "deutsch.schreiben.bewerbung");

  const lessonId = s.learning.endUnit(s.unitId, { byTeacherId: s.niko.id })!;
  let lesson = s.repo.getLesson(lessonId)!;
  let r = s.learning.readReport(lesson)!;
  assert.deepEqual(r.texts![0].bewertung, { stand: "offen" });
  assert.match(lesson.summary, /Bewerbung Tischlerei“ \(Bewerbungsschreiben, \d+ Wörter\): Bewertung offen/);
  assert.match(lesson.activities, /Bewertung offen/);
  assert.ok(!/Note \d/.test(lesson.summary + lesson.activities), "keine Zahlen der KI als Tatsache");
  const offen = ze.zuErledigen(s.niko.id, heute()).offen.find((p) => p.key === `b${s.textId}`);
  assert.ok(offen && offen.art === "bewertung" && offen.zustand === "wartet", "Zu erledigen: Bewertung bestätigen");
  assert.equal(offen.href, `/texte/${s.textId}/korrektur?teil=aufgabe`);
  assert.equal(await lernstand(s.sid, "deutsch.schreiben.bewerbung"), vorher, "unbestätigt: kein Lernstand");

  // die Lehrkraft schreibt eine eigene Notiz, dann übernimmt sie die Bewertung (mit einer Änderung)
  s.repo.saveLesson({ ...lesson, tutor_notes: "Hat sich viel Mühe gegeben." }, lesson.id);
  const { cleanBewertung } = await import("./bewertung-kriterien");
  const p = s.sb.pruefungInfo(s.textId);
  const form: Record<string, string> = { s_inhalt: "3", s_textstruktur: "2", s_stil: "3", s_sprachrichtigkeit: "4", note: "3", a_1: "erfuellt", a_2: "fehlt", a_3: "erfuellt" };
  const c = cleanBewertung((n) => form[n], { auftraege: p.auftraege! });
  assert.ok("bewertung" in c);
  assert.ok(s.sb.bestaetigeBewertung(s.textId, c.bewertung, s.niko.id));

  lesson = s.repo.getLesson(lessonId)!;
  r = s.learning.readReport(lesson)!;
  assert.deepEqual(r.texts![0].bewertung, { stand: "bestaetigt", note: 3, stufen: { inhalt: 3, textstruktur: 2, stil: 3, sprachrichtigkeit: 4 }, erfuellt: 2, von: 3 });
  const zeile = "2 von 3 Arbeitsaufträgen erfüllt, Note 3 (Inhalt 3, Aufbau 2, Ausdruck 3, Sprache 4)";
  assert.ok(lesson.summary.includes(zeile), lesson.summary);
  assert.ok(lesson.activities.includes(zeile), "„Was wurde gemacht“ war automatisch: neu geschrieben");
  assert.ok(!lesson.summary.includes("Bewertung offen"));
  assert.equal(lesson.tutor_notes, "Hat sich viel Mühe gegeben.", "die Notiz der Lehrkraft bleibt");
  const { unitBrief } = await import("./summary");
  assert.ok(unitBrief(lessonId)!.done.some((l) => l.text.includes(zeile)), "„Auf einen Blick“ zeigt die Note");
  assert.equal(ze.zuErledigen(s.niko.id, heute()).offen.find((x) => x.key === `b${s.textId}`), undefined, "erledigt");

  // Lernstand: einmal, mit Note 3 wie eine Schularbeit
  const { gradeScore } = await import("./analysis");
  const { masteryAt } = await import("./mastery");
  const nach3 = (await lernstand(s.sid, "deutsch.schreiben.bewerbung"))!;
  const erwartet = (note: number) => masteryAt([{ skillId: "x", score: gradeScore(note)!, weight: 1.5, at: Date.now(), source: "text" }], Date.now())!;
  assert.ok(Math.abs(nach3 - erwartet(3)) < 0.005, `${nach3} ≈ ${erwartet(3)}`);
  assert.equal(s.sb.bewertungInfo(s.textId).lernstandSkill, "deutsch.schreiben.bewerbung");

  // noch einmal übernommen, mit einer anderen Note: ersetzt, zählt nicht doppelt
  const zwei = cleanBewertung((n) => ({ ...form, note: "2", s_inhalt: "2" })[n], { auftraege: p.auftraege! });
  assert.ok("bewertung" in zwei);
  s.sb.bestaetigeBewertung(s.textId, zwei.bewertung, s.niko.id);
  const nach2 = (await lernstand(s.sid, "deutsch.schreiben.bewerbung"))!;
  assert.ok(Math.abs(nach2 - erwartet(2)) < 0.005, `${nach2} ≈ ${erwartet(2)}: ersetzt, nicht dazugezählt`);
  assert.ok(s.repo.getLesson(lessonId)!.summary.includes("Note 2 (Inhalt 2, Aufbau 2, Ausdruck 3, Sprache 4)"));

  // zurückgenommen: wieder offen, kein Lernstand
  assert.ok(s.sb.nimmBewertungZurueck(s.textId));
  assert.equal(await lernstand(s.sid, "deutsch.schreiben.bewerbung"), vorher);
  assert.deepEqual(s.learning.readReport(s.repo.getLesson(lessonId)!)!.texts![0].bewertung, { stand: "offen" });
  assert.equal(s.repo.getLesson(lessonId)!.tutor_notes, "Hat sich viel Mühe gegeben.");
});

test("Nach dem Ende bewertet: geänderte Zusammenfassung und „Was wurde gemacht“ der Lehrkraft bleiben, der Bericht zeigt die Note", async () => {
  const s = await inEinheit("Sina Spaeter");
  const lessonId = s.learning.endUnit(s.unitId, { byTeacherId: s.niko.id })!;
  const lesson = s.repo.getLesson(lessonId)!;
  s.repo.saveLesson({ ...lesson, summary: "Meine eigene Zusammenfassung.", activities: "Bewerbung geschrieben, sehr konzentriert." }, lesson.id);
  const { cleanBewertung } = await import("./bewertung-kriterien");
  const c = cleanBewertung((n) => ({ s_inhalt: "2", s_textstruktur: "2", s_stil: "2", s_sprachrichtigkeit: "3" })[n as "s_inhalt"]);
  assert.ok("bewertung" in c);
  s.sb.bestaetigeBewertung(s.textId, c.bewertung, s.niko.id);
  const nach = s.repo.getLesson(lessonId)!;
  assert.equal(nach.summary, "Meine eigene Zusammenfassung.");
  assert.equal(nach.activities, "Bewerbung geschrieben, sehr konzentriert.");
  const b = s.learning.readReport(nach)!.texts![0].bewertung;
  assert.deepEqual(b, { stand: "bestaetigt", note: null, stufen: { inhalt: 2, textstruktur: 2, stil: 2, sprachrichtigkeit: 3 }, erfuellt: null, von: null });
  assert.equal(s.learning.bewertungText(b), "bewertet: Inhalt 2, Aufbau 2, Ausdruck 2, Sprache 3", "ohne Gesamtnote nur die Stufen");
  // ohne Gesamtnote zählt der Schnitt der Stufen (2,25) für den Lernstand
  const { textNotenFuerLernstand } = await import("./text-note");
  assert.deepEqual(textNotenFuerLernstand(s.sid).map((t) => [t.skillId, t.note]), [["deutsch.schreiben.bewerbung", 2.3]]);
});

test("Ohne passende Fähigkeit zählt die Note für keinen Lernstand, steht aber in der Dokumentation", async () => {
  const repo = await import("./repo");
  const texts = await import("./texts");
  const sb = await import("./schreibauftrag-bewertung");
  const { docFromText } = await import("./text-doc");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid("Timo Beschreibung", niko.id, "Mittelschule", 2));
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: null, subject: "Deutsch", topic: "Beschreibung", title: "Mein Zimmer", prompt: "Beschreibe dein Zimmer." });
  assert.ok(texts.saveText(text.id, docFromText(BRIEF), 0).ok);
  assert.equal(sb.lernstandSkillFuer(texts.getText(text.id)!), null);
  const { cleanBewertung } = await import("./bewertung-kriterien");
  const c = cleanBewertung((n) => ({ s_inhalt: "2", s_textstruktur: "2", s_stil: "2", s_sprachrichtigkeit: "3", note: "2" })[n as "s_inhalt"]);
  assert.ok("bewertung" in c);
  assert.ok(sb.bestaetigeBewertung(text.id, c.bewertung, niko.id), "jede Textarbeit lässt sich bewerten, nicht nur ein Schreibauftrag");
  assert.equal(sb.bewertungInfo(text.id).lernstandSkill, "");
  const { textNotenFuerLernstand } = await import("./text-note");
  assert.deepEqual(textNotenFuerLernstand(sid), []);
});
