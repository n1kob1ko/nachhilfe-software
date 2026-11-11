/**
 * Das Mathe-Spiel „Kopfrechnen“ (lib/lernspiele-mathe.ts, lib/lernspiele-themen.ts, lib/lernspiele.ts): Karten aus den
 * Mathe-Generatoren und eigene für die Volksschule, je Runde ein Thema, das Thema kommt aus dem Stoff.
 * Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup(o: { grade?: number; subjects?: string[]; school_type?: string } = {}) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const grade = o.grade ?? 6;
  const id = repo.createStudent({
    name: "Lena Test", grade, klasse: grade > 4 ? grade - 4 : grade, teacher_id: teacher.id, school: "", school_type: o.school_type ?? (grade > 4 ? "AHS" : "Volksschule"), subjects: o.subjects ?? ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, repo, sp, student: repo.getStudent(id)!, teacher };
}

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const HEUTE = "2026-11-11";

test("Karten: jedes Thema hat genug Karten, zwei oder drei verschiedene Kisten, einen Rechenweg", async () => {
  const { db } = await setup();
  const ma = await import("./lernspiele-mathe");
  const th = await import("./lernspiele-themen");
  const skills = ma.RECHNEN_THEMEN.map((t) => t.skill);
  assert.equal(new Set(skills).size, skills.length, "kein Thema doppelt");
  // die Fähigkeiten gibt es: von Anfang an oder im Paket „Volksschule“ (Mehr › Lehrplan)
  const paket = JSON.stringify(JSON.parse(readFileSync(path.join(process.cwd(), "curriculum", "volksschule-eigene-struktur.json"), "utf8")));
  const bekannt = new Set([...(db().prepare("SELECT id FROM skills").all() as { id: string }[]).map((r) => r.id), ...ma.RECHNEN_THEMEN.map((t) => t.skill).filter((id) => paket.includes(`"${id}"`))]);
  for (const t of ma.RECHNEN_THEMEN) {
    assert.ok(bekannt.has(t.skill), `${t.skill}: diese Fähigkeit gibt es nicht`);
    assert.ok(t.name.length <= 36 && t.ab >= 1 && (t.bis ?? 13) >= t.ab, t.skill);
    const k = ma.matheKandidaten(t.skill);
    assert.ok(k.length >= 24, `${t.skill}: nur ${k.length} Karten`);
    assert.equal(new Set(k.map((x) => x.karte.key)).size, k.length, `${t.skill}: Keys doppelt`);
    for (const { karte } of k) {
      const wo = `${t.skill} ${karte.loesung}`;
      assert.ok(karte.faecher.length === 3 || (karte.faecher.length === 2 && karte.mitte !== undefined), wo);
      assert.equal(new Set(karte.faecher).size, karte.faecher.length, `${wo}: Kisten doppelt`);
      assert.ok(karte.faecher.includes(karte.richtig), wo);
      assert.ok(karte.faecher.every((f) => f.length > 0 && f.length <= 16), `${wo}: Aufschrift zu lang`);
      // ein Bindestrich vorne hieße für das Spiel „Endung“ (lib/lernspiele-typen.ts): negative Zahlen haben ein echtes Minus
      assert.ok(karte.faecher.every((f) => !f.includes("-")), `${wo}: Bindestrich statt Minus`);
      assert.equal(karte.skill, t.skill);
      assert.equal(karte.mathe, true);
      assert.ok(karte.regel.length > 6 && karte.regel.split("\n").length <= 5, `${wo}: Regel`);
      assert.ok(karte.loesung.length > 3 && !karte.loesung.includes("\n"), wo);
      assert.ok(!/undefined|NaN|Infinity/.test(JSON.stringify(karte)), wo);
    }
  }
  assert.equal(th.spielbareThemen("rechnen").length, ma.RECHNEN_THEMEN.length);
});

test("Volksschule: die eigenen Rechnungen stimmen", async () => {
  const ma = await import("./lernspiele-mathe");
  for (const t of ma.RECHNEN_THEMEN.filter((x) => x.skill.startsWith("mathe.vs."))) {
    for (const { karte } of ma.matheKandidaten(t.skill)) {
      const m = /^(\d+) ([+−·:]) (\d+) =$/.exec(karte.vor);
      assert.ok(m, `${t.skill}: ${karte.vor}`);
      const [a, b] = [Number(m[1]), Number(m[3])];
      const r = m[2] === "+" ? a + b : m[2] === "−" ? a - b : m[2] === "·" ? a * b : a / b;
      assert.equal(karte.richtig, String(r), karte.vor);
      assert.ok(karte.faecher.every((f) => /^\d+$/.test(f)), karte.vor);
    }
  }
  const mal = ma.matheKandidaten("mathe.vs.muldiv.einmaleins");
  assert.equal(mal.length, 81);
  const k78 = mal.find((x) => x.karte.vor === "7 · 8 =")!;
  assert.equal(k78.karte.regel, "7 · 8 = 5 · 8 + 2 · 8 = 40 + 16 = 56");
  assert.equal(k78.stufe, 2);
  assert.equal(k78.gruppe, mal.find((x) => x.karte.vor === "8 · 7 =")!.gruppe, "7 · 8 und 8 · 7 kommen nie in eine Runde");
  assert.equal(mal.find((x) => x.karte.vor === "5 · 7 =")!.stufe, 0);
  const plus = ma.matheKandidaten("mathe.vs.addsub.zehner").find((x) => x.karte.vor === "8 + 5 =")!;
  assert.equal(plus.karte.regel, "Erst bis 10: 8 + 2 = 10.\nDann noch 3 dazu: 13.");
});

test("Aus einer Aufgabe wird eine Rechnung mit Lücke; die typischen Fehler sind die Kisten", async () => {
  const ma = await import("./lernspiele-mathe");
  assert.deepEqual(ma.form("Kürze den Bruch 21/30 so weit wie möglich.", "7/10"), { vor: "21/30 =", hinweis: "(so weit wie möglich gekürzt)" });
  assert.deepEqual(ma.form("Berechne: −15 − (−7)", "-8"), { vor: "−15 − (−7) =" });
  assert.deepEqual(ma.form("Wandle um: 35,45 m = ? cm", "3545"), { vor: "35,45 m =" });
  assert.deepEqual(ma.form("Löse die Gleichung: 9x + 7 = 70", "7"), { vor: "9x + 7 = 70\nx =" });
  assert.deepEqual(ma.form("Wie viel sind 5 % von 80 €? Gib das Ergebnis in Euro an.", "4"), { vor: "5 % von 80 € =" });
  assert.deepEqual(ma.form("Wie viel Prozent sind 96 € von 320 €? Gib das Ergebnis in Prozent an.", "30"), { vor: "96 € von 320 € =" });
  assert.equal(ma.form("20 % eines Betrags sind 60 €. Wie groß ist der ganze Betrag (100 %)?", "300")!.vor, "20 % sind 60 €.\n100 % sind");
  assert.deepEqual(ma.form("Runde 29 537 auf Tausender.", "30000"), { vor: "29 537 ≈", hinweis: "(auf Tausender gerundet)", dazu: ["29500", "31000"] });
  assert.equal(ma.form("Ist 2925 durch 5 teilbar? Antworte mit ja oder nein.", "ja")!.mitte, "2925 durch 5");
  assert.equal(ma.form("5 Hefte kosten 5,50 €. Wie viel kosten 3 Hefte?", "3,30"), null);

  assert.equal(ma.schoen("-8"), "−8");
  assert.equal(ma.schoen("12500", "cm"), "12 500 cm");
  assert.equal(ma.schoen("0,12345"), "0,12345");
  assert.deepEqual(ma.ersatz("3/4", "nachbar", false, 0), ["4/4", "3/5", "2/4"]);
  assert.deepEqual(ma.ersatz("3545", "stellen", false, 0), ["35450", "354,5", "354500", "35,45"]);
  assert.deepEqual(ma.ersatz("-8", "nachbar", true, 1).slice(0, 3), ["8", "-7", "-9"]);
  assert.deepEqual(ma.ersatz("−24x + 48", "nachbar", false, 0), ["−24x − 48", "24x + 48"]);

  const draft = (prompt: string, accepted: string[], fehler: string[], solution = "Schritt eins\nSchritt zwei") =>
    ({ type: "calc", skillId: null, difficulty: "leicht", prompt, data: {}, answer: { accepted, mode: "value" }, errorMap: fehler.map((answer) => ({ answer, label: "x" })), solution, hints: [] }) as never;
  const laenge = ma.rechenWahl(draft("Wandle um: 35,45 m = ? cm", ["3545", "3545 cm"], ["35450"]), { ersatz: "stellen" })!;
  assert.equal(laenge.richtig, "3545 cm");
  assert.deepEqual(laenge.falsch.slice(0, 2), ["35 450 cm", "354,5 cm"]);
  // zwei typische Fehler: kein Ersatz dazu
  assert.deepEqual(ma.rechenWahl(draft("Berechne: −3 − (−5)", ["2"], ["-8", "-2"]), { negativ: true })!.falsch, ["−8", "−2"]);
  // Gleichung: ein Bruch als falsche Kiste würde die ganze Zahl verraten
  const gl = ma.rechenWahl(draft("Löse die Gleichung: 9x + 7 = 70", ["7", "x = 7"], ["77/9", "63"]), { negativ: true, ganz: true })!;
  assert.ok(gl.falsch.includes("63") && gl.falsch.every((f) => !f.includes("/")));
  const karte = ma.matheKarte("mathe.gleichungen.einfach", gl)!;
  assert.equal(karte.loesung, "9x + 7 = 70, x = 7");
  assert.equal(karte.faecher.length, 3);
  const teilbar = ma.matheKarte("mathe.teilbarkeit.regeln", ma.rechenWahl(draft("Ist 8418 durch 9 teilbar? Antworte mit ja oder nein.", ["nein"], ["ja"]))!)!;
  assert.deepEqual([teilbar.faecher, teilbar.richtig, teilbar.loesung], [["ja", "nein"], "nein", "8418 ist nicht durch 9 teilbar"]);
  // Textaufgaben: keine Karte
  assert.equal(ma.rechenWahl(draft("5 Hefte kosten 5,50 €. Wie viel kosten 3 Hefte?", ["3,30"], ["9,17", "3,50"])), null);
});

test("Reihenfolge: das Neueste der Schulstufe zuerst; Themen der Volksschule fallen später weg", async () => {
  const th = await import("./lernspiele-themen");
  const fuer = (stufe: number) => th.themenFuerStufe("rechnen", stufe).map((t) => t.skill);
  assert.deepEqual(fuer(1), ["mathe.vs.addsub.zr10", "mathe.vs.addsub.zehner"]);
  assert.deepEqual(fuer(2).slice(0, 3), ["mathe.vs.addsub.zr100", "mathe.vs.muldiv.einmaleins", "mathe.vs.muldiv.geteilt"]);
  assert.ok(!fuer(2).includes("mathe.vs.addsub.zr10"));
  assert.equal(fuer(5)[0], "mathe.zahlen.zehner");
  assert.ok(fuer(5).includes("mathe.vs.muldiv.einmaleins") && !fuer(5).includes("mathe.vs.addsub.zr1000"));
  assert.equal(fuer(6)[0], "mathe.teilbarkeit.regeln");
  assert.equal(fuer(7)[0], "mathe.negativ.addieren");
  assert.ok(fuer(7).includes("mathe.brueche.kuerzen") && fuer(7).every((s) => !s.startsWith("mathe.vs.")));
  assert.equal(fuer(8)[0], "mathe.potenzen.regeln");
  // Oberstufe: was bis zum Schluss bleibt (Prozent, Gleichungen, Terme, Potenzen, Wurzeln)
  assert.ok(fuer(11).length >= 8 && fuer(11).every((s) => !s.startsWith("mathe.brueche.")));
});

test("Vorschlag und Thema: aus dem Stoff, sonst der Reihe nach; die Runde hängt am Thema", async () => {
  const { sp, repo, student } = await setup();
  assert.deepEqual(sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => [x.art, x.grund, x.quelle]), [["rechnen", "Zum Üben", "fach"]]);
  assert.deepEqual(sp.themenPlan(student, "rechnen", HEUTE), { skillId: "mathe.teilbarkeit.regeln", titel: "Thema: Teilbar oder nicht?" });
  assert.equal(sp.skillFuerSpiel(student, "rechnen", HEUTE), "mathe.teilbarkeit.regeln");

  // eine Schularbeit mit Brüchen: das Thema, auch über eine Unterfähigkeit („Gemeinsamen Nenner finden“)
  repo.addTest({ student_id: student.id, date: "2026-11-20", subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["mathe.brueche.addieren.hauptnenner", "mathe.brueche.kuerzen"], title: "1. Schularbeit", status: "geplant" });
  assert.equal(sp.spielWoher(student, "rechnen", HEUTE), "Thema: Brüche addieren");
  assert.deepEqual(sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => [x.art, x.grund, x.quelle]), [["rechnen", "1. Schularbeit in 9 Tagen", "pruefung"]]);
  assert.equal(sp.spielVorschau(student, "rechnen", HEUTE)!.length, 3);

  const { rundeId, karten } = sp.starteRunde(student, "rechnen", { rng: rng(3), heute: HEUTE });
  assert.equal(karten.length, 12);
  assert.ok(karten.every((k) => k.skill === "mathe.brueche.addieren" && k.faecher.length === 3 && k.mathe));
  assert.equal(new Set(karten.map((k) => k.key)).size, 12);
  const e = sp.beendeRunde(student.id, rundeId, karten.map((k, i) => ({ key: k.key, wahl: i < 2 ? k.faecher.find((f) => f !== k.richtig)! : k.richtig })))!;
  assert.equal(e.richtig, 10);
  assert.deepEqual(sp.spielBelege(student.id).map((b) => b.skillId), ["mathe.brueche.addieren"]);
  // die zwei Fehler kommen in der nächsten Runde wieder
  const naechste = sp.starteRunde(student, "rechnen", { rng: rng(4), heute: HEUTE }).karten;
  assert.ok([karten[0].key, karten[1].key].every((key) => naechste.some((k) => k.key === key)));
});

test("Volksschule: Einmaleins bleibt, bis zwei Runden mit 80 % gelungen sind; ohne Mathematik kein Kopfrechnen", async () => {
  const { sp, student, repo, teacher } = await setup({ grade: 2, subjects: ["Mathematik", "Deutsch"] });
  const spiele = (anteil: number, seed: number) => {
    const { rundeId, karten } = sp.starteRunde(student, "rechnen", { rng: rng(seed), heute: HEUTE });
    const gut = Math.round(karten.length * anteil);
    sp.beendeRunde(student.id, rundeId, karten.map((k, i) => ({ key: k.key, wahl: i < gut ? k.richtig : "falsch" })));
    return karten;
  };
  assert.ok(spiele(1, 1).every((k) => k.skill === "mathe.vs.addsub.zr100"));
  spiele(0.9, 2);
  assert.equal(sp.themenPlan(student, "rechnen", HEUTE)!.titel, "Thema: Einmaleins");
  const runde = spiele(0.5, 3);
  assert.equal(runde.length, 12);
  // nie „7 · 8“ und „8 · 7“ in einer Runde, und keine Antwort öfter als in der Hälfte der Karten
  const paare = runde.map((k) => k.vor.match(/\d+/g)!.map(Number).sort((a, b) => a - b).join("x"));
  assert.equal(new Set(paare).size, 12);
  assert.equal(sp.themenPlan(student, "rechnen", HEUTE)!.skillId, "mathe.vs.muldiv.einmaleins", "eine schwache Runde: das Thema bleibt");
  assert.ok(sp.spielVorschlaege(student, { heute: HEUTE }).some((v) => v.art === "rechnen"));

  const ohne = repo.getStudent(repo.createStudent({ name: "Mira Test", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Englisch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" }))!;
  assert.ok(sp.spielVorschlaege(ohne, { heute: HEUTE }).every((v) => v.art !== "rechnen"));
});

test("Duell: ein Thema, das der Jüngere gerade hat, für beide dieselben Karten", async () => {
  const { sp, student, db } = await setup();
  const ma = await import("./lernspiele-mathe");
  const karten = sp.duellThema("rechnen", 3, rng(8));
  assert.equal(karten.length, 12);
  const thema = ma.RECHNEN_THEMEN.find((t) => t.skill === karten[0].skill)!;
  assert.ok(thema.ab <= 3 && (thema.bis ?? 13) >= 3 && karten.every((k) => k.skill === thema.skill));
  const id = sp.starteRundeMitKarten(student.id, "rechnen", karten, 1);
  assert.equal((db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(id) as { skill_id: string }).skill_id, thema.skill);
});
