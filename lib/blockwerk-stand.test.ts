/**
 * Blockwerk weiterspielen (lib/blockwerk-stand.ts, niko 2026-11-22: „was wenn ein schüler die runde nicht beendet aber
 * gehen muss“): der Stand eines angefangenen Spiels bleibt, auch über den nächsten Tag, und ist nach dem Ende weg.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const HEUTE = "2026-11-22";

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const bs = await import("./blockwerk-stand");
  const teacher = repo.listTeachers()[0];
  const neu = (name: string) =>
    repo.getStudent(
      repo.createStudent({
        name, grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Deutsch"],
        current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
      }),
    )!;
  return { db, sp, bs, student: neu("Mira Test"), andere: neu("Ben Test") };
}

const feld = (punkte: number) => ({
  brett: Array.from({ length: 64 }, (_, i) => (i < 5 ? 2 : i === 9 ? 5 : null)),
  teile: [{ id: 1, form: "1", zellen: [[0, 0]] as [number, number][], breite: 1, hoehe: 1, farbe: 0 }, null, null],
  punkte,
  kombo: { kombo: 1, ohne: 0 },
  blitze: 0,
  ladung: 3,
  serie: 2,
  gerettet: true,
  wartend: null,
});

test("merken, holen, nach dem Ende vergessen", async () => {
  const { sp, bs, student, andere } = await setup();
  const a = sp.starteRunde(student, "dasdass", { rng: rng(3), heute: HEUTE, endlos: "neu", bloecke: true });
  assert.equal(bs.offenesBlockwerk(student.id), null, "noch nichts gemerkt");
  const stand = { rundeId: a.rundeId, reihe: a.karten.map((k) => ({ key: k.key, wiederholung: false })), pos: 2, antworten: [{ key: a.karten[0].key, wahl: a.karten[0].richtig }], feld: feld(4200) };
  assert.equal(bs.merkeStand(andere.id, stand), false, "fremde Runde");
  assert.equal(bs.merkeStand(student.id, { ...stand, feld: { ...stand.feld, brett: [1, 2] } }), false, "kein Brett");
  assert.equal(bs.merkeStand(student.id, stand), true);
  const o = bs.offenesBlockwerk(student.id)!;
  assert.equal(o.lauf, a.rundeId);
  assert.equal(o.art, "dasdass");
  assert.equal(o.punkte, 4200);
  assert.equal(o.stand.pos, 2);
  assert.equal(o.karten.length, a.karten.length);
  assert.equal(bs.offenesBlockwerk(andere.id), null);
  // die Runde ist beendet: der Stand passt nicht mehr und wird vergessen
  sp.beendeRunde(student.id, a.rundeId, stand.antworten, { teil: true });
  assert.equal(bs.offenesBlockwerk(student.id), null);
  assert.equal(bs.merkeStand(student.id, stand), false, "eine beendete Runde merkt nichts mehr");
});

test("kein Blockwerk: nichts zu merken", async () => {
  const { sp, bs, student } = await setup();
  const e = sp.starteRunde(student, "dasdass", { rng: rng(4), heute: HEUTE, endlos: "neu" });
  const stand = { rundeId: e.rundeId, reihe: [], pos: 0, antworten: [], feld: feld(10) };
  assert.equal(bs.merkeStand(student.id, stand), false, "Endlos ist kein Blockwerk");
});

test("ein angefangenes Spiel bleibt über den nächsten Tag, andere offene Runden nicht", async () => {
  const { db, sp, bs, student } = await setup();
  const a = sp.starteRunde(student, "dasdass", { rng: rng(5), heute: HEUTE, endlos: "neu", bloecke: true });
  const fremd = sp.starteRunde(student, "artikel", { rng: rng(6), heute: HEUTE });
  bs.merkeStand(student.id, { rundeId: a.rundeId, reihe: a.karten.map((k) => ({ key: k.key, wiederholung: false })), pos: 0, antworten: [], feld: feld(900) });
  // zwei Tage später
  db().prepare("UPDATE spielrunden SET created_at = datetime('now', '-2 day')").run();
  sp.starteRunde(student, "artikel", { rng: rng(7), heute: HEUTE });
  assert.ok(db().prepare("SELECT 1 FROM spielrunden WHERE id = ?").get(a.rundeId), "das Blockwerk-Spiel ist noch da");
  assert.equal(db().prepare("SELECT 1 FROM spielrunden WHERE id = ?").get(fremd.rundeId), undefined, "die andere offene Runde ist weg");
  assert.equal(bs.offenesBlockwerk(student.id)?.punkte, 900);
  // nach drei Wochen ist auch das weg
  db().prepare("UPDATE spielrunden SET created_at = datetime('now', '-21 day')").run();
  sp.starteRunde(student, "artikel", { rng: rng(8), heute: HEUTE });
  assert.equal(bs.offenesBlockwerk(student.id), null);
  assert.equal(db().prepare("SELECT 1 FROM spielrunden WHERE id = ?").get(a.rundeId), undefined);
});
