/**
 * Die Englisch-Spiele mit Kisten (lib/lernspiele-englisch.ts, lib/lernspiele.ts): „Irregular Verbs“, „English Tenses“,
 * „English Grammar“. Karten aus den Englisch-Generatoren, je Runde ein Thema, das Thema kommt aus dem Stoff.
 * Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup(o: { grade?: number; subjects?: string[] } = {}) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Mira Test", grade: o.grade ?? 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: o.subjects ?? ["Englisch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, repo, sp, student: repo.getStudent(id)!, teacher };
}

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const HEUTE = "2026-11-11";

test("Karten: jedes Thema hat genug Karten, drei verschiedene Kisten, die Lücke ergibt den Satz", async () => {
  const en = await import("./lernspiele-englisch");
  const skills = [en.IRREGULAR_SKILL, ...en.ZEITEN_THEMEN.map((t) => t.skill), ...en.GRAMMATIK_THEMEN.map((t) => t.skill)];
  assert.equal(new Set(skills).size, skills.length, "kein Thema doppelt");
  for (const skill of skills) {
    const k = en.englischKandidaten(skill);
    assert.ok(k.length >= 15, `${skill}: nur ${k.length} Karten`);
    assert.equal(new Set(k.map((x) => x.karte.key)).size, k.length, `${skill}: Keys doppelt`);
    for (const { karte, gruppe } of k) {
      assert.equal(karte.faecher.length, 3, karte.loesung);
      assert.equal(new Set(karte.faecher.map((f) => f.toLowerCase())).size, 3, `${karte.loesung}: Kisten doppelt`);
      assert.ok(karte.faecher.includes(karte.richtig), karte.loesung);
      assert.ok(karte.faecher.every((f) => f.length <= 24), `${karte.loesung}: Aufschrift zu lang`);
      assert.equal(karte.skill, skill);
      assert.ok(karte.regel.length > 8 && gruppe, karte.loesung);
      // Satz vor der Lücke + Antwort + Rest = die Lösung (bis auf Leerzeichen vor Satzzeichen)
      const gebaut = `${karte.vor}${karte.richtig} ${karte.nach}`.replace(/\s+/g, " ").replace(/ ([,.!?])/g, "$1").trim();
      assert.equal(gebaut.toLowerCase(), karte.loesung.replace(/\s+/g, " ").toLowerCase(), karte.key);
    }
  }
  // Themen: jedes mit Namen und Schulstufe, alle spielbar
  assert.equal(en.spielbareThemen("zeiten").length, en.ZEITEN_THEMEN.length);
  assert.equal(en.spielbareThemen("grammatik").length, en.GRAMMATIK_THEMEN.length);
  assert.deepEqual(en.spielbareThemen("artikel"), []);
});

test("Karten: der häufigste Fehler ist immer eine Kiste; die Zeit steht als Schild nur, wenn die Regel eine nennt", async () => {
  const en = await import("./lernspiele-englisch");
  const karte = en.englischKarte("englisch.tenses.perfect-past", {
    vor: "Paul ", nach: " to Italy two years ago.", cue: "go", richtig: "went", falsch: ["has gone", "go", "gone", "goes"],
    regel: "Der Satz sagt, wann es war: past simple, went (go, went, gone).", satz: "Paul went to Italy two years ago.",
  })!;
  assert.ok(karte.faecher.includes("has gone") && karte.faecher.includes("went"));
  assert.equal(karte.hinweis, "(go)");
  assert.equal(karte.marke, "Past Simple");
  assert.equal(karte.kurz, "went");
  assert.equal(en.zeitAus("Gerade jetzt: Present Progressive (is drinking)."), "Present Progressive");
  assert.equal(en.zeitAus("Ein Plan, der schon feststeht: going to (is going to watch)."), "going to");
  assert.equal(en.zeitAus("„Bis jetzt“: present perfect, has lived (live, lived, lived)."), "Present Perfect");
  assert.equal(en.zeitAus("Die lange Handlung steht im Past Progressive, die kurze im Past Simple."), undefined);
  assert.equal(en.zeitAus("In verneinten Sätzen steht any."), undefined);
  // zu lange Aufschrift oder zwei gleiche Kisten: keine Karte
  assert.equal(en.englischKarte("x", { vor: "", nach: ".", richtig: "a", falsch: ["A", "b"], regel: "r", satz: "a." }), null);
  assert.equal(en.englischKarte("x", { vor: "", nach: ".", richtig: "a", falsch: ["b", "is going to be travelling there"], regel: "r", satz: "a." }), null);
});

test("Reihenfolge: das Neueste der Schulstufe zuerst; die Erste Klasse beginnt vorne", async () => {
  const en = await import("./lernspiele-englisch");
  assert.equal(en.themenFuerStufe("zeiten", 5)[0].skill, "englisch.tenses.presentsimple");
  assert.equal(en.themenFuerStufe("zeiten", 6)[0].skill, "englisch.tenses.pastsimple");
  assert.equal(en.themenFuerStufe("zeiten", 8)[0].skill, "englisch.tenses.pastperfect");
  assert.equal(en.themenFuerStufe("zeiten", 8).length, en.ZEITEN_THEMEN.length);
  assert.ok(en.themenFuerStufe("grammatik", 5).every((t) => t.ab === 5));
  // jünger als das erste Thema: trotzdem eines (der Stoff kann das Spiel früher bringen)
  assert.equal(en.themenFuerStufe("zeiten", 4).length, 1);
  assert.ok(en.themaPasst(en.ZEITEN_THEMEN[0], "englisch.tenses.presentsimple.s"));
  assert.ok(!en.themaPasst(en.ZEITEN_THEMEN[0], "englisch.tenses.presentprogressive"));
});

test("Vorschlag und Thema: aus dem Stoff, sonst der Reihe nach; die Runde hängt am Thema", async () => {
  const { sp, repo, student } = await setup();
  assert.deepEqual(sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => [x.art, x.quelle]), [["vokabeln", "fach"], ["irregular", "fach"], ["zeiten", "fach"], ["grammatik", "fach"]]);
  // 3. Klasse (7. Schulstufe) ohne Stoff: das erste Thema der 7. Schulstufe
  assert.deepEqual(sp.themenPlan(student, "zeiten", HEUTE), { skillId: "englisch.tenses.pastprogressive", titel: "Thema: Past Progressive" });
  assert.equal(sp.themenPlan(student, "grammatik", HEUTE)!.skillId, "englisch.grammar.modal-must");
  assert.equal(sp.themenPlan(student, "irregular", HEUTE), null);
  assert.equal(sp.spielWoher(student, "irregular", HEUTE), undefined);
  assert.equal(sp.skillFuerSpiel(student, "irregular", HEUTE), "englisch.vocab.irregular");

  // eine Schularbeit mit Present Perfect oder Past Simple und some/any: diese Themen, und die Spiele stehen vorne
  repo.addTest({ student_id: student.id, date: "2026-11-20", subject: "Englisch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["englisch.tenses.perfect-past", "englisch.grammar.someany", "englisch.tenses.pastsimple.irregular"], title: "2. Schularbeit", status: "geplant" });
  assert.equal(sp.spielWoher(student, "zeiten", HEUTE), "Thema: Present Perfect oder Past Simple");
  assert.equal(sp.spielWoher(student, "grammatik", HEUTE), "Thema: some oder any");
  assert.equal(sp.skillFuerSpiel(student, "zeiten", HEUTE), "englisch.tenses.perfect-past");
  const v = sp.spielVorschlaege(student, { heute: HEUTE });
  assert.deepEqual(v.slice(0, 3).map((x) => [x.art, x.quelle]), [["zeiten", "pruefung"], ["grammatik", "pruefung"], ["irregular", "pruefung"]]);
  assert.equal(v[0].grund, "2. Schularbeit in 9 Tagen");

  const { rundeId, karten } = sp.starteRunde(student, "zeiten", { rng: rng(3), heute: HEUTE });
  assert.equal(karten.length, 12);
  assert.ok(karten.every((k) => k.skill === "englisch.tenses.perfect-past" && k.faecher.length === 3));
  assert.equal(new Set(karten.map((k) => k.key)).size, 12);
  const e = sp.beendeRunde(student.id, rundeId, karten.map((k, i) => ({ key: k.key, wahl: i < 2 ? k.faecher.find((f) => f !== k.richtig)! : k.richtig })))!;
  assert.equal(e.richtig, 10);
  assert.deepEqual(sp.spielBelege(student.id).map((b) => b.skillId), ["englisch.tenses.perfect-past"]);
  // die zwei Fehler kommen in der nächsten Runde wieder
  const naechste = sp.starteRunde(student, "zeiten", { rng: rng(4), heute: HEUTE }).karten;
  assert.ok([karten[0].key, karten[1].key].every((key) => naechste.some((k) => k.key === key)));

  const irr = sp.starteRunde(student, "irregular", { rng: rng(5), heute: HEUTE });
  assert.equal(irr.karten.length, 12);
  assert.ok(irr.karten.every((k) => k.skill === "englisch.vocab.irregular" && k.hinweis));
  // kleine Themen: so viele Karten, wie es ohne zu viele gleiche Antworten gibt
  const sa = sp.starteRunde(student, "grammatik", { rng: rng(6), heute: HEUTE }).karten;
  assert.ok(sa.length >= 8 && sa.every((k) => k.skill === "englisch.grammar.someany"));
});

test("Thema: bleibt, bis zwei Runden mit 80 % gelungen sind, dann das nächste", async () => {
  const { sp, student } = await setup({ grade: 5 });
  const spiele = (anteil: number, seed: number) => {
    const { rundeId, karten } = sp.starteRunde(student, "zeiten", { rng: rng(seed), heute: HEUTE });
    const gut = Math.round(karten.length * anteil);
    sp.beendeRunde(student.id, rundeId, karten.map((k, i) => ({ key: k.key, wahl: i < gut ? k.richtig : "falsch" })));
    return karten;
  };
  assert.ok(spiele(0.5, 1).every((k) => k.skill === "englisch.tenses.presentsimple"));
  spiele(1, 2);
  assert.equal(sp.themenPlan(student, "zeiten", HEUTE)!.skillId, "englisch.tenses.presentsimple", "eine gute Runde reicht noch nicht");
  spiele(0.84, 3);
  assert.equal(sp.themenPlan(student, "zeiten", HEUTE)!.skillId, "englisch.tenses.presentprogressive");
  // 5. Schulstufe: noch keine Irregular Verbs zum Üben
  assert.deepEqual(sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => x.art), ["vokabeln", "zeiten", "grammatik"]);
});

test("Duell: ein Thema, das der Jüngere schon hatte, für beide dieselben Karten", async () => {
  const { sp, student, db } = await setup();
  const en = await import("./lernspiele-englisch");
  const karten = sp.duellThema("zeiten", 6, rng(8));
  assert.equal(karten.length, 12);
  const thema = en.ZEITEN_THEMEN.find((t) => t.skill === karten[0].skill)!;
  assert.ok(thema.ab <= 6 && karten.every((k) => k.skill === thema.skill));
  const id = sp.starteRundeMitKarten(student.id, "zeiten", karten, 1);
  assert.equal((db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(id) as { skill_id: string }).skill_id, thema.skill);
});
