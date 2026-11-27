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
 *
 * Nicht jedes Spiel wird mit Kisten beantwortet (niko 2026-11-12: „immer das gleiche ist zu langweilig“): bei
 * „Kopfrechnen“ tippt man das Ergebnis an einem Ziffernblock ein (`form: "tippen"`), bei „Irregular Verbs“ und
 * „Präteritum“ legt man die Form aus Buchstaben (`form: "legen"`). Welche Karte wie beantwortet wird, steht in
 * lib/lernspiele-antwort.ts.
 *
 * „Wortschatz“ (niko 2026-11-12: „bei den lernspielen sind es wörter die er für eine gruselgeschichte braucht“): ein
 * Themenspiel mit den Wortfeldern der Schreib-Themen (Gruselgeschichte, Märchen, Krimi …, lib/lernspiele-wortfelder.ts);
 * auf einer Kachel das treffende Wort für den Satz.
 *
 * „Dein Stoff“ (niko 2026-11-16, Bio-Test: „wie könnte ich das in blockpuzzle implementieren“): die Spielkarten, die die
 * Lehrkraft für diesen Schüler geschrieben oder aus „Stoff vorbereiten“ übernommen hat, in jedem Fach
 * (lib/spielkarten.ts). Jede Karte bringt ihre Form mit: Wischen, Kacheln oder eine Reihenfolge.
 *
 * Das Quiz je Fach (niko 2026-11-17: „spiele sind da was fehlt ist stoff“): „Mathe-Quiz“, „Deutsch-Quiz“ und
 * „Englisch-Quiz“ sind Themenspiele mit großen Fragensammlungen ohne KI, je Thema des Lehrplans eigene Karten
 * (lib/lernspiele-quiz.ts, Fragen in lib/quiz/). Gewischt oder mit Kacheln beantwortet.
 *
 * „Stilmittel“ (niko 2026-11-17: „es sollen sätze kommen und man soll auswählen was das für ein stilmittel ist“): ein
 * Satz mit angestrichener Stelle, darunter vier Namen von Stilmitteln als Kacheln, je Schulstufe die, die schon dran
 * waren (lib/stilmittel.ts, Sätze in lib/stilmittel-saetze.ts).
 *
 * Für die Volksschule (niko 2026-11-25): „Wortarten“ (ein Wort im Satz ist markiert: Nomen, Verb oder Adjektiv?,
 * lib/wortarten-spiel.ts) und „ich gehe, du gehst“ (die Personalform in die Lücke, lib/verben-beugen.ts).
 *
 * „Glasklar“ (niko 2026-11-16, ein Sortier-Puzzle): Begriffe in Gläsern sortieren, je Runde eine Stufe eines Themas
 * (lib/glasklar.ts, lib/glasklar-themen.ts). Es steht nicht in den Kacheln nach Fach, sondern als eigene Kachel unter
 * „Für dich“, und hat ein eigenes Spielfeld (components/lernen/GlasSpiel.tsx).
 */
import type { PhantomDaten } from "./phantombild";
import type { VorlageDaten } from "./phantom-vorlage";
import type { BlattDaten } from "./blaetter";
import type { EuropaDaten, LandStand, Teil } from "./europa";
import type { BioDaten } from "./biolabor";
import type { BiotestDaten } from "./biotest";
import type { OeDaten } from "./oesterreich";

export const SPIEL_ARTEN = ["artikel", "wortarten", "konjugieren", "gross", "praepositionen", "deklination", "faelle", "dasdass", "satzteile", "perfekt", "praeteritum", "satzbau", "wortschatz", "vokabeln", "irregular", "zeiten", "grammatik", "rechnen", "strahl", "stoff", "glas", "wort", "quizmathe", "quizdeutsch", "quizenglisch", "stilmittel", "fehler", "phantom", "vorlage", "blatt", "europa", "bio", "biotest", "oesterreich"] as const;
export type SpielArt = (typeof SPIEL_ARTEN)[number];

export const istSpielArt = (x: unknown): x is SpielArt => typeof x === "string" && (SPIEL_ARTEN as readonly string[]).includes(x);
/**
 * Spiele mit eigenem Spielfeld, die nicht bei den Fächern stehen: Glasklar, Wortschloss und Phantombild (mit „Text
 * lernen“). Sie haben eine eigene Kachel im Tab „Spiele“, kein Duell und kein Blockwerk.
 */
