import type { Difficulty, TaskType } from "./curriculum";
import type { Figur } from "./figur";
import { langform } from "./englisch-kurzformen";
import { checkFix, tokenize, type FixLabel } from "./fix-text";
import { checkMemorize, mistakeLabel } from "./memorize";
import type { PartSolution, PartView, ResultForm } from "./math-check";
import { gradeMathTask } from "./math-task";
import { pruefeVokabel, type VokabelSpec } from "./vokabeln-pruefen";
import { pruefeEnglischAuswahl, pruefeEnglischLuecken, pruefeRichtigFalsch } from "./englisch-matura-pruefen";

export type AnswerSpec = {
  /** Multiple choice / reading: index of the correct option. */
  correct?: number;
  /**
   * Matura-Format „2 aus 5“ (lib/matura-formate.ts): die Indizes aller richtigen Antworten in data.options,
   * statt `correct`. Richtig ist die Antwort nur, wenn genau diese angekreuzt sind (alles oder nichts).
   */
  correctAll?: number[];
  /** Zuordnung: für jede Aussage in data.zuordnung der Index der passenden Antwort (0 = A). Alles oder nichts. */
  pairs?: number[];
  /** Short answers: accepted solutions. */
  accepted?: string[];
  /** value = numerically equal (fractions, decimals); exact = case sensitive; text = case insensitive. */
  mode?: "value" | "exact" | "text";
  /** English: a contraction counts the same as its long form (doesn't = does not), lib/englisch-kurzformen.ts. */
  contractions?: boolean;
  /**
   * Direkte Rede: jedes Satzzeichen zählt, auch der Punkt am Ende. Leerzeichen und die Art der
   * Anführungszeichen („…“, "…", »…«) zählen nicht (lib/deutsch-satzlehre.ts).
   */
  satzzeichen?: boolean;
  /** Cloze: accepted alternatives per gap (gaps are written as ___ in the prompt). */
  blanks?: string[][];
  /**
   * Cloze: the gaps are word endings (Adjektivdeklination). „en“ and „-en“ count the same, and an empty
   * gap or „-“ means „keine Endung“; the Solver then also takes an answer with empty gaps.
   */
  endings?: boolean;
  /** Free text: sample answer used for grading. */
  sample?: string;
  /** Order tasks: the steps in the right order. */
  steps?: string[];
  /** Fehler korrigieren: the described errors ("meinen" → "meinem": Dativ nach „mit“); the corrected text is in `accepted`. */
  fixes?: FixLabel[];
  /** What a good answer must contain (Bewertungskriterien), for the teacher and the print. */
  criteria?: string[];
  /** Rechenweg: unit the result needs ("€", "cm²", "%"). */
  unit?: string | null;
  /** Rechenweg: how the result has to be written (beliebig = every equal form, 1/2 = 0,5 = 50 %). */
  form?: ResultForm | null;
  /** Rechenweg: round the result to this many decimals. */
  round?: number | null;
  /** Rechenweg: false = only the result counts, the working is optional. */
  needWay?: boolean;
  /** Sachaufgabe: the solution of each part, in the order of data.parts. */
  parts?: PartSolution[];
  /** Leseverständnis: where in the reading text the answer stands (paragraph from 1, quoted word for word). */
  evidence?: { paragraph: number; quote: string }[];
  /**
   * Vokabeltrainer (lib/vokabeln.ts): a word of a list, written or in the gap of its sentence. The right
   * answers stay in accepted or blanks; this says how they are compared (lib/vokabeln-pruefen.ts).
   */
  vokabel?: VokabelSpec;
  /**
   * Englisch-Matura True or False (lib/englisch-matura-formate.ts): je Aussage der Satz aus data.passage, der die
   * Entscheidung belegt, Wort für Wort. Die Schülerin bzw. der Schüler schreibt seine ersten Wörter dazu.
   */
  belege?: string[];
  /** Englisch-Matura Short Answers: so viele Wörter darf eine Antwort höchstens haben (meist 4). */
  maxWords?: number;
  /**
   * Englisch-Matura (Open Gap Fill, Word Formation …): jede Lücke zählt für sich wie ein Punkt der Matura; im letzten
   * Versuch ist eine Antwort mit mindestens der Hälfte richtig „teilweise richtig“ (lib/englisch-matura-pruefen.ts).
   */
  teilpunkte?: boolean;
};

