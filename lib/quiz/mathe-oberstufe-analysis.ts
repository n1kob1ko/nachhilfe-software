/**
 * Mathe-Quiz Oberstufe, Differential- und Integralrechnung, Differentialgleichungen, Kosten- und Preistheorie (HAK)
 * und Finanzmathematik (HAK): Begriffe als Text, Ableitungen, Integrale und Zinsen mit Erzeugern (falsche Antworten =
 * typische Fehler: Hochzahl nicht verringert, Konstante beim Ableiten behalten, +1 beim Integrieren vergessen,
 * einfache statt Zinseszinsen …). Format: lib/lernspiele-quiz.ts.
 */
import type { QuizBank } from "../lernspiele-quiz";
import { eins, euro, ganz, plusMinus, runde, wahl, zahl, type Rng } from "./hilfen";

/** Ein Polynom aus Beiwerten [a_n, …, a_0] als Text: „3x² − 2x + 1“. */
function poly(k: number[], x = "x"): string {
  const n = k.length - 1;
  const teile: string[] = [];
  k.forEach((a, i) => {
    if (!a) return;
    const e = n - i;
    const v = e === 0 ? "" : e === 1 ? x : `${x}${"⁰¹²³⁴⁵⁶⁷⁸⁹"[e]}`;
    const betrag = Math.abs(a) === 1 && e > 0 ? "" : zahl(Math.abs(a));
    teile.push(`${teile.length ? (a < 0 ? " − " : " + ") : a < 0 ? "−" : ""}${betrag}${v}`);
  });
  return teile.join("") || "0";
}
const ableiten = (k: number[]) => k.slice(0, -1).map((a, i) => a * (k.length - 1 - i));
/** Stammfunktion ohne + C (Beiwerte eins länger). */
const integrieren = (k: number[]) => [...k.map((a, i) => a / (k.length - i)), 0];
const wert = (k: number[], x: number) => k.reduce((s, a) => s * x + a, 0);

// ---------- Differentialrechnung ----------

const aenderungsrate = (rng: Rng) => {
  const a = ganz(rng, 1, 3);
  const c = ganz(rng, -4, 4);
  const x1 = ganz(rng, 0, 3);
  const x2 = x1 + ganz(rng, 1, 3);
  const f = [a, 0, c];
  const r = (wert(f, x2) - wert(f, x1)) / (x2 - x1);
  return wahl(`f(x) = ${poly(f)}. Mittlere Änderungsrate in [${x1}; ${x2}]: ___`, zahl(r), [zahl(wert(f, x2) - wert(f, x1)), zahl((wert(f, x2) + wert(f, x1)) / 2), zahl(2 * a * x2)].filter((s) => s !== zahl(r)), "Differenzenquotient: (f(b) − f(a))/(b − a)");
};

const potenzregel = (rng: Rng) => {
  const n = ganz(rng, 2, 4);
  const k = Array.from({ length: n + 1 }, (_, i) => (i === 0 ? ganz(rng, 1, 5) * (rng() < 0.3 ? -1 : 1) : ganz(rng, -6, 6)));
  const d = ableiten(k);
  const falsch1 = poly(k.slice(0, -1).map((a, i) => a * (k.length - 1 - i)).concat([k[k.length - 1]]));
  const falsch2 = poly(k.slice(0, -1));
  const falsch3 = poly(d.map((a, i) => (i === 0 ? a / (k.length - 1) : a)));
  return wahl(`f(x) = ${poly(k)}. f′(x) = ___`, poly(d), [falsch1, falsch2, falsch3], "(xⁿ)′ = n · xⁿ⁻¹; eine Zahl allein fällt beim Ableiten weg.");
};

const elementar = (rng: Rng) => {
  const f = eins(rng, [
    ["eˣ", "eˣ", ["x · eˣ⁻¹", "e", "1"]],
    ["ln(x)", "1/x", ["eˣ", "x · ln(x)", "1"]],
    ["sin(x)", "cos(x)", ["−cos(x)", "sin(x)", "−sin(x)"]],
    ["cos(x)", "−sin(x)", ["sin(x)", "−cos(x)", "cos(x)"]],
    ["3eˣ", "3eˣ", ["eˣ", "3x · eˣ", "3"]],
    ["5ln(x)", "5/x", ["1/(5x)", "5", "5 · ln(x)"]],
    ["2sin(x)", "2cos(x)", ["cos(2x)", "−2cos(x)", "2sin(x)"]],
    ["eˣ + x²", "eˣ + 2x", ["eˣ + x", "x · eˣ + 2x", "eˣ"]],
    ["sin(x) + cos(x)", "cos(x) − sin(x)", ["cos(x) + sin(x)", "−cos(x) + sin(x)", "0"]],
    ["ln(x) + 4", "1/x", ["1/x + 4", "4/x", "x"]],
    ["√x", "1/(2√x)", ["2√x", "1/√x", "√x/2"]],
    ["1/x", "−1/x²", ["ln(x)", "1/x²", "−1/x"]],
  ] as [string, string, string[]][]);
  return wahl(`f(x) = ${f[0]}. f′(x) = ___`, f[1], f[2], "(eˣ)′ = eˣ, (ln x)′ = 1/x, (sin x)′ = cos x, (cos x)′ = −sin x");
};

const kettenregel = (rng: Rng) => {
  const a = ganz(rng, 2, 5);
  const b = ganz(rng, 1, 6);
  const n = ganz(rng, 2, 4);
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl(`f(x) = (${a}x + ${b})${"⁰¹²³⁴"[n]}. f′(x) = ___`, `${zahl(n * a)} · (${a}x + ${b})${"⁰¹²³⁴"[n - 1]}`.replace(/\)¹$/, ")"), [`${n} · (${a}x + ${b})${"⁰¹²³⁴"[n - 1]}`.replace(/\)¹$/, ")"), `${zahl(n * a)} · (${a}x + ${b})${"⁰¹²³⁴"[n]}`, `(${a}x + ${b})${"⁰¹²³⁴"[n - 1]}`.replace(/\)¹$/, ")")], "Äußere Ableitung mal innere Ableitung.");
  if (art === 1) return wahl(`f(x) = e^(${a}x). f′(x) = ___`, `${a}e^(${a}x)`, [`e^(${a}x)`, `${a}x · e^(${a}x − 1)`, `e^${a}`], "(e^(kx))′ = k · e^(kx)");
  return wahl(`f(x) = sin(${a}x). f′(x) = ___`, `${a}cos(${a}x)`, [`cos(${a}x)`, `−${a}cos(${a}x)`, `${a}sin(${a}x)`], "(sin(kx))′ = k · cos(kx)");
};

const produktregel = (rng: Rng) => {
  const a = ganz(rng, 2, 4);
  const f = eins(rng, [
    [`x · eˣ`, `eˣ + x · eˣ`, [`eˣ`, `x · eˣ`, `1 · eˣ`]],
    [`x² · sin(x)`, `2x · sin(x) + x² · cos(x)`, [`2x · cos(x)`, `2x · sin(x)`, `x² · cos(x)`]],
    [`x · ln(x)`, `ln(x) + 1`, [`1/x`, `ln(x)`, `x/x`]],
    [`${a}x · eˣ`, `${a}eˣ + ${a}x · eˣ`, [`${a}eˣ`, `${a}x · eˣ`, `${a} · eˣ · x²`]],
    [`x³ · eˣ`, `3x² · eˣ + x³ · eˣ`, [`3x² · eˣ`, `x³ · eˣ`, `3x² + eˣ`]],
    [`x · cos(x)`, `cos(x) − x · sin(x)`, [`−sin(x)`, `cos(x) + x · sin(x)`, `−x · sin(x)`]],
  ] as [string, string, string[]][]);
  return wahl(`f(x) = ${f[0]}. f′(x) = ___`, f[1], f[2], "Produktregel: (u · v)′ = u′ · v + u · v′");
};

const quotientenregel = (rng: Rng) => {
  const f = eins(rng, [
    [`x/(x + 1)`, `1/(x + 1)²`, [`1/1`, `x/(x + 1)²`, `−1/(x + 1)²`]],
    [`1/(x² + 1)`, `−2x/(x² + 1)²`, [`1/(2x)`, `2x/(x² + 1)²`, `−1/(x² + 1)²`]],
    [`eˣ/x`, `(x · eˣ − eˣ)/x²`, [`eˣ`, `(eˣ − x · eˣ)/x²`, `eˣ/x²`]],
    [`(x + 2)/(x − 2)`, `−4/(x − 2)²`, [`4/(x − 2)²`, `1`, `(2x)/(x − 2)²`]],
    [`x²/(x + 1)`, `(x² + 2x)/(x + 1)²`, [`2x`, `(x² − 2x)/(x + 1)²`, `2x/(x + 1)`]],
    [`sin(x)/x`, `(x · cos(x) − sin(x))/x²`, [`cos(x)`, `(sin(x) − x · cos(x))/x²`, `cos(x)/x`]],
  ] as [string, string, string[]][]);
  return wahl(`f(x) = ${f[0]}. f′(x) = ___`, f[1], f[2], "Quotientenregel: (u/v)′ = (u′ · v − u · v′)/v²");
};

