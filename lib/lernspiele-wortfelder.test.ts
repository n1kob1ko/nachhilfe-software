/**
 * Wortfelder der Schreib-Themen (lib/lernspiele-wortfelder.ts): das Spiel „Wortschatz“ und „der, die, das“ und
 * „Präteritum“ mit den Wörtern des Themas, wenn es im Stoff steht. Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const HEUTE = "2026-11-12";

async function setup(o: { grade?: number } = {}) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Lio Test", grade: o.grade ?? 5, klasse: 1, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, repo, sp, student: repo.getStudent(id)! };
}

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test("Wortfelder: jeder Eintrag wird eine Karte, die Antwort steht auf einer Kachel, keine Karte doppelt", async () => {
  const w = await import("./lernspiele-wortfelder");
  const { THEMA_KARTEN_MIN } = await import("./lernspiele-themen");
  const { waehleKarten } = await import("./lernspiele-karten");
  const keys = new Set<string>();
  for (const feld of w.WORTFELDER) {
    const karten = w.wortschatzKandidaten(feld.skill);
    assert.equal(karten.length, feld.saetze.length, `${feld.name}: jeder Satz hat genau eine Lücke`);
    assert.ok(karten.length >= THEMA_KARTEN_MIN + 4, `${feld.name}: genug Sätze für eine Runde`);
    for (const { karte } of karten) {
      assert.ok(!keys.has(karte.key), `${karte.key} doppelt`);
      keys.add(karte.key);
      assert.equal(karte.faecher.length, 3);
      assert.equal(new Set(karte.faecher.map((f) => f.toLowerCase())).size, 3, `${karte.key}: drei verschiedene Wörter`);
      assert.ok(karte.faecher.includes(karte.richtig));
      assert.equal(karte.vor + karte.richtig + karte.nach, karte.loesung);
      assert.ok(karte.regel.length > 10, `${karte.key}: Bedeutung`);
      assert.ok(karte.skill === feld.skill);
      // Groß- und Kleinschreibung verrät die Antwort nicht
      const gross = (s: string) => s[0] === s[0].toUpperCase() && s[0] !== s[0].toLowerCase();
      if (karte.vor.trim()) assert.ok(karte.faecher.every((f) => gross(f) === gross(karte.richtig)), `${karte.key}: alle Wörter gleich geschrieben`);
    }
    const runde = waehleKarten("wortschatz", { pool: karten, stufen: [0, 1, 2], rng: rng(3) });
    assert.equal(runde.length, 12);
    assert.ok(runde.every((k) => k.form === "kacheln"), `${feld.name}: als Kacheln`);
  }
});

test("Wortfelder: Nomen mit Artikel wie in der Artikel-Bank, Verben mit zwei falschen Formen", async () => {
  const w = await import("./lernspiele-wortfelder");
  const { artikelItems } = await import("./banks");
  const { waehleKarten } = await import("./lernspiele-karten");
  const bank = artikelItems();
  for (const feld of w.WORTFELDER) {
    const nomen = w.wortfeldArtikel(feld.skill);
    assert.ok(nomen.length >= 20, `${feld.name}: genug Nomen (${nomen.length})`);
    for (const n of feld.nomen) {
      const i = w.nomenItem(n);
      assert.ok(i, `${n}: Artikel und ein Wort`);
      const b = bank.find((x) => x.word === i.word && !x.meaning);
      // ein Wort mit zwei Artikeln (der/das Dschungel) bleibt draußen; sonst stimmt der Artikel mit der Bank
      if (b && !b.alsoArticle) assert.equal(b.article, i.article, `${n}: Artikel wie in der Bank`);
    }
    for (const { karte } of nomen) assert.deepEqual(karte.faecher, ["der", "die", "das"]);

    const verben = w.wortfeldPraeteritum(feld.skill);
    assert.equal(verben.length, feld.verben.length, `${feld.name}: jedes Verb wird eine Karte`);
    for (const { karte } of verben) {
      assert.equal(new Set(karte.faecher).size, 3, karte.key);
      assert.ok(karte.faecher.includes(karte.richtig) && /^\([a-zäöüß]+\)$/.test(karte.hinweis ?? ""), karte.key);
    }
    if (verben.length) assert.ok(waehleKarten("praeteritum", { pool: verben, stufen: [1], rng: rng(5) }).every((k) => k.form === "legen"));
  }
  // die Personenbeschreibung steht im Präsens: keine Verben
  assert.equal(w.wortfeld("deutsch.beschreiben.person")!.verben.length, 0);
});

test("Gruselgeschichte im Stoff: „Wortschatz“ zuerst, „der, die, das“ und „Präteritum“ spielen ihre Wörter", async () => {
  const { sp, repo, student, db } = await setup();
  const w = await import("./lernspiele-wortfelder");
  const grusel = w.WORTFELDER.find((f) => f.name === "Gruselgeschichte")!;
  // ohne Stoff: das gewöhnliche „der, die, das“
  assert.equal(sp.spielWoher(student, "artikel", HEUTE), undefined);

  repo.addTest({ student_id: student.id, date: "2026-11-20", subject: "Deutsch", kind: "Schularbeit", topic: "Gruselgeschichte", grade: null, points: null, max_points: null, notes: "", skill_ids: [grusel.skill], title: "1. Deutsch-Schularbeit", status: "geplant" });
  const vorschlaege = sp.spielVorschlaege(student, { heute: HEUTE });
  assert.deepEqual(vorschlaege.slice(0, 3).map((v) => v.art), ["wortschatz", "artikel", "praeteritum"]);
  assert.ok(vorschlaege.slice(0, 3).every((v) => v.quelle === "pruefung"));

  assert.equal(sp.spielWoher(student, "wortschatz", HEUTE), "Thema: Gruselgeschichte");
  assert.equal(sp.spielWoher(student, "artikel", HEUTE), "Wörter für: Gruselgeschichte");
  assert.equal(sp.spielWoher(student, "praeteritum", HEUTE), "Wörter für: Gruselgeschichte");

  const wort = sp.starteRunde(student, "wortschatz", { heute: HEUTE, rng: rng(1) });
  assert.equal(wort.karten.length, 12);
  assert.ok(wort.karten.every((k) => k.form === "kacheln" && k.key.startsWith("wortschatz:")));
  assert.equal((db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(wort.rundeId) as { skill_id: string }).skill_id, grusel.skill);

  const nomen = new Set(grusel.nomen.map((n) => w.nomenItem(n)!.word));
  const art = sp.starteRunde(student, "artikel", { heute: HEUTE, rng: rng(2) });
  assert.equal(art.karten.length, 12);
  assert.ok(art.karten.every((k) => nomen.has(k.wort!)), "nur Wörter aus der Gruselgeschichte");
  // der Lernstand bleibt bei „der, die, das“
  assert.equal((db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(art.rundeId) as { skill_id: string }).skill_id, "deutsch.grammatik.artikel");

  const saetze = new Set(w.wortfeldPraeteritum(grusel.skill).map((k) => k.karte.key));
  const prae = sp.starteRunde(student, "praeteritum", { heute: HEUTE, rng: rng(3) });
  assert.equal(prae.karten.length, 12);
  assert.ok(prae.karten.every((k) => saetze.has(k.key) && k.form === "legen"));
});

test("Märchen und Sage: auch die Literatur-Fähigkeit im Stoff bringt das Wortfeld; ohne Stoff eines der Schulstufe", async () => {
  const { sp, repo, student } = await setup({ grade: 3 });
  // 3. Schulstufe, kein Stoff: ein Wortfeld ab der 3. (Gruselgeschichte, Abenteuer oder Märchen), nie der Krimi
  assert.match(sp.spielWoher(student, "wortschatz", HEUTE)!, /^Thema: (Gruselgeschichte|Abenteuergeschichte|Märchen)$/);
  repo.addTest({ student_id: student.id, date: "2026-11-25", subject: "Deutsch", kind: "Test", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: ["deutsch.literatur.maerchen"], title: "Lesetest", status: "geplant" });
  assert.equal(sp.spielWoher(student, "wortschatz", HEUTE), "Thema: Märchen");
  assert.equal(sp.spielWoher(student, "artikel", HEUTE), "Wörter für: Märchen");
});
