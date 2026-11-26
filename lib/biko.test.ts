import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-biko-"));
process.env.BIKO_TOKEN = "biko-test-schluessel-0123456789abcdef";

/** niko 2026-11-26: Biko schreibt das Tagesbriefing und Lernzettel aus Dokumenten, ohne Schülernamen. */

// Donnerstag, 26.11.2026, 08:00 in Wien
const MORGEN = new Date("2026-11-26T07:00:00Z");
const FRUEH = new Date("2026-11-26T04:00:00Z"); // 05:00 in Wien

async function aufbau() {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const neu = (name: string, goals = "") =>
    repo.createStudent({
      name, grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "AHS", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals, notes: "Geheime Notiz über Familie Huber",
    });
  const lena = neu("Lena Hofer", "Mit Mutter Petra üben, Schularbeit schaffen");
  const tim = neu("Tim Berger");
  const termin = (sid: number, zeit: string) =>
    db().prepare("INSERT INTO lessons (student_id, teacher_id, starts_at, duration_min, subject, status) VALUES (?, ?, ?, 50, 'Mathematik', 'geplant')").run(sid, niko.id, `2026-11-26T${zeit}`);
  termin(lena, "14:00");
  termin(tim, "16:00");
  // eine frühere Einheit mit Namen in der Dokumentation
  db()
    .prepare("INSERT INTO lessons (student_id, teacher_id, starts_at, duration_min, subject, topic, status, activities, tutor_notes) VALUES (?, ?, '2026-11-19T14:00', 50, 'Mathematik', 'Brüche', 'abgeschlossen', 'Brüche gekürzt, Tim war auch da', 'Klassenlehrerin Novak sagt, Lena braucht Hilfe')")
    .run(lena, niko.id);
  return { db, repo, niko, lena, tim };
}

