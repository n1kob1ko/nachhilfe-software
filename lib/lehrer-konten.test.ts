import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const kind = (name: string, teacherId: number) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule" as const, subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

/** Ein neues Konto mit Passwort, wie „Lehrer hinzufügen“ es anlegt. */
async function konto(name: string, username: string, admin = false) {
  const { db } = await import("./db");
  const auth = await import("./auth");
  const id = Number(db().prepare("INSERT INTO teachers (name, username, is_admin) VALUES (?, ?, ?)").run(name, username, admin ? 1 : 0).lastInsertRowid);
  auth.setPassword(id, "geheim-123");
  return id;
}

async function verwaltung() {
  const { db } = await import("./db");
  return (db().prepare("SELECT id FROM teachers WHERE is_admin = 1 AND active = 1 ORDER BY id LIMIT 1").get() as { id: number }).id;
}

test("Rollenregeln: nur die Verwaltung, nie die eigene Rolle, immer eine Verwaltung", async () => {
  const { rollenFehler, aktivFehler, loeschFehler } = await import("./lehrer-konten");
  const chefin = { id: 1, name: "Chefin", is_admin: 1, active: 1, deleted_at: null };
  const zweite = { id: 2, name: "Zweite", is_admin: 1, active: 1, deleted_at: null };
  const lehrer = { id: 3, name: "Lehrer", is_admin: 0, active: 1, deleted_at: null };
  const weg = { ...lehrer, id: 4, deleted_at: "2026-10-01T00:00:00Z" };

  assert.equal(rollenFehler(chefin, lehrer, true, 2), null);
  assert.equal(rollenFehler(chefin, zweite, false, 2), null);
  assert.match(rollenFehler(lehrer, chefin, false, 2)!, /nur die Verwaltung/, "ein Lehrer vergibt keine Rollen");
  assert.match(rollenFehler(lehrer, lehrer, true, 2)!, /nur die Verwaltung/, "auch sich selbst nicht");
  assert.match(rollenFehler({ ...chefin, active: 0 }, lehrer, true, 2)!, /nur die Verwaltung/, "eine deaktivierte Verwaltung auch nicht");
  assert.match(rollenFehler(chefin, chefin, false, 2)!, /eigene Rolle/);
  assert.match(rollenFehler(chefin, zweite, false, 1)!, /immer eine Verwaltung/, "die letzte aktive Verwaltung bleibt");
  assert.match(rollenFehler(chefin, weg, true, 2)!, /gibt es nicht mehr/);
  assert.match(rollenFehler(chefin, null, true, 2)!, /gibt es nicht mehr/);

  assert.match(aktivFehler(chefin, zweite, false, 1)!, /immer eine Verwaltung/);
  assert.match(aktivFehler(chefin, weg, true, 2)!, /gibt es nicht mehr/, "ein gelöschtes Konto wird nicht wieder aktiv");
  assert.match(aktivFehler(lehrer, chefin, false, 2)!, /nur die Verwaltung/);

  const lage = { aktiveVerwaltung: 2, laufend: [], schueler: 0, nachfolger: null };
  assert.equal(loeschFehler(chefin, lehrer, lage), null);
  assert.match(loeschFehler(lehrer, chefin, lage)!, /nur die Verwaltung/);
  assert.match(loeschFehler(chefin, chefin, lage)!, /eigene Konto/);
  assert.match(loeschFehler(chefin, zweite, { ...lage, aktiveVerwaltung: 1 })!, /letzte Verwaltung/);
  assert.match(loeschFehler(chefin, lehrer, { ...lage, laufend: ["Mia Test"] })!, /läuft eine Einheit mit Mia Test/);
  assert.match(loeschFehler(chefin, lehrer, { ...lage, schueler: 2 })!, /wer die Schüler übernimmt/);
  assert.match(loeschFehler(chefin, lehrer, { ...lage, schueler: 2, nachfolger: lehrer })!, /wer die Schüler übernimmt/, "nicht an sich selbst");
  assert.match(loeschFehler(chefin, lehrer, { ...lage, schueler: 2, nachfolger: { ...zweite, active: 0 } })!, /wer die Schüler übernimmt/, "nicht an ein deaktiviertes Konto");
  assert.equal(loeschFehler(chefin, lehrer, { ...lage, schueler: 2, nachfolger: zweite }), null);
});

