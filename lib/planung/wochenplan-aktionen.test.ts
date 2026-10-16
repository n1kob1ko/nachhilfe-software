import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Die Wochenplan-Aktionen der Phase 4 — geprüft an den **echten** Funktionen aus
 * `lib/planung/aktionen.ts` (nicht an einer Nachbildung) und an den reinen Rechenstücken aus
 * `lib/planung/uebersicht.ts`.
 *
 * Der Kern ist die Rechteprüfung (D23): **die Verwaltung** generiert, ändert und veröffentlicht;
 * ein Lehrer liest nur seine eigene veröffentlichte Woche und schreibt nichts. Jede Prüfung sieht
 * zusätzlich nach, dass ein abgelehnter Aufruf wirklich **nichts** geschrieben hat.
 *
 * 2026-10-12 ist ein Montag (Europe/Vienna), 2026-10-05 der Montag der Vorwoche.
 */
import type { TagSchluessel } from "./zeit";
import type { Verfuegbarkeit } from "./verfuegbarkeit";

const MONTAG = "2026-10-12";
const NAECHSTE_WOCHE = "2026-10-19";
const VORWOCHE = "2026-10-05";

async function setup() {
  const { db, resetForTests } = await import("../db");
  // jede Prüfung startet auf einer leeren Datenbank, damit sich die Tests nicht gegenseitig sehen
  resetForTests();
  const repo = await import("../repo");
  const planung = await import("./repo");
  const aktionen = await import("./aktionen");
  const uebersicht = await import("./uebersicht");
  const regeln = await import("./regeln");
  const auth = await import("../auth");
  const { INITIAL_PASSWORD } = await import("../password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  assert.equal(niko.is_admin, 1, "Niko ist die Verwaltung");
  assert.equal(thomas.is_admin, 0, "Thomas ist Lehrer ohne Verwaltungsrechte");

  const schueler = (name: string, teacherId: number | null) =>
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

  return { db, repo, planung, aktionen, uebersicht, regeln, niko, thomas, schueler, raum, verfuegbar, planungFuer };
}

/** Ein Schüler mit Bedarf und Verfügbarkeit, dazu ein Raum — die Grundlage eines Generierlaufs. */
async function welt() {
  const s = await setup();
  // ohne Verfügbarkeit des Lehrers plant der Generator nichts ein (harte Regel)
  s.planung.setLehrerVerfuegbarkeit(s.niko.id, s.verfuegbar(["1", "2", "3"], 480, 840));
  const anna = s.schueler("Anna", s.niko.id);
  s.planungFuer(anna, ["1", "3"], 2, 100);
  const raum = s.raum("Gruppe 1");
  return { ...s, anna, raum };
}

test("D23: nur die Verwaltung generiert — ein Lehrer nicht, und es wird nichts geschrieben", async () => {
  const { aktionen, planung, niko, thomas } = await welt();

  const verboten = aktionen.erstelleWochenplan(thomas, MONTAG);
  assert.equal(verboten.ok, false, "ein Lehrer darf die Woche nicht generieren");
  assert.match(verboten.ok === false ? verboten.fehler : "", /Verwaltung/);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 0, "nichts wurde geschrieben");
  assert.equal(planung.wochenStatus(MONTAG), "leer");

  const erzeugt = aktionen.erstelleWochenplan(niko, MONTAG);
  assert.equal(erzeugt.ok, true, erzeugt.ok === false ? erzeugt.fehler : "");
  assert.match(erzeugt.ok ? (erzeugt.hinweis ?? "") : "", /Platz|Plätze/);
  assert.equal(planung.wochenStatus(MONTAG), "entwurf");
  assert.ok(planung.einheitenFuerWoche(MONTAG).length >= 1, "die Woche hat Plätze");
  assert.ok(planung.einheitenFuerWoche(MONTAG).every((z) => z.status === "entwurf"), "generiert wird als Entwurf");

  // „Generieren“ ist nur für die leere Woche; danach heißt es „Neu generieren“ (D24)
  const zweimal = aktionen.erstelleWochenplan(niko, MONTAG);
  assert.equal(zweimal.ok, false);
  assert.match(zweimal.ok === false ? zweimal.fehler : "", /Neu generieren/);
  assert.equal(aktionen.generiereWocheNeu(niko, MONTAG).ok, true);
  // „Neu generieren“ gehört ebenso der Verwaltung
  assert.equal(aktionen.generiereWocheNeu(thomas, MONTAG).ok, false);
  // eine unsinnige Woche wird abgelehnt
  assert.equal(aktionen.erstelleWochenplan(niko, "14.10.2026").ok, false);
});

