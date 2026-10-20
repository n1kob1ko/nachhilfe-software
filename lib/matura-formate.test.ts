/**
 * Matura-Formate (lib/matura-formate.ts, lib/mathe-matura.ts): 1 aus 5, 2 aus 5, Lückentext zum Ankreuzen und
 * Zuordnung. Geprüft wird die Bewertung (alles oder nichts), die eigenen Generatoren über viele Seeds, der
 * KI-Weg mit einem Transport-Ersatz (kein Schlüssel, kein Aufruf nach außen), die Schülerseite ohne Lösung und
 * das A4-Blatt. Alle Aufgaben sind eigene; alle Namen sind erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = ":memory:";
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENROUTER_API_KEY", "DEEPSEEK_API_KEY", "AI_COMPATIBLE_API_KEY", "AI_COMPATIBLE_BASE_URL", "OLLAMA_BASE_URL", "AI_PROVIDER"]) delete process.env[k];

import { CATEGORIES, mixFor, type Difficulty } from "./curriculum";
import { MATHE_MATURA_IDS, matheMaturaAufgabe, maturaStoff, stoffFehler, type MaturaArt } from "./mathe-matura";
import {
  MATURA_KATEGORIEN,
  maturaAntwortText,
  maturaFalscheAntwort,
  maturaKreuze,
  maturaKreuzeAus,
  maturaLoesung,
  maturaRichtigeAntwort,
  pruefeMatura,
  type MaturaKategorie,
} from "./matura-formate";
import { buchstabe, checkAnswer, GAP, kreisZahl, type TaskDraft } from "./tasks";

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

const DIFFS: Difficulty[] = ["sehr leicht", "leicht", "mittel", "schwer", "sehr schwer"];
const SKILL = "mathe.os.funktionen.quadratisch";
const basis = { skillId: SKILL, skillIds: [SKILL], difficulty: "mittel" as Difficulty, solution: "", hints: [] };

/** Vier kleine Aufgaben von Hand, eine je Format (eigene Inhalte). */
const EIN_AUS_FUENF: TaskDraft = {
  ...basis,
  category: "matura-1aus5",
  type: "mc",
  prompt: "Gegeben ist f mit f(x) = 2x^2 − 8.\nKreuze die zutreffende Aussage an.",
  data: { options: ["f(0) = 8", "f hat die Nullstellen −2 und 2.", "Der Graph von f ist nach unten offen.", "Der Scheitelpunkt von f ist (2 | −8).", "f hat keine Nullstelle."] },
  answer: { correct: 1 },
  errorMap: [{ answer: "0", label: "Vorzeichen von c übersehen" }],
};
const ZWEI_AUS_FUENF: TaskDraft = {
  ...basis,
  category: "matura-2aus5",
  type: "mc",
  prompt: "Gegeben ist g mit g(x) = −x^2 + 4.\nKreuze die beiden zutreffenden Aussagen an.",
  data: { options: ["g(2) = 8", "Der Graph von g ist nach unten offen.", "Der Scheitelpunkt von g ist (4 | 0).", "g(1) = 3", "g hat genau eine Nullstelle."] },
  answer: { correctAll: [1, 3] },
  errorMap: [{ answer: "2", label: "Scheitelpunkt mit Nullstelle verwechselt" }],
};
const LUECKE: TaskDraft = {
  ...basis,
  category: "matura-lueckentext",
  type: "cloze",
  prompt: `Gegeben ist h mit h(x) = 3x^2 − 12x.\nKreuze bei ① und ② jeweils den passenden Satzteil an, sodass ein richtiger Satz entsteht.\nDer Graph von h ist ${GAP} und schneidet die x-Achse ${GAP}.`,
  // derselbe Satzteil darf in beiden Lücken stehen: die Fehlerliste nennt die Lücke
  data: { gapOptions: [["nach unten offen", "nach oben offen", "eine Gerade"], ["bei x = 0 und x = −4", "bei x = 0 und x = 4", "nach oben offen"]] },
  answer: { blanks: [["nach oben offen"], ["bei x = 0 und x = 4"]], mode: "text" },
  errorMap: [
    { answer: "① nach unten offen", label: "Vorzeichen von a falsch gedeutet" },
    { answer: "② nach oben offen", label: "Öffnung statt Schnittpunkte genannt" },
    { answer: "② bei x = 0 und x = −4", label: "Vorzeichen beim Herausheben" },
  ],
};
const ZUORDNUNG: TaskDraft = {
  ...basis,
  category: "matura-zuordnung",
  type: "zuordnung",
  prompt: "Gegeben ist k mit k(x) = x^2 − 6x + 5.\nOrdne den zwei Aussagen jeweils die passende Antwort aus A bis D zu.",
  data: { zuordnung: { statements: ["der Funktionswert von k an der Stelle 0", "die x-Koordinate des Scheitelpunkts von k"], options: ["−6", "5", "−3", "3"] } },
  answer: { pairs: [1, 3] },
  errorMap: [
    { answer: "2 → C", label: "Bei x = −b/(2a) das Minus vergessen" },
    { answer: "1 → A", label: "b statt c genommen" },
  ],
};
const VIER = [EIN_AUS_FUENF, ZWEI_AUS_FUENF, LUECKE, ZUORDNUNG];

test("die vier Formate von Hand sind gültig, ihre richtigen Antworten zählen", () => {
  for (const t of VIER) {
    assert.equal(pruefeMatura(t), null, t.category!);
    assert.equal(checkAnswer(t, maturaRichtigeAntwort(t) ?? String(t.answer.correct)).correct, true, t.category!);
  }
});

test("1 aus 5: genau eine Antwort, die typischen Fehler wie bei Multiple Choice", () => {
  assert.equal(checkAnswer(EIN_AUS_FUENF, "1").correct, true);
  const r = checkAnswer(EIN_AUS_FUENF, "0");
  assert.equal(r.correct, false);
  assert.equal(r.errorLabel, "Vorzeichen von c übersehen");
});

