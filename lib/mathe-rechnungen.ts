/**
 * The built-in calculations of the maths skills (Brüche, negative Zahlen, Prozent, Gleichungen,
 * Potenzen) with school-book numbers from lib/schulbuch-zahlen.ts. Each one is a short answer ("calc");
 * lib/generators.ts turns it into multiple choice, a gap or an order task when the builder asks for it.
 * Word problems ("Textaufgaben") live in lib/textaufgaben.ts.
 */
import type { Difficulty } from "./curriculum";
import {
  STUFE,
  antwort,
  bruch,
  bruchRechnung,
  bruchText,
  erweiternAufgabe,
  euro,
  fehlerAntwort,
  gcd,
  geld,
  geldAntwort,
  gemischt,
  gleichungEinfach,
  gleichungKlammern,
  gleichungWeg,
  hauptnenner,
  klammer,
  kuerze,
  kuerzenAufgabe,
  mal,
  minus,
  pick,
  plus,
  potenz,
  potenzAufgabe,
  potenzVarianten,
  prozentFall,
  rint,
  xAntwort,
  zahl,
  durch,
  type BruchOp,
  type BruchRechnung,
  type Frac,
  type Gleichung,
  type Rng,
  type Stufe,
} from "./schulbuch-zahlen";
import { parseNumber, type TaskDraft } from "./tasks";

export type Fehler = { answer: string; label: string };
type Mode = "value" | "exact" | "text";

