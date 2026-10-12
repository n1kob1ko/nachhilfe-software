/**
 * Persistenz der Druckblätter (Phase 5 des Merges, Schritt 5, D21).
 *
 * Geprüft wird die Grenze „Definition rein / Definition raus": Ein gespeichertes Druckblatt ist eine
 * Zeile in `materials` mit `kind = 'druckblatt'` und der Definition als JSON in `definition`; die
 * Dateispalten bleiben leer und werden beim Lesen als „nicht vorhanden" geführt. Dazu das Öffnen
 * (gültig, alt/unvollständig, kaputt, falsche Blattart), das Zuweisen als Kopie und die
 * Verträglichkeit mit dem bestehenden Upload-Weg.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const LESETABELLE_JSON = async () => JSON.stringify((await import("./druckblatt/definition/defaults")).DEFAULT_WORKSHEET);

async function niko() {
  const repo = await import("./repo");
  return repo.listTeachers().find((t) => t.name === "Niko")!;
}

/** Legt eine materials-Zeile so an, wie es ein älterer Stand oder ein Import täte. */
async function zeile(o: { kind?: string; topic?: string; definition: string | null; studentId?: number | null }) {
  const { db } = await import("./db");
  return Number(
    db()
      .prepare(
        `INSERT INTO materials (teacher_id, student_id, title, kind, file_name, mime, size, sha256, stored_path, subject, school_type, klasse, topic, skill_ids, status, definition, created_at)
         VALUES (NULL, ?, 'Alt', ?, '', '', 0, '', '', '', '', NULL, ?, '[]', 'geprueft', ?, ?)`,
      )
      .run(o.studentId ?? null, o.kind ?? "druckblatt", o.topic ?? "lesetabelle", o.definition, new Date().toISOString()).lastInsertRowid,
  );
}

test("speichereDruckblatt: kind, Blattart, Definition — und keine Datei", async () => {
  const mat = await import("./materials");
  const t = await niko();
  const out = mat.speichereDruckblatt({ blattart: "lesetabelle", json: await LESETABELLE_JSON(), title: "Lesen: Mama", teacherId: t.id });
  assert.ok("id" in out, "ein gültiges Blatt wird gespeichert");

  const m = mat.getMaterial((out as { id: number }).id)!;
  assert.equal(m.kind, "druckblatt");
  assert.equal(m.title, "Lesen: Mama");
  assert.equal(m.topic, "lesetabelle", "die Blattart steht als Kennung im topic");
  assert.equal(m.student_id, null, "als Vorlage: kein Schüler");
  assert.equal(m.status, "geprueft");
  assert.ok(m.definition && m.definition.includes('"title"'), "die Definition steht als JSON in der Spalte");
  // die Dateispalten sind leer und werden beim Lesen als „nicht vorhanden" geführt
  assert.deepEqual([m.file_name, m.mime, m.size, m.sha256, m.stored_path], [null, null, null, null, null]);
  assert.equal(mat.hatDatei(m), false);
  assert.equal(mat.istDruckblatt(m), true);
  assert.throws(() => mat.materialFile(m), /keine Datei/, "der leere Pfad darf nicht den Upload-Ordner benennen");
  assert.equal(mat.druckblattArt(m), "lesetabelle");

  // wiederfindbar: in derselben Materialliste und in der Blätter-Übersicht
  assert.ok(mat.listMaterials().some((x) => x.id === m.id));
  assert.ok(mat.listDruckblaetter().some((x) => x.id === m.id));
});

