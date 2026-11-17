/**
 * Textinterpretation nach Operatoren (niko, 17.11.2026): Einleitung in einem Satz und OP1–OP4 mit 550 Wörtern, die
 * Probe-Schularbeit mit Zeit und ohne Hilfen, die Liste „Vor der Abgabe“ und die Hinweise zur Kette (Zitat, dann
 * Wirkung), zu Zitaten in Einleitung und Inhalt, zur Alltagssprache und zu Autor oder Autorin. Ohne KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const ti = () => import("./textinterpretation");
const ex = () => import("./textinterpretation-beispiel");
const docOf = async (text: string) => (await import("./text-doc")).docFromText(text);
const tips = (hs: { tone: string; key: string }[]) => hs.filter((h) => h.tone === "tipp").map((h) => h.key);

const info = async (aufbau: "teile" | "operatoren" = "operatoren") => {
  const { numberedLines } = await ti();
  const b = await ex();
  return { title: b.BEISPIEL_TITEL, author: b.BEISPIEL_AUTORIN, target: 550, lines: numberedLines(b.BEISPIEL_GESCHICHTE), aufbau };
};

const EINLEITUNG = "Die Kurzgeschichte „Sieben Uhr zwölf“ von Ida Brunnhofer behandelt die Thematik der Einsamkeit im Alter.";
const INHALT = "Ein alter Mann wartet jeden Morgen auf einen Bus, der nicht mehr fährt. Eine junge Frau setzt sich zu ihm und wartet mit ihm, bis sie gehen muss. Am Ende steht er wieder allein an der Haltestelle und wartet weiter auf den nächsten Morgen.";
const FUELL = "Die Sprache ist knapp und nüchtern, die Sätze sind meist kurz, und es gibt viel wörtliche Rede zwischen den beiden Figuren, die sich erst langsam annähern.";

test("Schreibplan nach Operatoren: Einleitung und OP1–OP4, 30/80/180/180/80 von 550 Wörtern", async () => {
  const { schreibplan, AUFBAU_TARGET, cleanAufbau } = await ti();
  const plan = schreibplan(550, "Kurzgeschichte", "operatoren");
  assert.deepEqual(plan.map((p) => [p.key, p.words]), [["einleitung", 30], ["op1", 80], ["op2", 180], ["op3", 180], ["op4", 80]]);
  assert.deepEqual(plan.map((p) => p.title), ["Einleitung", "OP1 Inhalt", "OP2 Form und Sprache", "OP3 Deuten", "OP4 Aktualität und Stellungnahme"]);
  assert.match(plan[2].hint, /Merkmale der Kurzgeschichte/);
  assert.match(plan[2].hint, /Dadurch wird deutlich, dass/);
  for (const t of [400, 550, 800]) {
    const sum = schreibplan(t, "Parabel", "operatoren").reduce((s, p) => s + p.words, 0);
    assert.ok(Math.abs(sum - t) <= 10, `${t}: ${sum}`);
  }
  // the seven parts stay the default
  assert.equal(schreibplan(500).length, 7);
  assert.equal(AUFBAU_TARGET.operatoren, 550);
  assert.equal(cleanAufbau("irgendwas"), "teile");
});

test("Arbeitsauftrag und Checkliste nach Operatoren, ohne Gedankenstrich, in der Du-Form", async () => {
  const { defaultArbeitsauftrag, abgabeCheckliste, schreibplan, hinweise } = await ti();
  const a = defaultArbeitsauftrag({ title: "Das Fenster", author: "Ida Brunnhofer", year: "", kind: "Kurzgeschichte", target: 550, aufbau: "operatoren" });
  assert.match(a, /^Verfasse eine Textinterpretation zur Kurzgeschichte „Das Fenster“ von Ida Brunnhofer\./);
  for (const op of ["OP1", "OP2", "OP3", "OP4"]) assert.ok(a.includes(`• ${op}:`), op);
  assert.match(a, /zwischen 500 und 610 Wörter|zwischen 500 und 600 Wörter/);
  assert.equal(abgabeCheckliste("operatoren").length, 7);
  assert.match(abgabeCheckliste("operatoren")[1], /Thematik/);
  const doc = await docOf(`${EINLEITUNG}\n${INHALT}\n${FUELL} „Er wartet.“ (Z. 24)\nVoll krass, sein Ego ist lächerlich.`);
  const strings = [a, ...abgabeCheckliste("operatoren"), ...abgabeCheckliste("teile"), ...schreibplan(550, "Kurzgeschichte", "operatoren").flatMap((p) => [p.title, p.hint]), ...hinweise(doc, await info()).map((h) => h.text)];
  for (const s of strings) {
    assert.ok(!s.includes("—"), s);
    assert.ok(!/ – /.test(s), s);
    assert.ok(!/\bSie\b|\bIhre?\b/.test(s), `du-form: ${s}`);
  }
});

test("Hinweis Wirkung: ein Absatz, der mit einem Zitat endet, bekommt einen Tipp; mit erklärendem Satz danach nicht", async () => {
  const { hinweise } = await ti();
  const ohne = await docOf(`${EINLEITUNG}\n${INHALT}\n${FUELL} Der Alte bleibt stur: „Er wartet.“ (Z. 24)\n${FUELL}`);
  const h = hinweise(ohne, await info()).find((x) => x.key === "wirkung")!;
  assert.equal(h.tone, "tipp");
  assert.match(h.text, /„Er wartet“/);
  const mit = await docOf(`${EINLEITUNG}\n${INHALT}\n${FUELL} Der Alte bleibt stur: „Er wartet.“ (Z. 24). Dadurch wird deutlich, dass er sich an seine Gewohnheit klammert.\n${FUELL}`);
  assert.equal(hinweise(mit, await info()).find((x) => x.key === "wirkung")!.tone, "gut");
  // Zeilen ohne Zitat (Abschnitte des Aufbaus) brauchen keine Wirkung, der Titel ist kein Zitat
  const abschnitte = await docOf(`${EINLEITUNG}\n${INHALT}\n${FUELL} Der Text hat drei Abschnitte: das Warten (Z. 1–24), das Gespräch (Z. 25–55) und der Abschied (Z. 56 ff.).\n${FUELL}`);
  assert.equal(hinweise(abschnitte, await info()).find((x) => x.key === "wirkung"), undefined);
});

test("Hinweis Zitatort: Zitate in Einleitung oder Inhalt sind ein Tipp, ab vier Absätzen", async () => {
  const { hinweise } = await ti();
  const im = await docOf(`${EINLEITUNG}\n${INHALT} Er sagt: „I wort auf'n Bus“ (Z. 31).\n${FUELL}\n${FUELL}`);
  assert.ok(tips(hinweise(im, await info())).includes("zitatort"));
  const nicht = await docOf(`${EINLEITUNG}\n${INHALT}\n${FUELL} Er sagt: „I wort auf'n Bus“ (Z. 31). Dadurch wird deutlich, wie fremd ihm die neue Zeit ist.\n${FUELL}`);
  assert.ok(!tips(hinweise(nicht, await info())).includes("zitatort"));
  // der Titel in der Einleitung ist kein Zitat
  assert.ok(!tips(hinweise(nicht, await info("teile"))).includes("zitatort"));
});

test("Hinweis Ton: Alltagswörter außerhalb von Zitaten, mit dem besseren Wort; in Zitaten und Wörter wie egoistisch, Halt, total- nicht", async () => {
  const { hinweise } = await ti();
  const um = await docOf(`${EINLEITUNG}\n${INHALT}\nDer Mann handelt wegen seines großen Egos, das ist halt lächerlich. ${FUELL}`);
  const h = hinweise(um, await info()).find((x) => x.key === "ton")!;
  assert.equal(h.tone, "tipp");
  assert.match(h.text, /„Ego“ \(besser: Eitelkeit oder Selbstwertgefühl\)/);
  assert.match(h.text, /„lächerlich“/);
  assert.match(h.text, /„halt“/);
  const ok = await docOf(`${EINLEITUNG}\n${INHALT}\nDer Mann wirkt egoistisch und macht an der Haltestelle Halt. Er sagt „Des is ur lächerlich“ (Z. 40), was seine Wut zeigt. Die totale Stille verstärkt das. ${FUELL}`);
  assert.equal(hinweise(ok, await info()).find((x) => x.key === "ton")!.tone, "gut");
});

test("Hinweis Autor oder Autorin: beide Formen in einem Text sind ein Tipp, eine allein nicht", async () => {
  const { hinweise } = await ti();
  const beide = await docOf(`${EINLEITUNG} Die Autorin zeigt das Warten.\n${INHALT} Der Autor beschreibt auch die Frau.\n${FUELL}`);
  assert.ok(tips(hinweise(beide, await info())).includes("autor"));
  const eine = await docOf(`${EINLEITUNG} Die Autorin zeigt das Warten.\n${INHALT} Die Autorin beschreibt auch die Frau.\n${FUELL}`);
  assert.ok(!hinweise(eine, await info()).some((h) => h.key === "autor"));
});

test("Hinweis Thema: nur nach Operatoren, die Einleitung nennt Thematik oder Problematik", async () => {
  const { hinweise } = await ti();
  const ohne = await docOf(`Die Kurzgeschichte „Sieben Uhr zwölf“ von Ida Brunnhofer ist sehr traurig und spielt an einer Haltestelle.\n${INHALT}\n${FUELL}`);
  assert.ok(tips(hinweise(ohne, await info())).includes("thema"));
  assert.ok(!hinweise(ohne, await info("teile")).some((h) => h.key === "thema"));
  const mit = await docOf(`${EINLEITUNG}\n${INHALT}\n${FUELL}`);
  assert.equal(hinweise(mit, await info()).find((h) => h.key === "thema")!.tone, "gut");
});

test("Schreibauftrag: Aufbau und Probe-Schularbeit werden gespeichert, geändert und gelesen; das Wortziel startet bei 550", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const store = await import("./schreibauftrag-store");
  const { planFor, arbeitsauftrag } = await import("./schreibauftrag");
  const b = await ex();
  const t = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Test Schüler", grade: 11, klasse: 3, teacher_id: t.id, school: "", school_type: "HTL", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const out = store.cleanAuftragSettings("textinterpretation", { title: b.BEISPIEL_TITEL, author: b.BEISPIEL_AUTORIN, kind: "Kurzgeschichte", story: b.BEISPIEL_GESCHICHTE, target: "", prompt: "", aufbau: "operatoren", probeMin: "100" });
  if ("error" in out) throw new Error(out.error);
  assert.equal(out.settings.target, 550);
  assert.equal(out.settings.aufbau, "operatoren");
  assert.equal(out.settings.probeMin, 100);
  assert.match(out.settings.prompt, /• OP4:/);
  const text = store.createAuftrag({ studentId: sid, teacherId: t.id, unitId: null, settings: out.settings });
  const v = store.auftragFor(text.id)!;
  assert.equal(v.aufbau, "operatoren");
  assert.equal(v.probeMin, 100);
  assert.equal(planFor(v).length, 5);
  assert.equal(store.auftragSettingsOf(text.id)!.aufbau, "operatoren");
  // ändern: zurück zu den sieben Teilen, ohne Probe
  store.updateAuftrag(text.id, { ...out.settings, aufbau: "teile", probeMin: null, prompt: arbeitsauftrag({ ...v, aufbau: "teile" }) });
  const w = store.auftragFor(text.id)!;
  assert.equal(w.aufbau, "teile");
  assert.equal(w.probeMin, null);
  assert.equal(planFor(w).length, 7);
  // andere Textsorten haben keinen Aufbau nach Operatoren
  const lb = store.cleanAuftragSettings("leserbrief", { title: "T", story: b.BEISPIEL_GESCHICHTE, kind: "Kommentar", aufbau: "operatoren", situation: "x" });
  assert.ok(!("error" in lb) && lb.settings.aufbau === "teile");
  // keine Zeit unter 10 Minuten
  const kurz = store.cleanAuftragSettings("textinterpretation", { title: "T", story: b.BEISPIEL_GESCHICHTE, probeMin: "3" });
  assert.ok(!("error" in kurz) && kurz.settings.probeMin === null);
});

test("Quiz Textinterpretation: über 100 Karten zu Deuten, Wirkung, Zitieren und Ton, alle zum Wählen", async () => {
  const q = await import("./lernspiele-quiz");
  const karten = q.quizKandidaten("deutsch.os.matura.textinterpretation");
  assert.ok(karten.length >= 100, `${karten.length} Karten`);
  assert.ok(karten.every((k) => k.karte.form !== "reihe" && k.karte.faecher.includes(k.karte.richtig)));
  const deuten = karten.filter((k) => k.karte.vor.startsWith("Der Satz „") && ["deutet", "beschreibt nur", "erzählt nach"].includes(k.karte.richtig));
  assert.ok(deuten.length >= 30, `${deuten.length} Sätze zum Einordnen`);
  for (const art of ["deutet", "beschreibt nur", "erzählt nach"]) assert.ok(deuten.filter((k) => k.karte.richtig === art).length >= 9, art);
  assert.ok(karten.some((k) => k.karte.richtig === "(vgl. Z. 37–40)"));
  assert.ok(karten.some((k) => k.karte.richtig === "aus Eitelkeit"));
  // nach einem Fehler kommt die Regel
  assert.ok(deuten.every((k) => k.karte.regel));
});
