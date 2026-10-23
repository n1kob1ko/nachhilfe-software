/**
 * Lernpaket mit KI entwerfen (Plan 2.1): keine Schülerdaten in der Anfrage, Aufgaben zuerst aus dem Bestand,
 * KI-Aufgaben nur nach den Prüfungen jeder KI-Aufgabe, die Datei geht durch die Prüfung des Imports, gespeichert
 * als Entwurf, „ungeprüft“, mit den Kosten aus dem Protokoll. Ohne KI und bei einem Fehler wird nichts gespeichert.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde.
 * Alle Namen und Texte sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_DISABLED"])
  delete process.env[k];

const SKILL = "deutsch.grammatik.faelle";

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  repo.createStudent({
    name: "Ronja Pichlbauer",
    grade: 6,
    klasse: 2,
    teacher_id: niko.id,
    school: "",
    school_type: "Mittelschule",
    subjects: ["Deutsch"],
    current_topics: "PRIVAT-THEMA",
    strengths_note: "PRIVAT-STAERKE",
    weaknesses_note: "PRIVAT-SCHWAECHE",
    goals: "PRIVAT-ZIEL",
    notes: "PRIVAT-NOTIZ",
    ki_hinweise: "PRIVAT-KI-HINWEIS",
  });
  // a task of the Aufgabenbibliothek for the skill, with a student's name in it
  const bib = repo.createWorksheet(
    { title: "Fälle", subject: "Deutsch", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Grammatik", difficulty: "mittel", task_type: "mc", kind: "bibliothek", source: "manuell", skill_ids: [SKILL] },
    [{ type: "mc", skillId: SKILL, difficulty: "mittel", prompt: "Ronja gibt dem Hund einen Knochen. In welchem Fall steht „dem Hund“?", data: { options: ["Nominativ", "Genitiv", "Dativ", "Akkusativ"] }, answer: { correct: 2 }, solution: "Wem? dem Hund: Dativ.", hints: [], errorMap: [] }],
  );
  const bibTask = repo.listTasks(bib)[0].id;
  return { db, repo, niko, bibId: `B${bibTask}` };
}

async function mitKi(antwort: (req: AIRequest) => unknown, o: { ms?: number; fehler?: number } = {}) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  let fehler = o.fehler ?? 0;
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    if (o.ms) await new Promise((r) => setTimeout(r, o.ms));
    if (fehler-- > 0) throw new Error("Verbindung abgebrochen");
    return { parsed: antwort(req), refusal: false, model: req.model, usage: { input: 6_000, output: 15_000, cacheWrite: 0, cacheRead: 0, reasoning: 7_000 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

/** A KI task in the builder's KI form (lib/ai/features.ts TaskSchema), every field given. */
const kiAufgabe = (o: Record<string, unknown> = {}) => ({
  category: "grammatik",
  format: "mc",
  skill_ids: [SKILL],
  topic: "Fälle",
  difficulty: "mittel",
  prompt: "In welchem Fall steht „des Lehrers“? Das Heft des Lehrers liegt am Tisch.",
  passage: null,
  options: ["Nominativ", "Genitiv", "Dativ", "Akkusativ"],
  correct_option: 1,
  accepted_answers: null,
  numeric: false,
  blanks: null,
  sample_answer: null,
  steps: null,
  case_sensitive: null,
  faulty_text: null,
  corrected_text: null,
  text_errors: null,
  answer_lines: null,
  math_start: null,
  variable: null,
  result_unit: null,
  result_form: null,
  round_to: null,
  parts: null,
  criteria: ["Genitiv erkannt"],
  solution: "Wessen Heft? Des Lehrers: Genitiv.",
  solution_steps: ["Wessen? fragen", "Genitiv"],
  estimated_time_sec: 40,
  hints: ["Frag mit Wessen?"],
  common_errors: [{ answer: "2", label: "Dativ statt Genitiv" }],
  ...o,
});

