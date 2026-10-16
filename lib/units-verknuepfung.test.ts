import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Die Verknüpfung zwischen einer **Einheit** und ihrem Platz im **Wochenplan** (D16, D17 — Phase 4
 * des Merges): `lib/units.ts` verknüpft beim Start den passenden heutigen veröffentlichten Platz
 * (`geplante_einheiten.unit_id`) und liefert die geplante Dauer für „geplant 100 min · tatsächlich
 * 85 min“. Außerdem: „nicht stattgefunden“ ohne Abrechnungsfolge und die Entscheidung, dass
 * `lessons.status = 'geplant'` als Weg für von Hand geplante Einheiten bestehen bleibt.
 *
 * Die Tests rechnen mit festen Zeitpunkten (Europe/Vienna), damit sie nicht von der Uhr abhängen.
 */
const MONTAG = "2026-10-12";
/** Wiener Zeit ist im Oktober UTC+2: 10:00 UTC = 12:00 in Wien = Minute 720. */
const MONTAG_MITTAG = new Date("2026-10-12T10:00:00Z");

type Planung = typeof import("./planung/repo");
type Units = typeof import("./units");
type Repo = typeof import("./repo");

async function aufbau() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo: Repo = await import("./repo");
  const planung: Planung = await import("./planung/repo");
  const units: Units = await import("./units");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
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
  const raum = planung.createRaum({ building: "Hauptgebäude", name: "Gruppe 1", mode: "vor_ort" });
  return { repo, planung, units, niko, thomas, schueler, raum };
}

/** Ein Platz am Montag; der Aufbau der Tests scheitert laut, wenn er nicht angelegt werden kann. */
function anlegen(planung: Planung, p: { teacherId: number; studentId: number; roomId: number; start: number; dauer: number; weekday?: number }): number {
  const res = planung.legePlatzAn({
    week_start: MONTAG,
    weekday: p.weekday ?? 1,
    start_min: p.start,
    geplante_dauer: p.dauer,
    teacher_id: p.teacherId,
    student_id: p.studentId,
    room_id: p.roomId,
  });
  assert.equal(res.ok, true, res.ok ? "" : res.fehler);
  return res.ok ? res.id : 0;
}

test("ein Start verknüpft den passenden Platz: derselbe Lehrer zuerst, dann die nächste Startzeit", async () => {
  const { planung, units, niko, thomas, schueler, raum } = await aufbau();
  const anna = schueler("Anna", niko.id);
  const frueh = anlegen(planung, { teacherId: niko.id, studentId: anna, roomId: raum, start: 480, dauer: 60 }); // 08:00–09:00, eigener Lehrer
  const mittag = anlegen(planung, { teacherId: thomas.id, studentId: anna, roomId: raum, start: 600, dauer: 60 }); // 10:00–11:00, anderer Lehrer
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);

  // 12:00 Wiener Zeit: der Platz des anderen Lehrers liegt näher (10:00, 120 min) als der eigene
  // (08:00, 240 min). Derselbe Lehrer gewinnt trotzdem (D17) — der andere bleibt frei.
  const { unit, created } = units.startUnit(niko.id, anna, { at: MONTAG_MITTAG.getTime(), subject: "Mathematik" });
  assert.equal(created, true);
  assert.equal(planung.getGeplanteEinheit(frueh)?.unit_id, unit.id, "der Platz des eigenen Lehrers ist verknüpft");
  assert.equal(planung.getGeplanteEinheit(mittag)?.unit_id, null, "der Platz eines anderen Lehrers bleibt frei");

  // genau der Platz, den die Einheitenseite für „geplant … · tatsächlich …“ liest (D16)
  const verknuepft = units.platzFuerEinheit(unit);
  assert.equal(verknuepft?.id, frueh);
  assert.equal(verknuepft?.geplante_dauer, 60);
  assert.equal(verknuepft?.weekday, 1);
  assert.equal(verknuepft?.start_min, 480);
});

test("innerhalb der Plätze desselben Lehrers entscheidet die Startzeit, die jetzt am nächsten liegt", async () => {
  const { planung, units, niko, schueler, raum } = await aufbau();
  const anna = schueler("Anna", niko.id);
  const frueh = anlegen(planung, { teacherId: niko.id, studentId: anna, roomId: raum, start: 480, dauer: 60 }); // 08:00, 240 min entfernt
  const nah = anlegen(planung, { teacherId: niko.id, studentId: anna, roomId: raum, start: 660, dauer: 60 }); // 11:00, 60 min entfernt
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);

  const { unit } = units.startUnit(niko.id, anna, { at: MONTAG_MITTAG.getTime() });
  assert.equal(planung.getGeplanteEinheit(nah)?.unit_id, unit.id, "der nähere Platz des eigenen Lehrers ist verknüpft");
  assert.equal(planung.getGeplanteEinheit(frueh)?.unit_id, null);
});

