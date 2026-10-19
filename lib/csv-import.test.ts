import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * CSV-Import der Phase 7 (D14): zwei Schritte (Vorschau → Bestätigen), nur die Verwaltung (D23),
 * Zeilenprüfung mit zod, Dubletten je Name **und** Klasse, frische Zugangslinks, Startpasswort für
 * neue Lehrer — und Zellen, die mit `=`, `+`, `-` oder `@` beginnen, bleiben Text.
 *
 * Geprüft wird an den echten Funktionen aus `lib/csv-import.ts`, nicht an einer Nachbildung.
 */
type Zeile = { ki_hinweise: string; einheiten_pro_woche: number; geplante_dauer: number; modus_wunsch: string; access_token: string };

async function setup() {
  const dbm = await import("./db");
  dbm.resetForTests();
  const repo = await import("./repo");
  const auth = await import("./auth");
  const imp = await import("./csv-import");
  const planung = await import("./planung/repo");
  const { INITIAL_PASSWORD, verifyPassword } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const thomas = auth.checkLogin("thomas", INITIAL_PASSWORD)!;
  assert.equal(niko.is_admin, 1, "Niko ist die Verwaltung");
  assert.equal(thomas.is_admin, 0, "Thomas ist Lehrer ohne Verwaltungsrechte");
  const zeile = (id: number) => dbm.db().prepare("SELECT ki_hinweise, einheiten_pro_woche, geplante_dauer, modus_wunsch, access_token FROM students WHERE id = ?").get(id) as Zeile;
  const anzahl = () => (dbm.db().prepare("SELECT COUNT(*) AS n FROM students").get() as { n: number }).n;
  return { dbm, repo, auth, imp, planung, niko, thomas, INITIAL_PASSWORD, verifyPassword, zeile, anzahl };
}

const SCHUELER_KOPF = "Name;Schultyp;Klasse;Schule;Fächer;Lehrer;Einheiten pro Woche;Geplante Dauer;Modus";

test("Umlauf: der CSV-Export der Demo-Daten kommt in einer leeren Datenbank unverändert zurück", async () => {
  const dbm = await import("./db");
  dbm.resetForTests();
  const { seedDemo } = await import("./demo");
  seedDemo();
  const vorherRepo = await import("./repo");
  const { datasetCsv } = await import("./exports");
  const csv = datasetCsv("schueler")!.body;

  // den Stand vor dem Umlauf festhalten (Lehrer über den Benutzernamen, nicht über die Id)
  const zeile = (id: number) => dbm.db().prepare("SELECT ki_hinweise, einheiten_pro_woche, geplante_dauer, modus_wunsch, access_token FROM students WHERE id = ?").get(id) as Zeile;
  const vorher = vorherRepo.listStudents().map((s) => ({
    name: s.name,
    klasse: s.klasse,
    school_type: s.school_type,
    grade: s.grade,
    school: s.school,
    subjects: s.subjects,
    lehrer: vorherRepo.getTeacher(s.teacher_id)?.username ?? null,
    planung: zeile(s.id),
  }));
  assert.equal(vorher.length, 4, "die Demo-Daten haben vier Schüler");
  assert.ok(vorher.some((v) => v.planung.ki_hinweise), "und mindestens einer hat KI-Hinweise");

  // frische, leere Datenbank: dieselben zwei Lehrer, aber kein einziger Schüler
  dbm.resetForTests();
  const { repo, auth, imp, INITIAL_PASSWORD } = await setup();
  assert.equal(repo.listStudents().length, 0, "die neue Datenbank ist leer");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;

  const vorschau = imp.vorschauImport(niko, "schueler", csv);
  assert.equal(vorschau.fehler, undefined, "die Datei passt");
  assert.equal(vorschau.fehlerhaft, 0, "keine Zeile hat einen Fehler");
  assert.equal(vorschau.gueltig, 4, "alle vier Schüler würden angelegt");
  assert.equal(repo.listStudents().length, 0, "die Vorschau schreibt nichts");

  const ergebnis = imp.importiere(niko, "schueler", csv);
  assert.equal(ergebnis.ok, true, ergebnis.ok ? "" : ergebnis.fehler);
  assert.equal(ergebnis.ok && ergebnis.angelegt, 4);

  const nachher = repo.listStudents();
  assert.equal(nachher.length, 4);
  for (const alt of vorher) {
    const neu = nachher.find((s) => s.name === alt.name);
    assert.ok(neu, `${alt.name} ist wieder da`);
    assert.equal(neu.klasse, alt.klasse, `${alt.name}: Klasse`);
    assert.equal(neu.school_type, alt.school_type, `${alt.name}: Schultyp`);
    assert.equal(neu.grade, alt.grade, `${alt.name}: Schulstufe`);
    assert.equal(neu.school, alt.school, `${alt.name}: Schule`);
    assert.deepEqual(neu.subjects, alt.subjects, `${alt.name}: Fächer`);
    assert.equal(repo.getTeacher(neu.teacher_id)?.username ?? null, alt.lehrer, `${alt.name}: Lehrer`);
    assert.equal(neu.ki_hinweise, alt.planung.ki_hinweise, `${alt.name}: KI-Hinweise`);
    assert.equal(neu.stufe_status, "eindeutig", `${alt.name}: Schulstufe ist eindeutig`);
    assert.ok(neu.access_token && neu.access_token !== alt.planung.access_token, `${alt.name}: frischer Zugangslink`);
    const planung = dbm.db().prepare("SELECT einheiten_pro_woche, geplante_dauer, modus_wunsch FROM students WHERE id = ?").get(neu.id) as Zeile;
    assert.equal(planung.einheiten_pro_woche, alt.planung.einheiten_pro_woche, `${alt.name}: Einheiten pro Woche`);
    assert.equal(planung.geplante_dauer, alt.planung.geplante_dauer, `${alt.name}: geplante Dauer`);
    assert.equal(planung.modus_wunsch, alt.planung.modus_wunsch, `${alt.name}: Modus`);
  }
});

