/**
 * Der manuelle KI-Modus (ADR 0009): eine Anfrage wird geparkt statt gesendet, der Prompt wird
 * namensgeschützt angezeigt, die eingefügte Antwort läuft durch dieselbe Extraktion, Reparatur und
 * Schema-Prüfung wie eine Antwort über die API.
 *
 * Geprüft wird der ganze Weg über `runAI` (parken, gültige und unbrauchbare Antwort, Abbruch, Frist),
 * die Namensmaske des angezeigten Prompts, die Auswahl des Anbieters über `AI_PROVIDER`,
 * `AI_<BEREICH>_PROVIDER` und den Schalter `ki_modus`, die Nullkosten im Protokoll sowie
 * `extractJsonText` für sich. Jede Antwort in dieser Datei ist ein selbst geschriebenes Beispiel:
 * es gibt keinen Schlüssel und keine Anfrage nach außen.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { FUNCTIONS, MANUAL_MODEL, MANUAL_TIMEOUT_MS, routeFor, type AIFunction } from "./ai/config";
import { budgetState, callById, logCall, monthSpend } from "./ai/log";
import { KI_MODUS_SCHLUESSEL, kiModus, resetKiModusCache, setKiModus } from "./ai/modus";
import { providerReady, type AIRequest, type Prompt } from "./ai/providers";
import { answerManual, cancelManual, extractJsonText, manualTransport, pendingManual, resetManualForTests } from "./ai/providers/manual";
import { breakerState, resetRouter, runAI, setTransport } from "./ai/router";
import { db } from "./db";
import { detectNames } from "./name-detection";
import { maskText, namePattern } from "./text-correction-core";

process.env.DATABASE_PATH = ":memory:";

/** Alles, was diese Datei an Vorgaben setzt — vor und nach jedem Fall wieder entfernt. */
const ENV = [
  "AI_PROVIDER",
  "AI_REALTIME_PROVIDER",
  "AI_EXERCISE_PROVIDER",
  "AI_ANALYSIS_PROVIDER",
  "AI_DEEP_PROVIDER",
  "AI_MATERIAL_PROVIDER",
  "AI_TEXT_PROVIDER",
  "AI_REALTIME_MODEL",
  "AI_EXERCISE_MODEL",
  "AI_ANALYSIS_MODEL",
  "AI_DEEP_MODEL",
  "AI_MATERIAL_MODEL",
  "AI_TEXT_MODEL",
  "AI_MODEL_FAST",
  "AI_MODEL_STANDARD",
  "AI_MODEL_DEEP",
  "AI_MONTHLY_BUDGET_EUR",
  "AI_MONTHLY_BUDGET_USD",
  "AI_DISABLED",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "OPENROUTER_API_KEY",
  "DEEPSEEK_API_KEY",
  "AI_COMPATIBLE_API_KEY",
  "AI_COMPATIBLE_BASE_URL",
];

/**
 * Ein Testfall mit frischem Zustand: keine Umgebungsvorgaben, leeres Register, offener Notschalter,
 * Modus „api“. Nach dem Lauf dasselbe noch einmal, damit nichts in den nächsten Fall leckt.
 */
function fall(name: string, run: () => Promise<void>) {
  test(name, async () => {
    const frisch = () => {
      for (const k of ENV) delete process.env[k];
      resetManualForTests();
      setTransport(null);
      resetRouter();
      setKiModus("api");
      resetKiModusCache();
    };
    frisch();
    try {
      await run();
    } finally {
      frisch();
      // der künstliche Budget-Eintrag dieses Tests gehört nicht in die nächsten Fälle
      db().prepare("DELETE FROM ai_calls WHERE cost_usd > 0").run();
    }
  });
}

/** Startet `runAI` und gibt die geparkte Anfrage zurück; der wartende Aufruf läuft weiter. */
async function parke<S extends z.ZodType>(fn: AIFunction, schema: S, system: string, prompt: Prompt) {
  const laeuft = runAI(fn, schema, system, prompt, { meta: { trigger: "test-manuell" } });
  await Promise.resolve();
  const anfragen = pendingManual();
  assert.equal(anfragen.length, 1, "manuell: genau eine Anfrage steht offen");
  return { laeuft, anfrage: anfragen[0] };
}

