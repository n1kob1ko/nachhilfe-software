/**
 * The cases of the KI-Qualitätstest: 20 lessons as they happen in tutoring, from the Volksschule to the
 * Oberstufe, plus comparisons for speed and model. All data is invented: skills, learning data without a
 * name, and the student texts for the Textkorrektur (written for this test, with known errors and with
 * correct Austrian forms that must not be marked).
 */
import type { Difficulty } from "../curriculum";
import type { Aspect, TextType } from "../lesen";
import { WORTARTEN_SKILL } from "../wortarten";
import type { AIOverride } from "./router";

export type QSkill = { id: string; name: string; area: string; difficulty: Difficulty };
export type QGroup = "Volksschule" | "Unterstufe" | "Oberstufe" | "Tempo" | "Modell";

type Base = {
  /** "01" … "20" for the lessons, "T1" … for speed, "M1" … for model comparisons */
  nr: string;
  group: QGroup;
  title: string;
  subject: string;
  schoolType: string;
  klasse: number;
  /** what differs from the app's settings (speed and model comparisons) */
  variant?: string;
  override?: Omit<AIOverride, "tag" | "onUsage">;
};

/** An exercise from the Übungs-Builder: the plan of task types, as the builder makes it. */
export type ExerciseCase = Base & {
  kind: "aufgaben";
  skills: QSkill[];
  plan: string[];
  studentContext?: string;
  focusNote?: string;
  /** 2 like the builder (missing tasks are asked for once more); 1 for comparisons */
  rounds?: 1 | 2;
  /** one request per task, all at once (speed comparison) */
  split?: boolean;
};

/** „Passende Aufgabe senden“ during a unit: two tasks, sent to the student without the teacher's look. */
export type NachschubCase = Base & { kind: "nachschub"; skill: QSkill; studentContext?: string; focusNote?: string };

/** Leseverständnis: a new text, then questions by plan. */
export type ReadingCase = Base & { kind: "lesen"; topic: string; textType: TextType; difficulty: Difficulty; words: number; aspects: Aspect[]; cloze: boolean; mc: boolean };

/** found when a finding quotes `wrong` and its replacement contains one of `right` */
export type KnownError = { wrong: string; right: string[]; what: string };

/** Textkorrektur of an invented student text. */
export type TextCase = Base & {
  kind: "text";
  textKind: string;
  task: string;
  blocks: { text: string; heading: boolean }[];
  pictures?: { count: number; captions: string[] };
  known: KnownError[];
  /** correct places (Austrian forms, optional commas …) that must not be marked as errors */
  traps: string[];
};

export type QCase = ExerciseCase | NachschubCase | ReadingCase | TextCase;

const ctx = (lines: string[]) => lines.join("\n");

// ---------- Volksschule ----------

const C01: ExerciseCase = {
  nr: "01",
  group: "Volksschule",
  title: "Wortarten: Nomen, Verben, Adjektive",
  kind: "aufgaben",
  subject: "Deutsch",
  schoolType: "Volksschule",
  klasse: 3,
  skills: [{ id: WORTARTEN_SKILL, name: "Wortarten bestimmen", area: "Wortarten", difficulty: "leicht" }],
  plan: ["wortarten", "wortarten", "wortarten", "wortarten", "wortarten"],
};

