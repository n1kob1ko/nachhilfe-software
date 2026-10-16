import assert from "node:assert/strict";
import test from "node:test";

/**
 * Der Wochenplan-Generator. Die Fälle sind aus `ScheduleGenerator.test.ts` des Quell-Repos
 * übernommen (gleiche Substanz) und um das ergänzt, was das Quell-Repo nicht hatte: die geplante
 * Dauer je Schüler (D3/D18), das 10-Minuten-Raster (D19), gesperrte Plätze als Eingabe und das
 * Zeitbudget (§6).
 *
 * Unterschied zum Quell-Repo in den Vorgaben: dort galt `DEFAULT_SCHEDULING_RULES` (u. a.
 * `enforceTeacherCapacity: true`, `snapMinutes: 20`, `enforceStudentWeekWeekendDistribution: true`),
 * hier gelten die Werte der `config/scheduling-rules.json` (`enforceTeacherCapacity: false`,
 * `snapMinutes: 10`, `enforceStudentWeekWeekendDistribution: false`). Tests, die eine dieser Regeln
 * brauchen, schalten sie ausdrücklich ein — das ist unten jeweils vermerkt.
 */
import { generiereWochenplan, STANDARD_ZEITBUDGET_MS, type GeplanteEinheit, type PlanungLehrer, type PlanungRaum, type PlanungSchueler } from "./generator";
import { standardRegeln } from "./regeln";
import type { Wochentag } from "./zeit";

const MO: Wochentag = 1;
const DI: Wochentag = 2;
const SA: Wochentag = 6;
const SO: Wochentag = 7;

function lehrer(id: number, availability: PlanungLehrer["availability"], extra: Partial<PlanungLehrer> = {}): PlanungLehrer {
  return { id, name: `Lehrer ${id}`, weeklyTargetMinutes: 0, availability, preferredRoomIds: [], ...extra };
}

function schueler(id: number, availability: PlanungSchueler["availability"], extra: Partial<PlanungSchueler> = {}): PlanungSchueler {
  return { id, name: `Schüler ${id}`, einheitenProWoche: 1, geplanteDauer: 100, modusWunsch: "egal", availability, ...extra };
}

function raum(id: number, building: string, mode: PlanungRaum["mode"] = "vor_ort"): PlanungRaum {
  return { id, building, name: `Raum ${id}`, mode };
}

function gesperrt(id: number, weekday: Wochentag, start: number, dauer: number, teacherId: number, studentId: number, roomId: number | null): GeplanteEinheit {
  return { id, weekday, start, end: start + dauer, teacherId, studentId, roomId, locked: true };
}

/** Keine zwei Einheiten dürfen sich bei Lehrer, Schüler oder Raum überschneiden. */
function ohneUeberschneidung(einheiten: GeplanteEinheit[], art: "teacherId" | "studentId" | "roomId") {
  for (let i = 0; i < einheiten.length; i++) {
    for (let j = i + 1; j < einheiten.length; j++) {
      const a = einheiten[i];
      const b = einheiten[j];
      if (a.weekday !== b.weekday) continue;
      if (art === "roomId" && (a.roomId === null || b.roomId === null || a.roomId !== b.roomId)) continue;
      if (art !== "roomId" && a[art] !== b[art]) continue;
      assert.ok(a.start >= b.end || b.start >= a.end, `${art}: ${JSON.stringify(a)} und ${JSON.stringify(b)} überschneiden sich`);
    }
  }
}

test("ohne Räume kommt nur die Meldung, dass es keine Räume gibt", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] })],
    raeume: [],
    regeln: standardRegeln(),
  });
  assert.equal(ergebnis.einheiten.length, 0);
  assert.equal(ergebnis.offen.length, 1);
  assert.equal(ergebnis.offen[0].studentId, 1);
  assert.equal(ergebnis.offen[0].grund, "Keine Räume vorhanden.");
});

test("plant eine Einheit, wenn Lehrer, Schüler und Raum verfügbar sind", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] })],
    raeume: [raum(1, "Hauptgebäude")],
    regeln: standardRegeln(),
  });
  assert.equal(ergebnis.einheiten.length, 1);
  const e = ergebnis.einheiten[0];
  assert.equal(e.teacherId, 1);
  assert.equal(e.studentId, 1);
  assert.equal(e.roomId, 1);
  assert.equal(e.weekday, MO);
  assert.equal(e.end - e.start, 100, "geplante Dauer des Schülers");
  assert.equal(e.locked, false);
  assert.equal(ergebnis.offen.length, 0);
});

