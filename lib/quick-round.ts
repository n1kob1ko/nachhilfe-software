/**
 * Schnellrunde (Phase 2 des Merges, D11): eine Übung im Schülermodus, aber im Durchlauf — ein Tipp,
 * kurze Rückmeldung, automatisch die nächste Aufgabe, Anfang und Ende als eigene Seite.
 *
 * Nur der Ablauf ist anders: Versuche, Zeit und Hilfen laufen über denselben Weg wie sonst
 * (lib/service.ts submitAnswer, app/actions.ts submitAnswerAction), es gibt keine eigene Ablage.
 *
 * Ob eine Übung eine Schnellrunde sein **darf**, steht genau einmal hier: `isQuickRound`. Lehreroberfläche
 * (`app/(tutor)/uebungen/[id]/page.tsx`, components/WorksheetPanels.tsx, lib/builder.ts releaseWorksheet)
 * und Schülerseite (app/lernen/[token]/[aid]/page.tsx) benutzen dieselbe Prüfung, damit sie sich nicht
 * widersprechen können.
 */
import type { Category } from "./curriculum";

/** Wie eine Übung einem Schüler gezeigt wird: der übliche Ablauf oder als Schnellrunde. */
export type AssignmentMode = "normal" | "schnell";

export const isAssignmentMode = (x: unknown): x is AssignmentMode => x === "normal" || x === "schnell";

/** Höchstens so viele Antworten hat eine Aufgabe, die in eine Schnellrunde passt. */
export const QUICK_ROUND_MAX_OPTIONS = 4;
/** Weniger als zwei Antworten sind keine Auswahl. */
export const QUICK_ROUND_MIN_OPTIONS = 2;

/**
 * Eine Aufgabe, wie sie die Prüfung braucht — absichtlich in beiden Formen: der Lehrer hat
 * `lib/repo.ts Task` (`data.options`), die Schülerseite `components/Solver.tsx ClientTask` (`options`).
 */
export type QuickRoundTask = { type: string; options?: string[] | null; data?: { options?: string[] | null } };

export const quickRoundOptions = (t: QuickRoundTask): string[] | null => t.data ? (t.data.options ?? null) : (t.options ?? null);

/**
 * Warum diese Aufgaben keine Schnellrunde sind, oder null, wenn sie eine sein können.
 * Eine Schnellrunde ist nur Multiple Choice mit zwei bis vier Antworten: ein Tipp muss die Aufgabe
 * beantworten können, und am Tablet muss jede Antwort ohne Rollen erreichbar bleiben.
 */
export function quickRoundProblem(tasks: QuickRoundTask[]): string | null {
  if (!tasks.length) return "Die Übung hat noch keine Aufgaben.";
  for (const [i, t] of tasks.entries()) {
    const options = quickRoundOptions(t);
    if (t.type !== "mc" || !options) return `Aufgabe ${i + 1} ist kein Multiple Choice. In eine Schnellrunde passen nur Multiple-Choice-Aufgaben.`;
    if (options.length > QUICK_ROUND_MAX_OPTIONS) return `Aufgabe ${i + 1} hat ${options.length} Antworten. In eine Schnellrunde passen höchstens vier.`;
    if (options.length < QUICK_ROUND_MIN_OPTIONS) return `Aufgabe ${i + 1} hat weniger als zwei Antworten.`;
  }
  return null;
}

/** Darf diese Übung als Schnellrunde gesendet werden? */
export const isQuickRound = (tasks: QuickRoundTask[]): boolean => quickRoundProblem(tasks) === null;

/**
 * Was die Schülerseite zeigt: die Schnellrunde nur, wenn der Lehrer sie so gesendet hat **und** die
 * Aufgaben es noch hergeben (Aufgaben sind nach dem ersten Versuch nicht mehr änderbar, die Prüfung
 * steht trotzdem hier — sie ist die eine Wahrheit für beide Seiten).
 */
export const showsQuickRound = (mode: string | null | undefined, tasks: QuickRoundTask[]): boolean => mode === "schnell" && isQuickRound(tasks);

/**
 * Ob die im Builder gewählten Aufgabentypen überhaupt eine Schnellrunde ergeben **können**: jeder gewählte
 * Typ muss Multiple Choice erlauben (viele Typen können mehr als eines, z. B. „Grammatik“ auch
 * Kurzantwort). Das ist die Vorprüfung für Schritt 6 — die Aufgaben gibt es dort noch nicht; endgültig
 * entscheidet `isQuickRound` beim Senden über die fertigen Aufgaben. „Gemischte Aufgaben“ (keine Wahl)
 * können alles ergeben und sind darum keine Zusage.
 */
export function categoriesFitQuickRound(cats: Category[]): boolean {
  return cats.length > 0 && cats.every((c) => c.formats.includes("mc"));
}

/** Kurzer deutscher Grund, warum es mit diesen Aufgabentypen keine Schnellrunde werden kann. */
export const QUICK_ROUND_CATEGORY_REASON =
  "Eine Schnellrunde ist nur Multiple Choice mit höchstens vier Antworten. Wähle im Schritt 6 einen Aufgabentyp, der Multiple Choice erlaubt.";
