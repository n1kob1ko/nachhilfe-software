/**
 * Built-in exercise generators. They work without any AI service and always produce
 * a correct solution path. Math is generated procedurally; language tasks come from
 * curated item banks.
 */
import type { Difficulty, TaskType } from "./curriculum";
import type { TaskDraft } from "./tasks";
import { GAP, parseNumber } from "./tasks";

type Rng = () => number;
const rint = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LEVEL: Record<Difficulty, number> = { leicht: 0, "leicht bis mittel": 1, mittel: 2, schwer: 3 };

// ---------- fractions ----------
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);
type Frac = { n: number; d: number };
const reduce = ({ n, d }: Frac): Frac => {
  const g = gcd(n, d) || 1;
  const sign = d < 0 ? -1 : 1;
  return { n: (sign * n) / g, d: (sign * d) / g };
};
const fs = ({ n, d }: Frac) => (d === 1 ? `${n}` : `${n}/${d}`);
const val = (f: Frac) => f.n / f.d;

function properFrac(rng: Rng, maxDen: number): Frac {
  const d = rint(rng, 2, maxDen);
  const n = rint(rng, 1, d - 1);
  return reduce({ n, d }).d === 1 ? properFrac(rng, maxDen) : reduce({ n, d });
}

function shortAnswer(
  skillId: string,
  difficulty: Difficulty,
  prompt: string,
  answer: string,
  solution: string,
  hints: string[],
  errors: { answer: string; label: string }[],
  mode: "value" | "exact" | "text" = "value",
  extraAccepted: string[] = [],
): TaskDraft {
  return {
    type: "calc",
    skillId,
    difficulty,
    prompt,
    data: {},
    answer: { accepted: [answer, ...extraAccepted], mode },
    solution,
    hints,
    errorMap: dedupeErrors(answer, errors, mode),
  };
}

