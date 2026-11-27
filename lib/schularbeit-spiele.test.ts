/**
 * Die Spiele zur Deutschschularbeit der Volksschule (niko 2026-11-27, Stoffzettel einer 4. Klasse): „Groß oder
 * klein?“ (lib/gross-klein-spiel.ts) und die Karten zum Steigern im Deutsch-Quiz. Jeder Satz liest sich, jede Karte
 * hat genau eine richtige Antwort, die Regel passt zum Satz. Keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const HEUTE = "2026-11-27";

async function setup(o: { grade?: number } = {}) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const grade = o.grade ?? 4;
  const id = repo.createStudent({
    name: "Lea Test", grade, klasse: grade, teacher_id: teacher.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, sp, student: repo.getStudent(id)! };
}

test("Groß oder klein: jeder Satz liest sich, groß nur mit Signalwort, genug Karten je Stufe und Antwort", async () => {
  const g = await import("./gross-klein-spiel");
  const fehler: string[] = [];
  const texte = new Set<string>();
  for (const [stufe, saetze] of Object.entries(g.GROSS_SAETZE)) {
    for (const src of saetze) {
      const t = g.leseGrossSatz(src);
      if (texte.has(t.text)) fehler.push(`doppelt: ${t.text}`);
      texte.add(t.text);
      if (!/^[A-ZÄÖÜ]/.test(t.text) || !/[.!?]$/.test(t.text)) fehler.push(`Satzanfang oder -ende: ${t.text}`);
      // am Satzanfang wäre das Wort immer groß
      if (!t.vor.trim()) fehler.push(`Wort am Satzanfang: ${t.text}`);
      if (/\s/.test(t.wort) || !/^\p{L}+$/u.test(t.wort)) fehler.push(`ein Wort: ${t.wort}`);
      const s = g.signalVor(t.vor);
      if (t.gross && !s) fehler.push(`groß ohne Signalwort: ${t.text}`);
      if (!t.gross && s) fehler.push(`klein mit Signalwort: ${t.text}`);
      if (Number(stufe) < 2 && s?.adjektiv) fehler.push(`Adjektiv dazwischen erst in Stufe 2: ${t.text}`);
    }
  }
  const karten = g.grossKandidaten();
  const keys = new Set(karten.map((k) => k.karte.key));
  if (keys.size !== karten.length) fehler.push("doppelte Keys");
  for (const { karte } of karten) {
    if (karte.faecher.length !== 2 || !karte.faecher.includes(karte.richtig)) fehler.push(`${karte.loesung}: Kacheln`);
    if (karte.faecher[0][0] === karte.faecher[0][0].toLowerCase() || karte.faecher[1][0] !== karte.faecher[1][0].toLowerCase()) fehler.push(`${karte.loesung}: links groß, rechts klein`);
    if (`${karte.vor}${karte.richtig}${karte.nach}` !== karte.loesung) fehler.push(`${karte.loesung}: Lücke`);
    if (!karte.regel.includes(karte.richtig)) fehler.push(`${karte.loesung}: Regel ohne das Wort`);
  }
  for (const s of [0, 1, 2]) {
    const n = karten.filter((k) => k.stufe === s);
    const gross = n.filter((k) => k.karte.marke === "groß").length;
    if (n.length < 24) fehler.push(`Stufe ${s}: nur ${n.length}`);
    // beide Antworten etwa gleich oft
    if (gross < n.length * 0.4 || gross > n.length * 0.65) fehler.push(`Stufe ${s}: ${gross} von ${n.length} groß`);
  }
  for (const sig of g.SIGNALE) if (karten.filter((k) => g.signalVor(k.karte.vor)?.signal === sig).length < 8) fehler.push(`zu wenige mit „${sig}“`);
  assert.deepEqual(fehler, []);
});

test("Groß oder klein: Regeln für Signalwort, Adjektiv dazwischen, „zu“ und das Verb", async () => {
  const g = await import("./gross-klein-spiel");
  const karte = (text: string) => g.grossKandidaten().find((k) => k.karte.loesung === text)!.karte;
  const a = karte("Beim Spielen habe ich mir das Knie aufgeschürft.");
  assert.deepEqual(a.faecher, ["Spielen", "spielen"]);
  assert.equal(a.richtig, "Spielen");
  assert.equal(a.form, "wischen");
  assert.match(a.regel, /„beim“/);
  assert.match(karte("Beim schnellen Laufen verliere ich oft die Mütze.").regel, /Adjektiv „schnellen“/);
  const zu = karte("Ich habe keine Lust zu lesen.");
  assert.equal(zu.richtig, "lesen");
  assert.match(zu.regel, /Nach „zu“ bleibt das Verb klein.*zum Lesen/);
  assert.match(karte("Wir wollen heute spielen.").regel, /ist hier ein Verb/);
  assert.match(karte("Das Lachen meiner Schwester steckt alle an.").regel, /„das“/);
});

test("Groß oder klein: Vorschlag in der Volksschule, Stoff bringt es zuerst, Runde wird gewischt und zählt", async () => {
  const { sp, student } = await setup({ grade: 4 });
  const arten = sp.spielVorschlaege(student, { heute: HEUTE }).map((x) => x.art);
  assert.ok(arten.includes("gross"), arten.join());
  assert.equal(sp.spieleZuSkills(["deutsch.recht.gross"])[0], "gross");
  const r = sp.starteRunde(student, "gross", { heute: HEUTE, rng: rng(3) });
  assert.equal(r.karten.length, 12);
  assert.ok(r.karten.every((k) => k.form === "wischen"));
  const gross = r.karten.filter((k) => k.marke === "groß").length;
  assert.ok(gross >= 5 && gross <= 7, `${gross} groß`);
  const e = sp.beendeRunde(student.id, r.rundeId, r.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  assert.equal(e?.richtig, 12);
  assert.equal(sp.skillFuerSpiel(student, "gross", HEUTE), "deutsch.recht.gross");
  // 2. Klasse: noch nicht zum Üben
  const klein = await setup({ grade: 2 });
  assert.ok(!klein.sp.spielVorschlaege(klein.student, { heute: HEUTE }).some((v) => v.art === "gross"));
});

test("Steigern: genug Karten im Deutsch-Quiz, mit Grund-, Mehr- und Meiststufe", async () => {
  const { DEUTSCH_UNTERSTUFE } = await import("./quiz/deutsch-unterstufe");
  const text = DEUTSCH_UNTERSTUFE["deutsch.wortarten.steigerung"] as string;
  const zeilen = text.split("\n").filter((z) => z.includes(" = "));
  assert.ok(zeilen.length >= 50, `${zeilen.length} Karten`);
  for (const w of ["Grundstufe", "Mehrstufe", "Meiststufe"]) assert.ok(text.includes(w), w);
});
