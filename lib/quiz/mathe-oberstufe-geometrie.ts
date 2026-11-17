/**
 * Mathe-Quiz Oberstufe, Trigonometrie, Vektoren, Kurven, komplexe Zahlen und Matrizen: Begriffe als Text,
 * Rechnungen mit Erzeugern (falsche Antworten = typische Fehler: sin und cos vertauscht, Grad statt Bogenmaß,
 * Koordinaten addiert statt subtrahiert …). Format: lib/lernspiele-quiz.ts.
 */
import type { QuizBank } from "../lernspiele-quiz";
import { eins, ganz, plusMinus, runde, wahl, zahl, type Rng } from "./hilfen";

const GRAD = Math.PI / 180;
const vek = (...xs: number[]) => `(${xs.map((x) => zahl(x)).join(" ∣ ")})`;

// ---------- Trigonometrie ----------

const rechtwinkelig = (rng: Rng) => {
  const [a, b, c] = eins(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15]] as [number, number, number][]);
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl(`Rechtwinkeliges Dreieck: Gegenkathete von α ${a}, Ankathete ${b}, Hypotenuse ${c}. sin(α) = ___`, `${a}/${c}`, [`${b}/${c}`, `${a}/${b}`, `${c}/${a}`], "sin = Gegenkathete : Hypotenuse");
  if (art === 1) return wahl(`Rechtwinkeliges Dreieck: Gegenkathete von α ${a}, Ankathete ${b}, Hypotenuse ${c}. cos(α) = ___`, `${b}/${c}`, [`${a}/${c}`, `${b}/${a}`, `${c}/${b}`], "cos = Ankathete : Hypotenuse");
  return wahl(`Rechtwinkeliges Dreieck: Gegenkathete von α ${a}, Ankathete ${b}, Hypotenuse ${c}. tan(α) = ___`, `${a}/${b}`, [`${b}/${a}`, `${a}/${c}`, `${b}/${c}`], "tan = Gegenkathete : Ankathete");
};

const vermessung = (rng: Rng) => {
  const w = eins(rng, [20, 25, 30, 35, 40, 45, 50, 60]);
  const d = eins(rng, [10, 20, 25, 40, 50, 80, 100]);
  const h = runde(d * Math.tan(w * GRAD), 2);
  return wahl(`Ein Turm wird aus ${d} m Entfernung unter dem Höhenwinkel ${w}° gesehen. Höhe (Augenhöhe 0): ___`, `${zahl(h)} m`, [`${zahl(runde(d * Math.sin(w * GRAD)))} m`, `${zahl(runde(d / Math.tan(w * GRAD)))} m`, `${zahl(runde(d * Math.cos(w * GRAD)))} m`], "tan(Höhenwinkel) = Höhe : Entfernung, also Höhe = Entfernung · tan(α)");
};

const einheitskreis = (rng: Rng) => {
  const w = eins(rng, [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 270, 300, 360]);
  const sinW = runde(Math.sin(w * GRAD), 3);
  const cosW = runde(Math.cos(w * GRAD), 3);
  const sch = (x: number) => (Math.abs(x) === 0.5 ? (x < 0 ? "−1/2" : "1/2") : Math.abs(x) === 0.707 ? (x < 0 ? "−√2/2" : "√2/2") : Math.abs(x) === 0.866 ? (x < 0 ? "−√3/2" : "√3/2") : zahl(x));
  if (rng() < 0.5) return wahl(`sin(${w}°) = ___`, sch(sinW), [sch(cosW), sch(-sinW || 1), sch(sinW === 0.5 ? 0.866 : 0.5)], "Am Einheitskreis ist sin der y-Wert, cos der x-Wert des Punktes.");
  return wahl(`cos(${w}°) = ___`, sch(cosW), [sch(sinW), sch(-cosW || 1), sch(cosW === 0.5 ? 0.866 : 0.5)], "Am Einheitskreis ist cos der x-Wert, sin der y-Wert des Punktes.");
};

const trigoGleichung = (rng: Rng) => {
  const w = eins(rng, [30, 45, 60]);
  const neg = rng() < 0.4;
  if (rng() < 0.5) {
    const a1 = neg ? 180 + w : w;
    const a2 = neg ? 360 - w : 180 - w;
    return wahl(`sin(α) = ${neg ? "−" : ""}sin(${w}°), 0° ≤ α < 360°. α = ___`, `${a1}° und ${a2}°`, [`${w}° und ${360 - w}°`, `nur ${a1}°`, `${a1}° und ${a1 + 180}°`].filter((x) => x !== `${a1}° und ${a2}°`), "sin ist im 1. und 2. Quadranten positiv, im 3. und 4. negativ: α und 180° − α haben denselben Sinus.");
  }
  const a1 = neg ? 180 - w : w;
  const a2 = neg ? 180 + w : 360 - w;
  return wahl(`cos(α) = ${neg ? "−" : ""}cos(${w}°), 0° ≤ α < 360°. α = ___`, `${a1}° und ${a2}°`, [`${w}° und ${180 - w}°`, `nur ${a1}°`, `${a1}° und ${a1 + 90}°`].filter((x) => x !== `${a1}° und ${a2}°`), "cos ist im 1. und 4. Quadranten positiv: α und 360° − α haben denselben Cosinus.");
};

const sinussatz = (rng: Rng) => {
  const al = eins(rng, [30, 40, 45, 50, 60]);
  const be = eins(rng, [45, 60, 70, 80, 90]);
  const a = ganz(rng, 4, 12);
  const b = runde((a * Math.sin(be * GRAD)) / Math.sin(al * GRAD), 2);
  return wahl(`a = ${a} cm, α = ${al}°, β = ${be}°. b = ___`, `${zahl(b)} cm`, [`${zahl(runde((a * Math.sin(al * GRAD)) / Math.sin(be * GRAD)))} cm`, `${zahl(runde((a * be) / al))} cm`, `${zahl(runde((a * Math.cos(be * GRAD)) / Math.cos(al * GRAD)))} cm`], "Sinussatz: a/sin(α) = b/sin(β), also b = a · sin(β)/sin(α)");
};

const cosinussatz = (rng: Rng) => {
  const b = ganz(rng, 3, 10);
  const c = ganz(rng, 3, 10);
  const al = eins(rng, [30, 45, 60, 90, 120]);
  const a = runde(Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(al * GRAD)), 2);
  return wahl(`b = ${b} cm, c = ${c} cm, α = ${al}°. a = ___`, `${zahl(a)} cm`, [`${zahl(runde(Math.sqrt(b * b + c * c)))} cm`, `${zahl(runde(Math.sqrt(b * b + c * c + 2 * b * c * Math.cos(al * GRAD))))} cm`, `${zahl(b + c)} cm`].filter((x) => x !== `${zahl(a)} cm`), "Cosinussatz: a² = b² + c² − 2bc · cos(α)");
};

