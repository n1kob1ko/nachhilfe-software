/**
 * Das Lernspiel „Stilmittel“ (lib/stilmittel.ts, Sätze in lib/stilmittel-saetze.ts): jede Zeile liest sich, jedes
 * Stilmittel hat genug Sätze, keine falsche Antwort ist ein Stilmittel, das im Satz auch steckt, jede Schulstufe sieht
 * nur Stilmittel, die schon dran waren, und die Runde zählt für die richtige Fähigkeit. Alle Namen sind erfunden; keine KI.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const HEUTE = "2026-11-17";

async function setup(o: { grade?: number; subjects?: string[] } = {}) {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const sp = await import("./lernspiele");
  const teacher = repo.listTeachers()[0];
  const grade = o.grade ?? 7;
  const id = repo.createStudent({
    name: "Mia Test", grade, klasse: grade - 4, teacher_id: teacher.id, school: "", school_type: "Gymnasium", subjects: o.subjects ?? ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, sp, student: repo.getStudent(id)! };
}

test("Sätze: jede Zeile liest sich, kein Satz doppelt, jedes Stilmittel hat genug Sätze", async () => {
  const s = await import("./stilmittel");
  const { STILMITTEL_SAETZE } = await import("./stilmittel-saetze");
  const fehler: string[] = [];
  const gesehen = new Set<string>();
  for (const id of s.STILMITTEL_IDS) {
    const zeilen = STILMITTEL_SAETZE[id].split("\n").map((z) => z.trim()).filter((z) => z && !z.startsWith("#"));
    for (const z of zeilen) {
      const r = s.leseSatz(id, z, 1);
      if (typeof r === "string") {
        fehler.push(`${id}: „${z}“: ${r}`);
        continue;
      }
      const satz = r.satz.toLocaleLowerCase("de");
      if (gesehen.has(satz)) fehler.push(`doppelt: „${r.satz}“`);
      gesehen.add(satz);
      // die angestrichene Stelle steht wirklich im Satz, in der richtigen Reihenfolge
      if (`${r.vor}${r.mitte}${r.nach}`.replace(/\s+/g, " ").trim() !== r.satz) fehler.push(`${id}: Klammern in „${z}“`);
      if (!r.mitte.trim()) fehler.push(`${id}: nichts angestrichen in „${z}“`);
      if (r.auch.includes(id)) fehler.push(`${id}: steckt in sich selbst „${z}“`);
    }
    const n = s.stilSaetze().filter((x) => x.id === id);
    if (n.length < 10) fehler.push(`${id}: nur ${n.length} Sätze`);
    if (!n.some((x) => x.stufe === 1) || !n.some((x) => x.stufe === 2)) fehler.push(`${id}: leichte und schwere Sätze`);
  }
  assert.deepEqual(fehler, []);
  assert.ok(s.stilSaetze().length >= 280, `${s.stilSaetze().length} Sätze`);
});

test("Karten: nur bekannte Stilmittel, nie eines als falsch, das im Satz auch steckt", async () => {
  const s = await import("./stilmittel");
  const fehler: string[] = [];
  for (let stufe = 5; stufe <= 13; stufe++) {
    const bekannt = new Set(s.stilmittelBis(stufe).map((id) => s.STILMITTEL[id].name));
    const karten = s.stilmittelKandidaten(stufe);
    if (karten.length < 60) fehler.push(`Schulstufe ${stufe}: nur ${karten.length} Karten`);
    for (const { karte } of karten) {
      const satz = s.stilSaetze().find((x) => karte.loesung === `${x.satz} → ${x.id && s.STILMITTEL[x.id].name}`)!;
      const nie = new Set([...s.nieFalsch(satz)].map((id) => s.STILMITTEL[id].name));
      if (karte.form !== "kacheln" || karte.mitte === undefined) fehler.push(`${karte.loesung}: keine Kacheln`);
      if (new Set(karte.faecher).size !== karte.faecher.length) fehler.push(`${karte.loesung}: doppelte Kachel`);
      if (karte.faecher.length < s.STIL_KACHELN_MIN || karte.faecher.length > s.STIL_KACHELN) fehler.push(`${karte.loesung}: ${karte.faecher.length} Kacheln`);
      if (!karte.faecher.includes(karte.richtig)) fehler.push(`${karte.loesung}: ohne die richtige`);
      for (const f of karte.faecher) {
        if (!bekannt.has(f)) fehler.push(`Schulstufe ${stufe}: ${f} ist noch nicht dran (${karte.loesung})`);
        if (f !== karte.richtig && nie.has(f)) fehler.push(`${karte.loesung}: ${f} steckt auch drin`);
      }
      if (karte.skill !== s.stilSkill(satz.id, stufe)) fehler.push(`${karte.loesung}: Fähigkeit ${karte.skill}`);
    }
  }
  assert.deepEqual(fehler.slice(0, 20), []);
  // 1. Klasse: die fünf ersten; Oberstufe: alle 27, jede Regel mit Wirkung
  assert.ok(s.STILMITTEL_IDS.every((id) => s.STILMITTEL[id].merke.includes("Wirkung:")));
  assert.deepEqual(s.STILMITTEL_IDS.filter((id) => s.STILMITTEL[id].ab <= 8).length, 15);
  assert.deepEqual(s.stilmittelBis(5), ["vergleich", "personifikation", "metapher", "lautmalerei", "alliteration"]);
  assert.equal(s.stilmittelBis(9).length, s.STILMITTEL_IDS.length);
  // dieselbe Karte hat nicht für jeden Satz eines Stilmittels dieselben falschen (sonst erkennt man sie an den Kacheln)
  for (const id of s.STILMITTEL_IDS) {
    const name = s.STILMITTEL[id].name;
    const saetze = new Set(s.stilmittelKandidaten(12).filter((k) => k.karte.richtig === name).map((k) => [...k.karte.faecher].sort().join("|")));
    assert.ok(saetze.size >= 3, `${name}: immer dieselben Kacheln`);
  }
});

test("Was man am Satz sieht, ist nie eine falsche Antwort", async () => {
  const { siehtAus } = await import("./stilmittel");
  assert.ok(siehtAus("Er ist stark wie ein Bär.").has("vergleich"));
  assert.ok(siehtAus("Wer will schon verlieren?").has("rhetorisch"));
  assert.ok(siehtAus("Milch macht müde Männer munter.").has("alliteration"));
  assert.ok(siehtAus("Ich hoffe, ich warte, ich glaube.").has("anapher"));
  assert.ok(siehtAus("Du bist schuld, er ist schuld.").has("epipher"));
  assert.ok(siehtAus("Mama kocht das Essen, Papa deckt den Tisch.").has("parallelismus"));
  assert.equal(siehtAus("Die Sonne lacht vom Himmel.").size, 0);
  // für die Textinterpretation (Oberstufe)
  assert.ok(siehtAus("Er lief und lief.").has("wiederholung"));
  assert.ok(siehtAus("Im Korb lagen Brot, Käse und Äpfel.").has("aufzaehlung"));
  assert.ok(siehtAus("Obwohl es regnete, ging sie hinaus.").has("hypotaxe"));
  assert.ok(siehtAus("Der Zug hielt. Keiner stieg aus.").has("parataxe"));
  assert.ok(!siehtAus("Obwohl es regnete, ging sie hinaus.").has("parataxe"));
  assert.ok(siehtAus("Am Grab brannte eine Kerze.").has("symbol"));
});

test("Runde: zwölf Karten mit Kacheln, zählt in der Unterstufe für „Sprachliche Bilder“", async () => {
  const { sp, student } = await setup({ grade: 7 });
  const r = sp.starteRunde(student, "stilmittel", { heute: HEUTE, rng: rng(3) });
  assert.equal(r.karten.length, 12);
  assert.ok(r.karten.every((k) => k.form === "kacheln" && k.mitte !== undefined && k.skill === "deutsch.literatur.sprachbilder"));
  assert.equal(sp.skillFuerSpiel(student, "stilmittel", HEUTE), "deutsch.literatur.sprachbilder");
  // die Runde wird gezählt wie jede andere
  const e = sp.beendeRunde(student.id, r.rundeId, r.karten.map((k, i) => ({ key: k.key, wahl: i < 9 ? k.richtig : "falsch" })));
  assert.equal(e?.richtig, 9);
  assert.deepEqual(sp.spielBelege(student.id).map((b) => [b.skillId, b.score]), [["deutsch.literatur.sprachbilder", 0.75]]);
  // im Tab „Spiele“ ab der 2. Klasse dabei, auch in Blockwerk und Torlauf spielbar
  const v = sp.spielVorschlaege(student, { heute: HEUTE });
  assert.ok(v.some((x) => x.art === "stilmittel"));
  const typen = await import("./lernspiele-typen");
  assert.ok(typen.hatEndlos("stilmittel") && typen.torTauglich("stilmittel") && typen.istDuellArt("stilmittel"));
});

test("Oberstufe: jede Karte zählt für ihre Gruppe, der Stoff setzt den Schwerpunkt", async () => {
  const { repo, sp, student } = await setup({ grade: 10 });
  const r = sp.starteRunde(student, "stilmittel", { heute: HEUTE, rng: rng(5) });
  assert.equal(r.karten.length, 12);
  // alle richtig: je Gruppe ein Beleg mit 1
  sp.beendeRunde(student.id, r.rundeId, r.karten.map((k) => ({ key: k.key, wahl: k.richtig })));
  const belege = sp.spielBelege(student.id);
  const gruppen = new Set(r.karten.map((k) => k.skill));
  assert.equal(belege.length, gruppen.size);
  assert.ok(belege.every((b) => b.skillId.startsWith("deutsch.os.stil.") && b.score === 1));

  // eine Schularbeit mit Satzfiguren: zwei Drittel der Karten daraus
  repo.addTest({ student_id: student.id, date: "2026-11-25", subject: "Deutsch", kind: "Schularbeit", topic: "Stilmittel", grade: null, points: null, max_points: null, notes: "", skill_ids: ["deutsch.os.stil.satzfiguren"], title: "Deutsch-Schularbeit", status: "geplant" });
  assert.equal(sp.skillFuerSpiel(student, "stilmittel", HEUTE), "deutsch.os.stil.satzfiguren");
  assert.equal(sp.spielWoher(student, "stilmittel", HEUTE), "Thema: Satzfiguren");
  assert.equal(sp.spielVorschlaege(student, { heute: HEUTE })[0].art, "stilmittel");
  const f = sp.starteRunde(student, "stilmittel", { heute: HEUTE, rng: rng(9) });
  assert.equal(f.karten.length, 12);
  assert.ok(f.karten.filter((k) => k.skill === "deutsch.os.stil.satzfiguren").length >= 8);
  const { db } = await import("./db");
  assert.equal((db().prepare("SELECT skill_id FROM spielrunden WHERE id = ?").get(f.rundeId) as { skill_id: string }).skill_id, "deutsch.os.stil.satzfiguren");
});

test("Duell: Karten für den Jüngeren", async () => {
  const s = await import("./stilmittel");
  const { waehleKarten, stufenFuer } = await import("./lernspiele-karten");
  const karten = waehleKarten("stilmittel", { pool: s.stilmittelKandidaten(6), stufen: stufenFuer("stilmittel", 6, null), rng: rng(4) });
  const bekannt = new Set(s.stilmittelBis(6).map((id) => s.STILMITTEL[id].name));
  assert.equal(karten.length, 12);
  assert.ok(karten.every((k) => k.faecher.every((f) => bekannt.has(f))));
});
