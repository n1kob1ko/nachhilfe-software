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
  // without KI: the generator's tasks for the article; its general explanation templates do not come into a package
  const { istErklaerVorlage } = await import("./generators");
  const aufgaben = repo.listTasks(w.id);
  assert.equal(aufgaben.length, 6);
  assert.ok(aufgaben.every((t) => !istErklaerVorlage(t.prompt)), "no „Erkläre in eigenen Worten …“");
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
  assert.deepEqual([e.beantwortet, e.richtig], [6, 6]);

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

// ---------- Aufsatz (niko, 27.11.2026: Erörterung 2. Klasse HTL, das Paket kam mit „Erkläre in eigenen Worten …“) ----------

test("the places from the essay are stored with the pattern and become own sentences to correct; content patterns do not", async () => {
  const { repo, teacher, sid } = await setup();
  const { speichereErkenntnisse, listErkenntnisse, belegeVon } = await import("./erkenntnisse");
  const { eigeneSaetze, paketAuftrag, musterKurz } = await import("./uebungspaket");
  const ARGUMENT = "deutsch.argumentieren.argument";
  assert.ok(repo.getSkill(ARGUMENT), "the skill exists");
  speichereErkenntnisse({
    studentId: sid,
    subject: "Deutsch",
    teacherId: teacher.id,
    quelle: "blatt",
    zeilen: [
      {
        art: "fehler",
        text: "Fall nach Präposition falsch (zu einem Mensch) – Aufgabe 2, 4",
        skillId: ARTIKEL,
        fehlerart: "grammatik",
        belege: [
          { falsch: "Im Gegensatz zu einem Mensch kann die KI sich alles merken.", richtig: "Im Gegensatz zu einem Menschen kann die KI sich alles merken." },
          { falsch: "Jedoch führt dies zu einer Risiko.", richtig: "Jedoch führt dies zu einem Risiko." },
          { falsch: "gleich", richtig: "gleich" },
          { falsch: "Ganz anders geschrieben hier steht etwas", richtig: "Ein völlig neuer Satz, der mit dem alten nichts mehr gemein hat und länger ist." },
        ],
      },
      { art: "fehler", text: "Argument ohne Begründung und Beispiel", skillId: ARGUMENT, fehlerart: "inhalt", belege: [{ falsch: "Dadurch sind sie immer anwesend.", richtig: "Roboter werden nicht krank, daher fällt kein Unterricht aus." }] },
      { art: "staerke", text: "Klarer Aufbau", belege: [{ falsch: "a b c", richtig: "a b d" }] },
    ],
  });
  const [fall, argument] = listErkenntnisse(sid, { art: "fehler" }).filter((e) => e.text !== "Kennt den Artikel bei die Wand, das Gemüse nicht" && e.text !== "Liest Aufgabenstellungen nicht genau").reverse();
  assert.equal(belegeVon(fall).length, 3, "an unchanged place is dropped");
  assert.equal(belegeVon(listErkenntnisse(sid, { art: "staerke" })[0]).length, 0, "a strength has no places");
  assert.equal(musterKurz(fall.text), "Fall nach Präposition falsch");

  const eigene = eigeneSaetze([fall, argument], 4);
  assert.deepEqual(eigene.map((t) => t.data.faulty), ["Im Gegensatz zu einem Mensch kann die KI sich alles merken.", "Jedoch führt dies zu einer Risiko."], "only short corrections, no rewritten sentence, nothing from the content pattern");
  const [eins] = eigene;
  assert.equal(eins.type, "fix");
  assert.equal(eins.skillId, ARTIKEL);
  assert.match(eins.prompt, /aus deiner Schularbeit/);
  assert.deepEqual(eins.answer.accepted, ["Im Gegensatz zu einem Menschen kann die KI sich alles merken."]);
  assert.deepEqual(eins.answer.fixes?.map((f) => [f.wrong, f.right, f.label]), [["Mensch", "Menschen", "Fall nach Präposition falsch"]]);
  assert.equal(eigeneSaetze([fall], 1).length, 1, "at most max");

  const auftrag = paketAuftrag({ nr: 1, fach: "Deutsch", muster: [fall, argument], nichtMehr: "", staerken: [] });
  assert.match(auftrag, /Stellen aus seiner Arbeit: „Im Gegensatz zu einem Mensch kann die KI sich alles merken\.“ → „Im Gegensatz zu einem Menschen/);
  assert.match(auftrag, /Keine Fragen nach der Regel/);
  assert.match(auftrag, /Behauptung, Begründung, Beispiel und Rückbezug/);
  assert.doesNotMatch(paketAuftrag({ nr: 1, fach: "Mathematik", muster: [{ text: "Kürzt nicht", skill_id: null }], nichtMehr: "", staerken: [] }), /Text, den der Schüler geschrieben hat/, "only for languages");
});

