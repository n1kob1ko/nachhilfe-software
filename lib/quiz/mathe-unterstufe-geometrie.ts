/**
 * Mathe-Quiz Unterstufe (5. bis 8. Schulstufe), Geometrie, Statistik und Wahrscheinlichkeit: Begriffe als Text,
 * Flächen, Körper, Pythagoras und Kennzahlen mit Erzeugern (falsche Antworten = typische Fehler: Umfang statt Fläche,
 * Durchmesser statt Radius, a + b statt √(a² + b²) …). Format: lib/lernspiele-quiz.ts.
 */
import type { QuizBank } from "../lernspiele-quiz";
import { bruch, eins, ganz, wahl, zahl, type Rng } from "./hilfen";

const cm = (x: number, hoch = "") => `${zahl(x)} cm${hoch}`;

// ---------- Koordinaten, Winkel ----------

const koordinaten = (rng: Rng) => {
  const x = ganz(rng, -6, 6) || 2;
  const y = ganz(rng, -6, 6) || -3;
  if (rng() < 0.5) {
    const q = x > 0 && y > 0 ? "I" : x < 0 && y > 0 ? "II" : x < 0 && y < 0 ? "III" : "IV";
    return wahl(`In welchem Quadranten liegt P(${zahl(x)} ∣ ${zahl(y)})?`, q, ["I", "II", "III", "IV"].filter((z) => z !== q), "Die Quadranten zählt man gegen den Uhrzeigersinn: I rechts oben, II links oben, III links unten, IV rechts unten.");
  }
  return wahl(`P liegt ${Math.abs(x)} ${x > 0 ? "rechts" : "links"} vom Ursprung und ${Math.abs(y)} ${y > 0 ? "oben" : "unten"}. P = ___`, `(${zahl(x)} ∣ ${zahl(y)})`, [`(${zahl(y)} ∣ ${zahl(x)})`, `(${zahl(-x)} ∣ ${zahl(y)})`, `(${zahl(x)} ∣ ${zahl(-y)})`], "Zuerst der x-Wert (rechts oder links), dann der y-Wert (oben oder unten).");
};

const winkelArt = (w: number) => (w < 90 ? "spitz" : w === 90 ? "recht" : w < 180 ? "stumpf" : w === 180 ? "gestreckt" : "erhaben");
const winkelMessen = (rng: Rng) => {
  const w = eins(rng, [ganz(rng, 5, 85), 90, ganz(rng, 95, 175), 180, ganz(rng, 185, 355)]);
  const a = winkelArt(w);
  return wahl(`Ein Winkel mit ${w}° ist ___`, a === "recht" ? "ein rechter Winkel" : a === "gestreckt" ? "ein gestreckter Winkel" : `${a}`, ["spitz", "stumpf", "erhaben", "ein rechter Winkel"].filter((x) => x !== a && !(a === "recht" && x === "ein rechter Winkel")), "spitz < 90° = recht < stumpf < 180° = gestreckt < erhaben < 360°");
};
const winkelBeziehung = (rng: Rng) => {
  const art = ganz(rng, 0, 3);
  if (art === 0) {
    const a = ganz(rng, 20, 160);
    return wahl(`Nebenwinkel: α = ${a}°, dann ist β = ___`, `${180 - a}°`, [`${90 - a > 0 ? 90 - a : 360 - a}°`, `${a}°`, `${360 - a}°`], "Nebenwinkel ergeben zusammen 180°.");
  }
  if (art === 1) {
    const a = ganz(rng, 20, 100);
    const b = ganz(rng, 20, 150 - a);
    return wahl(`Im Dreieck: α = ${a}°, β = ${b}°. γ = ___`, `${180 - a - b}°`, [`${360 - a - b}°`, `${a + b}°`, `${90 - Math.min(a, b)}°`], "Die Winkelsumme im Dreieck ist 180°.");
  }
  if (art === 2) {
    const a = ganz(rng, 50, 120);
    const b = ganz(rng, 50, 120);
    const c = ganz(rng, 50, 120);
    if (a + b + c >= 350) return [];
    return wahl(`Im Viereck: α = ${a}°, β = ${b}°, γ = ${c}°. δ = ___`, `${360 - a - b - c}°`, [`${180 - ((a + b + c) % 180)}°`, `${Math.abs(360 - a - b - c - 10)}°`, `${a + b + c - 180}°`], "Die Winkelsumme im Viereck ist 360°.");
  }
  const a = ganz(rng, 25, 155);
  return wahl(`Scheitelwinkel: α = ${a}°, dann ist der gegenüberliegende Winkel ___`, `${a}°`, [`${180 - a}°`, `${360 - a}°`, `${90}°`], "Scheitelwinkel sind gleich groß.");
};

// ---------- Flächen ----------

const rechteck = (rng: Rng) => {
  const a = ganz(rng, 3, 25);
  const b = ganz(rng, 2, 20);
  if (rng() < 0.5) return wahl(`Rechteck: a = ${cm(a)}, b = ${cm(b)}. Flächeninhalt A = ___`, cm(a * b, "²"), [cm(2 * (a + b), "²"), cm(a + b, "²"), cm(a * b)], "A = a · b, Einheit cm².");
  if (rng() < 0.5) return wahl(`Rechteck: a = ${cm(a)}, b = ${cm(b)}. Umfang u = ___`, cm(2 * (a + b)), [cm(a * b), cm(a + b), cm(2 * a + b)], "u = 2a + 2b");
  return wahl(`Quadrat: a = ${cm(a)}. Flächeninhalt A = ___`, cm(a * a, "²"), [cm(4 * a, "²"), cm(2 * a, "²"), cm(a * a)], "A = a · a = a²");
};
const umkehr = (rng: Rng) => {
  const a = ganz(rng, 3, 20);
  const b = ganz(rng, 2, 15);
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl(`Rechteck: A = ${cm(a * b, "²")}, a = ${cm(a)}. b = ___`, cm(b), [cm(a * b - a), cm(a * b * a), cm(b + 1)], `b = A : a = ${a * b} : ${a}`);
  if (art === 1) return wahl(`Rechteck: u = ${cm(2 * (a + b))}, a = ${cm(a)}. b = ___`, cm(b), [cm(2 * (a + b) - a), cm(a + b - a / 2), cm((2 * (a + b)) / a)], `b = (u − 2a) : 2 = (${2 * (a + b)} − ${2 * a}) : 2`);
  const h = 2 * ganz(rng, 2, 10);
  return wahl(`Dreieck: A = ${cm((a * h) / 2, "²")}, Grundlinie c = ${cm(a)}. Höhe h = ___`, cm(h), [cm(h / 2), cm((a * h) / 2 - a), cm(h * 2)], `h = 2A : c = ${a * h} : ${a}`);
};
const dreieck = (rng: Rng) => {
  const c = ganz(rng, 3, 20);
  const h = ganz(rng, 2, 16);
  return wahl(`Dreieck: c = ${cm(c)}, h = ${cm(h)}. A = ___`, cm((c * h) / 2, "²"), [cm(c * h, "²"), cm(c + h, "²"), cm((c + h) / 2, "²")], "A = c · h / 2: das Dreieck ist ein halbes Rechteck.");
};
const vierecke = (rng: Rng) => {
  const art = ganz(rng, 0, 3);
  if (art === 0) {
    const a = ganz(rng, 4, 20);
    const h = ganz(rng, 2, 12);
    return wahl(`Parallelogramm: a = ${cm(a)}, h = ${cm(h)}. A = ___`, cm(a * h, "²"), [cm((a * h) / 2, "²"), cm(2 * (a + h), "²"), cm(a + h, "²")], "A = a · h (Grundlinie mal Höhe)");
  }
  if (art === 1) {
    const e = ganz(rng, 4, 20);
    const f = ganz(rng, 2, 16);
    return wahl(`Raute oder Deltoid: Diagonalen e = ${cm(e)}, f = ${cm(f)}. A = ___`, cm((e * f) / 2, "²"), [cm(e * f, "²"), cm(e + f, "²"), cm((e + f) / 2, "²")], "A = e · f / 2");
  }
  const a = ganz(rng, 6, 20);
  const c = ganz(rng, 2, a - 2);
  const h = ganz(rng, 2, 12);
  return wahl(`Trapez: a = ${cm(a)}, c = ${cm(c)}, h = ${cm(h)}. A = ___`, cm(((a + c) * h) / 2, "²"), [cm((a + c) * h, "²"), cm((a * c * h) / 2, "²"), cm(a * h, "²")], "A = (a + c) · h / 2");
};
const kreis = (rng: Rng) => {
  const r = ganz(rng, 2, 15);
  const art = ganz(rng, 0, 2);
  const g = (x: number) => cm(Math.round(x * 100) / 100);
  if (art === 0) return wahl(`Kreis: r = ${cm(r)}. Umfang u = ___ (gerundet)`, g(2 * r * Math.PI), [g(r * Math.PI), g(r * r * Math.PI), g(4 * r * Math.PI)], "u = 2 · r · π = d · π");
  if (art === 1) return wahl(`Kreis: r = ${cm(r)}. Flächeninhalt A = ___ (gerundet)`, `${zahl(Math.round(r * r * Math.PI * 100) / 100)} cm²`, [`${zahl(Math.round(2 * r * Math.PI * 100) / 100)} cm²`, `${zahl(Math.round(4 * r * r * Math.PI * 100) / 100)} cm²`, `${zahl(Math.round(r * Math.PI * 100) / 100)} cm²`], "A = r² · π (mit dem Radius, nicht dem Durchmesser)");
  const d = 2 * r;
  return wahl(`Kreis: d = ${cm(d)}. Flächeninhalt A = ___ (gerundet)`, `${zahl(Math.round(r * r * Math.PI * 100) / 100)} cm²`, [`${zahl(Math.round(d * d * Math.PI * 100) / 100)} cm²`, `${zahl(Math.round(d * Math.PI * 100) / 100)} cm²`, `${zahl(Math.round(2 * d * Math.PI * 100) / 100)} cm²`], `Zuerst r = d : 2 = ${cm(r)}, dann A = r² · π.`);
};
const kreisteile = (rng: Rng) => {
  const r = ganz(rng, 2, 12);
  const w = eins(rng, [30, 45, 60, 90, 120, 180, 270]);
  const flaeche = (r * r * Math.PI * w) / 360;
  const bogen = (2 * r * Math.PI * w) / 360;
  if (rng() < 0.5) return wahl(`Kreissektor: r = ${cm(r)}, α = ${w}°. A = ___ (gerundet)`, `${zahl(flaeche)} cm²`, [`${zahl(r * r * Math.PI)} cm²`, `${zahl(bogen)} cm²`, `${zahl((r * r * Math.PI * w) / 180)} cm²`], `A = r² · π · α/360° = ${r}² · π · ${w}/360`);
  return wahl(`Kreisbogen: r = ${cm(r)}, α = ${w}°. b = ___ (gerundet)`, cm(Math.round(bogen * 100) / 100), [cm(Math.round(flaeche * 100) / 100), cm(Math.round(2 * r * Math.PI * 100) / 100), cm(Math.round(((r * Math.PI * w) / 360) * 100) / 100)], `b = 2 · r · π · α/360°`);
};
const zusammengesetzt = (rng: Rng) => {
  const a = ganz(rng, 6, 14);
  const b = ganz(rng, 5, 12);
  const c = ganz(rng, 2, a - 2);
  const d = ganz(rng, 2, b - 2);
  return wahl(`Ein Rechteck ${a} cm × ${b} cm, aus einer Ecke ist ein Rechteck ${c} cm × ${d} cm ausgeschnitten. A = ___`, cm(a * b - c * d, "²"), [cm(a * b, "²"), cm(a * b + c * d, "²"), cm(a * b - c - d, "²")], `Großes Rechteck minus Ausschnitt: ${a * b} − ${c * d}`);
};

