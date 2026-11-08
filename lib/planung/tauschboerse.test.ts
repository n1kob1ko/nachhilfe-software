import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Tauschbörse: anbieten, passende Angebote nur für Schüler desselben Lehrers mit passendem Termin, sofort getauscht
 * (Prüfung des Wochenplans), Verwaltung informiert und kann zurücktauschen, Frist 24 Stunden, keine Namen für Schüler.
 * Erfundene Namen; die Uhr steht fest. 2026-10-12 ist ein Montag, JETZT ist Montag 08:00 in Wien (UTC+2).
 */
const MONTAG = "2026-10-12";
const JETZT = new Date("2026-10-12T06:00:00Z");

async function setup() {
  const { db, resetForTests } = await import("../db");
  resetForTests();
  const repo = await import("../repo");
  const planung = await import("./repo");
  const ta = await import("./terminanfragen");
  const tb = await import("./tauschboerse");
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
  return { db, repo, planung, ta, tb, zuErledigen, niko, thomas, schueler, platz, r1, r2 };
}

test("anbieten → nur der passende Schüler sieht es, ohne Namen → ein Tipp tauscht sofort samt Raum", async () => {
  const { planung, ta, tb, zuErledigen, niko, thomas, schueler, platz, r1, r2 } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const cleo = schueler("Cleo Probe");
  const dora = schueler("Dora Thomas", thomas.id);
  const pa = platz(anna, 2, 840, { room: r1 }); // Di 14:00
  const pb = platz(ben, 4, 600, { room: r2, dauer: 50 }); // Do 10:00
  const pc = platz(cleo, 5, 900, { room: r2 }); // Fr 15:00
  platz(dora, 3, 900, { teacher: thomas.id, room: null });

  // Anna sieht Bens und Cleos Termine zur Auswahl (gleicher Lehrer), Doras nicht
  const sichtAnna = tb.boerseFuerSchueler(anna, JETZT);
  assert.deepEqual(sichtAnna.anbietbar.find((x) => x.platzId === pa)!.kandidaten.map((k) => k.wert).sort(), [String(pb), String(pc)].sort());
  assert.equal(sichtAnna.anbietbar.find((x) => x.platzId === pa)!.kandidaten.find((k) => k.wert === String(pb))!.label, "Do 15.10. 10:00–11:40", "mit Annas Dauer");

  const r = tb.bieteAn(anna, { platzId: pa, passende: [String(pb)] }, JETZT);
  assert.equal(r.ok, true, r.ok ? "" : r.fehler);
  assert.equal(tb.bieteAn(anna, { platzId: pa, passende: "alle" }, JETZT).ok, false, "nur einmal in der Börse");
  assert.equal(tb.bieteAn(ben, { platzId: pa, passende: "alle" }, JETZT).ok, false, "nur eigene Termine");
  assert.deepEqual(tb.boerseFuerSchueler(anna, JETZT).eigene.map((e) => e.passende), [["Do 15.10. 10:00–11:40"]]);
  assert.equal(tb.boerseFuerSchueler(anna, JETZT).passend.length, 0, "das eigene Angebot passt nicht zu einem selbst");

  // Ben passt, Cleo nicht (nicht gewählt), Dora nicht (anderer Lehrer)
  const sichtBen = tb.boerseFuerSchueler(ben, JETZT);
  assert.equal(sichtBen.passend.length, 1);
  assert.deepEqual({ ...sichtBen.passend[0], angebotId: 0 }, { angebotId: 0, platzId: pb, meins: "Do 15.10. 10:00–10:50", neu: "Di 13.10. 14:00–14:50" });
  assert.doesNotMatch(JSON.stringify(sichtBen), /Anna|Cleo|Dora|Raum/);
  assert.equal(tb.boerseFuerSchueler(cleo, JETZT).passend.length, 0);
  assert.equal(tb.boerseFuerSchueler(dora, JETZT).passend.length, 0);
  assert.equal(tb.nimmAngebot(cleo, sichtBen.passend[0].angebotId, pc, JETZT).ok, false, "Cleos Termin war nicht gewählt");

  const ok = tb.nimmAngebot(ben, sichtBen.passend[0].angebotId, pb, JETZT);
  assert.equal(ok.ok, true, ok.ok ? "" : ok.fehler);
  assert.equal(ok.ok ? ok.hinweis : "", "Getauscht! Dein Termin ist jetzt Di 13.10. 14:00–14:50.");
  const a = planung.getGeplanteEinheit(pa)!;
  const b = planung.getGeplanteEinheit(pb)!;
  assert.deepEqual([a.weekday, a.start_min, a.room_id, a.geplante_dauer], [4, 600, r2, 100]);
  assert.deepEqual([b.weekday, b.start_min, b.room_id, b.geplante_dauer], [2, 840, r1, 50]);
  assert.equal(tb.nimmAngebot(ben, sichtBen.passend[0].angebotId, pb, JETZT).ok, false, "nur einmal");
  assert.equal(tb.boerseFuerSchueler(anna, JETZT).eigene.length, 0);

  // festgehalten als bestätigte Terminanfrage aus der Börse; beide sehen sie, ohne Namen
  const fuerBen = ta.anfragenFuerSchueler(ben, JETZT);
  assert.equal(fuerBen.length, 1);
  assert.deepEqual([fuerBen[0].status, fuerBen[0].boerse, fuerBen[0].schueler, fuerBen[0].kannZuruecktauschen], ["bestaetigt", true, null, false]);
  assert.equal(ta.anfragenFuerSchueler(anna, JETZT)[0].status, "bestaetigt");

  // die Verwaltung sieht den Tausch unter Planung, aber nicht als Aufgabe (Audit 2026-11-07: kein „Passt“ mehr)
  assert.equal(zuErledigen(niko.id, MONTAG, JETZT).offen.filter((p) => p.art === "terminanfrage").length, 0);
  assert.equal(zuErledigen(thomas.id, MONTAG, JETZT).offen.filter((p) => p.art === "terminanfrage").length, 0);
  const v = ta.anfragenFuerVerwaltung(JETZT)[0];
  assert.deepEqual([v.boerse, v.status, v.kannZuruecktauschen, v.kannBestaetigen], [true, "bestaetigt", true, false]);
});

