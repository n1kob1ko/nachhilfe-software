/**
 * Fehlerarten: the kind of a wrong answer, next to the concrete error label of a task
 * ("Kehrwert vergessen" → Regel nicht verstanden). Without AI the app only suggests a kind where a
 * rule is clear (sign flipped, unit missing, one letter off …); the teacher confirms or changes it.
 * What is stored stays traceable: attempts.error_type is the category in use, error_type_source says
 * where it came from (vorschlag / lehrer / ki), error_type_suggested keeps the app's own suggestion,
 * error_type_by and error_type_at who set it and when.
 */
import { normalizeText, parseNumber, type TaskDraft } from "./tasks";

export const ERROR_TYPES = [
  { key: "rechenfehler", label: "Rechenfehler" },
  { key: "vorzeichen", label: "Vorzeichenfehler" },
  { key: "regel", label: "Regel nicht verstanden" },
  { key: "fluechtig", label: "Flüchtigkeitsfehler" },
  { key: "gelesen", label: "Aufgabe falsch gelesen" },
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

const LABELS = new Map<string, string>(ERROR_TYPES.map((e) => [e.key, e.label]));
export const isErrorType = (x: unknown): x is ErrorType => typeof x === "string" && LABELS.has(x);
export const errorTypeLabel = (key: string | null | undefined) => (key ? (LABELS.get(key) ?? key) : "");

/** Keywords in a task's error label → kind of error. The first match wins. */
const LABEL_RULES: [RegExp, ErrorType][] = [
  [/vorzeichen|minus|negativ/i, "vorzeichen"],
  [/einheit|umrechn|\b(cm|mm|km|kg|m²|cm²|m³)(\s|$)/i, "einheit"],
  [/formel/i, "formel"],
  [/flüchtig|abgeschrieben|vertippt/i, "fluechtig"],
  [/gelesen|übersehen|falsche frage/i, "gelesen"],
  [/rechtschreib|groß- und klein|großschreib|kleinschreib|dass\/das|das\/dass|s-laut/i, "rechtschreibung"],
  [/zeitform|tense|grammatik|\bfall\b|kasus|artikel|beistrich|komma|satzbau|wortstellung|plural|\bverb|konjug|3rd person|word order|signal ?w/i, "grammatik"],
  [/vokabel|\bwortschatz|bedeutung|vocabulary|false friend/i, "wortschatz"],
  [/verrechnet|rechenfehler|einmaleins|übertrag/i, "rechenfehler"],
];

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
/** Same digits in another order (34 ↔ 43) or one digit off: a slip in the calculation. */
function digitSlip(given: number, expected: number): boolean {
  const g = String(Math.abs(given)).replace(".", "");
  const e = String(Math.abs(expected)).replace(".", "");
  if (g.length !== e.length || g === e) return false;
  if ([...g].sort().join() === [...e].sort().join()) return true;
  return [...g].filter((c, i) => c !== e[i]).length === 1;
}

type Checkable = Pick<TaskDraft, "type" | "data" | "answer" | "category">;

/**
 * A suggested kind for a wrong answer, or null when no rule fits (the teacher can still set one).
 * `label` is the error label from the task's error map, if the answer matched one.
 */
export function suggestErrorType(task: Checkable, given: string, label: string | null, subject = ""): ErrorType | null {
  if (label) {
    for (const [re, type] of LABEL_RULES) if (re.test(label)) return type;
    // a known misconception of the task: the rule behind it is not understood yet
    return "regel";
  }
  const a = task.answer;
  if (!given.trim()) return null;
  // numbers: sign, unit/decimal point, a slip in one digit
  const expectedRaw = a.accepted?.[0];
  if (a.mode === "value" && expectedRaw !== undefined) {
    const g = parseNumber(given);
    const e = parseNumber(expectedRaw);
    if (g !== null && e !== null && e !== 0) {
      if (Math.abs(g + e) < 1e-9) return "vorzeichen";
      const ratio = g / e;
      if ([10, 100, 1000, 0.1, 0.01, 0.001].some((r) => Math.abs(ratio - r) < 1e-9)) return "einheit";
      if (digitSlip(g, e)) return "rechenfehler";
    }
    // "12 cm" for "12 m²" and similar: the number is right, the unit is not
    const unitOf = (x: string) => x.trim().match(/[a-zA-Zµ²³]+$/)?.[0] ?? "";
    const gNum = parseNumber(given.replace(/[a-zA-Zµ²³]+$/, ""));
    if (gNum !== null && e !== null && Math.abs(gNum - e) < 1e-9 && unitOf(given) !== unitOf(expectedRaw)) return "einheit";
    return null;
  }
  // words: capitalisation or one or two letters off
  const expectedTexts = [...(a.accepted ?? []), ...(a.blanks?.flat() ?? [])];
  if (expectedTexts.length && (task.type === "grammar" || task.type === "cloze" || task.type === "calc")) {
    let values: string[] = [given];
    if (a.blanks) {
      try {
        values = JSON.parse(given);
      } catch {
        values = [given];
      }
    }
    for (const v of values) {
      if (!v.trim()) continue;
      for (const exp of expectedTexts) {
        if (normalizeText(v) === normalizeText(exp) && v.trim() !== exp.trim()) return "rechtschreibung";
        const d = levenshtein(normalizeText(v), normalizeText(exp));
        if (exp.length >= 4 && d > 0 && d <= (exp.length >= 8 ? 2 : 1)) return "rechtschreibung";
      }
    }
    if (task.category === "vocabulary" || task.category === "translation") return "wortschatz";
    if (task.type === "grammar" && /deutsch|englisch/i.test(subject)) return "grammatik";
  }
  return null;
}
