import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Import der Dokumentation aus einem Formular (D27): eine Zeile je Einheit, Lehrer müssen da sein,
 * fehlende Schüler entstehen ohne Klasse, Mitarbeit als Schulnote, erneuter Import überspringt.
 * Alle Namen und Texte sind erfunden; der Aufbau ist der der Google-Tabelle „Dokumentation 26/27“.
 */
const KOPF =
  "Zeitstempel,Lehrer,Schüler,Datum,Unterrichtsfach,Behandelte Themen,Erteilte Hausaufgaben,Planung für die nächste Einheit,Beobachtung & Fortschritte des Schülers,Mitarbeit & Engagement in dieser Einheit";

const zeile = (z: { lehrer?: string; schueler: string; datum: string; fach?: string; thema?: string; hu?: string; plan?: string; beob?: string; mit?: string }) =>
  [`${z.datum} 18:05:00`, z.lehrer ?? "Niko", z.schueler, z.datum, z.fach ?? "Deutsch", z.thema ?? "Satzglieder", z.hu ?? "", z.plan ?? "", z.beob ?? "Arbeitet konzentriert.", z.mit ?? "1"]
    .map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
    .join(",");

async function setup() {
  const dbm = await import("./db");
  dbm.resetForTests();
  const repo = await import("./repo");
  const auth = await import("./auth");
  const imp = await import("./csv-import");
  const doku = await import("./doku-import");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  const schueler = (name: string, o: Partial<import("./repo").StudentInput> = {}) =>
    repo.createStudent({ name, grade: 7, klasse: 3, teacher_id: null, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ...o });
  const zahl = (sql: string) => (dbm.db().prepare(sql).get() as { n: number }).n;
  return { dbm, repo, imp, doku, niko, thomas, schueler, zahl };
}

test("Vorschau: Spalten des Formulars, Komma-Datei, Fehler je Zeile, neue Schüler und ähnliche Namen", async () => {
  const { imp, doku, niko, schueler, zahl } = await setup();
  schueler("Ben");
  schueler("Leo Beispiel");
  const vorher = zahl("SELECT COUNT(*) AS n FROM lessons");
  const csv = [
    KOPF,
    zeile({ schueler: "Mia", datum: "11.09.2026", fach: "Mathematik, Deutsch", thema: "Brüche, Kürzen", hu: "S. 12 Nr. 3", mit: "2" }),
    zeile({ schueler: "ben", datum: "12.09.2026" }),
    zeile({ schueler: "Leo", datum: "13.09.2026" }),
    zeile({ lehrer: "Gibtsnicht", schueler: "Mia", datum: "14.09.2026" }),
    zeile({ schueler: "Mia", datum: "31.02.2026" }),
    zeile({ schueler: "Mia", datum: "15.09.2026", mit: "7" }),
    zeile({ schueler: "Mia", datum: "20.09.2026" }),
  ].join("\r\n");

  const v = doku.pruefeDokumentation(csv, "2026-09-16");
  assert.equal(v.vorschau.fehler, undefined);
  assert.deepEqual(v.vorschau.spalten, ["Datum", "Lehrer", "Schüler", "Unterrichtsfach", "Behandelte Themen", "Erteilte Hausaufgaben", "Planung für die nächste Einheit", "Beobachtung & Fortschritte", "Mitarbeit & Engagement"]);
  assert.equal(v.vorschau.gesamt, 7);
  assert.equal(v.vorschau.gueltig, 3);
  assert.equal(v.vorschau.fehlerhaft, 4);
  const z = (nr: number) => v.vorschau.zeilen.find((x) => x.zeile === nr)!;
  assert.equal(z(2).beschriftung, "11.09.2026 · Mia · Mathematik, Deutsch · Niko");
  assert.equal(z(2).hinweis, "neuer Schüler, Klasse fehlt");
  assert.equal(z(3).hinweis, undefined, "„ben“ ist der Schüler Ben aus der App");
  assert.equal(z(4).hinweis, "neuer Schüler · ähnlicher Name in der App");
  assert.match(z(5).fehler.join(" "), /Lehrer „Gibtsnicht“ gibt es in der App nicht/);
  assert.match(z(6).fehler.join(" "), /Datum: bitte als TT\.MM\.JJJJ/);
  assert.match(z(7).fehler.join(" "), /Mitarbeit: 1 \(sehr gut\) bis 5/);
  assert.match(z(8).fehler.join(" "), /liegt in der Zukunft/);
  assert.deepEqual(v.vorschau.neueSchueler, [
    { name: "Mia", einheiten: 1, aehnlich: [] },
    { name: "Leo", einheiten: 1, aehnlich: ["Leo Beispiel"] },
  ]);
  assert.equal(v.vorschau.stufeOffen, 2, "zwei neue Schüler ohne Klasse");

  // über den Import: eine Zeile mit Fehler, also wird nichts geschrieben
  const ergebnis = imp.importiere(niko, "dokumentation", csv);
  assert.equal(ergebnis.ok, false);
  assert.equal(zahl("SELECT COUNT(*) AS n FROM lessons"), vorher);
  assert.equal(zahl("SELECT COUNT(*) AS n FROM students"), 2, "auch kein neuer Schüler");
});

