/**
 * Prüft die Deutsch-Satzlehre ohne KI (lib/deutsch-satzlehre.ts): Satzglieder, Objekte, adverbiale
 * Bestimmungen, Fälle, Zeitformen, Futur, Plusquamperfekt, Aktiv und Passiv und die Satzzeichen der direkten
 * Rede. Jede Fähigkeit in jeder Stufe und jedem Format, mit vielen Startwerten: Die gespeicherten Lösungen
 * gelten in jeder erlaubten Schreibung (auch mit geraden Anführungszeichen und »…«), jede falsche Option und
 * jeder typische Fehler wird abgelehnt, mit seinem Etikett. Auf einem Blatt steht keine Aufgabe doppelt, kein
 * Satz ist kaputt, und was die Fähigkeit nicht hat, sagt der Builder ehrlich.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CURRICULUM, DIFFICULTIES, categoriesFor, type Difficulty, type TaskType } from "./curriculum";
import { DEUTSCH_SATZLEHRE_IDS, deutschAufgabe, deutschFormate, type DeutschFormat } from "./deutsch-satzlehre";
import { aufgabenSchluessel } from "./figur";
import { checkFix } from "./fix-text";
import { correctionTask, generateBuiltIn, generateForSlot, hasBuiltInGenerator } from "./generators";
import { STUFE } from "./schulbuch-zahlen";
import { checkAnswer, gapCount, GAP, normalizeText, sameAnswer, type TaskDraft } from "./tasks";

const SEEDS = 20;
/** The five levels and „leicht bis mittel“ of older exercises. */
const STUFEN: Difficulty[] = [...DIFFICULTIES, "leicht bis mittel"];
const RD = "deutsch.beistrich.direkte-rede";
const PASSIV = "deutsch.grammatik.aktiv-passiv";
/** The skills and whether they have "Fehler korrigieren" (Satzglieder and Adverbiale only determine). */
const MIT_FIX: Record<string, boolean> = {
  "deutsch.satz.satzglieder": false,
  "deutsch.satz.objekte": true,
  "deutsch.satz.adverbiale": false,
  "deutsch.grammatik.faelle": true,
  "deutsch.grammatik.zeiten": true,
  "deutsch.grammatik.futur": true,
  "deutsch.grammatik.plusquamperfekt": true,
  [PASSIV]: true,
  [RD]: true,
};

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

type Eintrag = { id: string; d: Difficulty; f: DeutschFormat; t: TaskDraft };
/** Every task of every skill, level and format, SEEDS times. */
const ALLE: Eintrag[] = [];
for (const id of DEUTSCH_SATZLEHRE_IDS)
  for (const d of STUFEN)
    for (const f of deutschFormate(id))
      for (let s = 0; s < SEEDS; s++) {
        const t = deutschAufgabe(id, f, d, mulberry32(s * 7919 + d.length * 31 + f.length));
        assert.ok(t, `${id} ${d} ${f}: keine Aufgabe`);
        ALLE.push({ id, d, f, t });
      }

const wo = (x: Eintrag) => `${x.id} [${x.d}, ${x.f}] ${x.t.prompt.replace(/\n/g, " / ")}${x.t.data.faulty ? ` ⟨${x.t.data.faulty}⟩` : ""}`;
/** The right answers of a task as checkAnswer takes them: every alternative of every gap, every accepted text. */
function richtige(t: TaskDraft): string[] {
  if (t.type === "mc") return [String(t.answer.correct)];
  if (t.answer.blanks) {
    const erste = t.answer.blanks.map((b) => b[0]);
    return t.answer.blanks.flatMap((b, i) => b.map((alt) => JSON.stringify(erste.map((x, j) => (j === i ? alt : x)))));
  }
  return t.answer.accepted ?? [];
}
/** An answer in the form of the task: gap texts as a JSON list, with every gap changed by `f`. */
const alsAntwort = (t: TaskDraft, given: string, f: (s: string) => string) => (t.answer.blanks ? JSON.stringify((JSON.parse(given) as string[]).map(f)) : f(given));
/** What a wrong answer of the errorMap looks like when it is sent. */
const gesendet = (t: TaskDraft, e: { answer: string }) => (t.type === "mc" ? e.answer : t.answer.blanks ? JSON.stringify(e.answer.split(" | ")) : e.answer);