const RS_SKILLS: QSkill[] = [
  { id: "deutsch.rechtschreibung.doppelkonsonant", name: "Doppelter Mitlaut nach kurzem Selbstlaut (Mitlautverdopplung)", area: "Rechtschreibung", difficulty: "mittel" },
  { id: "deutsch.rechtschreibung.dehnung", name: "Dehnung: ie, Dehnungs-h, doppelter Selbstlaut", area: "Rechtschreibung", difficulty: "mittel" },
  { id: "deutsch.rechtschreibung.verlaengern", name: "Verlängern: d/t, b/p, g/k am Wortende", area: "Rechtschreibung", difficulty: "mittel" },
];
const C02: ExerciseCase = {
  nr: "02",
  group: "Volksschule",
  title: "Rechtschreibung: Doppelkonsonanten, Dehnung, Verlängern",
  kind: "aufgaben",
  subject: "Deutsch",
  schoolType: "Volksschule",
  klasse: 4,
  skills: RS_SKILLS,
  plan: ["rechtschreibung", "lueckentext", "korrigieren", "rechtschreibung", "fehler"],
  studentContext: ctx([
    "Schulart: Volksschule, 4. Klasse (Schulstufe 4)",
    "Fach: Deutsch · Thema: Rechtschreibung",
    "Lernstand (skill_id: Fähigkeit – Wert 0–1, Status):",
    "- deutsch.rechtschreibung.doppelkonsonant: Doppelter Mitlaut – 0.45, unsicher",
    "- deutsch.rechtschreibung.dehnung: Dehnung – 0.7, wird sicherer",
    "- deutsch.rechtschreibung.verlaengern: Verlängern – 0.4, unsicher",
    "Typische Fehler: Doppelter Mitlaut vergessen (komen, Stal) (6×), d/t am Wortende verwechselt (Hunt, Walt) (4×)",
  ]),
};

const C03A: ExerciseCase = {
  nr: "03a",
  group: "Volksschule",
  title: "Bildgeschichte: Aufgabenstellung und Satzanfänge",
  kind: "aufgaben",
  subject: "Deutsch",
  schoolType: "Volksschule",
  klasse: 3,
  skills: [{ id: "deutsch.schreiben.bildgeschichte", name: "Bildgeschichte schreiben", area: "Schreiben", difficulty: "mittel" }],
  plan: ["schreiben", "schreiben"],
  focusNote:
    "Bildgeschichte mit 4 Bildern (Beschreibung der Lehrkraft: 1. Zwei Kinder bauen im Garten einen Schneemann. 2. Ein Hund läuft mit der Karottennase davon. 3. Die Kinder laufen dem Hund nach. 4. Der Schneemann bekommt eine Nase aus einem Tannenzapfen.) Aufgabe 1: die ganze Geschichte schreiben, Aufgabe 2: nur zu Bild 2 und 3 drei bis vier Sätze. Gib altersgerechte Satzanfänge als Hilfe.",
};

const C03B: TextCase = {
  nr: "03b",
  group: "Volksschule",
  title: "Bildgeschichte: Korrektur mit Bildbeschreibungen",
  kind: "text",
  subject: "Deutsch",
  schoolType: "Volksschule",
  klasse: 3,
  textKind: "Bildgeschichte",
  task: "Schreibe eine Geschichte zu den vier Bildern.",
  pictures: {
    count: 4,
    captions: [
      "Zwei Kinder bauen im Garten einen Schneemann mit einer Karotte als Nase.",
      "Ein Hund schnappt sich die Karotte und läuft davon.",
      "Die Kinder laufen dem Hund nach.",
      "Der Schneemann bekommt eine Nase aus einem Tannenzapfen.",
    ],
  },
  blocks: [
    { text: "Der Schneeman", heading: true },
    {
      text: "Lena und Tim bauten im Garten einen Schneeman. Als Nase bekam er eine Karotte. Da kommt der Hund und schnapte sich die Karotte. Die kinder liefen dem Hund hinterher, aber er war viel schneler. Dan fand Tim unter dem Baum einen Tannenzapfen. Jetzt hatte der Schneemann eine neue Nase und alle lachten.",
      heading: false,
    },
  ],
  known: [
    { wrong: "Schneeman", right: ["Schneemann"], what: "Schneeman → Schneemann (Überschrift oder Text)" },
    { wrong: "kommt", right: ["kam"], what: "kommt → kam (einheitliche Vergangenheit)" },
    { wrong: "schnapte", right: ["schnappte"], what: "schnapte → schnappte" },
    { wrong: "kinder", right: ["Kinder"], what: "kinder → Kinder" },
    { wrong: "schneler", right: ["schneller"], what: "schneler → schneller" },
    { wrong: "Dan", right: ["Dann"], what: "Dan → Dann" },
  ],
  traps: ["Lena und Tim", "Tannenzapfen", "hinterher"],
};

