/**
 * Die Kurzgeschichten (lib/kurzgeschichten.ts): genug Zeilen und Wörter für eine Interpretation, jede Musterantwort
 * zitiert wörtlich mit der richtigen Zeile, keine Geschichte doppelt, und der Schreibauftrag erkennt die Geschichte.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

test("Sammlung: jede Geschichte reicht für eine Interpretation, jedes Zitat steht in der genannten Zeile", async () => {
  const k = await import("./kurzgeschichten");
  const { numberedLines, quotesOf, findInStory, MIN_STORY_LINES, lastLine } = await import("./textinterpretation");
  const { docFromText, countWords } = await import("./text-doc");
  assert.ok(k.KURZGESCHICHTEN.length >= 7);
  assert.equal(new Set(k.KURZGESCHICHTEN.map((g) => g.id)).size, k.KURZGESCHICHTEN.length);
  assert.equal(new Set(k.KURZGESCHICHTEN.map((g) => g.titel)).size, k.KURZGESCHICHTEN.length);
  const fehler: string[] = [];
  for (const g of k.KURZGESCHICHTEN) {
    const lines = numberedLines(g.text);
    const n = lastLine(lines);
    if (n < MIN_STORY_LINES || n > 80) fehler.push(`${g.titel}: ${n} Zeilen`);
    const w = countWords(g.text);
    if (w < 380 || w > 900) fehler.push(`${g.titel}: ${w} Wörter`);
    if (g.text.split("\n").some((z) => z.length > 80)) fehler.push(`${g.titel}: Zeile zu lang`);
    for (const key of k.FRAGE_KEYS) {
      const a = g.antworten[key];
      if (!a || a.length < 30) fehler.push(`${g.titel}/${key}: keine Antwort`);
      for (const q of quotesOf(docFromText(a)).filter((q) => q.text !== g.titel)) {
        const found = findInStory(lines, q.text);
        if (!found.length) fehler.push(`${g.titel}/${key}: „${q.text}“ steht nicht im Text`);
        else if (!q.hasRef) fehler.push(`${g.titel}/${key}: „${q.text}“ ohne Zeile`);
        else if (!q.refs.some((r) => found.some((f) => f.from >= r.from && f.to <= (r.to === "ff" ? n : r.to)))) fehler.push(`${g.titel}/${key}: „${q.text}“ nicht in ${JSON.stringify(q.refs)}, sondern ${JSON.stringify(found)}`);
      }
    }
    // die Stellen für OP2 und OP3: mindestens fünf Belege mit Zeile in den Antworten
    const belege = k.FRAGE_KEYS.flatMap((key) => quotesOf(docFromText(g.antworten[key])).filter((q) => q.hasRef));
    if (belege.length < 5) fehler.push(`${g.titel}: nur ${belege.length} Belege`);
  }
  assert.deepEqual(fehler, []);
  // verschiedene Erzählformen zum Üben
  const erzaehler = k.KURZGESCHICHTEN.map((g) => g.antworten.erzaehler);
  for (const form of ["Ich-Erzähler", "Wir-Erzähler", "auktorial", "personal"]) assert.ok(erzaehler.some((e) => e.includes(form)), form);
});

test("Schreibauftrag: die Geschichte wird erkannt, der Schüler sieht die Fragen ohne Antworten", async () => {
  const k = await import("./kurzgeschichten");
  const g = k.KURZGESCHICHTEN[2];
  // eingefügt mit Leerzeichen am Rand und Windows-Zeilenenden: dieselbe Geschichte
  assert.equal(k.geschichteMitText(g.text.split("\n").map((z) => ` ${z} `).join("\r\n"))?.id, g.id);
  assert.equal(k.geschichteMitText(`${g.text}\nEine Zeile mehr.`), undefined);
  assert.equal(k.geschichteMitText(""), undefined);
  const mit = k.verstaendnisFragen(g, true);
  const ohne = k.verstaendnisFragen(g, false);
  assert.equal(mit.length, k.FRAGE_KEYS.length);
  assert.ok(mit.every((f) => f.antwort) && ohne.every((f) => f.antwort === undefined));
  assert.deepEqual(mit.slice(0, 2).map((f) => f.frage), ["Wer kommt vor?", "Was passiert am Ende?"]);

  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const store = await import("./schreibauftrag-store");
  const t = repo.listTeachers()[0];
  const sid = repo.createStudent({ name: "Tom Test", grade: 11, klasse: 3, teacher_id: t.id, school: "", school_type: "HTL", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const mk = (story: string) => {
    const out = store.cleanAuftragSettings("textinterpretation", { title: g.titel, author: g.autor, year: g.jahr, kind: "Kurzgeschichte", story, target: "", prompt: "" });
    if ("error" in out) throw new Error(out.error);
    return store.createAuftrag({ studentId: sid, teacherId: t.id, unitId: null, settings: out.settings });
  };
  const a = mk(g.text);
  const v = store.auftragFor(a.id)!;
  assert.equal(v.fragen?.length, k.FRAGE_KEYS.length);
  assert.ok(v.fragen?.every((f) => f.antwort));
  const s = store.fuerSchueler(v);
  assert.ok(s.fragen?.every((f) => f.antwort === undefined) && s.fragen?.length === k.FRAGE_KEYS.length);
  // eine eigene Geschichte hat keine Fragen
  const eigen = mk(`${g.text}\nEine Zeile, die die Lehrkraft dazugeschrieben hat.`);
  assert.equal(store.auftragFor(eigen.id)!.fragen, undefined);
});