export type TaskDraft = {
  /** Answer format: how the task is answered and checked. */
  type: TaskType;
  /** Main skill; progress is tracked for it and for every id in skillIds. */
  skillId: string | null;
  /** All skills the task trains (includes skillId). */
  skillIds?: string[];
  /** Task type as teachers call it, per subject ("textaufgabe", "fehler" …), see CATEGORIES. */
  category?: string | null;
  difficulty: Difficulty;
  prompt: string;
  /**
   * steps: order tasks show the steps in this (shuffled) order. faulty: the text with errors of a
   * "Fehler korrigieren" task. lines: size of the answer field of a free answer (1 = one line).
   */
  data: {
    options?: string[];
    passage?: string;
    steps?: string[];
    faulty?: string;
    lines?: number;
    /** Rechenweg: the equation or term the student starts from ("3x + 7 = 22", "3/4 + 1/6"); empty = free calculation. */
    start?: string;
    /** Rechenweg: the unknown of an equation; also without a start (Gleichung aus einem Text aufstellen). */
    variable?: string;
    /** Sachaufgabe: the parts a), b), c) as the student sees them. */
    parts?: PartView[];
    /** Leseverständnis: the title of the reading text in passage (lib/lesen.ts). */
    passageTitle?: string;
    /** Leseverständnis: what the question practises (info, zusammenhang, schluss, wort, beleg, zusammenfassen, begruenden). */
    aspect?: string;
    /** Textinterpretation (lib/textinterpretation.ts): the passage is shown line by line with line numbers, as pasted. */
    zeilen?: boolean;
    /** … and its empty lines get a number too. */
    leerzeilen?: boolean;
    /** Teilübung: which part of an interpretation the task practises (einleitung, inhalt, form, sprache, figur, deutung, schluss),
     *  or of another Schreibauftrag (the part keys of lib/schreibauftrag.ts). */
    teil?: string;
    /** … and the kind of text it is about (Kurzgeschichte, Parabel, …; Kommentar, Bericht, … for a Textbeilage). */
    textsorte?: string;
    /** … and the Textsorte written (leserbrief, eroerterung, … as in lib/schreibauftrag.ts); missing: Textinterpretation. */
    schreibsorte?: string;
    /** KI-Aufgaben: what the teacher has to check before the task can be sent (e.g. a doubtful Wortart); never shown to students. */
    pruefen?: string[];
    /** Artikel-Aufgaben: das Genus des Nomens (m = maskulin, f = feminin, n = neutral), damit die Oberfläche
     *  es färben kann (D10, components/genus.ts). Die Farbe ist nie das einzige Signal. */
    genus?: "m" | "f" | "n";
    /** Eigene Probeschularbeit (lib/probe-extern.ts): die Nummer wie auf dem Blatt („1a“), für „Arbeit fotografieren“. */
    nummer?: string;
    /** Vokabeltrainer: a key of the asked word that does not show it (lib/vokabeln.ts wortSchluessel); one word once on a sheet. */
    wort?: string;
    /** Aufgabe mit Bild: Zahlenstrahl, Koordinatensystem oder Figur (lib/figur.ts). Die Antwort steht
     *  trotzdem in answer; das Bild enthält die Zahlen, aus denen sie berechnet wurde. Schülerinnen und
     *  Schüler bekommen nur das fertige SVG ohne Lösung, nie diese Angaben. */
    figure?: Figur;
    /**
     * Lückentext zum Ankreuzen (Matura-Format): je Lücke die Satzteile zum Ankreuzen, in der Reihenfolge der
     * Lücken. Die richtigen stehen wie sonst in answer.blanks; die Antwort ist der gewählte Satzteil.
     */
    gapOptions?: string[][];
    /**
     * Zuordnung (Matura-Format): die Aussagen und die Antworten A, B, C, D. Die Lösung steht in answer.pairs.
     * art (Englisch-Matura, lib/englisch-matura-formate.ts): richtig-falsch = je Aussage True (0) oder False (1)
     * mit Beleg; fragen = Multiple Choice zum Text, je Frage die Antworten A bis D in choices (options leer);
     * ueberschriften und satzenden = Multiple Matching mit mehr Antworten als Aussagen. Ohne art: Mathematik.
     */
    zuordnung?: { statements: string[]; options: string[]; art?: ZuordnungsArt; choices?: string[][] };
    /** Englisch-Matura Banked Gap Fill: die Wörter im Kasten, alphabetisch, mit den Wörtern, die übrig bleiben. */
    wortliste?: string[];
    /** Englisch-Matura Editing: jede Zeile endet mit einer Lücke; darin das überflüssige Wort oder ✓. */
    editing?: boolean;
    /** Englisch-Matura Writing: die Textsorte und die Wortanzahl, um die es geht (±10 %). */
    schreibauftrag?: { textsorte: string; woerter: number };
  };
  answer: AnswerSpec;
  solution: string;
  hints: string[];
  /**
   * Typical wrong answers and what they reveal (for MC and „2 aus 5“: the option index as string; Zuordnung:
   * Aussage und Buchstabe, „2 → C“; Lückentext zum Ankreuzen: Lücke und Satzteil, „② nach unten offen“).
   */
  errorMap: { answer: string; label: string }[];
  /** Lösungsweg as separate steps (AI tasks); the text in `solution` stays the main form. */
  solutionSteps?: string[];
  /**
   * Erklärung für den Lehrer, von Hand geschrieben; leer = die App schreibt sie aus Fähigkeit und typischen
   * Fehlern (lib/loesungsdaten.ts). Schüler sehen sie nur bei der Freigabe „Alles“.
   */
  teacherNote?: string;
  /** Andere Wege zur selben Lösung, nur wo es sie wirklich gibt (Generatoren, Lehrer). Schüler: nur bei „Alles“. */
  altWays?: string[];
  /** Expected working time in seconds, if known. */
  estimatedTimeSec?: number | null;
  /** Origin: eigen (generators, teacher), ki, oer, lehrplan, demo. Licence data via sourceId (content_sources). */
  sourceType?: string;
  sourceId?: number | null;
  /** Quellenangabe einer übernommenen Aufgabe (Referenzsammlung, lib/referenz.ts): auf dem Blatt und beim Schüler „Quelle: …“. */
  quelle?: string | null;
};

