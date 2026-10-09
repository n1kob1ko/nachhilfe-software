export type CurriculumSkill = {
  id: string;
  subject: string;
  area: string;
  name: string;
  gradeMin: number;
  gradeMax: number;
  /** Teilfähigkeit: the skill it belongs to (Fach › Thema › Fähigkeit › Teilfähigkeit). */
  parentId?: string;
};

export const SUBJECTS = ["Mathematik", "Deutsch", "Englisch"] as const;


export const DIFFICULTIES = ["sehr leicht", "leicht", "mittel", "schwer", "sehr schwer"] as const;
/** "leicht bis mittel" was used by earlier versions and still appears on older exercises. */
export type Difficulty = (typeof DIFFICULTIES)[number] | "leicht bis mittel";

/** Difficulty as a number: 1 = sehr leicht … 5 = sehr schwer. */
export function levelOf(d: string | null | undefined): number {
  if (d === "leicht bis mittel") return 2;
  const i = (DIFFICULTIES as readonly string[]).indexOf(d ?? "");
  return i === -1 ? 3 : i + 1;
}
export const levelName = (level: number) => DIFFICULTIES[Math.max(1, Math.min(5, Math.round(level))) - 1];

/** Difficulty that fits a mastery estimate ("automatisch an Schüler anpassen"). */
export function difficultyFor(mastery: number | null): Difficulty {
  if (mastery === null) return "leicht";
  if (mastery < 0.3) return "sehr leicht";
  if (mastery < 0.5) return "leicht";
  if (mastery < 0.7) return "mittel";
  if (mastery < 0.85) return "schwer";
  return "sehr schwer";
}

/**
 * How a task is answered and checked (the "format"). Stored in tasks.type.
 * calc = short answer compared as a number/fraction, grammar = short answer compared as text,
 * order = put steps in the right order, fix = correct a text with errors (lib/fix-text.ts), rechenweg =
 * result with the working line by line, sachaufgabe = parts a), b), c) (both lib/math-check.ts).
 */
export const TASK_TYPES = {
  mc: "Multiple Choice",
  calc: "Rechnung",
  free: "Freitext",
  cloze: "Lückentext",
  grammar: "Kurzantwort",
  reading: "Textverständnis",
  order: "Reihenfolge",
  fix: "Fehler korrigieren",
  rechenweg: "Rechenweg",
  sachaufgabe: "Sachaufgabe mit Teilfragen",
  mixed: "Gemischt",
} as const;
export type TaskType = Exclude<keyof typeof TASK_TYPES, "mixed">;

/**
 * Task types as teachers think of them, per subject (stored in tasks.category). Each one lists the
 * answer formats it can use, the first being the usual one. A new subject only needs an entry here;
 * subjects without one get DEFAULT_CATEGORIES.
 */
export type Category = { key: string; label: string; formats: TaskType[]; hint: string };
const c = (key: string, label: string, formats: TaskType[], hint: string): Category => ({ key, label, formats, hint });