const C04: ExerciseCase = {
  nr: "04",
  group: "Volksschule",
  title: "Mathematik: Sachaufgaben mit den Grundrechnungsarten",
  kind: "aufgaben",
  subject: "Mathematik",
  schoolType: "Volksschule",
  klasse: 4,
  skills: [
    { id: "mathe.vs.sachaufgaben", name: "Sachaufgaben mit den vier Grundrechnungsarten (Zahlenraum 10 000, Geld, Zeit)", area: "Sachrechnen", difficulty: "mittel" },
    { id: "mathe.vs.schriftlich", name: "Schriftlich multiplizieren und dividieren durch einstellige Zahlen", area: "Rechnen", difficulty: "mittel" },
  ],
  plan: ["sachaufgabe", "textaufgabe", "sachaufgabe", "rechenweg", "textaufgabe"],
  studentContext: ctx([
    "Schulart: Volksschule, 4. Klasse (Schulstufe 4)",
    "Fach: Mathematik · Thema: Sachrechnen",
    "Lernstand (skill_id: Fähigkeit – Wert 0–1, Status):",
    "- mathe.vs.sachaufgaben: Sachaufgaben – 0.5, unsicher",
    "- mathe.vs.schriftlich: Schriftlich rechnen – 0.8, sicher",
    "Typische Fehler: Falsche Rechenart gewählt (multipliziert statt dividiert) (5×), Einheit vergessen (3×)",
  ]),
};

const C05: ReadingCase = {
  nr: "05",
  group: "Volksschule",
  title: "Leseverständnis: kurzer Text, verschiedene Fragen",
  kind: "lesen",
  subject: "Deutsch",
  schoolType: "Volksschule",
  klasse: 3,
  topic: "Ein Igel sucht im Herbst einen Platz für den Winterschlaf",
  textType: "erzaehlung",
  difficulty: "leicht",
  words: 170,
  aspects: ["info", "info", "wort", "zusammenhang", "schluss"],
  cloze: true,
  mc: true,
};

const C06: TextCase = {
  nr: "06",
  group: "Volksschule",
  title: "Textkorrektur: Volksschulaufsatz mit eingebauten Fehlern",
  kind: "text",
  subject: "Deutsch",
  schoolType: "Volksschule",
  klasse: 4,
  textKind: "Erlebniserzählung",
  task: "Erzähle von einem Ausflug mit deiner Klasse.",
  blocks: [
    { text: "Unser Ausflug zum Bauernhof", heading: true },
    { text: "Letzten Donnerstag ist unsere Klasse mit dem Bus zu einem Bauernhof gefahren. dort hat uns die Bäuerin zuerst den Stal gezeigt. Da waren viele kühe und ein kleines Kalb. Das Kalb hat mich an der Hand abgeschleckt, das hat gekitzelt.", heading: false },
    { text: "Danach durften wir die Hüner füttern. Ein groser Hahn ist laut krähend herumgelaufen. Meine Freundin hat sich so erschrocken, dass sie fast in eine Pfütze gefallen wäre. Alle haben gelacht und sie hat auch gelacht.", heading: false },
    { text: "Zu Mittag haben wir auf der Wiese unsere Jause gegessen. Ich hatte ein Brot mit Paradeisern und einen Apfel im Sackerl. Dann gehen wir noch durch den Walt zum Bach. Dort haben wir einen Frosch gesehen Er ist ins Wasser gesprungen.", heading: false },
    { text: "Am Nachmittag sind wir entlich wieder nach hause gefahren. Der Ausflug hat fiel spaß gemacht und ich möchte heuer noch einmal hinfahren.", heading: false },
  ],
  known: [
    { wrong: "dort", right: ["Dort"], what: "dort → Dort (Satzanfang)" },
    { wrong: "Stal", right: ["Stall"], what: "Stal → Stall" },
    { wrong: "kühe", right: ["Kühe"], what: "kühe → Kühe" },
    { wrong: "Hüner", right: ["Hühner"], what: "Hüner → Hühner" },
    { wrong: "groser", right: ["großer"], what: "groser → großer" },
    { wrong: "gehen", right: ["gingen", "gegangen"], what: "gehen → gingen/sind gegangen (Zeitform)" },
    { wrong: "Walt", right: ["Wald"], what: "Walt → Wald" },
    { wrong: "gesehen Er", right: ["gesehen. Er", "gesehen, er"], what: "fehlender Punkt nach „gesehen“" },
    { wrong: "entlich", right: ["endlich"], what: "entlich → endlich" },
    { wrong: "hause", right: ["Hause"], what: "nach hause → nach Hause" },
    { wrong: "fiel", right: ["viel"], what: "fiel → viel" },
    { wrong: "spaß", right: ["Spaß"], what: "spaß → Spaß" },
  ],
  traps: ["abgeschleckt", "Jause", "Paradeisern", "Sackerl", "heuer", "Zu Mittag", "dass sie fast"],
};

