/**
 * Eine Antwort der KI (Funktion `stoffzettel`, lib/ai/features.ts `PruefungsstoffSchema`) für einen echten
 * Stoffzettel einer 3. Klasse AHS, 1. Mathematikschularbeit (niko, 08.11.2026), von Hand nach dem Foto geschrieben,
 * ohne KI-Aufruf. Das Foto selbst liegt nicht im Repository; Schule und Namen kommen nicht vor.
 *
 * Absichtlich so, wie eine KI auch einmal antwortet: die nummerierten Überschriften („1. ZAHLEN“) und die Teile des
 * Buchs ohne eigenen Lerninhalt („Teste Dein Vorwissen“, „Übungsbuch“) stehen als „sonstiges“ da. Die App muss sie
 * selbst zum Umfang machen (lib/pruefungsstoff.ts `istUmfangZeile`), sonst stünden sie als „ohne passende Fähigkeit“.
 */
import type { PruefungsstoffGelesen } from "../ai";

type Punkt = PruefungsstoffGelesen["punkte"][number];
const p = (original: string, inhalt: string, skill_id: string | null, einheit: string): Punkt => ({
  gruppe: "sonstiges",
  original,
  inhalt,
  einheit,
  dokument: 1,
  status: "pruefung",
  grund: null,
  skill_id,
});
const Z = "1. Zahlen";
const P = "2. Potenzen";
const F = "3. Flächeninhalte";

/** Die Zeilen mit eigenem Lerninhalt und die Fähigkeit, die dazu gehört (dieselbe, die die KI hier nennt). */
export const STOFF_MATHE_3G_LERNINHALTE: [string, string][] = [
  ["Rationale Zahlen darstellen, vergleichen und ordnen (S. 12-13)", "mathe.negativ.rational"],
  ["Addieren und Subtrahieren von positiven und negativen Zahlen (S. 14-17)", "mathe.negativ.addieren"],
  ["Multiplizieren und Dividieren von positiven und negativen Zahlen (S. 18-21)", "mathe.negativ.multiplizieren"],
  ["Verbindung der vier Grundrechnungsarten (S. 22-23)", "mathe.negativ.verbinden"],
  ["Produkte als Potenzen schreiben (S. 34-35)", "mathe.potenzen.schreibweise"],
  ["Potenzen addieren und subtrahieren (S. 36-37)", "mathe.potenzen.addieren"],
  ["Potenzen multiplizieren und dividieren (S. 38-39)", "mathe.potenzen.regeln"],
  ["Produkte, Quotienten und Potenzen potenzieren (S. 40-41)", "mathe.potenzen.regeln"],
  ["Zehnerpotenzen und Gleitkommadarstellung (S. 42-43)", "mathe.potenzen.schreibweise"],
  ["Kartesisches Koordinatensystem mit 4 Quadranten (S. 56-57)", "mathe.geometrie.koordinaten"],
  ["Flächeninhalte von Vielecken durch Zerlegen oder Ergänzen berechnen (S. 58-59)", "mathe.flaechen.vielecke"],
];

/** Überschriften und Teile des Buchs ohne eigenen Lerninhalt: Umfang. */
export const STOFF_MATHE_3G_UMFANG = [
  "1. ZAHLEN",
  "Teste Dein Vorwissen (S. 10-11)",
  "Vermischte Aufgaben (S. 26-30)",
  "Sprache der Mathematik (S. 30)",
  "Teste Dein Wissen (S. 31-32)",
  "Übungsbuch (S. 5-18)",
  "2. POTENZEN",
  "Vermischte Aufgaben (S. 46-47)",
  "Sprache der Mathematik (S. 48)",
  "Teste Dein Wissen (S. 49-50)",
  "Übungsbuch (S. 19-28)",
  "3. FLÄCHENINHALTE",
  "Teste Dein Vorwissen (S. 52-55)",
  "Vermischte Aufgaben (S. 64-65 inkl. Bsp. 323)",
  "Teste Dein Wissen (S. 69)",
  "Übungsbuch (S. 29-33)",
];

const inhalt = (original: string) => original.replace(/\s*\(S\.[^)]*\)\s*$/, "");
const lern = (i: number, einheit: string) => p(STOFF_MATHE_3G_LERNINHALTE[i][0], inhalt(STOFF_MATHE_3G_LERNINHALTE[i][0]), STOFF_MATHE_3G_LERNINHALTE[i][1], einheit);
const buch = (original: string, einheit: string) => p(original, inhalt(original), null, einheit);

export const STOFF_MATHE_3G: PruefungsstoffGelesen = {
  art: "Schularbeit",
  fach: "Mathematik",
  datum: null,
  titel: "1. Mathematikschularbeit",
  dokumente: [{ nr: 1, rolle: "stoffzettel", titel: "Stoff der 1. Mathematikschularbeit" }],
  punkte: [
    buch("1. ZAHLEN", Z),
    buch("Teste Dein Vorwissen (S. 10-11)", Z),
    lern(0, Z),
    lern(1, Z),
    lern(2, Z),
    lern(3, Z),
    buch("Vermischte Aufgaben (S. 26-30)", Z),
    buch("Sprache der Mathematik (S. 30)", Z),
    buch("Teste Dein Wissen (S. 31-32)", Z),
    buch("Übungsbuch (S. 5-18)", Z),
    buch("2. POTENZEN", P),
    lern(4, P),
    lern(5, P),
    lern(6, P),
    lern(7, P),
    lern(8, P),
    buch("Vermischte Aufgaben (S. 46-47)", P),
    buch("Sprache der Mathematik (S. 48)", P),
    buch("Teste Dein Wissen (S. 49-50)", P),
    buch("Übungsbuch (S. 19-28)", P),
    buch("3. FLÄCHENINHALTE", F),
    buch("Teste Dein Vorwissen (S. 52-55)", F),
    lern(9, F),
    lern(10, F),
    buch("Vermischte Aufgaben (S. 64-65 inkl. Bsp. 323)", F),
    buch("Teste Dein Wissen (S. 69)", F),
    buch("Übungsbuch (S. 29-33)", F),
  ],
  schwierigkeiten: [],
  termin_text: null,
  unsicher: [],
};
