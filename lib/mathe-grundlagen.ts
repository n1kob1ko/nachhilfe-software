/**
 * Rechnungen ohne KI für häufige Themen der Unterstufe und Mittelschule (Generalprobe 2026-11-05: diese Fähigkeiten hatten nur
 * „Erkläre in eigenen Worten …“): Dezimalzahlen, Rechnen mit 10/100/1000, Vorrang, Runden, schriftliches Rechnen, Maße,
 * Bruchteile, Umwandeln, ggT/kgV, Teilbarkeit, Terme, binomische Formeln, Herausheben, Gleichungssysteme, Körper, Schluss-
 * rechnung, Zinsen, Prozent-Änderung, Promille, Potenzen, Wurzeln, Winkel, Vierecke, Maßstab, quadratische Gleichungen und
 * Trigonometrie im rechtwinkeligen Dreieck. Jede Aufgabe hat Lösungsweg, drei Hilfen und typische Fehler; alle Zahlen sind
 * so gewählt, dass das Ergebnis aufgeht (tests: lib/mathe-grundlagen.test.ts). Eigene Zahlen und Texte, keine aus Schulbüchern.
 */
import type { Difficulty } from "./curriculum";
import { kurzaufgabe as kurzaufgabeRoh, type Fehler } from "./mathe-rechnungen";
import { STUFE, antwort, gcd, geld, kuerze, pick, rint, zahl, type Rng } from "./schulbuch-zahlen";
import { GAP, type TaskDraft } from "./tasks";
import { termPoly, type Poly, type TermForm } from "./term-check";

type Gen = (rng: Rng, diff: Difficulty) => TaskDraft;

/** Wie kurzaufgabe (lib/mathe-rechnungen.ts), ohne typische Fehler „0“: die entstehen nur durch Runden und wären keine Hilfe. */
const aufgabe: typeof kurzaufgabeRoh = (skillId, diff, o) => kurzaufgabeRoh(skillId, diff, { ...o, errors: (o.errors ?? []).filter((e) => !/^[-−]?0$/.test(e.answer)) });

// ---------- Zahlen als Text ----------
/** 34567 → „34 567“ (schmales Leerzeichen wie im Schulbuch), Dezimalzahlen mit Beistrich. */
function gross(x: number): string {
  const s = zahl(x);
  const [ganz, rest] = s.replace("−", "").split(",");
  const g = ganz.length > 4 ? ganz.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ganz;
  return `${s.startsWith("−") ? "−" : ""}${g}${rest ? `,${rest}` : ""}`;
}
const r2 = (x: number) => Math.round(x * 100) / 100;
const r4 = (x: number) => Math.round(x * 10000) / 10000;
/** Ein Ergebnis mit Einheit: „60“, „60 cm³“, „60cm³“ (und cm^3). */
function mitEinheit(x: number | string, einheit: string): string[] {
  const w = typeof x === "number" ? antwort(x) : x;
  const out = [w, `${w} ${einheit}`, `${w}${einheit}`];
  const hoch = einheit.replace("²", "^2").replace("³", "^3");
  if (hoch !== einheit) out.push(`${w} ${hoch}`, `${w}${hoch}`);
  return out;
}
const fehler = (answer: number | string, label: string): Fehler => ({ answer: typeof answer === "number" ? antwort(answer) : answer, label });

// ---------- Terme als Text ----------
/** Monom „x^2·y“ → „x^2y“; Reihenfolge: höherer Grad zuerst, dann alphabetisch, die Zahl am Ende. */
const grad = (k: string) => (k ? k.split("·").reduce((s, f) => s + Number(f.split("^")[1] ?? 1), 0) : 0);
/** Die höchste Hochzahl einer Variable im Monom: bei gleichem Grad steht x^2 vor xy. */
const hoechste = (k: string) => (k ? Math.max(...k.split("·").map((f) => Number(f.split("^")[1] ?? 1))) : 0);
function termText(p: Poly): string {
  const glieder = [...p].filter(([, c]) => Math.abs(c) > 1e-9).sort(([a], [b]) => grad(b) - grad(a) || hoechste(b) - hoechste(a) || a.localeCompare(b));
  if (!glieder.length) return "0";
  return glieder
    .map(([k, c], i) => {
      const m = k.replace(/·/g, "");
      const betrag = Math.abs(c);
      const zahlTeil = m && betrag === 1 ? "" : zahl(betrag);
      const vz = c < 0 ? (i === 0 ? "−" : " − ") : i === 0 ? "" : " + ";
      return `${vz}${zahlTeil}${m}`;
    })
    .join("");
}
/** Das Polynom eines Terms der Aufgabe (immer lesbar: die Generatoren schreiben ihn selbst). */
function poly(text: string, vars: string[]): Poly {
  const p = termPoly(text, vars);
  if (!p) throw new Error(`Term nicht lesbar: ${text}`);
  return p;
}
const vorzeichenGlied = (c: number, m: string, erstes = false) => `${c < 0 ? (erstes ? "−" : " − ") : erstes ? "" : " + "}${Math.abs(c) === 1 && m ? "" : zahl(Math.abs(c))}${m}`;
const glieder = (xs: [number, string][]) => xs.map(([c, m], i) => vorzeichenGlied(c, m, i === 0)).join("");

function termAufgabe(skillId: string, diff: Difficulty, o: { prompt: string; ergebnis: string; vars: string[]; form?: TermForm; solution: string; hints: string[]; errors: Fehler[] }): TaskDraft {
  const t = aufgabe(skillId, diff, { prompt: o.prompt, accepted: [o.ergebnis], mode: "text", solution: o.solution, hints: o.hints, errors: o.errors.filter((e) => e.answer !== o.ergebnis) });
  return { ...t, answer: { ...t.answer, term: { vars: o.vars, form: o.form ?? "zusammengefasst" } } };
}

/** Zwei oder mehr Lücken mit Zahlen (Gleichungssystem, zwei Lösungen). */
function lueckenAufgabe(skillId: string, diff: Difficulty, o: { prompt: string; luecken: string; werte: number[]; solution: string; hints: string[]; errors: Fehler[] }): TaskDraft {
  const richtig = o.werte.map(antwort).join(" | ");
  return {
    type: "cloze",
    skillId,
    difficulty: diff,
    prompt: `${o.prompt}\n${o.luecken}`,
    data: {},
    answer: { blanks: o.werte.map((w) => [antwort(w)]), mode: "value" },
    solution: o.solution,
    hints: o.hints,
    errorMap: o.errors.filter((e, i, xs) => e.answer !== richtig && xs.findIndex((x) => x.answer === e.answer) === i),
  };
}

// ---------- Dezimalzahlen ----------
/** Eine Dezimalzahl mit `stellen` Nachkommastellen, als Tausendstel gezählt (keine Rundungsfehler). */
const dez = (rng: Rng, min: number, max: number, stellen: number) => rint(rng, min * 10 ** stellen, max * 10 ** stellen) / 10 ** stellen;
/** Nachkommastellen der genauen Zahl (nicht der gerundeten): 0,000756 hat 6, damit die Prüfungen „> 4“ greifen. */
const nachkomma = (x: number) => (String(Math.round(x * 1e8) / 1e8).split(".")[1] ?? "").length;

function dezimalAddieren(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const stellen = lv === 0 ? [1, 1] : lv === 1 ? [1, 2] : [pick(rng, [1, 2, 3]), pick(rng, [1, 2])];
    const xs = [dez(rng, 1, lv >= 3 ? 80 : 30, stellen[0]), dez(rng, 0.1, lv >= 3 ? 40 : 15, stellen[1])];
    if (lv >= 3) xs.push(dez(rng, 0.1, 10, pick(rng, [1, 2])));
    const ops: ("+" | "−")[] = lv === 0 ? ["+"] : lv === 1 ? [pick(rng, ["+", "+", "−"])] : lv === 2 ? ["−"] : [pick(rng, ["+", "−"]), pick(rng, ["+", "−"])];
    let res = xs[0];
    ops.forEach((op, i) => (res = r4(op === "+" ? res + xs[i + 1] : res - xs[i + 1])));
    if (res <= 0 || nachkomma(xs[0]) === nachkomma(xs[1]) && lv >= 2) continue;
    const text = xs.map((x, i) => (i === 0 ? zahl(x) : `${ops[i - 1]} ${zahl(x)}`)).join(" ");
    const n = Math.max(...xs.map(nachkomma));
    const mitNullen = (x: number) => x.toFixed(n).replace(".", ",");
    const alleAddiert = r4(xs.reduce((s, x) => s + x, 0));
    const errors: Fehler[] = [fehler(r4(res * 10), "Komma an der falschen Stelle"), fehler(r4(res / 10), "Komma an der falschen Stelle")];
    if (ops.includes("−")) errors.unshift(fehler(alleAddiert, "Addiert statt subtrahiert"));
    return aufgabe("mathe.dezimal.addieren", diff, {
      prompt: `Berechne: ${text}`,
      accepted: [antwort(res)],
      solution: `Komma unter Komma schreiben, fehlende Stellen mit 0 auffüllen:\n${xs.map((x, i) => (i === 0 ? mitNullen(x) : `${ops[i - 1]} ${mitNullen(x)}`)).join("\n")}\n= ${mitNullen(res)}\nErgebnis: ${zahl(res)}`,
      hints: ["Schreib die Zahlen so untereinander, dass Komma unter Komma steht.", "Fehlende Nachkommastellen füllst du mit 0 auf: 2,5 = 2,50.", `Rechne wie mit ganzen Zahlen und setz das Komma im Ergebnis an dieselbe Stelle (${n} Nachkommastellen).`],
      errors,
    });
  }
}

function dezimalMultiplizieren(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["mal-ganz", "durch-ganz"] as const) : lv === 1 ? (["mal-ganz", "mal", "durch-ganz"] as const) : (["mal", "durch-ganz", "durch-dez"] as const));
    if (kind === "mal-ganz" || kind === "mal") {
      const a = kind === "mal" ? dez(rng, 0.2, lv >= 3 ? 30 : 9, pick(rng, [1, 2])) : dez(rng, 0.2, 20, pick(rng, [1, 2]));
      const b = kind === "mal" ? dez(rng, 0.2, 9, 1) : rint(rng, 2, 9);
      if (Number.isInteger(a) || (kind === "mal" && Number.isInteger(b))) continue;
      const res = r4(a * b);
      const na = nachkomma(a);
      const nb = nachkomma(b);
      const ohne = Math.round(a * 10 ** na) * Math.round(b * 10 ** nb);
      return aufgabe("mathe.dezimal.multiplizieren", diff, {
        prompt: `Berechne: ${zahl(a)} · ${zahl(b)}`,
        accepted: [antwort(res)],
        solution: `Zuerst ohne Komma rechnen: ${Math.round(a * 10 ** na)} · ${Math.round(b * 10 ** nb)} = ${ohne}\nNachkommastellen zählen: ${na}${nb ? ` + ${nb} = ${na + nb}` : ""}\nErgebnis: ${zahl(res)}`,
        hints: ["Rechne zuerst so, als gäbe es kein Komma.", "Das Ergebnis hat so viele Nachkommastellen wie beide Zahlen zusammen.", `${zahl(a)} hat ${na}, ${zahl(b)} hat ${nb} Nachkommastellen.`],
        errors: [fehler(r4(res * 10), "Nachkommastellen falsch gezählt"), fehler(r4(res / 10), "Nachkommastellen falsch gezählt"), fehler(r4(a + b), "Addiert statt multipliziert")],
      });
    }
    const q = kind === "durch-dez" ? rint(rng, 2, lv >= 3 ? 40 : 12) : dez(rng, 0.2, 12, pick(rng, [1, 2]));
    const b = kind === "durch-dez" ? dez(rng, 0.2, 0.9, 1) * pick(rng, [1, 1, 10]) : rint(rng, 2, 9);
    const a = r4(q * b);
    if (nachkomma(a) > 3 || (kind === "durch-ganz" && Number.isInteger(q)) || (kind === "durch-dez" && Number.isInteger(b))) continue;
    if (kind === "durch-dez") {
      const f = 10 ** nachkomma(b);
      return aufgabe("mathe.dezimal.multiplizieren", diff, {
        prompt: `Berechne: ${zahl(a)} : ${zahl(b)}`,
        accepted: [antwort(q)],
        solution: `Das Komma beider Zahlen um ${nachkomma(b)} ${nachkomma(b) === 1 ? "Stelle" : "Stellen"} nach rechts verschieben (mal ${f}):\n${zahl(a)} : ${zahl(b)} = ${zahl(r4(a * f))} : ${zahl(r4(b * f))} = ${zahl(q)}`,
        hints: ["Durch eine Dezimalzahl dividierst du nicht direkt.", "Verschieb das Komma in beiden Zahlen gleich weit nach rechts, bis der Divisor eine ganze Zahl ist.", `${zahl(a)} : ${zahl(b)} = ${zahl(r4(a * f))} : ${zahl(r4(b * f))}`],
        errors: [fehler(r4(q / 10), "Komma nur bei einer Zahl verschoben"), fehler(r4(q * 10), "Komma nur bei einer Zahl verschoben")],
      });
    }
    return aufgabe("mathe.dezimal.multiplizieren", diff, {
      prompt: `Berechne: ${zahl(a)} : ${b}`,
      accepted: [antwort(q)],
      solution: `Dividieren wie mit ganzen Zahlen; sobald du das Komma überschreitest, setzt du im Ergebnis das Komma.\n${zahl(a)} : ${b} = ${zahl(q)}\nProbe: ${zahl(q)} · ${b} = ${zahl(a)}`,
      hints: ["Rechne wie bei ganzen Zahlen.", "Wenn du beim Dividieren das Komma überschreitest, kommt auch ins Ergebnis ein Komma.", `Probe: Ergebnis · ${b} muss ${zahl(a)} ergeben.`],
      errors: [fehler(r4(q * 10), "Komma im Ergebnis vergessen oder falsch gesetzt"), fehler(r4(q / 10), "Komma im Ergebnis falsch gesetzt")],
    });
  }
}

function zehner(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const f = pick(rng, lv === 0 ? [10, 100] : [10, 100, 1000]);
    const op = pick(rng, lv === 0 ? (["·", "·", ":"] as const) : (["·", ":"] as const));
    const a = lv <= 1 ? (op === "·" ? rint(rng, 3, 99) : rint(rng, 2, 99) * f) : dez(rng, 0.05, 99, pick(rng, [1, 2, 3]));
    const roh = op === "·" ? a * f : a / f;
    const res = r4(roh);
    if (res === a || nachkomma(roh) > 4 || res >= 1e6) continue;
    const stellen = String(f).length - 1;
    const richtung = op === "·" ? "rechts" : "links";
    const anders = r4(op === "·" ? a * (f === 10 ? 100 : f / 10) : a / (f === 10 ? 100 : f / 10));
    return aufgabe("mathe.zahlen.zehner", diff, {
      prompt: `Berechne: ${gross(a)} ${op} ${gross(f)}`,
      accepted: [antwort(res)],
      solution: `${op === "·" ? "Mal" : "Durch"} ${gross(f)}: das Komma ${stellen} ${stellen === 1 ? "Stelle" : "Stellen"} nach ${richtung} (${stellen} ${stellen === 1 ? "Null" : "Nullen"}).\n${gross(a)} ${op} ${gross(f)} = ${gross(res)}`,
      hints: [`${gross(f)} hat ${stellen} ${stellen === 1 ? "Null" : "Nullen"}.`, `${op === "·" ? "Beim Multiplizieren" : "Beim Dividieren"} wandert das Komma nach ${richtung}.`, "Fehlende Stellen füllst du mit 0 auf."],
      errors: [fehler(anders, "Komma um die falsche Anzahl Stellen verschoben"), fehler(r4(op === "·" ? a / f : a * f), `Komma in die falsche Richtung verschoben`)],
    });
  }
}