// ---------- der Weg hin und zurück ----------

fall("Hin und zurück: eine eingefügte, gültige Antwort löst den wartenden Aufruf auf", async () => {
  process.env.AI_PROVIDER = "manual";
  const Schema = z.object({ ok: z.boolean(), anzahl: z.number() });
  const system = "Anweisung für den Test: Antworte knapp und nur mit JSON.";
  const aufgabe = "Schreibe zwei Sätze über den Herbst in einfacher Sprache.";
  const { laeuft, anfrage } = await parke("block", Schema, system, aufgabe);

  assert.equal(anfrage.fn, "block");
  assert.equal(anfrage.label, "Blockauswertung");
  assert.equal(anfrage.problem, undefined);
  // der Prompt ist vollständig: Anweisung, Aufgabentext und das verlangte Schema
  assert.ok(anfrage.prompt.includes(system), "die Systemanweisung steht im Prompt");
  assert.ok(anfrage.prompt.includes(aufgabe), "der Aufgabentext steht im Prompt");
  assert.ok(anfrage.prompt.includes("JSON-Schema"), "das verlangte Schema wird erklärt");
  assert.ok(anfrage.prompt.includes('"anzahl"'), "die Felder des Schemas stehen im Prompt");

  // kopiert wie aus einem Chatfenster: Vorrede, Codezaun, Nachsatz
  const antwort = 'Klar, hier das JSON:\n```json\n{"ok": true, "anzahl": 2}\n```\nViel Erfolg!';
  assert.deepEqual(answerManual(anfrage.id, antwort), { ok: true });

  const out = await laeuft;
  assert.equal(out.ok, true, "der wartende Aufruf endet mit einem Ergebnis");
  assert.deepEqual(out.ok ? out.data : null, { ok: true, anzahl: 2 });
  assert.equal(out.ok && out.reused, false);
  assert.deepEqual(pendingManual(), [], "nach der Antwort steht nichts mehr offen");
});

fall("Unbrauchbare Antworten: deutscher Grund, die Anfrage bleibt für einen zweiten Versuch offen", async () => {
  process.env.AI_PROVIDER = "manual";
  const { laeuft, anfrage } = await parke("block", z.object({ ok: z.boolean() }), "sys", "frage");

  const ohneJson = answerManual(anfrage.id, "Der Herbst ist eine schöne Jahreszeit.");
  assert.equal(ohneJson.ok, false);
  assert.equal(!ohneJson.ok && ohneJson.fehler, "In der Antwort steckt kein JSON. Bitte die ganze Antwort des Modells einfügen.");
  assert.equal(pendingManual().length, 1, "die Anfrage bleibt offen");
  assert.equal(pendingManual()[0].problem, !ohneJson.ok && ohneJson.fehler, "der Grund steht an der Anfrage");

  const falscheForm = answerManual(anfrage.id, '{"ok": "vielleicht"}');
  assert.equal(falscheForm.ok, false);
  assert.match(!falscheForm.ok ? falscheForm.fehler : "", /passt nicht zur Form/);
  assert.equal(pendingManual().length, 1, "auch danach bleibt sie offen");

  const leer = answerManual(anfrage.id, "   ");
  assert.equal(!leer.ok && leer.fehler, "Es wurde keine Antwort eingefügt.");

  // eine unbekannte Kennung kann nichts mehr auflösen
  assert.equal(!answerManual("m-gibt-es-nicht", "{}").ok, true);

  // erst die passende Antwort schließt die Anfrage
  assert.deepEqual(answerManual(anfrage.id, '```json\n{"ok": true}\n```'), { ok: true });
  const out = await laeuft;
  assert.deepEqual(out.ok ? out.data : null, { ok: true });
});

