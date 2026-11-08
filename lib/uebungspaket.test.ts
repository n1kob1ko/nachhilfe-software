/**
 * Übungspaket aus Erkenntnissen (niko, 08.11.2026): offene Fehler ankreuzen → Paket als Übung im Entwurf → gelöst → auswerten
 * → behobene Fehler erledigt, neue dazu → nächstes Paket. Kein Schlüssel, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import type { PaketAuswertungGelesen } from "./ai/uebungspaket";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const ARTIKEL = "deutsch.grammatik.artikel";

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { speichereErkenntnisse, listErkenntnisse } = await import("./erkenntnisse");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lorenz Beispiel", grade: 5, klasse: 1, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  assert.ok(repo.getSkill(ARTIKEL), "the skill exists");
  speichereErkenntnisse({
    studentId: sid,
    subject: "Deutsch",
    teacherId: teacher.id,
    quelle: "blatt",
    zeilen: [
      { art: "fehler", text: "Kennt den Artikel bei die Wand, das Gemüse nicht", skillId: ARTIKEL, fehlerart: "wortschatz" },
      { art: "fehler", text: "Liest Aufgabenstellungen nicht genau", skillId: null, fehlerart: "gelesen" },
      { art: "staerke", text: "Sätze mit weil" },
    ],
  });
  const [wand, lesen] = listErkenntnisse(sid, { art: "fehler" }).reverse();
  return { repo, teacher, sid, wand, lesen };
}

test("the package names every chosen pattern word for word, what does not come any more and what is already sure", async () => {
  const { paketAuftrag } = await import("./uebungspaket");
  const a = paketAuftrag({ nr: 2, muster: [{ text: "Bestimmt den Fall über den Begleiter", skill_id: null }, { text: "Erkennt das Perfekt nicht", skill_id: null }], nichtMehr: "Geschichte zu Ende schreiben", staerken: ["Wo/Wohin"] });
  assert.match(a, /Übungspaket 2/);
  assert.match(a, /1\. Bestimmt den Fall über den Begleiter\n2\. Erkennt das Perfekt nicht/);
  assert.match(a, /Nicht üben, kommt nicht mehr: Geschichte zu Ende schreiben/);
  assert.match(a, /Schon sicher, nicht üben: Wo\/Wohin/);
});

test("a package is a draft exercise with its patterns; the next one counts on and remembers what does not come", async () => {
  const { repo, teacher, sid, wand, lesen } = await setup();
  const { erstellePaket, paketeVon, paketVorschlag } = await import("./uebungspaket");
  const v = paketVorschlag(sid);
  assert.equal(v.fach, "Deutsch");
  assert.equal(v.nr, 1);
  assert.deepEqual(v.offen.map((e) => e.id).sort(), [wand.id, lesen.id].sort());
  await assert.rejects(erstellePaket({ studentId: sid, teacherId: teacher.id, fach: "Deutsch", erkenntnisIds: [], nichtMehr: "", anzahl: 8 }), /mindestens einen Fehler/);

  const out = await erstellePaket({ studentId: sid, teacherId: teacher.id, fach: "Deutsch", erkenntnisIds: [wand.id, lesen.id, 9999], nichtMehr: "Geschichte zu Ende schreiben", anzahl: 8 });
  const w = repo.getWorksheet(out.worksheetId)!;
  assert.equal(w.status, "entwurf");
  assert.equal(w.title, "Lorenz – Übungspaket 1");
  assert.deepEqual(w.skill_ids, [ARTIKEL], "the skills come from the patterns");
  assert.equal(repo.listTasks(w.id).length, 8);
  const s = JSON.parse(w.settings!);
  assert.match(s.focus, /Kennt den Artikel bei die Wand/);
  assert.match(s.focus, /Liest Aufgabenstellungen nicht genau/);
  assert.match(s.focus, /kommt nicht mehr: Geschichte zu Ende schreiben/);
  assert.match(s.focus, /Sätze mit weil/);
  assert.deepEqual(s.paket, { nr: 1, fach: "Deutsch", erkenntnisIds: [wand.id, lesen.id], nichtMehr: "Geschichte zu Ende schreiben" }, "an id of another student never gets in");

  assert.deepEqual(paketeVon(sid).map((p) => p.id), [w.id]);
  const copy = repo.duplicateWorksheet(w.id)!;
  assert.ok(copy);
  assert.deepEqual(paketeVon(sid).map((p) => p.id), [w.id], "a copy is no package");
  const weiter = paketVorschlag(sid, "Deutsch");
  assert.equal(weiter.nr, 2);
  assert.equal(weiter.nichtMehr, "Geschichte zu Ende schreiben");
});

/** Löst das Paket am Gerät: die Aufgaben mit `richtig` richtig, die übrigen falsch. */
async function loese(worksheetId: number, sid: number, richtig: (i: number) => boolean) {
  const repo = await import("./repo");
  const aid = repo.assignWorksheet(worksheetId, sid, "", null, "normal");
  repo.listTasks(worksheetId).forEach((t, i) =>
    repo.recordAttempt({ assignment_id: aid, task_id: t.id, student_id: sid, skill_id: t.skillId, attempt_no: 1, answer: richtig(i) ? "die" : "das", correct: richtig(i) ? 1 : 0, final: 1, time_ms: 1000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "", teacher_id: null, level: 3 }),
  );
}