// ---------- Vorrang ----------
function vorrang(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["a+b·c", "a−b·c"] as const) : lv === 1 ? (["a+b·c", "(a+b)·c", "a−b:c"] as const) : lv === 2 ? (["a·b−c·d", "(a+b)·c", "a:(b+c)−d"] as const) : (["a·(b−c)−d:e", "(a+b)·c−d·e", "a−(b+c·d)"] as const));
    let text = "";
    let res = 0;
    let lr = NaN;
    let weg: string[] = [];
    if (kind === "a+b·c" || kind === "a−b·c") {
      const [b, c] = [rint(rng, 2, 9), rint(rng, 2, 9)];
      const a = kind === "a+b·c" ? rint(rng, 2, 40) : rint(rng, b * c + 1, b * c + 40);
      const plus = kind === "a+b·c";
      text = `${a} ${plus ? "+" : "−"} ${b} · ${c}`;
      res = plus ? a + b * c : a - b * c;
      lr = (plus ? a + b : a - b) * c;
      weg = [`${text} = ${a} ${plus ? "+" : "−"} ${b * c} = ${res}`];
    } else if (kind === "(a+b)·c") {
      const [a, b, c] = [rint(rng, 2, 20), rint(rng, 2, 20), rint(rng, 2, 9)];
      text = `(${a} + ${b}) · ${c}`;
      res = (a + b) * c;
      lr = a + b * c;
      weg = [`${text} = ${a + b} · ${c} = ${res}`];
    } else if (kind === "a−b:c") {
      const [c, q] = [rint(rng, 2, 9), rint(rng, 2, 9)];
      const b = c * q;
      const a = rint(rng, q + 1, q + 50);
      text = `${a} − ${b} : ${c}`;
      res = a - q;
      lr = Number.isInteger((a - b) / c) ? (a - b) / c : NaN;
      weg = [`${text} = ${a} − ${q} = ${res}`];
    } else if (kind === "a·b−c·d") {
      const [a, b, c, d] = [rint(rng, 3, 12), rint(rng, 3, 9), rint(rng, 2, 9), rint(rng, 2, 6)];
      if (a * b <= c * d) continue;
      text = `${a} · ${b} − ${c} · ${d}`;
      res = a * b - c * d;
      lr = (a * b - c) * d;
      weg = [`${text} = ${a * b} − ${c * d} = ${res}`];
    } else if (kind === "a:(b+c)−d") {
      const [b, c, q] = [rint(rng, 2, 7), rint(rng, 1, 6), rint(rng, 2, 9)];
      const a = (b + c) * q;
      const d = rint(rng, 1, q - 1 || 1);
      if (q - d <= 0) continue;
      text = `${a} : (${b} + ${c}) − ${d}`;
      res = q - d;
      weg = [`${text} = ${a} : ${b + c} − ${d} = ${q} − ${d} = ${res}`];
    } else if (kind === "a·(b−c)−d:e") {
      const [a, c, e, q] = [rint(rng, 2, 8), rint(rng, 1, 8), rint(rng, 2, 9), rint(rng, 2, 9)];
      const b = c + rint(rng, 2, 9);
      const d = e * q;
      res = a * (b - c) - q;
      if (res <= 0) continue;
      text = `${a} · (${b} − ${c}) − ${d} : ${e}`;
      weg = [`${text} = ${a} · ${b - c} − ${q} = ${a * (b - c)} − ${q} = ${res}`];
    } else if (kind === "(a+b)·c−d·e") {
      const [a, b, c, d, e] = [rint(rng, 2, 12), rint(rng, 2, 12), rint(rng, 2, 6), rint(rng, 2, 9), rint(rng, 2, 5)];
      res = (a + b) * c - d * e;
      if (res <= 0) continue;
      text = `(${a} + ${b}) · ${c} − ${d} · ${e}`;
      lr = ((a + b) * c - d) * e;
      weg = [`${text} = ${a + b} · ${c} − ${d * e} = ${(a + b) * c} − ${d * e} = ${res}`];
    } else {
      const [b, c, d] = [rint(rng, 2, 15), rint(rng, 2, 6), rint(rng, 2, 6)];
      const a = b + c * d + rint(rng, 5, 60);
      res = a - (b + c * d);
      text = `${a} − (${b} + ${c} · ${d})`;
      lr = a - (b + c) * d;
      weg = [`${text} = ${a} − (${b} + ${c * d}) = ${a} − ${b + c * d} = ${res}`];
    }
    const errors: Fehler[] = Number.isFinite(lr) && lr !== res ? [fehler(lr, kind.includes("(") && !kind.startsWith("a−(") ? "Klammer nicht zuerst gerechnet" : "Von links nach rechts gerechnet statt Punkt vor Strich")] : [];
    return aufgabe("mathe.zahlen.vorrang", diff, {
      prompt: `Berechne: ${text}`,
      accepted: [antwort(res)],
      solution: `Klammern zuerst, dann Punkt vor Strich (· und : vor + und −).\n${weg.join("\n")}`,
      hints: ["Gibt es eine Klammer? Die rechnest du zuerst.", "Punktrechnung (· und :) kommt vor Strichrechnung (+ und −).", `Erster Schritt: ${weg[0].split(" = ")[1]}`],
      errors,
    });
  }
}

// ---------- Runden ----------
const STELLEN_NAME: Record<number, string> = { 10: "Zehner", 100: "Hunderter", 1000: "Tausender", 10000: "Zehntausender", 0.1: "Zehntel (eine Dezimalstelle)", 0.01: "Hundertstel (zwei Dezimalstellen)", 0.001: "Tausendstel (drei Dezimalstellen)" };
function runden(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const auf = pick(rng, lv === 0 ? [10, 100] : lv === 1 ? [10, 100, 1000] : lv === 2 ? [1000, 0.1, 0.01] : [10000, 0.01, 0.001]);
    const x = auf >= 1 ? rint(rng, auf * 3, auf * 99) + rint(rng, 1, auf - 1) : dez(rng, 0.1, 99, auf === 0.1 ? 3 : 4);
    const res = r4(Math.round(x / auf) * auf);
    const ab = r4(Math.floor(x / auf) * auf);
    if (res === x || res === ab) continue;
    const ziffer = auf >= 1 ? Math.floor((x % auf) / (auf / 10)) : Math.floor(r4((x / auf) % 1) * 10);
    return aufgabe("mathe.zahlen.runden", diff, {
      prompt: `Runde ${gross(x)} auf ${STELLEN_NAME[auf]}.`,
      accepted: [antwort(res)],
      solution: `Die Ziffer rechts von der Rundungsstelle ist ${ziffer}: ${ziffer >= 5 ? "5 oder mehr, also aufrunden" : "weniger als 5, also abrunden"}.\n${gross(x)} ≈ ${gross(res)}`,
      hints: [`Unterstreiche die ${STELLEN_NAME[auf].split(" ")[0]}stelle.`, "Schau auf die Ziffer rechts daneben: 0 bis 4 abrunden, 5 bis 9 aufrunden.", "Alle Stellen rechts davon werden 0 (bei Dezimalzahlen fallen sie weg)."],
      errors: [fehler(ab, "Abgeschnitten statt gerundet"), fehler(r4(Math.round(x / (auf * 10)) * auf * 10), "Auf die falsche Stelle gerundet")],
    });
  }
}

// ---------- schriftlich rechnen ----------
const ziffern = (n: number) => String(n).split("").map(Number);
function ohneUebertrag(a: number, b: number): number {
  const [x, y] = [ziffern(a).reverse(), ziffern(b).reverse()];
  return Number(x.map((d, i) => (d + (y[i] ?? 0)) % 10).reverse().join(""));
}
function kleinereVonGroesserer(a: number, b: number): number {
  const [x, y] = [ziffern(a).reverse(), ziffern(b).reverse()];
  return Number(x.map((d, i) => Math.abs(d - (y[i] ?? 0))).reverse().join(""));
}
function schriftlichAddieren(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const minus = lv >= 1 && rng() < 0.5;
    const stellen = [3, 4, 4, 5, 6][lv];
    const a = rint(rng, 10 ** (stellen - 1), 10 ** stellen - 1);
    const b = rint(rng, 10 ** (stellen - 2), minus ? a - 1 : 10 ** stellen - 1);
    const res = minus ? a - b : a + b;
    const fehlerWert = minus ? kleinereVonGroesserer(a, b) : ohneUebertrag(a, b);
    if (fehlerWert === res) continue;
    return aufgabe("mathe.zahlen.addieren", diff, {
      prompt: `Rechne schriftlich: ${gross(a)} ${minus ? "−" : "+"} ${gross(b)}`,
      accepted: [antwort(res)],
      solution: `Stellengerecht untereinander schreiben (Einer unter Einer) und von rechts nach links rechnen${minus ? ", beim Ergänzen den Übertrag nicht vergessen" : ", den Übertrag jeweils zur nächsten Stelle"}.\n${gross(a)} ${minus ? "−" : "+"} ${gross(b)} = ${gross(res)}${minus ? `\nProbe: ${gross(res)} + ${gross(b)} = ${gross(a)}` : ""}`,
      hints: ["Schreib Einer unter Einer, Zehner unter Zehner.", "Beginne rechts bei den Einern.", minus ? "Ist die obere Ziffer kleiner, ergänzt du mit einem Übertrag (wie 13 − 7)." : "Ist eine Summe 10 oder mehr, schreib die Einer und nimm den Übertrag mit."],
      errors: [fehler(fehlerWert, minus ? "Immer die kleinere von der größeren Ziffer abgezogen" : "Übertrag vergessen")],
    });
  }
}
function schriftlichMultiplizieren(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const a = rint(rng, [12, 101, 101, 201, 1001][lv], [99, 499, 999, 999, 4999][lv]);
    const b = lv === 0 ? rint(rng, 3, 9) : rint(rng, [3, 12, 21, 101, 21][lv], [9, 49, 99, 399, 99][lv]);
    const res = a * b;
    const bz = ziffern(b);
    const zeilen = bz.map((d, i) => a * d * 10 ** (bz.length - 1 - i));
    const ohneEinruecken = bz.reduce((s, d) => s + a * d, 0);
    const errors: Fehler[] = b >= 10 && ohneEinruecken !== res ? [fehler(ohneEinruecken, "Teilergebnisse nicht eingerückt")] : [];
    errors.push(fehler(res + a, "Mit einer Zahl zu viel multipliziert"));
    return aufgabe("mathe.zahlen.multiplizieren", diff, {
      prompt: `Rechne schriftlich: ${gross(a)} · ${b}`,
      accepted: [antwort(res)],
      solution: b >= 10 ? `Mit jeder Ziffer von ${b} einzeln multiplizieren, jede Zeile eine Stelle weiter rechts:\n${bz.map((d, i) => `${gross(a)} · ${d} = ${gross(a * d)}${bz.length - 1 - i ? ` (eingerückt: ${gross(zeilen[i])})` : ""}`).join("\n")}\nZusammen: ${zeilen.map(gross).join(" + ")} = ${gross(res)}` : `${gross(a)} · ${b} = ${gross(res)} (von rechts nach links, Übertrag dazuzählen)`,
      hints: ["Multipliziere von rechts nach links und zähl den Übertrag dazu.", b >= 10 ? "Für jede Ziffer des zweiten Faktors eine Zeile, jede Zeile um eine Stelle eingerückt." : "Schreib den Übertrag klein über die nächste Stelle.", `Überschlag: etwa ${gross(Math.round(a / 10 ** (String(a).length - 1)) * 10 ** (String(a).length - 1) * (b >= 10 ? Math.round(b / 10) * 10 : b))}`],
      errors,
    });
  }
}
function schriftlichDividieren(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const b = lv <= 1 ? rint(rng, 2, 9) : rint(rng, 12, lv >= 3 ? 48 : 25);
    const q = rint(rng, [12, 102, 104, 201, 1001][lv], [99, 999, 999, 999, 4999][lv]);
    const a = q * b;
    if (a > 99999) continue;
    const ohneNull = String(q).includes("0") ? Number(String(q).replace(/0/g, "")) : null;
    const errors: Fehler[] = ohneNull && ohneNull !== q ? [fehler(ohneNull, "Null im Ergebnis vergessen")] : [];
    errors.push(fehler(q + 1, "Verrechnet: Probe hilft"));
    return aufgabe("mathe.zahlen.dividieren", diff, {
      prompt: `Rechne schriftlich: ${gross(a)} : ${b}`,
      accepted: [antwort(q)],
      solution: `Stelle für Stelle von links: wie oft passt ${b} hinein, Rest mitnehmen, nächste Ziffer herunterholen. Passt ${b} nicht hinein, schreibst du 0 ins Ergebnis.\n${gross(a)} : ${b} = ${gross(q)}\nProbe: ${gross(q)} · ${b} = ${gross(a)}`,
      hints: [`Wie oft passt ${b} in die ersten Ziffern von ${gross(a)}?`, "Hol jeweils die nächste Ziffer herunter. Passt der Divisor nicht hinein, kommt eine 0 ins Ergebnis.", `Probe: Ergebnis · ${b} = ${gross(a)}`],
      errors,
    });
  }
}

// ---------- Maße ----------
type Masskette = { einheiten: string[]; faktoren: number[]; skill: string; name: string };
const LAENGEN: Masskette = { skill: "mathe.masse.laengen", name: "Längenmaße", einheiten: ["mm", "cm", "dm", "m", "km"], faktoren: [10, 10, 10, 1000] };
const MASSEN: Masskette = { skill: "mathe.masse.massen", name: "Massenmaße", einheiten: ["g", "dag", "kg", "t"], faktoren: [10, 100, 1000] };
const FLAECHEN: Masskette = { skill: "mathe.masse.flaechen", name: "Flächenmaße", einheiten: ["mm²", "cm²", "dm²", "m²", "a", "ha", "km²"], faktoren: [100, 100, 100, 100, 100, 100] };
const VOLUMEN: Masskette = { skill: "mathe.masse.volumen", name: "Raummaße", einheiten: ["mm³", "cm³", "dm³", "m³"], faktoren: [1000, 1000, 1000] };

function masseAufgabe(k: Masskette): Gen {
  return (rng, diff) => {
    const lv = STUFE[diff];
    for (;;) {
      // Liter und Milliliter bei den Raummaßen: 1 l = 1 dm³, 1 ml = 1 cm³, 1 hl = 100 l
      if (k === VOLUMEN && rng() < 0.35) {
        const [von, nach, f] = pick(rng, [["l", "ml", 1000], ["dm³", "l", 1], ["l", "cm³", 1000], ["hl", "l", 100], ["m³", "l", 1000], ["ml", "l", 0.001]] as const);
        const x = f < 1 ? rint(rng, 1, 99) * 50 : dez(rng, 0.5, 30, lv === 0 ? 0 : pick(rng, [1, 2]));
        const res = r4(x * f);
        if (f === 1 && x === res && rng() < 0.5) continue;
        return aufgabe(k.skill, diff, {
          prompt: `Wandle um: ${zahl(x)} ${von} = ? ${nach}`,
          accepted: mitEinheit(res, nach),
          solution: `1 l = 1 dm³ = 1 000 ml, 1 ml = 1 cm³, 1 hl = 100 l, 1 m³ = 1 000 l.\n${zahl(x)} ${von} = ${zahl(res)} ${nach}`,
          hints: ["1 Liter ist genau 1 dm³.", "1 l = 1 000 ml und 1 ml = 1 cm³.", `Von ${von} nach ${nach}: ${f >= 1 ? `mal ${gross(f)}` : `durch ${gross(1 / f)}`}.`],
          errors: [fehler(r4(f >= 1 ? x * f * 10 : x * f / 10), "Mit dem falschen Faktor umgerechnet"), fehler(r4(f > 1 ? x / f : x * (1 / f || 1)), "In die falsche Richtung umgerechnet")],
        });
      }
      const i = rint(rng, 0, k.einheiten.length - 2);
      const schritte = lv === 0 ? 1 : pick(rng, [1, 2, lv >= 3 ? 3 : 2]);
      const j = Math.min(k.einheiten.length - 1, i + schritte);
      const faktor = k.faktoren.slice(i, j).reduce((s, f) => s * f, 1);
      const klein = rng() < 0.5;
      // gemischte Angabe (2 m 35 cm) ab „schwer“
      if (lv >= 3 && j - i === 1 && faktor <= 1000) {
        const g = rint(rng, 1, 30);
        const r = rint(rng, 1, faktor - 1);
        const [gr, kl] = [k.einheiten[j], k.einheiten[i]];
        const inKlein = rng() < 0.5;
        const res = inKlein ? g * faktor + r : r4(g + r / faktor);
        if (nachkomma(g + r / faktor) > 3) continue;
        return aufgabe(k.skill, diff, {
          prompt: `Schreib in ${inKlein ? kl : gr}: ${g} ${gr} ${r} ${kl}`,
          accepted: mitEinheit(res, inKlein ? kl : gr),
          solution: `1 ${gr} = ${gross(faktor)} ${kl}.\n${g} ${gr} ${r} ${kl} = ${inKlein ? `${gross(g * faktor)} ${kl} + ${r} ${kl} = ${gross(res)} ${kl}` : `${g} ${gr} + ${zahl(r4(r / faktor))} ${gr} = ${zahl(res)} ${gr}`}`,
          hints: [`1 ${gr} = ${gross(faktor)} ${kl}.`, inKlein ? `Rechne zuerst ${g} ${gr} in ${kl} um.` : `${r} ${kl} sind ${zahl(r4(r / faktor))} ${gr}.`, "Zähl dann beides zusammen."],
          errors: inKlein ? [fehler(g * (faktor === 1000 ? 100 : faktor * 10) + r, "Mit dem falschen Faktor umgerechnet")] : [fehler(`${g},${r}`, `${r} ${kl} einfach hinter das Komma geschrieben`)],
        });
      }
      const [von, nach] = klein ? [k.einheiten[j], k.einheiten[i]] : [k.einheiten[i], k.einheiten[j]];
      const x = klein ? dez(rng, 0.05, 50, lv === 0 ? 0 : pick(rng, [1, 2])) : rint(rng, 1, 999) * pick(rng, [1, 10, faktor >= 100 ? 50 : 5]);
      const roh = klein ? x * faktor : x / faktor;
      const res = r4(roh);
      if (res === 0 || nachkomma(roh) > 4 || res >= 1e7 || x === 0) continue;
      const falschFaktor = (k.faktoren[i] === 10 ? faktor * 10 : faktor / (k.faktoren[i] / 10)) || faktor * 10;
      const errors: Fehler[] = [fehler(r4(klein ? x * falschFaktor : x / falschFaktor), k === FLAECHEN ? "Mit 10 statt 100 je Stufe gerechnet" : k === VOLUMEN ? "Mit 10 oder 100 statt 1 000 je Stufe gerechnet" : "Mit dem falschen Faktor umgerechnet"), fehler(r4(klein ? x / faktor : x * faktor), "In die falsche Richtung umgerechnet")];
      if (k === FLAECHEN || k === VOLUMEN) errors.unshift(fehler(r4(klein ? x * 10 ** (j - i) : x / 10 ** (j - i)), `Wie Längen umgerechnet (mal 10 statt mal ${k === FLAECHEN ? 100 : "1 000"})`));
      const stufen = k.einheiten.slice(i, j + 1).map((e, n) => (n ? `${gross(k.faktoren[i + n - 1])} ${k.einheiten[i + n - 1]} = 1 ${e}` : "")).filter(Boolean);
      return aufgabe(k.skill, diff, {
        prompt: `Wandle um: ${gross(x)} ${von} = ? ${nach}`,
        accepted: mitEinheit(res, nach),
        solution: `${stufen.join(", ")}.\nVon ${von} nach ${nach}: ${klein ? "mal" : "durch"} ${gross(faktor)}.\n${gross(x)} ${von} = ${gross(res)} ${nach}`,
        hints: [`${k.name}: ${k === FLAECHEN ? "jede Stufe ist 100." : k === VOLUMEN ? "jede Stufe ist 1 000." : "schau dir die Umrechnungszahlen der Einheiten an."}`, `In die kleinere Einheit wird die Zahl größer (mal), in die größere kleiner (durch).`, `Von ${von} nach ${nach}: ${klein ? "mal" : "durch"} ${gross(faktor)}.`],
        errors,
      });
    }
  };
}