test("2 aus 5: der Punkt nur mit beiden richtigen und keiner falschen", () => {
  const t = ZWEI_AUS_FUENF;
  assert.equal(checkAnswer(t, "[1,3]").correct, true);
  assert.equal(checkAnswer(t, "[3,1]").correct, true, "die Reihenfolge zählt nicht");
  const eine = checkAnswer(t, "[3]");
  assert.deepEqual([eine.correct, eine.feedback], [false, "Eine der zwei richtigen Antworten fehlt."]);
  const halb = checkAnswer(t, "[1,2]");
  assert.deepEqual([halb.correct, halb.feedback, halb.errorLabel], [false, "Eine Antwort stimmt, die andere nicht.", "Scheitelpunkt mit Nullstelle verwechselt"]);
  const drei = checkAnswer(t, "[0,1,3]");
  assert.equal(drei.correct, false, "beide richtigen und eine falsche: kein Punkt");
  assert.match(drei.feedback, /3 Antworten angekreuzt\. Genau zwei/);
  const alle = checkAnswer(t, "[0,1,2,3,4]");
  assert.equal(alle.correct, false, "alles ankreuzen gibt keinen Punkt");
  assert.equal(checkAnswer(t, "[]").correct, false);
  assert.equal(checkAnswer(t, "[]").feedback, "Kreuze zwei Antworten an.");
  assert.equal(checkAnswer(t, "kaputt").correct, false);
  assert.equal(checkAnswer(t, "[1,1,3]").correct, true, "doppelt geschickt ist ein Kreuz");
});

test("Lückentext zum Ankreuzen: der Punkt nur, wenn beide Lücken stimmen; die Fehlerliste nennt die Lücke", () => {
  const t = LUECKE;
  assert.equal(checkAnswer(t, JSON.stringify(["nach oben offen", "bei x = 0 und x = 4"])).correct, true);
  const zwei = checkAnswer(t, JSON.stringify(["nach oben offen", "bei x = 0 und x = −4"]));
  assert.deepEqual([zwei.correct, zwei.wrongGaps, zwei.feedback, zwei.errorLabel], [false, [2], "Lücke ② stimmt nicht.", "Vorzeichen beim Herausheben"]);
  // „nach oben offen“ ist in Lücke ① richtig, in Lücke ② falsch: das Etikett kommt von „② nach oben offen“
  const gleich = checkAnswer(t, JSON.stringify(["nach oben offen", "nach oben offen"]));
  assert.deepEqual([gleich.correct, gleich.errorLabel], [false, "Öffnung statt Schnittpunkte genannt"]);
  const beide = checkAnswer(t, JSON.stringify(["nach unten offen", "bei x = 0 und x = −4"]));
  assert.deepEqual([beide.correct, beide.wrongGaps, beide.feedback], [false, [1, 2], "Beide Lücken stimmen nicht."]);
  assert.equal(checkAnswer(t, JSON.stringify(["", ""])).feedback, "Kreuze bei jeder Lücke eine Möglichkeit an.");
  assert.equal(checkAnswer(t, JSON.stringify(["nach oben offen", ""])).feedback, "Kreuze bei Lücke ② noch eine Möglichkeit an.");
});

test("Zuordnung: der Punkt nur, wenn beide Aussagen den richtigen Buchstaben haben", () => {
  const t = ZUORDNUNG;
  assert.equal(checkAnswer(t, "[1,3]").correct, true);
  const getauscht = checkAnswer(t, "[3,1]");
  assert.deepEqual([getauscht.correct, getauscht.wrongGaps, getauscht.feedback], [false, [1, 2], "Beide Buchstaben stimmen nicht."]);
  const eine = checkAnswer(t, "[1,2]");
  assert.deepEqual([eine.correct, eine.wrongGaps, eine.feedback, eine.errorLabel], [false, [2], "Bei 2 stimmt der Buchstabe nicht.", "Bei x = −b/(2a) das Minus vergessen"]);
  const offen = checkAnswer(t, "[1,null]");
  assert.deepEqual([offen.correct, offen.feedback], [false, "Bei 2 fehlt noch ein Buchstabe."]);
  assert.equal(checkAnswer(t, "[0,3]").errorLabel, "b statt c genommen");
  assert.equal(checkAnswer(t, "[null,null]").feedback, "Wähle bei jeder Nummer einen Buchstaben.");
});

test("alte Aufgaben bleiben, wie sie waren: Multiple Choice mit einer Antwort, Lückentext zum Schreiben", () => {
  const mc: TaskDraft = { ...basis, type: "mc", prompt: "Welche Zahl ist größer?", data: { options: ["1/2", "1/3"] }, answer: { correct: 0 }, errorMap: [{ answer: "1", label: "größerer Nenner" }] };
  assert.equal(checkAnswer(mc, "0").correct, true);
  assert.deepEqual([checkAnswer(mc, "1").correct, checkAnswer(mc, "1").errorLabel], [false, "größerer Nenner"]);
  const cloze: TaskDraft = { ...basis, type: "cloze", prompt: `3 + 4 = ${GAP} und 2 · 5 = ${GAP}`, data: {}, answer: { blanks: [["7"], ["10"]], mode: "value" }, errorMap: [] };
  assert.equal(checkAnswer(cloze, '["7","10"]').feedback, "Alle Lücken richtig!");
  assert.equal(checkAnswer(cloze, '["7","11"]').feedback, "1 von 2 Lücken sind noch falsch (Lücke 2).");
  for (const t of [mc, cloze]) {
    assert.equal(pruefeMatura(t), null, "ohne Matura-Format keine Matura-Prüfung");
    assert.equal(maturaLoesung(t), null);
    assert.equal(maturaRichtigeAntwort(t), null);
  }
});

test("pruefeMatura: falsche Form wird mit einem deutschen Satz abgelehnt", () => {
  const fehler = (t: TaskDraft) => pruefeMatura(t);
  assert.match(fehler({ ...EIN_AUS_FUENF, data: { options: EIN_AUS_FUENF.data.options!.slice(0, 4) } })!, /fünf/);
  assert.match(fehler({ ...EIN_AUS_FUENF, answer: { correctAll: [0, 1] } })!, /genau eine/);
  assert.match(fehler({ ...ZWEI_AUS_FUENF, answer: { correctAll: [1] } })!, /genau zwei/);
  assert.match(fehler({ ...ZWEI_AUS_FUENF, answer: { correctAll: [0, 1, 3] } })!, /genau zwei/);
  assert.match(fehler({ ...ZWEI_AUS_FUENF, data: { options: ["0,5", "1/2", "2", "3", "4"] } })!, /gleich/, "derselbe Wert in anderer Schreibweise");
  assert.match(fehler({ ...LUECKE, data: { gapOptions: [["a", "b"], ["c", "d", "e"]] } })!, /drei Satzteile/);
  assert.match(fehler({ ...LUECKE, prompt: `Der Graph ist ${GAP}.` })!, /zwei Lücken/);
  assert.match(fehler({ ...LUECKE, answer: { blanks: [["eine Gerade"], ["gibt es nicht"]], mode: "text" } })!, /genau einer/);
  assert.match(fehler({ ...ZUORDNUNG, answer: { pairs: [1, 1] } })!, /anderen Buchstaben/);
  assert.match(fehler({ ...ZUORDNUNG, data: { zuordnung: { statements: ["a", "b"], options: ["1", "2", "3"] } } })!, /vier Antworten/);
  assert.match(fehler({ ...ZUORDNUNG, data: { zuordnung: { statements: ["a", "b", "c"], options: ["1", "2", "3", "4"] } } })!, /zwei Aussagen/);
});

