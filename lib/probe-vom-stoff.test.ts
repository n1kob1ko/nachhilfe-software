/**
 * Probeschularbeit vom Stoffzettel (niko, 08.11.2026, Teil B von „A + B“): „generell ist es gerade einfacher, es hier in
 * Claude zu senden, und Claude macht eine Probe-SA daraus“. Die KI schreibt alle Aufgaben aus den gelesenen Zeilen, jede
 * Zeile kommt dran, auch eine ohne passende Fähigkeit. Getestet mit nikos Stoffzettel (lib/fixtures/stoff-mathe-3g.ts).
 *
 * Kein Schlüssel, kein Aufruf nach außen: der KI-Transport wird ersetzt, liest den Aufgabenplan aus der Anfrage und
 * antwortet in vertauschter Reihenfolge. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import { STOFF_MATHE_3G, STOFF_MATHE_3G_LERNINHALTE } from "./fixtures/stoff-mathe-3g";

process.env.DATABASE_PATH = ":memory:";
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR",
])
  delete process.env[k];

/** Die Lernzeilen des Zettels ohne Seitenangabe, wie die App sie als Inhalt speichert, mit ihrem Kapitel. */
const ZEILEN = STOFF_MATHE_3G.punkte
  .filter((p) => p.skill_id)
  .map((p) => ({ text: p.inhalt, skillId: p.skill_id, einheit: p.einheit ?? "" }));
/** Diese Zeile bekommt im Test keine Fähigkeit: sie muss trotzdem drankommen. */
const OHNE = "Zehnerpotenzen und Gleitkommadarstellung";

test("planeVomStoff: jede Zeile kommt dran, Zeilen derselben Fähigkeit teilen sich zuerst eine Aufgabe, die Kapitel wechseln sich ab", async () => {
  const { planeVomStoff, schwierigkeiten } = await import("./probeschularbeit-regeln");
  assert.equal(ZEILEN.length, 11);
  const alle = new Set(ZEILEN.map((z) => z.text));

  for (const n of [5, 8, 12]) {
    const plan = planeVomStoff(ZEILEN, n);
    assert.equal(plan.length, n, `${n} Aufgaben`);
    assert.deepEqual(plan.map((p) => p.difficulty), schwierigkeiten(n), "leichte zuerst, wie jede Probeschularbeit");
    assert.deepEqual(new Set(plan.flatMap((p) => p.stoff)), alle, `${n} Aufgaben: alle 11 Zeilen sind dabei`);
  }

  // 50 Minuten = 8 Aufgaben für 11 Zeilen: zuerst teilen sich Zeilen derselben Fähigkeit eine Aufgabe
  const acht = planeVomStoff(ZEILEN, 8);
  const regeln = acht.find((p) => p.stoff.includes("Potenzen multiplizieren und dividieren"))!;
  assert.ok(regeln.stoff.includes("Produkte, Quotienten und Potenzen potenzieren"), "beide Zeilen zu den Potenzregeln in einer Aufgabe");
  const schreibweise = acht.find((p) => p.stoff.includes("Produkte als Potenzen schreiben"))!;
  assert.ok(schreibweise.stoff.includes("Zehnerpotenzen und Gleitkommadarstellung"));
  // Aufgaben zu mehreren Zeilen stehen auf den schweren Plätzen am Ende
  const erste = acht.findIndex((p) => p.stoff.length > 1);
  assert.ok(acht.slice(erste).every((p) => p.stoff.length > 1), acht.map((p) => p.stoff.length).join(" "));
  // die ersten drei Aufgaben kommen aus drei Kapiteln
  assert.equal(new Set(acht.slice(0, 3).map((p) => p.einheit)).size, 3, acht.map((p) => p.einheit).join(" | "));

  // 100 Minuten = 12 Aufgaben: jede Zeile hat ihre eigene, eine kommt noch einmal
  const zwoelf = planeVomStoff(ZEILEN, 12);
  assert.ok(zwoelf.every((p) => p.stoff.length === 1));

  // dieselbe Zeile zweimal gelesen zählt einmal; ohne Zeilen kein Plan
  assert.equal(planeVomStoff([...ZEILEN, { ...ZEILEN[0], text: `  ${ZEILEN[0].text.toUpperCase()} ` }], 12).filter((p) => p.stoff[0].toLowerCase() === ZEILEN[0].text.toLowerCase()).length, 2, "nur durch die Wiederholung zweimal");
  assert.deepEqual(planeVomStoff([], 8), []);
  assert.deepEqual(planeVomStoff(ZEILEN, 0), []);
});

