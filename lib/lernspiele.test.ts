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

test("Neue Deutsch-Spiele: Karten aus Generator und Banken, je Karte eine eindeutige Antwort", async () => {
  const k = await import("./lernspiele-karten");
  const zahl = { faelle: 400, dasdass: 300, satzteile: 400, perfekt: 100, praeteritum: 90 } as const;
  for (const art of ["faelle", "dasdass", "satzteile", "perfekt", "praeteritum"] as const) {
    const alle = k.kandidaten(art);
    assert.ok(alle.length >= zahl[art], `${art}: genug Karten (${alle.length})`);
    assert.equal(new Set(alle.map((c) => c.karte.key)).size, alle.length, `${art}: keine Karte doppelt`);
    for (const { karte } of alle) {
      assert.ok(karte.faecher.includes(karte.richtig), `${karte.key}: Antwort unter den Kisten`);
      assert.equal(new Set(karte.faecher).size, karte.faecher.length, `${karte.key}: keine Kiste doppelt`);
      assert.ok(karte.regel.length > 10 && karte.loesung.length > 3 && (karte.kurz ?? "").length > 0, karte.key);
      assert.ok(!/___|\s{2,}/.test(karte.vor + (karte.mitte ?? "") + karte.nach), `${karte.key}: keine offene Lücke im Satz`);
    }
  }
  // Fälle: vier feste Kisten, der markierte Teil steht genau so im Satz, alle vier Fälle kommen vor
  const faelle = k.kandidaten("faelle");
  for (const { karte } of faelle) {
    assert.deepEqual(karte.faecher, ["Nominativ", "Genitiv", "Dativ", "Akkusativ"]);
    assert.ok(karte.mitte && karte.key.endsWith(`${karte.vor}${karte.mitte}${karte.nach}|${karte.mitte}`));
  }
  assert.equal(new Set(faelle.map((c) => c.karte.richtig)).size, 4);
  assert.deepEqual(k.kandidaten("faelle").map((c) => c.karte.key), faelle.map((c) => c.karte.key), "dieselben Karten bei jedem Aufruf");

  // das/dass: je Lücke eine Karte, die andere Lücke ist gefüllt, Großschreibung am Satzanfang bleibt
  const zwei = k.dasDassKarten({ q: "Setze „das“ oder „dass“ ein: ___ Kind, ___ dort spielt, weiß, ___ es regnet.", blanks: [["Das"], ["das"], ["dass"]], solution: "Das Kind, das dort spielt, weiß, dass es regnet.", hint: "Ersatzprobe", explanation: "", errors: {} });
  assert.deepEqual(zwei.map((c) => [c.vor, c.nach, c.richtig, c.einsatz]), [
    ["", "Kind, das dort spielt, weiß, dass es regnet.", "das", "Das"],
    ["Das Kind, ", "dort spielt, weiß, dass es regnet.", "das", "das"],
    ["Das Kind, das dort spielt, weiß, ", "es regnet.", "dass", "dass"],
  ]);
  assert.match(zwei[2].regel, /passt hier nicht.*zwei s/);
  assert.equal(new Set(zwei.map((c) => c.key)).size, 3);

  // Hauptsatz oder Gliedsatz: beide Teile als Karte, das Satzzeichen ist nicht markiert, die Regel nennt das Einleitewort
  const [gs, hs] = k.satzteilKarten({ parts: [{ text: "Weil es regnet,", type: "GS" }, { text: "bleiben wir daheim.", type: "HS" }] } as Parameters<typeof k.satzteilKarten>[0]);
  assert.deepEqual([gs.vor, gs.mitte, gs.nach, gs.richtig], ["", "Weil es regnet", ", bleiben wir daheim.", "Gliedsatz"]);
  assert.deepEqual([hs.vor, hs.mitte, hs.nach, hs.richtig], ["Weil es regnet, ", "bleiben wir daheim", ".", "Hauptsatz"]);
  assert.match(gs.regel, /beginnt mit „weil“/);
  assert.match(hs.regel, /kann allein stehen/);

  // Perfekt: die Lücke ist das Hilfsverb, das Partizip steht schon da; die Kiste heißt „sein“, eingesetzt wird „bin“
  const pf = k.perfektKarte({ q: "Setze das Verb im Perfekt ein: Ich ___ gestern früh ins Bett ___. (gehen)", blanks: [["bin"], ["gegangen"]], solution: "Ich bin gestern früh ins Bett gegangen.", hint: "h", errors: {} })!;
  assert.deepEqual([pf.vor, pf.nach, pf.richtig, pf.einsatz, pf.hinweis], ["Ich ", "gestern früh ins Bett gegangen.", "sein", "bin", "(gehen)"]);
  assert.match(pf.regel, /„gehen“ bildet das Perfekt mit „sein“: bin … gegangen/);
  const perfekt = k.kandidaten("perfekt");
  const mitSein = perfekt.filter((c) => c.karte.richtig === "sein").length;
  assert.ok(mitSein >= 50 && perfekt.length - mitSein >= 45, `haben und sein etwa gleich oft (${mitSein} von ${perfekt.length})`);
  // Verben, die in Österreich mit „sein“ und in Deutschland mit „haben“ stehen, sind nicht im Spiel
  for (const { karte } of perfekt) assert.doesNotMatch(karte.hinweis ?? "", /\((sitzen|liegen|stehen|schwimmen|hängen)\)/);

  // Präteritum: die richtige Form und zwei falsche aus der Fehlerliste; was im Satz auch stimmen könnte, ist keine Kiste
  const pr = k.praeteritumKarte({ q: "Setze das Verb im Präteritum ein: Er ___ letzte Woche leider krank. (sein)", blanks: [["war"]], solution: "Er war letzte Woche leider krank.", hint: "h", errors: { wurde: "x", ware: "x", ist: "x" } })!;
  assert.equal(pr.faecher.length, 3);
  assert.ok(pr.faecher.includes("war") && !pr.faecher.includes("wurde"));
  assert.equal(k.praeteritumKarte({ q: "Setze das Verb im Präteritum ein: Ich ___ das Fenster. (schließen)", blanks: [["schloss"]], solution: "Ich schloss das Fenster.", hint: "h", errors: { schloß: "x", schließte: "x" } }), null, "nur eine falsche Form übrig: keine Karte");
  for (const { karte } of k.kandidaten("praeteritum")) assert.equal(karte.faecher.length, 3);
});