// ---------- Körper ----------

const quader = (rng: Rng) => {
  const a = ganz(rng, 2, 12);
  const b = ganz(rng, 2, 10);
  const c = ganz(rng, 2, 10);
  if (rng() < 0.3) return wahl(`Würfel: a = ${cm(a)}. Volumen V = ___`, cm(a ** 3, "³"), [cm(6 * a * a, "³"), cm(3 * a, "³"), cm(a * a, "³")], "V = a · a · a = a³");
  if (rng() < 0.5) return wahl(`Quader: ${a} cm × ${b} cm × ${c} cm. Volumen V = ___`, cm(a * b * c, "³"), [cm(2 * (a * b + a * c + b * c), "³"), cm(a + b + c, "³"), cm(a * b * c, "²")], "V = a · b · c");
  return wahl(`Quader: ${a} cm × ${b} cm × ${c} cm. Oberfläche O = ___`, cm(2 * (a * b + a * c + b * c), "²"), [cm(a * b * c, "²"), cm(a * b + a * c + b * c, "²"), cm(4 * (a + b + c), "²")], "O = 2 · (ab + ac + bc): sechs Flächen, je zwei gleich.");
};
const prisma = (rng: Rng) => {
  const g = ganz(rng, 3, 12);
  const hg = 2 * ganz(rng, 1, 6);
  const h = ganz(rng, 3, 15);
  const G = (g * hg) / 2;
  return wahl(`Dreiecksprisma: Grundfläche ist ein Dreieck mit c = ${cm(g)} und h = ${cm(hg)}, Körperhöhe ${cm(h)}. V = ___`, cm(G * h, "³"), [cm(g * hg * h, "³"), cm((G * h) / 3, "³"), cm(G + h, "³")], `V = G · h; G = ${g} · ${hg} / 2 = ${zahl(G)} cm²`);
};
const pyramide = (rng: Rng) => {
  const a = ganz(rng, 2, 12);
  const h = 3 * ganz(rng, 1, 8);
  return wahl(`Quadratische Pyramide: a = ${cm(a)}, h = ${cm(h)}. V = ___`, cm((a * a * h) / 3, "³"), [cm(a * a * h, "³"), cm((a * a * h) / 2, "³"), cm((a * h) / 3, "³")], "V = G · h / 3 = a² · h / 3");
};
const zylinder = (rng: Rng) => {
  const r = ganz(rng, 1, 10);
  const h = ganz(rng, 2, 20);
  if (rng() < 0.6) return wahl(`Zylinder: r = ${cm(r)}, h = ${cm(h)}. V = ___ (gerundet)`, `${zahl(r * r * Math.PI * h)} cm³`, [`${zahl(2 * r * Math.PI * h)} cm³`, `${zahl(4 * r * r * Math.PI * h)} cm³`, `${zahl((r * r * Math.PI * h) / 3)} cm³`], "V = r² · π · h");
  return wahl(`Zylinder: r = ${cm(r)}, h = ${cm(h)}. Mantelfläche M = ___ (gerundet)`, `${zahl(2 * r * Math.PI * h)} cm²`, [`${zahl(r * r * Math.PI * h)} cm²`, `${zahl(r * Math.PI * h)} cm²`, `${zahl(2 * r * Math.PI * h + 2 * r * r * Math.PI)} cm²`], "M = u · h = 2 · r · π · h");
};
const kegel = (rng: Rng) => {
  const r = ganz(rng, 1, 9);
  const h = 3 * ganz(rng, 1, 6);
  return wahl(`Kegel: r = ${cm(r)}, h = ${cm(h)}. V = ___ (gerundet)`, `${zahl((r * r * Math.PI * h) / 3)} cm³`, [`${zahl(r * r * Math.PI * h)} cm³`, `${zahl((2 * r * Math.PI * h) / 3)} cm³`, `${zahl((r * Math.PI * h) / 3)} cm³`], "V = r² · π · h / 3: ein Drittel des Zylinders");
};
const DICHTEN: [string, number][] = [
  ["Wasser", 1],
  ["Eisen", 7.9],
  ["Aluminium", 2.7],
  ["Holz (Fichte)", 0.5],
  ["Gold", 19.3],
  ["Glas", 2.5],
];
const dichte = (rng: Rng) => {
  const [stoff, d] = eins(rng, DICHTEN);
  const v = ganz(rng, 2, 50) * 10;
  return wahl(`${v} cm³ ${stoff} (Dichte ${zahl(d)} g/cm³) haben die Masse ___`, `${zahl(v * d)} g`, [`${zahl(v / d)} g`, `${zahl(v + d)} g`, `${zahl((v * d) / 10)} g`], "m = V · ρ (Volumen mal Dichte)");
};

// ---------- Pythagoras, Ähnlichkeit ----------