/** Leaves out typical errors that are right after all (equal to an accepted answer) or come twice. */
export function ohneDoppelte(accepted: string[], errors: Fehler[], mode: Mode): Fehler[] {
  const key = (a: string) => {
    if (mode === "value") {
      const n = parseNumber(a);
      if (n !== null) return `#${Math.round(n * 1e9) / 1e9}`;
    }
    return mode === "exact" ? a.trim() : a.trim().replace(/\s+/g, " ").toLowerCase();
  };
  const seen = new Set(accepted.map(key));
  return errors.filter((e) => {
    const k = key(e.answer);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A short-answer task; the first accepted answer is the one shown in the solution. */
export function kurzaufgabe(
  skillId: string,
  difficulty: Difficulty,
  o: { prompt: string; accepted: string[]; mode?: Mode; solution: string; hints: string[]; errors: Fehler[]; category?: string; time?: number },
): TaskDraft {
  const mode = o.mode ?? "value";
  const accepted = [...new Set(o.accepted.filter(Boolean))];
  // a typical error that is a long decimal (10,4167) is no answer a student writes down
  const errors = mode === "value" ? o.errors.filter((e) => !/[.,]\d{4,}$/.test(e.answer)) : o.errors;
  return {
    type: "calc",
    skillId,
    difficulty,
    ...(o.category ? { category: o.category } : {}),
    prompt: o.prompt,
    data: {},
    answer: { accepted, mode },
    solution: o.solution,
    hints: o.hints,
    errorMap: ohneDoppelte(accepted, errors, mode),
    ...(o.time ? { estimatedTimeSec: o.time } : {}),
  };
}

// ---------- fractions ----------
/** "24/4 = 6", "15/4 = 3 3/4", "12/72 = 1/6": a raw fraction, reduced and as a mixed number. */
export function kette(n: number, d: number): string {
  const r = kuerze({ n, d });
  const out = [`${n}/${d}`];
  if (bruch(r) !== out[out.length - 1]) out.push(bruch(r));
  if (gemischt(r) !== out[out.length - 1]) out.push(gemischt(r));
  return out.join(" = ");
}
const opWort: Record<"+" | "−", string> = { "+": "addieren", "−": "subtrahieren" };
const anwenden = (a: Frac, op: BruchOp, b: Frac) => (op === "+" ? plus(a, b) : op === "−" ? minus(a, b) : op === "·" ? mal(a, b) : durch(a, b));
const verknuepfe = (xs: number[], ops: BruchOp[]) => xs.slice(1).reduce((acc, x, i) => (ops[i] === "+" ? acc + x : acc - x), xs[0]);
/** A fraction as an answer in the form a school book writes it: 3/4, 2 1/2, 3. */
export const bruchAntwort = (f: Frac) => gemischt(kuerze(f));
const istGemischt = (f: Frac) => f.d !== 1 && Math.abs(f.n) > f.d;

/**
 * The worked solution, hints and typical errors of a fraction calculation. Used by the calculations and
 * by the word problems, so a story about pizza explains its sum the same way as the bare calculation.
 */
export function bruchWeg(r: BruchRechnung): { solution: string; hints: string[]; errors: Fehler[] } {
  const [a, b] = r.terms;
  const op = r.ops[0];
  const lines: string[] = [];
  const errors: Fehler[] = [];
  const hints: string[] = [];
  const mixed = r.gemischt && r.terms.some(istGemischt);
  if (mixed) {
    lines.push(`Gemischte Zahlen in unechte Brüche umwandeln: ${r.terms.filter(istGemischt).map((t) => `${gemischt(t)} = ${bruch(t)}`).join(", ")}`);
    hints.push("Wandle die gemischten Zahlen zuerst in unechte Brüche um.");
  }
  const text = mixed ? r.terms.map((t, i) => `${i ? ` ${r.ops[i - 1]} ` : ""}${bruch(t)}`).join("") : bruchText(r);
  if (op === "+" || op === "−") {
    const L = hauptnenner(r);
    const same = r.terms.every((t) => t.d === L);
    const raw = verknuepfe(
      r.terms.map((t) => t.n * (L / t.d)),
      r.ops,
    );
    if (same) {
      lines.push(`Gleiche Nenner: die Zähler ${opWort[op]}, der Nenner bleibt.`);
      lines.push(`${text} = ${kette(raw, L)}`);
      hints.push("Die Nenner sind gleich. Was passiert mit den Zählern?", `Nur die Zähler werden ${op === "+" ? "addiert" : "subtrahiert"}, der Nenner bleibt ${L}.`);
      const [x, y] = [a.n, b.n];
      if (op === "+") errors.push({ answer: bruchAntwort({ n: x + y, d: 2 * L }), label: "Nenner mitaddiert" });
      else errors.push({ answer: bruchAntwort({ n: x + y, d: L }), label: "Zähler addiert statt subtrahiert" });
    } else {
      const erw = r.terms.filter((t) => t.d !== L).map((t) => `${bruch(t)} = ${t.n * (L / t.d)}/${L}`);
      lines.push(`Gemeinsamer Nenner: ${L}`);
      lines.push(erw.join(", "));
      lines.push(`${r.terms.map((t, i) => `${i ? ` ${r.ops[i - 1]} ` : ""}${t.n * (L / t.d)}/${L}`).join("")} = ${kette(raw, L)}`);
      hints.push("Bring alle Brüche zuerst auf einen gemeinsamen Nenner.", `Der kleinste gemeinsame Nenner ist ${L}.`, erw[0]);
      const nSum = verknuepfe(
        r.terms.map((t) => t.n),
        r.ops,
      );
      const dSum = verknuepfe(
        r.terms.map((t) => t.d),
        r.ops,
      );
      // students who calculate numerators and denominators on their own often drop the sign: 1/2 − 3/10 → 2/8
      if (nSum !== 0 && dSum !== 0) errors.push({ answer: bruchAntwort({ n: Math.abs(nSum), d: Math.abs(dSum) }), label: "Zähler und Nenner einzeln gerechnet" });
      if (nSum !== 0) errors.push({ answer: bruchAntwort({ n: Math.abs(nSum), d: L }), label: "Zähler beim Erweitern nicht angepasst" });
    }
    if (r.terms.length === 2 && op === "−") errors.push({ answer: bruchAntwort(plus(a, b)), label: "Addiert statt subtrahiert" });
    if (r.terms.length === 3) {
      // the last sign turned round: 3/4 − 1/3 + 1/6 calculated as 3/4 − 1/3 − 1/6
      const anders = anwenden(anwenden(a, r.ops[0], b), r.ops[1] === "+" ? "−" : "+", r.terms[2]);
      if (anders.n > 0) errors.push({ answer: bruchAntwort(anders), label: "Rechenzeichen verwechselt" });
    }
    if (mixed) {
      // the fraction parts alone, the whole numbers forgotten
      const teil = r.terms.map((t) => kuerze({ n: t.n - Math.trunc(t.n / t.d) * t.d, d: t.d }));
      const ohneGanze = r.ops.reduce((acc, o, i) => anwenden(acc, o, teil[i + 1]), teil[0]);
      if (ohneGanze.n > 0) errors.push({ answer: bruchAntwort(ohneGanze), label: "Die Ganzen vergessen" });
    }
  } else if (op === "·") {
    if (b.d === 1) {
      lines.push(`Nur der Zähler wird mit ${b.n} multipliziert, der Nenner bleibt.`);
      lines.push(`${text} = (${a.n} · ${b.n})/${a.d} = ${kette(a.n * b.n, a.d)}`);
      hints.push(`Rechne ${bruch(a)} · ${b.n} wie ${b.n}-mal ${bruch(a)}.`, "Nur der Zähler wird mit der ganzen Zahl multipliziert.");
      errors.push({ answer: bruchAntwort(a), label: "Zähler und Nenner mit der Zahl multipliziert" });
      errors.push({ answer: bruchAntwort({ n: a.n, d: a.d * b.n }), label: "Durch die Zahl dividiert statt multipliziert" });
    } else {
      lines.push("Zähler mal Zähler, Nenner mal Nenner.");
      lines.push(`${text} = (${a.n} · ${b.n})/(${a.d} · ${b.d}) = ${kette(a.n * b.n, a.d * b.d)}`);
      hints.push("Beim Multiplizieren brauchst du keinen gemeinsamen Nenner.", "Zähler mal Zähler, Nenner mal Nenner.");
      const g1 = gcd(a.n, b.d);
      const g2 = gcd(b.n, a.d);
      if (g1 > 1 || g2 > 1) hints.push(`Kürze vorher über Kreuz: ${g1 > 1 ? `${a.n} und ${b.d} durch ${g1}` : `${b.n} und ${a.d} durch ${g2}`}.`);
      errors.push({ answer: bruchAntwort(durch(a, b)), label: "Mit dem Kehrwert multipliziert (wie beim Dividieren)" });
      if (a.d === b.d) errors.push({ answer: bruchAntwort({ n: a.n * b.n, d: a.d }), label: "Nenner nicht multipliziert" });
      if (mixed) {
        const [wa, wb] = [Math.trunc(a.n / a.d), Math.trunc(b.n / b.d)];
        const einzeln = plus(ganzZahl(wa * wb), mal({ n: a.n - wa * a.d, d: a.d }, { n: b.n - wb * b.d, d: b.d }));
        errors.push({ answer: bruchAntwort(einzeln), label: "Ganze und Brüche einzeln multipliziert" });
      } else errors.push({ answer: bruchAntwort({ n: a.n * b.n, d: a.d + b.d }), label: "Nenner addiert statt multipliziert" });
    }
  } else {
    if (b.d === 1) {
      lines.push(`Durch eine ganze Zahl dividieren: den Nenner mit ${b.n} multiplizieren.`);
      lines.push(`${text} = ${a.n}/(${a.d} · ${b.n}) = ${kette(a.n, a.d * b.n)}`);
      hints.push(`Teile ${bruch(a)} in ${b.n} gleiche Teile.`, "Beim Dividieren durch eine ganze Zahl wird der Nenner mit der Zahl multipliziert.");
      errors.push({ answer: bruchAntwort({ n: a.n * b.n, d: a.d }), label: "Multipliziert statt dividiert" });
    } else {
      const kehr = { n: b.d, d: b.n };
      lines.push("Durch einen Bruch dividieren heißt mit dem Kehrwert multiplizieren.");
      lines.push(`${text} = ${bruch(a)} · ${bruch(kehr)} = (${a.n} · ${b.d})/(${a.d} · ${b.n}) = ${kette(a.n * b.d, a.d * b.n)}`);
      hints.push("Dividieren durch einen Bruch heißt: mit dem Kehrwert multiplizieren.", `Der Kehrwert von ${bruch(b)} ist ${bruch(kehr)}.`);
      errors.push({ answer: bruchAntwort(mal(a, b)), label: "Kehrwert vergessen" });
      errors.push({ answer: bruchAntwort(mal({ n: a.d, d: a.n }, b)), label: "Falschen Bruch umgedreht" });
    }
  }
  return { solution: lines.join("\n"), hints, errors };
}
const ganzZahl = (k: number): Frac => ({ n: k, d: 1 });

const BRUCH_SKILL: Record<BruchOp, string> = { "+": "addieren", "−": "subtrahieren", "·": "multiplizieren", ":": "dividieren" };

function bruchAufgabe(rng: Rng, diff: Difficulty, op: BruchOp): TaskDraft {
  const r = bruchRechnung(rng, STUFE[diff], op);
  const w = bruchWeg(r);
  const res = r.result;
  return kurzaufgabe(`mathe.brueche.${BRUCH_SKILL[op]}`, diff, {
    prompt: `Berechne und kürze das Ergebnis: ${bruchText(r)}`,
    accepted: [bruchAntwort(res), bruch(res)],
    solution: w.solution,
    hints: w.hints,
    errors: w.errors,
  });
}

function kuerzen(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const { q, r, k } = kuerzenAufgabe(rng, lv);
  const teil = [2, 3, 5, 7].find((p) => k % p === 0 && p !== k);
  return kurzaufgabe("mathe.brueche.kuerzen", diff, {
    prompt: `Kürze den Bruch ${bruch(q)} so weit wie möglich.`,
    accepted: [bruch(r), ...(r.n > r.d ? [gemischt(r)] : [])],
    mode: "exact",
    solution: `Der größte gemeinsame Teiler von ${q.n} und ${q.d} ist ${k}.\n${q.n} : ${k} = ${r.n} und ${q.d} : ${k} = ${r.d}\nErgebnis: ${bruch(r)}${r.n > r.d ? ` = ${gemischt(r)}` : ""}`,
    hints: [
      "Suche eine Zahl, durch die Zähler und Nenner beide teilbar sind.",
      lv >= 2 ? "Du kannst auch in mehreren Schritten kürzen, zum Beispiel zuerst durch 2." : "Der größte gemeinsame Teiler (ggT) kürzt in einem Schritt.",
      `Zähler und Nenner sind beide durch ${k} teilbar.`,
    ],
    errors: [
      ...(teil ? [{ answer: bruch({ n: q.n / teil, d: q.d / teil }), label: "Nicht vollständig gekürzt" }] : []),
      { answer: `${r.n}/${q.d}`, label: "Nur den Zähler gekürzt" },
      { answer: `${q.n}/${r.d}`, label: "Nur den Nenner gekürzt" },
    ],
  });
}

function erweitern(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const { base, k, art } = erweiternAufgabe(rng, lv);
  const ziel = { n: base.n * k, d: base.d * k };
  const mitZahl = lv === 0 && rng() < 0.5;
  const prompt = mitZahl
    ? `Erweitere den Bruch ${bruch(base)} mit ${k}.`
    : art === "zaehler"
      ? `Erweitere den Bruch ${bruch(base)} so, dass der Zähler ${ziel.n} ist.`
      : `Erweitere den Bruch ${bruch(base)} auf den Nenner ${ziel.d}.`;
  const solution = mitZahl
    ? `Zähler und Nenner werden mit ${k} multipliziert.\nZähler: ${base.n} · ${k} = ${ziel.n}\nNenner: ${base.d} · ${k} = ${ziel.d}\nErgebnis: ${ziel.n}/${ziel.d}`
    : art === "zaehler"
      ? `${ziel.n} : ${base.n} = ${k}, also wird mit ${k} erweitert.\nNenner: ${base.d} · ${k} = ${ziel.d}\nErgebnis: ${ziel.n}/${ziel.d}`
      : `${ziel.d} : ${base.d} = ${k}, also wird mit ${k} erweitert.\nZähler: ${base.n} · ${k} = ${ziel.n}\nErgebnis: ${ziel.n}/${ziel.d}`;
  const errors: Fehler[] =
    art === "zaehler"
      ? [
          { answer: `${ziel.n}/${base.d}`, label: "Nur den Zähler verändert" },
          { answer: `${ziel.n}/${base.d + ziel.n - base.n}`, label: "Addiert statt multipliziert" },
        ]
      : [
          { answer: `${base.n}/${ziel.d}`, label: "Nur den Nenner verändert" },
          { answer: `${base.n + ziel.d - base.d}/${ziel.d}`, label: "Addiert statt multipliziert" },
          ...(mitZahl ? [{ answer: `${ziel.n}/${base.d}`, label: "Nur den Zähler erweitert" }] : [{ answer: `${base.n * (k + 1)}/${ziel.d}`, label: "Mit der falschen Zahl erweitert" }]),
        ];
  return kurzaufgabe("mathe.brueche.erweitern", diff, {
    prompt,
    accepted: [`${ziel.n}/${ziel.d}`],
    mode: "exact",
    solution,
    hints: [
      mitZahl ? "Erweitern heißt: Zähler und Nenner mit derselben Zahl multiplizieren." : art === "zaehler" ? "Mit welcher Zahl musst du den Zähler multiplizieren, damit der neue Zähler herauskommt?" : "Mit welcher Zahl musst du den Nenner multiplizieren, damit der neue Nenner herauskommt?",
      "Zähler und Nenner werden mit derselben Zahl multipliziert.",
      `Es wird mit ${k} erweitert.`,
    ],
    errors,
  });
}

// ---------- negative numbers ----------
/** A term with negative numbers: the first one without brackets (−7 + 3), later ones in brackets. */
const termZahl = (x: number, i: number) => (i === 0 ? zahl(x) : klammer(x));
const rund = (x: number) => Math.round(x * 10000) / 10000;

function negativAddieren(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const r = [10, 20, 20, 50, 20][lv];
  for (;;) {
    const n = lv <= 1 ? 2 : lv === 3 && rng() < 0.4 ? 4 : 3;
    const wert1 = () => (lv === 4 ? rint(rng, 1, 30) / 2 : rint(rng, 1, r));
    const xs = Array.from({ length: n }, () => wert1() * (rng() < 0.5 ? -1 : 1));
    const ops = xs.slice(1).map(() => pick(rng, ["+", "−"] as const));
    const signed = xs.map((x, i) => (i === 0 || ops[i - 1] === "+" ? x : -x));
    const res = rund(signed.reduce((s, x) => s + x, 0));
    const hatNeg = xs.some((x) => x < 0) || res < 0;
    if (!hatNeg || res === 0 || Math.abs(res) > r || (lv <= 1 && !xs.some((x) => x < 0) && rng() < 0.5)) continue;
    const text = xs.map((x, i) => `${i ? ` ${ops[i - 1]} ` : ""}${termZahl(x, i)}`).join("");
    const ohne = signed.map((x, i) => (i === 0 ? zahl(x) : `${x < 0 ? "−" : "+"} ${zahl(Math.abs(x))}`)).join(" ");
    const lines: string[] = [];
    if (xs.slice(1).some((x) => x < 0)) lines.push(`Ohne Klammern: ${text} = ${ohne}`);
    let acc = signed[0];
    for (const x of signed.slice(1)) {
      const next = rund(acc + x);
      lines.push(`${zahl(acc)} ${x < 0 ? "−" : "+"} ${zahl(Math.abs(x))} = ${zahl(next)}`);
      acc = next;
    }
    // typical errors: "− (−4)" taken as "− 4", "+ (−4)" taken as "+ 4"
    const minusMinus = xs.some((x, i) => i > 0 && x < 0 && ops[i - 1] === "−");
    const plusMinus = xs.some((x, i) => i > 0 && x < 0 && ops[i - 1] === "+");
    const mit = (f: (x: number, i: number) => number) => rund(xs.reduce((s, x, i) => s + f(x, i), 0));
    const errors: Fehler[] = [
      ...(minusMinus ? [{ answer: antwort(mit((x, i) => (i === 0 ? x : ops[i - 1] === "+" ? x : x < 0 ? x : -x))), label: "Minus vor einer negativen Zahl nicht beachtet" }] : []),
      ...(plusMinus ? [{ answer: antwort(mit((x, i) => (i === 0 ? x : ops[i - 1] === "+" ? Math.abs(x) : -x))), label: "Plus vor einer negativen Zahl als Plus gerechnet" }] : []),
      { answer: antwort(-res), label: "Vorzeichenfehler beim Ergebnis" },
    ];
    return kurzaufgabe("mathe.negativ.addieren", diff, {
      prompt: `Berechne: ${text}`,
      accepted: [antwort(res)],
      solution: lines.join("\n"),
      hints: [
        "Stell dir die Zahlengerade vor: Plus heißt nach rechts, Minus nach links.",
        minusMinus ? "Minus eine negative Zahl ist wie Plus: − (−4) = + 4." : plusMinus ? "Plus eine negative Zahl ist wie Minus: + (−4) = − 4." : "Rechne Schritt für Schritt von links nach rechts.",
        lines[0],
      ],
      errors,
    });
  }
}

function negativMultiplizieren(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["mal", "mal", "durch"] as const) : lv <= 2 ? (["mal", "durch", lv === 2 ? "drei" : "mal"] as const) : (["mal", "durch", "drei", "gemischt"] as const));
    const f = (min: number, max: number) => (lv === 4 && rng() < 0.5 ? pick(rng, [0.5, 1.5, 2.5, 0.2, 0.4]) : rint(rng, min, max)) * (rng() < 0.55 ? -1 : 1);
    let text: string;
    let res: number;
    let lines: string[];
    const errors: Fehler[] = [];
    if (kind === "mal") {
      const [a, b] = lv === 3 ? [rint(rng, 11, 25) * (rng() < 0.5 ? -1 : 1), f(2, 9)] : [f(2, [6, 10, 10, 12, 10][lv]), f(2, [6, 10, 10, 12, 10][lv])];
      res = rund(a * b);
      text = `${klammer(a)} · ${klammer(b)}`;
      lines = [`${text} = ${zahl(res)}`];
      errors.push({ answer: antwort(-res), label: "Vorzeichenregel nicht angewendet" }, { answer: antwort(rund(a + b)), label: "Addiert statt multipliziert" });
    } else if (kind === "durch") {
      const q = f(2, [6, 10, 12, 15, 10][lv]);
      const b = f(2, [6, 10, 9, 12, 8][lv]);
      const a = rund(q * b);
      res = q;
      text = `${klammer(a)} : ${klammer(b)}`;
      lines = [`${text} = ${zahl(res)}`];
      errors.push({ answer: antwort(-res), label: "Vorzeichenregel nicht angewendet" });
    } else if (kind === "drei") {
      const xs = [f(2, 5), f(2, 5), f(2, lv >= 3 ? 6 : 5)];
      res = rund(xs[0] * xs[1] * xs[2]);
      text = xs.map(klammer).join(" · ");
      lines = [`${text} = ${klammer(rund(xs[0] * xs[1]))} · ${klammer(xs[2])} = ${zahl(res)}`];
      errors.push({ answer: antwort(-res), label: "Minuszeichen falsch gezählt" });
    } else {
      // (−48) : 6 · (−2)
      const q = f(2, 9);
      const b = f(2, 8);
      const c = f(2, 5);
      const a = rund(q * b);
      res = rund(q * c);
      text = `${klammer(a)} : ${klammer(b)} · ${klammer(c)}`;
      lines = [`${text} = ${klammer(q)} · ${klammer(c)} = ${zahl(res)}`];
      errors.push({ answer: antwort(-res), label: "Vorzeichenregel nicht angewendet" });
      if (Number.isInteger(a / (b * c))) errors.push({ answer: antwort(rund(a / (b * c))), label: "Von rechts nach links gerechnet" });
    }
    const minusZeichen = (text.match(/−/g) ?? []).length;
    if (minusZeichen === 0 || res === 0 || Math.abs(res) > 200) continue;
    return kurzaufgabe("mathe.negativ.multiplizieren", diff, {
      prompt: `Berechne: ${text}`,
      accepted: [antwort(res)],
      solution: `${minusZeichen === 1 ? "Ein Minuszeichen" : `${minusZeichen} Minuszeichen`}: ${minusZeichen % 2 ? "ungerade Anzahl, das Ergebnis ist negativ" : "gerade Anzahl, das Ergebnis ist positiv"}.\n${lines.join("\n")}`,
      hints: ["Rechne zuerst ohne Vorzeichen.", "Gleiche Vorzeichen ergeben Plus, verschiedene Vorzeichen ergeben Minus.", "Zähle die Minuszeichen: gerade Anzahl heißt Plus, ungerade heißt Minus."],
      errors,
    });
  }
}