test("die Lösung als Text und die Antwort des Schülers als Text (Ergebnisseite, Lösungsseite)", () => {
  assert.equal(maturaLoesung(ZWEI_AUS_FUENF), "b) Der Graph von g ist nach unten offen. · d) g(1) = 3");
  assert.equal(maturaLoesung(LUECKE), "① nach oben offen · ② bei x = 0 und x = 4");
  assert.equal(maturaLoesung(ZUORDNUNG), "1 → B (5) · 2 → D (3)");
  assert.equal(maturaAntwortText(ZWEI_AUS_FUENF, "[3]"), "d) g(1) = 3");
  assert.equal(maturaAntwortText(ZWEI_AUS_FUENF, "[]"), "nichts angekreuzt");
  assert.equal(maturaAntwortText(ZUORDNUNG, "[1,null]"), "1 → B, 2 → ?");
  assert.equal(maturaAntwortText(LUECKE, '["eine Gerade",""]'), "① eine Gerade · ② ?");
  // die Kreuze am Blatt: Lösung und Antwort in derselben Form
  assert.deepEqual(maturaKreuze(EIN_AUS_FUENF), [1]);
  assert.deepEqual(maturaKreuze(LUECKE), [1, 1]);
  assert.deepEqual(maturaKreuze(ZUORDNUNG), [1, 3]);
  assert.deepEqual(maturaKreuzeAus(EIN_AUS_FUENF, "4"), [4]);
  assert.deepEqual(maturaKreuzeAus(ZWEI_AUS_FUENF, "[4,0,9]"), [4, 0]);
  assert.deepEqual(maturaKreuzeAus(LUECKE, '["eine Gerade","weiß nicht"]'), [2, null]);
  assert.deepEqual(maturaKreuzeAus(ZUORDNUNG, "[2,null]"), [2, null]);
});

// ---------- die eigenen Generatoren ----------

test("Generatoren: jede Probe stimmt, über viele Seeds, alle Fähigkeiten, alle Arten und Schwierigkeiten", () => {
  const arten: MaturaArt[] = ["wahl", "luecke", "zuordnung"];
  let geprueft = 0;
  for (const id of MATHE_MATURA_IDS) {
    for (const art of arten) {
      let brauchbar = 0;
      for (let seed = 0; seed < 250; seed++) {
        // roh, ohne Auswahl: jeder Stoff, den ein Generator baut, muss jede Probe bestehen
        const s = maturaStoff(id, art, DIFFS[seed % DIFFS.length], mulberry32(seed * 7 + 1));
        if (!s) continue;
        brauchbar++;
        assert.equal(stoffFehler(art, s as never), null, `${id} ${art} Seed ${seed}`);
      }
      geprueft += brauchbar;
      assert.ok(brauchbar >= 150, `${id} ${art}: nur ${brauchbar} von 250 Versuchen brauchbar`);
    }
  }
  assert.ok(geprueft > 10_000, `${geprueft} Stoffe geprüft`);
});

test("Generatoren: jede Aufgabe ist gültig, die richtige Antwort zählt, jede falsche nicht, typische Fehler mit Etikett", () => {
  assert.ok(MATHE_MATURA_IDS.length >= 10 && MATHE_MATURA_IDS.length <= 15, `${MATHE_MATURA_IDS.length} Fähigkeiten`);
  assert.ok(MATHE_MATURA_IDS.every((id) => id.startsWith("mathe.os.")), "Oberstufe");
  for (const id of MATHE_MATURA_IDS) {
    for (const k of MATURA_KATEGORIEN) {
      const texte = new Set<string>();
      const plaetze = new Set<string>();
      for (let seed = 0; seed < 30; seed++) {
        const t = matheMaturaAufgabe(id, k, DIFFS[seed % DIFFS.length], mulberry32(seed + 1000));
        const wo = `${id} ${k} Seed ${seed}`;
        assert.ok(t, wo);
        assert.equal(t.category, k, wo);
        assert.equal(pruefeMatura(t), null, wo);
        assert.equal(checkAnswer(t, maturaRichtigeAntwort(t) ?? String(t.answer.correct)).correct, true, `${wo}: die richtige Antwort`);
        if (k !== "matura-1aus5") assert.equal(checkAnswer(t, maturaFalscheAntwort(t)!).correct, false, `${wo}: eine falsche Antwort`);
        // jede typische falsche Antwort gibt keinen Punkt, und das Etikett kommt zurück
        for (const e of t.errorMap) {
          const antwort = falschMit(t, e.answer);
          const r = checkAnswer(t, antwort);
          assert.equal(r.correct, false, `${wo}: ${e.answer}`);
          assert.equal(r.errorLabel, e.label, `${wo}: Etikett zu ${e.answer}`);
        }
        // alle Antworten der 2 aus 5: genau zwei Aussagen sind wahr (Proben), die anderen drei falsch
        if (k === "matura-2aus5") assert.equal(t.answer.correctAll!.length, 2, wo);
        const alles = [t.prompt, ...(t.data.options ?? []), ...(t.data.gapOptions?.flat() ?? []), ...(t.data.zuordnung ? [...t.data.zuordnung.statements, ...t.data.zuordnung.options] : []), t.solution, ...t.hints, ...t.errorMap.map((e) => e.label)].join("\n");
        assert.ok(!/—| – /.test(alles), `${wo}: Gedankenstrich`);
        assert.ok(!/NaN|undefined|Infinity|null/.test(alles), `${wo}: kaputte Zahl`);
        assert.ok(t.hints.length >= 1 && t.solution.trim(), `${wo}: Hilfen und Lösungsweg`);
        // der erste Satz nennt keine Variable, die in der Aufgabe gar nicht vorkommt
        const variablen = t.prompt.match(/^(\w) und (\w) sind /);
        const gezeigt = [t.prompt.slice(t.prompt.indexOf("\n")), ...(t.data.options ?? []), ...(t.data.gapOptions?.flat() ?? []), ...(t.data.zuordnung ? [...t.data.zuordnung.statements, ...t.data.zuordnung.options] : [])].join("\n");
        for (const v of variablen?.slice(1) ?? []) assert.match(gezeigt, new RegExp(`\\b${v}\\b`), `${wo}: ${v} kommt nicht vor`);
        texte.add(JSON.stringify([t.prompt, t.data]));
        plaetze.add(JSON.stringify(maturaKreuze(t)));
      }
      assert.ok(texte.size >= 15, `${id} ${k}: nur ${texte.size} verschiedene Aufgaben in 30 Versuchen`);
      assert.ok(plaetze.size >= 2, `${id} ${k}: die richtige Antwort steht immer an derselben Stelle`);
    }
  }
});