const tangente = (rng: Rng) => {
  const a = ganz(rng, 1, 3);
  const c = ganz(rng, -3, 3);
  const x0 = ganz(rng, -2, 3);
  const k = 2 * a * x0;
  const y0 = a * x0 * x0 + c;
  const d = y0 - k * x0;
  const g = `y ＝ ${k === 0 ? "" : `${k === 1 ? "" : k === -1 ? "−" : zahl(k)}x`}${k === 0 ? zahl(d) : d ? ` ${plusMinus(d)}` : ""}`;
  if (rng() < 0.5) return wahl(`f(x) = ${poly([a, 0, c])}. Steigung der Tangente bei x = ${zahl(x0)}: ___`, zahl(k), [zahl(y0), zahl(a * x0), zahl(k + 1)].filter((s) => s !== zahl(k)), "Tangentensteigung = f′(x₀)");
  return wahl(`f(x) = ${poly([a, 0, c])}. Tangente bei x = ${zahl(x0)}: ___`, g, [`y ＝ ${zahl(k)}x ${plusMinus(y0)}`, `y ＝ ${zahl(y0)}x ${plusMinus(k)}`, `y ＝ ${zahl(k)}x`].filter((s) => s !== g), "y = f′(x₀) · (x − x₀) + f(x₀)");
};

const extremstellen = (rng: Rng) => {
  const x1 = ganz(rng, -3, 0);
  const x2 = x1 + ganz(rng, 1, 4);
  // f′(x) = 3(x − x1)(x − x2) → f(x) = x³ − 3/2 (x1 + x2) x² + 3 x1 x2 x
  const b = -1.5 * (x1 + x2);
  const c = 3 * x1 * x2;
  if (Number.isInteger(b)) {
    const art = rng() < 0.5;
    if (art) return wahl(`f(x) = ${poly([1, b, c, 0])}. Extremstellen bei x = ___`, `${zahl(x1)} und ${zahl(x2)}`, [`${zahl(-x1)} und ${zahl(-x2)}`, `0 und ${zahl(x1 + x2)}`, `${zahl(x1 + x2)}`].filter((s) => s !== `${zahl(x1)} und ${zahl(x2)}`), "f′(x) = 0 setzen und lösen.");
    return wahl(`f(x) = ${poly([1, b, c, 0])}. Bei x = ${zahl(x1)} liegt ___`, "ein Hochpunkt", ["ein Tiefpunkt", "ein Wendepunkt"], "f′(x₀) = 0 und f″(x₀) < 0: Hochpunkt. Bei x³ mit positivem Vorzeichen kommt zuerst der Hochpunkt.");
  }
  const s = ganz(rng, 1, 4);
  return wahl(`f′(x) = x − ${s}. f ist streng monoton fallend für ___`, `x < ${s}`, [`x > ${s}`, `x < −${s}`, `alle x`], "f′(x) < 0: fallend; f′(x) > 0: steigend.");
};

const wendestelle = (rng: Rng) => {
  const w = ganz(rng, -3, 3);
  const c = ganz(rng, -5, 5);
  // f(x) = x³ − 3w x² + c x, f″(x) = 6x − 6w
  const f = [1, -3 * w, c, 0];
  return wahl(`f(x) = ${poly(f)}. Wendestelle bei x = ___`, zahl(w), [zahl(-w || 1), zahl(3 * w || 2), zahl(2 * w || -1)].filter((s) => s !== zahl(w)), "f″(x) = 0 setzen (und f‴(x) ≠ 0).");
};

const bewegung = (rng: Rng) => {
  const a = ganz(rng, 1, 5);
  const v0 = ganz(rng, 0, 10);
  const t = ganz(rng, 1, 5);
  if (rng() < 0.5) return wahl(`s(t) = ${poly([a, v0, 0], "t")} (s in m, t in s). Geschwindigkeit bei t = ${t}: ___`, `${zahl(2 * a * t + v0)} m/s`, [`${zahl(a * t * t + v0 * t)} m/s`, `${zahl(2 * a)} m/s`, `${zahl(a * t + v0)} m/s`], "v(t) = s′(t)");
  return wahl(`s(t) = ${poly([a, v0, 0], "t")} (s in m, t in s). Beschleunigung: ___`, `${zahl(2 * a)} m/s²`, [`${zahl(a)} m/s²`, `${zahl(2 * a * t + v0)} m/s²`, `${zahl(v0)} m/s²`], "a(t) = v′(t) = s″(t)");
};

// ---------- Integralrechnung ----------

const stammfunktion = (rng: Rng) => {
  const n = ganz(rng, 1, 3);
  const k = Array.from({ length: n + 1 }, (_, i) => (i === 0 ? ganz(rng, 1, 4) * (n + 1) : ganz(rng, -4, 4) * (n + 1 - i)));
  const F = integrieren(k);
  return wahl(`f(x) = ${poly(k)}. Eine Stammfunktion F(x) = ___`, poly(F), [poly(ableiten(k).concat([0]).slice(1).length ? ableiten(k) : [0]), poly(k.map((a, i) => a).concat([0])), poly(k.map((a, i) => a / (k.length - 1 - i || 1)).concat([0]))].filter((s) => s !== poly(F)), "∫xⁿ dx = xⁿ⁺¹/(n + 1): Hochzahl um 1 erhöhen und durch die neue Hochzahl dividieren.");
};

const bestimmt = (rng: Rng) => {
  const a = ganz(rng, 0, 2);
  const b = a + ganz(rng, 1, 3);
  const f = eins(rng, [[1, 0, 0], [3, 0, 0], [0, 2, 0], [0, 0, 4], [3, 0, 1], [0, 2, 3], [6, 0, 0]] as number[][]);
  const F = integrieren(f);
  const r = wert(F, b) - wert(F, a);
  return wahl(`∫ von ${a} bis ${b} (${poly(f)}) dx = ___`, zahl(r), [zahl(wert(f, b) - wert(f, a)), zahl(wert(F, b)) === zahl(r) ? zahl(r + 1) : zahl(wert(F, b)), zahl(wert(F, a) - wert(F, b))].filter((s) => s !== zahl(r)), "F(b) − F(a): Stammfunktion an der oberen minus an der unteren Grenze.");
};

const flaeche = (rng: Rng) => {
  const n = ganz(rng, 1, 7);
  // f(x) = n² − x², Fläche mit x-Achse zwischen −n und n
  const A = (4 * n * n * n) / 3;
  return wahl(`Fläche zwischen f(x) = ${n * n} − x² und der x-Achse: ___`, zahl(A, 2), [zahl((2 * n * n * n) / 3, 2), zahl(2 * n * n, 2), zahl(n * n * n, 2)].filter((s) => s !== zahl(A, 2)), `Nullstellen ±${n}, dann ∫ von −${n} bis ${n} (${n * n} − x²) dx`);
};

const zwischen = (rng: Rng) => {
  const n = ganz(rng, 1, 9);
  // f(x) = n x, g(x) = x², Schnittstellen 0 und n, Fläche n³/6
  return wahl(`Fläche zwischen f(x) = ${n === 1 ? "" : n}x und g(x) = x²: ___`, zahl((n ** 3) / 6, 3), [zahl((n ** 3) / 2, 3), zahl((n ** 3) / 3, 3), zahl(n ** 2 / 2, 3)].filter((s) => s !== zahl((n ** 3) / 6, 3)), `Schnittstellen 0 und ${n}; ∫ (oben − unten) dx = ∫ von 0 bis ${n} (${n === 1 ? "" : n}x − x²) dx`);
};

const gesamtAenderung = (rng: Rng) => {
  const v = ganz(rng, 2, 9);
  const t = ganz(rng, 2, 10);
  if (rng() < 0.5) return wahl(`Ein Auto fährt ${t} s lang mit v = ${v} m/s. Zurückgelegter Weg: ___`, `${v * t} m`, [`${v + t} m`, `${v} m`, `${zahl((v * t) / 2)} m`], "Weg = ∫ v(t) dt; bei konstanter Geschwindigkeit v · t.");
  const a = ganz(rng, 1, 4);
  return wahl(`v(t) = ${a === 1 ? "" : a}t (m/s). Weg von t = 0 bis t = ${t}: ___`, `${zahl((a * t * t) / 2)} m`, [`${zahl(a * t * t)} m`, `${zahl(a * t)} m`, `${zahl(a)} m`], `∫ von 0 bis ${t} ${a === 1 ? "" : a}t dt = ${a}/2 · ${t}²`);
};

const substitution = (rng: Rng) => {
  const k = ganz(rng, 2, 5);
  const f = eins(rng, [
    [`e^(${k}x)`, `1/${k} · e^(${k}x)`, [`${k}e^(${k}x)`, `e^(${k}x)`, `e^(${k}x + 1)/(${k}x + 1)`]],
    [`cos(${k}x)`, `1/${k} · sin(${k}x)`, [`${k}sin(${k}x)`, `sin(${k}x)`, `−1/${k} · sin(${k}x)`]],
    [`sin(${k}x)`, `−1/${k} · cos(${k}x)`, [`1/${k} · cos(${k}x)`, `−${k}cos(${k}x)`, `cos(${k}x)`]],
    [`(${k}x + 1)²`, `(${k}x + 1)³/${3 * k}`, [`(${k}x + 1)³/3`, `${k}(${k}x + 1)³`, `2(${k}x + 1)`]],
  ] as [string, string, string[]][]);
  return wahl(`∫ ${f[0]} dx = ___ + C`, f[1], f[2], "Bei f(kx + d) durch die innere Ableitung k dividieren.");
};

const volumen = (rng: Rng) => {
  const r = ganz(rng, 1, 5);
  const h = ganz(rng, 1, 6);
  if (rng() < 0.5) return wahl(`f(x) = ${r} dreht sich von 0 bis ${h} um die x-Achse. V = ___`, `${r * r * h}π`, [`${r * h}π`, `${2 * r * h}π`, `${r * r * h}`], "V = π · ∫ f(x)² dx; ein Zylinder: r² · π · h");
  return wahl(`f(x) = x dreht sich von 0 bis ${h} um die x-Achse. V = ___`, `${zahl((h ** 3) / 3)}π`, [`${zahl((h ** 2) / 2)}π`, `${h ** 3}π`, `${zahl((h ** 3) / 3)}`], `V = π · ∫ von 0 bis ${h} x² dx (ein Kegel)`);
};