test("eine neue Rolle gilt ab der nächsten Anfrage; gefälschte Anfragen ändern nichts", async () => {
  const konten = await import("./lehrer-konten");
  const auth = await import("./auth");
  const admin = await verwaltung();
  const lena = await konto("Lena Beispiel", "lena.beispiel");
  const paul = await konto("Paul Probe", "paul.probe");
  const { token } = auth.createSession(lena);
  assert.equal(auth.teacherForToken(token)!.is_admin, 0);

  const ok = konten.setzeRolle(admin, lena, true);
  assert.ok(ok.ok, "die Verwaltung gibt die Rolle");
  assert.equal(auth.teacherForToken(token)!.is_admin, 1, "dieselbe Sitzung hat bei der nächsten Anfrage die neue Rolle");

  const falsch = konten.setzeRolle(paul, paul, true);
  assert.ok(!falsch.ok && /nur die Verwaltung/.test(falsch.fehler), "ein Lehrer macht sich nicht selbst zur Verwaltung");
  assert.equal(konten.getKonto(paul)!.is_admin, 0);
  const fremd = konten.setzeRolle(paul, admin, false);
  assert.ok(!fremd.ok, "ein Lehrer nimmt der Verwaltung die Rolle nicht");
  assert.equal(konten.getKonto(admin)!.is_admin, 1);

  const selbst = konten.setzeRolle(lena, lena, false);
  assert.ok(!selbst.ok && /eigene Rolle/.test(selbst.fehler));
  assert.ok(konten.setzeRolle(lena, admin, false).ok, "eine andere Verwaltung darf es");
  assert.ok(konten.setzeRolle(lena, admin, true).ok);
  assert.ok(konten.setzeRolle(admin, lena, false).ok);
  assert.equal(auth.teacherForToken(token)!.is_admin, 0);
});

test("ein Konto ohne Verlauf wird ganz gelöscht", async () => {
  const konten = await import("./lehrer-konten");
  const auth = await import("./auth");
  const { db } = await import("./db");
  const admin = await verwaltung();
  const mara = await konto("Mara Neu", "mara.neu");
  const { token } = auth.createSession(mara);
  const vorschau = konten.loeschVorschau(mara)!;
  assert.equal(vorschau.verlauf, false);
  assert.equal(vorschau.schueler.length, 0);

  const r = konten.loescheLehrer(admin, mara, null);
  assert.ok(r.ok && r.art === "geloescht", r.ok ? r.hinweis : r.fehler);
  assert.equal(db().prepare("SELECT 1 FROM teachers WHERE id = ?").get(mara), undefined);
  assert.equal(auth.teacherForToken(token), null);
  assert.equal(auth.checkLogin("mara.neu", "geheim-123"), null);
});