/** Die Antwort des Solvers mit einem typischen Fehler aus der Fehlerliste. */
function falschMit(t: TaskDraft, fehler: string): string {
  if (t.answer.correctAll) return JSON.stringify([t.answer.correctAll[0], Number(fehler)]);
  if (t.type === "zuordnung") {
    const m = fehler.match(/^(\d) → ([A-D])$/)!;
    return JSON.stringify(t.answer.pairs!.map((p, i) => (i === Number(m[1]) - 1 ? m[2].charCodeAt(0) - 65 : p)));
  }
  if (t.data.gapOptions) {
    const i = fehler.startsWith(kreisZahl(1)) ? 0 : 1;
    return JSON.stringify(t.answer.blanks!.map((b, j) => (j === i ? fehler.slice(2) : b[0])));
  }
  return fehler;
}

test("Gemischt heißt für diese Fähigkeiten die vier Matura-Formate, für andere bleibt es, wie es war", async () => {
  const { THEMEN } = await import("./themen");
  for (const id of MATHE_MATURA_IDS) assert.deepEqual(mixFor("Mathematik", id), [...MATURA_KATEGORIEN], id);
  // keine andere Fähigkeit bekommt Matura-Formate, für die es keinen Generator gibt
  for (const s of THEMEN.filter((x) => x.subject === "Mathematik")) {
    if (mixFor("Mathematik", s.id).some((k) => k.startsWith("matura-"))) assert.ok(MATHE_MATURA_IDS.includes(s.id), s.id);
  }
  assert.ok(!mixFor("Mathematik", "mathe.os.funktionen.quadratisch-aufstellen").includes("matura-1aus5"));
  // die bisherigen Aufgabentypen sind alle noch da
  const keys = CATEGORIES.Mathematik.map((c) => c.key);
  for (const k of ["rechnung", "textaufgabe", "mc", "lueckentext", "rechenweg", "sachaufgabe", "fehler", "ordnen", "offen", ...MATURA_KATEGORIEN]) assert.ok(keys.includes(k), k);
});

// ---------- Builder ----------

test("Builder: leere Matura-Aufgaben, Prüfung vor dem Senden, ohne KI der richtige Typ oder ein Hinweis", async () => {
  const builder = await import("./builder");
  for (const k of MATURA_KATEGORIEN) {
    const leer = builder.blankTask("mc", SKILL, k, "mittel");
    assert.ok(builder.checkTask(leer), `${k}: eine leere Aufgabe geht nicht hinaus`);
  }
  assert.deepEqual(builder.blankTask("mc", SKILL, "matura-2aus5", "mittel").answer, { correctAll: [0, 1] });
  assert.equal(builder.blankTask("mc", SKILL, "matura-zuordnung", "mittel").type, "zuordnung");
  for (const t of VIER) {
    assert.equal(builder.checkTask(t), null, t.category!);
    assert.deepEqual(builder.normalizeTask(t).answer, t.answer, `${t.category}: das Speichern ändert die Lösung nicht`);
  }

  const settings = { studentId: null, subject: "Mathematik", schoolType: "Gymnasium", klasse: 6, difficulty: "mittel" as const, focus: "", useAI: false, title: "" };
  const passt = await builder.generateTasks({ ...settings, skillIds: [SKILL, "mathe.os.log.regeln"], count: 8, categories: [...MATURA_KATEGORIEN] }, null);
  assert.equal(passt.typFehlt, undefined);
  assert.equal(passt.tasks.length, 8);
  for (const t of passt.tasks) {
    assert.ok(MATURA_KATEGORIEN.includes(t.category as MaturaKategorie), t.category!);
    assert.equal(pruefeMatura(t), null, t.prompt);
    assert.equal(builder.checkTask(t), null, t.prompt);
  }
  assert.deepEqual(new Set(passt.tasks.map((t) => t.category)), new Set(MATURA_KATEGORIEN), "jedes Format kommt vor");
  // gemischt: die vier Formate
  const gemischt = await builder.generateTasks({ ...settings, skillIds: ["mathe.os.diff.potenzregel"], count: 4, categories: [] }, null);
  assert.deepEqual(gemischt.tasks.map((t) => t.category).sort(), [...MATURA_KATEGORIEN].sort());
  // eine Fähigkeit ohne Matura-Generator: 2 aus 5, Lückentext und Zuordnung gibt es nicht, das wird gezählt
  const fremd = await builder.generateTasks({ ...settings, skillIds: ["mathe.brueche.kuerzen"], schoolType: "Mittelschule", klasse: 2, count: 3, categories: ["matura-2aus5", "matura-zuordnung", "matura-lueckentext"] }, null);
  assert.equal(fremd.typFehlt, 3);
  assert.equal(fremd.aiError, undefined, "kein KI-Fehler: die KI war nicht gefragt");
  // 1 aus 5 aus einer Rechnung, wenn sich fünf verschiedene Antworten bauen lassen; sonst gezählt
  const eins = await builder.generateTasks({ ...settings, skillIds: ["mathe.brueche.kuerzen"], schoolType: "Mittelschule", klasse: 2, count: 4, categories: ["matura-1aus5"] }, null);
  const als1aus5 = eins.tasks.filter((t) => t.category === "matura-1aus5");
  for (const t of als1aus5) assert.equal(pruefeMatura(t), null, t.prompt);
  assert.equal(eins.typFehlt ?? 0, 4 - als1aus5.length);
  // ein anderer Typ für eine Matura-Fähigkeit: 1 aus 5, gezählt
  const rechnung = await builder.generateTasks({ ...settings, skillIds: [SKILL], count: 2, categories: ["rechnung"] }, null);
  assert.equal(rechnung.typFehlt, 2);
  assert.ok(rechnung.tasks.every((t) => t.category === "matura-1aus5"));
});

