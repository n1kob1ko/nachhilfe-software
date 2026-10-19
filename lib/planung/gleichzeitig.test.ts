import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Zwei Schüler gleichzeitig beim selben Lehrer (D26, docs/planung.md): nur mit dem Haken
 * „gleichzeitig“, höchstens zwei zugleich, auch im selben Raum. Beide Plätze werden gesperrt, damit
 * „Neu generieren“ das Paar stehen lässt; der Generator selbst plant nie zwei zugleich.
 *
 * 2026-10-12 ist ein Montag (Europe/Vienna), 2026-10-19 der Montag der Woche danach.
 */
import type { TagSchluessel } from "./zeit";
import type { Verfuegbarkeit } from "./verfuegbarkeit";

const MONTAG = "2026-10-12";
const NAECHSTE_WOCHE = "2026-10-19";

async function setup() {
  const { resetForTests } = await import("../db");
  resetForTests();
  const repo = await import("../repo");
  const planung = await import("./repo");
  const uebersicht = await import("./uebersicht");
  const auth = await import("../auth");
  const { INITIAL_PASSWORD } = await import("../password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  const verfuegbar = (tage: TagSchluessel[], von = 480, bis = 840): Verfuegbarkeit => {
    const v: Verfuegbarkeit = {};
    for (const tag of tage) v[tag] = [{ start: von, end: bis }];
    return v;
  };
  const schueler = (name: string) =>
    repo.createStudent({
      name,
      grade: 6,
      klasse: 2,
      teacher_id: niko.id,
      school: "",
      school_type: "Mittelschule",
      subjects: ["Mathematik"],
      current_topics: "",
      strengths_note: "",
      weaknesses_note: "",
      goals: "",
      notes: "",
    });
  const raum = (name: string) => planung.createRaum({ building: "Hauptgebäude", name, mode: "vor_ort" });
  const basis = { week_start: MONTAG, weekday: 1, geplante_dauer: 100, teacher_id: niko.id };
  return { planung, uebersicht, niko, thomas, verfuegbar, schueler, raum, basis };
}

test("ohne Haken abgelehnt mit Hinweis, mit Haken erlaubt (auch im selben Raum), beide Plätze gesperrt", async () => {
  const { planung, niko, thomas, schueler, raum, basis } = await setup();
  const anna = schueler("Anna");
  const berta = schueler("Berta");
  const carla = schueler("Carla");
  const r1 = raum("Gruppe 1");
  const r2 = raum("Gruppe 2");

  const a = planung.legePlatzAn({ ...basis, start_min: 480, student_id: anna, room_id: r1 });
  assert.equal(a.ok, true);
  assert.equal(a.ok && a.hinweis, undefined, "ein einzelner Platz bekommt keinen Hinweis");
  const aId = a.ok ? a.id : 0;

  // 09:00–10:40 überschneidet 08:00–09:40: ohne Haken wie bisher abgelehnt, jetzt mit dem Weg dazu
  const ohne = planung.legePlatzAn({ ...basis, start_min: 540, student_id: berta, room_id: r1 });
  assert.equal(ohne.ok, false);
  assert.match(ohne.ok === false ? ohne.fehler : "", /^Lehrer Niko ist am Montag 08:00–09:40 schon verplant\. .*Haken „Gleichzeitig mit einem anderen Schüler“/);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 1);

  // mit Haken: erlaubt, im selben Raum, und beide sind danach gesperrt
  const b = planung.legePlatzAn({ ...basis, start_min: 540, student_id: berta, room_id: r1, gleichzeitig: true });
  assert.equal(b.ok, true);
  const bId = b.ok ? b.id : 0;
  assert.match(b.ok ? b.hinweis ?? "" : "", /Gleichzeitig mit Anna\. Beide Plätze sind gesperrt/);
  assert.equal(planung.getGeplanteEinheit(bId)!.gleichzeitig, 1);
  assert.equal(planung.getGeplanteEinheit(bId)!.locked, 1);
  assert.equal(planung.getGeplanteEinheit(aId)!.locked, 1, "der Partner ist auch gesperrt");
  assert.equal(planung.getGeplanteEinheit(aId)!.gleichzeitig, 0, "der Haken bleibt beim Platz, an dem er gesetzt wurde");

  // ein dritter zur selben Zeit geht nie, auch mit Haken und in einem anderen Raum
  const dritter = planung.legePlatzAn({ ...basis, start_min: 560, student_id: carla, room_id: r2, gleichzeitig: true });
  assert.equal(dritter.ok, false);
  assert.equal(dritter.ok === false ? dritter.fehler : "", "Lehrer Niko hat am Montag 09:20–09:40 schon zwei Schüler gleichzeitig. Mehr als zwei gehen nicht.");

  // derselbe Schüler zweimal bleibt verboten, auch beim selben Lehrer mit Haken
  const doppelt = planung.legePlatzAn({ ...basis, start_min: 600, geplante_dauer: 30, student_id: berta, room_id: r2, gleichzeitig: true });
  assert.equal(doppelt.ok, false);
  assert.match(doppelt.ok === false ? doppelt.fehler : "", /^Berta hat am Montag 09:00–10:40 schon eine geplante Einheit\.$/);

  // ein anderer Lehrer im selben Raum zur selben Zeit bleibt verboten
  const fremd = planung.legePlatzAn({ ...basis, teacher_id: thomas.id, start_min: 540, student_id: carla, room_id: r1 });
  assert.equal(fremd.ok, false);
  assert.match(fremd.ok === false ? fremd.fehler : "", /^Raum Gruppe 1 ist am Montag 08:00–09:40 schon belegt\.$/);

  // 09:40–11:20: Anna ist dann fertig, Berta noch da — wieder höchstens zwei zugleich, also erlaubt
  const danach = planung.legePlatzAn({ ...basis, start_min: 580, student_id: carla, room_id: r2, gleichzeitig: true });
  assert.equal(danach.ok, true);
  assert.equal(planung.einheitenFuerWoche(MONTAG).length, 3);
});

