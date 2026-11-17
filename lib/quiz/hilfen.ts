/**
 * Bausteine für die Erzeuger des Quiz (lib/lernspiele-quiz.ts): Zahlen wie in Österreich schreiben (Komma, Leerzeichen
 * bei Tausendern), eine Karte mit richtiger und falschen Antworten bauen, würfeln. Die falschen Antworten sind
 * typische Fehler; doppelte und solche, die gleich der richtigen sind, fallen weg.
 */
import type { EigeneKarte } from "../spielkarten-text";

export type Rng = () => number;

/** Eine ganze Zahl von `a` bis `b` (beide mit). */
export const ganz = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
/** Ein Element der Liste. */
export const eins = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

/** Rundet auf `stellen` Nachkommastellen (gegen Fließkomma-Reste wie 0,30000000004). */
export const runde = (x: number, stellen = 2) => {
  const f = 10 ** stellen;
  return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
};

/** Eine Zahl wie im Schulheft: Komma statt Punkt, ab 10 000 ein Leerzeichen bei den Tausendern, echtes Minus. */
export function zahl(x: number, stellen = 2): string {
  const r = runde(x, stellen);
  const neg = r < 0;
  const [vor, nach] = Math.abs(r).toFixed(stellen).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").split(".");
  const gruppiert = vor.length > 4 ? vor.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : vor;
  return `${neg ? "−" : ""}${gruppiert}${nach ? `,${nach}` : ""}`;
}

/** Ein Geldbetrag: „12,50 €“. */
export function euro(x: number): string {
  const r = runde(x, 2);
  const [vor, nach] = Math.abs(r).toFixed(2).split(".");
  return `${r < 0 ? "−" : ""}${vor.length > 4 ? vor.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : vor},${nach} €`;
}

/**
 * Eine Karte mit Auswahl: die richtige Antwort und bis zu `max` falsche (die ersten zuerst). Gleiche Antworten und
 * Antworten wie die richtige fallen weg; bleibt keine falsche übrig, gibt es keine Karte (leere Liste).
 */
export function wahl(frage: string, richtig: string, falsch: string[], merke = "", max = 3): EigeneKarte[] {
  const gesehen = new Set([richtig.toLowerCase()]);
  const f: string[] = [];
  for (const x of falsch) {
    const k = x.toLowerCase();
    if (!x || gesehen.has(k)) continue;
    gesehen.add(k);
    f.push(x);
    if (f.length >= max) break;
  }
  return f.length ? [{ art: "wahl", frage, richtig, falsch: f, merke }] : [];
}

/** Falsche Zahlen knapp neben der richtigen (für Ergebnisse ohne typischen Fehler). */
export function daneben(rng: Rng, r: number, schritt = 1): number[] {
  const out = [r + schritt, r - schritt, r + 2 * schritt, r - 2 * schritt, r + 10 * schritt];
  return out.sort(() => rng() - 0.5);
}

/** Größter gemeinsamer Teiler. */
export const ggt = (a: number, b: number): number => (b === 0 ? Math.abs(a) : ggt(b, a % b));

/** Ein gekürzter Bruch als Text („3/4“, ganze Zahlen ohne Nenner, Minus vorne). */
export function bruch(z: number, n: number): string {
  if (n < 0) {
    z = -z;
    n = -n;
  }
  const g = ggt(z, n) || 1;
  z /= g;
  n /= g;
  if (n === 1) return zahl(z);
  return `${z < 0 ? "−" : ""}${Math.abs(z)}/${n}`;
}

/** Ein Vorzeichen-Term: „+ 3“, „− 3“ (für „x + 3“). */
export const plusMinus = (x: number) => (x < 0 ? `− ${zahl(-x)}` : `+ ${zahl(x)}`);
/** Ein Faktor vor einer Variablen: 1 → „“, −1 → „−“, sonst die Zahl. */
export const faktor = (k: number) => (k === 1 ? "" : k === -1 ? "−" : zahl(k));
