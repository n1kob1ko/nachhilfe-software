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
import {
  aufGitter,
  aufgabenSchluessel,
  bruchWert,
  figurBeschreibung,
  figurFehler,
  figurSvg,
  figurSzene,
  geradenText,
  kreisWinkel,
  leseFigur,
  textBreite,
  wertBei,
  zahl,
  zahlBei,
  type Diagramm,
  type Figur,
  type Flaeche,
  type Koordinaten,
  type Kreis,
  type Punkt2,
  type Zahlenstrahl,
} from "./figur";
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

/** Eine Zahl aus einer Antwort mit oder ohne Einheit („24 cm²“, „−3/4“, „2 1/4“, „5 300 000“, „12 Kinder“, „45°“). */
const zahlAus = (s: string) => parseNumber(s.replace(/\s*(?:(?:mm|cm|dm|km|m)(?:²|2)?|°C?|[A-Za-zÄÖÜäöüß]+)$/, ""));
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

// ---------- Kreise und Diagramme aus dem gezeichneten Bild ----------
/** Der Radius aus der Beschriftung im Bild („r = 5 cm“, „d = 8 m“; gesucht „r = ?“ mit der Lösung „r = 5 cm“). */
function kreisRadius(f: Kreis, wo: string): number {
  const m = (f.loesung ?? f.text).match(/^([rd]) = (\d+(?:,\d+)?) (?:cm|m)$/);
  assert.ok(m, `${wo}: Beschriftung „${f.text}“`);
  const v = Number(m[2].replace(",", "."));
  return m[1] === "r" ? v : v / 2;
}

/** Kreise: gerechnet mit 3,14 wie in der Angabe; „Runde auf eine Nachkommastelle“ erlaubt genau diese Rundung. */
function kreisAusDemBild(t: TaskDraft, f: Kreis, got: (number | null)[], wo: string) {
  const p = t.prompt;
  const gleich = (soll: number[], eps: number) => soll.forEach((v, i) => assert.ok(nahe(got[i], v, eps), `${wo}: Antwort ${i + 1} ist ${got[i]}, im Bild ${v}`));
  const mc = (soll: string) => assert.equal(t.data.options![t.answer.correct!], soll, wo);
  if (/Wie heißt die Strecke x/.test(p)) return mc(f.strecke === "radius" ? "Radius" : "Durchmesser");
  if (/getönte Teil/.test(p)) return mc(f.teil === "sektor" ? "Kreissektor" : "?");
  // π: die Angabe sagt, womit gerechnet wird, und ob gerundet
  if (/Umfang|Flächeninhalt|Fläche|Kreisbogen|Rand/.test(p) || t.type === "sachaufgabe") assert.match(p, /Rechne mit π ≈ 3,14\./, wo);
  const rund = /Runde auf eine Nachkommastelle\./.test(p) ? 0.05 + 1e-9 : 1e-6;
  const r = kreisRadius(f, wo);
  const anteil = kreisWinkel(f) / 360;
  const pi = 3.14;
  const flaeche = r * r * pi * anteil;
  const bogen = 2 * r * pi * anteil;
  const umfang = bogen + (f.teil === "kreis" || f.teil === "sektor" ? 0 : 2 * r);
  // die Angabe im Text passt zum Bild
  const imText = p.match(/(Durchmesser|Radius) (?:von |d = )(\d+(?:,\d+)?) (?:cm|m)/);
  if (imText) assert.ok(nahe(Number(imText[2].replace(",", ".")), imText[1] === "Radius" ? r : 2 * r), `${wo}: ${imText[0]}`);
  if (t.type === "sachaufgabe") {
    if (/Pizza/.test(p)) {
      const stuecke = Number(p.match(/in (\d+) gleich große Stücke/)![1]);
      assert.equal(360 / stuecke, kreisWinkel(f), wo);
      return gleich([kreisWinkel(f), flaeche, bogen], rund);
    }
    if (/Rasensprenger/.test(p)) {
      assert.ok(p.includes(`α = ${kreisWinkel(f)}°`), wo);
      return gleich([flaeche, bogen, anteil * 100], rund);
    }
    const preis = Number(t.data.parts![2].prompt.match(/kostet (\d+) € pro Meter/)![1]);
    gleich([umfang, flaeche], rund);
    // c) rechnet mit dem Ergebnis aus a) weiter
    return assert.ok(nahe(got[2], got[0]! * preis, 0.005 + 1e-9), `${wo}: c) ist ${got[2]}`);
  }
  const umkehr = p.match(/hat den (Umfang u|Flächeninhalt A) = (\d+(?:,\d+)?) /);
  if (umkehr) {
    const g = Number(umkehr[2].replace(",", "."));
    assert.ok(f.text.endsWith("?") && f.loesung, `${wo}: gesucht im Bild mit „?“`);
    return gleich([umkehr[1] === "Umfang u" ? g / pi : Math.sqrt(g / pi)], 1e-6);
  }
  if (/Durchmesser d = ___/.test(p)) return gleich([2 * r, 4 * r], 1e-9);
  if (/Wie lang ist der Durchmesser/.test(p)) return gleich([2 * r], 1e-9);
  if (/Wie lang ist der Radius|Zirkel/.test(p)) return gleich([r], 1e-9);
  if (/Anteil am ganzen Kreis/.test(p)) return gleich([anteil, flaeche, bogen], rund);
  if (/Umfang und Flächeninhalt/.test(p)) return gleich([umfang, flaeche], rund);
  if (/Flächeninhalt und Umfang/.test(p)) return gleich([flaeche, umfang], rund);
  if (/den Flächeninhalt/.test(p)) return gleich([flaeche], rund);
  if (/Kreisbogens b/.test(p)) return gleich([bogen], rund);
  if (/den Umfang/.test(p)) return gleich([umfang], rund);
  assert.fail(`${wo}: unbekannte Frage zum Kreis`);
}