export const EIGENES_FELD: SpielArt[] = ["glas", "wort", "phantom", "vorlage", "blatt", "europa", "bio", "biotest", "oesterreich"];
/** Spiele für ein Duell: „Dein Stoff“ und „Meine Fehler“ hat nur dieser Schüler, Glasklar ist ein Puzzle für einen. */
/** Spiele mit eigenem Feld gehen nicht als Duell, außer Europa: dafür gibt es eigene Duell-Karten im Kachelfeld (lib/europa.ts). */
const duellTauglich = (a: SpielArt) => a !== "stoff" && a !== "fehler" && (!EIGENES_FELD.includes(a) || a === "europa");
export const DUELL_ARTEN: SpielArt[] = SPIEL_ARTEN.filter(duellTauglich);
export const istDuellArt = (x: unknown): x is SpielArt => istSpielArt(x) && duellTauglich(x);

export const SPIEL_TITEL: Record<SpielArt, string> = {
  artikel: "der, die, das",
  wortarten: "Wortarten",
  konjugieren: "ich gehe, du gehst",
  gross: "Groß oder klein?",
  praepositionen: "Präposition und Fall",
  deklination: "Adjektiv-Endungen",
  faelle: "Die vier Fälle",
  dasdass: "das oder dass",
  satzteile: "Hauptsatz oder Gliedsatz",
  perfekt: "Perfekt: haben oder sein",
  praeteritum: "Präteritum",
  satzbau: "Satzbau",
  wortschatz: "Wortschatz",
  vokabeln: "Vokabel-Paare",
  irregular: "Irregular Verbs",
  zeiten: "English Tenses",
  grammatik: "English Grammar",
  rechnen: "Kopfrechnen",
  strahl: "Zahlenstrahl",
  stoff: "Dein Stoff",
  glas: "Glasklar",
  wort: "Wortschloss",
  quizmathe: "Mathe-Quiz",
  quizdeutsch: "Deutsch-Quiz",
  quizenglisch: "Englisch-Quiz",
  stilmittel: "Stilmittel",
  fehler: "Meine Fehler",
  phantom: "Phantombild",
  vorlage: "Text lernen",
  blatt: "Blätter bestimmen",
  europa: "Europa",
  bio: "Biolabor",
  biotest: "Bio Test 4.Klasse Vorbereitung De La Salle",
  oesterreich: "Österreich erobern",
};

/** Zu welchem Fach ein Spiel gehört (Abschnitte im Tab „Spiele“). */
export const SPIEL_FACH: Record<SpielArt, "Deutsch" | "Englisch" | "Mathematik" | "Dein Stoff"> = {
  artikel: "Deutsch",
  wortarten: "Deutsch",
  konjugieren: "Deutsch",
  gross: "Deutsch",
  praepositionen: "Deutsch",
  deklination: "Deutsch",
  faelle: "Deutsch",
  dasdass: "Deutsch",
  satzteile: "Deutsch",
  perfekt: "Deutsch",
  praeteritum: "Deutsch",
  satzbau: "Deutsch",
  wortschatz: "Deutsch",
  vokabeln: "Englisch",
  irregular: "Englisch",
  zeiten: "Englisch",
  grammatik: "Englisch",
  rechnen: "Mathematik",
  strahl: "Mathematik",
  stoff: "Dein Stoff",
  // Glasklar steht nicht bei den Fächern (eigene Kachel); das Thema bringt sein Fach mit (lib/glasklar-themen.ts)
  glas: "Dein Stoff",
  // Wortschloss ebenso (lib/wortschloss-themen.ts)
  wort: "Dein Stoff",
  quizmathe: "Mathematik",
  quizdeutsch: "Deutsch",
  quizenglisch: "Englisch",
  stilmittel: "Deutsch",
  // die eigenen Fehler (lib/fehlerprotokoll.ts) stehen neben den eigenen Karten
  fehler: "Dein Stoff",
  // Phantombild hat eine eigene Kachel (lib/phantombild.ts)
  phantom: "Dein Stoff",
  vorlage: "Dein Stoff",
  // Blätter bestimmen (lib/blaetter.ts) hat eine eigene Kachel
  blatt: "Dein Stoff",
  // Europa (lib/europa.ts) hat eine eigene Kachel
  europa: "Dein Stoff",
  // Biolabor (lib/biolabor.ts) hat eine eigene Kachel
  bio: "Dein Stoff",
  // Bio Test De La Salle (lib/biotest.ts) hat eine eigene Kachel
  biotest: "Dein Stoff",
  // Österreich erobern (lib/oesterreich.ts) hat eine eigene Kachel
  oesterreich: "Dein Stoff",
};