// ---------- writing an answer in another way ----------
/** Every task: more spaces count the same. */
const LEERZEICHEN: [string, (s: string) => string][] = [["Leerzeichen", (s) => `  ${s.replace(/ /g, "  ")} `]];
/** Direkte Rede: „…“, "…" and »…« count the same, so do spaces before a punctuation mark. */
const ZEICHEN: [string, (s: string) => string][] = [
  ["gerade Anführungszeichen", (s) => s.replace(/[„“”»«]/g, '"')],
  ["»…«", (s) => s.replace(/„/g, "»").replace(/[“”]/g, "«")],
  ["Leerzeichen vor Satzzeichen", (s) => s.replace(/([,.:!?])/g, " $1")],
];
const variantenVon = (x: Eintrag) => [...LEERZEICHEN, ...(x.id === RD ? ZEICHEN : [])];

test("die Fähigkeiten sind echte Fähigkeiten des Lehrplans, haben eine eingebaute Quelle und ihre Formate", () => {
  assert.deepEqual([...DEUTSCH_SATZLEHRE_IDS].sort(), Object.keys(MIT_FIX).sort());
  for (const id of DEUTSCH_SATZLEHRE_IDS) {
    const skill = CURRICULUM.find((s) => s.id === id);
    assert.ok(skill, `${id} steht nicht im Lehrplan`);
    assert.equal(skill.subject, "Deutsch");
    assert.equal(hasBuiltInGenerator(id), true, `${id}: „Aufgaben nur mit KI“`);
    assert.deepEqual(deutschFormate(id), ["cloze", "mc", "kurz", ...(MIT_FIX[id] ? ["fix"] : [])], id);
    assert.equal(correctionTask(id, "mittel", mulberry32(5))?.type ?? null, MIT_FIX[id] ? "fix" : null, `${id}: Fehler korrigieren`);
  }
  assert.equal(deutschAufgabe("deutsch.grammatik.praeteritum", "cloze", "mittel", mulberry32(1)), null, "Präteritum bleibt bei seinen Banken");
});

