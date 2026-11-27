/**
 * Übungsheft zu den Fehlern (lib/uebungsheft.ts, niko 27.11.2026): aus dem korrigierten Text baut die KI in einer Anfrage ein Heft mit
 * Teilen, Merke und Sätzen aus dem eigenen Text; die App macht daraus Aufgaben, die sie selbst prüft, und wirft Unklares weg. Kein
 * Schlüssel, kein Aufruf nach außen. Alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { UebungsheftKi } from "./ai/uebungsheft";
import type { AIRequest } from "./ai/providers";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER", "AI_DISABLED"]) delete process.env[k];

const REDE = "deutsch.beistrich.direkte-rede";

/** Wie die KI antwortet: ein Teil direkte Rede, einer Verben, ein Schreibteil; dazu vier Aufgaben, die nicht eindeutig sind. */
const HEFT: UebungsheftKi = {
  titel: "Fit für die Schularbeit: Gruselgeschichte",
  vorweg: "Deine Geschichte ist spannend gebaut. Punkte verlierst du bei den Satzzeichen der direkten Rede.",
  teile: [
    {
      titel: "Direkte Rede",
      merke: ["Anfang: „ unten – Ende: “ oben", "Begleitsatz hinten: „Lauf!“, rief Mira."],
      aus_deinem_text: [{ falsch: "Lauf schrie Mira", richtig: "„Lauf!“, schrie Mira." }],
      uebungen: [
        {
          titel: "Satzzeichen einsetzen",
          auftrag: "Setze alle fehlenden Satzzeichen ein und schreib den Satz richtig.",
          art: "satz",
          beispiel: null,
          faehigkeit: REDE,
          satzzeichen_zaehlen: true,
          aufgaben: [
            { vorgabe: "Lauf schrie Mira panisch", loesung: ["„Lauf!“, schrie Mira panisch."], optionen: null },
            { vorgabe: "Hast du das gehört flüsterte Ben", loesung: ["„Hast du das gehört?“, flüsterte Ben."], optionen: null },
            // unverändert: keine Aufgabe
            { vorgabe: "„Komm!“, rief Ben.", loesung: ["„Komm!“, rief Ben."], optionen: null },
          ],
        },
        {
          titel: "Fehlerdetektiv",
          auftrag: "Jeder Satz hat genau einen Fehler. Schreib ihn richtig.",
          art: "fehler",
          beispiel: null,
          faehigkeit: REDE,
          satzzeichen_zaehlen: true,
          aufgaben: [
            { vorgabe: "„Wo sind die anderen?“ fragte Mira.", loesung: ["„Wo sind die anderen?“, fragte Mira."], optionen: null },
            // kein Fehler darin: fällt weg
            { vorgabe: "„Komm her“, rief Ben.", loesung: ["„Komm her“, rief Ben."], optionen: null },
          ],
        },
      ],
    },
    {
      titel: "Verben im Präteritum",
      merke: ["Starke Verben bekommen kein -te: heben → hob"],
      aus_deinem_text: [{ falsch: "sie hopten ab", richtig: "sie hoben ab" }],
      uebungen: [
        {
          titel: "Verb einsetzen",
          auftrag: "Setze das Verb im Präteritum ein.",
          art: "luecke",
          beispiel: null,
          faehigkeit: "gibt.es.nicht",
          satzzeichen_zaehlen: false,
          aufgaben: [
            { vorgabe: "Mira rief an, aber niemand ____ ab. (abheben)", loesung: ["hob"], optionen: null },
            { vorgabe: "Die Mädchen ___ in den Wald. (rennen)", loesung: ["rannten"], optionen: null },
            // zwei Lücken, eine Lösung: fällt weg
            { vorgabe: "Er ___ und ___ . (laufen, schreien)", loesung: ["lief"], optionen: null },
          ],
        },
        {
          titel: "Einzahl oder Mehrzahl",
          auftrag: "Kreise die richtige Form ein.",
          art: "auswahl",
          beispiel: null,
          faehigkeit: null,
          satzzeichen_zaehlen: false,
          aufgaben: [
            { vorgabe: "Die Familie war / waren nicht da.", loesung: ["war"], optionen: ["war", "waren"] },
            // die Lösung ist keine der Wahlen: fällt weg
            { vorgabe: "Ihre Augen glühte / glühten.", loesung: ["glühen"], optionen: ["glühte", "glühten"] },
          ],
        },
      ],
    },
    {
      titel: "So wird es gruselig",
      merke: ["Gefühle zeigen statt nennen: Ihr Herz raste."],
      aus_deinem_text: [],
      uebungen: [
        { titel: "Zeigen statt sagen", auftrag: "Schreib den Satz gruselig um (2–3 Sätze).", art: "schreiben", beispiel: "Emma hatte Angst. → Emma zitterte.", faehigkeit: null, satzzeichen_zaehlen: false, aufgaben: [{ vorgabe: "Mira hatte Angst.", loesung: ["Miras Hände zitterten. Sie bekam kaum Luft."], optionen: null }] },
        // nichts Brauchbares: die Übung fällt ganz weg
        { titel: "Leer", auftrag: "", art: "satz", beispiel: null, faehigkeit: null, satzzeichen_zaehlen: false, aufgaben: [{ vorgabe: "", loesung: [], optionen: null }] },
      ],
    },
  ],
  kontrollliste: ["Habe ich bei jeder direkten Rede „ unten und “ oben gesetzt?", "Steht alles im Präteritum?"],
  pruefen: [],
};