test("Neue Deutsch-Spiele: Runden sind gemischt, Teile desselben Satzes kommen nicht zusammen", async () => {
  const k = await import("./lernspiele-karten");
  for (const art of ["faelle", "dasdass", "satzteile", "perfekt", "praeteritum"] as const) {
    for (const lernstand of [null, 0.3, 0.9]) {
      const r = k.waehleKarten(art, { stufen: k.stufenFuer(art, 6, lernstand), rng: rng(11) });
      assert.equal(r.length, 12, art);
      assert.equal(new Set(r.map((c) => c.key)).size, 12);
      const je = new Map<string, number>();
      for (const c of r) je.set(c.richtig, (je.get(c.richtig) ?? 0) + 1);
      if (art !== "praeteritum") {
        const zweiKisten = r[0].faecher.length === 2;
        assert.ok(Math.max(...je.values()) <= (zweiKisten ? 7 : 6), `${art}: ${JSON.stringify([...je])}`);
        if (zweiKisten) assert.ok(Math.min(...je.values()) >= 5 && je.size === 2, `${art}: beide Kisten kommen oft vor ${JSON.stringify([...je])}`);
      }
      if (art === "satzteile") assert.equal(new Set(r.map((c) => c.key.split("#")[0])).size, 12, "nie beide Teile eines Satzes");
      if (art === "dasdass") assert.equal(new Set(r.map((c) => c.loesung)).size, 12, "nie zwei Lücken desselben Satzes");
    }
  }
  // wer beim Perfekt unsicher ist, bekommt trotzdem Karten mit „sein“
  assert.deepEqual(k.stufenFuer("perfekt", 5, 0.2), [1, 2]);
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
  assert.deepEqual(v.map((x) => x.art), ["praepositionen", "deklination", "faelle", "dasdass", "satzteile", "perfekt", "praeteritum", "artikel"]);

  repo.addTest({ student_id: student.id, date: "2026-11-20", subject: "Deutsch", kind: "Schularbeit", topic: "Fälle", grade: null, points: null, max_points: null, notes: "", skill_ids: ["deutsch.grammatik.faelle"], title: "2. Deutsch-Schularbeit", status: "geplant" });
  v = sp.spielVorschlaege(student, { heute, lernstand: new Map([["deutsch.grammatik.artikel", 0.4]]) });
  // „Die vier Fälle“ auf dem Stoffzettel: zuerst Fälle bestimmen, dann der Fall nach der Präposition
  assert.deepEqual(v.slice(0, 3).map((x) => [x.art, x.quelle]), [["faelle", "pruefung"], ["praepositionen", "pruefung"], ["artikel", "lernstand"]]);
  assert.equal(v.length, 8, "jedes Spiel nur einmal");
  assert.equal(v[0].grund, "2. Deutsch-Schularbeit in 9 Tagen");

  // Stoff führt zu den passenden Spielen, auch über eine Unterfähigkeit
  assert.deepEqual(sp.spieleZuSkills(["deutsch.grammatik.zeiten"]), ["perfekt", "praeteritum"]);
  assert.deepEqual(sp.spieleZuSkills(["deutsch.recht.dasdass.ersatzprobe", "deutsch.satz.satzreihe-gefuege"]), ["dasdass", "satzteile"]);
  assert.deepEqual(sp.spieleZuSkills(["mathe.brueche.kuerzen"]), []);
  // Volksschule: keine Fälle, kein das/dass, keine Satzlehre zum Weiterüben
  const klein = await setup({ grade: 4 });
  assert.deepEqual(klein.sp.spielVorschlaege(klein.student, { heute }).map((x) => x.art), ["artikel", "praepositionen", "perfekt", "praeteritum"]);
  const erste = await setup({ grade: 2 });
  assert.deepEqual(erste.sp.spielVorschlaege(erste.student, { heute }).map((x) => x.art), ["artikel"]);

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
