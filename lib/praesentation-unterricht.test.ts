/**
 * Präsentation im Unterricht (niko, 27.10.2026): passende vorhandene Präsentationen zuerst, abspielen nur mit eigener Adresse (sonst
 * die Folien als Text), „Präsentation erstellen“ aus dem Schritt mit Kosten vorher, Entwurf erst nach „Übernehmen“ verwendet, dann
 * beim Schritt der Einheit vermerkt und beim nächsten Schüler derselben Schulstufe gefunden. Ohne KI: vorhandene gehen weiter.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt (Vorgabe: lib/fixtures/stoff-englisch-more.ts, Präsentation:
 * eine feste Antwort). Alle Namen und Texte sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import { STOFF_ENGLISCH_MORE } from "./fixtures/stoff-englisch-more";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "praes-unterricht-"));
test.after(() => fs.rmSync(process.env.UPLOADS_PATH!, { recursive: true, force: true }));
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR", "PRESENTATION_ORIGIN", "PUBLIC_URL", "RAILWAY_PUBLIC_DOMAIN",
])
  delete process.env[k];

const block = (art: string, o: Record<string, unknown> = {}) => ({ art, text: "", punkte: [], zeilen: [], schritt: false, ...o });

/** Die Antwort der KI auf „Präsentation erstellen“: zwei Folien, eine Verständnisfrage, die Antwort nur im Vortragstext. */
const DECK = {
  titel: "Past Simple",
  folien: [
    { titel: "Was schon vorbei ist", bloecke: [block("text", { text: "Gestern, letzte Woche: das ist **vorbei**." }), block("beispiel", { text: "Yesterday Mia played football." })], notiz: "Vom letzten Wochenende erzählen lassen.", schritte: [1], pruefen: [] },
    { titel: "Die Regel", bloecke: [block("merksatz", { text: "Regelmäßig: Verb + -ed" }), block("frage", { text: "Wie heißt play in der Vergangenheit?", schritt: true })], notiz: "Frage stellen und warten.\nErwartete Antwort: played", schritte: [1], pruefen: [] },
  ],
};

