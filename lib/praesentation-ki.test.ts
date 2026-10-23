/**
 * Präsentation aus einem Lernpaket (Plan 5.1): die KI liefert nur den Inhalt der Folien, die App baut das HTML mit dem
 * Gerüst des Skills, escapt jeden Text, legt den Vortragstext nie ins HTML, speichert über den Weg des Uploads (dieselbe
 * Prüfung) und setzt die Foliennummern erst beim Übernehmen. Keine Schülerdaten in der Anfrage; ohne KI oder Budget
 * kommt eine Meldung und keine Anfrage.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde.
 * Alle Namen und Texte sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-praes-ki-"));
test.after(() => fs.rmSync(process.env.UPLOADS_PATH!, { recursive: true, force: true }));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_DISABLED", "AI_USD_PER_EUR"])
  delete process.env[k];

const BOESE = `<script>alert("x")</script><img src=x onerror=alert(1)> & "zitiert" 'einfach' <a href="https://example.com">Link</a>`;

const PAKET = {
  format: "lernheft-lernpaket",
  version: 1,
  titel: "Die vier Fälle",
  fach: "Deutsch",
  schulart: "Mittelschule",
  klasse: 2,
  thema: "Grammatik",
  ziel: "Der Schüler bestimmt den Fall eines Nomens mit der passenden Frage.",
  schritte: [
    { art: "einstieg", titel: "Wer gibt wem was?", minuten: 5, lehrer_sagt: "Ronja gibt ihrem Bruder einen Ball. Wer bekommt etwas?", folie: 4 },
    { art: "erklaerung", titel: "Vier Fragen", minuten: 10, lehrer_sagt: "Jeder Fall hat eine Frage.", lehrer_fragt: "Wie fragst du nach dem dritten Fall?", erwartete_antwort: "Wem oder was fragt man im dritten Fall", bei_fehler: "Satz umstellen." },
    { art: "uebung", titel: "Allein üben", minuten: 15, lehrer_sagt: "Jetzt du.", notiz: "INTERNE-NOTIZ" },
  ],
};

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
  const lp = await import("./lernpakete");
  const r = lp.importiereLernpaket(PAKET, niko.id);
  assert.ok("id" in r, JSON.stringify(r));
  return { db, niko, paketId: r.id, lp };
}

const block = (art: string, o: Record<string, unknown> = {}) => ({ art, text: "", punkte: [], zeilen: [], schritt: false, ...o });

/** A KI answer: three slides, injection attempts in titles and texts, the expected answer on slide 2. */
const ANTWORT = () => ({
  titel: `Fälle <b>fett</b>`,
  folien: [
    { titel: "Die vier Fälle", bloecke: [block("text", { text: "Heute: **wem** und **wen**." })], notiz: "NOTIZ-GEHEIM-1: begrüßen.", schritte: [1], pruefen: [] },
    {
      titel: BOESE,
      bloecke: [
        block("liste", { punkte: ["1. Fall: Wer?", BOESE, "3. Fall: Wem?"], schritt: true }),
        block("merksatz", { text: "Wem oder was fragt man im dritten Fall." }),
        block("tabelle", { zeilen: [["Fall", "Frage"], ["3.", "Wem?", "zu viel", "noch mehr", "weg"], [BOESE]] }),
        block("frage", { text: "Wem gibt Ronja den Ball?", schritt: true }),
        block("beispiel", { text: "" }),
      ],
      notiz: "NOTIZ-GEHEIM-2: erst klicken, dann fragen.\nErwartet: dem Bruder.",
      schritte: [2, 99],
      pruefen: ["Ist die Tabelle vollständig?"],
    },
    { titel: "", bloecke: [], notiz: "leer", schritte: [3], pruefen: [] },
  ],
});

