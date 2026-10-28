import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Terminanfragen (Plan 3.3): verschieben und tauschen, Zustimmung der anderen Seite, Bestätigung durch die
 * Verwaltung mit der Doppelbuchungsprüfung des Wochenplans in diesem Moment, keine Namen für Schüler. Dazu die
 * Prüfung der von Hand geplanten Einheiten. Erfundene Namen; die Uhr steht fest.
 *
 * 2026-10-12 ist ein Montag. JETZT ist Montag 08:00 in Wien (UTC+2).
 */
const MONTAG = "2026-10-12";
const JETZT = new Date("2026-10-12T06:00:00Z");

async function setup() {
  const { db, resetForTests } = await import("../db");
  resetForTests();
  const repo = await import("../repo");
  const planung = await import("./repo");
  const ta = await import("./terminanfragen");
  const { zuErledigen } = await import("../zu-erledigen");
  const auth = await import("../auth");
  const { INITIAL_PASSWORD } = await import("../password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!; // Verwaltung
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  const schueler = (name: string, teacherId = niko.id) =>
    repo.createStudent({
      name,
      grade: 6,
      klasse: 2,
      teacher_id: teacherId,
      school: "",
      school_type: "Mittelschule",
      subjects: ["Mathematik"],
      current_topics: "",
      strengths_note: "",
      weaknesses_note: "",
      goals: "",
      notes: "",
    });
  const r1 = planung.createRaum({ building: "Haus A", name: "Raum 1", mode: "vor_ort" });
  const r2 = planung.createRaum({ building: "Haus A", name: "Raum 2", mode: "vor_ort" });
  const platz = (studentId: number, weekday: number, start: number, opts: { teacher?: number; room?: number | null; dauer?: number } = {}) => {
    const r = planung.legePlatzAn({
      week_start: MONTAG,
      weekday,
      start_min: start,
      geplante_dauer: opts.dauer ?? 100,
      teacher_id: opts.teacher ?? niko.id,
      student_id: studentId,
      room_id: opts.room === undefined ? r1 : opts.room,
      status: "veroeffentlicht",
    });
    assert.ok(r.ok, r.ok ? "" : r.fehler);
    return r.ok ? r.id : 0;
  };
  return { db, repo, planung, ta, zuErledigen, niko, thomas, schueler, platz, r1, r2 };
}

test("verschieben: der Schüler fragt, nichts bewegt sich, die Verwaltung bestätigt", async () => {
  const { planung, ta, niko, thomas, schueler, platz } = await setup();
  const anna = schueler("Anna Beispiel");
  const p = platz(anna, 2, 840); // Di 14:00–15:40
  const r = ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: p, datum: "2026-10-14", startMin: 900, notiz: "Training" }, JETZT);
  assert.equal(r.ok, true, r.ok ? "" : r.fehler);
  const id = r.ok ? r.id! : 0;
  assert.equal(planung.getGeplanteEinheit(p)!.weekday, 2, "vor dem Bestätigen bleibt der Platz");
  assert.equal(ta.anfragenFuerSchueler(anna, JETZT)[0].status, "offen");
  assert.equal(ta.anfragenFuerSchueler(anna, JETZT)[0].nach, "Mi 14.10. 15:00–16:40");

  // eine zweite Anfrage zum selben Termin geht nicht, und nur die Verwaltung bestätigt
  assert.equal(ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: p, datum: "2026-10-15", startMin: 900 }, JETZT).ok, false);
  assert.equal(ta.bestaetige(thomas, id, {}, JETZT).ok, false);

  const ok = ta.bestaetige(niko, id, {}, JETZT);
  assert.equal(ok.ok, true, ok.ok ? "" : ok.fehler);
  const neu = planung.getGeplanteEinheit(p)!;
  assert.deepEqual([neu.weekday, neu.start_min, neu.status], [3, 900, "veroeffentlicht"]);
  assert.equal(ta.anfragenFuerSchueler(anna, JETZT)[0].status, "bestaetigt");
  assert.equal(ta.bestaetige(niko, id, {}, JETZT).ok, false, "zweimal bestätigen geht nicht");
});

