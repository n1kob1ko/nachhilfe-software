/**
 * Prüft den Vokabeltrainer ohne KI: das Lesen der Listen (lib/vokabeln.ts), das Vergleichen der Antworten
 * (lib/vokabeln-pruefen.ts), die Themenlisten (lib/vokabeln-themen.ts) und die eigenen Listen je Schüler
 * (lib/vokabellisten.ts) im Builder, in der Probeschularbeit und beim Abgeben.
 *
 * Jeder Eintrag jeder Themenliste prüft sich selbst: in beiden Richtungen zählt jede Alternative (auch ohne
 * Artikel, ohne „to“, amerikanisch geschrieben), jede falsche Option einer Auswahl wird abgelehnt und wäre
 * auch geschrieben keine richtige Übersetzung. Jede Aufgabe jedes Themas in jeder Stufe und jedem Format geht
 * durch das echte checkAnswer. niko: „Es ist wichtiger, fachlich falsche Korrekturen zu vermeiden, als
 * möglichst viele Änderungsvorschläge zu erzeugen.“ Was die App nicht sicher weiß, geht an die Lehrkraft.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { categoriesFor, DIFFICULTIES, type Difficulty } from "./curriculum";
import { generateBuiltIn, generateForSlot, hasBuiltInGenerator } from "./generators";
import { checkAnswer, type CheckResult, type TaskDraft } from "./tasks";
import { THEMEN } from "./themen";
import { alsText, fundstelle, leseListe, MAX_WOERTER, vokabelAufgabe, vokabelAufgabenFuerPlaetze, woerterFuer, wortartVon, type Quelle, type Vokabel } from "./vokabeln";
import { amerikanisch, EIGENE_VOKABELN, einBuchstabe, OFFEN_TEXT, teileDe } from "./vokabeln-pruefen";
import { istVokabelThema, LEXIKON, VOKABEL_THEMEN, VOKABEL_THEMEN_TEXT } from "./vokabeln-themen";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.AI_DISABLED;

const SEEDS = 8;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Ein „Zufall“, der immer dasselbe liefert: 0.99 heißt Englisch → Deutsch, 0 heißt Deutsch → Englisch. */
const fest = (x: number) => () => x;

const themaQuelle = (id: string): Quelle => ({ eintraege: VOKABEL_THEMEN[id], thema: true, lexikon: LEXIKON, vs: id.includes(".vs.") });
const eigeneQuelle = (text: string, o: Partial<Quelle> = {}): Quelle => ({ eintraege: leseListe(text).eintraege, thema: false, lexikon: LEXIKON, ...o });
const wort = (q: Quelle, en: string) => {
  const e = q.eintraege.find((x) => x.en[0] === en);
  assert.ok(e, `kein Eintrag „${en}“`);
  return e;
};

/** Eine geschriebene Aufgabe zu genau diesem Wort, in dieser Richtung. */
function schriftlich(q: Quelle, e: Vokabel, richtung: "de-en" | "en-de", difficulty: Difficulty = "mittel"): TaskDraft {
  const out = vokabelAufgabe(q, { category: richtung === "de-en" ? "translation" : "kurz", difficulty, rng: fest(0.99), wort: e });
  assert.ok(out, `keine Aufgabe zu ${e.en[0]}`);
  assert.match(out.task.prompt, richtung === "de-en" ? /^Wie heißt das auf Englisch\?/ : /^Was heißt das auf Deutsch\?/);
  return out.task;
}
const luecke = (q: Quelle, e: Vokabel, difficulty: Difficulty = "schwer") => vokabelAufgabe(q, { category: "gap", difficulty, rng: fest(0.5), wort: e, streng: true })?.task ?? null;
const auswahl = (q: Quelle, e: Vokabel, seed: number, difficulty: Difficulty = "mittel") =>
  vokabelAufgabe(q, { category: "mc", difficulty, rng: mulberry32(seed), wort: e, streng: true })?.task ?? null;
/** Eine Antwort so, wie das Blatt sie schickt: der Text, bei einer Lücke als JSON-Liste. */
const pruefe = (t: TaskDraft, s: string): CheckResult => checkAnswer(t, t.answer.blanks ? JSON.stringify([s]) : s);

/** Die richtigen Antworten einer Aufgabe, wie checkAnswer sie nimmt. */
function richtige(t: TaskDraft): string[] {
  if (t.type === "mc") return [String(t.answer.correct)];
  if (t.answer.blanks) return t.answer.blanks[0].map((alt) => JSON.stringify([alt]));
  return t.answer.accepted ?? [];
}