test("ein zweiter Start verknüpft denselben Platz nicht erneut", async () => {
  const { planung, units, niko, schueler, raum } = await aufbau();
  const anna = schueler("Anna", niko.id);
  const nah = anlegen(planung, { teacherId: niko.id, studentId: anna, roomId: raum, start: 720, dauer: 60 }); // 12:00, 10 min entfernt
  const fern = anlegen(planung, { teacherId: niko.id, studentId: anna, roomId: raum, start: 960, dauer: 60 }); // 16:00
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  const zehnNach = MONTAG_MITTAG.getTime() + 10 * 60_000;

  const erste = units.startUnit(niko.id, anna, { at: zehnNach });
  assert.equal(erste.created, true);
  assert.equal(planung.getGeplanteEinheit(nah)?.unit_id, erste.unit.id);

  // ein zweiter Start, während die erste läuft: nichts wird geschrieben und nichts verknüpft
  const gleichzeitig = units.startUnit(niko.id, anna, { at: zehnNach });
  assert.equal(gleichzeitig.created, false);
  assert.equal(gleichzeitig.unit.id, erste.unit.id);
  assert.equal(planung.getGeplanteEinheit(nah)?.unit_id, erste.unit.id);

  // nach dem Beenden ist der erste Platz vergeben: der zweite Start nimmt den nächsten offenen
  units.finishUnit(erste.unit.id, "beendet", { byTeacherId: niko.id });
  const zweite = units.startUnit(niko.id, anna, { at: zehnNach });
  assert.equal(zweite.created, true);
  assert.notEqual(zweite.unit.id, erste.unit.id);
  assert.equal(planung.getGeplanteEinheit(nah)?.unit_id, erste.unit.id, "der erste Platz bleibt beim ersten Start");
  assert.equal(planung.getGeplanteEinheit(fern)?.unit_id, zweite.unit.id, "der zweite Start bekommt den nächsten offenen Platz");
});

test("ohne offenen Platz läuft die Einheit ungeplant wie bisher", async () => {
  const { planung, units, niko, schueler, raum } = await aufbau();
  const anna = schueler("Anna", niko.id);
  const berta = schueler("Berta", niko.id);
  const frueh = anlegen(planung, { teacherId: niko.id, studentId: anna, roomId: raum, start: 480, dauer: 60 });
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);

  // Berta hat heute keinen Platz: die Einheit entsteht trotzdem, ohne Verknüpfung
  const ohne = units.startUnit(niko.id, berta, { at: MONTAG_MITTAG.getTime() });
  assert.equal(ohne.created, true);
  assert.equal(units.platzFuerEinheit(ohne.unit), null);

  // Anna hat genau einen Platz; nach dem ersten Start ist er vergeben
  const erste = units.startUnit(niko.id, anna, { at: MONTAG_MITTAG.getTime() });
  units.finishUnit(erste.unit.id, "beendet", { byTeacherId: niko.id });
  const zweite = units.startUnit(niko.id, anna, { at: MONTAG_MITTAG.getTime() });
  assert.equal(zweite.created, true);
  assert.equal(units.platzFuerEinheit(zweite.unit), null, "der vergebene Platz wird nicht erneut verknüpft");
  assert.equal(planung.getGeplanteEinheit(frueh)?.unit_id, erste.unit.id);
});

test("ein Platz eines anderen Lehrers kommt nur in Frage, wenn der eigene Lehrer keinen hat", async () => {
  const { planung, units, niko, thomas, schueler, raum } = await aufbau();
  const dora = schueler("Dora", thomas.id);
  const fremderPlatz = anlegen(planung, { teacherId: niko.id, studentId: dora, roomId: raum, start: 480, dauer: 60 });
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);

  const { unit, created } = units.startUnit(thomas.id, dora, { at: MONTAG_MITTAG.getTime() });
  assert.equal(created, true);
  assert.equal(planung.getGeplanteEinheit(fremderPlatz)?.unit_id, unit.id, "ohne eigenen Platz nimmt die Einheit den Platz des anderen Lehrers");
});