async function setup() {
  const repo = await import("./repo");
  const units = await import("./units");
  const texts = await import("./texts");
  const tc = await import("./text-correction");
  const { docFromText } = await import("./text-doc");
  const teacher = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Hanna Gruselig", grade: 6, klasse: 2, teacher_id: teacher.id, school: "", school_type: "AHS", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const unit = units.startUnit(teacher.id, sid, { subject: "Deutsch" }).unit;
  const satz = "Hanna schreibt: Lauf schrie Mira panisch. Wir gehen in die schule.";
  const t = texts.createText({ studentId: sid, teacherId: teacher.id, unitId: unit.id, subject: "Deutsch", topic: "Gruselgeschichte", title: "Der Werwolf", prompt: "" });
  texts.saveFromPaper(t.id, docFromText(satz));
  const c = tc.ensureCorrection(t.id, teacher.id, unit.id);
  const stelle = (wort: string, neu: string, category: string) => {
    const start = satz.indexOf(wort);
    const out = tc.addTeacherItem(c.id, { block: 0, start, end: start + wort.length, category, kind: "fehler", replacement: neu, explanation: "" }, teacher.id);
    assert.ok("item" in out, JSON.stringify(out));
  };
  return { repo, unit, teacher, sid, textId: t.id, stelle };
}

test("the KI answer becomes checked tasks: unclear ones are dropped, Teile and Merke go to the settings", async () => {
  const { heftAusKi } = await import("./uebungsheft");
  const repo = await import("./repo");
  const erlaubt = new Set([REDE, ...repo.listSkills().filter((s) => s.subject === "Deutsch").map((s) => s.id)]);
  const out = heftAusKi(HEFT, { erlaubt, fach: "Deutsch", student: { school_type: "AHS", klasse: 2, grade: 6 }, ersatz: REDE, quelle: { art: "text", textId: 1 } });
  assert.deepEqual(
    out.aufgaben.map((a) => [a.type, a.data.heft]),
    [
      ["grammar", { teil: 0, uebung: 0 }],
      ["grammar", { teil: 0, uebung: 0 }],
      ["fix", { teil: 0, uebung: 1 }],
      ["cloze", { teil: 1, uebung: 0 }],
      ["cloze", { teil: 1, uebung: 0 }],
      ["mc", { teil: 1, uebung: 1 }],
      ["free", { teil: 2, uebung: 0 }],
    ],
  );
  assert.equal(out.verworfen, 5);
  // direkte Rede: jedes Satzzeichen zählt, die Art der Anführungszeichen nicht
  const { checkAnswer } = await import("./tasks");
  const erste = out.aufgaben[0];
  assert.equal(erste.answer.satzzeichen, true);
  assert.equal(checkAnswer(erste, "\"Lauf!\", schrie Mira panisch.").correct, true);
  assert.equal(checkAnswer(erste, "„Lauf!“ schrie Mira panisch.").correct, false, "the comma is missing");
  assert.equal(checkAnswer(out.aufgaben[3], JSON.stringify(["hob"])).correct, true);
  // „____“ der KI wird eine Lücke der App
  assert.match(out.aufgaben[3].prompt, /niemand ___ ab/);
  // jede Aufgabe hat eine Fähigkeit (sonst ginge sie nicht ans Tablet)
  assert.ok(out.aufgaben.every((a) => a.skillId && erlaubt.has(a.skillId)));
  assert.deepEqual(out.info.teile.map((t) => [t.titel, t.uebungen.length]), [["Direkte Rede", 2], ["Verben im Präteritum", 2], ["So wird es gruselig", 1]]);
  assert.equal(out.info.kontrolle.length, 2);
});