function zeitmasse(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["h-min", "min-s"] as const) : lv <= 2 ? (["h-min", "min-s", "dezimal", "spanne"] as const) : (["dezimal", "spanne", "spanne", "tage"] as const));
    if (kind === "h-min" || kind === "min-s") {
      const [gr, kl] = kind === "h-min" ? ["h", "min"] : ["min", "s"];
      const g = rint(rng, 1, 9);
      const r = rint(rng, 1, 59);
      const res = g * 60 + r;
      return aufgabe("mathe.masse.zeit", diff, {
        prompt: `Wie viele ${kl === "min" ? "Minuten" : "Sekunden"} sind ${g} ${gr} ${r} ${kl}?`,
        accepted: mitEinheit(res, kl),
        solution: `1 ${gr} = 60 ${kl}.\n${g} ${gr} = ${g * 60} ${kl}, dazu ${r} ${kl}: ${res} ${kl}`,
        hints: [`1 ${gr} hat 60 ${kl}, nicht 100.`, `Rechne zuerst ${g} · 60.`, `Zähl dann ${r} ${kl} dazu.`],
        errors: [fehler(g * 100 + r, "Mit 100 statt 60 gerechnet"), fehler(g * 60, `Die ${r} ${kl} vergessen`)],
      });
    }
    if (kind === "dezimal") {
      const x = pick(rng, [0.25, 0.5, 0.75, 1.5, 2.25, 1.75, 2.5, 3.5, 0.2, 1.2]);
      const res = r4(x * 60);
      if (!Number.isInteger(res)) continue;
      return aufgabe("mathe.masse.zeit", diff, {
        prompt: `Wie viele Minuten sind ${zahl(x)} h?`,
        accepted: mitEinheit(res, "min"),
        solution: `1 h = 60 min.\n${zahl(x)} h = ${zahl(x)} · 60 min = ${res} min`,
        hints: ["Eine Stunde hat 60 Minuten.", "0,5 h ist eine halbe Stunde, also 30 min, nicht 50 min.", `Rechne ${zahl(x)} · 60.`],
        errors: [fehler(r4(x * 100), "Mit 100 statt 60 gerechnet"), fehler(Math.floor(x) * 60 + Math.round((x % 1) * 10), "Die Nachkommastellen als Minuten gelesen")],
      });
    }
    if (kind === "tage") {
      const t = rint(rng, 1, 4);
      const h = rint(rng, 1, 23);
      return aufgabe("mathe.masse.zeit", diff, {
        prompt: `Wie viele Stunden sind ${t} ${t === 1 ? "Tag" : "Tage"} und ${h} h?`,
        accepted: mitEinheit(t * 24 + h, "h"),
        solution: `1 Tag = 24 h.\n${t} · 24 h + ${h} h = ${t * 24 + h} h`,
        hints: ["Ein Tag hat 24 Stunden.", `Rechne ${t} · 24.`, `Zähl die ${h} h dazu.`],
        errors: [fehler(t * 100 + h, "Mit 100 statt 24 gerechnet"), fehler(t * 60 + h, "Mit 60 statt 24 gerechnet")],
      });
    }
    const start = rint(rng, 6 * 60, 15 * 60 - 1);
    const dauer = rint(rng, 20, lv >= 3 ? 8 * 60 : 4 * 60);
    const ende = start + dauer;
    const uhr = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
    const mitHundert = Math.round((Math.floor(ende / 60) * 100 + (ende % 60)) - (Math.floor(start / 60) * 100 + (start % 60)));
    if (ende % 60 >= start % 60) continue;
    return aufgabe("mathe.masse.zeit", diff, {
      prompt: `Wie viele Minuten dauert es von ${uhr(start)} Uhr bis ${uhr(ende)} Uhr?`,
      accepted: mitEinheit(dauer, "min"),
      solution: `Zuerst bis zur vollen Stunde, dann die ganzen Stunden, dann der Rest:\n${uhr(start)} → ${uhr(Math.ceil(start / 60) * 60)}: ${60 - (start % 60)} min\n${uhr(Math.ceil(start / 60) * 60)} → ${uhr(Math.floor(ende / 60) * 60)}: ${(Math.floor(ende / 60) - Math.ceil(start / 60)) * 60} min\n${uhr(Math.floor(ende / 60) * 60)} → ${uhr(ende)}: ${ende % 60} min\nZusammen: ${dauer} min${dauer >= 60 ? ` (${Math.floor(dauer / 60)} h ${dauer % 60} min)` : ""}`,
      hints: ["Rechne zuerst bis zur nächsten vollen Stunde.", "Eine Stunde hat 60 Minuten: Uhrzeiten nicht wie Dezimalzahlen abziehen.", `${uhr(start)} → ${uhr(Math.ceil(start / 60) * 60)} sind ${60 - (start % 60)} min.`],
      errors: [fehler(mitHundert, "Uhrzeiten wie Dezimalzahlen abgezogen (mit 100 statt 60)")],
    });
  }
}

function massstab(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const m = pick(rng, lv === 0 ? [100, 1000] : lv <= 2 ? [500, 1000, 10000, 25000, 50000] : [25000, 50000, 200000]);
    const karte = lv === 0 ? rint(rng, 2, 12) : dez(rng, 1.5, 15, pick(rng, [0, 1]));
    const echtCm = r4(karte * m);
    const zurueck = rng() < 0.4 && lv >= 2;
    const [einheit, teiler] = echtCm >= 100000 ? ["km", 100000] : ["m", 100];
    const echt = r4(echtCm / teiler);
    if (nachkomma(echtCm / teiler) > 3) continue;
    if (zurueck) {
      return aufgabe("mathe.masse.massstab", diff, {
        prompt: `Maßstab 1 : ${gross(m)}. In Wirklichkeit sind es ${zahl(echt)} ${einheit}. Wie viele cm sind es auf der Karte?`,
        accepted: mitEinheit(karte, "cm"),
        solution: `${zahl(echt)} ${einheit} = ${gross(echtCm)} cm.\n${gross(echtCm)} cm : ${gross(m)} = ${zahl(karte)} cm`,
        hints: ["Rechne die Wirklichkeit zuerst in cm um.", `1 cm auf der Karte sind ${gross(m)} cm in Wirklichkeit.`, `Dividiere durch ${gross(m)}.`],
        errors: [fehler(r4(echt / m), "Nicht zuerst in cm umgerechnet"), fehler(r4(echtCm * m), "Multipliziert statt dividiert")],
      });
    }
    return aufgabe("mathe.masse.massstab", diff, {
      prompt: `Maßstab 1 : ${gross(m)}. Auf der Karte sind es ${zahl(karte)} cm. Wie viele ${einheit === "km" ? "Kilometer" : "Meter"} sind es in Wirklichkeit?`,
      accepted: mitEinheit(echt, einheit),
      solution: `1 cm auf der Karte = ${gross(m)} cm in Wirklichkeit.\n${zahl(karte)} cm · ${gross(m)} = ${gross(echtCm)} cm = ${zahl(echt)} ${einheit}`,
      hints: [`1 cm auf der Karte sind ${gross(m)} cm in Wirklichkeit.`, `Multipliziere ${zahl(karte)} mit ${gross(m)}.`, `Rechne das Ergebnis von cm in ${einheit} um (${einheit === "km" ? "durch 100 000" : "durch 100"}).`],
      errors: [fehler(echtCm, `Nicht von cm in ${einheit} umgerechnet`), fehler(r4(echtCm / (teiler === 100 ? 1000 : 10000)), "Beim Umrechnen den falschen Faktor genommen")],
    });
  }
}

// ---------- Brüche ----------
const KONTEXT_VON = [
  ["kg", "Äpfel"],
  ["€", "Taschengeld"],
  ["m", "Stoff"],
  ["min", "Fahrzeit"],
  ["l", "Saft"],
] as const;
function bruchteilVon(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const d = pick(rng, lv === 0 ? [2, 3, 4, 5, 10] : [3, 4, 5, 6, 8, 10, 12]);
    const n = rint(rng, 1, d - 1);
    if (gcd(n, d) !== 1) continue;
    const teil = rint(rng, 2, lv >= 3 ? 40 : 15);
    const ganzes = d * teil;
    const res = n * teil;
    const [einheit, was] = pick(rng, KONTEXT_VON);
    const wort = lv === 0 ? "" : ` ${was}`;
    return aufgabe("mathe.brueche.vonzahlen", diff, {
      prompt: `Berechne ${n}/${d} von ${ganzes} ${einheit}${wort ? ` (${was.trim()})` : ""}.`,
      accepted: mitEinheit(res, einheit),
      solution: `Zuerst durch den Nenner, dann mal den Zähler:\n${ganzes} : ${d} = ${teil}\n${teil} · ${n} = ${res} ${einheit}`,
      hints: [`„${n}/${d} von“ heißt: in ${d} gleiche Teile teilen und ${n} davon nehmen.`, `Ein ${d}-tel von ${ganzes} ist ${ganzes} : ${d}.`, n === 1 ? `Rechne ${ganzes} : ${d}.` : `${ganzes} : ${d} = ${teil}, jetzt mal ${n}.`],
      errors: [fehler(teil, "Nur durch den Nenner dividiert"), ...(Number.isInteger((ganzes * d) / n) ? [fehler((ganzes * d) / n, "Zähler und Nenner vertauscht")] : []), fehler(ganzes * n, "Nur mit dem Zähler multipliziert")],
    });
  }
}

function bruchDezimal(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["b-d", "d-b"] as const) : (["b-d", "d-b", "b-p", "p-b"] as const));
    const d = pick(rng, lv <= 1 ? [2, 4, 5, 10, 20, 25] : [4, 5, 8, 20, 25, 40, 50]);
    const n = rint(rng, 1, d - 1);
    if (gcd(n, d) !== 1) continue;
    const w = r4(n / d);
    if (kind === "b-d") {
      return aufgabe("mathe.brueche.dezimal", diff, {
        prompt: `Schreib als Dezimalzahl: ${n}/${d}`,
        accepted: [antwort(w)],
        solution: `Zähler durch Nenner: ${n} : ${d} = ${zahl(w)}${[2, 4, 5, 20, 25, 50].includes(d) ? `\nOder auf einen Nenner 10, 100 oder 1 000 erweitern: ${n}/${d} = ${Math.round(w * 10 ** nachkomma(w))}/${10 ** nachkomma(w)} = ${zahl(w)}` : ""}`,
        hints: ["Ein Bruch ist eine Division: Zähler durch Nenner.", "Oder erweitere auf 10, 100 oder 1 000.", `${n} : ${d} = ?`],
        errors: [fehler(`${n},${d}`, "Zähler und Nenner mit Komma hintereinander geschrieben"), fehler(r4(d / n), "Nenner durch Zähler gerechnet")],
      });
    }
    if (kind === "b-p") {
      const p = r4(w * 100);
      return aufgabe("mathe.brueche.dezimal", diff, {
        prompt: `Wie viel Prozent sind ${n}/${d}?`,
        accepted: [antwort(p), `${antwort(p)} %`, `${antwort(p)}%`],
        solution: `${n}/${d} = ${zahl(w)} = ${zahl(p)} %`,
        hints: ["Prozent heißt Hundertstel.", `Erweitere ${n}/${d} auf den Nenner 100 oder rechne ${n} : ${d}.`, `Dezimalzahl mal 100 ergibt Prozent, zum Beispiel ${w === 0.25 ? "0,4 = 40 %" : "0,25 = 25 %"}.`],
        errors: [fehler(w, "Dezimalzahl statt Prozent angegeben"), fehler(r4(w * 10), "Mit 10 statt 100 multipliziert")],
      });
    }
    // Dezimalzahl oder Prozent in einen gekürzten Bruch
    const k = kuerze({ n: Math.round(w * 10 ** nachkomma(w)), d: 10 ** nachkomma(w) });
    const vonProzent = kind === "p-b";
    const t = aufgabe("mathe.brueche.dezimal", diff, {
      prompt: vonProzent ? `Schreib als gekürzten Bruch: ${zahl(r4(w * 100))} %` : `Schreib als gekürzten Bruch: ${zahl(w)}`,
      accepted: [`${k.n}/${k.d}`],
      solution: `${vonProzent ? `${zahl(r4(w * 100))} % = ${zahl(r4(w * 100))}/100` : `${zahl(w)} = ${Math.round(w * 10 ** nachkomma(w))}/${10 ** nachkomma(w)}`} = ${k.n}/${k.d} (gekürzt durch ${(10 ** (vonProzent ? 2 : nachkomma(w))) / k.d})`,
      // das Beispiel ist nie die Aufgabe selbst
      hints: [vonProzent ? `Prozent heißt Hundertstel: ${w === 0.35 ? "45 % = 45/100" : "35 % = 35/100"}.` : `Die Nachkommastellen sagen den Nenner: ${w === 0.35 ? "0,45 = 45/100" : "0,35 = 35/100"}.`, "Kürze dann so weit wie möglich.", "Such den größten gemeinsamen Teiler von Zähler und Nenner."],
      errors: [fehler(vonProzent ? `${Math.round(w * 100)}/100` : `${Math.round(w * 10 ** nachkomma(w))}/${10 ** nachkomma(w)}`, "Nicht gekürzt")],
    });
    return { ...t, answer: { ...t.answer, form: "gekuerzt" } };
  }
}

// ---------- Teilbarkeit ----------
function ggtKgv(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const g = pick(rng, lv === 0 ? [2, 3, 4, 5, 6] : [4, 6, 8, 9, 12, 14, 15, 18]);
    const [p, q] = [rint(rng, 2, lv >= 3 ? 12 : 7), rint(rng, 2, lv >= 3 ? 12 : 7)];
    if (p === q || gcd(p, q) !== 1) continue;
    const [a, b] = [g * p, g * q];
    const kgv = (a * b) / g;
    if (kgv > 500) continue;
    const welche = rng() < 0.5 ? "ggT" : "kgV";
    const teiler = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((t) => n % t === 0);
    return aufgabe("mathe.teilbarkeit.ggt-kgv", diff, {
      prompt: `Bestimme den ${welche} von ${a} und ${b}.`,
      accepted: [antwort(welche === "ggT" ? g : kgv)],
      solution:
        welche === "ggT"
          ? `Teiler von ${a}: ${teiler(a).join(", ")}\nTeiler von ${b}: ${teiler(b).join(", ")}\nDer größte gemeinsame Teiler ist ${g}.`
          : `Vielfache von ${Math.max(a, b)}: ${[1, 2, 3, 4, 5, 6].map((i) => i * Math.max(a, b)).filter((x) => x <= kgv).join(", ")}\nDas erste, das auch durch ${Math.min(a, b)} teilbar ist: ${kgv}.\nKürzer: kgV = ${a} · ${b} : ggT = ${a * b} : ${g} = ${kgv}`,
      hints: welche === "ggT" ? ["Schreib alle Teiler beider Zahlen auf.", "Welche Teiler kommen in beiden Listen vor?", "Der größte davon ist der ggT."] : ["Schreib die Vielfachen der größeren Zahl auf.", "Welches ist als Erstes auch durch die kleinere Zahl teilbar?", `Tipp: kgV = ${a} · ${b} : ggT.`],
      errors: welche === "ggT" ? [fehler(g / (g % 2 === 0 ? 2 : g % 3 === 0 ? 3 : g), "Nicht den größten gemeinsamen Teiler genommen"), fehler(kgv, "kgV statt ggT bestimmt")] : [fehler(a * b, "Einfach multipliziert (nicht das kleinste Vielfache)"), fehler(g, "ggT statt kgV bestimmt")],
    });
  }
}