// ---------- Unterstufe ----------

const C07: ExerciseCase = {
  nr: "07",
  group: "Unterstufe",
  title: "Bruchrechnen mit nachvollziehbaren Lösungen",
  kind: "aufgaben",
  subject: "Mathematik",
  schoolType: "Mittelschule",
  klasse: 2,
  skills: [
    { id: "mathe.brueche.addieren", name: "Ungleichnamige Brüche addieren und subtrahieren", area: "Brüche", difficulty: "mittel" },
    { id: "mathe.brueche.multiplizieren", name: "Brüche multiplizieren und dividieren", area: "Brüche", difficulty: "mittel" },
  ],
  plan: ["rechnung", "rechenweg", "sachaufgabe", "fehler", "rechenweg"],
  studentContext: ctx([
    "Schulart: Mittelschule, 2. Klasse (Schulstufe 6)",
    "Fach: Mathematik · Thema: Brüche",
    "Lernstand (skill_id: Fähigkeit – Wert 0–1, Status):",
    "- mathe.brueche.addieren: Ungleichnamige Brüche addieren – 0.35, unsicher",
    "- mathe.brueche.multiplizieren: Brüche multiplizieren – 0.75, wird sicherer",
    "Typische Fehler: Zähler und Nenner getrennt addiert (1/2 + 1/3 = 2/5) (7×), Ergebnis nicht gekürzt (3×)",
    "Prüfung in 9 Tagen, Stoff: Bruchrechnen",
  ]),
};

const GL_SKILLS: QSkill[] = [
  { id: "mathe.gleichungen.einfach", name: "Einfache lineare Gleichungen", area: "Gleichungen", difficulty: "mittel" },
  { id: "mathe.gleichungen.klammern", name: "Gleichungen mit Klammern", area: "Gleichungen", difficulty: "mittel" },
  { id: "mathe.gleichungen.text", name: "Textaufgaben mit Gleichungen", area: "Gleichungen", difficulty: "mittel" },
];
const C08: ExerciseCase = {
  nr: "08",
  group: "Unterstufe",
  title: "Gleichungen mit unterschiedlichen Rechenwegen",
  kind: "aufgaben",
  subject: "Mathematik",
  schoolType: "Mittelschule",
  klasse: 3,
  skills: GL_SKILLS,
  plan: ["rechenweg", "rechenweg", "rechenweg", "textaufgabe", "ordnen"],
};

