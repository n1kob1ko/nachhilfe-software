/**
 * Automatischer Abschluss (niko, 25.10.2026: „Dokumentation ohne Tippen, nachvollziehbar, nichts erfunden“) mit der
 * Datenbank: Belege einer echten Einheit (Antworten, Anpassung, Beobachtungen, Vorgabe, Prüfung), „Dokumentation
 * bestätigen“ schreibt nur in leere oder automatische Felder, die nächste Vorbereitung liest „Nächstes Mal“, die KI-
 * Zusammenfassung kommt nie in die Felder, schnelles Korrigieren, offene Abschlüsse und zwei Schüler zugleich. Keine KI,
 * kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const DIV = "mathe.brueche.dividieren";
const KUE = "mathe.brueche.kuerzen";
let nr = 0;

async function setup() {
  const { db } = await import("./db");
  const repo = await import("./repo");
  const units = await import("./units");
  const c = await import("./cockpit");
  const ab = await import("./abschluss");
  const { endUnit } = await import("./learning");
  const teacher = repo.listTeachers()[0];
  const schueler = (name: string) =>
    repo.createStudent({
      name, grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "Mittelschule", subjects: ["Mathematik"],
      current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
    });
  const aufgabe = (prompt: string) => ({ type: "calc" as const, skillId: DIV, difficulty: "mittel" as const, prompt, data: {}, answer: { accepted: ["1"], mode: "value" as const }, solution: "", hints: [], errorMap: [] });
  /** three tasks on Dividieren sent in the unit */
  const sende = (unitId: number, sid: number) => {
    const ws = repo.createWorksheet(
      { title: "Brüche dividieren", subject: "Mathematik", grade: 6, school_type: "Mittelschule", klasse: 2, topic: "Brüche", difficulty: "mittel", task_type: "calc", kind: "uebung", source: "manuell", skill_ids: [DIV], status: "freigegeben" },
      [aufgabe(`3/4 : 1/2 = ? (${++nr})`), aufgabe(`2/3 : 1/3 = ? (${++nr})`), aufgabe(`5/6 : 1/6 = ? (${++nr})`)],
    );
    return repo.assignWorksheet(ws, sid, "", unitId);
  };
  /** answers: true = right at once, false = wrong („Kehrwert vergessen“), one per task */
  const antworte = (unitId: number, asg: number, xs: boolean[]) => {
    const a = repo.getAssignment(asg)!;
    const tasks = repo.listTasks(a.worksheet_id);
    xs.forEach((ok, i) => {
      const t = tasks[i % tasks.length];
      repo.recordAttempt({ assignment_id: asg, task_id: t.id, student_id: a.student_id, skill_id: t.skillId ?? null, attempt_no: 1, answer: ok ? "1" : "2", correct: ok ? 1 : 0, final: 1, time_ms: 30_000, active_ms: 25_000, hints_used: 0, solution_viewed: 0, error_label: ok ? null : "Kehrwert vergessen", feedback: "", unit_id: unitId });
    });
  };
  const vorgabe = (unitId: number, sid: number, skills: string[]) => db().prepare("INSERT INTO einheit_vorgabe (unit_id, student_id, text, skill_ids) VALUES (?, ?, ?, ?)").run(unitId, sid, "Heute Dividieren und Kürzen", JSON.stringify(skills));
  return { db, repo, units, c, ab, endUnit, teacher, schueler, sende, antworte, vorgabe };
}

