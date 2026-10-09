/**
 * What a Textkorrektur looks at and by which standard: the categories of a correction, the level of
 * the student (a Volksschul-Erzählung is not marked like an Oberstufen-Interpretation) and what each
 * kind of text needs. Pure data and functions, used by the KI prompt, the server checks and the pages.
 */
import type { ErrorType } from "./error-types";
import { klassenLabel, schulstufe, stufenbereich } from "./school";

/**
 * Categories of a correction. Where an exercise Fehlerart fits, `errorType` names it, so text errors
 * and exercise errors can be counted together. `scope` "stelle" is marked in the text, "text" is a
 * note on the whole text (structure, content, kind of text, task).
 */
export const TEXT_CATEGORIES = [
  { key: "rechtschreibung", label: "Rechtschreibung", short: "R", errorType: "rechtschreibung", scope: "stelle" },
  { key: "grammatik", label: "Grammatik", short: "G", errorType: "grammatik", scope: "stelle" },
  { key: "zeichensetzung", label: "Zeichensetzung", short: "Z", errorType: "grammatik", scope: "stelle" },
  { key: "satzbau", label: "Satzbau", short: "Sb", errorType: "grammatik", scope: "stelle" },
  { key: "ausdruck", label: "Ausdruck", short: "A", errorType: "wortschatz", scope: "stelle" },
  { key: "struktur", label: "Textaufbau", short: "Au", errorType: null, scope: "text" },
  { key: "inhalt", label: "Inhalt", short: "I", errorType: null, scope: "text" },
  { key: "textsorte", label: "Textsorte", short: "Ts", errorType: null, scope: "text" },
  { key: "aufgabe", label: "Aufgabenstellung", short: "Af", errorType: "gelesen", scope: "text" },
] as const satisfies readonly { key: string; label: string; short: string; errorType: ErrorType | null; scope: "stelle" | "text" }[];

export type TextCategory = (typeof TEXT_CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = TEXT_CATEGORIES.map((c) => c.key) as TextCategory[];
const BY_KEY = new Map<string, (typeof TEXT_CATEGORIES)[number]>(TEXT_CATEGORIES.map((c) => [c.key, c]));
export const categoryInfo = (key: string) => BY_KEY.get(key) ?? null;
export const categoryLabel = (key: string) => BY_KEY.get(key)?.label ?? key;
export const isTextCategory = (x: unknown): x is TextCategory => typeof x === "string" && BY_KEY.has(x);

/** Words a model may use for a category; anything else is not accepted. */
const ALIASES: Record<string, TextCategory> = {
  rechtschreibung: "rechtschreibung",
  orthografie: "rechtschreibung",
  orthographie: "rechtschreibung",
  spelling: "rechtschreibung",
  grammatik: "grammatik",
  grammar: "grammatik",
  zeitform: "grammatik",
  zeichensetzung: "zeichensetzung",
  interpunktion: "zeichensetzung",
  beistrich: "zeichensetzung",
  komma: "zeichensetzung",
  punctuation: "zeichensetzung",
  satzbau: "satzbau",
  syntax: "satzbau",
  wortstellung: "satzbau",
  ausdruck: "ausdruck",
  wortwahl: "ausdruck",
  stil: "ausdruck",
  style: "ausdruck",
  struktur: "struktur",
  textstruktur: "struktur",
  aufbau: "struktur",
  textaufbau: "struktur",
  inhalt: "inhalt",
  vollstaendigkeit: "inhalt",
  vollständigkeit: "inhalt",
  textsorte: "textsorte",
  aufgabe: "aufgabe",
  aufgabenstellung: "aufgabe",
};
export function normalizeCategory(raw: unknown): TextCategory | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase().replace(/[^a-zäöüß]/g, "");
  return ALIASES[k] ?? null;
}

// ---------- level ----------

export type LevelBand = "volksschule" | "unterstufe" | "oberstufe";

export type Level = {
  band: LevelBand;
  /** "4. Klasse Volksschule" */
  label: string;
  schulstufe: number;
  /** at most this many optional style suggestions */
  maxStyle: number;
  /** at most this many marks in the text */
  maxMarks: number;
  /** what the KI should mark at this level, in one paragraph */
  standard: string;
};

const STANDARD: Record<LevelBand, string> = {
  volksschule:
    "Volksschule: Markiere nur Fehler, die ein Kind dieser Stufe schon kennen kann: Großschreibung von Nomen und am Satzanfang, häufige Wörter, die Rechtschreibstrategien der Volksschule (Verlängern bei d/t, b/p, g/k am Wortende, z. B. Wald wegen Wälder; ß nach langem Selbstlaut; doppelter Mitlaut nach kurzem Selbstlaut), Satzschlusszeichen, Zeichen bei wörtlicher Rede, einheitliche Vergangenheit beim Erzählen, einfache Fälle (z. B. nach mit, bei, von). Beistriche nur bei Aufzählungen und vor „weil“, „dass“, „wenn“. Keine Stilregeln höherer Stufen. Ausdruck nur bei auffälligen Wiederholungen („dann … dann“). Erklärungen sehr einfach, freundlich, ohne Fachwörter außer Nomen, Verb, Satz.",
  unterstufe:
    "Unterstufe (5.–8. Schulstufe): Rechtschreibung (inkl. das/dass, s/ss/ß, Groß- und Kleinschreibung, Zusammen- und Getrenntschreibung), Grammatik (Fälle, Zeitformen und ihre Einheitlichkeit, Kongruenz, ab der 7. Schulstufe Konjunktiv in indirekter Rede), Beistrich bei Nebensätzen, Aufzählungen, Einschüben und wörtlicher Rede, Satzbau, Ausdruck (Wiederholungen, Umgangssprache in sachlichen Texten, ungenaue Wörter). Erklärungen kurz, mit den Regelnamen der Unterstufe.",
  oberstufe:
    "Oberstufe (9.–13. Schulstufe): alle sprachlichen Normen, dazu Stil und Register (sachlich, fachsprachlich, Normen der Textsorte), Satzverknüpfung und Kohärenz, präzise Wortwahl, Zitierweise und Belege. Erklärungen präzise und knapp, mit Fachbegriffen der Oberstufe.",
};