export const CATEGORIES: Record<string, Category[]> = {
  Mathematik: [
    c("rechnung", "Direkte Rechnung", ["calc", "mc"], "Eine Rechnung mit eindeutigem Ergebnis."),
    c("rechenweg", "Rechenweg", ["rechenweg"], "Gleichung lösen oder Term berechnen: der Schüler schreibt jeden Schritt in eine eigene Zeile, die App prüft jede Zeile und das Ergebnis."),
    c("sachaufgabe", "Mehrteilige Sachaufgabe", ["sachaufgabe"], "Alltagssituation mit Teilfragen a), b), c): Zahlen mit Rechenweg und Erklärungen in Worten, jede Teilfrage wird einzeln bewertet."),
    c("textaufgabe", "Textaufgabe", ["calc", "free"], "Kurze Sachsituation aus dem Alltag, Ergebnis als Zahl."),
    c("lueckentext", "Lückentext", ["cloze"], "Rechenweg oder Merksatz mit Lücken."),
    c("mc", "Multiple Choice", ["mc"], "3–4 Antworten, eine richtig; falsche Antworten sind typische Fehler."),
    c("fehler", "Fehler finden", ["calc", "mc"], "Eine vorgerechnete Lösung mit einem typischen Fehler; der Schüler gibt das richtige Ergebnis an."),
    c("ordnen", "Lösungsweg ordnen", ["order"], "Die Schritte eines Lösungswegs in die richtige Reihenfolge bringen."),
    c("offen", "Freie Antwort", ["free"], "Erklären, begründen oder eigenes Beispiel finden; der Lehrer bewertet."),
  ],
  Deutsch: [
    c("rechtschreibung", "Rechtschreibung", ["cloze", "grammar", "mc"], "Richtige Schreibung eines Wortes oder einer Stelle."),
    c("grammatik", "Grammatik", ["mc", "grammar"], "Fall, Zeit, Satzglied oder Ähnliches bestimmen."),
    c("wortarten", "Wortarten", ["cloze", "mc", "grammar"], "Echte Wörter bestimmen: Wortart eines markierten Wortes, die Wörter eines Satzes zuordnen, alle Nomen/Verben/Adjektive heraussuchen oder Wörter sortieren."),
    c("lueckentext", "Lückentext", ["cloze"], "Satz oder Text mit Lücken."),
    c("textverstaendnis", "Textverständnis", ["reading", "free"], "Kurzer Text mit Fragen dazu."),
    c("schreiben", "Schreiben", ["free"], "Kurzen Text verfassen (z. B. Satz, Absatz, Nachricht)."),
    c("satz", "Satz verbessern", ["grammar", "free"], "Einen fehlerhaften Satz richtig aufschreiben."),
    c("fehler", "Fehler finden", ["mc", "grammar"], "In einem Satz den Fehler finden."),
    c("korrigieren", "Fehler korrigieren", ["fix"], "Satz oder Absatz mit Fehlern; der Schüler schreibt ihn verbessert."),
    c("offen", "Freie Antwort", ["free"], "Frage in eigenen Worten beantworten, erklären oder begründen; der Lehrer bewertet."),
  ],
  Englisch: [
    c("vocabulary", "Vocabulary", ["grammar", "mc"], "Wort übersetzen oder passendes Wort finden."),
    c("grammar", "Grammar", ["cloze", "mc", "grammar"], "Grammatikform richtig bilden."),
    c("gap", "Gap filling", ["cloze"], "Sentence with gaps."),
    c("mc", "Multiple Choice", ["mc"], "3–4 options, one correct."),
    c("translation", "Translation", ["grammar", "free"], "Satz Deutsch → Englisch oder umgekehrt."),
    c("reading", "Reading comprehension", ["reading", "free"], "Short text with questions."),
    c("writing", "Writing", ["free"], "Short piece of writing."),
    c("korrigieren", "Fehler korrigieren", ["fix"], "Sentence or paragraph with mistakes; the student writes it correctly."),
    c("offen", "Freie Antwort", ["free"], "Antwort in eigenen Worten; der Lehrer bewertet."),
  ],
};
export const DEFAULT_CATEGORIES: Category[] = [
  c("kurz", "Kurzantwort", ["grammar"], "Kurze, eindeutige Antwort."),
  c("lueckentext", "Lückentext", ["cloze"], "Text mit Lücken."),
  c("mc", "Multiple Choice", ["mc"], "3–4 Antworten, eine richtig."),
  c("korrigieren", "Fehler korrigieren", ["fix"], "Text mit Fehlern; der Schüler schreibt ihn verbessert."),
  c("offen", "Freie Antwort", ["free"], "Erklären oder begründen; der Lehrer bewertet."),
];
export const categoriesFor = (subject: string) => CATEGORIES[subject] ?? DEFAULT_CATEGORIES;

/**
 * "Gemischte Aufgaben": the task types that fit a skill, the most useful first. The builder takes them
 * in turn, so an exercise gets gap texts, corrections and free answers instead of mostly multiple choice.
 * Own didactic choice; a type the subject does not have is skipped.
 */
