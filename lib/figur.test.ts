/**
 * Aufgaben mit Bild (lib/figur.ts, lib/generators-figur.ts): richtig gebaut für viele Seeds (die gespeicherte
 * Antwort passt zum gezeichneten Bild, die App nimmt sie an, typische Fehler werden erkannt), jedes Bild wird
 * gezeichnet, die Schülerseite bekommt nie die Lösung, Blatt und Tafel zeigen das Bild.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

import type { Difficulty } from "./curriculum";
import { aufgabenSchluessel, bruchWert, figurBeschreibung, figurSvg, figurSzene, geradenText, leseFigur, wertBei, zahl, zahlBei, type Figur, type Flaeche, type Koordinaten, type Punkt2, type Zahlenstrahl } from "./figur";
import { FIGUR_FAEHIGKEITEN, figurAufgabe, figurFaehigkeit, type FigurFormat } from "./generators-figur";
import { checkOwnSolution } from "./math-task";
import { checkAnswer, gapCount, parseNumber, type TaskDraft } from "./tasks";

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

const DIFFS: Difficulty[] = ["sehr leicht", "leicht", "mittel", "schwer"];
const FORMATS: FigurFormat[] = ["calc", "mc", "cloze", "rechenweg", "sachaufgabe"];
const SEEDS = 40;

/** Alle Aufgaben mit Bild: jede Fähigkeit, jedes Format, das sie hat, jede Stufe, viele Seeds. */
function* alle(): Generator<{ skill: string; format: FigurFormat; diff: Difficulty; seed: number; t: TaskDraft }> {
  for (const skill of Object.keys(FIGUR_FAEHIGKEITEN))
    for (const format of FIGUR_FAEHIGKEITEN[skill].formate)
      for (const diff of DIFFS)
        for (let seed = 1; seed <= SEEDS; seed++) {
          const t = figurAufgabe(skill, diff, format, mulberry32(seed * 7919 + diff.length));
          assert.ok(t, `${skill} ${format} ${diff}: keine Aufgabe`);
          yield { skill, format, diff, seed, t };
        }
}

/** Eine Zahl aus einer Antwort mit oder ohne Einheit („24 cm²“, „−3/4“, „2 1/4“, „5 300 000“). */
const zahlAus = (s: string) => parseNumber(s.replace(/\s*(?:mm|cm|dm|km|m)(?:²|2)?$/, ""));
const nahe = (a: number | null, b: number, eps = 1e-6) => a !== null && Math.abs(a - b) <= eps;

// ---------- Geometrie aus dem gezeichneten Bild ----------
const kante = (f: Flaeche, i: number) => {
  const a = f.ecken[i];
  const b = f.ecken[(i + 1) % f.ecken.length];
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
};
const laenge = (a: Punkt2, b: Punkt2) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const flaeche = (f: Flaeche) => Math.abs(f.ecken.reduce((s, p, i) => s + p[0] * f.ecken[(i + 1) % f.ecken.length][1] - f.ecken[(i + 1) % f.ecken.length][0] * p[1], 0)) / 2;
const umfang = (f: Flaeche) => f.ecken.reduce((s, _, i) => s + kante(f, i), 0);
/** Längen, die als Zahl beschriftet sind („a = 6 cm“, „8 cm“), müssen zur Zeichnung passen. */
function beschriftungStimmt(f: Flaeche, wo: string) {
  for (const s of f.seiten) {
    const m = s.text.match(/(\d+(?:,\d+)?) (?:cm|m)$/);
    if (m) assert.ok(nahe(Number(m[1].replace(",", ".")), kante(f, s.von), 0.051), `${wo}: Seite „${s.text}“ ist ${kante(f, s.von)} lang`);
  }
  for (const st of f.strecken ?? []) {
    const m = st.text?.match(/(\d+(?:,\d+)?) (?:cm|m)$/);
    if (m) assert.ok(nahe(Number(m[1].replace(",", ".")), laenge(st.von, st.bis), 0.051), `${wo}: Strecke „${st.text}“`);
  }
  const innen = f.innen?.text.match(/^([Au]) = (\d+(?:,\d+)?) /);
  if (innen) assert.ok(nahe(Number(innen[2].replace(",", ".")), innen[1] === "A" ? flaeche(f) : umfang(f), 1e-6), `${wo}: innen „${f.innen!.text}“`);
}

/** Die Zahlen, die die Aufgabe als richtig speichert, in der Reihenfolge der Fragen. */
function antworten(t: TaskDraft): (number | null)[] {
  if (t.type === "mc") return [zahlAus(t.data.options![t.answer.correct!])];
  if (t.type === "cloze") return t.answer.blanks!.map((b) => zahlAus(b[0]));
  if (t.type === "sachaufgabe") return (t.answer.parts ?? []).map((p) => zahlAus(p.accepted?.[0] ?? ""));
  return [zahlAus(t.answer.accepted![0])];
}

const markeWert = (f: Zahlenstrahl, name: string) => bruchWert(wertBei(f, f.marken.find((m) => m.name === name)!.bei));
const punkt = (f: Koordinaten, name: string) => f.punkte.find((p) => p.name === name)!;

