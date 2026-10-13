/**
 * Die **KI-Hinweise** eines Schülers (CONTEXT.md): was die KI über ihn wissen soll, z. B. „Legasthenie:
 * kurze Sätze, keine Großbuchstaben-Wörter als Fehler werten“. Die Lehrkraft schreibt sie im Profil des
 * Schülers (Phase 6 des Merges, Schritt 3). Sie stehen im Systemprompt **jeder schülerbezogenen Anfrage**
 * (lib/ai/router.ts) und gehen dort **nie zusammen mit dem Namen** des Schülers hinaus: der Name — und
 * jeder weitere Name, den der Text selbst nennt — wird vorher durch `[Name]` ersetzt, mit denselben zwei
 * Aufrufen wie beim Textversand (`detectNames`, `namePattern`/`maskText`; lib/name-detection.ts und
 * lib/text-correction-core.ts, wie in lib/summary.ts `briefForAI`).
 *
 * Welcher Schüler gemeint ist, sagt die Anfrage: `meta.studentId`, sonst der Schüler der Einheit
 * (`meta.unitId`). Allgemeine Anfragen (Lesetext, Druckblatt, Aufgabenbanken, Verbindungstest) tragen
 * keins von beiden und bleiben unverändert.
 */
import { db } from "../db";
import { detectNames } from "../name-detection";
import { maskText, namePattern } from "../text-correction-core";

/** Was aus der Datenbank gebraucht wird: der Name (zum Verbergen) und die Hinweise. */
export type SchuelerFuerHinweise = { name: string; ki_hinweise: string };

/**
 * Der Schüler, um den es in dieser Anfrage geht, oder null. Ohne `studentId` und ohne `unitId` wird
 * nichts gelesen; ein Fehler in der Datenbank darf eine KI-Anfrage nie abbrechen und liefert null.
 */
export function schuelerDerAnfrage(meta: { studentId?: number | null; unitId?: number | null }): SchuelerFuerHinweise | null {
  if (meta.studentId == null && meta.unitId == null) return null;
  const select = "SELECT s.name, s.ki_hinweise FROM students s";
  try {
    const row =
      meta.studentId != null
        ? (db().prepare(`${select} WHERE s.id = ?`).get(meta.studentId) as SchuelerFuerHinweise | undefined)
        : (db().prepare(`${select} JOIN units u ON u.student_id = s.id WHERE u.id = ?`).get(meta.unitId) as SchuelerFuerHinweise | undefined);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Der Systemprompt mit den KI-Hinweisen des Schülers. Ohne Schüler, ohne Hinweise — oder wenn nach dem
 * Verbergen der Namen nichts übrig bleibt — kommt er **unverändert** zurück, damit sich für alle
 * anderen Anfragen nichts ändert.
 */
export function systemMitHinweisen(system: string, schueler: SchuelerFuerHinweise | null): string {
  const roh = schueler?.ki_hinweise.trim() ?? "";
  if (!schueler || !roh) return system;
  const pattern = namePattern([schueler.name, ...detectNames([roh])]);
  const text = (pattern ? maskText(roh, pattern).masked : roh).trim();
  if (!text) return system;
  return `${system}\n\nKI-Hinweise der Lehrkraft zu dieser Schülerin / diesem Schüler (ohne Namen):\n${text}`;
}
