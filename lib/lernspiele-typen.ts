/**
 * Lernspiele in der Schüler-App: die Typen, die Server und Spiel (components/lernen/Lernspiel.tsx) teilen.
 * Ohne Datenbank und ohne Dateien, damit der Browser sie laden darf. Wie ein Spiel entsteht und was es für den
 * Lernstand bedeutet, steht in lib/lernspiele.ts und docs/lernspiele.md.
 */

/**
 * Die Deutsch-Spiele. Zuerst Artikel, Präpositionen und Deklination (niko 2026-11-11: „oft ein Problem“), dann
 * die übrigen („mach alle Deutsch-Spiele zuerst“): die vier Fälle, das/dass, Hauptsatz/Gliedsatz, Perfekt und
 * Präteritum. Sie teilen eine Mechanik: eine Karte in die richtige Kiste.
 *
 * Dazu „Vokabel-Paare“ für Englisch (niko: „das Englischspiel, das Vokabelspiel“) mit eigener Mechanik: englische
 * und deutsche Wörter stehen sich gegenüber, je zwei gehören zusammen (`form: "paar"`). Und „Satzbau“ für Deutsch:
 * die Teile eines Satzes in die richtige Reihenfolge bringen (`form: "reihe"`).
 *
 * Englisch mit Kisten (niko: „die Irregular Verbs, Zeiten in Englisch“): „Irregular Verbs“, „English Tenses“ und
 * „English Grammar“. Die letzten zwei spielen je Runde ein Thema (lib/lernspiele-englisch.ts).
 *
 * Mathe (niko: „für Mathe, was Spaß machen könnte“): „Kopfrechnen“, auch mit Kisten und je Runde ein Thema, vom
 * Einmaleins bis zu Brüchen, Prozent und Gleichungen (lib/lernspiele-mathe.ts). Und „Zahlenstrahl“ mit eigener
 * Mechanik: eine Zahl an die richtige Stelle schieben (`form: "strahl"`, lib/lernspiele-strahl.ts).
 */
export const SPIEL_ARTEN = ["artikel", "praepositionen", "deklination", "faelle", "dasdass", "satzteile", "perfekt", "praeteritum", "satzbau", "vokabeln", "irregular", "zeiten", "grammatik", "rechnen", "strahl"] as const;
export type SpielArt = (typeof SPIEL_ARTEN)[number];

export const istSpielArt = (x: unknown): x is SpielArt => typeof x === "string" && (SPIEL_ARTEN as readonly string[]).includes(x);

export const SPIEL_TITEL: Record<SpielArt, string> = {
  artikel: "der, die, das",
  praepositionen: "Präposition und Fall",
  deklination: "Adjektiv-Endungen",
  faelle: "Die vier Fälle",
  dasdass: "das oder dass",
  satzteile: "Hauptsatz oder Gliedsatz",
  perfekt: "Perfekt: haben oder sein",
  praeteritum: "Präteritum",
  satzbau: "Satzbau",
  vokabeln: "Vokabel-Paare",
  irregular: "Irregular Verbs",
  zeiten: "English Tenses",
  grammatik: "English Grammar",
  rechnen: "Kopfrechnen",
  strahl: "Zahlenstrahl",
};

/** Zu welchem Fach ein Spiel gehört (Abschnitte im Tab „Spiele“). */
export const SPIEL_FACH: Record<SpielArt, "Deutsch" | "Englisch" | "Mathematik"> = {
  artikel: "Deutsch",
  praepositionen: "Deutsch",
  deklination: "Deutsch",
  faelle: "Deutsch",
  dasdass: "Deutsch",
  satzteile: "Deutsch",
  perfekt: "Deutsch",
  praeteritum: "Deutsch",
  satzbau: "Deutsch",
  vokabeln: "Englisch",
  irregular: "Englisch",
  zeiten: "Englisch",
  grammatik: "Englisch",
  rechnen: "Mathematik",
  strahl: "Mathematik",
};

/** Eine kurze Zeile für die Kachel im Tab „Spiele“: worum es geht, in Wörtern aus dem Spiel. */
export const SPIEL_KURZ: Record<SpielArt, string> = {
  artikel: "Jedes Nomen zu seinem Artikel",
  praepositionen: "mit dem, für den: der richtige Fall",
  deklination: "großer, große, großes: die Endung",
  faelle: "Wer? Wessen? Wem? Wen?",
  dasdass: "Ein s oder zwei?",
  satzteile: "Welcher Teil kann allein stehen?",
  perfekt: "ist gegangen oder hat gegangen?",
  praeteritum: "ging, gehte oder geht?",
  satzbau: "Wo steht das Verb?",
  vokabeln: "Englisch und Deutsch: was gehört zusammen?",
  irregular: "go, went, gone",
  zeiten: "plays, is playing oder played?",
  grammatik: "some oder any? much oder many?",
  rechnen: "Schnell im Kopf: welches Ergebnis stimmt?",
  strahl: "Wo liegt die Zahl? Schieb den Zeiger an die richtige Stelle.",
};