/** Was das Bild als Antwort zeigt, unabhängig vom Generator aus Bild und Frage berechnet. */
function ausDemBild(t: TaskDraft, wo: string): void {
  const f = leseFigur(t.data.figure) as Figur;
  assert.ok(f, `${wo}: Bild nicht lesbar`);
  const got = antworten(t);
  const gleich = (soll: number[], eps = 1e-6) => soll.forEach((v, i) => assert.ok(nahe(got[i], v, eps), `${wo}: Antwort ${i + 1} ist ${got[i]}, im Bild ${v}`));

  if (f.art === "zahlenstrahl") {
    if (f.intervall) {
      const iv = f.intervall;
      const a = iv.von === null ? null : zahl(bruchWert(wertBei(f, iv.von)));
      const b = iv.bis === null ? null : zahl(bruchWert(wertBei(f, iv.bis)));
      const soll = a === null ? `]−∞; ${b}${iv.bisDabei ? "]" : "["}` : b === null ? `${iv.vonDabei ? "[" : "]"}${a}; ∞[` : `${iv.vonDabei ? "[" : "]"}${a}; ${b}${iv.bisDabei ? "]" : "["}`;
      assert.equal(t.data.options![t.answer.correct!], soll, wo);
      return;
    }
    if (t.type === "mc" && /^[A-D]$/.test(t.data.options![0])) {
      // „Welcher Buchstabe markiert die Zahl 730?“: die richtige Marke steht dort
      const gefragt = t.prompt.match(/(?:die Zahl|den Bruch) (.+)\?$/)![1];
      assert.ok(nahe(markeWert(f, t.data.options![t.answer.correct!]), parseNumber(gefragt)!), `${wo}: Marke ${t.data.options![t.answer.correct!]}`);
      return;
    }
    if (t.type === "cloze") {
      gleich([markeWert(f, "A"), markeWert(f, "B")]);
      if (t.answer.blanks!.length === 3) assert.equal(t.answer.blanks![2][0], markeWert(f, "A") < markeWert(f, "B") ? "<" : ">", wo);
      return;
    }
    gleich([markeWert(f, "A")]);
    // die Marke liegt nie auf einem beschrifteten Strich
    assert.ok(!f.beschriftet.includes(f.marken[0].bei), wo);
    return;
  }

  if (f.art === "koordinaten") {
    if (f.geraden.length === 2) {
      const [g, h] = f.geraden;
      const x = (h.d - g.d) / (bruchWert(g.k) - bruchWert(h.k));
      const y = bruchWert(g.k) * x + g.d;
      if (t.type === "mc") assert.equal(t.data.options![t.answer.correct!], `x = ${zahl(x)}, y = ${zahl(y)}`, wo);
      else if (t.type === "cloze") gleich([x, y]);
      else gleich([x]);
      assert.ok(t.prompt.includes(geradenText(g.k, g.d)) && t.prompt.includes(geradenText(h.k, h.d)), `${wo}: Gleichungen im Text`);
      return;
    }
    if (f.geraden.length === 1) {
      const g = f.geraden[0];
      const k = bruchWert(g.k);
      if (t.type === "mc") {
        assert.equal(t.data.options![t.answer.correct!], geradenText(g.k, g.d, g.name === "f" ? "f(x)" : "y"), wo);
      } else if (t.type === "rechenweg") {
        for (const p of f.punkte) assert.ok(nahe(p.y, k * p.x + g.d), `${wo}: ${p.name} liegt auf der Geraden`);
        gleich([k]);
      } else if (t.prompt.includes("k = ___")) gleich([k, g.d]);
      else if (t.prompt.includes("f(0) = ___")) {
        const x1 = parseNumber([...t.prompt.matchAll(/\nf\((−?\d+)\) = ___/g)].at(-1)![1])!;
        gleich([g.d, k * x1 + g.d]);
      } else if (/Steigung k/.test(t.prompt)) gleich([k]);
      else if (/Lies d ab/.test(t.prompt)) gleich([g.d]);
      else {
        const x1 = parseNumber(t.prompt.match(/f\((−?\d+)\) ab/)![1])!;
        gleich([k * x1 + g.d]);
      }
      return;
    }
    // Punkte
    if (t.type === "cloze") {
      gleich([punkt(f, "A").x, punkt(f, "A").y, punkt(f, "B").x, punkt(f, "B").y]);
      return;
    }
    if (t.type === "mc" && t.data.options![0].includes("Quadrant")) {
      const p = punkt(f, "P");
      const q = p.x > 0 ? (p.y > 0 ? 0 : 3) : p.y > 0 ? 1 : 2;
      assert.equal(t.answer.correct, q, wo);
      return;
    }
    const [, xs, ys] = t.prompt.match(/\((−?[\d,]+) \| (−?[\d,]+)\)/)!;
    const name = t.type === "mc" ? t.data.options![t.answer.correct!] : t.answer.accepted![0];
    assert.ok(nahe(punkt(f, name).x, parseNumber(xs)!) && nahe(punkt(f, name).y, parseNumber(ys)!), `${wo}: Punkt ${name}`);
    // genau ein Punkt hat diese Koordinaten
    assert.equal(f.punkte.filter((p) => nahe(p.x, parseNumber(xs)!) && nahe(p.y, parseNumber(ys)!)).length, 1, wo);
    return;
  }

  // Figuren: die Beschriftung passt zur Zeichnung, die Antwort zu beiden
  beschriftungStimmt(f, wo);
  const p = t.prompt;
  if (t.type === "sachaufgabe") {
    if (f.form === "l-form") {
      const x = f.seiten.find((s) => s.text === "x")!;
      gleich([kante(f, x.von), umfang(f), flaeche(f)]);
    } else gleich([umfang(f), flaeche(f), umfang(f) / 4]);
    return;
  }
  if (/Umfang und Flächeninhalt/.test(p)) return gleich([umfang(f), flaeche(f)]);
  if (/Flächeninhalt/.test(p)) return gleich([flaeche(f)]);
  if (/Umfang/.test(p)) return gleich([umfang(f)]);
  if (/Seite b des Rechtecks/.test(p)) return gleich([kante(f, 1)]);
  if (/Diagonale d|Höhe h/.test(p)) return gleich([laenge(f.strecken![0].von, f.strecken![0].bis)]);
  const x = p.match(/Länge der Seite (\w)\./)![1];
  const seite = f.seiten.find((s) => s.text.startsWith(`${x} = ?`))!;
  assert.ok(seite, `${wo}: die gesuchte Seite ${x} ist im Bild mit „?“ beschriftet`);
  gleich([Math.round(kante(f, seite.von) * 10) / 10], 1e-6);
}