let nr = 0;
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundener Stoffzettel ${++nr}`)]);

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  const pu = await import("./praesentation-unterricht");
  const praes = await import("./praesentationen");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: req.fn === "praesentation" ? DECK : STOFF_ENGLISCH_MORE, refusal: false, model: req.model, usage: { input: 4_000, output: 16_000, cacheWrite: 0, cacheRead: 0, reasoning: 8_000 } };
  });
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string, klasse = 2) =>
    repo.createStudent({
      name, grade: 4 + klasse, klasse, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Englisch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ki_hinweise: "",
    });
  const heute = zeit.wienerDatum();
  /** a running Englisch unit with the Vorgabe of the Stoffzettel: its plan has Erklären steps (the first one is used) */
  const start = async (sid: number) => {
    const unit = units.startUnit(teacher.id, sid, { subject: "Englisch" }).unit;
    const { saveUpload } = await import("./materials");
    const vg = await import("./vorgabe");
    const datei = saveUpload({ name: "zettel.jpg", data: jpeg() }, { title: "Stoffzettel", studentId: sid, teacherId: teacher.id }).id;
    assert.ok("ok" in (await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "", materialIds: [datei], testId: null, keinName: true, heute })));
    const plan = c.cockpit(unit.id, { mitPlan: true }).plan;
    const erklaeren = plan.find((s) => s.art === "erklaeren" && s.skillId);
    assert.ok(erklaeren?.skillId && erklaeren.thema, JSON.stringify(plan.map((s) => [s.art, s.titel])));
    return { unit, plan, erklaeren, skill: erklaeren.skillId, thema: erklaeren.thema };
  };
  /** an uploaded HTML presentation (the teacher's own file, so it counts as geprüft) */
  const hochladen = (title: string, m: Partial<import("./praesentationen").PraesMeta> = {}, o: { quelle?: "ki" } = {}) => {
    const html = `<!doctype html><html><head><title>${title}</title><script>alert("nie")</script></head><body><section><h1>${title}</h1><ul><li>Punkt eins &amp; zwei</li></ul><p>Was ist das?</p></section><section><h2>Zweite</h2><p>Mehr</p></section></body></html>`;
    const r = praes.importierePraesentation({ name: "deck.html", data: Buffer.from(html) }, { title, fach: "Englisch", schulart: "Gymnasium", klasse: 2, thema: "", skill_ids: [], schwierigkeit: "mittel", beschreibung: "", ...m }, teacher.id, o);
    assert.ok("id" in r, JSON.stringify(r));
    return r.id;
  };
  const zaehle = (sql: string, ...p: unknown[]) => (db().prepare(sql).get(...p) as { n: number }).n;
  return { db, repo, units, c, router, pu, praes, teacher, schueler, start, hochladen, gefragt, zaehle };
}

test("Folien als Text: aus dem HTML ohne Skripte, Entitäten aufgelöst, Fragen getrennt; aus Lernheft-Folien genauso", async () => {
  const pu = await import("./praesentation-unterricht");
  const html = `<html><head><style>h1{color:red}</style></head><body>
    <section><h1>Die vier F&auml;lle</h1><ul><li>Wer: 1. Fall</li><li>Wem &amp; wen</li></ul><p>Wie fragst du nach dem 3. Fall?</p><script>document.write("GEHEIM")</script></section>
    <section><section><h2>Innen</h2><p>Text <b>fett</b></p></section></section>
    <!-- <section><h1>Kommentar</h1></section> --></body></html>`;
  const f = pu.folienAusHtml(html);
  assert.deepEqual(
    f.map((x) => [x.titel, x.punkte, x.fragen]),
    [
      ["Die vier Fälle", ["Wer: 1. Fall", "Wem & wen"], ["Wie fragst du nach dem 3. Fall?"]],
      ["Innen", ["Text fett"], []],
    ],
  );
  assert.ok(!JSON.stringify(f).includes("GEHEIM") && !JSON.stringify(f).includes("color"), "nothing of scripts or styles");
  // the deck Lernheft builds itself (lib/praesentation-html.ts): one slide per .folie
  const { deckHtml } = await import("./praesentation-html");
  const deck = { titel: "T", folien: DECK.folien.map((x) => ({ ...x, schritt_ids: [], pruefen: [] })) } as never;
  const g = pu.folienAusHtml(deckHtml(deck));
  assert.deepEqual(g.map((x) => x.titel), ["Was schon vorbei ist", "Die Regel"]);
  assert.deepEqual(g[1].fragen, ["Wie heißt play in der Vergangenheit?"]);
  assert.ok(!JSON.stringify(g).includes("Erwartete Antwort"), "the Vortragstext is never in the deck");
  assert.deepEqual(pu.fragenMitAntwort(deck), [{ folie: 2, frage: "Wie heißt play in der Vergangenheit?", antwort: "played" }]);
});

test("passende zuerst: gleiche Fähigkeit vor gleichem Thema, geprüfte vor ungeprüften, gleiche Schulstufe vor anderen; anderes Fach und Archiv nie", async () => {
  const s = await setup();
  const skill = "englisch.tenses.pastsimple";
  const kiGleich = s.hochladen("KI gleiche Stufe", { skill_ids: [skill] }, { quelle: "ki" });
  const andereStufe = s.hochladen("Andere Stufe", { skill_ids: [skill], klasse: 4 });
  const gleich = s.hochladen("Gleiche Stufe", { skill_ids: [skill] });
  const thema = s.hochladen("Thema Past Simple", { thema: "Past Simple" });
  s.hochladen("Thema in Deutsch", { fach: "Deutsch", thema: "Past Simple" });
  s.hochladen("Thema andere Stufe", { thema: "Past Simple", klasse: 4 });
  const archiv = s.hochladen("Archiviert", { skill_ids: [skill] });
  s.praes.archivierePraesentation(archiv);
  const t = s.pu.passendePraesentationen({ skillId: skill, fach: "Englisch", schulstufe: 6, thema: "Past Simple" });
  assert.deepEqual(
    t.map((x) => [x.p.id, x.grund]),
    [
      [gleich, "faehigkeit"],
      [andereStufe, "faehigkeit"],
      [kiGleich, "faehigkeit"],
      [thema, "thema"],
    ],
  );
  // a KI deck someone checked counts as geprüft
  s.praes.markierePraesentationGeprueft(kiGleich, s.teacher.id);
  assert.equal(s.pu.passendePraesentationen({ skillId: skill, fach: "Englisch", schulstufe: 6, thema: "" })[1].p.id, kiGleich);
  // without a skill only the topic in the same Fach and Schulstufe
  assert.deepEqual(
    s.pu.passendePraesentationen({ skillId: null, fach: "Englisch", schulstufe: 6, thema: "past simple" }).map((x) => x.p.id),
    [thema],
  );
  s.router.setTransport(null);
});

test("abspielen nur mit eigener Präsentations-Adresse und Dateien; sonst kein Knopf zum Abspielen, die Folien als Text", async () => {
  const s = await setup();
  const id = s.hochladen("Abspielen", { skill_ids: ["englisch.tenses.pastsimple"] });
  const p = s.praes.getPraesentation(id)!;
  const ohne = s.pu.wiedergabe(p, "localhost:3000", "http", {});
  assert.ok(!ohne.abspielen && ohne.einrichtung && /PRESENTATION_ORIGIN/.test(ohne.grund));
  // the same host name with another port is no separate address
  const gleich = s.pu.wiedergabe(p, "localhost:3000", "http", { PRESENTATION_ORIGIN: "http://localhost:3001" });
  assert.ok(!gleich.abspielen && gleich.einrichtung);
  assert.deepEqual(s.pu.wiedergabe(p, "localhost:3000", "http", { PRESENTATION_ORIGIN: "http://127.0.0.1:3000" }), { abspielen: true });
  // files missing (a restore of only the database): no play button either
  fs.rmSync(path.join(s.praes.praesentationsOrdner(), p.token), { recursive: true, force: true });
  const weg = s.pu.wiedergabe(p, "localhost:3000", "http", { PRESENTATION_ORIGIN: "http://127.0.0.1:3000" });
  assert.ok(!weg.abspielen && !weg.einrichtung);
  // the text preview of an upload: titles, points, questions; the script never
  const q = s.praes.getPraesentation(s.hochladen("Vorschau"))!;
  const f = s.pu.folienText(q);
  assert.deepEqual(f.map((x) => [x.nr, x.titel, x.punkte, x.fragen]), [
    [1, "Vorschau", ["Punkt eins & zwei"], ["Was ist das?"]],
    [2, "Zweite", ["Mehr"], []],
  ]);
  s.router.setTransport(null);
});

test("Präsentation erstellen im Schritt: Angaben aus dem Schritt, Kosten vorher, Entwurf erst nach Übernehmen verwendet, dann beim nächsten Schüler derselben Schulstufe gefunden", async () => {
  const s = await setup();
  const sid = s.schueler("Lina Probestein");
  const { unit, plan, erklaeren, skill, thema } = await s.start(sid);
  const z = s.pu.schrittDerEinheit(unit.id, erklaeren.id)!;
  assert.ok(z.erklaert, "Erklären: suchen und erstellen");
  assert.deepEqual([z.fach, z.schulart, z.klasse, z.schulstufe, z.skillId, z.thema], ["Englisch", "Gymnasium", 2, 6, skill, thema]);
  assert.ok(z.sagt.length > 40 && z.ziel, "what the step says and its goal come along");
  const ueben = plan.find((x) => x.art === "ueben" && x.thema === thema)!;
  assert.equal(s.pu.schrittDerEinheit(unit.id, ueben.id)!.erklaert, false, "Üben: no search, no button");
  assert.equal(s.pu.angebotFuer(z), null, "nothing fits yet");

  // cost before the tap, from the step's request and the price list
  assert.match(s.pu.kostenFuerSchritt(z), /^ca\. \d+–\d+ Cent$/);
  assert.deepEqual(s.pu.erstellenTor(z), { erlaubt: true });

  const vorher = s.gefragt.length;
  const r = await s.pu.erstelleSchrittEntwurf(unit.id, erklaeren.id, s.teacher.id);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(s.gefragt.length, vorher + 1);
  const req = s.gefragt.at(-1)!;
  const gesendet = JSON.stringify(req);
  assert.equal(req.fn, "praesentation");
  assert.match(gesendet, /einen Unterrichtsschritt/);
  assert.match(gesendet, /Fach: Englisch/);
  assert.match(gesendet, /Schulstufe 6/);
  assert.ok(gesendet.includes(thema!), "the topic");
  assert.match(gesendet, /zum Alter der Schulstufe/, "age-fitting examples and Verständnisfragen are asked for");
  assert.ok(!/Lina|Probestein/.test(gesendet), "no student name");
  // in the protocol with the unit and the student: the per-student limit counts it
  const call = s.db().prepare("SELECT unit_id, student_id, trigger FROM ai_calls WHERE fn = 'praesentation' ORDER BY id DESC LIMIT 1").get() as { unit_id: number; student_id: number; trigger: string };
  assert.deepEqual(call, { unit_id: unit.id, student_id: sid, trigger: "praesentation-unterricht" });

  // a proposal: not a presentation, not offered, not linked to the unit
  const e = s.pu.offenerSchrittEntwurf(unit.id, erklaeren.id)!;
  assert.equal(e.paket_id, null);
  assert.equal(e.deck.folien.length, 2);
  assert.equal(s.zaehle("SELECT COUNT(*) AS n FROM praesentationen"), 0);
  assert.equal(s.zaehle("SELECT COUNT(*) AS n FROM einheit_praesentationen"), 0);
  assert.equal(s.pu.angebotFuer(z), null);
  assert.deepEqual(s.pu.passendePraesentationen({ skillId: z.skillId, fach: "Englisch", schulstufe: 6, thema: thema! }), []);
  assert.deepEqual(s.pu.praesentationenDerEinheit(unit.id), []);
  // the package page never sees it
  assert.equal(s.zaehle("SELECT COUNT(*) AS n FROM praesentation_entwuerfe WHERE paket_id IS NOT NULL"), 0);

  // „Übernehmen“: saved like an upload, KI and Ungeprüft, with the step's Fach, Schulstufe, Thema and skill, linked to the step
  const u = s.pu.uebernimmSchrittEntwurf(e.id, s.teacher.id);
  assert.ok("ok" in u, JSON.stringify(u));
  const p = s.praes.getPraesentation(u.praesId)!;
  assert.deepEqual([p.quelle, p.geprueft_am, p.fach, p.schulstufe, p.thema, p.skill_ids], ["ki", null, "Englisch", 6, thema, [skill]]);
  assert.ok(s.praes.praesUngeprueft(p));
  assert.equal(p.notizen[2], "Frage stellen und warten.\nErwartete Antwort: played", "the Vortragstext in the database, never in the deck");
  const angebot = s.pu.angebotFuer(s.pu.schrittDerEinheit(unit.id, erklaeren.id)!)!;
  assert.deepEqual([angebot.p.id, angebot.grund, angebot.folie], [p.id, "einheit", 1]);
  assert.equal(s.pu.offenerSchrittEntwurf(unit.id, erklaeren.id), null);
  assert.deepEqual(s.pu.praesentationenDerEinheit(unit.id), [{ id: p.id, title: "Past Simple" }]);
  // the text preview is exactly the approved slides with their Vortragstext
  const text = s.pu.folienText(p);
  assert.deepEqual(text.map((x) => [x.titel, x.fragen]), [["Was schon vorbei ist", []], ["Die Regel", ["Wie heißt play in der Vergangenheit?"]]]);
  assert.match(text[1].notiz, /Erwartete Antwort: played/);

  // Abschluss „Heute gemacht“
  const { abschlussKarte } = await import("./abschluss");
  const karte = abschlussKarte(null, null, [], { aufgaben: [], fehler: [], beobachtungen: [], reaktionen: [], minitest: null, vorgabe: [], geuebt: [], pruefung: null, eigene: {}, praesentationen: s.pu.praesentationenDerEinheit(unit.id).map((x) => x.title) });
  assert.ok(karte.gemacht.some((l) => l.text === "Präsentation „Past Simple“ verwendet" && l.von === "ablauf"), JSON.stringify(karte.gemacht));

  // the next student of the same Schulstufe: offered for the same skill, nothing to create
  const zweite = s.schueler("Mira Testkamp");
  const b = await s.start(zweite);
  const z2 = s.pu.schrittDerEinheit(b.unit.id, b.erklaeren.id)!;
  const t2 = s.pu.angebotFuer(z2)!;
  assert.deepEqual([t2.p.id, t2.grund], [p.id, "faehigkeit"]);

  // „Verwerfen“ deletes the proposal; nothing else changes
  const r2 = await s.pu.erstelleSchrittEntwurf(b.unit.id, b.erklaeren.id, s.teacher.id);
  assert.ok(r2.ok);
  assert.deepEqual(s.pu.verwirfSchrittEntwurf(r2.id), { unitId: b.unit.id });
  assert.equal(s.zaehle("SELECT COUNT(*) AS n FROM praesentation_entwuerfe WHERE id = ?", r2.id), 0);
  assert.equal(s.zaehle("SELECT COUNT(*) AS n FROM praesentationen"), 1);
  assert.equal(s.zaehle("SELECT COUNT(*) AS n FROM einheit_praesentationen WHERE unit_id = ?", b.unit.id), 0);
  s.router.setTransport(null);
});

test("ohne KI: kein Erstellen (mit dem kurzen Grund), keine Anfrage; vorhandene Präsentationen werden weiter angeboten und vermerkt", async () => {
  const s = await setup();
  const sid = s.schueler("Lina Probestein");
  const { unit, erklaeren, skill } = await s.start(sid);
  s.router.setTransport(null);
  const z = s.pu.schrittDerEinheit(unit.id, erklaeren.id)!;
  const tor = s.pu.erstellenTor(z);
  assert.ok(!tor.erlaubt && /KI ist aus/.test(tor.grund));
  const r = await s.pu.erstelleSchrittEntwurf(unit.id, erklaeren.id, s.teacher.id);
  assert.ok(!r.ok && /KI ist aus/.test(r.error));
  assert.equal(s.zaehle("SELECT COUNT(*) AS n FROM ai_calls WHERE fn = 'praesentation'"), 0);
  assert.equal(s.zaehle("SELECT COUNT(*) AS n FROM praesentation_entwuerfe"), 0);

  const id = s.hochladen("Erklärt", { skill_ids: [skill!] });
  const t = s.pu.angebotFuer(z)!;
  assert.deepEqual([t.p.id, t.grund], [id, "faehigkeit"]);
  s.pu.merkePraesentation(unit.id, erklaeren.id, id, 2, s.teacher.id);
  assert.deepEqual(s.pu.praesentationImSchritt(unit.id, erklaeren.id), { praesId: id, folie: 2, erstellt: false });
  assert.deepEqual(s.pu.praesentationenDerEinheit(unit.id), [{ id, title: "Erklärt" }]);

  // the per-student limit: the KI is on, but this student's month is used up
  s.router.setTransport(async (req) => ({ parsed: DECK, refusal: false, model: req.model, usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0, reasoning: 0 } }));
  process.env.AI_STUDENT_LIMIT_EUR = "0.000001";
  s.db().prepare("INSERT INTO ai_calls (fn, tier, model, provider, student_id, cost_usd, status, created_at) VALUES ('briefing', 'standard', 'x', 'anthropic', ?, 1, 'ok', datetime('now'))").run(sid);
  try {
    const grenze = s.pu.erstellenTor(z);
    assert.ok(!grenze.erlaubt && /KI-Grenze für diesen Schüler/.test(grenze.grund), JSON.stringify(grenze));
  } finally {
    delete process.env.AI_STUDENT_LIMIT_EUR;
    s.router.setTransport(null);
  }
});

test("Upgrade: ein alter Vorschlag (paket_id NOT NULL) bleibt, danach darf paket_id leer sein", async () => {
  const { openDatabase } = await import("./db");
  const file = path.join(process.env.UPLOADS_PATH!, "alt.db");
  let conn = openDatabase(file);
  conn.pragma("foreign_keys = OFF");
  conn.exec(`DROP TABLE praesentation_entwuerfe;
    CREATE TABLE praesentation_entwuerfe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paket_id INTEGER NOT NULL REFERENCES lernpakete(id) ON DELETE CASCADE,
      inhalt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'vorschlag',
      praesentation_id INTEGER REFERENCES praesentationen(id) ON DELETE SET NULL,
      call_id INTEGER REFERENCES ai_calls(id) ON DELETE SET NULL,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
  const paket = Number(conn.prepare("INSERT INTO lernpakete (title, fach) VALUES ('Erfundenes Paket', 'Deutsch')").run().lastInsertRowid);
  conn.prepare("INSERT INTO praesentation_entwuerfe (paket_id, inhalt) VALUES (?, '{}')").run(paket);
  conn.close();
  conn = openDatabase(file);
  const spalten = conn.prepare("PRAGMA table_info(praesentation_entwuerfe)").all() as { name: string; notnull: number }[];
  assert.equal(spalten.find((x) => x.name === "paket_id")?.notnull, 0);
  assert.ok(["unit_id", "schritt_id", "auftrag"].every((n) => spalten.some((x) => x.name === n)));
  assert.deepEqual(conn.prepare("SELECT paket_id, inhalt, status FROM praesentation_entwuerfe").all(), [{ paket_id: paket, inhalt: "{}", status: "vorschlag" }]);
  conn.prepare("INSERT INTO praesentation_entwuerfe (paket_id, inhalt) VALUES (NULL, '{}')").run();
  // a deleted package still takes its proposals along
  conn.prepare("DELETE FROM lernpakete WHERE id = ?").run(paket);
  assert.equal((conn.prepare("SELECT COUNT(*) AS n FROM praesentation_entwuerfe").get() as { n: number }).n, 1);
  conn.close();
});