test("Verschieben behält den Haken; ihn wegnehmen geht nur, wenn sich nichts mehr überschneidet", async () => {
  const { planung, schueler, raum, basis } = await setup();
  const anna = schueler("Anna");
  const berta = schueler("Berta");
  const r1 = raum("Gruppe 1");
  const a = planung.legePlatzAn({ ...basis, start_min: 480, student_id: anna, room_id: r1 });
  const b = planung.legePlatzAn({ ...basis, start_min: 480, student_id: berta, room_id: r1, gleichzeitig: true });
  assert.ok(a.ok && b.ok);
  const aId = a.ok ? a.id : 0;
  const bId = b.ok ? b.id : 0;

  // Anna (ohne Haken) um 10 Minuten verschieben: ihr Partner trägt den Haken, also erlaubt
  const verschoben = planung.aenderePlatz(aId, { start_min: 490 });
  assert.equal(verschoben.ok, true);
  assert.match(verschoben.ok ? verschoben.hinweis ?? "" : "", /^Platz gespeichert\. Gleichzeitig mit Berta\./);
  // Ziehen fragt dieselbe Prüfung: mit dem gespeicherten Haken ok, ohne nicht
  assert.equal(planung.pruefeUeberlappung({ ...basis, start_min: 500, student_id: berta, room_id: r1, gleichzeitig: true, ausserId: bId }).ok, true);
  assert.equal(planung.pruefeUeberlappung({ ...basis, start_min: 500, student_id: berta, room_id: r1, ausserId: bId }).ok, false);

  // den Haken wegnehmen, solange beide zugleich sind: abgelehnt, nichts geändert
  const weg = planung.aenderePlatz(bId, { gleichzeitig: false });
  assert.equal(weg.ok, false);
  assert.match(weg.ok === false ? weg.fehler : "", /schon verplant/);
  assert.equal(planung.getGeplanteEinheit(bId)!.gleichzeitig, 1);
  // erst auseinanderschieben, dann geht es
  assert.equal(planung.aenderePlatz(bId, { start_min: 600 }).ok, true);
  const jetzt = planung.aenderePlatz(bId, { gleichzeitig: false });
  assert.equal(jetzt.ok, true);
  assert.equal(jetzt.ok ? jetzt.hinweis : "", "Platz gespeichert.");
  assert.equal(planung.getGeplanteEinheit(bId)!.gleichzeitig, 0);
});