/** Eine kurze Zeile für die Kachel im Tab „Spiele“: worum es geht, in Wörtern aus dem Spiel. */
export const SPIEL_KURZ: Record<SpielArt, string> = {
  artikel: "Jedes Nomen zu seinem Artikel",
  wortarten: "Nomen, Verb oder Adjektiv? Bestimm das markierte Wort",
  konjugieren: "ich gehe, du gehst, wir gehen: die richtige Form",
  gross: "beim Spielen oder wir spielen: groß oder klein?",
  praepositionen: "mit dem, für den: der richtige Fall",
  deklination: "großer, große, großes: die Endung",
  faelle: "Wer? Wessen? Wem? Wen?",
  dasdass: "Ein s oder zwei?",
  satzteile: "Welcher Teil kann allein stehen?",
  perfekt: "ist gegangen oder hat gegangen?",
  praeteritum: "ging, gehte oder geht?",
  satzbau: "Wo steht das Verb?",
  wortschatz: "Die treffenden Wörter für deine Geschichte",
  vokabeln: "Englisch und Deutsch: was gehört zusammen?",
  irregular: "go, went, gone",
  zeiten: "plays, is playing oder played?",
  grammatik: "some oder any? much oder many?",
  rechnen: "Schnell im Kopf gerechnet: wie viel kommt heraus?",
  strahl: "Wo liegt die Zahl? Schieb den Zeiger an die richtige Stelle.",
  stoff: "Die Karten, die deine Lehrkraft für dich geschrieben hat",
  glas: "Sortier die Begriffe, bis jedes Glas nur eine Sorte hat",
  wort: "Errate das Wort zum Hinweis in sechs Versuchen",
  quizmathe: "Fragen zu deinem Thema, vom Einmaleins bis zur Ableitung",
  quizdeutsch: "Fragen zu deinem Thema, von Wortarten bis Erörterung",
  quizenglisch: "Fragen zu deinem Thema, von Grammatik bis Writing",
  stilmittel: "Metapher, Vergleich oder Hyperbel? Erkenn das Stilmittel im Satz",
  fehler: "Deine Fehler aus deinen Texten, bis du sie zweimal richtig hast",
  phantom: "Lies die Zeugenaussage und bau das Gesicht",
  vorlage: "Lern deine Personenbeschreibung auswendig",
  blatt: "Welche Pflanze, welche Familie?",
  europa: "Länder, Hauptstädte und Flaggen",
  bio: "Genetik, Nervensystem und Hormone",
  biotest: "Evolution des Menschen und Nervensystem",
  oesterreich: "Bundesländer, Hauptstädte und Bevölkerung",
};

/** Zwei, drei Wörter, die für das Spiel stehen: blass im Hintergrund der Bühne und als Kärtchen auf der Kachel. */
export const SPIEL_DEKO: Record<SpielArt, string[]> = {
  artikel: ["die", "das", "der"],
  wortarten: ["Nomen", "Verb", "Adjektiv"],
  konjugieren: ["gehe", "gehst", "geht"],
  gross: ["Beim", "Spielen", "spielen"],
  praepositionen: ["dem", "den", "der"],
  deklination: ["-en", "-es", "-em"],
  faelle: ["Wem?", "Wen?", "Wer?"],
  dasdass: ["das", "dass", "welches"],
  satzteile: ["weil", "dass", "wenn"],
  perfekt: ["hat", "ist", "sind"],
  praeteritum: ["ging", "kam", "sah"],
  satzbau: ["gehen", "wir", "heute"],
  wortschatz: ["Spuk", "schlich", "knarrte"],
  vokabeln: ["dog", "house", "school"],
  irregular: ["went", "gone", "saw"],
  zeiten: ["plays", "played", "will"],
  grammatik: ["some", "any", "much"],
  rechnen: ["7 · 8", "56", "+"],
  strahl: ["0", "0,5", "1"],
  stoff: ["?", "✓", "→"],
  glas: ["der", "Verb", "Dativ"],
  wort: ["trank", "went", "Gläser"],
  quizmathe: ["a² + b²", "π", "f′"],
  quizdeutsch: ["Metapher", "Verb", "Reim"],
  quizenglisch: ["since", "although", "would"],
  stilmittel: ["Metapher", "Anapher", "Ironie"],
  fehler: ["✗", "✓", "✓"],
  phantom: ["blond", "oval", "Brille"],
  vorlage: ["Er", "hat", "trägt"],
  blatt: ["Ahorn", "Linde", "Eiche"],
  europa: ["Wien", "Paris", "Rom"],
  bio: ["DNA", "Gen", "Synapse"],
  biotest: ["Hominini", "Synapse", "Reflex"],
  oesterreich: ["Tirol", "Graz", "Landflucht"],
};

