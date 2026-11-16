/**
 * Blockwerk (niko 2026-11-16: „neue spielidee … kennst du das spiel block blast … ich möchte es genau so haben aber
 * als lernspiel“): ein Legespiel auf einem Brett mit 8 × 8 Feldern. Drei Teile liegen bereit, jedes wird auf das Brett
 * gezogen; ist eine Reihe oder Spalte voll, verschwindet sie. Neue Teile gibt es für eine Frage aus dem Stoff
 * (components/lernen/BlockFeld.tsx, docs/lernspiele.md „Blockwerk“). Hier steht nur die Spiellogik, ohne React,
 * damit sie sich prüfen lässt (lib/blockwerk.test.ts).
 *
 * Das Brett ist eine Liste mit 64 Feldern, Zeile für Zeile: null = frei, sonst die Farbe (0 bis 4).
 */

export const SEITE = 8;
export const FELDER = SEITE * SEITE;
export const FARBEN = 5;
/** So viele Blitze hat man höchstens (ein Blitz räumt 3 × 3 Felder frei). */
export const BLITZE_MAX = 3;
/** Mit so vielen Blitzen beginnt ein Spiel: man sieht gleich, wofür sie gut sind. */
export const BLITZE_START = 1;

export type Brett = (number | null)[];
/** Ein Teil: die Felder als [Zeile, Spalte] ab der linken oberen Ecke, dazu Breite, Höhe und Farbe. */
export type Teil = { id: number; form: string; zellen: [number, number][]; breite: number; hoehe: number; farbe: number };

/** Formen als Zeilen („#“ = Feld). Gewicht: wie oft sie kommen (große Quadrate und lange Balken seltener). */
const FORMEN: { name: string; zeilen: string[]; gewicht: number }[] = [
  { name: "1", zeilen: ["#"], gewicht: 3 },
  { name: "2-", zeilen: ["##"], gewicht: 4 },
  { name: "2|", zeilen: ["#", "#"], gewicht: 4 },
  { name: "3-", zeilen: ["###"], gewicht: 4 },
  { name: "3|", zeilen: ["#", "#", "#"], gewicht: 4 },
  { name: "4-", zeilen: ["####"], gewicht: 3 },
  { name: "4|", zeilen: ["#", "#", "#", "#"], gewicht: 3 },
  { name: "5-", zeilen: ["#####"], gewicht: 2 },
  { name: "5|", zeilen: ["#", "#", "#", "#", "#"], gewicht: 2 },
  { name: "Q2", zeilen: ["##", "##"], gewicht: 5 },
  { name: "Q3", zeilen: ["###", "###", "###"], gewicht: 1.5 },
  { name: "R23", zeilen: ["###", "###"], gewicht: 2 },
  { name: "R32", zeilen: ["##", "##", "##"], gewicht: 2 },
  { name: "E1", zeilen: ["#.", "##"], gewicht: 2 },
  { name: "E2", zeilen: [".#", "##"], gewicht: 2 },
  { name: "E3", zeilen: ["##", "#."], gewicht: 2 },
  { name: "E4", zeilen: ["##", ".#"], gewicht: 2 },
  { name: "L1", zeilen: ["#.", "#.", "##"], gewicht: 1.5 },
  { name: "L2", zeilen: [".#", ".#", "##"], gewicht: 1.5 },
  { name: "L3", zeilen: ["##", "#.", "#."], gewicht: 1.5 },
  { name: "L4", zeilen: ["##", ".#", ".#"], gewicht: 1.5 },
  { name: "L5", zeilen: ["###", "#.."], gewicht: 1.5 },
  { name: "L6", zeilen: ["###", "..#"], gewicht: 1.5 },
  { name: "L7", zeilen: ["#..", "###"], gewicht: 1.5 },
  { name: "L8", zeilen: ["..#", "###"], gewicht: 1.5 },
  { name: "T1", zeilen: ["###", ".#."], gewicht: 1.5 },
  { name: "T2", zeilen: [".#.", "###"], gewicht: 1.5 },
  { name: "T3", zeilen: ["#.", "##", "#."], gewicht: 1.5 },
  { name: "T4", zeilen: [".#", "##", ".#"], gewicht: 1.5 },
  { name: "S1", zeilen: [".##", "##."], gewicht: 1.2 },
  { name: "S2", zeilen: ["##.", ".##"], gewicht: 1.2 },
  { name: "S3", zeilen: ["#.", "##", ".#"], gewicht: 1.2 },
  { name: "S4", zeilen: [".#", "##", "#."], gewicht: 1.2 },
  { name: "W1", zeilen: ["###", "#..", "#.."], gewicht: 1 },
  { name: "W2", zeilen: ["###", "..#", "..#"], gewicht: 1 },
  { name: "W3", zeilen: ["#..", "#..", "###"], gewicht: 1 },
  { name: "W4", zeilen: ["..#", "..#", "###"], gewicht: 1 },
];

