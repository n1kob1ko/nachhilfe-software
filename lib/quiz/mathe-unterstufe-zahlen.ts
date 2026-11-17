/**
 * Mathe-Quiz Unterstufe (5. bis 8. Schulstufe), Zahlen und Algebra: die Themen, zu denen „Kopfrechnen“ nichts hat
 * (römische Zahlen, schriftliches Rechnen, Maße, Teilbarkeit, Schlussrechnung, Prozent, Terme, Gleichungen, Funktionen,
 * Gleichungssysteme). Rechen-Themen haben Erzeuger, deren falsche Antworten typische Fehler sind. Format:
 * lib/lernspiele-quiz.ts.
 */
import type { QuizBank } from "../lernspiele-quiz";
import { bruch, eins, euro, faktor, ganz, ggt, plusMinus, wahl, zahl, type Rng } from "./hilfen";

// ---------- römische Zahlen ----------

const ROEMISCH: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];
export function roemisch(n: number): string {
  let out = "";
  for (const [w, z] of ROEMISCH)
    while (n >= w) {
      out += z;
      n -= w;
    }
  return out;
}
/** Die falsche „additive“ Schreibweise (4 als IIII, 9 als VIIII), ein typischer Fehler. */
const additiv = (n: number) => roemisch(n).replace(/CM/g, "DCCCC").replace(/CD/g, "CCCC").replace(/XC/g, "LXXXX").replace(/XL/g, "XXXX").replace(/IX/g, "VIIII").replace(/IV/g, "IIII");

const roemischKarte = (rng: Rng) => {
  const n = eins(rng, [ganz(rng, 4, 49), ganz(rng, 40, 400), ganz(rng, 900, 2030)]);
  if (rng() < 0.5) return wahl(`${n} in römischen Zahlen: ___`, roemisch(n), [additiv(n), roemisch(n + 1), roemisch(n - 1), roemisch(n + 10)], "I = 1, V = 5, X = 10, L = 50, C = 100, D = 500, M = 1000. Ein kleineres Zeichen vor einem größeren wird abgezogen (IV = 4).");
  return wahl(`${roemisch(n)} = ___`, String(n), [String(n + 2), String(n - 2), String(n + 10), String(n + 20)], `${roemisch(n)} zerlegt: ${roemischZerlegt(n)}`);
};
function roemischZerlegt(n: number): string {
  const teile: string[] = [];
  for (const [w, z] of ROEMISCH)
    while (n >= w) {
      teile.push(`${z} (${w})`);
      n -= w;
    }
  return teile.join(" + ");
}

// ---------- schriftlich rechnen ----------

/** Plus ohne Übertrag: jede Stelle für sich, der Zehner der Stelle fällt weg (typischer Fehler). */
function ohneUebertrag(a: number, b: number): number {
  let r = 0;
  let f = 1;
  while (a > 0 || b > 0) {
    r += (((a % 10) + (b % 10)) % 10) * f;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
    f *= 10;
  }
  return r;
}
/** Minus „kleinere von der größeren Ziffer“ an jeder Stelle (typischer Fehler beim Borgen). */
function verdrehtMinus(a: number, b: number): number {
  let r = 0;
  let f = 1;
  while (a > 0 || b > 0) {
    r += Math.abs((a % 10) - (b % 10)) * f;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
    f *= 10;
  }
  return r;
}
const addieren = (rng: Rng) => {
  if (rng() < 0.5) {
    const a = ganz(rng, 1000, 8999);
    const b = ganz(rng, 100, 9999 - a);
    return wahl(`${a} + ${b} = ___`, zahl(a + b), [zahl(ohneUebertrag(a, b)), zahl(a + b + 10), zahl(a + b - 100)], "Stellen untereinander, von rechts beginnen, den Übertrag nicht vergessen.");
  }
  const a = ganz(rng, 2000, 9999);
  const b = ganz(rng, 100, a - 100);
  return wahl(`${a} − ${b} = ___`, zahl(a - b), [zahl(verdrehtMinus(a, b)), zahl(a - b + 10), zahl(a - b - 10)], `Probe: ${a - b} + ${b} = ${a}`);
};
const multiplizieren = (rng: Rng) => {
  const a = ganz(rng, 23, 489);
  const b = ganz(rng, 12, 89);
  const ohneVerschieben = a * Math.floor(b / 10) + a * (b % 10);
  return wahl(`${a} · ${b} = ___`, zahl(a * b), [zahl(ohneVerschieben), zahl(a * b + a), zahl(a * b - 10 * a)], `${a} · ${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10} und ${a} · ${b % 10} = ${a * (b % 10)}: Die Zehnerzeile rückt eine Stelle nach links.`);
};
const dividieren = (rng: Rng) => {
  const d = rng() < 0.5 ? ganz(rng, 3, 9) : ganz(rng, 11, 35);
  const q = ganz(rng, 21, 999);
  const rest = rng() < 0.3 ? ganz(rng, 1, d - 1) : 0;
  const a = d * q + rest;
  if (rest) return wahl(`${a} : ${d} = ___`, `${q} Rest ${rest}`, [`${q} Rest ${rest + 1}`, `${q + 1} Rest ${rest}`, `${q - 1} Rest ${rest}`], `Probe: ${q} · ${d} + ${rest} = ${a}`);
  return wahl(`${a} : ${d} = ___`, zahl(q), [zahl(q * 10), zahl(q + 1), zahl(q - 10)], `Probe: ${q} · ${d} = ${a}`);
};

// ---------- Sachaufgaben, Geld, Maße ----------

const sachaufgabe = (rng: Rng) => {
  const art = ganz(rng, 0, 3);
  if (art === 0) {
    const n = ganz(rng, 3, 9);
    const p = ganz(rng, 4, 12);
    return wahl(`${n} Kinokarten kosten je ${p} €. Wie viel zahlt man insgesamt?`, `${n * p} €`, [`${n + p} €`, `${n * p + p} €`, `${n * p - n} €`], `${n} · ${p} € = ${n * p} €`);
  }
  if (art === 1) {
    const kinder = ganz(rng, 2, 6);
    const je = ganz(rng, 3, 15);
    return wahl(`${kinder * je} Bonbons werden gerecht auf ${kinder} Kinder verteilt. Wie viele bekommt jedes?`, String(je), [String(je + 1), String(kinder * je - kinder), String(je * 2)], `${kinder * je} : ${kinder} = ${je}`);
  }
  if (art === 2) {
    const a = ganz(rng, 120, 480);
    const s = ganz(rng, 20, 90);
    const e = ganz(rng, 10, 60);
    const drin = (a % 60) + 20;
    const aus = (s % 20) + 3;
    const ein = (e % 15) + 2;
    return wahl(`Im Bus sitzen ${drin} Leute. An der Haltestelle steigen ${aus} aus und ${ein} ein. Wie viele sind jetzt im Bus?`, String(drin - aus + ein), [String(drin + aus - ein), String(drin - aus), String(drin + ein)], "Aussteigen heißt minus, einsteigen plus.");
  }
  const preis = ganz(rng, 12, 45);
  const zahlt = preis < 20 ? 20 : preis < 50 ? 50 : 100;
  return wahl(`Ein Buch kostet ${preis} €. Du zahlst mit ${zahlt} €. Wie viel bekommst du zurück?`, `${zahlt - preis} €`, [`${zahlt - preis + 10} €`, `${zahlt + preis} €`, `${zahlt - preis - 1} €`], `${zahlt} € − ${preis} € = ${zahlt - preis} €`);
};