/**
 * Diagramme: jeder Wert liegt auf einer Gitterlinie (genau ablesbar), die Werte, die die Musterlösung abliest,
 * stehen so im Bild, und die Antwort folgt aus ihnen (ablesen, Unterschied, Summe, Häufigkeit, Kennzahlen).
 */
function diagrammAusDemBild(t: TaskDraft, f: Diagramm, got: (number | null)[], wo: string) {
  const p = t.prompt;
  const gleich = (soll: number[]) => soll.forEach((v, i) => assert.ok(nahe(got[i], v), `${wo}: Antwort ${i + 1} ist ${got[i]}, im Bild ${v}`));
  assert.equal(f.werteZeigen, false, wo);
  for (const w of f.werte) assert.ok(aufGitter(f, w.wert) && w.wert >= f.min && w.wert <= f.max, `${wo}: ${w.name} = ${w.wert} nicht auf einer Gitterlinie`);
  assert.equal(new Set(f.werte.map((w) => w.name)).size, f.werte.length, `${wo}: Namen doppelt`);
  const werte = f.werte.map((w) => w.wert);
  const summe = werte.reduce((a, b) => a + b, 0);
  const wertVon = (name: string) => {
    const w = f.werte.find((x) => x.name === name);
    assert.ok(w, `${wo}: „${name}“ fehlt im Bild`);
    return w.wert;
  };
  // was die Musterlösung abliest, steht so im Bild, und die Frage nennt es
  const gelesen = [...t.solution.matchAll(/(?:bei „(.+?)“ reicht bis zur Linie|Der Punkt bei (.+?) liegt auf der Linie) bei (−?[\d\s ,]*\d)/g)].map((m) => {
    const name = m[1] ?? m[2];
    const v = parseNumber(m[3])!;
    assert.equal(wertVon(name), v, `${wo}: „${name}“`);
    assert.ok(p.includes(name), `${wo}: die Frage nennt „${name}“ nicht`);
    return v;
  });
  const gesucht = f.werte.filter((w) => w.gesucht);
  if (gesucht.length) {
    assert.equal(gesucht.length, 1, wo);
    assert.ok(p.includes(zahl(summe)), `${wo}: Gesamtzahl ${summe}`);
    return gleich([gesucht[0].wert]);
  }
  if (f.min > 0 && f.form !== "linie") {
    // abgeschnittene Achse: der Unterschied in Zahlen
    const d = Number(t.data.options![t.answer.correct!].match(/(\d+) Gäste mehr/)![1]);
    return assert.equal(d, Math.abs(werte[0] - werte[1]), wo);
  }
  if (t.skillId === "mathe.statistik.haeufigkeiten") {
    const a = wertVon(p.match(/„(.+?)“/)![1]);
    const n = p.match(/(?:Insgesamt wurden|Zusammen sind es) (\d+)/);
    if (n) assert.equal(Number(n[1]), summe, wo);
    return t.type === "cloze" ? gleich([a, (a / summe) * 100]) : gleich([(a / summe) * 100]);
  }
  if (t.skillId === "mathe.statistik.kennzahlen") {
    const s = [...werte].sort((a, b) => a - b);
    const n = s.length;
    if (/Durchschnitt/.test(p)) return gleich([summe / n]);
    if (/Median/.test(p)) return gleich([n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2]);
    if (/größter Wert: ___/.test(p)) return gleich([s[n - 1], s[0], s[n - 1] - s[0]]);
    if (/Spannweite/.test(p)) return gleich([s[n - 1] - s[0]]);
    assert.fail(`${wo}: unbekannte Frage zu Kennzahlen`);
  }
  if (t.type === "mc" && got[0] === null) {
    // wo ist es am meisten?
    const o = t.data.options!;
    if (/am wärmsten/.test(p)) return assert.ok(o[t.answer.correct!].endsWith(f.werte[werte.indexOf(Math.max(...werte))].name), wo);
    if (/am meisten gewachsen/.test(p)) {
      const zu = werte.slice(1).map((v, i) => v - werte[i]);
      const i = zu.indexOf(Math.max(...zu));
      return assert.equal(o[t.answer.correct!], `Von der ${f.werte[i].name} bis zur ${f.werte[i + 1].name}`, wo);
    }
    assert.ok(o.length === werte.length || p.includes(`Wähle aus: ${o.join(", ")}.`), wo);
    // richtig ist das Größte im ganzen Diagramm, nicht nur unter den Antworten („Mo“ steht als „Montag“, „1a“ als „die 1a“ zur Wahl)
    const passt = (x: string, name: string) => x.toLowerCase().startsWith(name.toLowerCase()) || x.toLowerCase().endsWith(` ${name.toLowerCase()}`);
    const wert = (x: string) => werte[f.werte.findIndex((w) => passt(x, w.name))];
    assert.ok(o.every((x) => wert(x) !== undefined), `${wo}: ${o.join(" | ")}`);
    assert.equal(werte.filter((v) => v === Math.max(...werte)).length, 1, wo);
    return assert.equal(wert(o[t.answer.correct!]), Math.max(...werte), wo);
  }
  if (t.type === "cloze") return gleich(gelesen);
  if (t.solution.startsWith("Die Werte:")) return gleich([summe]);
  if (gelesen.length === 2) {
    assert.ok(got[0]! > 0, wo);
    return gleich([Math.abs(gelesen[0] - gelesen[1])]);
  }
  assert.equal(gelesen.length, 1, `${wo}: liest ${gelesen.length} Werte ab`);
  gleich(gelesen);
}

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

  if (f.art === "kreis") return kreisAusDemBild(t, f, got, wo);
  if (f.art === "diagramm") return diagrammAusDemBild(t, f, got, wo);

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
  { art: "kreis", teil: "kreis", winkel: 360, strecke: "radius", text: "r = 5 cm", mitte: "M", winkelZeigen: false, getoent: false, ganzerKreis: false },
  { art: "kreis", teil: "sektor", winkel: 72, strecke: "radius", text: "r = ?", loesung: "r = 6 cm", mitte: "M", winkelZeigen: true, getoent: true, ganzerKreis: true },
  { art: "kreis", teil: "halbkreis", winkel: 180, strecke: "durchmesser", text: "d = 8 cm", mitte: "M", winkelZeigen: false, getoent: true, ganzerKreis: false },
  {
    art: "diagramm",
    form: "saeulen",
    titel: "Lieblingsobst",
    achse: "Anzahl Kinder",
    min: 0,
    max: 12,
    schritt: 2,
    zahlenAlle: 2,
    werte: [{ name: "Äpfel", wert: 8 }, { name: "Birnen", wert: 5 }, { name: "Trauben", wert: 10, gesucht: true }],
    werteZeigen: false,
  },
  { art: "diagramm", form: "balken", titel: "So kommen wir zur Schule", achse: "Anzahl Kinder", min: 0, max: 40, schritt: 5, zahlenAlle: 2, werte: [{ name: "zu Fuß", wert: 25 }, { name: "Rad", wert: 15 }, { name: "Bus", wert: 35 }], werteZeigen: false },
  { art: "diagramm", form: "linie", titel: "Temperatur", achse: "°C", min: -6, max: 6, schritt: 1, zahlenAlle: 2, werte: [{ name: "6 Uhr", wert: -5 }, { name: "9 Uhr", wert: -2 }, { name: "12 Uhr", wert: 3 }, { name: "15 Uhr", wert: 4 }], werteZeigen: false },
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
  assert.deepEqual([...arten].sort(), ["diagramm", "dreieck", "gleichschenklig", "koordinaten", "kreis", "l-form", "quadrat", "rechteck", "rechtwinklig", "zahlenstrahl"]);
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