test("D23: Plätze setzen, ändern, sperren, löschen — nur die Verwaltung, und die Prüfung bleibt scharf", async () => {
  const { aktionen, planung, niko, thomas, anna, raum, schueler } = await welt();
  const berta = schueler("Berta", niko.id);
  const basis = { week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: raum };

  // ein Lehrer schreibt nichts — weder anlegen noch ändern noch sperren noch löschen
  assert.equal(aktionen.setzePlatz(thomas, basis).ok, false);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 0, "nichts wurde geschrieben");

  const angelegt = aktionen.setzePlatz(niko, basis);
  assert.equal(angelegt.ok, true, angelegt.ok === false ? angelegt.fehler : "");
  const id = planung.einheitenFuerWoche(MONTAG)[0].id;
  assert.equal(planung.getGeplanteEinheit(id)!.start_min, 480);

  // die Überlappungsprüfung des Repos gilt auch durch die Aktion: ein zweiter Platz zur selben Zeit
  const ueberlappt = aktionen.setzePlatz(niko, { ...basis, student_id: berta, room_id: null });
  assert.equal(ueberlappt.ok, false);
  assert.match(ueberlappt.ok === false ? ueberlappt.fehler : "", /schon verplant/);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 1, "der abgelehnte Platz wurde nicht geschrieben");

  assert.equal(aktionen.aenderePlatz(thomas, id, { start_min: 600 }).ok, false);
  assert.equal(planung.getGeplanteEinheit(id)!.start_min, 480, "nichts geändert");
  assert.equal(aktionen.aenderePlatz(niko, id, { weekday: 3, start_min: 545 }).ok, true);
  assert.equal(planung.getGeplanteEinheit(id)!.start_min, 550, "der Start rastet auf 10 Minuten ein (D19)");
  assert.equal(planung.getGeplanteEinheit(id)!.weekday, 3);

  assert.equal(aktionen.setzeGesperrt(thomas, id, true).ok, false);
  assert.equal(planung.getGeplanteEinheit(id)!.locked, 0);
  assert.equal(aktionen.setzeGesperrt(niko, id, true).ok, true);
  assert.equal(planung.getGeplanteEinheit(id)!.locked, 1);

  assert.equal(aktionen.loeschePlatz(thomas, id).ok, false);
  assert.equal(planung.getGeplanteEinheit(id) !== null, true, "der Platz steht noch");
  assert.equal(aktionen.loeschePlatz(niko, id).ok, true);
  assert.equal(planung.getGeplanteEinheit(id), null);
  // unbekannte Ids werden sauber abgelehnt
  assert.equal(aktionen.loeschePlatz(niko, 999999).ok, false);
  assert.equal(aktionen.setzeGesperrt(niko, 999999, true).ok, false);
});

test("D23: veröffentlichen, verwerfen — nur die Verwaltung; danach sind einzelne Plätze noch änderbar", async () => {
  const { aktionen, planung, niko, thomas, anna, raum } = await welt();
  assert.equal(aktionen.setzePlatz(niko, { week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: raum }).ok, true);

  const verboten = aktionen.veroeffentlicheWoche(thomas, MONTAG);
  assert.equal(verboten.ok, false);
  assert.match(verboten.ok === false ? verboten.fehler : "", /Verwaltung/);
  assert.equal(planung.wochenStatus(MONTAG), "entwurf", "die Woche ist weiterhin Entwurf");

  const veroeffentlicht = aktionen.veroeffentlicheWoche(niko, MONTAG);
  assert.equal(veroeffentlicht.ok, true, veroeffentlicht.ok === false ? veroeffentlicht.fehler : "");
  assert.equal(planung.wochenStatus(MONTAG), "veroeffentlicht");
  assert.ok(planung.einheitenFuerWoche(MONTAG).every((z) => z.status === "veroeffentlicht"));

  // doppelt veröffentlichen geht nicht, neu generieren auch nicht
  assert.equal(aktionen.veroeffentlicheWoche(niko, MONTAG).ok, false);
  const neuVersucht = aktionen.generiereWocheNeu(niko, MONTAG);
  assert.equal(neuVersucht.ok, false);
  assert.match(neuVersucht.ok === false ? neuVersucht.fehler : "", /veröffentlicht/);
  // es gibt keinen Entwurf mehr zu verwerfen
  assert.equal(aktionen.verwerfeEntwurf(niko, MONTAG).ok, false);
  // ein einzelner Platz bleibt änderbar — in einer veröffentlichten Woche sofort veröffentlicht
  const id = planung.einheitenFuerWoche(MONTAG)[0].id;
  assert.equal(aktionen.aenderePlatz(niko, id, { start_min: 600 }).ok, true);
  assert.equal(planung.getGeplanteEinheit(id)!.status, "veroeffentlicht");
});