test("a package from an essay starts with the own sentences and asks for writing tasks on content patterns", async () => {
  const { repo, teacher, sid } = await setup();
  const { speichereErkenntnisse, listErkenntnisse } = await import("./erkenntnisse");
  const { erstellePaket } = await import("./uebungspaket");
  const ARGUMENT = "deutsch.argumentieren.argument";
  speichereErkenntnisse({
    studentId: sid,
    subject: "Deutsch",
    teacherId: teacher.id,
    quelle: "blatt",
    zeilen: [
      { art: "fehler", text: "Fall nach Präposition", skillId: ARTIKEL, fehlerart: "grammatik", belege: [{ falsch: "Er kommt zu spät zur Unterricht.", richtig: "Er kommt zu spät zum Unterricht." }] },
      { art: "fehler", text: "Argument ohne Beispiel", skillId: ARGUMENT, fehlerart: "inhalt" },
    ],
  });
  const ids = listErkenntnisse(sid, { art: "fehler" }).filter((e) => e.quelle === "blatt" && (e.skill_id === ARTIKEL || e.skill_id === ARGUMENT) && e.text !== "Kennt den Artikel bei die Wand, das Gemüse nicht").map((e) => e.id);
  const out = await erstellePaket({ studentId: sid, teacherId: teacher.id, fach: "Deutsch", erkenntnisIds: ids, nichtMehr: "", anzahl: 8 });
  const w = repo.getWorksheet(out.worksheetId)!;
  const [erste] = repo.listTasks(w.id);
  assert.equal(erste.data.faulty, "Er kommt zu spät zur Unterricht.", "the own sentence comes first");
  const s = JSON.parse(w.settings!);
  assert.deepEqual(s.kategorienJeFaehigkeit, { [ARGUMENT]: ["offen"] });
  assert.equal(s.count, 7, "the own sentence counts towards the number");
  const { planSlots, resolveSkills } = await import("./builder");
  const plan = planSlots("Deutsch", resolveSkills({ ...s, skillIds: [ARGUMENT] }, null), [], 3, s.kategorienJeFaehigkeit);
  assert.deepEqual(plan.map((p) => p.category), ["offen", "offen", "offen"]);
});

test("a package without any usable task is not created", async () => {
  const { teacher, sid, lesen } = await setup();
  const { erstellePaket } = await import("./uebungspaket");
  const { db } = await import("./db");
  // only a pattern whose skill has nothing but the general templates without KI
  const vorlageSkill = (db().prepare("SELECT id FROM skills WHERE id = 'deutsch.argumentieren.argument'").get() as { id: string }).id;
  db().prepare("UPDATE erkenntnisse SET skill_id = ? WHERE id = ?").run(vorlageSkill, lesen.id);
  const vorher = (db().prepare("SELECT COUNT(*) AS n FROM worksheets").get() as { n: number }).n;
  await assert.rejects(erstellePaket({ studentId: sid, teacherId: teacher.id, fach: "Deutsch", erkenntnisIds: [lesen.id], nichtMehr: "", anzahl: 8 }), /kein Paket angelegt/);
  assert.equal((db().prepare("SELECT COUNT(*) AS n FROM worksheets").get() as { n: number }).n, vorher);
});
