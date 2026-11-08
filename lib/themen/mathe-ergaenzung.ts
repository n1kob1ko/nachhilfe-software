import type { Bereich, Modul } from "./bauen";

/**
 * Maths skills added after the first modules were deployed. They stand in their own module at the end of
 * MODULE (lib/themen/index.ts), because the seed numbers the skills once in this order (skills.sort): a skill
 * put in between would shift the old ones.
 *
 * 2026-11-08 (niko, Stoffzettel 3. Klasse AHS: Zahlen, Potenzen, Flächeninhalte): two lines of a usual
 * 3. Klasse Stoffzettel had no skill of their own, so the Schularbeit lost them. The Thema names are the
 * same as in lib/themen/mathe-unterstufe.ts, so the other topics of a Schularbeit give them context.
 * Own wording, no task or text from a book.
 */
const BEREICHE: Bereich[] = [
  {
    area: "Potenzen",
    themen: [
      {
        id: "mathe.potenzen.addieren",
        name: "Gleichartige Potenzen addieren und subtrahieren",
        suchwoerter: ["Potenzen addieren und subtrahieren", "gleichartige Potenzen zusammenfassen"],
        stufen: [7, 8],
        erklaerung:
          "Nur gleichartige Potenzen (gleiche Basis und gleiche Hochzahl) lassen sich zusammenfassen: man addiert die Zahlen davor, die Potenz bleibt gleich. Beispiel: 3x^2 + 5x^2 = 8x^2, aber 3x^2 + 5x^3 bleibt so stehen.",
        fehler: [
          "Hochzahlen addiert (3x^2 + 5x^2 = 8x^4)",
          "Verschiedene Hochzahlen zusammengefasst (2x^2 + 4x^3 = 6x^5)",
          "Minus vor einem Glied übersehen (6a^3 − 2a^3 + a^3 = 9a^3 statt 5a^3)",
        ],
      },
    ],
  },
  {
    area: "Negative Zahlen",
    themen: [
      {
        id: "mathe.negativ.verbinden",
        name: "Verbindung der vier Grundrechnungsarten mit rationalen Zahlen",
        suchwoerter: ["Verbindung der vier Grundrechnungsarten", "vier Grundrechnungsarten", "verbundene Rechnungen mit Vorzeichen", "Vorrangregeln mit negativen Zahlen"],
        stufen: [7, 8],
        erklaerung:
          "Klammern zuerst, dann Punkt vor Strich, dazu die Vorzeichenregeln. Eine negative Zahl nach einem Rechenzeichen steht in Klammern. Beispiel: (−3) · 4 − 18 : (−6) = −12 − (−3) = −12 + 3 = −9.",
        fehler: [
          "Von links nach rechts gerechnet statt Punkt vor Strich (2 + 3 · (−4) = −20 statt −10)",
          "Vorzeichenregel beim Dividieren vergessen (18 : (−6) = 3 statt −3)",
          "Minus vor einer Klammer mit negativer Zahl übersehen (−12 − (−3) = −15 statt −9)",
        ],
      },
    ],
  },
];

export const MATHE_ERGAENZUNG: Modul = {
  fach: "Mathematik",
  bereiche: BEREICHE,
  voraussetzungen: [
    ["mathe.potenzen.addieren", "mathe.potenzen.schreibweise"],
    ["mathe.negativ.verbinden", "mathe.negativ.addieren"],
    ["mathe.negativ.verbinden", "mathe.negativ.multiplizieren"],
  ],
};