const TEILER_REGEL: Record<number, { regel: string; test: (n: number) => string }> = {
  2: { regel: "Durch 2 teilbar: die letzte Ziffer ist gerade (0, 2, 4, 6, 8).", test: (n) => `Letzte Ziffer: ${n % 10}.` },
  3: { regel: "Durch 3 teilbar: die Ziffernsumme ist durch 3 teilbar.", test: (n) => `Ziffernsumme: ${ziffern(n).join(" + ")} = ${ziffern(n).reduce((s, d) => s + d, 0)}.` },
  4: { regel: "Durch 4 teilbar: die Zahl aus den letzten zwei Ziffern ist durch 4 teilbar.", test: (n) => `Letzte zwei Ziffern: ${String(n % 100).padStart(2, "0")}.` },
  5: { regel: "Durch 5 teilbar: die letzte Ziffer ist 0 oder 5.", test: (n) => `Letzte Ziffer: ${n % 10}.` },
  6: { regel: "Durch 6 teilbar: durch 2 und durch 3 teilbar.", test: (n) => `Gerade: ${n % 2 === 0 ? "ja" : "nein"}; Ziffernsumme ${ziffern(n).reduce((s, d) => s + d, 0)}.` },
  9: { regel: "Durch 9 teilbar: die Ziffernsumme ist durch 9 teilbar.", test: (n) => `Ziffernsumme: ${ziffern(n).join(" + ")} = ${ziffern(n).reduce((s, d) => s + d, 0)}.` },
  10: { regel: "Durch 10 teilbar: die letzte Ziffer ist 0.", test: (n) => `Letzte Ziffer: ${n % 10}.` },
  25: { regel: "Durch 25 teilbar: die letzten zwei Ziffern sind 00, 25, 50 oder 75.", test: (n) => `Letzte zwei Ziffern: ${String(n % 100).padStart(2, "0")}.` },
};
function teilbarkeitsregeln(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const t = pick(rng, lv === 0 ? [2, 5, 10] : lv <= 2 ? [3, 4, 5, 9] : [3, 4, 6, 9, 25]);
  const ja = rng() < 0.5;
  let n = 0;
  for (let i = 0; i < 200; i++) {
    n = rint(rng, lv === 0 ? 100 : 1000, lv >= 3 ? 99999 : 9999);
    if ((n % t === 0) === ja) break;
  }
  const r = TEILER_REGEL[t];
  const richtig = n % t === 0 ? "ja" : "nein";
  return aufgabe("mathe.teilbarkeit.regeln", diff, {
    prompt: `Ist ${gross(n)} durch ${t} teilbar? Antworte mit ja oder nein.`,
    accepted: [richtig],
    mode: "text",
    solution: `${r.regel}\n${r.test(n)} Also ${richtig === "ja" ? "ist" : "ist"} ${gross(n)} ${richtig === "ja" ? "" : "nicht "}durch ${t} teilbar.`,
    hints: [r.regel, r.test(n), "Prüf mit der Regel, ohne zu dividieren."],
    errors: [fehler(richtig === "ja" ? "nein" : "ja", "Teilbarkeitsregel falsch angewendet")],
  });
}

// ---------- Terme ----------
const VAR_PAARE = [["x", "y"], ["a", "b"], ["m", "n"]] as const;

function termWert(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    if (lv >= 2 && rng() < 0.4) {
      // Term aufstellen aus Worten
      const [k, d] = [rint(rng, 2, 9), rint(rng, 1, 20)];
      const plus = rng() < 0.5;
      const v = pick(rng, ["x", "n", "a"]);
      const worte = pick(rng, [
        { text: `das ${["", "", "Doppelte", "Dreifache", "Vierfache", "Fünffache", "Sechsfache", "Siebenfache", "Achtfache", "Neunfache"][k]} einer Zahl ${v}, ${plus ? "vermehrt" : "vermindert"} um ${d}`, term: `${k}${v} ${plus ? "+" : "−"} ${d}` },
        { text: `${d} ${plus ? "mehr als" : "weniger als"} das ${["", "", "Doppelte", "Dreifache", "Vierfache", "Fünffache", "Sechsfache", "Siebenfache", "Achtfache", "Neunfache"][k]} einer Zahl ${v}`, term: `${k}${v} ${plus ? "+" : "−"} ${d}` },
      ]);
      return termAufgabe("mathe.terme.aufstellen", diff, {
        prompt: `Schreib als Term: ${worte.text}.`,
        ergebnis: worte.term,
        vars: [v],
        solution: `„Das ${k}-Fache von ${v}“ ist ${k}${v}, „${plus ? "vermehrt um" : "vermindert um"} ${d}“ heißt ${plus ? "+" : "−"} ${d}.\nTerm: ${worte.term}`,
        hints: ["Die unbekannte Zahl ist die Variable.", `Das ${k}-Fache heißt mal ${k}.`, `Vermehrt heißt plus, vermindert heißt minus.`],
        errors: [fehler(`${k}(${v} ${plus ? "+" : "−"} ${d})`, "Klammer gesetzt: erst addiert, dann vervielfacht"), fehler(`${d === 1 ? "" : d}${v} ${plus ? "+" : "−"} ${k}`, "Zahlen vertauscht")],
      });
    }
    const [p, q] = pick(rng, VAR_PAARE);
    const [a, b, c] = [rint(rng, 2, 9), rint(rng, 1, 9), rint(rng, 1, 15)];
    const xw = lv === 0 ? rint(rng, 1, 9) : rint(rng, -5, 8);
    const yw = rint(rng, -4, 6);
    if (xw === 0 || yw === 0) continue;
    const k = (n: number) => (n < 0 ? `(${zahl(n)})` : zahl(n));
    if (lv <= 1) {
      const res = a * xw + c;
      return aufgabe("mathe.terme.aufstellen", diff, {
        prompt: `Berechne den Wert des Terms ${a}${p} + ${c} für ${p} = ${zahl(xw)}.`,
        accepted: [antwort(res)],
        solution: `${p} = ${zahl(xw)} einsetzen: ${a} · ${k(xw)} + ${c} = ${a * xw} + ${c} = ${zahl(res)}`,
        hints: [`Setz für ${p} die Zahl ${zahl(xw)} ein.`, `${a}${p} heißt ${a} · ${p}.`, "Punkt vor Strich: zuerst multiplizieren."],
        errors: [fehler(Number(`${a}${Math.abs(xw)}`) * Math.sign(xw) + c, `${a}${p} als zweistellige Zahl gelesen`), fehler(a + xw + c, "Addiert statt multipliziert")],
      });
    }
    const res = a * xw * xw - b * yw;
    return aufgabe("mathe.terme.aufstellen", diff, {
      prompt: `Berechne den Wert des Terms ${a}${p}^2 − ${b}${q} für ${p} = ${zahl(xw)} und ${q} = ${zahl(yw)}.`,
      accepted: [antwort(res)],
      solution: `Einsetzen: ${a} · ${k(xw)}^2 − ${b} · ${k(yw)} = ${a} · ${xw * xw} − ${k(b * yw)} = ${a * xw * xw} − ${k(b * yw)} = ${zahl(res)}`,
      hints: ["Setz die Zahlen in Klammern ein, vor allem die negativen.", `${a}${p}^2 heißt ${a} · ${p} · ${p}: nur ${p} wird quadriert.`, "Hochzahl vor Punkt vor Strich."],
      errors: [fehler((a * xw) ** 2 - b * yw, `(${a}${p})^2 statt ${a} · ${p}^2 gerechnet`), fehler(a * xw * xw + b * yw, "Vorzeichen beim Einsetzen falsch"), ...(xw < 0 ? [fehler(-a * xw * xw - b * yw, "Minus beim Quadrieren falsch")] : [])],
    });
  }
}

function zusammenfassen(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const [p, q] = pick(rng, VAR_PAARE);
    const k = () => rint(rng, 1, 9) * (rng() < (lv === 0 ? 0.25 : 0.4) ? -1 : 1);
    let gl: [number, string][];
    let vars: string[] = [p, q];
    if (lv === 0) {
      gl = [[rint(rng, 2, 9), p], [k(), p], [k(), p]];
      vars = [p];
    } else if (lv === 1) gl = [[rint(rng, 2, 9), p], [k(), q], [k(), p], [k(), q]];
    else if (lv === 2) gl = [[rint(rng, 2, 9), p], [k(), q], [k(), ""], [k(), p], [k(), q], [k(), ""]];
    else gl = [[rint(rng, 2, 9), `${p}^2`], [k(), p], [k(), ""], [k(), `${p}^2`], [k(), p], [k(), ""], ...(lv === 4 ? ([[k(), `${p}${q}`], [k(), `${p}${q}`]] as [number, string][]) : [])];
    if (lv >= 3) vars = [p, q];
    const angabe = glieder(gl);
    const res = poly(angabe, vars);
    if (res.size < (lv === 0 ? 1 : 2) || [...res.values()].some((c) => c === 0)) continue;
    const ergebnis = termText(res);
    if (ergebnis === angabe) continue;
    // typische Fehler: alle Zahlen zusammengezählt, die Minus-Glieder addiert
    const ohneVorzeichen = termText(poly(glieder(gl.map(([c, m]) => [Math.abs(c), m])), vars));
    const alle = gl.reduce((s, [c]) => s + c, 0);
    const errors: Fehler[] = [fehler(ohneVorzeichen, "Minuszeichen übersehen")];
    // alle Zahlen zusammengezählt, als wären es lauter gleichartige Glieder (nur wenn es verschiedene gibt)
    if (alle !== 0 && new Set(gl.map(([, m]) => m)).size > 1) errors.push(fehler(termText(new Map([[p, alle]])), "Ungleichartige Glieder zusammengezählt"));
    const gruppen = [...new Set(gl.map(([, m]) => m))].map((m) => `${glieder(gl.filter(([, x]) => x === m))}`);
    return termAufgabe("mathe.terme.zusammenfassen", diff, {
      prompt: `Fasse zusammen: ${angabe}`,
      ergebnis,
      vars,
      solution: `Gleichartige Glieder ordnen und zusammenfassen:\n${gruppen.map((g) => `(${g})`).join(" + ")}\n= ${ergebnis}`,
      hints: ["Nur gleichartige Glieder lassen sich zusammenfassen: x mit x, y mit y, Zahlen mit Zahlen.", "Das Vorzeichen gehört zum Glied dahinter.", `Beginne mit den Gliedern mit ${lv >= 3 ? `${p}^2` : p}.`],
      errors,
    });
  }
}

function klammernAufloesen(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const [p, q] = pick(rng, VAR_PAARE);
    const n = (min = 1, max = 9) => rint(rng, min, max) * (rng() < 0.4 ? -1 : 1);
    let angabe: string;
    let weg: string;
    let fehlerTerm: string | null = null;
    let fehlerLabel = "";
    if (lv === 0) {
      const [a, b, c] = [rint(rng, 2, 9), rint(rng, 1, 9), rint(rng, 1, 9)];
      angabe = `${a}(${b}${p} ${rng() < 0.5 ? "+" : "−"} ${c})`;
      const minus = angabe.includes("−");
      weg = `${a} · ${b}${p} ${minus ? "−" : "+"} ${a} · ${c}`;
      fehlerTerm = `${a * b}${p} ${minus ? "−" : "+"} ${c}`;
      fehlerLabel = "Nur das erste Glied multipliziert";
    } else if (lv === 1) {
      const [a, b, c] = [-rint(rng, 2, 9), rint(rng, 1, 9), n()];
      angabe = `${zahl(a)}(${b}${p}${vorzeichenGlied(c, "")})`;
      weg = `(${zahl(a)}) · ${b}${p} + (${zahl(a)}) · (${zahl(c)})`;
      fehlerTerm = termText(poly(`${a * b}${p} + ${-a * c}`.replace(/−/g, "-"), [p]));
      fehlerLabel = "Vorzeichen beim zweiten Glied nicht umgedreht";
    } else if (lv === 2) {
      const [a, b, c, d] = [rint(rng, 2, 9), rint(rng, 2, 6), rint(rng, 1, 9), n()];
      angabe = `${a}${p} − ${b}(${p}${vorzeichenGlied(d, "")}) + ${c}`;
      weg = `${a}${p} − ${b}${p}${vorzeichenGlied(-b * d, "")} + ${c}`;
      fehlerTerm = termText(poly(`${a}${p} - ${b}${p} + ${b * d} + ${c}`, [p]));
      fehlerLabel = "Minus vor der Klammer nicht auf alle Glieder angewendet";
      if (b * d === 0) continue;
    } else {
      const [a, b, c, d] = [rint(rng, 1, lv === 4 ? 3 : 1), n(1, 7), rint(rng, 1, lv === 4 ? 3 : 1), n(1, 7)];
      const zweite = lv === 4 && rng() < 0.6 ? q : p;
      angabe = `(${a === 1 ? "" : a}${p}${vorzeichenGlied(b, "")})(${c === 1 ? "" : c}${zweite}${vorzeichenGlied(d, "")})`;
      weg = `Jedes Glied mal jedes Glied: ${a === 1 ? "" : a}${p} · ${c === 1 ? "" : c}${zweite}${vorzeichenGlied(a * d, p)}${vorzeichenGlied(b * c, zweite)}${vorzeichenGlied(b * d, "")}`;
      fehlerTerm = termText(poly(`${a * c}${p}${zweite === p ? "^2" : zweite} + ${b * d}`, [p, q]));
      fehlerLabel = "Nur die ersten und die letzten Glieder multipliziert";
    }
    const vars = [p, q];
    const res = poly(angabe, vars);
    const ergebnis = termText(res);
    if (res.size < 2) continue;
    return termAufgabe("mathe.terme.klammern", diff, {
      prompt: `Löse die Klammern auf und fasse zusammen: ${angabe}`,
      ergebnis,
      vars,
      solution: `${weg}\n= ${ergebnis}`,
      hints: ["Die Zahl vor der Klammer wird mit jedem Glied in der Klammer multipliziert.", "Minus mal Minus ergibt Plus, Minus mal Plus ergibt Minus.", "Fasse zum Schluss gleichartige Glieder zusammen."],
      errors: fehlerTerm ? [fehler(fehlerTerm, fehlerLabel)] : [],
    });
  }
}