test("speichereDruckblatt: ungültige Definition und unbekannte Blattart werden mit deutscher Meldung abgelehnt", async () => {
  const mat = await import("./materials");
  const t = await niko();
  const leer = mat.speichereDruckblatt({ blattart: "lesetabelle", json: "{}", title: "x", teacherId: t.id });
  assert.ok("error" in leer);
  assert.match(leer.error, /nicht gültig: .*fehlt/, "das Blattschema entscheidet, auf Deutsch");
  assert.match((mat.speichereDruckblatt({ blattart: "lesetabelle", json: "{kaputt", title: "x", teacherId: t.id }) as { error: string }).error, /kein gültiges JSON/);
  // ein Satzbaukasten ist keine Lesetabelle
  const satz = JSON.stringify((await import("./druckblatt/definition/sentence-box-defaults")).DEFAULT_SENTENCE_BOX);
  assert.match((mat.speichereDruckblatt({ blattart: "lesetabelle", json: satz, title: "x", teacherId: t.id }) as { error: string }).error, /nicht gültig/);
  assert.match((mat.speichereDruckblatt({ blattart: "nichts" as never, json: satz, title: "x", teacherId: t.id }) as { error: string }).error, /Unbekannte Blattart/);
});

test("zuweisen ist eine Kopie mit student_id; die Vorlage bleibt", async () => {
  const mat = await import("./materials");
  const repo = await import("./repo");
  const t = await niko();
  const sid = repo.createStudent({
    name: "Mia Zuweisung", grade: 6, klasse: 2, teacher_id: t.id, school: "", school_type: "Mittelschule",
    subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const vorlage = mat.speichereDruckblatt({ blattart: "lesetabelle", json: await LESETABELLE_JSON(), title: "Vorlage", teacherId: t.id }) as { id: number };
  const kopie = mat.speichereDruckblatt({ blattart: "lesetabelle", json: await LESETABELLE_JSON(), title: "Vorlage", studentId: sid, teacherId: t.id }) as { id: number };
  assert.notEqual(kopie.id, vorlage.id, "Zuweisen legt eine neue Zeile an");
  assert.equal(mat.getMaterial(vorlage.id)!.student_id, null, "die Vorlage bleibt ohne Schüler");
  const zu = mat.getMaterial(kopie.id)!;
  assert.equal(zu.student_id, sid);
  assert.equal(zu.school_type, "Mittelschule", "Schulstufe kommt vom Schüler");
  assert.equal(mat.listMaterials({ studentId: sid }).some((x) => x.id === kopie.id), true);
  assert.match((mat.speichereDruckblatt({ blattart: "lesetabelle", json: await LESETABELLE_JSON(), title: "x", studentId: 999_999, teacherId: t.id }) as { error: string }).error, /nicht gefunden/);
});

test("ladeDruckblatt: gültig unverändert, alt mit den Vorgaben ergänzt, kaputt mit Hinweis, falsche Blattart abgelehnt", async () => {
  const mat = await import("./materials");
  const defaults = await import("./druckblatt/definition/defaults");

  // 1. gültig: der gespeicherte Stand kommt unverändert zurück
  const gut = await zeile({ definition: JSON.stringify(defaults.DEFAULT_WORKSHEET) });
  const a = mat.ladeDruckblatt(gut, "lesetabelle");
  assert.equal(a.ok, true);
  if (a.ok) {
    assert.deepEqual(a.definition, defaults.DEFAULT_WORKSHEET);
    assert.equal(a.hinweis, null);
    assert.equal(a.material.id, gut);
  }

  // 2. alt/unvollständig: `mergeDefinition` ergänzt und begrenzt, ein Hinweis erklärt es
  const alt = await zeile({ definition: JSON.stringify({ title: "Alt", content: { kind: "wordList", words: ["Mama", "Oma"] } }) });
  const b = mat.ladeDruckblatt(alt, "lesetabelle");
  assert.equal(b.ok, true);
  if (b.ok) {
    assert.equal(b.definition.title, "Alt", "was da war, bleibt");
    assert.deepEqual(b.definition.content, { kind: "wordList", words: ["Mama", "Oma"] });
    assert.equal(b.definition.grid.columns, defaults.DEFAULT_WORKSHEET.grid.columns, "fehlende Felder kommen aus den Vorgaben");
    assert.match(b.hinweis ?? "", /Vorgaben/);
  }

  // 3. kaputtes JSON: kein Absturz, die Vorgaben plus Hinweis
  const kaputt = await zeile({ definition: "{nicht json" });
  const c = mat.ladeDruckblatt(kaputt, "lesetabelle");
  assert.equal(c.ok, true);
  if (c.ok) {
    assert.deepEqual(c.definition, defaults.DEFAULT_WORKSHEET);
    assert.match(c.hinweis ?? "", /Vorgaben/);
  }

  // 4. ohne Definition
  const ohne = await zeile({ definition: null });
  const d = mat.ladeDruckblatt(ohne, "lesetabelle");
  assert.equal(d.ok, true);
  if (d.ok) assert.match(d.hinweis ?? "", /kein Inhalt/);

  // 5. ein Satzbaukasten über die Lesetabellen-Adresse wird abgelehnt, nicht still umgebaut
  const satz = await zeile({ topic: "satzbaukasten", definition: JSON.stringify((await import("./druckblatt/definition/sentence-box-defaults")).DEFAULT_SENTENCE_BOX) });
  const e = mat.ladeDruckblatt(satz, "lesetabelle");
  assert.equal(e.ok, false);
  if (!e.ok) assert.match(e.fehler, /Satzbaukasten/);

  // 6. kein Druckblatt / nicht vorhanden
  assert.equal(mat.ladeDruckblatt(999_999, "lesetabelle").ok, false);
  const falsch = await zeile({ kind: "foto", definition: null });
  assert.equal(mat.ladeDruckblatt(falsch, "lesetabelle").ok, false);
});

test("ladeDruckblatt: jede Blattart prüft gegen ihr eigenes Schema", async () => {
  const mat = await import("./materials");
  const sb = JSON.stringify((await import("./druckblatt/definition/sentence-box-defaults")).DEFAULT_SENTENCE_BOX);
  const tb = JSON.stringify((await import("./druckblatt/definition/tracing-defaults")).DEFAULT_TRACING);
  const a = mat.ladeDruckblatt(await zeile({ topic: "satzbaukasten", definition: sb }), "satzbaukasten");
  assert.equal(a.ok, true);
  if (a.ok) assert.equal(a.definition.title, "Sätze bauen");
  const b = mat.ladeDruckblatt(await zeile({ topic: "nachmalblatt", definition: tb }), "nachmalblatt");
  assert.equal(b.ok, true);
  if (b.ok) assert.ok(b.definition.rows.repeats > 0);
});

test("Löschen eines Druckblatts rührt den Upload-Ordner nicht an; der Upload-Weg bleibt unverändert", async () => {
  const mat = await import("./materials");
  const t = await niko();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "druckblatt-"));
  process.env.UPLOADS_PATH = dir;
  try {
    const blatt = mat.speichereDruckblatt({ blattart: "lesetabelle", json: await LESETABELLE_JSON(), title: "weg", teacherId: t.id }) as { id: number };
    // ein Druckblatt lässt sich nicht über die Einordnungsmaske in ein Foto umbenennen
    assert.equal(mat.classifyMaterial(blatt.id, { title: "x", kind: "foto", subject: "", schoolType: "", klasse: null, topic: "", skillIds: [], studentId: null, notes: "" }), false);
    assert.equal(mat.deleteMaterial(blatt.id), true, "löschen ohne Datei und ohne Absturz");
    assert.equal(mat.getMaterial(blatt.id), null);
    assert.equal(fs.existsSync(dir), true, "der Upload-Ordner bleibt erhalten");

    // der bestehende Upload-Weg: echte Datei, echte Dateispalten, Löschen entfernt die Datei
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("bild")]);
    const up = mat.saveUpload({ name: "Bild.png", data: png }, { teacherId: t.id });
    const m = mat.getMaterial(up.id)!;
    assert.equal(m.kind, "foto");
    assert.equal(m.mime, "image/png");
    assert.equal(m.size, png.length);
    assert.notEqual(m.stored_path, null);
    assert.equal(m.definition, null, "ein Upload hat keine Blattdefinition");
    assert.ok(fs.existsSync(mat.materialFile(m)));
    assert.ok(mat.deleteMaterial(up.id));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.UPLOADS_PATH;
  }
});