/** Drops typical errors that coincide with the right answer or with an earlier error. */
function dedupeErrors(answer: string, errors: { answer: string; label: string }[], mode: "value" | "exact" | "text") {
  const key = (a: string) => (mode === "value" ? String(parseNumber(a) ?? a) : mode === "text" ? a.toLowerCase() : a);
  const seen = new Set([key(answer)]);
  return errors.filter((e) => {
    const k = key(e.answer);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

type Gen = (rng: Rng, difficulty: Difficulty) => TaskDraft;

const GEN: Record<string, Gen> = {
  "mathe.brueche.kuerzen": (rng, diff) => {
    const lv = LEVEL[diff];
    const base = properFrac(rng, [6, 9, 12, 15][lv]);
    const k = pick(rng, [[2, 3, 5], [2, 3, 4, 5], [4, 6, 8, 9], [6, 8, 12, 15]][lv]);
    const q: Frac = { n: base.n * k, d: base.d * k };
    const smallFactor = [2, 3, 5].find((p) => k % p === 0 && p !== k);
    const errors = smallFactor
      ? [{ answer: fs({ n: q.n / smallFactor, d: q.d / smallFactor }), label: "Nicht vollständig gekürzt" }]
      : [];
    return shortAnswer(
      "mathe.brueche.kuerzen",
      diff,
      `Kürze den Bruch ${fs(q)} so weit wie möglich.`,
      fs(base),
      `Der größte gemeinsame Teiler von ${q.n} und ${q.d} ist ${k}.\n${q.n} : ${k} = ${base.n} und ${q.d} : ${k} = ${base.d}.\nErgebnis: ${fs(base)}`,
      ["Suche den größten gemeinsamen Teiler (ggT) von Zähler und Nenner.", `Zähler und Nenner sind beide durch ${k} teilbar.`],
      errors,
      "exact",
    );
  },
  "mathe.brueche.erweitern": (rng, diff) => {
    const lv = LEVEL[diff];
    const base = properFrac(rng, [6, 8, 10, 12][lv]);
    const k = rint(rng, 2, [4, 6, 8, 12][lv]);
    const target = base.d * k;
    return shortAnswer(
      "mathe.brueche.erweitern",
      diff,
      `Erweitere ${fs(base)} auf den Nenner ${target}.`,
      `${base.n * k}/${target}`,
      `${target} : ${base.d} = ${k}, also wird mit ${k} erweitert.\nZähler: ${base.n} · ${k} = ${base.n * k}\nErgebnis: ${base.n * k}/${target}`,
      ["Mit welcher Zahl musst du den Nenner multiplizieren, um auf den neuen Nenner zu kommen?", "Zähler und Nenner werden mit derselben Zahl multipliziert."],
      [
        { answer: `${base.n}/${target}`, label: "Nur den Nenner verändert" },
        { answer: `${base.n + (target - base.d)}/${target}`, label: "Addiert statt multipliziert" },
      ],
      "exact",
    );
  },
  "mathe.brueche.addieren": (rng, diff) => fracOp(rng, diff, "+"),
  "mathe.brueche.subtrahieren": (rng, diff) => fracOp(rng, diff, "-"),
  "mathe.brueche.multiplizieren": (rng, diff) => fracOp(rng, diff, "·"),
  "mathe.brueche.dividieren": (rng, diff) => fracOp(rng, diff, ":"),

  "mathe.negativ.addieren": (rng, diff) => {
    const lv = LEVEL[diff];
    const r = [10, 20, 50, 100][lv];
    const a = rint(rng, -r, r);
    const b = rint(rng, 1, r);
    const op = pick(rng, ["+", "-"] as const);
    const bStr = rng() < 0.5 ? `(−${b})` : `${b}`;
    const bVal = bStr.startsWith("(") ? -b : b;
    const res = op === "+" ? a + bVal : a - bVal;
    const aStr = a < 0 ? `(−${-a})` : `${a}`;
    return shortAnswer(
      "mathe.negativ.addieren",
      diff,
      `Berechne: ${aStr} ${op} ${bStr}`,
      `${res}`,
      `${op === "-" && bVal < 0 ? "Minus mal Minus ergibt Plus: " : ""}${aStr} ${op} ${bStr} = ${res}`,
      ["Stell dir die Zahlengerade vor.", "Zwei Minus hintereinander werden zu einem Plus."],
      [{ answer: `${-res}`, label: "Vorzeichenfehler" }],
    );
  },
  "mathe.negativ.multiplizieren": (rng, diff) => {
    const lv = LEVEL[diff];
    const r = [6, 9, 12, 15][lv];
    const a = rint(rng, 2, r) * (rng() < 0.5 ? -1 : 1);
    const b = rint(rng, 2, r) * (rng() < 0.6 ? -1 : 1);
    const div = rng() < 0.4;
    const show = (x: number) => (x < 0 ? `(−${-x})` : `${x}`);
    const prompt = div ? `Berechne: ${show(a * b)} : ${show(b)}` : `Berechne: ${show(a)} · ${show(b)}`;
    const res = div ? a : a * b;
    return shortAnswer(
      "mathe.negativ.multiplizieren",
      diff,
      prompt,
      `${res}`,
      `Gleiche Vorzeichen ergeben Plus, verschiedene Vorzeichen ergeben Minus.\nErgebnis: ${res}`,
      ["Rechne zuerst ohne Vorzeichen.", "Gleiche Vorzeichen → Plus, verschiedene → Minus."],
      [{ answer: `${-res}`, label: "Vorzeichenregel nicht angewendet" }],
    );
  },

  "mathe.prozent.prozentwert": (rng, diff) => {
    const lv = LEVEL[diff];
    const G = pick(rng, [[100, 200, 50, 400], [80, 120, 250, 600], [75, 240, 360, 1250], [48, 85, 1260, 3450]][lv]);
    const p = pick(rng, [[10, 25, 50], [5, 15, 20, 30], [12, 35, 40, 8], [2.5, 17, 12.5, 7]][lv]);
    const W = round2((G * p) / 100);
    return shortAnswer(
      "mathe.prozent.prozentwert",
      diff,
      `Wie viel sind ${de(p)} % von ${de(G)} €? (Ergebnis in €)`,
      `${W}`,
      `W = G · p / 100 = ${de(G)} · ${de(p)} / 100 = ${de(W)} €`,
      ["1 % ist ein Hundertstel des Grundwerts.", `Berechne zuerst 1 % von ${de(G)}.`],
      [{ answer: `${G * p}`, label: "Durch 100 dividieren vergessen" }],
    );
  },
  "mathe.prozent.prozentsatz": (rng, diff) => {
    const lv = LEVEL[diff];
    const G = pick(rng, [[100, 200, 50], [40, 80, 250, 500], [60, 120, 360, 750], [64, 125, 480, 1600]][lv]);
    const p = pick(rng, [[10, 20, 50], [5, 25, 40, 75], [12.5, 15, 35, 60], [2.5, 7.5, 37.5, 62.5]][lv]);
    const W = round2((G * p) / 100);
    return shortAnswer(
      "mathe.prozent.prozentsatz",
      diff,
      `${de(W)} € von ${de(G)} € – wie viel Prozent sind das? (Ergebnis in %)`,
      `${p}`,
      `p = W / G · 100 = ${de(W)} / ${de(G)} · 100 = ${de(p)} %`,
      ["Teile den Prozentwert durch den Grundwert.", "Vergiss nicht, mit 100 zu multiplizieren."],
      [{ answer: `${round2(W / G)}`, label: "Mal 100 vergessen" }],
    );
  },
  "mathe.prozent.grundwert": (rng, diff) => {
    const lv = LEVEL[diff];
    const G = pick(rng, [[100, 200, 400], [80, 160, 500, 300], [240, 360, 640, 900], [1250, 480, 2400, 760]][lv]);
    const p = pick(rng, [[10, 25, 50], [5, 20, 40], [15, 30, 12.5], [7.5, 2.5, 35]][lv]);
    const W = round2((G * p) / 100);
    return shortAnswer(
      "mathe.prozent.grundwert",
      diff,
      `${de(p)} % eines Betrags sind ${de(W)} €. Wie groß ist der ganze Betrag? (Ergebnis in €)`,
      `${G}`,
      `G = W · 100 / p = ${de(W)} · 100 / ${de(p)} = ${de(G)} €`,
      [`Wenn ${de(p)} % = ${de(W)} €, wie viel ist dann 1 %?`, "Grundwert = Prozentwert · 100 / Prozentsatz."],
      [{ answer: `${round2((W * p) / 100)}`, label: "Prozentwert statt Grundwert berechnet" }],
    );
  },

  "mathe.gleichungen.einfach": (rng, diff) => {
    const lv = LEVEL[diff];
    const x = rint(rng, -[5, 10, 15, 20][lv] * (lv > 0 ? 1 : 0), [10, 12, 15, 20][lv]);
    const a = rint(rng, 2, [5, 9, 12, 15][lv]);
    const b = rint(rng, 1, [10, 20, 30, 50][lv]) * (lv > 1 && rng() < 0.5 ? -1 : 1);
    const c = a * x + b;
    const bs = b < 0 ? `− ${-b}` : `+ ${b}`;
    return shortAnswer(
      "mathe.gleichungen.einfach",
      diff,
      `Löse die Gleichung: ${a}x ${bs} = ${c}`,
      `${x}`,
      `${a}x ${bs} = ${c}   | ${b < 0 ? `+ ${-b}` : `− ${b}`}\n${a}x = ${c - b}   | : ${a}\nx = ${x}`,
      ["Bring zuerst die Zahl ohne x auf die andere Seite.", `Teile am Ende durch ${a}.`],
      [
        { answer: `${(c + b) / a}`, label: "Vorzeichenfehler beim Umformen" },
        { answer: `${c - b}`, label: "Durch den Koeffizienten teilen vergessen" },
      ],
      "value",
      [`x=${x}`],
    );
  },
  "mathe.gleichungen.klammern": (rng, diff) => {
    const lv = LEVEL[diff];
    const x = rint(rng, lv > 1 ? -8 : 1, 10);
    const a = rint(rng, 2, [4, 6, 8, 9][lv]);
    const b = rint(rng, 1, [5, 8, 12, 15][lv]);
    const c = a * (x + b);
    return shortAnswer(
      "mathe.gleichungen.klammern",
      diff,
      `Löse die Gleichung: ${a}(x + ${b}) = ${c}`,
      `${x}`,
      `Klammer auflösen: ${a}x + ${a * b} = ${c}   | − ${a * b}\n${a}x = ${c - a * b}   | : ${a}\nx = ${x}`,
      ["Multipliziere die Zahl vor der Klammer mit jedem Glied in der Klammer.", `${a} · ${b} = ${a * b}`],
      [{ answer: `${(c - b) / a}`, label: "Klammer nicht vollständig ausmultipliziert" }],
      "value",
      [`x=${x}`],
    );
  },
  "mathe.gleichungen.text": (rng, diff) => {
    const lv = LEVEL[diff];
    const x = rint(rng, 2, [10, 15, 25, 40][lv]);
    const a = rint(rng, 2, [4, 5, 7, 9][lv]);
    const b = rint(rng, 1, [10, 20, 30, 50][lv]);
    const c = a * x + b;
    return shortAnswer(
      "mathe.gleichungen.text",
      diff,
      `Ich denke mir eine Zahl, multipliziere sie mit ${a} und addiere ${b}. Ich erhalte ${c}. Wie heißt die Zahl?`,
      `${x}`,
      `Gleichung: ${a}x + ${b} = ${c}\n${a}x = ${c - b}\nx = ${x}`,
      ["Nenne die gesuchte Zahl x und schreib eine Gleichung.", `${a}x + ${b} = ${c}`],
      [{ answer: `${(c + b) / a}`, label: "Vorzeichenfehler beim Umformen" }],
    );
  },
  "mathe.potenzen.regeln": (rng, diff) => {
    const lv = LEVEL[diff];
    const m = rint(rng, 2, [5, 7, 9, 12][lv]);
    const n = rint(rng, 2, [4, 6, 8, 10][lv]);
    const kind = pick(rng, ["mul", "div", "pow"] as const);
    if (kind === "mul")
      return shortAnswer("mathe.potenzen.regeln", diff, `Vereinfache: x^${m} · x^${n} = x^?  (Gib den Exponenten an.)`, `${m + n}`,
        `Gleiche Basis, multiplizieren → Exponenten addieren: ${m} + ${n} = ${m + n}`,
        ["Bei der Multiplikation von Potenzen mit gleicher Basis werden die Exponenten …?"],
        [{ answer: `${m * n}`, label: "Exponenten multipliziert statt addiert" }]);
    if (kind === "div") {
      const big = m + n;
      return shortAnswer("mathe.potenzen.regeln", diff, `Vereinfache: x^${big} : x^${n} = x^?  (Gib den Exponenten an.)`, `${m}`,
        `Gleiche Basis, dividieren → Exponenten subtrahieren: ${big} − ${n} = ${m}`,
        ["Bei der Division werden die Exponenten subtrahiert."],
        [{ answer: `${big / n}`, label: "Exponenten dividiert statt subtrahiert" }]);
    }
    return shortAnswer("mathe.potenzen.regeln", diff, `Vereinfache: (x^${m})^${n} = x^?  (Gib den Exponenten an.)`, `${m * n}`,
      `Potenz einer Potenz → Exponenten multiplizieren: ${m} · ${n} = ${m * n}`,
      ["Beim Potenzieren einer Potenz werden die Exponenten multipliziert."],
      [{ answer: `${m + n}`, label: "Exponenten addiert statt multipliziert" }]);
  },

  "deutsch.beistrich.aufzaehlung": bankMC("deutsch.beistrich.aufzaehlung", () => BEISTRICH_AUFZ),
  "deutsch.beistrich.nebensatz": bankMC("deutsch.beistrich.nebensatz", () => BEISTRICH_NS),
  "deutsch.beistrich.infinitiv": bankMC("deutsch.beistrich.infinitiv", () => BEISTRICH_INF),
  "deutsch.recht.dasdass": bankCloze("deutsch.recht.dasdass", () => DAS_DASS, "text"),
  "deutsch.recht.gross": bankCloze("deutsch.recht.gross", () => GROSS, "exact"),
  "deutsch.recht.sss": bankCloze("deutsch.recht.sss", () => SSS, "exact"),
  "deutsch.grammatik.faelle": bankMC("deutsch.grammatik.faelle", () => FAELLE),
  "deutsch.grammatik.zeiten": bankMC("deutsch.grammatik.zeiten", () => ZEITEN),
  "englisch.tenses.presentsimple": bankCloze("englisch.tenses.presentsimple", () => PRESENT_SIMPLE, "text"),
  "englisch.tenses.pastsimple": bankCloze("englisch.tenses.pastsimple", () => PAST_SIMPLE, "text"),
  "englisch.tenses.presentperfect": bankCloze("englisch.tenses.presentperfect", () => PRESENT_PERFECT, "text"),
  "englisch.vocab.irregular": (rng, diff) => {
    const [inf, past, pp] = pick(rng, IRREGULAR);
    const askPP = LEVEL[diff] >= 1 && rng() < 0.6;
    return {
      ...shortAnswer(
        "englisch.vocab.irregular",
        diff,
        askPP ? `Give the past participle (3rd form) of “${inf}”.` : `Give the past simple (2nd form) of “${inf}”.`,
        askPP ? pp : past,
        `${inf} – ${past} – ${pp}`,
        ["This is an irregular verb, so it does not end in -ed.", `The forms are: ${inf} – ? – ?`],
        [
          { answer: `${inf.replace(/e$/, "")}ed`, label: "Unregelmäßiges Verb regelmäßig gebildet" },
          { answer: askPP ? past : pp, label: askPP ? "2. statt 3. Form" : "3. statt 2. Form" },
        ],
        "text",
      ),
      type: "grammar",
    };
  },
  "englisch.grammar.comparatives": bankCloze("englisch.grammar.comparatives", () => COMPARATIVES, "text"),
};

function round2(x: number) {
  return Math.round(x * 100) / 100;
}
function de(x: number) {
  return String(x).replace(".", ",");
}

function fracOp(rng: Rng, diff: Difficulty, op: "+" | "-" | "·" | ":"): TaskDraft {
  const lv = LEVEL[diff];
  const maxDen = [6, 9, 12, 16][lv];
  for (let tries = 0; tries < 50; tries++) {
    let a = properFrac(rng, maxDen);
    let b = properFrac(rng, maxDen);
    if (lv === 0 && (op === "+" || op === "-")) b = { n: rint(rng, 1, a.d - 1), d: a.d };
    if (op === "-" && val(a) < val(b)) [a, b] = [b, a];
    if (val(a) === val(b)) continue;
    const res =
      op === "+"
        ? reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d })
        : op === "-"
          ? reduce({ n: a.n * b.d - b.n * a.d, d: a.d * b.d })
          : op === "·"
            ? reduce({ n: a.n * b.n, d: a.d * b.d })
            : reduce({ n: a.n * b.d, d: a.d * b.n });
    const errors: { answer: string; label: string }[] = [];
    let solution = "";
    let hints: string[] = [];
    if (op === "+" || op === "-") {
      const L = lcm(a.d, b.d);
      const an = a.n * (L / a.d);
      const bn = b.n * (L / b.d);
      const raw = op === "+" ? an + bn : an - bn;
      solution =
        (a.d === b.d
          ? `Gleiche Nenner: Zähler ${op === "+" ? "addieren" : "subtrahieren"}, Nenner bleibt.\n`
          : `Gemeinsamer Nenner: ${L}\n${fs(a)} = ${an}/${L},  ${fs(b)} = ${bn}/${L}\n`) +
        `${an}/${L} ${op} ${bn}/${L} = ${raw}/${L}` +
        (fs(res) !== `${raw}/${L}` ? `\nGekürzt: ${fs(res)}` : "");
      hints = a.d === b.d ? ["Die Nenner sind gleich – was passiert mit den Zählern?"] : ["Bring beide Brüche zuerst auf einen gemeinsamen Nenner.", `Ein gemeinsamer Nenner ist ${L}.`];
      const wrongN = op === "+" ? a.n + b.n : a.n - b.n;
      const wrongD = op === "+" ? a.d + b.d : a.d - b.d;
      if (wrongD > 0 && a.d !== b.d) errors.push({ answer: fs(reduce({ n: wrongN, d: wrongD })), label: "Zähler und Nenner einzeln gerechnet" });
      if (a.d !== b.d) errors.push({ answer: fs(reduce({ n: wrongN, d: L })), label: "Zähler beim Erweitern nicht angepasst" });
      if (a.d === b.d) errors.push({ answer: fs(reduce({ n: wrongN, d: a.d * 2 })), label: "Nenner mitaddiert" });
    } else if (op === "·") {
      solution = `Zähler mal Zähler, Nenner mal Nenner:\n${fs(a)} · ${fs(b)} = ${a.n * b.n}/${a.d * b.d}` + (fs(res) !== `${a.n * b.n}/${a.d * b.d}` ? ` = ${fs(res)}` : "");
      hints = ["Beim Multiplizieren brauchst du keinen gemeinsamen Nenner.", "Zähler · Zähler und Nenner · Nenner."];
      errors.push({ answer: fs(reduce({ n: a.n * b.d, d: a.d * b.n })), label: "Mit dem Kehrwert multipliziert (wie bei Division)" });
      if (a.d === b.d) errors.push({ answer: fs(reduce({ n: a.n * b.n, d: a.d })), label: "Nenner nicht multipliziert" });
    } else {
      const kehr = { n: b.d, d: b.n };
      solution = `Durch einen Bruch dividieren heißt mit dem Kehrwert multiplizieren:\n${fs(a)} : ${fs(b)} = ${fs(a)} · ${fs(kehr)} = ${a.n * b.d}/${a.d * b.n}` + (fs(res) !== `${a.n * b.d}/${a.d * b.n}` ? ` = ${fs(res)}` : "");
      hints = ["Dividieren durch einen Bruch = multiplizieren mit dem Kehrwert.", `Der Kehrwert von ${fs(b)} ist ${fs(kehr)}.`];
      errors.push({ answer: fs(reduce({ n: a.n * b.n, d: a.d * b.d })), label: "Kehrwert vergessen" });
      errors.push({ answer: fs(reduce({ n: a.d * b.n, d: a.n * b.d })), label: "Falschen Bruch umgedreht" });
    }
    const uniq = errors.filter((e) => Math.abs(evalFrac(e.answer) - val(res)) > 1e-9);
    const skill = { "+": "addieren", "-": "subtrahieren", "·": "multiplizieren", ":": "dividieren" }[op];
    return shortAnswer(
      `mathe.brueche.${skill}`,
      diff,
      `Berechne und kürze das Ergebnis: ${fs(a)} ${op} ${fs(b)}`,
      fs(res),
      solution,
      hints,
      uniq,
    );
  }
  throw new Error("could not generate fraction task");
}
function evalFrac(s: string) {
  const [n, d] = s.split("/").map(Number);
  return d ? n / d : n;
}

// ---------- item banks ----------
type MCItem = { q: string; options: string[]; correct: number; solution: string; hint: string; errors?: Record<number, string> };
type ClozeItem = { q: string; blanks: string[][]; solution: string; hint: string; errors?: Record<string, string> };

function bankMC(skillId: string, bank: () => MCItem[]): Gen {
  return (rng, diff) => {
    const item = pick(rng, bank());
    return {
      type: "mc",
      skillId,
      difficulty: diff,
      prompt: item.q,
      data: { options: item.options },
      answer: { correct: item.correct },
      solution: item.solution,
      hints: [item.hint],
      errorMap: Object.entries(item.errors ?? {}).map(([k, label]) => ({ answer: k, label })),
    };
  };
}
function bankCloze(skillId: string, bank: () => ClozeItem[], mode: "text" | "exact"): Gen {
  return (rng, diff) => {
    const item = pick(rng, bank());
    return {
      type: "cloze",
      skillId,
      difficulty: diff,
      prompt: item.q,
      data: {},
      answer: { blanks: item.blanks, mode },
      solution: item.solution,
      hints: [item.hint],
      errorMap: Object.entries(item.errors ?? {}).map(([answer, label]) => ({ answer, label })),
    };
  };
}

const NS_ERR = { 1: "Beistrich vor dem Nebensatz vergessen", 2: "Beistrich an falscher Stelle" };
const BEISTRICH_NS: MCItem[] = [
  ["Ich gehe heute früh schlafen, weil ich morgen eine Schularbeit habe.", "Ich gehe heute früh schlafen weil ich morgen eine Schularbeit habe.", "Ich gehe heute früh, schlafen weil ich morgen eine Schularbeit habe.", "weil"],
  ["Der Hund, der im Garten bellt, gehört meinem Nachbarn.", "Der Hund der im Garten bellt gehört meinem Nachbarn.", "Der Hund der im Garten, bellt gehört meinem Nachbarn.", "der (Relativsatz)"],
  ["Wenn es morgen regnet, bleiben wir zu Hause.", "Wenn es morgen regnet bleiben wir zu Hause.", "Wenn es morgen, regnet bleiben wir zu Hause.", "wenn"],
  ["Sie weiß nicht, ob sie zur Party gehen soll.", "Sie weiß nicht ob sie zur Party gehen soll.", "Sie weiß, nicht ob sie zur Party gehen soll.", "ob"],
  ["Ich glaube, dass er Recht hat.", "Ich glaube dass er Recht hat.", "Ich glaube dass, er Recht hat.", "dass"],
  ["Nachdem wir gegessen hatten, gingen wir spazieren.", "Nachdem wir gegessen hatten gingen wir spazieren.", "Nachdem, wir gegessen hatten gingen wir spazieren.", "nachdem"],
  ["Das Buch, das du mir geliehen hast, ist spannend.", "Das Buch das du mir geliehen hast ist spannend.", "Das Buch das du mir, geliehen hast ist spannend.", "das (Relativsatz)"],
  ["Er lernt Vokabeln, obwohl er müde ist.", "Er lernt Vokabeln obwohl er müde ist.", "Er lernt, Vokabeln obwohl er müde ist.", "obwohl"],
].map(([c, w1, w2, word]) => ({
  q: "Welcher Satz ist richtig geschrieben?",
  options: [c, w1, w2],
  correct: 0,
  solution: `Richtig: „${c}“\nDer Nebensatz (eingeleitet mit „${word}“) wird durch Beistrich vom Hauptsatz getrennt. Ein Nebensatz endet mit dem gebeugten Verb.`,
  hint: "Finde das Wort, das den Nebensatz einleitet. Wo endet der Nebensatz?",
  errors: NS_ERR,
})).map((item, i) => reorder(item, i));

const BEISTRICH_AUFZ: MCItem[] = [
  ["Ich kaufe Äpfel, Birnen, Bananen und Kiwis.", "Ich kaufe Äpfel, Birnen, Bananen, und Kiwis.", "Ich kaufe Äpfel Birnen Bananen und Kiwis."],
  ["Wir spielen Fußball, Tennis oder Volleyball.", "Wir spielen Fußball, Tennis, oder Volleyball.", "Wir spielen Fußball Tennis oder Volleyball."],
  ["Lisa, Tom und Ben gehen ins Kino.", "Lisa, Tom, und Ben gehen ins Kino.", "Lisa Tom und Ben gehen ins Kino."],
  ["Er wäscht ab, räumt auf und saugt Staub.", "Er wäscht ab, räumt auf, und saugt Staub.", "Er wäscht ab räumt auf und saugt Staub."],
  ["Im Rucksack sind Hefte, Stifte, ein Lineal und eine Jause.", "Im Rucksack sind Hefte, Stifte, ein Lineal, und eine Jause.", "Im Rucksack sind Hefte Stifte ein Lineal und eine Jause."],
].map(([c, w1, w2], i) =>
  reorder(
    {
      q: "Welcher Satz ist richtig geschrieben?",
      options: [c, w1, w2],
      correct: 0,
      solution: `Richtig: „${c}“\nGleichrangige Aufzählungsglieder werden durch Beistriche getrennt. Vor „und“ bzw. „oder“ steht kein Beistrich.`,
      hint: "Steht vor „und“ / „oder“ in einer Aufzählung ein Beistrich?",
      errors: { 1: "Beistrich vor „und/oder“ gesetzt", 2: "Beistriche in der Aufzählung vergessen" },
    },
    i,
  ),
);

const BEISTRICH_INF: MCItem[] = [
  ["Er hat vergessen, die Hausübung zu machen.", "Er hat vergessen die Hausübung zu machen.", "Er hat, vergessen die Hausübung zu machen.", "Er hat vergessen, die Hausübung zu machen."],
  ["Sie ging nach Hause, ohne sich zu verabschieden.", "Sie ging nach Hause ohne sich zu verabschieden.", "Sie ging, nach Hause ohne sich zu verabschieden.", "ohne … zu"],
  ["Wir fahren in die Stadt, um ein Geschenk zu kaufen.", "Wir fahren in die Stadt um ein Geschenk zu kaufen.", "Wir fahren, in die Stadt um ein Geschenk zu kaufen.", "um … zu"],
  ["Anstatt zu lernen, spielte er Computer.", "Anstatt zu lernen spielte er Computer.", "Anstatt, zu lernen spielte er Computer.", "anstatt … zu"],
].map(([c, w1, w2, word], i) =>
  reorder(
    {
      q: "Welcher Satz ist richtig geschrieben?",
      options: [c, w1, w2],
      correct: 0,
      solution: `Richtig: „${c}“\nInfinitivgruppen mit „um … zu“, „ohne … zu“, „anstatt … zu“ oder mit einem hinweisenden Wort werden mit Beistrich abgetrennt.${word.includes("…") ? ` (${word})` : ""}`,
      hint: "Suche die Wortgruppe mit „zu“ + Grundform.",
      errors: { 1: "Beistrich bei Infinitivgruppe vergessen", 2: "Beistrich an falscher Stelle" },
    },
    i,
  ),
);

/** Moves the correct option to a varying position and remaps error indices. */
function reorder(item: MCItem, seed: number): MCItem {
  const order = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [1, 2, 0]][seed % 4];
  const options = order.map((i) => item.options[i]);
  const errors: Record<number, string> = {};
  for (const [k, v] of Object.entries(item.errors ?? {})) errors[order.indexOf(Number(k))] = v;
  return { ...item, options, correct: order.indexOf(item.correct), errors };
}

