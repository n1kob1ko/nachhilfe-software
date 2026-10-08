/**
 * Fehlerarten: the kind of a wrong answer, next to the concrete error label of a task
 * ("Kehrwert vergessen" → Regel nicht verstanden). Without AI the app only suggests a kind where a
 * rule is clear (sign flipped, unit missing, one letter off …); the teacher confirms or changes it.
 * What is stored stays traceable: attempts.error_type is the category in use, error_type_source says
 * where it came from (vorschlag / lehrer / ki), error_type_suggested keeps the first automatic
 * suggestion (the app's or the AI's; error_type_suggested_source says which), error_type_by and
 * error_type_at who set it and when.
 */
import { normalizeText, parseNumber, sameAnswer, type TaskDraft } from "./tasks";

export const ERROR_TYPES = [
  { key: "rechenfehler", label: "Rechenfehler" },
  { key: "vorzeichen", label: "Vorzeichenfehler" },
  { key: "umformung", label: "Falsche Umformung" },
  { key: "bruch", label: "Fehler beim Bruchrechnen" },
  { key: "prozent", label: "Prozentrechnung falsch angewendet" },
  { key: "regel", label: "Regel nicht verstanden" },
  { key: "fluechtig", label: "Flüchtigkeitsfehler" },
  { key: "gelesen", label: "Aufgabe falsch gelesen" },
  { key: "verstanden", label: "Aufgabe nicht verstanden" },
  { key: "formel", label: "Falsche Formel" },
  { key: "einheit", label: "Einheitenfehler" },
  { key: "grammatik", label: "Grammatikfehler" },
  { key: "rechtschreibung", label: "Rechtschreibfehler" },
  { key: "wortschatz", label: "Wortschatzproblem" },
  { key: "unbekannt", label: "Unbekannt" },
] as const;
export type ErrorType = (typeof ERROR_TYPES)[number]["key"];
export type ErrorTypeSource = "vorschlag" | "lehrer" | "ki";
export const ERROR_TYPE_SOURCE_LABEL: Record<ErrorTypeSource, string> = { vorschlag: "Vorschlag der App", lehrer: "vom Lehrer", ki: "von der KI-Korrektur" };
/** Who made the stored suggestion (error_type_suggested_source), for "… war: Vorzeichenfehler". */
export const suggestionBy = (source: string | null | undefined) => (source === "ki" ? "KI-Vorschlag" : "Vorschlag der App");

const LABELS = new Map<string, string>(ERROR_TYPES.map((e) => [e.key, e.label]));
export const isErrorType = (x: unknown): x is ErrorType => typeof x === "string" && LABELS.has(x);
export const errorTypeLabel = (key: string | null | undefined) => (key ? (LABELS.get(key) ?? key) : "");

/** Deutsch, Englisch and other languages: only there spelling, grammar and vocabulary are suggested. */
export const isLanguageSubject = (subject: string) => /deutsch|englisch|english|französisch|franzoesisch|italienisch|spanisch|latein|russisch|sprache/i.test(subject);

/**
 * Keywords in a task's error label → kind of error. The first match that fits the subject wins:
 * "sprache" rules only in a language, "rechnen" rules only outside one ("negative" in Englisch is no
 * Vorzeichenfehler, "Komma" in Mathematik no Grammatikfehler).
 */
const LABEL_RULES: [RegExp, ErrorType, "alle" | "sprache" | "rechnen"][] = [
  [/vorzeichen|minus|negativ/i, "vorzeichen", "rechnen"],
  [/einheit|umrechn|\b(cm|mm|km|kg|m²|cm²|m³)(\s|$)/i, "einheit", "rechnen"],
  [/formel/i, "formel", "rechnen"],
  [/flüchtig|abgeschrieben|vertippt/i, "fluechtig", "alle"],
  [/gelesen|übersehen|falsche frage/i, "gelesen", "alle"],
  [/rechtschreib|groß- und klein|großschreib|kleinschreib|dass\/das|das\/dass|s-laut/i, "rechtschreibung", "sprache"],
  [/zeitform|tense|grammatik|\bfall\b|kasus|artikel|beistrich|komma|satzbau|wortstellung|plural|\bverb|konjug|3rd person|word order|signal ?w/i, "grammatik", "sprache"],
  [/vokabel|\bwortschatz|bedeutung|vocabulary|false friend/i, "wortschatz", "sprache"],
  [/verrechnet|rechenfehler|einmaleins|übertrag/i, "rechenfehler", "rechnen"],
];