const schritt = (art: string, titel: string, minuten: number, o: Record<string, unknown> = {}) => ({
  art,
  titel,
  minuten,
  lehrer_sagt: `${titel}: Heute geht es um die vier Fälle.`,
  lehrer_fragt: "",
  erwartete_antwort: "",
  bei_fehler: "",
  notiz: "",
  pruefen: [],
  aufgaben_aus_bestand: [],
  neue_aufgaben: [],
  ...o,
});

const ANTWORT = (bibId: string) => ({
  titel: "Die vier Fälle",
  ziel: "Die Schüler bestimmen die vier Fälle mit der Frageprobe.",
  schritte: [
    schritt("einstieg", "Einstieg", 5),
    schritt("erklaerung", "Frageprobe", 10, { pruefen: ["Ist „wegen“ mit Dativ in der 2. Klasse schon Thema?"] }),
    schritt("uebung", "Üben", 20, {
      aufgaben_aus_bestand: [bibId, "G1", "G1", "X99"],
      // a correct KI task, and a gap text with two gaps but one solution: the check drops it
      neue_aufgaben: [kiAufgabe(), kiAufgabe({ format: "cloze", category: "lueckentext", prompt: "Ich gebe ___ Lehrer ___ Heft.", options: null, correct_option: null, blanks: [["dem"]] })],
    }),
    schritt("kontrolle", "Kontrolle", 10, { aufgaben_aus_bestand: ["G2"] }),
    schritt("abschluss", "Abschluss", 5),
  ],
});

test("Entwurf: Bestand zuerst, KI-Aufgaben nur geprüft, als Entwurf „ungeprüft“ mit Herkunft KI und Kosten aus dem Protokoll", async () => {
  const s = await setup();
  const ki = await mitKi(() => ANTWORT(s.bibId));
  try {
    const { entwerfeLernpaket, kiKosten } = await import("./lernpaket-ki");
    const lp = await import("./lernpakete");
    const res = await entwerfeLernpaket({ skillId: SKILL, schulart: "Mittelschule", klasse: 2, dauer: 50, hinweise: "verwechseln Dativ und Akkusativ" }, s.niko.id);
    assert.ok(res.ok, JSON.stringify(res));
    assert.equal(ki.gefragt.length, 1);
    assert.equal(ki.gefragt[0].fn, "lernpaket");
    const p = lp.getLernpaket(res.id)!;
    assert.equal(p.status, "entwurf");
    assert.equal(p.quelle, "ki");
    assert.ok(lp.ungeprueft(p), "von der KI und noch nicht geprüft");
    assert.equal(p.title, "Die vier Fälle");
    assert.equal(p.fach, "Deutsch");
    assert.equal(p.schulart, "Mittelschule");
    assert.equal(p.klasse, 2);
    assert.deepEqual(p.skill_ids, [SKILL]);
    assert.equal(p.minuten_summe, 50);
    assert.deepEqual(p.schritte[1].pruefen, ["Ist „wegen“ mit Dativ in der 2. Klasse schon Thema?"], "was die KI unsicher findet, steht bei „Noch zu prüfen“");
    const ueben = p.schritte[2].aufgaben;
    assert.equal(ueben.length, 3, "Bibliothek, G1 einmal, die richtige KI-Aufgabe");
    assert.match(ueben[0].prompt, /dem Hund/);
    assert.equal(ueben[2].prompt, "In welchem Fall steht „des Lehrers“? Das Heft des Lehrers liegt am Tisch.");
    assert.equal(ueben[2].data.options?.[ueben[2].answer.correct!], "Genitiv", "die Antworten sind gemischt, die richtige bleibt richtig");
    assert.equal(p.schritte[3].aufgaben.length, 1);
    assert.equal(res.weggelassen.length, 2, res.weggelassen.join("\n"));
    assert.ok(res.weggelassen.some((w) => w.includes("X99") && w.includes("nicht im Bestand")));
    assert.ok(res.weggelassen.some((w) => w.includes("Prüfung nicht bestanden") && w.includes("cloze")), "der Lückentext mit zu wenigen Lösungen fällt weg");
    // every task passes the builder's check: the package can be sent once it is geprüft
    const { checkTask } = await import("./builder");
    for (const st of p.schritte) for (const a of st.aufgaben) assert.equal(checkTask(a), null, a.prompt);

    const k = kiKosten(p.ki_call_id)!;
    assert.ok(k, "die Anfrage steht im Protokoll");
    assert.equal(k.tokensEin, 6_000);
    assert.equal(k.tokensAus, 15_000);
    assert.equal(k.denken, 7_000);
    assert.ok(k.usd > 0.1 && k.usd < 0.3, `${k.usd} $`);
    const call = s.db().prepare("SELECT teacher_id, unit_id, trigger, fn FROM ai_calls WHERE id = ?").get(p.ki_call_id) as { teacher_id: number; unit_id: number | null; trigger: string; fn: string };
    assert.deepEqual(call, { teacher_id: s.niko.id, unit_id: null, trigger: "lernpaket", fn: "lernpaket" });

    // the draft is a normal package: export and import give it again
    const aus = lp.exportiereLernpaket(res.id)!;
    const wieder = lp.importiereLernpaket(aus, s.niko.id);
    assert.ok("id" in wieder, "id" in wieder ? "" : wieder.fehler.join("\n"));
  } finally {
    ki.aus();
  }
});