/** The student's level from school type and class; without a class the Unterstufe standard applies. */
export function levelFor(schoolType: string, klasse: number | null | undefined): Level {
  const stufe = klasse ? schulstufe(schoolType, klasse) : 6;
  const range = stufenbereich(stufe);
  const band: LevelBand = range === "Primarstufe" ? "volksschule" : range === "Sekundarstufe I" ? "unterstufe" : "oberstufe";
  return {
    band,
    label: klassenLabel(schoolType, klasse) || `${stufe}. Schulstufe`,
    schulstufe: stufe,
    maxStyle: band === "volksschule" ? 3 : band === "unterstufe" ? 8 : 15,
    maxMarks: band === "volksschule" ? 40 : band === "unterstufe" ? 80 : 120,
    standard: STANDARD[band],
  };
}

// ---------- kind of text ----------

const KINDS: [RegExp, string][] = [
  [/techn/i, "Technischer Bericht: klare Gliederung (Ziel, Durchführung, Ergebnis, Schlussfolgerung), Fachbegriffe richtig, sachlich und unpersönlich (Passiv oder „man“), Werte und Einheiten exakt, Präteritum für Durchgeführtes."],
  [/gesch(ä|ae)ftsbrief|business letter/i, "Geschäftsbrief: Absender, Empfänger, Ort und Datum, Betreff, Anrede, sachlicher höflicher Geschäftsstil, klares Anliegen, Grußformel, Unterschrift; normgerechter Aufbau."],
  [/beschwerde|complaint/i, "Beschwerdebrief: Ort und Datum, Betreff, höfliche Anrede, Sachverhalt mit Zeit und Ort, Begründung, konkrete Forderung (mit Frist), Grußformel; sachlich bleiben; Höflichkeitsform „Sie/Ihnen“ groß."],
  [/brief|letter/i, "Brief: Ort und Datum, passende Anrede, klares Anliegen in sinnvoller Reihenfolge, Grußformel; Anrede und Ton passen zum Empfänger."],
  [/bildgeschichte/i, "Bildgeschichte: passende Einleitung (wer, wo, wann); verständlicher Handlungsablauf in der Reihenfolge der Bilder, nichts Wesentliches ausgelassen; Zusammenhang mit der Bilderfolge (nur soweit die Bildbeschreibungen ihn zeigen); Spannung bis zum Höhepunkt und treffende, abwechslungsreiche Wortwahl; ein Schluss, der die Geschichte abrundet; passende Überschrift; Erzählzeit Präteritum einheitlich; Rechtschreibung und Grammatik."],
  [/interpret|analyse/i, "Textinterpretation/Textanalyse: Einleitung mit Autor, Titel, Textsorte und Thema; Präsens; Inhalt knapp, dann Aufbau, Sprache und Wirkung; Aussagen mit Zitaten und Zeilenangaben belegt; begründete Deutung; Schluss mit Gesamtdeutung."],
  [/er(ö|oe)rterung|essay|argument/i, "Erörterung: Einleitung mit Hinführung und Fragestellung; Argumente mit Behauptung, Begründung und Beispiel; sinnvolle Reihenfolge; bei dialektischer Form Pro und Kontra; Schluss mit begründeter eigener Meinung; sachlicher Stil und Verknüpfungswörter."],
  [/inhaltsangabe|zusammenfassung|summary/i, "Inhaltsangabe: Einleitungssatz (Titel, Autor, Textsorte, Thema), Präsens, sachlich, eigene Worte, keine wörtliche Rede, Wesentliches in richtiger Reihenfolge."],
  [/bericht|report/i, "Bericht: sachlich ohne Gefühle und Spannung, W-Fragen (wer, was, wann, wo, wie, warum, Folgen), zeitliche Reihenfolge, Präteritum, keine wörtliche Rede, keine Umgangssprache."],
  [/beschreib|description/i, "Beschreibung: sachlich und genau, sinnvolle Reihenfolge (vom Ganzen zum Detail), Präsens, treffende Adjektive."],
  [/erz(ä|ae)hl|geschichte|story|aufsatz/i, "Erzählung: Einleitung (wer, wo, wann), Hauptteil mit Höhepunkt, Schluss; Erzählzeit Präteritum einheitlich; Erzählperspektive durchgehalten; wörtliche Rede richtig gesetzt; Gefühle und Gedanken."],
];

/** What the kind of text needs, for the prompt; a general rule when the kind is unknown. */
export function kindCriteria(kind: string): string {
  return KINDS.find(([re]) => re.test(kind))?.[1] ?? "Klarer Aufbau (Einleitung, Hauptteil, Schluss), die Aufgabenstellung ist erfüllt, Sprache passt zum Zweck des Textes.";
}

/** English texts: the corrections in English, the explanations in German for the student. */
export const isEnglish = (subject: string) => /englisch|english/i.test(subject);
