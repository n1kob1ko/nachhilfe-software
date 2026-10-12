/**
 * Auswendig schreiben (Phase 2 des Merges, aus Artikel Trainers `memorize.html` — nur der Mechanik, D4):
 * Der Schüler sieht den Text, dann verschwinden nach und nach Wörter und Buchstaben, und er schreibt
 * den Text aus dem Gedächtnis. Geprüft wird Wort für Wort mit dem vorhandenen Fassungsvergleich
 * (`lib/text-correction-diff.ts`, compareVersions) — es gibt keinen zweiten Vergleich.
 *
 * Die falschen Wörter landen im Versuch: `checkAnswer` (lib/tasks.ts) gibt sie als Fehler-Etikett
 * zurück, das ist die Spalte `attempts.error_label` (ersetzt Artikel Trainers `lesson_logs.error_word`).
 * Ergebnis und Analyse lesen sie wie jede andere Fehlerbezeichnung.
 *
 * Reine Funktionen: die Stufen des Textes und der Vergleich, damit beides ohne Browser prüfbar ist.
 */
import { categoriesFor } from "./curriculum";
import { compareVersions } from "./text-correction-diff";

/** Die vier Stufen, in denen der Text gezeigt wird — von „ganzer Text“ bis „ohne Hilfe“. */
export const MEMORIZE_LEVELS = ["Ganzer Text", "Jedes 3. Wort verdeckt", "Nur erste Buchstaben", "Ohne Hilfe"] as const;
export type MemorizeLevel = 0 | 1 | 2 | 3;
export const MEMORIZE_LAST_LEVEL: MemorizeLevel = 3;
export const isMemorizeLevel = (x: unknown): x is MemorizeLevel => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= MEMORIZE_LAST_LEVEL;

/** Der Aufgabentyp „Auswendig schreiben“ in `tasks.category` (lib/curriculum.ts CATEGORIES). */
export const MEMORIZE_CATEGORY = "auswendig";

/** Ob diese Kategorie ein Auswendig-schreiben ist (der Builder erzeugt daraus leere Aufgaben zum Ausfüllen). */
export function memorizeCategory(subject: string, category: string | null | undefined): boolean {
  if (!category) return false;
  const c = categoriesFor(subject).find((x) => x.key === category);
  return Boolean(c && c.formats.length === 1 && c.formats[0] === "memorize");
}

const WORD = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

/** Die Wörter eines Textes (ohne Satzzeichen), in der Reihenfolge des Textes. */
export const memorizeWords = (text: string): string[] => [...text.matchAll(WORD)].map((m) => m[0]);

/**
 * Beim Auswendigschreiben zählen nur Wörter: Satzzeichen, Anführungszeichen und Bindestriche am Rand
 * sind keine eigenen Wörter (wie im Vorbild, das beim Mitzählen `[.,!?;:]` wegwirft). Groß- und
 * Kleinschreibung zählt dagegen mit — sie gehört zum Text.
 */