const C09: ExerciseCase = {
  nr: "09",
  group: "Unterstufe",
  title: "Prozentrechnung mit Sachaufgaben",
  kind: "aufgaben",
  subject: "Mathematik",
  schoolType: "Mittelschule",
  klasse: 3,
  skills: [
    { id: "mathe.prozent.prozentwert", name: "Prozentwert berechnen", area: "Prozentrechnung", difficulty: "mittel" },
    { id: "mathe.prozent.prozentsatz", name: "Prozentsatz berechnen", area: "Prozentrechnung", difficulty: "mittel" },
    { id: "mathe.prozent.grundwert", name: "Grundwert berechnen", area: "Prozentrechnung", difficulty: "mittel" },
  ],
  plan: ["sachaufgabe", "rechnung", "textaufgabe", "rechenweg", "mc"],
};

const C10: ExerciseCase = {
  nr: "10",
  group: "Unterstufe",
  title: "Geometrie: Fläche, Umfang, Winkel",
  kind: "aufgaben",
  subject: "Mathematik",
  schoolType: "Mittelschule",
  klasse: 2,
  skills: [
    { id: "mathe.geometrie.flaeche", name: "Flächeninhalt und Umfang von Rechteck, Dreieck und Parallelogramm", area: "Geometrie", difficulty: "mittel" },
    { id: "mathe.geometrie.winkel", name: "Winkelsumme im Dreieck und Viereck", area: "Geometrie", difficulty: "mittel" },
  ],
  plan: ["rechnung", "sachaufgabe", "textaufgabe", "mc", "rechenweg"],
};

const C11: ExerciseCase = {
  nr: "11",
  group: "Unterstufe",
  title: "Wortarten mit allen gelernten Wortarten",
  kind: "aufgaben",
  subject: "Deutsch",
  schoolType: "Mittelschule",
  klasse: 2,
  skills: [{ id: WORTARTEN_SKILL, name: "Wortarten bestimmen", area: "Wortarten", difficulty: "mittel" }],
  plan: ["wortarten", "wortarten", "wortarten", "wortarten", "wortarten"],
};

const C12: ExerciseCase = {
  nr: "12",
  group: "Unterstufe",
  title: "Grammatik und Zeitformen",
  kind: "aufgaben",
  subject: "Deutsch",
  schoolType: "Mittelschule",
  klasse: 2,
  skills: [
    { id: "deutsch.grammatik.zeiten", name: "Zeitformen: Präsens, Präteritum, Perfekt, Plusquamperfekt, Futur", area: "Grammatik", difficulty: "mittel" },
    { id: "deutsch.grammatik.faelle", name: "Die vier Fälle bestimmen und richtig verwenden", area: "Grammatik", difficulty: "mittel" },
  ],
  plan: ["grammatik", "lueckentext", "korrigieren", "grammatik", "satz"],
};

const C13: ReadingCase = {
  nr: "13",
  group: "Unterstufe",
  title: "Leseverständnis: längerer Text, offene Fragen",
  kind: "lesen",
  subject: "Deutsch",
  schoolType: "Mittelschule",
  klasse: 3,
  topic: "Zwei Freundinnen streiten wegen einer Nachricht im Klassenchat",
  textType: "kurzgeschichte",
  difficulty: "mittel",
  words: 400,
  aspects: ["info", "zusammenhang", "wort", "beleg", "schluss", "zusammenfassen", "begruenden"],
  cloze: true,
  mc: false,
};

const C14: ExerciseCase = {
  nr: "14",
  group: "Unterstufe",
  title: "Englisch: Grammatik und kurze Schreibaufgabe",
  kind: "aufgaben",
  subject: "Englisch",
  schoolType: "Gymnasium",
  klasse: 2,
  skills: [
    { id: "englisch.tenses.pastsimple", name: "Past simple: regular and irregular verbs", area: "Tenses", difficulty: "mittel" },
    { id: "englisch.tenses.presentperfect", name: "Present perfect vs. past simple", area: "Tenses", difficulty: "mittel" },
    { id: "englisch.writing.email", name: "Short e-mail to a friend", area: "Writing", difficulty: "mittel" },
  ],
  plan: ["grammar", "gap", "korrigieren", "grammar", "writing"],
};

// ---------- Oberstufe ----------