function binomisch(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const [p, q] = pick(rng, VAR_PAARE);
    const art = pick(rng, ["plus", "minus", "dritte"] as const);
    const [a, b] = [lv <= 1 ? 1 : rint(rng, 1, 4), rint(rng, 1, lv === 0 ? 9 : 7)];
    const zweite = lv >= 3 && rng() < 0.5 ? `${b === 1 ? "" : b}${q}` : String(b);
    const erste = `${a === 1 ? "" : a}${p}`;
    const vars = [p, q];
    if (lv === 4 && rng() < 0.5) {
      // rückwärts: als Quadrat oder Produkt schreiben (ohne gemeinsamen Faktor in der Klammer, sonst wäre 4(x + 2)^2 richtiger)
      if (gcd(a, b) > 1) continue;
      const ausmult = termText(poly(art === "dritte" ? `(${erste}+${zweite})(${erste}-${zweite})` : `(${erste}${art === "plus" ? "+" : "-"}${zweite})^2`, vars));
      const faktoren = art === "dritte" ? `(${erste} + ${zweite})(${erste} − ${zweite})` : `(${erste} ${art === "plus" ? "+" : "−"} ${zweite})^2`;
      return termAufgabe("mathe.terme.binomisch", diff, {
        prompt: `Schreib mit einer binomischen Formel als ${art === "dritte" ? "Produkt" : "Quadrat"}: ${ausmult}`,
        ergebnis: faktoren,
        vars,
        form: "faktorisiert",
        solution: art === "dritte" ? `a^2 − b^2 = (a + b)(a − b) mit a = ${erste}, b = ${zweite}:\n${ausmult} = ${faktoren}` : `a^2 ${art === "plus" ? "+" : "−"} 2ab + b^2 = (a ${art === "plus" ? "+" : "−"} b)^2 mit a = ${erste}, b = ${zweite}:\n${ausmult} = ${faktoren}`,
        hints: ["Welche Quadrate stehen vorne und hinten?", art === "dritte" ? "Eine Differenz von zwei Quadraten ist die dritte binomische Formel." : "Ist das mittlere Glied das Doppelte des Produkts?", `a = ${erste}, b = ${zweite}`],
        errors: [fehler(art === "dritte" ? `(${erste} − ${zweite})^2` : `(${erste} ${art === "plus" ? "−" : "+"} ${zweite})^2`, art === "dritte" ? "Quadrat statt Produkt geschrieben" : "Vorzeichen in der Klammer falsch")],
      });
    }
    const angabe = art === "dritte" ? `(${erste} + ${zweite})(${erste} − ${zweite})` : `(${erste} ${art === "plus" ? "+" : "−"} ${zweite})^2`;
    const res = poly(angabe, vars);
    const ergebnis = termText(res);
    const A = poly(erste, vars);
    const B = poly(zweite, vars);
    const quadrat = (x: string) => termText(poly(`(${x})^2`, vars));
    const ohneMitte = termText(poly(`(${erste})^2 + (${zweite})^2`, vars));
    const mitteEinfach = termText(poly(`(${erste})^2 ${art === "minus" ? "-" : "+"} (${erste})(${zweite}) + (${zweite})^2`, vars));
    void A;
    void B;
    const errors: Fehler[] = art === "dritte" ? [fehler(termText(poly(`(${erste})^2 + (${zweite})^2`, vars)), "Plus statt Minus zwischen den Quadraten"), fehler(termText(poly(`(${erste})^2 - (${zweite})^2`, vars)).replace(/\^2(?=\s*$)/, ""), "Das zweite Glied nicht quadriert")] : [fehler(ohneMitte, "Das mittlere Glied 2ab vergessen"), fehler(mitteEinfach, "Das mittlere Glied nicht verdoppelt")];
    if (art === "minus") errors.push(fehler(termText(poly(`(${erste})^2 - 2(${erste})(${zweite}) - (${zweite})^2`, vars)), "b^2 mit Minus geschrieben"));
    return termAufgabe("mathe.terme.binomisch", diff, {
      prompt: `Multipliziere mit einer binomischen Formel aus: ${angabe}`,
      ergebnis,
      vars,
      solution: `${art === "plus" ? "(a + b)^2 = a^2 + 2ab + b^2" : art === "minus" ? "(a − b)^2 = a^2 − 2ab + b^2" : "(a + b)(a − b) = a^2 − b^2"} mit a = ${erste} und b = ${zweite}:\n${art === "dritte" ? `${quadrat(erste)} − ${quadrat(zweite)}` : `${quadrat(erste)} ${art === "plus" ? "+" : "−"} 2 · ${erste} · ${zweite} + ${quadrat(zweite)}`}\n= ${ergebnis}`,
      hints: [art === "dritte" ? "(a + b)(a − b) = a^2 − b^2: das mittlere Glied fällt weg." : `(a ${art === "plus" ? "+" : "−"} b)^2 = a^2 ${art === "plus" ? "+" : "−"} 2ab + b^2: vergiss das mittlere Glied nicht.`, `Hier ist a = ${erste} und b = ${zweite}.`, `a^2 = ${quadrat(erste)}`],
      errors,
    });
  }
}

function herausheben(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const [p, q] = pick(rng, VAR_PAARE);
    const g = rint(rng, 2, lv === 0 ? 6 : 9);
    const [m, n] = [rint(rng, 1, 9), rint(rng, 1, 9) * (rng() < 0.4 ? -1 : 1)];
    if (gcd(m, Math.abs(n)) !== 1) continue;
    // der gemeinsame Faktor: nur eine Zahl, eine Zahl mit Variable, oder (schwer) mit zwei Gliedern in der Klammer und Variable
    const mitVar = lv >= 2;
    const aussen = `${g}${mitVar ? p : ""}`;
    const innen = lv <= 1 ? [[m, p], [n, ""]] : lv === 2 ? [[m, p], [n, ""]] : [[m, `${p}`], [n, q], ...(lv === 4 ? [[rint(rng, 1, 5) * (rng() < 0.5 ? -1 : 1), ""]] : [])];
    const innenText = glieder(innen as [number, string][]);
    if (lv === 4 && gcd(gcd(m, Math.abs(n)), Math.abs((innen[2] as [number, string])[0])) !== 1) continue;
    const ergebnis = `${aussen}(${innenText})`;
    const vars = [p, q];
    const ausmult = termText(poly(ergebnis, vars));
    const teilweise = g % 2 === 0 && g > 2 ? `${g / 2}${mitVar ? p : ""}(${glieder((innen as [number, string][]).map(([c, x]) => [c * 2, x]))})` : null;
    const errors: Fehler[] = [];
    if (teilweise) errors.push(fehler(teilweise, "Nicht den größten gemeinsamen Faktor herausgehoben"));
    if (mitVar) errors.push(fehler(`${g}(${glieder((innen as [number, string][]).map(([c, x]) => [c, `${p}${x}`.replace(`${p}${p}`, `${p}^2`)]))})`, `Die Variable ${p} nicht mit herausgehoben`));
    return termAufgabe("mathe.terme.herausheben", diff, {
      prompt: `Hebe den größten gemeinsamen Faktor heraus: ${ausmult}`,
      ergebnis,
      vars,
      form: "faktorisiert",
      solution: `Gemeinsamer Faktor aller Glieder: ${aussen}.\nJedes Glied durch ${aussen} dividieren: ${(innen as [number, string][]).map(([c, x]) => vorzeichenGlied(c, x, true)).join(", ")}\n${ausmult} = ${ergebnis}\nProbe: ausmultiplizieren ergibt wieder ${ausmult}.`,
      hints: ["Welche Zahl teilt alle Koeffizienten? Nimm die größte (ggT).", mitVar ? `Kommt eine Variable in allen Gliedern vor? Die hebst du auch heraus.` : "In der Klammer bleibt, was übrig ist, wenn du jedes Glied durch den Faktor dividierst.", "Probe: Multiplizier dein Ergebnis wieder aus."],
      errors,
    });
  }
}

// ---------- Gleichungssysteme ----------
function gleichungssystem(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const x = rint(rng, -4, 9);
    const y = rint(rng, -4, 9);
    const k = (min: number, max: number) => rint(rng, min, max) * (rng() < 0.3 ? -1 : 1);
    let a1: number, b1: number, a2: number, b2: number;
    if (lv === 0) [a1, b1, a2, b2] = [rint(rng, -4, 5), -1, 1, 1]; // y = a1 x + c  und  x + y = c2
    else if (lv === 1) [a1, b1, a2, b2] = [1, 1, 1, -1];
    else [a1, b1, a2, b2] = [k(1, 5), k(1, 5), k(1, 5), k(1, 5)];
    const det = a1 * b2 - a2 * b1;
    if (det === 0 || a1 === 0) continue;
    const c1 = a1 * x + b1 * y;
    const c2 = a2 * x + b2 * y;
    const gl = (a: number, b: number, c: number) => `${glieder([[a, "x"], [b, "y"]].filter(([n]) => n !== 0) as [number, string][])} = ${zahl(c)}`;
    const I = lv === 0 ? `y = ${glieder([[a1, "x"], [-c1, ""]].filter(([n]) => n !== 0) as [number, string][])}` : gl(a1, b1, c1);
    // y = a1 x − c1 umgeformt aus a1 x − y = c1
    const II = gl(a2, b2, c2);
    const weg =
      lv === 0
        ? `Einsetzungsverfahren: I in II einsetzen:\nx + (${glieder([[a1, "x"], [-c1, ""]].filter(([n]) => n !== 0) as [number, string][])}) = ${zahl(c2)}\n${zahl(1 + a1)}x = ${zahl(c2 + c1)} → x = ${zahl(x)}\nIn I einsetzen: y = ${a1} · ${x < 0 ? `(${zahl(x)})` : zahl(x)}${vorzeichenGlied(-c1, "")} = ${zahl(y)}`
        : `Additionsverfahren: I · ${zahl(b2)} und II · ${zahl(b1)}, dann subtrahieren (y fällt weg):\n${zahl(a1 * b2 - a2 * b1)}x = ${zahl(c1 * b2 - c2 * b1)} → x = ${zahl(x)}\nIn I einsetzen: ${zahl(a1)} · ${x < 0 ? `(${zahl(x)})` : zahl(x)}${vorzeichenGlied(b1, "y")} = ${zahl(c1)} → y = ${zahl(y)}\nProbe in II: ${zahl(a2 * x + b2 * y)} = ${zahl(c2)} ✓`;
    if (lv === 0 && 1 + a1 === 0) continue;
    return lueckenAufgabe("mathe.gleichungssysteme.rechnerisch", diff, {
      // die Gleichungen in der ersten Zeile: an ihr erkennt das Blatt doppelte Aufgaben
      prompt: `Löse das Gleichungssystem: I: ${I}, II: ${II}`,
      luecken: `x = ${GAP}   y = ${GAP}`,
      werte: [x, y],
      solution: weg,
      hints: [lv === 0 ? "Gleichung I sagt, was y ist: setz das in II ein." : "Mach eine Variable weg: Gleichungen so multiplizieren, dass vor y dieselbe Zahl steht, dann addieren oder subtrahieren.", "Wenn du x hast, setz es in eine Gleichung ein und rechne y aus.", "Probe: beide Werte in beide Gleichungen einsetzen."],
      errors: x !== y ? [fehler(`${antwort(y)} | ${antwort(x)}`, "x und y vertauscht")] : [],
    });
  }
}

// ---------- Körper ----------
const pi = Math.PI;
function quader(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const wuerfel = lv === 0 && rng() < 0.4;
  // ab „schwer“ Kanten mit einer Kommastelle (2,5 cm)
  const kante = (min: number, max: number) => (lv >= 3 ? dez(rng, min, max, 1) : rint(rng, min, max));
  const [a, b, c] = wuerfel ? Array(3).fill(rint(rng, 2, 12)) : [kante(2, 15), kante(2, 12), rint(rng, 2, 10)];
  const V = r4(a * b * c);
  const [ab, ac, bc] = [r4(a * b), r4(a * c), r4(b * c)];
  const O = r4(2 * (ab + ac + bc));
  const was = lv === 0 ? "V" : pick(rng, ["V", "O"] as const);
  const e = pick(rng, ["cm", "m", "dm"]);
  const [A, B, C] = [a, b, c].map(zahl);
  const name = wuerfel ? `Ein Würfel hat die Kantenlänge a = ${A} ${e}.` : `Ein Quader hat die Kanten a = ${A} ${e}, b = ${B} ${e} und c = ${C} ${e}.`;
  return aufgabe("mathe.koerper.quader", diff, {
    prompt: `${name} Berechne ${was === "V" ? "das Volumen" : "die Oberfläche"}.`,
    accepted: mitEinheit(was === "V" ? V : O, was === "V" ? `${e}³` : `${e}²`),
    solution: was === "V" ? `V = a · b · c = ${A} · ${B} · ${C} = ${zahl(V)} ${e}³` : `O = 2 · (a · b + a · c + b · c) = 2 · (${zahl(ab)} + ${zahl(ac)} + ${zahl(bc)}) = ${zahl(O)} ${e}²`,
    hints: was === "V" ? ["Volumen: Länge · Breite · Höhe.", `V = ${A} · ${B} · ${C}`, `Die Einheit ist ${e}³.`] : ["Die Oberfläche besteht aus 6 Rechtecken, je zwei gleich große.", "O = 2 · (ab + ac + bc)", `ab = ${zahl(ab)}, ac = ${zahl(ac)}, bc = ${zahl(bc)}`],
    errors: was === "V" ? [fehler(O, "Oberfläche statt Volumen berechnet"), fehler(r4(a + b + c), "Addiert statt multipliziert")] : [fehler(r4(ab + ac + bc), "Nur drei der sechs Flächen gerechnet"), fehler(V, "Volumen statt Oberfläche berechnet")],
  });
}
function prisma(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const [a, b] = [rint(rng, 2, 12), rint(rng, 2, 12)];
  const h = rint(rng, 3, 20);
  const G = (a * b) / 2;
  const V = G * h;
  const dreiseitig = lv <= 2 || rng() < 0.5;
  if (!dreiseitig) {
    // Prisma mit Trapez als Grundfläche
    const [aa, cc, ht] = [rint(rng, 6, 14), rint(rng, 2, 5), rint(rng, 2, 8)];
    const Gt = ((aa + cc) * ht) / 2;
    return aufgabe("mathe.koerper.prisma", diff, {
      prompt: `Ein Prisma hat als Grundfläche ein Trapez mit a = ${aa} cm, c = ${cc} cm und der Trapezhöhe ${ht} cm. Das Prisma ist ${h} cm hoch. Berechne das Volumen.`,
      accepted: mitEinheit(r4(Gt * h), "cm³"),
      solution: `G = (a + c) · h_T : 2 = (${aa} + ${cc}) · ${ht} : 2 = ${zahl(Gt)} cm²\nV = G · h = ${zahl(Gt)} · ${h} = ${zahl(r4(Gt * h))} cm³`,
      hints: ["Volumen eines Prismas: Grundfläche mal Höhe.", "Grundfläche Trapez: (a + c) · h : 2.", `G = ${zahl(Gt)} cm²`],
      errors: [fehler(r4((aa + cc) * ht * h), "Beim Trapez nicht durch 2 dividiert"), fehler(r4(aa * cc * ht * h), "Alle Längen multipliziert")],
    });
  }
  return aufgabe("mathe.koerper.prisma", diff, {
    prompt: `Ein dreiseitiges Prisma hat als Grundfläche ein rechtwinkeliges Dreieck mit den Katheten ${a} cm und ${b} cm. Die Höhe des Prismas ist ${h} cm. Berechne das Volumen.`,
    accepted: mitEinheit(r4(V), "cm³"),
    solution: `G = a · b : 2 = ${a} · ${b} : 2 = ${zahl(G)} cm²\nV = G · h = ${zahl(G)} · ${h} = ${zahl(r4(V))} cm³`,
    hints: ["Volumen eines Prismas: Grundfläche mal Höhe.", "Die Grundfläche ist ein rechtwinkeliges Dreieck: Kathete mal Kathete durch 2.", `G = ${zahl(G)} cm²`],
    errors: [fehler(a * b * h, "Beim Dreieck nicht durch 2 dividiert"), fehler(r4(G + h), "Addiert statt multipliziert")],
  });
}
function rundkoerper(art: "zylinder" | "kegel"): Gen {
  return (rng, diff) => {
    const lv = STUFE[diff];
    const r = rint(rng, 2, 12);
    const h = rint(rng, 3, 25);
    const mitDurchmesser = lv >= 2 && rng() < 0.5;
    const was = art === "zylinder" && lv >= 2 && rng() < 0.4 ? "O" : "V";
    const f = art === "kegel" ? 1 / 3 : 1;
    const wert = (p: number) => (was === "V" ? f * p * r * r * h : 2 * p * r * r + 2 * p * r * h);
    const res = r2(wert(pi));
    const mit314 = r2(wert(3.14));
    const angabe = mitDurchmesser ? `d = ${2 * r} cm` : `r = ${r} cm`;
    const name = art === "zylinder" ? "Ein Zylinder" : "Ein Drehkegel";
    const formel = was === "O" ? "O = 2 · r^2 · π + 2 · r · π · h" : art === "kegel" ? "V = r^2 · π · h : 3" : "V = r^2 · π · h";
    const fehlerD = r2(was === "V" ? f * pi * 4 * r * r * h : 2 * pi * 4 * r * r + 2 * pi * 2 * r * h);
    return aufgabe(`mathe.koerper.${art}`, diff, {
      prompt: `${name} hat ${angabe} und h = ${h} cm. Berechne ${was === "V" ? "das Volumen" : "die Oberfläche"}. Runde auf zwei Dezimalstellen.`,
      accepted: [...mitEinheit(res, was === "V" ? "cm³" : "cm²"), ...(mit314 !== res ? mitEinheit(mit314, was === "V" ? "cm³" : "cm²") : [])],
      solution: `${mitDurchmesser ? `r = d : 2 = ${r} cm\n` : ""}${formel}\n${was === "V" ? `V = ${r}^2 · π · ${h}${art === "kegel" ? " : 3" : ""}` : `O = 2 · ${r}^2 · π + 2 · ${r} · π · ${h}`} ≈ ${zahl(res)} ${was === "V" ? "cm³" : "cm²"}${mit314 !== res ? ` (mit π ≈ 3,14: ${zahl(mit314)})` : ""}`,
      hints: [formel, mitDurchmesser ? "Achtung: gegeben ist der Durchmesser. Der Radius ist die Hälfte." : "Nur der Radius wird quadriert.", art === "kegel" ? "Ein Kegel hat ein Drittel des Volumens eines Zylinders mit gleicher Grundfläche und Höhe." : "Rechne mit der π-Taste und runde erst am Schluss."],
      errors: [...(mitDurchmesser ? [fehler(fehlerD, "Mit dem Durchmesser statt dem Radius gerechnet")] : []), ...(art === "kegel" ? [fehler(r2(pi * r * r * h), "Nicht durch 3 dividiert")] : was === "V" ? [fehler(r2(2 * pi * r * h), "Umfang statt Grundfläche genommen")] : [fehler(r2(2 * pi * r * h), "Die zwei Kreisflächen vergessen")])],
    });
  };
}
function pyramide(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const a = rint(rng, 2, 12);
  const h = 3 * rint(rng, 1, 8);
  const rechteck = lv >= 2 && rng() < 0.5;
  const b = rechteck ? rint(rng, 2, 12) : a;
  const V = (a * b * h) / 3;
  return aufgabe("mathe.koerper.pyramide", diff, {
    prompt: `Eine Pyramide hat ${rechteck ? `eine rechteckige Grundfläche mit a = ${a} cm und b = ${b} cm` : `eine quadratische Grundfläche mit a = ${a} cm`} und die Höhe h = ${h} cm. Berechne das Volumen.`,
    accepted: mitEinheit(r4(V), "cm³"),
    solution: `V = G · h : 3\nG = ${rechteck ? `${a} · ${b}` : `${a}^2`} = ${a * b} cm²\nV = ${a * b} · ${h} : 3 = ${zahl(r4(V))} cm³`,
    hints: ["Eine Pyramide hat ein Drittel des Volumens eines Prismas mit gleicher Grundfläche und Höhe.", "V = G · h : 3", `G = ${a * b} cm²`],
    errors: [fehler(a * b * h, "Nicht durch 3 dividiert"), fehler(r4((a * b * h) / 2), "Durch 2 statt durch 3 dividiert")],
  });
}