test("zurücktauschen: nur die Verwaltung, danach ist alles wie vorher", async () => {
  const { planung, ta, tb, zuErledigen, niko, thomas, schueler, platz, r1, r2 } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const pa = platz(anna, 2, 840, { room: r1 });
  const pb = platz(ben, 4, 600, { room: r2 });
  assert.ok(tb.bieteAn(anna, { platzId: pa, passende: "alle" }, JETZT).ok);
  const angebot = tb.boerseFuerSchueler(ben, JETZT).passend[0];
  assert.ok(tb.nimmAngebot(ben, angebot.angebotId, pb, JETZT).ok);
  const id = ta.anfragenFuerVerwaltung(JETZT)[0].id;

  assert.equal(ta.tauscheZurueck(thomas, id, JETZT).ok, false);
  const r = ta.tauscheZurueck(niko, id, JETZT);
  assert.equal(r.ok, true, r.ok ? "" : r.fehler);
  const a = planung.getGeplanteEinheit(pa)!;
  const b = planung.getGeplanteEinheit(pb)!;
  assert.deepEqual([a.weekday, a.start_min, a.room_id], [2, 840, r1]);
  assert.deepEqual([b.weekday, b.start_min, b.room_id], [4, 600, r2]);
  assert.equal(ta.anfragenFuerSchueler(ben, JETZT)[0].status, "zurueckgetauscht");
  assert.equal(ta.tauscheZurueck(niko, id, JETZT).ok, false, "nur einmal");
  assert.equal(zuErledigen(niko.id, MONTAG, JETZT).offen.filter((p) => p.art === "terminanfrage").length, 0, "zurückgetauscht = erledigt");

  // ein zweiter Tausch: wieder nur Information, zurücktauschen geht
  assert.ok(tb.bieteAn(anna, { platzId: pa, passende: "alle" }, JETZT).ok);
  assert.ok(tb.nimmAngebot(ben, tb.boerseFuerSchueler(ben, JETZT).passend[0].angebotId, pb, JETZT).ok);
  const id2 = ta.anfragenFuerVerwaltung(JETZT).find((x) => x.status === "bestaetigt")!.id;
  assert.equal(zuErledigen(niko.id, MONTAG, JETZT).offen.filter((p) => p.art === "terminanfrage").length, 0);
  const v = ta.anfragenFuerVerwaltung(JETZT).find((x) => x.id === id2)!;
  assert.equal(v.kannZuruecktauschen, true);

  // im Wochenplan geändert → zurücktauschen geht nicht mehr
  assert.ok(planung.legePlaetzeNeu([{ id: pa, week_start: MONTAG, weekday: 5, start_min: 600 }]).ok);
  assert.equal(ta.tauscheZurueck(niko, id2, JETZT).ok, false);
});