const geld = (rng: Rng) => {
  const art = ganz(rng, 0, 2);
  if (art === 0) {
    const c = ganz(rng, 105, 2995);
    return wahl(`${c} Cent = ___`, euro(c / 100), [euro(c / 10), euro(c / 1000), euro(c / 100 + 1)], "100 Cent = 1 €: durch 100 teilen.");
  }
  if (art === 1) {
    const e = ganz(rng, 101, 1999) / 100;
    return wahl(`${euro(e)} = ___ Cent`, zahl(Math.round(e * 100)), [zahl(Math.round(e * 10)), zahl(Math.round(e * 1000)), zahl(Math.round(e * 100) + 10)], "1 € = 100 Cent: mal 100.");
  }
  const preis = ganz(rng, 120, 1880) / 100;
  const schein = preis < 5 ? 5 : preis < 10 ? 10 : 20;
  return wahl(`Du kaufst um ${euro(preis)} ein und zahlst mit ${schein} €. Rückgeld: ___`, euro(schein - preis), [euro(schein - preis + 1), euro(schein - preis - 0.1), euro(schein - Math.floor(preis))], `${schein} € − ${euro(preis)} = ${euro(schein - preis)}`);
};

const FLAECHEN = ["mm²", "cm²", "dm²", "m²", "a", "ha", "km²"];
const flaechen = (rng: Rng) => {
  const i = ganz(rng, 0, FLAECHEN.length - 2);
  const schritte = rng() < 0.7 ? 1 : 2;
  const j = Math.min(FLAECHEN.length - 1, i + schritte);
  const n = eins(rng, [ganz(rng, 2, 90), ganz(rng, 15, 95) / 10]);
  const f = 100 ** (j - i);
  if (rng() < 0.5) return wahl(`${zahl(n)} ${FLAECHEN[j]} = ___ ${FLAECHEN[i]}`, zahl(n * f), [zahl(n * 10 ** (j - i)), zahl(n * f * 10), zahl(n * f / 10)], `Flächenmaße: Umrechnungszahl 100 je Stufe (${FLAECHEN[j]} → ${FLAECHEN[i]}: · ${zahl(f)}).`);
  return wahl(`${zahl(n * f)} ${FLAECHEN[i]} = ___ ${FLAECHEN[j]}`, zahl(n), [zahl(n * 10), zahl(n / 10), zahl((n * f) / 10 ** (j - i))], `Flächenmaße: Umrechnungszahl 100 je Stufe (: ${zahl(f)}).`);
};

const RAUM = ["mm³", "cm³", "dm³", "m³"];
const volumen = (rng: Rng) => {
  const art = ganz(rng, 0, 3);
  if (art <= 1) {
    const i = ganz(rng, 0, 2);
    const n = eins(rng, [ganz(rng, 2, 9), ganz(rng, 12, 95) / 10]);
    return wahl(`${zahl(n)} ${RAUM[i + 1]} = ___ ${RAUM[i]}`, zahl(n * 1000), [zahl(n * 100), zahl(n * 10), zahl(n * 10000)], "Raummaße: Umrechnungszahl 1000 je Stufe.");
  }
  if (art === 2) {
    const n = ganz(rng, 2, 40);
    const [frage, r, f] = eins(rng, [
      [`${n} dm³ = ___ Liter`, `${n} l`, [`${n * 10} l`, `${n * 1000} l`]],
      [`${n} Liter = ___ ml`, `${n * 1000} ml`, [`${n * 100} ml`, `${n * 10} ml`]],
      [`${n} hl = ___ Liter`, `${n * 100} l`, [`${n * 10} l`, `${n * 1000} l`]],
      [`${n * 1000} cm³ = ___ Liter`, `${n} l`, [`${n * 10} l`, `${n * 100} l`]],
    ] as [string, string, string[]][]);
    return wahl(frage, r, f, "1 l = 1 dm³ = 1 000 cm³ = 1 000 ml, 1 hl = 100 l.");
  }
  const ml = ganz(rng, 1, 9) * 250;
  return wahl(`${ml} ml = ___ Liter`, `${zahl(ml / 1000)} l`, [`${zahl(ml / 100)} l`, `${zahl(ml / 10)} l`], "1 000 ml = 1 l: durch 1 000 teilen.");
};

const massstab = (rng: Rng) => {
  const m = eins(rng, [100, 200, 500, 1000, 10000, 25000, 50000, 100000]);
  const cm = ganz(rng, 2, 12);
  const wirklich = cm * m; // in cm
  const text = wirklich >= 100000 ? `${zahl(wirklich / 100000)} km` : wirklich >= 100 ? `${zahl(wirklich / 100)} m` : `${wirklich} cm`;
  const falsch1 = wirklich * 10 >= 100000 ? `${zahl((wirklich * 10) / 100000)} km` : `${zahl((wirklich * 10) / 100)} m`;
  const falsch2 = wirklich / 10 >= 100000 ? `${zahl(wirklich / 1000000)} km` : wirklich / 10 >= 100 ? `${zahl(wirklich / 1000)} m` : `${zahl(wirklich / 10)} cm`;
  if (rng() < 0.7) return wahl(`Maßstab 1 : ${zahl(m)}. ${cm} cm auf der Karte sind in Wirklichkeit ___`, text, [falsch1, falsch2, `${cm * 10} m`], `${cm} cm · ${zahl(m)} = ${zahl(wirklich)} cm = ${text}`);
  return wahl(`${cm} cm auf dem Plan sind in Wirklichkeit ${text}. Der Maßstab ist ___`, `1 : ${zahl(m)}`, [`1 : ${zahl(m * 10)}`, `1 : ${zahl(m / 10)}`, `${zahl(m)} : 1`], `${text} = ${zahl(wirklich)} cm, und ${zahl(wirklich)} : ${cm} = ${zahl(m)}.`);
};

// ---------- Teilbarkeit ----------

const teilerVon = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((t) => n % t === 0);
const teiler = (rng: Rng) => {
  const n = eins(rng, [12, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48, 50, 54, 56, 60, 63, 64, 72, 75, 80, 84, 90, 96, 100]);
  const art = ganz(rng, 0, 2);
  const t = teilerVon(n);
  if (art === 0) {
    const ja = eins(rng, t.filter((x) => x > 1 && x < n));
    const nein = [7, 8, 9, 11, 12, 13, 14, 15, 16].filter((x) => n % x !== 0);
    return wahl(`Welche Zahl ist ein Teiler von ${n}?`, String(ja), nein.sort(() => rng() - 0.5).map(String), `${n} : ${ja} = ${n / ja}, ohne Rest.`);
  }
  if (art === 1) return wahl(`Wie viele Teiler hat ${n}?`, String(t.length), [String(t.length - 1), String(t.length + 1), String(t.length - 2)], `T(${n}) = {${t.join(", ")}}`);
  const k = ganz(rng, 3, 9);
  const v = k * ganz(rng, 3, 12);
  return wahl(`Welche Zahl ist ein Vielfaches von ${k}?`, String(v), [String(v + 1), String(v - 1), String(v + 2)].filter((x) => Number(x) % k !== 0), `${v} = ${v / k} · ${k}`);
};
const istPrim = (n: number) => n > 1 && teilerVon(n).length === 2;
function primfaktoren(n: number): number[] {
  const out: number[] = [];
  for (let p = 2; n > 1; p++)
    while (n % p === 0) {
      out.push(p);
      n /= p;
    }
  return out;
}
const hoch = (fs: number[]) =>
  [...new Set(fs)]
    .map((p) => {
      const k = fs.filter((x) => x === p).length;
      return k > 1 ? `${p}^${k}` : String(p);
    })
    .join(" · ");