const MIX_BY_SKILL: [RegExp, string[]][] = [
  // formats where the student writes come first; multiple choice (fehler, grammatik, wortarten) once per round at most
  [/^deutsch\.beistrich\./, ["korrigieren", "offen", "fehler"]],
  [/^deutsch\.recht\./, ["lueckentext", "korrigieren", "offen", "rechtschreibung"]],
  [/^deutsch\.grammatik\.zeiten/, ["lueckentext", "korrigieren", "offen", "grammatik"]],
  [/^deutsch\.grammatik\./, ["korrigieren", "lueckentext", "offen", "grammatik"]],
  // Wortarten: real determination tasks; explanations only when the teacher picks „Freie Antwort“
  [/^deutsch\.wortarten\./, ["wortarten", "lueckentext", "wortarten", "korrigieren"]],
  [/^deutsch\.text\./, ["textverstaendnis", "offen"]],
  [/^englisch\.(tenses|grammar)\./, ["gap", "korrigieren", "offen", "grammar"]],
  [/^englisch\.vocab/, ["vocabulary", "gap", "translation"]],
  [/^englisch\.reading/, ["reading", "offen"]],
  [/^englisch\.translation/, ["translation", "korrigieren", "offen"]],
  // Mathematik: the working counts, so Rechenweg and Sachaufgaben come first, multiple choice last
  [/^mathe\.gleichungen\.text/, ["sachaufgabe", "rechenweg", "textaufgabe", "ordnen"]],
  [/^mathe\.gleichungen\./, ["rechenweg", "rechnung", "lueckentext", "fehler"]],
  [/^mathe\.prozent\./, ["sachaufgabe", "rechenweg", "rechnung", "mc"]],
  [/^mathe\.brueche\./, ["rechenweg", "sachaufgabe", "rechnung", "mc"]],
  [/^mathe\./, ["rechenweg", "rechnung", "lueckentext", "mc"]],
];
const MIX_BY_SUBJECT: Record<string, string[]> = {
  Deutsch: ["lueckentext", "korrigieren", "offen", "grammatik"],
  Englisch: ["gap", "korrigieren", "offen", "grammar"],
  Mathematik: ["rechenweg", "sachaufgabe", "rechnung", "mc"],
};
export function mixFor(subject: string, skillId: string | null): string[] {
  const keys = new Set(categoriesFor(subject).map((c) => c.key));
  const wanted = (skillId && MIX_BY_SKILL.find(([re]) => re.test(skillId))?.[1]) || MIX_BY_SUBJECT[subject] || ["lueckentext", "korrigieren", "offen", "kurz"];
  const out = wanted.filter((k) => keys.has(k));
  return out.length ? out : [...keys].slice(0, 3);
}
export const categoryLabel = (subject: string, key: string | null | undefined) =>
  (key && [...categoriesFor(subject), ...Object.values(CATEGORIES).flat()].find((x) => x.key === key)?.label) || null;

const s = (subject: string, area: string, gradeMin: number, gradeMax: number, items: [string, string][]) =>
  items.map(([id, name]) => ({ id, subject, area, name, gradeMin, gradeMax }));
/** Teilfähigkeiten of one skill: ids are the parent id plus a suffix. */
const sub = (parent: CurriculumSkill, items: [string, string][]): CurriculumSkill[] =>
  items.map(([suffix, name]) => ({ id: `${parent.id}.${suffix}`, subject: parent.subject, area: parent.area, name, gradeMin: parent.gradeMin, gradeMax: parent.gradeMax, parentId: parent.id }));