test("gesperrte Plätze bleiben stehen und werden ergänzt", () => {
  const locked = gesperrt(1, MO, 480, 100, 1, 1, 1);
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] }, { einheitenProWoche: 2 })],
    raeume: [raum(1, "Hauptgebäude")],
    gesperrte: [locked],
    regeln: standardRegeln(),
  });
  const unveraendert = ergebnis.einheiten.find((e) => e.id === 1);
  assert.deepEqual(unveraendert, locked, "der gesperrte Platz kommt genau so zurück, wie er hineinging");
  const erzeugt = ergebnis.einheiten.filter((e) => e.id === null);
  assert.ok(erzeugt.length >= 1, "der Rest des Bedarfs wird erzeugt");
  const minuten = ergebnis.einheiten.reduce((summe, e) => summe + (e.end - e.start), 0);
  assert.ok(minuten >= 200, `Bedarf 2 × 100 Minuten, geplant ${minuten}`);
  assert.equal(ergebnis.offen.length, 0);
});

test("meldet Schüler, die nicht (ganz) eingeplant werden konnten", () => {
  const regeln = { ...standardRegeln(), enforceTeacherCapacity: true };
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 580 }] }, { weeklyTargetMinutes: 100 })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] }, { einheitenProWoche: 2 })],
    raeume: [raum(1, "Hauptgebäude")],
    regeln,
  });
  assert.equal(ergebnis.einheiten.length, 1);
  assert.equal(ergebnis.offen.length, 1);
  assert.equal(ergebnis.offen[0].geplanteMinuten, 100);
  assert.equal(ergebnis.offen[0].benoetigteMinuten, 200);
});

test("bucht Lehrer, Schüler und Raum nicht doppelt", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] }), schueler(2, { "1": [{ start: 480, end: 720 }] })],
    raeume: [raum(1, "Hauptgebäude")],
    regeln: standardRegeln(),
  });
  assert.equal(ergebnis.einheiten.length, 2);
  ohneUeberschneidung(ergebnis.einheiten, "teacherId");
  ohneUeberschneidung(ergebnis.einheiten, "studentId");
  ohneUeberschneidung(ergebnis.einheiten, "roomId");
});

test("höchstens eine Einheit je Schüler und Tag", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] }, { einheitenProWoche: 2 })],
    raeume: [raum(1, "Hauptgebäude"), raum(2, "Hauptgebäude")],
    regeln: standardRegeln(),
  });
  const proTag = new Map<number, number>();
  for (const e of ergebnis.einheiten) proTag.set(e.weekday, (proTag.get(e.weekday) ?? 0) + 1);
  for (const anzahl of proTag.values()) assert.equal(anzahl, 1);
  assert.equal(ergebnis.einheiten.length, 2);
});

test("Schüler, deren Bedarf schon durch gesperrte Plätze gedeckt ist, bekommen nichts dazu", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] }, { einheitenProWoche: 1 })],
    raeume: [raum(1, "Hauptgebäude")],
    gesperrte: [gesperrt(1, MO, 480, 100, 1, 1, 1)],
    regeln: standardRegeln(),
  });
  assert.equal(ergebnis.einheiten.length, 1);
  assert.equal(ergebnis.einheiten[0].id, 1);
  assert.equal(ergebnis.offen.length, 0);
});

test("nur erlaubte Lehrer werden eingeplant", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] }), lehrer(2, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] }, { allowedTeacherIds: [2] })],
    raeume: [raum(1, "Hauptgebäude")],
    regeln: standardRegeln(),
  });
  assert.equal(ergebnis.einheiten.length, 1);
  assert.equal(ergebnis.einheiten[0].teacherId, 2);
});

test("keine Lücke im Lehrertag (no-break): der zweite Schüler bleibt offen", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 780 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 780 }] }), schueler(2, { "1": [{ start: 660, end: 780 }] })],
    raeume: [raum(1, "Hauptgebäude")],
    gesperrte: [gesperrt(1, MO, 480, 100, 1, 1, 1)],
    regeln: { ...standardRegeln(), enforceNoTeacherBreaks: true },
  });
  assert.equal(ergebnis.einheiten.length, 1);
  assert.equal(ergebnis.einheiten[0].id, 1);
  assert.ok(ergebnis.offen.some((e) => e.studentId === 2));
});