test("Vorschau: Zeilenfehler nach zod, Dubletten nach Name und Klasse — und nichts wird geschrieben", async () => {
  const { repo, imp, niko, anzahl } = await setup();
  repo.createStudent({
    name: "Doppelt In Der Datenbank", grade: 5, klasse: 2, teacher_id: null, school: "", school_type: "Volksschule",
    subjects: [], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const vorher = anzahl();

  const csv = [
    SCHUELER_KOPF,
    "Anna Beispiel;Mittelschule;2;MS Test;Mathematik;niko;2;90;vor Ort",
    "Kaputte Klasse;Mittelschule;9;MS Test;Mathematik;niko;2;90;egal",
    ";Mittelschule;2;MS Test;Mathematik;niko;;;",
    "Ohne Schultyp;;2;MS Test;Mathematik;niko;;;",
    "Falsche Dauer;Gymnasium;3;BRG Test;Deutsch;niko;2;500;egal",
    "Unbekannter Lehrer;Volksschule;1;VS Test;Deutsch;gibtsnicht;1;60;egal",
    "Anna Beispiel;Mittelschule;2;MS Test;Mathematik;niko;2;90;vor Ort",
    "Doppelt In Der Datenbank;Volksschule;2;VS Test;Deutsch;niko;1;60;egal",
  ].join("\r\n") + "\r\n";

  const v = imp.vorschauImport(niko, "schueler", csv);
  assert.equal(v.fehler, undefined);
  assert.equal(v.gesamt, 8);
  assert.equal(v.fehlerhaft, 4, "vier Zeilen haben Fehler");
  assert.equal(v.dubletten, 2, "eine Dublette in der Datei, eine in der Datenbank");
  assert.equal(v.gueltig, 2, "zwei Zeilen würden angelegt, eine davon ohne Schultyp");
  assert.equal(v.stufeOffen, 1, "die ohne Schultyp hat noch keine eindeutige Schulstufe");
  assert.ok(v.spalten.includes("Name") && v.spalten.includes("Geplante Dauer"), "die erkannten Spalten stehen in der Vorschau");

  const zeile = (nr: number) => v.zeilen.find((z) => z.zeile === nr)!;
  assert.match(zeile(3).fehler.join(" "), /Klasse fehlt oder passt nicht zu Mittelschule/);
  assert.match(zeile(4).fehler.join(" "), /Name fehlt/);
  assert.deepEqual(zeile(5).fehler, [], "ein leerer Schultyp ist kein Fehler mehr");
  assert.equal(zeile(5).hinweis, "Schulart fehlt");
  assert.match(zeile(6).fehler.join(" "), /Geplante Dauer: bitte eine ganze Zahl zwischen 1 und 300 angeben/);
  assert.match(zeile(7).fehler.join(" "), /Lehrer „gibtsnicht“ ist unbekannt/);
  assert.equal(zeile(8).dublette, "datei", "die zweite Zeile mit demselben Namen und derselben Klasse");
  assert.equal(zeile(9).dublette, "datenbank", "diesen Schüler gibt es schon");
  assert.equal(zeile(2).dublette, "", "die erste Zeile ist neu");

  assert.equal(anzahl(), vorher, "die Vorschau hat nichts geschrieben");

  // auch die Bestätigung schreibt nichts, solange eine Zeile einen Fehler hat
  const ergebnis = imp.importiere(niko, "schueler", csv);
  assert.equal(ergebnis.ok, false);
  assert.match(ergebnis.ok ? "" : ergebnis.fehler, /nichts geschrieben/);
  assert.equal(anzahl(), vorher, "auch die Bestätigung hat nichts geschrieben");
});

test("Import: gültige Zeilen werden angelegt, Dubletten übersprungen, Zugangslinks sind frisch", async () => {
  const { repo, imp, niko, anzahl } = await setup();
  repo.createStudent({
    name: "Schon Da", grade: 5, klasse: 2, teacher_id: null, school: "", school_type: "Volksschule",
    subjects: [], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const csv = [SCHUELER_KOPF, "Neu Eins;Mittelschule;3;MS Test;Mathematik, Englisch;niko;3;120;online", "Schon Da;Volksschule;2;VS Test;Deutsch;niko;1;60;egal"].join("\n");
  const ergebnis = imp.importiere(niko, "schueler", csv);
  assert.equal(ergebnis.ok, true);
  assert.equal(ergebnis.ok && ergebnis.angelegt, 1);
  assert.equal(ergebnis.ok && ergebnis.uebersprungen, 1);
  assert.equal(anzahl(), 2);

  const neu = repo.listStudents().find((s) => s.name === "Neu Eins")!;
  assert.deepEqual(neu.subjects, ["Mathematik", "Englisch"], "Fächer werden getrennt");
  assert.equal(neu.teacher_id, niko.id, "der Lehrer wird über den Benutzernamen gefunden");
  assert.match(neu.access_token, /^[A-Za-z0-9_-]{12}$/, "frischer Zugangslink");
  assert.equal(new Set(repo.listStudents().map((s) => s.access_token)).size, 2, "jeder Schüler hat einen eigenen Link");
  const planung = (await import("./planung/repo")).getSchuelerPlanung(neu.id)!;
  assert.equal(planung.einheiten_pro_woche, 3);
  assert.equal(planung.geplante_dauer, 120);
  assert.equal(planung.modus_wunsch, "online");
});

test("Lehrer: neue Konten bekommen must_change_password und das Startpasswort (nie im Klartext)", async () => {
  const { dbm, auth, imp, niko, INITIAL_PASSWORD, verifyPassword } = await setup();
  const csv = ["Name;Benutzername;Verwaltung;Aktiv", "Eva Neu;Eva;ja;ja", "Eva Neu;eva2;nein;ja", "Tom Lehrer;Tom;nein;ja", "Niko;niko;ja;ja"].join("\n");
  const v = imp.vorschauImport(niko, "lehrer", csv);
  assert.equal(v.fehler, undefined);
  assert.equal(v.gueltig, 2);
  assert.equal(v.dubletten, 2, "derselbe Name in der Datei und ein Konto, das es schon gibt");
  assert.equal(v.zeilen.find((z) => z.zeile === 3)!.dublette, "datei", "der Name ist in teachers eindeutig");
  assert.equal(v.zeilen.find((z) => z.zeile === 5)!.dublette, "datenbank");

  const ergebnis = imp.importiere(niko, "lehrer", csv);
  assert.equal(ergebnis.ok, true);
  assert.equal(ergebnis.ok && ergebnis.angelegt, 2);
  assert.equal(ergebnis.ok && ergebnis.uebersprungen, 2);

  const eva = dbm.db().prepare("SELECT name, username, is_admin, active, password_hash, must_change_password FROM teachers WHERE username = 'eva'").get() as {
    name: string; username: string; is_admin: number; active: number; password_hash: string; must_change_password: number;
  };
  assert.equal(eva.name, "Eva Neu");
  assert.equal(eva.is_admin, 1, "Verwaltung aus der Datei");
  assert.equal(eva.active, 1);
  assert.equal(eva.must_change_password, 1, "das Startpasswort muss beim ersten Login geändert werden");
  assert.match(eva.password_hash, /^scrypt\$/, "gehasht, nie im Klartext");
  assert.notEqual(eva.password_hash, INITIAL_PASSWORD);
  assert.equal(verifyPassword(INITIAL_PASSWORD, eva.password_hash), true, "das Startpasswort der Installation gilt");
  assert.equal(auth.checkLogin("eva", INITIAL_PASSWORD)?.is_admin, 1, "und damit kann sie sich anmelden");
  const tom = dbm.db().prepare("SELECT username, is_admin, must_change_password FROM teachers WHERE name = 'Tom Lehrer'").get() as { username: string; is_admin: number; must_change_password: number };
  assert.equal(tom.username, "tom", "Benutzername klein geschrieben");
  assert.equal(tom.is_admin, 0);
  assert.equal(tom.must_change_password, 1);
});

test("Formel-Zellen bleiben Text — beim Import und beim nächsten Export", async () => {
  const { dbm, imp, niko } = await setup();
  const kopf = "Name;Schultyp;Klasse;Notizen;Schule;Lehrer";
  const csv = [kopf, "=SUMME(A1);Mittelschule;2;+1+2;MS Test;niko", "-1;Volksschule;1;'-3;@x;niko"].join("\n");
  const ergebnis = imp.importiere(niko, "schueler", csv);
  assert.equal(ergebnis.ok, true, ergebnis.ok ? "" : ergebnis.fehler);

  const rows = dbm.db().prepare("SELECT name, notes, school FROM students ORDER BY id").all() as { name: string; notes: string; school: string }[];
  assert.equal(rows[0].name, "=SUMME(A1)", "keine Formel, kein Fehler");
  assert.equal(typeof rows[0].name, "string");
  assert.equal(rows[0].notes, "+1+2");
  assert.equal(rows[0].school, "MS Test");
  assert.equal(rows[1].name, "-1", "kein Vorzeichen, sondern Text");
  assert.equal(typeof rows[1].name, "string");
  assert.equal(rows[1].notes, "-3", "die Textmarke des Exports fällt weg");
  assert.equal(rows[1].school, "@x");

  // der nächste Export schreibt sie wieder als Text …
  const { parseCsv, unprotectCell } = await import("./csv");
  const { datasetCsv } = await import("./exports");
  const wieder = parseCsv(datasetCsv("schueler")!.body);
  const spalte = wieder[0].indexOf("Name");
  const namen = wieder.slice(1).map((r) => r[spalte]).sort();
  assert.deepEqual(namen, ["'-1", "'=SUMME(A1)"], "mit Textmarke, damit Excel sie nicht ausführt");
  // … und der Import liest genau denselben Text wieder
  assert.deepEqual(namen.map(unprotectCell).sort(), ["-1", "=SUMME(A1)"]);
});

test("eine Datei ohne Planungsspalten bekommt die Vorgaben der Datenbank", async () => {
  const { dbm, repo, imp, niko } = await setup();
  // der Export vor Phase 7 hatte diese Spalten nicht
  const csv = "Name;Schultyp;Klasse;Schule;Fächer;Lehrer\nAlt Bestand;Gymnasium;4;BRG Test;Deutsch;niko\n";
  const ergebnis = imp.importiere(niko, "schueler", csv);
  assert.equal(ergebnis.ok, true, ergebnis.ok ? "" : ergebnis.fehler);
  const s = repo.listStudents()[0];
  const planung = dbm.db().prepare("SELECT einheiten_pro_woche, geplante_dauer, modus_wunsch FROM students WHERE id = ?").get(s.id) as Zeile;
  assert.equal(planung.einheiten_pro_woche, 0);
  assert.equal(planung.geplante_dauer, 100, "Vorgabe 100 (D3)");
  assert.equal(planung.modus_wunsch, "egal");
});

test("leere Datei und fehlende Pflichtspalte werden als Dateifehler gemeldet", async () => {
  const { imp, niko, anzahl } = await setup();
  assert.match(imp.vorschauImport(niko, "schueler", "").fehler ?? "", /leer/);
  const ohneName = imp.vorschauImport(niko, "schueler", "Vorname;Schultyp\nMax;Mittelschule\n");
  assert.match(ohneName.fehler ?? "", /fehlen die Spalten: Name/);
  assert.equal(ohneName.zeilen.length, 0);
  const ergebnis = imp.importiere(niko, "schueler", "Vorname;Schultyp\nMax;Mittelschule\n");
  assert.equal(ergebnis.ok, false);
  assert.equal(anzahl(), 0);
});

test("ohne Verwaltungsrechte wird weder geprüft noch geschrieben", async () => {
  const { dbm, imp, thomas, anzahl } = await setup();
  const lehrer = () => (dbm.db().prepare("SELECT COUNT(*) AS n FROM teachers").get() as { n: number }).n;
  const lehrerVorher = lehrer();
  const csv = [SCHUELER_KOPF, "Heimlich;Mittelschule;2;MS Test;Mathematik;niko;1;60;egal"].join("\n");
  const v = imp.vorschauImport(thomas, "schueler", csv);
  assert.match(v.fehler ?? "", /Verwaltung/);
  assert.equal(v.zeilen.length, 0, "kein Einblick in die Datei ohne Recht");
  const ergebnis = imp.importiere(thomas, "schueler", csv);
  assert.equal(ergebnis.ok, false);
  assert.match(ergebnis.ok ? "" : ergebnis.fehler, /Verwaltung/);
  assert.equal(imp.importiere(thomas, "lehrer", "Name;Benutzername\nEva;eva\n").ok, false);
  assert.equal(anzahl(), 0, "kein Schüler geschrieben");
  assert.equal(lehrer(), lehrerVorher, "und kein Lehrer");
});

test("Klasse und Schultyp dürfen fehlen: Schulstufe unklar, Dubletten dann nur nach dem Namen", async () => {
  const { dbm, repo, imp, niko, anzahl } = await setup();
  repo.createStudent({
    name: "Mit Klasse", grade: 7, klasse: 3, teacher_id: null, school: "", school_type: "Mittelschule",
    subjects: [], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  // nur Name und Fächer, durch Komma getrennt wie aus Google Tabellen
  const csv = ["Name,Fächer", "Ohne Klasse,\"Deutsch, Englisch\"", "mit  klasse,Mathematik", "OHNE KLASSE,Deutsch"].join("\n");
  const v = imp.vorschauImport(niko, "schueler", csv);
  assert.equal(v.fehler, undefined);
  assert.deepEqual(v.spalten, ["Name", "Fächer"]);
  assert.equal(v.gueltig, 1);
  assert.equal(v.stufeOffen, 1);
  const zeile = (nr: number) => v.zeilen.find((z) => z.zeile === nr)!;
  assert.equal(zeile(2).hinweis, "Schulart und Klasse fehlen");
  assert.equal(zeile(2).beschriftung, "Ohne Klasse", "kein leeres „· “ hinter dem Namen");
  assert.equal(zeile(3).dublette, "datenbank", "ohne Klasse reicht der Name, Groß- und Kleinschreibung und Leerzeichen egal");
  assert.equal(zeile(4).dublette, "datei");

  const ergebnis = imp.importiere(niko, "schueler", csv);
  assert.equal(ergebnis.ok && ergebnis.angelegt, 1);
  assert.equal(anzahl(), 2);
  const neu = repo.listStudents().find((s) => s.name === "Ohne Klasse")!;
  assert.equal(neu.klasse, null);
  assert.equal(neu.school_type, "");
  assert.equal(neu.grade, 0, "0 = Schulstufe nicht bekannt");
  assert.deepEqual(neu.subjects, ["Deutsch", "Englisch"]);
  const status = dbm.db().prepare("SELECT stufe_status FROM students WHERE id = ?").get(neu.id) as { stufe_status: string };
  assert.equal(status.stufe_status, "unklar");

  // mit Klasse: nur gleicher Name *und* gleiche Klasse ist eine Dublette; ohne Klasse in der App reicht der Name
  const zweite = imp.vorschauImport(niko, "schueler", ["Name;Schultyp;Klasse", "Mit Klasse;Mittelschule;4", "Ohne Klasse;Mittelschule;2"].join("\n"));
  assert.equal(zweite.zeilen[0].dublette, "", "andere Klasse: ein anderer Schüler");
  assert.equal(zweite.zeilen[1].dublette, "datenbank", "den gibt es schon, nur noch ohne Klasse");
});
