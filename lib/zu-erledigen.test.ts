/**
 * „Zu erledigen“ auf der Startseite (lib/zu-erledigen.ts): Zustände aus den Daten, „gesehen“ je Lehrer,
 * Hausübung mit Übung, abgegebene Texte und nur die eigenen Schüler.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const DAY = 86_400_000;
const kid = (name: string, teacherId: number | null) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

async function setup() {
  const repo = await import("./repo");
  const ze = await import("./zu-erledigen");
  const { db } = await import("./db");
  const { wienerDatum, tagAddieren } = await import("./planung/zeit");
  const [niko, thomas] = ["Niko", "Thomas"].map((n) => repo.listTeachers().find((t) => t.name === n)!);
  return { repo, ze, db, niko, thomas, heute: wienerDatum(), tagAddieren };
}

/** Eine Übung mit zwei Aufgaben; fertig() beantwortet beide (die zweite optional als freie Antwort für den Lehrer). */
async function uebung(sid: number, title: string, o: { teacherId?: number | null } = {}) {
  const repo = await import("./repo");
  const w = repo.createWorksheet(
    { title, subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "generator", skill_ids: [], teacher_id: o.teacherId ?? null },
    [1, 2].map(() => ({ type: "calc" as const, skillId: "mathe.brueche.kuerzen", difficulty: "mittel" as const, prompt: "1", data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] })),
  );
  const aid = repo.assignWorksheet(w, sid);
  const tasks = repo.listTasks(w);
  const fertig = (o2: { offen?: boolean } = {}) => {
    const ids = tasks.map((t, i) =>
      repo.recordAttempt({
        assignment_id: aid, task_id: t.id, student_id: sid, skill_id: t.skillId, answer: "1", correct: i === 1 && o2.offen ? 0 : 1, final: 1, attempt_no: 1, time_ms: 10_000, hints_used: 0, solution_viewed: 0,
        error_label: null, feedback: "", review: i === 1 && o2.offen ? "offen" : null,
      }),
    );
    repo.completeAssignmentIfDone(aid);
    return ids;
  };
  return { aid, fertig };
}

const finde = (l: { offen: { key: string }[]; erledigt: { key: string }[] }, key: string) =>
  l.offen.some((p) => p.key === key) ? "offen" : l.erledigt.some((p) => p.key === key) ? "erledigt" : "fehlt";
const zustandVon = (l: { offen: { key: string; zustand: string }[]; erledigt: { key: string; zustand: string }[] }, key: string) => [...l.offen, ...l.erledigt].find((p) => p.key === key)?.zustand ?? null;

test("the state is computed from the data: Offen, Überfällig, Wartet auf Lehrerbewertung, Erledigt", async () => {
  const { ze } = await setup();
  const fertig = "2026-10-20 10:00:00";
  assert.equal(ze.ergebnisZustand({ fertigAm: fertig, zuBewerten: 0, gesehenAm: null }), "offen");
  assert.equal(ze.ergebnisZustand({ fertigAm: fertig, zuBewerten: 0, gesehenAm: "2026-10-20T10:05:00.000Z" }), "erledigt");
  assert.equal(ze.ergebnisZustand({ fertigAm: fertig, zuBewerten: 0, gesehenAm: "2026-10-20T09:00:00.000Z" }), "offen", "seen before it was fertig does not count");
  assert.equal(ze.ergebnisZustand({ fertigAm: fertig, zuBewerten: 2, gesehenAm: "2026-10-21T08:00:00.000Z" }), "wartet", "answers to grade keep it open, seen or not");

  const heute = "2026-10-22";
  assert.equal(ze.hausuebungZustand({ status: "offen", due_date: "2026-10-23", assignment_completed_at: null }, heute), "offen");
  assert.equal(ze.hausuebungZustand({ status: "offen", due_date: heute, assignment_completed_at: null }, heute), "offen", "due today is not overdue yet");
  assert.equal(ze.hausuebungZustand({ status: "offen", due_date: "2026-10-21", assignment_completed_at: null }, heute), "ueberfaellig");
  assert.equal(ze.hausuebungZustand({ status: "erledigt", due_date: "2026-10-21", assignment_completed_at: null }, heute), "erledigt");
  assert.equal(ze.hausuebungZustand({ status: "offen", due_date: "2026-10-21", assignment_completed_at: "2026-10-21 18:00:00" }, heute), "erledigt", "its Übung is fertig");

  assert.equal(ze.textZustand({ status: "offen", abgegebenAm: null, korrigiert: false, gesehenAm: null }), null, "not handed in: not in the list");
  assert.equal(ze.textZustand({ status: "fertig", abgegebenAm: "2026-10-22T08:00:00.000Z", korrigiert: false, gesehenAm: null }), "wartet");
  assert.equal(ze.textZustand({ status: "fertig", abgegebenAm: "2026-10-22T08:00:00.000Z", korrigiert: true, gesehenAm: null }), "erledigt");
  assert.equal(ze.textZustand({ status: "fertig", abgegebenAm: "2026-10-22T08:00:00.000Z", korrigiert: false, gesehenAm: "2026-10-21T08:00:00.000Z" }), "wartet", "handed in again after it was seen");
  assert.equal(ze.ZUSTAND_LABEL.wartet, "Wartet auf Lehrerbewertung");
});