test("Schnellrunde und Probeschularbeit: Matura-Formate passen nicht in die Schnellrunde und geben einen Punkt", async () => {
  const { categoriesFitQuickRound, quickRoundProblem } = await import("./quick-round");
  const { standardPunkte } = await import("./probeschularbeit-regeln");
  const mathe = CATEGORIES.Mathematik;
  for (const k of MATURA_KATEGORIEN) assert.equal(categoriesFitQuickRound(mathe.filter((c) => c.key === k)), false, k);
  assert.equal(categoriesFitQuickRound(mathe.filter((c) => c.key === "mc")), true, "Multiple Choice bleibt möglich");
  assert.match(quickRoundProblem([{ type: "mc", data: { options: ["a", "b", "c", "d"] }, answer: { correctAll: [0, 1] } }])!, /zwei richtige Antworten/);
  assert.match(quickRoundProblem([{ type: "mc", options: ["a", "b", "c", "d"], pick: 2 }])!, /zwei richtige Antworten/, "auch in der Form der Schülerseite");
  assert.match(quickRoundProblem([EIN_AUS_FUENF])!, /höchstens vier/);
  assert.match(quickRoundProblem([ZUORDNUNG])!, /kein Multiple Choice/);
  for (const t of VIER) assert.equal(standardPunkte({ ...t, difficulty: "schwer" }), 1, t.category!);
  assert.equal(standardPunkte({ difficulty: "schwer", type: "mc", data: {} }), 4, "andere Aufgaben wie bisher");
});

test("Tafel: Lücken ① ②, Satzteile, Aussagen und Antworten A bis D; die Lösung nie am Schülergerät", async () => {
  const repo = await import("./repo");
  const { boardTask, boardTaskForStudent } = await import("./whiteboard-content");
  const wid = repo.createWorksheet({ title: "Tafel Matura", subject: "Mathematik", grade: 10, school_type: "Gymnasium", klasse: 6, topic: "", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [SKILL] }, VIER);
  const [, zwei, luecke, zuordnung] = repo.listTasks(wid);
  const l = boardTask(luecke);
  assert.match(l.prompt, /Der Graph von h ist ① und schneidet die x-Achse ②\./);
  assert.match(l.prompt, /① {2}nach unten offen {2}· {2}nach oben offen/);
  assert.match(l.solution!, /^Lösung: ① nach oben offen/);
  const z = boardTask(zuordnung);
  assert.deepEqual(z.options, ZUORDNUNG.data.zuordnung!.options);
  assert.match(z.prompt, /1 {2}der Funktionswert von k an der Stelle 0/);
  assert.deepEqual(boardTask(zwei).options, ZWEI_AUS_FUENF.data.options);
  for (const t of [zwei, luecke, zuordnung]) assert.equal("solution" in boardTaskForStudent(t), false);
});

// ---------- KI, mit einem Transport-Ersatz ----------

const KI = {
  topic: "Quadratische Funktionen", difficulty: "mittel", passage: null, options: null, correct_option: null, accepted_answers: null, numeric: false, blanks: null, sample_answer: null, steps: null,
  case_sensitive: null, faulty_text: null, corrected_text: null, text_errors: null, answer_lines: null, math_start: null, variable: null, result_unit: null, result_form: null, round_to: null, parts: null,
  criteria: ["richtig angekreuzt"], solution: "Siehe Rechnung.", solution_steps: [], estimated_time_sec: 120, hints: ["Denk an das Vorzeichen von a."], common_errors: [] as { answer: string; label: string }[],
};
/** Gültige KI-Aufgaben je Format (eigene Inhalte, nachgerechnet). */
const KI_GUT: Record<MaturaKategorie, Record<string, unknown>> = {
  "matura-1aus5": {
    ...KI, category: "matura-1aus5", format: "mc", skill_ids: [SKILL], prompt: "Gegeben ist f mit f(x) = 2x^2 − 8.\nKreuze die zutreffende Aussage an.",
    options: ["f hat die Nullstellen −2 und 2.", "Der Graph von f ist nach unten offen.", "f(0) = 8", "Der Scheitelpunkt von f ist (2 | −8).", "f hat keine Nullstelle."], correct_option: 0,
    common_errors: [{ answer: "2", label: "Vorzeichen von c übersehen" }, { answer: "1", label: "Vorzeichen von a falsch gedeutet" }],
  },
  "matura-2aus5": {
    ...KI, category: "matura-2aus5", format: "mc", skill_ids: [SKILL], prompt: "Gegeben ist g mit g(x) = −x^2 + 4.",
    options: ["Der Graph von g ist nach unten offen.", "g(1) = 3", "g(2) = 8", "Der Scheitelpunkt von g ist (4 | 0).", "g hat genau eine Nullstelle."], correct_options: [0, 1],
    common_errors: [{ answer: "3", label: "Scheitelpunkt mit Nullstelle verwechselt" }, { answer: "0", label: "ist richtig und darf kein Fehler sein" }],
  },
  "matura-lueckentext": {
    ...KI, category: "matura-lueckentext", format: "cloze", skill_ids: [SKILL], prompt: `Gegeben ist h mit h(x) = 3x^2 − 12x.\nDer Graph von h ist ${GAP} und schneidet die x-Achse ${GAP}.`,
    gap_options: [["nach oben offen", "nach unten offen", "eine Gerade"], ["bei x = 0 und x = 4", "nur bei x = 4", "bei x = 0 und x = −4"]], gap_correct: [0, 0],
    common_errors: [{ answer: "② bei x = 0 und x = −4", label: "Vorzeichen beim Herausheben" }, { answer: "nach unten offen", label: "Vorzeichen von a falsch gedeutet" }],
  },
  "matura-zuordnung": {
    ...KI, category: "matura-zuordnung", format: "zuordnung", skill_ids: [SKILL], prompt: "Gegeben ist k mit k(x) = x^2 − 6x + 5.\nOrdne den zwei Aussagen jeweils die passende Antwort aus A bis D zu.",
    statements: ["der Funktionswert von k an der Stelle 0", "die x-Koordinate des Scheitelpunkts von k"], options: ["5", "3", "−3", "−6"], pairs: [0, 1],
    common_errors: [{ answer: "2 → C", label: "Bei x = −b/(2a) das Minus vergessen" }, { answer: "1 → D", label: "b statt c genommen" }],
  },
};

