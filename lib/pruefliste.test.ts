/**
 * Prüfungen eintragen (Plan 3.1): der Schüler trägt in seiner App ein, die Fotos werden gleich gelesen (nur ohne Namen,
 * jedes einmal, auf Kosten dieses Schülers). Ist alles klar, wird gleich eine Prüfung „vom Schüler eingetragen“; ein
 * unklares Datum wird nie geraten und wartet in der Prüfliste. Der Lehrer ändert, übernimmt oder verwirft alles.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Die Fotos sind ein paar erfundene Bytes mit dem
 * Anfang einer JPEG- bzw. PDF-Datei. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StoffzettelGelesen } from "./ai";
import type { AIRequest } from "./ai/providers";
import type { StoffzettelVorschlag } from "./stoffzettel";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "pruefliste-"));
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_STUDENT_LIMIT_EUR"]) delete process.env[k];

const HEUTE = "2026-10-23";
let n = 0;
/** Jedes Foto ein anderes (sonst wäre es dasselbe Material). */
const jpeg = () => ({ name: "zettel.jpg", data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundener Stoffzettel ${++n}`)]) });
const pdf = () => ({ name: "stoff.pdf", data: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from(`erfundener Stoff ${++n}`)]) });
const o2 = { heute: "2026-10-23" };
const eingabe = (o: Partial<{ art: string; fach: string; datum: string; stoff: string; notiz: string }> = {}) => ({ art: "Schularbeit", fach: "Mathematik", datum: "", stoff: "", notiz: "", ...o });

const GELESEN: StoffzettelGelesen = { art: "2. Schularbeit", fach: "M", datum: "2026-11-12", titel: "2. Mathematik-Schularbeit", themen: ["Brüche kürzen", "Prozentrechnung"], unsicher: [] };

async function setup() {
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const pl = await import("./pruefliste");
  const [niko, thomas] = ["Niko", "Thomas"].map((name) => repo.listTeachers().find((t) => t.name === name)!);
  db().prepare("UPDATE teachers SET is_admin = CASE WHEN id = ? THEN 1 ELSE 0 END").run(niko.id);
  const neu = (name: string, teacherId: number | null, subjects = ["Mathematik", "Englisch"]) =>
    repo.createStudent({ name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects, current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const sid = neu("Mia Probe", thomas.id);
  return { repo, pl, db, niko: { ...niko, is_admin: 1 }, thomas: { ...thomas, is_admin: 0 }, sid, neu };
}

/** Ein Anbieter-Ersatz: schreibt jede Anfrage mit und antwortet mit `gelesen` (null = lehnt ab). */
async function mitKi(gelesen: StoffzettelGelesen | null | ((i: number) => StoffzettelGelesen | null) = GELESEN) {
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    const g = typeof gelesen === "function" ? gelesen(gefragt.length) : gelesen;
    return { parsed: g, refusal: g === null, model: req.model, usage: { input: 1_500, output: 200, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  return { gefragt, aus: () => router.setTransport(null) };
}

test("the student's entry is checked: known kinds and subjects, a real date or none, Stoff or a photo", async () => {
  const { pl, sid } = await setup();
  const o = { faecher: ["Mathematik", "Englisch"], alle: ["Mathematik", "Deutsch", "Englisch", "Biologie"], fotos: 0 };
  const ok = pl.pruefeEingabe(eingabe({ art: "Quiz", fach: "biologie", datum: "2026-02-30", stoff: "  Zellen,\n Organe " }), o);
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && ok.werte, { art: "Schularbeit", fach: "Biologie", datum: null, stoff: "Zellen, Organe", notiz: "" }, "unknown kind → Schularbeit, a day that does not exist stays empty");
  assert.deepEqual(pl.pruefeEingabe(eingabe({ fach: "Kochen", stoff: "x" }), o), { ok: false, fehler: "Bitte ein Fach wählen." });
  assert.match(String(!pl.pruefeEingabe(eingabe(), o).ok && (pl.pruefeEingabe(eingabe(), o) as { fehler: string }).fehler), /Stoff eintragen oder den Stoffzettel fotografieren/);
  assert.ok(pl.pruefeEingabe(eingabe(), { ...o, fotos: 1 }).ok, "a photo alone is enough");

  assert.match(pl.pruefeFoto({ name: "x.html", data: Buffer.from("<script>alert(1)</script>") }) ?? "", /nur Fotos/);
  assert.match(pl.pruefeFoto({ name: "gross.jpg", data: Buffer.concat([jpeg().data, Buffer.alloc(6 * 1024 * 1024)]) }) ?? "", /zu groß/);
  assert.equal(pl.pruefeFoto(pdf()), null);
  assert.throws(() => pl.reicheEin(sid, eingabe({ stoff: "Brüche" }), [{ name: "x.svg", data: Buffer.from("<svg/>") }], o2), /nur Fotos/);
  assert.throws(() => pl.reicheEin(sid, eingabe({ stoff: "Brüche" }), Array.from({ length: 9 }, jpeg), o2), /Höchstens 8 Fotos/);
});

const mitNamenOk = { heute: HEUTE, keineNamen: true };

test("submitting stores the photos as the student's material; the student sees his entry and the plain state", async () => {
  const { pl, sid, neu } = await setup();
  const { getMaterial, listMaterials } = await import("./materials");
  const r = pl.reicheEin(sid, eingabe({ stoff: "Brüche", notiz: "Buch S. 40" }), [jpeg(), pdf()], o2);
  assert.equal(r.verarbeiten, false, "without the tick „kein Name“ nothing is read");
  const e = pl.getEinreichung(r.id)!;
  assert.equal(e.status, "eingereicht");
  assert.equal(e.fotos.length, 2);
  assert.deepEqual(e.fotos.map((f) => getMaterial(f.materialId!)!.student_id), [sid, sid]);
  assert.equal(getMaterial(e.fotos[0].materialId!)!.title, "Stoffzettel");
  assert.equal(listMaterials({ studentId: sid }).length, 2);

  const sicht = pl.eintraegeFuerSchueler(sid);
  assert.equal(sicht.length, 1);
  assert.deepEqual(Object.keys(sicht[0]).sort(), ["art", "datum", "eingereichtAm", "fach", "fotos", "id", "status", "stoff"], "no notes, nothing of the reading");
  assert.equal(sicht[0].fotos, 2);
  assert.equal(pl.STATUS_LABEL[sicht[0].status], "eingereicht");
  assert.equal(pl.eintraegeFuerSchueler(neu("Leo Beispiel", null)).length, 0, "another student sees nothing of it");
  assert.equal(pl.offeneEinreichungen(sid).length, 1);
});

test("a student cannot flood the list: open entries and entries per day are limited", async () => {
  const { pl, sid, db } = await setup();
  for (let i = 0; i < pl.MAX_PRO_TAG; i++) pl.reicheEin(sid, eingabe({ stoff: `Thema ${i}` }), [], o2);
  assert.throws(() => pl.reicheEin(sid, eingabe({ stoff: "noch eins" }), [], o2), /genug Einträge/);
  db().prepare("UPDATE pruefung_einreichungen SET created_at = '2026-01-01T00:00:00.000Z'").run();
  for (let i = pl.MAX_PRO_TAG; i < pl.MAX_OFFEN; i++) pl.reicheEin(sid, eingabe({ stoff: `Thema ${i}` }), [], o2);
  db().prepare("UPDATE pruefung_einreichungen SET created_at = '2026-01-01T00:00:00.000Z'").run();
  assert.throws(() => pl.reicheEin(sid, eingabe({ stoff: "zu viele" }), [], o2), /noch niemand angesehen/);
});

test("only the student's teachers and the admin may work on the list", async () => {
  const { pl, sid, niko, thomas, neu } = await setup();
  assert.equal(pl.darfPruefliste(thomas, sid), true, "his teacher");
  assert.equal(pl.darfPruefliste(niko, sid), true, "the admin");
  const andererLehrer = { id: thomas.id + 100, is_admin: 0 };
  assert.equal(pl.darfPruefliste(andererLehrer, sid), false);
  assert.equal(pl.darfPruefliste(andererLehrer, neu("Ida Muster", null)), true, "a student without teacher belongs to all, like in Zu erledigen");
  assert.equal(pl.darfPruefliste(thomas, 99999), false);
});

test("what the photos say is a suggestion: empty fields are filled, other values are hints, an unclear date stays empty", async () => {
  const { pl } = await setup();
  const v = (o: Partial<StoffzettelVorschlag>): StoffzettelVorschlag => ({ art: "Schularbeit", fach: "Mathematik", datum: "2026-11-12", titel: "", themen: [], hinweise: [], ...o });

  // the student gave no date and no Stoff: both come from the photo
  const f = pl.formular({ art: "Test", fach: "Mathematik", datum: null, stoff: "", notiz: "Buch S. 40" }, v({ titel: "2. Schularbeit", themen: ["Brüche kürzen", "Prozent"] }));
  assert.equal(f.datum, "2026-11-12");
  assert.equal(f.stoff, "Brüche kürzen, Prozent");
  assert.equal(f.art, "Test", "the student's kind stays");
  assert.deepEqual(f.vomFoto, ["datum", "titel", "stoff"]);
  assert.deepEqual(f.konflikte, ["art"]);
  assert.deepEqual(f.abweichungen, ["Art auf dem Foto: Schularbeit"]);

  // the student's date stays, the photo's other date is a hint; extra topics too
  const g = pl.formular({ art: "Schularbeit", fach: "Mathematik", datum: "2026-11-13", stoff: "Brüche kürzen", notiz: "" }, v({ themen: ["Brüche kürzen", "Prozent"] }));
  assert.equal(g.datum, "2026-11-13");
  assert.deepEqual(g.konflikte, ["datum"]);
  assert.deepEqual(g.abweichungen, ["Datum auf dem Foto: 12.11.2026", "Auf dem Foto außerdem: Prozent"]);

  // no date anywhere: empty, never today
  assert.equal(pl.formular({ art: "Test", fach: "Englisch", datum: null, stoff: "", notiz: "" }, v({ datum: null })).datum, "");
  assert.equal(pl.formular({ art: "Test", fach: "Englisch", datum: null, stoff: "", notiz: "" }, null).datum, "");

  // two photos with different dates: no date, with a hint; topics of both without doubles
  const z = pl.zusammenfuehren([v({ themen: ["Brüche"], hinweise: ["Unsicher: Zeile 2"] }), null, v({ datum: "2026-11-19", themen: ["brüche", "Prozent"] })])!;
  assert.equal(z.datum, null);
  assert.equal(z.fach, "Mathematik");
  assert.deepEqual(z.themen, ["Brüche", "Prozent"]);
  assert.deepEqual(z.hinweise, ["Die Fotos nennen verschiedene Termine. Bitte eintragen.", "Foto 1: Unsicher: Zeile 2"]);
  assert.equal(pl.zusammenfuehren([null, null]), null);
  const eins = v({ hinweise: ["Kein Datum gefunden. Bitte eintragen."], datum: null });
  assert.equal(pl.zusammenfuehren([eins]), eins, "one photo: as it was read");
});

test("only what is clear is entered without a teacher: a sure date from today on, nothing contradicts", async () => {
  const { pl } = await setup();
  const v = (o: Partial<StoffzettelVorschlag> = {}): StoffzettelVorschlag => ({ art: "Schularbeit", fach: "Mathematik", datum: "2026-11-12", titel: "2. Schularbeit", themen: ["Prozent"], hinweise: [], ...o });
  const foto = (vorschlag: StoffzettelVorschlag | null) => ({ id: 1, materialId: 1, mime: "image/jpeg", gelesen: true, vorschlag, fehler: vorschlag ? "" : "nicht gelesen" });
  const e = (o: Partial<{ art: string; datum: string | null; stoff: string }> = {}, fotos = [foto(v())]) => ({ art: "Schularbeit", fach: "Mathematik", datum: null, stoff: "Brüche", notiz: "", fotos, ...o });

  const ok = pl.automatischMoeglich(e(), HEUTE);
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && ok.werte, { art: "Schularbeit", fach: "Mathematik", datum: "2026-11-12", titel: "2. Schularbeit", stoff: "Brüche, Prozent", notiz: "" }, "the Stoff of both");
  assert.ok(pl.automatischMoeglich(e({ datum: "2026-11-02" }, []), HEUTE).ok, "no photo: the student's own date counts");

  const nein = (x: ReturnType<typeof pl.automatischMoeglich>) => (x.ok ? "ok" : x.grund);
  assert.equal(nein(pl.automatischMoeglich(e({}, [foto(v({ datum: null }))]), HEUTE)), "Kein sicheres Datum.");
  assert.equal(nein(pl.automatischMoeglich(e({}, []), HEUTE)), "Kein sicheres Datum.");
  assert.equal(nein(pl.automatischMoeglich(e({}, [foto(v()), foto(null)]), HEUTE)), "Nicht jedes Foto wurde gelesen.");
  assert.equal(nein(pl.automatischMoeglich(e({ datum: "2026-11-13" }), HEUTE)), "Foto und Angaben passen nicht zusammen.");
  assert.equal(nein(pl.automatischMoeglich(e({ art: "Test" }), HEUTE)), "Foto und Angaben passen nicht zusammen.");
  assert.equal(nein(pl.automatischMoeglich(e({}, [foto(v({ datum: "2026-10-20", hinweise: ["Das Datum liegt in der Vergangenheit. Bitte prüfen."] }))]), HEUTE)), "Das Datum liegt nicht in den nächsten zwölf Monaten.");
  assert.equal(nein(pl.automatischMoeglich(e({}, [foto(v({ hinweise: ["Unsicher: Tag schwer lesbar"] }))]), HEUTE)), "Das Datum auf dem Foto ist nicht sicher.");
  assert.equal(nein(pl.automatischMoeglich(e({}, [foto(v()), foto(v({ datum: "2026-11-19" }))]), HEUTE)), "Kein sicheres Datum.", "two photos, two dates");
});

test("right after the upload: read without a click, a clear entry becomes a Prüfung „vom Schüler“, an unclear date waits", async () => {
  const { pl, repo, db, sid } = await setup();
  const ki = await mitKi();
  try {
    const r = pl.reicheEin(sid, eingabe({ stoff: "Brüche", notiz: "Buch S. 40" }), [jpeg()], mitNamenOk);
    assert.equal(r.verarbeiten, true);
    assert.equal(ki.gefragt.length, 0, "saving reads nothing yet");
    assert.equal(await pl.verarbeite(r.id, { heute: HEUTE }), "automatisch");
    assert.equal(ki.gefragt.length, 1, "one request for one photo");
    assert.equal(JSON.stringify(ki.gefragt).includes("Mia"), false, "no name goes along");
    const e = pl.getEinreichung(r.id)!;
    const t = repo.getTest(e.testId!)!;
    assert.equal(t.quelle, "schueler");
    assert.equal(t.date, "2026-11-12");
    assert.equal(t.kind, "Schularbeit");
    assert.deepEqual(t.topics, ["Brüche", "Brüche kürzen", "Prozentrechnung"]);
    assert.equal(t.status, "geplant", "counts for planning like any Schularbeit");
    assert.equal(t.material_id, e.fotos[0].materialId);
    assert.equal(t.notes, "Buch S. 40");
    assert.equal(repo.upcomingTests(HEUTE, sid)[0]?.id, t.id);
    const calls = db().prepare("SELECT student_id, fn FROM ai_calls").all() as { student_id: number; fn: string }[];
    assert.deepEqual(calls.map((c) => [c.student_id, c.fn]), [[sid, "stoffzettel"]], "the cost counts for this student");

    const sicht = pl.eintraegeFuerSchueler(sid)[0];
    assert.equal(pl.STATUS_LABEL[sicht.status], "eingetragen");
    assert.equal(sicht.datum, "2026-11-12");
    assert.equal(JSON.stringify(sicht).includes("Buch S. 40"), false, "no notes on the student's page");
    assert.equal(pl.offeneEinreichungen(sid).length, 1, "still in the Prüfliste for the teacher to see");

    assert.equal(await pl.verarbeite(r.id, { heute: HEUTE }), "automatisch");
    assert.equal(ki.gefragt.length, 1, "a second call reads nothing again");
  } finally {
    ki.aus();
  }

  // no date on the sheet: nothing is guessed, no Prüfung, the teacher checks
  const ohne = await mitKi({ ...GELESEN, datum: null });
  try {
    const r = pl.reicheEin(sid, eingabe({ fach: "Englisch", stoff: "Unit 4" }), [jpeg()], mitNamenOk);
    assert.equal(await pl.verarbeite(r.id, { heute: HEUTE }), "eingereicht");
    assert.equal(pl.getEinreichung(r.id)!.testId, null);
    assert.equal(repo.listTests(sid).length, 1, "only the first one");
    assert.equal(pl.eintraegeFuerSchueler(sid)[0].datum, null);
  } finally {
    ohne.aus();
  }
});

test("reading: without KI nothing is marked, a refusal is not tried again, the teacher can read with the tick", async () => {
  const { pl, sid, thomas } = await setup();
  const r = pl.reicheEin(sid, eingabe({ stoff: "" }), [jpeg(), jpeg()], mitNamenOk);
  assert.equal(r.verarbeiten, false, "without KI the page does not even try");
  assert.equal(await pl.verarbeite(r.id, { heute: HEUTE }), "eingereicht");
  await assert.rejects(pl.liesFotos(r.id, { teacherId: thomas.id, heute: HEUTE }), /nur die KI/);
  assert.equal(pl.getEinreichung(r.id)!.fotos.some((f) => f.gelesen), false);

  const ki = await mitKi(null);
  try {
    assert.equal(await pl.liesFotos(r.id, { teacherId: thomas.id, heute: HEUTE }), 0);
    assert.equal(ki.gefragt.length, 1, "both photos in one request");
    assert.equal((ki.gefragt[0].content as { type: string }[]).filter((t) => t.type === "image").length, 2);
    const e = pl.getEinreichung(r.id)!;
    assert.deepEqual(e.fotos.map((f) => f.gelesen), [true, true]);
    assert.match(e.fotos[1].fehler, /nicht gelesen/);
    assert.equal(await pl.liesFotos(r.id, { teacherId: thomas.id, heute: HEUTE }), 0);
    assert.equal(ki.gefragt.length, 1, "refused photos are not read again");
    assert.equal(pl.entscheide(r.id, HEUTE), "eingereicht", "nothing read: the teacher decides");
  } finally {
    ki.aus();
  }

  // read together: one request, the suggestion on the first photo, the reading on the entry
  const zwei = pl.reicheEin(sid, eingabe({ stoff: "" }), [jpeg(), jpeg()], mitNamenOk);
  const ki2 = await mitKi();
  try {
    assert.equal(await pl.liesFotos(zwei.id, { teacherId: thomas.id, heute: HEUTE }), 2);
    assert.equal(ki2.gefragt.length, 1, "one request for both photos");
    const e = pl.getEinreichung(zwei.id)!;
    assert.deepEqual(e.fotos.map((f) => f.gelesen), [true, true]);
    assert.equal(e.fotos[0].vorschlag?.datum, "2026-11-12");
    assert.equal(pl.zusammenfuehren(e.fotos.map((f) => f.vorschlag))?.datum, "2026-11-12", "the merged suggestion has no hint per photo");
    assert.equal(pl.entscheide(zwei.id, HEUTE), "automatisch");
    const { db } = await import("./db");
    const testId = pl.getEinreichung(zwei.id)!.testId!;
    assert.ok((db().prepare("SELECT lesung_id FROM pruefung_einreichungen WHERE id = ?").pluck().get(zwei.id) as number) > 0);
    assert.ok((db().prepare("SELECT COUNT(*) FROM pruefungsstoff WHERE test_id = ?").pluck().get(testId) as number) > 0, "the Prüfungsstoff comes with the Prüfung");
  } finally {
    ki2.aus();
  }
});

test("at the limit per student nothing is read and nothing is marked", async () => {
  const { pl, sid } = await setup();
  const r = pl.reicheEin(sid, eingabe({ stoff: "Brüche" }), [jpeg(), jpeg()], mitNamenOk);
  process.env.AI_STUDENT_LIMIT_EUR = "0.000001";
  const ki = await mitKi();
  try {
    await pl.verarbeite(r.id, { heute: HEUTE });
    assert.equal(ki.gefragt.length, 1, "both photos in one request; it uses up the limit");
    const s2 = pl.reicheEin(sid, eingabe({ stoff: "Prozent" }), [jpeg(), jpeg()], mitNamenOk);
    assert.equal(await pl.verarbeite(s2.id, { heute: HEUTE }), "eingereicht");
    assert.deepEqual(pl.getEinreichung(s2.id)!.fotos.map((f) => f.gelesen), [false, false], "unread for later");
    await assert.rejects(pl.liesFotos(s2.id, { teacherId: null, heute: HEUTE }), /KI-Grenze für diesen Schüler/);
    assert.equal(ki.gefragt.length, 1);
  } finally {
    ki.aus();
    delete process.env.AI_STUDENT_LIMIT_EUR;
  }
});

test("Übernehmen makes the Prüfung with the teacher's values; Bestätigen changes an entered one; Verwerfen removes it", async () => {
  const { pl, repo, sid, thomas } = await setup();
  const { getMaterial } = await import("./materials");
  const r = pl.reicheEin(sid, eingabe({ art: "Test", stoff: "Brüche" }), [jpeg()], o2);
  const u = { art: "Schularbeit", fach: "Mathematik", datum: "", titel: "2. Schularbeit", stoff: "Brüche kürzen, Prozent", notiz: "Buch S. 40" };
  assert.deepEqual(pl.uebernimm(r.id, thomas.id, u), { fehler: "Bitte das Datum der Prüfung eintragen." }, "no Prüfung without a date");
  assert.equal(repo.listTests(sid).length, 0);

  const ok = pl.uebernimm(r.id, thomas.id, { ...u, datum: "2026-11-12" });
  assert.ok("testId" in ok);
  const t = repo.getTest(ok.testId)!;
  assert.deepEqual([t.kind, t.date, t.title, t.notes, t.quelle], ["Schularbeit", "2026-11-12", "2. Schularbeit", "Buch S. 40", "schueler"]);
  assert.deepEqual(t.topics, ["Brüche kürzen", "Prozent"]);
  assert.deepEqual(t.skill_ids, [], "skills are linked later in the preparation");
  const foto = pl.getEinreichung(r.id)!.fotos[0].materialId!;
  assert.equal(t.material_id, foto);
  assert.equal(getMaterial(foto)!.title, "Stoffzettel 2. Schularbeit");
  assert.deepEqual(pl.uebernimm(r.id, thomas.id, { ...u, datum: "2026-11-12" }), { fehler: "Dieser Eintrag ist schon erledigt." }, "a second click makes no second Prüfung");
  assert.equal(repo.listTests(sid).length, 1);
  assert.equal(pl.STATUS_LABEL[pl.eintraegeFuerSchueler(sid)[0].status], "übernommen");

  // an entry made without a teacher: Bestätigen saves the changes into that Prüfung, no second one
  const auto = pl.reicheEin(sid, eingabe({ datum: "2026-12-01", stoff: "Gleichungen" }), [], o2);
  const autoTest = pl.getEinreichung(auto.id)!.testId!;
  assert.equal(pl.getEinreichung(auto.id)!.status, "automatisch");
  const b = pl.uebernimm(auto.id, thomas.id, { ...u, datum: "2026-12-02", stoff: "Gleichungen, Terme" });
  assert.deepEqual(b, { testId: autoTest });
  assert.equal(repo.getTest(autoTest)!.date, "2026-12-02");
  assert.deepEqual(repo.getTest(autoTest)!.topics, ["Gleichungen", "Terme"]);
  assert.equal(repo.listTests(sid).length, 2);

  // Verwerfen of an entered one: its Prüfung goes
  const weg = pl.reicheEin(sid, eingabe({ datum: "2026-12-10", stoff: "Wurzeln" }), [], o2);
  const wegTest = pl.getEinreichung(weg.id)!.testId!;
  assert.deepEqual(pl.verwirf(weg.id, thomas.id), { ok: true });
  assert.equal(repo.getTest(wegTest), null);
  assert.equal(pl.STATUS_LABEL[pl.eintraegeFuerSchueler(sid).find((x) => x.id === weg.id)!.status], "nicht übernommen");

  // Verwerfen: the new photo goes, a file that was there before (same bytes) stays
  const alt = jpeg();
  const vorher = pl.reicheEin(sid, eingabe({ stoff: "x" }), [alt], o2);
  const zweit = pl.reicheEin(sid, eingabe({ stoff: "y" }), [alt, jpeg()], o2);
  const [geteilt, eigen] = pl.getEinreichung(zweit.id)!.fotos.map((f) => f.materialId!);
  assert.equal(geteilt, pl.getEinreichung(vorher.id)!.fotos[0].materialId, "the same file is the same material");
  assert.deepEqual(pl.verwirf(zweit.id, thomas.id), { ok: true });
  assert.ok(getMaterial(geteilt), "still used by the first entry");
  assert.equal(getMaterial(eigen), null, "uploaded with this entry only: deleted");
  assert.deepEqual(pl.verwirf(zweit.id, thomas.id), { fehler: "Dieser Eintrag ist schon erledigt." });
});

test("Zu erledigen: an entry is open for the student's teacher until it is decided", async () => {
  const { pl, sid, thomas, niko } = await setup();
  const ze = await import("./zu-erledigen");
  const r = pl.reicheEin(sid, eingabe({ art: "Vokabeltest", fach: "Englisch", stoff: "Unit 4" }), [], o2);
  const p = ze.zuErledigen(thomas.id, HEUTE).offen.find((x) => x.key === `e${r.id}`);
  assert.ok(p && p.art === "einreichung");
  assert.equal(p.zustand, "wartet", "to check: waits for the teacher");
  assert.equal(p.zuPruefen, true);
  assert.equal(p.href, `/schueler/${sid}?tab=schule#pruefliste`);
  assert.equal(p.titel, "Vokabeltest Englisch");
  assert.equal(ze.zuErledigen(niko.id, HEUTE).offen.some((x) => x.key === `e${r.id}`), false, "not in another teacher's list");

  const auto = pl.reicheEin(sid, eingabe({ datum: "2026-11-20", stoff: "Brüche" }), [], o2);
  const a = ze.zuErledigen(thomas.id, HEUTE).offen.find((x) => x.key === `e${auto.id}`);
  assert.ok(a && a.art === "einreichung" && !a.zuPruefen && a.zustand === "offen" && a.pruefungsDatum === "2026-11-20", "entered already: to look at");

  pl.verwirf(r.id, thomas.id);
  const l = ze.zuErledigen(thomas.id, HEUTE);
  assert.equal(l.offen.some((x) => x.key === `e${r.id}`), false);
  const fertig = l.erledigt.find((x) => x.key === `e${r.id}`);
  assert.ok(fertig && fertig.art === "einreichung" && !fertig.uebernommen);
});