const primzahlen = (rng: Rng) => {
  if (rng() < 0.5) {
    const n = ganz(rng, 11, 99);
    const p = istPrim(n);
    return wahl(`Ist ${n} eine Primzahl?`, p ? "ja" : "nein", [p ? "nein" : "ja"], p ? `${n} hat nur die Teiler 1 und ${n}.` : `${n} = ${hoch(primfaktoren(n))}`);
  }
  const n = eins(rng, [12, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48, 50, 54, 56, 60, 63, 72, 75, 80, 84, 90, 96, 98, 100, 108, 120, 126, 150]);
  const fs = primfaktoren(n);
  const falsch1 = hoch([...fs.slice(0, -2), fs[fs.length - 2] * fs[fs.length - 1]].sort((a, b) => a - b));
  return wahl(`Primfaktorzerlegung von ${n}: ___`, hoch(fs), [falsch1, hoch([...fs, 2].sort((a, b) => a - b)), hoch(fs.slice(1))], "Teile immer wieder durch die kleinste Primzahl, bis 1 übrig bleibt.");
};

// ---------- Schlussrechnung, Verhältnis ----------

const direkt = (rng: Rng) => {
  const dinge = eins(rng, [
    ["kg Äpfel", "€"],
    ["Liter Benzin", "€"],
    ["Hefte", "€"],
    ["m Stoff", "€"],
  ]);
  const a = ganz(rng, 2, 8);
  const p = ganz(rng, 3, 25) / 10 + ganz(rng, 0, 4);
  const b = ganz(rng, 2, 15);
  const preis = Math.round(a * p * 100) / 100;
  const r = Math.round((preis / a) * b * 100) / 100;
  return wahl(`${a} ${dinge[0]} kosten ${euro(preis)}. Wie viel kosten ${b} ${dinge[0]}?`, euro(r), [euro((preis * a) / b), euro(preis + b - a), euro(r + preis / a)], `Erst der Preis für 1: ${euro(preis)} : ${a} = ${euro(preis / a)}, dann · ${b}.`);
};
const indirekt = (rng: Rng) => {
  const a = ganz(rng, 2, 6);
  const t = ganz(rng, 2, 12) * 2;
  const tot = a * t;
  const teil = teilerVon(tot).filter((x) => x !== a && x > 1 && x < tot && x <= 12);
  const b = eins(rng, teil.length ? teil : [1]);
  const was = eins(rng, [
    ["Arbeiter", "Tage", "eine Mauer zu bauen"],
    ["Pumpen", "Stunden", "ein Becken zu leeren"],
    ["Kinder", "Minuten", "das Klassenzimmer aufzuräumen"],
  ]);
  return wahl(`${a} ${was[0]} brauchen ${t} ${was[1]}, um ${was[2]}. Wie lange brauchen ${b} ${was[0]}?`, `${tot / b} ${was[1]}`, [`${(t * b) / a} ${was[1]}`.replace(".", ","), `${t + a - b} ${was[1]}`, `${t} ${was[1]}`], `Indirekt: mehr ${was[0]}, weniger Zeit. ${a} · ${t} = ${tot}, dann : ${b}.`);
};
const verhaeltnis = (rng: Rng) => {
  if (rng() < 0.5) {
    const a = ganz(rng, 1, 5);
    const b = ganz(rng, 1, 5);
    if (a === b) return [];
    const k = ganz(rng, 2, 9);
    const sum = (a + b) * k * ganz(rng, 1, 3);
    const teil = sum / (a + b);
    return wahl(`${sum} € werden im Verhältnis ${a} : ${b} geteilt. Der erste Teil ist ___`, `${a * teil} €`, [`${b * teil} €`, `${zahl(sum / a)} €`, `${zahl(sum / 2)} €`], `${a} + ${b} = ${a + b} Teile; ein Teil sind ${sum} € : ${a + b} = ${teil} €.`);
  }
  const g = ganz(rng, 2, 9);
  const a = ganz(rng, 1, 7);
  const b = ganz(rng, 1, 7);
  if (ggt(a, b) !== 1 || a === b) return [];
  return wahl(`Kürze das Verhältnis ${a * g} : ${b * g}`, `${a} : ${b}`, [`${b} : ${a}`, `${a * g - b * g > 0 ? a + 1 : a} : ${b + 1}`, `${a * 2} : ${b}`], `Beide Zahlen durch ${g} teilen.`);
};

// ---------- Prozent, Promille, Zinsen ----------

const aenderung = (rng: Rng) => {
  const p = eins(rng, [5, 10, 12, 15, 20, 25, 30, 40, 50, 3, 8]);
  const plus = rng() < 0.5;
  if (rng() < 0.5) return wahl(`Um ${p} % ${plus ? "erhöhen" : "vermindern"}: Mit welchem Faktor rechnet man?`, zahl(plus ? 1 + p / 100 : 1 - p / 100), [zahl(p / 100), zahl(plus ? 1 - p / 100 : 1 + p / 100), zahl(plus ? 1 + p / 10 : 1 - p / 1000)], `${plus ? "Plus" : "Minus"} ${p} %: ${plus ? "100 % + " : "100 % − "}${p} % = ${plus ? 100 + p : 100 - p} % = ${zahl(plus ? 1 + p / 100 : 1 - p / 100)}`);
  const g = ganz(rng, 2, 40) * 10;
  const r = (g * (plus ? 100 + p : 100 - p)) / 100;
  return wahl(`${g} € ${plus ? "plus" : "minus"} ${p} % = ___`, euro(r), [euro((g * p) / 100), euro(plus ? g + p : g - p), euro((g * (plus ? 100 - p : 100 + p)) / 100)], `${g} € · ${zahl(plus ? 1 + p / 100 : 1 - p / 100)} = ${euro(r)}`);
};
const promille = (rng: Rng) => {
  const g = ganz(rng, 2, 50) * 1000;
  const p = ganz(rng, 1, 9);
  if (rng() < 0.5) return wahl(`${p} ‰ von ${zahl(g)} € = ___`, euro((g * p) / 1000), [euro((g * p) / 100), euro((g * p) / 10000), euro(g / p)], `Promille heißt Tausendstel: ${zahl(g)} : 1000 · ${p}.`);
  const art = eins(rng, [
    [`${p} ‰ = ___ %`, zahl(p / 10), [zahl(p * 10), zahl(p / 100), String(p)]],
    [`${p * 10} ‰ = ___ %`, zahl(p), [zahl(p * 100), zahl(p / 10), zahl(p * 10)]],
    [`0,${p} % = ___ ‰`, String(p), [zahl(p / 100), zahl(p * 10), zahl(p / 10)]],
  ] as [string, string, string[]][]);
  return wahl(art[0], art[1], art[2], "1 % = 10 ‰");
};
const zinsen = (rng: Rng) => {
  const k = ganz(rng, 1, 40) * 500;
  const p = eins(rng, [1, 1.5, 2, 2.5, 3, 4, 5]);
  if (rng() < 0.6) {
    const z = (k * p) / 100;
    return wahl(`${zahl(k)} € liegen ein Jahr zu ${zahl(p)} % auf der Bank. Zinsen: ___`, euro(z), [euro(z * 10), euro(k + z), euro(z / 10)], `Z = K · p / 100 = ${zahl(k)} · ${zahl(p)} / 100`);
  }
  const m = eins(rng, [3, 6, 9]);
  const z = (k * p * m) / 1200;
  return wahl(`${zahl(k)} € zu ${zahl(p)} % für ${m} Monate. Zinsen: ___`, euro(z), [euro((k * p) / 100), euro((k * p * m) / 100), euro(z * 2)], `Für ${m} Monate: Jahreszinsen · ${m}/12.`);
};

// ---------- Terme, Gleichungen ----------