// ---------- Schlussrechnung ----------
const DIREKT = [
  { menge: "kg Äpfel", preis: (rng: Rng) => dez(rng, 1.2, 3.9, 1), einheit: "€", frage: "kosten" },
  { menge: "Hefte", preis: (rng: Rng) => dez(rng, 0.8, 2.5, 1), einheit: "€", frage: "kosten" },
  { menge: "Liter Benzin", preis: (rng: Rng) => dez(rng, 1.4, 1.9, 2), einheit: "€", frage: "kosten" },
  { menge: "Stunden Arbeit", preis: (rng: Rng) => rint(rng, 12, 30), einheit: "€", frage: "bringen" },
] as const;
function direktProportional(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const k = pick(rng, DIREKT);
    const p1 = k.preis(rng);
    const [m1, m2] = [rint(rng, 2, lv >= 2 ? 12 : 6), rint(rng, 2, lv >= 2 ? 15 : 10)];
    if (m1 === m2) continue;
    const g1 = r2(p1 * m1);
    const g2 = r2(p1 * m2);
    const indirekt = r2((g1 * m1) / m2);
    return aufgabe("mathe.proportional.direkt", diff, {
      prompt: `${m1} ${k.menge} ${k.frage} ${geld(g1)} €. Wie viel ${k.frage} ${m2} ${k.menge}?`,
      accepted: [...mitEinheit(geld(g2).replace("−", "-"), "€"), ...(Number.isInteger(g2) ? mitEinheit(`${g2},00`, "€") : [])],
      solution: `Schlussrechnung über 1:\n${m1} ${k.menge} → ${geld(g1)} €\n1 → ${geld(g1)} : ${m1} = ${geld(p1)} €\n${m2} → ${geld(p1)} · ${m2} = ${geld(g2)} €`,
      hints: ["Je mehr, desto mehr: das ist direkt proportional.", `Rechne zuerst, wie viel 1 kostet: ${geld(g1)} : ${m1}.`, `Dann mal ${m2}.`],
      errors: [fehler(geld(indirekt), "Indirekt statt direkt gerechnet"), fehler(geld(r2(g1 + (m2 - m1))), "Den Unterschied addiert statt hochgerechnet")],
    });
  }
}
const INDIREKT = [
  { wer: "Arbeiter", was: "Tage", text: (n: number, t: number) => `${n} Arbeiter brauchen für eine Arbeit ${t} Tage.`, frage: (n: number) => `Wie viele Tage brauchen ${n} Arbeiter?` },
  { wer: "Pumpen", was: "Stunden", text: (n: number, t: number) => `${n} gleich starke Pumpen leeren ein Becken in ${t} Stunden.`, frage: (n: number) => `Wie lange brauchen ${n} Pumpen?` },
  { wer: "Kinder", was: "Tage", text: (n: number, t: number) => `Ein Vorrat reicht für ${n} Kinder ${t} Tage.`, frage: (n: number) => `Wie viele Tage reicht er für ${n} Kinder?` },
] as const;
function indirektProportional(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const k = pick(rng, INDIREKT);
    const [n1, n2] = [rint(rng, 2, lv >= 2 ? 12 : 8), rint(rng, 2, lv >= 2 ? 12 : 8)];
    const t1 = rint(rng, 2, 30);
    const gesamt = n1 * t1;
    const t2 = gesamt / n2;
    if (n1 === n2 || !Number.isInteger(t2 * (lv >= 3 ? 2 : 1))) continue;
    const direkt = (t1 * n2) / n1;
    return aufgabe("mathe.proportional.indirekt", diff, {
      prompt: `${k.text(n1, t1)} ${k.frage(n2)}`,
      accepted: mitEinheit(t2, k.was),
      solution: `Je mehr ${k.wer}, desto weniger ${k.was}: indirekt proportional.\n${n1} ${k.wer} → ${t1} ${k.was}\n1 → ${t1} · ${n1} = ${gesamt} ${k.was}\n${n2} → ${gesamt} : ${n2} = ${zahl(t2)} ${k.was}`,
      hints: [`Brauchen mehr ${k.wer} mehr oder weniger ${k.was}?`, `Bei indirekter Proportionalität bleibt das Produkt gleich: ${n1} · ${t1}.`, `1 ${k.wer === "Kinder" ? "Kind" : k.wer.slice(0, -1) || k.wer} bräuchte ${gesamt} ${k.was}.`],
      errors: Number.isFinite(direkt) && nachkomma(direkt) <= 2 ? [fehler(r2(direkt), "Direkt statt indirekt gerechnet")] : [],
    });
  }
}

// ---------- Prozent ----------
function zinsen(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const K = rint(rng, 4, 60) * (lv === 0 ? 100 : 50);
    const p = lv === 0 ? rint(rng, 1, 5) : dez(rng, 0.5, 4.5, pick(rng, [0, 1]));
    const Zj = r2((K * p) / 100);
    const kind = pick(rng, lv === 0 ? (["jahr"] as const) : lv <= 2 ? (["jahr", "monate"] as const) : (["monate", "kest", "zinseszins"] as const));
    if (kind === "jahr") {
      return aufgabe("mathe.prozent.zinsen", diff, {
        prompt: `Wie viele Zinsen bringen ${gross(K)} € bei ${zahl(p)} % in einem Jahr?`,
        accepted: mitEinheit(geld(Zj), "€"),
        solution: `Z = K · p / 100 = ${gross(K)} · ${zahl(p)} / 100 = ${geld(Zj)} €`,
        hints: ["Zinsen sind der Prozentwert vom Kapital.", "Z = K · p / 100", `1 % von ${gross(K)} € sind ${geld(K / 100)} €.`],
        errors: [fehler(geld(r2(K * p)), "Nicht durch 100 dividiert"), fehler(geld(r2(K + Zj)), "Kapital mit Zinsen statt nur Zinsen")],
      });
    }
    if (kind === "monate") {
      const m = pick(rng, [3, 4, 6, 8, 9]);
      const Z = r2((Zj * m) / 12);
      if (nachkomma((Zj * m) / 12) > 2) continue;
      return aufgabe("mathe.prozent.zinsen", diff, {
        prompt: `Wie viele Zinsen bringen ${gross(K)} € bei ${zahl(p)} % in ${m} Monaten?`,
        accepted: mitEinheit(geld(Z), "€"),
        solution: `Jahreszinsen: ${gross(K)} · ${zahl(p)} / 100 = ${geld(Zj)} €\nFür ${m} Monate: ${geld(Zj)} · ${m} / 12 = ${geld(Z)} €`,
        hints: ["Rechne zuerst die Zinsen für ein ganzes Jahr.", `${m} Monate sind ${m}/12 eines Jahres.`, `Z = K · p / 100 · ${m} / 12`],
        errors: [fehler(geld(Zj), "Zinsen für ein ganzes Jahr statt für die Monate"), fehler(geld(r2(Zj * m)), "Nicht durch 12 dividiert")],
      });
    }
    if (kind === "kest") {
      const netto = r2(Zj * 0.75);
      if (nachkomma(Zj * 0.75) > 2) continue;
      return aufgabe("mathe.prozent.zinsen", diff, {
        prompt: `${gross(K)} € liegen ein Jahr lang bei ${zahl(p)} % auf dem Sparbuch. Von den Zinsen gehen 25 % KESt (Kapitalertragsteuer) ab. Wie viele Zinsen bekommt man ausbezahlt?`,
        accepted: mitEinheit(geld(netto), "€"),
        solution: `Zinsen: ${gross(K)} · ${zahl(p)} / 100 = ${geld(Zj)} €\nNach 25 % KESt bleiben 75 %: ${geld(Zj)} · 0,75 = ${geld(netto)} €`,
        hints: ["Rechne zuerst die Zinsen für ein Jahr.", "Die KESt wird von den Zinsen abgezogen, nicht vom Kapital.", "Nach Abzug von 25 % bleiben 75 %."],
        errors: [fehler(geld(r2(Zj * 0.25)), "Nur die KESt statt der ausbezahlten Zinsen"), fehler(geld(Zj), "KESt nicht abgezogen")],
      });
    }
    const n = 2;
    const Kn = r2(K * (1 + p / 100) ** n);
    return aufgabe("mathe.prozent.zinsen", diff, {
      prompt: `${gross(K)} € werden ${n} Jahre lang mit ${zahl(p)} % verzinst, die Zinsen bleiben am Konto (Zinseszins). Wie hoch ist das Guthaben nach ${n} Jahren? Runde auf Cent.`,
      accepted: mitEinheit(geld(Kn), "€"),
      solution: `Jedes Jahr mal ${zahl(1 + p / 100)}:\nK₂ = ${gross(K)} · ${zahl(1 + p / 100)}^2 = ${geld(Kn)} €`,
      hints: ["Beim Zinseszins werden die Zinsen im zweiten Jahr mitverzinst.", `Ein Jahr mit ${zahl(p)} % heißt mal ${zahl(1 + p / 100)}.`, `K₂ = K · ${zahl(1 + p / 100)} · ${zahl(1 + p / 100)}`],
      errors: [fehler(geld(r2(K + 2 * Zj)), "Ohne Zinseszins gerechnet")],
    });
  }
}
function prozentAenderung(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const G = rint(rng, 2, 60) * (lv === 0 ? 10 : 5);
    const p = pick(rng, lv === 0 ? [10, 20, 25, 50] : [5, 10, 12, 15, 20, 25, 30, 40]);
    const hoch = rng() < 0.5;
    const kind = pick(rng, lv <= 1 ? (["neu"] as const) : lv === 2 ? (["neu", "faktor"] as const) : (["neu", "faktor", "zwei"] as const));
    const f = 1 + (hoch ? p : -p) / 100;
    if (kind === "faktor") {
      return aufgabe("mathe.prozent.aenderung", diff, {
        prompt: `Gib den Änderungsfaktor an: ${hoch ? "Erhöhung" : "Verminderung"} um ${p} %.`,
        accepted: [antwort(r4(f))],
        solution: `${hoch ? "Erhöhung" : "Verminderung"} um ${p} %: ${hoch ? `100 % + ${p} % = ${100 + p} %` : `100 % − ${p} % = ${100 - p} %`} = ${zahl(r4(f))}`,
        hints: ["Der alte Wert ist 100 % = 1.", hoch ? "Bei einer Erhöhung kommt der Prozentsatz dazu." : "Bei einer Verminderung geht der Prozentsatz weg.", `${hoch ? 100 + p : 100 - p} % als Dezimalzahl`],
        errors: [fehler(antwort(p / 100), "Nur den Prozentsatz angegeben"), fehler(antwort(r4(1 + (hoch ? -p : p) / 100)), "Erhöhung und Verminderung verwechselt")],
      });
    }
    if (kind === "zwei") {
      const p2 = p;
      const res = r2(G * (1 + p / 100) * (1 - p2 / 100));
      if (nachkomma(G * (1 + p / 100) * (1 - p2 / 100)) > 2) continue;
      return aufgabe("mathe.prozent.aenderung", diff, {
        prompt: `Ein Preis von ${G} € wird zuerst um ${p} % erhöht und danach um ${p2} % gesenkt. Wie hoch ist der Preis am Ende?`,
        accepted: mitEinheit(geld(res), "€"),
        solution: `${G} · ${zahl(1 + p / 100)} = ${geld(r2(G * (1 + p / 100)))} €\n${geld(r2(G * (1 + p / 100)))} · ${zahl(1 - p2 / 100)} = ${geld(res)} €\nDie zweite Änderung bezieht sich auf den neuen Preis, deshalb ist es nicht wieder ${G} €.`,
        hints: ["Rechne die Änderungen nacheinander.", "Die Senkung bezieht sich auf den erhöhten Preis.", `Änderungsfaktoren: ${zahl(1 + p / 100)} und ${zahl(1 - p2 / 100)}`],
        errors: [fehler(G, "Gedacht, plus und minus gleich viel ergibt wieder den alten Preis")],
      });
    }
    const neu = r2(G * f);
    const W = r2((G * p) / 100);
    return aufgabe("mathe.prozent.aenderung", diff, {
      prompt: `Ein Preis von ${G} € wird um ${p} % ${hoch ? "erhöht" : "gesenkt"}. Wie hoch ist der neue Preis?`,
      accepted: mitEinheit(geld(neu), "€"),
      solution: `${p} % von ${G} € = ${geld(W)} €\nNeuer Preis: ${G} ${hoch ? "+" : "−"} ${geld(W)} = ${geld(neu)} €\nOder mit dem Änderungsfaktor: ${G} · ${zahl(r4(f))} = ${geld(neu)} €`,
      hints: [`Rechne zuerst ${p} % von ${G} €.`, hoch ? "Bei einer Erhöhung zählst du das dazu." : "Bei einer Senkung ziehst du das ab.", `Änderungsfaktor: ${zahl(r4(f))}`],
      errors: [fehler(geld(W), "Nur die Änderung, nicht den neuen Preis"), fehler(geld(r2(G * (1 + (hoch ? -p : p) / 100))), "Erhöht und gesenkt verwechselt")],
    });
  }
}
function promille(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const G = rint(rng, 2, 80) * (lv === 0 ? 1000 : 250);
  const p = rint(rng, 1, lv === 0 ? 5 : 9);
  const W = r4((G * p) / 1000);
  return aufgabe("mathe.prozent.promille", diff, {
    prompt: `Wie viel sind ${p} ‰ von ${gross(G)} €?`,
    accepted: mitEinheit(geld(W), "€"),
    solution: `‰ heißt Tausendstel.\n${p} ‰ von ${gross(G)} € = ${gross(G)} · ${p} / 1 000 = ${geld(W)} €`,
    hints: ["Promille (‰) heißt „von Tausend“.", `1 ‰ von ${gross(G)} € ist ${gross(G)} : 1 000.`, `Dann mal ${p}.`],
    errors: [fehler(geld(r4((G * p) / 100)), "Wie Prozent gerechnet (durch 100 statt durch 1 000)")],
  });
}

