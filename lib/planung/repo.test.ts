import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Der Wochenplan in der Datenbank (Phase 4): Entwurf, Veröffentlichen, Verwerfen, Vorwoche
 * übernehmen, neu generieren, einzelne Plätze setzen, sperren — und **die** Überlappungsprüfung,
 * die es in der Tabelle absichtlich nicht gibt (D3: verschiedene Dauern lassen sich nicht als
 * Eindeutigkeit ausdrücken).
 *
 * 2026-10-12 ist ein Montag (Europe/Vienna), 2026-10-05 der Montag der Vorwoche.
 */
import type { TagSchluessel, Wochentag } from "./zeit";
import type { Verfuegbarkeit } from "./verfuegbarkeit";

const MONTAG = "2026-10-12";
const DIENSTAG = "2026-10-13";
const MITTWOCH = "2026-10-14";
const NAECHSTE_WOCHE = "2026-10-19";
const VORWOCHE = "2026-10-05";
const UEBERNAECHSTE = "2026-10-26";

async function setup() {
  const { db, resetForTests } = await import("../db");
  // jede Prüfung startet auf einer leeren Datenbank, damit sich die Tests nicht gegenseitig sehen
  resetForTests();
  const repo = await import("../repo");
  const planung = await import("./repo");
  const auth = await import("../auth");
  const { INITIAL_PASSWORD } = await import("../password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;

  const schueler = (name: string, teacherId: number | null = null) =>
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
  const raum = (name: string, mode: "vor_ort" | "online" = "vor_ort") => planung.createRaum({ building: "Hauptgebäude", name, mode });
  const verfuegbar = (tage: TagSchluessel[], von = 480, bis = 720): Verfuegbarkeit => {
    const v: Verfuegbarkeit = {};
    for (const tag of tage) v[tag] = [{ start: von, end: bis }];
    return v;
  };
  const planungFuer = (studentId: number, tage: TagSchluessel[], einheiten = 2, dauer = 100) =>
    planung.setSchuelerPlanung(studentId, { availability: verfuegbar(tage), einheiten_pro_woche: einheiten, geplante_dauer: dauer, modus_wunsch: "egal", erlaubte_lehrer: [] });

  return { db, repo, planung, niko, thomas, schueler, raum, verfuegbar, planungFuer };
}

test("ein Platz wird angelegt: Woche auf Montag gezogen, Start auf 10 Minuten, Ende = Start + geplante Dauer", async () => {
  const { planung, niko, schueler, raum } = await setup();
  const sid = schueler("Max Huber", niko.id);
  const rid = raum("Gruppe 1");

  const res = planung.legePlatzAn({ week_start: MITTWOCH, weekday: 3, start_min: 547, geplante_dauer: 45, teacher_id: niko.id, student_id: sid, room_id: rid });
  assert.equal(res.ok, true);
  const zeile = planung.einheitenFuerWoche(MITTWOCH)[0];
  assert.equal(zeile.week_start, MONTAG, "der Wochenstart wird auf den Montag gezogen");
  assert.equal(zeile.weekday, 3);
  assert.equal(zeile.start_min, 550, "547 rastet auf 550 ein (D19)");
  assert.equal(zeile.geplante_dauer, 45);
  assert.equal(zeile.status, "entwurf");
  assert.equal(zeile.locked, 0);
  assert.equal(zeile.unit_id, null);
  assert.equal(planung.wochenStatus(MITTWOCH), "entwurf");
  assert.deepEqual(planung.alsGeplanteEinheit(zeile), {
    id: zeile.id,
    weekday: 3,
    start: 550,
    end: 595,
    teacherId: niko.id,
    studentId: sid,
    roomId: rid,
    locked: false,
  });
  assert.deepEqual(planung.slotDatum(MITTWOCH, 3), MITTWOCH, "Mittwoch der Woche");
  assert.deepEqual(planung.slotDatum(MONTAG, 7), "2026-10-18");
  assert.equal(planung.getGeplanteEinheit(zeile.id)!.start_min, 550);
  assert.equal(planung.getGeplanteEinheit(999999), null);
});

test("ungültige Eingaben werden abgelehnt, nicht geglättet", async () => {
  const { planung, niko, thomas, schueler, raum } = await setup();
  const sid = schueler("Anna", niko.id);
  const rid = raum("Gruppe 1");
  const basis = { week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: sid, room_id: rid };
  const fehler = (e: Parameters<typeof planung.legePlatzAn>[0]) => {
    const res = planung.legePlatzAn(e);
    assert.equal(res.ok, false, `${JSON.stringify(e)} muss abgelehnt werden`);
    return res.ok === false ? res.fehler : "";
  };
  assert.match(fehler({ ...basis, week_start: "14.10.2026" }), /Woche/);
  assert.match(fehler({ ...basis, weekday: 0 }), /Wochentag/);
  assert.match(fehler({ ...basis, weekday: 8 }), /Wochentag/);
  assert.match(fehler({ ...basis, geplante_dauer: 0 }), /1 und 300/);
  assert.match(fehler({ ...basis, geplante_dauer: 301 }), /1 und 300/);
  assert.match(fehler({ ...basis, teacher_id: 9999 }), /Lehrer nicht gefunden/);
  assert.match(fehler({ ...basis, student_id: 9999 }), /Schüler nicht gefunden/);
  assert.match(fehler({ ...basis, room_id: 9999 }), /Raum nicht gefunden/);
  assert.match(fehler({ ...basis, start_min: 1400, geplante_dauer: 100 }), /Mitternacht/);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 0, "nichts wurde geschrieben");
});