test("Aufgaben mit Bild sind richtig gebaut: die Antwort passt zum Bild, die App nimmt sie an und erkennt die typischen Fehler", () => {
  let n = 0;
  for (const { skill, format, diff, seed, t } of alle()) {
    n++;
    const wo = `${skill} ${format} ${diff} Seed ${seed}: ${t.prompt.split("\n")[0]}`;
    assert.equal(t.skillId, skill, wo);
    assert.ok(t.data.figure, wo);
    ausDemBild(t, wo);

    if (t.type === "calc") {
      for (const a of t.answer.accepted!) assert.equal(checkAnswer(t, a).correct, true, `${wo}: „${a}“`);
    } else if (t.type === "mc") {
      const o = t.data.options!;
      assert.ok(o.length >= 2 && o.length <= 4 && new Set(o).size === o.length, `${wo}: Antworten ${o.join(" | ")}`);
      assert.equal(checkAnswer(t, String(t.answer.correct)).correct, true, wo);
    } else if (t.type === "cloze") {
      assert.equal(gapCount(t.prompt), t.answer.blanks!.length, wo);
      assert.equal(checkAnswer(t, JSON.stringify(t.answer.blanks!.map((b) => b[0]))).correct, true, wo);
    } else if (t.type === "rechenweg") {
      assert.equal(checkOwnSolution(t), null, `${wo}: ${checkOwnSolution(t)}`);
      assert.equal(checkAnswer(t, JSON.stringify({ steps: t.solutionSteps, result: t.answer.accepted![0] })).correct, true, `${wo}: Musterweg`);
    } else {
      assert.equal(checkOwnSolution(t), null, `${wo}: ${checkOwnSolution(t)}`);
      assert.equal(checkAnswer(t, JSON.stringify({ parts: t.answer.parts!.map((p) => ({ steps: [], result: p.accepted![0] })) })).correct, true, wo);
    }
    // jede typische falsche Antwort ist falsch und bekommt ihr Etikett
    for (const e of t.errorMap) {
      const given = t.type === "cloze" ? JSON.stringify([e.answer]) : t.type === "rechenweg" ? JSON.stringify({ steps: [], result: e.answer }) : e.answer;
      if (t.type === "cloze" && t.answer.blanks!.length !== 1) continue;
      const r = checkAnswer(t, given);
      assert.equal(r.correct, false, `${wo}: Fehler „${e.answer}“ gilt als richtig`);
      assert.equal(r.errorLabel, e.label, `${wo}: Fehler „${e.answer}“`);
    }
    // keine Gedankenstriche in sichtbaren Texten
    for (const s of [t.prompt, t.solution, ...t.hints, ...(t.data.options ?? []), ...t.errorMap.map((e) => e.label), ...(t.data.parts ?? []).map((x) => x.prompt), figurBeschreibung(t.data.figure) ?? ""])
      assert.ok(!/—| – /.test(s), `${wo}: Gedankenstrich in „${s}“`);
  }
  assert.ok(n > 3000, `${n} Aufgaben geprüft`);
});

test("jede Fähigkeit mit Bild hat die versprochenen Formate, Teilfähigkeiten nehmen die ihrer Fähigkeit", () => {
  for (const [id, f] of Object.entries(FIGUR_FAEHIGKEITEN)) {
    for (const format of FORMATS) {
      const t = figurAufgabe(id, "mittel", format, mulberry32(3));
      assert.equal(Boolean(t), f.formate.includes(format), `${id} ${format}`);
      if (t) assert.equal(t.type, format);
    }
  }
  assert.equal(figurFaehigkeit("mathe.flaechen.rechteck.umfang"), "mathe.flaechen.rechteck");
  assert.equal(figurFaehigkeit("mathe.brueche.addieren"), null);
  const sub = figurAufgabe("mathe.flaechen.rechteck.umfang", "leicht", "calc", mulberry32(1))!;
  assert.equal(sub.skillId, "mathe.flaechen.rechteck.umfang");
  assert.deepEqual(sub.skillIds, ["mathe.flaechen.rechteck.umfang", "mathe.flaechen.rechteck"]);
});

