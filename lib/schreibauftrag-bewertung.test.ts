/**
 * Erwartungshorizont, Bewertung und Umfang eines Schreibauftrags (lib/schreibauftrag-bewertung.ts,
 * lib/bewertung-kriterien.ts, lib/schreibauftrag-umfang.ts, Plan 4.2): ein Vorschlag der KI ist ungeprüft, bis die
 * Lehrkraft speichert; Schüler sehen nur Gespeichertes und Freigegebenes; erfundene Zitate und Zeilen fallen heraus;
 * eine Bewertung gilt erst bestätigt und geht nicht in den Lernstand. Schüler und Texte sind erfunden.
 * No KI call leaves the test: every request goes to router.setTransport.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

type AIRequest = import("./ai/router").AIRequest;
type AIResult = import("./ai/providers/types").AIResult;

const usage = { input: 900, output: 300, cacheWrite: 0, cacheRead: 0 };

/** Replaces the KI providers; every request is recorded, nothing leaves the test. */
async function withStub<T>(answer: (r: AIRequest) => unknown, run: () => Promise<T>): Promise<{ out: T; calls: AIRequest[] }> {
  const router = await import("./ai/router");
  router.resetRouter();
  const calls: AIRequest[] = [];
  router.setTransport(async (r): Promise<AIResult> => {
    calls.push(r);
    return { parsed: r.schema.parse(answer(r)), refusal: false, model: r.model, usage, costUsd: 0.001 };
  });
  try {
    return { out: await run(), calls };
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
}

const kid = (name: string, teacherId: number) => ({
  name, grade: 4, klasse: 4, teacher_id: teacherId, school: "", school_type: "HTL", subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

/** A Leserbrief about the example's Textbeilage (lib/schreibauftrag-beispiele.ts, written for the app). */
async function setup(name: string) {
  const repo = await import("./repo");
  const store = await import("./schreibauftrag-store");
  const texts = await import("./texts");
  const { beispielFor } = await import("./schreibauftrag");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  const b = beispielFor("leserbrief");
  const out = store.cleanAuftragSettings("leserbrief", { title: b.beilage.title, author: b.beilage.author, year: b.beilage.year, medium: b.beilage.medium, kind: b.beilage.kind, story: b.beilage.text, situation: b.situation, target: "", prompt: "", beilageZiel: "650" });
  if ("error" in out) throw new Error(out.error);
  const text = store.createAuftrag({ studentId: sid, teacherId: niko.id, unitId: null, settings: out.settings });
  return { repo, store, texts, niko, sid, text, sb: await import("./schreibauftrag-bewertung") };
}

const zaehle = async () => {
  const { db } = await import("./db");
  return Object.fromEntries(["attempts", "skill_snapshots", "skill_history", "lessons", "tests"].map((t) => [t, (db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n]));
};

test("Umfang: Textbeilage und Schülertext getrennt, Vorgaben nach Schulstufe", async () => {
  const { umfangVorgabe, cleanBeilageZiel, beilageLaenge } = await import("./schreibauftrag-umfang");
  const { schulstufe } = await import("./school");
  assert.equal(schulstufe("HTL", 4), 12);
  assert.deepEqual(umfangVorgabe("textinterpretation", 12), { target: 500, beilage: 900 }, "4. Jahrgang HTL: Wortziel der Textsorte, längere Geschichte");
  assert.deepEqual(umfangVorgabe("leserbrief", 9), { target: 210, beilage: 400 });
  assert.deepEqual(umfangVorgabe("leserbrief", 13), umfangVorgabe("leserbrief", 12), "ab der 12. Schulstufe gleich");
  assert.deepEqual(umfangVorgabe("eroerterung", null), { target: 600, beilage: 700 }, "ohne Schulstufe: wie zur Matura");
  assert.equal(cleanBeilageZiel(""), null);
  assert.equal(cleanBeilageZiel("viel"), null);
  assert.equal(cleanBeilageZiel("55"), 100);
  assert.equal(cleanBeilageZiel("733"), 730);
  assert.equal(cleanBeilageZiel("99999"), 6000);
  assert.deepEqual(beilageLaenge(400, 700), { text: "400 Wörter, kürzer als die geplanten 700", passt: false });
  assert.deepEqual(beilageLaenge(650, 700), { text: "650 Wörter (geplant: 700)", passt: true });
  assert.equal(beilageLaenge(1200, 700).passt, false);
  assert.deepEqual(beilageLaenge(80, null), { text: "80 Wörter", passt: true });
});

test("Auftrag: Länge der Textbeilage und Prüfung werden gespeichert; die Prüfung zeigt ihre Aufträge", async () => {
  const s = await setup("Jaro Prüfungsprobe");
  const heute = new Date().toISOString().slice(0, 10);
  const testId = s.repo.addTest({ student_id: s.sid, date: heute, subject: "Deutsch", kind: "Schularbeit", topic: "Leserbrief", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "2. Deutsch-Schularbeit" });
  const alt = s.repo.addTest({ student_id: s.sid, date: "2020-01-10", subject: "Deutsch", kind: "Test", topic: "", grade: 2, points: null, max_points: null, notes: "", skill_ids: [] });
  const liste = s.store.pruefungenFuerAuftrag(s.sid);
  assert.deepEqual(liste.map((p) => p.id), [testId], "alte Prüfungen stehen nicht zur Wahl");
  assert.match(liste[0].label, /^2\. Deutsch-Schularbeit · /);
  assert.deepEqual(s.store.pruefungenFuerAuftrag(s.sid, alt).map((p) => p.id), [testId, alt], "die gewählte bleibt in der Liste");

  const v = s.store.auftragSettingsOf(s.text.id)!;
  assert.equal(v.beilageZiel, 650);
  assert.equal(v.testId, null);
  assert.deepEqual(s.store.auftraegeZurPruefung(testId), []);
  s.store.updateAuftrag(s.text.id, { ...v, testId });
  assert.deepEqual(s.store.auftraegeZurPruefung(testId).map((a) => a.textId), [s.text.id]);
  assert.equal(s.store.pruefungDesAuftrags(s.text.id)?.id, testId);
  // ändern ohne Angabe lässt beides, wie es ist
  s.store.updateAuftrag(s.text.id, { ...v, beilageZiel: undefined, testId: undefined });
  assert.deepEqual([s.store.auftragSettingsOf(s.text.id)!.beilageZiel, s.store.auftragSettingsOf(s.text.id)!.testId], [650, testId]);
  // die Prüfung wird gelöscht: der Auftrag bleibt, ohne Prüfung
  const { db } = await import("./db");
  db().prepare("DELETE FROM tests WHERE id = ?").run(testId);
  assert.equal(s.store.pruefungDesAuftrags(s.text.id), null);
  assert.ok(s.texts.getText(s.text.id));
});

test("Erwartungshorizont: Vorlage ohne KI nennt mehrere Richtungen, nicht eine Lösung", async () => {
  const s = await setup("Jaro Vorlage");
  const info = s.sb.erwartungInfo(s.text.id)!;
  assert.equal(info.gespeichert, null);
  assert.equal(info.vorschlag, null);
  assert.ok(info.vorlage.inhalt.includes("Deutung oder Meinung: jede am Text begründete Richtung zählt, nicht nur eine."));
  assert.ok(info.vorlage.inhalt.some((p) => /Position/.test(p)), "die Arbeitsaufträge des Auftrags");
  assert.ok(info.vorlage.textstruktur.some((p) => /^Umfang: \d+ bis \d+ Wörter\.$/.test(p)));
  assert.equal(s.sb.freigegebeneErwartung(s.text.id), null);
});

test("Erwartungshorizont mit KI: erfundene Zitate fallen heraus; ungeprüft, bis gespeichert; Schüler sehen nur Freigegebenes", async () => {
  const s = await setup("Jaro Erwartung");
  const { out, calls } = await withStub(
    () => ({
      inhalt: [
        "Die Position des Kommentars: späterer Schulbeginn, weil „Das ist keine Ausrede, das ist Biologie“ (Z. 9).",
        "Der Kommentar fordert „Unterricht erst ab zehn Uhr für alle“ (Z. 4).",
        "Zustimmung oder Ablehnung: beide Richtungen sind möglich, wenn sie begründet sind.",
      ],
      textstruktur: ["Einleitung mit Anlass, Hauptteil mit Argumenten, Schluss mit Appell."],
      stil: ["Sachlicher Ton, der zum Leserbrief passt (Z. 140)."],
      sprachrichtigkeit: ["Zitate wörtlich und mit Zeilenangabe."],
    }),
    () => s.sb.erwartungVorschlagen(s.text.id, s.niko.id),
  );
  assert.deepEqual(out, { ok: true, verworfen: 2 });
  assert.equal(calls.length, 1);
  assert.ok(String(calls[0].content).includes("Das ist keine Ausrede"), "die Textbeilage geht mit Zeilen mit");
  assert.ok(!String(calls[0].content).includes("Jaro"), "kein Schülername");

  const info = s.sb.erwartungInfo(s.text.id)!;
  assert.equal(info.gespeichert, null, "ein Vorschlag ist noch nichts Gespeichertes");
  assert.equal(info.verworfen, 2);
  assert.deepEqual(info.vorschlag!.inhalt.length, 2);
  assert.deepEqual(info.vorschlag!.stil, []);
  assert.equal(s.sb.setzeFreigabe(s.text.id, true), false, "ein Vorschlag lässt sich nicht freigeben");
  assert.equal(s.sb.freigegebeneErwartung(s.text.id), null);

  // die Lehrkraft übernimmt und ändert: jetzt gilt er
  const e = { ...info.vorschlag!, stil: ["Sachlicher, höflicher Ton."] };
  assert.ok(s.sb.speichereErwartung(s.text.id, e, s.niko.id));
  const nach = s.sb.erwartungInfo(s.text.id)!;
  assert.deepEqual(nach.gespeichert, e);
  assert.equal(nach.vorschlag, null, "der Vorschlag ist erledigt");
  assert.equal(nach.freigegeben, false);
  assert.equal(s.sb.freigegebeneErwartung(s.text.id), null, "gespeichert, aber nicht freigegeben");
  assert.ok(s.sb.setzeFreigabe(s.text.id, true));
  const schueler = s.sb.freigegebeneErwartung(s.text.id)!;
  assert.deepEqual(schueler.map((k) => k.name), ["Inhalt", "Textstruktur", "Stil und Ausdruck", "Normative Sprachrichtigkeit"]);
  assert.deepEqual(schueler[2].punkte, ["Sachlicher, höflicher Ton."]);

  // ein neuer Vorschlag ändert nichts an dem, was der Schüler sieht
  await withStub(
    () => ({ inhalt: ["Ganz andere Punkte."], textstruktur: [], stil: [], sprachrichtigkeit: [] }),
    () => s.sb.erwartungVorschlagen(s.text.id, s.niko.id),
  );
  assert.deepEqual(s.sb.freigegebeneErwartung(s.text.id), schueler);
  s.sb.verwirfErwartungVorschlag(s.text.id);
  assert.equal(s.sb.erwartungInfo(s.text.id)!.vorschlag, null);

  // die Textbeilage ändert sich: Hinweis an die Lehrkraft
  const v = s.store.auftragSettingsOf(s.text.id)!;
  s.store.updateAuftrag(s.text.id, { ...v, story: `${v.story}\nEin Satz kommt dazu.` });
  assert.equal(s.sb.erwartungInfo(s.text.id)!.beilageGeaendert, true);

  // alles leer gespeichert: gelöscht, nicht mehr freigegeben
  s.sb.speichereErwartung(s.text.id, { inhalt: [], textstruktur: [], stil: [], sprachrichtigkeit: [] }, s.niko.id);
  assert.equal(s.sb.freigegebeneErwartung(s.text.id), null);

  const { db } = await import("./db");
  const call = db().prepare("SELECT student_id, trigger FROM ai_calls WHERE fn = 'erwartung' ORDER BY id LIMIT 1").get() as { student_id: number; trigger: string };
  assert.deepEqual(call, { student_id: s.sid, trigger: "erwartung" }, "die Kosten zählen beim Schüler");
});

test("Erwartungshorizont mit KI: nur Erfundenes, nichts übernommen", async () => {
  const s = await setup("Jaro Erfunden");
  const { out } = await withStub(
    () => ({ inhalt: ["„Die Schule beginnt um neun“ (Z. 3)"], textstruktur: ["Siehe Z. 400."], stil: [], sprachrichtigkeit: [] }),
    () => s.sb.erwartungVorschlagen(s.text.id, s.niko.id),
  );
  assert.equal(out.ok, false);
  assert.match((out as { error: string }).error, /nicht im Text stehen/);
  assert.equal(s.sb.erwartungInfo(s.text.id)!.vorschlag, null);
});

const SCHUELERTEXT = [
  "Sehr geehrte Redaktion,",
  "ich heiße Jaro und habe den Kommentar „Ausgeschlafen lernt es sich besser“ gelesen. Die Autorin schreibt: „Das ist keine Ausrede, das ist Biologie“ (Z. 9). Ich stimme ihr zu, weil ich selbst in der ersten Stunde oft müde bin.",
  "Ein späterer Beginn würde vielen helfen. Meine Freundin Lea Fantasia sagt das auch. Deshalb fordere ich die Direktion auf, den Unterricht später beginnen zu lassen.",
  "Mit freundlichen Grüßen",
].join("\n");

test("Bewertung: nur abgegebene Texte, nur mit Zustimmung; Namen verborgen; Vorschlag gilt nicht, bis bestätigt; kein Lernstand", async () => {
  const s = await setup("Jaro Bewertung");
  const { docFromText } = await import("./text-doc");
  assert.ok(s.texts.saveText(s.text.id, docFromText(SCHUELERTEXT), 0).ok);
  const t = s.texts.getText(s.text.id)!;
  assert.match(s.sb.bewertungMoeglich(t)!, /sobald der Text abgegeben ist/);
  s.texts.setTextStatus(s.text.id, "fertig");
  const vorher = await zaehle();

  const ohne = await s.sb.bewertungVorschlagen(s.text.id, s.niko.id, { zustimmung: false });
  assert.equal(ohne.ok, false);

  s.sb.speichereErwartung(s.text.id, { inhalt: ["Position des Kommentars wiedergegeben."], textstruktur: [], stil: [], sprachrichtigkeit: [] }, s.niko.id);
  const { out, calls } = await withStub(
    () => ({
      kriterien: [
        {
          kriterium: "inhalt",
          stufe: 2,
          begruendung: "Die Position ist richtig wiedergegeben (Z. 9). Der Text zitiert „Schule ist Folter“ (Z. 12). Die Meinung ist begründet.",
          belege: [
            { zitat: "Das ist keine Ausrede, das ist Biologie", quelle: "textbeilage", zeile: "9" },
            { zitat: "weil ich selbst in der ersten Stunde oft müde bin", quelle: "schuelertext", zeile: null },
            { zitat: "ich schlafe in Mathe immer ein", quelle: "schuelertext", zeile: null },
          ],
        },
        { kriterium: "Textstruktur", stufe: 3, begruendung: "Anrede, Hauptteil und Gruß sind da.", belege: [] },
        { kriterium: "Stil und Ausdruck", stufe: 3, begruendung: "Sachlich.", belege: [] },
        { kriterium: "Stil und Ausdruck", stufe: 1, begruendung: "Doppelt.", belege: [] },
        { kriterium: "sprachrichtigkeit", stufe: 7, begruendung: "Ungültige Stufe.", belege: [] },
      ],
    }),
    () => s.sb.bewertungVorschlagen(s.text.id, s.niko.id, { zustimmung: true }),
  );
  assert.deepEqual(out, { ok: true, verworfen: 4 }, "ein Satz, ein Beleg, ein doppeltes Kriterium, eine ungültige Stufe");
  assert.equal(calls.length, 1);
  const anfrage = `${calls[0].system}\n${calls[0].content}`;
  assert.ok(!anfrage.includes("Jaro"), "der Schülername ist verborgen");
  assert.ok(!anfrage.includes("Lea Fantasia"), "ein anderer Name im Text auch");
  assert.ok(anfrage.includes("Helene Baumgartl"), "die Autorin der Textbeilage bleibt");
  assert.ok(anfrage.includes("Erwartungshorizont der Lehrkraft:"));
  assert.ok(anfrage.includes("- Position des Kommentars wiedergegeben."));
  assert.ok(anfrage.includes("Eine andere Deutung oder Meinung ist nicht falsch"));

  const info = s.sb.bewertungInfo(s.text.id);
  assert.equal(info.bestaetigt, null, "ein Vorschlag ist keine Bewertung");
  const v = info.vorschlag!;
  assert.deepEqual(v.kriterien.map((k) => [k.key, k.stufe]), [["inhalt", 2], ["textstruktur", 3], ["stil", 3]]);
  assert.equal(v.kriterien[0].begruendung, "Die Position ist richtig wiedergegeben (Z. 9). Die Meinung ist begründet.");
  assert.deepEqual(v.kriterien[0].belege, [
    { zitat: "Das ist keine Ausrede, das ist Biologie", quelle: "textbeilage", stelle: "Z. 9" },
    { zitat: "weil ich selbst in der ersten Stunde oft müde bin", quelle: "schuelertext", stelle: null },
  ]);
  assert.equal(v.verworfen, 4);
  assert.equal(v.version, s.texts.getText(s.text.id)!.version);

  // die Lehrkraft bestätigt mit eigenen Werten
  const { cleanBewertung, schnitt } = await import("./bewertung-kriterien");
  const form: Record<string, string> = { s_inhalt: "2", b_inhalt: "Position stimmt.", s_textstruktur: "3", s_stil: "2", s_sprachrichtigkeit: "3", note: "2" };
  const c = cleanBewertung((n) => form[n]);
  assert.ok("bewertung" in c);
  assert.ok(s.sb.bestaetigeBewertung(s.text.id, c.bewertung, s.niko.id));
  const fest = s.sb.bewertungInfo(s.text.id);
  assert.deepEqual(fest.bestaetigt!.kriterien.map((k) => k.stufe), [2, 3, 2, 3]);
  assert.equal(fest.bestaetigt!.note, 2);
  assert.equal(fest.vorschlag, null);
  assert.equal(schnitt(fest.bestaetigt!.kriterien), 2.5);
  assert.deepEqual(await zaehle(), vorher, "nichts im Lernstand, in Stunden oder Prüfungen");

  const { db } = await import("./db");
  const call = db().prepare("SELECT student_id, trigger FROM ai_calls WHERE fn = 'bewertung' ORDER BY id DESC LIMIT 1").get() as { student_id: number; trigger: string };
  assert.deepEqual(call, { student_id: s.sid, trigger: "bewertung" });
});

test("Bewertung im Formular: jede Stufe ist Pflicht, die Gesamtnote nicht", async () => {
  const { cleanBewertung, parseBewertung } = await import("./bewertung-kriterien");
  const leer = cleanBewertung(() => "");
  assert.deepEqual(leer, { error: "Bitte bei „Inhalt“ eine Stufe wählen." });
  const f: Record<string, string> = { s_inhalt: "1", s_textstruktur: "5", s_stil: "3", s_sprachrichtigkeit: "4", b_stil: "  Ton\r\n\r\n\r\npasst.  " };
  const c = cleanBewertung((n) => f[n]);
  assert.ok("bewertung" in c);
  assert.equal(c.bewertung.note, null);
  assert.equal(c.bewertung.kriterien[2].begruendung, "Ton\n\npasst.");
  assert.deepEqual(parseBewertung(JSON.stringify(c.bewertung)), c.bewertung);
  assert.equal(parseBewertung('{"kriterien":[]}'), null);
  assert.equal(cleanBewertung((n) => ({ ...f, s_stil: "6" })[n]).hasOwnProperty("error"), true);
});
