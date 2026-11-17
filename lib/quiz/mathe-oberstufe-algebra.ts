/**
 * Mathe-Quiz Oberstufe (9. bis 13. Schulstufe), Zahlen, Terme, Gleichungen, Funktionen, Logarithmus, Wachstum und
 * Folgen: Begriffe als Text, Rechnungen mit Erzeugern (falsche Antworten = typische Fehler: Vorzeichen beim
 * Umformen, nur eine Lösung von x² = a, Prozent statt Faktor …). Format: lib/lernspiele-quiz.ts.
 */
import type { QuizBank } from "../lernspiele-quiz";
import { bruch, eins, faktor, ganz, plusMinus, runde, wahl, zahl, type Rng } from "./hilfen";

/** „3x + 2“, „−x − 4“, „5x“ */
const lin = (k: number, d: number, v = "x") => `${faktor(k)}${v}${d ? ` ${plusMinus(d)}` : ""}`;
/** „x² − 5x + 6“ aus den Beiwerten */
function quad(a: number, b: number, c: number, v = "x"): string {
  let s = `${faktor(a)}${v}²`;
  if (b) s += ` ${b < 0 ? "−" : "+"} ${Math.abs(b) === 1 ? "" : zahl(Math.abs(b))}${v}`;
  if (c) s += ` ${plusMinus(c)}`;
  return s;
}
const menge = (xs: number[]) => `{${[...new Set(xs)].sort((a, b) => a - b).map((x) => zahl(x)).join("; ")}}`;

// ---------- Zahlen ----------

const dual = (rng: Rng) => {
  const n = ganz(rng, 5, 60);
  const d = n.toString(2);
  if (rng() < 0.5) return wahl(`Die Dualzahl ${d} ist im Zehnersystem ___`, zahl(n), [zahl(n + 1), zahl(n - 1), zahl(parseInt(d.split("").reverse().join(""), 2)), d.replace(/^1/, "")], "Von rechts: Stellenwerte 1, 2, 4, 8, 16, 32 …");
  return wahl(`${n} im Dualsystem: ___`, d, [(n + 1).toString(2), (n - 1).toString(2), d.split("").reverse().join("")], "Immer durch 2 teilen, die Reste von unten nach oben lesen.");
};

const gleitkomma = (rng: Rng) => {
  const ziffern = ganz(rng, 11, 99);
  const m = ziffern / 10;
  const e = eins(rng, [-6, -5, -4, -3, 3, 4, 5, 6, 7]);
  const lang = e < 0 ? `0,${"0".repeat(-e - 1)}${String(ziffern).replace(/0$/, "")}` : zahl(ziffern * 10 ** (e - 1), 0);
  return wahl(`${lang} = ___`, `${zahl(m)} · 10^${zahl(e)}`, [`${zahl(m)} · 10^${zahl(-e)}`, `${zahl(m)} · 10^${zahl(e + (e < 0 ? 1 : -1))}`, `${zahl(m * 10)} · 10^${zahl(e + (e < 0 ? 1 : -1) * 2)}`], "Komma so verschieben, dass eine Ziffer davor steht; nach links verschoben → positive Hochzahl.");
};

const fehler = (rng: Rng) => {
  const w = eins(rng, [20, 25, 40, 50, 80, 100, 200, 250]);
  const f = eins(rng, [1, 2, 4, 5]);
  const rel = runde((f / w) * 100, 2);
  return wahl(`Wahrer Wert ${w} cm, gemessen ${w + f} cm. Relativer Fehler: ___`, `${zahl(rel)} %`, [`${f} %`, `${zahl(runde((f / (w + f)) * 100, 2))} %`, `${zahl(rel * 10)} %`], "relativer Fehler = absoluter Fehler : wahrer Wert");
};

// ---------- Terme und Potenzen ----------

const faktorisieren = (rng: Rng) => {
  const a = ganz(rng, 1, 9);
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl(`x² − ${a * a} = ___`, `(x + ${a}) · (x − ${a})`, [`(x − ${a})²`, `(x + ${a})²`, `(x − ${a * a}) · (x + 1)`], "3. binomische Formel: a² − b² = (a + b) · (a − b)");
  if (art === 1) return wahl(`x² + ${2 * a}x + ${a * a} = ___`, `(x + ${a})²`, [`(x − ${a})²`, `(x + ${a}) · (x − ${a})`, `(x + ${2 * a})²`], "1. binomische Formel: a² + 2ab + b² = (a + b)²");
  const k = ganz(rng, 2, 9);
  return wahl(`${k}x² − ${k * a}x = ___`, `${k}x · (x − ${a})`, [`${k}x · (x − ${k * a})`, `${k} · (x² − ${a})`, `x · (${k}x − ${a})`], "Den gemeinsamen Faktor herausheben und im Kopf zurückrechnen.");
};

const negPotenz = (rng: Rng) => {
  const b = ganz(rng, 2, 5);
  const e = ganz(rng, 1, b === 2 ? 5 : 3);
  return wahl(`${b}^(−${e}) = ___`, `1/${b ** e}`, [`−${b ** e}`, `−${b * e}`, `1/${b * e}`], "a^(−n) = 1/aⁿ: eine negative Hochzahl macht keinen negativen Wert.");
};

const ratPotenz = (rng: Rng) => {
  const [b, n] = eins(rng, [[4, 2], [9, 2], [16, 2], [25, 2], [8, 3], [27, 3], [16, 4], [81, 4], [32, 5]] as [number, number][]);
  const w = Math.round(b ** (1 / n));
  const m = eins(rng, [1, 2, 3].filter((x) => x < n || n === 2));
  return wahl(`${b}^(${m}/${n}) = ___`, zahl(w ** m), [zahl((b * m) / n), zahl(w * m), zahl(b ** m)], `a^(m/n) = (ⁿ√a)^m: zuerst die ${n}. Wurzel (${w}), dann hoch ${m}.`);
};

// ---------- Gleichungen ----------

const quadEinfach = (rng: Rng) => {
  const a = ganz(rng, 2, 12);
  if (rng() < 0.5) return wahl(`x² = ${a * a}. L = ___`, `{−${a}; ${a}}`, [`{${a}}`, `{${a * a / 2}}`, `{−${a}}`], "x² = c hat für c > 0 zwei Lösungen: +√c und −√c.");
  const b = ganz(rng, 2, 9);
  return wahl(`x² − ${b}x = 0. L = ___`, `{0; ${b}}`, [`{${b}}`, `{−${b}; ${b}}`, `{0; −${b}}`], "x herausheben: x · (x − b) = 0, ein Produkt ist 0, wenn ein Faktor 0 ist.");
};

const loesungsformel = (rng: Rng) => {
  const x1 = ganz(rng, -7, 7);
  let x2 = ganz(rng, -7, 7);
  if (x2 === x1) x2 = x1 + 3;
  const p = -(x1 + x2);
  const q = x1 * x2;
  return wahl(`${quad(1, p, q)} = 0. L = ___`, menge([x1, x2]), [menge([-x1, -x2]), menge([x1, -x2]), menge([-x1, x2])], "x = −p/2 ± √((p/2)² − q); Probe: x₁ + x₂ = −p, x₁ · x₂ = q.");
};

const diskriminante = (rng: Rng) => {
  const p = ganz(rng, -8, 8);
  const q = ganz(rng, -10, 16);
  const d = (p * p) / 4 - q;
  const r = d > 0 ? "zwei Lösungen" : d === 0 ? "genau eine Lösung" : "keine reelle Lösung";
  return wahl(`Wie viele Lösungen hat ${quad(1, p, q)} = 0?`, r, ["zwei Lösungen", "genau eine Lösung", "keine reelle Lösung"].filter((x) => x !== r), `D = (p/2)² − q = ${zahl(d)}: D > 0 zwei, D = 0 eine, D < 0 keine reelle Lösung.`);
};

const vieta = (rng: Rng) => {
  const x1 = ganz(rng, -6, 6) || 1;
  const x2 = ganz(rng, -6, 6) || -2;
  const p = -(x1 + x2);
  const q = x1 * x2;
  if (rng() < 0.5) return wahl(`Lösungen ${zahl(x1)} und ${zahl(x2)}: Die Gleichung lautet ___`, `${quad(1, p, q)} ＝ 0`, [`${quad(1, -p, q)} ＝ 0`, `${quad(1, p, -q)} ＝ 0`, `${quad(1, -p, -q)} ＝ 0`].filter((s) => s !== `${quad(1, p, q)} ＝ 0`), "(x − x₁) · (x − x₂) = 0 ausmultiplizieren; p = −(x₁ + x₂), q = x₁ · x₂");
  return wahl(`${quad(1, p, q)} in Linearfaktoren: ___`, `(x ${plusMinus(-x1)}) · (x ${plusMinus(-x2)})`, [`(x ${plusMinus(x1)}) · (x ${plusMinus(x2)})`, `(x ${plusMinus(-x1)}) · (x ${plusMinus(x2)})`, `(x ${plusMinus(p)}) · (x ${plusMinus(q)})`], "Die Nullstellen mit umgekehrtem Vorzeichen in die Klammern.");
};