const OS_MATHE: QSkill[] = [
  { id: "mathe.os.quadratisch", name: "Quadratische Gleichungen lösen (kleine und große Lösungsformel)", area: "Gleichungen", difficulty: "mittel" },
  { id: "mathe.os.linear", name: "Lineare Funktionen: Steigung, Achsenabschnitt, Funktionsgleichung aus zwei Punkten", area: "Funktionen", difficulty: "mittel" },
  { id: "mathe.os.gleichungssystem", name: "Lineare Gleichungssysteme mit zwei Variablen", area: "Gleichungen", difficulty: "mittel" },
];
const C15: ExerciseCase = {
  nr: "15",
  group: "Oberstufe",
  title: "Anspruchsvollere Gleichungen und Funktionen",
  kind: "aufgaben",
  subject: "Mathematik",
  schoolType: "Gymnasium",
  klasse: 5,
  skills: OS_MATHE,
  plan: ["rechenweg", "rechenweg", "rechnung", "sachaufgabe", "mc"],
};

const SACH_OS: QSkill[] = [
  { id: "mathe.os.exponentiell", name: "Exponentielles Wachstum und exponentielle Abnahme", area: "Funktionen", difficulty: "schwer" },
  { id: "mathe.os.zinseszins", name: "Zinseszins und Ratenvergleich", area: "Finanzmathematik", difficulty: "schwer" },
];
const C16: ExerciseCase = {
  nr: "16",
  group: "Oberstufe",
  title: "Mathematik: mehrteilige Sachaufgabe",
  kind: "aufgaben",
  subject: "Mathematik",
  schoolType: "Gymnasium",
  klasse: 6,
  skills: SACH_OS,
  plan: ["sachaufgabe", "sachaufgabe", "sachaufgabe"],
};

const C17: ReadingCase = {
  nr: "17",
  group: "Oberstufe",
  title: "Deutsch: Textinterpretation mit Analyseaufträgen",
  kind: "lesen",
  subject: "Deutsch",
  schoolType: "Gymnasium",
  klasse: 7,
  topic: "Eine junge Frau kehrt nach Jahren in ihr Heimatdorf zurück und trifft dort ihre frühere Lehrerin",
  textType: "kurzgeschichte",
  difficulty: "schwer",
  words: 550,
  aspects: ["zusammenhang", "beleg", "wort", "schluss", "zusammenfassen", "begruenden"],
  cloze: false,
  mc: false,
};

const C18: ExerciseCase = {
  nr: "18",
  group: "Oberstufe",
  title: "Deutsch: Argumentation und Kommentar",
  kind: "aufgaben",
  subject: "Deutsch",
  schoolType: "Gymnasium",
  klasse: 6,
  skills: [
    { id: "deutsch.schreiben.kommentar", name: "Kommentar schreiben", area: "Schreiben", difficulty: "mittel" },
    { id: "deutsch.schreiben.argumentieren", name: "Argumentieren: Behauptung, Begründung, Beispiel", area: "Schreiben", difficulty: "mittel" },
  ],
  plan: ["schreiben", "offen", "korrigieren", "offen"],
};

const C19: ReadingCase = {
  nr: "19",
  group: "Oberstufe",
  title: "Englisch: längeres Leseverständnis, offene Fragen",
  kind: "lesen",
  subject: "Englisch",
  schoolType: "Gymnasium",
  klasse: 6,
  topic: "A small town that closed its centre to cars: what changed for shops, families and young people",
  textType: "zeitungsartikel",
  difficulty: "mittel",
  words: 450,
  aspects: ["info", "zusammenhang", "wort", "beleg", "schluss", "begruenden"],
  cloze: false,
  mc: false,
};

