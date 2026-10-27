/**
 * Unterlagen bei „Das zeigst du“ (lib/unterlagen-unterricht.ts): eine mitgebrachte Erklärung steht im Schritt, der ihr Thema erklärt;
 * ein Blatt mit Aufgaben oder ein Inhaltsverzeichnis nie; frühere Erklärungen desselben Schülers über ihre gespeicherte Lesung, nie
 * die eines anderen Schülers; höchstens drei. Ohne passenden Schritt nur nach der Wahl der Lehrkraft. Ohne KI geht die Wahl auch.
 *
 * Kein Schlüssel, kein Aufruf nach außen: der Transport wird ersetzt. Alle Namen und Texte sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { SchrittZiel, UnterlageKandidat } from "./unterlagen-unterricht";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "unterlagen-unterricht-"));
test.after(() => fs.rmSync(process.env.UPLOADS_PATH!, { recursive: true, force: true }));
for (const k of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED",
  "AI_MONTHLY_BUDGET_USD", "AI_MONTHLY_BUDGET_EUR", "ANTHROPIC_MONTHLY_BUDGET_USD", "AI_STUDENT_WARN_EUR", "AI_STUDENT_LIMIT_EUR", "AI_USD_PER_EUR",
])
  delete process.env[k];

const PAST = "englisch.tenses.pastsimple";
const PERFECT = "englisch.tenses.presentperfect";

const punkt = (gruppe: string, original: string, inhalt: string, o: Record<string, unknown> = {}) => ({ gruppe, original, inhalt, einheit: null, dokument: 1, status: "pruefung", grund: null, skill_id: null, ...o });
const antwort = (dokumente: { nr: number; rolle: string; titel: string }[], punkte: ReturnType<typeof punkt>[]) => ({ art: null, fach: "Englisch", datum: null, titel: null, dokumente, punkte, schwierigkeiten: [], termin_text: null, unsicher: [] });

/** Vier Blätter von heute: eine Erklärung zum Past Simple, ein Blatt mit Aufgaben dazu, ein Inhaltsverzeichnis und eine Erklärung ohne Fähigkeit. */
const HEUTE = antwort(
  [
    { nr: 1, rolle: "erklaerung", titel: "Past Simple – Merkblatt" },
    { nr: 2, rolle: "aufgaben", titel: "Übungsblatt Past Simple" },
    { nr: 3, rolle: "inhaltsverzeichnis", titel: "Contents" },
    { nr: 4, rolle: "erklaerung", titel: "Ausflug in den Zoo" },
  ],
  [
    punkt("grammatik", "Past Simple", "Past Simple", { skill_id: PAST }),
    punkt("grammatik", "Past Simple exercises", "Past Simple", { dokument: 2, skill_id: PAST }),
    punkt("grammatik", "Present Perfect", "Present Perfect", { dokument: 3, skill_id: PERFECT }),
    punkt("sonstiges", "Ausflug in den Zoo", "Ausflug in den Zoo", { dokument: 4 }),
  ],
);
/** Ein früheres Blatt: eine Erklärung zum Past Simple. */
const FRUEHER = antwort([{ nr: 1, rolle: "erklaerung", titel: "Regeln Past Simple" }], [punkt("grammatik", "Past Simple", "Past Simple", { skill_id: PAST })]);

let nr = 0;
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`erfundenes Blatt ${++nr}`)]);

async function setup(o: { ki?: boolean } = {}) {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  const u = await import("./unterlagen-unterricht");
  const vg = await import("./vorgabe");
  const ps = await import("./pruefungsstoff");
  const { saveUpload } = await import("./materials");
  let naechste: unknown = HEUTE;
  router.resetRouter();
  // without KI: no transport, no key; the files are stored but not read
  router.setTransport(o.ki === false ? null : async (req) => ({ parsed: naechste, refusal: false, model: req.model, usage: { input: 1_000, output: 1_000, cacheWrite: 0, cacheRead: 0, reasoning: 0 } }));
  const teacher = repo.listTeachers()[0];
  const heute = zeit.wienerDatum();
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: ["Englisch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "", ki_hinweise: "",
    });
  const datei = (sid: number, title = "Für heute") => saveUpload({ name: "blatt.jpg", data: jpeg() }, { title, studentId: sid, teacherId: teacher.id }).id;
  /** an earlier explanation of this student, read on its own (saved reading, role on the file) */
  const frueher = async (sid: number) => {
    const id = datei(sid, "Merkblatt");
    naechste = FRUEHER;
    await ps.liesPruefungsstoff({ materialIds: [id], studentId: sid, teacherId: teacher.id, heute });
    naechste = HEUTE;
    return id;
  };
  /** a running Englisch unit with today's four sheets as its Vorgabe */
  const start = async (sid: number, o: { lesen?: boolean } = {}) => {
    const unit = units.startUnit(teacher.id, sid, { subject: "Englisch" }).unit;
    const ids = [datei(sid), datei(sid), datei(sid), datei(sid)];
    const out = await vg.speichereVorgabe({ unitId: unit.id, teacherId: teacher.id, text: "", materialIds: ids, testId: null, keinName: o.lesen !== false, heute });
    assert.ok("ok" in out, JSON.stringify(out));
    return { unit, ids, cd: () => c.cockpit(unit.id, { mitPlan: true }) };
  };
  const schritt = (unitId: number, art: string) => c.cockpit(unitId, { mitPlan: true }).plan.find((s) => s.art === art)!;
  return { db, repo, u, vg, c, teacher, schueler, datei, frueher, start, schritt };
}