test("a unit with answers and a Vorgabe: secure by the rule, the Vorgabe left open goes to „Nächstes Mal“; confirming writes only empty or automatic fields; the next preparation reads it; the KI summary never gets in", async () => {
  const s = await setup();
  const { saveInsight } = await import("./ai/insights");
  const auto = await import("./vorbereitung-auto");
  const { tagAddieren, wienerDatum } = await import("./planung/zeit");
  const sid = s.schueler("Mia Bruchfeld");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik", at: Date.now() - 50 * 60_000 }).unit;
  s.vorgabe(unit.id, sid, [DIV, KUE]);
  s.antworte(unit.id, s.sende(unit.id, sid), [true, true, true]);
  const lessonId = s.endUnit(unit.id, { byTeacherId: s.teacher.id })!;
  // the KI's view, written in the background: only a suggestion
  saveInsight({ unitId: unit.id, kind: "einheit", data: { summary: "KI meint: Kürzen sitzt sicher.", next_steps: ["KI: Kürzen vertiefen"], next_skill: KUE, homework: "KI-Hausübung" }, callId: null });
  // the teacher wrote her own „Noch schwierig“ in the documentation before
  s.repo.saveLesson({ ...s.repo.getLesson(lessonId)!, difficulties: "Eigene Notiz: Tempo" }, lessonId);

  const lesson = s.repo.getLesson(lessonId)!;
  const k = s.ab.karteDerEinheit(unit.id, lesson);
  assert.deepEqual(k.gut.map((z) => [z.text, z.von]), [["Dividieren: 3 von 3 im ersten Versuch richtig", "antworten"]]);
  assert.ok(k.gemacht.some((z) => z.text === "Aus deiner Vorgabe geübt: Dividieren" && z.von === "vorgabe"));
  assert.ok(k.naechstes.some((z) => z.text === "Aus deiner Vorgabe noch offen: Kürzen" && z.von === "vorgabe"));
  assert.ok(k.schwierig.some((z) => z.text === "Eigene Notiz: Tempo" && z.von === "lehrer"));
  const alles = () => [...Object.values(s.ab.karteDerEinheit(unit.id, s.repo.getLesson(lessonId)!)).flat().map((z) => z.text)].join("\n");
  assert.doesNotMatch(alles(), /KI/, "the KI summary is in no field");
  assert.doesNotMatch(lesson.next_steps, /Vorgabe/, "before confirming, the documentation does not have it yet");

  assert.equal(s.ab.bestaetigeAbschluss(lessonId), true);
  const nach = s.repo.getLesson(lessonId)!;
  assert.ok(nach.reviewed_at);
  assert.equal(nach.positives, "Dividieren: 3 von 3 im ersten Versuch richtig");
  assert.equal(nach.difficulties, "Eigene Notiz: Tempo", "the teacher's own text stays");
  assert.match(nach.next_steps, /^Aus deiner Vorgabe noch offen: Kürzen$/m);
  assert.match(nach.activities, /Aus deiner Vorgabe geübt: Dividieren/);
  for (const f of [nach.activities, nach.positives, nach.difficulties, nach.next_steps]) assert.doesNotMatch(f, /KI/);
  // what was written counts as automatic: not shown again as „deine Notiz“, the card stays the same
  const { autoFelderVon } = await import("./einschaetzung");
  assert.deepEqual([...autoFelderVon(nach)].filter((f) => ["activities", "positives", "next_steps", "difficulties"].includes(f)).sort(), ["activities", "next_steps", "positives"]);
  assert.deepEqual(s.ab.karteDerEinheit(unit.id, nach).gut.map((z) => z.text), ["Dividieren: 3 von 3 im ersten Versuch richtig"]);
  assert.equal(s.ab.bestaetigeAbschluss(lessonId), false, "a second time changes nothing");

  // the next preparation (tomorrow) reads „Nächstes Mal“ as an open goal
  const morgen = tagAddieren(wienerDatum(), 1);
  const ziele = auto.signaleFuer(auto.schuelerBasis(s.repo.getStudent(sid)!, new Date()), { datum: morgen, fach: "Mathematik" }).filter((x) => x.art === "ziel" && x.skill_ids.includes(KUE));
  assert.equal(ziele.length, 1);
  assert.match(ziele[0].warum, /^Nächstes Mal \(Einheit am .*\): .*Kürzen/);
});