test("bestätigen prüft in dem Moment: belegt = nichts ändert sich, der Grund steht da; ablehnen braucht einen Grund", async () => {
  const { planung, ta, niko, schueler, platz } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const p = platz(anna, 2, 840);
  const r = ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: p, datum: "2026-10-14", startMin: 900 }, JETZT);
  assert.ok(r.ok);
  const id = r.ok ? r.id! : 0;
  // inzwischen setzt die Verwaltung Ben genau dorthin, im anderen Raum
  platz(ben, 3, 900, { room: null });
  const nein = ta.bestaetige(niko, id, {}, JETZT);
  assert.equal(nein.ok, false);
  assert.match(nein.ok ? "" : nein.fehler, /^Nicht bestätigt: Lehrer Niko ist am Mittwoch 15:00–16:40 schon verplant/);
  assert.equal(planung.getGeplanteEinheit(p)!.weekday, 2, "nichts bewegt");
  assert.equal(ta.anfragenFuerVerwaltung(JETZT)[0].status, "offen");

  assert.equal(ta.lehneAb({ lehrer: niko }, id, "  ", JETZT).ok, false, "ohne Grund nicht");
  assert.equal(ta.lehneAb({ lehrer: niko }, id, "Niko ist da schon verplant.", JETZT).ok, true);
  const s = ta.anfragenFuerSchueler(anna, JETZT)[0];
  assert.equal(s.status, "abgelehnt");
  assert.equal(s.grund, "Niko ist da schon verplant.");
});

test("vorab: eine sicher belegte Zeit wird gleich abgelehnt, für Schüler ohne Namen", async () => {
  const { ta, schueler, platz } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const p = platz(anna, 2, 840);
  platz(ben, 3, 900, { room: null });
  const r = ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: p, datum: "2026-10-14", startMin: 920 }, JETZT);
  assert.equal(r.ok, false);
  assert.equal(r.ok ? "" : r.fehler, "Zu dieser Zeit ist dein Lehrer schon verplant.");
  // vergangen, fremd, Vergangenheit als Ziel
  assert.equal(ta.stelleAnfrage({ schuelerId: ben }, { art: "verschieben", platzId: p, datum: "2026-10-15", startMin: 900 }, JETZT).ok, false);
  assert.equal(ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: p, datum: "2026-10-12", startMin: 420 }, JETZT).ok, false);
  const spaeter = new Date("2026-10-13T13:00:00Z"); // Di 15:00, der Termin läuft schon
  assert.equal(ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: p, datum: "2026-10-15", startMin: 900 }, spaeter).ok, false);
});

test("tauschen: wartet auf die andere Seite, der andere Schüler sieht nur Zeiten, dann tauschen beide samt Raum", async () => {
  const { planung, ta, niko, schueler, platz, r1, r2 } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const pa = platz(anna, 2, 840, { room: r1 });
  const pb = platz(ben, 4, 600, { room: r2, dauer: 50 });
  const r = ta.stelleAnfrage({ schuelerId: anna }, { art: "tauschen", platzId: pa, partnerPlatzId: pb, notiz: "Anna hat Schularbeit" }, JETZT);
  assert.ok(r.ok, r.ok ? "" : r.fehler);
  const id = r.ok ? r.id! : 0;
  assert.equal(ta.anfragenFuerSchueler(anna, JETZT)[0].status, "wartet");
  assert.match(ta.bestaetige(niko, id, {}, JETZT).ok ? "" : "noch nicht", /noch nicht/);

  const fuerBen = ta.anfragenFuerSchueler(ben, JETZT);
  assert.equal(fuerBen.length, 1);
  assert.equal(fuerBen[0].rolle, "partner");
  assert.equal(fuerBen[0].kannZustimmen, true);
  assert.equal(fuerBen[0].von, "Do 15.10. 10:00–10:50", "Ben sieht seinen eigenen Termin");
  assert.equal(fuerBen[0].nach, "Di 13.10. 14:00–14:50");
  assert.doesNotMatch(JSON.stringify(fuerBen), /Anna|Schularbeit/, "kein Name, keine Notiz");
  assert.doesNotMatch(JSON.stringify(ta.anfragbareTermine({ schuelerId: anna }, JETZT)), /Ben/, "Tauschpartner nur als Zeit");

  assert.equal(ta.stimmeZu({ schuelerId: anna }, id, JETZT).ok, false, "nur die andere Seite stimmt zu");
  assert.equal(ta.stimmeZu({ schuelerId: ben }, id, JETZT).ok, true);
  const ok = ta.bestaetige(niko, id, {}, JETZT);
  assert.ok(ok.ok, ok.ok ? "" : ok.fehler);
  const a = planung.getGeplanteEinheit(pa)!;
  const b = planung.getGeplanteEinheit(pb)!;
  assert.deepEqual([a.weekday, a.start_min, a.room_id, a.geplante_dauer], [4, 600, r2, 100]);
  assert.deepEqual([b.weekday, b.start_min, b.room_id, b.geplante_dauer], [2, 840, r1, 50]);
});