// ---------- ohne Datenbank ----------

const kandidat = (o: Partial<UnterlageKandidat> = {}): UnterlageKandidat => ({ materialId: 1, titel: "Blatt", art: "Foto", datum: "2026-10-27", heute: true, rolle: "erklaerung", skillIds: [PAST], themen: [], schrittId: null, ...o });
const ziel = (o: Partial<SchrittZiel> = {}): SchrittZiel => ({ id: -2, skillId: PAST, thema: "Past Simple", zeigt: true, ...o });

test("passtZumSchritt: nur „erklärt ein Thema“, nur am Schritt, der erklärt, nur mit der Fähigkeit des Schritts", async () => {
  const { passtZumSchritt } = await import("./unterlagen-unterricht");
  assert.equal(passtZumSchritt(kandidat(), ziel()), true);
  for (const rolle of ["aufgaben", "inhaltsverzeichnis", "stoffzettel", "sonstiges", null] as const) assert.equal(passtZumSchritt(kandidat({ rolle }), ziel()), false, String(rolle));
  assert.equal(passtZumSchritt(kandidat(), ziel({ zeigt: false })), false, "Üben oder Lernkontrolle zeigt keine Erklärung");
  assert.equal(passtZumSchritt(kandidat({ skillIds: [PERFECT] }), ziel()), false);
  assert.equal(passtZumSchritt(kandidat({ skillIds: [] }), ziel()), false, "keine Fähigkeit: nie geraten");
});

test("passtZumSchritt: ein Planschritt ohne Fähigkeit passt über sein Thema (Groß- und Kleinschreibung egal), nicht über Teile davon", async () => {
  const { passtZumSchritt } = await import("./unterlagen-unterricht");
  const ohne = ziel({ skillId: null, thema: "Ausflug in den Zoo" });
  assert.equal(passtZumSchritt(kandidat({ skillIds: [], themen: ["AUSFLUG IN  den Zoo"] }), ohne), true);
  assert.equal(passtZumSchritt(kandidat({ skillIds: [], themen: ["Zoo"] }), ohne), false);
  assert.equal(passtZumSchritt(kandidat({ skillIds: [], themen: ["Ausflug in den Zoo"] }), ziel({ skillId: null, thema: null })), false);
  // a step with a skill never matches by its topic alone
  assert.equal(passtZumSchritt(kandidat({ skillIds: [], themen: ["Past Simple"] }), ziel()), false);
});

test("passtZumSchritt: die Wahl der Lehrkraft gilt genau für ihren Schritt, auch wenn er nichts erklärt", async () => {
  const { passtZumSchritt } = await import("./unterlagen-unterricht");
  const gewaehlt = kandidat({ skillIds: [], schrittId: -4 });
  assert.equal(passtZumSchritt(gewaehlt, ziel({ id: -4, zeigt: false })), true);
  assert.equal(passtZumSchritt(gewaehlt, ziel({ id: -2 })), false);
  assert.equal(passtZumSchritt(kandidat({ rolle: "aufgaben", schrittId: -4 }), ziel({ id: -4 })), false, "nur eine Erklärung");
});

