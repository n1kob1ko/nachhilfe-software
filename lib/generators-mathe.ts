/**
 * Built-in maths tasks with working, without AI: "Rechenweg" (equations, fractions, negative numbers,
 * powers, percentages) and multi-part "Sachaufgaben" (percentages, fractions, negative numbers,
 * equations, powers from a short text). The numbers come from lib/schulbuch-zahlen.ts, so they look like
 * the ones in a school book; every sample working is checked by the app's own Rechenweg check in the tests
 * (lib/rechenwege.test.ts, lib/schulbuch-zahlen.test.ts), so the solution shown to the teacher is always
 * consistent. A Rechenweg never starts from a mixed number (the term check reads 5/2, not 2 1/2), and a
 * division with numbers in front is written as a fraction ((12a^7)/(4a^3)).
 */
import type { Difficulty } from "./curriculum";
import type { PartSolution, PartView } from "./math-check";
import { bruchWeg, ersterSchritt } from "./mathe-rechnungen";
import {
  STUFE,
  bruch,
  bruchListe,
  bruchRechnung,
  bruchText,
  dingFall,
  euro,
  fehlerAntwort,
  gcd,
  geld,
  gleichungEinfach,
  gleichungKlammern,
  gleichungWeg,
  gross,
  hauptnenner,
  klammer,
  kuerze,
  kuerzenAufgabe,
  passende,
  pick,
  potenz,
  potenzAufgabe,
  prozentFall,
  rint,
  wert,
  xAntwort,
  zahl,
  type BruchOp,
  type BruchRechnung,
  type Gleichung,
  type Rng,
  type Stufe,
} from "./schulbuch-zahlen";
import type { TaskDraft } from "./tasks";
import { gleichungsText } from "./textaufgaben";

const WRITE = "Schreib jeden Rechenschritt in eine eigene Zeile.";
const rund = (x: number) => Math.round(x * 10000) / 10000;

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

function gleichungsWeg(skillId: string, difficulty: Difficulty, g: Gleichung, prompt: string, time: number): TaskDraft {
  return rechenweg(skillId, difficulty, {
    prompt,
    start: g.start,
    accepted: [xAntwort(g)],
    steps: g.lines.slice(1),
    solution: gleichungWeg(g),
    hints: [g.hint, ersterSchritt(g), g.lines[1]],
    errors: g.errors.map((e) => ({ answer: fehlerAntwort(g, e.x), label: e.label })),
    time,
  });
}

/** The lines of a fraction calculation for the Rechenweg (no words, each one equal to the start). */
function bruchZeilen(r: BruchRechnung): string[] {
  const [a, b] = r.terms;
  const op = r.ops[0];
  const res = r.result;
  const roh = (n: number, d: number) => [`${n}/${d}`, ...(bruch(kuerze({ n, d })) !== `${n}/${d}` ? [bruch(kuerze({ n, d }))] : [])];
  if (op === "+" || op === "−") {
    const L = hauptnenner(r);
    const zaehler = r.terms.map((x) => x.n * (L / x.d));
    const raw = zaehler.slice(1).reduce((acc, z, i) => (r.ops[i] === "+" ? acc + z : acc - z), zaehler[0]);
    const erweitert = r.terms.every((x) => x.d === L) ? [] : [zaehler.map((z, i) => `${i ? ` ${r.ops[i - 1]} ` : ""}${z}/${L}`).join("")];
    return [...erweitert, ...roh(raw, L)];
  }
  if (op === "·") return b.d === 1 ? [`(${a.n} · ${b.n})/${a.d}`, ...roh(a.n * b.n, a.d)] : [`(${a.n} · ${b.n})/(${a.d} · ${b.d})`, ...roh(a.n * b.n, a.d * b.d)];
  if (b.d === 1) return [`${a.n}/(${a.d} · ${b.n})`, ...roh(a.n, a.d * b.n)];
  const lines = [`${bruch(a)} · ${b.d}/${b.n}`, ...roh(a.n * b.d, a.d * b.n)];
  return lines[lines.length - 1] === bruch(res) ? lines : [...lines, bruch(res)];
}

/** −5 − (−8) + 3: the terms of a sum with negative numbers, as in lib/mathe-rechnungen.ts. */
function negativeSumme(rng: Rng, lv: Stufe) {
  const r = [10, 20, 20, 40, 20][lv];
  for (;;) {
    const n = lv <= 1 ? 2 : 3;
    const xs = Array.from({ length: n }, () => (lv === 4 ? rint(rng, 1, 30) / 2 : rint(rng, 1, r)) * (rng() < 0.5 ? -1 : 1));
    const ops = xs.slice(1).map(() => pick(rng, ["+", "−"] as const));
    const signed = xs.map((x, i) => (i === 0 || ops[i - 1] === "+" ? x : -x));
    const res = rund(signed.reduce((s, x) => s + x, 0));
    if (!xs.some((x) => x < 0) || res === 0 || Math.abs(res) > r) continue;
    const start = xs.map((x, i) => `${i ? ` ${ops[i - 1]} ` : ""}${i === 0 ? zahl(x) : klammer(x)}`).join("");
    const ohne = (vs: number[]) => vs.map((x, i) => (i === 0 ? zahl(x) : `${x < 0 ? "−" : "+"} ${zahl(Math.abs(x))}`)).join(" ");
    const steps: string[] = [];
    if (xs.slice(1).some((x) => x < 0)) steps.push(ohne(signed));
    for (let k = 2; k < signed.length; k++) steps.push(ohne([rund(signed.slice(0, k).reduce((s, x) => s + x, 0)), ...signed.slice(k)]));
    steps.push(zahl(res));
    return { start, steps, res, ohne: ohne(signed) };
  }
}