const FALL_OPTS = ["Nominativ (1. Fall)", "Genitiv (2. Fall)", "Dativ (3. Fall)", "Akkusativ (4. Fall)"];
const FAELLE: MCItem[] = (
  [
    ["Ich gebe [dem Hund] einen Knochen.", 2, "Wem gebe ich etwas? → dem Hund → Dativ"],
    ["Ich gebe dem Hund [einen Knochen].", 3, "Wen oder was gebe ich? → einen Knochen → Akkusativ"],
    ["[Die Lehrerin] erklärt die Aufgabe.", 0, "Wer oder was erklärt? → die Lehrerin → Nominativ"],
    ["Das ist das Fahrrad [meines Bruders].", 1, "Wessen Fahrrad? → meines Bruders → Genitiv"],
    ["Wir helfen [der alten Frau].", 2, "Wem helfen wir? → der alten Frau → Dativ"],
    ["Er besucht [seinen Freund].", 3, "Wen besucht er? → seinen Freund → Akkusativ"],
    ["Wegen [des Regens] fällt das Spiel aus.", 1, "Wessen wegen? → des Regens → Genitiv (nach „wegen“)"],
    ["Mit [meiner Schwester] gehe ich ins Kino.", 2, "Mit wem? → meiner Schwester → Dativ (nach „mit“)"],
  ] as [string, number, string][]
).map(([q, correct, solution]) => ({
  q: `In welchem Fall steht der Ausdruck in eckigen Klammern?\n${q}`,
  options: FALL_OPTS,
  correct,
  solution,
  hint: "Frag nach dem Satzglied: Wer/was? Wessen? Wem? Wen/was?",
  errors: (correct === 2 ? { 3: "Dativ und Akkusativ verwechselt" } : correct === 3 ? { 2: "Dativ und Akkusativ verwechselt" } : {}) as Record<number, string>,
}));

