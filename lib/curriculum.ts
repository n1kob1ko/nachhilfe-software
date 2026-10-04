export type CurriculumSkill = {
  id: string;
  subject: string;
  area: string;
  name: string;
  gradeMin: number;
  gradeMax: number;
};

export const SUBJECTS = ["Mathematik", "Deutsch", "Englisch"] as const;

export const SCHOOL_TYPES = [
  "Volksschule",
  "Mittelschule",
  "AHS-Unterstufe",
  "AHS-Oberstufe",
  "BHS (HAK, HTL, HLW …)",
  "Polytechnische Schule",
  "Berufsschule",
  "Andere",
];

export const DIFFICULTIES = ["leicht", "leicht bis mittel", "mittel", "schwer"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TASK_TYPES = {
  mc: "Multiple Choice",
  calc: "Rechnung",
  free: "Freitext",
  cloze: "Lückentext",
  grammar: "Grammatik",
  reading: "Textverständnis",
  mixed: "Gemischt",
} as const;
export type TaskType = Exclude<keyof typeof TASK_TYPES, "mixed">;

const s = (subject: string, area: string, gradeMin: number, gradeMax: number, items: [string, string][]) =>
  items.map(([id, name]) => ({ id, subject, area, name, gradeMin, gradeMax }));

export const CURRICULUM: CurriculumSkill[] = [
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
  ...s("Deutsch", "Textverständnis", 3, 12, [["deutsch.text.verstehen", "Informationen entnehmen"]]),
  ...s("Englisch", "Tenses", 5, 10, [
    ["englisch.tenses.presentsimple", "Present Simple"],
    ["englisch.tenses.pastsimple", "Past Simple"],
    ["englisch.tenses.presentperfect", "Present Perfect"],
  ]),
  ...s("Englisch", "Vocabulary", 5, 10, [["englisch.vocab.irregular", "Irregular verbs"]]),
  ...s("Englisch", "Grammar", 5, 10, [["englisch.grammar.comparatives", "Comparatives"]]),
  ...s("Englisch", "Reading", 5, 12, [["englisch.reading.comprehension", "Reading comprehension"]]),
];