test("D23: Vorwoche übernehmen — nur die Verwaltung, die Kopie ist Entwurf ohne Sperre und ohne Einheit", async () => {
  const { aktionen, planung, niko, thomas, anna, raum } = await welt();
  assert.equal(planung.legePlatzAn({ week_start: VORWOCHE, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: raum }).ok, true);
  planung.setzeGesperrt(planung.einheitenFuerWoche(VORWOCHE)[0].id, true);
  assert.equal(planung.veroeffentlicheWoche(VORWOCHE).ok, true);

  const verboten = aktionen.kopiereVorwoche(thomas, MONTAG);
  assert.equal(verboten.ok, false);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 0, "nichts wurde geschrieben");

  const kopie = aktionen.kopiereVorwoche(niko, MONTAG);
  assert.equal(kopie.ok, true, kopie.ok === false ? kopie.fehler : "");
  const zeilen = planung.einheitenFuerWoche(MONTAG);
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].status, "entwurf");
  assert.equal(zeilen[0].locked, 0, "die Kopie ist ein Vorschlag, kein gesperrter Platz");
  assert.equal(zeilen[0].unit_id, null);
  // ein zweites Mal geht nicht (die Woche ist nicht mehr leer)
  assert.equal(aktionen.kopiereVorwoche(niko, MONTAG).ok, false);
});

test("D23: Regeln schreiben — nur die Verwaltung; Ungültiges wird abgelehnt, nicht geglättet", async () => {
  const { aktionen, regeln, niko, thomas } = await setup();
  assert.equal(regeln.regelnJson(), "", "am Anfang ist nichts gespeichert");

  const verboten = aktionen.speichereRegeln(thomas, { ...regeln.standardRegeln(), penaltyPer30MinGap: 1 });
  assert.equal(verboten.ok, false);
  assert.match(verboten.ok === false ? verboten.fehler : "", /Verwaltung/);
  assert.equal(regeln.regelnJson(), "", "nichts wurde geschrieben");

  const gespeichert = aktionen.speichereRegeln(niko, { ...regeln.standardRegeln(), penaltyPer30MinGap: 42, enforceTeacherCapacity: true });
  assert.equal(gespeichert.ok, true, gespeichert.ok === false ? gespeichert.fehler : "");
  const gelesen = regeln.leseRegeln();
  assert.equal(gelesen.penaltyPer30MinGap, 42);
  assert.equal(gelesen.enforceTeacherCapacity, true);

  // 15 Minuten ist kein Vielfaches von 10 (D19): abgelehnt, der alte Wert bleibt stehen
  const kaputt = aktionen.speichereRegeln(niko, { ...regeln.standardRegeln(), snapMinutes: 15 });
  assert.equal(kaputt.ok, false);
  assert.match(kaputt.ok === false ? kaputt.fehler : "", /Raster/);
  assert.equal(regeln.leseRegeln().penaltyPer30MinGap, 42, "der alte Wert steht noch");
});

