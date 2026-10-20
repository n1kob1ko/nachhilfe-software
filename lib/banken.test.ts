/**
 * Die fachliche Prüfung der Aufgabenbanken (`data/banks/`): jeder Eintrag jeder Bank, nicht nur
 * Stichproben. Die Regeln stehen in lib/banken-regeln.ts, ihre Begründung in docs/banks-pruefung.md.
 *
 * Die Regel des Projekts: eine richtige Antwort darf nie als falsch gelten. Darum prüft dieser Test
 *   - jeden Eintrag mit `eintragFehler` (Sätze, in denen zwei Lösungen passen, richtige Formen unter
 *     den Fehlern, Wörter mit zwei Artikeln oder zwei Bedeutungen …),
 *   - jede Aufgabe, die aus einem Eintrag entsteht: sie nimmt jede richtige Schreibweise an und lehnt
 *     jeden typischen Fehler ab,
 *   - jeden Satz von „Fehler korrigieren“: sauberer Text, und die verbesserte Fassung gilt als richtig,
 *   - die Schwierigkeit: eine leichte Aufgabe kommt aus den leichten Einträgen,
 *   - den KI-Weg: ein Eintrag, den die Regeln beanstanden, wird keine Aufgabe.
 * Ohne KI-Aufruf: der KI-Weg wird nur mit fertigen Einträgen geprüft.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { BANK_SKILL, parseAiBankItem } from "./ai/banken";
import { bankStufe, eintragFehler, endungImSatz, type Stufe } from "./banken-regeln";
import { BANK_IDS, bankItems, type AdjektivdeklinationItem, type ArtikelItem, type BankId, type ClozeItem, type PraepositionenItem } from "./banks";
import type { Difficulty } from "./curriculum";
import { bankItemTask, clozeTask, correctionTask, fixItems, generateBuiltIn, nachStufe } from "./generators";
import { checkAnswer, endingOf, gapCount, GAP } from "./tasks";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_PROVIDER"]) delete process.env[k];

const DIFFICULTIES: Difficulty[] = ["sehr leicht", "leicht", "leicht bis mittel", "mittel", "schwer", "sehr schwer"];
/** Immer derselbe Zufall: die Optionen stehen bei jedem Lauf gleich. */
const fest = () => 0.5;
/** Die ersten Beanstandungen, lesbar für die Meldung des Tests. */
const zeige = (liste: string[]) => `${liste.length} beanstandet:\n${liste.slice(0, 25).join("\n")}${liste.length > 25 ? "\n…" : ""}`;

test("jeder Eintrag jeder Bank besteht die fachliche Prüfung", () => {
  for (const id of BANK_IDS) {
    const items = bankItems(id);
    assert.ok(items.length > 0, `${id}: Bank leer`);
    const fehler = items.flatMap((item, i) => eintragFehler(id, item as never).map((f) => `${id} #${i + 1}: ${f}`));
    assert.deepEqual(fehler, [], zeige(fehler));
  }
});