// ---------- percentages ----------
/** The Prozentwert, worked the way a school book does it for this percentage (half, quarter, 1 %). */
export function prozentwertWeg(G: number, p: number, W: number, einheit = "€"): string[] {
  const u = einheit ? ` ${einheit}` : "";
  const g = (x: number) => (einheit === "€" ? geld(x) : zahl(x));
  if (p === 50) return [`50 % ist die Hälfte: ${g(G)}${u} : 2 = ${g(W)}${u}`];
  if (p === 25) return [`25 % ist ein Viertel: ${g(G)}${u} : 4 = ${g(W)}${u}`];
  if (p === 10) return [`10 % ist ein Zehntel: ${g(G)}${u} : 10 = ${g(W)}${u}`];
  if (p === 20 || p === 30 || p === 40) return [`10 % = ${g(G)}${u} : 10 = ${zahl(G / 10)}${u}`, `${p} % = ${zahl(G / 10)}${u} · ${p / 10} = ${g(W)}${u}`];
  if (p === 75) return [`25 % = ${g(G)}${u} : 4 = ${zahl(G / 4)}${u}`, `75 % = ${zahl(G / 4)}${u} · 3 = ${g(W)}${u}`];
  return [`1 % = ${g(G)}${u} : 100 = ${zahl(G / 100)}${u}`, `${zahl(p)} % = ${zahl(G / 100)}${u} · ${zahl(p)} = ${g(W)}${u}`];
}