/** Ein englisches Wort, wie Schüler es auch schreiben dürfen: groß, mit Leerzeichen, amerikanisch, mit oder ohne Artikel und „to“. */
function englischeSchreibweisen(en: string, e: Vokabel): string[] {
  const out = [en, en.toUpperCase(), `  ${en.replace(/ /g, "  ")}  `, `${en}.`];
  const ae = en
    .toLowerCase()
    .split(" ")
    .map((w) => amerikanisch(w))
    .join(" ");
  if (ae !== en.toLowerCase()) out.push(ae);
  const wa = wortartVon(e);
  if (wa === "nomen" && !/^(a|an|the)\s/i.test(en) && !en.includes("(")) out.push(`the ${en}`);
  if (wa === "verb" && /^to\s/i.test(en)) out.push(en.replace(/^to\s+/i, ""));
  return out;
}
/** Ein deutsches Wort, wie Schüler es auch schreiben dürfen: klein, ohne Artikel, ae, oe, ue und ss. */
function deutscheSchreibweisen(de: string): string[] {
  const out = [de, de.toLowerCase(), de.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")];
  if (teileDe(de).artikel) out.push(de.split(" ").slice(1).join(" "));
  return out;
}

// ---------- die Liste lesen ----------
test("die Liste: ein Paar je Zeile, „;“ für Alternativen, ein Satz nach „|“", () => {
  const r = leseListe(`
# Unit 3, Seite 42
mobile phone; cell phone = das Handy | My mobile phone is in my bag.
dog = der Hund
cat\tdie Katze\tThe cat is sleeping.
bird - der Vogel
Hund, der = dog
house = Haus (das)

to go = gehen | Yesterday I *went* home.
`);
  assert.deepEqual(r.fehler, []);
  const [handy, hund, katze, vogel, hund2, haus, gehen] = r.eintraege;
  assert.deepEqual(handy.en, ["mobile phone", "cell phone"]);
  assert.deepEqual(handy.de, ["das Handy"]);
  assert.equal(handy.satz, "My mobile phone is in my bag.");
  assert.equal(handy.zeile, 3);
  assert.equal(hund.satz, undefined);
  assert.deepEqual([katze.en, katze.de, katze.satz], [["cat"], ["die Katze"], "The cat is sleeping."], "ein Tabulator trennt wie „=“ und „|“ (aus einer Tabelle kopiert)");
  assert.deepEqual([vogel.en, vogel.de], [["bird"], ["der Vogel"]], "ein Strich mit Leerzeichen trennt auch");
  assert.deepEqual(hund2.en, ["der Hund"], "„Hund, der“ wird „der Hund“");
  assert.deepEqual(haus.de, ["das Haus"], "„Haus (das)“ wird „das Haus“");
  assert.equal(gehen.satz, "Yesterday I *went* home.");
  assert.ok(
    r.hinweise.some((h) => h.zeile === 7 && /Links steht wohl das deutsche Wort/.test(h.text)),
    "Deutsch links bekommt einen Hinweis",
  );
  for (const e of r.eintraege) {
    const zurueck = leseListe(alsText(e)).eintraege[0];
    assert.deepEqual([zurueck.en, zurueck.de, zurueck.satz], [e.en, e.de, e.satz], `alsText und zurück: ${alsText(e)}`);
  }
});

test("die Liste: Fehler halten das Speichern auf und nennen die Zeile, Hinweise nur zeigen", () => {
  const fehler = (text: string) => leseListe(text).fehler.map((m) => m.text);
  const hinweise = (text: string) => leseListe(text).hinweise.map((m) => m.text);
  assert.deepEqual(fehler("dog der Hund"), ["Zeile 1: Es fehlt das „=“ zwischen Englisch und Deutsch."]);
  assert.deepEqual(fehler("dog = der Hund\na = b = c"), ["Zeile 2: Es steht mehr als ein „=“ in der Zeile."]);
  assert.deepEqual(fehler("= der Hund"), ["Zeile 1: Vor dem „=“ fehlt das englische Wort."]);
  assert.deepEqual(fehler("dog = "), ["Zeile 1: Nach dem „=“ fehlt das deutsche Wort."]);
  assert.deepEqual(fehler("dog\t"), ["Zeile 1: Es fehlt das „=“ zwischen Englisch und Deutsch."]);
  assert.deepEqual(fehler("# nur ein Kommentar\n\n"), [], "eine leere Liste ist kein Fehler des Lesers (speichereListe sagt es)");

  assert.match(hinweise("dog, puppy = der Hund").join(), /Ein Beistrich trennt keine Bedeutungen/);
  assert.deepEqual(
    hinweise("Hund, der = dog").filter((h) => /Beistrich/.test(h)),
    [],
    "„Hund, der“ ist kein Beistrich zwischen Bedeutungen",
  );
  assert.match(hinweise("dog/puppy = der Hund").join(), /schreib „;“ statt „\/“/);
  assert.match(hinweise("der Hund = dog").join(), /Links steht wohl das deutsche Wort/);
  assert.deepEqual(hinweise("to play = spielen\nwhite = weiß\ndog = der Hund"), [], "Englisch links: kein Hinweis");
  const doppelt = leseListe("dog = der Hund\ncat = die Katze\nDog = Hund, der");
  assert.equal(doppelt.eintraege.length, 2, "ein doppeltes Paar zählt einmal");
  assert.match(doppelt.hinweise[0].text, /Zeile 3: Dieses Wortpaar steht schon in Zeile 1/);
  assert.match(hinweise("cat = die Katze | My dog is black.").join(), /„cat“ kommt im Beispielsatz nicht vor/);
  assert.match(hinweise("cat = die Katze | My cat likes the other cat.").join(), /mehrmals vor\. Markier die Stelle/);

  const lang = Array.from({ length: MAX_WOERTER + 5 }, (_, i) => `word${i} = Wort${i}`).join("\n");
  const r = leseListe(lang);
  assert.equal(r.eintraege.length, MAX_WOERTER);
  assert.deepEqual(
    r.fehler.map((m) => m.text),
    [`Eine Liste hat höchstens ${MAX_WOERTER} Wörter. Ab Zeile ${MAX_WOERTER + 1} teil sie auf eine zweite Liste auf.`],
  );
});

test("die Lücke im Satz: das Wort auch in anderer Form, mit Sternchen markiert, und nur einmal", () => {
  const f = (zeile: string) => fundstelle(leseListe(zeile).eintraege[0]);
  const katze = f("cat = die Katze | My cats sleep a lot.");
  assert.ok(katze && katze !== "mehrfach");
  assert.deepEqual([katze.text, katze.gebeugt], ["cats", true]);
  const spielen = f("to play = spielen | We played football.");
  assert.ok(spielen && spielen !== "mehrfach");
  assert.deepEqual([spielen.text, spielen.gebeugt, spielen.grund], ["played", true, ["play"]]);
  const gehen = f("to go = gehen | Yesterday I *went* home.");
  assert.ok(gehen && gehen !== "mehrfach");
  assert.equal(gehen.text, "went");
  assert.equal(f("cat = die Katze | My dog is black."), null);
  assert.equal(f("cat = die Katze | My cat likes the other cat."), "mehrfach");
  // kein Satz: keine Lücke; die Lücke wird dann Deutsch → Englisch (der Builder sagt es)
  const q = eigeneQuelle("dog = der Hund\ncat = die Katze\nbird = der Vogel");
  assert.equal(luecke(q, wort(q, "dog")), null);
  const statt = vokabelAufgabe(q, { category: "gap", difficulty: "mittel", rng: fest(0.3) });
  assert.ok(statt);
  assert.equal(statt.category, "translation");
  assert.equal(statt.task.type, "grammar");
});

// ---------- die Themenlisten ----------
test("die Themenlisten: 21 Themen, jede Zeile ohne Fehler und ohne Hinweis, jedes Wort mit Satz und Lücke", () => {
  const ids = Object.keys(VOKABEL_THEMEN);
  assert.equal(ids.length, 21);
  const woerter = Object.values(VOKABEL_THEMEN).reduce((n, l) => n + l.length, 0);
  assert.ok(woerter >= 650, `${woerter} Wörter`);
  for (const [id, bloecke] of Object.entries(VOKABEL_THEMEN_TEXT)) {
    assert.equal(bloecke.length, 3, `${id}: drei Blöcke`);
    bloecke.forEach((b, i) => {
      const r = leseListe(b);
      assert.deepEqual([...r.fehler, ...r.hinweise], [], `${id}, Block ${i}`);
      assert.ok(r.eintraege.length >= 5, `${id}, Block ${i}: ${r.eintraege.length} Wörter`);
    });
    for (const e of VOKABEL_THEMEN[id]) {
      const f = fundstelle(e);
      assert.ok(f && f !== "mehrfach", `${id}: „${e.en[0]}“ hat keine eindeutige Lücke in „${e.satz}“`);
    }
  }
  // jede Wortschatz-Fähigkeit der Volksschule und Unterstufe hat eine Liste, außer den eigenen Listen und
  // „Uhrzeit und Datum“ (Uhrzeiten und Daten lesen, keine Wortpaare)
  const faehigkeiten = THEMEN.filter((s) => /^englisch\.(vs\.)?vocab\./.test(s.id) && !s.parentId);
  for (const s of faehigkeiten) {
    if (s.id === EIGENE_VOKABELN || s.id === "englisch.vocab.uhrzeit-datum") {
      assert.equal(istVokabelThema(s.id), false);
      if (s.id === EIGENE_VOKABELN) assert.equal(hasBuiltInGenerator(s.id), false, "die eigenen Listen haben keinen Generator ohne Schüler");
      continue;
    }
    assert.ok(istVokabelThema(s.id), `${s.id} hat keine Themenliste`);
    assert.ok(hasBuiltInGenerator(s.id), `${s.id} hat keinen Generator`);
  }
  for (const id of ids)
    assert.ok(
      faehigkeiten.some((s) => s.id === id),
      `${id} ist keine Fähigkeit`,
    );
  const vs = faehigkeiten.filter((s) => s.id.startsWith("englisch.vs.") && istVokabelThema(s.id));
  assert.ok(
    vs.every((s) => s.gradeMax <= 4),
    "Volksschul-Themen bleiben in der Volksschule",
  );
  assert.equal(vs.length, 8);
});

test("jeder Eintrag jeder Themenliste prüft sich selbst: jede Alternative zählt, keine falsche Option ist richtig", () => {
  let auswahlen = 0;
  for (const [id, woerter] of Object.entries(VOKABEL_THEMEN)) {
    const q = themaQuelle(id);
    for (const e of woerter) {
      const deEn = schriftlich(q, e, "de-en");
      for (const en of e.en)
        for (const s of englischeSchreibweisen(en, e)) {
          const r = pruefe(deEn, s);
          assert.equal(r.correct, true, `${id}: ${e.de[0]} → „${s}“ ${r.feedback}`);
        }
      const enDe = schriftlich(q, e, "en-de");
      for (const de of e.de)
        for (const s of deutscheSchreibweisen(de)) {
          const r = pruefe(enDe, s);
          assert.equal(r.correct, true, `${id}: ${e.en[0]} → „${s}“ ${r.feedback}`);
        }
      for (let seed = 0; seed < 4; seed++) {
        const mc = auswahl(q, e, seed, seed % 2 ? "leicht" : "schwer");
        assert.ok(mc, `${id}: keine Auswahl zu ${e.en[0]}`);
        auswahlen++;
        const optionen = mc.data.options as string[];
        assert.equal(optionen.length, seed % 2 ? 3 : 4);
        assert.equal(new Set(optionen).size, optionen.length, `${id}: doppelte Option ${optionen}`);
        const geschrieben = mc.prompt.startsWith("Welches englische Wort") ? deEn : enDe;
        assert.equal(checkAnswer(mc, String(mc.answer.correct)).correct, true);
        optionen.forEach((o, i) => {
          if (i === mc.answer.correct) return;
          const r = checkAnswer(mc, String(i));
          assert.equal(r.correct, false, `${id}: ${mc.prompt} → ${o}`);
          assert.ok(r.errorLabel?.startsWith(`„${o}“ heißt`) || r.errorLabel?.includes(`„${o}“`), `${id}: Etikett ${r.errorLabel}`);
          // geschrieben wäre sie keine richtige Antwort (höchstens offen: „das Eis“ für egg sieht aus wie eine Mehrzahl von „das Ei“)
          assert.notEqual(pruefe(geschrieben, o).correct, true, `${id}: die falsche Option „${o}“ zu ${mc.prompt.split("\n")[1]} wäre geschrieben richtig`);
        });
      }
    }
  }
  assert.ok(auswahlen > 2500, `${auswahlen} Auswahlen`);
});

test("jede Aufgabe jedes Themas in jeder Stufe und jedem Format: die Lösung zählt, jede falsche Option nicht", () => {
  const kategorien = [
    null,
    ...categoriesFor("Englisch")
      .map((c) => c.key)
      .filter((k) => !["writing", "offen", "auswendig"].includes(k)),
  ];
  let n = 0;
  for (const id of Object.keys(VOKABEL_THEMEN))
    for (const d of DIFFICULTIES)
      for (const c of kategorien)
        for (let s = 0; s < SEEDS; s++) {
          const t = generateForSlot({ skillId: id, skillName: id, difficulty: d, category: c, subject: "Englisch" }, mulberry32(s * 7919 + d.length * 31 + (c?.length ?? 0)), s);
          const wo = `${id} [${d}, ${c}] ${t.prompt.replace(/\n/g, " / ")}`;
          n++;
          assert.equal(t.skillId, id, wo);
          assert.equal(t.difficulty, d, wo);
          assert.doesNotMatch(`${t.prompt} ${t.solution} ${t.hints.join(" ")}`, /undefined|null|NaN|\*|\s{2}/, wo);
          assert.ok(t.type === "mc" || t.answer.vokabel, `${wo}: keine Vokabel-Aufgabe`);
          for (const r of richtige(t)) assert.equal(checkAnswer(t, r).correct, true, `${wo} → ${r}`);
          for (const em of t.errorMap) {
            const r = checkAnswer(t, em.answer);
            assert.equal(r.correct, false, `${wo} → ${em.answer}`);
            assert.equal(r.errorLabel, em.label, wo);
          }
          if (c === "mc") assert.equal(t.type, "mc", wo);
          if (t.type === "mc") assert.equal((t.data.options as string[]).length, ["sehr leicht", "leicht"].includes(d) ? 3 : 4, wo);
          if (c === "gap" || c === "grammar") {
            assert.equal(t.type, "cloze", `${wo}: jedes Wort einer Themenliste hat einen Satz`);
            assert.equal(t.prompt.split("___").length, 2, wo);
          }
          if (c === "translation") assert.match(t.prompt, /^Wie heißt das auf Englisch\?/, wo);
        }
  assert.ok(n > 6000, `${n} Aufgaben`);
  // generateBuiltIn (Empfehlungen, Überprüfungen): jedes Antwortformat, auf einem Blatt keine Aufgabe doppelt
  for (const id of Object.keys(VOKABEL_THEMEN))
    for (const taskType of ["mixed", "mc", "cloze", "grammar"] as const) {
      const blatt = generateBuiltIn({ subject: "Englisch", skills: [{ id, name: id }], difficulty: "mittel", count: 8, taskType, seed: 3 });
      assert.equal(blatt.length, 8);
      assert.equal(new Set(blatt.map((t) => t.prompt)).size, 8, `${id} ${taskType}: doppelte Aufgabe`);
      assert.equal(new Set(blatt.map((t) => t.data.wort)).size, 8, `${id} ${taskType}: ein Wort zweimal`);
      for (const t of blatt) for (const r of richtige(t)) assert.equal(checkAnswer(t, r).correct, true, `${id} ${taskType}: ${t.prompt}`);
      if (taskType === "mc") assert.ok(blatt.every((t) => t.type === "mc"));
      if (taskType === "cloze") assert.ok(blatt.every((t) => t.type === "cloze"));
    }
});

test("die Stufen: welche Wörter kommen und wie viele", () => {
  const id = "englisch.vocab.freizeit";
  const q = themaQuelle(id);
  const block = (st: number) => q.eintraege.filter((e) => (e.stufe ?? 0) === st);
  assert.deepEqual(woerterFuer(q, "sehr leicht"), block(0).slice(0, 10), "sehr leicht: die ersten zehn Wörter");
  assert.deepEqual(woerterFuer(q, "leicht"), block(0));
  assert.deepEqual(woerterFuer(q, "mittel"), [...block(0), ...block(1)]);
  assert.ok(woerterFuer(q, "schwer").length > q.eintraege.length, "schwer: alle, die schwereren doppelt so oft");
  assert.ok(
    woerterFuer(q, "sehr schwer").every((e) => (e.stufe ?? 0) >= 1),
    "sehr schwer: nur die schwereren",
  );
  const eigene = eigeneQuelle(Array.from({ length: 20 }, (_, i) => `word${i} = Wort${i}`).join("\n"));
  assert.equal(woerterFuer(eigene, "sehr leicht").length, 8);
  assert.equal(woerterFuer(eigene, "leicht").length, 15);
  assert.equal(woerterFuer(eigene, "mittel").length, 20);
  assert.equal(woerterFuer(eigene, "sehr schwer").length, 20);
  // ein Blatt nimmt jedes Wort der Stufe einmal, bevor eines wiederkommt
  const plaetze = Array.from({ length: 8 }, () => ({ category: "translation", difficulty: "sehr leicht" as Difficulty }));
  const blatt = vokabelAufgabenFuerPlaetze(eigene, plaetze, { rng: mulberry32(5) });
  const gefragt = blatt.map((x) => x!.task.prompt.split("\n")[1]);
  assert.deepEqual([...gefragt].sort(), Array.from({ length: 8 }, (_, i) => `Wort${i}`).sort());
  // die schwereren Stufen fragen öfter Deutsch → Englisch
  const anteil = (d: Difficulty) => {
    const r = mulberry32(9);
    let deEn = 0;
    for (let i = 0; i < 400; i++) if (vokabelAufgabe(q, { category: "kurz", difficulty: d, rng: r })!.task.prompt.startsWith("Wie heißt")) deEn++;
    return deEn;
  };
  assert.ok(anteil("sehr leicht") < anteil("sehr schwer"));
});

// ---------- prüfen ----------
const EIGENE_LISTE = `
dog = der Hund | My dog loves the park.
cat = die Katze | The cat is sleeping on the sofa.
car = das Auto | My mum's car is red.
to play = spielen | We play football after school.
colour = die Farbe | What colour is your bike?
mobile phone; cell phone = das Handy | My mobile phone is in my bag.
headphones = die Kopfhörer | My headphones are broken.
to cry = weinen | The baby cries every night.
clever = klug; schlau | My sister is very clever.
kind = nett | My teacher is very kind.
`;

test("prüfen: Alternativen, Artikel, „to“, Groß und klein, Leerzeichen, britisch und amerikanisch zählen", () => {
  const q = eigeneQuelle(EIGENE_LISTE);
  const hund = schriftlich(q, wort(q, "dog"), "de-en");
  for (const s of ["dog", "the dog", "a dog", "  DOG  ", "Dog."]) assert.equal(pruefe(hund, s).correct, true, s);
  const handy = schriftlich(q, wort(q, "mobile phone"), "de-en");
  for (const s of ["mobile phone", "cell phone", "Cell  Phone", "a mobile phone", "mobile-phone"]) assert.equal(pruefe(handy, s).correct, true, s);
  assert.match(pruefe(handy, "cell phone").feedback, /^Richtig! Auch richtig: mobile phone\.$/);
  const spielen = schriftlich(q, wort(q, "to play"), "de-en");
  for (const s of ["to play", "play", "To Play"]) assert.equal(pruefe(spielen, s).correct, true, s);
  const farbe = schriftlich(q, wort(q, "colour"), "de-en");
  for (const s of ["colour", "color", "the color"]) assert.equal(pruefe(farbe, s).correct, true, s);

  const dog = schriftlich(q, wort(q, "dog"), "en-de");
  for (const s of ["der Hund", "Hund", "hund", "ein Hund", "DER HUND"]) assert.equal(pruefe(dog, s).correct, true, s);
  assert.equal(pruefe(dog, "Hund").feedback, "Richtig! Mit Artikel: der Hund.");
  const klug = schriftlich(q, wort(q, "clever"), "en-de");
  for (const s of ["klug", "schlau"]) assert.equal(pruefe(klug, s).correct, true, s);
  const kopfhoerer = schriftlich(q, wort(q, "headphones"), "en-de");
  for (const s of ["die Kopfhörer", "Kopfhoerer", "kopfhörer"]) assert.equal(pruefe(kopfhoerer, s).correct, true, s);
  // was eine Themenliste als Übersetzung kennt, zählt auch: kind = die Art (false friends)
  const nett = schriftlich(q, wort(q, "kind"), "en-de");
  const art = pruefe(nett, "die Art");
  assert.equal(art.correct, true);
  assert.equal(art.feedback, "Richtig! In der Liste steht: nett.");
});

test("prüfen: falsch nur, wenn die App weiß warum; sonst schaut die Lehrkraft", () => {
  const q = eigeneQuelle(EIGENE_LISTE);
  const hund = schriftlich(q, wort(q, "dog"), "de-en");
  // ein anderes Wort der Liste: falsch, und das Etikett sagt, was es heißt
  const katze = pruefe(hund, "cat");
  assert.deepEqual([katze.correct, katze.errorLabel, katze.errorType], [false, "„cat“ heißt „die Katze“", "wortschatz"]);
  // in einer eigenen Liste nur, wenn die Themenlisten beide Wörter kennen: look, see und watch kennen sie nicht
  const schauen = eigeneQuelle("look = schauen\nsee = sehen\nwatch = beobachten; anschauen\ndog = der Hund");
  const look = schriftlich(schauen, wort(schauen, "look"), "en-de");
  for (const [s, bei] of [["sehen", "see"], ["anschauen", "watch"]]) {
    const r = pruefe(look, s);
    assert.equal(r.correct, null, s);
    assert.equal(r.feedback, `In der Liste steht „${s}“ bei „${bei}“. Ob es hier auch passt, schaut sich deine Lehrerin bzw. dein Lehrer an.`);
  }
  assert.equal(pruefe(look, "Hund").correct, null, "look kennen die Themenlisten nicht");
  assert.equal(pruefe(schriftlich(schauen, wort(schauen, "dog"), "en-de"), "sehen").correct, null);
  assert.equal(pruefe(schriftlich(schauen, wort(schauen, "watch"), "de-en"), "look").correct, null);
  // in einer Themenliste ist ein anderes Wort sicher falsch: dort sind die Bedeutungen geprüft
  const ff = themaQuelle("englisch.vocab.false-friends");
  assert.equal(pruefe(schriftlich(ff, wort(ff, "fast"), "en-de"), "fast").errorLabel, "„fast“ heißt auf Englisch „almost“");
  // ein Buchstabe falsch: zählt als falsch, mit eigenem Etikett
  const tipp = pruefe(hund, "dgo");
  assert.deepEqual([tipp.correct, tipp.errorLabel, tipp.errorType], [false, "Ein Buchstabe falsch", "rechtschreibung"]);
  // ein Buchstabe anders, aber ein anderes Wort der Liste: das Etikett des Wortes
  const auto = schriftlich(q, wort(q, "car"), "de-en");
  assert.equal(pruefe(auto, "cat").errorLabel, "„cat“ heißt „die Katze“");
  // nicht in der Liste: offen, nie falsch
  for (const s of ["puppy", "hound", "doggy"]) {
    const r = pruefe(hund, s);
    assert.equal(r.correct, null, s);
    assert.equal(r.feedback, OFFEN_TEXT);
  }
  // Einzahl und Mehrzahl sind kein Tippfehler: offen
  assert.equal(pruefe(hund, "dogs").correct, null);
  // das Wort aus der Frage: bei manchen Wörtern dasselbe (clever, Handy); offen, mit eigenem Text
  const klug = schriftlich(q, wort(q, "clever"), "de-en");
  assert.equal(pruefe(klug, "clever").correct, true);
  const clever = schriftlich(q, wort(q, "clever"), "en-de");
  const kopiert = pruefe(clever, "clever");
  assert.equal(kopiert.correct, null);
  assert.match(kopiert.feedback, /^Das ist das Wort aus der Frage\. Gesucht ist das deutsche Wort\./);
  assert.equal(pruefe(hund, "Hund").correct, null);
  assert.match(pruefe(hund, "Hund").feedback, /Gesucht ist das englische Wort/);
  // leer
  assert.deepEqual([pruefe(hund, "  ").correct, pruefe(hund, "  ").feedback], [false, "Schreib ein Wort in das Feld."]);

  const dog = schriftlich(q, wort(q, "dog"), "en-de");
  const artikel = pruefe(dog, "die Hund");
  assert.deepEqual([artikel.correct, artikel.errorLabel, artikel.errorType], [false, "Falscher Artikel", "grammatik"]);
  assert.equal(pruefe(dog, "eine Hund").errorLabel, "Falscher Artikel");
  assert.equal(pruefe(dog, "Hunde").correct, null, "die Mehrzahl: offen");
  assert.equal(pruefe(dog, "Katze").errorLabel, "„die Katze“ heißt auf Englisch „cat“");
  assert.equal(pruefe(dog, "Hnud").errorLabel, "Ein Buchstabe falsch");
  // die Kopfhörer: „der Kopfhörer“ ist die Einzahl, kein falscher Artikel
  const kopfhoerer = schriftlich(q, wort(q, "headphones"), "en-de");
  assert.equal(pruefe(kopfhoerer, "der Kopfhörer").correct, null);
  // Wörter mit zwei Artikeln (der oder das Joghurt, die oder das Cola): jeder zählt
  const joghurt = schriftlich(eigeneQuelle("yoghurt = der Joghurt\napple = der Apfel\nmilk = die Milch"), eigeneQuelle("yoghurt = der Joghurt").eintraege[0], "en-de");
  for (const s of ["das Joghurt", "der Joghurt", "die Joghurt", "Jogurt"]) assert.equal(pruefe(joghurt, s).correct, true, s);
});

test("prüfen: in der Lücke die Form im Satz; eine andere Form ist nur in einem geprüften Satz sicher falsch", () => {
  const eigene = eigeneQuelle(EIGENE_LISTE);
  const weinen = luecke(eigene, wort(eigene, "to cry"));
  assert.ok(weinen);
  assert.equal(weinen.type, "cloze");
  assert.match(weinen.prompt, /^Setz das passende englische Wort ein\.\nThe baby ___ \(weinen\) every night\.$/);
  assert.equal(pruefe(weinen, "cries").correct, true);
  assert.equal(pruefe(weinen, "Cries").correct, true);
  for (const s of ["cry", "cried"]) {
    const r = pruefe(weinen, s);
    assert.equal(r.correct, null, `${s}: eine eigene Liste ist nicht geprüft, die Lehrkraft entscheidet`);
    assert.match(r.feedback, /^Das Wort stimmt\. Ob die Form in den Satz passt/);
  }
  assert.equal(pruefe(weinen, "play").errorLabel, "„play“ heißt „spielen“");
  assert.equal(pruefe(weinen, "to cries").correct, null, "in der Lücke gehört „to“ nicht dazu");
  // in den leichten Stufen nur Lücken, in die das Wort so passt, wie es in der Liste steht
  assert.equal(luecke(eigene, wort(eigene, "to cry"), "leicht"), null);
  assert.ok(luecke(eigene, wort(eigene, "dog"), "leicht"));

  // ein geprüfter Satz einer Themenliste: die Grundform ist sicher falsch ...
  const thema = eigeneQuelle("to collect = sammeln | My brother collects stamps.\nto hurt = wehtun | My knee hurts.\nto cook = kochen | My dad cooks dinner.", { thema: true });
  const sammeln = luecke(thema, wort(thema, "to collect"))!;
  const grundform = pruefe(sammeln, "collect");
  assert.deepEqual([grundform.correct, grundform.errorLabel, grundform.errorType], [false, "Falsche Form im Satz", "grammatik"]);
  // ... außer sie ist auch die Vergangenheit: „My knee hurt.“ stimmt auch
  const wehtun = luecke(thema, wort(thema, "to hurt"))!;
  assert.equal(pruefe(wehtun, "hurts").correct, true);
  assert.equal(pruefe(wehtun, "hurt").correct, null);
});

test("Auswahl: falsche Optionen nur aus derselben Liste, nie eine andere richtige Übersetzung", () => {
  const q = eigeneQuelle(`
bench = die Bank
bank = die Bank
kind = nett
art = die Kunst
sort = die Sorte
dog = der Hund
cat = die Katze
house = das Haus
`);
  const liste = new Set(q.eintraege.flatMap((e) => [...e.en, ...e.de]));
  for (let seed = 0; seed < 60; seed++) {
    const bank = auswahl(q, wort(q, "bench"), seed)!;
    const optionen = bank.data.options as string[];
    assert.ok(
      optionen.every((o) => liste.has(o)),
      `nur Wörter der Liste: ${optionen}`,
    );
    if (bank.prompt.startsWith("Welches englische Wort")) assert.ok(!optionen.includes("bank") || optionen[bank.answer.correct as number] === "bank", "„die Bank“: bank ist keine falsche Option");
    else assert.ok(!optionen.some((o, i) => i !== bank.answer.correct && o === "die Bank"));
    const nett = auswahl(q, wort(q, "kind"), seed)!;
    if (nett.prompt.startsWith("Welche deutsche")) assert.ok(!(nett.data.options as string[]).includes("die Sorte"), `kind heißt laut den Themenlisten auch „die Sorte“: ${nett.data.options}`);
  }
  // zu wenige Wörter für eine Auswahl: dann geschrieben
  const zwei = eigeneQuelle("dog = der Hund\ncat = die Katze");
  assert.equal(auswahl(zwei, wort(zwei, "dog"), 1), null);
  assert.equal(vokabelAufgabe(zwei, { category: "mc", difficulty: "mittel", rng: mulberry32(1) })!.task.type, "grammar");
  // der Rest der Hilfen: ein Buchstabe
  assert.ok(einBuchstabe("dog", "dgo") && einBuchstabe("hund", "hnd") && !einBuchstabe("dog", "cat"));
});

// ---------- eigene Listen je Schüler ----------
async function mitDb() {
  const { resetForTests } = await import("./db");
  resetForTests();
  const repo = await import("./repo");
  const listen = await import("./vokabellisten");
  const builder = await import("./builder");
  const teacher = repo.listTeachers()[0];
  const neu = (name: string, o: Partial<Parameters<typeof repo.createStudent>[0]> = {}) =>
    repo.createStudent({
      name,
      grade: 5,
      klasse: 1,
      teacher_id: teacher.id,
      school: "",
      school_type: "Mittelschule",
      subjects: ["Englisch"],
      current_topics: "",
      strengths_note: "",
      weaknesses_note: "",
      goals: "",
      notes: "",
      ...o,
    });
  const settings = (o: Partial<import("./builder").BuilderSettings> = {}): import("./builder").BuilderSettings => ({
    studentId: null,
    subject: "Englisch",
    schoolType: "Mittelschule",
    klasse: 1,
    skillIds: [EIGENE_VOKABELN],
    difficulty: "sehr leicht",
    count: 5,
    categories: [],
    focus: "",
    useAI: true,
    title: "",
    ...o,
  });
  return { repo, listen, builder, teacher, neu, settings };
}

/** Eine KI zum Zuschauen: jede Anfrage wird gemerkt und scheitert. Mit ihr gilt die KI als eingeschaltet. */
async function zuschauendeKi() {
  const router = await import("./ai/router");
  const anfragen: string[] = [];
  router.setTransport(async (p) => {
    anfragen.push(JSON.stringify(p));
    throw new Error("Test: keine KI");
  });
  return {
    anfragen,
    aus: () => {
      router.setTransport(null);
      router.resetRouter();
    },
  };
}

const FUENF = `
dog = der Hund | My dog loves the park.
cat = die Katze | The cat is sleeping on the sofa.
mobile phone; cell phone = das Handy | My mobile phone is in my bag.
to play = spielen | We play football after school.
bird = der Vogel
`;

test("eigene Listen: speichern, ändern, Fehler, löschen, nur die eigenen", async () => {
  const { listen, neu, teacher } = await mitDb();
  const mira = neu("Mira Testkind");
  const jonas = neu("Jonas Testkind");
  const fehler = (title: string, text: string, studentId = mira) => {
    const r = listen.speichereListe({ studentId, teacherId: teacher.id, title, text });
    assert.equal(r.ok, false);
    return (r as { fehler: string[] }).fehler;
  };
  assert.deepEqual(fehler("", FUENF), ["Gib der Liste einen Namen, zum Beispiel „Unit 3“."]);
  assert.deepEqual(fehler("x".repeat(81), FUENF), ["Der Name hat höchstens 80 Zeichen."]);
  assert.deepEqual(fehler("Unit 3", "dog der Hund\ncat = die Katze"), ["Zeile 1: Es fehlt das „=“ zwischen Englisch und Deutsch."]);
  assert.deepEqual(fehler("Unit 3", "# noch leer"), ["Schreib mindestens ein Wortpaar in die Liste, zum Beispiel: dog = der Hund"]);
  assert.deepEqual(fehler("Unit 3", FUENF, 9999), ["Diese Schülerin bzw. diesen Schüler gibt es nicht mehr."]);

  const a = listen.speichereListe({ studentId: mira, teacherId: teacher.id, title: "  Unit   3 ", text: `${FUENF}\r\n\r\n` });
  assert.ok(a.ok);
  const liste = listen.getListe(a.id)!;
  assert.deepEqual([liste.title, liste.woerter, liste.student_id], ["Unit 3", 5, mira]);
  assert.ok(!liste.text.includes("\r"));
  const b = listen.speichereListe({ studentId: mira, teacherId: teacher.id, title: "Tiere", text: "horse = das Pferd\ncow = die Kuh\ndog = der Hund" });
  assert.ok(b.ok);
  assert.deepEqual(
    listen
      .listenVon(mira)
      .map((l) => l.title)
      .sort(),
    ["Tiere", "Unit 3"],
  );
  assert.deepEqual(listen.listenVon(jonas), []);

  // ändern; eine Liste eines anderen Schülers lässt sich so nicht ändern
  assert.ok(listen.speichereListe({ id: a.id, studentId: mira, teacherId: teacher.id, title: "Unit 3", text: `${FUENF}\nhorse = das Pferd` }).ok);
  assert.equal(listen.getListe(a.id)!.woerter, 6);
  assert.deepEqual(listen.speichereListe({ id: a.id, studentId: jonas, teacherId: teacher.id, title: "Fremd", text: FUENF }), { ok: false, fehler: ["Diese Liste gibt es nicht mehr."] });

  // die Wörter einer Übung: die gewählten Listen, jedes Paar einmal; ohne Wahl (oder mit fremden Listen) alle
  const beide = listen.vokabelQuelle(mira, null);
  assert.equal(beide.eintraege.length, 7, "dog und horse stehen in beiden Listen und zählen einmal");
  assert.equal(beide.thema, false);
  assert.deepEqual(
    listen.vokabelQuelle(mira, [b.id]).eintraege.map((e) => e.en[0]),
    ["horse", "cow", "dog"],
  );
  assert.equal(listen.vokabelQuelle(jonas, [a.id]).eintraege.length, 0, "die Liste von Mira ist nicht die von Jonas");
  assert.equal(listen.ohneWoerter(jonas), "Für diese Schülerin bzw. diesen Schüler gibt es noch keine Vokabelliste mit Wörtern. Leg eine im Profil unter Übungen › Vokabellisten an.");
  assert.equal(listen.ohneWoerter(null), "Eigene Vokabellisten gibt es nur in einer Übung für eine Schülerin oder einen Schüler.");
  assert.equal(listen.ohneWoerter(mira, [a.id]), null);

  listen.loescheListe(b.id);
  assert.equal(listen.getListe(b.id), null);
  assert.deepEqual(
    listen.listenVon(mira).map((l) => l.id),
    [a.id],
  );
});

test("Builder: eine Übung aus einer eigenen Liste kommt nie von der KI, auch wenn sie eingeschaltet ist", async () => {
  const { repo, listen, builder, neu, teacher, settings } = await mitDb();
  const ki = await zuschauendeKi();
  try {
    const lea = neu("Lea Testkind");
    const ohne = neu("Ben Testkind");
    const a = listen.speichereListe({ studentId: lea, teacherId: teacher.id, title: "Unit 3", text: FUENF });
    assert.ok(a.ok);
    const { id } = await builder.createDraft(settings({ studentId: lea, vokabelListen: [a.id], categories: ["translation"] }), teacher.id);
    const tasks = repo.listTasks(id);
    assert.equal(tasks.length, 5);
    assert.equal(ki.anfragen.length, 0, "keine Anfrage an die KI");
    assert.ok(tasks.every((t) => t.skillId === EIGENE_VOKABELN && t.skillIds?.includes(EIGENE_VOKABELN)));
    assert.deepEqual(tasks.map((t) => t.prompt.split("\n")[1]).sort(), ["das Handy", "der Hund", "der Vogel", "die Katze", "spielen"], "jedes Wort einmal");
    assert.match(repo.getWorksheet(id)!.title, /Vokabeln Unit 3/);
    assert.deepEqual(builder.settingsOf(repo.getWorksheet(id)!).vokabelListen, [a.id], "die Listen bleiben bei der Übung");

    // neu erstellen: wieder aus der Liste
    const alt = tasks[0];
    assert.ok((await builder.regenerateTask(alt.id, { useAI: true, teacherId: teacher.id })).ok);
    const neuTask = repo.getTask(alt.id)!;
    assert.equal(neuTask.skillId, EIGENE_VOKABELN);
    assert.ok(neuTask.answer.vokabel || neuTask.type === "mc");
    assert.equal(ki.anfragen.length, 0);
    // „Neu erstellen“ bringt ein Wort, das noch nicht auf dem Blatt steht
    const drei = await builder.createDraft(settings({ studentId: lea, vokabelListen: [a.id], count: 3 }), teacher.id);
    const vorher = repo.listTasks(drei.id);
    assert.equal(new Set(vorher.map((t) => t.data.wort)).size, 3);
    assert.ok((await builder.regenerateTask(vorher[0].id, { useAI: false, teacherId: teacher.id })).ok);
    assert.ok(!vorher.map((t) => t.data.wort).includes(repo.getTask(vorher[0].id)!.data.wort), "ein neues Wort");
    // ein Blatt aus einer Themenliste: jedes Wort einmal, auch in verschiedenen Formaten
    const thema = await builder.createDraft(settings({ studentId: lea, skillIds: ["englisch.vocab.freizeit"], count: 8, useAI: false, difficulty: "mittel" }), teacher.id);
    assert.equal(new Set(repo.listTasks(thema.id).map((t) => t.data.wort)).size, 8, "auf einem Blatt kommt jedes Wort einmal");

    // ohne Liste: eine klare Meldung statt Aufgaben von der KI
    await assert.rejects(builder.createDraft(settings({ studentId: ohne }), teacher.id), /noch keine Vokabelliste mit Wörtern/);
    await assert.rejects(builder.createDraft(settings({ studentId: null }), teacher.id), /nur in einer Übung für eine Schülerin oder einen Schüler/);

    // mit einer Themenliste zusammen: die KI bekommt nur das Thema, nie die eigenen Listen
    const gemischt = await builder.createDraft(settings({ studentId: lea, skillIds: [EIGENE_VOKABELN, "englisch.vocab.freizeit"], count: 6, vokabelListen: [a.id] }), teacher.id);
    const gemischtTasks = repo.listTasks(gemischt.id);
    assert.equal(gemischtTasks.length, 6);
    assert.ok(gemischtTasks.some((t) => t.skillId === EIGENE_VOKABELN));
    assert.ok(gemischtTasks.some((t) => t.skillId === "englisch.vocab.freizeit"));
    assert.ok(ki.anfragen.length > 0, "für das Thema fragt der Builder die KI");
    // die KI bekommt keinen Platz der eigenen Listen und keines ihrer Wörter (auch nicht als „gibt es schon“)
    assert.ok(
      ki.anfragen.every((p) => !p.includes(`skill_id=${EIGENE_VOKABELN}`) && !/der Vogel|das Handy|Unit 3/.test(p)),
      "die KI sieht die eigenen Listen nicht",
    );
    for (const t of gemischtTasks) for (const r of richtige(t)) assert.equal(checkAnswer(t, r).correct, true, t.prompt);

    // settingsFromForm: eine gewählte Liste bringt die Fähigkeit mit
    const f = new FormData();
    f.set("student_id", String(lea));
    f.set("subject", "Englisch");
    f.append("vokabel_listen", String(a.id));
    f.append("vokabel_listen", "abc");
    const s = builder.settingsFromForm(f);
    assert.deepEqual(s.skillIds, [EIGENE_VOKABELN]);
    assert.deepEqual(s.vokabelListen, [a.id]);
  } finally {
    ki.aus();
  }
});

test("abgeben: eine Alternative ist richtig, ein anderes Wort der Liste falsch, ein unbekanntes Wort geht an die Lehrkraft", async () => {
  const { repo, listen, builder, neu, teacher, settings } = await mitDb();
  const { submitAnswer } = await import("./service");
  const nora = neu("Nora Testkind");
  const a = listen.speichereListe({ studentId: nora, teacherId: teacher.id, title: "Unit 3", text: FUENF });
  assert.ok(a.ok);
  const { id } = await builder.createDraft(settings({ studentId: nora, useAI: false, categories: ["translation"] }), teacher.id);
  const { assignmentId } = builder.releaseWorksheet(id, nora);
  assert.ok(assignmentId);
  const token = repo.getStudent(nora)!.access_token;
  const tasks = repo.listTasks(id);
  const zu = (de: string) => tasks.find((t) => t.prompt.endsWith(`\n${de}`))!;
  const abgeben = (t: (typeof tasks)[number], answer: string) => submitAnswer({ token, assignmentId: assignmentId!, taskId: t.id, answer, timeMs: 9000, hintsUsed: 0 });

  const handy = await abgeben(zu("das Handy"), "cell phone");
  assert.equal(handy.correct, true);
  assert.match(handy.feedback, /^Richtig! Auch richtig: mobile phone\./);

  const hund = await abgeben(zu("der Hund"), "cat");
  assert.equal(hund.correct, false);
  assert.match(hund.feedback, /„cat“ heißt „die Katze“/);

  const vogel = await abgeben(zu("der Vogel"), "parrot");
  assert.equal(vogel.correct, null);
  assert.equal(vogel.pendingReview, true);
  assert.equal(vogel.feedback, OFFEN_TEXT, "die Rückmeldung des Vokabeltrainers bleibt");
  const { db } = await import("./db");
  const versuch = db().prepare("SELECT review, feedback FROM attempts WHERE task_id = ?").get(zu("der Vogel").id) as { review: string; feedback: string };
  assert.deepEqual(versuch, { review: "offen", feedback: OFFEN_TEXT });

  const spielen = await abgeben(zu("spielen"), "play");
  assert.equal(spielen.correct, true);
});

test("Übung, Probeschularbeit und Diagnose: die eigenen Listen nur mit Schüler und Wörtern", async () => {
  const { repo, listen, neu, teacher } = await mitDb();
  const { buildWorksheet } = await import("./service");
  const { erstelleProbeschularbeit } = await import("./probeschularbeit");
  const { diagnosisSkills } = await import("./diagnose");
  const { SCHOOL_BRANCHES } = await import("./school");
  const ida = neu("Ida Testkind");
  assert.ok(listen.speichereListe({ studentId: ida, teacherId: teacher.id, title: "Unit 3", text: EIGENE_LISTE }).ok);

  const ws = await buildWorksheet({
    subject: "Englisch",
    schoolType: "Mittelschule",
    klasse: 1,
    skillIds: [EIGENE_VOKABELN],
    difficulty: "mittel",
    count: 6,
    taskType: "mixed",
    studentId: ida,
    useAI: false,
  });
  const blatt = repo.listTasks(ws.id);
  assert.equal(blatt.length, 6);
  assert.ok(blatt.every((t) => t.skillId === EIGENE_VOKABELN));
  for (const t of blatt) for (const r of richtige(t)) assert.equal(checkAnswer(t, r).correct, true, t.prompt);
  await assert.rejects(
    buildWorksheet({ subject: "Englisch", schoolType: "Mittelschule", klasse: 1, skillIds: [EIGENE_VOKABELN], difficulty: "mittel", count: 4, taskType: "mixed" }),
    /nur in einer Übung für eine Schülerin/,
  );

  const inTagen = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const testId = repo.addTest({
    student_id: ida,
    date: inTagen(9),
    subject: "Englisch",
    kind: "Schularbeit",
    topic: "",
    title: "1. Schularbeit",
    topics: ["Unit 3"],
    grade: null,
    points: null,
    max_points: null,
    notes: "",
    skill_ids: [EIGENE_VOKABELN],
    teacher_id: teacher.id,
  });
  const probe = await erstelleProbeschularbeit({ testId, teacherId: teacher.id, dauer: 25, useAI: false, seed: 4 });
  assert.equal(probe.ohneKi, 0, "alle Aufgaben kommen aus der Liste");
  const probeTasks = repo.listTasks(probe.worksheetId);
  assert.ok(probeTasks.length >= 4);
  assert.ok(probeTasks.every((t) => t.skillId === EIGENE_VOKABELN && (t.type === "mc" || t.answer.vokabel)));

  for (const b of SCHOOL_BRANCHES.filter((x) => x.schoolType !== "Volksschule").slice(0, 2))
    assert.ok(!diagnosisSkills({ subject: "Englisch", branch: b, klasse: 1, topics: [] }).some((s) => s.id === EIGENE_VOKABELN), "eine Diagnose fragt keine eigenen Listen ab");
});