test("D23: ein Lehrer sieht nur seine eigene veröffentlichte Woche, ein Entwurf bleibt unsichtbar", async () => {
  const { aktionen, uebersicht, planung, niko, thomas, anna, raum, schueler, planungFuer } = await welt();
  const berta = schueler("Berta", thomas.id);
  planungFuer(berta, ["1"], 1, 100);

  // je ein Platz für Niko und Thomas, dann veröffentlichen
  assert.equal(aktionen.setzePlatz(niko, { week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: raum }).ok, true);
  assert.equal(aktionen.setzePlatz(niko, { week_start: MONTAG, weekday: 1, start_min: 600, geplante_dauer: 100, teacher_id: thomas.id, student_id: berta, room_id: null }).ok, true);
  assert.equal(aktionen.veroeffentlicheWoche(niko, MONTAG).ok, true);

  const thomasSicht = uebersicht.wochenUebersicht(MONTAG, { status: "veroeffentlicht", nurLehrerId: thomas.id });
  assert.equal(thomasSicht.plaetze.length, 1);
  assert.ok(thomasSicht.plaetze.every((p) => p.teacherId === thomas.id), "nur die eigene Woche");
  assert.equal(thomasSicht.lehrer.length, 1);
  assert.equal(thomasSicht.lehrer[0].id, thomas.id);

  const verwaltung = uebersicht.wochenUebersicht(MONTAG, { status: "alle" });
  assert.equal(verwaltung.plaetze.length, 2, "die Verwaltung sieht beide Lehrer");

  // ein Entwurf der nächsten Woche ist für einen Lehrer unsichtbar
  assert.equal(aktionen.setzePlatz(niko, { week_start: NAECHSTE_WOCHE, weekday: 3, start_min: 480, geplante_dauer: 100, teacher_id: thomas.id, student_id: berta, room_id: null }).ok, true);
  assert.equal(uebersicht.wochenUebersicht(NAECHSTE_WOCHE, { status: "veroeffentlicht", nurLehrerId: thomas.id }).plaetze.length, 0);
  assert.equal(uebersicht.wochenUebersicht(NAECHSTE_WOCHE, { status: "alle" }).plaetze.length, 1);

  // und die Rechtefunktionen sagen dasselbe
  assert.equal(planung.wochenStatus(NAECHSTE_WOCHE), "entwurf");
  assert.equal(uebersicht.wochenUebersicht(MONTAG, { status: "veroeffentlicht", nurLehrerId: thomas.id }).status, "veroeffentlicht");
});

test("pruefeZiel fragt dieselbe Überlappungsprüfung wie das Schreiben — und nur die Verwaltung darf fragen", async () => {
  const { aktionen, planung, niko, thomas, anna, raum, schueler, planungFuer } = await welt();
  const berta = schueler("Berta", niko.id);
  planungFuer(berta, ["2"], 1, 100);
  assert.equal(aktionen.setzePlatz(niko, { week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: raum }).ok, true);
  const zweiter = aktionen.setzePlatz(niko, { week_start: MONTAG, weekday: 2, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: berta, room_id: null });
  assert.equal(zweiter.ok, true, zweiter.ok === false ? zweiter.fehler : "");
  const id = planung.einheitenFuerWoche(MONTAG).find((z) => z.student_id === berta)!.id;

  // Dienstag 08:00 bei Niko ist frei … Montag 08:00 nicht
  const montagFrueh = aktionen.pruefeZiel(niko, id, { weekday: 1, startMin: 480 });
  assert.equal(montagFrueh.ok, false);
  assert.match(montagFrueh.ok === false ? montagFrueh.fehler : "", /schon verplant/);
  assert.equal(aktionen.pruefeZiel(niko, id, { weekday: 1, startMin: 600 }).ok, true);
  assert.equal(aktionen.pruefeZiel(niko, id, { weekday: 5, startMin: 480 }).ok, true);
  // unbekannter Platz, fremder Lehrer
  assert.equal(aktionen.pruefeZiel(niko, 999999, { weekday: 1, startMin: 480 }).ok, false);
  assert.equal(aktionen.pruefeZiel(thomas, id, { weekday: 5, startMin: 480 }).ok, false);
});

test("Offen (D18): wer seinen Bedarf nicht gedeckt hat, steht im Schubfach — und verschwindet, wenn er gedeckt ist", async () => {
  const { aktionen, uebersicht, niko, anna, raum } = await welt();
  const offen = uebersicht.offeneFuerWoche(MONTAG);
  assert.equal(offen.length, 1);
  assert.equal(offen[0].studentId, anna);
  assert.equal(offen[0].geplanteEinheiten, 0);
  assert.equal(offen[0].benoetigteMinuten, 200, "2 Einheiten × 100 Minuten (D18)");
  assert.equal(offen[0].grund, undefined, "Räume gibt es");

  assert.equal(aktionen.setzePlatz(niko, { week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: raum }).ok, true);
  let jetzt = uebersicht.offeneFuerWoche(MONTAG);
  assert.equal(jetzt[0].geplanteEinheiten, 1);
  assert.equal(jetzt[0].geplanteMinuten, 100);

  assert.equal(aktionen.setzePlatz(niko, { week_start: MONTAG, weekday: 3, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: raum }).ok, true);
  assert.deepEqual(uebersicht.offeneFuerWoche(MONTAG), []);

  // „Offen“ rechnet über die ganze Woche, auch wenn die Ansicht nur einen Lehrer zeigt
  assert.equal(uebersicht.wochenUebersicht(MONTAG, { status: "alle" }).offen.length, 0);
});

