/**
 * Built-in maths tasks with working, without AI: "Rechenweg" (equations, fractions, negative numbers,
 * powers, percentages) and multi-part "Sachaufgaben" (percentages, fractions, equations from a text).
 * Numbers are random per difficulty; every sample working is checked by the app's own Rechenweg check
 * in the tests (lib/rechenwege.test.ts), so the solution shown to the teacher is always consistent.
 */
import type { Difficulty } from "./curriculum";
import type { PartSolution, PartView } from "./math-check";
import type { TaskDraft } from "./tasks";

type Rng = () => number;
const rint = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const LEVEL: Record<Difficulty, number> = { "sehr leicht": 0, leicht: 1, "leicht bis mittel": 1, mittel: 2, schwer: 3, "sehr schwer": 3 };

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
type Frac = { n: number; d: number };
const reduce = ({ n, d }: Frac): Frac => {
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
};
const fs = ({ n, d }: Frac) => (d === 1 ? `${n}` : `${n}/${d}`);
function properFrac(rng: Rng, maxDen: number): Frac {
  const d = rint(rng, 2, maxDen);
  const n = rint(rng, 1, d - 1);
  const r = reduce({ n, d });
  return r.d === 1 ? properFrac(rng, maxDen) : r;
}
/** 4.8 → "4,8"; whole numbers stay as they are. */
const de = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");
/** a number in a term: negative ones in brackets, with a real minus sign */
const br = (x: number) => (x < 0 ? `(−${-x})` : `${x}`);
const signed = (x: number) => (x < 0 ? `− ${-x}` : `+ ${x}`);

const WRITE = "Schreib jeden Rechenschritt in eine eigene Zeile.";

function rechenweg(skillId: string, difficulty: Difficulty, o: { prompt: string; start?: string; variable?: string; accepted: string[]; unit?: string; form?: TaskDraft["answer"]["form"]; steps: string[]; solution: string; hints: string[]; errors?: { answer: string; label: string }[]; time?: number }): TaskDraft {
  return {
    type: "rechenweg",
    skillId,
    skillIds: [skillId],
    category: "rechenweg",
    difficulty,
    prompt: o.prompt,
    data: { ...(o.start ? { start: o.start } : {}), ...(o.variable ? { variable: o.variable } : {}) },
    answer: { accepted: o.accepted, unit: o.unit ?? null, form: o.form ?? null, needWay: true },
    solution: o.solution,
    solutionSteps: o.steps,
    hints: o.hints,
    errorMap: o.errors ?? [],
    estimatedTimeSec: o.time ?? 150,
  };
}