const termWert = (rng: Rng) => {
  const a = ganz(rng, 2, 9);
  const b = ganz(rng, 1, 15);
  const x = ganz(rng, 2, 9);
  const minus = rng() < 0.4;
  return wahl(`Setze x = ${x} ein: ${a}x ${minus ? "−" : "+"} ${b} = ___`, zahl(minus ? a * x - b : a * x + b), [zahl(minus ? a + x - b : a + x + b), zahl(minus ? a * (x - b) : a * (x + b)), zahl(minus ? a * x + b : a * x - b), `${a}${x}`], `${a}x heißt ${a} · x = ${a * x}.`);
};
const herausheben = (rng: Rng) => {
  const g = ganz(rng, 2, 9);
  const a = ganz(rng, 1, 9);
  const b = ganz(rng, 1, 9);
  if (ggt(a, b) !== 1) return [];
  const v = eins(rng, ["x", "a", "y"]);
  const m = rng() < 0.4;
  return wahl(
    `Hebe heraus: ${g * a}${v} ${m ? "−" : "+"} ${g * b} = ___`,
    `${g}(${faktor(a)}${v} ${m ? "−" : "+"} ${b})`,
    [`${g}(${faktor(a)}${v} ${m ? "−" : "+"} ${g * b})`, `${g}${v}(${a} ${m ? "−" : "+"} ${b})`, `${g * a}(${v} ${m ? "−" : "+"} ${b})`],
    `Den größten gemeinsamen Teiler ${g} herausheben, dann jedes Glied durch ${g} teilen.`,
  );
};
const probieren = (rng: Rng) => {
  const art = ganz(rng, 0, 2);
  const x = ganz(rng, 2, 30);
  if (art === 0) {
    const a = ganz(rng, 3, 40);
    return wahl(`x + ${a} = ${x + a}, also x = ___`, String(x), [String(x + 2 * a), String(x + a), String(x - 1)], `Umkehren: ${x + a} − ${a} = ${x}`);
  }
  if (art === 1) {
    const a = ganz(rng, 2, 9);
    return wahl(`${a} · x = ${a * x}, also x = ___`, String(x), [String(a * x - a), String(a * x * a), String(x + 1)], `Umkehren: ${a * x} : ${a} = ${x}`);
  }
  const a = ganz(rng, 2, 25);
  return wahl(`x − ${a} = ${x}, also x = ___`, String(x + a), [String(x - a), String(x), String(x + a + 1)], `Umkehren: ${x} + ${a} = ${x + a}`);
};
const bruchGleichung = (rng: Rng) => {
  const a = ganz(rng, 2, 9);
  const x = a * ganz(rng, 1, 12);
  const b = ganz(rng, 1, 15);
  const c = x / a + b;
  return wahl(`x/${a} + ${b} = ${c}, also x = ___`, String(x), [String(c - b), bruch(c - b, a), String(c * a - b)], `Erst − ${b}: x/${a} = ${c - b}, dann · ${a}: x = ${x}`);
};

// ---------- Wurzeln ----------

const wurzelRegel = (rng: Rng) => {
  const art = ganz(rng, 0, 2);
  if (art === 0) {
    const [a, b] = eins(rng, [
      [2, 8],
      [3, 12],
      [2, 18],
      [5, 20],
      [3, 27],
      [2, 32],
      [6, 24],
      [7, 28],
      [5, 45],
    ] as [number, number][]);
    return wahl(`√${a} · √${b} = ___`, String(Math.sqrt(a * b)), [`√${a + b}`, String(a * b), String(Math.sqrt(a * b) + 1)], `√a · √b = √(a · b) = √${a * b}`);
  }
  if (art === 1) {
    const q = ganz(rng, 2, 9);
    const r = eins(rng, [2, 3, 5, 6, 7]);
    return wahl(`√${q * q * r} = ___`, `${q}√${r}`, [`${r}√${q}`, `${q * q}√${r}`, `${q}√${r * q}`], `${q * q * r} = ${q * q} · ${r}, und √${q * q} = ${q}.`);
  }
  const [a, b] = eins(rng, [
    [72, 2],
    [50, 2],
    [27, 3],
    [48, 3],
    [80, 5],
    [98, 2],
    [75, 3],
  ] as [number, number][]);
  return wahl(`√${a} : √${b} = ___`, String(Math.sqrt(a / b)), [`√${a - b}`, String(a / b), String(Math.sqrt(a / b) + 1)], `√a : √b = √(a : b) = √${a / b}`);
};

// ---------- Funktionen, Gleichungssysteme ----------

const wachstum = (rng: Rng) => {
  const start = ganz(rng, 2, 50) * 10;
  const r = ganz(rng, 2, 25) * (rng() < 0.3 ? -1 : 1);
  const t = ganz(rng, 2, 9);
  const was = r > 0 ? `Ein Sparschwein hat ${start} €, jede Woche kommen ${r} € dazu.` : `Ein Tank hat ${start} Liter, jede Stunde werden ${-r} Liter verbraucht.`;
  const einheit = r > 0 ? "€" : "Liter";
  const v = start + r * t;
  return wahl(`${was} Wie viel nach ${t} ${r > 0 ? "Wochen" : "Stunden"}?`, `${v} ${einheit}`, [`${start + r} ${einheit}`, `${start * t} ${einheit}`, `${start - r * t} ${einheit}`, `${v + r} ${einheit}`], `Linear: Anfangswert + Änderung · Zeit = ${start} ${r > 0 ? "+" : "−"} ${Math.abs(r)} · ${t}`);
};
const linearWert = (rng: Rng) => {
  const k = ganz(rng, -5, 5) || 2;
  const d = ganz(rng, -9, 9);
  const x = ganz(rng, -4, 6);
  const term = `${faktor(k)}x${d ? ` ${plusMinus(d)}` : ""}`;
  return wahl(`f(x) = ${term}. f(${zahl(x)}) = ___`, zahl(k * x + d), [zahl(k + x + d), zahl(k * x - d), zahl(k * (x + d))], `${zahl(k)} · (${zahl(x)}) ${d ? plusMinus(d) : ""} = ${zahl(k * x + d)}`);
};
const kUndD = (rng: Rng) => {
  const k = eins(rng, [-3, -2, -1, 1, 2, 3, 4, 0.5, -0.5]);
  const d = ganz(rng, -6, 6);
  const term = `${faktor(k)}x${d ? ` ${plusMinus(d)}` : ""}`;
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl(`f(x) = ${term}. Die Steigung k ist ___`, zahl(k), [zahl(d), zahl(-k), zahl(k + 1)], "f(x) = k · x + d: k ist die Zahl vor dem x.");
  if (art === 1) return wahl(`f(x) = ${term}. Der Graph schneidet die y-Achse bei ___`, zahl(d), [zahl(k), zahl(-d), "0"], "d ist der Achsenabschnitt: dort schneidet der Graph die y-Achse (x = 0).");
  return wahl(`f(x) = ${term}. Der Graph ist ___`, k > 0 ? "steigend" : "fallend", [k > 0 ? "fallend" : "steigend", "waagrecht"], k > 0 ? "k > 0: steigend." : "k < 0: fallend.");
};
const linearSach = (rng: Rng) => {
  const g = ganz(rng, 2, 6) + 0.5 * ganz(rng, 0, 1);
  const p = ganz(rng, 10, 25) / 10;
  const km = ganz(rng, 3, 20);
  return wahl(`Taxi: Grundgebühr ${euro(g)}, pro km ${euro(p)}. Eine Fahrt über ${km} km kostet ___`, euro(g + p * km), [euro((g + p) * km), euro(p * km), euro(g * km + p)], `Kosten = ${euro(g)} + ${euro(p)} · ${km}`);
};
const gleichungssystem = (rng: Rng) => {
  const x = ganz(rng, -5, 9);
  const y = ganz(rng, -5, 9);
  const a = ganz(rng, 1, 4);
  const b = ganz(rng, 1, 3);
  const s1 = x + y;
  const s2 = a * x - b * y;
  const g2 = `${faktor(a)}x − ${faktor(b)}y = ${zahl(s2)}`;
  if (rng() < 0.5) return wahl(`x + y = ${zahl(s1)} und ${g2}. x = ___`, zahl(x), [zahl(y), zahl(s1), zahl(x + 1), zahl(-x)], `Lösung: x = ${zahl(x)}, y = ${zahl(y)}. Probe: in beide Gleichungen einsetzen.`);
  return wahl(`x + y = ${zahl(s1)} und ${g2}. Die Lösung ist ___`, `(${zahl(x)} ∣ ${zahl(y)})`, [`(${zahl(y)} ∣ ${zahl(x)})`, `(${zahl(x)} ∣ ${zahl(y + 1)})`, `(${zahl(x + 1)} ∣ ${zahl(y - 1)})`], `Probe: x = ${zahl(x)} und y = ${zahl(y)} in beide Gleichungen einsetzen, beide stimmen.`);
};
const gsText = (rng: Rng) => {
  const kinder = ganz(rng, 3, 9);
  const erw = ganz(rng, 1, 5);
  const pk = ganz(rng, 4, 9);
  const pe = pk + ganz(rng, 3, 8);
  const sum = kinder + erw;
  return wahl(`${sum} Personen zahlen ${kinder * pk + erw * pe} € Eintritt. Kinder zahlen ${pk} €, Erwachsene ${pe} €. Wie viele Kinder?`, String(kinder), [String(erw), String(kinder + 1), String(sum - 1)], `x + y = ${sum}, ${pk}x + ${pe}y = ${kinder * pk + erw * pe}. Probe: ${kinder} · ${pk} + ${erw} · ${pe}.`);
};