// ---------- Kosten (HAK) ----------

const breakEven = (rng: Rng) => {
  const fix = eins(rng, [1000, 1200, 2000, 2400, 3000, 4500, 6000]);
  const var_ = ganz(rng, 2, 20);
  const p = var_ + eins(rng, [2, 3, 4, 5, 6, 10]);
  const x = fix / (p - var_);
  if (!Number.isInteger(x)) return [];
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl(`K(x) = ${var_}x + ${fix}, Preis ${p} €. Break-even-Point: x = ___`, zahl(x), [zahl(runde(fix / p, 1)), zahl(runde(fix / var_, 1)), zahl(x * 2)], "Erlös = Kosten: p · x = k · x + F, also x = F/(p − k)");
  if (art === 1) return wahl(`K(x) = ${var_}x + ${fix}. Fixkosten: ___`, euro(fix), [euro(var_), euro(fix + var_), euro(0)], "Fixkosten = K(0), sie fallen auch ohne Produktion an.");
  const m = x + ganz(rng, 10, 100);
  return wahl(`K(x) = ${var_}x + ${fix}, Preis ${p} €. Gewinn bei ${m} Stück: ___`, euro(p * m - var_ * m - fix), [euro(p * m - var_ * m), euro(p * m), euro(p * m + var_ * m - fix)], "G(x) = E(x) − K(x) = p · x − (k · x + F)");
};

const stueckkosten = (rng: Rng) => {
  const fix = eins(rng, [100, 200, 400, 600, 900]);
  const var_ = ganz(rng, 2, 10);
  const x = eins(rng, [10, 20, 50, 100]);
  return wahl(`K(x) = ${var_}x + ${fix}. Stückkosten bei x = ${x}: ___`, euro(var_ + fix / x), [euro(var_), euro(var_ * x + fix), euro(fix / x)], "Stückkosten: K(x)/x");
};

const grenz = (rng: Rng) => {
  const a = ganz(rng, 1, 3) / 100;
  const b = ganz(rng, 1, 5);
  const c = ganz(rng, 10, 40);
  const x = eins(rng, [10, 20, 50]);
  const g = runde(3 * a * x * x - 2 * b * x + c, 2);
  if (g <= 0) return [];
  return wahl(`K(x) = ${zahl(a)}x³ − ${b}x² + ${c}x + 500. Grenzkosten bei x = ${x}: ___`, euro(g), [euro(runde(a * x ** 3 - b * x * x + c * x + 500, 2)), euro(runde(a * x * x - b * x + c, 2)), euro(runde(6 * a * x - 2 * b, 2))].filter((s) => s !== euro(g)), "Grenzkosten = K′(x): ungefähr die Kosten der nächsten Einheit.");
};

const markt = (rng: Rng) => {
  const a = ganz(rng, 40, 100);
  const b = ganz(rng, 1, 4);
  const c = ganz(rng, 0, 20);
  const d = ganz(rng, 1, 4);
  const x = (a - c) / (b + d);
  if (!Number.isInteger(x) || x <= 0) return [];
  return wahl(`Nachfrage p_N(x) = ${a} − ${b === 1 ? "" : b}x, Angebot p_A(x) = ${c ? `${c} + ` : ""}${d === 1 ? "" : d}x. Gleichgewichtsmenge: ___`, zahl(x), [zahl(runde((a + c) / (b + d), 2)), zahl(runde(a / b, 2)), zahl(a - b * x)].filter((s) => s !== zahl(x)), "Marktgleichgewicht: Nachfragepreis = Angebotspreis");
};

// ---------- Finanzmathematik (HAK) ----------

const zinseszins = (rng: Rng) => {
  const k = eins(rng, [1000, 2000, 5000, 10000]);
  const i = eins(rng, [1, 2, 3, 4, 5]);
  const n = ganz(rng, 2, 10);
  const e = runde(k * (1 + i / 100) ** n, 2);
  if (rng() < 0.6) return wahl(`${euro(k)} zu ${i} % p. a., ${n} Jahre, Zinseszins. Endwert: ___`, euro(e), [euro(k * (1 + (i * n) / 100)), euro(runde(k * (1 + i / 100) ** (n - 1), 2)), euro(runde(k * (i / 100) ** n + k, 2))], "Kₙ = K₀ · (1 + i)ⁿ");
  return wahl(`In ${n} Jahren braucht man ${euro(e)}, Zinssatz ${i} % p. a. Barwert heute: ___`, euro(k), [euro(runde(e * (1 - (i * n) / 100), 2)), euro(runde(e / (1 + i / 100), 2)), euro(runde(e * (1 + i / 100) ** -(n + 1), 2))], "K₀ = Kₙ/(1 + i)ⁿ (abzinsen)");
};

const unterjaehrig = (rng: Rng) => {
  const i = eins(rng, [2, 3, 4, 5, 6, 8, 12]);
  const m = eins(rng, [[2, "Semester", "halbjährlich"], [4, "Quartal", "vierteljährlich"], [12, "Monat", "monatlich"]] as [number, string, string][]);
  const r = runde(((1 + i / 100) ** (1 / m[0]) - 1) * 100, 4);
  if (rng() < 0.5) return wahl(`Jahreszinssatz ${i} %: äquivalenter ${m[1]}szinssatz (gerundet): ___`, `${zahl(r, 4)} %`, [`${zahl(runde(i / m[0], 4), 4)} %`, `${zahl(runde(i * m[0], 4), 4)} %`, `${zahl(runde(((1 + i / 100) ** m[0] - 1) * 100, 4), 4)} %`], "Äquivalent: (1 + i₍m₎)^m = 1 + i, also i₍m₎ = (1 + i)^(1/m) − 1");
  return wahl(`Nominell ${i} % p. a., ${m[2]} verzinst: effektiver Jahreszins (gerundet) ___`, `${zahl(runde(((1 + i / 100 / m[0]) ** m[0] - 1) * 100, 4), 4)} %`, [`${i} %`, `${zahl(runde(i / m[0], 4), 4)} %`, `${zahl(i * m[0])} %`], "Relativer Zinssatz i/m, dann (1 + i/m)^m − 1");
};

const rente = (rng: Rng) => {
  const r = eins(rng, [100, 200, 500, 1000]);
  const i = eins(rng, [2, 3, 4, 5]);
  const n = ganz(rng, 3, 10);
  const q = 1 + i / 100;
  const E = runde((r * (q ** n - 1)) / (q - 1), 2);
  return wahl(`Jährlich nachschüssig ${euro(r)}, ${i} % p. a., ${n} Jahre. Endwert: ___`, euro(E), [euro(r * n), euro(runde(r * n * q, 2)), euro(runde((r * q * (q ** n - 1)) / (q - 1), 2))], "Nachschüssiger Rentenendwert: R · (qⁿ − 1)/(q − 1)");
};

