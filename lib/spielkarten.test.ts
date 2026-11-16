/**
 * Spielkarten (lib/spielkarten-text.ts, lib/spielkarten.ts): eigener Stoff für „Dein Stoff“ und Blockwerk. Text lesen,
 * Karten fürs Spiel, Vorschläge der KI prüfen, Speichern und Spielen. Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const BIO = `# Evolution
Zufällige Veränderung der DNA, ein Kopierfehler = Mutation | Rekombination | Selektion
Wer sagte: „Arten sind unveränderlich“? = Cuvier | Lamarck | Darwin
Merke: Cuvier glaubte an Katastrophen, nicht an Evolution.
Magma ist geschmolzenes Gestein ___ der Erde. = im Inneren | an der Oberfläche
Himalaya und Alpen entstehen an einer … = Faltengebirge | Subduktionszone | Spreizungszone | Hot Spot
Ordne das Zeitseil, das Älteste zuerst: Erdurzeit > Erdaltertum > Erdmittelalter > Erdneuzeit`;

test("Text: Auswahl, Lücke, Reihenfolge und Merke werden gelesen", async () => {
  const t = await import("./spielkarten-text");
  const g = t.leseKarten(BIO);
  assert.deepEqual(g.fehler, []);
  assert.equal(g.karten.length, 5);
  const [mut, cuvier, magma, , zeit] = g.karten;
  assert.deepEqual(mut, { art: "wahl", frage: "Zufällige Veränderung der DNA, ein Kopierfehler", richtig: "Mutation", falsch: ["Rekombination", "Selektion"], merke: "", zeile: 2 });
  assert.equal(cuvier.merke, "Cuvier glaubte an Katastrophen, nicht an Evolution.");
  assert.equal(cuvier.art === "wahl" && cuvier.frage, "Wer sagte: „Arten sind unveränderlich“?");
  assert.equal(magma.art === "wahl" && magma.richtig, "im Inneren");
  assert.deepEqual(zeit, { art: "reihe", frage: "Ordne das Zeitseil, das Älteste zuerst", teile: ["Erdurzeit", "Erdaltertum", "Erdmittelalter", "Erdneuzeit"], merke: "", zeile: 7 });
  // zurück als Text und wieder gelesen: dieselben Karten
  assert.deepEqual(
    t.leseKarten(t.kartenAlsText(g.karten)).karten.map(({ zeile: _z, ...k }) => k),
    g.karten.map(({ zeile: _z, ...k }) => k),
  );
});

test("Text: Fehler halten auf, doppelte Fragen sind ein Hinweis", async () => {
  const t = await import("./spielkarten-text");
  const g = t.leseKarten(["Was ist Selektion? = Auslese", "Ohne Trenner", "Frage = a | a", "Merke: hängt an nichts", "Reihe: A > B", "Zufällige Veränderung = Mutation | Selektion", "zufällige veränderung = Mutation | Drift"].join("\n"));
  assert.deepEqual(
    g.fehler.map((f) => f.zeile),
    [1, 2, 3, 4, 5],
  );
  assert.match(g.fehler[0].text, /mindestens eine falsche/);
  assert.match(g.fehler[1].text, /„=“/);
  assert.match(g.fehler[2].text, /zweimal/);
  assert.equal(g.karten.length, 1);
  assert.equal(g.hinweise.length, 2, "die doppelte Frage und: ins Spiel erst ab 4 Karten");
});

test("Spielkarten: zwei Antworten wischen, mehr sind Kacheln, Reihenfolge wie Satzbau; Schlüssel hängt an der Frage", async () => {
  const t = await import("./spielkarten-text");
  const { REIHE_TRENNER } = await import("./lernspiele-typen");
  const [mut, , magma, , zeit] = t.leseKarten(BIO).karten;
  const k1 = t.alsSpielKarte(mut, "stoff.eigen");
  assert.equal(k1.form, "kacheln");
  assert.deepEqual([...k1.faecher].sort(), ["Mutation", "Rekombination", "Selektion"]);
  assert.equal(k1.richtig, "Mutation");
  assert.equal(k1.vor, "Zufällige Veränderung der DNA, ein Kopierfehler");
  assert.equal(k1.loesung, "Zufällige Veränderung der DNA, ein Kopierfehler → Mutation");
  assert.deepEqual(t.alsSpielKarte(mut, "x").faecher, k1.faecher, "immer dieselbe Reihenfolge");
  const k2 = t.alsSpielKarte(magma, "stoff.eigen");
  assert.equal(k2.form, "wischen");
  assert.equal(k2.vor, "Magma ist geschmolzenes Gestein");
  assert.equal(k2.nach, "der Erde.");
  assert.equal(k2.loesung, "Magma ist geschmolzenes Gestein im Inneren der Erde.");
  const k3 = t.alsSpielKarte(zeit, "stoff.eigen");
  assert.equal(k3.form, "reihe");
  assert.equal(k3.auftrag, "Ordne das Zeitseil, das Älteste zuerst");
  assert.equal(k3.richtig, ["Erdurzeit", "Erdaltertum", "Erdmittelalter", "Erdneuzeit"].join(REIHE_TRENNER));
  assert.notEqual(k3.faecher.join(REIHE_TRENNER), k3.richtig, "gemischt");
  // andere Antworten, dieselbe Frage: derselbe Schlüssel (eine falsche Karte kommt wieder)
  assert.equal(t.kartenKey({ frage: mut.frage }), k1.key);
});

test("KI-Vorschläge: was nicht passt, fällt weg; Trennzeichen in Antworten zerbrechen nichts", async () => {
  const { spielkartenAus } = await import("./ai/stoffpaket");
  const { leseKarten } = await import("./spielkarten-text");
  const weg: string[] = [];
  const text = spielkartenAus(
    [
      { art: "wahl", frage: "Wer erklärte Evolution durch natürliche Auslese?", richtig: "Darwin", falsch: ["Lamarck", "Cuvier"], teile: [], merke: "Darwin: die Besten überleben." },
      { art: "wahl", frage: "Was ist 2 = 2?", richtig: "wahr | immer", falsch: ["falsch"], teile: [], merke: "" },
      { art: "wahl", frage: "Ohne falsche Antwort", richtig: "x", falsch: [], teile: [], merke: "" },
      { art: "reihe", frage: "Ordne: von alt nach jung", richtig: "", falsch: [], teile: ["Präkambrium", "Paläozoikum: Fische", "Mesozoikum"], merke: "" },
      { art: "reihe", frage: "Zu kurz", richtig: "", falsch: [], teile: ["A", "B"], merke: "" },
    ],
    weg,
  );
  const g = leseKarten(text);
  assert.deepEqual(g.fehler, []);
  assert.equal(g.karten.length, 3);
  assert.equal(g.karten[0].merke, "Darwin: die Besten überleben.");
  assert.equal(g.karten[1].art === "wahl" && g.karten[1].richtig, "wahr / immer");
  assert.deepEqual(g.karten[2].art === "reihe" && g.karten[2].teile, ["Präkambrium", "Paläozoikum, Fische", "Mesozoikum"]);
  assert.equal(weg.length, 2);
  assert.match(weg[0], /^Spielkarte 3:/);
});

async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const teacher = repo.listTeachers()[0];
  const id = repo.createStudent({
    name: "Lena Probe", grade: 7, klasse: 3, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { db, repo, student: repo.getStudent(id)!, teacher, sk: await import("./spielkarten"), sp: await import("./lernspiele") };
}

test("Dein Stoff: der neueste aktive Satz kommt zuerst, auch fürs Blockwerk; Runden zählen nur die eigenen Karten", async () => {
  const { student, teacher, sk, sp, db } = await setup();
  const heute = new Date().toISOString().slice(0, 10);
  assert.ok(!sp.spielVorschlaege(student, { heute }).some((v) => v.art === "stoff"), "ohne Karten kein Spiel");

  const fehler = sk.speichereSatz({ studentId: student.id, teacherId: teacher.id, titel: " ", fach: "Biologie", text: "nur Text" });
  assert.equal(fehler.ok, false);

  const r = sk.speichereSatz({ studentId: student.id, teacherId: teacher.id, titel: "Evolution", fach: "Biologie", text: BIO });
  assert.ok(r.ok);
  const v = sp.spielVorschlaege(student, { heute });
  assert.deepEqual(v[0], { art: "stoff", grund: "Dein Stoff: Evolution", quelle: "stoff" });
  assert.equal(sp.spielWoher(student, "stoff", heute), "Evolution");
  assert.equal(sp.spielAntwort(student, "stoff", heute), "kacheln");

  // ein Entwurf (nicht im Spiel) ändert nichts
  sk.speichereSatz({ studentId: student.id, teacherId: teacher.id, titel: "Entwurf", fach: "Biologie", text: BIO.replace("Mutation", "Mutationen"), aktiv: false });
  assert.equal(sk.spielSatz(student.id)?.titel, "Evolution");

  const runde = sp.starteRunde(student, "stoff", { heute, endlos: "neu", bloecke: true });
  assert.equal(runde.karten.length, 5, "alle fünf Karten (weniger als zwölf im Satz)");
  assert.ok(runde.karten.every((k) => k.key.startsWith("stoff:") && k.skill === "stoff.eigen"));
  const falsch = runde.karten.find((k) => k.form === "kacheln")!;
  sp.beendeRunde(
    student.id,
    runde.rundeId,
    runde.karten.map((k) => ({ key: k.key, wahl: k === falsch ? k.faecher.find((f) => f !== k.richtig)! : k.richtig })),
  );
  assert.deepEqual(sp.offeneFehler(student.id, "stoff"), [falsch.key]);
  const satz = sk.spielSatz(student.id)!;
  const st = sk.satzStand(satz);
  assert.equal(st.runden, 1);
  assert.equal(st.richtig, 4);
  assert.equal(st.antworten, 5);
  assert.deepEqual(st.schwer, [{ loesung: falsch.loesung, mal: 1 }]);
  // die Runde zählt nicht für eine echte Fähigkeit
  const zeile = db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(runde.rundeId) as { skill_id: string };
  assert.equal(zeile.skill_id, "stoff.eigen");

  // aus dem Spiel genommen: weg aus den Vorschlägen
  sk.setzeAktiv(satz.id, false);
  assert.equal(sk.spielSatz(student.id), null);
  assert.ok(!sp.spielVorschlaege(student, { heute }).some((v) => v.art === "stoff"));
});

test("Dein Stoff: ältere Karten nur noch zum Wiederholen, und nie im Duell", async () => {
  const { student, teacher, sk, sp, db } = await setup();
  const r = sk.speichereSatz({ studentId: student.id, teacherId: teacher.id, titel: "Evolution", fach: "Biologie", text: BIO });
  assert.ok(r.ok);
  db().prepare("UPDATE spielkarten SET updated_at = '2026-09-01 10:00:00' WHERE id = ?").run(r.ok ? r.id : 0);
  const v = sp.spielVorschlaege(student, { heute: "2026-11-16" });
  assert.equal(v[v.length - 1].art, "stoff");
  assert.equal(v[v.length - 1].grund, "Zum Wiederholen");
  const { DUELL_ARTEN, istDuellArt } = await import("./lernspiele-typen");
  assert.ok(!DUELL_ARTEN.includes("stoff"));
  assert.equal(istDuellArt("stoff"), false);
  const duelle = await import("./duelle");
  const d = duelle.erstelleDuell(student, "stoff");
  assert.equal(d.ok, false);
});

test("Blockwerk und Endlos: keine Karte kommt wieder, bevor alle dran waren; dann die am längsten nicht gesehenen", async () => {
  const { student, teacher, sk, sp } = await setup();
  const heute = new Date().toISOString().slice(0, 10);
  const text = Array.from({ length: 30 }, (_, i) => `Frage ${i + 1} = richtig ${i + 1} | falsch ${i + 1} | anders ${i + 1}`).join("\n");
  assert.ok(sk.speichereSatz({ studentId: student.id, teacherId: teacher.id, titel: "Viele", fach: "Biologie", text }).ok);
  const erste = sp.starteRunde(student, "stoff", { heute, endlos: "neu", bloecke: true });
  const lauf = erste.endlos!;
  const runden = [erste.karten.map((k) => k.key)];
  for (let i = 0; i < 4; i++) runden.push(sp.starteRunde(student, "stoff", { heute, endlos: lauf }).karten.map((k) => k.key));
  const alle = runden.flat();
  assert.equal(new Set(alle.slice(0, 24)).size, 24, "die ersten zwei Runden: 24 verschiedene Fragen");
  assert.equal(new Set(runden.slice(0, 3).flat()).size, 30, "nach drei Runden waren alle 30 dran");
  // Runde 3 füllt mit den ältesten auf: aus Runde 1, nicht aus Runde 2
  const dritte = runden[2].filter((k) => alle.slice(0, 24).includes(k));
  assert.equal(dritte.length, 6);
  assert.ok(dritte.every((k) => runden[0].includes(k)));
  // auch danach: in zwei Runden hintereinander nie dieselbe Karte
  for (let i = 1; i < runden.length; i++) assert.ok(!runden[i].some((k) => runden[i - 1].includes(k)), `Runde ${i + 1}`);
});