/** A "Rechenweg" task for the skill (Teilfähigkeiten use their skill's), or null when there is none. */
export function rechenwegTask(skillId: string, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const lv = LEVEL[difficulty];
  const base = skillId.split(".").slice(0, 3).join(".");
  switch (base) {
    case "mathe.gleichungen.einfach": {
      const x = rint(rng, lv > 0 ? -[0, 6, 10, 15][lv] : 1, [9, 12, 15, 20][lv]);
      if (lv >= 2 && rng() < 0.6) {
        // x on both sides: ax + b = cx + d
        const c = rint(rng, 1, 4);
        const a = c + rint(rng, 2, 6);
        const b = rint(rng, -15, 15) || 4;
        const d = (a - c) * x + b;
        const start = `${a}x ${signed(b)} = ${c === 1 ? "" : c}x ${signed(d)}`;
        return rechenweg(skillId, difficulty, {
          prompt: `Löse die Gleichung. ${WRITE}`,
          start,
          accepted: [`${x}`],
          steps: [`${a - c}x ${signed(b)} = ${d}`, `${a - c}x = ${d - b}`, `x = ${x}`],
          solution: `${start}   | − ${c === 1 ? "" : c}x\n${a - c}x ${signed(b)} = ${d}   | ${b < 0 ? `+ ${-b}` : `− ${b}`}\n${a - c}x = ${d - b}   | : ${a - c}\nx = ${x}`,
          hints: ["Bring zuerst alle x auf eine Seite.", `Rechne auf beiden Seiten − ${c === 1 ? "" : c}x.`, `${a - c}x ${signed(b)} = ${d}`],
          errors: [{ answer: `${(d + b) / (a - c)}`, label: "Vorzeichenfehler beim Umformen" }],
          time: 240,
        });
      }
      const a = rint(rng, 2, [5, 9, 12, 15][lv]);
      const b = rint(rng, 1, [10, 20, 30, 50][lv]) * (lv > 1 && rng() < 0.5 ? -1 : 1);
      const c = a * x + b;
      return rechenweg(skillId, difficulty, {
        prompt: `Löse die Gleichung. ${WRITE}`,
        start: `${a}x ${signed(b)} = ${c}`,
        accepted: [`${x}`],
        steps: [`${a}x = ${c - b}`, `x = ${x}`],
        solution: `${a}x ${signed(b)} = ${c}   | ${b < 0 ? `+ ${-b}` : `− ${b}`}\n${a}x = ${c - b}   | : ${a}\nx = ${x}`,
        hints: ["Bring zuerst die Zahl ohne x auf die andere Seite.", "Was du auf einer Seite rechnest, rechnest du auch auf der anderen.", `${a}x = ${c - b}`],
        errors: [
          { answer: `${(c + b) / a}`, label: "Vorzeichenfehler beim Umformen" },
          { answer: `${c - b}`, label: "Durch den Koeffizienten teilen vergessen" },
        ],
      });
    }
    case "mathe.gleichungen.klammern": {
      const x = rint(rng, lv > 1 ? -8 : 1, 10);
      const a = rint(rng, 2, [4, 6, 8, 9][lv]);
      const b = rint(rng, 1, [5, 8, 12, 15][lv]);
      const e = lv >= 2 ? rint(rng, 1, 9) : 0;
      const c = a * (x + b) - e;
      const start = `${a}(x + ${b})${e ? ` − ${e}` : ""} = ${c}`;
      const expand = `${a}x + ${a * b}${e ? ` − ${e}` : ""} = ${c}`;
      const steps = [expand, ...(e ? [`${a}x + ${a * b - e} = ${c}`] : []), `${a}x = ${c - a * b + e}`, `x = ${x}`];
      return rechenweg(skillId, difficulty, {
        prompt: `Löse die Gleichung. Löse zuerst die Klammer auf. ${WRITE}`,
        start,
        accepted: [`${x}`],
        steps,
        solution: [`Klammer auflösen: ${expand}`, ...steps.slice(1)].join("\n"),
        hints: ["Multipliziere die Zahl vor der Klammer mit jedem Glied in der Klammer.", `${a} · ${b} = ${a * b}`, expand],
        errors: [{ answer: `${(c + e - b) / a}`, label: "Klammer nicht vollständig ausmultipliziert" }],
        time: 200,
      });
    }
    case "mathe.gleichungen.text": {
      const x = rint(rng, 2, [10, 15, 25, 40][lv]);
      const a = rint(rng, 2, [4, 5, 7, 9][lv]);
      const b = rint(rng, 1, [10, 20, 30, 50][lv]);
      const c = a * x + b;
      return rechenweg(skillId, difficulty, {
        prompt: `Ich denke mir eine Zahl, multipliziere sie mit ${a} und addiere ${b}. Ich erhalte ${c}. Wie heißt die Zahl?\nNenne die Zahl x, stell eine Gleichung auf und löse sie. ${WRITE}`,
        variable: "x",
        accepted: [`${x}`],
        steps: [`${a}x + ${b} = ${c}`, `${a}x = ${c - b}`, `x = ${x}`],
        solution: `Gleichung: ${a}x + ${b} = ${c}   | − ${b}\n${a}x = ${c - b}   | : ${a}\nx = ${x}\nProbe: ${a} · ${x} + ${b} = ${c}`,
        hints: ["Die gesuchte Zahl heißt x. Was passiert mit ihr?", `„multipliziere mit ${a}“ heißt ${a}x.`, `${a}x + ${b} = ${c}`],
        errors: [{ answer: `${(c + b) / a}`, label: "Vorzeichenfehler beim Umformen" }],
        time: 240,
      });
    }
    case "mathe.brueche.kuerzen": {
      const r = properFrac(rng, [6, 9, 12, 15][lv]);
      const k = pick(rng, [[2, 3, 5], [2, 3, 4, 5], [4, 6, 8, 9], [6, 8, 12, 15]][lv]);
      const q = { n: r.n * k, d: r.d * k };
      return rechenweg(skillId, difficulty, {
        prompt: `Kürze den Bruch so weit wie möglich. ${WRITE}`,
        start: fs(q),
        accepted: [fs(r)],
        form: "gekuerzt",
        steps: [`(${q.n} : ${k})/(${q.d} : ${k})`, fs(r)],
        solution: `ggT von ${q.n} und ${q.d} ist ${k}.\n${fs(q)} = (${q.n} : ${k})/(${q.d} : ${k}) = ${fs(r)}`,
        hints: ["Suche eine Zahl, durch die Zähler und Nenner teilbar sind.", "Der größte gemeinsame Teiler (ggT) kürzt in einem Schritt.", `Beide sind durch ${k} teilbar.`],
      });
    }
    case "mathe.brueche.addieren":
    case "mathe.brueche.subtrahieren":
    case "mathe.brueche.multiplizieren":
    case "mathe.brueche.dividieren": {
      const OPS: Record<string, "+" | "−" | "·" | ":"> = { addieren: "+", subtrahieren: "−", multiplizieren: "·", dividieren: ":" };
      const op = OPS[base.split(".")[2]];
      const maxDen = [6, 9, 12, 16][lv];
      for (let tries = 0; tries < 40; tries++) {
        let a = properFrac(rng, maxDen);
        let b = properFrac(rng, maxDen);
        if (op === "−" && a.n / a.d < b.n / b.d) [a, b] = [b, a];
        if (a.n * b.d === b.n * a.d) continue;
        const start = `${fs(a)} ${op} ${fs(b)}`;
        let steps: string[];
        let res: Frac;
        let hints: string[];
        let errors: { answer: string; label: string }[] = [];
        if (op === "+" || op === "−") {
          const L = (a.d * b.d) / gcd(a.d, b.d);
          const [an, bn] = [a.n * (L / a.d), b.n * (L / b.d)];
          const raw = op === "+" ? an + bn : an - bn;
          res = reduce({ n: raw, d: L });
          steps = [`${an}/${L} ${op} ${bn}/${L}`, `${raw}/${L}`, ...(fs(res) !== `${raw}/${L}` ? [fs(res)] : [])];
          hints = ["Bring beide Brüche auf einen gemeinsamen Nenner.", `Ein gemeinsamer Nenner ist ${L}.`, `${fs(a)} = ${an}/${L}`];
          const wrong = reduce({ n: op === "+" ? a.n + b.n : a.n - b.n, d: op === "+" ? a.d + b.d : Math.max(1, a.d - b.d) });
          if (op === "+") errors = [{ answer: fs(wrong), label: "Zähler und Nenner einzeln addiert" }];
        } else if (op === "·") {
          res = reduce({ n: a.n * b.n, d: a.d * b.d });
          steps = [`(${a.n} · ${b.n})/(${a.d} · ${b.d})`, `${a.n * b.n}/${a.d * b.d}`, ...(fs(res) !== `${a.n * b.n}/${a.d * b.d}` ? [fs(res)] : [])];
          hints = ["Beim Multiplizieren brauchst du keinen gemeinsamen Nenner.", "Zähler mal Zähler, Nenner mal Nenner.", `(${a.n} · ${b.n})/(${a.d} · ${b.d})`];
          errors = [{ answer: fs(reduce({ n: a.n * b.d, d: a.d * b.n })), label: "Mit dem Kehrwert multipliziert" }];
        } else {
          res = reduce({ n: a.n * b.d, d: a.d * b.n });
          steps = [`${fs(a)} · ${b.d}/${b.n}`, `${a.n * b.d}/${a.d * b.n}`, ...(fs(res) !== `${a.n * b.d}/${a.d * b.n}` ? [fs(res)] : [])];
          hints = ["Dividieren durch einen Bruch heißt: mit dem Kehrwert multiplizieren.", `Der Kehrwert von ${fs(b)} ist ${b.d}/${b.n}.`, `${fs(a)} · ${b.d}/${b.n}`];
          errors = [{ answer: fs(reduce({ n: a.n * b.n, d: a.d * b.d })), label: "Kehrwert vergessen" }];
        }
        return rechenweg(skillId, difficulty, {
          prompt: `Berechne und kürze das Ergebnis. ${WRITE}`,
          start,
          accepted: [fs(res)],
          form: "gekuerzt",
          steps,
          solution: `${start} = ${steps.join(" = ")}`,
          hints,
          errors: errors.filter((e) => e.answer !== fs(res)),
        });
      }
      return null;
    }
    case "mathe.negativ.addieren": {
      const r = [10, 20, 50, 100][lv];
      const n = lv >= 1 ? 3 : 2;
      const nums = Array.from({ length: n }, (_, i) => (i === 0 ? rint(rng, -r, r) || 3 : rint(rng, 1, r) * (rng() < 0.5 ? -1 : 1)));
      const ops = nums.slice(1).map(() => pick(rng, ["+", "−"] as const));
      const start = [br(nums[0]), ...nums.slice(1).flatMap((v, i) => [ops[i], br(v)])].join(" ");
      // first step: plus a negative number is minus, minus a negative one is plus
      const terms = nums.map((v, i) => (i === 0 ? v : ops[i - 1] === "+" ? v : -v));
      const first = terms.map((v, i) => (i === 0 ? `${v < 0 ? "−" : ""}${Math.abs(v)}` : `${v < 0 ? "−" : "+"} ${Math.abs(v)}`)).join(" ");
      const res = terms.reduce((s, v) => s + v, 0);
      const steps = [first, ...(n > 2 ? [`${terms[0] + terms[1]} ${signed(terms[2])}`.replace(/^-/, "−")] : []), `${res}`.replace(/^-/, "−")];
      return rechenweg(skillId, difficulty, {
        prompt: `Berechne. Schreib zuerst die Rechnung ohne Klammern. ${WRITE}`,
        start,
        accepted: [`${res}`],
        steps,
        solution: `${start} = ${steps.join(" = ")}`,
        hints: ["Plus eine negative Zahl ist wie Minus.", "Minus eine negative Zahl ist wie Plus.", `${start} = ${first}`],
        errors: [{ answer: `${-res}`, label: "Vorzeichenfehler" }],
      });
    }
    case "mathe.negativ.multiplizieren": {
      const r = [6, 9, 12, 12][lv];
      const n = lv >= 2 ? 3 : 2;
      const nums = Array.from({ length: n }, () => rint(rng, 2, r) * (rng() < 0.55 ? -1 : 1));
      const start = nums.map(br).join(" · ");
      const p2 = nums[0] * nums[1];
      const res = nums.reduce((s, v) => s * v, 1);
      const steps = [...(n > 2 ? [`${br(p2)} · ${br(nums[2])}`] : []), `${res}`.replace(/^-/, "−")];
      return rechenweg(skillId, difficulty, {
        prompt: `Berechne. ${WRITE}`,
        start,
        accepted: [`${res}`],
        steps,
        solution: `${start} = ${steps.join(" = ")}\nZähle die Minuszeichen: ${nums.filter((v) => v < 0).length} ${nums.filter((v) => v < 0).length % 2 ? "(ungerade, also negativ)" : "(gerade, also positiv)"}`,
        hints: ["Rechne zuerst ohne Vorzeichen.", "Gleiche Vorzeichen ergeben Plus, verschiedene ergeben Minus.", "Zähle die Minuszeichen."],
        errors: [{ answer: `${-res}`, label: "Vorzeichenregel nicht angewendet" }],
      });
    }
    case "mathe.potenzen.regeln": {
      const m = rint(rng, 2, [5, 7, 9, 9][lv]);
      const n = rint(rng, 2, [4, 6, 8, 8][lv]);
      const kind = pick(rng, ["mul", "div", "pow"] as const);
      const k1 = lv >= 2 ? rint(rng, 2, 5) : 1;
      const k2 = lv >= 2 ? rint(rng, 2, 4) : 1;
      const c = (k: number) => (k === 1 ? "" : `${k}`);
      if (kind === "mul")
        return rechenweg(skillId, difficulty, {
          prompt: `Vereinfache mit den Potenzregeln. ${WRITE}`,
          start: `${c(k1)}x^${m} · ${c(k2)}x^${n}`,
          accepted: [`${c(k1 * k2)}x^${m + n}`],
          steps: [`${k1 * k2 === 1 ? "" : `${k1} · ${k2} · `}x^(${m} + ${n})`, `${c(k1 * k2)}x^${m + n}`],
          solution: `Gleiche Basis: Exponenten addieren.\n${c(k1)}x^${m} · ${c(k2)}x^${n} = ${c(k1 * k2)}x^${m + n}`,
          hints: ["Bei gleicher Basis werden die Exponenten beim Multiplizieren …?", `${m} + ${n} = ${m + n}`],
          errors: [{ answer: `${c(k1 * k2)}x^${m * n}`, label: "Exponenten multipliziert statt addiert" }],
        });
      if (kind === "div")
        return rechenweg(skillId, difficulty, {
          prompt: `Vereinfache mit den Potenzregeln. ${WRITE}`,
          start: `x^${m + n} : x^${n}`,
          accepted: [`x^${m}`],
          steps: [`x^(${m + n} − ${n})`, `x^${m}`],
          solution: `Gleiche Basis: beim Dividieren Exponenten subtrahieren.\nx^${m + n} : x^${n} = x^${m}`,
          hints: ["Beim Dividieren werden die Exponenten subtrahiert.", `${m + n} − ${n} = ${m}`],
          errors: [{ answer: `x^${(m + n) / n}`, label: "Exponenten dividiert statt subtrahiert" }],
        });
      return rechenweg(skillId, difficulty, {
        prompt: `Vereinfache mit den Potenzregeln. ${WRITE}`,
        start: `(x^${m})^${n}`,
        accepted: [`x^${m * n}`],
        steps: [`x^(${m} · ${n})`, `x^${m * n}`],
        solution: `Potenz einer Potenz: Exponenten multiplizieren.\n(x^${m})^${n} = x^${m * n}`,
        hints: ["Beim Potenzieren einer Potenz werden die Exponenten multipliziert.", `${m} · ${n} = ${m * n}`],
        errors: [{ answer: `x^${m + n}`, label: "Exponenten addiert statt multipliziert" }],
      });
    }
    case "mathe.prozent.prozentwert": {
      const G = pick(rng, [[100, 200, 50, 400], [80, 120, 250, 600], [75, 240, 360, 1250], [48, 85, 1260, 3450]][lv]);
      const p = pick(rng, [[10, 25, 50], [5, 15, 20, 30], [12, 35, 40, 8], [2.5, 17, 12.5, 7]][lv]);
      const W = Math.round(G * p) / 100;
      return rechenweg(skillId, difficulty, {
        prompt: `Berechne ${de(p)} % von ${de(G)} €. ${WRITE}`,
        accepted: [`${de(W)} €`],
        unit: "€",
        steps: [`1 % = ${de(G)} : 100 = ${de(G / 100)}`, `${de(p)} % = ${de(G / 100)} · ${de(p)} = ${de(W)}`],
        solution: `1 % = ${de(G)} € : 100 = ${de(G / 100)} €\n${de(p)} % = ${de(G / 100)} € · ${de(p)} = ${de(W)} €`,
        hints: ["Berechne zuerst 1 %.", `1 % von ${de(G)} € ist ${de(G)} : 100.`, `1 % = ${de(G / 100)} €`],
        errors: [{ answer: `${de(G * p)} €`, label: "Durch 100 dividieren vergessen" }],
      });
    }
    case "mathe.prozent.prozentsatz": {
      const G = pick(rng, [[100, 200, 50], [40, 80, 250, 500], [60, 120, 360, 750], [64, 125, 480, 1600]][lv]);
      const p = pick(rng, [[10, 20, 50], [5, 25, 40, 75], [12.5, 15, 35, 60], [2.5, 7.5, 37.5, 62.5]][lv]);
      const W = Math.round(G * p) / 100;
      return rechenweg(skillId, difficulty, {
        prompt: `Wie viel Prozent sind ${de(W)} € von ${de(G)} €? ${WRITE}`,
        accepted: [`${de(p)} %`],
        unit: "%",
        steps: [`${de(W)} : ${de(G)} = ${de(W / G)}`, `${de(W / G)} = ${de(p)} %`],
        solution: `Prozentwert durch Grundwert: ${de(W)} € : ${de(G)} € = ${de(W / G)}\n${de(W / G)} = ${de(p)} %`,
        hints: ["Teile den Teil (Prozentwert) durch das Ganze (Grundwert).", "Eine Dezimalzahl mal 100 gibt die Prozent.", `${de(W)} : ${de(G)}`],
        errors: [{ answer: `${de(W / G)} %`, label: "Mal 100 vergessen" }],
      });
    }
    case "mathe.prozent.grundwert": {
      const G = pick(rng, [[100, 200, 400], [80, 160, 500, 300], [240, 360, 640, 900], [1250, 480, 2400, 760]][lv]);
      const p = pick(rng, [[10, 25, 50], [5, 20, 40], [15, 30, 12.5], [7.5, 2.5, 35]][lv]);
      const W = Math.round(G * p) / 100;
      return rechenweg(skillId, difficulty, {
        prompt: `${de(p)} % eines Betrags sind ${de(W)} €. Wie groß ist der ganze Betrag (100 %)? ${WRITE}`,
        accepted: [`${de(G)} €`],
        unit: "€",
        steps: [`1 % = ${de(W)} : ${de(p)} = ${de(W / p)}`, `100 % = ${de(W / p)} · 100 = ${de(G)}`],
        solution: `1 % = ${de(W)} € : ${de(p)} = ${de(W / p)} €\n100 % = ${de(W / p)} € · 100 = ${de(G)} €`,
        hints: [`Wenn ${de(p)} % = ${de(W)} € sind, wie viel ist dann 1 %?`, "Vom 1 % kommst du mit · 100 zum Ganzen.", `1 % = ${de(W)} : ${de(p)}`],
        errors: [{ answer: `${de((W * p) / 100)} €`, label: "Prozentwert statt Grundwert berechnet" }],
      });
    }
  }
  return null;
}

