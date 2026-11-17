/**
 * Fehlerprotokoll je Schüler (lib/fehlerprotokoll.ts, Text in lib/fehlerprotokoll-text.ts): jede Zeile „falsch → richtig“
 * wird eine Karte zum Wischen mit der Stelle des Fehlers als Lücke, und ein Fehler fliegt raus, wenn er zweimal
 * hintereinander richtig war. Alle Namen und Sätze sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const HEUTE = "2026-11-17";

async function setup() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const fp = await import("./fehlerprotokoll");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Tom Test", grade: 11, klasse: 3, teacher_id: teacher.id, school: "", school_type: "HTL", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, sp, fp, teacher, student: repo.getStudent(id)! };
}

const PROTOKOLL = `# aus der letzten Erörterung
„Die Schule muss Kindern unterstützen“ → „Die Schule muss Kinder unterstützen“
Merke: unterstützen + Akkusativ (wen?)
Das wirkt sich gut für den Schlaf aus -> Das wirkt sich gut auf den Schlaf aus
seine neue Schuhe ist → seine neuen Schuhe sind
im Gespräch mit seinem Schwester → im Gespräch mit seiner Schwester`;

test("Text: die Stelle mit dem Fehler wird die Lücke, Merke gehört zur Zeile darüber", async () => {
  const t = await import("./fehlerprotokoll-text");
  const { eintraege, fehler, hinweise } = t.leseFehler(PROTOKOLL);
  assert.deepEqual([fehler, hinweise], [[], []]);
  assert.deepEqual(
    eintraege.map((e) => [e.vor, e.stelleFalsch, e.stelleRichtig, e.nach]),
    [
      ["Die Schule muss", "Kindern", "Kinder", "unterstützen"],
      ["Das wirkt sich gut", "für", "auf", "den Schlaf aus"],
      ["seine", "neue Schuhe ist", "neuen Schuhe sind", ""],
      ["im Gespräch mit", "seinem", "seiner", "Schwester"],
    ],
  );
  assert.equal(eintraege[0].merke, "unterstützen + Akkusativ (wen?)");
  assert.equal(eintraege[0].falsch, "Die Schule muss Kindern unterstützen", "Anführungszeichen außen weg");
  // ein Wort fehlt auf einer Seite: die Stelle nimmt ein Nachbarwort mit
  assert.deepEqual(t.stelle("anstatt zu helfen", "anstatt helfen"), { vor: "", nach: "helfen", stelleFalsch: "anstatt zu", stelleRichtig: "anstatt" });
  assert.deepEqual(t.stelle("Er kam an", "Er kam an."), { vor: "Er kam", nach: "", stelleFalsch: "an", stelleRichtig: "an." });
  // Fehler und Hinweise mit Zeile
  const schlecht = t.leseFehler("ohne Pfeil\nGleich → Gleich\nMerke: allein\nder Hund → die Hund\nder Hund → das Hund\n" + "a ".repeat(30) + "x → " + "b ".repeat(30) + "y");
  assert.deepEqual(
    schlecht.fehler.map((m) => m.zeile),
    [1, 2, 3, 6],
  );
  assert.deepEqual(schlecht.hinweise.map((m) => m.zeile), [5]);
  // die Karte: zwei Seiten zum Wischen, die richtige mal links, mal rechts, der Merksatz nach einem Fehler
  const karten = eintraege.map((e) => t.alsFehlerKarte(e, "stoff.fehler"));
  assert.ok(karten.every((k) => k.form === "wischen" && k.faecher.length === 2 && k.faecher.includes(k.richtig) && k.regel.length > 10));
  assert.equal(karten[0].regel, "unterstützen + Akkusativ (wen?)");
  assert.equal(karten[1].regel, "Richtig: Das wirkt sich gut auf den Schlaf aus. Nicht: Das wirkt sich gut für den Schlaf aus.");
  const viele = t.leseFehler(Array.from({ length: 20 }, (_, i) => `Satz ${i} mit dem Fehler → Satz ${i} ohne den Fehler`).join("\n")).eintraege.map((e) => t.alsFehlerKarte(e, "x"));
  const links = viele.filter((k) => k.faecher[0] === k.richtig).length;
  assert.ok(links >= 4 && links <= 16, `nicht immer auf derselben Seite (${links} von 20 links)`);
});

test("Spiel: „Meine Fehler“ kommt zuerst, ein Fehler fliegt nach zweimal richtig hintereinander raus", async () => {
  const { sp, fp, teacher, student } = await setup();
  assert.ok(!sp.spielVorschlaege(student, { heute: HEUTE }).some((v) => v.art === "fehler"), "ohne Protokoll kein Spiel");
  assert.deepEqual(fp.speichereFehlerprotokoll(student.id, teacher.id, PROTOKOLL), { ok: true });
  const v = sp.spielVorschlaege(student, { heute: HEUTE });
  assert.deepEqual([v[0].art, v[0].grund], ["fehler", "Dein Fehlerprotokoll"]);
  assert.equal(sp.spielWoher(student, "fehler", HEUTE), "Noch 4 Fehler offen");

  const runde = (falschBei: (richtig: string) => boolean = () => false) => {
    const r = sp.starteRunde(student, "fehler", { heute: HEUTE, rng: rng(7) });
    sp.beendeRunde(student.id, r.rundeId, r.karten.map((k) => ({ key: k.key, wahl: falschBei(k.richtig) ? k.faecher.find((f) => f !== k.richtig)! : k.richtig })));
    return r.karten;
  };
  const erste = runde((r) => r === "auf");
  assert.equal(erste.length, 4);
  assert.ok(erste.every((k) => k.form === "wischen" && k.skill === fp.FEHLER_SKILL));
  // zweite Runde alles richtig: drei sind zweimal hintereinander richtig, „auf“ erst einmal
  runde();
  const stand = fp.fehlerStand(student.id);
  assert.deepEqual(stand.map((e) => [e.stelleRichtig, e.folge, e.geschafft]), [
    ["Kinder", 2, true],
    ["auf", 1, false],
    ["neuen Schuhe sind", 2, true],
    ["seiner", 2, true],
  ]);
  assert.deepEqual([stand[1].versuche, stand[1].treffer], [2, 1]);
  // jetzt nur noch der offene; wieder falsch setzt die Folge auf null
  assert.deepEqual(runde(() => true).map((k) => k.richtig), ["auf"]);
  assert.equal(fp.fehlerStand(student.id)[1].folge, 0);
  runde();
  assert.equal(sp.spielWoher(student, "fehler", HEUTE), "Noch 1 Fehler offen");
  runde();
  assert.equal(fp.offeneFehlerZahl(student.id), 0);
  assert.ok(!sp.spielVorschlaege(student, { heute: HEUTE }).some((x) => x.art === "fehler"), "alles geschafft: kein Spiel mehr");
  assert.equal(sp.starteRunde(student, "fehler", { heute: HEUTE }).karten.length, 0);

  // ein neuer Fehler im Text kommt dazu, die geschafften bleiben geschafft
  fp.speichereFehlerprotokoll(student.id, teacher.id, `${PROTOKOLL}\nwegen dem Regen → wegen des Regens`);
  assert.equal(fp.offeneFehlerZahl(student.id), 1);
  // die Runden zählen für keine Fähigkeit im Lernstand außer dem Protokoll selbst, und kein Duell
  assert.ok(sp.spielBelege(student.id).every((b) => b.skillId === fp.FEHLER_SKILL));
  const typen = await import("./lernspiele-typen");
  assert.ok(!typen.istDuellArt("fehler") && typen.hatEndlos("fehler") && typen.torTauglich("fehler"));
  // Speichern mit Fehlern hält auf, leerer Text löscht
  const nein = fp.speichereFehlerprotokoll(student.id, teacher.id, "kein Pfeil");
  assert.equal(nein.ok, false);
  assert.equal(fp.offeneFehlerZahl(student.id), 1);
  fp.speichereFehlerprotokoll(student.id, teacher.id, "  ");
  assert.equal(fp.fehlerprotokoll(student.id), null);
});