test("KI: gültige Matura-Aufgaben werden übernommen, gemischt, die Lösung und die typischen Fehler gehen mit", async () => {
  const { aiTaskToDraft } = await import("./ai");
  const cats = CATEGORIES.Mathematik;
  const req = { subject: "Mathematik", skills: [{ id: SKILL, name: "Quadratische Funktionen", area: "Funktionen", difficulty: "mittel" as Difficulty }], categories: cats };
  const stellen = new Set<string>();
  for (const k of MATURA_KATEGORIEN) {
    for (let seed = 1; seed <= 12; seed++) {
      const roh = KI_GUT[k] as never;
      const d = aiTaskToDraft(roh, req, mulberry32(seed), cats.find((c) => c.key === k))!;
      assert.ok(d, `${k} Seed ${seed}`);
      assert.equal(d.category, k);
      assert.equal(d.sourceType, "ki");
      assert.equal(pruefeMatura(d), null, k);
      assert.equal(checkAnswer(d, maturaRichtigeAntwort(d) ?? String(d.answer.correct)).correct, true, `${k}: die richtige Antwort nach dem Mischen`);
      assert.match(d.prompt, /Kreuze|Ordne/, `${k}: der Arbeitsauftrag steht dabei`);
      stellen.add(`${k}${JSON.stringify(maturaKreuze(d))}`);
      for (const e of d.errorMap) {
        const r = checkAnswer(d, falschMit(d, e.answer));
        assert.deepEqual([r.correct, r.errorLabel], [false, e.label], `${k}: ${e.answer}`);
      }
      if (k === "matura-1aus5") {
        assert.equal(d.data.options![d.answer.correct!], "f hat die Nullstellen −2 und 2.");
        assert.equal(d.errorMap.length, 2);
      }
      if (k === "matura-2aus5") {
        assert.deepEqual(d.answer.correctAll!.map((i) => d.data.options![i]).sort(), ["Der Graph von g ist nach unten offen.", "g(1) = 3"]);
        assert.deepEqual(d.errorMap.map((e) => e.label), ["Scheitelpunkt mit Nullstelle verwechselt"], "ein Fehler, der auf eine richtige Antwort zeigt, fällt weg");
        assert.match(d.prompt, /Kreuze die beiden zutreffenden Aussagen an\.$/);
      }
      if (k === "matura-lueckentext") {
        assert.deepEqual(d.answer.blanks, [["nach oben offen"], ["bei x = 0 und x = 4"]]);
        assert.deepEqual(d.errorMap.map((e) => e.answer).sort(), ["① nach unten offen", "② bei x = 0 und x = −4"]);
        assert.ok(d.prompt.indexOf("Kreuze bei ①") < d.prompt.indexOf(GAP), "der Auftrag steht vor dem Satz mit den Lücken");
      }
      if (k === "matura-zuordnung") {
        const z = d.data.zuordnung!;
        assert.deepEqual(d.answer.pairs!.map((p) => z.options[p]), ["5", "3"]);
        assert.equal(z.options[d.errorMap.find((e) => e.label.startsWith("Bei x"))!.answer.slice(-1).charCodeAt(0) - 65], "−3");
      }
    }
  }
  assert.ok(stellen.size >= 8, "die Antworten werden gemischt");
});

test("KI: Matura-Aufgaben in falscher Form fallen weg, mit Grund", async () => {
  const { aiTaskToDraft } = await import("./ai");
  const cats = CATEGORIES.Mathematik;
  const req = { subject: "Mathematik", skills: [{ id: SKILL, name: "Quadratische Funktionen", area: "Funktionen", difficulty: "mittel" as Difficulty }], categories: cats };
  const gut = KI_GUT;
  const kaputt: [MaturaKategorie, Record<string, unknown>, RegExp][] = [
    ["matura-1aus5", { ...gut["matura-1aus5"], options: ["a", "b", "c", "d"] }, /4 statt 5 Antworten/],
    ["matura-1aus5", { ...gut["matura-1aus5"], correct_option: null, correct_options: [0, 3] }, /mehr als eine richtige/],
    ["matura-1aus5", { ...gut["matura-1aus5"], correct_option: 7 }, /richtige Antworten/],
    ["matura-2aus5", { ...gut["matura-2aus5"], correct_options: [0, 1, 2] }, /3 statt 2 richtige/],
    ["matura-2aus5", { ...gut["matura-2aus5"], correct_options: [1], correct_option: 1 }, /1 statt 2 richtige/],
    ["matura-2aus5", { ...gut["matura-2aus5"], options: ["0,5", "1/2", "2", "3", "4"] }, /gleich/],
    ["matura-2aus5", { ...gut["matura-2aus5"], options: ["a", "b", "c", "d", "e", "f"] }, /6 statt 5/],
    ["matura-lueckentext", { ...gut["matura-lueckentext"], gap_options: [["a", "b"], ["c", "d", "e"]] }, /genau 3 Satzteile/],
    ["matura-lueckentext", { ...gut["matura-lueckentext"], prompt: `Der Graph ist ${GAP}, ${GAP} und ${GAP}.` }, /3 statt 2 Lücken/],
    ["matura-lueckentext", { ...gut["matura-lueckentext"], gap_correct: null, blanks: null }, /richtige Satzteil fehlt/],
    ["matura-lueckentext", { ...gut["matura-lueckentext"], gap_options: [["offen", "offen", "eine Gerade"], ["x", "y", "z"]] }, /gleich/],
    ["matura-zuordnung", { ...gut["matura-zuordnung"], options: ["5", "3", "−3"] }, /3 statt 4 Antworten/],
    ["matura-zuordnung", { ...gut["matura-zuordnung"], statements: ["a", "b", "c"], pairs: [0, 1, 2] }, /3 statt 2 Aussagen/],
    ["matura-zuordnung", { ...gut["matura-zuordnung"], pairs: [1, 1] }, /pairs/],
    ["matura-zuordnung", { ...gut["matura-zuordnung"], pairs: null }, /pairs/],
    ["matura-zuordnung", { ...gut["matura-zuordnung"], options: ["5", "5,0", "−3", "−6"] }, /gleich/],
  ];
  for (const [k, roh, grund] of kaputt) {
    const gruende: string[] = [];
    const d = aiTaskToDraft(roh as never, req, mulberry32(1), cats.find((c) => c.key === k), (r) => gruende.push(r));
    assert.equal(d, null, `${k}: ${JSON.stringify(roh).slice(0, 120)}`);
    assert.match(gruende.join("; "), grund, k);
  }
  // eine Zuordnung gibt es nur als Matura-Format; eine 2-aus-5-Aufgabe passt nicht in einen gewöhnlichen Multiple-Choice-Platz
  assert.equal(aiTaskToDraft({ ...gut["matura-zuordnung"], category: "mc" } as never, req, mulberry32(1), cats.find((c) => c.key === "mc")), null);
  assert.equal(aiTaskToDraft({ ...gut["matura-2aus5"], category: "mc" } as never, req, mulberry32(1), cats.find((c) => c.key === "mc")), null);
});