test("Frist 24 Stunden, geänderte Termine, offene Anfragen, zurückziehen", async () => {
  const { planung, ta, tb, schueler, platz } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const heute = platz(anna, 1, 840); // Mo 14:00, nur 6 Stunden entfernt
  const pa = platz(anna, 3, 840); // Mi 14:00
  const pb = platz(ben, 4, 600); // Do 10:00
  assert.equal(tb.bieteAn(anna, { platzId: heute, passende: "alle" }, JETZT).ok, false, "zu knapp");
  assert.ok(!tb.boerseFuerSchueler(anna, JETZT).anbietbar.some((x) => x.platzId === heute));

  assert.ok(tb.bieteAn(anna, { platzId: pa, passende: "alle" }, JETZT).ok);
  assert.equal(tb.boerseFuerSchueler(ben, JETZT).passend.length, 1);
  // Dienstag 15:00: Annas Termin ist keine 24 Stunden mehr entfernt → das Angebot gilt nicht mehr
  const spaeter = new Date("2026-10-13T13:00:00Z");
  assert.equal(tb.boerseFuerSchueler(ben, spaeter).passend.length, 0);

  // eine offene Terminanfrage zu Bens Termin: er kann gerade nicht tauschen
  const ang = tb.boerseFuerSchueler(ben, JETZT).passend[0];
  const anfrage = ta.stelleAnfrage({ schuelerId: ben }, { art: "verschieben", platzId: pb, datum: "2026-10-16", startMin: 600 }, JETZT);
  assert.ok(anfrage.ok);
  assert.equal(tb.boerseFuerSchueler(ben, JETZT).passend.length, 0);
  assert.equal(tb.nimmAngebot(ben, ang.angebotId, pb, JETZT).ok, false);
  assert.ok(ta.zieheZurueck({ schuelerId: ben }, anfrage.ok ? anfrage.id! : 0).ok);

  // die Verwaltung verschiebt Annas Termin → das Angebot gilt nicht mehr
  assert.ok(planung.legePlaetzeNeu([{ id: pa, week_start: MONTAG, weekday: 3, start_min: 900 }]).ok);
  assert.equal(tb.boerseFuerSchueler(ben, JETZT).passend.length, 0);
  assert.equal(tb.nimmAngebot(ben, ang.angebotId, pb, JETZT).ok, false);
  assert.equal(tb.boerseFuerSchueler(anna, JETZT).eigene.length, 0);

  // neu anbieten und zurückziehen
  assert.ok(tb.bieteAn(anna, { platzId: pa, passende: [String(pb)] }, JETZT).ok);
  const eigenes = tb.boerseFuerSchueler(anna, JETZT).eigene[0];
  assert.equal(tb.zieheAngebotZurueck(ben, eigenes.id).ok, false, "nur das eigene");
  assert.ok(tb.zieheAngebotZurueck(anna, eigenes.id).ok);
  assert.equal(tb.boerseFuerSchueler(ben, JETZT).passend.length, 0);
  assert.equal(tb.bieteAn(anna, { platzId: pa, passende: [] }, JETZT).ok, false, "ohne Zeit nicht");
});