/** Ein Satz unter dem Titel: was man in dem Spiel tut. */
export const SPIEL_AUFGABE: Record<SpielArt, string> = {
  artikel: "Wirf jedes Wort in die Kiste mit seinem Artikel.",
  wortarten: "Ist das markierte Wort ein Nomen, ein Verb oder ein Adjektiv?",
  konjugieren: "Welche Form des Verbs passt zur Person?",
  gross: "Schreibt man das Wort in der Lücke groß oder klein?",
  praepositionen: "Welcher Artikel passt nach der Präposition?",
  deklination: "Welche Endung braucht das Adjektiv?",
  faelle: "In welchem Fall steht der markierte Teil?",
  dasdass: "das oder dass?",
  satzteile: "Ist der markierte Teil Hauptsatz oder Gliedsatz?",
  perfekt: "haben oder sein?",
  praeteritum: "Welche Form passt im Präteritum?",
  satzbau: "Bring die Teile in die richtige Reihenfolge.",
  wortschatz: "Welches Wort passt am besten?",
  vokabeln: "Welche zwei Wörter gehören zusammen?",
  irregular: "Welche Form passt in die Lücke?",
  zeiten: "Welche Form passt in die Lücke?",
  grammatik: "Was passt in die Lücke?",
  rechnen: "Welches Ergebnis stimmt?",
  strahl: "Wo liegt die Zahl am Zahlenstrahl?",
  stoff: "Welche Antwort stimmt?",
  glas: "Sortier die Begriffe in die Gläser.",
  wort: "Tipp das Wort zum Hinweis.",
  quizmathe: "Welche Antwort stimmt?",
  quizdeutsch: "Welche Antwort stimmt?",
  quizenglisch: "Welche Antwort stimmt?",
  stilmittel: "Welches Stilmittel steckt im markierten Teil?",
  fehler: "Welche Form ist richtig?",
  phantom: "Bau die Person aus der Zeugenaussage.",
  vorlage: "Setz die fehlenden Wörter ein.",
  blatt: "Welche Pflanze ist das, und zu welcher Familie gehört sie?",
  europa: "Wo liegt das Land, wie heißt die Hauptstadt, welche Flagge hat es?",
  bio: "Genetik und Nervensystem: üben wie für den Test.",
  biotest: "Die Übungen deiner Lehrkraft für den Biologie-Test.",
  oesterreich: "Erobere alle neun Bundesländer: Karte, Einwohner, Altersaufbau, Begriffe.",
};

/**
 * So wird eine Karte beantwortet: Karten in Kisten (ohne Angabe), Paare finden, Teile in eine Reihe bringen, eine Zahl
 * am Zahlenstrahl treffen, das Ergebnis eintippen, ein Wort aus Buchstaben legen, die Karte nach links oder rechts
 * wischen oder die passende Antwort-Kachel in die Lücke tippen.
 */
export type SpielForm = "paar" | "reihe" | "strahl" | "tippen" | "legen" | "wischen" | "kacheln" | "schreiben";
/**
 * Die Form eines Spiels, wenn alle seine Karten so beantwortet werden. „Kopfrechnen“, „English Tenses“ und „English
 * Grammar“ fehlen: dort hängt es am Thema (Zahlen werden getippt, ja oder nein wird gewischt, drei Formen stehen am
 * Kacheln; lib/lernspiele-antwort.ts).
 */