test("Briefing: keine Namen, Schüler als S1 und S2, Zuordnung bleibt in der App", async () => {
  const { niko, lena, tim } = await aufbau();
  const biko = await import("./biko");
  const a = biko.briefingAnfrageFuer(niko.id, MORGEN)!;
  assert.ok(a);
  assert.deepEqual(a.zuordnung, { S1: lena, S2: tim });
  for (const name of ["Lena", "Hofer", "Tim", "Berger", "Petra", "Novak", "Niko", "Huber", "Geheime Notiz"]) assert.ok(!a.anfrage.includes(name), `${name} darf nicht mitgehen`);
  assert.match(a.anfrage, /## S1 · 14:00/);
  assert.match(a.anfrage, /## S2 · 16:00/);
  assert.match(a.anfrage, /\[Name\]/);
  assert.match(a.anfrage, /Brüche/);
  assert.ok(!a.anfrage.includes("Übungen im Bestand"), "keine Übungsliste");
});

test("Abholen: Briefing erst ab 6 Uhr, einmal je Lehrkraft und Tag, nach 20 Minuten noch einmal", async () => {
  const { db } = await aufbau();
  const biko = await import("./biko");
  assert.equal(biko.abholen(FRUEH).length, 0);
  const erst = biko.abholen(MORGEN);
  assert.equal(erst.length, 1);
  assert.equal(erst[0].art, "briefing");
  assert.equal(erst[0].datei, null);
  assert.ok(erst[0].system.includes("S1, S2"));
  assert.equal((erst[0].schema as { type: string }).type, "object");
  assert.equal(biko.abholen(new Date(MORGEN.getTime() + 60_000)).length, 0, "schon abgeholt");
  const spaeter = biko.abholen(new Date(MORGEN.getTime() + 21 * 60_000));
  assert.equal(spaeter.length, 1, "nach 20 Minuten ohne Antwort noch einmal");
  assert.equal((db().prepare("SELECT versuche FROM biko_auftraege").get() as { versuche: number }).versuche, 2);
  assert.ok(biko.letzterAbruf());
});

test("Rückmeldung: geprüft, fremde Kennungen fallen weg, Kosten beim Schüler, nicht im Budget der App", async () => {
  const { niko, lena, tim } = await aufbau();
  const biko = await import("./biko");
  const { monthSpend } = await import("./ai/log");
  const { schuelerKostenUsd } = await import("./ai/schueler-kosten");
  const [j] = biko.abholen(MORGEN);
  const r = biko.rueckmeldung(
    j.id,
    {
      ergebnis: {
        ueberblick: "Zwei Einheiten, S1 hat bald Schularbeit.",
        schueler: [
          { kennung: "S1", schwerpunkt: "Brüche kürzen", punkte: ["kürzt noch unsicher"], vorbereiten: ["Bruchstreifen"] },
          { kennung: "S2", schwerpunkt: "Wiederholen", punkte: [], vorbereiten: [] },
          { kennung: "S9", schwerpunkt: "erfunden", punkte: [], vorbereiten: [] },
        ],
        hinweise: [],
      },
      kosten_usd: 0.04,
      modell: "claude-sonnet-5-5",
      tokens_ein: 4000,
      tokens_aus: 800,
    },
    MORGEN,
  );
  assert.deepEqual(r, { ok: true });
  const a = biko.briefingHeute(niko.id, MORGEN)!;
  assert.equal(a.status, "fertig");
  const b = a.ergebnis as import("./biko").BriefingBiko;
  assert.deepEqual(b.schueler.map((s) => s.kennung), ["S1", "S2"]);
  assert.equal(biko.mitNamen(b.ueberblick, a.zuordnung), "Zwei Einheiten, Lena hat bald Schularbeit.");
  assert.ok(Math.abs(schuelerKostenUsd(lena, MORGEN.getTime()) - 0.02) < 1e-9);
  assert.ok(Math.abs(schuelerKostenUsd(tim, MORGEN.getTime()) - 0.02) < 1e-9);
  assert.equal(monthSpend(MORGEN.getTime(), "allgemein"), 0);
  assert.equal(monthSpend(MORGEN.getTime(), "anthropic"), 0);
  assert.ok(Math.abs(monthSpend(MORGEN.getTime()) - 0.04) < 1e-9);
  // ein zweites Mal geht nicht
  assert.equal("error" in biko.rueckmeldung(j.id, { ergebnis: {} }, MORGEN), true);
});

test("Rückmeldung ohne passendes Schema wird ein Fehler; Neu schreiben lassen legt einen neuen Auftrag an", async () => {
  const { niko } = await aufbau();
  const biko = await import("./biko");
  const [j] = biko.abholen(MORGEN);
  const r = biko.rueckmeldung(j.id, { ergebnis: { falsch: true } }, MORGEN);
  assert.equal("error" in r && r.status, 422);
  assert.equal(biko.getAuftrag(j.id)!.status, "fehler");
  const n = biko.briefingNeu(niko.id, MORGEN);
  assert.ok("id" in n);
  assert.equal(biko.getAuftrag(j.id)!.status, "verworfen");
  assert.equal(biko.abholen(MORGEN).length, 1, "der neue, kein zusätzlicher");
});

test("Zugang nur mit dem richtigen Schlüssel", async () => {
  const biko = await import("./biko");
  assert.equal(biko.zugangOk(`Bearer ${process.env.BIKO_TOKEN}`), true);
  assert.equal(biko.zugangOk("Bearer falsch"), false);
  assert.equal(biko.zugangOk(null), false);
  assert.equal(biko.zugangOk(process.env.BIKO_TOKEN), false, "ohne Bearer");
});

test("Dokument: nur mit Bestätigung ohne Namen, Datei nur für den abgeholten Auftrag, Lernzettel in die Schüler-App", async () => {
  const { niko, lena } = await aufbau();
  const biko = await import("./biko");
  const { saveUpload } = await import("./materials");
  const { lernzettelFuer } = await import("./schuelerportal");
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f1a8a20000000049454e44ae426082", "hex");
  const { id: mid } = saveUpload({ name: "seite.png", data: png }, { title: "Brüche Seite 12 von Lena", subject: "Mathematik", studentId: lena, teacherId: niko.id, at: MORGEN });
  const ohne = biko.materialAnBiko({ materialId: mid, studentId: lena, teacherId: niko.id, wunsch: "", keineNamen: false, now: MORGEN });
  assert.ok("error" in ohne);
  const mit = biko.materialAnBiko({ materialId: mid, studentId: lena, teacherId: niko.id, wunsch: "Für Lena zur Schularbeit", keineNamen: true, now: FRUEH });
  assert.ok("id" in mit);
  const job = biko.getAuftrag(mit.id)!;
  assert.ok(!job.anfrage.includes("Lena"), "kein Name im Titel oder Wunsch");
  assert.match(job.anfrage, /Für: S1/);
  assert.equal(biko.dateiFuerBiko(mit.id), null, "noch nicht abgeholt");
  const raus = biko.abholen(FRUEH);
  assert.equal(raus.length, 1);
  assert.equal(raus[0].datei?.mime, "image/png");
  assert.equal(biko.dateiFuerBiko(mit.id)?.data.length, png.length);
  const r = biko.rueckmeldung(
    mit.id,
    {
      ergebnis: {
        zusammenfassung: "Kürzen und Erweitern von Brüchen.",
        thema: "Brüche kürzen",
        lernzettel: { titel: "Brüche kürzen", einleitung: "S1, hier lernst du kürzen.", abschnitte: [{ ueberschrift: "Kürzen", text: "Zähler und Nenner durch dieselbe Zahl teilen.", merke: "Gleiche Zahl!", beispiele: [{ aufgabe: "Kürze 6/8.", loesung: "3/4" }] }], typische_fehler: ["Nur den Zähler teilen."] },
      },
      kosten_usd: 0.06,
    },
    FRUEH,
  );
  assert.deepEqual(r, { ok: true });
  assert.equal(biko.dateiFuerBiko(mit.id), null, "nach der Antwort nicht mehr");
  const u = biko.lernzettelUebernehmen(mit.id, niko.id, FRUEH);
  assert.ok("stoffpaketId" in u);
  const zettel = lernzettelFuer(lena);
  assert.equal(zettel.length, 1);
  assert.equal(zettel[0].titel, "Brüche kürzen");
  const { getStoffpaket } = await import("./stoffpaket");
  assert.equal(getStoffpaket(u.stoffpaketId)!.lernzettel!.einleitung, "Lena, hier lernst du kürzen.");
});