test("die Prüfung des Wochenplans: passt der Tausch nicht, wird er nicht angeboten und nicht gemacht", async () => {
  const { planung, tb, thomas, schueler, platz } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const pa = platz(anna, 2, 840);
  const pb = platz(ben, 4, 600);
  // Anna hat am Donnerstag um 10:00 schon einen Termin bei Thomas
  platz(anna, 4, 600, { teacher: thomas.id, room: null });
  assert.ok(tb.bieteAn(anna, { platzId: pa, passende: "alle" }, JETZT).ok);
  assert.equal(tb.boerseFuerSchueler(ben, JETZT).passend.length, 0, "Anna wäre doppelt gebucht");
  const id = (await import("../db")).db().prepare("SELECT id FROM tauschangebote").get() as { id: number };
  const r = tb.nimmAngebot(ben, id.id, pb, JETZT);
  assert.equal(r.ok, false);
  assert.equal(r.ok ? "" : r.fehler, "Zu dieser Zeit ist schon ein Termin eingetragen.");
  assert.equal(planung.getGeplanteEinheit(pa)!.weekday, 2, "nichts bewegt");
});

test("Audit: eine Zeit, in die der Tausch nicht passt, wird gar nicht erst angeboten; der Schüler sieht den Stand, die Verwaltung das Angebot", async () => {
  const { tb, niko, thomas, schueler, platz } = await setup();
  const anna = schueler("Anna Beispiel");
  const ben = schueler("Ben Muster");
  const cleo = schueler("Cleo Probe");
  const pa = platz(anna, 2, 840); // Di 14:00–15:40
  platz(ben, 2, 940, { dauer: 50 }); // Di 15:40–16:30
  platz(anna, 2, 1000, { teacher: thomas.id, room: null }); // Anna Di 16:40 bei Thomas: ihre 100 Minuten passen nicht in Bens 50-Minuten-Lücke
  const sichtAnna = tb.boerseFuerSchueler(anna, JETZT);
  assert.equal(sichtAnna.anbietbar.find((x) => x.platzId === pa), undefined, "kein Tauschpartner → kein „Tauschen“");

  // „jede andere Zeit“ geht trotzdem: das Angebot bleibt, der Stand sagt, dass derzeit niemand tauschen kann
  assert.ok(tb.bieteAn(anna, { platzId: pa, passende: "alle" }, JETZT).ok);
  assert.deepEqual(tb.boerseFuerSchueler(anna, JETZT).eigene.map((e) => [e.passende, e.moeglich]), [[null, 0]]);
  const offene = tb.offeneAngeboteFuerVerwaltung(JETZT);
  assert.equal(offene.length, 1);
  assert.equal(offene[0].studentName, "Anna Beispiel");
  assert.equal(offene[0].lehrerName, niko.name);
  assert.equal(offene[0].label, "Di 13.10. 14:00–15:40");
  assert.equal(offene[0].passende, null);
  assert.equal(offene[0].moeglich, 0);
  assert.equal(offene[0].seit, new Date().toISOString().slice(0, 10), "Datum des Angebots (echte Uhr)");

  // sobald ein passender Termin dazukommt, zählt er mit
  platz(cleo, 5, 900); // Fr 15:00
  assert.equal(tb.boerseFuerSchueler(anna, JETZT).eigene[0].moeglich, 1);
  assert.equal(tb.offeneAngeboteFuerVerwaltung(JETZT)[0].moeglich, 1);
  // und Cleo sieht das Angebot nur mit dem Freitag, nicht mit dem Dienstag
  assert.deepEqual(tb.boerseFuerSchueler(cleo, JETZT).passend.map((p) => p.meins), ["Fr 16.10. 15:00–16:40"]);
});
