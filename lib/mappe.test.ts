import assert from "node:assert/strict";
import test from "node:test";
import type * as repo from "./repo";

process.env.DATABASE_PATH = ":memory:";

type Aufgabe = Pick<repo.Task, "type" | "data" | "answer" | "prompt">;
const aufgabe = (o: Partial<Aufgabe>): Aufgabe => ({ type: "calc", data: {}, answer: {}, prompt: "Berechne.", ...o });

test("answers are read the way each answer format stores them", async () => {
  const { leseAntwort } = await import("./mappe");
  const wahl = aufgabe({ type: "mc", data: { options: ["1/2", "2/4", "3/4"] }, answer: { correct: 0 } });
  assert.deepEqual(leseAntwort(wahl, "2"), { art: "wahl", index: 2 });
  assert.deepEqual(leseAntwort(wahl, ""), { art: "wahl", index: null }, "nothing ticked");
  assert.deepEqual(leseAntwort(wahl, "7"), { art: "wahl", index: null }, "no such option");

  const reihe = aufgabe({ type: "order", data: { steps: ["Kürzen", "Erweitern", "Addieren"] }, answer: { steps: [] } });
  assert.deepEqual(leseAntwort(reihe, "[1,2,0]"), { art: "reihe", schritte: ["Erweitern", "Addieren", "Kürzen"] });
  assert.deepEqual(leseAntwort(reihe, "Erweitern"), { art: "text", text: "Erweitern" }, "an older plain answer stays readable");

  const luecken = aufgabe({ type: "cloze", prompt: "Ich ___ nach Hause, weil es ___ ist.", answer: { blanks: [["gehe"], ["spät"]] } });
  assert.deepEqual(leseAntwort(luecken, '["gehe","früh"]'), { art: "luecken", werte: ["gehe", "früh"] });

  const weg = aufgabe({ type: "rechenweg", data: { start: "3x + 7 = 22" } });
  assert.deepEqual(leseAntwort(weg, JSON.stringify({ steps: ["3x = 15", "  "], result: " x = 5 " })), { art: "rechnung", schritte: ["3x = 15"], ergebnis: "x = 5", tafel: false });
  assert.deepEqual(leseAntwort(weg, JSON.stringify({ result: "5", board: true })), { art: "rechnung", schritte: [], ergebnis: "5", tafel: true });

  const sach = aufgabe({ type: "sachaufgabe", data: { parts: [{ label: "a)", prompt: "Wie viel?", kind: "zahl" }, { label: "b)", prompt: "Warum?", kind: "text" }] as never } });
  assert.deepEqual(leseAntwort(sach, JSON.stringify({ parts: [{ steps: ["12 · 3 = 36"], result: "36 €" }, { text: "Weil es billiger ist." }] })), {
    art: "teile",
    teile: [
      { schritte: ["12 · 3 = 36"], ergebnis: "36 €", text: "" },
      { schritte: [], ergebnis: "", text: "Weil es billiger ist." },
    ],
  });

  assert.deepEqual(leseAntwort(aufgabe({ type: "free" }), "Mein Satz.\nZweite Zeile."), { art: "text", text: "Mein Satz.\nZweite Zeile." });
});

test("a short answer goes into the only gap of the task, not under it", async () => {
  const { inDieLuecke, leseAntwort } = await import("./mappe");
  const luecke = aufgabe({ prompt: "3/4 + 1/4 = ___", answer: { accepted: ["1"] } });
  assert.equal(inDieLuecke(luecke, leseAntwort(luecke, "1")), true);
  const ohne = aufgabe({ prompt: "Kürze 4/8.", answer: { accepted: ["1/2"] } });
  assert.equal(inDieLuecke(ohne, leseAntwort(ohne, "1/2")), false);
  const zwei = aufgabe({ prompt: "___ + ___ = 5", answer: { accepted: ["2 + 3"] } });
  assert.equal(inDieLuecke(zwei, leseAntwort(zwei, "2 + 3")), false);
});

test("print settings live in the address; only changes are written", async () => {
  const { leseMappeOptionen, mappeQuery } = await import("./mappe-druck");
  const o = leseMappeOptionen({}, "Einheit vom 19. Oktober 2026");
  assert.equal(o.marks, true);
  assert.equal(o.solutions, true);
  assert.equal(o.open, false, "untouched tasks stay out unless chosen");
  assert.equal(o.date, false, "the date is in the title already");
  assert.equal(mappeQuery(o, o.title), "");
  const geaendert = { ...o, marks: false, open: true, title: "Bruchrechnen" };
  const q = mappeQuery(geaendert, "Einheit vom 19. Oktober 2026");
  assert.deepEqual(leseMappeOptionen(Object.fromEntries(new URLSearchParams(q)), "Einheit vom 19. Oktober 2026"), geaendert);
});