test("unterlagenFuer: höchstens drei, die von heute zuerst, dann die neueste", async () => {
  const { unterlagenFuer, MAX_UNTERLAGEN } = await import("./unterlagen-unterricht");
  const alle = [
    kandidat({ materialId: 1, heute: false, datum: "2026-09-01" }),
    kandidat({ materialId: 2, heute: false, datum: "2026-10-01" }),
    kandidat({ materialId: 3, heute: true, datum: "2026-10-27" }),
    kandidat({ materialId: 4, heute: false, datum: "2026-10-20" }),
    kandidat({ materialId: 5, heute: true, datum: "2026-10-27", rolle: "aufgaben" }),
  ];
  assert.equal(MAX_UNTERLAGEN, 3);
  assert.deepEqual(unterlagenFuer(alle, ziel()).map((k) => k.materialId), [3, 4, 2]);
});

// ---------- in der Einheit ----------

test("im Unterricht: die Erklärung von heute steht bei „Erklären“, nicht beim Üben; Aufgabenblatt und Inhaltsverzeichnis nie", async () => {
  const s = await setup();
  const sid = s.schueler("Mira Beispiel");
  const { unit, ids } = await s.start(sid);
  const erklaeren = s.schritt(unit.id, "erklaeren");
  assert.equal(erklaeren.skillId, PAST);
  const im = s.u.unterlagenImSchritt(unit.id, erklaeren.id);
  assert.deepEqual(im.map((x) => x.materialId), [ids[0]]);
  assert.equal(im[0].titel, "Past Simple – Merkblatt");
  assert.equal(im[0].heute, true);
  for (const art of ["einstieg", "ueben", "kontrolle", "abschluss"]) assert.deepEqual(s.u.unterlagenImSchritt(unit.id, s.schritt(unit.id, art).id), [], art);
  // the explanation without a skill waits for the teacher's pick; the others are no explanations
  assert.deepEqual(s.u.zumZuordnen(unit.id), [{ materialId: ids[3], schrittId: null }]);
});

test("frühere Erklärungen desselben Schülers kommen nach denen von heute, höchstens drei; die eines anderen Schülers nie", async () => {
  const s = await setup();
  const sid = s.schueler("Mira Beispiel");
  const fremd = s.schueler("Jonas Erfunden");
  const fremdeDatei = await s.frueher(fremd);
  const frueher = [await s.frueher(sid), await s.frueher(sid), await s.frueher(sid)];
  const { unit, ids } = await s.start(sid);
  const erklaeren = s.schritt(unit.id, "erklaeren");
  const im = s.u.unterlagenImSchritt(unit.id, erklaeren.id);
  assert.deepEqual(im.map((x) => x.materialId), [ids[0], frueher[2], frueher[1]]);
  assert.equal(im[1].heute, false);
  assert.equal(im[1].titel, "Regeln Past Simple");
  assert.ok(!s.u.kandidatenDerEinheit(unit.id).some((k) => k.materialId === fremdeDatei), "die Datei eines anderen Schülers");
  // an earlier sheet with the role „enthält Aufgaben“ is no explanation
  const { setzeRolle } = await import("./pruefungsstoff");
  for (const id of frueher) setzeRolle(id, "aufgaben");
  assert.deepEqual(s.u.unterlagenImSchritt(unit.id, erklaeren.id).map((x) => x.materialId), [ids[0]]);
});

test("die gewählte Rolle geht vor: „enthält Aufgaben“ statt Erklärung nimmt die Unterlage aus dem Schritt", async () => {
  const s = await setup();
  const sid = s.schueler("Mira Beispiel");
  const { unit, ids } = await s.start(sid);
  const erklaeren = s.schritt(unit.id, "erklaeren");
  assert.ok(s.vg.aendereRolle(unit.id, ids[0], "aufgaben"));
  assert.deepEqual(s.u.unterlagenImSchritt(unit.id, erklaeren.id), []);
  // and the sheet of tasks the teacher calls an explanation shows
  assert.ok(s.vg.aendereRolle(unit.id, ids[1], "erklaerung"));
  assert.deepEqual(s.u.unterlagenImSchritt(unit.id, s.schritt(unit.id, "erklaeren").id).map((x) => x.materialId), [ids[1]]);
});

