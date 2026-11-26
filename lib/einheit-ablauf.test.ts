import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("auswerten: the last attempt of each task counts; right only without the solution; unanswered tasks count as open", async () => {
  const { auswerten } = await import("./einheit-ablauf");
  const v = (task_id: number, skill_id: string, correct: number, final: number, solution_viewed = 0) => ({ task_id, skill_id, correct, final, solution_viewed });
  const e = auswerten(
    [
      v(1, "a", 0, 0),
      v(1, "a", 1, 1), // right on the second try
      v(2, "a", 0, 1), // wrong to the end
      v(3, "b", 1, 1, 1), // solution viewed: not right
      v(4, "b", 0, 0), // still trying: not done
    ],
    [
      { id: 1, skillId: "a" },
      { id: 2, skillId: "a" },
      { id: 3, skillId: "b" },
      { id: 4, skillId: "b" },
      { id: 5, skillId: "b" },
    ],
    (id) => id.toUpperCase(),
  );
  assert.deepEqual({ aufgaben: e.aufgaben, fertig: e.fertig, richtig: e.richtig, falsch: e.falsch }, { aufgaben: 5, fertig: 3, richtig: 1, falsch: 2 });
  assert.deepEqual(
    e.themen.map((t) => [t.skillId, t.name, t.aufgaben, t.fertig, t.richtig, t.falsch]),
    [
      ["b", "B", 3, 1, 0, 1],
      ["a", "A", 2, 2, 1, 1],
    ],
  );
});

test("naechsteUebung: the newest result per topic counts; errors first (current topic first), then a topic not practised yet, then the current one again", async () => {
  const { naechsteUebung } = await import("./einheit-ablauf");
  const repo = await import("./repo");
  const [x, y, z] = repo
    .listSkills()
    .filter((s) => s.subject === "Mathematik")
    .slice(0, 3)
    .map((s) => s.id);
  const thema = (skillId: string, richtig: number, falsch: number) => ({ skillId, name: skillId, aufgaben: richtig + falsch, fertig: richtig + falsch, richtig, falsch });
  const mit = (...themen: ReturnType<typeof thema>[]) => ({ aufgaben: 0, fertig: 0, richtig: 0, falsch: 0, themen });

  // Kurztest: errors in y and z, the current topic is z
  assert.deepEqual(naechsteUebung({ skillIds: [x, y, z], aktuell: z }, mit(thema(y, 1, 3), thema(z, 2, 1)), []), { skillId: z, art: "fehler" });
  // an exercise on z with errors again: still z
  assert.deepEqual(naechsteUebung({ skillIds: [x, y, z], aktuell: z }, mit(thema(y, 1, 3), thema(z, 2, 1)), [mit(thema(z, 6, 2))]), { skillId: z, art: "fehler" });
  // the next exercise on z without errors: y with errors from the Kurztest comes next
  assert.deepEqual(naechsteUebung({ skillIds: [x, y, z], aktuell: z }, mit(thema(y, 1, 3), thema(z, 2, 1)), [mit(thema(z, 6, 2)), mit(thema(z, 5, 0))]), { skillId: y, art: "fehler" });
  // no errors anywhere: the first topic of today that was not practised yet (the Kurztest is no practice)
  assert.deepEqual(naechsteUebung({ skillIds: [x, y], aktuell: x }, mit(thema(x, 3, 0)), [mit(thema(x, 5, 0))]), { skillId: y, art: "neu" });
  // everything practised well: the current topic again
  assert.deepEqual(naechsteUebung({ skillIds: [x, y], aktuell: y }, null, [mit(thema(x, 5, 0)), mit(thema(y, 4, 0))]), { skillId: y, art: "nochmal" });
  // an exercise sent but not answered yet changes nothing
  assert.deepEqual(naechsteUebung({ skillIds: [x], aktuell: x }, mit(thema(x, 1, 2)), [{ ...mit(), themen: [{ ...thema(x, 0, 0), aufgaben: 6 }] }]), { skillId: x, art: "fehler" });
  // nothing at all
  assert.equal(naechsteUebung({ skillIds: [], aktuell: null }, null, []), null);
});