test("Import: Einheiten mit allen Feldern, neue Schüler ohne Klasse, Lernstand unverändert, zweiter Import überspringt", async () => {
  const { dbm, repo, imp, niko, thomas, schueler, zahl } = await setup();
  const ben = schueler("Ben");
  const csv = [
    KOPF,
    zeile({ schueler: "Mia", datum: "11.09.2026", fach: "Mathematik, Deutsch", thema: "Brüche kürzen", hu: "S. 12 Nr. 3", plan: "Erweitern üben", beob: "Rechnet sicherer.", mit: "1" }),
    zeile({ lehrer: "Thomas", schueler: "Mia", datum: "12.09.2026", fach: "Englisch", thema: "Simple past", mit: "2" }),
    zeile({ lehrer: "Thomas", schueler: "Mia", datum: "13.09.2026", fach: "Englisch", thema: "Vokabeln", mit: "" }),
    // gleicher Tag, Lehrer und Schüler, aber anderes Fach und Thema: zwei echte Einträge
    zeile({ schueler: "Ben", datum: "12.09.2026", fach: "Deutsch", thema: "Beistrich", mit: "4" }),
    zeile({ schueler: "Ben", datum: "12.09.2026", fach: "Mathematik", thema: "Prozent", mit: "3" }),
    // eine Zelle wie eine Formel bleibt Text
    zeile({ schueler: "Ben", datum: "19.09.2026", thema: "=1+1" }),
  ].join("\n");

  const ergebnis = imp.importiere(niko, "dokumentation", csv);
  assert.equal(ergebnis.ok, true, ergebnis.ok ? "" : ergebnis.fehler);
  assert.equal(ergebnis.ok && ergebnis.angelegt, 6);
  assert.match(ergebnis.ok ? ergebnis.hinweis : "", /6 Einheiten übernommen · 1 neuer Schüler ohne Klasse/);

  const mia = repo.listStudents().find((s) => s.name === "Mia")!;
  assert.equal(mia.klasse, null);
  assert.equal(mia.school_type, "");
  assert.equal(mia.grade, 0);
  assert.equal((dbm.db().prepare("SELECT stufe_status FROM students WHERE id = ?").get(mia.id) as { stufe_status: string }).stufe_status, "unklar");
  assert.equal(mia.teacher_id, thomas.id, "der Lehrer mit den meisten Einheiten");
  assert.deepEqual(mia.subjects, ["Englisch", "Mathematik", "Deutsch"], "die Fächer, das häufigste zuerst");
  assert.deepEqual(repo.getStudent(ben)!.subjects, ["Mathematik"], "ein bestehender Schüler bleibt, wie er war");

  const erste = repo.listLessons(mia.id).find((l) => l.starts_at.startsWith("2026-09-11"))!;
  assert.equal(erste.starts_at, "2026-09-11T00:00");
  assert.equal(erste.duration_min, 0, "Dauer nicht erfasst");
  assert.equal(erste.kind, "stunde");
  assert.equal(erste.status, "abgeschlossen");
  assert.equal(erste.teacher_id, niko.id);
  assert.equal(erste.subject, "Mathematik, Deutsch");
  assert.equal(erste.topic, "Brüche kürzen");
  assert.equal(erste.homework_note, "S. 12 Nr. 3");
  assert.equal(erste.next_steps, "Erweitern üben");
  assert.equal(erste.tutor_notes, "Rechnet sicherer.");
  assert.equal(erste.participation, 5, "Mitarbeit 1 = sehr gut = 5 (sehr aktiv)");
  assert.equal(erste.unit_id, null);
  const mitarbeit = repo.listLessons(mia.id).map((l) => [l.starts_at.slice(0, 10), l.participation]);
  assert.deepEqual(mitarbeit, [["2026-09-13", null], ["2026-09-12", 4], ["2026-09-11", 5]]);
  assert.deepEqual(repo.listLessons(ben).map((l) => l.participation).sort(), [2, 3, 5], "4 → 2, 3 → 3, 1 → 5");
  assert.ok(repo.listLessons(ben).some((l) => l.topic === "=1+1"), "die Formel-Zelle steht als Text da");

  // der Lernstand bleibt, wie er war: keine Beobachtung je Fähigkeit, kein Übungsergebnis
  assert.equal(zahl("SELECT COUNT(*) AS n FROM skill_snapshots"), 0);
  assert.equal(zahl("SELECT COUNT(*) AS n FROM attempts"), 0);
  const { analyzeStudent } = await import("./service");
  assert.ok(analyzeStudent(mia.id)!.skills.every((s) => s.mastery === null), "keine Fähigkeit hat einen Lernstand");

  // das Briefing ohne KI nutzt die letzte Dokumentation, auch die Hausübung daraus
  const { briefingDaten, einfachesBriefing } = await import("./briefing");
  const b = einfachesBriefing(briefingDaten(mia.id, { now: new Date("2026-09-20T08:00:00Z") })!);
  assert.match(b.letzterStand[0], /Englisch: Vokabeln/);

  // dieselbe Datei noch einmal: alles übersprungen, kein neuer Schüler
  const schuelerVorher = zahl("SELECT COUNT(*) AS n FROM students");
  const zweiter = imp.importiere(niko, "dokumentation", csv);
  assert.equal(zweiter.ok && zweiter.angelegt, 0);
  assert.equal(zweiter.ok && zweiter.uebersprungen, 6);
  assert.equal(zahl("SELECT COUNT(*) AS n FROM students"), schuelerVorher);
  assert.equal(zahl("SELECT COUNT(*) AS n FROM lessons"), 6);

  // die weiter geführte Tabelle: nur die neue Zeile kommt dazu
  const laenger = `${csv}\n${zeile({ schueler: "Mia", datum: "20.09.2026", fach: "Englisch", thema: "Wortstellung", hu: "Workbook S. 4" })}`;
  const dritter = imp.importiere(niko, "dokumentation", laenger);
  assert.equal(dritter.ok && dritter.angelegt, 1);
  assert.equal(dritter.ok && dritter.uebersprungen, 6);
  const b2 = einfachesBriefing(briefingDaten(mia.id, { now: new Date("2026-09-21T08:00:00Z") })!);
  assert.ok(b2.letzterStand.includes("Hausübung: Workbook S. 4"));
  assert.ok(b2.plan.some((p) => p.titel === "Hausübung kontrollieren"), "die Hausübung kommt in den Plan");
});

