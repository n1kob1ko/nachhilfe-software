/**
 * Das Mathe-Spiel „Zahlenstrahl“ (lib/lernspiele-strahl.ts, lib/generators-figur.ts `strahlFuerSpiel`): eine Zahl an
 * die richtige Stelle schieben, je Runde ein Thema, das Thema kommt aus dem Stoff. Alle Namen sind erfunden; keine KI.
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
  const grade = o.grade ?? 6;
  const id = repo.createStudent({
    name: "Lena Test", grade, klasse: grade > 4 ? grade - 4 : grade, teacher_id: teacher.id, school: "", school_type: grade > 4 ? "AHS" : "Volksschule", subjects: o.subjects ?? ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, repo, sp, student: repo.getStudent(id)!, teacher };
}

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const HEUTE = "2026-11-11";
/** „−3“, „0,25“, „1 1/2“, „−5/4“, „3 000 000“ als Zahl. */
const wert = (text: string): number => {
  const gemischt = text.match(/^(\d+) (\d+)\/(\d+)$/);
  if (gemischt) return Number(gemischt[1]) + Number(gemischt[2]) / Number(gemischt[3]);
  const t = text.replace(/[\s\u00a0]/g, "").replace("−", "-").replace(",", ".");
  const bruch = t.match(/^(-?\d+)\/(\d+)$/);
  return bruch ? Number(bruch[1]) / Number(bruch[2]) : Number(t);
};

test("Karten: jedes Thema hat genug Karten; der Strahl steigt gleichmäßig, die Zahl liegt am richtigen Teilstrich", async () => {
  const { db } = await setup();
  const st = await import("./lernspiele-strahl");
  const th = await import("./lernspiele-themen");
  const bekannt = new Set((db().prepare("SELECT id FROM skills").all() as { id: string }[]).map((r) => r.id));
  assert.equal(new Set(st.STRAHL_THEMEN.map((t) => t.skill)).size, st.STRAHL_THEMEN.length);
  for (const t of st.STRAHL_THEMEN) {
    assert.ok(bekannt.has(t.skill), `${t.skill}: diese Fähigkeit gibt es nicht`);
    assert.ok(t.name.length <= 36 && t.ab >= 1 && (t.bis ?? 13) >= t.ab, t.skill);
    const k = st.strahlKandidaten(t.skill);
    assert.ok(k.length >= 20, `${t.skill}: nur ${k.length} Karten`);
    assert.equal(new Set(k.map((x) => x.karte.key)).size, k.length, `${t.skill}: Schlüssel doppelt`);
    // genug verschiedene Zahlen für eine Runde (nach keiner Zahl wird zweimal gefragt)
    assert.ok(new Set(k.map((x) => x.gruppe)).size >= 12, `${t.skill}: zu wenige verschiedene Zahlen`);
    for (const { karte, stufe } of k) {
      const s = karte.strahl!;
      const bei = Number(karte.richtig);
      assert.ok(karte.form === "strahl" && karte.mathe && karte.skill === t.skill && karte.faecher.length === 0, karte.key);
      assert.ok(stufe >= 0 && stufe <= 3 && s.werte.length >= 3 && s.werte.length <= 25, karte.key);
      // gefragt wird nach einem Teilstrich ohne Zahl, nie nach dem Rand
      assert.ok(Number.isInteger(bei) && bei > 0 && bei < s.werte.length - 1 && !s.beschriftet.includes(bei), karte.key);
      assert.equal(karte.wort, s.werte[bei], karte.key);
      assert.ok(s.beschriftet.includes(0) && s.beschriftet.includes(s.werte.length - 1), `${karte.key}: Anfang und Ende haben eine Zahl`);
      // gleiche Abstände, nach rechts größer; jede Zahl nur einmal
      const zahlen = s.werte.map(wert);
      const schritt = zahlen[1] - zahlen[0];
      assert.ok(schritt > 0 && zahlen.every((z, i) => Math.abs(z - (zahlen[0] + i * schritt)) < 1e-9), `${karte.key}: ${s.werte.join(" | ")}`);
      assert.equal(new Set(s.werte).size, s.werte.length, karte.key);
      assert.equal(Boolean(s.beide), zahlen[0] < 0, karte.key);
      // echtes Minus, ein Weg in höchstens drei Zeilen, Tipps nur zu anderen Teilstrichen
      assert.ok(!s.werte.some((w) => w.includes("-")) && !karte.regel.includes("-"), karte.key);
      assert.ok(karte.regel.split("\n").length <= 3 && karte.regel.includes(karte.wort!) && karte.loesung.startsWith(karte.wort!), karte.key);
      for (const i of Object.keys(karte.tipps ?? {})) assert.ok(Number(i) !== bei && Number(i) >= 0 && Number(i) < s.werte.length, karte.key);
    }
  }
  assert.deepEqual(th.spielbareThemen("strahl").map((t) => t.skill), st.STRAHL_THEMEN.map((t) => t.skill));
  assert.equal(th.themenKandidaten("mathe.dezimal.vergleichen")[0].karte.form, "strahl");
  assert.equal(th.themenKandidaten("mathe.dezimal.addieren")[0].karte.form, undefined, "Kopfrechnen bleibt bei den Kisten");
});