// ---------- Zeichner ----------

const BEISPIELE: Figur[] = [
  { art: "zahlenstrahl", start: 300, schritt: { z: 10, n: 1 }, schritte: 10, beschriftet: [0, 5, 10], format: "ganz", marken: [{ name: "A", bei: 3 }] },
  { art: "zahlenstrahl", start: -1, schritt: { z: 1, n: 10 }, schritte: 20, beschriftet: [0, 10, 20], format: "dezimal", marken: [{ name: "A", bei: 4 }, { name: "B", bei: 13 }] },
  { art: "zahlenstrahl", start: 0, schritt: { z: 1, n: 4 }, schritte: 12, beschriftet: [0, 4, 8, 12], format: "bruch", marken: [{ name: "A", bei: 5 }] },
  { art: "zahlenstrahl", start: -3, schritt: { z: 1, n: 1 }, schritte: 12, beschriftet: [0, 3, 6, 9, 12], format: "ganz", marken: [], intervall: { von: 4, bis: null, vonDabei: true, bisDabei: false } },
  { art: "koordinaten", x: [-5, 5], y: [-5, 5], einheit: 1, zahlenAlle: 1, punkte: [{ name: "A", x: 3, y: -2 }], geraden: [] },
  { art: "koordinaten", x: [-6, 6], y: [-6, 6], einheit: 1, zahlenAlle: 1, punkte: [], geraden: [{ name: "g", k: { z: -1, n: 2 }, d: 3 }, { name: "h", k: { z: 1, n: 1 }, d: 0 }] },
  { art: "figur", form: "rechteck", ecken: [[0, 0], [6, 0], [6, 4], [0, 4]], seiten: [{ von: 0, text: "a = 6 cm" }, { von: 1, text: "b = 4 cm" }], rechteWinkel: [0] },
  { art: "figur", form: "quadrat", ecken: [[0, 0], [5, 0], [5, 5], [0, 5]], seiten: [{ von: 0, text: "a = 5 m" }], rechteWinkel: [0] },
  { art: "figur", form: "dreieck", ecken: [[0, 0], [8, 0], [3, 5]], namen: ["A", "B", "C"], seiten: [{ von: 0, text: "c = 8 cm" }], strecken: [{ von: [3, 5], bis: [3, 0], text: "h = 5 cm", gestrichelt: true, rechterWinkel: true }] },
  { art: "figur", form: "rechtwinklig", ecken: [[0, 0], [8, 0], [0, 6]], namen: ["C", "A", "B"], seiten: [{ von: 0, text: "b = 8 cm" }, { von: 1, text: "c = ?", loesung: "c = 10 cm" }, { von: 2, text: "a = 6 cm" }], rechteWinkel: [0] },
  { art: "figur", form: "l-form", ecken: [[0, 0], [8, 0], [8, 3], [5, 3], [5, 6], [0, 6]], seiten: [{ von: 0, text: "8 cm" }, { von: 5, text: "6 cm" }], rechteWinkel: [0] },
  { art: "figur", form: "gleichschenklig", ecken: [[0, 0], [6, 0], [3, 4]], seiten: [{ von: 0, text: "c = 6 cm" }], strecken: [{ von: [3, 4], bis: [3, 0], text: "h = ?", loesung: "h = 4 cm", gestrichelt: true, rechterWinkel: true }] },
];