test("ein Lehrer bleibt an einem Tag in einem Gebäude", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 780 }] }), lehrer(2, { "1": [{ start: 480, end: 780 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 780 }] }), schueler(2, { "1": [{ start: 580, end: 780 }] }), schueler(3, { "1": [{ start: 480, end: 780 }] })],
    raeume: [raum(1, "Hauptgebäude"), raum(2, "Nebengebäude")],
    gesperrte: [gesperrt(1, MO, 480, 100, 1, 1, 1), gesperrt(2, MO, 580, 100, 2, 3, 1)],
    regeln: standardRegeln(),
  });
  assert.equal(
    ergebnis.einheiten.some((e) => e.teacherId === 1 && e.id !== 1),
    false,
    "Lehrer 1 bekommt nichts dazu: sein Gebäude ist Hauptgebäude, der Raum dort ist besetzt",
  );
});

test("einzelne Einheiten an einem Lehrertag kosten Punkte", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 780 }] }), lehrer(2, { "1": [{ start: 480, end: 780 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 780 }] }), schueler(2, { "1": [{ start: 580, end: 780 }] })],
    raeume: [raum(1, "Hauptgebäude")],
    gesperrte: [gesperrt(1, MO, 480, 100, 1, 1, 1)],
    regeln: { ...standardRegeln(), pointsPerMinuteRemainingCapacity: 0, penaltySingleLessonTeacherDay: 200, enforceTeacherCapacity: false },
  });
  const fuerZwei = ergebnis.einheiten.find((e) => e.studentId === 2);
  assert.equal(fuerZwei?.teacherId, 1, "Lehrer 1 hat schon eine Einheit an diesem Tag, eine zweite ist günstiger als eine einzelne bei Lehrer 2");
});

test("Wochentag/Wochenende-Verteilung bei 400 Minuten Bedarf", () => {
  const alleTage = { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }], "3": [{ start: 480, end: 720 }], "4": [{ start: 480, end: 720 }], "5": [{ start: 480, end: 720 }], "6": [{ start: 480, end: 720 }], "7": [{ start: 480, end: 720 }] };
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, alleTage, { weeklyTargetMinutes: 1000 })],
    schueler: [schueler(1, alleTage, { einheitenProWoche: 4 })],
    raeume: [raum(1, "Hauptgebäude")],
    regeln: { ...standardRegeln(), enforceStudentWeekWeekendDistribution: true },
  });
  assert.equal(ergebnis.einheiten.length, 4);
  const wochenende = ergebnis.einheiten.filter((e) => e.weekday === SA || e.weekday === SO);
  const wochentags = ergebnis.einheiten.filter((e) => e.weekday >= 1 && e.weekday <= 5);
  assert.ok(wochenende.length >= 2, `Wochenende: ${wochenende.length}`);
  assert.ok(wochentags.length >= 2, `Wochentags: ${wochentags.length}`);
});

test("Schüler mit Modus „online“ bekommt einen Online-Raum", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] }, { modusWunsch: "online" })],
    raeume: [raum(1, "Hauptgebäude", "vor_ort"), raum(2, "Online", "online")],
    regeln: standardRegeln(),
  });
  assert.equal(ergebnis.einheiten.length, 1);
  assert.equal(ergebnis.einheiten[0].roomId, 2);
});

test("Schüler mit Modus „vor Ort“ bekommt keinen Online-Raum", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] }, { modusWunsch: "vor_ort" })],
    raeume: [raum(1, "Online", "online"), raum(2, "Hauptgebäude", "vor_ort")],
    regeln: standardRegeln(),
  });
  assert.equal(ergebnis.einheiten.length, 1);
  assert.equal(ergebnis.einheiten[0].roomId, 2);
});

test("der Raumwunsch des Lehrers gilt", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] }, { preferredRoomIds: [2] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] })],
    raeume: [raum(1, "Hauptgebäude"), raum(2, "Nebengebäude")],
    regeln: standardRegeln(),
  });
  assert.equal(ergebnis.einheiten.length, 1);
  assert.equal(ergebnis.einheiten[0].roomId, 2, "nur Wunschräume, der erste passt");
});

