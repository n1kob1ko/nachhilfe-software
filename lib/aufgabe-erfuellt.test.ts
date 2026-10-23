/**
 * „Aufgabe erfüllt?“ (lib/schreibauftrag-bewertung.ts, lib/bewertung-kriterien.ts, lib/ai/schreibauftrag-bewertung.ts):
 * die App teilt die Aufgabenstellung selbst in Arbeitsaufträge, die KI beurteilt genau diese und kann keine hinzufügen,
 * erfundene Zitate fallen heraus und werden gezählt, ohne Aufgabenstellung wird nichts gesendet, ein Klick startet die
 * Korrektur der Sprache und die Aufgabe, eine normale Textarbeit mit Angabe bekommt die Prüfung auch. Schüler, Firmen
 * und Texte sind erfunden. No KI call leaves the test: every request goes to router.setTransport.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

type AIRequest = import("./ai/router").AIRequest;
type AIResult = import("./ai/providers/types").AIResult;

const usage = { input: 1500, output: 600, cacheWrite: 0, cacheRead: 0 };

/** Antwortet je KI-Funktion; jede Anfrage wird mitgeschrieben, nichts verlässt den Test. */
async function withStub<T>(answer: (r: AIRequest) => unknown, run: () => Promise<T>): Promise<{ out: T; calls: AIRequest[] }> {
  const router = await import("./ai/router");
  router.resetRouter();
  const calls: AIRequest[] = [];
  router.setTransport(async (r): Promise<AIResult> => {
    calls.push(r);
    const a = answer(r);
    if (a instanceof Error) throw a;
    // die Antwort der Bewertung geht durch ihr Schema (wie die echte), die der Sprache so wie in lib/textkorrektur.test.ts
    return { parsed: r.fn === "bewertung" ? r.schema.parse(a) : a, refusal: false, model: r.model, usage, costUsd: 0.001 };
  });
  try {
    return { out: await run(), calls };
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
}

/** Die Korrektur der Sprache, so knapp wie möglich: kein Fehler, kein Hinweis. */
const sprachAntwort = { findings: [], hints: [], strengths: ["Klarer Aufbau"], main_issue: "", recommendation: "", recommendation_skill_id: null };

const kid = (name: string, teacherId: number, school_type = "Mittelschule", klasse = 4) => ({
  name, grade: klasse, klasse, teacher_id: teacherId, school: "", school_type, subjects: ["Deutsch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

const ANZEIGE = [
  "Tischlerei Holzwurm in Talstein sucht ab September einen Lehrling (m/w/d).",
  "Du arbeitest gern mit Holz und bist verlässlich.",
  "Wir bieten eine abwechslungsreiche Ausbildung in einem kleinen Team.",
  "Bewerbung bitte an Frau Kornberger.",
].join("\n");

const AUFGABE = [
  "Schreib eine Bewerbung für die Lehrstelle aus der Anzeige.",
  "- Sag, wo du von der Stelle erfahren hast.",
  "- Begründe dein Interesse und nenne eine Stärke mit Beispiel.",
  "- Bitte um ein Vorstellungsgespräch.",
].join("\n");

const BRIEF = [
  "Sehr geehrte Frau Kornberger,",
  "in der Zeitung habe ich gelesen, dass die Tischlerei Holzwurm einen Lehrling sucht. Ich arbeite gern mit Holz, weil ich mit meinem Opa schon ein Vogelhaus gebaut habe. Ich bin verlässlich und komme nie zu spät.",
  "Ich freue mich auf Ihre Antwort.",
  "Mit freundlichen Grüßen",
  "Mira Sonnleitner",
].join("\n");

async function bewerbung(name: string, o: { prompt?: string; angabe?: string; fertig?: boolean } = {}) {
  const repo = await import("./repo");
  const texts = await import("./texts");
  const sb = await import("./schreibauftrag-bewertung");
  const tc = await import("./text-correction");
  const { docFromText } = await import("./text-doc");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid(name, niko.id));
  const text = texts.createText({ studentId: sid, teacherId: niko.id, unitId: null, subject: "Deutsch", topic: "Bewerbungsschreiben", title: "Bewerbung", prompt: o.prompt ?? AUFGABE });
  assert.ok(texts.saveText(text.id, docFromText(BRIEF.replace("Mira Sonnleitner", name)), 0).ok);
  if (o.fertig !== false) texts.setTextStatus(text.id, "fertig");
  if (o.angabe) sb.speichereAngabe(text.id, o.angabe, niko.id);
  return { repo, texts, sb, tc, niko, sid, textId: text.id };
}

const zaehle = async () => {
  const { db } = await import("./db");
  return Object.fromEntries(["attempts", "skill_snapshots", "skill_history", "lessons", "tests", "text_correction_items"].map((t) => [t, (db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n]));
};

test("Arbeitsaufträge: die App teilt die Aufgabenstellung selbst und immer gleich", async () => {
  const { arbeitsauftraege, MAX_AUFTRAEGE } = await import("./bewertung-kriterien");
  const { arbeitsauftrag, beispielFor } = await import("./schreibauftrag");

  // der Arbeitsauftrag eines Schreibauftrags: Einleitung und Umfang sind Rahmen, die drei • sind die Aufträge
  const b = beispielFor("leserbrief");
  const sa = arbeitsauftraege(arbeitsauftrag({ sorte: "leserbrief", title: b.beilage.title, author: b.beilage.author, year: b.beilage.year, medium: b.beilage.medium, kind: b.beilage.kind, target: 300, situation: "" }));
  assert.equal(sa.punkte.length, 3);
  assert.equal(sa.geteilt, true);
  assert.ok(sa.punkte.every((p) => !p.startsWith("•")));
  assert.ok(sa.rahmen.some((r) => /^Bearbeite dabei/.test(r)));
  assert.ok(sa.rahmen.some((r) => /^Schreib zwischen \d+ und \d+ Wörter\.$/.test(r)), "der Umfang ist Rahmen, kein Auftrag");

  assert.deepEqual(arbeitsauftraege("1. Lies den Text.\n2) Fasse ihn zusammen.\n3. Nimm Stellung.").punkte, ["Lies den Text.", "Fasse ihn zusammen.", "Nimm Stellung."]);
  assert.deepEqual(arbeitsauftraege("a) Beschreibe das Bild.\nb) Erzähle, was davor geschah.").punkte, ["Beschreibe das Bild.", "Erzähle, was davor geschah."]);
  assert.deepEqual(arbeitsauftraege("Aufgabe 1: Stell dich vor.\nAufgabe 2: Begründe, warum du die Stelle willst.").punkte, ["Stell dich vor.", "Begründe, warum du die Stelle willst."]);
  // eine am Zeilenende getrennte Aufzählung gehört zusammen; die Einleitung davor ist Rahmen
  const fort = arbeitsauftraege("Schreib einen Brief:\n- Beschreibe deine\nStärken mit einem Beispiel.\n- Bitte um ein Gespräch\n  mit der Chefin.");
  assert.deepEqual(fort.punkte, ["Beschreibe deine Stärken mit einem Beispiel.", "Bitte um ein Gespräch mit der Chefin."]);
  assert.deepEqual(fort.rahmen, ["Schreib einen Brief:"]);
  // ohne Zeichen: jede eigene Zeile ein Auftrag, getrennte Sätze wieder verbunden
  assert.deepEqual(arbeitsauftraege("Schreib eine Bewerbung.\nBezieh dich auf die Anzeige.").punkte, ["Schreib eine Bewerbung.", "Bezieh dich auf die Anzeige."]);
  const umbruch = arbeitsauftraege("Schreib eine Bewerbung für die\nLehrstelle als Tischler.");
  assert.deepEqual(umbruch, { punkte: ["Schreib eine Bewerbung für die Lehrstelle als Tischler."], rahmen: [], geteilt: false, weggelassen: 0 }, "ein Satz über zwei Zeilen ist ein Auftrag");
  // nicht teilbar: die ganze Aufgabenstellung ist ein Auftrag
  assert.deepEqual(arbeitsauftraege("Erzähle von einem Ausflug, bei dem etwas Unerwartetes passiert ist. Achte auf den Höhepunkt."), {
    punkte: ["Erzähle von einem Ausflug, bei dem etwas Unerwartetes passiert ist. Achte auf den Höhepunkt."],
    rahmen: [],
    geteilt: false,
    weggelassen: 0,
  });
  assert.deepEqual(arbeitsauftraege("  \n "), { punkte: [], rahmen: [], geteilt: false, weggelassen: 0 });
  // immer gleich
  assert.deepEqual(arbeitsauftraege(AUFGABE), arbeitsauftraege(AUFGABE));
  assert.deepEqual(arbeitsauftraege(AUFGABE).punkte, ["Sag, wo du von der Stelle erfahren hast.", "Begründe dein Interesse und nenne eine Stärke mit Beispiel.", "Bitte um ein Vorstellungsgespräch."]);
  // höchstens MAX_AUFTRAEGE
  const viele = arbeitsauftraege(Array.from({ length: MAX_AUFTRAEGE + 2 }, (_, i) => `- Punkt ${i + 1}.`).join("\n"));
  assert.equal(viele.punkte.length, MAX_AUFTRAEGE);
  assert.equal(viele.weggelassen, 2);
});

test("Was fehlt: von der App bestimmt; ohne Aufgabenstellung keine Prüfung des Inhalts", async () => {
  const { fehlendeAngaben } = await import("./bewertung-kriterien");
  const basis = { art: "text" as const, vorlage: ANZEIGE, fertig: true, woerter: 120, minWoerter: 30, maxWoerter: 2500 };
  const ohne = fehlendeAngaben({ ...basis, prompt: "" });
  assert.equal(ohne.pruefbar, false);
  assert.match(ohne.zeilen[0].text, /keine Aufgabenstellung/);
  const voll = fehlendeAngaben({ ...basis, prompt: AUFGABE });
  assert.deepEqual(voll.zeilen, [], "alles da: nichts im Kasten");
  assert.equal(voll.pruefbar, true);
  const ohneAngabe = fehlendeAngaben({ ...basis, prompt: AUFGABE, vorlage: "" });
  assert.equal(ohneAngabe.pruefbar, true, "ohne Angabe wird geprüft, aber der Kasten sagt es");
  assert.match(ohneAngabe.zeilen.map((z) => z.text).join(" "), /Keine Angabe oder Textvorlage.*Zitate/);
  assert.equal(fehlendeAngaben({ ...basis, prompt: AUFGABE, fertig: false }).pruefbar, false);
  assert.equal(fehlendeAngaben({ ...basis, prompt: AUFGABE, woerter: 12 }).pruefbar, false);
  const sa = fehlendeAngaben({ ...basis, art: "schreibauftrag", prompt: AUFGABE, erwartungGespeichert: false });
  assert.match(sa.zeilen.map((z) => z.text).join(" "), /nur die Vorlage aus der Textsorte/);
  assert.match(fehlendeAngaben({ ...basis, prompt: "Erzähle von deinem Wochenende." }).zeilen[0].text, /als ein Auftrag geprüft/);
});

test("Bewerbungsschreiben mit Angabe: genau die Aufträge der App, keine erfundenen, falsche Zitate fallen heraus und werden gezählt", async () => {
  const s = await bewerbung("Mira Sonnleitner", { angabe: ANZEIGE });
  const vorher = await zaehle();
  const { out, calls } = await withStub(
    () => ({
      auftraege: [
        {
          nr: 1,
          status: "erfuellt",
          begruendung: "Der Brief nennt die Zeitung als Quelle. Er zitiert „wir suchen nur Genies“ aus der Anzeige.",
          belege: [
            { zitat: "Tischlerei Holzwurm in Talstein sucht", quelle: "textbeilage", zeile: "1" },
            { zitat: "habe ich im Radio gehört", quelle: "schuelertext", zeile: null },
          ],
        },
        { nr: 2, status: "teilweise", begruendung: "Das Interesse ist begründet, die Stärke „verlässlich“ steht ohne Beispiel.", belege: [{ zitat: "weil ich mit meinem Opa schon ein Vogelhaus gebaut habe", quelle: "schuelertext", zeile: null }] },
        { nr: 2, status: "fehlt", begruendung: "Doppelt.", belege: [] },
        { nr: 4, status: "fehlt", begruendung: "Der Lebenslauf fehlt als Beilage.", belege: [] },
        { nr: 3, status: "vielleicht", begruendung: "Ungültig.", belege: [] },
      ],
    }),
    async () => s.sb.startAufgabenPruefung(s.textId, s.niko.id, { consent: true, wait: true }),
  );
  assert.deepEqual(out, { ok: true, reused: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fn, "bewertung", "dieselbe KI-Funktion wie die Bewertung");
  const anfrage = `${calls[0].system}\n${calls[0].content}`;
  assert.ok(anfrage.includes("Arbeitsaufträge (von der App nummeriert; beurteile genau diese):\n1. Sag, wo du von der Stelle erfahren hast.\n2. Begründe dein Interesse und nenne eine Stärke mit Beispiel.\n3. Bitte um ein Vorstellungsgespräch."));
  assert.ok(!/\n4\. /.test(String(calls[0].content)), "nur drei Aufträge");
  assert.ok(anfrage.includes("Angabe / Textvorlage:\nZeilennummer | Zeile\n  1 | Tischlerei Holzwurm in Talstein"), "die Angabe mit Zeilennummern");
  assert.ok(anfrage.includes("Erfinde keine weiteren Aufträge oder Anforderungen"));
  assert.ok(anfrage.includes("Eine andere Deutung oder Meinung ist nicht falsch"));
  assert.ok(anfrage.includes("Rechtschreibung, Grammatik und Zeichensetzung gehören nicht hierher"), "Sprache und Inhalt getrennt");
  assert.ok(!anfrage.includes("Sonnleitner") && !anfrage.includes("Mira"), "der Schülername ist verborgen");
  assert.ok(anfrage.includes("Frau Kornberger"), "ein Name aus der Angabe bleibt, damit Zitate daraus auffindbar sind");
  assert.ok(!anfrage.includes("Inhalt (") && !anfrage.includes("Stufen:"), "keine Kriterien der SRDP bei einer normalen Textarbeit");

  const p = s.sb.pruefungInfo(s.textId);
  assert.equal(p.status, "fertig");
  const [a1, a2, a3] = p.auftraege!;
  assert.equal(p.auftraege!.length, 3, "kein vierter, erfundener Auftrag");
  assert.equal(a1.status, "erfuellt");
  assert.equal(a1.begruendung, "Der Brief nennt die Zeitung als Quelle.", "der Satz mit dem erfundenen Zitat ist weg");
  assert.deepEqual(a1.belege, [{ zitat: "Tischlerei Holzwurm in Talstein sucht", quelle: "textbeilage", stelle: "Z. 1" }]);
  assert.equal(a1.weggelassen, 2);
  assert.equal(a2.status, "teilweise");
  assert.equal(a2.belege.length, 1);
  assert.deepEqual([a3.status, a3.ohneAntwort], ["nicht_beurteilbar", true], "ohne gültige Antwort: nicht beurteilbar, markiert");
  assert.equal(a3.text, "Bitte um ein Vorstellungsgespräch.");
  assert.equal(p.verworfen, 5, "ein Satz, ein Beleg, ein doppelter, ein erfundener und ein ungültiger Eintrag");
  assert.deepEqual(p.fehlte, []);
  assert.equal(p.version, s.texts.getText(s.textId)!.version);

  // nur für die Lehrkraft: kein Lernstand, keine Bewertung, die Angabe steht nicht im Text
  assert.deepEqual(await zaehle(), vorher);
  assert.equal(s.sb.bewertungInfo(s.textId).vorschlag, null);
  assert.equal("angabe" in s.texts.getText(s.textId)!, false, "die Angabe ist nicht Teil des Texts, den Schülerseiten lesen");
  const { db } = await import("./db");
  const call = db().prepare("SELECT student_id, trigger FROM ai_calls WHERE fn = 'bewertung' ORDER BY id DESC LIMIT 1").get() as { student_id: number; trigger: string };
  assert.deepEqual(call, { student_id: s.sid, trigger: "bewertung" }, "zählt für die Grenze je Schüler");

  // dieselbe Fassung wird nicht noch einmal bezahlt
  const again = await withStub(() => ({ auftraege: [] }), async () => s.sb.startAufgabenPruefung(s.textId, s.niko.id, { consent: true, wait: true }));
  assert.deepEqual(again.out, { ok: true, reused: true });
  assert.equal(again.calls.length, 0);
});

test("Ohne Aufgabenstellung keine Anfrage für den Inhalt; ohne Angabe sagt der Kasten, was nicht geprüft werden kann", async () => {
  const ohne = await bewerbung("Ilvy Ohneaufgabe", { prompt: "" });
  const r = await withStub(() => sprachAntwort, async () => ohne.sb.korrigierenStarten(ohne.textId, ohne.niko.id, { consent: true, aufgabe: true, wait: true }));
  assert.equal(r.out.sprache.ok, true);
  assert.deepEqual(r.out.aufgabe, { ok: false, error: "Es gibt keine Aufgabenstellung. Ohne sie lässt sich nicht beurteilen, ob die Aufgabe erfüllt ist; geprüft wird nur die Sprache.", uebersprungen: true });
  assert.deepEqual(r.calls.map((c) => c.fn), ["textkorrektur"], "nur die Sprache geht hinaus");
  assert.equal(ohne.sb.pruefungInfo(ohne.textId).status, "keine");
  const v = ohne.sb.aufgabeVorschau(ohne.texts.getText(ohne.textId)!);
  assert.equal(v.pruefbar, false);
  assert.match(v.zeilen[0].text, /keine Aufgabenstellung/);

  const s = await bewerbung("Juna Ohneangabe");
  const { calls } = await withStub(
    () => ({ auftraege: [{ nr: 1, status: "erfuellt", begruendung: "Die Zeitung ist genannt (Z. 2).", belege: [{ zitat: "sucht ab September", quelle: "textbeilage", zeile: "1" }] }] }),
    async () => s.sb.startAufgabenPruefung(s.textId, s.niko.id, { consent: true, wait: true }),
  );
  assert.ok(String(calls[0].content).includes("Angabe / Textvorlage: keine."));
  const p = s.sb.pruefungInfo(s.textId);
  assert.match(p.fehlte.map((z) => z.text).join(" "), /Keine Angabe oder Textvorlage/, "„Was gefehlt hat“ steht beim Ergebnis");
  assert.equal(p.auftraege![0].begruendung, "", "eine Zeile, die es ohne Vorlage nicht gibt, fällt heraus");
  assert.deepEqual(p.auftraege![0].belege, []);
  assert.equal(p.auftraege![0].weggelassen, 2);
});

test("Ein Klick startet beide Teile; jeder Teil scheitert und wiederholt sich für sich", async () => {
  const s = await bewerbung("Lino Beideteile", { angabe: ANZEIGE });
  const antwort = (r: AIRequest) => (r.fn === "bewertung" ? { auftraege: [1, 2, 3].map((nr) => ({ nr, status: "erfuellt", begruendung: "Ist da.", belege: [] })) } : sprachAntwort);
  const { out, calls } = await withStub(antwort, async () => s.sb.korrigierenStarten(s.textId, s.niko.id, { consent: true, aufgabe: true, wait: true }));
  assert.equal(out.sprache.ok, true);
  assert.deepEqual(out.aufgabe, { ok: true, reused: false });
  assert.deepEqual(calls.map((c) => c.fn).sort(), ["bewertung", "textkorrektur"]);
  const c = s.tc.correctionsOfText(s.textId)[0];
  assert.equal(s.tc.aiState(c), "fertig", "die Sprache wie bisher");
  assert.equal(s.sb.pruefungInfo(s.textId).status, "fertig");
  // der zweite Klick sendet nichts
  const zweit = await withStub(antwort, async () => s.sb.korrigierenStarten(s.textId, s.niko.id, { consent: true, aufgabe: true, wait: true }));
  assert.equal(zweit.calls.length, 0);
  // ohne Haken nichts
  const ohne = await withStub(antwort, async () => s.sb.startAufgabenPruefung(s.textId, s.niko.id, { consent: false, wait: true }));
  assert.equal(ohne.out.ok, false);

  // die Aufgabe scheitert allein: die Sprache bleibt, „Erneut versuchen“ wiederholt nur die Aufgabe
  const t = await bewerbung("Rosa Fehlversuch", { angabe: ANZEIGE });
  const kaputt = await withStub((r) => (r.fn === "bewertung" ? new Error("Netzwerk weg") : sprachAntwort), async () => t.sb.korrigierenStarten(t.textId, t.niko.id, { consent: true, aufgabe: true, wait: true }));
  assert.equal(kaputt.out.sprache.ok, true);
  assert.equal(t.tc.aiState(t.tc.correctionsOfText(t.textId)[0]), "fertig");
  const f = t.sb.pruefungInfo(t.textId);
  assert.equal(f.status, "fehler");
  assert.ok(f.fehler.length > 0);
  assert.equal(f.freigegeben, true);
  const neu = await withStub(antwort, async () => t.sb.retryAufgabenPruefung(t.textId, t.niko.id, { wait: true }));
  assert.deepEqual(neu.out, { ok: true, reused: false });
  assert.deepEqual(neu.calls.map((x) => x.fn), ["bewertung"], "nur die Aufgabe, nicht die Sprache");
  assert.equal(t.sb.pruefungInfo(t.textId).status, "fertig");
  const nichts = await withStub(antwort, async () => t.sb.retryAufgabenPruefung(t.textId, t.niko.id, { wait: true }));
  assert.equal(nichts.out.ok, false, "nach Erfolg gibt es nichts zu wiederholen");
});

test("Schreibauftrag: dieselbe Anfrage schlägt die Stufen vor und beurteilt jeden Arbeitsauftrag", async () => {
  const repo = await import("./repo");
  const store = await import("./schreibauftrag-store");
  const texts = await import("./texts");
  const sb = await import("./schreibauftrag-bewertung");
  const { beispielFor } = await import("./schreibauftrag");
  const { docFromText } = await import("./text-doc");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({ ...kid("Tara Leserbrief", niko.id, "HTL", 4) });
  const b = beispielFor("leserbrief");
  const set = store.cleanAuftragSettings("leserbrief", { title: b.beilage.title, author: b.beilage.author, year: b.beilage.year, medium: b.beilage.medium, kind: b.beilage.kind, story: b.beilage.text, situation: b.situation, target: "", prompt: "", beilageZiel: "650" });
  if ("error" in set) throw new Error(set.error);
  const text = store.createAuftrag({ studentId: sid, teacherId: niko.id, unitId: null, settings: set.settings });
  assert.ok(texts.saveText(text.id, docFromText(b.teile.map((t) => t.text).join("\n")), 0).ok);
  texts.setTextStatus(text.id, "fertig");

  const { calls } = await withStub(
    () => ({
      kriterien: ["inhalt", "textstruktur", "stil", "sprachrichtigkeit"].map((k) => ({ kriterium: k, stufe: 2, begruendung: "Passt.", belege: [] })),
      auftraege: [
        { nr: 1, status: "erfuellt", begruendung: "Die Position ist wiedergegeben.", belege: [{ zitat: "Das ist keine Ausrede, das ist Biologie", quelle: "textbeilage", zeile: "9" }] },
        { nr: 2, status: "erfuellt", begruendung: "Mit Argumenten.", belege: [] },
        { nr: 3, status: "fehlt", begruendung: "Kein Appell am Schluss.", belege: [] },
      ],
    }),
    async () => sb.startAufgabenPruefung(text.id, niko.id, { consent: true, wait: true }),
  );
  assert.equal(calls.length, 1, "eine Anfrage für beides");
  const anfrage = String(calls[0].content);
  assert.ok(anfrage.includes("Arbeitsaufträge (von der App nummeriert; beurteile genau diese unter auftraege):\n1. "));
  assert.ok(anfrage.includes("Erwartungshorizont (Vorlage aus der Textsorte"));
  assert.equal(sb.bewertungInfo(text.id).vorschlag!.kriterien.length, 4, "die Stufen füllen das Formular wie bisher");
  const p = sb.pruefungInfo(text.id);
  assert.deepEqual(p.auftraege!.map((a) => a.status), ["erfuellt", "erfuellt", "fehlt"]);
  assert.deepEqual(p.auftraege![0].belege, [{ zitat: "Das ist keine Ausrede, das ist Biologie", quelle: "textbeilage", stelle: "Z. 9" }]);
  assert.match(p.fehlte.map((z) => z.text).join(" "), /nur die Vorlage aus der Textsorte/, "Was gefehlt hat: kein eigener Erwartungshorizont");
  assert.equal(sb.bewertungInfo(text.id).bestaetigt, null, "ein Vorschlag ist keine Bewertung");
});