test("a result leaves the open list once the teacher has seen it, stays in Erledigt, and only for that teacher", async () => {
  const { repo, ze, niko, thomas, heute } = await setup();
  const sid = repo.createStudent(kid("Mira Ergebnis", null));
  const { aid, fertig } = await uebung(sid, "Kürzen");
  fertig();
  const key = `a${aid}`;
  assert.equal(zustandVon(ze.zuErledigen(niko.id, heute), key), "offen");

  ze.markiereGesehen(niko.id, "ergebnis", aid, new Date(Date.now() + 1000));
  // a fresh read (a reload) gives the same answer: nothing is kept in memory
  assert.equal(finde(ze.zuErledigen(niko.id, heute), key), "erledigt");
  assert.equal(finde(ze.zuErledigen(niko.id, heute), key), "erledigt");
  assert.equal(finde(ze.zuErledigen(thomas.id, heute), key), "offen", "seen is per teacher");
});

test("a finished exercise with free answers waits for the teacher's grade; graded and opened it is done", async () => {
  const { repo, ze, niko, heute } = await setup();
  const sid = repo.createStudent(kid("Jonas Bewertung", niko.id));
  const { aid, fertig } = await uebung(sid, "Sachaufgabe");
  const [, frei] = fertig({ offen: true });
  assert.ok(repo.getAssignment(aid)!.completed_at, "an answer waiting for the teacher counts as final for the student");

  const key = `a${aid}`;
  const vorher = ze.zuErledigen(niko.id, heute);
  assert.equal(zustandVon(vorher, key), "wartet");
  const p = vorher.offen.find((x) => x.key === key)!;
  assert.equal(p.abhaken, null, "grading is not ticked off");
  const ersteOffen = vorher.offen.findIndex((x) => x.zustand === "offen");
  assert.ok(ersteOffen === -1 || vorher.offen.findIndex((x) => x.key === key) < ersteOffen, "waiting comes before open");

  ze.markiereGesehen(niko.id, "ergebnis", aid, new Date(Date.now() + 1000));
  assert.equal(zustandVon(ze.zuErledigen(niko.id, heute), key), "wartet", "opening alone does not grade");
  repo.setAttemptReview(frei, "richtig", niko.id);
  assert.equal(zustandVon(ze.zuErledigen(niko.id, heute), key), "erledigt");
});

test("only the teacher's own students and exercises: another teacher's student or unit stays out", async () => {
  const { repo, ze, niko, thomas, heute, tagAddieren } = await setup();
  const fremd = repo.createStudent(kid("Theo Fremd", thomas.id));
  const { aid, fertig } = await uebung(fremd, "Fremde Übung");
  fertig();
  repo.addHomework({ student_id: fremd, subject: "Mathematik", description: "Fremde Hausübung", due_date: tagAddieren(heute, -1), status: "offen", notes: "" });
  const hid = repo.listHomework(fremd)[0].id;

  const nikos = ze.zuErledigen(niko.id, heute);
  assert.equal(finde(nikos, `a${aid}`), "fehlt");
  assert.equal(finde(nikos, `h${hid}`), "fehlt");
  const thomas_ = ze.zuErledigen(thomas.id, heute);
  assert.equal(zustandVon(thomas_, `a${aid}`), "offen");
  assert.equal(zustandVon(thomas_, `h${hid}`), "ueberfaellig");

  // Niko made the exercise for Thomas' student: it is Niko's
  const { aid: nikosUebung, fertig: f2 } = await uebung(fremd, "Von Niko", { teacherId: niko.id });
  f2();
  assert.equal(zustandVon(ze.zuErledigen(niko.id, heute), `a${nikosUebung}`), "offen");
  assert.equal(finde(ze.zuErledigen(thomas.id, heute), `a${nikosUebung}`), "fehlt");
});

