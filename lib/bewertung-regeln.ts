/**
 * Die festen Regeln von **Aufgaben bewerten** (lib/bewertungen.ts): Sterne, Gründe zum Ankreuzen und wann eine
 * Aufgabe als gut gilt oder ausgeblendet wird. Ohne Datenbank, damit auch die Knöpfe im Browser sie benutzen können.
 */

/** Gründe zum Ankreuzen, in niko's Worten (2026-10-23): zuerst der gute, dann die Probleme. */
export const GRUENDE = {
  besonders_gut: { label: "Besonders gute Aufgabe", gut: true },
  fachlich_falsch: { label: "Fachlich falsch", gut: false },
  loesung_falsch: { label: "Musterlösung falsch", gut: false },
  zu_einfach: { label: "Zu einfach", gut: false },
  zu_schwierig: { label: "Zu schwierig", gut: false },
  unverstaendlich: { label: "Unverständlich", gut: false },
  nicht_altersgerecht: { label: "Nicht altersgerecht", gut: false },
  nicht_schulstoff: { label: "Passt nicht zum Schulstoff", gut: false },
  zu_aehnlich: { label: "Zu ähnlich", gut: false },
} as const;
export type Grund = keyof typeof GRUENDE;
export const isGrund = (x: unknown): x is Grund => typeof x === "string" && Object.hasOwn(GRUENDE, x);
/** Diese Gründe blenden eine Aufgabe sofort aus, bis sie verbessert ist (dann ist sie eine neue Aufgabe). */
export const SCHWERE_GRUENDE: readonly Grund[] = ["fachlich_falsch", "loesung_falsch"];
export const KOMMENTAR_MAX = 500;

/** Was alle Lehrer zusammen über eine Aufgabe sagen. */
export type Stand = {
  /** Durchschnitt der Sterne, 0 ohne Bewertung */
  schnitt: number;
  anzahl: number;
  /** wie oft jeder Grund angekreuzt ist */
  gruende: Partial<Record<Grund, number>>;
  /** gut bewertet: wird bei Suche und Auswahl bevorzugt und dient der KI als Vorbild */
  gut: boolean;
  /** schlecht bewertet: fehlt in Vorschlägen und automatischer Auswahl, in der Bibliothek nur mit Filter */
  ausgeblendet: boolean;
};
export const OHNE_BEWERTUNG: Stand = { schnitt: 0, anzahl: 0, gruende: {}, gut: false, ausgeblendet: false };

/**
 * Ausgeblendet ist eine Aufgabe, sobald ein Lehrer „Fachlich falsch“ oder „Musterlösung falsch“ angekreuzt hat, oder
 * bei einem Schnitt von höchstens 2 Sternen. Gut ist sie ab 4 Sternen ohne einen solchen Grund.
 */
export function stand(schnitt: number, anzahl: number, gruende: Partial<Record<Grund, number>>): Stand {
  if (!anzahl) return OHNE_BEWERTUNG;
  const schwer = SCHWERE_GRUENDE.some((g) => (gruende[g] ?? 0) > 0);
  const ausgeblendet = schwer || schnitt <= 2;
  return { schnitt, anzahl, gruende, ausgeblendet, gut: !ausgeblendet && !schwer && schnitt >= 4 };
}

/** Rang für die Reihenfolge in Suche und Auswahl: ohne Bewertung in der Mitte (3 Sterne). */
export const rang = (s: Stand) => (s.anzahl ? s.schnitt : 3);

/** „4,5“: der Schnitt mit einer Nachkommastelle. */
export const schnittText = (s: Stand) => s.schnitt.toLocaleString("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Die eigene Bewertung eines Lehrers. */
export type MeineBewertung = { sterne: number; gruende: Grund[]; kommentar: string };

/** Was die Seite zu einer Aufgabe zeigt: alle zusammen, die eigene und die Kommentare der anderen. */
export type BewertungInfo = Stand & { schluessel: string; meine: MeineBewertung | null; andere: { name: string; sterne: number; kommentar: string }[] };

/** Worauf sich eine Bewertung bezieht: eine Aufgabe einer Übung (auch der Bibliothek) oder eines Lernpaket-Schritts. */
export type BewertungZiel = { art: "aufgabe"; id: number } | { art: "schritt"; id: number; index: number };
