/**
 * „Stunden automatisch vorbereiten“ (lib/vorbereitung-auto.ts): die Reihenfolge der Signale, nur geprüfte Pakete,
 * Schulart und Stufe, die Wahl des Lehrers gilt vor dem Vorschlag, und auf diesem Weg geht keine Anfrage an die KI.
 * Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { AIRequest } from "./ai/providers";
import type { Lernpaket } from "./lernpakete";
import type { Signal, SchuelerStufe } from "./vorbereitung-auto";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

// ---------- the rules, without the database ----------

const paket = (o: Partial<Lernpaket> & { id: number; title: string }): Lernpaket => ({
  fach: "Deutsch", schulart: "Volksschule", klasse: 4, schulstufe: 4, thema: "", skill_ids: [], schwierigkeit: "mittel", dauer_minuten: 50, ziel: "",
  quelle: "hand", status: "geprueft", created_by: null, created_at: "", updated_at: "", geprueft_von: 1, geprueft_am: "2026-10-01", praesentation_id: null,
  ki_call_id: null, geprueft_von_name: null, schritt_zahl: 5, minuten_summe: 50, ...o,
});
const vs4: SchuelerStufe = { school_type: "Volksschule", grade: 4, subjects: ["Deutsch"] };
const gleich = (a: string, b: string) => a === b;
const pruefung: Signal = { art: "pruefung", fach: "Deutsch", skill_ids: ["d.faelle"], stoff: ["Die vier Fälle"], thema: "Die vier Fälle", warum: "Schularbeit am 4.11. – Die vier Fälle" };
const schwaeche: Signal = { art: "lernstand", fach: "Deutsch", skill_ids: ["d.artikel"], stoff: [], thema: "Artikel bestimmen", warum: "Schwäche: Artikel bestimmen – Lernstand 40 %" };
const letzte: Signal = { art: "letzte_einheit", fach: "Deutsch", skill_ids: [], stoff: ["Zeitformen"], thema: "Zeitformen", warum: "Letzte Einheit am 20.10.: Zeitformen" };

test("ranking: Prüfung before the student's wish before Lernstand before the last unit, whatever order the signals come in", async () => {
  const { waehleAutomatisch, wunschSignal } = await import("./vorbereitung-auto");
  const faelle = paket({ id: 1, title: "Die vier Fälle", skill_ids: ["d.faelle"] });
  const artikel = paket({ id: 2, title: "Artikel", skill_ids: ["d.artikel"] });
  const zeiten = paket({ id: 3, title: "Zeitformen im Überblick" });
  const wunsch = wunschSignal({ text: "Ich verstehe die Wortarten nicht.", name: "Lena", skill_ids: ["d.wortarten"], fach: "Deutsch", thema: "Wortarten" })!;
  const wortarten = paket({ id: 4, title: "Wortarten kennen", skill_ids: ["d.wortarten"] });
  const e = (pakete: Lernpaket[]) => waehleAutomatisch({ pakete, student: vs4, fach: "Deutsch", signale: [letzte, wunsch, schwaeche, pruefung], verwandt: gleich });
  const alle = [zeiten, wortarten, artikel, faelle];
  let w = e(alle);
  assert.equal(w.art, "paket");
  assert.equal(w.art === "paket" && w.paket.id, 1, "the Prüfung wins");
  assert.equal(w.art === "paket" && w.warum, "Schularbeit am 4.11. – Die vier Fälle");
  assert.equal(w.art === "paket" && w.luecke, null);
  w = e(alle.filter((p) => p !== faelle));
  assert.equal(w.art === "paket" && w.paket.id, 4, "then the student's wish, above the app's recommendations");
  assert.equal(w.art === "paket" && w.warum, "Lena schreibt: „Ich verstehe die Wortarten nicht.“", "in the student's own words");
  assert.equal(w.art === "paket" && w.luecke?.art, "pruefung", "and it says that the Prüfung has no package");
  w = e([zeiten, artikel]);
  assert.equal(w.art === "paket" && w.paket.id, 2, "then the weak skill");
  w = e([zeiten]);
  assert.equal(w.art === "paket" && w.paket.id, 3, "then the last unit's topic");
  assert.equal(w.art === "paket" && w.unsicher, true, "found by a word only: marked as unsure");
  assert.equal(w.art === "paket" && w.passung, "stichwort");
});

test("same signal: a skill match before a word match, then more signals matched, then the title", async () => {
  const { waehleAutomatisch } = await import("./vorbereitung-auto");
  const wort = paket({ id: 1, title: "Die vier Fälle kurz" });
  const skill = paket({ id: 2, title: "Zwei", skill_ids: ["d.faelle"] });
  const beides = paket({ id: 3, title: "Zzz", skill_ids: ["d.faelle", "d.artikel"] });
  const e = (pakete: Lernpaket[]) => waehleAutomatisch({ pakete, student: vs4, fach: "Deutsch", signale: [pruefung, schwaeche], verwandt: gleich });
  assert.equal((e([wort, skill]) as { paket: Lernpaket }).paket.id, 2);
  assert.equal((e([wort, skill, beides]) as { paket: Lernpaket }).paket.id, 3, "it also covers the weak skill");
  const kind = (a: string, b: string) => a === b || (a === "d.faelle.dativ" && b === "d.faelle");
  const teil = paket({ id: 5, title: "Dativ", skill_ids: ["d.faelle.dativ"] });
  const w = waehleAutomatisch({ pakete: [teil], student: vs4, fach: "Deutsch", signale: [pruefung], verwandt: kind });
  assert.equal(w.art === "paket" && w.passung, "faehigkeit", "a Teilfähigkeit of the Prüfung's skill counts");
});

test("Schulart and Schulstufe must fit; a package without them fits every student", async () => {
  const { waehleAutomatisch, stufePasst } = await import("./vorbereitung-auto");
  const ms = paket({ id: 1, title: "Fälle MS", skill_ids: ["d.faelle"], schulart: "Mittelschule", klasse: 1, schulstufe: 5 });
  const vs3 = paket({ id: 2, title: "Fälle VS 3", skill_ids: ["d.faelle"], klasse: 3, schulstufe: 3 });
  const gym = paket({ id: 3, title: "Fälle AHS", skill_ids: ["d.faelle"], schulart: "Gymnasium", klasse: 4, schulstufe: 4 });
  const w = waehleAutomatisch({ pakete: [ms, vs3, gym], student: vs4, fach: "Deutsch", signale: [pruefung], verwandt: gleich });
  assert.equal(w.art, "kein_paket", "other Schulstufe (also one off) and other Schulart are left out");
  assert.equal(w.art === "kein_paket" && w.thema, "Die vier Fälle");
  const jede = paket({ id: 4, title: "Fälle für alle", skill_ids: ["d.faelle"], schulart: "", klasse: null, schulstufe: null });
  assert.equal((waehleAutomatisch({ pakete: [ms, jede], student: vs4, fach: "Deutsch", signale: [pruefung], verwandt: gleich }) as { paket: Lernpaket }).paket.id, 4);
  assert.equal(stufePasst(vs3, { ...vs4, grade: 3 }), true);
  assert.equal(stufePasst(vs3, { ...vs4, grade: 3, stufe_status: "unklar" }), false, "unclear Stufe: only packages without one");
  assert.equal(stufePasst(jede, { ...vs4, stufe_status: "unklar" }), true);
});

test("drafts and unchecked packages are never preselected, only named as Entwurf; archived ones not at all", async () => {
  const { waehleAutomatisch } = await import("./vorbereitung-auto");
  const entwurf = paket({ id: 1, title: "Fälle (Entwurf)", skill_ids: ["d.faelle"], status: "entwurf", quelle: "ki", geprueft_am: null });
  const ki = paket({ id: 2, title: "Fälle von der KI", skill_ids: ["d.faelle"], status: "geprueft", quelle: "ki", geprueft_am: null });
  const archiv = paket({ id: 3, title: "Fälle alt", skill_ids: ["d.faelle"], status: "archiviert" });
  const leer = paket({ id: 4, title: "Fälle ohne Schritte", skill_ids: ["d.faelle"], schritt_zahl: 0 });
  const w = waehleAutomatisch({ pakete: [entwurf, ki, archiv, leer], student: vs4, fach: "Deutsch", signale: [pruefung], verwandt: gleich });
  assert.equal(w.art, "kein_paket");
  assert.deepEqual(w.art === "kein_paket" && w.entwuerfe.map((p) => p.id), [1, 2]);
  const geprueft = paket({ id: 5, title: "Artikel", skill_ids: ["d.artikel"] });
  const w2 = waehleAutomatisch({ pakete: [entwurf, geprueft], student: vs4, fach: "Deutsch", signale: [pruefung, schwaeche], verwandt: gleich });
  assert.equal(w2.art === "paket" && w2.paket.id, 5, "a weaker signal with a checked package rather than a draft for the Prüfung");
});

test("only signals and packages of the unit's subject; without signals there is no suggestion", async () => {
  const { waehleAutomatisch } = await import("./vorbereitung-auto");
  const mathe = paket({ id: 1, title: "Brüche", fach: "Mathematik", skill_ids: ["m.brueche"] });
  const mSignal: Signal = { art: "pruefung", fach: "Mathematik", skill_ids: ["m.brueche"], stoff: ["Brüche"], thema: "Brüche", warum: "Schularbeit am 5.11. – Brüche" };
  const student = { ...vs4, subjects: ["Deutsch", "Mathematik"] };
  assert.equal(waehleAutomatisch({ pakete: [mathe], student, fach: "Deutsch", signale: [mSignal], verwandt: gleich }).art, "ohne_signal", "a Mathe-Schularbeit does not count in a Deutsch unit");
  assert.equal(waehleAutomatisch({ pakete: [mathe], student, fach: "", signale: [mSignal], verwandt: gleich }).art, "paket", "without a subject: the subjects in the profile");
  assert.equal(waehleAutomatisch({ pakete: [mathe], student, fach: "Deutsch", signale: [], verwandt: gleich }).art, "ohne_signal");
});

test("„Mit KI entwerfen“ is prefilled with subject, Klasse, skill, topic and the unit's duration, without a name", async () => {
  const { kiVorgabe, kiHref } = await import("./vorbereitung-auto");
  const v = kiVorgabe(pruefung, { school_type: "Volksschule", klasse: 4, subjects: ["Deutsch"] }, { fach: "Deutsch", dauer: 100, gibtSkill: (id) => id === "d.faelle" });
  assert.deepEqual(v, { skillId: "d.faelle", fach: "Deutsch", thema: "Die vier Fälle", schulart: "Volksschule", klasse: 4, dauer: 100 });
  assert.equal(kiHref(v), "/mehr/lernpakete?ki=1&ki_skill=d.faelle&ki_fach=Deutsch&ki_thema=Die+vier+F%C3%A4lle&ki_schulart=Volksschule&ki_klasse=4&ki_dauer=100");
  assert.equal(kiVorgabe(letzte, { school_type: "", klasse: null, subjects: [] }, { fach: "", dauer: 400, gibtSkill: () => false }).dauer, 240, "within the limits of the form");
});

// ---------- with the database ----------

/** The full example of docs/lernpaket-format.md (Deutsch, VS 4, „Die vier Fälle“, 7 steps). */
function beispiel(): Record<string, unknown> {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  return JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
}