test("jede Art von Bild wird gezeichnet: SVG mit role=img und Beschreibung, ohne kaputte Zahlen", () => {
  const arten = new Set<string>();
  for (const f of BEISPIELE) {
    const svg = figurSvg(f)!;
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+" width="\d+" height="\d+" class="figur-bild figur-\w+" role="img" aria-label="[^"]+">/);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
    // Striche in der Textfarbe (gedruckt schwarz), keine Farbe als Hintergrund
    assert.match(svg, /stroke="currentColor"/);
    assert.doesNotMatch(svg, /background/);
    arten.add(f.art === "figur" ? f.form : f.art);
    const s = figurSzene(f)!;
    assert.ok(s.b > 40 && s.h > 20 && s.b < 700 && s.h < 700, `${f.art}: ${s.b} × ${s.h}`);
  }
  assert.deepEqual([...arten].sort(), ["dreieck", "gleichschenklig", "koordinaten", "l-form", "quadrat", "rechteck", "rechtwinklig", "zahlenstrahl"]);
  // Beschreibung ohne Lösung: die markierte Stelle und die gesuchte Länge werden nicht verraten
  assert.equal(figurBeschreibung(BEISPIELE[0]), "Zahlenstrahl mit 10 gleich langen Teilstücken. Beschriftet sind 300, 350 und 400. Eine Stelle ist mit A markiert.");
  assert.equal(figurBeschreibung(BEISPIELE[9]), "Rechtwinkeliges Dreieck. Beschriftet: b = 8 cm, c gesucht, a = 6 cm.");
  assert.doesNotMatch(figurSvg(BEISPIELE[9])!, /10 cm/);
  assert.match(figurSvg(BEISPIELE[9], { loesung: true })!, /c = 10 cm/);
  assert.doesNotMatch(figurSvg(BEISPIELE[0])!, />330</);
  assert.match(figurSvg(BEISPIELE[0], { loesung: true })!, />330</);
  // Geraden: im Bild nur der Name; mit Lösung stehen die Gleichungen darunter
  assert.doesNotMatch(figurSvg(BEISPIELE[5])!, /y = /);
  assert.match(figurSvg(BEISPIELE[5], { loesung: true })!, />g: y = −1\/2 · x \+ 3<\/text>.*>h: y = x<\/text>/);
  // Namen von Punkten und Geraden mit hellem Rand, damit das Gitter sie nicht stört
  assert.match(figurSvg(BEISPIELE[4])!, /paint-order="stroke">A<\/text>/);
  // Texte werden maskiert, kaputte Angaben ergeben kein Bild
  assert.match(figurSvg({ ...BEISPIELE[6], seiten: [{ von: 0, text: "<b>&" }] })!, /&lt;b&gt;&amp;/);
  for (const kaputt of [null, {}, { art: "kreis" }, { art: "zahlenstrahl", start: 0, schritt: { z: 0, n: 1 }, schritte: 10 }, { art: "figur", form: "rechteck", ecken: [[0, 0], [1, 0]] }, { art: "koordinaten", x: [1, 5], y: [0, 5], einheit: 1 }])
    assert.equal(figurSvg(kaputt), null);
});

// ---------- in der App ----------

const KINDER = ["mathe.vs.zahlen.zahlenstrahl", "mathe.geometrie.koordinaten", "mathe.funktionen.linear", "mathe.flaechen.rechteck", "mathe.pythagoras.seite", "mathe.os.zahlen.intervalle"];

async function setup() {
  const repo = await import("./repo");
  const auth = await import("./auth");
  const { INITIAL_PASSWORD } = await import("./password");
  const niko = auth.checkLogin("niko", INITIAL_PASSWORD)!;
  const sid = repo.createStudent({
    name: "Testkind Bild", grade: 7, klasse: 3, teacher_id: niko.id, school: "", school_type: "Gymnasium", subjects: ["Mathematik"],
    current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "",
  });
  return { repo, niko, sid };
}

function bildAufgaben(): TaskDraft[] {
  return [
    figurAufgabe("mathe.vs.zahlen.zahlenstrahl", "mittel", "calc", mulberry32(5))!,
    figurAufgabe("mathe.brueche.anteile", "leicht", "mc", mulberry32(6))!,
    figurAufgabe("mathe.geometrie.koordinaten", "leicht", "cloze", mulberry32(7))!,
    figurAufgabe("mathe.funktionen.linear", "mittel", "rechenweg", mulberry32(8))!,
    figurAufgabe("mathe.flaechen.zusammengesetzt", "mittel", "sachaufgabe", mulberry32(9))!,
    figurAufgabe("mathe.pythagoras.seite", "leicht", "calc", mulberry32(10))!,
  ];
}

test("die Schülerseite bekommt nur das fertige Bild ohne Lösung, nie die Angaben dahinter", async () => {
  const { repo, sid } = await setup();
  const { clientTasks } = await import("./solver-tasks");
  const { checkTask } = await import("./builder");
  const tasks = bildAufgaben();
  for (const t of tasks) assert.equal(checkTask(t), null, t.prompt);
  const ohne: TaskDraft = { type: "calc", skillId: "mathe.brueche.kuerzen", difficulty: "leicht", prompt: "Kürze 6/8.", data: {}, answer: { accepted: ["3/4"], mode: "value" }, solution: "6/8 = 3/4", hints: [], errorMap: [] };
  const wid = repo.createWorksheet({ title: "Bilder", subject: "Mathematik", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [] }, [...tasks, ohne]);
  const aid = repo.assignWorksheet(wid, sid);
  const view = clientTasks(repo.getAssignment(aid)!);
  const json = JSON.stringify(view);
  for (const geheim of ['"figure"', '"marken"', '"bei"', '"punkte"', '"ecken"', '"loesung"', '"geraden"']) assert.ok(!json.includes(geheim), `Schülerseite enthält ${geheim}`);
  view.slice(0, tasks.length).forEach((c, i) => {
    assert.ok(c.figur?.startsWith("<svg") && c.figur.includes('role="img"'), `Aufgabe ${i + 1}: Bild fehlt`);
    // genau das Bild ohne Lösung
    assert.equal(c.figur, figurSvg(tasks[i].data.figure));
    assert.notEqual(c.figur, figurSvg(tasks[i].data.figure, { loesung: true }));
  });
  assert.equal(view[tasks.length].figur, null, "ohne Bild kein Bild");
  // der Zahlenstrahl verrät die Zahl bei A weder im Bild noch in der Beschreibung
  const a = zahlBei(tasks[0].data.figure as Zahlenstrahl, (tasks[0].data.figure as Zahlenstrahl).marken[0].bei);
  assert.ok(!view[0].figur!.includes(`>${a}<`) && !view[0].figur!.includes(` ${a}.`), `verrät ${a}`);
  assert.ok(figurSvg(tasks[0].data.figure, { loesung: true })!.includes(`>${a}<`));
});