/** Wie bei einer Zuordnung der Englisch-Matura zugeordnet wird (data.zuordnung.art). */
export type ZuordnungsArt = "richtig-falsch" | "fragen" | "ueberschriften" | "satzenden";

export type CheckResult = {
  /** null = cannot be decided automatically (free text: the teacher grades it). */
  correct: boolean | null;
  errorLabel: string | null;
  feedback: string;
  /** Lückentext: numbers (from 1) of the gaps that are still wrong. */
  wrongGaps?: number[];
  /** Fehler korrigieren, Rechenweg, Sachaufgabe: the Fehlerart the app suggests, if a rule fits. */
  errorType?: string | null;
  /**
   * Rechenweg, Sachaufgabe: what is stored when this answer is the last try: teilweise (half, e.g.
   * 2 of 3 parts or the unit missing) or offen (the teacher grades it).
   */
  onFinal?: "teilweise" | "offen" | null;
};

/** Teacher's grade of an answer the app cannot check (free answers) or that the teacher checks again. */
export const REVIEWS = { richtig: "richtig", teilweise: "teilweise richtig", falsch: "falsch" } as const;
export type Review = keyof typeof REVIEWS;
export const isReview = (x: unknown): x is Review => typeof x === "string" && x in REVIEWS;

/**
 * The result line at the end of a test (Minitest, Lernkontrolle, Probeschularbeit): only checked answers count. Answers the
 * teacher still grades are never shown as wrong: all open → „4 von 4 abgegeben“, some open → „Bisher 1 von 2 richtig“.
 */
export function testErgebnis(richtig: number, gesamt: number, wartet: number, abgegeben: number = gesamt): string {
  if (wartet <= 0) return `${richtig} von ${gesamt} richtig`;
  const geprueft = abgegeben - wartet;
  if (geprueft <= 0) return `${abgegeben} von ${gesamt} abgegeben`;
  return `Bisher ${richtig} von ${geprueft} richtig`;
}
/** Formats the teacher grades or may grade again after the app's check. */
export const TEACHER_GRADED = new Set<string>(["free", "fix", "rechenweg", "sachaufgabe"]);

export const GAP = "___";

