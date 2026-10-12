import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

/**
 * Die Rechteprüfung (D23) und die Schreibwege der Planung — geprüft an den **echten** Funktionen aus
 * `lib/planung/aktionen.ts`, nicht an einer Nachbildung. Niko ist die Verwaltung (`is_admin = 1`),
 * Thomas ist Lehrer ohne Verwaltungsrechte (so legt `lib/db.ts` die zwei Start-Accounts an).
 */
async function setup() {
  const { db, resetForTests } = await import("../db");
  // jede Prüfung startet auf einer leeren Datenbank, damit sich die Tests nicht gegenseitig sehen
  resetForTests();
  const repo = await import("../repo");
  const auth = await import("../auth");
  const { INITIAL_PASSWORD } = await import("../password");
  const planung = await import("./repo");
  const aktionen = await import("./aktionen");
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
  return { db, repo, planung, aktionen, niko, thomas, schueler };
}

const WOCHEN_JSON = JSON.stringify({ "1": [{ start: 540, end: 720 }], "3": [{ start: 840, end: 1020 }] });

/** Legt eine geplante Einheit an, die auf den Raum zeigt (Phase 4 füllt diese Tabelle). */
function platzMitRaum(db: Awaited<ReturnType<typeof setup>>["db"], roomId: number) {
  const conn = db();
  if (!conn.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'geplante_einheiten'").get()) {
    conn.exec("CREATE TABLE geplante_einheiten (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER REFERENCES rooms(id))");
  }
  // Auf die Fremdschlüssel (Lehrer, Schüler, Raum) muss es wirklich zeigen: der Test legt dafür
  // einen Schüler an, wenn noch keiner da ist.
  const schuelerId =
    (conn.prepare("SELECT id FROM students ORDER BY id LIMIT 1").get() as { id: number } | undefined)?.id ??
    Number(conn.prepare("INSERT INTO students (name, grade, access_token) VALUES ('Platzhalter', 6, 'tok-platzhalter')").run().lastInsertRowid);
  // Alle Pflichtspalten ohne Vorgabe mit einem passenden Wert füllen, damit der Test auch dann läuft,
  // wenn Phase 4 die Tabelle mit weiteren NOT-NULL-Spalten anlegt.
  const spalten = conn.prepare("PRAGMA table_info(geplante_einheiten)").all() as { name: string; type: string; notnull: number; dflt_value: unknown; pk: number }[];
  const namen = ["room_id"];
  const werte: unknown[] = [roomId];
  for (const s of spalten) {
    if (s.pk || s.name === "room_id" || !s.notnull || s.dflt_value !== null) continue;
    namen.push(s.name);
    werte.push(s.name === "student_id" ? schuelerId : s.type.toUpperCase().includes("INT") ? 1 : "2026-10-12");
  }
  conn.prepare(`INSERT INTO geplante_einheiten (${namen.join(", ")}) VALUES (${namen.map(() => "?").join(", ")})`).run(...werte);
  return schuelerId;
}

test("Verfügbarkeit eines Lehrers: schreiben, lesen, derselbe Wert", async () => {
  const { planung, aktionen, niko } = await setup();
  assert.deepEqual(planung.getLehrerPlanung(niko.id)!.availability, {}, "am Anfang leer");
  const res = aktionen.speichereLehrerVerfuegbarkeit(niko, niko.id, WOCHEN_JSON);
  assert.equal(res.ok, true);
  assert.deepEqual(planung.getLehrerPlanung(niko.id)!.availability, JSON.parse(WOCHEN_JSON));
  // eine kaputte Eingabe wird abgelehnt und überschreibt nichts
  const kaputt = aktionen.speichereLehrerVerfuegbarkeit(niko, niko.id, "{kaputt");
  assert.equal(kaputt.ok, false);
  assert.deepEqual(planung.getLehrerPlanung(niko.id)!.availability, JSON.parse(WOCHEN_JSON), "der alte Wert bleibt stehen");
});

