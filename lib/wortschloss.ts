/**
 * Wortschloss (niko 2026-11-16 „mach weitere spiele“): ein Wort-Rätsel zum Stoff. Oben steht ein Hinweis („trinken ·
 * Präteritum“, „der Schmetterling · Englisch“), darunter ein Schloss mit so vielen Feldern, wie das Wort Buchstaben hat.
 * Getippt wird auf einer Buchstaben-Tastatur; ist eine Reihe voll, zählt sie sofort (kein Knopf, niko: „dieses Prüfen
 * ist zu anstrengend“). Jedes Feld bekommt eine Farbe: grün sitzt, gold kommt im Wort an einer anderen Stelle vor, grau
 * kommt nicht (mehr) vor. Sechs Reihen je Wort. Ein Wort in der ersten Reihe ist „gewusst“ (zählt für den Lernstand),
 * später gelöst bringt weniger Punkte, nicht gelöst kostet ein Herz.
 *
 * Hier steht nur Reines (auch der Browser lädt es, components/lernen/WortSchloss.tsx); die Wörter kommen aus
 * lib/wortschloss-themen.ts, Runden und Punkte aus lib/lernspiele.ts wie bei Glasklar.
 */

/** So viele Reihen hat ein Wort. */
export const WORT_VERSUCHE = 6;
/** So viele Herzen hat ein Spiel; eine fehlerfreie Stufe bringt eines zurück. */
export const WORT_HERZEN = 3;
/** So viele Wörter hat eine Stufe (eine Runde am Server). */
export const WOERTER_JE_STUFE = 4;
/** So lang darf ein Wort sein (so viele Felder passen auf ein schmales Handy). */
export const WORT_MIN = 3;
export const WORT_MAX = 10;

/** Punkte je gelöstem Wort nach der Reihe (1. bis 6.), mal die Stufe; dazu je Stufe ein Bonus. */
export const WORT_PUNKTE = { reihe: [100, 60, 40, 25, 15, 10], stufe: 50, fehlerfrei: 100 } as const;
export const WORT_PUNKTE_MAX = 3_000_000;
export const gueltigeWortPunkte = (p: unknown) => (typeof p === "number" && Number.isFinite(p) ? Math.min(WORT_PUNKTE_MAX, Math.max(0, Math.round(p))) : 0);

/** Die Punkte für ein Wort, gelöst in Reihe `reihe` (ab 1) auf Stufe `stufe` (ab 1). */
export const wortPunkte = (reihe: number, stufe: number) => (WORT_PUNKTE.reihe[reihe - 1] ?? 0) * Math.max(1, stufe);

/** Wie lang die Wörter einer Stufe höchstens sind: zuerst kurze, ab Stufe 3 alle. */
export const laengeFuer = (stufe: number) => (stufe <= 1 ? 6 : stufe === 2 ? 8 : WORT_MAX);

const BUCHSTABEN = /^[a-zäöüß]+$/;
/** Ein Wort für das Schloss: klein, ohne Leerzeichen; null, wenn es sich nicht tippen lässt. */
export function schlossWort(text: string): string | null {
  const w = text.trim().toLowerCase();
  return BUCHSTABEN.test(w) && w.length >= WORT_MIN && w.length <= WORT_MAX ? w : null;
}

/** Ein Buchstabe groß, wie er in einem Feld steht (ß bleibt ß; CSS-Großschrift würde „SS“ daraus machen). */
export const gross = (b: string) => (b === "ß" ? "ß" : b.toUpperCase());

export type Farbe = "ja" | "fast" | "nein";

/**
 * Die Farben einer Reihe: zuerst alle Treffer an der richtigen Stelle, dann „fast“ nur so oft, wie der Buchstabe im Wort
 * noch übrig ist (zwei „e“ getippt, eines im Wort: nur eines leuchtet gold).
 */
export function bewerte(versuch: string, ziel: string): Farbe[] {
  const v = [...versuch.toLowerCase()];
  const z = [...ziel.toLowerCase()];
  const out: Farbe[] = v.map(() => "nein");
  const rest = new Map<string, number>();
  v.forEach((b, i) => {
    if (z[i] === b) out[i] = "ja";
    else if (z[i] !== undefined) rest.set(z[i], (rest.get(z[i]) ?? 0) + 1);
  });
  v.forEach((b, i) => {
    if (out[i] === "ja") return;
    const n = rest.get(b) ?? 0;
    if (n > 0) {
      out[i] = "fast";
      rest.set(b, n - 1);
    }
  });
  return out;
}

/** Die Farbe jeder Taste nach den bisherigen Reihen: grün schlägt gold, gold schlägt grau. */
export function tastenFarben(reihen: string[], ziel: string): Map<string, Farbe> {
  const rang: Record<Farbe, number> = { nein: 0, fast: 1, ja: 2 };
  const m = new Map<string, Farbe>();
  for (const r of reihen) {
    const f = bewerte(r, ziel);
    [...r.toLowerCase()].forEach((b, i) => {
      const alt = m.get(b);
      if (!alt || rang[f[i]] > rang[alt]) m.set(b, f[i]);
    });
  }
  return m;
}

/** Die Tastatur (QWERTZ wie in Österreich); Umlaute und ß nur, wenn ein Wort der Stufe sie braucht. */
export function tastatur(woerter: string[]): string[][] {
  const umlaute = woerter.some((w) => /[äöüß]/.test(w.toLowerCase()));
  return umlaute ? [[..."qwertzuiopü"], [..."asdfghjklöä"], [..."yxcvbnmß"]] : [[..."qwertzuiop"], [..."asdfghjkl"], [..."yxcvbnm"]];
}

/** Was für die Wertung zählt: die erste Reihe (stimmt sie, genau die richtige Antwort der Karte). */
export const ersteWahl = (ersteReihe: string, richtig: string) => (ersteReihe.toLowerCase() === richtig.toLowerCase() ? richtig : ersteReihe);