const ZEIT_OPTS = ["Präsens", "Präteritum", "Perfekt", "Plusquamperfekt", "Futur I"];
const ZEITEN: MCItem[] = (
  [
    ["Wir sind gestern ins Kino gegangen.", 2, "sind … gegangen: Hilfsverb im Präsens + Partizip II → Perfekt"],
    ["Er las ein spannendes Buch.", 1, "las: einfache Vergangenheitsform → Präteritum"],
    ["Ich werde morgen früh aufstehen.", 4, "werde … aufstehen: werden + Grundform → Futur I"],
    ["Sie hatte die Hausübung schon erledigt.", 3, "hatte … erledigt: Hilfsverb im Präteritum + Partizip II → Plusquamperfekt"],
    ["Der Zug kommt um acht Uhr an.", 0, "kommt … an: Gegenwartsform → Präsens"],
    ["Wir haben viel gelernt.", 2, "haben … gelernt → Perfekt"],
    ["Nachdem er gegessen hatte, ging er.", 3, "hatte … gegessen → Plusquamperfekt (im Nebensatz)"],
  ] as [string, number, string][]
).map(([q, correct, solution]) => ({
  q: `In welcher Zeitform steht der Satz? „${q}“`,
  options: ZEIT_OPTS,
  correct,
  solution,
  hint: "Achte auf Hilfsverben (haben, sein, werden) und ihre Form.",
  errors: (correct === 2 ? { 1: "Perfekt und Präteritum verwechselt", 3: "Perfekt und Plusquamperfekt verwechselt" } : correct === 1 ? { 2: "Perfekt und Präteritum verwechselt" } : correct === 3 ? { 2: "Perfekt und Plusquamperfekt verwechselt" } : {}) as Record<number, string>,
}));