function ausZeilen(zeilen: string[]): [number, number][] {
  const z: [number, number][] = [];
  zeilen.forEach((reihe, r) => [...reihe].forEach((c, s) => c === "#" && z.push([r, s])));
  return z;
}

export const FORM_NAMEN = FORMEN.map((f) => f.name);

/** Ein Teil einer bestimmten Form (für Prüfungen und das Vorschaubild). */
export function teilAus(name: string, farbe = 0, id = 0): Teil {
  const f = FORMEN.find((x) => x.name === name);
  if (!f) throw new Error(`Form ${name} gibt es nicht`);
  return { id, form: f.name, zellen: ausZeilen(f.zeilen), breite: Math.max(...f.zeilen.map((r) => r.length)), hoehe: f.zeilen.length, farbe };
}

export const leeresBrett = (): Brett => Array.from({ length: FELDER }, () => null);

/** Passt das Teil mit seiner linken oberen Ecke auf Zeile r, Spalte s? */
export function passt(brett: Brett, teil: Teil, r: number, s: number): boolean {
  if (r < 0 || s < 0 || r + teil.hoehe > SEITE || s + teil.breite > SEITE) return false;
  return teil.zellen.every(([dr, ds]) => brett[(r + dr) * SEITE + s + ds] === null);
}

/** Passt das Teil irgendwo auf das Brett? */
export function passtIrgendwo(brett: Brett, teil: Teil): boolean {
  for (let r = 0; r <= SEITE - teil.hoehe; r++) for (let s = 0; s <= SEITE - teil.breite; s++) if (passt(brett, teil, r, s)) return true;
  return false;
}

export type Zug = {
  brett: Brett;
  /** volle Reihen und Spalten, die verschwunden sind */
  reihen: number[];
  spalten: number[];
  /** die Felder, die verschwunden sind, mit ihrer Farbe (für die Bewegung) */
  weg: { i: number; farbe: number }[];
};

/** Volle Reihen und Spalten eines Bretts. */
export function volle(brett: Brett): { reihen: number[]; spalten: number[] } {
  const reihen: number[] = [];
  const spalten: number[] = [];
  for (let r = 0; r < SEITE; r++) if (Array.from({ length: SEITE }, (_, s) => brett[r * SEITE + s]).every((x) => x !== null)) reihen.push(r);
  for (let s = 0; s < SEITE; s++) if (Array.from({ length: SEITE }, (_, r) => brett[r * SEITE + s]).every((x) => x !== null)) spalten.push(s);
  return { reihen, spalten };
}

/** Setzt ein Teil (es muss passen) und räumt volle Reihen und Spalten ab. */
export function setze(brett: Brett, teil: Teil, r: number, s: number): Zug {
  const neu = [...brett];
  for (const [dr, ds] of teil.zellen) neu[(r + dr) * SEITE + s + ds] = teil.farbe;
  const { reihen, spalten } = volle(neu);
  const wegSet = new Set<number>();
  for (const rr of reihen) for (let ss = 0; ss < SEITE; ss++) wegSet.add(rr * SEITE + ss);
  for (const ss of spalten) for (let rr = 0; rr < SEITE; rr++) wegSet.add(rr * SEITE + ss);
  const weg = [...wegSet].sort((a, b) => a - b).map((i) => ({ i, farbe: neu[i] as number }));
  for (const { i } of weg) neu[i] = null;
  return { brett: neu, reihen, spalten, weg };
}

/** Was abgeräumt würde, wenn das Teil hier läge (für die Vorschau beim Ziehen). */
export function wuerdeRaeumen(brett: Brett, teil: Teil, r: number, s: number): Set<number> {
  if (!passt(brett, teil, r, s)) return new Set();
  return new Set(setze(brett, teil, r, s).weg.map((w) => w.i));
}

/** Ein Blitz räumt die 3 × 3 Felder um ein Feld frei (am Rand rückt das Quadrat nach innen). */
export function blitz(brett: Brett, r: number, s: number): Zug {
  const r0 = Math.min(Math.max(r - 1, 0), SEITE - 3);
  const s0 = Math.min(Math.max(s - 1, 0), SEITE - 3);
  const neu = [...brett];
  const weg: Zug["weg"] = [];
  for (let rr = r0; rr < r0 + 3; rr++)
    for (let ss = s0; ss < s0 + 3; ss++) {
      const i = rr * SEITE + ss;
      if (neu[i] !== null) weg.push({ i, farbe: neu[i] as number });
      neu[i] = null;
    }
  return { brett: neu, reihen: [], spalten: [], weg };
}