fall("Reparierbare Antwort: dieselbe Nachsicht wie bei einer Antwort über die API", async () => {
  process.env.AI_PROVIDER = "manual";
  const { laeuft, anfrage } = await parke("analyse", z.object({ anzahl: z.number(), liste: z.array(z.string()) }), "sys", "frage");
  // Zahl als Text und die leere Liste weggelassen: beides repariert `parseLenient` wie sonst auch
  assert.deepEqual(answerManual(anfrage.id, '{"anzahl": "3"}'), { ok: true });
  const out = await laeuft;
  assert.deepEqual(out.ok ? out.data : null, { anzahl: 3, liste: [] });
});

fall("Abbruch: der wartende Aufruf endet als Fehlschlag, ein zweiter Abbruch ist wirkungslos", async () => {
  process.env.AI_PROVIDER = "manual";
  const { laeuft, anfrage } = await parke("aufgaben", z.object({ ok: z.boolean() }), "sys", "frage");

  assert.equal(cancelManual(anfrage.id), true);
  const out = await laeuft;
  assert.equal(out.ok, false, "kein Hängen: der Aufruf endet");
  assert.equal(!out.ok && out.status, "abgelehnt");
  assert.equal(!out.ok && out.cause, "leer");
  assert.match(!out.ok ? out.message : "", /verwertbare Antwort/);
  assert.equal(cancelManual(anfrage.id), false, "ein zweiter Abbruch tut nichts");
  assert.deepEqual(pendingManual(), []);
  assert.equal(breakerState().failures, 0, "ein verworfenes Parken zählt nicht als Ausfall");
});

fall("Ein bereits abgebrochenes Signal lässt den Transport nicht hängen", async () => {
  const req: AIRequest = {
    fn: "block",
    provider: "manual",
    model: MANUAL_MODEL,
    maxTokens: 100,
    system: "sys",
    cache: "aus",
    content: "frage",
    thinking: "aus",
    effort: "low",
    schema: z.object({ ok: z.boolean() }),
    signal: AbortSignal.abort(),
    timeoutMs: MANUAL_TIMEOUT_MS,
  };
  let uhr: ReturnType<typeof setTimeout> | undefined;
  try {
    const ergebnis = await Promise.race([
      manualTransport(req),
      new Promise<never>((_, ablehnen) => {
        uhr = setTimeout(() => ablehnen(new Error("der Transport hängt")), 2_000);
      }),
    ]);
    assert.equal(ergebnis.parsed, null, "ein Abbruch liefert keine Daten");
    assert.match(ergebnis.problem ?? "", /abgebrochen/);
  } finally {
    if (uhr) clearTimeout(uhr);
  }
  assert.deepEqual(pendingManual(), [], "nichts wird geparkt");
});

fall("Frist: 30 Minuten statt der API-Zeit; eine abgelaufene Anfrage endet von selbst", async () => {
  process.env.AI_PROVIDER = "manual";
  const { laeuft, anfrage } = await parke("block", z.object({ ok: z.boolean() }), "sys", "frage");

  assert.equal(anfrage.expiresAt - anfrage.createdAt, MANUAL_TIMEOUT_MS);
  assert.equal(MANUAL_TIMEOUT_MS / 60_000, 30, "die Frist steht in Minuten");
  assert.notEqual(anfrage.expiresAt - anfrage.createdAt, FUNCTIONS.block.timeoutMs, "nicht die Zeit der Funktion (30 s)");

  // der Ablauf wird beim Abruf abgewickelt — dafür müssen keine 30 Minuten vergehen
  assert.deepEqual(pendingManual(anfrage.expiresAt + 1), [], "abgelaufene Anfragen stehen nicht mehr an");
  const out = await laeuft;
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.cause, "leer", "eine abgelaufene Anfrage ist kein Ausfall");
});

// ---------- Namensschutz ----------