test("Wortarten: die KI-Aufgaben gehen durch die Wortarten-Prüfung; falsche fallen weg, zweifelhafte warten auf den Lehrer", async () => {
  const s = await setup();
  const W = "deutsch.wortarten.bestimmen";
  const mc = (satz: string, richtig: number) =>
    kiAufgabe({ category: "wortarten", skill_ids: [W], prompt: `Welche Wortart hat das Wort in eckigen Klammern?\n„${satz}“`, options: ["Adjektiv", "Adverb", "Verb", "Nomen"], correct_option: richtig, solution: "siehe Antwort", criteria: ["Wortart richtig"], common_errors: [] });
  const ki = await mitKi(() => ({
    titel: "Wortarten",
    ziel: "",
    schritte: [schritt("uebung", "Bestimmen", 50, { neue_aufgaben: [mc("Er läuft [schnell].", 1), mc("Der [kleine] Hund bellt.", 3)] })],
  }));
  try {
    const { entwerfeLernpaket } = await import("./lernpaket-ki");
    const lp = await import("./lernpakete");
    const res = await entwerfeLernpaket({ skillId: W, schulart: "Mittelschule", klasse: 2, dauer: 50 }, s.niko.id);
    assert.ok(res.ok, JSON.stringify(res));
    assert.match(String(ki.gefragt[0].content), /Erlaubte Wortarten/, "die Wortarten-Regeln stehen in der Anfrage");
    assert.ok(res.weggelassen.some((w) => /„schnell“ ist ein Adjektiv/.test(w)), res.weggelassen.join("\n"));
    const p = lp.getLernpaket(res.id)!;
    const [doubt] = p.schritte[0].aufgaben;
    assert.equal(p.schritte[0].aufgaben.length, 1);
    assert.match(doubt.data.pruefen!.join(), /Ist „kleine“ hier wirklich ein Nomen\?/);
    assert.ok(lp.offeneHinweise(p).some((h) => h.includes("kleine")), "steht bei „Noch zu prüfen“");
    assert.ok("fehler" in lp.markiereGeprueft(res.id, s.niko.id), "Geprüft erst nach Bestätigung der Punkte");
    assert.deepEqual(lp.markiereGeprueft(res.id, s.niko.id, { hinweiseGeprueft: true }), { ok: true });
  } finally {
    ki.aus();
  }
});

