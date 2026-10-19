import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const modul = async (file: string, name: string) => {
  const { faehigkeitenAus } = await import("./themen/bauen");
  return faehigkeitenAus((await import(`./themen/${file}`))[name]);
};
const mathe = () => modul("mathe-unterstufe", "MATHE_UNTERSTUFE");
const top = async () => (await mathe()).filter((s) => !s.parentId);

test("topics of all modules: every skill has an explanation and typical errors, fits its Schulstufen, no duplicates", async () => {
  const { MODULE, THEMEN, ERKLAERUNG, TYPISCHE_FEHLER, typischeFehler } = await import("./themen");
  const { faehigkeitenAus } = await import("./themen/bauen");
  const { CURRICULUM } = await import("./curriculum");
  const { EXPLAIN } = await import("./generators");
  const { SCHOOL_TYPES } = await import("./school");
  const imp = await import("./curriculum-import");

  // Mathematik, Deutsch and Englisch, each from the Volksschule to the Oberstufe
  assert.deepEqual([...new Set(MODULE.map((m) => m.fach))], ["Mathematik", "Deutsch", "Englisch"]);
  for (const fach of ["Mathematik", "Deutsch", "Englisch"]) {
    const stufen = new Set(THEMEN.filter((s) => s.subject === fach).flatMap((s) => Array.from({ length: s.gradeMax - s.gradeMin + 1 }, (_, i) => s.gradeMin + i)));
    for (let st = 1; st <= 13; st++) assert.ok(stufen.has(st), `${fach}: Schulstufe ${st}`);
  }
  assert.ok(THEMEN.length >= 500, `${THEMEN.length} skills`);

  assert.equal(new Set(CURRICULUM.map((s) => s.id)).size, CURRICULUM.length, "ids are unique");
  const names = CURRICULUM.filter((s) => !s.parentId).map((s) => `${s.subject} › ${s.name}`.toLowerCase());
  assert.equal(new Set(names).size, names.length, "no skill name twice in a subject");
  // new skills sit at the end in the order of the modules, so the seed numbers the old ones as before
  assert.deepEqual(CURRICULUM.slice(-THEMEN.length), THEMEN);
  assert.deepEqual(THEMEN.slice(0, (await mathe()).length), await mathe(), "the maths Unterstufe (PR #76) stays first");
  assert.deepEqual(THEMEN, MODULE.flatMap(faehigkeitenAus));

  const types = SCHOOL_TYPES.map((t) => t.name);
  for (const s of THEMEN) {
    assert.ok(s.gradeMin >= 1 && s.gradeMax <= 13 && s.gradeMin <= s.gradeMax, `${s.id}: Schulstufe ${s.gradeMin}–${s.gradeMax}`);
    // namespaces: .vs. only in the Volksschule, .os. from the end of the Unterstufe on
    if (s.id.includes(".vs.")) assert.ok(s.gradeMax <= 5 && s.schoolTypes?.join() === "Volksschule", `${s.id}: Volksschule`);
    else if (s.id.includes(".os.")) assert.ok(s.gradeMin >= 8 && s.gradeMax >= 9, `${s.id}: Oberstufe`);
    else assert.ok(s.gradeMax <= 10, `${s.id}: up to the Unterstufe`);
    for (const t of s.schoolTypes ?? []) assert.ok(types.includes(t), `${s.id}: school type ${t}`);
    assert.ok(ERKLAERUNG[s.id]?.length > 40 && EXPLAIN[s.id] === ERKLAERUNG[s.id], `${s.id}: explanation, also as sample answer`);
    if (!s.parentId) assert.ok(TYPISCHE_FEHLER[s.id]?.length >= 3 && TYPISCHE_FEHLER[s.id].length <= 4, `${s.id}: typical errors`);
  }

  // the skills that were there before have them too: the app's own and the Volksschule package
  const vs = imp.readBundled("volksschule-eigene-struktur.json")!.skills!;
  for (const s of [...CURRICULUM.filter((x) => !x.parentId), ...vs]) {
    assert.ok(typischeFehler(s.id).length >= 3, `${s.id}: typical errors`);
    assert.ok(EXPLAIN[s.id]?.length > 40, `${s.id}: explanation`);
  }
  // a Teilfähigkeit gets its skill's errors; „Bisher“ lists only name skills that exist
  assert.deepEqual(typischeFehler("mathe.brueche.dividieren.kehrwert"), TYPISCHE_FEHLER["mathe.brueche.dividieren"]);
  assert.deepEqual(typischeFehler("mathe.gleichungssysteme.rechnerisch.einsetzen"), TYPISCHE_FEHLER["mathe.gleichungssysteme.rechnerisch"]);
  assert.deepEqual(typischeFehler("deutsch.eigene.fahigkeit"), []);
  const known = new Set([...CURRICULUM.map((s) => s.id), ...vs.map((s) => s.id)]);
  for (const m of MODULE) for (const id of [...Object.keys(m.fehlerBisher ?? {}), ...Object.keys(m.erklaerungBisher ?? {})]) assert.ok(known.has(id), `${m.fach}: ${id}`);

  // plain copy rules: no dash between words, no placeholder, short enough for the skill page
  for (const text of [...Object.values(ERKLAERUNG), ...Object.values(TYPISCHE_FEHLER).flat()] as string[]) {
    assert.ok(!text.includes("—") && !text.includes(" – ") && !/TODO|XXX/.test(text), text);
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

  const kid = { school_type: "Mittelschule", klasse: 1, grade: 5 };
  const first = (topic: string) => matchSkills(topic, "Mathematik", { student: { school_type: "Mittelschule", klasse: 4, grade: 8 } })[0]?.skill.id;
  assert.equal(first("Binomische Formeln"), "mathe.terme.binomisch");
  assert.equal(first("Flächeninhalt Dreieck"), "mathe.flaechen.dreieck");
  assert.equal(first("Lineare Funktionen"), "mathe.funktionen.linear", "no longer „Einfache lineare Gleichungen“");
  assert.equal(first("Schlussrechnung"), "mathe.proportional.direkt");
  assert.equal(first("Herausheben"), "mathe.terme.herausheben");
  assert.ok(matchSkills("Pythagoras", "Mathematik").length >= 4);
  assert.ok(matchSkills("Pythagoras", "Mathematik").every((m) => m.skill.id.startsWith("mathe.pythagoras.") || m.skill.area === "Satz des Pythagoras"));
  assert.deepEqual(matchSkills("Photosynthese", "Mathematik"), []);
  // the student's level still counts: a 1. Klasse gets no Pythagoras
  assert.deepEqual(matchSkills("Pythagoras", "Mathematik", { student: kid }), []);
  assert.equal(matchSkills("Maßstab", "Mathematik", { student: kid })[0]?.skill.id, "mathe.masse.massstab");
});

test("topics: the search finds them in every subject, at the student's level and school type", async () => {
  const { matchSkills } = await import("./lehrplan");
  const ahs7 = { school_type: "Gymnasium", klasse: 7, grade: 11 };
  const hak3 = { school_type: "HAK", klasse: 3, grade: 11 };
  const ms3 = { school_type: "Mittelschule", klasse: 3, grade: 7 };
  for (const [topic, subject, student, id] of [
    ["Kurvendiskussion", "Mathematik", ahs7, "mathe.os.diff.kurvendiskussion"],
    ["Binomialverteilung", "Mathematik", ahs7, "mathe.os.wahrscheinlichkeit.binomial"],
    ["Zinseszins", "Mathematik", hak3, "mathe.os.finanz.zinseszins"],
    ["Erörterung", "Deutsch", ahs7, "deutsch.os.matura.eroerterung"],
    ["Textinterpretation", "Deutsch", ahs7, "deutsch.os.matura.textinterpretation"],
    ["Romantik", "Deutsch", ahs7, "deutsch.os.epochen.romantik"],
    ["das dass", "Deutsch", ms3, "deutsch.recht.dasdass"],
    ["if-clauses", "Englisch", ms3, "englisch.grammar.if1"],
    ["Present Perfect", "Englisch", ms3, "englisch.tenses.presentperfect"],
    ["Letter of application", "Englisch", hak3, "englisch.os.writing.application"],
  ] as const) assert.equal(matchSkills(topic, subject, { student })[0]?.skill.id, id, topic);
  // not above the student's level, not from another school type
  assert.deepEqual(matchSkills("Kurvendiskussion", "Mathematik", { student: ms3 }), []);
  assert.deepEqual(matchSkills("Finanzmathematik", "Mathematik", { student: ahs7 }), [], "Finanzmathematik is HAK");
  assert.ok(matchSkills("Finanzmathematik", "Mathematik", { student: hak3 }).length >= 3);
});

test("topics: seeded with school types and prerequisites, browsable per school type and class, linked to the Lehrplan", async () => {
  const { db } = await import("./db");
  const repo = await import("./repo");
  const { browseSkills } = await import("./lehrplan");
  const { schoolBranch } = await import("./school");
  const { CURRICULUM, PREREQUISITES } = await import("./curriculum");
  const { THEMEN } = await import("./themen");
  const imp = await import("./curriculum-import");

  // seeded behind the skills that were there before, with their school types and prerequisites
  const sort = (id: string) => (db().prepare("SELECT sort FROM skills WHERE id = ?").get(id) as { sort: number }).sort;
  const old = CURRICULUM.slice(0, -THEMEN.length);
  assert.ok(Math.min(...THEMEN.map((s) => sort(s.id))) > Math.max(...old.map((s) => sort(s.id))));
  assert.equal(repo.getSkill("mathe.os.finanz.zinseszins")?.school_types, "HAK");
  assert.equal(repo.getSkill("mathe.vs.zahlen.zerlegen")?.school_types, "Volksschule");
  assert.equal(repo.getSkill("deutsch.os.matura.eroerterung")?.school_types, "");
  assert.ok(repo.getSkill("mathe.gleichungssysteme.rechnerisch.einsetzen")?.parent_id === "mathe.gleichungssysteme.rechnerisch");
  const link = db().prepare("SELECT 1 FROM skill_links WHERE skill_id = ? AND other_id = ? AND kind = 'voraussetzung'");
  const ids = new Set(CURRICULUM.map((s) => s.id));
  // prerequisites on the Volksschule package are linked once it is imported
  for (const [skill, before] of PREREQUISITES) if (ids.has(skill) && ids.has(before)) assert.ok(link.get(skill, before), `${skill} ← ${before}`);
  // no circle: following „before“ never comes back to the start
  const before = new Map<string, string[]>();
  for (const [s, b] of PREREQUISITES) before.set(s, [...(before.get(s) ?? []), b]);
  const reaches = (from: string, to: string, seen = new Set<string>()): boolean =>
    (before.get(from) ?? []).some((b) => b === to || (!seen.has(b) && (seen.add(b), reaches(b, to, seen))));
  for (const [s] of PREREQUISITES) assert.ok(!reaches(s, s), `circle at ${s}`);

  // Fähigkeiten › Fach › Schulart › Klasse
  const areas = (subject: string, branch: string, klasse: number) => new Set(browseSkills({ subject, branch: schoolBranch(branch)!, klasse }).map((s) => s.area));
  for (const area of ["Natürliche Zahlen", "Dezimalzahlen", "Größen und Maße", "Flächeninhalt und Umfang", "Körper", "Statistik"]) assert.ok(areas("Mathematik", "mittelschule", 1).has(area), `MS 1. Klasse: ${area}`);
  for (const area of ["Satz des Pythagoras", "Funktionen", "Gleichungssysteme", "Wurzeln"]) assert.ok(areas("Mathematik", "mittelschule", 4).has(area) && !areas("Mathematik", "mittelschule", 1).has(area), `MS 4. Klasse: ${area}`);
  assert.ok(areas("Mathematik", "volksschule", 2).has("Zahlen und Zahlenraum"));
  assert.ok(!areas("Mathematik", "volksschule", 2).has("Differentialrechnung"));
  const ahs7 = areas("Mathematik", "ahs-oberstufe", 7);
  for (const area of ["Differentialrechnung", "Integralrechnung", "Vektoren", "Wahrscheinlichkeit"]) assert.ok(ahs7.has(area), `AHS 7. Klasse: ${area}`);
  for (const area of ["Finanzmathematik", "Matrizen", "Bruchrechnung"]) assert.ok(!ahs7.has(area), `not AHS 7. Klasse: ${area}`);
  const hak3 = areas("Mathematik", "hak", 3);
  for (const area of ["Finanzmathematik", "Matrizen", "Differentialrechnung"]) assert.ok(hak3.has(area), `HAK III: ${area}`);
  assert.ok(!hak3.has("Vektoren"), "HAK has no vectors");
  for (const area of ["Literaturepochen", "Matura-Textsorten"]) assert.ok(areas("Deutsch", "ahs-oberstufe", 6).has(area) && !areas("Deutsch", "volksschule", 3).has(area), area);
  assert.ok(areas("Englisch", "htl", 4).has("Technical English") && !areas("Englisch", "ahs-oberstufe", 7).has("Technical English"));
  assert.ok(areas("Englisch", "volksschule", 3).size >= 3);

  // linked to the Lehrplan: every link points to an entry that exists, within the skill's classes and school types
  const OFFSET: Record<string, [number, string]> = { vs: [0, "Volksschule"], ms: [4, "Mittelschule"], ahs: [4, "Gymnasium"], htl: [8, "HTL"], hak: [8, "HAK"] };
  const linked = new Map<string, string[]>();
  const themen = new Map(THEMEN.map((s) => [s.id, s]));
  for (const [st, [offset, type]] of Object.entries(OFFSET)) {
    for (const fach of ["mathematik", "deutsch", "englisch"]) {
      const file = `ris-${st}-${fach}.json`;
      const pkg = imp.readBundled(file)!;
      const codes = new Set(pkg.nodes!.map((n) => n.code));
      for (const [id, code] of pkg.skill_nodes!) {
        assert.ok(codes.has(code), `${file}: ${id} → ${code}`);
        const s = themen.get(id);
        if (!s) continue;
        linked.set(id, [...(linked.get(id) ?? []), file]);
        const stufe = offset + Number(code.split("-")[2]);
        assert.ok(stufe >= s.gradeMin && stufe <= s.gradeMax, `${id} (${s.gradeMin}–${s.gradeMax}) → ${code}`);
        assert.ok(!s.schoolTypes || s.schoolTypes.includes(type), `${id} (${s.schoolTypes}) → ${code}`);
      }
    }
  }
  // Mathematik and Deutsch: every skill; Englisch: the Lehrpläne name no grammar, so some stay unlinked
  const unlinked = THEMEN.filter((s) => !s.parentId && !linked.has(s.id));
  assert.deepEqual(unlinked.filter((s) => s.subject !== "Englisch").map((s) => s.id), []);
  assert.ok(unlinked.length <= 20, `${unlinked.length} without a link`);
  // the maths Unterstufe is linked in both Lehrpläne of the 5. to 8. Schulstufe
  for (const s of await top()) for (const file of ["ris-ms-mathematik.json", "ris-ahs-mathematik.json"]) assert.ok(linked.get(s.id)?.includes(file), `${file}: ${s.id}`);
});

test("topics: a KI request lists only the skills around the student's Schulstufe", async () => {
  const { skillsForPrompt, PROMPT_STUFEN_FRUEHER } = await import("./lehrplan");
  const ahs7 = skillsForPrompt({ school_type: "Gymnasium", klasse: 7, grade: 11 }, "Mathematik");
  assert.ok(ahs7.length > 50);
  assert.ok(ahs7.every((s) => s.grade_min <= 11 && s.grade_max >= 11 - PROMPT_STUFEN_FRUEHER), "no Volksschule, nothing above the 7. Klasse");
  assert.ok(ahs7.every((s) => !s.school_types || s.school_types.split(",").includes("Gymnasium")), "no HAK-only Finanzmathematik");
  assert.ok(ahs7.some((s) => s.id === "mathe.os.diff.kurvendiskussion"));
  const vs3 = skillsForPrompt({ school_type: "Volksschule", klasse: 3, grade: 3 }, "Mathematik");
  assert.ok(vs3.length > 5 && vs3.every((s) => s.grade_min <= 3));
  // an unclear level narrows nothing down
  const all = skillsForPrompt({ school_type: "", klasse: null, grade: 0 }, "Mathematik");
  assert.ok(all.length > ahs7.length + vs3.length);
});

test("topics: the KI gets the typical errors of the chosen skills, the app without KI explains with an example", async () => {
  const { buildPrompt } = await import("./ai/features");
  const { generateBuiltIn } = await import("./generators");
  const { TYPISCHE_FEHLER, ERKLAERUNG } = await import("./themen");
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
  // Deutsch and Englisch now have them too, from the Volksschule to the Oberstufe
  const deutsch = buildPrompt({ subject: "Deutsch", level: "2. Klasse", skills: [{ id: "deutsch.beistrich.nebensatz", name: "Haupt- und Nebensatz", area: "Beistrichsetzung", difficulty: "mittel" }], count: 2, categories: [] });
  for (const f of TYPISCHE_FEHLER["deutsch.beistrich.nebensatz"]) assert.ok(deutsch.includes(f), f);
  const own = buildPrompt({ subject: "Englisch", level: "6. Klasse", skills: [{ id: "englisch.eigene.fahigkeit", name: "Eigene Fähigkeit", area: "Eigenes", difficulty: "mittel" }], count: 2, categories: [] });
  assert.doesNotMatch(own, /Typische Fehler bei diesen/, "nothing to add where there is no list");

  // without KI: a skill without a generator gets an „Erkläre …“ task whose sample answer is the explanation
  const [task] = generateBuiltIn({ subject: "Mathematik", skills: [{ id: "mathe.terme.herausheben", name: "Herausheben" }], difficulty: "mittel", count: 1, taskType: "free", seed: 3 });
  assert.equal(task.type, "free");
  assert.match(String((task.answer as { sample?: string }).sample), /6x \+ 9 = 3 · \(2x \+ 3\)/);
  const os = Object.keys(ERKLAERUNG).find((id) => id.startsWith("deutsch.os."))!;
  const [d] = generateBuiltIn({ subject: "Deutsch", skills: [{ id: os, name: "Oberstufe" }], difficulty: "mittel", count: 1, taskType: "free", seed: 3 });
  assert.equal((d.answer as { sample?: string }).sample, ERKLAERUNG[os]);
});
