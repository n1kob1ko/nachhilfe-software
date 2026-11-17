/**
 * Das Quiz je Fach (lib/lernspiele-quiz.ts, Fragen in lib/quiz/): jede Frage liest sich ohne Fehler, jedes Thema hat
 * genug Karten und gehört zu einer Fähigkeit des Lehrplans, kein Thema hängt an zwei Spielen, und das Thema kommt aus dem
 * Stoff. Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const HEUTE = "2026-11-11";

async function setup(o: { grade?: number; subjects?: string[]; school_type?: string } = {}) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const grade = o.grade ?? 8;
  const id = repo.createStudent({
    name: "Mia Test", grade, klasse: grade > 4 ? grade - 4 : grade, teacher_id: teacher.id, school: "", school_type: o.school_type ?? (grade > 4 ? "Gymnasium" : "Volksschule"), subjects: o.subjects ?? ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, sp, student: repo.getStudent(id)! };
}

/** So viele Karten braucht ein Thema mindestens (eine ganze Runde). */
const MIN = 12;

test("Fragen: jede Zeile liest sich, jedes Thema hat genug Karten und gehört zu seinem Fach", async () => {
  const q = await import("./lernspiele-quiz");
  const { leseKarten, ANTWORT_MAX } = await import("./spielkarten-text");
  const { THEMEN } = await import("./themen");
  const { QUIZ_MATHE } = await import("./quiz/mathe");
  const { QUIZ_DEUTSCH } = await import("./quiz/deutsch");
  const { QUIZ_ENGLISCH } = await import("./quiz/englisch");
  const banken = { quizmathe: QUIZ_MATHE, quizdeutsch: QUIZ_DEUTSCH, quizenglisch: QUIZ_ENGLISCH } as const;
  const fehler: string[] = [];
  for (const [art, bank] of Object.entries(banken) as [keyof typeof banken, (typeof banken)[keyof typeof banken]][]) {
    for (const [skill, e] of Object.entries(bank)) {
      const t = THEMEN.find((x) => x.id === skill);
      if (!t) {
        fehler.push(`${skill}: keine Fähigkeit in lib/themen`);
        continue;
      }
      if (t.subject !== q.QUIZ_FACH[art]) fehler.push(`${skill}: Fach ${t.subject}, Quiz ${art}`);
      const text = typeof e === "string" ? e : (e.text ?? "");
      for (const teil of text.split(/^#\s*schwer\s*$/im)) for (const m of leseKarten(teil).fehler) fehler.push(`${skill}: ${m.text}`);
      for (const m of leseKarten(text.replace(/^#\s*schwer\s*$/gim, "")).hinweise) if (!/ab \d+ Karten/.test(m.text)) fehler.push(`${skill}: ${m.text}`);
      const karten = q.quizKandidaten(skill);
      if (karten.length < MIN) fehler.push(`${skill}: nur ${karten.length} Karten`);
      for (const { karte } of karten) {
        if (karte.form === "reihe") fehler.push(`${skill}: Reihenfolge „${karte.auftrag}“ (Torlauf braucht Antworten zum Wählen)`);
        if (!karte.faecher.includes(karte.richtig)) fehler.push(`${skill}: „${karte.vor}“ ohne die richtige Antwort`);
        if (karte.faecher.some((f) => f.length > ANTWORT_MAX)) fehler.push(`${skill}: Antwort zu lang in „${karte.vor}“`);
        if (art === "quizmathe" && !karte.mathe) fehler.push(`${skill}: Mathe-Karte ohne Satz`);
      }
      if (new Set(karten.map((k) => k.karte.key)).size !== karten.length) fehler.push(`${skill}: zwei Karten mit demselben Schlüssel`);
    }
  }
  assert.deepEqual(fehler, []);
});

test("Themen: jedes gehört zu genau einem Spiel, in der Reihenfolge des Lehrplans, Schularten aus dem Lehrplan", async () => {
  const q = await import("./lernspiele-quiz");
  const th = await import("./lernspiele-themen");
  const andere = Object.entries(th.SPIEL_THEMEN)
    .filter(([art]) => !q.istQuiz(art as never))
    .flatMap(([, themen]) => themen!.flatMap((t) => [t.skill, ...(t.auch ?? [])]));
  for (const art of q.QUIZ_ARTEN) for (const t of q.QUIZ_THEMEN[art]) assert.ok(!andere.includes(t.skill), `${t.skill} hat schon ein Themenspiel`);
  const mathe = q.QUIZ_THEMEN.quizmathe;
  assert.ok(mathe.length >= 25, "Mathe hat Themen");
  assert.equal(th.spielbareThemen("quizmathe").length, mathe.length, "alle spielbar");
  assert.ok(mathe.every((t) => t.ab >= 1 && (t.bis ?? 13) >= t.ab && !/\)$/.test(t.name)));
  // ein Erzeuger bringt mit demselben Thema immer dieselben Karten (Fehler kommen so wieder)
  const { MATHE_VS } = await import("./quiz/mathe-vs");
  const fragen = () => q.quizKarten(MATHE_VS["mathe.vs.zahlen.folgen"], "mathe.vs.zahlen.folgen").map((k) => k.karte.frage);
  assert.deepEqual(fragen(), fragen());
  assert.ok(fragen().length >= 30);
});

test("Stoff: das Thema der Schularbeit wird ein Quiz, Blockwerk und Co. bekommen seine Fragen", async () => {
  const { sp, repo, student } = await setup({ grade: 4, school_type: "Volksschule" });
  repo.addTest({ student_id: student.id, date: "2026-11-20", subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["mathe.vs.geometrie.symmetrie"], title: "Mathe-Test", status: "geplant" });
  const v = sp.spielVorschlaege(student, { heute: HEUTE });
  assert.deepEqual([v[0].art, v[0].grund, v[0].quelle], ["quizmathe", "Mathe-Test in 9 Tagen", "pruefung"]);
  assert.equal(sp.spielWoher(student, "quizmathe", HEUTE), "Thema: Symmetrie: Spiegelachsen und Spiegelbilder");
  const { karten } = sp.starteRunde(student, "quizmathe", { rng: rng(5), heute: HEUTE, endlos: "neu", bloecke: true });
  assert.equal(karten.length, 12);
  assert.ok(karten.every((k) => k.skill === "mathe.vs.geometrie.symmetrie" && k.mathe && (k.form === "wischen" || k.form === "kacheln")));
});

test("Ohne Stoff: das Quiz kommt zum Üben, mit einem Thema der Schulstufe", async () => {
  const { sp, student } = await setup({ grade: 3, school_type: "Volksschule" });
  const v = sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => x.art);
  assert.ok(v.includes("quizmathe"));
  const plan = sp.themenPlan(student, "quizmathe", HEUTE)!;
  assert.ok(plan.skillId.startsWith("mathe.vs."));
  // ohne Fragen in einem Fach gibt es dieses Quiz nicht
  const ohne = await setup({ grade: 6, subjects: ["Deutsch"] });
  const q = await import("./lernspiele-quiz");
  if (!q.QUIZ_THEMEN.quizdeutsch.length) assert.ok(!ohne.sp.spielVorschlaege(ohne.student, { heute: HEUTE }).some((x) => x.art === "quizdeutsch"));
});
