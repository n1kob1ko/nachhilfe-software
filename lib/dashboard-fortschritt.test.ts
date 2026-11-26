/**
 * „Fortschritt deiner Schüler“ auf Heute (Test mit vier Test-Lehrern, 26.11.2026, K10): Eine neue Lehrkraft ohne eigene Einheit
 * sah alle Schüler des Instituts. Jetzt: die eigenen (zugeteilt oder in den letzten 60 Tagen unterrichtet); nur die Verwaltung
 * sieht ohne eigene Schüler alle. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const kid = (name: string, teacherId: number | null) => ({
  name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

/** Die Lehrkräfte der leeren Datenbank und dazu eine neue ohne Einheiten. */
async function mitVera() {
  const { db } = await import("./db");
  const repo = await import("./repo");
  db().prepare("INSERT INTO teachers (name, username, is_admin, active, password_hash, must_change_password) VALUES ('Vera', 'vera', 0, 1, 'x', 1)").run();
  return repo.listTeachers();
}

test("eine Lehrkraft sieht nur die eigenen Schüler, die Verwaltung ohne eigene Schüler alle", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const { schuelerFortschritt } = await import("./dashboard");
  const lehrer = await mitVera();
  const verwaltung = lehrer.find((t) => t.is_admin)!;
  const [uwe, vera] = lehrer.filter((t) => !t.is_admin);
  assert.ok(verwaltung && vera && uwe, "eine Verwaltung und zwei Lehrkräfte");
  const mia = repo.createStudent(kid("Mia Zugeteilt", vera.id));
  const tom = repo.createStudent(kid("Tom Fremd", uwe.id));
  const namen = (id: number) => schuelerFortschritt(id).liste.map((s) => s.name).sort();
  assert.deepEqual(namen(vera.id), ["Mia Zugeteilt"], "zugeteilt, noch keine Einheit");
  assert.equal(schuelerFortschritt(vera.id).alle, false);
  // Vera unterrichtet Tom einmal (Vertretung): er gehört für 60 Tage dazu
  (await import("./learning")).endUnit(units.startUnit(vera.id, tom, { subject: "Mathematik" }).unit.id);
  assert.deepEqual(namen(vera.id), ["Mia Zugeteilt", "Tom Fremd"]);
  // die Verwaltung ohne eigene Schüler: alle, und die Karte sagt das
  const v = schuelerFortschritt(verwaltung.id);
  assert.equal(v.alle, true);
  assert.ok(v.liste.length >= 2 && [mia, tom].every((id) => v.liste.some((s) => s.id === id)));
});

test("eine Lehrkraft ohne Schüler sieht eine leere Liste, nicht das ganze Institut", async () => {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { schuelerFortschritt } = await import("./dashboard");
  const [uwe, vera] = (await mitVera()).filter((t) => !t.is_admin);
  repo.createStudent(kid("Tom Fremd", uwe.id));
  const f = schuelerFortschritt(vera.id);
  assert.deepEqual(f.liste, []);
  assert.equal(f.alle, false);
});