const C20: TextCase = {
  nr: "20",
  group: "Oberstufe",
  title: "Textkorrektur: längerer Aufsatz",
  kind: "text",
  subject: "Deutsch",
  schoolType: "Gymnasium",
  klasse: 7,
  textKind: "Kommentar (Erörterung)",
  task: "Verfasse einen Kommentar zum Handyverbot an deiner Schule (ca. 350 Wörter).",
  blocks: [
    { text: "Handyverbot an Schulen – sinnvoll oder überholt?", heading: true },
    { text: "Seid Beginn dieses Schuljahres gilt an unserer Schule ein striktes Handyverbot. Viele Schülerinnen und Schüler ärgern sich darüber, weil sie das Gefühl haben, das man ihnen nicht vertraut. In diesem Kommentar möchte ich erläutern, warum ich das Verbot trotzdem für sinnvoll halte.", heading: false },
    {
      text: "Zunächst fördert ein Handyverbot die Konzentration im Unterricht. Wer ständig mit den Handy beschäftigt ist, kann den Erklärungen der Lehrkräfte kaum folgen. Studien zeigen, dass bereits die bloße Anwesenheit eines Smartphones die Aufmerksamkeit senkt. Für viele ist ständige Erreichbarkeit zwar Standart, gerade vor einer Schularbeit oder der Matura ist es aber wichtig sich voll auf den Stoff zu konzentrieren.",
      heading: false,
    },
    {
      text: "Außerdem verbessert sich das soziale Klima. Früher haben in den Pausen fast alle nur auf ihre Bildschirme gestarrt, heute reden die Jugendlichen wieder miteinander, spielen Tischtennis oder holen sich gemeinsam eine Jause beim Buffet. Die meisten Schüler aus meiner Klasse ist inzwischen sogar froh darüber. Die Pausen sind nähmlich viel lustiger geworden, seit niemand mehr ständig aufs Handy schaut.",
      heading: false,
    },
    {
      text: "Natürlich gibt es auch Gegenargumente. Manche Eltern wollen ihre Kinder jederzeit erreichen können, zum Beispiel wenn sich der Stundenplan kurzfristig ändert. Dieses Problem lässt sich jedoch leicht lösen, in dringenden Fällen kann man im Sekretariat anrufen. Auch das Argument, dass man das Handy zum Lernen braucht, überzeugt mich nicht, weil zuhause kann man es ohnehin genug benutzen. Das ist halt einfach so.",
      heading: false,
    },
    {
      text: "Wegen dem großen Nutzen für die Konzentration und die Gemeinschaft bin ich der Meinung, das das Handyverbot beibehalten werden soll. Wichtig wäre aber, das man die Schülerinnen und Schüler in die Gestaltung der Regeln einbezieht. Im allgemeinen akzeptieren wir Regeln viel eher, wenn wir selbst mitreden dürfen. Im Jänner wird darüber im Schulgemeinschaftsausschuss abgestimmt, und ich hoffe dass heuer eine faire Lösung gefunden wird.",
      heading: false,
    },
  ],
  known: [
    { wrong: "Seid", right: ["Seit"], what: "Seid → Seit" },
    { wrong: "das man ihnen", right: ["dass man"], what: "das man → dass man (Absatz 2)" },
    { wrong: "den Handy", right: ["dem Handy"], what: "mit den Handy → mit dem Handy (Dativ)" },
    { wrong: "Standart", right: ["Standard"], what: "Standart → Standard" },
    { wrong: "wichtig sich", right: ["wichtig, sich"], what: "Beistrich vor Infinitivgruppe mit Verweiswort „es“" },
    { wrong: "ist inzwischen", right: ["sind inzwischen", "sind"], what: "Die meisten Schüler … ist → sind (Kongruenz)" },
    { wrong: "nähmlich", right: ["nämlich"], what: "nähmlich → nämlich" },
    { wrong: "kann man es", right: ["benutzen kann"], what: "weil + Verbzweitstellung → „weil man es zuhause … benutzen kann“" },
    { wrong: "halt", right: [""], what: "„halt“: Umgangssprache im Kommentar (Ausdruck)" },
    { wrong: "Wegen dem großen Nutzen", right: ["Wegen des großen Nutzens"], what: "wegen dem → wegen des … Nutzens (Genitiv)" },
    { wrong: "das das", right: ["dass das"], what: "das das → dass das" },
    { wrong: "das man die", right: ["dass man"], what: "das man → dass man (Absatz 6)" },
    { wrong: "Im allgemeinen", right: ["Im Allgemeinen"], what: "im allgemeinen → im Allgemeinen" },
    { wrong: "hoffe dass", right: ["hoffe, dass"], what: "Beistrich vor „dass“" },
  ],
  traps: ["Jause", "Buffet", "Matura", "Schularbeit", "zuhause", "Jänner", "heuer", "abgestimmt, und", "leicht lösen, in dringenden", "zum Beispiel wenn", "Schulgemeinschaftsausschuss"],
};

