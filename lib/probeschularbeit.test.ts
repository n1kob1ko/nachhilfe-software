/**
 * Probeschularbeit (niko, 19.10.2026): „Ein ganzer Test zum Stoffzettel mit Punkten und Notenschlüssel, als
 * A4 zum Drucken.“ Aufbau, Punkte, Notenschlüssel, Erstellen ohne und mit KI, am Gerät wie ein Minitest,
 * Punkte und Note im Ergebnis.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der KI-Transport wird ersetzt und schreibt mit, was gefragt wurde.
 * Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

test("leichte Aufgaben zuerst, schwere am Ende; die Fähigkeiten reihum", async () => {
  const { schwierigkeiten, planeProbeschularbeit, ANZAHL } = await import("./probeschularbeit-regeln");
  assert.deepEqual(schwierigkeiten(5), ["leicht", "leicht", "mittel", "mittel", "schwer"]);
  assert.deepEqual(schwierigkeiten(8), ["leicht", "leicht", "mittel", "mittel", "mittel", "mittel", "schwer", "schwer"]);
  const zwoelf = schwierigkeiten(12);
  assert.deepEqual([zwoelf.filter((d) => d === "leicht").length, zwoelf.filter((d) => d === "mittel").length, zwoelf.filter((d) => d === "schwer").length], [4, 6, 2]);
  assert.deepEqual(schwierigkeiten(3), ["leicht", "mittel", "mittel"], "unter vier Aufgaben keine schwere");
  assert.deepEqual(schwierigkeiten(0), []);
  assert.deepEqual(Object.values(ANZAHL), [5, 8, 12]);

  const plan = planeProbeschularbeit(["a", "b", "c", "a"], 8);
  assert.equal(plan.length, 8);
  assert.deepEqual(plan.map((p) => p.skillId), ["a", "b", "c", "a", "b", "c", "a", "b"], "doppelte Fähigkeiten zählen einmal");
  assert.deepEqual(planeProbeschularbeit([], 8), []);
});

test("Punkte nach Schwierigkeit, Notenschlüssel in halben Punkten", async () => {
  const { standardPunkte, schluesselTabelle, noteFuer, notenBereiche, bereichText, punkteText, SCHLUESSEL_STANDARD } = await import("./probeschularbeit-regeln");
  assert.equal(standardPunkte({ difficulty: "leicht", type: "calc", data: {} }), 2);
  assert.equal(standardPunkte({ difficulty: "mittel", type: "mc", data: {} }), 3);
  assert.equal(standardPunkte({ difficulty: "schwer", type: "calc", data: {} }), 4);
  assert.equal(standardPunkte({ difficulty: "mittel", type: "sachaufgabe", data: { parts: [{ label: "a)", prompt: "", kind: "zahl" }, { label: "b)", prompt: "", kind: "zahl" }, { label: "c)", prompt: "", kind: "text" }] } }), 5, "je weiterem Teil ein Punkt mehr");

  assert.deepEqual(schluesselTabelle(24, SCHLUESSEL_STANDARD).map((z) => z.ab), [21, 18, 15, 12, null]);
  // 25 Punkte: 21,875 → 22; 18,75 → 19; 15,625 → 16; 12,5 bleibt
  assert.deepEqual(schluesselTabelle(25, SCHLUESSEL_STANDARD).map((z) => z.ab), [22, 19, 16, 12.5, null]);
  assert.equal(noteFuer(24, 24, SCHLUESSEL_STANDARD).note, 1);
  assert.equal(noteFuer(21, 24, SCHLUESSEL_STANDARD).note, 1);
  assert.equal(noteFuer(20.5, 24, SCHLUESSEL_STANDARD).note, 2);
  assert.equal(noteFuer(12, 24, SCHLUESSEL_STANDARD).note, 4);
  assert.equal(noteFuer(11.5, 24, SCHLUESSEL_STANDARD).label, "Nicht genügend");
  assert.deepEqual(notenBereiche(24, SCHLUESSEL_STANDARD).map(bereichText), ["21–24", "18–20,5", "15–17,5", "12–14,5", "0–11,5"]);
  // sehr wenige Punkte: keine Note ohne Punkte, kein „4–3,5“
  for (const b of notenBereiche(3, SCHLUESSEL_STANDARD)) assert.ok(b.bis >= b.von, bereichText(b));
  assert.equal(punkteText(12.5), "12,5");
  assert.equal(punkteText(3), "3");
});

test("der Notenschlüssel lässt sich ändern: vier verschiedene Prozentwerte", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const { notenschluessel, setNotenschluessel, SCHLUESSEL_STANDARD, noteFuer } = await import("./probeschularbeit");
  assert.deepEqual(notenschluessel(), SCHLUESSEL_STANDARD);
  setNotenschluessel([50, 91, 80, 65]);
  assert.deepEqual(notenschluessel(), [91, 80, 65, 50], "sortiert, die beste Note zuerst");
  assert.equal(noteFuer(20, 22).note, 2, "der gespeicherte Schlüssel gilt");
  assert.throws(() => setNotenschluessel([90, 80, 70]), /Vier Prozentwerte/);
  assert.throws(() => setNotenschluessel([90, 80, 80, 50]), /verschieden/);
  assert.throws(() => setNotenschluessel([90, 80, 70, 0]), /Vier Prozentwerte/);
  assert.deepEqual(notenschluessel(), [91, 80, 65, 50], "ein Fehler ändert nichts");
});

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Lina Probe", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const schularbeit = (skill_ids: string[]) =>
    repo.addTest({ student_id: sid, date: inDays(9), subject: "Mathematik", kind: "Schularbeit", topic: "", title: "2. Schularbeit", topics: ["Brüche"], grade: null, points: null, max_points: null, notes: "", skill_ids, teacher_id: teacher.id });
  return { repo, teacher, sid, schularbeit };
}

test("ohne zugeordneten Stoff gibt es keine Probeschularbeit", async () => {
  const { teacher, schularbeit } = await setup();
  const { erstelleProbeschularbeit } = await import("./probeschularbeit");
  await assert.rejects(erstelleProbeschularbeit({ testId: schularbeit([]), teacherId: teacher.id, useAI: false }), /Ordne zuerst den Stoff Fähigkeiten zu/);
});

test("Probeschularbeit ohne KI: ein Entwurf zur Schularbeit, leicht bis schwer, jede Fähigkeit dabei", async () => {
  const { repo, teacher, sid, schularbeit } = await setup();
  const p = await import("./probeschularbeit");
  const skills = ["mathe.brueche.kuerzen", "mathe.brueche.addieren", "mathe.brueche.multiplizieren"];
  const testId = schularbeit(skills);
  const out = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 50, useAI: false, seed: 7 });
  assert.equal(out.aiError, undefined);
  assert.equal(out.ohneKi, 0, "alle drei haben eingebaute Aufgaben");
  const w = repo.getWorksheet(out.worksheetId)!;
  assert.equal(w.status, "entwurf");
  assert.equal(w.kind, "ueberpruefung");
  assert.equal(w.student_id, sid);
  assert.equal(w.probe_test_id, testId);
  assert.match(w.title, /^Lina – Probeschularbeit: 2\. Schularbeit$/);
  assert.equal(p.dauerVon(w), 50);
  const tasks = repo.listTasks(w.id);
  assert.equal(tasks.length, 8, "50 Minuten sind 8 Aufgaben");
  assert.deepEqual(tasks.map((t) => t.difficulty), p.schwierigkeiten(8));
  assert.deepEqual(new Set(tasks.map((t) => t.skillId)), new Set(skills));
  const { taskKey } = await import("./diagnose");
  assert.equal(new Set(tasks.map(taskKey)).size, tasks.length, "keine Aufgabe doppelt");
  // schwere Plätze bekommen die aufwendigeren Aufgaben, leichte die kurzen
  assert.ok(tasks.filter((t) => t.difficulty === "schwer").every((t) => t.type === "rechenweg" || t.type === "sachaufgabe"), tasks.map((t) => `${t.difficulty}:${t.type}`).join(" "));
  assert.ok(tasks.filter((t) => t.difficulty === "leicht").every((t) => t.type !== "sachaufgabe"));

  // Punkte: Vorgabe, dann vom Lehrer geändert
  const punkte = p.punkteDerAufgaben(w.id);
  assert.deepEqual([...punkte.values()], tasks.map((t) => p.standardPunkte(t)));
  p.setzePunkte(tasks[0].id, 2.4);
  assert.equal(p.punkteDerAufgaben(w.id).get(tasks[0].id), 2.5, "auf halbe Punkte gerundet");
  assert.throws(() => p.setzePunkte(tasks[0].id, 0), /0,5 bis 20/);
  assert.throws(() => p.setzePunkte(tasks[0].id, 21), /0,5 bis 20/);

  // fürs Blatt: Punkte in der Reihenfolge, Summe, Notenschlüssel, Arbeitszeit
  const blatt = p.blattDaten(w, tasks)!;
  assert.equal(blatt.punkte.length, 8);
  assert.equal(blatt.gesamt, blatt.punkte.reduce((s, x) => s + x, 0));
  assert.equal(blatt.bereiche[0].bis, blatt.gesamt);
  assert.equal(blatt.dauer, 50);
  // eine gewöhnliche Übung hat das nicht
  const other = repo.createWorksheet({ title: "Brüche", subject: "Mathematik", grade: 7, school_type: "Mittelschule", klasse: 3, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [] }, []);
  assert.equal(p.blattDaten(repo.getWorksheet(other)!, []), null);

  // 25 und 100 Minuten
  const kurz = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 25, useAI: false, seed: 8 });
  assert.equal(repo.listTasks(kurz.worksheetId).length, 5);
  const lang = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 100, useAI: false, seed: 9 });
  assert.equal(repo.listTasks(lang.worksheetId).length, 12);
  // die Vorbereitung listet alle, die neueste zuerst
  assert.deepEqual(p.probeschularbeitenZu(testId).map((x) => x.worksheet.id), [lang.worksheetId, kurz.worksheetId, out.worksheetId]);
});

test("am Gerät wie ein Minitest; im Ergebnis Punkte und Note, offene Aufgaben halten die Note zurück", async () => {
  const { repo, teacher, sid, schularbeit } = await setup();
  const p = await import("./probeschularbeit");
  const { releaseWorksheet } = await import("./builder");
  const testId = schularbeit(["mathe.brueche.kuerzen", "mathe.brueche.addieren"]);
  const { worksheetId } = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 25, useAI: false, seed: 3 });
  const tasks = repo.listTasks(worksheetId);

  // jeder Weg des Sendens gibt den Modus 'test', auch mit dem Wunsch nach einer Schnellrunde
  const sent = releaseWorksheet(worksheetId, sid, { quickRound: true });
  assert.equal(sent.mode, "test");
  const aid = sent.assignmentId!;
  assert.equal(repo.getAssignment(aid)!.mode, "test");
  assert.equal(repo.getAssignment(repo.assignWorksheet(worksheetId, sid))!.mode, "test");

  const punkte = p.punkteDerAufgaben(worksheetId);
  const gesamt = [...punkte.values()].reduce((s, x) => s + x, 0);
  const antworte = (i: number, correct: boolean, review: string | null = null) =>
    repo.recordAttempt({ assignment_id: aid, task_id: tasks[i].id, student_id: sid, skill_id: tasks[i].skillId, attempt_no: 1, answer: "x", correct: correct ? 1 : 0, final: 1, time_ms: 1000, hints_used: 0, solution_viewed: 0, error_label: null, feedback: "", review });

  assert.deepEqual(p.ergebnis(aid), { erreicht: 0, gesamt, offen: 0, bearbeitet: 0, aufgaben: 5, note: null });
  antworte(0, true);
  antworte(1, false);
  const halb = antworte(2, false);
  assert.ok(repo.setAttemptReview(halb, "teilweise", teacher.id));
  antworte(3, true);
  antworte(4, false, "offen");
  const zwischen = p.ergebnis(aid)!;
  const erwartet = punkte.get(tasks[0].id)! + Math.round(punkte.get(tasks[2].id)!) / 2 + punkte.get(tasks[3].id)!;
  assert.equal(zwischen.erreicht, erwartet);
  assert.equal(zwischen.offen, 1);
  assert.equal(zwischen.note, null, "noch eine Aufgabe zu bewerten");

  const offen = repo.listAttemptsForAssignment(aid).find((a) => a.task_id === tasks[4].id)!;
  assert.ok(repo.setAttemptReview(offen.id, "richtig", teacher.id));
  const fertig = p.ergebnis(aid)!;
  assert.equal(fertig.erreicht, erwartet + punkte.get(tasks[4].id)!);
  assert.equal(fertig.offen, 0);
  assert.deepEqual(fertig.note, p.noteFuer(fertig.erreicht, gesamt));
  assert.equal(p.probeschularbeitenZu(testId)[0].ergebnis?.note?.note, fertig.note!.note);

  // eine gewöhnliche Übung bleibt beim üblichen Ablauf
  const normal = repo.createWorksheet({ title: "Brüche", subject: "Mathematik", grade: 7, school_type: "Mittelschule", klasse: 3, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [] }, [tasks[0]]);
  assert.equal(repo.getAssignment(repo.assignWorksheet(normal, sid))!.mode, "normal");
});

test("Fähigkeiten ohne eingebaute Aufgaben: mit KI eine Anfrage ohne Namen, ohne KI Erklär-Aufgaben", async () => {
  const { repo, teacher, schularbeit } = await setup();
  const p = await import("./probeschularbeit");
  const { hasBuiltInGenerator } = await import("./generators");
  const ohne = repo.listSkills().find((s) => s.subject === "Mathematik" && !hasBuiltInGenerator(s.id));
  assert.ok(ohne, "eine Mathe-Fähigkeit ohne Generator");
  const testId = schularbeit(["mathe.brueche.kuerzen", ohne.id]);

  // ohne KI: Erklär-Aufgaben, die Vorschau sagt wie viele
  const ohneKi = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 25, useAI: false, seed: 1 });
  const zuErklaeren = repo.listTasks(ohneKi.worksheetId).filter((t) => t.skillId === ohne.id);
  assert.equal(ohneKi.ohneKi, zuErklaeren.length);
  assert.ok(ohneKi.ohneKi > 0);

  // mit KI: eine Anfrage, nur Fach, Stufe und Fähigkeiten, kein Name
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    const tasks = ["leicht", "mittel", "schwer"].map((difficulty, i) => ({
      category: "free", format: "free", skill_ids: [ohne.id], topic: ohne.area, difficulty, prompt: `Erkläre an einem Beispiel Nummer ${i + 1}.`, passage: null, options: null, correct_option: null,
      accepted_answers: null, numeric: false, blanks: null, sample_answer: `Zum Beispiel ${i + 2}/${i + 3}: Zähler und Nenner werden mit derselben Zahl gerechnet.`, steps: null, case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null,
      answer_lines: 3, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null, criteria: ["Beispiel stimmt"], solution: "", solution_steps: [], estimated_time_sec: 120, hints: [], common_errors: [],
    }));
    return { parsed: { tasks }, refusal: false, model: req.model, usage: { input: 2_000, output: 800, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  try {
    const mitKi = await p.erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 25, useAI: true, seed: 1 });
    assert.equal(gefragt.length, 1, "eine Anfrage für alle");
    const text = JSON.stringify(gefragt[0]);
    assert.ok(!text.includes("Lina"), "kein Name an die KI");
    assert.ok(text.includes(ohne.id));
    assert.ok(!text.includes("mathe.brueche.kuerzen"), "Fähigkeiten mit Generator fragen nicht die KI");
    assert.equal(mitKi.aiError, undefined);
    assert.equal(mitKi.ohneKi, 0);
    const vonKi = repo.listTasks(mitKi.worksheetId).filter((t) => t.skillId === ohne.id);
    assert.ok(vonKi.length > 0 && vonKi.every((t) => t.prompt.startsWith("Erkläre an einem Beispiel")));
    assert.deepEqual(repo.listTasks(mitKi.worksheetId).map((t) => t.difficulty), p.schwierigkeiten(5), "die Schwierigkeit des Platzes bleibt");
    assert.equal(repo.getWorksheet(mitKi.worksheetId)!.source, "ki");
  } finally {
    router.setTransport(null);
  }
});
