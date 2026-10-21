import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * „Heute“ auf dem Dashboard: nur **veröffentlichte** Plätze des heutigen Tages, gerechnet in
 * Europe/Vienna (`lib/planung/zeit.ts`). Die Tests rechnen mit festen Zeitpunkten, damit sie nicht
 * von der Uhr des Rechners abhängen.
 */
const MONTAG = "2026-10-12";
/** Wiener Zeit ist im Oktober UTC+2: 10:00 UTC = 12:00 in Wien = Minute 720. */
const MONTAG_MITTAG = new Date("2026-10-12T10:00:00Z");
/** 23:30 UTC am Montag ist in Wien schon Dienstag, 01:30. */
const MONTAG_SPAET = new Date("2026-10-12T23:30:00Z");

async function setup() {
  const { db, resetForTests } = await import("../db");
  resetForTests();
  const repo = await import("../repo");
  const planung = await import("./repo");
  const auth = await import("../auth");
  const { INITIAL_PASSWORD } = await import("../password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  const schueler = (name: string, teacherId: number) =>
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
  return { db, planung, niko, thomas, schueler, raum };
}

test("heutige Einheiten: nur veröffentlichte Plätze von heute, mit Namen und Zeit", async () => {
  const { db, planung, niko, thomas, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const berta = schueler("Berta", thomas.id);
  const r1 = raum("Gruppe 1");
  const r2 = raum("Gruppe 2", "online");
  const anlegen = (studentId: number, teacherId: number, weekday: number, start: number, dauer: number, roomId: number) => {
    const res = planung.legePlatzAn({ week_start: MONTAG, weekday, start_min: start, geplante_dauer: dauer, teacher_id: teacherId, student_id: studentId, room_id: roomId });
    assert.equal(res.ok, true);
    return res.ok ? res.id : 0;
  };
  const frueh = anlegen(anna, niko.id, 1, 480, 100, r1); // 08:00–09:40
  const mittag = anlegen(anna, niko.id, 1, 600, 60, r1); // 10:00–11:00
  const spaet = anlegen(anna, niko.id, 1, 720, 60, r2); // 12:00–13:00
  const andere = anlegen(berta, thomas.id, 1, 480, 60, r2);
  const dienstag = anlegen(anna, niko.id, 2, 480, 100, r1);
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  // ein Entwurf in derselben Woche darf nie auftauchen
  db()
    .prepare(
      `INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, created_at, updated_at)
       VALUES (?, 1, 900, 60, ?, ?, ?, 'entwurf', 0, datetime('now'), datetime('now'))`,
    )
    .run(MONTAG, niko.id, anna, r1);
  // eine verknüpfte Einheit bleibt in der Liste, zählt aber nicht mehr als offen
  const unitId = Number(
    db()
      .prepare("INSERT INTO units (teacher_id, student_id, status, started_at, ended_at, last_activity_at) VALUES (?, ?, 'beendet', '2026-10-12T08:00:00', '2026-10-12T09:40:00', '2026-10-12T09:40:00')")
      .run(niko.id, anna).lastInsertRowid,
  );
  assert.equal(planung.verknuepfePlatz(frueh, unitId).ok, true);

  const heute = await import("./heute");
  const alle = heute.heutigeEinheiten(undefined, MONTAG_MITTAG);
  assert.deepEqual(alle.map((p) => p.id), [frueh, andere, mittag, spaet], "nach Startzeit, ohne Entwurf und ohne Dienstag");
  const platz = (id: number) => alle.find((p) => p.id === id)!;
  assert.equal(platz(frueh).student_name, "Anna");
  assert.equal(platz(frueh).teacher_name, "Niko");
  assert.equal(platz(frueh).room_name, "Gruppe 1");
  assert.equal(platz(frueh).room_mode, "vor_ort");
  assert.equal(platz(frueh).zeit_label, "08:00–09:40");
  assert.equal(platz(spaet).room_name, "Gruppe 2");
  assert.equal(platz(spaet).room_mode, "online");
  assert.equal(platz(frueh).nicht_stattgefunden, false, "08:00–09:40 ist vorbei, hat aber eine Einheit: sie hat stattgefunden");
  assert.equal(platz(mittag).nicht_stattgefunden, true, "10:00–11:00 ist um 12:00 vorbei und hat keine Einheit: nicht stattgefunden");
  assert.equal(platz(spaet).nicht_stattgefunden, false, "12:00–13:00 läuft gerade");
  assert.equal(alle.length, 4, "Dienstag und Entwurf fehlen");
  assert.equal(alle.some((p) => p.id === dienstag), false);

  // nur die Plätze eines Lehrers
  assert.deepEqual(heute.heutigeEinheiten(niko.id, MONTAG_MITTAG).map((p) => p.id), [frueh, mittag, spaet]);
  assert.deepEqual(heute.heutigeEinheiten(thomas.id, MONTAG_MITTAG).map((p) => p.id), [andere]);
  assert.deepEqual(heute.heutigeEinheitenFuerSchueler(berta, MONTAG_MITTAG).map((p) => p.id), [andere]);
  assert.deepEqual(heute.heutigeEinheitenFuerSchueler(anna, new Date("2026-10-13T10:00:00Z")).map((p) => p.id), [dienstag]);
});

test("„heute“ gilt in Europe/Vienna, nicht in UTC", async () => {
  const { planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const r1 = raum("Gruppe 1");
  const montag = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 60, teacher_id: niko.id, student_id: anna, room_id: r1 });
  const dienstag = planung.legePlatzAn({ week_start: MONTAG, weekday: 2, start_min: 480, geplante_dauer: 60, teacher_id: niko.id, student_id: anna, room_id: r1 });
  assert.equal(montag.ok && dienstag.ok, true);
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  const heute = await import("./heute");

  assert.equal(heute.heutigerWochentag(MONTAG_MITTAG), 1);
  assert.equal(heute.heutigerWochenstart(MONTAG_MITTAG), MONTAG);
  assert.deepEqual(heute.heutigeEinheiten(niko.id, MONTAG_MITTAG).map((p) => p.id), [montag.ok ? montag.id : 0]);
  // 21:00 UTC ist 23:00 in Wien: noch Montag
  assert.deepEqual(heute.heutigeEinheiten(niko.id, new Date("2026-10-12T21:00:00Z")).map((p) => p.id), [montag.ok ? montag.id : 0]);
  // 23:30 UTC ist in Wien schon Dienstag
  assert.equal(heute.heutigerWochentag(MONTAG_SPAET), 2);
  assert.deepEqual(heute.heutigeEinheiten(niko.id, MONTAG_SPAET).map((p) => p.id), [dienstag.ok ? dienstag.id : 0]);
});

test("offene Plätze heute: ohne Einheit, der nächste zuerst (für den Start einer Einheit, D17)", async () => {
  const { db, planung, niko, schueler, raum } = await setup();
  const anna = schueler("Anna", niko.id);
  const berta = schueler("Berta", niko.id);
  const r1 = raum("Gruppe 1");
  const r2 = raum("Gruppe 2");
  const frueh = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 60, teacher_id: niko.id, student_id: anna, room_id: r1 });
  const mittag = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 660, geplante_dauer: 60, teacher_id: niko.id, student_id: anna, room_id: r1 });
  const spaet = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 720, geplante_dauer: 60, teacher_id: niko.id, student_id: anna, room_id: r1 });
  assert.equal(frueh.ok && mittag.ok && spaet.ok, true);
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  // die früheste hat schon eine Einheit
  const unitId = Number(
    db()
      .prepare("INSERT INTO units (teacher_id, student_id, status, started_at, last_activity_at) VALUES (?, ?, 'gestartet', '2026-10-12T08:00:00', '2026-10-12T08:00:00')")
      .run(niko.id, anna).lastInsertRowid,
  );
  assert.equal(planung.verknuepfePlatz(frueh.ok ? frueh.id : 0, unitId).ok, true);

  const heute = await import("./heute");
  // 12:00 Wiener Zeit: 12:00 (720) liegt näher als 11:00 (660)
  const offen = heute.offenePlaetzeHeute(anna, { now: MONTAG_MITTAG });
  assert.deepEqual(offen.map((p) => p.id), [spaet.ok ? spaet.id : 0, mittag.ok ? mittag.id : 0]);
  assert.ok(offen.every((p) => p.unit_id === null));
  // Lehrereinschränkung und leere Liste
  assert.deepEqual(heute.offenePlaetzeHeute(anna, { now: MONTAG_MITTAG, teacherId: niko.id }).length, 2);
  assert.deepEqual(heute.offenePlaetzeHeute(anna, { now: MONTAG_MITTAG, teacherId: 999999 }), []);
  assert.deepEqual(heute.offenePlaetzeHeute(berta, { now: MONTAG_MITTAG }), [], "Berta hat heute nichts");
});