// ---------- Potenzen, negative Zahlen ----------

const potenzenAddieren = (rng: Rng) => {
  const a = ganz(rng, 2, 9);
  const b = ganz(rng, 1, 9);
  const n = ganz(rng, 2, 4);
  const v = eins(rng, ["x", "a", "y"]);
  const m = rng() < 0.4;
  const r = m ? a - b : a + b;
  if (r === 0 || r === 1) return [];
  return wahl(`${a}${v}^${n} ${m ? "−" : "+"} ${b}${v}^${n} = ___`, `${r}${v}^${n}`, [`${r}${v}^${2 * n}`, `${a * b}${v}^${n}`, `${r}${v}^${n + 1}`], "Nur gleichartige Potenzen kann man zusammenfassen: Die Hochzahl bleibt gleich, die Vorzahlen werden addiert.");
};
const negativVerbinden = (rng: Rng) => {
  const a = ganz(rng, -9, 9) || 3;
  const b = ganz(rng, 2, 6) * (rng() < 0.5 ? -1 : 1);
  const c = ganz(rng, -9, 9) || -4;
  const art = ganz(rng, 0, 1);
  const k = (x: number) => (x < 0 ? `(${zahl(x)})` : zahl(x));
  if (art === 0) return wahl(`${zahl(a)} + ${k(b)} · ${k(c)} = ___`, zahl(a + b * c), [zahl((a + b) * c), zahl(a - b * c), zahl(a + Math.abs(b * c))], "Punkt vor Strich; minus mal minus ist plus.");
  return wahl(`(${zahl(a)} − ${k(c)}) · ${k(b)} = ___`, zahl((a - c) * b), [zahl((a + c) * b), zahl(a - c * b), zahl(-(a - c) * b)], "Zuerst die Klammer; minus mal minus ist plus.");
};