/** Zwei, drei Wörter, die für das Spiel stehen: blass im Hintergrund der Bühne und als Kärtchen auf der Kachel. */
export const SPIEL_DEKO: Record<SpielArt, string[]> = {
  artikel: ["die", "das", "der"],
  praepositionen: ["dem", "den", "der"],
  deklination: ["-en", "-es", "-em"],
  faelle: ["Wem?", "Wen?", "Wer?"],
  dasdass: ["das", "dass", "welches"],
  satzteile: ["weil", "dass", "wenn"],
  perfekt: ["hat", "ist", "sind"],
  praeteritum: ["ging", "kam", "sah"],
  satzbau: ["gehen", "wir", "heute"],
  vokabeln: ["dog", "house", "school"],
  irregular: ["went", "gone", "saw"],
  zeiten: ["plays", "played", "will"],
  grammatik: ["some", "any", "much"],
  rechnen: ["7 · 8", "56", "+"],
  strahl: ["0", "0,5", "1"],
};

/** Ein Satz unter dem Titel: was man in dem Spiel tut. */
export const SPIEL_AUFGABE: Record<SpielArt, string> = {
  artikel: "Wirf jedes Wort in die Kiste mit seinem Artikel.",
  praepositionen: "Welcher Artikel passt nach der Präposition?",
  deklination: "Welche Endung braucht das Adjektiv?",
  faelle: "In welchem Fall steht der markierte Teil?",
  dasdass: "das oder dass?",
  satzteile: "Ist der markierte Teil Hauptsatz oder Gliedsatz?",
  perfekt: "haben oder sein?",
  praeteritum: "Welche Form passt im Präteritum?",
  satzbau: "Bring die Teile in die richtige Reihenfolge.",
  vokabeln: "Welche zwei Wörter gehören zusammen?",
  irregular: "Welche Form passt in die Lücke?",
  zeiten: "Welche Form passt in die Lücke?",
  grammatik: "Was passt in die Lücke?",
  rechnen: "Welches Ergebnis stimmt?",
  strahl: "Wo liegt die Zahl am Zahlenstrahl?",
};

/** So spielt sich ein Spiel: Karten in Kisten (ohne Angabe), Paare finden, Teile in eine Reihe bringen oder eine Zahl am Zahlenstrahl treffen. */
export type SpielForm = "paar" | "reihe" | "strahl";
export const SPIEL_FORM: Partial<Record<SpielArt, SpielForm>> = { vokabeln: "paar", satzbau: "reihe", strahl: "strahl" };

/** Trennt die Teile in der Antwort einer Reihe („gehen | wir | ins Kino“). */
export const REIHE_TRENNER = " | ";

/**
 * Eine Karte des Spiels. `vor` und `nach` stehen um die Lücke (bei „der, die, das“ ist `wort` die Karte, ohne
 * Satz). `faecher` sind die Fächer unten in fester Reihenfolge, damit die Hand sich die Plätze merkt.
 *
 * Bei Paaren (`form: "paar"`) ist `wort` das englische Wort und `richtig` das deutsche; `faecher` ist leer, die
 * Auswahl sind die deutschen Wörter der anderen Karten auf dem Brett.
 *
 * Bei einer Reihe (`form: "reihe"`) ist `vor` der feste Anfang des Satzes, `nach` das Satzzeichen am Ende, `faecher`
 * sind die Teile in gemischter Reihenfolge und `richtig` die Teile in der richtigen, mit `REIHE_TRENNER` verbunden.
 *
 * Am Zahlenstrahl (`form: "strahl"`) ist `wort` die gesuchte Zahl, `strahl` der Zahlenstrahl und `richtig` die Nummer
 * des Teilstrichs (ab 0), an dem sie liegt; `faecher` ist leer, die Wahl ist die Nummer des getroffenen Teilstrichs.
 */