fall("Der angezeigte Prompt ist namensgeschützt", async () => {
  process.env.AI_PROVIDER = "manual";
  const system = "Du hilfst der Lehrkraft bei der Auswertung.";
  const text = "Lena Hofer hat den Text geschrieben. Frau Novak hat ihn geprüft.";
  const { laeuft, anfrage } = await parke("freitext", z.object({ ok: z.boolean() }), system, text);

  // die Namen findet die App mit denselben Regeln wie beim Senden
  const namen = detectNames([text]);
  assert.deepEqual(namen, ["Lena", "Hofer", "Novak"]);
  const erwartet = maskText(text, namePattern(namen)).masked;
  assert.ok(anfrage.prompt.includes(erwartet), "der Aufgabentext steht maskiert im Prompt");
  assert.ok(anfrage.prompt.includes("[Name]"), "die Namen sind durch [Name] ersetzt");
  for (const name of ["Lena", "Hofer", "Novak"]) assert.ok(!anfrage.prompt.includes(name), `${name} steht noch im angezeigten Prompt`);

  cancelManual(anfrage.id);
  await laeuft;
});

// ---------- Auswahl und Grenzen ----------

fall("Auswahl: AI_PROVIDER, AI_<BEREICH>_PROVIDER und der Schalter ki_modus", async () => {
  assert.equal(providerReady("manual"), true, "manuell braucht keinen Schlüssel");
  assert.equal(providerReady("anthropic"), false);

  process.env.AI_PROVIDER = "manual";
  for (const fn of ["aufgaben", "block", "echtzeit", "lesen"] as const) {
    assert.equal(routeFor(fn).provider, "manual", fn);
    assert.equal(routeFor(fn).model, MANUAL_MODEL, fn);
    assert.equal(routeFor(fn).area, FUNCTIONS[fn].area, fn);
  }

  delete process.env.AI_PROVIDER;
  process.env.AI_REALTIME_PROVIDER = "manual";
  assert.equal(routeFor("echtzeit").provider, "manual", "der Bereich reicht");
  assert.equal(routeFor("echtzeit").model, MANUAL_MODEL);
  assert.equal(routeFor("aufgaben").provider, "anthropic", "andere Bereiche bleiben unberührt");

  delete process.env.AI_REALTIME_PROVIDER;
  // der Schalter auf Mehr › KI-Kosten: `ki_modus` in `app_settings`
  setKiModus("manual");
  resetKiModusCache();
  assert.equal(kiModus(), "manual");
  assert.equal(routeFor("aufgaben").provider, "manual");
  assert.equal(routeFor("aufgaben").model, MANUAL_MODEL);
  const row = db().prepare("SELECT value FROM app_settings WHERE key = ?").get(KI_MODUS_SCHLUESSEL) as { value: string } | undefined;
  assert.equal(row?.value, "manual");

  // Umgebungsvariablen haben Vorrang vor dem Schalter
  process.env.AI_ANALYSIS_PROVIDER = "deepseek";
  assert.equal(routeFor("block").provider, "deepseek");
  assert.equal(routeFor("aufgaben").provider, "manual", "ohne Bereichsvorgabe gilt der Schalter");
});

fall("Grenzen: ein Bild kann der manuelle Modus nicht annehmen", async () => {
  process.env.AI_PROVIDER = "manual";
  const out = await runAI("material", z.object({ ok: z.boolean() }), "sys", [{ type: "image", mime: "image/png", base64: "AAAA" }]);
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.cause, "einstellung");
  assert.match(!out.ok ? out.message : "", /keine Bilder lesen/);
  assert.deepEqual(pendingManual(), [], "ein Bild wird nicht geparkt");
});

// ---------- Kosten ----------

fall("Nullkosten: die Antwort steht im Protokoll, kostet aber nichts", async () => {
  process.env.AI_PROVIDER = "manual";
  const vorher = monthSpend();
  const { laeuft, anfrage } = await parke("block", z.object({ ok: z.boolean() }), "sys", "frage");
  assert.deepEqual(answerManual(anfrage.id, '{"ok": true}'), { ok: true });

  const out = await laeuft;
  assert.equal(out.ok, true);
  const id = out.ok ? out.callId : null;
  assert.notEqual(id, null, "die Antwort steht im Protokoll");
  const row = callById(id!);
  assert.ok(row);
  assert.equal(row.cost_usd, 0);
  assert.equal(row.input_tokens, 0);
  assert.equal(row.output_tokens, 0);
  assert.equal(row.model, MANUAL_MODEL);
  assert.equal(row.status, "ok");
  assert.equal(monthSpend(), vorher, "die Monatssumme wächst nicht");
});