function prozentwert(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const { G, p, W } = prozentFall(rng, lv, "wert");
  const weg = prozentwertWeg(G, p, W);
  return kurzaufgabe("mathe.prozent.prozentwert", diff, {
    prompt: `Wie viel sind ${zahl(p)} % von ${euro(G)}? Gib das Ergebnis in Euro an.`,
    accepted: [geldAntwort(W), `${geldAntwort(W)} €`],
    solution: weg.join("\n"),
    hints: ["1 % ist der hundertste Teil des Grundwerts.", `Berechne zuerst 1 % von ${euro(G)}.`, weg[0]],
    errors: [
      { answer: antwort(rund(G * p)), label: "Durch 100 dividieren vergessen" },
      { answer: antwort(rund(G / p)), label: "Durch den Prozentsatz dividiert statt multipliziert" },
    ],
  });
}

function prozentsatz(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const { G, p, W } = prozentFall(rng, lv, "satz");
  return kurzaufgabe("mathe.prozent.prozentsatz", diff, {
    prompt: `Wie viel Prozent sind ${euro(W)} von ${euro(G)}? Gib das Ergebnis in Prozent an.`,
    accepted: [antwort(p), `${antwort(p)} %`],
    solution: `${geld(W)} € : ${geld(G)} € = ${zahl(p / 100)}\n${zahl(p / 100)} = ${zahl(p)} %`,
    hints: ["Teile den Teil (Prozentwert) durch das Ganze (Grundwert).", "Die Dezimalzahl mal 100 gibt die Prozent.", `${geld(W)} : ${geld(G)} = ${zahl(p / 100)}`],
    errors: [
      { answer: antwort(p / 100), label: "Mal 100 vergessen" },
      { answer: antwort(rund((G / W) * 100)), label: "Grundwert und Prozentwert vertauscht" },
    ],
  });
}