test("Überlappung Lehrer: abgelehnt mit Grund, danach ist es erlaubt", async () => {
  const { planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const berta = schueler("Berta", niko.id);
  const r1 = raum("Gruppe 1");
  const r2 = raum("Gruppe 2");
  const basis = { week_start: MONTAG, weekday: 1, geplante_dauer: 100, teacher_id: niko.id };

  assert.equal(planung.legePlatzAn({ ...basis, start_min: 480, student_id: anna, room_id: r1 }).ok, true);
  // der Lehrer ist 08:00–09:40 belegt, ein zweiter Platz 09:00–10:40 überschneidet sich
  const zweiter = planung.legePlatzAn({ ...basis, start_min: 540, student_id: berta, room_id: r2 });
  assert.equal(zweiter.ok, false);
  assert.equal(zweiter.ok === false ? zweiter.fehler : "", "Lehrer Niko ist am Montag 08:00–09:40 schon verplant.");
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 1, "der abgelehnte Platz wurde nicht geschrieben");
  // direkt anschließend (09:40) ist in Ordnung — Überlappung heißt echt größer, nicht berühren
  assert.equal(planung.legePlatzAn({ ...basis, start_min: 580, student_id: berta, room_id: r2 }).ok, true);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 2);
  // die Prüfung selbst nennt die Art des Konflikts
  const pruefung = planung.pruefeUeberlappung({ ...basis, start_min: 480, student_id: anna, room_id: r1 });
  assert.equal(pruefung.ok, false);
  assert.equal(pruefung.ok === false ? pruefung.art : "lehrer", "lehrer");
});

test("Überlappung Schüler und Raum: abgelehnt mit Grund", async () => {
  const { planung, niko, thomas, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const bruno = schueler("Bruno", thomas.id);
  const r1 = raum("Gruppe 1");
  const r2 = raum("Gruppe 2");

  // derselbe Schüler bei zwei Lehrern zur selben Zeit
  assert.equal(planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 }).ok, true);
  const beimZweitenLehrer = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 500, geplante_dauer: 60, teacher_id: thomas.id, student_id: anna, room_id: r2 });
  assert.equal(beimZweitenLehrer.ok, false);
  assert.equal(beimZweitenLehrer.ok === false ? beimZweitenLehrer.fehler : "", "Anna hat am Montag 08:00–09:40 schon eine geplante Einheit.");
  assert.equal(planung.pruefeUeberlappung({ week_start: MONTAG, weekday: 1, start_min: 500, geplante_dauer: 60, teacher_id: thomas.id, student_id: anna, room_id: r2 }).ok, false);

  // derselbe Raum bei zwei Lehrern und zwei Schülern
  const imGleichenRaum = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: thomas.id, student_id: bruno, room_id: r1 });
  assert.equal(imGleichenRaum.ok, false);
  assert.equal(imGleichenRaum.ok === false ? imGleichenRaum.fehler : "", "Raum Gruppe 1 ist am Montag 08:00–09:40 schon belegt.");
  // ein anderer Raum geht, ein anderer Tag auch
  assert.equal(planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: thomas.id, student_id: bruno, room_id: r2 }).ok, true);
  assert.equal(planung.legePlatzAn({ week_start: MONTAG, weekday: 2, start_min: 480, geplante_dauer: 100, teacher_id: thomas.id, student_id: bruno, room_id: r1 }).ok, true);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 3);
});