test("der Hinweis über der neuen Probeschularbeit sagt, dass jede Zeile dabei ist und was aus der App kommt", async () => {
  const { stoffHinweis } = await import("./probeschularbeit-regeln");
  assert.deepEqual(stoffHinweis({ zeilen: 11, aufgaben: 8, ersetzt: 0, erklaeren: 0, ki: true }), { text: "Alle 11 Zeilen vom Stoffzettel sind dabei, in 8 Aufgaben.", gut: true });
  const teil = stoffHinweis({ zeilen: 11, aufgaben: 8, ersetzt: 2, erklaeren: 1, ki: true });
  assert.equal(teil.gut, false);
  assert.match(teil.text, /Für 2 Aufgaben kam von der KI nichts Passendes, sie stammen aus der App\. Eine davon ist nur eine Erklär-Aufgabe/);
  assert.match(stoffHinweis({ zeilen: 1, aufgaben: 5, ersetzt: 5, erklaeren: 0, ki: false }).text, /^Die Zeile vom Stoffzettel ist dabei, in 5 Aufgaben\. Die KI war nicht erreichbar/);
});

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const ps = await import("./pruefungsstoff");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Lena Probe", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const student = repo.getStudent(sid)!;
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const testId = repo.addTest({ student_id: sid, date: inDays(9), subject: "Mathematik", kind: "Schularbeit", topic: "", title: "1. Mathematikschularbeit", topics: [], grade: null, points: null, max_points: null, notes: "", skill_ids: [], teacher_id: teacher.id });
  // der Zettel wie gelesen und zugeordnet; eine Zeile ohne passende Fähigkeit
  const lesung = ps.lesungAusAntwort(STOFF_MATHE_3G, { dateien: 1 });
  const punkte = ps.ordneZu(lesung.punkte, { fach: "Mathematik", student, ki: true }).map((p) => (p.inhalt === OHNE ? { ...p, skill_id: null, zuordnung: "keine" as const, vorschlaege: [] } : p));
  ps.speichereStoff(testId, punkte);
  return { repo, ps, teacher, sid, student, testId };
}

/** Eine Aufgabe, die zur Kategorie passt, oder eine freie (die passt nur auf „offen“). */
function aufgabeFuer(category: string, nr: number, stoff: string, difficulty: string) {
  const leer = {
    passage: null, options: null, correct_option: null, accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null,
    answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["Ergebnis stimmt"], solution: "Rechne Schritt für Schritt.", solution_steps: [], estimated_time_sec: 120, hints: [], common_errors: [],
  };
  const kopf = { category, skill_ids: [], topic: String(nr), difficulty, prompt: `Aufgabe zum Stoff ${stoff}: Berechne (−3) · 4 + 17.` };
  if (category === "rechnung" || category === "fehler") return { ...leer, ...kopf, format: "calc", accepted_answers: ["5"], numeric: true };
  if (category === "mc") return { ...leer, ...kopf, format: "mc", options: ["5", "−29", "29"], correct_option: 0 };
  if (category === "lueckentext") return { ...leer, ...kopf, format: "cloze", prompt: `Zum Stoff ${stoff}: (−3) · 4 + 17 = ___`, blanks: [["5"]] };
  return { ...leer, ...kopf, format: "free", sample_answer: "Eine ausgeführte Musterlösung mit Zahlen: (−3) · 4 = −12, −12 + 17 = 5." };
}

