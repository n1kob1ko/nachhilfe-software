import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// a file, not :memory:, so the database can be closed and opened again like after an update
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "faecher-"));
process.env.DATABASE_PATH = path.join(dir, "faecher.db");

async function setup() {
  const { db, closeDatabase } = await import("./db");
  const repo = await import("./repo");
  const faecher = await import("./faecher");
  const school = await import("./school");
  return { db, closeDatabase, repo, faecher, school };
}

test.after(async () => {
  (await import("./db")).closeDatabase();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("die Fächerliste beginnt mit den Schulfächern, Mathematik, Deutsch und Englisch zuerst", async () => {
  const { faecher, school } = await setup();
  const namen = faecher.fachNamen();
  assert.deepEqual(namen.slice(0, 3), ["Mathematik", "Deutsch", "Englisch"]);
  assert.deepEqual(namen, school.SCHULFAECHER);
  assert.ok(namen.includes("Biologie") && namen.includes("Geschichte") && namen.includes("Physik") && namen.includes("Chemie") && namen.includes("Geographie"));
  assert.ok(faecher.mitUebungen("Deutsch"));
  assert.ok(!faecher.mitUebungen("Biologie"), "Biologie wird dokumentiert, hat aber keine Übungen");
  assert.deepEqual(faecher.weitereFaecher(["Mathematik", "Klavier"]).slice(0, 2), ["Deutsch", "Englisch"]);
  assert.ok(!faecher.weitereFaecher(["Mathematik"]).includes("Mathematik"));
});

test("ein eigenes Fach anlegen: bereinigt, ans Ende, keine Doppelten", async () => {
  const { faecher, school } = await setup();
  const r = faecher.addFach("  Darstellende   Geometrie ");
  assert.ok(r.ok);
  assert.equal(faecher.fachNamen().at(-1), "Darstellende Geometrie");
  assert.deepEqual(faecher.addFach("darstellende geometrie"), { ok: false, fehler: "Darstellende Geometrie steht schon in der Liste." });
  assert.deepEqual(faecher.addFach("biologie"), { ok: false, fehler: "Biologie steht schon in der Liste." });
  assert.equal(faecher.addFach(" ").ok, false);
  assert.equal(faecher.addFach("Physik, Chemie").ok, false, "mehrere Fächer auf einmal gehen nicht");
  // ein eingetipptes Fach bekommt die Schreibweise aus der Liste
  assert.equal(school.fachAus("darstellende geometrie", [], faecher.alleFachNamen()), "Darstellende Geometrie");
});

test("deaktivieren nimmt ein Fach aus der Auswahl; Mathematik, Deutsch, Englisch bleiben", async () => {
  const { faecher } = await setup();
  const musik = faecher.listFaecher().find((f) => f.name === "Musik")!;
  assert.ok(faecher.setFachAktiv(musik.id, false).ok);
  assert.ok(!faecher.fachNamen().includes("Musik"));
  assert.ok(faecher.alleFachNamen().includes("Musik"), "deaktiviert, nicht gelöscht");
  const mathe = faecher.listFaecher().find((f) => f.name === "Mathematik")!;
  assert.deepEqual(faecher.setFachAktiv(mathe.id, false), { ok: false, fehler: "Mathematik bleibt aktiv: daran hängen Lehrplan und Übungen." });
  assert.equal(faecher.setFachAktiv(99999, true).ok, false);
});

test("ein altes, frei eingetipptes Fach lädt weiter, auch nach einem Neustart", async () => {
  const { db, closeDatabase, repo, faecher, school } = await setup();
  const sid = repo.createStudent({
    name: "Mira Testfeld", grade: 6, klasse: 2, teacher_id: null, school: "", school_type: "Mittelschule", subjects: ["Mathematik", "Klavier"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  repo.addHomework({ student_id: sid, subject: "Klavier", description: "Tonleiter üben", due_date: null, status: "offen", notes: "" });
  repo.addTest({ student_id: sid, date: "2026-11-03", subject: "Klavier", kind: "Test", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [] });
  // eine Datenbank von vor der Fächerliste: die Tabelle fehlt noch
  db().exec("DROP TABLE faecher");
  closeDatabase();

  assert.deepEqual(repo.getStudent(sid)!.subjects, ["Mathematik", "Klavier"]);
  assert.equal(repo.listHomework(sid)[0].subject, "Klavier");
  assert.equal(repo.listTests(sid)[0].subject, "Klavier");
  assert.deepEqual(faecher.fachNamen(), school.SCHULFAECHER, "die Liste ist nach dem Neustart wieder da");
  // in einem Fach-Menü bleibt der alte Wert wählbar, ohne in die Liste zu kommen
  assert.ok(school.mitWert(faecher.fachNamen(), "Klavier").includes("Klavier"));
  assert.ok(!faecher.fachNamen().includes("Klavier"));
  assert.deepEqual(school.mitWert(["Deutsch"], "Deutsch"), ["Deutsch"]);
  // die Verwaltung sieht es als „eingetippt, aber nicht in der Liste“ und kann es aufnehmen
  assert.deepEqual(faecher.fremdeFaecher().find((f) => f.name === "Klavier"), { name: "Klavier", anzahl: 3 });
  assert.ok(faecher.addFach("klavier").ok);
  assert.ok(faecher.fachNamen().includes("Klavier"));
  assert.ok(!faecher.fremdeFaecher().some((f) => f.name === "Klavier"));
});

test("ein deaktiviertes Fach bleibt nach dem Neustart deaktiviert und kommt durch Anlegen zurück", async () => {
  const { closeDatabase, faecher } = await setup();
  const latein = faecher.listFaecher().find((f) => f.name === "Latein")!;
  faecher.setFachAktiv(latein.id, false);
  closeDatabase();
  assert.ok(!faecher.fachNamen().includes("Latein"));
  assert.deepEqual(faecher.addFach("latein"), { ok: true, id: latein.id, hinweis: "Latein ist wieder aktiv." });
  assert.ok(faecher.fachNamen().includes("Latein"));
});