test("Verschieben prüft dieselbe Überlappung, aber nicht gegen sich selbst", async () => {
  const { planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const berta = schueler("Berta", niko.id);
  const r1 = raum("Gruppe 1");
  const r2 = raum("Gruppe 2");
  const a = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 });
  const b = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 600, geplante_dauer: 60, teacher_id: niko.id, student_id: berta, room_id: r2 });
  assert.equal(a.ok && b.ok, true);
  const aId = a.ok ? a.id : 0;
  const bId = b.ok ? b.id : 0;

  // auf den anderen Platz schieben geht nicht
  const kollision = planung.aenderePlatz(aId, { start_min: 600 });
  assert.equal(kollision.ok, false);
  assert.match(kollision.ok === false ? kollision.fehler : "", /schon verplant/);
  assert.equal(planung.getGeplanteEinheit(aId)!.start_min, 480, "nichts wurde verschoben");
  // an die eigene Stelle schreiben ist keine Überlappung
  assert.equal(planung.aenderePlatz(aId, { start_min: 480 }).ok, true);
  // verschieben, umbesetzen, Dauer ändern
  assert.equal(planung.aenderePlatz(bId, { weekday: 2, start_min: 545, geplante_dauer: 45, room_id: r1 }).ok, true);
  const verschoben = planung.getGeplanteEinheit(bId)!;
  assert.equal(verschoben.weekday, 2);
  assert.equal(verschoben.start_min, 550, "auch beim Verschieben rastet der Start ein");
  assert.equal(verschoben.geplante_dauer, 45);
  assert.equal(verschoben.room_id, r1);
  assert.equal(planung.aenderePlatz(999999, { start_min: 480 }).ok, false);
});

test("Veröffentlichen: Entwurf wird veröffentlicht, Verwerfen rührt Veröffentlichtes nicht an (D25: keine Benachrichtigung)", async () => {
  const { db, planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const r1 = raum("Gruppe 1");
  assert.equal(planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 }).ok, true);
  assert.equal(planung.legePlatzAn({ week_start: MONTAG, weekday: 2, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 }).ok, true);

  assert.deepEqual(planung.veroeffentlicheWoche(MONTAG), { ok: true, anzahl: 2 });
  assert.equal(planung.wochenStatus(MONTAG), "veroeffentlicht");
  assert.equal(planung.einheitenFuerWoche(MONTAG, { status: "entwurf" }).length, 0);
  assert.equal(planung.einheitenFuerWoche(MONTAG, { status: "veroeffentlicht" }).length, 2);
  // zweimal veröffentlichen gibt es nicht
  const nochmal = planung.veroeffentlicheWoche(MONTAG);
  assert.equal(nochmal.ok, false);
  assert.match(nochmal.ok === false ? nochmal.fehler : "", /schon ein Plan veröffentlicht/);
  // selbst wenn jemand einen Entwurf dazu schreibt: eine veröffentlichte Woche bleibt veröffentlicht
  db()
    .prepare(
      `INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, created_at, updated_at)
       VALUES (?, 4, 480, 60, ?, ?, ?, 'entwurf', 0, datetime('now'), datetime('now'))`,
    )
    .run(MONTAG, niko.id, anna, r1);
  assert.match((() => { const r = planung.veroeffentlicheWoche(MONTAG); return r.ok === false ? r.fehler : ""; })(), /schon ein Plan veröffentlicht/);
  // „Entwurf verwerfen“ lässt die veröffentlichten Plätze stehen
  assert.deepEqual(planung.verwerfeEntwurf(MONTAG), { anzahl: 1 });
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 2);
  // eine leere Woche hat nichts zu veröffentlichen
  const leer = planung.veroeffentlicheWoche(UEBERNAECHSTE);
  assert.equal(leer.ok, false);
  assert.match(leer.ok === false ? leer.fehler : "", /keinen Entwurf/);
  // ein Platz, der in einer veröffentlichten Woche von Hand dazukommt, ist sofort veröffentlicht
  const dazu = planung.legePlatzAn({ week_start: MONTAG, weekday: 3, start_min: 480, geplante_dauer: 60, teacher_id: niko.id, student_id: anna, room_id: r1 });
  assert.equal(dazu.ok, true);
  assert.equal(planung.getGeplanteEinheit(dazu.ok ? dazu.id : 0)!.status, "veroeffentlicht");
  // dort wird nicht mehr generiert und kein Entwurf gespeichert
  const generiert = planung.neuGenerieren(MONTAG);
  assert.equal(generiert.ok, false);
  assert.match(generiert.ok === false ? generiert.fehler : "", /veröffentlicht/);
  const entwurf = planung.speichereEntwurf(MONTAG, []);
  assert.equal(entwurf.ok, false);
  // alles zurücksetzen
  assert.deepEqual(planung.loescheWoche(MONTAG), { anzahl: 3 });
  assert.equal(planung.wochenStatus(MONTAG), "leer");
});

