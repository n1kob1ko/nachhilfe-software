/**
 * F0b: Fehler der KI als kurzer deutscher Grund (lib/ai/grund.ts). Die Lehrkraft liest „KI gerade nicht erreichbar.“, „Budget erreicht.“
 * oder „Antwort unbrauchbar.“, nie den rohen Text des Anbieters und nie einen Schlüssel. Nur eine Attrappe statt der KI.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

test("every cause of the router has one short reason, without a provider name", async () => {
  const { kiGrundVonUrsache, KI_GRUND } = await import("./ai/grund");
  const erwartet: Record<string, string> = {
    aus: KI_GRUND.aus,
    budget: KI_GRUND.budget,
    schuelergrenze: KI_GRUND.budget,
    pausiert: KI_GRUND.nicht_erreichbar,
    zeitlimit: KI_GRUND.nicht_erreichbar,
    nicht_erreichbar: KI_GRUND.nicht_erreichbar,
    anbieter: KI_GRUND.nicht_erreichbar,
    einstellung: KI_GRUND.datei,
    unvollstaendig: KI_GRUND.unbrauchbar,
    leer: KI_GRUND.unbrauchbar,
    json: KI_GRUND.unbrauchbar,
    schema: KI_GRUND.unbrauchbar,
    verweigert: KI_GRUND.unbrauchbar,
    unbrauchbar: KI_GRUND.unbrauchbar,
  };
  for (const [cause, grund] of Object.entries(erwartet)) assert.equal(kiGrundVonUrsache(cause as never), grund, cause);
  assert.equal(KI_GRUND.nicht_erreichbar, "KI gerade nicht erreichbar.");
  assert.equal(KI_GRUND.budget, "Budget erreicht.");
  assert.equal(KI_GRUND.unbrauchbar, "Antwort unbrauchbar.");
  for (const g of Object.values(KI_GRUND)) assert.doesNotMatch(g, /Claude|Anthropic|OpenRouter|DeepSeek|OpenAI/);
});

test("stored and raw texts: JSON and long bodies never reach the teacher, the app's own sentences stay", async () => {
  const { kiGrundText, KI_GRUND } = await import("./ai/grund");
  assert.equal(kiGrundText('Die KI war nicht erreichbar (503: {"error":{"message":"overloaded","type":"overloaded_error"}}).'), KI_GRUND.nicht_erreichbar);
  assert.equal(kiGrundText('{"error":{"code":500,"message":"Internal"}}'), KI_GRUND.nicht_erreichbar);
  assert.equal(kiGrundText("x".repeat(200)), KI_GRUND.nicht_erreichbar);
  assert.equal(kiGrundText("Die KI hat nicht rechtzeitig geantwortet."), KI_GRUND.nicht_erreichbar);
  assert.equal(kiGrundText("fetch failed"), KI_GRUND.nicht_erreichbar);
  assert.equal(kiGrundText("Das KI-Budget für diesen Monat ist aufgebraucht."), KI_GRUND.budget);
  assert.equal(kiGrundText("Die KI ist ausgeschaltet oder es ist kein Schlüssel hinterlegt."), KI_GRUND.aus);
  assert.equal(kiGrundText("Die KI hat keine verwertbare Antwort geliefert."), KI_GRUND.unbrauchbar);
  assert.equal(kiGrundText("DeepSeek kann keine PDFs lesen."), KI_GRUND.datei);
  assert.equal(kiGrundText(""), KI_GRUND.unbrauchbar);
  assert.equal(kiGrundText("Die KI hat keine passenden Aufgaben geliefert."), "Die KI hat keine passenden Aufgaben geliefert.", "a sentence of the app stays");
  assert.equal(kiGrundText(KI_GRUND.budget), KI_GRUND.budget);
});

test("keys are taken out of every text for the log", async () => {
  const { ohneSchluessel, protokolliere } = await import("./ai/grund");
  const roh = "401 Authorization: Bearer abcdefghij0123456789 api_key=geheimgeheim sk-or-v1-0123456789abcdef x-api-key: 0123456789abcdef";
  const sauber = ohneSchluessel(roh);
  for (const geheim of ["abcdefghij0123456789", "geheimgeheim", "sk-or-v1-0123456789abcdef", "0123456789abcdef"]) assert.ok(!sauber.includes(geheim), `${geheim} is gone: ${sauber}`);
  assert.match(sauber, /^401 /, "the rest stays readable");
  assert.equal(ohneSchluessel(`Token ${"a".repeat(48)} Ende`), "Token […] Ende");
  assert.equal(ohneSchluessel("Die KI war nicht erreichbar (fetch failed)."), "Die KI war nicht erreichbar (fetch failed).");

  const alt = console.warn;
  const log: string[] = [];
  console.warn = (...a: unknown[]) => void log.push(a.join(" "));
  try {
    protokolliere("Test", new Error(`kaputt mit sk-ant-api03-${"x".repeat(30)}`));
  } finally {
    console.warn = alt;
  }
  assert.equal(log.length, 1);
  assert.match(log[0], /^\[KI\] Test: kaputt mit /);
  assert.ok(!log[0].includes("sk-ant"), log[0]);
});

test("unwrap throws a KiFehler with its cause; kiGrund turns any error into the short reason", async () => {
  const r = await import("./ai/router");
  const { kiGrund, KiFehler, KI_GRUND } = await import("./ai/grund");
  r.resetRouter();
  r.setTransport(async () => {
    throw new Error('503 {"error":"upstream","key":"sk-test-0123456789"}');
  });
  try {
    const out = await r.runAI("analyse", z.object({ ok: z.boolean() }), "sys", "F0b grund");
    assert.equal(out.ok, false);
    assert.ok(!out.ok && !out.message.includes("sk-test-0123456789"), "no key in the message for the cost log");
    let fehler: unknown;
    try {
      r.unwrap(out);
    } catch (e) {
      fehler = e;
    }
    assert.ok(fehler instanceof KiFehler);
    assert.equal((fehler as InstanceType<typeof KiFehler>).ursache, "nicht_erreichbar");
    assert.equal(kiGrund(fehler), KI_GRUND.nicht_erreichbar);
    assert.equal(kiGrund(out), KI_GRUND.nicht_erreichbar, "an Outcome too");
    assert.equal(kiGrund(new Error("Das KI-Budget für diesen Monat ist aufgebraucht.")), KI_GRUND.budget);
    assert.equal(kiGrund("irgendwas Kurzes"), "irgendwas Kurzes");
  } finally {
    r.setTransport(null);
  }
});