test("das A4-Blatt druckt das Bild: Schülerfassung ohne, Lehrerfassung und Lösungsseite mit den gesuchten Werten", async () => {
  const { buildSheet, DEFAULTS } = await import("./arbeitsblatt");
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  const tasks = bildAufgaben();
  const doc = buildSheet({ title: "Bilder", subject: "Mathematik", klasseLabel: "3. Klasse", topic: "", studentName: null, tasks }, () => null, DEFAULTS);
  // eine Aufgabe mit Bild bekommt kein leeres Koordinatensystem dazu
  assert.ok(doc.tasks.every((t) => t.plan.area?.kind !== "koordinaten"));
  // abgelesen wird gleich in die Lücken oder angekreuzt: kein Rechenfeld; bei einer Figur mit Lücken steht es vor allen Lücken
  assert.equal(doc.tasks[1].plan.area, null);
  assert.equal(doc.tasks[2].plan.area, null);
  const flaeche = figurAufgabe("mathe.flaechen.rechteck", "mittel", "cloze", mulberry32(12))!;
  assert.ok(gapCount(flaeche.prompt) >= 1 && flaeche.data.figure?.art === "figur");
  const blatt = buildSheet({ title: "Fläche", subject: "Mathematik", klasseLabel: "1. Klasse", topic: "", studentName: null, tasks: [flaeche] }, () => null, DEFAULTS);
  assert.ok(blatt.tasks[0].plan.area && blatt.tasks[0].plan.areaBeforeLastLine);
  const html = renderToStaticMarkup(createElement(Sheet, { doc: blatt, o: { ...DEFAULTS, title: "Fläche" } }));
  const [, nachBild] = html.split('class="figur ab-figur"');
  assert.ok(nachBild.indexOf("ab-area") > 0 && nachBild.indexOf("ab-result") > nachBild.indexOf("ab-area"), "Feld zwischen Bild und Lücken");
  const render = (o: Partial<import("./arbeitsblatt").SheetOptions>) => renderToStaticMarkup(createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Bilder", ...o } }));
  const zahlenstrahl = tasks[0].data.figure as Zahlenstrahl;
  const a = zahlBei(zahlenstrahl, zahlenstrahl.marken[0].bei);
  const schueler = render({});
  assert.equal(schueler.match(/class="figur-bild /g)?.length, tasks.length);
  assert.equal(schueler.match(/role="img"/g)?.length, tasks.length);
  assert.ok(!schueler.includes(`>${a}<`), "Schülerfassung ohne Lösung im Bild");
  assert.match(schueler, /class="figur ab-figur" style="width:\d+(\.\d)?mm"/);
  // die Frage steht über dem Bild, die Lücken darunter
  const koord = schueler.indexOf("Lies die Koordinaten");
  assert.ok(koord > 0 && koord < schueler.indexOf("figur-koordinaten") && schueler.indexOf("figur-koordinaten") < schueler.indexOf("A(", koord));
  const lehrer = render({ solutions: "lehrer", fassung: "lehrer" });
  assert.equal(lehrer.match(/class="figur-bild /g)?.length, tasks.length);
  assert.ok(lehrer.includes(`>${a}<`), "Lehrerfassung zeigt die Zahl bei A");
  const loesungsseite = render({ solutions: "seite" });
  // Lösungsseite: Zahlenstrahl und Koordinatensystem noch einmal mit den Werten
  assert.ok((loesungsseite.match(/class="figur-bild /g)?.length ?? 0) > tasks.length);
  assert.ok(loesungsseite.includes(`>${a}<`));
});

test("FigurBild (auch für die Ergebnisansicht), Frage über dem Bild; der Editor behält das Bild beim Wechsel des Antwortformats", async () => {
  const { FigurBild, figurKopf } = await import("../components/Figur");
  const t = bildAufgaben()[0];
  const html = renderToStaticMarkup(createElement(FigurBild, { figure: t.data.figure, loesung: true, groesser: 0.8 }));
  assert.match(html, /^<div class="figur " style="width:\d+px"><svg /);
  assert.equal(renderToStaticMarkup(createElement(FigurBild, { figure: undefined })), "");
  assert.equal(figurKopf("Lies ab.\nA( ___ | ___ )"), "Lies ab.");
  assert.equal(figurKopf("A = ___\nB = ___"), null);
  assert.equal(figurKopf("Welche Zahl ist bei A markiert?"), null);
  const { normalizeTask } = await import("./builder");
  const rw = figurAufgabe("mathe.flaechen.rechteck", "mittel", "rechenweg", mulberry32(4))!;
  assert.deepEqual(normalizeTask(rw).data.figure, leseFigur(rw.data.figure), "Rechenweg behält das Bild");
  assert.equal(normalizeTask({ ...rw, data: { ...rw.data, figure: { art: "kreis" } as unknown as Figur } }).data.figure, undefined, "kaputtes Bild wird nicht gespeichert");
});

test("Tafel: das Bild aus Linien, Punkten und Texten, gesperrt und der Aufgabe zugeordnet; sonst in Worten", async () => {
  const { tasksTemplate, figureTemplate, WORK_WIDTH } = await import("./whiteboard-templates");
  const t = figurAufgabe("mathe.geometrie.koordinaten", "leicht", "calc", mulberry32(2))!;
  const szene = figurSzene(t.data.figure)!;
  const els = tasksTemplate([{ number: 1, prompt: t.prompt, options: null, figure: szene, figureText: figurBeschreibung(t.data.figure) }], { x: 0, y: 0 }, { set: "s1" });
  const bild = figureTemplate(szene, { x: 0, y: 0 });
  assert.ok(bild.width <= WORK_WIDTH);
  assert.ok(bild.elements.some((e) => e.type === "ellipse"), "Punkte");
  assert.ok(bild.elements.some((e) => e.type === "line" && e.strokeColor === "#c9ced6"), "Gitter");
  const texte = els.filter((e) => e.type === "text").map((e) => String(e.text));
  for (const p of (t.data.figure as Koordinaten).punkte) assert.ok(texte.includes(p.name), `Punkt ${p.name} beschriftet`);
  for (const e of els) {
    assert.equal(e.locked, true);
    assert.deepEqual((e.customData as { aufgabe: { n: number; set: string } }).aufgabe, { n: 1, set: "s1" });
    for (const k of ["x", "y", "width", "height"]) if (k in e) assert.ok(Number.isFinite(e[k] as number), `${e.type}.${k}`);
  }
  // ohne zeichenbares Bild: die Beschreibung als Text
  const ersatz = tasksTemplate([{ number: 1, prompt: t.prompt, options: null, figure: null, figureText: "Koordinatensystem mit Gitter." }], { x: 0, y: 0 });
  assert.ok(ersatz.some((e) => e.type === "text" && String(e.text).startsWith("Bild: Koordinatensystem")));
});

test("Mappe, Tafel und Minitest: Aufgaben mit Bild stehen mit Bild in der Mappe, in die Tafel kommt das Bild ohne Lösung, der Minitest macht neue", async () => {
  const { repo, niko, sid } = await setup();
  const units = await import("./units");
  const { submitAnswer } = await import("./service");
  const { mappeFuerEinheit } = await import("./mappe");
  const { leseMappeOptionen } = await import("./mappe-druck");
  const { MappeDokument } = await import("../components/arbeitsblatt/Mappe");
  const wb = await import("./whiteboard");
  const { boardTaskForStudent } = await import("./whiteboard-content");
  const student = repo.getStudent(sid)!;
  const { unit } = units.startUnit(niko.id, sid, { at: Date.now() - 30 * 60_000, subject: "Mathematik" });
  const tasks = bildAufgaben().slice(0, 3);
  const wid = repo.createWorksheet({ title: "Bilder", subject: "Mathematik", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [] }, tasks);
  const aid = repo.assignWorksheet(wid, sid, "", unit.id);
  const [t0, t1] = repo.listTasks(wid);
  const antworte = (t: typeof t0, answer: string) => submitAnswer({ token: student.access_token, assignmentId: aid, taskId: t.id, answer, timeMs: 20_000, activeMs: 20_000, hintsUsed: 0, giveUp: false });
  assert.equal((await antworte(t0, t0.answer.accepted![0])).correct, true);
  assert.equal((await antworte(t1, String((t1.answer.correct! + 1) % t1.data.options!.length))).correct, false);

  // Mappe: jede Aufgabe mit ihrem Bild; bei der falschen Antwort zeigt das Bild die Lösung
  const m = mappeFuerEinheit(unit.id)!;
  const html = renderToStaticMarkup(createElement(MappeDokument, { m, o: leseMappeOptionen({}, "Einheit") }));
  // nicht bearbeitete Aufgaben stehen nur auf Wunsch in der Mappe
  assert.equal(html.match(/class="figur-bild /g)?.length, 2);
  assert.ok(html.includes(figurSvg(t1.data.figure, { loesung: true })!), "falsch beantwortet: Bild mit Lösung");
  assert.ok(html.includes(figurSvg(t0.data.figure)!), "richtig beantwortet: Bild wie am Gerät");

  // Tafel: über die Warteschlange (die auch das Schülergerät zeichnen darf) nur das Bild ohne Lösung
  const board = wb.ensureBoardForUnit(unit.id)!;
  const id = wb.queueInsert(board.id, { kind: "tasks", title: "Bilder", tasks: repo.listTasks(wid).map(boardTaskForStudent) });
  const p = wb.pendingInserts(board.id).find((x) => x.id === id)!.payload;
  assert.equal(p.kind, "tasks");
  if (p.kind !== "tasks") return;
  assert.equal(p.tasks.length, 3);
  assert.deepEqual(p.tasks[0].figure, figurSzene(t0.data.figure));
  assert.equal(p.tasks[0].figureText, figurBeschreibung(t0.data.figure));
  const a = zahlBei(t0.data.figure as Zahlenstrahl, (t0.data.figure as Zahlenstrahl).marken[0].bei);
  assert.ok(!JSON.stringify(p).includes(`"s":"${a}"`), "die Tafel verrät die Zahl bei A nicht");
  assert.ok(!JSON.stringify(p).includes('"solution"'));

  // Minitest aus diesem Stoff: neue Aufgaben mit Bild, keine schon bearbeitete (gleicher Text, anderes Bild zählt als neu)
  const { minitestAufgaben } = await import("./minitest");
  const mt = minitestAufgaben({ unit, fach: "Mathematik", aufgaben: [{ task: t0, fach: "Mathematik", richtig: true }, { task: t1, fach: "Mathematik", richtig: false }], faehigkeiten: [] }, 4, 7, 5);
  assert.equal(mt.length, 4);
  const alt = new Set([t0, t1].map(aufgabenSchluessel));
  for (const t of mt) {
    assert.ok(t.data.figure, `Minitest ohne Bild: ${t.prompt}`);
    assert.ok(!alt.has(aufgabenSchluessel(t)), `Minitest wiederholt: ${t.prompt}`);
    assert.ok([t0.skillId, t1.skillId].includes(t.skillId));
  }
});

test("Generatoren ohne KI (Builder, Diagnose, Minitest) machen Aufgaben mit Bild; doppelte gibt es nicht", async () => {
  const { generateBuiltIn, generateForSlot, hasBuiltInGenerator } = await import("./generators");
  for (const id of [...Object.keys(FIGUR_FAEHIGKEITEN), "mathe.flaechen.rechteck.umfang"]) assert.ok(hasBuiltInGenerator(id), id);
  for (const id of KINDER) {
    for (const taskType of ["mixed", "calc", "mc", "cloze", "rechenweg", "order"] as const) {
      const out = generateBuiltIn({ subject: "Mathematik", skills: [{ id, name: id }], difficulty: "mittel", count: 5, taskType, seed: 11 });
      assert.equal(out.length, 5, `${id} ${taskType}`);
      for (const t of out) {
        assert.ok(t.data.figure, `${id} ${taskType}: ohne Bild`);
        assert.equal(t.skillId, id);
      }
      assert.equal(new Set(out.map(aufgabenSchluessel)).size, out.length, `${id} ${taskType}: doppelt`);
    }
  }
  // die Formate des Builders: Multiple Choice und Lückentext haben eigene Fragen zum Bild
  const slot = (category: string | null, skillId = "mathe.geometrie.koordinaten") => generateForSlot({ skillId, skillName: "x", difficulty: "mittel", category, subject: "Mathematik" }, mulberry32(3));
  assert.equal(slot("mc").type, "mc");
  assert.equal(slot("lueckentext").type, "cloze");
  assert.ok(slot("lueckentext").data.figure);
  assert.equal(slot("rechnung").type, "calc");
  assert.equal(slot("fehler").category, "fehler");
  assert.equal(slot("rechenweg", "mathe.flaechen.dreieck").type, "rechenweg");
  assert.equal(slot("rechenweg", "mathe.flaechen.dreieck").data.figure?.art, "figur");
  assert.equal(slot("sachaufgabe", "mathe.flaechen.rechteck").type, "sachaufgabe");
  assert.equal(slot("rechnung", "mathe.os.zahlen.intervalle").type, "mc");
  const ordnen = slot("ordnen", "mathe.flaechen.zusammengesetzt");
  assert.ok(ordnen.data.figure, "Lösungsweg ordnen behält das Bild");
});

test("Builder: eine Übung ohne KI mit Aufgaben mit Bild, ohne falsche Hinweise und ohne Doppelte", async () => {
  const { niko } = await setup();
  const builder = await import("./builder");
  const repo = await import("./repo");
  const settings: import("./builder").BuilderSettings = {
    studentId: null, subject: "Mathematik", schoolType: "Gymnasium", klasse: 3, skillIds: ["mathe.vs.zahlen.zahlenstrahl", "mathe.geometrie.koordinaten", "mathe.flaechen.rechteck", "mathe.funktionen.linear"],
    difficulty: "mittel", count: 12, categories: [], focus: "", useAI: false, title: "",
  };
  const out = await builder.generateTasks(settings, null);
  assert.equal(out.source, "generator");
  assert.equal(out.tasks.length, 12);
  assert.ok(out.tasks.every((t) => t.data.figure), "jede Aufgabe mit Bild");
  assert.ok(!/freie Antwort/.test(out.aiError ?? ""), out.aiError);
  assert.equal(new Set(out.tasks.map(aufgabenSchluessel)).size, 12);
  for (const t of out.tasks) assert.equal(builder.checkTask(t), null, t.prompt);
  // gespeichert und neu erstellt: das Bild bleibt, die neue Aufgabe ist eine andere
  const { id } = await builder.createDraft({ ...settings, count: 4 }, niko.id);
  const [first] = repo.listTasks(id);
  assert.ok(first.data.figure);
  const before = aufgabenSchluessel(first);
  assert.equal((await builder.regenerateTask(first.id)).ok, true);
  const after = repo.getTask(first.id)!;
  assert.ok(after.data.figure);
  assert.notEqual(aufgabenSchluessel(after), before);
});