export const MATHE_UNTERSTUFE_ZAHLEN: QuizBank = {
  "mathe.zahlen.roemisch": {
    text: `Welches Zeichen steht für 50? = L | V | C
Welches Zeichen steht für 100? = C | M | L
Welches Zeichen steht für 500? = D | M | C
Welches Zeichen steht für 1000? = M | D | C
Wie schreibt man 4 richtig? = IV | IIII | VI
Wie schreibt man 9 richtig? = IX | VIIII | XI
Wie schreibt man 40 richtig? = XL | XXXX | LX
Wie oft darf dasselbe Zeichen höchstens hintereinander stehen? = dreimal | zweimal | viermal
Eine Null gibt es bei den römischen Zahlen ___ = nicht | als O | als N`,
    erzeuge: roemischKarte,
  },
  "mathe.zahlen.addieren": { erzeuge: addieren },
  "mathe.zahlen.multiplizieren": { erzeuge: multiplizieren },
  "mathe.zahlen.dividieren": { erzeuge: dividieren },
  "mathe.zahlen.rechengesetze": `Vertauschungsgesetz: a + b = ___ = b + a | a − b | a · b
Vertauschungsgesetz: a · b = ___ = b · a | a + b | b : a
Verbindungsgesetz: (a + b) + c = ___ = a + (b + c) | (a + c) · b | a + b · c
Verteilungsgesetz: a · (b + c) = ___ = a · b + a · c | a · b + c | a + b · c
Gilt das Vertauschungsgesetz bei der Subtraktion? = nein | ja
Merke: 9 − 4 = 5, aber 4 − 9 = −5.
Gilt das Vertauschungsgesetz bei der Division? = nein | ja
Rechne geschickt: 25 · 7 · 4 = ___ = 700 | 175 | 140
Merke: 25 · 4 = 100, dann · 7.
Rechne geschickt: 37 + 48 + 63 = ___ = 148 | 138 | 158
Merke: 37 + 63 = 100, dann + 48.
Rechne geschickt: 8 · 99 = ___ = 792 | 800 | 798
Merke: 8 · 100 − 8 · 1 = 800 − 8.
Rechne geschickt: 5 · 46 · 2 = ___ = 460 | 230 | 920
Rechne geschickt: 12 · 15 = ___ = 180 | 170 | 150
Merke: 12 · 15 = 10 · 15 + 2 · 15 = 150 + 30.
Rechne geschickt: 7 · 13 + 7 · 7 = ___ = 140 | 91 | 210
Merke: 7 · (13 + 7) = 7 · 20.
Welches Gesetz: 6 · (10 + 3) = 60 + 18 = Verteilungsgesetz | Vertauschungsgesetz | Verbindungsgesetz
Welches Gesetz: 17 + 5 = 5 + 17 = Vertauschungsgesetz | Verteilungsgesetz | Verbindungsgesetz
Welches Gesetz: (4 · 5) · 3 = 4 · (5 · 3) = Verbindungsgesetz | Verteilungsgesetz | Vertauschungsgesetz
Rechne geschickt: 48 · 5 = ___ = 240 | 200 | 245
Merke: 48 · 10 : 2 = 480 : 2.
Rechne geschickt: 999 + 357 = ___ = 1 356 | 1 357 | 1 346`,
  "mathe.zahlen.sachaufgaben": {
    text: `Was macht man bei einer Sachaufgabe zuerst? = genau lesen: Was ist gegeben, was ist gesucht? | sofort rechnen | die größte Zahl nehmen
Was gehört am Ende zu jeder Sachaufgabe? = ein Antwortsatz | eine Zeichnung | eine Tabelle
„Insgesamt“ heißt meistens ___ = zusammenzählen | abziehen | teilen
„Gerecht verteilen“ heißt meistens ___ = teilen | malnehmen | zusammenzählen
„Wie viel mehr …?“ heißt meistens ___ = den Unterschied ausrechnen (minus) | malnehmen | zusammenzählen
„Doppelt so viel“ heißt ___ = mal 2 | plus 2 | durch 2
Ein Überschlag hilft, ___ = Fehler zu finden | die Aufgabe abzuschreiben | schneller zu lesen`,
    erzeuge: sachaufgabe,
    anzahl: 32,
  },
  "mathe.masse.geld": {
    text: `1 € = ___ Cent = 100 | 10 | 1 000
50 Cent sind ___ = 0,50 € | 5,00 € | 0,05 €
5 Cent sind ___ = 0,05 € | 0,50 € | 5,00 €
Welche Münze gibt es in Österreich nicht? = 3 Cent | 2 Cent | 20 Cent
Welchen Euro-Schein gibt es nicht? = 30 € | 50 € | 200 €`,
    erzeuge: geld,
  },
  "mathe.masse.flaechen": { text: `Die Umrechnungszahl bei Flächenmaßen ist ___ = 100 | 10 | 1 000
1 m² = ___ = 100 dm² | 10 dm² | 1 000 dm²
1 a = ___ = 100 m² | 10 m² | 1 000 m²
1 ha = ___ = 10 000 m² | 1 000 m² | 100 m²
1 km² = ___ = 100 ha | 10 ha | 1 000 ha
Ein Quadrat mit 1 m Seitenlänge hat ___ = 1 m² | 4 m² | 2 m²`, erzeuge: flaechen },
  "mathe.masse.volumen": { text: `Die Umrechnungszahl bei Raummaßen ist ___ = 1 000 | 100 | 10
1 Liter = ___ = 1 dm³ | 1 cm³ | 1 m³
1 m³ = ___ = 1 000 Liter | 100 Liter | 10 Liter
1 ml = ___ = 1 cm³ | 1 dm³ | 1 mm³
Ein Würfel mit 1 dm Seitenlänge fasst ___ = 1 Liter | 10 Liter | 100 ml`, erzeuge: volumen },
  "mathe.masse.massstab": {
    text: `Maßstab 1 : 100 heißt: 1 cm auf dem Plan ist in Wirklichkeit ___ = 100 cm | 100 m | 1 m²
Ein Maßstab 1 : 50 000 ist eine ___ = Verkleinerung | Vergrößerung
Ein Maßstab 10 : 1 ist eine ___ = Vergrößerung | Verkleinerung
Welcher Plan zeigt mehr Einzelheiten: 1 : 1 000 oder 1 : 100 000? = 1 : 1 000 | 1 : 100 000 | beide gleich`,
    erzeuge: massstab,
  },
  "mathe.teilbarkeit.teiler": {
    text: `Jede Zahl ist durch ___ teilbar. = 1 | 2 | 0
Eine Zahl ist durch 2 teilbar, wenn ___ = die letzte Ziffer gerade ist | die Ziffernsumme gerade ist | sie mit 2 beginnt
Eine Zahl ist durch 3 teilbar, wenn ___ = ihre Ziffernsumme durch 3 teilbar ist | sie auf 3 endet | sie ungerade ist
Eine Zahl ist durch 5 teilbar, wenn sie auf ___ endet. = 0 oder 5 | 5 | 0, 2 oder 5
Eine Zahl ist durch 10 teilbar, wenn sie auf ___ endet. = 0 | 1 | 5
Die Vielfachen von 6 sind ___ = 6, 12, 18, 24 … | 1, 2, 3, 6 | 6, 16, 26 …
Die Teiler von 6 sind ___ = 1, 2, 3, 6 | 6, 12, 18 | 2, 3`,
    erzeuge: teiler,
  },
  "mathe.teilbarkeit.primzahlen": {
    text: `Eine Primzahl hat genau ___ Teiler. = 2 | 1 | 3
Ist 1 eine Primzahl? = nein | ja
Merke: 1 hat nur einen Teiler.
Die kleinste Primzahl ist ___ = 2 | 1 | 3
Die einzige gerade Primzahl ist ___ = 2 | 4 | keine
Welche Zahl ist eine Primzahl: 29, 27 oder 21? = 29 | 27 | 21
Welche Zahl ist eine Primzahl: 31, 33 oder 39? = 31 | 33 | 39
Welche Zahl ist keine Primzahl: 51, 53 oder 47? = 51 | 53 | 47
Merke: 51 = 3 · 17.
Welche Zahl ist keine Primzahl: 91, 89 oder 97? = 91 | 89 | 97
Merke: 91 = 7 · 13.`,
    erzeuge: primzahlen,
  },
  "mathe.proportional.direkt": {
    text: `Direkt proportional heißt: doppelt so viel ___ = kostet doppelt so viel | kostet halb so viel | kostet gleich viel
Bei einer direkten Proportionalität ist der Quotient y : x ___ = immer gleich | immer 1 | immer größer
Ist das direkt proportional: Anzahl Brötchen und Preis? = ja | nein
Ist das direkt proportional: Alter und Körpergröße? = nein | ja
Ist das direkt proportional: Liter Benzin und Preis an der Tankstelle? = ja | nein`,
    erzeuge: direkt,
  },
  "mathe.proportional.indirekt": {
    text: `Indirekt proportional heißt: doppelt so viele Arbeiter brauchen ___ = halb so lange | doppelt so lange | gleich lang
Bei einer indirekten Proportionalität ist das Produkt x · y ___ = immer gleich | immer 1 | immer kleiner
Ist das indirekt proportional: Geschwindigkeit und Fahrzeit für denselben Weg? = ja | nein
Ist das indirekt proportional: Anzahl Kinder und Stück Kuchen pro Kind (ein Kuchen)? = ja | nein
Ist das indirekt proportional: Anzahl Äpfel und Preis? = nein, direkt | ja`,
    erzeuge: indirekt,
  },
  "mathe.proportional.verhaeltnisse": {
    text: `Das Verhältnis 2 : 3 ist dasselbe wie ___ = 4 : 6 | 3 : 2 | 2 : 6
Das Verhältnis 1 : 4 heißt: von 5 Teilen bekommt der erste ___ = 1 Teil | 4 Teile | 5 Teile
In einer Klasse sind 12 Mädchen und 8 Buben. Verhältnis Mädchen zu Buben: ___ = 3 : 2 | 2 : 3 | 12 : 20
Eine Proportion ist ___ = eine Gleichung aus zwei Verhältnissen | ein Bruch mit Null | ein Prozentsatz
Löse 3 : 5 = x : 20 = 12 | 15 | 4
Merke: Innenglieder mal Innenglieder = Außenglieder mal Außenglieder: 5x = 60.`,
    erzeuge: verhaeltnis,
  },
  "mathe.prozent.aenderung": {
    text: `Eine Erhöhung um 100 % heißt: der Wert ___ = verdoppelt sich | bleibt gleich | wird 100
Erst + 10 %, dann − 10 %: Ist man wieder beim Anfangswert? = nein, etwas darunter | ja, genau | nein, darüber
Merke: 100 · 1,1 · 0,9 = 99.
Der Änderungsfaktor 0,8 bedeutet ___ = minus 20 % | minus 80 % | plus 80 %
Der Änderungsfaktor 1,05 bedeutet ___ = plus 5 % | plus 105 % | plus 50 %`,
    erzeuge: aenderung,
  },
  "mathe.prozent.promille": { text: `1 ‰ ist ___ = ein Tausendstel | ein Hundertstel | ein Zehntel
1 ‰ = ___ % = 0,1 | 10 | 0,01
1 % = ___ ‰ = 10 | 0,1 | 100
Promille liest man ___ = „vom Tausend“ | „vom Hundert“ | „vom Zehntel“`, erzeuge: promille },
  "mathe.prozent.zinsen": {
    text: `Zinsen für ein Jahr: Z = ___ = K · p / 100 | K + p | K / p
Das Kapital K ist ___ = das Geld, das man anlegt oder ausleiht | der Zinssatz | die Zeit
Der Zinssatz p wird angegeben in ___ = Prozent pro Jahr | Euro | Monaten
Für ein halbes Jahr bekommt man ___ der Jahreszinsen. = die Hälfte | das Doppelte | ein Viertel
Die KESt (Kapitalertragsteuer) in Österreich auf Sparzinsen beträgt ___ = 25 % | 10 % | 50 %`,
    erzeuge: zinsen,
  },
  "mathe.terme.aufstellen": {
    text: `Das Doppelte einer Zahl x: ___ = 2x | x + 2 | x²
Eine Zahl x vermehrt um 5: ___ = x + 5 | 5x | x − 5
Eine Zahl x vermindert um 3: ___ = x − 3 | 3 − x | 3x
Die Hälfte einer Zahl x: ___ = x/2 | 2x | x − 2
Das Dreifache einer Zahl x, vermindert um 4: ___ = 3x − 4 | 3(x − 4) | 4 − 3x
Das Quadrat einer Zahl x: ___ = x² | 2x | x + x
Der Umfang eines Quadrats mit Seite a: ___ = 4a | a² | a + 4
Die Summe von x und y, verdoppelt: ___ = 2(x + y) | 2x + y | x + 2y
Peter ist x Jahre alt, seine Schwester 3 Jahre älter: ___ = x + 3 | 3x | x − 3
Ein Heft kostet x €. 5 Hefte kosten ___ = 5x | x + 5 | x/5`,
    erzeuge: termWert,
    anzahl: 30,
  },
  "mathe.terme.herausheben": { text: `Herausheben ist das Gegenteil von ___ = Ausmultiplizieren | Kürzen | Erweitern
ax + ay = ___ = a(x + y) | a(xy) | x(a + y)
3x + 3 = ___ = 3(x + 1) | 3x(1) | 3(x + 3)
x² + x = ___ = x(x + 1) | x(x + x) | 2x
Merke: x² = x · x, also x herausheben: x · (x + 1).
5ab − 10a = ___ = 5a(b − 2) | 5(ab − 10) | 5a(b − 10)`, erzeuge: herausheben },
  "mathe.gleichungen.probieren": { text: `Eine Lösung einer Gleichung ist eine Zahl, die ___ = die Gleichung wahr macht | immer 0 ist | man frei wählt
Welche Zahl ist die Lösung von x + 7 = 12? = 5 | 19 | 7
Welche Zahl ist die Lösung von 4 · x = 28? = 7 | 24 | 32
Mit der Probe prüft man ___ = ob die Lösung stimmt | wie lang die Rechnung ist | die Einheit`, erzeuge: probieren },
  "mathe.gleichungen.formeln": `A = a · b nach b umgeformt: b = ___ = A/a | A · a | A − a
U = 2a + 2b nach a umgeformt: a = ___ = (U − 2b)/2 | U − 2b | U/2 + b
v = s/t nach s umgeformt: s = ___ = v · t | v/t | t/v
v = s/t nach t umgeformt: t = ___ = s/v | v · s | v/s
A = (a · h)/2 nach h umgeformt: h = ___ = 2A/a | A/(2a) | A · a/2
V = a · b · c nach c umgeformt: c = ___ = V/(a · b) | V · a · b | V − a − b
U = 2r · π nach r umgeformt: r = ___ = U/(2π) | U · 2π | U − 2π
F = m · a nach m umgeformt: m = ___ = F/a | F · a | a/F
Beim Umformen macht man auf beiden Seiten ___ = dasselbe | etwas Verschiedenes | nur links etwas
Z = K · p/100 nach p umgeformt: p = ___ = 100Z/K | Z · K/100 | K/(100Z)
y = kx + d nach x umgeformt: x = ___ = (y − d)/k | y − d − k | (y + d)/k
A = πr² nach r umgeformt: r = ___ = √(A/π) | A/π | A/(2π)
c² = a² + b² nach a umgeformt: a = ___ = √(c² − b²) | c − b | √(c² + b²)
P = U · I nach I umgeformt: I = ___ = P/U | P · U | U/P
D = m/V nach V umgeformt: V = ___ = m/D | m · D | D/m`,
  "mathe.gleichungen.brueche": { text: `x/3 = 5, also x = ___ = 15 | 5/3 | 8
Merke: Beide Seiten mal 3.
x/2 + x/2 = ___ = x | x/4 | 2x
Bei Gleichungen mit Brüchen hilft es, beide Seiten mit ___ zu multiplizieren. = dem gemeinsamen Nenner | dem Zähler | 0
2x/5 = 4, also x = ___ = 10 | 8/5 | 20`, erzeuge: bruchGleichung },
  "mathe.wurzeln.regeln": { text: `√a · √b = ___ = √(a · b) | √(a + b) | a · b
√a + √b = √(a + b)? = nein | ja
Merke: √9 + √16 = 3 + 4 = 7, aber √25 = 5.
(√a)² = ___ = a (für a ≥ 0) | 2a | √(2a)
√(a²) = ___ = der Betrag von a | a² | 2a
Merke: Die Wurzel ist nie negativ: √((−3)²) = 3.
√(a/b) = ___ = √a/√b | a/√b | √a/b`, erzeuge: wurzelRegel },
  "mathe.wurzeln.reell": `Ist √2 rational? = nein, irrational | ja
Ist √16 rational? = ja | nein, irrational
Merke: √16 = 4.
Ist π rational? = nein, irrational | ja
Ist 0,333… (periodisch) rational? = ja | nein, irrational
Merke: 0,333… = 1/3.
Ist 0,75 rational? = ja | nein, irrational
Ist √10 rational? = nein, irrational | ja
Ist √49 rational? = ja | nein, irrational
Irrationale Zahlen haben ___ = unendlich viele Nachkommastellen ohne Periode | eine Periode | keine Nachkommastellen
Rationale Zahlen kann man immer schreiben als ___ = Bruch aus ganzen Zahlen | Wurzel | Potenz von 10
Alle rationalen und irrationalen Zahlen zusammen heißen ___ = reelle Zahlen | natürliche Zahlen | ganze Zahlen
Das Zeichen für die reellen Zahlen ist ___ = ℝ | ℚ | ℕ
Das Zeichen für die rationalen Zahlen ist ___ = ℚ | ℝ | ℤ
Zwischen welchen ganzen Zahlen liegt √20? = 4 und 5 | 2 und 3 | 10 und 11
Merke: 4² = 16 und 5² = 25.
Zwischen welchen ganzen Zahlen liegt √50? = 7 und 8 | 5 und 6 | 25 und 26
√2 ist ungefähr ___ = 1,41 | 1,21 | 1,73
Ist −5 rational? = ja | nein`,
  "mathe.funktionen.wachstum": { text: `Lineares Wachstum heißt: in gleichen Zeitabständen ___ = kommt immer gleich viel dazu | verdoppelt sich der Wert | kommt nichts dazu
Der Graph eines linearen Wachstums ist ___ = eine Gerade | eine Kurve nach oben | ein Kreis
Bei linearer Abnahme ist die Steigung ___ = negativ | positiv | 0`, erzeuge: wachstum },
  "mathe.funktionen.graphen": `Ein waagrechtes Stück im Weg-Zeit-Diagramm bedeutet ___ = Stillstand | schnelles Fahren | Rückwärtsfahren
Je steiler der Graph im Weg-Zeit-Diagramm, desto ___ = schneller | langsamer | länger
Auf der waagrechten Achse steht meistens ___ = die Zeit (x-Achse) | die Höhe | nichts
Ein Graph, der von links nach rechts nach unten geht, ist ___ = fallend | steigend | konstant
Füllt man eine Vase gleichmäßig, steigt das Wasser in einem engen Teil ___ = schneller | langsamer | gar nicht
Im Temperatur-Zeit-Diagramm: der höchste Punkt zeigt ___ = die höchste Temperatur | die längste Zeit | den Anfang
Ein Punkt (3 ∣ 5) liegt ___ = 3 nach rechts, 5 nach oben | 5 nach rechts, 3 nach oben | 3 nach unten
Ein Graph durch den Ursprung beginnt bei ___ = (0 ∣ 0) | (1 ∣ 1) | (0 ∣ 1)
Zwei Graphen schneiden sich: dort haben beide ___ = denselben Wert | die gleiche Steigung | keinen Wert
Ein gerader Graph bedeutet: die Änderung ist ___ = gleichmäßig | immer schneller | unregelmäßig
Im Weg-Zeit-Diagramm: Der Graph geht wieder nach unten. Das bedeutet ___ = man geht zurück, Richtung Start | man wird schneller | man steht
Wofür steht der Wert auf der y-Achse beim Graphen „Handy-Akku in %“? = den Ladestand | die Uhrzeit | die Helligkeit`,
  "mathe.funktionen.darstellungen": { text: `Eine Funktion ordnet jedem x-Wert ___ = genau einen y-Wert zu | zwei y-Werte zu | keinen Wert zu
Eine Funktion kann man darstellen als ___ = Wertetabelle, Graph oder Gleichung | nur als Text | nur als Bild
f(x) = 2x + 1. Welcher Punkt liegt auf dem Graphen? = (1 ∣ 3) | (3 ∣ 1) | (0 ∣ 2)
f(x) = x². Welcher Punkt liegt auf dem Graphen? = (−2 ∣ 4) | (2 ∣ −4) | (4 ∣ 2)
Wertetabelle: x = 0, 1, 2 und y = 3, 5, 7. Die Gleichung ist ___ = y ＝ 2x + 3 | y ＝ 3x + 2 | y ＝ x + 3`, erzeuge: linearWert },
  "mathe.funktionen.linear": { text: `Der Graph einer linearen Funktion ist ___ = eine Gerade | eine Parabel | eine Hyperbel
k = 0: der Graph ist ___ = waagrecht | senkrecht | steigend
Die Steigung k sagt: geht man 1 nach rechts, geht es ___ = k nach oben | 1 nach oben | d nach oben
Zwei Geraden mit gleichem k sind ___ = parallel | normal | gleich`, erzeuge: kUndD },
  "mathe.funktionen.linear-sach": { text: `Bei Handykosten mit Grundgebühr ist die Grundgebühr in f(x) = kx + d das ___ = d | k | x
Der Preis pro Minute ist in f(x) = kx + d das ___ = k | d | f(x)
Ein Wasserbecken wird geleert. Die Steigung der Funktion ist ___ = negativ | positiv | null
Eine Kerze ist 20 cm lang und brennt 2 cm pro Stunde ab: h(t) = ___ = 20 − 2t | 2t − 20 | 20t − 2
Wann ist die Kerze (20 cm, 2 cm pro Stunde) ganz abgebrannt? = nach 10 Stunden | nach 20 Stunden | nach 2 Stunden`, erzeuge: linearSach },
  "mathe.gleichungssysteme.rechnerisch": { text: `Ein lineares Gleichungssystem mit zwei Variablen braucht ___ Gleichungen. = zwei | eine | drei
Beim Einsetzungsverfahren ___ = setzt man eine ausgedrückte Variable ein | addiert man beide Gleichungen | zeichnet man beide Geraden
Beim Additionsverfahren ___ = fällt durch Addieren eine Variable weg | multipliziert man die Lösungen | setzt man x ＝ 0
Beim Gleichsetzungsverfahren ___ = setzt man zwei Ausdrücke für x gleich | addiert man alles | zeichnet man
Welche Lösung (x ∣ y) hat x + y = 10 und x − y = 2? = (6 ∣ 4) | (4 ∣ 6) | (8 ∣ 2)`, erzeuge: gleichungssystem },
  "mathe.gleichungssysteme.grafisch": `Grafisch lösen heißt: beide Geraden zeichnen und ___ ablesen. = den Schnittpunkt | die Steigung | den Ursprung
Zwei parallele Geraden (verschieden) haben ___ = keine Lösung | genau eine Lösung | unendlich viele Lösungen
Zwei Geraden, die genau aufeinander liegen, haben ___ = unendlich viele Lösungen | keine Lösung | genau eine Lösung
Zwei Geraden mit verschiedener Steigung haben ___ = genau eine Lösung | keine Lösung | unendlich viele Lösungen
y = 2x + 1 und y = 2x − 3 haben ___ = keine Lösung | genau eine Lösung | unendlich viele Lösungen
Merke: gleiche Steigung, verschiedener Achsenabschnitt: parallel.
y = x und y = −x schneiden sich in ___ = (0 ∣ 0) | (1 ∣ 1) | (1 ∣ −1)
y = x + 2 und y = 4 schneiden sich bei x = ___ = 2 | 4 | 6
Der Schnittpunkt (2 ∣ 3) erfüllt ___ = beide Gleichungen | nur die erste Gleichung | keine Gleichung
y = 3 ist eine Gerade ___ = waagrecht | senkrecht | durch den Ursprung
x = 3 ist eine Gerade ___ = senkrecht | waagrecht | durch den Ursprung
Bei der grafischen Lösung kann das Ergebnis ___ sein. = ungenau | immer exakt | nie richtig
y = x + 1 und y = −x + 5 schneiden sich in ___ = (2 ∣ 3) | (3 ∣ 2) | (1 ∣ 5)
y = 2x und y = x + 3 schneiden sich in ___ = (3 ∣ 6) | (6 ∣ 3) | (2 ∣ 4)
Wie viele Schnittpunkte können zwei verschiedene Geraden höchstens haben? = einen | zwei | unendlich viele`,
  "mathe.gleichungssysteme.text": { text: `Bei Textaufgaben mit zwei Unbekannten braucht man ___ = zwei Gleichungen | eine Gleichung | drei Gleichungen
„Zusammen 20 Tiere“ heißt als Gleichung: ___ = x + y ＝ 20 | x · y ＝ 20 | x − y ＝ 20
„x ist um 4 größer als y“ heißt: ___ = x ＝ y + 4 | y ＝ x + 4 | x ＝ 4y
„x ist doppelt so groß wie y“ heißt: ___ = x ＝ 2y | y ＝ 2x | x ＝ y + 2`, erzeuge: gsText },
  "mathe.potenzen.addieren": { text: `3x² + 5x² = ___ = 8x² | 8x⁴ | 15x²
x² + x³ kann man zusammenfassen? = nein | ja, zu x⁵ | ja, zu 2x⁵
Merke: Nur gleiche Hochzahlen (und gleiche Basis) lassen sich zusammenfassen.
4a³ − a³ = ___ = 3a³ | 4 | 3
x² + x² = ___ = 2x² | x⁴ | 2x⁴`, erzeuge: potenzenAddieren },
  "mathe.negativ.verbinden": { text: `(−3) · (−4) = ___ = 12 | −12 | −7
(−20) : 4 = ___ = −5 | 5 | −80
−3 + (−5) = ___ = −8 | 8 | 2
(−2)² = ___ = 4 | −4 | 2
−2² = ___ = −4 | 4 | −2
Merke: Ohne Klammer wird nur die 2 quadriert.
(−1)³ = ___ = −1 | 1 | −3`, erzeuge: negativVerbinden },
};