/** A metric unit after a number ("3,5 m", "350 cm²") or written out: only then can ×10 be a unit error. */
const METRIC = /\d\s*(mm|cm|dm|km|m|mg|g|dag|kg|t|ml|cl|dl|hl|l|ha)[²³]?(?![A-Za-zÄÖÜäöüß])/;
const METRIC_WORD = /\b(quadrat|kubik)?(milli|zenti|dezi|kilo)?(meter|gramm|liter)n?\b|\bhektar|\btonnen?\b/i;
const unitIn = (text: string) => METRIC.test(text) || METRIC_WORD.test(text);
const UNIT_END = /\s*[a-zA-Zµ²³°]+$/;
const unitOf = (x: string) => x.trim().match(/[a-zA-Zµ²³°]+$/)?.[0] ?? "";

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
/**
 * Same digits in another order (34 ↔ 43), or one digit off in a number with at least three digits
 * (125 ↔ 135): a slip in the calculation. 3 for 5 or 18 for 12 can be anything, so no guess there.
 */
function digitSlip(given: number, expected: number): boolean {
  if (Math.sign(given) !== Math.sign(expected)) return false;
  const digits = (x: number) => String(Math.abs(x)).replace(".", "").replace(/^0+/, "");
  const g = digits(given);
  const e = digits(expected);
  if (g.length !== e.length || g === e || g.length < 2) return false;
  if ([...g].sort().join() === [...e].sort().join()) return true;
  return g.length >= 3 && [...g].filter((c, i) => c !== e[i]).length === 1;
}

/** Inflection endings: a word that differs only here is a grammar error (seinen/seinem, walk/walks). */
const ENDINGS: Record<"deutsch" | "englisch", Set<string>> = {
  deutsch: new Set(["", "e", "n", "m", "s", "r", "t", "en", "em", "er", "es", "st", "et", "te", "est", "ten", "tet", "ern"]),
  englisch: new Set(["", "s", "d", "es", "ed", "er", "ing", "est", "ies", "ied"]),
};

type Checkable = Pick<TaskDraft, "type" | "data" | "answer" | "category"> & { prompt?: string };

/** Kind of error in one wrong text field of a language task, or null. */
function wordSlip(given: string, expected: string[], exact: boolean, subject: string): ErrorType | null {
  // capitalisation only (in "text" mode that already counts as right)
  if (exact && expected.some((exp) => normalizeText(given) === normalizeText(exp))) return "rechtschreibung";
  const lang = /deutsch/i.test(subject) ? "deutsch" : /englisch|english/i.test(subject) ? "englisch" : null;
  const found = new Set<ErrorType>();
  for (const exp of expected) {
    // the one word that differs (several different words: only the whole text is compared)
    const g = normalizeText(given).split(" ");
    const e = normalizeText(exp).split(" ");
    const diff = g.length === e.length ? g.map((_, i) => i).filter((i) => g[i] !== e[i]) : [];
    if (diff.length === 1) {
      const [x, y] = [g[diff[0]], e[diff[0]]];
      let p = 0;
      while (p < x.length && p < y.length && x[p] === y[p]) p++;
      const [rx, ry] = [x.slice(p), y.slice(p)];
      if (p >= 3 && Math.min(x.length, y.length) >= 4 && rx.length <= 3 && ry.length <= 3) {
        // only the ending differs: Kasus, plural, 3rd person -s …; in other languages no guess
        if (!lang) return null;
        if (ENDINGS[lang].has(rx) && ENDINGS[lang].has(ry)) {
          found.add("grammatik");
          continue;
        }
      }
    }
    const d = levenshtein(normalizeText(given), normalizeText(exp));
    if (exp.length >= 4 && d > 0 && d <= (exp.length >= 8 ? 2 : 1)) found.add("rechtschreibung");
  }
  // alternatives pointing to different kinds: no guess
  return found.size === 1 ? [...found][0] : null;
}