const dreieckFlaeche = (rng: Rng) => {
  const b = ganz(rng, 3, 12);
  const c = ganz(rng, 3, 12);
  const al = eins(rng, [30, 45, 60, 90, 120, 150]);
  const A = runde((b * c * Math.sin(al * GRAD)) / 2, 2);
  return wahl(`b = ${b} cm, c = ${c} cm, α = ${al}°. Fläche A = ___`, `${zahl(A)} cm²`, [`${zahl(runde(b * c * Math.sin(al * GRAD)))} cm²`, `${zahl(runde((b * c * Math.cos(al * GRAD)) / 2))} cm²`, `${zahl((b * c) / 2)} cm²`].filter((x) => x !== `${zahl(A)} cm²`), "A = 1/2 · b · c · sin(α): zwei Seiten und der Winkel dazwischen.");
};

const bogenmass = (rng: Rng) => {
  const [g, b] = eins(rng, [[30, "π/6"], [45, "π/4"], [60, "π/3"], [90, "π/2"], [120, "2π/3"], [135, "3π/4"], [180, "π"], [270, "3π/2"], [360, "2π"], [150, "5π/6"]] as [number, string][]);
  if (rng() < 0.5) return wahl(`${g}° im Bogenmaß: ___`, b, ["π/6", "π/4", "π/3", "π/2", "π", "2π"].filter((x) => x !== b).slice(0, 3).concat([`${g}π`]), "x = α · π/180°");
  return wahl(`${b} im Gradmaß: ___`, `${g}°`, [`${zahl(g / 2)}°`, `${g * 2}°`, `${zahl(runde((g * Math.PI) / 180, 2))}°`], "α = x · 180°/π");
};

const sinusAllgemein = (rng: Rng) => {
  const a = ganz(rng, 2, 5);
  const b = eins(rng, [2, 3, 4, 0.5]);
  if (rng() < 0.5) return wahl(`f(x) = ${a} · sin(${zahl(b)}x). Amplitude: ___`, String(a), [zahl(b), String(2 * a), "1"].filter((x) => x !== String(a)), "Die Zahl vor dem sin ist die Amplitude (größter Ausschlag).");
  const p = b === 0.5 ? "4π" : b === 2 ? "π" : b === 4 ? "π/2" : `2π/${b}`;
  return wahl(`f(x) = ${a} · sin(${zahl(b)}x). Periode: ___`, p, ["2π", `${zahl(2 * b)}π`, `${a}π`].filter((x) => x !== p), "Periode = 2π/b");
};

// ---------- Vektoren ----------

const vektorRechnen = (rng: Rng) => {
  const a = [ganz(rng, -6, 6), ganz(rng, -6, 6)];
  const b = [ganz(rng, -6, 6), ganz(rng, -6, 6)];
  const art = ganz(rng, 0, 2);
  if (art === 0) return wahl(`${vek(...a)} + ${vek(...b)} = ___`, vek(a[0] + b[0], a[1] + b[1]), [vek(a[0] - b[0], a[1] - b[1]), vek(a[0] + b[1], a[1] + b[0]), vek(a[0] * b[0], a[1] * b[1])], "Komponentenweise addieren.");
  if (art === 1) return wahl(`A${vek(...a)}, B${vek(...b)}. Vektor AB = ___`, vek(b[0] - a[0], b[1] - a[1]), [vek(a[0] - b[0], a[1] - b[1]), vek(a[0] + b[0], a[1] + b[1]), vek(b[0] - a[1], b[1] - a[0])], "AB = B − A (Spitze minus Schaft)");
  const k = eins(rng, [-3, -2, 2, 3, 4]);
  return wahl(`${zahl(k)} · ${vek(...a)} = ___`, vek(k * a[0], k * a[1]), [vek(k * a[0], a[1]), vek(k + a[0], k + a[1]), vek(-k * a[0], -k * a[1])], "Jede Koordinate mit der Zahl multiplizieren.");
};

const betrag = (rng: Rng) => {
  const [x, y, l] = eins(rng, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [12, 5, 13], [0, 7, 7], [9, 12, 15]] as [number, number, number][]);
  const sx = rng() < 0.5 ? -1 : 1;
  return wahl(`Betrag von ${vek(sx * x, y)} = ___`, zahl(l), [zahl(Math.abs(sx * x + y)), zahl(x + y), zahl(x * x + y * y)].filter((s) => s !== zahl(l)), "Betrag = √(x² + y²)");
};

const normalvektor = (rng: Rng) => {
  const a = [ganz(rng, -6, 6) || 2, ganz(rng, -6, 6) || 3];
  return wahl(`Ein Normalvektor zu ${vek(...a)} ist ___`, vek(-a[1], a[0]), [vek(a[1], a[0]), vek(-a[0], -a[1]), vek(-a[0], a[1])].filter((s) => s !== vek(-a[1], a[0]) && s !== vek(a[1], -a[0])), "Koordinaten tauschen und bei einer das Vorzeichen ändern: (x ∣ y) → (−y ∣ x).");
};

const skalarprodukt = (rng: Rng) => {
  const a = [ganz(rng, -5, 5), ganz(rng, -5, 5)];
  const b = [ganz(rng, -5, 5), ganz(rng, -5, 5)];
  const s = a[0] * b[0] + a[1] * b[1];
  if (rng() < 0.7) return wahl(`${vek(...a)} · ${vek(...b)} = ___`, zahl(s), [vek(a[0] * b[0], a[1] * b[1]), zahl(a[0] * b[1] + a[1] * b[0]), zahl(s + 1)].filter((x) => x !== zahl(s)), "Skalarprodukt: x₁ · x₂ + y₁ · y₂ (eine Zahl, kein Vektor)");
  return wahl(`Stehen ${vek(...a)} und ${vek(...b)} normal aufeinander?`, s === 0 ? "ja" : "nein", [s === 0 ? "nein" : "ja"], `Skalarprodukt = ${zahl(s)}; normal genau dann, wenn es 0 ist.`);
};

const geradeParameter = (rng: Rng) => {
  const p = [ganz(rng, -4, 4), ganz(rng, -4, 4)];
  const r = [ganz(rng, -3, 3) || 1, ganz(rng, -3, 3) || 2];
  const t = ganz(rng, -2, 3);
  return wahl(`g: X = ${vek(...p)} + t · ${vek(...r)}. Punkt für t = ${zahl(t)}: ___`, vek(p[0] + t * r[0], p[1] + t * r[1]), [vek(r[0] + t * p[0], r[1] + t * p[1]), vek(p[0] + r[0], p[1] + r[1]), vek(t * r[0], t * r[1])].filter((s) => s !== vek(p[0] + t * r[0], p[1] + t * r[1])), "X = P + t · Richtungsvektor");
};