test("D23: ein Lehrer ändert seine eigene Verfügbarkeit, aber nicht die eines anderen", async () => {
  const { planung, aktionen, niko, thomas } = await setup();
  const fremd = aktionen.speichereLehrerVerfuegbarkeit(thomas, niko.id, WOCHEN_JSON);
  assert.equal(fremd.ok, false, "Thomas darf Nikos Verfügbarkeit nicht ändern");
  assert.match(fremd.ok === false ? fremd.fehler : "", /Berechtigung/);
  assert.deepEqual(planung.getLehrerPlanung(niko.id)!.availability, {}, "nichts wurde geschrieben");

  assert.equal(aktionen.speichereLehrerVerfuegbarkeit(thomas, thomas.id, WOCHEN_JSON).ok, true, "die eigene schon");
  assert.deepEqual(planung.getLehrerPlanung(thomas.id)!.availability, JSON.parse(WOCHEN_JSON));

  // die Verwaltung darf jeden
  assert.equal(aktionen.speichereLehrerVerfuegbarkeit(niko, thomas.id, "{}").ok, true);
  assert.deepEqual(planung.getLehrerPlanung(thomas.id)!.availability, {});
  // Wochenziel und Raumwünsche gehorchen derselben Regel
  assert.equal(aktionen.speichereLehrerWochenziel(thomas, niko.id, 600).ok, false);
  assert.equal(aktionen.speichereLehrerRaumPraeferenzen(thomas, niko.id, [1]).ok, false);
  assert.equal(aktionen.speichereLehrerWochenziel(thomas, thomas.id, 600).ok, true);
  assert.equal(planung.getLehrerPlanung(thomas.id)!.weekly_target_min, 600);
  assert.equal(aktionen.speichereLehrerWochenziel(thomas, thomas.id, null).ok, true, "leer heißt kein Ziel");
  assert.equal(planung.getLehrerPlanung(thomas.id)!.weekly_target_min, null);
  assert.equal(aktionen.speichereLehrerWochenziel(thomas, thomas.id, 2000).ok, false, "mehr als ein Tag ist kein Ziel");
});

test("D23: die Planung eigener Schüler ist erlaubt, die fremder nicht — die Verwaltung darf alles", async () => {
  const { aktionen, planung, niko, thomas, schueler } = await setup();
  const eigener = schueler("Eigener Schüler", thomas.id);
  const fremder = schueler("Fremder Schüler", niko.id);
  const eingabe = { einheiten_pro_woche: 2, geplante_dauer: 100, modus_wunsch: "vor_ort", erlaubte_lehrer: [], availability: WOCHEN_JSON };

  const verboten = aktionen.speichereSchuelerPlanung(thomas, fremder, eingabe);
  assert.equal(verboten.ok, false, "Thomas darf die Planung von Nikos Schüler nicht ändern");
  assert.deepEqual(planung.getSchuelerPlanung(fremder)!.availability, {}, "nichts wurde geschrieben");

  assert.equal(aktionen.speichereSchuelerPlanung(thomas, eigener, eingabe).ok, true, "der eigene Schüler schon");
  const gespeichert = planung.getSchuelerPlanung(eigener)!;
  assert.equal(gespeichert.einheiten_pro_woche, 2);
  assert.equal(gespeichert.geplante_dauer, 100);
  assert.equal(gespeichert.modus_wunsch, "vor_ort");
  assert.deepEqual(gespeichert.availability, JSON.parse(WOCHEN_JSON));

  assert.equal(aktionen.speichereSchuelerPlanung(niko, fremder, eingabe).ok, true, "die Verwaltung darf jeden Schüler");
  // ein Schüler, den es nicht gibt
  assert.equal(aktionen.speichereSchuelerPlanung(niko, 99999, eingabe).ok, false);
  // ohne Lehrerzuordnung darf nur die Verwaltung
  const ohne = schueler("Ohne Lehrer", null);
  assert.equal(aktionen.speichereSchuelerPlanung(thomas, ohne, eingabe).ok, false);
});

test("geplante Dauer: nur 1–300 wird angenommen (D3)", async () => {
  const { aktionen, planung, niko, schueler } = await setup();
  const sid = schueler("Dauer Test", niko.id);
  const mit = (dauer: unknown) => aktionen.speichereSchuelerPlanung(niko, sid, { einheiten_pro_woche: 1, geplante_dauer: dauer, modus_wunsch: "egal", erlaubte_lehrer: [], availability: "{}" });
  assert.equal(planung.getSchuelerPlanung(sid)!.geplante_dauer, 100, "Vorgabe ist 100");
  for (const schlecht of [0, 301, -5, 1000, 99.5, Number.NaN, "hundert"]) {
    const res = mit(schlecht);
    assert.equal(res.ok, false, `${String(schlecht)} wird abgelehnt`);
    assert.match(res.ok === false ? res.fehler : "", /1 und 300/);
  }
  for (const gut of [1, 100, 300]) {
    assert.equal(mit(gut).ok, true, `${gut} wird angenommen`);
    assert.equal(planung.getSchuelerPlanung(sid)!.geplante_dauer, gut);
  }
  // Einheiten pro Woche hat eigene Grenzen
  assert.equal(aktionen.speichereSchuelerPlanung(niko, sid, { einheiten_pro_woche: 41, geplante_dauer: 100, modus_wunsch: "egal", erlaubte_lehrer: [], availability: "{}" }).ok, false);
  assert.equal(aktionen.speichereSchuelerPlanung(niko, sid, { einheiten_pro_woche: 2, geplante_dauer: 100, modus_wunsch: "manchmal", erlaubte_lehrer: [], availability: "{}" }).ok, false);
});

