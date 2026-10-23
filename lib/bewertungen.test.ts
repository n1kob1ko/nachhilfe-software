/**
 * Aufgaben bewerten (Plan 4.1): eine Bewertung je Aufgabe und Lehrer, änderbar, getrennt von Schülerleistungen.
 * Gleicher Inhalt = dieselbe Aufgabe (Bibliothek, Übung, Lernpaket). „Fachlich falsch“ oder „Musterlösung falsch“
 * blenden sofort aus; gut bewertete kommen zuerst und gehen der KI als Vorbild mit, die angekreuzten Probleme als Hinweis.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Alle Namen und Texte sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { TaskDraft } from "./tasks";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"])
  delete process.env[k];

const SKILL = "mathe.brueche.kuerzen";

const aufgabe = (prompt: string, o: Partial<TaskDraft> = {}): TaskDraft => ({
  type: "calc",
  skillId: SKILL,
  skillIds: [SKILL],
  difficulty: "mittel",
  prompt,
  data: {},
  answer: { accepted: ["3/4"], mode: "value" },
  solution: "Zähler und Nenner durch 2 teilen.",
  hints: [],
  errorMap: [],
  ...o,
});

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Fenja Wurzbacher",
    grade: 6,
    klasse: 2,
    teacher_id: niko.id,
    school: "",
    school_type: "Mittelschule",
    subjects: ["Mathematik"],
    current_topics: "",
    strengths_note: "",
    weaknesses_note: "",
    goals: "",
    notes: "",
  });
  const bib = (prompt: string, o: Partial<TaskDraft> = {}) =>
    repo.createWorksheet(
      { title: prompt.slice(0, 30), subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "bibliothek", source: "manuell", skill_ids: [SKILL] },
      [aufgabe(prompt, o)],
    );
  return { db, repo, niko, thomas, sid, bib };
}

test("Schlüssel: dieselbe Aufgabe in Bibliothek, Übung und Lernpaket; verbessert ist sie eine neue", async () => {
  const { repo, niko, bib } = await setup();
  const { aufgabeSchluessel } = await import("./bewertungen");
  const lib = await import("./library");
  const lp = await import("./lernpakete");
  const id = bib("Kürze 6/8 so weit wie möglich.");
  const t = lib.getLibraryEntry(id)!.task;
  const k = aufgabeSchluessel(t);
  // in eine Übung übernommen
  const ex = lib.exerciseFromLibrary([id], { teacherId: niko.id });
  assert.ok(!("error" in ex));
  assert.equal(aufgabeSchluessel(repo.listTasks(ex.id)[0]), k, "Kopie in einer Übung");
  // in einen Schritt eines Lernpakets übernommen (geht durch die Prüfung des Imports)
  const p = lp.createLernpaket({ title: "Kürzen", fach: "Mathematik", schulart: "Mittelschule", klasse: 2, thema: "Brüche", skill_ids: [SKILL], schwierigkeit: "mittel", dauer_minuten: 50, ziel: "" }, niko.id);
  assert.ok(!("fehler" in p));
  const s = lp.addSchritt(p.id, { art: "uebung", titel: "Üben", minuten: 10 });
  assert.ok(!("fehler" in s));
  assert.deepEqual(lp.aufgabeAusBibliothek(s.id, id), { ok: true });
  assert.equal(aufgabeSchluessel(lp.getSchritt(s.id)!.aufgaben[0]), k, "Kopie in einem Lernpaket");
  // Leerzeichen und „Bitte prüfen“ ändern nichts, eine andere Lösung schon
  assert.equal(aufgabeSchluessel({ ...t, prompt: `  ${t.prompt}  `, data: { ...t.data, pruefen: ["Lösung prüfen"] } }), k);
  assert.notEqual(aufgabeSchluessel({ ...t, answer: { accepted: ["6/8"], mode: "value" } }), k, "verbesserte Lösung = neue Aufgabe");
});

test("eine Bewertung je Lehrer, änderbar; Schnitt, Gründe und Kommentare der anderen", async () => {
  const { repo, niko, thomas, bib } = await setup();
  const b = await import("./bewertungen");
  const t = repo.listTasks(bib("Kürze 10/15."))[0];
  assert.deepEqual(b.bewerte(t, "Mathematik", niko.id, { sterne: 0, gruende: [], kommentar: "" }), { fehler: "Bitte 1 bis 5 Sterne wählen." });
  assert.deepEqual(b.bewerte(t, "Mathematik", niko.id, { sterne: 6, gruende: [], kommentar: "" }), { fehler: "Bitte 1 bis 5 Sterne wählen." });
  assert.ok("ok" in b.bewerte(t, "Mathematik", niko.id, { sterne: 3, gruende: ["zu_einfach", "erfunden"], kommentar: "  geht so " }));
  assert.ok("ok" in b.bewerte(t, "Mathematik", niko.id, { sterne: 5, gruende: ["besonders_gut"], kommentar: "Sehr klar." }));
  assert.ok("ok" in b.bewerte(t, "Mathematik", thomas.id, { sterne: 4, gruende: ["besonders_gut"], kommentar: "Passt für die Schularbeit." }));
  const [info] = b.bewertungInfos([t], niko.id);
  assert.equal(info.anzahl, 2, "eine Zeile je Lehrer");
  assert.equal(info.schnitt, 4.5);
  assert.deepEqual(info.meine, { sterne: 5, gruende: ["besonders_gut"], kommentar: "Sehr klar." }, "die zweite ersetzt die erste, unbekannte Gründe fallen weg");
  assert.deepEqual(info.gruende, { besonders_gut: 2 });
  assert.equal(info.gut, true);
  assert.deepEqual(info.andere, [{ name: "Thomas", sterne: 4, kommentar: "Passt für die Schularbeit." }]);
  b.entferneBewertung(t, niko.id);
  assert.equal(b.bewertungInfos([t], niko.id)[0].meine, null);
  assert.equal(b.bewertungInfos([t], niko.id)[0].anzahl, 1);
});

test("Regeln: „Fachlich falsch“ und „Musterlösung falsch“ blenden sofort aus, sonst ab höchstens 2 Sternen", async () => {
  const { stand } = await import("./bewertung-regeln");
  assert.equal(stand(4, 1, { fachlich_falsch: 1 }).ausgeblendet, true, "auch mit 4 Sternen");
  assert.equal(stand(5, 3, { loesung_falsch: 1 }).ausgeblendet, true);
  assert.equal(stand(5, 3, { loesung_falsch: 1 }).gut, false);
  assert.equal(stand(2, 2, {}).ausgeblendet, true);
  assert.equal(stand(2.5, 2, { zu_schwierig: 2 }).ausgeblendet, false);
  assert.equal(stand(4, 1, {}).gut, true);
  assert.equal(stand(3.5, 2, {}).gut, false);
  assert.equal(stand(0, 0, {}).ausgeblendet, false);
});

test("Bewerten ändert weder Versuche noch Lernstand", async () => {
  const { db, repo, niko, sid, bib } = await setup();
  const b = await import("./bewertungen");
  const { analyzeStudent } = await import("./service");
  const lib = await import("./library");
  const ex = lib.exerciseFromLibrary([bib("Kürze 4/6.")], { studentId: sid, teacherId: niko.id });
  assert.ok(!("error" in ex));
  const t = repo.listTasks(ex.id)[0];
  const aid = repo.assignWorksheet(ex.id, sid);
  db()
    .prepare("INSERT INTO attempts (assignment_id, task_id, student_id, skill_id, attempt_no, answer, correct, final) VALUES (?, ?, ?, ?, 1, '2/3', 1, 1)")
    .run(aid, t.id, sid, SKILL);
  const tabellen = ["attempts", "assignments", "skill_history", "skill_snapshots", "lessons", "hint_uses"];
  const vorher = tabellen.map((x) => db().prepare(`SELECT * FROM ${x}`).all());
  const lernstand = JSON.stringify(analyzeStudent(sid)!.skills.map((s) => [s.skill.id, s.mastery === null ? null : Math.round(s.mastery * 1e4)]));
  assert.ok("ok" in b.bewerte(t, "Mathematik", niko.id, { sterne: 1, gruende: ["fachlich_falsch"], kommentar: "" }));
  assert.deepEqual(tabellen.map((x) => db().prepare(`SELECT * FROM ${x}`).all()), vorher);
  assert.equal(JSON.stringify(analyzeStudent(sid)!.skills.map((s) => [s.skill.id, s.mastery === null ? null : Math.round(s.mastery * 1e4)])), lernstand);
});

test("Bibliothek: gut bewertete zuerst, ausgeblendete nur mit Filter; Diagnose und Vorschläge nehmen sie nicht", async () => {
  const { repo, niko, sid, bib } = await setup();
  const b = await import("./bewertungen");
  const lib = await import("./library");
  const { libraryTask } = await import("./diagnose");
  const { kandidaten } = await import("./briefing");
  const alt = bib("Kürze 12/16.");
  const schlecht = bib("Kürze 9/12.");
  const gut = bib("Kürze 14/21.");
  const neu = bib("Kürze 8/10.");
  const task = (id: number) => repo.listTasks(id)[0];
  b.bewerte(task(gut), "Mathematik", niko.id, { sterne: 5, gruende: ["besonders_gut"], kommentar: "" });
  b.bewerte(task(schlecht), "Mathematik", niko.id, { sterne: 4, gruende: ["loesung_falsch"], kommentar: "" });
  assert.deepEqual(lib.searchLibrary({ subject: "Mathematik" }).map((e) => e.id), [gut, neu, alt], "gut zuerst, dann wie bisher die neuesten");
  assert.deepEqual(lib.searchLibrary({ bewertung: "ausgeblendet" }).map((e) => e.id), [schlecht], "mit Filter auffindbar");
  assert.equal(lib.searchLibrary({ bewertung: "ausgeblendet" })[0].bewertung?.ausgeblendet, true, "und markiert");
  assert.deepEqual(lib.searchLibrary({ bewertung: "gut" }).map((e) => e.id), [gut]);
  assert.deepEqual(lib.searchLibrary({ bewertung: "unbewertet" }).map((e) => e.id), [neu, alt]);
  assert.equal(lib.searchLibrary({ bewertung: "alle" }).length, 4, "nichts gelöscht");
  assert.ok(lib.getLibraryEntry(schlecht), "die Seite öffnet weiter");

  // Diagnose: die gut bewertete zuerst, die ausgeblendete nie
  const used = new Set<number>();
  const seen = new Set<string>();
  const gezogen = [0, 1, 2, 3].map(() => libraryTask("Mathematik", { skillId: SKILL, difficulty: "mittel" }, used, seen)?.prompt);
  assert.equal(gezogen[0], "Kürze 14/21.");
  assert.ok(!gezogen.includes("Kürze 9/12."));

  // Vorschläge im Cockpit und Tagesbriefing
  const k = kandidaten(repo.getStudent(sid)!, new Map([[SKILL, 10]]), 20).filter((x) => x.art === "bibliothek");
  assert.ok(!k.some((x) => x.id === `B${schlecht}`), "ausgeblendet");
  assert.match(k.find((x) => x.id === `B${gut}`)!.info, /gut bewertet \(5,0 Sterne\)/);
});

test("Auswahl ohne KI: ohneAusgeblendete lässt schlecht bewertete Aufgaben weg", async () => {
  const { niko } = await setup();
  const b = await import("./bewertungen");
  const a = aufgabe("Kürze 18/24.");
  const c = aufgabe("Kürze 5/15.");
  b.bewerte(a, "Mathematik", niko.id, { sterne: 2, gruende: [], kommentar: "" });
  assert.deepEqual(b.ohneAusgeblendete([a, c]).map((t) => t.prompt), ["Kürze 5/15."]);
});

test("KI: gut bewertete Aufgaben als Vorbild und die Rückmeldung gehen in Builder und Lernpaket, Namen ersetzt", async () => {
  const { repo, niko, bib } = await setup();
  const b = await import("./bewertungen");
  const router = await import("./ai/router");
  const builder = await import("./builder");
  const { pruefeEingabe, bestandFuer } = await import("./lernpaket-ki");
  const { lernpaketAnfrage } = await import("./ai/lernpaket");
  const gut = bib("Fenja hat 6/9 einer Pizza gegessen. Kürze den Bruch.");
  const schlecht = bib("Kürze 20/30.");
  b.bewerte(repo.listTasks(gut)[0], "Mathematik", niko.id, { sterne: 5, gruende: ["besonders_gut"], kommentar: "Fenja mochte das." });
  b.bewerte(repo.listTasks(schlecht)[0], "Mathematik", niko.id, { sterne: 2, gruende: ["zu_schwierig", "unverstaendlich"], kommentar: "" });

  const zeilen = b.vorbildZeilen([SKILL]);
  assert.equal(zeilen.length, 1);
  assert.match(zeilen[0], /^\[Name\] hat 6\/9 einer Pizza gegessen\. Kürze den Bruch\. → Lösung: 3\/4$/);
  assert.equal(b.rueckmeldungZeile([SKILL]), "Zu schwierig (1×), Unverständlich (1×)");

  // Builder mit ersetztem Transport: der Auftrag enthält Vorbild und Rückmeldung, nie den Namen oder den Kommentar
  router.resetRouter();
  const gefragt: string[] = [];
  router.setTransport(async (r) => {
    gefragt.push(String(r.content));
    return { parsed: r.schema.parse({ tasks: [] }), refusal: false, model: r.model, usage: { input: 10, output: 10, cacheWrite: 0, cacheRead: 0 } };
  });
  try {
    await builder.generateTasks({ studentId: null, subject: "Mathematik", schoolType: "Mittelschule", klasse: 2, skillIds: [SKILL], difficulty: "mittel", count: 2, categories: [], focus: "", useAI: true, title: "" }, null);
  } finally {
    router.setTransport(null);
    router.resetRouter();
  }
  assert.ok(gefragt.length > 0, "die KI wurde (ersetzt) gefragt");
  assert.match(gefragt[0], /gut bewertet[\s\S]*\[Name\] hat 6\/9 einer Pizza gegessen/);
  assert.match(gefragt[0], /Rückmeldung der Lehrkräfte[^\n]*Zu schwierig \(1×\)/);
  assert.ok(!gefragt[0].includes("Fenja"), "kein Name");
  assert.ok(!gefragt[0].includes("mochte"), "kein Kommentar");

  // Lernpaket mit KI: ausgeblendete fehlen im Bestand, gut bewertete sind markiert, dazu Vorbild und Rückmeldung
  const e = pruefeEingabe({ skillId: SKILL, schulart: "Mittelschule", klasse: 2, dauer: 50 });
  assert.ok("auftrag" in e);
  const bestand = bestandFuer(e.auftrag);
  const prompts = bestand.map((x) => x.aufgabe.prompt);
  assert.ok(!prompts.includes("Kürze 20/30."), "die ausgeblendete fehlt");
  assert.equal(bestand.find((x) => x.aufgabe.prompt.startsWith("Fenja"))?.gut, true);
  const { prompt } = lernpaketAnfrage(e.auftrag, bestand, ["Fenja Wurzbacher"]);
  assert.match(prompt, /von Lehrkräften gut bewertet\]: \[Name\] hat 6\/9/);
  assert.match(prompt, /Von Lehrkräften gut bewertete Aufgaben zu dieser Fähigkeit[^\n]*\n- \[Name\] hat 6\/9/);
  assert.match(prompt, /Rückmeldung der Lehrkräfte[^\n]*Unverständlich \(1×\)/);
  assert.ok(!prompt.includes("Fenja"));
});