test("from the corrected text: the student's name is replaced, the marked errors go along; one run at a time; the Heft is a draft", async () => {
  const s = await setup();
  const uh = await import("./uebungsheft");
  assert.deepEqual(uh.starteUebungsheft({ teacherId: s.teacher.id, unitId: s.unit.id, textId: s.textId }), { fehler: "In der Korrektur ist kein Fehler markiert." });
  s.stelle("Lauf schrie Mira panisch.", "„Lauf!“, schrie Mira panisch.", "zeichensetzung");
  s.stelle("schule", "Schule", "rechtschreibung");
  assert.ok("fehler" in uh.starteUebungsheft({ teacherId: s.teacher.id, unitId: s.unit.id, textId: s.textId }), "no KI: no Heft");

  process.env.ANTHROPIC_API_KEY = "test-nicht-echt";
  const router = await import("./ai/router");
  const gefragt: AIRequest[] = [];
  router.resetRouter();
  let antworte: () => void = () => {};
  const warte = new Promise<void>((r) => (antworte = r));
  router.setTransport(async (req) => {
    gefragt.push(req);
    await warte;
    return { parsed: HEFT, refusal: false, model: req.model, usage: { input: 3_000, output: 6_000, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  try {
    const a = uh.starteUebungsheft({ teacherId: s.teacher.id, unitId: s.unit.id, textId: s.textId });
    assert.ok("id" in a);
    assert.equal(uh.heftLaufZumText(s.textId)?.status, "laeuft");
    // a second tap while it runs: the same run, nothing paid twice
    assert.deepEqual(uh.starteUebungsheft({ teacherId: s.teacher.id, unitId: s.unit.id, textId: s.textId }), a);
    antworte();
    await uh.warteAufHeft(a.id);
    assert.equal(gefragt.length, 1);
    const anfrage = JSON.stringify(gefragt[0]);
    assert.doesNotMatch(anfrage, /Hanna/, "the student's name never goes to the KI");
    assert.match(anfrage, /\[Name\] schreibt/);
    assert.match(anfrage, /schule.*→.*Schule/);
    const lauf = uh.heftLaufZumText(s.textId)!;
    assert.equal(lauf.status, "fertig");
    const w = s.repo.getWorksheet(lauf.worksheetId!)!;
    assert.equal(w.status, "entwurf");
    assert.equal(w.student_id, s.sid);
    assert.equal(w.title, "Hanna – Fit für die Schularbeit: Gruselgeschichte");
    assert.equal(s.repo.listTasks(w.id).length, 7);
    const info = uh.heftInfo(w.settings)!;
    assert.equal(info.teile[0].merke[0], "Anfang: „ unten – Ende: “ oben");
    assert.deepEqual(info.quelle, { art: "text", textId: s.textId });
    // it can be sent: every task passes the builder's check
    const { releaseWorksheet } = await import("./builder");
    const r = releaseWorksheet(w.id, s.sid);
    assert.equal(r.error, undefined);
    assert.equal(s.repo.getAssignment(r.assignmentId!)?.unit_id, s.unit.id);

    // mit dem Stift (Heft am Tablet, auch in Deutsch): liniert, Teil und Übung über ihrer ersten Aufgabe, Platz nach der Art
    const heft = await import("./heft");
    assert.equal(heft.gehtAlsHeft(s.unit), false, "a Deutsch exercise from the generator stays typed");
    heft.alsHeft(r.assignmentId!);
    const h = heft.getHeft(r.assignmentId!)!;
    assert.equal(h.linien, true);
    assert.equal(h.titel, "Fit für die Schularbeit: Gruselgeschichte", "no first name on the page");
    assert.equal(h.vorweg, HEFT.vorweg);
    assert.equal(h.kontrolle.length, 2);
    assert.deepEqual(h.aufgaben.map((a) => [a.abschnitt?.teil?.buchstabe ?? "", a.abschnitt?.uebung?.nr ?? 0]), [["A", 1], ["", 0], ["", 2], ["B", 3], ["", 0], ["", 4], ["C", 5]]);
    assert.equal(h.aufgaben[0].text, "Lauf schrie Mira panisch", "the instruction stands once above the Übung");
    assert.deepEqual(h.felder.map((f) => f.hoehe), [270, 270, 380, 200, 200, 200, 720]);
    assert.ok(heft.bereinige([{ taskId: h.aufgaben[3].taskId, hoehe: 200, striche: [] }], [h.aufgaben[3].taskId])![0].hoehe === 200, "a small field stays small");
  } finally {
    router.setTransport(null);
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test("Heft view: Teil and Übung headers only at their first task, Übungen numbered through the Heft, the instruction not repeated", async () => {
  const { abschnitte, ohneAuftrag } = await import("./uebungsheft-ansicht");
  const info = {
    vorweg: "",
    teile: [
      { titel: "Direkte Rede", merke: ["m"], beispiele: [], uebungen: [{ titel: "Ü1", auftrag: "Schreib richtig.", beispiel: null }, { titel: "Ü2", auftrag: "Finde den Fehler.", beispiel: null }] },
      { titel: "Verben", merke: [], beispiele: [], uebungen: [{ titel: "Ü3", auftrag: "Setze ein.", beispiel: null }] },
    ],
    kontrolle: [],
    pruefen: [],
    quelle: { art: "text" as const, textId: 1 },
  };
  const k = abschnitte(info, [{ teil: 0, uebung: 0 }, { teil: 0, uebung: 0 }, { teil: 0, uebung: 1 }, undefined, { teil: 1, uebung: 0 }]);
  assert.deepEqual(
    k.map((a) => (a ? [a.teil?.buchstabe ?? "", a.uebung?.nr ?? 0] : null)),
    [["A", 1], ["", 0], ["", 2], null, ["B", 3]],
  );
  assert.equal(ohneAuftrag("Schreib richtig.\nLauf schrie Mira", "Schreib richtig."), "Lauf schrie Mira");
  // Fehlerdetektiv: nur die Anweisung, der Satz steht im Feld: keine eigene Zeile
  assert.equal(ohneAuftrag("Finde den Fehler.", "Finde den Fehler."), "");
  assert.equal(ohneAuftrag("Etwas anderes", "Finde den Fehler."), "Etwas anderes");
});
