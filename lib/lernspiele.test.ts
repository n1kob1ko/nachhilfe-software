/**
 * Lernspiele (lib/lernspiele.ts, lib/lernspiele-karten.ts): Karten aus den Banken, Auswahl nach Stoff, Zählen nur der
 * ersten Wahl, Lernstand schwächer als eine Übung. Alle Namen sind erfunden; keine KI.
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
    name: "Mira Test", grade: o.grade ?? 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: o.subjects ?? ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(id)!;
  return { db, repo, sp, student };
}

/** fester Zufall, damit Runden gleich bleiben */
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test("Karten: jede Karte hat ihre Antwort unter den Fächern, Fächer in fester Reihenfolge, Satz ergibt die Lösung", async () => {
  const k = await import("./lernspiele-karten");
  for (const art of ["artikel", "praepositionen", "deklination"] as const) {
    const alle = k.kandidaten(art);
    assert.ok(alle.length > 50, `${art}: genug Karten (${alle.length})`);
    for (const { karte } of alle) {
      assert.ok(karte.faecher.includes(karte.richtig), `${karte.key}: Antwort unter den Fächern`);
      assert.ok(karte.regel.length > 10);
      if (art === "praepositionen") assert.equal(`${karte.vor.trimEnd()} ${karte.richtig} ${karte.nach}`, karte.loesung);
      if (art === "deklination") assert.equal(`${karte.vor}${karte.richtig.slice(1)}${karte.nach}`, karte.loesung);
    }
    const reihe = art === "artikel" ? ["der", "die", "das"] : art === "praepositionen" ? ["der", "die", "das", "dem", "den"] : ["-e", "-en", "-er", "-es", "-em"];
    for (const { karte } of alle) assert.deepEqual([...karte.faecher].sort((a, b) => reihe.indexOf(a) - reihe.indexOf(b)), karte.faecher);
  }
});

test("Regeln: nur, was für die Karte stimmt", async () => {
  const k = await import("./lernspiele-karten");
  const bank = [
    { word: "Tür", article: "die" as const, tags: ["Einfach"] },
    { word: "Haustür", article: "die" as const, tags: ["Einfach"] },
    { word: "Sprung", article: "der" as const, tags: ["Einfach"] },
    { word: "Zeitung", article: "die" as const, tags: ["Einfach"] },
  ];
  assert.match(k.artikelRegel(bank[1], bank), /die Tür → die Haustür/);
  assert.match(k.artikelRegel(bank[3], bank), /-ung/);
  // „der Sprung“ endet auf -ung, ist aber nicht „die“: keine Endungsregel
  assert.doesNotMatch(k.artikelRegel(bank[2], bank), /-ung/);
  const p = { prefix: "Wir spielen mit ", noun: "Katze", article: "die" as const, suffix: ".", options: ["dem", "den", "der", "die"], correct: "der", kasus: "Dativ" as const, solution: "Wir spielen mit der Katze." };
  assert.match(k.praepositionRegel(p), /„mit“ verlangt immer den Dativ: mit der Katze/);
  assert.match(k.praepositionRegel({ ...p, prefix: "Ich gehe in ", noun: "Park", article: "der", correct: "den", kasus: "Akkusativ", solution: "Ich gehe in den Park." }), /Wohin\? .* Akkusativ: in den Park/);
  const d = { prefix: "Wir folgen dem erfahren", middle: " Reiseleiter", suffix: ".", options1: ["-e", "-en", "-er", "-em"], correct1: "-en", options2: ["-", "-s", "-es", "-en"], correct2: "-", solution: "Wir folgen dem erfahrenen Reiseleiter." };
  assert.match(k.deklinationRegel(d), /Nach „dem“ endet das Adjektiv immer auf -en/);
  assert.match(k.deklinationRegel({ ...d, prefix: "Ein fremd", middle: " Passant", suffix: " fragt.", correct1: "-er", solution: "Ein fremder Passant fragt." }), /der Passant → ein fremder Passant/);
  assert.match(k.deklinationRegel({ ...d, prefix: "Kalt", middle: " Wasser", suffix: " ist gut.", correct1: "-es", solution: "Kaltes Wasser ist gut." }), /das → Kaltes/);
});

test("Runde: zwölf verschiedene Karten, keine Antwort öfter als in der Hälfte, Fehler kommen wieder", async () => {
  const k = await import("./lernspiele-karten");
  for (const art of ["artikel", "praepositionen", "deklination"] as const) {
    const r = k.waehleKarten(art, { stufen: k.stufenFuer(art, 7, null), rng: rng(7) });
    assert.equal(r.length, 12);
    assert.equal(new Set(r.map((c) => c.key)).size, 12);
    const je = new Map<string, number>();
    for (const c of r) je.set(c.richtig, (je.get(c.richtig) ?? 0) + 1);
    assert.ok(Math.max(...je.values()) <= 6, `${art}: ${JSON.stringify([...je])}`);
  }
  const alle = k.kandidaten("praepositionen");
  const fehler = [alle[3].karte.key, alle[8].karte.key];
  const r = k.waehleKarten("praepositionen", { stufen: [1, 2], wiederholen: fehler, rng: rng(3) });
  for (const f of fehler) assert.ok(r.some((c) => c.key === f), "frühere Fehler sind dabei");
  // die Kleinen bekommen nur sehr leichte Wörter
  assert.deepEqual(k.stufenFuer("artikel", 2, null), [0]);
  assert.deepEqual(k.stufenFuer("praepositionen", 7, 0.3), [1]);
});