/** Die Felder, die ein Blitz auf (r, s) treffen würde. */
export function blitzFelder(r: number, s: number): number[] {
  const r0 = Math.min(Math.max(r - 1, 0), SEITE - 3);
  const s0 = Math.min(Math.max(s - 1, 0), SEITE - 3);
  const out: number[] = [];
  for (let rr = r0; rr < r0 + 3; rr++) for (let ss = s0; ss < s0 + 3; ss++) out.push(rr * SEITE + ss);
  return out;
}

/**
 * Alle Punkte mal drei (niko 2026-11-16: „die punkte sind noch zu wenig … einfach 3 mal so viele punkte alles geben“).
 * Gespeicherte Stände von davor hat die Datenbank einmal mit drei malgenommen (lib/db.ts, `blockwerk_punkte_mal3`).
 */
export const PUNKTE_FAKTOR = 3;
/** Eine Frage beim ersten Versuch richtig (20 mal drei). */
export const FRAGE_PUNKTE = 20 * PUNKTE_FAKTOR;

/**
 * Punkte für einen Zug: jedes gelegte Feld 3, jede abgeräumte Linie 30 mal die Zahl der Linien (eine 30, zwei 120,
 * drei 270), das Ganze mal der Kombo. Ein ganz leeres Brett bringt 900 dazu.
 */
export function punkteFuer(zug: Zug, felder: number, kombo: number): number {
  const linien = zug.reihen.length + zug.spalten.length;
  const leer = linien > 0 && zug.brett.every((x) => x === null);
  return PUNKTE_FAKTOR * (felder + linien * linien * 10 * Math.max(1, kombo) + (leer ? 300 : 0));
}

/** Nach so vielen Zügen ohne abgeräumte Linie endet die Kombo. */
export const KOMBO_PAUSE = 3;

/** Die Kombo nach einem Zug: wer abräumt, steigt eine Stufe; nach drei Zügen ohne Linie beginnt sie neu. */
export function naechsteKombo(kombo: number, ohne: number, linien: number): { kombo: number; ohne: number } {
  if (linien > 0) return { kombo: kombo + 1, ohne: 0 };
  return ohne + 1 >= KOMBO_PAUSE ? { kombo: 0, ohne: 0 } : { kombo, ohne: ohne + 1 };
}

/** Wie voll das Brett ist (0 bis 1). */
export const fuellung = (brett: Brett) => brett.filter((x) => x !== null).length / FELDER;

let laufendeId = 1;

/**
 * Drei neue Teile. Ist das Brett voll, kommen eher kleine Teile. Mindestens eines passt, wenn es überhaupt eine
 * Form gibt, die passt (sonst würde man für eine richtige Antwort gleich verlieren).
 */
export function neueTeile(brett: Brett, rng: () => number = Math.random): Teil[] {
  const voll = fuellung(brett);
  const gewichte = FORMEN.map((f) => {
    const felder = ausZeilen(f.zeilen).length;
    // ab halb voll werden große Teile seltener
    return f.gewicht * (voll > 0.5 && felder >= 5 ? 0.45 : 1);
  });
  const summe = gewichte.reduce((a, b) => a + b, 0);
  const ziehe = () => {
    let x = rng() * summe;
    for (let i = 0; i < FORMEN.length; i++) {
      x -= gewichte[i];
      if (x <= 0) return FORMEN[i].name;
    }
    return FORMEN[FORMEN.length - 1].name;
  };
  const farbeVon = () => Math.floor(rng() * FARBEN) % FARBEN;
  let teile: Teil[] = [];
  for (let versuch = 0; versuch < 40; versuch++) {
    teile = [0, 1, 2].map(() => teilAus(ziehe(), farbeVon(), laufendeId++));
    if (teile.some((t) => passtIrgendwo(brett, t))) return teile;
  }
  // fast nichts passt mehr: ein kleines Teil, das passt, wenn es eines gibt
  const klein = ["1", "2-", "2|", "E1", "3-", "3|"].map((n) => teilAus(n, farbeVon(), laufendeId++)).find((t) => passtIrgendwo(brett, t));
  if (klein) teile[0] = klein;
  return teile;
}

/** Passt keines der übrigen Teile mehr? (ohne Teile: nein, dann kommen neue) */
export function steckt(brett: Brett, teile: (Teil | null)[]): boolean {
  const da = teile.filter((t): t is Teil => !!t);
  return da.length > 0 && !da.some((t) => passtIrgendwo(brett, t));
}

/** Der Punktestand, den der Server glaubt: höchstens so viel, wie ein ehrliches langes Spiel bringen kann. */
export const PUNKTE_MAX = 3_000_000;
export const gueltigePunkte = (p: unknown) => (typeof p === "number" && Number.isFinite(p) ? Math.min(PUNKTE_MAX, Math.max(0, Math.round(p))) : 0);
