import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const top = async () => (await import("./mathe-themen")).MATHE_THEMEN.filter((s) => !s.parentId);

test("maths topics 5. to 8. Schulstufe: every skill has an explanation and typical errors, fits the Unterstufe, no duplicates", async () => {
  const { MATHE_THEMEN, MATHE_ERKLAERUNG, TYPISCHE_FEHLER, typischeFehler } = await import("./mathe-themen");
  const { CURRICULUM } = await import("./curriculum");
  const { EXPLAIN } = await import("./generators");
  const skills = await top();
  assert.ok(skills.length >= 90, `${skills.length} skills`);
  assert.equal(new Set(CURRICULUM.map((s) => s.id)).size, CURRICULUM.length, "ids are unique");
  const names = CURRICULUM.filter((s) => s.subject === "Mathematik" && !s.parentId).map((s) => `${s.area} › ${s.name}`.toLowerCase());
  assert.equal(new Set(names).size, names.length, "no skill twice in a topic");
  // new skills sit at the end, so the seed numbers the old ones as before
  assert.deepEqual(CURRICULUM.slice(-MATHE_THEMEN.length), MATHE_THEMEN);
  for (const s of MATHE_THEMEN) {
    assert.ok(s.gradeMin >= 5 && s.gradeMin <= 8 && s.gradeMax <= 9 && s.gradeMin <= s.gradeMax, `${s.id}: Schulstufe ${s.gradeMin}–${s.gradeMax}`);
    assert.ok(MATHE_ERKLAERUNG[s.id]?.length > 40 && EXPLAIN[s.id] === MATHE_ERKLAERUNG[s.id], `${s.id}: explanation, also as sample answer`);
  }
  for (const s of skills) assert.ok(TYPISCHE_FEHLER[s.id]?.length >= 3, `${s.id}: typical errors`);
  // the maths skills that were there before have typical errors too; a Teilfähigkeit gets its skill's
  for (const s of CURRICULUM.filter((x) => x.subject === "Mathematik" && !x.parentId)) assert.ok(typischeFehler(s.id).length >= 3, s.id);
  assert.deepEqual(typischeFehler("mathe.brueche.dividieren.kehrwert"), TYPISCHE_FEHLER["mathe.brueche.dividieren"]);
  assert.deepEqual(typischeFehler("mathe.gleichungssysteme.rechnerisch.einsetzen"), TYPISCHE_FEHLER["mathe.gleichungssysteme.rechnerisch"]);
  assert.deepEqual(typischeFehler("deutsch.beistrich.nebensatz"), []);
  // plain copy rules: no em dash, no placeholder, short enough for the skill page
  for (const text of [...Object.values(MATHE_ERKLAERUNG), ...Object.values(TYPISCHE_FEHLER).flat()]) {
    assert.ok(!text.includes("—") && !/TODO|XXX/.test(text), text);
    assert.ok(text.length < 420, text);
  }
});

test("maths topics: the topics of the school books are there and the search finds them", async () => {
  const { matchSkills } = await import("./lehrplan");
  const ids = (await top()).map((s) => s.id);
  // topic names from the tables of contents of common Unterstufe maths books (only the names)
  for (const id of [
    "mathe.zahlen.roemisch", "mathe.zahlen.zehner", "mathe.zahlen.rechengesetze", "mathe.masse.geld", "mathe.masse.massstab", "mathe.brueche.vonzahlen",
    "mathe.brueche.gemischt", "mathe.geometrie.kreis", "mathe.flaechen.zusammengesetzt", "mathe.flaechen.umkehr", "mathe.koerper.netze",
    "mathe.teilbarkeit.ggt-kgv", "mathe.proportional.indirekt", "mathe.prozent.promille", "mathe.dreiecke.punkte", "mathe.terme.binomisch",
    "mathe.pythagoras.koerper", "mathe.gleichungssysteme.text", "mathe.funktionen.linear", "mathe.koerper.kegel", "mathe.statistik.kreuztabellen",
  ]) assert.ok(ids.includes(id), id);

  const first = (topic: string) => matchSkills(topic, "Mathematik")[0]?.skill.id;
  assert.equal(first("Binomische Formeln"), "mathe.terme.binomisch");
  assert.equal(first("Flächeninhalt Dreieck"), "mathe.flaechen.dreieck");
  assert.equal(first("Lineare Funktionen"), "mathe.funktionen.linear", "no longer „Einfache lineare Gleichungen“");
  assert.equal(first("Schlussrechnung"), "mathe.proportional.direkt");
  assert.equal(first("Herausheben"), "mathe.terme.herausheben");
  assert.ok(matchSkills("Pythagoras", "Mathematik").length >= 4);
  assert.ok(matchSkills("Pythagoras", "Mathematik").every((m) => m.skill.id.startsWith("mathe.pythagoras.") || m.skill.area === "Satz des Pythagoras"));
  assert.deepEqual(matchSkills("Photosynthese", "Mathematik"), []);
  // the student's level still counts: a 1. Klasse gets no Pythagoras
  const kid = { school_type: "Mittelschule", klasse: 1, grade: 5 };
  assert.deepEqual(matchSkills("Pythagoras", "Mathematik", { student: kid }), []);
  assert.equal(matchSkills("Maßstab", "Mathematik", { student: kid })[0]?.skill.id, "mathe.masse.massstab");
});