test("Brüche: als Anteil abgezählt (4/6), beim Erweitern gekürzt (2/3 bei den Zwölfteln); negative Zahlen überwiegen", async () => {
  const st = await import("./lernspiele-strahl");
  const anteile = st.strahlKandidaten("mathe.brueche.anteile").map((k) => k.karte);
  const sechstel = anteile.find((k) => k.strahl!.werte.length === 7 && k.richtig === "4")!;
  assert.deepEqual([sechstel.wort, sechstel.strahl!.werte.join(" "), sechstel.strahl!.beschriftet], ["4/6", "0 1/6 2/6 3/6 4/6 5/6 1", [0, 6]]);
  assert.equal(sechstel.regel, "Von 0 bis 1 sind es 6 Teilstücke, ein Teilstück ist also 1/6.\n4/6 liegt 2 Teilstücke links von 1: 1 − 2 · 1/6 = 4/6");
  assert.equal(sechstel.tipps?.["2"], "Von rechts statt von 0 aus gezählt");

  const erweitern = st.strahlKandidaten("mathe.brueche.vergleichen").map((k) => k.karte);
  const zwoelftel = erweitern.find((k) => k.strahl!.werte.length === 13 && k.richtig === "8")!;
  assert.equal(zwoelftel.wort, "2/3");
  assert.equal(zwoelftel.loesung, "2/3 = 8/12: der 8. Teilstrich nach 0");
  assert.equal(zwoelftel.tipps?.["2"], "Nur den Zähler abgezählt");

  const negativ = st.strahlKandidaten("mathe.negativ.zahlengerade").map((k) => k.karte);
  assert.ok(negativ.filter((k) => k.wort!.startsWith("−")).length >= negativ.length * 0.7);
  const minus3 = negativ.find((k) => k.wort === "−3")!;
  assert.equal(minus3.tipps?.[String(minus3.strahl!.werte.indexOf("3"))], "Vorzeichen verwechselt");
});

test("Reihenfolge und Stufen: Volksschule nach Zahlenraum, danach das Neueste der Schulstufe zuerst", async () => {
  const th = await import("./lernspiele-themen");
  const { stufenFuer } = await import("./lernspiele-karten");
  const fuer = (stufe: number) => th.themenFuerStufe("strahl", stufe).map((t) => t.skill);
  assert.deepEqual(fuer(2), ["mathe.vs.zahlen.zahlenstrahl"]);
  assert.deepEqual(fuer(5), ["mathe.zahlen.gross", "mathe.dezimal.vergleichen", "mathe.brueche.anteile"]);
  assert.deepEqual(fuer(6).slice(0, 2), ["mathe.brueche.vergleichen", "mathe.brueche.gemischt"]);
  assert.deepEqual(fuer(7).slice(0, 2), ["mathe.negativ.zahlengerade", "mathe.negativ.rational"]);
  assert.ok(!fuer(7).includes("mathe.zahlen.gross") && fuer(7).includes("mathe.dezimal.vergleichen"));
  assert.deepEqual(fuer(10), ["mathe.negativ.zahlengerade", "mathe.negativ.rational"]);
  assert.deepEqual([1, 2, 3, 4].map((s) => stufenFuer("strahl", s, null)), [[0], [0, 1], [1, 2], [2, 3]]);
  assert.deepEqual(stufenFuer("strahl", 6, null), [0, 1, 2]);
});