test("Vorschlag: Prüfung vor Stoff vor Lernstand; ohne Deutsch kein Spiel", async () => {
  const { repo, sp, student } = await setup();
  const heute = "2026-11-11";
  let v = sp.spielVorschlaege(student, { heute });
  assert.equal(v[0].quelle, "fach", "ohne Stoff: Deutsch als Fach");
  assert.equal(v.length, 3);

  repo.addTest({ student_id: student.id, date: "2026-11-20", subject: "Deutsch", kind: "Schularbeit", topic: "Fälle", grade: null, points: null, max_points: null, notes: "", skill_ids: ["deutsch.grammatik.faelle"], title: "2. Deutsch-Schularbeit", status: "geplant" });
  v = sp.spielVorschlaege(student, { heute, lernstand: new Map([["deutsch.grammatik.artikel", 0.4]]) });
  assert.deepEqual(v.slice(0, 2).map((x) => [x.art, x.quelle]), [["praepositionen", "pruefung"], ["artikel", "lernstand"]]);
  assert.equal(v[0].grund, "2. Deutsch-Schularbeit in 9 Tagen");

  // eine Prüfung in mehr als drei Wochen zählt noch nicht
  const ohne = await setup({ subjects: ["Mathematik"] });
  ohne.repo.addTest({ student_id: ohne.student.id, date: "2026-12-30", subject: "Deutsch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["deutsch.grammatik.artikel"], status: "geplant" });
  assert.deepEqual(ohne.sp.spielVorschlaege(ohne.student, { heute }), [], "nur Mathe und keine nahe Deutsch-Prüfung: kein Spiel");
});

test("Runde zählt nur die erste Wahl, nur einmal, und geht schwach in den Lernstand", async () => {
  const { db, sp, student } = await setup();
  const { analyzeStudent } = await import("./service");
  const { rundeId, karten } = sp.starteRunde(student, "artikel", { rng: rng(11) });
  assert.equal(karten.length, 12);
  // 9 richtig, 3 falsch; eine fremde Karte zählt nicht
  const antworten = karten.map((k, i) => ({ key: k.key, wahl: i < 9 ? k.richtig : k.faecher.find((f) => f !== k.richtig)! }));
  antworten.push({ key: "artikel:Erfunden", wahl: "der" });
  const e = sp.beendeRunde(student.id, rundeId, antworten)!;
  assert.equal(e.richtig, 9);
  assert.equal(e.anzahl, 12);
  assert.equal(e.sterne, 2);
  assert.equal(e.nochmal.length, 3);
  // ein zweites Beenden ändert nichts
  const nochmal = sp.beendeRunde(student.id, rundeId, karten.map((k) => ({ key: k.key, wahl: k.richtig })))!;
  assert.equal(nochmal.richtig, 9);
  assert.equal(sp.beendeRunde(student.id + 99, rundeId, []), null, "fremde Runde");

  const stat = analyzeStudent(student.id)!.skills.find((s) => s.skill.id === "deutsch.grammatik.artikel")!;
  // 9/12 = 0,75 mit Gewicht 1,5 gegen den neutralen Anfang (0,5, Gewicht 1): 0,65
  assert.equal(Math.round(stat.mastery! * 100), 65);
  assert.equal(stat.evidence, 1.5);

  // die Fehler kommen in der nächsten Runde wieder
  const falsch = karten.slice(9).map((k) => k.key);
  assert.deepEqual(new Set(sp.offeneFehler(student.id, "artikel")), new Set(falsch));
  const zweite = sp.starteRunde(student, "artikel", { rng: rng(12) });
  for (const f of falsch) assert.ok(zweite.karten.some((k) => k.key === f));

  // eine nicht beendete Runde zählt nicht
  assert.equal(sp.spielBelege(student.id).length, 1);
  assert.equal((db().prepare("SELECT COUNT(*) AS n FROM spielrunden").get() as { n: number }).n, 2);
});

test("Serie: Tage am Stück bis heute oder gestern", async () => {
  const { db, sp, student } = await setup();
  const runde = (tag: string) =>
    db().prepare("INSERT INTO spielrunden (student_id, art, skill_id, anzahl, richtig, beendet_at) VALUES (?, 'artikel', 'deutsch.grammatik.artikel', 12, 10, ?)").run(student.id, `${tag} 10:00:00`);
  assert.equal(sp.serie(student.id, "2026-11-11"), 0);
  runde("2026-11-09");
  runde("2026-11-10");
  assert.equal(sp.serie(student.id, "2026-11-11"), 2, "heute noch nicht gespielt: die Serie hält bis gestern");
  runde("2026-11-11");
  assert.equal(sp.serie(student.id, "2026-11-11"), 3);
  assert.equal(sp.serie(student.id, "2026-11-13"), 0);
  const u = sp.spielUebersicht(student.id, "2026-11-11");
  assert.equal(u.runden.length, 3);
});