test("without KI the package is evaluated per skill; taking it over closes fixed patterns and adds new ones once", async () => {
  const { teacher, sid, wand, lesen } = await setup();
  const { erstellePaket, paketErgebnis, wertePaketAus, uebernimmAuswertung, paketVonId } = await import("./uebungspaket");
  const { listErkenntnisse } = await import("./erkenntnisse");
  const { worksheetId } = await erstellePaket({ studentId: sid, teacherId: teacher.id, fach: "Deutsch", erkenntnisIds: [wand.id, lesen.id], nichtMehr: "", anzahl: 8 });
  await assert.rejects(wertePaketAus(worksheetId, sid, teacher.id), /noch keine bewerteten Antworten/);
  await loese(worksheetId, sid, () => true);
  const e = paketErgebnis(worksheetId);
  assert.deepEqual([e.beantwortet, e.richtig], [8, 8]);

  const a = await wertePaketAus(worksheetId, sid, teacher.id);
  assert.equal(a.ohneKi, true);
  assert.match(a.hinweis ?? "", /nicht eingerichtet/);
  assert.deepEqual(a.muster.map((m) => [m.erkenntnisId, m.stand]), [[wand.id, "behoben"], [lesen.id, "offen"]], "a pattern without skill stays open");
  assert.ok(paketVonId(worksheetId, sid)!.paket.auswertung, "the proposal is kept with the package");

  const out = uebernimmAuswertung({ worksheetId, studentId: sid, teacherId: teacher.id, erledigt: [wand.id], neue: [{ text: "Verwechselt Wo und Wohin", skillId: ARTIKEL, fehlerart: "regel" }], staerken: ["Artikel jetzt sicher"] });
  assert.deepEqual(out, { erledigt: 1, neu: 2 });
  const offen = listErkenntnisse(sid, { status: "offen", art: "fehler" });
  assert.deepEqual(offen.map((x) => x.text).sort(), ["Liest Aufgabenstellungen nicht genau", "Verwechselt Wo und Wohin"]);
  assert.equal(offen.find((x) => x.text.startsWith("Verwechselt"))!.quelle, "paket");
  assert.deepEqual(uebernimmAuswertung({ worksheetId, studentId: sid, teacherId: teacher.id, erledigt: [], neue: [], staerken: [] }), { error: "Dieses Paket ist schon ausgewertet." });
});

test("with KI the patterns of the package and the graded tasks go along, without names; its verdict is checked", async () => {
  const { teacher, sid, wand, lesen } = await setup();
  const { erstellePaket, wertePaketAus } = await import("./uebungspaket");
  const { worksheetId } = await erstellePaket({ studentId: sid, teacherId: teacher.id, fach: "Deutsch", erkenntnisIds: [wand.id, lesen.id], nichtMehr: "", anzahl: 8 });
  await loese(worksheetId, sid, (i) => i % 2 === 0);
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  const antwort: PaketAuswertungGelesen = {
    muster: [{ nr: 1, stand: "besser", grund: "Aufgaben 1, 3 richtig, 2 falsch" }],
    neue: [
      { text: "Verwechselt der und das bei Nomen auf -e", faehigkeit: "gibt-es-nicht", fehlerart: "wortschatz" },
      { text: "Kennt den Artikel bei die Wand, das Gemüse nicht", faehigkeit: null, fehlerart: null },
    ],
    staerken: ["Arbeitet konzentriert"],
  };
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: antwort, refusal: false, model: req.model, usage: { input: 1_500, output: 400, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  try {
    const a = await wertePaketAus(worksheetId, sid, teacher.id);
    assert.equal(gefragt.length, 1);
    assert.equal(gefragt[0].fn, "paket_auswertung");
    const text = JSON.stringify(gefragt[0].content);
    assert.ok(text.includes("Kennt den Artikel bei die Wand") && text.includes("Liest Aufgabenstellungen"), "the patterns go along");
    assert.ok(!text.includes("Lorenz"), "no name");
    assert.equal(a.ohneKi, false);
    assert.deepEqual(a.muster.map((m) => m.stand), ["besser", "offen"], "a pattern the KI skipped keeps the rule's verdict");
    assert.deepEqual(a.neue, [{ text: "Verwechselt der und das bei Nomen auf -e", skillId: null, fehlerart: "wortschatz" }], "unknown skills dropped, an old pattern is not new");
    assert.deepEqual(a.staerken, ["Arbeitet konzentriert"]);
  } finally {
    router.setTransport(null);
  }
});