test("Paarregel „mustnt“ verhindert die gleiche Zeit", () => {
  const zweiLehrerZweiRaeume = {
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] }), lehrer(2, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] }), schueler(2, { "1": [{ start: 480, end: 720 }] })],
    raeume: [raum(1, "Hauptgebäude"), raum(2, "Hauptgebäude")],
  };
  // ohne die Regel landen beide zur selben Zeit (bei verschiedenen Lehrern) …
  const ohne = generiereWochenplan({ ...zweiLehrerZweiRaeume, regeln: standardRegeln() });
  assert.equal(ohne.einheiten.length, 2);
  assert.equal(ohne.einheiten[0].start, ohne.einheiten[1].start, "ohne Regel ist die gleiche Zeit erlaubt");
  // … mit „mustnt“ nicht mehr
  const mit = generiereWochenplan({
    ...zweiLehrerZweiRaeume,
    regeln: { ...standardRegeln(), studentPairTimingRules: [{ id: "p1", studentAId: 1, studentBId: 2, strength: "mustnt" }] },
  });
  assert.equal(mit.einheiten.length, 2);
  const [a, b] = mit.einheiten;
  assert.ok(a.start !== b.start || a.weekday !== b.weekday, "die beiden dürfen nicht gleichzeitig sein");
});

test("variable Dauer je Schüler: jede Einheit ist genau so lang wie eingestellt (D3)", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 900 }], "2": [{ start: 480, end: 900 }] })],
    schueler: [
      schueler(1, { "1": [{ start: 480, end: 900 }], "2": [{ start: 480, end: 900 }] }, { geplanteDauer: 100, einheitenProWoche: 2 }),
      schueler(2, { "1": [{ start: 480, end: 900 }], "2": [{ start: 480, end: 900 }] }, { geplanteDauer: 45, einheitenProWoche: 2 }),
    ],
    raeume: [raum(1, "Hauptgebäude"), raum(2, "Hauptgebäude")],
    regeln: standardRegeln(),
  });
  const fuerEins = ergebnis.einheiten.filter((e) => e.studentId === 1);
  const fuerZwei = ergebnis.einheiten.filter((e) => e.studentId === 2);
  assert.equal(fuerEins.length, 2);
  assert.equal(fuerZwei.length, 2);
  for (const e of fuerEins) assert.equal(e.end - e.start, 100);
  for (const e of fuerZwei) assert.equal(e.end - e.start, 45);
  assert.equal(ergebnis.offen.length, 0);
});

test("Startzeiten liegen auf dem 10-Minuten-Raster und in der Verfügbarkeit (D19)", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 545, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 545, end: 720 }] }, { geplanteDauer: 50, einheitenProWoche: 2 })],
    raeume: [raum(1, "Hauptgebäude"), raum(2, "Hauptgebäude")],
    regeln: standardRegeln(),
  });
  assert.ok(ergebnis.einheiten.length >= 1);
  for (const e of ergebnis.einheiten) {
    assert.equal(e.start % 10, 0, `Start ${e.start} liegt nicht auf dem 10-Minuten-Raster`);
    assert.ok(e.start >= 545 && e.end <= 720, "die Einheit liegt ganz in der Verfügbarkeit");
    assert.equal(e.end - e.start, 50);
  }
});

test("gleicher Seed ergibt dasselbe Ergebnis, und nichts überschneidet sich", () => {
  const eingabe = {
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] })],
    schueler: [
      schueler(1, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] }, { geplanteDauer: 60 }),
      schueler(2, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] }, { geplanteDauer: 60 }),
      schueler(3, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] }, { geplanteDauer: 60 }),
    ],
    raeume: [raum(1, "Hauptgebäude")],
    regeln: standardRegeln(),
    seed: 42,
  };
  const ersteWahl = generiereWochenplan(eingabe);
  const nochmal = generiereWochenplan(eingabe);
  assert.deepEqual(nochmal.einheiten, ersteWahl.einheiten, "gleicher Seed, gleiches Ergebnis");
  assert.equal(ersteWahl.offen.length, 0, "alle drei Schüler mit gleicher Verfügbarkeit kommen dran");
  ohneUeberschneidung(ersteWahl.einheiten, "studentId");
  ohneUeberschneidung(ersteWahl.einheiten, "teacherId");
  ohneUeberschneidung(ersteWahl.einheiten, "roomId");
  // ein anderer Seed darf eine andere Reihung ergeben, bleibt aber gültig
  const andere = generiereWochenplan({ ...eingabe, seed: 7 });
  assert.equal(andere.einheiten.length, 3);
  ohneUeberschneidung(andere.einheiten, "studentId");
});