test("homework: open until due, then overdue; done by hand or when its linked exercise is finished", async () => {
  const { repo, ze, niko, heute, tagAddieren } = await setup();
  const sid = repo.createStudent(kid("Lea Hausübung", niko.id));
  const { aid, fertig } = await uebung(sid, "Hausübung Brüche");
  repo.addHomework({ student_id: sid, subject: "Mathematik", description: "Übung am Handy", due_date: tagAddieren(heute, -2), status: "offen", notes: "", assignment_id: aid });
  repo.addHomework({ student_id: sid, subject: "Mathematik", description: "Buch S. 12", due_date: tagAddieren(heute, 1), status: "offen", notes: "" });
  repo.addHomework({ student_id: sid, subject: "Mathematik", description: "Später", due_date: tagAddieren(heute, 9), status: "offen", notes: "" });
  const [mitUebung, buch, spaeter] = ["Übung am Handy", "Buch S. 12", "Später"].map((d) => repo.listHomework(sid).find((h) => h.description === d)!);
  assert.equal(mitUebung.assignment_title, "Hausübung Brüche");

  let l = ze.zuErledigen(niko.id, heute);
  assert.equal(zustandVon(l, `h${mitUebung.id}`), "ueberfaellig");
  assert.equal(zustandVon(l, `h${buch.id}`), "offen");
  assert.equal(finde(l, `h${spaeter.id}`), "fehlt", "not due yet: not in the list");
  assert.equal(l.offen[0].key, `h${mitUebung.id}`, "overdue first");

  fertig();
  repo.setHomeworkStatus(buch.id, "erledigt");
  l = ze.zuErledigen(niko.id, heute);
  assert.equal(zustandVon(l, `h${mitUebung.id}`), "erledigt", "the student finished the linked exercise");
  assert.equal(zustandVon(l, `h${buch.id}`), "erledigt");
  assert.equal(repo.listHomework(sid).filter(repo.homeworkOpen).length, 1, "only „Später“ is still open in the profile");
  const p = l.erledigt.find((x) => x.key === `h${mitUebung.id}`)!;
  assert.equal(p.href, `/schueler/${sid}/ergebnis/${aid}`, "a done homework with exercise opens its result");
});

test("every Textarbeit can be handed in; it waits for the teacher until corrected or ticked off", async () => {
  const { repo, ze, db, niko, thomas, heute } = await setup();
  const { createText, saveText } = await import("./texts");
  const { handleHandIn } = await import("./text-routes");
  const sid = repo.createStudent(kid("Ella Text", niko.id));
  const t = createText({ studentId: sid, teacherId: niko.id, unitId: null, subject: "Deutsch", topic: "Erlebniserzählung", title: "Mein Ausflug", prompt: "" });
  const saved = saveText(t.id, [{ t: "p", r: [{ x: "Wir sind in den Wald gegangen." }] }], 0);
  assert.ok(saved.ok);

  // a plain text (no Bildgeschichte, no Schreibauftrag) is handed in like the others
  const req = new Request("http://localhost/geraet/text/abgeben", { method: "POST", body: JSON.stringify({ version: saved.ok ? saved.version : 0 }) });
  const res = await handleHandIn(req, t.id, { mayWrite: () => true });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  const key = `t${t.id}`;
  const l = ze.zuErledigen(niko.id, heute);
  assert.equal(zustandVon(l, key), "wartet");
  assert.deepEqual(l.offen.find((p) => p.key === key)!.abhaken, { art: "text", id: t.id, studentId: sid });

  ze.markiereGesehen(niko.id, "text", t.id, new Date(Date.now() + 1000));
  assert.equal(zustandVon(ze.zuErledigen(niko.id, heute), key), "erledigt");

  // a correction of the handed-in version closes it for every teacher (here a shared student, so Thomas sees it too)
  db().prepare("UPDATE students SET teacher_id = NULL WHERE id = ?").run(sid);
  db().prepare("UPDATE texts SET teacher_id = NULL WHERE id = ?").run(t.id);
  assert.equal(zustandVon(ze.zuErledigen(thomas.id, heute), key), "wartet");
  const v = db().prepare("SELECT version FROM texts WHERE id = ?").get(t.id) as { version: number };
  db().prepare("INSERT INTO text_corrections (text_id, version, body, created_at, updated_at) VALUES (?, ?, '', ?, ?)").run(t.id, v.version, new Date().toISOString(), new Date().toISOString());
  assert.equal(zustandVon(ze.zuErledigen(thomas.id, heute), key), "erledigt");
});

test("old results drop out after the window, but answers still waiting for a grade stay", async () => {
  const { repo, ze, db, niko, heute } = await setup();
  const sid = repo.createStudent(kid("Paul Alt", niko.id));
  const alt = await uebung(sid, "Alt angesehen");
  alt.fertig();
  const wartet = await uebung(sid, "Alt zu bewerten");
  wartet.fertig({ offen: true });
  const lange = new Date(Date.now() - (ze.FENSTER_TAGE + 3) * DAY).toISOString().replace("T", " ").slice(0, 19);
  db().prepare("UPDATE assignments SET completed_at = ? WHERE id IN (?, ?)").run(lange, alt.aid, wartet.aid);
  const l = ze.zuErledigen(niko.id, heute);
  assert.equal(finde(l, `a${alt.aid}`), "fehlt");
  assert.equal(zustandVon(l, `a${wartet.aid}`), "wartet");
});
