/**
 * Lernspiele in der Schüler-App: die Typen, die Server und Spiel (components/lernen/Lernspiel.tsx) teilen.
 * Ohne Datenbank und ohne Dateien, damit der Browser sie laden darf. Wie ein Spiel entsteht und was es für den
 * Lernstand bedeutet, steht in lib/lernspiele.ts und docs/lernspiele.md.
 */

/** Die drei Deutsch-Spiele (niko 2026-11-11: Artikel, Präpositionen und Deklination sind oft ein Problem). */
export const SPIEL_ARTEN = ["artikel", "praepositionen", "deklination"] as const;
export type SpielArt = (typeof SPIEL_ARTEN)[number];

export const istSpielArt = (x: unknown): x is SpielArt => typeof x === "string" && (SPIEL_ARTEN as readonly string[]).includes(x);

export const SPIEL_TITEL: Record<SpielArt, string> = {
  artikel: "der, die, das",
  praepositionen: "Präposition und Fall",
  deklination: "Adjektiv-Endungen",
};

/** Ein Satz unter dem Titel: was man in dem Spiel tut. */
export const SPIEL_AUFGABE: Record<SpielArt, string> = {
  artikel: "Wirf jedes Wort in das Fach mit seinem Artikel.",
  praepositionen: "Welcher Artikel passt nach der Präposition?",
  deklination: "Welche Endung braucht das Adjektiv?",
};

/**
 * Eine Karte des Spiels. `vor` und `nach` stehen um die Lücke (bei „der, die, das“ ist `wort` die Karte, ohne
 * Satz). `faecher` sind die Fächer unten in fester Reihenfolge, damit die Hand sich die Plätze merkt.
 */
export type SpielKarte = {
  key: string;
  /** Nur bei „der, die, das“: das Nomen */
  wort?: string;
  /** Bei zwei Bedeutungen: die gemeinte („Nadelbaum“) */
  bedeutung?: string;
  vor: string;
  nach: string;
  faecher: string[];
  richtig: string;
  /** Der ganze richtige Satz oder „die Haustür“ */
  loesung: string;
  /** Kurze Regel, die nach einem Fehler erscheint; nur, was für diese Karte sicher stimmt */
  regel: string;
  /** Ein Wort zur richtigen Antwort, z. B. „Dativ“ */
  marke?: string;
};

/** Was der Schüler je Karte zuerst gewählt hat; der Server prüft es gegen die gespeicherten Karten. */
export type SpielAntwort = { key: string; wahl: string };

/** Warum das Spiel gerade dran ist, in Worten für den Schüler. */
export type SpielVorschlag = { art: SpielArt; grund: string; quelle: "pruefung" | "stoff" | "einheit" | "lernstand" | "fach" };

export type SpielStart = { rundeId: number; karten: SpielKarte[] } | { fehler: string };

export type SpielErgebnis =
  | {
      richtig: number;
      karten: number;
      sterne: 1 | 2 | 3;
      /** Tage am Stück mit mindestens einer Runde, heute mitgezählt */
      serie: number;
      lernstandVorher: number | null;
      lernstandNachher: number | null;
      /** die Karten, die beim ersten Versuch falsch waren (kommen in der nächsten Runde wieder) */
      nochmal: { loesung: string }[];
    }
  | { fehler: string };

/** Sterne einer Runde nach dem Anteil, der beim ersten Versuch richtig war. */
export const sterneFuer = (richtig: number, karten: number): 1 | 2 | 3 => {
  const anteil = karten ? richtig / karten : 0;
  return anteil >= 0.9 ? 3 : anteil >= 0.7 ? 2 : 1;
};