test("an die KI: keine Schülerdaten, Namen ersetzt, keine KI-Hinweise; Fähigkeit, Lehrplan und Bestand schon", async () => {
  const s = await setup();
  const ki = await mitKi(() => ANTWORT(s.bibId));
  try {
    const { entwerfeLernpaket } = await import("./lernpaket-ki");
    const res = await entwerfeLernpaket({ skillId: SKILL, schulart: "Mittelschule", klasse: 2, dauer: 50, hinweise: "Ronja verwechselt Dativ und Akkusativ, Niko auch manchmal." }, s.niko.id);
    assert.ok(res.ok);
    const req = ki.gefragt[0];
    const alles = `${req.system}\n${String(req.content)}`;
    for (const name of ["Ronja", "Pichlbauer", "Niko"]) assert.ok(!new RegExp(`\\b${name}\\b`, "i").test(alles), `${name} geht nicht mit`);
    assert.ok(!alles.includes("PRIVAT"), "nichts vom Schüler: weder Notizen noch Ziele noch KI-Hinweise");
    assert.ok(alles.includes("[Name] verwechselt Dativ und Akkusativ"), "die Hinweise gehen mit, ohne Namen");
    assert.ok(alles.includes("[Name] gibt dem Hund einen Knochen"), "die Aufgabe aus der Bibliothek ohne Namen");
    assert.ok(alles.includes(`Fähigkeit: ${SKILL}`));
    assert.ok(alles.includes("2. Klasse Mittelschule (Schulstufe 6)"));
    assert.ok(alles.includes("Typische Fehler:"), "die typischen Fehler der Fähigkeit");
    assert.ok(alles.includes("genau 50 Minuten"));
    assert.match(alles, new RegExp(`- ${s.bibId} \\[Auswahl, mittel\\]`));
    assert.match(alles, /- G1 \[/, "Aufgaben der eingebauten Generatoren");
    assert.match(req.system, /Richtigkeit geht vor Menge/);
    assert.match(req.system, /Erfinde keine Zitate, Seitenzahlen/);
    assert.match(req.system, /österreichischen Lehrplan/);
  } finally {
    ki.aus();
  }
});

test("ohne Fähigkeit: Fach und Thema reichen, dann ohne Aufgaben; ohne beides kein Auftrag", async () => {
  const s = await setup();
  const ki = await mitKi(() => ({ ...ANTWORT(s.bibId), schritte: ANTWORT(s.bibId).schritte.map((x) => ({ ...x, minuten: 7 })) }));
  try {
    const { entwerfeLernpaket, pruefeEingabe } = await import("./lernpaket-ki");
    assert.ok("fehler" in pruefeEingabe({ dauer: 50 }));
    assert.ok("fehler" in pruefeEingabe({ fach: "Biologie", dauer: 50 }), "Thema fehlt");
    assert.ok("fehler" in pruefeEingabe({ skillId: "gibt.es.nicht" }));
    assert.ok("fehler" in pruefeEingabe({ skillId: SKILL, dauer: 5 }), "zu kurz");
    assert.ok("fehler" in pruefeEingabe({ skillId: SKILL, schulart: "Volksschule", klasse: 7 }), "die Volksschule hat 4 Klassen");
    const res = await entwerfeLernpaket({ fach: "Biologie", thema: "Die Zelle", dauer: 45 }, s.niko.id);
    assert.ok(res.ok, JSON.stringify(res));
    assert.match(String(ki.gefragt[0].content), /Ohne Fähigkeit: keine Aufgaben/);
    const p = (await import("./lernpakete")).getLernpaket(res.id)!;
    assert.equal(p.fach, "Biologie");
    assert.equal(p.thema, "Die Zelle");
    assert.equal(p.schritte.reduce((n, x) => n + x.aufgaben.length, 0), 0);
    assert.equal(p.minuten_summe, 45, "5 × 7 Minuten werden auf 45 gebracht");
    assert.ok(p.schritte.every((x) => x.minuten >= 1));
  } finally {
    ki.aus();
  }
});

test("ohne KI oder bei einem Fehler: Meldung, nichts gespeichert; „Erneut versuchen“ fragt neu; Doppelklick fragt einmal", async () => {
  const s = await setup();
  const { entwerfeLernpaket, kiAusGrund } = await import("./lernpaket-ki");
  const zahl = () => (s.db().prepare("SELECT COUNT(*) AS n FROM lernpakete").get() as { n: number }).n;
  (await import("./ai/router")).setTransport(null);
  assert.match(kiAusGrund() ?? "", /KI ist aus/);
  const aus = await entwerfeLernpaket({ skillId: SKILL }, s.niko.id);
  assert.ok(!aus.ok && /KI ist aus/.test(aus.error));
  assert.equal(zahl(), 0);

  const ki = await mitKi(() => ANTWORT(s.bibId), { fehler: 1, ms: 30 });
  try {
    assert.equal(kiAusGrund(), null);
    const kaputt = await entwerfeLernpaket({ skillId: SKILL }, s.niko.id);
    assert.ok(!kaputt.ok && /nicht erreichbar/.test(kaputt.error), JSON.stringify(kaputt));
    assert.equal(zahl(), 0, "nichts gespeichert");
    const [a, b] = await Promise.all([entwerfeLernpaket({ skillId: SKILL }, s.niko.id), entwerfeLernpaket({ skillId: SKILL }, s.niko.id)]);
    assert.ok(a.ok && b.ok && a.id === b.id, "ein Doppelklick ist eine Anfrage und ein Paket");
    assert.equal(ki.gefragt.length, 2, "der Fehlversuch und ein neuer Versuch");
    assert.equal(zahl(), 1);
  } finally {
    ki.aus();
  }
});

test("eine unbrauchbare Antwort: kein Paket, die Meldung nennt die Kosten; zu lange Texte werden gekürzt", async () => {
  const s = await setup();
  const leer = await mitKi(() => ({ titel: "x", ziel: "", schritte: [] }));
  try {
    const { entwerfeLernpaket } = await import("./lernpaket-ki");
    const r = await entwerfeLernpaket({ skillId: SKILL }, s.niko.id);
    assert.ok(!r.ok && /keinen brauchbaren Ablauf/.test(r.error) && /Cent gekostet/.test(r.error), JSON.stringify(r));
  } finally {
    leer.aus();
  }
  const lang = await mitKi(() => ({ titel: "T".repeat(300), ziel: "Z".repeat(3000), schritte: [schritt("erklaerung", "E".repeat(200), 50, { lehrer_sagt: "S".repeat(9000), pruefen: Array.from({ length: 30 }, (_, i) => `Punkt ${i} ${"p".repeat(700)}`) })] }));
  try {
    const { entwerfeLernpaket } = await import("./lernpaket-ki");
    const r = await entwerfeLernpaket({ skillId: SKILL, dauer: 50 }, s.niko.id);
    assert.ok(r.ok, JSON.stringify(r));
    const p = (await import("./lernpakete")).getLernpaket(r.id)!;
    assert.ok(p.title.length <= 120 && p.ziel.length <= 1000 && p.schritte[0].lehrer_sagt.length <= 4000);
    assert.equal(p.schritte[0].pruefen.length, 20);
  } finally {
    lang.aus();
  }
});

test("Kosten vor dem Klick: etwa 15 bis 25 Cent mit dem Standardmodell, im manuellen Modus nichts", async () => {
  await setup();
  const { kostenSchaetzung } = await import("./lernpaket-ki");
  const k = kostenSchaetzung();
  assert.match(k.text, /^ca\. \d+–\d+ Cent$/);
  assert.ok(k.usdVon > 0.1 && k.usdBis < 0.35, JSON.stringify(k));
  const { setKiModus, resetKiModusCache } = await import("./ai/modus");
  setKiModus("manual");
  assert.equal(kostenSchaetzung().text, "kostet nichts (manueller Modus)");
  setKiModus("anthropic");
  resetKiModusCache();
});
