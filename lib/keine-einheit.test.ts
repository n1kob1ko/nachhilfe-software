/**
 * „Keine Einheit“ statt „nicht stattgefunden“ (Audit 2026-11-07): ein vergangener veröffentlichter Platz ohne Einheit
 * heißt so auf Heute, im Profil und in Meine Woche, in der Schüler-App steht nichts. „Nachtragen“ führt zum Formular mit
 * Datum, Uhrzeit und Dauer; eine von Hand dokumentierte Einheit an dem Tag macht den Platz zu „gehalten“.
 * 2026-10-12 ist ein Montag; die Uhr steht fest. Erfundene Namen.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const MONTAG = "2026-10-12";
/** Montag 14:00 in Wien (UTC+2) */
const MONTAG_NACHMITTAG = new Date("2026-10-12T12:00:00Z");

test("Platz ohne Einheit: „keine Einheit“ überall, nach dem Nachtragen gehalten", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const planung = await import("./planung/repo");
  const heute = await import("./heute");
  const { meineWoche } = await import("./dashboard");
  const { termineFuerSchueler } = await import("./planung/schueler-termine");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const anna = repo.createStudent({
    name: "Anna Beispiel", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const raum = planung.createRaum({ building: "Haus A", name: "Raum 1", mode: "vor_ort" });
  const r = planung.legePlatzAn({ week_start: MONTAG, weekday: 1, start_min: 480, geplante_dauer: 100, teacher_id: niko.id, student_id: anna, room_id: raum, status: "veroeffentlicht" });
  assert.ok(r.ok);
  const platzId = r.ok ? r.id : 0;
  const platz = () => planung.getGeplanteEinheit(platzId)!;

  // Montag 14:00: der Platz 08:00–09:40 ist vorbei und hat keine Einheit
  assert.equal(planung.istNichtStattgefunden(platz(), MONTAG_NACHMITTAG), true);
  const punkt = heute.tagesplan(niko.id, MONTAG_NACHMITTAG).find((p) => p.platzId === platzId)!;
  assert.equal(punkt.nichtStattgefunden, true);
  assert.equal(punkt.erledigt, false);
  assert.equal(heute.offen(punkt), false, "vorbei: nicht mehr „Einheit starten“");
  const woche1 = meineWoche(niko.id, MONTAG_NACHMITTAG);
  assert.equal(woche1.plan[0].eintraege[0].stand, "ausgefallen", "Anzeige „keine Einheit“");
  // die Kennzahl „Diese Woche“ zählt dieselben Termine wie der Plan (Audit 2026-11-07)
  assert.deepEqual({ termine: woche1.termine, gehalten: woche1.gehalten, geplant: woche1.geplant, ohneEinheit: woche1.ohneEinheit }, { termine: 1, gehalten: 0, geplant: 0, ohneEinheit: 1 });
  assert.equal(termineFuerSchueler(anna, MONTAG_NACHMITTAG).wochen[0].termine[0].nichtStattgefunden, true);
  assert.equal(heute.nachtragenHref(anna, MONTAG, 480, 100), `/schueler/${anna}/stunden/neu?datum=2026-10-12&start=480&dauer=100`);

  // Nachtragen: eine von Hand dokumentierte Einheit an dem Tag (das Formular „Einheit nachtragen“)
  const lessonId = repo.saveLesson({ student_id: anna, teacher_id: niko.id, starts_at: "2026-10-12T08:00", duration_min: 100, subject: "Mathematik", topic: "Brüche", status: "abgeschlossen", activities: "Brüche kürzen", mistakes: "", understanding: 3, tutor_notes: "", next_steps: "", skill_ids: [] });
  assert.equal(planung.nachgetragenAm(anna, MONTAG), lessonId);
  assert.equal(planung.nachgetragenAm(anna, "2026-10-13"), null);
  assert.equal(planung.istNichtStattgefunden(platz(), MONTAG_NACHMITTAG), false, "gehalten, nur nicht in der App");
  assert.deepEqual(planung.nichtStattgefunden(MONTAG, MONTAG_NACHMITTAG), []);
  const danach = heute.tagesplan(niko.id, MONTAG_NACHMITTAG).find((p) => p.platzId === platzId)!;
  assert.equal(danach.nichtStattgefunden, false);
  assert.equal(danach.erledigt, true, "auf Heute: erledigt");
  assert.equal(heute.offen(danach), false);
  const woche2 = meineWoche(niko.id, MONTAG_NACHMITTAG);
  assert.equal(woche2.plan[0].eintraege[0].stand, "gehalten");
  assert.deepEqual({ termine: woche2.termine, gehalten: woche2.gehalten, ohneEinheit: woche2.ohneEinheit }, { termine: 1, gehalten: 1, ohneEinheit: 0 });
  assert.equal(termineFuerSchueler(anna, MONTAG_NACHMITTAG).wochen[0].termine[0].nichtStattgefunden, false);

  // eine geplante oder abgesagte Zeile zählt nicht als nachgetragen
  repo.saveLesson({ ...repo.getLesson(lessonId)!, status: "abgesagt" }, lessonId);
  assert.equal(planung.nachgetragenAm(anna, MONTAG), null);
  assert.equal(planung.istNichtStattgefunden(platz(), MONTAG_NACHMITTAG), true);
});