test("erlaubte Lehrer und Raumwünsche behalten nur, was es wirklich gibt", async () => {
  const { aktionen, planung, niko, thomas, schueler } = await setup();
  const sid = schueler("Listen Test", niko.id);
  const raum = aktionen.speichereRaum(niko, { building: "Hauptgebäude", name: "Gruppe 1", mode: "vor_ort" });
  assert.equal(raum.ok, true);
  const raumId = planung.listRaeume()[0].id;

  assert.equal(aktionen.speichereSchuelerPlanung(niko, sid, { einheiten_pro_woche: 1, geplante_dauer: 100, modus_wunsch: "egal", erlaubte_lehrer: [thomas.id, 99999], availability: "{}" }).ok, true);
  assert.deepEqual(planung.getSchuelerPlanung(sid)!.erlaubte_lehrer, [thomas.id], "unbekannte Lehrer fallen weg");

  assert.equal(aktionen.speichereLehrerRaumPraeferenzen(thomas, thomas.id, [raumId, raumId, 4242]).ok, true);
  assert.deepEqual(planung.getLehrerPlanung(thomas.id)!.preferred_room_ids, [raumId], "ohne Doppelte und ohne Unbekanntes");
});

test("Wochenabweichung: gilt nur für ihre Woche, wird auf Montag gezogen und ist wieder entfernbar", async () => {
  const { aktionen, planung, niko, thomas } = await setup();
  const basis = JSON.stringify({ "1": [{ start: 540, end: 720 }] });
  assert.equal(aktionen.speichereLehrerVerfuegbarkeit(thomas, thomas.id, basis).ok, true);

  // Mittwoch, 14.10.2026 — gespeichert wird der Montag dieser Woche
  const abweichend = JSON.stringify({ "5": [{ start: 900, end: 1080 }] });
  assert.equal(aktionen.speichereAbweichung(thomas, "teacher", thomas.id, "2026-10-14", abweichend).ok, true);
  assert.deepEqual(planung.getAbweichung("teacher", thomas.id, "2026-10-12"), JSON.parse(abweichend));
  assert.deepEqual(planung.verfuegbarkeitFuer("teacher", thomas.id, "2026-10-12"), { availability: JSON.parse(abweichend), abweichend: true });
  // die Nachbarwoche ist unberührt
  assert.equal(planung.getAbweichung("teacher", thomas.id, "2026-10-19"), null);
  assert.deepEqual(planung.verfuegbarkeitFuer("teacher", thomas.id, "2026-10-19").availability, JSON.parse(basis));
  // zweimal speichern legt keine zweite Zeile an
  assert.equal(aktionen.speichereAbweichung(thomas, "teacher", thomas.id, "2026-10-12", "{}").ok, true);
  assert.equal((planung.listeAbweichungen("teacher", thomas.id)).length, 1);
  assert.equal(aktionen.entferneAbweichung(thomas, "teacher", thomas.id, "2026-10-12").ok, true);
  assert.equal(planung.getAbweichung("teacher", thomas.id, "2026-10-12"), null);
  assert.deepEqual(planung.verfuegbarkeitFuer("teacher", thomas.id, "2026-10-12").availability, JSON.parse(basis));
  // Rechte gelten auch hier
  assert.equal(aktionen.speichereAbweichung(thomas, "teacher", niko.id, "2026-10-12", "{}").ok, false);
  assert.equal(aktionen.entferneAbweichung(thomas, "teacher", niko.id, "2026-10-12").ok, false);
  assert.equal(aktionen.speichereAbweichung(niko, "teacher", thomas.id, "2026-10-12", "{}").ok, true);
  // ein ungültiges Datum wird abgelehnt
  assert.equal(aktionen.speichereAbweichung(niko, "teacher", thomas.id, "14.10.2026", "{}").ok, false);
});