const DAS_DASS: ClozeItem[] = (
  [
    ["Ich hoffe, ___ du morgen kommst.", "dass", "Konjunktion: Man kann nicht „welches“ einsetzen → dass"],
    ["Das Buch, ___ auf dem Tisch liegt, gehört mir.", "das", "Relativpronomen: „welches“ passt → das"],
    ["Er sagt, ___ er keine Zeit hat.", "dass", "Konjunktion nach „sagen“ → dass"],
    ["___ Auto ist neu.", "Das", "Artikel → das"],
    ["Ich weiß, ___ ___ stimmt.", ["dass", "das"], "Erstes: Konjunktion (dass). Zweites: Pronomen „dieses“ (das)."],
    ["Das Kind, ___ dort spielt, ist mein Bruder.", "das", "Relativpronomen: „welches“ passt → das"],
    ["Es ist wichtig, ___ wir pünktlich sind.", "dass", "Konjunktion → dass"],
    ["___ ist mir egal.", "Das", "Demonstrativpronomen „dieses“ → das"],
  ] as [string, string | string[], string][]
).map(([q, ans, solution]) => {
  const arr = Array.isArray(ans) ? ans : [ans];
  return {
    q: `Setze „das“ oder „dass“ ein: ${q}`,
    blanks: arr.map((a) => [a]),
    solution,
    hint: "Ersatzprobe: Kannst du „welches“ oder „dieses“ einsetzen? Dann schreibt man „das“.",
    errors: arr.length === 1 ? { [arr[0].toLowerCase() === "dass" ? "das" : "dass"]: "das/dass verwechselt" } : {},
  };
});