test("vom Stoffzettel: eine Anfrage, jede Aufgabe an ihrem Platz, jede Zeile dabei, die Zeile ohne Fähigkeit ohne Fähigkeit", async () => {
  const { repo, ps, teacher, testId } = await setup();
  const p = await import("./probeschularbeit");
  const regeln = await import("./probeschularbeit-regeln");

  // was dran kommt: die 11 Lernzeilen, nichts aus dem Umfang
  const zeilen = p.stoffFuerProbe(testId);
  assert.equal(p.stoffZeilenAnzahl(zeilen), 11);
  assert.ok(zeilen.every((z) => !/übungsbuch|teste dein|vermischte|sprache der|^\d\./i.test(z.text)), zeilen.map((z) => z.text).join(" | "));
  assert.equal(zeilen.find((z) => z.text === OHNE)!.skillId, null);
  const plan = regeln.planeVomStoff(zeilen, 8);

  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    const text = typeof req.content === "string" ? req.content : (req.content as { type: string; text?: string }[]).filter((t) => t.type === "text").map((t) => t.text).join("\n");
    const zeilenDesPlans = [...text.matchAll(/^(\d+)\. category=(\S+?)[ ,].*?Schwierigkeit=([^,]+), Stoff: (.+)$/gm)];
    // die KI antwortet in umgekehrter Reihenfolge und lässt die letzte Aufgabe weg
    const tasks = zeilenDesPlans
      .filter((m) => Number(m[1]) !== zeilenDesPlans.length)
      .map((m) => aufgabeFuer(m[2], Number(m[1]), m[4], m[3]))
      .reverse();
    return { parsed: { tasks }, refusal: false, model: req.model, usage: { input: 3_000, output: 6_000, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  try {
    const out = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 50, vomStoff: true, seed: 3 });
    assert.equal(gefragt.length, 1, "eine Anfrage für alle Aufgaben");
    const text = JSON.stringify(gefragt[0]);
    assert.ok(!text.includes("Lena"), "kein Name an die KI");
    assert.ok(!/Übungsbuch|Teste Dein/.test(text), "kein Umfang als Stoff");
    for (const z of new Set(zeilen.map((x) => x.text))) assert.ok(text.includes(`„${z}“`), `${z} steht im Aufgabenplan`);
    assert.match(text, /skill_id=keine/, "die Zeile ohne Fähigkeit geht ohne Fähigkeit mit");
    assert.match(text, /topic = die Nummer der Aufgabe im Aufgabenplan/);

    const w = repo.getWorksheet(out.worksheetId)!;
    assert.equal(w.probe_test_id, testId);
    assert.equal(w.status, "entwurf");
    assert.equal(w.source, "ki");
    const tasks = repo.listTasks(w.id);
    assert.equal(tasks.length, 8);
    assert.deepEqual(tasks.map((t) => t.difficulty), regeln.schwierigkeiten(8));
    const settings = JSON.parse(w.settings ?? "{}") as { vomStoff?: boolean; stoff?: string[][] };
    assert.equal(settings.vomStoff, true);
    assert.deepEqual(settings.stoff, plan.map((x) => x.stoff), "die Zeilen jeder Aufgabe stehen bei der Übung");

    // jede Aufgabe der KI an ihrem eigenen Platz, obwohl die Antwort vertauscht war
    let vonKi = 0;
    tasks.forEach((t, i) => {
      if (!t.prompt.includes("zum Stoff") && !t.prompt.includes("Zum Stoff")) return;
      vonKi++;
      for (const s of plan[i].stoff) assert.ok(t.prompt.includes(s), `Aufgabe ${i + 1}: ${t.prompt} gehört zu ${plan[i].stoff.join(" + ")}`);
    });
    assert.ok(vonKi >= 3, `${vonKi} Aufgaben von der KI`);
    // die Fähigkeit des Platzes, die Zeile ohne Fähigkeit hat keine (zählt für die Note, nicht für den Lernstand)
    tasks.forEach((t, i) => assert.equal(t.skillId, plan[i].skillIds[0] ?? null, `Aufgabe ${i + 1}`));
    const ohne = plan.findIndex((x) => x.stoff.length === 1 && x.stoff[0] === OHNE);
    if (ohne >= 0) assert.equal(tasks[ohne].skillId, null);
    // was die KI nicht oder nicht passend lieferte, hat die App gemacht, und das Ergebnis sagt es
    assert.equal(out.stoff?.zeilen, 11);
    assert.equal(out.stoff?.aufgaben, 8);
    assert.equal(out.stoff?.ersetzt, 8 - vonKi);
    assert.ok((out.stoff?.ersetzt ?? 0) >= 1, "die letzte Aufgabe fehlte");
    assert.equal(out.aiError, undefined);
  } finally {
    router.setTransport(null);
  }

  // ohne KI: trotzdem jede Zeile, die Zeile ohne Fähigkeit als Erklär-Aufgabe zu ihrem Wortlaut
  const ohneKi = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 100, vomStoff: true, useAI: false, seed: 4 });
  assert.ok(ohneKi.aiError);
  assert.equal(ohneKi.stoff?.ersetzt, 12);
  const t12 = repo.listTasks(ohneKi.worksheetId);
  assert.equal(t12.length, 12);
  const plan12 = regeln.planeVomStoff(zeilen, 12);
  const i = plan12.findIndex((x) => x.stoff[0] === OHNE);
  assert.equal(t12[i].skillId, null);
  assert.equal(t12[i].type, "free");
  assert.ok(t12[i].prompt.includes(OHNE), t12[i].prompt);
  assert.ok(ohneKi.ohneKi >= 1);
  assert.equal(repo.getWorksheet(ohneKi.worksheetId)!.source, "generator");

  // Stoff ohne zugeordnete Fähigkeiten: „Aus der App“ geht nicht, vom Stoffzettel schon
  const leer = ps.stoffDerPruefung(testId).map((z) => ({ ...z, skill_id: null, zuordnung: "keine" as const, vorschlaege: [] }));
  ps.speichereStoff(testId, leer);
  repo.setTestSkills(testId, []);
  await assert.rejects(p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, useAI: false }), /Ordne zuerst den Stoff Fähigkeiten zu/);
  const nurStoff = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 25, vomStoff: true, useAI: false, seed: 5 });
  const t5 = repo.listTasks(nurStoff.worksheetId);
  assert.equal(t5.length, 5);
  assert.ok(t5.every((t) => t.skillId === null && t.type === "free"));
  assert.deepEqual(new Set((JSON.parse(repo.getWorksheet(nurStoff.worksheetId)!.settings ?? "{}") as { stoff: string[][] }).stoff.flat()), new Set(zeilen.map((z) => z.text)), "alle 11 Zeilen in 5 Aufgaben");
});