export const MATHE_OBERSTUFE_ANALYSIS: QuizBank = {
  "mathe.os.diff.aenderungsrate": { text: `Die mittlere Änderungsrate ist geometrisch die Steigung der ___ = Sekante | Tangente | x-Achse
Absolute Änderung von f in [a; b]: ___ = f(b) − f(a) | (f(b) − f(a))/(b − a) | f(b)/f(a)
Relative Änderung von f in [a; b]: ___ = (f(b) − f(a))/f(a) | f(b) − f(a) | f(b) · f(a)
Die Einheit der Änderungsrate von Kosten (€) nach Stück: ___ = € pro Stück | € | Stück pro €`, erzeuge: aenderungsrate },
  "mathe.os.diff.differentialquotient": `Die momentane Änderungsrate ist geometrisch die Steigung der ___ = Tangente | Sekante | Normalen
Der Differentialquotient ist der Grenzwert des ___ = Differenzenquotienten | Funktionswerts | Integrals
f′(x₀) = lim für h → 0 von ___ = (f(x₀ + h) − f(x₀))/h | f(x₀ + h) − f(x₀) | (f(x₀) − h)/h
f(x) = x²: f′(3) = ___ = 6 | 9 | 3
f(x) = 5x: f′(x) = ___ = 5 | 5x | x
f(x) = 7: f′(x) = ___ = 0 | 7 | 1
Momentangeschwindigkeit ist die Ableitung ___ = des Weges nach der Zeit | der Zeit nach dem Weg | der Beschleunigung
f′(2) = 0 heißt: bei x = 2 ist die Tangente ___ = waagrecht | senkrecht | nicht vorhanden
f′(x) > 0 heißt: f ist an dieser Stelle ___ = steigend | fallend | konstant
An einer Knickstelle ist f ___ = nicht differenzierbar | differenzierbar | nicht stetig
f′(x) wird gelesen als ___ = f Strich von x | f mal x | f hoch x
Die Einheit von f′ bei f in m und x in s: ___ = m/s | m | s/m`,
  "mathe.os.diff.grenzwert": `lim für x → 2 von (x² − 4)/(x − 2) = ___ = 4 | 0 | nicht definiert
lim für x → ∞ von 1/x = ___ = 0 | 1 | ∞
lim für x → ∞ von (3x + 1)/(x − 2) = ___ = 3 | 1/2 | ∞
lim für x → 0 von x² = ___ = 0 | 1 | ∞
Stetig heißt: der Graph ___ = hat keine Sprünge | hat keine Nullstellen | ist eine Gerade
Eine Polynomfunktion ist ___ stetig. = überall | nirgends | nur bei 0
f(x) = 1/x ist bei x = 0 ___ = nicht definiert | stetig | gleich 0
lim für x → ∞ von eˣ = ___ = ∞ | 0 | e
lim für x → −∞ von eˣ = ___ = 0 | −∞ | 1
lim für x → ∞ von (x² + 1)/x = ___ = ∞ | 1 | 0
Eine waagrechte Asymptote y = c heißt: lim für x → ∞ von f(x) = ___ = c | 0 | ∞
lim für x → 3 von (2x + 1) = ___ = 7 | 3 | 6`,
  "mathe.os.diff.potenzregel": { text: `(xⁿ)′ = ___ = n · xⁿ⁻¹ | xⁿ⁻¹ | n · xⁿ
(c · f(x))′ = ___ = c · f′(x) | c′ · f′(x) | f′(x)
(f + g)′ = ___ = f′ + g′ | f′ · g′ | f′ · g + f · g′
Die Ableitung einer Konstanten ist ___ = 0 | die Konstante | 1`, erzeuge: potenzregel },
  "mathe.os.diff.elementar": { erzeuge: elementar, anzahl: 12, text: `(eˣ)′ = ___ = eˣ | x · eˣ⁻¹ | e
(ln(x))′ = ___ = 1/x | ln(x) | eˣ` },
  "mathe.os.diff.produktregel": { text: `(u · v)′ = ___ = u′ · v + u · v′ | u′ · v′ | u′ · v − u · v′
Ist (x² · x³)′ = 2x · 3x²? = nein | ja
Die Produktregel braucht man bei ___ = einem Produkt zweier Funktionen von x | einer Zahl mal Funktion | einer Summe
Braucht man für (5 · x³)′ die Produktregel? = nein, ein konstanter Faktor bleibt einfach | ja
f(x) = x · x: mit Produktregel f′(x) = ___ = 1 · x + x · 1 ＝ 2x | 1 · 1 ＝ 1 | x²
(eˣ · eˣ)′ = ___ = 2e^(2x) | e^(2x) | eˣ
f(x) = (x + 1) · (x − 1): f′(x) = ___ = 2x | 1 | x² − 1`, erzeuge: produktregel, anzahl: 12 },
  "mathe.os.diff.quotientenregel": { text: `(u/v)′ = ___ = (u′ · v − u · v′)/v² | u′/v′ | (u · v′ − u′ · v)/v²
Im Nenner der Quotientenregel steht ___ = v² | v | u · v
Statt Quotientenregel bei 3/x: einfacher ___ = 3 · x^(−1) ableiten | gar nicht ableiten | die Kettenregel
(1/x)′ = ___ = −1/x² | 1/x² | ln(x)
(x/2)′ = ___ = 1/2 | x/2 | 2
Die Quotientenregel gilt nur, wenn ___ = der Nenner nicht 0 ist | der Zähler 1 ist | x > 0 ist
(1/v)′ = ___ = −v′/v² | 1/v′ | v′/v²`, erzeuge: quotientenregel, anzahl: 12 },
  "mathe.os.diff.kettenregel": { text: `Kettenregel: (f(g(x)))′ = ___ = f′(g(x)) · g′(x) | f′(x) · g′(x) | f′(g′(x))
Die innere Ableitung von (3x + 1)⁵ ist ___ = 3 | 5 | 1
(ln(2x))′ = ___ = 1/x | 1/(2x) | 2/x`, erzeuge: kettenregel },
  "mathe.os.diff.tangente": { text: `Tangentengleichung: y = ___ = f′(x₀) · (x − x₀) + f(x₀) | f(x₀) · x + f′(x₀) | f′(x) · x
Die Normale steht ___ auf der Tangente. = normal | parallel | schief
Steigung der Normalen bei Tangentensteigung k: ___ = −1/k | k | 1/k`, erzeuge: tangente },
  "mathe.os.diff.monotonie": { text: `f′(x) > 0 im Intervall heißt: f ist dort ___ = streng monoton steigend | fallend | konstant
Notwendige Bedingung für eine Extremstelle: ___ = f′(x) ＝ 0 | f(x) ＝ 0 | f″(x) ＝ 0
f′(x₀) = 0 und f″(x₀) > 0: bei x₀ liegt ___ = ein Tiefpunkt | ein Hochpunkt | ein Wendepunkt
Wechselt f′ das Vorzeichen von + nach −, liegt ___ = ein Hochpunkt | ein Tiefpunkt | ein Sattelpunkt`, erzeuge: extremstellen },
  "mathe.os.diff.kruemmung": { text: `f″(x) > 0: der Graph ist ___ = linksgekrümmt (positiv gekrümmt) | rechtsgekrümmt | gerade
f″(x) < 0: der Graph ist ___ = rechtsgekrümmt (negativ gekrümmt) | linksgekrümmt | steigend
Am Wendepunkt ändert sich ___ = die Krümmung | das Vorzeichen von f | die Steigung nicht
Ein Wendepunkt mit waagrechter Tangente heißt ___ = Sattelpunkt | Hochpunkt | Nullstelle`, erzeuge: wendestelle },
  "mathe.os.diff.kurvendiskussion": `Zur Kurvendiskussion gehören ___ = Nullstellen, Extrem- und Wendepunkte | nur Nullstellen | nur der Definitionsbereich
Nullstellen bestimmt man mit ___ = f(x) ＝ 0 | f′(x) ＝ 0 | f″(x) ＝ 0
Extremstellen bestimmt man mit ___ = f′(x) ＝ 0 | f(x) ＝ 0 | f‴(x) ＝ 0
Wendestellen bestimmt man mit ___ = f″(x) ＝ 0 | f′(x) ＝ 0 | f(x) ＝ 0
f(x) = x³ − 3x: Nullstellen ___ = 0, √3 und −√3 | 0 und 3 | 1 und −1
f(x) = x³ − 3x: Extremstellen ___ = −1 und 1 | 0 und 3 | √3 und −√3
f(x) = x³ − 3x: Wendestelle ___ = 0 | 1 | −1
f(x) = x³ − 3x: Hochpunkt bei ___ = (−1 ∣ 2) | (1 ∣ −2) | (0 ∣ 0)
f(x) = x³ − 3x: Tiefpunkt bei ___ = (1 ∣ −2) | (−1 ∣ 2) | (0 ∣ 0)
f(x) = x² − 4x: Tiefpunkt bei ___ = (2 ∣ −4) | (4 ∣ 0) | (−2 ∣ 12)
Eine Polynomfunktion 3. Grades hat genau ___ Wendepunkt. = einen | keinen | zwei
f(x) = x⁴ hat bei 0 ___ = einen Tiefpunkt | einen Wendepunkt | einen Sattelpunkt`,
  "mathe.os.diff.graphen": `Wo f einen Hochpunkt hat, hat f′ ___ = eine Nullstelle | einen Hochpunkt | eine Polstelle
Wo f steigt, ist der Graph von f′ ___ = über der x-Achse | unter der x-Achse | auf der x-Achse
Wo f einen Wendepunkt hat, hat f′ ___ = eine Extremstelle | eine Nullstelle | einen Wendepunkt
f ist eine Gerade mit Steigung 2. Dann ist f′ ___ = die waagrechte Gerade y ＝ 2 | eine Parabel | die x-Achse
f ist eine Parabel. Dann ist f′ ___ = eine Gerade | eine Parabel | konstant
f ist konstant. Dann ist f′ ___ = die x-Achse (0) | eine Gerade mit Steigung 1 | nicht definiert
Wo f′ positiv ist, ist f ___ = steigend | fallend | positiv
Wo f″ positiv ist, ist f′ ___ = steigend | fallend | null
f′ hat bei x = 1 eine Nullstelle mit Vorzeichenwechsel von − nach +: f hat dort ___ = einen Tiefpunkt | einen Hochpunkt | einen Wendepunkt
Polynom vom Grad 3: f′ hat den Grad ___ = 2 | 3 | 4
f′ ist eine nach oben offene Parabel mit zwei Nullstellen: f hat ___ = einen Hoch- und einen Tiefpunkt | keinen Extrempunkt | zwei Wendepunkte
Aus dem Graphen von f′ kann man f bestimmen bis auf ___ = eine Verschiebung nach oben oder unten | den Grad | die Nullstellen`,
  "mathe.os.diff.aufstellen": `Für eine Polynomfunktion 3. Grades braucht man ___ Bedingungen. = 4 | 3 | 2
„Der Graph hat bei x = 2 einen Hochpunkt“ ergibt ___ = f′(2) ＝ 0 | f(2) ＝ 0 | f″(2) ＝ 0
„Der Graph geht durch (1 ∣ 5)“ ergibt ___ = f(1) ＝ 5 | f(5) ＝ 1 | f′(1) ＝ 5
„Wendepunkt bei x = 0“ ergibt ___ = f″(0) ＝ 0 | f′(0) ＝ 0 | f(0) ＝ 0
„Die Tangente bei x = 1 hat Steigung 3“ ergibt ___ = f′(1) ＝ 3 | f(1) ＝ 3 | f″(1) ＝ 3
„Hochpunkt H(2 ∣ 4)“ ergibt ___ Bedingungen. = zwei | eine | drei
Symmetrie zur y-Achse bei einem Polynom heißt: ___ = nur gerade Hochzahlen | nur ungerade Hochzahlen | keine Konstante
Symmetrie zum Ursprung bei einem Polynom heißt: ___ = nur ungerade Hochzahlen | nur gerade Hochzahlen | keine x-Terme
Für eine Polynomfunktion 2. Grades braucht man ___ Bedingungen. = 3 | 2 | 4
„Schneidet die y-Achse bei 7“ ergibt ___ = f(0) ＝ 7 | f(7) ＝ 0 | f′(0) ＝ 7
„Nullstelle bei x = 3“ ergibt ___ = f(3) ＝ 0 | f′(3) ＝ 0 | f(0) ＝ 3
„Berührt die x-Achse bei x = 1“ ergibt ___ = f(1) ＝ 0 und f′(1) ＝ 0 | nur f(1) ＝ 0 | f″(1) ＝ 0`,
  "mathe.os.diff.extremwert": `Bei einer Extremwertaufgabe sucht man ___ = das Maximum oder Minimum einer Größe | eine Nullstelle | einen Wendepunkt
Die Nebenbedingung dient dazu, ___ = eine Variable zu ersetzen | die Funktion abzuleiten | die Einheit zu bestimmen
Rechteck mit Umfang 40 cm, größte Fläche: Seiten ___ = 10 cm und 10 cm | 5 cm und 15 cm | 20 cm und 20 cm
Rechteck mit Umfang 40 cm: A(x) = ___ = x · (20 − x) | x · (40 − x) | x² + 20
A(x) = x · (20 − x) ist maximal bei x = ___ = 10 | 20 | 40
Zahlen mit Summe 10, größtes Produkt: ___ = 5 und 5 | 1 und 9 | 0 und 10
Nach dem Ableiten der Hauptbedingung setzt man ___ = die Ableitung gleich 0 | die Funktion gleich 0 | x gleich 0
Man prüft ein Maximum mit ___ = f″(x) < 0 | f″(x) > 0 | f(x) > 0
Zaun 100 m, Rechteck an einer Mauer (3 Seiten Zaun): größte Fläche bei Breite ___ = 25 m | 50 m | 33,3 m
Zaun 100 m, Rechteck an einer Mauer: Länge parallel zur Mauer ___ = 50 m | 25 m | 100 m
Randwerte muss man prüfen, weil ___ = das Extremum am Rand liegen kann | sie immer 0 sind | man sonst nicht ableiten kann
Die Hauptbedingung ist ___ = die Formel der Größe, die extrem werden soll | die Einschränkung | die Ableitung`,
  "mathe.os.diff.bewegung": { text: `Die Geschwindigkeit ist ___ = die Ableitung des Weges | das Integral des Weges | der Weg mal Zeit
Die Beschleunigung ist ___ = die Ableitung der Geschwindigkeit | der Weg | das Integral der Zeit
v(t) = 0 heißt: der Körper ___ = steht in diesem Moment | ist am Start | beschleunigt nicht`, erzeuge: bewegung },
  "mathe.os.diff.newton": `Das Newton-Verfahren berechnet näherungsweise ___ = Nullstellen | Extremstellen | Flächen
Newton-Formel: xₙ₊₁ = ___ = xₙ − f(xₙ)/f′(xₙ) | xₙ + f(xₙ) | xₙ − f′(xₙ)/f(xₙ)
Geometrisch nimmt Newton ___ = die Nullstelle der Tangente | die Nullstelle der Sekante | den Mittelpunkt
f(x) = x² − 2, x₀ = 1: x₁ = ___ = 1,5 | 2 | 1
f(x) = x² − 2, x₀ = 1,5: x₁ ≈ ___ = 1,4167 | 1,5 | 1,3333
Das Newton-Verfahren versagt, wenn ___ = f′(xₙ) ＝ 0 ist | f(xₙ) ＝ 0 ist | xₙ > 0 ist
Mit f(x) = x² − 2 nähert Newton ___ = √2 | 2 | 1/2
Man hört auf, wenn ___ = sich die Werte kaum mehr ändern | x negativ wird | 10 Schritte vorbei sind
Ein guter Startwert liegt ___ = nahe der Nullstelle | weit weg | immer bei 0
f(x) = x³ − 8, x₀ = 2: x₁ = ___ = 2 | 0 | 8
Newton konvergiert nahe der Nullstelle meist ___ = sehr schnell | sehr langsam | gar nicht
Ein Verfahren mit Wiederholung heißt ___ = Iteration | Integration | Interpolation`,
  "mathe.os.integral.stammfunktion": { text: `F ist Stammfunktion von f, wenn ___ = F′ ＝ f | F ＝ f′ | F ＝ f · x
∫ xⁿ dx = ___ + C = xⁿ⁺¹/(n + 1) | n · xⁿ⁻¹ | xⁿ⁺¹
Zwei Stammfunktionen unterscheiden sich nur um ___ = eine Konstante | einen Faktor | x
∫ 5 dx = ___ + C = 5x | 0 | 5`, erzeuge: stammfunktion },
  "mathe.os.integral.grundintegrale": `∫ eˣ dx = ___ + C = eˣ | eˣ⁺¹/(x + 1) | x · eˣ
∫ 1/x dx = ___ + C (x > 0) = ln(x) | −1/x² | x⁰
∫ cos(x) dx = ___ + C = sin(x) | −sin(x) | cos(x)
∫ sin(x) dx = ___ + C = −cos(x) | cos(x) | −sin(x)
∫ 3eˣ dx = ___ + C = 3eˣ | eˣ | 3x · eˣ
∫ 2/x dx = ___ + C = 2ln(x) | ln(2x²) | 2/x²
∫ (eˣ + 1) dx = ___ + C = eˣ + x | eˣ | eˣ + 1
∫ (cos(x) + sin(x)) dx = ___ + C = sin(x) − cos(x) | sin(x) + cos(x) | −sin(x) + cos(x)
∫ 1/x² dx = ___ + C = −1/x | ln(x²) | 1/(3x³)
∫ √x dx = ___ + C = 2/3 · x^(3/2) | 1/(2√x) | x^(3/2)
Ist ∫ 1/x dx = x⁰/0? = nein, die Potenzregel gilt hier nicht | ja
∫ 4 sin(x) dx = ___ + C = −4cos(x) | 4cos(x) | −cos(4x)`,
  "mathe.os.integral.summen": `Die Untersumme ist ___ = kleiner oder gleich dem Flächeninhalt | immer größer | immer gleich
Die Obersumme ist ___ = größer oder gleich dem Flächeninhalt | immer kleiner | immer null
Je mehr Rechtecke, desto ___ = genauer die Näherung | ungenauer | gleich
Bei einer steigenden Funktion nimmt die Untersumme ___ = den linken Funktionswert | den rechten Funktionswert | den Mittelwert
Bei einer steigenden Funktion nimmt die Obersumme ___ = den rechten Funktionswert | den linken Funktionswert | null
f(x) = x auf [0; 2], zwei Rechtecke: Untersumme ___ = 1 | 3 | 2
f(x) = x auf [0; 2], zwei Rechtecke: Obersumme ___ = 3 | 1 | 2
f(x) = x auf [0; 2]: exakte Fläche ___ = 2 | 4 | 1
Der Grenzwert von Ober- und Untersumme ist ___ = das bestimmte Integral | die Ableitung | null
Die Breite eines Rechtecks bei n Rechtecken auf [a; b]: ___ = (b − a)/n | b − a | n
Ober- und Untersumme werden für n → ∞ ___ = gleich | immer verschieden | unendlich
Eine Summe von Rechtecken unter einer Kurve heißt ___ = Riemann-Summe | Taylorsumme | Reihe`,
  "mathe.os.integral.bestimmt": { text: `Hauptsatz: ∫ von a bis b f(x) dx = ___ = F(b) − F(a) | F(a) − F(b) | F(b) + F(a)
∫ von a bis a f(x) dx = ___ = 0 | f(a) | 1
∫ von a bis b = −∫ von ___ = b bis a | a bis b | 0 bis b
Liegt f unter der x-Achse, ist das Integral ___ = negativ | positiv | null`, erzeuge: bestimmt },
  "mathe.os.integral.flaeche": { text: `Teile unter der x-Achse liefern ___ = negative Integrale | positive Integrale | null
Bei Vorzeichenwechsel teilt man das Integral ___ = an den Nullstellen | in der Mitte | gar nicht
∫ von −1 bis 1 x dx = 0, die Fläche ist aber ___ = 1 | 0 | 2
Für die Fläche nimmt man von negativen Teilen ___ = den Betrag | das Doppelte | nichts
Fläche zwischen f(x) = x² und der x-Achse von 0 bis 3: ___ = 9 | 27 | 3
Fläche zwischen f(x) = 2x und der x-Achse von 0 bis 4: ___ = 16 | 8 | 32
Fläche zwischen f(x) = x³ und der x-Achse von −1 bis 1: ___ = 1/2 | 0 | 1/4
Fläche zwischen f(x) = 3 und der x-Achse von 1 bis 5: ___ = 12 | 15 | 3`, erzeuge: flaeche },
  "mathe.os.integral.zwischen": { text: `Fläche zwischen f und g: ∫ ___ dx = (obere − untere Funktion) | (f · g) | (f + g)
Die Grenzen sind meist ___ = die Schnittstellen von f und g | 0 und 1 | die Nullstellen von f
Wechseln f und g oben und unten, teilt man ___ = an den Schnittstellen | gar nicht | bei x ＝ 0
Fläche zwischen f(x) = 4 und g(x) = x²: Grenzen ___ = −2 und 2 | 0 und 4 | 0 und 2
Fläche zwischen f(x) = 4 und g(x) = x²: ___ = 32/3 | 16/3 | 8
Die Fläche zwischen zwei Graphen ist immer ___ = positiv (oder 0) | negativ | gleich dem Integral von f
Fläche zwischen f(x) = x + 2 und g(x) = x von 0 bis 3: ___ = 6 | 3 | 9`, erzeuge: zwischen },
  "mathe.os.integral.anwendungen": { text: `Aus der Grenzkostenfunktion K′ bekommt man durch Integrieren ___ = die Kostenänderung | den Preis | die Menge
Aus der Zuflussrate (Liter pro Minute) bekommt man durch Integrieren ___ = die Wassermenge | die Geschwindigkeit | die Zeit
Weg = ∫ ___ dt = v(t) | a(t) | s(t)`, erzeuge: gesamtAenderung },
  "mathe.os.integral.substitution": { text: `∫ f(kx + d) dx = ___ = 1/k · F(kx + d) + C | k · F(kx + d) + C | F(kx) + d
Bei linearer Substitution dividiert man durch ___ = die innere Ableitung | die äußere Ableitung | x`, erzeuge: substitution, anzahl: 16 },
  "mathe.os.integral.volumen": { text: `Volumen eines Drehkörpers um die x-Achse: V = ___ = π · ∫ f(x)² dx | ∫ f(x) dx | 2π · ∫ f(x) dx
Dreht sich f(x) = r um die x-Achse, entsteht ___ = ein Zylinder | ein Kegel | eine Kugel
Dreht sich f(x) = kx um die x-Achse, entsteht ___ = ein Kegel | ein Zylinder | eine Kugel
Dreht sich ein Halbkreis um die x-Achse, entsteht ___ = eine Kugel | ein Kegel | ein Würfel`, erzeuge: volumen },
  "mathe.os.integral.trapez": `Die Trapezregel ersetzt die Kurve durch ___ = Sehnen (Trapeze) | Rechtecke | Parabeln
Fläche eines Trapezes mit Breite h und Seiten f(a), f(b): ___ = h · (f(a) + f(b))/2 | h · f(a) · f(b) | h · f(a)
f(x) = x² auf [0; 2], ein Trapez: ___ = 4 | 8/3 | 2
f(x) = x auf [0; 4], ein Trapez: ___ = 8 | 4 | 16
Bei einer linksgekrümmten Funktion ist die Trapezregel ___ = zu groß | zu klein | exakt
Bei einer Geraden ist die Trapezregel ___ = exakt | zu groß | zu klein
Mehr Trapeze machen das Ergebnis ___ = genauer | ungenauer | gleich
Werte nur aus einer Tabelle (Messwerte): integrieren mit ___ = der Trapezregel | der Kettenregel | Newton
Trapezregel mit Werten 1, 3, 5 und Schrittweite 1: ___ = 6 | 9 | 4
Simpson nimmt statt Sehnen ___ = Parabelstücke | Rechtecke | Kreise
Die Trapezregel braucht keine ___ = Stammfunktion | Funktionswerte | Schrittweite
Bei rechtsgekrümmten Funktionen ist die Trapezregel ___ = zu klein | zu groß | exakt`,
  "mathe.os.dgl.differenzengleichung": `Eine Differenzengleichung beschreibt ___ = yₙ₊₁ aus yₙ | y′ aus y | eine Fläche
yₙ₊₁ = 1,05 · yₙ beschreibt ___ = exponentielles Wachstum um 5 % | lineares Wachstum | Abnahme
yₙ₊₁ = yₙ + 3 beschreibt ___ = lineares Wachstum | exponentielles Wachstum | Abnahme
y₀ = 100, yₙ₊₁ = 1,1 · yₙ: y₂ = ___ = 121 | 120 | 110
y₀ = 10, yₙ₊₁ = yₙ + 4: y₃ = ___ = 22 | 14 | 40
yₙ₊₁ = 0,8 · yₙ + 20 nähert sich ___ = 100 | 20 | 0
Ein Gleichgewicht y* erfüllt ___ = y* ＝ f(y*) | y* ＝ 0 | y* ＝ yₙ₊₁ − yₙ
yₙ₊₁ = 0,5 · yₙ + 10: Gleichgewicht ___ = 20 | 10 | 5
Medikament: jeden Tag 20 % abgebaut, 50 mg dazu: yₙ₊₁ = ___ = 0,8 · yₙ + 50 | 0,2 · yₙ + 50 | yₙ − 20 + 50
Differenzengleichungen arbeiten mit ___ = Schritten (diskret) | stetiger Zeit | Flächen
Zu einer Differenzengleichung braucht man noch ___ = einen Startwert | eine Ableitung | ein Integral
yₙ₊₁ − yₙ = 0,1 · yₙ ist dasselbe wie ___ = yₙ₊₁ ＝ 1,1 · yₙ | yₙ₊₁ ＝ 0,1 · yₙ | yₙ₊₁ ＝ yₙ + 0,1`,
  "mathe.os.dgl.aufstellen": `y′ = k · y beschreibt ___ = exponentielles Wachstum | lineares Wachstum | beschränktes Wachstum
y′ = k · (S − y) beschreibt ___ = beschränktes Wachstum | exponentielles Wachstum | lineares Wachstum
y′ = c (konstant) beschreibt ___ = lineares Wachstum | exponentielles Wachstum | logistisches Wachstum
y′ = k · y · (S − y) beschreibt ___ = logistisches Wachstum | lineares Wachstum | Abnahme
„Die Änderungsrate ist proportional zum Bestand“: ___ = y′ ＝ k · y | y ＝ k · x | y′ ＝ k
„Abkühlung proportional zum Unterschied zur Raumtemperatur T“: ___ = y′ ＝ −k · (y − T) | y′ ＝ k · y | y′ ＝ T
Eine Differentialgleichung enthält ___ = eine Funktion und ihre Ableitung | nur Zahlen | nur Integrale
In y′ = −0,2y ist k = −0,2, das heißt ___ = Abnahme | Zunahme | konstant
Die Ordnung einer Differentialgleichung ist ___ = die höchste vorkommende Ableitung | der Grad | die Anzahl der Lösungen
y″ = −y ist eine Differentialgleichung ___ Ordnung. = 2. | 1. | 3.
Ein Richtungsfeld zeigt ___ = die Steigung der Lösungen in jedem Punkt | die Lösungen selbst | die Nullstellen
Für eine eindeutige Lösung braucht man ___ = eine Anfangsbedingung | eine Ableitung | eine Fläche`,
  "mathe.os.dgl.loesen": `Lösung von y′ = k · y: y = ___ = C · e^(kx) | C · x^k | kx + C
Lösung von y′ = 3: y = ___ = 3x + C | 3 | 3eˣ
Lösung von y′ = 2x: y = ___ = x² + C | 2 | 2x² + C
y′ = 0,5y, y(0) = 4: y = ___ = 4e^(0,5x) | 0,5e^(4x) | 4 + 0,5x
Probe: ist y = e^(2x) eine Lösung von y′ = 2y? = ja | nein
Probe: ist y = x² eine Lösung von y′ = 2y? = nein | ja
Bei der Trennung der Variablen bringt man ___ = alle y auf eine Seite, alle x auf die andere | alles auf eine Seite | nur die Zahlen auf eine Seite
y′ = −y, y(0) = 10: y(1) ≈ ___ = 3,68 | 10 | 0
Die allgemeine Lösung enthält ___ = eine Konstante C | keine Konstante | nur Zahlen
Mit der Anfangsbedingung bestimmt man ___ = die Konstante C | k | die Ordnung
Lösung von y′ = cos(x): y = ___ = sin(x) + C | −sin(x) + C | cos(x) + C
Lösung von y′ = 1/x (x > 0): y = ___ = ln(x) + C | −1/x² + C | eˣ + C`,
  "mathe.os.kosten.grundbegriffe": { text: `Gewinn = ___ = Erlös − Kosten | Kosten − Erlös | Preis · Kosten
Erlös bei Preis p und Menge x: E(x) = ___ = p · x | p + x | p/x
Der Break-even-Point ist die Menge, bei der ___ = Erlös gleich Kosten ist | der Gewinn am größten ist | die Kosten 0 sind
Variable Kosten hängen ab von ___ = der produzierten Menge | gar nichts | der Miete`, erzeuge: breakEven },
  "mathe.os.kosten.ertragsgesetzlich": `Die ertragsgesetzliche Kostenfunktion ist meist ___ = eine Polynomfunktion 3. Grades | eine Gerade | eine Exponentialfunktion
Die Kostenkehre ist ___ = der Wendepunkt der Kostenfunktion | das Minimum | der Break-even-Point
Bis zur Kostenkehre steigen die Kosten ___ = degressiv (immer langsamer) | progressiv | gar nicht
Nach der Kostenkehre steigen die Kosten ___ = progressiv (immer schneller) | degressiv | linear
An der Kostenkehre sind die Grenzkosten ___ = am kleinsten | am größten | null
Die Kostenkehre findet man mit ___ = K″(x) ＝ 0 | K′(x) ＝ 0 | K(x) ＝ 0
K(x) = x³ − 6x² + 15x + 20: Kostenkehre bei x = ___ = 2 | 6 | 3
Eine ertragsgesetzliche Kostenfunktion ist überall ___ = streng monoton steigend | fallend | konstant
K(0) ist ___ = die Fixkosten | die Grenzkosten | null
K(x) = 0,5x³ − 3x² + 10x + 100: Fixkosten ___ = 100 | 10 | 0,5
Der Leitkoeffizient einer ertragsgesetzlichen Kostenfunktion ist ___ = positiv | negativ | null
Zwischen 0 und Kostenkehre ist K ___ = rechtsgekrümmt | linksgekrümmt | gerade`,
  "mathe.os.kosten.betriebsoptimum": { text: `Stückkosten: K̄(x) = ___ = K(x)/x | K′(x) | K(x) · x
Das Betriebsoptimum ist das Minimum der ___ = Stückkosten | Gesamtkosten | Grenzkosten
Die langfristige Preisuntergrenze ist ___ = das Minimum der Stückkosten | die Fixkosten | der Höchstpreis
Im Betriebsoptimum gilt ___ = Grenzkosten ＝ Stückkosten | Grenzkosten ＝ 0 | Kosten ＝ Erlös`, erzeuge: stueckkosten },
  "mathe.os.kosten.betriebsminimum": `Variable Stückkosten: ___ = K_v(x)/x | K(x)/x | K′(x)
Das Betriebsminimum ist das Minimum der ___ = variablen Stückkosten | Gesamtkosten | Fixkosten
Die kurzfristige Preisuntergrenze ist ___ = das Minimum der variablen Stückkosten | das Betriebsoptimum | null
Kurzfristig produziert ein Betrieb weiter, solange der Preis ___ = die variablen Stückkosten deckt | die Fixkosten deckt | 0 ist
K(x) = x³ − 6x² + 15x + 20: variable Kosten ___ = x³ − 6x² + 15x | 20 | x³ − 6x²
K_v(x) = x³ − 6x² + 15x: variable Stückkosten ___ = x² − 6x + 15 | 3x² − 12x + 15 | x³ − 6x²
x² − 6x + 15 ist minimal bei x = ___ = 3 | 6 | 15
x² − 6x + 15 bei x = 3: ___ = 6 | 15 | 0
Kurzfristige Preisuntergrenze ≤ langfristige? = ja | nein
Fixkosten fallen beim Betriebsminimum ___ = nicht ins Gewicht (sie sind ohnehin da) | doppelt an | weg
Im Betriebsminimum gilt ___ = Grenzkosten ＝ variable Stückkosten | Grenzkosten ＝ Stückkosten | Preis ＝ 0
Liegt der Preis unter dem Betriebsminimum, sollte man ___ = nicht produzieren | mehr produzieren | den Preis senken`,
  "mathe.os.kosten.grenzfunktionen": { text: `Grenzkosten = ___ = K′(x) | K(x)/x | K(x) − E(x)
Grenzerlös = ___ = E′(x) | E(x)/x | E(x) · x
Grenzgewinn = ___ = G′(x) ＝ E′(x) − K′(x) | G(x)/x | E(x) − K(x)
Der Gewinn ist maximal, wenn ___ = Grenzerlös ＝ Grenzkosten | Erlös ＝ Kosten | Kosten minimal`, erzeuge: grenz },
  "mathe.os.kosten.gewinnmaximum": `Gewinnmaximum: ___ = G′(x) ＝ 0 und G″(x) < 0 | G(x) ＝ 0 | G″(x) ＝ 0
E(x) = 50x, K(x) = x² + 10x + 100: G(x) = ___ = −x² + 40x − 100 | x² + 40x + 100 | 50x − 100
G(x) = −x² + 40x − 100: gewinnmaximale Menge ___ = 20 | 40 | 10
G(x) = −x² + 40x − 100: maximaler Gewinn ___ = 300 | 400 | 100
Der Cournot’sche Punkt liegt ___ = auf der Nachfragekurve beim Gewinnmaximum | im Break-even-Point | im Betriebsoptimum
Cournot gilt für ___ = einen Monopolisten | vollständige Konkurrenz | Konsumenten
Beim Monopol hängt der Preis ___ = von der Menge ab (Nachfragefunktion) | nicht von der Menge ab | nur von den Kosten ab
p(x) = 100 − 2x: Erlösfunktion E(x) = ___ = 100x − 2x² | 100 − 2x | 100x
p(x) = 100 − 2x: Grenzerlös E′(x) = ___ = 100 − 4x | 100 − 2x | −2
Gewinnschwelle und Gewinngrenze sind ___ = die Nullstellen von G | die Extremstellen von G | die Fixkosten
Zwischen Gewinnschwelle und Gewinngrenze ist der Gewinn ___ = positiv | negativ | null
Der Cournot’sche Preis ist ___ = p(x_max) | K(x_max) | der kleinste Preis
Bei vollständiger Konkurrenz ist der Preis ___ = vom Markt vorgegeben (konstant) | frei wählbar | immer 0`,
  "mathe.os.kosten.markt": { text: `Die Nachfragefunktion ist meist ___ = fallend | steigend | konstant
Die Angebotsfunktion ist meist ___ = steigend | fallend | konstant
Der Höchstpreis ist ___ = der Preis, bei dem die Nachfrage 0 ist | der Gleichgewichtspreis | der Mindestpreis
Die Sättigungsmenge ist ___ = die Nachfrage beim Preis 0 | die Angebotsmenge | das Gleichgewicht`, erzeuge: markt },
  "mathe.os.kosten.elastizitaet": `Die Preiselastizität misst ___ = die Reaktion der Nachfrage auf den Preis | den Preis | die Kosten
Elastizität ε = ___ = relative Mengenänderung : relative Preisänderung | Menge · Preis | Preis : Menge
Betrag von ε > 1 heißt ___ = elastisch | unelastisch | fließend elastisch
Betrag von ε < 1 heißt ___ = unelastisch | elastisch | proportional
Preis +10 %, Nachfrage −20 %: ε = ___ = −2 | −0,5 | 2
Preis +10 %, Nachfrage −5 %: ε = ___ = −0,5 | −2 | 0,5
Grundnahrungsmittel haben meist eine ___ Nachfrage. = unelastische | elastische | unendliche
Bei elastischer Nachfrage führt eine Preissenkung zu ___ = mehr Erlös | weniger Erlös | gleichem Erlös
Bei unelastischer Nachfrage führt eine Preiserhöhung zu ___ = mehr Erlös | weniger Erlös | gar keinem Verkauf
Punktelastizität: ε(p) = ___ = x′(p) · p/x(p) | x(p)/p | x′(p)
Betrag von ε = 1 heißt ___ = proportional elastisch | unelastisch | elastisch
Elastizität hat ___ = keine Einheit | die Einheit € | die Einheit Stück
Bei einer fallenden Nachfragefunktion ist ε meist ___ = negativ | positiv | null`,
  "mathe.os.finanz.zinseszins": { text: `Bei Zinseszinsen werden die Zinsen ___ = mitverzinst | ausbezahlt | nicht berechnet
Endwert: Kₙ = ___ = K₀ · (1 + i)ⁿ | K₀ · (1 + i · n) | K₀ + i · n
Barwert: K₀ = ___ = Kₙ/(1 + i)ⁿ | Kₙ · (1 + i)ⁿ | Kₙ − i · n
Laufzeit: n = ___ = ln(Kₙ/K₀)/ln(1 + i) | Kₙ/K₀ | (Kₙ − K₀)/i`, erzeuge: zinseszins },
  "mathe.os.finanz.unterjaehrig": { text: `Relativer Zinssatz bei m Perioden: ___ = i/m | i · m | i^m
Bei gleichem Nominalzins bringt monatliche Verzinsung ___ = mehr als jährliche | weniger | gleich viel
Stetige Verzinsung: Kₜ = ___ = K₀ · e^(i · t) | K₀ · (1 + i)ᵗ | K₀ + i · t
Ein Quartal sind ___ eines Jahres. = 1/4 | 1/3 | 1/12`, erzeuge: unterjaehrig },
  "mathe.os.finanz.vergleich": `Zahlungen zu verschiedenen Zeitpunkten vergleicht man ___ = auf einen gemeinsamen Zeitpunkt bezogen | einfach addiert | nach Größe sortiert
Äquivalenzprinzip: Leistung und Gegenleistung haben ___ = denselben Wert zum selben Zeitpunkt | denselben Betrag | dieselbe Laufzeit
1 000 € heute oder 1 000 € in 5 Jahren (Zins > 0)? Mehr wert ist ___ = 1 000 € heute | 1 000 € in 5 Jahren | beides gleich
Eine Zahlung auf einen früheren Zeitpunkt beziehen heißt ___ = abzinsen | aufzinsen | tilgen
Eine Zahlung auf einen späteren Zeitpunkt beziehen heißt ___ = aufzinsen | abzinsen | runden
Den Wert in Jahr 0 nennt man ___ = Barwert | Endwert | Rate
Den Wert am Ende nennt man ___ = Endwert | Barwert | Kurs
2 000 € in 2 Jahren bei 5 %: Barwert ≈ ___ = 1 814,06 € | 1 800 € | 1 900 €
1 000 € heute bei 3 %: Wert in 1 Jahr ___ = 1 030 € | 1 003 € | 1 300 €
Ein Zahlungsstrom ist ___ = mehrere Zahlungen zu verschiedenen Zeitpunkten | eine einzige Zahlung | ein Zinssatz
Der Vergleichszeitpunkt darf ___ = beliebig gewählt werden | nur heute sein | nur das Ende sein
Wer höheren Zins annimmt, bewertet spätere Zahlungen ___ = geringer | höher | gleich
Aufzinsfaktor für n Jahre: ___ = (1 + i)ⁿ | 1 + i · n | (1 − i)ⁿ`,
  "mathe.os.finanz.rente": { text: `Eine Rente ist ___ = gleich hohe Zahlungen in gleichen Abständen | eine einmalige Zahlung | ein Zinssatz
Nachschüssig heißt: gezahlt wird ___ = am Ende jeder Periode | am Anfang | in der Mitte
Vorschüssig heißt: gezahlt wird ___ = am Anfang jeder Periode | am Ende | gar nicht
Der vorschüssige Endwert ist ___ als der nachschüssige. = um den Faktor q größer | kleiner | gleich`, erzeuge: rente },
  "mathe.os.finanz.rate": `Die Rate einer nachschüssigen Rente aus dem Barwert B: R = ___ = B · qⁿ · (q − 1)/(qⁿ − 1) | B/n | B · q
Die Laufzeit einer Rente berechnet man mit ___ = dem Logarithmus | der Wurzel | dem Sinus
Eine höhere Rate führt zu ___ Laufzeit. = kürzerer | längerer | gleicher
Ein höherer Zinssatz beim Sparen führt zu ___ = schneller erreichtem Sparziel | langsamerem Sparen | nichts
Ergibt die Laufzeit 7,4 Jahre, gibt es ___ = 7 volle Raten und eine Restzahlung | 8 volle Raten | 7,4 Raten
Ewige Rente: Barwert = ___ = R/i | R · i | R · n
Ewige Rente 1 200 € jährlich bei 4 %: Barwert ___ = 30 000 € | 4 800 € | 1 248 €
Ewige Rente: von 50 000 € bei 2 % kann man jährlich entnehmen ___ = 1 000 € | 2 000 € | 500 €
q steht in der Rentenrechnung für ___ = 1 + i | i | 1 − i
Bei 0 % Zinsen ist der Endwert einer Rente ___ = n · R | 0 | R
Die Rentenrate wird meist mit ___ bezeichnet. = R | K | i
Sparen bis zu einem Ziel: gesucht ist meist ___ = die Rate oder die Laufzeit | der Kurs | die Elastizität`,
  "mathe.os.finanz.tilgung": `Die Annuität ist ___ = Zinsen plus Tilgung | nur die Zinsen | nur die Tilgung
Bei gleichbleibender Annuität wird der Tilgungsanteil ___ = größer | kleiner | gleich
Bei gleichbleibender Annuität wird der Zinsanteil ___ = kleiner | größer | gleich
Restschuld 10 000 €, Zins 5 %: Zinsen im Jahr ___ = 500 € | 5 000 € | 50 €
Annuität 2 000 €, Zinsen 500 €: Tilgung ___ = 1 500 € | 2 500 € | 500 €
Restschuld 10 000 €, Tilgung 1 500 €: neue Restschuld ___ = 8 500 € | 9 500 € | 11 500 €
Bei Ratentilgung ist ___ gleich. = die Tilgung jedes Jahr | die Annuität | der Zinsanteil
Ein Tilgungsplan zeigt je Periode ___ = Zinsen, Tilgung, Annuität, Restschuld | nur den Zinssatz | nur den Endwert
Die Restschuld am Ende des Tilgungsplans ist ___ = 0 | die Anfangsschuld | die Annuität
Die letzte Zahlung kann kleiner sein, sie heißt ___ = Restzahlung (Abschlusszahlung) | Annuität | Anzahlung
Die Annuität A aus Schuld S: A = ___ = S · qⁿ · (q − 1)/(qⁿ − 1) | S/n | S · i
Schuld 1 000 €, 0 % Zinsen, 4 Jahre: Annuität ___ = 250 € | 1 000 € | 400 €`,
  "mathe.os.finanz.effektivzins": `Der Effektivzinssatz berücksichtigt auch ___ = Spesen und Gebühren | nur den Nominalzins | nur die Laufzeit
Der Effektivzins ist bei Gebühren ___ als der Nominalzins. = höher | niedriger | gleich
Den Effektivzins bestimmt man mit ___ = dem Äquivalenzprinzip (meist mit Technologie) | einer einfachen Formel | dem Sinussatz
Kredit 10 000 €, Spesen 200 €: ausbezahlt werden ___ = 9 800 € | 10 200 € | 10 000 €
Monatliche Raten und Jahreszins: man vergleicht über ___ = den äquivalenten Zinssatz | die Rate | die Anzahl der Monate
Zwei Kredite vergleicht man am besten mit ___ = dem Effektivzins | dem Nominalzins | der Rate
Ein Kredit mit niedrigerem Effektivzins ist ___ = günstiger | teurer | gleich teuer
Bearbeitungsgebühren erhöhen ___ = den Effektivzins | den Nominalzins | die Laufzeit
Effektivzins 0 heißt ___ = man zahlt nur zurück, was man bekommen hat | gratis Geld | doppelte Rückzahlung
Gesetzlich muss eine Bank den Effektivzins ___ = angeben | verschweigen | schätzen
Effektiver Jahreszins bei 1 % pro Monat: ___ = etwa 12,68 % | 12 % | 1 %
Ein „0 %-Kredit“ mit Gebühr hat einen Effektivzins ___ = über 0 % | von 0 % | unter 0 %`,
  "mathe.os.finanz.kapitalwert": `Kapitalwert = ___ = Summe der abgezinsten Rückflüsse − Investition | Summe der Rückflüsse | Investition − Zinsen
Kapitalwert > 0 heißt ___ = die Investition lohnt sich | sie lohnt sich nicht | genau ausgeglichen
Kapitalwert < 0 heißt ___ = die Investition lohnt sich nicht | sie lohnt sich | Gewinn
Für den Kapitalwert braucht man ___ = einen Kalkulationszinssatz | den Effektivzins eines Kredits | die Elastizität
Höherer Kalkulationszinssatz macht den Kapitalwert ___ = kleiner | größer | gleich
Investition 1 000 €, Rückfluss 1 100 € nach 1 Jahr, Zins 5 %: Kapitalwert ≈ ___ = 47,62 € | 100 € | 50 €
Investition 1 000 €, Rückfluss 1 050 € nach 1 Jahr, Zins 5 %: Kapitalwert ___ = 0 € | 50 € | −50 €
Rückflüsse sind ___ = Einzahlungen minus Auszahlungen je Jahr | nur Einnahmen | Kredite
Bei mehreren Investitionen wählt man die mit ___ = dem größten Kapitalwert | dem kleinsten Kapitalwert | der längsten Laufzeit
Rückflüsse werden auf ___ abgezinst. = den Zeitpunkt 0 | das Ende | das Jahr 1
Der Kapitalwert heißt auch ___ = Nettobarwert | Endwert | Kurs
Kapitalwert = 0 heißt: die Verzinsung entspricht genau ___ = dem Kalkulationszinssatz | 0 % | dem Inflationswert`,
  "mathe.os.finanz.interner-zinssatz": `Der interne Zinssatz ist der Zinssatz, bei dem ___ = der Kapitalwert 0 ist | der Kapitalwert maximal ist | keine Zinsen anfallen
Eine Investition lohnt sich, wenn der interne Zinssatz ___ = über dem Kalkulationszinssatz liegt | darunter liegt | 0 ist
Investition 1 000 €, nach 1 Jahr 1 080 €: interner Zinssatz ___ = 8 % | 80 % | 1,08 %
Investition 1 000 €, nach 2 Jahren 1 210 €: interner Zinssatz ___ = 10 % | 21 % | 10,5 %
Den internen Zinssatz bestimmt man meist ___ = mit Technologie (näherungsweise) | mit einer Formel | gar nicht
Beim modifizierten internen Zinssatz werden Rückflüsse ___ = zum Wiederveranlagungszins angelegt | nicht verzinst | doppelt gezählt
Der modifizierte interne Zinssatz ist meist ___ = realistischer | immer 0 | immer größer als 100 %
Der interne Zinssatz ist die ___ des Kapitalwerts als Funktion des Zinssatzes. = Nullstelle | Extremstelle | Wendestelle
Mehrere Vorzeichenwechsel im Zahlungsstrom können ___ = mehrere interne Zinssätze geben | keinen Kapitalwert geben | die Rechnung verbieten
Interner Zinssatz 6 %, Kalkulationszins 4 %: ___ = lohnt sich | lohnt sich nicht | egal
Interner Zinssatz 3 %, Kalkulationszins 4 %: ___ = lohnt sich nicht | lohnt sich | egal
Der interne Zinssatz heißt auch ___ = Rendite der Investition | Effektivzins des Kredits | Kalkulationszins`,
  "mathe.os.finanz.kurs": `Eine Anleihe ist ___ = ein Wertpapier: man leiht dem Herausgeber Geld | eine Aktie | ein Sparbuch
Der Kurs einer Anleihe wird angegeben in ___ = Prozent des Nennwerts | Euro je Aktie | Jahren
Kurs 100 heißt ___ = Kaufpreis gleich Nennwert | Kaufpreis 100 € | doppelter Preis
Kurs unter 100 heißt die Rendite ist ___ = höher als der Nominalzins | niedriger | gleich
Kurs über 100 heißt die Rendite ist ___ = niedriger als der Nominalzins | höher | gleich
Nennwert 1 000 €, Kurs 98: Kaufpreis ___ = 980 € | 1 000 € | 98 €
Nennwert 1 000 €, Nominalzins 3 %: Kupon pro Jahr ___ = 30 € | 300 € | 3 €
Steigen die Marktzinsen, fallen die Kurse ___ = bestehender Anleihen | aller Aktien | nie
Die Rendite ist ___ = der effektive Zinssatz der Anleihe | der Nominalzins | der Kurs
Den Kurs berechnet man als ___ = Barwert aller Zahlungen zum Marktzins | Summe der Kupons | Nennwert mal Zins
Am Ende der Laufzeit bekommt man ___ = den Nennwert zurück | den Kurswert | nichts
Eine Nullkupon-Anleihe zahlt ___ = keine jährlichen Zinsen | doppelte Zinsen | nur Zinsen
Wer eine Anleihe kauft, ist ___ = Gläubiger (Geldgeber) | Miteigentümer | Schuldner`,
};