test("Anpassung and observations from the real paths: „Leichtere Aufgabe nötig bei …“, your „Richtig“ and „Falsch“ labelled, an exam date only from the entry", async () => {
  const s = await setup();
  const st = await import("./steuerung");
  const lp = await import("./lernpakete");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const sid = s.schueler("Lio Kehrwert");
  // an exam in 6 days with two skills; Kürzen was never practised
  const { tagAddieren, wienerDatum } = await import("./planung/zeit");
  const datum = tagAddieren(wienerDatum(), 6);
  s.repo.addTest({ student_id: sid, date: datum, subject: "Mathematik", kind: "Schularbeit", topic: "Brüche", grade: null, points: null, max_points: null, notes: "", skill_ids: [DIV, KUE] });

  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  s.c.waehleFaehigkeit(unit.id, DIV);
  s.antworte(unit.id, s.sende(unit.id, sid), [false, false]);
  const v = st.vorschlagDerEinheit(unit.id, s.c.cockpit(unit.id, { mitPlan: true }))!;
  assert.equal(v.haupt?.option.art, "leichter");
  const out = st.sendeAngepasst(unit.id, v.haupt!.option, s.teacher.id, s.c.cockpit(unit.id));
  assert.ok("assignmentId" in out);
  assert.deepEqual(s.c.reaktionenDerEinheit(unit.id).map((r) => [r.art, r.skillId, r.assignmentId]), [["leichter", DIV, out.assignmentId]], "the reaction is remembered for the Abschluss");
  s.antworte(unit.id, out.assignmentId, [true, true, true]);
  const lessonId = s.endUnit(unit.id, { byTeacherId: s.teacher.id })!;
  const k = s.ab.karteDerEinheit(unit.id, s.repo.getLesson(lessonId)!);
  assert.ok(k.schwierig.some((z) => z.von === "anpassung" && z.text === "Leichtere Aufgabe nötig bei Dividieren (danach 3 von 3 richtig)"), JSON.stringify(k.schwierig));
  assert.ok(k.schwierig.some((z) => z.von === "antworten" && /^Fehler: Kehrwert vergessen bei 2 Aufgaben$/.test(z.text)));
  assert.deepEqual(k.gut, [], "two wrong answers on the skill: nothing secure, even with three right afterwards");
  const pruefung = k.naechstes[0];
  assert.equal(pruefung.von, "pruefung");
  assert.match(pruefung.text, /^Schularbeit Mathematik am .*: zuletzt nicht geübt: Kürzen$/, "the stored date, and only what had no answer");
  assert.equal(k.naechstes.filter((z) => z.text.startsWith("Schularbeit")).length, 1, "the exam once");

  // Richtig / Falsch on questions of a Lernpaket
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "lernpaket-format.md"), "utf8");
  const d = JSON.parse(md.match(/## Vollständiges Beispiel[\s\S]*?```json\n([\s\S]*?)```/)![1]);
  d.titel = `Die vier Fälle (Abschluss ${++nr})`;
  const imp = lp.importiereLernpaket(JSON.stringify(d), s.teacher.id);
  assert.ok("id" in imp);
  const p = lp.getLernpaket(imp.id)!;
  const fragen = p.schritte.filter((x) => x.art === "frage" || x.art === "kontrolle");
  assert.ok(fragen.length >= 2);
  const sid2 = s.schueler("Ella Fallweise");
  const u2 = s.units.startUnit(s.teacher.id, sid2, { subject: "Deutsch" }).unit;
  assert.ok("ok" in s.c.waehlePaket(u2.id, p.id));
  s.c.setzeAntwort(u2.id, fragen[0].id, "richtig");
  s.c.setzeAntwort(u2.id, fragen[1].id, "falsch");
  const l2 = s.endUnit(u2.id, { byTeacherId: s.teacher.id })!;
  const k2 = s.ab.karteDerEinheit(u2.id, s.repo.getLesson(l2)!);
  assert.deepEqual(k2.gut.map((z) => z.von), ["beobachtung"], "a „Richtig“ alone is your observation");
  assert.equal(s.ab.hatSichereErgebnisse(k2.gut), false, "the card says „Keine sicheren Ergebnisse“");
  assert.ok(k2.schwierig.some((z) => z.von === "beobachtung" && z.text.endsWith("falsch beantwortet")));
  s.ab.bestaetigeAbschluss(l2);
  assert.match(s.repo.getLesson(l2)!.positives, /richtig beantwortet \(Beobachtung\)$/, "stored as an observation, not as a result");
});