// ---------- Sachaufgaben ----------
function sach(skillId: string, difficulty: Difficulty, o: { prompt: string; parts: (PartView & PartSolution)[]; hints: string[]; time?: number }): TaskDraft {
  return {
    type: "sachaufgabe",
    skillId,
    skillIds: [skillId],
    category: "sachaufgabe",
    difficulty,
    prompt: o.prompt,
    data: { parts: o.parts.map(({ label, prompt, kind, lines }) => ({ label, prompt, kind, ...(lines ? { lines } : {}) })) },
    answer: { parts: o.parts.map(({ accepted, unit, follow, sample, solution, errorMap, criteria }) => ({ accepted, unit: unit ?? null, follow: follow ?? null, sample, solution, errorMap, criteria })) },
    solution: o.parts.map((p) => `${p.label} ${p.solution ?? p.sample ?? ""}`).join("\n"),
    hints: o.hints,
    errorMap: [],
    estimatedTimeSec: o.time ?? 420,
  };
}

const THINGS = [
  ["Ein Fahrrad", "Das Fahrrad"],
  ["Eine Jacke", "Die Jacke"],
  ["Ein Handy", "Das Handy"],
  ["Ein Paar Sportschuhe", "Das Paar Sportschuhe"],
  ["Ein Skateboard", "Das Skateboard"],
] as const;