function grundwert(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const { G, p, W } = prozentFall(rng, lv, "grund");
  return kurzaufgabe("mathe.prozent.grundwert", diff, {
    prompt: `${zahl(p)} % eines Betrags sind ${euro(W)}. Wie groß ist der ganze Betrag (100 %)?`,
    accepted: [geldAntwort(G), `${geldAntwort(G)} €`],
    solution: `${zahl(p)} % = ${geld(W)} €\n1 % = ${geld(W)} € : ${zahl(p)} = ${zahl(G / 100)} €\n100 % = ${zahl(G / 100)} € · 100 = ${geld(G)} €`,
    hints: [`Wenn ${zahl(p)} % gleich ${euro(W)} sind, wie viel ist dann 1 %?`, "Vom 1 % kommst du mit · 100 zum Ganzen.", `1 % = ${geld(W)} € : ${zahl(p)}`],
    errors: [
      { answer: antwort(rund((W * p) / 100)), label: "Prozentwert statt Grundwert berechnet" },
      { answer: antwort(rund(W * 100)), label: "Durch den Prozentsatz dividieren vergessen" },
    ],
  });
}

// ---------- equations ----------
/** The first step of a solution path as a hint ("Rechne auf beiden Seiten − 4."). */
export function ersterSchritt(g: Gleichung): string {
  const op = g.ops[0] ?? "";
  if (op.startsWith("|")) return `Rechne zuerst auf beiden Seiten ${op.slice(1).trim()}.`;
  if (/Klammer/.test(op)) return `Löse zuerst ${/Klammern/.test(op) ? "die Klammern" : "die Klammer"} auf: ${g.lines[1]}`;
  return "Bring alle x auf eine Seite und alle Zahlen auf die andere.";
}