test("Räume: nur die Verwaltung ändert sie, und ein benutzter Raum wird deaktiviert statt gelöscht", async () => {
  const { db, aktionen, planung, niko, thomas } = await setup();
  const verboten = aktionen.speichereRaum(thomas, { building: "Hauptgebäude", name: "Verboten", mode: "vor_ort" });
  assert.equal(verboten.ok, false, "Thomas legt keine Räume an");
  assert.equal(planung.listRaeume({ mitInaktiven: true }).length, 0);

  assert.equal(aktionen.speichereRaum(niko, { building: "Hauptgebäude", name: "Gruppe 1", mode: "vor_ort" }).ok, true);
  assert.equal(aktionen.speichereRaum(niko, { building: "Hauptgebäude", name: "Gruppe 1", mode: "online" }).ok, false, "kein zweiter Raum mit demselben Namen im selben Gebäude");
  assert.equal(aktionen.speichereRaum(niko, { building: "", name: "Ohne Haus", mode: "vor_ort" }).ok, false);
  const unbenutzt = planung.listRaeume()[0];
  const besetzt = aktionen.speichereRaum(niko, { building: "Nebengebäude", name: "Gruppe 2", mode: "online" });
  assert.equal(besetzt.ok, true);
  const besetztId = planung.listRaeume().find((r) => r.name === "Gruppe 2")!.id;

  // ein unbenutzter Raum darf weg
  assert.equal(planung.raumVerweise(unbenutzt.id), 0);
  assert.equal(aktionen.loescheRaum(niko, unbenutzt.id).ok, true);
  assert.equal(planung.getRaum(unbenutzt.id), null);

  // sobald eine geplante Einheit auf den Raum zeigt: kein Löschen mehr
  platzMitRaum(db, besetztId);
  assert.equal(planung.raumVerweise(besetztId), 1);
  const abgelehnt = aktionen.loescheRaum(niko, besetztId);
  assert.equal(abgelehnt.ok, false);
  assert.match(abgelehnt.ok === false ? abgelehnt.fehler : "", /deaktivieren/);
  assert.ok(planung.getRaum(besetztId), "der Raum steht noch");

  // deaktivieren geht, und der Raum bleibt sichtbar (mit Inaktiven)
  assert.equal(aktionen.setzeRaumAktiv(niko, besetztId, false).ok, true);
  assert.equal(planung.getRaum(besetztId)!.active, 0);
  assert.equal(planung.listRaeume().some((r) => r.id === besetztId), false, "inaktive Räume sind nicht mehr im Angebot");
  assert.equal(planung.listRaeume({ mitInaktiven: true }).some((r) => r.id === besetztId), true, "aber nicht verschwunden");
  assert.equal(aktionen.setzeRaumAktiv(thomas, besetztId, true).ok, false, "auch das Aktivieren ist Verwaltungssache");
  assert.equal(aktionen.setzeRaumAktiv(niko, besetztId, true).ok, true);
  assert.equal(aktionen.speichereRaum(niko, { id: besetztId, building: "Nebengebäude", name: "Gruppe 2a", mode: "online" }).ok, true);
  assert.equal(planung.getRaum(besetztId)!.name, "Gruppe 2a");
  assert.equal(aktionen.speichereRaum(niko, { id: 9999, building: "Nebengebäude", name: "Geist", mode: "online" }).ok, false);
});

test("die Rechteprüfungen selbst (lib/planung/berechtigungen.ts) sagen dasselbe", async () => {
  const { niko, thomas, schueler } = await setup();
  const { darfLehrerPlanungBearbeiten, darfRaeumeVerwalten, darfSchuelerPlanungBearbeiten } = await import("./berechtigungen");
  const eigener = schueler("Rechte Schüler", thomas.id);
  assert.equal(darfLehrerPlanungBearbeiten(thomas, thomas.id), true);
  assert.equal(darfLehrerPlanungBearbeiten(thomas, niko.id), false);
  assert.equal(darfLehrerPlanungBearbeiten(niko, thomas.id), true);
  assert.equal(darfSchuelerPlanungBearbeiten(thomas, eigener), true);
  assert.equal(darfSchuelerPlanungBearbeiten(niko, eigener), true);
  assert.equal(darfSchuelerPlanungBearbeiten(thomas, 99999), false);
  assert.equal(darfRaeumeVerwalten(thomas), false);
  assert.equal(darfRaeumeVerwalten(niko), true);
  assert.equal(darfRaeumeVerwalten({ id: thomas.id, is_admin: 1 }), true, "die Verwaltung wird aus is_admin gelesen, nicht aus der Id");
});