const GROSS: ClozeItem[] = (
  [
    ["Beim ___ habe ich mir den Fuß verletzt. (laufen)", "Laufen", "„beim“ = bei dem → Signalwort für Nominalisierung → groß"],
    ["Wir haben viel ___ erlebt. (schön)", "Schönes", "„viel“ vor Adjektiv → Nominalisierung → groß"],
    ["Er kommt am ___ zu uns. (abend)", "Abend", "Nomen nach „am“ → groß"],
    ["Ich werde heute ___ lernen. (abend)", "abend", "Tageszeit nach „heute“ wird großgeschrieben: heute Abend!"],
    ["Das ___ macht mir Spaß. (lesen)", "Lesen", "Artikel „das“ → Nominalisierung → groß"],
    ["Wir gehen ___ ins Kino. (morgen)", "morgen", "Zeitangabe als Adverb → klein"],
    ["Alles ___ zum Geburtstag! (gute)", "Gute", "„alles“ vor Adjektiv → Nominalisierung → groß"],
  ] as [string, string, string][]
)
  .filter(([, a]) => a !== "abend")
  .map(([q, a, solution]) => ({
    q: `Schreib das Wort in Klammern richtig (groß oder klein): ${q}`,
    blanks: [[a]],
    solution,
    hint: "Achte auf Signalwörter wie das, beim, zum, viel, etwas, alles.",
    errors: { [a[0] === a[0].toUpperCase() ? a.toLowerCase() : a[0].toUpperCase() + a.slice(1)]: "Groß-/Kleinschreibung bei Nominalisierung" },
  }));

const SSS: ClozeItem[] = (
  [
    ["Er wei___ die Antwort.", "ß", "Langer Vokal (ei) → ß"],
    ["Ich mu___ jetzt gehen.", "ss", "Kurzer Vokal (u) → ss"],
    ["Die Stra___e ist nass.", "ß", "Langer Vokal (a) → ß"],
    ["Der Flu___ fließt ins Meer.", "ss", "Kurzer Vokal (u) → ss"],
    ["Wir e___en zu Mittag.", "ss", "Kurzer Vokal (e) → ss"],
    ["Das Gla___ ist voll.", "s", "Gläser → stimmhaftes s → s"],
    ["Sie hat es gewu___t.", "ss", "Kurzer Vokal (u) → ss"],
    ["Der Fu___ tut weh.", "ß", "Langer Vokal (u) → ß"],
  ] as [string, string, string][]
).map(([q, a, solution]) => ({
  q: `Setze s, ss oder ß ein: ${q}`,
  blanks: [[a]],
  solution,
  hint: "Sprich das Wort langsam: Ist der Vokal davor lang oder kurz?",
  errors: (a === "ss" ? { "ß": "ss/ß verwechselt (kurzer Vokal)" } : a === "ß" ? { ss: "ss/ß verwechselt (langer Vokal)" } : { ss: "s/ss verwechselt" }) as Record<string, string>,
}));

const PRESENT_SIMPLE: ClozeItem[] = (
  [
    ["She ___ tennis every Sunday. (play)", "plays", "he/she/it → -s"],
    ["My dad ___ to work by bus. (go)", "goes", "he/she/it → -es after o"],
    ["They ___ in Vienna. (live)", "live", "they → no -s"],
    ["Tom ___ his homework after school. (do)", "does", "he → does"],
    ["The shop ___ at 9 o'clock. (open)", "opens", "it → -s"],
    ["My sister ___ TV every evening. (watch)", "watches", "he/she/it → -es after ch"],
    ["___ she like pizza? (do)", "Does", "Questions with he/she/it → Does"],
  ] as [string, string, string][]
).map(([q, a, solution]) => ({
  q: `Fill in the present simple: ${q}`,
  blanks: [[a]],
  solution: `${a} – ${solution}`,
  hint: "He, she, it – das -s muss mit!",
  errors: (/s$/.test(a) ? { [a.replace(/(?<=(ch|sh|o))es$|s$/, "")]: "-s bei he/she/it vergessen" } : { [`${a}s`]: "-s bei they/we/I angehängt" }) as Record<string, string>,
}));

const PAST_SIMPLE: ClozeItem[] = (
  [
    ["Yesterday I ___ to school by bike. (go)", "went", "go – went – gone", "goed"],
    ["We ___ a great film last night. (see)", "saw", "see – saw – seen", "seed"],
    ["She ___ her keys at home. (leave)", "left", "leave – left – left", "leaved"],
    ["They ___ football after school. (play)", "played", "regular verb → -ed", "play"],
    ["He ___ a letter to his grandma. (write)", "wrote", "write – wrote – written", "writed"],
    ["I ___ my homework two days ago. (finish)", "finished", "regular verb → -ed", "finish"],
    ["We ___ pizza on Friday. (eat)", "ate", "eat – ate – eaten", "eated"],
  ] as [string, string, string, string][]
).map(([q, a, solution, wrong]) => ({
  q: `Fill in the past simple: ${q}`,
  blanks: [[a]],
  solution: `${a} (${solution})`,
  hint: "Signalwörter wie yesterday, last, ago → Past Simple. Ist das Verb unregelmäßig?",
  errors: { [wrong]: wrong.endsWith("ed") ? "Unregelmäßiges Verb regelmäßig gebildet" : "Past Simple nicht gebildet" },
}));

const PRESENT_PERFECT: ClozeItem[] = (
  [
    ["I ___ never ___ to London. (be)", ["have", "been"], "never → Present Perfect: have + been", "was"],
    ["She ___ already ___ her homework. (finish)", ["has", "finished"], "already → Present Perfect: has + finished", "finished"],
    ["We ___ just ___ lunch. (eat)", ["have", "eaten"], "just → Present Perfect: have + eaten", "ate"],
    ["___ you ever ___ sushi? (try)", ["Have", "tried"], "ever → Present Perfect question: Have … tried", "did"],
    ["He ___ not ___ the film yet. (see)", ["has", "seen"], "not … yet → Present Perfect: has not seen", "saw"],
    ["They ___ ___ here since 2020. (live)", ["have", "lived"], "since → Present Perfect: have lived", "live"],
  ] as [string, string[], string, string][]
).map(([q, a, solution]) => ({
  q: `Fill in the present perfect: ${q}`,
  blanks: a.map((x) => [x]),
  solution,
  hint: "Present Perfect = have/has + 3. Form (past participle).",
  errors: {},
}));

const IRREGULAR: [string, string, string][] = [
  ["go", "went", "gone"], ["see", "saw", "seen"], ["write", "wrote", "written"], ["take", "took", "taken"],
  ["eat", "ate", "eaten"], ["give", "gave", "given"], ["buy", "bought", "bought"], ["think", "thought", "thought"],
  ["swim", "swam", "swum"], ["begin", "began", "begun"], ["drink", "drank", "drunk"], ["speak", "spoke", "spoken"],
  ["break", "broke", "broken"], ["forget", "forgot", "forgotten"], ["choose", "chose", "chosen"], ["fly", "flew", "flown"],
];

const COMPARATIVES: ClozeItem[] = (
  [
    ["My brother is ___ than me. (tall)", "taller", "short adjective → -er", "more tall"],
    ["This book is ___ than that one. (interesting)", "more interesting", "long adjective → more …", "interestinger"],
    ["Today is ___ than yesterday. (hot)", "hotter", "short vowel + consonant → double consonant: hotter", "hoter"],
    ["My test was ___ than yours. (bad)", "worse", "irregular: bad – worse – worst", "badder"],
    ["Your bag is ___ than mine. (heavy)", "heavier", "-y → -ier", "heavyer"],
    ["Maths is ___ than English for me. (difficult)", "more difficult", "long adjective → more …", "difficulter"],
    ["This is ___ than I thought. (good)", "better", "irregular: good – better – best", "gooder"],
  ] as [string, string, string, string][]
).map(([q, a, solution, wrong]) => ({
  q: `Fill in the comparative: ${q}`,
  blanks: [[a]],
  solution: `${a} – ${solution}`,
  hint: "Kurze Adjektive bekommen -er, lange Adjektive bekommen „more“.",
  errors: { [wrong]: "Steigerungsform falsch gebildet" },
}));

