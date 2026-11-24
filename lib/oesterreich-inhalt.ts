/**
 * Der Stoff von „Österreich erobern“ (lib/oesterreich.ts): Teststoff einer 3. Klasse AHS (GWB, Test am 26.11.2026),
 * GWB-Buch S. 8–13 (Fotos vom 24.11.2026). Zahlen und Wörter wie im Buch, nichts aus anderen Quellen.
 *
 * Jedes Level gehört zu einem Bundesland: wer es schafft, erobert das Bundesland. Wien ist der Endgegner (Fragen aus
 * allen Leveln).
 */

export type LandId = "v" | "t" | "s" | "k" | "st" | "o" | "n" | "b" | "w";

export type Bundesland = {
  id: LandId;
  name: string;
  /** Abkürzung wie im Buch (W, K, S, St, …) */
  kurz: string;
  hauptstadt: string;
  /** andere Schreibweisen der Hauptstadt, die beim Schreiben auch gelten */
  hauptstadtAuch?: string[];
  /** Volkszählung 2021 (Buch S. 8, M2) */
  einwohner: number;
  /** Veränderung 2011 → 2021 in Prozent (M2) */
  plus: number;
  /** Ausländeranteil Anfang 2024 in Prozent (Buch S. 10, M4) */
  auslaender: number;
  /** Landesfarben von oben nach unten (für das eroberte Land) */
  farben: string[];
};

export const BUNDESLAENDER: Bundesland[] = [
  { id: "v", name: "Vorarlberg", kurz: "V", hauptstadt: "Bregenz", einwohner: 401037, plus: 8.3, auslaender: 20.6, farben: ["#d4202c", "#ffffff"] },
  { id: "t", name: "Tirol", kurz: "T", hauptstadt: "Innsbruck", einwohner: 762652, plus: 7.5, auslaender: 18.7, farben: ["#ffffff", "#d4202c"] },
  { id: "s", name: "Salzburg", kurz: "S", hauptstadt: "Salzburg", einwohner: 561714, plus: 6.2, auslaender: 20.3, farben: ["#d4202c", "#ffffff"] },
  { id: "k", name: "Kärnten", kurz: "K", hauptstadt: "Klagenfurt", hauptstadtAuch: ["Klagenfurt am Wörthersee"], einwohner: 564328, plus: 1.5, auslaender: 13.2, farben: ["#f5c400", "#d4202c", "#ffffff"] },
  { id: "st", name: "Steiermark", kurz: "St", hauptstadt: "Graz", einwohner: 1251683, plus: 3.6, auslaender: 14.1, farben: ["#ffffff", "#1d9a3e"] },
  { id: "o", name: "Oberösterreich", kurz: "OÖ", hauptstadt: "Linz", einwohner: 1504237, plus: 6.4, auslaender: 16, farben: ["#ffffff", "#d4202c"] },
  { id: "n", name: "Niederösterreich", kurz: "NÖ", hauptstadt: "St. Pölten", hauptstadtAuch: ["Sankt Pölten", "St Pölten", "St.Pölten"], einwohner: 1698951, plus: 5.2, auslaender: 12.2, farben: ["#1f4fa3", "#f5c400"] },
  { id: "b", name: "Burgenland", kurz: "B", hauptstadt: "Eisenstadt", einwohner: 297506, plus: 4.1, auslaender: 11.4, farben: ["#d4202c", "#e8b000"] },
  { id: "w", name: "Wien", kurz: "W", hauptstadt: "Wien", einwohner: 1926960, plus: 12.4, auslaender: 35.4, farben: ["#d4202c", "#ffffff"] },
];

export const LAND = Object.fromEntries(BUNDESLAENDER.map((b) => [b.id, b])) as Record<LandId, Bundesland>;

/** Österreich gesamt (Buch S. 8 und 10). */
export const OESTERREICH = { einwohner2024: 9179693, einwohner2021: 8969068, plus2021: 6.7, auslaender: 19.6, auslaenderZahl: 1891184 };

/** Altersaufbaudiagramm Österreich 1.1.2023 (Buch S. 11, M5): je 5er-Gruppe ab 0 Jahren Männer und Frauen. */
export const ALTERSAUFBAU: { ab: number; m: number; f: number }[] = [
  { ab: 0, m: 221420, f: 210053 },
  { ab: 5, m: 230525, f: 217130 },
  { ab: 10, m: 224575, f: 211341 },
  { ab: 15, m: 230051, f: 216466 },
  { ab: 20, m: 260173, f: 242216 },
  { ab: 25, m: 305396, f: 287317 },
  { ab: 30, m: 325376, f: 309977 },
  { ab: 35, m: 314884, f: 308402 },
  { ab: 40, m: 304732, f: 302907 },
  { ab: 45, m: 289798, f: 295647 },
  { ab: 50, m: 333641, f: 339651 },
  { ab: 55, m: 354525, f: 357090 },
  { ab: 60, m: 310572, f: 320204 },
  { ab: 65, m: 237318, f: 262673 },
  { ab: 70, m: 189854, f: 223846 },
  { ab: 75, m: 146333, f: 186965 },
  { ab: 80, m: 129583, f: 181697 },
  { ab: 85, m: 51901, f: 87921 },
  { ab: 90, m: 20308, f: 44912 },
  { ab: 95, m: 3850, f: 13542 },
];

/**
 * Ein Eintrag (eine Karte):
 * - `land`: auf der Karte ein Bundesland antippen (`land` ist die Lösung)
 * - `stadt`: auf der Karte eine Landeshauptstadt antippen (Punkt des Bundeslandes `land`)
 * - `wahl`: Kacheln (`richtig` und `falsch`)
 * - `rf`: richtig oder falsch
 * - `mehr`: welches von zwei Bundesländern hat mehr Einwohner (2021)
 * - `gruppe`: ein Bundesland in eine Gruppe (Kacheln mit den Gruppen)
 * - `balken`: im Altersaufbaudiagramm eine Altersgruppe antippen (`ziel`: „m55“, „f85“ oder „55“ = egal welche Seite)
 * - `reihe`: der Reihe nach antippen (`teile` in richtiger Reihenfolge)
 * - `zahl`: eine Zahl schreiben
 * - `schreiben`: einen Begriff oder Namen schreiben (`auch`: andere Schreibweisen)
 */