// ---------- Potenzen und Wurzeln ----------
function potenzSchreibweise(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["wert", "hochzahl"] as const) : lv <= 2 ? (["wert", "hochzahl", "zehner", "minus"] as const) : (["zehner", "minus", "zehner-klein"] as const));
    if (kind === "wert") {
      const [b, e] = [rint(rng, 2, 6), rint(rng, 2, lv === 0 ? 3 : 5)];
      const res = b ** e;
      if (res > 2000) continue;
      return aufgabe("mathe.potenzen.schreibweise", diff, {
        prompt: `Berechne: ${b}^${e}`,
        accepted: [antwort(res)],
        solution: `${b}^${e} = ${Array(e).fill(b).join(" · ")} = ${res}`,
        hints: ["Die Hochzahl sagt, wie oft die Basis mit sich selbst multipliziert wird.", `${b}^${e} = ${Array(e).fill(b).join(" · ")}`, "Nicht Basis mal Hochzahl!"],
        errors: [fehler(b * e, "Basis mal Hochzahl gerechnet"), fehler(e ** b, "Basis und Hochzahl vertauscht")],
      });
    }
    if (kind === "hochzahl") {
      const e = rint(rng, 2, 6);
      return aufgabe("mathe.potenzen.schreibweise", diff, {
        prompt: `Schreib als Zehnerpotenz: ${gross(10 ** e)} = 10^?  Gib die Hochzahl an.`,
        accepted: [antwort(e)],
        solution: `${gross(10 ** e)} hat ${e} Nullen: ${gross(10 ** e)} = 10^${e}`,
        hints: ["Zähl die Nullen.", "10^2 = 100 hat zwei Nullen.", `${gross(10 ** e)} = 10 · 10 · …`],
        errors: [fehler(e + 1, "Alle Ziffern gezählt statt nur die Nullen")],
      });
    }
    if (kind === "minus") {
      const [b, e] = [rint(rng, 2, 5), pick(rng, [2, 3, 4])];
      const res = (-b) ** e;
      return aufgabe("mathe.potenzen.schreibweise", diff, {
        prompt: `Berechne: (−${b})^${e}`,
        accepted: [antwort(res)],
        solution: `(−${b})^${e} = ${Array(e).fill(`(−${b})`).join(" · ")} = ${zahl(res)}\n${e % 2 === 0 ? "Gerade Hochzahl: das Ergebnis ist positiv." : "Ungerade Hochzahl: das Ergebnis ist negativ."}`,
        hints: ["Die Klammer gehört dazu: das Minus wird mitpotenziert.", "Minus mal Minus ist Plus.", e % 2 === 0 ? "Bei gerader Hochzahl ist das Ergebnis positiv." : "Bei ungerader Hochzahl bleibt das Ergebnis negativ."],
        errors: [fehler(-res, "Vorzeichen falsch"), fehler(-b * e, "Basis mal Hochzahl gerechnet")],
      });
    }
    const m = dez(rng, 1.1, 9.9, pick(rng, [1, 2]));
    const e = kind === "zehner-klein" ? -rint(rng, 1, 4) : rint(rng, 2, 6);
    // höchstens vier Nachkommastellen: so schreibt die Antwort sie (lib/schulbuch-zahlen.ts antwort)
    const res = r4(m * 10 ** e);
    if (nachkomma(m * 10 ** e) > 4 || res >= 1e7) continue;
    const anders = r4(m * 10 ** (e > 0 ? e - 1 : e + 1));
    return aufgabe("mathe.potenzen.schreibweise", diff, {
      prompt: `Schreib als Zahl ohne Zehnerpotenz: ${zahl(m)} · 10^${e < 0 ? `(−${-e})` : e}`,
      accepted: [antwort(res)],
      solution: `${e > 0 ? `Mal 10^${e}: das Komma ${e} Stellen nach rechts.` : `Mal 10^(−${-e}): das Komma ${-e} ${-e === 1 ? "Stelle" : "Stellen"} nach links.`}\n${zahl(m)} · 10^${e < 0 ? `(−${-e})` : e} = ${gross(res)}`,
      hints: [e > 0 ? `10^${e} = ${gross(10 ** e)}` : `10^(−${-e}) = ${zahl(10 ** e)}`, e > 0 ? "Bei positiver Hochzahl wird die Zahl größer: Komma nach rechts." : "Bei negativer Hochzahl wird die Zahl kleiner: Komma nach links.", "Fehlende Stellen füllst du mit 0 auf."],
      errors: [fehler(anders, "Komma um eine Stelle zu wenig verschoben"), ...(nachkomma(m * 10 ** -e) <= 4 ? [fehler(r4(m * 10 ** -e), "Komma in die falsche Richtung")] : [])],
    });
  }
}
function negativeHochzahl(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["null", "bruch"] as const) : (["bruch", "dezimal", "bruch-basis"] as const));
    if (kind === "null") {
      const b = rint(rng, 2, 99);
      return aufgabe("mathe.os.potenzen.negativ", diff, {
        prompt: `Berechne: ${b}^0`,
        accepted: ["1"],
        solution: `Jede Zahl (außer 0) hoch 0 ist 1: ${b}^0 = 1\nDenn ${b}^2 : ${b}^2 = ${b}^(2 − 2) = ${b}^0 und das ist 1.`,
        hints: ["Denk an a^n : a^n.", "a^n : a^n = a^0, und eine Zahl durch sich selbst ergibt …?", "Das Ergebnis ist nicht 0."],
        errors: [fehler(0, "Hoch 0 als 0 gerechnet"), fehler(b, "Die Hochzahl 0 ignoriert")],
      });
    }
    if (kind === "dezimal") {
      const e = rint(rng, 1, 4);
      return aufgabe("mathe.os.potenzen.negativ", diff, {
        prompt: `Schreib als Dezimalzahl: 10^(−${e})`,
        accepted: [antwort(10 ** -e)],
        solution: `10^(−${e}) = 1/10^${e} = 1/${gross(10 ** e)} = ${zahl(r4(10 ** -e))}`,
        hints: ["Eine negative Hochzahl heißt: Kehrwert.", `10^(−${e}) = 1/10^${e}`, `Das sind ${e} Stellen nach dem Komma.`],
        errors: [fehler(-(10 ** e), "Negative Hochzahl als negative Zahl gelesen"), fehler(r4(10 ** -(e + 1)), "Eine Null zu viel")],
      });
    }
    const b = rint(rng, 2, kind === "bruch-basis" ? 5 : 6);
    const e = rint(rng, 1, 3);
    if (b ** e > 250) continue;
    if (kind === "bruch-basis") {
      const n = rint(rng, 1, 4);
      if (gcd(n, b) !== 1 || n === b) continue;
      const res = kuerze({ n: b ** e, d: n ** e });
      return aufgabe("mathe.os.potenzen.negativ", diff, {
        prompt: `Berechne und schreib als Bruch: (${n}/${b})^(−${e})`,
        accepted: [res.d === 1 ? `${res.n}` : `${res.n}/${res.d}`],
        solution: `Negative Hochzahl: Kehrwert nehmen.\n(${n}/${b})^(−${e}) = (${b}/${n})^${e} = ${b ** e}/${n ** e}${res.d === 1 ? ` = ${res.n}` : ""}`,
        hints: ["Eine negative Hochzahl heißt: Kehrwert und dann positiv potenzieren.", `(${n}/${b})^(−${e}) = (${b}/${n})^${e}`, "Zähler und Nenner einzeln potenzieren."],
        errors: [fehler(`${n ** e}/${b ** e}`, "Kehrwert vergessen"), fehler(`-${b ** e}/${n ** e}`, "Negative Hochzahl als negatives Vorzeichen gelesen")],
      });
    }
    return aufgabe("mathe.os.potenzen.negativ", diff, {
      prompt: `Schreib als Bruch: ${b}^(−${e})`,
      accepted: [`1/${b ** e}`],
      solution: `${b}^(−${e}) = 1/${b}^${e} = 1/${b ** e}`,
      hints: ["Eine negative Hochzahl heißt: Kehrwert.", `${b}^(−${e}) = 1/${b}^${e}`, `${b}^${e} = ${b ** e}`],
      errors: [fehler(-(b ** e), "Negative Hochzahl als negative Zahl gelesen"), fehler(`1/${b * e}`, "Basis mal Hochzahl gerechnet")],
    });
  }
}
function quadratwurzel(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["ganz"] as const) : lv <= 2 ? (["ganz", "dezimal", "bruch"] as const) : (["dezimal", "bruch", "produkt", "grenzen"] as const));
    const w = rint(rng, 2, lv === 0 ? 12 : 20);
    if (kind === "ganz") {
      return aufgabe("mathe.wurzeln.quadratwurzel", diff, {
        prompt: `Berechne: √${w * w}`,
        accepted: [antwort(w)],
        solution: `√${w * w} = ${w}, denn ${w} · ${w} = ${w * w}`,
        hints: ["Welche Zahl mal sich selbst ergibt die Zahl unter der Wurzel?", "Die Wurzel ist nicht die Hälfte.", `Probier ${w - 1} · ${w - 1} und ${w} · ${w}.`],
        errors: [fehler((w * w) / 2, "Halbiert statt die Wurzel gezogen")],
      });
    }
    if (kind === "dezimal") {
      const x = r4((w * w) / 100);
      return aufgabe("mathe.wurzeln.quadratwurzel", diff, {
        prompt: `Berechne: √${zahl(x)}`,
        accepted: [antwort(r4(w / 10))],
        solution: `√${zahl(x)} = ${zahl(r4(w / 10))}, denn ${zahl(r4(w / 10))} · ${zahl(r4(w / 10))} = ${zahl(x)}`,
        hints: [`${zahl(x)} = ${w * w}/100`, "Die Wurzel aus 100 ist 10.", `√${w * w} = ${w}, also durch 10.`],
        errors: [fehler(r4(w / 100), "Das Komma falsch gesetzt")],
      });
    }
    if (kind === "bruch") {
      const n = rint(rng, 1, 9);
      if (gcd(n, w) !== 1 || n >= w) continue;
      return aufgabe("mathe.wurzeln.quadratwurzel", diff, {
        prompt: `Berechne: √(${n * n}/${w * w})`,
        accepted: [`${n}/${w}`],
        solution: `Wurzel aus Zähler und Nenner einzeln: √${n * n} / √${w * w} = ${n}/${w}`,
        hints: ["Zieh die Wurzel aus Zähler und Nenner einzeln.", `√${n * n} = ${n}`, `√${w * w} = ${w}`],
        errors: n > 1 ? [fehler(`${n * n}/${w}`, "Nur aus dem Nenner die Wurzel gezogen")] : [],
      });
    }
    if (kind === "produkt") {
      const [a, b] = [pick(rng, [4, 9, 16, 25, 36]), pick(rng, [4, 9, 16, 25, 49])];
      if (a === b) continue;
      const res = Math.sqrt(a) * Math.sqrt(b);
      return aufgabe("mathe.wurzeln.quadratwurzel", diff, {
        prompt: `Berechne ohne Taschenrechner: √(${a} · ${b})`,
        accepted: [antwort(res)],
        solution: `√(${a} · ${b}) = √${a} · √${b} = ${Math.sqrt(a)} · ${Math.sqrt(b)} = ${res}`,
        hints: ["Die Wurzel aus einem Produkt ist das Produkt der Wurzeln.", `√${a} = ${Math.sqrt(a)}`, `√${b} = ${Math.sqrt(b)}`],
        errors: [fehler(Math.sqrt(a) + Math.sqrt(b), "Die Wurzeln addiert statt multipliziert")],
      });
    }
    const x = rint(rng, 5, 150);
    const u = Math.floor(Math.sqrt(x));
    if (u * u === x) continue;
    return lueckenAufgabe("mathe.wurzeln.quadratwurzel", diff, {
      prompt: `Zwischen welchen zwei aufeinanderfolgenden ganzen Zahlen liegt √${x}?`,
      luecken: `√${x} liegt zwischen ${GAP} und ${GAP}.`,
      werte: [u, u + 1],
      solution: `${u}^2 = ${u * u} < ${x} < ${(u + 1) ** 2} = ${u + 1}^2\nAlso liegt √${x} zwischen ${u} und ${u + 1} (√${x} ≈ ${zahl(r2(Math.sqrt(x)))}).`,
      hints: ["Welche Quadratzahlen liegen knapp unter und knapp über der Zahl?", "Quadratzahlen: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144 …", `${u}^2 = ${u * u}`],
      errors: [fehler(`${antwort(Math.floor(x / 2))} | ${antwort(Math.floor(x / 2) + 1)}`, "Halbiert statt die Wurzel geschätzt")],
    });
  }
}

// ---------- Geometrie ----------
function winkelBeziehungen(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv === 0 ? (["dreieck", "neben"] as const) : lv <= 2 ? (["dreieck", "neben", "scheitel", "viereck"] as const) : (["gleichschenkelig", "viereck", "dreieck-aussen"] as const));
    if (kind === "dreieck") {
      const [a, b] = [rint(rng, 20, 100), rint(rng, 20, 100)];
      if (a + b >= 170) continue;
      return aufgabe("mathe.winkel.beziehungen", diff, {
        prompt: `In einem Dreieck ist α = ${a}° und β = ${b}°. Berechne γ.`,
        accepted: mitEinheit(180 - a - b, "°"),
        solution: `Die Winkelsumme im Dreieck ist 180°.\nγ = 180° − ${a}° − ${b}° = ${180 - a - b}°`,
        hints: ["Die drei Winkel eines Dreiecks ergeben zusammen 180°.", `α + β = ${a + b}°`, `γ = 180° − ${a + b}°`],
        errors: [fehler(360 - a - b, "Mit 360° statt 180° gerechnet")],
      });
    }
    if (kind === "neben" || kind === "scheitel") {
      const a = rint(rng, 15, 165);
      const neben = kind === "neben";
      return aufgabe("mathe.winkel.beziehungen", diff, {
        prompt: `Zwei Geraden schneiden einander. Ein Winkel ist ${a}°. Wie groß ist ${neben ? "sein Nebenwinkel" : "sein Scheitelwinkel"}?`,
        accepted: mitEinheit(neben ? 180 - a : a, "°"),
        solution: neben ? `Nebenwinkel ergänzen einander auf 180°: 180° − ${a}° = ${180 - a}°` : `Scheitelwinkel liegen gegenüber und sind gleich groß: ${a}°`,
        hints: [neben ? "Nebenwinkel liegen nebeneinander auf einer Geraden." : "Scheitelwinkel liegen einander gegenüber.", neben ? "Zusammen ergeben sie einen gestreckten Winkel: 180°." : "Gegenüberliegende Winkel sind gleich groß.", neben ? `180° − ${a}°` : "Du musst nichts rechnen."],
        errors: neben ? [fehler(a, "Scheitelwinkel statt Nebenwinkel"), fehler(90 - a > 0 ? 90 - a : 360 - a, "Mit 90° oder 360° statt 180° gerechnet")] : [fehler(180 - a, "Nebenwinkel statt Scheitelwinkel")],
      });
    }
    if (kind === "viereck") {
      const [a, b, c] = [rint(rng, 50, 130), rint(rng, 50, 130), rint(rng, 50, 130)];
      const d = 360 - a - b - c;
      if (d < 30 || d > 170) continue;
      return aufgabe("mathe.winkel.beziehungen", diff, {
        prompt: `In einem Viereck ist α = ${a}°, β = ${b}° und γ = ${c}°. Berechne δ.`,
        accepted: mitEinheit(d, "°"),
        solution: `Die Winkelsumme im Viereck ist 360°.\nδ = 360° − ${a}° − ${b}° − ${c}° = ${d}°`,
        hints: ["Ein Viereck lässt sich in zwei Dreiecke teilen.", "Die Winkelsumme im Viereck ist 360°.", `α + β + γ = ${a + b + c}°`],
        errors: [fehler(180 - a - b - c > 0 ? 180 - a - b - c : 540 - a - b - c, "Mit der falschen Winkelsumme gerechnet")],
      });
    }
    if (kind === "gleichschenkelig") {
      const basis = rint(rng, 25, 85);
      const spitze = 180 - 2 * basis;
      const gegebenBasis = rng() < 0.5;
      return aufgabe("mathe.winkel.beziehungen", diff, {
        prompt: gegebenBasis ? `In einem gleichschenkeligen Dreieck ist jeder Basiswinkel ${basis}°. Wie groß ist der Winkel an der Spitze?` : `In einem gleichschenkeligen Dreieck ist der Winkel an der Spitze ${spitze}°. Wie groß ist ein Basiswinkel?`,
        accepted: mitEinheit(gegebenBasis ? spitze : basis, "°"),
        solution: gegebenBasis ? `Die zwei Basiswinkel sind gleich groß: 2 · ${basis}° = ${2 * basis}°\nSpitze: 180° − ${2 * basis}° = ${spitze}°` : `Für die zwei Basiswinkel bleiben 180° − ${spitze}° = ${2 * basis}°\nEin Basiswinkel: ${2 * basis}° : 2 = ${basis}°`,
        hints: ["Im gleichschenkeligen Dreieck sind die beiden Basiswinkel gleich groß.", "Die Winkelsumme ist 180°.", gegebenBasis ? `2 · ${basis}° = ${2 * basis}°` : `180° − ${spitze}° = ${2 * basis}°`],
        errors: gegebenBasis ? [fehler(180 - basis, "Nur einen Basiswinkel abgezogen")] : [fehler(180 - spitze, "Nicht durch 2 dividiert")],
      });
    }
    const [a, b] = [rint(rng, 25, 80), rint(rng, 25, 80)];
    return aufgabe("mathe.winkel.beziehungen", diff, {
      prompt: `In einem Dreieck ist α = ${a}° und β = ${b}°. Wie groß ist der Außenwinkel bei C (der Nebenwinkel von γ)?`,
      accepted: mitEinheit(a + b, "°"),
      solution: `γ = 180° − ${a}° − ${b}° = ${180 - a - b}°\nAußenwinkel = 180° − ${180 - a - b}° = ${a + b}° (= α + β)`,
      hints: ["Rechne zuerst γ aus.", "Der Außenwinkel ist der Nebenwinkel von γ.", "Merke: Außenwinkel = Summe der beiden anderen Innenwinkel."],
      errors: [fehler(180 - a - b, "Den Innenwinkel γ statt des Außenwinkels angegeben")],
    });
  }
}
function vierecksflaechen(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  const kind = pick(rng, lv === 0 ? (["parallelogramm", "raute"] as const) : (["parallelogramm", "raute", "deltoid", "trapez"] as const));
  const e = pick(rng, ["cm", "m"]);
  if (kind === "parallelogramm") {
    const [a, b, h] = [rint(rng, 4, 20), rint(rng, 3, 12), rint(rng, 2, 10)];
    if (h >= b) return vierecksflaechen(rng, diff);
    return aufgabe("mathe.flaechen.vierecke", diff, {
      prompt: `Ein Parallelogramm hat a = ${a} ${e}, b = ${b} ${e} und die Höhe h_a = ${h} ${e}. Berechne den Flächeninhalt.`,
      accepted: mitEinheit(a * h, `${e}²`),
      solution: `A = a · h_a = ${a} · ${h} = ${a * h} ${e}²\nDie Seite b brauchst du nur für den Umfang.`,
      hints: ["Ein Parallelogramm lässt sich zu einem Rechteck umlegen.", "A = Grundlinie mal zugehörige Höhe.", "Nicht a · b!"],
      errors: [fehler(a * b, "Seite b statt der Höhe genommen"), fehler(2 * (a + b), "Umfang statt Flächeninhalt")],
    });
  }
  if (kind === "trapez") {
    const [a, c, h] = [rint(rng, 6, 20), rint(rng, 2, 6), rint(rng, 2, 10)];
    const A = ((a + c) * h) / 2;
    return aufgabe("mathe.flaechen.vierecke", diff, {
      prompt: `Ein Trapez hat die parallelen Seiten a = ${a} ${e} und c = ${c} ${e} und die Höhe h = ${h} ${e}. Berechne den Flächeninhalt.`,
      accepted: mitEinheit(r4(A), `${e}²`),
      solution: `A = (a + c) · h : 2 = (${a} + ${c}) · ${h} : 2 = ${zahl(r4(A))} ${e}²`,
      hints: ["Zwei gleiche Trapeze ergeben ein Parallelogramm.", "A = (a + c) · h : 2", `a + c = ${a + c}`],
      errors: [fehler((a + c) * h, "Nicht durch 2 dividiert"), fehler(a * c * h, "Alle Längen multipliziert")],
    });
  }
  const [d1, d2] = [rint(rng, 3, 16), rint(rng, 3, 16)];
  const A = (d1 * d2) / 2;
  return aufgabe("mathe.flaechen.vierecke", diff, {
    prompt: `${kind === "raute" ? "Eine Raute" : "Ein Deltoid"} hat die Diagonalen e = ${d1} ${e} und f = ${d2} ${e}. Berechne den Flächeninhalt.`,
    accepted: mitEinheit(r4(A), `${e}²`),
    solution: `A = e · f : 2 = ${d1} · ${d2} : 2 = ${zahl(r4(A))} ${e}²`,
    hints: [`${kind === "raute" ? "Die Raute" : "Das Deltoid"} ist halb so groß wie das Rechteck aus den beiden Diagonalen.`, "A = e · f : 2", `e · f = ${d1 * d2}`],
    errors: [fehler(d1 * d2, "Nicht durch 2 dividiert"), fehler(d1 + d2, "Addiert statt multipliziert")],
  });
}