test("maths topics: seeded with prerequisites, browsable per class, linked to the Lehrplan of MS and AHS", async () => {
  const { db } = await import("./db");
  const repo = await import("./repo");
  const { browseSkills } = await import("./lehrplan");
  const { schoolBranch } = await import("./school");
  const { CURRICULUM, PREREQUISITES } = await import("./curriculum");
  const { MATHE_THEMEN } = await import("./mathe-themen");
  const imp = await import("./curriculum-import");
  const skills = await top();

  // seeded behind the skills that were there before, with their prerequisites
  const sort = (id: string) => (db().prepare("SELECT sort FROM skills WHERE id = ?").get(id) as { sort: number }).sort;
  const old = CURRICULUM.slice(0, -MATHE_THEMEN.length);
  assert.ok(Math.min(...MATHE_THEMEN.map((s) => sort(s.id))) > Math.max(...old.map((s) => sort(s.id))));
  assert.ok(repo.getSkill("mathe.gleichungssysteme.rechnerisch.einsetzen")?.parent_id === "mathe.gleichungssysteme.rechnerisch");
  const link = db().prepare("SELECT 1 FROM skill_links WHERE skill_id = ? AND other_id = ? AND kind = 'voraussetzung'");
  for (const [skill, before] of PREREQUISITES) assert.ok(link.get(skill, before), `${skill} ← ${before}`);
  // no circle: following „before“ never comes back to the start
  const before = new Map<string, string[]>();
  for (const [s, b] of PREREQUISITES) before.set(s, [...(before.get(s) ?? []), b]);
  const reaches = (from: string, to: string, seen = new Set<string>()): boolean =>
    (before.get(from) ?? []).some((b) => b === to || (!seen.has(b) && (seen.add(b), reaches(b, to, seen))));
  for (const [s] of PREREQUISITES) assert.ok(!reaches(s, s), `circle at ${s}`);

  // Fähigkeiten › Mathematik › Mittelschule › Klasse
  const ms = schoolBranch("mittelschule")!;
  const inKlasse = (k: number) => new Set(browseSkills({ subject: "Mathematik", branch: ms, klasse: k }).map((s) => s.area));
  for (const area of ["Natürliche Zahlen", "Dezimalzahlen", "Größen und Maße", "Flächeninhalt und Umfang", "Körper", "Statistik"]) assert.ok(inKlasse(1).has(area), `1. Klasse: ${area}`);
  for (const area of ["Satz des Pythagoras", "Funktionen", "Gleichungssysteme", "Wurzeln"]) assert.ok(inKlasse(4).has(area) && !inKlasse(1).has(area), `4. Klasse: ${area}`);

  // every skill is linked in both Lehrplan packages, every link points to an entry that exists
  for (const file of ["ris-ms-mathematik.json", "ris-ahs-mathematik.json"]) {
    const pkg = imp.readBundled(file)!;
    const codes = new Set(pkg.nodes!.map((n) => n.code));
    const linked = new Set(pkg.skill_nodes!.map(([s]) => s));
    for (const s of skills) assert.ok(linked.has(s.id), `${file}: ${s.id}`);
    for (const [s, code] of pkg.skill_nodes!) assert.ok(codes.has(code), `${file}: ${s} → ${code}`);
    // a skill is linked only within its classes (Schulstufe 5–8 = 1.–4. Klasse)
    for (const [s, code] of pkg.skill_nodes!.filter(([id]) => skills.some((x) => x.id === id))) {
      const k = Number(code.split("-")[2]);
      const skill = skills.find((x) => x.id === s)!;
      assert.ok(k + 4 >= skill.gradeMin && k + 4 <= skill.gradeMax, `${s} (${skill.gradeMin}–${skill.gradeMax}) → ${code}`);
    }
  }
});

test("maths topics: the KI gets the typical errors of the chosen skills, the app without KI explains with an example", async () => {
  const { buildPrompt } = await import("./ai/features");
  const { generateBuiltIn } = await import("./generators");
  const { TYPISCHE_FEHLER } = await import("./mathe-themen");
  const prompt = buildPrompt({
    subject: "Mathematik",
    level: "4. Klasse Mittelschule",
    skills: [
      { id: "mathe.pythagoras.seite", name: "Satz des Pythagoras: fehlende Seite berechnen", area: "Satz des Pythagoras", difficulty: "mittel" },
      { id: "mathe.brueche.addieren.hauptnenner", name: "Gemeinsamen Nenner finden", area: "Bruchrechnung", parentName: "Addieren", difficulty: "leicht" },
    ],
    count: 3,
    categories: [],
  });
  assert.match(prompt, /Typische Fehler bei diesen Fähigkeiten/);
  for (const f of TYPISCHE_FEHLER["mathe.pythagoras.seite"]) assert.ok(prompt.includes(f), f);
  assert.ok(prompt.includes(TYPISCHE_FEHLER["mathe.brueche.addieren"][0]), "a Teilfähigkeit brings its skill's errors");
  const deutsch = buildPrompt({ subject: "Deutsch", level: "2. Klasse", skills: [{ id: "deutsch.beistrich.nebensatz", name: "Haupt- und Nebensatz", area: "Beistrichsetzung", difficulty: "mittel" }], count: 2, categories: [] });
  assert.doesNotMatch(deutsch, /Typische Fehler bei diesen/, "nothing to add where there is no list");

  // without KI: a skill without a generator gets an „Erkläre …“ task whose sample answer is the explanation
  const [task] = generateBuiltIn({ subject: "Mathematik", skills: [{ id: "mathe.terme.herausheben", name: "Herausheben" }], difficulty: "mittel", count: 1, taskType: "free", seed: 3 });
  assert.equal(task.type, "free");
  assert.match(String((task.answer as { sample?: string }).sample), /6x \+ 9 = 3 · \(2x \+ 3\)/);
});