/** Kind of error in one wrong number: sign, unit, a slip in the digits; null when no rule fits. */
function numberSlip(given: string, expected: string[], unitAsked: boolean): ErrorType | null {
  const exp = expected.find((x) => parseNumber(x.replace(UNIT_END, "")) !== null) ?? expected[0] ?? "";
  const g = parseNumber(given);
  const e = parseNumber(exp);
  if (g !== null && e !== null && e !== 0) {
    if (Math.abs(g + e) < 1e-9) return "vorzeichen";
    const ratio = g / e;
    if (unitAsked && [10, 100, 1000, 0.1, 0.01, 0.001].some((r) => Math.abs(ratio - r) < 1e-9)) return "einheit";
    return digitSlip(g, e) ? "rechenfehler" : null;
  }
  // "12 cm" for "12 m²" and similar: the number is right, the unit is not
  const gNum = parseNumber(given.replace(UNIT_END, ""));
  const eNum = parseNumber(exp.replace(UNIT_END, ""));
  if (unitOf(exp) && gNum !== null && eNum !== null && Math.abs(gNum - eNum) < 1e-9 && unitOf(given) !== unitOf(exp)) return "einheit";
  return null;
}

/**
 * A suggested kind for a wrong answer, or null when no rule fits (the teacher can still set one).
 * A wrong guess is worse than none, so every rule is narrow. `label` is the error label from the
 * task's error map, if the answer matched one; `subject` the subject of the exercise.
 */
export function suggestErrorType(task: Checkable, given: string, label: string | null, subject = ""): ErrorType | null {
  const language = isLanguageSubject(subject);
  if (label) {
    let otherSubject = false;
    for (const [re, type, scope] of LABEL_RULES) {
      if (!re.test(label)) continue;
      if (scope === "alle" || (scope === "sprache") === language) return type;
      otherSubject = true;
    }
    // a known misconception of the task: the rule behind it is not understood yet
    // (a keyword of the other kind of subject, e.g. "Komma" in Mathematik: no guess)
    return otherSubject ? null : "regel";
  }
  const a = task.answer;
  if (!given.trim()) return null;
  // the answer, or each gap that was wrong, with its own expected values
  let fields: { given: string; expected: string[] }[] = [];
  if (a.blanks) {
    let values: unknown;
    try {
      values = JSON.parse(given);
    } catch {
      values = [given];
    }
    const list = Array.isArray(values) ? values.map((v) => String(v ?? "")) : [given];
    fields = a.blanks
      .map((alts, i) => ({ given: list[i] ?? "", expected: alts }))
      .filter((f) => f.given.trim() && f.expected.length && !f.expected.some((alt) => sameAnswer(f.given, alt, a.mode ?? "text")));
  } else if (a.accepted?.length) {
    fields = [{ given, expected: a.accepted }];
  }
  if (!fields.length) return null;
  const kinds = fields.map((f) => {
    // numbers (also numbers in gaps) never get a spelling category, and in a language (a year, a page) no Rechenfehler either
    if (a.mode === "value" || f.expected.every((x) => parseNumber(x) !== null)) {
      return { kind: language ? null : numberSlip(f.given, f.expected, unitIn(f.expected.join(" ")) || unitIn(task.prompt ?? "")), numeric: true };
    }
    const words = language && (task.type === "grammar" || task.type === "cloze" || task.type === "calc");
    return { kind: words ? wordSlip(f.given, f.expected, a.mode === "exact", subject) : null, numeric: false };
  });
  // every wrong field has to point to the same kind
  const found = new Set(kinds.map((k) => k.kind));
  if (found.size === 1 && kinds[0].kind) return kinds[0].kind;
  if (found.size > 1 || kinds.some((k) => k.numeric) || !language) return null;
  if (task.category === "vocabulary" || task.category === "translation") return "wortschatz";
  if (task.type === "grammar" && /deutsch|englisch/i.test(subject)) return "grammatik";
  return null;
}
