/**
 * Stundenplan-Fotos (niko, 2026-10-19): die KI liest den Wochenplan eines Lehrers vom Foto, die Verwaltung prüft
 * jede Zeile, dann kommen die Termine gesperrt in die Woche.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt und antwortet mit einem erfundenen Plan.
 * Das „Foto“ sind ein paar erfundene Bytes. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AIRequest } from "../ai/providers";
import type { StundenplanGelesen } from "../ai";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

const WOCHE = "2031-03-10";
const FOTO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("erfundener Stundenplan")]);

/** Ein erfundener Plan, wie die KI ihn liefert: Buchstabe A, kein Raster am Rand. */
const PLAN: StundenplanGelesen = {
  lehrer_buchstabe: "A",
  raster: [],
  bloecke: [
    { tag: "Mo", von_stunde: 1, bis_stunde: 2, text: "Anna", namen: ["Anna"], neu: false },
    { tag: "Mo", von_stunde: 5, bis_stunde: 5, text: "Lucas", namen: ["Lucas"], neu: false },
    { tag: "Di", von_stunde: 9, bis_stunde: 10, text: "Ben + Clara", namen: ["Ben", "Clara"], neu: false },
    { tag: "Mi", von_stunde: 12, bis_stunde: 13, text: "Neu Dora", namen: ["Neu: Dora"], neu: false },
    { tag: "Do", von_stunde: 3, bis_stunde: 3, text: "Neu", namen: [], neu: true },
    { tag: "Fr", von_stunde: 15, bis_stunde: 16, text: "Emil", namen: ["Emil"], neu: false },
    { tag: "Sa", von_stunde: 16, bis_stunde: 17, text: "Fritz", namen: ["Fritz"], neu: false },
    { tag: "So", von_stunde: 4, bis_stunde: 4, text: "Xaver", namen: ["Xaver"], neu: false },
  ],
  unsicher: ["Sa Stunde 6: verwischt"],
};

