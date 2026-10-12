/**
 * Prüft die Generatoren der sechs Deutsch-Fähigkeiten aus Phase 1 des Merges gegen ihre Banken unter
 * `data/banks/` (gleiches Muster wie lib/core.test.ts: jede Aufgabe muss ihre eigene Lösung annehmen
 * und eine falsche Option ablehnen) sowie die Genus-Färbung aus Entscheidung D10.
 *
 * Jede Fähigkeit wird mit festem Startwert viele Male erzeugt; so fallen auch seltene Bankeinträge auf.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CURRICULUM, mixFor } from "./curriculum";
import { generateBuiltIn, hasBuiltInGenerator } from "./generators";
import { checkAnswer, gapCount, GAP, type TaskDraft } from "./tasks";
import { asGenus, genderTone, genusBadge, GENUS_LABEL } from "../components/genus";

const SUBJECT = "Deutsch";
const SEED = 20261012;
const COUNT = 60;

/** Die sechs neuen Fähigkeiten mit ihrer erwarteten Teilfähigkeit (`parentId`, null = eigene Fähigkeit). */
const SKILLS: [string, string | null][] = [
  ["deutsch.grammatik.artikel", null],
  ["deutsch.grammatik.adjektivdeklination", null],
  ["deutsch.grammatik.praepositionen", "deutsch.grammatik.faelle"],
  ["deutsch.grammatik.praeteritum", "deutsch.grammatik.zeiten"],
  ["deutsch.grammatik.perfekt", "deutsch.grammatik.zeiten"],
  ["deutsch.satz.hauptsatz-gliedsatz", null],
];

const GENUS_OF_ARTICLE: Record<string, "m" | "f" | "n"> = { der: "m", die: "f", das: "n" };

function make(skillId: string, taskType: "mc" | "cloze" | "calc" | "mixed" = "mixed"): TaskDraft[] {
  const skill = CURRICULUM.find((s) => s.id === skillId)!;
  const tasks = generateBuiltIn({ subject: skill.subject, skills: [{ id: skill.id, name: skill.name }], difficulty: "mittel", count: COUNT, taskType, seed: SEED });
  assert.ok(tasks.length > 0, `${skillId}: kein Task erzeugt`);
  return tasks;
}

/** Antwort, mit der die Aufgabe nach dem Muster von core.test.ts richtig beantwortet wird. */
function solutionOf(t: TaskDraft): string {
  if (t.data.options && typeof t.answer.correct === "number") return String(t.answer.correct);
  if (t.answer.blanks) return JSON.stringify(t.answer.blanks.map((b) => b[0]));
  return t.answer.accepted?.[0] ?? "";
}

test("die sechs Fähigkeiten sind im Lehrplan angelegt, erreichbar und ohne Elternteil-Kollision", () => {
  const ids = CURRICULUM.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "keine doppelte Fähigkeits-Kennung");
  for (const [id, parentId] of SKILLS) {
    const skill = CURRICULUM.find((s) => s.id === id);
    assert.ok(skill, `${id} fehlt in CURRICULUM`);
    assert.equal(skill.subject, SUBJECT);
    assert.equal(skill.parentId ?? null, parentId, `${id}: Teilfähigkeit-Verknüpfung`);
    assert.ok(skill.gradeMin >= 1 && skill.gradeMax <= 13 && skill.gradeMin <= skill.gradeMax, `${id}: Schulstufen`);
    assert.equal(hasBuiltInGenerator(id), true, `${id}: kein Generator`);
    assert.ok(mixFor(SUBJECT, id).length > 0, `${id}: keine Kategorien für „Gemischte Aufgaben“`);
  }
  // die Teilfähigkeiten hängen an vorhandenen Fähigkeiten
  for (const [, parentId] of SKILLS) if (parentId) assert.ok(ids.includes(parentId), `Elternfähigkeit ${parentId} fehlt`);
  // „Zeitformen“ bleibt unberührt und behält seinen eigenen Generator
  assert.ok(CURRICULUM.some((s) => s.id === "deutsch.grammatik.zeiten"), "deutsch.grammatik.zeiten fehlt");
  assert.equal(hasBuiltInGenerator("deutsch.grammatik.zeiten"), true);
});