const geradeNormal = (rng: Rng) => {
  const n = [ganz(rng, 1, 5), ganz(rng, -5, 5) || 1];
  const p = [ganz(rng, -4, 4), ganz(rng, -4, 4)];
  const c = n[0] * p[0] + n[1] * p[1];
  const g = `${n[0] === 1 ? "" : n[0]}x ${n[1] < 0 ? "−" : "+"} ${Math.abs(n[1]) === 1 ? "" : Math.abs(n[1])}y ＝ ${zahl(c)}`;
  return wahl(`Gerade durch P${vek(...p)} mit Normalvektor ${vek(...n)}: ___`, g, [`${n[1] === 1 ? "" : zahl(n[1])}x ${n[0] < 0 ? "−" : "+"} ${n[0] === 1 ? "" : n[0]}y ＝ ${zahl(c)}`, `${n[0] === 1 ? "" : n[0]}x ${n[1] < 0 ? "−" : "+"} ${Math.abs(n[1]) === 1 ? "" : Math.abs(n[1])}y ＝ ${zahl(-c || 1)}`, `${n[0] === 1 ? "" : n[0]}x ${n[1] < 0 ? "−" : "+"} ${Math.abs(n[1]) === 1 ? "" : Math.abs(n[1])}y ＝ ${zahl(p[0] + p[1])}`].filter((x) => x !== g), "n · X = n · P: ax + by = a · p₁ + b · p₂");
};

const raumBetrag = (rng: Rng) => {
  const [x, y, z, l] = eins(rng, [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9], [2, 2, 1, 3], [6, 6, 7, 11]] as [number, number, number, number][]);
  const s = rng() < 0.5 ? -1 : 1;
  if (rng() < 0.5) return wahl(`Betrag von ${vek(s * x, y, z)} = ___`, zahl(l), [zahl(x + y + z), zahl(x * x + y * y + z * z), zahl(runde(Math.sqrt(x * x + y * y), 2))].filter((v) => v !== zahl(l)), "Betrag = √(x² + y² + z²)");
  const a = [ganz(rng, -4, 4), ganz(rng, -4, 4), ganz(rng, -4, 4)];
  const b = [ganz(rng, -4, 4), ganz(rng, -4, 4), ganz(rng, -4, 4)];
  return wahl(`A${vek(...a)}, B${vek(...b)}. Vektor AB = ___`, vek(b[0] - a[0], b[1] - a[1], b[2] - a[2]), [vek(a[0] - b[0], a[1] - b[1], a[2] - b[2]), vek(a[0] + b[0], a[1] + b[1], a[2] + b[2])], "AB = B − A, auch im Raum");
};

const kreuz = (rng: Rng) => {
  const a = [ganz(rng, -3, 3), ganz(rng, -3, 3), ganz(rng, -3, 3)];
  const b = [ganz(rng, -3, 3), ganz(rng, -3, 3), ganz(rng, -3, 3)];
  const k = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return wahl(`${vek(...a)} × ${vek(...b)} = ___`, vek(...k), [vek(-k[0], -k[1], -k[2]), vek(a[0] * b[0], a[1] * b[1], a[2] * b[2]), vek(k[0], -k[1], k[2])].filter((s) => s !== vek(...k)), "Kreuzprodukt: (a₂b₃ − a₃b₂ ∣ a₃b₁ − a₁b₃ ∣ a₁b₂ − a₂b₁); a × b = −(b × a)");
};

// ---------- Komplexe Zahlen, Matrizen ----------

const komplex = (a: number, b: number) => (b === 0 ? zahl(a) : a === 0 ? `${b === 1 ? "" : b === -1 ? "−" : zahl(b)}i` : `${zahl(a)} ${b < 0 ? "−" : "+"} ${Math.abs(b) === 1 ? "" : zahl(Math.abs(b))}i`);
const komplexRechnen = (rng: Rng) => {
  const [a, b, c, d] = [ganz(rng, -5, 5), ganz(rng, -5, 5) || 1, ganz(rng, -5, 5), ganz(rng, -5, 5) || 2];
  if (rng() < 0.4) return wahl(`(${komplex(a, b)}) + (${komplex(c, d)}) = ___`, komplex(a + c, b + d), [komplex(a + d, b + c), komplex(a - c, b - d), komplex(a * c, b * d)].filter((s) => s !== komplex(a + c, b + d)), "Realteile addieren, Imaginärteile addieren.");
  return wahl(`(${komplex(a, b)}) · (${komplex(c, d)}) = ___`, komplex(a * c - b * d, a * d + b * c), [komplex(a * c + b * d, a * d + b * c), komplex(a * c, b * d), komplex(a * c - b * d, a * d - b * c)].filter((s) => s !== komplex(a * c - b * d, a * d + b * c)), "Ausmultiplizieren und i² = −1 beachten.");
};

const komplexGleichung = (rng: Rng) => {
  const p = ganz(rng, -4, 4) * 2;
  const b = ganz(rng, 1, 5);
  const q = (p * p) / 4 + b * b;
  const re = -p / 2;
  return wahl(`x² ${p ? `${p < 0 ? "−" : "+"} ${Math.abs(p)}x ` : ""}+ ${q} = 0. L = ___`, `{${komplex(re, b)}; ${komplex(re, -b)}}`, [`{${zahl(re + b)}; ${zahl(re - b)}}`, `{${komplex(-re, b)}; ${komplex(-re, -b)}}`, "{ }"], "D < 0: x = −p/2 ± i · √(q − (p/2)²); die Lösungen sind konjugiert komplex.");
};