// ---------- reading ----------
type Passage = { text: string; questions: { q: string; options: string[]; correct: number; solution: string }[] };
const READING: Record<string, Passage[]> = {
  Deutsch: [
    {
      text:
        "Im Herbst ziehen viele Zugvögel in den Süden. Die Störche aus Österreich fliegen zum Beispiel bis nach Afrika. Dort finden sie im Winter genug Nahrung. Die Reise ist gefährlich: Stürme, Hunger und Stromleitungen sind große Gefahren. Junge Störche fliegen oft zum ersten Mal ohne ihre Eltern. Sie finden den Weg trotzdem, weil sie ihn angeboren kennen. Im Frühling kehren die meisten Störche in ihr altes Nest zurück.",
      questions: [
        { q: "Warum fliegen die Störche nach Afrika?", options: ["Weil es dort im Winter genug Nahrung gibt.", "Weil sie dort ihre Eltern treffen.", "Weil es in Afrika keine Stromleitungen gibt."], correct: 0, solution: "Im Text steht: „Dort finden sie im Winter genug Nahrung.“" },
        { q: "Wie finden junge Störche den Weg?", options: ["Ihre Eltern zeigen ihn ihnen.", "Sie kennen ihn angeboren.", "Sie folgen den Stromleitungen."], correct: 1, solution: "Im Text steht: „… weil sie ihn angeboren kennen.“" },
        { q: "Welche Gefahr wird im Text NICHT genannt?", options: ["Stürme", "Hunger", "Jäger"], correct: 2, solution: "Genannt werden Stürme, Hunger und Stromleitungen – Jäger kommen nicht vor." },
        { q: "Was passiert im Frühling?", options: ["Die Störche bauen in Afrika neue Nester.", "Die meisten Störche kehren in ihr altes Nest zurück.", "Die jungen Störche bleiben in Afrika."], correct: 1, solution: "Letzter Satz: „Im Frühling kehren die meisten Störche in ihr altes Nest zurück.“" },
      ],
    },
  ],
  Englisch: [
    {
      text:
        "Mia is twelve years old and lives in Graz. Every Saturday she goes to the market with her grandfather. He sells apples and pears there. Mia helps him because she likes talking to the customers. Last Saturday it rained all day, so only a few people came. Mia and her grandfather drank hot chocolate and played cards. Mia says it was one of her best days at the market.",
      questions: [
        { q: "What does Mia's grandfather sell?", options: ["Vegetables", "Apples and pears", "Hot chocolate"], correct: 1, solution: "“He sells apples and pears there.”" },
        { q: "Why does Mia help at the market?", options: ["She gets money for it.", "She likes talking to the customers.", "Her parents tell her to."], correct: 1, solution: "“Mia helps him because she likes talking to the customers.”" },
        { q: "What happened last Saturday?", options: ["It rained, so few people came.", "Mia was ill.", "They sold all the apples."], correct: 0, solution: "“Last Saturday it rained all day, so only a few people came.”" },
        { q: "How did Mia feel about last Saturday?", options: ["It was boring.", "It was one of her best days.", "She was angry because of the rain."], correct: 1, solution: "“Mia says it was one of her best days at the market.”" },
      ],
    },
  ],
};

function readingTasks(rng: Rng, subject: string, skillId: string | null, diff: Difficulty, count: number): TaskDraft[] {
  const passages = READING[subject] ?? READING.Deutsch;
  const p = pick(rng, passages);
  return p.questions.slice(0, count).map((qq) => ({
    type: "reading",
    skillId,
    difficulty: diff,
    prompt: qq.q,
    data: { passage: p.text, options: qq.options },
    answer: { correct: qq.correct },
    solution: qq.solution,
    hints: ["Lies die passende Stelle im Text noch einmal genau."],
    errorMap: [],
  }));
}

// ---------- explanations (free text) ----------
export const EXPLAIN: Record<string, string> = {
  "mathe.brueche.kuerzen": "Zähler und Nenner durch dieselbe Zahl (am besten den ggT) dividieren. Der Wert bleibt gleich. Beispiel: 12/18 = 2/3 (durch 6).",
  "mathe.brueche.erweitern": "Zähler und Nenner mit derselben Zahl multiplizieren. Der Wert bleibt gleich. Beispiel: 3/4 = 9/12 (mal 3).",
  "mathe.brueche.addieren": "Brüche auf einen gemeinsamen Nenner bringen, dann die Zähler addieren, der Nenner bleibt. Am Ende kürzen. Beispiel: 1/2 + 1/3 = 3/6 + 2/6 = 5/6.",
  "mathe.brueche.subtrahieren": "Gemeinsamen Nenner suchen, erweitern, Zähler subtrahieren, Nenner bleibt, kürzen. Beispiel: 3/4 − 1/6 = 9/12 − 2/12 = 7/12.",
  "mathe.brueche.multiplizieren": "Zähler mal Zähler und Nenner mal Nenner, danach kürzen. Beispiel: 2/3 · 3/4 = 6/12 = 1/2.",
  "mathe.brueche.dividieren": "Mit dem Kehrwert des zweiten Bruchs multiplizieren. Beispiel: 3/4 : 1/2 = 3/4 · 2/1 = 6/4 = 3/2.",
  "mathe.negativ.addieren": "Plus einer negativen Zahl ist wie Minus; Minus einer negativen Zahl ist wie Plus. Beispiel: 5 − (−3) = 8.",
  "mathe.negativ.multiplizieren": "Gleiche Vorzeichen ergeben Plus, verschiedene ergeben Minus. Beispiel: (−4) · (−3) = 12.",
  "mathe.prozent.prozentwert": "Prozentwert = Grundwert · Prozentsatz / 100. Beispiel: 20 % von 80 € = 16 €.",
  "mathe.prozent.prozentsatz": "Prozentsatz = Prozentwert / Grundwert · 100. Beispiel: 15 von 60 = 25 %.",
  "mathe.prozent.grundwert": "Grundwert = Prozentwert · 100 / Prozentsatz. Beispiel: 30 % sind 12 € → 40 €.",
  "mathe.gleichungen.einfach": "Auf beiden Seiten dasselbe rechnen, bis x allein steht. Beispiel: 3x + 4 = 19 → 3x = 15 → x = 5.",
  "mathe.gleichungen.klammern": "Zuerst die Klammer auflösen, dann wie gewohnt umformen. Beispiel: 2(x + 3) = 14 → 2x + 6 = 14 → x = 4.",
  "mathe.gleichungen.text": "Gesuchte Größe x nennen, Text in eine Gleichung übersetzen, lösen und Antwortsatz schreiben.",
  "mathe.potenzen.regeln": "Gleiche Basis: multiplizieren → Exponenten addieren, dividieren → subtrahieren, Potenz einer Potenz → multiplizieren.",
  "deutsch.beistrich.aufzaehlung": "Gleichrangige Glieder einer Aufzählung trennt man mit Beistrich, außer vor „und“ / „oder“.",
  "deutsch.beistrich.nebensatz": "Nebensätze (z. B. mit weil, dass, wenn, ob, der/die/das) werden vom Hauptsatz durch Beistrich getrennt.",
  "deutsch.beistrich.infinitiv": "Infinitivgruppen mit um/ohne/anstatt … zu oder mit Hinweiswort werden mit Beistrich abgetrennt.",
  "deutsch.recht.dasdass": "„das“ ist Artikel oder Pronomen (Ersatzprobe: dieses/welches), „dass“ ist eine Konjunktion, die einen Nebensatz einleitet.",
  "deutsch.recht.gross": "Nomen und nominalisierte Wörter schreibt man groß. Signalwörter: das, beim, zum, viel, etwas, alles, nichts.",
  "deutsch.recht.sss": "Nach kurzem Vokal ss, nach langem Vokal oder Zwielaut ß, bei stimmhaftem s nur s.",
  "deutsch.grammatik.faelle": "Mit der Frageprobe: Wer/was? (Nominativ), Wessen? (Genitiv), Wem? (Dativ), Wen/was? (Akkusativ).",
  "deutsch.grammatik.zeiten": "Zeitformen erkennt man an Hilfsverben und Verbformen: z. B. Perfekt = haben/sein (Präsens) + Partizip II.",
  "deutsch.text.verstehen": "Text genau lesen, Schlüsselwörter markieren, die Antwort im Text belegen.",
  "englisch.tenses.presentsimple": "Für Gewohnheiten und Fakten. Bei he/she/it kommt -s ans Verb. Fragen mit do/does.",
  "englisch.tenses.pastsimple": "Für abgeschlossene Handlungen in der Vergangenheit (yesterday, last week, ago). Regelmäßig -ed, sonst 2. Form.",
  "englisch.tenses.presentperfect": "have/has + 3. Form. Für Erfahrungen und Dinge mit Bezug zur Gegenwart (ever, never, already, yet, since, for).",
  "englisch.vocab.irregular": "Unregelmäßige Verben haben eigene Formen, z. B. go – went – gone. Sie müssen gelernt werden.",
  "englisch.grammar.comparatives": "Kurze Adjektive: -er (taller), lange Adjektive: more (more interesting), Ausnahmen: good – better, bad – worse.",
  "englisch.reading.comprehension": "Read the text carefully, underline key words and find the sentence that answers the question.",
};