test("jede neue Aufgabe nimmt ihre Lösung an und lehnt eine falsche Option ab", () => {
  for (const [skillId] of SKILLS) {
    for (const taskType of ["mc", "cloze", "calc", "mixed"] as const) {
      const tasks = make(skillId, taskType);
      for (const t of tasks) {
        const right = solutionOf(t);
        assert.equal(checkAnswer(t, right).correct, true, `${skillId} (${taskType}): „${t.prompt}“ lehnt die eigene Lösung ab`);
        // die typischen Fehler der Bank werden abgelehnt (bei mehreren Lücken prüft core.test.ts sie nicht)
        for (const e of t.errorMap) {
          if (t.answer.blanks && t.answer.blanks.length > 1) continue;
          const wrong = t.answer.blanks ? JSON.stringify([e.answer]) : e.answer;
          const r = checkAnswer(t, wrong);
          assert.equal(r.correct, false, `${skillId}: typischer Fehler „${e.answer}“ gilt als richtig für „${t.prompt}“`);
          assert.equal(r.errorLabel, e.label);
        }
        // eine frei erfundene falsche Antwort wird in jedem Format abgelehnt
        const bogus = t.answer.blanks ? JSON.stringify(t.answer.blanks.map((_, i) => (i === 0 ? "###" : t.answer.blanks![i][0]))) : "###";
        assert.equal(checkAnswer(t, bogus).correct, false, `${skillId}: „###“ gilt als richtig für „${t.prompt}“`);
      }
    }
  }
});