test("jede Aufgabe hat das Format, das sie verspricht, und ihre Texte sind ganz", () => {
  const TYP: Record<DeutschFormat, TaskType> = { cloze: "cloze", mc: "mc", fix: "fix", kurz: "grammar" };
  const kaputt = /[{}]|undefined|null|NaN| {2}| [,.?!:]|\.\.|—| – /;
  for (const x of ALLE) {
    const { t } = x;
    assert.equal(t.type, TYP[x.f], wo(x));
    assert.equal(t.skillId, x.id, wo(x));
    assert.equal(t.difficulty, x.d, wo(x));
    const zeilen = t.prompt.split("\n");
    assert.ok(zeilen.every((z) => z.trim() && !kaputt.test(z)), `kaputte Aufgabe: ${wo(x)}`);
    if (t.type !== "fix") assert.ok(zeilen.length >= 2, `Auftrag und Satz: ${wo(x)}`);
    assert.ok(t.solution.trim() && !t.solution.includes(GAP) && !kaputt.test(t.solution), `Lösung: ${wo(x)} → ${t.solution}`);
    assert.ok(t.hints.length >= 2 && t.hints.every((h) => h.trim() && !kaputt.test(h)), `Hilfen: ${wo(x)}`);
    for (const e of t.errorMap) assert.ok(e.label.trim() && !/—| – /.test(e.label), `Fehler-Etikett: ${e.label}`);
    assert.equal(t.answer.contractions, undefined, `keine englischen Kurzformen: ${wo(x)}`);
    // only the direkte Rede checks every punctuation mark ("Fehler korrigieren" compares them anyway)
    assert.equal(t.answer.satzzeichen, x.id === RD && (t.type === "cloze" || t.type === "grammar") ? true : undefined, wo(x));
    if (t.type === "cloze") {
      assert.equal(t.answer.mode, "text", wo(x));
      assert.equal(gapCount(t.prompt), t.answer.blanks!.length, `Lücken: ${wo(x)}`);
      assert.ok(t.answer.blanks!.every((b) => b.length && b.every((a) => a.trim())), wo(x));
    }
    if (t.type === "mc") {
      const o = t.data.options!;
      assert.ok(o.length >= 3 && o.length <= 4, `3 bis 4 Optionen: ${wo(x)}`);
      assert.equal(new Set(o.map((a) => (x.id === RD ? a.replace(/[„“"]/g, '"') : normalizeText(a)))).size, o.length, `doppelte Option: ${wo(x)} ${o.join(" / ")}`);
      assert.ok(o.every((a) => a.trim() && !kaputt.test(a)), wo(x));
      assert.ok(t.answer.correct! >= 0 && t.answer.correct! < o.length, wo(x));
    }
    if (t.type === "fix") {
      const n = x.d === "sehr leicht" || x.d === "leicht" || x.d === "leicht bis mittel" ? 1 : x.d === "mittel" ? 2 : 3;
      assert.equal(t.answer.mode, "exact", wo(x));
      assert.equal(t.answer.criteria![0], n === 1 ? "Der Fehler ist verbessert." : `Alle ${n} Fehler sind verbessert.`, `Anzahl der Sätze: ${wo(x)}`);
      assert.equal(t.solution.split("\n").filter((z) => z.startsWith("→")).length, n, wo(x));
      assert.ok(!kaputt.test(t.data.faulty!), wo(x));
      // every text starts with a capital letter (or the opening quotation mark) and ends with a punctuation mark
      for (const satz of [t.data.faulty!, ...t.answer.accepted!]) assert.match(satz, /^[„A-ZÄÖÜ].*[.?!“]$/u, wo(x));
      assert.ok(t.answer.fixes!.length >= n && t.answer.fixes!.every((f) => f.label.trim()), `jeder Fehler hat ein Etikett: ${wo(x)}`);
    }
    if (t.type === "grammar") {
      assert.equal(t.answer.mode, "text", wo(x));
      assert.ok(t.answer.accepted!.length && t.answer.accepted!.every((a) => a.trim()), wo(x));
    }
  }
});

test("die gespeicherte Lösung gilt als richtig, jede falsche Option und jeder typische Fehler als falsch, mit Etikett", () => {
  for (const x of ALLE) {
    const { t } = x;
    for (const r of richtige(t)) assert.equal(checkAnswer(t, r).correct, true, `richtige Antwort ${r} abgelehnt: ${wo(x)}`);
    if (t.type === "mc") {
      t.data.options!.forEach((_, i) => {
        if (i === t.answer.correct) return;
        const r = checkAnswer(t, String(i));
        assert.equal(r.correct, false, wo(x));
        assert.ok(r.errorLabel, `Option ${t.data.options![i]} ohne Etikett: ${wo(x)}`);
      });
    }
    for (const e of t.errorMap) {
      const given = gesendet(t, e);
      const r = checkAnswer(t, given);
      assert.equal(r.correct, false, `Fehler „${e.answer}“ gilt als richtig: ${wo(x)}`);
      assert.equal(r.errorLabel, e.label, `Etikett von „${e.answer}“: ${wo(x)}`);
      // also with other quotation marks or more spaces: still wrong, with the same label
      if (t.type !== "mc")
        for (const [name, v] of variantenVon(x)) {
          const anders = checkAnswer(t, alsAntwort(t, given, v));
          assert.equal(anders.correct, false, `Fehler „${e.answer}“ als ${name} richtig: ${wo(x)}`);
          assert.equal(anders.errorLabel, e.label, `Etikett von „${e.answer}“ als ${name}: ${wo(x)}`);
        }
    }
    if (t.type === "fix") {
      // every right version counts; the text as it is is wrong, with the label of one of its errors
      for (const a of t.answer.accepted!) assert.equal(checkAnswer(t, a).correct, true, `${a}: ${wo(x)}`);
      const r = checkAnswer(t, t.data.faulty!);
      assert.equal(r.correct, false, wo(x));
      assert.ok(r.errorLabel && t.answer.fixes!.some((f) => f.label === r.errorLabel), `kein Etikett für den Fehlertext: ${wo(x)}`);
      assert.equal(r.errorType, "grammatik", wo(x));
      // every error of the text that is left as it is gets its label
      const offen = checkFix(t.data.faulty!, t.answer.accepted!, t.data.faulty!, { caseSensitive: true, labels: t.answer.fixes });
      assert.ok(offen.missed.length >= 1 && offen.missed.every((m) => m.label), `Fehler ohne Etikett: ${wo(x)} ${JSON.stringify(offen.missed)}`);
    }
  }
});

test("jede richtige Antwort gilt in jeder erlaubten Schreibung: Anführungszeichen „…“, \"…\" und »…«, Leerzeichen, Groß- und Kleinschreibung", () => {
  let zeichen = 0;
  for (const x of ALLE) {
    const { t } = x;
    if (t.type === "mc") continue;
    for (const r of richtige(t)) {
      for (const [name, v] of variantenVon(x)) {
        const given = alsAntwort(t, r, v);
        if (x.id === RD && given !== r) zeichen++;
        assert.equal(checkAnswer(t, given).correct, true, `${name}: ${given} abgelehnt: ${wo(x)}`);
      }
      // upper and lower case count only in "Fehler korrigieren"
      if (t.type !== "fix") {
        assert.equal(checkAnswer(t, alsAntwort(t, r, (s) => s.charAt(0).toUpperCase() + s.slice(1))).correct, true, wo(x));
        assert.equal(checkAnswer(t, alsAntwort(t, r, (s) => s.toLowerCase())).correct, true, wo(x));
      }
    }
  }
  assert.ok(zeichen > 500, `genug Antworten der direkten Rede in anderer Schreibung (${zeichen})`);
});

test("direkte Rede: jedes Satzzeichen zählt, die Art der Anführungszeichen und Leerzeichen nicht", () => {
  const richtig = "„Komm schnell her!“, rief Lena.";
  const gleich = ['"Komm schnell her!", rief Lena.', "»Komm schnell her!«, rief Lena.", "„Komm schnell her!“ , rief Lena.", "  „Komm  schnell her!“,rief Lena. ", "„komm schnell her!“, rief lena."];
  for (const g of gleich) assert.equal(sameAnswer(g, richtig, "text", false, true), true, g);
  const falsch = [
    "„Komm schnell her!“ rief Lena.", // Beistrich vergessen
    "„Komm schnell her“, rief Lena.", // Rufzeichen vergessen
    "„Komm schnell her!“, rief Lena", // Punkt am Ende vergessen
    "„Komm schnell her!,“ rief Lena.", // Beistrich vor dem Anführungszeichen
    "Komm schnell her!“, rief Lena.", // Anführungszeichen vergessen
    "„Komm schnell her.“, rief Lena.", // Punkt der Rede
    "„Komm schnell her!“. rief Lena.",
  ];
  for (const g of falsch) assert.equal(sameAnswer(g, richtig, "text", false, true), false, g);
  // "exact": upper and lower case count
  assert.equal(sameAnswer("„komm schnell her!“, rief Lena.", richtig, "exact", false, true), false);
  // without the flag the old comparison stays (the full stop at the end does not count there)
  assert.equal(sameAnswer("„Komm schnell her!“, rief Lena", richtig, "text"), true);
  // a gap of the direkte Rede
  assert.equal(sameAnswer(': "', ": „", "text", false, true), true);
  assert.equal(sameAnswer('",', "“,", "text", false, true), true);
  assert.equal(sameAnswer(",“", "“,", "text", false, true), false);
  assert.equal(sameAnswer("“", "“,", "text", false, true), false);
});

// ---------- sitzen, schwimmen: „sein“ (in Österreich) and „haben“ ----------
const SEIN_HABEN: [string, string][] = [
  ["bin", "habe"],
  ["bist", "hast"],
  ["ist", "hat"],
  ["sind", "haben"],
  ["seid", "habt"],
  ["war", "hatte"],
  ["warst", "hattest"],
  ["waren", "hatten"],
  ["wart", "hattet"],
  ["sein", "haben"],
];
const SEIN = `\\b(${SEIN_HABEN.map(([s]) => s).join("|")})\\b`;
const HABEN = `\\b(${SEIN_HABEN.map(([, h]) => h).join("|")})\\b`;
const hat = (s: string, muster: string) => new RegExp(muster).test(s);
/** The same answer with the other auxiliary: „ist … gesessen“ ↔ „hat … gesessen“ („haben“ can be „sind“ or „sein“). */
function andereHilfe(s: string): string[] {
  if (hat(s, SEIN)) return [s.replace(new RegExp(SEIN, "g"), (w) => SEIN_HABEN.find(([x]) => x === w)![1])];
  return ["sind", "sein"].map((statt) => s.replace(new RegExp(HABEN, "g"), (w) => (w === "haben" ? statt : SEIN_HABEN.find(([, h]) => h === w)![0])));
}
const BEIDE = /\b(gesessen|geschwommen)\b/;

test("sitzen und schwimmen: „sein“ und „haben“ gelten beide, nie als Fehler", () => {
  let n = 0;
  for (const x of ALLE) {
    const { t } = x;
    if (t.type === "mc") {
      const r = t.data.options![t.answer.correct!];
      if (!BEIDE.test(r)) continue;
      n++;
      const anders = andereHilfe(r);
      assert.ok(t.data.options!.every((o) => !anders.includes(o)), `das andere Hilfsverb als falsche Option: ${wo(x)}`);
      continue;
    }
    // a text of several sentences may have other verbs with only one auxiliary
    if (t.type === "fix" && !t.answer.criteria![0].startsWith("Der Fehler")) continue;
    for (const r of richtige(t)) {
      if (!BEIDE.test(r) || !(hat(r, SEIN) || hat(r, HABEN))) continue;
      n++;
      assert.ok(
        andereHilfe(r).some((a) => checkAnswer(t, a).correct),
        `das andere Hilfsverb gilt nicht: ${andereHilfe(r).join(" / ")}: ${wo(x)}`,
      );
    }
  }
  assert.ok(n > 30, `genug Aufgaben mit sitzen oder schwimmen (${n})`);
});

test("Passiv: „durch“ nur bei Feuerwehr, Polizei, Sturm und Hagel; wer etwas selbst tut, steht mit „von“", () => {
  const URSACHE = /Feuerwehr|Polizei|Sturm|Hagel/;
  const DURCH: [RegExp, string][] = [
    [/von der Feuerwehr/, "durch die Feuerwehr"],
    [/von der Polizei/, "durch die Polizei"],
    [/vom Sturm|von dem Sturm/, "durch den Sturm"],
    [/vom Hagel|von dem Hagel/, "durch den Hagel"],
  ];
  let ursache = 0;
  let person = 0;
  for (const x of ALLE.filter((x) => x.id === PASSIV)) {
    const { t } = x;
    const alles = [t.prompt, ...(t.data.options ?? []), ...richtige(t), t.data.faulty ?? ""].join(" ");
    // a right answer with „durch“ only for a cause or an institution
    const rechts = t.type === "mc" ? [t.data.options![t.answer.correct!]] : richtige(t);
    for (const r of rechts) if (/\bdurch\b/i.test(r)) assert.match(alles, URSACHE, `„durch“ bei einer Person: ${r}: ${wo(x)}`);
    if (t.type !== "grammar") continue;
    const auftrag = t.prompt.split("\n")[0];
    if (URSACHE.test(t.prompt)) {
      // both are right: „von der Feuerwehr“ and „durch die Feuerwehr“
      for (const r of t.answer.accepted!)
        for (const [von, durch] of DURCH)
          if (von.test(r)) {
            ursache++;
            assert.equal(checkAnswer(t, r.replace(von, durch)).correct, true, `${r.replace(von, durch)}: ${wo(x)}`);
          }
    } else {
      const e = t.errorMap.find((e) => /\bdurch\b/.test(e.answer));
      assert.ok(e, `kein Fehler mit „durch“: ${wo(x)}`);
      assert.equal(e.label, "Wer etwas selbst tut, schließt du im Passiv mit „von“ an");
      assert.equal(checkAnswer(t, e.answer).errorLabel, e.label);
      person++;
    }
    // the doer: required only when the task says so
    const ohne = t.answer.accepted!.filter((a) => !/\b(von|vom|durch)\b/i.test(a));
    if (auftrag.includes("von wem")) {
      assert.equal(ohne.length, 0, wo(x));
      assert.ok(t.errorMap.some((e) => e.label === "Der Täter fehlt: Nenne ihn mit „von“"), wo(x));
    } else assert.ok(ohne.length > 0, `ohne Täter muss auch gelten: ${wo(x)}`);
  }
  assert.ok(ursache > 10 && person > 30, `${ursache} mit Ursache, ${person} mit Person`);
  // Perfekt: „worden“, never „geworden“
  for (const x of ALLE.filter((x) => x.id === PASSIV && x.t.type !== "mc"))
    for (const r of richtige(x.t)) assert.ok(!/\bgeworden\b/.test(r), `${r}: ${wo(x)}`);
});

test("Umstellprobe: der Satz in der alten Reihenfolge gilt nicht, jede Antwort beginnt mit dem verlangten Satzglied", () => {
  const woerter = (s: string) => s.toLowerCase().replace(/[.?!]/g, "").split(/\s+/).sort().join(" ");
  let n = 0;
  for (const x of ALLE.filter((x) => x.id === "deutsch.satz.satzglieder" && x.f === "kurz")) {
    const [auftrag, vorlage] = x.t.prompt.split("\n");
    const m = auftrag.match(/^Mach die Umstellprobe\. Beginne mit „(.+)“\.$/);
    if (!m) continue;
    n++;
    assert.equal(checkAnswer(x.t, vorlage).correct, false, `die alte Reihenfolge gilt: ${wo(x)}`);
    for (const a of x.t.answer.accepted!) {
      assert.ok(a.startsWith(m[1]), `${a}: ${wo(x)}`);
      assert.equal(woerter(a), woerter(vorlage), `andere Wörter: ${a}: ${wo(x)}`);
    }
  }
  assert.ok(n > 20, `genug Umstellproben (${n})`);
});

test("die Stufen: unten leichtere Muster, oben mehr Sätze und schwerere Formen", () => {
  const st = (d: Difficulty) => STUFE[d];
  const leicht = (d: Difficulty) => d === "sehr leicht" || d === "leicht" || d === "leicht bis mittel";
  // the task and what is right (a wrong option may be another tense: „wurde“ in a task in the Präsens)
  const text = (t: TaskDraft) => [t.prompt, t.solution, ...(t.type === "mc" ? [t.data.options![t.answer.correct!]] : richtige(t)), t.data.faulty ?? ""].join(" ");
  for (const x of ALLE) {
    // Passiv: „sehr leicht“ only Präsens; the Perfekt („worden“) from „mittel“ on
    if (x.id === PASSIV && x.d === "sehr leicht") assert.ok(!/\b(wurde|wurden|worden)\b/.test(text(x.t)), wo(x));
    if (x.id === PASSIV && leicht(x.d)) assert.ok(!/\bworden\b/.test(text(x.t)), wo(x));
    // Futur II from „mittel“ on
    if (x.id === "deutsch.grammatik.futur" && leicht(x.d)) assert.ok(!/Futur II/.test(text(x.t)), wo(x));
    // direkte Rede: „sehr leicht“ only with the Begleitsatz in front; in the middle from „schwer“ on
    if (x.id === RD && x.d === "sehr leicht") assert.match(x.t.solution.split("\n")[0], /^\p{Lu}\p{L}+ \p{L}+: „/u, wo(x));
    if (x.id === RD && st(x.d) < st("schwer")) assert.ok(!/“, \p{L}+ \p{L}+, „/u.test(text(x.t)), wo(x));
  }
  // Satzglieder: longer sentences on the higher levels
  const laenge = (d: Difficulty) => {
    const l = ALLE.filter((x) => x.id === "deutsch.satz.satzglieder" && x.f === "kurz" && x.d === d).map((x) => x.t.prompt.split("\n")[1].split(" ").length);
    return l.reduce((a, b) => a + b, 0) / l.length;
  };
  assert.ok(laenge("sehr leicht") < laenge("sehr schwer"), `${laenge("sehr leicht")} < ${laenge("sehr schwer")}`);
});

test("auf einem Blatt steht keine Aufgabe doppelt", () => {
  for (const id of DEUTSCH_SATZLEHRE_IDS) {
    const skill = CURRICULUM.find((s) => s.id === id)!;
    for (const difficulty of ["sehr leicht", "leicht bis mittel", "mittel", "sehr schwer"] as Difficulty[])
      for (const taskType of ["mixed", "mc", "cloze", "grammar", "fix", "calc"] as const) {
        const tasks = generateBuiltIn({ subject: "Deutsch", skills: [{ id, name: skill.name }], difficulty, count: 10, taskType, seed: 4242 });
        assert.equal(tasks.length, 10, `${id} ${difficulty} ${taskType}`);
        const keys = tasks.map(aufgabenSchluessel);
        assert.equal(new Set(keys).size, 10, `${id} ${difficulty} ${taskType}: doppelt ${keys.find((k, i) => keys.indexOf(k) !== i)}`);
        assert.ok(tasks.every((t) => t.type !== "free"), `${id} ${taskType}: keine Erklärungsaufgabe`);
        if (taskType === "mc" || taskType === "cloze" || (taskType === "fix" && MIT_FIX[id])) assert.ok(tasks.every((t) => t.type === taskType), `${id} ${taskType}`);
        for (const t of tasks) assert.equal(checkAnswer(t, richtige(t)[0]).correct, true, `${id} ${taskType}`);
      }
  }
  // ein Blatt mit drei Fähigkeiten, wie im Browser geprüft
  const drei = generateBuiltIn({
    subject: "Deutsch",
    skills: [
      { id: "deutsch.satz.satzglieder", name: "Satzglieder" },
      { id: PASSIV, name: "Aktiv und Passiv" },
      { id: RD, name: "Direkte Rede" },
    ],
    difficulty: "leicht bis mittel",
    count: 18,
    taskType: "mixed",
    seed: 7,
  });
  assert.equal(new Set(drei.map(aufgabenSchluessel)).size, 18);
  assert.deepEqual(new Set(drei.map((t) => t.skillId)), new Set(["deutsch.satz.satzglieder", PASSIV, RD]));
});

test("Builder: jeder Aufgabentyp; was die Fähigkeit nicht hat, kommt ehrlich als anderer Typ", () => {
  const typen = categoriesFor("Deutsch").filter((c) => !["offen", "schreiben", "textverstaendnis", "auswendig"].includes(c.key));
  for (const id of DEUTSCH_SATZLEHRE_IDS) {
    for (const c of typen) {
      for (const difficulty of ["sehr leicht", "leicht bis mittel", "schwer"] as Difficulty[]) {
        const t = generateForSlot({ skillId: id, skillName: id, difficulty, category: c.key, subject: "Deutsch" }, mulberry32(11));
        assert.equal(t.skillId, id);
        assert.equal(t.difficulty, difficulty);
        if (t.category === c.key) assert.ok(c.formats.includes(t.type), `${id} ${c.key}: Format ${t.type}`);
        else if (c.key === "korrigieren") assert.deepEqual([MIT_FIX[id], t.type], [false, "free"], `${id}: ohne Fehler korrigieren eine freie Antwort`);
        else if (c.key === "satz") assert.deepEqual([MIT_FIX[id], t.category, t.type], [false, "grammatik", "grammar"], `${id}: ohne Satz verbessern eine Kurzantwort`);
        else assert.deepEqual([t.category, t.type], ["lueckentext", "cloze"], `${id} ${c.key}: statt dessen ${t.category}`);
        if (t.type !== "free") assert.equal(checkAnswer(t, richtige(t)[0]).correct, true, `${id} ${c.key}`);
        for (const e of t.errorMap) assert.equal(checkAnswer(t, gesendet(t, e)).correct, false, `${id} ${c.key}: ${e.answer}`);
      }
    }
    // Lückentext, Multiple Choice und Grammatik gibt es für jede Fähigkeit, Fehler korrigieren und Satz verbessern für die mit Fehlersätzen
    for (const k of ["lueckentext", "grammatik", "fehler", ...(MIT_FIX[id] ? ["korrigieren", "satz"] : [])])
      assert.equal(generateForSlot({ skillId: id, skillName: id, difficulty: "mittel", category: k, subject: "Deutsch" }, mulberry32(3)).category, k, `${id} ${k}`);
  }
  // Zeitformen: der Satz zum Verbessern sagt, in welcher Zeitform er stehen soll
  for (let s = 0; s < 10; s++) {
    const t = generateForSlot({ skillId: "deutsch.grammatik.zeiten", skillName: "Zeitformen", difficulty: "mittel", category: "satz", subject: "Deutsch" }, mulberry32(s));
    assert.match(t.prompt, /^Der Satz soll im (Präteritum|Perfekt|Futur I) stehen\./);
  }
  // direkte Rede unter „Rechtschreibung“: die Satzzeichen als Lückentext
  assert.equal(generateForSlot({ skillId: RD, skillName: "Direkte Rede", difficulty: "mittel", category: "rechtschreibung", subject: "Deutsch" }, mulberry32(4)).category, "rechtschreibung");
  // Teilfähigkeiten ohne eigene Muster nehmen die ihrer Fähigkeit
  const teil = generateForSlot({ skillId: "deutsch.satz.objekte.eigene", skillName: "Eigene", generatorSkillId: "deutsch.satz.objekte", difficulty: "leicht", category: "lueckentext", subject: "Deutsch" }, mulberry32(2));
  assert.equal(teil.type, "cloze");
  assert.deepEqual(teil.skillIds, ["deutsch.satz.objekte.eigene", "deutsch.satz.objekte"]);
});

test("Fehler korrigieren: Ergebnis und Etikett genau wie checkFix, auch mit geraden Anführungszeichen", () => {
  for (const id of DEUTSCH_SATZLEHRE_IDS.filter((id) => MIT_FIX[id])) {
    for (let s = 0; s < 10; s++) {
      const t = correctionTask(id, "schwer", mulberry32(s))!;
      const gerade = t.answer.accepted![0].replace(/[„“]/g, '"');
      for (const given of [t.data.faulty!, t.answer.accepted![0], `${t.answer.accepted![0]} `, t.answer.accepted![0].replace(/\.$/, ""), gerade]) {
        const r = checkAnswer(t, given);
        const f = checkFix(t.data.faulty!, t.answer.accepted!, given, { caseSensitive: true, labels: t.answer.fixes });
        assert.equal(r.correct, f.correct, `${id}: ${given}`);
        assert.equal(r.errorLabel, f.missed[0]?.label || null, `${id}: ${given}`);
      }
      assert.equal(checkAnswer(t, gerade).correct, true, `${id}: ${gerade}`);
    }
  }
});

test("auf dem Blatt des Schülers: gerade Anführungszeichen gelten, ein Fehler bekommt sein Etikett", async () => {
  process.env.DATABASE_PATH = ":memory:";
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const { buildWorksheet, submitAnswer } = await import("./service");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Rede Test", grade: 6, klasse: 2, teacher_id: niko.id, school: "", school_type: "Mittelschule", subjects: ["Deutsch"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const student = repo.getStudent(sid)!;
  let n = 0;
  for (const taskType of ["cloze", "grammar", "fix"] as const) {
    const { id: wid, source } = await buildWorksheet({ subject: "Deutsch", schoolType: "Mittelschule", klasse: 2, skillIds: [RD], difficulty: "mittel", count: 4, taskType, useAI: false });
    assert.equal(source, "generator");
    const aid = repo.assignWorksheet(wid, sid);
    for (const t of repo.listTasks(wid)) {
      if (t.type !== "fix") assert.equal(t.answer.satzzeichen, true, "das Kennzeichen bleibt beim Speichern");
      const richtig = t.answer.blanks ? JSON.stringify(t.answer.blanks.map((b) => b[0])) : t.answer.accepted![0];
      const gerade = alsAntwort(t, richtig, (s) => s.replace(/[„“]/g, '"'));
      if (gerade === richtig) continue;
      n++;
      const r = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: gerade, timeMs: 10_000, hintsUsed: 0, submissionId: `rede-${String(t.id).padStart(12, "0")}` });
      assert.equal(r.correct, true, `${gerade} für ${richtig}`);
    }
  }
  assert.ok(n >= 6, `genug Antworten mit geraden Anführungszeichen (${n})`);
  // ein falscher Lückentext: falsch, mit dem Etikett des Fehlers
  const { id: wid } = await buildWorksheet({ subject: "Deutsch", schoolType: "Mittelschule", klasse: 2, skillIds: [RD], difficulty: "mittel", count: 2, taskType: "cloze", useAI: false });
  const aid = repo.assignWorksheet(wid, sid);
  const t = repo.listTasks(wid)[0];
  const e = t.errorMap[0];
  const r = await submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer: JSON.stringify(e.answer.split(" | ").map((s) => s.replace(/[„“]/g, '"'))), timeMs: 10_000, hintsUsed: 0, submissionId: `rede-falsch-${String(t.id).padStart(8, "0")}` });
  assert.equal(r.correct, false);
  assert.equal(repo.listAttemptsForAssignment(aid).find((a) => a.task_id === t.id)?.error_label, e.label);
});

test("Schule und Hausübung nur bei Kindern, nie bei „unsere Nachbarn“ oder „meine Eltern“", () => {
  const erwachsene = /\b(unsere Nachbarn|meine Eltern)\b/i;
  const schule = /Schul|Hausübung|Turnbeutel/;
  let geprueft = 0;
  for (const x of ALLE) {
    for (const satz of `${x.t.prompt}\n${x.t.data.faulty ?? ""}`.split(/(?<=[.?!])\s+|\n/)) {
      if (!schule.test(satz)) continue;
      geprueft++;
      assert.ok(!erwachsene.test(satz), `${satz}: ${wo(x)}`);
    }
    // „Als Lena nach Hause kam, waren sie schon nach Hause gelaufen“: nie zweimal „nach Hause“
    assert.ok(!/nach Hause kam, [^.]*nach Hause/.test(x.t.prompt), wo(x));
  }
  assert.ok(geprueft > 100, `genug Sätze mit Schule (${geprueft})`);
});

test("Builder ohne KI: fehlt der gewählte Typ, ist das ein Hinweis zum Typ und kein KI-Fehler", async () => {
  process.env.DATABASE_PATH = ":memory:";
  const builder = await import("./builder");
  const out = await builder.generateTasks(
    { studentId: null, subject: "Deutsch", schoolType: "Mittelschule", klasse: 3, skillIds: ["deutsch.satz.satzglieder"], difficulty: "mittel", count: 3, categories: ["korrigieren"], focus: "", useAI: false, title: "" },
    null,
  );
  assert.equal(out.aiError, undefined, "die KI war gar nicht gefragt");
  assert.equal(out.typFehlt, 3);
  const passt = await builder.generateTasks(
    { studentId: null, subject: "Deutsch", schoolType: "Mittelschule", klasse: 3, skillIds: ["deutsch.satz.objekte"], difficulty: "mittel", count: 3, categories: ["korrigieren"], focus: "", useAI: false, title: "" },
    null,
  );
  assert.deepEqual([passt.aiError, passt.typFehlt], [undefined, undefined]);
});