test("KI im Builder: die Regeln der Matura-Formate nur, wenn eines verlangt ist; ungültige Aufgaben macht der Generator", async () => {
  const router = await import("./ai/router");
  const { buildPrompt } = await import("./ai");
  const builder = await import("./builder");
  const gefragt: string[] = [];
  router.resetRouter();
  router.setTransport(async (req) => {
    const prompt = typeof req.content === "string" ? req.content : "";
    gefragt.push(prompt);
    const plan = [...prompt.matchAll(/^\d+\. category=(\S+?)[ ,].*skill_id=(\S+)/gm)].map((m) => m[1] as MaturaKategorie);
    // 2 aus 5 kommt immer mit drei richtigen Antworten: diese Aufgabe darf nie übernommen werden
    const tasks = plan.map((k) => (k === "matura-2aus5" ? { ...KI_GUT[k], correct_options: [0, 1, 2], prompt: "KAPUTT: drei richtige" } : KI_GUT[k]));
    return { parsed: { tasks }, refusal: false, model: req.model, usage: { input: 2_000, output: 800, cacheWrite: 0, cacheRead: 0, reasoning: 0 } };
  });
  try {
    const out = await builder.generateTasks(
      { studentId: null, subject: "Mathematik", schoolType: "Gymnasium", klasse: 6, skillIds: [SKILL], difficulty: "mittel", count: 4, categories: [...MATURA_KATEGORIEN], focus: "", useAI: true, title: "" },
      null,
    );
    assert.ok(gefragt.length >= 1);
    assert.match(gefragt[0], /Matura-Formate/);
    assert.match(gefragt[0], /Übernimm nichts aus dem Aufgabenpool, aus früheren Maturen, aus Schulbüchern oder vom IQS/);
    assert.match(gefragt[0], /category=matura-zuordnung/);
    assert.equal(out.source, "ki");
    assert.equal(out.tasks.length, 4);
    for (const t of out.tasks) {
      assert.equal(pruefeMatura(t), null, t.prompt);
      assert.ok(!t.prompt.includes("KAPUTT"), "die ungültige KI-Aufgabe ist nicht dabei");
    }
    const zwei = out.tasks.find((t) => t.category === "matura-2aus5")!;
    assert.notEqual(zwei.sourceType, "ki", "2 aus 5 kommt vom eigenen Generator");
    assert.equal(zwei.answer.correctAll!.length, 2);
    assert.equal(out.tasks.filter((t) => t.sourceType === "ki").length, 3);
    assert.match(out.aiError ?? "", /1 Aufgabe kam von der KI nicht im gewünschten Typ/);
  } finally {
    router.setTransport(null);
  }
  // ohne Matura-Format keine Matura-Regeln im Auftrag an die KI
  const ohne = buildPrompt({ subject: "Mathematik", level: "6. Klasse", skills: [{ id: SKILL, name: "Quadratische Funktionen", area: "Funktionen", difficulty: "mittel" }], count: 2, categories: CATEGORIES.Mathematik.filter((c) => c.key === "mc") });
  assert.ok(!ohne.includes("Matura-Formate"));
});

// ---------- Schülerseite ----------

test("Schülerseite: Antworten, Satzteile und Aussagen ohne Lösung; am Gerät bewertet wie oben", async () => {
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const { clientTasks } = await import("./solver-tasks");
  const { submitAnswer } = await import("./service");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Testkind Matura", grade: 10, klasse: 6, teacher_id: niko.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  const generiert = MATURA_KATEGORIEN.map((k, i) => matheMaturaAufgabe("mathe.os.wahrscheinlichkeit.binomial-bereiche", k, "mittel", mulberry32(40 + i))!);
  const tasks = [...VIER, ...generiert];
  const wid = repo.createWorksheet({ title: "Matura üben", subject: "Mathematik", grade: 10, school_type: "Gymnasium", klasse: 6, topic: "", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [SKILL] }, tasks);
  const aid = repo.assignWorksheet(wid, sid);
  const sicht = () => clientTasks(repo.getAssignment(aid)!);
  const view = sicht();
  const json = JSON.stringify(view);
  for (const geheim of ['"correctAll"', '"pairs"', '"correct"', '"answer"', '"errorMap"']) assert.ok(!json.includes(geheim), `Schülerseite enthält ${geheim}`);
  const [eins, zwei, luecke, zuordnung] = view;
  assert.deepEqual([eins.options?.length, eins.pick], [5, null]);
  assert.deepEqual([zwei.options?.length, zwei.pick], [5, 2]);
  assert.deepEqual([luecke.blanks, luecke.gapOptions], [2, LUECKE.data.gapOptions]);
  assert.equal(luecke.released, null);
  assert.deepEqual([zuordnung.options, zuordnung.zuordnung], [null, ZUORDNUNG.data.zuordnung]);
  for (const c of view) assert.equal(c.released, null);

  const student = repo.getStudent(sid)!;
  const gespeichert = repo.listTasks(wid);
  const antworte = (i: number, answer: string) =>
    submitAnswer({ token: student.access_token, assignmentId: aid, taskId: gespeichert[i].id, answer, timeMs: 30_000, activeMs: 30_000, hintsUsed: 0, giveUp: false });
  const falsch = await antworte(1, "[1]");
  assert.deepEqual([falsch.correct, falsch.final], [false, false]);
  assert.match(falsch.feedback, /^Eine der zwei richtigen Antworten fehlt\./);
  for (const [i, t] of tasks.entries()) {
    const r = await antworte(i, maturaRichtigeAntwort(t) ?? String(t.answer.correct));
    assert.equal(r.correct, true, `${t.category}: ${t.prompt}`);
  }
  const danach = sicht();
  assert.ok(danach.every((c) => c.finished?.correct === true));
  assert.ok(!JSON.stringify(danach).includes('"correctAll"') && !JSON.stringify(danach).includes('"pairs"'));
  // die Ergebnisseite zeigt die Antwort lesbar
  const versuche = repo.listAttemptsForAssignment(aid).filter((a) => a.task_id === gespeichert[1].id);
  assert.deepEqual(versuche.map((a) => maturaAntwortText(gespeichert[1], a.answer)), ["b) Der Graph von g ist nach unten offen.", "b) Der Graph von g ist nach unten offen. · d) g(1) = 3"]);

  // freigegebene Lösungen: die Lösung als Text (components/TaskPreview.tsx answerText)
  const { answerText } = await import("../components/TaskPreview");
  assert.equal(answerText(ZWEI_AUS_FUENF), maturaLoesung(ZWEI_AUS_FUENF));
  assert.equal(answerText(ZUORDNUNG), "1 → B (5) · 2 → D (3)");
  assert.equal(answerText(EIN_AUS_FUENF), "b) f hat die Nullstellen −2 und 2.");
});