test("Vorschlag und Runde: Thema aus dem Stoff, gezählt wird die Nummer des Teilstrichs, Fehler kommen wieder", async () => {
  const { sp, repo, student } = await setup();
  assert.deepEqual(sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => x.art), ["rechnen", "strahl"]);
  assert.deepEqual(sp.themenPlan(student, "strahl", HEUTE), { skillId: "mathe.brueche.vergleichen", titel: "Thema: Brüche erweitern" });
  assert.deepEqual(sp.spieleZuSkills(["mathe.dezimal.vergleichen.stellenwert", "mathe.negativ.zahlengerade"]), ["strahl"]);

  repo.addTest({ student_id: student.id, date: "2026-11-20", subject: "Mathematik", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["mathe.dezimal.vergleichen"], title: "1. Schularbeit", status: "geplant" });
  assert.equal(sp.spielWoher(student, "strahl", HEUTE), "Thema: Dezimalzahlen");
  assert.deepEqual(sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => [x.art, x.quelle]), [["strahl", "pruefung"], ["rechnen", "fach"]]);

  const { rundeId, karten } = sp.starteRunde(student, "strahl", { rng: rng(3), heute: HEUTE });
  assert.equal(karten.length, 12);
  assert.ok(karten.every((k) => k.skill === "mathe.dezimal.vergleichen" && k.form === "strahl"));
  assert.equal(new Set(karten.map((k) => k.wort)).size, 12, "nach keiner Zahl zweimal");
  const e = sp.beendeRunde(student.id, rundeId, karten.map((k, i) => ({ key: k.key, wahl: i < 2 ? String(Number(k.richtig) + 1) : k.richtig })))!;
  assert.equal(e.richtig, 10);
  assert.deepEqual(sp.spielBelege(student.id).map((b) => b.skillId), ["mathe.dezimal.vergleichen"]);
  const naechste = sp.starteRunde(student, "strahl", { rng: rng(4), heute: HEUTE }).karten;
  assert.ok([karten[0].key, karten[1].key].every((key) => naechste.some((k) => k.key === key)));
  // der Lehrer sieht die Lösung als Satz
  const fehler = sp.spielUebersicht(student.id, HEUTE).fehler;
  assert.ok(fehler.length === 2 && fehler.every((f) => / liegt \d+ Teilstück/.test(f.loesung)));
});

test("Volksschule und Duell: 2. Klasse spielt bis 100; im Duell für beide dieselben Karten", async () => {
  const { sp, student, db } = await setup({ grade: 2 });
  const { karten } = sp.starteRunde(student, "strahl", { rng: rng(5), heute: HEUTE });
  assert.equal(karten.length, 12);
  assert.ok(karten.every((k) => k.skill === "mathe.vs.zahlen.zahlenstrahl" && wert(k.strahl!.werte[k.strahl!.werte.length - 1]) <= 100));
  const duell = sp.duellThema("strahl", 7, rng(8));
  assert.equal(duell.length, 12);
  assert.ok(duell.every((k) => k.skill === duell[0].skill && k.form === "strahl"));
  const id = sp.starteRundeMitKarten(student.id, "strahl", duell, 1);
  assert.equal((db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(id) as { skill_id: string }).skill_id, duell[0].skill);
});
