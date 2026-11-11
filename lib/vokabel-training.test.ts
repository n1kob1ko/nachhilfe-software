/**
 * Vokabeln üben in der Schüler-App (lib/vokabel-training.ts, niko 2026-11-11): Karteikasten je Wort einer eigenen Liste,
 * Runden mit bis zu 10 Wörtern, nur die erste Antwort je Wort zählt, die Lösungen bleiben auf dem Server.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const LISTE = [
  "dog = der Hund | My *dog* loves long walks.",
  "cat = die Katze",
  "horse = das Pferd",
  "bird = der Vogel",
  "to feed = füttern",
  "cage = der Käfig",
  "zoo keeper = der Tierpfleger",
  "lion = der Löwe",
  "monkey = der Affe",
  "snake = die Schlange",
  "tiger = der Tiger",
  "elephant = der Elefant",
].join("\n");

let n = 0;
const rng = () => (n = (n * 9301 + 49297) % 233280) / 233280;

async function setup(text = LISTE) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({
    name: "Lina Muster",
    grade: 6,
    klasse: 2,
    teacher_id: teacher.id,
    school: "",
    school_type: "Gymnasium",
    subjects: ["Englisch"],
    current_topics: "",
    strengths_note: "",
    weaknesses_note: "",
    goals: "",
    notes: "",
    ki_hinweise: "",
  });
  const { speichereListe } = await import("./vokabellisten");
  const r = speichereListe({
    studentId: sid,
    teacherId: teacher.id,
    title: "Unit 3",
    text,
  });
  assert.ok(r.ok);
  return { sid, listeId: r.ok ? r.id : 0, teacher };
}

/** Die richtige Antwort einer Karte, wie der Server sie kennt (nur im Test). */
async function richtigeAntwort(rundeId: number, i: number): Promise<string> {
  const { db, json } = await import("./db");
  const r = db()
    .prepare("SELECT karten FROM vokabelrunden WHERE id = ?")
    .get(rundeId) as { karten: string };
  const t = json<
    {
      task: {
        type: string;
        answer: { correct?: number; accepted?: string[]; blanks?: string[][] };
      };
    }[]
  >(r.karten, [])[i].task;
  if (typeof t.answer.correct === "number") return String(t.answer.correct);
  return t.answer.accepted?.[0] ?? t.answer.blanks![0][0];
}

test("a first round: 10 words, at most 5 new ones only when others are due; new words come as multiple choice", async () => {
  const { sid, listeId } = await setup();
  const { starteVokabelRunde, listenStand } =
    await import("./vokabel-training");
  const r = starteVokabelRunde(sid, listeId, { heute: "2026-11-11", rng })!;
  // nothing seen yet: the round fills up with new words in list order
  assert.equal(r.karten.length, 10);
  assert.ok(
    r.karten.every(
      (k) => k.art === "auswahl" && (k.optionen?.length ?? 0) === 3,
    ),
    "new words: three options",
  );
  assert.ok(
    !JSON.stringify(r.karten).includes("accepted"),
    "no solution goes to the student",
  );
  const { getListe } = await import("./vokabellisten");
  const s = listenStand(sid, getListe(listeId)!, "2026-11-11");
  assert.deepEqual(
    [s.woerter, s.neu, s.sitzt, s.ueben, s.dran],
    [12, 12, 0, 0, 5],
  );
});

test("first answer counts: right moves a box up, wrong goes back; a repeat does not count; stand and end", async () => {
  const { sid, listeId } = await setup();
  const t = await import("./vokabel-training");
  const r = t.starteVokabelRunde(sid, listeId, { heute: "2026-11-11", rng })!;
  for (const k of r.karten) {
    const richtig = await richtigeAntwort(r.rundeId, k.i);
    const geben = k.i < 2 ? String((Number(richtig) + 1) % 3) : richtig; // the first two wrong
    const a = t.pruefeVokabelKarte(sid, r.rundeId, k.i, geben, {
      heute: "2026-11-11",
    })!;
    assert.equal(a.ergebnis, k.i < 2 ? "falsch" : "richtig");
    assert.equal(a.gezaehlt, true);
    assert.ok(a.richtig && a.loesung.includes(" = "));
  }
  // the wrong word again at the end of the round: right now, but it does not count
  const nochmal = t.pruefeVokabelKarte(
    sid,
    r.rundeId,
    0,
    await richtigeAntwort(r.rundeId, 0),
    { heute: "2026-11-11" },
  )!;
  assert.equal(nochmal.ergebnis, "richtig");
  assert.equal(nochmal.gezaehlt, false);
  const ende = t.beendeVokabelRunde(sid, r.rundeId, "2026-11-11")!;
  assert.equal(ende.richtig, 8);
  assert.equal(ende.anzahl, 10);
  assert.equal(ende.nochmal.length, 2);
  assert.deepEqual(
    [ende.stand.neu, ende.stand.ueben, ende.stand.sitzt],
    [2, 10, 0],
  );
  assert.equal(ende.stand.schwer.length, 2);
  // a finished round takes no more answers
  assert.equal(t.pruefeVokabelKarte(sid, r.rundeId, 3, "0"), null);

  // next round, same day: the two wrong ones first, then the due ones (box 1 is due the same day), then new
  const r2 = t.starteVokabelRunde(sid, listeId, { heute: "2026-11-11", rng })!;
  const { db } = await import("./db");
  const woerter = (id: number) =>
    (
      JSON.parse(
        (
          db()
            .prepare("SELECT karten FROM vokabelrunden WHERE id = ?")
            .get(id) as { karten: string }
        ).karten,
      ) as { wort: string }[]
    ).map((k) => k.wort);
  assert.deepEqual(
    woerter(r2.rundeId).slice(0, 2),
    woerter(r.rundeId).slice(0, 2),
  );
  assert.equal(
    r2.karten[0].optionen?.length,
    3,
    "a wrong new word stays in box 0: three options",
  );
  assert.equal(r2.karten[2].optionen?.length, 4, "box 1: four options");
});

