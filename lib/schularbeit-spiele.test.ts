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

test("Satzglieder: jeder Satz liest sich, je Satz ein Subjekt und ein Prädikat, genug Karten je Satzglied und Stufe", async () => {
  const g = await import("./satzglieder-spiel");
  const fehler: string[] = [];
  const texte = new Set<string>();
  for (const src of g.SATZGLIED_SAETZE) {
    const s = g.leseSatzgliedSatz(src);
    if (texte.has(s.text)) fehler.push(`doppelt: ${s.text}`);
    texte.add(s.text);
    if (/[[\]]/.test(s.text)) fehler.push(`Klammer übrig: ${s.text}`);
    if (!/^[A-ZÄÖÜ]/.test(s.text) || !/[.!?]$/.test(s.text)) fehler.push(`Satzanfang oder -ende: ${s.text}`);
    const n = (e: string) => s.teile.filter((t) => t.etikett === e).length;
    if (n("s") !== 1 || n("p") !== 1) fehler.push(`Subjekt und Prädikat je einmal: ${s.text}`);
    if (n("d") > 1 || n("a") > 1) fehler.push(`Objekt doppelt: ${s.text}`);
    for (const t of s.teile) {
      if (`${t.vor}${t.mitte}${t.nach}` !== s.text) fehler.push(`Stelle von „${t.mitte}“ in ${s.text}`);
      if (t.etikett === "p" && /\s/.test(t.mitte)) fehler.push(`Prädikat ein Wort: ${s.text}`);
    }
    // Prädikat an zweiter Stelle: davor steht genau ein Satzglied
    const p = s.teile.find((t) => t.etikett === "p")!;
    if (!p.vor.trim()) fehler.push(`Prädikat vorne: ${s.text}`);
  }
  const karten = g.satzgliedKandidaten();
  if (new Set(karten.map((k) => k.karte.key)).size !== karten.length) fehler.push("doppelte Keys");
  for (const gl of g.SATZGLIED_FAECHER) if (karten.filter((k) => k.karte.richtig === gl).length < 30) fehler.push(`${gl}: zu wenige`);
  for (const s of [0, 1, 2, 3]) if (karten.filter((k) => k.stufe === s).length < 12) fehler.push(`Stufe ${s}: zu wenige`);
  for (const { karte } of karten) if (!karte.regel.includes(karte.mitte!.slice(1)) && karte.richtig !== "Prädikat") fehler.push(`${karte.loesung}: Regel ohne das Satzglied`);
  assert.deepEqual(fehler, []);
});

test("Satzglieder: Regeln fragen mit dem Prädikat des Satzes", async () => {
  const g = await import("./satzglieder-spiel");
  const karte = (text: string, teil: string) => g.satzgliedKandidaten().find((k) => k.karte.key === g.satzgliedKey(text, teil))!;
  assert.match(karte("Der kleine Hund jagt die Katze.", "Der kleine Hund").karte.regel, /^Frag: Wer oder was jagt\? Der kleine Hund\./);
  assert.match(karte("Lisa hilft ihrer Oma.", "ihrer Oma").karte.regel, /^Frag: Wem hilft Lisa\? Ihrer Oma\. .*3\. Fall/);
  assert.match(karte("Mama schenkt der Oma Blumen.", "Blumen").karte.regel, /^Frag: Wen oder was schenkt Mama\? Blumen\..*4\. Fall/);
  assert.match(karte("Unsere Klasse besucht den Zoo.", "den Zoo").karte.regel, /Wen oder was besucht unsere Klasse\?/);
  assert.equal(karte("Den Ball wirft Tom.", "Den Ball").stufe, 3);
  assert.equal(karte("Am Morgen trinkt Opa einen Kaffee.", "Opa").stufe, 2);
  assert.equal(karte("Der Hund frisst einen Knochen.", "frisst").stufe, 0);
  const k = karte("Lisa hilft ihrer Oma.", "ihrer Oma").karte;
  assert.equal(k.form, "kacheln");
  assert.deepEqual(k.faecher, ["Subjekt", "Prädikat", "Objekt 3. Fall", "Objekt 4. Fall"]);
});

test("Satzglieder: Stoff bringt das Spiel zuerst, Lernstand Volksschule und Unterstufe", async () => {
  const { sp, student } = await setup({ grade: 4 });
  assert.deepEqual(sp.spieleZuSkills(["deutsch.vs.sprache.satzglieder"]).slice(0, 2), ["satzglieder", "satzbau"]);
  assert.equal(sp.spieleZuSkills(["deutsch.satz.objekte"])[0], "satzglieder");
  assert.ok(sp.spielVorschlaege(student, { heute: HEUTE }).some((v) => v.art === "satzglieder"));
  assert.equal(sp.skillFuerSpiel(student, "satzglieder", HEUTE), "deutsch.vs.sprache.satzglieder");
  const r = sp.starteRunde(student, "satzglieder", { heute: HEUTE, rng: rng(5) });
  assert.equal(r.karten.length, 12);
  assert.equal(new Set(r.karten.map((k) => k.key.split("|")[0])).size, 12);
  assert.ok(r.karten.every((k) => k.form === "kacheln" && k.mitte));
  const e = sp.beendeRunde(student.id, r.rundeId, r.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  assert.equal(e?.richtig, 12);
  const gross = await setup({ grade: 6 });
  const repo = gross.repo;
  repo.updateStudent(gross.student.id, { ...gross.student, school_type: "AHS" });
  assert.equal(gross.sp.skillFuerSpiel(repo.getStudent(gross.student.id)!, "satzglieder", HEUTE), "deutsch.satz.satzglieder");
});