test("Artikel: jede Aufgabe nimmt jeden richtigen Artikel an und nennt bei zwei Bedeutungen die gemeinte", () => {
  const falsch: string[] = [];
  for (const item of bankItems("artikel")) {
    const richtig = [item.article, ...(item.alsoArticle ?? [])];
    // Auswahl: nur Wörter mit genau einem richtigen Artikel
    if (!item.alsoArticle) {
      const t = bankItemTask("artikel", item, "mittel", fest)!;
      if (checkAnswer(t, String(t.answer.correct)).correct !== true) falsch.push(`${item.word}: die richtige Option gilt als falsch`);
      for (const e of t.errorMap) if (checkAnswer(t, e.answer).correct !== false) falsch.push(`${item.word}: „${t.data.options![Number(e.answer)]}“ gilt als richtig`);
      if (item.meaning && !t.prompt.includes(`„${item.word}“ (${item.meaning})`)) falsch.push(`${item.word}: die Bedeutung fehlt in „${t.prompt}“`);
      if (!item.meaning && /\(/.test(t.prompt)) falsch.push(`${item.word}: Klammer ohne Bedeutung in „${t.prompt}“`);
    }
    for (const a of ["der", "die", "das"]) {
      // der Lückentext prüft jeden Artikel: richtig genau dann, wenn er in der Bank als richtig steht
      const cloze = { type: "cloze" as const, data: {}, answer: { blanks: [richtig], mode: "exact" as const }, errorMap: [] };
      if (checkAnswer(cloze, JSON.stringify([a])).correct !== richtig.includes(a as ArtikelItem["article"])) falsch.push(`${item.word}: „${a}“ falsch bewertet`);
    }
  }
  assert.deepEqual(falsch, [], zeige(falsch));
});

test("Artikel: Wörter mit zwei richtigen Artikeln kommen nie als Auswahl, im Lückentext zählen beide", () => {
  const doppelt = new Set(bankItems("artikel").filter((i) => i.alsoArticle).map((i) => i.word));
  assert.ok(doppelt.size > 0, "die Bank hat Wörter mit zwei Artikeln (Keks, Joghurt …)");
  for (const diff of DIFFICULTIES) {
    for (const t of generateBuiltIn({ subject: "Deutsch", skills: [{ id: "deutsch.grammatik.artikel", name: "Artikel" }], difficulty: diff, count: 200, taskType: "mc", seed: 11 })) {
      const wort = /„([^“]+)“/.exec(t.prompt)![1];
      assert.ok(!doppelt.has(wort), `${diff}: „${wort}“ hat zwei richtige Artikel und darf keine Auswahl sein`);
    }
  }
  // der Lückentext der Artikel: jeder richtige Artikel ist angenommen, der typische Fehler nie richtig
  for (let i = 0; i < 300; i++) {
    const t = clozeTask("deutsch.grammatik.artikel", "mittel", seeded(i))!;
    const wort = t.prompt.replace(/^[^:]*: ___ /, "").replace(/ \(.*\)$/, "");
    const item = bankItems("artikel").find((x) => x.word === wort)!;
    for (const a of [item.article, ...(item.alsoArticle ?? [])]) assert.equal(checkAnswer(t, JSON.stringify([a])).correct, true, `${wort}: „${a}“ abgelehnt`);
    for (const e of t.errorMap) assert.equal(checkAnswer(t, JSON.stringify([e.answer])).correct, false, `${wort}: Fehler „${e.answer}“ gilt als richtig`);
  }
});

test("Adjektivdeklination: „en“ und „-en“ zählen gleich, keine Endung ist leer oder „-“", () => {
  const falsch: string[] = [];
  for (const item of bankItems("adjektivdeklination")) {
    const t = bankItemTask("adjektivdeklination", item, "mittel", fest)!;
    const kurz = item.solution;
    if (t.prompt.split("\n")[0].split(GAP).length !== 3) falsch.push(`${kurz}: nicht genau zwei Lücken in der ersten Zeile`);
    if (t.answer.endings !== true) falsch.push(`${kurz}: die Lücken sind nicht als Endungen markiert`);
    const zweite = [item.correct2, ...(item.alsoCorrect2 ?? [])];
    for (const e2 of zweite) {
      // jede Schreibweise der richtigen Endungen: mit Bindestrich, ohne, und für „-“ auch die leere Lücke
      const schreibweisen2 = e2 === "-" ? ["-", "", " "] : [e2, endingOf(e2)];
      for (const e1 of [item.correct1, endingOf(item.correct1)])
        for (const s2 of schreibweisen2) if (checkAnswer(t, JSON.stringify([e1, s2])).correct !== true) falsch.push(`${kurz}: „${e1}“ und „${s2}“ abgelehnt`);
    }
    for (const o of item.options1) if (o !== item.correct1 && checkAnswer(t, JSON.stringify([endingOf(o), item.correct2])).correct !== false) falsch.push(`${kurz}: falsche Adjektivendung „${o}“ gilt als richtig`);
    for (const o of item.options2) {
      if (zweite.includes(o)) continue;
      const r = checkAnswer(t, JSON.stringify([item.correct1, endingOf(o)]));
      if (r.correct !== false) falsch.push(`${kurz}: falsche Nomenendung „${o}“ gilt als richtig`);
      else if (!r.errorLabel) falsch.push(`${kurz}: „${o}“ ohne Fehlertext`);
    }
    // der Lösungssatz ist sauberer Text, ohne Bindestrich in den Wörtern
    if (/[a-zäöüß]-[a-zäöüß]| -[a-zäöüß]|[a-zäöüß]- /i.test(item.solution)) falsch.push(`${kurz}: Bindestrich im Lösungssatz`);
    const satz = `${item.prefix}${endungImSatz(item.correct1)}${item.middle}${endungImSatz(item.correct2)}${item.suffix}`;
    if (satz !== t.solution) falsch.push(`${kurz}: Lösung passt nicht zu den Teilen`);
  }
  assert.deepEqual(falsch, [], zeige(falsch));
  // die Gleichsetzung selbst
  assert.equal(endingOf("-en"), "en");
  assert.equal(endingOf("–en"), "en", "auch mit Halbgeviertstrich (Tablet-Tastatur)");
  assert.equal(endingOf("-"), "");
  assert.equal(endingOf("  "), "");
});

test("Präpositionen: nur der richtige Artikel gilt, jeder falsche hat einen Fehlertext nach seinem Fall", () => {
  const falsch: string[] = [];
  for (const item of bankItems("praepositionen")) {
    const t = bankItemTask("praepositionen", item, "mittel", fest)!;
    if (checkAnswer(t, JSON.stringify([item.correct])).correct !== true) falsch.push(`${item.solution}: Lösung abgelehnt`);
    for (const a of ["der", "die", "das", "den", "dem"]) {
      if (a === item.correct) continue;
      const r = checkAnswer(t, JSON.stringify([a]));
      if (r.correct !== false) falsch.push(`${item.solution}: „${a}“ gilt als richtig`);
      if (item.options.includes(a) && !r.errorLabel) falsch.push(`${item.solution}: „${a}“ ohne Fehlertext`);
    }
    const anderer = item.kasus === "Dativ" ? "Akkusativ statt Dativ" : "Dativ statt Akkusativ";
    if (t.errorMap[0]?.label !== anderer) falsch.push(`${item.solution}: der erste Fehler ist „${t.errorMap[0]?.label}“, nicht „${anderer}“`);
  }
  assert.deepEqual(falsch, [], zeige(falsch));
});

test("Präteritum, Perfekt, das/dass: jede richtige Form gilt, kein typischer Fehler gilt", () => {
  const falsch: string[] = [];
  for (const id of ["praeteritum", "perfekt", "das-dass"] as const) {
    for (const item of bankItems(id) as ClozeItem[]) {
      const t = bankItemTask(id, item as never, "mittel", fest)!;
      if (gapCount(t.prompt) !== item.blanks.length) falsch.push(`${item.q}: Lückenzahl`);
      // jede Kombination der richtigen Formen (meist nur eine)
      const kombis = item.blanks.reduce<string[][]>((acc, alts) => acc.flatMap((a) => alts.map((x) => [...a, x])), [[]]);
      for (const k of kombis) if (checkAnswer(t, JSON.stringify(k)).correct !== true) falsch.push(`${item.q}: ${k.join(" / ")} abgelehnt`);
      const richtig = new Set(item.blanks.flat().map((x) => (id === "das-dass" ? x.toLowerCase() : x)));
      for (const [antwort, label] of Object.entries(item.errors ?? {})) {
        if (richtig.has(id === "das-dass" ? antwort.toLowerCase() : antwort)) falsch.push(`${item.q}: „${antwort}“ ist richtig und zugleich Fehler`);
        // der Fehler in jeder Lücke, in der er nicht richtig ist, wird abgelehnt und benannt
        item.blanks.forEach((alts, i) => {
          if (alts.includes(antwort)) return;
          const given = item.blanks.map((b, j) => (j === i ? antwort : b[0]));
          const r = checkAnswer(t, JSON.stringify(given));
          if (r.correct !== false) falsch.push(`${item.q}: „${antwort}“ in Lücke ${i + 1} gilt als richtig`);
          else if (item.blanks.length === 1 && r.errorLabel !== label) falsch.push(`${item.q}: „${antwort}“ bekommt „${r.errorLabel}“ statt „${label}“`);
        });
      }
    }
  }
  assert.deepEqual(falsch, [], zeige(falsch));
});

test("Fehler korrigieren: jeder Satz ist sauberer Text, die verbesserte Fassung gilt als richtig", () => {
  const falsch: string[] = [];
  for (const [id, skill] of Object.entries(BANK_SKILL) as [BankId, string][]) {
    if (id === "hauptsatz-gliedsatz") continue; // keine Sätze zum Verbessern
    for (const diff of DIFFICULTIES) {
      for (const f of fixItems(skill, diff)) {
        for (const text of [f.wrong, f.right, ...(f.alsoRight ?? [])]) {
          if (text.includes(GAP)) falsch.push(`${skill}: Lücke im Text „${text}“`);
          if (/[a-zäöüß]-[a-zäöüß]| -[a-zäöüß]|[a-zäöüß]- /.test(text)) falsch.push(`${skill}: Bindestrich im Wort „${text}“`);
          if (/ {2,}|^\s|\s$/.test(text)) falsch.push(`${skill}: Leerzeichen in „${text}“`);
        }
        if (f.wrong === f.right || f.alsoRight?.includes(f.wrong)) falsch.push(`${skill}: „${f.wrong}“ ist gar kein Fehler`);
        // groß am Satzanfang, in der falschen wie in der richtigen Fassung (Artikel stehen als Liste, klein)
        if (id !== "artikel" && /^[a-zäöü]/.test(f.right) !== /^[a-zäöü]/.test(f.wrong)) falsch.push(`${skill}: Groß- und Kleinschreibung am Anfang verschieden: „${f.wrong}“ / „${f.right}“`);
      }
    }
    // die ganze Aufgabe: jede richtige Fassung gilt, der Fehlertext nicht
    for (let i = 0; i < 40; i++) {
      for (const diff of ["sehr leicht", "mittel", "sehr schwer"] as Difficulty[]) {
        const t = correctionTask(skill, diff, seeded(i));
        if (!t) continue;
        for (const a of t.answer.accepted!) if (checkAnswer(t, a).correct !== true) falsch.push(`${skill}: „${a}“ abgelehnt`);
        if (checkAnswer(t, t.data.faulty!).correct !== false) falsch.push(`${skill}: der Fehlertext gilt als richtig`);
      }
    }
  }
  assert.deepEqual(falsch, [], zeige(falsch));
  // Perfekt hat zwei Lücken je Satz und damit keine Sätze zum Verbessern; die übrigen Banken schon
  for (const skill of ["deutsch.grammatik.artikel", "deutsch.grammatik.adjektivdeklination", "deutsch.grammatik.praepositionen", "deutsch.grammatik.praeteritum", "deutsch.recht.dasdass"])
    assert.ok(fixItems(skill, "mittel").length >= 12, `${skill}: zu wenige Sätze`);
});

test("Schwierigkeit: die Aufgaben kommen aus den Einträgen der passenden Stufe", () => {
  /** Die Stufen je Schwierigkeit, wie sie generators.ts nimmt (ohne Erweiterung). */
  const kern: Record<Difficulty, Stufe[]> = { "sehr leicht": [0], leicht: [0, 1], "leicht bis mittel": [1, 2], mittel: [1, 2], schwer: [2, 3], "sehr schwer": [3] };
  for (const id of BANK_IDS) {
    const items: unknown[] = bankItems(id);
    const stufe = (item: unknown) => bankStufe(id, item as never);
    const vorrat = (diff: Difficulty): unknown[] => nachStufe(id, items as never, diff);
    const stufen = items.map(stufe);
    if (id === "das-dass") {
      assert.ok(stufen.every((s) => s === null), "das/dass hat keine Stufen");
      for (const diff of DIFFICULTIES) assert.equal(vorrat(diff).length, items.length, "ohne Stufen: die ganze Bank");
      continue;
    }
    assert.ok(stufen.every((s) => s !== null), `${id}: ein Eintrag ohne Stufe`);
    for (const diff of DIFFICULTIES) {
      const pool = vorrat(diff);
      assert.ok(pool.length >= Math.min(12, items.length), `${id} ${diff}: nur ${pool.length} Einträge`);
      const imKern: unknown[] = items.filter((_, i) => kern[diff].includes(stufen[i]!));
      // reichen die Einträge der Stufe, kommt nichts anderes dazu; sonst nur die Nachbarstufen
      if (imKern.length >= 12) assert.equal(pool.length, imKern.length, `${id} ${diff}: fremde Stufen im Vorrat`);
      const ps = pool.map((p) => stufe(p)!);
      assert.ok(Math.min(...ps) >= Math.min(...kern[diff]) - 1 && Math.max(...ps) <= Math.max(...kern[diff]) + 1, `${id} ${diff}: Stufen ${Math.min(...ps)}–${Math.max(...ps)}`);
    }
    // leicht und sehr schwer haben nie dieselben Einträge, wenn die Bank mehr als eine Stufe hat
    if (new Set(stufen).size > 1) {
      const leicht = new Set(vorrat("sehr leicht"));
      assert.ok(vorrat("sehr schwer").every((i) => !leicht.has(i)), `${id}: sehr leicht und sehr schwer überschneiden sich`);
    }
  }
  // im Generator: „sehr leicht“ zieht bei den Artikeln nur Alltagswörter der Stufe 0
  const stufe0 = new Set(bankItems("artikel").filter((i) => bankStufe("artikel", i) === 0).map((i) => i.word));
  for (const t of generateBuiltIn({ subject: "Deutsch", skills: [{ id: "deutsch.grammatik.artikel", name: "Artikel" }], difficulty: "sehr leicht", count: 60, taskType: "mc", seed: 5 })) {
    const wort = /„([^“]+)“/.exec(t.prompt)![1];
    assert.ok(stufe0.has(wort), `„${wort}“ ist nicht sehr leicht`);
  }
});

test("KI-Weg: ein Eintrag, den die Regeln beanstanden, wird keine Aufgabe", () => {
  const abgelehnt: [BankId, unknown, RegExp][] = [
    ["artikel", { word: "Keks", article: "der", translation: "biscuit", tags: ["Essen"] }, /auch „das“ ist richtig/],
    ["artikel", { word: "See", article: "der", translation: "lake", tags: ["Natur"] }, /zwei Bedeutungen/],
    ["artikel", { word: "Bekannte", article: "der", tags: ["Leute"] }, /der und die sind beide richtig/],
    ["adjektivdeklination", { prefix: "Ich trinke kalt", middle: " Wasser", suffix: ".", options1: ["-es", "-e", "-en", "-er"], correct1: "-es", options2: ["-", "-s", "-es", "-e"], correct2: "-", solution: "Ich trinke kaltes Wasser." }, /ohne Begleiter/],
    ["adjektivdeklination", { prefix: "Wegen des stark", middle: " Wind", suffix: " fiel das Spiel aus.", options1: ["-en", "-es", "-e", "-er"], correct1: "-en", options2: ["-es", "-", "-en", "-e"], correct2: "-es", solution: "Wegen des starken Windes fiel das Spiel aus." }, /Winds“ ist auch richtig/],
    ["praepositionen", { prefix: "Der Hund läuft in ", noun: "Garten", article: "der", suffix: ".", options: ["den", "dem", "der", "das"], correct: "den", kasus: "Akkusativ", solution: "Der Hund läuft in den Garten." }, /Dativ und Akkusativ passen/],
    ["praeteritum", { q: "Sie ___ gestern ins Kino. (gehen)", blanks: [["ging"]], solution: "sie ging", hint: "starkes Verb" }, /Einzahl oder Mehrzahl/],
    ["praeteritum", { q: "Gestern ___ ich ins Kino.", blanks: [["ging"]], solution: "ich ging", hint: "starkes Verb" }, /Grundform/],
    ["perfekt", { q: "Ich ___ am Sessel ___. (sitzen)", blanks: [["habe"], ["gesessen"]], solution: "Ich habe am Sessel gesessen.", hint: "h" }, /sein oder haben/],
    ["perfekt", { q: "Wir ___ gestern lange ___. (lernen)", blanks: [["haben"], ["gelernt"]], solution: "wir haben gelernt", hint: "h", errors: { gelernt: "Falsches Partizip II" } }, /richtig und steht zugleich als Fehler/],
  ];
  for (const [id, raw, grund] of abgelehnt) {
    const r = parseAiBankItem(id, raw);
    assert.equal(r.ok, false, `${id}: ${JSON.stringify(raw)} hätte abgelehnt werden müssen`);
    if (!r.ok) assert.match(r.error, grund);
  }
  // die eindeutige Form wird angeglichen, nicht verworfen: die Anweisung vor dem das/dass-Satz, der Beistrich vor dem Gliedsatz
  const dass = parseAiBankItem("das-dass", { q: "Ich hoffe, ___ du kommst.", blanks: [["dass"]], solution: "Ich hoffe, dass du kommst.", hint: "Ersatzprobe", explanation: "Konjunktion" });
  assert.ok(dass.ok, dass.ok ? "" : dass.error);
  if (dass.ok) assert.equal(dass.item.q, "Setze „das“ oder „dass“ ein: Ich hoffe, ___ du kommst.");
  const satz = parseAiBankItem("hauptsatz-gliedsatz", { parts: [{ text: "Ich bleibe zu Hause", type: "HS" }, { text: "weil es regnet.", type: "GS" }] });
  assert.ok(satz.ok, satz.ok ? "" : satz.error);
  if (satz.ok) assert.equal(satz.item.parts[0].text, "Ich bleibe zu Hause,");
  // ein Wort mit zwei Artikeln ist mit alsoArticle ein gültiger Eintrag
  assert.equal(parseAiBankItem("artikel", { word: "Keks", article: "der", alsoArticle: ["das"], tags: ["Essen"] }).ok, true);
});

test("die Lückensätze der Banken haben keine Stolpersteine für Kinder", () => {
  const falsch: string[] = [];
  const pruefe = (id: BankId, text: string) => {
    if (/—| – /.test(text)) falsch.push(`${id}: Gedankenstrich in „${text}“`);
    if (/\.\.\.|…/.test(text)) falsch.push(`${id}: Auslassungspunkte in „${text}“`);
  };
  for (const item of bankItems("adjektivdeklination") as AdjektivdeklinationItem[]) pruefe("adjektivdeklination", item.solution);
  for (const item of bankItems("praepositionen") as PraepositionenItem[]) pruefe("praepositionen", item.solution);
  for (const id of ["praeteritum", "perfekt", "das-dass"] as const) for (const item of bankItems(id) as ClozeItem[]) pruefe(id, item.q);
  assert.deepEqual(falsch, [], zeige(falsch));
});

/** Ein fester Zufall je Startwert (mulberry32), damit jeder Lauf dieselben Aufgaben zieht. */
function seeded(seed: number): () => number {
  let a = (seed + 1) * 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