async function mitKi(antwort: (req: AIRequest) => unknown, o: { ms?: number } = {}) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    if (o.ms) await new Promise((r) => setTimeout(r, o.ms));
    return { parsed: antwort(req), refusal: false, model: req.model, usage: { input: 4_000, output: 16_000, cacheWrite: 0, cacheRead: 0, reasoning: 8_000 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("Renderer: das Gerüst des Skills, alles escapt, nichts von außen, kein Vortragstext, besteht die Prüfung des Uploads", async () => {
  await setup();
  const { deckAusAntwort } = await import("./ai/praesentation");
  const { praesZip } = await import("./praesentation-ki");
  const { leseZip, externeQuellen } = await import("./praesentation-zip");
  const { leseNotizen } = await import("./praesentationen");
  const schritte = [1, 2, 3].map((nr) => ({ id: 100 + nr, nr, art: "Erklärung", titel: `S${nr}`, minuten: 5, lehrer_sagt: "", lehrer_fragt: "", erwartete_antwort: "", bei_fehler: "", folie: null }));
  const deck = deckAusAntwort(ANTWORT() as never, { titel: "Die vier Fälle" }, schritte);
  assert.ok(!("fehler" in deck));
  assert.equal(deck.folien.length, 2, "die leere Folie fällt weg");
  const { html, zip } = praesZip(deck);

  // the skeleton: protocol, classes, font size, system font
  assert.match(html, /^<!doctype html>/);
  assert.ok(html.includes("font-size:calc(min(100vw,177.78vh) / 40)"));
  assert.ok(html.includes("font-family:system-ui,sans-serif"));
  assert.ok(html.includes("quelle: 'lernheft-praesentation', v: 1, typ: 'bereit'"));
  assert.equal((html.match(/<section class="folie"/g) ?? []).length, 2);
  assert.ok(html.includes('<li class="schritt">1. Fall: Wer?</li>'), "eine Liste auf Klick: jeder Punkt einzeln");
  assert.ok(html.includes('<p class="frage schritt">'));
  assert.ok(html.includes("<strong>wem</strong>"), "**fett** wird <strong>");

  // escaped: exactly one script (the skeleton's), no tag of the KI, no link, no event handler
  assert.equal((html.match(/<script/gi) ?? []).length, 1);
  const tags = html.match(/<[a-z][^>]*>/gi) ?? [];
  assert.ok(tags.every((t) => /^<(html|head|meta|title|style|body|div|script|section|h1|p|ul|li|table|thead|tbody|tr|th|td|strong)[\s>]/i.test(t)), "nur Tags des Gerüsts und der Blöcke");
  assert.ok(!tags.some((t) => /\s(src|href|on\w+|style)\s*=/i.test(t)), "kein Attribut, das lädt oder ausführt");
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;zitiert&quot; &#39;einfach&#39;"));
  assert.ok(html.includes("<title>Fälle &lt;b&gt;fett&lt;/b&gt;</title>"));
  // nothing from outside, no storage, eval or fetch
  assert.deepEqual(externeQuellen(html), []);
  assert.ok(!/url\(|@import|localStorage|sessionStorage|eval\(|fetch\(|https?:/i.test(html.replaceAll("&quot;https://example.com&quot;", "")));
  // the Vortragstext never in the HTML
  assert.ok(!html.includes("NOTIZ-GEHEIM"));

  // the ZIP passes the upload's checks; the notes file is read, not a served file
  const r = leseZip(zip);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.wert.start, "index.html");
  assert.deepEqual(r.wert.dateien.map((d) => d.pfad), ["index.html"]);
  assert.deepEqual(r.wert.extern, []);
  const n = leseNotizen(r.wert.notizen!);
  assert.ok(n.ok);
  assert.deepEqual(Object.keys(n.notizen), ["1", "2"]);
  assert.match(n.notizen[2], /^NOTIZ-GEHEIM-2: erst klicken, dann fragen\.\nErwartet: dem Bruder\.$/);

  // limits: table at most 4 columns, every row as wide; unknown step numbers dropped
  const tabelle = deck.folien[1].bloecke.find((b) => b.art === "tabelle")!;
  assert.deepEqual(tabelle.zeilen.map((z) => z.length), [4, 4, 4]);
  assert.deepEqual(deck.folien[1].schritt_ids, [102]);
  assert.ok(!deck.folien[1].bloecke.some((b) => b.art === "beispiel"), "ein leerer Block fällt weg");
});

test("Erstellen: nur aus einem geprüften Paket, keine Schülerdaten, Namen ersetzt; Übernehmen speichert wie ein Upload und setzt die Folien", async () => {
  const s = await setup();
  const pk = await import("./praesentation-ki");
  const praes = await import("./praesentationen");
  const ki = await mitKi(() => ANTWORT());
  try {
    const entwurf = await pk.erstellePraesEntwurf(s.paketId, s.niko.id);
    assert.ok(!entwurf.ok && /geprüften Lernpaket/.test(entwurf.error));
    assert.equal(ki.gefragt.length, 0, "ein Entwurf fragt die KI nicht");

    assert.ok("ok" in s.lp.markiereGeprueft(s.paketId, s.niko.id, { hinweiseGeprueft: true }));
    const r = await pk.erstellePraesEntwurf(s.paketId, s.niko.id);
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(ki.gefragt.length, 1);
    const req = ki.gefragt[0];
    assert.equal(req.fn, "praesentation");
    const gesendet = JSON.stringify([req.system, req.content]);
    assert.ok(gesendet.includes("Wie fragst du nach dem dritten Fall?") && gesendet.includes("Wem oder was fragt man im dritten Fall") && gesendet.includes("Satz umstellen."));
    assert.ok(gesendet.includes("zeigt bisher Folie 4"));
    assert.ok(!/PRIVAT-|INTERNE-NOTIZ|Pichlbauer|Ronja/.test(gesendet), "keine Schülerdaten, keine interne Notiz, Namen ersetzt");
    assert.ok(gesendet.includes("[Name] gibt ihrem Bruder"));
    const log = s.db().prepare("SELECT fn, student_id, unit_id, cost_usd FROM ai_calls").all() as { fn: string; student_id: number | null; unit_id: number | null; cost_usd: number }[];
    assert.deepEqual(log.map((l) => [l.fn, l.student_id, l.unit_id]), [["praesentation", null, null]]);
    assert.ok(log[0].cost_usd > 0);

    // the proposal: nothing saved as a presentation yet, nothing changed in the package
    const e = pk.offenerPraesEntwurf(s.paketId)!;
    assert.equal(e.id, r.id);
    assert.equal(praes.listPraesentationen().length, 0);
    assert.equal(s.lp.getLernpaket(s.paketId)!.schritte[0].folie, 4);
    assert.ok(e.deck.folien[1].pruefen.some((p) => /erwartete Antwort von Schritt 2/.test(p)), "die erwartete Antwort auf einer Folie wird zum Prüfen angeboten");

    const u = pk.uebernimmPraesEntwurf(e.id, s.niko.id);
    assert.ok("ok" in u, JSON.stringify(u));
    const p = praes.getPraesentation(u.praesId)!;
    assert.equal(p.quelle, "ki");
    assert.ok(praes.praesUngeprueft(p));
    assert.equal(p.ki_call_id, e.call_id);
    assert.deepEqual(p.extern, []);
    assert.equal(p.fach, "Deutsch");
    assert.equal(p.title, "Fälle <b>fett</b>", "der Titel steht als Text in der Datenbank; React escapt ihn");
    assert.deepEqual(Object.keys(p.notizen), ["1", "2"]);
    // served files: only index.html, without the notes
    const datei = praes.deckDatei(p.token, ["index.html"])!;
    assert.ok(datei && !datei.daten.toString("utf8").includes("NOTIZ-GEHEIM"));
    assert.equal(praes.deckDatei(p.token, ["lernheft-notizen.json"]), null);
    // linked, slide numbers set: step 1 → slide 1, step 2 → slide 2, step 3 had only an empty slide → none
    const paket = s.lp.getLernpaket(s.paketId)!;
    assert.equal(paket.praesentation_id, p.id);
    assert.deepEqual(paket.schritte.map((x) => x.folie), [1, 2, null]);
    assert.equal(paket.status, "geprueft");
    assert.equal(pk.getPraesEntwurf(e.id)!.status, "uebernommen");
    assert.equal(pk.offenerPraesEntwurf(s.paketId), null);
    assert.ok("fehler" in pk.uebernimmPraesEntwurf(e.id, s.niko.id), "zweimal übernehmen geht nicht");

    // checked by a teacher: the mark goes
    assert.ok(praes.markierePraesentationGeprueft(p.id, s.niko.id));
    assert.ok(!praes.praesUngeprueft(praes.getPraesentation(p.id)!));
    // an upload stays without the mark
    assert.equal(praes.praesUngeprueft({ quelle: "", geprueft_am: null }), false);

    // a new one for a package that has one: the old one stays; Verwerfen changes nothing
    const neu = await pk.erstellePraesEntwurf(s.paketId, s.niko.id);
    assert.ok(neu.ok);
    assert.deepEqual(pk.verwirfPraesEntwurf(neu.id), { paketId: s.paketId });
    assert.equal(pk.getPraesEntwurf(neu.id)!.status, "verworfen");
    assert.equal(s.lp.getLernpaket(s.paketId)!.praesentation_id, p.id);
    assert.equal(praes.listPraesentationen().length, 1);
  } finally {
    ki.aus();
  }
});

test("ein Doppelklick ist eine Anfrage; ein neuer Vorschlag legt den alten weg; eine unbrauchbare Antwort speichert nichts", async () => {
  const s = await setup();
  s.lp.markiereGeprueft(s.paketId, s.niko.id, { hinweiseGeprueft: true });
  const pk = await import("./praesentation-ki");
  const ki = await mitKi(() => ANTWORT(), { ms: 30 });
  try {
    const [a, b] = await Promise.all([pk.erstellePraesEntwurf(s.paketId, s.niko.id), pk.erstellePraesEntwurf(s.paketId, s.niko.id)]);
    assert.ok(a.ok && b.ok && a.id === b.id);
    assert.equal(ki.gefragt.length, 1);
    const c = await pk.erstellePraesEntwurf(s.paketId, s.niko.id);
    assert.ok(c.ok);
    assert.equal(pk.getPraesEntwurf(a.id)!.status, "verworfen");
    assert.equal(pk.offenerPraesEntwurf(s.paketId)!.id, c.id);
  } finally {
    ki.aus();
  }
  const leer = await mitKi(() => ({ titel: "x", folien: [{ titel: " ", bloecke: [block("text")], notiz: "", schritte: [], pruefen: [] }] }));
  try {
    const zahl = () => (s.db().prepare("SELECT COUNT(*) AS n FROM praesentation_entwuerfe").get() as { n: number }).n;
    const vorher = zahl();
    const r = await pk.erstellePraesEntwurf(s.paketId, s.niko.id);
    assert.ok(!r.ok && /keine brauchbaren Folien/.test(r.error) && /Cent gekostet/.test(r.error), JSON.stringify(r));
    assert.equal(zahl(), vorher);
  } finally {
    leer.aus();
  }
});

test("ohne KI oder mit aufgebrauchtem Budget: Meldung, keine Anfrage, nichts gespeichert", async () => {
  const s = await setup();
  s.lp.markiereGeprueft(s.paketId, s.niko.id, { hinweiseGeprueft: true });
  const pk = await import("./praesentation-ki");
  (await import("./ai/router")).setTransport(null);
  assert.match(pk.praesKiAusGrund() ?? "", /KI ist aus/);
  const aus = await pk.erstellePraesEntwurf(s.paketId, s.niko.id);
  assert.ok(!aus.ok && /KI ist aus/.test(aus.error));

  const ki = await mitKi(() => ANTWORT());
  try {
    assert.equal(pk.praesKiAusGrund(), null);
    assert.ok((await pk.erstellePraesEntwurf(s.paketId, s.niko.id)).ok);
    // the month's Anthropic budget is now smaller than what was spent
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = "0.01";
    assert.match(pk.praesKiAusGrund() ?? "", /Budget für diesen Monat ist aufgebraucht/);
    const r = await pk.erstellePraesEntwurf(s.paketId, s.niko.id);
    assert.ok(!r.ok && /Budget/.test(r.error));
    assert.equal(ki.gefragt.length, 1, "keine zweite Anfrage");
    assert.equal((s.db().prepare("SELECT COUNT(*) AS n FROM praesentation_entwuerfe").get() as { n: number }).n, 1);
  } finally {
    delete process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
    ki.aus();
  }
});

test("Kosten vor dem Klick: aus Paket und Preisliste, im manuellen Modus nichts", async () => {
  const s = await setup();
  const pk = await import("./praesentation-ki");
  const k = pk.praesKostenSchaetzung(s.lp.getLernpaket(s.paketId));
  assert.match(k.text, /^ca\. \d+–\d+ Cent$/);
  // Sonnet 5.5: 2 $ in, 10 $ out per million tokens; 12 000 to 28 000 tokens out
  assert.ok(k.usdVon > 0.12 && k.usdVon < 0.14 && k.usdBis > 0.28 && k.usdBis < 0.3, JSON.stringify(k));
  const { setKiModus, resetKiModusCache } = await import("./ai/modus");
  setKiModus("manual");
  assert.equal(pk.praesKostenSchaetzung().text, "kostet nichts (manueller Modus)");
  setKiModus("anthropic");
  resetKiModusCache();
});