export type SpielKarte = {
  key: string;
  form?: SpielForm;
  /** Die Fähigkeit dieser Karte, wenn sie nicht am Spiel hängt (Vokabeln: das Thema oder die eigenen Listen) */
  skill?: string;
  /** Nur bei „der, die, das“: das Nomen */
  wort?: string;
  /** Bei zwei Bedeutungen: die gemeinte („Nadelbaum“) */
  bedeutung?: string;
  vor: string;
  nach: string;
  /** Statt einer Lücke: der markierte Teil des Satzes zwischen `vor` und `nach` („meinen Bruder“) */
  mitte?: string;
  /** Was in der Lücke steht, wenn die Antwort stimmt und die Kiste anders heißt („sind“ in der Kiste „sein“) */
  einsatz?: string;
  /** Kleine Zeile unter dem Satz, z. B. die Grundform „(fahren)“ */
  hinweis?: string;
  /** Was oben aus der Kiste schaut, wenn die Karte drin liegt */
  kurz?: string;
  faecher: string[];
  richtig: string;
  /** Der ganze richtige Satz oder „die Haustür“ */
  loesung: string;
  /** Kurze Regel, die nach einem Fehler erscheint; nur, was für diese Karte sicher stimmt */
  regel: string;
  /** Ein Wort zur richtigen Antwort, z. B. „Dativ“ */
  marke?: string;
  /** Mathe: Text, Kisten und Regel werden gesetzt wie in den Übungen (Bruchstrich, Hochzahl, Wurzel) */
  mathe?: true;
  /** Nur am Zahlenstrahl: die Zahl an jedem Teilstrich, welche davon dastehen, und ob die Gerade auch nach links weitergeht */
  strahl?: { werte: string[]; beschriftet: number[]; beide?: true };
  /** Nur am Zahlenstrahl: ein Satz zu einer typischen falschen Stelle („Vorzeichen verwechselt“), nach der Nummer des Teilstrichs */
  tipps?: Record<string, string>;
};

/**
 * Ein Thema eines Themenspiels („English Tenses“, „Kopfrechnen“): die Fähigkeit, ein kurzer Name für den Schüler und
 * die Schulstufen, in denen es dran ist (`bis` fehlt: bis zum Schluss).
 */
export type SpielThema = { skill: string; name: string; ab: number; bis?: number; /** andere Fähigkeiten im Stoff, die zu diesem Thema führen */ auch?: string[] };

/** Fester Zufall: dieselben Karten nach jedem Neustart, damit Fehler aus früheren Runden wiederkommen können. */
export function festerZufall(seed: number): () => number {
  let x = seed % 2147483647 || 1;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
/** Eine feste Zahl aus einem Text (für die Plätze der Kisten und den festen Zufall). */
export function zahlAus(text: string): number {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 2147483647;
  return h;
}

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
      /** Wochenliga (lib/liga.ts): Punkte dieser Runde oder warum sie nicht zählt; fehlt ohne Liga */
      liga?: { punkte: number; grund?: string };
    }
  | { fehler: string };

/** Sterne einer Runde nach dem Anteil, der beim ersten Versuch richtig war. */
export const sterneFuer = (richtig: number, karten: number): 1 | 2 | 3 => {
  const anteil = karten ? richtig / karten : 0;
  return anteil >= 0.9 ? 3 : anteil >= 0.7 ? 2 : 1;
};

// ---------- Paare: Bretter (auch im Browser gebraucht, components/lernen/PaarFeld.tsx) ----------

/** So viele Paare stehen höchstens auf einem Brett (sechs Zeilen passen auf jedes Handy). */
export const PAARE_JE_BRETT = 6;

function mischen<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** Die deutschen Wörter eines Bretts in anderer Reihenfolge als die englischen. */
export const gemischt = mischen;

/** Teilt die Karten einer Runde auf Bretter mit höchstens sechs Paaren auf, möglichst gleich groß (12 → 6 + 6, 8 → 4 + 4). */
export function bretter<T>(karten: T[], jeBrett = PAARE_JE_BRETT): T[][] {
  if (!karten.length) return [];
  const zahl = Math.ceil(karten.length / jeBrett);
  const out: T[][] = [];
  let von = 0;
  for (let i = 0; i < zahl; i++) {
    const groesse = Math.ceil((karten.length - von) / (zahl - i));
    out.push(karten.slice(von, von + groesse));
    von += groesse;
  }
  return out;
}

/**
 * Das Brett zum Schluss mit den Wörtern, die in der Runde zuerst falsch waren: sie stehen noch einmal da, aufgefüllt
 * mit richtigen auf mindestens vier Paare, damit das letzte Paar nicht von selbst feststeht. Leer ohne Fehler.
 */
export function nochmalBrett<T extends { key: string }>(karten: T[], falsch: Set<string>, rng: () => number = Math.random): T[] {
  const schwer = karten.filter((k) => falsch.has(k.key)).slice(0, PAARE_JE_BRETT);
  if (!schwer.length) return [];
  const fuell = mischen(
    karten.filter((k) => !falsch.has(k.key)),
    rng,
  ).slice(0, Math.max(0, Math.min(4, karten.length) - schwer.length));
  return mischen([...schwer, ...fuell], rng);
}