test("ohne Räume sagt „Offen“ den Grund — wie der Generator", async () => {
  const s = await setup();
  const anna = s.schueler("Anna", s.niko.id);
  s.planungFuer(anna, ["1"], 1, 100);
  const offen = s.uebersicht.offeneFuerWoche(MONTAG);
  assert.equal(offen.length, 1);
  assert.equal(offen[0].grund, "Keine Räume vorhanden.");
});

test("lueckenFuerTag: nur Lücken länger als 0 und kürzer als die Schwelle zählen", async () => {
  // (die reinen Rechenstücke — ohne Datenbank)
  const { lueckenFuerTag } = await import("./uebersicht");
  const bloecke = [
    { start: 480, end: 580 },
    { start: 590, end: 690 },
    { start: 700, end: 760 },
  ];
  assert.deepEqual(lueckenFuerTag(bloecke, 15), [
    { start: 580, end: 590 },
    { start: 690, end: 700 },
  ]);
  // dieselbe Menge, unsortiert
  assert.deepEqual(lueckenFuerTag([bloecke[2], bloecke[0], bloecke[1]], 15), [
    { start: 580, end: 590 },
    { start: 690, end: 700 },
  ]);
  // eine Lücke von 10 Minuten gilt ab einer Schwelle von 10 nicht mehr als unnütz
  assert.deepEqual(lueckenFuerTag(bloecke, 10), []);
  // aneinander anschließende Blöcke sind keine Lücke
  assert.deepEqual(lueckenFuerTag([{ start: 480, end: 580 }, { start: 580, end: 680 }], 15), []);
  assert.deepEqual(lueckenFuerTag([], 15), []);
  assert.deepEqual(lueckenFuerTag([{ start: 480, end: 580 }], 15), []);
});

test("kennzahlen: Anzahl, Minuten, Ausgefallenes, Schüler unter Bedarf und die Auslastung", async () => {
  const { kennzahlen } = await import("./uebersicht");
  const plaetze = [
    { teacherId: 1, studentId: 1, weekday: 1, startMin: 480, dauer: 100 },
    { teacherId: 1, studentId: 2, weekday: 1, startMin: 590, dauer: 100, nichtStattgefunden: true },
    { teacherId: 2, studentId: 1, weekday: 3, startMin: 480, dauer: 50 },
  ];
  const schueler = [
    { id: 1, einheitenProWoche: 2 },
    { id: 2, einheitenProWoche: 2 },
    { id: 3, einheitenProWoche: 1 },
  ];
  const lehrer = [{ id: 1 }, { id: 2 }];
  const summen = kennzahlen(plaetze, schueler, lehrer, 15);
  assert.equal(summen.einheiten, 3);
  assert.equal(summen.minuten, 250);
  assert.equal(summen.nichtStattgefunden, 1);
  assert.equal(summen.unterBedarf, 2, "Schüler 2 hat bei Bedarf 2 nur einen Platz, Schüler 3 noch keinen");
});

test("kennzahlen: Auslastung misst, wie geschlossen die Lehrertage sind", async () => {
  const { kennzahlen } = await import("./uebersicht");
  const summen = kennzahlen(
    [
      { teacherId: 1, studentId: 1, weekday: 1, startMin: 480, dauer: 100 },
      { teacherId: 1, studentId: 2, weekday: 1, startMin: 590, dauer: 100 },
    ],
    [{ id: 1, einheitenProWoche: 1 }],
    [{ id: 1 }],
    15,
  );
  assert.equal(summen.lueckenMinuten, 10, "10 Minuten Lücke zählen als unnütz");
  assert.equal(summen.auslastung, 95, "200 von 210 Minuten");
  assert.equal(summen.unterBedarf, 0);
  // ohne Plätze ist die Auslastung vollständig
  assert.equal(kennzahlen([], [], [{ id: 1 }]).auslastung, 100);
});