function gleichungAufgabe(skillId: string, diff: Difficulty, g: Gleichung): TaskDraft {
  const x = xAntwort(g);
  return kurzaufgabe(skillId, diff, {
    prompt: `Löse die Gleichung: ${g.start}`,
    accepted: [x, `x = ${x}`, `x=${x}`],
    solution: gleichungWeg(g),
    hints: [g.hint, ersterSchritt(g), ...(g.x.d !== 1 ? ["Die Lösung ist hier ein Bruch, zum Beispiel 3/2."] : [])],
    errors: g.errors.map((e) => ({ answer: fehlerAntwort(g, e.x), label: e.label })),
  });
}

// ---------- powers ----------
function potenzen(rng: Rng, diff: Difficulty): TaskDraft {
  const lv: Stufe = STUFE[diff];
  const p = potenzAufgabe(rng, lv);
  const result = potenz(p.base, p.e, p.k);
  return kurzaufgabe("mathe.potenzen.regeln", diff, {
    prompt: `${p.eine ? "Schreib als eine Potenz" : "Vereinfache"}: ${p.start}`,
    accepted: potenzVarianten(p.base, p.e, p.k),
    mode: "text",
    solution: `${p.rule}\n${p.start} = ${p.steps.join(" = ")}`,
    hints: [p.rule, "Hochzahlen schreibst du mit ^, zum Beispiel x^5 für x hoch 5.", `${p.start} = ${p.steps[0]}`],
    errors: p.errors.filter((e) => e.answer !== result),
  });
}