test("ohne gelesenen Stoffzettel: die Themen der Prüfung, mit der verknüpften Fähigkeit, die zu ihnen passt", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const p = await import("./probeschularbeit");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Mia Probe", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const testId = repo.addTest({ student_id: sid, date: "2026-12-01", subject: "Mathematik", kind: "Schularbeit", topic: "", title: "", topics: ["Brüche kürzen", "Prozentrechnung im Alltag"], grade: null, points: null, max_points: null, notes: "", skill_ids: ["mathe.brueche.kuerzen", "mathe.brueche.addieren"], teacher_id: teacher.id });
  const zeilen = p.stoffFuerProbe(testId);
  assert.equal(zeilen.find((z) => z.text === "Brüche kürzen")?.skillId, "mathe.brueche.kuerzen");
  assert.ok(zeilen.some((z) => z.text === "Prozentrechnung im Alltag"));
  // eine verknüpfte Fähigkeit, die kein Thema nennt, kommt auch dran
  assert.ok(zeilen.some((z) => z.skillId === "mathe.brueche.addieren"), zeilen.map((z) => `${z.text}→${z.skillId}`).join(" | "));
  assert.equal(p.stoffZeilenAnzahl(zeilen), 3);
});

test("Aufgabenplan vom Stoff: der Prompt nennt Stoff und Schwierigkeit je Aufgabe, fillPlan legt jede Aufgabe auf ihre Nummer", async () => {
  const { buildPrompt, fillPlan } = await import("./ai/features");
  type AITask = import("./ai/features").AITask;
  const req = {
    subject: "Mathematik",
    level: "3. Klasse Gymnasium",
    skills: [{ id: "mathe.negativ.verbinden", name: "Verbindung der vier Grundrechnungsarten", area: "Negative Zahlen", difficulty: "mittel" as const }],
    count: 3,
    categories: [],
    plan: [
      { skillId: "mathe.negativ.verbinden", category: "rechnung", difficulty: "leicht" as const, stoff: ["Verbindung der vier Grundrechnungsarten"] },
      { skillId: "", category: "offen", difficulty: "mittel" as const, stoff: ["Zehnerpotenzen „und“ Gleitkommadarstellung"] },
      { skillId: "mathe.negativ.verbinden", category: "rechnung", difficulty: "schwer" as const, stoff: ["Rationale Zahlen ordnen", "Addieren"] },
    ],
  };
  const prompt = buildPrompt(req);
  assert.match(prompt, /1\. category=rechnung .*skill_id=mathe\.negativ\.verbinden, Schwierigkeit=leicht, Stoff: „Verbindung der vier Grundrechnungsarten“/);
  assert.match(prompt, /2\. category=offen .*skill_id=keine \(skill_ids leer\), Schwierigkeit=mittel, Stoff: „Zehnerpotenzen und Gleitkommadarstellung“/, "Anführungszeichen aus dem Stoff fallen weg");
  assert.match(prompt, /3\. .*Stoff: „Rationale Zahlen ordnen“ und „Addieren“/);
  assert.match(prompt, /Die Schwierigkeit jeder Aufgabe steht im Aufgabenplan/);
  assert.doesNotMatch(prompt, /Verbindung der vier Grundrechnungsarten – mittel/, "keine Schwierigkeit je Fähigkeit");

  const a = (category: string, topic: string, skill_ids: string[]) => ({ ...aufgabeFuer(category, 0, "x", "mittel"), topic, skill_ids, prompt: `Aufgabe für Platz ${topic}` });
  // vertauscht, mit „Aufgabe 3“ statt 3; die zweite Rechnung ohne passende Nummer bekommt den freien Platz derselben Fähigkeit
  const slots = fillPlan([a("rechnung", "Aufgabe 3", ["mathe.negativ.verbinden"]), a("offen", "2", []), a("rechnung", "7", ["mathe.negativ.verbinden"])] as AITask[], req, () => 0.5);
  assert.equal(slots[2]?.prompt, "Aufgabe für Platz Aufgabe 3");
  assert.equal(slots[1]?.prompt, "Aufgabe für Platz 2");
  assert.equal(slots[0]?.prompt, "Aufgabe für Platz 7");
  // eine freie Aufgabe ohne Nummer landet nie auf dem Platz eines anderen Stoffs
  const rest = fillPlan([a("offen", "", [])] as AITask[], req, () => 0.5);
  assert.deepEqual(rest, [null, null, null]);
});