const FREE_PROMPTS = [
  (n: string) => `Erkläre in eigenen Worten, wie man bei „${n}“ vorgeht, und gib ein eigenes Beispiel an.`,
  (n: string) => `Welcher Fehler passiert bei „${n}“ besonders oft? Beschreibe ihn und erkläre, wie man ihn vermeidet.`,
  (n: string) => `Erfinde eine eigene Aufgabe zu „${n}“ und löse sie Schritt für Schritt.`,
];

function freeTask(skillId: string, skillName: string, diff: Difficulty, variant = 0): TaskDraft {
  const sample = EXPLAIN[skillId] ?? `Eine korrekte Erklärung zu „${skillName}“ mit einem passenden Beispiel.`;
  return {
    type: "free",
    skillId,
    difficulty: diff,
    prompt: FREE_PROMPTS[variant % FREE_PROMPTS.length](skillName),
    data: {},
    answer: { sample },
    solution: sample,
    hints: ["Schreib die Schritte der Reihe nach auf.", "Ein eigenes Beispiel zeigt, dass du es verstanden hast."],
    errorMap: [],
  };
}

// ---------- conversions ----------
function toMC(rng: Rng, t: TaskDraft): TaskDraft {
  if (t.data.options) return t;
  const correct = t.answer.accepted?.[0];
  if (!correct) return t;
  const distractors = t.errorMap.map((e) => e.answer).filter((a, i, arr) => a !== correct && arr.indexOf(a) === i);
  const n = Number(correct.replace(",", "."));
  if (t.answer.mode === "value" && Number.isFinite(n)) {
    for (const d of [n + 1, n - 1, n * 2, n + 10]) if (distractors.length < 3 && !distractors.includes(String(d))) distractors.push(String(d));
  }
  if (distractors.length < 1) return t;
  const options = shuffle(rng, [correct, ...distractors.slice(0, 3)]);
  const errorMap = t.errorMap
    .map((e) => ({ answer: String(options.indexOf(e.answer)), label: e.label }))
    .filter((e) => e.answer !== "-1");
  return { ...t, type: "mc", data: { options: options.map((o) => o.replace(/(\d)\.(\d)/g, "$1,$2")) }, answer: { correct: options.indexOf(correct) }, errorMap };
}

function toCloze(t: TaskDraft): TaskDraft {
  if (t.answer.blanks || !t.answer.accepted) return t;
  return {
    ...t,
    type: "cloze",
    prompt: `${t.prompt}\nErgebnis: ${GAP}`,
    answer: { blanks: [t.answer.accepted], mode: t.answer.mode },
    errorMap: t.errorMap,
  };
}

export type GenerateRequest = {
  subject: string;
  skills: { id: string; name: string }[];
  difficulty: Difficulty;
  count: number;
  taskType: TaskType | "mixed";
  seed?: number;
};

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hasBuiltInGenerator(skillId: string) {
  return skillId in GEN || skillId.endsWith("reading.comprehension") || skillId === "deutsch.text.verstehen";
}

/** Generates tasks without AI. Skills without a generator get explanation tasks. */
export function generateBuiltIn(req: GenerateRequest): TaskDraft[] {
  const rng = req.seed !== undefined ? mulberry32(req.seed) : Math.random;
  const out: TaskDraft[] = [];
  const seen = new Set<string>();
  const readingSkill = req.skills.find((s) => s.id.endsWith("reading.comprehension") || s.id === "deutsch.text.verstehen");
  if (req.taskType === "reading" || (readingSkill && req.skills.length === 1)) {
    return readingTasks(rng, req.subject, readingSkill?.id ?? req.skills[0]?.id ?? null, req.difficulty, req.count);
  }
  const skills = req.skills.filter((s) => !(s.id.endsWith("reading.comprehension") || s.id === "deutsch.text.verstehen"));
  let i = 0;
  let guard = 0;
  while (out.length < req.count && guard++ < req.count * 20 && skills.length > 0) {
    const skill = skills[i++ % skills.length];
    let t: TaskDraft;
    if (req.taskType === "free" || !GEN[skill.id]) {
      t = freeTask(skill.id, skill.name, req.difficulty, Math.floor((i - 1) / skills.length));
      if (seen.has(t.prompt.split("\n")[0])) break;
    } else {
      t = GEN[skill.id](rng, req.difficulty);
      const type = req.taskType === "mixed" ? pick(rng, ["calc", "mc", "cloze"] as const) : req.taskType;
      if (type === "mc") t = toMC(rng, t);
      else if (type === "cloze") t = toCloze(t);
      else if (type === "grammar" && t.type === "calc") t = { ...t, type: "grammar" };
    }
    const key = t.prompt.split("\n")[0];
    if (seen.has(key) && guard < req.count * 15) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