test("the guided flow: new unit starts guided; weiter → Kurztest, neu → Stoff; stages only on the chosen path; Mehr Werkzeuge switches the view", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const ab = await import("./einheit-ablauf");
  const { sendeAusGenerator } = await import("./cockpit");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Lea Ablauf", grade: 5, klasse: 1, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const { unit } = units.startUnit(teacher.id, sid, { subject: "Mathematik" });

  // a fresh unit shows the guided flow at the start, without a path
  assert.equal(ab.zeigtGefuehrt(unit.id), true);
  const a0 = ab.leseAblauf(unit.id);
  assert.deepEqual([a0.weg, a0.stufe, a0.gespeichert], [null, "start", false]);
  assert.deepEqual(ab.stufenFuer(null), ["start", "stoff", "erklaeren", "ueben", "schluss"]);
  assert.ok("fehler" in ab.setzeStufe(unit.id, "ueben"), "no stage before the start question is answered");

  // same topic as last time: Kurztest next; Erklären is not on this path
  assert.deepEqual(ab.waehleWeg(unit.id, "weiter", ["mathe.brueche.kuerzen", "gibt.es.nicht"]), { ok: true });
  const a1 = ab.leseAblauf(unit.id);
  assert.deepEqual([a1.weg, a1.stufe, a1.skillIds, a1.aktuell], ["weiter", "kurztest", ["mathe.brueche.kuerzen"], "mathe.brueche.kuerzen"]);
  assert.ok("fehler" in ab.setzeStufe(unit.id, "erklaeren"));
  assert.deepEqual(ab.setzeStufe(unit.id, "ueben"), { ok: true });

  // back to the start resets the path; a new topic goes to the photos
  ab.setzeStufe(unit.id, "start");
  assert.equal(ab.leseAblauf(unit.id).weg, null);
  ab.waehleWeg(unit.id, "neu");
  assert.equal(ab.leseAblauf(unit.id).stufe, "stoff");
  ab.setzeThemen(unit.id, ["mathe.brueche.kuerzen", "mathe.brueche.erweitern"]);
  assert.equal(ab.leseAblauf(unit.id).aktuell, "mathe.brueche.kuerzen");
  ab.setzeAktuell(unit.id, "mathe.brueche.erweitern", "erklaeren");
  assert.deepEqual([ab.leseAblauf(unit.id).aktuell, ab.leseAblauf(unit.id).stufe], ["mathe.brueche.erweitern", "erklaeren"]);

  // an exercise from the generator counts in Üben, not as the Kurztest
  const out = await sendeAusGenerator(unit.id, "mathe.brueche.kuerzen", teacher.id);
  assert.ok(!("fehler" in out));
  const u = ab.uebenStand(unit.id);
  assert.ok(u.letzte && u.letzte.auswertung.aufgaben > 0 && !u.letzte.fertig);
  assert.equal(u.gesamt.fertig, 0);
  assert.equal(ab.kurztestStand(unit.id), null);

  // „Mehr Werkzeuge“ and back
  ab.setzeAnsicht(unit.id, true);
  assert.equal(ab.zeigtGefuehrt(unit.id), false);
  ab.setzeAnsicht(unit.id, false);
  assert.equal(ab.zeigtGefuehrt(unit.id), true);
  assert.equal(ab.leseAblauf(unit.id).stufe, "erklaeren", "switching the view keeps the stage");

  // a unit already running in the old cockpit (an exercise sent, no guided row) stays there
  const sid2 = repo.createStudent({
    name: "Tom Alt", grade: 5, klasse: 1, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const alt = units.startUnit(teacher.id, sid2, { subject: "Mathematik" }).unit;
  await sendeAusGenerator(alt.id, "mathe.brueche.kuerzen", teacher.id);
  assert.equal(ab.zeigtGefuehrt(alt.id), false);
});