const polynomGl = (rng: Rng) => {
  const a = ganz(rng, 1, 7);
  if (rng() < 0.5) return wahl(`x³ − ${a * a}x = 0. L = ___`, `{−${a}; 0; ${a}}`, [`{0; ${a}}`, `{−${a}; ${a}}`, `{0; ${a * a}}`], "x herausheben: x · (x² − a) = 0, dann x² = a zwei Lösungen, und x = 0 nicht vergessen.");
  const b = ganz(rng, 2, 4);
  return wahl(`x⁴ − ${b * b + 1}x² + ${b * b} = 0. Wie viele reelle Lösungen?`, "4", ["2", "1", "3"], `Substitution u = x²: u = 1 oder u = ${b * b}, also x = ±1 und x = ±${b}.`);
};

const ungleichung = (rng: Rng) => {
  const k = eins(rng, [-5, -4, -3, -2, 2, 3, 4, 5]);
  const x = ganz(rng, -6, 6);
  const d = ganz(rng, -9, 9);
  const c = k * x + d;
  const zeichen = eins(rng, ["<", ">", "≤", "≥"]);
  const um: Record<string, string> = { "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
  const z = k < 0 ? um[zeichen] : zeichen;
  return wahl(`${lin(k, d)} ${zeichen} ${zahl(c)}. Lösung: ___`, `x ${z} ${zahl(x)}`, [`x ${k < 0 ? zeichen : um[zeichen]} ${zahl(x)}`, `x ${z} ${zahl(-x)}`, `x ${z} ${zahl(runde((c + d) / k))}`], "Beim Multiplizieren oder Dividieren mit einer negativen Zahl dreht sich das Zeichen um.");
};

// ---------- Funktionen ----------

const scheitel = (rng: Rng) => {
  const xs = ganz(rng, -5, 5);
  const ys = ganz(rng, -9, 9);
  const b = -2 * xs;
  const c = xs * xs + ys;
  return wahl(`f(x) = ${quad(1, b, c)}. Scheitelpunkt S = ___`, `(${zahl(xs)} ∣ ${zahl(ys)})`, [`(${zahl(-xs)} ∣ ${zahl(ys)})`, `(${zahl(xs)} ∣ ${zahl(c)})`, `(${zahl(-xs)} ∣ ${zahl(-ys)})`], "x_S = −b/(2a), dann y_S = f(x_S); oder quadratisch ergänzen.");
};

const parabelParameter = (rng: Rng) => {
  const a = eins(rng, [-3, -2, -1, -0.5, 0.5, 2, 3]);
  const o = a > 0 ? "nach oben offen" : "nach unten offen";
  const w = Math.abs(a) > 1 ? "enger als x²" : "weiter als x²";
  if (rng() < 0.5) return wahl(`f(x) = ${zahl(a)}x² + 1: Die Parabel ist ___`, o, [a > 0 ? "nach unten offen" : "nach oben offen", "eine Gerade"], "a > 0 nach oben offen, a < 0 nach unten offen.");
  return wahl(`f(x) = ${zahl(a)}x²: Die Parabel ist ___`, w, [Math.abs(a) > 1 ? "weiter als x²" : "enger als x²", "gleich wie x²"], "Betrag von a größer als 1: enger (gestreckt); kleiner als 1: weiter (gestaucht).");
};

const umkehr = (rng: Rng) => {
  const k = eins(rng, [2, 3, 4, 5, -2, -3]);
  const d = ganz(rng, -8, 8) || 3;
  return wahl(`f(x) = ${lin(k, d)}. Umkehrfunktion f⁻¹(x) = ___`, `(x ${plusMinus(-d)})/${k < 0 ? `(${zahl(k)})` : k}`, [`(x ${plusMinus(d)})/${k < 0 ? `(${zahl(k)})` : k}`, `${zahl(k)}x ${plusMinus(-d)}`, `1/(${lin(k, d)})`], "y = kx + d nach x auflösen, dann x und y tauschen.");
};

const symmetrie = (rng: Rng) => {
  const f = eins(rng, [
    ["x⁴ − 3x²", "gerade"],
    ["x³ + 2x", "ungerade"],
    ["x² + x", "keine Symmetrie"],
    ["5x⁶ + 1", "gerade"],
    ["−x⁵ + x³ − x", "ungerade"],
    ["x³ + 1", "keine Symmetrie"],
    ["cos(x)", "gerade"],
    ["sin(x)", "ungerade"],
    ["2x² − 7", "gerade"],
    ["4x", "ungerade"],
    ["(x − 1)²", "keine Symmetrie"],
    ["x⁴ + x", "keine Symmetrie"],
  ] as [string, string][]);
  return wahl(`f(x) = ${f[0]} ist ___`, f[1], ["gerade", "ungerade", "keine Symmetrie"].filter((x) => x !== f[1]), "Nur gerade Hochzahlen (und Zahl): gerade, symmetrisch zur y-Achse. Nur ungerade: ungerade, symmetrisch zum Ursprung.");
};

const verschieben = (rng: Rng) => {
  const c = ganz(rng, 1, 6);
  const art = ganz(rng, 0, 3);
  if (art === 0) return wahl(`Der Graph von f(x) = x² wird um ${c} nach rechts verschoben: g(x) = ___`, `(x − ${c})²`, [`(x + ${c})²`, `x² − ${c}`, `x² + ${c}`], "f(x − c) verschiebt um c nach rechts (Vorzeichen in der Klammer umgekehrt).");
  if (art === 1) return wahl(`Der Graph von f(x) = x² wird um ${c} nach unten verschoben: g(x) = ___`, `x² − ${c}`, [`(x − ${c})²`, `x² + ${c}`, `(x + ${c})²`], "f(x) − c verschiebt um c nach unten.");
  if (art === 2) return wahl(`g(x) = −f(x) ist der Graph von f gespiegelt an der ___`, "x-Achse", ["y-Achse", "Geraden y = x", "Ursprung"], "−f(x): alle y-Werte wechseln das Vorzeichen.");
  return wahl(`g(x) = f(x + ${c}) ist der Graph von f um ${c} verschoben nach ___`, "links", ["rechts", "oben", "unten"], "f(x + c) verschiebt um c nach links.");
};

const verkettung = (rng: Rng) => {
  const a = ganz(rng, 2, 5);
  const b = ganz(rng, 1, 6);
  const x = ganz(rng, -3, 3);
  const g = a * x + b;
  return wahl(`f(x) = x², g(x) = ${lin(a, b)}. f(g(${zahl(x)})) = ___`, zahl(g * g), [zahl(a * x * x + b), zahl(g), zahl(a * x + b * b)], `Innen zuerst: g(${zahl(x)}) = ${zahl(g)}, dann f(${zahl(g)}) = ${zahl(g * g)}.`);
};

// ---------- Logarithmus und Wachstum ----------

const logBegriff = (rng: Rng) => {
  const b = eins(rng, [2, 3, 5, 10]);
  const e = ganz(rng, b === 10 ? -3 : 0, b === 2 ? 7 : 4);
  const w = b ** e;
  const arg = e < 0 ? zahl(w, 4) : zahl(w);
  const tief: Record<number, string> = { 2: "₂", 3: "₃", 5: "₅", 10: "₁₀" };
  return wahl(`log${tief[b]}(${arg}) = ___`, zahl(e), [zahl(w / b, 4), zahl(e + 1), zahl(-e || 1)].filter((s) => s !== zahl(e)), `Welche Hochzahl macht aus ${b} die Zahl ${arg}? ${b}^${e} = ${arg}`);
};

const exponentialGl = (rng: Rng) => {
  const b = eins(rng, [2, 3, 5]);
  const e = ganz(rng, 2, b === 2 ? 8 : 4);
  if (rng() < 0.6) return wahl(`${b}^x = ${b ** e}. x = ___`, zahl(e), [zahl((b ** e) / b), zahl(e + 1), zahl(e - 1)], "Gleiche Basis: Hochzahlen vergleichen; sonst x = log(c)/log(b).");
  const c = ganz(rng, 2, 9);
  return wahl(`${b}^x = ${c}. x = ___`, `log(${c})/log(${b})`, [`log(${c}) − log(${b})`, `log(${c} − ${b})`, `${c}/${b}`], "Beide Seiten logarithmieren: x · log(b) = log(c).");
};

const prozentFaktor = (rng: Rng) => {
  const p = eins(rng, [2, 3, 4, 5, 8, 10, 12, 15, 20, 25]);
  const zu = rng() < 0.5;
  const a = zu ? runde(1 + p / 100, 4) : runde(1 - p / 100, 4);
  return wahl(`${zu ? "Zunahme" : "Abnahme"} um ${p} % pro Jahr: Wachstumsfaktor a = ___`, zahl(a, 4), [zahl(p / 100, 4), zahl(zu ? 1 - p / 100 : 1 + p / 100, 4), zahl(p)], `${zu ? "1 + p/100" : "1 − p/100"}: der Faktor, mit dem man jedes Jahr multipliziert.`);
};

const exponentialWert = (rng: Rng) => {
  const c = eins(rng, [100, 200, 500, 1000]);
  const a = eins(rng, [2, 3, 0.5]);
  const t = ganz(rng, 1, 4);
  return wahl(`N(t) = ${c} · ${zahl(a)}^t. N(${t}) = ___`, zahl(c * a ** t), [zahl(c * a * t), zahl(c * a ** (t + 1)), zahl(c + a ** t)], "Zuerst die Potenz, dann mal c (Potenz vor Punkt).");
};

const halbwert = (rng: Rng) => {
  const n0 = eins(rng, [80, 160, 320, 640, 1000, 1200]);
  const h = eins(rng, [2, 3, 5, 8, 10, 30]);
  const k = ganz(rng, 1, 4);
  if (rng() < 0.5) return wahl(`Halbwertszeit ${h} Tage, Anfangsmenge ${n0} g. Nach ${h * k} Tagen sind es ___`, `${zahl(n0 / 2 ** k)} g`, [`${zahl(n0 / (2 * k))} g`, `${zahl(n0 - (n0 / 2) * k > 0 ? n0 - (n0 / 2) * k : n0 / 2 ** (k + 1))} g`, `${zahl(n0 / 2 ** (k + 1))} g`], `${k}-mal halbieren: ${n0} · (1/2)^${k}`);
  return wahl(`Eine Menge verdoppelt sich alle ${h} Jahre. Nach ${h * k} Jahren ist sie ___ so groß.`, `${2 ** k}-mal`, [`${2 * k}-mal`, `${2 ** (k + 1)}-mal`, `${h * k}-mal`], `${k} Verdopplungen: 2^${k}`);
};

const modellVergleich = (rng: Rng) => {
  const s = ganz(rng, 10, 50);
  const d = ganz(rng, 2, 9);
  if (rng() < 0.5) return wahl(`Werte ${s}, ${s + d}, ${s + 2 * d}, ${s + 3 * d}: Welches Modell passt?`, "linear", ["exponentiell", "quadratisch"], "Gleiche Differenzen: linear. Gleiche Quotienten: exponentiell.");
  const a = eins(rng, [2, 3]);
  return wahl(`Werte ${s}, ${s * a}, ${s * a * a}, ${s * a ** 3}: Welches Modell passt?`, "exponentiell", ["linear", "quadratisch"], "Gleiche Quotienten (immer mal a): exponentiell.");
};

// ---------- Folgen ----------

const arithmetisch = (rng: Rng) => {
  const a1 = ganz(rng, -5, 12);
  const d = eins(rng, [-4, -3, -2, 2, 3, 4, 5, 6]);
  const n = ganz(rng, 6, 20);
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl(`Arithmetische Folge: a₁ = ${zahl(a1)}, d = ${zahl(d)}. a_${n} = ___`, zahl(a1 + (n - 1) * d), [zahl(a1 + n * d), zahl(a1 * d ** (n - 1) > 1e6 ? a1 + (n - 2) * d : a1 + (n + 1) * d), zahl(n * d)], "aₙ = a₁ + (n − 1) · d");
  if (art === 1) return wahl(`${zahl(a1)}, ${zahl(a1 + d)}, ${zahl(a1 + 2 * d)}, … Wie lautet die Folge explizit?`, `aₙ ＝ ${zahl(a1 - d)} ${plusMinus(d)}n`.replace("＝ 0 + ", "＝ ").replace("＝ 0 − ", "＝ −"), [`aₙ ＝ ${zahl(a1)} ${plusMinus(d)}n`, `aₙ ＝ ${zahl(d)} ${plusMinus(a1)}n`, `aₙ ＝ ${zahl(a1)} · ${zahl(d)}^n`], "aₙ = a₁ + (n − 1) · d = (a₁ − d) + d · n");
  const s = (n * (2 * a1 + (n - 1) * d)) / 2;
  return wahl(`a₁ = ${zahl(a1)}, d = ${zahl(d)}: Summe der ersten ${n} Glieder sₙ = ___`, zahl(s), [zahl(n * (a1 + (a1 + n * d)) / 2), zahl(n * a1), zahl(s + d)], "sₙ = n/2 · (a₁ + aₙ)");
};

const geometrisch = (rng: Rng) => {
  const a1 = eins(rng, [1, 2, 3, 5, 64, 81]);
  const q = a1 >= 64 ? eins(rng, [0.5, -0.5]) : eins(rng, [2, 3, -2]);
  const n = ganz(rng, 3, a1 >= 64 ? 6 : 6);
  const an = a1 * q ** (n - 1);
  const art = ganz(rng, 0, 1);
  if (art === 0) return wahl(`Geometrische Folge: a₁ = ${a1}, q = ${zahl(q)}. a_${n} = ___`, zahl(an, 4), [zahl(a1 * q ** n, 4), zahl(a1 + (n - 1) * q, 4), zahl(a1 * q * (n - 1), 4)], "aₙ = a₁ · q^(n − 1)");
  return wahl(`${zahl(a1)}, ${zahl(a1 * q, 4)}, ${zahl(a1 * q * q, 4)}, … q = ___`, zahl(q), [zahl(a1 * q - a1, 4), zahl(1 / q, 4), zahl(-q)], "q = aₙ₊₁ : aₙ (Quotient zweier Nachbarn)");
};

const geoReihe = (rng: Rng) => {
  const a1 = eins(rng, [1, 2, 3, 4, 5]);
  const q = eins(rng, [2, 3]);
  const n = ganz(rng, 3, 6);
  const s = (a1 * (q ** n - 1)) / (q - 1);
  return wahl(`a₁ = ${a1}, q = ${q}: s_${n} = ___`, zahl(s), [zahl(a1 * q ** (n - 1)), zahl((a1 * (q ** (n + 1) - 1)) / (q - 1)), zahl(a1 * q ** n)], "sₙ = a₁ · (qⁿ − 1)/(q − 1)");
};

const unendlich = (rng: Rng) => {
  const a1 = eins(rng, [1, 2, 3, 4, 6, 8, 10, 12]);
  const q = eins(rng, [0.5, 0.25, -0.5, 0.2, 0.75]);
  const s = a1 / (1 - q);
  return wahl(`a₁ = ${a1}, q = ${zahl(q)}: Summe der unendlichen Reihe s = ___`, zahl(s, 3), [zahl(a1 / q, 3), zahl(a1 / (1 + q), 3), "unendlich"], "s = a₁/(1 − q), nur wenn der Betrag von q kleiner als 1 ist.");
};

const folgeDarstellung = (rng: Rng) => {
  const k = ganz(rng, 2, 5);
  const d = ganz(rng, -3, 4);
  const n = ganz(rng, 3, 9);
  if (rng() < 0.5) return wahl(`aₙ = ${lin(k, d, "n")}. a_${n} = ___`, zahl(k * n + d), [zahl(k * (n + 1) + d), zahl(k + n + d), zahl(k * n)], "n einsetzen.");
  const a1 = ganz(rng, 1, 5);
  return wahl(`a₁ = ${a1}, aₙ₊₁ = 2 · aₙ ${plusMinus(d || 1)}. a₃ = ___`, zahl(2 * (2 * a1 + (d || 1)) + (d || 1)), [zahl(2 * a1 + (d || 1)), zahl(a1 * 4), zahl(2 * (2 * a1 + (d || 1)))], "Rekursiv: Schritt für Schritt aus dem Vorgänger rechnen.");
};

export const MATHE_OBERSTUFE_ALGEBRA: QuizBank = {
  "mathe.os.zahlen.mengen": `Die Menge aller Elemente, die in A oder in B liegen, heißt ___ = Vereinigungsmenge A ∪ B | Schnittmenge A ∩ B | Differenzmenge A \\ B
Die Menge aller Elemente, die in A und in B liegen, heißt ___ = Schnittmenge A ∩ B | Vereinigungsmenge A ∪ B | Teilmenge A ⊂ B
A = {1; 2; 3}, B = {2; 3; 4}. A ∩ B = ___ = {2; 3} | {1; 2; 3; 4} | {1; 4}
A = {1; 2; 3}, B = {2; 3; 4}. A ∪ B = ___ = {1; 2; 3; 4} | {2; 3} | {1; 2; 2; 3; 3; 4}
A = {1; 2; 3}, B = {2; 3; 4}. A \\ B = ___ = {1} | {4} | {1; 4}
Das Zeichen ∈ bedeutet ___ = ist Element von | ist Teilmenge von | ist nicht Element von
Die leere Menge schreibt man ___ = { } | {0} | 0
Ist {2; 4} eine Teilmenge von {1; 2; 3; 4}? = ja | nein
A = {x ∈ ℕ ∣ x < 4} = ___ = {0; 1; 2; 3} | {1; 2; 3; 4} | {0; 1; 2; 3; 4}
Zwei Mengen ohne gemeinsames Element heißen ___ = disjunkt | gleich | leer
Wie viele Elemente hat {a; b; c} ∩ { }? = 0 | 3 | 1
# schwer
A ⊂ B bedeutet: jedes Element von A ist ___ = auch in B | nicht in B | genau einmal in B
Wie viele Teilmengen hat eine Menge mit 3 Elementen? = 8 | 6 | 3 | 9
(A ∪ B) ∩ A = ___ = A | B | A ∩ B`,
  "mathe.os.zahlen.zahlenmengen": `−3 liegt in ___, aber nicht in ℕ. = ℤ | ℕ | keiner Zahlenmenge
3/4 ist eine ___ = rationale Zahl | natürliche Zahl | ganze Zahl
√2 ist ___ = irrational | rational | ganzzahlig
π liegt in ___, aber nicht in ℚ. = ℝ | ℤ | ℕ
0,333… (periodisch) ist ___ = rational | irrational | ganzzahlig
Welche Zahlenmenge ist die kleinste? = ℕ | ℤ | ℚ | ℝ
ℕ ⊂ ℤ ⊂ ℚ ⊂ ___ = ℝ | ℕ | ℤ
√16 liegt in ___ = ℕ | nur in ℝ \\ ℚ | in keiner
Jede rationale Zahl lässt sich schreiben als ___ = Bruch ganzer Zahlen | Wurzel | Dezimalzahl ohne Ende und ohne Periode
Eine irrationale Zahl hat als Dezimalzahl ___ = unendlich viele Stellen ohne Periode | eine Periode | endlich viele Stellen
−7/1 ist ___ = ganzzahlig | irrational | keine Zahl
Ist 0 eine natürliche Zahl (in Österreich üblich)? = ja | nein
# schwer
√9/4 = 3/4 ist ___ = rational | irrational
Ist jede ganze Zahl auch rational? = ja | nein
0,1010010001… (ohne Periode) ist ___ = irrational | rational`,
  "mathe.os.zahlen.intervalle": `[2; 5] enthält ___ = 2 und 5 | weder 2 noch 5 | nur 2
]2; 5[ enthält ___ = keine der Grenzen | beide Grenzen | nur 5
Alle x mit −1 ≤ x < 3 als Intervall: ___ = [−1; 3[ | ]−1; 3] | [−1; 3]
Alle x größer als 4: ___ = ]4; ∞[ | [4; ∞[ | ]−∞; 4[
Bei ∞ steht die Klammer immer ___ = offen | geschlossen | eckig nach innen
Der Betrag von −7 ist ___ = 7 | −7 | 0
Der Betrag einer Zahl ist ihr Abstand ___ = von 0 | von 1 | vom Nachbarn
Wie viele Lösungen hat: Betrag von x = 5? = 2 | 1 | 0
Betrag von x < 2 heißt ___ = −2 < x < 2 | x < 2 | x < −2
Liegt 3 in ]1; 3[? = nein | ja
Liegt 1 in [1; 3[? = ja | nein
Länge des Intervalls [−2; 6]: ___ = 8 | 4 | 6
# schwer
Betrag von (x − 1) ≤ 3 als Intervall: ___ = [−2; 4] | [−3; 3] | [1; 4]
Abstand von −3 und 5 auf der Zahlengeraden: ___ = 8 | 2 | −8`,
  "mathe.os.zahlen.zahlensysteme": { text: `Das Dualsystem hat die Ziffern ___ = 0 und 1 | 1 und 2 | 0 bis 9
Die Stellenwerte im Dualsystem sind ___ = 1, 2, 4, 8, 16 … | 1, 10, 100 … | 1, 2, 3, 4 …
Das Hexadezimalsystem hat die Basis ___ = 16 | 6 | 12
Im Hexadezimalsystem steht A für ___ = 10 | 1 | 11
Ein Byte hat ___ Bit. = 8 | 10 | 16`, erzeuge: dual },
  "mathe.os.zahlen.gleitkomma": { text: `Nano bedeutet ___ = 10^(−9) | 10^(−6) | 10^9
Mikro (µ) bedeutet ___ = 10^(−6) | 10^(−3) | 10^(−9)
Mega bedeutet ___ = 10^6 | 10^3 | 10^9
Giga bedeutet ___ = 10^9 | 10^6 | 10^12
Milli bedeutet ___ = 10^(−3) | 10^(−2) | 10^3
In der Gleitkommadarstellung steht vor dem Komma ___ = genau eine Ziffer (nicht 0) | immer 0 | beliebig viele Ziffern`, erzeuge: gleitkomma },
  "mathe.os.zahlen.fehler": { text: `3,1416 auf zwei Nachkommastellen gerundet: ___ = 3,14 | 3,15 | 3,1
Absoluter Fehler = ___ = Näherungswert − wahrer Wert | Näherungswert : wahrer Wert | wahrer Wert · 100
Der relative Fehler wird meist angegeben in ___ = Prozent | Metern | Grad
Ein Ergebnis aus Messwerten mit 2 Nachkommastellen gibt man sinnvoll an mit ___ = etwa 2 Nachkommastellen | 8 Nachkommastellen | ganzen Zahlen
2,456 auf eine Nachkommastelle gerundet: ___ = 2,5 | 2,4 | 2,46`, erzeuge: fehler },
  "mathe.os.zahlen.fehlerfortpflanzung": `Bei einer Summe addieren sich ___ = die absoluten Fehler | die relativen Fehler | gar keine Fehler
Bei einem Produkt addieren sich näherungsweise ___ = die relativen Fehler | die absoluten Fehler | die Quadrate der Werte
a = 10 ± 0,1 und b = 5 ± 0,2. a + b = ___ = 15 ± 0,3 | 15 ± 0,1 | 15 ± 0,02
a = 10 ± 0,1 und b = 5 ± 0,2. a − b = ___ = 5 ± 0,3 | 5 ± 0,1 | 5 ± 0,02
a = 100 ± 1 % und b = 20 ± 2 %. a · b hat einen relativen Fehler von etwa ___ = 3 % | 2 % | 1 %
a = 100 ± 1 % und b = 20 ± 2 %. a : b hat einen relativen Fehler von etwa ___ = 3 % | 1 % | −1 %
Ein Quadrat mit Seite a ± 1 %: Fläche a² hat etwa ___ = ± 2 % | ± 1 % | ± 4 %
Ein Würfel mit Kante a ± 1 %: Volumen a³ hat etwa ___ = ± 3 % | ± 1 % | ± 9 %
Bei einer Differenz fast gleicher Werte wird der relative Fehler ___ = groß | klein | null
Der Maximalfehler ist ___ = die ungünstigste Abschätzung | der Mittelwert der Fehler | immer 0
Relativer Fehler = ___ = absoluter Fehler : Wert | Wert : absoluter Fehler | absoluter Fehler · Wert
Rechnet man mit gerundeten Werten weiter, wird das Ergebnis ___ = ungenauer | genauer | exakt`,
  "mathe.os.terme.faktorisieren": { text: `ax + ay = ___ = a · (x + y) | a · x · y | (a + x) · y
a² − b² = ___ = (a + b) · (a − b) | (a − b)² | a² − 2ab + b²
a² + 2ab + b² = ___ = (a + b)² | (a + b) · (a − b) | (a² + b²)
a² − 2ab + b² = ___ = (a − b)² | (a + b)² | (a − b) · (a + b)
Lässt sich x² + 9 mit reellen Zahlen faktorisieren? = nein | ja
4x² − 1 = ___ = (2x + 1) · (2x − 1) | (4x − 1)² | (2x − 1)²`, erzeuge: faktorisieren },
  "mathe.os.terme.bruchterme-kuerzen": `Definitionsmenge von 3/(x − 2): D = ___ = ℝ \\ {2} | ℝ \\ {−2} | ℝ \\ {3}
Definitionsmenge von x/(x + 5): D = ___ = ℝ \\ {−5} | ℝ \\ {5} | ℝ \\ {0}
Definitionsmenge von 1/(x² − 9): D = ___ = ℝ \\ {−3; 3} | ℝ \\ {3} | ℝ \\ {9}
Definitionsmenge von 2/(x · (x − 1)): D = ___ = ℝ \\ {0; 1} | ℝ \\ {1} | ℝ \\ {−1; 0}
(x² − 4)/(x − 2) gekürzt: ___ = x + 2 | x − 2 | x² − 2
(3x + 6)/3 gekürzt: ___ = x + 2 | x + 6 | 3x + 2
(x + 3)/(x + 5) gekürzt: ___ = nicht kürzbar | 3/5 | x/x
Kürzen darf man nur ___ = Faktoren | Summanden | Nenner
2x/(4x²) gekürzt: ___ = 1/(2x) | 2x | 1/2
(x² + 2x)/x gekürzt: ___ = x + 2 | x² + 2 | 2x
(a − b)/(b − a) = ___ = −1 | 1 | 0
Bevor man kürzt, muss man oft ___ = faktorisieren | ausmultiplizieren | quadrieren
# schwer
(x² − 6x + 9)/(x − 3) gekürzt: ___ = x − 3 | x + 3 | x − 9
(x² − 1)/(x² + 2x + 1) gekürzt: ___ = (x − 1)/(x + 1) | −1 | (x + 1)/(x − 1)`,
  "mathe.os.terme.bruchterme-rechnen": `1/x + 1/x = ___ = 2/x | 2/(2x) | 1/(2x)
1/x + 1/y = ___ = (x + y)/(xy) | 2/(x + y) | 1/(x + y)
a/b · c/d = ___ = (ac)/(bd) | (a + c)/(b + d) | (ad)/(bc)
a/b : c/d = ___ = (ad)/(bc) | (ac)/(bd) | (bc)/(ad)
2/x − 1/(2x) = ___ = 3/(2x) | 1/x | 1/(2x)
x/3 + x/6 = ___ = x/2 | 2x/9 | x/9
Der gemeinsame Nenner von 1/(x − 1) und 1/(x + 1) ist ___ = (x − 1) · (x + 1) | 2x | x² + 1
1/(x − 1) + 1/(x + 1) = ___ = 2x/(x² − 1) | 2/(x² − 1) | 2/(2x)
(x/2)² = ___ = x²/4 | x²/2 | x/4
3/x · x/6 = ___ = 1/2 | 3/6x | 18
1 − 1/x = ___ = (x − 1)/x | 0/x | 1/(x − 1)
(2/a) : 4 = ___ = 1/(2a) | 8/a | 2/(4a²)`,
  "mathe.os.potenzen.negativ": { text: `a^0 = ___ (a ≠ 0) = 1 | 0 | a
a^(−1) = ___ = 1/a | −a | a
10^(−3) = ___ = 0,001 | −1000 | 0,0001
(1/2)^(−2) = ___ = 4 | 1/4 | −4
x^(−2) · x^5 = ___ = x³ | x^(−10) | x^7
x^3 : x^5 = ___ = x^(−2) | x² | x^(8)`, erzeuge: negPotenz },
  "mathe.os.potenzen.rational": { text: `a^(1/2) = ___ = √a | a/2 | 1/a²
a^(1/3) = ___ = die 3. Wurzel aus a | a/3 | a³
√a · √a = ___ = a | 2√a | a²
√(a²) für a ≥ 0 = ___ = a | a² | 2a
(√a)³ = ___ = a^(3/2) | a^(2/3) | a^6`, erzeuge: ratPotenz },
  "mathe.os.potenzen.formeln": `A = r² · π nach r: r = ___ = √(A/π) | A/(2π) | √A · π
V = a³ nach a: a = ___ = die 3. Wurzel aus V | V/3 | √V
E = m · c² nach c: c = ___ = √(E/m) | E/(2m) | √E · m
a² + b² = c² nach a: a = ___ = √(c² − b²) | c − b | √c − √b
V = r² · π · h nach h: h = ___ = V/(r² · π) | V − r² · π | √(V/π)
A = a² nach a: a = ___ = √A | A/2 | A²
s = g/2 · t² nach t: t = ___ = √(2s/g) | 2s/g | √(s/(2g))
O = 6a² nach a: a = ___ = √(O/6) | O/6 | √O/36
Aus x² = c folgt für x > 0: ___ = x ＝ √c | x ＝ c/2 | x ＝ c²
V = 4/3 · r³ · π nach r³: r³ = ___ = 3V/(4π) | 4V/(3π) | V − 4π/3
Beim Wurzelziehen auf beiden Seiten muss jede Seite ___ = als Ganzes unter die Wurzel | einzeln je Summand | gar nicht
√(a² + b²) = a + b? = nein, im Allgemeinen nicht | ja, immer`,
  "mathe.os.gleichungen.quadratisch-einfach": { text: `x² = −4 hat in ℝ ___ = keine Lösung | zwei Lösungen | die Lösung −2
(x − 3)² = 0 hat die Lösung ___ = x ＝ 3 | x ＝ −3 | x ＝ ±3
(x − 2) · (x + 5) = 0. L = ___ = {−5; 2} | {2; 5} | {−2; 5}
x² = 0 hat ___ = genau eine Lösung | zwei Lösungen | keine Lösung
Bei x² − 5x = 0 durch x dividieren ist falsch, weil ___ = die Lösung 0 verloren geht | man nicht dividieren darf | es zu lange dauert`, erzeuge: quadEinfach },
  "mathe.os.gleichungen.loesungsformel": { text: `Die kleine Lösungsformel gilt für ___ = x² + px + q ＝ 0 | ax² + bx + c ＝ 0 mit a ≠ 1 | lineare Gleichungen
Bei 2x² + 8x − 10 = 0 teilt man zuerst ___ = durch 2 | durch 8 | durch x
Die große Lösungsformel: x = ___ = (−b ± √(b² − 4ac))/(2a) | (b ± √(b² − 4ac))/(2a) | −b ± √(b² − ac)`, erzeuge: loesungsformel },
  "mathe.os.gleichungen.loesungsfaelle": { text: `Die Diskriminante der großen Formel ist ___ = b² − 4ac | b² + 4ac | √(b − 4ac)
D < 0 bedeutet: die Parabel ___ = schneidet die x-Achse nicht | berührt die x-Achse | schneidet zweimal
D = 0 bedeutet: die Parabel ___ = berührt die x-Achse im Scheitel | schneidet die x-Achse zweimal | hat keinen Scheitel`, erzeuge: diskriminante },
  "mathe.os.gleichungen.vieta": { text: `Satz von Vieta für x² + px + q = 0: x₁ + x₂ = ___ = −p | p | q
Satz von Vieta für x² + px + q = 0: x₁ · x₂ = ___ = q | −q | p`, erzeuge: vieta },
  "mathe.os.gleichungen.quadratisch-text": `Ein Quadrat hat 49 cm² Fläche. Seite a = ___ = 7 cm | 12,25 cm | 24,5 cm
Ein Rechteck: Länge 3 cm mehr als die Breite, Fläche 40 cm². Breite = ___ = 5 cm | 8 cm | 4 cm
Das Produkt zweier aufeinanderfolgender natürlicher Zahlen ist 56. Die kleinere: ___ = 7 | 8 | 6
Eine Zahl und ihr Quadrat ergeben zusammen 30 (Zahl positiv): ___ = 5 | 6 | 15
Ein Ball: h(t) = 20t − 5t². Wann ist er wieder am Boden (h = 0)? = nach 4 s | nach 2 s | nach 20 s
Ein Ball: h(t) = 20t − 5t². Größte Höhe bei t = ___ = 2 s | 4 s | 1 s
Ein Ball: h(t) = 20t − 5t². Größte Höhe: ___ = 20 m | 40 m | 15 m
Bei Textaufgaben fällt eine Lösung oft weg, weil ___ = sie negativ ist und nicht passt | sie zu klein ist | man sie nicht ausrechnen kann
Fläche eines Rechtecks 24 m², Umfang 20 m. Seiten: ___ = 4 m und 6 m | 3 m und 8 m | 2 m und 12 m
Ein Quadrat wird um 2 cm verlängert, die Fläche ist dann 64 cm². Alte Seite: ___ = 6 cm | 8 cm | 4 cm
Die Diagonale eines Quadrats ist 10 cm. Seite (gerundet): ___ = 7,07 cm | 5 cm | 10 cm
Die Summe der Quadrate von 3 und x ist 25 (x > 0). x = ___ = 4 | 22 | 16`,
  "mathe.os.gleichungen.bruchgleichungen": `Bei Bruchgleichungen zuerst ___ = die Definitionsmenge bestimmen | quadrieren | durch x dividieren
3/x = 6. x = ___ = 1/2 | 2 | 18
6/(x − 1) = 3. x = ___ = 3 | 2 | 1
x/(x − 2) = 2/(x − 2): Ist x = 2 eine Lösung? = nein, 2 ist nicht in D | ja
x/(x − 2) = 2/(x − 2). L = ___ = { } | {2} | {0}
1/x + 1/(2x) = 3/4. x = ___ = 2 | 1 | 4
Man multipliziert die Gleichung mit ___ = dem gemeinsamen Nenner | dem Zähler | x²
4/(x + 1) = 2/(x − 1). x = ___ = 3 | 1 | −3
Nach dem Multiplizieren muss man prüfen, ob die Lösung ___ = in der Definitionsmenge liegt | ganzzahlig ist | positiv ist
(x + 2)/x = 3. x = ___ = 1 | 2 | 3
5/(2x) = 1/2. x = ___ = 5 | 1/5 | 10
x/4 = 9/x (x > 0). x = ___ = 6 | 9/4 | 36`,
  "mathe.os.gleichungen.polynom": { text: `Eine Polynomgleichung 3. Grades hat höchstens ___ reelle Lösungen. = 3 | 2 | unendlich viele
Bei x⁴ − 5x² + 4 = 0 hilft die Substitution ___ = u ＝ x² | u ＝ x⁴ | u ＝ 5x
x³ = 8. x = ___ = 2 | ±2 | 8/3
x³ − x² = 0. L = ___ = {0; 1} | {1} | {0; −1; 1}`, erzeuge: polynomGl },
  "mathe.os.gleichungen.polynomdivision": `Ist x = 1 Nullstelle von x³ − 1? = ja | nein
Ist x = a eine Nullstelle von p(x), so ist p(x) durch ___ teilbar. = (x − a) | (x + a) | x
(x² − 5x + 6) : (x − 2) = ___ = x − 3 | x + 3 | x − 2
(x³ − 1) : (x − 1) = ___ = x² + x + 1 | x² − 1 | x² + 1
(x² − 9) : (x + 3) = ___ = x − 3 | x + 3 | x² − 3
(x³ − 6x² + 11x − 6) : (x − 1) = ___ = x² − 5x + 6 | x² − 6x + 11 | x² + 5x − 6
Nullstellen von x³ − 6x² + 11x − 6: ___ = 1, 2 und 3 | −1, −2 und −3 | 1 und 6
Eine ganzzahlige Nullstelle von x³ + … + 6 ist ein Teiler von ___ = 6 | 1 | 3
(2x² + 3x − 2) : (x + 2) = ___ = 2x − 1 | 2x + 1 | x − 2
Bei der Polynomdivision ohne Rest ist der Rest ___ = 0 | 1 | der Divisor
(x³ + x² − x − 1) : (x − 1) = ___ = x² + 2x + 1 | x² + 1 | x² − 2x + 1
Ist x = −1 Nullstelle von x³ + 1? = ja | nein`,
  "mathe.os.ungleichungen.linear": { text: `−2x < 6 ergibt ___ = x > −3 | x < −3 | x > 3
Die Lösung einer linearen Ungleichung ist meist ___ = ein Intervall | eine Zahl | leer
x ≥ 2 als Intervall: ___ = [2; ∞[ | ]2; ∞[ | ]−∞; 2]`, erzeuge: ungleichung },
  "mathe.os.ungleichungen.fall": `Bei 1/x > 2 unterscheidet man die Fälle ___ = x > 0 und x < 0 | x > 2 und x < 2 | x ＝ 0 und x ≠ 0
Multipliziert man mit x und x < 0, dann ___ = dreht sich das Zeichen um | bleibt das Zeichen | wird es ＝
1/x > 2. L = ___ = ]0; 1/2[ | ]1/2; ∞[ | ]−∞; 1/2[
x² < 9. L = ___ = ]−3; 3[ | ]−∞; 3[ | ]3; ∞[
x² > 4. L = ___ = ]−∞; −2[ ∪ ]2; ∞[ | ]−2; 2[ | ]2; ∞[
(x − 1) · (x + 2) < 0. L = ___ = ]−2; 1[ | ]−∞; −2[ | ]1; ∞[
Ein Produkt ist negativ, wenn ___ = die Faktoren verschiedene Vorzeichen haben | beide Faktoren negativ sind | ein Faktor 0 ist
Betrag von (x − 2) < 1. L = ___ = ]1; 3[ | ]−1; 3[ | ]2; 3[
Betrag von x ≥ 3. L = ___ = ]−∞; −3] ∪ [3; ∞[ | [−3; 3] | [3; ∞[
x/(x − 1) > 0 gilt für ___ = x < 0 oder x > 1 | 0 < x < 1 | x > 1
Fallunterscheidung braucht man bei Ungleichungen mit ___ = Variablen im Nenner oder Beträgen | nur Zahlen | ganzen Zahlen
Die Lösungsmenge setzt sich aus ___ der Fälle zusammen. = der Vereinigung | dem Schnitt | dem Produkt`,
  "mathe.os.gleichungssysteme.drei": `Ein lineares Gleichungssystem mit 3 Variablen braucht meist ___ Gleichungen. = 3 | 2 | 1
x + y + z = 6, y = 2, z = 3. x = ___ = 1 | 6 | 5
x + y = 5, y + z = 7, z = 4. x = ___ = 2 | 3 | 4
Beim Gauß-Verfahren macht man das System zu ___ = einer Stufenform | einem Quadrat | einer Gleichung
Zwei Gleichungen widersprechen sich (z. B. 0 = 5): das System hat ___ = keine Lösung | unendlich viele Lösungen | genau eine Lösung
Ergibt sich 0 = 0 und zu wenig Gleichungen: ___ = unendlich viele Lösungen | keine Lösung | genau eine Lösung
x + y + z = 3, x − y = 0, z = 1. x = ___ = 1 | 2 | 0
Geometrisch ist eine Gleichung mit x, y, z ___ = eine Ebene im Raum | eine Gerade | ein Punkt
Haben drei Ebenen genau einen gemeinsamen Punkt, hat das System ___ = genau eine Lösung | keine Lösung | unendlich viele
2x = 4, x + y = 5, x + y + z = 10. z = ___ = 5 | 3 | 2
Die Lösung (x ∣ y ∣ z) gibt man an als ___ = Zahlentripel | Zahlenpaar | eine Zahl
Ein Gleichungssystem löst man mit Technologie oft mit ___ = Matrizen | Diagrammen | Winkeln`,
  "mathe.os.funktionen.definitionsmenge": `Definitionsmenge von f(x) = √x: ___ = [0; ∞[ | ℝ | ]0; ∞[
Definitionsmenge von f(x) = 1/x: ___ = ℝ \\ {0} | ℝ | [0; ∞[
Definitionsmenge von f(x) = x²: ___ = ℝ | [0; ∞[ | ℝ \\ {0}
Wertemenge von f(x) = x²: ___ = [0; ∞[ | ℝ | ]0; ∞[
Wertemenge von f(x) = x² + 3: ___ = [3; ∞[ | [0; ∞[ | ℝ
Definitionsmenge von f(x) = √(x − 2): ___ = [2; ∞[ | ]2; ∞[ | [−2; ∞[
Definitionsmenge von f(x) = 1/(x + 4): ___ = ℝ \\ {−4} | ℝ \\ {4} | ℝ
Wertemenge von f(x) = −x²: ___ = ]−∞; 0] | [0; ∞[ | ℝ
Die Definitionsmenge sind alle ___ = x-Werte, die man einsetzen darf | y-Werte, die herauskommen | Nullstellen
Die Wertemenge sind alle ___ = y-Werte, die herauskommen | x-Werte, die man einsetzen darf | Schnittpunkte
Definitionsmenge von f(x) = ln(x): ___ = ]0; ∞[ | [0; ∞[ | ℝ
Wertemenge von f(x) = 2^x: ___ = ]0; ∞[ | ℝ | [0; ∞[`,
  "mathe.os.funktionen.eigenschaften": `Eine Nullstelle ist ein x mit ___ = f(x) ＝ 0 | f(0) ＝ x | f(x) ＝ x
Streng monoton steigend heißt: aus x₁ < x₂ folgt ___ = f(x₁) < f(x₂) | f(x₁) > f(x₂) | f(x₁) ＝ f(x₂)
Ein Hochpunkt ist eine ___ = lokale Maximumstelle | Nullstelle | Wendestelle
Der Schnittpunkt mit der y-Achse ist ___ = (0 ∣ f(0)) | (f(0) ∣ 0) | (0 ∣ 0)
f(x) = 2x − 4 hat die Nullstelle ___ = 2 | −4 | 4
f(x) = −3x + 1 ist ___ = streng monoton fallend | streng monoton steigend | konstant
f(x) = x² ist auf ]−∞; 0] ___ = monoton fallend | monoton steigend | konstant
f(x) = x² hat bei x = 0 einen ___ = Tiefpunkt | Hochpunkt | Wendepunkt
Wie viele Nullstellen hat f(x) = x² + 1? = keine | eine | zwei
f(x) = (x − 1) · (x + 3) hat die Nullstellen ___ = 1 und −3 | −1 und 3 | 1 und 3
Ein globales Maximum ist ___ = der größte Funktionswert überhaupt | jeder Hochpunkt | die größte Nullstelle
Eine Funktion ordnet jedem x ___ = genau einen y-Wert zu | mehrere y-Werte zu | keinen Wert zu`,
  "mathe.os.funktionen.quadratisch": { text: `In f(x) = a · (x − d)² + e ist der Scheitel ___ = (d ∣ e) | (−d ∣ e) | (e ∣ d)
f(x) = x² + c: c verschiebt die Parabel ___ = nach oben oder unten | nach links oder rechts | gar nicht
f(x) = (x − 3)² ist gegenüber x² verschoben um 3 nach ___ = rechts | links | oben
f(x) = ax² + bx + c schneidet die y-Achse bei ___ = c | b | a`, erzeuge: parabelParameter },
  "mathe.os.funktionen.scheitel": { text: `Scheitel von f(x) = (x − 2)² + 5: ___ = (2 ∣ 5) | (−2 ∣ 5) | (5 ∣ 2)
Scheitel von f(x) = −(x + 1)² + 4: ___ = (−1 ∣ 4) | (1 ∣ 4) | (−1 ∣ −4)
Die x-Koordinate des Scheitels von ax² + bx + c: ___ = −b/(2a) | b/(2a) | −c/a`, erzeuge: scheitel },
  "mathe.os.funktionen.quadratisch-aufstellen": `Für eine quadratische Funktion braucht man ___ Punkte. = 3 | 2 | 4
Kennt man den Scheitel S, braucht man noch ___ = einen Punkt | zwei Punkte | keinen Punkt
Scheitel (0 ∣ 0), Punkt (2 ∣ 8): f(x) = ___ = 2x² | 4x² | 8x²
Scheitel (0 ∣ 1), Punkt (1 ∣ 3): f(x) = ___ = 2x² + 1 | 3x² + 1 | x² + 2
Scheitel (2 ∣ 0), Punkt (0 ∣ 4): f(x) = ___ = (x − 2)² | (x + 2)² | 2(x − 2)²
Nullstellen 1 und 5, nach oben offen mit a = 1: f(x) = ___ = (x − 1) · (x − 5) | (x + 1) · (x + 5) | x² − 5
Nullstellen −2 und 2, Punkt (0 ∣ −4): f(x) = ___ = x² − 4 | −x² + 4 | x² + 4
f(0) = 3 bei f(x) = ax² + bx + c bedeutet ___ = c ＝ 3 | a ＝ 3 | b ＝ 3
Drei Punkte ergeben ein Gleichungssystem mit ___ Variablen. = 3 | 2 | 1
Symmetrisch zur y-Achse heißt bei ax² + bx + c: ___ = b ＝ 0 | c ＝ 0 | a ＝ 0
Scheitel (1 ∣ 2), Punkt (2 ∣ 5): a = ___ = 3 | 5 | 2
Scheitel (0 ∣ 5), Punkt (1 ∣ 4): a = ___ = −1 | 1 | 4`,
  "mathe.os.funktionen.quadratisch-sach": `Brücke: h(x) = −0,01x² + 20 (in m). Höhe in der Mitte: ___ = 20 m | 0,01 m | 10 m
Wurf: h(t) = −5t² + 10t + 2. Abwurfhöhe: ___ = 2 m | 10 m | 7 m
Wurf: h(t) = −5t² + 10t + 2. Höchster Punkt bei t = ___ = 1 s | 2 s | 0,5 s
Wurf: h(t) = −5t² + 10t + 2. Größte Höhe: ___ = 7 m | 12 m | 2 m
Ein Rechteck mit Umfang 20 cm hat die größte Fläche, wenn es ___ ist. = ein Quadrat | doppelt so lang wie breit | sehr schmal
Größte Fläche eines Rechtecks mit Umfang 20 cm: ___ = 25 cm² | 20 cm² | 100 cm²
Die Nullstellen einer Wurfparabel sind ___ = Abwurf- und Landestelle | der höchste Punkt | die Geschwindigkeit
Gewinn G(x) = −x² + 40x − 300. Bei welcher Menge ist der Gewinn am größten? = 20 | 40 | 300
Gewinn G(x) = −x² + 40x − 300. Größter Gewinn: ___ = 100 | 400 | 300
Bremsweg s = v²/100 (v in km/h, s in m). Bei 50 km/h: ___ = 25 m | 50 m | 2,5 m
Bremsweg s = v²/100. Doppelte Geschwindigkeit → ___ Bremsweg. = vierfacher | doppelter | halber
Der Scheitel einer nach unten offenen Parabel ist ___ = der höchste Punkt | der tiefste Punkt | eine Nullstelle`,
  "mathe.os.funktionen.potenz": `f(x) = x³ ist ___ = punktsymmetrisch zum Ursprung | symmetrisch zur y-Achse | nicht symmetrisch
f(x) = x⁴ ist ___ = symmetrisch zur y-Achse | punktsymmetrisch | nicht symmetrisch
f(x) = 1/x heißt ___ = Hyperbel | Parabel | Gerade
f(x) = 1/x hat bei x = 0 ___ = eine Polstelle | eine Nullstelle | einen Hochpunkt
f(x) = √x ist die Umkehrfunktion von x² für ___ = x ≥ 0 | alle x | x < 0
Alle Graphen von f(x) = xⁿ gehen durch ___ = (1 ∣ 1) | (0 ∣ 1) | (1 ∣ 0)
f(x) = 1/x² ist für x > 0 ___ = fallend | steigend | konstant
Die Asymptoten von f(x) = 1/x sind ___ = die beiden Achsen | y ＝ x | keine
f(x) = a/x mit a > 0 liegt im ___ = 1. und 3. Quadranten | 2. und 4. Quadranten | nur im 1. Quadranten
Indirekte Proportionalität passt zu ___ = f(x) ＝ a/x | f(x) ＝ ax | f(x) ＝ x²
f(4) bei f(x) = √x: ___ = 2 | 16 | 8
f(2) bei f(x) = x³: ___ = 8 | 6 | 9`,
  "mathe.os.funktionen.abschnittsweise": `Eine abschnittsweise definierte Funktion hat ___ = verschiedene Terme in verschiedenen Bereichen | keinen Term | nur Sprünge
f(x) = x für x < 0, f(x) = x² für x ≥ 0. f(−3) = ___ = −3 | 9 | 0
f(x) = x für x < 0, f(x) = x² für x ≥ 0. f(3) = ___ = 9 | 3 | −3
f(x) = x für x < 0, f(x) = x² für x ≥ 0. f(0) = ___ = 0 | 1 | nicht definiert
Die Betragsfunktion ist für x < 0 gleich ___ = −x | x | 0
Ein Handytarif: 10 € bis 1 GB, dann 5 € je GB. Das ist eine ___ Funktion. = abschnittsweise definierte | quadratische | konstante
Ein Sprung im Graphen heißt: die Funktion ist dort ___ = unstetig | stetig | null
Paket: bis 2 kg 5 €, bis 5 kg 8 €, bis 10 kg 12 €. Ein 4-kg-Paket kostet ___ = 8 € | 5 € | 12 €
Paket: bis 2 kg 5 €, bis 5 kg 8 €, bis 10 kg 12 €. Ein 2-kg-Paket kostet ___ = 5 € | 8 € | 7 €
Solche Treppen-Funktionen heißen ___ = Treppenfunktionen | Parabeln | Polynome
f(x) = 2 für x ≤ 1, f(x) = x + 1 für x > 1. Ist f bei 1 stetig? = ja | nein
f(x) = 0 für x < 0, f(x) = 1 für x ≥ 0. Ist f bei 0 stetig? = nein | ja`,
  "mathe.os.funktionen.umkehr": { text: `Den Graph der Umkehrfunktion bekommt man durch Spiegeln an ___ = der Geraden y ＝ x | der x-Achse | der y-Achse
Eine Umkehrfunktion gibt es nur, wenn f ___ = umkehrbar eindeutig ist | eine Nullstelle hat | quadratisch ist
Umkehrfunktion von f(x) = x³: ___ = die 3. Wurzel aus x | 1/x³ | x/3
Umkehrfunktion von f(x) = 2^x: ___ = log₂(x) | x/2 | x²`, erzeuge: umkehr },
  "mathe.os.funktionen.symmetrie": { text: `Gerade Funktion: f(−x) = ___ = f(x) | −f(x) | 0
Ungerade Funktion: f(−x) = ___ = −f(x) | f(x) | 1/f(x)
Eine gerade Funktion ist symmetrisch zur ___ = y-Achse | x-Achse | Geraden y ＝ x`, erzeuge: symmetrie },
  "mathe.os.funktionen.polynom": `Der Grad von f(x) = 2x⁵ − x² + 1 ist ___ = 5 | 2 | 3
Eine Polynomfunktion vom Grad 3 hat höchstens ___ Nullstellen. = 3 | 2 | 4
Eine Polynomfunktion vom Grad 3 hat mindestens ___ Nullstelle. = 1 | 0 | 3
Eine Polynomfunktion vom Grad 4 hat höchstens ___ Extremstellen. = 3 | 4 | 2
f(x) = x³: für x → ∞ geht f(x) gegen ___ = ∞ | −∞ | 0
f(x) = −x⁴: für x → ∞ geht f(x) gegen ___ = −∞ | ∞ | 0
Der Leitkoeffizient von 3x⁴ − x + 7 ist ___ = 3 | 7 | 4
f(x) = (x − 1)² · (x + 2): bei x = 1 ___ = berührt der Graph die x-Achse | schneidet er die x-Achse | gibt es einen Pol
f(x) = x · (x − 2) · (x + 3) hat die Nullstellen ___ = 0, 2 und −3 | 0, −2 und 3 | 2 und −3
Ein Polynom vom Grad 3 hat höchstens ___ Wendestelle(n). = 1 | 2 | 3
f(0) bei f(x) = x³ − 4x + 5: ___ = 5 | 0 | −4
Eine Polynomfunktion ist überall ___ = stetig | positiv | steigend`,
  "mathe.os.funktionen.verschieben": { text: `g(x) = 2 · f(x) streckt den Graphen ___ = in y-Richtung mit Faktor 2 | in x-Richtung mit Faktor 2 | nach oben um 2
g(x) = f(−x) spiegelt den Graphen an der ___ = y-Achse | x-Achse | Geraden y ＝ x
g(x) = f(x) + 3 verschiebt den Graphen ___ = um 3 nach oben | um 3 nach rechts | um 3 nach links`, erzeuge: verschieben },
  "mathe.os.funktionen.verkettung": { text: `f(g(x)) bedeutet: zuerst ___ = g, dann f | f, dann g | f mal g
f(x) = √x, g(x) = x + 1. f(g(x)) = ___ = √(x + 1) | √x + 1 | √x · (x + 1)
f(x) = 2x, g(x) = x². g(f(x)) = ___ = 4x² | 2x² | 2x + x²
In sin(3x) ist die innere Funktion ___ = 3x | sin(x) | 3`, erzeuge: verkettung },
  "mathe.os.log.begriff": { text: `log_a(b) = c bedeutet ___ = a^c ＝ b | c^a ＝ b | b^c ＝ a
log(x) ohne Basis meint in der Schule ___ = log₁₀(x) | ln(x) | log₂(x)
ln(x) ist der Logarithmus zur Basis ___ = e | 10 | 2
log_a(1) = ___ = 0 | 1 | a
log_a(a) = ___ = 1 | 0 | a
log(0) ist ___ = nicht definiert | 0 | 1`, erzeuge: logBegriff },
  "mathe.os.log.regeln": `log(a · b) = ___ = log(a) + log(b) | log(a) · log(b) | log(a + b)
log(a/b) = ___ = log(a) − log(b) | log(a)/log(b) | log(a − b)
log(aⁿ) = ___ = n · log(a) | log(a)ⁿ | log(n · a)
log(2) + log(5) = ___ = 1 | log(7) | 10
log(1000) − log(10) = ___ = 2 | 3 | log(990)
log(100³) = ___ = 6 | 300 | 5
log₂(8) + log₂(4) = ___ = 5 | 12 | 32
log₂(32) − log₂(4) = ___ = 3 | 28 | 8
log(√10) = ___ = 1/2 | 5 | √1
ln(e⁵) = ___ = 5 | e | 5e
log(a + b) = log(a) + log(b)? = nein, das gilt nicht | ja
3 · log(2) = ___ = log(8) | log(6) | log(5)
# schwer
log_a(x) = log(x)/log(a) heißt ___ = Basiswechsel | Produktregel | Potenzregel
2 · log(x) − log(x²) = ___ = 0 | log(x) | 2`,
  "mathe.os.log.exponentialgleichungen": { text: `10^x = 1000. x = ___ = 3 | 100 | 30
e^x = 1. x = ___ = 0 | 1 | e
2^x = 1/8. x = ___ = −3 | 3 | 1/3
Bei aˣ = c mit c ≤ 0 gibt es ___ = keine Lösung | genau eine Lösung | zwei Lösungen`, erzeuge: exponentialGl },
  "mathe.os.log.funktion": `Die Logarithmusfunktion ist die Umkehrfunktion der ___ = Exponentialfunktion | Potenzfunktion | Sinusfunktion
f(x) = log₂(x) geht durch ___ = (1 ∣ 0) | (0 ∣ 1) | (0 ∣ 0)
f(x) = log(x) ist definiert für ___ = x > 0 | alle x | x ≥ 0
f(x) = ln(x) für x → 0⁺ geht gegen ___ = −∞ | 0 | ∞
f(x) = log₂(x) ist ___ = streng monoton steigend | fallend | konstant
f(x) = log(x) hat bei x = 10 den Wert ___ = 1 | 10 | 0
Die y-Achse ist für f(x) = ln(x) ___ = eine Asymptote | eine Symmetrieachse | eine Tangente
f(x) = ln(x) und g(x) = eˣ liegen symmetrisch zu ___ = y ＝ x | der x-Achse | der y-Achse
log₂(16) = ___ = 4 | 8 | 2
f(x) = log₂(x): f(1/2) = ___ = −1 | 1/4 | 2
Wächst f(x) = log(x) schnell oder langsam? = sehr langsam | sehr schnell | gar nicht
Wie viele Nullstellen hat f(x) = ln(x)? = eine | keine | zwei`,
  "mathe.os.wachstum.exponentialfunktion": { text: `Bei f(x) = c · aˣ ist c ___ = der Anfangswert f(0) | der Wachstumsfaktor | die Nullstelle
f(x) = c · aˣ mit 0 < a < 1 beschreibt ___ = eine Abnahme | eine Zunahme | eine Konstante
f(x) = 3 · 2ˣ schneidet die y-Achse bei ___ = 3 | 2 | 6
Hat f(x) = c · aˣ (c > 0) eine Nullstelle? = nein | ja
Die x-Achse ist für f(x) = 2ˣ ___ = eine Asymptote | eine Symmetrieachse | eine Tangente`, erzeuge: exponentialWert },
  "mathe.os.wachstum.exponentiell": { text: `Ein Guthaben wächst jedes Jahr um 3 %. Das ist ___ = exponentielles Wachstum | lineares Wachstum | keine Änderung
Wachstumsfaktor 0,9 bedeutet ___ = 10 % Abnahme | 90 % Abnahme | 9 % Zunahme
Wachstumsfaktor 1,25 bedeutet ___ = 25 % Zunahme | 125 % Zunahme | 1,25 % Zunahme`, erzeuge: prozentFaktor },
  "mathe.os.wachstum.halbwertszeit": { text: `Die Halbwertszeit ist die Zeit, bis ___ = nur noch die Hälfte da ist | alles weg ist | sich alles verdoppelt
Nach zwei Halbwertszeiten ist noch ___ da. = ein Viertel | die Hälfte | nichts
Die Verdopplungszeit bei a = 2 pro Jahr ist ___ = 1 Jahr | 2 Jahre | 1/2 Jahr`, erzeuge: halbwert },
  "mathe.os.wachstum.basis-e": `Die Euler’sche Zahl e ist ungefähr ___ = 2,718 | 3,142 | 1,414
f(t) = c · e^(λt) mit λ > 0 beschreibt ___ = Wachstum | Abnahme | Schwingung
f(t) = c · e^(−λt) mit λ > 0 beschreibt ___ = Abnahme | Wachstum | eine Gerade
e^0 = ___ = 1 | 0 | e
e^(λt) = aᵗ bedeutet a = ___ = e^λ | λ | ln(λ)
λ = ln(a) für a = e²: λ = ___ = 2 | e | 1
f(t) = 100 · e^(0,05t): Anfangswert ___ = 100 | 0,05 | e
Die Ableitung von e^x ist ___ = e^x | x · e^(x − 1) | 1
ln(e) = ___ = 1 | 0 | e
Halbwertszeit bei e^(−λt): T = ___ = ln(2)/λ | λ/2 | 2λ
Verdopplungszeit bei e^(λt): T = ___ = ln(2)/λ | 2/λ | λ · ln(2)
Wächst e^x schneller als jede Potenz xⁿ? = ja, irgendwann | nein`,
  "mathe.os.wachstum.vergleich": { text: `Lineares Wachstum: pro Schritt kommt ___ dazu. = immer gleich viel | immer der gleiche Prozentsatz | immer mehr
Exponentielles Wachstum: pro Schritt wird ___ = mit dem gleichen Faktor multipliziert | gleich viel addiert | nichts geändert
Langfristig wächst ___ schneller. = exponentiell | linear | beides gleich`, erzeuge: modellVergleich },
  "mathe.os.wachstum.beschraenkt": `Beschränktes Wachstum nähert sich ___ = einer Schranke S | null | unendlich
Beim beschränkten Wachstum ist die Zunahme proportional zu ___ = S − f(t) | f(t) | t
Beim logistischen Wachstum ist der Graph ___ = S-förmig | eine Gerade | eine Parabel
Logistisches Wachstum ist am Anfang fast ___ = exponentiell | linear | konstant
Beim logistischen Wachstum ist die Zunahme am größten bei ___ = S/2 | S | 0
Eine heiße Tasse kühlt auf Raumtemperatur ab. Das ist ___ = beschränkte Abnahme | lineare Abnahme | logistisches Wachstum
Die Ausbreitung einer Krankheit in einer Stadt passt zu ___ = logistischem Wachstum | linearem Wachstum | konstantem Wert
f(t) = 100 − 80 · 0,9ᵗ: Schranke S = ___ = 100 | 80 | 0,9
f(t) = 100 − 80 · 0,9ᵗ: Anfangswert f(0) = ___ = 20 | 100 | 80
Die Schranke heißt auch ___ = Sättigungsgrenze | Halbwertszeit | Wachstumsfaktor
Kann beschränktes Wachstum die Schranke überschreiten (Start darunter)? = nein | ja
Ein Wendepunkt ist typisch für ___ = logistisches Wachstum | beschränktes Wachstum | lineares Wachstum`,
  "mathe.os.folgen.darstellung": { text: `Eine explizite Darstellung berechnet aₙ ___ = direkt aus n | aus dem Vorgänger | aus der Summe
Eine rekursive Darstellung berechnet aₙ₊₁ ___ = aus aₙ | direkt aus n | gar nicht
Bei einer rekursiven Darstellung braucht man noch ___ = einen Startwert | eine Summe | einen Grenzwert`, erzeuge: folgeDarstellung },
  "mathe.os.folgen.arithmetisch": { text: `Bei einer arithmetischen Folge ist ___ konstant. = die Differenz zweier Nachbarn | der Quotient | die Summe
3, 7, 11, 15, … d = ___ = 4 | 3 | 11/7
Eine arithmetische Folge hat als Graph ___ = Punkte auf einer Geraden | eine Parabel | eine Kurve`, erzeuge: arithmetisch },
  "mathe.os.folgen.geometrisch": { text: `Bei einer geometrischen Folge ist ___ konstant. = der Quotient zweier Nachbarn | die Differenz | die Summe
q < 0 bei einer geometrischen Folge bedeutet: die Glieder ___ = wechseln das Vorzeichen | werden immer größer | sind gleich`, erzeuge: geometrisch },
  "mathe.os.folgen.grenzwert": `aₙ = 1/n geht für n → ∞ gegen ___ = 0 | 1 | ∞
aₙ = (n + 1)/n geht gegen ___ = 1 | 0 | 2
aₙ = 2n hat ___ = keinen Grenzwert | den Grenzwert 2 | den Grenzwert 0
aₙ = (−1)ⁿ ist ___ = divergent | konvergent gegen 1 | konvergent gegen 0
Eine Folge mit Grenzwert heißt ___ = konvergent | divergent | alternierend
Eine Folge mit Grenzwert 0 heißt ___ = Nullfolge | Einsfolge | Grenzfolge
aₙ = 1/n ist ___ = streng monoton fallend | steigend | konstant
Eine obere Schranke ist eine Zahl, die ___ = kein Glied überschreitet | jedes Glied überschreitet | das erste Glied ist
aₙ = 3 + 1/n hat den Grenzwert ___ = 3 | 4 | 1/3
aₙ = (2n + 1)/(n + 5) geht gegen ___ = 2 | 1/5 | 1
aₙ = 0,5ⁿ geht gegen ___ = 0 | 0,5 | 1
Monoton und beschränkt heißt ___ = konvergent | divergent | unbeschränkt
# schwer
aₙ = (3n² + 1)/(n² − 2) geht gegen ___ = 3 | 1/2 | ∞
aₙ = n/(n² + 1) geht gegen ___ = 0 | 1 | ∞`,
  "mathe.os.folgen.arithmetische-reihe": { text: `1 + 2 + 3 + … + 100 = ___ = 5050 | 5000 | 10 100
Die Summe der ersten n natürlichen Zahlen ist ___ = n · (n + 1)/2 | n²/2 | n · (n − 1)
2 + 4 + 6 + … + 20 = ___ = 110 | 100 | 220`, erzeuge: arithmetisch },
  "mathe.os.folgen.geometrische-reihe": { text: `Die Summe sₙ einer geometrischen Reihe ist ___ = a₁ · (qⁿ − 1)/(q − 1) | n · a₁ · q | a₁/(1 − q)
1 + 2 + 4 + 8 + 16 = ___ = 31 | 32 | 30
Ratensparen mit gleichen Einzahlungen und Zinsen führt auf ___ = eine geometrische Reihe | eine arithmetische Reihe | keine Reihe`, erzeuge: geoReihe },
  "mathe.os.folgen.unendlich": { text: `Eine unendliche geometrische Reihe konvergiert nur, wenn ___ = der Betrag von q kleiner als 1 ist | q größer als 1 ist | q ＝ 1 ist
1 + 1/2 + 1/4 + 1/8 + … = ___ = 2 | 1 | unendlich
0,999… (periodisch) = ___ = 1 | etwas weniger als 1 | 0,9`, erzeuge: unendlich },
};
