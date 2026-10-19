import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/** Die Termine in der Schüler-App: diese und die nächste Woche, nur veröffentlicht, mit dem nächsten Termin oben. */
const MONTAG = "2031-03-03";
const NAECHSTER_MONTAG = "2031-03-10";
/** Wiener Zeit ist im März UTC+1: Mittwoch 15:00 UTC = 16:00 in Wien = Minute 960. */
const MITTWOCH_16 = new Date("2031-03-05T15:00:00Z");

async function setup() {
  const { resetForTests } = await import("../db");
  resetForTests();
  const repo = await import("../repo");
  const planung = await import("./repo");
  const auth = await import("../auth");
  const { INITIAL_PASSWORD } = await import("../password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const schueler = (name: string) =>
    repo.createStudent({ name, grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const platz = (week_start: string, studentId: number, weekday: number, start_min: number, geplante_dauer: number, room_id: number | null) => {
    const r = planung.legePlatzAn({ week_start, weekday, start_min, geplante_dauer, teacher_id: niko.id, student_id: studentId, room_id });
    assert.equal(r.ok, true, r.ok ? "" : r.fehler);
    return r.ok ? r.id : 0;
  };
  return { planung, schueler, platz };
}

test("Schüler-App: Termine dieser Woche, der nächste oben, ohne Entwürfe und ohne andere Schüler", async () => {
  const { planung, schueler, platz } = await setup();
  const anna = schueler("Anna Probe");
  const berta = schueler("Berta Probe");
  const raum = planung.createRaum({ building: "Hauptgebäude", name: "Raum B", mode: "vor_ort" });
  const online = planung.createRaum({ building: "Online", name: "Zoom 1", mode: "online" });
  const montag = platz(MONTAG, anna, 1, 930, 100, raum); // vorbei
  const mittwoch = platz(MONTAG, anna, 3, 930, 100, online); // 15:30–17:10, läuft um 16:00
  const freitag = platz(MONTAG, anna, 5, 1030, 50, null);
  platz(MONTAG, berta, 2, 930, 100, raum);
  assert.equal(planung.veroeffentlicheWoche(MONTAG).ok, true);
  platz(NAECHSTER_MONTAG, anna, 1, 930, 100, raum); // nur Entwurf

  const { termineFuerSchueler } = await import("./schueler-termine");
  const { naechster, wochen } = termineFuerSchueler(anna, MITTWOCH_16);
  assert.equal(wochen.length, 1, "die nächste Woche ist nur Entwurf: sie fehlt");
  assert.equal(wochen[0].titel, "Diese Woche");
  assert.deepEqual(wochen[0].termine.map((t) => t.id), [montag, mittwoch, freitag], "nur Annas Termine, nach Tag und Zeit");
  const [mo, mi, fr] = wochen[0].termine;
  assert.equal(mo.vorbei, true);
  assert.equal(mo.nichtStattgefunden, true, "veröffentlicht, ohne Einheit und vorbei");
  assert.equal(mo.ort, "Raum B · Hauptgebäude");
  assert.equal(mi.zeit, "15:30–17:10");
  assert.equal(mi.ort, "Zoom 1", "„Online“ als Gebäude steht nicht doppelt da");
  assert.equal(mi.online, true);
  assert.equal(mi.heute, true);
  assert.equal(mi.jetzt, true);
  assert.equal(mi.vorbei, false);
  assert.equal(fr.ort, "Raum noch offen");
  assert.equal(fr.raumOffen, true, "ohne Raum ist auch online oder vor Ort offen");
  assert.equal(mi.raumOffen, false);
  assert.equal(naechster?.id, mittwoch, "der laufende Termin ist der nächste");
  assert.equal(JSON.stringify(wochen).includes("Probe"), false, "keine Namen in den Terminen");
  assert.equal(JSON.stringify(wochen).includes("Niko"), false, "auch nicht der Lehrer");

  assert.equal(planung.veroeffentlicheWoche(NAECHSTER_MONTAG).ok, true);
  const spaeter = termineFuerSchueler(anna, new Date("2031-03-08T20:00:00Z")); // Samstag 21:00
  assert.deepEqual(spaeter.wochen.map((w) => w.titel), ["Diese Woche", "Nächste Woche"]);
  assert.equal(spaeter.naechster?.datum, NAECHSTER_MONTAG, "am Wochenende ist der nächste Termin in der nächsten Woche");
  assert.equal(termineFuerSchueler(berta, MITTWOCH_16).naechster, null, "Bertas Termin am Dienstag ist vorbei");
});
