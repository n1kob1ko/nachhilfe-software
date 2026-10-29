/**
 * „Kein Name auf den Seiten“ einmal je Einheit (lib/kein-name.ts, F3): das erste Häkchen in einer laufenden Einheit gilt für
 * jede weitere Lesung dort; ohne Einheit, in einer anderen Einheit, bei einem anderen Schüler, einer fremden, erfundenen oder
 * beendeten Einheit braucht die Anfrage weiter das Häkchen. Kein KI-Aufruf. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

async function setup() {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const k = await import("./kein-name");
  const erste = repo.listTeachers()[0];
  const lehrerin = { id: erste.id, is_admin: 0 };
  const andereId = Number(db().prepare("INSERT INTO teachers (name, username, is_admin, active, password_hash) VALUES ('Vera Probst', 'vprobst', 0, 1, 'x')").run().lastInsertRowid);
  const andere = { id: andereId, is_admin: 0 };
  const schueler = (name: string) =>
    repo.createStudent({ name, grade: 7, klasse: 3, teacher_id: erste.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const mia = schueler("Mia Lindner");
  const tim = schueler("Tim Haberl");
  const einheitMia = units.startUnit(erste.id, mia, { subject: "Mathematik" }).unit;
  const einheitTim = units.startUnit(erste.id, tim, { subject: "Mathematik" }).unit;
  const gemerkt = (id: number) => (db().prepare("SELECT keine_namen_at FROM units WHERE id = ?").get(id) as { keine_namen_at: string | null }).keine_namen_at;
  return { units, k, lehrerin, andere, mia, tim, einheitMia, einheitTim, gemerkt };
}

test("erste Lesung in der Einheit braucht das Häkchen, die zweite nicht mehr", async () => {
  const { k, lehrerin, mia, einheitMia, gemerkt, units } = await setup();
  const anfrage = (haken: boolean) => k.keinNameGilt({ unitId: einheitMia.id, studentId: mia, teacher: lehrerin, haken });

  assert.equal(k.keinNameBestaetigt(units.getUnit(einheitMia.id)), false);
  assert.equal(anfrage(false), false, "ohne Häkchen und ohne frühere Bestätigung: abgelehnt");
  assert.equal(gemerkt(einheitMia.id), null, "eine abgelehnte Anfrage merkt nichts");

  assert.equal(anfrage(true), true, "mit Häkchen: gilt");
  const am = gemerkt(einheitMia.id);
  assert.ok(am, "die Einheit ist jetzt bestätigt");
  assert.equal(k.keinNameBestaetigt(units.getUnit(einheitMia.id)), true, "die Seite zeigt die Zeile statt des Häkchens");

  assert.equal(anfrage(false), true, "zweite Lesung in derselben Einheit: ohne Feld bestätigt");
  assert.equal(anfrage(true), true);
  assert.equal(gemerkt(einheitMia.id), am, "der Zeitpunkt der ersten Bestätigung bleibt");
});

test("eine andere Einheit (zwei Schüler zugleich) braucht ihr eigenes Häkchen", async () => {
  const { k, lehrerin, mia, tim, einheitMia, einheitTim, gemerkt } = await setup();
  assert.equal(k.keinNameGilt({ unitId: einheitMia.id, studentId: mia, teacher: lehrerin, haken: true }), true);

  assert.equal(k.keinNameGilt({ unitId: einheitTim.id, studentId: tim, teacher: lehrerin, haken: false }), false, "Tims Einheit ist nicht bestätigt");
  assert.equal(gemerkt(einheitTim.id), null);
  assert.equal(k.keinNameGilt({ unitId: einheitTim.id, studentId: tim, teacher: lehrerin, haken: true }), true);
  assert.ok(gemerkt(einheitTim.id));
});

test("ohne Einheit gilt nur das Häkchen der Anfrage, auch wenn eine Einheit des Schülers bestätigt ist", async () => {
  const { k, lehrerin, mia, einheitMia } = await setup();
  k.keinNameGilt({ unitId: einheitMia.id, studentId: mia, teacher: lehrerin, haken: true });
  assert.equal(k.keinNameGilt({ unitId: null, studentId: mia, teacher: lehrerin, haken: false }), false);
  assert.equal(k.keinNameGilt({ unitId: undefined, studentId: mia, teacher: lehrerin, haken: true }), true);
});

test("erfundene oder fremde Einheit lässt die Prüfung nicht aus und merkt nichts", async () => {
  const { k, lehrerin, andere, mia, tim, einheitMia, einheitTim, gemerkt } = await setup();
  k.keinNameGilt({ unitId: einheitMia.id, studentId: mia, teacher: lehrerin, haken: true });

  // Mias bestätigte Einheit für eine Lesung bei Tim: zählt nicht
  assert.equal(k.keinNameGilt({ unitId: einheitMia.id, studentId: tim, teacher: lehrerin, haken: false }), false, "Einheit eines anderen Schülers");
  // eine Einheit, die es nicht gibt
  assert.equal(k.keinNameGilt({ unitId: 999_999, studentId: mia, teacher: lehrerin, haken: false }), false, "erfundene Einheit");
  assert.equal(k.keinNameGilt({ unitId: -3, studentId: mia, teacher: lehrerin, haken: false }), false);
  // die Einheit einer anderen Lehrkraft (keine Administration)
  assert.equal(k.keinNameGilt({ unitId: einheitMia.id, studentId: mia, teacher: andere, haken: false }), false, "fremde Einheit");
  assert.equal(k.einheitFuerKeinName(einheitMia.id, mia, andere), null);

  // mit Häkchen gilt die Anfrage, aber die fremde Einheit wird nicht als bestätigt gemerkt
  assert.equal(k.keinNameGilt({ unitId: einheitTim.id, studentId: mia, teacher: lehrerin, haken: true }), true);
  assert.equal(k.keinNameGilt({ unitId: einheitTim.id, studentId: tim, teacher: andere, haken: true }), true);
  assert.equal(gemerkt(einheitTim.id), null, "Tims Einheit bleibt unbestätigt");

  // die Administration darf jede Einheit führen
  assert.equal(k.keinNameGilt({ unitId: einheitMia.id, studentId: mia, teacher: { id: andere.id, is_admin: 1 }, haken: false }), true);
});

test("beendete Einheit: die Bestätigung gilt nicht mehr, ein Häkchen wird nicht mehr gemerkt", async () => {
  const { k, units, lehrerin, mia, tim, einheitMia, einheitTim, gemerkt } = await setup();
  k.keinNameGilt({ unitId: einheitMia.id, studentId: mia, teacher: lehrerin, haken: true });
  units.finishUnit(einheitMia.id, "beendet", { byTeacherId: lehrerin.id });
  units.finishUnit(einheitTim.id, "beendet", { byTeacherId: lehrerin.id });

  assert.equal(k.keinNameBestaetigt(units.getUnit(einheitMia.id)), false);
  assert.equal(k.keinNameGilt({ unitId: einheitMia.id, studentId: mia, teacher: lehrerin, haken: false }), false, "beendet: wieder mit Häkchen");
  assert.equal(k.keinNameGilt({ unitId: einheitTim.id, studentId: tim, teacher: lehrerin, haken: true }), true);
  assert.equal(gemerkt(einheitTim.id), null, "nach dem Ende wird nichts mehr gemerkt");

  // die nächste Einheit desselben Schülers fängt wieder ohne Bestätigung an
  const neu = units.startUnit(lehrerin.id, mia, { subject: "Mathematik" }).unit;
  assert.equal(neu.keine_namen_at, null);
  assert.equal(k.keinNameGilt({ unitId: neu.id, studentId: mia, teacher: lehrerin, haken: false }), false);
});