const TRIPEL: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];
const tripel = (rng: Rng): [number, number, number] => {
  const [a, b, c] = eins(rng, TRIPEL);
  const k = eins(rng, a === 3 ? [1, 2, 3, 4, 5, 10] : [1, 2]);
  return [a * k, b * k, c * k];
};
const pythSeite = (rng: Rng) => {
  const [a, b, c] = tripel(rng);
  if (rng() < 0.5) return wahl(`Rechtwinkeliges Dreieck: Katheten a = ${cm(a)}, b = ${cm(b)}. Hypotenuse c = ___`, cm(c), [cm(a + b), cm(Math.round(Math.sqrt(Math.abs(b * b - a * a)) * 100) / 100), cm(c + 1)], `c² = a² + b² = ${a * a} + ${b * b} = ${c * c}`);
  return wahl(`Rechtwinkeliges Dreieck: Hypotenuse c = ${cm(c)}, Kathete a = ${cm(a)}. b = ___`, cm(b), [cm(c - a), cm(Math.round(Math.sqrt(c * c + a * a) * 100) / 100), cm(b + 1)], `b² = c² − a² = ${c * c} − ${a * a} = ${b * b}`);
};
const pythFigur = (rng: Rng) => {
  const [a, b, c] = tripel(rng);
  if (rng() < 0.5) return wahl(`Rechteck ${cm(a)} × ${cm(b)}. Länge der Diagonale: ___`, cm(c), [cm(a + b), cm(2 * c), cm(Math.round(Math.sqrt(a * b) * 100) / 100)], `d = √(a² + b²) = √${c * c}`);
  const s = 2 * ganz(rng, 2, 10);
  return wahl(`Gleichseitiges Dreieck mit Seite ${cm(s)}. Höhe h = ___ (gerundet)`, cm(Math.round((s / 2) * Math.sqrt(3) * 100) / 100), [cm(s / 2), cm(Math.round(Math.sqrt(s * s + (s / 2) ** 2) * 100) / 100), cm(s)], `h = √(s² − (s/2)²) = s/2 · √3`);
};
const pythKoerper = (rng: Rng) => {
  const a = ganz(rng, 2, 9);
  if (rng() < 0.5) return wahl(`Würfel mit a = ${cm(a)}. Raumdiagonale d = ___ (gerundet)`, cm(Math.round(a * Math.sqrt(3) * 100) / 100), [cm(Math.round(a * Math.sqrt(2) * 100) / 100), cm(3 * a), cm(a * a)], "d = a · √3 (Flächendiagonale a · √2)");
  return wahl(`Würfel mit a = ${cm(a)}. Flächendiagonale = ___ (gerundet)`, cm(Math.round(a * Math.sqrt(2) * 100) / 100), [cm(Math.round(a * Math.sqrt(3) * 100) / 100), cm(2 * a), cm(a * a)], "d = √(a² + a²) = a · √2");
};
const pythUmkehr = (rng: Rng) => {
  const [a, b, c] = tripel(rng);
  const echt = rng() < 0.5;
  const cc = echt ? c : c + eins(rng, [1, -1, 2]);
  return wahl(`Ist ein Dreieck mit ${a} cm, ${b} cm und ${cc} cm rechtwinkelig?`, echt ? "ja" : "nein", [echt ? "nein" : "ja"], `${a}² + ${b}² = ${a * a + b * b}, ${cc}² = ${cc * cc}: ${echt ? "gleich, also rechtwinkelig" : "nicht gleich"}.`);
};
const aehnlich = (rng: Rng) => {
  const k = eins(rng, [2, 3, 0.5, 1.5, 4]);
  const a = 2 * ganz(rng, 1, 8);
  if (rng() < 0.6) return wahl(`Ähnliche Figuren mit Faktor k = ${zahl(k)}: Eine Seite ${cm(a)} wird ___`, cm(a * k), [cm(a + k), cm(a * k * k), cm(a / k)], "Alle Längen werden mit k multipliziert, die Winkel bleiben gleich.");
  return wahl(`Ähnliche Figuren mit Faktor k = ${zahl(k)}: Die Fläche wird mit ___ multipliziert.`, zahl(k * k), [zahl(k), zahl(2 * k), zahl(k * k * k)], "Flächen ändern sich mit k², Volumen mit k³.");
};

// ---------- Statistik, Wahrscheinlichkeit ----------

const kennzahlen = (rng: Rng) => {
  const n = eins(rng, [5, 6, 7]);
  const xs = Array.from({ length: n }, () => ganz(rng, 1, 20));
  const s = [...xs].sort((a, b) => a - b);
  const art = ganz(rng, 0, 2);
  const liste = xs.join(", ");
  const mittel = xs.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  if (art === 0) return wahl(`Werte: ${liste}. Arithmetisches Mittel: ___`, zahl(mittel), [zahl(median), zahl(xs.reduce((a, b) => a + b, 0)), zahl(mittel + 1)], `Summe ${xs.reduce((a, b) => a + b, 0)} durch Anzahl ${n}`);
  if (art === 1) return wahl(`Werte: ${liste}. Median: ___`, zahl(median), [zahl(xs[Math.floor(n / 2)]), zahl(mittel), zahl(s[0] + s[n - 1])], `Erst ordnen: ${s.join(", ")}. Der Median ist der Wert in der Mitte.`);
  return wahl(`Werte: ${liste}. Spannweite: ___`, zahl(s[n - 1] - s[0]), [zahl(s[n - 1]), zahl(s[n - 1] + s[0]), zahl(n)], "Spannweite = größter Wert − kleinster Wert");
};
const haeufigkeit = (rng: Rng) => {
  const n = eins(rng, [20, 25, 40, 50]);
  const k = ganz(rng, 1, n / 2);
  if (rng() < 0.5) return wahl(`Von ${n} Kindern fahren ${k} mit dem Rad. Relative Häufigkeit in Prozent: ___`, `${zahl((k / n) * 100)} %`, [`${k} %`, `${zahl((n / k) * 10)} %`, `${zahl(k / n)} %`], `relativ = ${k} : ${n} = ${zahl(k / n)} = ${zahl((k / n) * 100)} %`);
  return wahl(`Von ${n} Kindern fahren ${k} mit dem Rad. Relative Häufigkeit als Bruch: ___`, bruch(k, n), [bruch(n, k), bruch(k, n - k), bruch(k, 100)], "relative Häufigkeit = absolute Häufigkeit : Anzahl");
};
const abzaehlen = (rng: Rng) => {
  const a = ganz(rng, 2, 5);
  const b = ganz(rng, 2, 5);
  const c = ganz(rng, 1, 4);
  if (rng() < 0.5) return wahl(`${a} Vorspeisen, ${b} Hauptspeisen und ${c} Nachspeisen. Wie viele Menüs?`, String(a * b * c), [String(a + b + c), String(a * b + c), String(a * b * c * 2)], "Bei jeder Stufe des Baumdiagramms multiplizieren.");
  const n = ganz(rng, 3, 5);
  const f = [1, 1, 2, 6, 24, 120][n];
  return wahl(`Auf wie viele Arten können sich ${n} Kinder in eine Reihe stellen?`, String(f), [String(n * n), String(n * (n - 1)), String(f / 2 || n)], `${Array.from({ length: n }, (_, i) => n - i).join(" · ")} = ${f}`);
};
const laplace = (rng: Rng) => {
  const art = ganz(rng, 0, 2);
  if (art === 0) {
    const was = eins(rng, [
      ["eine 6", 1],
      ["eine gerade Zahl", 3],
      ["eine Zahl größer als 4", 2],
      ["eine Primzahl", 3],
      ["höchstens eine 2", 2],
      ["keine 1", 5],
    ] as [string, number][]);
    return wahl(`Würfel: Wahrscheinlichkeit für ${was[0]}?`, bruch(was[1], 6), [bruch(was[1], 3), bruch(1, 6) === bruch(was[1], 6) ? "1/2" : "1/6", `${was[1]}/10`], `günstige : mögliche = ${was[1]} : 6`);
  }
  const rot = ganz(rng, 2, 8);
  const blau = ganz(rng, 2, 8);
  if (art === 1) return wahl(`In einer Urne sind ${rot} rote und ${blau} blaue Kugeln. P(rot) = ___`, bruch(rot, rot + blau), [bruch(rot, blau), bruch(blau, rot + blau), bruch(1, 2) === bruch(rot, rot + blau) ? "1/3" : "1/2"], `${rot} günstige von ${rot + blau} möglichen`);
  return wahl(`Münze: Wahrscheinlichkeit für „Zahl“ in Prozent?`, "50 %", ["25 %", "100 %", "33 %"], "2 gleich wahrscheinliche Ergebnisse: 1/2 = 50 %");
};
const zweistufig = (rng: Rng) => {
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl("Zwei Münzen: P(zweimal Kopf) = ___", "1/4", ["1/2", "3/4", "1/3"], "1/2 · 1/2 = 1/4 (Pfadregel: entlang des Pfades multiplizieren)");
  if (art === 1) {
    const was = eins(rng, [
      ["zweimal die 6", "1/36", ["1/6", "1/12", "2/36"]],
      ["Augensumme 12", "1/36", ["1/12", "1/6", "2/36"]],
      ["Augensumme 7", "1/6", ["1/36", "7/36", "1/12"]],
      ["Augensumme 2", "1/36", ["2/36", "1/6", "1/12"]],
      ["zwei gleiche Zahlen (Pasch)", "1/6", ["1/36", "1/12", "2/6"]],
    ] as [string, string, string[]][]);
    return wahl(`Zwei Würfel: P(${was[0]}) = ___`, was[1], was[2], "Es gibt 6 · 6 = 36 gleich wahrscheinliche Paare.");
  }
  const r = ganz(rng, 2, 6);
  const b = ganz(rng, 2, 6);
  const n = r + b;
  return wahl(`${r} rote, ${b} blaue Kugeln. Zweimal ziehen ohne Zurücklegen. P(beide rot) = ___`, bruch(r * (r - 1), n * (n - 1)), [bruch(r * r, n * n), bruch(r, n), bruch(r * (r - 1), n * n)], `${r}/${n} · ${r - 1}/${n - 1}: beim zweiten Ziehen fehlt eine rote Kugel.`);
};