test("ein vergangener veröffentlichter Platz ohne Einheit ist „nicht stattgefunden“ — ohne Abrechnungsfolge", async () => {
  const { repo, planung, units, niko, schueler, raum } = await aufbau();
  const anna = schueler("Anna", niko.id);
  const platz = anlegen(planung, { teacherId: niko.id, studentId: anna, roomId: raum, start: 480, dauer: 60 });
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  const zeile = () => planung.getGeplanteEinheit(platz)!;
  const abrechnung = () => repo.billingEntries({ from: "2026-10-01T00:00", to: "2026-11-01T00:00" });
  const vorher = abrechnung();

  // 08:00–09:00 ist um 12:00 vorbei, der Platz hat keine Einheit
  assert.equal(planung.istNichtStattgefunden(zeile(), MONTAG_MITTAG), true);
  assert.deepEqual(planung.nichtStattgefunden(MONTAG, MONTAG_MITTAG).map((z) => z.id), [platz]);

  // es entsteht dabei keine Zeile, die abgerechnet werden könnte: Basis-Dokumentation und
  // Dokumentation bleiben leer, die Abrechnung ist Zeichen für Zeichen dieselbe
  assert.equal(units.listUnits({ studentId: anna }).length, 0);
  assert.equal(repo.listLessons(anna).length, 0);
  assert.deepEqual(abrechnung(), vorher);
  assert.deepEqual(abrechnung(), [], "ohne Einheit gibt es nichts abzurechnen");

  // ein Entwurf ist nie „nicht stattgefunden“
  assert.equal(planung.istNichtStattgefunden({ ...zeile(), status: "entwurf" }, MONTAG_MITTAG), false);

  // startet der Lehrer doch noch, verknüpft sich die Einheit mit dem vergangenen Platz …
  const { unit } = units.startUnit(niko.id, anna, { at: MONTAG_MITTAG.getTime() });
  units.finishUnit(unit.id, "beendet", { byTeacherId: niko.id });
  assert.equal(zeile().unit_id, unit.id);
  assert.equal(planung.istNichtStattgefunden(zeile(), MONTAG_MITTAG), false, "mit Einheit hat der Platz stattgefunden");
  // … und auch eine beendete Einheit ohne Dokumentation ändert an der Abrechnung nichts
  assert.deepEqual(abrechnung(), vorher);
});

test("eine von Hand geplante Einheit (`lessons.status = 'geplant'`) bleibt bestehen und wird von der Einheit übernommen", async () => {
  const { repo, planung, units, niko, schueler, raum } = await aufbau();
  const learning = await import("./learning");
  const { localStamp } = await import("./autodoc");
  const anna = schueler("Anna", niko.id);
  const geplant = repo.saveLesson({
    student_id: anna,
    teacher_id: niko.id,
    starts_at: localStamp(MONTAG_MITTAG.getTime()),
    duration_min: 60,
    subject: "Mathematik",
    topic: "Bruchrechnung",
    status: "geplant",
    activities: "",
    mistakes: "",
    understanding: null,
    tutor_notes: "",
    next_steps: "",
    skill_ids: [],
  });
  const abrechnung = () => repo.billingEntries({ from: "2026-10-01T00:00", to: "2026-11-01T00:00" });
  assert.deepEqual(abrechnung(), [], "eine nur geplante Einheit wird nie abgerechnet");

  const platz = anlegen(planung, { teacherId: niko.id, studentId: anna, roomId: raum, start: 720, dauer: 100 });
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);

  const { unit } = units.startUnit(niko.id, anna, { at: MONTAG_MITTAG.getTime() });
  assert.equal(planung.getGeplanteEinheit(platz)?.unit_id, unit.id, "die Einheit verknüpft sich mit ihrem Platz");
  assert.equal(units.platzFuerEinheit(unit)?.geplante_dauer, 100, "„geplant 100 min“ (D16)");

  learning.endUnit(unit.id, { byTeacherId: niko.id, at: MONTAG_MITTAG.getTime() + 85 * 60_000 });
  const dokumentation = repo.getLessonForUnit(unit.id);
  assert.equal(dokumentation?.id, geplant, "die geplante Zeile wird zur Dokumentation der Einheit, keine zweite Zeile");
  assert.equal(repo.listLessons(anna).length, 1);
  assert.equal(dokumentation?.status, "abgeschlossen");
  assert.deepEqual(abrechnung().map((r) => r.id), [geplant], "abgerechnet wird die abgeschlossene Einheit — wie bisher");
});
