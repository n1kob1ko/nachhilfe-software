import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Lernpaket } from "./lernpakete";
import type * as repo from "./repo";

process.env.DATABASE_PATH = ":memory:";

/** The full example of docs/lernpaket-format.md (Deutsch, VS 4, „Die vier Fälle“, 7 steps). */
function beispiel(): Record<string, unknown> & { schritte: Record<string, unknown>[] } {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  return JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
}

let nr = 0;
async function setup() {
  const r = await import("./repo");
  const units = await import("./units");
  const lp = await import("./lernpakete");
  const c = await import("./cockpit");
  const teacher = r.listTeachers()[0];
  const schueler = (name: string) =>
    r.createStudent({
      name, grade: 4, klasse: 4, teacher_id: teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const paket = (aendern: (d: ReturnType<typeof beispiel>) => void = () => {}) => {
    const d = beispiel();
    d.titel = `Die vier Fälle ${++nr}`;
    aendern(d);
    const out = lp.importiereLernpaket(JSON.stringify(d), teacher.id);
    assert.ok("id" in out, "id" in out ? "" : out.fehler.join("\n"));
    return lp.getLernpaket(out.id)!;
  };
  return { repo: r, units, lp, c, teacher, schueler, paket };
}

// ---------- the rules of a unit's state ----------

test("steps: the unit's own order, done and skipped, the next open step comes up", async () => {
  const { ablauf, aktuellerSchritt, markiere, verschiebe, zusammenfassung } = await import("./cockpit");
  const schritte = [1, 2, 3, 4].map((id) => ({ id, titel: `S${id}` }));
  assert.deepEqual(ablauf(schritte, []), [1, 2, 3, 4], "without an order: the package's");
  assert.deepEqual(ablauf(schritte, [3, 1, 9]), [3, 1, 2, 4], "a step that is gone drops out, a new one comes at the end");

  let s = { aktuell: null as number | null, erledigt: [] as number[], uebersprungen: [] as number[] };
  const order = [1, 2, 3, 4];
  assert.equal(aktuellerSchritt(order, s), 1);
  s = markiere(s, order, 1, "erledigt");
  assert.equal(s.aktuell, 2, "„Erledigt / Weiter“ shows the next open step");
  s = markiere(s, order, 2, "uebersprungen");
  assert.equal(s.aktuell, 3);
  s = markiere(s, order, 4, "erledigt");
  assert.equal(s.aktuell, 3, "after the last step it goes back to the first open one");
  s = markiere(s, order, 2, "erledigt");
  assert.deepEqual(s.uebersprungen, [], "a skipped step done later is no longer skipped");
  assert.deepEqual(s.erledigt, [1, 4, 2]);
  s = markiere(s, order, 3, "erledigt");
  assert.equal(s.aktuell, null, "all done: no step left");
  assert.equal(aktuellerSchritt(order, s), null);
  s = markiere(s, order, 4, "offen");
  assert.equal(s.aktuell, 4, "„Wieder öffnen“ shows the step again");
  assert.deepEqual(s.erledigt, [1, 2, 3]);

  assert.deepEqual(verschiebe(order, 3, -1), [1, 3, 2, 4]);
  assert.deepEqual(verschiebe(order, 1, -1), order, "the first step cannot move further up");
  assert.deepEqual(verschiebe(order, 4, 1), order);

  const z = zusammenfassung(schritte, [2, 1, 3, 4], { erledigt: [1, 2], uebersprungen: [3] });
  assert.deepEqual(z.erledigt.map((x) => x.id), [2, 1], "in the order of the unit");
  assert.deepEqual(z.uebersprungen.map((x) => x.id), [3]);
  assert.deepEqual(z.nichtErreicht.map((x) => x.id), [4]);
});

test("the documentation names only what the teacher tapped, and replaces its own lines", async () => {
  const { dokuTexte, mitZeile } = await import("./cockpit");
  const s = (titel: string) => ({ titel });
  assert.equal(dokuTexte("Brüche", { erledigt: [], uebersprungen: [], nichtErreicht: [s("A"), s("B")] }), null, "cockpit not used: nothing is written");
  const t = dokuTexte("Brüche", { erledigt: [s("Einstieg"), s("Erklärung")], uebersprungen: [s("Beispiel")], nichtErreicht: [s("Kontrolle")] })!;
  assert.equal(t.gemacht, "Lernpaket „Brüche“: 2 von 4 Schritten erledigt (Einstieg, Erklärung). Übersprungen: Beispiel. Nicht erreicht: Kontrolle.");
  assert.equal(t.wiederholen, "Übersprungen in „Brüche“: Beispiel");
  assert.equal(t.naechstesMal, "Weiter mit „Brüche“: Kontrolle");
  const alles = dokuTexte("Brüche", { erledigt: [s("A")], uebersprungen: [], nichtErreicht: [] })!;
  assert.equal(alles.wiederholen, null);
  assert.equal(alles.naechstesMal, null);

  const einmal = mitZeile("Brüche kürzen", "Weiter mit „", t.naechstesMal);
  assert.equal(einmal, "Brüche kürzen\nWeiter mit „Brüche“: Kontrolle");
  assert.equal(mitZeile(einmal, "Weiter mit „", "Weiter mit „Brüche“: Abschluss"), "Brüche kürzen\nWeiter mit „Brüche“: Abschluss", "a second run replaces, it does not add");
  assert.equal(mitZeile(einmal, "Weiter mit „", null), "Brüche kürzen");
});

// ---------- the suggestion rules ----------

const paketFix = (o: Partial<Lernpaket> & { id: number }): Lernpaket => ({
  title: `Paket ${o.id}`, fach: "Mathematik", schulart: "Mittelschule", klasse: 1, schulstufe: 5, thema: "", skill_ids: [], schwierigkeit: "mittel", dauer_minuten: 50, ziel: "",
  quelle: "hand", status: "geprueft", created_by: null, created_at: "", updated_at: "", geprueft_von: null, geprueft_am: "2026-10-01", geprueft_von_name: null, schritt_zahl: 5, minuten_summe: 50, praesentation_id: null,
  ...o,
});
const skillFix = (id: string, name: string) => ({ id, name, subject: "Mathematik", area: "Bruchrechnung" }) as repo.Skill;

test("suggestions: exam first, then the recommendation, then an unfinished package; checked ones go first", async () => {
  const { schlageVor, stoffPasst } = await import("./cockpit-vorschlag");
  const pakete = [
    paketFix({ id: 1, title: "Brüche addieren", skill_ids: ["m.bruch.add"] }),
    paketFix({ id: 2, title: "Prozent", skill_ids: ["m.prozent"] }),
    paketFix({ id: 3, title: "Brüche addieren (Import)", skill_ids: ["m.bruch.add"], quelle: "import", status: "entwurf", geprueft_am: null }),
    paketFix({ id: 4, title: "Gleichungen", skill_ids: ["m.gl"] }),
    paketFix({ id: 5, title: "Bruchrechnung Oberstufe", skill_ids: ["m.bruch.add"], schulstufe: 9, schulart: "Gymnasium", klasse: 5 }),
    paketFix({ id: 6, title: "Fälle", fach: "Deutsch", skill_ids: ["d.faelle"] }),
    paketFix({ id: 7, title: "Bruchrechnung", thema: "Brüche", skill_ids: [] }),
    paketFix({ id: 8, title: "Leer", skill_ids: ["m.bruch.add"], schritt_zahl: 0 }),
  ];
  const e = {
    pakete,
    schulstufe: 5,
    fach: "Mathematik",
    faecher: ["Mathematik"],
    schritte: [
      { skill: skillFix("m.prozent", "Prozent"), rule: 3 as const, reason: "Lernstand 40 %" },
      { skill: skillFix("m.bruch.add.gleich", "Gleichnamige addieren"), rule: 4 as const, reason: "3 Fehler zuletzt" },
    ],
    pruefung: null,
    frueher: new Map(),
    verwandt: (a: string, b: string) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`),
  };
  const ohnePruefung = schlageVor(e);
  assert.deepEqual(ohnePruefung.map((v) => v.paket.id), [2, 1, 3], "recommendation order; a Teilfähigkeit matches its skill; checked before unchecked");
  assert.equal(ohnePruefung[0].warum, "Prozent: Lernstand 40 %");
  assert.ok(ohnePruefung[2].ungeprueft, "an imported package is marked");
  assert.ok(!ohnePruefung.some((v) => v.paket.id === 4), "no reason from the data: no suggestion");
  assert.ok(!ohnePruefung.some((v) => v.paket.id === 5), "Schulstufe 9 is too far from 5");
  assert.ok(!ohnePruefung.some((v) => v.paket.id === 6), "another subject");
  assert.ok(!ohnePruefung.some((v) => v.paket.id === 8), "a package without steps");

  const mitPruefung = schlageVor({ ...e, pruefung: { days: 6, subject: "Mathematik", skill_ids: ["m.bruch.add"], topics: ["Brüche"], label: "Schularbeit Mathematik in 6 Tagen" } });
  assert.equal(mitPruefung[0].paket.id, 1, "the Schularbeit's skill wins");
  assert.equal(mitPruefung[0].warum, "Schularbeit Mathematik in 6 Tagen, Stoff: Brüche · Gleichnamige addieren: 3 Fehler zuletzt");
  assert.ok(mitPruefung.some((v) => v.paket.id === 7 && v.warum.startsWith("Schularbeit")), "the Stoff as a word in title or Thema counts");
  assert.ok(stoffPasst("Brüche", { title: "Bruchrechnung", thema: "" }));
  assert.ok(!stoffPasst("Prozentrechnung", { title: "Bruchrechnung", thema: "" }));
  const spaet = schlageVor({ ...e, pruefung: { days: 45, subject: "Mathematik", skill_ids: ["m.gl"], topics: [], label: "Schularbeit" } });
  assert.ok(!spaet.some((v) => v.paket.id === 4), "a Schularbeit in 45 days does not count yet");

  const frueher = new Map([
    [4, { datum: "2026-10-15T14:00:00Z", erledigt: 3, gesamt: 5, offen: 2 }],
    [2, { datum: "2026-10-08T14:00:00Z", erledigt: 5, gesamt: 5, offen: 0 }],
  ]);
  const weiter = schlageVor({ ...e, frueher });
  assert.equal(weiter[0].paket.id, 1);
  const gl = weiter.find((v) => v.paket.id === 4)!;
  assert.equal(gl.warum, "Am 15. Okt. begonnen: 3 von 5 Schritten erledigt", "begun and not finished");
  assert.ok(weiter.findIndex((v) => v.paket.id === 2) > weiter.findIndex((v) => v.paket.id === 4), "a package already done moves back");
  assert.ok(weiter.find((v) => v.paket.id === 2)!.gruende.includes("schon am 8. Okt. durchgenommen"));
});

// ---------- per unit, in the database ----------

test("cockpit state per unit: package, current step, done and skipped, notes; the package stays as it is", async () => {
  const { c, units, teacher, schueler, paket, lp } = await setup();
  const sid = schueler("Ida Probe");
  const unit = units.startUnit(teacher.id, sid, { subject: "Deutsch" }).unit;
  assert.equal(c.cockpit(unit.id).paket, null, "nothing chosen yet");
  const p = paket();
  assert.ok("ok" in c.waehlePaket(unit.id, p.id));
  const ids = p.schritte.map((s) => s.id);

  let d = c.cockpit(unit.id);
  assert.equal(d.aktuell?.id, ids[0]);
  assert.deepEqual([...d.ab.values()].slice(0, 3), [0, 5, 15], "start minute of each step");
  assert.ok(c.markiereSchritt(unit.id, ids[0], "erledigt"));
  assert.ok(c.markiereSchritt(unit.id, ids[1], "uebersprungen"));
  assert.ok(c.verschiebeSchritt(unit.id, ids[3], -1));
  assert.ok(c.setzeNotiz(unit.id, ids[0], "  Hat gut mitgemacht \r\n"));
  assert.ok(!c.markiereSchritt(unit.id, 999_999, "erledigt"), "a step of another package is refused");

  // a reload or a second device: the same state from the database
  d = c.cockpit(unit.id);
  assert.equal(d.aktuell?.id, ids[2], "after skipping step 2 comes step 3; moving step 4 does not change the step on screen");
  assert.deepEqual(d.schritte.map((s) => s.id), [ids[0], ids[1], ids[3], ids[2], ...ids.slice(4)]);
  assert.deepEqual(d.stand.erledigt, [ids[0]]);
  assert.deepEqual(d.stand.uebersprungen, [ids[1]]);
  assert.equal(d.stand.notizen[ids[0]], "Hat gut mitgemacht");
  assert.deepEqual(lp.getLernpaket(p.id)!.schritte.map((s) => s.id), ids, "the package keeps its own order");
  assert.ok(c.setzeNotiz(unit.id, ids[0], ""));
  assert.equal(c.cockpit(unit.id).stand.notizen[ids[0]], undefined, "an empty note is removed");

  // another package starts from the beginning
  const p2 = paket();
  c.waehlePaket(unit.id, p2.id);
  d = c.cockpit(unit.id);
  assert.equal(d.paket?.id, p2.id);
  assert.deepEqual(d.stand.erledigt, []);
  // without a package: the skill of the unit
  assert.ok("ok" in c.waehleFaehigkeit(unit.id, "deutsch.grammatik.faelle"));
  d = c.cockpit(unit.id);
  assert.equal(d.paket, null);
  assert.equal(d.stand.skill_id, "deutsch.grammatik.faelle");
  assert.ok("fehler" in c.waehleFaehigkeit(unit.id, "gibt.es.nicht"));
  units.finishUnit(unit.id, "abgebrochen");
});

test("„Einheit vorbereiten“: the package chosen before the unit is preselected when it starts", async () => {
  const { c, units, teacher, schueler, paket } = await setup();
  const { wienerDatum } = await import("./planung/zeit");
  const sid = schueler("Lio Probe");
  const p = paket();
  assert.ok("ok" in c.bereiteVor(sid, wienerDatum(), p.id, teacher.id));
  const unit = units.startUnit(teacher.id, sid, { subject: "Deutsch" }).unit;
  const d = c.cockpit(unit.id);
  assert.equal(d.paket?.id, p.id);
  assert.ok(d.stand.vorbereitet, "taken over, not saved yet");
  c.markiereSchritt(unit.id, p.schritte[0].id, "erledigt");
  assert.equal(c.cockpit(unit.id).stand.vorbereitet, false, "saved with the first tap");
  assert.ok("ok" in c.bereiteVor(sid, wienerDatum(), null, teacher.id));
  assert.equal(c.vorbereitung(sid, wienerDatum()), null);
  units.finishUnit(unit.id, "abgebrochen");
});

test("„Übung senden“ goes to this unit's student, also with two units at once, without the package's check notes", async () => {
  const { c, units, repo: r, teacher, schueler, paket } = await setup();
  const a = schueler("Mara Probe");
  const b = schueler("Theo Probe");
  const ua = units.startUnit(teacher.id, a, { subject: "Deutsch" }).unit;
  const ub = units.startUnit(teacher.id, b, { subject: "Deutsch" }).unit;
  const p = paket((d) => {
    const auf = (d.schritte[3] as { aufgaben: { data: Record<string, unknown> }[] }).aufgaben[0];
    auf.data = { ...auf.data, pruefen: ["Ist die Frage klar genug?"] };
  });
  c.waehlePaket(ub.id, p.id);
  const frage = p.schritte[3];
  const out = c.sendeSchritt(ub.id, frage.id, teacher.id);
  assert.ok("worksheetId" in out, "fehler" in out ? out.fehler : "");
  const asg = r.getAssignment(out.assignmentId)!;
  assert.equal(asg.student_id, b, "the second unit's student, not the one started first");
  assert.equal(asg.unit_id, ub.id);
  const tasks = r.listTasks(out.worksheetId);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].data.pruefen, undefined, "the package's check notes never reach the student");
  assert.equal(tasks[0].sourceType, "importiert", "an imported package's tasks count as imported");
  assert.equal(r.getWorksheet(out.worksheetId)!.status, "freigegeben");
  assert.deepEqual(c.cockpit(ub.id).stand.gesendet[frage.id], [out.worksheetId]);
  assert.ok("fehler" in c.sendeSchritt(ub.id, p.schritte[0].id, teacher.id), "a step without tasks");
  assert.ok("fehler" in c.sendeSchritt(ua.id, frage.id, teacher.id), "not the package of unit A");
  units.finishUnit(ua.id, "abgebrochen");
  units.finishUnit(ub.id, "abgebrochen");
  assert.ok("fehler" in c.sendeSchritt(ub.id, frage.id, teacher.id), "a unit that ended");
});

test("ending the unit documents done, skipped and not reached steps; nothing when the cockpit was not used", async () => {
  const { c, units, repo: r, teacher, schueler, paket } = await setup();
  const { endUnit } = await import("./learning");
  const { autoFelderVon } = await import("./einschaetzung");
  const sid = schueler("Nina Probe");
  const unit = units.startUnit(teacher.id, sid, { subject: "Deutsch" }).unit;
  const p = paket();
  const ids = p.schritte.map((s) => s.id);
  c.waehlePaket(unit.id, p.id);
  c.markiereSchritt(unit.id, ids[0], "erledigt");
  c.markiereSchritt(unit.id, ids[1], "erledigt");
  c.markiereSchritt(unit.id, ids[2], "uebersprungen");
  c.setzeNotiz(unit.id, ids[1], "Nur für mich");
  const lessonId = endUnit(unit.id)!;
  const l = r.getLesson(lessonId)!;
  assert.ok(l.activities.includes(`Lernpaket „${p.title}“: 2 von 7 Schritten erledigt (Detektivfragen, Vier Fälle, vier Fragen). Übersprungen: Ein Satz, vier Fälle. Nicht erreicht:`), l.activities);
  assert.ok(l.review_topics.includes(`Übersprungen in „${p.title}“: Ein Satz, vier Fälle`), l.review_topics);
  assert.ok(l.next_steps.includes(`Weiter mit „${p.title}“: Verständnisfrage, Gemeinsam bestimmen, Allein üben, Abschlusskontrolle`), l.next_steps);
  assert.ok(!JSON.stringify(l).includes("Nur für mich"), "the teacher's step notes stay in the cockpit");
  const auto = autoFelderVon(l);
  assert.ok(auto.has("next_steps") && auto.has("review_topics"), "still marked as automatic");

  // a second run (e.g. written again) does not repeat the lines
  c.dokumentiereAblauf(lessonId, unit.id);
  const l2 = r.getLesson(lessonId)!;
  assert.equal(l2.next_steps.split("Weiter mit").length, 2);
  assert.equal(l2.activities.split("Lernpaket „").length, 2);

  // what the teacher wrote stays
  r.saveLesson({ ...l2, next_steps: "Selbst geschrieben" }, lessonId);
  c.markiereSchritt(unit.id, ids[3], "erledigt");
  c.dokumentiereAblauf(lessonId, unit.id);
  assert.equal(r.getLesson(lessonId)!.next_steps, "Selbst geschrieben");

  // chosen but never used: nothing is added
  const sid2 = schueler("Ole Probe");
  const u2 = units.startUnit(teacher.id, sid2, { subject: "Deutsch" }).unit;
  c.waehlePaket(u2.id, p.id);
  const l3 = r.getLesson(endUnit(u2.id)!)!;
  assert.ok(!l3.activities.includes("Lernpaket"));
  assert.ok(!l3.next_steps.includes("Weiter mit"));
});

test("without any package: the choice is empty and the skill's material is there", async () => {
  const { units, teacher, repo: r } = await setup();
  const { paketWahl, ohnePaket } = await import("./cockpit-vorschlag");
  const { db } = await import("./db");
  db().exec("DELETE FROM einheit_cockpit; DELETE FROM einheit_vorbereitung; DELETE FROM lernpaket_schritte; DELETE FROM lernpakete");
  const sid = r.createStudent({
    name: "Emil Probe", grade: 5, klasse: 1, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const unit = units.startUnit(teacher.id, sid, { subject: "Mathematik" }).unit;
  const w = paketWahl(sid, { fach: "Mathematik", ausser: unit.id });
  assert.equal(w.gesamt, 0);
  assert.deepEqual(w.vorschlaege, []);
  const skill = r.listSkills().find((s) => s.subject === "Mathematik" && s.grade_min <= 5 && s.grade_max >= 5)!;
  const d = ohnePaket(sid, { skillId: skill.id, fach: "Mathematik" })!;
  assert.equal(d.skill?.id, skill.id);
  assert.ok(d.briefing && d.briefing.plan.length > 0, "the day's plan with minutes");
  assert.ok(d.waehlbar.some((s) => s.id === skill.id));
  assert.ok(Array.isArray(d.typischeFehler));
  units.finishUnit(unit.id, "abgebrochen");
});