test("Neu generieren lässt das Paar stehen und plant keinen dritten dazu; Vorwoche übernimmt Haken und Sperre", async () => {
  const { planung, niko, verfuegbar, schueler, raum, basis } = await setup();
  planung.setLehrerVerfuegbarkeit(niko.id, verfuegbar(["1"], 480, 840));
  const anna = schueler("Anna");
  const berta = schueler("Berta");
  const carla = schueler("Carla");
  for (const sid of [anna, berta, carla])
    planung.setSchuelerPlanung(sid, { availability: verfuegbar(["1"], 480, 840), einheiten_pro_woche: 1, geplante_dauer: 100, modus_wunsch: "egal", erlaubte_lehrer: [niko.id] });
  const r1 = raum("Gruppe 1");
  const a = planung.legePlatzAn({ ...basis, start_min: 480, student_id: anna, room_id: r1 });
  const b = planung.legePlatzAn({ ...basis, start_min: 480, student_id: berta, room_id: r1, gleichzeitig: true });
  assert.ok(a.ok && b.ok);

  const lauf = planung.neuGenerieren(MONTAG, { seed: 1 });
  assert.equal(lauf.ok, true);
  const woche = planung.einheitenFuerWoche(MONTAG);
  assert.equal(woche.length, 3);
  assert.ok(woche.some((z) => z.id === (a.ok ? a.id : 0)) && woche.some((z) => z.id === (b.ok ? b.id : 0)), "das Paar steht noch");
  const neu = woche.find((z) => z.student_id === carla)!;
  assert.ok(neu.start_min >= 580, `Carla liegt nach dem Paar, nicht als dritte daneben (Start ${neu.start_min})`);
  assert.equal(neu.gleichzeitig, 0);
  assert.equal(neu.locked, 0);

  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  const kopie = planung.uebernimmVorwoche(NAECHSTE_WOCHE);
  assert.equal(kopie.ok, true);
  const naechste = planung.einheitenFuerWoche(NAECHSTE_WOCHE);
  const nach = (sid: number) => naechste.find((z) => z.student_id === sid)!;
  assert.equal(nach(berta).gleichzeitig, 1, "der Haken kommt mit");
  assert.equal(nach(berta).locked, 1, "das Paar kommt gesperrt mit, sonst löste „Neu generieren“ es auf");
  assert.equal(nach(anna).locked, 1);
  assert.equal(nach(carla).locked, 0, "alle anderen bleiben ein Vorschlag ohne Sperre (D24)");
});

test("Wochenübersicht: Partner beim Namen, Lehrerzeit und Lücken zählen das Paar einmal", async () => {
  const { planung, uebersicht, niko, schueler, raum, basis } = await setup();
  const anna = schueler("Anna");
  const berta = schueler("Berta");
  const carla = schueler("Carla");
  const r1 = raum("Gruppe 1");
  // Anna 08:00–10:00, Berta 08:20–09:00 dazu, Carla 10:10–11:50: der Lehrer ist 08:00–10:00 und 10:10–11:50 belegt
  assert.equal(planung.legePlatzAn({ ...basis, start_min: 480, geplante_dauer: 120, student_id: anna, room_id: r1 }).ok, true);
  assert.equal(planung.legePlatzAn({ ...basis, start_min: 500, geplante_dauer: 40, student_id: berta, room_id: r1, gleichzeitig: true }).ok, true);
  assert.equal(planung.legePlatzAn({ ...basis, start_min: 610, student_id: carla, room_id: r1 }).ok, true);

  const sicht = uebersicht.wochenUebersicht(MONTAG);
  const platz = (name: string) => sicht.plaetze.find((p) => p.studentName === name)!;
  assert.deepEqual(platz("Anna").zugleichMit, ["Berta"]);
  assert.deepEqual(platz("Berta").zugleichMit, ["Anna"]);
  assert.deepEqual(platz("Carla").zugleichMit, []);
  assert.equal(platz("Berta").gleichzeitig, true);
  assert.equal(platz("Anna").gleichzeitig, false);

  const lehrer = sicht.lehrer.find((l) => l.id === niko.id)!;
  assert.equal(lehrer.einheiten, 3);
  assert.equal(lehrer.minuten, 220, "120 + 100 Minuten Lehrerzeit, Bertas 40 Minuten liegen in Annas Zeit");
  assert.deepEqual(sicht.luecken, [{ teacherId: niko.id, weekday: 1, start: 600, end: 610 }], "die Lücke ist 10 Minuten nach Annas Ende, nicht nach Bertas");
  assert.equal(sicht.summen.minuten, 260, "die Summe aller Plätze zählt jeden Schüler");
});

test("zusammenfassen und belegteMinuten (reine Rechnung)", async () => {
  const { zusammenfassen, belegteMinuten } = await import("./generator");
  assert.deepEqual(
    zusammenfassen([
      { start: 600, end: 700 },
      { start: 480, end: 600 },
      { start: 500, end: 540 },
    ]),
    [
      { start: 480, end: 600 },
      { start: 600, end: 700 },
    ],
    "berühren ist keine Überschneidung",
  );
  assert.equal(
    belegteMinuten([
      { weekday: 1, start: 480, end: 580 },
      { weekday: 1, start: 480, end: 580 },
      { weekday: 2, start: 480, end: 580 },
    ]),
    200,
  );
  assert.equal(belegteMinuten([]), 0);
});