export const MATHE_UNTERSTUFE_GEOMETRIE: QuizBank = {
  "mathe.geometrie.grundbegriffe": `Eine Strecke hat ___ = einen Anfangs- und einen Endpunkt | keinen Endpunkt | nur einen Anfangspunkt
Eine Gerade ist ___ = nach beiden Seiten unbegrenzt | nach einer Seite begrenzt | immer 10 cm lang
Ein Strahl ist ___ = nach einer Seite unbegrenzt | nach beiden Seiten begrenzt | gekrümmt
Zwei Geraden, die einander nie schneiden, heißen ___ = parallel | normal | windschief
Zwei Geraden, die einen rechten Winkel bilden, heißen ___ = normal | parallel | gleich
Das Zeichen g ∥ h bedeutet ___ = g ist parallel zu h | g ist normal zu h | g ist gleich h
Das Zeichen g ⊥ h bedeutet ___ = g ist normal zu h | g ist parallel zu h | g ist kürzer als h
Der Abstand eines Punktes von einer Geraden wird ___ gemessen. = normal (senkrecht) zur Geraden | parallel zur Geraden | schräg
Wie viele Geraden gehen durch zwei verschiedene Punkte? = genau eine | zwei | unendlich viele
Wie viele Geraden gehen durch einen Punkt? = unendlich viele | genau eine | keine
Schneiden sich zwei Geraden, haben sie ___ gemeinsam. = genau einen Punkt | zwei Punkte | keinen Punkt
Den Mittelpunkt einer Strecke AB findet man mit ___ = der Streckensymmetrale | dem Winkelmesser | der Winkelsymmetrale
Die Strecke zwischen A und B schreibt man ___ = AB mit Strich darüber oder [AB] | A − B | A · B
Mit dem Geodreieck zeichnet man parallele Linien mit Hilfe der ___ = Hilfslinien (parallele Linien) | Winkelskala allein | Spitze
Eine gekrümmte Linie ist ___ = keine Strecke | eine Strecke | eine Gerade
Durch einen Punkt außerhalb einer Geraden gibt es ___ Parallele zur Geraden. = genau eine | zwei | keine`,
  "mathe.geometrie.kreis": `Der Abstand vom Mittelpunkt zum Kreis heißt ___ = Radius | Durchmesser | Sehne
Der Durchmesser ist ___ so lang wie der Radius. = doppelt | halb | gleich
Eine Strecke, die zwei Punkte des Kreises verbindet, heißt ___ = Sehne | Radius | Tangente
Die längste Sehne eines Kreises ist ___ = der Durchmesser | der Radius | der Bogen
Eine Gerade, die den Kreis in genau einem Punkt berührt, heißt ___ = Tangente | Sekante | Passante
Eine Gerade, die den Kreis in zwei Punkten schneidet, heißt ___ = Sekante | Tangente | Passante
Eine Gerade, die den Kreis nicht trifft, heißt ___ = Passante | Sekante | Tangente
Ein Teil der Kreislinie heißt ___ = Kreisbogen | Sektor | Sehne
Ein „Tortenstück“ des Kreises heißt ___ = Kreissektor | Kreisring | Kreisbogen
Die Fläche zwischen zwei Kreisen mit gleichem Mittelpunkt heißt ___ = Kreisring | Sektor | Segment
Kreise mit demselben Mittelpunkt heißen ___ = konzentrisch | parallel | kongruent
Einen Kreis zeichnet man mit ___ = dem Zirkel | dem Geodreieck allein | dem Winkelmesser
r = 4 cm. d = ___ = 8 cm | 2 cm | 16 cm
d = 10 cm. r = ___ = 5 cm | 20 cm | 10 cm
Die Tangente steht auf dem Radius im Berührpunkt ___ = normal | parallel | schräg
Alle Punkte eines Kreises haben vom Mittelpunkt ___ = denselben Abstand | verschiedene Abstände | den Abstand 0`,
  "mathe.geometrie.koordinaten": {
    text: `Die waagrechte Achse heißt ___ = x-Achse | y-Achse | z-Achse
Die senkrechte Achse heißt ___ = y-Achse | x-Achse | Ursprung
Der Punkt (0 ∣ 0) heißt ___ = Ursprung | Mittelpunkt | Quadrant
Bei P(3 ∣ 5) ist 3 der ___ = x-Wert | y-Wert | Abstand
Ein Punkt auf der x-Achse hat y = ___ = 0 | 1 | x
Ein Punkt auf der y-Achse hat x = ___ = 0 | 1 | y`,
    erzeuge: koordinaten,
  },
  "mathe.geometrie.symmetrie": `Bei einer Spiegelung an einer Achse bleiben Längen und Winkel ___ = gleich | doppelt | halb
Zwei Figuren, die genau aufeinander passen, heißen ___ = kongruent | ähnlich | parallel
Die Verbindungsstrecke von Punkt und Spiegelpunkt steht auf der Achse ___ = normal | parallel | schräg
Der Abstand eines Punktes zur Achse ist ___ wie der Abstand des Spiegelpunktes. = gleich groß | doppelt so groß | halb so groß
Punkte auf der Symmetrieachse werden auf ___ gespiegelt. = sich selbst | den Ursprung | die Gegenseite
Wie viele Symmetrieachsen hat ein gleichschenkeliges Dreieck? = 1 | 2 | 3
Wie viele Symmetrieachsen hat eine Raute? = 2 | 4 | 1
Wie viele Symmetrieachsen hat ein Deltoid? = 1 | 2 | 4
Wie viele Symmetrieachsen hat ein Parallelogramm (keine Raute, kein Rechteck)? = 0 | 2 | 1
Wie viele Symmetrieachsen hat ein regelmäßiges Sechseck? = 6 | 3 | 12
Wie viele Symmetrieachsen hat ein gleichschenkeliges Trapez? = 1 | 2 | 0
Kongruenzsatz SSS heißt: drei ___ gleich = Seiten | Winkel | Höhen
Kongruenzsatz SWS heißt: zwei Seiten und ___ gleich = der eingeschlossene Winkel | irgendein Winkel | die Höhe
Gilt „WWW“ als Kongruenzsatz? = nein, nur ähnlich | ja
Merke: Drei gleiche Winkel: gleiche Form, aber die Größe kann anders sein.
Bei einer Spiegelung wird der Umlaufsinn ___ = umgekehrt | beibehalten | verdoppelt`,
  "mathe.geometrie.symmetralen": `Die Streckensymmetrale von AB ist ___ = die Normale durch den Mittelpunkt von AB | die Parallele zu AB | die Gerade durch A und B
Jeder Punkt der Streckensymmetrale ist von A und B ___ = gleich weit entfernt | verschieden weit entfernt | 0 cm entfernt
Die Winkelsymmetrale teilt einen Winkel in ___ = zwei gleich große Winkel | drei Winkel | zwei rechte Winkel
Jeder Punkt der Winkelsymmetrale ist von den beiden Schenkeln ___ = gleich weit entfernt | verschieden weit entfernt | doppelt so weit entfernt
Die Streckensymmetrale konstruiert man mit ___ = dem Zirkel (zwei Kreisbögen) | dem Winkelmesser | der Waage
Die Streckensymmetralen eines Dreiecks schneiden sich im ___ = Umkreismittelpunkt | Inkreismittelpunkt | Schwerpunkt
Die Winkelsymmetralen eines Dreiecks schneiden sich im ___ = Inkreismittelpunkt | Umkreismittelpunkt | Höhenschnittpunkt
Ein 60°-Winkel wird halbiert. Jeder Teil hat ___ = 30° | 120° | 60°
Ein 90°-Winkel wird halbiert. Jeder Teil hat ___ = 45° | 30° | 90°
Ein gestreckter Winkel wird halbiert. Jeder Teil hat ___ = 90° | 45° | 180°
Wo baut man einen Brunnen, der von zwei Häusern gleich weit weg ist? = auf der Streckensymmetrale | auf der Winkelsymmetrale | in einem Haus
Die Streckensymmetrale steht auf der Strecke ___ = normal | parallel | schräg
Beim Konstruieren der Streckensymmetrale muss der Zirkel ___ geöffnet sein. = weiter als die halbe Strecke | genau 1 cm | weniger als die halbe Strecke
Wie viele Streckensymmetralen hat eine Strecke? = eine | zwei | unendlich viele`,
  "mathe.winkel.messen": {
    text: `Einen Winkel misst man mit ___ = dem Winkelmesser (Geodreieck) | dem Zirkel | dem Lineal allein
Die Einheit für Winkel ist ___ = Grad (°) | Zentimeter | Prozent
Die beiden Linien eines Winkels heißen ___ = Schenkel | Seiten | Achsen
Der Punkt, an dem die Schenkel zusammentreffen, heißt ___ = Scheitel | Mittelpunkt | Ursprung
Ein Vollwinkel hat ___ = 360° | 180° | 90°
Winkel bezeichnet man meistens mit ___ = griechischen Buchstaben (α, β, γ) | Zahlen | großen Buchstaben`,
    erzeuge: winkelMessen,
    anzahl: 24,
  },
  "mathe.winkel.beziehungen": {
    text: `Nebenwinkel ergeben zusammen ___ = 180° | 90° | 360°
Scheitelwinkel sind ___ = gleich groß | zusammen 180° | zusammen 90°
Stufenwinkel an parallelen Geraden sind ___ = gleich groß | zusammen 180° | verschieden
Wechselwinkel an parallelen Geraden sind ___ = gleich groß | zusammen 90° | verschieden
Die Winkelsumme im Dreieck ist ___ = 180° | 360° | 90°
Die Winkelsumme im Viereck ist ___ = 360° | 180° | 540°
Die Winkelsumme im Fünfeck ist ___ = 540° | 360° | 720°
Merke: (n − 2) · 180°.
Im gleichseitigen Dreieck hat jeder Winkel ___ = 60° | 90° | 45°`,
    erzeuge: winkelBeziehung,
  },
  "mathe.dreiecke.arten": `Ein Dreieck mit drei gleich langen Seiten heißt ___ = gleichseitig | gleichschenkelig | rechtwinkelig
Ein Dreieck mit zwei gleich langen Seiten heißt ___ = gleichschenkelig | gleichseitig | ungleichseitig
Ein Dreieck mit einem 90°-Winkel heißt ___ = rechtwinkelig | spitzwinkelig | stumpfwinkelig
Ein Dreieck mit einem Winkel über 90° heißt ___ = stumpfwinkelig | spitzwinkelig | rechtwinkelig
Ein Dreieck mit drei Winkeln unter 90° heißt ___ = spitzwinkelig | stumpfwinkelig | rechtwinkelig
Ein Viereck mit vier rechten Winkeln und vier gleich langen Seiten ist ein ___ = Quadrat | Rechteck | Raute
Ein Viereck mit vier gleich langen Seiten, aber ohne rechte Winkel, ist eine ___ = Raute | Rechteck | Trapez
Ein Viereck mit genau einem Paar paralleler Seiten ist ein ___ = Trapez | Parallelogramm | Deltoid
Ein Viereck mit zwei Paaren paralleler Seiten ist ein ___ = Parallelogramm | Trapez | Deltoid
Ein Viereck, bei dem je zwei benachbarte Seiten gleich lang sind, ist ein ___ = Deltoid (Drachen) | Trapez | Rechteck
Die Diagonalen eines Rechtecks sind ___ = gleich lang | normal aufeinander | verschieden lang
Die Diagonalen einer Raute stehen ___ = normal aufeinander | parallel | gleich lang
Ist jedes Quadrat ein Rechteck? = ja | nein
Ist jedes Rechteck ein Quadrat? = nein | ja
Ist jede Raute ein Parallelogramm? = ja | nein
Kann ein Dreieck zwei rechte Winkel haben? = nein | ja
Merke: 90° + 90° = 180°, für den dritten Winkel bliebe nichts.
Die längste Seite im rechtwinkeligen Dreieck heißt ___ = Hypotenuse | Kathete | Höhe
In einem Dreieck ist jede Seite ___ als die beiden anderen zusammen. = kürzer | länger | gleich lang`,
  "mathe.dreiecke.konstruieren": `Ein Dreieck ist eindeutig konstruierbar aus ___ = drei Seiten (SSS) | drei Winkeln | zwei Seiten allein
Kann man ein Dreieck mit 3 cm, 4 cm und 9 cm konstruieren? = nein | ja
Merke: 3 + 4 = 7 ist kürzer als 9: die Seiten treffen sich nicht.
Kann man ein Dreieck mit 5 cm, 6 cm und 7 cm konstruieren? = ja | nein
Kann man ein Dreieck mit 4 cm, 4 cm und 8 cm konstruieren? = nein | ja
Merke: 4 + 4 = 8: das Dreieck wäre flach.
Beim Konstruieren nach SSS braucht man ___ = Zirkel und Lineal | nur den Winkelmesser | nur das Lineal
Was zeichnet man vor der Konstruktion? = eine Planfigur (Skizze) | gar nichts | das Ergebnis
SWS heißt: zwei Seiten und der Winkel ___ = zwischen ihnen | irgendwo | gegenüber der längsten Seite
WSW heißt: eine Seite und die beiden Winkel ___ = an dieser Seite | gegenüber | beliebig
Die Ecken eines Dreiecks beschriftet man ___ = gegen den Uhrzeigersinn mit A, B, C | im Uhrzeigersinn | beliebig
Die Seite a liegt im Dreieck ___ = gegenüber von A | neben A | in A
Der Winkel α liegt im Dreieck ___ = bei A | bei B | bei C
Ein Rechteck konstruiert man aus ___ = zwei Seiten | einem Winkel | einer Seite allein
Ein Quadrat konstruiert man aus ___ = einer Seite | zwei Winkeln | gar nichts
Bei einer Konstruktion beschreibt man die Schritte in einem ___ = Konstruktionsbericht | Aufsatz | Diagramm
Kann man ein Dreieck mit den Winkeln 100° und 90° konstruieren? = nein | ja`,
  "mathe.dreiecke.punkte": `Die Höhen eines Dreiecks schneiden sich im ___ = Höhenschnittpunkt H | Schwerpunkt S | Umkreismittelpunkt U
Die Schwerlinien eines Dreiecks schneiden sich im ___ = Schwerpunkt S | Höhenschnittpunkt H | Inkreismittelpunkt I
Die Streckensymmetralen schneiden sich im ___ = Umkreismittelpunkt U | Inkreismittelpunkt I | Schwerpunkt S
Die Winkelsymmetralen schneiden sich im ___ = Inkreismittelpunkt I | Umkreismittelpunkt U | Höhenschnittpunkt H
Eine Schwerlinie verbindet eine Ecke mit ___ = dem Mittelpunkt der gegenüberliegenden Seite | der nächsten Ecke | dem Umkreis
Eine Höhe steht auf der gegenüberliegenden Seite ___ = normal | parallel | schräg
Der Umkreis geht durch ___ = alle drei Ecken | alle drei Seitenmitten | keinen Punkt
Der Inkreis berührt ___ = alle drei Seiten | alle drei Ecken | nur eine Seite
Der Schwerpunkt teilt jede Schwerlinie im Verhältnis ___ = 2 : 1 | 1 : 1 | 3 : 1
U, S und H liegen auf einer Geraden. Wie heißt sie? = Eulersche Gerade | Symmetrale | Tangente
Im rechtwinkeligen Dreieck liegt der Umkreismittelpunkt ___ = in der Mitte der Hypotenuse | außerhalb | in der rechtwinkeligen Ecke
Merke: Satz des Thales.
Im stumpfwinkeligen Dreieck liegt der Umkreismittelpunkt ___ = außerhalb des Dreiecks | innerhalb | auf einer Ecke
Im gleichseitigen Dreieck fallen U, I, S und H ___ = zusammen | weit auseinander | auf die Ecken
Der Schwerpunkt liegt immer ___ des Dreiecks. = innerhalb | außerhalb | auf einer Seite
Der Höhenschnittpunkt im rechtwinkeligen Dreieck ist ___ = die Ecke mit dem rechten Winkel | die Hypotenusenmitte | außerhalb`,
  "mathe.flaechen.rechteck": { text: `Flächeninhalt eines Rechtecks: A = ___ = a · b | 2a + 2b | a + b
Umfang eines Rechtecks: u = ___ = 2a + 2b | a · b | a + b
Flächeninhalt eines Quadrats: A = ___ = a² | 4a | 2a
Umfang eines Quadrats: u = ___ = 4a | a² | 2a
Der Flächeninhalt hat die Einheit ___ = cm², m² … | cm, m … | cm³`, erzeuge: rechteck },
  "mathe.flaechen.zusammengesetzt": { text: `Zusammengesetzte Figuren zerlegt man in ___ = bekannte Teilfiguren | Punkte | Kreise
Fehlt aus einer Figur ein Stück, rechnet man ___ = ganze Fläche minus Ausschnitt | ganze Fläche plus Ausschnitt | nur den Ausschnitt
Ein Haus aus Quadrat (16 cm²) und Dach-Dreieck (6 cm²) hat die Fläche ___ = 22 cm² | 10 cm² | 96 cm²
Beim Zerlegen darf sich nichts ___ = überlappen | berühren | ändern`, erzeuge: zusammengesetzt },
  "mathe.flaechen.umkehr": { text: `Rechteck: A = 24 cm², a = 6 cm. b = ___ = 4 cm | 18 cm | 30 cm
Quadrat: A = 49 cm². a = ___ = 7 cm | 12,25 cm | 24,5 cm
Quadrat: u = 36 cm. a = ___ = 9 cm | 6 cm | 18 cm
Bei einer Umkehraufgabe ist ___ gesucht. = eine Seite oder Höhe | immer die Fläche | nur der Umfang`, erzeuge: umkehr },
  "mathe.flaechen.dreieck": { text: `Flächeninhalt eines Dreiecks: A = ___ = c · h / 2 | c · h | c + h
Die Höhe eines Dreiecks steht ___ auf der Grundlinie. = normal | parallel | schräg
Rechtwinkeliges Dreieck mit Katheten 6 cm und 4 cm: A = ___ = 12 cm² | 24 cm² | 10 cm²
Ein Dreieck ist ___ eines Rechtecks mit gleicher Grundlinie und Höhe. = die Hälfte | das Doppelte | ein Drittel`, erzeuge: dreieck },
  "mathe.flaechen.vierecke": { text: `Parallelogramm: A = ___ = a · h | a · b | (a + c) · h / 2
Trapez: A = ___ = (a + c) · h / 2 | a · c | a · h
Raute: A = ___ = e · f / 2 | e · f | a²
Deltoid: A = ___ = e · f / 2 | e + f | a · b
Beim Parallelogramm ist h ___ = der Abstand der parallelen Seiten | die schräge Seite | die Diagonale`, erzeuge: vierecke },
  "mathe.flaechen.vielecke": `Den Flächeninhalt eines Vielecks berechnet man oft durch ___ = Zerlegen in Dreiecke | Messen des Umfangs | Raten
Ein regelmäßiges Sechseck besteht aus ___ gleichseitigen Dreiecken. = 6 | 3 | 12
Ein regelmäßiges Sechseck mit Seite 4 cm hat den Umfang ___ = 24 cm | 16 cm | 36 cm
Ein regelmäßiges Achteck hat ___ Ecken. = 8 | 6 | 10
Ein regelmäßiges Vieleck hat lauter gleich lange Seiten und ___ = gleich große Winkel | rechte Winkel | Diagonalen gleich der Seite
Ein Fünfeck lässt sich von einer Ecke aus in ___ Dreiecke zerlegen. = 3 | 5 | 2
Ein n-Eck lässt sich von einer Ecke aus in ___ Dreiecke zerlegen. = n − 2 | n | n − 1
Die Winkelsumme im Sechseck ist ___ = 720° | 540° | 360°
Merke: (6 − 2) · 180° = 720°.
Jeder Winkel im regelmäßigen Sechseck hat ___ = 120° | 60° | 90°
Ein regelmäßiges Vieleck mit 4 Ecken ist ein ___ = Quadrat | Rechteck | Raute
Ein regelmäßiges Vieleck mit 3 Ecken ist ein ___ = gleichseitiges Dreieck | rechtwinkeliges Dreieck | gleichschenkeliges Dreieck
Ein Grundstück: Rechteck 20 m × 10 m und daneben ein Dreieck mit 10 m Grundlinie und 6 m Höhe. A = ___ = 230 m² | 260 m² | 200 m²
Ein Vieleck im Koordinatensystem zerlegt man gut in ___ = Rechtecke und Dreiecke | Kreise | Strahlen
Wie viele Diagonalen hat ein Viereck? = 2 | 4 | 1
Wie viele Diagonalen hat ein Fünfeck? = 5 | 3 | 10
Wie viele Diagonalen hat ein Sechseck? = 9 | 6 | 12`,
  "mathe.flaechen.kreis": { text: `Umfang eines Kreises: u = ___ = 2 · r · π | r² · π | r · π
Flächeninhalt eines Kreises: A = ___ = r² · π | 2 · r · π | d² · π
π ist ungefähr ___ = 3,14 | 2,71 | 1,41
π ist das Verhältnis ___ = Umfang : Durchmesser | Fläche : Radius | Radius : Durchmesser
Verdoppelt man den Radius, wird die Kreisfläche ___ = viermal so groß | doppelt so groß | achtmal so groß`, erzeuge: kreis },
  "mathe.flaechen.kreisteile": { text: `Ein Halbkreis hat die Fläche ___ = r² · π / 2 | r² · π | 2 · r · π
Ein Viertelkreis hat die Fläche ___ = r² · π / 4 | r² · π / 2 | r · π / 4
Die Fläche eines Kreissektors mit Winkel α ist ___ = r² · π · α / 360° | r² · π · α | 2rπ · α
Ein Kreissektor mit 90° ist ___ = ein Viertelkreis | ein Halbkreis | ein Achtelkreis
Ein Kreissektor mit 180° ist ___ = ein Halbkreis | ein Viertelkreis | ein Vollkreis
Ein Kreisring hat die Fläche ___ = (R² − r²) · π | (R − r)² · π | R² · π + r² · π`, erzeuge: kreisteile },
  "mathe.koerper.formen": `Wie viele Flächen hat ein Würfel? = 6 | 8 | 12
Wie viele Ecken hat ein Würfel? = 8 | 6 | 12
Wie viele Kanten hat ein Würfel? = 12 | 8 | 6
Welcher Körper hat keine Ecken und keine Kanten? = Kugel | Zylinder | Kegel
Welcher Körper hat genau eine Spitze und eine Kreisfläche? = Kegel | Zylinder | Pyramide
Welcher Körper hat zwei gleiche Kreisflächen? = Zylinder | Kegel | Kugel
Eine quadratische Pyramide hat ___ Flächen. = 5 | 4 | 6
Eine quadratische Pyramide hat ___ Ecken. = 5 | 4 | 8
Eine quadratische Pyramide hat ___ Kanten. = 8 | 6 | 12
Ein Dreiecksprisma hat ___ Flächen. = 5 | 6 | 3
Ein Dreiecksprisma hat ___ Ecken. = 6 | 5 | 9
Ein Quader hat lauter ___ als Flächen. = Rechtecke | Quadrate | Dreiecke
Eine Dose hat die Form eines ___ = Zylinders | Kegels | Quaders
Eine Eistüte hat die Form eines ___ = Kegels | Zylinders | Prismas
Ein Fußball hat ungefähr die Form einer ___ = Kugel | Pyramide | Würfel
Merke: Eulerscher Polyedersatz: Ecken + Flächen − Kanten = 2.
Ecken + Flächen − Kanten ergibt bei jedem Würfel, Quader und jeder Pyramide ___ = 2 | 0 | 6`,
  "mathe.koerper.netze": `Ein Netz ist ___ = der aufgeklappte Körper in der Ebene | ein Schrägriss | ein Grundriss
Das Netz eines Zylinders besteht aus ___ = zwei Kreisen und einem Rechteck | drei Kreisen | einem Kreis und einem Dreieck
Das Netz eines Kegels besteht aus ___ = einem Kreis und einem Kreissektor | zwei Kreisen | einem Rechteck und einem Kreis
Das Netz einer quadratischen Pyramide besteht aus ___ = einem Quadrat und vier Dreiecken | fünf Quadraten | vier Quadraten und einem Dreieck
Das Netz eines Dreiecksprismas besteht aus ___ = zwei Dreiecken und drei Rechtecken | drei Dreiecken und zwei Rechtecken | sechs Dreiecken
Eine Kugel hat ___ Netz. = kein | ein rundes | ein quadratisches
Ein Schrägriss zeigt den Körper ___ = räumlich, mit verkürzten schrägen Kanten | nur von oben | nur von vorne
Im Schrägriss werden die nach hinten laufenden Kanten oft ___ gezeichnet. = verkürzt (z. B. halb so lang) | doppelt so lang | gar nicht
Verdeckte Kanten zeichnet man im Schrägriss ___ = strichliert | dicker | rot
Der Verzerrungswinkel im Schrägriss beträgt oft ___ = 45° | 90° | 10°
Wie viele Würfelnetze gibt es? = 11 | 6 | 8
Aus einem Netz mit 6 Quadraten in einer Reihe wird ein Würfel? = nein | ja
Beim Würfelnetz liegen gegenüberliegende Flächen ___ = nie direkt nebeneinander | immer nebeneinander | übereinander
Das Netz eines Quaders hat ___ Flächen. = 6 | 4 | 8
Grundriss heißt: der Körper ___ = von oben gesehen | von vorne gesehen | von der Seite`,
  "mathe.koerper.quader": { text: `Volumen eines Quaders: V = ___ = a · b · c | 2(ab + ac + bc) | a + b + c
Oberfläche eines Quaders: O = ___ = 2(ab + ac + bc) | a · b · c | 4(a + b + c)
Volumen eines Würfels: V = ___ = a³ | 6a² | 3a
Oberfläche eines Würfels: O = ___ = 6a² | a³ | 4a²
Das Volumen hat die Einheit ___ = cm³, m³, Liter … | cm², m² … | cm, m …`, erzeuge: quader },
  "mathe.koerper.prisma": { text: `Volumen eines Prismas: V = ___ = G · h | G · h / 3 | G + h
Die Grundfläche G eines Prismas ist ___ = die Fläche unten (und oben gleich) | die Seitenfläche | der Mantel
Die Mantelfläche eines Prismas besteht aus ___ = Rechtecken | Dreiecken | Kreisen
Oberfläche eines Prismas: O = ___ = 2 · G + M | G + M | G · M
Ein Quader ist ein Prisma mit ___ Grundfläche. = rechteckiger | dreieckiger | kreisförmiger`, erzeuge: prisma },
  "mathe.koerper.pyramide": { text: `Volumen einer Pyramide: V = ___ = G · h / 3 | G · h | G · h / 2
Eine Pyramide hat ___ des Volumens eines Prismas mit gleicher Grundfläche und Höhe. = ein Drittel | die Hälfte | das Doppelte
Die Seitenflächen einer Pyramide sind ___ = Dreiecke | Rechtecke | Kreise
Die Höhe einer Pyramide steht ___ auf der Grundfläche. = normal | parallel | schräg
Die Oberfläche einer Pyramide: O = ___ = G + M | 2G + M | G · M`, erzeuge: pyramide },
  "mathe.koerper.zylinder": { text: `Volumen eines Zylinders: V = ___ = r² · π · h | 2rπ · h | r² · π · h / 3
Mantelfläche eines Zylinders: M = ___ = 2rπ · h | r² · π · h | r · π · h
Oberfläche eines Zylinders: O = ___ = 2r²π + 2rπh | r²π + 2rπh | 2rπh
Der Mantel eines Zylinders ist abgerollt ein ___ = Rechteck | Kreis | Dreieck
Die Breite des abgerollten Mantels ist ___ = der Umfang des Grundkreises | der Radius | die Höhe · 2`, erzeuge: zylinder },
  "mathe.koerper.kegel": { text: `Volumen eines Kegels: V = ___ = r² · π · h / 3 | r² · π · h | 2rπh / 3
Der Kegel hat ___ des Volumens eines Zylinders mit gleicher Grundfläche und Höhe. = ein Drittel | die Hälfte | gleich viel
Die Mantellinie s beim Kegel berechnet man mit ___ = s² ＝ r² + h² | s ＝ r + h | s ＝ r · h
Mantelfläche eines Kegels: M = ___ = r · π · s | 2rπh | r² · π
Der abgerollte Kegelmantel ist ein ___ = Kreissektor | Rechteck | Dreieck`, erzeuge: kegel },
  "mathe.koerper.dichte": { text: `Dichte = ___ = Masse : Volumen | Volumen : Masse | Masse · Volumen
1 cm³ Wasser wiegt ungefähr ___ = 1 g | 1 kg | 10 g
1 Liter Wasser wiegt ungefähr ___ = 1 kg | 1 g | 10 kg
Ein Stoff mit Dichte kleiner als 1 g/cm³ ___ in Wasser. = schwimmt | sinkt | löst sich auf
Die Einheit der Dichte ist zum Beispiel ___ = g/cm³ | cm³/g | kg · m³`, erzeuge: dichte },
  "mathe.pythagoras.seite": { text: `Satz des Pythagoras (c ist die Hypotenuse): ___ = a² + b² ＝ c² | a + b ＝ c | a² − b² ＝ c²
Der Satz des Pythagoras gilt nur im ___ Dreieck. = rechtwinkeligen | gleichseitigen | jedem
Die Hypotenuse liegt ___ = gegenüber dem rechten Winkel | am rechten Winkel | immer unten
Die Hypotenuse ist immer ___ = die längste Seite | die kürzeste Seite | gleich lang wie eine Kathete
a = 3 cm, b = 4 cm. c = ___ = 5 cm | 7 cm | 25 cm`, erzeuge: pythSeite },
  "mathe.pythagoras.figuren": { text: `Diagonale eines Quadrats mit Seite a: d = ___ = a · √2 | 2a | a²
Höhe eines gleichseitigen Dreiecks mit Seite a: h = ___ = a/2 · √3 | a/2 | a · √2
Im gleichschenkeligen Dreieck teilt die Höhe die Basis ___ = in zwei gleiche Teile | im Verhältnis 2 : 1 | gar nicht
Diagonale eines Rechtecks: d = ___ = √(a² + b²) | a + b | a · b`, erzeuge: pythFigur },
  "mathe.pythagoras.koerper": { text: `Raumdiagonale eines Würfels mit Kante a: d = ___ = a · √3 | a · √2 | 3a
Raumdiagonale eines Quaders: d = ___ = √(a² + b² + c²) | a + b + c | √(a² + b²)
Bei der Pyramide berechnet man die Höhe oft mit einem ___ = rechtwinkeligen Dreieck im Inneren | Kreis | Parallelogramm
Mantellinie s eines Kegels mit r = 3 cm, h = 4 cm: s = ___ = 5 cm | 7 cm | 12 cm`, erzeuge: pythKoerper },
  "mathe.pythagoras.umkehrung": { text: `Gilt a² + b² = c², dann ist das Dreieck ___ = rechtwinkelig | gleichseitig | stumpfwinkelig
Gilt a² + b² > c² (c die längste Seite), dann ist das Dreieck ___ = spitzwinkelig | stumpfwinkelig | rechtwinkelig
Gilt a² + b² < c² (c die längste Seite), dann ist das Dreieck ___ = stumpfwinkelig | spitzwinkelig | rechtwinkelig
Mit einem Seil mit 12 gleichen Abständen (3, 4, 5) kann man ___ abstecken. = einen rechten Winkel | einen Kreis | eine Parallele`, erzeuge: pythUmkehr },
  "mathe.aehnlichkeit.figuren": { text: `Ähnliche Figuren haben ___ = gleiche Winkel und Seiten im gleichen Verhältnis | gleiche Seiten | gleiche Fläche
k > 1 bedeutet ___ = Vergrößerung | Verkleinerung | gleiche Größe
0 < k < 1 bedeutet ___ = Verkleinerung | Vergrößerung | Spiegelung
Sind alle Quadrate zueinander ähnlich? = ja | nein
Sind alle Rechtecke zueinander ähnlich? = nein | ja
Der Strahlensatz handelt von zwei Strahlen und ___ = parallelen Geraden | Kreisen | Winkeln im Dreieck`, erzeuge: aehnlich },
  "mathe.statistik.diagramme": `Für Anteile an einem Ganzen eignet sich besonders ___ = ein Kreisdiagramm | ein Liniendiagramm | eine Strichliste
Für eine Entwicklung über die Zeit eignet sich besonders ___ = ein Liniendiagramm | ein Kreisdiagramm | ein Piktogramm
Im Kreisdiagramm entsprechen 100 % genau ___ = 360° | 100° | 180°
25 % im Kreisdiagramm sind ein Winkel von ___ = 90° | 25° | 45°
10 % im Kreisdiagramm sind ein Winkel von ___ = 36° | 10° | 18°
50 % im Kreisdiagramm sind ein Winkel von ___ = 180° | 90° | 50°
Eine Achse, die nicht bei 0 beginnt, kann Unterschiede ___ = größer aussehen lassen | kleiner aussehen lassen | nicht verändern
Bei einem Säulendiagramm müssen die Säulen ___ = gleich breit sein | verschieden breit sein | bunt sein
Ein Balkendiagramm hat ___ Balken. = waagrechte | senkrechte | runde
Im Kreisdiagramm: 90° sind ___ = 25 % | 90 % | 50 %
Im Kreisdiagramm: 72° sind ___ = 20 % | 72 % | 10 %
Merke: 72 : 360 = 0,2.
Was gehört zu jedem Diagramm? = Überschrift und Achsenbeschriftung | eine Rechnung | ein Antwortsatz
Ein Piktogramm stellt Daten dar mit ___ = Bildsymbolen | Linien | Kreissektoren
Ein Streifendiagramm zeigt Anteile als ___ = Teile eines Streifens | Punkte | Säulen nebeneinander`,
  "mathe.statistik.kennzahlen": { text: `Das arithmetische Mittel ist ___ = Summe aller Werte durch ihre Anzahl | der Wert in der Mitte | der häufigste Wert
Der Median ist ___ = der Wert in der Mitte der geordneten Liste | die Summe durch die Anzahl | der größte Wert
Der Modus ist ___ = der häufigste Wert | der mittlere Wert | der kleinste Wert
Die Spannweite ist ___ = größter minus kleinster Wert | die Summe | der Median
Ein Ausreißer verändert ___ stärker. = das arithmetische Mittel | den Median | die Anzahl`, erzeuge: kennzahlen },
  "mathe.statistik.haeufigkeiten": { text: `Die absolute Häufigkeit ist ___ = wie oft etwas vorkommt | der Anteil in Prozent | immer kleiner als 1
Die relative Häufigkeit ist ___ = der Anteil (absolute Häufigkeit : Anzahl) | wie oft etwas vorkommt | die Summe
Alle relativen Häufigkeiten zusammen ergeben ___ = 1 (100 %) | 0 | die Anzahl
Eine relative Häufigkeit kann man angeben als ___ = Bruch, Dezimalzahl oder Prozent | nur Prozent | nur ganze Zahl`, erzeuge: haeufigkeit },
  "mathe.statistik.kreuztabellen": `Eine Vierfeldertafel ordnet Daten nach ___ = zwei Merkmalen | einem Merkmal | der Zeit
In der letzten Zeile einer Vierfeldertafel stehen ___ = die Summen der Spalten | die Mittelwerte | die Prozent
In der Ecke unten rechts steht ___ = die Gesamtzahl | null | der größte Wert
30 Kinder: 12 Mädchen. 8 Mädchen haben ein Haustier. Wie viele Mädchen ohne Haustier? = 4 | 20 | 18
30 Kinder: 18 Buben, 10 davon mit Haustier. Wie viele Buben ohne Haustier? = 8 | 20 | 28
Spalte „mit Rad“: 15 Buben und 9 Mädchen. Summe der Spalte: ___ = 24 | 6 | 135
Vierfeldertafel: A und B 10, A und nicht B 5, nicht A und B 20, nicht A und nicht B 15. Gesamt: ___ = 50 | 30 | 35
Vierfeldertafel: A und B 10, A und nicht B 5, nicht A und B 20, nicht A und nicht B 15. Wie viele haben A? = 15 | 10 | 30
Vierfeldertafel: A und B 10, A und nicht B 5, nicht A und B 20, nicht A und nicht B 15. Wie viele haben B? = 30 | 20 | 10
Eine Kreuztabelle hilft zu sehen, ob ___ = zwei Merkmale zusammenhängen | ein Wert falsch ist | die Zeit vergeht
In einer Vierfeldertafel gibt es ___ innere Felder. = 4 | 9 | 2
200 Befragte: 120 Erwachsene, 80 Jugendliche. 60 Jugendliche nutzen TikTok. Anteil der TikTok-Nutzer unter den Jugendlichen: ___ = 75 % | 30 % | 60 %
Fehlt in einer Zeile ein Wert, berechnet man ihn aus ___ = Zeilensumme minus den anderen Wert | der Spaltenüberschrift | dem Mittelwert
Die Summe aller vier inneren Felder ergibt ___ = die Gesamtzahl | die erste Zeile | null
Zeilensummen zusammen ergeben ___ wie Spaltensummen zusammen. = dasselbe | weniger | mehr`,
  "mathe.statistik.abzaehlen": { text: `Ein Baumdiagramm hilft beim ___ = Abzählen aller Möglichkeiten | Messen von Winkeln | Zeichnen von Kreisen
Beim Zählen mit dem Baumdiagramm wird je Stufe ___ = multipliziert | addiert | subtrahiert
Ein Zahlenschloss mit 3 Rädern zu je 10 Ziffern hat ___ Möglichkeiten. = 1 000 | 30 | 100
Wie viele zweistellige Zahlen kann man aus 1, 2, 3 bilden, wenn Ziffern doppelt sein dürfen? = 9 | 6 | 3`, erzeuge: abzaehlen },
  "mathe.wahrscheinlichkeit.laplace": { text: `Laplace-Wahrscheinlichkeit: P = ___ = günstige : mögliche Ergebnisse | mögliche : günstige | günstige · mögliche
Eine Wahrscheinlichkeit liegt immer zwischen ___ = 0 und 1 | 0 und 100 | −1 und 1
P = 0 bedeutet ___ = unmöglich | sicher | wahrscheinlich
P = 1 bedeutet ___ = sicher | unmöglich | halb
Ein Laplace-Experiment hat ___ = gleich wahrscheinliche Ergebnisse | nur zwei Ergebnisse | kein Ergebnis`, erzeuge: laplace },
  "mathe.wahrscheinlichkeit.zweistufig": { text: `Pfadregel: Entlang eines Pfades wird ___ = multipliziert | addiert | subtrahiert
Summenregel: Wahrscheinlichkeiten mehrerer Pfade werden ___ = addiert | multipliziert | dividiert
Ohne Zurücklegen ändern sich beim zweiten Zug ___ = die Wahrscheinlichkeiten | nichts | nur die Farben
Die Wahrscheinlichkeiten an den Ästen eines Knotens ergeben zusammen ___ = 1 | 0 | 2`, erzeuge: zweistufig },
};