export const SPIEL_FORM: Partial<Record<SpielArt, SpielForm>> = {
  vokabeln: "paar",
  satzbau: "reihe",
  wortschatz: "kacheln",
  strahl: "strahl",
  irregular: "legen",
  praeteritum: "legen",
  dasdass: "wischen",
  perfekt: "wischen",
  satzteile: "wischen",
  praepositionen: "kacheln",
  deklination: "kacheln",
  stilmittel: "kacheln",
  wortarten: "kacheln",
  konjugieren: "kacheln",
  gross: "wischen",
  fehler: "wischen",
};

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
 *
 * Beim Eintippen (`form: "tippen"`) und beim Legen (`form: "legen"`) ist die Karte dieselbe wie mit Kisten; die Wahl
 * ist `richtig`, wenn das Getippte oder Gelegte stimmt, sonst das, was der Schüler geschrieben hat.
 *
 * Beim Wischen (`form: "wischen"`, zwei Fächer: das erste links, das zweite rechts) und bei den Kacheln (`form: "kacheln"`) ist die
 * Karte auch dieselbe, und die Wahl ist wie bei den Kisten eines der `faecher`.
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
  /** Beim Selbstschreiben (lib/antwort-schreiben.ts): was außer `richtig` auch stimmt (ein zweites Stilmittel im Satz) */
  auch?: string[];
  /** Der ganze richtige Satz oder „die Haustür“ */
  loesung: string;
  /** Kurze Regel, die nach einem Fehler erscheint; nur, was für diese Karte sicher stimmt */
  regel: string;
  /** Ein Wort zur richtigen Antwort, z. B. „Dativ“ */
  marke?: string;
  /** Was über der Karte steht, wenn es nicht für das ganze Spiel gilt („Ordne das Zeitseil …“, Spielkarten) */
  auftrag?: string;
  /** Mathe: Text, Kisten und Regel werden gesetzt wie in den Übungen (Bruchstrich, Hochzahl, Wurzel) */
  mathe?: true;
  /** Nur am Zahlenstrahl: die Zahl an jedem Teilstrich, welche davon dastehen, und ob die Gerade auch nach links weitergeht */
  strahl?: { werte: string[]; beschriftet: number[]; beide?: true };
  /** Nur am Zahlenstrahl: ein Satz zu einer typischen falschen Stelle („Vorzeichen verwechselt“), nach der Nummer des Teilstrichs */
  tipps?: Record<string, string>;
  /** Nur Phantombild (lib/phantombild.ts), an der ersten Karte eines Falls: der Fall und die Zeugenaussage */
  phantom?: PhantomDaten;
  /** Nur „Text lernen“ (lib/phantom-vorlage.ts), an der ersten Karte: Person, Text mit Lücken, Musterlösung */
  vorlage?: VorlageDaten;
  /** Ein Bild über dem Satz im Kachelfeld (Europa-Duell: die Flagge) */
  bild?: { src: string; alt: string };
  /** Nur „Blätter bestimmen“ (lib/blaetter.ts): welches Blatt, ob Name oder Familie gefragt ist, das Bild */
  blatt?: BlattDaten;
  /** Nur „Europa“ (lib/europa.ts): welches Land, welcher Teil, wie gefragt und geantwortet wird */
  europa?: EuropaDaten;
  /** Nur „Biolabor“ (lib/biolabor.ts): Eintrag, Thema, wie geantwortet wird, beim Kreuzungsschema das Schema */
  bio?: BioDaten;
  /** Nur „Bio Test De La Salle“ (lib/biotest.ts): Übung und Stelle */
  biotest?: BiotestDaten;
  /** Nur „Österreich erobern“ (lib/oesterreich.ts): Eintrag, Level, wie gefragt wird */
  oe?: OeDaten;
};

/**
 * Ein Thema eines Themenspiels („English Tenses“, „Kopfrechnen“): die Fähigkeit, ein kurzer Name für den Schüler und
 * die Schulstufen, in denen es dran ist (`bis` fehlt: bis zum Schluss).
 */
export type SpielThema = {
  skill: string;
  name: string;
  ab: number;
  bis?: number;
  /** andere Fähigkeiten im Stoff, die zu diesem Thema führen */
  auch?: string[];
  /** nur in diesen Schularten ein Thema zum Weiterüben (lib/school.ts; aus dem Stoff kommt es trotzdem) */
  schularten?: string[];
};

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

/** `endlos`: im Endlos-Modus die id des Endlos-Spiels (für die nächste Runde). `stufe`: Glasklar, die Nummer der Stufe (ab 1). */
export type SpielStart = { rundeId: number; karten: SpielKarte[]; endlos?: number; stufe?: number } | { fehler: string };