export type Eintrag = { id: string; merke?: string } & (
  | { art: "land"; frage: string; land: LandId }
  | { art: "stadt"; frage: string; land: LandId }
  | { art: "wahl"; frage: string; richtig: string; falsch: string[] }
  | { art: "rf"; frage: string; richtig: boolean }
  | { art: "mehr"; a: LandId; b: LandId }
  | { art: "gruppe"; frage: string; land: LandId; gruppen: string[]; richtig: string }
  | { art: "balken"; frage: string; ziel: string[] }
  | { art: "reihe"; frage: string; teile: string[] }
  | { art: "zahl"; frage: string; richtig: number }
  | { art: "schreiben"; frage: string; richtig: string; auch?: string[] }
);

export type Level = {
  nr: number;
  land: LandId;
  titel: string;
  /** Buchseiten */
  quelle: string;
  /** Lernzettel: das Wichtigste in kurzen Sätzen */
  zettel: string[];
  eintraege: Eintrag[];
};

const EINWOHNER_GRUPPEN = ["über 1 Million", "500 000 bis 1 Million", "unter 500 000"];
const AUSL_GRUPPEN = ["über 19,6 %", "unter 19,6 %"];

export const LEVELS: Level[] = [
  {
    nr: 1,
    land: "v",
    titel: "Die 9 Bundesländer",
    quelle: "Buch S. 9, M7",
    zettel: [
      "Österreich hat 9 Bundesländer: Vorarlberg, Tirol, Salzburg, Kärnten, Steiermark, Oberösterreich, Niederösterreich, Burgenland, Wien.",
            "Wien ist flächenmäßig das kleinste Bundesland, hat aber die meisten Einwohnerinnen und Einwohner (M6).",
    ],
    eintraege: [
      { id: "l-v", art: "land", frage: "Tippe auf Vorarlberg.", land: "v", merke: "Vorarlberg (V), Hauptstadt Bregenz." },
      { id: "l-t", art: "land", frage: "Tippe auf Tirol.", land: "t", merke: "Tirol (T), Hauptstadt Innsbruck." },
      { id: "l-s", art: "land", frage: "Tippe auf Salzburg.", land: "s", merke: "Salzburg (S), Hauptstadt Salzburg." },
      { id: "l-k", art: "land", frage: "Tippe auf Kärnten.", land: "k", merke: "Kärnten (K), Hauptstadt Klagenfurt." },
      { id: "l-st", art: "land", frage: "Tippe auf die Steiermark.", land: "st", merke: "Steiermark (St), Hauptstadt Graz." },
      { id: "l-o", art: "land", frage: "Tippe auf Oberösterreich.", land: "o", merke: "Oberösterreich (OÖ), Hauptstadt Linz." },
      { id: "l-n", art: "land", frage: "Tippe auf Niederösterreich.", land: "n", merke: "Niederösterreich (NÖ), Hauptstadt St. Pölten." },
      { id: "l-b", art: "land", frage: "Tippe auf das Burgenland.", land: "b", merke: "Burgenland (B), Hauptstadt Eisenstadt." },
      { id: "l-w", art: "land", frage: "Tippe auf Wien.", land: "w", merke: "Wien (W) ist flächenmäßig das kleinste Bundesland." },
      { id: "l-anzahl", art: "wahl", frage: "Wie viele Bundesländer hat Österreich?", richtig: "9", falsch: ["7", "8", "10"], merke: "Österreich hat neun Bundesländer." },
      { id: "l-klein", art: "land", frage: "Tippe auf das flächenmäßig kleinste Bundesland.", land: "w", merke: "Wien ist flächenmäßig das kleinste Bundesland, hat aber die meisten Einwohnerinnen und Einwohner (Buch S. 8, M6)." },
    ],
  },
  {
    nr: 2,
    land: "t",
    titel: "Landeshauptstädte",
    quelle: "Buch S. 9, Aufgabe 1",
    zettel: [
      "Vorarlberg: Bregenz · Tirol: Innsbruck · Salzburg: Salzburg · Kärnten: Klagenfurt",
      "Steiermark: Graz · Oberösterreich: Linz · Niederösterreich: St. Pölten · Burgenland: Eisenstadt · Wien: Wien",
      "Wien ist Bundeshauptstadt, Landeshauptstadt und Bundesland zugleich.",
      "Eisenstadt ist sehr klein: Alle Bewohner hätten 1985 im Wohnpark Alt-Erlaa in Wien Platz gehabt (10 000 Menschen).",
    ],
    eintraege: [
      { id: "h-graz", art: "stadt", frage: "Tippe auf Graz.", land: "st", merke: "Graz ist die Landeshauptstadt der Steiermark." },
      { id: "h-linz", art: "stadt", frage: "Tippe auf Linz.", land: "o", merke: "Linz ist die Landeshauptstadt von Oberösterreich." },
      { id: "h-ibk", art: "stadt", frage: "Tippe auf Innsbruck.", land: "t", merke: "Innsbruck ist die Landeshauptstadt von Tirol." },
      { id: "h-eis", art: "stadt", frage: "Tippe auf Eisenstadt.", land: "b", merke: "Eisenstadt ist die Landeshauptstadt des Burgenlandes." },
      { id: "h-stp", art: "stadt", frage: "Tippe auf St. Pölten.", land: "n", merke: "St. Pölten ist die Landeshauptstadt von Niederösterreich." },
      { id: "h-kla", art: "stadt", frage: "Tippe auf Klagenfurt.", land: "k", merke: "Klagenfurt ist die Landeshauptstadt von Kärnten." },
      { id: "h-bre", art: "stadt", frage: "Tippe auf Bregenz.", land: "v", merke: "Bregenz ist die Landeshauptstadt von Vorarlberg." },
      { id: "h-sbg", art: "stadt", frage: "Tippe auf die Stadt Salzburg.", land: "s", merke: "Die Landeshauptstadt von Salzburg heißt auch Salzburg." },
      { id: "h-s-n", art: "schreiben", frage: "Wie heißt die Landeshauptstadt von Niederösterreich?", richtig: "St. Pölten", auch: LAND_AUCH("n"), merke: "Niederösterreich: St. Pölten" },
      { id: "h-s-b", art: "schreiben", frage: "Wie heißt die Landeshauptstadt des Burgenlandes?", richtig: "Eisenstadt", merke: "Burgenland: Eisenstadt" },
      { id: "h-s-k", art: "schreiben", frage: "Wie heißt die Landeshauptstadt von Kärnten?", richtig: "Klagenfurt", auch: LAND_AUCH("k"), merke: "Kärnten: Klagenfurt" },
      { id: "h-s-v", art: "schreiben", frage: "Wie heißt die Landeshauptstadt von Vorarlberg?", richtig: "Bregenz", merke: "Vorarlberg: Bregenz" },
      { id: "h-s-o", art: "schreiben", frage: "Wie heißt die Landeshauptstadt von Oberösterreich?", richtig: "Linz", merke: "Oberösterreich: Linz" },
      { id: "h-w3", art: "wahl", frage: "Wien ist Bundeshauptstadt, Landeshauptstadt und …", richtig: "Bundesland zugleich", falsch: ["ein Bezirk von Niederösterreich", "eine Gemeinde im Burgenland", "die Hauptstadt der EU"], merke: "Wien ist Bundeshauptstadt, Landeshauptstadt (Gemeinde) und Bundesland zugleich (Buch S. 8)." },
    ],
  },
  {
    nr: 3,
    land: "s",
    titel: "Kürzel, Bezirke, Kennzeichen",
    quelle: "Buch S. 8–9, M7 und M10",
    zettel: [
      "Kürzel: W Wien, NÖ Niederösterreich, OÖ Oberösterreich, B Burgenland, St Steiermark, K Kärnten, S Salzburg, T Tirol, V Vorarlberg.",
      "Österreich hat 9 Bundesländer, 94 Bezirke und rund 2 000 Gemeinden. Manche Gemeinden sind Märkte, Städte oder Landeshauptstädte.",
      "Viele Bezirke kennst du von den Autokennzeichen (M10).",
      "KG = Klosterneuburg (Niederösterreich), WO = Wolfsberg (Kärnten), MU = Murau (Steiermark), RE = Reutte (Tirol).",
    ],
    eintraege: [
      { id: "k-noe", art: "wahl", frage: "Wofür steht das Kürzel NÖ?", richtig: "Niederösterreich", falsch: ["Nordösterreich", "Oberösterreich", "Neuösterreich"], merke: "NÖ = Niederösterreich, OÖ = Oberösterreich." },
      { id: "k-st", art: "wahl", frage: "Wofür steht das Kürzel St?", richtig: "Steiermark", falsch: ["Salzburg", "St. Pölten", "Stadt Wien"], merke: "St = Steiermark, S = Salzburg." },
      { id: "k-s", art: "wahl", frage: "Wofür steht das Kürzel S?", richtig: "Salzburg", falsch: ["Steiermark", "St. Pölten", "Südtirol"], merke: "S = Salzburg, St = Steiermark." },
      { id: "k-ooe", art: "wahl", frage: "Welches Kürzel hat Oberösterreich?", richtig: "OÖ", falsch: ["O", "NÖ", "Ö"], merke: "Oberösterreich = OÖ." },
      { id: "k-k", art: "wahl", frage: "Wofür steht das Kürzel K?", richtig: "Kärnten", falsch: ["Klagenfurt", "Kufstein", "Krems"], merke: "K = Kärnten." },
      { id: "k-re", art: "land", frage: "Autokennzeichen RE (Bezirk Reutte): Tippe auf das Bundesland.", land: "t", merke: "RE = Reutte, ein Bezirk in Tirol." },
      { id: "k-wo", art: "land", frage: "Autokennzeichen WO (Bezirk Wolfsberg): Tippe auf das Bundesland.", land: "k", merke: "WO = Wolfsberg, ein Bezirk in Kärnten." },
      { id: "k-mu", art: "land", frage: "Autokennzeichen MU (Bezirk Murau): Tippe auf das Bundesland.", land: "st", merke: "MU = Murau, ein Bezirk in der Steiermark." },
      { id: "k-kg", art: "land", frage: "Autokennzeichen KG (Klosterneuburg): Tippe auf das Bundesland.", land: "n", merke: "KG = Klosterneuburg, in Niederösterreich (auf dem Kennzeichen das Wappen von Niederösterreich)." },
      { id: "k-re-name", art: "wahl", frage: "Für welchen Bezirk steht das Kennzeichen RE?", richtig: "Reutte", falsch: ["Ried", "Rust", "Rohrbach"], merke: "RE = Reutte (Tirol)." },
      { id: "k-wo-name", art: "wahl", frage: "Für welchen Bezirk steht das Kennzeichen WO?", richtig: "Wolfsberg", falsch: ["Wolfsthal", "Wörgl", "Wels"], merke: "WO = Wolfsberg (Kärnten)." },
      { id: "k-bezirke", art: "wahl", frage: "Wie viele Bezirke hat Österreich?", richtig: "94", falsch: ["9", "49", "2 000"], merke: "Österreich hat 94 Bezirke und neun Bundesländer." },
      { id: "k-gemeinden", art: "wahl", frage: "In wie vielen Gemeinden wird der Einwohnerstand ermittelt?", richtig: "rund 2 000", falsch: ["rund 94", "rund 200", "rund 20 000"], merke: "In Österreich gibt es rund 2 000 Gemeinden." },
    ],
  },
  {
    nr: 4,
    land: "k",
    titel: "Wer hat mehr Einwohner?",
    quelle: "Buch S. 8, M2 und „Die goldene Mitte“",
    zettel: [
      "Volkszählung 2021 (M2): Wien 1 926 960 · Niederösterreich 1 698 951 · Oberösterreich 1 504 237 · Steiermark 1 251 683 · Tirol 762 652 · Kärnten 564 328 · Salzburg 561 714 · Vorarlberg 401 037 · Burgenland 297 506.",
      "Über 1 Million: Wien, Niederösterreich, Oberösterreich, Steiermark. 500 000 bis 1 Million: Tirol, Kärnten, Salzburg. Unter 500 000: Vorarlberg, Burgenland.",
      "Am stärksten gewachsen (2011–2021): Wien +12,4 %. Am wenigsten: Kärnten +1,5 %. Österreich: +6,7 %.",
      "Am 1. Juli 2024 lebten in Österreich 9 179 693 Menschen. Die Zahl wächst weiter.",
      "Die goldene Mitte: In 13 EU-Staaten leben weniger Menschen als in Österreich, in den anderen 13 mehr.",
    ],
    eintraege: [
      { id: "e-w-n", art: "mehr", a: "n", b: "w" },
      { id: "e-t-o", art: "mehr", a: "t", b: "o" },
      { id: "e-st-n", art: "mehr", a: "st", b: "n" },
      { id: "e-k-s", art: "mehr", a: "s", b: "k", merke: "Ganz knapp: Kärnten 564 328, Salzburg 561 714." },
      { id: "e-v-b", art: "mehr", a: "b", b: "v" },
      { id: "e-t-k", art: "mehr", a: "k", b: "t" },
      { id: "e-g-st", art: "gruppe", frage: "Wie viele Einwohner hat die Steiermark?", land: "st", gruppen: EINWOHNER_GRUPPEN, richtig: EINWOHNER_GRUPPEN[0] },
      { id: "e-g-t", art: "gruppe", frage: "Wie viele Einwohner hat Tirol?", land: "t", gruppen: EINWOHNER_GRUPPEN, richtig: EINWOHNER_GRUPPEN[1] },
      { id: "e-g-v", art: "gruppe", frage: "Wie viele Einwohner hat Vorarlberg?", land: "v", gruppen: EINWOHNER_GRUPPEN, richtig: EINWOHNER_GRUPPEN[2] },
      { id: "e-g-o", art: "gruppe", frage: "Wie viele Einwohner hat Oberösterreich?", land: "o", gruppen: EINWOHNER_GRUPPEN, richtig: EINWOHNER_GRUPPEN[0] },
      { id: "e-g-s", art: "gruppe", frage: "Wie viele Einwohner hat Salzburg?", land: "s", gruppen: EINWOHNER_GRUPPEN, richtig: EINWOHNER_GRUPPEN[1] },
      { id: "e-wenigste", art: "land", frage: "Tippe auf das Bundesland mit den wenigsten Einwohnern.", land: "b", merke: "Das Burgenland hat die wenigsten Einwohner (297 506)." },
      { id: "e-wachs", art: "land", frage: "Welches Bundesland ist von 2011 bis 2021 am stärksten gewachsen? Tippe es an.", land: "w", merke: "Wien wuchs am stärksten: +12,4 %. Kärnten am wenigsten: +1,5 %." },
      { id: "e-wachs-min", art: "land", frage: "Welches Bundesland ist von 2011 bis 2021 am wenigsten gewachsen? Tippe es an.", land: "k", merke: "Kärnten wuchs nur um 1,5 %, Wien um 12,4 %." },
      { id: "e-reihe", art: "reihe", frage: "Ordne nach Einwohnern: das größte zuerst.", teile: ["Wien", "Niederösterreich", "Oberösterreich", "Steiermark"], merke: "Wien (1,93 Mio.) > Niederösterreich (1,70 Mio.) > Oberösterreich (1,50 Mio.) > Steiermark (1,25 Mio.)." },
      { id: "e-2024", art: "wahl", frage: "Wie viele Menschen lebten am 1. Juli 2024 in Österreich?", richtig: "9 179 693", falsch: ["8 969 068", "7 180 000", "10 179 693"], merke: "1. Juli 2024: 9 179 693 Menschen (Statistik Austria). 2021 waren es 8 969 068." },
      { id: "e-mitte", art: "wahl", frage: "Warum liegt Österreich bei der Einwohnerzahl in der „goldenen Mitte“?", richtig: "In 13 EU-Staaten leben weniger Menschen, in 13 mehr.", falsch: ["Österreich hat die meisten Einwohner der EU.", "Österreich liegt in der Mitte von Europa.", "Die Hälfte der Österreicher lebt in Wien."], merke: "In 13 EU-Staaten leben weniger Menschen als in Österreich, in den anderen 13 mehr." },
    ],
  },
  {
    nr: 5,
    land: "st",
    titel: "Volkszählung und Hauptwohnsitz",
    quelle: "Buch S. 9, M8, M9, M11 und S. 10, M1",
    zettel: [
      "Bei Volkszählungen wird die Wohnbevölkerung eines Raumes gezählt (Staat, Bundesland, Bezirk, Gemeinde).",
      "Damit Menschen nicht doppelt gezählt werden, müssen sie einen Hauptwohnsitz angeben.",
      "Hauptwohnsitz: die Unterkunft, die jemand zum Mittelpunkt seiner Lebensbeziehungen machen möchte. Wichtig dafür: Aufenthaltsdauer, Weg zur Arbeit oder Ausbildung, Wohnsitz der Familie (vor allem der Kinder), Ort der Erwerbstätigkeit, der Ausbildung, der Schule oder des Kindergartens.",
      "Die erste Volkszählung Österreichs war 1754 unter Maria Theresia. Seit 1869 wird alle zehn Jahre gezählt.",
      "Die letzte klassische Volkszählung war 2001 (mit Formular). Seit 2011 gibt es alle zehn Jahre Registerzählungen (2011, 2021): Die Bevölkerung wird aus gesammelten Daten (Geburtsdaten, Sterbedaten, Meldedaten) berechnet.",
      "Volkszählungen zeigen auch das Alter der Gesellschaft, Einwanderung und Auswanderung (Migration), Pendlerinnen und Pendler und die Haushalte (Familiengrößen).",
    ],
    eintraege: [
      { id: "z-hws", art: "schreiben", frage: "Wie heißt der Wohnsitz, der der Mittelpunkt deiner Lebensbeziehungen ist?", richtig: "Hauptwohnsitz", merke: "Hauptwohnsitz: die Unterkunft, die jemand zum Mittelpunkt seiner Lebensbeziehungen machen möchte." },
      { id: "z-doppelt", art: "wahl", frage: "Warum muss man bei einer Volkszählung einen Hauptwohnsitz angeben?", richtig: "Damit niemand doppelt gezählt wird.", falsch: ["Damit man wählen darf.", "Damit man Steuern zahlt.", "Damit man einen Reisepass bekommt."], merke: "Damit Menschen nicht doppelt gezählt werden, müssen sie einen Hauptwohnsitz angeben." },
      { id: "z-kriterium", art: "wahl", frage: "Was ist KEIN Merkmal für den Mittelpunkt der Lebensbeziehungen?", richtig: "der Ort, an dem man Urlaub macht", falsch: ["der Ort der Schule", "der Wohnsitz der Familie", "der Ort der Erwerbstätigkeit"], merke: "Wichtig sind: Aufenthaltsdauer, Weg zur Arbeit oder Ausbildung, Wohnsitz der Familie, Ort der Arbeit, der Ausbildung, der Schule oder des Kindergartens." },
      { id: "z-reihe", art: "reihe", frage: "Mein Hauptwohnsitz (M11): Ordne vom Größten zum Kleinsten.", teile: ["Staat", "Bundesland", "Bezirk", "Gemeinde", "Adresse"], merke: "Staat → Bundesland → Bezirk → Gemeinde → Adresse." },
      { id: "z-1754", art: "wahl", frage: "Wann fand die erste Volkszählung Österreichs statt?", richtig: "1754 unter Maria Theresia", falsch: ["1869 unter Kaiser Franz Joseph", "1918 nach dem Ersten Weltkrieg", "2001"], merke: "Die erste Volkszählung war 1754 unter Maria Theresia." },
      { id: "z-1869", art: "wahl", frage: "Seit wann wird die Bevölkerung Österreichs (mit wenigen Ausnahmen) alle zehn Jahre gezählt?", richtig: "seit 1869", falsch: ["seit 1754", "seit 1955", "seit 2011"], merke: "Seit 1869 wird alle zehn Jahre gezählt." },
      { id: "z-2001", art: "wahl", frage: "Wann war die letzte klassische Volkszählung mit Formular?", richtig: "2001", falsch: ["1991", "2011", "2021"], merke: "Die letzte klassische Volkszählung war 2001. Seither gibt es Registerzählungen (2011, 2021)." },
      { id: "z-register", art: "schreiben", frage: "Wie heißt die Zählung, bei der die Bevölkerung aus gesammelten Daten berechnet wird?", richtig: "Registerzählung", merke: "Registerzählung: Alle zehn Jahre (2011, 2021) wird die Bevölkerung aus gesammelten Daten (Geburts-, Sterbe-, Meldedaten) berechnet." },
      { id: "z-daten", art: "wahl", frage: "Welche Daten nützt eine Registerzählung?", richtig: "Geburtsdaten, Sterbedaten, Meldedaten", falsch: ["Schulnoten, Zeugnisse, Klassenbücher", "Handydaten und Fotos", "nur ein Formular, das jeder ausfüllt"], merke: "Registerzählung: gesammelte Daten wie Geburtsdaten, Sterbedaten, Meldedaten usw." },
      { id: "z-register-wann", art: "wahl", frage: "Wann gab es Registerzählungen?", richtig: "2011 und 2021", falsch: ["2001 und 2011", "jedes Jahr", "1754 und 1869"], merke: "Registerzählungen alle zehn Jahre: 2011 und 2021." },
      { id: "z-auskunft", art: "wahl", frage: "Worüber geben Volkszählungen auch Auskunft?", richtig: "Alter, Migration, Pendler, Haushalte", falsch: ["Lieblingsessen und Hobbys", "Schulnoten und Zeugnisse", "Haarfarbe und Größe"], merke: "Volkszählungen zeigen Alter, Ein- und Auswanderung (Migration), Pendlerinnen und Pendler, Haushalte (Familiengrößen)." },
      { id: "z-touristin", art: "rf", frage: "Eine 80-jährige Touristin aus Deutschland macht Urlaub in Wien. Sie wird bei der Volkszählung in Österreich mitgezählt.", richtig: false, merke: "Gezählt wird, wer in Österreich seinen Hauptwohnsitz hat. Eine Touristin hat ihn nicht hier." },
    ],
  },
  {
    nr: 6,
    land: "o",
    titel: "Demographie",
    quelle: "Buch S. 8 und 10, M2–M4",
    zettel: [
      "Demographie beschreibt, wie sich die Bevölkerung zusammensetzt und sich im Lauf der Zeit verändert.",
      "Merkmale in der Volkszählung: Geschlecht, Alter, Staatsangehörigkeit (Zugehörigkeit zu einem Staat), Geburtsland, Migrationshintergrund. Auch der jetzige Wohnort wird mit früheren verglichen.",
      "So sieht man die Veränderung und Entwicklung der Bevölkerung: den demographischen Wandel.",
      "Männer 49,3 %, Frauen 50,7 % (M3). Die meisten haben die österreichische Staatsangehörigkeit (M5).",
      "Ausländeranteil Anfang 2024: Österreich 19,6 % (1 891 184). Ausländer = Personen mit Hauptwohnsitz in Österreich ohne österreichische Staatsbürgerschaft.",
      "Höher als der Durchschnitt: Wien 35,4 %, Vorarlberg 20,6 %, Salzburg 20,3 %. Niedriger: Tirol 18,7 %, Oberösterreich 16 %, Steiermark 14,1 %, Kärnten 13,2 %, Niederösterreich 12,2 %, Burgenland 11,4 %.",
      "Altersverteilung 2023 (M3): Österreich 0–19 Jahre 19,3 %, 20–65 Jahre 61,1 %, ab 65 Jahre 19,6 %. Italien: 17,5 %, 58,4 %, 24,1 %. In Italien leben mehr ältere Menschen.",
    ],
    eintraege: [
      { id: "d-def", art: "schreiben", frage: "Die … beschreibt, wie sich die Bevölkerung zusammensetzt und sich im Lauf der Zeit verändert. Wie heißt das Wort?", richtig: "Demographie", auch: ["Demografie"], merke: "Demographie beschreibt, wie sich die Bevölkerung zusammensetzt und sich im Lauf der Zeit verändert." },
      { id: "d-merkmal", art: "wahl", frage: "Welches Merkmal zählt NICHT zur Zusammensetzung der Bevölkerung in der Volkszählung?", richtig: "die Lieblingsfarbe", falsch: ["das Geschlecht", "das Alter", "die Staatsangehörigkeit"], merke: "Merkmale: Geschlecht, Alter, Staatsangehörigkeit, Geburtsland, Migrationshintergrund." },
      { id: "d-wandel", art: "schreiben", frage: "Die Veränderung und Entwicklung der Bevölkerung nennt man den demographischen …", richtig: "Wandel", auch: ["demographischer Wandel", "demografischer Wandel", "demographischen Wandel", "demografischen Wandel"], merke: "Demographischer Wandel: die Veränderung und Entwicklung der Bevölkerung." },
      { id: "d-staat", art: "wahl", frage: "Was bedeutet Staatsangehörigkeit?", richtig: "die Zugehörigkeit zu einem Staat", falsch: ["das Land, in dem man Urlaub macht", "die Sprache, die man spricht", "der Ort, an dem man arbeitet"], merke: "Staatsangehörigkeit = Zugehörigkeit zu einem Staat." },
      { id: "d-anteil", art: "wahl", frage: "Wie hoch war der Ausländeranteil in Österreich Anfang 2024?", richtig: "19,6 %", falsch: ["9,6 %", "35,4 %", "50,7 %"], merke: "Österreich: 19,6 % (1 891 184 Menschen)." },
      { id: "d-hoch", art: "land", frage: "Tippe auf das Bundesland mit dem höchsten Ausländeranteil.", land: "w", merke: "Wien: 35,4 %." },
      { id: "d-tief", art: "land", frage: "Tippe auf das Bundesland mit dem niedrigsten Ausländeranteil.", land: "b", merke: "Burgenland: 11,4 %." },
      { id: "d-v", art: "gruppe", frage: "Ausländeranteil in Vorarlberg: höher oder niedriger als in ganz Österreich (19,6 %)?", land: "v", gruppen: AUSL_GRUPPEN, richtig: AUSL_GRUPPEN[0], merke: "Vorarlberg 20,6 % – höher als der Durchschnitt." },
      { id: "d-t", art: "gruppe", frage: "Ausländeranteil in Tirol: höher oder niedriger als in ganz Österreich (19,6 %)?", land: "t", gruppen: AUSL_GRUPPEN, richtig: AUSL_GRUPPEN[1], merke: "Tirol 18,7 % – knapp niedriger als der Durchschnitt." },
      { id: "d-s", art: "gruppe", frage: "Ausländeranteil in Salzburg: höher oder niedriger als in ganz Österreich (19,6 %)?", land: "s", gruppen: AUSL_GRUPPEN, richtig: AUSL_GRUPPEN[0], merke: "Salzburg 20,3 % – höher als der Durchschnitt." },
      { id: "d-o", art: "gruppe", frage: "Ausländeranteil in Oberösterreich: höher oder niedriger als in ganz Österreich (19,6 %)?", land: "o", gruppen: AUSL_GRUPPEN, richtig: AUSL_GRUPPEN[1], merke: "Oberösterreich 16 % – niedriger als der Durchschnitt." },
      { id: "d-wer", art: "wahl", frage: "Wer gilt als Ausländerin oder Ausländer?", richtig: "wer in Österreich wohnt, aber keine österreichische Staatsbürgerschaft hat", falsch: ["wer im Ausland geboren ist", "wer Urlaub in Österreich macht", "wer eine andere Sprache spricht"], merke: "Ausländer: Personen mit Hauptwohnsitz in Österreich, die nicht die österreichische Staatsbürgerschaft besitzen." },
      { id: "d-it", art: "wahl", frage: "Altersverteilung 2023: Was stimmt beim Vergleich Österreich und Italien?", richtig: "In Italien gibt es mehr ältere Menschen (24,1 % ab 65).", falsch: ["In Italien gibt es mehr junge Menschen.", "Beide Länder sind genau gleich.", "In Österreich gibt es mehr ältere Menschen."], merke: "Ab 65: Italien 24,1 %, Österreich 19,6 %. 0–19: Österreich 19,3 %, Italien 17,5 %." },
      { id: "d-mf", art: "wahl", frage: "Wie viel Prozent der Menschen in Österreich sind Männer?", richtig: "49,3 %", falsch: ["50,7 %", "45 %", "55 %"], merke: "Männer 49,3 %, Frauen 50,7 % (Buch S. 8, M3)." },
    ],
  },
  {
    nr: 7,
    land: "b",
    titel: "Altersaufbaudiagramm",
    quelle: "Buch S. 11 und Arbeitsblatt",
    zettel: [
      "Links die Männer, rechts die Frauen. Die Bevölkerung ist in 5er-Gruppen eingeteilt (0–5, 5–10 …). Die Länge eines Balkens zeigt die Anzahl der Personen.",
      "Analysieren: Strich bei 15 und Strich bei 65. Dann siehst du drei Generationen: die jüngere (0–14), die mittlere (15–65, die Erwerbstätigen) und die ältere (65+).",
      "Nach dem Zweiten Weltkrieg Armut und Hunger. Nach 1955 stiegen die Geburten (Wohlstand). Die „Babyboom-Generation“ ist heute 55 bis 70 Jahre alt.",
      "1963 kamen rund 135 000 Kinder zur Welt, damals lebten 7,18 Mio. Menschen in Österreich.",
      "Ab Ende der 1960er-Jahre wurden weniger Kinder geboren. Seither nehmen die Geburten ab, die 1980er-Jahre sind eine Ausnahme.",
      "In der älteren Generation gibt es mehr Frauen als Männer. Die größte Gruppe: 55–59 Jahre.",
    ],
    eintraege: [
      { id: "a-seite", art: "wahl", frage: "Auf welcher Seite stehen im Altersaufbaudiagramm die Frauen?", richtig: "rechts", falsch: ["links", "oben", "unten"], merke: "Links die Männer, rechts die Frauen." },
      { id: "a-5er", art: "wahl", frage: "Wie viele Jahre umfasst ein Balken?", richtig: "5 Jahre", falsch: ["1 Jahr", "10 Jahre", "20 Jahre"], merke: "Die Bevölkerung wird in 5er-Gruppen eingeteilt." },
      { id: "a-laenge", art: "wahl", frage: "Was zeigt die Länge eines Balkens?", richtig: "die Anzahl der Personen einer Altersgruppe", falsch: ["das Alter der Personen", "das Jahr der Geburt", "wie gesund die Menschen sind"], merke: "Die Länge der Balken zeigt die Anzahl der Personen einer Altersgruppe." },
      { id: "a-du", art: "balken", frage: "Wo bist du? Tippe auf die Altersgruppe 10 bis 14 Jahre (egal welche Seite).", ziel: ["10"], merke: "Deine Altersklasse ist der Balken ab 10 Jahre." },
      { id: "a-gross-m", art: "balken", frage: "Tippe auf die größte Altersgruppe der Männer.", ziel: ["m55"], merke: "Die größte Gruppe: 55 bis 59 Jahre (354 525 Männer, 357 090 Frauen) – die Babyboomer." },
      { id: "a-boom", art: "balken", frage: "Tippe auf einen Balken der Babyboom-Generation (heute 55 bis 70 Jahre).", ziel: ["55", "60", "65"], merke: "Die Babyboomer sind nach 1955 geboren und heute 55 bis 70 Jahre alt." },
      { id: "a-jung", art: "balken", frage: "Tippe auf einen Balken der jüngeren Generation (0 bis 14 Jahre).", ziel: ["0", "5", "10"], merke: "Jüngere Generation: unter dem Strich bei 15." },
      { id: "a-alt", art: "balken", frage: "Tippe auf einen Balken der älteren Generation (65 und älter).", ziel: ["65", "70", "75", "80", "85", "90", "95"], merke: "Ältere Generation: über dem Strich bei 65." },
      { id: "a-frauen", art: "balken", frage: "85 bis 89 Jahre: Tippe auf die Seite mit mehr Menschen.", ziel: ["f85"], merke: "Im Alter gibt es viel mehr Frauen: 87 921 Frauen, 51 901 Männer (85–89)." },
      { id: "a-erwerb", art: "schreiben", frage: "Wie nennt man die Menschen zwischen 15 und 65?", richtig: "Erwerbstätige", auch: ["die Erwerbstätigen", "Erwerbstätigen", "mittlere Generation"], merke: "Menschen zwischen 15 und 65 werden als Erwerbstätige bezeichnet." },
      { id: "a-1955", art: "wahl", frage: "Ab wann stieg die Anzahl der Geburten deutlich an?", richtig: "nach 1955", falsch: ["nach 1918", "nach 1980", "nach 2000"], merke: "Nach 1955 stiegen die Geburten (steigender Wohlstand) – der Babyboom." },
      { id: "a-1963", art: "wahl", frage: "Wie viele Kinder kamen 1963 in Österreich zur Welt?", richtig: "rund 135 000", falsch: ["rund 13 500", "rund 85 000", "rund 1 Million"], merke: "1963: rund 135 000 Kinder, damals 7,18 Mio. Menschen in Österreich." },
      { id: "a-80er", art: "wahl", frage: "Seit Ende der 1960er nehmen die Geburten ab. Welche Jahre sind eine Ausnahme?", richtig: "die 1980er-Jahre", falsch: ["die 1970er-Jahre", "die 1990er-Jahre", "die 2010er-Jahre"], merke: "Die 1980er-Jahre bilden eine Ausnahme." },
      { id: "a-rf1", art: "rf", frage: "Im Altersaufbaudiagramm erkennt man den Babyboom nach 1955.", richtig: true, merke: "Ja: die langen Balken bei 55 bis 70 Jahren." },
      { id: "a-rf2", art: "rf", frage: "In der älteren Generation gibt es mehr Männer als Frauen.", richtig: false, merke: "Falsch: In der älteren Generation gibt es mehr Frauen als Männer." },
      { id: "a-rf3", art: "rf", frage: "Seit 15 Jahren sind die Geburtenzahlen beinahe gleichbleibend.", richtig: true, merke: "Richtig: Die Balken 0–4, 5–9 und 10–14 sind fast gleich lang (rund 210 000 bis 230 000)." },
      { id: "a-rf4", art: "rf", frage: "Zwischen 1970 und 1980 gab es einen starken Geburtenrückgang.", richtig: true, merke: "Richtig: Ab Ende der 1960er wurden deutlich weniger Kinder geboren (Kinderzahl von 2,3 auf 1,6)." },
    ],
  },
  {
    nr: 8,
    land: "n",
    titel: "Die Bevölkerung verändert sich",
    quelle: "Buch S. 12–13",
    zettel: [
      "Älter – bunter – städtischer: die Bevölkerung verändert sich (Überschrift S. 12).",
      "Kinderzahl (M2): 1965 bekam eine Frau im Durchschnitt etwa 2,7 Kinder, heute etwa 1,3 bis 1,5.",
      "Lebenserwartung (M3) steigt: Frauen heute etwa 84 Jahre, Männer etwa 79 Jahre. Frauen leben länger.",
      "Menschen mit nicht-österreichischer Staatsangehörigkeit (M4): 1961 etwa 1,5 %, 2021 etwa 17,5 %.",
      "Forscher: Der Mensch kann höchstens etwa 120 bis 150 Jahre alt werden (eine Studie von 2016 sagte 125).",
      "Landflucht: Menschen verlassen Landgemeinden, um den Lebensmittelpunkt in Städten zu suchen. Besonders betroffen: Randlagen, Alpentäler, Gebiete an der tschechischen und ungarischen Grenze. Folgen: Schulen schließen, öffentliche Verkehrsmittel, Postämter, Polizeiinspektionen und Geschäfte sperren zu.",
      "Bad Großpertholz (Waldviertel): 1961 rund 2 000 Menschen (laut Grafik über 2 300), heute fast halbiert. Arbeit in der Forstwirtschaft fiel weg (1952: 400 Arbeiter, heute 6).",
      "Wolfsthal (bei Bratislava) wächst: Viele Slowakinnen und Slowaken ziehen her – Wohnqualität, niedrigere Grundstückspreise.",
      "Geburtenbilanz = Geburten minus Sterbefälle. Bad Großpertholz 2023: 9 − 18 = −9. Wolfsthal: 12 − 3 = 9. Negativ, wenn mehr Menschen sterben als geboren werden.",
      "Die Bilanz: eine Gegenüberstellung von Zahlen zu einem bestimmten Thema.",
    ],
    eintraege: [
      { id: "v-flucht", art: "schreiben", frage: "Menschen verlassen Landgemeinden, um ihren Lebensmittelpunkt in Städten zu suchen. Wie heißt das?", richtig: "Landflucht", merke: "Landflucht: Menschen verlassen Landgemeinden, um den Lebensmittelpunkt in Städten zu suchen." },
      { id: "v-rand", art: "wahl", frage: "Welche Gebiete sind von Landflucht besonders betroffen?", richtig: "Alpentäler und Gebiete an der tschechischen und ungarischen Grenze", falsch: ["Wien und Graz", "die Gebiete rund um Linz und Salzburg", "Orte direkt an der Autobahn"], merke: "Schwierig ist es an den Randlagen: Alpentäler, Gebiete an der tschechischen und ungarischen Grenze." },
      { id: "v-folgen", art: "wahl", frage: "Was ist KEINE Folge der Landflucht?", richtig: "Es werden neue Schulen gebaut.", falsch: ["Schulen schließen.", "Öffentliche Verkehrsmittel werden eingestellt.", "Postämter und Geschäfte sperren zu."], merke: "Folgen: Schulen schließen, Verkehrsmittel werden eingestellt, Postämter, Polizeiinspektionen und Geschäfte sperren zu." },
      { id: "v-bilanz", art: "schreiben", frage: "Geburten minus Sterbefälle: Wie heißt diese Zahl?", richtig: "Geburtenbilanz", merke: "Geburtenbilanz = Geburten − Sterbefälle." },
      { id: "v-bgp", art: "zahl", frage: "Bad Großpertholz 2023: 9 Geburten, 18 Sterbefälle. Wie groß ist die Geburtenbilanz?", richtig: -9, merke: "9 − 18 = −9. Die Bilanz ist negativ." },
      { id: "v-wolf", art: "zahl", frage: "Wolfsthal 2023: 12 Geburten, 3 Sterbefälle. Wie groß ist die Geburtenbilanz?", richtig: 9, merke: "12 − 3 = 9. Die Bilanz ist positiv." },
      { id: "v-negativ", art: "wahl", frage: "Wann ist die Geburtenbilanz negativ?", richtig: "wenn mehr Menschen sterben als geboren werden", falsch: ["wenn mehr Kinder geboren werden als Menschen sterben", "wenn Menschen wegziehen", "wenn gleich viele geboren werden wie sterben"], merke: "Negativ: mehr Sterbefälle als Geburten." },
      { id: "v-bilanz-def", art: "wahl", frage: "Was ist eine Bilanz?", richtig: "eine Gegenüberstellung von Zahlen zu einem bestimmten Thema", falsch: ["eine Karte mit allen Gemeinden", "eine Zählung mit Formular", "ein Diagramm mit Balken für Männer und Frauen"], merke: "Die Bilanz: eine Gegenüberstellung von Zahlen zu einem bestimmten Thema." },
      { id: "v-kinder65", art: "wahl", frage: "Wie viele Kinder bekam eine Frau 1965 im Durchschnitt?", richtig: "etwa 2,7", falsch: ["etwa 1,3", "etwa 4,5", "etwa 1,0"], merke: "1965 etwa 2,7 Kinder pro Frau, heute etwa 1,3 bis 1,5 (M2)." },
      { id: "v-kinder-heute", art: "wahl", frage: "Wie viele Kinder bekommt eine Frau heute im Durchschnitt?", richtig: "etwa 1,3 bis 1,5", falsch: ["etwa 2,7", "etwa 3", "etwa 0,5"], merke: "Heute etwa 1,3 bis 1,5 Kinder pro Frau (M2)." },
      { id: "v-leben", art: "rf", frage: "Frauen haben in Österreich eine höhere Lebenserwartung als Männer.", richtig: true, merke: "Richtig: Frauen etwa 84 Jahre, Männer etwa 79 Jahre (M3). Beide Werte steigen." },
      { id: "v-leben-zahl", art: "wahl", frage: "Wie hoch ist die Lebenserwartung von Frauen heute etwa?", richtig: "etwa 84 Jahre", falsch: ["etwa 73 Jahre", "etwa 79 Jahre", "etwa 95 Jahre"], merke: "Frauen etwa 84 Jahre, Männer etwa 79 Jahre (1965: Frauen 73, Männer 67)." },
      { id: "v-auslaender", art: "wahl", frage: "Anteil der Menschen mit nicht-österreichischer Staatsangehörigkeit: Wie hat er sich von 1961 bis 2021 verändert?", richtig: "von etwa 1,5 % auf etwa 17,5 %", falsch: ["von etwa 17,5 % auf etwa 1,5 %", "er ist gleich geblieben", "von etwa 10 % auf etwa 12 %"], merke: "1961 etwa 1,5 %, 2021 etwa 17,5 % (M4): die Bevölkerung wird „bunter“." },
      { id: "v-bunter", art: "wahl", frage: "„Älter – bunter – städtischer“: Was heißt „bunter“?", richtig: "Mehr Menschen haben eine nicht-österreichische Staatsangehörigkeit.", falsch: ["Die Häuser werden bunter angemalt.", "Es gibt mehr Feste.", "Es werden mehr Kinder geboren."], merke: "Bunter: mehr Menschen mit anderer Staatsangehörigkeit (M4)." },
      { id: "v-alter", art: "wahl", frage: "Wie alt kann der Mensch laut Forschern höchstens werden?", richtig: "etwa 120 bis 150 Jahre", falsch: ["etwa 100 Jahre", "etwa 200 Jahre", "es gibt kein Ende, man stirbt nie"], merke: "Nach Berechnungen der Forscher 120 bis 150 Jahre (Studie 2016: 125 Jahre)." },
      { id: "v-wolf-grund", art: "wahl", frage: "Warum ziehen viele Menschen aus Bratislava nach Wolfsthal?", richtig: "wegen der Wohnqualität und niedrigerer Grundstückspreise", falsch: ["weil es dort mehr Fabriken gibt", "weil dort die Schulen schließen", "weil es dort einen Flughafen gibt"], merke: "Wolfsthal wächst: Wohnqualität, die Grundstückspreise sind niedriger als in Bratislava." },
      { id: "v-bgp-grund", art: "wahl", frage: "Warum leben in Bad Großpertholz heute viel weniger Menschen?", richtig: "Die Arbeit in der Forstwirtschaft, in Sägewerken und Textilfabriken fiel weg.", falsch: ["Ein Hochwasser hat den Ort zerstört.", "Die Menschen sind alle nach Bratislava gezogen.", "Der Ort ist zu nahe an Wien."], merke: "1952 arbeiteten 400 Menschen im Forstbetrieb, heute 6. Sägewerke und Textilindustrie gibt es nicht mehr." },
      { id: "v-fehler-sandner", art: "wahl", frage: "Frau Sandner sagt: 1961 lebten 2 000 Menschen in Bad Großpertholz. Was zeigt die Grafik M7?", richtig: "Es waren mehr, über 2 300.", falsch: ["Es waren genau 2 000.", "Es waren nur 1 300.", "Es waren 500."], merke: "Laut Grafik lebten 1961 über 2 300 Menschen in Bad Großpertholz." },
      { id: "v-fehler-habaj", art: "wahl", frage: "Herr Habaj sagt: Wolfsthal wuchs 2011 bis 2021 von 500 auf 1 000. Was zeigt die Grafik M7?", richtig: "Es waren 2011 schon über 800, 2021 über 1 200.", falsch: ["Es stimmt genau.", "Wolfsthal ist geschrumpft.", "Es waren 2021 über 2 000."], merke: "Laut Grafik: 2011 etwa 850, 2021 etwa 1 250 Einwohner." },
    ],
  },
  {
    nr: 9,
    land: "w",
    titel: "Endgegner Wien",
    quelle: "Alles gemischt, wie im Test",
    zettel: [],
    eintraege: [],
  },
];

/** Andere Schreibweisen der Hauptstadt eines Bundeslandes. */
function LAND_AUCH(id: LandId): string[] {
  return id === "n" ? ["Sankt Pölten", "St Pölten", "St.Pölten"] : id === "k" ? ["Klagenfurt am Wörthersee"] : [];
}