test("box intervals: a word in box 2 is due after a day, in box 5 after two weeks; written from box 2", async () => {
  const { istDran, waehleWoerter, wortKey } =
    await import("./vokabel-training");
  assert.equal(
    istDran(
      { fach: 2, zuletzt: "2026-11-11", zuletzt_falsch: 0 },
      "2026-11-11",
    ),
    false,
  );
  assert.equal(
    istDran(
      { fach: 2, zuletzt: "2026-11-11", zuletzt_falsch: 0 },
      "2026-11-12",
    ),
    true,
  );
  assert.equal(
    istDran(
      { fach: 5, zuletzt: "2026-11-01", zuletzt_falsch: 0 },
      "2026-11-14",
    ),
    false,
  );
  assert.equal(
    istDran(
      { fach: 5, zuletzt: "2026-11-01", zuletzt_falsch: 0 },
      "2026-11-15",
    ),
    true,
  );
  assert.equal(
    istDran(
      { fach: 5, zuletzt: "2026-11-11", zuletzt_falsch: 1 },
      "2026-11-11",
    ),
    true,
  );
  const { leseListe } = await import("./vokabeln");
  const e = leseListe(LISTE).eintraege;
  // all seen and not due: the least sure first; never more than 10
  const stand = new Map(
    e.map((x, i) => [
      wortKey(x),
      { fach: i % 2 ? 4 : 3, zuletzt: "2026-11-11", zuletzt_falsch: 0 },
    ]),
  );
  const w = waehleWoerter(e, stand, "2026-11-11");
  assert.equal(w.length, 10);
  assert.equal(w[0].en[0], "dog");
  assert.equal(w[1].en[0], "horse");
});

test("box 2 asks a written answer; an answer the app cannot decide is the student's call", async () => {
  const { sid, listeId } = await setup();
  const t = await import("./vokabel-training");
  const { db } = await import("./db");
  const { leseListe } = await import("./vokabeln");
  for (const e of leseListe(LISTE).eintraege)
    db()
      .prepare(
        "INSERT INTO vokabel_stand (student_id, liste_id, wort, fach, zuletzt) VALUES (?, ?, ?, 2, '2026-11-01')",
      )
      .run(sid, listeId, t.wortKey(e));
  const r = t.starteVokabelRunde(sid, listeId, { heute: "2026-11-11", rng })!;
  assert.ok(r.karten.every((k) => k.art === "schreiben"));
  const k = r.karten[0];
  const offen = t.pruefeVokabelKarte(sid, r.rundeId, k.i, "xylophonartig", {
    heute: "2026-11-11",
  })!;
  assert.equal(offen.ergebnis, "offen");
  assert.equal(offen.gezaehlt, false);
  assert.doesNotMatch(
    offen.text,
    /Lehrer/,
    "no teacher looks at a practice answer",
  );
  const selbst = t.pruefeVokabelKarte(sid, r.rundeId, k.i, "xylophonartig", {
    heute: "2026-11-11",
    selbst: true,
  })!;
  assert.equal(selbst.ergebnis, "richtig");
  assert.equal(selbst.gezaehlt, true);
  const fach = (
    db()
      .prepare(
        "SELECT fach FROM vokabel_stand WHERE student_id = ? AND liste_id = ? AND wort = ?",
      )
      .get(
        sid,
        listeId,
        JSON.parse(
          (
            db()
              .prepare("SELECT karten FROM vokabelrunden WHERE id = ?")
              .get(r.rundeId) as { karten: string }
          ).karten,
        )[0].wort,
      ) as { fach: number }
  ).fach;
  assert.equal(fach, 3);
});

test("only the student's own lists; a deleted list takes its stand and rounds with it", async () => {
  const { sid, listeId, teacher } = await setup();
  const t = await import("./vokabel-training");
  const repo = await import("./repo");
  const andere = repo.createStudent({
    name: "Max Muster",
    grade: 6,
    klasse: 2,
    teacher_id: teacher.id,
    school: "",
    school_type: "Gymnasium",
    subjects: ["Englisch"],
    current_topics: "",
    strengths_note: "",
    weaknesses_note: "",
    goals: "",
    notes: "",
    ki_hinweise: "",
  });
  assert.equal(t.starteVokabelRunde(andere, listeId), null);
  const r = t.starteVokabelRunde(sid, listeId, { rng })!;
  assert.equal(t.pruefeVokabelKarte(andere, r.rundeId, 0, "0"), null);
  t.pruefeVokabelKarte(sid, r.rundeId, 0, "0");
  assert.equal(t.alleListenStand(sid).length, 1);
  const { loescheListe } = await import("./vokabellisten");
  loescheListe(listeId);
  const { db } = await import("./db");
  assert.equal(
    (
      db().prepare("SELECT COUNT(*) AS n FROM vokabel_stand").get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.equal(
    (
      db().prepare("SELECT COUNT(*) AS n FROM vokabelrunden").get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.equal(t.alleListenStand(sid).length, 0);
});