// ---------- A4 ----------

test("A4: Kästchen wie auf dem Maturablatt; die Lösung nur in der Lehrerfassung und auf der Lösungsseite", async () => {
  const { buildSheet, DEFAULTS, planTask } = await import("./arbeitsblatt");
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  for (const t of VIER) {
    const plan = planTask(t, "Mathematik", DEFAULTS);
    assert.deepEqual([plan.lines, plan.answerLabel, plan.optionColumns], [0, null, 1], t.category!);
  }
  const doc = buildSheet({ title: "Matura üben", subject: "Mathematik", klasseLabel: "6. Klasse", topic: "Quadratische Funktionen", studentName: null, tasks: VIER }, () => "Quadratische Funktionen", DEFAULTS);
  const render = (o: Partial<typeof DEFAULTS>) => renderToStaticMarkup(createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Matura üben", ...o } }));
  const zahl = (html: string, s: string) => html.split(s).length - 1;

  const schueler = render({});
  assert.equal(zahl(schueler, '<table class="ab-matura'), 1 + 1 + 2 + 2, "1 aus 5, 2 aus 5, zwei Tabellen beim Lückentext, zwei bei der Zuordnung");
  assert.equal(zahl(schueler, 'class="ab-box"'), 5 + 5 + 3 + 3, "ein Kästchen je Antwort und Satzteil");
  assert.equal(zahl(schueler, 'class="ab-matura-buchstabe"'), 2, "ein Kästchen für den Buchstaben je Aussage");
  assert.ok(schueler.includes('class="ab-gap-nr">①</span>') && schueler.includes('class="ab-gap-nr">②</span>'), "die Lücken heißen ① ②");
  assert.ok(!schueler.includes("✕"), "nichts angekreuzt");
  for (const geheim of ["Lösung", "Typische Fehler", "Vorzeichen von c übersehen", "1 → B"]) assert.ok(!schueler.includes(geheim), `Schülerblatt enthält ${geheim}`);
  for (const b of ["A", "B", "C", "D"]) assert.ok(schueler.includes(`<th scope="row">${b}</th>`), b);

  const lehrer = render({ solutions: "lehrer", fassung: "lehrer" });
  assert.equal(zahl(lehrer, ">✕</span>"), 1 + 2 + 2, "die richtigen Kreuze");
  assert.ok(lehrer.includes(`class="ab-matura-buchstabe">${buchstabe(1)}</span>`) && lehrer.includes(`class="ab-matura-buchstabe">${buchstabe(3)}</span>`), "die Buchstaben der Zuordnung");
  assert.ok(lehrer.includes("Typische Fehler") && lehrer.includes("Vorzeichen beim Herausheben"));

  const seite = render({ solutions: "seite" });
  assert.ok(seite.includes("Lösungen"));
  assert.ok(seite.includes("① nach oben offen · ② bei x = 0 und x = 4"));
  assert.ok(seite.includes("1 → B (5) · 2 → D (3)"));
  assert.ok(!seite.slice(0, seite.indexOf("ab-solutions")).includes("✕"), "auf dem Blatt selbst bleibt alles leer");
});

test("Mappe: die Kreuze des Schülers wie auf dem Blatt, bei Fehlern die richtigen daneben", async () => {
  const { leseAntwort } = await import("./mappe");
  const { MaturaAntworten } = await import("../components/arbeitsblatt/Sheet");
  assert.deepEqual(leseAntwort(ZWEI_AUS_FUENF, "[1,2]"), { art: "kreuze", kreuze: [1, 2] });
  assert.deepEqual(leseAntwort(EIN_AUS_FUENF, "3"), { art: "kreuze", kreuze: [3] });
  assert.deepEqual(leseAntwort(LUECKE, '["nach oben offen","bei x = 0 und x = −4"]'), { art: "kreuze", kreuze: [1, 0] });
  assert.deepEqual(leseAntwort(ZUORDNUNG, "[3,1]"), { art: "kreuze", kreuze: [3, 1] });
  const html = (t: TaskDraft, kreuze: (number | null)[], loesung: boolean) => renderToStaticMarkup(createElement(MaturaAntworten, { task: t, kreuze, richtig: loesung ? maturaKreuze(t) : null }));
  const zwei = html(ZWEI_AUS_FUENF, [1, 2], true);
  assert.equal(zwei.split(">✕</span>").length - 1, 2);
  assert.equal(zwei.split("← richtig").length - 1, 1, "die fehlende richtige Antwort steht daneben");
  assert.ok(!html(ZWEI_AUS_FUENF, [1, 2], false).includes("← richtig"), "ohne Lösung nur die Kreuze");
  const z = html(ZUORDNUNG, [3, 1], true);
  assert.ok(z.includes("← richtig: B") && z.includes("← richtig: D"));
  assert.equal(html(LUECKE, [1, 0], true).split("← richtig").length - 1, 1);
});