test("„Passt zu welchem Schritt?“: erst nach der Wahl im Schritt; nur ein Schritt dieser Einheit, nur eine Erklärung von heute", async () => {
  const s = await setup();
  const sid = s.schueler("Mira Beispiel");
  const { unit, ids } = await s.start(sid);
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  for (const x of plan) assert.ok(!s.u.unterlagenImSchritt(unit.id, x.id).some((y) => y.materialId === ids[3]), "vor der Wahl nirgends");
  const ueben = s.schritt(unit.id, "ueben");
  assert.equal(s.u.waehleSchritt(unit.id, ids[3], 999, s.teacher.id), false, "kein Schritt dieser Einheit");
  assert.equal(s.u.waehleSchritt(unit.id, ids[1], ueben.id, s.teacher.id), false, "ein Blatt mit Aufgaben");
  const andere = await s.frueher(sid);
  assert.equal(s.u.waehleSchritt(unit.id, andere, ueben.id, s.teacher.id), false, "keine Datei der Vorgabe");
  assert.equal(s.u.waehleSchritt(unit.id, ids[3], ueben.id, s.teacher.id), true);
  assert.deepEqual(s.u.unterlagenImSchritt(unit.id, ueben.id).map((x) => x.materialId), [ids[3]]);
  assert.deepEqual(s.u.zumZuordnen(unit.id), [{ materialId: ids[3], schrittId: ueben.id }], "die Wahl bleibt änderbar");
  // „Zu keinem“: back under the Vorgabe, in no step
  assert.equal(s.u.waehleSchritt(unit.id, ids[3], null, s.teacher.id), true);
  assert.deepEqual(s.u.unterlagenImSchritt(unit.id, ueben.id), []);
});

test("ohne KI: nichts gelesen, nichts von selbst im Schritt; mit Rolle und Wahl der Lehrkraft steht die Unterlage doch da", async () => {
  const s = await setup({ ki: false });
  const sid = s.schueler("Mira Beispiel");
  const { unit, ids } = await s.start(sid);
  assert.equal(s.db().prepare("SELECT COUNT(*) FROM stoff_lesungen").pluck().get(), 0, "keine Lesung");
  const plan = s.c.cockpit(unit.id, { mitPlan: true }).plan;
  assert.ok(plan.length > 0);
  for (const x of plan) assert.deepEqual(s.u.unterlagenImSchritt(unit.id, x.id), []);
  assert.deepEqual(s.u.zumZuordnen(unit.id), [], "ohne Rolle keine Erklärung");
  assert.ok(s.vg.aendereRolle(unit.id, ids[2], "erklaerung"));
  assert.deepEqual(s.u.zumZuordnen(unit.id), [{ materialId: ids[2], schrittId: null }]);
  const ziel = plan.find((x) => x.art !== "einstieg") ?? plan[0];
  assert.ok(s.u.waehleSchritt(unit.id, ids[2], ziel.id, s.teacher.id));
  const im = s.u.unterlagenImSchritt(unit.id, ziel.id);
  assert.deepEqual(im.map((x) => x.materialId), [ids[2]]);
  assert.equal(im[0].titel, "Für heute", "ohne Lesung der Titel des Materials");
});

test("Abschluss: „Unterlage gezeigt“ nur nach Öffnen, nur eine Unterlage, die der Schritt zeigt", async () => {
  const s = await setup();
  const sid = s.schueler("Mira Beispiel");
  const { unit, ids } = await s.start(sid);
  const erklaeren = s.schritt(unit.id, "erklaeren");
  const { abschlussKarte } = await import("./abschluss");
  const leer = { aufgaben: [], fehler: [], beobachtungen: [], reaktionen: [], minitest: null, vorgabe: [], geuebt: [], pruefung: null, eigene: {} };
  assert.deepEqual(s.u.unterlagenDerEinheit(unit.id), [], "angeboten ist nicht gezeigt");
  assert.ok(!abschlussKarte(null, null, [], { ...leer, unterlagen: [] }).gemacht.some((z) => z.text.startsWith("Unterlage gezeigt")));
  assert.equal(s.u.merkeGezeigt(unit.id, s.schritt(unit.id, "ueben").id, ids[0], s.teacher.id), false, "nicht der Schritt dieser Unterlage");
  assert.equal(s.u.merkeGezeigt(unit.id, erklaeren.id, ids[1], s.teacher.id), false, "ein Blatt mit Aufgaben");
  assert.equal(s.u.merkeGezeigt(unit.id, erklaeren.id, ids[0], s.teacher.id), true);
  assert.equal(s.u.merkeGezeigt(unit.id, erklaeren.id, ids[0], s.teacher.id), true, "zweimal geöffnet, einmal genannt");
  assert.deepEqual(s.u.unterlagenDerEinheit(unit.id), [{ materialId: ids[0], titel: "Past Simple – Merkblatt" }]);
  const karte = abschlussKarte(null, null, [], { ...leer, unterlagen: s.u.unterlagenDerEinheit(unit.id).map((x) => x.titel) });
  assert.deepEqual(
    karte.gemacht.filter((z) => z.text.startsWith("Unterlage")).map((z) => z.text),
    ["Unterlage gezeigt: Past Simple – Merkblatt"],
  );
});