const matrixMal = (rng: Rng) => {
  const m = [ganz(rng, -3, 4), ganz(rng, -3, 4), ganz(rng, -3, 4), ganz(rng, -3, 4)];
  const v = [ganz(rng, -3, 4), ganz(rng, -3, 4)];
  const r = [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
  return wahl(`Matrix mit Zeilen (${zahl(m[0])}, ${zahl(m[1])}) und (${zahl(m[2])}, ${zahl(m[3])}) mal Spalte (${zahl(v[0])}, ${zahl(v[1])}) = ___`, `(${zahl(r[0])}, ${zahl(r[1])})`, [`(${zahl(m[0] * v[0] + m[2] * v[1])}, ${zahl(m[1] * v[0] + m[3] * v[1])})`, `(${zahl(m[0] * v[0])}, ${zahl(m[3] * v[1])})`, `(${zahl(r[1])}, ${zahl(r[0])})`].filter((s) => s !== `(${zahl(r[0])}, ${zahl(r[1])})`), "Zeile mal Spalte: erste Zeile · Vektor gibt den ersten Eintrag.");
};

const determinante = (rng: Rng) => {
  const [a, b, c, d] = [ganz(rng, -4, 6), ganz(rng, -4, 6), ganz(rng, -4, 6), ganz(rng, -4, 6)];
  return wahl(`Determinante der Matrix mit Zeilen (${zahl(a)}, ${zahl(b)}) und (${zahl(c)}, ${zahl(d)}): ___`, zahl(a * d - b * c), [zahl(a * d + b * c), zahl(b * c - a * d), zahl(a * b - c * d)].filter((s) => s !== zahl(a * d - b * c)), "det = a · d − b · c (Hauptdiagonale minus Nebendiagonale)");
};

export const MATHE_OBERSTUFE_GEOMETRIE: QuizBank = {
  "mathe.os.trigo.rechtwinkelig": { text: `sin(α) = ___ = Gegenkathete : Hypotenuse | Ankathete : Hypotenuse | Gegenkathete : Ankathete
cos(α) = ___ = Ankathete : Hypotenuse | Gegenkathete : Hypotenuse | Hypotenuse : Ankathete
tan(α) = ___ = Gegenkathete : Ankathete | Ankathete : Gegenkathete | Hypotenuse : Gegenkathete
sin(α) kann höchstens ___ sein. = 1 | 90 | unendlich groß
Im rechtwinkeligen Dreieck ist sin(α) = cos(___) = 90° − α | α | 180° − α`, erzeuge: rechtwinkelig },
  "mathe.os.trigo.vermessung": { text: `Der Höhenwinkel wird gemessen von ___ = der Waagrechten nach oben | der Senkrechten | dem Boden nach unten
Der Tiefenwinkel wird gemessen von ___ = der Waagrechten nach unten | der Senkrechten nach oben | der Straße
Eine Steigung von 10 % heißt: auf 100 m waagrecht ___ = 10 m hinauf | 10 m entlang der Straße | 10° Winkel
Steigung 100 % entspricht einem Winkel von ___ = 45° | 90° | 100°
Steigungswinkel aus Steigung k: α = ___ = arctan(k) | arcsin(k) | k · 90°`, erzeuge: vermessung },
  "mathe.os.trigo.einheitskreis": { text: `Der Einheitskreis hat den Radius ___ = 1 | 2 | π
sin²(α) + cos²(α) = ___ = 1 | 0 | 2
sin(180° − α) = ___ = sin(α) | −sin(α) | cos(α)
cos(360° − α) = ___ = cos(α) | −cos(α) | sin(α)
Im 2. Quadranten ist cos(α) ___ = negativ | positiv | null`, erzeuge: einheitskreis },
  "mathe.os.trigo.gleichungen": { text: `Wie viele Lösungen hat sin(α) = 0,5 zwischen 0° und 360°? = 2 | 1 | 4
Wie viele Lösungen hat sin(α) = 2? = keine | eine | zwei
sin(α) = 1 für 0° ≤ α < 360°: α = ___ = 90° | 0° und 180° | 270°
cos(α) = −1 für 0° ≤ α < 360°: α = ___ = 180° | 0° | 90° und 270°`, erzeuge: trigoGleichung },
  "mathe.os.trigo.sinussatz": { text: `Sinussatz: a/sin(α) = ___ = b/sin(β) | b/cos(β) | sin(β)/b
Den Sinussatz verwendet man bei ___ = zwei Winkeln und einer Seite | drei Seiten | zwei Seiten und dem Winkel dazwischen
Der Sinussatz gilt in ___ = jedem Dreieck | nur im rechtwinkeligen Dreieck | nur im gleichseitigen Dreieck`, erzeuge: sinussatz },
  "mathe.os.trigo.cosinussatz": { text: `Cosinussatz: c² = ___ = a² + b² − 2ab · cos(γ) | a² + b² | a² + b² + 2ab · sin(γ)
Den Cosinussatz verwendet man bei ___ = drei Seiten oder SWS | zwei Winkeln und einer Seite | nur einem Winkel
Für γ = 90° wird der Cosinussatz zum ___ = Satz des Pythagoras | Sinussatz | Strahlensatz`, erzeuge: cosinussatz },
  "mathe.os.trigo.flaeche": { text: `Fläche eines Dreiecks: A = ___ = 1/2 · a · b · sin(γ) | a · b · sin(γ) | 1/2 · a · b · cos(γ)
Die Fläche ist am größten, wenn der eingeschlossene Winkel ___ ist. = 90° | 180° | 45°`, erzeuge: dreieckFlaeche },
  "mathe.os.trigo.polarkoordinaten": `Polarkoordinaten geben einen Punkt an durch ___ = Abstand r und Winkel φ | x und y | zwei Winkel
P = (r; φ) = (2; 0°) in kartesischen Koordinaten: ___ = (2 ∣ 0) | (0 ∣ 2) | (2 ∣ 2)
P = (3; 90°) in kartesischen Koordinaten: ___ = (0 ∣ 3) | (3 ∣ 0) | (3 ∣ 3)
P = (4; 180°) in kartesischen Koordinaten: ___ = (−4 ∣ 0) | (0 ∣ −4) | (4 ∣ 0)
x = ___ = r · cos(φ) | r · sin(φ) | r · tan(φ)
y = ___ = r · sin(φ) | r · cos(φ) | r/sin(φ)
P(3 ∣ 4) hat den Abstand r = ___ = 5 | 7 | 12
P(1 ∣ 1) hat den Winkel φ = ___ = 45° | 90° | 1°
P(0 ∣ −2) in Polarkoordinaten: ___ = (2; 270°) | (2; 90°) | (−2; 0°)
r = √(x² + y²) gilt für ___ = jeden Punkt | nur im 1. Quadranten | nur für x > 0
P(−1 ∣ 0) hat φ = ___ = 180° | 0° | 90°
tan(φ) = ___ = y/x | x/y | r/x`,
  "mathe.os.trigo.bogenmass": { text: `Ein Vollwinkel im Bogenmaß: ___ = 2π | π | 360
1 rad sind ungefähr ___ = 57,3° | 1° | 3,14°
Der Taschenrechner muss für Bogenmaß auf ___ stehen. = RAD | DEG | GRAD`, erzeuge: bogenmass },
  "mathe.os.trigo.funktionen": `Die Periode von sin(x) ist ___ = 2π | π | 1
Die Nullstellen von sin(x) sind ___ = k · π | k · 2π | π/2 + k · π
cos(0) = ___ = 1 | 0 | −1
sin(π/2) = ___ = 1 | 0 | π
Der Wertebereich von sin(x) ist ___ = [−1; 1] | ℝ | [0; 1]
cos(x) ist sin(x) verschoben um ___ = π/2 nach links | π nach rechts | 1 nach oben
cos(x) ist ___ = gerade | ungerade | weder noch
sin(x) ist ___ = ungerade | gerade | weder noch
Bei x = π hat cos(x) den Wert ___ = −1 | 1 | 0
Der höchste Wert von cos(x) ist ___ = 1 | 2π | π
tan(x) ist nicht definiert bei ___ = π/2 | 0 | π
sin(x + 2π) = ___ = sin(x) | −sin(x) | cos(x)`,
  "mathe.os.trigo.allgemein": { text: `In f(x) = a · sin(b · x) bestimmt a ___ = die Amplitude | die Periode | die Verschiebung
In f(x) = a · sin(b · x) bestimmt b ___ = die Periode (Frequenz) | die Amplitude | die Höhe
Größeres b bedeutet ___ = kürzere Periode | längere Periode | größere Amplitude`, erzeuge: sinusAllgemein },
  "mathe.os.vektoren.rechnen": { text: `Ein Vektor beschreibt ___ = eine Verschiebung (Richtung und Länge) | einen Punkt | eine Zahl
Der Gegenvektor zu (2 ∣ −3) ist ___ = (−2 ∣ 3) | (3 ∣ −2) | (2 ∣ 3)
Der Nullvektor ist ___ = (0 ∣ 0) | (1 ∣ 1) | (1 ∣ 0)`, erzeuge: vektorRechnen },
  "mathe.os.vektoren.betrag": { text: `Der Betrag eines Vektors ist ___ = seine Länge | seine Richtung | sein erster Eintrag
Abstand von A und B = ___ = Betrag von AB | A + B | A · B
Kann ein Betrag negativ sein? = nein | ja`, erzeuge: betrag },
  "mathe.os.vektoren.normal": { text: `Ein Einheitsvektor hat die Länge ___ = 1 | 0 | 10
Einheitsvektor zu (3 ∣ 4): ___ = (3/5 ∣ 4/5) | (3/7 ∣ 4/7) | (1 ∣ 1)
Zwei Vektoren sind normal, wenn ihr Skalarprodukt ___ ist. = 0 | 1 | −1`, erzeuge: normalvektor },
  "mathe.os.vektoren.skalarprodukt": { text: `Das Skalarprodukt zweier Vektoren ist ___ = eine Zahl | ein Vektor | eine Matrix
cos(φ) = ___ = (a · b)/(Betrag a · Betrag b) | Betrag a · Betrag b | a · b
Ist das Skalarprodukt negativ, ist der Winkel ___ = stumpf | spitz | 90°`, erzeuge: skalarprodukt },
  "mathe.os.vektoren.gerade-parameter": { text: `In X = P + t · a heißt a ___ = Richtungsvektor | Normalvektor | Stützpunkt
In X = P + t · a heißt P ___ = Stützpunkt (Aufpunkt) | Richtungsvektor | Parameter
Gerade durch A und B: Richtungsvektor ___ = AB | A + B | A
Liegt ein Punkt auf g, so gibt es ___ = genau ein t | kein t | zwei t`, erzeuge: geradeParameter },
  "mathe.os.vektoren.gerade-normal": { text: `In ax + by = c ist ___ ein Normalvektor. = (a ∣ b) | (b ∣ a) | (c ∣ 0)
Gerade 2x + 3y = 6: Normalvektor ___ = (2 ∣ 3) | (3 ∣ −2) | (6 ∣ 0)
Gerade 2x + 3y = 6: Richtungsvektor ___ = (3 ∣ −2) | (2 ∣ 3) | (2 ∣ −3)
Liegt P(3 ∣ 0) auf 2x + 3y = 6? = ja | nein`, erzeuge: geradeNormal },
  "mathe.os.vektoren.lage": `Zwei Geraden mit parallelen Richtungsvektoren und gemeinsamem Punkt sind ___ = identisch | parallel | schneidend
Zwei Geraden mit parallelen Richtungsvektoren ohne gemeinsamen Punkt sind ___ = parallel | identisch | windschief
Zwei Geraden in der Ebene, nicht parallel: sie sind ___ = schneidend | windschief | identisch
Windschiefe Geraden gibt es nur ___ = im Raum | in der Ebene | auf dem Kreis
Windschief heißt ___ = nicht parallel und kein Schnittpunkt | parallel | genau ein Schnittpunkt
Richtungsvektoren (2 ∣ 4) und (1 ∣ 2) sind ___ = parallel | normal | windschief
Richtungsvektoren (1 ∣ 2) und (2 ∣ −1) sind ___ = normal | parallel | gleich
Den Schnittpunkt findet man durch ___ = Gleichsetzen | Addieren der Stützpunkte | Kreuzprodukt
Gleichsetzen ergibt einen Widerspruch (0 = 3): die Geraden sind ___ = parallel (ohne gemeinsamen Punkt) | identisch | schneidend
x + y = 2 und x + y = 5 sind ___ = parallel | identisch | schneidend
x + y = 2 und 2x + 2y = 4 sind ___ = identisch | parallel | schneidend
x + y = 2 und x − y = 0 schneiden sich in ___ = (1 ∣ 1) | (2 ∣ 0) | (0 ∣ 2)`,
  "mathe.os.vektoren.abstand": `Der Abstand eines Punktes von einer Geraden wird gemessen ___ = normal (senkrecht) zur Geraden | waagrecht | entlang der Geraden
Abstand von P(0 ∣ 0) zur Geraden y = 3: ___ = 3 | 0 | 9
Abstand von P(5 ∣ 2) zur Geraden x = 1: ___ = 4 | 5 | 1
Mit der Hesse’schen Normalform braucht man ___ = einen Normalvektor der Länge 1 | einen Richtungsvektor | zwei Punkte
Abstand von P(x₀ ∣ y₀) zu ax + by = c: ___ = Betrag von (ax₀ + by₀ − c)/√(a² + b²) | ax₀ + by₀ − c | √(x₀² + y₀²)
Abstand von P(0 ∣ 0) zu 3x + 4y = 10: ___ = 2 | 10 | 2,5
Abstand von P(1 ∣ 1) zu 3x + 4y = 2: ___ = 1 | 5 | 7
Liegt P auf der Geraden, ist der Abstand ___ = 0 | 1 | nicht definiert
Den Lotfußpunkt findet man mit ___ = einer Normalen durch P | dem Mittelpunkt | dem Ursprung
Zwei parallele Geraden haben überall ___ = denselben Abstand | den Abstand 0 | verschiedene Abstände
Abstand von P(2 ∣ 7) zur x-Achse: ___ = 7 | 2 | √53
Abstand von P(−3 ∣ 1) zur y-Achse: ___ = 3 | 1 | −3`,
  "mathe.os.vektoren.raum": { text: `Ein Punkt im Raum hat ___ Koordinaten. = 3 | 2 | 4
Die z-Achse zeigt meist ___ = nach oben | nach rechts | nach vorne
Mittelpunkt von A(0 ∣ 0 ∣ 0) und B(2 ∣ 4 ∣ 6): ___ = (1 ∣ 2 ∣ 3) | (2 ∣ 4 ∣ 6) | (4 ∣ 8 ∣ 12)`, erzeuge: raumBetrag },
  "mathe.os.vektoren.kreuzprodukt": { text: `Das Kreuzprodukt a × b ist ___ = ein Vektor normal auf a und b | eine Zahl | parallel zu a
Der Betrag von a × b ist ___ = die Fläche des Parallelogramms | das Volumen | der Winkel
Das Kreuzprodukt gibt es nur ___ = im Raum (3 Koordinaten) | in der Ebene | bei Zahlen
a × a = ___ = der Nullvektor | a² | 1`, erzeuge: kreuz },
  "mathe.os.vektoren.ebene": `Eine Ebene in Parameterform braucht ___ = einen Punkt und zwei Richtungsvektoren | einen Punkt und einen Richtungsvektor | drei Normalvektoren
Die Normalvektorform einer Ebene: ___ = ax + by + cz ＝ d | ax + by ＝ c | X ＝ P + t · a
In ax + by + cz = d ist ___ ein Normalvektor. = (a ∣ b ∣ c) | (d ∣ 0 ∣ 0) | (a ∣ b ∣ d)
Ebene 2x − y + 3z = 6: Liegt P(3 ∣ 0 ∣ 0) darauf? = ja | nein
Ebene 2x − y + 3z = 6: Liegt P(0 ∣ 0 ∣ 2) darauf? = ja | nein
Ebene 2x − y + 3z = 6: Liegt P(1 ∣ 1 ∣ 1) darauf? = nein | ja
Den Normalvektor aus der Parameterform bekommt man mit ___ = dem Kreuzprodukt der Richtungsvektoren | dem Skalarprodukt | der Summe
Die xy-Ebene hat die Gleichung ___ = z ＝ 0 | x ＝ 0 | x + y ＝ 0
Zwei Ebenen mit parallelen Normalvektoren sind ___ = parallel oder identisch | schneidend | windschief
Zwei nicht parallele Ebenen schneiden sich in ___ = einer Geraden | einem Punkt | einer Ebene
Drei Punkte, die nicht auf einer Geraden liegen, bestimmen ___ = genau eine Ebene | zwei Ebenen | keine Ebene
Ebene x + y + z = 3: Schnittpunkt mit der x-Achse ___ = (3 ∣ 0 ∣ 0) | (1 ∣ 0 ∣ 0) | (0 ∣ 0 ∣ 3)`,
  "mathe.os.vektoren.schnitt": `Den Schnittpunkt Gerade–Ebene findet man, indem man ___ = die Gerade in die Ebenengleichung einsetzt | die Normalvektoren addiert | die Ebene in die Gerade einsetzt
g: X = (0 ∣ 0 ∣ 0) + t · (1 ∣ 1 ∣ 1), Ebene x + y + z = 6. t = ___ = 2 | 6 | 3
g: X = (0 ∣ 0 ∣ 0) + t · (1 ∣ 1 ∣ 1), Ebene x + y + z = 6. Schnittpunkt: ___ = (2 ∣ 2 ∣ 2) | (6 ∣ 6 ∣ 6) | (1 ∣ 1 ∣ 1)
Ergibt das Einsetzen 0 = 5, ist die Gerade ___ = parallel zur Ebene | in der Ebene | normal zur Ebene
Ergibt das Einsetzen 0 = 0, liegt die Gerade ___ = in der Ebene | parallel daneben | normal dazu
Richtungsvektor normal zum Normalvektor der Ebene heißt: die Gerade ist ___ = parallel zur Ebene oder liegt darin | normal zur Ebene | windschief
Richtungsvektor parallel zum Normalvektor heißt: die Gerade steht ___ auf der Ebene. = normal | schief | parallel
g: X = (1 ∣ 0 ∣ 0) + t · (0 ∣ 0 ∣ 1), Ebene z = 4. Schnittpunkt: ___ = (1 ∣ 0 ∣ 4) | (0 ∣ 0 ∣ 4) | (1 ∣ 0 ∣ 0)
Der Winkel zwischen Gerade und Ebene wird mit ___ berechnet. = dem Sinus | dem Tangens | dem Kreuzprodukt allein
Eine Gerade, die die Ebene schneidet, hat mit ihr ___ = genau einen Punkt gemeinsam | keinen Punkt | zwei Punkte
Das Lot von einem Punkt auf eine Ebene hat als Richtung ___ = den Normalvektor der Ebene | einen Richtungsvektor der Ebene | den Ortsvektor
Der Abstand Punkt–Ebene wird gemessen ___ = entlang des Normalvektors | parallel zur Ebene | zum Ursprung`,
  "mathe.os.vektoren.anwendungen": `Preise (2 ∣ 3) € und Mengen (4 ∣ 5). Gesamtpreis: ___ = 23 € | 14 € | (8 ∣ 15) €
Ein Mengenvektor beschreibt ___ = wie viel von jedem Produkt | den Preis je Stück | die Richtung
Gesamtpreis = Preisvektor ___ Mengenvektor. = Skalarprodukt mit | plus | Kreuzprodukt mit
Zwei Lieferungen (3 ∣ 1 ∣ 2) und (1 ∣ 4 ∣ 0) zusammen: ___ = (4 ∣ 5 ∣ 2) | (3 ∣ 4 ∣ 0) | (2 ∣ −3 ∣ 2)
Preise steigen um 10 %: neuer Preisvektor = ___ = 1,1 · Preisvektor | Preisvektor + 10 | 0,1 · Preisvektor
Preise (1 ∣ 2 ∣ 5), Mengen (10 ∣ 5 ∣ 2). Gesamtpreis: ___ = 30 | 8 | 17
Ein Lager hat (20 ∣ 15) Stück, verkauft werden (5 ∣ 8). Rest: ___ = (15 ∣ 7) | (25 ∣ 23) | (−15 ∣ −7)
Verdopplung jeder Menge (3 ∣ 4): ___ = (6 ∣ 8) | (5 ∣ 6) | (3 ∣ 8)
Kosten je Stück (4 ∣ 6), Mengen (10 ∣ 10). Kosten: ___ = 100 | 20 | (40 ∣ 60)
Erlös − Kosten = ___ = Gewinn | Menge | Preis
Vektoren in Tabellen: eine Zeile oder Spalte entspricht ___ = einem Vektor | einer Zahl | einem Winkel
Eine Kraft von (3 ∣ 4) N hat den Betrag ___ = 5 N | 7 N | 12 N`,
  "mathe.os.matrizen.grundlagen": `Eine 2×3-Matrix hat ___ = 2 Zeilen und 3 Spalten | 3 Zeilen und 2 Spalten | 6 Zeilen
Matrizen addieren darf man nur bei ___ = gleichem Format | quadratischen Matrizen | Zahlen
Matrizen addiert man ___ = Eintrag für Eintrag | Zeile mal Spalte | gar nicht
3 · Matrix bedeutet ___ = jeden Eintrag mal 3 | nur die erste Zeile mal 3 | die Diagonale mal 3
Die Einheitsmatrix hat auf der Hauptdiagonale ___ = Einsen | Nullen | Zweien
Eine quadratische Matrix hat ___ = gleich viele Zeilen und Spalten | nur Nullen | vier Einträge
Der Eintrag a₂₃ steht in ___ = Zeile 2, Spalte 3 | Zeile 3, Spalte 2 | Spalte 23
Die transponierte Matrix entsteht durch ___ = Vertauschen von Zeilen und Spalten | Umkehren der Vorzeichen | Kürzen
Eine 3×1-Matrix ist ___ = ein Spaltenvektor | ein Zeilenvektor | eine Zahl
Die Nullmatrix hat ___ = nur Nullen | nur Einsen | keine Einträge
(1 2) + (3 4) als Zeilen = ___ = (4 6) | (3 8) | (1 2 3 4)
A − A = ___ = Nullmatrix | Einheitsmatrix | A`,
  "mathe.os.matrizen.multiplizieren": { text: `A (2×3) mal B (3×4) ergibt eine Matrix mit Format ___ = 2×4 | 3×3 | 4×2
A · B geht nur, wenn ___ = Spalten von A ＝ Zeilen von B | Zeilen von A ＝ Zeilen von B | beide quadratisch sind
Ist A · B = B · A immer? = nein | ja
E · A = ___ (E Einheitsmatrix) = A | E | 0`, erzeuge: matrixMal },
  "mathe.os.matrizen.gleichungssysteme": `x + 2y = 5 und 3x + 4y = 6 als Matrixgleichung: ___ = A · X ＝ B | A + X ＝ B | X · A ＝ 0
In A · X = B ist A ___ = die Koeffizientenmatrix | der Lösungsvektor | die rechte Seite
In A · X = B ist X ___ = der Vektor der Unbekannten | die rechte Seite | die Determinante
Ist A invertierbar, gilt X = ___ = A⁻¹ · B | B · A | B − A
Koeffizientenmatrix von 2x − y = 1 und x + 3y = 4: Zeilen ___ = (2, −1) und (1, 3) | (2, 1) und (−1, 3) | (1, 4) und (2, −1)
Ein Gleichungssystem mit det(A) = 0 hat ___ = keine oder unendlich viele Lösungen | genau eine Lösung | immer zwei Lösungen
Ein Gleichungssystem mit det(A) ≠ 0 hat ___ = genau eine Lösung | keine Lösung | unendlich viele
Beim Gauß-Verfahren darf man Zeilen ___ = vertauschen, vervielfachen und addieren | nur vertauschen | gar nicht ändern
Die erweiterte Koeffizientenmatrix enthält ___ = auch die rechte Seite | nur die Lösungen | nur die Diagonale
Für Gleichungssysteme mit Matrizen verwendet man meist ___ = Technologie (Rechner) | einen Zirkel | das Geodreieck
3x = 6 und 2y = 8 als Diagonalmatrix: X = ___ = (2, 4) | (6, 8) | (3, 2)
Eine Zeile (0 0 ∣ 5) in der Stufenform bedeutet ___ = keine Lösung | unendlich viele Lösungen | x ＝ 5`,
  "mathe.os.matrizen.inverse": { text: `A · A⁻¹ = ___ = E (Einheitsmatrix) | 0 | A²
Eine Matrix hat genau dann eine Inverse, wenn ___ = det(A) ≠ 0 | det(A) ＝ 0 | sie 2×3 ist
Die Inverse einer 2×2-Matrix: man tauscht a und d, ändert die Vorzeichen von b und c und dividiert durch ___ = det(A) | a + d | 2`, erzeuge: determinante },
  "mathe.os.matrizen.bedarf": `Ein Gozintograph zeigt ___ = welche Teile in welche Produkte eingehen | Preise | Gewinne
Die Bedarfsmatrix gibt an, ___ = wie viele Rohstoffe je Endprodukt nötig sind | wie viel ein Produkt kostet | wie viele Kunden es gibt
Rohstoffbedarf = Bedarfsmatrix ___ Produktionsvektor. = mal | plus | minus
Produkt P braucht 2 Teile A und 3 Teile B. Für 10 P braucht man ___ = 20 A und 30 B | 2 A und 3 B | 50 Teile A
Bei zwei Produktionsstufen multipliziert man ___ = die Matrizen der Stufen | die Preise | die Mengen der Endprodukte
P braucht 2 Z, Z braucht 3 R. Wie viele R für 1 P? = 6 | 5 | 1,5
P braucht 2 Z, Z braucht 3 R. Wie viele R für 5 P? = 30 | 10 | 15
Mit Rohstoffpreisen und Bedarf berechnet man ___ = die Materialkosten je Produkt | den Verkaufspreis | den Gewinn allein
Die Zeilen der Bedarfsmatrix stehen meist für ___ = die Rohstoffe | die Kunden | die Monate
Die Spalten der Bedarfsmatrix stehen meist für ___ = die Produkte | die Rohstoffe | die Preise
Vorhanden sind Rohstoffe, gesucht die mögliche Produktion: man löst ___ = ein Gleichungssystem | eine Summe | einen Logarithmus
Gozinto kommt von ___ = goes into (geht hinein) | einem Ort | einer Firma`,
  "mathe.os.komplex.rechnen": { text: `i² = ___ = −1 | 1 | i
In z = a + bi ist a ___ = der Realteil | der Imaginärteil | der Betrag
Die konjugiert komplexe Zahl zu 3 + 2i ist ___ = 3 − 2i | −3 + 2i | −3 − 2i
(a + bi) · (a − bi) = ___ = a² + b² | a² − b² | 2abi
i³ = ___ = −i | i | −1
i⁴ = ___ = 1 | −1 | i`, erzeuge: komplexRechnen },
  "mathe.os.komplex.division": `Beim Dividieren erweitert man mit ___ = der konjugiert komplexen Zahl des Nenners | i | dem Zähler
1/i = ___ = −i | i | 1
(2 + 2i)/2 = ___ = 1 + i | 2 + i | 1 + 2i
(1 + i)/(1 − i) = ___ = i | 1 | −i
5/(1 + 2i) = ___ = 1 − 2i | 5 − 10i | 1 + 2i
10/(3 + i) = ___ = 3 − i | 3 + i | 10/3 + 10i
(4 + 2i)/(1 + i) = ___ = 3 − i | 4 + 2i | 2 + 2i
Nach dem Erweitern ist der Nenner ___ = reell | imaginär | null
(3 + 4i) · (3 − 4i) = ___ = 25 | 9 − 16i | −7
2i/i = ___ = 2 | 2i | −2
(6 + 3i)/3 = ___ = 2 + i | 6 + i | 2 + 3i
(a + bi)/(c + di) mit c + di ≠ 0 ist immer ___ = eine komplexe Zahl | reell | rein imaginär`,
  "mathe.os.komplex.gleichungen": { text: `√(−9) = ___ = 3i | −3 | nicht definiert in ℂ
x² = −16. L = ___ = {−4i; 4i} | {−4; 4} | { }
Hat in ℂ jede quadratische Gleichung eine Lösung? = ja | nein
Komplexe Lösungen einer reellen quadratischen Gleichung sind immer ___ = konjugiert komplex | gleich | reell`, erzeuge: komplexGleichung },
  "mathe.os.komplex.polarform": `In der Gauß’schen Zahlenebene liegt der Realteil auf ___ = der waagrechten Achse | der senkrechten Achse | dem Kreis
Der Betrag von 3 + 4i ist ___ = 5 | 7 | 25
Der Betrag von −5i ist ___ = 5 | −5 | 25
Das Argument von i ist ___ = 90° | 0° | 180°
Das Argument von −1 ist ___ = 180° | 90° | 0°
Polarform: z = ___ = r · (cos(φ) + i · sin(φ)) | r + φi | r · φ
Beim Multiplizieren in Polarform werden die Beträge ___ = multipliziert | addiert | dividiert
Beim Multiplizieren in Polarform werden die Argumente ___ = addiert | multipliziert | subtrahiert
1 + i hat das Argument ___ = 45° | 90° | 1°
1 + i hat den Betrag ___ = √2 | 2 | 1
Multiplizieren mit i dreht die Zahl um ___ = 90° | 180° | 45°
z = 2 · (cos(0°) + i · sin(0°)) = ___ = 2 | 2i | 0`,
  "mathe.os.kurven.kreis": `Kreisgleichung mit Mittelpunkt M(m₁ ∣ m₂) und Radius r: ___ = (x − m₁)² + (y − m₂)² ＝ r² | x² + y² ＝ r | (x + m₁)² + (y + m₂)² ＝ r²
x² + y² = 25: Radius ___ = 5 | 25 | 12,5
(x − 2)² + (y + 1)² = 9: Mittelpunkt ___ = (2 ∣ −1) | (−2 ∣ 1) | (2 ∣ 1)
(x − 2)² + (y + 1)² = 9: Radius ___ = 3 | 9 | 81
Liegt P(3 ∣ 4) auf x² + y² = 25? = ja | nein
Liegt P(1 ∣ 1) innerhalb von x² + y² = 25? = ja | nein
Kugelgleichung mit Mittelpunkt (0 ∣ 0 ∣ 0) und Radius r: ___ = x² + y² + z² ＝ r² | x² + y² ＝ r² | x + y + z ＝ r
x² + y² + z² = 16: Radius ___ = 4 | 16 | 8
Kreis mit M(0 ∣ 3) und r = 2: ___ = x² + (y − 3)² ＝ 4 | x² + (y + 3)² ＝ 4 | x² + y² ＝ 2
x² − 4x + y² = 0 hat den Mittelpunkt ___ = (2 ∣ 0) | (−2 ∣ 0) | (4 ∣ 0)
x² − 4x + y² = 0 hat den Radius ___ = 2 | 4 | 0
Ein Kreis ist die Menge aller Punkte mit ___ = gleichem Abstand von M | gleichem x-Wert | gleicher Steigung`,
  "mathe.os.kurven.kreis-gerade": `Eine Gerade kann einen Kreis in höchstens ___ Punkten schneiden. = 2 | 1 | 3
Eine Tangente berührt den Kreis in ___ = genau einem Punkt | zwei Punkten | keinem Punkt
Eine Passante hat mit dem Kreis ___ = keinen Punkt gemeinsam | einen Punkt | zwei Punkte
Eine Sekante hat mit dem Kreis ___ = zwei Punkte gemeinsam | einen Punkt | keinen
Die Tangente im Punkt P steht normal auf ___ = dem Radius MP | der x-Achse | der Sekante
Kreis x² + y² = 25 und Gerade y = 5: ___ = Tangente | Sekante | Passante
Kreis x² + y² = 25 und Gerade y = 0: ___ = Sekante | Tangente | Passante
Kreis x² + y² = 25 und Gerade y = 7: ___ = Passante | Tangente | Sekante
Kreis x² + y² = 25, Gerade y = 0: Schnittpunkte ___ = (−5 ∣ 0) und (5 ∣ 0) | (0 ∣ 5) und (0 ∣ −5) | (5 ∣ 5)
Tangente an x² + y² = 25 in P(3 ∣ 4): ___ = 3x + 4y ＝ 25 | 4x + 3y ＝ 25 | 3x + 4y ＝ 5
Schnittpunkte berechnet man durch ___ = Einsetzen der Geraden in die Kreisgleichung | Addieren | Ableiten
Die Diskriminante der quadratischen Gleichung sagt, ob die Gerade ___ = schneidet, berührt oder vorbeigeht | parallel ist | steigt`,
  "mathe.os.kurven.kegelschnitte": `x²/a² + y²/b² = 1 ist eine ___ = Ellipse | Hyperbel | Parabel
x²/a² − y²/b² = 1 ist eine ___ = Hyperbel | Ellipse | Kreis
y² = 2px ist eine ___ = Parabel | Ellipse | Hyperbel
Ist bei der Ellipse a = b, entsteht ___ = ein Kreis | eine Parabel | eine Gerade
x²/25 + y²/9 = 1: Hauptachse a = ___ = 5 | 25 | 3
x²/25 + y²/9 = 1: Nebenachse b = ___ = 3 | 9 | 5
Eine Ellipse: die Summe der Abstände zu den Brennpunkten ist ___ = konstant | null | unendlich
Eine Hyperbel hat ___ = zwei Äste und Asymptoten | einen geschlossenen Rand | keinen Brennpunkt
Kegelschnitte entstehen beim Schneiden ___ = eines Kegels mit einer Ebene | zweier Kreise | einer Kugel mit einer Geraden
Planetenbahnen sind ___ = Ellipsen | Hyperbeln | Geraden
Ein Parabolspiegel bündelt Strahlen im ___ = Brennpunkt | Scheitel | Mittelpunkt
Ellipse mit a = 5, b = 3: lineare Exzentrizität e = ___ = 4 | 2 | 8`,
  "mathe.os.kurven.parameter": `Eine Kurve in Parameterdarstellung: ___ = X(t) ＝ (x(t) ∣ y(t)) | y ＝ kx + d | x² + y² ＝ r²
X(t) = (cos(t) ∣ sin(t)), 0 ≤ t < 2π, ist ___ = der Einheitskreis | eine Gerade | eine Parabel
X(t) = (t ∣ t²) ist ___ = eine Parabel | ein Kreis | eine Gerade
X(t) = (1 + 2t ∣ 3 − t) ist ___ = eine Gerade | ein Kreis | eine Ellipse
X(t) = (3cos(t) ∣ 3sin(t)) ist ein Kreis mit Radius ___ = 3 | 1 | 9
X(t) = (t ∣ t²): Punkt für t = 2 ___ = (2 ∣ 4) | (4 ∣ 2) | (2 ∣ 2)
X(t) = (cos(t) ∣ sin(t)): Punkt für t = 0 ___ = (1 ∣ 0) | (0 ∣ 1) | (0 ∣ 0)
X(t) = (cos(t) ∣ sin(t)): Punkt für t = π/2 ___ = (0 ∣ 1) | (1 ∣ 0) | (−1 ∣ 0)
Der Parameter t wird oft gedeutet als ___ = Zeit | Höhe | Steigung
Der Tangentenvektor ist ___ = die Ableitung X′(t) | X(0) | der Betrag von X
X(t) = (2cos(t) ∣ sin(t)) ist ___ = eine Ellipse | ein Kreis | eine Hyperbel
Bewegung auf X(t): die Geschwindigkeit ist ___ = der Betrag von X′(t) | X(t) | t`,
};
