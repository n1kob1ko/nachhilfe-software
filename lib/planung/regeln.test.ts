import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Die Planungsregeln: Vorgaben aus `config/scheduling-rules.json` des Quell-Repos, Ablage in
 * `app_settings` unter `planung_regeln`, zod-Prüfung beim Lesen. Ein fehlender oder kaputter Wert
 * ergibt die Vorgaben — laut gemeldet von `pruefeRegeln`, leise geglättet von `leseRegeln`.
 */
async function setup() {
  const { db, resetForTests } = await import("../db");
  resetForTests();
  const regeln = await import("./regeln");
  return { db, regeln };
}

test("die Vorgaben sind die Werte der Quell-Konfiguration, ohne die konkreten Paar-Ids", async () => {
  const { regeln } = await setup();
  assert.deepEqual(regeln.STANDARD_REGELN, {
    snapMinutes: 10,
    gapUsefulMinutesThreshold: 15,
    pointsPreferredTeacher: 0,
    pointsAdjacentTeacher: 0,
    penaltyPer30MinGap: 999,
    penaltySingleLessonTeacherDay: 10,
    penaltyLessPlannedLessonsOverall: 980,
    pointsPerMinuteRemainingCapacity: 2,
    pointsStudentPairShouldSameTime: 25,
    penaltyStudentPairShouldntSameTime: 25,
    prioritizeMaxPlannedLessons: true,
    enforceSingleLessonPerStudentPerDay: true,
    enforceTeacherCapacity: false,
    enforceTeacherAvailability: true,
    enforceStudentAvailability: true,
    enforceTeacherRoomPreference: true,
    enforceNoTeacherBreaks: true,
    enforceStudentWeekWeekendDistribution: false,
    studentPairTimingRules: [],
  });
  assert.deepEqual(regeln.leseRegeln(), regeln.standardRegeln(), "ohne gespeicherten Wert gelten die Vorgaben");
  assert.equal(regeln.regelnJson(), "", "und es steht nichts in app_settings");
});

test("Regeln durch app_settings: schreiben, lesen, derselbe Wert", async () => {
  const { regeln } = await setup();
  const eigene = {
    ...regeln.standardRegeln(),
    snapMinutes: 20,
    enforceNoTeacherBreaks: false,
    pointsPreferredTeacher: 50,
    studentPairTimingRules: [
      { id: "p1", studentAId: 3, studentBId: 7, strength: "must" as const },
      { id: "p2", studentAId: 7, studentBId: 11, strength: "shouldnt" as const },
    ],
  };
  const geschrieben = regeln.schreibeRegeln(eigene);
  assert.equal(geschrieben.ok, true);
  const gelesen = regeln.leseRegeln();
  assert.deepEqual(gelesen, eigene, "dieselben Regeln kommen zurück");
  assert.deepEqual(gelesen.studentPairTimingRules.map((r) => r.studentAId), [3, 7], "Schüler-Ids sind ganze Zahlen");
  assert.equal(typeof gelesen.studentPairTimingRules[0].studentAId, "number");
  assert.ok(regeln.regelnJson().startsWith("{"), "gespeichert wird JSON");
});

test("fehlende Felder bekommen die Vorgabe, unbekannte Felder fallen weg", async () => {
  const { db, regeln } = await setup();
  db().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run(regeln.REGELN_SCHLUESSEL, JSON.stringify({ snapMinutes: 30, unbekannt: true }));
  const gelesen = regeln.leseRegeln();
  assert.equal(gelesen.snapMinutes, 30);
  assert.equal(gelesen.gapUsefulMinutesThreshold, regeln.STANDARD_REGELN.gapUsefulMinutesThreshold, "der Rest bleibt Vorgabe");
  assert.equal(gelesen.prioritizeMaxPlannedLessons, true);
});

test("kaputtes JSON und ungültige Werte ergeben die Vorgaben (laut gemeldet, leise geglättet)", async () => {
  const { db, regeln } = await setup();
  const setze = (wert: string) =>
    db()
      .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(regeln.REGELN_SCHLUESSEL, wert);

  setze("{kaputt");
  assert.equal(regeln.pruefeRegeln("{kaputt").ok, false, "kaputtes JSON wird laut gemeldet");
  assert.deepEqual(regeln.leseRegeln(), regeln.standardRegeln(), "zur Laufzeit gelten die Vorgaben");

  for (const [wert, name] of [
    ['{"snapMinutes": 7}', "Raster kein Vielfaches von 10"],
    ['{"snapMinutes": "10"}', "Raster als Text"],
    ['{"prioritizeMaxPlannedLessons": "ja"}', "Boolean als Text"],
    ['{"penaltyPer30MinGap": -1}', "negativer Abzug"],
    ['{"studentPairTimingRules": [{"id": "p", "studentAId": "3", "studentBId": 7, "strength": "must"}]}', "Schüler-Id als Text"],
    ['{"studentPairTimingRules": [{"id": "p", "studentAId": 3, "studentBId": 3, "strength": "must"}]}', "Paar mit sich selbst"],
    ['{"studentPairTimingRules": [{"id": "p", "studentAId": 3, "studentBId": 7, "strength": "vielleicht"}]}', "unbekannte Stärke"],
    ['[1, 2, 3]', "kein Objekt"],
  ] as [string, string][]) {
    setze(wert);
    const geprüft = regeln.pruefeRegeln(wert);
    assert.equal(geprüft.ok, false, `${name} wird abgelehnt`);
    assert.match(geprüft.ok === false ? geprüft.fehler : "", /./, `${name} hat eine Meldung`);
    assert.deepEqual(regeln.leseRegeln(), regeln.standardRegeln(), `${name}: Laufzeit fällt auf die Vorgaben zurück`);
  }
});

test("schreibeRegeln lehnt ungültige Werte ab und lässt den alten Stand stehen", async () => {
  const { regeln } = await setup();
  assert.equal(regeln.schreibeRegeln({ ...regeln.standardRegeln(), snapMinutes: 20 }).ok, true);
  const abgelehnt = regeln.schreibeRegeln({ ...regeln.standardRegeln(), snapMinutes: 15 });
  assert.equal(abgelehnt.ok, false);
  assert.match(abgelehnt.ok === false ? abgelehnt.fehler : "", /Vielfaches von 10/);
  assert.equal(regeln.leseRegeln().snapMinutes, 20, "der gespeicherte Wert bleibt");
  // leerer Text heißt: nichts gespeichert, Vorgaben
  assert.deepEqual(regeln.pruefeRegeln(""), { ok: true, regeln: regeln.standardRegeln() });
  assert.equal(regeln.schreibeRegeln(JSON.stringify(regeln.standardRegeln())).ok, true);
});