let nr = 0;
async function setup() {
  const { db, resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const units = await import("./units");
  const lp = await import("./lernpakete");
  const c = await import("./cockpit");
  const auto = await import("./vorbereitung-auto");
  const zeit = await import("./planung/zeit");
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    gefragt.push(req);
    throw new Error("no KI in this path");
  });
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 4, klasse: 4, teacher_id: teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const paket = (o: { skills?: string[]; titel?: string; geprueft?: boolean; klasse?: number } = {}) => {
    const d = beispiel();
    d.titel = o.titel ?? `Die vier Fälle ${++nr}`;
    if (o.skills) d.faehigkeiten = o.skills;
    if (o.klasse) d.klasse = o.klasse;
    const out = lp.importiereLernpaket(JSON.stringify(d), teacher.id);
    assert.ok("id" in out, "id" in out ? "" : out.fehler.join("\n"));
    if (o.geprueft !== false) assert.ok("ok" in lp.markiereGeprueft(out.id, teacher.id, { hinweiseGeprueft: true }));
    return lp.getLernpaket(out.id)!;
  };
  const heute = zeit.wienerDatum();
  const schularbeit = (sid: number, inTagen: number, stoff: string[], skills: string[] = []) =>
    repo.addTest({ student_id: sid, date: zeit.tagAddieren(heute, inTagen), subject: "Deutsch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: skills, title: "", topics: stoff, status: "geplant", teacher_id: teacher.id, material_id: null });
  /** a published slot of this teacher `inTagen` days from today at 15:00 */
  const platz = (sid: number, inTagen: number, dauer = 100) => {
    const datum = zeit.tagAddieren(heute, inTagen);
    return Number(
      db()
        .prepare(
          `INSERT INTO geplante_einheiten (week_start, weekday, start_min, geplante_dauer, teacher_id, student_id, room_id, status, locked, created_at, updated_at)
           VALUES (?, ?, 900, ?, ?, ?, NULL, 'veroeffentlicht', 0, datetime('now'), datetime('now'))`,
        )
        .run(zeit.wochenstartVon(datum), zeit.wochentagVon(datum), dauer, teacher.id, sid).lastInsertRowid,
    );
  };
  const kiAufrufe = () => gefragt.length + (db().prepare("SELECT COUNT(*) AS n FROM ai_calls").get() as { n: number }).n;
  return { db, repo, units, lp, c, auto, zeit, router, teacher, schueler, paket, heute, schularbeit, platz, kiAufrufe };
}

test("cockpit: a running unit gets the checked package for the coming Schularbeit, marked as a suggestion; the first tap keeps it", async () => {
  const s = await setup();
  const sid = s.schueler("Ilka Probe");
  const p = s.paket({ titel: "Die vier Fälle" });
  s.paket({ titel: "Artikel", skills: ["deutsch.grammatik.artikel"] });
  s.schularbeit(sid, 12, ["Die vier Fälle"], ["deutsch.grammatik.faelle"]);
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  let d = s.c.cockpit(unit.id);
  assert.equal(d.paket?.id, p.id);
  assert.equal(d.stand.automatisch?.warum, `Schularbeit am ${s.auto.tagMonat(s.zeit.tagAddieren(s.heute, 12))} – Die vier Fälle`);
  assert.equal(d.stand.automatisch?.passung, "faehigkeit");
  assert.equal((s.db().prepare("SELECT COUNT(*) AS n FROM einheit_cockpit").get() as { n: number }).n, 0, "nothing stored while it is only a suggestion");
  s.c.markiereSchritt(unit.id, p.schritte[0].id, "erledigt");
  d = s.c.cockpit(unit.id);
  assert.equal(d.stand.automatisch, null, "used: now it is the unit's own state");
  assert.equal(d.paket?.id, p.id);
  // „Entfernen“ in the cockpit: without a package, and the suggestion does not come back
  s.c.waehlePaket(unit.id, null);
  assert.equal(s.c.cockpit(unit.id).paket, null);
  s.units.finishUnit(unit.id, "abgebrochen");
  assert.equal(s.kiAufrufe(), 0, "no request to the KI on this path");
});

test("the teacher's choice wins: chosen by hand, saved without a package, or removed for the day", async () => {
  const s = await setup();
  const sid = s.schueler("Tamo Probe");
  const passt = s.paket({ titel: "Die vier Fälle" });
  const andere = s.paket({ titel: "Artikel", skills: ["deutsch.grammatik.artikel"] });
  s.schularbeit(sid, 5, ["Die vier Fälle"], ["deutsch.grammatik.faelle"]);

  // chosen by hand before the unit
  assert.ok("ok" in s.c.bereiteVor(sid, s.heute, andere.id, s.teacher.id));
  let unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  let d = s.c.cockpit(unit.id);
  assert.equal(d.paket?.id, andere.id, "never overwritten by the suggestion");
  assert.equal(d.stand.automatisch, null);
  s.units.finishUnit(unit.id, "abgebrochen");

  // „Entfernen“ for the day: no package, also not the suggestion
  s.auto.entferneVorschlag(sid, s.heute, s.teacher.id);
  assert.equal(s.c.vorbereitung(sid, s.heute), null, "the choice by hand is gone too");
  unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  assert.equal(s.c.cockpit(unit.id).paket, null);
  // choosing by hand again lifts „Entfernen“
  assert.ok("ok" in s.c.bereiteVor(sid, s.heute, passt.id, s.teacher.id));
  assert.equal(s.auto.ohnePaketMarkiert(sid, s.heute), false);
  assert.ok("ok" in s.c.bereiteVor(sid, s.heute, null, s.teacher.id));
  assert.equal(s.c.cockpit(unit.id).stand.automatisch?.warum.startsWith("Schularbeit am"), true, "„Zurücknehmen“: the suggestion comes back");
  // saved without a package in the cockpit
  s.c.waehlePaket(unit.id, null);
  assert.equal(s.c.cockpit(unit.id).paket, null);
  assert.equal(s.c.cockpit(unit.id).stand.automatisch, null);
  s.units.finishUnit(unit.id, "abgebrochen");

  // an ended unit never gets a suggestion afterwards
  const u3 = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  s.units.finishUnit(u3.id, "abgebrochen");
  assert.equal(s.auto.autoFuerEinheit(s.units.getUnit(u3.id)!), null);
  assert.equal(s.kiAufrufe(), 0);
});

test("a draft is never preselected: the cockpit stays without a package and names what is missing", async () => {
  const s = await setup();
  const sid = s.schueler("Rena Probe");
  const entwurf = s.paket({ titel: "Die vier Fälle", geprueft: false });
  s.schularbeit(sid, 3, ["Die vier Fälle"], ["deutsch.grammatik.faelle"]);
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch" }).unit;
  assert.equal(s.c.cockpit(unit.id).paket, null);
  const w = s.auto.autoFuerEinheit(unit)!;
  assert.equal(w.art, "kein_paket");
  assert.equal(w.art === "kein_paket" && w.thema, "Die vier Fälle");
  assert.deepEqual(w.art === "kein_paket" && w.entwuerfe.map((p) => p.id), [entwurf.id]);
  s.units.finishUnit(unit.id, "abgebrochen");
  assert.equal(s.kiAufrufe(), 0);
});

test("coming units: published slots of the next 7 days, with the teacher's choice, the suggestion or „Kein Paket“", async () => {
  const s = await setup();
  const a = s.schueler("Ada Probe");
  const b = s.schueler("Bert Probe");
  const c = s.schueler("Cleo Probe");
  const p = s.paket({ titel: "Die vier Fälle" });
  const andere = s.paket({ titel: "Artikel", skills: ["deutsch.grammatik.artikel"] });
  s.schularbeit(a, 6, ["Die vier Fälle"], ["deutsch.grammatik.faelle"]);
  s.schularbeit(b, 4, ["Satzglieder"]);
  s.platz(a, 2);
  s.platz(b, 3, 50);
  s.platz(c, 1);
  s.platz(a, 9); // too far ahead
  assert.ok("ok" in s.c.bereiteVor(c, s.zeit.tagAddieren(s.heute, 1), andere.id, s.teacher.id));
  // a slot whose unit already ran is no longer coming
  const lauf = s.platz(b, 0);
  const u = s.db().prepare("INSERT INTO units (teacher_id, student_id, status, started_at, ended_at, last_activity_at) VALUES (?, ?, 'beendet', datetime('now'), datetime('now'), datetime('now'))").run(s.teacher.id, b).lastInsertRowid;
  s.db().prepare("UPDATE geplante_einheiten SET unit_id = ? WHERE id = ?").run(u, lauf);
  // today's slot of a student whose unit already started today (not linked to the slot) is not coming either
  s.platz(c, 0);
  s.db().prepare("INSERT INTO units (teacher_id, student_id, status, started_at, last_activity_at) VALUES (?, ?, 'gestartet', ?, ?)").run(s.teacher.id, c, new Date().toISOString(), new Date().toISOString());
  // a draft slot is not published
  s.db().prepare("UPDATE geplante_einheiten SET status = 'entwurf' WHERE id = ?").run(s.platz(c, 4));

  const liste = s.auto.naechsteEinheiten(s.teacher.id);
  assert.deepEqual(liste.map((x) => [x.studentName, x.datum]), [
    ["Cleo Probe", s.zeit.tagAddieren(s.heute, 1)],
    ["Ada Probe", s.zeit.tagAddieren(s.heute, 2)],
    ["Bert Probe", s.zeit.tagAddieren(s.heute, 3)],
  ]);
  const [cleo, ada, bert] = liste;
  assert.equal(cleo.wahl.art === "gewaehlt" && cleo.wahl.paket.id, andere.id, "chosen by hand");
  assert.equal(ada.wahl.art === "paket" && ada.wahl.paket.id, p.id);
  assert.equal(ada.wahl.art === "paket" && ada.wahl.warum, `Schularbeit am ${s.auto.tagMonat(s.zeit.tagAddieren(s.heute, 6))} – Die vier Fälle`);
  assert.equal(ada.zeit, "15:00");
  assert.equal(bert.wahl.art, "kein_paket");
  assert.equal(bert.wahl.art === "kein_paket" && bert.wahl.thema, "Satzglieder");
  assert.ok(bert.ki);
  assert.equal(bert.ki!.dauer, 50, "the slot's duration");
  assert.equal(s.auto.kiHref(bert.ki!).includes("ki_thema=Satzglieder"), true);
  assert.ok(!s.auto.kiHref(bert.ki!).includes("Bert"), "no name in the link");

  // „Entfernen“ on the start page
  s.auto.entferneVorschlag(a, s.zeit.tagAddieren(s.heute, 2), s.teacher.id);
  assert.equal(s.auto.naechsteEinheiten(s.teacher.id)[1].wahl.art, "entfernt");
  s.auto.vorschlagErlauben(a, s.zeit.tagAddieren(s.heute, 2));
  assert.equal(s.auto.naechsteEinheiten(s.teacher.id)[1].wahl.art, "paket");
  assert.equal(s.kiAufrufe(), 0, "the list never asks the KI");
});

test("a wish that names no skill changes nothing: no signal, the same choice as without it", async () => {
  const { waehleAutomatisch, wunschSignal } = await import("./vorbereitung-auto");
  const ohne = { text: "Bitte mehr Pausen", name: "Lena", skill_ids: [] };
  assert.equal(wunschSignal(ohne), null);
  assert.equal(wunschSignal({ ...ohne, text: "   ", skill_ids: ["d.faelle"] }), null, "nothing written");
  const zeitformen = paket({ id: 1, title: "Pausen und Zeitformen", skill_ids: ["d.zeiten"] });
  const artikel = paket({ id: 2, title: "Artikel", skill_ids: ["d.artikel"] });
  const e = (signale: Signal[]) => waehleAutomatisch({ pakete: [zeitformen, artikel], student: vs4, fach: "Deutsch", signale, verwandt: gleich });
  const signale = [schwaeche, letzte];
  // the caller drops a wish without skills before it becomes a signal, and the words are never matched as Stichwort
  const mitWunsch = [...signale, ...[ohne].flatMap((w) => wunschSignal(w) ?? [])];
  assert.deepEqual(e(mitWunsch), e(signale));
  assert.equal(e([]).art, "ohne_signal");
});

test("„Für nächstes Mal“ from the student app: preselected above Lernstand, quoted with the first name, only for the next unit, never to the KI", async () => {
  const s = await setup();
  const n = await import("./schueler-notiz");
  const sid = s.schueler("Lena Wunschtest");
  const faelle = s.paket({ titel: "Die vier Fälle" });
  const artikel = s.paket({ titel: "Artikel", skills: ["deutsch.grammatik.artikel"] });
  // a weak skill from the Lernstand: wrong answers on Artikel
  const ws = s.repo.createWorksheet(
    { title: "Artikel", subject: "Deutsch", grade: 4, school_type: "Volksschule", klasse: 4, topic: "Artikel", difficulty: "mittel", task_type: "free", kind: "uebung", source: "manuell", skill_ids: ["deutsch.grammatik.artikel"] },
    [{ type: "free", skillId: "deutsch.grammatik.artikel", difficulty: "mittel", prompt: "Welcher Artikel passt zu „Haus“?", data: {}, answer: { accepted: ["das"], mode: "text" }, solution: "", hints: [], errorMap: [] }],
  );
  const asg = s.repo.assignWorksheet(ws, sid, "");
  const taskId = s.repo.listTasks(ws)[0].id;
  for (let i = 1; i <= 3; i++)
    s.db().prepare("INSERT INTO attempts (assignment_id, task_id, student_id, skill_id, attempt_no, answer, correct, final) VALUES (?, ?, ?, ?, ?, 'der', 0, 1)").run(asg, taskId, sid, "deutsch.grammatik.artikel", i);
  s.platz(sid, 1);
  s.platz(sid, 3);
  let liste = s.auto.naechsteEinheiten(s.teacher.id);
  assert.equal(liste[0].wahl.art === "paket" && liste[0].wahl.paket.id, artikel.id, "without a wish: the weak skill");

  // a wish that names no skill changes nothing
  assert.ok("ok" in n.speichereWunsch(sid, "Bitte wieder mit dem Tablet arbeiten"));
  liste = s.auto.naechsteEinheiten(s.teacher.id);
  assert.equal(liste[0].wahl.art === "paket" && liste[0].wahl.paket.id, artikel.id);
  assert.ok(liste[0].wahl.art === "paket" && !liste[0].wahl.warum.includes("schreibt"));

  const satz = "Wir haben die vier Fälle begonnen. Den dritten und vierten Fall verstehe ich nicht.";
  assert.ok("ok" in n.speichereWunsch(sid, satz));
  liste = s.auto.naechsteEinheiten(s.teacher.id);
  assert.equal(liste[0].wahl.art === "paket" && liste[0].wahl.paket.id, faelle.id, "the wish wins over the weak skill");
  assert.equal(liste[0].wahl.art === "paket" && liste[0].wahl.warum, `Lena schreibt: „${satz}“`);
  assert.equal(liste[1].wahl.art === "paket" && liste[1].wahl.paket.id, artikel.id, "the unit after next: the wish was for the next one only");

  // a Prüfung still comes first
  s.schularbeit(sid, 8, ["Artikel"], ["deutsch.grammatik.artikel"]);
  assert.equal(s.auto.naechsteEinheiten(s.teacher.id)[0].wahl.art === "paket" && (s.auto.naechsteEinheiten(s.teacher.id)[0].wahl as { paket: Lernpaket }).paket.id, artikel.id);
  s.db().prepare("DELETE FROM tests WHERE student_id = ?").run(sid);

  // in the cockpit: the wish written before the unit
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Deutsch", at: Date.now() + 1000 }).unit;
  const d = s.c.cockpit(unit.id);
  assert.equal(d.paket?.id, faelle.id);
  assert.equal(d.stand.automatisch?.warum, `Lena schreibt: „${satz}“`);
  s.units.finishUnit(unit.id, "abgebrochen");

  // no package for the wish: „Kein Paket“ names the skill; the KI form gets the skill, never the student's words
  s.db().prepare("UPDATE lernpakete SET status = 'entwurf' WHERE id = ?").run(faelle.id);
  const kein = s.auto.naechsteEinheiten(s.teacher.id)[0];
  assert.equal(kein.wahl.art === "paket" && kein.wahl.luecke?.art, "wunsch");
  assert.ok(kein.ki && kein.ki.skillId === "deutsch.grammatik.faelle");
  assert.ok(!s.auto.kiHref(kein.ki!).includes("verstehe") && !s.auto.kiHref(kein.ki!).includes("Lena"), "no words of the student, no name");
  assert.equal(s.kiAufrufe(), 0, "nothing went to the KI");
  assert.equal((s.db().prepare("SELECT COUNT(*) AS n FROM vorbereitung_ohne_paket").get() as { n: number }).n, 0, "nothing stored");
  s.router.setTransport(null);
});