const wordsOnly = (s: string) => s.replace(/[^\p{L}\p{N}\s'’\-]/gu, " ").replace(/\s+/g, " ").trim();

/**
 * Der Text, wie ihn der Schüler auf dieser Stufe sieht:
 *   0 = vollständig, 1 = jedes dritte Wort verdeckt (so lang wie das Wort), 2 = nur die ersten
 *   Buchstaben jedes Wortes (mit „…“), 3 = leer.
 */
export function maskPassage(passage: string, level: MemorizeLevel): string {
  if (level === 0) return passage;
  if (level === 3) return "";
  let wordIndex = 0;
  // Läuft über die Wortgrenzen und lässt die Zwischenräume stehen, damit die Zeilenumbrüche bleiben
  return passage.replace(/\S+/gu, (word) => {
    wordIndex++;
    if (level === 1) return wordIndex % 3 === 0 ? "▁".repeat(word.length) : word;
    const first = /[\p{L}\p{N}]/u.exec(word);
    return first ? `${word.slice(0, first.index + 1)}…` : word;
  });
}

export type MemorizeCheck = {
  correct: boolean;
  /** Die Wörter des Textes, die noch nicht stimmen (in der Reihenfolge des Textes, ohne Wiederholung). */
  mistakes: string[];
  feedback: string;
};

/** So viele falsche Wörter stehen im Etikett des Versuchs (nicht mehr, sonst wird es unlesbar). */
export const MAX_LABELED_MISTAKES = 8;

export function mistakeLabel(mistakes: string[]): string | null {
  if (!mistakes.length) return null;
  const shown = mistakes.slice(0, MAX_LABELED_MISTAKES).map((w) => `„${w}“`);
  return `Falsche Wörter: ${shown.join(", ")}${mistakes.length > shown.length ? ` (+${mistakes.length - shown.length})` : ""}`;
}

/**
 * Die Wörter der Stelle, die im Ersatz in derselben Reihenfolge stehen bleiben: sie hat der Schüler
 * geschrieben, falsch sind sie nicht. Der Vergleich fasst eine Stelle großzügig zusammen („und bellt“ →
 * „und“ steht als eine Änderung da), darum wird hier noch einmal Wort für Wort geschaut — der Vergleich
 * bleibt der von `lib/text-correction-diff.ts`, hier wird nur gelesen, was er gemeldet hat.
 */
function keptInPlace(gone: string[], put: string[]): Set<string> {
  const kept = new Set<string>();
  let at = 0;
  for (const word of gone) {
    const i = put.indexOf(word, at);
    if (i < 0) continue;
    kept.add(word);
    at = i + 1;
  }
  return kept;
}

/**
 * Prüft Wort für Wort gegen den Text. Der Vergleich selbst ist `compareVersions` aus
 * `lib/text-correction-diff.ts`: jede Änderung ist eine Stelle des Textes, an der andere Wörter stehen
 * als geschrieben wurden. Die Wörter dieser Stellen sind die Fehler des Versuchs.
 */
export function checkMemorize(passage: string, given: string): MemorizeCheck {
  const target = wordsOnly(passage);
  if (!target) return { correct: false, mistakes: [], feedback: "Zu dieser Aufgabe fehlt der Text." };
  const written = wordsOnly(given);
  if (!written) return { correct: false, mistakes: [], feedback: "Schreib den Text aus dem Gedächtnis in das Feld." };

  const comparison = compareVersions(target, written);
  const seen = new Set<string>();
  const mistakes: string[] = [];
  for (const change of comparison.changes) {
    const gone = memorizeWords(target.slice(change.start, change.end));
    const kept = keptInPlace(gone, memorizeWords(change.replacement));
    for (const word of gone) {
      if (seen.has(word) || kept.has(word)) continue;
      seen.add(word);
      mistakes.push(word);
    }
  }
  // Ein Text, der nichts mit der Vorlage zu tun hat, wird vom Vergleich als „unrelated“ gemeldet: dann
  // stehen keine Stellen fest. Für das Etikett zählen hier die Wörter der Vorlage, die ganz fehlen.
  if (comparison.unrelated) {
    const has = new Set(memorizeWords(written));
    for (const word of memorizeWords(target)) {
      if (has.has(word) || seen.has(word)) continue;
      seen.add(word);
      mistakes.push(word);
    }
  }

  const total = memorizeWords(target).length;
  // Ein zusätzliches Wort fällt aus dem Vergleich heraus (er vergleicht Stellen des Textes, nicht
  // Einfügungen): die Wortzahl fängt es auf, damit ein zu viel geschriebenes Wort nicht als richtig gilt.
  const extra = memorizeWords(written).length - total;
  const correct = !comparison.unrelated && mistakes.length === 0 && extra === 0;
  if (correct) return { correct: true, mistakes: [], feedback: "Alles richtig auswendig geschrieben!" };

  const list = mistakes.slice(0, 5).map((w) => `„${w}“`);
  if (!mistakes.length) return { correct: false, mistakes, feedback: extra > 0 ? `Du hast ${extra} ${extra === 1 ? "Wort" : "Wörter"} zu viel geschrieben.` : "Es fehlen noch Wörter." };
  const howMany =
    extra !== 0
      ? `${mistakes.length} Wörter passen noch nicht (insgesamt ${total}):`
      : mistakes.length === 1
        ? `1 von ${total} Wörtern stimmt noch nicht:`
        : `${mistakes.length} von ${total} Wörtern stimmen noch nicht:`;
  return {
    correct: false,
    mistakes,
    feedback: `${howMany} ${list.join(", ")}${mistakes.length > list.length ? ` und ${mistakes.length - list.length} weitere` : ""}.`,
  };
}