test("Vorwoche als Entwurf übernehmen (D24): ohne Sperre und ohne Verknüpfung", async () => {
  const { planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const r1 = raum("Gruppe 1");
  assert.equal(planung.legePlatzAn({ week_start: VORWOCHE, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 }).ok, true);
  assert.equal(planung.legePlatzAn({ week_start: VORWOCHE, weekday: 3, start_min: 545, geplante_dauer: 45, teacher_id: niko.id, student_id: anna, room_id: r1 }).ok, true);
  planung.setzeGesperrt(planung.einheitenFuerWoche(VORWOCHE)[0].id, true);
  assert.equal(planung.veroeffentlicheWoche(VORWOCHE).ok, true);

  const uebernommen = planung.uebernimmVorwoche(DIENSTAG); // Mittwoch → dieselbe Woche
  assert.equal(uebernommen.ok, true);
  assert.equal(uebernommen.ok && uebernommen.anzahl, 2);
  const kopien = planung.einheitenFuerWoche(MONTAG);
  assert.equal(kopien.length, 2);
  assert.deepEqual(kopien.map((z) => [z.weekday, z.start_min, z.geplante_dauer]), [[1, 480, 100], [3, 550, 45]]);
  assert.ok(kopien.every((z) => z.status === "entwurf"), "die Kopie ist ein Entwurf");
  assert.ok(kopien.every((z) => z.locked === 0), "übernommene Plätze sind nicht gesperrt — sie sind ein Vorschlag");
  assert.ok(kopien.every((z) => z.unit_id === null), "keine Verknüpfung mit einer Einheit");
  assert.equal(planung.wochenStatus(MONTAG), "entwurf");
  // zweimal übernehmen geht nicht, und ohne Plan in der Vorwoche auch nicht
  const zweimal = planung.uebernimmVorwoche(MONTAG);
  assert.equal(zweimal.ok, false);
  assert.match(zweimal.ok === false ? zweimal.fehler : "", /schon Plätze/);
  const ohnePlan = planung.uebernimmVorwoche(UEBERNAECHSTE);
  assert.equal(ohnePlan.ok, false);
  assert.match(ohnePlan.ok === false ? ohnePlan.fehler : "", /keinen Plan/);
  assert.equal(planung.uebernimmVorwoche("14.10.2026").ok, false);
});

test("Speichern des Entwurfs prüft alle Plätze vor dem ersten Schreiben", async () => {
  const { planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const berta = schueler("Berta", niko.id);
  const r1 = raum("Gruppe 1");
  const r2 = raum("Gruppe 2");
  assert.equal(planung.legePlatzAn({ week_start: MONTAG, weekday: 5, start_min: 900, geplante_dauer: 60, teacher_id: niko.id, student_id: anna, room_id: r1 }).ok, true);

  const platz = (studentId: number, weekday: number, start: number, roomId: number): Parameters<typeof planung.speichereEntwurf>[1][number] => ({
    id: null,
    weekday: weekday as Wochentag,
    start,
    end: start + 100,
    teacherId: niko.id,
    studentId,
    roomId,
    locked: false,
  });
  // der zweite Platz überschneidet sich mit dem ersten im selben Stapel (gleicher Lehrer)
  const schief = planung.speichereEntwurf(MONTAG, [platz(anna, 1, 480, r1), platz(berta, 1, 540, r2)]);
  assert.equal(schief.ok, false);
  assert.match(schief.ok === false ? schief.fehler : "", /schon verplant/);
  assert.deepEqual(planung.einheitenFuerWoche(MONTAG).map((z) => z.start_min), [900], "der alte Entwurf steht unverändert");

  const gut = planung.speichereEntwurf(MONTAG, [platz(anna, 1, 480, r1), platz(berta, 1, 580, r2)]);
  assert.equal(gut.ok, true);
  assert.equal(gut.ok && gut.anzahl, 2);
  assert.deepEqual(planung.einheitenFuerWoche(MONTAG).map((z) => [z.weekday, z.start_min]), [[1, 480], [1, 580]]);
  assert.equal(planung.speichereEntwurf("14.10.2026", []).ok, false);
});

test("Neu generieren: gesperrte Plätze bleiben stehen, ungesperrte Handarbeit fällt weg (D24)", async () => {
  const { planung, niko, schueler, raum, verfuegbar } = await setup();
  planung.setLehrerVerfuegbarkeit(niko.id, verfuegbar(["1", "2"], 480, 840));
  const sid = schueler("Max", niko.id);
  planung.setSchuelerPlanung(sid, { availability: verfuegbar(["1", "2"], 480, 840), einheiten_pro_woche: 2, geplante_dauer: 100, modus_wunsch: "egal", erlaubte_lehrer: [niko.id] });
  const rid = raum("Gruppe 1");

  const hand = planung.legePlatzAn({ week_start: MONTAG, weekday: 2, start_min: 660, geplante_dauer: 100, teacher_id: niko.id, student_id: sid, room_id: rid });
  assert.equal(hand.ok, true);
  const handId = hand.ok ? hand.id : 0;
  assert.equal(planung.setzeGesperrt(handId, true).ok, true);
  assert.equal(planung.getGeplanteEinheit(handId)!.locked, 1);
  const lose = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 700, geplante_dauer: 60, teacher_id: niko.id, student_id: sid, room_id: rid });
  assert.equal(lose.ok, true);
  const loseId = lose.ok ? lose.id : 0;

  const lauf = planung.neuGenerieren(MONTAG, { seed: 1 });
  assert.equal(lauf.ok, true, lauf.ok === false ? lauf.fehler : "");
  if (lauf.ok) {
    assert.equal(lauf.zeitbudgetErreicht, false);
    assert.deepEqual(lauf.offen, [], "der Bedarf von 2 × 100 Minuten ist gedeckt");
    assert.equal(lauf.anzahl, 2, "der gesperrte Platz und ein neuer");
  }
  const danach = planung.einheitenFuerWoche(MONTAG);
  const gesperrtNachher = danach.find((z) => z.id === handId)!;
  assert.equal(gesperrtNachher.weekday, 2);
  assert.equal(gesperrtNachher.start_min, 660);
  assert.equal(gesperrtNachher.geplante_dauer, 100);
  assert.equal(gesperrtNachher.locked, 1, "der gesperrte Platz ist unverändert");
  assert.equal(danach.some((z) => z.id === loseId), false, "der ungesperrte Handplatz wurde ersetzt");
  assert.equal(danach.length, 2);
  const neuer = danach.find((z) => z.id !== handId)!;
  assert.equal(neuer.weekday, 1, "der freie Platz liegt am Montag, Dienstag ist durch den gesperrten Platz belegt");
  assert.equal(neuer.geplante_dauer, 100);
  assert.equal(neuer.room_id, rid);

  // entsperren: jetzt darf der Generator den Platz umbauen
  assert.equal(planung.setzeGesperrt(handId, false).ok, true);
  assert.equal(planung.getGeplanteEinheit(handId)!.locked, 0);
  assert.equal(planung.neuGenerieren(MONTAG).ok, true);
  assert.equal(planung.einheitenFuerWoche(MONTAG).some((z) => z.id === handId), false, "ohne Sperre ist der Platz nicht mehr geschützt");
  // Rechte/Existenz: unbekannte Id
  assert.equal(planung.setzeGesperrt(999999, true).ok, false);
});