test("Kreis und Diagramm: gesuchte Werte nur in der Lehrerfassung, Werte genau ablesbar, Texte maskiert", () => {
  const sektor = BEISPIELE[13] as Kreis;
  const obst = BEISPIELE[15] as Diagramm;
  // gesuchter Radius: im Bild „r = ?“, die Lehrerfassung zeigt ihn; getönt und der übrige Kreis gestrichelt
  assert.match(figurSvg(sektor)!, />r = \?</);
  assert.doesNotMatch(figurSvg(sektor)!, /6 cm/);
  assert.match(figurSvg(sektor, { loesung: true })!, />r = 6 cm</);
  assert.match(figurSvg(sektor)!, /fill-opacity="0.2"/);
  assert.match(figurSvg(sektor)!, /stroke-dasharray="6 4"/);
  assert.equal(figurBeschreibung(sektor), "Kreissektor mit dem Mittelpunkt M, die Fläche ist getönt. Der übrige Kreis ist gestrichelt. Der Winkel ist 72°. Eingezeichnet ist der Radius, beschriftet: r gesucht.");
  // gesuchte Säule: nur ein „?“ (10 liegt auf einer Linie ohne Zahl), der Wert erst in der Lehrerfassung
  const ohne = figurSvg(obst)!;
  const mit = figurSvg(obst, { loesung: true })!;
  assert.match(ohne, />\?</);
  assert.doesNotMatch(ohne, />10</);
  assert.match(mit, />10</);
  assert.doesNotMatch(figurBeschreibung(obst)!, /10/);
  // ein Wert zwischen zwei Linien (Birnen 5, Linien alle 2) wird angeschrieben, einer auf einer Linie nicht (Äpfel 8 nur an der Achse)
  assert.match(ohne, />5</);
  assert.equal(ohne.match(/>8</g)?.length, 1);
  assert.equal(mit.match(/>8</g)?.length, 2, "die Lehrerfassung schreibt jeden Wert an");
  // Achse mit Zahlen an jeder zweiten Linie, auch unter 0
  for (const z of ["0", "4", "8", "12"]) assert.match(ohne, new RegExp(`>${z}<`));
  const temperatur = figurSvg(BEISPIELE[17])!;
  for (const z of ["−6", "−4", "−2", "0", "2", "4", "6"]) assert.match(temperatur, new RegExp(`>${z}<`), `Temperatur ${z}`);
  // jeder Wert der Beispiele liegt auf einer Gitterlinie oder ist angeschrieben
  for (const f of BEISPIELE) if (f.art === "diagramm") for (const w of f.werte) assert.ok(aufGitter(f, w.wert) || figurSvg(f)!.includes(`>${zahl(w.wert)}<`), `${f.titel}: ${w.name}`);
  // Texte werden maskiert
  assert.match(figurSvg({ ...sektor, text: "<b>&" })!, /&lt;b&gt;&amp;/);
  const frech = figurSvg({ ...obst, titel: "<script>x</script>", achse: "<i>", werte: [{ name: "a&b", wert: 4 }] })!;
  assert.doesNotMatch(frech, /<script|<i>/);
  assert.match(frech, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(frech, /a&amp;b/);
});

test("Diagramme: eine 0 steht als Zahl da, „die meisten“ hat immer die richtige Antwort zur Wahl", () => {
  // eine Säule oder ein Balken mit 0 ist sonst nur eine Lücke: man sähe nicht, ob der Wert fehlt
  const woche: Diagramm = { art: "diagramm", form: "saeulen", titel: "Gelesene Seiten", achse: "Seiten", min: 0, max: 40, schritt: 10, zahlenAlle: 1, werte: [{ name: "Mo", wert: 30 }, { name: "Di", wert: 0 }], werteZeigen: false };
  for (const form of ["saeulen", "balken"] as const) {
    const svg = figurSvg({ ...woche, form })!;
    assert.equal(svg.match(/>0</g)?.length, 2, `${form}: die 0 an der Achse und bei der Säule`);
    assert.match(figurBeschreibung({ ...woche, form })!, /Angeschrieben: Di 0\./);
  }
  assert.equal(figurSvg({ ...woche, form: "linie" })!.match(/>0</g)?.length, 1, "auf der Linie ist der Punkt bei 0 zu sehen");
  // „Wo am meisten?“ mit mehr als 4 Dingen: das größte ist immer unter den 4 Antworten
  let seed = 5;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let gesehen = 0;
  for (const skill of ["mathe.vs.daten.diagramme", "mathe.statistik.diagramme"])
    for (const d of DIFFS)
      for (let i = 0; i < 120; i++) {
        const t = figurAufgabe(skill, d, "mc", rng);
        const f = t?.data.figure;
        if (!t || f?.art !== "diagramm" || !/meisten/.test(t.prompt) || f.form === "linie") continue;
        gesehen++;
        const groesste = Math.max(...f.werte.map((w) => w.wert));
        const richtig = (t.data.options as string[])[t.answer.correct as number];
        const name = f.werte.find((w) => w.wert === groesste)!.name;
        assert.equal(f.werte.filter((w) => w.wert === groesste).length, 1, t.prompt);
        assert.ok(richtig.toLowerCase().includes(name.toLowerCase().slice(0, 3)), `${t.prompt}: ${richtig} statt ${name}`);
      }
  assert.ok(gesehen > 20, `nur ${gesehen} Aufgaben „die meisten“`);
});

test("Diagramme: die Zahlen an der Werteachse berühren sich nie, alle Gitterlinien bleiben, auch bei sehr vielen", () => {
  /** Zahlen an der Werteachse (Schriftgröße 12,5): Anzahl; nebeneinander (Balken) oder untereinander mit Platz dazwischen. */
  const achse = (f: Diagramm, wo: string) => {
    const teile = figurSzene(f)!.teile;
    const z = teile.flatMap((t) => (t.t === "text" && t.g === 12.5 ? [t] : []));
    if (f.form === "balken") {
      const xs = [...z].sort((a, b) => a.x - b.x);
      xs.slice(1).forEach((t, i) => assert.ok(t.x - xs[i].x >= (textBreite(t.s, t.g) + textBreite(xs[i].s, xs[i].g)) / 2 + 4, `${wo}: ${xs[i].s} und ${t.s} berühren sich`));
    } else {
      const ys = [...z].sort((a, b) => a.y - b.y);
      ys.slice(1).forEach((t, i) => assert.ok(t.y - ys[i].y >= t.g + 2, `${wo}: ${ys[i].s} und ${t.s} berühren sich`));
    }
    const gitter = teile.filter((t) => t.t === "linie" && t.stil === "gitter").length;
    assert.ok(gitter >= Math.round((f.max - f.min) / f.schritt) - 1, `${wo}: ${gitter} Gitterlinien`);
    return z.map((t) => t.s);
  };
  let n = 0;
  for (const { skill, format, diff, seed, t } of alle()) {
    if (t.data.figure?.art !== "diagramm") continue;
    n++;
    const f = t.data.figure;
    const zahlen = achse(f, `${skill} ${format} ${diff} Seed ${seed}`);
    // aus den Aufgaben: jede gewünschte Zahl steht da (an jeder `zahlenAlle`-ten Linie, ab der 0 gezählt)
    const basis = f.min <= 0 && f.max >= 0 ? 0 : f.min;
    const soll = Array.from({ length: Math.round((f.max - f.min) / f.schritt) + 1 }, (_, k) => f.min + k * f.schritt).filter((v) => Math.abs(Math.round((v - basis) / f.schritt)) % f.zahlenAlle === 0);
    assert.deepEqual(zahlen, soll.map((v) => zahl(v)), `${skill} Seed ${seed}`);
  }
  assert.ok(n > 50, `${n} Diagramme geprüft`);
  const freibad: Diagramm = { art: "diagramm", form: "balken", titel: "Gäste im Freibad", achse: "Anzahl Gäste", min: 0, max: 260, schritt: 20, zahlenAlle: 1, werte: [{ name: "Mo", wert: 100 }, { name: "Di", wert: 160 }], werteZeigen: false };
  assert.equal(achse(freibad, "Freibad").length, 14, "die Linien rücken auseinander, jede Zahl bleibt");
  // sehr viele Linien: dann steht nur an manchen eine Zahl, die 0 immer
  const viele = achse({ ...freibad, max: 4000, schritt: 100 }, "40 Linien");
  assert.ok(viele.length >= 5 && viele.length < 41 && viele[0] === "0", viele.join(" "));
  const klein = [{ name: "Mo", wert: 12 }, { name: "Di", wert: -3 }];
  const hoch = achse({ ...freibad, form: "saeulen", max: 40, schritt: 1, werte: [klein[0]] }, "40 Linien senkrecht");
  assert.ok(hoch.length >= 5 && hoch.length < 41 && hoch.includes("0"), hoch.join(" "));
  achse({ ...freibad, form: "linie", min: -20, max: 20, schritt: 1, werte: klein }, "Linie mit Minus");
});

test("falsche Angaben zu Kreis und Diagramm werden mit Grund abgelehnt, nie gezeichnet oder gespeichert", () => {
  const sektor = BEISPIELE[13] as Kreis;
  const obst = BEISPIELE[15] as Diagramm;
  const falsch: [unknown, RegExp][] = [
    [{ ...sektor, winkel: 0 }, /Winkel des Kreissektors/],
    [{ ...sektor, winkel: 360 }, /Winkel des Kreissektors/],
    [{ ...sektor, winkel: 72.5 }, /Winkel des Kreissektors/],
    [{ ...sektor, teil: "oval" }, /Kreisteil/],
    [{ ...sektor, teil: "viertelkreis", strecke: "durchmesser", ganzerKreis: false }, /Durchmesser/],
    [{ ...obst, werte: [{ name: "Äpfel", wert: 14 }] }, /Der Wert 14 bei Äpfel liegt außerhalb der Achse \(0 bis 12\)/],
    [{ ...obst, werte: [{ name: "Äpfel", wert: "viel" }] }, /keine Zahl/],
    [{ ...obst, werte: [] }, /1 bis 12 Werte/],
    [{ ...obst, werte: Array.from({ length: 13 }, (_, i) => ({ name: String(i), wert: 2 })) }, /1 bis 12 Werte/],
    [{ ...obst, min: 1 }, /auf einer Gitterlinie/],
    [{ ...obst, min: -2 }, /Säulen und Balken beginnen bei 0/],
    [{ ...obst, schritt: 0 }, /größer als 0/],
    [{ ...obst, max: 100, schritt: 1 }, /1 bis 40 Abstände/],
    [{ ...obst, form: "torte" }, /Unbekannte Art von Diagramm/],
    [{ ...(BEISPIELE[6] as Flaeche), ecken: [[0, 0], [6, 0], [6, 0], [0, 0]] }, /zu flach/],
  ];
  for (const [raw, grund] of falsch) {
    assert.match(figurFehler(raw) ?? "", grund, JSON.stringify(raw).slice(0, 80));
    assert.equal(leseFigur(raw), null);
    assert.equal(figurSvg(raw), null);
  }
  // was stimmt, wird sauber kopiert: Texte gekürzt, „gesucht“ gibt es nur bei Säulen und Balken
  const lang = leseFigur({ ...obst, titel: "x".repeat(100), werte: [{ name: "Montag und Dienstag zusammen", wert: 4 }] }) as Diagramm;
  assert.equal(lang.titel.length, 60);
  assert.equal(lang.werte[0].name.length, 16);
  assert.equal((leseFigur({ ...BEISPIELE[17], werte: [{ name: "x", wert: 1, gesucht: true }] }) as Diagramm).werte[0].gesucht, undefined);
  assert.equal(figurFehler(sektor), null);
  // ein Durchmesser beim Viertelkreis nur mit dem ganzen Kreis gestrichelt dazu
  assert.equal(figurFehler({ ...sektor, teil: "viertelkreis", strecke: "durchmesser", ganzerKreis: true }), null);
});

test("Bild im Editor ändern: Felder und zurück ergeben dasselbe Bild, Änderungen werden geprüft, Fehler haben einen Grund", async () => {
  const { felderAus, figurAus, figurHinweise, mitForm, leseBruch } = await import("./figur-editor");
  // jedes Beispiel unverändert durch das Formular: dasselbe Bild
  for (const f of BEISPIELE) assert.deepEqual(figurAus(felderAus(f), f), { figur: leseFigur(f), fehler: null }, `${f.art} ${f.art === "figur" ? f.form : ""}`);
  assert.deepEqual(leseBruch("−1/2"), { z: -1, n: 2 });
  assert.deepEqual(leseBruch("0,25"), { z: 1, n: 4 });
  assert.equal(leseBruch("1/0"), null);

  // Zahlenstrahl: neues Ende, die Marke woanders; eine Marke zwischen den Strichen wird abgelehnt
  const strahl = BEISPIELE[0] as Zahlenstrahl;
  const s = felderAus(strahl);
  assert.equal(s.art, "zahlenstrahl");
  if (s.art !== "zahlenstrahl") return;
  assert.deepEqual([s.anfang, s.ende, s.schritt, s.zahlen], ["300", "400", "10", "300; 350; 400"]);
  const neu = figurAus({ ...s, ende: "500", zahlen: "300; 400; 500", marken: [{ name: "A", wert: "470" }] }, strahl);
  assert.equal(neu.fehler, null);
  assert.deepEqual(neu.figur, { ...strahl, schritte: 20, beschriftet: [0, 10, 20], marken: [{ name: "A", bei: 17 }] });
  assert.equal(figurAus({ ...s, marken: [{ name: "A", wert: "335" }] }, strahl).fehler, "Marke A: 335 liegt auf keinem Teilstrich.");
  assert.match(figurAus({ ...s, ende: "395" }, strahl).fehler!, /ganze Zahl von Teilstücken/);
  assert.match(figurAus({ ...s, schritt: "0" }, strahl).fehler!, /größer als 0/);
  assert.match(figurAus({ ...s, ende: "5000", schritt: "1" }, strahl).fehler!, /1 bis 200 Teilstücke/);

  // Koordinatensystem: ein Punkt außerhalb des Bereichs, eine Gerade mit Bruch als Steigung
  const k = felderAus(BEISPIELE[5]);
  if (k.art !== "koordinaten") return assert.fail("koordinaten");
  assert.deepEqual(k.geraden[0], { name: "g", k: "−1/2", d: "3" });
  assert.equal(figurAus({ ...k, punkte: [{ name: "P", x: "9", y: "0" }] }, BEISPIELE[5]).fehler, "Punkt P liegt außerhalb des Bereichs.");
  const mitPunkt = figurAus({ ...k, punkte: [{ name: "P", x: "2", y: "−1" }] }, BEISPIELE[5]).figur as Koordinaten;
  assert.deepEqual(mitPunkt.punkte, [{ name: "P", x: 2, y: -1 }]);

  // Figur: Längen ändern die Zeichnung, die Höhe bleibt unter der Spitze; Länge 0 wird abgelehnt
  const dreieck = BEISPIELE[8] as Flaeche;
  const d = felderAus(dreieck);
  if (d.art !== "figur") return assert.fail("figur");
  assert.deepEqual(d.masse, { c: "8", h: "5", p: "3" });
  const breiter = figurAus({ ...d, masse: { c: "10", h: "4", p: "6" }, seiten: [{ text: "c = 10 cm", loesung: "" }, { text: "", loesung: "" }, { text: "", loesung: "" }], strecken: [{ text: "h = 4 cm", loesung: "" }] }, dreieck).figur as Flaeche;
  assert.deepEqual(breiter.ecken, [[0, 0], [10, 0], [6, 4]]);
  assert.deepEqual([breiter.strecken![0].von, breiter.strecken![0].bis, breiter.strecken![0].text], [[6, 4], [6, 0], "h = 4 cm"]);
  assert.deepEqual(figurHinweise(breiter), []);
  assert.equal(figurAus({ ...d, masse: { ...d.masse, h: "0" } }, dreieck).fehler, "Höhe: eine Zahl größer als 0.");
  assert.match(figurAus({ ...d, masse: { ...d.masse, p: "12" } }, dreieck).fehler!, /Fußpunkt/);
  // eine Beschriftung, die nicht zur Zeichnung passt, ist ein Hinweis (gespeichert wird trotzdem)
  const r = felderAus(BEISPIELE[6]);
  if (r.art !== "figur") return assert.fail("rechteck");
  const schief = figurAus({ ...r, masse: { a: "6", b: "4" }, seiten: [{ text: "a = 8 cm", loesung: "" }, ...r.seiten.slice(1)] }, BEISPIELE[6]);
  assert.equal(schief.fehler, null);
  assert.deepEqual(figurHinweise(schief.figur!), ["Seite unten: beschriftet mit 8 cm, im Bild 6 lang."]);
  // andere Form: Beschriftungen bleiben, soweit es die Seiten gibt
  const l = mitForm(r, "l-form");
  assert.equal(l.seiten.length, 6);
  assert.equal(l.seiten[0].text, "a = 6 cm");
  assert.equal((figurAus(l, BEISPIELE[6]).figur as Flaeche).ecken.length, 6);

  // Kreis: Sektor mit anderem Winkel; ein Winkel über 359 oder ein Durchmesser im Sektor ohne ganzen Kreis geht nicht
  const sektor = BEISPIELE[13] as Kreis;
  const kf = felderAus(sektor);
  if (kf.art !== "kreis") return assert.fail("kreis");
  assert.equal((figurAus({ ...kf, winkel: "120" }, sektor).figur as Kreis).winkel, 120);
  assert.match(figurAus({ ...kf, winkel: "400" }, sektor).fehler!, /1 bis 359/);
  assert.match(figurAus({ ...kf, strecke: "durchmesser", ganzerKreis: false }, sektor).fehler!, /Durchmesser/);
  assert.match(figurAus({ ...kf, text: " " }, sektor).fehler!, /Beschriftung/);
  assert.equal((figurAus({ ...kf, teil: "halbkreis" }, sektor).figur as Kreis).winkel, 180);

  // Diagramm: Werte ändern; ein Wert über der Achse wird mit Grund abgelehnt, leere Zeilen fallen weg
  const obst = BEISPIELE[15] as Diagramm;
  const df = felderAus(obst);
  if (df.art !== "diagramm") return assert.fail("diagramm");
  const mehr = figurAus({ ...df, werte: [...df.werte, { name: "Kiwi", wert: "6", gesucht: false }, { name: "", wert: "", gesucht: false }] }, obst).figur as Diagramm;
  assert.deepEqual(mehr.werte.at(-1), { name: "Kiwi", wert: 6 });
  assert.equal(mehr.werte.length, 4);
  assert.equal(figurAus({ ...df, werte: [{ name: "Kiwi", wert: "14", gesucht: false }] }, obst).fehler, "Der Wert 14 bei Kiwi liegt außerhalb der Achse (0 bis 12).");
  assert.equal(figurAus({ ...df, werte: [{ name: "Kiwi", wert: "sechs", gesucht: false }] }, obst).fehler, "Der Wert bei Kiwi ist keine Zahl.");
  assert.match(figurAus({ ...df, max: "0" }, obst).fehler!, /größer sein als der Anfang/);
});

// ---------- in der App ----------

const KINDER = [
  "mathe.vs.zahlen.zahlenstrahl",
  "mathe.geometrie.koordinaten",
  "mathe.funktionen.linear",
  "mathe.flaechen.rechteck",
  "mathe.pythagoras.seite",
  "mathe.os.zahlen.intervalle",
  "mathe.flaechen.kreis",
  "mathe.flaechen.kreisteile",
  "mathe.vs.daten.diagramme",
  "mathe.statistik.kennzahlen",
];

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

test("Kreis und Diagramm in der App: Schülerseite ohne Lösung, richtige Antworten zählen, A4-Blatt, Tafel und Builder", async () => {
  const { repo, sid } = await setup();
  const { clientTasks } = await import("./solver-tasks");
  const { checkTask } = await import("./builder");
  const { submitAnswer } = await import("./service");
  const kreis = figurAufgabe("mathe.flaechen.kreis", "mittel", "calc", mulberry32(21))!;
  const teil = figurAufgabe("mathe.flaechen.kreisteile", "schwer", "rechenweg", mulberry32(22))!;
  const dia = figurAufgabe("mathe.statistik.diagramme", "mittel", "cloze", mulberry32(23))!;
  const haeufig = figurAufgabe("mathe.statistik.haeufigkeiten", "leicht", "calc", mulberry32(24))!;
  // gesuchter Radius und gesuchte Säule: der Wert steht nur in der Lösung
  const radius: TaskDraft = { type: "calc", skillId: "mathe.geometrie.kreis", difficulty: "leicht", prompt: "Der Kreissektor hat den Bogen b = 7,536 cm. Wie lang ist r?", data: { figure: BEISPIELE[13] }, answer: { accepted: ["6 cm", "6"], mode: "value" }, solution: "r = 6 cm", hints: [], errorMap: [] };
  const saeule: TaskDraft = { type: "calc", skillId: "mathe.statistik.diagramme", difficulty: "leicht", prompt: "Insgesamt wurden 23 Kinder befragt. Wie viele essen am liebsten Trauben?", data: { figure: BEISPIELE[15] }, answer: { accepted: ["10"], mode: "value" }, solution: "23 − 8 − 5 = 10", hints: [], errorMap: [] };
  const tasks = [kreis, teil, dia, haeufig, radius, saeule];
  for (const t of tasks) assert.equal(checkTask(t), null, t.prompt);
  const wid = repo.createWorksheet({ title: "Kreise und Diagramme", subject: "Mathematik", grade: 7, school_type: "Gymnasium", klasse: 3, topic: "", difficulty: "mittel", task_type: "mixed", kind: "uebung", source: "manuell", skill_ids: [] }, tasks);
  const aid = repo.assignWorksheet(wid, sid);
  const view = clientTasks(repo.getAssignment(aid)!);
  const json = JSON.stringify(view);
  for (const geheim of ['"figure"', '"werte"', '"wert"', '"gesucht"', '"teil"', '"strecke"', '"loesung"', '"ganzerKreis"']) assert.ok(!json.includes(geheim), `Schülerseite enthält ${geheim}`);
  view.forEach((c, i) => assert.equal(c.figur, figurSvg(tasks[i].data.figure), `Aufgabe ${i + 1}: genau das Bild ohne Lösung`));
  assert.ok(!view[4].figur!.includes("6 cm") && view[4].figur!.includes("r = ?"));
  assert.ok(!view[5].figur!.includes(">10<") && view[5].figur!.includes(">?<"));

  // die richtige Antwort zählt am Schülergerät als richtig, eine typische falsche nicht
  const student = repo.getStudent(sid)!;
  const gespeichert = repo.listTasks(wid);
  const antworte = (i: number, answer: string) => submitAnswer({ token: student.access_token, assignmentId: aid, taskId: gespeichert[i].id, answer, timeMs: 20_000, activeMs: 20_000, hintsUsed: 0, giveUp: false });
  const falsch = await antworte(0, kreis.errorMap[0].answer);
  assert.equal(falsch.correct, false, `${kreis.prompt}: ${kreis.errorMap[0].answer}`);
  assert.equal((await antworte(0, kreis.answer.accepted![0])).correct, true, kreis.prompt);
  assert.equal((await antworte(1, JSON.stringify({ steps: teil.solutionSteps, result: teil.answer.accepted![0] }))).correct, true, teil.prompt);
  assert.equal((await antworte(2, JSON.stringify(dia.answer.blanks!.map((b) => b[0])))).correct, true, dia.prompt);
  assert.equal((await antworte(3, haeufig.answer.accepted![0])).correct, true, haeufig.prompt);
  assert.equal((await antworte(5, "10")).correct, true);

  // A4: beim Kreis wird gerechnet (Rechenfeld), am Diagramm abgelesen; die Lösungsseite zeigt das Diagramm mit den Werten
  const { buildSheet, DEFAULTS } = await import("./arbeitsblatt");
  const { Sheet } = await import("../components/arbeitsblatt/Sheet");
  const kreisLuecken = figurAufgabe("mathe.flaechen.kreis", "leicht", "cloze", mulberry32(25))!;
  const doc = buildSheet({ title: "Kreise und Diagramme", subject: "Mathematik", klasseLabel: "3. Klasse", topic: "", studentName: null, tasks: [kreisLuecken, dia, saeule] }, () => null, DEFAULTS);
  assert.ok(doc.tasks[0].plan.area && doc.tasks[0].plan.areaBeforeLastLine, "Kreis: Rechenfeld vor den Lücken");
  assert.equal(doc.tasks[1].plan.area, null, "Diagramm: gleich in die Lücken");
  const render = (o: Partial<import("./arbeitsblatt").SheetOptions>) => renderToStaticMarkup(createElement(Sheet, { doc, o: { ...DEFAULTS, title: "Kreise und Diagramme", ...o } }));
  const schueler = render({});
  assert.equal(schueler.match(/class="figur-bild /g)?.length, 3);
  assert.ok(schueler.includes(figurSvg(saeule.data.figure)!) && !schueler.includes(figurSvg(saeule.data.figure, { loesung: true })!));
  const loesungsseite = render({ solutions: "seite" });
  assert.ok(loesungsseite.includes(figurSvg(saeule.data.figure, { loesung: true })!), "Lösungsseite: Diagramm mit dem gesuchten Wert");
  // die Diagramme kommen auf der Lösungsseite noch einmal, der Kreis (gerechnet, nicht abgelesen) nicht
  assert.equal(loesungsseite.match(/figur-diagramm"/g)?.length, 4);
  assert.equal(loesungsseite.match(/figur-kreis"/g)?.length, 1);

  // Tafel: getönte Fläche und gestrichelter Rest als eigene Elemente
  const { figureTemplate } = await import("./whiteboard-templates");
  const bild = figureTemplate(figurSzene(BEISPIELE[13])!, { x: 0, y: 0 });
  assert.ok(bild.elements.some((e) => e.strokeStyle === "dashed"), "übriger Kreis gestrichelt");
  assert.ok(bild.elements.some((e) => e.backgroundColor === "#d5dae3"), "Sektor getönt");
  assert.ok(bild.elements.some((e) => e.type === "text" && e.text === "r = ?"));
  const saeulen = figureTemplate(figurSzene(BEISPIELE[15])!, { x: 0, y: 0 });
  assert.ok(!saeulen.elements.some((e) => e.type === "text" && e.text === "10"), "die Tafel verrät die gesuchte Säule nicht");

  // Builder: Fehler suchen und Ordnen behalten das Bild; Multiple Choice hat eigene Fragen zum Bild
  const { generateForSlot } = await import("./generators");
  for (const skillId of ["mathe.flaechen.kreis", "mathe.statistik.diagramme", "mathe.statistik.kennzahlen"])
    for (const category of ["mc", "lueckentext", "rechnung", "fehler", "ordnen"]) {
      const t = generateForSlot({ skillId, skillName: "x", difficulty: "mittel", category, subject: "Mathematik" }, mulberry32(9));
      assert.ok(t.data.figure && leseFigur(t.data.figure), `${skillId} ${category}: ohne Bild`);
      assert.equal(checkTask(t), null, `${skillId} ${category}: ${t.prompt}`);
    }
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