test("Artikel: mc mit der/die/das, gültigem Genus und der Lösung unter den Optionen", () => {
  for (const t of make("deutsch.grammatik.artikel")) {
    assert.equal(t.type, "mc");
    assert.deepEqual([...t.data.options!].sort(), ["das", "der", "die"], "die drei Artikel stehen zur Auswahl");
    assert.equal(gapCount(t.prompt), 0, "keine Lücke in einer Auswahlaufgabe");
    const correct = t.answer.correct!;
    assert.ok(correct >= 0 && correct < t.data.options!.length, "die richtige Option liegt im Bereich");
    const article = t.data.options![correct];
    assert.ok(["der", "die", "das"].includes(article), `„${article}“ ist kein Artikel`);
    assert.ok(asGenus(t.data.genus), `data.genus „${t.data.genus}“ ist kein m/f/n`);
    assert.equal(t.data.genus, GENUS_OF_ARTICLE[article], "data.genus passt nicht zur Lösung");
    // jede falsche Option hat einen eigenen Fehlertext mit dem Genus
    const falsch = t.errorMap.map((e) => e.answer);
    assert.equal(new Set(falsch).size, falsch.length, "Fehlertexte doppelt");
    for (const e of t.errorMap) assert.match(e.label, /Genus verwechselt \(/);
  }
});

test("Adjektivdeklination: cloze mit genau zwei Lücken (Adjektivendung, Nomenendung)", () => {
  for (const t of make("deutsch.grammatik.adjektivdeklination")) {
    assert.equal(t.type, "cloze");
    assert.equal(gapCount(t.prompt), 2, `„${t.prompt}“ hat nicht zwei Lücken`);
    assert.equal(t.answer.blanks!.length, 2, "zwei Lösungen für zwei Lücken");
    assert.equal(t.answer.mode, "exact", "exakt geprüft (Groß-/Kleinschreibung zählt)");
    for (const blank of t.answer.blanks!) assert.ok(blank[0].length > 0, "leere Lücke");
  }
});

test("Präpositionen: cloze mit genau einer Lücke und Kasus-Fehlertext", () => {
  for (const t of make("deutsch.grammatik.praepositionen")) {
    assert.equal(t.type, "cloze");
    assert.equal(gapCount(t.prompt), 1, `„${t.prompt}“ hat nicht genau eine Lücke`);
    assert.equal(t.answer.blanks!.length, 1);
    assert.equal(t.errorMap.length >= 1, true, "kein typischer Fehler");
    for (const e of t.errorMap) assert.match(e.label, /(Dativ statt Akkusativ|Akkusativ statt Dativ|Falscher Fall nach der Präposition)/);
  }
});

test("Hauptsatz und Gliedsatz: mc aus den beiden Satzteilen, genau eine richtige Option", () => {
  for (const t of make("deutsch.satz.hauptsatz-gliedsatz")) {
    assert.equal(t.type, "mc");
    assert.equal(t.data.options!.length, 2, "die beiden Satzteile stehen zur Auswahl");
    assert.equal(new Set(t.data.options!).size, 2, "die Satzteile sind verschieden");
    const correct = t.answer.correct!;
    assert.ok(correct >= 0 && correct < 2, "genau eine richtige Option");
    assert.equal(t.errorMap.filter((e) => e.answer === String(correct)).length, 0, "die richtige Option ist kein Fehler");
    assert.equal(t.errorMap.length, 1, "genau eine falsche Option");
    assert.match(t.errorMap[0].label, /Hauptsatz statt Gliedsatz/);
    // der Gliedsatz kann nicht allein stehen: die Lösung nennt ihn ausdrücklich
    assert.match(t.solution, /Gliedsatz ist „/);
  }
});

test("Präteritum und Perfekt liefern aus der Bank weiter Lückentexte", () => {
  for (const skillId of ["deutsch.grammatik.praeteritum", "deutsch.grammatik.perfekt"]) {
    for (const t of make(skillId)) {
      assert.equal(t.type, "cloze", `${skillId}: kein Lückentext`);
      assert.equal(gapCount(t.prompt), t.answer.blanks!.length, `${skillId}: Lücken und Lösungen passen nicht`);
      assert.ok(t.answer.blanks!.length >= 1 && t.answer.blanks!.length <= 2, `${skillId}: unerwartete Lückenzahl`);
      assert.ok(t.solution.length > 0 && t.hints.length > 0, `${skillId}: Lösung oder Hilfe fehlt`);
    }
  }
});

test("die sechs Fähigkeiten erscheinen im Übungs-Builder (Fähigkeitsliste der Datenbank)", async () => {
  process.env.DATABASE_PATH = ":memory:";
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const { browseSkills } = await import("./lehrplan");
  const alle = new Set(repo.listSkills().map((s) => s.id));
  const deutsch = new Set(browseSkills({ subject: "Deutsch" }).map((s) => s.id));
  for (const [id] of SKILLS) {
    assert.ok(alle.has(id), `${id} fehlt nach dem Seed in der Fähigkeitsliste`);
    assert.ok(deutsch.has(id), `${id} fehlt im Deutsch-Zweig des Builders`);
  }
});

test("skill_curriculum: die neuen Fähigkeiten kommen über die RIS-Pakete an die Lehrplan-Knoten", async () => {
  process.env.DATABASE_PATH = ":memory:";
  const { resetForTests, db } = await import("./db");
  resetForTests();
  const imp = await import("./curriculum-import");
  // MS und AHS tragen die neuen Verknüpfungen; importiert wird hier das Mittelschule-Paket.
  const pkg = imp.readBundled("ris-ms-deutsch.json")!;
  const p = imp.preview(pkg, null);
  assert.deepEqual(p.diff.errors, []);
  assert.equal(imp.applyImport(p.id!).ok, true);
  const linked = db()
    .prepare("SELECT sc.skill_id AS skill FROM skill_curriculum sc JOIN curriculum_nodes n ON n.id = sc.node_id WHERE n.code = 'MS-DEU-1-B1-A1-A2'")
    .all() as { skill: string }[];
  const ids = new Set(linked.map((r) => r.skill));
  for (const id of ["deutsch.grammatik.praeteritum", "deutsch.grammatik.perfekt", "deutsch.grammatik.praepositionen", "deutsch.satz.hauptsatz-gliedsatz"])
    assert.ok(ids.has(id), `${id} ist nicht mit MS-DEU-1-B1-A1-A2 verknüpft`);
  // die älteren Fähigkeiten bleiben unberührt
  assert.ok(ids.has("deutsch.grammatik.zeiten"), "deutsch.grammatik.zeiten hat die Verknüpfung verloren");
  assert.ok(ids.has("deutsch.grammatik.faelle"), "deutsch.grammatik.faelle hat die Verknüpfung verloren");
});

test("genderTone: m = flieder, f = pfirsich, n = mint, Unbekanntes fällt neutral zurück", () => {
  assert.equal(genderTone("m").bg, "var(--tile-lilac)");
  assert.equal(genderTone("f").bg, "var(--tile-peach)");
  assert.equal(genderTone("n").bg, "var(--tile-mint)");
  // die Artikelform ist erlaubt und ergibt denselben Ton
  assert.deepEqual(genderTone("der"), genderTone("m"));
  assert.deepEqual(genderTone("die"), genderTone("f"));
  assert.deepEqual(genderTone("das"), genderTone("n"));
  // unbekannt oder leer: kein Fehler, keine Aussage, ein neutraler Ton
  for (const value of [undefined, null, "", "   ", "x", "rot", "plural", 7, {}]) {
    const tone = genderTone(value);
    assert.ok(tone.bg && tone.fg && tone.soft, `${String(value)}: kein Ton`);
    assert.equal(tone.bg, "var(--line)", `${String(value)}: unerwarteter Rückfall`);
    assert.equal(asGenus(value), null);
  }
  // nie rot: weder die drei Genus-Töne noch der Rückfall nennen --red oder eine rote Schriftfarbe
  for (const value of ["m", "f", "n", "x", undefined]) {
    const tone = genderTone(value);
    for (const v of [tone.bg, tone.fg, tone.soft]) assert.doesNotMatch(v, /red/i, `${String(value)}: Rot ist Fehlern vorbehalten`);
  }
  // Buchstabe und Wort für die Anzeige
  for (const g of ["m", "f", "n"] as const) {
    const badge = genusBadge(g)!;
    assert.equal(badge.letter, g);
    assert.equal(badge.label, GENUS_LABEL[g]);
  }
  assert.equal(genusBadge("x"), null);
  assert.equal(gapCount(`a ${GAP} b`), 1);
});