test("Lehrer: Name, Benutzername oder eindeutiger Vorname; zwei gleiche Vornamen sind ein Fehler", async () => {
  const { dbm, doku } = await setup();
  dbm.db().prepare("INSERT INTO teachers (name, username, is_admin, active, password_hash) VALUES ('Eva Muster', 'emuster', 0, 1, 'x')").run();
  const csv = [KOPF, zeile({ lehrer: "Eva", schueler: "Mia", datum: "11.09.2026" }), zeile({ lehrer: "thomas", schueler: "Mia", datum: "12.09.2026" })].join("\n");
  const v = doku.pruefeDokumentation(csv, "2026-10-01");
  assert.equal(v.vorschau.fehlerhaft, 0);
  assert.match(v.vorschau.zeilen[0].beschriftung, /· Eva Muster$/, "der Vorname reicht, wenn ihn nur ein Lehrer hat");

  dbm.db().prepare("INSERT INTO teachers (name, username, is_admin, active, password_hash) VALUES ('Eva Beispiel', 'ebeispiel', 0, 1, 'x')").run();
  const w = doku.pruefeDokumentation(csv, "2026-10-01");
  assert.match(w.vorschau.zeilen[0].fehler.join(" "), /passt auf mehrere Lehrer/);
});

test("ein Schülername, den es in der App zweimal gibt, ist ein Fehler, keine Vermutung", async () => {
  const { doku, schueler } = await setup();
  schueler("Mia");
  schueler("Mia", { klasse: 1, grade: 5 });
  const v = doku.pruefeDokumentation([KOPF, zeile({ schueler: "Mia", datum: "11.09.2026" })].join("\n"), "2026-10-01");
  assert.match(v.vorschau.zeilen[0].fehler.join(" "), /„Mia“ gibt es in der App 2-mal/);
});

test("fehlende Pflichtspalte, leere Datei und ohne Verwaltungsrechte: nichts wird geschrieben", async () => {
  const { imp, niko, thomas, zahl } = await setup();
  assert.match(imp.vorschauImport(niko, "dokumentation", "").fehler ?? "", /leer/);
  assert.match(imp.vorschauImport(niko, "dokumentation", "Zeitstempel,Lehrer,Datum\n").fehler ?? "", /fehlen die Spalten: Schüler/);
  const csv = [KOPF, zeile({ schueler: "Mia", datum: "11.09.2026" })].join("\n");
  assert.match(imp.vorschauImport(thomas, "dokumentation", csv).fehler ?? "", /Verwaltung/);
  assert.equal(imp.importiere(thomas, "dokumentation", csv).ok, false);
  assert.equal(zahl("SELECT COUNT(*) AS n FROM lessons"), 0);
  assert.equal(zahl("SELECT COUNT(*) AS n FROM students"), 0);
});

test("datumAus: deutsches und ISO-Datum, kein erfundener Tag", async () => {
  const { datumAus } = await import("./doku-import");
  assert.equal(datumAus("11.09.2026"), "2026-09-11");
  assert.equal(datumAus("1.9.2026"), "2026-09-01");
  assert.equal(datumAus("2026-09-11"), "2026-09-11");
  assert.equal(datumAus("31.02.2026"), null);
  assert.equal(datumAus("11.09.26"), null);
  assert.equal(datumAus("gestern"), null);
});