/** Parses "3/4", "-1 1/2", "0,75", "2" into a number. */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, " ").replace(/−/g, "-").replace(/:/g, "/");
  if (!s) return null;
  const mixed = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/);
  if (mixed) {
    const [, sign, whole, num, den] = mixed;
    if (Number(den) === 0) return null;
    const v = Number(whole) + Number(num) / Number(den);
    return sign ? -v : v;
  }
  const frac = s.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)$/);
  if (frac) {
    const den = Number(frac[2].replace(",", "."));
    if (den === 0) return null;
    return Number(frac[1].replace(",", ".")) / den;
  }
  const cleaned = s.replace(/\s/g, "").replace(/%$/, "").replace(/€$/, "");
  if (/^-?\d+(?:[.,]\d+)?$/.test(cleaned)) return Number(cleaned.replace(",", "."));
  const eq = s.match(/^[a-z]\s*=\s*(.+)$/i);
  if (eq) return parseNumber(eq[1]);
  return null;
}

export function normalizeText(s: string, caseSensitive = false) {
  let out = s
    .trim()
    .replace(/[„“”"]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/[.!?]+$/, "")
    .trim();
  if (!caseSensitive) out = out.toLowerCase();
  return out;
}

/** Words and punctuation marks one by one, every kind of quotation mark the same, spaces left out. */
const mitSatzzeichen = (s: string, caseSensitive: boolean) =>
  tokenize(s)
    .map((t) => t.text.replace(/[„“”"«»‟]/g, '"'))
    .map((x) => (caseSensitive ? x : x.toLowerCase()))
    .join(" ");

export function sameAnswer(given: string, expected: string, mode: AnswerSpec["mode"], contractions = false, satzzeichen = false) {
  if (satzzeichen) return mitSatzzeichen(given, mode === "exact") === mitSatzzeichen(expected, mode === "exact");
  // a number in a gap or a short answer: 0,5 and 0.5 are the same
  if (mode === "value" || (/^\s*-?\d+([.,]\d+)?\s*$/.test(given) && /^\s*-?\d+([.,]\d+)?\s*$/.test(expected))) {
    const a = parseNumber(given);
    const b = parseNumber(expected);
    if (a !== null && b !== null) return Math.abs(a - b) < 1e-6;
  }
  const norm = (s: string) => (contractions ? langform(normalizeText(s, mode === "exact")) : normalizeText(s, mode === "exact"));
  return norm(given) === norm(expected);
}

/** Eine Endung ohne Bindestrich davor: „-en“ → „en“, „-“ und eine leere Lücke → „“ (keine Endung). */
export const endingOf = (s: string) => s.trim().replace(/^[-‐–—]+/, "").trim();

type Same = (given: string, expected: string, mode: AnswerSpec["mode"], contractions?: boolean, satzzeichen?: boolean) => boolean;
const sameEnding: Same = (given, expected, mode, contractions, satzzeichen) => sameAnswer(endingOf(given), endingOf(expected), mode, contractions, satzzeichen);

function labelFor(task: Pick<TaskDraft, "errorMap" | "answer">, given: string, same: Same = sameAnswer) {
  for (const e of task.errorMap) {
    if (same(given, e.answer, task.answer.mode, task.answer.contractions, task.answer.satzzeichen)) return e.label;
  }
  return null;
}

/** ① ② ③ …: so heißen die Lücken eines Lückentexts zum Ankreuzen, wie auf dem Maturablatt. */
export const kreisZahl = (n: number) => (n >= 1 && n <= 20 ? String.fromCharCode(0x245f + n) : `(${n})`);
/** A, B, C, D: die Antworten einer Zuordnung. */
export const buchstabe = (i: number) => String.fromCharCode(65 + i);
const ZAHLWORT: Record<number, string> = { 2: "zwei", 3: "drei", 4: "vier" };

/** Eine Auswahl als JSON-Array von Indizes ("[0,3]", "[2,null]"), auch eine einzelne Zahl ("2"). null = nichts gewählt. */
function indizes(given: string): (number | null)[] {
  let v: unknown;
  try {
    v = JSON.parse(given);
  } catch {
    return [];
  }
  const index = (x: unknown) => (x !== null && x !== "" && Number.isInteger(Number(x)) && Number(x) >= 0 ? Number(x) : null);
  if (Array.isArray(v)) return v.map(index);
  return index(v) === null ? [] : [index(v)];
}

/** Ein Eintrag der Fehlerliste einer Zuordnung: „2 → C“, auch „2C“ oder „2 = c“. */
function zuordnungsFehler(answer: string): { aussage: number; antwort: number } | null {
  const m = answer.trim().match(/^(\d+)\s*(?:→|->|=|:)?\s*([A-Za-z])$/);
  return m ? { aussage: Number(m[1]) - 1, antwort: m[2].toUpperCase().charCodeAt(0) - 65 } : null;
}

/** Matura „2 aus 5“: ein Punkt nur, wenn alle richtigen und keine falsche angekreuzt sind. */
function checkMehrfachwahl(task: Pick<TaskDraft, "errorMap" | "answer">, given: string, richtig: number[]): CheckResult {
  const picked = [...new Set(indizes(given).filter((i): i is number => i !== null))];
  const need = richtig.length;
  const right = picked.filter((i) => richtig.includes(i));
  const wrong = picked.filter((i) => !richtig.includes(i));
  if (right.length === need && !wrong.length) return { correct: true, errorLabel: null, feedback: "Richtig!" };
  const n = ZAHLWORT[need] ?? String(need);
  const fehlen = need - right.length;
  const feedback = !picked.length
    ? `Kreuze ${n} Antworten an.`
    : picked.length > need
      ? `Du hast ${picked.length} Antworten angekreuzt. Genau ${n} sind richtig.`
      : !wrong.length
        ? fehlen === 1
          ? `Eine der ${n} richtigen Antworten fehlt.`
          : `${fehlen} der ${n} richtigen Antworten fehlen.`
        : right.length
          ? right.length === 1 && wrong.length === 1
            ? "Eine Antwort stimmt, die andere nicht."
            : "Nicht alle angekreuzten Antworten stimmen."
          : picked.length === 1
            ? `Die angekreuzte Antwort stimmt nicht. Genau ${n} sind richtig.`
            : "Keine der angekreuzten Antworten stimmt.";
  const errorLabel =
    (wrong.length ? labelFor(task, String(wrong[0])) : null) ??
    (picked.length > need ? `Mehr als ${n} Antworten angekreuzt` : picked.length && !wrong.length ? "Nicht alle richtigen Antworten angekreuzt" : null);
  return { correct: false, errorLabel, feedback };
}

/** Zuordnung: jede Aussage bekommt einen Buchstaben; ein Punkt nur, wenn alle stimmen. */
function checkZuordnung(task: Pick<TaskDraft, "errorMap">, given: string, pairs: number[]): CheckResult {
  const picked = indizes(given);
  const wrong = pairs.map((p, i) => (picked[i] === p ? -1 : i)).filter((i) => i >= 0);
  if (!wrong.length) return { correct: true, errorLabel: null, feedback: "Richtig!" };
  const offen = wrong.filter((i) => picked[i] == null);
  const falsch = wrong.filter((i) => picked[i] != null);
  const liste = (xs: number[]) => xs.map((i) => i + 1).join(" und ");
  // „bei 2“ statt „Aussage 2“: zugeordnet werden auch Terme, Funktionen und Stellen
  const feedback =
    offen.length === pairs.length
      ? "Wähle bei jeder Nummer einen Buchstaben."
      : falsch.length === pairs.length
        ? pairs.length === 2
          ? "Beide Buchstaben stimmen nicht."
          : "Kein Buchstabe stimmt."
        : [
            falsch.length ? `Bei ${liste(falsch)} ${falsch.length === 1 ? "stimmt der Buchstabe" : "stimmen die Buchstaben"} nicht.` : "",
            offen.length ? `Bei ${liste(offen)} fehlt noch ${offen.length === 1 ? "ein Buchstabe" : "der Buchstabe"}.` : "",
          ]
            .filter(Boolean)
            .join(" ");
  const label = falsch
    .map((i) => task.errorMap.find((e) => {
      const f = zuordnungsFehler(e.answer);
      return f !== null && f.aussage === i && f.antwort === picked[i];
    })?.label)
    .find(Boolean);
  return { correct: false, wrongGaps: wrong.map((i) => i + 1), errorLabel: label ?? (falsch.length ? "Falsch zugeordnet" : null), feedback };
}

/**
 * Checks an answer. `given` is the raw value: option index for MC, text for short answers,
 * a JSON array of strings for cloze tasks. Matura-Formate (lib/matura-formate.ts): „2 aus 5“ and Zuordnung
 * get a JSON array of option indices ("[1,4]"; Zuordnung in the order of the statements, null = no letter yet),
 * a Lückentext zum Ankreuzen the chosen phrases like any cloze task.
 */
export function checkAnswer(task: Pick<TaskDraft, "type" | "data" | "answer" | "errorMap">, given: string): CheckResult {
  const a = task.answer;
  // Auswendig schreiben: der Text steht in data.passage, verglichen wird Wort für Wort (lib/memorize.ts).
  // Die falschen Wörter sind das Fehler-Etikett des Versuchs — die einzige Spur, die der Lehrer sieht.
  if (task.type === "memorize") {
    const r = checkMemorize(task.data.passage ?? "", given);
    return { correct: r.correct, errorLabel: r.correct ? null : mistakeLabel(r.mistakes), feedback: r.feedback };
  }
  if (task.data.options && a.correctAll?.length) return checkMehrfachwahl(task, given, a.correctAll);
  if (task.type === "zuordnung" && a.pairs?.length) {
    // Englisch-Matura: True or False mit Beleg, Multiple Choice zum Text, Multiple Matching (lib/englisch-matura-pruefen.ts)
    const art = task.data.zuordnung?.art;
    if (art === "richtig-falsch") return pruefeRichtigFalsch(task, given);
    if (art) return pruefeEnglischAuswahl(task, given);
    return checkZuordnung(task, given, a.pairs);
  }
  if (task.data.options && typeof a.correct === "number") {
    const idx = Number(given);
    const correct = idx === a.correct;
    return {
      correct,
      errorLabel: correct ? null : labelFor(task, String(idx)),
      feedback: correct ? "Richtig!" : "Leider nicht richtig.",
    };
  }
  if (a.steps && task.data.steps) {
    // given: JSON array of indices into data.steps, in the order the student put them
    let order: number[] = [];
    try {
      order = (JSON.parse(given) as unknown[]).map(Number);
    } catch {
      order = [];
    }
    const placed = order.map((i) => task.data.steps![i]);
    const right = a.steps.filter((step, i) => placed[i] === step).length;
    const correct = right === a.steps.length && placed.length === a.steps.length;
    return {
      correct,
      errorLabel: correct ? null : labelFor(task, String(placed.findIndex((p, i) => p !== a.steps![i]) + 1)),
      feedback: correct ? "Richtige Reihenfolge!" : `${right} von ${a.steps.length} Schritten stehen an der richtigen Stelle.`,
    };
  }
  if (task.type === "rechenweg" || task.type === "sachaufgabe") return gradeMathTask(task, given).check;
  if (task.type === "fix" && task.data.faulty !== undefined) {
    const long = (s: string) => (a.contractions ? langform(s) : s);
    const labels = a.contractions ? a.fixes?.map((f) => ({ ...f, wrong: long(f.wrong), right: long(f.right) })) : a.fixes;
    const r = checkFix(long(task.data.faulty), (a.accepted ?? []).map(long), long(given), { caseSensitive: a.mode !== "text", labels });
    if (r.correct) return { correct: true, errorLabel: null, feedback: r.total === 1 ? "Richtig verbessert!" : `Alle ${r.total} Fehler richtig verbessert!` };
    let first: FixLabel | undefined = r.missed[0];
    // English: a missing word ("is cleaned", "does not like") has no wrong word to find the label by
    if (a.contractions && first && !first.label) {
      const missing = first.right;
      first = r.missed.find((m) => m.label) ?? labels?.find((l) => l.label && missing && ` ${l.right} `.includes(` ${missing} `)) ?? first;
    }
    const parts = [
      r.total ? `${r.fixed} von ${r.total} ${r.total === 1 ? "Fehler" : "Fehlern"} verbessert.` : "",
      r.extra ? `${r.extra === 1 ? "Eine Stelle, die richtig war, hast" : `${r.extra} Stellen, die richtig waren, hast`} du verändert.` : "",
      !given.trim() ? "Schreib den Text verbessert in das Feld." : r.fixed === r.total && !r.extra ? "Achte auf Satzzeichen sowie Groß- und Kleinschreibung." : "",
    ];
    return { correct: false, errorLabel: first?.label || null, errorType: first?.errorType ?? null, feedback: parts.filter(Boolean).join(" ") };
  }
  // Vokabeln: Artikel, „to“, britisch/amerikanisch und Alternativen zählen; was nicht in der Liste steht, bewertet die Lehrkraft
  if (a.vokabel && (a.accepted?.length || a.blanks?.length === 1)) return pruefeVokabel(task, given);
  // Englisch-Matura: Short Answers, Editing und die Lückentexte der Language in Use, je Lücke bewertet
  if (a.blanks && (a.maxWords || task.data.editing || task.data.wortliste || a.teilpunkte)) return pruefeEnglischLuecken(task, given);
  if (a.blanks) {
    let values: string[] = [];
    try {
      values = JSON.parse(given);
    } catch {
      values = [given];
    }
    // Endungen: „-en“ wie „en“, eine leere Lücke wie „-“ (keine Endung)
    const same = a.endings ? sameEnding : sameAnswer;
    const wrong = a.blanks
      .map((alts, i) => (alts.some((alt) => same(values[i] ?? "", alt, a.mode ?? "text", a.contractions, a.satzzeichen)) ? -1 : i))
      .filter((i) => i >= 0);
    const correct = wrong.length === 0;
    return {
      correct,
      wrongGaps: correct ? undefined : wrong.map((i) => i + 1),
      // Lückentext zum Ankreuzen: derselbe Satzteil kann in beiden Lücken stehen, die Fehlerliste nennt die Lücke („② 36“)
      errorLabel: correct
        ? null
        : (labelFor(task, values.join(" | ")) ??
          wrong.map((i) => (task.data.gapOptions ? labelFor(task, `${kreisZahl(i + 1)} ${values[i] ?? ""}`, same) : null) ?? labelFor(task, values[i] ?? "", same)).find(Boolean) ??
          null),
      feedback: task.data.gapOptions
        ? ankreuzFeedback(wrong, values, a.blanks.length)
        : correct
          ? "Alle Lücken richtig!"
          : `${wrong.length} von ${a.blanks.length} Lücken sind noch falsch (Lücke ${wrong.map((i) => i + 1).join(", ")}).`,
    };
  }
  if (a.accepted && a.accepted.length > 0) {
    const correct = a.accepted.some((exp) => sameAnswer(given, exp, a.mode ?? "text", a.contractions, a.satzzeichen));
    let feedback = correct ? "Richtig!" : "Leider nicht richtig.";
    if (!correct && a.mode === "value" && parseNumber(given) === null && given.trim()) {
      feedback = "Die Eingabe ist keine Zahl. Schreib z. B. 3/4, 1 1/2 oder 0,75.";
    }
    return { correct, errorLabel: correct ? null : labelFor(task, given), feedback };
  }
  return { correct: null, errorLabel: null, feedback: "Wird bewertet." };
}

/** Lückentext zum Ankreuzen: die Lücken heißen ① ② wie auf dem Maturablatt; ein Punkt nur, wenn alle stimmen. */
function ankreuzFeedback(wrong: number[], values: string[], gaps: number): string {
  if (!wrong.length) return "Richtig!";
  const leer = wrong.filter((i) => !(values[i] ?? "").trim());
  const liste = (xs: number[]) => xs.map((i) => kreisZahl(i + 1)).join(" und ");
  if (leer.length === gaps) return "Kreuze bei jeder Lücke eine Möglichkeit an.";
  const falsch = wrong.filter((i) => !leer.includes(i));
  return [
    falsch.length === gaps && gaps === 2 ? "Beide Lücken stimmen nicht." : falsch.length ? `Lücke ${liste(falsch)} ${falsch.length === 1 ? "stimmt" : "stimmen"} nicht.` : "",
    leer.length ? `Kreuze bei Lücke ${liste(leer)} noch eine Möglichkeit an.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function gapCount(prompt: string) {
  return prompt.split(GAP).length - 1;
}

/** Graded hints: a nudge, the rule, the first step. More than three are just numbered. */
export const HINT_LABELS = ["Denkanstoß", "Regel", "Erster Schritt"];
export const hintLabel = (i: number) => `Hilfe ${i + 1}${HINT_LABELS[i] ? ` · ${HINT_LABELS[i]}` : ""}`;