const BASE: CurriculumSkill[] = [
  ...s("Mathematik", "Bruchrechnung", 5, 9, [
    ["mathe.brueche.kuerzen", "Kürzen"],
    ["mathe.brueche.erweitern", "Erweitern"],
    ["mathe.brueche.addieren", "Addieren"],
    ["mathe.brueche.subtrahieren", "Subtrahieren"],
    ["mathe.brueche.multiplizieren", "Multiplizieren"],
    ["mathe.brueche.dividieren", "Dividieren"],
  ]),
  ...s("Mathematik", "Negative Zahlen", 6, 9, [
    ["mathe.negativ.addieren", "Addieren und Subtrahieren"],
    ["mathe.negativ.multiplizieren", "Multiplizieren und Dividieren"],
  ]),
  ...s("Mathematik", "Prozentrechnung", 6, 10, [
    ["mathe.prozent.prozentwert", "Prozentwert berechnen"],
    ["mathe.prozent.prozentsatz", "Prozentsatz berechnen"],
    ["mathe.prozent.grundwert", "Grundwert berechnen"],
  ]),
  ...s("Mathematik", "Gleichungen", 7, 10, [
    ["mathe.gleichungen.einfach", "Einfache lineare Gleichungen"],
    ["mathe.gleichungen.klammern", "Gleichungen mit Klammern"],
    ["mathe.gleichungen.text", "Textaufgaben"],
  ]),
  ...s("Mathematik", "Potenzen", 8, 11, [["mathe.potenzen.regeln", "Potenzregeln"]]),
  ...s("Deutsch", "Beistrichsetzung", 5, 10, [
    ["deutsch.beistrich.aufzaehlung", "Aufzählungen"],
    ["deutsch.beistrich.nebensatz", "Haupt- und Nebensatz"],
    ["deutsch.beistrich.infinitiv", "Infinitivgruppen"],
  ]),
  ...s("Deutsch", "Rechtschreibung", 4, 9, [
    ["deutsch.recht.dasdass", "das / dass"],
    ["deutsch.recht.gross", "Groß- und Kleinschreibung"],
    ["deutsch.recht.sss", "s / ss / ß"],
  ]),
  ...s("Deutsch", "Grammatik", 4, 9, [
    ["deutsch.grammatik.faelle", "Fälle bestimmen"],
    ["deutsch.grammatik.zeiten", "Zeitformen"],
  ]),
  ...s("Deutsch", "Textverständnis", 3, 12, [["deutsch.text.verstehen", "Leseverständnis"]]),
  ...s("Englisch", "Tenses", 5, 10, [
    ["englisch.tenses.presentsimple", "Present Simple"],
    ["englisch.tenses.pastsimple", "Past Simple"],
    ["englisch.tenses.presentperfect", "Present Perfect"],
  ]),
  ...s("Englisch", "Vocabulary", 5, 10, [["englisch.vocab.irregular", "Irregular verbs"]]),
  ...s("Englisch", "Grammar", 5, 10, [["englisch.grammar.comparatives", "Comparatives"]]),
  ...s("Englisch", "Reading", 5, 12, [["englisch.reading.comprehension", "Reading comprehension"]]),
  ...s("Deutsch", "Wortarten", 3, 8, [
    ["deutsch.wortarten.bestimmen", "Wortarten bestimmen"],
    ["deutsch.wortarten.nomen", "Nomen erkennen und großschreiben"],
  ]),
  ...s("Englisch", "Translation", 5, 12, [["englisch.translation.sentences", "Sätze übersetzen"]]),
];

const byId = (id: string) => BASE.find((x) => x.id === id)!;
const READING_ASPECTS: [string, string][] = [
  ["info", "Informationen aus Texten entnehmen"],
  ["zusammenhang", "Zusammenhänge erkennen"],
  ["schluss", "Schlussfolgerungen ziehen"],
  ["wort", "Wortbedeutungen erschließen"],
  ["beleg", "Textstellen als Beleg verwenden"],
  ["zusammenfassen", "Inhalte zusammenfassen"],
  ["begruenden", "Aussagen begründen"],
];

const WORTART_FROM: Record<string, number> = { pronomen: 4, praeposition: 5, konjunktion: 5, adverb: 5, unterarten: 6 };