test("ein Konto mit Verlauf: Schüler wechseln, künftige Plätze gehen, der Name bleibt in Dokumentation und Abrechnung", async () => {
  const konten = await import("./lehrer-konten");
  const auth = await import("./auth");
  const repo = await import("./repo");
  const units = await import("./units");
  const learning = await import("./learning");
  const { db } = await import("./db");
  const zeit = await import("./planung/zeit");
  const admin = await verwaltung();
  const jonas = await konto("Jonas Muster", "jonas.muster");
  const ida = await konto("Ida Vorlage", "ida.vorlage");
  const { token } = auth.createSession(jonas);

  const s1 = repo.createStudent(kind("Emil Testkind", jonas));
  const s2 = repo.createStudent(kind("Ronja Testkind", jonas));
  const s3 = repo.createStudent(kind("Finn Fremdkind", ida));
  db().prepare("UPDATE students SET erlaubte_lehrer = ? WHERE id = ?").run(JSON.stringify([jonas]), s1);
  db().prepare("UPDATE students SET erlaubte_lehrer = ? WHERE id = ?").run(JSON.stringify([jonas, ida]), s3);

  // eine gehaltene Einheit mit Dokumentation
  const { unit } = units.startUnit(jonas, s1, { at: Date.now() - 60 * 60_000, subject: "Mathematik" });
  const lessonId = learning.endUnit(unit.id, { byTeacherId: jonas })!;

  // ein vergangener und zwei künftige Plätze
  const diese = zeit.wienerWochenstart();
  const vorige = zeit.tagAddieren(diese, -7);
  const naechste = zeit.tagAddieren(diese, 7);
  const platz = db().prepare(
    "INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, status, created_at, updated_at) VALUES (?, ?, 900, 50, ?, ?, 'veroeffentlicht', datetime('now'), datetime('now'))",
  );
  platz.run(vorige, 2, jonas, s1);
  platz.run(naechste, 2, jonas, s1);
  platz.run(naechste, 4, jonas, s2);

  // läuft gerade eine Einheit, wird nicht gelöscht
  const laeuft = units.startUnit(jonas, s2, { subject: "Mathematik" });
  const blockiert = konten.loescheLehrer(admin, jonas, admin);
  assert.ok(!blockiert.ok && /läuft eine Einheit mit Ronja Testkind/.test(blockiert.fehler));
  assert.equal(konten.getKonto(jonas)!.deleted_at, null, "nichts geändert");
  units.finishUnit(laeuft.unit.id, "abgebrochen", { byTeacherId: jonas, reason: "Test" });

  const ohneNachfolger = konten.loescheLehrer(admin, jonas, null);
  assert.ok(!ohneNachfolger.ok && /übernimmt/.test(ohneNachfolger.fehler), "mit Schülern braucht es einen Nachfolger");
  const lehrerFaelscht = konten.loescheLehrer(ida, jonas, ida);
  assert.ok(!lehrerFaelscht.ok && /nur die Verwaltung/.test(lehrerFaelscht.fehler), "ein Lehrer löscht keine Konten");

  const vorschau = konten.loeschVorschau(jonas)!;
  assert.equal(vorschau.verlauf, true);
  assert.deepEqual(vorschau.schueler.map((s) => s.name), ["Emil Testkind", "Ronja Testkind"]);
  assert.equal(vorschau.plaetze, 2);

  const r = konten.loescheLehrer(admin, jonas, ida);
  assert.ok(r.ok && r.art === "entfernt", r.ok ? r.hinweis : r.fehler);

  // Schüler und „erlaubte Lehrer“
  assert.equal(repo.getStudent(s1)!.teacher_id, ida);
  assert.equal(repo.getStudent(s2)!.teacher_id, ida);
  const erlaubt = (id: number) => JSON.parse((db().prepare("SELECT erlaubte_lehrer FROM students WHERE id = ?").get(id) as { erlaubte_lehrer: string }).erlaubte_lehrer);
  assert.deepEqual(erlaubt(s1), [ida], "stand nur er drin, steht jetzt der Nachfolger drin");
  assert.deepEqual(erlaubt(s3), [ida]);

  // Plätze: künftige weg, vergangene bleiben
  const plaetze = db().prepare("SELECT week_start FROM geplante_einheiten WHERE teacher_id = ?").all(jonas) as { week_start: string }[];
  assert.deepEqual(plaetze.map((p) => p.week_start), [vorige]);

  // Anmeldung und Listen
  assert.equal(auth.teacherForToken(token), null, "die alte Sitzung gilt nicht mehr");
  assert.equal(auth.checkLogin("jonas.muster", "geheim-123"), null, "anmelden geht nicht mehr");
  const row = db().prepare("SELECT username, password_hash, active, is_admin, deleted_at FROM teachers WHERE id = ?").get(jonas) as Record<string, unknown>;
  assert.equal(row.password_hash, null);
  assert.equal(row.active, 0);
  assert.ok(row.deleted_at);
  assert.equal(row.username, konten.entfernterBenutzername(jonas));
  assert.ok(!repo.listTeachers().some((t) => t.id === jonas));
  assert.ok(!repo.listAllTeachers().some((t) => t.id === jonas), "auch nicht in den Accounts");
  const { listLehrerIds } = await import("./planung/repo");
  assert.ok(!listLehrerIds().includes(jonas));

  // der Name bleibt
  assert.equal(units.getUnit(unit.id)!.teacher_name, "Jonas Muster");
  const lesson = repo.getLesson(lessonId)!;
  assert.equal(lesson.teacher_id, jonas);
  const monat = lesson.starts_at.slice(0, 7);
  const abrechnung = repo.billingEntries({ from: `${monat}-01T00:00`, to: "9999-12-31T00:00" });
  assert.ok(abrechnung.some((b) => b.id === lessonId && b.teacher_name === "Jonas Muster"));

  // gefälschte Anfragen danach
  assert.ok(!konten.setzeAktiv(admin, jonas, true).ok, "ein gelöschtes Konto wird nicht wieder aktiv");
  assert.equal(konten.getKonto(jonas)!.active, 0);
  assert.ok(!konten.setzeRolle(admin, jonas, true).ok);
  assert.ok(!konten.loescheLehrer(admin, jonas, ida).ok, "zweimal löschen geht nicht");

  // der Benutzername ist frei
  const neu = await konto("Jonas Muster-Neu", "jonas.muster");
  assert.ok(auth.checkLogin("jonas.muster", "geheim-123")?.id === neu);
});

test("die letzte Verwaltung und das eigene Konto bleiben", async () => {
  const konten = await import("./lehrer-konten");
  const { db } = await import("./db");
  const admin = await verwaltung();
  db().prepare("UPDATE teachers SET is_admin = 0 WHERE id <> ?").run(admin);
  assert.equal(konten.aktiveVerwaltung(), 1);
  const selbst = konten.loescheLehrer(admin, admin, null);
  assert.ok(!selbst.ok && /eigene Konto/.test(selbst.fehler));
  assert.ok(!konten.setzeRolle(admin, admin, false).ok);
  assert.ok(!konten.setzeAktiv(admin, admin, false).ok);
  assert.equal(konten.aktiveVerwaltung(), 1);
});