fall("Ein aufgebrauchtes Budget hält den manuellen Modus nicht auf", async () => {
  process.env.AI_PROVIDER = "manual";
  // ein teurer Eintrag im Protokoll: das Monatsbudget ist damit aufgebraucht
  logCall({ fn: "tiefenanalyse", tier: "deep", model: "claude-opus-5-5", teacherId: null, unitId: null, trigger: "test-manuell-budget", input: 1_000_000, output: 0, cacheWrite: 0, cacheRead: 0, durationMs: 1, costUsd: 999, status: "ok" });
  assert.equal(budgetState().level, "aus", "das Budget ist aufgebraucht");

  const { laeuft, anfrage } = await parke("block", z.object({ ok: z.boolean() }), "sys", "frage");
  assert.deepEqual(answerManual(anfrage.id, '{"ok": true}'), { ok: true });
  assert.equal((await laeuft).ok, true, "manuell läuft trotz aufgebrauchtem Budget");
});

fall("Ein pausierter Anbieter hält den manuellen Modus nicht auf", async () => {
  // Notschalter: drei Fehlschläge in Folge pausieren die KI
  process.env.AI_PROVIDER = "anthropic";
  process.env.ANTHROPIC_API_KEY = "test";
  setTransport(async () => {
    throw new Error("Netzwerk weg");
  });
  for (const frage of ["a", "b", "c"]) await runAI("verbindungstest", z.object({ ok: z.boolean() }), "sys", frage);
  assert.equal(breakerState().paused, true, "die KI pausiert");

  process.env.AI_PROVIDER = "manual";
  setTransport(null);
  const { laeuft, anfrage } = await parke("block", z.object({ ok: z.boolean() }), "sys", "frage manuell");
  assert.deepEqual(answerManual(anfrage.id, '{"ok": true}'), { ok: true });
  assert.equal((await laeuft).ok, true, "manuell läuft auch bei pausierter KI");
});

// ---------- JSON in einer eingefügten Antwort finden ----------

test("extractJsonText: Codezaun, Vorrede, Denkspur, Klammern im Text und der Leerfall", () => {
  assert.equal(extractJsonText('Hier das Ergebnis:\n```json\n{\n  "a": 1\n}\n```\nViel Erfolg!'), '{\n  "a": 1\n}');
  assert.equal(extractJsonText("```\n[1, 2]\n```"), "[1, 2]");
  assert.equal(extractJsonText('Klar! Das JSON lautet: {"ok": true} — bitte prüfen.'), '{"ok": true}');
  assert.equal(extractJsonText('{"text": "ein { und } darin", "ok": true}'), '{"text": "ein { und } darin", "ok": true}');
  assert.equal(extractJsonText('{"verschachtelt": {"a": [1, 2]}, "ok": true} Ende'), '{"verschachtelt": {"a": [1, 2]}, "ok": true}');
  assert.equal(extractJsonText('Vorher: {"x": 1} nachher {"y": 2}'), '{"x": 1}');
  // Denkspuren von Qwen3 und DeepSeek-R1 fliegen vorher raus (spitze Klammern escaped geschrieben)
  assert.equal(extractJsonText('\u003cthink\u003eIch überlege {"kurz": 1} und verwerfe es.\u003c/think\u003e{"ok": true}'), '{"ok": true}');
  assert.equal(extractJsonText('\u003cTHINK\u003ea\u003c/THINK\u003e{"ok": true}'), '{"ok": true}');
  // nichts zu holen
  assert.equal(extractJsonText("Keine Antwort vom Modell."), null);
  assert.equal(extractJsonText(""), null);
  assert.equal(extractJsonText('{"a": 1'), null, "unvollständiges JSON ergibt nichts");
  assert.equal(extractJsonText("```json\nkein json\n```"), null);
});