/** Finer steps of some skills, so an exercise can target exactly what a student gets wrong. */
const SUBSKILLS: CurriculumSkill[] = [
  ...sub(byId("mathe.brueche.dividieren"), [
    ["kehrwert", "Kehrwert korrekt bilden"],
    ["ganzzahl", "Bruch durch ganze Zahl"],
    ["kuerzen", "Vor dem Multiplizieren kürzen"],
  ]),
  ...sub(byId("mathe.brueche.addieren"), [
    ["hauptnenner", "Gemeinsamen Nenner finden"],
    ["gemischt", "Gemischte Zahlen addieren"],
  ]),
  ...sub(byId("mathe.brueche.multiplizieren"), [["kuerzen", "Über Kreuz kürzen"]]),
  ...sub(byId("mathe.gleichungen.einfach"), [
    ["umformen", "Äquivalenzumformungen"],
    ["probe", "Probe machen"],
  ]),
  ...sub(byId("mathe.gleichungen.text"), [["aufstellen", "Gleichung aus Text aufstellen"]]),
  ...sub(byId("mathe.prozent.prozentwert"), [["dreisatz", "Mit Dreisatz rechnen"]]),
  ...sub(byId("deutsch.beistrich.nebensatz"), [["konjunktion", "Einleitende Konjunktion erkennen"]]),
  ...sub(byId("deutsch.recht.dasdass"), [["ersatzprobe", "Ersatzprobe mit „dieses/welches“"]]),
  ...sub(byId("englisch.tenses.presentsimple"), [
    ["s", "3. Person -s"],
    ["fragen", "Fragen und Verneinung mit do/does"],
  ]),
  ...sub(byId("englisch.tenses.pastsimple"), [["irregular", "Unregelmäßige Formen"]]),
  // Leseverständnis: what each question about a reading text practises (lib/lesen.ts ASPECTS)
  ...sub(byId("deutsch.text.verstehen"), READING_ASPECTS),
  ...sub(byId("englisch.reading.comprehension"), READING_ASPECTS),
  // Wortarten: the teacher chooses which Wortarten an exercise asks for (lib/wortarten.ts). The classes are
  // our own steps: VS Nomen, Verb, Adjektiv (Lehrplan VS), Artikel and Pronomen from the 3./4. Schulstufe,
  // the rest in the Unterstufe.
  ...sub(byId("deutsch.wortarten.bestimmen"), [
    ["nomen", "Nomen"],
    ["verb", "Verben"],
    ["adjektiv", "Adjektive"],
    ["artikel", "Artikel"],
    ["pronomen", "Pronomen"],
    ["praeposition", "Präpositionen"],
    ["konjunktion", "Konjunktionen"],
    ["adverb", "Adverbien"],
    ["unterarten", "Unterarten (z. B. Pronomenarten)"],
  ]).map((x) => ({ ...x, gradeMin: WORTART_FROM[x.id.split(".").pop()!] ?? x.gradeMin })),
];

export const CURRICULUM: CurriculumSkill[] = [...BASE, ...SUBSKILLS];

/** "rechnung,fehler" → "Direkte Rechnung, Fehler finden"; older exercises store an answer format. */
export function worksheetTypeLabel(subject: string, taskType: string): string {
  if (taskType in TASK_TYPES) return TASK_TYPES[taskType as keyof typeof TASK_TYPES];
  return taskType
    .split(",")
    .map((k) => categoryLabel(subject, k) ?? k)
    .join(", ");
}

/**
 * Order between skills of the app's own structure: [skill, skill that should sit before it].
 * Used by the recommendations ("Voraussetzung fehlt") and shown next to a skill.
 * Own didactic choices, not taken from a curriculum.
 */
export const PREREQUISITES: [string, string][] = [
  ["mathe.brueche.addieren", "mathe.brueche.erweitern"],
  ["mathe.brueche.subtrahieren", "mathe.brueche.erweitern"],
  ["mathe.brueche.addieren", "mathe.brueche.kuerzen"],
  ["mathe.brueche.multiplizieren", "mathe.brueche.kuerzen"],
  ["mathe.brueche.dividieren", "mathe.brueche.multiplizieren"],
  ["mathe.prozent.prozentsatz", "mathe.prozent.prozentwert"],
  ["mathe.prozent.grundwert", "mathe.prozent.prozentwert"],
  ["mathe.gleichungen.klammern", "mathe.gleichungen.einfach"],
  ["mathe.gleichungen.text", "mathe.gleichungen.einfach"],
  ["mathe.gleichungen.einfach", "mathe.negativ.addieren"],
  ["mathe.negativ.multiplizieren", "mathe.negativ.addieren"],
  ["deutsch.beistrich.nebensatz", "deutsch.beistrich.aufzaehlung"],
  ["deutsch.beistrich.infinitiv", "deutsch.beistrich.nebensatz"],
  ["deutsch.wortarten.nomen", "deutsch.wortarten.bestimmen"],
  ["englisch.tenses.presentperfect", "englisch.tenses.pastsimple"],
  ["englisch.tenses.pastsimple", "englisch.tenses.presentsimple"],
];