/** A "Rechenweg" task for the skill (Teilfähigkeiten use their skill's), or null when there is none. */
export function rechenwegTask(skillId: string, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const lv = STUFE[difficulty];
  const base = skillId.split(".").slice(0, 3).join(".");
  switch (base) {
    case "mathe.gleichungen.einfach": {
      const g = gleichungEinfach(rng, lv);
      return gleichungsWeg(skillId, difficulty, g, `Löse die Gleichung. ${WRITE}`, g.lines.length > 3 ? 240 : 150);
    }
    case "mathe.gleichungen.klammern": {
      const g = gleichungKlammern(rng, lv);
      return gleichungsWeg(skillId, difficulty, g, `Löse die Gleichung. Löse zuerst die Klammer auf. ${WRITE}`, 200 + 20 * lv);
    }
    case "mathe.gleichungen.text": {
      // whole numbers only: the student writes the equation without decimals
      let s = gleichungsText(rng, lv, "text", true);
      for (let i = 0; i < 20 && s && /\d,\d/.test(s.g.start); i++) s = gleichungsText(rng, lv, "text", true);
      if (!s || /\d,\d/.test(s.g.start)) return null;
      const { g } = s;
      const x = xAntwort(g);
      return rechenweg(skillId, difficulty, {
        prompt: `${s.text}\nNenne das Gesuchte x, stell eine Gleichung auf und löse sie. ${WRITE}`,
        variable: "x",
        accepted: [x],
        steps: [...(s.aufstellen ? [s.aufstellen] : []), ...g.lines],
        solution: [`x ist ${s.bedeutung}.`, ...(s.aufstellen ? [`Gleichung: ${s.aufstellen}`] : []), gleichungWeg(g), `Antwort: ${s.antwort(x.replace("-", "−"))}`].join("\n"),
        hints: [`Nenne das Gesuchte x: x ist ${s.bedeutung}.`, "Schreib den Text Satz für Satz als Rechnung mit x.", s.aufstellen ?? g.start],
        errors: g.errors.map((e) => ({ answer: fehlerAntwort(g, e.x), label: e.label })),
        time: 300,
      });
    }
    case "mathe.brueche.kuerzen": {
      const { q, r, k } = kuerzenAufgabe(rng, lv);
      return rechenweg(skillId, difficulty, {
        prompt: `Kürze den Bruch so weit wie möglich. ${WRITE}`,
        start: bruch(q),
        accepted: [bruch(r)],
        form: "gekuerzt",
        steps: [`(${q.n} : ${k})/(${q.d} : ${k})`, bruch(r)],
        solution: `ggT von ${q.n} und ${q.d} ist ${k}.\n${bruch(q)} = (${q.n} : ${k})/(${q.d} : ${k}) = ${bruch(r)}`,
        hints: ["Suche eine Zahl, durch die Zähler und Nenner teilbar sind.", "Der größte gemeinsame Teiler (ggT) kürzt in einem Schritt.", `Beide sind durch ${k} teilbar.`],
        errors: [{ answer: `${q.n}/${r.d}`, label: "Nur den Nenner gekürzt" }],
      });
    }
    case "mathe.brueche.addieren":
    case "mathe.brueche.subtrahieren":
    case "mathe.brueche.multiplizieren":
    case "mathe.brueche.dividieren": {
      const OPS: Record<string, BruchOp> = { addieren: "+", subtrahieren: "−", multiplizieren: "·", dividieren: ":" };
      const r = bruchRechnung(rng, lv, OPS[base.split(".")[2]], false);
      const start = bruchText(r);
      const steps = bruchZeilen(r);
      const w = bruchWeg(r);
      return rechenweg(skillId, difficulty, {
        prompt: `Berechne und kürze das Ergebnis. ${WRITE}`,
        start,
        accepted: [bruch(r.result)],
        form: "gekuerzt",
        steps,
        solution: `${start} = ${steps.join(" = ")}`,
        hints: [...w.hints.slice(0, 2), `${start} = ${steps[0]}`],
        errors: w.errors,
        time: r.terms.length > 2 ? 240 : 150,
      });
    }
    case "mathe.negativ.addieren": {
      const s = negativeSumme(rng, lv);
      return rechenweg(skillId, difficulty, {
        prompt: `Berechne. Schreib zuerst die Rechnung ohne Klammern. ${WRITE}`,
        start: s.start,
        accepted: [String(s.res).replace(".", ",")],
        steps: s.steps,
        solution: `${s.start} = ${s.steps.join(" = ")}`,
        hints: ["Plus eine negative Zahl ist wie Minus.", "Minus eine negative Zahl ist wie Plus.", `${s.start} = ${s.ohne}`],
        errors: [{ answer: String(-s.res).replace(".", ","), label: "Vorzeichenfehler" }],
      });
    }
    case "mathe.negativ.multiplizieren": {
      for (;;) {
        const n = lv >= 2 ? 3 : 2;
        const max = [5, 9, 6, 8, 10][lv];
        const nums = Array.from({ length: n }, () => rint(rng, 2, max) * (rng() < 0.55 ? -1 : 1));
        const res = nums.reduce((s, v) => s * v, 1);
        const minus = nums.filter((v) => v < 0).length;
        if (!minus || Math.abs(res) > [30, 90, 150, 300, 500][lv]) continue;
        const start = nums.map(klammer).join(" · ");
        const steps = [...(n > 2 ? [`${klammer(nums[0] * nums[1])} · ${klammer(nums[2])}`] : []), zahl(res)];
        return rechenweg(skillId, difficulty, {
          prompt: `Berechne. ${WRITE}`,
          start,
          accepted: [String(res)],
          steps,
          solution: `${start} = ${steps.join(" = ")}\nZähle die Minuszeichen: ${minus} ${minus % 2 ? "(ungerade, also negativ)" : "(gerade, also positiv)"}`,
          hints: ["Rechne zuerst ohne Vorzeichen.", "Gleiche Vorzeichen ergeben Plus, verschiedene ergeben Minus.", "Zähle die Minuszeichen."],
          errors: [{ answer: `${-res}`, label: "Vorzeichenregel nicht angewendet" }],
        });
      }
    }
    case "mathe.potenzen.regeln": {
      let p = potenzAufgabe(rng, lv);
      // the checker reads "9a" before a bracket or space as 9 ar (an area unit): no bare "a" after a number
      for (let i = 0; i < 30 && /\da(?![\^\w])/.test(p.start); i++) p = potenzAufgabe(rng, lv);
      const result = potenz(p.base, p.e, p.k);
      return rechenweg(skillId, difficulty, {
        prompt: `${p.eine ? "Schreib als eine Potenz" : "Vereinfache mit den Potenzregeln"}. ${WRITE}`,
        start: p.start,
        accepted: [result],
        steps: p.steps,
        solution: `${p.rule}\n${p.start} = ${p.steps.join(" = ")}`,
        hints: [p.rule, "Hochzahlen schreibst du mit ^, zum Beispiel x^5.", `${p.start} = ${p.steps[0]}`],
        errors: p.errors,
        time: lv >= 3 ? 200 : 150,
      });
    }
    case "mathe.prozent.prozentwert": {
      const { G, p, W } = prozentFall(rng, lv, "wert");
      return rechenweg(skillId, difficulty, {
        prompt: `Berechne ${zahl(p)} % von ${euro(G)}. ${WRITE}`,
        accepted: [`${geld(W)} €`],
        unit: "€",
        steps: [`1 % = ${zahl(G)} : 100 = ${zahl(G / 100)}`, `${zahl(p)} % = ${zahl(G / 100)} · ${zahl(p)} = ${zahl(W)}`],
        solution: `1 % = ${geld(G)} € : 100 = ${zahl(G / 100)} €\n${zahl(p)} % = ${zahl(G / 100)} € · ${zahl(p)} = ${geld(W)} €`,
        hints: ["Berechne zuerst 1 %.", `1 % von ${euro(G)} ist ${geld(G)} : 100.`, `1 % = ${zahl(G / 100)} €`],
        errors: [{ answer: `${zahl(rund(G * p))} €`, label: "Durch 100 dividieren vergessen" }],
      });
    }
    case "mathe.prozent.prozentsatz": {
      const { G, p, W } = prozentFall(rng, lv, "satz");
      return rechenweg(skillId, difficulty, {
        prompt: `Wie viel Prozent sind ${euro(W)} von ${euro(G)}? ${WRITE}`,
        accepted: [`${zahl(p)} %`],
        unit: "%",
        steps: [`${zahl(W)} : ${zahl(G)} = ${zahl(p / 100)}`, `${zahl(p / 100)} = ${zahl(p)} %`],
        solution: `Prozentwert durch Grundwert: ${geld(W)} € : ${geld(G)} € = ${zahl(p / 100)}\n${zahl(p / 100)} = ${zahl(p)} %`,
        hints: ["Teile den Teil (Prozentwert) durch das Ganze (Grundwert).", "Eine Dezimalzahl mal 100 gibt die Prozent.", `${geld(W)} : ${geld(G)}`],
        errors: [{ answer: `${zahl(p / 100)} %`, label: "Mal 100 vergessen" }],
      });
    }
    case "mathe.prozent.grundwert": {
      const { G, p, W } = prozentFall(rng, lv, "grund");
      return rechenweg(skillId, difficulty, {
        prompt: `${zahl(p)} % eines Betrags sind ${euro(W)}. Wie groß ist der ganze Betrag (100 %)? ${WRITE}`,
        accepted: [`${geld(G)} €`],
        unit: "€",
        steps: [`1 % = ${zahl(W)} : ${zahl(p)} = ${zahl(G / 100)}`, `100 % = ${zahl(G / 100)} · 100 = ${zahl(G)}`],
        solution: `1 % = ${geld(W)} € : ${zahl(p)} = ${zahl(G / 100)} €\n100 % = ${zahl(G / 100)} € · 100 = ${geld(G)} €`,
        hints: [`Wenn ${zahl(p)} % = ${euro(W)} sind, wie viel ist dann 1 %?`, "Vom 1 % kommst du mit · 100 zum Ganzen.", `1 % = ${geld(W)} : ${zahl(p)}`],
        errors: [{ answer: `${zahl(rund((W * p) / 100))} €`, label: "Prozentwert statt Grundwert berechnet" }],
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
    answer: { parts: o.parts.map(({ accepted, unit, form, follow, sample, solution, errorMap, criteria }) => ({ accepted, unit: unit ?? null, ...(form ? { form } : {}), follow: follow ?? null, sample, solution, errorMap, criteria })) },
    solution: o.parts.map((p) => `${p.label} ${p.solution ?? p.sample ?? ""}`).join("\n"),
    hints: o.hints,
    errorMap: [],
    estimatedTimeSec: o.time ?? 420,
  };
}

/** Generic first names (no real students). */
const NAMEN: [string, "er" | "sie"][] = [
  ["Lena", "sie"],
  ["Jonas", "er"],
  ["Mia", "sie"],
  ["Paul", "er"],
  ["Emma", "sie"],
  ["Elias", "er"],
  ["Sara", "sie"],
  ["David", "er"],
];
/** A number for a Folgefehler formula ("480 - a"): plain minus, decimal point. */
const f = (x: number) => String(rund(x));
const KLASSE = [20, 24, 25, 28, 30];
const ANTEIL: number[][] = [
  [10, 20, 25, 50],
  [5, 10, 20, 25, 40, 60, 75, 80],
  [12, 15, 35, 45, 64, 65, 85],
  [12.5, 37.5, 62.5, 87.5, 32, 44],
  [12.5, 37.5, 62.5, 87.5, 7.5, 32, 44],
];

/** A Sachaufgabe with parts a), b), c) for the skill, or null when there is none. */
export function sachaufgabeTask(skillId: string, difficulty: Difficulty, rng: Rng = Math.random): TaskDraft | null {
  const lv = STUFE[difficulty];
  const base = skillId.split(".").slice(0, 3).join(".");
  const [name, er] = pick(rng, NAMEN);
  if (base.startsWith("mathe.prozent.")) {
    const story = base === "mathe.prozent.prozentsatz" ? "anteil" : base === "mathe.prozent.grundwert" ? "grundwert" : pick(rng, ["rabatt", "erhoehung"] as const);
    if (story === "anteil") {
      const faelle = passende(`sach:anteil:${lv}`, () => KLASSE.flatMap((N) => ANTEIL[lv].filter((p) => Number.isInteger((N * p) / 100)).map((p) => ({ N, p, k: (N * p) / 100 }))));
      const { N, p, k } = pick(rng, faelle);
      return sach(skillId, difficulty, {
        prompt: `In der Klasse von ${name} sind ${N} Kinder. ${k} davon kommen mit dem Rad zur Schule.`,
        parts: [
          { label: "a)", prompt: "Wie viel Prozent der Kinder kommen mit dem Rad?", kind: "zahl", accepted: [`${zahl(p)} %`], unit: "%", solution: `${k} : ${N} = ${zahl(p / 100)} = ${zahl(p)} %`, errorMap: [{ answer: `${zahl(p / 100)} %`, label: "Mal 100 vergessen" }] },
          { label: "b)", prompt: "Wie viele Kinder kommen nicht mit dem Rad?", kind: "zahl", accepted: [`${N - k}`], solution: `${N} − ${k} = ${N - k}` },
          { label: "c)", prompt: "Wie viel Prozent der Kinder kommen nicht mit dem Rad? Rechne mit deinem Ergebnis aus a).", kind: "zahl", accepted: [`${zahl(100 - p)} %`], unit: "%", follow: "100 - a", solution: `100 % − ${zahl(p)} % = ${zahl(100 - p)} %` },
        ],
        hints: ["Prozentsatz = Teil : Ganzes, dann · 100.", "Alle Kinder zusammen sind 100 %."],
      });
    }
    const { ding, G, p, W } = dingFall(rng, lv);
    if (story === "grundwert") {
      return sach(skillId, difficulty, {
        prompt: `${name} kauft im Abverkauf ${ding.einen} und spart dabei ${euro(W)}. Das sind ${zahl(p)} % des ursprünglichen Preises.`,
        parts: [
          { label: "a)", prompt: `Wie viel hat ${ding.der} ursprünglich gekostet?`, kind: "zahl", accepted: [`${geld(G)} €`], unit: "€", solution: `1 % = ${geld(W)} € : ${zahl(p)} = ${zahl(G / 100)} €, 100 % = ${geld(G)} €`, errorMap: [{ answer: `${zahl(rund((W * p) / 100))} €`, label: "Prozentwert statt Grundwert berechnet" }] },
          { label: "b)", prompt: `Wie viel bezahlt ${name}?`, kind: "zahl", accepted: [`${geld(G - W)} €`], unit: "€", follow: `a - ${f(W)}`, solution: `${geld(G)} € − ${geld(W)} € = ${geld(rund(G - W))} €` },
          { label: "c)", prompt: `Erkläre in einem Satz, warum du in a) nicht einfach ${zahl(p)} % von ${euro(W)} rechnen darfst.`, kind: "text", lines: 3, sample: `Die ${euro(W)} sind schon ${zahl(p)} % vom ursprünglichen Preis. Gesucht ist das Ganze (100 %), nicht ein Teil der Ersparnis.`, solution: "" },
        ],
        hints: [`${zahl(p)} % sind ${euro(W)}. Wie viel ist dann 1 %?`, "Das Ganze ist 100 %."],
      });
    }
    const der = ding.der;
    if (story === "erhoehung") {
      return sach(skillId, difficulty, {
        prompt: `${gross(ding.ein)} kostet ${euro(G)}. Im Frühling wird der Preis um ${zahl(p)} % erhöht.`,
        parts: [
          { label: "a)", prompt: "Um wie viel Euro steigt der Preis?", kind: "zahl", accepted: [`${geld(W)} €`], unit: "€", solution: `${zahl(p)} % von ${euro(G)} = ${geld(G)} · ${zahl(p)} : 100 = ${geld(W)} €`, errorMap: [{ answer: `${zahl(rund(G * p))} €`, label: "Durch 100 dividieren vergessen" }] },
          { label: "b)", prompt: `Wie viel kostet ${der} nach der Erhöhung?`, kind: "zahl", accepted: [`${geld(rund(G + W))} €`], unit: "€", follow: `${f(G)} + a`, solution: `${geld(G)} € + ${geld(W)} € = ${geld(rund(G + W))} €`, errorMap: W === p ? [] : [{ answer: `${zahl(rund(G + p))} €`, label: "Prozentsatz statt Betrag addiert" }] },
          { label: "c)", prompt: "Erkläre, wie du gerechnet hast.", kind: "text", lines: 3, sample: `Ich habe zuerst ${zahl(p)} % von ${euro(G)} ausgerechnet (${euro(W)}) und diesen Betrag zum alten Preis dazugezählt.`, solution: "" },
        ],
        hints: ["Berechne zuerst, um wie viel Euro der Preis steigt.", `${zahl(p)} % von ${euro(G)} = ${geld(G)} · ${zahl(p)} : 100`],
      });
    }
    return sach(skillId, difficulty, {
      prompt: `${gross(ding.ein)} kostet ${euro(G)}. Im Abverkauf gibt es ${zahl(p)} % Rabatt.`,
      parts: [
        { label: "a)", prompt: "Berechne den Rabatt in Euro.", kind: "zahl", accepted: [`${geld(W)} €`], unit: "€", solution: `${zahl(p)} % von ${euro(G)} = ${geld(G)} · ${zahl(p)} : 100 = ${geld(W)} €`, errorMap: [{ answer: `${zahl(rund(G * p))} €`, label: "Durch 100 dividieren vergessen" }] },
        { label: "b)", prompt: `Wie viel kostet ${der} nach dem Rabatt?`, kind: "zahl", accepted: [`${geld(rund(G - W))} €`], unit: "€", follow: `${f(G)} - a`, solution: `${geld(G)} € − ${geld(W)} € = ${geld(rund(G - W))} €`, errorMap: W === p ? [] : [{ answer: `${zahl(rund(G - p))} €`, label: "Prozentsatz statt Betrag abgezogen" }] },
        { label: "c)", prompt: "Erkläre, wie du gerechnet hast.", kind: "text", lines: 3, sample: `Ich habe zuerst ${zahl(p)} % von ${euro(G)} berechnet, das ist der Rabatt (${euro(W)}). Dann habe ich den Rabatt vom alten Preis abgezogen.`, solution: "" },
      ],
      hints: ["Berechne zuerst den Rabatt in Euro.", `${zahl(p)} % von ${euro(G)} = ${geld(G)} · ${zahl(p)} : 100`],
    });
  }
  if (base === "mathe.brueche.kuerzen" || base === "mathe.brueche.erweitern") {
    const N = pick(rng, [[20, 24], [24, 28, 30], [24, 27, 28, 30], [24, 27, 28, 30], [24, 27, 28, 30]][lv]);
    const ks = Array.from({ length: N - 1 }, (_, i) => i + 1).filter((k) => gcd(k, N) > 1 && N / gcd(k, N) <= [4, 6, 10, 15, 15][lv] && k > N / 4);
    const k = pick(rng, ks);
    const r = kuerze({ n: k, d: N });
    const rest = kuerze({ n: N - k, d: N });
    return sach(skillId, difficulty, {
      prompt: `In der Klasse von ${name} sind ${N} Kinder. ${k} davon fahren mit dem Bus zur Schule, die anderen kommen zu Fuß.`,
      parts: [
        { label: "a)", prompt: "Welcher Bruchteil der Klasse fährt mit dem Bus? Kürze so weit wie möglich.", kind: "zahl", accepted: [bruch(r)], form: "gekuerzt", solution: `${k}/${N} = ${bruch(r)}`, errorMap: [{ answer: `${N - k}/${N}`, label: "Den Rest statt den Anteil angegeben" }] },
        { label: "b)", prompt: "Welcher Bruchteil der Klasse kommt zu Fuß? Kürze so weit wie möglich.", kind: "zahl", accepted: [bruch(rest)], form: "gekuerzt", follow: "1 - a", solution: `1 − ${bruch(r)} = ${bruch(rest)}` },
        { label: "c)", prompt: `Erkläre, warum ${k}/${N} und ${bruch(r)} gleich groß sind.`, kind: "text", lines: 3, sample: `Ich habe Zähler und Nenner durch dieselbe Zahl (${gcd(k, N)}) geteilt. Dabei ändert sich der Wert des Bruchs nicht.`, solution: "" },
      ],
      hints: ["Der Teil kommt in den Zähler, die ganze Klasse in den Nenner.", "Die ganze Klasse ist 1."],
    });
  }
  if (base === "mathe.brueche.multiplizieren") {
    // Mehl, Zucker and the part of the recipe: every amount and the sum with a short denominator
    const faelle = passende(`sach:rezept:${lv}`, () => {
      const f = (n: number, d: number) => ({ n, d });
      const mehlListe = [[f(1, 2), f(1, 4)], [f(1, 2), f(3, 4)], [f(3, 4), f(2, 5), f(1, 2)], [f(3, 4), f(3, 5), f(5, 8)], [f(3, 4), f(3, 5), f(5, 8), f(9, 10)]][lv];
      const zuckerListe = [f(1, 4), f(1, 5), f(3, 8), f(1, 2), f(3, 10)];
      const teilListe = [[f(1, 2)], [f(1, 2), f(1, 4)], [f(2, 3), f(1, 3), f(3, 4)], [f(2, 3), f(3, 4), f(2, 5)], [f(2, 3), f(3, 4), f(4, 5), f(5, 6)]][lv];
      const max = [8, 16, 20, 24, 40][lv];
      return mehlListe.flatMap((mehl) =>
        zuckerListe.flatMap((zucker) =>
          teilListe
            .map((teil) => {
              const m = kuerze({ n: mehl.n * teil.n, d: mehl.d * teil.d });
              const z = kuerze({ n: zucker.n * teil.n, d: zucker.d * teil.d });
              return { mehl, zucker, teil, m, z, sum: kuerze({ n: m.n * z.d + z.n * m.d, d: m.d * z.d }) };
            })
            .filter((c) => wert(c.zucker) < wert(c.mehl) && c.m.d <= max && c.z.d <= max && c.sum.d <= max && c.sum.n < c.sum.d),
        ),
      );
    });
    const { mehl, zucker, teil, m, z } = pick(rng, faelle);
    const sum = kuerze({ n: m.n * z.d + z.n * m.d, d: m.d * z.d });
    return sach(skillId, difficulty, {
      prompt: `Für einen Kuchen brauchst du ${bruch(mehl)} kg Mehl und ${bruch(zucker)} kg Zucker. ${name} backt nur ${bruch(teil)} des Rezepts.`,
      parts: [
        { label: "a)", prompt: "Wie viel Kilogramm Mehl braucht " + er + "? Kürze das Ergebnis.", kind: "zahl", accepted: [`${bruch(m)} kg`], unit: "kg", solution: `${bruch(mehl)} · ${bruch(teil)} = ${bruch(m)}`, errorMap: [{ answer: `${bruch(kuerze({ n: mehl.n * teil.d, d: mehl.d * teil.n }))} kg`, label: "Durch den Bruch dividiert statt multipliziert" }] },
        { label: "b)", prompt: `Wie viel Kilogramm Zucker braucht ${er}? Kürze das Ergebnis.`, kind: "zahl", accepted: [`${bruch(z)} kg`], unit: "kg", solution: `${bruch(zucker)} · ${bruch(teil)} = ${bruch(z)}` },
        { label: "c)", prompt: "Wie viel Kilogramm sind Mehl und Zucker zusammen? Rechne mit deinen Ergebnissen aus a) und b).", kind: "zahl", accepted: [`${bruch(sum)} kg`], unit: "kg", follow: "a + b", solution: `${bruch(m)} + ${bruch(z)} = ${bruch(sum)}` },
      ],
      hints: [`${bruch(teil)} des Rezepts heißt: jede Menge mal ${bruch(teil)}.`, "Zähler mal Zähler, Nenner mal Nenner."],
    });
  }
  if (base === "mathe.brueche.dividieren") {
    // sehr leicht: the numbers of leicht, only halves and quarters
    const stufe = Math.max(1, Math.min(lv, 3)) as Stufe;
    const faelle = passende(`sach:dividieren:${lv}`, () =>
      bruchListe(stufe, ":", false).filter(
        (r) => r.result.d === 1 && r.result.n >= 2 && r.result.n <= 12 && r.terms[1].d !== 1 && wert(r.terms[1]) <= 0.5 && r.terms.every((x) => (lv === 0 ? [2, 4] : [2, 4, 5, 8, 10]).includes(x.d)),
      ),
    );
    const r = pick(rng, faelle);
    const [a, b] = r.terms;
    const n = r.result.n;
    const flaschen = pick(rng, [2, 3, 4]);
    return sach(skillId, difficulty, {
      prompt: `In einer Flasche sind ${bruch(a)} Liter Saft. ${name} füllt den Saft in Gläser, in jedes Glas passen ${bruch(b)} Liter.`,
      parts: [
        { label: "a)", prompt: "Wie viele Gläser kann " + er + " mit einer Flasche füllen?", kind: "zahl", accepted: [`${n}`], solution: `${bruch(a)} : ${bruch(b)} = ${bruch(a)} · ${b.d}/${b.n} = ${n}`, errorMap: [{ answer: bruch(kuerze({ n: a.n * b.n, d: a.d * b.d })), label: "Kehrwert vergessen" }] },
        { label: "b)", prompt: `Für das Klassenfest braucht ${name} ${n * flaschen} Gläser Saft. Wie viele Flaschen braucht ${er}? Rechne mit deinem Ergebnis aus a).`, kind: "zahl", accepted: [`${flaschen}`], follow: `${n * flaschen} / a`, solution: `${n * flaschen} : ${n} = ${flaschen}` },
        { label: "c)", prompt: "Erkläre, warum beim Dividieren durch einen Bruch kleiner als 1 mehr herauskommt.", kind: "text", lines: 3, sample: `Man fragt, wie oft ${bruch(b)} in ${bruch(a)} passt. Weil ein Glas weniger als einen Liter fasst, passt es mehrmals hinein.`, solution: "" },
      ],
      hints: ["Wie oft passt der Inhalt eines Glases in die Flasche?", "Dividieren durch einen Bruch heißt: mit dem Kehrwert multiplizieren."],
    });
  }
  if (base.startsWith("mathe.brueche.")) {
    // Pizza: two fractions with different denominators, together at most one pizza
    const stufe = Math.max(1, Math.min(lv, 2)) as Stufe;
    const faelle = passende(`sach:pizza:${stufe}`, () => bruchListe(stufe, "+", false).filter((r) => r.terms.length === 2 && wert(r.result) < 1 && r.terms.every((x) => [2, 3, 4, 6, 8, 12].includes(x.d))));
    const r = pick(rng, faelle);
    const [a, b] = r.terms;
    const rest = kuerze({ n: r.result.d - r.result.n, d: r.result.d });
    const [p2] = pick(rng, NAMEN.filter(([n]) => n !== name));
    return sach(skillId, difficulty, {
      prompt: `Eine Pizza wird geteilt. ${name} isst ${bruch(a)} der Pizza, ${p2} isst ${bruch(b)}.`,
      parts: [
        { label: "a)", prompt: "Welchen Teil der Pizza essen beide zusammen? Kürze das Ergebnis.", kind: "zahl", accepted: [bruch(r.result)], solution: `${bruch(a)} + ${bruch(b)} = ${bruch(r.result)}`, errorMap: [{ answer: bruch(kuerze({ n: a.n + b.n, d: a.d + b.d })), label: "Zähler und Nenner einzeln addiert" }] },
        { label: "b)", prompt: "Welcher Teil der Pizza bleibt übrig?", kind: "zahl", accepted: [bruch(rest)], follow: "1 - a", solution: `1 − ${bruch(r.result)} = ${bruch(rest)}` },
        { label: "c)", prompt: "Erkläre, warum du in a) einen gemeinsamen Nenner brauchst.", kind: "text", lines: 3, sample: "Man kann nur gleich große Stücke zusammenzählen. Mit dem gleichen Nenner sind die Stücke gleich groß, dann zählt man die Zähler zusammen.", solution: "" },
      ],
      hints: ["Bring die Brüche auf einen gemeinsamen Nenner.", "Die ganze Pizza ist 1."],
    });
  }
  if (base === "mathe.negativ.addieren") {
    for (;;) {
      const max = [8, 12, 15, 20, 20][lv];
      const t0 = -rint(rng, 2, max);
      const d1 = rint(rng, 3, max);
      const d2 = rint(rng, 3, max);
      const mittag = t0 + d1;
      const abend = mittag - d2;
      if (d1 === d2 || Math.abs(mittag) > max || Math.abs(abend) > max || mittag === 0 || abend === 0 || (mittag > 0 === abend > 0 && abend > 0)) continue;
      return sach(skillId, difficulty, {
        prompt: `In der Früh hat es ${zahl(t0)} °C. Bis zu Mittag steigt die Temperatur um ${d1} Grad, bis zum Abend fällt sie wieder um ${d2} Grad.`,
        parts: [
          { label: "a)", prompt: "Wie viel Grad Celsius hat es zu Mittag?", kind: "zahl", accepted: [`${mittag}`], solution: `${zahl(t0)} + ${d1} = ${zahl(mittag)}`, errorMap: [{ answer: `${-t0 + d1}`, label: "Minus der Anfangstemperatur übersehen" }] },
          { label: "b)", prompt: "Wie viel Grad Celsius hat es am Abend? Rechne mit deinem Ergebnis aus a).", kind: "zahl", accepted: [`${abend}`], follow: `a - ${d2}`, solution: `${zahl(mittag)} − ${d2} = ${zahl(abend)}` },
          { label: "c)", prompt: "Um wie viel Grad ist es am Abend wärmer oder kälter als in der Früh? Erkläre mit einem Satz.", kind: "text", lines: 3, sample: `Am Abend hat es ${zahl(abend)} °C, in der Früh ${zahl(t0)} °C. Es ist um ${Math.abs(abend - t0)} Grad ${abend > t0 ? "wärmer" : "kälter"}.`, solution: "" },
        ],
        hints: ["Steigen heißt Plus, fallen heißt Minus.", "Stell dir ein Thermometer vor."],
      });
    }
  }
  if (base === "mathe.negativ.multiplizieren") {
    // a diver stays above 40 m; at schwer a research submarine goes deeper
    const uboot = lv >= 3;
    const d = uboot ? pick(rng, [8, 12, 15, 20, 25]) : rint(rng, 2, [3, 4, 5][lv]);
    const tiefe = uboot ? 250 : 40;
    let n1 = rint(rng, 2, 5);
    let ziel = rint(rng, n1 + 2, n1 + 6);
    while (ziel * d > tiefe) [n1, ziel] = [2, rint(rng, 4, Math.max(4, Math.floor(tiefe / d)))];
    const [wer, es, tut] = uboot ? ["Ein Forschungs-U-Boot", "es", "sinkt"] : ["Ein Taucher", "er", "taucht"];
    return sach(skillId, difficulty, {
      prompt: `${wer} startet an der Wasseroberfläche (0 m) und ${tut} jede Minute ${d} m tiefer. Die Höhe unter Wasser schreibst du mit Minus, zum Beispiel −5 m.`,
      parts: [
        { label: "a)", prompt: `In welcher Höhe ist ${es} nach ${n1} Minuten?`, kind: "zahl", accepted: [`${-n1 * d} m`], unit: "m", solution: `${n1} · (−${d}) = ${zahl(-n1 * d)}`, errorMap: [{ answer: `${n1 * d} m`, label: "Vorzeichen vergessen" }] },
        { label: "b)", prompt: `In welcher Höhe ist ${es} nach ${n1 + 1} Minuten? Rechne mit deinem Ergebnis aus a).`, kind: "zahl", accepted: [`${-(n1 + 1) * d} m`], unit: "m", follow: `a - ${d}`, solution: `${zahl(-n1 * d)} − ${d} = ${zahl(-(n1 + 1) * d)}` },
        { label: "c)", prompt: `Nach wie vielen Minuten ist ${es} bei −${ziel * d} m?`, kind: "zahl", accepted: [`${ziel}`], solution: `(−${ziel * d}) : (−${d}) = ${ziel}` },
      ],
      hints: [`Jede Minute kommt −${d} m dazu.`, "Minus durch Minus ergibt Plus."],
    });
  }
  if (base === "mathe.potenzen.regeln") {
    const m = rint(rng, 6, lv >= 3 ? 9 : 8);
    const n = rint(rng, 1, lv >= 2 ? 4 : 3);
    return sach(skillId, difficulty, {
      prompt: `Ein Handy hat 2^${m} GB Speicher. Ein Spiel braucht ${potenz("2", n)} GB.`,
      parts: [
        { label: "a)", prompt: "Wie viele GB Speicher hat das Handy? Rechne die Potenz aus.", kind: "zahl", accepted: [`${2 ** m}`], solution: `2^${m} = ${2 ** m}` },
        { label: "b)", prompt: "Wie viele Spiele haben auf dem Handy Platz? Schreib das Ergebnis als Zahl.", kind: "zahl", accepted: [`${2 ** (m - n)}`], solution: `2^${m} : ${potenz("2", n)} = 2^${m - n} = ${2 ** (m - n)}`, errorMap: [{ answer: `${2 ** (m + n)}`, label: "Hochzahlen addiert statt subtrahiert" }] },
        { label: "c)", prompt: "Erkläre, wie du b) mit den Potenzregeln rechnen kannst.", kind: "text", lines: 3, sample: `Beide Potenzen haben die Basis 2. Beim Dividieren subtrahiert man die Hochzahlen: ${m} − ${n} = ${m - n}, also 2^${m - n}.`, solution: "" },
      ],
      hints: ["Gleiche Basis, dividieren: Hochzahlen subtrahieren.", `2^${m} : ${potenz("2", n)} = 2^(${m} − ${n})`],
    });
  }
  if (base === "mathe.gleichungen.text" || base === "mathe.gleichungen.einfach" || base === "mathe.gleichungen.klammern") {
    const art = base === "mathe.gleichungen.klammern" ? "klammern" : base === "mathe.gleichungen.einfach" ? "einfach" : "text";
    let s = gleichungsText(rng, lv, art, true);
    for (let i = 0; i < 20 && s && /\d,\d/.test(s.g.start); i++) s = gleichungsText(rng, lv, art, true);
    if (!s || /\d,\d/.test(s.g.start)) return null;
    const { g } = s;
    const x = xAntwort(g);
    const gleichung = s.aufstellen ?? g.start;
    const probe = gleichung.replace(/(\d)x/g, `$1 · ${klammer(wert(g.x))}`).replace(/x/g, klammer(wert(g.x)));
    return sach(skillId, difficulty, {
      prompt: s.text.replace(/\s*[^.?!]*\?$/, "").trim(),
      parts: [
        { label: "a)", prompt: `Stell eine Gleichung auf. x ist dabei ${s.bedeutung}.`, kind: "text", lines: 1, sample: gleichung, solution: "" },
        { label: "b)", prompt: `${s.text.match(/[^.?!]*\?$/)?.[0]?.trim() ?? "Löse die Gleichung."} Löse dazu die Gleichung.`, kind: "zahl", accepted: [x], solution: `${gleichungWeg(g).replace(/\n/g, ", ")}` },
        { label: "c)", prompt: "Mach die Probe: Setze deine Lösung in die Gleichung ein.", kind: "text", lines: 2, sample: `${probe} stimmt.`, solution: "" },
      ],
      hints: [`x ist ${s.bedeutung}.`, `Die Gleichung lautet: ${gleichung}`],
    });
  }
  return null;
}

