/**
 * Textarbeit im geführten Unterricht (PR 4, niko 25.10.2026): „Schreibauftrag starten“ vorgefüllt aus Schritt, Vorgabe
 * für heute und Prüfungsstoff; eine Zeile je Text mit dem einen nächsten Schritt; die nächste Vorbereitung sieht nur
 * bestätigte Schwächen. Schüler und Texte sind erfunden, keine KI-Anfrage verlässt den Test.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

type SchreibPunkt = import("./textarbeit-ablauf").SchreibPunkt;
const email = { id: "englisch.writing.email", name: "E-Mail an Freunde schreiben", subject: "Englisch" };
const punkt = (o: Partial<SchreibPunkt>): SchreibPunkt => ({ quelle: "pruefung", original: "", inhalt: "", skillId: null, testId: null, ...o });

const kid = (name: string, teacherId: number, o: { school_type?: string; klasse?: number; subjects?: string[] } = {}) => ({
  name, grade: o.klasse ?? 2, klasse: o.klasse ?? 2, teacher_id: teacherId, school: "", school_type: o.school_type ?? "Mittelschule", subjects: o.subjects ?? ["Englisch"],
  current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
});

test("writing skills: each prefilled Textsorte leads back to the same skill, so a confirmed grade counts there", async () => {
  const { SCHREIB_TEXTSORTE, schreibArt } = await import("./textarbeit-ablauf");
  const { skillFuerText } = await import("./text-note");
  const repo = await import("./repo");
  const skills = repo.listSkills();
  for (const [id, textsorte] of Object.entries(SCHREIB_TEXTSORTE)) {
    const s = skills.find((x) => x.id === id);
    assert.ok(s, `${id} exists`);
    assert.equal(skillFuerText({ fach: s!.subject, textsorte, schulstufe: s!.grade_min }, skills)?.id, id, `${textsorte} → ${id}`);
  }
  assert.deepEqual(schreibArt("deutsch.os.matura.textinterpretation"), { art: "schreibauftrag", sorte: "textinterpretation", textsorte: "Textinterpretation" });
  assert.equal(schreibArt("deutsch.vs.schreiben.bildgeschichte")?.art, "bildgeschichte");
  assert.equal(schreibArt("englisch.writing.capitals"), null, "a skill that practises only part of a text is no writing task");
  assert.equal(schreibArt("englisch.tenses.presentsimple"), null);
  assert.equal(schreibArt(null), null);
});

test("prefill: from the Vorgabe before the exam material, word count from the writing item, nothing invented", async () => {
  const { schreibStart } = await import("./textarbeit-ablauf");
  // only the step: the skill's own name, no word count
  const nur = schreibStart({ unitId: 7, skill: email, punkte: [] });
  assert.ok(nur && nur.art === "text");
  assert.deepEqual([nur.titel, nur.textsorte, nur.aufgabe, nur.woerter, nur.fach, nur.quelle], ["E-Mail an Freunde schreiben", "E-Mail", "E-Mail an Freunde schreiben.", null, "Englisch", "dem Schritt"]);
  assert.equal(nur.href, "/einheiten/7/text?schreiben=englisch.writing.email");

  // the exam material (#138): the item's wording, the word count from „Writing task (120 words)“
  const stoff = [
    punkt({ original: "Writing task (120 words)", inhalt: "Schreibaufgabe, 120 Wörter", testId: 3 }),
    punkt({ original: "Writing an email about a past holiday/weekend", inhalt: "E-Mail über vergangene Ferien oder ein Wochenende", skillId: email.id, testId: 3 }),
    punkt({ original: "picture story", inhalt: "Picture Story", skillId: "englisch.writing.story", testId: 3 }),
  ];
  const p = schreibStart({ unitId: 7, skill: email, punkte: stoff });
  assert.ok(p && p.art === "text");
  assert.equal(p.titel, "E-Mail über vergangene Ferien oder ein Wochenende");
  assert.equal(p.aufgabe, "Writing an email about a past holiday/weekend (about 120 words).");
  assert.equal(p.woerter, 120);
  assert.equal(p.quelle, "dem Prüfungsstoff");

  // the teacher's word for today wins over the exam material
  const v = schreibStart({ unitId: 7, skill: email, punkte: [...stoff, punkt({ quelle: "vorgabe", original: "Einladung zur Geburtstagsfeier als E-Mail, 100 Wörter", inhalt: "Einladung als E-Mail", skillId: email.id })] });
  assert.ok(v && v.art === "text");
  assert.equal(v.aufgabe, "Einladung zur Geburtstagsfeier als E-Mail, 100 Wörter.", "the number is already in the wording: not twice");
  assert.equal(v.woerter, 100);
  assert.equal(v.quelle, "deiner Vorgabe für heute");
  const mitZahl = schreibStart({ unitId: 7, skill: email, punkte: [punkt({ quelle: "vorgabe", original: "E-Mail an einen Freund über das Wochenende (120 words)", inhalt: "E-Mail an einen Freund über das Wochenende (120 words)", skillId: email.id })] });
  assert.ok(mitZahl && mitZahl.art === "text");
  assert.deepEqual([mitZahl.titel, mitZahl.aufgabe], ["E-Mail an einen Freund über das Wochenende", "E-Mail an einen Freund über das Wochenende (120 words)."], "the word count stays in the task, not in the title");

  // German wording
  const brief = schreibStart({ unitId: 7, skill: { id: "deutsch.schreiben.bewerbung", name: "Bewerbungsschreiben für Praktikum und Schnuppertage", subject: "Deutsch" }, punkte: [punkt({ original: "Bewerbung (ca. 200 Wörter)", skillId: null })] });
  assert.ok(brief && brief.art === "text");
  assert.equal(brief.aufgabe, "Bewerbungsschreiben für Praktikum und Schnuppertage (etwa 200 Wörter).");
  assert.equal(brief.textsorte, "Bewerbungsschreiben");

  assert.equal(schreibStart({ unitId: 7, skill: { id: "englisch.tenses.pastsimple", name: "Past Simple", subject: "Englisch" }, punkte: stoff }), null);
});

test("prefill: Oberstufe and HTL go through the Schreibauftrag with the exam, the Volksschule picture story through its pictures", async () => {
  const { schreibStart } = await import("./textarbeit-ablauf");
  const ti = { id: "deutsch.os.matura.textinterpretation", name: "Textinterpretation", subject: "Deutsch" };
  const a = schreibStart({ unitId: 9, skill: ti, punkte: [punkt({ original: "Textinterpretation (Kurzgeschichte)", skillId: ti.id, testId: 42 })] });
  assert.ok(a && a.art === "schreibauftrag");
  assert.equal(a.href, "/einheiten/9/schreibauftrag?sorte=textinterpretation&pruefung=42");
  assert.equal(a.textsorte, "Textinterpretation");
  // an exam without a Stoffzettel still links the exam through its skills
  const b = schreibStart({ unitId: 9, skill: ti, punkte: [punkt({ skillId: ti.id, testId: 5 })] });
  assert.equal(b?.href, "/einheiten/9/schreibauftrag?sorte=textinterpretation&pruefung=5");
  assert.equal(schreibStart({ unitId: 9, skill: ti, punkte: [] })?.href, "/einheiten/9/schreibauftrag?sorte=textinterpretation");
  const bg = schreibStart({ unitId: 9, skill: { id: "deutsch.vs.schreiben.bildgeschichte", name: "Zu einer Bildgeschichte schreiben", subject: "Deutsch" }, punkte: [] });
  assert.equal(bg?.href, "/einheiten/9/bildgeschichte");
});

test("one line per text: a grade only when confirmed, a proposal is only „Bewertung offen“", async () => {
  const { textZeile } = await import("./textarbeit-ablauf");
  const t = { id: 4, titel: "Holiday", textsorte: "E-Mail", status: "offen" as const, woerter: 84, bestaetigt: false, note: null, vorschlag: false, pruefung: "keine" as const };
  assert.deepEqual(textZeile(t, { amGeraet: true }), { stand: "schreibt", text: "schreibt · 84 Wörter", aktion: { label: "Mitlesen", href: "/texte/4", haupt: false } });
  assert.equal(textZeile(t, { amGeraet: false }).aktion.label, "Öffnen");
  const ab = textZeile({ ...t, status: "fertig", woerter: 121 }, { amGeraet: true });
  assert.deepEqual([ab.stand, ab.text, ab.aktion.label, ab.aktion.href, ab.aktion.haupt], ["abgegeben", "abgegeben · 121 Wörter", "Korrigieren", "/texte/4/korrektur", true]);
  assert.equal(textZeile({ ...t, status: "fertig", pruefung: "laeuft" }, { amGeraet: false }).stand, "wird_korrigiert");
  const offen = textZeile({ ...t, status: "fertig", vorschlag: true, pruefung: "fertig" }, { amGeraet: false });
  assert.deepEqual([offen.text, offen.aktion.label, offen.aktion.href], ["Bewertung offen", "Bewertung übernehmen", "/texte/4/korrektur?teil=aufgabe"]);
  assert.ok(!/Note/.test(offen.text), "never the number of a proposal");
  assert.equal(textZeile({ ...t, status: "fertig", bestaetigt: true, note: 2 }, { amGeraet: false }).text, "bewertet · Note 2");
});

test("text lines from the database: per unit, proposal vs confirmed, two students at once do not mix", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const texts = await import("./texts");
  const sb = await import("./schreibauftrag-bewertung");
  const { textLaeufe, textZumSchritt } = await import("./textarbeit-ablauf");
  const { docFromText } = await import("./text-doc");
  const { db } = await import("./db");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const lena = repo.createStudent(kid("Lena Testfeld", niko.id));
  const tim = repo.createStudent(kid("Tim Probst", niko.id));
  const u1 = units.startUnit(niko.id, lena).unit;
  const u2 = units.startUnit(niko.id, tim).unit;
  const a = texts.createText({ studentId: lena, teacherId: niko.id, unitId: u1.id, subject: "Englisch", topic: "E-Mail", title: "My weekend", prompt: "Write an email about your weekend (about 120 words)." });
  texts.createText({ studentId: tim, teacherId: niko.id, unitId: u2.id, subject: "Englisch", topic: "Story", title: "The lost key", prompt: "Write a picture story." });
  assert.ok(texts.saveText(a.id, docFromText("Hi Sam, last weekend I visited my aunt in the mountains. We went hiking and ate pancakes."), 0).ok);
  texts.setTextStatus(a.id, "fertig");
  assert.deepEqual(textLaeufe(u1.id).map((t) => t.titel), ["My weekend"]);
  assert.deepEqual(textLaeufe(u2.id).map((t) => t.titel), ["The lost key"]);
  assert.equal(textZumSchritt(textLaeufe(u1.id), { textsorte: "e-mail" })?.id, a.id);
  assert.equal(textZumSchritt(textLaeufe(u1.id), { textsorte: "Story" }), null);

  // a stored proposal (as the KI would leave it): open, no number
  db().prepare("INSERT INTO text_bewertungen (text_id, vorschlag, vorschlag_note, pruefung_status) VALUES (?, ?, 5, 'fertig')").run(a.id, JSON.stringify([{ kriterium: "inhalt", stufe: 5, begruendung: "x", belege: [] }]));
  let l = textLaeufe(u1.id)[0];
  assert.deepEqual([l.vorschlag, l.bestaetigt, l.note], [true, false, null]);
  const stufen = (s: number[]) => (["inhalt", "textstruktur", "stil", "sprachrichtigkeit"] as const).map((key, i) => ({ key, stufe: s[i] as 1 | 2 | 3 | 4 | 5, begruendung: "" }));
  assert.ok(sb.bestaetigeBewertung(a.id, { kriterien: stufen([3, 3, 3, 4]), note: 3 }, niko.id));
  l = textLaeufe(u1.id)[0];
  assert.deepEqual([l.vorschlag, l.bestaetigt, l.note], [false, true, 3]);
});

test("next preparation: a weak criterion of a confirmed grade is an open goal; a proposal never is", async () => {
  const { textSignale, signaleFuer, schuelerBasis, TEXT_ZIEL_TAGE } = await import("./vorbereitung-auto");
  const k = (s: number[]) => Object.fromEntries((["inhalt", "textstruktur", "stil", "sprachrichtigkeit"] as const).map((x, i) => [x, s[i]])) as Record<"inhalt" | "textstruktur" | "stil" | "sprachrichtigkeit", 1 | 2 | 3 | 4 | 5>;
  const e = (o: Partial<import("./text-note").TextErgebnis>): import("./text-note").TextErgebnis => ({ textId: 1, titel: "My weekend", textsorte: "E-Mail", skillId: email.id, skillName: email.name, fach: "Englisch", note: 3, stufen: k([3, 3, 3, 4]), at: "2026-10-20T10:00:00.000Z", ...o });
  const [s] = textSignale([e({})], "2026-10-25");
  assert.deepEqual([s.art, s.fach, s.skill_ids, s.thema, s.warum], ["ziel", "Englisch", [email.id], email.name, "E-Mail am 20.10.: Note 3, schwach: Sprache"]);
  assert.equal(textSignale([e({ stufen: k([2, 3, 2, 3]), note: 2 })], "2026-10-25").length, 0, "nothing weak");
  assert.equal(textSignale([e({ textId: 2, stufen: k([2, 2, 2, 2]), note: 2, at: "2026-10-24T10:00:00.000Z" }), e({})], "2026-10-25").length, 0, "a later good grade of the same skill wins");
  assert.equal(textSignale([e({ at: "2026-08-01T10:00:00.000Z" })], "2026-10-25").length, 0, `older than ${TEXT_ZIEL_TAGE} days`);

  // from the database: a stored proposal with Note 5 is no signal, the confirmed grade is
  const repo = await import("./repo");
  const units = await import("./units");
  const texts = await import("./texts");
  const sb = await import("./schreibauftrag-bewertung");
  const { db } = await import("./db");
  const { docFromText } = await import("./text-doc");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid("Mara Beispiel", niko.id));
  const { unit } = units.startUnit(niko.id, sid);
  const t = texts.createText({ studentId: sid, teacherId: niko.id, unitId: unit.id, subject: "Englisch", topic: "E-Mail", title: "Invitation", prompt: "Invite a friend to your party (about 100 words)." });
  assert.ok(texts.saveText(t.id, docFromText("Hi Jo, I want invite you to my party on saturday. It start at three."), 0).ok);
  texts.setTextStatus(t.id, "fertig");
  db().prepare("INSERT INTO text_bewertungen (text_id, vorschlag, vorschlag_note, pruefung_status) VALUES (?, ?, 5, 'fertig')").run(t.id, JSON.stringify([{ kriterium: "sprachrichtigkeit", stufe: 5, begruendung: "x", belege: [] }]));
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
  const ziele = () => signaleFuer(schuelerBasis(repo.getStudent(sid)!, new Date()), { datum: heute, fach: "Englisch" }).filter((x) => x.art === "ziel" && x.skill_ids.includes(email.id));
  const { datenStand } = await import("./briefing");
  const stand = datenStand(sid);
  assert.equal(ziele().length, 0, "a KI proposal is never a fact");
  const stufen = (s: number[]) => (["inhalt", "textstruktur", "stil", "sprachrichtigkeit"] as const).map((key, i) => ({ key, stufe: s[i] as 1 | 2 | 3 | 4 | 5, begruendung: "" }));
  assert.ok(sb.bestaetigeBewertung(t.id, { kriterien: stufen([3, 3, 3, 5]), note: 4 }, niko.id));
  assert.equal(ziele().length, 1);
  assert.match(ziele()[0].warum, /^E-Mail am \d+\.\d+\.: Note 4, schwach: Sprache$/);
  assert.equal(datenStand(sid), stand, "costs stay: a confirmed grade alone asks no new paid briefing (the plan from the data is fresh anyway)");
  sb.nimmBewertungZurueck(t.id);
  assert.equal(ziele().length, 0, "taken back: no longer counts");
});

test("guided view data: writing items of the Vorgabe and of the exam material reach the prefill, excluded ones do not", async () => {
  const repo = await import("./repo");
  const units = await import("./units");
  const { speichereStoff } = await import("./pruefungsstoff");
  const { ersterSchreibPunkt, schreibPunkte, schreibStartFuer, schreibStartZurPruefung } = await import("./textarbeit-ablauf");
  const { db } = await import("./db");
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent(kid("Ella Muster", niko.id));
  const { unit } = units.startUnit(niko.id, sid, { subject: "Englisch" });
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
  const inTagen = (n: number) => new Date(Date.parse(`${heute}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const testId = repo.addTest({ student_id: sid, date: inTagen(9), subject: "Englisch", kind: "Schularbeit", topic: "", grade: null, points: null, max_points: null, notes: "", skill_ids: [], title: "", topics: [], status: "geplant", teacher_id: niko.id, material_id: null });
  const z = (gruppe: "writing" | "grammatik", original: string, inhalt: string, skill_id: string | null, status: "pruefung" | "ausgeschlossen" = "pruefung") => ({ gruppe, original, inhalt, einheit: "", dokument: 1, quelle: "stoffzettel" as const, status, grund: "", skill_id, zuordnung: (skill_id ? "sicher" : "keine") as "sicher" | "keine", vorschlaege: [] });
  speichereStoff(testId, [z("writing", "Writing task (120 words)", "Schreibaufgabe, 120 Wörter", null), z("writing", "email", "E-Mail", "englisch.writing.email"), z("writing", "postcard", "Postkarte", null, "ausgeschlossen"), z("grammatik", "past simple", "Past Simple", "englisch.tenses.pastsimple")]);
  const p = schreibPunkte(unit);
  assert.deepEqual(p.filter((x) => x.original).map((x) => x.original), ["Writing task (120 words)", "email"]);
  const s = schreibStartFuer(unit, "englisch.writing.email");
  assert.ok(s && s.art === "text");
  assert.deepEqual([s.aufgabe, s.quelle], ["email (about 120 words).", "dem Prüfungsstoff"]);
  // the exam step („Schularbeit vorbereiten“, skill Past Simple): the exam's writing task next to „Übung senden“
  assert.equal(schreibStartZurPruefung(unit)?.href, s.href);
  assert.equal(ersterSchreibPunkt(p.filter((x) => x.skillId !== "englisch.writing.email")), null, "no writing skill in the material: nothing offered");

  db().prepare("INSERT INTO einheit_vorgabe (unit_id, student_id, text, punkte) VALUES (?, ?, ?, ?)").run(unit.id, sid, "Heute E-Mail schreiben", JSON.stringify([{ ...z("writing", "Email to a pen friend about your hobbies", "E-Mail an Brieffreund über Hobbys", "englisch.writing.email"), gruppe: "sonstiges", quelle: "lehrer" }]));
  const v = schreibStartFuer(unit, "englisch.writing.email");
  assert.ok(v && v.art === "text");
  assert.deepEqual([v.titel, v.quelle], ["E-Mail an Brieffreund über Hobbys", "deiner Vorgabe für heute"]);
  assert.equal(schreibStartFuer(unit, "englisch.tenses.pastsimple"), null);
});