/** Spiele mit Endlos-Modus: alle außer „Vokabel-Paare“ (dort liegen alle Karten einer Runde auf einmal am Brett). */
export const hatEndlos = (art: SpielArt) => art !== "vokabeln";
/** Torlauf (lib/torlauf.ts) braucht Antworten zum Wählen: kein Satzbau, kein Zahlenstrahl, keine eigenen Spiele (Glasklar, Wortschloss). */
export const torTauglich = (art: SpielArt) => hatEndlos(art) && art !== "satzbau" && art !== "strahl" && !EIGENES_FELD.includes(art);
/** So viele Fehler verzeiht ein Endlos-Spiel. */
export const ENDLOS_HERZEN = 3;

/** Eine Zeile der Blockwerk-Bestenliste: der Name („Max M.“) und das Tierbild aus dem Spielprofil. */
export type BestenZeile = { platz: number; name: string; bild: string; punkte: number; ich: boolean };
/**
 * Die Blockwerk-Bestenliste (lib/lernspiele.ts `bloeckeBestenliste`): die Besten aller Schüler mit Spielprofil, dazu die
 * eigene Zeile, auch wenn sie weiter unten ist. `profil`: was dem Schüler fehlt, um für andere sichtbar zu sein.
 */
export type Bestenliste = { zeilen: BestenZeile[]; ich: BestenZeile | null; profil: "da" | "anlegen" | "erlaubnis" };

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
      /** Endlos-Modus: alle beim ersten Versuch richtigen Karten des Endlos-Spiels und der Rekord davor */
      endlos?: { stand: number; rekord: number };
      /** Blockwerk und Funkelfeld: der beste Stand davor (über alle Spiele), wie viele Fragen beim ersten Versuch richtig waren, die Bestenliste danach */
      bloecke?: { rekord: number; fragen: number; bestenliste?: Bestenliste };
      /** Glasklar: der beste Stand davor, wie viele Begriffe beim ersten Versuch richtig waren, die Bestenliste danach */
      glas?: { rekord: number; begriffe: number; bestenliste?: Bestenliste };
      /** Wortschloss: der beste Stand davor, wie viele Wörter in der ersten Reihe gelöst waren, die Bestenliste danach */
      wort?: { rekord: number; woerter: number; bestenliste?: Bestenliste };
      /** Phantombild: der beste Stand davor, wie viele Merkmale beim ersten Versuch stimmten, die Bestenliste danach */
      phantom?: { rekord: number; merkmale: number; bestenliste?: Bestenliste };
      /** Blätter bestimmen: die Nummern der Blätter, die jetzt sicher sind (lib/blaetter.ts blattStand) */
      blatt?: { sicher: number[] };
      /** Europa: je Land die Teile, die jetzt sitzen; beim Rennen der beste Stand davor */
      europa?: { sitzt: LandStand; rekord?: { thema: Teil; vorher: number } };
      /** Biolabor: die Einträge, die jetzt sicher sitzen (lib/biolabor.ts bioStand) */
      bio?: { sicher: string[]; level?: Record<number, number> };
      /** Bio Test De La Salle: Stellen („übung:stelle“), die sicher sitzen und die zuletzt falsch waren */
      biotest?: { sicher: string[]; falsch: string[] };
      /** Österreich erobern: sichere Einträge, zuletzt falsche, die besten Sterne je Level */
      oesterreich?: { sicher: string[]; falsch: string[]; level: Record<number, number> };
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

/**
 * Seit wann ein Spiel in der Schüler-App steht (Tag des Merges). Das Schild „Neu“ steht nur in den ersten 14 Tagen
 * (niko 2026-11-24: „es wird langsam unübersichtlich“). Neue Spiele hier eintragen.
 */
export const SPIEL_SEIT: Record<string, string> = {
  bloecke: "2026-11-13",
  funkel: "2026-11-16",
  glas: "2026-11-16",
  wort: "2026-11-17",
  tor: "2026-11-17",
  phantom: "2026-11-19",
  blatt: "2026-11-22",
  europa: "2026-11-22",
  bio: "2026-11-23",
  biotest: "2026-11-23",
  oesterreich: "2026-11-24",
};

/** Steht das Spiel seit höchstens 14 Tagen in der App? `heute` als JJJJ-MM-TT (Wien). */
export function istNeuesSpiel(spiel: string, heute: string, tage = 14): boolean {
  const seit = SPIEL_SEIT[spiel];
  if (!seit) return false;
  const diff = (Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${seit}T12:00:00Z`)) / 86_400_000;
  return diff >= 0 && diff < tage;
}