// ---------- quadratische Gleichungen ----------
function quadratischEinfach(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const kind = pick(rng, lv <= 1 ? (["x2=c", "x2-c=0"] as const) : (["x2=c", "ax2=c", "x(x-k)=0", "(x-a)(x-b)=0"] as const));
    const w = rint(rng, 1, 12);
    if (kind === "x2=c" || kind === "x2-c=0" || kind === "ax2=c") {
      const a = kind === "ax2=c" ? rint(rng, 2, 5) : 1;
      const c = a * w * w;
      const text = kind === "x2=c" ? `x^2 = ${c}` : kind === "x2-c=0" ? `x^2 − ${c} = 0` : `${a}x^2 = ${c}`;
      return lueckenAufgabe("mathe.os.gleichungen.quadratisch-einfach", diff, {
        prompt: `Löse die Gleichung: ${text}`,
        luecken: `x₁ = ${GAP} (die kleinere Lösung)   x₂ = ${GAP}`,
        werte: [-w, w],
        solution: `${kind === "x2-c=0" ? `x^2 = ${c}\n` : kind === "ax2=c" ? `x^2 = ${c} : ${a} = ${w * w}\n` : ""}x = ±√${w * w} = ±${w}\nx₁ = −${w}, x₂ = ${w}`,
        hints: ["Bring x^2 allein auf eine Seite.", "Zieh dann die Wurzel.", "Es gibt zwei Lösungen: eine positive und eine negative."],
        errors: [fehler(`${w} | ${w}`, "Die negative Lösung vergessen"), fehler(`${antwort(w)} | ${antwort(-w)}`, "Lösungen vertauscht: zuerst die kleinere")],
      });
    }
    if (kind === "x(x-k)=0") {
      const k = rint(rng, 1, 12) * (rng() < 0.4 ? -1 : 1);
      const [x1, x2] = [Math.min(0, k), Math.max(0, k)];
      return lueckenAufgabe("mathe.os.gleichungen.quadratisch-einfach", diff, {
        prompt: `Löse die Gleichung: x^2 ${k > 0 ? "−" : "+"} ${Math.abs(k)}x = 0`,
        luecken: `x₁ = ${GAP} (die kleinere Lösung)   x₂ = ${GAP}`,
        werte: [x1, x2],
        solution: `x herausheben: x · (x ${k > 0 ? "−" : "+"} ${Math.abs(k)}) = 0\nEin Produkt ist 0, wenn ein Faktor 0 ist: x = 0 oder x = ${zahl(k)}`,
        hints: ["Heb x heraus.", "Ein Produkt ist null, wenn einer der Faktoren null ist.", "Vergiss die Lösung x = 0 nicht."],
        errors: [fehler(`${antwort(Math.min(-k, 0))} | ${antwort(Math.max(-k, 0))}`, "Vorzeichen der zweiten Lösung falsch"), fehler(`${antwort(k)} | ${antwort(k)}`, "Die Lösung x = 0 vergessen")],
      });
    }
    const [a, b] = [rint(rng, -9, 9), rint(rng, -9, 9)];
    if (a === b) continue;
    const [x1, x2] = [Math.min(a, b), Math.max(a, b)];
    const f = (r: number) => (r === 0 ? "x" : `(x ${r > 0 ? "−" : "+"} ${Math.abs(r)})`);
    return lueckenAufgabe("mathe.os.gleichungen.quadratisch-einfach", diff, {
      prompt: `Löse die Gleichung: ${f(a)} · ${f(b)} = 0`,
      luecken: `x₁ = ${GAP} (die kleinere Lösung)   x₂ = ${GAP}`,
      werte: [x1, x2],
      solution: `Ein Produkt ist 0, wenn ein Faktor 0 ist:\n${f(a)} = 0 → x = ${zahl(a)}\n${f(b)} = 0 → x = ${zahl(b)}`,
      hints: ["Nicht ausmultiplizieren!", "Ein Produkt ist null, wenn einer der Faktoren null ist.", "Setz jede Klammer einzeln gleich 0."],
      errors: [fehler(`${antwort(Math.min(-a, -b))} | ${antwort(Math.max(-a, -b))}`, "Vorzeichen umgedreht")],
    });
  }
}
function loesungsformel(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const [r1, r2v] = [rint(rng, -9, 9), rint(rng, -9, 9)];
    if (r1 === r2v && lv < 3) continue;
    const a = lv <= 1 ? 1 : pick(rng, [1, 2, -1, 3]);
    const [b, c] = [-a * (r1 + r2v), a * r1 * r2v];
    if (b === 0 || c === 0) continue;
    const [x1, x2] = [Math.min(r1, r2v), Math.max(r1, r2v)];
    const D = b * b - 4 * a * c;
    const gl = `${glieder([[a, "x^2"], [b, "x"], [c, ""]])} = 0`;
    const kleine = a === 1;
    const p = b;
    const q = c;
    const solution = kleine
      ? `Kleine Lösungsformel für x^2 + px + q = 0 mit p = ${zahl(p)}, q = ${zahl(q)}:\nx = −p/2 ± √((p/2)^2 − q) = ${zahl(-p / 2)} ± √(${zahl((p / 2) ** 2)} ${q < 0 ? "+" : "−"} ${zahl(Math.abs(q))}) = ${zahl(-p / 2)} ± ${zahl(Math.sqrt((p / 2) ** 2 - q))}\nx₁ = ${zahl(x1)}, x₂ = ${zahl(x2)}`
      : `Große Lösungsformel mit a = ${zahl(a)}, b = ${zahl(b)}, c = ${zahl(c)}:\nD = b^2 − 4ac = ${zahl(b * b)} − ${zahl(4 * a * c)} = ${zahl(D)}\nx = (−b ± √D) / (2a) = (${zahl(-b)} ± ${zahl(Math.sqrt(D))}) / ${zahl(2 * a)}\nx₁ = ${zahl(x1)}, x₂ = ${zahl(x2)}`;
    return lueckenAufgabe("mathe.os.gleichungen.loesungsformel", diff, {
      prompt: `Löse mit der Lösungsformel: ${gl}`,
      luecken: x1 === x2 ? `x₁ = ${GAP}   x₂ = ${GAP} (eine Doppellösung: zweimal dieselbe Zahl)` : `x₁ = ${GAP} (die kleinere Lösung)   x₂ = ${GAP}`,
      werte: [x1, x2],
      solution,
      hints: [kleine ? "x^2 + px + q = 0: x = −p/2 ± √((p/2)^2 − q)" : "ax^2 + bx + c = 0: x = (−b ± √(b^2 − 4ac)) / (2a)", kleine ? `Hier ist p = ${zahl(p)} und q = ${zahl(q)}.` : `Hier ist a = ${zahl(a)}, b = ${zahl(b)}, c = ${zahl(c)}.`, kleine ? `−p/2 = ${zahl(-p / 2)}` : `D = ${zahl(D)}, √D = ${zahl(Math.sqrt(D))}`],
      errors: [fehler(`${antwort(Math.min(-r1, -r2v))} | ${antwort(Math.max(-r1, -r2v))}`, kleine ? "Vorzeichen von −p/2 falsch" : "Vorzeichen von −b falsch"), ...(x1 !== x2 ? [fehler(`${antwort(x2)} | ${antwort(x1)}`, "Lösungen vertauscht: zuerst die kleinere")] : [])],
    });
  }
}

// ---------- Trigonometrie ----------
const grad2rad = (g: number) => (g * pi) / 180;
function trigoRechtwinkelig(rng: Rng, diff: Difficulty): TaskDraft {
  const lv = STUFE[diff];
  for (;;) {
    const alpha = rint(rng, 15, 75);
    const kind = pick(rng, lv <= 1 ? (["a aus c", "b aus c"] as const) : lv === 2 ? (["a aus c", "b aus c", "a aus b"] as const) : (["a aus b", "c aus a", "alpha"] as const));
    const s = rint(rng, 3, 20);
    const sin = Math.sin(grad2rad(alpha));
    const cos = Math.cos(grad2rad(alpha));
    const tan = Math.tan(grad2rad(alpha));
    const kopf = "Im rechtwinkeligen Dreieck ABC ist γ = 90°";
    if (kind === "alpha") {
      const [a, b] = [rint(rng, 3, 15), rint(rng, 3, 15)];
      const res = r2((Math.atan(a / b) * 180) / pi);
      return aufgabe("mathe.os.trigo.rechtwinkelig", diff, {
        prompt: `${kopf}, a = ${a} cm und b = ${b} cm. Berechne den Winkel α. Runde auf zwei Dezimalstellen.`,
        accepted: mitEinheit(res, "°"),
        solution: `a ist die Gegenkathete, b die Ankathete von α:\ntan α = a / b = ${a} / ${b}\nα = tan⁻¹(${a} / ${b}) ≈ ${zahl(res)}°`,
        hints: ["Welche Seite liegt α gegenüber, welche liegt an α an?", "Gegenkathete durch Ankathete ist der Tangens.", `α = tan⁻¹(${a}/${b})`],
        errors: [fehler(r2((Math.atan(b / a) * 180) / pi), "Gegenkathete und Ankathete vertauscht")],
      });
    }
    const cases = {
      "a aus c": { gegeben: `c = ${s} cm`, res: s * sin, formel: `sin α = a / c → a = c · sin α = ${s} · sin ${alpha}°`, falsch: s * cos, label: "Cosinus statt Sinus genommen", hint: "a liegt α gegenüber, c ist die Hypotenuse." },
      "b aus c": { gegeben: `c = ${s} cm`, res: s * cos, formel: `cos α = b / c → b = c · cos α = ${s} · cos ${alpha}°`, falsch: s * sin, label: "Sinus statt Cosinus genommen", hint: "b liegt an α an, c ist die Hypotenuse." },
      "a aus b": { gegeben: `b = ${s} cm`, res: s * tan, formel: `tan α = a / b → a = b · tan α = ${s} · tan ${alpha}°`, falsch: s / tan, label: "Durch tan α statt mal tan α", hint: "a liegt α gegenüber, b liegt an α an." },
      "c aus a": { gegeben: `a = ${s} cm`, res: s / sin, formel: `sin α = a / c → c = a / sin α = ${s} / sin ${alpha}°`, falsch: s * sin, label: "Mal sin α statt durch sin α", hint: "a liegt α gegenüber, gesucht ist die Hypotenuse." },
    }[kind];
    const gesucht = kind.split(" ")[0];
    const res = r2(cases.res);
    return aufgabe("mathe.os.trigo.rechtwinkelig", diff, {
      prompt: `${kopf}, α = ${alpha}° und ${cases.gegeben}. Berechne ${gesucht}. Runde auf zwei Dezimalstellen.`,
      accepted: mitEinheit(res, "cm"),
      solution: `${cases.formel} ≈ ${zahl(res)} cm`,
      hints: [cases.hint, "SOH-CAH-TOA: sin = Gegenkathete/Hypotenuse, cos = Ankathete/Hypotenuse, tan = Gegenkathete/Ankathete.", "Stell den Taschenrechner auf Grad (DEG)."],
      errors: [fehler(r2(cases.falsch), cases.label)],
    });
  }
}

/** Die neuen Rechnungen, nach Fähigkeit (lib/generators.ts nimmt sie in GEN auf). */
export const MATHE_GRUNDLAGEN: Record<string, Gen> = {
  "mathe.dezimal.addieren": dezimalAddieren,
  "mathe.dezimal.multiplizieren": dezimalMultiplizieren,
  "mathe.zahlen.zehner": zehner,
  "mathe.zahlen.vorrang": vorrang,
  "mathe.zahlen.runden": runden,
  "mathe.zahlen.addieren": schriftlichAddieren,
  "mathe.zahlen.multiplizieren": schriftlichMultiplizieren,
  "mathe.zahlen.dividieren": schriftlichDividieren,
  "mathe.masse.laengen": masseAufgabe(LAENGEN),
  "mathe.masse.massen": masseAufgabe(MASSEN),
  "mathe.masse.flaechen": masseAufgabe(FLAECHEN),
  "mathe.masse.volumen": masseAufgabe(VOLUMEN),
  "mathe.masse.zeit": zeitmasse,
  "mathe.masse.massstab": massstab,
  "mathe.brueche.vonzahlen": bruchteilVon,
  "mathe.brueche.dezimal": bruchDezimal,
  "mathe.teilbarkeit.ggt-kgv": ggtKgv,
  "mathe.teilbarkeit.regeln": teilbarkeitsregeln,
  "mathe.terme.aufstellen": termWert,
  "mathe.terme.zusammenfassen": zusammenfassen,
  "mathe.terme.klammern": klammernAufloesen,
  "mathe.terme.binomisch": binomisch,
  "mathe.terme.herausheben": herausheben,
  "mathe.gleichungssysteme.rechnerisch": gleichungssystem,
  "mathe.koerper.quader": quader,
  "mathe.koerper.prisma": prisma,
  "mathe.koerper.zylinder": rundkoerper("zylinder"),
  "mathe.koerper.kegel": rundkoerper("kegel"),
  "mathe.koerper.pyramide": pyramide,
  "mathe.proportional.direkt": direktProportional,
  "mathe.proportional.indirekt": indirektProportional,
  "mathe.prozent.zinsen": zinsen,
  "mathe.prozent.aenderung": prozentAenderung,
  "mathe.prozent.promille": promille,
  "mathe.potenzen.schreibweise": potenzSchreibweise,
  "mathe.os.potenzen.negativ": negativeHochzahl,
  "mathe.wurzeln.quadratwurzel": quadratwurzel,
  "mathe.winkel.beziehungen": winkelBeziehungen,
  "mathe.flaechen.vierecke": vierecksflaechen,
  "mathe.os.gleichungen.quadratisch-einfach": quadratischEinfach,
  "mathe.os.gleichungen.loesungsformel": loesungsformel,
  "mathe.os.trigo.rechtwinkelig": trigoRechtwinkelig,
};