/** The 20 lessons, in the order of the request (row 3 has two parts: the task and the correction). */
export const LESSONS: QCase[] = [C01, C02, C03A, C03B, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13, C14, C15, C16, C17, C18, C19, C20];

// ---------- speed: the same lesson with other settings ----------

const NACHSCHUB: NachschubCase = {
  nr: "T6",
  group: "Tempo",
  title: "„Passende Aufgabe senden“ in der Einheit (Brüche)",
  variant: "wie in der App",
  kind: "nachschub",
  subject: "Mathematik",
  schoolType: "Mittelschule",
  klasse: 2,
  skill: { id: "mathe.brueche.addieren", name: "Ungleichnamige Brüche addieren und subtrahieren", area: "Brüche", difficulty: "mittel" },
  studentContext: C07.studentContext,
  focusNote: "Gezielt üben: Zähler und Nenner getrennt addiert",
};

export const SPEED: QCase[] = [
  { ...C08, nr: "T1", group: "Tempo", variant: "ohne Nachdenken (thinking aus)", override: { thinking: "aus" } },
  { ...C08, nr: "T2", group: "Tempo", variant: "weniger Nachdenken (effort low)", override: { effort: "low" } },
  { ...C08, nr: "T3", group: "Tempo", variant: "eine Anfrage je Aufgabe, gleichzeitig", split: true },
  { ...C02, nr: "T4", group: "Tempo", variant: "ohne Nachdenken (thinking aus)", override: { thinking: "aus" } },
  { ...C02, nr: "T5", group: "Tempo", variant: "eine Anfrage je Aufgabe, gleichzeitig", split: true },
  NACHSCHUB,
  { ...NACHSCHUB, nr: "T7", variant: "ohne Nachdenken (thinking aus)", override: { thinking: "aus" } },
  { ...C07, nr: "T8", group: "Tempo", title: "Arbeitsblatt mit 10 Aufgaben (Standardanzahl im Builder)", variant: "10 Aufgaben wie in der App", plan: ["rechnung", "rechenweg", "sachaufgabe", "fehler", "rechenweg", "rechnung", "textaufgabe", "rechenweg", "mc", "rechnung"] },
];

// ---------- model: a stronger or a cheaper model on the hardest lessons ----------

export const MODELS: QCase[] = [
  { ...C15, nr: "M1", group: "Modell", variant: "Sonnet 5.5 statt Haiku 5.5, eine Runde", override: { model: "anthropic/claude-sonnet-5.5" }, rounds: 1 },
  { ...C16, nr: "M2", group: "Modell", variant: "Sonnet 5.5 statt Haiku 5.5, eine Runde", override: { model: "anthropic/claude-sonnet-5.5" }, rounds: 1 },
  { ...C20, nr: "M3", group: "Modell", variant: "Haiku 5.5 statt Sonnet 5.5", override: { model: "anthropic/claude-haiku-5.5" } },
  { ...C06, nr: "M4", group: "Modell", variant: "Haiku 5.5 statt Sonnet 5.5", override: { model: "anthropic/claude-haiku-5.5" } },
];

export const ALL_CASES: QCase[] = [...LESSONS, ...SPEED, ...MODELS];