/** A Sachaufgabe with parts a), b), c) for the skill, or null when there is none. */
export function sachaufgabeTask(skillId: string, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const lv = LEVEL[difficulty];
  const base = skillId.split(".").slice(0, 3).join(".");
  if (base.startsWith("mathe.prozent.")) {
    const story = base === "mathe.prozent.prozentsatz" ? "anteil" : base === "mathe.prozent.grundwert" ? "grundwert" : pick(rng, ["rabatt", "erhoehung"] as const);
    if (story === "anteil") {
      const N = pick(rng, [20, 25, 40, 50]);
      const k = (N * pick(rng, [20, 40, 60, 80, 24, 36, 48, 52, 12, 28, 30, 70].filter((q) => (N * q) % 100 === 0))) / 100;
      const p = (k / N) * 100;
      return sach(skillId, difficulty, {
        prompt: `In einer Klasse sind ${N} Kinder. ${k} davon kommen mit dem Fahrrad zur Schule.`,
        parts: [
          { label: "a)", prompt: "Wie viel Prozent der Kinder kommen mit dem Fahrrad?", kind: "zahl", accepted: [`${de(p)} %`], unit: "%", solution: `${k} : ${N} = ${de(k / N)} = ${de(p)} %`, errorMap: [{ answer: `${de(k / N)} %`, label: "Mal 100 vergessen" }] },
          { label: "b)", prompt: "Wie viele Kinder kommen nicht mit dem Fahrrad?", kind: "zahl", accepted: [`${N - k}`], solution: `${N} − ${k} = ${N - k}` },
          { label: "c)", prompt: "Wie viel Prozent der Kinder kommen nicht mit dem Fahrrad? Rechne mit deinem Ergebnis aus a).", kind: "zahl", accepted: [`${de(100 - p)} %`], unit: "%", follow: "100 - a", solution: `100 % − ${de(p)} % = ${de(100 - p)} %` },
        ],
        hints: ["Prozentsatz = Teil : Ganzes, dann · 100.", "Alle Kinder zusammen sind 100 %."],
      });
    }
    if (story === "grundwert") {
      const G = pick(rng, [[80, 120, 200], [160, 240, 300], [360, 480, 640], [750, 1250, 960]][lv]);
      const p = pick(rng, [[10, 20, 25], [15, 20, 30], [12.5, 15, 35], [7.5, 12.5, 35]][lv]);
      const W = Math.round(G * p) / 100;
      return sach(skillId, difficulty, {
        prompt: `Im Ausverkauf spart Tom beim Kauf eines Artikels ${de(W)} €. Das sind ${de(p)} % des ursprünglichen Preises.`,
        parts: [
          { label: "a)", prompt: "Wie viel hat der Artikel ursprünglich gekostet?", kind: "zahl", accepted: [`${de(G)} €`], unit: "€", solution: `1 % = ${de(W)} € : ${de(p)} = ${de(W / p)} €, 100 % = ${de(G)} €`, errorMap: [{ answer: `${de((W * p) / 100)} €`, label: "Prozentwert statt Grundwert berechnet" }] },
          { label: "b)", prompt: "Wie viel bezahlt Tom?", kind: "zahl", accepted: [`${de(G - W)} €`], unit: "€", follow: `a - ${de(W).replace(",", ".")}`, solution: `${de(G)} € − ${de(W)} € = ${de(G - W)} €` },
          { label: "c)", prompt: "Erkläre in einem Satz, warum du in a) nicht einfach mit " + de(p) + " % von " + de(W) + " € rechnen darfst.", kind: "text", lines: 3, sample: `Die ${de(W)} € sind schon ${de(p)} % vom ursprünglichen Preis. Gesucht ist das Ganze (100 %), nicht ein Teil der Ersparnis.`, solution: "" },
        ],
        hints: [`${de(p)} % sind ${de(W)} €. Wie viel ist dann 1 %?`, "Das Ganze ist 100 %."],
      });
    }
    const [thing, the] = pick(rng, THINGS);
    const G = pick(rng, [[100, 200, 80], [240, 360, 480], [480, 360, 750, 1250], [399, 849, 1290]][lv]);
    const p = pick(rng, [[10, 20, 25, 50], [10, 15, 20, 25], [12, 15, 30, 35], [12.5, 17.5, 8, 22]][lv]);
    const W = Math.round(G * p) / 100;
    if (story === "erhoehung") {
      return sach(skillId, difficulty, {
        prompt: `${thing} kostet ${de(G)} €. Der Preis wird um ${de(p)} % erhöht.`,
        parts: [
          { label: "a)", prompt: "Um wie viel Euro steigt der Preis?", kind: "zahl", accepted: [`${de(W)} €`], unit: "€", solution: `${de(G)} € · ${de(p)} % = ${de(W)} €`, errorMap: [{ answer: `${de(G * p)} €`, label: "Durch 100 dividieren vergessen" }] },
          { label: "b)", prompt: `Wie viel kostet ${the.replace(/^(Das|Die|Der)/, (m) => m.toLowerCase())} nach der Erhöhung?`, kind: "zahl", accepted: [`${de(G + W)} €`], unit: "€", follow: `${G} + a`, solution: `${de(G)} € + ${de(W)} € = ${de(G + W)} €`, errorMap: [{ answer: `${de(G + p)} €`, label: "Prozentsatz statt Betrag addiert" }] },
          { label: "c)", prompt: "Erkläre, wie du gerechnet hast.", kind: "text", lines: 3, sample: `Ich habe zuerst ${de(p)} % von ${de(G)} € ausgerechnet (${de(W)} €) und diesen Betrag zum alten Preis dazugezählt.`, solution: "" },
        ],
        hints: ["Berechne zuerst, um wie viel Euro der Preis steigt.", `${de(p)} % von ${de(G)} € = ${de(G)} · ${de(p)} : 100`],
      });
    }
    return sach(skillId, difficulty, {
      prompt: `${thing} kostet ${de(G)} €. Der Preis wird um ${de(p)} % reduziert.`,
      parts: [
        { label: "a)", prompt: "Berechne den Rabatt.", kind: "zahl", accepted: [`${de(W)} €`], unit: "€", solution: `${de(G)} € · ${de(p)} % = ${de(W)} €`, errorMap: [{ answer: `${de(G * p)} €`, label: "Durch 100 dividieren vergessen" }] },
        { label: "b)", prompt: `Wie viel kostet ${the.replace(/^(Das|Die|Der)/, (m) => m.toLowerCase())} nach der Ermäßigung?`, kind: "zahl", accepted: [`${de(G - W)} €`], unit: "€", follow: `${G} - a`, solution: `${de(G)} € − ${de(W)} € = ${de(G - W)} €`, errorMap: [{ answer: `${de(G - p)} €`, label: "Prozentsatz statt Betrag abgezogen" }] },
        { label: "c)", prompt: "Erkläre, wie du gerechnet hast.", kind: "text", lines: 3, sample: `Ich habe zuerst ${de(p)} % von ${de(G)} € berechnet, das ist der Rabatt (${de(W)} €). Dann habe ich den Rabatt vom alten Preis abgezogen.`, solution: "" },
      ],
      hints: ["Berechne zuerst den Rabatt in Euro.", `${de(p)} % von ${de(G)} € = ${de(G)} · ${de(p)} : 100`],
    });
  }
  if (base.startsWith("mathe.brueche.")) {
    const maxDen = [6, 8, 10, 12][lv];
    for (let tries = 0; tries < 40; tries++) {
      const a = properFrac(rng, maxDen);
      const b = properFrac(rng, maxDen);
      const sum = reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
      if (sum.n >= sum.d || a.d === b.d) continue;
      const rest = reduce({ n: sum.d - sum.n, d: sum.d });
      const [p1, p2] = pick(rng, [["Mia", "Tom"], ["Lena", "David"], ["Sara", "Jonas"]]);
      return sach(skillId, difficulty, {
        prompt: `Eine Pizza wird geteilt. ${p1} isst ${fs(a)} der Pizza, ${p2} isst ${fs(b)}.`,
        parts: [
          { label: "a)", prompt: "Welchen Teil der Pizza essen beide zusammen? Kürze das Ergebnis.", kind: "zahl", accepted: [fs(sum)], solution: `${fs(a)} + ${fs(b)} = ${fs(sum)}`, errorMap: [{ answer: fs(reduce({ n: a.n + b.n, d: a.d + b.d })), label: "Zähler und Nenner einzeln addiert" }] },
          { label: "b)", prompt: "Welcher Teil der Pizza bleibt übrig?", kind: "zahl", accepted: [fs(rest)], follow: "1 - a", solution: `1 − ${fs(sum)} = ${fs(rest)}` },
          { label: "c)", prompt: "Erkläre, warum du in a) einen gemeinsamen Nenner brauchst.", kind: "text", lines: 3, sample: "Man kann nur gleich große Stücke zusammenzählen. Mit dem gleichen Nenner sind die Stücke gleich groß, dann zählt man die Zähler zusammen.", solution: "" },
        ],
        hints: ["Bring die Brüche auf einen gemeinsamen Nenner.", "Die ganze Pizza ist 1."],
      });
    }
    return null;
  }
  if (base === "mathe.gleichungen.text" || base === "mathe.gleichungen.einfach") {
    const x = rint(rng, [6, 8, 9, 11][lv], [12, 14, 16, 18][lv]);
    const k = rint(rng, 3, [3, 4, 5, 5][lv]);
    const total = x + k * x;
    const [kid, adult] = pick(rng, [["Lena", "ihr Vater"], ["Paul", "seine Mutter"], ["Emma", "ihre Tante"]]);
    const word = ({ 3: "dreimal", 4: "viermal", 5: "fünfmal" } as Record<number, string>)[k];
    return sach(skillId, difficulty, {
      prompt: `${kid} ist x Jahre alt. ${adult[0].toUpperCase()}${adult.slice(1)} ist ${word} so alt. Zusammen sind die beiden ${total} Jahre alt.`,
      parts: [
        { label: "a)", prompt: "Stell eine Gleichung auf.", kind: "text", lines: 1, sample: `x + ${k}x = ${total}`, solution: "" },
        { label: "b)", prompt: `Wie alt ist ${kid}? Löse die Gleichung.`, kind: "zahl", accepted: [`${x}`], solution: `${k + 1}x = ${total}, x = ${x}` },
        { label: "c)", prompt: `Wie alt ist ${adult}? Rechne mit deinem Ergebnis aus b).`, kind: "zahl", accepted: [`${k * x}`], follow: `${k} * b`, solution: `${k} · ${x} = ${k * x}` },
      ],
      hints: [`${kid} ist x, ${adult} ist ${k}x.`, `x + ${k}x = ${k + 1}x`],
    });
  }
  return null;
}