test("the Mappe of a unit: every exercise worked on in it, with the student's answers; nothing from other units", async () => {
  const repo = await import("./repo");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const units = await import("./units");
  const learning = await import("./learning");
  const texts = await import("./texts");
  const { mappeFuerEinheit, mappeHatInhalt, mappeTitel } = await import("./mappe");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Lena Probe", grade: 5, klasse: 1, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik", "Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  const blatt = async (count: number) =>
    (await buildWorksheet({ subject: "Mathematik", schoolType: "Mittelschule", klasse: 1, skillIds: ["mathe.brueche.kuerzen"], difficulty: "leicht", count, taskType: "calc", useAI: false })).id;
  const richtig = (t: repo.Task) => t.answer.accepted?.[0] ?? "";
  const falsch = (t: repo.Task) => (t.errorMap[0]?.answer && t.errorMap[0].answer !== richtig(t) ? t.errorMap[0].answer : "999");
  const antworte = (aid: number, t: repo.Task, answer: string, giveUp = false) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer, timeMs: 20_000, activeMs: 20_000, hintsUsed: 0, giveUp });

  // an earlier unit with its own exercise: it does not belong in today's Mappe
  // (started less than 3 h ago: an older running unit would be ended as idle on the first answer)
  const frueher = units.startUnit(teacher.id, sid, { at: Date.now() - 2 * 60 * 60_000, subject: "Mathematik" }).unit;
  const altBlatt = await blatt(2);
  const altAid = repo.assignWorksheet(altBlatt, sid, "", frueher.id);
  for (const t of repo.listTasks(altBlatt)) await antworte(altAid, t, richtig(t));
  assert.equal(repo.listAttemptsForUnit(frueher.id).length, 2);
  learning.endUnit(frueher.id, { byTeacherId: teacher.id });

  const { unit } = units.startUnit(teacher.id, sid, { at: Date.now() - 50 * 60_000, subject: "Mathematik" });
  const wid = await blatt(5);
  const aid = repo.assignWorksheet(wid, sid, "", unit.id);
  const [t0, t1, t2, , t4] = repo.listTasks(wid);
  await antworte(aid, t0, richtig(t0)); // right at once
  await antworte(aid, t1, falsch(t1));
  await antworte(aid, t1, richtig(t1)); // right at the second try
  await antworte(aid, t2, falsch(t2)); // wrong, the unit ended before the next try
  await antworte(aid, t4, "", true); // gave up and looked at the solution
  // sent in the unit, never started: only as practice, printed empty
  const offenAid = repo.assignWorksheet(await blatt(3), sid, "", unit.id);
  const text = texts.createText({ studentId: sid, teacherId: teacher.id, unitId: unit.id, subject: "Deutsch", topic: "Erlebniserzählung", title: "Mein Ausflug", prompt: "Erzähle von einem Ausflug." });
  texts.saveText(text.id, [{ t: "p", r: [{ x: "Am Sonntag waren wir am See." }] }], text.version);
  learning.endUnit(unit.id, { byTeacherId: teacher.id });

  const m = mappeFuerEinheit(unit.id)!;
  assert.ok(mappeHatInhalt(m));
  assert.equal(m.uebungen.length, 1, "only the exercise of this unit");
  const u = m.uebungen[0];
  assert.equal(u.assignmentId, aid);
  assert.deepEqual(
    u.aufgaben.map((a) => a.bewertung),
    ["richtig", "richtig", "falsch", "nicht", "loesung"],
  );
  assert.equal(u.aufgaben[1].versuch, 2, "corrected at the second try");
  assert.deepEqual(u.aufgaben[2].antwort, { art: "text", text: falsch(t2) });
  assert.equal(u.aufgaben[3].antwort, null);
  assert.equal(u.bearbeitet, 4);
  assert.equal(u.richtig, 2);
  assert.deepEqual(m.unbearbeitet.map((x) => x.assignmentId), [offenAid]);
  assert.deepEqual(m.texte.map((x) => x.text.title), ["Mein Ausflug"]);
  assert.equal(m.texte[0].doc[0].r[0].x, "Am Sonntag waren wir am See.");
  assert.deepEqual(m.faecher.sort(), ["Deutsch", "Mathematik"]);
  assert.match(mappeTitel(unit), /^Einheit vom \d{2}\.\d{2}\.\d{4}$/);

  // a unit without anything on the device has nothing to print
  const leer = units.startUnit(teacher.id, sid, { at: Date.now() - 5 * 60_000 }).unit;
  learning.endUnit(leer.id, { byTeacherId: teacher.id });
  assert.equal(mappeHatInhalt(mappeFuerEinheit(leer.id)!), false);
  assert.equal(mappeFuerEinheit(999_999), null);
});