test("zeitfenster: Beginn, Ende, Rest und Abstand zum Beginn nur am Tag des Platzes", async () => {
  const { zeitfenster, bisBeginnLabel } = await import("./heute");
  const platz = { week_start: MONTAG, weekday: 1 as const, start_min: 690, geplante_dauer: 100 }; // 11:30–13:10
  const mittag = zeitfenster(platz, MONTAG_MITTAG); // 12:00 in Wien
  assert.deepEqual(mittag, { von: "11:30", bis: "13:10", label: "11:30–13:10", restMinuten: 70, bisBeginn: -30 });
  // nach dem Ende ist der Rest negativ („über der Zeit“)
  assert.equal(zeitfenster(platz, new Date("2026-10-12T11:20:00Z")).restMinuten, -10);
  // am Dienstag (in Wien) gibt es weder Rest noch Abstand
  const dienstag = zeitfenster(platz, MONTAG_SPAET);
  assert.equal(dienstag.restMinuten, null);
  assert.equal(dienstag.bisBeginn, null);
  assert.equal(dienstag.label, "11:30–13:10");
  assert.equal(bisBeginnLabel(-5), "jetzt");
  assert.equal(bisBeginnLabel(0), "jetzt");
  assert.equal(bisBeginnLabel(40), "in 40 min");
  assert.equal(bisBeginnLabel(130), "in 2 h 10 min");
});