test("die Eingaben einer Woche: Verfügbarkeit mit Abweichung, Planung, Räume, gesperrte Plätze, Regeln", async () => {
  const { planung, niko, schueler, raum, verfuegbar, planungFuer } = await setup();
  const regeln = await import("./regeln");
  planung.setLehrerVerfuegbarkeit(niko.id, verfuegbar(["1"], 480, 720));
  planung.setAbweichung("teacher", niko.id, MONTAG, verfuegbar(["5"], 900, 1080));
  const mitBedarf = schueler("Mit Bedarf", niko.id);
  const ohneBedarf = schueler("Ohne Bedarf", niko.id);
  planungFuer(mitBedarf, ["1", "2"], 2, 90);
  planungFuer(ohneBedarf, ["1"], 0);
  const rid = raum("Gruppe 1");
  const zweiterRaum = raum("Gruppe 2");
  planung.setRaumAktiv(zweiterRaum, false);
  const gesperrt = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: mitBedarf, room_id: rid });
  assert.equal(gesperrt.ok, true);
  planung.setzeGesperrt(gesperrt.ok ? gesperrt.id : 0, true);
  regeln.schreibeRegeln({ ...regeln.standardRegeln(), snapMinutes: 20, enforceNoTeacherBreaks: false });

  const eingaben = planung.wochenEingaben(MONTAG);
  const lehrer = eingaben.lehrer.find((l) => l.id === niko.id)!;
  assert.deepEqual(lehrer.availability, verfuegbar(["5"], 900, 1080), "für diese Woche gilt die Abweichung");
  assert.deepEqual(planung.wochenEingaben(NAECHSTE_WOCHE).lehrer.find((l) => l.id === niko.id)!.availability, verfuegbar(["1"], 480, 720), "in der nächsten Woche wieder die Regelverfügbarkeit");
  assert.deepEqual(eingaben.schueler.map((s) => s.id), [mitBedarf], "wer nichts braucht, kommt nicht vor");
  assert.equal(eingaben.schueler[0].geplanteDauer, 90);
  assert.equal(eingaben.schueler[0].einheitenProWoche, 2);
  assert.deepEqual(eingaben.schueler[0].allowedTeacherIds, []);
  assert.equal(eingaben.schueler[0].preferredTeacherId, niko.id);
  assert.deepEqual(eingaben.raeume.map((r) => r.id), [rid], "inaktive Räume sind nicht im Angebot");
  assert.equal(eingaben.gesperrte.length, 1);
  assert.deepEqual(eingaben.gesperrte[0], { id: gesperrt.ok ? gesperrt.id : 0, weekday: 1, start: 480, end: 580, teacherId: niko.id, studentId: mitBedarf, roomId: rid, locked: true });
  assert.equal(eingaben.regeln.snapMinutes, 20, "die Regeln kommen aus app_settings");
  assert.equal(eingaben.regeln.enforceNoTeacherBreaks, false);
});

