/**
 * Referenzsammlung (Plan 4.3, Entscheidung des Inhabers 23.10.2026): Aufgaben aus einem von Hand geladenen PDF, nur für Lehrer. Die KI liest
 * die Datei einmal, jeder Eintrag ist ungeprüft, bis ein Lehrer ihn speichert; die Quelle ist Pflicht und wird nie
 * erfunden. Geprüfte Mathematik-Einträge ohne Material Dritter von aufgabenpool.at dürfen in die Bibliothek, mit der
 * Quelle an der Aufgabe. Geprüfte Einträge gehen als Beispiele an die KI.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und schreibt mit, was gefragt wurde. Das „PDF“ sind
 * ein paar erfundene Bytes mit dem Anfang einer PDF-Datei; alle Aufgaben, Kennungen und Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ReferenzGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "referenz-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("erfundene Seite mit zwei Aufgaben")]);
const SKILL = "mathe.gleichungen.einfach";
const ANDERE = "mathe.brueche.kuerzen";

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const teacher = repo.listTeachers()[0];
  return { repo, teacher };
}

const gelesen = (): ReferenzGelesen => ({
  aufgaben: [
    {
      kennung: "9_901",
      aufgabe: "Gegeben ist die Gleichung 3x + 4 = 19.\nKreuze die Lösung an.  \n\n\n\n(A) 5  (B) 7",
      format: "matura-1aus5",
      faehigkeit: SKILL,
      grundkompetenz: "AG 2.1",
      loesung: "x = 5",
      dritte: false,
      unsicher: false,
    },
    { kennung: null, aufgabe: "Berechne den Anteil laut Grafik.", format: "gibt-es-nicht", faehigkeit: "gibt-es-nicht", grundkompetenz: null, loesung: "", dritte: true, unsicher: true },
    { kennung: null, aufgabe: "   ", format: null, faehigkeit: null, grundkompetenz: null, loesung: "", dritte: false, unsicher: false },
  ],
  unsicher: ["Aufgabe 2 schwer lesbar"],
});

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet je nach Funktion. */
async function mitKi(antwort: (req: AIRequest) => unknown) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: antwort(req), refusal: false, model: req.model, usage: { input: 3_000, output: 800, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

const eingabe = (o: Partial<import("./referenz").ReferenzEingabe> = {}): import("./referenz").ReferenzEingabe => ({
  fach: "Mathematik",
  skillId: SKILL,
  grundkompetenz: "AG 2.1",
  format: "textaufgabe",
  aufgabe: "Löse die Gleichung 3x + 4 = 19.",
  loesung: "x = 5",
  quelle: "aufgabenpool.at, 9_901",
  dritte: false,
  ...o,
});

test("rules: the free source, the Kennung from the file name, the source with Kennung", async () => {
  const r = await import("./referenz-regeln");
  assert.equal(r.freieQuelle("aufgabenpool.at, 9_901")?.key, "aufgabenpool");
  assert.equal(r.freieQuelle("https://www.aufgabenpool.at/ 9_901")?.key, "aufgabenpool");
  assert.equal(r.freieQuelle("Schulbuch Mathe 5, S. 12"), null, "a school book is no free source");
  assert.equal(r.freieQuelle("aufgabenpool.at.example, 1"), null);
  assert.equal(r.kennungAusDatei("C:\\Downloads\\9_901 Gleichung.pdf"), "9_901 Gleichung");
  assert.equal(r.kennungAusDatei(".pdf"), "");
  assert.equal(r.quelleMitKennung("aufgabenpool.at", "9_901"), "aufgabenpool.at, 9_901");
  assert.equal(r.quelleMitKennung("aufgabenpool.at, 9_901", "9_901"), "aufgabenpool.at, 9_901", "the Kennung is not doubled");
  assert.equal(r.quelleMitKennung("aufgabenpool.at", ""), "aufgabenpool.at", "no Kennung is made up");
  assert.equal(r.quelleMitKennung("", "9_901"), "", "without a source there is none");
  assert.equal(r.nurAufbau("Englisch"), true);
  assert.equal(r.nurAufbau("Mathematik"), false);
});

test("examples are labelled as examples and only there when there are some", async () => {
  const { vorbilderPrompt } = await import("./referenz-regeln");
  assert.equal(vorbilderPrompt([]), "");
  const text = vorbilderPrompt([
    { faehigkeit: "Gleichungen › Einfach", format: "Textaufgabe", grundkompetenz: "AG 2.1", aufgabe: "Löse 3x + 4 = 19.", loesung: "x = 5", nurAufbau: false },
    { faehigkeit: "", format: "Writing", grundkompetenz: "", aufgabe: "Blog post, 200 words, three points", loesung: "Task achievement, organisation", nurAufbau: true },
    { faehigkeit: "", format: "", grundkompetenz: "", aufgabe: "drei", loesung: "", nurAufbau: false },
    { faehigkeit: "", format: "", grundkompetenz: "", aufgabe: "vier", loesung: "", nurAufbau: false },
  ]);
  assert.match(text, /Beispiele aus der Referenzsammlung/);
  assert.match(text, /Übernimm keines der Beispiele/);
  assert.match(text, /Beispiel 1 \(Fähigkeit: Gleichungen › Einfach, Format: Textaufgabe, Grundkompetenz: AG 2.1\):\nAufgabe: Löse 3x \+ 4 = 19\.\nLösungserwartung: x = 5/);
  assert.match(text, /Aufbau: Blog post.*\nBewertungsraster: Task achievement/);
  assert.ok(!text.includes("Beispiel 4"), "at most three");
});

test("a PDF is read once: entries are unchecked, nothing is invented, the file is not stored", async () => {
  const { repo, teacher } = await setup();
  const ki = await mitKi(() => gelesen());
  try {
    const { liesReferenz, listeEintraege } = await import("./referenz");
    const out = await liesReferenz({ datei: { name: "M_Gleichungen 9_955.pdf", data: PDF }, fach: "Mathematik", quelle: " aufgabenpool.at ", teacherId: teacher.id });
    assert.equal(out.ids.length, 2, "the empty task is left out");
    assert.ok(out.hinweise.some((h) => h.includes("schwer lesbar")));
    assert.equal(ki.gefragt.length, 1);
    const req = ki.gefragt[0];
    assert.equal(req.fn, "referenz");
    const content = req.content as { type: string; text?: string }[];
    assert.equal(content[0].type, "pdf", "the PDF goes as a document");
    assert.match(content[1].text ?? "", /Fach: Mathematik/);
    assert.match(content[1].text ?? "", new RegExp(`${SKILL.replaceAll(".", "\\.")} \\|`), "the skills of the subject are offered");
    assert.match(req.system, /Erfinde keine Kennung, keine Grundkompetenz, keine Quelle und keine Lösung/);

    const [zwei, eins] = listeEintraege();
    assert.equal(eins.status, "ungeprueft");
    assert.equal(eins.quelle, "aufgabenpool.at, 9_901", "the Kennung printed on the page");
    assert.equal(eins.skill_id, SKILL);
    assert.equal(eins.format, "matura-1aus5");
    assert.equal(eins.grundkompetenz, "AG 2.1");
    assert.equal(eins.aufgabe, "Gegeben ist die Gleichung 3x + 4 = 19.\nKreuze die Lösung an.\n\n(A) 5 (B) 7", "lines stay, extra space goes");
    assert.equal(eins.datei, "M_Gleichungen 9_955.pdf");
    assert.equal(zwei.quelle, "aufgabenpool.at, M_Gleichungen 9_955", "without a Kennung on the page: the file name, nothing made up");
    assert.equal(zwei.skill_id, null, "an unknown skill never gets through");
    assert.equal(zwei.format, "", "an unknown task type neither");
    assert.equal(zwei.grundkompetenz, "");
    assert.equal(zwei.dritte, true);
    assert.ok(zwei.hinweise.includes("Bitte die Fähigkeit wählen."));
    assert.ok(zwei.hinweise.includes("In der Datei steht keine Lösungserwartung."));
    assert.ok(zwei.hinweise.includes("Die Kennung kommt aus dem Dateinamen."));
    assert.equal(fs.readdirSync(process.env.UPLOADS_PATH!).length, 0, "the file is not stored");
    assert.equal((await import("./materials")).listMaterials().length, 0, "and is no material");
    void repo;
  } finally {
    ki.aus();
  }
});

test("reading needs a source, a known subject and a PDF or photo; without KI it says so", async () => {
  const { teacher } = await setup();
  const { liesReferenz } = await import("./referenz");
  const lies = (o: Partial<Parameters<typeof liesReferenz>[0]>) => liesReferenz({ datei: { name: "a.pdf", data: PDF }, fach: "Mathematik", quelle: "aufgabenpool.at", teacherId: teacher.id, ...o });
  await assert.rejects(lies({}), /KI.*nicht eingerichtet/, "without KI: no request, a sentence for the teacher");
  const ki = await mitKi(() => gelesen());
  try {
    await assert.rejects(lies({ quelle: "  " }), /Quelle/);
    await assert.rejects(lies({ fach: "Biologie" }), /Fach/);
    await assert.rejects(lies({ datei: { name: "a.html", data: Buffer.from("<html><script>alert(1)</script>") } }), /Nur PDF-Dateien und Fotos/);
    assert.equal(ki.gefragt.length, 0, "nothing went to the KI");
  } finally {
    ki.aus();
  }
});

test("saving is the check; without a source nothing is saved", async () => {
  const { teacher } = await setup();
  const { neuerEintrag, speichereEintrag, getEintrag } = await import("./referenz");
  assert.deepEqual(neuerEintrag({ fach: "Mathematik", quelle: "", teacherId: teacher.id }), { fehler: "Bitte die Quelle angeben, z. B. aufgabenpool.at, 1_234." });
  const neu = neuerEintrag({ fach: "Mathematik", quelle: "aufgabenpool.at, 9_901", teacherId: teacher.id });
  assert.ok("id" in neu);
  assert.equal(getEintrag(neu.id)!.status, "ungeprueft");
  const ohne = speichereEintrag(neu.id, eingabe({ quelle: "" }), teacher.id);
  assert.ok("fehler" in ohne && ohne.fehler.some((f) => f.includes("Ohne Quelle wird nichts gespeichert")));
  const falsch = speichereEintrag(neu.id, eingabe({ skillId: "deutsch.rechtschreibung.dass", format: "gibt-es-nicht" }), teacher.id);
  assert.ok("fehler" in falsch && falsch.fehler.length >= 1);
  assert.equal(getEintrag(neu.id)!.status, "ungeprueft", "a failed save checks nothing");
  assert.deepEqual(speichereEintrag(neu.id, eingabe(), teacher.id), { ok: true });
  const e = getEintrag(neu.id)!;
  assert.equal(e.status, "geprueft");
  assert.equal(e.geprueft_von, teacher.id);
  assert.equal(e.geprueft_von_name, teacher.name);
});

test("only a checked Mathematik entry from aufgabenpool.at without material of third parties goes into the library", async () => {
  const { uebernahmeGrund } = await import("./referenz");
  const ok = { status: "geprueft" as const, dritte: false, fach: "Mathematik", quelle: "aufgabenpool.at, 9_901", skill_id: SKILL, loesung: "x = 5", aufgabe: "Löse 3x + 4 = 19." };
  assert.equal(uebernahmeGrund(ok), null);
  assert.match(uebernahmeGrund({ ...ok, dritte: true })!, /Dritter: bleibt Referenz/);
  assert.match(uebernahmeGrund({ ...ok, fach: "Englisch" })!, /Sprachen bleibt ein Eintrag Referenz/);
  assert.match(uebernahmeGrund({ ...ok, quelle: "Schulbuch Mathe 5, S. 12" })!, /nur Aufgaben von aufgabenpool\.at/);
  assert.match(uebernahmeGrund({ ...ok, status: "ungeprueft" })!, /Erst prüfen/);
  assert.match(uebernahmeGrund({ ...ok, skill_id: null })!, /Fähigkeit/);
  assert.match(uebernahmeGrund({ ...ok, loesung: " " })!, /Lösungserwartung/);
});

test("into the library: an open task with its source, which goes with every copy to the sheet and the student", async () => {
  const { repo, teacher } = await setup();
  const { neuerEintrag, speichereEintrag, inBibliothek, getEintrag } = await import("./referenz");
  const { getLibraryEntry, exerciseFromLibrary } = await import("./library");
  const neu = neuerEintrag({ fach: "Mathematik", quelle: "aufgabenpool.at, 9_901", teacherId: teacher.id });
  assert.ok("id" in neu);
  assert.deepEqual(inBibliothek(neu.id, teacher.id), { fehler: "Erst prüfen und speichern." });
  speichereEintrag(neu.id, eingabe(), teacher.id);
  const out = inBibliothek(neu.id, teacher.id);
  assert.ok("libraryId" in out && !out.vorhanden);
  assert.deepEqual(inBibliothek(neu.id, teacher.id), { libraryId: out.libraryId, vorhanden: true }, "a second time gives the same task");
  assert.equal(getEintrag(neu.id)!.worksheet_id, out.libraryId);

  const e = getLibraryEntry(out.libraryId)!;
  assert.equal(e.task.type, "free");
  assert.equal(e.task.category, "textaufgabe", "the format, where it is an open one");
  assert.equal(e.task.skillId, SKILL);
  assert.equal(e.task.prompt, "Löse die Gleichung 3x + 4 = 19.");
  assert.equal(e.task.answer.sample, "x = 5");
  assert.equal(e.task.quelle, "aufgabenpool.at, 9_901");
  assert.equal(e.origin, "importiert");
  assert.equal(e.source?.name, "aufgabenpool.at");
  assert.equal(e.source?.license, "Nutzung mit Quellenangabe");
  assert.ok(e.tags.includes("AG 2.1"));

  // a copy into an exercise keeps the source; the student sees it, without any word about the KI
  const sid = repo.createStudent({ name: "Lio Test", grade: 9, klasse: 5, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const ex = exerciseFromLibrary([out.libraryId], { studentId: sid, teacherId: teacher.id });
  assert.ok("id" in ex);
  const task = repo.listTasks(ex.id)[0];
  assert.equal(task.quelle, "aufgabenpool.at, 9_901");
  repo.updateWorksheetMeta(ex.id, { status: "freigegeben" });
  const aid = repo.assignWorksheet(ex.id, sid, "", null);
  const { clientTasks } = await import("./solver-tasks");
  const [ct] = clientTasks(repo.getAssignment(aid)!);
  assert.equal(ct.quelle, "aufgabenpool.at, 9_901");
  assert.ok(!/\bKI\b/.test(JSON.stringify(ct)), "no KI word on the student's side");

  // the teacher's editor sends the whole task back: the source stays; a newly made task has none
  repo.updateTask(task.id, { ...task, prompt: "Löse die Gleichung 3x + 5 = 20." });
  assert.equal(repo.getTask(task.id)!.quelle, "aufgabenpool.at, 9_901");
  const { quelle: _q, ...ohneQuelle } = repo.getTask(task.id)!;
  void _q;
  repo.updateTask(task.id, { ...ohneQuelle, prompt: "Eine neue Aufgabe" });
  assert.equal(repo.getTask(task.id)!.quelle, undefined, "replaced content has no source any more");
  assert.equal(repo.listTasks(out.libraryId)[0].quelle, "aufgabenpool.at, 9_901", "the library task keeps its source");
});

test("the source goes with a task in a Lernpaket file and back", async () => {
  await setup();
  const { dateiFelder } = await import("./ai/lernpaket");
  const { pruefeDateiAufgabe } = await import("./lernpakete");
  const roh = dateiFelder({ type: "free", skillId: SKILL, difficulty: "mittel", prompt: "Löse 3x + 4 = 19.", data: { lines: 3 }, answer: { sample: "x = 5" }, solution: "x = 5", hints: [], errorMap: [], quelle: "aufgabenpool.at, 9_901" });
  assert.equal(roh.quelle, "aufgabenpool.at, 9_901");
  const back = pruefeDateiAufgabe(roh, { skillIds: [SKILL], schwierigkeit: "mittel", fach: "Mathematik" });
  assert.ok("aufgabe" in back);
  assert.equal(back.aufgabe.quelle, "aufgabenpool.at, 9_901");
  assert.ok(!("quelle" in dateiFelder({ type: "free", skillId: SKILL, difficulty: "mittel", prompt: "x", data: {}, answer: { sample: "y" }, solution: "", hints: [], errorMap: [] })), "no empty field without a source");
});

test("checked entries of the same skill or format go to the KI as examples, unchecked ones never", async () => {
  const { teacher } = await setup();
  const { neuerEintrag, speichereEintrag, referenzVorbilder } = await import("./referenz");
  const lege = (e: Partial<import("./referenz").ReferenzEingabe>, pruefen = true) => {
    const n = neuerEintrag({ fach: e.fach ?? "Mathematik", quelle: "aufgabenpool.at", teacherId: teacher.id });
    assert.ok("id" in n);
    if (pruefen) assert.deepEqual(speichereEintrag(n.id, eingabe(e), teacher.id), { ok: true });
    return n.id;
  };
  assert.deepEqual(referenzVorbilder({ fach: "Mathematik", skillIds: [SKILL] }), [], "none without entries");
  lege({ aufgabe: "Vorbild A: Löse 2x = 8.", format: "textaufgabe" });
  lege({ aufgabe: "Vorbild B: Löse x + 3 = 9.", format: "rechnung" });
  lege({ aufgabe: "Nicht geprüft: Löse 5x = 10." }, false);
  lege({ aufgabe: "Andere Fähigkeit: Kürze 4/8.", skillId: ANDERE, format: "rechnung" });
  lege({ aufgabe: "Andere Fähigkeit 2: Kürze 6/9.", skillId: ANDERE, format: "rechnung" });

  const v = referenzVorbilder({ fach: "Mathematik", skillIds: [SKILL], formate: ["rechnung"] });
  assert.deepEqual(v.map((x) => x.aufgabe), ["Vorbild B: Löse x + 3 = 9.", "Vorbild A: Löse 2x = 8."], "same skill, the wanted format first");
  assert.equal(v[0].format, "Direkte Rechnung");
  assert.equal(v[0].grundkompetenz, "AG 2.1");
  assert.ok(!JSON.stringify(v).includes("aufgabenpool"), "no source goes to the KI");
  assert.equal(referenzVorbilder({ fach: "Mathematik", skillIds: ["mathe.wurzeln.quadratwurzel"] }).length, 0, "another skill, no format: no examples");
  assert.deepEqual(
    referenzVorbilder({ fach: "Mathematik", skillIds: ["mathe.wurzeln.quadratwurzel"], formate: ["rechnung"] }).map((x) => x.aufgabe),
    ["Andere Fähigkeit 2: Kürze 6/9.", "Andere Fähigkeit: Kürze 4/8.", "Vorbild B: Löse x + 3 = 9."],
    "too few of the skill: the same format in the subject",
  );
  assert.equal(referenzVorbilder({ fach: "Deutsch", skillIds: [SKILL] }).length, 0, "only entries of the subject");
});

test("the builder passes the examples to the KI, labelled as examples", async () => {
  const { teacher } = await setup();
  const { neuerEintrag, speichereEintrag } = await import("./referenz");
  const n = neuerEintrag({ fach: "Mathematik", quelle: "aufgabenpool.at, 9_901", teacherId: teacher.id });
  assert.ok("id" in n);
  speichereEintrag(n.id, eingabe({ aufgabe: "Vorbildaufgabe: Löse 7x - 2 = 12.", loesung: "x = 2" }), teacher.id);
  const unchecked = neuerEintrag({ fach: "Mathematik", quelle: "aufgabenpool.at, 9_902", teacherId: teacher.id });
  assert.ok("id" in unchecked);
  const ki = await mitKi(() => ({ tasks: [] }));
  try {
    const builder = await import("./builder");
    const settings = { studentId: null, subject: "Mathematik", schoolType: "Gymnasium", klasse: 3, skillIds: [SKILL], difficulty: "mittel" as const, count: 2, categories: ["textaufgabe"], focus: "", useAI: true, title: "" };
    await builder.generateTasks(settings, null);
    const prompt = ki.gefragt.map((r) => String(r.content)).join("\n");
    assert.match(prompt, /Beispiele aus der Referenzsammlung der Lehrkraft/);
    assert.match(prompt, /Aufgabe: Vorbildaufgabe: Löse 7x - 2 = 12\.\nLösungserwartung: x = 2/);
    assert.ok(!prompt.includes("aufgabenpool"), "no source in the request");

    ki.gefragt.length = 0;
    await builder.generateTasks({ ...settings, skillIds: ["mathe.wurzeln.quadratwurzel"], categories: ["rechnung"] }, null);
    assert.ok(ki.gefragt.length > 0);
    assert.ok(!ki.gefragt.some((r) => String(r.content).includes("Referenzsammlung")), "another skill and format: no examples, no block");
  } finally {
    ki.aus();
  }
});

test("„Lernpaket mit KI“ gets the examples of its skill, names masked", async () => {
  const { lernpaketAnfrage } = await import("./ai/lernpaket");
  const { repo } = await setup();
  const skill = repo.getSkill(SKILL)!;
  const auftrag = {
    fach: "Mathematik", thema: "Gleichungen", schulart: "Gymnasium", klasse: 3, stufe: "3. Klasse Gymnasium", skill, parent: null, dauer: 50,
    schwierigkeit: "mittel" as const, hinweise: "", erklaerung: "", fehler: [], wortarten: null,
    vorbilder: [{ faehigkeit: "Gleichungen › Einfach", format: "Textaufgabe", grundkompetenz: "AG 2.1", aufgabe: "Mia Probe kauft 3 Hefte um je x Euro …", loesung: "x = 2", nurAufbau: false }],
  };
  const { prompt } = lernpaketAnfrage(auftrag, [], ["Mia Probe"]);
  assert.match(prompt, /Beispiele aus der Referenzsammlung/);
  assert.match(prompt, /\[Name\] kauft 3 Hefte/);
  assert.ok(!prompt.includes("Mia Probe"));
  assert.ok(!lernpaketAnfrage({ ...auftrag, vorbilder: [] }, []).prompt.includes("Referenzsammlung"));
});