async function setup() {
  const { resetForTests } = await import("../db");
  resetForTests();
  const repo = await import("../repo");
  const [niko, thomas] = repo.listTeachers();
  const schueler = (name: string, teacherId: number) =>
    repo.createStudent({ name, grade: 6, klasse: 2, teacher_id: teacherId, school: "", school_type: "Mittelschule", subjects: ["Mathematik"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const ids = {
    anna: schueler("Anna Probe", thomas.id),
    annaAndere: schueler("Anna Muster", niko.id),
    lukas: schueler("Lukas Beispiel", thomas.id),
    ben: schueler("Ben Test", thomas.id),
    clara: schueler("Clara Test", thomas.id),
    emil: schueler("Emil Probe", thomas.id),
    emilAndere: schueler("Emil Muster", thomas.id),
  };
  const alle = repo.listStudents().map((s) => ({ id: s.id, name: s.name, teacher_id: s.teacher_id }));
  return { niko, thomas, ids, alle, admin: { id: niko.id, is_admin: 1 }, lehrer: { id: thomas.id, is_admin: 0 } };
}

test("the grid: lesson 1 starts at 08:50, 50 minutes each, 16 lessons until 22:10; a readable grid from the photo wins", async () => {
  const { standardRaster, rasterAus, leseUhrzeit } = await import("./stundenplan-foto");
  const r = standardRaster();
  assert.equal(r.length, 16);
  assert.deepEqual(r[0], { stunde: 1, von: 530, bis: 580 });
  assert.deepEqual(r[15], { stunde: 16, von: 1280, bis: 1330 }, "21:20–22:10");
  assert.equal(leseUhrzeit("8.50"), 530);
  assert.equal(leseUhrzeit("25:00"), null);

  const foto = rasterAus([
    { stunde: 1, von: "09:00", bis: "09:50" },
    { stunde: 2, von: "09:50", bis: "10:40" },
    { stunde: 3, von: "10:40", bis: "11:30" },
  ]);
  assert.equal(foto.vomFoto, true);
  assert.equal(foto.zeilen.get(1)?.von, 540);
  assert.equal(foto.zeilen.get(4)?.von, 680, "a lesson missing on the photo comes from the standard grid");
  assert.equal(rasterAus([{ stunde: 1, von: "10:00", bis: "09:00" }]).vomFoto, false, "nonsense: the standard grid");
  assert.equal(rasterAus([]).vomFoto, false);
});

test("first names find the students: the teacher's own first, initials, one typo; several or none are left for the teacher", async () => {
  const { ids, alle, thomas, niko } = await setup();
  const { findeSchueler, normName } = await import("./stundenplan-foto");
  assert.equal(normName("  Zoë-Marie  "), "zoe-marie");
  assert.deepEqual(findeSchueler("Anna", alle, thomas.id), { ids: [ids.anna], treffer: "genau" }, "Thomas' Anna, not Niko's");
  assert.deepEqual(findeSchueler("Anna", alle, niko.id), { ids: [ids.annaAndere], treffer: "genau" });
  assert.deepEqual(findeSchueler("anna", alle, null).treffer, "mehrere", "without a teacher both Annas fit");
  assert.deepEqual(findeSchueler("Anna M.", alle, null), { ids: [ids.annaAndere], treffer: "genau" }, "the initial decides");
  assert.deepEqual(findeSchueler("Lucas", alle, thomas.id), { ids: [ids.lukas], treffer: "aehnlich" }, "one letter off");
  const emil = findeSchueler("Emil", alle, thomas.id);
  assert.deepEqual([emil.ids.sort(), emil.treffer], [[ids.emil, ids.emilAndere].sort(), "mehrere"]);
  assert.deepEqual(findeSchueler("Xaver", alle, thomas.id), { ids: [], treffer: "keiner" });
  assert.deepEqual(findeSchueler("Bea", alle, thomas.id), { ids: [], treffer: "keiner" }, "short names get no typo guess (Ben)");
});

test("the preview: lessons become times, two names are two rows, Neu is marked, odd fields are listed", async () => {
  const { ids, alle, thomas, niko } = await setup();
  const { vorschlagAusGelesen } = await import("./stundenplan-foto");
  const ohne = vorschlagAusGelesen(PLAN, { schueler: alle, zuordnung: {}, lehrerIds: [niko.id, thomas.id] });
  assert.equal(ohne.buchstabe, "A");
  assert.equal(ohne.teacherId, null, "A is not assigned yet");
  const v = vorschlagAusGelesen(PLAN, { schueler: alle, zuordnung: { A: thomas.id }, lehrerIds: [niko.id, thomas.id] });
  assert.equal(v.teacherId, thomas.id);
  assert.equal(v.rasterVomFoto, false);
  const zeile = (text: string) => v.zeilen.find((z) => z.text === text)!;
  assert.deepEqual([zeile("Anna").tag, zeile("Anna").start, zeile("Anna").dauer, zeile("Anna").stunden], [1, 530, 100, "Stunde 1–2"]);
  assert.equal(zeile("Anna").studentId, ids.anna);
  assert.equal(zeile("Lucas").studentId, ids.lukas, "a unique typo is suggested");
  assert.equal(zeile("Lucas").treffer, "aehnlich");
  assert.deepEqual([zeile("Ben").start, zeile("Clara").start], [930, 930], "Di 15:30, both");
  assert.equal(zeile("Dora").neu, true, "„Neu“ in the name");
  assert.equal(zeile("Dora").studentId, null);
  const nurNeu = v.zeilen.find((z) => z.tag === 4)!;
  assert.deepEqual([nurNeu.text, nurNeu.treffer, nurNeu.studentId], ["Neu", "neu", null]);
  assert.equal(zeile("Emil").studentId, null, "two Emils: the teacher picks");
  assert.deepEqual([...zeile("Emil").kandidaten].sort(), [ids.emil, ids.emilAndere].sort());
  assert.equal(zeile("Emil").start + zeile("Emil").dauer, 1330, "Fr Stunde 15–16 ends 22:10");
  assert.equal(v.zeilen.some((z) => z.text === "Xaver" && z.tag === 7), true);
  assert.equal(v.zeilen.length, 8);
  assert.equal(v.zeilen.some((z) => z.text === "Fritz"), false, "lesson 17 does not exist: no row …");
  assert.deepEqual(v.unsicher, ["Sa Stunde 6: verwischt", "Sa Stunde 16–17: passt nicht ins Raster („Fritz“)"], "… but a note to look at the photo");
  assert.deepEqual(
    v.zeilen.map((z) => z.tag),
    [...v.zeilen.map((z) => z.tag)].sort((a, b) => a - b),
    "sorted by day",
  );
});

test("check and write: only the admin; the check saves nothing; conflicts per row; two at once get „gleichzeitig“; locked", async () => {
  const { ids, thomas, niko, admin, lehrer } = await setup();
  const planung = await import("./repo");
  const { stundenplanEintragen, wocheFuerImport } = await import("./stundenplan-foto");
  const zeilen = [
    { teacherId: thomas.id, studentId: ids.anna, tag: 1, start: 530, dauer: 100 },
    { teacherId: thomas.id, studentId: ids.ben, tag: 2, start: 930, dauer: 100 },
    { teacherId: thomas.id, studentId: ids.clara, tag: 2, start: 930, dauer: 100 },
  ];
  assert.deepEqual(stundenplanEintragen(lehrer, WOCHE, zeilen), { ok: false, fehler: "Den Wochenplan ändert nur die Verwaltung." });

  // schon im Plan: Niko hat Ben am Dienstag um 16:00
  const vorher = planung.legePlatzAn({ week_start: WOCHE, weekday: 2, start_min: 960, geplante_dauer: 50, teacher_id: niko.id, student_id: ids.ben, room_id: null });
  assert.equal(vorher.ok, true);
  const probe = stundenplanEintragen(admin, WOCHE, zeilen, { nurPruefen: true });
  assert.equal(probe.ok, true);
  if (!probe.ok) return;
  assert.equal(probe.status, "entwurf");
  assert.equal(probe.zeilen[0].ok, true);
  assert.equal(probe.zeilen[1].ok, false, "Ben is with Niko then");
  assert.match(!probe.zeilen[1].ok ? probe.zeilen[1].fehler : "", /Ben Test hat am Dienstag/);
  assert.equal(probe.zeilen[2].ok, true, "Clara at the same time as Ben: allowed as „gleichzeitig“");
  assert.equal(planung.einheitenFuerWoche(WOCHE).length, 1, "the check wrote nothing");
  assert.deepEqual(wocheFuerImport(WOCHE, [thomas.id]), { status: "entwurf", vorhanden: 0 });
  assert.deepEqual(wocheFuerImport(WOCHE, [niko.id, thomas.id]), { status: "entwurf", vorhanden: 1 });

  const echt = stundenplanEintragen(admin, WOCHE, [zeilen[0], zeilen[2], { ...zeilen[1], studentId: ids.lukas }]);
  assert.equal(echt.ok && echt.eingetragen, 3);
  const thomasPlaetze = planung.einheitenFuerWoche(WOCHE).filter((p) => p.teacher_id === thomas.id);
  assert.equal(thomasPlaetze.length, 3);
  assert.ok(thomasPlaetze.every((p) => p.locked === 1 && p.status === "entwurf" && p.room_id === null), "locked drafts without a room");
  const dienstag = thomasPlaetze.filter((p) => p.weekday === 2);
  assert.deepEqual(dienstag.map((p) => p.gleichzeitig), [1, 1], "Clara and Lukas together");
  assert.equal(thomasPlaetze.find((p) => p.weekday === 1)!.gleichzeitig, 0);

  // ein zweites Mal: alles überschneidet sich, bis „ersetzen“ Thomas' Plätze vorher löscht (Nikos bleibt)
  const nochmal = stundenplanEintragen(admin, WOCHE, [zeilen[0]], { nurPruefen: true });
  assert.equal(nochmal.ok && nochmal.zeilen[0].ok, false);
  const ersetzt = stundenplanEintragen(admin, WOCHE, [zeilen[0]], { ersetzen: true });
  assert.equal(ersetzt.ok && ersetzt.geloescht, 3);
  assert.equal(ersetzt.ok && ersetzt.eingetragen, 1);
  assert.deepEqual(planung.einheitenFuerWoche(WOCHE).map((p) => p.teacher_id).sort(), [niko.id, thomas.id].sort());

  // veröffentlicht: neue Termine sind gleich sichtbar, gelöscht wird hier nichts
  assert.equal(planung.veroeffentlicheWoche(WOCHE).ok, true);
  const offen = stundenplanEintragen(admin, WOCHE, [{ teacherId: thomas.id, studentId: ids.emil, tag: 3, start: 900, dauer: 100 }]);
  assert.equal(offen.ok && offen.status, "veroeffentlicht");
  assert.equal(planung.einheitenFuerWoche(WOCHE, { status: "veroeffentlicht" }).length, 3);
  assert.match(String((stundenplanEintragen(admin, WOCHE, [zeilen[0]], { ersetzen: true }) as { fehler?: string }).fehler), /schon veröffentlicht/);
  assert.equal(stundenplanEintragen(admin, "kein-datum", zeilen).ok, false);
  assert.equal(stundenplanEintragen(admin, WOCHE, []).ok, false);
});

test("rows from the browser: only whole numbers", async () => {
  const { leseImportZeilen } = await import("./stundenplan-foto");
  assert.deepEqual(leseImportZeilen([{ teacherId: 1, studentId: 2, tag: 3, start: 530, dauer: 50 }]), [{ teacherId: 1, studentId: 2, tag: 3, start: 530, dauer: 50 }]);
  assert.equal(leseImportZeilen([{ teacherId: "1", studentId: 2, tag: 3, start: 530, dauer: 50 }]), null);
  assert.equal(leseImportZeilen("x"), null);
  assert.equal(leseImportZeilen(Array.from({ length: 201 }, () => ({}))), null);
});

test("reading a photo: the photo goes to the KI once, as an image, with the plan's function; the letter is remembered", async () => {
  const { ids, alle, thomas, niko } = await setup();
  const router = await import("../ai/router");
  const { liesFoto, stundenplanFotoMoeglich, buchstabenZuordnung, speichereBuchstaben } = await import("./stundenplan-foto");

  const nein = stundenplanFotoMoeglich();
  assert.equal(nein.ok, false, "without KI there is no photo");
  await assert.rejects(liesFoto({ mime: "image/jpeg", data: FOTO }, { teacherId: niko.id, schueler: alle, lehrerIds: [niko.id, thomas.id] }), /nur die KI/);
  process.env.AI_PROVIDER = "manual";
  try {
    assert.match(String((stundenplanFotoMoeglich() as { grund?: string }).grund), /keine Fotos lesen/);
  } finally {
    delete process.env.AI_PROVIDER;
  }

  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    return { parsed: PLAN, refusal: false, model: req.model, usage: { input: 1_800, output: 900, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  try {
    assert.deepEqual(buchstabenZuordnung(), {});
    speichereBuchstaben({ a: thomas.id, "?": niko.id });
    assert.deepEqual(buchstabenZuordnung(), { A: thomas.id }, "letters only, upper case");
    const v = await liesFoto({ mime: "image/jpeg", data: FOTO }, { teacherId: niko.id, schueler: alle, lehrerIds: [niko.id, thomas.id] });
    assert.equal(gefragt.length, 1);
    assert.equal(gefragt[0].fn, "stundenplan");
    const teile = gefragt[0].content as { type: string; base64?: string }[];
    assert.equal(teile[0].type, "image");
    assert.equal(teile[0].base64, FOTO.toString("base64"));
    assert.equal(JSON.stringify(gefragt[0].content).includes("Probe"), false, "no student list goes to the KI");
    assert.equal(v.teacherId, thomas.id, "A is Thomas now");
    assert.equal(v.zeilen.find((z) => z.text === "Anna")!.studentId, ids.anna);

    // the KI answers nothing usable: a sentence for the teacher
    router.setTransport(async (req) => ({ parsed: null, refusal: true, model: req.model, usage: { input: 1_800, output: 10, cacheWrite: 0, cacheRead: 0, reasoning: 0 } }));
    await assert.rejects(liesFoto({ mime: "image/jpeg", data: FOTO }, { teacherId: niko.id, schueler: alle, lehrerIds: [niko.id] }), /konnte das Foto nicht lesen/);
    await assert.rejects(liesFoto({ mime: "image/jpeg", data: Buffer.alloc(6 * 1024 * 1024) }, { teacherId: niko.id, schueler: alle, lehrerIds: [niko.id] }), /zu groß/);
  } finally {
    router.setTransport(null);
  }
});