test("„nicht stattgefunden“: veröffentlicht, vergangen, ohne Einheit (D17)", async () => {
  const { db, planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const r1 = raum("Gruppe 1");
  const montag = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 });
  const dienstag = planung.legePlatzAn({ week_start: MONTAG, weekday: 2, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 });
  const entwurf = planung.legePlatzAn({ week_start: MONTAG, weekday: 3, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 });
  assert.equal(montag.ok && dienstag.ok && entwurf.ok, true);
  const montagId = montag.ok ? montag.id : 0;
  const dienstagId = dienstag.ok ? dienstag.id : 0;

  // alle drei sind Entwurf und werden in einem Zug veröffentlicht
  assert.deepEqual(planung.veroeffentlicheWoche(MONTAG), { ok: true, anzahl: 3 });
  assert.equal(planung.wochenStatus(MONTAG), "veroeffentlicht");
  assert.deepEqual(planung.verwerfeEntwurf(MONTAG), { anzahl: 0 });

  // Montag 14:00 Wiener Zeit: der Montagsplatz (08:00–09:40) ist vorbei, der Dienstagsplatz nicht
  const montagNachmittag = new Date("2026-10-12T12:00:00Z");
  assert.equal(planung.istNichtStattgefunden(planung.getGeplanteEinheit(montagId)!, montagNachmittag), true);
  assert.equal(planung.istNichtStattgefunden(planung.getGeplanteEinheit(dienstagId)!, montagNachmittag), false);
  assert.deepEqual(planung.nichtStattgefunden(MONTAG, montagNachmittag).map((z) => z.id), [montagId]);
  // vor der Einheit ist nichts ausgefallen
  assert.equal(planung.istNichtStattgefunden(planung.getGeplanteEinheit(montagId)!, new Date("2026-10-12T05:00:00Z")), false);
  // eine verknüpfte Einheit heißt: sie hat stattgefunden
  const unitId = Number(
    db()
      .prepare("INSERT INTO units (teacher_id, student_id, status, started_at, ended_at, last_activity_at) VALUES (?, ?, 'beendet', '2026-10-12T08:00:00', '2026-10-12T09:40:00', '2026-10-12T09:40:00')")
      .run(niko.id, anna).lastInsertRowid,
  );
  assert.equal(planung.verknuepfePlatz(montagId, unitId).ok, true);
  assert.equal(planung.getGeplanteEinheit(montagId)!.unit_id, unitId);
  assert.equal(planung.istNichtStattgefunden(planung.getGeplanteEinheit(montagId)!, montagNachmittag), false);
  assert.deepEqual(planung.nichtStattgefunden(MONTAG, montagNachmittag), []);
  assert.equal(planung.verknuepfePlatz(999999, unitId).ok, false);
  assert.equal(planung.verknuepfePlatz(montagId, null).ok, true);
  assert.equal(planung.getGeplanteEinheit(montagId)!.unit_id, null);
  // ein Entwurf ist nie „nicht stattgefunden“
  assert.equal(planung.istNichtStattgefunden({ ...planung.getGeplanteEinheit(montagId)!, status: "entwurf" }, montagNachmittag), false);
});