test("tauschen: der Schüler lehnt ohne eigenen Text ab; der Lehrer der anderen Seite stimmt mit dem Stellen schon zu", async () => {
  const { ta, niko, thomas, schueler, platz, zuErledigen } = await setup();
  const carla = schueler("Carla Probe", thomas.id);
  const dora = schueler("Dora Test", thomas.id);
  const pc = platz(carla, 2, 840, { teacher: thomas.id });
  const pd = platz(dora, 4, 600, { teacher: thomas.id, room: null });

  // die Verwaltung fragt für Thomas' Schüler: Thomas ist die andere Seite und hat es in „Zu erledigen“
  const r = ta.stelleAnfrage({ lehrer: niko }, { art: "tauschen", platzId: pc, partnerPlatzId: pd }, JETZT);
  assert.ok(r.ok, r.ok ? "" : r.fehler);
  const id = r.ok ? r.id! : 0;
  const todo = zuErledigen(thomas.id, "2026-10-12", JETZT).offen.filter((p) => p.art === "terminanfrage");
  assert.equal(todo.length, 1);
  assert.equal(zuErledigen(niko.id, "2026-10-12", JETZT).offen.filter((p) => p.art === "terminanfrage").length, 0, "wartet: noch nichts zu bestätigen");
  assert.equal(ta.lehneAb({ schuelerId: dora }, id, "Ich will nicht", JETZT).ok, true);
  assert.equal(ta.anfragenFuerSchueler(carla, JETZT)[0].grund, "Der andere Termin passt nicht.");

  // stellt Thomas den Tausch selbst, gilt seine Zustimmung gleich; dann ist es bei der Verwaltung
  const t = ta.stelleAnfrage({ lehrer: thomas }, { art: "tauschen", platzId: pc, partnerPlatzId: pd }, JETZT);
  assert.ok(t.ok);
  assert.equal(ta.anfragenFuerLehrer(thomas, JETZT)[0].status, "offen");
  assert.equal(zuErledigen(niko.id, "2026-10-12", JETZT).offen.filter((p) => p.art === "terminanfrage").length, 1);
  // ein Lehrer fragt nicht für fremde Plätze; zurückziehen geht nur bei der eigenen Anfrage
  const pn = platz(schueler("Emil Fiktiv"), 5, 600, { room: null });
  assert.equal(ta.stelleAnfrage({ lehrer: thomas }, { art: "verschieben", platzId: pn, datum: "2026-10-16", startMin: 800 }, JETZT).ok, false);
  assert.equal(ta.zieheZurueck({ schuelerId: carla }, t.ok ? t.id! : 0).ok, false);
  assert.equal(ta.zieheZurueck({ lehrer: thomas }, t.ok ? t.id! : 0).ok, true);
  assert.equal(ta.anfragenFuerLehrer(thomas, JETZT).filter((a) => a.status === "offen").length, 0);
});

test("im Wochenplan inzwischen geändert: bestätigen ändert nichts", async () => {
  const { planung, ta, niko, schueler, platz } = await setup();
  const anna = schueler("Anna Beispiel");
  const p = platz(anna, 2, 840);
  const r = ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: p, datum: "2026-10-14", startMin: 900 }, JETZT);
  assert.ok(r.ok);
  assert.equal(planung.aenderePlatz(p, { start_min: 600 }).ok, true);
  const nein = ta.bestaetige(niko, r.ok ? r.id! : 0, {}, JETZT);
  assert.match(nein.ok ? "" : nein.fehler, /inzwischen im Wochenplan geändert/);
  assert.equal(planung.getGeplanteEinheit(p)!.start_min, 600);
});