/** The calculations of the built-in maths skills (mathe.gleichungen.text is a word problem, lib/textaufgaben.ts). */
export const MATHE_RECHNUNGEN: Record<string, (rng: Rng, diff: Difficulty) => TaskDraft> = {
  "mathe.brueche.kuerzen": kuerzen,
  "mathe.brueche.erweitern": erweitern,
  "mathe.brueche.addieren": (rng, diff) => bruchAufgabe(rng, diff, "+"),
  "mathe.brueche.subtrahieren": (rng, diff) => bruchAufgabe(rng, diff, "−"),
  "mathe.brueche.multiplizieren": (rng, diff) => bruchAufgabe(rng, diff, "·"),
  "mathe.brueche.dividieren": (rng, diff) => bruchAufgabe(rng, diff, ":"),
  "mathe.negativ.addieren": negativAddieren,
  "mathe.negativ.multiplizieren": negativMultiplizieren,
  "mathe.prozent.prozentwert": prozentwert,
  "mathe.prozent.prozentsatz": prozentsatz,
  "mathe.prozent.grundwert": grundwert,
  "mathe.gleichungen.einfach": (rng, diff) => gleichungAufgabe("mathe.gleichungen.einfach", diff, gleichungEinfach(rng, STUFE[diff])),
  "mathe.gleichungen.klammern": (rng, diff) => gleichungAufgabe("mathe.gleichungen.klammern", diff, gleichungKlammern(rng, STUFE[diff])),
  "mathe.potenzen.regeln": potenzen,
};