test("Zeilen mit Namen, Tagesabfrage und Löschen", async () => {
  const { planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const r1 = raum("Gruppe 1", "online");
  const a = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 });
  assert.equal(a.ok, true);
  const aId = a.ok ? a.id : 0;

  const mitNamen = planung.mitNamen(planung.einheitenFuerWoche(MONTAG));
  assert.equal(mitNamen[0].teacher_name, "Niko");
  assert.equal(mitNamen[0].student_name, "Anna");
  assert.equal(mitNamen[0].room_name, "Gruppe 1");
  assert.equal(mitNamen[0].room_mode, "online");
  assert.deepEqual(planung.mitNamen([]), []);

  assert.deepEqual(planung.einheitenFuerTag(MONTAG).map((z) => z.id), [aId]);
  assert.deepEqual(planung.einheitenFuerTag(MONTAG, { teacherId: niko.id }).map((z) => z.id), [aId]);
  assert.deepEqual(planung.einheitenFuerTag(MONTAG, { teacherId: 999999 }), []);
  assert.deepEqual(planung.einheitenFuerTag(MONTAG, { studentId: anna }).map((z) => z.id), [aId]);
  assert.deepEqual(planung.einheitenFuerTag(DIENSTAG), []);
  assert.deepEqual(planung.einheitenFuerTag(MONTAG, { status: "veroeffentlicht" }), []);

  assert.equal(planung.loeschePlatz(aId).ok, true);
  assert.equal(planung.loeschePlatz(aId).ok, false);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 0);
  assert.deepEqual(planung.verwerfeEntwurf("14.10.2026"), { anzahl: 0 }, "kaputte Woche wirft nichts weg");
  assert.deepEqual(planung.loescheWoche("14.10.2026"), { anzahl: 0 });
});

test("der Raum lässt sich nicht löschen, solange ein Platz auf ihn zeigt (Phase 3 bleibt gültig)", async () => {
  const { planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const r1 = raum("Gruppe 1");
  const angelegt = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: r1 });
  assert.equal(angelegt.ok, true);
  assert.equal(planung.raumVerweise(r1), 1);
  const geloescht = planung.loescheRaum(r1);
  assert.deepEqual(geloescht, { geloescht: false, verweise: 1 });
  assert.equal(planung.getRaum(r1)!.active, 1);
});