test("freie Zeiten: Verfügbarkeit von Lehrer und Schüler, belegte Zeiten fallen weg, ein freier Raum wird gesucht", async () => {
  const { planung, ta, niko, schueler, platz, r1, r2 } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const tage = (von: number, bis: number) => Object.fromEntries(["1", "2", "3", "4", "5"].map((t) => [t, [{ start: von, end: bis }]]));
  planung.setLehrerVerfuegbarkeit(niko.id, tage(480, 1080));
  const p = platz(anna, 2, 840, { room: r1 });
  // Anna kann am Mittwoch nur 14:00–16:00 (ihre Schulzeiten), sonst wie gewohnt nachmittags
  planung.setSchuelerPlanung(anna, { ...planung.getSchuelerPlanung(anna)!, availability: { "3": [{ start: 840, end: 960 }], "4": [{ start: 840, end: 1080 }] } });
  // Raum 1 ist am Donnerstag um 14:00 von Thomas belegt
  platz(ben, 4, 840, { teacher: (await import("../auth")).checkLogin("thomas", (await import("../password")).INITIAL_PASSWORD)!.id, room: r1 });
  const frei = ta.freieZeiten(planung.getGeplanteEinheit(p)!, [MONTAG], JETZT);
  assert.ok(frei.length > 0);
  for (const f of frei) {
    const [datum, start, raum] = f.wert.split("|");
    assert.ok(datum === "2026-10-14" || datum === "2026-10-15", `nur Tage mit Schülerzeit: ${f.label}`);
    if (datum === "2026-10-14") assert.ok(Number(start) >= 840 && Number(start) + 100 <= 960);
    if (datum === "2026-10-15" && Number(start) < 940) assert.equal(Number(raum), r2, "Raum 1 ist belegt, Raum 2 frei");
  }
  // gewählt wird der Vorschlag samt Raum; die Verwaltung nimmt diesen Raum
  const donnerstag = frei.find((f) => f.wert.startsWith("2026-10-15|840|"))!;
  assert.ok(donnerstag, JSON.stringify(frei));
  const r = ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: p, wahl: donnerstag.wert }, JETZT);
  assert.ok(r.ok, r.ok ? "" : r.fehler);
  assert.ok(ta.bestaetige(niko, r.ok ? r.id! : 0, {}, JETZT).ok);
  assert.deepEqual([planung.getGeplanteEinheit(p)!.weekday, planung.getGeplanteEinheit(p)!.room_id], [4, r2]);
});

test("von Hand geplante Einheiten: Überschneidung geprüft wie im Wochenplan, auch beim Bestätigen", async () => {
  const { repo, planung, ta, niko, schueler, platz } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  platz(anna, 2, 840, { room: null }); // Di 13.10. 14:00–15:40, Niko
  const basis = { duration_min: 60, teacher_id: niko.id };
  // Niko hat dann schon Anna
  const r = planung.pruefeEinzeltermin({ ...basis, starts_at: "2026-10-13T15:00", student_id: ben });
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.fehler, /^Lehrer Niko ist am Dienstag 14:00–15:40 schon verplant\. .*Gleichzeitig/);
  assert.equal(planung.pruefeEinzeltermin({ ...basis, starts_at: "2026-10-13T15:00", student_id: ben, gleichzeitig: true }).ok, true);
  // derselbe Schüler beim selben Lehrer zur selben Zeit ist derselbe Termin
  assert.equal(planung.pruefeEinzeltermin({ ...basis, starts_at: "2026-10-13T14:00", student_id: anna }).ok, true);
  assert.equal(planung.pruefeEinzeltermin({ ...basis, starts_at: "2026-10-13T15:40", student_id: ben }).ok, true, "direkt danach geht");

  // eine von Hand geplante Einheit: zwei für denselben Schüler zugleich gehen nicht
  const lessonId = repo.saveLesson({
    student_id: ben, teacher_id: niko.id, starts_at: "2026-10-14T15:00", duration_min: 60, subject: "Mathematik", topic: "", status: "geplant",
    activities: "", mistakes: "", understanding: null, tutor_notes: "", next_steps: "", skill_ids: [],
  });
  assert.equal(planung.pruefeEinzeltermin({ ...basis, teacher_id: null, starts_at: "2026-10-14T15:30", student_id: ben }).ok, false);
  assert.equal(planung.pruefeEinzeltermin({ ...basis, starts_at: "2026-10-14T15:30", student_id: ben, ausserLessonId: lessonId }).ok, true, "sich selbst nicht");

  // Anna will Mittwoch 15:00: dort hat Niko die von Hand geplante Einheit mit Ben
  const anfrage = ta.stelleAnfrage({ schuelerId: anna }, { art: "verschieben", platzId: planung.einheitenFuerWoche(MONTAG)[0].id, datum: "2026-10-14", startMin: 900 }, JETZT);
  assert.equal(anfrage.ok, false);
});