test("das Zeitbudget wird eingehalten, und was bis dahin fertig war, bleibt (§6)", () => {
  let jetzt = 0;
  const uhr = () => {
    const wert = jetzt;
    jetzt += 500; // jede Messung springt 500 ms weiter
    return wert;
  };
  const eingabe = {
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }], "3": [{ start: 480, end: 720 }], "4": [{ start: 480, end: 720 }] })],
    schueler: [
      schueler(1, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] }, { geplanteDauer: 60 }),
      schueler(2, { "1": [{ start: 480, end: 720 }], "2": [{ start: 480, end: 720 }] }, { geplanteDauer: 60 }),
      schueler(3, { "3": [{ start: 480, end: 720 }], "4": [{ start: 480, end: 720 }] }, { geplanteDauer: 60 }),
    ],
    raeume: [raum(1, "Hauptgebäude")],
    regeln: standardRegeln(),
    zeitbudgetMs: 2000,
    jetzt: uhr,
  };
  const ergebnis = generiereWochenplan(eingabe);
  assert.equal(ergebnis.zeitbudgetErreicht, true, "das Budget war erreicht");
  assert.ok(ergebnis.einheiten.length >= 1, "was bis dahin gefunden war, wird zurückgegeben");
  ohneUeberschneidung(ergebnis.einheiten, "studentId");
  ohneUeberschneidung(ergebnis.einheiten, "teacherId");
  ohneUeberschneidung(ergebnis.einheiten, "roomId");
  // die offenen Schüler werden trotzdem vollständig gemeldet
  assert.equal(ergebnis.offen.length, 3 - ergebnis.einheiten.length);
  // ohne Budget (mit echter Uhr) sind alle da — das Budget hat also wirklich abgebrochen
  const vollstaendig = generiereWochenplan({ ...eingabe, jetzt: () => 0, zeitbudgetMs: STANDARD_ZEITBUDGET_MS });
  assert.equal(vollstaendig.zeitbudgetErreicht, false);
  assert.equal(vollstaendig.einheiten.length, 3);
  assert.ok(ergebnis.einheiten.length < vollstaendig.einheiten.length, "mit Budget wird weniger geschafft");
});

test("ein Budget von 0 ms bricht sofort ab, ohne etwas zu erfinden", () => {
  const ergebnis = generiereWochenplan({
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 720 }] })],
    schueler: [schueler(1, { "1": [{ start: 480, end: 720 }] })],
    raeume: [raum(1, "Hauptgebäude")],
    regeln: standardRegeln(),
    zeitbudgetMs: 0,
  });
  assert.equal(ergebnis.zeitbudgetErreicht, true);
  assert.equal(ergebnis.einheiten.length, 0);
  assert.equal(ergebnis.offen.length, 1, "der Schüler bleibt als offen gemeldet");
});

test("die Verfügbarkeit des Lehrers gilt, die des Schülers kann abgeschaltet werden", () => {
  const eingabe = {
    lehrer: [lehrer(1, { "1": [{ start: 480, end: 580 }] })],
    schueler: [schueler(1, { "2": [{ start: 480, end: 580 }] })],
    raeume: [raum(1, "Hauptgebäude")],
    regeln: standardRegeln(),
  };
  const ohneGemeinsamenTag = generiereWochenplan(eingabe);
  assert.equal(ohneGemeinsamenTag.einheiten.length, 0, "Lehrer Montag, Schüler Dienstag: kein gemeinsamer Tag");
  assert.equal(ohneGemeinsamenTag.offen.length, 1);

  // Lehrer-Verfügbarkeit abgeschaltet: der Generator darf irgendwohin, die Schülerzeiten bleiben
  const ohneLehrerzeiten = generiereWochenplan({ ...eingabe, regeln: { ...standardRegeln(), enforceTeacherAvailability: false } });
  assert.equal(ohneLehrerzeiten.einheiten.length, 1);
  assert.equal(ohneLehrerzeiten.einheiten[0].weekday, DI);
});
