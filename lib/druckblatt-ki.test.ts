/**
 * KI-Vorschläge für die Druckblätter (Phase 5 des Merges, Schritt 6).
 *
 * Geprüft wird: der Feature-Schlüssel `druckblatt` samt Tarif, die Aufträge (ohne API-Aufruf
 * prüfbar), die Prüfung der Antwort **gegen das Blattschema** und der Weg über
 * `lib/ai/router.ts` mit einer gestellten Antwort (kein Modell, kein Schlüssel — es wird nie eine
 * Modellantwort erfunden). Dazu der Beweis, dass ohne Anbieter nichts passiert und das Blatt von
 * Hand weitergeht.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { FUNCTIONS } from "./ai/config";
import {
  DRUCKBLATT_SYSTEM,
  buildDruckblattSpaltenPrompt,
  buildDruckblattWoerterPrompt,
  pruefeSpaltenVorschlag,
  pruefeWoerterVorschlag,
  vorschlagSpaltenMitKI,
  vorschlagWoerterMitKI,
} from "./ai/features";
import { DEFAULT_SENTENCE_BOX, DEFAULT_SENTENCE_COLUMNS } from "./druckblatt/definition/sentence-box-defaults";
import { DEFAULT_WORKSHEET } from "./druckblatt/definition/defaults";
import type { SentenceBoxDefinition } from "./druckblatt/definition/sentence-box-types";
import type { WorksheetDefinition } from "./druckblatt/definition/types";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

/** Eine gestellte Antwort über den echten Router — wie in `lib/banken-ki.test.ts`. */
async function fakeRouter<T>(answer: (prompt: string) => unknown, run: (router: typeof import("./ai/router")) => Promise<T>): Promise<T> {
  const router = await import("./ai/router");
  router.setTransport(async (p) => {
    const prompt = typeof p.content === "string" ? p.content : "";
    return {
      parsed: p.schema.parse(answer(prompt)),
      refusal: false,
      model: p.model,
      usage: { input: 700, output: 200, cacheWrite: 0, cacheRead: 0 },
      costUsd: 0.0005,
    };
  });
  try {
    return await run(router);
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
}

// ---------- der Feature-Schlüssel ----------

test("druckblatt ist als eigene Funktion im Tarif fast deklariert", () => {
  const spec = FUNCTIONS.druckblatt;
  assert.ok(spec, "der Feature-Schlüssel fehlt in lib/ai/config.ts");
  assert.equal(spec.tier, "fast", "kleine, klar umrissene Listen brauchen kein starkes Modell");
  assert.equal(spec.area, "EXERCISE");
  assert.equal(spec.realtime, false, "nur auf Klick der Lehrkraft");
  assert.equal(spec.reuseMs, 0, "kein Vorschlag darf aus dem Gedächtnis eines anderen Blattes kommen");
  assert.match(spec.label, /Blätter/);
});

// ---------- die Aufträge ----------

test("buildDruckblattWoerterPrompt: Anweisung, Anzahl, Thema und die vorhandenen Wörter", () => {
  const prompt = buildDruckblattWoerterPrompt({ anzahl: 12, thema: "Tiere", vorhandene: ["Mama", "Oma"] });
  assert.match(prompt, /Lesetabelle/);
  assert.match(prompt, /Thema oder Schwerpunkt: „Tiere“/);
  assert.match(prompt, /Liefere 12 verschiedene Wörter/);
  assert.match(prompt, /Diese Wörter stehen schon auf dem Blatt, nimm andere:/);
  assert.match(prompt, /- Mama/);
  assert.match(prompt, /\{ "woerter": \["Mama", "Oma", "Sofa"\] \}/, "die verlangte Form steht im Auftrag");
  // ohne Thema und ohne Vorhandenes bleiben die Zeilen weg
  const schlicht = buildDruckblattWoerterPrompt({ anzahl: 1 });
  assert.match(schlicht, /Liefere 1 verschiedene Wörter/);
  assert.ok(!schlicht.includes("Thema oder Schwerpunkt:"));
  assert.ok(!schlicht.includes("stehen schon auf dem Blatt"));
});

test("buildDruckblattSpaltenPrompt verlangt Artikel im Nominativ und die vier Felder", () => {
  const prompt = buildDruckblattSpaltenPrompt({ verben: 3, objekte: 6, person: "ich", vorhandene: ["der Hund"] });
  assert.match(prompt, /Satzbaukasten/);
  assert.match(prompt, /bestimmte Artikel im Nominativ/);
  assert.match(prompt, /Liefere 3 Verben und 6 Objekte sowie 6 Subjekte/);
  for (const feld of ["subjekte", "verben", "objekte", "hinweis"]) assert.ok(prompt.includes(`"${feld}"`), `Feld ${feld} fehlt`);
  assert.match(prompt, /- der Hund/);
});

test("die Systemanweisung sagt, dass nur Inhalte kommen und nichts erfunden wird", () => {
  assert.match(DRUCKBLATT_SYSTEM, /nur die Inhalte/);
  assert.match(DRUCKBLATT_SYSTEM, /ausschließlich mit dem verlangten JSON-Objekt/);
  assert.ok(!DRUCKBLATT_SYSTEM.includes("[HIER"));
});

// ---------- die Prüfung gegen das Blattschema ----------

test("pruefeWoerterVorschlag: gültige Wörter werden übernommen, getrennt an Komma und Zeile", () => {
  const ergebnis = pruefeWoerterVorschlag({ woerter: ["Mama, Oma", "Sofa; Nase"] }, DEFAULT_WORKSHEET);
  assert.equal(ergebnis.ok, true);
  if (!ergebnis.ok) return;
  assert.deepEqual(ergebnis.woerter, ["Mama", "Oma", "Sofa", "Nase"]);
  assert.deepEqual(ergebnis.definition.content, { kind: "wordList", words: ["Mama", "Oma", "Sofa", "Nase"] });
  assert.equal(ergebnis.definition.title, DEFAULT_WORKSHEET.title, "der Rest des Blattes bleibt");
});

test("pruefeWoerterVorschlag: falsche Form, leere Liste und ein Blatt, das das Schema verletzt, werden abgelehnt", () => {
  const form = pruefeWoerterVorschlag({ woerter: "Mama" }, DEFAULT_WORKSHEET);
  assert.equal(form.ok, false);
  if (!form.ok) assert.match(form.fehler, /keine Wortliste/);

  const leer = pruefeWoerterVorschlag({ woerter: ["   ", ""] }, DEFAULT_WORKSHEET);
  assert.equal(leer.ok, false);
  if (!leer.ok) assert.match(leer.fehler, /leere Wortliste/);

  // die Definition selbst verletzt das Blattschema (Spaltenzahl): der Vorschlag darf nicht durch
  const kaputt: WorksheetDefinition = { ...DEFAULT_WORKSHEET, grid: { ...DEFAULT_WORKSHEET.grid, columns: 99 } };
  const geprueft = pruefeWoerterVorschlag({ woerter: ["Mama"] }, kaputt);
  assert.equal(geprueft.ok, false);
  if (!geprueft.ok) assert.match(geprueft.fehler, /passt nicht zum Blatt: .*Spalten/);
});

test("pruefeSpaltenVorschlag: Einträge gehen nach Rolle in die vorhandenen Spalten, keine kommt zurück", () => {
  const ohneVerben: SentenceBoxDefinition = { ...DEFAULT_SENTENCE_BOX, columns: DEFAULT_SENTENCE_COLUMNS.filter((s) => s.role !== "verb") };
  const ergebnis = pruefeSpaltenVorschlag(
    { subjekte: ["der Hund"], verben: ["läuft"], objekte: ["der Ball", "die Blume"], hinweis: "Übt den Akkusativ." },
    ohneVerben,
  );
  assert.equal(ergebnis.ok, true);
  if (!ergebnis.ok) return;
  const nach = new Map(ergebnis.definition.columns.map((s) => [s.role, s.entries]));
  assert.deepEqual(nach.get("subjekt"), ["der Hund"]);
  assert.deepEqual(nach.get("objekt"), ["der Ball", "die Blume"]);
  assert.equal(ergebnis.definition.columns.length, ohneVerben.columns.length, "eine gelöschte Spalte kommt nicht zurück");
  assert.equal(ergebnis.eingetragen, 2);
});

test("pruefeSpaltenVorschlag: nichts für die vorhandenen Rollen oder ein ungültiges Blatt wird abgelehnt", () => {
  const nurVerb: SentenceBoxDefinition = { ...DEFAULT_SENTENCE_BOX, columns: DEFAULT_SENTENCE_COLUMNS.filter((s) => s.role === "verb") };
  const nichts = pruefeSpaltenVorschlag({ subjekte: ["der Hund"], verben: [], objekte: [], hinweis: "x" }, nurVerb);
  assert.equal(nichts.ok, false);
  if (!nichts.ok) assert.match(nichts.fehler, /nichts geliefert/);

  // sechs Spalten verletzen das Schema (höchstens fünf)
  const zuViele: SentenceBoxDefinition = {
    ...DEFAULT_SENTENCE_BOX,
    columns: [
      ...DEFAULT_SENTENCE_COLUMNS,
      { id: "extra1", role: "ergaenzung", heading: "", entries: [], kasus: "nominativ", article: "ohne" },
      { id: "extra2", role: "ergaenzung", heading: "", entries: [], kasus: "nominativ", article: "ohne" },
      { id: "extra3", role: "ergaenzung", heading: "", entries: [], kasus: "nominativ", article: "ohne" },
    ],
  };
  const geprueft = pruefeSpaltenVorschlag({ subjekte: ["der Hund"], verben: [], objekte: [], hinweis: "x" }, zuViele);
  assert.equal(geprueft.ok, false);
  if (!geprueft.ok) assert.match(geprueft.fehler, /passt nicht zum Blatt/);
});

// ---------- der Weg über den Router (gestellte Antwort) ----------

test("vorschlagWoerterMitKI: geprüfte Wörter kommen an, der Auftrag steht im Aufruf, die Kosten werden als druckblatt verbucht", async () => {
  const { db } = await import("./db");
  const gesehen: string[] = [];
  const ergebnis = await fakeRouter(
    (prompt) => {
      gesehen.push(prompt);
      return { woerter: ["Mama", "Oma", "Sofa"] };
    },
    () => vorschlagWoerterMitKI({ grundlage: DEFAULT_WORKSHEET, anzahl: 3, thema: "Familie", meta: { trigger: "test-druckblatt" } }),
  );
  assert.equal(gesehen.length, 1, "genau eine Anfrage");
  assert.match(gesehen[0], /Liefere 3 verschiedene Wörter/);
  assert.match(gesehen[0], /Thema oder Schwerpunkt: „Familie“/);
  assert.equal(ergebnis.ok, true);
  if (!ergebnis.ok || !("woerter" in ergebnis)) return;
  assert.deepEqual(ergebnis.woerter, ["Mama", "Oma", "Sofa"]);
  assert.deepEqual(ergebnis.definition.content, { kind: "wordList", words: ["Mama", "Oma", "Sofa"] });

  const ruf = db().prepare("SELECT fn, tier, status FROM ai_calls WHERE fn = 'druckblatt' ORDER BY id DESC LIMIT 1").get() as { fn: string; tier: string; status: string } | undefined;
  assert.ok(ruf, "der Aufruf wird protokolliert");
  assert.equal(ruf.tier, "fast");
  assert.equal(ruf.status, "ok");
});

test("vorschlagSpaltenMitKI: der Vorschlag wird gegen das Blattschema geprüft, bevor er zurückkommt", async () => {
  const gut = await fakeRouter(
    () => ({ subjekte: ["der Hund"], verben: ["läuft"], objekte: ["der Ball"], hinweis: "Akkusativ üben" }),
    () => vorschlagSpaltenMitKI({ grundlage: DEFAULT_SENTENCE_BOX, verben: 1, objekte: 1 }),
  );
  assert.equal(gut.ok, true);
  if (gut.ok) assert.equal(gut.eingetragen, 3, "Subjekt, Verb und Objekt bekommen Einträge");

  // dieselbe Antwort, aber das Blatt verletzt das Schema: der Vorschlag wird abgelehnt, nicht gezeigt
  const zuViele: SentenceBoxDefinition = {
    ...DEFAULT_SENTENCE_BOX,
    columns: [
      ...DEFAULT_SENTENCE_COLUMNS,
      { id: "extra1", role: "ergaenzung", heading: "", entries: [], kasus: "nominativ", article: "ohne" },
      { id: "extra2", role: "ergaenzung", heading: "", entries: [], kasus: "nominativ", article: "ohne" },
      { id: "extra3", role: "ergaenzung", heading: "", entries: [], kasus: "nominativ", article: "ohne" },
    ],
  };
  const schlecht = await fakeRouter(
    () => ({ subjekte: ["der Hund"], verben: ["läuft"], objekte: ["der Ball"], hinweis: "Akkusativ üben" }),
    () => vorschlagSpaltenMitKI({ grundlage: zuViele, verben: 1, objekte: 1 }),
  );
  assert.equal(schlecht.ok, false);
  if (!schlecht.ok) assert.match(schlecht.fehler, /passt nicht zum Blatt/);
  assert.ok(!("definition" in (schlecht as object)), "eine ungültige Definition wird nicht zurückgegeben");
});

test("eine Antwort in falscher Form wird abgelehnt und nie zu einem Blatt", async () => {
  const leer = await fakeRouter(
    () => ({ woerter: [] }),
    () => vorschlagWoerterMitKI({ grundlage: DEFAULT_WORKSHEET, anzahl: 4 }),
  );
  assert.equal(leer.ok, false);
  if (!leer.ok) assert.ok(leer.fehler.length > 5, "es kommt eine Meldung, kein leeres Blatt");
  assert.ok(!("definition" in (leer as object)));
});

// ---------- ohne Anbieter ----------

test("ohne KI-Schlüssel passiert nichts — und das wird gesagt, statt etwas zu erfinden", async () => {
  const router = await import("./ai/router");
  router.setTransport(null);
  router.resetRouter();
  assert.equal(router.aiEnabled("druckblatt"), false);

  const woerter = await vorschlagWoerterMitKI({ grundlage: DEFAULT_WORKSHEET, anzahl: 8 });
  assert.equal(woerter.ok, false);
  if (!woerter.ok) assert.match(woerter.fehler, /ausgeschaltet|Schlüssel/);
  assert.ok(!("definition" in (woerter as object)), "ohne Schlüssel entsteht kein Vorschlag");

  const spalten = await vorschlagSpaltenMitKI({ grundlage: DEFAULT_SENTENCE_BOX, verben: 2, objekte: 2 });
  assert.equal(spalten.ok, false);
  if (!spalten.ok) assert.match(spalten.fehler, /ausgeschaltet|Schlüssel/);
});
