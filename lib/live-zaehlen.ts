/**
 * Wie viele abgeschlossene Aufgaben einer Übung falsch sind (Gerätezeile des Lehrers). Eine Antwort, die auf die Bewertung des
 * Lehrers wartet (freie Antwort), ist noch nicht falsch: „1 Aufgabe falsch“, obwohl nichts bewertet war (Test 26.11.2026).
 * Ohne Datenbank, damit auch die Ansicht im Browser so zählt; `wartet` fehlt in einem alten Stand.
 */
export const fehlerVon = (c: { done: number; correct: number; wartet?: number }): number => Math.max(0, c.done - c.correct - (c.wartet ?? 0));
