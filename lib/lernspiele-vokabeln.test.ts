/**
 * „Vokabel-Paare“ (lib/lernspiele-vokabeln.ts, lib/lernspiele.ts): Karten aus Vokabellisten, keine zwei Wörter mit
 * derselben Übersetzung in einer Runde, eigene Listen vor Themenlisten, das Thema wechselt erst, wenn es sitzt.
 * Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup(o: { grade?: number; subjects?: string[]; school_type?: string } = {}) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Mira Test", grade: o.grade ?? 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: o.school_type ?? "AHS", subjects: o.subjects ?? ["Englisch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(id)!;
  return { db, repo, sp, student, teacher };
}

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const HEUTE = "2026-11-11";

test("Karten: englisches Wort, deutsches Wort, Paar als Lösung; lange Wendungen bleiben draußen", async () => {
  const v = await import("./lernspiele-vokabeln");
  const { leseListe } = await import("./vokabeln");
  const liste = leseListe(
    ["bridge = die Brücke | The *bridge* is very old.", "big; large = groß", "to look forward to something very much = sich auf etwas sehr freuen, weil es schön wird", "bridge = die Brücke"].join("\n"),
  ).eintraege;
  const k = v.vokabelKandidaten(liste, "englisch.vocab.eigene");
  assert.deepEqual(k.map((x) => x.karte.loesung), ["bridge = die Brücke", "big = groß"]);
  const karte = k[0].karte;
  assert.equal(karte.form, "paar");
  assert.equal(karte.wort, "bridge");
  assert.equal(karte.richtig, "die Brücke");
  assert.equal(karte.regel, "The bridge is very old.");
  assert.equal(karte.skill, "englisch.vocab.eigene");
  assert.deepEqual(karte.faecher, []);
});

test("Themenlisten: jede Liste gibt eine volle Runde, und in keiner Runde passen zwei Wörter zueinander", async () => {
  const v = await import("./lernspiele-vokabeln");
  const { VOKABEL_THEMEN } = await import("./vokabeln-themen");
  for (const [thema, woerter] of Object.entries(VOKABEL_THEMEN)) {
    const pool = v.vokabelKandidaten(woerter, thema);
    assert.ok(pool.length >= 20, `${thema}: genug Wörter (${pool.length})`);
    for (const stufen of [[0], [0, 1], [0, 1, 2]] as (0 | 1 | 2)[][]) {
      for (let seed = 1; seed <= 6; seed++) {
        const karten = v.waehleVokabeln(pool, { stufen, rng: rng(seed * 7 + stufen.length) });
        assert.equal(karten.length, 12, `${thema}: zwölf Paare`);
        assert.equal(new Set(karten.map((k) => k.wort!.toLowerCase())).size, 12, `${thema}: kein englisches Wort doppelt`);
        assert.equal(new Set(karten.map((k) => k.richtig.toLowerCase())).size, 12, `${thema}: kein deutsches Wort doppelt`);
        // keine Form eines Wortes ist auch eine Form eines anderen (big und large = groß)
        const formen = karten.map((k) => pool.find((p) => p.karte.key === k.key)!);
        for (let i = 0; i < formen.length; i++)
          for (let j = i + 1; j < formen.length; j++) {
            assert.ok(!formen[i].en.some((x) => formen[j].en.includes(x)), `${thema}: ${formen[i].karte.wort} / ${formen[j].karte.wort}`);
            assert.ok(!formen[i].de.some((x) => formen[j].de.includes(x)), `${thema}: ${formen[i].karte.richtig} / ${formen[j].karte.richtig}`);
          }
      }
    }
    // nur die erste Stufe: zuerst alle leichten Wörter, die sich vertragen, der Rest aus der nächsten Stufe
    const leicht = v.waehleVokabeln(pool, { stufen: [0], rng: rng(3) });
    assert.ok(leicht.filter((k) => pool.find((p) => p.karte.key === k.key)!.stufe === 0).length >= 8, `${thema}: Stufe 0 trägt die Runde`);
  }
});

test("Auswahl: Fehler kommen wieder, zuletzt Gespieltes wartet, die neueste Liste hat Vorrang", async () => {
  const v = await import("./lernspiele-vokabeln");
  const { leseListe } = await import("./vokabeln");
  const alt = Array.from({ length: 20 }, (_, i) => `oldword${i} = altwort${i}`);
  const neu = Array.from({ length: 10 }, (_, i) => `newword${i} = neuwort${i}`);
  const pool = v.vokabelKandidaten(leseListe([...alt, ...neu].join("\n")).eintraege, "englisch.vocab.eigene");
  const vorrang = new Set(pool.filter((p) => p.karte.wort!.startsWith("new")).map((p) => p.karte.key));
  const erste = v.waehleVokabeln(pool, { vorrang, rng: rng(5) });
  assert.equal(erste.length, 12);
  assert.equal(erste.filter((k) => vorrang.has(k.key)).length, 8, "zwei Drittel aus der neuesten Liste");
  // nächste Runde: die zuletzt gespielten warten, zwei Fehler kommen wieder
  const fehler = erste.slice(0, 2).map((k) => k.key);
  const zweite = v.waehleVokabeln(pool, { vorrang, wiederholen: fehler, zuletzt: erste.map((k) => k.key), rng: rng(6) });
  for (const f of fehler) assert.ok(zweite.some((k) => k.key === f), "Fehler kommt wieder");
  assert.equal(zweite.filter((k) => erste.some((e) => e.key === k.key)).length, 2, "sonst nur Wörter, die nicht gerade dran waren");
  // kleine Liste: so viele Paare, wie da sind
  assert.equal(v.waehleVokabeln(pool.slice(0, 5), { rng: rng(1) }).length, 5);
});

test("Bretter: höchstens sechs Paare, möglichst gleich groß; zum Schluss die schweren Wörter noch einmal", async () => {
  const { bretter, nochmalBrett } = await import("./lernspiele-typen");
  const n = (zahl: number) => Array.from({ length: zahl }, (_, i) => ({ key: `k${i}` }));
  assert.deepEqual(bretter(n(12)).map((b) => b.length), [6, 6]);
  assert.deepEqual(bretter(n(8)).map((b) => b.length), [4, 4]);
  assert.deepEqual(bretter(n(11)).map((b) => b.length), [6, 5]);
  assert.deepEqual(bretter(n(5)).map((b) => b.length), [5]);
  assert.deepEqual(bretter(n(0)), []);
  assert.deepEqual(bretter(n(12)).flat().map((k) => k.key), n(12).map((k) => k.key), "nichts geht verloren, nichts doppelt");

  assert.deepEqual(nochmalBrett(n(12), new Set()), [], "ohne Fehler kein Brett");
  const eins = nochmalBrett(n(12), new Set(["k3"]), rng(2));
  assert.equal(eins.length, 4, "ein Fehler: aufgefüllt auf vier Paare");
  assert.ok(eins.some((k) => k.key === "k3"));
  assert.equal(new Set(eins.map((k) => k.key)).size, 4);
  const viele = nochmalBrett(n(12), new Set(n(9).map((k) => k.key)), rng(2));
  assert.equal(viele.length, 6, "höchstens sechs");
});

test("Welche Wörter: eigene Listen vor Themen, das Thema aus dem Stoff, sonst der Reihe nach", async () => {
  const { sp, student, teacher, repo } = await setup();
  const { speichereListe } = await import("./vokabellisten");
  // ohne Liste und ohne Stoff: das erste Thema der Unterstufe
  let plan = sp.vokabelPlan(student, HEUTE);
  assert.equal(plan.eigene, false);
  assert.equal(plan.skillId, "englisch.vocab.freizeit");
  assert.equal(plan.titel, "Thema: Freizeit und Hobbys");
  assert.equal(sp.skillFuerSpiel(student, "vokabeln", HEUTE), "englisch.vocab.freizeit");
  assert.deepEqual(sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => [x.art, x.quelle]), [["vokabeln", "fach"], ["irregular", "fach"], ["zeiten", "fach"], ["grammatik", "fach"]], "nur Englisch: nur die Englisch-Spiele, Vokabeln zuerst");

  // eine Prüfung mit einem Vokabelthema: dieses Thema
  repo.addTest({ student_id: student.id, date: "2026-11-20", subject: "Englisch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["englisch.vocab.stadt"], title: "Vocabulary Test", status: "geplant" });
  plan = sp.vokabelPlan(student, HEUTE);
  assert.equal(plan.skillId, "englisch.vocab.stadt");
  assert.deepEqual(sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => [x.art, x.quelle, x.grund])[0], ["vokabeln", "pruefung", "Vocabulary Test in 9 Tagen"]);

  // eine eigene Liste mit zu wenigen Wörtern zählt noch nicht, ab vier schon
  assert.ok(speichereListe({ studentId: student.id, teacherId: teacher.id, title: "Unit 1", text: "dog = der Hund\ncat = die Katze" }).ok);
  assert.equal(sp.vokabelPlan(student, HEUTE).eigene, false);
  assert.ok(speichereListe({ studentId: student.id, teacherId: teacher.id, title: "Unit 3", text: "bridge = die Brücke\nriver = der Fluss\nto feed = füttern\nvalley = das Tal\nhill = der Hügel\nfield = das Feld" }).ok);
  plan = sp.vokabelPlan(student, HEUTE);
  assert.equal(plan.eigene, true);
  assert.equal(plan.skillId, "englisch.vocab.eigene");
  assert.equal(plan.titel, "Deine Vokabellisten");
  assert.equal(plan.pool.length, 8);
  assert.ok(plan.vorrang?.has("vokabeln:bridge=die brücke"));

  const { rundeId, karten } = sp.starteRunde(student, "vokabeln", { rng: rng(4), heute: HEUTE });
  assert.equal(karten.length, 8);
  assert.ok(karten.every((k) => k.form === "paar" && k.skill === "englisch.vocab.eigene"));
  // sieben richtig, eines falsch: geht in den Lernstand der eigenen Listen, der Fehler kommt wieder
  const e = sp.beendeRunde(student.id, rundeId, karten.map((k, i) => ({ key: k.key, wahl: i === 0 ? "der Fluss?" : k.richtig })))!;
  assert.equal(e.richtig, 7);
  assert.deepEqual(sp.spielBelege(student.id).map((b) => b.skillId), ["englisch.vocab.eigene"]);
  assert.deepEqual(sp.offeneFehler(student.id, "vokabeln"), [karten[0].key]);

  // mit Deutsch und einer eigenen Liste: die Liste ist aktueller Stoff und steht vor „Zum Üben“
  const beide = await setup({ subjects: ["Deutsch"] });
  assert.ok((await import("./vokabellisten")).speichereListe({ studentId: beide.student.id, teacherId: beide.teacher.id, title: "Unit 3", text: "bridge = die Brücke\nriver = der Fluss\nvalley = das Tal\nhill = der Hügel" }).ok);
  const v = beide.sp.spielVorschlaege(beide.student, { heute: HEUTE });
  assert.deepEqual([v[0].art, v[0].quelle, v[0].grund], ["vokabeln", "stoff", "Deine Vokabelliste"]);
  assert.equal(v.length, 10);
  assert.equal(beide.sp.vokabelPlan(beide.student, HEUTE).titel, "Deine Liste „Unit 3“");
});

test("Thema: bleibt, bis zwei Runden mit 80 % gelungen sind; Volksschule hat ihre eigenen Themen", async () => {
  const { sp, student } = await setup();
  const spiele = (anteil: number, seed: number) => {
    const { rundeId, karten } = sp.starteRunde(student, "vokabeln", { rng: rng(seed), heute: HEUTE });
    const gut = Math.round(karten.length * anteil);
    sp.beendeRunde(student.id, rundeId, karten.map((k, i) => ({ key: k.key, wahl: i < gut ? k.richtig : "falsch" })));
    return karten;
  };
  const erste = spiele(0.5, 1);
  assert.equal(erste.length, 12);
  assert.ok(erste.every((k) => k.skill === "englisch.vocab.freizeit"));
  assert.equal(sp.vokabelPlan(student, HEUTE).skillId, "englisch.vocab.freizeit", "50 %: das Thema bleibt");
  spiele(1, 2);
  assert.equal(sp.vokabelPlan(student, HEUTE).skillId, "englisch.vocab.freizeit", "eine gute Runde reicht noch nicht");
  spiele(0.84, 3);
  assert.equal(sp.vokabelPlan(student, HEUTE).skillId, "englisch.vocab.tagesablauf", "zwei gute Runden: das nächste Thema");
  assert.deepEqual([...new Set(sp.spielBelege(student.id).map((b) => b.skillId))], ["englisch.vocab.freizeit"]);

  const klein = await setup({ grade: 3, school_type: "Volksschule" });
  assert.equal(klein.sp.vokabelPlan(klein.student, HEUTE).skillId, "englisch.vs.vocab.zahlen-farben");
  const runde = klein.sp.starteRunde(klein.student, "vokabeln", { rng: rng(9), heute: HEUTE });
  assert.equal(runde.karten.length, 12);
  // 2. Klasse mit Englisch: noch kein Vokabelspiel zum Üben
  const zwei = await setup({ grade: 2, school_type: "Volksschule" });
  assert.deepEqual(zwei.sp.spielVorschlaege(zwei.student, { heute: HEUTE }), []);
});

test("Duell: beide bekommen dieselben Wörter aus einer Themenliste, die Runde hängt am Thema", async () => {
  const { sp, student, db } = await setup();
  const karten = sp.duellVokabeln(7, false, rng(8));
  assert.equal(karten.length, 12);
  const thema = karten[0].skill!;
  assert.ok(sp.vokabelThemen(false).includes(thema));
  assert.ok(karten.every((k) => k.skill === thema));
  assert.ok(sp.vokabelThemen(true).includes(sp.duellVokabeln(4, true, rng(8))[0].skill!));
  const id = sp.starteRundeMitKarten(student.id, "vokabeln", karten, 1);
  assert.equal((db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(id) as { skill_id: string }).skill_id, thema);
});