test("quick correction in the card: only that field, no confirmation; confirming keeps it; empty brings the data back; the note for parents uses the same facts", async () => {
  const s = await setup();
  const { noteFromFacts, unitBrief } = await import("./summary");
  const sid = s.schueler("Noah Korrektur");
  const unit = s.units.startUnit(s.teacher.id, sid, { subject: "Mathematik" }).unit;
  s.antworte(unit.id, s.sende(unit.id, sid), [true, true, true]);
  const lessonId = s.endUnit(unit.id, { byTeacherId: s.teacher.id })!;
  assert.equal(s.ab.korrigiereFeld(lessonId, "schwierig", "Kehrwert noch unsicher\r\n\r\nTempo "), true);
  let l = s.repo.getLesson(lessonId)!;
  assert.equal(l.reviewed_at, null, "saving does not confirm");
  assert.equal(l.difficulties, "Kehrwert noch unsicher\nTempo");
  assert.deepEqual(s.ab.karteDerEinheit(unit.id, l).schwierig.map((z) => [z.text, z.von]), [["Kehrwert noch unsicher", "eigen"], ["Tempo", "eigen"]]);
  s.ab.bestaetigeAbschluss(lessonId);
  l = s.repo.getLesson(lessonId)!;
  assert.equal(l.difficulties, "Kehrwert noch unsicher\nTempo", "confirming does not overwrite the correction");
  assert.ok(l.positives.startsWith("Dividieren: 3 von 3"));
  // the note from the facts: the same four fields
  const note = noteFromFacts(s.ab.briefAusKarte(unitBrief(lessonId)!, s.ab.karteDerEinheit(unit.id, l)), "eltern");
  assert.match(note, /Gut geklappt hat: Dividieren: 3 von 3 im ersten Versuch richtig\./);
  assert.match(note, /Noch schwierig war: Kehrwert noch unsicher; Tempo\./);
  // empty: the field comes from the data again
  s.ab.korrigiereFeld(lessonId, "schwierig", "  ");
  l = s.repo.getLesson(lessonId)!;
  assert.equal(l.difficulties, "");
  assert.ok(s.ab.karteDerEinheit(unit.id, l).schwierig.every((z) => z.von !== "eigen"));
  assert.equal(s.ab.korrigiereFeld(lessonId, "unsinn" as never, "x"), false);
});

test("open Abschlüsse never get lost: a unit ended automatically is listed; with two students, confirming one leads to the other", async () => {
  const s = await setup();
  const { sweepIdleUnits } = await import("./learning");
  const { offeneAbschluesse, lageFuer } = await import("./situation");
  const { wienerDatum } = await import("./planung/zeit");
  for (const o of offeneAbschluesse(s.teacher.id)) s.ab.bestaetigeDoku(o.lessonId);
  const jetzt = Date.now();
  // left running for hours: the sweep ends it, and it waits in /abschluss
  const alt = s.units.startUnit(s.teacher.id, s.schueler("Ben Vergessen"), { at: jetzt - 5 * 3600_000 }).unit;
  s.db().prepare("UPDATE units SET last_activity_at = ? WHERE id = ?").run(new Date(jetzt - 4 * 3600_000).toISOString(), alt.id);
  sweepIdleUnits(jetzt);
  const liste = offeneAbschluesse(s.teacher.id);
  assert.deepEqual(liste.map((o) => [o.unitId, o.endedBy]), [[alt.id, "automatisch"]]);
  const altEnde = s.units.getUnit(alt.id)!.ended_at!;

  // two at once: the first ended and confirmed, the second still running → its Unterricht; then its Abschluss
  const a = s.units.startUnit(s.teacher.id, s.schueler("Ida Zwei"), { at: jetzt - 60 * 60_000 }).unit;
  const b = s.units.startUnit(s.teacher.id, s.schueler("Jan Zwei"), { at: jetzt - 55 * 60_000 }).unit;
  const la = s.endUnit(a.id, { byTeacherId: s.teacher.id, at: jetzt - 5 * 60_000 })!;
  s.ab.bestaetigeAbschluss(la);
  assert.deepEqual(lageFuer(s.teacher.id), { art: "unterricht", unitId: b.id });
  const lb = s.endUnit(b.id, { byTeacherId: s.teacher.id, at: jetzt - 2 * 60_000 })!;
  assert.deepEqual(lageFuer(s.teacher.id), { art: "abschluss", unitId: b.id });
  s.ab.bestaetigeAbschluss(lb);
  // the automatically ended one is still listed; /jetzt leads to it only when it ended today
  assert.deepEqual(offeneAbschluesse(s.teacher.id).map((o) => o.unitId), [alt.id]);
  assert.deepEqual(lageFuer(s.teacher.id), wienerDatum(new Date(altEnde)) === wienerDatum() ? { art: "abschluss", unitId: alt.id } : { art: "heute" });
});
